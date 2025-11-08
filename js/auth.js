// js/auth.js
// This new module centralizes all Firebase Auth, UI, and Modal logic.

import { firebaseConfig } from './firebase-config.js';

// --- Firebase SDK Modules ---
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail, 
    signOut,
    // --- NEW: Added modules that were missing in tracker.js ---
    signInWithCustomToken,
    EmailAuthProvider,
    linkWithCredential,
    GoogleAuthProvider,
    linkWithPopup
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    getDocs,
    setDoc,
    onSnapshot,
    collection,
    query,
    orderBy,
    serverTimestamp,
    updateDoc,
    enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// --- Module State ---
let app, db, auth;
let firestoreModule = {};
let firebaseAuthModule = {};
let currentUser = null;
let currentUserProfile = null;
let authReady = false;
let authHasChecked = false; // Flag to handle initial auth check
let firebaseEnabled = false;
let DOMElements = {};
let globalShowNotification = (message, isError) => console.log(`Notification (${isError ? 'ERROR' : 'INFO'}): ${message}`);
let globalAppId = 'default-app-id';


/**
 * Initializes the Firebase app, auth state, and all shared UI listeners.
 * @param {object} pageDOMElements - A map of all DOM elements needed from the specific page.
 * @param {string} appId - The application ID.
 * @param {function} showNotification - The page-specific notification function.
 * @param {object} callbacks - Object containing onLogin and onLogout functions.
 * @param {function} callbacks.onLogin - Called with (user, db, firestoreModule) when a user is logged in.
 * @param {function} callbacks.onLogout - Called when a user is logged out or anonymous.
 * @returns {Promise<object>} A promise that resolves with { db, auth, firestoreModule, firebaseAuthModule, getCurrentUser, showNotification }
 */
export async function initAuth(pageDOMElements, appId, showNotification, callbacks = {}) {
    
    // Store page-specific functions and elements
    DOMElements = pageDOMElements;
    globalShowNotification = showNotification;
    globalAppId = appId;
    
    const { onLogin, onLogout } = callbacks;

    try {
        if (firebaseConfig.apiKey && firebaseConfig.projectId) {
            
            app = getApps().length ? getApp() : initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);
            firebaseEnabled = true;

            // Store module references
            Object.assign(firestoreModule, {
                getFirestore, doc, getDoc, getDocs,
                setDoc, onSnapshot, collection, query, orderBy, serverTimestamp, updateDoc, enableIndexedDbPersistence
            });
            Object.assign(firebaseAuthModule, {
                getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
                sendPasswordResetEmail, signOut, signInWithCustomToken, EmailAuthProvider, 
                linkWithCredential, GoogleAuthProvider, linkWithPopup
            });

            // --- Persistence ---
            try {
                await firestoreModule.enableIndexedDbPersistence(db);
                console.log("Auth Module: Firestore offline persistence enabled.");
            } catch (err) { console.warn("Auth Module: Persistence error:", err.code); }

             // --- Auth State Change Listener ---
            firebaseAuthModule.onAuthStateChanged(auth, async (user) => {
                console.log("Auth Module: Auth state changed. User:", user ? user.uid : 'null');

                if (user?.uid !== currentUser?.uid || !authHasChecked) {
                    currentUser = user;
                    const userId = user?.uid;

                    if (user && !user.isAnonymous) {
                        await fetchUserProfile(userId);
                        if (onLogin) {
                            onLogin(user, db, firestoreModule, authHasChecked);
                        }
                    } else {
                        currentUserProfile = null;
                        if (onLogout) {
                            onLogout(authHasChecked);
                        }
                    }
                    
                    updateUIForAuthStateChange(user);

                    if (!authReady) {
                        authReady = true;
                        console.log("Auth Module: Auth Ready.");
                    }
                    authHasChecked = true;
                }
            });
            console.log("Auth Module: Firebase initialized. Waiting for auth state...");

        } else { throw new Error("Missing Firebase config"); }
    } catch (error) {
        console.error("Auth Module: Firebase init failed:", error);
        globalShowNotification("Core services failed to load.", true);
        authReady = true;
        authHasChecked = true;
        firebaseEnabled = false;
        updateUIForAuthStateChange(null);
        if (onLogout) onLogout(authHasChecked); // Trigger logout flow on failure
    }
    
    // --- Initialize All Shared Event Listeners ---
    initSharedEventListeners();

    return { 
        db, 
        auth, 
        firestoreModule, 
        firebaseAuthModule, 
        getCurrentUser: () => currentUser,
        showNotification: globalShowNotification 
    };
}


