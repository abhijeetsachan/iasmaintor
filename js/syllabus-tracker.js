// js/syllabus-tracker.js

// --- Imports ---
import { firebaseConfig, GEMINI_API_KEY } from './firebase-config.js';
// Assuming the latest 'minimalist' utils.js is used
import { STATUSES, addSRSProperties } from './utils.js';
import { getPrelimsSyllabus } from './syllabus-prelims-data.js';
import { getMainsGS1Syllabus } from './syllabus-mains-gs1-data.js';
import { getMainsGS2Syllabus } from './syllabus-mains-gs2-data.js';
import { getMainsGS3Syllabus } from './syllabus-mains-gs3-data.js';
import { getMainsGS4Syllabus } from './syllabus-mains-gs4-data.js';
import { OPTIONAL_SUBJECT_LIST, getOptionalSyllabusById } from './optional-syllabus-data.js';

// --- Global Constants ---
const REVISION_SCHEDULE = { d1: 1, d3: 3, d7: 7, d21: 21 }; // SRS days
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`; // Standardized model
const GEMINI_API_URL_SEARCH = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`; // Potentially different endpoint if needed

// --- State Variables (Module Scope) ---
let syllabusData = []; // Full hierarchical data - Will be assembled
let optionalSubject = null; // User's selected optional subject ID
let isSyllabusLoading = true; // Flag to prevent multiple load triggers
let srsModalContext = {}; // Stores context for SRS modals (start date, confirm revision)

// --- Firebase Refs & Utility Placeholders ---
let db, auth; // Firebase services
let firestoreModule = {}; // To hold imported Firestore functions
let firebaseAuthModule = {}; // To hold imported Auth functions
let currentUser = null; // Holds the current authenticated user object
let appId = 'default-app-id'; // Application ID, potentially passed from index.html
let unsubscribeOptional = null; // Firestore listener for optional subject changes

// --- DOM Elements ---
// Caching references to frequently used DOM elements for performance
const DOMElements = {
    appContainer: document.getElementById('syllabus-app-container'),
    contentWrapper: document.getElementById('syllabus-content-wrapper'),
    loadingIndicator: document.getElementById('syllabus-loading'),
    saveBtn: document.getElementById('save-syllabus-btn'),
    tabButtons: document.querySelectorAll('.tab-button'),
    tabContents: document.querySelectorAll('.tab-content'),
    dashboardProgressBars: document.getElementById('dashboard-progress-bars'), // Note: ID kept for compatibility, but function targets circles now
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
    // Quick Start elements removed
};


// --- Utility Functions ---

/**
 * Shows a temporary notification message at the bottom right.
 * @param {string} message The message to display.
 * @param {boolean} [isError=false] If true, shows an error style.
 */
function showNotification(message, isError = false) {
    const el = document.getElementById('notification');
    if (!el) { console.warn("Notification element not found."); return; }
    el.textContent = message;
    el.className = `fixed bottom-5 right-5 px-6 py-3 rounded-lg shadow-lg transition-opacity duration-300 pointer-events-none z-[60] text-white ${isError ? 'bg-red-600' : 'bg-slate-800'} opacity-100`;
    setTimeout(() => { if (el) el.classList.remove('opacity-100'); }, 3000);
}

/**
 * Opens a modal dialog with animation.
 * @param {HTMLElement} modal The modal element to open.
 */
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

/**
 * Closes a modal dialog with animation.
 * @param {HTMLElement} modal The modal element to close.
 */
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

/**
 * Creates a debounced version of a function.
 * @param {Function} func The function to debounce.
 * @param {number} wait The debounce delay in milliseconds.
 * @returns {Function} The debounced function.
 */
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

/**
 * Saves the progress for a single micro-topic to Firestore.
 * @param {string} itemId The ID of the topic to save.
 * @param {object} progressData The data to save { status, startDate, revisions }
 */
async function saveTopicProgress(itemId, progressData) {
    const userId = currentUser?.uid;
    if (!userId || !db || !firestoreModule?.doc || !firestoreModule?.setDoc) {
        console.error("Cannot save topic progress: User not logged in or Firestore unavailable.");
        showNotification("Save failed: Check connection.", true);
        return;
    }

    try {
        const { doc, setDoc } = firestoreModule;
        // Path: users/{userId}/topicProgress/{itemId}
        const topicDocRef = doc(db, 'users', userId, 'topicProgress', itemId);
        
        // We use setDoc with merge:true to only update these fields
        // Any 'undefined' values will be skipped by 'merge:true' if not in the object,
        // but it's safer to pass a clean object.
        const cleanData = {
            status: progressData.status,
            startDate: progressData.startDate || null, // Ensure null instead of undefined
            revisions: progressData.revisions || { d1: false, d3: false, d7: false, d21: false } // Ensure valid object
        };

        await setDoc(topicDocRef, cleanData, { merge: true });
        console.log(`Progress saved for topic: ${itemId}`);
    } catch (error) {
        console.error(`Error saving progress for ${itemId}:`, error);
        showNotification(`Save failed for topic ${itemId}.`, true);
    }
}


// --- Syllabus Assembly ---

/**
 * Assembles the default syllabus structure by combining data from imported modules.
 * Ensures leaf nodes have SRS properties added via addSRSProperties.
 * @returns {Array} The assembled syllabus data structure or an empty array on critical failure.
 */
function assembleDefaultSyllabus() {
    console.log("Assembling default syllabus...");
    try {
        // Get raw data (which calls addSRSProperties internally now)
        const prelimsData = getPrelimsSyllabus();
        const mainsGS1Data = getMainsGS1Syllabus();
        const mainsGS2Data = getMainsGS2Syllabus();
        const mainsGS3Data = getMainsGS3Syllabus();
        const mainsGS4Data = getMainsGS4Syllabus();

        if (!prelimsData || !mainsGS1Data || !mainsGS2Data || !mainsGS3Data || !mainsGS4Data) {
            throw new Error("One or more syllabus data modules failed to return data.");
        }

        // Define the Essay section structure (process leaf nodes here)
        const essaySection = addSRSProperties({ // Process the whole section object
             id: 'mains-essay', name: 'Essay', status: STATUSES.NOT_STARTED, children: [
                { id: 'mains-essay-practice', name: 'Essay Writing Practice & Structure', status: STATUSES.NOT_STARTED }, // Leaf node
                { id: 'mains-essay-philosophical', name: 'Philosophical/Abstract Themes', status: STATUSES.NOT_STARTED }, // Leaf node
                { id: 'mains-essay-socio-political', name: 'Socio-Political Themes', status: STATUSES.NOT_STARTED }, // Leaf node
                { id: 'mains-essay-economic', name: 'Economic/Developmental Themes', status: STATUSES.NOT_STARTED }, // Leaf node
                { id: 'mains-essay-scitech-env', name: 'Sci-Tech/Environment Themes', status: STATUSES.NOT_STARTED }, // Leaf node
             ]
        });

        // Define placeholder structures for Optional papers (process leaf nodes here)
        const optionalPlaceholder1 = addSRSProperties({ id: 'mains-opt1-placeholder', name: 'Select your optional subject', status: STATUSES.NOT_STARTED });
        const optionalPlaceholder2 = addSRSProperties({ id: 'mains-opt2-placeholder', name: 'Select your optional subject', status: STATUSES.NOT_STARTED });

        // Assemble the Mains section
        const mainsData = addSRSProperties({ // Process the Mains section itself
            id: 'mains', name: 'Mains', status: STATUSES.NOT_STARTED, children: [
                essaySection,
                mainsGS1Data, mainsGS2Data, mainsGS3Data, mainsGS4Data,
                { id: 'mains-optional-1', name: 'Optional Subject Paper-I', status: STATUSES.NOT_STARTED, children: [optionalPlaceholder1]},
                { id: 'mains-optional-2', name: 'Optional Subject Paper-II', status: STATUSES.NOT_STARTED, children: [optionalPlaceholder2]},
            ]
        });

        // Combine Prelims and Mains
        const fullSyllabus = [prelimsData, mainsData].filter(Boolean); // Filter nulls just in case

        console.log("Default syllabus assembled successfully.");
        // Return a deep copy to prevent mutation issues later
        return JSON.parse(JSON.stringify(fullSyllabus));

    } catch (error) {
        console.error("FATAL: Error assembling default syllabus:", error);
        showNotification("Critical error: Could not build syllabus structure.", true);
        return []; // Return empty on critical failure
    }
}


// --- Syllabus Data Traversal & Manipulation ---

