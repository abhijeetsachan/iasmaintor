import { initializeApp, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, addDoc, collection, onSnapshot, query, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function() {
    // --- Firebase Initialization ---
    let app, db, auth;
    // CRITICAL FIX: Removed placeholder config. The app now relies entirely on the injected config.
    if (typeof __firebase_config === 'undefined') {
        console.error("Firebase configuration is missing. App cannot start.");
        showNotification("Error: App configuration is missing.");
        return;
    }
    const firebaseConfig = JSON.parse(__firebase_config);
    
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        setLogLevel('debug');
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showNotification("Error: Could not connect to services.");
        return;
    }

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    let currentUser = null;
    let generatedPlanHTML = '';
    let unsubscribePlans = null;

    // --- UI Element Refs ---
    const DOMElements = {
        authLinks: document.getElementById('auth-links'),
        userDashboardLink: document.getElementById('user-dashboard-link'),
        dashboardSection: document.getElementById('dashboard'),
        mobileMenu: document.getElementById('mobile-menu'),
        mobileMenuButton: document.getElementById('mobile-menu-button'),
        mobileAuthLinks: document.getElementById('mobile-auth-links'),
        mobileUserActions: document.getElementById('mobile-user-actions'),
        mobileDashboardLink: document.getElementById('mobile-dashboard-link'),
        header: document.getElementById('header'),
        notification: document.getElementById('notification'),
        authModal: {
            modal: document.getElementById('auth-modal'),
            loginView: document.getElementById('login-view'),
            signupView: document.getElementById('signup-view'),
            error: document.getElementById('auth-error'),
            loginForm: document.getElementById('login-form'),
            signupForm: document.getElementById('signup-form'),
        },
        plannerModal: {
            modal: document.getElementById('planner-modal'),
            questionnaire: document.getElementById('planner-questionnaire'),
            planResult: document.getElementById('plan-result'),
        },
        plansList: document.getElementById('plans-list'),
        copyrightYear: document.getElementById('copyright-year'),
    };
    
    // --- Utility Functions ---
    const showNotification = (message, isError = false) => {
        DOMElements.notification.textContent = message;
        DOMElements.notification.classList.toggle('bg-red-600', isError);
        DOMElements.notification.classList.toggle('bg-slate-800', !isError);
        DOMElements.notification.classList.add('opacity-100');
        setTimeout(() => {
            DOMElements.notification.classList.remove('opacity-100');
        }, 3000);
    };

    const openModal = (modal) => modal.classList.remove('hidden');
    const closeModal = (modal) => modal.classList.add('hidden');

    // --- Core App Logic ---

    // Dynamic Copyright Year
    DOMElements.copyrightYear.textContent = new Date().getFullYear();

    // Authentication State Management
    onAuthStateChanged(auth, (user) => {
        currentUser = user; 
        updateUIForAuthState(user);
    });

    const updateUIForAuthState = (user) => {
        const isLoggedIn = user && !user.isAnonymous;

        DOMElements.authLinks.classList.toggle('hidden', isLoggedIn);
        DOMElements.userDashboardLink.classList.toggle('hidden', !isLoggedIn);
        DOMElements.dashboardSection.classList.toggle('hidden', !isLoggedIn);
        
        DOMElements.mobileAuthLinks.classList.toggle('hidden', isLoggedIn);
        DOMElements.mobileUserActions.classList.toggle('hidden', !isLoggedIn);
        DOMElements.mobileDashboardLink.classList.toggle('hidden', !isLoggedIn);
        
        if (isLoggedIn) {
            // FIX: If it's the mock user, display mock data instead of calling Firebase
            if (user.uid === 'mock-admin-uid') {
                displayMockPlans();
            } else {
                fetchAndDisplayPlans(user.uid);
            }
        } else {
            if (unsubscribePlans) unsubscribePlans();
            DOMElements.plansList.innerHTML = '<p class="text-slate-500">Please log in to see your saved plans.</p>';
            DOMElements.dashboardSection.classList.add('hidden');
        }
    };
    
    // Modal Handling
    const openAuthModal = (mode = 'login') => {
        const { modal, loginView, signupView, error, loginForm, signupForm } = DOMElements.authModal;
        error.classList.add('hidden');
        loginForm.reset();
        signupForm.reset();

        loginView.classList.toggle('hidden', mode !== 'login');
        signupView.classList.toggle('hidden', mode === 'login');
        
        openModal(modal);
    };

    // Planner Logic
    const navigatePlannerSteps = (currentStep, direction) => {
        const currentStepNumber = parseInt(currentStep.dataset.step);
        const nextStepNumber = direction === 'next' ? currentStepNumber + 1 : currentStepNumber - 1;
        const nextStep = DOMElements.plannerModal.questionnaire.querySelector(`[data-step="${nextStepNumber}"]`);
        
        if (nextStep) {
            currentStep.classList.remove('active');
            nextStep.classList.add('active');
        }
    };

    const resetPlannerModal = () => {
        const { questionnaire, planResult } = DOMElements.plannerModal;
        questionnaire.reset();
        questionnaire.classList.remove('hidden');
        planResult.classList.add('hidden');
        planResult.innerHTML = '';
        questionnaire.querySelectorAll('[data-step]').forEach((step, index) => {
            step.classList.toggle('active', index === 0);
        });
    };
    
    // --- Mock Data Function ---
    const displayMockPlans = () => {
        const mockPlanHTML = `
            <div class="border-b last:border-b-0 pb-6">
                <p class="font-semibold text-slate-600 mb-4">Plan created on: (Sample Date)</p>
                <h3 class="text-2xl font-bold mb-4 text-slate-800">Your Personalised 7-Day Plan</h3>
                <p class="mb-4 text-slate-600"><strong>Level:</strong> Beginner | <strong>Commitment:</strong> Full-time | <strong>Optional:</strong> Sociology</p>
                <p class="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-800 rounded-r-lg">Focus on NCERTs & building foundational knowledge. Read one core subject for 2 weeks straight.</p>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left border-collapse">
                        <thead class="bg-slate-100">
                            <tr><th class="p-2 border border-slate-200">Day</th><th class="p-2 border border-slate-200">Focus</th><th class="p-2 border border-slate-200">Daily Tasks</th></tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="font-semibold p-2 border border-slate-200">Day 1</td>
                                <td class="p-2 border border-slate-200">Polity (GS) & Sociology</td>
                                <td class="p-2 border border-slate-200">
                                    <ul class="list-disc list-inside"><li>Newspaper</li><li>GS Subject</li><li>Optional</li><li>Revision</li></ul>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>`;
        DOMElements.plansList.innerHTML = mockPlanHTML;
    };

    // Firestore Operations
    const savePlan = async () => {
        if (!currentUser || currentUser.isAnonymous) {
            showNotification('Please log in or create an account to save your plan.', true);
            openAuthModal('signup');
            return;
        }
        if (currentUser.uid === 'mock-admin-uid') {
            showNotification('Saving is disabled in demo mode.', true);
            closeModal(DOMElements.plannerModal.modal);
            return;
        }
        try {
            const plansCollection = collection(db, 'artifacts', appId, 'users', currentUser.uid, 'studyPlans');
            await addDoc(plansCollection, {
                planHTML: generatedPlanHTML,
                createdAt: serverTimestamp()
            });
            showNotification('Plan saved successfully!');
            closeModal(DOMElements.plannerModal.modal);
        } catch (error) {
            console.error("Error saving plan: ", error);
            showNotification('Could not save plan. Please try again.', true);
        }
    };
    
    const fetchAndDisplayPlans = (userId) => {
        if (unsubscribePlans) unsubscribePlans();
        const plansCollection = collection(db, 'artifacts', appId, 'users', userId, 'studyPlans');
        const q = query(plansCollection, orderBy('createdAt', 'desc'));
        
        unsubscribePlans = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                DOMElements.plansList.innerHTML = `<p class="text-slate-500">You haven't saved any plans yet. Click on 'AI-Powered Study Plan' to create one!</p>`;
                return;
            }
            let plansHTML = '';
            snapshot.forEach(doc => {
                const planData = doc.data();
                const date = planData.createdAt?.toDate().toLocaleDateString() || 'Recently';
                plansHTML += `<div class="border-b last:border-b-0 pb-6">
                    <p class="font-semibold text-slate-600 mb-4">Plan created on: ${date}</p>
                    ${planData.planHTML.replace(/<div class="mt-8.*?<\/div>/s, '')}
                </div>`;
            });
            DOMElements.plansList.innerHTML = plansHTML;
        }, (error) => {
            console.error("Error fetching plans: ", error);
            DOMElements.plansList.innerHTML = `<p class="text-red-500">Could not fetch your plans. Please refresh the page.</p>`;
        });
    };

    // --- Event Listeners ---
    
    document.body.addEventListener('click', async (e) => {
        if (e.target.matches('#login-btn, #mobile-login-btn')) { e.preventDefault(); openAuthModal('login'); }
        if (e.target.matches('#start-trial-btn, #final-cta-btn')) { e.preventDefault(); openAuthModal('login'); }
        if (e.target.matches('#close-auth-modal')) { closeModal(DOMElements.authModal.modal); }
        if (e.target.matches('#auth-switch-to-signup')) { openAuthModal('signup'); }
        if (e.target.matches('#auth-switch-to-login')) { openAuthModal('login'); }

        if (e.target.closest('#logout-btn, #mobile-logout-btn')) {
            // FIX: Handle logout for both mock user and real user
            if (currentUser && currentUser.uid === 'mock-admin-uid') {
                currentUser = null;
                updateUIForAuthState(null);
                showNotification('Logged out from demo.');
            } else if (auth) {
                try {
                    await signOut(auth);
                    showNotification('Logged out.');
                } catch (error) {
                    showNotification('Logout failed.', true);
                }
            }
        }

        if (e.target.closest('#planner-feature-card')) { resetPlannerModal(); openModal(DOMElements.plannerModal.modal); }
        if (e.target.matches('#close-planner-modal')) { closeModal(DOMElements.plannerModal.modal); }

        const nextBtn = e.target.closest('.next-step-btn');
        const prevBtn = e.target.closest('.prev-step-btn');
        if (nextBtn) navigatePlannerSteps(nextBtn.closest('[data-step]'), 'next');
        if (prevBtn) navigatePlannerSteps(prevBtn.closest('[data-step]'), 'prev');
    });

    DOMElements.authModal.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = DOMElements.authModal.loginForm.querySelector('#login-email').value;
        const password = DOMElements.authModal.loginForm.querySelector('#login-password').value;
        
        // --- TEMPORARY MOCK LOGIN ---
        if (email === 'admin@iasmaintor.com' && password === 'admin') {
            const mockUser = { uid: 'mock-admin-uid', isAnonymous: false, email: 'admin@iasmaintor.com' };
            currentUser = mockUser;
            updateUIForAuthState(mockUser);
            closeModal(DOMElements.authModal.modal);
            showNotification('Logged in as admin (DEMO)');
            return; // Stop execution to prevent Firebase call
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
            closeModal(DOMElements.authModal.modal);
            showNotification('Logged in successfully!');
        } catch (error) {
            if (email === 'admin@iasmaintor.com' && password === 'admin' && (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential')) {
                try {
                    await createUserWithEmailAndPassword(auth, email, password);
                    closeModal(DOMElements.authModal.modal);
                    showNotification('Admin account created & logged in. Welcome!');
                } catch (creationError) {
                    DOMElements.authModal.error.textContent = "Invalid credentials. Please check your email and password.";
                    DOMElements.authModal.error.classList.remove('hidden');
                }
            } else {
                DOMElements.authModal.error.textContent = "Invalid credentials. Please check your email and password.";
                DOMElements.authModal.error.classList.remove('hidden');
            }
        }
    });

    DOMElements.authModal.signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = DOMElements.authModal.signupForm.querySelector('#signup-email').value;
        const password = DOMElements.authModal.signupForm.querySelector('#signup-password').value;
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            closeModal(DOMElements.authModal.modal);
            showNotification('Account created successfully!');
        } catch (error) {
            DOMElements.authModal.error.textContent = error.message;
            DOMElements.authModal.error.classList.remove('hidden');
        }
    });

    DOMElements.plannerModal.questionnaire.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { questionnaire, planResult } = DOMElements.plannerModal;

        // Show a loading state
        questionnaire.classList.add('hidden');
        planResult.classList.remove('hidden');
        planResult.innerHTML = `<div class="text-center p-8">
            <h3 class="text-xl font-semibold mb-4">Generating your personalized plan...</h3>
            <p class="text-slate-600">Our AI mentor is crafting the perfect schedule for you. Please wait a moment!</p>
        </div>`;

        try {
            const formData = new FormData(questionnaire);
            const answers = Object.fromEntries(formData.entries());

            // Call the new serverless function
            const response = await fetch('/api/generate-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(answers)
            });

            if (!response.ok) {
                throw new Error('The AI mentor is unavailable right now. Please try again later.');
            }
            
            const planHTML = await response.text();
            
            // This is the full HTML returned by Gemini
            const finalHTML = `
                <h3 class="text-2xl font-bold mb-4 text-slate-800">Your Personalised 7-Day Plan</h3>
                <p class="mb-4 text-slate-600"><strong>Level:</strong> ${answers.level.charAt(0).toUpperCase() + answers.level.slice(1)} | <strong>Commitment:</strong> ${answers.commitment === 'full-time' ? 'Full-time' : 'Working Professional'} | <strong>Optional:</strong> ${answers.optional}</p>
                ${planHTML}
                <div class="mt-8 flex flex-col sm:flex-row gap-4">
                    <button data-action="save-plan" class="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold flex-1">Save Plan to My Dashboard</button>
                    <button data-action="modify-plan" class="bg-slate-200 text-slate-800 px-6 py-3 rounded-lg font-semibold flex-1">Start Over</button>
                </div>
            `;

            generatedPlanHTML = finalHTML; // Save for the 'savePlan' function
            planResult.innerHTML = finalHTML;
            
        } catch (error) {
            planResult.innerHTML = `<div class="text-center p-8 bg-red-50 border border-red-200 rounded-lg">
                <h3 class="text-xl font-semibold mb-2 text-red-700">Oops! Something went wrong.</h3>
                <p class="text-red-600">${error.message}</p>
                 <button data-action="modify-plan" class="mt-4 bg-slate-200 text-slate-800 px-6 py-3 rounded-lg font-semibold">Try Again</button>
            </div>`;
        }
    });

    DOMElements.plannerModal.planResult.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action === 'save-plan') savePlan();
        if (action === 'modify-plan') resetPlannerModal();
    });

    DOMElements.mobileMenuButton.addEventListener('click', () => {
        DOMElements.mobileMenu.classList.toggle('hidden');
    });

    window.addEventListener('scroll', () => {
        DOMElements.header.classList.toggle('shadow-md', window.scrollY > 50);
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));
});
