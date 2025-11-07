// js/theme-switcher.js

// Function to apply the selected theme
function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
    } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
    }
    // Update all toggle buttons on the page
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
        btn.innerHTML = theme === 'dark' 
            ? '<i class="fas fa-sun text-xl"></i>' // Show sun icon in dark mode
            : '<i class="fas fa-moon text-xl"></i>'; // Show moon icon in light mode
    });
}

// Function to toggle the theme
function toggleTheme() {
    let currentTheme = localStorage.getItem('theme');
    // If theme is not set, check system preference
    if (!currentTheme) {
        currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
}

// Main initialization function
export function initThemeSwitcher() {
    // Find all toggle buttons
    const toggleButtons = document.querySelectorAll('.theme-toggle-btn');
    if (toggleButtons.length === 0) {
        console.warn('Theme toggle button not found.');
        return;
    }

    // Add click listener to all toggle buttons
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', toggleTheme);
    });

    // --- Load the theme on initial page load ---
    let savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        // No saved theme, check system preference
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            applyTheme('dark');
        } else {
            applyTheme('light');
        }
    }
}
