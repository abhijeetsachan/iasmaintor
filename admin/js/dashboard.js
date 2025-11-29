// admin/js/dashboard.js
// Full Stack Admin Logic: CRM, CMS, Analytics, Security & Activity Logs

import { firebaseConfig } from '../../js/firebase-config.js';
// Import Optional List to resolve IDs to Names for the student profile view
import { OPTIONAL_SUBJECT_LIST } from '../../js/optional-syllabus-data.js';

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
let currentStudentId = null; // For editing student profiles

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
             if (parts.length === 3) {
                 colRef = collection(db, parts[0], parts[1], parts[2]);
             } else {
                 colRef = collection(db, colPath);
             }
        } else {
             colRef = collection(db, colPath);
        }
        
        const snapshot = await getCountFromServer(colRef);
        el.textContent = snapshot.data().count;
    } catch (e) {
        // console.warn(`Failed to load stats for ${colPath}:`, e);
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
        const q = query(collection(db, "admin_logs"), where("timestamp", "<", Timestamp.fromDate(sevenDaysAgo)));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const batch = writeBatch(db);
            snapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
    } catch (e) { /* Ignore */ }
}

window.revertAction = async (logId) => {
    if (!confirm("Attempt to revert this action?")) return;
    try {
        const logDoc = await getDoc(doc(db, "admin_logs", logId));
        if (!logDoc.exists()) throw new Error("Log entry not found.");
        
        const data = logDoc.data();
        const { action, targetId, collectionName, previousData } = data;

        let colPath = collectionName;
        if (!colPath) {
            if (action.includes('admin')) colPath = 'admin_directory';
            else if (action.includes('student') || action.includes('mentorship')) colPath = `artifacts/${APP_ID}/users`; 
            else colPath = 'quizzieQuestionBank';
        }

        console.log(`Reverting ${action} on ${colPath}/${targetId}`);

        if (action.includes('delete') || action.includes('remove')) {
             if (!previousData) throw new Error("Cannot revert: Backup data missing.");
             await setDoc(doc(db, colPath, targetId), previousData);
        } else if (action.includes('create') || action.includes('add')) {
            await deleteDoc(doc(db, colPath, targetId));
        } else if (action.includes('update')) {
             if (!previousData) throw new Error("Cannot revert: Backup data missing.");
             await updateDoc(doc(db, colPath, targetId), previousData);
        }

        await logAuditAction('revert', logId, `Reverted action: ${data.details}`, null, null);
        alert("Action reverted successfully.");
        
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
// 3. STUDENT CRM (360 View, Stats, and Editing)
// ==========================================================================

window.loadStudents = async (loadMore = false) => {
    const tbody = document.getElementById('students-table-body');
    const loadBtn = document.getElementById('load-more-students');
    if (!tbody) return;
    
    if (!loadMore) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">Scanning databases...</td></tr>';
        lastStudentSnapshot = null; 
    }

    try {
        const students = [];
        let snapshot;
        const artifactsRef = collection(db, "artifacts", APP_ID, "users");
        
        try {
            let q = query(artifactsRef, orderBy("profile.createdAt", "desc"), limit(20));
            if (loadMore && lastStudentSnapshot) {
                q = query(artifactsRef, orderBy("profile.createdAt", "desc"), startAfter(lastStudentSnapshot), limit(20));
            }
            snapshot = await getDocs(q);
        } catch (indexError) {
            console.warn("Index missing for sorting. Falling back to basic fetch.", indexError);
            const qFallback = query(artifactsRef, limit(50)); 
            snapshot = await getDocs(qFallback);
            if(loadBtn) loadBtn.style.display = 'none';
        }

        if (snapshot.empty && !loadMore) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-500">No students found.</td></tr>';
            return;
        }

        if (!snapshot.empty) {
            lastStudentSnapshot = snapshot.docs[snapshot.docs.length - 1];
            if (loadBtn && loadBtn.style.display !== 'none') {
                 loadBtn.style.display = snapshot.size < 20 ? 'none' : 'block';
            }
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const p = data.profile || data; 
            if (p.email || p.firstName) {
                students.push({
                    id: docSnap.id,
                    data: p,
                    source: 'artifacts',
                    created: p.createdAt?.toDate ? p.createdAt.toDate() : new Date(0)
                });
            }
        });

        students.sort((a, b) => b.created - a.created);

        if (!loadMore) tbody.innerHTML = '';

        students.forEach(student => {
            const p = student.data;
            const name = `${p.firstName || 'User'} ${p.lastName || ''}`.trim();
            const email = p.email || 'No Email';
            const joined = student.created.getTime() > 0 ? student.created.toLocaleDateString() : 'N/A';
            
            // Resolve Optional Name
            const optId = p.optionalSubject;
            const optName = optId ? (OPTIONAL_SUBJECT_LIST.find(s => s.id === optId)?.name || optId) : '-';

            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors";
            tr.onclick = (e) => { if(!e.target.closest('.delete-btn')) window.viewStudentDetails(student.id, p); };
            
            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-white flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                        ${name.charAt(0).toUpperCase()}
                    </div>
                    ${name}
                </td>
                <td class="px-6 py-4 text-slate-400 text-sm">${email}</td>
                <td class="px-6 py-4 text-slate-500 text-xs">${joined}</td>
                <td class="px-6 py-4 text-blue-400 text-xs font-medium truncate max-w-[120px]">${optName}</td>
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
            
            const docSnap = await getDoc(docRef);
            const previousData = docSnap.exists() ? docSnap.data() : null;

            await deleteDoc(docRef);
            
            await logAuditAction('delete_student', uid, `Deleted ${email}`, collectionPath, previousData);
            loadStudents();
            loadStatCount(`artifacts/${APP_ID}/users`, 'stat-total-users');
        } catch (e) { alert("Failed: " + e.message); }
    }
};

