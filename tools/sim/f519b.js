// V2 F5.19b: barricadas (ventanas y trampillas con 5 tablas, reparar con F, puntos por ronda, saltos desde afuera),
// el embarcadero (baranda D22 a las rocas, portal en las rocas), la cinemática de muerte, las plantas moradas del templo,
// la tortuga mariachi chica y el Pack-a-Punch nuevo.
const G = require('./harness.js');
const { state, player, CONFIG, roundState, BARS, keys } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, P = CONFIG.PLAYER, BC = CONFIG.BARRIERS;
CONFIG.POWERUPS.dropChance = 0;

function fresh(open) {
  G.resetGame(); state.running = true; if (open) G.debugOpenAllDoors();
  state.round = 8; roundState.phase = 'active'; state.health = 100; state.lastDamageTime = -99; state.gameOver = false;
  state.points = 20000;
}
function clearZ() { for (const q of state.zombies.slice()) { q.active = q.alive = false; q.root.visible = false; } state.zombies.length = 0; for (const b of BARS.list) b.occ = null; }
function setPlayer(x, z) { player.pos.set(x, P.height, z); G.updateFlowField(true); }
function run(s, fn) { for (let i = 0; i < Math.round(s / dt); i++) { G.tick(dt); G.updateZombies(dt); G.updateBarriers(dt); if (fn) fn(); } }
function spawnAt(sp) { const q = G.ZPOOL.find(z => !z.active); G.resetZombie(q, sp, false, 'normal'); state.zombies.push(q); return q; }

// 1) armado
fresh(true);
check(BARS.list.length === BC.list.length && BARS.boards.count === BC.list.length * BC.boards, 'barricadas y tablas creadas una vez (' + BARS.list.length + ' · ' + BARS.boards.count + ' tablas en 1 InstancedMesh)');
const porch = G.SPAWN_POINTS.filter(s => s.room === 'R1');
check(porch.length === 2 && porch.every(s => s.bar), 'el porche tiene solo 2 entradas (' + porch.map(s => s.bar && s.bar.kind).join(' + ') + ')');
const bad = BARS.list.filter(B => { const sp = G.SPAWN_POINTS.find(s => s.bar === B); return !sp || !sp.valid; });
check(!bad.length, 'cada ventana/trampilla es un spawn con la entrada navegable', bad.length ? '(' + bad.map(B => B.id).join(',') + ')' : '');
const house = G.SPAWN_POINTS.filter(s => ['R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R9'].includes(s.room));
check(house.length && house.every(s => s.bar), 'en la casa todos los zombies entran por ventanas o trampillas');
const jumps = G.SPAWN_POINTS.filter(s => s.jump);
check(jumps.length >= 10, 'afuera saltan desde la espesura o el agua (' + jumps.length + ' spawns)');

// 2) un zombie en la ventana arranca las 5 tablas y se mete
BC.enabled = true;
const B = G.BARS.list.find(b => b.id === 'W2'), spW = G.SPAWN_POINTS.find(s => s.bar === B);
setPlayer(0, 10);
let z = spawnAt(spW);
check(z.state === 'barrier' && B.occ === z, 'sale en la ventana (estado barrier)');
run(BC.tearTime * 2 + 0.05);
check(B.boards === BC.boards - 2, 'arranca de a una tabla (' + B.boards + ' quedan a los ' + (BC.tearTime * 2).toFixed(1) + ' s)');
check(z.px < B.x + 1.2 && z.state === 'barrier', 'mientras tanto no entra');
run(BC.tearTime * 3 + 0.4 + BC.climbTime + 0.1);
check(B.boards === 0 && z.state === 'walk' && Math.hypot(z.px - B.ix, z.pz - B.iz) < 0.6 && !B.occ, 'sin tablas, se mete y camina desde la entrada');

// 3) pega a través de la ventana
G.resetBarriers(); clearZ();
z = spawnAt(spW); state.health = 100; state.lastDamageTime = -99;
setPlayer(B.fx + 0.6, B.fz);
run(1.5);
check(state.health < 100, 'si estás pegado a la ventana, te pega por el hueco', '(' + state.health + ')');

// 4) reparar: mantener F, 10 por tabla, las primeras 5 de la ronda
G.resetBarriers(); clearZ(); state.health = 100;
B.boards = 0; for (let k = 0; k < BC.boards; k++) { B.anim[k] = 0; }
setPlayer(B.bx + 1.6, B.bz); G.updateInteract();
check(G.interactState.kind !== 'barrier', 'F5.19c: a 1.6 m de las tablas no se repara (solo pegado)');
setPlayer(B.bx + 0.9, B.bz); G.updateInteract();   // F5.20: las tablas van en la cara de adentro de la pared (más gruesa)
check(G.interactState.kind === 'barrier' && G.promptFor(G.interactState).text.includes('Rebuild'), 'cartel de reparar', '("' + G.promptFor(G.interactState).text + '")');
G.startRound(9); roundState.phase = 'active';
const p0 = state.points; keys.KeyF = true;
run(BC.repairTime * 5 + 0.1, () => G.updateInteract());
check(B.boards === BC.boards && state.points - p0 === 5 * CONFIG.ROUNDS.boardPoints, 'mantener F pone las 5 tablas (+' + (state.points - p0) + ')');
B.boards = 0; const p1 = state.points;
run(BC.repairTime * 5 + 0.1, () => G.updateInteract());
check(B.boards === BC.boards && state.points === p1, 'más de ' + CONFIG.ROUNDS.boardCap + ' tablas en la ronda no dan puntos');
G.startRound(10); roundState.phase = 'active'; B.boards = 4; const p2 = state.points;
run(BC.repairTime + 0.1, () => G.updateInteract());
check(state.points - p2 === CONFIG.ROUNDS.boardPoints, 'la ronda siguiente vuelven a dar puntos');
keys.KeyF = false;
G.updateInteract();
check(G.interactState.kind !== 'barrier', 'con las 5 tablas no hay cartel');

