// js/chatbot.js

// Import the new API endpoint, NOT the key
import { GEMINI_API_ENDPOINT } from './firebase-config.js';

// --- Module State ---
let DOMElements = {};
let conversationHistory = [];
let isChatbotInitialized = false;
let isChatOpen = false;
let greetingTimeout;
let notify; // To store the showNotification function
// REMOVED: const API_URL = ... (This is no longer needed)

const GREETINGS = [
    "Hi! My name is Chinki. How may I assist you today?",
    "Hello there! I'm Chinki, your AI assistant. What's on your mind?",
    "Meow! I'm Chinki. Do you have any questions about your UPSC prep?",
    "Greetings, aspirant! Chinki here, ready to help. What can I do for you?"
];

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

    // --- System Prompt ---
    conversationHistory.push({
        role: "system",
        parts: [{ text: "You are Chinki, a friendly and helpful AI chatbot assistant for the iasmAIntor website. Your personality is like a knowledgeable and encouraging cat. You are here to help UPSC aspirants with their questions about the exam, study strategies, or any general queries. Keep your answers concise and helpful." }]
    });

    // --- Show Initial Greeting ---
    showGreetingBubble();
    
    isChatbotInitialized = true;
    console.log("Chatbot 'Chinki' initialized.");
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

        // --- UPDATED ERROR HANDLING ---
        let friendlyErrorMessage = "Meow... I'm sorry, I ran into an error. Please try rephrasing your question.";
        
        if (error.message.includes('RECITATION')) {
            friendlyErrorMessage = "Meow... My response was blocked because it was too similar to a source. Could you please ask in a different way?";
        } else if (error.message.includes('blocked:')) {
            friendlyErrorMessage = "Meow... I'm sorry, I can't answer that. My safety filters were triggered.";
        } else if (error.message.includes('API key')) {
             friendlyErrorMessage = "Meow... There seems to be an issue with my API configuration. Please alert the site admin!";
        } else if (error.message.includes('API request failed')) {
             friendlyErrorMessage = "Meow... I'm having trouble connecting to my brain. Please try again in a moment.";
        }
        
        addMessage('ai', friendlyErrorMessage);
        // --- END UPDATED ERROR HANDLING ---
        
        if(notify) notify("Chatbot error: " + error.message, true); // The developer still sees the full error
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
        requestAnimationFrame(() => {
            // Get the computed style to find the 'max-height' value (e.g., "200px")
            const computedStyle = window.getComputedStyle(bubble);
            // Parse the numeric value from the max-height property
            const maxHeight = parseFloat(computedStyle.maxHeight);

            // Check if the bubble's actual content height is greater than its CSS max-height
            const isOverflowing = bubble.scrollHeight > maxHeight;
        
            if (isOverflowing) {
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
            }
        });
    }
    // --- END "READ MORE" LOGIC ---
    
    // Scroll to bottom
    DOMElements.messages.scrollTop = DOMElements.messages.scrollHeight;
}


/**
 * Shows or hides the "Chinki is typing..." indicator.
 * @param {boolean} show - Whether to show or hide.
 */
function showTypingIndicator(show) {
    let typingEl = DOMElements.messages.querySelector('.ai-typing');
    if (show) {
        if (!typingEl) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('chat-message', 'ai', 'ai-typing');
            messageElement.innerHTML = `<div class="chat-bubble">Chinki is typing...</div>`;
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
