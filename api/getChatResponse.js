/**
 * Vercel Serverless Function: /api/getChatResponse
 *
 * This is the new CORE API for Drona. It features:
 * 1. A "dual-brain" for General vs. Academic queries.
 * 2. A cache-first logic using Firebase Realtime Database to save API calls.
 */

import admin from 'firebase-admin';

// --- Firebase Admin SDK Initialization ---
// We must check if it's already initialized, as Vercel can reuse instances.
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON)),
            databaseURL: process.env.FIREBASE_DB_URL,
        });
    } catch (error) {
        console.error('Firebase admin initialization error', error);
    }
}

const db = admin.database();
const cacheRef = db.ref('chatCache');

// --- Drona's "Brains" (System Prompts) ---

// Brain #1: The General Assistant
const generalPrompt = `You are Drona, a helpful and professional AI assistant for the iasmAIntor website. Your role is to handle general, conversational queries. Be friendly, concise, and professional.`;

// Brain #2: The Academic Guru
const academicPrompt = `You are Drona, an expert UPSC mentor. Your personality is that of a master strategist and guide.

When a user asks an academic question, you MUST follow this framework:

1.  **Analyze Query:** First, silently determine if the question is for 'Prelims' (factual, objective) or 'Mains' (analytical, structured).

2.  **Provide Structured Response:**
    * For **MAINS** questions: Provide a comprehensive, well-structured analysis. Use sections like "Introduction," "Key Provisions," "Impacts," "Challenges," and a "Way Forward" or "Conclusion."
    * For **PRELIMS** questions: Provide the key facts, dates, articles, or definitions clearly. Use bullet points for easy memorization.

3.  **Cite Evidence (Crucial):** Back up your points with real data, statistics, relevant Supreme Court judgments (e.g., *Kesavananda Bharati v. State of Kerala*), or committee recommendations (e.g., *Sarkaria Commission*).

4.  **Formatting:** Always use Markdown for clear formatting (**bolding** for key terms, bullet points for lists).`;


// --- Main API Handler ---
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });

    const { GEMINI_API_KEY } = process.env;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: { message: "API key not configured." } });

    const { contents, queryType } = req.body;
    if (!contents) return res.status(400).json({ error: { message: "Missing 'contents' in request body." } });

    const userQuery = contents[contents.length - 1].parts[0].text;

    // Create a simple, repeatable key for the database
    const queryKey = userQuery.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_');

    // --- 1. CACHE-FIRST LOGIC ---
    try {
        const snapshot = await cacheRef.child(queryKey).once('value');
        const cachedData = snapshot.val();

        if (cachedData && (Date.now() - cachedData.timestamp < 2592000000)) { // 30-day cache
            // CACHE HIT: Return the saved answer
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
    // --- END CACHE LOGIC ---


    // --- 2. CACHE MISS: CALL GEMINI API ---

    // --- The "Switch": Choose the correct brain ---
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

        const responseData = await apiResponse.json();
        if (!apiResponse.ok) throw (responseData);

        const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (generatedText) {
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
        console.error("Google AI API Error:", error);
        return res.status(error.status || 500).json(error);
    }
}
