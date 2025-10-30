// js/syllabus-tracker.js

// --- Imports ---
import { firebaseConfig, GEMINI_API_KEY } from './firebase-config.js';
import { STATUSES, addSRSProperties } from './utils.js';
import { getPrelimsSyllabus } from './syllabus-prelims-data.js';
import { getMainsGS1Syllabus } from './syllabus-mains-gs1-data.js';
import { getMainsGS2Syllabus } from './syllabus-mains-gs2-data.js';
import { getMainsGS3Syllabus } from './syllabus-mains-gs3-data.js';
import { getMainsGS4Syllabus } from './syllabus-mains-gs4-data.js';
import { OPTIONAL_SUBJECT_LIST, getOptionalSyllabusById } from './optional-syllabus-data.js';

// --- ### NEW CHATBOT IMPORT ### ---
import { initChatbot } from './chatbot.js';

// --- ADDED: Firebase SDK Modules (from app.js) ---
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    getDocs, // <-- PREVIOUS FIX
    setDoc,
    onSnapshot,
    collection,
    query,
    orderBy,
    serverTimestamp,
    updateDoc,
    enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";


// --- Global Constants ---
const REVISION_SCHEDULE = { d1: 1, d3: 3, d7: 7, d21: 21 }; // SRS days
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_API_URL_SEARCH = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- State Variables (Module Scope) ---
let syllabusData = [];
let optionalSubject = null;
let isSyllabusLoading = true;
let srsModalContext = {};

// --- ADDED: Auth State Variables (from app.js) ---
let currentUserProfile = null;
let authReady = false;
let firebaseEnabled = false; // Added this flag

// --- Firebase Refs & Utility Placeholders ---
let db, auth;
let firestoreModule = {};
let firebaseAuthModule = {};
let currentUser = null;
let appId = 'default-app-id';
let unsubscribeOptional = null;

// --- DOM Elements (MERGED) ---
const DOMElements = {
    // Syllabus-specific elements
    appContainer: document.getElementById('syllabus-app-container'),
    contentWrapper: document.getElementById('syllabus-content-wrapper'),
    loadingIndicator: document.getElementById('syllabus-loading'),
    saveBtn: document.getElementById('save-syllabus-btn'),
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

    // ADDED: Auth & UI elements (from app.js)
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
    authModal: { modal: document.getElementById('auth-modal'), error: document.getElementById('auth-error'), loginForm: document.getElementById('login-form'), signupForm: document.getElementById('signup-form'), forgotPasswordView: document.getElementById('forgot-password-view'), forgotPasswordForm: document.getElementById('forgot-password-form') },
    accountModal: { modal: document.getElementById('account-modal'), form: document.getElementById('account-form'), error: document.getElementById('account-error') },
    copyrightYear: document.getElementById('copyright-year'),
};


// --- Utility Functions (MERGED) ---

function showNotification(message, isError = false) {
    const el = document.getElementById('notification');
    if (!el) { console.warn("Notification element not found."); return; }
    el.textContent = message;
    el.className = `fixed bottom-5 right-5 px-6 py-3 rounded-lg shadow-lg transition-opacity duration-300 pointer-events-none z-[60] text-white ${isError ? 'bg-red-600' : 'bg-slate-800'} opacity-100`;
    setTimeout(() => { if (el) el.classList.remove('opacity-100'); }, 3000);
}

// --- ### NEW CHATBOT INITIALIZATION ### ---
initChatbot(showNotification); // Initialize the chatbot

