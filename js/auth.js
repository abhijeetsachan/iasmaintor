// js/auth.js
// Robust Authentication Module with Email Verification & UI Gates

import { firebaseConfig } from './firebase-config.js';
import { OPTIONAL_SUBJECT_LIST } from './optional-syllabus-data.js'; // Import Optional List

// --- Firebase SDK Imports ---
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail, 
    signOut,
    sendEmailVerification,
    deleteUser 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    updateDoc,
    enableIndexedDbPersistence,
    collection,
    query,
    onSnapshot,
    orderBy,
    getDocs,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// --- Module State ---
let app, db, auth;
let firestoreModule = {};
let firebaseAuthModule = {};
let currentUser = null;
let currentUserProfile = null;
let authReady = false;
let authHasChecked = false;
let firebaseEnabled = false;
let DOMElements = {};
let globalShowNotification = (message, isError) => console.log(`Notification: ${message}`);
let globalAppId = 'default-app-id';

// --- Local State for Dropdowns ---
let selectedOptionalId = null; // Stores the ID (e.g., 'history') of the selected optional

/**
 * Initialize Auth Module
 */
export async function initAuth(pageDOMElements, appId, showNotification, callbacks = {}) {
    DOMElements = pageDOMElements;
    globalShowNotification = showNotification;
    globalAppId = appId || 'default-app-id'; 
    const { onLogin, onLogout } = callbacks;

    try {
        if (firebaseConfig.apiKey && firebaseConfig.projectId) {
            app = getApps().length ? getApp() : initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);
            firebaseEnabled = true;

            // Map modules
            Object.assign(firestoreModule, { 
                getFirestore, doc, getDoc, setDoc, serverTimestamp, updateDoc, 
                enableIndexedDbPersistence, collection, query, onSnapshot, orderBy, getDocs,
                writeBatch
            });
            
            Object.assign(firebaseAuthModule, { 
                getAuth, onAuthStateChanged, createUserWithEmailAndPassword, 
                signInWithEmailAndPassword, sendPasswordResetEmail, signOut, 
                sendEmailVerification, deleteUser 
            });

            try { await firestoreModule.enableIndexedDbPersistence(db); } catch (err) { /* Ignore persistence errors */ }

            // --- GLOBAL AUTH LISTENER ---
            firebaseAuthModule.onAuthStateChanged(auth, async (user) => {
                let verifiedUser = user;
                
                if (user && !user.isAnonymous) {
                    const CUTOFF_DATE = new Date("2025-11-26"); 
                    const creationTime = new Date(user.metadata.creationTime);
                    const isLegacyUser = creationTime < CUTOFF_DATE;

                    if (!isLegacyUser && !user.emailVerified) {
                        console.log("Auth: New unverified user. Treating as guest.");
                        verifiedUser = null; 
                    }
                }

                if (user?.uid !== currentUser?.uid || !authHasChecked) {
                    currentUser = verifiedUser;
                    const userId = user?.uid;

                    if (verifiedUser && !verifiedUser.isAnonymous) {
                        await fetchUserProfile(userId);
                        if (onLogin) onLogin(verifiedUser, db, firestoreModule, authHasChecked);
                    } else {
                        currentUserProfile = null;
                        if (onLogout) onLogout(authHasChecked);
                        updateUIForAuthStateChange(null, false); 
                    }
                    
                    if (!authReady) authReady = true;
                    authHasChecked = true;
                }
            });

        } else { throw new Error("Missing Firebase config"); }
    } catch (error) {
        console.error("Firebase Init Error:", error);
        authReady = true;
        authHasChecked = true;
    }
    
    initSharedEventListeners();
    
    // Initialize Dropdowns for BOTH Signup and Account forms
    initOptionalSubjectDropdown('signup');
    initOptionalSubjectDropdown('account');

    return { 
        db, auth, firestoreModule, firebaseAuthModule, 
        getCurrentUser: () => currentUser,
        showNotification: globalShowNotification 
    };
}

// --- UI HELPER FUNCTIONS ---

function openModal(modal) {
    if (modal) { 
        modal.classList.remove('hidden'); 
        requestAnimationFrame(() => modal.classList.add('active'));
    } 
}

function closeModal(modal) {
    if (modal) { 
        modal.classList.remove('active'); 
        setTimeout(() => modal.classList.add('hidden'), 300); 
    } 
}

