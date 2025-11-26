// admin/js/dashboard.js
// Full Admin Logic: Stats, Users, Notifications, Question Bank, Mentorship

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
    deleteField, // Required for archiving requests
    query, 
    where, 
    orderBy, 
    limit,
    startAfter,
    serverTimestamp, 
    getCountFromServer 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// --- Initialize ---
console.log("Dashboard: Initializing...");
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = 'default-app-id'; // Must match app.js

// --- State ---
let currentUser = null;
let adminProfile = null;
let lastQuestionSnapshot = null;

// --- AUTH GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        try {
            // 1. Verify Role
            const adminDoc = await getDoc(doc(db, "admin_directory", user.uid));
            
            if (adminDoc.exists()) {
                adminProfile = adminDoc.data();
                updateProfileUI(adminProfile);
                revealDashboard(); 
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

function revealDashboard() {
    const loader = document.getElementById('auth-loader');
    const layout = document.getElementById('app-layout');
    if (loader) loader.classList.add('hidden');
    if (layout) layout.classList.remove('hidden');
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
    const roleEl = document.getElementById('admin-role-display');
    const avatarEl = document.getElementById('admin-avatar');
    
    if(nameEl) nameEl.textContent = profile.name || "Admin";
    if(roleEl) roleEl.textContent = (profile.role || "Staff").replace('_', ' ').toUpperCase();
    if(avatarEl) avatarEl.textContent = (profile.name || "A").charAt(0).toUpperCase();
}

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));


// ==========================================================================
// 1. DASHBOARD STATS
// ==========================================================================

async function initDashboard() {
    loadStatCount('users', 'stat-total-users');
    loadStatCount('admin_directory', 'stat-admins');
    loadStatCount('quizzieQuestionBank', 'stat-questions');
    loadStatCount('system_notifications', 'stat-broadcasts');
    
    // We also want to count pending mentorship requests
    // This is an expensive op without a counter, so we'll just load the table count
    loadMentorshipRequests();
    loadAdminUsers();
    loadNotifications();
    loadQuestions();
}

async function loadStatCount(colName, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    try {
        const snapshot = await getCountFromServer(collection(db, colName));
        el.textContent = snapshot.data().count;
    } catch (e) {
        console.warn(`Stats error (${colName}):`, e);
        el.textContent = "-";
    }
}


// ==========================================================================
// 2. MENTORSHIP MODULE (NEW)
// ==========================================================================

window.loadMentorshipRequests = async () => {
    const tbody = document.getElementById('mentorship-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-500">Loading requests...</td></tr>';

    try {
        // Query users who have a 'mentorshipRequest.requestedAt' field
        // This implicitly filters only users who have made a request
        const usersRef = collection(db, "artifacts", APP_ID, "users");
        const q = query(usersRef, orderBy("mentorshipRequest.requestedAt", "desc"), limit(50));
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-500">No pending mentorship requests.</td></tr>';
            document.getElementById('stat-mentorship').textContent = "0";
            return;
        }

        // Update Dashboard Stat
        document.getElementById('stat-mentorship').textContent = snapshot.size + (snapshot.size === 50 ? "+" : "");

        tbody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            const req = d.mentorshipRequest;
            if (!req) return;

            const date = req.requestedAt?.toDate ? req.requestedAt.toDate().toLocaleDateString() : 'N/A';
            
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-800 hover:bg-slate-800/50 transition-colors";
            tr.innerHTML = `
                <td class="px-6 py-4">
                    <div class="font-medium text-white">${req.name || 'Unknown'}</div>
                    <div class="text-xs text-slate-500">${req.email}</div>
                    <div class="text-xs text-blue-400">${req.phone || 'No phone'}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm text-slate-300 line-clamp-2" title="${req.details}">${req.details || 'No details provided.'}</div>
                </td>
                <td class="px-6 py-4 text-xs text-slate-500">${date}</td>
                <td class="px-6 py-4 text-right">
                    <button onclick="window.archiveMentorship('${docSnap.id}')" class="text-green-400 hover:text-green-300 text-sm border border-green-500/30 px-3 py-1 rounded hover:bg-green-500/10 transition-colors">
                        <i class="fas fa-check mr-1"></i> Done
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Mentorship Load Error:", e);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-red-500">Error loading requests: ${e.message}<br><span class="text-xs text-slate-500">(Check console for index link)</span></td></tr>`;
    }
};

