// js/app.js (Refactored to use auth.js module)

// --- Imports ---
import { initAuth } from './auth.js';
import { initQuizzie, resetQuizzieModal } from './quizzie.js';
import { initChatbot } from './chatbot.js';

document.addEventListener('DOMContentLoaded', async function() {
    
    // --- State Variables ---
    let unsubscribePlans = null;
    let unsubscribeDashboardProgress = null;
    let quizzieInitialized = false;
    let authServices = {}; // Will hold { db, auth, firestoreModule, etc. }

    // --- UI Element Refs (Page-Specific + Shared) ---
    const DOMElements = {
        // --- Shared Auth Elements (for auth.js) ---
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

        // --- Page-Specific Elements (index.html) ---
        dashboardSection: document.getElementById('dashboard'),
        plansList: document.getElementById('plans-list'), // Specific to index.html
        dashboardProgressBars: document.getElementById('dashboard-progress-bars'), // Specific to index.html
        copyrightYear: document.getElementById('copyright-year'),
        mentorshipModal: document.getElementById('mentorship-modal'),
        mentorshipForm: document.getElementById('mentorship-form'),
        mentorshipError: document.getElementById('mentorship-error'),
        closeMentorshipModalBtn: document.getElementById('close-mentorship-modal'),
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
        installPwaBtnDesktop: document.getElementById('install-pwa-btn-desktop'),
        installPwaBtnMobile: document.getElementById('install-pwa-btn-mobile'),
    };

    // --- Utility Functions (Page-Specific) ---
    const showNotification = (message, isError = false) => { 
        if (!DOMElements.notification) return; 
        const chatbotContainer = document.getElementById('chatbot-container'); // Get chatbot

        DOMElements.notification.textContent = message; 
        DOMElements.notification.classList.toggle('bg-red-600', isError); 
        DOMElements.notification.classList.toggle('bg-slate-800', !isError); 
        
        // --- FIX START ---
        // Explicitly remove classes that hide the notification
        DOMElements.notification.classList.remove('opacity-0');
        DOMElements.notification.classList.remove('pointer-events-none');
        // Add class to show it
        DOMElements.notification.classList.add('opacity-100'); 
        // --- FIX END ---
        
        if (chatbotContainer) chatbotContainer.classList.add('chatbot-container-lifted'); // LIFT chatbot

        setTimeout(() => { 
            if (DOMElements.notification) {
                DOMElements.notification.classList.remove('opacity-100'); 
                // --- FIX START ---
                // Add classes back to hide it correctly
                DOMElements.notification.classList.add('opacity-0');
                DOMElements.notification.classList.add('pointer-events-none');
                // --- FIX END ---
            }
            if (chatbotContainer) chatbotContainer.classList.remove('chatbot-container-lifted'); // LOWER chatbot
        }, 3000); 
    };
    
    // Simple pass-through functions for modals, as auth.js handles the implementation
    const openModal = (modal) => {
        if (modal) { 
            modal.classList.remove('hidden'); 
            modal.classList.add('active'); 
            setTimeout(() => { 
                const content = modal.querySelector('.modal-content'); 
                if (content) content.style.transform = 'translateY(0)'; 
            }, 10); 
        } 
    };
    
    const closeModal = (modal) => {
        if (modal) { 
            const content = modal.querySelector('.modal-content'); 
            if (content) content.style.transform = 'translateY(-20px)'; 
            modal.classList.remove('active'); 
            setTimeout(() => modal.classList.add('hidden'), 300); 
        } 
    };


    // --- Auth Initialization ---
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    
    authServices = await initAuth(DOMElements, appId, showNotification, {
        /**
         * @param {User} user - The Firebase User object.
         * @param {Firestore} db - The Firestore database instance.
         * @param {object} firestoreModule - Firestore functions (doc, getDoc, etc.)
         * @param {boolean} authHasChecked - True if this is not the first auth check.
         */
        onLogin: (user, db, firestoreModule, authHasChecked) => {
            console.log("Index Page: onLogin callback triggered.");
            // Fetch data needed for index.html
            fetchAndDisplayPlans(user.uid, db, firestoreModule);
            listenForDashboardProgress(user.uid, db, firestoreModule);
            
            // Re-initialize Quizzie if auth is now ready
            if (authServices.db && authServices.getCurrentUser && !quizzieInitialized) {
                initQuizzieModule();
            }
        },
        /**
         * @param {boolean} authHasChecked - True if this is not the first auth check.
         */
        onLogout: (authHasChecked) => {
            console.log("Index Page: onLogout callback triggered.");
            if (unsubscribePlans) { unsubscribePlans(); unsubscribePlans = null; }
            if (unsubscribeDashboardProgress) { unsubscribeDashboardProgress(); unsubscribeDashboardProgress = null; }

            // Only update UI to "logged out" state after initial check
            if (authHasChecked) {
                if (DOMElements.plansList) { DOMElements.plansList.innerHTML = `<p class="text-slate-500">Please log in to see saved plans.</p>`; }
                if (DOMElements.dashboardProgressBars) { DOMElements.dashboardProgressBars.innerHTML = `<p class="text-slate-500">Please log in to see your progress.</p>`; }
            } else {
                if (DOMElements.dashboardProgressBars) { DOMElements.dashboardProgressBars.innerHTML = `<p class="text-slate-500">Authenticating...</p>`; }
            }
        }
    });

    // --- Initialize Page-Specific Modules ---
    
    // Initialize Quizzie (it now gets its auth/db info from the authServices)
    function initQuizzieModule() {
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
        
        if (Object.values(quizzieElements).every(el => el !== null)) {
             initQuizzie(
                quizzieElements,
                showNotification,
                closeModal,
                { // Pass DB and modules from the initialized auth service
                    db: authServices.db,
                    ...authServices.firestoreModule 
                },
                authServices.getCurrentUser // Pass the function to get the current user state
            );
            quizzieInitialized = true;
        } else {
            console.warn("Quizzie initialization skipped: Some DOM elements are missing.");
        }
    }
    
    // Call it once, in case auth was ready immediately
    if (authServices.db && authServices.getCurrentUser && !quizzieInitialized) {
        initQuizzieModule();
    }
    
    // Initialize Chatbot
    initChatbot(showNotification);

    // --- Core App Logic ---
    if (DOMElements.copyrightYear) DOMElements.copyrightYear.textContent = new Date().getFullYear();

    // --- Firestore Functions (Page-Specific) ---

    const fetchAndDisplayPlans = async (userId, db, firestoreModule) => {
        if (!DOMElements.plansList) return;
        if (unsubscribePlans) { unsubscribePlans(); unsubscribePlans = null; }
        DOMElements.plansList.innerHTML = `<p class="text-slate-500">Loading saved plans...</p>`;
        
        try {
            const { collection, query, onSnapshot, orderBy } = firestoreModule;
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
                        const sanitizedHtml = htmlContent; 
                        return `<div class="border-b last:border-b-0 pb-6 mb-6"><p class="font-semibold text-slate-600 mb-2">Plan created on: ${date}</p><div class="prose prose-sm max-w-none">${sanitizedHtml.replace(/<div class="mt-8.*?<\/div>/s, '')}</div></div>`;
                    }).join('');
                }
            }, (error) => { console.error("Error fetching plans snapshot:", error); if (DOMElements.plansList) DOMElements.plansList.innerHTML = `<p class="text-red-500">Could not fetch plans: ${error.code}.</p>`; unsubscribePlans = null; });
        } catch (error) { console.error("Error setting up plan listener:", error); if(DOMElements.plansList) DOMElements.plansList.innerHTML = `<p class="text-red-500">Error initializing plan display.</p>`; unsubscribePlans = null; }
    };

    function listenForDashboardProgress(userId, db, firestoreModule) {
         const progressContainer = DOMElements.dashboardProgressBars;
         if (!progressContainer) return;
         if (unsubscribeDashboardProgress) { unsubscribeDashboardProgress(); unsubscribeDashboardProgress = null; }
         progressContainer.innerHTML = `<p class="text-slate-500">Loading progress...</p>`;
         
         try {
            const { doc, onSnapshot } = firestoreModule;
            const progressDocRef = doc(db, 'artifacts', appId, 'users', userId, 'progress', 'summary');
            unsubscribeDashboardProgress = onSnapshot(progressDocRef, (docSnap) => {
                if (!progressContainer) return; 
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
                console.error("Error fetching dashboard progress:", error); 
                progressContainer.innerHTML = `<p class="text-red-500">Error loading progress: ${error.code || 'Network Issue'}.</p>`; 
            });
         } catch (error) { console.error("Error setting up progress listener:", error); progressContainer.innerHTML = `<p class="text-red-500">Error initializing progress display.</p>`; unsubscribeDashboardProgress = null; }
    }

    // --- Page-Specific Event Listeners ---
    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        const targetId = target.id;

        // --- Mentorship Modal ---
        if (target.closest('#mentorship-cta-btn, #mentorship-final-cta-btn')) {
            e.preventDefault();
            const user = authServices.getCurrentUser();
            if (!user || user.isAnonymous) {
                showNotification("Please log in to request mentorship.", false);
                // openAuthModal is handled by auth.js listener
            } else {
                if(DOMElements.mentorshipForm) DOMElements.mentorshipForm.elements['mentorship-email'].value = user.email;
                if(DOMElements.mentorshipError) DOMElements.mentorshipError.classList.add('hidden');
                openModal(DOMElements.mentorshipModal);
            }
        }
        if (targetId === 'close-mentorship-modal') {
             closeModal(DOMElements.mentorshipModal);
        }

        // --- Quizzie Modal ---
        if (target.closest('#quizzie-feature-card')) { 
            if (!quizzieInitialized) {
                 showNotification("Quizzie module is not initialized.", true);
                 return;
            }
            const user = authServices.getCurrentUser();
            if (!user || user.isAnonymous) {
                 showNotification("Please log in to use the Quizzie module.", false);
                 // openAuthModal is handled by auth.js listener
                 return;
            }
            resetQuizzieModal(); 
            openModal(DOMElements.quizzieModal);
        }
        
        // --- Other Features ---
        if (target.closest('#current-affairs-card')) { 
            showNotification("Feature coming soon!"); 
        }
    });

    // --- Mentorship Form Submit Listener ---
    DOMElements.mentorshipForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = authServices.getCurrentUser();
        const userId = user?.uid;
        if (!userId || user?.isAnonymous) {
            showNotification("You must be logged in.", true);
            return;
        }
        if (!authServices.db || !authServices.firestoreModule) {
            showNotification("Service not available. Please try again.", true);
            return;
        }
        const name = e.target.elements['mentorship-name'].value;
        const phone = e.target.elements['mentorship-phone'].value;
        const details = e.target.elements['mentorship-details'].value;
        const errorEl = DOMElements.mentorshipError;
        const submitBtn = e.target.elements['mentorship-submit-btn'];
        if (errorEl) errorEl.classList.add('hidden');
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        const { doc, updateDoc, serverTimestamp } = authServices.firestoreModule;
        const userDocRef = doc(authServices.db, 'artifacts', appId, 'users', userId);
        try {
            await updateDoc(userDocRef, {
                mentorshipRequest: {
                    name: name,
                    phone: phone,
                    details: details,
                    email: user.email,
                    requestedAt: serverTimestamp()
                }
            });
            showNotification('Request submitted successfully!');
            closeModal(DOMElements.mentorshipModal);
            DOMElements.mentorshipForm.reset();
        } catch (error) {
            console.error("Mentorship form submit error:", error);
            if (errorEl) {
                errorEl.textContent = "Submission failed. Please try again.";
                errorEl.classList.remove('hidden');
            }
            showNotification("Submission failed. Please try again.", true);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Request";
        }
    });

    // --- PWA Install Logic (Remains page-specific) ---
    let deferredPrompt = null;
    
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (DOMElements.installPwaBtnDesktop) DOMElements.installPwaBtnDesktop.classList.remove('hidden');
        if (DOMElements.installPwaBtnMobile) DOMElements.installPwaBtnMobile.classList.remove('hidden');
        console.log('PWA: beforeinstallprompt event fired.');
    });

    async function handleInstallClick(e) {
        e.preventDefault();
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

    if (DOMElements.installPwaBtnDesktop) {
        DOMElements.installPwaBtnDesktop.addEventListener('click', handleInstallClick);
    }
    if (DOMElements.installPwaBtnMobile) {
        DOMElements.installPwaBtnMobile.addEventListener('click', handleInstallClick);
    }

    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        if (DOMElements.installPwaBtnDesktop) DOMElements.installPwaBtnDesktop.classList.add('hidden');
        if (DOMElements.installPwaBtnMobile) DOMElements.installPwaBtnMobile.classList.add('hidden');
        deferredPrompt = null;
    });

    // --- Other UI Listeners (Intersection Observer) ---
    try { 
        const observer = new IntersectionObserver((entries) => entries.forEach(e => e.isIntersecting && e.target.classList.add('visible')), { threshold: 0.1 }); 
        document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el)); 
    }
    catch (e) { 
        console.warn("Intersection Observer failed."); 
        document.querySelectorAll('.fade-in-up').forEach(el => el.classList.add('visible')); 
    }

    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registered successfully with scope:', registration.scope);
          })
          .catch((error) => {
            console.error('Service Worker registration failed:', error);
          });
      });
    }

});