// 5) trampilla: sale de abajo
const T = G.BARS.list.find(b => b.id === 'T1'), spT = G.SPAWN_POINTS.find(s => s.bar === T);
clearZ(); setPlayer(-1, -2);
z = spawnAt(spT);
check(z.state === 'barrier' && z.root.position.y < -1, 'trampilla: tironea desde abajo del piso');
run(BC.tearTime * 5 + 0.4 + BC.climbTime + 0.1);
check(z.state === 'walk' && T.boards === 0 && Math.abs(z.root.position.y) < 0.3, 'se abre paso y sube');

// 6) salto desde afuera
clearZ();
const spJ = jumps.find(s => s.room === 'R10') || jumps[0];
setPlayer(0, 0);
z = spawnAt(spJ);
check(z.state === 'jump' && z.jump.phase === 'walk', 'afuera: sale caminando de la jungla/agua (desde ' + spJ.jump.x.toFixed(1) + ', ' + spJ.jump.z.toFixed(1) + ')');
let maxY = 0, walked = 0; const g0 = z.root.position.y;
run(BC.walkIn / 1.6 + BC.vaultTime + 0.3, () => { if (z.jump && z.jump.phase === 'walk') walked = Math.max(walked, Math.abs(z.root.position.y - g0)); if (z.jump && z.jump.phase === 'vault') maxY = Math.max(maxY, z.root.position.y - g0); });
check(z.state === 'walk' && maxY > 0.4 && maxY < 1.2, 'F5.19c: salta el borde como una pared a la cintura (alto ' + maxY.toFixed(2) + ' m) y sigue');
// sin barricadas (como en los otros tests): sale del piso
BC.enabled = false; clearZ(); z = spawnAt(spW);
check(z.state === 'emerge', 'con BARRIERS.enabled = false sale del piso como antes');
BC.enabled = true;

// 7) reset
G.resetGame();
check(BARS.list.every(b => b.boards === BC.boards && !b.occ) && BARS.pts === 0, 'resetGame: todas con 5 tablas y libres');

// 8) embarcadero: baranda D22 a las rocas y el portal en las rocas
fresh(false);
const D22 = state.doors.D22;
check(D22 && D22.cost === 1500 && G.DOOR_LINKS.D22.join() === 'R19,R22', 'baranda D22 (1500) del embarcadero a las rocas de la cabeza');
check(G.roomAt(-80, -24).id === 'R22' && G.roomAt(-88, -45).id === 'R22', 'rocas y cabeza del calamar son R22');
const PS = CONFIG.PORTAL.squid;
check(PS.room === 'R22' && G.roomAt(PS.out[0], PS.out[1]).id === 'R22', 'el portal del calamar llega a las rocas');
fresh(true);
setPlayer(-60, -22);
check(G.flowAt(-80, -24) > 0, 'con D22 abierta se llega a las rocas caminando');

