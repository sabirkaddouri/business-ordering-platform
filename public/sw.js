const CACHE_VERSION = 'shop-v1';
const PRECACHE_NAME = `shop-precache-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `shop-images-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/product.html',
  '/offline.html',
  '/css/style.css',
  '/js/app.js',
  '/js/cities.js',
  '/js/i18n.js',
  '/js/pwa.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png'
];

// Helper to limit the number of cached items (FIFO)
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxItems);
  }
}

// Install Event - Precache core static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key.startsWith('shop-') && !key.endsWith(`-${CACHE_VERSION}`))
            .map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event - Handle requests according to route and type
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. NEVER intercept non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 2. NEVER intercept cross-origin requests (e.g. Cloudinary, external CDNs)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. NEVER intercept /api/ routes or /admin dashboard
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) {
    return;
  }

  // 4. HTML pages: Network-first, fallback to cache, then to /offline.html
  const isHtmlRequest =
    request.mode === 'navigate' ||
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html');

  if (isHtmlRequest) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(PRECACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const offlinePage = await caches.match('/offline.html');
          return offlinePage || new Response('Offline', { status: 503, statusText: 'Offline' });
        })
    );
    return;
  }

  // 5. Product images from /images/: Cache-first with a limit of 60 entries
  if (url.pathname.startsWith('/images/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
              await cache.put(request, responseClone);
              await trimCache(IMAGE_CACHE_NAME, 60);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 6. CSS, JS, manifest and icon files: Stale-while-revalidate
  const isStaticAsset =
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json';

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(PRECACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 7. Default fallback for other same-origin GET requests
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
