/* Rechenwerk – Service Worker (wird beim Build mit Dateiliste und Version befüllt). */
const CACHE = 'rechenwerk-__CACHE_VERSION__';
const PRECACHE = "__PRECACHE_LIST__";

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rechenwerk-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // ignoreVary: Schriften werden im CORS-Modus (mit Origin-Header) angefragt; ohne diese Option
      // würde ein „Vary: Origin“ des Servers den Treffer im Cache verhindern.
      const cached = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok && res.type === 'basic') cache.put(req, res.clone());
        return res;
      } catch (err) {
        // Offline: Navigationsanfragen mit der App-Shell beantworten
        if (req.mode === 'navigate') {
          const shell = (await cache.match('./index.html', { ignoreVary: true })) || (await cache.match('./', { ignoreVary: true }));
          if (shell) return shell;
        }
        throw err;
      }
    }),
  );
});
