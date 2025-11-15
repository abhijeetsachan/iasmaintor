/**
 * Vercel Serverless Function: /api/getPopularSearches
 *
 * This function now features a 6-HOUR CACHE using Firebase Realtime Database.
 *
 * 1. Fetches recent editorials from specific UPSC sites (Hindu, IE, TOI, PIB).
 * 2. Uses the Gemini API to intelligently extract the *core topics* as a JSON array.
 * 3. Caches the results in Firebase for 6 hours.
 */

// ### THE FIX: Use modern, modular Firebase Admin imports ###
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
// ### END FIX ###

// --- Firebase Admin SDK Initialization ---
// (We need this to read/write from the cache)
let db;
let cacheRef;
try {
    // ### THE FIX: Check only for the SDK JSON.
    if (process.env.FIREBASE_ADMIN_SDK_JSON) {
        // Use modular getApps() and initializeApp()
        if (!getApps().length) {
            // Initialize *without* the databaseURL to avoid service conflicts.
            initializeApp({
                credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON))
            });
        }
        db = getDatabase(); // Initialize Realtime Database
        cacheRef = db.ref('popularTopicsCache');
        // ### END FIX ###
    } else {
        console.warn("Firebase Admin environment variables (FIREBASE_ADMIN_SDK_JSON) are not set. DB features will be disabled.");
    }
} catch (error) {
    console.error('Firebase admin initialization error', error);
    // If init fails, db and cacheRef will be undefined, and the cache logic will be skipped.
}

// --- Cache Duration: 6 Hours ---
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000;

// --- Default topics if all else fails ---
const defaultTopics = [
    "Explain the basics of the Indian Constitution",
    "What is the role of the RBI Monetary Policy?",
    "Latest Supreme Court judgments"
];

// --- Main API Handler ---
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: `Method ${req.method} Not Allowed` });

    const { GOOGLE_SEARCH_API_KEY, GOOGLE_CX_ID, GEMINI_API_KEY } = process.env;

    if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_CX_ID || !GEMINI_API_KEY) {
        console.error("Missing one or more API keys (Search, CX, or Gemini)");
        return res.status(500).json({ error: "API configuration error on server." });
    }

    // --- 1. CHECK CACHE ---
    let staleData = null;
    const isCacheEnabled = getApps().length > 0 && db && cacheRef;

    if (isCacheEnabled) {
        try {
            const snapshot = await cacheRef.once('value');
            if (snapshot.exists()) {
                const data = snapshot.val();
                staleData = data.topics; // Store as fallback
                const isCacheValid = (Date.now() - data.timestamp) < CACHE_DURATION_MS;
                
                if (isCacheValid) {
                    // CACHE HIT: Return cached data
                    return res.status(200).json({ searches: data.topics });
                }
            }
        } catch (dbError) {
            console.error("Error reading from Firebase cache:", dbError.message);
            // Don't fail, just proceed to fetch
        }
    } else if (process.env.FIREBASE_ADMIN_SDK_JSON) {
        // This condition means the env var exists, but init failed. Log it.
        console.error("Firebase cache is disabled. Check server logs for an init error.");
    }

    // --- 2. CACHE MISS or STALE: Fetch New Topics ---
    try {
        // Precise query targeting the sites you requested
        const searchQuery = `(UPSC OR editorial OR explained) (site:thehindu.com/opinion OR site:indianexpress.com/section/explained OR site:indianexpress.com/section/opinion OR site:timesofindia.indiatimes.com/blogs OR site:pib.gov.in)`;
        const numResults = 5;
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_CX_ID}&q=${encodeURIComponent(searchQuery)}&num=${numResults}&sort=date`;

        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) throw new Error(`Google Search API failed (${searchResponse.status})`);
        
        const data = await searchResponse.json();
        if (!data.items || data.items.length === 0) throw new Error('No articles found');

        const headlines = data.items.map(item => item.title);

        // --- 3. AI-Powered Topic Extraction ---
        const extractionPrompt = `
            You are a UPSC expert. Read the following list of recent news headlines. For each headline, extract the core, searchable UPSC topic.
            Be very concise.
            
            Return ONLY a valid JSON object in the format: {"topics": ["Topic 1", "Topic 2", "Topic 3"]}
            
            Do not include any other text, preambles, or markdown.
            
            Headlines:
            ${headlines.join('\n')}
        `;

        const GOOGLE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const geminiPayload = {
            contents: [{ parts: [{ text: extractionPrompt }] }],
            generationConfig: { 
                temperature: 0.2, 
                maxOutputTokens: 500,
                responseMimeType: "application/json" // <-- This enforces JSON output
            }
        };

        const geminiResponse = await fetch(GOOGLE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload),
        });

        if (!geminiResponse.ok) {
            console.error("Gemini API call failed:", await geminiResponse.text());
            throw new Error("Gemini API call failed");
        }

        const geminiData = await geminiResponse.json();
        const topicsString = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!topicsString) throw new Error('AI topic extraction returned no text');

        let parsedData;
        try {
            parsedData = JSON.parse(topicsString);
        } catch (e) {
            console.error("Failed to parse AI JSON response:", topicsString);
            throw new Error("AI returned invalid JSON.");
        }
        
        const topics = parsedData.topics;
        if (!Array.isArray(topics)) {
             throw new Error("AI JSON response did not contain a 'topics' array.");
        }

        const uniqueTopics = [...new Set(
            topics
                .map(t => String(t).trim()) // Ensure it's a string and trim
                .filter(t => t.length > 3 && t.length < 75) // A more reasonable filter
        )];

        if (uniqueTopics.length === 0) throw new Error("AI produced no valid topics");

        // --- 4. SAVE TO CACHE & RESPOND ---
        if (isCacheEnabled) {
            try {
                await cacheRef.set({
                    topics: uniqueTopics,
                    timestamp: Date.now()
                });
            } catch (dbError) {
                console.error("Error saving to Firebase cache:", dbError.message);
                // Don't fail, just log the error
            }
        }

        return res.status(200).json({ searches: uniqueTopics });

    } catch (error) {
        console.error("Error fetching new popular searches:", error.message);
        
        // --- FALLBACK LOGIC ---
        if (staleData) {
            // If fetch fails, return the old data (graceful failure)
            return res.status(200).json({ searches: staleData });
        } else {
            // If there's no stale data and fetch fails, return defaults
            return res.status(200).json({ searches: defaultTopics });
        }
    }
}
