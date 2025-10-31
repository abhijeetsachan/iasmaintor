// js/quizzie.js

// Import the new API endpoint
import { GEMINI_API_ENDPOINT } from './firebase-config.js';

// --- State Variables (Module Scope) ---
let quizQuestions = [];
let userAnswers = [];
let currentQuestionIndex = 0; // Keep track of the current question being viewed

// --- DOM Elements (Passed during init) ---
let DOMElements = {};
// REMOVED: let GEMINI_API_KEY = '';
// REMOVED: let API_URL = '';
let showNotification = () => {}; // Placeholder for notification function
let closeModal = () => {}; // Placeholder for closeModal function

// --- Initialization ---
// *** MODIFICATION: Removed apiKey and apiUrl from init. They are no longer passed from app.js ***
export function initQuizzie(elements, notifyFn, closeModalFn) {
    DOMElements = elements; // Store reference to quizzie modal elements
    // REMOVED: GEMINI_API_KEY = apiKey;
    // REMOVED: API_URL = apiUrl;
    showNotification = notifyFn; // Store reference to notification function
    closeModal = closeModalFn; // Store reference to close modal function

    // Add specific listeners for Quizzie
    DOMElements.form?.addEventListener('change', updateQuizzieForm);
    DOMElements.form?.addEventListener('submit', handleQuizSubmit);

    // Use event delegation for step buttons within the form
    DOMElements.form?.addEventListener('click', (e) => {
        const stepBtn = e.target.closest('.next-step-btn, .prev-step-btn');
        if (stepBtn) handleStepNavigation(stepBtn);
    });

     // Listener for retake button (added dynamically)
     DOMElements.activeView?.addEventListener('click', (e) => {
        if(e.target.closest('[data-action="retake-quiz"]')) {
            resetQuizzieModal();
        }
     });

     // Listener for quiz navigation (added dynamically)
     const quizFooter = document.getElementById('quiz-footer'); // Get footer reference
     if (quizFooter) {
         quizFooter.addEventListener('click', (e) => {
             if (e.target.id === 'next-q-btn') navigateQuiz('next');
             if (e.target.id === 'prev-q-btn') navigateQuiz('prev');
         });
     }
     
     // Listener for option changes within active view
     DOMElements.activeView?.addEventListener('change', (e) => {
        if (e.target.type === 'radio' && e.target.name === `q${currentQuestionIndex}`) {
            userAnswers[currentQuestionIndex] = parseInt(e.target.value);
        }
     });

    // Add listener for the close button
    DOMElements.closeButton?.addEventListener('click', () => {
        closeModal(DOMElements.modal);
    });

    console.log("Quizzie module initialized.");
}

// Export reset function to be called from app.js when clicking the feature card
export const resetQuizzieModal = () => {
    const { form, result, activeView, modal } = DOMElements;
    if (!form || !result || !activeView || !modal) return;
    form.reset();
    form.classList.remove('hidden');
    result.classList.add('hidden');
    activeView.classList.add('hidden');
    const quizFooter = document.getElementById('quiz-footer');
    if(quizFooter) quizFooter.classList.add('hidden');
    result.innerHTML = '';
    activeView.innerHTML = '';
    quizQuestions = [];
    userAnswers = [];
    currentQuestionIndex = 0; // Reset index
    // Reset to first step
    form.querySelectorAll('[data-step]').forEach((step, index) => {
        step.classList.toggle('active', index === 0);
    });

    // Show progress bar again
    const progressContainer = DOMElements.progressContainer; // Use cached ref
    if (progressContainer) progressContainer.classList.remove('hidden');

    updateQuizzieForm(); // Ensure form state is correct on reset
    updateQuizProgressBar(1, 4);
};

// --- Quizzie Functions ---

const updateQuizzieForm = () => {
    const { gsSectionalGroup, csatSectionalGroup, numQuestionsGroup, questionTypeGroup, form } = DOMElements;
    if (!gsSectionalGroup || !csatSectionalGroup || !numQuestionsGroup || !questionTypeGroup || !form) return;
    const formData = new FormData(form);
    const mainSubject = formData.get('main_subject');
    const testType = formData.get('test_type');

    // Hide all conditional groups first
    gsSectionalGroup.style.display = 'none';
    csatSectionalGroup.style.display = 'none';
    numQuestionsGroup.style.display = 'none';
    questionTypeGroup.style.display = 'none';

    // Show based on selections
    if (testType === 'sectional') {
        numQuestionsGroup.style.display = 'block';
        if (mainSubject === 'gs') {
            gsSectionalGroup.style.display = 'block';
            questionTypeGroup.style.display = 'block';
        } else if (mainSubject === 'csat') {
            csatSectionalGroup.style.display = 'block';
        }
    }
};

