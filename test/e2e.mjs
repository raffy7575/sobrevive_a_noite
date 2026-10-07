// Jogo real (public/index.html) <-> API real (em memória), com o tempo do servidor ligado ao tempo simulado do jogo.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHandler } from '../netlify/lib/http.mjs';
import { memStore } from './memstore.mjs';

const BASE = Date.UTC(2026, 9, 7, 12, 0, 0);
let simMs = 0;                                       // tempo simulado (ms) que o servidor vê
const stores = { players: memStore(), lb: memStore(), runs: memStore(), misc: memStore() };
const api = createHandler({ ...stores, now: () => BASE + simMs, adminKey: 'k' });
let online = true;
global.fetch = async (url, opts = {}) => {
  if (!online) throw new TypeError('offline');
  if (process.env.DEBUG && url.includes('/run/')) { const b = JSON.parse(opts.body); const r = await stores.runs.get('r/' + b.runId, { type: 'json' }); console.log('        [dbg]', url, 'sim=' + (simMs/1000).toFixed(1) + 's', JSON.stringify({ ...b, sig: undefined }), r && JSON.stringify({ w: r.w, k: r.k, bad: r.bad, since0: ((BASE + simMs - r.t0)/1000).toFixed(1), sinceCp: ((BASE + simMs - r.tw)/1000).toFixed(1) })); }
  const res = await api(new Request('https://jogo.test' + url, { method: opts.method, headers: opts.headers, body: opts.body }), { ip: '9.9.9.9' });
  if (process.env.DEBUG && !url.includes('leaderboard')) { const c = res.clone(); console.log('        [api]', opts.method, url, res.status, JSON.stringify(await c.json()).slice(0, 160)); }
  return res;
};
global.location = { protocol: 'https:', href: 'https://jogo.test/' };

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
let src = html.match(/<script>([\s\S]*)<\/script>/)[1];
const MODE = process.argv[2] || 'cheat';
if (MODE === 'cheat') {
  src = src.replace('if (p.hp <= 0) gameOver();', 'if (p.hp <= 0) p.hp = 1;');
  src = src.replace('dmg:def.dmg * T.dmg * st.dmg', 'dmg:def.dmg * T.dmg * st.dmg * 120');
}
const els = {};
function mkEl(sel){
  const e = { sel, style: {}, hidden: false, _h: '', _t: '', value: '', scrollTop: 0, listeners: {}, dataset: {}, disabled: false,
    classList: { _s: new Set(), toggle(c, on){ on === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (on ? this._s.add(c) : this._s.delete(c)); }, add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, contains(c){ return this._s.has(c); } },
    addEventListener(t, f){ e.listeners[t] = f; }, getContext: () => ctxStub, width: 0, height: 0, getBoundingClientRect: () => ({ width: 400, height: 700 }), toDataURL: () => 'data:', setPointerCapture(){}, closest: () => null,
    set innerHTML(v){ e._h = v; }, get innerHTML(){ return e._h; }, set textContent(v){ e._t = v; }, get textContent(){ return e._t; }, set src(v){} };
  return e;
}
const ctxStub = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ addColorStop(){} })), set: (o, k, v) => { o[k] = v; return true; } });
const createCanvas = null;
const cv = null;
const $ = sel => sel === '#c' && cv ? cv : (els[sel] || (els[sel] = (() => { const e = mkEl(sel); if (['#install', '#board', '#saves', '#pickchar', '#pickarena', '#levelup', '#shop', '#over', '#win', '#pause'].includes(sel)) e.classList.add('hidden'); return e; })()));
const visible = sel => !$(sel).classList.contains('hidden');
const tabEls = { btab: ['mine', 'all', 'week'].map(b => Object.assign(mkEl('.btab'), { dataset: { b } })), tab: ['shop', 'inv'].map(t => Object.assign(mkEl('.tab'), { dataset: { t } })) };
const document = { createElement: () => (createCanvas ? createCanvas(300, 150) : mkEl('canvas')), querySelector: $, querySelectorAll: s => tabEls[s.slice(1)] || [], addEventListener(){}, hidden: false };
const winL = {};
const window = { addEventListener(t, f){ (winL[t] = winL[t] || []).push(f); }, devicePixelRatio: 2, navigator: { standalone: false }, matchMedia: () => ({ matches: false }) };
let raf = null; const requestAnimationFrame = f => { raf = f; };
const store = {};
const localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
let wall = 0; const performance = { now: () => wall };
const realTimeout = global.setTimeout;
global.setTimeout = (f, ms) => ms >= 1000 ? 0 : realTimeout(f, 0);       // os temporizadores longos (confirmações) não disparam sozinhos
new Function('document', 'window', 'requestAnimationFrame', 'localStorage', 'performance', src.replace(/^\(\(\) => \{/, '(function(){').replace(/\}\)\(\);\s*$/, '})();'))(document, window, requestAnimationFrame, localStorage, performance);

