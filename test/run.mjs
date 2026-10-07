import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createHandler } from '../netlify/lib/http.mjs';
import { cleanup, waveDur, maxKillsWave, earnedLevel, scoreOf, weekId, cleanName, normCode } from '../netlify/lib/api.mjs';
import { memStore } from './memstore.mjs';

let T = Date.UTC(2026, 9, 7, 12, 0, 0);
const stores = { players: memStore(), lb: memStore(), runs: memStore(), misc: memStore() };
const handler = createHandler({ ...stores, now: () => T, adminKey: 'segredo-admin' });
let ipN = 0;
async function call(method, path, { body, auth, ip, admin, raw } = {}){
  const headers = { 'content-type': 'application/json' };
  if (auth) headers.authorization = `Bearer ${auth.id}.${auth.token}`;
  if (admin) headers['x-admin-key'] = admin;
  const req = new Request('https://jogo.test/api' + path, { method, headers, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  const res = await handler(req, { ip: ip || 'ip' + (++ipN) });
  return { status: res.status, data: await res.json() };
}
const sign = (key, kind, runId, wave, kills, level) => createHmac('sha256', key).update(`${kind}|${runId}|${wave}|${kills}|${level}`).digest('hex');
const sec = s => { T += s * 1000; };
let passed = 0, failed = 0;
async function test(name, fn){ try { await fn(); passed++; console.log('  ok  ', name); } catch (e) { failed++; console.log('  FALHOU', name, '\n       ', e.message.split('\n')[0]); } }

async function newPlayer(name, ip = 'p-' + name){
  const r = await call('POST', '/profile', { body: { name }, ip });
  assert.equal(r.status, 200, 'criar perfil ' + name + ' ' + JSON.stringify(r.data));
  return { id: r.data.id, token: r.data.token, code: r.data.code, name };
}
// simula uma partida legítima até à onda `waves`, devolve o resultado do finish
async function playRun(pl, { waves, killsPerWave = 12, win = false, tamper = {} }){
  const kpw = w => typeof killsPerWave === 'function' ? killsPerWave(w) : killsPerWave;
  const st = await call('POST', '/run/start', { auth: pl, body: { c: 'cacador', a: 'cemiterio' } });
  assert.equal(st.status, 200);
  const { runId, key } = st.data; let kills = 0;
  for (let w = 1; w <= waves; w++) {
    sec(waveDur(w) + 4); kills += kpw(w);
    const level = earnedLevel(kills);
    await call('POST', '/run/checkpoint', { auth: pl, body: { runId, wave: w, kills, level, sig: sign(key, 'c', runId, w, kills, level) } });
  }
  sec(10);
  const level = earnedLevel(kills), body = { runId, cleared: waves, kills, level, win, ...tamper };
  body.sig = tamper.sig ?? sign(key, 'f', runId, body.cleared, body.kills, body.level);
  return { runId, key, res: await call('POST', '/run/finish', { auth: pl, body }) };
}

console.log('\nRegras e utilitários');
await test('nomes: aceita bons e recusa maus', () => {
  assert.equal(cleanName('  Rafa  '), 'Rafa'); assert.equal(cleanName('João_77'), 'João_77');
  for (const bad of ['ab', 'a'.repeat(20), '<script>', 'x y!', 'Caralho99', 'Fuck_You', 'admin', 'Moderador', 'CU', 'f0d3r_t0d0s'.replace('f0d3r', 'foder')]) assert.equal(cleanName(bad), null, bad);
});
await test('códigos: normalização tolera maiúsculas, traços e confusões O/0 I/1', () => assert.equal(normCode(' ab-cd o1l '), 'ABCD01' + '1'));
await test('limite de mortes por onda é razoável (nem curto demais, nem frouxo demais)', () => {
  const t = [1, 5, 6, 12, 18, 24, 30].map(n => `${n}:${maxKillsWave(n)}`).join('  ');
  console.log('        ', t);
  assert.ok(maxKillsWave(1) >= 30 && maxKillsWave(1) <= 80); assert.ok(maxKillsWave(30) > 400 && maxKillsWave(30) < 1500);
});

console.log('\nContas');
let ana, bia, caio;
await test('criar perfil devolve id, token e código', async () => {
  ana = await newPlayer('Ana');
  assert.match(ana.code, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
});
await test('nome repetido (mesmo ignorando acentos/maiúsculas) é recusado', async () => {
  assert.equal((await call('POST', '/profile', { body: { name: 'ANA' }, ip: 'z1' })).status, 409);
  assert.equal((await call('POST', '/profile', { body: { name: 'Aná' }, ip: 'z2' })).status, 409);
});
await test('nome inválido ou impróprio é recusado', async () => {
  assert.equal((await call('POST', '/profile', { body: { name: 'a' }, ip: 'z3' })).status, 400);
  assert.equal((await call('POST', '/profile', { body: { name: 'MerdaSeca' }, ip: 'z4' })).status, 400);
});
await test('/me exige autenticação válida', async () => {
  assert.equal((await call('GET', '/me')).status, 401);
  assert.equal((await call('GET', '/me', { auth: { id: ana.id, token: 'x'.repeat(43) } })).status, 401);
  const r = await call('GET', '/me', { auth: ana }); assert.equal(r.status, 200); assert.equal(r.data.name, 'Ana');
});
await test('entrar noutro aparelho com o código (formato livre)', async () => {
  const r = await call('POST', '/login', { body: { code: ana.code.toLowerCase().replace(/-/g, ' ') }, ip: 'l1' });
  assert.equal(r.status, 200); assert.equal(r.data.name, 'Ana');
  assert.equal((await call('GET', '/me', { auth: { id: r.data.id, token: r.data.token } })).status, 200);
  assert.equal((await call('GET', '/me', { auth: ana })).status, 200, 'o aparelho original continua válido');
});
await test('código errado: 404, e bloqueio depois de muitas tentativas', async () => {
  assert.equal((await call('POST', '/login', { body: { code: 'AAAA-AAAA-AAAA' }, ip: 'brute' })).status, 404);
  assert.equal((await call('POST', '/login', { body: { code: 'AAAA' }, ip: 'brute' })).status, 400);
  let last; for (let i = 0; i < 20; i++) last = await call('POST', '/login', { body: { code: 'BBBB-BBBB-BBBB' }, ip: 'brute' });
  assert.equal(last.status, 429);
  assert.equal((await call('POST', '/login', { body: { code: ana.code }, ip: 'brute' })).status, 429, 'IP bloqueado nem com o código certo');
});
await test('limite de criação de perfis por IP', async () => {
  let last; for (let i = 0; i < 8; i++) last = await call('POST', '/profile', { body: { name: 'Spam' + i + 'x' }, ip: 'spam' });
  assert.equal(last.status, 429);
});
await test('sync junta progresso sem nunca baixar e com limites sensatos', async () => {
  let r = await call('POST', '/sync', { auth: ana, body: { prog: { best: 9, kills: 300, bosses: 1, wins: 0 }, sel: { c: 'bruxa', a: 'cripta' } } });
  assert.deepEqual(r.data.prog, { best: 9, kills: 300, bosses: 1, wins: 0 }); assert.equal(r.data.sel.c, 'bruxa');
  r = await call('POST', '/sync', { auth: ana, body: { prog: { best: 2, kills: 10, bosses: 0, wins: 0 } } });
  assert.equal(r.data.prog.best, 9, 'não baixa');
  r = await call('POST', '/sync', { auth: ana, body: { prog: { best: 99999, kills: 1e12, bosses: -5, wins: 'x' }, sel: { c: 'hacker', a: 'x' } } });
  assert.deepEqual(r.data.prog, { best: 120, kills: 5e6, bosses: 1, wins: 0 }); assert.deepEqual(r.data.sel, { c: 'cacador', a: 'cemiterio' });
});
await test('pedidos mal formados: JSON inválido, corpo enorme, rota desconhecida', async () => {
  assert.equal((await call('POST', '/profile', { raw: '{nope', ip: 'm1' })).status, 400);
  assert.equal((await call('POST', '/profile', { raw: JSON.stringify({ name: 'x'.repeat(20000) }), ip: 'm2' })).status, 413);
  assert.equal((await call('GET', '/naoexiste')).status, 404);
  assert.equal((await call('GET', '/profile')).status, 404);
});

console.log('\nPartidas verificadas (anti-batota)');
await test('partida legítima de 6 ondas é verificada e entra nos rankings', async () => {
  const { res } = await playRun(ana, { waves: 6, killsPerWave: 14 });
  assert.equal(res.data.verified, true, JSON.stringify(res.data));
  assert.equal(res.data.score, scoreOf(6, 84, false)); assert.equal(res.data.rank.all, 1); assert.equal(res.data.rank.week, 1);
});
await test('o servidor recalcula a pontuação (o cliente não a pode inventar)', async () => {
  const { res } = await playRun(ana, { waves: 4, killsPerWave: 10, tamper: { score: 999999 } });
  assert.equal(res.data.score, scoreOf(4, 40, false));
});
await test('terminar uma partida sem a jogar (onda 30 de imediato) não é verificado', async () => {
  const st = await call('POST', '/run/start', { auth: ana, body: {} });
  sec(5);
  const { runId, key } = st.data, lvl = earnedLevel(5000);
  const r = await call('POST', '/run/finish', { auth: ana, body: { runId, cleared: 30, kills: 5000, level: lvl, win: true, sig: sign(key, 'f', runId, 30, 5000, lvl) } });
  assert.equal(r.data.verified, false);
});
await test('checkpoints forjados a alta velocidade (sem esperar o tempo das ondas) falham', async () => {
  const st = await call('POST', '/run/start', { auth: ana, body: {} }); const { runId, key } = st.data;
  for (let w = 1; w <= 10; w++) { sec(2); await call('POST', '/run/checkpoint', { auth: ana, body: { runId, wave: w, kills: w * 10, level: earnedLevel(w * 10), sig: sign(key, 'c', runId, w, w * 10, earnedLevel(w * 10)) } }); }
  sec(2); const lvl = earnedLevel(100);
  const r = await call('POST', '/run/finish', { auth: ana, body: { runId, cleared: 10, kills: 100, level: lvl, win: false, sig: sign(key, 'f', runId, 10, 100, lvl) } });
  assert.equal(r.data.verified, false);
});
await test('mortes impossíveis para o tempo/onda não são verificadas', async () => {
  const { res } = await playRun(ana, { waves: 3, killsPerWave: 400 });
  assert.equal(res.data.verified, false);
});
await test('assinatura inválida não é verificada', async () => {
  const { res } = await playRun(ana, { waves: 3, tamper: { sig: 'f'.repeat(64) } });
  assert.equal(res.data.verified, false);
});
await test('alterar os números depois de assinar (mais ondas/mortes) não é verificado', async () => {
  const r1 = await playRun(ana, { waves: 3, killsPerWave: 12 });
  const st = await call('POST', '/run/start', { auth: ana, body: {} }); const { runId, key } = st.data;
  sec(200); const lvl = earnedLevel(36);
  const sig = sign(key, 'f', runId, 3, 36, lvl);
  const r = await call('POST', '/run/finish', { auth: ana, body: { runId, cleared: 25, kills: 36, level: lvl, win: false, sig } });
  assert.equal(r.data.verified, false); assert.ok(r1.res.data.verified);
});
await test('vitória com menos de 30 ondas não é verificada', async () => {
  const { res } = await playRun(ana, { waves: 5, win: true });
  assert.equal(res.data.verified, false);
});
await test('nível incoerente com as mortes não é verificado', async () => {
  const st = await call('POST', '/run/start', { auth: ana, body: {} }); const { runId, key } = st.data;
  sec(30); const kills = 12, lvl = 9;
  await call('POST', '/run/checkpoint', { auth: ana, body: { runId, wave: 1, kills, level: lvl, sig: sign(key, 'c', runId, 1, kills, lvl) } });
  sec(5);
  const r = await call('POST', '/run/finish', { auth: ana, body: { runId, cleared: 1, kills, level: lvl, win: false, sig: sign(key, 'f', runId, 1, kills, lvl) } });
  assert.equal(r.data.verified, false);
});
await test('uma partida só conta uma vez (repetir o finish falha)', async () => {
  const { runId, key, res } = await playRun(ana, { waves: 2 });
  assert.equal(res.data.verified, true);
  const lvl = earnedLevel(24);
  assert.equal((await call('POST', '/run/finish', { auth: ana, body: { runId, cleared: 2, kills: 24, level: lvl, win: false, sig: sign(key, 'f', runId, 2, 24, lvl) } })).status, 404);
});
await test('não se pode usar a partida de outro jogador', async () => {
  bia = await newPlayer('Bia');
  const st = await call('POST', '/run/start', { auth: ana, body: {} });
  const r = await call('POST', '/run/finish', { auth: bia, body: { runId: st.data.runId, cleared: 1, kills: 1, level: 1, win: false, sig: 'x' } });
  assert.equal(r.status, 404);
});
await test('perder uma ligação a meio (checkpoint em falta) continua verificável', async () => {
  const st = await call('POST', '/run/start', { auth: bia, body: {} }); const { runId, key } = st.data; let kills = 0;
  for (let w = 1; w <= 4; w++) { sec(waveDur(w) + 3); kills += 12; if (w === 2) continue; const l = earnedLevel(kills); await call('POST', '/run/checkpoint', { auth: bia, body: { runId, wave: w, kills, level: l, sig: sign(key, 'c', runId, w, kills, l) } }); }
  sec(8); const l = earnedLevel(kills);
  const r = await call('POST', '/run/finish', { auth: bia, body: { runId, cleared: 4, kills, level: l, win: false, sig: sign(key, 'f', runId, 4, kills, l) } });
  assert.equal(r.data.verified, true, JSON.stringify(r.data));
});
await test('partida de 30 ondas ganha, com tempo real, é verificada (e dá pontos de vitória)', async () => {
  caio = await newPlayer('Caio');
  const { res } = await playRun(caio, { waves: 30, killsPerWave: w => Math.floor(maxKillsWave(w) * .4), win: true });
  assert.equal(res.data.verified, true, JSON.stringify(res.data)); assert.equal(res.data.rank.all, 1);
});
await test('um jogador com várias tentativas falhadas acumula "flags" (visível ao admin)', async () => {
  const r = await call('POST', '/admin', { body: { action: 'list' }, admin: 'segredo-admin', ip: 'adm' });
  const a = r.data.players.find(x => x.name === 'Ana'); assert.ok(a.flags >= 5, 'flags=' + a.flags);
});

console.log('\nRankings');
await test('ranking global ordenado, um resultado por jogador (o melhor)', async () => {
  const r = await call('GET', '/leaderboard?scope=all&limit=10', { auth: caio });
  const names = r.data.entries.map(e => e.name);
  assert.deepEqual(names, ['Caio', 'Ana', 'Bia'], names.join(','));
  assert.ok(r.data.entries[0].score > r.data.entries[1].score);
  assert.equal(r.data.entries.find(e => e.me).name, 'Caio'); assert.equal(r.data.me.rank, 1);
  assert.equal(new Set(names).size, names.length);
});
await test('um resultado pior não substitui o melhor; um melhor substitui', async () => {
  await playRun(ana, { waves: 1, killsPerWave: 5 });
  let r = await call('GET', '/leaderboard?scope=all', { auth: ana }); const before = r.data.entries.find(e => e.name === 'Ana').score;
  assert.equal(before, scoreOf(6, 84, false));
  await playRun(ana, { waves: 9, killsPerWave: 15 });
  r = await call('GET', '/leaderboard?scope=all', { auth: ana }); assert.equal(r.data.entries.filter(e => e.name === 'Ana').length, 1);
  assert.equal(r.data.entries.find(e => e.name === 'Ana').score, scoreOf(9, 135, false));
});
await test('ranking semanal só tem resultados desta semana', async () => {
  const w1 = await call('GET', '/leaderboard?scope=week', { auth: ana }); assert.ok(w1.data.entries.length >= 3);
  T += 8 * 864e5;           // daqui a 8 dias
  const w2 = await call('GET', '/leaderboard?scope=week', { auth: ana }); assert.equal(w2.data.entries.length, 0);
  const all = await call('GET', '/leaderboard?scope=all', { auth: ana }); assert.ok(all.data.entries.length >= 3, 'o global mantém-se');
});
await test('o ranking é público (sem sessão) e limita o tamanho', async () => {
  const r = await call('GET', '/leaderboard?scope=all&limit=2'); assert.equal(r.status, 200); assert.equal(r.data.entries.length, 2); assert.equal(r.data.me, null);
  assert.ok(!('id' in r.data.entries[0]) && !('p' in r.data.entries[0]), 'não expõe ids');
});
await test('mudar de nome atualiza o ranking e respeita nomes já usados', async () => {
  assert.equal((await call('POST', '/rename', { auth: bia, body: { name: 'Caio' } })).status, 409);
  assert.equal((await call('POST', '/rename', { auth: bia, body: { name: 'Beatriz' } })).status, 200);
  const r = await call('GET', '/leaderboard?scope=all'); assert.ok(r.data.entries.some(e => e.name === 'Beatriz')); assert.ok(!r.data.entries.some(e => e.name === 'Bia'));
});

console.log('\nSegurança e moderação');
await test('novo código invalida o antigo e os outros aparelhos', async () => {
  const other = (await call('POST', '/login', { body: { code: caio.code }, ip: 'nc1' })).data;
  const nc = await call('POST', '/newcode', { auth: caio }); assert.equal(nc.status, 200); assert.notEqual(nc.data.code, caio.code);
  assert.equal((await call('POST', '/login', { body: { code: caio.code }, ip: 'nc2' })).status, 404);
  assert.equal((await call('GET', '/me', { auth: { id: other.id, token: other.token } })).status, 401, 'aparelho antigo perde acesso');
  assert.equal((await call('GET', '/me', { auth: caio })).status, 200, 'o atual mantém-se');
  assert.equal((await call('POST', '/login', { body: { code: nc.data.code }, ip: 'nc3' })).status, 200);
});
await test('admin: sem chave ou com chave errada é recusado', async () => {
  assert.equal((await call('POST', '/admin', { body: { action: 'list' }, ip: 'a1' })).status, 403);
  assert.equal((await call('POST', '/admin', { body: { action: 'list' }, admin: 'errada', ip: 'a1' })).status, 403);
});
await test('admin: banir remove do ranking e bloqueia a conta', async () => {
  assert.equal((await call('POST', '/admin', { body: { action: 'ban', name: 'Ana' }, admin: 'segredo-admin', ip: 'a2' })).status, 200);
  const r = await call('GET', '/leaderboard?scope=all'); assert.ok(!r.data.entries.some(e => e.name === 'Ana'));
  assert.equal((await call('GET', '/me', { auth: ana })).status, 401);
  assert.equal((await call('POST', '/login', { body: { code: ana.code }, ip: 'a3' })).status, 404);
  assert.equal((await call('POST', '/admin', { body: { action: 'unban', name: 'Ana' }, admin: 'segredo-admin', ip: 'a2' })).status, 200);
  assert.equal((await call('GET', '/me', { auth: ana })).status, 200);
});
await test('apagar a conta remove tudo (perfil, nome, código e ranking)', async () => {
  assert.equal((await call('POST', '/delete', { auth: caio })).status, 200);
  assert.equal((await call('GET', '/me', { auth: caio })).status, 401);
  const r = await call('GET', '/leaderboard?scope=all'); assert.ok(!r.data.entries.some(e => e.name === 'Caio'));
  const again = await call('POST', '/profile', { body: { name: 'Caio' }, ip: 'del1' }); assert.equal(again.status, 200, 'o nome fica livre');
});
await test('limpeza periódica remove semanas antigas e partidas abandonadas', async () => {
  await playRun(ana, { waves: 2 });
  T += 20 * 864e5; await call('POST', '/run/start', { auth: ana, body: {} }); T += 10 * 3600e3;
  const out = await cleanup({ ...stores, now: () => T });
  assert.ok(out.weeks >= 1, JSON.stringify(out)); assert.ok(out.runs >= 1, JSON.stringify(out));
});
await test('weekId (ISO) está certo', () => { assert.equal(weekId(Date.UTC(2026, 0, 1)), '2026-W01'); assert.equal(weekId(Date.UTC(2026, 11, 31)), '2026-W53'); });

console.log(`\n${passed} testes passaram, ${failed} falharam.`);
process.exit(failed ? 1 : 0);
