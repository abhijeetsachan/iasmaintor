// js/syllabus-tracker.js

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
    closeModal
} from './ui.js';

// --- Syllabus Data Imports ---
import { STATUSES, addSRSProperties } from './utils.js';
import { getPrelimsSyllabus } from './syllabus-prelims-data.js';
import { getMainsGS1Syllabus } from './syllabus-mains-gs1-data.js';
import { getMainsGS2Syllabus } from './syllabus-mains-gs2-data.js';
import { getMainsGS3Syllabus } from './syllabus-mains-gs3-data.js';
import { getMainsGS4Syllabus } from './syllabus-mains-gs4-data.js';
import { OPTIONAL_SUBJECT_LIST, getOptionalSyllabusById } from './optional-syllabus-data.js';

// --- Global Constants ---
const REVISION_SCHEDULE = { d1: 1, d3: 3, d7: 7, d21: 21 }; // SRS days
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- State Variables (Module Scope) ---
let syllabusData = [];
let optionalSubject = null;
let isSyllabusLoading = true;
let srsModalContext = {};
let unsubscribeOptional = null;

// --- DOM Elements (Page-Specific) ---
const DOMElements = {
    appContainer: document.getElementById('syllabus-app-container'),
    contentWrapper: document.getElementById('syllabus-content-wrapper'),
    loadingIndicator: document.getElementById('syllabus-loading'),
    saveBtn: document.getElementById('save-syllabus-btn'), // Note: Save btn is not currently used
    tabButtons: document.querySelectorAll('.tab-button'),
    tabContents: document.querySelectorAll('.tab-content'),
    revisionsDueList: document.getElementById('revisions-due-list'),
    prelimsTreeContainer: document.getElementById('prelims-syllabus-tree'),
    prelimsTree: document.querySelector('#prelims-syllabus-tree ul.syllabus-list[data-target-paper="prelims"]'),
    mainsGsChipNav: document.getElementById('mains-gs-chip-nav'),
    mainsSyllabusTreeContainer: document.getElementById('mains-syllabus-tree-container'),
    mainsGsTrees: document.querySelectorAll('#mains-syllabus-tree-container ul.syllabus-list'),
    optionalSelectionScreen: document.getElementById('optional-selection-screen'),
    optionalListContainer: document.getElementById('optional-list-container'),
    optionalSyllabusView: document.getElementById('optional-syllabus-view'),
    optionalSyllabusTitle: document.getElementById('optional-syllabus-title'),
    optionalSyllabusTreeContainer: document.getElementById('optional-syllabus-tree-container'),
    startDateModal: document.getElementById('start-date-modal'),
    sdateTopicName: document.getElementById('sdate-topic-name'),
    startDateInput: document.getElementById('start-date-input'),
    startDateForm: document.getElementById('start-date-form'),
    confirmRevisionModal: document.getElementById('confirm-revision-modal'),
    confirmTopicName: document.getElementById('confirm-topic-name'),
    confirmRevisionDay: document.getElementById('confirm-revision-day'),
    confirmRevisionSubmitBtn: document.getElementById('confirm-revision-submit-btn'),
    dailyReminderModal: document.getElementById('daily-reminder-modal'),
    reminderCount: document.getElementById('reminder-count'),
    reminderTopicList: document.getElementById('reminder-topic-list'),
    aiResponseModal: document.getElementById('ai-response-modal'),
    aiModalTitle: document.getElementById('ai-modal-title'),
    aiTopicName: document.getElementById('ai-topic-name'),
    aiResponseContent: document.getElementById('ai-response-content'),
};