window.archiveMentorship = async (uid) => {
    if (!confirm("Mark this request as resolved/done? This will remove it from the list.")) return;
    try {
        const docRef = doc(db, "artifacts", APP_ID, "users", uid);
        // We delete the field 'mentorshipRequest' to clear it from the query
        await updateDoc(docRef, {
            mentorshipRequest: deleteField()
        });
        window.loadMentorshipRequests(); // Refresh
    } catch (e) {
        alert("Error archiving: " + e.message);
    }
};


// ==========================================================================
// 3. QUESTION BANK MODULE
// ==========================================================================

async function loadQuestions(loadMore = false) {
    const tbody = document.getElementById('questions-table-body');
    if (!tbody) return;
    
    if (!loadMore) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-slate-500">Loading questions...</td></tr>';
        lastQuestionSnapshot = null;
    }

    try {
        const subjectFilter = document.getElementById('filter-subject')?.value || 'all';
        let q = query(collection(db, "quizzieQuestionBank"), orderBy("createdAt", "desc"), limit(10));
        
        if (subjectFilter !== 'all') {
            q = query(collection(db, "quizzieQuestionBank"), where("subject", "==", subjectFilter), orderBy("createdAt", "desc"), limit(10));
        }
        
        if (loadMore && lastQuestionSnapshot) {
            q = query(q, startAfter(lastQuestionSnapshot));
        }

        const snapshot = await getDocs(q);
        
        if (!loadMore) tbody.innerHTML = ''; 

        if (snapshot.empty && !loadMore) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-slate-500">No questions found.</td></tr>';
            return;
        }

        lastQuestionSnapshot = snapshot.docs[snapshot.docs.length - 1];

        snapshot.forEach(docSnap => {
            const qData = docSnap.data();
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-800 hover:bg-slate-800/50";
            tr.innerHTML = `
                <td class="px-6 py-4">
                    <div class="font-medium text-white line-clamp-2">${qData.question}</div>
                    <div class="text-xs text-slate-500 mt-1">Ans: ${qData.answer}</div>
                </td>
                <td class="px-6 py-4 text-slate-400 text-sm capitalize">${qData.subject || 'General'}</td>
                <td class="px-6 py-4"><span class="px-2 py-1 rounded text-xs bg-slate-700 text-slate-300 capitalize">${qData.difficulty || 'Basic'}</span></td>
                <td class="px-6 py-4 text-right">
                    <button onclick="window.editQuestion('${docSnap.id}')" class="text-blue-400 hover:text-blue-300 mr-3"><i class="fas fa-edit"></i></button>
                    <button onclick="window.deleteQuestion('${docSnap.id}')" class="text-red-400 hover:text-red-300"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        const loadMoreBtn = document.getElementById('load-more-questions');
        if (loadMoreBtn) loadMoreBtn.style.display = snapshot.size < 10 ? 'none' : 'inline-block';

    } catch (e) {
        console.error("Load Questions Error:", e);
        if(!loadMore) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-red-500 py-4">Error loading data. Check console (Indexes?).</td></tr>';
    }
}

window.openQuestionModal = () => {
    const form = document.getElementById('question-form');
    if(form) {
        form.reset();
        document.getElementById('q-id').value = '';
        document.getElementById('q-modal-title').textContent = "Add Question";
        window.openModal('modal-question-editor');
    }
};

window.editQuestion = async (id) => {
    try {
        const docSnap = await getDoc(doc(db, "quizzieQuestionBank", id));
        if (!docSnap.exists()) return;
        const d = docSnap.data();

        document.getElementById('q-id').value = id;
        document.getElementById('q-text').value = d.question;
        document.getElementById('q-opt-0').value = d.options[0] || '';
        document.getElementById('q-opt-1').value = d.options[1] || '';
        document.getElementById('q-opt-2').value = d.options[2] || '';
        document.getElementById('q-opt-3').value = d.options[3] || '';
        document.getElementById('q-subject').value = d.subject;
        document.getElementById('q-difficulty').value = d.difficulty;
        document.getElementById('q-explanation').value = d.explanation;
        
        // Populate answer dropdown logic (simplified)
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
    } catch (e) { alert("Error: " + e.message); }
};

window.saveQuestion = async () => {
    const id = document.getElementById('q-id').value;
    const question = document.getElementById('q-text').value;
    const options = [
        document.getElementById('q-opt-0').value,
        document.getElementById('q-opt-1').value,
        document.getElementById('q-opt-2').value,
        document.getElementById('q-opt-3').value
    ];
    const answer = document.getElementById('q-answer').value || options[0]; // Fallback
    const subject = document.getElementById('q-subject').value;
    const difficulty = document.getElementById('q-difficulty').value;
    const explanation = document.getElementById('q-explanation').value;

    const data = {
        question, options, answer, subject, difficulty, explanation,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid
    };

    try {
        if (id) {
            await updateDoc(doc(db, "quizzieQuestionBank", id), data);
        } else {
            data.createdAt = serverTimestamp();
            await setDoc(doc(collection(db, "quizzieQuestionBank")), data);
        }
        window.closeModal('modal-question-editor');
        loadQuestions();
    } catch (e) { alert("Failed to save: " + e.message); }
};

window.deleteQuestion = async (id) => {
    if (confirm("Delete this question?")) {
        await deleteDoc(doc(db, "quizzieQuestionBank", id));
        loadQuestions();
    }
};


// ==========================================================================
// 4. ADMIN USER & NOTIFICATIONS
// ==========================================================================

async function loadAdminUsers() {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;
    try {
        const snapshot = await getDocs(query(collection(db, "admin_directory"), orderBy("role")));
        tbody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-800 hover:bg-slate-800/50";
            tr.innerHTML = `<td class="px-6 py-4 font-medium text-white">${d.name}</td><td class="px-6 py-4 text-slate-400">${d.role}</td><td class="px-6 py-4 text-slate-500 text-xs">${d.email}</td><td class="px-6 py-4 text-right"><button onclick="window.removeAdmin('${docSnap.id}')" class="text-red-400 hover:text-white"><i class="fas fa-trash"></i></button></td>`;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

window.removeAdmin = async (id) => {
    if (confirm("Remove admin access?")) {
        await deleteDoc(doc(db, "admin_directory", id));
        loadAdminUsers();
    }
};

// Notification logic remains similar to previous versions
async function loadNotifications() {
    const container = document.getElementById('active-notifications-list');
    if (!container) return;
    try {
        const q = query(collection(db, "system_notifications"), where("active", "==", true), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        container.innerHTML = snapshot.empty ? '<p class="text-slate-500 text-sm">No active broadcasts.</p>' : '';
        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            const div = document.createElement('div');
            div.className = "bg-slate-800 p-3 rounded border border-slate-700 flex justify-between";
            div.innerHTML = `<div><span class="text-xs uppercase bg-blue-900 text-blue-300 px-1 rounded mr-2">${d.type}</span><span class="text-sm text-white">${d.message}</span></div><button onclick="window.stopBroadcast('${docSnap.id}')" class="text-red-400 hover:text-white"><i class="fas fa-times"></i></button>`;
            container.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

document.getElementById('notification-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('notif-message').value;
    const type = document.getElementById('notif-type').value;
    const pages = Array.from(e.target.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
    
    // Handle Image
    let imageUrl = null;
    const fileInput = document.getElementById('notif-image');
    if(type === 'popup' && fileInput.files[0]) {
        imageUrl = await fileToBase64(fileInput.files[0]);
    }

    await setDoc(doc(collection(db, "system_notifications")), {
        message, type, targetPages: pages, imageUrl, active: true,
        createdAt: serverTimestamp(), createdBy: currentUser.uid
    });
    alert("Published!");
    e.target.reset();
    loadNotifications();
});

window.stopBroadcast = async (id) => {
    if(confirm("Stop broadcast?")) {
        await deleteDoc(doc(db, "system_notifications", id));
        loadNotifications();
    }
};

// --- UTILS ---
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.readAsDataURL(file);
        r.onload = () => resolve(r.result);
        r.onerror = reject;
    });
}

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

// Dropdown / Filter listeners
document.getElementById('filter-subject')?.addEventListener('change', () => loadQuestions(false));
document.getElementById('load-more-questions')?.addEventListener('click', () => loadQuestions(true));
