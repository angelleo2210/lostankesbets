// LosTankesBets service worker — minimal and safe.
// Caches ONLY a public offline page + its icon. Never caches /api (bets, bank, profile, tokens) or app scripts:
// scripts/images keep the normal HTTP cache (index.html is no-cache and references ?v=<hash>), so no stale bundles.
// No offline queue: if the network is down, writes simply fail in the app.
const CACHE = 'ltb-shell-v10';
const SHELL = ['/offline.html', '/icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.mode !== 'navigate') return; // API, POSTs, assets: untouched (network/HTTP cache)
  if (new URL(r.url).pathname.startsWith('/api')) return;
  e.respondWith(fetch(r).catch(() => caches.match('/offline.html')));
});
