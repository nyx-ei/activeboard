self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('activeboard-static-v1').then((cache) =>
      cache.addAll(['/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-512.svg']),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== 'activeboard-static-v1').map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => cachedResponse ?? fetch(event.request)),
  );
});

