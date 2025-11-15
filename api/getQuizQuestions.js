// api/getQuizQuestions.js

// ### Use modern, modular Firebase Admin imports ###
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
// ### END FIX ###

import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Initialize Firebase Admin ---
let db;
try {
    // Only check for the SDK JSON.
    if (process.env.FIREBASE_ADMIN_SDK_JSON) {
        // ### Use modular getApps() and initializeApp() ###
        if (!getApps().length) {
            // Initialize *without* the databaseURL to avoid service conflicts.
            initializeApp({
                credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON))
            });
        }
        db = getFirestore(); // Initialize Firestore
        // ### END FIX ###
    } else {
        console.warn("Firebase Admin environment variables (FIREBASE_ADMIN_SDK_JSON) are not set. DB features will be disabled.");
    }
} catch (error) {
    // This will now catch any JSON parsing or init errors
    console.error('Firebase admin initialization error', error);
}

// --- Initialize Google AI (Gemini) ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
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
    
    // ### Use modular getAuth() ###
    const decodedToken = await getAuth().verifyIdToken(token);
    userId = decodedToken.uid;
  } catch (error) {
    console.error("Auth verification error:", error);
    // This error is often a symptom of the init block failing
    return response.status(401).json({ error: { message: 'Unauthorized: Invalid token. Check server logs for init error.' } });
  }

  if (!db) {
    console.error("Firestore (db) is not initialized. Check server logs for init errors.");
    return response.status(500).json({ error: { message: "Database service is not configured on the server." } });
  }

  try { 
    // 2. Get Quiz Parameters from client
    const params = request.body;
    const requestedCount = parseInt(params.num_questions || '5', 10);
    const subject = getSubject(params);
    const difficulty = params.difficulty || 'basic';
    const type = params.question_type || 'blend';

    // 3. Get User's Seen Questions
    const seenQuestionIds = await getUserSeenQuestions(userId);

    // 4. Find Questions in Database
    let dbQuery = db.collection('quizzieQuestionBank')
      .where('subject', '==', subject)
      .where('difficulty', '==', difficulty);

    if (type !== 'blend') {
      dbQuery = dbQuery.where('type', '==', type);
    }
    dbQuery = dbQuery.limit(30);
          
    const snapshot = await dbQuery.get();
    
    // ### THIS IS THE FIX ###
    // Initialize seenIdsSet using the 'seenQuestionIds' variable
    const seenIdsSet = new Set(seenQuestionIds);
    // ### END FIX ###

    let dbQuestions = [];
    snapshot.forEach(doc => {
      if (!seenIdsSet.has(doc.id) && dbQuestions.length < requestedCount) {
        dbQuestions.push({ id: doc.id, ...doc.data() });
      }
    });

    let finalQuestions = dbQuestions;
    const neededCount = requestedCount - finalQuestions.length;

    if (neededCount > 0) {
      console.log(`DB had ${finalQuestions.length}, generating ${neededCount} new questions...`);
      try {
        const newQuestions = await generateNewQuestions(neededCount, subject, difficulty, type);
        
        const batch = db.batch();
        const newQuestionsWithIds = [];

        newQuestions.forEach(q => {
          const newDocRef = db.collection('quizzieQuestionBank').doc(); // Auto-generate ID
          const questionData = {
            ...q,
            subject: subject,
            difficulty: difficulty,
            type: type,
            // ### Use modular FieldValue ###
            createdAt: FieldValue.serverTimestamp()
          };
          batch.set(newDocRef, questionData);
          newQuestionsWithIds.push({ id: newDocRef.id, ...questionData });
        });

        await batch.commit();
        console.log(`Saved ${newQuestionsWithIds.length} new questions to bank.`);
        finalQuestions = [...finalQuestions, ...newQuestionsWithIds];

      } catch (genError) {
        console.error("Failed to generate or save new questions:", genError);
        if (finalQuestions.length === 0) {
          throw new Error(`Failed to get any questions. AI Error: ${genError.message}`);
        }
      }
    }

    // 6. Asynchronously update user's 'seen' list
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
    return [];
  }
}

async function updateUserSeenQuestions(userId, questionIds) {
  if (questionIds.length === 0) return;
  const docRef = db.doc(`users/${userId}/quizData/seen`);
  // ### Use modular FieldValue ###
  await docRef.set({
    seenQuestionIds: FieldValue.arrayUnion(...questionIds)
  }, { merge: true });
}

function getSubject(params) {
  if (params.main_subject === 'csat') {
    return `csat-${params.csat_subject || 'general'}`;
  }
  return params.gs_subject || 'general';
}

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
        responseMimeType: 'application/json',
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
