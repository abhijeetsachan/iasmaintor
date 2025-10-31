// js/firebase-config.js

// --- Firebase Configuration ---
// Reads from Vercel's Environment Variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// --- Google AI (Gemini) API Key ---
// Reads from Vercel's Environment Variables
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

// --- Exports ---
export { firebaseConfig, GEMINI_API_KEY };

// --- Basic Validation (for developer feedback) ---
if (!firebaseConfig.apiKey) {
    console.error("Firebase API Key is MISSING. Make sure NEXT_PUBLIC_FIREBASE_API_KEY is set in your Vercel environment.");
}

if (!GEMINI_API_KEY) {
    console.error("Gemini API Key is MISSING. Make sure NEXT_PUBLIC_GEMINI_API_KEY is set in your Vercel environment.");
}
