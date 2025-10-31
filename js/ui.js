// js/ui.js

// --- Imports ---
import { initChatbot } from './chatbot.js';
import {
    initializeAuth,
    onAuthReady,
    getAuth,
    getDb,
    getAppId,
    getCurrentUser,
    getCurrentUserProfile,
    getFirebaseAuthModule,
    getFirestoreModule
} from './auth.js';

// --- Module State ---
let DOMElements = {};
let deferredPrompt = null;
let notify = () => {}; // Placeholder

// --- Core UI Initialization ---

/**
 * Initializes all shared UI components, finds DOM elements, and sets up listeners.
 */
export function initUI() {
    // 1. Find all shared DOM elements
    DOMElements = {
        authLinks: document.getElementById('auth-links'),
        userMenu: document.getElementById('user-menu'),
        userGreeting: document.getElementById('user-greeting'),
        userAvatar: document.getElementById('user-avatar'),
        userDropdown: document.getElementById('user-dropdown'),
        mobileMenuButton: document.getElementById('mobile-menu-button'),
        mobileMenu: document.getElementById('mobile-menu'),
        mobileAuthLinks: document.getElementById('mobile-auth-links'),
        mobileUserActions: document.getElementById('mobile-user-actions'),
        header: document.getElementById('header'),
        notification: document.getElementById('notification'),
        successOverlay: document.getElementById('success-overlay'),
        authModal: {
            modal: document.getElementById('auth-modal'),
            error: document.getElementById('auth-error'),
            loginForm: document.getElementById('login-form'),
            signupForm: document.getElementById('signup-form'),
            forgotPasswordView: document.getElementById('forgot-password-view'),
            forgotPasswordForm: document.getElementById('forgot-password-form')
        },
        accountModal: {
            modal: document.getElementById('account-modal'),
            form: document.getElementById('account-form'),
            error: document.getElementById('account-error')
        },
        copyrightYear: document.getElementById('copyright-year'),
        installPwaBtnDesktop: document.getElementById('install-pwa-btn-desktop'),
        installPwaBtnMobile: document.getElementById('install-pwa-btn-mobile'),
    };

    // Assign utility function
    notify = showNotification;

    // 2. Set up event listeners
    setupClickListeners();
    setupFormSubmissions();

    // 3. Initialize non-event UI
    if (DOMElements.copyrightYear) {
        DOMElements.copyrightYear.textContent = new Date().getFullYear();
    }

    // 4. Initialize Chatbot
    initChatbot(notify);

    // 5. Set up PWA listeners
    setupPwaListeners();

    // 6. Listen for auth changes to update UI
    onAuthReady(user => {
        updateUIForAuthStateChange(user, getCurrentUserProfile());
    });

    console.log("Shared UI Initialized.");
}

// --- Utility Functions ---

/**
 * Shows a notification message.
 * @param {string} message - The text to display.
 * @param {boolean} [isError=false] - Whether to style as an error.
 */
export function showNotification(message, isError = false) {
    const el = DOMElements.notification;
    if (!el) { console.warn("Notification element not found."); return; }
    el.textContent = message;
    el.className = `fixed bottom-5 right-5 px-6 py-3 rounded-lg shadow-lg transition-opacity duration-300 pointer-events-none z-[60] text-white ${isError ? 'bg-red-600' : 'bg-slate-800'} opacity-100`;
    setTimeout(() => { if (el) el.classList.remove('opacity-100'); }, 3000);
}

/**
 * Opens a modal with animation.
 * @param {HTMLElement} modal - The modal element to open.
 */
export function openModal(modal) {
    if (modal instanceof HTMLElement) {
        modal.classList.remove('hidden');
        modal.classList.add('active');
        const content = modal.querySelector('.modal-content');
        if (content) {
            requestAnimationFrame(() => {
                content.style.transform = 'translateY(0)';
                content.style.opacity = '1';
            });
        }
    } else {
        console.error("Invalid element passed to openModal:", modal);
    }
}

