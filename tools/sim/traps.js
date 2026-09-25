// V2 F5.9: trampas. Palancas (cuarto, cartel, cobro), tiburón del muelle (come a los del muelle, 20 al
// jugador una vez por salto, 10 s), cortadora del jardín oeste (círculo de 4 m, mata, 40 al jugador), sin
// puntos, al boss no, recarga de 60 s, grid intacto, la escena no crece, reset.
const G = require('./harness.js');
const { state, player, CONFIG, TRAPS, NAV } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const T = CONFIG.TRAPS, dt = 1 / 60;
CONFIG.POWERUPS.dropChance = 0;

function fresh() {
  G.resetGame(); state.running = true; G.debugOpenAllDoors();
  state.round = 5; state.health = 100; state.lastDamageTime = -99; state.gameOver = false; state.points = 10000;
}
function clearZ() { for (const q of state.zombies.slice()) { q.active = q.alive = false; q.root.visible = false; } state.zombies.length = 0; }
function zombieAt(x, z) { const q = G.spawnZombie(); q.state = 'walk'; q.px = x; q.pz = z; q.level = 0; q.mode = 'flow'; return q; }
function run(secs, pin) {
  for (let i = 0; i < Math.round(secs * 60); i++) {
    G.tick(dt); G.updateTraps(dt);
    if (pin) pin();
  }
}
function standAt(x, z) { player.pos.set(x, CONFIG.PLAYER.height, z); G.updateInteract(); }

// 1) palancas: en su cuarto, sin tocar el grid, cartel y cobro
fresh();
const grid0 = Array.from(NAV.cells);
check(G.roomAt(T.shark.lever.x, T.shark.lever.z).id === 'R11' && G.roomAt(T.mower.lever.x, T.mower.lever.z).id === 'R12',
  'palanca del tiburón en el muelle, la de la cortadora en el jardín oeste');
G.buildNavGrid();
check(grid0.every((v, i) => v === NAV.cells[i]), 'las trampas no cambian el grid');
player.pos.set(0, 1.7, -2); G.updateFlowField(true);
const reach = L => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (G.flowAt(Math.floor(L.x) + dx, Math.floor(L.z) + dz) >= 0) return true; return false; };
check(reach(T.shark.lever) && reach(T.mower.lever), 'se llega a las dos palancas caminando');
standAt(T.shark.lever.x - 1, T.shark.lever.z);
check(G.interactState.kind === 'trap' && G.promptFor(G.interactState).text === '[F] Activar TIBURÓN' && G.promptFor(G.interactState).cost === 1500,
  'cartel: activar tiburón, 1500');
state.points = 1000;
check(!G.interact() && TRAPS.shark.phase === 'idle' && state.points === 1000, 'sin plata no anda');
state.points = 10000;
check(G.interact() && TRAPS.shark.phase === 'on' && state.points === 8500, 'con F: cobra 1500 y arranca');
G.updateInteract();
check(/funcionando/.test(G.promptFor(G.interactState).text) && !G.interact() && state.points === 8500, 'andando: no se vuelve a cobrar');

