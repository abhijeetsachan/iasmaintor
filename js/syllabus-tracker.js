// js/syllabus-tracker.js (Refactored to use auth.js module- new file)

// --- Imports ---
import { GEMINI_API_ENDPOINT } from './firebase-config.js';
import { initAuth } from './auth.js'; // <-- NEW: Import the shared auth module
import { STATUSES, addSRSProperties } from './utils.js';
import { getPrelimsSyllabus } from './syllabus-prelims-data.js';
import { getMainsGS1Syllabus } from './syllabus-mains-gs1-data.js';
import { getMainsGS2Syllabus } from './syllabus-mains-gs2-data.js';
import { getMainsGS3Syllabus } from './syllabus-mains-gs3-data.js';
import { getMainsGS4Syllabus } from './syllabus-mains-gs4-data.js';
import { OPTIONAL_SUBJECT_LIST, getOptionalSyllabusById } from './optional-syllabus-data.js';
import { initChatbot } from './chatbot.js';

// --- Global Constants ---
const REVISION_SCHEDULE = { d1: 1, d3: 3, d7: 7, d21: 21 }; // SRS days

// --- State Variables (Module Scope) ---
let syllabusData = [];
let optionalSubject = null;
let isSyllabusLoading = true;
let srsModalContext = {};
let deferredPrompt = null;
let authServices = {}; // Will hold { db, auth, firestoreModule, etc. }
let unsubscribeOptional = null;

// --- DOM Elements ---
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
    
    // --- Page-Specific Elements (tracker.html) ---
    appContainer: document.getElementById('syllabus-app-container'),
    contentWrapper: document.getElementById('syllabus-content-wrapper'),
    loadingIndicator: document.getElementById('syllabus-loading'),
    saveBtn: document.getElementById('save-syllabus-btn'),
    installPwaBtnDesktop: document.getElementById('install-pwa-btn-desktop'),
    installPwaBtnMobile: document.getElementById('install-pwa-btn-mobile'),
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
    copyrightYear: document.getElementById('copyright-year'),
    
    // --- NEW: Dashboard Progress List for the updated UI ---
    dashboardProgressList: document.getElementById('dashboard-progress-list'),
    
    // --- NEW: Overall Progress Circle (from the updated UI) ---
    overallProgressCircle: document.querySelector('.progress-circle.overall'),
};

// --- PWA: Handle Install Prompt ---
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (DOMElements.installPwaBtnDesktop) {
    DOMElements.installPwaBtnDesktop.classList.remove('hidden');
  }
  if (DOMElements.installPwaBtnMobile) {
    DOMElements.installPwaBtnMobile.classList.remove('hidden');
  }
  console.log("PWA: beforeinstallprompt event fired.");
});

// --- PWA: Handle App Installed ---
window.addEventListener('appinstalled', () => {
  console.log("PWA was installed");
  if (DOMElements.installPwaBtnDesktop) {
    DOMElements.installPwaBtnDesktop.classList.add('hidden');
  }
  if (DOMElements.installPwaBtnMobile) {
    DOMElements.installPwaBtnMobile.classList.add('hidden');
  }
  deferredPrompt = null;
});


// --- Utility Functions (Page-Specific) ---

function showNotification(message, isError = false) {
    const el = document.getElementById('notification');
    const chatbotContainer = document.getElementById('chatbot-container'); // Get chatbot
    if (!el) { console.warn("Notification element not found."); return; }

    el.textContent = message;
    
    // --- FIX START ---
    // Use classList.toggle instead of replacing className
    el.classList.toggle('bg-red-600', isError);
    el.classList.toggle('bg-slate-800', !isError);
    
    // Explicitly remove classes that hide the notification
    el.classList.remove('opacity-0');
    el.classList.remove('pointer-events-none');
    // Add class to show it
    el.classList.add('opacity-100');
    // --- FIX END ---

    if (chatbotContainer) chatbotContainer.classList.add('chatbot-container-lifted'); // LIFT chatbot

    setTimeout(() => {
        if (el) {
            el.classList.remove('opacity-100');
            // --- FIX START ---
            // Add classes back to hide it correctly
            el.classList.add('opacity-0');
            el.classList.add('pointer-events-none');
            // --- FIX END ---
        }
        if (chatbotContainer) chatbotContainer.classList.remove('chatbot-container-lifted'); // LOWER chatbot
    }, 3000);
}

