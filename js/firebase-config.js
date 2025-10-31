// js/firebase-config.js

// --- Firebase Configuration ---
// This is your web app's public Firebase configuration.
// It is safe to be in client-side code and is necessary
// for the app to connect to your Firebase project.
const firebaseConfig = {
  apiKey: "AIzaSyBwUfBVI5ApoasTN4nG8H-PA4F_cRMn30s",
  authDomain: "iasmaintor.firebaseapp.com",
  databaseURL: "https://iasmaintor-default-rtdb.firebaseio.com",
  projectId: "iasmaintor",
  storageBucket: "iasmaintor.firebasestorage.app",
  messagingSenderId: "867922749381",
  appId: "1:867922749381:web:3e57cbdf0bd7a072830dac",
  measurementId: "G-GJNCMRNWGM"
};

// --- Google AI (Gemini) API Endpoint ---
// This correctly points to your Vercel serverless function (api/gemini.js)
// which securely uses your *secret* GEMINI_API_KEY.
const GEMINI_API_ENDPOINT = '/api/gemini';


// --- Exports ---
export { firebaseConfig, GEMINI_API_ENDPOINT };

// --- Basic Validation (Optional, for developer feedback) ---
// This check will now pass, and the error will no longer appear in the console.
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_ACTUAL_API_KEY") {
    console.error("Firebase config is MISSING. Please edit js/firebase-config.js and replace the placeholder values with your actual Firebase project keys.");
}
