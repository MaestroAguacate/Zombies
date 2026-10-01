// V2 F5.13: Kaboom con puntos (en f510.js), salida del piso más lenta, templo con el PaP arriba y su río con
// puentes, Juggernog en el muelle, banco del escudo en el techo, taller en la playa, torre de salvavidas con el
// revólver, borde oeste en x -75, cabeza del calamar que sube por ronda (se abre en la R13), entrada del búnker.
const G = require('./harness.js');
const THREE = require('three');
const { state, player, CONFIG, roundState, WORLD, BUNK, FLOW, UP, SQHEAD } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, P = CONFIG.PLAYER;
CONFIG.POWERUPS.dropChance = 0;
function fresh() { G.resetGame(); state.running = true; state.round = 8; roundState.phase = 'active'; state.points = 50000; state.health = 100; }
function setPlayer(x, z, y) { player.pos.set(x, (y === undefined ? G.groundY(x, z) : y) + P.height, z); G.updateFlowField(true); }
const nearNav = (x, z) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (G.flowAt(Math.floor(x) + dx, Math.floor(z) + dz) >= 0) return true; return false; };
function walk(yaw, secs) {
  player.vel.set(0, 0, 0); player.yaw = yaw; G.keys.KeyW = true;
  for (let i = 0; i < Math.round(secs * 60); i++) { G.tick(dt); G.updatePlayer(dt); }
  G.keys.KeyW = false;
}

// 1) salida del piso: 2 s
fresh(); G.debugOpenAllDoors(); setPlayer(0, 10);
const z0 = G.spawnZombie();
check(z0 && z0.state === 'emerge' && CONFIG.ZOMBIE.emergeTime === 2, 'los zombies salen del piso en 2 s');
for (let i = 0; i < 60 * 1.8; i++) { G.tick(dt); G.updateZombies(dt); }
check(z0.state === 'emerge', 'a los 1.8 s todavía está saliendo');
for (let i = 0; i < 60 * 0.4; i++) { G.tick(dt); G.updateZombies(dt); }
check(z0.state !== 'emerge', 'a los 2.2 s ya camina');

// 2) templo: cima a UP.y en la pasarela del techo, PaP arriba, rampas enlazadas
fresh(); G.debugOpenAllDoors();
const T = CONFIG.TEMPLE, PS = CONFIG.PAP.spot;
// (F5.15: el templo se mudó al anexo NE; las posiciones salen de la config)
const tpx = T.top.x1 + 1.5, tpz = T.top.z1 + 1.5;
check(G.walkAt(tpx, tpz) && G.roofAt(tpx, tpz) && PS.y === UP.y && PS.x > T.top.x1 && PS.x < T.top.x2 && PS.z > T.top.z1 && PS.z < T.top.z2,
  'la cima del templo es caminable (a UP.y) y el PaP está arriba');
setPlayer(tpx, tpz, UP.y);
check(FLOW.srcLevel === 1, 'parado arriba, el jugador está en el nivel 1', `(${FLOW.srcLevel})`);
// F5.19: la nave tiene 3 rampas desde x 70 (z ~50, 75 y 100)
check(T.ramps.length === 3 && T.ramps.every(R => R.x1 === 70 && R.x2 === T.top.x1), 'F5.19: 3 rampas de x 70 a la plancha');
const d = T.ramps.map(R => FLOW.dist[G.navIdx(R.bottom[0], R.bottom[1])]);
check(d.every(v => v > 0) && G.flowAt(30, 50) > 0, 'el campo baja por las 3 rampas y llega al sendero', `(${d.join(', ')})`);
// subir caminando por cada rampa
for (const [i, r] of T.ramps.entries()) {
  setPlayer(r.bottom[0] + 0.3, (r.z1 + r.z2) / 2);
  walk(-Math.PI / 2, 4);
  check(player.pos.x > T.top.x1 && player.pos.y > UP.y + 1, 'el jugador sube por la rampa ' + (i + 1) + ' hasta la plancha', `(x ${player.pos.x.toFixed(2)}, y ${player.pos.y.toFixed(2)})`);
}
// al costado de las rampas no se sube: la base es sólida
const r2 = T.ramps[1];
setPlayer(T.top.x1 - 1.5, r2.z2 + 3.5);
walk(-Math.PI / 2, 3);
check(player.pos.y < 2.5, 'fuera de las rampas la base frena (no se trepa)', `(y ${player.pos.y.toFixed(2)}, x ${player.pos.x.toFixed(2)})`);
// columnas sólidas arriba
const cols = G.templeColumns();
check(cols.length >= 15 &&   // F5.20: una menos, donde está la planta jefa
 cols.every(([x, z]) => !G.isUp(Math.floor(x), Math.floor(z))), 'columnas a los dos lados de la nave (sólidas arriba)', `(${cols.length})`);
// PaP desde arriba, en el medio de la nave
check(Math.abs(CONFIG.PLANTBOSS.z - (T.top.z1 + T.top.z2) / 2) < 3 && PS.z > CONFIG.PLANTBOSS.z + 8 && PS.z < T.top.z2 - 5,
  'F5.22: la planta jefa en el medio de la nave y el PaP al norte');
