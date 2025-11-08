/**
 * Vercel Serverless Function: /api/getPopularSearches
 *
 * Fetches trending topics related to UPSC CSE using the
 * Google Custom Search JSON API.
 *
 * THIS VERSION ASSUMES THE GOOGLE_CX_ID HAS BEEN CONFIGURED TO
 * SEARCH *ONLY* SPECIFIC SITES (The Hindu, Indian Express, PIB).
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

    // *** UPDATED SEARCH QUERY ***
    // This query is now sent to your *curated* list of sites.
    // It prioritizes "Explainer" and "Editorial" articles.
    const searchQuery = "UPSC editorial OR UPSC explainer OR PIB";
    const numResults = 5;
    
    // We add 'sort=date' to get the most recent articles
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_CX_ID}&q=${encodeURIComponent(searchQuery)}&num=${numResults}&sort=date`;

    try {
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) {
            const errorData = await searchResponse.json();
            console.error("Google Search API error:", errorData);
            throw new Error(`Google Search API failed with status ${searchResponse.status}`);
        }

        const data = await searchResponse.json();

        if (!data.items || data.items.length === 0) {
            // If no results, send a default list so it's not empty
            const defaultTopics = [
                "Explain the basics of the Indian Constitution",
                "What is the role of the RBI Monetary Policy?",
                "Latest Supreme Court judgments"
            ];
            return res.status(200).json({ searches: defaultTopics });
        }

        // Clean up the titles (e.g., remove site names and "Explainer:")
        const topics = data.items.map(item => {
            return item.title
                .split(' | ')[0] // Remove source (e.g., | The Indian Express)
                .split(' - ')[0] // Remove source (e.g., - The Hindu)
                .replace(/^Explainer: /i, '') // Remove "Explainer: "
                .replace(/^Explained: /i, '') // Remove "Explained: "
                .replace(/^Editorial: /i, '') // Remove "Editorial: "
                .trim(); // Remove any whitespace
        });
        
        // Remove potential duplicates
        const uniqueTopics = [...new Set(topics)];

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