// --- ### SHARED UTILITY FUNCTIONS ### ---

function openModal(modal) {
    if (modal) { 
        modal.classList.remove('hidden'); 
        modal.classList.add('active'); 
        setTimeout(() => { 
            const content = modal.querySelector('.modal-content'); 
            if (content) content.style.transform = 'translateY(0)'; 
        }, 10); 
    } 
}

function closeModal(modal) {
    if (modal) { 
        const content = modal.querySelector('.modal-content'); 
        if (content) content.style.transform = 'translateY(-20px)'; 
        modal.classList.remove('active'); 
        setTimeout(() => modal.classList.add('hidden'), 300); 
    } 
}

function openAuthModal(mode = 'login') {
    if (currentUser && !currentUser.isAnonymous) { 
        globalShowNotification("Already logged in.", false); 
        return; 
    }
    const { modal, loginForm, signupForm, error, forgotPasswordView } = DOMElements.authModal;
    if (!modal || !loginForm || !signupForm || !error || !forgotPasswordView) return;
    error.classList.add('hidden');
    loginForm.reset();
    signupForm.reset();
    forgotPasswordView.classList.add('hidden');
    document.getElementById('login-view')?.classList.toggle('hidden', mode !== 'login');
    document.getElementById('signup-view')?.classList.toggle('hidden', mode !== 'signup');
    openModal(modal);
}

function updateUIForAuthStateChange(user) {
    const isLoggedIn = !!user;
    const isAnon = user?.isAnonymous ?? false;
    const isVisibleUser = isLoggedIn && !isAnon;

    DOMElements.authLinks?.classList.toggle('hidden', isVisibleUser);
    DOMElements.userMenu?.classList.toggle('hidden', !isVisibleUser);
    DOMElements.mobileAuthLinks?.classList.toggle('hidden', isVisibleUser);
    DOMElements.mobileUserActions?.classList.toggle('hidden', !isVisibleUser);
    
    // This element is index.html specific, so check if it exists
    DOMElements.dashboardSection?.classList.toggle('hidden', !isVisibleUser);

    if (isVisibleUser) {
        let displayName = 'User'; 
        let avatarIconClass = 'fas fa-user text-xl';
        if (currentUserProfile?.firstName) { 
            displayName = currentUserProfile.firstName; 
        } else if (user.email) { 
            const emailName = user.email.split('@')[0]; 
            displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1); 
        }
        
        const loginBtn = document.getElementById('login-btn'); 
        if(loginBtn) loginBtn.innerHTML = `<i class="fas fa-right-to-bracket mr-2"></i>Log In`;
        const mobileLoginBtn = document.getElementById('mobile-login-btn'); 
        if(mobileLoginBtn) mobileLoginBtn.innerHTML = `<i class="fas fa-right-to-bracket mr-2"></i>Log In`;
        
        document.getElementById('my-account-btn')?.classList.remove('hidden'); 
        document.getElementById('mobile-my-account-btn')?.classList.remove('hidden');
        
        if(DOMElements.userGreeting) DOMElements.userGreeting.textContent = `Hi, ${displayName}`;
        if(DOMElements.userAvatar) DOMElements.userAvatar.innerHTML = `<i class="${avatarIconClass}"></i>`;
    } else {
        if(DOMElements.userGreeting) DOMElements.userGreeting.textContent = '';
        const loginBtn = document.getElementById('login-btn'); 
        if(loginBtn) loginBtn.innerHTML = `<i class="fas fa-right-to-bracket mr-2"></i>Log In`;
        const mobileLoginBtn = document.getElementById('mobile-login-btn'); 
        if(mobileLoginBtn) mobileLoginBtn.innerHTML = `<i class="fas fa-right-to-bracket mr-2"></i>Log In`;
    }
}

