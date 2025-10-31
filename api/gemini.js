// This is a Vercel Serverless Function (Node.js backend)
// It will run on Vercel's servers, not in the user's browser.

export default async function handler(request, response) {
  // 1. Get the GEMINI_API_KEY from Vercel's *private* Environment Variables
  const apiKey = process.env.GEMINI_API_KEY;
  
  // 2. Define the Google AI API endpoint
  // Note: The model "gemini-2.5-flash" was specified in your original code.
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  if (!apiKey) {
    return response.status(500).json({ error: { message: "API key not configured." } });
  }

  // 3. We only accept POST requests
  if (request.method !== 'POST') {
    return response.status(405).json({ error: { message: "Method not allowed." } });
  }

  try {
    // 4. Get the payload (prompts, history, etc.) from the client's request
    const clientPayload = request.body;

    // 5. Securely forward the request to the Google AI API
    const apiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientPayload), // Pass the client's payload
    });

    const responseData = await apiResponse.json();

    // 6. Handle errors from the Google AI API
    if (!apiResponse.ok) {
      console.error("Google AI API Error:", responseData);
      return response.status(apiResponse.status).json({
        error: {
          message: responseData.error?.message || "Failed to fetch from Google AI.",
          details: responseData
        }
      });
    }

    // 7. Send the successful response back to the client
    return response.status(200).json(responseData);

  } catch (error) {
    console.error("Internal server error:", error);
    return response.status(500).json({
      error: {
        message: "An internal server error occurred.",
        details: error.message
      }
    });
  }
}