// Initialize Chatbot
initChatbot(showNotification);

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
    const user = authServices.getCurrentUser();
    if (!user || !authServices.db || !authServices.firestoreModule?.doc || !authServices.firestoreModule?.setDoc) {
        console.error("Cannot save topic progress: User not logged in or Firestore unavailable.");
        showNotification("Save failed: Check connection.", true);
        return;
    }
    try {
        const { doc, setDoc } = authServices.firestoreModule;
        const topicDocRef = doc(authServices.db, 'users', user.uid, 'topicProgress', itemId);
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
        const mainsGS1Data = getMainsGS1Syllabus();
        const mainsGS2Data = getMainsGS2Syllabus();
        const mainsGS3Data = getMainsGS3Syllabus();
        const mainsGS4Data = getMainsGS4Syllabus();
        if (!prelimsData || !mainsGS1Data || !mainsGS2Data || !mainsGS3Data || !mainsGS4Data) {
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

/**
 * Helper function to generate the progress bar HTML.
 */
function renderProgressBar(label, value, colorClass) {
    const val = (typeof value === 'number' && !isNaN(value)) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
    return `
        <div>
            <div class="flex justify-between items-center mb-1">
                <span class="text-base font-medium text-slate-700">${label}</span>
                <span class="text-base font-bold ${val === 100 ? 'text-green-600' : 'text-blue-600'}">${val}%</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill ${colorClass}" style="width: ${val}%;"></div>
            </div>
        </div>`;
}

function updateTrackerDashboard() {
    console.log("Updating tracker dashboard (Revised UI)...");
    if (!Array.isArray(syllabusData) || syllabusData.length === 0) {
        console.warn("Syllabus data not available for dashboard update.");
        return;
    }
    
    // --- 1. Calculate All Progress Values ---
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

    // --- 2. Update Overall Progress Circle (Column 1) ---
    const updateCircle = (circleElement, value) => {
        const val = (typeof value === 'number' && !isNaN(value)) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
        if (circleElement) {
            circleElement.style.setProperty('--value', val);
            const valueSpan = circleElement.querySelector('.progress-circle-value');
            if (valueSpan) valueSpan.textContent = `${val}%`;
        }
    };
    updateCircle(DOMElements.overallProgressCircle, overallProgress);


    // --- 3. Render Progress Bar List (Column 2) ---
    let progressListHTML = `
        ${renderProgressBar('Prelims (GS)', prelimsGS, 'bg-orange-500')}
        ${renderProgressBar('Prelims (CSAT)', prelimsCSAT, 'bg-orange-500')}
        ${renderProgressBar('Mains GS Paper 1', mainsGS1, 'bg-indigo-500')}
        ${renderProgressBar('Mains GS Paper 2', mainsGS2, 'bg-indigo-500')}
        ${renderProgressBar('Mains GS Paper 3', mainsGS3, 'bg-indigo-500')}
        ${renderProgressBar('Mains GS Paper 4', mainsGS4, 'bg-indigo-500')}
    `;
    
    if (optionalSubject) {
        const optName = optionalSubject.toUpperCase();
        progressListHTML += renderProgressBar(`Optional ${optName} P-I`, optionalP1, 'bg-pink-600');
        progressListHTML += renderProgressBar(`Optional ${optName} P-II`, optionalP2, 'bg-pink-600');
    }
    
    if (DOMElements.dashboardProgressList) {
        DOMElements.dashboardProgressList.innerHTML = progressListHTML;
    }


    // --- 4. Update Revisions Due List (Column 3) ---
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

    // --- 5. Save Summary to Firestore (Unchanged) ---
    const user = authServices.getCurrentUser();
    const { db, firestoreModule } = authServices;
    if (user && db && firestoreModule?.doc && firestoreModule?.setDoc && firestoreModule?.serverTimestamp) {
        const { doc, setDoc, serverTimestamp } = firestoreModule;
        const summaryDocRef = doc(db, 'artifacts', DOMElements.appContainer?.appId || 'default-app-id', 'users', user.uid, 'progress', 'summary');
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
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.7 }
    };

    try {
        const response = await fetch(GEMINI_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("Backend API Error:", errorBody);
            throw new Error(errorBody.error?.message || `API request failed with status ${response.status}`);
        }
        
        const result = await response.json();

        if (!result.candidates && result.promptFeedback?.blockReason) {
            throw new Error(`AI request blocked: ${result.promptFeedback.blockReason}.`);
        }
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            const finishReason = result.candidates?.[0]?.finishReason;
            throw new Error(`AI returned no content. Finish reason: ${finishReason || 'Unknown'}`);
        }
        return text;

    } catch (error) {
        console.error("Gemini API call failed:", error);
        throw new Error(`AI service unavailable: ${error.message}`);
    }
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
    
    const { db, firestoreModule } = authServices;
    if (!db || !firestoreModule?.doc || !firestoreModule?.onSnapshot || !userId) { 
        console.warn("Firestore not ready for optional listener."); 
        return; 
    }
    
    console.log("Starting optional subject listener for user:", userId);
    const { doc, onSnapshot } = firestoreModule;
    const profileDocRef = doc(db, 'artifacts', DOMElements.appContainer?.appId || 'default-app-id', 'users', userId);
    
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
            if (document.getElementById('tab-optional')?.classList.contains('active')) {
                 renderOptionalTab();
            }
            updateTrackerDashboard();
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

// --- Main Initialization & Entry Point ---
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

    // --- Auth Initialization ---
    const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';
    DOMElements.appContainer.appId = appId; // Store appId for later use

    authServices = await initAuth(DOMElements, appId, showNotification, {
        /**
         * @param {User} user - The Firebase User object.
         */
        onLogin: (user) => {
            console.log("Tracker Page: onLogin callback triggered.");
        
                console.log("User found, triggering syllabus load.");
                loadSyllabusData(user.uid); // This will hide the loader
            }
        },
        /**
         * @param {boolean} authHasChecked - True if this is not the first auth check.
         */
        onLogout: (authHasChecked) => {
            console.log("Tracker Page: onLogout callback triggered.");
            if (unsubscribeOptional) { unsubscribeOptional(); unsubscribeOptional = null; }
            
            isSyllabusLoading = false;
            
            // Show auth error *instead* of "Loading..."
            DOMElements.loadingIndicator.innerHTML = '<p class="text-red-500 p-4">Authentication required. Please log in to view the tracker.</p>';
            DOMElements.loadingIndicator.classList.remove('hidden'); // Ensure it's visible
            DOMElements.contentWrapper.classList.add('hidden');
        }
    });

    // --- loadSyllabusData (Page-Specific Logic) ---
    async function loadSyllabusData(userId) {
        console.log("loadSyllabusData started for user:", userId);
        isSyllabusLoading = true;
        DOMElements.loadingIndicator?.classList.remove('hidden');
        DOMElements.contentWrapper?.classList.add('hidden');
        let loadedStaticData = null;
        let loadedOptionalSubject = null;
        
        const { db, firestoreModule } = authServices;

        try {
            if (!db || !firestoreModule?.doc || !firestoreModule?.getDoc || !firestoreModule?.collection || !firestoreModule?.getDocs) {
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
            return;
        } 
        
        DOMElements.loadingIndicator?.classList.add('hidden');
        DOMElements.contentWrapper?.classList.remove('hidden');
        if(DOMElements.contentWrapper) DOMElements.contentWrapper.classList.add('overflow-y-auto'); 
        
        activateTab('dashboard'); 
        startDailyReminderCheck(); 
        startOptionalSubjectListener(userId); 
    } // End loadSyllabusData


    // --- Page-Specific Event Handling ---
    document.addEventListener('click', function(e) {
        // Close modals if clicking on the backdrop
        const activeModals = document.querySelectorAll('.modal.active');
        activeModals.forEach(modal => { if (modal === e.target) closeModal(modal); });
    });
    
    document.addEventListener('click', async function(e) {
        const target = e.target;
        const targetId = target.id;

        // PWA Install
        if (target.closest('.install-pwa-btn') && deferredPrompt) {
          e.preventDefault();
          if (DOMElements.installPwaBtnDesktop) DOMElements.installPwaBtnDesktop.classList.add('hidden');
          if (DOMElements.installPwaBtnMobile) DOMElements.installPwaBtnMobile.classList.add('hidden');
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          console.log(`User response to the install prompt: ${outcome}`);
          deferredPrompt = null;
          return;
        }

        // --- Modal Close Buttons ---
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
        
        // --- Main Actions (Tabs, Syllabus Clicks) ---
        const actionElement = target.closest('[data-action]');
        const action = actionElement?.dataset.action;
        
        if (!action && !target.classList.contains('tab-button') && !target.classList.contains('gs-chip') && !target.classList.contains('select-optional-btn')) {
            return;
        }
        
        let itemId;
        if (action === 'syllabus-toggle-item') { itemId = target.closest('li.syllabus-item')?.dataset.id; }
        else if (action === 'srs-bar') { itemId = actionElement?.dataset.topicId; }
        else if (action === 'jump-to-topic') { itemId = actionElement?.dataset.id; }
        else if (actionElement) { itemId = actionElement.dataset.id; }
        
        const topicItem = itemId ? findItemById(itemId, syllabusData) : null;
        const topicName = topicItem?.name || 'Topic';

        // --- Tab Navigation ---
        if (target.classList.contains('tab-button') && target.dataset.tab) {
             activateTab(target.dataset.tab); return;
        }
        if (target.classList.contains('gs-chip') && target.dataset.paper) {
             renderSyllabusMains(target.dataset.paper); return;
        }

        // --- Syllabus Item Actions ---
        if (action === 'syllabus-toggle-item') {
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
        }
        else if (action === 'toggle-status' && topicItem && actionElement) {
            e.stopPropagation();
            const currentStatus = topicItem.status;
            let newStatus = STATUSES.NOT_STARTED;
            if (currentStatus === STATUSES.NOT_STARTED) newStatus = STATUSES.IN_PROGRESS;
            else if (currentStatus === STATUSES.IN_PROGRESS) newStatus = STATUSES.COMPLETED;
            
            const isMicroTopic = !Array.isArray(topicItem.children) || topicItem.children.length === 0;
            
            if (isMicroTopic && currentStatus === STATUSES.NOT_STARTED && newStatus === STATUSES.IN_PROGRESS && !topicItem.startDate) {
                // --- Open Start Date Modal ---
                srsModalContext = { itemId, topicName, newStatus };
                if (DOMElements.sdateTopicName) DOMElements.sdateTopicName.textContent = topicName;
                if (DOMElements.startDateInput) DOMElements.startDateInput.valueAsDate = new Date();
                if (DOMElements.startDateModal) openModal(DOMElements.startDateModal);
            } else if (isMicroTopic) {
                // --- Direct Status Toggle (Micro Topic) ---
                 topicItem.status = newStatus;
                 const statusText = newStatus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                 actionElement.textContent = statusText;
                 actionElement.className = `progress-toggle status-${newStatus}-ui flex-shrink-0`;
                 actionElement.setAttribute('data-current-status', newStatus);
                 updateParentStatuses(itemId, document);
                 updateTrackerDashboard();
                 saveTopicProgress(itemId, { 
                     status: topicItem.status, 
                     startDate: topicItem.startDate, 
                     revisions: topicItem.revisions 
                 });
            } else {
                // --- Direct Status Toggle (Parent Topic) ---
                function updateAllChildren(node, status) {
                    if (!node || !Array.isArray(node.children)) return;
                    node.children.forEach(child => {
                        child.status = status;
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
                
                topicItem.status = newStatus;
                updateAllChildren(topicItem, newStatus);
                const statusText = newStatus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                actionElement.textContent = statusText;
                actionElement.className = `progress-toggle status-${newStatus}-ui flex-shrink-0`;
                actionElement.setAttribute('data-current-status', newStatus);
                updateParentStatuses(itemId, document);
                updateTrackerDashboard();
                
                function saveAllChildren(node) {
                    if (!node) return;
                    if (!Array.isArray(node.children) || node.children.length === 0) {
                        saveTopicProgress(node.id, { status: node.status, startDate: node.startDate, revisions: node.revisions });
                        return;
                    }
                    node.children.forEach(saveAllChildren);
                }
                saveAllChildren(topicItem);
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
                     // --- Open Revision Confirm Modal ---
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
             
             let targetTabId = 'dashboard';
             if (itemId.includes('prelims')) targetTabId = 'preliminary';
             else if (itemId.includes('mains-gs')) targetTabId = 'mains';
             else if (itemId.includes('mains-optional') || itemId.includes('mains-opt')) targetTabId = 'optional';
             else if (itemId.includes('mains-essay')) targetTabId = 'mains';
             
             activateTab(targetTabId);
             
             if (targetTabId === 'mains' && itemId.includes('mains-gs')) {
                 const parts = itemId.split('-');
                 if (parts.length >= 3) { 
                     let targetPaperId = `${parts[0]}-${parts[1]}${parts[2]}`; 
                     if (document.querySelector(`[data-paper="${targetPaperId}"]`)) { 
                         renderSyllabusMains(targetPaperId); 
                     } 
                 }
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
            e.preventDefault(); 
            const subjectId = target.dataset.subjectId;
            const user = authServices.getCurrentUser();
            const { db, firestoreModule } = authServices;
            
            if (!user) { showNotification("Please wait for authentication.", true); return; }
            if (!db || !firestoreModule?.doc || !firestoreModule?.setDoc) { showNotification("Database service unavailable.", true); return; }
            
            try {
                const { doc, setDoc } = firestoreModule;
                const profileDocRef = doc(db, 'artifacts', DOMElements.appContainer.appId, 'users', user.uid);
                await setDoc(profileDocRef, 
                    { profile: { optionalSubject: subjectId } }, 
                    { merge: true } 
                );
                showNotification(`Optional set to ${subjectId.toUpperCase()}! Syncing...`);
            } catch (error) { console.error("Error setting optional:", error); showNotification("Failed to save optional choice.", true); }
        }
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
    }); // End Main Click Handler


    // --- Form Submit Listeners (Page-Specific) ---
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