/**
 * Finds a syllabus item by its ID within a nested structure.
 * @param {string} id The ID of the item to find.
 * @param {Array} nodes The array of nodes to search within.
 * @returns {object | null} The found item or null if not found.
 */
function findItemById(id, nodes) {
    if (!id || !Array.isArray(nodes)) return null;
    for (const node of nodes) {
        if (!node) continue;
        if (node.id === id) return node;
        // Recursively search children if they exist and form an array
        if (Array.isArray(node.children)) {
            const found = findItemById(id, node.children);
            if (found) return found;
        }
    }
    return null;
}

/**
 * Updates the status of parent items based on the status of their children.
 * @param {string} childId The ID of the child item that was updated.
 * @param {HTMLElement} [containerElement=document] The container element to search within for UI updates.
 */
function updateParentStatuses(childId, containerElement = document) {
    if (!childId || !containerElement) return;
    const childElement = containerElement.querySelector(`li[data-id="${childId}"]`);
    if (!childElement) {
        // console.warn(`updateParentStatuses: Could not find child element for ID: ${childId}`);
        return;
     }

    // Find the parent LI element
    const parentLi = childElement.closest('ul.syllabus-list')?.closest('li.syllabus-item');
    const parentId = parentLi?.dataset.id;
    if (!parentId) return; // Reached top level or invalid structure

    const parentItem = findItemById(parentId, syllabusData); // Find parent in data
    if (!parentItem || !Array.isArray(parentItem.children) || parentItem.children.length === 0) return;

    // Calculate new parent status based on children
    const validChildren = parentItem.children.filter(c => c && c.status);
    if (validChildren.length === 0) return; // No valid children to determine status

    // *** Diagnostic Log ***
    const childrenStatuses = validChildren.map(c => ({id: c.id, status: c.status }));
    // console.log(`updateParentStatuses (Parent ID: ${parentId}): Evaluating children statuses:`, childrenStatuses);
    // *** End Log ***

    let newParentStatus;
    if (validChildren.every(c => c.status === STATUSES.COMPLETED)) {
        newParentStatus = STATUSES.COMPLETED;
    } else if (validChildren.some(c => c.status === STATUSES.IN_PROGRESS || c.status === STATUSES.COMPLETED)) {
        newParentStatus = STATUSES.IN_PROGRESS;
    } else {
        newParentStatus = STATUSES.NOT_STARTED;
    }

    // Update data and UI only if status changed
    if (parentItem.status !== newParentStatus) {
        console.log(`updateParentStatuses: Changing parent ${parentId} status from ${parentItem.status} to ${newParentStatus}`); // Log status change
        parentItem.status = newParentStatus;
        // Update the specific UI button for the parent
        const parentToggle = parentLi.querySelector(`.progress-toggle[data-id="${parentId}"]`);
        if (parentToggle) {
             const statusText = newParentStatus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
             parentToggle.textContent = statusText;
             parentToggle.className = `progress-toggle status-${newParentStatus}-ui flex-shrink-0`; // Reset classes
             parentToggle.setAttribute('data-current-status', newParentStatus);
        } else {
            console.warn("Could not find parent toggle button UI element for ID:", parentId);
        }
        // Recurse upwards
        updateParentStatuses(parentId, containerElement);
    } else {
        // console.log(`updateParentStatuses: Parent ${parentId} status (${parentItem.status}) unchanged.`); // Optional log
    }
}


// --- SRS Logic & Rendering ---

/**
 * Calculates the revision status (pending, due, overdue, done) for a given schedule.
 * @param {string | null} startDate The start date string (YYYY-MM-DD) or null.
 * @param {number} days The number of days for this revision interval (e.g., 1, 3, 7, 21).
 * @param {boolean} isDone Whether this specific revision interval has been marked complete.
 * @returns {object} An object containing the status (string) and the calculated revision date (Date or null).
 */
function getRevisionStatus(startDate, days, isDone) {
    if (!startDate) return { status: 'pending', date: null };
    if (isDone) return { status: 'done', date: null };

    try {
        const start = new Date(startDate + 'T00:00:00'); // Ensure parsed as local date
        if (isNaN(start)) throw new Error("Invalid start date format");
        const revisionDate = new Date(start);
        revisionDate.setDate(start.getDate() + days);

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize today's date
        revisionDate.setHours(0, 0, 0, 0); // Normalize revision date

        if (revisionDate > today) return { status: 'pending', date: revisionDate };
        if (revisionDate.getTime() === today.getTime()) return { status: 'due', date: revisionDate };
        return { status: 'overdue', date: revisionDate };
    } catch (e) {
        console.error("Error calculating revision status:", e, { startDate, days, isDone });
        return { status: 'pending', date: null }; // Fallback on error
    }
}

/**
 * Creates the HTML for the Spaced Repetition System (SRS) dots bar.
 * @param {object} item The syllabus item (must be a micro-topic with startDate and revisions properties).
 * @returns {string} The HTML string for the SRS bar.
 */
