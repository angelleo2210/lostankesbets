const $ = s => document.querySelector(s); const A = $('#app');
let token = localStorage.token, me = null, tab = 'lineas', boleto = [];
const dec = o => o > 0 ? 1 + o / 100 : 1 + 100 / -o; const toAm = d => d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Number(n).toLocaleString('es-US'); const od = o => (o > 0 ? '+' : '') + o;
const profit = (s, o) => Math.floor(o > 0 ? s * o / 100 : s * 100 / -o);
async function api(p, body) { const r = await fetch('/api' + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-token': token || '' }, body: body && JSON.stringify(body) });
  const d = await r.json(); if (d.error && r.status >= 400) throw new Error(d.error); return d; }
const FH = { ninguno: ['Ninguno', ''], bigote: ['Bigote', '〰'], barba_corta: ['Barba corta', '▁'], barba_larga: ['Barba larga', '▼'], candado: ['Candado', '◡'], perilla: ['Perilla', '▾'], patillas: ['Patillas', '‖'] };
const fhChip = f => f && FH[f.style] ? `<span title="${FH[f.style][0]}" style="display:inline-block;font-size:11px;padding:0 4px;border-radius:6px;background:#334155;color:${/^#[0-9a-f]{6}$/.test(f.color || '') ? f.color : '#e2e8f0'}">${FH[f.style][1]} ${FH[f.style][0]}</span> ` : '';
let RW = [];
const rw = id => RW.find(r => r.id === id);
const head = (u, size = 28) => _avHead(u, size);
const body = (u, size = 64) => _avBody(u, size);
const who = (u, full) => { const c = u.cosmetics || {}, ac = rw(c.accessory), col = rw(c.color);
  return `${head(u, full || 28)} ${u.badge ? u.badge + ' ' : ''}${u.avatar ? esc(u.avatar) : ''}${ac ? ac.icon : ''}${ac || u.avatar ? ' ' : ''}<span style="${col ? `color:${col.color};font-weight:800;text-shadow:0 0 6px ${col.color}88` : ''}">${esc(u.display_name || u.username)}</span>`; };
const EMOJIS = '😎🦁🐯🐺🦅🔥⚡💪🍀🎲🏆⚽🏀🏈⚾🥊🍝🍺🤑👑🚀🐐🦈💀'.match(/\p{Extended_Pictographic}/gu);
function builder(el) { if (el) el.innerHTML = ''; }
const flash = m => { const e = $('#msg'); if (e) e.textContent = m; else alert(m); };
async function start() {
  if (token) try { me = await api('/me'); return render(); } catch { token = null; localStorage.removeItem('token'); }
  const st = await api('/status'); const code = new URLSearchParams(location.search).get('invitacion') || '';
  const mode = !st.hasAdmin ? 'setup' : code ? 'register' : 'login';
  A.innerHTML = `<h1>🎲 LosTankesBets</h1><p class="small">Solo monedas ficticias. Sin dinero real.</p><div class="card">
  <h2>${mode === 'setup' ? 'Crear administrador' : mode === 'register' ? 'Unirte con invitación' : 'Entrar'}</h2>
  ${mode === 'register' ? `<input id="code" placeholder="Código de invitación" value="${esc(code)}">` : ''}
  <input id="u" placeholder="Usuario" autocapitalize="none"><input id="p" type="password" placeholder="PIN (mín. 4)" inputmode="numeric">
  ${mode === 'register' ? `<details open><summary class="small">🎨 Elige tu avatar (opcional)</summary><div class="av-pick" id="rpick">${Avatar.PICKS.map(n => `<button type="button" class="av-opt" data-rp="${n}">${Avatar.imgTag(n,{w:72,h:96,cls:'av3dc'})}<span>${n}</span></button>`).join('')}</div></details>` : ''}
  <button id="go">${mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
  ${mode === 'login' ? '<p class="small">¿Tienes invitación? Abre el link que te mandaron.</p>' : ''}<p id="msg" class="err"></p></div>`;
  const rcfg = { ...Avatar.DEFAULT }; let touched = false;
  document.querySelectorAll('[data-rp]').forEach(b => b.onclick = () => { rcfg.pick = +b.dataset.rp; touched = true; document.querySelectorAll('[data-rp]').forEach(x => x.classList.toggle('on', +x.dataset.rp === rcfg.pick)); });
  $('#go').onclick = async () => { try { const b = { username: $('#u').value, pin: $('#p').value, code: $('#code')?.value, ...(touched ? { avatarCfg: rcfg } : {}) };
    const d = await api(mode === 'setup' ? '/setup' : mode === 'register' ? '/register' : '/login', b);
    token = localStorage.token = d.token; history.replaceState(null, '', '/'); start(); } catch (e) { flash(e.message); } };
}
async function render() { clearInterval(chatT); clearInterval(tcTimer); clearInterval(tcBarT);
  if (tab === 'tienda') tab = 'lineas';
  me = await api('/me'); if (!RW.length) RW = await api('/rewards').catch(() => []);
  const tabs = [['lineas', 'Líneas'], ['reales', 'Reales'], ['mias', 'Mis apuestas'], ['tabla', 'Tabla'], ['juegos', 'Retos' + (me.retosPend ? ` (${me.retosPend})` : '')], ['perfil', 'Mi perfil']].concat(me.is_admin ? [['admin', 'Admin']] : []);
  A.innerHTML = `${coverBanner(me)}<nav>${tabs.map(([k, v]) => `<button class="${k === tab ? '' : 'alt'}" data-t="${k}">${v}</button>`).join('')}</nav>
  <div id="bono" class="bono"></div><p id="msg" class="err"></p><div id="body"></div><button class="alt" id="out">Salir</button>`;
  A.querySelectorAll('nav button').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
  $('#out').onclick = () => { localStorage.removeItem('token'); token = null; start(); };
  const B = $('#body'); bonusBar();
  try {
  if (tab === 'lineas') { const ls = await api('/lines');
    B.innerHTML = boletoCard() + (ls.length ? ls.map(lineCard).join('') : '<div class="card">No hay líneas abiertas.</div>'); bindBets(ls); }
  if (tab === 'reales') { const d = await api('/real'); const ls = (await api('/lines')).filter(l => l.kind === 'real');
    B.innerHTML = boletoCard() + (d.error ? `<div class="card">${esc(d.error)}</div>` : '') + (ls.length ? ls.map(lineCard).join('') : '<div class="card">El administrador aún no ha agregado líneas reales.</div>') +
      (me.is_admin && d.events ? `<div class="card"><h2>Importar evento real (admin)</h2>${d.events.slice(0, 30).map(e => `<div class="card"><b>${esc(e.sport)}: ${esc(e.title)}</b><div class="small">${new Date(e.starts).toLocaleString('es-US')} · ${esc(e.bookmaker)}</div>${e.options.map(o => `${esc(o.label)} ${od(o.odds)}`).join(' · ')}<button class="alt" data-imp="${esc(e.id)}">Agregar</button></div>`).join('')}</div>` : '');
    bindBets(ls); B.querySelectorAll('[data-imp]').forEach(b => b.onclick = async () => { try { const r = await api('/admin/import', { eventId: b.dataset.imp }); if (r.error) throw new Error(r.error); render(); } catch (e) { flash(e.message); } }); }
  if (tab === 'mias') { const st = { open: 'Abierta', won: '<b>✅ ¡Ganaste!</b>', lost: '<b>❌ Perdiste</b>', refunded: 'Devuelta' };
    B.innerHTML = me.bets.length ? me.bets.map(b => `<div class="card bet-${b.status}">${head(me, 22)} <b>${esc(b.title)}</b><div>${esc(b.label)} ${od(b.odds)} · apostado ${fmt(b.stake)}</div><div class="small">${st[b.status]}${b.status === 'open' ? ' · gana ' + fmt(b.stake + profit(b.stake, b.odds)) : b.payout ? ' · cobrado ' + fmt(b.payout) : ''}</div></div>`).join('') : '<div class="card">Aún no tienes apuestas.</div>';
    const pst = { ...st, open: 'Abierto' , won: '<b>✅ ¡Ganaste!</b>', lost: '<b>❌ Perdiste</b>', refunded: 'Devuelto' }, gst = { open: '⏳', won: '✅', lost: '❌', cancelled: '🚫' };
    B.innerHTML = (me.parlays || []).map(p => `<div class="card bet-${p.status}">${head(me, 22)} <b>🎟️ Parlay de ${p.legs.length}</b> ${p.odds ? od(p.odds) : ''} · apostado ${fmt(p.stake)}${p.legs.map(g => `<div class="small">${gst[g.status] || ''} ${esc(g.title)}: ${esc(g.label)} ${od(g.odds)}</div>`).join('')}<div class="small">${pst[p.status]}${p.status === 'open' ? ' · gana ' + fmt(p.potential) : p.payout ? ' · cobrado ' + fmt(p.payout) : ''}</div></div>`).join('') + B.innerHTML; }
  if (tab === 'tabla') { const t = await api('/leaderboard'), byCoins = tablaMode === 'monedas', rows = byCoins ? [...t].sort((a, b) => b.coins - a.coins) : t;
    B.innerHTML = `<div class="chips depts"><button class="chip ${byCoins ? 'alt' : 'on'}" data-tm="ganadas">🏆 Apuestas ganadas</button><button class="chip ${byCoins ? 'on' : 'alt'}" data-tm="monedas">🪙 Monedas</button></div><div class="card">${rows.map((u, i) => `<div class="opt"><span>${i + 1}. ${who(u)}${u.display_name ? ` <span class="small">@${esc(u.username)}</span>` : ''}${byCoins ? '' : ' ' + streakTag(u.streak)}</span><b>${byCoins ? `🪙 ${fmt(u.coins)}` : `🏆 ${u.wins} <span class="small">· 🪙 ${fmt(u.coins)}</span>`}</b></div>`).join('')}</div><div class="small">${byCoins ? 'Saldo actual de cada jugador.' : 'Ranking principal: apuestas ganadas (un parlay ganado cuenta 1). Empate: más monedas.'}</div>`;
    B.querySelectorAll('[data-tm]').forEach(b => b.onclick = () => { tablaMode = b.dataset.tm; render(); }); }
  const stP = tab === 'perfil' ? await api('/owned') : null;
  if (tab === 'perfil') { let av = me.avatar || '', cos = { ...(me.cosmetics || {}) }, acfg = Avatar.norm(me.avatarCfg); const mine = new Set((me.unlocks || []).map(u => u.item_id));
    B.innerHTML = `<div class="card"><h2>Mi perfil</h2><div class="small">Usuario: @${esc(me.username)}</div>${streakTag(me.streak, true)}
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin:8px 0">${EMOJIS.map(e => `<button class="${e === av ? '' : 'alt'}" style="width:44px;padding:6px" data-em="${e}">${e}</button>`).join('')}<button class="alt" style="width:auto;padding:6px" data-em="">Sin emoji</button></div>
    <h2>Tu avatar</h2><div class="small">Elige uno de los 9. Sin colores ni accesorios.</div>
    <div class="av-pick" id="avpick">${Avatar.PICKS.map(n => `<button type="button" class="av-opt ${acfg.pick === n ? 'on' : ''}" data-pick="${n}">${Avatar.imgTag(n, { w: 90, h: 120, cls: 'av3dc' })}<span>${n}</span></button>`).join('')}</div>
    <div class="card avpv" id="bigpv" aria-label="Vista previa">${_avBody({ avatarCfg: acfg }, 220)}</div>
    <h2>Mi imagen de perfil</h2><div id="combo">${composite({ ...me, avatarCfg: acfg }, stP.owned)}</div>
    <h2>Recompensas top 3 ${me.badge || ''}</h2><div class="small">Quedar en el top 3 (con más de 50.000) desbloquea ítems junto al nombre. La medalla solo mientras sigues arriba.</div>
    ${[['color', 'Colores metálicos (nombre)'], ['accessory', 'Accesorios junto al nombre']].map(([k, n]) => `<div class="small" style="margin-top:6px">${n}</div><div style="display:flex;flex-wrap:wrap;gap:4px">${RW.filter(r => r.kind === k).map(r => { const ok = mine.has(r.id);
      return `<button class="${cos[k] === r.id ? '' : 'alt'}" style="width:auto;padding:6px;${ok ? '' : 'opacity:.45'}" ${ok ? `data-cos="${k}:${r.id}"` : 'disabled'} title="${esc(r.name)}">${ok ? '' : '🔒'}${r.icon || `<span style="color:${r.color}">●</span>`} <span class="small">top ${r.minRank}</span></button>`; }).join('')}<button class="alt" style="width:auto;padding:6px" data-cos="${k}:">Nada</button></div>`).join('')}
    <div class="card">Vista previa: <span id="pv"></span></div>
    <input id="dn" maxlength="20" placeholder="Nombre para mostrar (opcional)" value="${esc(me.display_name || '')}"><button id="sv">Guardar</button></div>`;
    const pv = () => { const dn = $('#dn'), pve = $('#pv'), big = $('#bigpv'), combo = $('#combo'); if (!dn || !pve || !big || !combo) return;
      const u = { username: me.username, badge: me.badge, cosmetics: cos, avatar: av, avatarCfg: acfg, display_name: dn.value.trim() };
      pve.innerHTML = who(u); big.innerHTML = _avBody(u, 220); combo.innerHTML = composite(u, stP.owned); }; pv();
    B.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { acfg = { pick: +b.dataset.pick }; B.querySelectorAll('[data-pick]').forEach(x => x.classList.toggle('on', +x.dataset.pick === acfg.pick)); pv(); });
    const dne = $('#dn'); if (dne) dne.oninput = dne.onchange = pv;
    B.querySelectorAll('[data-cos]').forEach(b => b.onclick = () => { const [k, v] = b.dataset.cos.split(':'); if (v) cos[k] = v; else delete cos[k]; B.querySelectorAll(`[data-cos^="${k}:"]`).forEach(x => x.className = x.dataset.cos === `${k}:${v}` && v ? '' : 'alt'); pv(); });
    B.querySelectorAll('[data-em]').forEach(b => b.onclick = () => { av = b.dataset.em; B.querySelectorAll('[data-em]').forEach(x => x.className = x.dataset.em === av && av ? '' : 'alt'); pv(); });
    const sv = $('#sv'); if (sv) sv.onclick = async () => { try { const dn = $('#dn'); await api('/profile', { avatar: av, display_name: dn ? dn.value : '', facialHair: 'ninguno', cosmetics: cos, avatarCfg: acfg }); render(); } catch (e) { flash(e.message); } }; }
  if (tab === 'juegos') await (gameSel === 'rps' ? gamesView(B) : gameSel === 'pen' ? penView(B) : gameSel === 'bb' ? bbView(B) : gameSel === 'tc' ? tcView(B) : retosMenu(B));
  if (tab === 'admin') await adminView(B);
  } catch (e) { flash(e.message); }
}
function lineCard(l) {
  return `<div class="card"><h2>${esc(l.title)}</h2><div class="small">${l.kind === 'real' ? 'Real' : 'Ficticia'} · ${l.status === 'open' ? 'Abierta' : 'Cerrada a apuestas'}${l.starts ? ' · ' + new Date(l.starts).toLocaleString('es-US') : ''}</div>
  ${l.options.map(o => `<div class="opt"><span>${esc(o.label)} <b>${od(o.odds)}</b></span>${l.status === 'open' ? `<input style="width:110px" type="number" min="1" placeholder="Monto" id="s${o.id}"><button style="width:90px" data-o="${o.id}">Apostar</button><button class="${boleto.some(b => b.id === o.id) ? '' : 'alt'}" style="width:48px" data-add="${o.id}">🎟️</button>` : ''}</div>`).join('')}</div>`;
}
function boletoCard() {
  if (!boleto.length) return '<div class="small">Toca 🎟️ en 2 a 15 líneas distintas para armar un parlay.</div>';
  const d = boleto.reduce((m, b) => m * dec(b.odds), 1), ok = boleto.length >= 2;
  return `<div class="card"><h2>🎟️ Boleto (${boleto.length}/15)</h2><div style="max-height:40vh;overflow-y:auto">${boleto.map(b => `<div class="opt"><span class="small">${esc(b.title)}: <b>${esc(b.label)} ${od(b.odds)}</b></span><button class="alt" style="width:44px" data-rm="${b.id}">✕</button></div>`).join('')}</div>
  <div>Cuota combinada <b>${od(toAm(d))}</b></div><input type="number" min="1" placeholder="Monto" id="ps">
  <div class="small" id="pw">${ok ? 'Escribe un monto' : 'Agrega ' + (2 - boleto.length) + ' más'}</div>
  <div class="row"><button id="pgo" ${ok ? '' : 'disabled style="opacity:.5"'}>Apostar parlay</button><button class="alt" id="pclr">Vaciar</button></div></div>`;
}
function bindBets(ls = []) {
  A.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { const id = Number(b.dataset.add), i = boleto.findIndex(x => x.id === id);
    if (i >= 0) boleto.splice(i, 1); else { const l = ls.find(l => l.options.some(o => o.id === id)), o = l.options.find(o => o.id === id);
      boleto = boleto.filter(x => x.line !== l.id); if (boleto.length >= 15) return flash('Máximo 15 selecciones'); boleto.push({ id, line: l.id, title: l.title, label: o.label, odds: o.odds }); } render(); });
  A.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { boleto = boleto.filter(x => x.id !== Number(b.dataset.rm)); render(); });
  if ($('#pclr')) $('#pclr').onclick = () => { boleto = []; render(); };
  if ($('#ps')) $('#ps').oninput = () => { const s = Math.floor(Number($('#ps').value)); if (boleto.length >= 2) $('#pw').textContent = s > 0 ? 'Ganarías ' + fmt(Math.floor(s * boleto.reduce((m, b) => m * dec(b.odds), 1))) : 'Escribe un monto'; };
  if ($('#pgo')) $('#pgo').onclick = async () => { try { await api('/parlay', { optionIds: boleto.map(b => b.id), stake: Number($('#ps').value) }); boleto = []; tab = 'mias'; render(); } catch (e) { flash(e.message); } };
  A.querySelectorAll('[data-o]').forEach(b => b.onclick = async () => { const s = Number($('#s' + b.dataset.o).value); try { await api('/bet', { optionId: Number(b.dataset.o), stake: s }); render(); } catch (e) { flash(e.message); } }); }
