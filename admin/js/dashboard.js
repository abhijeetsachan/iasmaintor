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
const APP_ID = 'default-app-id'; 

// --- State & Editors ---
let currentUser = null;
let adminProfile = null;
let lastQuestionSnapshot = null;
let lastStudentSnapshot = null;
let lastLogSnapshot = null;
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
                <button class="bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-600" onclick="location.href='login.html'">Go to Login</button>
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
    loadStatCount('artifacts/' + APP_ID + '/users', 'stat-total-users'); 
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
        console.warn(`Stats error (${colPath}):`, e);
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

        lastLogSnapshot = snapshot.docs[snapshot.docs.length - 1];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const date = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : 'Just now';
            const canRevert = data.action !== 'revert' && data.action !== 'bulk_upload'; 

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
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    try {
        const q = query(collection(db, "admin_logs"), where("timestamp", "<", Timestamp.fromDate(sevenDaysAgo)));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const batch = writeBatch(db);
            snapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
    } catch (e) { console.warn("Auto-prune failed:", e); }
}

window.revertAction = async (logId) => {
    if (!confirm("Attempt to revert this action?")) return;
    try {
        const logDoc = await getDoc(doc(db, "admin_logs", logId));
        if (!logDoc.exists()) throw new Error("Log entry not found.");
        const data = logDoc.data();
        const { action, targetId, collectionName, previousData } = data;

        if (action === 'create' || action === 'add_admin') {
            const col = collectionName || (action === 'add_admin' ? 'admin_directory' : 'quizzieQuestionBank');
            if(targetId) await deleteDoc(doc(db, col, targetId));
        } else if (action.includes('delete') || action === 'remove_admin') {
            if (!previousData) throw new Error("Cannot revert: Original data was not saved.");
            let col = collectionName;
            if (!col) {
                if (action === 'remove_admin') col = 'admin_directory';
                else if (action === 'delete_student') col = `artifacts/${APP_ID}/users`;
                else col = 'quizzieQuestionBank';
            }
            await setDoc(doc(db, col, targetId), previousData);
        } else if (action === 'update') {
            if (!previousData) throw new Error("Cannot revert: Previous data was not saved.");
            const col = collectionName || 'quizzieQuestionBank';
            await updateDoc(doc(db, col, targetId), previousData);
        }

        await logAuditAction('revert', logId, `Reverted action: ${data.details}`, null, null);
        alert("Action reverted successfully.");
        
        loadActivityLogs();
        if(action.includes('student')) loadStudents();
        else if(action.includes('admin')) loadAdminUsers();
        else loadQuestions();
    } catch (e) { alert("Revert failed: " + e.message); }
};

function getActionColor(action) {
    if (action.includes('delete') || action.includes('remove')) return 'text-red-400 bg-red-900/30';
    if (action.includes('create') || action.includes('add')) return 'text-green-400 bg-green-900/30';
    if (action.includes('update')) return 'text-blue-400 bg-blue-900/30';
    if (action === 'revert') return 'text-yellow-400 bg-yellow-900/30';
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
// 3. ADMIN TEAM MANAGEMENT
// ==========================================================================

async function loadAdminUsers() {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-500">Loading team...</td></tr>';
    try {
        const q = collection(db, "admin_directory");
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
                    <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">${(d.name || 'A').charAt(0).toUpperCase()}</div>
                    ${d.name || 'Unknown'}
                </td>
                <td class="px-6 py-4 text-slate-400 capitalize"><span class="bg-slate-700 px-2 py-1 rounded text-xs">${(d.role || 'Staff').replace('_', ' ')}</span></td>
                <td class="px-6 py-4 text-slate-500 text-xs">${d.email || 'No Email'}</td>
                <td class="px-6 py-4 text-right"><button onclick="window.removeAdmin('${docSnap.id}')" class="text-red-400 hover:text-red-300 p-2 rounded hover:bg-red-400/10 transition-colors" title="Remove Access"><i class="fas fa-trash"></i></button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { tbody.innerHTML = `<tr><td colspan="4" class="text-center text-red-500 py-8">Error: ${e.message}</td></tr>`; }
}

window.removeAdmin = async (id) => {
    if (confirm("Remove this admin?")) {
        try {
            const docSnap = await getDoc(doc(db, "admin_directory", id));
            const previousData = docSnap.exists() ? docSnap.data() : null;
            await deleteDoc(doc(db, "admin_directory", id));
            logAuditAction('remove_admin', id, 'Removed Admin User', 'admin_directory', previousData);
            loadAdminUsers();
        } catch (e) { alert("Error: " + e.message); }
    }
};

const addAdminForm = document.getElementById('add-admin-form');
if (addAdminForm) {
    addAdminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = e.target.elements['name'].value;
        const email = e.target.elements['email'].value;
        const role = e.target.elements['role'].value;
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = "Adding...";

        try {
            const newRef = doc(collection(db, "admin_directory"));
            await setDoc(newRef, { name, email, role, addedBy: currentUser.uid, createdAt: serverTimestamp() });
            logAuditAction('add_admin', newRef.id, `Added new ${role}`, 'admin_directory');
            window.closeModal('modal-add-admin'); e.target.reset(); loadAdminUsers();
        } catch (error) { alert("Failed: " + error.message); } 
        finally { btn.disabled = false; btn.textContent = "Add"; }
    });
}