function createSRSBarHTML(item) {
    if (!item || !item.id) return '<span class="text-xs text-red-500">Error rendering SRS</span>';

    const days = [1, 3, 7, 21];
    const revisions = item.revisions || {}; // Ensure revisions object exists
    let html = `<div class="flex items-center space-x-1 srs-bar-container" data-topic-id="${item.id}" data-action="srs-bar">`;

    if (!item.startDate) {
        html += `<span class="text-xs text-slate-400 italic">SRS not started</span>`;
    } else {
        days.forEach(day => {
            const dayKey = `d${day}`;
            const isDone = revisions[dayKey] === true; // Check completion status
            const { status } = getRevisionStatus(item.startDate, day, isDone);
            const statusClass = `dot-${status}`; // CSS class based on status
            const titleText = `${day}-day revision (${status.toUpperCase()})`; // Tooltip text

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


// --- Syllabus Rendering ---

/**
 * Creates the HTML string for a single syllabus list item (LI).
 * @param {object} item The syllabus item data.
 * @param {number} level The current nesting level (for styling).
 * @returns {string} The HTML string for the list item.
 */
function createSyllabusItemHTML(item, level) {
    if (!item || !item.id || !item.name) return ''; // Basic validation
    // Determine if the item has children based on the children array
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;
    const isMicroTopic = !hasChildren;
    const currentStatus = item.status || STATUSES.NOT_STARTED;
    const itemId = item.id;
    const itemName = item.name;
    const statusText = currentStatus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Generate controls (SRS bar, AI buttons) only for micro-topics
    let controlsHTML = '';
    if (isMicroTopic) {
        // MODIFIED: AI buttons are now flex-wrap, and the outer container stacks on mobile
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

    // Generate the status toggle button
    const progressToggle = `
        <button class="progress-toggle status-${currentStatus}-ui flex-shrink-0"
            data-id="${itemId}"
            data-action="toggle-status"
            data-current-status="${currentStatus}"
            data-is-micro-topic="${isMicroTopic}">
            ${statusText}
        </button>`;

    // --- MODIFIED HTML STRUCTURE ---
    // The wrapper is now flex-col md:flex-row.
    // The label and controls are grouped into responsive containers.
    return `
        <li class="syllabus-item level-${level} ${isMicroTopic ? 'is-micro-topic' : ''}" data-id="${itemId}">
            
            <div class="syllabus-item-content-wrapper" data-action="syllabus-toggle-item" data-has-children="${hasChildren}">
                
                <div class="flex items-center w-full flex-grow min-w-0"> <span class="syllabus-toggle ${hasChildren ? '' : 'invisible'} flex-shrink-0 mr-2"></span>
                    <span class="syllabus-label mr-4 break-words">${itemName}</span> </div>

                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 w-full md:w-auto flex-shrink-0">
                    ${controlsHTML}
                    ${progressToggle}
                </div>
            </div>
            ${hasChildren ? `<ul class="syllabus-list" style="display: none;"></ul>` : ''}
        </li>`;
}


/**
 * Renders the syllabus structure into a given container element.
 * @param {Array} items The array of syllabus items to render.
 * @param {HTMLElement} container The UL element to render into.
 * @param {number} level The starting nesting level.
 */
function renderSyllabus(items, container, level) {
    if (!container) { console.error("Render target container not found."); return; }
    container.innerHTML = ''; // Clear previous content

    if (!Array.isArray(items) || items.length === 0) {
        if (level === 1) container.innerHTML = '<li class="p-2 text-slate-500">No syllabus topics found for this section.</li>';
        return;
    }

    const fragment = document.createDocumentFragment();
    const validItems = items.filter(item => item && item.id && item.name); // Filter out invalid items

    validItems.forEach(item => {
        try {
            const itemHTML = createSyllabusItemHTML(item, level);
            const template = document.createElement('template');
            template.innerHTML = itemHTML.trim();
            const listItem = template.content.firstChild;

            if (listItem instanceof HTMLElement) {
                 fragment.appendChild(listItem);
                 // Recursively render children if they exist
                 if (Array.isArray(item.children) && item.children.length > 0) {
                    const newContainer = listItem.querySelector(':scope > ul.syllabus-list'); // Direct child UL
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
             // Log error and render an error message in the UI for this item
             console.error("Error rendering item:", item.id, renderError);
             const errorLi = document.createElement('li');
             errorLi.className = 'text-red-500 p-2';
             errorLi.textContent = `Error rendering topic: ${item.name || item.id}`;
             fragment.appendChild(errorLi);
        }
    });
    container.appendChild(fragment); // Append all items at once for better performance
}


// --- Dashboard & Progress Calculation ---

/**
 * Calculates the overall percentage completion based on micro-topic status.
 * @param {Array} nodes The array of syllabus nodes to calculate progress for.
 * @returns {number} The completion percentage (0-100).
 */
function calculateOverallProgress(nodes) {
    if (!Array.isArray(nodes)) {
        console.warn("calculateOverallProgress received invalid input:", nodes);
        return 0;
     }
    let totalMicroTopics = 0;
    let completedMicroTopics = 0;
    // Recursive function to traverse the syllabus tree
    function traverse(items) {
        if (!Array.isArray(items)) return;
        items.forEach(item => {
            if (!item) return; // Skip invalid items
            // Check if it's a leaf node (no children or empty children array)
            if (!Array.isArray(item.children) || item.children.length === 0) {
                totalMicroTopics++;
                // *** Diagnostic Log ***
                if (item.status === STATUSES.COMPLETED) {
                    // console.log(`calculateOverallProgress: Found COMPLETED leaf node: ${item.id}`); // Keep if needed
                    completedMicroTopics++;
                } else {
                     // Optional: Log other statuses too for comparison
                     // console.log(`calculateOverallProgress: Found leaf node (${item.id}) with status: ${item.status}`);
                }
                // *** End Log ***
            } else {
                traverse(item.children); // Recurse into children
            }
        });
    }
    traverse(nodes);
    // console.log(`calculateOverallProgress: Found ${completedMicroTopics} completed out of ${totalMicroTopics} micro-topics.`); // Summary log
    // Calculate percentage, handle division by zero
    return totalMicroTopics === 0 ? 0 : Math.round((completedMicroTopics / totalMicroTopics) * 100);
}

/**
 * Finds all micro-topics currently due or overdue for revision.
 * @param {Array} nodes The array of syllabus nodes to search within.
 * @returns {Array} An array of objects, each representing a topic due for revision.
 */
function getDueRevisions(nodes) {
     if (!Array.isArray(nodes)) return [];
    const revisionsDue = [];
    const today = new Date(); today.setHours(0, 0, 0, 0); // Normalize today's date

    // Recursive traversal function
    function traverse(items, paperName = 'N/A') {
         if (!Array.isArray(items)) return;
        items.forEach(item => {
            if (!item || !item.id) return; // Skip invalid items

            // Attempt to determine the paper name for context
            let currentPaperName = paperName;
            if (item.id.startsWith('prelims-gs') || item.id.startsWith('mains-gs') || item.id === 'mains-essay') currentPaperName = item.name; // Include Essay
            else if (item.id.includes('optional')) currentPaperName = `Optional (${optionalSubject?.toUpperCase() || '?'}) ${item.name.includes('P-I') ? 'P-I' : 'P-II'}`;

            // Process leaf nodes (micro-topics) for SRS status
            if (!Array.isArray(item.children) || item.children.length === 0) {
                if (item.startDate && item.revisions) {
                    // Check each revision interval
                    Object.entries(REVISION_SCHEDULE).forEach(([dayKey, days]) => {
                        const isDone = item.revisions[dayKey] === true;
                        const { status, date } = getRevisionStatus(item.startDate, days, isDone);
                        // Add to list if due or overdue
                        if (status === 'due' || status === 'overdue') {
                            revisionsDue.push({ topicName: item.name, id: item.id, paper: currentPaperName, days: days, status: status, date: date });
                        }
                    });
                }
            } else {
                traverse(item.children, currentPaperName); // Recurse into children
            }
        });
    }
    traverse(nodes, 'Overall Syllabus'); // Start traversal
    return revisionsDue;
}

/**
 * Updates the dashboard UI (progress circles, revisions due list) and saves a summary to Firestore.
 */
function updateTrackerDashboard() {
    console.log("Updating tracker dashboard (Creative)...");
    if (!Array.isArray(syllabusData) || syllabusData.length === 0) {
        console.warn("Syllabus data not available for dashboard update.");
        // Maybe add a loading state to the dashboard elements here if needed
        return;
    }

    // --- Find nodes and calculate progress (Robust logic) ---
    const prelimsNode = syllabusData.find(s => s?.id === 'prelims');
    const mainsNode = syllabusData.find(s => s?.id === 'mains');
    const prelimsChildren = Array.isArray(prelimsNode?.children) ? prelimsNode.children : [];
    const mainsChildren = Array.isArray(mainsNode?.children) ? mainsNode.children : [];

    // console.log("Calculating Overall Progress for:", syllabusData); // Verbose log
    const overallProgress = calculateOverallProgress(syllabusData);

    const prelimsGSNode = prelimsChildren.find(p => p?.id === 'prelims-gs1');
    // console.log("Calculating Prelims GS Progress for:", prelimsGSNode?.children); // Verbose log
    const prelimsGS = calculateOverallProgress(prelimsGSNode?.children);

    const prelimsCSATNode = prelimsChildren.find(p => p?.id === 'prelims-csat');
    // console.log("Calculating Prelims CSAT Progress for:", prelimsCSATNode?.children); // Verbose log
    const prelimsCSAT = calculateOverallProgress(prelimsCSATNode?.children);

    const mainsGS1Node = mainsChildren.find(p => p?.id === 'mains-gs1');
    // console.log("Calculating Mains GS1 Progress for:", mainsGS1Node?.children); // Verbose log
    const mainsGS1 = calculateOverallProgress(mainsGS1Node?.children);

    const mainsGS2Node = mainsChildren.find(p => p?.id === 'mains-gs2');
    // console.log("Calculating Mains GS2 Progress for:", mainsGS2Node?.children); // Verbose log
    const mainsGS2 = calculateOverallProgress(mainsGS2Node?.children);

    const mainsGS3Node = mainsChildren.find(p => p?.id === 'mains-gs3');
    // console.log("Calculating Mains GS3 Progress for:", mainsGS3Node?.children); // Verbose log
    const mainsGS3 = calculateOverallProgress(mainsGS3Node?.children);

    const mainsGS4Node = mainsChildren.find(p => p?.id === 'mains-gs4');
    // console.log("Calculating Mains GS4 Progress for:", mainsGS4Node?.children); // Verbose log
    const mainsGS4 = calculateOverallProgress(mainsGS4Node?.children);

    const optionalP1Node = mainsChildren.find(p => p?.id === 'mains-optional-1');
    // console.log("Calculating Optional P1 Progress for:", optionalP1Node?.children); // Verbose log
    const optionalP1 = calculateOverallProgress(optionalP1Node?.children);

    const optionalP2Node = mainsChildren.find(p => p?.id === 'mains-optional-2');
    // console.log("Calculating Optional P2 Progress for:", optionalP2Node?.children); // Verbose log
    const optionalP2 = calculateOverallProgress(optionalP2Node?.children);

    // console.log("Calculated Percentages:", { overallProgress, prelimsGS, prelimsCSAT, mainsGS1, mainsGS2, mainsGS3, mainsGS4, optionalP1, optionalP2 });


    // --- Helper to update a circular progress element ---
    const updateCircle = (circleElement, value) => {
        // Clamp value between 0 and 100
        const val = (typeof value === 'number' && !isNaN(value)) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
        if (circleElement) {
            circleElement.style.setProperty('--value', val); // Update CSS variable for conic gradient
            const valueSpan = circleElement.querySelector('.progress-circle-value');
            if (valueSpan) valueSpan.textContent = `${val}%`;
        } else {
             // Silently fail if element not found, but log might be useful in dev
             // console.error(`Progress circle element not found for update.`);
        }
    };

    // --- Update the UI elements ---
    const dashboard = document.getElementById('tab-dashboard'); // Get the dashboard container
    if (!dashboard) {
        console.error("Dashboard tab container not found!");
        return;
    }

    // Update Overall Progress
    updateCircle(dashboard.querySelector('.progress-circle.overall'), overallProgress);

    // Update Section Progress Circles (using more specific querySelectors within the dashboard)
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(2) .progress-circle'), prelimsGS); // Prelims GS (Card 2)
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(3) .progress-circle'), prelimsCSAT); // Prelims CSAT (Card 3)
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(4) .progress-circle'), mainsGS1); // Mains GS1 (Card 4)
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(5) .progress-circle'), mainsGS2); // Mains GS2 (Card 5)
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(6) .progress-circle'), mainsGS3); // Mains GS3 (Card 6)
    updateCircle(dashboard.querySelector('.dashboard-card:nth-of-type(7) .progress-circle'), mainsGS4); // Mains GS4 (Card 7)


    // Update Optional Progress (Show/Hide cards and update values)
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
    } else if (optP1Card && optP2Card) { // Hide if no optional subject
        optP1Card.classList.add('hidden');
        optP2Card.classList.add('hidden');
    }

    // --- Update Revisions Due List ---
    const revisionsDue = getDueRevisions(syllabusData).filter(r => r.status === 'due' || r.status === 'overdue');
    if (DOMElements.reminderCount) DOMElements.reminderCount.textContent = revisionsDue.length;
    if (DOMElements.revisionsDueList) {
        if (revisionsDue.length === 0) {
            DOMElements.revisionsDueList.innerHTML = `<p class="text-green-700 font-semibold text-center py-4">🎉 All caught up! No revisions due today.</p>`;
        } else {
            DOMElements.revisionsDueList.innerHTML = revisionsDue.map(r => {
                // Generate a shorter paper name for display
                let paperShortName = r.paper || 'Topic';
                if (paperShortName.includes('GS Paper')) paperShortName = paperShortName.split('(')[0].trim();
                else if (paperShortName.includes('Optional')) paperShortName = paperShortName.split('(')[0].trim() + ` (${optionalSubject?.toUpperCase() || '?'}) ${paperShortName.includes('P-I') ? 'P1' : 'P2'}`;
                // Keep 'Essay' as is
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

    // --- Save summary to Firestore ---
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
     console.log("Dashboard update complete."); // Log completion
}


// --- Tab and Syllabus Rendering Functions ---

/**
 * Activates a specific tab and triggers rendering of its content.
 * @param {string} tabId The ID of the tab to activate ('dashboard', 'preliminary', 'mains', 'optional').
 */
function activateTab(tabId) {
    console.log("Activating tab:", tabId);
    if (!tabId) { console.error("activateTab called with invalid tabId"); return; }

    // Hide all content sections, show the active one
    DOMElements.tabContents.forEach(content => content.classList.add('hidden'));
    const activeContent = document.getElementById(`tab-${tabId}`);
    if (activeContent) activeContent.classList.remove('hidden');
    else console.error(`Content area not found for tab: ${tabId}`);

    // Update button styling
    DOMElements.tabButtons.forEach(btn => btn.classList.remove('active'));
    const activeButton = document.querySelector(`button.tab-button[data-tab="${tabId}"]`);
    if (activeButton) activeButton.classList.add('active');
    else console.error(`Button not found for tab: ${tabId}`);

    // Trigger content rendering for the activated tab
    try {
        if (tabId === 'preliminary') renderSyllabusPrelims();
        else if (tabId === 'mains') renderSyllabusMains('mains-gs1'); // Default to GS1
        else if (tabId === 'optional') renderOptionalTab();
        else if (tabId === 'dashboard') updateTrackerDashboard(); // Update dashboard when tab activated
    } catch (e) {
        console.error(`Error rendering content for tab ${tabId}:`, e);
        if (activeContent) activeContent.innerHTML = `<p class="text-red-500 p-4">Error loading content for this section.</p>`;
    }
}

/** Renders the Preliminary syllabus into its container. */
function renderSyllabusPrelims() {
    console.log("Rendering Prelims syllabus...");
    const prelimsRoot = syllabusData.find(s => s?.id === 'prelims');
    const targetUl = DOMElements.prelimsTree; // The specific UL for prelims
    if (prelimsRoot && targetUl) {
        renderSyllabus(prelimsRoot.children || [], targetUl, 1); // Render children directly
        console.log("Prelims syllabus rendered.");
    } else {
        console.error("Prelims data or target UL element not found.", {prelimsRoot, targetUl});
        if(targetUl) targetUl.innerHTML = '<li><p class="text-red-500">Error loading Prelims syllabus structure.</p></li>';
    }
}

/**
 * Renders the Mains GS syllabus for a specific paper ID.
 * @param {string} paperId The ID of the paper to render (e.g., 'mains-gs1').
 */
function renderSyllabusMains(paperId) {
    console.log("Rendering Mains syllabus for:", paperId);
    const mainsRoot = syllabusData.find(s => s?.id === 'mains');
    if (!mainsRoot || !Array.isArray(mainsRoot.children)) {
        console.error("Mains syllabus root data not found or invalid.");
        if(DOMElements.mainsSyllabusTreeContainer) DOMElements.mainsSyllabusTreeContainer.innerHTML = '<p class="text-red-500 p-4">Error loading Mains syllabus structure.</p>';
        return;
    }

    // Hide all GS paper ULs, then find and show the target one
    DOMElements.mainsGsTrees.forEach(tree => tree.classList.add('hidden'));
    const targetTree = DOMElements.mainsSyllabusTreeContainer?.querySelector(`ul[data-target-paper="${paperId}"]`);

    if (targetTree) {
        targetTree.classList.remove('hidden'); // Show the correct UL
        const paperData = mainsRoot.children.find(p => p?.id === paperId);
        // Render the children of the selected paper
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

    // Update chip styling
    DOMElements.mainsGsChipNav?.querySelectorAll('.gs-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.paper === paperId);
    });
}

/** Renders the Optional subject tab, showing selection or the syllabus view. */
function renderOptionalTab() {
     console.log("Rendering Optional tab. Current optional:", optionalSubject);
    if (!optionalSubject) {
        // Show selection screen if no optional is set
        DOMElements.optionalSyllabusView?.classList.add('hidden');
        DOMElements.optionalSelectionScreen?.classList.remove('hidden');
        renderOptionalSelectionList();
    } else {
        // Show syllabus view if optional is set
        DOMElements.optionalSelectionScreen?.classList.add('hidden');
        DOMElements.optionalSyllabusView?.classList.remove('hidden');

        // Update title
        const titleSpan = DOMElements.optionalSyllabusTitle?.querySelector('span');
        if(titleSpan) titleSpan.textContent = optionalSubject.toUpperCase();

        const mains = syllabusData.find(s => s?.id === 'mains');
        if (!mains || !Array.isArray(mains.children)) {
             console.error("Mains node not found or invalid for optional render.");
             if(DOMElements.optionalSyllabusTreeContainer) DOMElements.optionalSyllabusTreeContainer.innerHTML = '<p class="text-red-500">Error loading syllabus structure.</p>';
             return;
        }

        // Find optional paper nodes in the main syllabus data
        const optionalPaper1Node = mains.children.find(p => p?.id === 'mains-optional-1');
        const optionalPaper2Node = mains.children.find(p => p?.id === 'mains-optional-2');

        const container = DOMElements.optionalSyllabusTreeContainer;
        if (!container) return;
        container.innerHTML = ''; // Clear previous content

        // Check if data exists and is not the placeholder
        const hasPaper1Data = optionalPaper1Node && Array.isArray(optionalPaper1Node.children) && optionalPaper1Node.children.length > 0 && optionalPaper1Node.children[0]?.id !== 'mains-opt1-placeholder';
        const hasPaper2Data = optionalPaper2Node && Array.isArray(optionalPaper2Node.children) && optionalPaper2Node.children.length > 0 && optionalPaper2Node.children[0]?.id !== 'mains-opt2-placeholder';

        // Render Paper 1 if data exists
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

        // Render Paper 2 if data exists
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

/** Renders the list of buttons for selecting an optional subject. */
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

/**
 * Calls the Gemini API to generate content based on prompts.
 * @param {string} prompt The user's query/prompt.
 * @param {string} systemInstruction The system instruction guiding the AI's role and format.
 * @param {boolean} [useSearch=false] Whether to enable the Google Search tool (if configured).
 * @returns {Promise<string>} A promise resolving to the generated text content.
 * @throws {Error} If the API key is missing or the API call fails.
 */
async function callGeminiAPI(prompt, systemInstruction, useSearch = false) {
    if (!GEMINI_API_KEY) { console.error("Gemini API Key is missing."); throw new Error("AI Service configuration error."); }
    const API_URL_TO_USE = GEMINI_API_URL; // Use the configured model URL
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        tools: useSearch ? [{ google_search_retrieval: {} }] : [], // Add search tool if requested
        generationConfig: { temperature: 0.7 } // Configure generation parameters
    };
    try {
        const response = await fetch(API_URL_TO_USE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const responseBody = await response.text();
        if (!response.ok) { console.error("Gemini API Error:", response.status, responseBody); let errorMsg = `API request failed: ${response.statusText}`; try { errorMsg = JSON.parse(responseBody)?.error?.message || errorMsg; } catch (_) {} throw new Error(errorMsg); }
        const result = JSON.parse(responseBody);
        // Check for blocks or missing content
        if (!result.candidates && result.promptFeedback?.blockReason) { throw new Error(`AI request blocked: ${result.promptFeedback.blockReason}.`); }
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) { const finishReason = result.candidates?.[0]?.finishReason; throw new Error(`AI returned no content. Finish reason: ${finishReason || 'Unknown'}`); }
        return text;
    } catch (error) { console.error("Gemini API call failed:", error); throw new Error(`AI service unavailable: ${error.message}`); }
}

/**
 * Handles clicks on AI buttons (Plan, Resources, PYQs), calls the API, and displays the result.
 * @param {string} itemId The ID of the syllabus item.
 * @param {string} action The AI action requested (e.g., 'ai-plan').
 * @param {string} topicName The name of the syllabus topic.
 */
async function handleAIGenerator(itemId, action, topicName) {
    if(!DOMElements.aiResponseModal) return;
    openModal(DOMElements.aiResponseModal); // Show the modal
    // Set modal titles
    if(DOMElements.aiModalTitle) DOMElements.aiModalTitle.textContent = action.replace('ai-', 'AI ').replace(/\b\w/g, l => l.toUpperCase());
    if(DOMElements.aiTopicName) DOMElements.aiTopicName.textContent = topicName;
    // Show loading state
    if(DOMElements.aiResponseContent) DOMElements.aiResponseContent.innerHTML = `<div class="flex flex-col items-center justify-center h-48 text-center"><i class="fas fa-spinner fa-spin text-blue-600 text-4xl mb-4"></i><p class="text-slate-500">Consulting the AI for a ${action.split('-')[1].toUpperCase()}...</p></div>`;

    let systemPrompt = '', userPrompt = '', useSearch = false;
    // Define prompts based on the action
     if (action === 'ai-plan') {
        systemPrompt = `You are an expert UPSC mentor. Generate a concise, actionable, 5-day study plan for the specific UPSC syllabus topic provided. Focus on NCERTs, standard books, PYQs, and logical steps (Day 1 to Day 5). Output using Markdown (lists, bold).`;
        userPrompt = `Generate a 5-day study plan for the UPSC micro-topic: "${topicName}".`;
    } else if (action === 'ai-resources') {
        systemPrompt = `You are an AI research assistant for UPSC prep. Find and summarize 3-5 relevant, recent, and trustworthy external resources (articles, explainers, reports) for the topic. Include URL and brief explanation. Output using Markdown. If using search, prioritize official sources.`;
        userPrompt = `Find 3-5 high-quality, relevant, and recent study resources for the UPSC micro-topic: "${topicName}".`;
        // useSearch = true; // Enable if desired and configured
    } else if (action === 'ai-pyq') {
        systemPrompt = `You are an expert UPSC examiner. Find 3-5 Previous Year Questions (PYQs) related to the topic. Provide the year if possible, distinguish Prelims/Mains. Use reliable UPSC source references if possible. Output using Markdown (lists, bold).`;
        userPrompt = `Find 3-5 Previous Year Questions (PYQs) for the UPSC micro-topic: "${topicName}". Focus on the last 10 years.`;
        // useSearch = true; // Enable if desired and configured
    } else {
         if(DOMElements.aiResponseContent) DOMElements.aiResponseContent.innerHTML = `<p class="text-red-500 font-semibold">Error: Unknown AI action requested.</p>`; return;
    }

    try {
        const responseText = await callGeminiAPI(userPrompt, systemPrompt, useSearch);
        // Basic Markdown to HTML conversion
        let htmlResponse = responseText
            .replace(/</g, "&lt;").replace(/>/g, "&gt;") // Escape HTML
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/`([^`]+)`/g, '<code>$1</code>')     // Code
            .replace(/^-\s+(.*?)(\n|$)/gm, '<li>$1</li>') // Lists
            .replace(/(\<li\>.*?\<\/li\>)/gs, '<ul>$1</ul>') // Wrap lists
            .replace(/\n/g, '<br>');                      // Newlines
         htmlResponse = htmlResponse.replace(/<\/ul>\s*<ul>/g, ''); // Merge adjacent lists

        if(DOMElements.aiResponseContent) DOMElements.aiResponseContent.innerHTML = `<div class="p-4 bg-slate-50 rounded-lg text-sm">${htmlResponse}</div>`;
        showNotification(`${action.split('-')[1].toUpperCase()} generated.`);
    } catch (error) {
        console.error(`AI generation failed for ${action}:`, error);
        if(DOMElements.aiResponseContent) DOMElements.aiResponseContent.innerHTML = `<p class="text-red-500 font-semibold p-4">Error generating content: ${error.message}</p>`;
        showNotification(`AI Failed: ${error.message}`, true);
    }
}


// --- Firebase & Persistence ---

/**
 * Starts a Firestore listener to detect changes in the user's selected optional subject.
 * @param {string} userId The current user's ID.
 */
function startOptionalSubjectListener(userId) {
    if (unsubscribeOptional) { unsubscribeOptional(); unsubscribeOptional = null; } // Stop previous listener
    if (!db || !firestoreModule?.doc || !firestoreModule?.onSnapshot || !userId) { console.warn("Firestore not ready for optional listener."); return; }
    console.log("Starting optional subject listener for user:", userId);

    const { doc, onSnapshot } = firestoreModule;
    // Path: artifacts/{appId}/users/{userId} (where profile is stored)
    const profileDocRef = doc(db, 'artifacts', appId, 'users', userId);

    unsubscribeOptional = onSnapshot(profileDocRef, (docSnap) => {
        if (!docSnap.exists()) { console.warn("User profile document not found for listener."); return; }
        const profile = docSnap.data()?.profile || {};
        const newOptional = profile.optionalSubject || null;

        // If optional subject has changed
        if (newOptional !== optionalSubject) {
            console.log(`Optional subject change detected via listener: ${optionalSubject} -> ${newOptional}`);
            const oldOptional = optionalSubject;
            optionalSubject = newOptional; // Update global state

            // Reset previous optional data in syllabusData if needed
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
            // Integrate new optional data
            if (newOptional) {
                updateOptionalSyllabusData(syllabusData); // Pass syllabusData to be mutated
            }
            // Re-render the optional tab
            renderOptionalTab();
            // No save trigger needed here, change was already saved by click handler
            showNotification(`Optional subject updated to ${newOptional ? newOptional.toUpperCase() : 'None'}.`);
        }
    }, (error) => { console.error("Error in optional subject listener:", error); });
}

/**
 * Updates the main syllabusData object with the syllabus for the chosen optional subject.
 * @param {Array} syllabusDataRef A reference to the main syllabusData array to mutate.
 */
function updateOptionalSyllabusData(syllabusDataRef) {
    if (!optionalSubject) return;
    console.log(`Updating internal syllabusData with optional: ${optionalSubject}`);
    const { paper1, paper2 } = getOptionalSyllabusById(optionalSubject); // Gets processed data
    if (!paper1 && !paper2) { console.error(`Could not get syllabus data for optional: ${optionalSubject}`); return; }

    const mains = syllabusDataRef.find(s => s?.id === 'mains');
    if (!mains || !mains.children) { console.error("Mains node not found for optional update."); return; }

    const mainsOpt1 = mains.children.find(p => p?.id === 'mains-optional-1');
    const mainsOpt2 = mains.children.find(p => p?.id === 'mains-optional-2');

    // Update Paper 1 node
    if (mainsOpt1 && paper1) {
        Object.assign(mainsOpt1, paper1); // Replace placeholder content
        mainsOpt1.name = `Optional (${optionalSubject.toUpperCase()}) P-I`;
        console.log("Optional Paper 1 data integrated.");
    } else if (mainsOpt1) {
         console.warn("Optional Paper 1 node exists, but no data found for:", optionalSubject);
         // Reset to placeholder state if data is missing
         Object.assign(mainsOpt1, { name: 'Optional Subject Paper-I', status: STATUSES.NOT_STARTED, children: [addSRSProperties({ id: 'mains-opt1-placeholder', name: 'Select your optional subject', status: STATUSES.NOT_STARTED })]});
    }

    // Update Paper 2 node
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

    // Initial UI state: Show loading, hide content
    DOMElements.loadingIndicator?.classList.remove('hidden');
    DOMElements.contentWrapper?.classList.add('hidden');
    if(DOMElements.saveBtn) {
        DOMElements.saveBtn.disabled = true; // Save button is now non-functional, keep disabled
        DOMElements.saveBtn.style.display = 'none'; // Optionally hide it completely
    }

    // --- Firebase Initialization ---
    try {
        // Dynamically import Firebase modules using the correct SDK version (10.13.0)
        const [authModule, firestoreModuleSdk] = await Promise.all([
            import("https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js"),
            import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js")
        ]);
        const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js");

        // Get config and App ID (potentially passed from index.html via global vars)
        const firebaseConfigFromGlobal = typeof window.__firebase_config !== 'undefined' ? window.__firebase_config : firebaseConfig;
        appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';
        console.log("Using appId:", appId);

        if (!firebaseConfigFromGlobal?.apiKey) { throw new Error("Firebase configuration is missing or invalid."); }

        // Initialize Firebase app and services
        const app = getApps().length ? getApp() : initializeApp(firebaseConfigFromGlobal);
        db = firestoreModuleSdk.getFirestore(app);
        auth = authModule.getAuth(app);
        // Store module references for later use
        firestoreModule = firestoreModuleSdk;
        firebaseAuthModule = authModule;

        // Attempt to enable offline persistence
        await firestoreModule.enableIndexedDbPersistence(db).catch(e => console.warn("Firestore Persistence failed:", e.code));
        console.log("Firebase Initialized. Setting up Auth Listener...");

        // --- Auth State Listener ---
        firebaseAuthModule.onAuthStateChanged(auth, (user) => {
             console.log("Auth state changed. User:", user ? user.uid : null);
             if (user) { // User is logged in
                 currentUser = user;
                 // Trigger data loading only on the first detection of a user
                 if (isSyllabusLoading) {
                     console.log("User found, triggering syllabus load.");
                     loadSyllabusData(user.uid);
                 } else {
                     console.log("Syllabus already loading/loaded, skipping load trigger.");
                 }
             } else { // User is logged out
                 currentUser = null;
                 isSyllabusLoading = false; // Stop loading process if user logs out
                 console.error("User logged out or authentication failed.");
                 // Display error message and hide content
                 DOMElements.loadingIndicator.innerHTML = '<p class="text-red-500 p-4">Authentication required. Please log in via the main page.</p>';
                 DOMElements.loadingIndicator.classList.remove('hidden');
                 DOMElements.contentWrapper.classList.add('hidden');
             }
        });

    } catch (error) { // Handle Firebase initialization errors
         console.error("Firebase Initialization Failed:", error);
         showNotification("Error: Core services failed to load.", true);
         DOMElements.loadingIndicator.innerHTML = `<p class="text-red-500 p-4">Error: Services failed to initialize: ${error.message}</p>`;
         DOMElements.loadingIndicator.classList.remove('hidden');
         isSyllabusLoading = false; // Stop loading
         return; // Halt execution
    }


    // --- loadSyllabusData ---
    /** Loads static syllabus and merges user progress from Firestore. */
    async function loadSyllabusData(userId) {
        console.log("loadSyllabusData started for user:", userId);
        isSyllabusLoading = false; // Prevent re-entry

        DOMElements.loadingIndicator?.classList.remove('hidden');
        DOMElements.contentWrapper?.classList.add('hidden');

        let loadedStaticData = null;
        let loadedOptionalSubject = null;

        try {
            // Check for required functions from the module
            if (!firestoreModule?.doc || !firestoreModule?.getDoc || !firestoreModule?.collection || !firestoreModule?.getDocs) {
                throw new Error("Firestore module not ready or missing required functions.");
            }
            const { doc, getDoc, collection, getDocs, query } = firestoreModule; // Ensure query is included

            // 1. Load Optional Subject from user profile
            console.log("Fetching profile for optional subject...");
            const profileDocRef = doc(db, 'artifacts', appId, 'users', userId);
            const profileSnap = await getDoc(profileDocRef);
            loadedOptionalSubject = profileSnap.exists() ? profileSnap.data()?.profile?.optionalSubject : null;
            optionalSubject = loadedOptionalSubject; // Set global state
            console.log("Optional subject loaded:", optionalSubject);

            // 2. Assemble default static syllabus from JS files
            console.log("Assembling default syllabus structure.");
            loadedStaticData = assembleDefaultSyllabus();
            if (loadedStaticData.length === 0) {
                throw new Error("Assembly function returned empty data.");
            }

            // 3. Integrate Optional Subject Data (if selected) *before* merging progress
            if (optionalSubject) {
                console.log(`Integrating optional syllabus: ${optionalSubject}`);
                // NOTE: updateOptionalSyllabusData mutates the passed object
                updateOptionalSyllabusData(loadedStaticData); 
            } else {
                 console.log("No optional subject selected by user.");
            }
            
            // 4. *** NEW: Load ALL topic progress docs from Firestore ***
            console.log("Fetching granular topic progress...");
            const progressCollectionRef = collection(db, 'users', userId, 'topicProgress');
            const progressSnapshot = await getDocs(query(progressCollectionRef)); // Use query to be explicit
            
            // 5. *** NEW: Merge Firestore progress into static syllabus data ***
            if (!progressSnapshot.empty) {
                console.log(`Merging ${progressSnapshot.size} progress documents.`);
                progressSnapshot.forEach(doc => {
                    const topicId = doc.id;
                    const progressData = doc.data();
                    const topicItem = findItemById(topicId, loadedStaticData); // Find item in our static data

                    if (topicItem) {
                        // Merge the saved progress into the static item
                        // This will overwrite status, startDate, revisions
                        Object.assign(topicItem, progressData); 
                    } else {
                        console.warn(`Found progress for unknown topic ID: ${topicId}`);
                    }
                });
            } else {
                console.log("No saved topic progress found in Firestore. Using default state.");
            }

            // --- Final Assignment ---
            syllabusData = loadedStaticData; // Assign final merged data to global state
            console.log("Syllabus data preparation and merge complete.");

            // 6. *** NEW: Recalculate all parent statuses after merging ***
            console.log("Recalculating all parent statuses...");

            // Helper to find all leaf nodes and update their parents
            const updateAllParents = (nodes) => {
                if (!Array.isArray(nodes)) return;
                nodes.forEach(node => {
                    if (!node) return;
                    if (node.children && node.children.length > 0) {
                        // Recurse
                        updateAllParents(node.children);
                    } else if (node.id) { // Check for ID to be safe
                        // It's a leaf node. Trigger updateParentStatuses for it.
                        // This will bubble up and set the correct status for all its ancestors.
                        // We pass 'document' as the container, assuming all are rendered.
                        updateParentStatuses(node.id, document);
                    }
                });
            };
            
            // Start the parent update process from the root
            updateAllParents(syllabusData);
            
            console.log("Parent status recalculation complete.");

        } catch (error) { // Handle errors
            console.error("CRITICAL Error during syllabus load:", error);
            showNotification("Error loading syllabus data. Using default.", true);
            try { // Fallback to just static data
                 syllabusData = assembleDefaultSyllabus();
                 if (optionalSubject) updateOptionalSyllabusData(syllabusData);
            } catch (assemblyError){ 
                 console.error("FATAL: Fallback assembly failed:", assemblyError);
                 syllabusData = []; 
                 if(DOMElements.loadingIndicator) DOMElements.loadingIndicator.innerHTML = '<p class="text-red-500 p-4">Critical error loading syllabus data.</p>';
                 if(DOMElements.loadingIndicator) DOMElements.loadingIndicator.classList.remove('hidden'); 
                 return; 
            }
        } finally { // Runs after try or catch
             DOMElements.loadingIndicator?.classList.add('hidden');

             if (syllabusData.length === 0) { 
                 console.error("Syllabus data remains empty after load/assembly.");
                 if (DOMElements.loadingIndicator && !DOMElements.loadingIndicator.innerHTML.includes('Critical error')) {
                    DOMElements.loadingIndicator.innerHTML = '<p class="text-red-500 p-4">Failed to load syllabus structure.</p>';
                 }
                 DOMElements.loadingIndicator?.classList.remove('hidden');
                 DOMElements.contentWrapper?.classList.add('hidden'); 
             } else {
                  DOMElements.contentWrapper?.classList.remove('hidden');
                  if(DOMElements.contentWrapper) DOMElements.contentWrapper.classList.add('overflow-y-auto'); 
                  activateTab('dashboard'); 
                  startDailyReminderCheck(); 
                  startOptionalSubjectListener(userId); 
             }
        } // End finally
    } // End loadSyllabusData


    // --- Event Handling ---

    // Global listener to close modals on backdrop click
    document.addEventListener('click', function(e) {
        const activeModals = document.querySelectorAll('.modal.active');
        activeModals.forEach(modal => { if (modal === e.target) closeModal(modal); });
    });

    // --- Main Click Handler (Event Delegation) ---
    document.addEventListener('click', async function(e) {
        const target = e.target;
        
        // *** --------------------------------- ***
        // *** THIS IS THE FIX ***
        // *** Handle modal close buttons FIRST, before any early returns ***
        // *** --------------------------------- ***
        if (target.matches('#close-ai-response-modal')) {
             if (DOMElements.aiResponseModal) { closeModal(DOMElements.aiResponseModal); }
             srsModalContext = {}; // Clear context
             return; // Action is complete
        }
        if (target.matches('#sdate-cancel-btn')) {
             if (DOMElements.startDateModal) { closeModal(DOMElements.startDateModal); }
             srsModalContext = {}; // Clear context
             return; // Action is complete
        }
        if (target.matches('#confirm-revision-cancel-btn')) {
             if (DOMElements.confirmRevisionModal) { closeModal(DOMElements.confirmRevisionModal); }
             srsModalContext = {}; // Clear context
             return; // Action is complete
        }
        if (target.matches('#close-reminder-btn, #go-to-dashboard-btn')) {
             if(DOMElements.dailyReminderModal) closeModal(DOMElements.dailyReminderModal);
             if (target.id === 'go-to-dashboard-btn') activateTab('dashboard');
             return; // Action is complete
        }
        // *** End of Modal Close Fix ***


        // Find the closest ancestor with a data-action attribute
        const actionElement = target.closest('[data-action]');
        const action = actionElement?.dataset.action;

        // Early exit if no relevant action found on target or ancestors,
        // unless it's a tab, chip, or optional button click
        if (!action && !target.classList.contains('tab-button') && !target.classList.contains('gs-chip') && !target.classList.contains('select-optional-btn')) {
            return;
        }

        let itemId;
        let itemElement = target.closest('[data-id], [data-topic-id]'); // Find element with ID

        // Determine itemId based on the action context
        if (action === 'syllabus-toggle-item') { itemId = target.closest('li.syllabus-item')?.dataset.id; }
        else if (action === 'srs-bar') { itemId = actionElement?.dataset.topicId; } // ID is on the container for SRS bar clicks
        else if (action === 'jump-to-topic') { itemId = actionElement?.dataset.id; }
        else if (actionElement) { itemId = actionElement.dataset.id; } // For status toggles, AI buttons

        const topicItem = itemId ? findItemById(itemId, syllabusData) : null;
        const topicName = topicItem?.name || 'Topic';

        // --- Handle specific actions ---

        // Tab Navigation
        if (target.classList.contains('tab-button') && target.dataset.tab) {
             activateTab(target.dataset.tab); return;
        }
        // Mains GS Chip Navigation
        if (target.classList.contains('gs-chip') && target.dataset.paper) {
             renderSyllabusMains(target.dataset.paper); return;
        }
        // Syllabus Toggle (Expand/Collapse)
        if (action === 'syllabus-toggle-item') {
            // Only toggle if the click wasn't on an interactive element inside the wrapper
            if (!target.closest('.progress-toggle, .ai-button, .revision-dot, .select-optional-btn')) {
                const wrapper = actionElement;
                const parentLi = wrapper?.closest('li.syllabus-item');
                const childUl = parentLi?.querySelector(':scope > ul.syllabus-list'); // Direct child UL
                const toggleIcon = wrapper?.querySelector(':scope > .syllabus-toggle'); // Direct child toggle
                const hasChildren = wrapper?.dataset.hasChildren === 'true';

                if (childUl && toggleIcon && hasChildren) {
                    const isExpanded = childUl.style.display !== 'none';
                    childUl.style.display = isExpanded ? 'none' : 'block';
                    toggleIcon.classList.toggle('expanded', !isExpanded);
                    e.stopPropagation(); // Prevent other actions if just toggling
                }
            }
            // Allow clicks on buttons inside the wrapper to proceed
        }

        // Toggle Status Button Click
        else if (action === 'toggle-status' && topicItem && actionElement) {
            e.stopPropagation();
            const currentStatus = topicItem.status;
            let newStatus = STATUSES.NOT_STARTED; // Cycle: NS -> IP -> C -> NS
            if (currentStatus === STATUSES.NOT_STARTED) newStatus = STATUSES.IN_PROGRESS;
            else if (currentStatus === STATUSES.IN_PROGRESS) newStatus = STATUSES.COMPLETED;

            const isMicroTopic = !Array.isArray(topicItem.children) || topicItem.children.length === 0;

            // Trigger Start Date Modal only for micro-topics going to IN_PROGRESS for the first time
            if (isMicroTopic && currentStatus === STATUSES.NOT_STARTED && newStatus === STATUSES.IN_PROGRESS && !topicItem.startDate) {
                srsModalContext = { itemId, topicName, newStatus };
                if (DOMElements.sdateTopicName) DOMElements.sdateTopicName.textContent = topicName;
                if (DOMElements.startDateInput) DOMElements.startDateInput.valueAsDate = new Date(); // Default to today
                if (DOMElements.startDateModal) openModal(DOMElements.startDateModal);
                // Do not update status yet, wait for modal submission
            } else {
                 // Apply status change directly
                 topicItem.status = newStatus;
                 // *** Diagnostic Log ***
                 console.log(`Status updated in data for ${itemId}:`, topicItem.status);
                 const foundAgain = findItemById(itemId, syllabusData); // Re-find to confirm update in main array
                 console.log(`Re-checked status in syllabusData for ${itemId}:`, foundAgain?.status);
                 // *** End Log ***
                 const statusText = newStatus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                 // Update button UI
                 actionElement.textContent = statusText;
                 actionElement.className = `progress-toggle status-${newStatus}-ui flex-shrink-0`;
                 actionElement.setAttribute('data-current-status', newStatus);

                 console.log(`Calling updateParentStatuses for ${itemId}`); // Log before call
                 updateParentStatuses(itemId, document);

                 console.log(`Calling updateTrackerDashboard after status change`); // Log before call
                 updateTrackerDashboard(); // Includes summary save
                 console.log(`Dashboard update call complete for ${itemId}`); // Log after call
                 
                 // *** Only save if it's a micro-topic ***
                 if (isMicroTopic) {
                     saveTopicProgress(itemId, { 
                         status: topicItem.status, 
                         startDate: topicItem.startDate, 
                         revisions: topicItem.revisions 
                     });
                 }
            }
        }

        // SRS Dot Click
         else if (action === 'srs-bar' && target.classList.contains('revision-dot')) {
             e.stopPropagation();
             const dotEl = target;
             const srsContainer = dotEl.closest('.srs-bar-container');
             const dotItemId = srsContainer?.dataset.topicId; // Get ID from container
             const dotTopicItem = dotItemId ? findItemById(dotItemId, syllabusData) : null;

             if (dotTopicItem) {
                 const status = dotEl.dataset.status;
                 const dayKey = dotEl.dataset.day;

                 // If dot is due or overdue, show confirmation modal
                 if ((status === 'due' || status === 'overdue') && dotTopicItem.revisions && dayKey) {
                     srsModalContext = { itemId: dotItemId, topicName: dotTopicItem.name, dayKey };
                     if(DOMElements.confirmTopicName) DOMElements.confirmTopicName.textContent = dotTopicItem.name;
                     if(DOMElements.confirmRevisionDay) DOMElements.confirmRevisionDay.textContent = dayKey.toUpperCase();
                     if(DOMElements.confirmRevisionModal) openModal(DOMElements.confirmRevisionModal);
                 }
                 // Show info for done or pending dots
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

        // AI Smart Tracker Button Click
        else if (action?.startsWith('ai-') && topicItem && actionElement) {
            e.stopPropagation();
            handleAIGenerator(itemId, action, topicName);
        }

        // Jump to Topic Link Click (from dashboard/reminder)
        else if (action === 'jump-to-topic' && itemId) {
             e.preventDefault();
             const topic = findItemById(itemId, syllabusData);
             if (!topic) { console.error("Jump-to-topic: Topic not found:", itemId); return; }

             // Determine target tab and paper ID
             let targetTabId = 'dashboard'; let targetPaperId = null;
             if (itemId.includes('prelims')) targetTabId = 'preliminary';
             else if (itemId.includes('mains-gs')) targetTabId = 'mains';
             else if (itemId.includes('mains-optional') || itemId.includes('mains-opt')) targetTabId = 'optional';
             else if (itemId.includes('mains-essay')) targetTabId = 'mains'; // Handle essay case

             activateTab(targetTabId); // Switch tab

             // If Mains GS, activate correct chip and re-render
             if (targetTabId === 'mains' && itemId.includes('mains-gs')) {
                 const parts = itemId.split('-');
                 if (parts.length >= 3) { targetPaperId = `${parts[0]}-${parts[1]}${parts[2]}`; if (document.querySelector(`[data-paper="${targetPaperId}"]`)) { renderSyllabusMains(targetPaperId); } }
             }
             // Optional/Prelims are handled by activateTab

             // Scroll to the element after a short delay to allow rendering
             setTimeout(() => {
                 const targetEl = document.querySelector(`li[data-id="${itemId}"]`);
                 if (targetEl) {
                     // Expand all parent elements
                     let current = targetEl.parentElement?.closest('li.syllabus-item');
                     while (current) {
                         const ul = current.querySelector(':scope > ul.syllabus-list');
                         const toggle = current.querySelector(':scope > .syllabus-item-content-wrapper > .syllabus-toggle');
                         if (ul && ul.style.display === 'none') ul.style.display = 'block';
                         if (toggle && !toggle.classList.contains('expanded')) toggle.classList.add('expanded');
                         current = current.parentElement?.closest('li.syllabus-item');
                     }
                     // Scroll and highlight
                     targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                     targetEl.style.transition = 'background-color 0s'; targetEl.style.backgroundColor = '#fef3c7'; // Highlight yellow
                     setTimeout(() => { if (targetEl) { targetEl.style.transition = 'background-color 0.8s ease-out'; targetEl.style.backgroundColor = ''; }}, 800); // Fade highlight
                 } else { console.warn("Jump target element not found:", itemId); }
             }, 300); // Delay allows tab switch and render
         }

        // Optional Subject Selection Button Click
        else if (target.classList.contains('select-optional-btn') && target.dataset.subjectId) {
            e.preventDefault(); const subjectId = target.dataset.subjectId;
            if (!currentUser) { showNotification("Please wait for authentication.", true); return; }
            if (!firestoreModule?.doc || !firestoreModule?.updateDoc) { showNotification("Database service unavailable.", true); return; }
            try { // Update optional subject in Firestore profile
                const { doc, updateDoc } = firestoreModule;
                const profileDocRef = doc(db, 'artifacts', appId, 'users', currentUser.uid);
                await updateDoc(profileDocRef, { 'profile.optionalSubject': subjectId });
                // Firestore listener will handle UI update and save trigger
                showNotification(`Optional set to ${subjectId.toUpperCase()}! Syncing...`);
            } catch (error) { console.error("Error setting optional:", error); showNotification("Failed to save optional choice.", true); }
        }
        
        // Confirm Revision Submit Button Click
        else if (target.id === 'confirm-revision-submit-btn') {
            e.preventDefault(); const { itemId: revItemId, dayKey: revDayKey } = srsModalContext; const itemToRevise = revItemId ? findItemById(revItemId, syllabusData) : null;
            if (itemToRevise?.revisions && revDayKey) {
                itemToRevise.revisions[revDayKey] = true; // Mark revision as done
                // If final revision (d21) is done, mark topic as completed
                if (revDayKey === 'd21') { 
                    itemToRevise.status = STATUSES.COMPLETED; 
                    updateParentStatuses(revItemId, document); 
                }
                showNotification(`Revision ${revDayKey.toUpperCase()} confirmed!`);
                closeModal(DOMElements.confirmRevisionModal); srsModalContext = {};
                // --- Targeted UI Update ---
                const listItem = document.querySelector(`li[data-id="${revItemId}"]`);
                if (listItem) {
                     // Re-render the SRS bar for the updated item
                     const srsBarDiv = listItem.querySelector(`.srs-bar-container[data-topic-id="${revItemId}"]`);
                     if (srsBarDiv) srsBarDiv.outerHTML = createSRSBarHTML(itemToRevise);
                     // If topic completed, update status button UI
                     if (revDayKey === 'd21') {
                         const toggleButton = listItem.querySelector(`button[data-action="toggle-status"]`);
                         if (toggleButton) {
                             const newStatus = STATUSES.COMPLETED; const statusText = newStatus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                             toggleButton.textContent = statusText; toggleButton.className = `progress-toggle status-${newStatus}-ui flex-shrink-0`; toggleButton.setAttribute('data-current-status', newStatus);
                         }
                     }
                 }
                updateTrackerDashboard(); // Refresh dashboard counts & save summary
                
                // *** NEW: Save this one change to Firestore ***
                saveTopicProgress(revItemId, {
                    status: itemToRevise.status,
                    startDate: itemToRevise.startDate,
                    revisions: itemToRevise.revisions
                });
            } else { showNotification("Error confirming revision.", true); console.error("Revision confirm failed:", srsModalContext, itemToRevise); closeModal(DOMElements.confirmRevisionModal); srsModalContext = {}; }
        }

    }); // End Main Click Handler


    // --- Form Submit Listeners ---

    // Start Date Modal Form Submission
    DOMElements.startDateForm?.addEventListener('submit', function(e) {
        e.preventDefault();
        const dateString = DOMElements.startDateInput.value; // YYYY-MM-DD
        const { itemId: srsItemId, newStatus: srsNewStatus } = srsModalContext;
        const itemToStart = srsItemId ? findItemById(srsItemId, syllabusData) : null;

        if (itemToStart && dateString && srsNewStatus) {
            itemToStart.startDate = dateString;
            itemToStart.status = srsNewStatus; // Apply the 'In Progress' status

            showNotification(`Tracking started from ${new Date(dateString+'T00:00:00').toLocaleDateString()}.`);
            closeModal(DOMElements.startDateModal); srsModalContext = {}; // Clear context

            // --- Targeted UI Update ---
            const listItem = document.querySelector(`li[data-id="${srsItemId}"]`);
            if (listItem) {
                 // Update Status Toggle Button UI
                 const toggleButton = listItem.querySelector(`button[data-action="toggle-status"]`);
                 if(toggleButton) {
                     const statusText = srsNewStatus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                     toggleButton.textContent = statusText; toggleButton.className = `progress-toggle status-${srsNewStatus}-ui flex-shrink-0`; toggleButton.setAttribute('data-current-status', srsNewStatus);
                 }
                 // Re-render SRS Bar with the new start date
                 const srsBarDiv = listItem.querySelector(`.srs-bar-container[data-topic-id="${srsItemId}"]`);
                 if (srsBarDiv) srsBarDiv.outerHTML = createSRSBarHTML(itemToStart);
            } else { console.warn("Could not find list item to update SRS UI after setting start date:", srsItemId); }

            // Update parent statuses, dashboard, and trigger save
            updateParentStatuses(srsItemId, document);
            updateTrackerDashboard();
            
            // *** NEW: Save this one change to Firestore ***
            saveTopicProgress(srsItemId, {
                status: itemToStart.status,
                startDate: itemToStart.startDate,
                revisions: itemToStart.revisions
            });
        } else { showNotification("Please select a valid date.", true); console.error("Start date submit failed:", srsModalContext, itemToStart, dateString); }
    });

    // --- Daily Reminder Check ---
    /** Checks if revisions are due today and shows a reminder modal if it's the first visit of the day. */
     function startDailyReminderCheck() {
         try {
             const today = new Date().toDateString();
             const lastVisited = localStorage.getItem('srsLastVisited'); // Check last visit date from localStorage

             // Show reminder if data is loaded and it's a new day
             if (Array.isArray(syllabusData) && syllabusData.length > 0 && lastVisited !== today) {
                 const revisionsDue = getDueRevisions(syllabusData).filter(r => r.status === 'due' || r.status === 'overdue');
                 // If revisions are due and modal exists, populate and show it
                 if (revisionsDue.length > 0 && DOMElements.dailyReminderModal) {
                     if(DOMElements.reminderCount) DOMElements.reminderCount.textContent = revisionsDue.length;
                     if(DOMElements.reminderTopicList) {
                         // MODIFIED: Added responsive classes (gap-2, break-words, flex-shrink-0)
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
                 localStorage.setItem('srsLastVisited', today); // Update last visit date
             }
         } catch(e) { console.error("Error during daily reminder check:", e); }
    }

}); // End DOMContentLoaded