function openAuthModal(mode = 'login') {
    if (currentUser && !currentUser.isAnonymous) { 
        globalShowNotification("You are already logged in.", false); 
        return; 
    }
    const { modal, loginForm, signupForm, error, forgotPasswordView } = DOMElements.authModal;
    if (!modal) return;
    if(error) error.classList.add('hidden');
    if(loginForm) loginForm.reset();
    if(signupForm) signupForm.reset();
    
    // Reset Dropdown UI
    const searchInput = document.getElementById('signup-optional-search');
    const dropdown = document.getElementById('signup-optional-dropdown');
    if(searchInput) searchInput.value = '';
    if(dropdown) dropdown.style.display = 'none';
    selectedOptionalId = null;

    if(forgotPasswordView) forgotPasswordView.classList.add('hidden');
    document.getElementById('login-view')?.classList.toggle('hidden', mode !== 'login');
    document.getElementById('signup-view')?.classList.toggle('hidden', mode !== 'signup');
    openModal(modal);
}

function updateUIForAuthStateChange(user, isAdmin = false) {
    const isLoggedIn = !!user;
    const isAnon = user?.isAnonymous ?? false;
    const isVisibleUser = isLoggedIn && !isAnon;

    DOMElements.authLinks?.classList.toggle('hidden', isVisibleUser);
    DOMElements.userMenu?.classList.toggle('hidden', !isVisibleUser);
    DOMElements.mobileAuthLinks?.classList.toggle('hidden', isVisibleUser);
    DOMElements.mobileUserActions?.classList.toggle('hidden', !isVisibleUser);
    DOMElements.dashboardSection?.classList.toggle('hidden', !isVisibleUser);

    if (isVisibleUser) {
        let displayName = currentUserProfile?.firstName || (user.email ? user.email.split('@')[0] : 'User');
        displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
        if (DOMElements.userGreeting) DOMElements.userGreeting.textContent = `Hi, ${displayName}`;

        // Admin Link Injection (Dropdown)
        const dropdown = DOMElements.userDropdown;
        const adminLinkId = 'dropdown-admin-link';
        let adminLink = document.getElementById(adminLinkId);

        if (isAdmin && dropdown) {
            if (!adminLink) {
                adminLink = document.createElement('a');
                adminLink.id = adminLinkId;
                adminLink.href = 'admin/login.html'; 
                adminLink.className = 'block px-4 py-2 text-sm text-blue-600 font-bold hover:bg-slate-100 flex items-center';
                adminLink.innerHTML = '<i class="fas fa-shield-alt mr-2"></i>Admin Panel';
                
                const divider = dropdown.querySelector('.border-t');
                if(divider) dropdown.insertBefore(adminLink, divider);
                else dropdown.prepend(adminLink);
            }
            adminLink.style.display = 'block';
        } else if (adminLink) {
            adminLink.style.display = 'none';
        }

        // Admin Link Injection (Mobile)
        const mobileMenu = DOMElements.mobileUserActions;
        const mobileAdminId = 'mobile-admin-link';
        let mobileAdmin = document.getElementById(mobileAdminId);
        
        if(isAdmin && mobileMenu) {
             if (!mobileAdmin) {
                mobileAdmin = document.createElement('a');
                mobileAdmin.id = mobileAdminId;
                mobileAdmin.href = 'admin/login.html';
                mobileAdmin.className = 'block py-2 text-blue-600 font-bold flex items-center';
                mobileAdmin.innerHTML = '<i class="fas fa-shield-alt mr-2"></i>Admin Panel';
                mobileMenu.prepend(mobileAdmin);
             }
             mobileAdmin.style.display = 'flex';
        } else if (mobileAdmin) {
            mobileAdmin.style.display = 'none';
        }

    } else {
        if (DOMElements.userGreeting) DOMElements.userGreeting.textContent = '';
    }
}

