// js/chatbot.js (FIXED, RENAMED & DYNAMIC)

import { GET_CHAT_RESPONSE_ENDPOINT } from './firebase-config.js';

// --- Module State ---
let DOMElements = {};
let conversationHistory = [];
let isChatbotInitialized = false;
let isChatOpen = false;
let greetingTimeout;
let notify; // To store the showNotification function

const GREETINGS = [
    "Greetings. I am Drona, your AI mentor. How may I assist in your preparation today?",
    "Hello. I am Drona. What strategic questions about your preparation do you have?",
    "I am Drona, your guide for the Civil Services Exam. Please ask your questions.",
    "Greetings, aspirant. I am Drona, here to help you navigate your UPSC journey."
];

const READ_MORE_WORD_LIMIT = 60;

const GENERAL_QUERY_KEYWORDS = [
    'hello', 'hi', 'hey', 'thanks', 'thank you', 'who are you',
    'what is your name', 'bye', 'goodbye', 'how are you', 'what can you do'
];

// --- Core Functions ---
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

    notify = showNotification;

    if (!DOMElements.toggleButton || !DOMElements.window || !DOMElements.form) {
        console.error("Chatbot DOM elements not found. Aborting init.");
        return;
    }

    DOMElements.toggleButton.addEventListener('click', toggleChatWindow);
    DOMElements.closeButton.addEventListener('click', () => toggleChatWindow(false));
    DOMElements.form.addEventListener('submit', handleUserMessage);

    showGreetingBubble();
    isChatbotInitialized = true;
    console.log("Chatbot 'Drona' initialized (Dynamic Prompting & Caching).");
}

function showGreetingBubble() {
    if (!DOMElements.greetingBubble) return;
    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    DOMElements.greetingBubble.textContent = greeting;
    DOMElements.greetingBubble.classList.remove('hidden');
    greetingTimeout = setTimeout(() => {
        DOMElements.greetingBubble.classList.add('hidden');
    }, 8000);
}

function toggleChatWindow(forceOpen = null) {
    isChatOpen = (forceOpen !== null) ? forceOpen : !isChatOpen;
    
    if (isChatOpen) {
        DOMElements.window.classList.remove('hidden');
        if (greetingTimeout) clearTimeout(greetingTimeout);
        DOMElements.greetingBubble.classList.add('hidden');
        
        if (DOMElements.messages.children.length === 0) {
            addMessage('ai', GREETINGS[0]);
            displayPopularSearches();
        }
        DOMElements.input.focus();
    } else {
        DOMElements.window.classList.add('hidden');
    }
}

async function handleUserMessage(e) {
    e.preventDefault();
    const userText = DOMElements.input.value.trim();
    if (!userText) return;

    addMessage('user', userText);
    DOMElements.input.value = '';
    
    conversationHistory.push({
        role: "user",
        parts: [{ text: userText }]
    });

    showTypingIndicator(true);

    try {
        const aiResponse = await callChatAPI(userText);
        
        conversationHistory.push({
            role: "model",
            parts: [{ text: aiResponse.text }],
        });
        
        showTypingIndicator(false);
        addMessage('ai', aiResponse.text, aiResponse.fromCache);

    } catch (error) {
        console.error("Chatbot API error:", error);
        showTypingIndicator(false);

        let friendlyErrorMessage = "My apologies, I have encountered an error. Please try rephrasing your question.";
        
        if (error.message && !error.message.includes("Failed to fetch")) {
            if (error.message.includes('RECITATION')) {
                friendlyErrorMessage = "My response was blocked for recitation. Please ask in a different way.";
            } else if (error.message.includes('blocked:')) {
                friendlyErrorMessage = "I am sorry, I cannot answer that. My safety filters were triggered.";
            } else if (error.message.includes('API key') || error.message.includes('configuration')) {
                 friendlyErrorMessage = "There appears to be an issue with my configuration. Please alert the site admin!";
            } else if (!error.message.includes('API request failed') && !error.message.includes('invalid response')) {
                friendlyErrorMessage = error.message;
            } else if (error.message.includes('invalid response')) {
                friendlyErrorMessage = "The server returned an invalid response. Please try again.";
            }
        }
        
        addMessage('ai', friendlyErrorMessage);
        if(notify) notify("Chatbot error: ".concat(error.message), true);
    }
}