function openModal(modal) {
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

function closeModal(modal) {
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

const openAuthModal = (mode = 'login') => {
    if (currentUser && !currentUser.isAnonymous) {
        showNotification("You are already logged in.", false);
        return;
    }
    
    const { modal, loginForm, signupForm, error, forgotPasswordView } = DOMElements.authModal;
    if (!modal || !loginForm || !signupForm || !error || !forgotPasswordView) {
        console.error("Auth modal elements not found");
        return;
    }
    
    error.classList.add('hidden');
    loginForm.reset();
    signupForm.reset();
    DOMElements.authModal.forgotPasswordForm?.reset();

    const loginView = document.getElementById('login-view');
    const signupView = document.getElementById('signup-view');
    
    if (loginView) loginView.classList.toggle('hidden', mode !== 'login');
    if (signupView) signupView.classList.toggle('hidden', mode !== 'signup');
    if (forgotPasswordView) forgotPasswordView.classList.toggle('hidden', mode !== 'forgot');

    openModal(modal);
};

const updateUIForAuthStateChange = (user) => {
    const isLoggedIn = !!user;
    const isAnon = user?.isAnonymous ?? false;
    const isVisibleUser = isLoggedIn && !isAnon;

    DOMElements.authLinks?.classList.toggle('hidden', isVisibleUser);
    DOMElements.userMenu?.classList.toggle('hidden', !isVisibleUser);
    DOMElements.mobileAuthLinks?.classList.toggle('hidden', isVisibleUser);
    DOMElements.mobileUserActions?.classList.toggle('hidden', !isVisibleUser);

    if (isVisibleUser) {
        let displayName = 'User';
        let avatarIconClass = 'fas fa-user text-xl';

        if (currentUserProfile?.firstName) {
            displayName = currentUserProfile.firstName;
        } else if (user.email) {
            const emailName = user.email.split('@')[0];
            displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
        }
        
        if (DOMElements.userGreeting) DOMElements.userGreeting.textContent = `Hi, ${displayName}`;
        if (DOMElements.userAvatar) DOMElements.userAvatar.innerHTML = `<i class="${avatarIconClass}"></i>`;
    } else {
        if (DOMElements.userGreeting) DOMElements.userGreeting.textContent = '';
        if (DOMElements.userAvatar) DOMElements.userAvatar.innerHTML = `<i class="fas fa-user text-xl"></i>`;
    }
    
    DOMElements.mobileMenu?.classList.add('hidden');
};

const fetchUserProfile = async (userId) => {
    // Note: firebaseEnabled is checked in the auth listener
    if (!firestoreModule || !userId || !auth.currentUser || auth.currentUser.isAnonymous) {
        currentUserProfile = null;
        return;
    }
    try {
        const { doc, getDoc } = firestoreModule;
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            currentUserProfile = userDoc.data().profile;
            let displayName = currentUserProfile?.firstName || (currentUser?.email ? currentUser.email.split('@')[0].charAt(0).toUpperCase() + currentUser.email.split('@')[0].slice(1) : 'User');
            if (DOMElements.userGreeting) DOMElements.userGreeting.textContent = `Hi, ${displayName}`;
        } else {
            console.warn("Tracker Page: User doc not found:", userId);
            currentUserProfile = null;
            if (DOMElements.userGreeting) DOMElements.userGreeting.textContent = `Hi, ${currentUser?.email ? currentUser.email.split('@')[0].charAt(0).toUpperCase() + currentUser.email.split('@')[0].slice(1) : 'User'}`;
        }
    } catch (error) {
        console.error("Tracker Page: Error fetching profile:", error);
        currentUserProfile = null;
    }
};

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function saveTopicProgress(itemId, progressData) {
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


// --- Syllabus Assembly ---
function assembleDefaultSyllabus() {
    console.log("Assembling default syllabus...");
    try {
        const prelimsData = getPrelimsSyllabus();
        const mainsGS1Data = getMainsGS1Syllabus(); // This is where the error occurs
        const mainsGS2Data = getMainsGS2Syllabus();
        const mainsGS3Data = getMainsGS3Syllabus();
        const mainsGS4Data = getMainsGS4Syllabus();

        if (!prelimsData || !mainsGS1Data || !mainsGS2Data || !mainsGS3Data || !mainsGS4Data) {
            console.error("One or more syllabus data modules failed to load.", {
                prelimsData: !!prelimsData,
                mainsGS1Data: !!mainsGS1Data,
                mainsGS2Data: !!mainsGS2Data,
                mainsGS3Data: !!mainsGS3Data,
                mainsGS4Data: !!mainsGS4Data,
            });
            throw new Error("One or more syllabus data modules failed to return data.");
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
                { id: 'mains-optional-1', name: 'Optional Subject Paper-I', status: STATUSES.NOT_STARTED, children: [optionalPlaceholder1]},
                { id: 'mains-optional-2', name: 'Optional Subject Paper-II', status: STATUSES.NOT_STARTED, children: [optionalPlaceholder2]},
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


// --- Syllabus Data Traversal & Manipulation ---
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
    if (!childElement) {
        return;
     }

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
        console.log(`updateParentStatuses: Changing parent ${parentId} status from ${parentItem.status} to ${newParentStatus}`);
        parentItem.status = newParentStatus;
        const parentToggle = parentLi.querySelector(`.progress-toggle[data-id="${parentId}"]`);
        if (parentToggle) {
             const statusText = newParentStatus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
             parentToggle.textContent = statusText;
             parentToggle.className = `progress-toggle status-${newParentStatus}-ui flex-shrink-0`;
             parentToggle.setAttribute('data-current-status', newParentStatus);
        } else {
            console.warn("Could not find parent toggle button UI element for ID:", parentId);
        }
        updateParentStatuses(parentId, containerElement);
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


// --- SRS Logic & Rendering ---
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
    if (!item || !item.id) return '<span class="text-xs text-red-500">Error rendering SRS</span>';

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

            html += `<span class="revision-dot ${statusClass}"
                            data-day="${dayKey}"
                            data-status="${status}"
                            title="${titleText}">
                        <span class="text-xs font-bold text-white leading-none">${day}</span>
                    </span>`;
        });
    }
    html += `</div>`;
    return html;
}


// --- Syllabus Rendering (Mobile-Optimized) ---
function createSyllabusItemHTML(item, level) {
    if (!item || !item.id || !item.name) return '';
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;
    const isMicroTopic = !hasChildren;
    const currentStatus = item.status || STATUSES.NOT_STARTED;
    const itemId = item.id;
    const itemName = item.name;
    const statusText = currentStatus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    let controlsHTML = '';
    if (isMicroTopic) {
        controlsHTML = `
            <div class="flex flex-col items-start gap-2 lg:flex-row lg:items-center lg:space-x-3 text-sm flex-shrink-0">
                ${createSRSBarHTML(item)}
                <div class="flex flex-wrap gap-1 flex-shrink-0">
                    <button class="ai-button bg-blue-100 text-blue-800 hover:bg-blue-200" data-id="${itemId}" data-action="ai-plan">AI Plan</button>
                    <button class="ai-button bg-purple-100 text-purple-800 hover:bg-purple-200" data-id="${itemId}" data-action="ai-resources">Resources</button>
                    <button class="ai-button bg-rose-100 text-rose-800 hover:bg-rose-200" data-id="${itemId}" data-action="ai-pyq">PYQs</button>
                </div>
            </div>`;
    }

    const progressToggle = `
        <button class="progress-toggle status-${currentStatus}-ui flex-shrink-0"
            data-id="${itemId}"
            data-action="toggle-status"
            data-current-status="${currentStatus}"
            data-is-micro-topic="${isMicroTopic}">
            ${statusText}
        </button>`;

    return `
        <li class="syllabus-item level-${level} ${isMicroTopic ? 'is-micro-topic' : ''}" data-id="${itemId}">
            <div class="syllabus-item-content-wrapper" data-action="syllabus-toggle-item" data-has-children="${hasChildren}">
                <div class="flex items-center w-full flex-grow min-w-0">
                    <span class="syllabus-toggle ${hasChildren ? '' : 'invisible'} flex-shrink-0 mr-2"></span>
                    <span class="syllabus-label mr-4 break-words">${itemName}</span>
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
    const validItems = items.filter(item => item && item.id && item.name);

    validItems.forEach(item => {
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
                    } else {
                        console.warn("Child UL container not found for item:", item.id);
                    }
                 }
             } else {
                  console.error("Failed to create list item element for:", item.id, itemHTML);
             }
        } catch (renderError) {
             console.error("Error rendering item:", item.id, renderError);
             const errorLi = document.createElement('li');
             errorLi.className = 'text-red-500 p-2';
             errorLi.textContent = `Error rendering topic: ${item.name || item.id}`;
             fragment.appendChild(errorLi);
        }
    });
    container.appendChild(fragment);
}


// --- Dashboard & Progress Calculation ---
function calculateOverallProgress(nodes) {
    if (!Array.isArray(nodes)) {
        console.warn("calculateOverallProgress received invalid input:", nodes);
        return 0;
     }
    let totalMicroTopics = 0;
    let completedMicroTopics = 0;
    function traverse(items) {
        if (!Array.isArray(items)) return;
        items.forEach(item => {
            if (!item) return;
            if (!Array.isArray(item.children) || item.children.length === 0) {
                totalMicroTopics++;
                if (item.status === STATUSES.COMPLETED) {
                    completedMicroTopics++;
                }
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
    console.log("Updating tracker dashboard (Creative)...");
    if (!Array.isArray(syllabusData) || syllabusData.length === 0) {
        console.warn("Syllabus data not available for dashboard update.");
        return;
    }

    const prelimsNode = syllabusData.find(s => s?.id === 'prelims');
    const mainsNode = syllabusData.find(s => s?.id === 'mains');
    const prelimsChildren = Array.isArray(prelimsNode?.children) ? prelimsNode.children : [];
    const mainsChildren = Array.isArray(mainsNode?.children) ? mainsNode.children : [];

    const overallProgress = calculateOverallProgress(syllabusData);
    const prelimsGSNode = prelimsChildren.find(p => p?.id === 'prelims-gs1');
    const prelimsGS = calculateOverallProgress(prelimsGSNode?.children);
    const prelimsCSATNode = prelimsChildren.find(p => p?.id === 'prelims-csat');
    const prelimsCSAT = calculateOverallProgress(prelimsCSATNode?.children);
    const mainsGS1Node = mainsChildren.find(p => p?.id === 'mains-gs1');
    const mainsGS1 = calculateOverallProgress(mainsGS1Node?.children);
    const mainsGS2Node = mainsChildren.find(p => p?.id === 'mains-gs2');
    const mainsGS2 = calculateOverallProgress(mainsGS2Node?.children);
    const mainsGS3Node = mainsChildren.find(p => p?.id === 'mains-gs3');
    const mainsGS3 = calculateOverallProgress(mainsGS3Node?.children);
    const mainsGS4Node = mainsChildren.find(p => p?.id === 'mains-gs4');
    const mainsGS4 = calculateOverallProgress(mainsGS4Node?.children);
    const optionalP1Node = mainsChildren.find(p => p?.id === 'mains-optional-1');
    const optionalP1 = calculateOverallProgress(optionalP1Node?.children);
    const optionalP2Node = mainsChildren.find(p => p?.id === 'mains-optional-2');
    const optionalP2 = calculateOverallProgress(optionalP2Node?.children);

    const updateCircle = (circleElement, value) => {
        const val = (typeof value === 'number' && !isNaN(value)) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
        if (circleElement) {
            circleElement.style.setProperty('--value', val);
            const valueSpan = circleElement.querySelector('.progress-circle-value');
            if (valueSpan) valueSpan.textContent = `${val}%`;
        }
    };

    const dashboard = document.getElementById('tab-dashboard');
    if (!dashboard) {
        console.error("Dashboard tab container not found!");
        return;
    }

    updateCircle(dashboard.querySelector('.progress-circle.overall'), overallProgress);

    // --- ### FIX for Dashboard Bug ### ---
    // Selectors changed from (2), (3), (4)... to (1), (2), (3)...
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(1) .progress-circle'), prelimsGS);
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(2) .progress-circle'), prelimsCSAT);
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(3) .progress-circle'), mainsGS1);
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(4) .progress-circle'), mainsGS2);
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(5) .progress-circle'), mainsGS3);
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(6) .progress-circle'), mainsGS4);
    // --- ### END FIX ### ---

    const optP1Card = dashboard.querySelector('#optional-p1-card');
    const optP2Card = dashboard.querySelector('#optional-p2-card');
    const optSubjectNameP1 = dashboard.querySelector('#optional-subject-name-p1');
    const optSubjectNameP2 = dashboard.querySelector('#optional-subject-name-p2');

    if (optionalSubject && optP1Card && optP2Card) {
        optP1Card.classList.remove('hidden');
        optP2Card.classList.remove('hidden');
        if (optSubjectNameP1) optSubjectNameP1.textContent = optionalSubject.toUpperCase();
        if (optSubjectNameP2) optSubjectNameP2.textContent = optionalSubject.toUpperCase();
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
            DOMElements.revisionsDueList.innerHTML = revisionsDue.map(r => {
                let paperShortName = r.paper || 'Topic';
                if (paperShortName.includes('GS Paper')) paperShortName = paperShortName.split('(')[0].trim();
                else if (paperShortName.includes('Optional')) paperShortName = paperShortName.split('(')[0].trim() + ` (${optionalSubject?.toUpperCase() || '?'}) ${paperShortName.includes('P-I') ? 'P1' : 'P2'}`;
                return `
                <div class="flex justify-between items-center p-3 bg-white rounded shadow-sm hover:shadow-md transition">
                    <span class="font-medium text-slate-800 break-words w-4/5">
                        <span class="text-xs text-slate-500 italic mr-2">${paperShortName}</span>
                        <a href="#" data-action="jump-to-topic" data-id="${r.id}" class="text-blue-600 hover:underline">${r.topicName}</a>
                    </span>
                    <span class="text-right flex-shrink-0">
                        <span class="text-xs font-semibold ${r.status === 'due' ? 'text-orange-500' : 'text-red-500'}">
                           ${r.status === 'due' ? 'DUE TODAY' : 'OVERDUE'}
                        </span>
                        <span class="block text-sm font-bold text-slate-700">D-${r.days}</span>
                    </span>
                </div>`;
            }).join('');
        }
    } else {
        console.error("Revisions due list container not found!");
    }

    if (currentUser && db && firestoreModule?.doc && firestoreModule?.setDoc && firestoreModule?.serverTimestamp) {
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
        if (activeContent) activeContent.innerHTML = `<p class="text-red-500 p-4">Error loading content for this section.</p>`;
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
        console.error("Prelims data or target UL element not found.", {prelimsRoot, targetUl});
        if(targetUl) targetUl.innerHTML = '<li><p class="text-red-500">Error loading Prelims syllabus structure.</p></li>';
    }
}

function renderSyllabusMains(paperId) {
    console.log("Rendering Mains syllabus for:", paperId);
    const mainsRoot = syllabusData.find(s => s?.id === 'mains');
    if (!mainsRoot || !Array.isArray(mainsRoot.children)) {
        console.error("Mains syllabus root data not found or invalid.");
        if(DOMElements.mainsSyllabusTreeContainer) DOMElements.mainsSyllabusTreeContainer.innerHTML = '<p class="text-red-500 p-4">Error loading Mains syllabus structure.</p>';
        return;
    }

    DOMElements.mainsGsTrees.forEach(tree => tree.classList.add('hidden'));
    const targetTree = DOMElements.mainsSyllabusTreeContainer?.querySelector(`ul[data-target-paper="${paperId}"]`);

    if (targetTree) {
        targetTree.classList.remove('hidden');
        const paperData = mainsRoot.children.find(p => p?.id === paperId);
        renderSyllabus(paperData?.children || [], targetTree, 1);
        if (!paperData || !paperData.children || paperData.children.length === 0) {
             console.warn(`Data not found or empty for Mains paper: ${paperId}`);
             targetTree.innerHTML = `<li><p class="text-slate-500">No syllabus details found for ${paperId}.</p></li>`;
        } else {
            console.log("Mains syllabus rendered for:", paperId);
        }
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
        if(titleSpan) titleSpan.textContent = optionalSubject.toUpperCase();

        const mains = syllabusData.find(s => s?.id === 'mains');
        if (!mains || !Array.isArray(mains.children)) {
             console.error("Mains node not found or invalid for optional render.");
             if(DOMElements.optionalSyllabusTreeContainer) DOMElements.optionalSyllabusTreeContainer.innerHTML = '<p class="text-red-500">Error loading syllabus structure.</p>';
             return;
        }

        const optionalPaper1Node = mains.children.find(p => p?.id === 'mains-optional-1');
        const optionalPaper2Node = mains.children.find(p => p?.id === 'mains-optional-2');

        const container = DOMElements.optionalSyllabusTreeContainer;
        if (!container) return;
        container.innerHTML = '';

        const hasPaper1Data = optionalPaper1Node && Array.isArray(optionalPaper1Node.children) && optionalPaper1Node.children.length > 0 && optionalPaper1Node.children[0]?.id !== 'mains-opt1-placeholder';
        const hasPaper2Data = optionalPaper2Node && Array.isArray(optionalPaper2Node.children) && optionalPaper2Node.children.length > 0 && optionalPaper2Node.children[0]?.id !== 'mains-opt2-placeholder';

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
    if(!DOMElements.optionalListContainer) return;
    DOMElements.optionalListContainer.innerHTML = OPTIONAL_SUBJECT_LIST.map(sub => `
        <button class="select-optional-btn bg-white border border-blue-400 text-blue-600 px-4 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow"
            data-subject-id="${sub.id}">
            ${sub.name}
        </button>
    `).join('');
}


// --- AI Integration ---
async function callGeminiAPI(prompt, systemInstruction, useSearch = false) {
    if (!GEMINI_API_KEY) { console.error("Gemini API Key is missing."); throw new Error("AI Service configuration error."); }
    const API_URL_TO_USE = GEMINI_API_URL;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        tools: useSearch ? [{ google_search_retrieval: {} }] : [],
        generationConfig: { temperature: 0.7 }
    };
    try {
        const response = await fetch(API_URL_TO_USE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const responseBody = await response.text();
        if (!response.ok) { console.error("Gemini API Error:", response.status, responseBody); let errorMsg = `API request failed: ${response.statusText}`; try { errorMsg = JSON.parse(responseBody)?.error?.message || errorMsg; } catch (_) {} throw new Error(errorMsg); }
        const result = JSON.parse(responseBody);
        if (!result.candidates && result.promptFeedback?.blockReason) { throw new Error(`AI request blocked: ${result.promptFeedback.blockReason}.`); }
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) { const finishReason = result.candidates?.[0]?.finishReason; throw new Error(`AI returned no content. Finish reason: ${finishReason || 'Unknown'}`); }
        return text;
    } catch (error) { console.error("Gemini API call failed:", error); throw new Error(`AI service unavailable: ${error.message}`); }
}

async function handleAIGenerator(itemId, action, topicName) {
    if(!DOMElements.aiResponseModal) return;
    openModal(DOMElements.aiResponseModal);
    if(DOMElements.aiModalTitle) DOMElements.aiModalTitle.textContent = action.replace('ai-', 'AI ').replace(/\b\w/g, l => l.toUpperCase());
    if(DOMElements.aiTopicName) DOMElements.aiTopicName.textContent = topicName;
    if(DOMElements.aiResponseContent) DOMElements.aiResponseContent.innerHTML = `<div class="flex flex-col items-center justify-center h-48 text-center"><i class="fas fa-spinner fa-spin text-blue-600 text-4xl mb-4"></i><p class="text-slate-500">Consulting the AI for a ${action.split('-')[1].toUpperCase()}...</p></div>`;

    let systemPrompt = '', userPrompt = '', useSearch = false;
     if (action === 'ai-plan') {
        systemPrompt = `You are an expert UPSC mentor. Generate a concise, actionable, 5-day study plan for the specific UPSC syllabus topic provided. Focus on NCERTs, standard books, PYQs, and logical steps (Day 1 to Day 5). Output using Markdown (lists, bold).`;
        userPrompt = `Generate a 5-day study plan for the UPSC micro-topic: "${topicName}".`;
    } else if (action === 'ai-resources') {
        systemPrompt = `You are an AI research assistant for UPSC prep. Find and summarize 3-5 relevant, recent, and trustworthy external resources (articles, explainers, reports) for the topic. Include URL and brief explanation. Output using Markdown. If using search, prioritize official sources.`;
        userPrompt = `Find 3-5 high-quality, relevant, and recent study resources for the UPSC micro-topic: "${topicName}".`;
    } else if (action === 'ai-pyq') {
        systemPrompt = `You are an expert UPSC examiner. Find 3-5 Previous Year Questions (PYQs) related to the topic. Provide the year if possible, distinguish Prelims/Mains. Use reliable UPSC source references if possible. Output using Markdown (lists, bold).`;
        userPrompt = `Find 3-5 Previous Year Questions (PYQs) for the UPSC micro-topic: "${topicName}". Focus on the last 10 years.`;
    } else {
         if(DOMElements.aiResponseContent) DOMElements.aiResponseContent.innerHTML = `<p class="text-red-500 font-semibold">Error: Unknown AI action requested.</p>`; return;
    }

    try {
        const responseText = await callGeminiAPI(userPrompt, systemPrompt, useSearch);
        let htmlResponse = responseText
            .replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/^-\s+(.*?)(\n|$)/gm, '<li>$1</li>')
            .replace(/(\<li\>.*?\<\/li\>)/gs, '<ul>$1</ul>')
            .replace(/\n/g, '<br>');
         htmlResponse = htmlResponse.replace(/<\/ul>\s*<ul>/g, '');

        if(DOMElements.aiResponseContent) DOMElements.aiResponseContent.innerHTML = `<div class="p-4 bg-slate-50 rounded-lg text-sm">${htmlResponse}</div>`;
        showNotification(`${action.split('-')[1].toUpperCase()} generated.`);
    } catch (error) {
        console.error(`AI generation failed for ${action}:`, error);
        if(DOMElements.aiResponseContent) DOMElements.aiResponseContent.innerHTML = `<p class="text-red-500 font-semibold p-4">Error generating content: ${error.message}</p>`;
        showNotification(`AI Failed: ${error.message}`, true);
    }
}


// --- Firebase & Persistence ---
function startOptionalSubjectListener(userId) {
    if (unsubscribeOptional) { unsubscribeOptional(); unsubscribeOptional = null; }
    if (!db || !firestoreModule?.doc || !firestoreModule?.onSnapshot || !userId) { console.warn("Firestore not ready for optional listener."); return; }
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

            if (oldOptional) {
                const mains = syllabusData.find(s => s?.id === 'mains');
                if (mains?.children) {
                    const opt1 = mains.children.find(p => p?.id === 'mains-optional-1');
                    const opt2 = mains.children.find(p => p?.id === 'mains-optional-2');
                    const placeholder1 = addSRSProperties({ id: 'mains-opt1-placeholder', name: 'Select your optional subject', status: STATUSES.NOT_STARTED });
                    const placeholder2 = addSRSProperties({ id: 'mains-opt2-placeholder', name: 'Select your optional subject', status: STATUSES.NOT_STARTED });
                    if (opt1) Object.assign(opt1, { name: 'Optional Subject Paper-I', status: STATUSES.NOT_STARTED, children: [placeholder1]});
                    if (opt2) Object.assign(opt2, { name: 'Optional Subject Paper-II', status: STATUSES.NOT_STARTED, children: [placeholder2]});
                }
            }
            if (newOptional) {
                updateOptionalSyllabusData(syllabusData);
            }
            // Re-render *if* the optional tab is active, otherwise dashboard will update
            if (document.getElementById('tab-optional')?.classList.contains('active')) {
                 renderOptionalTab();
            }
            updateTrackerDashboard(); // Also update dashboard totals
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
    } else if (mainsOpt1) {
         console.warn("Optional Paper 1 node exists, but no data found for:", optionalSubject);
         Object.assign(mainsOpt1, { name: 'Optional Subject Paper-I', status: STATUSES.NOT_STARTED, children: [addSRSProperties({ id: 'mains-opt1-placeholder', name: 'Select your optional subject', status: STATUSES.NOT_STARTED })]});
    }

     if (mainsOpt2 && paper2) {
        Object.assign(mainsOpt2, paper2);
        mainsOpt2.name = `Optional (${optionalSubject.toUpperCase()}) P-II`;
         console.log("Optional Paper 2 data integrated.");
    } else if (mainsOpt2) {
         console.warn("Optional Paper 2 node exists, but no data found for:", optionalSubject);
         Object.assign(mainsOpt2, { name: 'Optional Subject Paper-II', status: STATUSES.NOT_STARTED, children: [addSRSProperties({ id: 'mains-opt2-placeholder', name: 'Select your optional subject', status: STATUSES.NOT_STARTED })]});
    }
}

// --- Main Initialization & Entry Point (MERGED) ---
document.addEventListener('DOMContentLoaded', async function() {
    console.log("DOM Content Loaded. Initializing Tracker...");
    
    if (DOMElements.copyrightYear) {
        DOMElements.copyrightYear.textContent = new Date().getFullYear();
    }

    // Initial UI state
    DOMElements.loadingIndicator?.classList.remove('hidden');
    DOMElements.contentWrapper?.classList.add('hidden');
    if(DOMElements.saveBtn) {
        DOMElements.saveBtn.disabled = true;
        DOMElements.saveBtn.style.display = 'none';
    }

    // --- Firebase Initialization (from app.js) ---
    try {
        const firebaseConfigFromGlobal = typeof window.__firebase_config !== 'undefined' ? window.__firebase_config : firebaseConfig;
        appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';
        console.log("Using appId:", appId);

        if (!firebaseConfigFromGlobal?.apiKey) { throw new Error("Firebase configuration is missing or invalid."); }

        const app = getApps().length ? getApp() : initializeApp(firebaseConfigFromGlobal);
        db = getFirestore(app);
        auth = getAuth(app);
        firebaseEnabled = true;

        // Store module references
        Object.assign(firestoreModule, {
            getFirestore, doc, getDoc, getDocs, // <-- PREVIOUS FIX
            setDoc, onSnapshot, collection, query, orderBy, serverTimestamp, updateDoc, enableIndexedDbPersistence
        });
        Object.assign(firebaseAuthModule, {
            getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut
        });

        await firestoreModule.enableIndexedDbPersistence(db).catch(e => console.warn("Firestore Persistence failed:", e.code));
        console.log("Firebase Initialized. Setting up Auth Listener...");

        // --- MERGED Auth State Listener ---
        firebaseAuthModule.onAuthStateChanged(auth, async (user) => {
             console.log("Tracker Page: Auth state changed. User:", user ? user.uid : 'null');
             
             if (user?.uid !== currentUser?.uid) {
                currentUser = user;
                const userId = user?.uid;

                if (user && !user.isAnonymous) {
                    await fetchUserProfile(userId);
                    
                    if (isSyllabusLoading) {
                        console.log("User found, triggering syllabus load.");
                        loadSyllabusData(user.uid); // This will hide the loader
                    }
                } else {
                    currentUserProfile = null;
                    if (unsubscribeOptional) { unsubscribeOptional(); unsubscribeOptional = null; }
                    
                    isSyllabusLoading = false;
                    console.error("User logged out or authentication required.");
                    // Show auth error *instead* of "Loading..."
                    DOMElements.loadingIndicator.innerHTML = '<p class="text-red-500 p-4">Authentication required. Please log in to view the tracker.</p>';
                    DOMElements.loadingIndicator.classList.remove('hidden'); // Ensure it's visible
                    DOMElements.contentWrapper.classList.add('hidden');
                }
                
                updateUIForAuthStateChange(user);

                if (!authReady) {
                    authReady = true;
                    console.log("Tracker Page: Auth Ready.");
                }
             } else if (!user) {
                 // Handle case where user was already null and is still null
                 DOMElements.loadingIndicator.innerHTML = '<p class="text-red-500 p-4">Authentication required. Please log in to view the tracker.</p>';
                 DOMElements.loadingIndicator.classList.remove('hidden');
                 DOMElements.contentWrapper.classList.add('hidden');
                 updateUIForAuthStateChange(null);
             }
        });

    } catch (error) {
         console.error("Firebase Initialization Failed:", error);
         showNotification("Error: Core services failed to load.", true);
         DOMElements.loadingIndicator.innerHTML = `<p class="text-red-500 p-4">Error: Services failed to initialize: ${error.message}</p>`;
         DOMElements.loadingIndicator.classList.remove('hidden');
         isSyllabusLoading = false;
         firebaseEnabled = false;
         updateUIForAuthStateChange(null); // Show login button even on fail
         return;
    }

    // --- loadSyllabusData ---
    async function loadSyllabusData(userId) {
        console.log("loadSyllabusData started for user:", userId);
        isSyllabusLoading = false;

        // Keep loader visible
        DOMElements.loadingIndicator?.classList.remove('hidden');
        DOMElements.contentWrapper?.classList.add('hidden');

        let loadedStaticData = null;
        let loadedOptionalSubject = null;

        try {
            if (!firestoreModule?.doc || !firestoreModule?.getDoc || !firestoreModule?.collection || !firestoreModule?.getDocs) {
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
            loadedStaticData = assembleDefaultSyllabus(); // This is where the file error happens
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
            // This error is likely due to the corrupted file
            DOMElements.loadingIndicator.innerHTML = `<p class="text-red-500 p-4">A critical error occurred loading syllabus data. Please check console.</p>`;
            DOMElements.loadingIndicator.classList.remove('hidden'); // Ensure loader shows error
            DOMElements.contentWrapper.classList.add('hidden');
            return; // Stop execution
        } 
        
        // This 'finally' block is now only reached on SUCCESS
        DOMElements.loadingIndicator?.classList.add('hidden'); // Hide loader
        DOMElements.contentWrapper?.classList.remove('hidden'); // Show content
        if(DOMElements.contentWrapper) DOMElements.contentWrapper.classList.add('overflow-y-auto'); 
        activateTab('dashboard'); 
        startDailyReminderCheck(); 
        startOptionalSubjectListener(userId); 
        
    } // End loadSyllabusData


    // --- Event Handling (MERGED) ---

    document.addEventListener('click', function(e) {
        const activeModals = document.querySelectorAll('.modal.active');
        activeModals.forEach(modal => { if (modal === e.target) closeModal(modal); });
    });

    document.addEventListener('click', async function(e) {
        const target = e.target;
        const targetId = target.id;
        
        // --- Auth & UI Click Handlers ---
        if (!target.closest('#user-menu')) { 
            if (DOMElements.userDropdown) DOMElements.userDropdown.classList.add('hidden'); 
        }
        if (target.closest('#login-btn') || targetId === 'mobile-login-btn') {
             e.preventDefault(); 
             openAuthModal('login'); 
             return;
        }
        if (targetId === 'close-auth-modal') { 
            closeModal(DOMElements.authModal.modal); 
            return;
        }
        if (targetId === 'auth-switch-to-signup') {
            openAuthModal('signup'); 
            return;
        }
        if (targetId === 'auth-switch-to-login' || targetId === 'auth-switch-to-login-from-reset') {
            openAuthModal('login'); 
            return;
        }
        if (targetId === 'forgot-password-btn') { 
            openAuthModal('forgot'); // Use 'forgot' mode
            return;
        }
        if (targetId === 'close-account-modal') {
            closeModal(DOMElements.accountModal.modal); 
            return;
        }
        if (target.closest('#dropdown-logout-btn') || targetId === 'mobile-logout-btn') { 
             if (firebaseEnabled && firebaseAuthModule && auth) {
                 try { 
                     await firebaseAuthModule.signOut(auth); 
                     showNotification('Logged out.'); 
                 }
                 catch (error) { 
                     showNotification('Logout failed.', true); 
                     console.error("Logout error:", error); 
                 }
             } else { 
                 showNotification('Cannot log out: Service unavailable.', true); 
             }
             return;
        }
        if (target.closest('#my-account-btn') || targetId === 'mobile-my-account-btn') {
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
            return;
        }
        if (target.closest('#user-menu-button')) { 
            DOMElements.userDropdown?.classList.toggle('hidden'); 
            return;
        }
         if (target.closest('#mobile-menu-button')) { 
             DOMElements.mobileMenu?.classList.toggle('hidden'); 
             return;
         }

        // --- Syllabus Click Handlers ---
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
             if(DOMElements.dailyReminderModal) closeModal(DOMElements.dailyReminderModal);
             if (target.id === 'go-to-dashboard-btn') activateTab('dashboard');
             return;
        }

        const actionElement = target.closest('[data-action]');
        const action = actionElement?.dataset.action;

        // --- ### FIX for Button Bug ### ---
        // This check now allows clicks with a 'data-action' OR specific IDs to pass through.
        if (!action && !target.classList.contains('tab-button') && !target.classList.contains('gs-chip') && !target.classList.contains('select-optional-btn')) {
            return;
        }

        let itemId;
        let itemElement = target.closest('[data-id], [data-topic-id]');

        if (action === 'syllabus-toggle-item') { itemId = target.closest('li.syllabus-item')?.dataset.id; }
        else if (action === 'srs-bar') { itemId = actionElement?.dataset.topicId; }
        else if (action === 'jump-to-topic') { itemId = actionElement?.dataset.id; }
        else if (actionElement) { itemId = actionElement.dataset.id; }

        const topicItem = itemId ? findItemById(itemId, syllabusData) : null;
        const topicName = topicItem?.name || 'Topic';

        if (target.classList.contains('tab-button') && target.dataset.tab) {
             activateTab(target.dataset.tab); return;
        }
        if (target.classList.contains('gs-chip') && target.dataset.paper) {
             renderSyllabusMains(target.dataset.paper); return;
        }
        if (action === 'syllabus-toggle-item') {
            if (!target.closest('.progress-toggle, .ai-button, .revision-dot, .select-optional-btn')) {
                const wrapper = actionElement;
                const parentLi = wrapper?.closest('li.syllabus-item');
                const childUl = parentLi?.querySelector(':scope > ul.syllabus-list');
                
                // --- ### FIX for Expand Bug ### ---
                const toggleIcon = wrapper?.querySelector('.syllabus-toggle');
                // --- ### END FIX ### ---

                const hasChildren = wrapper?.dataset.hasChildren === 'true';

                if (childUl && toggleIcon && hasChildren) {
                    const isExpanded = childUl.style.display !== 'none';
                    childUl.style.display = isExpanded ? 'none' : 'block';
                    toggleIcon.classList.toggle('expanded', !isExpanded);
                    e.stopPropagation();
                }
            }
        }
        else if (action === 'toggle-status' && topicItem && actionElement) {
            e.stopPropagation();
            const currentStatus = topicItem.status;
            let newStatus = STATUSES.NOT_STARTED;
            if (currentStatus === STATUSES.NOT_STARTED) newStatus = STATUSES.IN_PROGRESS;
            else if (currentStatus === STATUSES.IN_PROGRESS) newStatus = STATUSES.COMPLETED;

            const isMicroTopic = !Array.isArray(topicItem.children) || topicItem.children.length === 0;

            if (isMicroTopic && currentStatus === STATUSES.NOT_STARTED && newStatus === STATUSES.IN_PROGRESS && !topicItem.startDate) {
                srsModalContext = { itemId, topicName, newStatus };
                if (DOMElements.sdateTopicName) DOMElements.sdateTopicName.textContent = topicName;
                if (DOMElements.startDateInput) DOMElements.startDateInput.valueAsDate = new Date();
                if (DOMElements.startDateModal) openModal(DOMElements.startDateModal);
            } else if (isMicroTopic) {
                 // This is a MICRO topic
                 topicItem.status = newStatus;
                 const statusText = newStatus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                 actionElement.textContent = statusText;
                 actionElement.className = `progress-toggle status-${newStatus}-ui flex-shrink-0`;
                 actionElement.setAttribute('data-current-status', newStatus);
                 updateParentStatuses(itemId, document);
                 updateTrackerDashboard(); // <-- Dashboard update
                 
                 saveTopicProgress(itemId, { 
                     status: topicItem.status, 
                     startDate: topicItem.startDate, 
                     revisions: topicItem.revisions 
                 });
            } else {
                // --- ### FIX for Dashboard Bug ### ---
                // This is a PARENT topic
                const parentLi = actionElement.closest('li.syllabus-item');

                function updateAllChildren(node, status) {
                    if (!node || !Array.isArray(node.children)) return;
                    
                    node.children.forEach(child => {
                        child.status = status;
                        
                        // Find the DOM element for the child and update it
                        // Use document.querySelector for a global search, as childLi might be in a different part of the DOM tree (e.g., in prelims vs mains)
                        // A safer way is to find the childLi within the specific tree container
                        const childLi = document.querySelector(`li[data-id="${child.id}"]`);
                        if (childLi) {
                            const toggleButton = childLi.querySelector(`button[data-action="toggle-status"]`);
                            if (toggleButton) {
                                const childStatusText = status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                toggleButton.textContent = childStatusText;
                                toggleButton.className = `progress-toggle status-${status}-ui flex-shrink-0`;
                                toggleButton.setAttribute('data-current-status', status);
                            }
                        } else {
                            console.warn(`Could not find childLi DOM element for ${child.id}`);
                        }
                        
                        if (child.children && child.children.length > 0) {
                            updateAllChildren(child, status);
                        }
                    });
                }
                
                // Update data model and DOM for all children
                topicItem.status = newStatus;
                updateAllChildren(topicItem, newStatus);
                
                // Update this parent's button UI
                const statusText = newStatus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                actionElement.textContent = statusText;
                actionElement.className = `progress-toggle status-${newStatus}-ui flex-shrink-0`;
                actionElement.setAttribute('data-current-status', newStatus);
                
                updateParentStatuses(itemId, document);
                updateTrackerDashboard(); // <-- Dashboard update
                
                // Save all children (only save micro-topics)
                function saveAllChildren(node) {
                    if (!node) return;
                    if (!Array.isArray(node.children) || node.children.length === 0) {
                        // This is a micro-topic, save it
                        saveTopicProgress(node.id, { status: node.status, startDate: node.startDate, revisions: node.revisions });
                        return;
                    }
                    // This is a parent, recurse
                    node.children.forEach(saveAllChildren);
                }
                saveAllChildren(topicItem);
                // --- ### END FIX ### ---
            }
        }
         else if (action === 'srs-bar' && target.classList.contains('revision-dot')) {
             e.stopPropagation();
             const dotEl = target;
             const srsContainer = dotEl.closest('.srs-bar-container');
             const dotItemId = srsContainer?.dataset.topicId;
             const dotTopicItem = dotItemId ? findItemById(dotItemId, syllabusData) : null;

             if (dotTopicItem) {
                 const status = dotEl.dataset.status;
                 const dayKey = dotEl.dataset.day;

                 if ((status === 'due' || status === 'overdue') && dotTopicItem.revisions && dayKey) {
                     srsModalContext = { itemId: dotItemId, topicName: dotTopicItem.name, dayKey };
                     if(DOMElements.confirmTopicName) DOMElements.confirmTopicName.textContent = dotTopicItem.name;
                     if(DOMElements.confirmRevisionDay) DOMElements.confirmRevisionDay.textContent = dayKey.toUpperCase();
                     if(DOMElements.confirmRevisionModal) openModal(DOMElements.confirmRevisionModal);
                 }
                 else if (status === 'done') { showNotification("Revision already marked as done.", false); }
                 else if (status === 'pending') {
                     const days = REVISION_SCHEDULE[dayKey];
                     if (dotTopicItem.startDate && days) {
                         const { date: revDate } = getRevisionStatus(dotTopicItem.startDate, days, false);
                         if(revDate) showNotification(`Revision pending. Due: ${revDate.toLocaleDateString()}`, false);
                         else showNotification("Revision pending (error calculating date).", true);
                     } else { showNotification("Revision pending (start date missing).", true); }
                 }
             } else { console.warn("Could not find topic data for SRS dot click."); }
         }
        else if (action?.startsWith('ai-') && topicItem && actionElement) {
            e.stopPropagation();
            handleAIGenerator(itemId, action, topicName);
        }
        else if (action === 'jump-to-topic' && itemId) {
             e.preventDefault();
             const topic = findItemById(itemId, syllabusData);
             if (!topic) { console.error("Jump-to-topic: Topic not found:", itemId); return; }

             let targetTabId = 'dashboard'; let targetPaperId = null;
             if (itemId.includes('prelims')) targetTabId = 'preliminary';
             else if (itemId.includes('mains-gs')) targetTabId = 'mains';
             else if (itemId.includes('mains-optional') || itemId.includes('mains-opt')) targetTabId = 'optional';
             else if (itemId.includes('mains-essay')) targetTabId = 'mains';

             activateTab(targetTabId);

             if (targetTabId === 'mains' && itemId.includes('mains-gs')) {
                 const parts = itemId.split('-');
                 if (parts.length >= 3) { targetPaperId = `${parts[0]}-${parts[1]}${parts[2]}`; if (document.querySelector(`[data-paper="${targetPaperId}"]`)) { renderSyllabusMains(targetPaperId); } }
             }
             
             setTimeout(() => {
                 const targetEl = document.querySelector(`li[data-id="${itemId}"]`);
                 if (targetEl) {
                     let current = targetEl.parentElement?.closest('li.syllabus-item');
                     while (current) {
                         const ul = current.querySelector(':scope > ul.syllabus-list');
                         const toggle = current.querySelector(':scope > .syllabus-item-content-wrapper > .syllabus-toggle');
                         if (ul && ul.style.display === 'none') ul.style.display = 'block';
                         if (toggle && !toggle.classList.contains('expanded')) toggle.classList.add('expanded');
                         current = current.parentElement?.closest('li.syllabus-item');
                     }
                     targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                     targetEl.style.transition = 'background-color 0s'; targetEl.style.backgroundColor = '#fef3c7';
                     setTimeout(() => { if (targetEl) { targetEl.style.transition = 'background-color 0.8s ease-out'; targetEl.style.backgroundColor = ''; }}, 800);
                 } else { console.warn("Jump target element not found:", itemId); }
             }, 300);
         }
        else if (target.classList.contains('select-optional-btn') && target.dataset.subjectId) {
            e.preventDefault(); const subjectId = target.dataset.subjectId;
            if (!currentUser) { showNotification("Please wait for authentication.", true); return; }
            if (!firestoreModule?.doc || !firestoreModule?.setDoc) { showNotification("Database service unavailable.", true); return; }
            try {
                const { doc, setDoc } = firestoreModule;
                const profileDocRef = doc(db, 'artifacts', appId, 'users', currentUser.uid);
                // Use setDoc with merge:true to create or update
                await setDoc(profileDocRef, 
                    { profile: { optionalSubject: subjectId } }, 
                    { merge: true } 
                );
                showNotification(`Optional set to ${subjectId.toUpperCase()}! Syncing...`);
            } catch (error) { console.error("Error setting optional:", error); showNotification("Failed to save optional choice.", true); }
        }
        // --- ### FIX for "Yes, Confirm" Button ### ---
        else if (action === 'confirm-revision') {
            e.preventDefault(); 
            const { itemId: revItemId, dayKey: revDayKey } = srsModalContext; 
            const itemToRevise = revItemId ? findItemById(revItemId, syllabusData) : null;
            
            if (itemToRevise?.revisions && revDayKey) {
                itemToRevise.revisions[revDayKey] = true;
                if (revDayKey === 'd21') { 
                    itemToRevise.status = STATUSES.COMPLETED; 
                    updateParentStatuses(revItemId, document); 
                }
                showNotification(`Revision ${revDayKey.toUpperCase()} confirmed!`);
                closeModal(DOMElements.confirmRevisionModal); 
                srsModalContext = {};
                
                const listItem = document.querySelector(`li[data-id="${revItemId}"]`);
                if (listItem) {
                     const srsBarDiv = listItem.querySelector(`.srs-bar-container[data-topic-id="${revItemId}"]`);
                     if (srsBarDiv) srsBarDiv.outerHTML = createSRSBarHTML(itemToRevise);
                     if (revDayKey === 'd21') {
                         const toggleButton = listItem.querySelector(`button[data-action="toggle-status"]`);
                         if (toggleButton) {
                             const newStatus = STATUSES.COMPLETED; const statusText = newStatus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                             toggleButton.textContent = statusText; toggleButton.className = `progress-toggle status-${newStatus}-ui flex-shrink-0`; toggleButton.setAttribute('data-current-status', newStatus);
                         }
                     }
                 }
                updateTrackerDashboard(); // <-- Dashboard update
                
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
        // --- ### END FIX ### ---

    }); // End Main Click Handler


    // --- Form Submit Listeners (MERGED) ---

    DOMElements.startDateForm?.addEventListener('submit', function(e) {
        e.preventDefault();
        const dateString = DOMElements.startDateInput.value;
        const { itemId: srsItemId, newStatus: srsNewStatus } = srsModalContext;
        const itemToStart = srsItemId ? findItemById(srsItemId, syllabusData) : null;

        if (itemToStart && dateString && srsNewStatus) {
            itemToStart.startDate = dateString;
            itemToStart.status = srsNewStatus;

            showNotification(`Tracking started from ${new Date(dateString+'T00:00:00').toLocaleDateString()}.`);
            closeModal(DOMElements.startDateModal); srsModalContext = {};

            const listItem = document.querySelector(`li[data-id="${srsItemId}"]`);
            if (listItem) {
                 const toggleButton = listItem.querySelector(`button[data-action="toggle-status"]`);
                 if(toggleButton) {
                     const statusText = srsNewStatus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                     toggleButton.textContent = statusText; toggleButton.className = `progress-toggle status-${srsNewStatus}-ui flex-shrink-0`; toggleButton.setAttribute('data-current-status', srsNewStatus);
                 }
                 const srsBarDiv = listItem.querySelector(`.srs-bar-container[data-topic-id="${srsItemId}"]`);
                 if (srsBarDiv) srsBarDiv.outerHTML = createSRSBarHTML(itemToStart);
            } else { console.warn("Could not find list item to update SRS UI after setting start date:", srsItemId); }

            updateParentStatuses(srsItemId, document);
            updateTrackerDashboard(); // <-- Dashboard update
            
            saveTopicProgress(srsItemId, {
                status: itemToStart.status,
                startDate: itemToStart.startDate,
                revisions: itemToStart.revisions
            });
        } else { showNotification("Please select a valid date.", true); console.error("Start date submit failed:", srsModalContext, itemToStart, dateString); }
    });
    
    // --- ADDED: Auth Form Submit Listeners (from app.js) ---
    DOMElements.authModal.loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        if (!firebaseEnabled || !firebaseAuthModule || !auth) {
            showNotification("Auth service not ready.", true);
            return;
        }
        const email = e.target.elements['login-email'].value, password = e.target.elements['login-password'].value;
        const errorEl = DOMElements.authModal.error; if(errorEl) errorEl.classList.add('hidden');
        try {
            await firebaseAuthModule.signInWithEmailAndPassword(auth, email, password);
            closeModal(DOMElements.authModal.modal); 
            showNotification("Logged in!");
            // No page reload needed, onAuthStateChanged will trigger data load
        } catch(error){ 
             console.error("Login error:", error.code); 
             if(errorEl){
                 let msg = "Login failed. Invalid credentials or network error.";
                 if (error.code.includes('auth/invalid-credential') || error.code.includes('auth/wrong-password')) msg = "Invalid email or password.";
                 else if (error.code.includes('auth/user-not-found')) msg = "No user found with this email.";
                 errorEl.textContent = msg; 
                 errorEl.classList.remove('hidden');
             } 
        }
    });
    
    DOMElements.authModal.signupForm?.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        if (!firebaseEnabled || !firebaseAuthModule || !firestoreModule || !auth) {
            showNotification("Auth service not ready.", true);
            return;
        }
        const firstName = e.target.elements['signup-first-name'].value, lastName = e.target.elements['signup-last-name'].value, email = e.target.elements['signup-email'].value, password = e.target.elements['signup-password'].value;
        const errorEl = DOMElements.authModal.error; if(errorEl) errorEl.classList.add('hidden');
        try {
            const userCred = await firebaseAuthModule.createUserWithEmailAndPassword(auth, email, password); 
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
            showNotification("You must be logged in to update account.", true); 
            return; 
        } 
        if (!firebaseEnabled || !firestoreModule) return;
        
        const firstName = e.target.elements['account-first-name'].value, lastName = e.target.elements['account-last-name'].value;
        const errorEl = DOMElements.accountModal.error; if(errorEl) errorEl.classList.add('hidden');
        
        const { doc, updateDoc } = firestoreModule; 
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
        
        try {
            await updateDoc(userDocRef, { 'profile.firstName': firstName, 'profile.lastName': lastName }); 
            showNotification('Account updated!');
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
        if (!firebaseEnabled || !firebaseAuthModule || !auth) {
            showNotification("Auth service not ready.", true);
            return;
        }
        const email = e.target.elements['reset-email'].value; 
        const errorEl = DOMElements.authModal.error; if(errorEl) errorEl.classList.add('hidden');
        try { 
            await firebaseAuthModule.sendPasswordResetEmail(auth, email); 
            showNotification('Password reset email sent.'); 
            openAuthModal('login'); 
        }
        catch(error){ 
            console.error("PW Reset error:", error.code); 
            if(errorEl){
                errorEl.textContent="Reset failed. Check if email is correct."; 
                errorEl.classList.remove('hidden');
            } 
        }
    });


    // --- Daily Reminder Check (Mobile-Optimized) ---
     function startDailyReminderCheck() {
         try {
             const today = new Date().toDateString();
             const lastVisited = localStorage.getItem('srsLastVisited');

             if (Array.isArray(syllabusData) && syllabusData.length > 0 && lastVisited !== today) {
                 const revisionsDue = getDueRevisions(syllabusData).filter(r => r.status === 'due' || r.status === 'overdue');
                 if (revisionsDue.length > 0 && DOMElements.dailyReminderModal) {
                     if(DOMElements.reminderCount) DOMElements.reminderCount.textContent = revisionsDue.length;
                     if(DOMElements.reminderTopicList) {
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
         } catch(e) { console.error("Error during daily reminder check:", e); }
    }

}); // End DOMContentLoaded
