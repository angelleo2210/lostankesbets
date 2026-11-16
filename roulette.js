'use strict';
const crypto = require('node:crypto');

const ZERO00 = 37; // stored pocket for '00'; never display as 37
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
// European single-zero order, kept to animate/draw leftover rounds opened before the American switch.
const WHEEL_EU = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
// Standard American wheel order, clockwise from 0, with 00 after 1.
const WHEEL = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, ZERO00, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];
const MIN_BET = 100, MAX_BET = 25000, MAX_SPIN = 50000, MAX_BETS = 40;
const PAYOUT = {
  straight: 35, split: 17, street: 11, trio: 11, corner: 8, firstfour: 8, firstfive: 6, sixline: 5,
  dozen: 2, column: 2, red: 1, black: 1, odd: 1, even: 1, low: 1, high: 1
};
const OUTSIDE = new Set(['red', 'black', 'odd', 'even', 'low', 'high']);

const userErr = m => { const e = new Error(m); e.user = true; return e; };
const isGreen = n => n === 0 || n === ZERO00;
const colorOf = n => (isGreen(n) ? 'green' : RED.has(n) ? 'red' : 'black');
const labelOf = n => (n === ZERO00 ? '00' : String(n));
const parsePocket = v => {
  if (v === '00' || v === ZERO00) return ZERO00;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};
const sortNums = a => [...a].map(parsePocket).sort((x, y) => x - y);
const isNum = (n, style = 'american') => Number.isInteger(n) && n >= 0 && n <= (style === 'european' ? 36 : ZERO00) && (style === 'european' ? n !== ZERO00 : true);
const rowCol = n => ({ row: Math.floor((n - 1) / 3), col: (n - 1) % 3 });
function styleOf(row) {
  // New rounds are tagged 'american'. A missing/NULL wheel is a leftover European round.
  return row && row.wheel === 'american' ? 'american' : 'european';
}

function adjacent(a, b) {
  if (a === b || !Number.isInteger(a) || !Number.isInteger(b)) return false;
  const [x, y] = a < b ? [a, b] : [b, a];
  if (x === 0 && y === ZERO00) return true;
  if (x === 0) return y === 1 || y === 2;
  if (x === ZERO00 || y === ZERO00) {
    const o = x === ZERO00 ? y : x;
    return o === 2 || o === 3;
  }
  if (x < 1) return false;
  const A = rowCol(x), B = rowCol(y);
  return (A.row === B.row && Math.abs(A.col - B.col) === 1) || (A.col === B.col && Math.abs(A.row - B.row) === 1);
}
const isStreet = nums => {
  if (nums.length !== 3) return false;
  const [a, b, c] = sortNums(nums);
  return a >= 1 && a <= 34 && a % 3 === 1 && b === a + 1 && c === a + 2;
};
const isTrio = nums => {
  const s = sortNums(nums).join(',');
  return s === '0,1,2' || s === '0,2,3' || s === '2,3,37' || s === '0,2,37';
};
const isCorner = nums => {
  if (nums.length !== 4) return false;
  const [a, b, c, d] = sortNums(nums);
  if (a < 1 || a > 32) return false;
  const A = rowCol(a);
  return A.col < 2 && b === a + 1 && c === a + 3 && d === a + 4;
};
const isFirstFour = nums => sortNums(nums).join(',') === '0,1,2,3';
const isFirstFive = nums => sortNums(nums).join(',') === '0,1,2,3,37';
const isSixline = nums => {
  if (nums.length !== 6) return false;
  const s = sortNums(nums);
  return s[0] >= 1 && s[0] <= 31 && s[0] % 3 === 1 && s.every((n, i) => n === s[0] + i);
};
const columnOf = c => { const o = []; for (let n = c; n <= 36; n += 3) o.push(n); return o; };
const dozenOf = d => { const a = (d - 1) * 12 + 1, o = []; for (let n = a; n < a + 12; n++) o.push(n); return o; };

function normalizeBet(raw) {
  if (!raw || typeof raw !== 'object') throw userErr('Apuesta inválida');
  const type = String(raw.type || '');
  const amount = Number(raw.amount);
  if (!Object.prototype.hasOwnProperty.call(PAYOUT, type)) throw userErr('Tipo de apuesta no válido');
  if (!Number.isInteger(amount) || amount < MIN_BET) throw userErr(`La apuesta mínima es ${MIN_BET}`);
  if (amount > MAX_BET) throw userErr(`La apuesta máxima es ${MAX_BET.toLocaleString('es-US')}`);
  if (OUTSIDE.has(type)) return { type, amount, nums: [] };
  if (type === 'dozen') {
    const d = Number(raw.dozen ?? raw.n);
    if (![1, 2, 3].includes(d)) throw userErr('Docena inválida');
    return { type, amount, nums: dozenOf(d), dozen: d };
  }
  if (type === 'column') {
    const c = Number(raw.column ?? raw.n);
    if (![1, 2, 3].includes(c)) throw userErr('Columna inválida');
    return { type, amount, nums: columnOf(c), column: c };
  }
  const nums = sortNums(raw.nums || raw.numbers || []);
  if (!nums.length || nums.some(n => !isNum(n, 'american')) || new Set(nums).size !== nums.length) throw userErr('Números de apuesta inválidos');
  if (type === 'straight') {
    if (nums.length !== 1) throw userErr('Pleno requiere un número');
    return { type, amount, nums };
  }
  if (type === 'split') {
    if (nums.length !== 2 || !adjacent(nums[0], nums[1])) throw userErr('Caballo: solo números adyacentes');
    return { type, amount, nums };
  }
  if (type === 'street') {
    if (!isStreet(nums)) throw userErr('Transversal inválida');
    return { type, amount, nums };
  }
  if (type === 'trio') {
    if (!isTrio(nums)) throw userErr('Trío inválido (0-1-2, 00-2-3 o 0-00-2)');
    return { type, amount, nums };
  }
  if (type === 'corner') {
    if (!isCorner(nums)) throw userErr('Cuadro inválido');
    return { type, amount, nums };
  }
  if (type === 'firstfour') {
    if (!isFirstFour(nums)) throw userErr('Cesta inválida (0-1-2-3)');
    return { type, amount, nums };
  }
  if (type === 'firstfive') {
    if (!isFirstFive(nums)) throw userErr('Línea de cinco inválida (0-00-1-2-3)');
    return { type, amount, nums };
  }
  if (type === 'sixline') {
    if (!isSixline(nums)) throw userErr('Línea de seis inválida');
    return { type, amount, nums };
  }
  throw userErr('Tipo de apuesta no válido');
}

