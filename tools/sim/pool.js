// V2 F2.6: piscina. Zombies que quedaban atrapados en el fondo (el origen del flow field caía dentro de la
// pileta con el jugador en la orilla este), escaleras para zombies y el jugador que se tira desde el borde.
const G = require('./harness.js');
const { state, player, CONFIG, WORLD, keys, POOL, NAV, FLOW } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const E = 0.01, r = CONFIG.PLAYER.radius;

function fresh() {
  G.resetGame(); state.running = true; G.debugOpenAllDoors(); G.startRound(1);
}
function clearZombies() {
  for (const q of state.zombies.slice()) { q.active = false; q.alive = false; q.state = 'idle'; q.root.visible = false; }
  state.zombies.length = 0;
}
function zombieAt(x, z, gait) {
  const q = G.spawnZombie();
  q.state = 'walk'; q.px = x; q.pz = z; q.mode = 'flow';
  if (gait) { q.gait = gait; q.speed = CONFIG.ZOMBIE.gaits[gait].speed; }
  return q;
}
const rims = WORLD.colliders.filter(c => c.tag === 'poolRim');
const inPool = (x, z) => G.groundY(x, z) < -0.5;
// corre hasta que el zombie le pega al jugador (vida < 100). Devuelve métricas
function chase(q, px, pz, secs) {
  player.pos.set(px, 1.7 + G.groundY(px, pz), pz); G.updateFlowField(true);
  let hit = -1, strikes = 0, crossed = 0, climbs = 0, wasClimb = false, ramp = false;
  const zr = CONFIG.ZOMBIE.radius - 0.02;
  for (let i = 0; i < secs * 60 && hit < 0; i++) {
    state.health = 100; state.lastDamageTime = -99;
    G.tick(1 / 60); G.updateFlowField(false); G.updateZombies(1 / 60);
    if (state.health < 100) hit = i / 60;
    strikes = Math.max(strikes, q.strikes);
    if (q.state === 'climb' && !wasClimb) climbs++;
    wasClimb = q.state === 'climb';
    if (q.state !== 'climb' && rims.some(c => q.px + zr > c.minX && q.px - zr < c.maxX && q.pz + zr > c.minZ && q.pz - zr < c.maxZ)) crossed++;
    if (q.pz > POOL.z1 && q.pz < POOL.rampEnd && q.px > POOL.x1 && q.px < POOL.x2) ramp = true;
  }
  return { hit, strikes, crossed, climbs, ramp };
}

// 1) geometría: la franja este ahora es caminable, las 3 escaleras son enlaces del grid
fresh();
let cols = 0;
for (let z = 9; z < 17; z++) if (G.isNav(29, z)) cols++;
check(cols === 8, 'franja este (x 29.5) navegable a lo largo de la pileta', `(${cols}/8)`);
check(G.ROOMS.find(q => q.id === 'R8').x2 >= 31, 'R8 llega por lo menos a x=31 (F5.8: 35)');
const links = POOL.ladders.filter(L => {
  const a = G.navIdx(L.bot[0], L.bot[1]), b = G.navIdx(L.top[0], L.top[1]);
  return NAV.link[a] === b && NAV.link[b] === a && inPool(L.bot[0] + 0.5, L.bot[1] + 0.5) && !inPool(L.top[0] + 0.5, L.top[1] + 0.5);
});
check(links.length === 3, '3 escaleras: abajo en la pileta, arriba en la orilla, enlazadas', `(${links.map(L => L.id).join(',')})`);

// 2) causa raíz: el origen del flow field nunca queda del otro lado del borde
const rimSpots = [[28.5, 16.5], [28.5, 13], [28.5, 10], [21.7, 13], [25, 17.4], [29.4, 12]];
const bad = rimSpots.filter(([x, z]) => {
  player.pos.set(x, 1.7, z); G.updateFlowField(true);
  return inPool(FLOW.srcX + 0.5, FLOW.srcZ + 0.5);
});
check(bad.length === 0, 'jugador en la orilla: el origen del campo queda en la orilla, no en la pileta', bad.length ? JSON.stringify(bad) : '');

// 3) zombie en el fondo, jugador en cada orilla: sube por una escalera o la rampa y le pega
const cases = [
  ['orilla este, a la altura de la caja (28.5, 16.5)', 28.5, 16.5],
  ['orilla este, centro (29.4, 13)', 29.4, 13],
  ['orilla este, sur (28.5, 10)', 28.5, 10],
  ['orilla oeste (20.5, 13)', 20.5, 13],
  ['orilla norte (25, 18.5)', 25, 18.5]
];
for (const [name, px, pz] of cases) {
  for (const gait of ['walk', 'run']) {
    fresh(); clearZombies();
    const q = zombieAt(25.5, 15.5, gait);
    const m = chase(q, px, pz, 15);
    check(m.hit > 0 && m.hit < 12 && m.strikes === 0 && m.crossed === 0 && (m.climbs > 0 || m.ramp),
      `${gait === 'walk' ? 'camina' : 'corre'}: ${name}`,
      `(pega a los ${m.hit.toFixed(1)} s, ${m.climbs ? 'escalera' : m.ramp ? 'rampa' : '??'}, strikes ${m.strikes}, cruces ${m.crossed})`);
  }
}
// 4) al revés: zombie en la orilla, jugador en el fondo: baja y le pega
fresh(); clearZombies();
let q = zombieAt(29.5, 13.5, 'jog');
let m = chase(q, 25, 14.5, 15);
check(m.hit > 0 && m.hit < 12 && m.strikes === 0 && m.crossed === 0, 'zombie en la orilla baja al fondo y le pega', `(${m.hit.toFixed(1)} s, ${m.climbs ? 'escalera' : 'rampa'})`);
// 5) 6 zombies en el fondo a la vez contra el jugador en la orilla este: todos salen, nadie se traba
fresh(); clearZombies();
const many = [[23.5, 13.5], [24.5, 15.5], [25.5, 12.5], [26.5, 14.5], [23.5, 15.5], [26.5, 16.2]].map(([x, z]) => zombieAt(x, z, 'jog'));
player.pos.set(29.4, 1.7, 13); G.updateFlowField(true);
let maxStrikes = 0;
const out = new Set();
for (let i = 0; i < 60 * 20; i++) {
  state.health = 100; state.lastDamageTime = -99;
  G.tick(1 / 60); G.updateFlowField(false); G.updateZombies(1 / 60);
  for (const z of many) { maxStrikes = Math.max(maxStrikes, z.strikes); if (z.state === 'walk' && !inPool(z.px, z.pz)) out.add(z); }
}
check(out.size === many.length && maxStrikes < CONFIG.ZOMBIE.stuckStrikes, '6 a la vez: todos salen de la pileta, sin llegar a respawn',
  `(${out.size}/6, strikes máx ${maxStrikes})`);