state.points = 99999;
Object.keys(state.generators).forEach(k => { state.generators[k] = true; });
Object.keys(state.souls).forEach(k => { state.souls[k] = CONFIG.SOULS.need; });
G.checkPap();
player.pos.set(PS.x - 1.4, UP.y + P.height, PS.z); G.updateInteract();
check(G.interactState.kind === 'pap', 'el PaP se usa desde la plancha');
player.pos.set(76, P.height, PS.z); G.updateInteract();
check(G.interactState.kind !== 'pap', 'desde abajo no');

// 3) el río (F5.19: de norte a sur, sin cruzar el templo): frena salvo en los 3 puentes; un tiburón por puente
const R = T.river, wmx = Math.floor((R.w[0] + R.w[1]) / 2);
const outX = R.w[0] - 2.5;                                                // franja del oeste, afuera del río
fresh(); G.debugOpenAllDoors(); setPlayer(outX, 70);
check(R.w[1] < T.ramps[0].x1, 'el río no cruza el templo');
// (las celdas del agua quedan encerradas entre las orillas y los costados de los puentes: no se llega)
check(G.flowAt(wmx, 62) < 0 && G.flowAt(wmx, 88) < 0, 'al agua del río no se llega');
check(R.bridges.every(([, a, b]) => G.isNav(wmx, Math.floor((a + b) / 2))), 'los 3 puentes sí');
check(nearNav(R.w[1] + 3, 64) && nearNav(R.w[1] + 3, 88), 'del otro lado del río se llega (por los puentes)');
const b1 = R.bridges[1], bz = (b1[1] + b1[2]) / 2;
setPlayer(outX, b1[1] - 3.5); walk(-Math.PI / 2, 2);
check(player.pos.x < R.w[0] + 0.2, 'caminando al río fuera de un puente te frena la orilla', `(x ${player.pos.x.toFixed(2)})`);
setPlayer(outX, bz); walk(-Math.PI / 2, 3);
check(player.pos.x > R.w[1], 'por el puente se cruza', `(x ${player.pos.x.toFixed(2)})`);
check(G.PIRANHAS.zones.length === 2 && G.RSHARK.list.length === 3, 'F5.19: pirañas solo en el muelle y el puente C13; un tiburón en cada puente del río');
// (F5.28f: el fuego es de cubos: cada brasero anota un fuego en VFIRE)
const tfires = G.VFIRE.list.filter(f => f.x > 60 && f.z > 45).length;
check(tfires >= 8, 'antorchas prendidas', `(${tfires})`);

// 4) mudanzas: Juggernog, banco del escudo, taller, torre de salvavidas y revólver
fresh(); G.debugOpenAllDoors();
const J = CONFIG.PERKS.list.jugg;
check(G.roomAt(J.x, J.z).id === 'R11' && !J.level, 'Juggernog en el muelle');
const SB = CONFIG.SHIELD.bench;
check(!SB.level && G.roomAt(SB.x, SB.z).id === 'R6', 'F5.16: banco del escudo de vuelta en el garaje');
const W = CONFIG.QUEST.workshop;
check(G.roomAt(W.x, W.z).id === 'R17', 'taller de la Ola al costado del caparazón (F5.19)');
const L = CONFIG.LIFEGUARD;
check([0, 1, 2, 3, 4, 5].every(i => G.PROPS.find(p => p.id === 'torre' + i && p.collider)), 'torre de salvavidas: 6 patas sólidas (F5.15: más larga)');
setPlayer(L.x, L.z + 4);
check(nearNav(L.x, L.z), 'se camina por debajo de la torre');
const rv = CONFIG.WALLBUYS.find(w => w.weapon === 'revolver');
check(rv.post && Math.abs(rv.x - L.x) < 0.01 && rv.z > L.z, 'el revólver se compra en el tablón de la torre');
player.pos.set(rv.x, P.height, rv.z + 1.2); G.updateInteract();
check(G.interactState.kind === 'wall' && /REVOLVER/.test(G.promptFor(G.interactState).text), 'cartel del revólver frente a la torre', `("${G.interactState.kind && G.promptFor(G.interactState).text}")`);

// 5) borde oeste en x -75 y la lengua de arena
// F5.19: la lengua de arena pasó a ser agua (la bahía del calamar, con el embarcadero)
fresh(); G.debugOpenAllDoors(); setPlayer(-60, -20);
check(G.roomAt(-60, -20).id === 'R19' && G.roomAt(-70, 60).id === 'R17' && nearNav(-60, -20) && nearNav(-70, 60), 'el mapa llega al embarcadero y al Claro (F5.15: entre medio, espesura)');
player.pos.set(-73, P.height, -9); walk(Math.PI / 2, 1.5);
check(player.pos.x > -75.5, 'la orilla frena al oeste (agua)', `(x ${player.pos.x.toFixed(2)})`);
player.pos.set(-59, P.height, -48); walk(0, 1.5);
check(player.pos.z > -50.5, 'el agua frena al final del muelle largo', `(z ${player.pos.z.toFixed(2)})`);

