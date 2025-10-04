import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the AI client with the API key from Vercel's Environment Variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  
  try {
    const { level, commitment, hours, optional } = req.body;

    // A detailed prompt for Gemini to generate a high-quality, well-formatted plan
    const prompt = `
      You are an expert mentor for the Indian UPSC Civil Services Exam. Your task is to generate a personalized, actionable 7-day study plan.

      **Aspirant's Details:**
      - Preparation Level: ${level}
      - Commitment: ${commitment} (${hours} hours per day)
      - Optional Subject: ${optional}

      **Instructions:**
      1.  **Generate a Main Strategy:** Create a concise, motivational paragraph outlining the primary focus for the week based on their level (e.g., NCERTs for beginners, answer writing for veterans).
      2.  **Generate a 7-Day Table:** Create a detailed daily schedule for 7 days.
      3.  **Format as HTML:** The entire output MUST be a single block of HTML code.
          - The main strategy paragraph should be a <p> tag with the classes: "mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-800 rounded-r-lg".
          - The schedule should be an HTML <table> with the class "w-full text-sm text-left border-collapse".
          - The table header (thead) should have a background class of "bg-slate-100".
          - All table cells (th, td) must have the classes "p-2 border border-slate-200".
          - Daily tasks within a cell should be a <ul> with the class "list-disc list-inside".
      4.  **Content:** The plan should be realistic for the given hours. Integrate GS subjects, the optional subject, current affairs (newspaper), and revision. Be specific (e.g., instead of "GS Subject", suggest "Modern History: Arrival of Europeans").
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const planHtml = response.text();
    
    // Send the generated HTML back to the client
    return res.status(200).send(planHtml);

  } catch (error) {
    console.error("Error generating plan:", error);
    return res.status(500).json({ error: "Failed to generate study plan. Please try again." });
  }
}
