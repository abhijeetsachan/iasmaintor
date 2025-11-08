/**
 * Vercel Serverless Function: /api/gemini
 *
 * ADVANCED handler for the Drona chatbot.
 * It dynamically selects a system prompt based on the user's queryType.
 *
 * It expects a JSON body with:
 * {
 * "contents": [...],
 * "queryType": "general" | "academic"
 * }
 */

// --- Drona's "Brains" ---

// Brain #1: The General Assistant
const generalPrompt = `You are Drona, a helpful and professional AI assistant for the iasmAIntor website. Your role is to handle general, conversational queries. Be friendly, concise, and professional. Do not use UPSC-specific jargon unless the user asks for it.`;

// Brain #2: The Academic Guru
const academicPrompt = `You are Drona, an expert UPSC mentor. Your personality is that of a master strategist and guide.

When a user asks an academic question, you MUST follow this framework:

1.  **Analyze Query:** First, silently determine if the question is for 'Prelims' (factual, objective) or 'Mains' (analytical, structured).

2.  **Provide Structured Response:**
    * **For MAINS questions:** Structure your answer clearly. Use sections like "Introduction," "Body," "Stakeholders," "Implications," "Way Forward," or "Conclusion." Use **bolding** for key terms and bullet points for lists.
    * **For PRELIMS questions:** Provide the key facts, dates, articles, or definitions clearly. Use bullet points for easy memorization.

3.  **Cite Syllabus (Mains):** When relevant for a Mains-style answer, briefly mention the GS Paper it relates to (e.g., "This topic is relevant for GS Paper 2: Governance.").

4.  **Formatting:** Always use Markdown for clear formatting (bold, lists).`;

// --- API Handler ---

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*'); // Or your specific domain
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }

    const { GEMINI_API_KEY } = process.env;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: { message: "API key not configured." } });
    }

    // *** THIS IS THE FIX ***
    // Using the standard 'gemini-pro' model
    const GOOGLE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const { contents, queryType } = req.body;

        if (!contents) {
            return res.status(400).json({ error: { message: "Missing 'contents' in request body." } });
        }

        // --- The "Switch": Choose the correct brain ---
        let systemInstructionText = "";
        if (queryType === 'general') {
            systemInstructionText = generalPrompt;
        } else {
            // Default to the expert academic prompt
            systemInstructionText = academicPrompt;
        }
        // --- End of Switch ---

        const geminiPayload = {
            contents: contents,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2000, // Increased token limit for detailed answers
                topP: 1,
                topK: 1,
            },
            // --- NEW: Use the powerful systemInstruction parameter ---
            systemInstruction: {
                parts: [{ text: systemInstructionText }]
            },
            // ---
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            ],
        };

        const response = await fetch(GOOGLE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload),
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error("Google AI API Error:", responseData);
            return res.status(response.status).json(responseData);
        }

        return res.status(200).json(responseData);

    } catch (error) {
        console.error("Server-side fetch error:", error);
        return res.status(500).json({ error: { message: `Internal server error: ${error.message}` } });
    }
}