// ==========================================================================
// 4. STUDENT CRM (FIXED: Newest First)
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
        
        // --- FIX: Restore Sort, but allow fallback if index missing ---
        let q;
        try {
            q = query(usersRef, orderBy("profile.createdAt", "desc"), limit(20));
            if (loadMore && lastStudentSnapshot) q = query(usersRef, orderBy("profile.createdAt", "desc"), startAfter(lastStudentSnapshot), limit(20));
        } catch(e) {
            console.warn("Sort failed (missing index?), falling back to unsorted.", e);
            q = query(usersRef, limit(20)); // Fallback
        }

        const snapshot = await getDocs(q).catch(async (err) => {
            if (err.message.includes('requires an index')) {
                console.warn("Index missing. Fetching unsorted.");
                const fallbackQ = query(usersRef, limit(20));
                return await getDocs(fallbackQ);
            }
            throw err;
        });

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
            tr.onclick = (e) => { if(!e.target.closest('.delete-btn')) window.viewStudentDetails(docSnap.id, p); };
            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-white flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">${(p.firstName || 'U').charAt(0)}</div>
                    ${p.firstName || 'Unknown'} ${p.lastName || ''}
                </td>
                <td class="px-6 py-4 text-slate-400">${p.email}</td>
                <td class="px-6 py-4 text-slate-500 text-xs">${date}</td>
                <td class="px-6 py-4 text-blue-400 text-xs uppercase">${p.optionalSubject || 'None'}</td>
                <td class="px-6 py-4 text-right space-x-3">
                    <button onclick="window.deleteStudent('${docSnap.id}', '${p.email}')" class="delete-btn text-red-400 hover:text-red-300 transition-colors" title="Delete User Data"><i class="fas fa-trash"></i></button>
                    <button class="text-slate-500 hover:text-white"><i class="fas fa-chevron-right"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        const loadBtn = document.getElementById('load-more-students');
        if(loadBtn) loadBtn.style.display = snapshot.size < 20 ? 'none' : 'block';
    } catch (e) {
        console.error("Student Load Error:", e);
        if(!loadMore) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 py-8">Error: ${e.message}</td></tr>`;
    }
}

window.deleteStudent = async (uid, email) => {
    if (event) event.stopPropagation();
    const confirmMsg = `Delete data for ${email}?\n\nThis removes their profile and dashboard settings. This can be reverted from logs.`;
    if (confirm(confirmMsg)) {
        try {
            const docRef = doc(db, "artifacts", APP_ID, "users", uid);
            const docSnap = await getDoc(docRef);
            const previousData = docSnap.exists() ? docSnap.data() : null;

            await deleteDoc(docRef);
            logAuditAction('delete_student', uid, `Deleted profile for ${email}`, `artifacts/${APP_ID}/users`, previousData);
            loadStudents();
            alert("Student data deleted.");
        } catch (e) { alert("Failed to delete: " + e.message); }
    }
};

