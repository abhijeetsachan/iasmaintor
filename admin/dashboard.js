// admin/js/dashboard.js
// Main Logic: Stats, User Mgmt, Notifications

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
    setDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    serverTimestamp, 
    getCountFromServer 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// --- Initialize ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- State ---
let currentUser = null;
let adminProfile = null;

// --- AUTH GUARD & INIT ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // 1. Verify Role (Double check session vs DB)
        const adminDoc = await getDoc(doc(db, "admin_directory", user.uid));
        
        if (adminDoc.exists()) {
            adminProfile = adminDoc.data();
            updateProfileUI(adminProfile);
            initDashboard(); // Start loading data
        } else {
            // Not an admin? Kick them out.
            alert("Unauthorized. Redirecting...");
            await signOut(auth);
            window.location.href = 'login.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});

function updateProfileUI(profile) {
    document.getElementById('admin-name-display').textContent = profile.name || "Admin";
    document.getElementById('admin-role-display').textContent = profile.role.toUpperCase().replace('_', ' ');
    document.getElementById('admin-avatar').textContent = (profile.name || "A").charAt(0).toUpperCase();
}

// --- LOGOUT ---
document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'login.html';
});


// ==========================================================================
// 1. DASHBOARD STATS MODULE
// ==========================================================================

async function initDashboard() {
    console.log("Initializing Admin Dashboard...");
    
    // Load Stats
    loadStatCount('users', 'stat-total-users');
    loadStatCount('admin_directory', 'stat-admins');
    loadStatCount('quizzieQuestionBank', 'stat-questions');
    
    // Special Query for Mentorship (Count docs with mentorshipRequest field? 
    // Firestore doesn't support "has field" count easily without reading. 
    // For efficiency, we'll just count the 'users' who have 'mentorshipRequest.status' == 'pending' if you save it that way.
    // For now, simple collection counts:)
    
    // Load Modules
    loadAdminUsers();
    loadNotifications();
}

async function loadStatCount(colName, elementId) {
    try {
        const coll = collection(db, colName);
        const snapshot = await getCountFromServer(coll);
        document.getElementById(elementId).textContent = snapshot.data().count;
    } catch (e) {
        console.warn(`Could not load stats for ${colName}`, e);
        document.getElementById(elementId).textContent = "-";
    }
}


// ==========================================================================
// 2. USER MANAGEMENT MODULE (RBAC)
// ==========================================================================

async function loadAdminUsers() {
    const tbody = document.getElementById('admin-table-body');
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center italic text-slate-500">Refreshing list...</td></tr>';

    try {
        const q = query(collection(db, "admin_directory"), orderBy("role"));
        const querySnapshot = await getDocs(q);
        
        tbody.innerHTML = ''; // Clear loader

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-800/30 transition-colors border-b border-slate-800 last:border-0";
            
            // Role Badge Color
            const roleColors = {
                'super_admin': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                'editor': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                'mentor': 'bg-green-500/10 text-green-400 border-green-500/20'
            };
            const roleBadge = `<span class="px-2 py-1 rounded text-xs border ${roleColors[data.role] || 'bg-slate-700'}">${data.role.replace('_', ' ').toUpperCase()}</span>`;

            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-white">${data.name}</td>
                <td class="px-6 py-4">${roleBadge}</td>
                <td class="px-6 py-4"><span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-green-500"></span> Active</span></td>
                <td class="px-6 py-4 text-xs text-slate-500">${data.email}</td>
                <td class="px-6 py-4 text-right">
                    ${(adminProfile.role === 'super_admin' && docSnap.id !== currentUser.uid) ? 
                        `<button onclick="deleteAdmin('${docSnap.id}')" class="text-red-400 hover:text-red-300 transition-colors"><i class="fas fa-trash"></i></button>` 
                        : '<span class="text-slate-600 cursor-not-allowed"><i class="fas fa-lock"></i></span>'}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error loading admins:", e);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500 py-4">Failed to load data.</td></tr>';
    }
}

