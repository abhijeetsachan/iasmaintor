// js/notification-loader.js
// Loads Global Broadcasts (Banners, Popups, Toasts)

import { firebaseConfig } from './firebase-config.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy, 
    limit 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Initialize (Reuse existing app if available)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

async function loadGlobalNotifications() {
    console.log("Checking for global broadcasts...");
    
    try {
        // 1. Get the current page filename (e.g., 'index.html')
        let currentPage = window.location.pathname.split("/").pop() || 'index.html';
        
        // 2. Query Active Notifications
        // Note: Requires the same Composite Index as the Admin Panel
        const q = query(
            collection(db, "system_notifications"), 
            where("active", "==", true), 
            orderBy("createdAt", "desc"),
            limit(1) // Only show the latest one to avoid clutter
        );

        const snapshot = await getDocs(q);
        
        if (snapshot.empty) return;

        const data = snapshot.docs[0].data();
        const notificationId = snapshot.docs[0].id;

        // 3. Check Targeting
        if (data.targetPages && !data.targetPages.includes(currentPage)) {
            return; // This notification is not for this page
        }

        // 4. Check Local Storage (Don't show dismissed popups again in same session)
        const dismissedKey = `dismissed_notif_${notificationId}`;
        if (sessionStorage.getItem(dismissedKey)) return;

        // 5. Render UI based on Type
        renderNotificationUI(data, notificationId);

    } catch (error) {
        console.error("Notification Loader Error:", error);
    }
}

function renderNotificationUI(data, id) {
    const type = data.type; // 'banner', 'popup', 'toast'
    
    // --- A. TOP BANNER ---
    if (type === 'banner') {
        const banner = document.createElement('div');
        banner.className = "bg-blue-600 text-white px-4 py-3 text-sm font-medium relative z-50 flex justify-between items-center shadow-md slide-down";
        banner.style.animation = "slideDown 0.5s ease-out";
        banner.innerHTML = `
            <div class="flex items-center gap-2 mx-auto">
                <i class="fas fa-bullhorn"></i>
                <span>${data.message}</span>
            </div>
            <button id="close-banner-${id}" class="text-blue-200 hover:text-white ml-4 focus:outline-none">&times;</button>
        `;
        
        // Insert at very top of body
        document.body.prepend(banner);
        
        document.getElementById(`close-banner-${id}`).addEventListener('click', () => {
            banner.remove();
            sessionStorage.setItem(`dismissed_notif_${id}`, 'true');
        });
    }

    // --- B. POPUP MODAL ---
    else if (type === 'popup') {
        const modal = document.createElement('div');
        modal.className = "fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm fade-in";
        
        const imgHTML = data.imageUrl ? `<img src="${data.imageUrl}" class="w-full h-48 object-cover rounded-t-lg mb-4">` : '';
        
        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden relative transform scale-95 transition-all" style="animation: popIn 0.3s forwards;">
                ${imgHTML}
                <div class="p-6">
                    <h3 class="text-xl font-bold text-slate-800 mb-2">Announcement</h3>
                    <p class="text-slate-600 mb-6">${data.message}</p>
                    <button id="close-popup-${id}" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition-colors">Got it</button>
                </div>
                <button id="close-x-${id}" class="absolute top-3 right-3 text-slate-400 hover:text-slate-600 bg-white/80 rounded-full p-1"><i class="fas fa-times"></i></button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const closeFn = () => {
            modal.remove();
            sessionStorage.setItem(`dismissed_notif_${id}`, 'true');
        };
        
        document.getElementById(`close-popup-${id}`).addEventListener('click', closeFn);
        document.getElementById(`close-x-${id}`).addEventListener('click', closeFn);
        modal.addEventListener('click', (e) => { if(e.target === modal) closeFn(); });
    }
    
    // --- C. TOAST (Bottom Right) ---
    else if (type === 'toast') {
        const toast = document.createElement('div');
        toast.className = "fixed bottom-5 left-5 z-50 bg-slate-800 text-white px-6 py-4 rounded-lg shadow-2xl flex items-start gap-4 max-w-sm border-l-4 border-blue-500 slide-up";
        toast.style.animation = "slideUp 0.5s ease-out";
        toast.innerHTML = `
            <div class="flex-1">
                <h4 class="font-bold text-sm text-blue-400 mb-1">Update</h4>
                <p class="text-sm text-slate-300">${data.message}</p>
            </div>
            <button id="close-toast-${id}" class="text-slate-500 hover:text-white"><i class="fas fa-times"></i></button>
        `;
        
        document.body.appendChild(toast);
        
        document.getElementById(`close-toast-${id}`).addEventListener('click', () => {
            toast.remove();
            sessionStorage.setItem(`dismissed_notif_${id}`, 'true');
        });
    }
}

// Add basic styles for animations
const style = document.createElement('style');
style.innerHTML = `
    @keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
    @keyframes popIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
    @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
`;
document.head.appendChild(style);

// Run on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGlobalNotifications);
} else {
    loadGlobalNotifications();
}