function addMessage(sender, text, fromCache = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', sender);
    
    const bubble = document.createElement('div');
    bubble.classList.add('chat-bubble');
    
    // Render the main text first
    let htmlContent = (sender === 'ai') ? renderSimpleMarkdown(text) : text.replace(/\n/g, '<br>'); // Only render markdown for AI

    // Add "from cache" indicator *after* rendering
    if (fromCache) {
        htmlContent += '<br><em style="font-size: 0.75rem; color: var(--text-muted); opacity: 0.8;">(Loaded from cache)</em>';
    }

    bubble.innerHTML = htmlContent; // Set the final HTML
    
    messageElement.appendChild(bubble);
    DOMElements.messages.appendChild(messageElement);
    
    if (sender === 'ai') {
        const wordCount = text.split(/\s+/).length;
        if (wordCount <= READ_MORE_WORD_LIMIT) {
            bubble.classList.add('expanded');
        } else {
            requestAnimationFrame(() => {
                const isOverflowing = (bubble.scrollHeight - bubble.clientHeight) > 1;
                if (isOverflowing) {
                    const readMoreBtn = document.createElement('div');
                    readMoreBtn.className = 'read-more-btn';
                    readMoreBtn.innerHTML = '<button class="read-more-button-inner">Read More</button>';
                    readMoreBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        bubble.classList.add('expanded');
                        readMoreBtn.remove();
                        DOMElements.messages.scrollTop = DOMElements.messages.scrollHeight;
                    });
                    bubble.appendChild(readMoreBtn);
                } else {
                    bubble.classList.add('expanded');
                }
            });
        }
    }
    
    DOMElements.messages.scrollTop = DOMElements.messages.scrollHeight;
}


