// Núcleo da API de "Sobrevive à Noite".
// Sem dependências do Netlify: recebe os "stores" por injeção, por isso é testável em Node puro.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/* ------------------------------------------------------------------ */
/* Regras do jogo (espelham o cliente; usadas para validar resultados) */
/* ------------------------------------------------------------------ */
export const WIN_WAVE = 30;
export const MAX_WAVE = 120;                       // limite absoluto de ondas aceites
export const waveDur = n => Math.min(20 + (n - 1) * 2, 40);   // segundos que uma onda dura, no mínimo
export const cumKills = L => Math.round(2.5 * L * (L + 3) * (1 + L / 7));    // mortes para passar do nível L ao L+1
export const earnedLevel = k => { let l = 1; while (k >= cumKills(l)) l++; return l; };
export const scoreOf = (cleared, kills, win) => cleared * 100 + kills + (win ? 1000 : 0);

// máximo de monstros que podem existir (e portanto morrer) numa onda, segundo as regras de spawn do jogo
function spawnsEst(n){
  const base = Math.max(.45, 1.7 - n * .045), grp = 1 + Math.floor(n / 6);
  return waveDur(n) / (base * .8) * grp;
}
export function maxKillsWave(n){
  const s = spawnsEst(n);
  return Math.ceil(s * (1.35 + (n >= 8 ? .4 : 0))) + (n % 6 === 0 ? 120 : 0) + (n >= 19 ? 40 : 0) + 20;
}
const sumWaves = (from, to, f) => { let t = 0; for (let i = from; i <= to; i++) t += f(i); return t; };

export const CHAR_IDS = ['cacador', 'medico', 'coveiro', 'bruxa', 'cavaleiro', 'padre'];
export const ARENA_IDS = ['cemiterio', 'floresta', 'cripta'];

/* ----------------------------- utilitários ----------------------------- */
const b64u = buf => Buffer.from(buf).toString('base64url');
const sha = s => createHash('sha256').update(String(s)).digest('hex');
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
const CROCK = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function newCode(){ const r = randomBytes(12); let s = ''; for (let i = 0; i < 12; i++) s += CROCK[r[i] % 32]; return s; }
export const normCode = raw => String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
export const fmtCode = c => c.replace(/(.{4})(?=.)/g, '$1-');
const inv8 = s => String(99999999 - Math.max(0, Math.min(99999999, s))).padStart(8, '0');

export function weekId(ms){       // ISO week em UTC
  const d = new Date(ms); d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = d.getUTCFullYear(), w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return y + '-W' + String(w).padStart(2, '0');
}

const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} _.-]{1,12}[\p{L}\p{N}]$/u;
const BLOCK_SUB = ['caralho', 'puta', 'merda', 'foder', 'porra', 'bosta', 'buceta', 'punheta', 'cabrao', 'viado', 'fuck', 'shit', 'bitch', 'cunt', 'nigg', 'nazi', 'hitler', 'rape', 'sexo', 'penis', 'pila'];
const BLOCK_EXACT = ['cu', 'cus', 'fdp', 'pq', 'admin', 'moderador', 'sistema'];
export const flatName = n => String(n).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
  .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't');
export function cleanName(raw){
  const n = String(raw ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!NAME_RE.test(n)) return null;
  const f = flatName(n);
  if (f.length < 3 || BLOCK_EXACT.includes(f) || BLOCK_SUB.some(w => f.includes(w))) return null;
  return n;
}

const cap = (v, max) => Math.max(0, Math.min(max, Number.isFinite(+v) ? Math.floor(+v) : 0));
export const capProg = p => ({ best: cap(p?.best, MAX_WAVE), kills: cap(p?.kills, 5e6), bosses: cap(p?.bosses, 5000), wins: cap(p?.wins, 5000) });
const mergeProg = (a, b) => { const x = capProg(a), y = capProg(b); return { best: Math.max(x.best, y.best), kills: Math.max(x.kills, y.kills), bosses: Math.max(x.bosses, y.bosses), wins: Math.max(x.wins, y.wins) }; };
const cleanSel = s => ({ c: CHAR_IDS.includes(s?.c) ? s.c : 'cacador', a: ARENA_IDS.includes(s?.a) ? s.a : 'cemiterio' });