// --- 360-VIEW: Student Details Logic ---
window.viewStudentDetails = async (uid, profile) => {
    currentStudentId = uid; // Set global for editing
    
    // 1. Populate Header & Personal
    const fullName = `${profile.firstName || 'User'} ${profile.lastName || ''}`.trim();
    document.getElementById('student-modal-name').textContent = fullName;
    document.getElementById('student-modal-email').textContent = profile.email;
    document.getElementById('student-modal-avatar').textContent = (profile.firstName || 'U').charAt(0).toUpperCase();
    
    document.getElementById('student-profile-name').textContent = fullName;
    document.getElementById('student-profile-email').textContent = profile.email;
    document.getElementById('student-profile-mobile').textContent = profile.mobile || 'Not Provided';
    const joinDate = profile.createdAt?.toDate ? profile.createdAt.toDate().toLocaleDateString() : 'Unknown';
    document.getElementById('student-profile-joined').textContent = joinDate;

    // 2. Populate Prep Strategy (New Fields)
    const optId = profile.optionalSubject;
    const optName = optId ? (OPTIONAL_SUBJECT_LIST.find(s => s.id === optId)?.name || optId) : 'Not Selected';
    
    document.getElementById('student-modal-optional').textContent = `Optional: ${optId ? optId.toUpperCase() : 'N/A'}`;
    document.getElementById('student-prep-year').textContent = profile.appearingYear || 'Not Set';
    document.getElementById('student-prep-optional').textContent = optName;
    document.getElementById('student-prep-medium').textContent = profile.medium || '-';
    document.getElementById('student-prep-mode').textContent = profile.preparationMode || '-';

    // 3. Role-Based Edit Access
    const editBtn = document.getElementById('btn-edit-student');
    if (editBtn) {
        if (adminProfile && adminProfile.role === 'super_admin') {
            editBtn.classList.remove('hidden');
        } else {
            editBtn.classList.add('hidden');
        }
    }

    // 4. Stats (Async)
    window.switchModalTab('overview');
    document.getElementById('student-stat-quizzes').textContent = "...";
    document.getElementById('student-stat-progress').textContent = "...";
    document.getElementById('syllabus-breakdown-container').innerHTML = '<div class="text-center text-slate-500 italic">Loading data...</div>';
    document.getElementById('student-plans-list').innerHTML = '<div class="text-center text-slate-500 italic">Loading plans...</div>';

    window.openModal('modal-student-details');

    try {
         // Fetch Syllabus Summary
         const summaryDoc = await getDoc(doc(db, 'artifacts', APP_ID, 'users', uid, 'progress', 'summary'));
         const pData = summaryDoc.exists() ? summaryDoc.data() : {};
         
         const overall = pData.overall || 0;
         document.getElementById('student-stat-progress').textContent = `${overall}%`;
         document.getElementById('progress-bar-overall').style.width = `${overall}%`;

         // Breakdown
         const createBar = (l, v, c='blue') => `<div class="bg-slate-800 p-3 rounded border border-slate-700"><div class="flex justify-between text-xs mb-1 text-slate-400"><span>${l}</span><span class="text-${c}-400 font-bold">${v}%</span></div><div class="w-full bg-slate-900 h-1.5 rounded"><div class="bg-${c}-500 h-1.5 rounded" style="width:${v}%"></div></div></div>`;
         
         document.getElementById('syllabus-breakdown-container').innerHTML = `
            ${createBar('Prelims GS', pData.prelimsGS||0, 'orange')}
            ${createBar('Prelims CSAT', pData.prelimsCSAT||0, 'orange')}
            ${createBar('Mains GS1', pData.mainsGS1||0, 'indigo')}
            ${createBar('Mains GS2', pData.mainsGS2||0, 'indigo')}
            ${createBar('Mains GS3', pData.mainsGS3||0, 'indigo')}
            ${createBar('Mains GS4', pData.mainsGS4||0, 'indigo')}
            ${createBar('Optional P1', pData.optionalP1||0, 'pink')}
            ${createBar('Optional P2', pData.optionalP2||0, 'pink')}
         `;

         // Fetch Quiz Count (History Sub-collection)
         const historyRef = collection(db, 'users', uid, 'history');
         const historySnap = await getCountFromServer(historyRef);
         document.getElementById('student-stat-quizzes').textContent = historySnap.data().count;

         // Fetch Study Plans
         const plansRef = collection(db, 'artifacts', APP_ID, 'users', uid, 'studyPlans');
         const plansQ = query(plansRef, orderBy("createdAt", "desc"), limit(5));
         const plansSnap = await getDocs(plansQ);
         
         const plansContainer = document.getElementById('student-plans-list');
         if(plansSnap.empty) {
             plansContainer.innerHTML = '<div class="text-center text-slate-500 p-4 border border-dashed border-slate-700 rounded-lg">No study plans generated.</div>';
         } else {
             let html = '';
             plansSnap.forEach(d => {
                 const plan = d.data();
                 const date = plan.createdAt?.toDate ? plan.createdAt.toDate().toLocaleDateString() : 'N/A';
                 html += `<div class="bg-slate-800 p-3 rounded border border-slate-700 text-xs"><div class="flex justify-between text-slate-300 mb-1"><span>Study Plan</span><span>${date}</span></div><div class="text-slate-500 truncate">${plan.planHTML ? 'HTML Content...' : 'No details'}</div></div>`;
             });
             plansContainer.innerHTML = html;
         }

    } catch (e) { 
        console.warn("Error fetching student stats:", e); 
        document.getElementById('student-stat-progress').textContent = "Err";
        document.getElementById('syllabus-breakdown-container').innerHTML = '<div class="text-red-400 text-sm">Failed to load data.</div>';
    }
};

