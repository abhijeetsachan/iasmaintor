// admin/js/dashboard.js
// Full Stack Admin Logic: CRM, CMS, Analytics, and Security

import { firebaseConfig } from '../../js/firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    getDoc,
    setDoc, 
    deleteDoc, 
    updateDoc,
    writeBatch,
    query, 
    where, 
    orderBy, 
    limit,
    startAfter,
    serverTimestamp, 
    getCountFromServer 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// --- Initialize ---
console.log("Dashboard: Initializing Core...");
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = 'default-app-id'; // Sync with your main app.js

// --- State & Editors ---
let currentUser = null;
let adminProfile = null;
let lastQuestionSnapshot = null;
let lastStudentSnapshot = null;
let quillQuestion = null;
let quillExplanation = null;

// --- AUTH & RBAC GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        try {
            // RBAC: Check Admin Directory
            const adminDoc = await getDoc(doc(db, "admin_directory", user.uid));
            
            if (adminDoc.exists()) {
                adminProfile = adminDoc.data();
                updateProfileUI(adminProfile);
                revealDashboard(); 
                initRichTextEditors(); // Initialize Quill
                initDashboard(); 
            } else {
                throw new Error("User not found in admin directory");
            }
        } catch (error) {
            console.error("Access Error:", error);
            handleAuthError(error.message);
        }
    } else {
        window.location.href = 'login.html';
    }
});

// --- UI HELPERS ---
function revealDashboard() {
    document.getElementById('auth-loader').classList.add('hidden');
    document.getElementById('app-layout').classList.remove('hidden');
}

function handleAuthError(msg) {
    const loader = document.getElementById('auth-loader');
    if (loader) {
        loader.innerHTML = `
            <div class="text-center text-red-500 p-8">
                <i class="fas fa-lock text-4xl mb-4"></i>
                <p class="font-bold mb-4">Access Denied: ${msg}</p>
                <button class="bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-600" onclick="location.href='login.html'">Go to Login</button>
            </div>`;
    }
}

function updateProfileUI(profile) {
    document.getElementById('admin-name-display').textContent = profile.name || "Admin";
    document.getElementById('admin-role-display').textContent = (profile.role || "Staff").replace('_', ' ').toUpperCase();
    document.getElementById('admin-avatar').textContent = (profile.name || "A").charAt(0).toUpperCase();
}

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// --- NAVIGATION ---
window.switchView = (viewId) => {
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`nav-${viewId}`).classList.add('active');
};

// ==========================================================================
// 1. CORE: INITIALIZATION & STATS
// ==========================================================================

async function initDashboard() {
    // Load High-Level Counts
    loadStatCount('artifacts/' + APP_ID + '/users', 'stat-total-users'); // Correct path for users
    loadStatCount('quizzieQuestionBank', 'stat-questions');
    loadStatCount('system_notifications', 'stat-broadcasts');
    
    // Load Initial Tables
    loadMentorshipRequests(); // Now with Status Workflow
    loadNotifications();
    loadQuestions(); // Now with Rich Text support
    loadStudents(); // New Student Directory
}

async function loadStatCount(colPath, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    try {
        // Note: collection() takes (db, path), not a string path directly in v9 modular
        // We need to split the path for modular SDK
        let colRef;
        if(colPath.includes('/')) {
             const parts = colPath.split('/');
             colRef = collection(db, parts[0], parts[1], parts[2]);
        } else {
             colRef = collection(db, colPath);
        }
        
        const snapshot = await getCountFromServer(colRef);
        el.textContent = snapshot.data().count;
    } catch (e) {
        console.warn(`Stats error (${colPath}):`, e);
        el.textContent = "-";
    }
}

// ==========================================================================
// 2. STUDENT CRM (NEW)
// ==========================================================================