/* ----------------------------------------------------------------------- */
/* Fábrica da API                                                           */
/* ----------------------------------------------------------------------- */
export function createApi({ players, lb, runs, misc, now = () => Date.now(), adminKey = '' }){
  const json = async (store, key) => (await store.get(key, { type: 'json' })) ?? null;

  async function listKeys(store, prefix, max = 200){
    const out = [];
    for await (const page of store.list({ prefix, paginate: true })) {
      for (const b of page.blobs) out.push(b.key);
      if (out.length >= max * 4 && out.length >= 1000) break;     // evita listas gigantes
    }
    out.sort();
    return out.slice(0, max);
  }
  async function countBefore(store, prefix, key){
    let n = 0;
    for await (const page of store.list({ prefix, paginate: true })) { for (const b of page.blobs) if (b.key < key) n++; if (n > 50000) return null; }
    return n + 1;
  }

  // limites de pedidos (melhor esforço): em blobs para o que é sensível, em memória para o resto
  const rlKey = (bucket, windowSec) => `rl/${bucket}/${Math.floor(now() / 1000 / windowSec)}`;
  async function count(bucket, windowSec){ return ((await json(misc, rlKey(bucket, windowSec))) ?? { n: 0 }).n; }
  async function hit(bucket, windowSec){ const k = rlKey(bucket, windowSec), c = (await json(misc, k)) ?? { n: 0 }; c.n++; await misc.setJSON(k, c); return c.n; }
  async function limited(bucket, max, windowSec){ return (await hit(bucket, windowSec)) > max; }
  const mem = new Map();
  function memLimited(bucket, max, windowSec){
    const k = bucket + '/' + Math.floor(now() / 1000 / windowSec), n = (mem.get(k) || 0) + 1;
    mem.set(k, n); if (mem.size > 5000) for (const key of mem.keys()) { mem.delete(key); if (mem.size < 2500) break; }
    return n > max;
  }

  async function auth(headers){
    const m = /^Bearer ([A-Za-z0-9_-]{6,32})\.([A-Za-z0-9_-]{20,80})$/.exec(headers.authorization || '');
    if (!m) return null;
    const p = await json(players, 'p/' + m[1]);
    if (!p || p.banned) return null;
    const h = sha(m[2]);
    return p.tokens.some(t => safeEq(t, h)) ? { p, tok: h } : null;
  }
  const publicPlayer = p => ({ id: p.id, name: p.name, prog: p.prog, sel: p.sel });

  async function removeBoardEntries(playerId){
    const ptr = await json(lb, 'ptr/' + playerId);
    if (ptr?.all) await lb.delete(ptr.all);
    if (ptr?.week?.key) await lb.delete(ptr.week.key);
    await lb.delete('ptr/' + playerId);
  }

  /* ------------------------------ rotas ------------------------------ */
  const R = {};

  R['POST /profile'] = async ({ body, ip }) => {
    if (await limited('prof:' + ip, 6, 3600)) return [429, { error: 'rate' }];
    const name = cleanName(body.name);
    if (!name) return [400, { error: 'bad_name' }];
    const nameKey = flatName(name);
    if (await json(players, 'n/' + nameKey)) return [409, { error: 'name_taken' }];
    const id = b64u(randomBytes(9)), token = b64u(randomBytes(32)), code = newCode();
    const p = { id, name, nameKey, created: now(), tokens: [sha(token)], codeHash: sha(code), prog: capProg(body.prog), sel: cleanSel(body.sel), banned: false, flags: 0 };
    await players.setJSON('p/' + id, p);
    await players.setJSON('n/' + nameKey, { id });
    await players.setJSON('c/' + p.codeHash, { id });
    return [200, { id, token, code: fmtCode(code), name, prog: p.prog, sel: p.sel }];
  };

  R['POST /login'] = async ({ body, ip }) => {
    if (await count('lf:' + ip, 3600) >= 15 || await limited('login:' + ip, 12, 60)) return [429, { error: 'rate' }];
    const code = normCode(body.code);
    if (code.length !== 12) return [400, { error: 'bad_code' }];
    const ref = await json(players, 'c/' + sha(code));
    const p = ref ? await json(players, 'p/' + ref.id) : null;
    if (!p || p.banned) { await hit('lf:' + ip, 3600); return [404, { error: 'code_not_found' }]; }
    const token = b64u(randomBytes(32));
    p.tokens = [...p.tokens.slice(-7), sha(token)];
    await players.setJSON('p/' + p.id, p);
    return [200, { id: p.id, token, name: p.name, prog: p.prog, sel: p.sel }];
  };

  R['GET /me'] = async ({ p }) => [200, publicPlayer(p)];

  R['POST /sync'] = async ({ p, body }) => {
    if (memLimited('sync:' + p.id, 30, 60)) return [429, { error: 'rate' }];
    p.prog = mergeProg(p.prog, body.prog);
    if (body.sel) p.sel = cleanSel(body.sel);
    await players.setJSON('p/' + p.id, p);
    return [200, publicPlayer(p)];
  };

  R['POST /rename'] = async ({ p, body }) => {
    if (await limited('rename:' + p.id, 3, 86400)) return [429, { error: 'rate' }];
    const name = cleanName(body.name);
    if (!name) return [400, { error: 'bad_name' }];
    const nameKey = flatName(name);
    const taken = await json(players, 'n/' + nameKey);
    if (taken && taken.id !== p.id) return [409, { error: 'name_taken' }];
    if (nameKey !== p.nameKey) { await players.delete('n/' + p.nameKey); await players.setJSON('n/' + nameKey, { id: p.id }); }
    p.name = name; p.nameKey = nameKey; await players.setJSON('p/' + p.id, p);
    const ptr = await json(lb, 'ptr/' + p.id);        // atualiza o nome nas entradas do ranking
    for (const k of [ptr?.all, ptr?.week?.key]) { if (!k) continue; const e = await json(lb, k); if (e) { e.n = name; await lb.setJSON(k, e); } }
    return [200, publicPlayer(p)];
  };

  R['POST /newcode'] = async ({ p, tok }) => {
    if (await limited('newcode:' + p.id, 5, 3600)) return [429, { error: 'rate' }];
    await players.delete('c/' + p.codeHash);
    const code = newCode(); p.codeHash = sha(code); p.tokens = [tok];   // mantém só o aparelho que fez o pedido
    await players.setJSON('p/' + p.id, p); await players.setJSON('c/' + p.codeHash, { id: p.id });
    return [200, { code: fmtCode(code) }];
  };

  R['POST /delete'] = async ({ p }) => {
    await removeBoardEntries(p.id);
    await players.delete('c/' + p.codeHash); await players.delete('n/' + p.nameKey); await players.delete('p/' + p.id);
    const act = await json(runs, 'a/' + p.id); if (act) { await runs.delete('r/' + act.runId); await runs.delete('a/' + p.id); }
    return [200, { ok: true }];
  };

  /* ---------------------------- partidas verificadas ---------------------------- */
  const sign = (key, kind, runId, wave, kills, level) => createHmac('sha256', key).update(`${kind}|${runId}|${wave}|${kills}|${level}`).digest('hex');
  const num = v => (Number.isFinite(+v) ? Math.floor(+v) : NaN);

  R['POST /run/start'] = async ({ p, body }) => {
    if (await limited('rstart:' + p.id, 12, 60)) return [429, { error: 'rate' }];
    const prev = await json(runs, 'a/' + p.id); if (prev) await runs.delete('r/' + prev.runId);   // partida anterior abandonada
    const runId = b64u(randomBytes(9)), key = b64u(randomBytes(24)), t = now();
    await runs.setJSON('r/' + runId, { id: runId, p: p.id, key, c: CHAR_IDS.includes(body.c) ? body.c : 'cacador', a: ARENA_IDS.includes(body.a) ? body.a : 'cemiterio', t0: t, tw: t, w: 0, k: 0, bad: 0 });
    await runs.setJSON('a/' + p.id, { runId });
    return [200, { runId, key }];
  };

  // um checkpoint por onda concluída: guarda o progresso e marca incoerências (sem avisar o cliente)
  R['POST /run/checkpoint'] = async ({ p, body }) => {
    const run = await json(runs, 'r/' + String(body.runId));
    if (!run || run.p !== p.id) return [404, { error: 'no_run' }];
    const wave = num(body.wave), kills = num(body.kills), level = num(body.level);
    if (![wave, kills, level].every(Number.isFinite) || !safeEq(sign(run.key, 'c', run.id, wave, kills, level), String(body.sig))) { run.bad++; await runs.setJSON('r/' + run.id, run); return [200, { ok: true }]; }
    if (wave > run.w) {
      const t = now();
      const need = sumWaves(run.w + 1, Math.min(wave, MAX_WAVE), i => (waveDur(i) - 1) * 1000);
      if (wave > MAX_WAVE || t - run.tw < need) run.bad++;                                                 // rápido demais
      const dk = kills - run.k, maxDk = sumWaves(run.w + 1, Math.min(wave, MAX_WAVE), maxKillsWave);
      if (dk < 0 || dk > maxDk) run.bad++;                                                                  // mortes impossíveis
      if (level < 1 || level > earnedLevel(kills)) run.bad++;
      run.w = wave; run.k = kills; run.tw = t;
      await runs.setJSON('r/' + run.id, run);
    }
    return [200, { ok: true }];
  };

  async function placeOnBoard(p, e){
    const wk = weekId(e.t);
    const ptr = (await json(lb, 'ptr/' + p.id)) ?? {};
    const out = {};
    // todos os tempos
    const keyAll = `all/${inv8(e.s)}-${p.id}`;
    if (!ptr.all || e.s > (ptr.allScore ?? -1)) { if (ptr.all && ptr.all !== keyAll) await lb.delete(ptr.all); await lb.setJSON(keyAll, e); ptr.all = keyAll; ptr.allScore = e.s; }
    out.all = await countBefore(lb, 'all/', ptr.all);
    // semana
    const keyWk = `week/${wk}/${inv8(e.s)}-${p.id}`;
    if (!ptr.week || ptr.week.id !== wk || e.s > (ptr.week.score ?? -1)) {
      if (ptr.week?.key && ptr.week.key !== keyWk) await lb.delete(ptr.week.key);
      await lb.setJSON(keyWk, e); ptr.week = { id: wk, key: keyWk, score: e.s };
    }
    out.week = await countBefore(lb, `week/${wk}/`, ptr.week.key);
    await lb.setJSON('ptr/' + p.id, ptr);
    return out;
  }

  R['POST /run/finish'] = async ({ p, body }) => {
    if (await limited('rfin:' + p.id, 12, 60)) return [429, { error: 'rate' }];
    const run = await json(runs, 'r/' + String(body.runId));
    if (!run || run.p !== p.id) return [404, { error: 'no_run' }];
    await runs.delete('r/' + run.id); await runs.delete('a/' + p.id);                // cada partida só conta uma vez
    const cleared = num(body.cleared), kills = num(body.kills), level = num(body.level), win = !!body.win;
    const t = now();
    let ok = run.bad === 0 && [cleared, kills, level].every(Number.isFinite) && safeEq(sign(run.key, 'f', run.id, cleared, kills, level), String(body.sig));
    if (ok) {
      ok = cleared >= 0 && cleared <= MAX_WAVE && cleared >= run.w && kills >= run.k && kills <= 5e5
        && level >= 1 && level <= earnedLevel(kills)
        && (!win || cleared >= WIN_WAVE)
        && t - run.t0 <= 8 * 3600e3
        && t - run.t0 >= sumWaves(1, cleared, i => (waveDur(i) - 1) * 1000)                  // tempo total mínimo
        && t - run.tw >= sumWaves(run.w + 1, cleared, i => (waveDur(i) - 1) * 1000)          // tempo desde o último checkpoint
        && kills - run.k <= sumWaves(run.w + 1, cleared + 1, maxKillsWave);                  // + a onda em curso
    }
    if (!ok) { p.flags = (p.flags || 0) + 1; await players.setJSON('p/' + p.id, p); return [200, { ok: true, verified: false }]; }
    const s = scoreOf(cleared, kills, win);
    p.prog = mergeProg(p.prog, { best: cleared, kills: p.prog.kills + kills, bosses: p.prog.bosses + Math.floor(cleared / 6), wins: p.prog.wins + (win ? 1 : 0) });
    await players.setJSON('p/' + p.id, p);
    if (cleared < 1) return [200, { ok: true, verified: true, score: s, rank: {} }];
    const entry = { n: p.name, p: p.id, s, w: cleared, k: kills, lv: level, c: run.c, a: run.a, win, t };
    const rank = await placeOnBoard(p, entry);
    return [200, { ok: true, verified: true, score: s, rank, prog: p.prog }];
  };

  /* ------------------------------- ranking ------------------------------- */
  R['GET /leaderboard'] = async ({ query, p, ip }) => {
    if (memLimited('lb:' + (p?.id || ip), 60, 60)) return [429, { error: 'rate' }];
    const scope = query.get('scope') === 'week' ? 'week' : 'all';
    const limit = Math.max(1, Math.min(50, +query.get('limit') || 25));
    const prefix = scope === 'week' ? `week/${weekId(now())}/` : 'all/';
    const keys = await listKeys(lb, prefix, limit);
    const entries = (await Promise.all(keys.map(k => json(lb, k)))).filter(Boolean)
      .map((e, i) => ({ rank: i + 1, name: e.n, score: e.s, wave: e.w, kills: e.k, level: e.lv, char: e.c, arena: e.a, win: !!e.win, t: e.t, me: !!p && e.p === p.id }));
    let me = null;
    if (p) {
      const ptr = await json(lb, 'ptr/' + p.id);
      const key = scope === 'week' ? (ptr?.week?.id === weekId(now()) ? ptr.week.key : null) : ptr?.all;
      if (key) { const e = await json(lb, key); if (e) me = { rank: await countBefore(lb, prefix, key), score: e.s, wave: e.w }; }
    }
    return [200, { scope, week: weekId(now()), entries, me }];
  };

  R['GET /ping'] = async () => [200, { ok: true, t: now() }];

  /* ----------------------------- moderação ----------------------------- */
  R['POST /admin'] = async ({ body, headers, ip }) => {
    if (!adminKey || await count('af:' + ip, 3600) >= 10 || !safeEq(headers['x-admin-key'] || '', adminKey)) { await hit('af:' + ip, 3600); return [403, { error: 'forbidden' }]; }
    const find = async () => {
      if (body.id) return json(players, 'p/' + body.id);
      if (body.name) { const r = await json(players, 'n/' + flatName(body.name)); return r ? json(players, 'p/' + r.id) : null; }
      return null;
    };
    if (body.action === 'list') {
      const ks = await listKeys(players, 'p/', 200);
      const all = (await Promise.all(ks.map(k => json(players, k)))).filter(Boolean);
      return [200, { players: all.map(x => ({ id: x.id, name: x.name, created: x.created, prog: x.prog, flags: x.flags || 0, banned: !!x.banned })) }];
    }
    const t = await find();
    if (!t) return [404, { error: 'not_found' }];
    if (body.action === 'remove') { await removeBoardEntries(t.id); return [200, { ok: true }]; }
    if (body.action === 'ban') { t.banned = true; await players.setJSON('p/' + t.id, t); await removeBoardEntries(t.id); return [200, { ok: true }]; }
    if (body.action === 'unban') { t.banned = false; await players.setJSON('p/' + t.id, t); return [200, { ok: true }]; }
    return [400, { error: 'bad_action' }];
  };

  const PUBLIC = new Set(['POST /profile', 'POST /login', 'GET /ping', 'POST /admin']);
  const OPTIONAL_AUTH = new Set(['GET /leaderboard']);

  /** @returns {Promise<[number, object]>} */
  return async function handle({ method, path, query = new URLSearchParams(), headers = {}, body = {}, ip = 'x' }){
    const route = `${method} ${path}`;
    const fn = R[route];
    if (!fn) return [404, { error: 'not_found' }];
    if (!PUBLIC.has(route) && !OPTIONAL_AUTH.has(route)) {
      const a = await auth(headers);
      if (!a) return [401, { error: 'auth' }];
      return fn({ body, headers, query, ip, p: a.p, tok: a.tok });
    }
    const a = OPTIONAL_AUTH.has(route) ? await auth(headers) : null;
    return fn({ body, headers, query, ip, p: a ? a.p : null });
  };
}

/** Limpeza periódica: semanas antigas, partidas abandonadas e contadores de limite. */
export async function cleanup({ lb, runs, misc, now = () => Date.now() }){
  const cur = weekId(now()), del = { weeks: 0, runs: 0, rl: 0 };
  const keepWeeks = new Set([cur, weekId(now() - 7 * 864e5), weekId(now() - 14 * 864e5)]);
  for await (const page of lb.list({ prefix: 'week/', paginate: true })) for (const b of page.blobs) { const wk = b.key.split('/')[1]; if (!keepWeeks.has(wk)) { await lb.delete(b.key); del.weeks++; } }
  for await (const page of runs.list({ prefix: 'r/', paginate: true })) for (const b of page.blobs) { const r = await runs.get(b.key, { type: 'json' }); if (!r || now() - r.t0 > 9 * 3600e3) { await runs.delete(b.key); del.runs++; } }
  for await (const page of misc.list({ prefix: 'rl/', paginate: true })) for (const b of page.blobs) { await misc.delete(b.key); del.rl++; }
  return del;
}
