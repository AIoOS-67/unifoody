// UniFoody Service Worker v3 — Caching + Push + Offline
const CACHE_VERSION = 'v3';
const STATIC_CACHE = `unifoody-static-${CACHE_VERSION}`;
const API_CACHE = `unifoody-api-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/FoodyePayLogo.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  console.log('[UniFoody SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[UniFoody SW] Activating...');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: strategy-based routing
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and other non-http
  if (!url.protocol.startsWith('http')) return;

  // API routes: network-first with 5s timeout
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithTimeout(event.request, API_CACHE, 5000));
    return;
  }

  // Static assets (images, fonts, CSS, JS): cache-first
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2?|ico|gif)$/)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // Translation files: stale-while-revalidate
  if (url.pathname.startsWith('/locales/')) {
    event.respondWith(staleWhileRevalidate(event.request, STATIC_CACHE));
    return;
  }

  // HTML pages: network-first, fallback to offline page
  event.respondWith(networkFirstWithOfflineFallback(event.request));
});

// Push notification handler
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (e) {
    data = { title: 'UniFoody', body: event.data?.text() || 'New notification' };
  }

  const title = data.title || 'UniFoody';
  const options = {
    body: data.body || 'New notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: { url: data.url || '/' },
    actions: data.actions || [],
    tag: data.tag || 'default',
    renotify: !!data.tag,
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

// Background sync for failed transactions
self.addEventListener('sync', (event) => {
  if (event.tag === 'retry-payment') {
    event.waitUntil(retryFailedPayments());
  }
});

// --- Caching Strategy Helpers ---

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return new Response('', { status: 408 });
  }
}

async function networkFirstWithTimeout(request, cacheName, timeout) {
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error('timeout')); }, timeout);
      }),
    ]);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    return cached || new Response('{}', { headers: { 'Content-Type': 'application/json' } });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(function(response) {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(function() { return null; });

  return cached || (await fetchPromise) || new Response('{}');
}

async function networkFirstWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Return a basic offline message for navigation requests
    if (request.mode === 'navigate') {
      return new Response(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UniFoody - Offline</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-family:system-ui}div{text-align:center;padding:2rem}.logo{width:80px;height:80px;margin:0 auto 1.5rem}h1{font-size:1.5rem;margin-bottom:.5rem}p{color:#9ca3af;margin-bottom:1.5rem}button{background:#FF007A;color:#fff;border:none;padding:.75rem 2rem;border-radius:.5rem;font-size:1rem;cursor:pointer}</style></head><body><div><img src="/FoodyePayLogo.png" alt="UniFoody" class="logo"><h1>You\'re Offline</h1><p>Please check your internet connection and try again.</p><button onclick="location.reload()">Retry</button></div></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    return new Response('Offline', { status: 503 });
  }
}

async function retryFailedPayments() {
  console.log('[UniFoody SW] Background sync: retry-payment');
}
