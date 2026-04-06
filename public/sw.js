// Cache version is automatically updated from package.json version
const CACHE_VERSION = 'v1.0.10';
const STATIC_CACHE = `static-cache-${CACHE_VERSION}`;

const PRECACHE_URLS = ['/', '/css/main.css', '/css/responsive.css'];

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately and force update
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Installing new cache:', STATIC_CACHE);
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new service worker:', CACHE_VERSION);

  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        console.log('[SW] Found caches:', keys);
        // Delete ALL old caches to force icon path updates
        return Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE)
            .map((key) => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => {
        console.log('[SW] Taking control of all clients');
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Skip caching in development (localhost)
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    event.respondWith(fetch(request));
    return;
  }

  // Navigation: network-first strategy with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Static resources
  if (url.origin === self.location.origin) {
    // Cache-first
    if (
      url.pathname.startsWith('/css/') ||
      url.pathname.startsWith('/backdrops/') ||
      url.pathname.startsWith('/palettes/')
    ) {
      event.respondWith(
        caches.match(request).then((cached) => {
          if (cached) {
            return cached;
          }

          return fetch(request).then((response) => {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone));
            return response;
          });
        })
      );
      return;
    }
  }

  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