// 6) cabeza del calamar: sube por ronda, se abre en la R13
const H = CONFIG.SQUIDHEAD, [tx1, tx2] = H.tunnel;
fresh(); G.debugOpenAllDoors();
G.startRound(1);
const y1 = SQHEAD.target;
G.startRound(7);
const y7 = SQHEAD.target;
check(y1 < y7 && y7 < 0 && !SQHEAD.open, 'sube un poco cada ronda (cerrada)', `(${y1.toFixed(2)} -> ${y7.toFixed(2)})`);
for (let i = 0; i < 60 * 12; i++) { G.tick(dt); G.updateQuest(dt); }
check(Math.abs(SQHEAD.dy - y7) < 1e-6 && Math.abs(G.QUEST.turtle.position.y - y7) < 1e-6, 'sube de a poco y las estatuas con ella');
// F5.19: relativo a la cabeza (se mudó al mar)
const hx = (tx1 + tx2) / 2, hz = H.z2;
setPlayer(hx, hz + 3);
check(!nearNav(hx, hz - 12) && !nearNav(hx, hz - 19), 'cerrada: no se entra (montículo)');
G.startRound(H.openRound);
setPlayer(hx, hz + 3);
check(SQHEAD.open && SQHEAD.target === 0 && nearNav(hx, hz - 12) && nearNav(hx, hz - 19), 'R13: afuera del todo y se entra por la boca hasta la cámara',
  `(open ${SQHEAD.open}, target ${SQHEAD.target}, túnel ${G.flowAt(hx, hz - 12)}, cámara ${G.flowAt(hx, hz - 19)}, nav ${G.isNav(hx, hz - 12)})`);
check(!G.isNav(Math.floor(tx1) - 2, hz - 5) && !G.isNav(Math.floor(tx2) + 1, hz - 5), 'los costados del túnel siguen sólidos');   // F5.21: túnel de 8 m
player.pos.set(hx, P.height, hz - 9); walk(Math.PI * 0, 3);   // yaw 0 = hacia -z: adentro
check(player.pos.z < hz - 15, 'el jugador camina hasta la cámara', `(z ${player.pos.z.toFixed(2)})`);
const rc = new THREE.Raycaster(new THREE.Vector3(H.x1, 1.2, hz - 11), new THREE.Vector3(1, 0, 0), 0, 20);
G.scene.updateMatrixWorld(true);
const hit = rc.intersectObjects(WORLD.hitMeshes, false)[0];
check(hit && hit.object.userData.tag === 'squidhead:pared', 'abierta: la bala frena en la pared de la cabeza', `(${hit && hit.object.userData.tag})`);
G.startRound(14);
check(SQHEAD.open, 'sigue abierta');
G.resetGame();
check(!SQHEAD.open && SQHEAD.dy < 0, 'resetGame: vuelve a estar enterrada y cerrada');
// tecla O: la abre en cualquier ronda
fresh(); G.debugUnlockAll();
check(SQHEAD.open && SQHEAD.dy === 0, 'O la saca entera y abierta', `(open ${SQHEAD.open}, dy ${SQHEAD.dy}, force ${SQHEAD.force})`);
G.startRound(9);
check(SQHEAD.open, 'y queda abierta en las rondas siguientes');

// 7) entrada del búnker: bloque sólido, 4× más ancha, se entra con F
fresh(); G.debugOpenAllDoors();
const E = CONFIG.BUNKER.entrance, BH = CONFIG.BUNKER.hatch;
// (F5.28e: en la cueva la entrada mira al este, axis 'x': el ancho va a lo largo de z)
check((E.axis === 'x' ? E.z2 - E.z1 : E.x2 - E.x1) >= 5 && WORLD.colliders.some(c => c.tag === 'bunker:entrada' && c.solid), 'entrada de hormigón sólida, de 5 m o más');
const FC = E.face || 1;                                                  // F5.15: mira al sur
setPlayer(BH.x, BH.z + FC * 0.8);
check(nearNav(BH.out[0], BH.out[1]), 'delante de la entrada se llega');
player.pos.set(BH.x, P.height, BH.z + FC * 0.8); G.updateInteract();
check(G.interactState.kind === 'hatch' && G.promptFor(G.interactState).text === 'Bunker closed', 'cerrada: cartel');
G.openBunker();
for (let i = 0; i < 60 * 3; i++) { G.tick(dt); G.updateBunker(dt); }
check(BUNK.halves[0].position.x < -2 && BUNK.halves[1].position.x > 2, 'al abrirse las puertas blindadas se corren');
G.updateInteract();
check(G.promptFor(G.interactState).text === '[F] Go down to the bunker', 'abierta: F para bajar');
G.resetGame();
check(Math.abs(BUNK.halves[0].position.x + 1.1) < 1e-6, 'resetGame: puertas cerradas');

console.log(fail ? `FALLA (${fail})` : 'PASA');
process.exit(fail ? 1 : 0);
