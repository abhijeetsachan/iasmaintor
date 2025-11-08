// js/chatbot.js (FIXED & RENAMED)

// Import the new API endpoint, NOT the key
import { GEMINI_API_ENDPOINT } from './firebase-config.js';

// --- Module State ---
let DOMElements = {};
let conversationHistory = [];
let isChatbotInitialized = false;
let isChatOpen = false;
let greetingTimeout;
let notify; // To store the showNotification function

// UPDATED: Greetings for "Drona"
const GREETINGS = [
    "Greetings. I am Drona, your AI mentor. How may I assist in your preparation today?",
    "Hello. I am Drona. What strategic questions about your preparation do you have?",
    "I am Drona, your guide for the Civil Services Exam. Please ask your questions.",
    "Greetings, aspirant. I am Drona, here to help you navigate your UPSC journey."
];

// *** NEW: Word limit for showing "Read More" ***
const READ_MORE_WORD_LIMIT = 60;

// --- Core Functions ---

/**
 * Initializes the chatbot, finds DOM elements, and sets up listeners.
 * @param {function} showNotification - The app's global notification function.
 */
export function initChatbot(showNotification) {
    if (isChatbotInitialized) return;

    DOMElements = {
        toggleButton: document.getElementById('chatbot-toggle'),
        greetingBubble: document.getElementById('chatbot-greeting-bubble'),
        window: document.getElementById('chatbot-window'),
        closeButton: document.getElementById('chatbot-close'),
        messages: document.getElementById('chatbot-messages'),
        form: document.getElementById('chatbot-form'),
        input: document.getElementById('chatbot-input')
    };

    notify = showNotification; // Store the notification function

    if (!DOMElements.toggleButton || !DOMElements.window || !DOMElements.form) {
        console.error("Chatbot DOM elements not found. Aborting init.");
        return;
    }

    // --- Setup Listeners ---
    DOMElements.toggleButton.addEventListener('click', toggleChatWindow);
    DOMElements.closeButton.addEventListener('click', () => toggleChatWindow(false));
    DOMElements.form.addEventListener('submit', handleUserMessage);

    // --- UPDATED: System Prompt ---
    conversationHistory.push({
        role: "system",
        parts: [{ text: "You are Drona, a wise and authoritative AI mentor for the iasmAIntor website, named after the legendary teacher. Your personality is that of a master strategist and guide. You are here to help UPSC aspirants with deep questions about the exam, study strategies, and complex topics. Your answers should be precise, insightful, and professional. Keep your answers concise but thorough." }]
    });

    // --- Show Initial Greeting ---
    showGreetingBubble();
    
    isChatbotInitialized = true;
    console.log("Chatbot 'Drona' initialized."); // UPDATED
}

/**
 * Shows the random greeting bubble next to the icon.
 */
function showGreetingBubble() {
    if (!DOMElements.greetingBubble) return;
    
    // Pick a random greeting
    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    DOMElements.greetingBubble.textContent = greeting;
    DOMElements.greetingBubble.classList.remove('hidden');

    // Hide the bubble after 8 seconds
    greetingTimeout = setTimeout(() => {
        DOMElements.greetingBubble.classList.add('hidden');
    }, 8000);
}

/**
 * Toggles the chat window open or closed.
 * @param {boolean} [forceOpen] - Force a specific state.
 */
function toggleChatWindow(forceOpen = null) {
    isChatOpen = (forceOpen !== null) ? forceOpen : !isChatOpen;
    
    if (isChatOpen) {
        DOMElements.window.classList.remove('hidden');
        // Hide greeting bubble if it's open
        if (greetingTimeout) clearTimeout(greetingTimeout);
        DOMElements.greetingBubble.classList.add('hidden');
        
        // Add the first AI message if it's not there
        if (DOMElements.messages.children.length === 0) {
            addMessage('ai', GREETINGS[0]); // Add a default greeting to chat
        }
        DOMElements.input.focus();
    } else {
        DOMElements.window.classList.add('hidden');
    }
}

/**
 * Handles the user submitting a message.
 * @param {Event} e - The form submit event.
 */
async function handleUserMessage(e) {
    e.preventDefault();
    const userText = DOMElements.input.value.trim();
    if (!userText) return;

    // Add user's message to UI
    addMessage('user', userText);
    DOMElements.input.value = '';
    
    // Add to history
    conversationHistory.push({
        role: "user",
        parts: [{ text: userText }]
    });

    // Show typing indicator
    showTypingIndicator(true);

    try {
        // *** MODIFICATION: Call our backend, not Google ***
        const aiResponse = await callGeminiAPI(userText);
        
        // Add to history
        conversationHistory.push({
            role: "model",
            parts: [{ text: aiResponse }]
        });
        
        // Add AI response to UI
        showTypingIndicator(false); // Hide typing
        addMessage('ai', aiResponse);

    } catch (error) {
        console.error("Chatbot API error:", error);
        showTypingIndicator(false);

        // --- UPDATED ERROR HANDLING (Removed "Meow") ---
        let friendlyErrorMessage = "My apologies, I have encountered an error. Please try rephrasing your question.";
        
        if (error.message.includes('RECITATION')) {
            friendlyErrorMessage = "My response was blocked for recitation. Please ask in a different way.";
        } else if (error.message.includes('blocked:')) {
            friendlyErrorMessage = "I am sorry, I cannot answer that. My safety filters were triggered.";
        } else if (error.message.includes('API key')) {
             friendlyErrorMessage = "There appears to be an issue with my configuration. Please alert the site admin!";
        } else if (error.message.includes('API request failed')) {
             friendlyErrorMessage = "I am having trouble connecting. Please try again in a moment.";
        }
        
        addMessage('ai', friendlyErrorMessage);
        // --- END UPDATED ERROR HANDLING ---
        
        if(notify) notify("Chatbot error: ".concat(error.message), true); // The developer still sees the full error
    }
}

