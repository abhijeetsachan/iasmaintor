// js/app.js (Lean version for index.html)

// --- Imports ---
import { firebaseConfig, GEMINI_API_KEY } from './firebase-config.js';
import {
    initializeAuth,
    onAuthReady,
    getAuth,
    getDb,
    getAppId,
    getCurrentUser,
    getCurrentUserProfile,
    getFirestoreModule
} from './auth.js';
import {
    initUI,
    showNotification,
    openModal,
    closeModal,
    openAuthModal
} from './ui.js';
import { initQuizzie, resetQuizzieModal } from './quizzie.js';

document.addEventListener('DOMContentLoaded', async function() {
    
    // --- 1. Initialize Shared Auth & UI ---
    // This now handles Firebase init, auth state, header, modals, chatbot, etc.
    initializeAuth();
    initUI();

    let quizzieInitialized = false;
    let unsubscribePlans = null;
    let unsubscribeDashboardProgress = null;

    // --- 2. DOM Elements (Page-Specific) ---
    const DOMElements = {
        plansList: document.getElementById('plans-list'),
        dashboardProgressBars: document.getElementById('dashboard-progress-bars'),
        
        // Mentorship Modal Elements
        mentorshipModal: document.getElementById('mentorship-modal'),
        mentorshipForm: document.getElementById('mentorship-form'),
        mentorshipError: document.getElementById('mentorship-error'),
        closeMentorshipModalBtn: document.getElementById('close-mentorship-modal'),

        // Quizzie Module Elements
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

    // --- 3. Initialize Quizzie ---
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
            GEMINI_API_KEY,
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            showNotification, // Use imported utility
            closeModal        // Use imported utility
        );
        quizzieInitialized = true;
    } else {
        console.warn("Quizzie initialization skipped: Some DOM elements are missing.");
    }

    // --- 4. Page-Specific Logic (Dashboard) ---

    // Listen for auth to be ready
    onAuthReady(user => {
        const userId = user?.uid;
        if (user && !user.isAnonymous) {
            // User is logged in and not anon, fetch their data
            fetchAndDisplayPlans(userId);
            listenForDashboardProgress(userId);
            
            // Also update the dashboard section visibility from ui.js logic
            const dashboardSection = document.getElementById('dashboard');
            if(dashboardSection) dashboardSection.classList.remove('hidden');

        } else {
            // User is logged out or anonymous
            if (unsubscribePlans) { unsubscribePlans(); unsubscribePlans = null; }
            if (unsubscribeDashboardProgress) { unsubscribeDashboardProgress(); unsubscribeDashboardProgress = null; }
            
            // Clear UI elements
            if (DOMElements.plansList) DOMElements.plansList.innerHTML = `<p class="text-slate-500">Please log in to see saved plans.</p>`;
            if (DOMElements.dashboardProgressBars) DOMElements.dashboardProgressBars.innerHTML = `<p class="text-slate-500">Please log in to see your progress.</p>`;
            
            // Hide dashboard section
            const dashboardSection = document.getElementById('dashboard');
            if(dashboardSection) dashboardSection.classList.add('hidden');
        }
    });

    const fetchAndDisplayPlans = async (userId) => {
        const db = getDb();
        const appId = getAppId();
        const firestoreModule = getFirestoreModule();
        if (!db || !appId || !firestoreModule || !userId) { 
            if(DOMElements.plansList) DOMElements.plansList.innerHTML = `<p class="text-slate-500">Please log in to see saved plans.</p>`; 
            return; 
        }
        if (unsubscribePlans) { unsubscribePlans(); unsubscribePlans = null; }
        if (!DOMElements.plansList) return;
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

    function listenForDashboardProgress(userId) {
         const db = getDb();
         const appId = getAppId();
         const firestoreModule = getFirestoreModule();
         if (!db || !appId || !firestoreModule || !userId) { 
             if (DOMElements.dashboardProgressBars) DOMElements.dashboardProgressBars.innerHTML = `<p class="text-slate-500">Login to load progress.</p>`; 
             return; 
         }
         if (unsubscribeDashboardProgress) { unsubscribeDashboardProgress(); unsubscribeDashboardProgress = null; }
         const progressContainer = DOMElements.dashboardProgressBars; if (!progressContainer) return;
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

    // --- 5. Page-Specific Event Listeners ---
    document.body.addEventListener('click', (e) => {
        const target = e.target;

        // Mentorship Triggers
        if (target.closest('#mentorship-cta-btn, #mentorship-final-cta-btn')) {
            e.preventDefault();
            const currentUser = getCurrentUser();
            if (!currentUser || currentUser.isAnonymous) {
                showNotification("Please log in to request mentorship.", false);
                openAuthModal('login');
            } else {
                if(DOMElements.mentorshipForm) DOMElements.mentorshipForm.elements['mentorship-email'].value = currentUser.email;
                if(DOMElements.mentorshipError) DOMElements.mentorshipError.classList.add('hidden');
                openModal(DOMElements.mentorshipModal);
            }
        }
        
        if (target.id === 'close-mentorship-modal') {
             closeModal(DOMElements.mentorshipModal);
        }

        // Feature Card Listeners
        if (target.closest('#current-affairs-card')) {
            showNotification("Feature coming soon!");
        }
        
        if (target.closest('#quizzie-feature-card')) { 
            if (!quizzieInitialized) {
                 showNotification("Quizzie module is not initialized.", true);
                 return;
            }
            const currentUser = getCurrentUser();
            if (!currentUser || currentUser.isAnonymous) {
                 showNotification("Please log in to use the Quizzie module.", false);
                 openAuthModal('login');
                 return;
            }
            resetQuizzieModal(); 
            openModal(DOMElements.quizzieModal);
        }
    });

    // Mentorship Form Submit Listener
    DOMElements.mentorshipForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentUser = getCurrentUser();
        const userId = currentUser?.uid;
        if (!userId || currentUser?.isAnonymous) {
            showNotification("You must be logged in.", true);
            return;
        }

        const db = getDb();
        const appId = getAppId();
        const firestoreModule = getFirestoreModule();
        if (!db || !appId || !firestoreModule) {
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

        const { doc, updateDoc, serverTimestamp } = firestoreModule;
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId);

        try {
            await updateDoc(userDocRef, {
                mentorshipRequest: {
                    name: name,
                    phone: phone,
                    details: details,
                    email: currentUser.email,
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

    // --- Other UI Listeners (Intersection Observer) ---
    try { 
        const observer = new IntersectionObserver((entries) => entries.forEach(e => e.isIntersecting && e.target.classList.add('visible')), { threshold: 0.1 }); 
        document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el)); 
    }
    catch (e) { 
        console.warn("Intersection Observer failed."); 
        document.querySelectorAll('.fade-in-up').forEach(el => el.classList.add('visible')); 
    }

});