// --- EDIT STUDENT LOGIC ---
window.openEditStudentModal = async () => {
    if (!currentStudentId) return;
    
    // Fetch fresh data
    const userDoc = await getDoc(doc(db, 'artifacts', APP_ID, 'users', currentStudentId));
    if (!userDoc.exists()) return;
    
    const p = userDoc.data().profile || {};
    
    document.getElementById('edit-student-uid').value = currentStudentId;
    document.getElementById('edit-first-name').value = p.firstName || '';
    document.getElementById('edit-last-name').value = p.lastName || '';
    document.getElementById('edit-email').value = p.email || '';
    document.getElementById('edit-mobile').value = p.mobile || '';
    
    window.openModal('modal-edit-student');
};

document.getElementById('edit-student-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const uid = document.getElementById('edit-student-uid').value;
    
    try {
        const userRef = doc(db, 'artifacts', APP_ID, 'users', uid);
        const oldSnap = await getDoc(userRef);
        
        const updates = {
            'profile.firstName': document.getElementById('edit-first-name').value,
            'profile.lastName': document.getElementById('edit-last-name').value,
            'profile.mobile': document.getElementById('edit-mobile').value
        };

        await updateDoc(userRef, updates);
        
        await logAuditAction('update', uid, 'Updated Student Profile', `artifacts/${APP_ID}/users`, oldSnap.data());
        
        alert("Profile Updated.");
        window.closeModal('modal-edit-student');
        window.closeModal('modal-student-details');
        loadStudents(); // Refresh list
    } catch (err) {
        alert("Update Failed: " + err.message);
    }
});


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

        try {
             const q = query(artifactsRef, orderBy("mentorshipRequest.requestedAt", "desc"), limit(20));
             snapshot = await getDocs(q);
        } catch (e) {
             console.warn("Mentorship index missing, falling back.");
             const qFallback = query(artifactsRef, limit(50));
             snapshot = await getDocs(qFallback);
        }

        snapshot.forEach(doc => {
            const d = doc.data();
            if(d.mentorshipRequest) {
                requests.push({ id: doc.id, req: d.mentorshipRequest, source: 'artifacts' });
            }
        });

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
    
    const q = query(collection(db, "quizzieQuestionBank"), orderBy("createdAt", "desc"), limit(10));
    const snap = await getDocs(q);
    
    if (snap.empty) {
         tbody.innerHTML = '<tr><td colspan="4" class="text-center text-slate-500 py-8">No questions found.</td></tr>';
         return;
    }

    tbody.innerHTML = '';
    snap.forEach(doc => {
        const data = doc.data();
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

// --- ADMIN TEAM ---
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
        await setDoc(doc(collection(db, "admin_directory")), { name, email, role, createdAt: serverTimestamp() });
        window.closeModal('modal-add-admin');
        e.target.reset();
        loadAdminUsers();
    });
}

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
    const ansSelect = document.getElementById('q-answer');
    ansSelect.innerHTML = ''; 
    window.openModal('modal-question-editor'); 
};

// Function to handle CSV base64 (Placeholder if you implement bulk upload later)
function fileToBase64(file) { return new Promise((resolve, reject) => { const r = new FileReader(); r.readAsDataURL(file); r.onload = () => resolve(r.result); r.onerror = reject; }); }
