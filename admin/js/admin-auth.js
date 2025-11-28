// admin/js/admin-auth.js
// Secure Admin Authentication & Role Verification

import { firebaseConfig } from '../../js/firebase-config.js';
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

// --- 1. Auth State Listener (Redirect Logic) ---
// Only active on the login page to auto-redirect legitimate admins
if (window.location.pathname.endsWith('login.html') || window.location.pathname.endsWith('login')) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is logged in, check if they are an admin
            const isAdmin = await verifyAdminRole(user.uid);
            if (isAdmin) {
                window.location.href = 'dashboard.html';
            } else {
                // User is logged in but NOT an admin -> Kick them out
                console.warn("Unauthorized user tried to access admin panel.");
                await signOut(auth);
                showError("Access Denied. You are not an administrator.");
            }
        }
    });
}

// --- 2. Login Form Handler ---
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        setLoading(true);
        hideError();

        try {
            // A. Authenticate with Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // B. Authorization Check (RBAC)
            const isAdmin = await verifyAdminRole(user.uid);

            if (isAdmin) {
                // C. Success -> Redirect
                window.location.href = 'dashboard.html';
            } else {
                // D. Fail -> Logout & Error
                throw new Error("Unauthorized");
            }

        } catch (error) {
            console.error("Admin Login Error:", error);
            
            // Ensure we don't leave a non-admin session active
            await signOut(auth); 
            
            let msg = "Login failed. Please check your credentials.";
            if (error.message === "Unauthorized") {
                msg = "Access Denied: Your account does not have admin privileges.";
            } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                msg = "Invalid email or password.";
            } else if (error.code === 'auth/too-many-requests') {
                msg = "Too many failed attempts. Please try again later.";
            }
            
            showError(msg);
            setLoading(false);
        }
    });
}

// --- 3. Helper: Verify Admin Role ---
// Checks if the user ID exists in the 'admin_directory' collection
async function verifyAdminRole(uid) {
    try {
        const docRef = doc(db, "admin_directory", uid);
        const docSnap = await getDoc(docRef);
        return docSnap.exists();
    } catch (e) {
        console.error("RBAC Check Error:", e);
        return false;
    }
}

// --- 4. UI Utility Functions ---
function setLoading(isLoading) {
    if (loginBtn) {
        if (isLoading) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Verifying...`;
            loginBtn.classList.add('opacity-75', 'cursor-not-allowed');
        } else {
            loginBtn.disabled = false;
            loginBtn.innerHTML = `<span>Sign In</span> <i class="fas fa-arrow-right ml-2"></i>`;
            loginBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    }
}

function showError(msg) {
    if (errorText && errorContainer) {
        errorText.textContent = msg;
        errorContainer.classList.remove('hidden');
        errorContainer.classList.add('flex');
    }
}

function hideError() {
    if (errorContainer) {
        errorContainer.classList.add('hidden');
        errorContainer.classList.remove('flex');
    }
}
