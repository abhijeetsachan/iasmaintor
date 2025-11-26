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
    getDoc,
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
        try {
            // 1. Verify Role
            const adminDocRef = doc(db, "admin_directory", user.uid);
            const adminDoc = await getDoc(adminDocRef);
            
            if (adminDoc.exists()) {
                adminProfile = adminDoc.data();
                
                // 2. Update UI & Remove Loader
                updateProfileUI(adminProfile);
                revealDashboard(); 
                
                // 3. Start Data Load
                initDashboard(); 
            } else {
                throw new Error("Unauthorized");
            }
        } catch (error) {
            console.error("Auth Guard Failed:", error);
            alert("Access Denied: You are not an administrator.");
            await signOut(auth);
            window.location.href = 'login.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});

function updateProfileUI(profile) {
    const nameDisplay = document.getElementById('admin-name-display');
    const roleDisplay = document.getElementById('admin-role-display');
    const avatarDisplay = document.getElementById('admin-avatar');

    if(nameDisplay) nameDisplay.textContent = profile.name || "Admin";
    if(roleDisplay) roleDisplay.textContent = (profile.role || "Staff").toUpperCase().replace('_', ' ');
    if(avatarDisplay) avatarDisplay.textContent = (profile.name || "A").charAt(0).toUpperCase();
}

function revealDashboard() {
    const loader = document.getElementById('auth-loader');
    const layout = document.getElementById('app-layout');
    
    if (loader) loader.classList.add('hidden');
    if (layout) layout.classList.remove('hidden');
}

// --- LOGOUT ---
const logoutBtn = document.getElementById('logout-btn');
if(logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = 'login.html';
    });
}


// ==========================================================================
// 1. DASHBOARD STATS MODULE
// ==========================================================================

async function initDashboard() {
    console.log("Initializing Admin Dashboard Data...");
    
    // Load Stats
    // Note: 'users' count might fail if you don't have the aggregation index enabled yet.
    // Check browser console for a link to create the index if it fails.
    loadStatCount('users', 'stat-total-users');
    loadStatCount('admin_directory', 'stat-admins');
    loadStatCount('quizzieQuestionBank', 'stat-questions');
    
    // Load Modules
    loadAdminUsers();
    loadNotifications();
}

async function loadStatCount(colName, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    try {
        // Attempt server-side count (cheaper/faster)
        const coll = collection(db, colName);
        const snapshot = await getCountFromServer(coll);
        el.textContent = snapshot.data().count;
    } catch (e) {
        console.warn(`Count failed for ${colName}. Falling back to snapshot size (legacy).`, e);
        try {
            // Fallback: Download docs (expensive, but works without index)
            const snapshot = await getDocs(collection(db, colName));
            el.textContent = snapshot.size;
        } catch (err2) {
            console.error(`Stats error for ${colName}:`, err2);
            el.textContent = "Err";
        }
    }
}


// ==========================================================================
// 2. USER MANAGEMENT MODULE (RBAC)
// ==========================================================================

async function loadAdminUsers() {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center italic text-slate-500">Refreshing list...</td></tr>';

    try {
        const q = query(collection(db, "admin_directory"), orderBy("role"));
        const querySnapshot = await getDocs(q);
        
        tbody.innerHTML = ''; // Clear loader

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-800/30 transition-colors border-b border-slate-800 last:border-0";
            
            const roleColors = {
                'super_admin': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                'editor': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                'mentor': 'bg-green-500/10 text-green-400 border-green-500/20'
            };
            const roleBadge = `<span class="px-2 py-1 rounded text-xs border ${roleColors[data.role] || 'bg-slate-700'}">${(data.role || 'Unknown').replace('_', ' ').toUpperCase()}</span>`;

            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-white">${data.name || 'No Name'}</td>
                <td class="px-6 py-4">${roleBadge}</td>
                <td class="px-6 py-4"><span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-green-500"></span> Active</span></td>
                <td class="px-6 py-4 text-xs text-slate-500">${data.email}</td>
                <td class="px-6 py-4 text-right">
                    ${(adminProfile.role === 'super_admin' && docSnap.id !== currentUser.uid) ? 
                        `<button onclick="window.deleteAdmin('${docSnap.id}')" class="text-red-400 hover:text-red-300 transition-colors"><i class="fas fa-trash"></i></button>` 
                        : '<span class="text-slate-600 cursor-not-allowed"><i class="fas fa-lock"></i></span>'}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error loading admins:", e);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red-500 py-4">Failed to load data. Check permissions.</td></tr>';
    }
}

