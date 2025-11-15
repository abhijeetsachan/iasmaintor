/**
 * Vercel Serverless Function: /api/getChatResponse
 *
 * This is the new CORE API for Drona. It features:
 * 1. A "dual-brain" for General vs. Academic queries.
 * 2. A cache-first logic using Firebase Realtime Database to save API calls.
 * 3. Robust checks for environment variables.
 */

import admin from 'firebase-admin';

// --- Drona's "Brains" (System Prompts) ---
const generalPrompt = `You are Drona, a helpful and professional AI assistant for the iasmAIntor website. Your role is to handle general, conversational queries. Be friendly, concise, and professional.`;

// *** THIS IS THE FIX: A new, stricter formatting rule has been added ***
const academicPrompt = `You are Drona, an expert UPSC mentor. Your personality is that of a master strategist and guide.

**Your internal thought process (DO NOT display this):**
1.  First, analyze the user's query to determine if it is for 'Prelims' (factual, objective) or 'Mains' (analytical, structured).
2.  This analysis is for your understanding ONLY and should NEVER be mentioned in your response.

**Your Response Framework (This is what you MUST output):**
* **For MAINS questions:** Immediately begin your response. Provide a comprehensive, well-structured analysis. Use sections like "Introduction," "Key Provisions," "Impacts," "Challenges," and a "Way Forward" or "Conclusion."
* **For PRELIMS questions:** Immediately begin your response. Provide the key facts, dates, articles, or definitions clearly. Use bullet points for easy memorization.
* **Cite Evidence (Crucial):** Back up your points with real data, statistics, relevant Supreme Court judgments (e.g., *Kesavananda Bharati v. State of Kerala*), or committee recommendations (e.g., *Sarkaria Commission*).
* **Formatting:** Always use Markdown for clear formatting (**bolding** for key terms, bullet points for lists).
* **Crucial Formatting Rule:** DO NOT wrap your list items or headings in single asterisks (\`*...*\`). For example, send \`**Introduction:**\` not \`* **Introduction:**...*\`. Send \`* My Bullet\` not \`* * My Bullet*\`.
* **NEVER** start your response with "Analyze Query:" or "This is a Mains-style question." Just give the structured answer directly.`;


// --- Firebase Admin SDK Initialization ---
let db;
let cacheRef;
try {
    // Check if all required Firebase variables are present
    if (process.env.FIREBASE_ADMIN_SDK_JSON && process.env.FIREBASE_DB_URL) {
        if (!admin.apps.length) {
            
            admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON)),
    databaseURL: process.env.FIREBASE_DB_URL,
});
        }
        db = admin.database();
        cacheRef = db.ref('chatCache');
    } else {
        console.warn("Firebase Admin environment variables not set. Cache will be disabled.");
    }
} catch (error) {
    console.error('Firebase admin initialization error', error);
    // If init fails, db and cacheRef will be undefined, and the cache logic will be skipped.
}


// --- Main API Handler ---
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });

    // *** NEW: Check for all required variables ***
    const { GEMINI_API_KEY, FIREBASE_ADMIN_SDK_JSON, FIREBASE_DB_URL } = process.env;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: { message: "Gemini API key not configured." } });
    
    // Check if Firebase is configured. If not, we can still proceed, but caching will be skipped.
    const isCacheEnabled = admin.apps.length > 0 && db && cacheRef;
    if (!isCacheEnabled) {
        console.warn("Firebase not initialized. Proceeding without cache.");
    }

    const { contents, queryType } = req.body;
    if (!contents) return res.status(400).json({ error: { message: "Missing 'contents' in request body." } });

    const userQuery = contents[contents.length - 1].parts[0].text;
    const queryKey = userQuery.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_');

    // --- 1. CACHE-FIRST LOGIC ---
    if (isCacheEnabled) {
        try {
            const snapshot = await cacheRef.child(queryKey).once('value');
            const cachedData = snapshot.val();

            if (cachedData && (Date.now() - cachedData.timestamp < 2592000000)) { // 30-day cache
                return res.status(200).json({
                    candidates: [{
                        content: {
                            parts: [{ text: cachedData.answer }],
                            role: "model"
                        }
                    }],
                    fromCache: true
                });
            }
        } catch (dbError) {
            console.error("Database read error:", dbError);
            // Don't stop; just proceed to fetch from API
        }
    }
    // --- END CACHE LOGIC ---

    // --- 2. CACHE MISS: CALL GEMINI API ---
    let systemInstructionText = (queryType === 'general') ? generalPrompt : academicPrompt;
    const GOOGLE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const geminiPayload = {
        contents: contents,
        systemInstruction: { parts: [{ text: systemInstructionText }] },
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
            topP: 1,
            topK: 1,
        },
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        ],
    };

    try {
        const apiResponse = await fetch(GOOGLE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload),
        });

        // *** ROBUST ERROR HANDLING ***
        if (!apiResponse.ok) {
            let errorData;
            try {
                errorData = await apiResponse.json();
            } catch (e) {
                errorData = { error: { message: `API Error: ${apiResponse.statusText}` } };
            }
            console.error("Google AI API Error:", errorData);
            return res.status(apiResponse.status).json(errorData);
        }

        const responseData = await apiResponse.json();
        const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (generatedText && isCacheEnabled) {
            // --- 3. SAVE TO CACHE ---
            try {
                await cacheRef.child(queryKey).set({
                    answer: generatedText,
                    timestamp: Date.now(),
                    query: userQuery
                });
            } catch (dbError) {
                console.error("Database write error:", dbError);
                // Don't fail the request; just log the error
            }
            // --- END SAVE ---
        }

        // 4. Return the new response to the user
        return res.status(200).json(responseData);

    } catch (error) {
        console.error("Server-side fetch error:", error);
        return res.status(500).json({ error: { message: `Internal server error: ${error.message}` } });
    }
}
