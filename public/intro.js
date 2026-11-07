// 3 s intro video on first page load of each browser tab session. No buttons; plays then opens the app.
// Technical fallbacks only (error, autoplay rejected, stall): the overlay never traps the user.
(function (w, d) {
  const KEY = 'lt_intro_seen', HARD_MS = 6000, START_MS = 2500;
  function run() {
    try { if (w.sessionStorage.getItem(KEY)) return null; w.sessionStorage.setItem(KEY, '1'); } catch (e) {}
    const o = d.createElement('div'); o.id = 'intro'; o.setAttribute('aria-hidden', 'true');
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;align-items:center;justify-content:center;transition:opacity .25s';
    const v = d.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.autoplay = true; v.preload = 'auto';
    for (const a of ['muted', 'playsinline', 'webkit-playsinline', 'autoplay', 'disablepictureinpicture']) v.setAttribute(a, '');
    v.poster = 'intro-poster.jpg'; v.src = 'intro.mp4';
    v.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none';
    o.appendChild(v); d.body.appendChild(o);
    let done = false; const timers = [];
    function finish() { if (done) return; done = true; timers.forEach(clearTimeout); try { v.pause(); } catch (e) {} o.style.opacity = '0'; setTimeout(() => { o.remove(); }, 260); }
    v.addEventListener('ended', finish); v.addEventListener('error', finish);
    timers.push(setTimeout(finish, HARD_MS));
    timers.push(setTimeout(() => { if (v.currentTime === 0) finish(); }, START_MS)); // never started (stall / blocked)
    const p = v.play && v.play(); if (p && p.catch) p.catch(finish);
    return { overlay: o, video: v, finish };
  }
  w.LTIntro = { run };
  if (d.body) run(); else d.addEventListener('DOMContentLoaded', run);
})(window, document);
