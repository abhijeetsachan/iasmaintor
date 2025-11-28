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
// Ensure this matches the ID used in js/app.js and js/auth.js
const APP_ID = 'default-app-id'; 

// --- State & Editors ---
let currentUser = null;
let adminProfile = null;

// Pagination State
let lastQuestionSnapshot = null;
let lastLogSnapshot = null;
let lastStudentSnapshot = null; 

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
            // Auto-logout after 3 seconds if unauthorized
            setTimeout(() => signOut(auth), 3000);
        }
    } else {
        // Not logged in
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
                <p class="text-sm text-slate-400">Redirecting to login...</p>
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
    // Hide all views
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    // Show selected view
    const target = document.getElementById(`view-${viewId}`);
    if(target) target.classList.remove('hidden');
    
    // Update Sidebar
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navBtn = document.getElementById(`nav-${viewId}`);
    if(navBtn) navBtn.classList.add('active');
};

// ==========================================================================
// 1. CORE: INITIALIZATION
// ==========================================================================

async function initDashboard() {
    console.log("Loading Dashboard Data...");
    
    // Load High-Level Counts
    // Try loading from artifacts (Active) and fall back if needed
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
        // Handle sub-collection paths like "artifacts/id/users"
        if(colPath.includes('/')) {
             const parts = colPath.split('/');
             // e.g. collection(db, 'artifacts', 'default-app-id', 'users')
             if (parts.length === 3) {
                 colRef = collection(db, parts[0], parts[1], parts[2]);
             } else {
                 // Generic fallback for other depths if needed
                 colRef = collection(db, colPath);
             }
        } else {
             colRef = collection(db, colPath);
        }
        
        const snapshot = await getCountFromServer(colRef);
        el.textContent = snapshot.data().count;
    } catch (e) {
        console.warn(`Failed to load stats for ${colPath} (likely empty):`, e);
        el.textContent = "0";
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
            // Disable revert for irreversible actions
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
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    try {
        // Note: This query requires a composite index in Firestore. 
        // If it fails, we just catch it silently.
        const q = query(collection(db, "admin_logs"), where("timestamp", "<", Timestamp.fromDate(sevenDaysAgo)));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const batch = writeBatch(db);
            snapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
    } catch (e) { /* Ignore index requirement errors for auto-prune */ }
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

        // Perform Revert Logic
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
        
        // Refresh UI
        setTimeout(() => {
            loadActivityLogs();
            loadStudents(); 
            loadMentorshipRequests();
        }, 500);

    } catch (e) {
        alert("Revert failed: " + e.message);
    }
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
// 3. ADMIN TEAM
// ==========================================================================

