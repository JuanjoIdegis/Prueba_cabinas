const CACHE_NAME = 'cabina-v2.4.6';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/store.js',
  './js/qr-scanner.js',
  './js/qr-generator.js',
  './js/qrcode.min.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Las llamadas API y datos dinámicos van siempre directas a la red
  if (
    e.request.url.includes('/api/') ||
    e.request.url.includes('database.json') ||
    e.request.url.includes('api.github.com')
  ) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Network first con fallback a cache
  e.respondWith(
    fetch(e.request)
      .catch(() => caches.match(e.request))
  );
});
