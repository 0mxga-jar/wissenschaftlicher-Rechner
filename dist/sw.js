/* Rechenwerk – Service Worker (wird beim Build mit Dateiliste und Version befüllt). */
const CACHE = 'rechenwerk-a93cb1a8e5bd';
const PRECACHE = ["./","./assets/ibm-plex-mono-latin-400-italic-BqAiT5Ww.woff2","./assets/ibm-plex-mono-latin-400-normal-DMJ8VG8y.woff2","./assets/ibm-plex-mono-latin-500-italic-As4cCeDr.woff2","./assets/ibm-plex-mono-latin-500-normal-DSY6xOcd.woff2","./assets/ibm-plex-sans-greek-400-normal-_efipK4i.woff2","./assets/ibm-plex-sans-greek-500-normal-JMMifIXV.woff2","./assets/ibm-plex-sans-latin-400-normal-CDDApCn2.woff2","./assets/ibm-plex-sans-latin-500-normal-6ng42L7E.woff2","./assets/ibm-plex-sans-latin-600-normal-CuJfVYMP.woff2","./assets/index-DS1sgVJ6.js","./assets/index-DjLiUq4W.css","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-192.png","./icons/icon-maskable-512.png","./icons/icon.svg","./index.html","./manifest.webmanifest"];

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
