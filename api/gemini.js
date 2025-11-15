/**
 * Vercel Serverless Function: /api/gemini
 *
 * This is a simple proxy for the iasmaintor Quizzie module's
 * `generateAIFeedback` function.
 *
 * It takes the raw payload from the client (which is already
 * formatted for the Google AI API) and forwards it securely.
 */

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });

    // 1. Check for API key
    const { GEMINI_API_KEY } = process.env;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: { message: "Gemini API key not configured." } });
    }

    // 2. Get the raw payload from the client
    const geminiPayload = req.body;
    if (!geminiPayload || !geminiPayload.contents) {
        return res.status(400).json({ error: { message: "Missing or invalid 'contents' in request body." } });
    }

    const GOOGLE_API_URL = `httpsa://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    try {
        // 3. Forward the payload to Google
        const apiResponse = await fetch(GOOGLE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload), // Send the client's payload directly
        });

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

        // 4. Return the response to the client
        const responseData = await apiResponse.json();
        return res.status(200).json(responseData);

    } catch (error) {
        console.error("Server-side fetch error:", error);
        return res.status(500).json({ error: { message: `Internal server error: ${error.message}` } });
    }
}
