// admin/js/dashboard.js
// Full Admin Logic: Stats, Users, Notifications, and Question Bank

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

// --- State ---
let currentUser = null;
let adminProfile = null;
let lastQuestionSnapshot = null; // For pagination

// --- AUTH GUARD ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        try {
            // 1. Verify Role in 'admin_directory'
            const adminDoc = await getDoc(doc(db, "admin_directory", user.uid));
            
            if (adminDoc.exists()) {
                adminProfile = adminDoc.data();
                
                // 2. Update Profile & Reveal Dashboard
                updateProfileUI(adminProfile);
                revealDashboard(); 
                
                // 3. Load Data
                initDashboard(); 
            } else {
                throw new Error("User not in admin directory");
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
            <div class="text-center text-red-500">
                <i class="fas fa-lock text-4xl mb-4"></i>
                <p class="font-bold mb-4">Access Denied: ${msg}</p>
                <button class="bg-slate-700 text-white px-4 py-2 rounded" onclick="location.href='login.html'">Go to Login</button>
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
    
    loadAdminUsers();
    loadNotifications();
    loadQuestions(); // Load first batch of questions
}

async function loadStatCount(colName, elementId) {
    const el = document.getElementById(elementId);
    try {
        const snapshot = await getCountFromServer(collection(db, colName));
        if(el) el.textContent = snapshot.data().count;
    } catch (e) {
        console.warn(`Stats error (${colName}):`, e);
        if(el) el.textContent = "-";
    }
}


// ==========================================================================
// 2. QUESTION BANK MODULE
// ==========================================================================

async function loadQuestions(loadMore = false) {
    const tbody = document.getElementById('questions-table-body');
    if (!loadMore) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-slate-500">Loading questions...</td></tr>';
        lastQuestionSnapshot = null;
    }

    try {
        const subjectFilter = document.getElementById('filter-subject')?.value || 'all';
        let q = query(collection(db, "quizzieQuestionBank"), orderBy("createdAt", "desc"), limit(10));
        
        if (subjectFilter !== 'all') {
            // Note: Firestore requires an index for filtering by subject + sorting by time
            // If this fails, check console for index creation link
            q = query(collection(db, "quizzieQuestionBank"), where("subject", "==", subjectFilter), orderBy("createdAt", "desc"), limit(10));
        }
        
        if (loadMore && lastQuestionSnapshot) {
            q = query(q, startAfter(lastQuestionSnapshot));
        }

        const snapshot = await getDocs(q);
        
        if (!loadMore) tbody.innerHTML = ''; // Clear loader

        if (snapshot.empty && !loadMore) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-slate-500">No questions found.</td></tr>';
            return;
        }

        lastQuestionSnapshot = snapshot.docs[snapshot.docs.length - 1];

        snapshot.forEach(docSnap => {
            const qData = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="font-medium text-white line-clamp-2">${qData.question}</div>
                    <div class="text-xs text-slate-500 mt-1">Ans: ${qData.answer}</div>
                </td>
                <td class="text-slate-400 text-sm capitalize">${qData.subject || 'General'}</td>
                <td><span class="px-2 py-1 rounded text-xs bg-slate-700 text-slate-300 capitalize">${qData.difficulty || 'Basic'}</span></td>
                <td class="text-right">
                    <button onclick="window.editQuestion('${docSnap.id}')" class="text-blue-400 hover:text-blue-300 mr-3"><i class="fas fa-edit"></i></button>
                    <button onclick="window.deleteQuestion('${docSnap.id}')" class="text-red-400 hover:text-red-300"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Handle "Load More" button visibility
        const loadMoreBtn = document.getElementById('load-more-questions');
        if (snapshot.size < 10) loadMoreBtn.style.display = 'none';
        else loadMoreBtn.style.display = 'inline-block';

    } catch (e) {
        console.error("Load Questions Error:", e);
        if(!loadMore) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-red-500 py-4">Error loading data. Check console.</td></tr>';
    }
}

// -- Question Actions --

window.openQuestionModal = () => {
    document.getElementById('question-form').reset();
    document.getElementById('q-id').value = '';
    document.getElementById('q-modal-title').textContent = "Add Question";
    
    // Populate options dropdown
    updateAnswerDropdown();
    
    window.openModal('modal-question-editor');
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
        
        updateAnswerDropdown(); // Refresh select options based on inputs
        document.getElementById('q-answer').value = d.answer;

        document.getElementById('q-modal-title').textContent = "Edit Question";
        window.openModal('modal-question-editor');

    } catch (e) { alert("Error fetching question details: " + e.message); }
};

// Helper to sync "Correct Answer" dropdown with Option Inputs
function updateAnswerDropdown() {
    const select = document.getElementById('q-answer');
    const oldVal = select.value;
    select.innerHTML = '';
    
    for(let i=0; i<4; i++) {
        const optVal = document.getElementById(`q-opt-${i}`).value;
        const opt = document.createElement('option');
        opt.value = optVal;
        opt.textContent = `Option ${String.fromCharCode(65+i)}: ${optVal.substring(0, 30)}...`;
        select.appendChild(opt);
    }
    select.value = oldVal;
}

// Listen to option inputs to update dropdown in real-time
[0,1,2,3].forEach(i => {
    document.getElementById(`q-opt-${i}`)?.addEventListener('input', updateAnswerDropdown);
});

