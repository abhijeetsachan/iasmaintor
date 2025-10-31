// sw.js (Fixed)

const CACHE_NAME = 'iasmaintor-v1.1'; // Incremented version to force update
// These are the core files that make up your "app shell".
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/tracker.html',
  '/css/style.css',
  '/favicon.png',
  '/manifest.json',
  // Core JS files
  '/js/app.js',
  '/js/syllabus-tracker.js',
  '/js/utils.js',
  '/js/quizzie.js',
  '/js/chatbot.js',
  '/js/firebase-config.js',
  // Syllabus data
  '/js/syllabus-prelims-data.js',
  '/js/syllabus-mains-gs1-data.js',
  '/js/syllabus-mains-gs2-data.js',
  '/js/syllabus-mains-gs3-data.js',
  '/js/syllabus-mains-gs4-data.js',
  '/js/optional-syllabus-data.js',
  // External assets (FIXED URLs)
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  // --- FIXED: ADDED FIREBASE SDKs TO CACHE ---
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js'
];

// --- 1. Install Event: Pre-cache the app shell ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        // Use individual add() calls to be more robust. addAll() fails if one asset fails.
        const promises = APP_SHELL_URLS.map(url => {
            return cache.add(url).catch(err => {
                console.warn(`Service Worker: Failed to cache ${url}`, err);
            });
        });
        return Promise.all(promises);
      })
      .catch(err => console.error('Service Worker: Caching failed', err))
  );
});

// --- 2. Activate Event: Clean up old caches ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// --- 3. Fetch Event: Serve from cache first, then network ---
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // We must *not* cache API calls to our backend (which calls Gemini) or Firebase auth/db.
  // This ensures data is always fresh and auth works.
  const isApiCall = request.url.includes('generativelanguage.googleapis.com') || // This is redundant if using /api/gemini
                    request.url.includes('/api/gemini') || // Block caching of our own backend
                    request.url.includes('firebase');   // Block caching of Firebase auth/db operations

  if (isApiCall) {
    // Network-only for APIs
    event.respondWith(fetch(request));
    return;
  }

  // For all other requests (app shell, fonts, Firebase SDKs, etc.): Cache-First
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // 1. Return cached response if it exists
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. If not in cache, fetch from network
      return fetch(request).then((networkResponse) => {
        // 3. (Optional but good) Clone response and add to cache for next time
        // Only cache successful GET requests
        if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
        }
        // 4. Return the network response
        return networkResponse;
      }).catch(err => {
          console.error('Service Worker: Fetch failed', err);
          // You could return an offline fallback page here if you had one
      });
    })
  );
});
