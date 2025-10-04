import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Securely access the API key from environment variables
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  try {
    const { level, commitment, hours, optional } = req.body;

    const prompt = `
      You are an expert mentor for the UPSC Civil Services Exam in India.
      Create a personalized, actionable 7-day study plan for an aspirant with the following details:
      - Preparation Level: ${level}
      - Daily Commitment: ${commitment}
      - Available Study Hours Per Day: ${hours}
      - Optional Subject: ${optional}

      The output MUST be a valid JSON object. Do not include any text before or after the JSON object.
      The JSON object should have two keys: "focus" (a string with a short, key strategic tip)
      and "schedule" (an array of 7 objects, where each object has keys for "day" (number), "subjectFocus" (string), and "dailyTasks" which is an array of strings).
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Clean up the response to ensure it's valid JSON
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();

    res.status(200).json(JSON.parse(jsonString));
  } catch (error) {
    console.error("Error calling AI API:", error);
    res.status(500).json({ error: "Failed to generate AI plan." });
  }
}