window.saveQuestion = async () => {
    const id = document.getElementById('q-id').value;
    const question = document.getElementById('q-text').value;
    const options = [
        document.getElementById('q-opt-0').value,
        document.getElementById('q-opt-1').value,
        document.getElementById('q-opt-2').value,
        document.getElementById('q-opt-3').value
    ];
    const answer = document.getElementById('q-answer').value;
    const subject = document.getElementById('q-subject').value;
    const difficulty = document.getElementById('q-difficulty').value;
    const explanation = document.getElementById('q-explanation').value;

    if (!question || options.some(o => !o) || !answer) {
        alert("Please fill in all fields.");
        return;
    }

    const data = {
        question, options, answer, subject, difficulty, explanation,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid
    };

    try {
        if (id) {
            await updateDoc(doc(db, "quizzieQuestionBank", id), data);
            alert("Question updated!");
        } else {
            data.createdAt = serverTimestamp();
            await setDoc(doc(collection(db, "quizzieQuestionBank")), data); // Auto-ID
            alert("Question added!");
        }
        window.closeModal('modal-question-editor');
        loadQuestions(); // Refresh list
    } catch (e) {
        console.error("Save Error:", e);
        alert("Failed to save: " + e.message);
    }
};

window.deleteQuestion = async (id) => {
    if (confirm("Are you sure you want to delete this question?")) {
        await deleteDoc(doc(db, "quizzieQuestionBank", id));
        loadQuestions();
    }
};

document.getElementById('filter-subject')?.addEventListener('change', () => loadQuestions(false));
document.getElementById('load-more-questions')?.addEventListener('click', () => loadQuestions(true));


// ==========================================================================
// 3. ADMIN USER MANAGEMENT
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
            tr.innerHTML = `
                <td class="px-6 py-4">${d.name}</td>
                <td class="px-6 py-4"><span class="px-2 py-1 rounded text-xs bg-slate-700 border border-slate-600 text-slate-300">${d.role}</span></td>
                <td class="px-6 py-4 text-slate-400 text-xs">${d.email}</td>
                <td class="px-6 py-4 text-right">
                    ${adminProfile.role === 'super_admin' && docSnap.id !== currentUser.uid ? 
                    `<button onclick="window.removeAdmin('${docSnap.id}')" class="text-red-400 hover:text-white"><i class="fas fa-trash"></i></button>` : 
                    `<i class="fas fa-lock text-slate-600"></i>`}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error("Admin Load Error:", e); }
}

document.getElementById('add-admin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email').trim().toLowerCase();
    
    // Check if user exists in main DB
    const usersRef = collection(db, "artifacts", "default-app-id", "users");
    const q = query(usersRef, where("profile.email", "==", email));
    const snap = await getDocs(q);
    
    if (snap.empty) {
        alert("User not found. Please ask them to register on the main website first.");
        return;
    }
    
    const uid = snap.docs[0].id;
    await setDoc(doc(db, "admin_directory", uid), {
        name: formData.get('name'),
        email: email,
        role: formData.get('role'),
        addedBy: currentUser.uid,
        createdAt: serverTimestamp()
    });
    
    alert("Admin added!");
    window.closeModal('modal-add-admin');
    loadAdminUsers();
});

window.removeAdmin = async (id) => {
    if (confirm("Remove access for this admin?")) {
        await deleteDoc(doc(db, "admin_directory", id));
        loadAdminUsers();
    }
};


// ==========================================================================
// 4. NOTIFICATIONS
// ==========================================================================

async function loadNotifications() {
    const container = document.getElementById('active-notifications-list');
    if (!container) return;
    
    try {
        const q = query(collection(db, "system_notifications"), where("active", "==", true), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        container.innerHTML = '';
        if (snapshot.empty) container.innerHTML = '<p class="text-slate-500 text-sm">No active broadcasts.</p>';
        
        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            const item = document.createElement('div');
            item.className = "bg-slate-800 p-3 rounded border border-slate-700 flex justify-between items-start";
            item.innerHTML = `
                <div>
                    <span class="text-xs uppercase bg-blue-900 text-blue-300 px-1 rounded">${d.type}</span>
                    <p class="text-sm text-white mt-1">${d.message}</p>
                    ${d.imageUrl ? `<a href="${d.imageUrl}" target="_blank" class="text-xs text-blue-400 underline">View Image</a>` : ''}
                </div>
                <button onclick="window.stopBroadcast('${docSnap.id}')" class="text-slate-500 hover:text-red-400"><i class="fas fa-times"></i></button>
            `;
            container.appendChild(item);
        });
    } catch (e) { console.error(e); }
}

document.getElementById('notification-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('notif-message').value;
    const type = document.getElementById('notif-type').value;
    const pages = Array.from(e.target.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
    
    let imageUrl = null;
    const fileInput = document.getElementById('notif-image');
    if (type === 'popup' && fileInput.files[0]) {
        imageUrl = await fileToBase64(fileInput.files[0]);
    }
    
    await setDoc(doc(collection(db, "system_notifications")), {
        message, type, targetPages: pages, imageUrl, active: true,
        createdAt: serverTimestamp(), createdBy: currentUser.uid
    });
    
    alert("Broadcast sent!");
    e.target.reset();
    loadNotifications();
});

window.stopBroadcast = async (id) => {
    if(confirm("Stop this broadcast?")) {
        await deleteDoc(doc(db, "system_notifications", id));
        loadNotifications();
    }
};

// --- Utils ---
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.readAsDataURL(file);
        r.onload = () => resolve(r.result);
        r.onerror = reject;
    });
}

// Global Modal Helper
window.closeModal = (id) => {
    const el = document.getElementById(id);
    if(el) {
        el.classList.add('opacity-0');
        setTimeout(() => el.classList.add('hidden'), 200);
    }
};
