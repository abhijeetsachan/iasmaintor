// js/quizzie.js (Refactored for Scalability & Security)

// Import the new API endpoint (Points to /api/proxy based on config)
import { GEMINI_API_ENDPOINT } from './firebase-config.js';

// Endpoint for fetching quiz questions (Node.js backend)
const GET_QUIZ_ENDPOINT = '/api/getQuizQuestions';

// --- State Variables (Module Scope) ---
let quizQuestions = [];
let userAnswers = [];
let currentQuestionIndex = 0; // Keep track of the current question being viewed

// --- DOM Elements (Passed during init) ---
let DOMElements = {};
let showNotification = () => {}; // Placeholder for notification function
let closeModal = () => {}; // Placeholder for closeModal function

// --- Firebase & User State ---
// firebaseDB will hold { db, doc, collection, writeBatch, serverTimestamp, etc. }
let firebaseDB = {}; 
let getCurrentUser = () => null; // Will hold the function from app.js

// --- Initialization ---
export function initQuizzie(elements, notifyFn, closeModalFn, dbContext, userFn) {
    DOMElements = elements;
    showNotification = notifyFn;
    closeModal = closeModalFn;
    
    // Store Firebase Context (includes db instance + SDK functions)
    firebaseDB = dbContext;
    getCurrentUser = userFn;

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
     const quizFooter = document.getElementById('quiz-footer');
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

    console.log("Quizzie module initialized with Scalable Database access.");
}

// Export reset function to be called from app.js
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
    currentQuestionIndex = 0;
    
    // Reset to first step
    form.querySelectorAll('[data-step]').forEach((step, index) => {
        step.classList.toggle('active', index === 0);
    });

    // Show progress bar again
    const progressContainer = DOMElements.progressContainer;
    if (progressContainer) progressContainer.classList.remove('hidden');

    updateQuizzieForm();
    updateQuizProgressBar(1, 4);
};

// --- Quizzie Functions ---

const updateQuizzieForm = () => {
    const { gsSectionalGroup, csatSectionalGroup, numQuestionsGroup, questionTypeGroup, form } = DOMElements;
    if (!gsSectionalGroup || !csatSectionalGroup || !numQuestionsGroup || !questionTypeGroup || !form) return;
    
    const formData = new FormData(form);
    const mainSubject = formData.get('main_subject');
    const testType = formData.get('test_type');
    
    gsSectionalGroup.style.display = 'none';
    csatSectionalGroup.style.display = 'none';
    numQuestionsGroup.style.display = 'none';
    questionTypeGroup.style.display = 'none';
    
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
    
    if (modalForm.id === 'quizzie-form') {
        // Logic to skip steps if needed (e.g. if test type changes)
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
        updateQuizProgressBar(nextStepNumber, 4);
    }
};

// --- SCALABLE DATABASE WRITE ---
/**
 * Saves the IDs of questions seen to the user's `history` sub-collection.
 * Using a sub-collection prevents the 1MB document limit issue.
 * @param {string[]} questionIds - Array of question document IDs.
 */
const updateUserSeenQuestions = async (questionIds) => {
    const user = getCurrentUser();
    // Ensure we have the user, the DB instance, and the necessary SDK functions
    if (!user || !firebaseDB.db || !firebaseDB.writeBatch) {
        console.warn("User, DB, or writeBatch missing. Cannot update seen list.");
        return;
    }
    
    if (questionIds.length === 0) return;

    try {
        const { db, doc, collection, writeBatch, serverTimestamp } = firebaseDB;
        
        // Initialize Batch
        const batch = writeBatch(db);
        const historyRef = collection(db, 'users', user.uid, 'history');

        questionIds.forEach(qId => {
            // Use the Question ID as the Document ID for automatic deduplication
            const docRef = doc(historyRef, qId); 
            batch.set(docRef, { seenAt: serverTimestamp() });
        });

        // Commit the batch
        await batch.commit();
        console.log(`Updated seen questions (history sub-collection) for user ${user.uid}.`);

    } catch (error) {
        console.error("Error updating user's seen questions:", error);
        showNotification("Failed to save quiz progress.", true);
    }
};