// --- Main Initialization & Entry Point ---
document.addEventListener('DOMContentLoaded', async function() {
    console.log("DOM Content Loaded. Initializing Tracker...");

    // --- 1. Initialize Shared Auth & UI ---
    // This handles Firebase init, auth state, header, modals, chatbot, etc.
    initializeAuth();
    initUI();

    // Initial UI state
    DOMElements.loadingIndicator?.classList.remove('hidden');
    DOMElements.contentWrapper?.classList.add('hidden');
    if (DOMElements.saveBtn) {
        DOMElements.saveBtn.disabled = true;
        DOMElements.saveBtn.style.display = 'none'; // Hide save button for now
    }

    // --- 2. Listen for Auth Ready ---
    // This is the trigger to load page-specific data
    onAuthReady(async (user) => {
        console.log("Tracker Page: Auth Ready. User:", user ? user.uid : 'null');
        const userId = user?.uid;

        if (user && !user.isAnonymous) {
            // User is logged in and not anon
            if (isSyllabusLoading) {
                console.log("User found, triggering syllabus load.");
                await loadSyllabusData(userId); // Load all syllabus data
                setupSyllabusListeners(); // Setup listeners *after* data is loaded
                startDailyReminderCheck(); // Check for reminders
            }
        } else {
            // User is logged out or anonymous
            isSyllabusLoading = false;
            if (unsubscribeOptional) { unsubscribeOptional(); unsubscribeOptional = null; }
            console.error("User logged out or authentication required.");
            // Show auth error *instead* of "Loading..."
            DOMElements.loadingIndicator.innerHTML = '<p class="text-red-500 p-4">Authentication required. Please log in to view the tracker.</p>';
            DOMElements.loadingIndicator.classList.remove('hidden'); // Ensure it's visible
            DOMElements.contentWrapper.classList.add('hidden');
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
}); // End DOMContentLoaded

// --- Syllabus Data Loading ---
async function loadSyllabusData(userId) {
    console.log("loadSyllabusData started for user:", userId);
    isSyllabusLoading = false;

    // Keep loader visible during this process
    DOMElements.loadingIndicator?.classList.remove('hidden');
    DOMElements.contentWrapper?.classList.add('hidden');

    const db = getDb();
    const appId = getAppId();
    const firestoreModule = getFirestoreModule();
    let loadedStaticData = null;
    let loadedOptionalSubject = null;

    try {
        if (!db || !appId || !firestoreModule?.doc || !firestoreModule?.getDoc || !firestoreModule?.collection || !firestoreModule?.getDocs) {
            throw new Error("Firestore module not ready or missing required functions.");
        }
        const { doc, getDoc, collection, getDocs, query } = firestoreModule;

        console.log("Fetching profile for optional subject...");
        const profileDocRef = doc(db, 'artifacts', appId, 'users', userId);
        const profileSnap = await getDoc(profileDocRef);
        loadedOptionalSubject = profileSnap.exists() ? profileSnap.data()?.profile?.optionalSubject : null;
        optionalSubject = loadedOptionalSubject;
        console.log("Optional subject loaded:", optionalSubject);

        console.log("Assembling default syllabus structure.");
        loadedStaticData = assembleDefaultSyllabus();
        if (loadedStaticData.length === 0) {
            throw new Error("Assembly function returned empty data.");
        }

        if (optionalSubject) {
            console.log(`Integrating optional syllabus: ${optionalSubject}`);
            updateOptionalSyllabusData(loadedStaticData);
        } else {
            console.log("No optional subject selected by user.");
        }

        console.log("Fetching granular topic progress...");
        const progressCollectionRef = collection(db, 'users', userId, 'topicProgress');
        const progressSnapshot = await getDocs(query(progressCollectionRef));

        if (!progressSnapshot.empty) {
            console.log(`Merging ${progressSnapshot.size} progress documents.`);
            progressSnapshot.forEach(doc => {
                const topicId = doc.id;
                const progressData = doc.data();
                const topicItem = findItemById(topicId, loadedStaticData);
                if (topicItem) {
                    Object.assign(topicItem, progressData);
                } else {
                    console.warn(`Found progress for unknown topic ID: ${topicId}`);
                }
            });
        } else {
            console.log("No saved topic progress found in Firestore. Using default state.");
        }

        syllabusData = loadedStaticData;
        console.log("Syllabus data preparation and merge complete.");

        console.log("Recalculating all parent statuses...");
        syllabusData.forEach(topLevelNode => recalculateParentStatus(topLevelNode));
        console.log("Parent status recalculation complete.");

    } catch (error) {
        console.error("CRITICAL Error during syllabus load:", error);
        showNotification("Error loading syllabus data. Please refresh.", true);
        DOMElements.loadingIndicator.innerHTML = `<p class="text-red-500 p-4">A critical error occurred loading syllabus data. Please check console.</p>`;
        DOMElements.loadingIndicator.classList.remove('hidden');
        DOMElements.contentWrapper.classList.add('hidden');
        return; // Stop execution
    }

    // Success: Hide loader, show content, and render
    DOMElements.loadingIndicator?.classList.add('hidden');
    DOMElements.contentWrapper?.classList.remove('hidden');
    if (DOMElements.contentWrapper) DOMElements.contentWrapper.classList.add('overflow-y-auto');
    
    activateTab('dashboard'); // Start on dashboard
    startOptionalSubjectListener(userId); // Listen for future changes
}

// --- Syllabus Data Assembly ---
function assembleDefaultSyllabus() {
    console.log("Assembling default syllabus...");
    try {
        const prelimsData = getPrelimsSyllabus();
        const mainsGS1Data = getMainsGS1Syllabus();
        const mainsGS2Data = getMainsGS2Syllabus();
        const mainsGS3Data = getMainsGS3Syllabus();
        const mainsGS4Data = getMainsGS4Syllabus();

        if (!prelimsData || !mainsGS1Data || !mainsGS2Data || !mainsGS3Data || !mainsGS4Data) {
            throw new Error("One or more core syllabus data modules failed to return data.");
        }

        const essaySection = addSRSProperties({
            id: 'mains-essay', name: 'Essay', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-essay-practice', name: 'Essay Writing Practice & Structure', status: STATUSES.NOT_STARTED },
                { id: 'mains-essay-philosophical', name: 'Philosophical/Abstract Themes', status: STATUSES.NOT_STARTED },
                { id: 'mains-essay-socio-political', name: 'Socio-Political Themes', status: STATUSES.NOT_STARTED },
                { id: 'mains-essay-economic', name: 'Economic/Developmental Themes', status: STATUSES.NOT_STARTED },
                { id: 'mains-essay-scitech-env', name: 'Sci-Tech/Environment Themes', status: STATUSES.NOT_STARTED },
            ]
        });

        const optionalPlaceholder1 = addSRSProperties({ id: 'mains-opt1-placeholder', name: 'Select your optional subject', status: STATUSES.NOT_STARTED });
        const optionalPlaceholder2 = addSRSProperties({ id: 'mains-opt2-placeholder', name: 'Select your optional subject', status: STATUSES.NOT_STARTED });

        const mainsData = addSRSProperties({
            id: 'mains', name: 'Mains', status: STATUSES.NOT_STARTED, children: [
                essaySection,
                mainsGS1Data, mainsGS2Data, mainsGS3Data, mainsGS4Data,
                { id: 'mains-optional-1', name: 'Optional Subject Paper-I', status: STATUSES.NOT_STARTED, children: [optionalPlaceholder1] },
                { id: 'mains-optional-2', name: 'Optional Subject Paper-II', status: STATUSES.NOT_STARTED, children: [optionalPlaceholder2] },
            ]
        });

        const fullSyllabus = [prelimsData, mainsData].filter(Boolean);
        console.log("Default syllabus assembled successfully.");
        return JSON.parse(JSON.stringify(fullSyllabus));

    } catch (error) {
        console.error("FATAL: Error assembling default syllabus:", error);
        showNotification("Critical error: Could not build syllabus structure.", true);
        return [];
    }
}


// --- Event Listener Setup (Page-Specific) ---
function setupSyllabusListeners() {
    // --- Main Click Handler for Syllabus Page ---
    document.body.addEventListener('click', async function(e) {
        const target = e.target;
        
        // Handle modal closes
        if (target.matches('#close-ai-response-modal')) {
            if (DOMElements.aiResponseModal) { closeModal(DOMElements.aiResponseModal); }
            srsModalContext = {}; return;
        }
        if (target.matches('#sdate-cancel-btn')) {
            if (DOMElements.startDateModal) { closeModal(DOMElements.startDateModal); }
            srsModalContext = {}; return;
        }
        if (target.matches('#confirm-revision-cancel-btn')) {
            if (DOMElements.confirmRevisionModal) { closeModal(DOMElements.confirmRevisionModal); }
            srsModalContext = {}; return;
        }
        if (target.matches('#close-reminder-btn, #go-to-dashboard-btn')) {
            if (DOMElements.dailyReminderModal) closeModal(DOMElements.dailyReminderModal);
            if (target.id === 'go-to-dashboard-btn') activateTab('dashboard');
            return;
        }

        // Tab Navigation
        if (target.classList.contains('tab-button') && target.dataset.tab) {
            activateTab(target.dataset.tab); return;
        }
        if (target.classList.contains('gs-chip') && target.dataset.paper) {
            renderSyllabusMains(target.dataset.paper); return;
        }

        // Actionable elements
        const actionElement = target.closest('[data-action]');
        const action = actionElement?.dataset.action;
        if (!action) return; // No action to perform

        let itemId;
        let itemElement = target.closest('[data-id], [data-topic-id]');

        if (action === 'syllabus-toggle-item') { itemId = target.closest('li.syllabus-item')?.dataset.id; }
        else if (action === 'srs-bar') { itemId = actionElement?.dataset.topicId; }
        else if (action === 'jump-to-topic') { itemId = actionElement?.dataset.id; }
        else if (actionElement) { itemId = actionElement.dataset.id; }

        const topicItem = itemId ? findItemById(itemId, syllabusData) : null;
        const topicName = topicItem?.name || 'Topic';

        // --- Action Router ---
        switch (action) {
            case 'syllabus-toggle-item':
                if (!target.closest('.progress-toggle, .ai-button, .revision-dot, .select-optional-btn')) {
                    const wrapper = actionElement;
                    const parentLi = wrapper?.closest('li.syllabus-item');
                    const childUl = parentLi?.querySelector(':scope > ul.syllabus-list');
                    const toggleIcon = wrapper?.querySelector('.syllabus-toggle');
                    const hasChildren = wrapper?.dataset.hasChildren === 'true';

                    if (childUl && toggleIcon && hasChildren) {
                        const isExpanded = childUl.style.display !== 'none';
                        childUl.style.display = isExpanded ? 'none' : 'block';
                        toggleIcon.classList.toggle('expanded', !isExpanded);
                        e.stopPropagation();
                    }
                }
                break;

            case 'toggle-status':
                if (topicItem && actionElement) {
                    e.stopPropagation();
                    handleStatusToggle(topicItem, actionElement);
                }
                break;

            case 'srs-bar':
                if (target.classList.contains('revision-dot')) {
                    e.stopPropagation();
                    handleSrsDotClick(target, topicItem);
                }
                break;

            case 'ai-plan':
            case 'ai-resources':
            case 'ai-pyq':
                if (topicItem && actionElement) {
                    e.stopPropagation();
                    handleAIGenerator(itemId, action, topicName);
                }
                break;

            case 'jump-to-topic':
                if (itemId) {
                    e.preventDefault();
                    handleJumpToTopic(itemId);
                }
                break;
            
            case 'select-optional':
                const subjectId = actionElement.dataset.subjectId;
                if (subjectId) {
                    e.preventDefault();
                    handleOptionalSelection(subjectId);
                }
                break;

            case 'confirm-revision':
                e.preventDefault();
                handleRevisionConfirm();
                break;
        }
    }); // End Main Click Handler

    // --- Form Submit Listeners ---
    DOMElements.startDateForm?.addEventListener('submit', handleStartDateSubmit);
}

// --- Action Handlers ---

function handleStatusToggle(topicItem, actionElement) {
    const currentStatus = topicItem.status;
    let newStatus = STATUSES.NOT_STARTED;
    if (currentStatus === STATUSES.NOT_STARTED) newStatus = STATUSES.IN_PROGRESS;
    else if (currentStatus === STATUSES.IN_PROGRESS) newStatus = STATUSES.COMPLETED;

    const isMicroTopic = !Array.isArray(topicItem.children) || topicItem.children.length === 0;

    if (isMicroTopic && currentStatus === STATUSES.NOT_STARTED && newStatus === STATUSES.IN_PROGRESS && !topicItem.startDate) {
        // --- Micro topic, first time "In Progress" -> Show SRS modal ---
        srsModalContext = { itemId: topicItem.id, topicName: topicItem.name, newStatus };
        if (DOMElements.sdateTopicName) DOMElements.sdateTopicName.textContent = topicItem.name;
        if (DOMElements.startDateInput) DOMElements.startDateInput.valueAsDate = new Date();
        if (DOMElements.startDateModal) openModal(DOMElements.startDateModal);
    } else if (isMicroTopic) {
        // --- Micro topic, no modal needed ---
        topicItem.status = newStatus;
        updateToggleButtonUI(actionElement, newStatus);
        updateParentStatuses(topicItem.id, document);
        updateTrackerDashboard();
        saveTopicProgress(topicItem.id, {
            status: topicItem.status,
            startDate: topicItem.startDate,
            revisions: topicItem.revisions
        });
    } else {
        // --- This is a PARENT topic ---
        topicItem.status = newStatus;
        updateToggleButtonUI(actionElement, newStatus);
        
        // Update all children in data model and UI
        function updateAllChildren(node, status) {
            if (!node || !Array.isArray(node.children)) return;
            node.children.forEach(child => {
                child.status = status;
                const childLi = document.querySelector(`li[data-id="${child.id}"]`);
                if (childLi) {
                    const toggleButton = childLi.querySelector(`button[data-action="toggle-status"]`);
                    if (toggleButton) {
                        updateToggleButtonUI(toggleButton, status);
                    }
                }
                if (child.children && child.children.length > 0) {
                    updateAllChildren(child, status);
                }
            });
        }
        updateAllChildren(topicItem, newStatus);
        
        // Save all children (micro-topics only)
        function saveAllChildren(node) {
            if (!node) return;
            if (!Array.isArray(node.children) || node.children.length === 0) {
                // This is a micro-topic, save it
                saveTopicProgress(node.id, { status: node.status, startDate: node.startDate, revisions: node.revisions });
                return;
            }
            node.children.forEach(saveAllChildren); // Recurse
        }
        saveAllChildren(topicItem);
        
        updateParentStatuses(topicItem.id, document);
        updateTrackerDashboard();
    }
}

function handleSrsDotClick(dotEl, topicItem) {
    if (!topicItem) {
        console.warn("Could not find topic data for SRS dot click.");
        return;
    }
    const status = dotEl.dataset.status;
    const dayKey = dotEl.dataset.day;

    if ((status === 'due' || status === 'overdue') && topicItem.revisions && dayKey) {
        srsModalContext = { itemId: topicItem.id, topicName: topicItem.name, dayKey };
        if (DOMElements.confirmTopicName) DOMElements.confirmTopicName.textContent = topicItem.name;
        if (DOMElements.confirmRevisionDay) DOMElements.confirmRevisionDay.textContent = dayKey.toUpperCase();
        if (DOMElements.confirmRevisionModal) openModal(DOMElements.confirmRevisionModal);
    }
    else if (status === 'done') { showNotification("Revision already marked as done.", false); }
    else if (status === 'pending') {
        const days = REVISION_SCHEDULE[dayKey];
        if (topicItem.startDate && days) {
            const { date: revDate } = getRevisionStatus(topicItem.startDate, days, false);
            if (revDate) showNotification(`Revision pending. Due: ${revDate.toLocaleDateString()}`, false);
            else showNotification("Revision pending (error calculating date).", true);
        } else { showNotification("Revision pending (start date missing).", true); }
    }
}

function handleJumpToTopic(itemId) {
    const topic = findItemById(itemId, syllabusData);
    if (!topic) { console.error("Jump-to-topic: Topic not found:", itemId); return; }

    let targetTabId = 'dashboard';
    if (itemId.includes('prelims')) targetTabId = 'preliminary';
    else if (itemId.includes('mains-gs') || itemId.includes('mains-essay')) targetTabId = 'mains';
    else if (itemId.includes('mains-optional') || itemId.includes('mains-opt')) targetTabId = 'optional';

    activateTab(targetTabId);

    if (targetTabId === 'mains' && (itemId.includes('mains-gs') || itemId.includes('mains-essay'))) {
        const parts = itemId.split('-');
        let targetPaperId = 'mains-gs1'; // default
        if (itemId.includes('mains-essay')) {
            targetPaperId = 'mains-essay';
        } else if (parts.length >= 3) {
            targetPaperId = `${parts[0]}-${parts[1]}${parts[2]}`;
        }
        if (document.querySelector(`[data-paper="${targetPaperId}"]`)) {
            renderSyllabusMains(targetPaperId);
        }
    }

    setTimeout(() => {
        const targetEl = document.querySelector(`li[data-id="${itemId}"]`);
        if (targetEl) {
            let current = targetEl.parentElement?.closest('li.syllabus-item');
            while (current) {
                const ul = current.querySelector(':scope > ul.syllabus-list');
                const toggle = current.querySelector(':scope > .syllabus-item-content-wrapper .syllabus-toggle');
                if (ul && ul.style.display === 'none') ul.style.display = 'block';
                if (toggle && !toggle.classList.contains('expanded')) toggle.classList.add('expanded');
                current = current.parentElement?.closest('li.syllabus-item');
            }
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetEl.style.transition = 'background-color 0s'; targetEl.style.backgroundColor = '#fef3c7'; // Highlight
            setTimeout(() => { if (targetEl) { targetEl.style.transition = 'background-color 0.8s ease-out'; targetEl.style.backgroundColor = ''; } }, 800);
        } else { console.warn("Jump target element not found:", itemId); }
    }, 300);
}

async function handleOptionalSelection(subjectId) {
    const currentUser = getCurrentUser();
    const db = getDb();
    const appId = getAppId();
    const firestoreModule = getFirestoreModule();
    
    if (!currentUser) return showNotification("Please wait for authentication.", true);
    if (!db || !appId || !firestoreModule?.doc || !firestoreModule?.setDoc) return showNotification("Database service unavailable.", true);
    
    try {
        const { doc, setDoc } = firestoreModule;
        const profileDocRef = doc(db, 'artifacts', appId, 'users', currentUser.uid);
        await setDoc(profileDocRef,
            { profile: { optionalSubject: subjectId } },
            { merge: true }
        );
        showNotification(`Optional set to ${subjectId.toUpperCase()}! Syncing...`);
        // The onSnapshot listener will handle the data update and re-render
    } catch (error) {
        console.error("Error setting optional:", error);
        showNotification("Failed to save optional choice.", true);
    }
}

function handleRevisionConfirm() {
    const { itemId: revItemId, dayKey: revDayKey } = srsModalContext;
    const itemToRevise = revItemId ? findItemById(revItemId, syllabusData) : null;

    if (itemToRevise?.revisions && revDayKey) {
        itemToRevise.revisions[revDayKey] = true;
        
        // If D-21 is done, mark topic as complete
        if (revDayKey === 'd21') {
            itemToRevise.status = STATUSES.COMPLETED;
            updateParentStatuses(revItemId, document);
        }
        
        showNotification(`Revision ${revDayKey.toUpperCase()} confirmed!`);
        closeModal(DOMElements.confirmRevisionModal);
        srsModalContext = {};

        // Update UI
        const listItem = document.querySelector(`li[data-id="${revItemId}"]`);
        if (listItem) {
            const srsBarDiv = listItem.querySelector(`.srs-bar-container[data-topic-id="${revItemId}"]`);
            if (srsBarDiv) srsBarDiv.outerHTML = createSRSBarHTML(itemToRevise);
            
            if (revDayKey === 'd21') {
                const toggleButton = listItem.querySelector(`button[data-action="toggle-status"]`);
                if (toggleButton) {
                    updateToggleButtonUI(toggleButton, STATUSES.COMPLETED);
                }
            }
        }
        
        updateTrackerDashboard();
        saveTopicProgress(revItemId, {
            status: itemToRevise.status,
            startDate: itemToRevise.startDate,
            revisions: itemToRevise.revisions
        });
    } else {
        showNotification("Error confirming revision.", true);
        console.error("Revision confirm failed:", srsModalContext, itemToRevise);
        closeModal(DOMElements.confirmRevisionModal);
        srsModalContext = {};
    }
}

function handleStartDateSubmit(e) {
    e.preventDefault();
    const dateString = DOMElements.startDateInput.value;
    const { itemId: srsItemId, newStatus: srsNewStatus } = srsModalContext;
    const itemToStart = srsItemId ? findItemById(srsItemId, syllabusData) : null;

    if (itemToStart && dateString && srsNewStatus) {
        itemToStart.startDate = dateString;
        itemToStart.status = srsNewStatus;

        showNotification(`Tracking started from ${new Date(dateString + 'T00:00:00').toLocaleDateString()}.`);
        closeModal(DOMElements.startDateModal); srsModalContext = {};

        // Update UI
        const listItem = document.querySelector(`li[data-id="${srsItemId}"]`);
        if (listItem) {
            const toggleButton = listItem.querySelector(`button[data-action="toggle-status"]`);
            if (toggleButton) {
                updateToggleButtonUI(toggleButton, srsNewStatus);
            }
            const srsBarDiv = listItem.querySelector(`.srs-bar-container[data-topic-id="${srsItemId}"]`);
            if (srsBarDiv) srsBarDiv.outerHTML = createSRSBarHTML(itemToStart);
        } else {
            console.warn("Could not find list item to update SRS UI after setting start date:", srsItemId);
        }

        updateParentStatuses(srsItemId, document);
        updateTrackerDashboard();
        saveTopicProgress(srsItemId, {
            status: itemToStart.status,
            startDate: itemToStart.startDate,
            revisions: itemToStart.revisions
        });
    } else {
        showNotification("Please select a valid date.", true);
        console.error("Start date submit failed:", srsModalContext, itemToStart, dateString);
    }
}


// --- Firebase & Persistence ---
async function saveTopicProgress(itemId, progressData) {
    const currentUser = getCurrentUser();
    const db = getDb();
    const firestoreModule = getFirestoreModule();
    const userId = currentUser?.uid;

    if (!userId || !db || !firestoreModule?.doc || !firestoreModule?.setDoc) {
        console.error("Cannot save topic progress: User not logged in or Firestore unavailable.");
        showNotification("Save failed: Check connection.", true);
        return;
    }

    try {
        const { doc, setDoc } = firestoreModule;
        const topicDocRef = doc(db, 'users', userId, 'topicProgress', itemId);
        const cleanData = {
            status: progressData.status,
            startDate: progressData.startDate || null,
            revisions: progressData.revisions || { d1: false, d3: false, d7: false, d21: false }
        };
        await setDoc(topicDocRef, cleanData, { merge: true });
        console.log(`Progress saved for topic: ${itemId}`);
    } catch (error) {
        console.error(`Error saving progress for ${itemId}:`, error);
        showNotification(`Save failed for topic ${itemId}.`, true);
    }
}

function startOptionalSubjectListener(userId) {
    const db = getDb();
    const appId = getAppId();
    const firestoreModule = getFirestoreModule();
    if (unsubscribeOptional) { unsubscribeOptional(); unsubscribeOptional = null; }
    if (!db || !appId || !firestoreModule?.doc || !firestoreModule?.onSnapshot || !userId) {
        console.warn("Firestore not ready for optional listener."); return;
    }
    console.log("Starting optional subject listener for user:", userId);

    const { doc, onSnapshot } = firestoreModule;
    const profileDocRef = doc(db, 'artifacts', appId, 'users', userId);

    unsubscribeOptional = onSnapshot(profileDocRef, (docSnap) => {
        const profile = docSnap.data()?.profile || {};
        const newOptional = profile.optionalSubject || null;

        if (newOptional !== optionalSubject) {
            console.log(`Optional subject change detected via listener: ${optionalSubject} -> ${newOptional}`);
            const oldOptional = optionalSubject;
            optionalSubject = newOptional;

            // Reset old optional data in syllabusData
            if (oldOptional) {
                const mains = syllabusData.find(s => s?.id === 'mains');
                if (mains?.children) {
                    const opt1 = mains.children.find(p => p?.id === 'mains-optional-1');
                    const opt2 = mains.children.find(p => p?.id === 'mains-optional-2');
                    const placeholder1 = addSRSProperties({ id: 'mains-opt1-placeholder', name: 'Select your optional subject', status: STATUSES.NOT_STARTED });
                    const placeholder2 = addSRSProperties({ id: 'mains-opt2-placeholder', name: 'Select your optional subject', status: STATUSES.NOT_STARTED });
                    if (opt1) Object.assign(opt1, { name: 'Optional Subject Paper-I', status: STATUSES.NOT_STARTED, children: [placeholder1] });
                    if (opt2) Object.assign(opt2, { name: 'Optional Subject Paper-II', status: STATUSES.NOT_STARTED, children: [placeholder2] });
                }
            }
            // Add new optional data
            if (newOptional) {
                updateOptionalSyllabusData(syllabusData);
            }

            // Re-render *if* the optional tab is active
            if (document.getElementById('tab-optional')?.classList.contains('active')) {
                renderOptionalTab();
            }
            updateTrackerDashboard(); // Always update dashboard totals
            showNotification(`Optional subject updated to ${newOptional ? newOptional.toUpperCase() : 'None'}.`);
        }
    }, (error) => { console.error("Error in optional subject listener:", error); });
}

function updateOptionalSyllabusData(syllabusDataRef) {
    if (!optionalSubject) return;
    console.log(`Updating internal syllabusData with optional: ${optionalSubject}`);
    const { paper1, paper2 } = getOptionalSyllabusById(optionalSubject);
    if (!paper1 && !paper2) { console.error(`Could not get syllabus data for optional: ${optionalSubject}`); return; }

    const mains = syllabusDataRef.find(s => s?.id === 'mains');
    if (!mains || !mains.children) { console.error("Mains node not found for optional update."); return; }

    const mainsOpt1 = mains.children.find(p => p?.id === 'mains-optional-1');
    const mainsOpt2 = mains.children.find(p => p?.id === 'mains-optional-2');

    if (mainsOpt1 && paper1) {
        Object.assign(mainsOpt1, paper1);
        mainsOpt1.name = `Optional (${optionalSubject.toUpperCase()}) P-I`;
        console.log("Optional Paper 1 data integrated.");
    }
    if (mainsOpt2 && paper2) {
        Object.assign(mainsOpt2, paper2);
        mainsOpt2.name = `Optional (${optionalSubject.toUpperCase()}) P-II`;
        console.log("Optional Paper 2 data integrated.");
    }
}


// --- Data Traversal & Manipulation ---
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

function updateParentStatuses(childId, containerElement = document) {
    if (!childId || !containerElement) return;
    const childElement = containerElement.querySelector(`li[data-id="${childId}"]`);
    if (!childElement) return;

    const parentLi = childElement.closest('ul.syllabus-list')?.closest('li.syllabus-item');
    const parentId = parentLi?.dataset.id;
    if (!parentId) return;

    const parentItem = findItemById(parentId, syllabusData);
    if (!parentItem || !Array.isArray(parentItem.children) || parentItem.children.length === 0) return;

    const validChildren = parentItem.children.filter(c => c && c.status);
    if (validChildren.length === 0) return;

    let newParentStatus;
    if (validChildren.every(c => c.status === STATUSES.COMPLETED)) {
        newParentStatus = STATUSES.COMPLETED;
    } else if (validChildren.some(c => c.status === STATUSES.IN_PROGRESS || c.status === STATUSES.COMPLETED)) {
        newParentStatus = STATUSES.IN_PROGRESS;
    } else {
        newParentStatus = STATUSES.NOT_STARTED;
    }

    if (parentItem.status !== newParentStatus) {
        parentItem.status = newParentStatus;
        const parentToggle = parentLi.querySelector(`.progress-toggle[data-id="${parentId}"]`);
        if (parentToggle) {
            updateToggleButtonUI(parentToggle, newParentStatus);
        } else {
            console.warn("Could not find parent toggle button UI element for ID:", parentId);
        }
        updateParentStatuses(parentId, containerElement); // Recurse
    }
}

function recalculateParentStatus(node) {
    if (!node) return null;
    if (!Array.isArray(node.children) || node.children.length === 0) {
        return node.status || STATUSES.NOT_STARTED;
    }
    const childrenStatuses = node.children
        .map(child => recalculateParentStatus(child))
        .filter(status => status !== null);

    if (childrenStatuses.length === 0) {
        node.status = STATUSES.NOT_STARTED;
        return node.status;
    }

    let newParentStatus;
    if (childrenStatuses.every(s => s === STATUSES.COMPLETED)) {
        newParentStatus = STATUSES.COMPLETED;
    } else if (childrenStatuses.some(s => s === STATUSES.IN_PROGRESS || s === STATUSES.COMPLETED)) {
        newParentStatus = STATUSES.IN_PROGRESS;
    } else {
        newParentStatus = STATUSES.NOT_STARTED;
    }
    node.status = newParentStatus;
    return newParentStatus;
}


// --- UI Rendering ---

function updateToggleButtonUI(button, newStatus) {
    if (!button) return;
    const statusText = newStatus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    button.textContent = statusText;
    button.className = `progress-toggle status-${newStatus}-ui flex-shrink-0`;
    button.setAttribute('data-current-status', newStatus);
}

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

function createSRSBarHTML(item) {
    if (!item || !item.id) return '<span class="text-xs text-red-500">Error</span>';
    const days = [1, 3, 7, 21];
    const revisions = item.revisions || {};
    let html = `<div class="flex items-center space-x-1 srs-bar-container" data-topic-id="${item.id}" data-action="srs-bar">`;
    if (!item.startDate) {
        html += `<span class="text-xs text-slate-400 italic">SRS not started</span>`;
    } else {
        days.forEach(day => {
            const dayKey = `d${day}`;
            const isDone = revisions[dayKey] === true;
            const { status } = getRevisionStatus(item.startDate, day, isDone);
            const statusClass = `dot-${status}`;
            const titleText = `${day}-day revision (${status.toUpperCase()})`;
            html += `<span class="revision-dot ${statusClass}" data-day="${dayKey}" data-status="${status}" title="${titleText}">
                        <span class="text-xs font-bold text-white leading-none">${day}</span>
                    </span>`;
        });
    }
    html += `</div>`;
    return html;
}

function createSyllabusItemHTML(item, level) {
    if (!item || !item.id || !item.name) return '';
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;
    const isMicroTopic = !hasChildren;
    const currentStatus = item.status || STATUSES.NOT_STARTED;
    const statusText = currentStatus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    let controlsHTML = '';
    if (isMicroTopic) {
        controlsHTML = `
            <div class="flex flex-col items-start gap-2 lg:flex-row lg:items-center lg:space-x-3 text-sm flex-shrink-0">
                ${createSRSBarHTML(item)}
                <div class="flex flex-wrap gap-1 flex-shrink-0">
                    <button class="ai-button bg-blue-100 text-blue-800 hover:bg-blue-200" data-id="${item.id}" data-action="ai-plan">AI Plan</button>
                    <button class="ai-button bg-purple-100 text-purple-800 hover:bg-purple-200" data-id="${item.id}" data-action="ai-resources">Resources</button>
                    <button class="ai-button bg-rose-100 text-rose-800 hover:bg-rose-200" data-id="${item.id}" data-action="ai-pyq">PYQs</button>
                </div>
            </div>`;
    }

    const progressToggle = `
        <button class="progress-toggle status-${currentStatus}-ui flex-shrink-0"
            data-id="${item.id}"
            data-action="toggle-status"
            data-current-status="${currentStatus}"
            data-is-micro-topic="${isMicroTopic}">
            ${statusText}
        </button>`;

    return `
        <li class="syllabus-item level-${level} ${isMicroTopic ? 'is-micro-topic' : ''}" data-id="${item.id}">
            <div class="syllabus-item-content-wrapper" data-action="syllabus-toggle-item" data-has-children="${hasChildren}">
                <div class="flex items-center w-full flex-grow min-w-0">
                    <span class="syllabus-toggle ${hasChildren ? '' : 'invisible'} flex-shrink-0 mr-2"></span>
                    <span class="syllabus-label mr-4 break-words">${item.name}</span>
                </div>
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 w-full md:w-auto flex-shrink-0">
                    ${controlsHTML}
                    ${progressToggle}
                </div>
            </div>
            ${hasChildren ? `<ul class="syllabus-list" style="display: none;"></ul>` : ''}
        </li>`;
}

function renderSyllabus(items, container, level) {
    if (!container) { console.error("Render target container not found."); return; }
    container.innerHTML = '';
    if (!Array.isArray(items) || items.length === 0) {
        if (level === 1) container.innerHTML = '<li class="p-2 text-slate-500">No syllabus topics found for this section.</li>';
        return;
    }
    const fragment = document.createDocumentFragment();
    items.filter(item => item && item.id && item.name).forEach(item => {
        try {
            const itemHTML = createSyllabusItemHTML(item, level);
            const template = document.createElement('template');
            template.innerHTML = itemHTML.trim();
            const listItem = template.content.firstChild;
            if (listItem instanceof HTMLElement) {
                fragment.appendChild(listItem);
                if (Array.isArray(item.children) && item.children.length > 0) {
                    const newContainer = listItem.querySelector(':scope > ul.syllabus-list');
                    if (newContainer) {
                        renderSyllabus(item.children, newContainer, level + 1);
                    }
                }
            }
        } catch (renderError) {
            console.error("Error rendering item:", item.id, renderError);
        }
    });
    container.appendChild(fragment);
}


// --- Dashboard & Progress Calculation ---
function calculateOverallProgress(nodes) {
    if (!Array.isArray(nodes)) return 0;
    let totalMicroTopics = 0;
    let completedMicroTopics = 0;
    function traverse(items) {
        if (!Array.isArray(items)) return;
        items.forEach(item => {
            if (!item) return;
            if (!Array.isArray(item.children) || item.children.length === 0) {
                totalMicroTopics++;
                if (item.status === STATUSES.COMPLETED) completedMicroTopics++;
            } else {
                traverse(item.children);
            }
        });
    }
    traverse(nodes);
    return totalMicroTopics === 0 ? 0 : Math.round((completedMicroTopics / totalMicroTopics) * 100);
}

function getDueRevisions(nodes) {
    if (!Array.isArray(nodes)) return [];
    const revisionsDue = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    function traverse(items, paperName = 'N/A') {
        if (!Array.isArray(items)) return;
        items.forEach(item => {
            if (!item || !item.id) return;
            let currentPaperName = paperName;
            if (item.id.startsWith('prelims-gs') || item.id.startsWith('mains-gs') || item.id === 'mains-essay') currentPaperName = item.name;
            else if (item.id.includes('optional')) currentPaperName = `Optional (${optionalSubject?.toUpperCase() || '?'}) ${item.name.includes('P-I') ? 'P-I' : 'P-II'}`;
            if (!Array.isArray(item.children) || item.children.length === 0) {
                if (item.startDate && item.revisions) {
                    Object.entries(REVISION_SCHEDULE).forEach(([dayKey, days]) => {
                        const isDone = item.revisions[dayKey] === true;
                        const { status, date } = getRevisionStatus(item.startDate, days, isDone);
                        if (status === 'due' || status === 'overdue') {
                            revisionsDue.push({ topicName: item.name, id: item.id, paper: currentPaperName, days: days, status: status, date: date });
                        }
                    });
                }
            } else {
                traverse(item.children, currentPaperName);
            }
        });
    }
    traverse(nodes, 'Overall Syllabus');
    return revisionsDue;
}

function updateTrackerDashboard() {
    console.log("Updating tracker dashboard...");
    if (!Array.isArray(syllabusData) || syllabusData.length === 0) return;

    const prelimsNode = syllabusData.find(s => s?.id === 'prelims');
    const mainsNode = syllabusData.find(s => s?.id === 'mains');
    const prelimsChildren = prelimsNode?.children || [];
    const mainsChildren = mainsNode?.children || [];

    const overallProgress = calculateOverallProgress(syllabusData);
    const prelimsGS = calculateOverallProgress(prelimsChildren.find(p => p?.id === 'prelims-gs1')?.children);
    const prelimsCSAT = calculateOverallProgress(prelimsChildren.find(p => p?.id === 'prelims-csat')?.children);
    const mainsGS1 = calculateOverallProgress(mainsChildren.find(p => p?.id === 'mains-gs1')?.children);
    const mainsGS2 = calculateOverallProgress(mainsChildren.find(p => p?.id === 'mains-gs2')?.children);
    const mainsGS3 = calculateOverallProgress(mainsChildren.find(p => p?.id === 'mains-gs3')?.children);
    const mainsGS4 = calculateOverallProgress(mainsChildren.find(p => p?.id === 'mains-gs4')?.children);
    const optionalP1 = calculateOverallProgress(mainsChildren.find(p => p?.id === 'mains-optional-1')?.children);
    const optionalP2 = calculateOverallProgress(mainsChildren.find(p => p?.id === 'mains-optional-2')?.children);

    const updateCircle = (circleElement, value) => {
        const val = (typeof value === 'number' && !isNaN(value)) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
        if (circleElement) {
            circleElement.style.setProperty('--value', val);
            const valueSpan = circleElement.querySelector('.progress-circle-value');
            if (valueSpan) valueSpan.textContent = `${val}%`;
        }
    };

    const dashboard = document.getElementById('tab-dashboard');
    if (!dashboard) { console.error("Dashboard tab container not found!"); return; }

    updateCircle(dashboard.querySelector('.progress-circle.overall'), overallProgress);
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(1) .progress-circle'), prelimsGS);
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(2) .progress-circle'), prelimsCSAT);
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(3) .progress-circle'), mainsGS1);
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(4) .progress-circle'), mainsGS2);
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(5) .progress-circle'), mainsGS3);
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(6) .progress-circle'), mainsGS4);

    const optP1Card = dashboard.querySelector('#optional-p1-card');
    const optP2Card = dashboard.querySelector('#optional-p2-card');
    if (optionalSubject && optP1Card && optP2Card) {
        optP1Card.classList.remove('hidden');
        optP2Card.classList.remove('hidden');
        dashboard.querySelector('#optional-subject-name-p1').textContent = optionalSubject.toUpperCase();
        dashboard.querySelector('#optional-subject-name-p2').textContent = optionalSubject.toUpperCase();
        updateCircle(optP1Card.querySelector('.progress-circle'), optionalP1);
        updateCircle(optP2Card.querySelector('.progress-circle'), optionalP2);
    } else if (optP1Card && optP2Card) {
        optP1Card.classList.add('hidden');
        optP2Card.classList.add('hidden');
    }

    const revisionsDue = getDueRevisions(syllabusData).filter(r => r.status === 'due' || r.status === 'overdue');
    if (DOMElements.reminderCount) DOMElements.reminderCount.textContent = revisionsDue.length;
    if (DOMElements.revisionsDueList) {
        if (revisionsDue.length === 0) {
            DOMElements.revisionsDueList.innerHTML = `<p class="text-green-700 font-semibold text-center py-4">🎉 All caught up! No revisions due today.</p>`;
        } else {
            DOMElements.revisionsDueList.innerHTML = revisionsDue.map(r => `
                <div class="flex justify-between items-center p-3 bg-white rounded shadow-sm hover:shadow-md transition">
                    <span class="font-medium text-slate-800 break-words w-4/5">
                        <span class="text-xs text-slate-500 italic mr-2">${r.paper.split('(')[0].trim()}</span>
                        <a href="#" data-action="jump-to-topic" data-id="${r.id}" class="text-blue-600 hover:underline">${r.topicName}</a>
                    </span>
                    <span class="text-right flex-shrink-0">
                        <span class="text-xs font-semibold ${r.status === 'due' ? 'text-orange-500' : 'text-red-500'}">${r.status.toUpperCase()}</span>
                        <span class="block text-sm font-bold text-slate-700">D-${r.days}</span>
                    </span>
                </div>`).join('');
        }
    }

    // Save summary to Firestore
    const currentUser = getCurrentUser();
    const db = getDb();
    const appId = getAppId();
    const firestoreModule = getFirestoreModule();
    if (currentUser && db && appId && firestoreModule?.doc && firestoreModule?.setDoc && firestoreModule?.serverTimestamp) {
        const { doc, setDoc, serverTimestamp } = firestoreModule;
        const summaryDocRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'progress', 'summary');
        setDoc(summaryDocRef, {
            overall: overallProgress || 0, prelimsGS: prelimsGS || 0, prelimsCSAT: prelimsCSAT || 0,
            mainsGS1: mainsGS1 || 0, mainsGS2: mainsGS2 || 0, mainsGS3: mainsGS3 || 0, mainsGS4: mainsGS4 || 0,
            optionalP1: optionalP1 || 0, optionalP2: optionalP2 || 0,
            updatedAt: serverTimestamp()
        }, { merge: true }).catch(err => console.error("Failed to update dashboard summary:", err));
    }
    console.log("Dashboard update complete.");
}


// --- Tab and Syllabus Rendering Functions ---
function activateTab(tabId) {
    console.log("Activating tab:", tabId);
    if (!tabId) { console.error("activateTab called with invalid tabId"); return; }
    DOMElements.tabContents.forEach(content => content.classList.add('hidden'));
    const activeContent = document.getElementById(`tab-${tabId}`);
    if (activeContent) activeContent.classList.remove('hidden');
    else console.error(`Content area not found for tab: ${tabId}`);
    DOMElements.tabButtons.forEach(btn => btn.classList.remove('active'));
    const activeButton = document.querySelector(`button.tab-button[data-tab="${tabId}"]`);
    if (activeButton) activeButton.classList.add('active');
    else console.error(`Button not found for tab: ${tabId}`);

    try {
        if (tabId === 'preliminary') renderSyllabusPrelims();
        else if (tabId === 'mains') renderSyllabusMains('mains-gs1');
        else if (tabId === 'optional') renderOptionalTab();
        else if (tabId === 'dashboard') updateTrackerDashboard();
    } catch (e) {
        console.error(`Error rendering content for tab ${tabId}:`, e);
    }
}

function renderSyllabusPrelims() {
    console.log("Rendering Prelims syllabus...");
    const prelimsRoot = syllabusData.find(s => s?.id === 'prelims');
    const targetUl = DOMElements.prelimsTree;
    if (prelimsRoot && targetUl) {
        renderSyllabus(prelimsRoot.children || [], targetUl, 1);
        console.log("Prelims syllabus rendered.");
    } else {
        if (targetUl) targetUl.innerHTML = '<li><p class="text-red-500">Error loading Prelims syllabus structure.</p></li>';
    }
}

function renderSyllabusMains(paperId) {
    console.log("Rendering Mains syllabus for:", paperId);
    const mainsRoot = syllabusData.find(s => s?.id === 'mains');
    if (!mainsRoot || !Array.isArray(mainsRoot.children)) {
        if (DOMElements.mainsSyllabusTreeContainer) DOMElements.mainsSyllabusTreeContainer.innerHTML = '<p class="text-red-500 p-4">Error loading Mains syllabus structure.</p>';
        return;
    }
    DOMElements.mainsGsTrees.forEach(tree => tree.classList.add('hidden'));
    const targetTree = DOMElements.mainsSyllabusTreeContainer?.querySelector(`ul[data-target-paper="${paperId}"]`);
    if (targetTree) {
        targetTree.classList.remove('hidden');
        const paperData = mainsRoot.children.find(p => p?.id === paperId);
        renderSyllabus(paperData?.children || [], targetTree, 1);
    } else {
        console.error(`Target UL container not found for Mains paper: ${paperId}`);
    }
    DOMElements.mainsGsChipNav?.querySelectorAll('.gs-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.paper === paperId);
    });
}