function hits(bet, n) {
  if (isGreen(n)) {
    if (bet.type === 'red' || bet.type === 'black' || bet.type === 'odd' || bet.type === 'even' || bet.type === 'low' || bet.type === 'high') return false;
    if (bet.type === 'dozen' || bet.type === 'column') return false;
  }
  if (bet.type === 'red') return colorOf(n) === 'red';
  if (bet.type === 'black') return colorOf(n) === 'black';
  if (bet.type === 'odd') return !isGreen(n) && n % 2 === 1;
  if (bet.type === 'even') return !isGreen(n) && n % 2 === 0;
  if (bet.type === 'low') return n >= 1 && n <= 18;
  if (bet.type === 'high') return n >= 19 && n <= 36;
  return bet.nums.includes(n);
}

function normalizeBets(list) {
  if (!Array.isArray(list) || !list.length) throw userErr('Coloca al menos una apuesta');
  if (list.length > MAX_BETS) throw userErr(`Máximo ${MAX_BETS} apuestas por giro`);
  const bets = list.map(normalizeBet);
  const stake = bets.reduce((s, b) => s + b.amount, 0);
  if (stake > MAX_SPIN) throw userErr(`El total por giro no puede superar ${MAX_SPIN.toLocaleString('es-US')}`);
  return { bets, stake };
}

function settle(bets, n, style = 'american') {
  if (!isNum(n, style)) throw new Error('Número de ruleta inválido');
  let payout = 0;
  const settled = bets.map(b => {
    const win = hits(b, n);
    const paid = win ? b.amount * (PAYOUT[b.type] + 1) : 0;
    payout += paid;
    return { ...b, win, paid };
  });
  const stake = bets.reduce((s, b) => s + b.amount, 0);
  return { number: n, label: labelOf(n), color: colorOf(n), stake, payout, profit: payout - stake, settled };
}

const spinNumber = (style = 'american') => crypto.randomInt(0, style === 'european' ? 37 : 38);
const colorName = c => (c === 'red' ? 'rojo' : c === 'black' ? 'negro' : 'verde');
const pocketPublic = (n, color) => n == null || n === '' ? { number: null, label: null, color: null } : { number: n, label: labelOf(n), color: color || colorOf(n) };

const LIVE = { ROUND_MS: 60_000, BET_MS: 40_000, SPIN_MS: 8_000 };
LIVE.RESULT_MS = LIVE.ROUND_MS - LIVE.BET_MS - LIVE.SPIN_MS;

const TYPE_NAME = {
  straight: 'Pleno', split: 'Caballo', street: 'Transversal', trio: 'Trío',
  corner: 'Cuadro', firstfour: 'Cesta', firstfive: 'Línea de cinco', sixline: 'Línea de seis',
  dozen: 'Docena', column: 'Columna', red: 'Rojo', black: 'Negro',
  odd: 'Impar', even: 'Par', low: '1–18', high: '19–36'
};
function betSummary(b) {
  if (!b) return '';
  if (b.type === 'dozen') return `Docena ${b.dozen || b.n || ''}`.trim();
  if (b.type === 'column') return `Columna ${b.column || b.n || ''}`.trim();
  if (OUTSIDE.has(b.type)) return TYPE_NAME[b.type] || b.type;
  const nums = (b.nums || []).map(labelOf).join('-');
  return `${TYPE_NAME[b.type] || b.type}${nums ? ' ' + nums : ''}`;
}
function betsSummary(list) {
  return (list || []).map(b => `${betSummary(b)} · ${b.amount}`).join(', ');
}
function roundIdAt(now) { return Math.floor(Number(now) / LIVE.ROUND_MS); }
function roundTimes(id) {
  const opens = Number(id) * LIVE.ROUND_MS;
  return { id: Number(id), opens, closes: opens + LIVE.BET_MS, spinEnds: opens + LIVE.BET_MS + LIVE.SPIN_MS, ends: opens + LIVE.ROUND_MS };
}
function phaseAt(now, t) {
  if (now < t.closes) return 'open';
  if (now < t.spinEnds) return 'spinning';
  if (now < t.ends) return 'result';
  return 'ended';
}

module.exports = {
  RED, WHEEL, WHEEL_EU, ZERO00, MIN_BET, MAX_BET, MAX_SPIN, MAX_BETS, PAYOUT, LIVE, TYPE_NAME,
  colorOf, colorName, labelOf, parsePocket, pocketPublic, isGreen, adjacent, isStreet, isTrio, isCorner, isFirstFour, isFirstFive, isSixline,
  columnOf, dozenOf, normalizeBet, normalizeBets, hits, settle, spinNumber, isNum, styleOf,
  betSummary, betsSummary, roundIdAt, roundTimes, phaseAt
};
