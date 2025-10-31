// js/firebase-config.js

// --- Firebase Configuration ---
//
// !! IMPORTANT !!
// The 'process.env' variables were causing an error because they only work in a Node.js
// environment (like a server). This file runs in the user's browser, where 'process' is not defined.
//
// You MUST replace the placeholders below (e.g., "YOUR_ACTUAL_API_KEY")
// with your actual Firebase project keys for the app to work.
// You can find these values in your Firebase project settings.
//
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "YOUR_ACTUAL_AUTH_DOMAIN",
  projectId: "YOUR_ACTUAL_PROJECT_ID",
  storageBucket: "YOUR_ACTUAL_STORAGE_BUCKET",
  messagingSenderId: "YOUR_ACTUAL_MESSAGING_SENDER_ID",
  appId: "YOUR_ACTUAL_APP_ID"
};

// --- Google AI (Gemini) API Endpoint ---
// This part is correct. We call our OWN backend API route,
// which securely handles the actual GEMINI_API_KEY.
const GEMINI_API_ENDPOINT = '/api/gemini';


// --- Exports ---
export { firebaseConfig, GEMINI_API_ENDPOINT };

// --- Basic Validation (Optional, for developer feedback) ---
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_ACTUAL_API_KEY") {
    console.error("Firebase config is MISSING. Please edit js/firebase-config.js and replace the placeholder values with your actual Firebase project keys.");
}
