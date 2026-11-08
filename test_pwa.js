// PWA: manifest, icons, iOS meta, SW never caches private/API or writes.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const P = __dirname + '/public/'; let n = 0; const t = (k, f) => { f(); console.log('OK', k); n++; };
const m = JSON.parse(fs.readFileSync(P + 'manifest.webmanifest', 'utf8')), html = fs.readFileSync(P + 'index.html', 'utf8'), sw = fs.readFileSync(P + 'sw.js', 'utf8');
t('manifest standalone, scope/start /, 192/512 any+maskable present', () => {
  assert.equal(m.display, 'standalone'); assert.equal(m.start_url, '/'); assert.equal(m.scope, '/');
  for (const s of ['192', '512']) for (const p of ['any', 'maskable']) { const i = m.icons.find(x => x.sizes === `${s}x${s}` && x.purpose === p); assert.ok(i && fs.existsSync(P + i.src.slice(1)), s + p); }
  assert.ok(fs.existsSync(P + 'icons/apple-touch-icon.png'));
});
t('index has manifest, apple meta, safe-area, SW registration', () => {
  for (const k of ['rel="manifest"', 'apple-touch-icon', 'apple-mobile-web-app-capable', 'viewport-fit=cover', 'safe-area-inset-top', "serviceWorker.register('/sw.js'"]) assert.ok(html.includes(k), k);
});
t('SW: only navigations get offline fallback; API, writes, assets untouched; caches only offline page + icon', () => {
  const L = {}; const ctx = { self: { addEventListener: (k, f) => L[k] = f }, caches: { match: async () => 'off' }, URL, fetch: async () => { throw 0; } };
  vm.runInNewContext(sw, ctx);
  const ev = (url, o = {}) => { let used = false; L.fetch({ request: { url, method: o.method || 'GET', mode: o.mode || 'cors' }, respondWith: () => used = true }); return used; };
  assert.equal(ev('https://x.test/api/me'), false); assert.equal(ev('https://x.test/api/bets', { method: 'POST' }), false);
  assert.equal(ev('https://x.test/app.js?v=1'), false); assert.equal(ev('https://x.test/api/x', { mode: 'navigate' }), false);
  assert.equal(ev('https://x.test/', { mode: 'navigate' }), true);
  assert.match(sw, /SHELL = \['\/offline.html', '\/icons\/icon-192.png'\]/); assert.ok(!/cache\.put|c\.put/.test(sw));
});
t('server: sw.js root scope no-cache, manifest no-cache with manifest MIME', () => {
  const s = fs.readFileSync(__dirname + '/server.js', 'utf8'); assert.ok(s.includes("'Service-Worker-Allowed': '/'") && s.includes("application/manifest+json")); assert.ok(!s.includes('__SW_VERSION__'));
});
console.log(n, 'PWA tests passed');