const tick = () => new Promise(r => realTimeout(r, 15));
const click = (sel, ev) => $(sel).listeners.click(ev || { currentTarget: $(sel), target: { closest: () => null } });
const btns = {}; const btn = (act) => (btns[act] ||= { dataset: { act }, disabled: false, textContent: 'x' });
const acctClick = async act => { $('#acctOut').listeners.click({ target: { closest: () => btn(act) } }); await tick(); };
const serverBoard = async (scope = 'all') => (await (await fetch('/api/leaderboard?scope=' + scope)).json()).entries;
let t = 0;
let lastW = null;
async function frames(n, { until } = {}){      // assíncrono: deixa as chamadas à API acontecerem no instante simulado certo
  for (let i = 0; i < n; i++) {
    if (+$('#wv')._t !== lastW) { lastW = +$('#wv')._t; await tick(); }
    else if (i % 400 === 399) await new Promise(r => realTimeout(r, 0));       // deixa correr temporizadores (ex.: o ecrã de fim de jogo)
    t += 16; simMs += 16; wall = t; raf(t);
    if (i % 11 === 0) {
      if (visible('#levelup')) $('#luCards').listeners.click({ target: { closest: () => ({ dataset: { i: 0 } }) } });
      if (visible('#shop')) click('#next');
      if (visible('#win')) click('#endless');
    }
    if (until && until()) break;
  }
}
let passed = 0, failed = 0;
const cheatOnly = (n, f) => MODE === 'cheat' ? test(n, f) : null;
async function test(name, fn){ try { await fn(); passed++; console.log('  ok  ', name); } catch (e) { failed++; console.log('  FALHOU', name, '\n       ', e.message.split('\n')[0]); } }

console.log('Arranque e instalação');
await test('antes de mais nada aparece o convite para instalar (não está instalado)', async () => {
  assert.equal(visible('#install'), true); assert.equal(visible('#menu'), false);
  assert.match($('#instSteps')._h, /Instalar app|Partilhar/);
});
await test('"Agora não" leva ao menu e não volta a perguntar durante uns dias', async () => {
  click('#instSkip'); assert.equal(visible('#install'), false); assert.equal(visible('#menu'), true);
  assert.ok(+store['sobrevive-install-skip'] > 0);
});
await test('o menu oferece "Instalar como app"', () => assert.equal($('#openInstall').hidden, false));

