const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), { execFileSync } = require('node:child_process');
let n = 0; const t = (name, fn) => { fn(); console.log('OK', name); n++; };
t('intro.mp4 is 3.0 s H.264 + AAC, faststart-sized', () => {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height', '-of', 'json', 'public/intro.mp4']));
  assert.ok(Math.abs(Number(j.format.duration) - 3) < 0.05); assert.deepEqual(j.streams.map(s => s.codec_name).sort(), ['aac', 'h264']);
  assert.ok(fs.statSync('public/intro.mp4').size < 2e6); assert.ok(fs.existsSync('public/intro-poster.jpg'));
});
t('markup: loaded before app, outside #app, no controls/skip', () => {
  const html = fs.readFileSync('public/index.html', 'utf8'), src = fs.readFileSync('public/intro.js', 'utf8');
  assert.ok(html.indexOf('intro.js') > html.indexOf('<main id="app">') && html.indexOf('intro.js') < html.indexOf('app.js'));
  assert.ok(!/controls|skip|saltar|omitir/i.test(src)); assert.ok(!fs.readFileSync('public/app.js', 'utf8').includes('body.innerHTML'));
});
function env(seen) {
  const timers = []; const store = seen ? { lt_intro_seen: '1' } : {}; const events = {}; let removed = false, attrs = {};
  const video = { setAttribute: (a) => attrs[a] = 1, addEventListener: (e, f) => events[e] = f, pause() {}, currentTime: 0, style: {}, play: () => ({ catch: f => { video.reject = f; } }) };
  const overlay = { style: {}, setAttribute() {}, appendChild() {}, remove: () => { removed = true; } };
  const body = { children: [], appendChild: c => body.children.push(c) };
  const document = { body, createElement: tag => tag === 'video' ? video : overlay, addEventListener() {} };
  const window = { sessionStorage: { getItem: k => store[k] || null, setItem: (k, v) => store[k] = v } };
  const ctx = { window, document, setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimeout: id => { if (timers[id - 1]) timers[id - 1].cleared = true; } };
  vm.runInNewContext(fs.readFileSync('public/intro.js', 'utf8'), ctx);
  return { ctx, video, overlay, body, timers, events, attrs, removed: () => removed, store };
}
t('plays muted inline once per session; ended removes overlay and clears timers', () => {
  const e = env(false); assert.equal(e.body.children.length, 1); assert.equal(e.video.muted, true); assert.equal(e.video.playsInline, true);
  assert.ok(e.attrs.playsinline && e.attrs.muted && !e.attrs.controls); assert.equal(e.video.src, 'intro.mp4');
  e.events.ended(); assert.equal(e.overlay.style.opacity, '0'); assert.ok(e.timers.slice(0, 2).every(x => x.cleared));
  e.timers[2].f(); assert.ok(e.removed()); assert.equal(e.store.lt_intro_seen, '1');
  assert.equal(env(true).body.children.length, 0); // same tab session / re-entry: no replay
});
t('error, autoplay rejection, stall and hard timeout never trap the user', () => {
  let e = env(false); e.events.error(); assert.equal(e.overlay.style.opacity, '0');
  e = env(false); e.video.reject(new Error('NotAllowed')); assert.equal(e.overlay.style.opacity, '0');
  e = env(false); e.timers.find(x => x.ms === 2500).f(); assert.equal(e.overlay.style.opacity, '0');
  e = env(false); e.video.currentTime = 1; e.timers.find(x => x.ms === 2500).f(); assert.notEqual(e.overlay.style.opacity, '0'); e.timers.find(x => x.ms === 6000).f(); assert.equal(e.overlay.style.opacity, '0');
});
console.log(n + ' intro tests passed');
