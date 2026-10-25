// Service worker (PWA). Lets the app be installed and opened quickly.
//
// Always tries the network first, so a new version is used as soon as the
// server has it; the saved copy is only a fallback when the server cannot be
// reached. Realtime traffic (/socket.io) and the API are never cached.
// Change VERSION when this file changes, so old saved copies are thrown away.

const VERSION = 'pixel-office-v3';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/socket.io') || url.pathname.startsWith('/api') || url.pathname === '/healthz') return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === 'navigate' || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/icons/'))) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req.mode === 'navigate' ? '/' : req, copy));
        }
        return res;
      })
      .catch(async () => (await caches.match(req.mode === 'navigate' ? '/' : req)) || Response.error()),
  );
});