const addAdminForm = document.getElementById('add-admin-form');
if (addAdminForm) {
    addAdminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (adminProfile.role !== 'super_admin') {
            alert("Only Super Admins can add new team members.");
            return;
        }

        const formData = new FormData(e.target);
        const email = formData.get('email').trim().toLowerCase();
        const name = formData.get('name').trim();
        const role = formData.get('role');

        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = "Searching...";
        btn.disabled = true;

        try {
            // For this to work, you must be using the same 'artifacts/default-app-id/users' path as in auth.js
            // Note: Firestore queries on 'profile.email' require an index.
            const usersRef = collection(db, "artifacts", "default-app-id", "users"); 
            const q = query(usersRef, where("profile.email", "==", email));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                alert(`User ${email} not found. They must register on the main site first.`);
                return;
            }

            const targetUid = querySnapshot.docs[0].id;

            await setDoc(doc(db, "admin_directory", targetUid), {
                name, email, role,
                addedBy: currentUser.uid,
                createdAt: serverTimestamp()
            });

            alert("Admin added!");
            window.closeModal('modal-add-admin');
            e.target.reset();
            loadAdminUsers();

        } catch (error) {
            console.error("Add Admin Error:", error);
            alert("Failed: " + error.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
}

window.deleteAdmin = async (uid) => {
    if (!confirm("Remove this admin?")) return;
    try {
        await deleteDoc(doc(db, "admin_directory", uid));
        loadAdminUsers();
    } catch (e) {
        alert("Error: " + e.message);
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
                <button onclick="window.deactivateNotification('${docSnap.id}')" class="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <i class="fas fa-times-circle text-xl"></i>
                </button>
            `;
            listContainer.appendChild(item);
        });

    } catch (e) {
        console.error("Load Notifs Error:", e);
        // Don't show error in UI if it's just a "requires index" error initially
    }
}

const notifForm = document.getElementById('notification-form');
if (notifForm) {
    notifForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const message = document.getElementById('notif-message').value;
        const type = document.getElementById('notif-type').value;
        
        const checkedPages = [];
        e.target.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            if (cb.value !== 'on') checkedPages.push(cb.value);
        });

        let imageUrl = null;
        const fileInput = document.getElementById('notif-image');
        
        if (type === 'popup' && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.size > 1024 * 1024) {
                alert("Image too large (Max 1MB)");
                return;
            }
            imageUrl = await fileToBase64(file);
        }

        try {
            await setDoc(doc(collection(db, "system_notifications")), {
                message, type, targetPages: checkedPages, imageUrl,
                active: true, createdAt: serverTimestamp(), createdBy: currentUser.uid
            });

            alert("Broadcast published!");
            e.target.reset();
            document.getElementById('banner-upload-container').classList.add('hidden');
            loadNotifications();
        } catch (err) {
            console.error("Publish Error:", err);
            alert("Error: " + err.message);
        }
    });
}

window.deactivateNotification = async (id) => {
    if (!confirm("Stop this broadcast?")) return;
    try {
        await deleteDoc(doc(db, "system_notifications", id));
        loadNotifications();
    } catch (e) {
        alert("Error: " + e.message);
    }
};

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// --- Global Helper ---
window.closeModal = (id) => {
    const el = document.getElementById(id);
    el.classList.add('opacity-0');
    setTimeout(() => el.classList.add('hidden'), 200);
};