// Handle Add Admin Form
document.getElementById('add-admin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Permission Check
    if (adminProfile.role !== 'super_admin') {
        alert("Only Super Admins can add new team members.");
        return;
    }

    const formData = new FormData(e.target);
    const email = formData.get('email').trim().toLowerCase();
    const name = formData.get('name').trim();
    const role = formData.get('role');

    // Button Loading State
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = "Searching...";
    btn.disabled = true;

    try {
        // 1. Find UID from 'users' collection using Email
        // Note: This assumes the user has already signed up on the main site.
        const usersRef = collection(db, "artifacts", "default-app-id", "users"); 
        // ^ Using the correct path from your app structure
        
        // We need to query the 'profile' field inside the user doc? 
        // Firestore doesn't let us easily query 'users' by email unless we stored email as a top-level field or ID.
        // In your 'auth.js', you save profile: { email: ... }. 
        // We'll try to query that.
        
        const q = query(usersRef, where("profile.email", "==", email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert(`User with email ${email} not found in main database.\n\nAsk them to sign up on the website first!`);
            btn.textContent = originalText;
            btn.disabled = false;
            return;
        }

        const targetUserDoc = querySnapshot.docs[0];
        const targetUid = targetUserDoc.id;

        // 2. Add to Admin Directory
        await setDoc(doc(db, "admin_directory", targetUid), {
            name: name,
            email: email,
            role: role,
            addedBy: currentUser.uid,
            createdAt: serverTimestamp()
        });

        alert("Admin added successfully!");
        closeModal('modal-add-admin');
        e.target.reset();
        loadAdminUsers(); // Refresh table

    } catch (error) {
        console.error("Add Admin Error:", error);
        alert("Failed to add admin: " + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

window.deleteAdmin = async (uid) => {
    if (!confirm("Are you sure you want to remove this admin? They will lose access immediately.")) return;
    try {
        await deleteDoc(doc(db, "admin_directory", uid));
        loadAdminUsers();
    } catch (e) {
        alert("Error removing admin: " + e.message);
    }
};


// ==========================================================================
// 3. GLOBAL NOTIFICATIONS MODULE
// ==========================================================================

async function loadNotifications() {
    const listContainer = document.getElementById('active-notifications-list');
    if (!listContainer) return;

    try {
        const q = query(collection(db, "system_notifications"), where("active", "==", true), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            listContainer.innerHTML = '<p class="text-slate-500 text-sm text-center py-4">No active broadcasts.</p>';
            return;
        }

        listContainer.innerHTML = '';
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            const item = document.createElement('div');
            item.className = "bg-slate-800 border border-slate-700 rounded-lg p-4 flex justify-between items-start group";
            
            const typeBadge = `<span class="text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded bg-slate-700 text-slate-300">${data.type}</span>`;
            const pages = data.targetPages ? data.targetPages.join(", ") : "All";

            item.innerHTML = `
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        ${typeBadge}
                        <span class="text-xs text-slate-500">Visible on: ${pages}</span>
                    </div>
                    <p class="text-white text-sm">${data.message}</p>
                    ${data.imageUrl ? `<img src="${data.imageUrl}" class="mt-2 h-16 w-auto rounded border border-slate-600">` : ''}
                </div>
                <button onclick="deactivateNotification('${docSnap.id}')" class="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <i class="fas fa-times-circle text-xl"></i>
                </button>
            `;
            listContainer.appendChild(item);
        });

    } catch (e) {
        console.error("Load Notifs Error:", e);
        listContainer.innerHTML = '<p class="text-red-500 text-sm">Error loading broadcasts.</p>';
    }
}

// Handle Notification Form
document.getElementById('notification-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const message = document.getElementById('notif-message').value;
    const type = document.getElementById('notif-type').value;
    
    // Get Checkboxes
    const checkedPages = [];
    e.target.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        if (cb.value !== 'on') checkedPages.push(cb.value);
    });

    // Image Handling (Base64)
    let imageUrl = null;
    const fileInput = document.getElementById('notif-image');
    
    if (type === 'popup' && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 1024 * 1024) { // 1MB limit
            alert("Image is too large. Please keep it under 1MB.");
            return;
        }
        imageUrl = await fileToBase64(file);
    }

    try {
        // Since there's usually only one active banner/popup, we could deactivate others of same type,
        // but for now, we just add a new one.
        
        const notifData = {
            message,
            type,
            targetPages: checkedPages,
            imageUrl,
            active: true,
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid
        };

        // Add to collection
        const newRef = doc(collection(db, "system_notifications"));
        await setDoc(newRef, notifData);

        alert("Broadcast published!");
        e.target.reset();
        // Hide image input again
        document.getElementById('banner-upload-container').classList.add('hidden');
        loadNotifications();

    } catch (err) {
        console.error("Publish Error:", err);
        alert("Error publishing: " + err.message);
    }
});

window.deactivateNotification = async (id) => {
    if (!confirm("Stop this broadcast?")) return;
    try {
        await deleteDoc(doc(db, "system_notifications", id));
        loadNotifications();
    } catch (e) {
        alert("Error: " + e.message);
    }
};

// Helper: File to Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}


// ==========================================================================
// GLOBAL EXPORTS (For Modal/HTML access)
// ==========================================================================
window.closeModal = (id) => {
    const el = document.getElementById(id);
    el.classList.add('opacity-0');
    setTimeout(() => el.classList.add('hidden'), 200);
};
