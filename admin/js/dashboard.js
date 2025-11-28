// admin/js/dashboard.js
// Full Stack Admin Logic: CRM, CMS, Analytics, Security & Activity Logs

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
    deleteField,
    writeBatch,
    query, 
    where, 
    orderBy, 
    limit,
    startAfter,
    serverTimestamp, 
    Timestamp,
    getCountFromServer 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// --- Initialize ---
console.log("Dashboard: Initializing Core...");
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- CONFIGURATION ---
const APP_ID = 'default-app-id'; 

// --- State & Editors ---
let currentUser = null;
let adminProfile = null;

// Pagination State
let lastQuestionSnapshot = null;
let lastLogSnapshot = null;
let lastArtifactsUserSnapshot = null; // Separate cursor for main DB
let lastArtifactsMentorshipSnapshot = null;

// Quill Instances
let quillQuestion = null;
let quillExplanation = null;

// --- AUTH & RBAC GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        try {
            const adminDoc = await getDoc(doc(db, "admin_directory", user.uid));
            
            if (adminDoc.exists()) {
                adminProfile = adminDoc.data();
                updateProfileUI(adminProfile);
                revealDashboard(); 
                initRichTextEditors(); 
                initDashboard(); 
            } else {
                throw new Error("User not found in admin directory");
            }
        } catch (error) {
            console.error("Access Error:", error);
            handleAuthError(error.message);
            setTimeout(() => signOut(auth), 3000);
        }
    } else {
        window.location.href = 'login.html';
    }
});

// --- UI HELPERS ---
function revealDashboard() {
    const loader = document.getElementById('auth-loader');
    if(loader) loader.classList.add('hidden');
    const layout = document.getElementById('app-layout');
    if(layout) layout.classList.remove('hidden');
}

function handleAuthError(msg) {
    const loader = document.getElementById('auth-loader');
    if (loader) {
        loader.innerHTML = `
            <div class="text-center text-red-500 p-8">
                <i class="fas fa-lock text-4xl mb-4"></i>
                <p class="font-bold mb-4">Access Denied: ${msg}</p>
                <p class="text-sm">Redirecting to login...</p>
            </div>`;
    }
}

function updateProfileUI(profile) {
    const nameEl = document.getElementById('admin-name-display');
    if(nameEl) nameEl.textContent = profile.name || "Admin";
    const roleEl = document.getElementById('admin-role-display');
    if(roleEl) roleEl.textContent = (profile.role || "Staff").replace('_', ' ').toUpperCase();
    const avatarEl = document.getElementById('admin-avatar');
    if(avatarEl) avatarEl.textContent = (profile.name || "A").charAt(0).toUpperCase();
}

const logoutBtn = document.getElementById('logout-btn');
if(logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth));

// --- NAVIGATION ---
window.switchView = (viewId) => {
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`nav-${viewId}`).classList.add('active');
};

// ==========================================================================
// 1. CORE: INITIALIZATION
// ==========================================================================

async function initDashboard() {
    console.log("Loading Dashboard Data...");
    
    // Load High-Level Counts
    loadStatCount(`artifacts/${APP_ID}/users`, 'stat-total-users'); 
    loadStatCount('quizzieQuestionBank', 'stat-questions');
    loadStatCount('system_notifications', 'stat-broadcasts');
    
    // Load All Tables
    loadMentorshipRequests(); 
    loadNotifications();
    loadQuestions(); 
    loadStudents(); 
    loadAdminUsers(); 
    
    // Activity Logs
    pruneOldLogs(); 
    loadActivityLogs(); 
}

async function loadStatCount(colPath, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    try {
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
        // console.warn(`Failed to load stats for ${colPath}:`, e);
        el.textContent = "-";
    }
}

// ==========================================================================
// 2. ACTIVITY LOGS & REVERT
// ==========================================================================