async function loadAdminUsers() {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-500">Loading team...</td></tr>';
    
    try {
        const snap = await getDocs(collection(db, "admin_directory"));
        if(snap.empty) { tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-500">No admins found.</td></tr>'; return; }
        
        tbody.innerHTML = '';
        snap.forEach(d => {
            const data = d.data();
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-800 hover:bg-slate-800/50";
            tr.innerHTML = `
                <td class="px-6 py-4 text-white">${data.name || 'User'}</td>
                <td class="px-6 py-4 text-slate-400 capitalize"><span class="bg-slate-700 px-2 py-1 rounded text-xs">${data.role || 'staff'}</span></td>
                <td class="px-6 py-4 text-slate-500 text-sm">${data.email}</td>
                <td class="px-6 py-4 text-right"><button onclick="window.removeAdmin('${d.id}')" class="text-red-400 hover:text-red-300"><i class="fas fa-trash"></i></button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-red-500">Error: ${e.message}</td></tr>`;
    }
}

window.removeAdmin = async (id) => {
    if(confirm("Remove admin access for this user?")) {
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
        // Note: This just creates the directory entry. User must sign up via Auth if not existing.
        await setDoc(doc(collection(db, "admin_directory")), { name, email, role, createdAt: serverTimestamp() });
        window.closeModal('modal-add-admin');
        e.target.reset();
        loadAdminUsers();
    });
}

// ==========================================================================
// 4. STUDENT CRM (FAIL-SAFE FETCHING)
// ==========================================================================

window.loadStudents = async (loadMore = false) => {
    const tbody = document.getElementById('students-table-body');
    const loadBtn = document.getElementById('load-more-students');
    if (!tbody) return;
    
    if (!loadMore) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">Scanning databases...</td></tr>';
        lastStudentSnapshot = null; // Reset pagination
    }

    try {
        const students = [];
        let snapshot;
        
        // STRATEGY: Try fetching sorted by date. If index missing, fallback to unsorted fetch.
        const artifactsRef = collection(db, "artifacts", APP_ID, "users");
        
        try {
            // Attempt 1: Ordered fetch (Requires Index)
            let q = query(artifactsRef, orderBy("profile.createdAt", "desc"), limit(20));
            if (loadMore && lastStudentSnapshot) {
                q = query(artifactsRef, orderBy("profile.createdAt", "desc"), startAfter(lastStudentSnapshot), limit(20));
            }
            snapshot = await getDocs(q);
        } catch (indexError) {
            console.warn("Index missing for sorting. Falling back to basic fetch.", indexError);
            // Attempt 2: Basic fetch (Unsorted, Client-side sort)
            const qFallback = query(artifactsRef, limit(50)); 
            snapshot = await getDocs(qFallback);
            if(loadBtn) loadBtn.style.display = 'none'; // Disable load more if we can't paginate properly
        }

        // Legacy Fallback: Fetch from root if artifacts is empty and it's the first load
        if (snapshot.empty && !loadMore) {
             const rootRef = collection(db, "users");
             snapshot = await getDocs(query(rootRef, limit(20)));
             snapshot.docs.forEach(doc => doc._source = 'root'); // Tag as legacy
        }

        if (snapshot.empty && !loadMore) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">No students found.</td></tr>';
            return;
        }

        if (!snapshot.empty) {
            lastStudentSnapshot = snapshot.docs[snapshot.docs.length - 1];
            if (loadBtn && !loadBtn.style.display === 'none') {
                 loadBtn.style.display = snapshot.size < 20 ? 'none' : 'block';
            }
        }

        // Process and Normalize Data
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Handle legacy vs new profile structure
            const p = data.profile || data; 
            const source = docSnap._source || 'artifacts';
            
            // Only show if email exists (basic validation)
            if (p.email || p.firstName) {
                students.push({
                    id: docSnap.id,
                    data: p,
                    source: source,
                    created: p.createdAt?.toDate ? p.createdAt.toDate() : new Date(0)
                });
            }
        });

        // Client-side sort if fallback was used or merging happened
        students.sort((a, b) => b.created - a.created);

        if (!loadMore) tbody.innerHTML = '';

        // Render Rows
        students.forEach(student => {
            const p = student.data;
            const name = `${p.firstName || 'User'} ${p.lastName || ''}`.trim();
            const email = p.email || 'No Email';
            const joined = student.created.getTime() > 0 ? student.created.toLocaleDateString() : 'N/A';
            
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer";
            tr.onclick = (e) => { if(!e.target.closest('.delete-btn')) window.viewStudentDetails(student.id, p); };
            
            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-white flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                        ${name.charAt(0).toUpperCase()}
                    </div>
                    ${name}
                    ${student.source === 'root' ? '<span class="text-xs text-yellow-600" title="Legacy Data">(L)</span>' : ''}
                </td>
                <td class="px-6 py-4 text-slate-400 text-sm">${email}</td>
                <td class="px-6 py-4 text-slate-500 text-xs">${joined}</td>
                <td class="px-6 py-4 text-blue-400 text-xs uppercase">${p.optionalSubject || '-'}</td>
                <td class="px-6 py-4 text-right">
                    <button onclick="window.deleteStudent('${student.id}', '${email}', '${student.source}')" class="delete-btn text-red-400 hover:text-red-300 transition-colors"><i class="fas fa-trash"></i></button>
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
            
            // Snapshot for revert
            const docSnap = await getDoc(docRef);
            const previousData = docSnap.exists() ? docSnap.data() : null;

            await deleteDoc(docRef);
            
            await logAuditAction('delete_student', uid, `Deleted ${email}`, collectionPath, previousData);
            
            // Refresh
            loadStudents();
            loadStatCount(`artifacts/${APP_ID}/users`, 'stat-total-users');
        } catch (e) { alert("Failed: " + e.message); }
    }
};