/**
 * Closes a modal with animation.
 * @param {HTMLElement} modal - The modal element to close.
 */
export function closeModal(modal) {
    if (modal instanceof HTMLElement) {
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.style.transform = 'translateY(-20px)';
            content.style.opacity = '0';
        }
        modal.classList.remove('active');
        setTimeout(() => modal.classList.add('hidden'), 300);
    } else {
        console.error("Invalid element passed to closeModal:", modal);
    }
}

/**
 * Opens the authentication modal in a specific mode.
 * @param {'login' | 'signup' | 'forgot'} [mode='login'] - The view to show.
 */
export function openAuthModal(mode = 'login') {
    const user = getCurrentUser();
    if (user && !user.isAnonymous) {
        notify("You are already logged in.", false);
        return;
    }

    const { modal, loginForm, signupForm, error, forgotPasswordView, forgotPasswordForm } = DOMElements.authModal;
    if (!modal || !loginForm || !signupForm || !error || !forgotPasswordView) {
        console.error("Auth modal elements not found");
        return;
    }

    error.classList.add('hidden');
    loginForm.reset();
    signupForm.reset();
    forgotPasswordForm?.reset();

    const loginView = document.getElementById('login-view');
    const signupView = document.getElementById('signup-view');

    if (loginView) loginView.classList.toggle('hidden', mode !== 'login');
    if (signupView) signupView.classList.toggle('hidden', mode !== 'signup');
    if (forgotPasswordView) forgotPasswordView.classList.toggle('hidden', mode !== 'forgot');

    openModal(modal);
}

/**
 * Updates the header and mobile menu based on auth state.
 * @param {object|null} user - The Firebase user object.
 * @param {object|null} userProfile - The user's profile data.
 */
export function updateUIForAuthStateChange(user, userProfile) {
    const isLoggedIn = !!user;
    const isAnon = user?.isAnonymous ?? false;
    const isVisibleUser = isLoggedIn && !isAnon;

    DOMElements.authLinks?.classList.toggle('hidden', isVisibleUser);
    DOMElements.userMenu?.classList.toggle('hidden', !isVisibleUser);
    DOMElements.mobileAuthLinks?.classList.toggle('hidden', isVisibleUser);
    DOMElements.mobileUserActions?.classList.toggle('hidden', !isVisibleUser);

    if (isVisibleUser) {
        let displayName = 'User';
        if (userProfile?.firstName) {
            displayName = userProfile.firstName;
        } else if (user.email) {
            const emailName = user.email.split('@')[0];
            displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
        }

        if (DOMElements.userGreeting) DOMElements.userGreeting.textContent = `Hi, ${displayName}`;
        if (DOMElements.userAvatar) DOMElements.userAvatar.innerHTML = `<i class="fas fa-user text-xl"></i>`;
    } else {
        if (DOMElements.userGreeting) DOMElements.userGreeting.textContent = '';
        if (DOMElements.userAvatar) DOMElements.userAvatar.innerHTML = `<i class="fas fa-user text-xl"></i>`;
    }

    // Close mobile menu on auth change
    DOMElements.mobileMenu?.classList.add('hidden');
}

// --- Event Listener Setup ---

/**
 * Sets up all shared click event listeners.
 */
