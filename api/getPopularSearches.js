/**
 * Vercel Serverless Function: /api/getPopularSearches
 *
 * Fetches trending topics related to UPSC CSE using the
 * Google Custom Search JSON API.
 *
 * Requires 2 Environment Variables:
 * 1. GOOGLE_SEARCH_API_KEY - Your Google API key with Custom Search enabled.
 * 2. GOOGLE_CX_ID - Your Google Custom Search Engine ID, configured to search the web.
 */

export default async function handler(req, res) {
    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*'); // Or your specific domain
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const { GOOGLE_SEARCH_API_KEY, GOOGLE_CX_ID } = process.env;

    if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_CX_ID) {
        console.error("Missing Google Search API Key or CX ID");
        return res.status(500).json({ error: "API configuration error on server." });
    }

    const searchQuery = "trending topics UPSC CSE OR popular UPSC current affairs";
    const numResults = 5;
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_CX_ID}&q=${encodeURIComponent(searchQuery)}&num=${numResults}`;

    try {
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) {
            const errorData = await searchResponse.json();
            console.error("Google Search API error:", errorData);
            throw new Error(`Google Search API failed with status ${searchResponse.status}`);
        }

        const data = await searchResponse.json();

        if (!data.items || data.items.length === 0) {
            return res.status(200).json({ searches: [] });
        }

        // Clean up the titles (e.g., remove site names)
        const topics = data.items.map(item => {
            return item.title.split(' | ')[0].split(' - ')[0].trim();
        });

        return res.status(200).json({ searches: topics });

    } catch (error) {
        console.error("Error in getPopularSearches:", error.message);
        return res.status(500).json({ error: "Failed to fetch popular topics." });
    }
}
