// js/chatbot.js (FIXED, RENAMED & DYNAMIC)

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

const READ_MORE_WORD_LIMIT = 60;

// *** NEW: Keyword list for "Triage" ***
const GENERAL_QUERY_KEYWORDS = [
    'hello', 'hi', 'hey', 'thanks', 'thank you', 'who are you',
    'what is your name', 'bye', 'goodbye', 'how are you', 'what can you do'
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

    // --- *** MODIFICATION: System Prompt is REMOVED from the client *** ---
    // The server (api/gemini.js) now handles the system prompt.

    // --- Show Initial Greeting ---
    showGreetingBubble();
    
    isChatbotInitialized = true;
    console.log("Chatbot 'Drona' initialized (Dynamic Prompting)."); // UPDATED
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
        
        // *** MODIFIED: Add greeting and popular searches on first open ***
        if (DOMElements.messages.children.length === 0) {
            addMessage('ai', GREETINGS[0]); // Add a default greeting to chat
            displayPopularSearches(); // *** UPDATED: Now fetches dynamically ***
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
        // *** MODIFIED: Pass userText to callGeminiAPI for triage ***
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
        
        // Check for specific error messages from the backend
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
                    
                    // *** THIS IS THE CHANGE ***
                    // We are using a <button> element for better styling
                    readMoreBtn.innerHTML = '<button class="read-more-button-inner">Read More</button>';
                    
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
 * *** NEW FUNCTION ***
 * Performs "triage" on the user's message to decide which "brain" to use.
 * @param {string} userText - The user's message.
 * @returns {'general' | 'academic'}
 */
function getQueryType(userText) {
    const lowerText = userText.toLowerCase().trim();
    const wordCount = lowerText.split(/\s+/).length;

    // Check 1: Is it a short conversational query?
    if (wordCount <= 4) {
        return 'general';
    }

    // Check 2: Does it contain common conversational keywords?
    if (GENERAL_QUERY_KEYWORDS.some(keyword => lowerText.startsWith(keyword))) {
        return 'general';
    }

    // Default: Assume it's an academic question
    return 'academic';
}

/**
 * *** UPDATED FUNCTION ***
 * Fetches and displays popular search topics from the new API.
 */
async function displayPopularSearches() {
    
    // 1. Create a "loading" bubble first
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', 'ai', 'popular-topics-loading');
    
    const bubble = document.createElement('div');
    bubble.classList.add('chat-bubble', 'expanded'); // Expanded by default
    bubble.innerHTML = `<strong style="display:block; font-style: italic; color: var(--text-muted, #64748b);">Finding popular topics...</strong>`;
    messageElement.appendChild(bubble);
    DOMElements.messages.appendChild(messageElement);
    DOMElements.messages.scrollTop = DOMElements.messages.scrollHeight;

    try {
        // 2. Fetch from our new API endpoint
        const response = await fetch('/api/getPopularSearches');
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const data = await response.json();
        const popularSearches = data.searches;

        if (!popularSearches || popularSearches.length === 0) {
            throw new Error("No topics returned from API");
        }

        // 3. If successful, replace the "loading" bubble's content
        let htmlContent = `
            <strong style="display:block; margin-bottom: 8px;">Here are some trending topics:</strong>
            <div class="popular-searches-container" style="display: flex; flex-direction: column; gap: 8px;">`;
        
        popularSearches.forEach(searchText => {
            htmlContent += `
                <button class="popular-search-btn" 
                        data-text="${searchText.replace(/"/g, '&quot;')}"
                        style="background: rgba(255,255,255,0.5); border: 1px solid var(--border-primary, #e2e8f0); color: var(--brand-primary, #3b82f6); padding: 8px; border-radius: 6px; text-align: left; cursor: pointer; font-size: 0.875rem; transition: background-color 0.2s; font-weight: 500;">
                    ${searchText}
                </button>`;
        });

        htmlContent += `</div>`;
        bubble.innerHTML = htmlContent; // Replace "loading" with buttons
        messageElement.classList.remove('popular-topics-loading'); // Remove loading class

        // 4. Add event listeners to the new buttons
        messageElement.querySelectorAll('.popular-search-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const queryText = btn.getAttribute('data-text');
                DOMElements.input.value = queryText;
                DOMElements.form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            });
            
            btn.onmouseenter = () => btn.style.background = 'var(--brand-bg-light-hover, #dbeafe)';
            btn.onmouseleave = () => btn.style.background = 'rgba(255,255,255,0.5)';
        });

    } catch (error) {
        console.error("Failed to load popular searches:", error.message);
        // 5. If it fails, just remove the "loading" bubble quietly.
        messageElement.remove();
    } finally {
        // Ensure scroll is at the bottom
        DOMElements.messages.scrollTop = DOMElements.messages.scrollHeight;
    }
}


/**
 * Calls OUR backend API, which then calls Gemini.
 * @param {string} userText - The latest user text (for context).
 * @returns {Promise<string>} - The AI's text response.
 */
async function callGeminiAPI(userText) {
    
    // 1. *** NEW: Perform "Triage" ***
    const queryType = getQueryType(userText);
    
    // 2. Prepare payload (this is what we send to *our* backend)
    const payload = {
        // Construct the full conversation history for the API
        contents: conversationHistory.map(item => ({
            role: item.role,
            parts: item.parts
        })),
        queryType: queryType, // *** NEW: Send the query type to the backend ***
    };
    
    // 3. Clean up history
    if (conversationHistory.length > 12) {
        // Keep the last 10 messages (user/model pairs)
        conversationHistory = [...conversationHistory.slice(-10)];
    }

    // 4. Call our *own* backend endpoint using the imported constant
    const response = await fetch(GEMINI_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) // Send the payload to our serverless function
    });

    // 5. Handle response from *our* backend
    if (!response.ok) {
        const errorBody = await response.json(); // Our backend sends JSON errors
        console.error("Backend API Error:", errorBody);
        // Throw the specific error message from our backend
        throw new Error(errorBody.error?.message || `API request failed with status ${response.status}`);
    }

    const result = await response.json(); // This is the response from Google, forwarded by our backend

    // --- 6. FIXED CHECK (remains the same) ---
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
