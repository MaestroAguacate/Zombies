// V2 F0.3: costo de navegación con 24 zombies vivos (flow field + IA + colisión), en el sótano, que es el
// cuarto con más props. Presupuesto del roadmap: < 1 ms por frame. Se usa la MEDIANA de muchos frames para
// que un tirón del sistema operativo no haga fallar el test al azar.
// NOTA: el roadmap pide medirlo en el "mapa V2", que todavía no existe (F1). Se vuelve a correr en F1.
const G = require('./harness.js');
const { state, player, CONFIG, FLOW } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const BUDGET_MS = 1.0;

check(CONFIG.ZOMBIE.repathMs === 250, 'flow field cada 250 ms', `(${CONFIG.ZOMBIE.repathMs})`);

G.resetGame(); state.running = true; G.debugOpenAllDoors();
const cap = CONFIG.ROUNDS.maxAlive;
CONFIG.ROUNDS.maxAlive = 24;                       // solo para llenar el pool en el test
player.pos.set(-10, 1.7, 36); G.setCam(0);
G.startRound(10); G.updateFlowField(true);
const dt = 1 / 60, keepAlive = () => { state.health = 100; state.lastDamageTime = -99; state.gameOver = false; };
for (let i = 0; i < 60 * 60 && G.aliveCount() < 24; i++) {
  G.tick(dt); G.updateRounds(dt); G.updateFlowField(false); G.updateZombies(dt); keepAlive();
}
CONFIG.ROUNDS.maxAlive = cap;
check(G.aliveCount() === 24, '24 zombies vivos', `(${G.aliveCount()})`);

// medir: 20 s simulados. El jugador se mueve en círculo para forzar recálculos reales del campo.
const frames = [], bfs = [];
let recalcs = 0, lastCalc = FLOW.lastCalc;
const now = () => Number(process.hrtime.bigint()) / 1e6;
for (let i = 0; i < 60 * 20; i++) {
  const a = i / 60 * 0.8;
  player.pos.set(-10 + Math.cos(a) * 3, 1.7, 35 + Math.sin(a) * 2.5);
  G.tick(dt);
  const t0 = now();
  G.updateFlowField(false);
  const t1 = now();
  G.updateZombies(dt);
  const t2 = now();
  keepAlive();
  frames.push(t2 - t0);
  if (FLOW.lastCalc !== lastCalc) { recalcs++; lastCalc = FLOW.lastCalc; bfs.push(t1 - t0); }
}
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const p95 = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * 0.95)]; };
const expected = 20000 / CONFIG.ZOMBIE.repathMs;
check(Math.abs(recalcs - expected) <= 2, 'recalcula ~4 veces por segundo', `(${recalcs} en 20 s)`);
check(med(frames) < BUDGET_MS, 'navegación por frame < 1 ms (mediana)',
  `(mediana ${med(frames).toFixed(3)} ms · p95 ${p95(frames).toFixed(3)} ms · BFS mediana ${med(bfs).toFixed(3)} ms)`);
const lost = state.zombies.filter(z => z.alive && (z.mode === 'lost' || z.mode === 'unreachable')).length;
check(lost === 0, 'ningún zombie perdido al final de la medición', `(${lost})`);

// F1.1: hash espacial de colliders. Tiene que dar EXACTAMENTE lo mismo que recorrer todos.
function segRef(x0, z0, x1, z1, pad, shotOnly) {
  const dx = x1 - x0, dz = z1 - z0;
  for (const c of G.WORLD.colliders) {
    if (!c.solid || (shotOnly && !c.mesh) || c.overhead) continue;   // F2.8: en el piso, lo de arriba no cuenta
    const minX = c.minX - pad, maxX = c.maxX + pad, minZ = c.minZ - pad, maxZ = c.maxZ + pad;
    let tmin = 0, tmax = 1;
    if (Math.abs(dx) < 1e-9) { if (x0 < minX || x0 > maxX) continue; }
    else { let t1 = (minX - x0) / dx, t2 = (maxX - x0) / dx; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) continue; }
    if (Math.abs(dz) < 1e-9) { if (z0 < minZ || z0 > maxZ) continue; }
    else { let t1 = (minZ - z0) / dz, t2 = (maxZ - z0) / dz; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) continue; }
    return false;
  }
  return true;
}
function moveRef(o, axis, delta, r) {
  if (axis === 'x') o.px += delta; else o.pz += delta;
  for (const c of G.WORLD.colliders) {
    if (!c.solid || c.overhead) continue;
    if (o.px + r <= c.minX || o.px - r >= c.maxX || o.pz + r <= c.minZ || o.pz - r >= c.maxZ) continue;
    if (axis === 'x') o.px = delta > 0 ? c.minX - r - 0.001 : c.maxX + r + 0.001;
    else              o.pz = delta > 0 ? c.minZ - r - 0.001 : c.maxZ + r + 0.001;
  }
}
let seed = 7;
const rnd = (a, b) => { seed = (seed * 16807) % 2147483647; return a + (b - a) * seed / 2147483647; };
function compareAll(n) {
  let bad = 0;
  for (let i = 0; i < n; i++) {
    const x = rnd(-22, 33), z = rnd(-42, 43), len = rnd(0, 1) < 0.8 ? rnd(0, 4) : rnd(4, 60), a = rnd(0, 6.3);
    const pad = [0, 0.02, 0.2][i % 3], shot = i % 4 === 0;
    if (G.segmentClear(x, z, x + Math.cos(a) * len, z + Math.sin(a) * len, pad, shot) !==
        segRef(x, z, x + Math.cos(a) * len, z + Math.sin(a) * len, pad, shot)) bad++;
    const axis = i % 2 ? 'x' : 'z', d = rnd(-0.3, 0.3), r = CONFIG.ZOMBIE.radius;
    const o1 = { px: x, pz: z }, o2 = { px: x, pz: z };
    G.moveCircle(o1, axis, d, r); moveRef(o2, axis, d, r);
    if (o1.px !== o2.px || o1.pz !== o2.pz) bad++;
  }
  return bad;
}
G.resetGame(); state.running = true;
check(compareAll(20000) === 0, 'hash de colliders = recorrer todos (puertas cerradas, 20000 casos)');
G.debugOpenAllDoors();
check(compareAll(20000) === 0, 'hash de colliders = recorrer todos (puertas abiertas)');
G.placeBox('R10');
const bc = G.BOX.collider;
check(compareAll(20000) === 0 && !G.segmentClear((bc.minX + bc.maxX) / 2, bc.minZ - 1, (bc.minX + bc.maxX) / 2, bc.maxZ + 1, 0),
  'el hash sigue a la caja cuando se muda');
check(G.COLHASH.n === G.WORLD.colliders.length && !G.COLHASH.dirty, 'hash al día', `(${G.COLHASH.w}x${G.COLHASH.h} celdas de ${G.COLHASH.size} m)`);

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