async function adminView(B) {
  const ls = await api('/lines');
  const inv = await api('/admin/invites').catch(() => []); const us = await api('/admin/users').catch(() => []); const tps = await api('/admin/topups').catch(() => []);
  B.innerHTML = `<div class="card"><h2>Nueva línea ficticia</h2><input id="t" placeholder="Ej: Hoy Ángel come espaguetis">
  <div id="opts"></div><button class="alt" id="add">+ Opción</button><button id="create">Crear línea</button></div>
  <div class="card"><h2>Liquidar / cerrar</h2>${ls.map(l => `<div class="card"><b>${esc(l.title)}</b> <span class="small">(${l.status === 'open' ? 'abierta' : 'cerrada'})</span>
   ${l.status === 'open' ? `<button class="alt" data-close="${l.id}">Cerrar apuestas</button>` : ''}
   <select id="w${l.id}">${l.options.map(o => `<option value="${o.id}">${esc(o.label)} ${od(o.odds)}</option>`).join('')}</select>
   <div class="row"><button data-settle="${l.id}">Ganó esta</button><button class="red" data-cancel="${l.id}">Cancelar y devolver</button></div></div>`).join('') || 'Nada pendiente.'}</div>
  <div class="card"><h2>Recargar saldo</h2><select id="tu">${us.map(u => `<option value="${u.id}">${esc((u.avatar ? u.avatar + ' ' : '') + (u.display_name || u.username))} · 🪙 ${fmt(u.coins)}</option>`).join('')}</select>
   <input id="ta" type="number" min="1" max="10000000" step="1" placeholder="Monto (máx 10.000.000)"><button id="tgo">Recargar</button>
   ${tps.length ? '<div class="small" style="margin-top:6px">Recientes</div>' + tps.map(t => `<div class="small">${esc(new Date(t.created + 'Z').toLocaleString('es-US'))} · ${who(t)} +${fmt(t.amount)} (por ${esc(t.admin)})</div>`).join('') : ''}</div>
  <div class="card"><h2>Invitaciones</h2><button id="inv">Crear invitación</button>${inv.map(i => `<div class="small">${i.used_by ? '✅ usada por ' + who({ ...i, username: i.used_by }) : `<a style="color:#93c5fd" href="/?invitacion=${i.code}">${location.origin}/?invitacion=${i.code}</a>`}</div>`).join('')}</div>`;
  const addOpt = (l = '', o = '') => { const d = document.createElement('div'); d.className = 'row'; d.innerHTML = `<input placeholder="Opción" value="${l}"><input placeholder="Cuota (-250 / +880)" value="${o}">`; $('#opts').append(d); };
  addOpt('Sí', '-250'); addOpt('No', '+880'); $('#add').onclick = () => addOpt();
  const act = (sel, fn) => B.querySelectorAll(sel).forEach(b => b.onclick = async () => { try { await fn(b); render(); } catch (e) { flash(e.message); } });
  act('#create', () => api('/admin/lines', { title: $('#t').value, options: [...$('#opts').children].map(r => ({ label: r.children[0].value, odds: Number(r.children[1].value) })) }));
  act('[data-close]', b => api(`/admin/lines/${b.dataset.close}/close`, {}));
  act('[data-settle]', b => confirm('¿Liquidar esta línea?') && api(`/admin/lines/${b.dataset.settle}/settle`, { optionId: Number($('#w' + b.dataset.settle).value) }));
  act('[data-cancel]', b => confirm('¿Cancelar y devolver monedas?') && api(`/admin/lines/${b.dataset.cancel}/cancel`, {}));
  act('#tgo', () => { const n = Number($('#ta').value); return confirm(`¿Recargar ${fmt(n)} monedas?`) && api('/admin/topup', { userId: Number($('#tu').value), amount: n }); });
  act('#inv', () => api('/admin/invites', {}));
}
start();
let sq = 0;
const SLOTN = { arriba: 'Arriba', abajo: 'Abajo', zapatos: 'Zapatos', medias: 'Medias', cadenas: 'Cadenas', pulseras: 'Pulseras', mochila: 'Mochila', cabeza: 'Gorras y sombreros' };
// Imagen compuesta: avatar con brazos cruzados, el mejor yate detrás (en puerto) y la moto al lado. Se arma con las compras.
const pickOf = u => Avatar.norm(u && u.avatarCfg).pick;
const _avHead = (u, size = 28) => `<span class="av3dw head">${Avatar.imgTag(pickOf(u), { head: true, w: Math.max(48, size * 2), h: Math.max(48, size * 2), cls: 'av3dc' })}</span>`;
const _avBody = (u, size = 160) => `<div class="av3dw body">${Avatar.imgTag(pickOf(u), { w: Math.round(size * 3 / 4), h: size, cls: 'av3dc' })}</div>`;
const SHOW_CATS = new Set(['carros', 'motos', 'barcos', 'aviones', 'casas', 'relojes']);
const SCENE3D = new Set(['moto_scooter','moto_naked','moto_pista','jet_basico','jet_turbo','jet_pro','yate_lancha','yate_velero','yate_catamaran','yate_blanco','yate_mega']);
const propThumb = (id, color) => SCENE3D.has(id) ? `img/av3d/scenes/${id}.webp` : Store.img(id, color);
const coverBanner = (u) => {
  const nm = esc(u.display_name || u.username);
  return `<section class="cover" aria-label="Portada">
    <img class="cover-bg" src="img/av3d/scenes/cover_bg.webp" alt="">
    <div class="cover-shade"></div>
    <div class="cover-row">
      <div class="cover-av">${Avatar.imgTag(pickOf(u), { w: 180, h: 240, cls: 'av3dc oncover' })}</div>
      <div class="cover-meta">
        <div class="cover-hello">Hola,</div>
        <div class="cover-name">${u.badge ? u.badge + ' ' : ''}${nm}</div>
        <div class="cover-coins">🪙 ${fmt(u.coins)}</div>
      </div>
    </div>
  </section>`;
};

