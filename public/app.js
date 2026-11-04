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
const who = u => { const c = u.cosmetics || {}, h = rw(c.hat), ac = rw(c.accessory), col = rw(c.color);
  return `${u.badge ? u.badge + ' ' : ''}${h ? h.icon : ''}${u.avatar ? esc(u.avatar) : ''}${ac ? ac.icon : ''}${h || ac || u.avatar ? ' ' : ''}${fhChip(u.facialHair)}<span style="${col ? `color:${col.color};font-weight:800;text-shadow:0 0 6px ${col.color}88` : ''}">${esc(u.display_name || u.username)}</span>`; };
const EMOJIS = '😎🦁🐯🐺🦅🔥⚡💪🍀🎲🏆⚽🏀🏈⚾🥊🍝🍺🤑👑🚀🐐🦈💀'.match(/\p{Extended_Pictographic}/gu);
const flash = m => { const e = $('#msg'); if (e) e.textContent = m; else alert(m); };
async function start() {
  if (token) try { me = await api('/me'); return render(); } catch { token = null; localStorage.removeItem('token'); }
  const st = await api('/status'); const code = new URLSearchParams(location.search).get('invitacion') || '';
  const mode = !st.hasAdmin ? 'setup' : code ? 'register' : 'login';
  A.innerHTML = `<h1>🎲 LosTankesBets</h1><p class="small">Solo monedas ficticias. Sin dinero real.</p><div class="card">
  <h2>${mode === 'setup' ? 'Crear administrador' : mode === 'register' ? 'Unirte con invitación' : 'Entrar'}</h2>
  ${mode === 'register' ? `<input id="code" placeholder="Código de invitación" value="${esc(code)}">` : ''}
  <input id="u" placeholder="Usuario" autocapitalize="none"><input id="p" type="password" placeholder="PIN (mín. 4)" inputmode="numeric">
  <button id="go">${mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
  ${mode === 'login' ? '<p class="small">¿Tienes invitación? Abre el link que te mandaron.</p>' : ''}<p id="msg" class="err"></p></div>`;
  $('#go').onclick = async () => { try { const b = { username: $('#u').value, pin: $('#p').value, code: $('#code')?.value };
    const d = await api(mode === 'setup' ? '/setup' : mode === 'register' ? '/register' : '/login', b);
    token = localStorage.token = d.token; history.replaceState(null, '', '/'); start(); } catch (e) { flash(e.message); } };
}
async function render() {
  me = await api('/me'); if (!RW.length) RW = await api('/rewards').catch(() => []);
  const tabs = [['lineas', 'Líneas'], ['reales', 'Reales'], ['mias', 'Mis apuestas'], ['tabla', 'Tabla'], ['perfil', 'Mi perfil']].concat(me.is_admin ? [['admin', 'Admin']] : []);
  A.innerHTML = `<h1>${me.avatar ? '' : '🎲 '}Hola, ${who(me)} · 🪙 ${fmt(me.coins)}</h1><nav>${tabs.map(([k, v]) => `<button class="${k === tab ? '' : 'alt'}" data-t="${k}">${v}</button>`).join('')}</nav>
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
  if (tab === 'mias') { const st = { open: 'Abierta', won: 'Ganada', lost: 'Perdida', refunded: 'Devuelta' };
    B.innerHTML = me.bets.length ? me.bets.map(b => `<div class="card"><b>${esc(b.title)}</b><div>${esc(b.label)} ${od(b.odds)} · apostado ${fmt(b.stake)}</div><div class="small">${st[b.status]}${b.status === 'open' ? ' · gana ' + fmt(b.stake + profit(b.stake, b.odds)) : b.payout ? ' · cobrado ' + fmt(b.payout) : ''}</div></div>`).join('') : '<div class="card">Aún no tienes apuestas.</div>';
    const pst = { ...st, open: 'Abierto' , won: 'Ganado', lost: 'Perdido', refunded: 'Devuelto' }, gst = { open: '⏳', won: '✅', lost: '❌', cancelled: '🚫' };
    B.innerHTML = (me.parlays || []).map(p => `<div class="card"><b>🎟️ Parlay de ${p.legs.length}</b> ${p.odds ? od(p.odds) : ''} · apostado ${fmt(p.stake)}${p.legs.map(g => `<div class="small">${gst[g.status] || ''} ${esc(g.title)}: ${esc(g.label)} ${od(g.odds)}</div>`).join('')}<div class="small">${pst[p.status]}${p.status === 'open' ? ' · gana ' + fmt(p.potential) : p.payout ? ' · cobrado ' + fmt(p.payout) : ''}</div></div>`).join('') + B.innerHTML; }
  if (tab === 'tabla') { const t = await api('/leaderboard'); B.innerHTML = `<div class="card">${t.map((u, i) => `<div class="opt"><span>${i + 1}. ${who(u)}${u.display_name ? ` <span class="small">@${esc(u.username)}</span>` : ''}</span><b>🪙 ${fmt(u.coins)}</b></div>`).join('')}</div>`; }
  if (tab === 'perfil') { let av = me.avatar || '', fs = me.facialHair?.style || 'ninguno', cos = { ...(me.cosmetics || {}) }; const mine = new Set((me.unlocks || []).map(u => u.item_id));
    B.innerHTML = `<div class="card"><h2>Mi perfil</h2><div class="small">Usuario: @${esc(me.username)}</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin:8px 0">${EMOJIS.map(e => `<button class="${e === av ? '' : 'alt'}" style="width:44px;padding:6px" data-em="${e}">${e}</button>`).join('')}<button class="alt" style="width:auto;padding:6px" data-em="">Sin avatar</button></div>
    <h2>Vello facial</h2><select id="fh">${Object.entries(FH).map(([k, v]) => `<option value="${k}" ${k === fs ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
    <div class="row"><label class="small"><input type="checkbox" id="fcu" style="width:auto" ${me.facialHair?.color ? 'checked' : ''}> Color</label><input type="color" id="fc" value="${esc(me.facialHair?.color || '#5b3a1e')}" style="height:42px"></div>
    <h2>Recompensas top 3 ${me.badge || ''}</h2><div class="small">Quedar en el top 3 de la tabla desbloquea estos ítems. Lo que ganas se queda para siempre; la medalla 🥇🥈🥉 solo se ve mientras sigues arriba.</div>
    ${[['hat', 'Sombreros'], ['color', 'Colores metálicos'], ['accessory', 'Accesorios']].map(([k, n]) => `<div class="small" style="margin-top:6px">${n}</div><div style="display:flex;flex-wrap:wrap;gap:4px">${RW.filter(r => r.kind === k).map(r => { const ok = mine.has(r.id);
      return `<button class="${cos[k] === r.id ? '' : 'alt'}" style="width:auto;padding:6px;${ok ? '' : 'opacity:.45'}" ${ok ? `data-cos="${k}:${r.id}"` : 'disabled'} title="${esc(r.name)}">${ok ? '' : '🔒'}${r.icon || `<span style="color:${r.color}">●</span>`} <span class="small">top ${r.minRank}</span></button>`; }).join('')}<button class="alt" style="width:auto;padding:6px" data-cos="${k}:">Nada</button></div>`).join('')}
    <div class="card">Vista previa: <span id="pv"></span></div>
    <input id="dn" maxlength="20" placeholder="Nombre para mostrar (opcional)" value="${esc(me.display_name || '')}"><button id="sv">Guardar</button></div>`;
    const fhv = () => $('#fh').value === 'ninguno' ? null : { style: $('#fh').value, color: $('#fcu').checked ? $('#fc').value : null };
    const pv = () => $('#pv').innerHTML = who({ username: me.username, badge: me.badge, cosmetics: cos, avatar: av, display_name: $('#dn').value.trim(), facialHair: fhv() }); pv();
    ['#fh', '#fc', '#fcu', '#dn'].forEach(sel => $(sel).oninput = $(sel).onchange = pv);
    B.querySelectorAll('[data-cos]').forEach(b => b.onclick = () => { const [k, v] = b.dataset.cos.split(':'); if (v) cos[k] = v; else delete cos[k]; B.querySelectorAll(`[data-cos^="${k}:"]`).forEach(x => x.className = x.dataset.cos === `${k}:${v}` && v ? '' : 'alt'); pv(); });
    B.querySelectorAll('[data-em]').forEach(b => b.onclick = () => { av = b.dataset.em; B.querySelectorAll('[data-em]').forEach(x => x.className = x.dataset.em === av && av ? '' : 'alt'); pv(); });
    $('#sv').onclick = async () => { try { await api('/profile', { avatar: av, display_name: $('#dn').value, facialHair: fhv() || 'ninguno', cosmetics: cos }); render(); } catch (e) { flash(e.message); } }; }
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
  const ls = await api('/lines'); const inv = await api('/admin/invites');
  B.innerHTML = `<div class="card"><h2>Nueva línea ficticia</h2><input id="t" placeholder="Ej: Hoy Ángel come espaguetis">
  <div id="opts"></div><button class="alt" id="add">+ Opción</button><button id="create">Crear línea</button></div>
  <div class="card"><h2>Liquidar / cerrar</h2>${ls.map(l => `<div class="card"><b>${esc(l.title)}</b> <span class="small">(${l.status === 'open' ? 'abierta' : 'cerrada'})</span>
   ${l.status === 'open' ? `<button class="alt" data-close="${l.id}">Cerrar apuestas</button>` : ''}
   <select id="w${l.id}">${l.options.map(o => `<option value="${o.id}">${esc(o.label)} ${od(o.odds)}</option>`).join('')}</select>
   <div class="row"><button data-settle="${l.id}">Ganó esta</button><button class="red" data-cancel="${l.id}">Cancelar y devolver</button></div></div>`).join('') || 'Nada pendiente.'}</div>
  <div class="card"><h2>Invitaciones</h2><button id="inv">Crear invitación</button>${inv.map(i => `<div class="small">${i.used_by ? '✅ usada por ' + who({ ...i, username: i.used_by }) : `<a style="color:#93c5fd" href="/?invitacion=${i.code}">${location.origin}/?invitacion=${i.code}</a>`}</div>`).join('')}</div>`;
  const addOpt = (l = '', o = '') => { const d = document.createElement('div'); d.className = 'row'; d.innerHTML = `<input placeholder="Opción" value="${l}"><input placeholder="Cuota (-250 / +880)" value="${o}">`; $('#opts').append(d); };
  addOpt('Sí', '-250'); addOpt('No', '+880'); $('#add').onclick = () => addOpt();
  const act = (sel, fn) => B.querySelectorAll(sel).forEach(b => b.onclick = async () => { try { await fn(b); render(); } catch (e) { flash(e.message); } });
  act('#create', () => api('/admin/lines', { title: $('#t').value, options: [...$('#opts').children].map(r => ({ label: r.children[0].value, odds: Number(r.children[1].value) })) }));
  act('[data-close]', b => api(`/admin/lines/${b.dataset.close}/close`, {}));
  act('[data-settle]', b => confirm('¿Liquidar esta línea?') && api(`/admin/lines/${b.dataset.settle}/settle`, { optionId: Number($('#w' + b.dataset.settle).value) }));
  act('[data-cancel]', b => confirm('¿Cancelar y devolver monedas?') && api(`/admin/lines/${b.dataset.cancel}/cancel`, {}));
  act('#inv', () => api('/admin/invites', {}));
}
start();
