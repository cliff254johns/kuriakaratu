/* Static application shell cache. Authenticated Firestore data is never cached here. */
'use strict';
const CACHE_NAME = 'kk-shell-v1';
const SHELL = [
  '/index.html',
  '/admin.html',
  '/admin.css',
  '/admin.js',
  '/sidebar-counters.js',
  '/client.html',
  '/finance.html',
  '/generator.html',
  '/generator.js',
  '/track.html',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/logo%20(1).jpg',
  '/2.jpg',
  '/otieno.jpeg',
  '/brian.jpeg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .catch(error => console.warn('Shell pre-cache incomplete:', error))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/__/') || url.pathname.includes('/api/')) return;

  const isShellAsset = /\\.(?:html|css|js|png|jpe?g|webp|svg|ico|json)$/i.test(url.pathname);
  if (!isShellAsset) return;

  event.respondWith(
    fetch(request).then(response => {
      if (response && response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match(request).then(cached => cached || Response.error()))
  );
});