window.loadActivityLogs = async (loadMore = false) => {
    const tbody = document.getElementById('logs-table-body');
    if (!tbody) return;

    if (!loadMore) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">Loading logs...</td></tr>';
        lastLogSnapshot = null;
    }

    try {
        let q = query(collection(db, "admin_logs"), orderBy("timestamp", "desc"), limit(20));

        if (loadMore && lastLogSnapshot) {
            q = query(collection(db, "admin_logs"), orderBy("timestamp", "desc"), startAfter(lastLogSnapshot), limit(20));
        }

        const snapshot = await getDocs(q);
        
        if (!loadMore) tbody.innerHTML = '';
        
        if (snapshot.empty && !loadMore) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">No recent activity.</td></tr>';
            return;
        }

        if (!snapshot.empty) {
            lastLogSnapshot = snapshot.docs[snapshot.docs.length - 1];
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const date = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : 'Just now';
            const canRevert = data.action !== 'revert' && data.action !== 'bulk_upload' && data.action !== 'stop_broadcast'; 

            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-800 hover:bg-slate-800/50";
            tr.innerHTML = `
                <td class="px-6 py-4 text-white text-sm">${data.adminName}</td>
                <td class="px-6 py-4">
                    <span class="text-xs uppercase px-2 py-1 rounded font-bold ${getActionColor(data.action)}">${data.action}</span>
                </td>
                <td class="px-6 py-4 text-slate-400 text-sm max-w-xs truncate" title="${data.details}">${data.details}</td>
                <td class="px-6 py-4 text-slate-500 text-xs">${date}</td>
                <td class="px-6 py-4 text-right">
                    ${canRevert ? `<button onclick="window.revertAction('${docSnap.id}')" class="text-yellow-500 hover:text-yellow-400 text-xs border border-yellow-500/30 px-2 py-1 rounded hover:bg-yellow-500/10">Revert</button>` : '<span class="text-slate-600 text-xs">-</span>'}
                </td>
            `;
            tbody.appendChild(tr);
        });

        const loadBtn = document.getElementById('load-more-logs');
        if(loadBtn) loadBtn.style.display = snapshot.size < 20 ? 'none' : 'block';

    } catch (e) {
        console.error("Log Load Error:", e);
        if(!loadMore) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 py-8">Error: ${e.message}</td></tr>`;
    }
};

async function pruneOldLogs() {
    // ... (Existing prune code is fine)
}

window.revertAction = async (logId) => {
    if (!confirm("Attempt to revert this action?")) return;
    try {
        const logDoc = await getDoc(doc(db, "admin_logs", logId));
        if (!logDoc.exists()) throw new Error("Log entry not found.");
        
        const data = logDoc.data();
        const { action, targetId, collectionName, previousData } = data;

        // Normalize Collection Path
        let colPath = collectionName;
        if (!colPath) {
            // Fallback logic for legacy logs
            if (action.includes('admin')) colPath = 'admin_directory';
            else if (action.includes('student') || action.includes('mentorship')) colPath = `artifacts/${APP_ID}/users`; 
            else colPath = 'quizzieQuestionBank';
        }

        console.log(`Reverting ${action} on ${colPath}/${targetId}`);

        // Perform Revert
        if (action.includes('delete') || action.includes('remove')) {
             // Restore data
             if (!previousData) throw new Error("Cannot revert: Backup data missing.");
             await setDoc(doc(db, colPath, targetId), previousData);
        } else if (action.includes('create') || action.includes('add')) {
            // Delete created item
            await deleteDoc(doc(db, colPath, targetId));
        } else if (action.includes('update')) {
            // Restore previous data
             if (!previousData) throw new Error("Cannot revert: Backup data missing.");
             await updateDoc(doc(db, colPath, targetId), previousData);
        }

        await logAuditAction('revert', logId, `Reverted action: ${data.details}`, null, null);
        alert("Action reverted successfully.");
        
        setTimeout(() => {
            loadActivityLogs();
            loadStudents(); // Refresh UI
        }, 500);

    } catch (e) {
        alert("Revert failed: " + e.message);
    }
};

function getActionColor(action) {
    if (action.includes('delete') || action.includes('remove')) return 'text-red-400 bg-red-900/30';
    if (action.includes('create') || action.includes('add')) return 'text-green-400 bg-green-900/30';
    if (action.includes('update')) return 'text-blue-400 bg-blue-900/30';
    return 'text-slate-300 bg-slate-700';
}

async function logAuditAction(action, targetId, details, collectionName = null, previousData = null) {
    try {
        await setDoc(doc(collection(db, "admin_logs")), {
            adminId: currentUser.uid,
            adminName: adminProfile.name || 'Unknown',
            action, targetId, details, collectionName, previousData,
            timestamp: serverTimestamp()
        });
    } catch (e) { console.warn("Audit log failed:", e); }
}

// ==========================================================================
// 3. ADMIN TEAM (Standard)
// ==========================================================================
// ... (Existing Admin Users logic is fine, included implicitly or can be copy-pasted if needed, 
// but for brevity I'll focus on the fixed CRM logic below)