async function loadStudents(loadMore = false) {
    const tbody = document.getElementById('students-table-body');
    if (!tbody) return;

    if (!loadMore) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">Loading directory...</td></tr>';
        lastStudentSnapshot = null;
    }

    try {
        const usersRef = collection(db, "artifacts", APP_ID, "users");
        let q = query(usersRef, orderBy("profile.createdAt", "desc"), limit(20));

        if (loadMore && lastStudentSnapshot) {
            q = query(usersRef, orderBy("profile.createdAt", "desc"), startAfter(lastStudentSnapshot), limit(20));
        }

        const snapshot = await getDocs(q);
        
        if (!loadMore) tbody.innerHTML = '';
        if (snapshot.empty && !loadMore) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">No students found.</td></tr>';
            return;
        }

        lastStudentSnapshot = snapshot.docs[snapshot.docs.length - 1];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const p = data.profile || {};
            const date = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString() : 'N/A';
            
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer";
            tr.onclick = (e) => {
                if(!e.target.closest('button')) window.viewStudentDetails(docSnap.id, p);
            };
            
            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-white flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">${(p.firstName || 'U').charAt(0)}</div>
                    ${p.firstName || 'Unknown'} ${p.lastName || ''}
                </td>
                <td class="px-6 py-4 text-slate-400">${p.email}</td>
                <td class="px-6 py-4 text-slate-500 text-xs">${date}</td>
                <td class="px-6 py-4 text-blue-400 text-xs uppercase">${p.optionalSubject || 'None'}</td>
                <td class="px-6 py-4 text-right">
                    <button class="text-slate-500 hover:text-white"><i class="fas fa-chevron-right"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        const loadBtn = document.getElementById('load-more-students');
        if(loadBtn) loadBtn.style.display = snapshot.size < 20 ? 'none' : 'block';

    } catch (e) {
        console.error("Student Load Error:", e);
    }
}

// --- Student Search (By Email) ---
const searchInput = document.getElementById('student-search');
if(searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const term = e.target.value.trim();
            if(term.length < 3) { if(term.length === 0) loadStudents(); return; }
            
            // Firestore doesn't do partial string search natively easily. 
            // We'll do an exact match query for email for robustness.
            const usersRef = collection(db, "artifacts", APP_ID, "users");
            const q = query(usersRef, where("profile.email", "==", term));
            
            const tbody = document.getElementById('students-table-body');
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">Searching...</td></tr>';
            
            const snap = await getDocs(q);
            tbody.innerHTML = '';
            
            if(snap.empty) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">No exact email match found.</td></tr>';
            } else {
                snap.forEach(docSnap => {
                     const p = docSnap.data().profile || {};
                     const date = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString() : 'N/A';
                     const tr = document.createElement('tr');
                     tr.className = "border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer";
                     tr.onclick = () => window.viewStudentDetails(docSnap.id, p);
                     tr.innerHTML = `<td class="px-6 py-4 text-white">${p.firstName} ${p.lastName}</td><td class="px-6 py-4 text-slate-400">${p.email}</td><td class="px-6 py-4 text-slate-500">${date}</td><td class="px-6 py-4 text-blue-400">${p.optionalSubject || 'None'}</td><td class="px-6 py-4 text-right"><i class="fas fa-chevron-right"></i></td>`;
                     tbody.appendChild(tr);
                });
            }
        }, 800);
    });
}

window.viewStudentDetails = async (uid, profile) => {
    // 1. Populate Basic Info
    document.getElementById('student-modal-name').textContent = `${profile.firstName || 'User'} ${profile.lastName || ''}`;
    document.getElementById('student-modal-email').textContent = profile.email;
    document.getElementById('student-modal-avatar').textContent = (profile.firstName || 'U').charAt(0);
    
    // 2. Fetch Quiz Stats
    const quizRef = doc(db, "users", uid, "quizData", "seen"); // Note path: /users/{uid}/... based on your quiz logic
    const quizSnap = await getDoc(quizRef);
    const quizCount = quizSnap.exists() ? (quizSnap.data().seenQuestionIds?.length || 0) : 0;
    document.getElementById('student-stat-quizzes').textContent = quizCount;

    // 3. Fetch Progress Stats
    const progRef = doc(db, "artifacts", APP_ID, "users", uid, "progress", "summary");
    const progSnap = await getDoc(progRef);
    const progress = progSnap.exists() ? (progSnap.data().overall || 0) : 0;
    document.getElementById('student-stat-progress').textContent = `${progress}%`;

    // 4. Audit Log (Recent Activity Placeholder)
    // In a full app, you'd query a 'user_logs' collection. For now, we show registration.
    const activityBody = document.getElementById('student-activity-log');
    activityBody.innerHTML = `
        <tr class="border-b border-slate-800">
            <td class="px-4 py-2">Account Created</td>
            <td class="px-4 py-2 text-slate-500">${profile.createdAt?.toDate ? profile.createdAt.toDate().toLocaleDateString() : 'Unknown'}</td>
        </tr>`;

    window.openModal('modal-student-details');
};