const searchInput = document.getElementById('student-search');
if(searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const term = e.target.value.trim();
            if(term.length < 3) { if(term.length === 0) loadStudents(); return; }
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
    document.getElementById('student-modal-name').textContent = `${profile.firstName || 'User'} ${profile.lastName || ''}`;
    document.getElementById('student-modal-email').textContent = profile.email;
    document.getElementById('student-modal-avatar').textContent = (profile.firstName || 'U').charAt(0);
    const quizRef = doc(db, "users", uid, "quizData", "seen");
    const quizSnap = await getDoc(quizRef);
    document.getElementById('student-stat-quizzes').textContent = quizSnap.exists() ? (quizSnap.data().seenQuestionIds?.length || 0) : 0;
    const progRef = doc(db, "artifacts", APP_ID, "users", uid, "progress", "summary");
    const progSnap = await getDoc(progRef);
    document.getElementById('student-stat-progress').textContent = `${progSnap.exists() ? (progSnap.data().overall || 0) : 0}%`;
    window.openModal('modal-student-details');
};

// ==========================================================================
// 5. MENTORSHIP WORKFLOW
// ==========================================================================

window.loadMentorshipRequests = async () => {
    const tbody = document.getElementById('mentorship-table-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-500">Loading requests...</td></tr>';
    try {
        const usersRef = collection(db, "artifacts", APP_ID, "users");
        const q = query(usersRef, orderBy("mentorshipRequest.requestedAt", "desc"), limit(50));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-500">No requests found.</td></tr>';
            if(document.getElementById('stat-mentorship')) document.getElementById('stat-mentorship').textContent = "0";
            return;
        }
        if(document.getElementById('stat-mentorship')) document.getElementById('stat-mentorship').textContent = snapshot.size;
        tbody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            const req = d.mentorshipRequest;
            if (!req) return; 
            const status = req.status || 'pending';
            let statusBadge = status === 'pending' ? '<span class="bg-yellow-900 text-yellow-300 text-xs px-2 py-1 rounded">Pending</span>' : 
                              status === 'contacted' ? '<span class="bg-blue-900 text-blue-300 text-xs px-2 py-1 rounded">Contacted</span>' : 
                              '<span class="bg-green-900 text-green-300 text-xs px-2 py-1 rounded">Done</span>';
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-800 hover:bg-slate-800/50 transition-colors";
            tr.innerHTML = `
                <td class="px-6 py-4">
                    <div class="font-medium text-white">${req.name || 'Unknown'}</div>
                    <div class="text-xs text-slate-500">${req.email}</div>
                </td>
                <td class="px-6 py-4"><div class="text-sm text-slate-300">${req.details || '-'}</div></td>
                <td class="px-6 py-4 text-xs text-slate-500">
                    ${req.requestedAt?.toDate ? req.requestedAt.toDate().toLocaleDateString() : 'N/A'}
                    <div class="mt-1">${statusBadge}</div>
                </td>
                <td class="px-6 py-4 text-right flex items-center justify-end gap-3">
                    ${status !== 'contacted' ? `<button onclick="updateMentorshipStatus('${docSnap.id}', 'contacted')" class="text-blue-400 hover:text-blue-300 text-xs font-medium">Mark Contacted</button>` : ''}
                    ${status !== 'closed' ? `<button onclick="updateMentorshipStatus('${docSnap.id}', 'closed')" class="text-green-400 hover:text-green-300 text-xs font-medium">Close</button>` : ''}
                    <button onclick="deleteMentorshipRequest('${docSnap.id}')" class="text-red-500 hover:text-red-400 transition-colors p-1" title="Delete Request"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { tbody.innerHTML = `<tr><td colspan="4" class="text-center text-red-500 py-8">Error: ${e.message}</td></tr>`; }
};

window.updateMentorshipStatus = async (uid, status) => {
    try {
        await updateDoc(doc(db, "artifacts", APP_ID, "users", uid), {
            "mentorshipRequest.status": status,
            "mentorshipRequest.updatedAt": serverTimestamp(),
            "mentorshipRequest.updatedBy": currentUser.uid
        });
        logAuditAction('mentorship_update', uid, `Set status to ${status}`);
        loadMentorshipRequests();
    } catch (e) { alert("Error updating status: " + e.message); }
};

window.deleteMentorshipRequest = async (uid) => {
    if (confirm("Delete this request? Cannot be undone.")) {
        try {
            await updateDoc(doc(db, "artifacts", APP_ID, "users", uid), { mentorshipRequest: deleteField() });
            logAuditAction('mentorship_delete', uid, 'Deleted Mentorship Request');
            loadMentorshipRequests();
        } catch (e) { alert("Error deleting: " + e.message); }
    }
};

// ==========================================================================
// 6. QUESTION BANK & UTILS
// ==========================================================================
function initRichTextEditors() {
    const qEditor = document.getElementById('quill-q-text');
    if (qEditor && !quillQuestion) {
        quillQuestion = new Quill('#quill-q-text', { theme: 'snow', placeholder: 'Type question here...', modules: { toolbar: [['bold', 'italic', 'underline', 'code-block'], [{'list': 'ordered'}, {'list': 'bullet'}], ['clean']] } });
    }
    if (document.getElementById('quill-q-explanation') && !quillExplanation) {
        quillExplanation = new Quill('#quill-q-explanation', { theme: 'snow', placeholder: 'Explain the answer...', modules: { toolbar: [['bold', 'italic', 'underline'], [{'list': 'ordered'}, {'list': 'bullet'}], ['link', 'clean']] } });
    }
}

const csvInput = document.getElementById('csv-file-input');
const processBtn = document.getElementById('btn-process-csv');
document.getElementById('drop-zone')?.addEventListener('click', () => csvInput.click());
csvInput?.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        processBtn.disabled = false;
        processBtn.textContent = `Upload ${e.target.files[0].name}`;
        processBtn.classList.remove('bg-slate-600', 'cursor-not-allowed'); processBtn.classList.add('bg-blue-600', 'hover:bg-blue-500');
    }
});

processBtn?.addEventListener('click', () => {
    const file = csvInput.files[0];
    if (!file) return;
    document.getElementById('upload-status').classList.remove('hidden');
    document.getElementById('csv-errors').classList.add('hidden');
    processBtn.disabled = true;
    Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: async (results) => {
            const validRows = results.data.filter(row => row.question && row.answer);
            const CHUNK_SIZE = 450;
            for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
                const chunk = validRows.slice(i, i + CHUNK_SIZE);
                const batch = writeBatch(db);
                chunk.forEach(row => {
                    const docRef = doc(collection(db, "quizzieQuestionBank"));
                    batch.set(docRef, {
                        question: row.question,
                        options: [row.optionA||'', row.optionB||'', row.optionC||'', row.optionD||''],
                        answer: row.answer,
                        subject: row.subject ? row.subject.toLowerCase() : 'general',
                        difficulty: row.difficulty ? row.difficulty.toLowerCase() : 'basic',
                        explanation: row.explanation || '',
                        createdAt: serverTimestamp(), createdBy: currentUser.uid
                    });
                });
                await batch.commit();
                document.getElementById('upload-progress').style.width = `${(i/validRows.length)*100}%`;
            }
            logAuditAction('bulk_upload', 'questions', `Uploaded ${validRows.length} questions`);
            alert(`Uploaded ${validRows.length} questions!`);
            window.closeModal('modal-bulk-upload');
            loadQuestions();
            document.getElementById('upload-status').classList.add('hidden');
            processBtn.disabled = false; processBtn.textContent = "Upload";
        }
    });
});

window.loadQuestions = async (loadMore = false) => {
    const tbody = document.getElementById('questions-table-body');
    if(!tbody) return;
    if(!loadMore) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-slate-500 py-4">Loading...</td></tr>';
    const qRef = collection(db, "quizzieQuestionBank");
    const q = query(qRef, orderBy("createdAt", "desc"), limit(10));
    const snap = await getDocs(q);
    tbody.innerHTML = '';
    snap.forEach(doc => {
        const data = doc.data();
        const tempDiv = document.createElement("div"); tempDiv.innerHTML = data.question;
        const plainText = tempDiv.textContent || "";
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

window.saveQuestion = async () => {
    const id = document.getElementById('q-id').value;
    const question = quillQuestion.root.innerHTML;
    const explanation = quillExplanation.root.innerHTML;
    if (quillQuestion.getText().trim().length === 0) { alert("Question cannot be empty"); return; }
    const options = [document.getElementById('q-opt-0').value, document.getElementById('q-opt-1').value, document.getElementById('q-opt-2').value, document.getElementById('q-opt-3').value];
    const answer = document.getElementById('q-answer').value || options[0];
    const subject = document.getElementById('q-subject').value;
    const difficulty = document.getElementById('q-difficulty').value;
    const data = { question, options, answer, subject, difficulty, explanation, updatedAt: serverTimestamp(), updatedBy: currentUser.uid };
    try {
        if (id) {
            const oldSnap = await getDoc(doc(db, "quizzieQuestionBank", id));
            await updateDoc(doc(db, "quizzieQuestionBank", id), data);
            logAuditAction('update', id, 'Updated Question', 'quizzieQuestionBank', oldSnap.data());
        } else {
            data.createdAt = serverTimestamp();
            await setDoc(doc(collection(db, "quizzieQuestionBank")), data);
            logAuditAction('create', 'new_question', 'Created Question', 'quizzieQuestionBank');
        }
        window.closeModal('modal-question-editor'); loadQuestions();
    } catch (e) { alert("Failed: " + e.message); }
};

window.deleteQuestion = async (id) => {
    if(confirm("Delete question?")) {
        const oldSnap = await getDoc(doc(db, "quizzieQuestionBank", id));
        await deleteDoc(doc(db, "quizzieQuestionBank", id));
        logAuditAction('delete', id, 'Deleted Question', 'quizzieQuestionBank', oldSnap.data());
        loadQuestions();
    }
};

window.loadNotifications = async () => {
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

document.getElementById('notification-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('notif-message').value;
    const type = document.getElementById('notif-type').value;
    const pages = Array.from(e.target.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
    let imageUrl = null;
    const fileInput = document.getElementById('notif-image');
    if(type === 'popup' && fileInput.files[0]) imageUrl = await fileToBase64(fileInput.files[0]);
    await setDoc(doc(collection(db, "system_notifications")), { message, type, targetPages: pages, imageUrl, active: true, createdAt: serverTimestamp(), createdBy: currentUser.uid });
    alert("Published!"); e.target.reset(); loadNotifications();
});

window.stopBroadcast = async (id) => {
    if(confirm("Stop broadcast?")) {
        await deleteDoc(doc(db, "system_notifications", id));
        logAuditAction('stop_broadcast', id, 'Stopped Notification');
        loadNotifications();
    }
};

window.openModal = (id) => { const el = document.getElementById(id); el.classList.remove('hidden'); requestAnimationFrame(() => { el.classList.remove('opacity-0'); el.querySelector('div').classList.remove('scale-95'); el.querySelector('div').classList.add('scale-100'); }); };
window.closeModal = (id) => { const el = document.getElementById(id); el.classList.add('opacity-0'); el.querySelector('div').classList.remove('scale-100'); el.querySelector('div').classList.add('scale-95'); setTimeout(() => el.classList.add('hidden'), 200); };
window.openQuestionModal = () => { document.getElementById('question-form').reset(); document.getElementById('q-id').value = ''; if(quillQuestion) quillQuestion.setContents([]); if(quillExplanation) quillExplanation.setContents([]); document.getElementById('q-modal-title').textContent = "Add Question"; window.openModal('modal-question-editor'); };
function fileToBase64(file) { return new Promise((resolve, reject) => { const r = new FileReader(); r.readAsDataURL(file); r.onload = () => resolve(r.result); r.onerror = reject; }); }