function renderOptionalTab() {
    console.log("Rendering Optional tab. Current optional:", optionalSubject);
    if (!optionalSubject) {
        DOMElements.optionalSyllabusView?.classList.add('hidden');
        DOMElements.optionalSelectionScreen?.classList.remove('hidden');
        renderOptionalSelectionList();
    } else {
        DOMElements.optionalSelectionScreen?.classList.add('hidden');
        DOMElements.optionalSyllabusView?.classList.remove('hidden');

        const titleSpan = DOMElements.optionalSyllabusTitle?.querySelector('span');
        if (titleSpan) titleSpan.textContent = optionalSubject.toUpperCase();

        const mains = syllabusData.find(s => s?.id === 'mains');
        if (!mains || !Array.isArray(mains.children)) {
            if (DOMElements.optionalSyllabusTreeContainer) DOMElements.optionalSyllabusTreeContainer.innerHTML = '<p class="text-red-500">Error loading syllabus structure.</p>';
            return;
        }

        const optionalPaper1Node = mains.children.find(p => p?.id === 'mains-optional-1');
        const optionalPaper2Node = mains.children.find(p => p?.id === 'mains-optional-2');
        const container = DOMElements.optionalSyllabusTreeContainer;
        if (!container) return;
        container.innerHTML = ''; // Clear previous

        const hasPaper1Data = optionalPaper1Node && Array.isArray(optionalPaper1Node.children) && optionalPaper1Node.children[0]?.id !== 'mains-opt1-placeholder';
        const hasPaper2Data = optionalPaper2Node && Array.isArray(optionalPaper2Node.children) && optionalPaper2Node.children[0]?.id !== 'mains-opt2-placeholder';

        if (hasPaper1Data) {
            const paper1Container = document.createElement('div'); paper1Container.className = 'mb-8 border rounded-lg p-4 bg-slate-50';
            paper1Container.innerHTML = `<h4 class="text-xl font-semibold text-slate-700 mb-4">${optionalPaper1Node.name}</h4>`;
            const listContainer1 = document.createElement('ul'); listContainer1.className = 'syllabus-list space-y-2'; listContainer1.setAttribute('data-target-paper', optionalPaper1Node.id);
            paper1Container.appendChild(listContainer1);
            renderSyllabus(optionalPaper1Node.children, listContainer1, 1);
            container.appendChild(paper1Container);
        } else {
            container.innerHTML += `<div class="mb-4 p-4 bg-slate-50 rounded border"><h4 class="text-xl font-semibold text-slate-700 mb-2">Optional Paper I</h4><p class="text-slate-500">Syllabus not loaded for ${optionalSubject.toUpperCase()}.</p></div>`;
        }

        if (hasPaper2Data) {
            const paper2Container = document.createElement('div'); paper2Container.className = 'mb-8 border rounded-lg p-4 bg-slate-50';
            paper2Container.innerHTML = `<h4 class="text-xl font-semibold text-slate-700 mb-4">${optionalPaper2Node.name}</h4>`;
            const listContainer2 = document.createElement('ul'); listContainer2.className = 'syllabus-list space-y-2'; listContainer2.setAttribute('data-target-paper', optionalPaper2Node.id);
            paper2Container.appendChild(listContainer2);
            renderSyllabus(optionalPaper2Node.children, listContainer2, 1);
            container.appendChild(paper2Container);
        } else {
            container.innerHTML += `<div class="mb-4 p-4 bg-slate-50 rounded border"><h4 class="text-xl font-semibold text-slate-700 mb-2">Optional Paper II</h4><p class="text-slate-500">Syllabus not loaded for ${optionalSubject.toUpperCase()}.</p></div>`;
        }
        console.log("Optional syllabus rendered.");
    }
}