/**
 * Adds a message bubble to the chat window.
 * @param {'user' | 'ai'} sender - Who sent the message.
 * @param {string} text - The message content.
 */
function addMessage(sender, text) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', sender);
    
    const bubble = document.createElement('div');
    bubble.classList.add('chat-bubble');
    // Basic markdown for bold
    bubble.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    
    messageElement.appendChild(bubble);
    DOMElements.messages.appendChild(messageElement); // <-- Add to DOM first
    
    // --- "READ MORE" LOGIC (MODIFIED) ---
    if (sender === 'ai') {
        const wordCount = text.split(/\s+/).length;

        // If the message is SHORT, just expand it by default and do nothing else.
        if (wordCount <= READ_MORE_WORD_LIMIT) {
            bubble.classList.add('expanded');
        } else {
            // If the message is LONG, check if it *actually* overflows before adding the button.
            requestAnimationFrame(() => {
                const isOverflowing = (bubble.scrollHeight - bubble.clientHeight) > 1;
            
                if (isOverflowing) {
                    // It's long AND overflowing, so add the button.
                    const readMoreBtn = document.createElement('div');
                    readMoreBtn.className = 'read-more-btn';
                    readMoreBtn.innerHTML = '<span>Read More...</span>';
                    
                    readMoreBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        bubble.classList.add('expanded');
                        readMoreBtn.remove();
                        DOMElements.messages.scrollTop = DOMElements.messages.scrollHeight;
                    });
                    
                    bubble.appendChild(readMoreBtn);
                } else {
                    // It's a long message, but the container is wide enough.
                    // We MUST add 'expanded' otherwise it will be cut off by the default max-height.
                    bubble.classList.add('expanded');
                }
            });
        }
    }
    // --- END "READ MORE" LOGIC ---
    
    // Scroll to bottom
    DOMElements.messages.scrollTop = DOMElements.messages.scrollHeight;
}


/**
 * Shows or hides the typing indicator.
 * @param {boolean} show - Whether to show or hide.
 */
function showTypingIndicator(show) {
    let typingEl = DOMElements.messages.querySelector('.ai-typing');
    if (show) {
        if (!typingEl) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('chat-message', 'ai', 'ai-typing');
            // UPDATED: "Drona is thinking..."
            messageElement.innerHTML = `<div class="chat-bubble">Drona is thinking...</div>`;
            DOMElements.messages.appendChild(messageElement);
            DOMElements.messages.scrollTop = DOMElements.messages.scrollHeight;
        }
    } else {
        if (typingEl) {
            DOMElements.messages.removeChild(typingEl);
        }
    }
}

/**
 * Calls OUR backend API, which then calls Gemini.
 * @param {string} userText - The latest user text (for context).
 * @returns {Promise<string>} - The AI's text response.
 */
async function callGeminiAPI(userText) {
    // *** THIS FUNCTION IS MODIFIED ***
    
    // 1. Prepare payload (this is what we send to *our* backend)
    const payload = {
        // Construct the full conversation history for the API
        contents: conversationHistory.map(item => ({
            role: item.role === 'system' ? 'user' : item.role, // API uses 'user' for system prompt
            parts: item.parts
        })),
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
        }
    };
    
    // 2. Clean up history
    if (conversationHistory.length > 12) {
        conversationHistory = [
            conversationHistory[0], // Keep system prompt
            ...conversationHistory.slice(-10) // Keep last 10 messages
        ];
    }

    // 3. Call our *own* backend endpoint using the imported constant
    const response = await fetch(GEMINI_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) // Send the payload to our serverless function
    });

    // 4. Handle response from *our* backend
    if (!response.ok) {
        const errorBody = await response.json(); // Our backend sends JSON errors
        console.error("Backend API Error:", errorBody);
        // Throw the specific error message from our backend
        throw new Error(errorBody.error?.message || `API request failed with status ${response.status}`);
    }

    const result = await response.json(); // This is the response from Google, forwarded by our backend

    // --- 5. FIXED CHECK (remains the same) ---
    // Safely access the candidate and content part
    const candidate = result.candidates?.[0];
    const contentPart = candidate?.content?.parts?.[0];

    // Check if the content part or its text is missing
    if (!contentPart || typeof contentPart.text !== 'string') {
        // Check for a prompt block reason first
        if (result.promptFeedback?.blockReason) {
            console.error("AI request blocked (prompt):", result.promptFeedback.blockReason);
            throw new Error(`Request blocked: ${result.promptFeedback.blockReason}`);
        }
        
        const finishReason = candidate?.finishReason;
        const safetyRatings = candidate?.safetyRatings;
        console.error("AI Error Details:", { finishReason, safetyRatings, response: result });
        
        throw new Error(`AI returned no valid content. Finish Reason: ${finishReason || 'Unknown'}`);
    }
    // --- END FIXED CHECK ---

    // If we're here, contentPart.text is valid
    return contentPart.text;
}
