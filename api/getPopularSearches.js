/**
 * Vercel Serverless Function: /api/getPopularSearches
 *
 * This function now performs two steps:
 * 1. Fetches recent editorials from UPSC sites using Google Search.
 * 2. Uses the Gemini API to intelligently extract the *core topics* from those headlines.
 */

// We need the Gemini API key for this function now
const { GOOGLE_SEARCH_API_KEY, GOOGLE_CX_ID, GEMINI_API_KEY } = process.env;

// --- Helper function to call Gemini ---
async function callGemini(prompt) {
    const GOOGLE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 500 }
    };

    const response = await fetch(GOOGLE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

// --- Main API Handler ---
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: `Method ${req.method} Not Allowed` });

    if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_CX_ID || !GEMINI_API_KEY) {
        console.error("Missing one or more API keys (Search, CX, or Gemini)");
        return res.status(500).json({ error: "API configuration error on server." });
    }
    
    const searchQuery = "UPSC editorial OR UPSC explainer OR PIB";
    const numResults = 5;
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_CX_ID}&q=${encodeURIComponent(searchQuery)}&num=${numResults}&sort=date`;

    try {
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) throw new Error('Google Search API failed');
        
        const data = await searchResponse.json();
        if (!data.items || data.items.length === 0) throw new Error('No articles found');

        const headlines = data.items.map(item => item.title);

        // --- 2. AI-Powered Topic Extraction ---
        const extractionPrompt = `
            You are a UPSC expert. Read the following list of recent news headlines. For each headline, extract the core, searchable UPSC topic.
            Be very concise. Format the output as a simple list.

            Example Headlines:
            - "A wider SIR has momentum but it is still a test case | The Hindu"
            - "PIB Press Release: Cabinet Approves Gaganyaan Mission"
            - "Explained: What is the new Contempt of Court ruling?"

            Your Output should be:
            - Special Intensive Revision (SIR)
            - Gaganyaan Mission
            - Contempt of Court Act
            
            Now, process these headlines:
            ${headlines.join('\n')}
        `;

        const topicsString = await callGemini(extractionPrompt);
        if (!topicsString) throw new Error('AI topic extraction failed');

        // Clean the AI's output into an array
        const uniqueTopics = [...new Set(
            topicsString.split('\n')
                .map(t => t.replace(/^- /, '').trim()) // Remove list dash
                .filter(t => t.length > 5) // Filter out empty lines
        )];

        return res.status(200).json({ searches: uniqueTopics });

    } catch (error) {
        console.error("Error in getPopularSearches:", error.message);
        // Fallback for a complete crash
        const defaultTopics = [
            "Explain the basics of the Indian Constitution",
            "What is the role of the RBI Monetary Policy?",
            "Latest Supreme Court judgments"
        ];
        return res.status(200).json({ searches: defaultTopics });
    }
}
