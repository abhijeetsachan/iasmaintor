// js/auth.js
// Robust Authentication Module with Email Verification & UI Gates

import { firebaseConfig } from './firebase-config.js';

// --- Firebase SDK Imports ---
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail, 
    signOut,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
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
let authHasChecked = false;
let firebaseEnabled = false;
let DOMElements = {};
let globalShowNotification = (message, isError) => console.log(`Notification: ${message}`);
let globalAppId = 'default-app-id';

/**
 * Initialize Auth Module
 */
export async function initAuth(pageDOMElements, appId, showNotification, callbacks = {}) {
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

            // Map modules for internal use
            Object.assign(firestoreModule, { getFirestore, doc, getDoc, setDoc, serverTimestamp, updateDoc, enableIndexedDbPersistence });
            Object.assign(firebaseAuthModule, { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, sendEmailVerification });

            // Enable Offline Persistence
            try { await firestoreModule.enableIndexedDbPersistence(db); } catch (err) { /* Ignore persistence errors */ }

            // --- GLOBAL AUTH LISTENER ---
            firebaseAuthModule.onAuthStateChanged(auth, async (user) => {
                // SECURITY GATE: Treat unverified users as logged out
                let verifiedUser = user;
                
                if (user && !user.isAnonymous && !user.emailVerified) {
                    console.log("Auth: User is unverified. Treating as guest.");
                    verifiedUser = null; 
                }

                // Detect State Change
                if (user?.uid !== currentUser?.uid || !authHasChecked) {
                    currentUser = verifiedUser; // Update internal state
                    const userId = user?.uid;

                    if (verifiedUser && !verifiedUser.isAnonymous) {
                        // 1. Fetch Profile for "Greeting Screen"
                        await fetchUserProfile(userId);
                        if (onLogin) onLogin(verifiedUser, db, firestoreModule, authHasChecked);
                    } else {
                        // 2. Clear Profile
                        currentUserProfile = null;
                        if (onLogout) onLogout(authHasChecked);
                    }
                    
                    // 3. Update UI (Header, Buttons, Greetings)
                    updateUIForAuthStateChange(verifiedUser);

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
        // Small delay to allow display:block to apply before opacity transition
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
    if(forgotPasswordView) forgotPasswordView.classList.add('hidden');
    
    document.getElementById('login-view')?.classList.toggle('hidden', mode !== 'login');
    document.getElementById('signup-view')?.classList.toggle('hidden', mode !== 'signup');
    openModal(modal);
}

// --- GREETINGS SCREEN & HEADER LOGIC ---
function updateUIForAuthStateChange(user) {
    const isLoggedIn = !!user;
    const isAnon = user?.isAnonymous ?? false;
    const isVisibleUser = isLoggedIn && !isAnon;

    // Toggle Header Elements
    DOMElements.authLinks?.classList.toggle('hidden', isVisibleUser);
    DOMElements.userMenu?.classList.toggle('hidden', !isVisibleUser);
    
    // Toggle Mobile Elements
    DOMElements.mobileAuthLinks?.classList.toggle('hidden', isVisibleUser);
    DOMElements.mobileUserActions?.classList.toggle('hidden', !isVisibleUser);
    
    // Toggle Main Dashboard (if on index page)
    DOMElements.dashboardSection?.classList.toggle('hidden', !isVisibleUser);

    if (isVisibleUser) {
        // GREETING LOGIC
        let displayName = currentUserProfile?.firstName || (user.email ? user.email.split('@')[0] : 'User');
        displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
        
        if (DOMElements.userGreeting) DOMElements.userGreeting.textContent = `Hi, ${displayName}`;
    } else {
        if (DOMElements.userGreeting) DOMElements.userGreeting.textContent = '';
    }
}

async function fetchUserProfile(userId) {
    try {
        const userDocRef = doc(db, 'artifacts', globalAppId, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            currentUserProfile = userDoc.data().profile;
            // Re-run UI update to show actual name instead of email
            updateUIForAuthStateChange(auth.currentUser);
        }
    } catch (error) { console.error("Profile fetch error:", error); }
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
        
        try {
            const userCred = await firebaseAuthModule.signInWithEmailAndPassword(auth, email, password);
            
            // --- VERIFICATION CHECK ---
            if (!userCred.user.emailVerified) {
                await firebaseAuthModule.signOut(auth); // Log them out
                if(errorEl) {
                    errorEl.innerHTML = `
                        <strong>Email not verified.</strong><br>
                        Please check your inbox (and spam folder) for the verification link.
                    `;
                    errorEl.classList.remove('hidden');
                }
                return;
            }

            closeModal(DOMElements.authModal.modal); 
            globalShowNotification("Welcome back! Logged in successfully.");
        } catch(error){ 
             console.error("Login error:", error.code); 
             if(errorEl){
                 let msg = "Login failed.";
                 if (error.code.includes('user-not-found') || error.code.includes('wrong-password') || error.code.includes('invalid-credential')) msg = "Invalid email or password.";
                 else if (error.code.includes('too-many-requests')) msg = "Too many attempts. Try again later.";
                 errorEl.textContent = msg; 
                 errorEl.classList.remove('hidden');
             } 
        }
    });
    
    // 2. SIGNUP LISTENER (ROBUST VERSION)
    DOMElements.authModal.signupForm?.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        const firstName = e.target.elements['signup-first-name'].value;
        const lastName = e.target.elements['signup-last-name'].value;
        const email = e.target.elements['signup-email'].value;
        const password = e.target.elements['signup-password'].value;
        const errorEl = DOMElements.authModal.error; 
        if(errorEl) errorEl.classList.add('hidden');
        
        // Show loading state (optional UI enhancement)
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.innerText : 'Sign Up';
        if(submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Creating Account...'; }

        try {
            // A. Create User in Authentication
            const userCred = await firebaseAuthModule.createUserWithEmailAndPassword(auth, email, password); 
            const user = userCred.user;
            
            // B. Send Verification Email IMMEDIATELY
            await firebaseAuthModule.sendEmailVerification(user);

            // C. Sign Out IMMEDIATELY (to enforce the "must verify" rule)
            await firebaseAuthModule.signOut(auth);

            // D. Close the Auth Modal
            closeModal(DOMElements.authModal.modal); 
            
            // E. Show the "Verification Screen" (Success Overlay)
            if (DOMElements.successOverlay) {
                // Customize the overlay text for verification
                const title = DOMElements.successOverlay.querySelector('h3');
                const desc = DOMElements.successOverlay.querySelector('p');
                if(title) title.textContent = "Verification Link Sent!";
                if(desc) desc.innerHTML = `We sent an email to <strong>${email}</strong>.<br>Please click the link in it to verify your account.`;
                
                DOMElements.successOverlay.classList.remove('hidden'); 
                
                // Hide it after 6 seconds
                setTimeout(() => {
                    DOMElements.successOverlay.classList.add('hidden');
                }, 6000);
            } else {
                // Fallback if overlay is missing
                globalShowNotification("Verification email sent! Please check your inbox.", false);
            }

            // F. Create Database Profile (Background Task)
            // We do this LAST so if it fails, the user still sees the success screen
            try {
                const { doc, setDoc, serverTimestamp } = firestoreModule; 
                const userDocRef = doc(db, 'artifacts', globalAppId, 'users', user.uid);
                await setDoc(userDocRef, { 
                    profile: { firstName, lastName, email, createdAt: serverTimestamp(), optionalSubject: null } 
                }, { merge: true });
                console.log("Profile created successfully.");
            } catch (dbErr) {
                // Silent fail or log for admin - do not disturb user flow
                console.error("Profile creation failed (User still created):", dbErr);
            }

        } catch(error){ 
            console.error("Signup error:", error); 
            if(errorEl){
                let msg = "Signup failed.";
                if (error.code === 'auth/email-already-in-use') msg = "That email is already registered. Please log in.";
                else if (error.code === 'auth/weak-password') msg = "Password is too weak.";
                errorEl.textContent = msg;
                errorEl.classList.remove('hidden');
            }
        } finally {
            // Restore button state
            if(submitBtn) { submitBtn.disabled = false; submitBtn.innerText = originalBtnText; }
        }
    });

    // 3. OTHER LISTENERS (Unchanged)
    
    // Account Update
    DOMElements.accountModal.form?.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        if (!currentUser || currentUser.isAnonymous) return;
        const firstName = e.target.elements['account-first-name'].value;
        const lastName = e.target.elements['account-last-name'].value;
        try {
            const { doc, updateDoc } = firestoreModule; 
            const userDocRef = doc(db, 'artifacts', globalAppId, 'users', currentUser.uid);
            await updateDoc(userDocRef, { 'profile.firstName': firstName, 'profile.lastName': lastName }); 
            globalShowNotification('Account updated!');
            if (currentUserProfile) { currentUserProfile.firstName = firstName; currentUserProfile.lastName = lastName; }
            updateUIForAuthStateChange(currentUser);
            closeModal(DOMElements.accountModal.modal);
        } catch(error){ console.error(error); }
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

    // Menu & Dropdown Toggles
    DOMElements.mobileMenuButton?.addEventListener('click', () => DOMElements.mobileMenu?.classList.toggle('hidden'));
    DOMElements.userMenu?.addEventListener('click', (e) => { if (e.target.closest('#user-menu-button')) DOMElements.userDropdown?.classList.toggle('hidden'); });
    document.body.addEventListener('click', (e) => { if (!e.target.closest('#user-menu')) DOMElements.userDropdown?.classList.add('hidden'); });

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
        if (target.closest('#my-account-btn, #mobile-my-account-btn')) {
            e.preventDefault();
            if (!authReady || !currentUser || currentUser.isAnonymous) { openAuthModal('login'); return; }
            const { form } = DOMElements.accountModal;
            form.elements['account-first-name'].value = currentUserProfile?.firstName || '';
            form.elements['account-last-name'].value = currentUserProfile?.lastName || '';
            form.elements['account-email'].value = currentUser.email || '';
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
