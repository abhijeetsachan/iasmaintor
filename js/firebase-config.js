// --- Firebase Configuration ---
// These values are best stored as Environment Variables in your hosting provider (e.g., Vercel).
// The `NEXT_PUBLIC_` prefix is a convention for Next.js to expose variables to the browser.
// If not using Next.js, you might need a different build step or naming convention.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// --- Google AI (Gemini) API Key ---
// WARNING: This key is being read from an environment variable.
// For client-side apps, it's SAFER to make API calls through a backend
// (like a Vercel Serverless Function) that uses the key, rather than
// exposing the key directly to the browser, even via an env variable.
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;


// --- How to use Environment Variables with Vercel ---
// 1. Go to your Project Settings in Vercel.
// 2. Navigate to the "Environment Variables" section.
// 3. Add variables like `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_GEMINI_API_KEY`, etc.,
//    and paste your actual keys as the values.
// 4. Redeploy your project for the variables to take effect.
// 5. For local development, you can create a `.env.local` file in your
//    project's root and add the variables there (e.g., `NEXT_PUBLIC_FIREBASE_API_KEY=AIza...`).
//    (Ensure `.env.local` is in your `.gitignore` file!)


// --- Exports ---
export { firebaseConfig, GEMINI_API_KEY };

// --- Basic Validation (Optional, for developer feedback) ---
if (!firebaseConfig.apiKey) {
    console.error("Firebase API Key is MISSING. Ensure NEXT_PUBLIC_FIREBASE_API_KEY is set in your environment variables.");
} else {
    console.log("Firebase config loaded."); // Use console.log or warn for non-critical info
}

if (!GEMINI_API_KEY) {
    console.error("Gemini API Key is MISSING. Ensure NEXT_PUBLIC_GEMINI_API_KEY is set in your environment variables.");
} else {
    console.log("Gemini API Key loaded."); // Use console.log or warn for non-critical info
}