// ==========================================================================
// 3. QUESTION BANK 2.0 (RICH TEXT & BULK UPLOAD)
// ==========================================================================

function initRichTextEditors() {
    if (!quillQuestion) {
        quillQuestion = new Quill('#quill-q-text', {
            theme: 'snow',
            placeholder: 'Type question here...',
            modules: { toolbar: [['bold', 'italic', 'underline', 'code-block'], [{'list': 'ordered'}, {'list': 'bullet'}], ['clean']] }
        });
    }
    if (!quillExplanation) {
        quillExplanation = new Quill('#quill-q-explanation', {
            theme: 'snow',
            placeholder: 'Explain the answer...',
            modules: { toolbar: [['bold', 'italic', 'underline'], [{'list': 'ordered'}, {'list': 'bullet'}], ['link', 'clean']] }
        });
    }
}

// --- Bulk Upload Logic ---
const csvInput = document.getElementById('csv-file-input');
const processBtn = document.getElementById('btn-process-csv');

document.getElementById('drop-zone')?.addEventListener('click', () => csvInput.click());
csvInput?.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        processBtn.disabled = false;
        processBtn.textContent = `Upload ${e.target.files[0].name}`;
        processBtn.classList.remove('bg-slate-600', 'cursor-not-allowed');
        processBtn.classList.add('bg-blue-600', 'hover:bg-blue-500');
    }
});

processBtn?.addEventListener('click', () => {
    const file = csvInput.files[0];
    if (!file) return;

    // Show Loading UI
    document.getElementById('upload-status').classList.remove('hidden');
    document.getElementById('csv-errors').classList.add('hidden');
    processBtn.disabled = true;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            const rows = results.data;
            const errors = [];
            const batchArray = []; // We might need multiple batches
            
            // 1. Validation
            const validRows = rows.filter((row, index) => {
                if (!row.question || !row.answer) {
                    errors.push(`Row ${index + 2}: Missing Question or Answer`);
                    return false;
                }
                return true;
            });

            if (errors.length > 0) {
                displayCsvErrors(errors);
                document.getElementById('upload-status').classList.add('hidden');
                processBtn.disabled = false;
                return; // Stop if validation fails (strict mode) or continue? Let's strict.
            }

            // 2. Batch Write (Chunking by 450 to be safe)
            const CHUNK_SIZE = 450;
            for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
                const chunk = validRows.slice(i, i + CHUNK_SIZE);
                const batch = writeBatch(db);
                
                chunk.forEach(row => {
                    const docRef = doc(collection(db, "quizzieQuestionBank"));
                    batch.set(docRef, {
                        question: row.question,
                        options: [row.optionA || '', row.optionB || '', row.optionC || '', row.optionD || ''],
                        answer: row.answer,
                        subject: row.subject ? row.subject.toLowerCase() : 'general',
                        difficulty: row.difficulty ? row.difficulty.toLowerCase() : 'basic',
                        explanation: row.explanation || '',
                        createdAt: serverTimestamp(),
                        createdBy: currentUser.uid
                    });
                });
                batchArray.push(batch);
            }

            // 3. Commit Batches
            try {
                let progress = 0;
                for (const batch of batchArray) {
                    await batch.commit();
                    progress += (100 / batchArray.length);
                    document.getElementById('upload-progress').style.width = `${progress}%`;
                }
                
                // Log Action
                logAuditAction('bulk_upload', 'questions', `Uploaded ${validRows.length} questions`);

                alert(`Successfully uploaded ${validRows.length} questions!`);
                window.closeModal('modal-bulk-upload');
                loadQuestions(); // Refresh UI
            } catch (err) {
                console.error("Batch Write Error:", err);
                alert("Upload failed: " + err.message);
            } finally {
                document.getElementById('upload-status').classList.add('hidden');
                processBtn.disabled = false;
                processBtn.textContent = "Upload";
            }
        }
    });
});

function displayCsvErrors(errors) {
    const list = document.getElementById('csv-error-list');
    list.innerHTML = errors.map(e => `<li>${e}</li>`).join('');
    document.getElementById('csv-errors').classList.remove('hidden');
}