const updateQuizProgressBar = (current, total) => {
    const { progressIndicator, progressText } = DOMElements;
    if(!progressIndicator || !progressText) return;
    const percentage = Math.max(0, Math.min(100, (current / total) * 100));
    progressIndicator.style.width = `${percentage}%`;
    progressText.textContent = `Step ${current} of ${total}`;
};

const handleStepNavigation = (stepBtn) => {
    const modalForm = stepBtn.closest('form');
    if (!modalForm) return;
    const currentStep = stepBtn.closest('[data-step]');
    if (!currentStep) return;
    const currentStepNumber = parseInt(currentStep.dataset.step);

    let nextStepNumber = stepBtn.classList.contains('next-step-btn') ? currentStepNumber + 1 : currentStepNumber - 1;

    // Quizzie specific step skipping logic
    if (modalForm.id === 'quizzie-form') {
        if (stepBtn.classList.contains('next-step-btn') && currentStepNumber === 2) {
            const testType = new FormData(modalForm).get('test_type');
            if (testType === 'flt') nextStepNumber = 4;
        }
        if (stepBtn.classList.contains('prev-step-btn') && currentStepNumber === 4) {
             const testType = new FormData(modalForm).get('test_type');
            if (testType === 'flt') nextStepNumber = 2;
        }
    }

    const nextStep = modalForm.querySelector(`[data-step="${nextStepNumber}"]`);
    if (nextStep) {
        currentStep.classList.remove('active');
        nextStep.classList.add('active');
        updateQuizProgressBar(nextStepNumber, 4); // Update progress bar
    }
};

