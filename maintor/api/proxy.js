// This is a serverless function that will run on Vercel's backend.
// It is written in Node.js.

export default async function handler(request, response) {
    // 1. Check if the request method is POST.
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    // 2. Get the secret API key from environment variables.
    // This key is stored securely on the server, not in the code.
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return response.status(500).json({ error: 'API key is not configured on the server.' });
    }

    // 3. Define the actual Google Gemini API endpoint.
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const { mode, payload, prompt, file } = request.body;
        let finalPayload;

        // 4. Construct the correct payload based on the 'mode' sent from the frontend.
        if (mode === 'ocr') {
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
            finalPayload = payload;
        } else {
            return response.status(400).json({ error: 'Invalid mode specified.' });
        }

        // 5. Make the secure, server-to-server call to the Gemini API.
        const geminiResponse = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(finalPayload),
        });

        // 6. Check if the call to Google was successful.
        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error("Gemini API Error:", errorText);
            return response.status(geminiResponse.status).json({ error: `Gemini API failed: ${errorText}` });
        }

        // 7. Get the JSON data from Google and send it back to our frontend.
        const data = await geminiResponse.json();
        return response.status(200).json(data);

    } catch (error) {
        console.error("Proxy Error:", error);
        return response.status(500).json({ error: error.message });
    }
}
