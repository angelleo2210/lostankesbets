const $ = s => document.querySelector(s); const A = $('#app');
let token = localStorage.token, me = null, tab = 'lineas';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Number(n).toLocaleString('es-US'); const od = o => (o > 0 ? '+' : '') + o;
const profit = (s, o) => Math.floor(o > 0 ? s * o / 100 : s * 100 / -o);
async function api(p, body) { const r = await fetch('/api' + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-token': token || '' }, body: body && JSON.stringify(body) });
  const d = await r.json(); if (d.error && r.status >= 400) throw new Error(d.error); return d; }
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
  me = await api('/me');
  const tabs = [['lineas', 'Líneas'], ['reales', 'Reales'], ['mias', 'Mis apuestas'], ['tabla', 'Tabla']].concat(me.is_admin ? [['admin', 'Admin']] : []);
  A.innerHTML = `<h1>🎲 Hola, ${esc(me.username)} · 🪙 ${fmt(me.coins)}</h1><nav>${tabs.map(([k, v]) => `<button class="${k === tab ? '' : 'alt'}" data-t="${k}">${v}</button>`).join('')}</nav>
  <p id="msg" class="err"></p><div id="body"></div><button class="alt" id="out">Salir</button>`;
  A.querySelectorAll('nav button').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
  $('#out').onclick = () => { localStorage.removeItem('token'); token = null; start(); };
  const B = $('#body');
  try {
  if (tab === 'lineas') { const ls = await api('/lines');
    B.innerHTML = ls.length ? ls.map(lineCard).join('') : '<div class="card">No hay líneas abiertas.</div>'; bindBets(); }
  if (tab === 'reales') { const d = await api('/real'); const ls = (await api('/lines')).filter(l => l.kind === 'real');
    B.innerHTML = (d.error ? `<div class="card">${esc(d.error)}</div>` : '') + (ls.length ? ls.map(lineCard).join('') : '<div class="card">El administrador aún no ha agregado líneas reales.</div>') +
      (me.is_admin && d.events ? `<div class="card"><h2>Importar evento real (admin)</h2>${d.events.slice(0, 30).map(e => `<div class="card"><b>${esc(e.sport)}: ${esc(e.title)}</b><div class="small">${new Date(e.starts).toLocaleString('es-US')} · ${esc(e.bookmaker)}</div>${e.options.map(o => `${esc(o.label)} ${od(o.odds)}`).join(' · ')}<button class="alt" data-imp="${esc(e.id)}">Agregar</button></div>`).join('')}</div>` : '');
    bindBets(); B.querySelectorAll('[data-imp]').forEach(b => b.onclick = async () => { try { const r = await api('/admin/import', { eventId: b.dataset.imp }); if (r.error) throw new Error(r.error); render(); } catch (e) { flash(e.message); } }); }
  if (tab === 'mias') { const st = { open: 'Abierta', won: 'Ganada', lost: 'Perdida', refunded: 'Devuelta' };
    B.innerHTML = me.bets.length ? me.bets.map(b => `<div class="card"><b>${esc(b.title)}</b><div>${esc(b.label)} ${od(b.odds)} · apostado ${fmt(b.stake)}</div><div class="small">${st[b.status]}${b.status === 'open' ? ' · gana ' + fmt(b.stake + profit(b.stake, b.odds)) : b.payout ? ' · cobrado ' + fmt(b.payout) : ''}</div></div>`).join('') : '<div class="card">Aún no tienes apuestas.</div>'; }
  if (tab === 'tabla') { const t = await api('/leaderboard'); B.innerHTML = `<div class="card">${t.map((u, i) => `<div class="opt"><span>${i + 1}. ${esc(u.username)}</span><b>🪙 ${fmt(u.coins)}</b></div>`).join('')}</div>`; }
  if (tab === 'admin') await adminView(B);
  } catch (e) { flash(e.message); }
}
function lineCard(l) {
  return `<div class="card"><h2>${esc(l.title)}</h2><div class="small">${l.kind === 'real' ? 'Real' : 'Ficticia'} · ${l.status === 'open' ? 'Abierta' : 'Cerrada a apuestas'}${l.starts ? ' · ' + new Date(l.starts).toLocaleString('es-US') : ''}</div>
  ${l.options.map(o => `<div class="opt"><span>${esc(o.label)} <b>${od(o.odds)}</b></span>${l.status === 'open' ? `<input style="width:110px" type="number" min="1" placeholder="Monto" id="s${o.id}"><button style="width:90px" data-o="${o.id}">Apostar</button>` : ''}</div>`).join('')}</div>`;
}
function bindBets() { A.querySelectorAll('[data-o]').forEach(b => b.onclick = async () => { const s = Number($('#s' + b.dataset.o).value); try { await api('/bet', { optionId: Number(b.dataset.o), stake: s }); render(); } catch (e) { flash(e.message); } }); }
async function adminView(B) {
  const ls = await api('/lines'); const inv = await api('/admin/invites');
  B.innerHTML = `<div class="card"><h2>Nueva línea ficticia</h2><input id="t" placeholder="Ej: Hoy Ángel come espaguetis">
  <div id="opts"></div><button class="alt" id="add">+ Opción</button><button id="create">Crear línea</button></div>
  <div class="card"><h2>Liquidar / cerrar</h2>${ls.map(l => `<div class="card"><b>${esc(l.title)}</b> <span class="small">(${l.status === 'open' ? 'abierta' : 'cerrada'})</span>
   ${l.status === 'open' ? `<button class="alt" data-close="${l.id}">Cerrar apuestas</button>` : ''}
   <select id="w${l.id}">${l.options.map(o => `<option value="${o.id}">${esc(o.label)} ${od(o.odds)}</option>`).join('')}</select>
   <div class="row"><button data-settle="${l.id}">Ganó esta</button><button class="red" data-cancel="${l.id}">Cancelar y devolver</button></div></div>`).join('') || 'Nada pendiente.'}</div>
  <div class="card"><h2>Invitaciones</h2><button id="inv">Crear invitación</button>${inv.map(i => `<div class="small">${i.used_by ? '✅ usada por ' + esc(i.used_by) : `<a style="color:#93c5fd" href="/?invitacion=${i.code}">${location.origin}/?invitacion=${i.code}</a>`}</div>`).join('')}</div>`;
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
