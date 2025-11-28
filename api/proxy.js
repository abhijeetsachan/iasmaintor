// api/proxy.js
// Secure Serverless Gateway for Google Gemini API
// Features: CORS Policy, Origin Verification, Mode Switching

export default async function handler(request, response) {
    // 1. CORS Headers (Allow browser access)
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') return response.status(200).end();
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    // 2. SECURITY: Origin Verification
    // Only allow requests from your own domains (localhost + production)
    const origin = request.headers.origin || request.headers.referer;
    const allowedDomains = [
        'https://iasmaintor.com',       // Production
        'https://www.iasmaintor.com',
        'http://localhost:3000',        // Local Dev
        'http://127.0.0.1:5500',        // VS Code Live Server
        'http://127.0.0.1:8080'         // Firebase Emulators
    ];

    // Check if origin is allowed (or if it's a Vercel preview URL)
    const isAllowed = origin && (
        allowedDomains.some(domain => origin.startsWith(domain)) || 
        origin.includes('.vercel.app')
    );

    if (!isAllowed) {
        console.warn(`Blocked unauthorized request from: ${origin}`);
        return response.status(403).json({ error: 'Forbidden: Unauthorized Origin' });
    }

    // 3. Check API Key
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        console.error("Server Error: GEMINI_API_KEY is missing.");
        return response.status(500).json({ error: 'Server configuration error.' });
    }

    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const { mode, payload, prompt, file } = request.body;
        let finalPayload;

        // 4. Construct Payload based on 'mode'
        if (mode === 'ocr') {
            // Image-to-Text Mode
            finalPayload = {
                contents: [{
                    role: "user",
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: file.mimeType, data: file.data } }
                    ]
                }]
            };
        } else if (mode === 'evaluate' || mode === 'generate') {
            // Standard Text/JSON Mode (Pass-through)
            finalPayload = payload;
        } else {
            return response.status(400).json({ error: 'Invalid mode specified. Use "ocr", "evaluate", or "generate".' });
        }

        // 5. Call Google Gemini API
        const geminiResponse = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalPayload),
        });

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error("Gemini API Upstream Error:", errorText);
            return response.status(geminiResponse.status).json({ error: "AI Service Error. Please try again." });
        }

        const data = await geminiResponse.json();
        return response.status(200).json(data);

    } catch (error) {
        console.error("Proxy Internal Error:", error);
        return response.status(500).json({ error: "Internal Server Error" });
    }
}