function renderOptionalSelectionList() {
    if (!DOMElements.optionalListContainer) return;
    DOMElements.optionalListContainer.innerHTML = OPTIONAL_SUBJECT_LIST.map(sub => `
        <button class="select-optional-btn bg-white border border-blue-400 text-blue-600 px-4 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow"
            data-action="select-optional" data-subject-id="${sub.id}">
            ${sub.name}
        </button>
    `).join('');
}


// --- AI Integration ---
async function callGeminiAPI(prompt, systemInstruction) {
    if (!GEMINI_API_KEY) { console.error("Gemini API Key is missing."); throw new Error("AI Service configuration error."); }
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.7 }
    };
    try {
        const response = await fetch(GEMINI_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const responseBody = await response.text();
        if (!response.ok) { console.error("Gemini API Error:", response.status, responseBody); let errorMsg = `API request failed: ${response.statusText}`; try { errorMsg = JSON.parse(responseBody)?.error?.message || errorMsg; } catch (_) { } throw new Error(errorMsg); }
        const result = JSON.parse(responseBody);
        if (!result.candidates && result.promptFeedback?.blockReason) { throw new Error(`AI request blocked: ${result.promptFeedback.blockReason}.`); }
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) { const finishReason = result.candidates?.[0]?.finishReason; throw new Error(`AI returned no content. Finish reason: ${finishReason || 'Unknown'}`); }
        return text;
    } catch (error) { console.error("Gemini API call failed:", error); throw new Error(`AI service unavailable: ${error.message}`); }
}