// 9) cinemática de muerte
// F5.28e (Diego): en primera persona: caés, el que te mató te come, negro con LOADING... y al menú
fresh(false);
setPlayer(0, 10);
const eaterZ = G.spawnZombie(); eaterZ.state = 'walk'; eaterZ.px = 1.5; eaterZ.pz = 10; G.placeRoot(eaterZ, 0);
G.DEATH.hitX = 1.5; G.DEATH.hitZ = 10;
G.gameOver();
check(G.DEATH.on && !G.DEATH.done && G.DEATH.eater === eaterZ, 'al morir arranca la cinemática y el que te pegó te va a comer');
const DC = CONFIG.ROUNDS.death;
let camMin = 99, near = 99, bites = 0, black = false, cardSeen = false;
for (let i = 0; i < Math.round((G.DEATH.dur + 0.2) / dt); i++) {
  G.tick(dt);
  if (!G.DEATH.on) continue;
  G.updateDeathCam(dt);
  if (G.DEATH.phase === 'eat') { camMin = Math.min(camMin, G.camera.position.y); near = Math.min(near, Math.hypot(eaterZ.root.position.x - player.pos.x, eaterZ.root.position.z - player.pos.z)); }
  bites = G.DEATH.bites; black = black || G.DEATH.phase === 'black'; cardSeen = cardSeen || G.DEATH.card;
}
check(camMin < 0.5, 'la vista queda en el piso', '(y ' + camMin.toFixed(2) + ')');
check(near < 1.2 && bites >= 5, 'se le pone encima y te muerde varias veces', `(${near.toFixed(2)} m, ${bites} mordidas)`);
check(black && cardSeen, 'después, negro con el resumen');
check(G.DEATH.done && !G.DEATH.on && G.MENU.mode === 'main' && !G.MENU.started && !state.gameOver, 'F5.19c: al terminar, directo al menú principal (partida reseteada)');
check(eaterZ.root.rotation.x === 0, 'el zombie que te comió no queda inclinado en el pool');
fresh(false); G.MENU.started = true;
G.quitToMenu();
check(G.DEATH.on && state.gameOver, 'F5.19c: salir al menú desde la pausa también muestra la cinemática');
G.resetGame();
check(!G.DEATH.on, 'resetGame corta la cinemática');
// F5.19c: tecla X (modo dev): vida ×4 con barra
fresh(false);
const mh0 = G.maxHealth();
G.debugKey('KeyX', false);
check(G.maxHealth() === mh0 * CONFIG.DEBUG.devHealthMul && state.health === G.maxHealth() && G.DEV.hp, 'F5.19c: X = vida ×' + CONFIG.DEBUG.devHealthMul + ' (' + G.maxHealth() + ')');
state.lastDamageTime = -99; G.damagePlayer(25, 0, 0, false, 'zombie');
check(G.DEV.lastHit === 25 && G.DEV.lastSrc === 'zombie', 'la barra sabe cuánto bajó y qué fue');
G.DEV.hp = false; G.DEV.on = false;

// 10) plantas moradas del templo
fresh(true);
const V = CONFIG.TEMPLE.voidPlants;
check(G.VOID.plants.length === 3 && V.spots.every(([x, zz], i) => G.WORLD.colliders.some(c => c.tag === 'prop:plantaMorada' + i)), '3 plantas moradas sólidas en el templo');
const [vx, vz] = V.spots[0];
setPlayer(vx - 6, vz); state.health = 100; state.lastDamageTime = -99;
let seen = false;
for (let i = 0; i < 60 * 9; i++) { G.tick(dt); G.updateVoidPlants(dt); if (G.VOID.orbs.some(o => o.on)) seen = true; state.lastDamageTime = -99; }
check(seen && state.health < 100, 'te ven y escupen el chorro espacial (vida ' + state.health + ')');
G.resetVoidPlants();
check(G.VOID.orbs.every(o => !o.on), 'reset: sin bolitas en el aire');

// 11) tortuga mariachi chica, PaP del mismo tamaño
const M = G.TRAPS.mariachi;
check(M && M.parts && M.parts.hat && M.parts.flip.length === 4, 'la mariachi es una tortuga en 4 patas con sombrero');
const pc = G.RELICS.pap.col, PZ = CONFIG.PAP.size;
check(Math.abs((pc.maxX - pc.minX) * (pc.maxZ - pc.minZ) - PZ.w * PZ.d) < 0.01, 'el Pack-a-Punch nuevo tiene el mismo collider');

// 12) F5.19c: ajustes
const MUD = CONFIG.SQUIDBAY.mud;
check(G.wetSandMul(-26, -12) === MUD.mul && G.wetSandMul(-35, -12) === 1 && MUD.x2 - MUD.x1 >= 6, 'el lodo de la playa oeste frena al jugador (' + (MUD.x2 - MUD.x1) + ' m de ancho)');
check(CONFIG.TRAPS.mariachi.cost === 1000, 'la trampa de la mariachi cuesta 1000');
// F5.20: la chiclera del porche se mudó al garaje; ninguna barricada detrás de ninguna chiclera
const gmBad = CONFIG.GUMS.machine.spots.filter(s => G.BARS.list.some(B => Math.hypot(B.bx - s.x, B.bz - s.z) < 2));
check(!gmBad.length, 'ninguna barricada queda detrás de una chiclera', gmBad.map(s => s.room).join());
check(G.WORLD.colliders.some(c => c.tag === 'prop:catarata'), 'la catarata verde del claro tiene su peñasco sólido');
fresh(true);
G.BUNK.open = true; setPlayer(CONFIG.BUNKER.hatch.out[0], CONFIG.BUNKER.hatch.out[1]);
G.useHatch({ down: true });
let tp = 0;
for (let i = 0; i < Math.round(CONFIG.BUNKER.travel * 60) + 2; i++) { G.tick(dt); G.updateBunker(dt); if (!tp && G.BUNK.fadeDone) tp = i * dt; }
check(Math.abs(tp - CONFIG.BUNKER.travel / 2) < 0.1 && !G.BUNK.travel && player.pos.y < -5, 'bajar al búnker tarda ' + CONFIG.BUNKER.travel + ' s (llega a la mitad, ' + tp.toFixed(2) + ' s)');

console.log(fail ? `FALLA (${fail})` : 'PASA');
process.exit(fail ? 1 : 0);