const generateQuizQuestions = async (params) => {
    // *** THIS FUNCTION IS MODIFIED ***
    try {
        const { main_subject, test_type, gs_subject, csat_subject, num_questions, difficulty, question_type } = params;
        const count = test_type === 'flt' ? 5 : parseInt(num_questions || '5');

        // 1. Define Prompts (same as before)
        const systemPrompt = `You are an expert quiz generator for the Indian Civil Services (UPSC) examination. Your task is to create high-quality Multiple Choice Questions (MCQs) based on the user's request. The questions should be in the style and standard of the UPSC Prelims exam.
- If the user selects 'basic' difficulty, generate straightforward, knowledge-based questions that test fundamental concepts.
- If the user selects 'advanced' difficulty, generate tricky, application-based, or multi-statement questions (e.g., "How many of the above statements are correct?") that require deeper analysis and are designed to be challenging.

IMPORTANT FORMATTING: For multi-statement questions, format the question string with newline characters (\\n) to separate the introductory sentence, each numbered statement, and the final question part. For example:
"Consider the following statements regarding the philosophical tenets of early Jainism and Buddhism:\\n1. Both religions rejected the authority of the Vedas and the efficacy of Vedic rituals.\\n2. Both maintained that the world is impermanent (Anitya) and devoid of a permanent self (Nairatmya or Anatta).\\n3. Jainism lays great emphasis on 'Anekantavada', while Buddhism proposes 'Kshanika Vada'.\\nHow many of the above statements are correct?"

For each question, provide a question (string), four options (array of strings), the correct answer (string, must exactly match one of the options), and a detailed explanation (string). Ensure the answer exactly matches one of the options provided. Return a valid JSON object matching this schema: {"questions": [{"question": "...", "options": ["...", "...", "...", "..."], "answer": "...", "explanation": "..."}]}.`;

        let userQuery = `Generate ${count} questions. Difficulty: ${difficulty || 'basic'}. `;
        if (test_type === 'flt') {
            userQuery += `This is a Full Length Test for ${main_subject === 'gs' ? 'General Studies' : 'CSAT'}. The questions should cover a mix of subjects relevant to this paper.`;
        } else { // Sectional
            const subject = main_subject === 'gs' ? gs_subject : csat_subject;
            userQuery += `This is a sectional test for the subject: ${subject || 'unknown'}. `;
            if (main_subject === 'gs') {
                userQuery += `The nature of questions should be: ${question_type || 'blend'}.`;
            }
        }
        
        // 2. Define Payload (this goes to *our* backend)
        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {}
        };

        console.log("Sending payload to backend:", JSON.stringify(payload, null, 2));

        // 3. Call *our* backend endpoint
        const response = await fetch(GEMINI_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

         if (!response.ok) {
             const errorBody = await response.json(); // Our backend sends JSON errors
             console.error("Backend API Error:", errorBody);
             let errorMsg = errorBody.error?.message || `API request failed with status ${response.status}`;
             // Check for specific model-not-found error again
             if (errorMsg.includes("is not found for API version v1beta")) {
                 errorMsg = `API Error: The model 'gemini-2.5-flash' is not available. ${errorMsg}`;
             }
             throw new Error(errorMsg);
         }

        const result = await response.json();
        console.log("Full API Response from backend:", result);

        // 4. The rest of the parsing logic is the same
        if (!result.candidates || result.candidates.length === 0) {
             const blockReason = result.promptFeedback?.blockReason;
             const safetyRatings = result.promptFeedback?.safetyRatings;
             let errorMessage = "No content generated by AI.";
             if (blockReason) {
                 errorMessage = `No content generated due to safety block: ${blockReason}.`;
                 console.error("Safety Ratings:", safetyRatings);
             } else {
                 errorMessage = "No candidates returned from API. Model may have refused or an internal error occurred.";
             }
             throw new Error(errorMessage);
        }

        const candidate = result.candidates[0];
        if (candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
             console.warn(`AI response finish reason: ${candidate.finishReason}. Safety Ratings:`, JSON.stringify(candidate.safetyRatings || 'N/A'));
        }

        const jsonText = candidate.content?.parts?.[0]?.text;
        if (!jsonText) {
             console.error("AI response finished but content text is missing.", candidate);
             throw new Error(`AI response finished but content is empty. Finish Reason: ${candidate.finishReason || 'Unknown'}.`);
        }

        try {
            const cleanedJsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
            const parsedJson = JSON.parse(cleanedJsonText);
            const questions = parsedJson.questions || [];
            if (!Array.isArray(questions)) { throw new Error("Invalid format: 'questions' should be an array."); }
            if (questions.length === 0) { console.warn("AI generated valid JSON but with an empty questions array."); }

            const validQuestions = questions.filter(q => q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length === 4 && typeof q.answer === 'string' && typeof q.explanation === 'string' && q.options.includes(q.answer));
            if (validQuestions.length !== questions.length) { 
                console.warn("Some generated questions had invalid structure or incorrect answer reference and were filtered out."); 
                questions.forEach((q, index) => { if (!validQuestions.includes(q)) console.warn(`Invalid Q ${index}:`, q); });
            }

            const finalQuestions = validQuestions.slice(0, count);
            return finalQuestions.map(q => ({
                ...q,
                subject: gs_subject || csat_subject || 'general',
                answerIndex: q.options.indexOf(q.answer)
            }));
        } catch (parseError) {
            console.error("Failed to parse JSON response from AI:", parseError);
            console.error("Invalid JSON string received:", jsonText);
            throw new Error("Failed to parse AI response. The model did not return valid JSON.");
        }
    } catch (error) {
        console.error("Error in generateQuizQuestions:", error);
        throw new Error(`Could not generate quiz questions: ${error.message}`);
    }
};

