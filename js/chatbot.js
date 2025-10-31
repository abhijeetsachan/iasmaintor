// js/chatbot.js

// Import the Gemini API key
import { GEMINI_API_KEY } from './firebase-config.js';

// --- Module State ---
let DOMElements = {};
let conversationHistory = [];
let isChatbotInitialized = false;
let isChatOpen = false;
let greetingTimeout;
let notify; // To store the showNotification function
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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
        // Call Gemini API
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
        addMessage('ai', "Meow... I seem to be having some trouble connecting. Please try again in a moment.");
        if(notify) notify("Chatbot error: " + error.message, true);
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
    
    // --- NEW "READ MORE" LOGIC ---
    // We check for overflow *after* the element is added to the DOM
    if (sender === 'ai') {
        // Use requestAnimationFrame to ensure layout is calculated
        requestAnimationFrame(() => {
            // Check if element is overflowing its container (based on css max-height)
            const isOverflowing = bubble.scrollHeight > bubble.clientHeight;
        
            if (isOverflowing) {
                const readMoreBtn = document.createElement('div');
                readMoreBtn.className = 'read-more-btn';
                readMoreBtn.innerHTML = '<span>Read More...</span>';
                
                readMoreBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent any other clicks
                    bubble.classList.add('expanded'); // This class expands the max-height
                    readMoreBtn.remove(); // Remove the button
                    // Scroll to bottom again in case expansion changed height
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
 * Calls the Gemini API with the current conversation history.
 * @param {string} userText - The latest user text (for context).
 * @returns {Promise<string>} - The AI's text response.
 */
async function callGeminiAPI(userText) {
    if (!GEMINI_API_KEY) throw new Error("API key is not configured.");

    // Prepare payload, sending history
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
    
    // Clean up history to prevent it from growing too large (e.g., keep last 10 messages + system prompt)
    if (conversationHistory.length > 12) {
        conversationHistory = [
            conversationHistory[0], // Keep system prompt
            ...conversationHistory.slice(-10) // Keep last 10 messages
        ];
    }

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Gemini API Error:", errorBody);
        throw new Error(`API request failed with status ${response.status}`);
    }

    const result = await response.json();

    // --- FIXED CHECK ---
    // Safely access the candidate and content part using optional chaining (?.)
    const candidate = result.candidates?.[0];
    const contentPart = candidate?.content?.parts?.[0];

    // Check if the content part or its text is missing or not a string
    if (!contentPart || typeof contentPart.text !== 'string') {
        // Check for a block reason first
        if (result.promptFeedback?.blockReason) {
            console.error("AI request blocked:", result.promptFeedback.blockReason);
            throw new Error(`Request blocked: ${result.promptFeedback.blockReason}`);
        }
        
        // Log other potential issues for debugging
        const finishReason = candidate?.finishReason;
        const safetyRatings = candidate?.safetyRatings;
        console.error("AI Error Details:", { finishReason, safetyRatings, response: result });
        throw new Error(`AI returned no valid content. Finish Reason: ${finishReason || 'Unknown'}`);
    }
    // --- END FIXED CHECK ---

    // If we're here, contentPart.text is valid
    return contentPart.text;
}