console.log('\nConta online');
await test('criar perfil: guarda sessão e mostra o código', async () => {
  click('#openSaves'); await tick(); assert.equal(visible('#saves'), true);
  $('#acName').value = 'Rafa'; await acctClick('create');
  const saved = JSON.parse(store['sobrevive-save-v2']); assert.equal(saved.acct.name, 'Rafa'); assert.match(saved.acct.code, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  assert.match($('#acctOut')._h, /Jogas como <b>Rafa<\/b>/);
});
await test('nome impróprio ou repetido dá erro percetível', async () => {
  const saved = JSON.parse(store['sobrevive-save-v2']); const keep = saved.acct;
  await acctClick('logout'); await acctClick('logout');       // duplo toque
  assert.equal(JSON.parse(store['sobrevive-save-v2']).acct, null);
  $('#acName').value = 'Rafa'; await acctClick('create'); assert.match($('#acctOut')._h, /já está a ser usado/);
  $('#acName').value = 'Merda'; await acctClick('create'); assert.match($('#acctOut')._h, /inválido/);
  $('#acCode').value = keep.code.toLowerCase(); await acctClick('login');                 // volta a entrar com o código
  assert.equal(JSON.parse(store['sobrevive-save-v2']).acct.name, 'Rafa');
});
await test('código errado dá erro', async () => {
  const keep = JSON.parse(store['sobrevive-save-v2']).acct;
  await acctClick('logout'); await acctClick('logout');
  $('#acCode').value = 'AAAA-AAAA-AAAA'; await acctClick('login'); assert.match($('#acctOut')._h, /não encontrado/);
  $('#acCode').value = keep.code; await acctClick('login'); assert.equal(JSON.parse(store['sobrevive-save-v2']).acct.name, 'Rafa');
  click('#stBack');
});

console.log('\nPartida verificada ponta a ponta');
await cheatOnly('jogar várias ondas em tempo real e sair para o menu: o servidor aceita e põe no ranking', async () => {
  click('#play'); await tick();
  assert.ok(true);
  await frames(60000, { until: () => +$('#wv')._t >= 6 });
  assert.ok(+$('#wv')._t >= 6, 'chegou à onda ' + $('#wv')._t);
  const wave = +$('#wv')._t; click('#pz'); click('#pauseMenu'); await tick(); await tick();
  const board = await serverBoard(); const me = board.find(e => e.name === 'Rafa');
  assert.ok(me, 'Rafa no ranking global: ' + JSON.stringify(board));
  assert.equal(me.wave, wave - 1); assert.ok(me.score >= (wave - 1) * 100);
  console.log('        onda', wave - 1, 'pontos', me.score, 'mortes', me.kills, 'nível', me.level);
});
await cheatOnly('o ranking mostra-se no jogo (separadores Global e Semana)', async () => {
  click('#openBoard'); await tick(); tabEls.btab[1].listeners.click(); await tick(); await tick();
  assert.match($('#blist')._h, /Rafa/); assert.match($('#blist')._h, /class="brow top"/);
  tabEls.btab[2].listeners.click(); await tick(); await tick(); assert.match($('#blist')._h, /Rafa/);
  tabEls.btab[0].listeners.click(); click('#bBack');
});
await cheatOnly('o fim de jogo por morte (modo sem batota) é verificado e mostra o resultado no ecrã', async () => {
  // (corre-se noutro processo: node test/e2e.mjs natural) ver teste abaixo
  assert.ok(true);
});

console.log('\nSem ligação');
await cheatOnly('sem internet o jogo continua e avisa que o resultado não foi enviado', async () => {
  online = false; click('#play'); await tick();
  await frames(60000, { until: () => +$('#wv')._t >= 3 });
  click('#pz'); click('#pauseMenu'); await tick(); await tick();
  online = true;
  const board = await serverBoard(); assert.equal(board.filter(e => e.name === 'Rafa').length, 1, 'continua só 1 entrada');
});
await cheatOnly('o ranking global sem ligação mostra erro em vez de falhar', async () => {
  online = false; click('#openBoard'); await tick(); tabEls.btab[1].listeners.click(); await tick(); await tick();
  assert.match($('#blist')._h, /Sem ligação/); online = true; click('#bBack');
});

if (MODE === 'natural') {
  console.log('\nJogo natural (sem batota) até ao fim de jogo');
  await test('morrer numa partida verificada mostra "Verificado" e o lugar no ranking', async () => {
    click('#openSaves'); $('#acName').value = 'Natural'; await acctClick('create'); click('#stBack');
    click('#play'); await tick();
    await frames(120000, { until: () => visible('#over') });
    assert.ok(visible('#over'), 'chegou ao fim de jogo');
    await tick(); await tick(); await tick();
    console.log('        ', $('#overText')._t); console.log('        ', $('#overVer')._t, '|', $('#overRank')._t);
    assert.match($('#overVer')._t, /Verificado ✓/);
    const e = (await serverBoard()).find(x => x.name === 'Natural'); assert.ok(e, 'no ranking'); console.log('         ranking:', JSON.stringify(e));
  });
}
console.log(`\n${passed} passaram, ${failed} falharam.`);
process.exit(failed ? 1 : 0);
