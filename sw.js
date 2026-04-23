/* ═══════════════════════════════════════════
   PulpiTools Service Worker v1.0
   Coloca este archivo en la RAÍZ del proyecto
   como: sw.js
═══════════════════════════════════════════ */

const CACHE_NAME = 'pulpitools-v1';

// Archivos que se cachean al instalar (shell de la app)
const PRECACHE = [
  '/',
  '/index.html',
  '/favicon/favicon.ico',
  '/favicon/favicon-96x96.png',
  '/favicon/apple-touch-icon.png',
  '/favicon/android-chrome-192x192.png',
  '/favicon/android-chrome-512x512.png',
  '/favicon/site.webmanifest'
];

// ── INSTALL: pre-cachear el shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar caches viejas ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Network first, cache fallback ──
// Estrategia: intenta red primero; si falla, usa cache
self.addEventListener('fetch', event => {
  // Solo interceptar peticiones GET del mismo origen
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la respuesta es válida, guardarla en cache
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Sin red → servir desde cache
        return caches.match(event.request)
          .then(cached => cached || caches.match('/index.html'));
      })
  );
});