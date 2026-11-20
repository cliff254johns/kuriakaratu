'use strict';

const VERSION = 'kk-public-pwa-v1';
const SHELL_CACHE = VERSION + '-shell';
const PAGE_CACHE = VERSION + '-pages';
const ASSET_CACHE = VERSION + '-assets';
const CORE_FILES = [
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.ico'
];

function isPrivatePath(pathname) {
  return /^\/(?:admin(?:\.html|-v2\.html)?|client(?:\.html)?|finance(?:\.html)?|generator(?:\.html)?|track(?:\.html)?|complaints(?:\.html)?)(?:\/|$)/i.test(pathname);
}

function isPrivateAsset(pathname) {
  return /\/(?:admin(?:-v2)?\.js|client(?:-portal)?\.js|finance\.js|generator\.js)$/i.test(pathname);
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith('kk-public-pwa-') && ![SHELL_CACHE, PAGE_CACHE, ASSET_CACHE].includes(key))
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok && !isPrivatePath(url.pathname)) {
          const cache = await caches.open(PAGE_CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cachedPage = await caches.match(request);
        if (cachedPage) return cachedPage;
        const shell = await caches.open(SHELL_CACHE);
        return (await shell.match('/index.html')) || (await shell.match('/offline.html'));
      }
    })());
    return;
  }

  if (isPrivateAsset(url.pathname)) return;

  if (/\.(?:css|js|png|jpe?g|webp|svg|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(ASSET_CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        return cached || Response.error();
      }
    })());
  }
});
