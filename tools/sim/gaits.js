// V2 F2.6: velocidad por ronda con 3 pasos (caminar / trotar / correr). Reemplaza ZOMBIE.speed(n) de V1.
const G = require('./harness.js');
const { state, player, CONFIG } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const Z = CONFIG.ZOMBIE, GA = Z.gaits;

// 1) números y la regla: nunca más rápido que el jugador caminando (igual sí)
check(GA.walk.speed === 1.6 && GA.jog.speed === 2.6 && GA.run.speed === 4.0, 'velocidades 1.6 / 2.6 / 4.0');
check(GA.run.speed * (1 + Z.speedJitter) <= CONFIG.PLAYER.speed + 1e-9, 'correr (con el ±10% de variación) <= caminar del jugador',
  `(${(GA.run.speed * (1 + Z.speedJitter)).toFixed(2)} <= ${CONFIG.PLAYER.speed})`);
check(Z.speed === undefined, 'la fórmula de velocidad de V1 ya no existe');

// 2) mezcla por ronda (4000 sorteos por ronda)
const want = {
  1: { walk: 1 }, 3: { walk: 1 }, 4: { walk: 1 }, 5: { jog: 0.8, walk: 0.2 }, 6: { jog: 1 }, 8: { jog: 1 },
  9: { jog: 0.6, run: 0.4 }, 11: { jog: 0.6, run: 0.4 }, 12: { run: 1 }, 15: { run: 1 }, 30: { run: 1 }
};
for (const n in want) {
  const cnt = { walk: 0, jog: 0, run: 0 }, N = 4000;
  for (let i = 0; i < N; i++) cnt[G.rollGait(+n)]++;
  const ok = ['walk', 'jog', 'run'].every(k => Math.abs(cnt[k] / N - (want[n][k] || 0)) <= 0.03);
  check(ok, `ronda ${n}`, `(caminan ${(cnt.walk / N * 100).toFixed(0)}% · trotan ${(cnt.jog / N * 100).toFixed(0)}% · corren ${(cnt.run / N * 100).toFixed(0)}%)`);
}

// 3) el spawn usa la tabla; el respawn conserva paso y vida
G.resetGame(); state.running = true; G.debugOpenAllDoors();
state.round = 5; player.pos.set(0, 1.7, 10); G.updateFlowField(true);
const zs = [];
for (let i = 0; i < 20; i++) { const q = G.spawnZombie(); if (q) zs.push(q); }
check(zs.length > 10 && zs.every(q => q.gait === 'walk' || q.gait === 'jog'), 'ronda 5: spawnean caminando o trotando', `(${zs.length})`);
check(zs.every(q => Math.abs(q.speed / GA[q.gait].speed - 1) <= Z.speedJitter + 1e-9), 'velocidad = la de su paso ±10%');
// con un paso más rápido que el jugador (config mal puesta), el spawn igual recorta a PLAYER.speed
const runSpd = GA.run.speed; GA.run.speed = 9;
state.round = 30; let fast = null;
for (let i = 0; i < 5 && !fast; i++) fast = G.spawnZombie();
GA.run.speed = runSpd;
check(fast && fast.speed <= CONFIG.PLAYER.speed + 1e-9, 'aunque el paso diga 9 m/s, el zombie no pasa de PLAYER.speed', `(${fast && fast.speed.toFixed(2)})`);
const q0 = zs.find(q => q.gait === 'jog') || zs[0], g0 = q0.gait, h0 = (q0.health = 123);
state.round = 12;                                   // aunque cambie la ronda, el respawn no re-sortea
G.respawnZombie(q0);
check(q0.gait === g0 && q0.health === h0, 'respawn (atascado): mismo paso y misma vida');
for (const q of state.zombies.slice()) { q.active = false; q.alive = false; q.root.visible = false; }
state.zombies.length = 0;

// 4) la separación no los empuja por encima del jugador caminando: 8 corredores apelotonados persiguiendo
G.resetGame(); state.running = true; G.debugOpenAllDoors();
state.round = 12; G.startRound(12);
player.pos.set(0, 1.7, -20); G.updateFlowField(true);
const pack = [];
for (let i = 0; i < 8; i++) {
  const q = G.spawnZombie(); if (!q) continue;
  q.state = 'walk'; q.gait = 'run'; q.speed = GA.run.speed * (1 + Z.speedJitter);
  q.px = -1 + (i % 4) * 0.25; q.pz = -8 - Math.floor(i / 4) * 0.25;     // pegados: separación al máximo
  pack.push(q);
}
let vmax = 0;
for (let i = 0; i < 90; i++) {
  const prev = pack.map(q => [q.px, q.pz]);
  state.health = 100; state.lastDamageTime = -99;
  G.tick(1 / 60); G.updateFlowField(false); G.updateZombies(1 / 60);
  pack.forEach((q, k) => { if (q.state === 'walk') vmax = Math.max(vmax, Math.hypot(q.px - prev[k][0], q.pz - prev[k][1]) * 60); });
}
check(vmax > GA.run.speed * 0.9 && vmax <= CONFIG.PLAYER.speed + 1e-6, 'con la separación empujando, ninguno supera al jugador caminando',
  `(máx ${vmax.toFixed(2)} m/s)`);

// 5) visual: inclinación y ritmo del bob crecen de caminar a correr
const q = pack[0], res = {};
for (const g of ['walk', 'jog', 'run']) {
  q.gait = g; q.walkT = 0; q.swingT = 0;
  G.animateZombie(q, 0.1, GA[g].speed);
  res[g] = { lean: q.body.rotation.x, rate: q.walkT };
}
check(res.walk.lean < res.jog.lean && res.jog.lean < res.run.lean, 'inclinación: caminar < trotar < correr',
  `(${res.walk.lean.toFixed(2)} / ${res.jog.lean.toFixed(2)} / ${res.run.lean.toFixed(2)} rad)`);
check(res.walk.rate < res.jog.rate && res.jog.rate < res.run.rate, 'ritmo del bob: caminar < trotar < correr',
  `(${(res.walk.rate * 10).toFixed(1)} / ${(res.jog.rate * 10).toFixed(1)} / ${(res.run.rate * 10).toFixed(1)} rad/s)`);

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
