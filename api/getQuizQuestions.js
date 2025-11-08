// api/getQuizQuestions.js
// This is a Vercel Serverless Function (Node.js)

// --- Firebase Admin: For secure backend database access ---
// We use firebase-admin on the backend, not the client SDK
import admin from 'firebase-admin';

// --- Google AI: For generating new questions ---
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Initialize Firebase Admin ---
// Vercel environment variables will be used here
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // Vercel can't handle newlines in env variables, so we must format the key
  privateKey: process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined,
};

// Initialize app only if it's not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// --- Initialize Google AI (Gemini) ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash', // Use your desired model
});

// --- Main Handler ---
export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: { message: 'Method not allowed.' } });
  }

  let userId;
  try {
    // 1. Authenticate the user
    const token = request.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return response.status(401).json({ error: { message: 'Unauthorized: No token provided.' } });
    }
    const decodedToken = await admin.auth().verifyIdToken(token);
    userId = decodedToken.uid;
  } catch (error) {
    console.error("Auth verification error:", error);
    return response.status(401).json({ error: { message: 'Unauthorized: Invalid token.' } });
  }

  try {
    // 2. Get Quiz Parameters from client
    const params = request.body;
    const requestedCount = parseInt(params.num_questions || '5', 10);
    const subject = getSubject(params);
    const difficulty = params.difficulty || 'basic';
    const type = params.question_type || 'blend'; // 'static', 'current', 'blend'

    // 3. Get User's Seen Questions
    const seenQuestionIds = await getUserSeenQuestions(userId);

    // 4. Find Questions in Database
    // This is the corrected code for api/getQuizQuestions.js

    // 1. Start building the query
    let dbQuery = db.collection('quizzieQuestionBank')
      .where('subject', '==', subject)
      .where('difficulty', '==', difficulty);

    // 2. Conditionally add the 'type' filter
    if (type !== 'blend') {
      dbQuery = dbQuery.where('type', '==', type);
    }

    // 3. Add the limit at the end
    dbQuery = dbQuery.limit(30);
          
    // --- FIX: MODIFIED LOGIC ---
    const snapshot = await dbQuery.get();
    
    // --- MANUAL FILTERING to avoid 'not-in' 10-item limit ---
    const seenIdsSet = new Set(seenQuestionIds);
    let dbQuestions = [];
    snapshot.forEach(doc => {
      if (!seenIdsSet.has(doc.id) && dbQuestions.length < requestedCount) {
        dbQuestions.push({ id: doc.id, ...doc.data() });
      }
    });
    // --- END MANUAL FILTERING ---

    let finalQuestions = dbQuestions;
    const newQuestionIdsToSave = []; // IDs of newly generated questions

    // 5. Check if we need to generate new questions
    const neededCount = requestedCount - finalQuestions.length;

    if (neededCount > 0) {
      // We need more questions! Call the AI.
      console.log(`DB had ${finalQuestions.length}, generating ${neededCount} new questions...`);
      try {
        const newQuestions = await generateNewQuestions(neededCount, subject, difficulty, type);
        
        // Save new questions to the bank *and* get their new IDs
        const batch = db.batch();
        const newQuestionsWithIds = [];

        newQuestions.forEach(q => {
          const newDocRef = db.collection('quizzieQuestionBank').doc(); // Auto-generate ID
          // Add tags for filtering
          const questionData = {
            ...q,
            subject: subject,
            difficulty: difficulty,
            type: type,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          };
          batch.set(newDocRef, questionData);
          
          newQuestionsWithIds.push({ id: newDocRef.id, ...questionData });
          newQuestionIdsToSave.push(newDocRef.id);
        });

        await batch.commit(); // Save new questions to the bank
        console.log(`Saved ${newQuestionsWithIds.length} new questions to bank.`);
        finalQuestions = [...finalQuestions, ...newQuestionsWithIds];

      } catch (genError) {
        console.error("Failed to generate or save new questions:", genError);
        // We might fail to generate, but we can still return what we found
        if (finalQuestions.length === 0) {
          throw new Error(`Failed to get any questions. AI Error: ${genError.message}`);
        }
        // else, we'll just return the few we found in the DB
      }
    } // <-- *** THIS IS THE MISSING BRACE THAT WAS ADDED ***

    // 6. Asynchronously update user's 'seen' list (don't make user wait)
    const allSeenIds = finalQuestions.map(q => q.id);
    if (allSeenIds.length > 0) {
      updateUserSeenQuestions(userId, allSeenIds).catch(err => {
        console.error("CRITICAL: Failed to update user's seen questions:", err);
      });
    }

    // 7. Return the final list of questions
    return response.status(200).json({ questions: finalQuestions });

  } catch (error) {
    console.error("Error in getQuizQuestions handler:", error);
    return response.status(500).json({
      error: {
        message: "An internal server error occurred.",
        details: error.message
      }
    });
  }
}

