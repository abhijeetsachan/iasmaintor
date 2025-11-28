// js/firebase-config.js

// --- Firebase Configuration ---
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

// --- API Endpoints ---
const GET_CHAT_RESPONSE_ENDPOINT = '/api/getChatResponse';
const GET_QUIZ_QUESTIONS_ENDPOINT = '/api/getQuizQuestions';

// UPDATED: Point to the secure proxy instead of the old gemini endpoint
const GEMINI_API_ENDPOINT = '/api/proxy'; 


// --- Exports ---
export { 
  firebaseConfig, 
  GET_CHAT_RESPONSE_ENDPOINT, 
  GET_QUIZ_QUESTIONS_ENDPOINT, 
  GEMINI_API_ENDPOINT 
};

// --- Basic Validation ---
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_ACTUAL_API_KEY") {
    console.error("Firebase config is MISSING. Please edit js/firebase-config.js.");
}