// ==========================================================================
// 5. MENTORSHIP (FAIL-SAFE FETCHING)
// ==========================================================================

window.loadMentorshipRequests = async () => {
    const tbody = document.getElementById('mentorship-table-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-500">Loading...</td></tr>';

    try {
        const requests = [];
        const artifactsRef = collection(db, "artifacts", APP_ID, "users");
        let snapshot;

        // Attempt 1: Ordered Fetch (Requires Index on `mentorshipRequest.requestedAt`)
        try {
             const q = query(artifactsRef, orderBy("mentorshipRequest.requestedAt", "desc"), limit(20));
             snapshot = await getDocs(q);
        } catch (e) {
             console.warn("Mentorship index missing, falling back.");
             // Attempt 2: Basic fetch
             const qFallback = query(artifactsRef, limit(50));
             snapshot = await getDocs(qFallback);
        }

        snapshot.forEach(doc => {
            const d = doc.data();
            if(d.mentorshipRequest) {
                requests.push({ id: doc.id, req: d.mentorshipRequest, source: 'artifacts' });
            }
        });

        // In-memory sort to fix fallback order
        requests.sort((a, b) => {
             const tA = a.req.requestedAt?.toDate ? a.req.requestedAt.toDate() : 0;
             const tB = b.req.requestedAt?.toDate ? b.req.requestedAt.toDate() : 0;
             return tB - tA;
        });

        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-slate-500 py-8">No requests found.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        requests.forEach(({ id, req, source }) => {
             const status = req.status || 'pending';
             const date = req.requestedAt?.toDate ? req.requestedAt.toDate().toLocaleDateString() : 'N/A';
             const statusClass = status === 'pending' ? 'text-yellow-500' : (status === 'contacted' ? 'text-blue-400' : 'text-green-500');
             
             const tr = document.createElement('tr');
             tr.className = "border-b border-slate-800 hover:bg-slate-800/50";
             tr.innerHTML = `
                <td class="px-6 py-4">
                    <div class="text-white font-medium">${req.name || 'Unknown'}</div>
                    <div class="text-xs text-slate-500">${req.email || '-'}</div>
                    <div class="text-xs text-slate-600">${req.phone || ''}</div>
                </td>
                <td class="px-6 py-4 text-slate-400 text-sm max-w-xs truncate" title="${req.details}">${req.details || '-'}</td>
                <td class="px-6 py-4 text-xs">
                    <div class="text-slate-500 mb-1">${date}</div>
                    <span class="${statusClass} uppercase font-bold text-[10px] tracking-wider">${status}</span>
                </td>
                <td class="px-6 py-4 text-right">
                    ${status !== 'contacted' ? `<button onclick="updateMentorshipStatus('${id}', 'contacted', '${source}')" class="text-blue-400 hover:text-blue-300 text-xs font-medium mr-2 border border-blue-500/30 px-2 py-1 rounded">Mark Contacted</button>` : ''}
                    ${status !== 'closed' ? `<button onclick="updateMentorshipStatus('${id}', 'closed', '${source}')" class="text-green-400 hover:text-green-300 text-xs font-medium border border-green-500/30 px-2 py-1 rounded">Close</button>` : ''}
                </td>
             `;
             tbody.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-red-500 py-8">Error loading data.</td></tr>';
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
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-slate-500 py-8">Loading...</td></tr>';
    
    // Assuming 'createdAt' index exists for quizzieQuestionBank (usually standard)
    // If not, similar fallback logic could be applied
    const q = query(collection(db, "quizzieQuestionBank"), orderBy("createdAt", "desc"), limit(10));
    const snap = await getDocs(q);
    
    if (snap.empty) {
         tbody.innerHTML = '<tr><td colspan="4" class="text-center text-slate-500 py-8">No questions found.</td></tr>';
         return;
    }

    tbody.innerHTML = '';
    snap.forEach(doc => {
        const data = doc.data();
        // Strip HTML for preview
        const temp = document.createElement('div'); temp.innerHTML = data.question;
        const text = temp.textContent || temp.innerText || "";
        
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-800 hover:bg-slate-800/50";
        tr.innerHTML = `
            <td class="px-6 py-4"><div class="line-clamp-2 text-white text-sm">${text}</div></td>
            <td class="px-6 py-4 text-slate-400 capitalize text-xs">${data.subject}</td>
            <td class="px-6 py-4 text-slate-500 text-xs">${data.difficulty}</td>
            <td class="px-6 py-4 text-right"><button onclick="window.deleteQuestion('${doc.id}')" class="text-red-400 hover:text-red-300 transition-colors"><i class="fas fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
};

window.saveQuestion = async () => {
    const question = quillQuestion.root.innerHTML;
    const explanation = quillExplanation.root.innerHTML;
    const options = [0,1,2,3].map(i => document.getElementById(`q-opt-${i}`).value);
    const answer = document.getElementById('q-answer').value || options[0]; 
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
    if(confirm("Delete question?")) {
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
    
    container.innerHTML = snap.empty ? '<p class="text-slate-500 text-sm italic">No active broadcasts</p>' : '';
    
    snap.forEach(d => {
        const data = d.data();
        container.innerHTML += `<div class="bg-slate-800 p-3 rounded border border-slate-700 flex justify-between items-center mb-2">
            <div>
                <span class="text-xs font-bold uppercase text-blue-400 mr-2">${data.type}</span>
                <span class="text-sm text-white">${data.message}</span>
            </div>
            <button onclick="window.stopBroadcast('${d.id}')" class="text-red-400 hover:text-red-300"><i class="fas fa-times"></i></button>
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
window.openModal = (id) => { 
    const el = document.getElementById(id); 
    if(el) {
        el.classList.remove('hidden'); 
        el.classList.add('flex'); // Ensure flex is added for centering
    }
};
window.closeModal = (id) => { 
    const el = document.getElementById(id); 
    if(el) {
        el.classList.add('hidden'); 
        el.classList.remove('flex');
    }
};

window.openQuestionModal = () => { 
    document.getElementById('question-form').reset(); 
    if(quillQuestion) quillQuestion.setContents([]); 
    if(quillExplanation) quillExplanation.setContents([]); 
    
    // Populate Answer dropdown dynamically based on options logic if needed, 
    // for now simpler logic in HTML is fine or clear it.
    const ansSelect = document.getElementById('q-answer');
    ansSelect.innerHTML = ''; // clear
    
    window.openModal('modal-question-editor'); 
};

// Student Details Modal Helper
window.viewStudentDetails = async (uid, profile) => {
    document.getElementById('student-modal-name').textContent = `${profile.firstName || 'User'} ${profile.lastName || ''}`;
    document.getElementById('student-modal-email').textContent = profile.email;
    
    // Reset stats
    document.getElementById('student-stat-quizzes').textContent = "...";
    document.getElementById('student-stat-progress').textContent = "...";
    
    window.openModal('modal-student-details');
    
    // Fetch stats asynchronously
    try {
         const summaryDoc = await getDoc(doc(db, 'artifacts', APP_ID, 'users', uid, 'progress', 'summary'));
         if (summaryDoc.exists()) {
             document.getElementById('student-stat-progress').textContent = `${summaryDoc.data().overall || 0}%`;
         } else {
             document.getElementById('student-stat-progress').textContent = "0%";
         }
         
         // Count history docs
         const historyRef = collection(db, 'users', uid, 'history');
         const historySnap = await getCountFromServer(historyRef);
         document.getElementById('student-stat-quizzes').textContent = historySnap.data().count;

    } catch (e) { console.warn("Error fetching student stats:", e); }
};
