// js/firebase-config.js

// --- Firebase Configuration ---
// These keys are now securely sourced from Vercel's Environment Variables.
// You must set these in your Vercel Project Settings.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// --- Google AI (Gemini) API Endpoint ---
// We NO LONGER export the key. Instead, we export the path to our new
// secure backend API route (the serverless function).
const GEMINI_API_ENDPOINT = '/api/gemini';


// --- Exports ---
export { firebaseConfig, GEMINI_API_ENDPOINT };

// --- Basic Validation (Optional, for developer feedback) ---
if (!firebaseConfig.apiKey) {
    console.error("Firebase API Key is MISSING. Ensure NEXT_PUBLIC_FIREBASE_API_KEY is set in Vercel.");
}