// --- Modified Save Question (Rich Text) ---
window.saveQuestion = async () => {
    const id = document.getElementById('q-id').value;
    
    // Get HTML from Quill
    const question = quillQuestion.root.innerHTML;
    const explanation = quillExplanation.root.innerHTML;

    // Basic Validation stripping HTML tags
    if (quillQuestion.getText().trim().length === 0) { alert("Question cannot be empty"); return; }

    const options = [
        document.getElementById('q-opt-0').value,
        document.getElementById('q-opt-1').value,
        document.getElementById('q-opt-2').value,
        document.getElementById('q-opt-3').value
    ];
    const answer = document.getElementById('q-answer').value || options[0];
    const subject = document.getElementById('q-subject').value;
    const difficulty = document.getElementById('q-difficulty').value;

    const data = {
        question, options, answer, subject, difficulty, explanation,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid
    };

    try {
        if (id) {
            await updateDoc(doc(db, "quizzieQuestionBank", id), data);
            logAuditAction('update', id, 'Updated Question');
        } else {
            data.createdAt = serverTimestamp();
            const ref = await setDoc(doc(collection(db, "quizzieQuestionBank")), data);
            logAuditAction('create', 'new_question', 'Created Question');
        }
        window.closeModal('modal-question-editor');
        loadQuestions();
    } catch (e) { alert("Failed to save: " + e.message); }
};

// ==========================================================================
// 4. MENTORSHIP WORKFLOW (UPDATED)
// ==========================================================================

window.loadMentorshipRequests = async () => {
    const tbody = document.getElementById('mentorship-table-body');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-500">Loading requests...</td></tr>';

    try {
        // Fetch ALL users with a mentorship request (not just pending)
        // Ideally, you would move requests to a separate collection 'mentorship_requests' for better indexing
        // But adhering to existing structure:
        const usersRef = collection(db, "artifacts", APP_ID, "users");
        // We filter by existence of requestedAt
        const q = query(usersRef, orderBy("mentorshipRequest.requestedAt", "desc"), limit(50));
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-500">No requests found.</td></tr>';
            document.getElementById('stat-mentorship').textContent = "0";
            return;
        }

        document.getElementById('stat-mentorship').textContent = snapshot.size;
        tbody.innerHTML = '';
        
        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            const req = d.mentorshipRequest;
            const status = req.status || 'pending';
            
            // Status Badge Logic
            let statusBadge = '';
            if(status === 'pending') statusBadge = '<span class="bg-yellow-900 text-yellow-300 text-xs px-2 py-1 rounded">Pending</span>';
            else if(status === 'contacted') statusBadge = '<span class="bg-blue-900 text-blue-300 text-xs px-2 py-1 rounded">Contacted</span>';
            else if(status === 'closed') statusBadge = '<span class="bg-green-900 text-green-300 text-xs px-2 py-1 rounded">Done</span>';

            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-800 hover:bg-slate-800/50 transition-colors";
            tr.innerHTML = `
                <td class="px-6 py-4">
                    <div class="font-medium text-white">${req.name || 'Unknown'}</div>
                    <div class="text-xs text-slate-500">${req.email}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm text-slate-300">${req.details || '-'}</div>
                </td>
                <td class="px-6 py-4 text-xs text-slate-500">
                    ${req.requestedAt?.toDate ? req.requestedAt.toDate().toLocaleDateString() : 'N/A'}
                    <div class="mt-1">${statusBadge}</div>
                </td>
                <td class="px-6 py-4 text-right space-x-2">
                    ${status !== 'contacted' ? `<button onclick="updateMentorshipStatus('${docSnap.id}', 'contacted')" class="text-blue-400 hover:underline text-xs">Mark Contacted</button>` : ''}
                    ${status !== 'closed' ? `<button onclick="updateMentorshipStatus('${docSnap.id}', 'closed')" class="text-green-400 hover:underline text-xs">Close</button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Mentorship Load Error:", e);
    }
};

