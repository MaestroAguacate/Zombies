// Rondas 1..6 matando cada zombie apenas termina de salir. Luego game over y reinicio.
const G = require('./harness.js');
const { state, player, CONFIG, roundState } = G;
state.running = true; G.debugOpenAllDoors();
const dt = 1 / 60; let fail = 0;
const check = (c, msg) => { if (!c) { fail++; console.log('  FALLA:', msg); } };
player.pos.set(0, 1.7, 10); G.setCam(0);
let t = 0, maxAlive = 0, perRound = {}, pauseStart = null, pauses = [];
check(state.points === CONFIG.ECONOMY.startPoints, 'puntos iniciales');
check(roundState.phase === 'pause' && roundState.next === 1, 'ronda 1 encolada');
while (state.round < 7 && t < 600) {
  G.tick(dt); t += dt;
  const wasPause = roundState.phase === 'pause';
  G.updateRounds(dt); G.updateFlowField(false); G.updateZombies(dt);
  state.health = 100;
  maxAlive = Math.max(maxAlive, G.aliveCount());
  for (const z of state.zombies) if (z.alive && z.state === 'walk') {
    perRound[state.round] = (perRound[state.round] || 0) + 1;
    G.damageZombie(z, 9999, perRound[state.round] % 2 === 0);
  }
  if (!wasPause && roundState.phase === 'pause') pauseStart = t;
  if (wasPause && roundState.phase === 'active' && pauseStart !== null) { pauses.push(+(t - pauseStart).toFixed(2)); pauseStart = null; }
}
for (let n = 1; n <= 6; n++) {
  console.log(`ronda ${n}: kills ${perRound[n]}  esperado ${CONFIG.ZOMBIE.count(n)}`);
  check(perRound[n] === CONFIG.ZOMBIE.count(n), 'cantidad ronda ' + n);
}
console.log('pausas entre rondas (s):', pauses.join(', '));
check(pauses.every(p => Math.abs(p - 8) < 0.05), 'pausa de 8s');
console.log('max vivos simultáneos:', maxAlive); check(maxAlive <= 8, 'tope 8 vivos');
// puntos: mitad headshot. 500 + sum(kills body*60 + head*130)
let exp = CONFIG.ECONOMY.startPoints;
for (let n = 1; n <= 6; n++) { const k = perRound[n], h = Math.floor(k / 2); exp += h * 130 + (k - h) * 60; }
console.log('puntos:', state.points, 'esperado', exp); check(state.points === exp, 'puntos');

// tope de vivos: ronda 5 (16 zombies) sin matar a nadie durante 40s
G.resetGame(); state.running = true; G.debugOpenAllDoors();
player.pos.set(0, 1.7, 10); G.setCam(0);
G.startRound(5);
let cap = 0, spawnTimes = [], lastSp = 0;
for (let i = 0; i < 60 * 40; i++) {
  G.tick(dt); G.updateRounds(dt); G.updateFlowField(false); G.updateZombies(dt);
  state.health = 100; state.lastDamageTime = -99; state.gameOver = false;
  if (roundState.spawned !== lastSp) { spawnTimes.push(i / 60); lastSp = roundState.spawned; }
  cap = Math.max(cap, G.aliveCount());
}
const gaps = spawnTimes.slice(1).map((v, i) => v - spawnTimes[i]);
console.log('ronda 5 sin matar -> max vivos:', cap, ' spawneados:', roundState.spawned, '/', roundState.total,
            ' gap mínimo entre spawns:', Math.min(...gaps).toFixed(2) + 's');
check(cap === 8, 'tope exacto de 8 vivos');
check(Math.min(...gaps) >= 1.49, 'escalonado 1.5s');

// stats del zombie según ronda
const z = G.ZPOOL[0];
// F4: hasta R10 como V1 (1050), después ×1.1 por ronda; el total por ronda sigue subiendo
const H = CONFIG.ZOMBIE.health;
check(H(10) === 1050 && H(11) === 1155 && H(15) === Math.round(1050 * 1.1 ** 5) && H(20) > H(19), 'vida: 1050 en R10, ×1.1 desde R11');
check(CONFIG.ZOMBIE.count(9) === 24 && CONFIG.ZOMBIE.count(12) === 30 && CONFIG.ZOMBIE.count(20) === 46, 'cantidad sin tope (R12 30, R20 46)');
// F4: vivos a la vez: 8 hasta R7, +1 por ronda desde R8, tope el pool (24)
check(G.maxAliveFor(1) === 8 && G.maxAliveFor(7) === 8 && G.maxAliveFor(8) === 9 && G.maxAliveFor(12) === 13 &&
      G.maxAliveFor(23) === 24 && G.maxAliveFor(40) === 24, 'vivos: 8 hasta R7, R8 9, R12 13, tope 24');
// F2.6: la velocidad ya no es una fórmula por ronda sino un paso sorteado (ver gaits.js)
check(CONFIG.ZOMBIE.gaits.run.speed * (1 + CONFIG.ZOMBIE.speedJitter) <= CONFIG.PLAYER.speed + 1e-9, 'tope de velocidad: correr <= caminar del jugador');

// i-frame: dos golpes en el mismo instante = un solo daño
state.health = 100; state.lastDamageTime = -99;
G.damagePlayer(25); G.damagePlayer(25);
check(state.health === 75, 'i-frame (health=' + state.health + ')');

// game over + high score
state.round = 6; const reached = state.round;
G.tick(1); state.health = 25; G.damagePlayer(25);
check(state.gameOver === true && state.running === false, 'game over');
check(G.store[CONFIG.HIGHSCORE_KEY] === String(reached), 'high score guardado');
G.damagePlayer(25); check(state.health === 0, 'sin daño tras morir');

// reinicio limpio
G.resetGame();
check(state.gameOver === false && state.round === 0 && state.kills === 0, 'reset stats');
check(state.zombies.length === 0 && G.ZPOOL.every(q => !q.active), 'reset zombies');
check(Object.values(state.doors).every(d => !d.open && d.collider.solid), 'puertas cerradas');
check(state.weapons.length === 1 && state.weapons[0].mag === 8 && state.weapons[0].reserve === 80, 'arma reseteada');
check(state.health === 100 && state.points === CONFIG.ECONOMY.startPoints, 'hp/puntos');
check(roundState.phase === 'pause' && roundState.next === 1, 'ronda 1 re-encolada');
// tras reset, solo spawnea en el porche (puertas cerradas)
state.running = true; player.pos.set(0, 1.7, 0); G.setCam(0);
for (let i = 0; i < 60 * 12; i++) { G.tick(dt); G.updateRounds(dt); G.updateFlowField(false); G.updateZombies(dt); state.health = 100; }
const rooms = new Set(state.zombies.map(q => G.roomAt(q.px, q.pz)?.id));
console.log('cuartos con zombies tras reset:', [...rooms].join(','));
check(rooms.size === 1 && rooms.has('R1'), 'solo R1 con puertas cerradas');
console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