// --- AI FEEDBACK (SECURE PROXY) ---
const generateAIFeedback = async (correctCount, incorrectCount, unansweredCount, totalQuestions, wrongQuestions) => {
    
    // 1. Define Prompts
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
1. Overall assessment.
2. Potential patterns in mistakes.
3. Specific, actionable improvement suggestions.
4. Maintain a supportive tone.`;

    // 2. Define Payload (Standard Gemini Structure)
    const geminiPayload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {}
    };

    try {
        // 3. Call Secure Proxy (api/proxy.js)
        // WE MUST WRAP THE PAYLOAD with 'mode' for the proxy
        const response = await fetch(GEMINI_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'generate', // Tells proxy to just pass this to Gemini
                payload: geminiPayload
            })
        });

        if (!response.ok) {
            let errorMessage = `Request failed (${response.status})`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorMessage;
            } catch (e) { /* ignore parse error */ }
            throw new Error(errorMessage);
        }

        // 4. Parse Response
        const result = await response.json();
        const candidate = result.candidates?.[0];
        if (!candidate) {
             console.warn("Feedback generation issue: No candidate returned.");
             return "Could not generate feedback analysis at this time.";
        }
        const feedbackText = candidate.content?.parts?.[0]?.text;
        if (!feedbackText) { 
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
    
    footer.classList.remove('hidden');
    updateFooterButtons(); 
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
    
    // Theme-aware styling for options
    let optionsHTML = q.options.map((opt, index) => `
        <label>
            <input type="radio" name="q${currentQuestionIndex}" value="${index}" class="hidden" ${userAnswers[currentQuestionIndex] == index ? 'checked' : ''}>
            <div class="p-4 border-2 rounded-lg cursor-pointer radio-card">
                <span>${opt}</span>
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
            // At last question, button says "Submit"
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
    const seenQuestionIds = [];

    quizQuestions.forEach((q, index) => {
         if (q.id) {
            seenQuestionIds.push(q.id);
         }

         const userAnswerIndex = userAnswers[index];
         const correctAnswerIndex = q.options.findIndex(opt => opt === q.answer);

         if (userAnswerIndex === undefined || userAnswerIndex === null) {
             unansweredCount++;
         } else if (userAnswerIndex === correctAnswerIndex) {
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
     score = Math.max(0, parseFloat(score.toFixed(2)));

    // --- ASYNC SAVE TO HISTORY (SCALABLE) ---
    updateUserSeenQuestions(seenQuestionIds).catch(err => {
        console.error("Failed to update seen questions in background:", err);
    });

    // Render Results HTML
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
         const correctAnswerIndex = q.options.findIndex(opt => opt === q.answer);

         const optionsReview = q.options.map((opt, optIndex) => {
             let classes = 'p-3 border rounded-lg flex items-center text-left text-sm';
             let icon = '';
             if(optIndex === correctAnswerIndex) {
                 classes += ' option-correct';
                 icon = `<i class="fas fa-check-circle text-green-500 mr-2 text-base"></i>`;
             } else if (userAnswerIndex === optIndex && userAnswerIndex !== correctAnswerIndex) {
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
                 <div class="mt-3 p-3 bg-slate-100 rounded-lg text-sm text-slate-700 whitespace-pre-wrap"> <p><strong>Explanation:</strong> ${q.explanation.replace(/\\n/g, '\n')}</p></div>
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
    
    // Loading State
    activeView.innerHTML = `
        <div class="p-4 rounded-lg text-center quiz-loading-box">
            <div class="loader-bars" aria-label="Loading AI response">
                <div class="bar"></div> <div class="bar"></div> <div class="bar"></div> <div class="bar"></div> <div class="bar"></div>
            </div>
            <p class="font-semibold mt-4">Finding the best questions for you...</p>
        </div>
    `;

    const user = getCurrentUser();
    if (!user) {
        showNotification("Authentication error. Please log in again.", true);
        resetQuizzieModal();
        closeModal(DOMElements.modal);
        return;
    }

    try {
        // 1. Get auth token
        const token = await user.getIdToken(true);
        
        // 2. Get form parameters
        const formData = new FormData(form);
        const params = Object.fromEntries(formData.entries());

        // 3. Call backend endpoint (api/getQuizQuestions.js)
        // Note: This endpoint handles checking seen questions from the new history sub-collection
        const response = await fetch(GET_QUIZ_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            let errorMessage = `Request failed (${response.status})`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorMessage;
            } catch (e) {
                const errorText = await response.text();
                errorMessage = errorText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        const { questions } = await response.json();
        
        // Store questions
        quizQuestions = questions.map(q => ({
            ...q,
            answerIndex: q.options.findIndex(opt => opt === q.answer)
        }));
        userAnswers = new Array(quizQuestions.length);

        if (quizQuestions.length > 0) {
            displayQuiz();
        } else {
            activeView.innerHTML = `<div class="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg"> <h4 class="font-bold text-yellow-800">No Questions Found</h4> <p class="text-yellow-700 mt-2">We couldn't find any unseen questions for this combination. Please try different options or try again later as we add new questions.</p> <button data-action="retake-quiz" class="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold">Start Over</button> </div>`;
        }
    } catch (error) {
        console.error("Quiz generation failed:", error);
        activeView.innerHTML = `<div class="text-center p-4 bg-red-50 border border-red-200 rounded-lg"> <h4 class="font-bold text-red-800">Quiz Generation Failed</h4> <p class="text-red-700 mt-2">${error.message || 'An unknown error occurred.'}</p> <p class="text-sm text-slate-500 mt-4">This can happen due to network issues, API errors, or if we're out of new questions for this topic. Please try again.</p> <button data-action="retake-quiz" class="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold">Start Over</button> </div>`;
         const quizFooter = document.getElementById('quiz-footer');
         if(quizFooter) quizFooter.classList.add('hidden');
    }
};
