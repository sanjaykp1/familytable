const BUILD_ID = '__FAMILY_TABLE_BUILD_ID__';
const PRECACHE_URLS = __FAMILY_TABLE_PRECACHE__;
const CACHE_PREFIX = 'family-table-v2-';
const PRECACHE_CACHE = `${CACHE_PREFIX}precache-${BUILD_ID}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${BUILD_ID}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE_CACHE);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith(CACHE_PREFIX) && key !== PRECACHE_CACHE && key !== RUNTIME_CACHE,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PRECACHE_CACHE);
        return (await cache.match('/index.html')) ?? fetch(request);
      })(),
    );
    return;
  }

  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PRECACHE_CACHE);
        return (await cache.match(request, { ignoreSearch: true })) ?? fetch(request);
      })(),
    );
    return;
  }

  const networkResponse = fetch(request);
  const cacheWrite = networkResponse
    .then(async (response) => {
      if (!response.ok) return;
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    })
    .catch(() => undefined);

  event.waitUntil(cacheWrite);
  event.respondWith(
    networkResponse.catch(async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      return (await cache.match(request)) ?? Response.error();
    }),
  );
});
