const STATIC_CACHE = 'activeboard-static-v3';
const STATIC_ASSETS = ['/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-512.svg', '/en/offline', '/fr/offline'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

function isStaticAsset(url) {
  const sameOrigin = url.origin === self.location.origin;

  return (
    sameOrigin &&
    (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname.startsWith('/landing/') ||
      url.pathname === '/manifest.webmanifest')
  );
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function getOfflineFallbackUrl(url) {
  return url.pathname.startsWith('/fr') ? '/fr/offline' : '/en/offline';
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        const response = await fetch(event.request);
        if (response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      }),
    );
    return;
  }

  if (!isNavigationRequest(event.request) || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(STATIC_CACHE);
      const fallbackUrl = getOfflineFallbackUrl(url);
      return (
        (await cache.match(fallbackUrl)) ||
        (await cache.match('/en/offline')) ||
        Response.error()
      );
    }),
  );
});