// --- Helper Functions ---

/**
 * Gets the list of question IDs the user has already seen.
 */
async function getUserSeenQuestions(userId) {
  try {
    const docRef = db.doc(`users/${userId}/quizData/seen`);
    const doc = await docRef.get();
    if (doc.exists) {
      return doc.data().seenQuestionIds || [];
    }
    return [];
  } catch (error) {
    console.error("Error getting user seen questions:", error);
    return []; // Return empty on error
  }
}

/**
 * (Async) Updates the user's seen questions list in Firestore.
 */
async function updateUserSeenQuestions(userId, questionIds) {
  if (questionIds.length === 0) return;
  const docRef = db.doc(`users/${userId}/quizData/seen`);
  await docRef.set({
    seenQuestionIds: admin.firestore.FieldValue.arrayUnion(...questionIds)
  }, { merge: true });
}

/**
 * Maps the client's form parameters to a single 'subject' tag.
 */
function getSubject(params) {
  if (params.main_subject === 'csat') {
    return `csat-${params.csat_subject || 'general'}`;
  }
  // Default to GS
  return params.gs_subject || 'general'; // e.g., 'history', 'polity'
}

/**
* Calls Gemini to generate new questions.
*/
async function generateNewQuestions(count, subject, difficulty, type) {
  const systemPrompt = `You are an expert quiz generator for the Indian Civil Services (UPSC) examination. Your task is to create high-quality Multiple Choice Questions (MCQs) based on the user's request. The questions should be in the style and standard of the UPSC Prelims exam.
- If the user selects 'basic' difficulty, generate straightforward, knowledge-based questions that test fundamental concepts.
- If the user selects 'advanced' difficulty, generate tricky, application-based, or multi-statement questions (e.g., "How many of the above statements are correct?") that require deeper analysis and are designed to be challenging.

IMPORTANT FORMATTING: For multi-statement questions, format the question string with newline characters (\\n) to separate the introductory sentence, each numbered statement, and the final question part. For example:
"Consider the following statements regarding the philosophical tenets of early Jainism and Buddhism:\\n1. Both religions rejected the authority of the Vedas and the efficacy of Vedic rituals.\\n2. Both maintained that the world is impermanent (Anitya) and devoid of a permanent self (Nairatmya or Anatta).\\n3. Jainism lays great emphasis on 'Anekantavada', while Buddhism proposes 'Kshanika Vada'.\\nHow many of the above statements are correct?"

For each question, provide a question (string), four options (array of strings), the correct answer (string, must exactly match one of the options), and a detailed explanation (string). Ensure the answer exactly matches one of the options provided. Return ONLY a valid JSON object matching this schema: {"questions": [{"question": "...", "options": ["...", "...", "...", "..."], "answer": "...", "explanation": "..."}]}.`;

  let userQuery = `Generate ${count} questions.
- Subject: ${subject}
- Difficulty: ${difficulty}
- Question Type: ${type}`;

  try {
    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: userQuery }] }],
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: 'application/json', // Ask for JSON output
        temperature: 0.8,
      }
    });

    const response = result.response;
    const jsonText = response.text();
    
    if (!jsonText) {
      console.warn("Gemini response was empty.", response.promptFeedback);
      throw new Error("AI returned no content. Check safety ratings.");
    }
    
    const parsedJson = JSON.parse(jsonText);
    const questions = parsedJson.questions || [];
    
    if (!Array.isArray(questions)) {
      throw new Error("Invalid JSON format: 'questions' was not an array.");
    }

    // Validate questions
    const validQuestions = questions.filter(q => 
      q && 
      typeof q.question === 'string' && 
      Array.isArray(q.options) && 
      q.options.length === 4 && 
      typeof q.answer === 'string' && 
      typeof q.explanation === 'string' &&
      q.options.includes(q.answer)
    );

    if (validQuestions.length === 0) {
      console.warn("AI generated JSON but no valid questions.", parsedJson);
      throw new Error("AI generated invalid questions.");
    }

    return validQuestions;

  } catch (error) {
    console.error("Error during Gemini call:", error);
    throw new Error(`AI generation failed: ${error.message}`);
  }
}
// <-- The extra brace at the end of the original file has been removed.
