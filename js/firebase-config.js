// js/firebase-config.js

// --- Firebase Configuration ---
// WARNING: Replace these hardcoded values with Environment Variables in production!
const firebaseConfig = {
  apiKey: "AIzaSyBwUfBVI5ApoasTN4nG8H-PA4F_cRMn30s", // Replace with Vercel env var like process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  authDomain: "iasmaintor.firebaseapp.com",       // Replace with Vercel env var like process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  projectId: "iasmaintor",                       // Replace with Vercel env var like process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  storageBucket: "iasmaintor.appspot.com",         // Replace with Vercel env var like process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "1088929315393",             // Replace with Vercel env var like process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  appId: "1:1088929315393:web:5d2b9a0b1a2a4b8c7d6c7e" // Replace with Vercel env var like process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// --- Google AI (Gemini) API Key ---
// WARNING: Replace this hardcoded value with an Environment Variable in production!
// IMPORTANT: For client-side code, consider if using the Gemini API directly is secure.
// Often, it's better to have a backend function (like a Vercel Serverless Function)
// make the API call to keep the key private. For this example, we proceed as requested.
const GEMINI_API_KEY = "AIzaSyAHB9BDQD7xOP1VDTavcqr30IEwlZkIM64"; // Replace with Vercel env var like process.env.NEXT_PUBLIC_GEMINI_API_KEY


// --- How to use Environment Variables with Vercel ---
// 1. Go to your Project Settings in Vercel.
// 2. Navigate to the "Environment Variables" section.
// 3. Add variables like `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_GEMINI_API_KEY`, etc.
//    (The `NEXT_PUBLIC_` prefix makes them available in the browser if using Next.js.
//     If using vanilla JS with Vercel, you might need a build step or serverless function
//     to inject them, or just name them e.g., `FIREBASE_API_KEY`).
// 4. In your code (ideally using a framework build process), you would access them like:
//    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "YOUR_DEVELOPMENT_KEY",
//    const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "YOUR_DEVELOPMENT_KEY";
//    (Including fallback keys for local development is common, but keep them out of public commits).


// --- Exports ---
export { firebaseConfig, GEMINI_API_KEY };

// --- Basic Validation (Optional, for developer feedback) ---
if (firebaseConfig.apiKey.startsWith("AIzaSy") && firebaseConfig.apiKey.length < 40) { // Basic check for Firebase key format
    console.warn("Firebase API Key seems present.");
} else if (!firebaseConfig.apiKey) {
    console.error("Firebase API Key is MISSING in firebase-config.js!");
} else {
     console.warn("Firebase API Key format looks unusual. Ensure it's correct.");
}

if (GEMINI_API_KEY.startsWith("AIzaSy") && GEMINI_API_KEY.length > 30) { // Basic check for Gemini key format
    console.warn("Gemini API Key seems present.");
} else if (!GEMINI_API_KEY) {
    console.error("Gemini API Key is MISSING in firebase-config.js!");
} else {
     console.warn("Gemini API Key format looks unusual. Ensure it's correct.");
}