async function fetchUserProfile(userId) {
    let isAdmin = false;
    try {
        const userDocRef = doc(db, 'artifacts', globalAppId, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            currentUserProfile = userDoc.data().profile;
        } else {
            console.warn("User profile missing. Attempting self-repair.");
            currentUserProfile = { 
                firstName: 'Aspirant', 
                lastName: '', 
                email: auth.currentUser?.email || '',
                createdAt: serverTimestamp() 
            };
            try {
                await setDoc(userDocRef, { profile: currentUserProfile }, { merge: true });
            } catch (writeErr) {
                console.error("Self-repair failed:", writeErr);
            }
        }

        try {
            const adminDocRef = doc(db, 'admin_directory', userId);
            const adminDoc = await getDoc(adminDocRef);
            isAdmin = adminDoc.exists();
        } catch (e) { /* Ignore admin check fail */ }

    } catch (error) { 
        console.error("Profile Fetch Error:", error); 
        currentUserProfile = { firstName: 'User', email: auth.currentUser?.email };
    } finally {
        updateUIForAuthStateChange(auth.currentUser, isAdmin);
    }
}

// --- NEW: Reusable Dropdown Initialization ---
// This function handles both the Signup and My Account dropdowns
function initOptionalSubjectDropdown(prefix) {
    const searchInput = document.getElementById(`${prefix}-optional-search`);
    const dropdown = document.getElementById(`${prefix}-optional-dropdown`);

    if (!searchInput || !dropdown) return;

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        dropdown.innerHTML = '';
        
        if (term.length < 1) {
            dropdown.style.display = 'none';
            return;
        }

        const matches = OPTIONAL_SUBJECT_LIST.filter(sub => 
            sub.name.toLowerCase().startsWith(term)
        ).slice(0, 5);

        if (matches.length > 0) {
            dropdown.style.display = 'block';
            matches.forEach(sub => {
                const div = document.createElement('div');
                div.className = 'optional-option';
                div.textContent = sub.name;
                div.onclick = () => {
                    searchInput.value = sub.name;
                    selectedOptionalId = sub.id; // Updates the module-level variable
                    dropdown.style.display = 'none';
                };
                dropdown.appendChild(div);
            });
        } else {
            dropdown.style.display = 'none';
            selectedOptionalId = null; 
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}


// --- EVENT LISTENERS ---

function initSharedEventListeners() {

    // 1. LOGIN LISTENER
    DOMElements.authModal.loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const email = e.target.elements['login-email'].value;
        const password = e.target.elements['login-password'].value;
        const errorEl = DOMElements.authModal.error; 
        if(errorEl) errorEl.classList.add('hidden');
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn ? submitBtn.innerText : 'Log In';
        if(submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Verifying...'; }

        try {
            const userCred = await firebaseAuthModule.signInWithEmailAndPassword(auth, email, password);
            const user = userCred.user;
            
            const CUTOFF_DATE = new Date("2025-11-26"); 
            const creationTime = new Date(user.metadata.creationTime);
            const isLegacyUser = creationTime < CUTOFF_DATE;

            if (!isLegacyUser && !user.emailVerified) {
                if(errorEl) {
                    errorEl.innerHTML = `
                        <strong>Email not verified.</strong><br>
                        Please check your inbox. 
                        <button id="resend-verification-btn" class="underline text-red-800 hover:text-red-600 font-bold ml-1">Resend Link</button>
                    `;
                    errorEl.classList.remove('hidden');
                    
                    const resendBtn = document.getElementById('resend-verification-btn');
                    if(resendBtn) {
                        resendBtn.onclick = async (evt) => {
                            evt.preventDefault();
                            try {
                                await firebaseAuthModule.sendEmailVerification(user);
                                resendBtn.innerText = "Sent!";
                                resendBtn.disabled = true;
                                globalShowNotification("Verification email resent.");
                            } catch (err) {
                                console.error(err);
                                globalShowNotification("Too many requests. Try again later.", true);
                            }
                        };
                    }
                }
                await firebaseAuthModule.signOut(auth); 
                return;
            }

            closeModal(DOMElements.authModal.modal); 
            globalShowNotification("Welcome back!");
        } catch(error){ 
             console.error("Login error:", error.code); 
             if(errorEl){
                 let msg = "Login failed.";
                 if (error.code.includes('user-not-found') || error.code.includes('wrong-password') || error.code.includes('invalid-credential')) msg = "Invalid email or password.";
                 else if (error.code.includes('too-many-requests')) msg = "Too many attempts. Try again later.";
                 errorEl.textContent = msg; 
                 errorEl.classList.remove('hidden');
             } 
        } finally {
            if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = originalText; }
        }
    });
    
    // 2. SIGNUP LISTENER (Enhanced with New Fields & Robustness)
    DOMElements.authModal.signupForm?.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        
        // Grab Values
        const firstName = document.getElementById('signup-first-name').value.trim();
        const lastName = document.getElementById('signup-last-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const mobile = document.getElementById('signup-mobile').value.trim();
        const mode = document.getElementById('signup-mode').value;
        const medium = document.getElementById('signup-medium').value;
        const year = document.getElementById('signup-year').value;
        
        const errorEl = DOMElements.authModal.error; 
        if(errorEl) errorEl.classList.add('hidden');
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.innerText : 'Sign Up';
        if(submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Creating Account...'; }

        let createdUser = null;

        try {
            // 1. Create Auth User
            const userCred = await firebaseAuthModule.createUserWithEmailAndPassword(auth, email, password); 
            createdUser = userCred.user;
            
            // 2. Create Profile Document (CRITICAL STEP)
            try {
                const { doc, setDoc, serverTimestamp } = firestoreModule; 
                const safeAppId = globalAppId || 'default-app-id';
                const userDocRef = doc(db, 'artifacts', safeAppId, 'users', createdUser.uid);
                
                const profileData = { 
                    firstName, 
                    lastName, 
                    email,
                    mobile,
                    preparationMode: mode,
                    medium: medium,
                    appearingYear: year,
                    optionalSubject: selectedOptionalId || null,
                    createdAt: serverTimestamp()
                };

                await setDoc(userDocRef, { profile: profileData }, { merge: true });
                
            } catch (dbErr) { 
                // 3. ROLLBACK: Delete Auth User if DB write fails
                console.error("Profile creation failed. Rolling back Auth.", dbErr);
                await firebaseAuthModule.deleteUser(createdUser);
                throw new Error("Database connection failed. Please try again.");
            }

            // 4. Send Verification Email
            try {
                await firebaseAuthModule.sendEmailVerification(createdUser);
            } catch (emailError) {
                console.warn("Verification email failed (non-fatal):", emailError);
            }

            // 5. Sign Out (Force login after verification)
            await firebaseAuthModule.signOut(auth);

            closeModal(DOMElements.authModal.modal); 
            
            if (DOMElements.successOverlay) {
                const title = DOMElements.successOverlay.querySelector('h3');
                const desc = DOMElements.successOverlay.querySelector('p');
                if(title) title.textContent = "Verification Link Sent!";
                if(desc) desc.innerHTML = `We sent an email to <strong>${email}</strong>.<br>Please click the link in it to verify your account.`;
                DOMElements.successOverlay.classList.add('modal');
                openModal(DOMElements.successOverlay);
                setTimeout(() => { closeModal(DOMElements.successOverlay); }, 6000);
            } else {
                globalShowNotification("Verification email sent! Please check your inbox.", false);
            }

        } catch(error){ 
            if(errorEl){
                let msg = error.message || "Signup failed.";
                if (error.code === 'auth/email-already-in-use') msg = "That email is already registered. Please log in.";
                errorEl.textContent = msg;
                errorEl.classList.remove('hidden');
            }
        } finally {
            if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = originalBtnText; }
        }
    });

    // 3. ACCOUNT UPDATE LISTENER (Enhanced)
    DOMElements.accountModal.form?.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        if (!currentUser || currentUser.isAnonymous) return;
        
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn ? btn.innerText : 'Save';
        if(btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

        const firstName = document.getElementById('account-first-name').value.trim();
        const lastName = document.getElementById('account-last-name').value.trim();
        
        // Capture New Edit Fields
        const mobile = document.getElementById('account-mobile').value.trim();
        const mode = document.getElementById('account-mode').value;
        const medium = document.getElementById('account-medium').value;
        const year = document.getElementById('account-year').value;
        
        try {
            const { doc, updateDoc } = firestoreModule; 
            const userDocRef = doc(db, 'artifacts', globalAppId, 'users', currentUser.uid);
            
            const updateData = { 
                'profile.firstName': firstName, 
                'profile.lastName': lastName,
                'profile.mobile': mobile,
                'profile.preparationMode': mode,
                'profile.medium': medium,
                'profile.appearingYear': year
            };
            
            // Only update optional if changed/selected via dropdown
            if (selectedOptionalId) {
                updateData['profile.optionalSubject'] = selectedOptionalId;
            }

            await updateDoc(userDocRef, updateData); 
            
            globalShowNotification('Account updated!');
            
            // Local state update so UI reflects changes immediately
            if (currentUserProfile) { 
                Object.assign(currentUserProfile, { 
                    firstName, lastName, mobile, preparationMode: mode, medium, appearingYear: year 
                });
                if(selectedOptionalId) currentUserProfile.optionalSubject = selectedOptionalId;
            }
            updateUIForAuthStateChange(currentUser);
            closeModal(DOMElements.accountModal.modal);
        } catch(error){ 
            console.error("Account update failed:", error); 
            globalShowNotification("Failed to save changes.", true);
        } finally {
            if(btn) { btn.disabled = false; btn.innerText = originalText; }
        }
    });

    // Password Reset
    DOMElements.authModal.forgotPasswordForm?.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        const email = e.target.elements['reset-email'].value; 
        try { 
            await firebaseAuthModule.sendPasswordResetEmail(auth, email); 
            globalShowNotification('Password reset email sent.'); 
            openAuthModal('login'); 
        } catch(error){ console.error(error); }
    });

    DOMElements.mobileMenuButton?.addEventListener('click', () => DOMElements.mobileMenu?.classList.toggle('hidden'));
    
    // User Menu Dropdown
    const userMenuBtn = document.getElementById('user-menu-button');
    const userDropdown = document.getElementById('user-dropdown');

    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('hidden');
        });

        document.body.addEventListener('click', (e) => {
            if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.add('hidden');
            }
        });
    }

    // Global Clicks (Login/Logout/Account)
    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        const targetId = target.id;

        if (['login-btn', 'mobile-login-btn'].includes(targetId) || target.closest('#login-btn, #mobile-login-btn')) { 
            e.preventDefault(); openAuthModal('login'); 
        }
        if (target.closest('#dropdown-logout-btn, #mobile-logout-btn')) { 
             try { await firebaseAuthModule.signOut(auth); globalShowNotification('Logged out.'); }
             catch (error) { console.error(error); }
        }
        
        // Open Account Modal & Populate Fields
        if (target.closest('#my-account-btn, #mobile-my-account-btn')) {
            e.preventDefault();
            if (!authReady || !currentUser || currentUser.isAnonymous) { openAuthModal('login'); return; }
            
            // Populate Basic Fields
            document.getElementById('account-first-name').value = currentUserProfile?.firstName || '';
            document.getElementById('account-last-name').value = currentUserProfile?.lastName || '';
            document.getElementById('account-email').value = currentUser.email || '';
            
            // Populate New Fields (with safe fallbacks)
            document.getElementById('account-mobile').value = currentUserProfile?.mobile || '';
            document.getElementById('account-mode').value = currentUserProfile?.preparationMode || 'Self Study';
            document.getElementById('account-medium').value = currentUserProfile?.medium || 'English';
            document.getElementById('account-year').value = currentUserProfile?.appearingYear || '2026';

            // Populate Optional (Convert ID to Name using list)
            const optId = currentUserProfile?.optionalSubject;
            const accountSearch = document.getElementById('account-optional-search');
            
            if (optId && accountSearch) {
                const subjectObj = OPTIONAL_SUBJECT_LIST.find(s => s.id === optId);
                accountSearch.value = subjectObj ? subjectObj.name : optId;
                selectedOptionalId = optId; // Set module state so we don't lose it if they don't edit
            } else if (accountSearch) {
                accountSearch.value = '';
                selectedOptionalId = null;
            }

            // Explicitly ensure email is visually read-only
            const emailField = document.getElementById('account-email');
            if(emailField) emailField.classList.add('bg-slate-100', 'cursor-not-allowed');
            
            openModal(DOMElements.accountModal.modal);
        }
        
        if (targetId === 'close-auth-modal') closeModal(DOMElements.authModal.modal);
        if (targetId === 'auth-switch-to-signup') openAuthModal('signup');
        if (targetId === 'auth-switch-to-login' || targetId === 'auth-switch-to-login-from-reset') openAuthModal('login');
        if (targetId === 'forgot-password-btn') { 
            document.getElementById('login-view')?.classList.add('hidden'); 
            DOMElements.authModal.forgotPasswordView?.classList.remove('hidden'); 
        }
        if (targetId === 'close-account-modal') closeModal(DOMElements.accountModal.modal);
    });
}
