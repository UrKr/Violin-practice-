// Offline support for Play it back (works under the GitHub Pages sub-path: everything is relative).
// The page: network first, so a new version shows up as soon as you're online; the cached copy
// is used offline. The notation library and fonts are fixed versions: cached on first use.
const CACHE = 'pib-v1';
const SHELL = ['./', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {                       // the app page
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./', copy)); }
      return res;
    }).catch(() => caches.match('./').then(r => r || caches.match(req))));
    return;
  }

  const pinned = url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.gstatic.com';
  const fonts = url.hostname === 'fonts.googleapis.com';
  const own = url.origin === self.location.origin;
  if (!pinned && !fonts && !own) return;

  if (pinned) {                                        // versioned files never change: cache first
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  // our own files and the font stylesheet: answer from cache, refresh in the background
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
