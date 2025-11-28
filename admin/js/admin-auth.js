// admin/js/admin-auth.js

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginForm = document.getElementById('admin-login-form');
const loginBtn = document.getElementById('login-btn');
const errorContainer = document.getElementById('login-error');
const errorText = document.getElementById('login-error-text');

// Prevent redirect loop: Only redirect if on login page
if (window.location.pathname.endsWith('login.html')) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const isAdmin = await verifyAdminRole(user.uid);
            if (isAdmin) {
                window.location.href = 'dashboard.html';
            } else {
                await signOut(auth);
                showError("Access Denied. Not an admin.");
            }
        }
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        setLoading(true);
        hideError();

        try {
            const userCred = await signInWithEmailAndPassword(auth, email, password);
            const isAdmin = await verifyAdminRole(userCred.user.uid);

            if (isAdmin) {
                window.location.href = 'dashboard.html';
            } else {
                throw new Error("Unauthorized");
            }
        } catch (error) {
            console.error("Login Error:", error);
            let msg = "Login failed.";
            if (error.message === "Unauthorized") msg = "Access Denied.";
            else if (error.code === 'auth/invalid-credential') msg = "Invalid credentials.";
            showError(msg);
            await signOut(auth);
            setLoading(false);
        }
    });
}

async function verifyAdminRole(uid) {
    try {
        const snap = await getDoc(doc(db, "admin_directory", uid));
        return snap.exists();
    } catch (e) { return false; }
}

function setLoading(isLoading) {
    if(loginBtn) {
        loginBtn.disabled = isLoading;
        loginBtn.textContent = isLoading ? "Verifying..." : "Sign In";
    }
}

function showError(msg) {
    if(errorContainer && errorText) {
        errorText.textContent = msg;
        errorContainer.classList.remove('hidden');
    }
}

function hideError() {
    if(errorContainer) errorContainer.classList.add('hidden');
}