function setupClickListeners() {
    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        const targetId = target.id;

        // --- PWA Install ---
        if (target.closest('.install-pwa-btn')) {
            e.preventDefault();
            handleInstallClick();
            return;
        }

        // --- Auth Modals & Header ---
        if (!target.closest('#user-menu')) {
            DOMElements.userDropdown?.classList.add('hidden');
        }
        if (target.closest('#user-menu-button')) {
            DOMElements.userDropdown?.classList.toggle('hidden');
        }
        if (target.closest('#mobile-menu-button')) {
            DOMElements.mobileMenu?.classList.toggle('hidden');
        }

        if (['login-btn', 'mobile-login-btn'].includes(targetId) || target.closest('#login-btn, #mobile-login-btn')) {
            e.preventDefault();
            openAuthModal('login');
        }
        if (targetId === 'close-auth-modal') closeModal(DOMElements.authModal.modal);
        if (targetId === 'auth-switch-to-signup') openAuthModal('signup');
        if (targetId === 'auth-switch-to-login' || targetId === 'auth-switch-to-login-from-reset') openAuthModal('login');
        if (targetId === 'forgot-password-btn') openAuthModal('forgot');

        // --- Account Modal ---
        if (targetId === 'close-account-modal') closeModal(DOMElements.accountModal.modal);

        if (target.closest('#my-account-btn') || target.closest('#mobile-my-account-btn')) {
            e.preventDefault();
            const user = getCurrentUser();
            if (!user || user.isAnonymous) {
                notify("Please log in/sign up.", false);
                openAuthModal('login');
                return;
            }
            const userProfile = getCurrentUserProfile();
            const { form, error } = DOMElements.accountModal;
            if (form && error) {
                error.classList.add('hidden');
                form.elements['account-first-name'].value = userProfile?.firstName || '';
                form.elements['account-last-name'].value = userProfile?.lastName || '';
                form.elements['account-email'].value = user.email || 'N/A';
                openModal(DOMElements.accountModal.modal);
            }
        }

        // --- Logout ---
        if (target.closest('#dropdown-logout-btn') || target.closest('#mobile-logout-btn')) {
            const auth = getAuth();
            const authModule = getFirebaseAuthModule();
            if (auth && authModule) {
                try {
                    await authModule.signOut(auth);
                    notify('Logged out.');
                } catch (error) {
                    notify('Logout failed.', true);
                    console.error("Logout error:", error);
                }
            } else {
                notify('Cannot log out: Service unavailable.', true);
            }
        }
    });
}

/**
 * Sets up all shared form submission listeners.
 */
function setupFormSubmissions() {
    DOMElements.authModal.loginForm?.addEventListener('submit', handleLogin);
    DOMElements.authModal.signupForm?.addEventListener('submit', handleSignup);
    DOMElements.authModal.forgotPasswordForm?.addEventListener('submit', handlePasswordReset);
    DOMElements.accountModal.form?.addEventListener('submit', handleAccountUpdate);
}

// --- Form Handlers ---

async function handleLogin(e) {
    e.preventDefault();
    const auth = getAuth();
    const authModule = getFirebaseAuthModule();
    if (!auth || !authModule) return notify("Auth service not ready.", true);

    const email = e.target.elements['login-email'].value;
    const password = e.target.elements['login-password'].value;
    const errorEl = DOMElements.authModal.error;
    if (errorEl) errorEl.classList.add('hidden');

    try {
        await authModule.signInWithEmailAndPassword(auth, email, password);
        closeModal(DOMElements.authModal.modal);
        notify("Logged in!");
        // onAuthStateChanged will handle the UI update
    } catch (error) {
        console.error("Login error:", error.code);
        if (errorEl) {
            let msg = "Login failed. Invalid credentials or network error.";
            if (error.code.includes('auth/invalid-credential') || error.code.includes('auth/wrong-password')) msg = "Invalid email or password.";
            else if (error.code.includes('auth/user-not-found')) msg = "No user found with this email.";
            errorEl.textContent = msg;
            errorEl.classList.remove('hidden');
        }
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const auth = getAuth();
    const db = getDb();
    const appId = getAppId();
    const authModule = getFirebaseAuthModule();
    const firestoreModule = getFirestoreModule();
    if (!auth || !db || !appId || !authModule || !firestoreModule) return notify("Auth service not ready.", true);

    const firstName = e.target.elements['signup-first-name'].value;
    const lastName = e.target.elements['signup-last-name'].value;
    const email = e.target.elements['signup-email'].value;
    const password = e.target.elements['signup-password'].value;
    const errorEl = DOMElements.authModal.error;
    if (errorEl) errorEl.classList.add('hidden');

    try {
        const userCred = await authModule.createUserWithEmailAndPassword(auth, email, password);
        const user = userCred.user;

        const { doc, setDoc, serverTimestamp } = firestoreModule;
        const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid);
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
        // onAuthStateChanged will handle the rest
    } catch (error) {
        console.error("Signup error:", error.code);
        if (errorEl) {
            let msg = "Signup failed.";
            if (error.code === 'auth/email-already-in-use') msg = "Email already registered. Please log in.";
            else if (error.code === 'auth/weak-password') msg = "Password too weak. Min 6 characters.";
            errorEl.textContent = msg;
            errorEl.classList.remove('hidden');
        }
    }
}