const composite = (u, owned) => {
  const props = owned.map(o => ({ ...o, it: Store.byId(o.item_id) })).filter(o => o.it && SHOW_CATS.has(o.it.cat))
    .sort((a, b) => b.it.price - a.it.price).slice(0, 4);
  const thumbs = props.map(o => `<img class="combo-prop" src="${propThumb(o.item_id, o.color)}" alt="${esc(o.it.name)}" title="${esc(o.it.name)}">`).join('');
  return `<div class="combo3d static"><div class="combo-av">${Avatar.imgTag(pickOf(u), { w: 220, h: 293, cls: 'av3dc' })}</div><div class="combo-props">${thumbs || '<span class="small">Sin vehículos aún</span>'}</div></div>`;
};
const FIRE = (z, u = 'fx' + (++sq)) => `<svg width="${z}" height="${z}" viewBox="0 0 24 24" style="vertical-align:middle" aria-hidden="true"><defs><radialGradient id="${u}a" cx=".5" cy=".75" r=".7"><stop offset="0" stop-color="#fde047"/><stop offset=".45" stop-color="#fb923c"/><stop offset="1" stop-color="#dc2626"/></radialGradient><radialGradient id="${u}b" cx=".5" cy=".7" r=".6"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#fef08a"/><stop offset="1" stop-color="#f59e0b"/></radialGradient></defs><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="url(#${u}a)"/><path d="M12 11c.5 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 1.5-3.5.3 1 .8 1.4 1.3 1.4 0-1.3-.4-2.2.2-3.4z" fill="url(#${u}b)"/><ellipse cx="9.5" cy="12" rx="1" ry="2" fill="#fff" opacity=".45"/></svg>`;
const ICE = z => `<svg width="${z}" height="${z}" viewBox="0 0 24 24" style="vertical-align:middle" aria-hidden="true"><g stroke="#bae6fd" stroke-width="2" stroke-linecap="round" fill="none">${[0, 60, 120].map(a => `<g transform="rotate(${a} 12 12)"><path d="M12 2v20"/><path d="M9 4.5l3 2.5 3-2.5M9 19.5l3-2.5 3 2.5"/></g>`).join('')}</g><circle cx="12" cy="12" r="2.2" fill="#e0f2fe"/><circle cx="11.3" cy="11.3" r=".7" fill="#fff"/></svg>`;
const streakTag = (st, big) => { if (!st) return ''; const I = st.n >= 6, z = big ? 30 : 16;
  if (st.kind === 'fuego') return `<span class="stk fire ${I ? 'intense' : ''} ${big ? 'big' : ''}">${I ? FIRE(z + 4) + FIRE(z) : FIRE(z)} ${I ? (big ? 'Imparable · ' : 'Imparable ') : big ? 'En llamas · ' : ''}${I && !big ? 'x' + st.n : 'En racha x' + st.n}</span>`;
  return `<span class="stk ice ${I ? 'intense' : ''} ${big ? 'big' : ''}">${I ? ICE(z + 4) + ICE(z) : ICE(z)} ${I ? (big ? 'Congelado · ' : 'Congelado ') : big ? 'Frío · ' : ''}${I && !big ? 'x' + st.n : 'Frío x' + st.n}</span>`; };
let tablaMode = 'ganadas', bonoT;
async function bonusBar() { const el = $('#bono'); if (!el) return; const b = await api('/bonus').catch(() => null); if (!b) return; clearInterval(bonoT);
  const paint = () => { const left = b.nextAt ? b.nextAt - Date.now() : 0;
    el.innerHTML = left <= 0 ? `<button id="bonob">🎁 Reclamar bono diario +${fmt(b.amount)}</button>` : `<span class="small">🎁 Próximo bono en ${Math.floor(left / 3600000)} h ${Math.floor(left % 3600000 / 60000)} min</span>`;
    const bt = $('#bonob'); if (bt) bt.onclick = async () => { try { const r = await api('/bonus', {}); flash(r.claimed ? `+${fmt(r.amount)} monedas 🎉` : 'Ya lo reclamaste hoy'); render(); } catch (e) { flash(e.message); } }; };
  paint(); bonoT = setInterval(paint, 30000); }
