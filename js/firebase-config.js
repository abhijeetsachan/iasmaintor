// js/firebase-config.js

// --- Firebase Configuration ---
// This is your web app's public Firebase configuration.
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

// --- Drona Chatbot API Endpoint ---
// This now points to your NEW cache-first serverless function.
const GET_CHAT_RESPONSE_ENDPOINT = '/api/getChatResponse';


// --- Exports ---
// We now export the new endpoint constant
export { firebaseConfig, GET_CHAT_RESPONSE_ENDPOINT };

// --- Basic Validation (Optional, for developer feedback) ---
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_ACTUAL_API_KEY") {
    console.error("Firebase config is MISSING. Please edit js/firebase-config.js and replace the placeholder values with your actual Firebase project keys.");
}