window.updateMentorshipStatus = async (uid, status) => {
    try {
        const docRef = doc(db, "artifacts", APP_ID, "users", uid);
        await updateDoc(docRef, {
            "mentorshipRequest.status": status,
            "mentorshipRequest.updatedAt": serverTimestamp(),
            "mentorshipRequest.updatedBy": currentUser.uid
        });
        logAuditAction('mentorship_update', uid, `Set status to ${status}`);
        loadMentorshipRequests(); // Refresh
    } catch (e) {
        alert("Error updating status: " + e.message);
    }
};


// ==========================================================================
// 5. SECURITY LOGGING (NEW)
// ==========================================================================

async function logAuditAction(action, targetId, details) {
    try {
        await setDoc(doc(collection(db, "admin_logs")), {
            adminId: currentUser.uid,
            adminName: adminProfile.name || 'Unknown',
            action: action,
            targetId: targetId,
            details: details,
            timestamp: serverTimestamp()
        });
    } catch (e) {
        console.warn("Failed to write audit log:", e);
    }
}

// --- EXISTING FUNCTIONS (Notification, Question Load, Modal Utils) ---
// (These are preserved but consolidated for brevity)

// Question Loader (Optimized for Rich Text Preview)
window.editQuestion = async (id) => {
    const docSnap = await getDoc(doc(db, "quizzieQuestionBank", id));
    if (!docSnap.exists()) return;
    const d = docSnap.data();

    document.getElementById('q-id').value = id;
    // Set Quill Content
    quillQuestion.root.innerHTML = d.question;
    quillExplanation.root.innerHTML = d.explanation || '';

    document.getElementById('q-opt-0').value = d.options[0] || '';
    document.getElementById('q-opt-1').value = d.options[1] || '';
    document.getElementById('q-opt-2').value = d.options[2] || '';
    document.getElementById('q-opt-3').value = d.options[3] || '';
    document.getElementById('q-subject').value = d.subject;
    
    const select = document.getElementById('q-answer');
    select.innerHTML = '';
    d.options.forEach((opt, i) => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = `Option ${String.fromCharCode(65+i)}`;
        select.appendChild(o);
    });
    select.value = d.answer;

    document.getElementById('q-modal-title').textContent = "Edit Question";
    window.openModal('modal-question-editor');
};

// Basic Modal Utils (Must be global)
window.openModal = (id) => {
    const el = document.getElementById(id);
    el.classList.remove('hidden');
    requestAnimationFrame(() => {
        el.classList.remove('opacity-0');
        el.querySelector('div').classList.remove('scale-95');
        el.querySelector('div').classList.add('scale-100');
    });
};

window.closeModal = (id) => {
    const el = document.getElementById(id);
    el.classList.add('opacity-0');
    el.querySelector('div').classList.remove('scale-100');
    el.querySelector('div').classList.add('scale-95');
    setTimeout(() => el.classList.add('hidden'), 200);
};

