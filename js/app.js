// js/app.js (Refactored to use auth.js module)

// --- Imports ---
import { initAuth } from './auth.js';
import { initQuizzie, resetQuizzieModal } from './quizzie.js';
import { initChatbot } from './chatbot.js';

// --- NEW: Imports for Dashboard Revision Module ---
import { STATUSES, addSRSProperties } from './utils.js';
import { getPrelimsSyllabus } from './syllabus-prelims-data.js';
import { getMainsGS1Syllabus } from './syllabus-mains-gs1-data.js';
import { getMainsGS2Syllabus } from './syllabus-mains-gs2-data.js';
import { getMainsGS3Syllabus } from './syllabus-mains-gs3-data.js';
import { getMainsGS4Syllabus } from './syllabus-mains-gs4-data.js';
import { getOptionalSyllabusById } from './optional-syllabus-data.js';

// --- Global Constants ---
const REVISION_SCHEDULE = { d1: 1, d3: 3, d7: 7, d21: 21 }; // SRS days

document.addEventListener('DOMContentLoaded', async function() {
    
    // --- State Variables ---
    let unsubscribePlans = null;
    let unsubscribeDashboardProgress = null;
    let quizzieInitialized = false;
    let authServices = {}; // Will hold { db, auth, firestoreModule, etc. }

    // --- NEW: State for Revision Module ---
    let syllabusData = [];
    let optionalSubject = null;
    let unsubscribeOptional = null;


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
        revisionReminderList: document.getElementById('revision-reminder-list'), // --- NEW ---
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
            
            // --- NEW: Start revision listener ---
            listenForRevisionReminders(user.uid, db, firestoreModule, appId);
            
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
            // --- NEW: Stop revision listener ---
            if (unsubscribeOptional) { unsubscribeOptional(); unsubscribeOptional = null; }


            // Only update UI to "logged out" state after initial check
            if (authHasChecked) {
                if (DOMElements.plansList) { DOMElements.plansList.innerHTML = `<p class="text-slate-500">Please log in to see saved plans.</p>`; }
                if (DOMElements.dashboardProgressBars) { DOMElements.dashboardProgressBars.innerHTML = `<p class="text-slate-500">Please log in to see your progress.</p>`; }
                // --- NEW: Update revision list on logout ---
                if (DOMElements.revisionReminderList) { DOMElements.revisionReminderList.innerHTML = `<p class="text-slate-500">Please log in to see your revision reminders.</p>`; }
            } else {
                if (DOMElements.dashboardProgressBars) { DOMElements.dashboardProgressBars.innerHTML = `<p class="text-slate-500">Authenticating...</p>`; }
                // --- NEW: Update revision list on auth check ---
                if (DOMElements.revisionReminderList) { DOMElements.revisionReminderList.innerHTML = `<p class="text-slate-500">Authenticating...</p>`; }
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

    // --- ### NEW: REVISION REMINDER LOGIC (from syllabus-tracker.js) ### ---
    
    /**
     * Assembles the full default syllabus structure.
     */
    function assembleDefaultSyllabus() {
        try {
            const prelimsData = getPrelimsSyllabus();
            const mainsGS1Data = getMainsGS1Syllabus();
            const mainsGS2Data = getMainsGS2Syllabus();
            const mainsGS3Data = getMainsGS3Syllabus();
            const mainsGS4Data = getMainsGS4Syllabus();
            const essaySection = addSRSProperties({ id: 'mains-essay', name: 'Essay', status: STATUSES.NOT_STARTED, children: [{ id: 'mains-essay-practice', name: 'Essay Writing Practice', status: STATUSES.NOT_STARTED }]});
            const optionalPlaceholder1 = addSRSProperties({ id: 'mains-opt1-placeholder', name: 'Select your optional subject', status: STATUSES.NOT_STARTED });
            const optionalPlaceholder2 = addSRSProperties({ id: 'mains-opt2-placeholder', name: 'Select your optional subject', status: STATUSES.NOT_STARTED });
            const mainsData = addSRSProperties({
                id: 'mains', name: 'Mains', status: STATUSES.NOT_STARTED, children: [
                    essaySection, mainsGS1Data, mainsGS2Data, mainsGS3Data, mainsGS4Data,
                    { id: 'mains-optional-1', name: 'Optional Subject Paper-I', status: STATUSES.NOT_STARTED, children: [optionalPlaceholder1]},
                    { id: 'mains-optional-2', name: 'Optional Subject Paper-II', status: STATUSES.NOT_STARTED, children: [optionalPlaceholder2]},
                ]
            });
            return [prelimsData, mainsData].filter(Boolean);
        } catch (error) {
            console.error("FATAL: Error assembling default syllabus:", error);
            return [];
        }
    }

    /**
     * Updates the syllabusData object with the correct optional subject data.
     */
    function updateOptionalSyllabusData(syllabusDataRef) {
        if (!optionalSubject) return;
        const { paper1, paper2 } = getOptionalSyllabusById(optionalSubject);
        const mains = syllabusDataRef.find(s => s?.id === 'mains');
        if (!mains || !mains.children) return;
        const mainsOpt1 = mains.children.find(p => p?.id === 'mains-optional-1');
        const mainsOpt2 = mains.children.find(p => p?.id === 'mains-optional-2');
        if (mainsOpt1 && paper1) {
            Object.assign(mainsOpt1, paper1);
            mainsOpt1.name = `Optional (${optionalSubject.toUpperCase()}) P-I`;
        }
         if (mainsOpt2 && paper2) {
            Object.assign(mainsOpt2, paper2);
            mainsOpt2.name = `Optional (${optionalSubject.toUpperCase()}) P-II`;
        }
    }

    /**
     * Finds a topic item by its ID in the syllabusData tree.
     */
    function findItemById(id, nodes) {
        if (!id || !Array.isArray(nodes)) return null;
        for (const node of nodes) {
            if (!node) continue;
            if (node.id === id) return node;
            if (Array.isArray(node.children)) {
                const found = findItemById(id, node.children);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * Calculates the status of a specific revision day.
     */
    function getRevisionStatus(startDate, days, isDone) {
        if (!startDate) return { status: 'pending', date: null };
        if (isDone) return { status: 'done', date: null };
        try {
            const start = new Date(startDate + 'T00:00:00');
            if (isNaN(start)) throw new Error("Invalid start date format");
            const revisionDate = new Date(start);
            revisionDate.setDate(start.getDate() + days);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            revisionDate.setHours(0, 0, 0, 0);
            if (revisionDate > today) return { status: 'pending', date: revisionDate };
            if (revisionDate.getTime() === today.getTime()) return { status: 'due', date: revisionDate };
            return { status: 'overdue', date: revisionDate };
        } catch (e) {
            console.error("Error calculating revision status:", e, { startDate, days, isDone });
            return { status: 'pending', date: null };
        }
    }

    /**
     * --- ### MODIFIED: getDueRevisions ### ---
     * Traverses the entire syllabusData tree and finds all due revisions.
     * It now groups due revisions by topic to avoid duplicates.
     */
    function getDueRevisions(nodes) {
        if (!Array.isArray(nodes)) return [];
        const revisionsMap = new Map(); // Use a Map to group by topic ID
    
        function traverse(items) {
            if (!Array.isArray(items)) return;
    
            items.forEach(item => {
                if (!item || !item.id) return;
    
                if (!Array.isArray(item.children) || item.children.length === 0) {
                    // This is a micro-topic
                    if (item.startDate && item.revisions) {
                        
                        Object.entries(REVISION_SCHEDULE).forEach(([dayKey, days]) => {
                            const isDone = item.revisions[dayKey] === true;
                            const { status } = getRevisionStatus(item.startDate, days, isDone);
    
                            if (status === 'due' || status === 'overdue') {
                                // Get existing entry or create a new one
                                const existingEntry = revisionsMap.get(item.id) || {
                                    topicName: item.name,
                                    id: item.id,
                                    dueRevisions: []
                                };
                                
                                // Add this due revision
                                existingEntry.dueRevisions.push({
                                    day: dayKey.toUpperCase(), // "D1", "D3", "D7"
                                    status: status // "due" or "overdue"
                                });

                                // Save it back to the map
                                revisionsMap.set(item.id, existingEntry);
                            }
                        });
                    }
                } else {
                    // This is a parent, traverse children
                    traverse(item.children);
                }
            });
        }
    
        traverse(nodes);
        return Array.from(revisionsMap.values()); // Returns the new, de-duplicated structure
    }

    /**
     * Fetches all user progress, calculates due revisions, and renders them.
     * Also listens for changes to the optional subject.
     */
    async function listenForRevisionReminders(userId, db, firestoreModule, appId) {
        const reminderListEl = DOMElements.revisionReminderList;
        if (!reminderListEl) return;
        
        const { doc, getDoc, collection, getDocs, query, onSnapshot } = firestoreModule;

        // This function does the heavy lifting
        const refreshRevisions = async () => {
            try {
                reminderListEl.innerHTML = `<p class="text-slate-500">Loading full syllabus and progress...</p>`;
                
                // 1. Assemble base syllabus
                let fullSyllabus = assembleDefaultSyllabus();
                if (fullSyllabus.length === 0) throw new Error("Syllabus assembly failed.");

                // 2. Integrate Optional Subject data
                if (optionalSubject) {
                    updateOptionalSyllabusData(fullSyllabus);
                }
                
                // 3. Fetch all topic progress
                const progressCollectionRef = collection(db, 'users', userId, 'topicProgress');
                const progressSnapshot = await getDocs(query(progressCollectionRef));
                
                // 4. Merge progress into syllabus data
                if (!progressSnapshot.empty) {
                    progressSnapshot.forEach(doc => {
                        const topicId = doc.id;
                        const progressData = doc.data();
                        const topicItem = findItemById(topicId, fullSyllabus);
                        if (topicItem) {
                            Object.assign(topicItem, progressData); 
                        }
                    });
                }
                
                // 5. Calculate due revisions (using the new de-duplicating function)
                const revisionsDue = getDueRevisions(fullSyllabus);
                
                // 6. --- MODIFIED: Render the new grouped badge list ---
                if (revisionsDue.length === 0) {
                    reminderListEl.innerHTML = `<p class="text-green-700 font-semibold text-center py-4">🎉 All caught up! No revisions due today.</p>`;
                } else {
                    reminderListEl.innerHTML = revisionsDue.map(r => {
                        // --- MODIFICATION START ---
                        // Create a single badge with all due days
                        const dueDays = r.dueRevisions.map(day => day.day).join(', '); // "D1, D3, D7"
                        // Determine the "worst" status to show (Overdue > Due)
                        const overallStatus = r.dueRevisions.some(day => day.status === 'overdue') ? 'overdue' : 'due';
                        const statusText = overallStatus === 'overdue' ? 'Overdue' : 'Due';
                        
                        const badgeHTML = `
                            <span class="dashboard-reminder-badge status-${overallStatus}" title="Revisions due: ${dueDays}">
                                ${dueDays} ${statusText}
                            </span>`;
                        // --- MODIFICATION END ---
                
                        return `
                        <div class="dashboard-reminder-item">
                            <a href="tracker.html" class="dashboard-reminder-link">${r.topicName}</a>
                            <div class="dashboard-reminder-badge-group">
                                ${badgeHTML} 
                            </div>
                        </div>
                        `;
                    }).join('');
                }

            } catch (error) {
                console.error("Error refreshing revision reminders:", error);
                reminderListEl.innerHTML = `<p class="text-red-500">Error loading reminders: ${error.message}</p>`;
            }
        };

        // Stop any previous listener
        if (unsubscribeOptional) unsubscribeOptional();

        // Start a new listener for profile changes (e.g., optional subject)
        const profileDocRef = doc(db, 'artifacts', appId, 'users', userId);
        unsubscribeOptional = onSnapshot(profileDocRef, (docSnap) => {
            const newOptional = docSnap.data()?.profile?.optionalSubject || null;
            if (newOptional !== optionalSubject) {
                console.log(`Dashboard: Optional subject changed to ${newOptional}. Refreshing revisions.`);
                optionalSubject = newOptional;
                refreshRevisions(); // Refresh list if optional changes
            } else if (optionalSubject === null) { // --- MODIFIED: Handle initial load correctly
                 // This handles the initial load
                 refreshRevisions();
            }
        }, (error) => {
             console.error("Error in optional subject listener (dashboard):", error);
             reminderListEl.innerHTML = `<p class="text-red-500">Error loading user profile.</p>`;
        });
        
        // Also refresh revisions if the user is already logged in but the optional subject was already set
        if(optionalSubject) {
            refreshRevisions();
        }
    }


    // --- ### END OF NEW REVISION LOGIC ### ---


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