// 6) el jugador se tira desde cualquier borde, y sale solo por la rampa
function walk(x, z, yaw, secs, jump) {
  player.pos.set(x, 1.7 + G.groundY(x, z), z); player.vel.set(0, 0, 0); player.yaw = yaw; player.grounded = true;
  keys.KeyW = true;
  for (let i = 0; i < secs * 60; i++) { keys.Space = !!jump && i % 20 === 0; G.tick(1 / 60); G.updatePlayer(1 / 60); }
  keys.KeyW = false; keys.Space = false;
  return player.pos.clone();
}
fresh(); clearZombies();
// yaw 0 = -z · π = +z · π/2 = -x · -π/2 = +x
let p = walk(20.5, 14, -Math.PI / 2, 2);
check(p.x > POOL.x1 && Math.abs(p.y - (1.7 - POOL.depth)) < 0.02, 'se tira desde la orilla oeste y cae al fondo', `(x ${p.x.toFixed(2)}, y ${p.y.toFixed(2)})`);
p = walk(29.4, 14, Math.PI / 2, 2);
check(p.x < POOL.x2 && p.y < 0.2, 'desde la orilla este también');
p = walk(25, 18.5, 0, 1.1);                 // corto: con 2 s cruza el fondo y sale por la rampa
check(p.z < POOL.z2 && p.y < 0.2, 'desde la orilla norte también', `(z ${p.z.toFixed(2)}, y ${p.y.toFixed(2)})`);
p = walk(25, 14, -Math.PI / 2, 2, true);
check(p.x <= POOL.x2 - 0.15 - r + E && p.y < 0.2, 'desde adentro no sube por la pared, ni saltando');
p = walk(25, 14, 0, 5);
check(p.z < POOL.z1 && Math.abs(p.y - 1.7) < 1e-6, 'sale por la rampa');

// F2.8 (bug del playtest): entrando despacio los pies quedaban bajo el borde con el cuerpo encima, el borde
// te devolvía a la orilla y el piso te subía: loop. Y resolver el borde a lo largo te teletransportaba
function enter(x0, z0, yaw, opts = {}) {
  G.resetGame(); state.running = true;
  player.pos.set(x0, 1.7 + G.groundY(x0, z0), z0); player.vel.set(0, 0, 0); player.yaw = yaw; player.grounded = true;
  if (opts.ads) { G.ADS.on = true; G.ADS.k = 1; }
  keys.KeyW = true;
  let snaps = 0, jumpy = 0, prevY = player.pos.y, prev = player.pos.clone();
  for (let i = 0; i < 150; i++) {
    keys.Space = !!opts.jump && i === 2;
    G.tick(1 / 60); G.updatePlayer(1 / 60);
    if (player.pos.y > prevY + 0.05 && !(opts.jump && i < 12)) snaps++;
    if (Math.hypot(player.pos.x - prev.x, player.pos.z - prev.z) > 0.5) jumpy++;
    prevY = player.pos.y; prev.copy(player.pos);
  }
  keys.KeyW = false; keys.Space = false; G.ADS.on = false; G.ADS.k = 0;
  return { snaps, jumpy, inPool: G.groundY(player.pos.x, player.pos.z) < -0.1 && player.pos.y < 1.6 };
}
const EAST = -Math.PI / 2;
for (const [name, args] of [['por el costado de la rampa (z 8.5)', [21.6, 8.5, EAST]], ['por el costado de la rampa (z 9.5)', [21.6, 9.5, EAST]],
  ['desde el este, costado de la rampa', [28.4, 9, Math.PI / 2]], ['apuntando (lento)', [21.6, 14, EAST, { ads: true }]],
  ['saltando', [21.0, 14, EAST, { jump: true }]]]) {
  const m = enter(...args);
  check(m.inPool && m.snaps === 0 && m.jumpy === 0, 'entra a la pileta ' + name + ' sin loop ni teletransporte', `(subidas ${m.snaps}, saltos ${m.jumpy})`);
}

// 7) el paso no se pierde en la escalera: sube y termina caminando, sin quedar a medio camino
fresh(); clearZombies();
q = zombieAt(23.5, 13.5, 'walk');
player.pos.set(20.5, 1.7, 13.5); G.updateFlowField(true);
let sawClimb = false;
for (let i = 0; i < 60 * 6; i++) { G.tick(1 / 60); G.updateFlowField(false); G.updateZombies(1 / 60); state.health = 100; if (q.state === 'climb') sawClimb = true; }
check(sawClimb && q.state === 'walk' && !inPool(q.px, q.pz) && Math.abs(q.root.position.y) < 1e-6, 'trepa y vuelve a caminar arriba (modelo a la altura del piso)');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