async function handleAIGenerator(itemId, action, topicName) {
    if (!DOMElements.aiResponseModal) return;
    openModal(DOMElements.aiResponseModal);
    if (DOMElements.aiModalTitle) DOMElements.aiModalTitle.textContent = action.replace('ai-', 'AI ').replace(/\b\w/g, l => l.toUpperCase());
    if (DOMElements.aiTopicName) DOMElements.aiTopicName.textContent = topicName;
    if (DOMElements.aiResponseContent) DOMElements.aiResponseContent.innerHTML = `<div class="flex flex-col items-center justify-center h-48 text-center"><i class="fas fa-spinner fa-spin text-blue-600 text-4xl mb-4"></i><p class="text-slate-500">Consulting the AI for a ${action.split('-')[1].toUpperCase()}...</p></div>`;

    let systemPrompt = '', userPrompt = '';
    if (action === 'ai-plan') {
        systemPrompt = `You are an expert UPSC mentor. Generate a concise, actionable, 5-day study plan for the specific UPSC syllabus topic provided. Focus on NCERTs, standard books, PYQs, and logical steps (Day 1 to Day 5). Output using Markdown (lists, bold).`;
        userPrompt = `Generate a 5-day study plan for the UPSC micro-topic: "${topicName}".`;
    } else if (action === 'ai-resources') {
        systemPrompt = `You are an AI research assistant for UPSC prep. Find and summarize 3-5 relevant, recent, and trustworthy external resources (articles, explainers, reports) for the topic. Include URL and brief explanation. Output using Markdown. Prioritize official sources.`;
        userPrompt = `Find 3-5 high-quality, relevant, and recent study resources for the UPSC micro-topic: "${topicName}".`;
    } else if (action === 'ai-pyq') {
        systemPrompt = `You are an expert UPSC examiner. Find 3-5 Previous Year Questions (PYQs) related to the topic. Provide the year if possible, distinguish Prelims/Mains. Output using Markdown (lists, bold).`;
        userPrompt = `Find 3-5 Previous Year Questions (PYQs) for the UPSC micro-topic: "${topicName}". Focus on the last 10 years.`;
    } else {
        if (DOMElements.aiResponseContent) DOMElements.aiResponseContent.innerHTML = `<p class="text-red-500 font-semibold">Error: Unknown AI action requested.</p>`; return;
    }

    try {
        const responseText = await callGeminiAPI(userPrompt, systemPrompt);
        let htmlResponse = responseText
            .replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/^-\s+(.*?)(\n|$)/gm, '<li>$1</li>')
            .replace(/(\<li\>.*?\<\/li\>)/gs, '<ul>$1</ul>')
            .replace(/\n/g, '<br>');
        htmlResponse = htmlResponse.replace(/<\/ul>\s*<ul>/g, '');

        if (DOMElements.aiResponseContent) DOMElements.aiResponseContent.innerHTML = `<div class="p-4 bg-slate-50 rounded-lg text-sm">${htmlResponse}</div>`;
        showNotification(`${action.split('-')[1].toUpperCase()} generated.`);
    } catch (error) {
        console.error(`AI generation failed for ${action}:`, error);
        if (DOMElements.aiResponseContent) DOMElements.aiResponseContent.innerHTML = `<p class="text-red-500 font-semibold p-4">Error generating content: ${error.message}</p>`;
        showNotification(`AI Failed: ${error.message}`, true);
    }
}