// 2) tiburón: se come a los del muelle, no a los de la playa; 10 s; recarga 60 s
fresh(); clearZ();
player.pos.set(0, 1.7, -10);                                     // en la playa, lejos
const onPier = [zombieAt(0, -30), zombieAt(-1, -36), zombieAt(1, -41)];
const beach = zombieAt(0, -15);
G.useTrap(TRAPS.shark);
const pts = state.points;
run(T.shark.time + 0.1, () => { for (const q of onPier.concat([beach])) if (q.alive) { q.state = 'walk'; } });
check(onPier.every(q => !q.alive), 'se come a los 3 del muelle en ' + T.shark.time + ' s');
check(beach.alive, 'al de la playa no');
check(state.points === pts, 'sin puntos');
check(TRAPS.shark.phase === 'cool' && !TRAPS.shark.g.visible, 'a los 10 s para');
standAt(T.shark.lever.x - 1, T.shark.lever.z);
check(/recargando/.test(G.promptFor(G.interactState).text) && !G.interact(), 'recargando: no se puede usar');
run(T.shark.cooldown - 0.5);
check(TRAPS.shark.phase === 'cool', 'todavía a los 59.5 s');
run(0.6);
check(TRAPS.shark.phase === 'idle', 'a los 60 s, lista de nuevo');
// al jugador: 20 una vez por salto
fresh(); clearZ();
player.pos.set(0, 1.7, -34);
G.useTrap(TRAPS.shark);
let hits = 0, badDmg = 0;
run(T.shark.time, () => {
  player.pos.set(0, 1.7, TRAPS.shark.jz);                         // siempre parado donde salta
  if (state.health < 100) { hits++; if (100 - state.health !== T.shark.playerDamage) badDmg++; }
  state.health = 100; state.lastDamageTime = -99;
});
check(!badDmg, 'cada golpe saca ' + T.shark.playerDamage);
const jumps = Math.floor(T.shark.time / T.shark.jumpTime);
check(hits >= jumps - 1 && hits <= jumps + 1, 'al jugador le pega ' + T.shark.playerDamage + ' una vez por salto', `(${hits} en ${jumps} saltos)`);
// al boss no
fresh(); clearZ(); state.round = 12; CONFIG.BOSS.enabled = true;
G.spawnBoss(); const b = G.BOSS.z; b.px = 0; b.pz = -30; b.state = 'walk';
const bh = b.health;
G.useTrap(TRAPS.shark);
run(T.shark.time, () => { b.px = 0; b.pz = -30; b.act = null; });
check(b.alive && b.health === bh, 'al boss no le hace nada');
CONFIG.BOSS.enabled = false; clearZ();

// 3) cortadora: círculo delante del taller, mata lo que toca, 40 al jugador
fresh(); clearZ();
const M = T.mower, C = M.center;
check(G.roomAt(C.x - M.radius, C.z).id === 'R12' && G.roomAt(C.x + M.radius, C.z).id === 'R12' &&
  G.roomAt(C.x, C.z - M.radius).id === 'R12' && G.roomAt(C.x, C.z + M.radius).id === 'R12', 'el círculo queda adentro del jardín oeste');
player.pos.set(-25, 1.7, 34);                                    // lejos del círculo
const ring = [0, 1, 2, 3].map(i => zombieAt(C.x + Math.cos(i * 1.6) * M.radius, C.z + Math.sin(i * 1.6) * M.radius));
const inside = zombieAt(C.x, C.z);
standAt(M.lever.x - 1, M.lever.z);
check(G.promptFor(G.interactState).text === '[F] Activar CORTADORA' && G.promptFor(G.interactState).cost === 1000 && G.interact(),
  'cartel: activar cortadora, 1000');
player.pos.set(-25, 1.7, 34);
const pts2 = state.points;
run(M.lap + 0.1, () => { for (const q of ring.concat([inside])) if (q.alive) { q.state = 'walk'; } });
check(ring.every(q => !q.alive), 'en una vuelta mata a los 4 del círculo');
check(inside.alive, 'al del centro no');
check(state.points === pts2, 'sin puntos');
const mp = TRAPS.mower.g.position;
check(Math.abs(Math.hypot(mp.x - C.x, mp.z - C.z) - M.radius) < 0.01 && TRAPS.mower.g.visible, 'va sobre el círculo de ' + M.radius + ' m');
// al jugador: 40, cada playerCd
fresh(); clearZ();
G.useTrap(TRAPS.mower);
player.pos.set(C.x + M.radius, 1.7, C.z + 0.8);
let dmg = 0, n = 0;
run(M.lap, () => { if (state.health < 100) { dmg = 100 - state.health; n++; } state.health = 100; state.lastDamageTime = -99; });
check(dmg === M.playerDamage && n >= 1 && n <= 2, 'al pasar te saca ' + M.playerDamage, `(${n} golpes)`);
run(M.time);
check(TRAPS.mower.phase === 'cool' && !TRAPS.mower.g.visible, 'a los ' + M.time + ' s para');

// 4) la escena no crece y reset
fresh();
const kids = G.scene.children.length;
G.useTrap(TRAPS.shark); G.useTrap(TRAPS.mower); run(12);
check(G.scene.children.length === kids, 'la escena no crece');
G.resetGame();
check(TRAPS.shark.phase === 'idle' && TRAPS.mower.phase === 'idle' && !TRAPS.shark.g.visible && !TRAPS.mower.g.visible,
  'resetGame: trampas apagadas y listas');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