async function fetchUserProfile(userId) {
    if (!firebaseEnabled || !firestoreModule || !userId || auth.currentUser?.isAnonymous) { 
        currentUserProfile = null; 
        return; 
    }
    try {
        const { doc, getDoc } = firestoreModule;
        const userDocRef = doc(db, 'artifacts', globalAppId, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            currentUserProfile = userDoc.data().profile;
            let displayName = currentUserProfile?.firstName || (currentUser?.email ? currentUser.email.split('@')[0].charAt(0).toUpperCase() + currentUser.email.split('@')[0].slice(1) : 'User');
            if (DOMElements.userGreeting) DOMElements.userGreeting.textContent = `Hi, ${displayName}`;
        } else {
            console.warn("Auth Module: User doc not found:", userId); 
            currentUserProfile = null;
            if (DOMElements.userGreeting) DOMElements.userGreeting.textContent = `Hi, ${currentUser?.email ? currentUser.email.split('@')[0].charAt(0).toUpperCase() + currentUser.email.split('@')[0].slice(1) : 'User'}`;
        }
    } catch (error) { 
        console.error("Auth Module: Error fetching profile:", error); 
        currentUserProfile = null; 
    }
}

// --- ### SHARED EVENT LISTENERS ### ---

function initSharedEventListeners() {

    // --- Form Submit Listeners (Auth/Account) ---
    DOMElements.authModal.loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        if (!firebaseEnabled || !firebaseAuthModule || !auth) return;
        const email = e.target.elements['login-email'].value, password = e.target.elements['login-password'].value;
        const errorEl = DOMElements.authModal.error; 
        if(errorEl) errorEl.classList.add('hidden');
        try {
            await firebaseAuthModule.signInWithEmailAndPassword(auth, email, password);
            closeModal(DOMElements.authModal.modal); 
            globalShowNotification("Logged in!");
        } catch(error){ 
             console.error("Login error:", error.code); 
             if(errorEl){
                 let msg = "Login failed. Invalid credentials or network error.";
                 if (error.code.includes('auth/invalid-credential')) msg = "Invalid email or password.";
                 else if (error.code.includes('auth/user-not-found')) msg = "No user found with this email.";
                 errorEl.textContent = msg; 
                 errorEl.classList.remove('hidden');
             } 
        }
    });
    
    DOMElements.authModal.signupForm?.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        if (!firebaseEnabled || !firebaseAuthModule || !firestoreModule || !auth) return;
        const firstName = e.target.elements['signup-first-name'].value, lastName = e.target.elements['signup-last-name'].value, email = e.target.elements['signup-email'].value, password = e.target.elements['signup-password'].value;
        const errorEl = DOMElements.authModal.error; 
        if(errorEl) errorEl.classList.add('hidden');
        try {
            const userCred = await firebaseAuthModule.createUserWithEmailAndPassword(auth, email, password); 
            const user = userCred.user;
            const { doc, setDoc, serverTimestamp } = firestoreModule; 
            const userDocRef = doc(db, 'artifacts', globalAppId, 'users', user.uid);
            await setDoc(userDocRef, { 
                profile: { 
                    firstName, 
                    lastName, 
                    email, 
                    createdAt: serverTimestamp(), 
                    optionalSubject: null 
                } 
            }, { merge: true });
            closeModal(DOMElements.authModal.modal); 
            if (DOMElements.successOverlay) { 
                DOMElements.successOverlay.classList.remove('hidden'); 
                setTimeout(() => DOMElements.successOverlay.classList.add('hidden'), 2500); 
            }
        } catch(error){ 
            console.error("Signup error:", error.code); 
            if(errorEl){
                let msg = "Signup failed.";
                if (error.code === 'auth/email-already-in-use') msg = "Email already registered. Please log in.";
                else if (error.code === 'auth/weak-password') msg = "Password too weak. Min 6 characters.";
                errorEl.textContent = msg;
                errorEl.classList.remove('hidden');
            }
        }
    });
    
    DOMElements.accountModal.form?.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        const userId = currentUser?.uid; 
        if (!userId || currentUser?.isAnonymous) { 
            globalShowNotification("You must be logged in to update account.", true); 
            return; 
        } 
        if (!firebaseEnabled || !firestoreModule) return;
        const firstName = e.target.elements['account-first-name'].value, lastName = e.target.elements['account-last-name'].value;
        const errorEl = DOMElements.accountModal.error; 
        if(errorEl) errorEl.classList.add('hidden');
        const { doc, updateDoc } = firestoreModule; 
        const userDocRef = doc(db, 'artifacts', globalAppId, 'users', userId);
        try {
            await updateDoc(userDocRef, { 'profile.firstName': firstName, 'profile.lastName': lastName }); 
            globalShowNotification('Account updated!');
            if (currentUserProfile) { 
                currentUserProfile.firstName = firstName; 
                currentUserProfile.lastName = lastName; 
            } else { 
                currentUserProfile = { firstName, lastName, email: currentUser.email }; 
            }
            if (DOMElements.userGreeting) DOMElements.userGreeting.textContent = `Hi, ${firstName}`; 
            closeModal(DOMElements.accountModal.modal);
        } catch(error){ 
             console.error("Account update error:", error.code); 
             if(errorEl){
                 errorEl.textContent="Update failed."; 
                 errorEl.classList.remove('hidden');
            } 
        }
    });
    
    DOMElements.authModal.forgotPasswordForm?.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        if (!firebaseEnabled || !firebaseAuthModule || !auth) return;
        const email = e.target.elements['reset-email'].value; 
        const errorEl = DOMElements.authModal.error; 
        if(errorEl) errorEl.classList.add('hidden');
        try { 
            await firebaseAuthModule.sendPasswordResetEmail(auth, email); 
            globalShowNotification('Password reset email sent.'); 
            openAuthModal('login'); 
        }
        catch(error){ 
            console.error("PW Reset error:", error.code); 
            if(errorEl){
                errorEl.textContent="Reset failed."; 
                errorEl.classList.remove('hidden');
            } 
        }
    });

    // --- General Click Listeners for Auth/Modals ---
    // Note: We use document.body.addEventListener in app.js and syllabus-tracker.js
    // to handle page-specific clicks. We only add listeners here for *shared* elements
    // that were passed in DOMElements.
    
    DOMElements.mobileMenuButton?.addEventListener('click', () => {
        DOMElements.mobileMenu?.classList.toggle('hidden');
    });

    DOMElements.userMenu?.addEventListener('click', (e) => {
        if (e.target.closest('#user-menu-button')) {
            DOMElements.userDropdown?.classList.toggle('hidden');
        }
    });
    
    // Close dropdown if clicking outside
    document.body.addEventListener('click', (e) => {
        if (!e.target.closest('#user-menu')) { 
            DOMElements.userDropdown?.classList.add('hidden'); 
        }
    });

    // --- Shared Button Clicks (Login, Logout, My Account) ---
    // We attach these to document.body and check IDs to ensure they are captured
    // even if the buttons are inside the mobile menu.
    
    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        const targetId = target.id;

        // Login
        if (['login-btn', 'mobile-login-btn'].includes(targetId) || target.closest('#login-btn, #mobile-login-btn')) { 
            e.preventDefault(); 
            openAuthModal('login'); 
        }
        
        // Logout
        if (target.closest('#dropdown-logout-btn, #mobile-logout-btn')) { 
             if (firebaseEnabled && firebaseAuthModule && auth) {
                 try { 
                     await firebaseAuthModule.signOut(auth); 
                     globalShowNotification('Logged out.'); 
                 }
                 catch (error) { 
                     globalShowNotification('Logout failed.', true); 
                     console.error("Logout error:", error); 
                 }
             } else { 
                 globalShowNotification('Cannot log out: Service unavailable.', true); 
             }
        }
        
        // My Account
        if (target.closest('#my-account-btn, #mobile-my-account-btn')) {
            e.preventDefault();
            if (!authReady) { 
                globalShowNotification("Connecting...", false); 
                return; 
            }
            if (!currentUser || currentUser.isAnonymous) { 
                globalShowNotification("Please log in/sign up.", false); 
                openAuthModal('login'); 
                return; 
            }
            const { form, error } = DOMElements.accountModal;
            if (!form || !error) return;
            error.classList.add('hidden');
            form.elements['account-first-name'].value = currentUserProfile?.firstName || '';
            form.elements['account-last-name'].value = currentUserProfile?.lastName || '';
            form.elements['account-email'].value = currentUser.email || 'N/A';
            openModal(DOMElements.accountModal.modal);
        }

        // Auth Modal Controls
        if (targetId === 'close-auth-modal') closeModal(DOMElements.authModal.modal);
        if (targetId === 'auth-switch-to-signup') openAuthModal('signup');
        if (targetId === 'auth-switch-to-login' || targetId === 'auth-switch-to-login-from-reset') openAuthModal('login');
        if (targetId === 'forgot-password-btn') { 
            document.getElementById('login-view')?.classList.add('hidden'); 
            DOMElements.authModal.forgotPasswordView?.classList.remove('hidden'); 
        }
        
        // Account Modal Close
        if (targetId === 'close-account-modal') closeModal(DOMElements.accountModal.modal);
    });
}