async function handlePasswordReset(e) {
    e.preventDefault();
    const auth = getAuth();
    const authModule = getFirebaseAuthModule();
    if (!auth || !authModule) return notify("Auth service not ready.", true);

    const email = e.target.elements['reset-email'].value;
    const errorEl = DOMElements.authModal.error;
    if (errorEl) errorEl.classList.add('hidden');

    try {
        await authModule.sendPasswordResetEmail(auth, email);
        notify('Password reset email sent.');
        openAuthModal('login');
    } catch (error) {
        console.error("PW Reset error:", error.code);
        if (errorEl) {
            errorEl.textContent = "Reset failed. Check if email is correct.";
            errorEl.classList.remove('hidden');
        }
    }
}

async function handleAccountUpdate(e) {
    e.preventDefault();
    const user = getCurrentUser();
    const db = getDb();
    const appId = getAppId();
    const firestoreModule = getFirestoreModule();
    if (!user || user.isAnonymous) return notify("You must be logged in to update.", true);
    if (!db || !appId || !firestoreModule) return notify("Database service not ready.", true);

    const firstName = e.target.elements['account-first-name'].value;
    const lastName = e.target.elements['account-last-name'].value;
    const errorEl = DOMElements.accountModal.error;
    if (errorEl) errorEl.classList.add('hidden');

    const { doc, updateDoc } = firestoreModule;
    const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid);

    try {
        await updateDoc(userDocRef, {
            'profile.firstName': firstName,
            'profile.lastName': lastName
        });
        notify('Account updated!');
        
        // Manually update local profile object for immediate UI refresh
        const userProfile = getCurrentUserProfile(); // This is a reference
        if (userProfile) {
            userProfile.firstName = firstName;
            userProfile.lastName = lastName;
        }
        
        // Trigger UI update
        updateUIForAuthStateChange(user, userProfile);
        
        closeModal(DOMElements.accountModal.modal);
    } catch (error) {
        console.error("Account update error:", error.code);
        if (errorEl) {
            errorEl.textContent = "Update failed.";
            errorEl.classList.remove('hidden');
        }
    }
}

// --- PWA Handlers ---

function setupPwaListeners() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (DOMElements.installPwaBtnDesktop) DOMElements.installPwaBtnDesktop.classList.remove('hidden');
        if (DOMElements.installPwaBtnMobile) DOMElements.installPwaBtnMobile.classList.remove('hidden');
        console.log('PWA: beforeinstallprompt event fired.');
    });

    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        if (DOMElements.installPwaBtnDesktop) DOMElements.installPwaBtnDesktop.classList.add('hidden');
        if (DOMElements.installPwaBtnMobile) DOMElements.installPwaBtnMobile.classList.add('hidden');
        deferredPrompt = null;
    });
}

async function handleInstallClick() {
    if (!deferredPrompt) {
        console.log('PWA: Install prompt not available.');
        return;
    }

    if (DOMElements.installPwaBtnDesktop) DOMElements.installPwaBtnDesktop.classList.add('hidden');
    if (DOMElements.installPwaBtnMobile) DOMElements.installPwaBtnMobile.classList.add('hidden');

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    deferredPrompt = null;
}
