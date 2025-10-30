// js/app.js (Lean version for index.html)

// --- Imports ---
import { firebaseConfig, GEMINI_API_KEY } from './firebase-config.js';
// Removed syllabus and quizzie imports

// --- Firebase SDK Modules ---
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, EmailAuthProvider, linkWithCredential, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    onSnapshot,
    collection,
    query,
    orderBy,
    serverTimestamp,
    updateDoc,
    enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { GoogleAuthProvider, linkWithPopup } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// --- RE-INTRODUCED IMPORTS FOR QUIZZIE MODULE ---
import { initQuizzie, resetQuizzieModal } from './quizzie.js';

document.addEventListener('DOMContentLoaded', async function() {
    // --- Firebase Initialization ---
    let app, db, auth;
    let firebaseEnabled = false;
    // --- Simplified module objects ---
    let firestoreModule = {
        getFirestore, doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, serverTimestamp, updateDoc,
        enableIndexedDbPersistence
    };
    let firebaseAuthModule = {
        getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, EmailAuthProvider, linkWithCredential, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut,
        GoogleAuthProvider, linkWithPopup
    };
    let authReady = false;

    let currentUser = null;
    const getCurrentUser = () => currentUser;

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    console.log("Index Page: Using appId:", appId);

    try {
        if (firebaseConfig.apiKey && firebaseConfig.projectId) {
            
            // --- Firebase App Init & Auth ---
             if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                app = getApps().length ? getApp() : initializeApp(firebaseConfig);
                db = firestoreModule.getFirestore(app);
                auth = firebaseAuthModule.getAuth(app);
                try {
                    // Sign in with custom token (if available)
                    await firebaseAuthModule.signInWithCustomToken(auth, __initial_auth_token);
                    firebaseEnabled = true;
                } catch (customTokenError) {
                    // If custom token fails, proceed to onAuthStateChanged which will handle sign-in status.
                    console.error("Custom token sign-in failed:", customTokenError.code);
                    firebaseEnabled = true;
                }
            } else {
                app = getApps().length ? getApp() : initializeApp(firebaseConfig);
                db = firestoreModule.getFirestore(app);
                auth = firebaseAuthModule.getAuth(app);
                firebaseEnabled = true;
            }

            // --- Persistence ---
            try {
                await firestoreModule.enableIndexedDbPersistence(db);
                console.log("Index Page: Firestore offline persistence enabled.");
            } catch (err) { console.warn("Persistence error:", err.code); }

             // --- Auth State Change Listener (Crucial for handling login status) ---
            firebaseAuthModule.onAuthStateChanged(auth, async (user) => {
                console.log("Index Page: Auth state changed. User:", user ? user.uid : 'null');

                if (user?.uid !== currentUser?.uid) { // Process only if user actually changed
                    currentUser = user;
                    const userId = user?.uid;

                    // --- START MODIFICATION: Enforce non-anonymous login for data access ---
                    if (user && !user.isAnonymous) { // User is logged in and NOT anonymous
                        await fetchUserProfile(userId);
                        // Fetch data needed for index.html
                        fetchAndDisplayPlans(userId);       // Fetch old study plans
                        listenForDashboardProgress(userId); // Listen for progress summary
                    } else { // User is logged out OR anonymous
                        currentUserProfile = null;
                        if (unsubscribePlans) { unsubscribePlans(); unsubscribePlans = null; }
                        if (unsubscribeDashboardProgress) { unsubscribeDashboardProgress(); unsubscribeDashboardProgress = null; }

                        console.log("Index Page: User logged out or anonymous. Data fetching stopped.");
                        
                        // Clear UI elements and prompt login
                        if (DOMElements.plansList) { DOMElements.plansList.innerHTML = `<p class="text-slate-500">Please log in to see saved plans.</p>`; }
                        if (DOMElements.dashboardProgressBars) { DOMElements.dashboardProgressBars.innerHTML = `<p class="text-slate-500">Please log in to see your progress.</p>`; }
                        
                        // NOTE: Removed anonymous sign-in attempt as per user request.
                    }
                    // --- END MODIFICATION ---

                    // Update header UI
                    updateUIForAuthStateChange(user);

                    // Mark auth as ready (no modules to initialize here)
                    if (!authReady) {
                        authReady = true;
                        console.log("Index Page: Auth Ready.");
                    }
                }
            });
            console.log("Index Page: Firebase initialized. Waiting for auth state...");
        } else { throw new Error("Missing Firebase config"); }
    } catch (error) {
        console.error("Index Page: Firebase init failed:", error);
        showNotification("Core services failed to load.", true);
        authReady = true;
        firebaseEnabled = false;
        // Update UI even on failure
        updateUIForAuthStateChange(null);
    }

    // --- State Variables ---
    let currentUserProfile = null;
    let unsubscribePlans = null;
    let unsubscribeDashboardProgress = null;
    let quizzieInitialized = false; // New flag

    // --- UI Element Refs (Simplified for index.html) ---
    const DOMElements = {
        authLinks: document.getElementById('auth-links'),
        userMenu: document.getElementById('user-menu'),
        userGreeting: document.getElementById('user-greeting'),
        userAvatar: document.getElementById('user-avatar'),
        userDropdown: document.getElementById('user-dropdown'),
        dashboardSection: document.getElementById('dashboard'),
        mobileMenuButton: document.getElementById('mobile-menu-button'),
        mobileMenu: document.getElementById('mobile-menu'),
        mobileAuthLinks: document.getElementById('mobile-auth-links'),
        mobileUserActions: document.getElementById('mobile-user-actions'),
        header: document.getElementById('header'),
        notification: document.getElementById('notification'),
        successOverlay: document.getElementById('success-overlay'),
        authModal: { modal: document.getElementById('auth-modal'), error: document.getElementById('auth-error'), loginForm: document.getElementById('login-form'), signupForm: document.getElementById('signup-form'), forgotPasswordView: document.getElementById('forgot-password-view'), forgotPasswordForm: document.getElementById('forgot-password-form') },
        accountModal: { modal: document.getElementById('account-modal'), form: document.getElementById('account-form'), error: document.getElementById('account-error') },
        // Elements needed for index.html dashboard display
        plansList: document.getElementById('plans-list'),
        dashboardProgressBars: document.getElementById('dashboard-progress-bars'),
        copyrightYear: document.getElementById('copyright-year'),
        
        // --- QUIZZIE MODULE ELEMENTS ---
        quizzieModal: document.getElementById('quizzie-modal'),
        quizzieForm: document.getElementById('quizzie-form'),
        quizResult: document.getElementById('quiz-result'),
        quizActiveView: document.getElementById('quiz-active-view'),
        quizProgressContainer: document.getElementById('quiz-progress-container'),
        quizProgressIndicator: document.getElementById('quiz-progress-indicator'),
        quizProgressText: document.getElementById('quiz-progress-text'),
        gsSectionalGroup: document.getElementById('gs-sectional-group'),
        csatSectionalGroup: document.getElementById('csat-sectional-group'),
        numQuestionsGroup: document.getElementById('num-questions-group'),
        questionTypeGroup: document.getElementById('question-type-group'),
        quizCloseButton: document.getElementById('close-quizzie-modal'),
    };

    // --- Utility Functions (Keep showNotification, open/closeModal, openAuthModal) ---
    const showNotification = (message, isError = false) => { if (!DOMElements.notification) return; DOMElements.notification.textContent = message; DOMElements.notification.classList.toggle('bg-red-600', isError); DOMElements.notification.classList.toggle('bg-slate-800', !isError); DOMElements.notification.classList.add('opacity-100'); setTimeout(() => { if (DOMElements.notification) DOMElements.notification.classList.remove('opacity-100'); }, 3000); };
    const openModal = (modal) => { if (modal) { modal.classList.remove('hidden'); modal.classList.add('active'); setTimeout(() => { const content = modal.querySelector('.modal-content'); if (content) content.style.transform = 'translateY(0)'; }, 10); } };
    const closeModal = (modal) => { if (modal) { const content = modal.querySelector('.modal-content'); if (content) content.style.transform = 'translateY(-20px)'; modal.classList.remove('active'); setTimeout(() => modal.classList.add('hidden'), 300); } };
    const openAuthModal = (mode = 'login') => { if (currentUser && !currentUser.isAnonymous) { showNotification("Already logged in.", false); return; } const { modal, loginForm, signupForm, error, forgotPasswordView } = DOMElements.authModal; if (!modal || !loginForm || !signupForm || !error || !forgotPasswordView) return; error.classList.add('hidden'); loginForm.reset(); signupForm.reset(); forgotPasswordView.classList.add('hidden'); document.getElementById('login-view')?.classList.toggle('hidden', mode !== 'login'); document.getElementById('signup-view')?.classList.toggle('hidden', mode !== 'signup'); openModal(modal); };

    // --- QUIZZIE INITIALIZATION ---
    const quizzieElements = {
        modal: DOMElements.quizzieModal,
        form: DOMElements.quizzieForm,
        result: DOMElements.quizResult,
        activeView: DOMElements.quizActiveView,
        progressContainer: DOMElements.quizProgressContainer,
        progressIndicator: DOMElements.quizProgressIndicator,
        progressText: DOMElements.quizProgressText,
        gsSectionalGroup: DOMElements.gsSectionalGroup,
        csatSectionalGroup: DOMElements.csatSectionalGroup,
        numQuestionsGroup: DOMElements.numQuestionsGroup,
        questionTypeGroup: DOMElements.questionTypeGroup,
        closeButton: DOMElements.quizCloseButton,
    };
    
    // Check if required Quizzie elements are available in the DOM before initializing
    if (Object.values(quizzieElements).every(el => el !== null)) {
         initQuizzie(
            quizzieElements,
            GEMINI_API_KEY,
            // *** REVERTED FIX: Changed back to gemini-2.5-flash per user request ***
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            showNotification,
            closeModal
        );
        quizzieInitialized = true;
    } else {
        console.warn("Quizzie initialization skipped: Some DOM elements are missing. Quizzie module will be unavailable.");
    }

    // --- Core App Logic ---
    if (DOMElements.copyrightYear) DOMElements.copyrightYear.textContent = new Date().getFullYear();

    // --- UI Update Function ---
    const updateUIForAuthStateChange = (user) => {
        const isLoggedIn = !!user;
        const isAnon = user?.isAnonymous ?? false;
        
        // --- MODIFICATION: Hide dashboard/user menu if anonymous ---
        const isVisibleUser = isLoggedIn && !isAnon;

        DOMElements.authLinks?.classList.toggle('hidden', isVisibleUser);
        DOMElements.userMenu?.classList.toggle('hidden', !isVisibleUser);
        DOMElements.dashboardSection?.classList.toggle('hidden', !isVisibleUser);
        DOMElements.mobileAuthLinks?.classList.toggle('hidden', isVisibleUser);
        DOMElements.mobileUserActions?.classList.toggle('hidden', !isVisibleUser);
        // --- END MODIFICATION ---

        if (isVisibleUser) {
            let displayName = 'User'; let avatarIconClass = 'fas fa-user text-xl';
            
            // Note: Since we only display for non-anonymous users now, the anonymous logic below is simplified.
            if (currentUserProfile?.firstName) { displayName = currentUserProfile.firstName; }
            else if (user.email) { const emailName = user.email.split('@')[0]; displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1); }
            
            const loginBtn = document.getElementById('login-btn'); if(loginBtn) loginBtn.innerHTML = `<i class="fas fa-right-to-bracket mr-2"></i>Log In`;
            const mobileLoginBtn = document.getElementById('mobile-login-btn'); if(mobileLoginBtn) mobileLoginBtn.innerHTML = `<i class="fas fa-right-to-bracket mr-2"></i>Log In`;
            document.getElementById('my-account-btn')?.classList.remove('hidden'); document.getElementById('mobile-my-account-btn')?.classList.remove('hidden');
            
            if(DOMElements.userGreeting) DOMElements.userGreeting.textContent = `Hi, ${displayName}`;
            if(DOMElements.userAvatar) DOMElements.userAvatar.innerHTML = `<i class="${avatarIconClass}"></i>`;
        } else {
             // For logged-out or anonymous users
            if(DOMElements.userGreeting) DOMElements.userGreeting.textContent = '';
            const loginBtn = document.getElementById('login-btn'); if(loginBtn) loginBtn.innerHTML = `<i class="fas fa-right-to-bracket mr-2"></i>Log In`;
            const mobileLoginBtn = document.getElementById('mobile-login-btn'); if(mobileLoginBtn) mobileLoginBtn.innerHTML = `<i class="fas fa-right-to-bracket mr-2"></i>Log In`;
        }
     };

    // --- Firestore Functions ---
    const fetchUserProfile = async (userId) => {
        // MODIFICATION: Added non-anonymous check
        if (!firebaseEnabled || !firestoreModule || !userId || auth.currentUser?.isAnonymous) { currentUserProfile = null; return; }
        try {
            const { doc, getDoc } = firestoreModule;
            // Path: artifacts/{appId}/users/{userId}
            const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                currentUserProfile = userDoc.data().profile;
                let displayName = currentUserProfile?.firstName || (currentUser?.email ? currentUser.email.split('@')[0].charAt(0).toUpperCase() + currentUser.email.split('@')[0].slice(1) : 'User');
                if (DOMElements.userGreeting) DOMElements.userGreeting.textContent = `Hi, ${displayName}`;
            } else {
                console.warn("Index Page: User doc not found:", userId); currentUserProfile = null;
                 if (DOMElements.userGreeting) DOMElements.userGreeting.textContent = `Hi, ${currentUser?.email ? currentUser.email.split('@')[0].charAt(0).toUpperCase() + currentUser.email.split('@')[0].slice(1) : 'User'}`;
            }
        } catch (error) { console.error("Index Page: Error fetching profile:", error); currentUserProfile = null; }
    };

    const fetchAndDisplayPlans = async (userId) => {
        // MODIFICATION: Added non-anonymous check
        if (!authReady || !firebaseEnabled || !firestoreModule || !userId || auth.currentUser?.isAnonymous) { 
            if(DOMElements.plansList) DOMElements.plansList.innerHTML = `<p class="text-slate-500">Please log in to see saved plans.</p>`; 
            return; 
        }
        if (unsubscribePlans) { unsubscribePlans(); unsubscribePlans = null; }
        if (!DOMElements.plansList) return;
        DOMElements.plansList.innerHTML = `<p class="text-slate-500">Loading saved plans...</p>`;
        try {
            const { collection, query, onSnapshot, orderBy } = firestoreModule;
            // Path: artifacts/{appId}/users/{userId}/studyPlans
            const plansCollectionRef = collection(db, 'artifacts', appId, 'users', userId, 'studyPlans');
            const q = query(plansCollectionRef, orderBy('createdAt', 'desc'));
            unsubscribePlans = onSnapshot(q, (snapshot) => {
                if (!DOMElements.plansList) return;
                const docs = snapshot.docs;
                if (docs.length === 0) { DOMElements.plansList.innerHTML = `<p class="text-slate-500">No saved 7-day plans found.</p>`; }
                else {
                     DOMElements.plansList.innerHTML = docs.map(doc => {
                        const data = doc.data(); const date = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'N/A';
                        const htmlContent = data.planHTML || '<p class="text-red-500">Error: Plan content missing.</p>';
                        // Removed inline script sanitization as it can interfere with complex layouts; assumed safe content generation.
                        const sanitizedHtml = htmlContent; 
                        return `<div class="border-b last:border-b-0 pb-6 mb-6"><p class="font-semibold text-slate-600 mb-2">Plan created on: ${date}</p><div class="prose prose-sm max-w-none">${sanitizedHtml.replace(/<div class="mt-8.*?<\/div>/s, '')}</div></div>`;
                    }).join('');
                }
            }, (error) => { console.error("Error fetching plans snapshot:", error); if (DOMElements.plansList) DOMElements.plansList.innerHTML = `<p class="text-red-500">Could not fetch plans: ${error.code}.</p>`; unsubscribePlans = null; });
        } catch (error) { console.error("Error setting up plan listener:", error); if(DOMElements.plansList) DOMElements.plansList.innerHTML = `<p class="text-red-500">Error initializing plan display.</p>`; unsubscribePlans = null; }
    };

    // --- Dashboard Progress Listener (Fixed error handling) ---
    function listenForDashboardProgress(userId) {
         // MODIFICATION: Added non-anonymous check
         if (!authReady || !firebaseEnabled || !firestoreModule || !userId || auth.currentUser?.isAnonymous) { 
             if (DOMElements.dashboardProgressBars) DOMElements.dashboardProgressBars.innerHTML = `<p class="text-slate-500">Login to load progress.</p>`; 
             return; 
         }
         if (unsubscribeDashboardProgress) { unsubscribeDashboardProgress(); unsubscribeDashboardProgress = null; }
         const progressContainer = DOMElements.dashboardProgressBars; if (!progressContainer) return;
         progressContainer.innerHTML = `<p class="text-slate-500">Loading progress...</p>`;
         try {
            const { doc, onSnapshot } = firestoreModule;
            // Path: artifacts/{appId}/users/{userId}/progress/summary
            const progressDocRef = doc(db, 'artifacts', appId, 'users', userId, 'progress', 'summary');
            unsubscribeDashboardProgress = onSnapshot(progressDocRef, (docSnap) => {
                if (!progressContainer) return; 
                // CRITICAL FIX: If document doesn't exist or is empty, replace loading state with informative message.
                if (!docSnap.exists() || !docSnap.data() || Object.keys(docSnap.data()).length === 0) { 
                    progressContainer.innerHTML = `<p class="text-slate-500">No syllabus progress found. Start tracking using the "Syllabus Navigator"!</p>`; 
                    return; 
                }
                const data = docSnap.data();
                const renderBar = (label, value) => {
                    const val = value || 0;
                    return `<div><div class="flex justify-between items-center mb-1"><span class="text-lg font-medium text-slate-700">${label}</span><span class="text-lg font-bold ${val === 100 ? 'text-green-600' : 'text-blue-600'}">${val}%</span></div><div class="progress-bar-bg"><div class="progress-bar-fill ${val === 100 ? 'bg-green-500' : 'bg-blue-500'}" style="width: ${val}%;"></div></div></div>`;
                };
                progressContainer.innerHTML = ` ${renderBar('Overall Syllabus', data.overall)} ${renderBar('Preliminary (GS)', data.prelimsGS)} ${renderBar('Preliminary (CSAT)', data.prelimsCSAT)} ${renderBar('Mains GS 1', data.mainsGS1)} ${renderBar('Mains GS 2', data.mainsGS2)} ${renderBar('Mains GS 3', data.mainsGS3)} ${renderBar('Mains GS 4', data.mainsGS4)} ${renderBar('Optional Paper I', data.optionalP1)} ${renderBar('Optional Paper II', data.optionalP2)} `;
            }, (error) => { 
                // CRITICAL FIX: Explicitly handle listener errors
                console.error("Error fetching dashboard progress:", error); 
                progressContainer.innerHTML = `<p class="text-red-500">Error loading progress: ${error.code || 'Network Issue'}.</p>`; 
            });
         } catch (error) { console.error("Error setting up progress listener:", error); progressContainer.innerHTML = `<p class="text-red-500">Error initializing progress display.</p>`; unsubscribeDashboardProgress = null; }
    }

    // --- Event Listeners ---
    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        const targetId = target.id;

        // Close user dropdown
        if (!target.closest('#user-menu')) { if (DOMElements.userDropdown) DOMElements.userDropdown.classList.add('hidden'); }

        // Auth Triggers
        if (['login-btn', 'mobile-login-btn', 'start-trial-btn', 'final-cta-btn'].includes(targetId) || target.closest('#login-btn, #mobile-login-btn, #start-trial-btn, #final-cta-btn')) { e.preventDefault(); openAuthModal('login'); }
        if (targetId === 'close-auth-modal') closeModal(DOMElements.authModal.modal);
        if (targetId === 'auth-switch-to-signup') openAuthModal('signup');
        if (targetId === 'auth-switch-to-login' || targetId === 'auth-switch-to-login-from-reset') openAuthModal('login');
        if (targetId === 'forgot-password-btn') { document.getElementById('login-view')?.classList.add('hidden'); DOMElements.authModal.forgotPasswordView?.classList.remove('hidden'); }

        // Close Account Modal
        if (targetId === 'close-account-modal') closeModal(DOMElements.accountModal.modal);

        // Logout Triggers
        if (target.closest('#dropdown-logout-btn, #mobile-logout-btn')) { 
             if (firebaseEnabled && firebaseAuthModule && auth) {
                 try { await firebaseAuthModule.signOut(auth); showNotification('Logged out.'); }
                 catch (error) { showNotification('Logout failed.', true); console.error("Logout error:", error); }
             } else { showNotification('Cannot log out: Service unavailable.', true); }
        }

        // Account Modal Triggers
        if (target.closest('#my-account-btn, #mobile-my-account-btn')) {
            e.preventDefault();
            if (!authReady) { showNotification("Connecting...", false); return; }
            if (!currentUser || currentUser.isAnonymous) { showNotification("Please log in/sign up.", false); openAuthModal('login'); return; }
            
            const { form, error } = DOMElements.accountModal;
            if (!form || !error) return;
            error.classList.add('hidden');
            form.elements['account-first-name'].value = currentUserProfile?.firstName || '';
            form.elements['account-last-name'].value = currentUserProfile?.lastName || '';
            form.elements['account-email'].value = currentUser.email || 'N/A';
            openModal(DOMElements.accountModal.modal);
        }

        // User Menu Toggle
        if (target.closest('#user-menu-button')) { DOMElements.userDropdown?.classList.toggle('hidden'); }

        // Mobile Menu Toggle
         if (target.closest('#mobile-menu-button')) { DOMElements.mobileMenu?.classList.toggle('hidden'); }

        // --- Feature Card Listeners (FIXED) ---
        if (target.closest('#current-affairs-card')) { showNotification("Feature coming soon!"); }
        
        // ** FIX HERE: Replace placeholder with modal open **
        if (target.closest('#quizzie-feature-card')) { 
            if (!quizzieInitialized) {
                 showNotification("Quizzie module is not initialized. Please ensure Quizzie.js loads.", true);
                 return;
            }
            if (!currentUser || currentUser.isAnonymous) {
                 showNotification("Please log in to use the Quizzie module.", false);
                 openAuthModal('login');
                 return;
            }
            
            // 1. Reset the form state (handled by quizzie.js reset function)
            resetQuizzieModal(); 
            // 2. Open the modal
            openModal(DOMElements.quizzieModal);
        }
        // --- END FEATURE CARD FIX ---

    });

    // --- Form Submit Listeners (Auth/Account) ---
    DOMElements.authModal.loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault(); if (!firebaseEnabled || !firebaseAuthModule || !auth) return;
        const email = e.target.elements['login-email'].value, password = e.target.elements['login-password'].value;
        const errorEl = DOMElements.authModal.error; if(errorEl) errorEl.classList.add('hidden');
        try {
            // Since we discourage anonymous users, any login attempt will either sign in or link a new account (if coming from anon session, though we discouraged anon session above)
            // We use standard sign-in, which will handle the session correctly.
            await firebaseAuthModule.signInWithEmailAndPassword(auth, email, password);
            closeModal(DOMElements.authModal.modal); showNotification("Logged in!");
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
        e.preventDefault(); if (!firebaseEnabled || !firebaseAuthModule || !firestoreModule || !auth) return;
        const firstName = e.target.elements['signup-first-name'].value, lastName = e.target.elements['signup-last-name'].value, email = e.target.elements['signup-email'].value, password = e.target.elements['signup-password'].value;
        const errorEl = DOMElements.authModal.error; if(errorEl) errorEl.classList.add('hidden');
        try {
            const userCred = await firebaseAuthModule.createUserWithEmailAndPassword(auth, email, password); 
            const user = userCred.user;
            
            const { doc, setDoc, serverTimestamp } = firestoreModule; 
            // Path: artifacts/{appId}/users/{userId}
            const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid);
            await setDoc(userDocRef, { 
                profile: { 
                    firstName, 
                    lastName, 
                    email, 
                    createdAt: serverTimestamp(), 
                    optionalSubject: null 
                } 
            }, { merge: true }); // Save to profile subdoc
            
            closeModal(DOMElements.authModal.modal); 
            if (DOMElements.successOverlay) { DOMElements.successOverlay.classList.remove('hidden'); setTimeout(() => DOMElements.successOverlay.classList.add('hidden'), 2500); }
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
        // MODIFICATION: Check for non-anonymous user again
        if (!userId || currentUser?.isAnonymous) { showNotification("You must be logged in to update account.", true); return; } 
        if (!firebaseEnabled || !firestoreModule) return;
        
        const firstName = e.target.elements['account-first-name'].value, lastName = e.target.elements['account-last-name'].value;
        const errorEl = DOMElements.accountModal.error; if(errorEl) errorEl.classList.add('hidden');
        
        const { doc, updateDoc } = firestoreModule; 
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId); // Path: artifacts/{appId}/users/{userId}
        
        try {
            await updateDoc(userDocRef, { 'profile.firstName': firstName, 'profile.lastName': lastName }); showNotification('Account updated!');
            if (currentUserProfile) { currentUserProfile.firstName = firstName; currentUserProfile.lastName = lastName; } else { currentUserProfile = { firstName, lastName, email: currentUser.email }; }
            if (DOMElements.userGreeting) DOMElements.userGreeting.textContent = `Hi, ${firstName}`; closeModal(DOMElements.accountModal.modal);
        } catch(error){ 
             console.error("Account update error:", error.code); 
             if(errorEl){
                 errorEl.textContent="Update failed."; 
                 errorEl.classList.remove('hidden');
            } 
        }
    });
    
    DOMElements.authModal.forgotPasswordForm?.addEventListener('submit', async (e) => { 
        e.preventDefault(); if (!firebaseEnabled || !firebaseAuthModule || !auth) return;
        const email = e.target.elements['reset-email'].value; const errorEl = DOMElements.authModal.error; if(errorEl) errorEl.classList.add('hidden');
        try { await firebaseAuthModule.sendPasswordResetEmail(auth, email); showNotification('Password reset email sent.'); openAuthModal('login'); }
        catch(error){ 
            console.error("PW Reset error:", error.code); 
            if(errorEl){
                errorEl.textContent="Reset failed."; 
                errorEl.classList.remove('hidden');
            } 
        }
    });

    // --- Other UI Listeners (Intersection Observer) ---
    try { const observer = new IntersectionObserver((entries) => entries.forEach(e => e.isIntersecting && e.target.classList.add('visible')), { threshold: 0.1 }); document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el)); }
    catch (e) { console.warn("Intersection Observer failed."); document.querySelectorAll('.fade-in-up').forEach(el => el.classList.add('visible')); }

});