const generateAIFeedback = async (correctCount, incorrectCount, unansweredCount, totalQuestions, wrongQuestions) => {
    // *** THIS FUNCTION IS MODIFIED ***
    
    // 1. Define Prompts (same as before)
    const systemPrompt = `You are an expert mentor for the UPSC Civil Services Exam. Your task is to provide a concise, insightful, and encouraging analysis of a student's quiz performance. Your analysis should be in a single paragraph. Focus on constructive feedback.`;
    const MAX_WRONG_TO_SEND = 5;
    const wrongQuestionsSample = wrongQuestions.slice(0, MAX_WRONG_TO_SEND).map(wq => ({
         question: wq.question.substring(0, 150) + (wq.question.length > 150 ? '...' : ''),
         subject: wq.subject,
         correctAnswer: wq.correctAnswer
     }));
     
    let userQuery = `A student has just completed a quiz. Here is their performance summary:
- Total Questions: ${totalQuestions}
- Correct Answers: ${correctCount}
- Incorrect Answers: ${incorrectCount}
- Unanswered: ${unansweredCount}

Here is a sample of questions the student answered incorrectly (up to ${MAX_WRONG_TO_SEND}):
${JSON.stringify(wrongQuestionsSample, null, 2)}

Based ONLY on this data, provide a concise, insightful, and encouraging analysis (max 100 words, single paragraph). Address:
1. Overall assessment (e.g., "Good effort," "Solid understanding," "Needs more focus").
2. Potential patterns in mistakes (mentioning subject areas like 'Polity' or 'History' IF identifiable from the sample, otherwise suggest general review).
3. Specific, actionable improvement suggestions (e.g., 'Revisiting NCERT chapters,' 'Focusing on PYQs').
4. Maintain a supportive tone. Do not simply list the wrong questions.`;

    // 2. Define Payload (this goes to *our* backend)
    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {}
    };

    try {
        // 3. Call *our* backend endpoint
        const response = await fetch(GEMINI_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) { 
            console.error("AI Feedback API Error:", await response.json());
            throw new Error(`API request failed with status ${response.status}`); 
        }

        // 4. The rest of the parsing logic is the same
        const result = await response.json();
        const candidate = result.candidates?.[0];
        if (!candidate || (candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS')) {
             console.warn("Feedback generation issue:", candidate?.finishReason);
             return "Could not generate feedback analysis at this time.";
        }
        const feedbackText = candidate.content?.parts?.[0]?.text;
        if (!feedbackText) { 
            console.warn("Feedback generation finished but content is empty.");
            return "Could not generate feedback analysis at this time."; 
        }
        return feedbackText.replace(/```/g, '').trim();
    } catch(error) {
        console.error("AI Feedback generation failed:", error);
        return "Could not generate AI feedback due to a network or API issue.";
    }
};

const displayQuiz = () => {
    const { activeView } = DOMElements;
    if (!activeView) return;
    const footer = document.getElementById('quiz-footer');
    if (!footer) return;
    currentQuestionIndex = 0; // Start at the first question

    renderQuestion(); // Render the first question

    // Show the footer
    footer.classList.remove('hidden');
    updateFooterButtons(); // Ensure buttons are in correct initial state
};

function renderQuestion() {
     const { activeView } = DOMElements;
     if (!activeView) return;
     const footer = document.getElementById('quiz-footer');

    if (quizQuestions.length === 0) {
        activeView.innerHTML = `<div class="p-4 text-center text-red-600 bg-red-50 rounded">No questions were generated.</div> <div class="mt-6 flex justify-end"><button data-action="retake-quiz" class="bg-slate-200 text-slate-800 px-6 py-2 rounded-lg font-semibold">Start Over</button></div>`;
        if(footer) footer.classList.add('hidden');
        return;
    }
    if (currentQuestionIndex < 0 || currentQuestionIndex >= quizQuestions.length) {
        console.error("Invalid question index:", currentQuestionIndex);
        return;
    }
    const q = quizQuestions[currentQuestionIndex];
    if (!q || !Array.isArray(q.options)) { 
        console.error("Invalid question data at index:", currentQuestionIndex, q);
        activeView.innerHTML = `<div class="p-4 text-center text-red-600 bg-red-50 rounded">Error displaying question ${currentQuestionIndex + 1}.</div>`;
        updateFooterButtons();
        return;
    }

    let optionsHTML = q.options.map((opt, index) => `
        <label>
            <input type="radio" name="q${currentQuestionIndex}" value="${index}" class="hidden" ${userAnswers[currentQuestionIndex] == index ? 'checked' : ''}>
            <div class="p-4 border-2 border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer radio-card">
                <span class="text-slate-700">${opt}</span>
            </div>
        </label>
    `).join('');

    activeView.innerHTML = `
        <div class="quiz-question active">
            <div class="mb-4 text-sm text-slate-500 font-semibold">Question ${currentQuestionIndex + 1} of ${quizQuestions.length}</div>
            <p class="mb-6 text-slate-800 text-lg whitespace-pre-wrap text-left">${q.question.replace(/\\n/g, '\n')}</p>
            <div class="space-y-3 radio-card-group">${optionsHTML}</div>
        </div>
    `;
    updateFooterButtons();
}

function updateFooterButtons() {
    const prevBtn = document.getElementById('prev-q-btn');
    const nextBtn = document.getElementById('next-q-btn');
    if (!prevBtn || !nextBtn) return;
    prevBtn.disabled = currentQuestionIndex === 0;
    prevBtn.classList.toggle('opacity-50', currentQuestionIndex === 0);
    prevBtn.classList.toggle('cursor-not-allowed', currentQuestionIndex === 0);
    nextBtn.textContent = currentQuestionIndex === quizQuestions.length - 1 ? 'Submit Quiz' : 'Next';
}


function navigateQuiz(direction) {
    const { activeView } = DOMElements;
    if (!activeView) return;
    // Save current answer before navigating
    const selectedOption = activeView.querySelector(`input[name="q${currentQuestionIndex}"]:checked`);
    userAnswers[currentQuestionIndex] = selectedOption ? parseInt(selectedOption.value) : undefined;

    if (direction === 'next') {
        if (currentQuestionIndex < quizQuestions.length - 1) {
            currentQuestionIndex++;
            renderQuestion();
        } else {
            // At last question, button says "Submit", so calculate results
            calculateAndShowResults();
        }
    } else if (direction === 'prev') {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            renderQuestion();
        }
    }
}

const calculateAndShowResults = async () => {
    const { activeView, modal } = DOMElements;
    if (!activeView || !modal) return;
    const quizFooter = document.getElementById('quiz-footer');
    if(quizFooter) quizFooter.classList.add('hidden');
    const progressContainer = DOMElements.progressContainer;
    if(progressContainer) progressContainer.classList.add('hidden');

    let score = 0, correctCount = 0, incorrectCount = 0, unansweredCount = 0;
    const wrongQuestions = [];
    quizQuestions.forEach((q, index) => {
         const userAnswerIndex = userAnswers[index];
         if (userAnswerIndex === undefined || userAnswerIndex === null) {
             unansweredCount++;
         } else if (userAnswerIndex === q.answerIndex) {
             correctCount++;
             score += 2;
         } else {
             incorrectCount++;
             score -= 0.66;
             wrongQuestions.push({
                question: q.question,
                yourAnswer: q.options[userAnswerIndex],
                correctAnswer: q.answer,
                explanation: q.explanation,
                subject: q.subject || 'general'
             });
         }
     });
     score = Math.max(0, parseFloat(score.toFixed(2))); // Round score and ensure non-negative

    let resultHTML = `
        <div class="text-center"> <h3 class="text-3xl font-bold text-slate-800">Quiz Results</h3> </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
            <div class="bg-blue-50 p-4 rounded-lg text-center"> <div class="text-sm text-blue-700 font-semibold">SCORE</div> <div class="text-3xl font-bold text-blue-900">${score} / ${quizQuestions.length * 2}</div> </div>
            <div class="bg-green-50 p-4 rounded-lg text-center"> <div class="text-sm text-green-700 font-semibold">CORRECT</div> <div class="text-3xl font-bold text-green-900">${correctCount}</div> </div>
            <div class="bg-red-50 p-4 rounded-lg text-center"> <div class="text-sm text-red-700 font-semibold">INCORRECT</div> <div class="text-3xl font-bold text-red-900">${incorrectCount}</div> </div>
            ${unansweredCount > 0 ? `<div class="bg-slate-50 p-4 rounded-lg text-center sm:col-span-3"> <div class="text-sm text-slate-700 font-semibold">UNANSWERED</div> <div class="text-3xl font-bold text-slate-900">${unansweredCount}</div> </div>` : ''}
        </div>
        <div id="ai-feedback-container" class="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 rounded-r-lg">
            <h4 class="font-bold mb-1">AI-Powered Feedback & Analysis</h4>
            <div id="ai-feedback-content"> <div class="font-semibold flex items-center"> <span>Analyzing your performance</span> <span class="pulsing-dots ml-1"><span>.</span><span>.</span><span>.</span></span> </div> </div>
        </div>
        <h3 class="text-xl font-bold mt-8 mb-4">Review Your Answers</h3>
    `;
    resultHTML += quizQuestions.map((q, index) => {
         const userAnswerIndex = userAnswers[index];
         const optionsReview = q.options.map((opt, optIndex) => {
             let classes = 'p-3 border rounded-lg flex items-center text-left text-sm';
             let icon = '';
             if(optIndex === q.answerIndex) {
                 classes += ' option-correct';
                 icon = `<i class="fas fa-check-circle text-green-500 mr-2 text-base"></i>`;
             } else if (userAnswerIndex === optIndex && userAnswerIndex !== q.answerIndex) {
                 classes += ' option-incorrect';
                 icon = `<i class="fas fa-times-circle text-red-500 mr-2 text-base"></i>`;
             } else {
                  classes += ' border-slate-200 bg-white';
                  icon = `<i class="far fa-circle text-slate-300 mr-2 text-base"></i>`;
              }
             return `<div class="${classes}">${icon}<span>${opt}</span></div>`;
         }).join('');
         return `
             <div class="mb-6 border-b pb-6">
                 <p class="font-semibold mb-3 text-slate-800 whitespace-pre-wrap">Q ${index + 1}: ${q.question.replace(/\\n/g, '\n')}</p>
                 <div class="space-y-2">${optionsReview}</div>
                 <div class="mt-3 p-3 bg-slate-100 rounded-lg text-sm text-slate-700 whitespace-pre-wrap"> <p><strong>Explanation:</strong> ${q.explanation.replace(/\\n/g, '\n')}</p> </div>
             </div>`;
    }).join('');
    resultHTML += `<div class="mt-8 flex justify-end items-center"><button data-action="retake-quiz" class="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold">Take Another Quiz</button></div>`;
    activeView.innerHTML = resultHTML;

    // Fetch and display AI feedback
    const aiFeedbackContainer = activeView.querySelector('#ai-feedback-content');
     if (aiFeedbackContainer) {
         try {
             const feedback = await generateAIFeedback(correctCount, incorrectCount, unansweredCount, quizQuestions.length, wrongQuestions);
             aiFeedbackContainer.innerHTML = `<p>${feedback}</p>`;
         } catch (error) {
             console.error("Failed to get AI feedback:", error);
             aiFeedbackContainer.innerHTML = `<p>Could not generate AI feedback.</p>`;
         }
     }
};

const handleQuizSubmit = async (e) => {
    e.preventDefault();
    const { form, activeView, modal } = DOMElements;
    if (!form || !activeView || !modal) return;
    const progressContainer = DOMElements.progressContainer;
    if (progressContainer) progressContainer.classList.add('hidden');

    form.classList.add('hidden');
    activeView.classList.remove('hidden');
    
    // *** UPDATED LOADING ANIMATION ***
    activeView.innerHTML = `
        <div class="p-4 bg-blue-50 rounded-lg text-center">
            <div class="loader-bars" aria-label="Loading AI response">
                <div class="bar"></div>
                <div class="bar"></div>
                <div class="bar"></div>
                <div class="bar"></div>
                <div class="bar"></div>
            </div>
            <p class="font-semibold text-slate-700 mt-4">Generating Questions with AI...</p>
        </div>
    `;

    try {
        const formData = new FormData(form);
        const params = Object.fromEntries(formData.entries());
        quizQuestions = await generateQuizQuestions(params);
        userAnswers = new Array(quizQuestions.length);

        if (quizQuestions.length > 0) {
            displayQuiz();
        } else {
            activeView.innerHTML = `<div class="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg"> <h4 class="font-bold text-yellow-800">No Questions Generated</h4> <p class="text-yellow-700 mt-2">The AI could not generate questions for this specific combination. Please try different options.</p> <button data-action="retake-quiz" class="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold">Start Over</button> </div>`;
        }
    } catch (error) {
        console.error("Quiz generation failed:", error);
        activeView.innerHTML = `<div class="text-center p-4 bg-red-50 border border-red-200 rounded-lg"> <h4 class="font-bold text-red-800">Quiz Generation Failed</h4> <p class="text-red-700 mt-2">${error.message || 'An unknown error occurred.'}</p> <p class="text-sm text-slate-500 mt-4">This can happen due to network issues, API errors, or safety filters. Please check the console and try again.</p> <button data-action="retake-quiz" class="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold">Start Over</button> </div>`;
         const quizFooter = document.getElementById('quiz-footer');
         if(quizFooter) quizFooter.classList.add('hidden');
    }
};