window.loadQuestions = async (loadMore = false) => {
    // Re-implementing the basic loader to ensure it's available
    const tbody = document.getElementById('questions-table-body');
    if(!tbody) return;
    if(!loadMore) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-slate-500 py-4">Loading...</td></tr>';
    
    const qRef = collection(db, "quizzieQuestionBank");
    const q = query(qRef, orderBy("createdAt", "desc"), limit(10));
    const snap = await getDocs(q);
    
    tbody.innerHTML = '';
    snap.forEach(doc => {
        const data = doc.data();
        // Strip HTML for preview
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = data.question;
        const plainText = tempDiv.textContent || tempDiv.innerText || "";
        
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-800 hover:bg-slate-800/50";
        tr.innerHTML = `
            <td class="px-6 py-4"><div class="line-clamp-2 text-white">${plainText}</div></td>
            <td class="px-6 py-4 text-slate-400 capitalize">${data.subject}</td>
            <td class="px-6 py-4 text-slate-500">${data.difficulty}</td>
            <td class="px-6 py-4 text-right"><button onclick="window.editQuestion('${doc.id}')" class="text-blue-400 mr-2"><i class="fas fa-edit"></i></button><button onclick="window.deleteQuestion('${doc.id}')" class="text-red-400"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
};

window.deleteQuestion = async (id) => {
    if(confirm("Delete question?")) {
        await deleteDoc(doc(db, "quizzieQuestionBank", id));
        logAuditAction('delete', id, 'Deleted Question');
        loadQuestions();
    }
};

window.loadNotifications = async () => {
    // Basic implementation placeholder if needed, same as previous
    const container = document.getElementById('active-notifications-list');
    if(!container) return;
    const q = query(collection(db, "system_notifications"), where("active", "==", true), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    container.innerHTML = snap.empty ? '<p class="text-slate-500 text-sm">No active broadcasts.</p>' : '';
    snap.forEach(d => {
        const data = d.data();
        const div = document.createElement('div');
        div.className = "bg-slate-800 p-3 rounded border border-slate-700 flex justify-between mb-2";
        div.innerHTML = `<div><span class="text-xs bg-blue-900 text-blue-300 px-1 rounded uppercase mr-2">${data.type}</span><span class="text-sm text-white">${data.message}</span></div><button onclick="window.stopBroadcast('${d.id}')" class="text-red-400"><i class="fas fa-times"></i></button>`;
        container.appendChild(div);
    });
};

window.stopBroadcast = async (id) => {
    if(confirm("Stop broadcast?")) {
        await deleteDoc(doc(db, "system_notifications", id));
        logAuditAction('stop_broadcast', id, 'Stopped Notification');
        loadNotifications();
    }
};

// ==========================================================================
// 6. ADMIN TEAM MANAGEMENT (MISSING LOGIC RESTORED)
// ==========================================================================

async function loadAdminUsers() {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;

    // Set loading state
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-500">Loading team...</td></tr>';

    try {
        // Query the admin_directory collection
        const q = query(collection(db, "admin_directory"), orderBy("role"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-500">No admins found.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-800 hover:bg-slate-800/50 transition-colors";
            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-white flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">
                        ${(d.name || 'A').charAt(0).toUpperCase()}
                    </div>
                    ${d.name || 'Unknown'}
                </td>
                <td class="px-6 py-4 text-slate-400 capitalize">
                    <span class="bg-slate-700 px-2 py-1 rounded text-xs">${(d.role || 'Staff').replace('_', ' ')}</span>
                </td>
                <td class="px-6 py-4 text-slate-500 text-xs">${d.email || 'No Email'}</td>
                <td class="px-6 py-4 text-right">
                    <button onclick="window.removeAdmin('${docSnap.id}')" class="text-red-400 hover:text-red-300 p-2 rounded hover:bg-red-400/10 transition-colors" title="Remove Access">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Admin Load Error:", e);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-red-500 py-8">Error loading data: ${e.message}</td></tr>`;
    }
}

// Remove Admin Function
window.removeAdmin = async (id) => {
    if (confirm("Are you sure you want to remove this user's admin access?")) {
        try {
            await deleteDoc(doc(db, "admin_directory", id));
            logAuditAction('remove_admin', id, 'Removed Admin User');
            loadAdminUsers(); // Refresh table
            alert("Admin removed successfully.");
        } catch (e) {
            console.error(e);
            alert("Error removing admin: " + e.message);
        }
    }
};

// Add Admin Form Listener
const addAdminForm = document.getElementById('add-admin-form');
if (addAdminForm) {
    addAdminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = e.target.elements['name'].value;
        const email = e.target.elements['email'].value;
        const role = e.target.elements['role'].value;
        const btn = e.target.querySelector('button[type="submit"]');
        
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Adding...";

        try {
            // IMPORTANT: In a client-side app without Cloud Functions, we cannot 
            // easily get the UID from an email. We will create the doc, but 
            // you might need to manually ensure the Document ID matches the User UID 
            // in the Firebase Console if your auth logic depends on it.
            
            // ideally, use the UID as the document key. Since we don't have it, 
            // we let Firestore generate an ID or use email as ID (if your auth logic supports it).
            // For now, we add it to the directory so they appear in the list.
            
            await setDoc(doc(collection(db, "admin_directory")), {
                name: name,
                email: email,
                role: role,
                addedBy: currentUser.uid,
                createdAt: serverTimestamp()
            });

            logAuditAction('add_admin', email, `Added new ${role}`);
            
            window.closeModal('modal-add-admin');
            e.target.reset();
            loadAdminUsers(); // Refresh table
            alert("User added to Admin Directory.\n\nNOTE: Ensure the user's Firebase Auth UID matches this document ID if they cannot log in.");

        } catch (error) {
            console.error("Add Admin Error:", error);
            alert("Failed to add admin: " + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}
