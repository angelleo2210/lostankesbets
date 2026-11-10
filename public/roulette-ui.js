// European single-zero roulette UI (display only; result comes from the server).
window.RouletteUI = (() => {
  const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const STEP = 360 / 37;
  const CHIPS = [100, 500, 1000, 5000, 10000];
  const colorOf = n => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');
  const colorName = c => (c === 'red' ? 'rojo' : c === 'black' ? 'negro' : 'verde');
  const keyOf = b => b.type + ':' + (b.nums && b.nums.length ? b.nums.join(',') : (b.dozen || b.column || ''));
  const idem = () => 'rl_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  function wheelSvg() {
    const r0 = 96, r1 = 62, rN = 79, cx = 100, cy = 100;
    let segs = '', nums = '';
    for (let i = 0; i < 37; i++) {
      const n = WHEEL[i], a0 = (-90 - STEP / 2 + i * STEP) * Math.PI / 180, a1 = a0 + STEP * Math.PI / 180, am = (a0 + a1) / 2;
      const p = (a, r) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
      const fill = n === 0 ? '#0f7a3b' : RED.has(n) ? '#b91c1c' : '#171717';
      segs += `<path d="M${p(a0, r1)} L${p(a0, r0)} A${r0},${r0} 0 0 1 ${p(a1, r0)} L${p(a1, r1)} A${r1},${r1} 0 0 0 ${p(a0, r1)}" fill="${fill}" stroke="#e8d48b" stroke-width=".6"/>`;
      const tx = cx + rN * Math.cos(am), ty = cy + rN * Math.sin(am), rot = i * STEP;
      nums += `<text x="${tx.toFixed(2)}" y="${ty.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rot.toFixed(2)},${tx.toFixed(2)},${ty.toFixed(2)})" fill="#fff" font-size="6.2" font-weight="700" font-family="Oswald,Arial Narrow,sans-serif">${n}</text>`;
    }
    return `<svg class="rl-wheel-svg" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <radialGradient id="rlRim" cx="50%" cy="40%"><stop offset="0" stop-color="#f3e2a7"/><stop offset=".45" stop-color="#c9a227"/><stop offset="1" stop-color="#6b4e10"/></radialGradient>
        <radialGradient id="rlWood" cx="50%" cy="50%"><stop offset="0" stop-color="#5c3310"/><stop offset="1" stop-color="#2a1506"/></radialGradient>
        <radialGradient id="rlCone" cx="40%" cy="35%"><stop offset="0" stop-color="#d4b05a"/><stop offset=".6" stop-color="#8a6a22"/><stop offset="1" stop-color="#3f2c0a"/></radialGradient>
      </defs>
      <circle cx="100" cy="100" r="99.2" fill="url(#rlRim)"/>
      <circle cx="100" cy="100" r="97.2" fill="url(#rlWood)"/>
      <g class="rl-pockets">${segs}${nums}</g>
      <circle cx="100" cy="100" r="61.2" fill="url(#rlWood)" stroke="#e8d48b" stroke-width=".8"/>
      <circle cx="100" cy="100" r="44" fill="url(#rlCone)"/>
      <circle cx="100" cy="100" r="10" fill="#c9a227" stroke="#f3e2a7" stroke-width="1.2"/>
      <circle cx="100" cy="100" r="3.2" fill="#3f2c0a"/>
    </svg>`;
  }

  function tableHtml(esc) {
    const numBtn = n => `<button type="button" class="rl-num rl-${colorOf(n)}" data-bet="straight" data-nums="${n}" aria-label="Pleno ${n}"><span>${n}</span><i class="rl-stack" data-spot="straight:${n}"></i></button>`;
    const split = (a, b) => `<button type="button" class="rl-hit rl-split" data-bet="split" data-nums="${a},${b}" aria-label="Caballo ${a}-${b}"><i class="rl-stack" data-spot="split:${a},${b}"></i></button>`;
    const corner = (a, b, c, d) => `<button type="button" class="rl-hit rl-corner" data-bet="corner" data-nums="${a},${b},${c},${d}" aria-label="Cuadro ${a}"><i class="rl-stack" data-spot="corner:${a},${b},${c},${d}"></i></button>`;
    const street = (a) => `<button type="button" class="rl-hit rl-street" data-bet="street" data-nums="${a},${a+1},${a+2}" aria-label="Transversal ${a}-${a+2}"><i class="rl-stack" data-spot="street:${a},${a+1},${a+2}"></i></button>`;
    const six = (a) => `<button type="button" class="rl-hit rl-six" data-bet="sixline" data-nums="${a},${a+1},${a+2},${a+3},${a+4},${a+5}" aria-label="Línea ${a}-${a+5}"><i class="rl-stack" data-spot="sixline:${a},${a+1},${a+2},${a+3},${a+4},${a+5}"></i></button>`;
    let rows = '';
    for (let r = 0; r < 12; r++) {
      const a = r * 3 + 1, b = a + 1, c = a + 2;
      rows += `<div class="rl-row">${street(a)}${numBtn(a)}${split(a, b)}${numBtn(b)}${split(b, c)}${numBtn(c)}</div>`;
      if (r < 11) {
        rows += `<div class="rl-gap">${six(a)}${split(a, a+3)}${corner(a, b, a+3, b+3)}${split(b, b+3)}${corner(b, c, b+3, c+3)}${split(c, c+3)}</div>`;
      }
    }
    const out = (type, label, extra = '') => `<button type="button" class="rl-out ${extra}" data-bet="${type}" data-nums="" aria-label="${esc(label)}">${label}<i class="rl-stack" data-spot="${type}:"></i></button>`;
    const doz = (d, lab) => `<button type="button" class="rl-out" data-bet="dozen" data-dozen="${d}" data-nums="" aria-label="${lab}"><span>${lab}</span><i class="rl-stack" data-spot="dozen:${d}"></i></button>`;
    const col = (c, lab) => `<button type="button" class="rl-out rl-col" data-bet="column" data-column="${c}" data-nums="" aria-label="${lab}"><span>${lab}</span><i class="rl-stack" data-spot="column:${c}"></i></button>`;
    return `<div class="rl-felt">
      <div class="rl-zero-col">
        <button type="button" class="rl-zero" data-bet="straight" data-nums="0" aria-label="Pleno 0">0<i class="rl-stack" data-spot="straight:0"></i></button>
        <button type="button" class="rl-hit rl-trio" data-bet="trio" data-nums="0,1,2" aria-label="Trío 0-1-2">0-1-2<i class="rl-stack" data-spot="trio:0,1,2"></i></button>
        <button type="button" class="rl-hit rl-trio" data-bet="trio" data-nums="0,2,3" aria-label="Trío 0-2-3">0-2-3<i class="rl-stack" data-spot="trio:0,2,3"></i></button>
        <button type="button" class="rl-hit rl-ff" data-bet="firstfour" data-nums="0,1,2,3" aria-label="Cesta 0-1-2-3">0-1-2-3<i class="rl-stack" data-spot="firstfour:0,1,2,3"></i></button>
      </div>
      <div class="rl-nums">${rows}</div>
      <div class="rl-cols">${col(1, '2:1')}${col(2, '2:1')}${col(3, '2:1')}</div>
      <div class="rl-doz">${doz(1, '1ª 12')}${doz(2, '2ª 12')}${doz(3, '3ª 12')}</div>
      <div class="rl-outs">${out('low', '1–18')}${out('even', 'PAR')}${out('red', 'ROJO', 'rl-dia-red')}${out('black', 'NEGRO', 'rl-dia-black')}${out('odd', 'IMPAR')}${out('high', '19–36')}</div>
    </div>`;
  }

  function chipClass(v) { return v >= 10000 ? 'c10k' : v >= 5000 ? 'c5k' : v >= 1000 ? 'c1k' : v >= 500 ? 'c500' : 'c100'; }

  function snd(mutedRef) {
    let ctx;
    const ok = () => !mutedRef.on && typeof AudioContext !== 'undefined';
    const ctxGet = () => { ctx = ctx || new AudioContext(); return ctx; };
    const tone = (f, d, v, type = 'sine', at = 0) => {
      if (!ok()) return;
      const c = ctxGet(), t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.02);
    };
    return {
      tick: p => tone(420 + p * 80, 0.04, 0.03, 'triangle'),
      lock: () => { tone(180, 0.12, 0.04, 'sine'); tone(260, 0.1, 0.025, 'triangle', 0.05); },
      land: win => { tone(win ? 520 : 220, 0.18, 0.05); if (win) { tone(660, 0.22, 0.04, 'sine', 0.12); tone(880, 0.28, 0.03, 'sine', 0.24); } }
    };
  }

  async function view(B, { api, esc, fmt, flash, me, onBack }) {
    const d = await api('/roulette');
    const limits = d.limits || {};
    let chip = 100, bets = [], lastBets = null, spinning = false, muted = { on: localStorage.rlMute === '1' };
    const sound = snd(muted);
    const total = () => bets.reduce((s, b) => s + b.amount, 0);
    const paintStacks = () => {
      B.querySelectorAll('.rl-stack').forEach(el => { el.innerHTML = ''; el.classList.remove('on', 'win', 'lose'); });
      const map = new Map();
      for (const b of bets) {
        const k = keyOf(b);
        map.set(k, (map.get(k) || 0) + b.amount);
      }
      for (const [k, v] of map) {
        const el = B.querySelector(`.rl-stack[data-spot="${k}"]`);
        if (!el) continue;
        el.classList.add('on');
        el.innerHTML = `<span class="rl-chip ${chipClass(v)}">${fmt(v)}</span>`;
      }
    };
    const setCall = (t, cls = '') => { const el = B.querySelector('#rlCall'); if (el) { el.textContent = t; el.className = 'rl-call ' + cls; } };
    const paintBoard = (board) => {
      const rec = (board && board.recent) || [];
      const strip = B.querySelector('#rlRecent');
      if (strip) strip.innerHTML = rec.map(r => `<span class="rl-pip rl-${r.color}">${r.number}</span>`).join('') || '<span class="small">Sin giros aún</span>';
      const hot = B.querySelector('#rlHot'), cold = B.querySelector('#rlCold');
      if (hot) hot.innerHTML = ((board && board.hot) || []).map(x => `<span class="rl-pip rl-${x.color}">${x.n}</span>`).join('') || '—';
      if (cold) cold.innerHTML = ((board && board.cold) || []).map(x => `<span class="rl-pip rl-${x.color}">${x.n}</span>`).join('') || '—';
    };
    const paintHist = (hist) => {
      const el = B.querySelector('#rlHist');
      if (!el) return;
      el.innerHTML = (hist || []).map(s => {
        const won = s.profit > 0;
        return `<div class="rl-hrow ${won ? 'win' : 'lose'}"><span class="rl-pip rl-${s.color}">${s.number}</span> ${colorName(s.color)} · apostado ${fmt(s.stake)} · ${won ? 'ganaste ' + fmt(s.profit) : 'perdiste ' + fmt(-s.profit)}</div>`;
      }).join('') || '<div class="small">Aún no has girado.</div>';
    };
    const paintTotal = () => { const t = B.querySelector('#rlTotal'); if (t) t.textContent = fmt(total()); const g = B.querySelector('#rlGo'); if (g) g.disabled = spinning || !bets.length; };

    const easeOut = t => 1 - Math.pow(1 - t, 4);
    const animate = (n, ms = 5200) => new Promise(resolve => {
      const wheel = B.querySelector('#rlWheel'), ball = B.querySelector('#rlBall');
      const idx = WHEEL.indexOf(n);
      const wheelEnd = 360 * 5 - idx * STEP;
      const ballRev = -360 * 9;
      const t0 = performance.now();
      let lastTick = 0;
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        const w = wheelEnd * easeOut(t);
        const pocket = idx * STEP + w;
        let bAng;
        if (t < 0.72) bAng = ballRev * easeOut(t / 0.72);
        else {
          const u = (t - 0.72) / 0.28;
          const start = ballRev;
          const bounce = Math.sin(u * Math.PI * 2) * 10 * (1 - u);
          bAng = start + (pocket - start) * easeOut(u) + bounce;
        }
        wheel.style.transform = `rotate(${w}deg)`;
        ball.style.transform = `rotate(${bAng}deg)`;
        if (t - lastTick > 0.045) { sound.tick(t); lastTick = t; }
        if (t < 1) requestAnimationFrame(step); else {
          wheel.style.transform = `rotate(${wheelEnd}deg)`;
          ball.style.transform = `rotate(${wheelEnd + idx * STEP}deg)`;
          ball.classList.add('in-pocket');
          resolve();
        }
      };
      ball.classList.remove('in-pocket');
      requestAnimationFrame(step);
    });

    B.innerHTML = `<div class="card rl-page">
      <button type="button" class="alt" id="toRetos">← Retos</button>
      <h2>Roulette europea · un solo cero</h2>
      <p class="small">Ruleta de un cero (0–36). Las apuestas se cobran al girar, con tu saldo de monedas. No cuenta en la tabla de apuestas deportivas.</p>
      <div class="rl-marquee">
        <div class="rl-board-lab">Últimos</div><div id="rlRecent" class="rl-pips"></div>
        <div class="rl-hc"><span>Calientes</span><div id="rlHot" class="rl-pips"></div></div>
        <div class="rl-hc"><span>Fríos</span><div id="rlCold" class="rl-pips"></div></div>
      </div>
      <div class="rl-stage">
        <div class="rl-call" id="rlCall">Hagan sus apuestas</div>
        <div class="rl-wheel-wrap">
          <div class="rl-pointer" aria-hidden="true"></div>
          <div id="rlWheel" class="rl-wheel">${wheelSvg()}</div>
          <div id="rlBall" class="rl-ball-track"><span class="rl-ball"></span></div>
        </div>
        <button type="button" class="alt rl-mute" id="rlMute" aria-pressed="${muted.on}">${muted.on ? 'Sonido: off' : 'Sonido: on'}</button>
      </div>
      ${tableHtml(esc)}
      <div class="rl-tray">
        <div class="rl-chips">${CHIPS.map(v => `<button type="button" class="rl-chip ${chipClass(v)}${v === chip ? ' sel' : ''}" data-chip="${v}">${fmt(v)}</button>`).join('')}</div>
        <div class="rl-actions">
          <button type="button" class="alt" id="rlUndo">Deshacer</button>
          <button type="button" class="alt" id="rlClear">Borrar</button>
          <button type="button" class="alt" id="rlRepeat">Repetir apuesta</button>
        </div>
        <div class="rl-sum">Total apostado: <b id="rlTotal">0</b> · Saldo <b id="rlCoins">${fmt(d.coins ?? me.coins)}</b></div>
        <button type="button" id="rlGo" disabled>Girar</button>
        <div id="rlResult" class="rl-result" hidden></div>
      </div>
      <div class="card"><h3>Tus giros</h3><div id="rlHist"></div></div>
      <p class="small">Mín. ${fmt(limits.minBet || 100)} por ficha · máx. ${fmt(limits.maxBet || 25000)} por apuesta · máx. ${fmt(limits.maxSpin || 50000)} por giro. 0 verde: las apuestas pares (rojo/negro, par/impar, 1–18/19–36) pierden.</p>
    </div>`;

    paintBoard(d.board); paintHist(d.history); paintTotal();
    B.querySelector('#toRetos').onclick = onBack;
    B.querySelector('#rlMute').onclick = ev => {
      muted.on = !muted.on; localStorage.rlMute = muted.on ? '1' : '0';
      ev.currentTarget.textContent = muted.on ? 'Sonido: off' : 'Sonido: on';
      ev.currentTarget.setAttribute('aria-pressed', muted.on);
    };
    B.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => {
      chip = +b.dataset.chip;
      B.querySelectorAll('[data-chip]').forEach(x => x.classList.toggle('sel', +x.dataset.chip === chip));
    });
    const placeFrom = btn => {
      if (spinning) return;
      const type = btn.dataset.bet;
      const nums = (btn.dataset.nums || '').split(',').filter(Boolean).map(Number);
      const bet = { type, amount: chip };
      if (nums.length) bet.nums = nums;
      if (btn.dataset.dozen) bet.dozen = +btn.dataset.dozen;
      if (btn.dataset.column) bet.column = +btn.dataset.column;
      bets.push(bet);
      setCall('Hagan sus apuestas');
      paintStacks(); paintTotal();
    };
    B.querySelectorAll('[data-bet]').forEach(btn => btn.onclick = () => placeFrom(btn));
    B.querySelector('#rlUndo').onclick = () => { if (spinning || !bets.length) return; bets.pop(); paintStacks(); paintTotal(); };
    B.querySelector('#rlClear').onclick = () => { if (spinning) return; bets = []; paintStacks(); paintTotal(); };
    B.querySelector('#rlRepeat').onclick = () => { if (spinning || !lastBets) return; bets = lastBets.map(b => ({ ...b })); paintStacks(); paintTotal(); };
    B.querySelector('#rlGo').onclick = async () => {
      if (spinning || !bets.length) return;
      spinning = true; paintTotal();
      setCall('No va más', 'lock'); sound.lock();
      B.querySelector('.rl-felt').classList.add('locked');
      const payload = bets.map(b => ({ ...b }));
      try {
        const r = await api('/roulette/spin', { bets: payload, idem: idem() });
        lastBets = payload;
        await animate(r.number);
        const res = B.querySelector('#rlResult');
        const win = r.profit > 0;
        res.hidden = false;
        res.className = 'rl-result ' + (win ? 'win' : 'lose');
        res.innerHTML = `<b class="rl-pip rl-${r.color}">${r.number}</b> ${colorName(r.color).toUpperCase()} · ${win ? 'Ganaste ' + fmt(r.profit) : 'Sin premio'} · pagado ${fmt(r.payout)}`;
        B.querySelector('#rlCoins').textContent = fmt(r.coins);
        B.querySelectorAll('.rl-num, .rl-zero').forEach(el => el.classList.toggle('dolly', el.dataset.nums === String(r.number) && el.dataset.bet === 'straight'));
        const wonKeys = new Set((r.settled || []).filter(b => b.win).map(keyOf));
        B.querySelectorAll('.rl-stack.on').forEach(el => {
          const k = el.getAttribute('data-spot');
          el.classList.add(wonKeys.has(k) ? 'win' : 'lose');
        });
        sound.land(win);
        setCall(win ? '¡Ganador!' : 'Suerte para la próxima', win ? 'win' : 'lose');
        bets = [];
        const fresh = await api('/roulette');
        paintBoard(fresh.board); paintHist(fresh.history); paintStacks(); paintTotal();
      } catch (e) { flash(e.message); setCall('Hagan sus apuestas'); }
      B.querySelector('.rl-felt').classList.remove('locked');
      spinning = false; paintTotal();
    };
  }

  return { view, WHEEL, RED };
})();
