// admin/js/admin-auth.js
// secure admin authentication & RBAC check

import { firebaseConfig } from '../../js/firebase-config.js'; // Adjust path if needed

// --- Firebase SDK Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM Elements ---
const loginForm = document.getElementById('admin-login-form');
const loginBtn = document.getElementById('login-btn');
const errorContainer = document.getElementById('login-error');
const errorText = document.getElementById('login-error-text');

// --- State Check (Redirect if already logged in) ---
onAuthStateChanged(auth, async (user) => {
    // Only redirect IF we are on the login page
    if (user && window.location.pathname.includes('login.html')) {
        const isAdmin = await verifyAdminRole(user.uid);
        if (isAdmin) {
            window.location.href = 'dashboard.html';
        } else {
            await signOut(auth);
            showError("Access Denied: Your account is not authorized for the Admin Panel.");
        }
    }
});

// --- Login Logic ---
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        // UI Loading State
        setLoading(true);
        hideError();

        try {
            // 1. Standard Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Security Gate: Check Admin Directory
            const adminData = await verifyAdminRole(user.uid);

            if (adminData) {
                // 3. Success: Store vital session info
                sessionStorage.setItem('admin_role', adminData.role);
                sessionStorage.setItem('admin_name', adminData.name);
                
                // Redirect
                window.location.href = 'dashboard.html';
            } else {
                // 4. Fail: Not in admin directory
                throw new Error("Unauthorized Access");
            }

        } catch (error) {
            console.error("Admin Login Error:", error);
            await signOut(auth); // Force logout if auth passed but RBAC failed
            
            let msg = "Login failed. Please check credentials.";
            if (error.message === "Unauthorized Access") {
                msg = "Access Denied. You are not an administrator.";
            } else if (error.code === 'auth/invalid-credential') {
                msg = "Invalid email or password.";
            } else if (error.code === 'auth/too-many-requests') {
                msg = "Too many failed attempts. Try again later.";
            }
            
            showError(msg);
            setLoading(false);
        }
    });
}

// --- Helper: Verify Admin Role (RBAC) ---
async function verifyAdminRole(uid) {
    try {
        const docRef = doc(db, "admin_directory", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data(); // Returns { role: 'super_admin', name: '...', etc }
        } else {
            return null; // User exists in Auth but NOT in Admin Directory
        }
    } catch (e) {
        console.error("RBAC Check Failed:", e);
        return null;
    }
}

// --- UI Helpers ---
function setLoading(isLoading) {
    if (isLoading) {
        loginBtn.disabled = true;
        loginBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Verifying...`;
        loginBtn.classList.add('opacity-75', 'cursor-not-allowed');
    } else {
        loginBtn.disabled = false;
        loginBtn.innerHTML = `<span>Sign In</span> <i class="fas fa-arrow-right group-hover:translate-x-1 transition-transform"></i>`;
        loginBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
}

function showError(msg) {
    errorText.textContent = msg;
    errorContainer.classList.remove('hidden');
    errorContainer.classList.add('flex');
}

function hideError() {
    errorContainer.classList.add('hidden');
    errorContainer.classList.remove('flex');
}

// --- Export for use in other admin modules ---
export { auth, db, verifyAdminRole };
