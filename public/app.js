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
const head = (u, size = 28) => Avatar.render(u.avatarCfg, { head: true, size, facialHair: u.facialHair });
const body = (u, size = 64) => Avatar.render(u.avatarCfg, { size, facialHair: u.facialHair });
const who = (u, full) => { const c = u.cosmetics || {}, ac = rw(c.accessory), col = rw(c.color);
  return `${full ? body(u, full) : head(u)} ${u.badge ? u.badge + ' ' : ''}${u.avatar ? esc(u.avatar) : ''}${ac ? ac.icon : ''}${ac || u.avatar ? ' ' : ''}<span style="${col ? `color:${col.color};font-weight:800;text-shadow:0 0 6px ${col.color}88` : ''}">${esc(u.display_name || u.username)}</span>`; };
const EMOJIS = '😎🦁🐯🐺🦅🔥⚡💪🍀🎲🏆⚽🏀🏈⚾🥊🍝🍺🤑👑🚀🐐🦈💀'.match(/\p{Extended_Pictographic}/gu);
function builder(el, cfg, unlocked, onChange) {
  const C = Avatar.CAT, lockOf = (k, v) => C[k].lock && C[k].lock[v];
  const draw = () => { el.innerHTML = Object.entries(C).map(([k, c]) => `<div class="small" style="margin-top:6px">${c.name}</div><div class="chips">${c.opts.map(v => { const L = lockOf(k, v), ok = !L || unlocked.has(L), on = cfg[k] === v;
      return c.color ? `<button class="sw${on ? ' on' : ''}" style="background:${v}" data-b="${k}|${v}" aria-label="${v}"></button>` : `<button class="chip ${on ? '' : 'alt'}" ${ok ? `data-b="${k}|${v}"` : 'disabled style="opacity:.45"'}>${ok ? '' : '🔒'}${esc(v.replace(/_/g, ' '))}</button>`; }).join('')}</div>`).join('');
    el.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { const [k, v] = b.dataset.b.split('|'); cfg[k] = v; draw(); onChange(); }); };
  draw();
}
const flash = m => { const e = $('#msg'); if (e) e.textContent = m; else alert(m); };
async function start() {
  if (token) try { me = await api('/me'); return render(); } catch { token = null; localStorage.removeItem('token'); }
  const st = await api('/status'); const code = new URLSearchParams(location.search).get('invitacion') || '';
  const mode = !st.hasAdmin ? 'setup' : code ? 'register' : 'login';
  A.innerHTML = `<h1>🎲 LosTankesBets</h1><p class="small">Solo monedas ficticias. Sin dinero real.</p><div class="card">
  <h2>${mode === 'setup' ? 'Crear administrador' : mode === 'register' ? 'Unirte con invitación' : 'Entrar'}</h2>
  ${mode === 'register' ? `<input id="code" placeholder="Código de invitación" value="${esc(code)}">` : ''}
  <input id="u" placeholder="Usuario" autocapitalize="none"><input id="p" type="password" placeholder="PIN (mín. 4)" inputmode="numeric">
  ${mode === 'register' ? '<details><summary class="small">🎨 Arma tu muñeco (opcional)</summary><div style="text-align:center" id="rpv"></div><div id="rbl"></div></details>' : ''}
  <button id="go">${mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
  ${mode === 'login' ? '<p class="small">¿Tienes invitación? Abre el link que te mandaron.</p>' : ''}<p id="msg" class="err"></p></div>`;
  const rcfg = { ...Avatar.DEFAULT }; let touched = false;
  if ($('#rbl')) { const pv = () => $('#rpv').innerHTML = Avatar.render(rcfg, { size: 150 }); pv(); builder($('#rbl'), rcfg, new Set(), () => { touched = true; pv(); }); }
  $('#go').onclick = async () => { try { const b = { username: $('#u').value, pin: $('#p').value, code: $('#code')?.value, ...(touched ? { avatarCfg: rcfg } : {}) };
    const d = await api(mode === 'setup' ? '/setup' : mode === 'register' ? '/register' : '/login', b);
    token = localStorage.token = d.token; history.replaceState(null, '', '/'); start(); } catch (e) { flash(e.message); } };
}
async function render() {
  me = await api('/me'); if (!RW.length) RW = await api('/rewards').catch(() => []);
  const tabs = [['lineas', 'Líneas'], ['reales', 'Reales'], ['mias', 'Mis apuestas'], ['tabla', 'Tabla'], ['tienda', 'Tienda'], ['perfil', 'Mi perfil']].concat(me.is_admin ? [['admin', 'Admin']] : []);
  A.innerHTML = `<h1>Hola, ${who(me, 56)} · 🪙 ${fmt(me.coins)}</h1><nav>${tabs.map(([k, v]) => `<button class="${k === tab ? '' : 'alt'}" data-t="${k}">${v}</button>`).join('')}</nav>
  <p id="msg" class="err"></p><div id="body"></div><button class="alt" id="out">Salir</button>`;
  A.querySelectorAll('nav button').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
  $('#out').onclick = () => { localStorage.removeItem('token'); token = null; start(); };
  const B = $('#body');
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
  if (tab === 'tabla') { const t = await api('/leaderboard'); B.innerHTML = `<div class="card">${t.map((u, i) => `<div class="opt"><span>${i + 1}. ${who(u)}${u.display_name ? ` <span class="small">@${esc(u.username)}</span>` : ''}</span><b>🪙 ${fmt(u.coins)}</b></div>`).join('')}</div>`; }
  if (tab === 'perfil') { let av = me.avatar || '', fs = me.facialHair?.style || 'ninguno', cos = { ...(me.cosmetics || {}) }, acfg = { ...me.avatarCfg }; const mine = new Set((me.unlocks || []).map(u => u.item_id));
    B.innerHTML = `<div class="card"><h2>Mi perfil</h2><div class="small">Usuario: @${esc(me.username)}</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin:8px 0">${EMOJIS.map(e => `<button class="${e === av ? '' : 'alt'}" style="width:44px;padding:6px" data-em="${e}">${e}</button>`).join('')}<button class="alt" style="width:auto;padding:6px" data-em="">Sin avatar</button></div>
    <div class="card avpv" id="bigpv"></div>
    <h2>Tu muñeco</h2><div id="bld"></div>
    <h2>Vello facial</h2><select id="fh">${Object.entries(FH).map(([k, v]) => `<option value="${k}" ${k === fs ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
    <div class="row"><label class="small"><input type="checkbox" id="fcu" style="width:auto" ${me.facialHair?.color ? 'checked' : ''}> Color</label><input type="color" id="fc" value="${esc(me.facialHair?.color || '#5b3a1e')}" style="height:42px"></div>
    <h2>Recompensas top 3 ${me.badge || ''}</h2><div class="small">Quedar en el top 3 de la tabla (con más de 50.000) desbloquea ítems exclusivos: corona, sombrero dorado, gorra de campeón, camiseta y pantalón dorados, medias doradas y zapaticos de oro/plata/bronce (aparecen con 🔒 arriba hasta ganarlos). Lo que ganas se queda para siempre; la medalla 🥇🥈🥉 solo se ve mientras sigues arriba.</div>
    ${[['color', 'Colores metálicos (nombre)'], ['accessory', 'Accesorios junto al nombre']].map(([k, n]) => `<div class="small" style="margin-top:6px">${n}</div><div style="display:flex;flex-wrap:wrap;gap:4px">${RW.filter(r => r.kind === k).map(r => { const ok = mine.has(r.id);
      return `<button class="${cos[k] === r.id ? '' : 'alt'}" style="width:auto;padding:6px;${ok ? '' : 'opacity:.45'}" ${ok ? `data-cos="${k}:${r.id}"` : 'disabled'} title="${esc(r.name)}">${ok ? '' : '🔒'}${r.icon || `<span style="color:${r.color}">●</span>`} <span class="small">top ${r.minRank}</span></button>`; }).join('')}<button class="alt" style="width:auto;padding:6px" data-cos="${k}:">Nada</button></div>`).join('')}
    <div class="card">Vista previa: <span id="pv"></span></div>
    <input id="dn" maxlength="20" placeholder="Nombre para mostrar (opcional)" value="${esc(me.display_name || '')}"><button id="sv">Guardar</button></div>`;
    const fhv = () => $('#fh').value === 'ninguno' ? null : { style: $('#fh').value, color: $('#fcu').checked ? $('#fc').value : null };
    const pv = () => { const u = { username: me.username, badge: me.badge, cosmetics: cos, avatar: av, avatarCfg: acfg, display_name: $('#dn').value.trim(), facialHair: fhv() }; $('#pv').innerHTML = who(u); $('#bigpv').innerHTML = body(u, 170); }; pv();
    builder($('#bld'), acfg, new Set((me.unlocks || []).map(x => x.item_id)), pv);
    ['#fh', '#fc', '#fcu', '#dn'].forEach(sel => $(sel).oninput = $(sel).onchange = pv);
    B.querySelectorAll('[data-cos]').forEach(b => b.onclick = () => { const [k, v] = b.dataset.cos.split(':'); if (v) cos[k] = v; else delete cos[k]; B.querySelectorAll(`[data-cos^="${k}:"]`).forEach(x => x.className = x.dataset.cos === `${k}:${v}` && v ? '' : 'alt'); pv(); });
    B.querySelectorAll('[data-em]').forEach(b => b.onclick = () => { av = b.dataset.em; B.querySelectorAll('[data-em]').forEach(x => x.className = x.dataset.em === av && av ? '' : 'alt'); pv(); });
    $('#sv').onclick = async () => { try { await api('/profile', { avatar: av, display_name: $('#dn').value, facialHair: fhv() || 'ninguno', cosmetics: cos, avatarCfg: acfg }); render(); } catch (e) { flash(e.message); } }; }
  if (tab === 'tienda') await storeView(B);
  if (tab === 'perfil') { const g = document.createElement('div'); B.append(g); await storeView(g, true); }
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
  const ls = await api('/lines'); const inv = await api('/admin/invites'); const us = await api('/admin/users'); const tps = await api('/admin/topups');
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
let storeCat = '';
async function storeView(B, garage) { const d = await api('/store'); const own = new Map(d.owned.map(o => [o.item_id, o.color])); const pick = {};
  const sw = i => `<div class="swr">${i.colors.map(c => `<button class="swb ${(own.get(i.id) || i.color) === c ? 'on' : ''}" style="background:${Store.PALETTE[c]}" data-sw="${i.id}" data-c="${c}" title="${Store.NAMES[c]}" aria-label="${Store.NAMES[c]}"></button>`).join('')}</div>`;
  const tier = i => i.id === 'avion_jet' ? ['exclusive', '💎 Exclusivo'] : i.price >= 1000000 ? ['premium', '⭐ Premium'] : ['', ''];
  const card = i => { const [cl, tg] = tier(i); return `<div class="card item ${own.has(i.id) ? 'owned' : ''} ${cl}">${tg ? `<span class="tag">${tg}</span>` : ''}<div class="ph"><img loading="lazy" id="im_${i.id}" src="${Store.img(i.id, own.get(i.id))}" alt="${esc(i.name)}"></div><b>${esc(i.name)}</b><div>🪙 ${fmt(i.price)}</div>${sw(i)}${own.has(i.id) ? `<div class="small">✅ Tuyo</div><button class="alt" data-savec="${i.id}">Guardar color</button>` : `<button data-buy="${i.id}" ${me.coins < i.price ? 'disabled' : ''}>Comprar</button>`}</div>`; };
  const grid = xs => `<div class="shop">${xs.map(card).join('')}</div>`;
  const section = (k, v, xs) => !xs.length ? '' : k !== 'ropa' ? `<h2>${v}</h2>${grid(xs)}` : `<h2>${v}</h2>` + Store.SUBS.map(([s, n]) => { const ys = xs.filter(i => i.sub === s); return ys.length ? `<h3>${n}</h3>${grid(ys)}` : ''; }).join('');
  const pool = garage ? d.items.filter(i => own.has(i.id)) : d.items, cats = garage || !storeCat ? Store.CATS : Store.CATS.filter(c => c[0] === storeCat);
  B.innerHTML = (garage ? `<h2>🚗 Mi garaje</h2>${own.size ? '' : '<div class="small">Aún no tienes nada. Pásate por la Tienda.</div>'}` : `<div class="card"><h2>🛍️ Tienda</h2><div class="small">Solo cosméticos para presumir: no dan ventajas en las apuestas. Prueba colores gratis antes de comprar.</div></div><div class="chips depts">${[['', 'Todo'], ...Store.CATS].map(([k, v]) => `<button class="chip ${storeCat === k ? 'on' : 'alt'}" data-dep="${k}">${v}</button>`).join('')}</div>`) +
    cats.map(([k, v]) => section(k, v, pool.filter(i => i.cat === k))).join('');
  B.querySelectorAll('[data-dep]').forEach(b => b.onclick = () => { storeCat = b.dataset.dep; storeView(B, garage); });
  const set = (id, c) => { pick[id] = c; $('#im_' + id).src = Store.img(id, c); B.querySelectorAll(`[data-sw="${id}"]`).forEach(x => x.classList.toggle('on', x.dataset.c === c)); };
  B.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => set(b.dataset.sw, b.dataset.c));
  B.querySelectorAll('[data-buy]').forEach(b => b.onclick = async () => { const i = Store.byId(b.dataset.buy); if (!confirm(`¿Comprar ${i.name} por ${fmt(i.price)} monedas?`)) return; try { await api('/store/buy', { itemId: i.id, ...(pick[i.id] ? { color: pick[i.id] } : {}) }); render(); } catch (e) { flash(e.message); } });
  B.querySelectorAll('[data-savec]').forEach(b => b.onclick = async () => { const id = b.dataset.savec; if (!pick[id]) return flash('Elige un color primero'); try { await api('/store/color', { itemId: id, color: pick[id] }); flash('Color guardado'); } catch (e) { flash(e.message); } }); }