function showTypingIndicator(show) {
    let typingEl = DOMElements.messages.querySelector('.ai-typing');
    if (show) {
        if (!typingEl) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('chat-message', 'ai', 'ai-typing');
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

function getQueryType(userText) {
    const lowerText = userText.toLowerCase().trim();
    const wordCount = lowerText.split(/\s+/).length;
    if (wordCount <= 4) return 'general';
    if (GENERAL_QUERY_KEYWORDS.some(keyword => lowerText.startsWith(keyword))) {
        return 'general';
    }
    return 'academic';
}

async function displayPopularSearches() {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', 'ai', 'popular-topics-loading');
    const bubble = document.createElement('div');
    bubble.classList.add('chat-bubble', 'expanded');
    bubble.innerHTML = `<strong style="display:block; font-style: italic; color: var(--text-muted, #64748b);">Finding popular topics...</strong>`;
    messageElement.appendChild(bubble);
    DOMElements.messages.appendChild(messageElement);
    DOMElements.messages.scrollTop = DOMElements.messages.scrollHeight;

    try {
        const response = await fetch('/api/getPopularSearches');
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        const data = await response.json();
        const popularSearches = data.searches;
        if (!popularSearches || popularSearches.length === 0) throw new Error("No topics returned");

        let htmlContent = `<strong style="display:block; margin-bottom: 8px;">Here are some trending topics:</strong>
            <div class="popular-searches-container" style="display: flex; flex-direction: column; gap: 8px;">`;
        
        popularSearches.forEach(searchText => {
            htmlContent += `<button class="popular-search-btn" data-text="${searchText.replace(/"/g, '&quot;')}"
                        style="background: rgba(255,255,255,0.5); border: 1px solid var(--border-primary, #e2e8f0); color: var(--brand-primary, #3b82f6); padding: 8px; border-radius: 6px; text-align: left; cursor: pointer; font-size: 0.875rem; transition: background-color 0.2s; font-weight: 500;">
                    ${searchText}
                </button>`;
        });
        htmlContent += `</div>`;
        bubble.innerHTML = htmlContent;
        messageElement.classList.remove('popular-topics-loading');

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
        messageElement.remove();
    } finally {
        DOMElements.messages.scrollTop = DOMElements.messages.scrollHeight;
    }
}

async function callChatAPI(userText) {
    
    const queryType = getQueryType(userText);
    
    const payload = {
        contents: conversationHistory.map(item => ({
            role: item.role,
            parts: item.parts
        })),
        queryType: queryType,
    };
    
    if (conversationHistory.length > 12) {
        conversationHistory = [...conversationHistory.slice(-10)];
    }

    const response = await fetch(GET_CHAT_RESPONSE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    let result;
    try {
        result = await response.json();
    } catch (e) {
        console.error("Failed to parse JSON response:", e);
        throw new Error(`The server returned an invalid response (Status: ${response.status}). Please try again.`);
    }

    if (!response.ok) {
        console.error("Backend API Error:", result);
        throw new Error(result.error?.message || `API request failed with status ${response.status}`);
    }

    const candidate = result.candidates?.[0];
    const contentPart = candidate?.content?.parts?.[0];

    if (!contentPart || typeof contentPart.text !== 'string') {
        if (result.promptFeedback?.blockReason) {
            throw new Error(`Request blocked: ${result.promptFeedback.blockReason}`);
        }
        throw new Error(`AI returned no valid content. Finish Reason: ${candidate?.finishReason || 'Unknown'}`);
    }

    return {
        text: contentPart.text,
        fromCache: result.fromCache || false
    };
}

/**
 * *** NEW HELPER FUNCTION (v2) ***
 * Renders simple Markdown to HTML.
 * Handles headings (###, ####), bold (**), and nested lists (* or -).
 * @param {string} text - The raw markdown text.
 * @returns {string} - The rendered HTML.
 */
function renderSimpleMarkdown(text) {
    if (!text) return '';

    // 1. Do simple, non-structural replacements first
    let html = text
        .replace(/^### (.*$)/gm, '<h3 style="font-size: 1.1rem; font-weight: 600; margin-top: 12px; margin-bottom: 4px;">$1</h3>')
        .replace(/^#### (.*$)/gm, '<h4 style="font-size: 1.0rem; font-weight: 600; margin-top: 10px; margin-bottom: 2px;">$1</h4>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 2. Process lists and paragraphs line-by-line
    const lines = html.split('\n');
    let finalHtml = '';
    let listLevel = -1; // -1 means no list

    for (const line of lines) {
        const listMatch = line.match(/^(\s*)([\*\-]) (.*)$/);

        if (listMatch) {
            const indent = listMatch[1].length;
            const newLevel = Math.floor(indent / 2); // 0, 1, 2... (assuming 2-space indents)
            const content = listMatch[3];

            if (newLevel > listLevel) {
                // Start a new nested list
                finalHtml += '<ul style="margin-left: 20px; padding-left: 4px; list-style-type: disc;">';
            } else if (newLevel < listLevel) {
                // End the current list(s)
                finalHtml += '</li></ul>'.repeat(listLevel - newLevel);
                finalHtml += '</li>'; // Close the list item from the parent level
            } else {
                // Same level, just close the previous <li>
                finalHtml += '</li>';
            }
            
            finalHtml += `<li>${content}`;
            listLevel = newLevel;

        } else {
            // Not a list item
            if (listLevel > -1) {
                // Close all open lists
                finalHtml += '</li></ul>'.repeat(listLevel + 1);
                listLevel = -1;
            }

            // Add as paragraph or heading (headings were already converted)
            if (line.trim().startsWith('<h')) {
                finalHtml += line;
            } else if (line.trim().length > 0) {
                finalHtml += `<p>${line}</p>`;
            }
        }
    }

    // Close any remaining list
    if (listLevel > -1) {
        finalHtml += '</li></ul>'.repeat(listLevel + 1);
    }

    return finalHtml;
}