// --- Daily Reminder ---
function startDailyReminderCheck() {
    try {
        const today = new Date().toDateString();
        const lastVisited = localStorage.getItem('srsLastVisited');

        if (Array.isArray(syllabusData) && syllabusData.length > 0 && lastVisited !== today) {
            const revisionsDue = getDueRevisions(syllabusData).filter(r => r.status === 'due' || r.status === 'overdue');
            if (revisionsDue.length > 0 && DOMElements.dailyReminderModal) {
                if (DOMElements.reminderCount) DOMElements.reminderCount.textContent = revisionsDue.length;
                if (DOMElements.reminderTopicList) {
                    DOMElements.reminderTopicList.innerHTML = revisionsDue.map(r => `
                        <div class="flex items-center justify-between text-slate-700 py-1 gap-2">
                            <span class="text-sm break-words"> 
                                D-${r.days} (${r.status === 'overdue' ? 'Overdue' : 'Due'}): 
                                <a href="#" data-action="jump-to-topic" data-id="${r.id}" class="text-blue-600 hover:underline ml-1">${r.topicName}</a> 
                            </span>
                            <span class="text-xs flex-shrink-0 ${r.status === 'overdue' ? 'text-red-500 font-semibold' : 'text-orange-500'}"> 
                                ${r.status.toUpperCase()} 
                            </span>
                        </div>`).join('');
                }
                openModal(DOMElements.dailyReminderModal);
            }
            localStorage.setItem('srsLastVisited', today);
        }
    } catch (e) { console.error("Error during daily reminder check:", e); }
}