// ---- Juegos: Piedra, Papel o Tijera ----
let rpsScreen = null, gameSel = null, penScreen = null, bbScreen = null, chatT;
// ---- Mensajes dentro del reto (se borran al terminar) ----
const NYT = t => new Date(t).toLocaleTimeString('es', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' });
const chatBox = (k, id) => `<div class="chat" data-ck="${k}" data-ci="${id}"><div class="small">💬 Mensajes con tu rival · <i>Los mensajes se borran al terminar el reto</i></div><div class="chat-l"></div><div class="row"><input class="chat-i" maxlength="140" placeholder="Escribe (máx. 140)"><button class="chat-s" style="flex:0 0 80px">Enviar</button></div></div>`;
function mountChat() { const el = document.querySelector('.chat'); if (!el) return; const path = `/chat/${el.dataset.ck}/${el.dataset.ci}`, L = el.querySelector('.chat-l');
  const load = async () => { try { const ms = await api(path); L.innerHTML = ms.map(m => `<div class="msg ${m.mine ? 'me' : ''}"><b>${m.name}</b> <span class="small">${NYT(m.at)} ET</span><div>${m.text}</div></div>`).join('') || '<div class="small">Aún no hay mensajes</div>'; L.scrollTop = 1e9; } catch (e) { clearInterval(chatT); L.innerHTML = `<div class="small">${esc(e.message)}</div>`; } };
  const send = async () => { const i = el.querySelector('.chat-i'), t = i.value.trim(); if (!t) return; try { await api(path, { text: t }); i.value = ''; load(); } catch (e) { flash(e.message); } };
  el.querySelector('.chat-s').onclick = send; el.querySelector('.chat-i').onkeydown = e => { if (e.key === 'Enter') send(); };
  load(); clearInterval(chatT); chatT = setInterval(() => { if (!document.body.contains(el)) return clearInterval(chatT); load(); }, 3000); }
// ---- Reproductor de animaciones (con Saltar y prefers-reduced-motion) ----
const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const CONF = () => `<div class="confeti">${Array.from({ length: 26 }, (_, i) => `<i style="left:${(i * 37) % 100}%;background:${['#22c55e', '#facc15', '#38bdf8', '#f472b6', '#fb923c'][i % 5]};animation-delay:${(i % 7) * 60}ms"></i>`).join('')}</div>`;
function playSeq(B, title, steps, done) { let i = 0, t, over = false; const summary = steps.map(s => `<div class="opt ${s.ok ? 'won' : 'lost'}"><span class="small">${s.text}</span></div>`).join('');
  const end = () => { if (over) return; over = true; clearTimeout(t); B.innerHTML = `<div class="card"><h2>${title}</h2>${summary}<button id="anok">Continuar</button></div>`; $('#anok').onclick = done; };
  if (REDUCED()) return end();
  const show = () => { if (over) return; if (i >= steps.length) return end(); const s = steps[i++];
    B.innerHTML = `<div class="card anim"><h2>${title}</h2><div class="stage">${s.svg}<div class="anlbl ${s.ok ? 'won' : 'lost'}" style="animation-delay:${s.lblAt || 0}ms">${s.label}</div>${s.ok && s.confetti ? CONF() : ''}</div><div class="small">${s.text}</div>${s.extra || ''}<button class="alt" id="ansk">Saltar ⏭</button></div>`;
    $('#ansk').onclick = end; t = setTimeout(show, s.ms); };
  show(); }
const PX = { izquierda: 70, centro: 150, derecha: 230 };
const penStep = (shot, save, goal, who, rivalShoots) => { const bx = PX[shot], kx = PX[save] - 150, by = goal ? 62 : 70;
  return { ms: 2300, lblAt: 1250, ok: rivalShoots ? !goal : goal, confetti: true, label: goal ? '¡GOOOL!' : '¡ATAJADA!', text: `${who}: ${ZN[shot]} · atajada a la ${ZN[save].toLowerCase()} → ${goal ? '⚽ Gol' : '🧤 Atajada'}`,
    svg: `<svg viewBox="0 0 300 200" class="pen-an" style="--bx:${bx - 150}px;--by:${by - 175}px;--kx:${kx}px;--kr:${kx < 0 ? -70 : kx > 0 ? 70 : 0}deg;--kb:${goal ? 1 : 0}"><defs><linearGradient id="pgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4ade80"/><stop offset="1" stop-color="#166534"/></linearGradient><pattern id="pnet" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 0L10 10M10 0L0 10" stroke="#fff" stroke-opacity=".3"/></pattern><radialGradient id="pbl" cx=".35" cy=".35"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#cbd5e1"/></radialGradient></defs>
      <rect width="300" height="200" fill="url(#pgr)"/><rect x="30" y="25" width="240" height="85" fill="url(#pnet)" stroke="#f8fafc" stroke-width="7" stroke-linejoin="round"/><path d="M0 112H300" stroke="#fff" stroke-width="3"/><ellipse cx="150" cy="178" rx="6" ry="2" fill="#fff"/>
      <g class="keeper"><g transform="translate(150,72)"><circle r="10" cy="-24" fill="#fcd34d"/><rect x="-14" y="-14" width="28" height="36" rx="10" fill="#f97316"/><path d="M-14 -8L-30 -22M14 -8L30 -22" stroke="#f97316" stroke-width="8" stroke-linecap="round"/><circle cx="-31" cy="-23" r="5" fill="#fff"/><circle cx="31" cy="-23" r="5" fill="#fff"/></g></g>
      <g class="kicker"><g transform="translate(118,190)"><circle r="8" cy="-34" fill="#c68642"/><rect x="-9" y="-26" width="18" height="22" rx="6" fill="#2563eb"/><path d="M-4 -4L-8 8M4 -4L10 6" stroke="#1e3a8a" stroke-width="6" stroke-linecap="round"/></g></g>
      <g class="ball"><g transform="translate(150,175)"><circle r="8" fill="url(#pbl)" stroke="#111" stroke-width="1.5"/><path d="M-3-2l3-2.5 3 2.5-1 3.5h-4z" fill="#111"/></g></g></svg>` }; };
// ---- Three Contest ----
let tcScreen = null, tcTimer, tcBarT;
const TCX = [[38, 150], [150, 52], [262, 150]]; // esquina izq., centro, esquina der. (orden fijo)
const COURT = (pos, w = 300, names, shot) => `<svg viewBox="0 0 300 220" width="${w}" style="max-width:100%" class="tc-court ${shot ? 'shoot ' + (shot.made ? 'in' : 'out') : ''}"><defs><linearGradient id="tcw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7b77a"/><stop offset="1" stop-color="#b9824a"/></linearGradient><radialGradient id="tcb" cx=".35" cy=".35"><stop offset="0" stop-color="#fdba74"/><stop offset="1" stop-color="#c2410c"/></radialGradient></defs>
  <rect width="300" height="220" rx="14" fill="url(#tcw)"/><path d="M20 220 V170 A135 135 0 0 1 280 170 V220" fill="none" stroke="#fff" stroke-width="3"/><rect x="110" y="150" width="80" height="70" fill="#c2410c55" stroke="#fff" stroke-width="2"/>
  <rect x="125" y="196" width="50" height="4" fill="#fff"/><circle cx="150" cy="190" r="9" fill="none" stroke="#ef4444" stroke-width="3"/>
  ${TCX.map(([x, y], i) => `<g class="${i === pos ? 'act' : ''}"><circle cx="${x}" cy="${y}" r="14" fill="${i === pos ? '#16a34a' : '#0f172acc'}" stroke="#fff" stroke-width="2"/><text x="${x}" y="${y + 5}" text-anchor="middle" fill="#fff" font-size="14" font-weight="800">${i + 1}</text>${names ? `<text x="${x}" y="${y - 20}" text-anchor="middle" fill="#0f172a" font-size="10" font-weight="700">${names[i]}</text>` : ''}</g>`).join('')}
  ${pos >= 0 ? `<g class="tc-pl" style="transform:translate(${TCX[pos][0]}px,${TCX[pos][1] + 30}px)"><circle r="7" cy="-26" fill="#c68642"/><rect x="-8" y="-19" width="16" height="20" rx="6" fill="#2563eb"/><text y="-6" text-anchor="middle" fill="#fff" font-size="8" font-weight="800">23</text></g>
    <g class="tc-ball" style="--sx:${TCX[pos][0]}px;--sy:${TCX[pos][1] + 2}px;--mx:${(TCX[pos][0] + 150) / 2}px"><circle r="6" fill="url(#tcb)" stroke="#431407" stroke-width="1"/></g>` : ''}</svg>`;
// Escena pseudo-3D (SVG + CSS, sin librerías): tablero, aro en perspectiva, red, jugador y balón.
const SCENE = (pos, from = pos) => { const cam = [60, 0, -60], av = (typeof me !== 'undefined' && me && me.avatarCfg) || {}, skin = av.skin || '#c68642';
  return `<svg viewBox="0 0 300 230" class="tc-scene" style="--cam0:${cam[from]}px;--cam1:${cam[pos]}px"><defs><linearGradient id="tfl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9a066"/><stop offset="1" stop-color="#a9713e"/></linearGradient><linearGradient id="tbd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient><radialGradient id="tbl2" cx=".35" cy=".3"><stop offset="0" stop-color="#fdba74"/><stop offset=".7" stop-color="#ea580c"/><stop offset="1" stop-color="#9a3412"/></radialGradient><linearGradient id="tsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#334155"/></linearGradient></defs>
  <rect width="300" height="230" fill="url(#tsky)"/><g class="tc-cam"><path d="M-80 230 L70 92 H230 L380 230 Z" fill="url(#tfl)"/><path d="M-20 230 Q150 60 320 230" fill="none" stroke="#fff" stroke-width="3" opacity=".9"/><path d="M110 92 L95 140 H205 L190 92" fill="#c2410c55" stroke="#fff" stroke-width="2"/>
    ${[[-10, 210], [150, 168], [310, 210]].map(([x, y], i) => `<g opacity="${i === pos ? 1 : .55}"><ellipse cx="${x}" cy="${y}" rx="16" ry="5" fill="${i === pos ? '#16a34a' : '#0f172a'}"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">${i + 1}</text></g>`).join('')}</g>
  <rect x="146" y="30" width="8" height="64" fill="#475569"/><g class="tc-board"><rect x="112" y="14" width="76" height="46" rx="3" fill="url(#tbd)" stroke="#94a3b8" stroke-width="2" opacity=".95"/><rect x="136" y="32" width="28" height="20" fill="none" stroke="#ef4444" stroke-width="2"/></g>
  <g class="tc-net"><path d="M138 62 L142 82 L158 82 L162 62 M144 62 L147 82 M150 62 V82 M156 62 L153 82 M140 70 H160 M142 77 H158" stroke="#f1f5f9" stroke-width="1.2" fill="none"/></g>
  <ellipse cx="150" cy="62" rx="13" ry="3.5" fill="none" stroke="#ea580c" stroke-width="2.5" class="tc-rim"/>
  <ellipse class="tc-shadow" cx="150" cy="214" rx="10" ry="3" fill="#0006"/>
  <g class="tc-player"><g class="tc-body"><rect x="138" y="178" width="24" height="30" rx="9" fill="#2563eb"/><text x="150" y="198" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">23</text><circle cx="150" cy="170" r="9" fill="${skin}"/><path d="M140 182 L132 166 M160 182 L168 166" stroke="${skin}" stroke-width="5" stroke-linecap="round" class="tc-arms"/><path d="M143 207 L141 224 M157 207 L159 224" stroke="#1e3a8a" stroke-width="6" stroke-linecap="round" class="tc-legs"/></g></g>
  <g class="tc-ball2" transform="translate(150,162)"><g class="tc-spin"><circle r="8" fill="url(#tbl2)"/><path d="M-8 0H8M0-8V8M-5.6-5.6Q0 0-5.6 5.6M5.6-5.6Q0 0 5.6 5.6" stroke="#431407" stroke-width=".9" fill="none"/></g></g>
  <g class="tc-plus" opacity="0"><text x="150" y="44" text-anchor="middle" font-size="22" font-weight="900" fill="#22c55e" stroke="#052e16" stroke-width="1">+3</text></g></svg>`; };
// El servidor ya decidió; esto solo lo muestra (entra o rebota según la respuesta).
function tcAnimate(st, s, T, reduced) { const lb = st.querySelector('#tclbl'), svg = st.querySelector('svg'), ball = svg.querySelector('.tc-ball2'), spin = svg.querySelector('.tc-spin'), sh = svg.querySelector('.tc-shadow'), plus = svg.querySelector('.tc-plus');
  const label = () => { lb.style.display = ''; lb.className = 'anlbl ' + (s.made ? (s.money ? 'won gold' : 'won') : 'lost'); lb.textContent = s.made ? (s.money ? '¡TRIPLE! 🟡' : '¡TRIPLE!') : '¡FALLÓ!'; };
  if (reduced) { label(); return Promise.resolve(); }
  svg.classList.add('release'); const q = (a, c, b, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
  const segs = [{ from: [150, 162], ctl: [150, -40], to: [150, 58], ms: 900 }];
  if (s.made) segs.push({ from: [150, 58], ctl: [150, 66], to: [150, 92], ms: 380, net: true });
  else { const d = s.zone === 'temprano' ? -1 : 1; segs[0].to = [150 + 11 * d, 60]; segs.push({ from: segs[0].to, ctl: [150 + 20 * d, 30], to: [150 - 6 * d, 54], ms: 330 }, { from: [150 - 6 * d, 54], ctl: [150 + 30 * d, 36], to: [150 + 38 * d, 70], ms: 360 }, { from: [150 + 38 * d, 70], ctl: [150 + 70 * d, 90], to: [150 + 110 * d, 210], ms: 520 }); }
  return new Promise(done => { let i = 0, t0 = performance.now(), rot = 0;
    const step = now => { const g = segs[i], t = Math.min(1, (now - t0) / g.ms), x = q(g.from[0], g.ctl[0], g.to[0], t), y = q(g.from[1], g.ctl[1], g.to[1], t), sc = 0.55 + 0.45 * Math.max(0, Math.min(1, (y - 30) / 140)) * (y > 150 ? 1 : 0.9);
      rot += 9; ball.setAttribute('transform', `translate(${x},${y}) scale(${sc.toFixed(3)})`); spin.setAttribute('transform', `rotate(${rot})`);
      sh.setAttribute('cx', x); sh.setAttribute('cy', 214 - (214 - 100) * Math.min(1, (162 - Math.min(162, Math.max(y, 0))) / 300 + (i ? .6 : t * .6))); sh.setAttribute('rx', (10 * sc).toFixed(1));
      if (t >= 1) { if (g.net) { svg.classList.add('swish'); plus.setAttribute('opacity', 1); plus.classList.add('up'); } if (!s.made && i >= 1) svg.classList.add('clank'); i++; t0 = now; if (i >= segs.length) { label(); return setTimeout(done, 650); } }
      requestAnimationFrame(step); };
    requestAnimationFrame(step); }); }
async function tcView(B) {
  clearInterval(tcTimer); clearInterval(tcBarT); const d = await api('/tc'), T = d.tc, G = d.games, sel = tcScreen && G.find(g => g.id === tcScreen), back = () => { tcScreen = null; render(); };
  const left = g => `${Math.max(0, Math.ceil((g.expires - Date.now()) / 3600e3))} h`, rules = `${T.pos.length} posiciones en orden (${T.pos.map((p, i) => `${i + 1}) ${p.toLowerCase()}`).join(', ')}) × ${T.per} balones = ${T.total} tiros en ${T.ms / 1000} s. Cada triple vale ${T.ppm} puntos (máximo ${T.max}). Barra de potencia: mantén presionado y suelta en la zona verde, arriba (cambia cada tiro; verde ${Math.round(T.green.p * 100 || 85)}%, amarilla 50%, resto 10%; barra llena = muy tarde).`;
  const bar = () => `<div class="tc-bar"><div class="tc-zone"></div><div class="tc-mid"></div><i id="tcneedle"></i></div>`;
  const runBar = t0 => { const n = $('#tcneedle'); if (!n) return; tcBarT = setInterval(() => { const t = (Date.now() - t0) % T.bar, h = T.bar / 2; n.style.left = (t < h ? t / h : (T.bar - t) / h) * 100 + '%'; }, 16); };
  const posTxt = sh => T.pos.map((p, i) => { const L = sh.filter(x => x.pos === i); return `${i + 1}) ${p}: ${L.map(x => x.made ? (x.money ? '🟡' : '🟢') : '🔴').join('') || '—'} ${L.filter(x => x.made).length}/${T.per}`; }).join('<br>');
  if (sel && sel.status === 'done' && !localStorage['tc_seen_' + sel.id] && sel.me) { localStorage['tc_seen_' + sel.id] = 1;
    const st = [[sel.me.shots, 'Tú'], [sel.rivalShots || [], esc(sel.rival)]].flatMap(([sh, who]) => T.pos.map((p, i) => { const L = sh.filter(x => x.pos === i), m = L.filter(x => x.made).length;
      return { ms: 1600, lblAt: 900, ok: who === 'Tú' ? m >= 2 : m < 2, confetti: m >= 3, label: `${who}: ${m * T.ppm} pts`, text: `${who} · ${i + 1}) ${p}: ${m}/${T.per} triples (${m * T.ppm} pts)`, svg: COURT(i, 300, T.pos, { made: m > 0 }) }; }));
    (sel.tiebreak ? sel.tiebreak.hist : []).forEach((h, i) => st.push({ ms: 1700, lblAt: 900, ok: h.my && !h.rival || (h.my === h.rival), confetti: h.my && !h.rival, label: `Desempate ${i + 1}`, text: `Desempate ${i + 1}: tú ${h.my ? '✅ acertaste' : '❌ fallaste'} · ${esc(sel.rival)} ${h.rival ? '✅ acertó' : '❌ falló'}`, svg: COURT(1, 300, T.pos, { made: h.my }) }));
    return playSeq(B, `Three Contest vs ${esc(sel.rival)}`, st, () => tcView(B)); }
  if (sel && sel.status === 'done') { const w = sel.result === 'won', tie = sel.result === 'tie', tb = sel.tiebreak;
    B.innerHTML = `<div class="card rps-res ${w ? 'won' : tie ? '' : 'lost'}"><h2>Three Contest · ${w ? '✅ ¡Ganaste!' : tie ? '🤝 Empate' : '❌ Perdiste'}</h2>
      <div class="tc-big"><div><span class="small">Tú</span><b>${sel.me ? sel.me.points : 0}</b></div><div><span class="small">${esc(sel.rival)}</span><b>${sel.rivalPoints ?? 0}</b></div></div>
      <p>${sel.reason === 'abandono' ? (w ? 'Tu rival no tiró a tiempo (24 h). ' : 'No tiraste a tiempo (24 h). ') : ''}${sel.reason === 'desempate' ? `Se decidió en el desempate (${tb.hist.length} ronda(s)). ` : ''}${w ? `Te llevas el bote: 🪙 ${fmt(sel.stake * 2)}` : `Perdiste 🪙 ${fmt(sel.stake)}`}</p>
      <div class="opt"><span class="small"><b>Tus tiros</b><br>${posTxt(sel.me ? sel.me.shots : [])}</span></div><div class="opt"><span class="small"><b>${esc(sel.rival)}</b><br>${posTxt(sel.rivalShots || [])}</span></div>
      ${tb && tb.hist.length ? `<div class="opt"><span class="small"><b>Desempate</b><br>${tb.hist.map((h, i) => `Ronda ${i + 1}: tú ${h.my ? '✅' : '❌'} · rival ${h.rival ? '✅' : '❌'}`).join('<br>')}</span></div>` : ''}
      <button class="alt" id="rep">▶ Ver repetición</button><button id="rb">Volver a Three Contest</button></div>`;
    $('#rep').onclick = () => { delete localStorage['tc_seen_' + sel.id]; render(); }; $('#rb').onclick = back; return; }
  if (sel && sel.status === 'accepted') { const me = sel.me, tb = sel.tiebreak;
    const shootUI = (title, extra, isTb) => { const pos = isTb ? 1 : me.pos, prevPos = Number(sessionStorage['tc_pos_' + sel.id] ?? pos); sessionStorage['tc_pos_' + sel.id] = pos;
      const shotsHere = isTb ? 0 : me.shots.filter(x => x.pos === pos).length;
      B.innerHTML = `<div class="card"><h2>${title}</h2>${extra}<div class="tc3d" id="tcst">${SCENE(pos, prevPos)}<div class="tc-tag" id="tctag">${isTb ? 'Desempate · centro' : `${pos + 1}) ${T.pos[pos]} · balón ${Math.min(shotsHere + 1, T.per)}/${T.per}`}</div><div class="anlbl" id="tclbl" style="display:none"></div>
          <div class="tc-vbar"><div class="tc-y" id="tcy"></div><div class="tc-g" id="tcg"></div><div class="tc-fill" id="tcfill"></div></div></div>
        <div class="row"><button id="tcshot" class="big">🏀 Mantén presionado para tirar</button>${isTb ? '' : `<button class="alt" id="tcnext" style="flex:0 0 36%">Siguiente posición ➡</button>`}</div>
        <div class="small">Mantén presionado y suelta en la zona verde, arriba (cambia cada tiro). Si la barra se llena, el tiro sale solo: muy tarde. El resultado lo decide el servidor.</div><div class="small" id="tclog"></div>${chatBox('tc', sel.id)}<button class="alt" id="rb">Volver</button></div>`;
      $('#rb').onclick = back; mountChat(); let state = 'idle', t0 = 0, raf, green = null;
      const st = $('#tcst'), fill = $('#tcfill');
      const paintZone = g => { const G = T.green, y = $('#tcy'), gg = $('#tcg'); y.style.bottom = (g - G.width / 2 - G.yellow) + '%'; y.style.height = (G.width + 2 * G.yellow) + '%'; gg.style.bottom = (g - G.width / 2) + '%'; gg.style.height = G.width + '%'; };
      const press = async e => { e && e.preventDefault(); if (state !== 'idle') return; state = 'aim';
        const a = await api('/tc/aim', { id: sel.id }).catch(er => (flash(er.message), null)); if (!a) { state = 'idle'; return render(); }
        green = a.green; paintZone(green); t0 = performance.now(); st.classList.add('charging'); if (state === 'aim') state = 'hold';
        const tick = () => { if (state !== 'hold') return; const v = Math.min(100, (performance.now() - t0) / T.bar * 100); fill.style.height = v + '%'; if (v >= 100) return release(); raf = requestAnimationFrame(tick); }; tick(); };
      const release = async () => { if (state === 'aim') { state = 'pending-release'; return; } if (state !== 'hold') return; state = 'flying'; cancelAnimationFrame(raf); st.classList.remove('charging');
        try { const r = await api('/tc/shoot', { id: sel.id }), s = r.shot; fill.style.height = s.bar + '%';
          await tcAnimate(st, s, T, REDUCED()); $('#tclog').textContent = `${s.label} · barra ${s.bar}% (verde ${s.green - T.green.width / 2}–${s.green + T.green.width / 2}%) · ${s.made ? `¡TRIPLE! +${T.ppm}` : 'falló'}${r.points != null ? ` · total ${r.points}` : ''}`;
          await new Promise(k => setTimeout(k, REDUCED() ? 900 : 700)); if (isTb || r.done) return render(); render(); }
        catch (er) { flash(er.message); render(); } };
      const btn = $('#tcshot'); btn.onpointerdown = press; btn.onpointerup = btn.onpointerleave = () => { if (state === 'pending-release') { state = 'hold'; release(); } else release(); };
      btn.onkeydown = e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) press(e); }; btn.onkeyup = e => { if (e.key === ' ' || e.key === 'Enter') release(); };
      let y0; st.ontouchstart = e => { y0 = e.touches[0].clientY; press(); }; st.ontouchend = () => release();
      if ($('#tcnext')) $('#tcnext').onclick = async () => { try { await api('/tc/next', { id: sel.id }); render(); } catch (er) { flash(er.message); } }; };
    if (tb && tb.active) { if (tb.iShot) { B.innerHTML = `<div class="card"><h2>🏀 Desempate · ronda ${tb.round}</h2><p>Ya hiciste tu tiro. Esperando a ${esc(sel.rival)} (su tiro está oculto). Le quedan ${left({ expires: tb.expires })}.</p>${chatBox('tc', sel.id)}<button class="alt" id="rb">Volver</button></div>`; $('#rb').onclick = back; mountChat(); return; }
      return shootUI(`🏀 Desempate · ronda ${tb.round}`, `<p class="small">Empataron a ${me.points} puntos. Un solo tiro desde el centro, sin reloj. Si uno acierta y el otro falla, gana; si no, se repite. Tienes ${left({ expires: tb.expires })} o pierdes la serie.</p>${tb.hist.length ? `<div class="small">${tb.hist.map((h, i) => `Ronda ${i + 1}: tú ${h.my ? '✅' : '❌'} · rival ${h.rival ? '✅' : '❌'}`).join(' · ')}</div>` : ''}`, true); }
    if (!me) { B.innerHTML = `<div class="card"><h2>🏀 Three Contest vs ${esc(sel.rival)} · bote 🪙 ${fmt(sel.stake * 2)}</h2><div style="text-align:center">${COURT(-1, 300, T.pos)}</div><p class="small">${rules}</p><p><b>El reloj de ${T.ms / 1000} s lo lleva el servidor y corre aunque cierres la app.</b> Solo tienes un intento. ${sel.rivalStarted ? 'Tu rival ya empezó (su marcador está oculto).' : ''} Tienes ${left(sel)} para hacerlo o pierdes.</p>
        <button id="tcgo" class="big">▶ Empezar mi concurso</button>${chatBox('tc', sel.id)}<button class="alt" id="rb">Volver</button></div>`;
      $('#tcgo').onclick = async () => { if (!confirm(`¿Empezar? El reloj de ${T.ms / 1000} s arranca ya.`)) return; try { await api('/tc/start', { id: sel.id }); render(); } catch (e) { flash(e.message); } }; $('#rb').onclick = back; mountChat(); return; }
    if (!me.finished) { const end = Date.now() + me.left, inPos = me.shots.filter(x => x.pos === me.pos).length;
      shootUI(`🏀 ${me.pos + 1}) ${T.pos[me.pos]} · balón ${Math.min(inPos + 1, T.per)}/${T.per}`, `<div class="tc-big"><div><span class="small">Puntos</span><b id="tcpts">${me.points}</b></div><div><span class="small">Reloj</span><b id="tcclk">${Math.ceil(me.left / 1000)}</b></div></div><div class="tc-rack">${Array.from({ length: T.per }, (_, i) => { const x = me.shots.filter(s => s.pos === me.pos)[i]; return `<i class="${x ? (x.made ? 'in' : 'out') : ''} ${i === T.per - 1 ? 'money' : ''}"></i>`; }).join('')}</div>`);
      tcTimer = setInterval(() => { const c = $('#tcclk'); if (!c) return clearInterval(tcTimer); const l = Math.max(0, end - Date.now()); c.textContent = Math.ceil(l / 1000); c.classList.toggle('lost', l < 10000); if (!l) { clearInterval(tcTimer); setTimeout(render, 600); } }, 200);
      const nb = $('#tcnext'); if (inPos < T.per) { nb.disabled = true; nb.style.opacity = .5; } if (me.pos >= T.pos.length - 1) nb.style.display = 'none'; if (inPos >= T.per) { $('#tcshot').disabled = true; $('#tcshot').style.opacity = .5; }
      return; }
    B.innerHTML = `<div class="card"><h2>🏀 Three Contest vs ${esc(sel.rival)}</h2><div class="tc-big"><div><span class="small">Tus puntos</span><b>${me.points}</b></div><div><span class="small">${esc(sel.rival)}</span><b>?</b></div></div><p>Terminaste tu concurso. Esperando a ${esc(sel.rival)}; su marcador está oculto hasta que ambos terminen. Le quedan ${left(sel)}.</p><div class="opt"><span class="small">${posTxt(me.shots)}</span></div>${chatBox('tc', sel.id)}<button class="alt" id="rb">Volver</button></div>`; $('#rb').onclick = back; mountChat(); return; }
  const rec = G.filter(g => g.status === 'pending' && g.mine === 'received'), sent = G.filter(g => g.status === 'pending' && g.mine === 'sent'), play = G.filter(g => g.status === 'accepted'), past = G.filter(g => !['pending', 'accepted'].includes(g.status));
  const ST = { declined: 'Rechazado (sin cobro)', expired: 'Vencido (sin cobro)' }, todo = g => g.tiebreak && g.tiebreak.active ? (g.tiebreak.iShot ? '(desempate: esperando rival)' : '<b>· ¡desempate! tira</b>') : !g.me ? '<b>· haz tu concurso</b>' : g.me.finished ? '(esperando rival)' : '<b>· en curso</b>';
  B.innerHTML = `<button class="alt" id="toRetos" style="width:auto">← Retos</button><div class="card"><h2>🏀 Three Contest</h2><div style="text-align:center">${COURT(-1, 300, T.pos)}</div>
    <p class="small">Reta a un amigo. No se cobra nada hasta que acepte (24 h); al aceptar se descuenta la apuesta de los dos. ${rules} Gana quien sume más; si empatan, desempate a un tiro hasta que haya ganador. Si no haces tu concurso en 24 h tras aceptar, pierdes.</p>
    <div class="row"><select id="ro">${d.friends.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select><input id="rs" type="number" min="${d.min}" max="${d.max}" step="1" placeholder="Apuesta (${d.min}–${fmt(d.max)})"><button id="rgo">Retar</button></div>
    <div class="small">Mínimo 🪙 ${fmt(d.min)} · máximo 🪙 ${fmt(d.max)} · tienes 🪙 ${fmt(me.coins)}</div></div>
    <div class="card"><h2>Retos recibidos</h2>${rec.map(g => `<div class="opt"><span>${esc(g.rival)} te reta por 🪙 ${fmt(g.stake)} · <span class="small">${left(g)} para aceptar</span></span><span><button data-ac="${g.id}">Aceptar</button> <button class="alt" data-rj="${g.id}">Rechazar</button></span></div>`).join('') || '<p class="small">Ninguno</p>'}</div>
    <div class="card"><h2>En juego</h2>${play.map(g => `<div class="opt"><span>vs ${esc(g.rival)} · 🪙 ${fmt(g.stake)} ${todo(g)}</span><button data-go="${g.id}">Abrir</button></div>`).join('') || '<p class="small">Ninguno</p>'}</div>
    <div class="card"><h2>Retos enviados</h2>${sent.map(g => `<div class="opt"><span>A ${esc(g.rival)} por 🪙 ${fmt(g.stake)}</span><span class="small">${left(g)} para aceptar</span></div>`).join('') || '<p class="small">Ninguno</p>'}</div>
    <div class="card"><h2>Historial</h2>${past.map(g => `<div class="opt ${g.result === 'won' ? 'won' : g.result === 'lost' ? 'lost' : ''}"><span>vs ${esc(g.rival)} · 🪙 ${fmt(g.stake)}${g.status === 'done' ? ` · ${g.me ? g.me.points : 0}-${g.rivalPoints ?? 0}` : ''}</span><span>${g.status === 'done' ? `<a href="#" data-go="${g.id}">${g.result === 'won' ? '✅ ¡Ganaste!' : g.result === 'lost' ? '❌ Perdiste' : '🤝 Empate'}</a>` : ST[g.status]}</span></div>`).join('') || '<p class="small">Aún no hay concursos</p>'}</div>`;
  $('#toRetos').onclick = () => { gameSel = null; render(); };
  $('#rgo').onclick = async () => { const v = Number($('#rs').value); if (!Number.isInteger(v) || v < d.min || v > d.max) return flash(`La apuesta debe ser entre ${d.min} y ${fmt(d.max)}`);
    try { await api('/tc', { opponentId: Number($('#ro').value), stake: v }); flash('Reto de Three Contest enviado'); render(); } catch (e) { flash(e.message); } };
  B.querySelectorAll('[data-ac],[data-rj]').forEach(b => b.onclick = async () => { const id = Number(b.dataset.ac || b.dataset.rj);
    try { await api('/tc/respond', { id, accept: !!b.dataset.ac }); if (b.dataset.ac) tcScreen = id; render(); } catch (e) { flash(e.message); } });
  B.querySelectorAll('[data-go]').forEach(b => b.onclick = e => { e.preventDefault(); tcScreen = Number(b.dataset.go); render(); }); }
// ---- Béisbol de una entrada ----
const EVN = { jonron: '¡JONRÓN!', ponche: '¡OUT! (strike sin swing)', out: '¡OUT! (swing a bola)', bola: 'BOLA', base: 'BASE POR BOLAS' }, BB_RULES = 'Strike = out. 3 outs terminan tu media entrada. Swing a strike = jonrón. 4 bolas sin swing = carrera. El out reinicia las bolas.';
const bbField = (e, ev) => `<svg viewBox="0 0 300 220" class="bb-an ${e}"><defs><radialGradient id="bgr" cx=".5" cy="1" r="1"><stop offset="0" stop-color="#4ade80"/><stop offset="1" stop-color="#14532d"/></radialGradient><radialGradient id="bbl" cx=".35" cy=".35"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#d4d4d8"/></radialGradient></defs>
  <rect width="300" height="220" fill="#0f172a"/><path d="M150 215 L-20 50 Q150 -30 320 50 Z" fill="url(#bgr)"/><path d="M-20 50 Q150 -30 320 50" stroke="#a16207" stroke-width="7" fill="none"/>
  <path d="M150 200 L205 145 L150 90 L95 145 Z" fill="#b45309" stroke="#fef3c7" stroke-width="2"/>${[[150, 200], [205, 145], [150, 90], [95, 145]].map(([x, y]) => `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="#fff" transform="rotate(45 ${x} ${y})"/>`).join('')}<circle cx="150" cy="148" r="7" fill="#d97706"/>
  <g transform="translate(150,140)"><circle r="7" cy="-18" fill="#fcd34d"/><rect x="-7" y="-12" width="14" height="16" rx="5" fill="#dc2626"/></g>
  <g class="runner"><g><circle r="6" cy="-20" fill="#c68642"/><rect x="-6" y="-15" width="12" height="15" rx="5" fill="#2563eb"/></g></g>
  <g class="bat"><path d="M162 198 L192 176" stroke="#a16207" stroke-width="6" stroke-linecap="round"/></g><circle class="flash" cx="168" cy="190" r="16" fill="#fde047" opacity="0"/>
  <g class="ball"><circle cx="150" cy="148" r="5" fill="url(#bbl)" stroke="#ef4444" stroke-width=".8"/></g>
  <g class="cnt"><rect x="6" y="6" width="104" height="44" rx="8" fill="#000a"/><text x="14" y="24" fill="#fff" font-size="12" font-weight="600">Bolas ${ev.balls}/4</text><text x="14" y="42" fill="#fff" font-size="12" font-weight="600">Outs ${ev.outs}/3</text><text x="200" y="22" fill="#fff" font-size="13" font-weight="700">Carreras ${ev.runs}</text></g></svg>`;
const bbSteps = (g, myName, rivName) => { const out = [];
  for (const inn of g.innings) for (const [half, iBat] of [['top', g.iTop], ['bot', !g.iTop]]) { const H = inn[half], who = iBat ? 'Tú bateas' : `Batea ${esc(rivName)}`;
    out.push({ ms: 1100, ok: true, label: `${inn.n > 1 ? 'Extra · ' : ''}${half === 'top' ? 'Alta' : 'Baja'} ${inn.n}`, text: `${who} · ${half === 'top' ? 'parte alta' : 'parte baja'} de la entrada ${inn.n}`, svg: bbField('intro', { balls: 0, outs: 0, runs: 0 }) });
    H.ev.forEach((ev, i) => { const good = ev.e === 'jonron' || ev.e === 'base', ok = iBat ? good : !good;
      out.push({ ms: ev.e === 'jonron' ? 2600 : ev.e === 'base' ? 1500 : 900, lblAt: ev.e === 'jonron' ? 700 : 150, ok, confetti: ev.e === 'jonron' || ev.e === 'base', label: EVN[ev.e] + (good ? ' +1' : ''),
        text: `${who} · lanzamiento ${i + 1}: ${ev.p === 'strike' ? 'strike' : 'bola'} · ${ev.b === 'swing' ? 'swing' : 'no swing'} → ${EVN[ev.e]} (outs ${ev.outs}/3, bolas ${ev.balls}/4, carreras ${ev.runs})`, svg: bbField(ev.e, ev) }); }); }
  return out; };
async function bbView(B) {
  const d = await api('/bb'), G = d.games, sel = bbScreen && G.find(g => g.id === bbScreen), back = () => { bbScreen = null; render(); };
  const left = g => `${Math.max(0, Math.ceil((g.expires - Date.now()) / 3600e3))} h`;
  const score = g => { const rows = g.game.innings.map(n => { const my = g.iTop ? n.top.runs : n.bot.runs, rv = g.iTop ? n.bot.runs : n.top.runs; return [n.n, my, rv]; });
    return `<table class="bb-sb"><tr><th></th>${rows.map(r => `<th>${r[0]}</th>`).join('')}<th>C</th></tr><tr><td>Tú ${g.iTop ? '(alta)' : '(baja)'}</td>${rows.map(r => `<td>${r[1]}</td>`).join('')}<td><b>${g.game.my}</b></td></tr><tr><td>${esc(g.rival)}</td>${rows.map(r => `<td>${r[2]}</td>`).join('')}<td><b>${g.game.rival}</b></td></tr></table>`; };
  if (sel && sel.status === 'done' && sel.game && !localStorage['bb_seen_' + sel.id]) { localStorage['bb_seen_' + sel.id] = 1; return playSeq(B, `Béisbol de una entrada vs ${esc(sel.rival)}`, bbSteps({ ...sel.game, iTop: sel.iTop }, 'Tú', sel.rival), () => bbView(B)); }
  if (sel && sel.status === 'done') { const w = sel.result === 'won', tie = sel.result === 'tie';
    const txt = sel.game ? sel.game.innings.map(n => [['top', 'Alta'], ['bot', 'Baja']].map(([h, nm]) => { const mine = (h === 'top') === sel.iTop, H = n[h], k = H.ev.reduce((a, e) => (a[e.e] = (a[e.e] || 0) + 1, a), {});
      return `<div class="opt ${(H.runs > 0) === mine ? 'won' : 'lost'}"><span class="small">${nm} ${n.n} · ${mine ? 'Tú' : esc(sel.rival)}: ${H.runs} carrera(s) — ${k.jonron || 0} jonrón, ${k.base || 0} base por bolas, ${(k.ponche || 0) + (k.out || 0)} outs, ${H.ev.length} lanzamientos${H.ev[H.ev.length - 1]?.outs >= 3 ? ' (3 outs)' : ' (se acabaron los lanzamientos)'}</span></div>`; }).join('')).join('') : '';
    B.innerHTML = `<div class="card rps-res ${w ? 'won' : tie ? '' : 'lost'}"><h2>Béisbol de una entrada · ${w ? '✅ ¡Ganaste!' : tie ? '🤝 Empate' : '❌ Perdiste'}</h2>${sel.game ? score(sel) : ''}
      <p>${sel.reason === 'abandono' ? (w ? 'Tu rival no mandó su plan a tiempo. ' : 'No mandaste tu plan a tiempo (24 h). ') : ''}${w ? `Te llevas el bote: 🪙 ${fmt(sel.stake * 2)}` : tie ? `Empate tras todas las entradas extra: se devolvió 🪙 ${fmt(sel.stake)} a cada uno` : `Perdiste 🪙 ${fmt(sel.stake)}`}</p>${txt}
      ${sel.game ? '<button class="alt" id="rep">▶ Ver repetición</button>' : ''}<button id="rb">Volver a Béisbol</button></div>`;
    if ($('#rep')) $('#rep').onclick = () => { delete localStorage['bb_seen_' + sel.id]; render(); }; $('#rb').onclick = back; return; }
  if (sel && sel.status === 'accepted') { const pl = { pitch: Array(d.n).fill(null), bat: Array(d.n).fill(null) };
    const draw = () => { const ready = pl.pitch.every(Boolean) && pl.bat.every(Boolean);
      B.innerHTML = `<div class="card"><h2>⚾ Béisbol vs ${esc(sel.rival)} · bote 🪙 ${fmt(sel.stake * 2)}</h2>${sel.iSent ? `<p>Ya mandaste tu plan (no se puede cambiar). Esperando a ${esc(sel.rival)}… su plan está oculto. Le quedan ${left(sel)}.</p>`
        : `<p class="small">Bateas en la parte ${sel.iTop ? 'alta' : 'baja'}. Arma tu plan secreto de ${d.n} lanzamientos y ${d.n} decisiones; se manda una sola vez. ${sel.rivalSent ? 'Tu rival ya mandó el suyo.' : ''} Tienes ${left(sel)} o pierdes.</p>
        <div class="bb-rules">${BB_RULES}</div><div class="small">Detalle: strike + swing = jonrón (+1, no es out) · strike sin swing = out · swing a bola = out · 4 bolas sin out = +1 carrera (las bolas vuelven a 0) · cada out reinicia las bolas a 0 · los outs se mantienen toda la media entrada · también termina si se acaban los 15 lanzamientos.</div>
        <h3>🎯 Como pitcher</h3><div class="bb-grid">${pl.pitch.map((v, i) => `<button class="${v ? '' : 'alt'} ${v === 'strike' ? 'red' : ''}" data-pi="${i}">${i + 1}<br>${v ? (v === 'strike' ? 'Strike' : 'Bola') : '—'}</button>`).join('')}</div>
        <h3>🏏 Como bateador</h3><div class="bb-grid">${pl.bat.map((v, i) => `<button class="${v ? '' : 'alt'}" data-bi="${i}">${i + 1}<br>${v ? (v === 'swing' ? 'Swing' : 'No swing') : '—'}</button>`).join('')}</div>
        <div class="row"><button class="alt" id="rnd">🎲 Al azar</button><button id="bgo" ${ready ? '' : 'disabled style="opacity:.5"'}>Mandar plan</button></div>`}${chatBox('bb', sel.id)}<button class="alt" id="rb">Volver</button></div>`;
      B.querySelectorAll('[data-pi]').forEach(b => b.onclick = () => { const i = +b.dataset.pi; pl.pitch[i] = pl.pitch[i] === 'bola' ? 'strike' : 'bola'; draw(); });
      B.querySelectorAll('[data-bi]').forEach(b => b.onclick = () => { const i = +b.dataset.bi; pl.bat[i] = pl.bat[i] === 'no' ? 'swing' : 'no'; draw(); });
      if ($('#rnd')) $('#rnd').onclick = () => { pl.pitch = pl.pitch.map(() => Math.random() < .5 ? 'bola' : 'strike'); pl.bat = pl.bat.map(() => Math.random() < .5 ? 'swing' : 'no'); draw(); };
      if ($('#bgo')) $('#bgo').onclick = async () => { if (!confirm('¿Mandar el plan? No se puede cambiar.')) return; try { await api('/bb/plan', { id: sel.id, ...pl }); render(); } catch (e) { flash(e.message); } };
      $('#rb').onclick = back; mountChat(); };
    draw(); return; }
  const rec = G.filter(g => g.status === 'pending' && g.mine === 'received'), sent = G.filter(g => g.status === 'pending' && g.mine === 'sent'), play = G.filter(g => g.status === 'accepted'), past = G.filter(g => !['pending', 'accepted'].includes(g.status));
  const ST = { declined: 'Rechazado (sin cobro)', expired: 'Vencido (sin cobro)' };
  B.innerHTML = `<button class="alt" id="toRetos" style="width:auto">← Retos</button><div class="card"><h2>⚾ Béisbol de una entrada</h2><div style="text-align:center">${bbField('intro', { balls: 0, outs: 0, runs: 0 })}</div>
    <p class="small">Reta a un amigo. No se cobra nada hasta que acepte (24 h); al aceptar se descuenta la apuesta de los dos. Cada uno manda una vez un plan secreto de 15 lanzamientos (bola/strike) y 15 decisiones (swing/no swing). ${BB_RULES} Gana quien anote más carreras; si empatan, entrada extra completa. Si no mandas tu plan en 24 h tras aceptar, pierdes.</p>
    <div class="row"><select id="ro">${d.friends.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select><input id="rs" type="number" min="${d.min}" max="${d.max}" step="1" placeholder="Apuesta (${d.min}–${fmt(d.max)})"><button id="rgo">Retar</button></div>
    <div class="small">Mínimo 🪙 ${fmt(d.min)} · máximo 🪙 ${fmt(d.max)} · tienes 🪙 ${fmt(me.coins)}</div></div>
    <div class="card"><h2>Retos recibidos</h2>${rec.map(g => `<div class="opt"><span>${esc(g.rival)} te reta por 🪙 ${fmt(g.stake)} · <span class="small">${left(g)} para aceptar</span></span><span><button data-ac="${g.id}">Aceptar</button> <button class="alt" data-rj="${g.id}">Rechazar</button></span></div>`).join('') || '<p class="small">Ninguno</p>'}</div>
    <div class="card"><h2>En juego</h2>${play.map(g => `<div class="opt"><span>vs ${esc(g.rival)} · 🪙 ${fmt(g.stake)} ${g.iSent ? '<span class="small">(esperando rival)</span>' : '<b>· manda tu plan</b>'}</span><button data-go="${g.id}">${g.iSent ? 'Ver' : 'Jugar'}</button></div>`).join('') || '<p class="small">Ninguno</p>'}</div>
    <div class="card"><h2>Retos enviados</h2>${sent.map(g => `<div class="opt"><span>A ${esc(g.rival)} por 🪙 ${fmt(g.stake)}</span><span class="small">${left(g)} para aceptar</span></div>`).join('') || '<p class="small">Ninguno</p>'}</div>
    <div class="card"><h2>Historial</h2>${past.map(g => `<div class="opt ${g.result === 'won' ? 'won' : g.result === 'lost' ? 'lost' : ''}"><span>vs ${esc(g.rival)} · 🪙 ${fmt(g.stake)}${g.game ? ` · ${g.game.my}-${g.game.rival}` : ''}</span><span>${g.status === 'done' ? `<a href="#" data-go="${g.id}">${g.result === 'won' ? '✅ ¡Ganaste!' : g.result === 'lost' ? '❌ Perdiste' : '🤝 Empate'}</a>` : ST[g.status]}</span></div>`).join('') || '<p class="small">Aún no hay partidos</p>'}</div>`;
  $('#toRetos').onclick = () => { gameSel = null; render(); };
  $('#rgo').onclick = async () => { const v = Number($('#rs').value); if (!Number.isInteger(v) || v < d.min || v > d.max) return flash(`La apuesta debe ser entre ${d.min} y ${fmt(d.max)}`);
    try { await api('/bb', { opponentId: Number($('#ro').value), stake: v }); flash('Reto de Béisbol enviado'); render(); } catch (e) { flash(e.message); } };
  B.querySelectorAll('[data-ac],[data-rj]').forEach(b => b.onclick = async () => { const id = Number(b.dataset.ac || b.dataset.rj);
    try { await api('/bb/respond', { id, accept: !!b.dataset.ac }); if (b.dataset.ac) bbScreen = id; render(); } catch (e) { flash(e.message); } });
  B.querySelectorAll('[data-go]').forEach(b => b.onclick = e => { e.preventDefault(); bbScreen = Number(b.dataset.go); render(); }); }
async function retosMenu(B) { const [r, p, q, z] = await Promise.all([api('/rps'), api('/pen'), api('/bb'), api('/tc')]), pend = d => d.games.filter(g => g.status === 'pending' && g.mine === 'received').length, turn = d => d.games.filter(g => g.status === 'accepted' && !(g.myPick || g.iPlayed || g.iSent || (g.me && g.me.finished && !(g.tiebreak && g.tiebreak.active && !g.tiebreak.iShot)))).length;
  const tile = (k, ic, n, d) => `<button class="alt retot" data-gm="${k}">${ic}<b>${n}</b><span class="small">${pend(d) ? `📩 ${pend(d)} reto(s) recibido(s)` : ''}${turn(d) ? ` · 🎯 te toca en ${turn(d)}` : ''}</span></button>`;
  B.innerHTML = `<div class="card"><h2>⚔️ Retos</h2><p class="small">Elige un minijuego para retar a un amigo con monedas.</p><div class="retos">${tile('rps', HAND('piedra', 70), 'Piedra, papel o tijera', r)}${tile('pen', GOAL(null, null, 90), 'Tanda de penaltis', p)}${tile('bb', `<svg viewBox="0 0 60 60" width="64"><circle cx="30" cy="30" r="24" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/><path d="M14 14q10 16 0 32M46 14q-10 16 0 32" stroke="#ef4444" stroke-width="2.5" fill="none" stroke-dasharray="3 2"/></svg>`, 'Béisbol', q)}${tile('tc', COURT(-1, 64), 'Three Contest', z)}</div></div>`;
  B.querySelectorAll('[data-gm]').forEach(b => b.onclick = () => { gameSel = b.dataset.gm; render(); }); }
// ---- Tanda de penaltis ----
const ZN = { izquierda: 'Izquierda', centro: 'Centro', derecha: 'Derecha' }, ZX = { izquierda: 55, centro: 120, derecha: 185 };
const GOAL = (shot, save, w = 240, goal) => `<svg viewBox="0 0 240 150" width="${w}" style="max-width:100%"><defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4ade80"/><stop offset="1" stop-color="#15803d"/></linearGradient><pattern id="net" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 0L10 10M10 0L0 10" stroke="#fff" stroke-opacity=".25"/></pattern></defs>
  <rect width="240" height="150" fill="url(#gg)" rx="10"/><rect x="20" y="18" width="200" height="92" fill="url(#net)" stroke="#f8fafc" stroke-width="6" stroke-linejoin="round"/><path d="M86 18V110M153 18V110" stroke="#fff" stroke-opacity=".35" stroke-dasharray="4 4"/>
  <path d="M10 112H230" stroke="#fff" stroke-width="3"/>${save ? `<g transform="translate(${ZX[save]},62)"><circle r="11" cy="-26" fill="#fde68a"/><rect x="-16" y="-14" width="32" height="40" rx="10" fill="#f97316"/><path d="M-16 -8L-34 -24M16 -8L34 -24" stroke="#f97316" stroke-width="8" stroke-linecap="round"/></g>` : ''}
  ${shot ? `<g transform="translate(${ZX[shot]},${goal === false ? 40 : 75})"><circle r="10" fill="#fff" stroke="#111" stroke-width="2"/><path d="M-4-3l4-3 4 3-1.5 5h-5z" fill="#111"/></g>` : '<g transform="translate(120,132)"><circle r="10" fill="#fff" stroke="#111" stroke-width="2"/><path d="M-4-3l4-3 4 3-1.5 5h-5z" fill="#111"/></g>'}</svg>`;
async function penView(B) {
  const d = await api('/pen'), G = d.games, sel = penScreen && G.find(g => g.id === penScreen), back = () => { penScreen = null; render(); };
  const left = g => `${Math.max(0, Math.ceil((g.expires - Date.now()) / 3600e3))} h`;
  if (sel && sel.rounds.length && Number(localStorage['pen_seen_' + sel.id] || 0) < sel.rounds.length) { const r = sel.rounds[sel.rounds.length - 1]; localStorage['pen_seen_' + sel.id] = sel.rounds.length;
    return playSeq(B, `Tanda de penaltis · Ronda ${r.n}`, [penStep(r.myShot, r.rivalSave, r.myGoal, 'Tu tiro'), penStep(r.rivalShot, r.mySave, r.rivalGoal, `Tiro de ${esc(sel.rival)}`, true)], () => penView(B)); }
  const board = g => `<div class="pen-sb"><span>Tú <b>${g.myGoals}</b></span><span>Ronda ${Math.min(g.round, Math.max(5, g.round))}${g.round > 5 ? ' · muerte súbita' : ' de 5'}</span><span><b>${g.rivalGoals}</b> ${esc(g.rival)}</span></div>
    <div class="pen-dots">${g.rounds.map(r => `<span title="Ronda ${r.n}">${r.myGoal ? '⚽' : '🧤'}</span>`).join('')}</div><div class="pen-dots">${g.rounds.map(r => `<span>${r.rivalGoal ? '⚽' : '🧤'}</span>`).join('')}</div>`;
  const hist = g => g.rounds.map(r => `<div class="opt ${r.myGoal ? 'won' : 'lost'}"><span class="small">R${r.n} · Tu tiro ${ZN[r.myShot]} vs su atajada ${ZN[r.rivalSave]}: ${r.myGoal ? '⚽ Gol' : '🧤 Atajada'}</span></div><div class="opt ${r.rivalGoal ? 'lost' : 'won'}"><span class="small">R${r.n} · Su tiro ${ZN[r.rivalShot]} vs tu atajada ${ZN[r.mySave]}: ${r.rivalGoal ? '⚽ Gol' : '🧤 ¡Atajaste!'}</span></div>`).reverse().join('');
  if (sel && sel.status === 'done') { const w = sel.result === 'won', last = sel.rounds[sel.rounds.length - 1];
    B.innerHTML = `<div class="card rps-res ${w ? 'won' : 'lost'}"><h2>Tanda de penaltis · ${w ? '✅ ¡Ganaste!' : '❌ Perdiste'}</h2>${board(sel)}${last ? GOAL(last.myShot, last.rivalSave, 240, last.myGoal) : ''}
      <p>${sel.reason === 'abandono' ? (w ? 'Tu rival no jugó a tiempo. ' : 'No jugaste a tiempo (24 h). ') : ''}${w ? `Te llevas el bote: 🪙 ${fmt(sel.stake * 2)}` : `Perdiste 🪙 ${fmt(sel.stake)}`}</p>${hist(sel)}<button id="rb">Volver a Tanda de penaltis</button></div>`;
    $('#rb').onclick = back; return; }
  if (sel && sel.status === 'accepted') { let shot = null, save = null;
    const draw = () => { B.innerHTML = `<div class="card"><h2>Tanda de penaltis vs ${esc(sel.rival)} · bote 🪙 ${fmt(sel.stake * 2)}</h2>${board(sel)}
      ${sel.iPlayed ? `<p>Ya jugaste esta ronda. Esperando a ${esc(sel.rival)}… (sus elecciones están ocultas). Le quedan ${left(sel)}.</p>${GOAL(null, null)}`
      : `<p class="small">Elige en secreto dónde tiras y dónde atajas. ${sel.rivalPlayed ? 'Tu rival ya jugó esta ronda.' : ''} Tienes ${left(sel)} o pierdes la serie.</p>${GOAL(shot, save)}
      <div class="small">⚽ Tu tiro</div><div class="row">${Object.keys(ZN).map(z => `<button class="${shot === z ? '' : 'alt'}" data-sh="${z}">${ZN[z]}</button>`).join('')}</div>
      <div class="small">🧤 Tu atajada</div><div class="row">${Object.keys(ZN).map(z => `<button class="${save === z ? '' : 'alt'}" data-sv="${z}">${ZN[z]}</button>`).join('')}</div>
      <button id="pgo" ${shot && save ? '' : 'disabled style="opacity:.5"'}>Confirmar ronda ${sel.round}</button>`}${chatBox('pen', sel.id)}${hist(sel)}<button class="alt" id="rb">Volver</button></div>`; mountChat();
      B.querySelectorAll('[data-sh]').forEach(b => b.onclick = () => { shot = b.dataset.sh; draw(); }); B.querySelectorAll('[data-sv]').forEach(b => b.onclick = () => { save = b.dataset.sv; draw(); });
      if ($('#pgo')) $('#pgo').onclick = async () => { try { await api('/pen/play', { id: sel.id, shot, save }); render(); } catch (e) { flash(e.message); } }; $('#rb').onclick = back; };
    draw(); return; }
  const rec = G.filter(g => g.status === 'pending' && g.mine === 'received'), sent = G.filter(g => g.status === 'pending' && g.mine === 'sent'), play = G.filter(g => g.status === 'accepted'), past = G.filter(g => !['pending', 'accepted'].includes(g.status));
  const ST = { declined: 'Rechazado (sin cobro)', expired: 'Vencido (sin cobro)' };
  B.innerHTML = `<button class="alt" id="toRetos" style="width:auto">← Retos</button><div class="card"><h2>⚽ Tanda de penaltis</h2><div style="text-align:center">${GOAL('derecha', 'izquierda', 220)}</div>
    <p class="small">Reta a un amigo. No se cobra nada hasta que acepte (tiene 24 h); al aceptar se descuenta la apuesta de los dos. 5 rondas: en cada una eliges en secreto tiro y atajada (izquierda, centro, derecha). Si empatan, muerte súbita. Quien no juegue su ronda en 24 h pierde la serie. El ganador se lleva todo el bote.</p>
    <div class="row"><select id="ro">${d.friends.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select><input id="rs" type="number" min="${d.min}" max="${d.max}" step="1" placeholder="Apuesta (${d.min}–${fmt(d.max)})"><button id="rgo">Retar</button></div>
    <div class="small">Mínimo 🪙 ${fmt(d.min)} · máximo 🪙 ${fmt(d.max)} · tienes 🪙 ${fmt(me.coins)}</div></div>
    <div class="card"><h2>Retos recibidos</h2>${rec.map(g => `<div class="opt"><span>${esc(g.rival)} te reta por 🪙 ${fmt(g.stake)} · <span class="small">${left(g)} para aceptar</span></span><span><button data-ac="${g.id}">Aceptar</button> <button class="alt" data-rj="${g.id}">Rechazar</button></span></div>`).join('') || '<p class="small">Ninguno</p>'}</div>
    <div class="card"><h2>En juego</h2>${play.map(g => `<div class="opt"><span>vs ${esc(g.rival)} · ${g.myGoals}-${g.rivalGoals} · ronda ${g.round} ${g.iPlayed ? '<span class="small">(esperando rival)</span>' : '<b>· te toca</b>'}</span><button data-go="${g.id}">${g.iPlayed ? 'Ver' : 'Jugar'}</button></div>`).join('') || '<p class="small">Ninguno</p>'}</div>
    <div class="card"><h2>Retos enviados</h2>${sent.map(g => `<div class="opt"><span>A ${esc(g.rival)} por 🪙 ${fmt(g.stake)}</span><span class="small">${left(g)} para aceptar</span></div>`).join('') || '<p class="small">Ninguno</p>'}</div>
    <div class="card"><h2>Historial</h2>${past.map(g => `<div class="opt ${g.result || ''}"><span>vs ${esc(g.rival)} · 🪙 ${fmt(g.stake)}${g.status === 'done' ? ` · ${g.myGoals}-${g.rivalGoals}` : ''}</span><span>${g.status === 'done' ? `<a href="#" data-go="${g.id}">${g.result === 'won' ? '✅ ¡Ganaste!' : '❌ Perdiste'}</a>` : ST[g.status]}</span></div>`).join('') || '<p class="small">Aún no hay series</p>'}</div>`;
  $('#toRetos').onclick = () => { gameSel = null; render(); };
  $('#rgo').onclick = async () => { const v = Number($('#rs').value); if (!Number.isInteger(v) || v < d.min || v > d.max) return flash(`La apuesta debe ser entre ${d.min} y ${fmt(d.max)}`);
    try { await api('/pen', { opponentId: Number($('#ro').value), stake: v }); flash('Reto de Tanda de penaltis enviado'); render(); } catch (e) { flash(e.message); } };
  B.querySelectorAll('[data-ac],[data-rj]').forEach(b => b.onclick = async () => { const id = Number(b.dataset.ac || b.dataset.rj);
    try { await api('/pen/respond', { id, accept: !!b.dataset.ac }); if (b.dataset.ac) penScreen = id; render(); } catch (e) { flash(e.message); } });
  B.querySelectorAll('[data-go]').forEach(b => b.onclick = e => { e.preventDefault(); penScreen = Number(b.dataset.go); render(); }); }
const HAND = (k, z = 90) => { const sk = '#f1c27d', d = '#c68642', S = `stroke="#7a4a1f" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"`;
  const g = `<defs><radialGradient id="hg${k}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#ffe7c2"/><stop offset=".6" stop-color="${sk}"/><stop offset="1" stop-color="${d}"/></radialGradient></defs>`;
  const f = `fill="url(#hg${k})" ${S}`;
  const body = { piedra: `<rect x="22" y="38" width="56" height="44" rx="18" ${f}/>${[30, 43, 56].map(x => `<path d="M${x} 42 Q${x + 6} 34 ${x + 12} 42" fill="none" ${S}/>`).join('')}<path d="M24 56 Q40 50 50 60" fill="none" ${S}/><ellipse cx="38" cy="48" rx="9" ry="4" fill="#fff" opacity=".35"/>`,
    papel: `${[30, 41, 52, 63].map((x, i) => `<rect x="${x}" y="${12 + [4, 0, 2, 8][i]}" width="10" height="44" rx="5" ${f}/>`).join('')}<rect x="27" y="44" width="48" height="40" rx="16" ${f}/><path d="M27 60 Q14 50 12 38 Q18 34 24 42 L30 52" ${f}/><ellipse cx="42" cy="54" rx="10" ry="5" fill="#fff" opacity=".35"/>`,
    tijera: `<rect x="34" y="8" width="11" height="48" rx="5.5" transform="rotate(-12 40 56)" ${f}/><rect x="52" y="8" width="11" height="48" rx="5.5" transform="rotate(12 57 56)" ${f}/><rect x="26" y="44" width="50" height="40" rx="16" ${f}/>${[38, 52].map(x => `<path d="M${x} 54 Q${x + 6} 48 ${x + 12} 54" fill="none" ${S}/>`).join('')}<path d="M26 62 Q38 56 46 66" fill="none" ${S}/>` }[k];
  return `<svg width="${z}" height="${z}" viewBox="0 0 100 92" aria-hidden="true">${g}${body}</svg>`; };
const RPSN = { piedra: 'Piedra', papel: 'Papel', tijera: 'Tijera' };
async function gamesView(B) {
  const d = await api('/rps'), G = d.games, sel = rpsScreen && G.find(g => g.id === rpsScreen);
  const left = g => { const h = Math.max(0, Math.ceil((g.expires - Date.now()) / 3600e3)); return `${h} h para aceptar`; };
  if (sel && sel.status === 'done') { // Pantalla 3: resultado
    const cl = sel.result === 'ganaste' ? 'won' : sel.result === 'perdiste' ? 'lost' : '';
    B.innerHTML = `<div class="card rps-res ${cl}"><h2>${sel.result === 'ganaste' ? '✅ ¡Ganaste!' : sel.result === 'perdiste' ? '❌ Perdiste' : '🤝 Empate'}</h2>
      <div class="rps-vs"><div>${HAND(sel.myPick, 110)}<div>Tú: ${RPSN[sel.myPick]}</div></div><b>VS</b><div>${HAND(sel.rivalPick, 110)}<div>${esc(sel.rival)}: ${RPSN[sel.rivalPick]}</div></div></div>
      <p>${sel.result === 'ganaste' ? `Te llevas el bote: 🪙 ${fmt(sel.stake * 2)}` : sel.result === 'perdiste' ? `Perdiste 🪙 ${fmt(sel.stake)}` : `Se devolvió 🪙 ${fmt(sel.stake)} a cada uno`}</p><button id="rb">Volver a Piedra, papel o tijera</button></div>`;
    $('#rb').onclick = () => { rpsScreen = null; render(); }; return; }
  if (sel && sel.status === 'accepted') { // Pantalla 2: elegir
    B.innerHTML = `<div class="card"><h2>Elige contra ${esc(sel.rival)} · 🪙 ${fmt(sel.stake)}</h2>${sel.myPick ? `<p>Elegiste <b>${RPSN[sel.myPick]}</b>. Esperando a ${esc(sel.rival)}… (su elección está oculta)</p><div class="rps-vs">${HAND(sel.myPick, 110)}</div>`
      : `<p class="small">Tu elección queda guardada en secreto hasta que ambos elijan.${sel.rivalPicked ? ' Tu rival ya eligió.' : ''}</p><div class="rps-pick">${['piedra', 'papel', 'tijera'].map(k => `<button class="alt" data-pk="${k}">${HAND(k)}<div>${RPSN[k]}</div></button>`).join('')}</div>`}
      ${chatBox('rps', sel.id)}<button class="alt" id="rb">Volver</button></div>`; mountChat();
    B.querySelectorAll('[data-pk]').forEach(b => b.onclick = async () => { try { await api('/rps/pick', { id: sel.id, pick: b.dataset.pk }); render(); } catch (e) { flash(e.message); } });
    $('#rb').onclick = () => { rpsScreen = null; render(); }; return; }
  // Pantalla 1: retar + pendientes + historial
  const rec = G.filter(g => g.status === 'pending' && g.mine === 'received'), sent = G.filter(g => g.status === 'pending' && g.mine === 'sent'), play = G.filter(g => g.status === 'accepted'), hist = G.filter(g => !['pending', 'accepted'].includes(g.status));
  const ST = { done: '', declined: 'Rechazado (devuelto)', expired: 'Vencido (devuelto)' };
  B.innerHTML = `<button class="alt" id="toRetos" style="width:auto">← Retos</button><div class="card"><h2>✊✋✌️ Piedra, papel o tijera</h2><p class="small">Reta a un amigo. Tu apuesta se retiene al retar; tiene 24 h para aceptar. El ganador se lleva todo el bote; empate devuelve.</p>
    <div class="row"><select id="ro">${d.friends.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select><input id="rs" type="number" min="${d.min}" max="${d.max}" step="1" placeholder="Apuesta (${d.min}–${fmt(d.max)})"><button id="rgo">Retar</button></div>
    <div class="small">Mínimo 🪙 ${fmt(d.min)} · máximo 🪙 ${fmt(d.max)} · tienes 🪙 ${fmt(me.coins)}</div></div>
    <div class="card"><h2>Retos recibidos</h2>${rec.map(g => `<div class="opt"><span>${esc(g.rival)} te reta por 🪙 ${fmt(g.stake)} · <span class="small">${left(g)}</span></span><span><button data-ac="${g.id}">Aceptar</button> <button class="alt" data-rj="${g.id}">Rechazar</button></span></div>`).join('') || '<p class="small">Ninguno</p>'}</div>
    <div class="card"><h2>Por jugar</h2>${play.map(g => `<div class="opt"><span>vs ${esc(g.rival)} · 🪙 ${fmt(g.stake)} ${g.myPick ? '<span class="small">(ya elegiste)</span>' : ''}</span><button data-go="${g.id}">${g.myPick ? 'Ver' : 'Elegir'}</button></div>`).join('') || '<p class="small">Ninguno</p>'}</div>
    <div class="card"><h2>Retos enviados</h2>${sent.map(g => `<div class="opt"><span>A ${esc(g.rival)} por 🪙 ${fmt(g.stake)}</span><span class="small">${left(g)}</span></div>`).join('') || '<p class="small">Ninguno</p>'}</div>
    <div class="card"><h2>Historial</h2>${hist.map(g => `<div class="opt ${g.result === 'ganaste' ? 'won' : g.result === 'perdiste' ? 'lost' : ''}"><span>vs ${esc(g.rival)} · 🪙 ${fmt(g.stake)}</span><span>${g.status === 'done' ? `<a href="#" data-go="${g.id}">${g.result === 'ganaste' ? '✅ ¡Ganaste!' : g.result === 'perdiste' ? '❌ Perdiste' : '🤝 Empate'}</a>` : ST[g.status]}</span></div>`).join('') || '<p class="small">Aún no hay partidas</p>'}</div>`;
  $('#toRetos').onclick = () => { gameSel = null; render(); };
  $('#rgo').onclick = async () => { const v = Number($('#rs').value); if (!Number.isInteger(v) || v < d.min || v > d.max) return flash(`La apuesta debe ser entre ${d.min} y ${fmt(d.max)}`);
    try { await api('/rps', { opponentId: Number($('#ro').value), stake: v }); render(); } catch (e) { flash(e.message); } };
  B.querySelectorAll('[data-ac],[data-rj]').forEach(b => b.onclick = async () => { const id = Number(b.dataset.ac || b.dataset.rj);
    try { await api('/rps/respond', { id, accept: !!b.dataset.ac }); if (b.dataset.ac) rpsScreen = id; render(); } catch (e) { flash(e.message); } });
  B.querySelectorAll('[data-go]').forEach(b => b.onclick = e => { e.preventDefault(); rpsScreen = Number(b.dataset.go); render(); });
}