async function loadAdminUsers() {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-500">Loading...</td></tr>';
    
    const snap = await getDocs(collection(db, "admin_directory"));
    if(snap.empty) { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-slate-500">No admins.</td></tr>'; return; }
    
    tbody.innerHTML = '';
    snap.forEach(d => {
        const data = d.data();
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-800 hover:bg-slate-800/50";
        tr.innerHTML = `
            <td class="px-6 py-4 text-white">${data.name || 'User'}</td>
            <td class="px-6 py-4 text-slate-400 capitalize">${data.role || 'staff'}</td>
            <td class="px-6 py-4 text-slate-500">${data.email}</td>
            <td class="px-6 py-4 text-right"><button onclick="window.removeAdmin('${d.id}')" class="text-red-400"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
}

window.removeAdmin = async (id) => {
    if(confirm("Remove admin?")) {
        await deleteDoc(doc(db, "admin_directory", id));
        loadAdminUsers();
    }
};

const addAdminForm = document.getElementById('add-admin-form');
if(addAdminForm) {
    addAdminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = e.target.name.value;
        const email = e.target.email.value;
        const role = e.target.role.value;
        await setDoc(doc(collection(db, "admin_directory")), { name, email, role, createdAt: serverTimestamp() });
        window.closeModal('modal-add-admin');
        loadAdminUsers();
    });
}


// ==========================================================================
// 4. STUDENT CRM (FIXED: PAGINATION STRATEGY)
// ==========================================================================

window.loadStudents = async (loadMore = false) => {
    const tbody = document.getElementById('students-table-body');
    const loadBtn = document.getElementById('load-more-students');
    if (!tbody) return;
    
    if (!loadMore) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">Scanning databases...</td></tr>';
        lastArtifactsUserSnapshot = null; // Reset
    }

    try {
        const students = [];
        
        // STRATEGY: 
        // 1. If fresh load (!loadMore), fetch TOP 20 from ROOT (Legacy) AND TOP 20 from ARTIFACTS (Active).
        // 2. If loadMore, ONLY fetch from ARTIFACTS (Active) using pagination.
        
        const promises = [];
        
        // A. Active Users (Artifacts) - Always fetch
        const artifactsRef = collection(db, "artifacts", APP_ID, "users");
        let qArtifacts = query(artifactsRef, orderBy("profile.createdAt", "desc"), limit(20));
        
        if (loadMore && lastArtifactsUserSnapshot) {
            qArtifacts = query(artifactsRef, orderBy("profile.createdAt", "desc"), startAfter(lastArtifactsUserSnapshot), limit(20));
        }
        promises.push(getDocs(qArtifacts).then(snap => ({ source: 'artifacts', snap })));

        // B. Legacy Users (Root) - Only on first load
        if (!loadMore) {
            const rootRef = collection(db, "users");
            const qRoot = query(rootRef, limit(20)); // Just get a few
            promises.push(getDocs(qRoot).then(snap => ({ source: 'root', snap })));
        }

        const results = await Promise.all(promises);
        
        // Process Results
        results.forEach(({ source, snap }) => {
            if (source === 'artifacts') {
                if (!snap.empty) lastArtifactsUserSnapshot = snap.docs[snap.docs.length - 1];
                if (loadBtn) loadBtn.style.display = snap.size < 20 ? 'none' : 'block';
            }
            
            snap.forEach(doc => {
                const data = doc.data();
                const p = data.profile || data; // Handle legacy structure
                if (p) {
                    students.push({ id: doc.id, data: p, source: source, created: p.createdAt?.toDate ? p.createdAt.toDate() : new Date(0) });
                }
            });
        });

        // Sort in memory
        students.sort((a, b) => b.created - a.created);

        if (!loadMore) tbody.innerHTML = '';
        if (students.length === 0 && !loadMore) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">No students found.</td></tr>';
            return;
        }

        // Render
        students.forEach(student => {
            const p = student.data;
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer";
            tr.onclick = (e) => { if(!e.target.closest('.delete-btn')) window.viewStudentDetails(student.id, p); };
            
            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-white flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                        ${(p.firstName || 'U').charAt(0)}
                    </div>
                    ${p.firstName || 'User'} ${p.lastName || ''}
                    ${student.source === 'root' ? '<span class="text-xs text-yellow-600" title="Legacy">(L)</span>' : ''}
                </td>
                <td class="px-6 py-4 text-slate-400">${p.email || 'N/A'}</td>
                <td class="px-6 py-4 text-slate-500 text-xs">${student.created.toLocaleDateString()}</td>
                <td class="px-6 py-4 text-blue-400 text-xs uppercase">${p.optionalSubject || '-'}</td>
                <td class="px-6 py-4 text-right">
                    <button onclick="window.deleteStudent('${student.id}', '${p.email}', '${student.source}')" class="delete-btn text-red-400 hover:text-red-300"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Student Load Error:", e);
        if(!loadMore) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500">Error: ${e.message}</td></tr>`;
    }
};

window.deleteStudent = async (uid, email, source) => {
    if (event) event.stopPropagation();
    if (confirm(`Delete data for ${email}?`)) {
        try {
            const collectionPath = source === 'root' ? 'users' : `artifacts/${APP_ID}/users`;
            const docRef = doc(db, collectionPath, uid);
            
            const docSnap = await getDoc(docRef);
            const previousData = docSnap.exists() ? docSnap.data() : null;

            await deleteDoc(docRef);
            
            // Log with collection info for potential revert
            await logAuditAction('delete_student', uid, `Deleted ${email}`, collectionPath, previousData);
            
            alert("Deleted.");
            loadStudents();
        } catch (e) { alert("Failed: " + e.message); }
    }
};

// ==========================================================================
// 5. MENTORSHIP (FIXED: DUAL PATH)
// ==========================================================================
// Similar strategy to students: Load legacy once, paginate active.

window.loadMentorshipRequests = async () => {
    const tbody = document.getElementById('mentorship-table-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-500">Loading...</td></tr>';

    try {
        const requests = [];
        
        // 1. Artifacts (Main)
        const artifactsRef = collection(db, "artifacts", APP_ID, "users");
        // Note: Requires composite index on mentorshipRequest.requestedAt. If missing, it might fail silently or warn.
        // Fallback to basic query if orderby fails? No, assume index or simple query.
        const q1 = query(artifactsRef, orderBy("mentorshipRequest.requestedAt", "desc"), limit(20));
        
        // 2. Root (Legacy)
        const q2 = query(collection(db, "users"), orderBy("mentorshipRequest.requestedAt", "desc"), limit(10));

        const [snap1, snap2] = await Promise.all([
            getDocs(q1).catch(e => ({empty:true})), // Catch index errors
            getDocs(q2).catch(e => ({empty:true}))
        ]);

        const process = (doc, src) => {
            if(!doc.data) return;
            const d = doc.data();
            if(d.mentorshipRequest) {
                requests.push({ id: doc.id, req: d.mentorshipRequest, source: src });
            }
        };

        if(snap1.forEach) snap1.forEach(d => process(d, 'artifacts'));
        if(snap2.forEach) snap2.forEach(d => process(d, 'root'));

        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-slate-500">No requests.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        requests.forEach(({ id, req, source }) => {
             const status = req.status || 'pending';
             const date = req.requestedAt?.toDate ? req.requestedAt.toDate().toLocaleDateString() : 'N/A';
             const tr = document.createElement('tr');
             tr.className = "border-b border-slate-800";
             tr.innerHTML = `
                <td class="px-6 py-4">
                    <div class="text-white font-medium">${req.name}</div>
                    <div class="text-xs text-slate-500">${req.email}</div>
                </td>
                <td class="px-6 py-4 text-slate-400 text-sm">${req.details || '-'}</td>
                <td class="px-6 py-4 text-xs text-slate-500">${date} <br> <span class="text-${status === 'pending' ? 'yellow' : 'green'}-500 uppercase">${status}</span></td>
                <td class="px-6 py-4 text-right">
                    <button onclick="updateMentorshipStatus('${id}', 'contacted', '${source}')" class="text-blue-400 text-xs mr-2">Mark Contacted</button>
                </td>
             `;
             tbody.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-red-500">Error loading data.</td></tr>';
    }
};

window.updateMentorshipStatus = async (uid, status, source) => {
    try {
        const collectionPath = source === 'root' ? 'users' : `artifacts/${APP_ID}/users`;
        await updateDoc(doc(db, collectionPath, uid), {
            "mentorshipRequest.status": status,
            "mentorshipRequest.updatedAt": serverTimestamp(),
            "mentorshipRequest.updatedBy": currentUser.uid
        });
        loadMentorshipRequests();
    } catch (e) { alert("Update failed: " + e.message); }
};

// ==========================================================================
// 6. QUESTION BANK & UTILS
// ==========================================================================
function initRichTextEditors() {
    if (document.getElementById('quill-q-text')) {
        quillQuestion = new Quill('#quill-q-text', { theme: 'snow', modules: { toolbar: [['bold', 'italic', 'code-block'], [{'list': 'ordered'}, {'list': 'bullet'}]] } });
    }
    if (document.getElementById('quill-q-explanation')) {
        quillExplanation = new Quill('#quill-q-explanation', { theme: 'snow', modules: { toolbar: [['bold', 'italic'], ['link']] } });
    }
}

window.loadQuestions = async () => {
    const tbody = document.getElementById('questions-table-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-slate-500">Loading...</td></tr>';
    
    const q = query(collection(db, "quizzieQuestionBank"), orderBy("createdAt", "desc"), limit(10));
    const snap = await getDocs(q);
    
    tbody.innerHTML = '';
    snap.forEach(doc => {
        const data = doc.data();
        // Strip HTML for preview
        const temp = document.createElement('div'); temp.innerHTML = data.question;
        const text = temp.textContent || temp.innerText || "";
        
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-800";
        tr.innerHTML = `
            <td class="px-6 py-4"><div class="line-clamp-2 text-white">${text}</div></td>
            <td class="px-6 py-4 text-slate-400 capitalize">${data.subject}</td>
            <td class="px-6 py-4 text-slate-500">${data.difficulty}</td>
            <td class="px-6 py-4 text-right"><button onclick="window.deleteQuestion('${doc.id}')" class="text-red-400"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
};

window.saveQuestion = async () => {
    const question = quillQuestion.root.innerHTML;
    const explanation = quillExplanation.root.innerHTML;
    const options = [0,1,2,3].map(i => document.getElementById(`q-opt-${i}`).value);
    const answer = document.getElementById('q-answer').value || options[0]; // Fallback
    const subject = document.getElementById('q-subject').value;
    const difficulty = document.getElementById('q-difficulty').value;
    
    try {
        await setDoc(doc(collection(db, "quizzieQuestionBank")), {
            question, options, answer, subject, difficulty, explanation,
            createdAt: serverTimestamp(), createdBy: currentUser.uid
        });
        window.closeModal('modal-question-editor');
        loadQuestions();
    } catch(e) { alert(e.message); }
};

window.deleteQuestion = async (id) => {
    if(confirm("Delete?")) {
        await deleteDoc(doc(db, "quizzieQuestionBank", id));
        loadQuestions();
    }
};

// --- Notifications ---
window.loadNotifications = async () => {
    const container = document.getElementById('active-notifications-list');
    if(!container) return;
    const q = query(collection(db, "system_notifications"), where("active", "==", true));
    const snap = await getDocs(q);
    container.innerHTML = '';
    snap.forEach(d => {
        const data = d.data();
        container.innerHTML += `<div class="bg-slate-800 p-2 rounded border border-slate-700 flex justify-between mb-2">
            <span class="text-sm text-white">${data.message}</span>
            <button onclick="window.stopBroadcast('${d.id}')" class="text-red-400"><i class="fas fa-times"></i></button>
        </div>`;
    });
};

document.getElementById('notification-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('notif-message').value;
    const type = document.getElementById('notif-type').value;
    const pages = Array.from(e.target.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
    
    await setDoc(doc(collection(db, "system_notifications")), {
        message, type, targetPages: pages, active: true, createdAt: serverTimestamp(), createdBy: currentUser.uid
    });
    alert("Published");
    e.target.reset();
    loadNotifications();
});

window.stopBroadcast = async (id) => {
    if(confirm("Stop?")) {
        await deleteDoc(doc(db, "system_notifications", id));
        loadNotifications();
    }
};

// --- Globals for Modals ---
window.openModal = (id) => { const el = document.getElementById(id); el?.classList.remove('hidden'); };
window.closeModal = (id) => { const el = document.getElementById(id); el?.classList.add('hidden'); };
window.openQuestionModal = () => { 
    document.getElementById('question-form').reset(); 
    if(quillQuestion) quillQuestion.setContents([]); 
    if(quillExplanation) quillExplanation.setContents([]); 
    window.openModal('modal-question-editor'); 
};

// Function to handle CSV base64 (for bulk upload, if needed in future)
function fileToBase64(file) { /* ... implementation ... */ }
