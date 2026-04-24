// Be sure to bump this version number whenever you change this file
// so the browser knows to run the 'install' and 'activate' steps again.
const CACHE_NAME = 'klasskit-v1.1.25';

// Only cache local, reliable assets during the install phase.
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './script.js',
  './games.json',
  './manifest.json',
  './css/base.css',
  './css/components.css',
  './css/home.css',
  './css/side-panel.css',
  './media/icon.png',
  './media/icon-180.png',
  './media/icon-192.png',
  './media/icon-512.png',
  './media/icon.ico',
  './media/icon.webp'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Forces the waiting service worker to become the active service worker.
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  // Immediately claims any open clients/tabs
  self.clients.claim();
});

// Fetch Event - UPDATED TO NETWORK-FIRST STRATEGY
self.addEventListener('fetch', (event) => {
  // Only handle HTTP/HTTPS, ignore others like chrome-extension
  if (!(event.request.url.indexOf('http') === 0)) return;

  // Ignore non-GET requests (like POST, PUT, DELETE)
  if (event.request.method !== 'GET') {
    return; // Let the browser handle it naturally
  }

  event.respondWith(
    // 1. Try the Network First
    fetch(event.request)
      .then((networkResponse) => {
        // If we get a successful response, clone it and update the cache in the background
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        // Return the fresh network response
        return networkResponse;
      })
      .catch(() => {
        // 2. If the Network fails (offline), Fallback to Cache
        return caches.match(event.request);
      })
  );
});