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
const r1 = T.ramps[0], r2 = T.ramps[1];
const d1 = FLOW.dist[G.navIdx(r1.bottom[0], r1.bottom[1])], d2 = FLOW.dist[G.navIdx(r2.bottom[0], r2.bottom[1])];
check(d1 > 0 && d2 > 0 && G.flowAt(0, 50) > 0, 'el campo baja por las dos rampas y llega a la jungla', `(${d1}, ${d2})`);
// subir caminando por la rampa oeste
setPlayer(r1.bottom[0] + 0.3, (r1.z1 + r1.z2) / 2);                    // (F5.15: la orilla del río está a 1 m)
walk(-Math.PI / 2, 4);
check(player.pos.x > T.top.x1 && player.pos.y > UP.y + 1, 'el jugador sube por la rampa oeste hasta la cima', `(x ${player.pos.x.toFixed(2)}, y ${player.pos.y.toFixed(2)})`);
// al costado del templo no se sube: la base es sólida
setPlayer((r2.x1 + r2.x2) / 2, r2.bottom[1] - 0.5);
walk(Math.PI, 4);   // yaw π = hacia +z (la cámara mira a -z con yaw 0): por la rampa sur
check(player.pos.y > UP.y + 1, 'y por la rampa sur', `(y ${player.pos.y.toFixed(2)})`);
setPlayer(r2.x2 + 2.5, r2.bottom[1] + 0.5);
walk(Math.PI, 3);   // yaw π = hacia +z (la cámara mira a -z con yaw 0)
check(player.pos.y < 2.5, 'fuera de las rampas la base frena (no se trepa)', `(y ${player.pos.y.toFixed(2)}, z ${player.pos.z.toFixed(2)})`);
// PaP desde arriba
state.points = 99999;
Object.keys(state.generators).forEach(k => { state.generators[k] = true; });
Object.keys(state.souls).forEach(k => { state.souls[k] = CONFIG.SOULS.need; });
G.checkPap();
player.pos.set(PS.x, UP.y + P.height, PS.z - 1.4); G.updateInteract();
check(G.interactState.kind === 'pap', 'el PaP se usa desde la cima');
player.pos.set(PS.x, P.height, PS.z - 8); G.updateInteract();
check(G.interactState.kind !== 'pap', 'desde abajo no');

// 3) el río: frena salvo en los 3 puentes; pirañas
const R = T.river, wmx = Math.floor((R.w[0] + R.w[1]) / 2), smz = Math.floor((R.s[2] + R.s[3]) / 2);
const outX = R.w[0] - 2.5;                                                // franja del anexo, afuera del río
fresh(); G.debugOpenAllDoors(); setPlayer(outX, 75);
// (las celdas del agua quedan encerradas entre las orillas y los costados de los puentes: no se llega)
check(G.flowAt(wmx, 72) < 0 && G.flowAt(70, smz) < 0, 'al agua del río no se llega');
check(R.bridges.every(([arm, a, b]) => arm === 'w' ? G.isNav(wmx, Math.floor((a + b) / 2)) : G.isNav(Math.floor((a + b) / 2), smz)), 'los 3 puentes sí');
check(nearNav(R.w[1] + 3, 75) && nearNav(R.w[1] + 3, 95), 'adentro del río se llega (por los puentes)');
const b1 = R.bridges.find(b => b[0] === 'w'), bz = (b1[1] + b1[2]) / 2;
setPlayer(outX, b1[1] - 3.5); walk(-Math.PI / 2, 2);
check(player.pos.x < R.w[0] + 0.2, 'caminando al río fuera de un puente te frena la orilla', `(x ${player.pos.x.toFixed(2)})`);
setPlayer(outX, bz); walk(-Math.PI / 2, 3);
check(player.pos.x > R.w[1], 'por el puente se cruza', `(x ${player.pos.x.toFixed(2)})`);
check(G.PIRANHAS.zones.length === 6, 'pirañas en los 3 puentes');
check(G.TEMPLEFX.flames.length >= 8, 'antorchas prendidas', `(${G.TEMPLEFX.flames.length})`);

// 4) mudanzas: Juggernog, banco del escudo, taller, torre de salvavidas y revólver
fresh(); G.debugOpenAllDoors();
const J = CONFIG.PERKS.list.jugg;
check(G.roomAt(J.x, J.z).id === 'R11' && !J.level, 'Juggernog en el muelle');
const SB = CONFIG.SHIELD.bench;
check(SB.level === 1 && G.walkAt(SB.x, SB.z), 'banco del escudo en la pasarela del techo');
const W = CONFIG.QUEST.workshop;
check(G.roomAt(W.x, W.z).id === 'R10', 'taller de la Ola en la playa');
const L = CONFIG.LIFEGUARD;
check([0, 1, 2, 3, 4, 5].every(i => G.PROPS.find(p => p.id === 'torre' + i && p.collider)), 'torre de salvavidas: 6 patas sólidas (F5.15: más larga)');
setPlayer(L.x, L.z + 4);
check(nearNav(L.x, L.z), 'se camina por debajo de la torre');
const rv = CONFIG.WALLBUYS.find(w => w.weapon === 'revolver');
check(rv.post && Math.abs(rv.x - L.x) < 0.01 && rv.z > L.z, 'el revólver se compra en el tablón de la torre');
player.pos.set(rv.x, P.height, rv.z + 1.2); G.updateInteract();
check(G.interactState.kind === 'wall' && /REVÓLVER/.test(G.promptFor(G.interactState).text), 'cartel del revólver frente a la torre', `("${G.interactState.kind && G.promptFor(G.interactState).text}")`);

// 5) borde oeste en x -75 y la lengua de arena
fresh(); G.debugOpenAllDoors(); setPlayer(-60, -30);
check(G.roomAt(-70, -30).id === 'R19' && G.roomAt(-70, 20).id === 'R17' && nearNav(-70, -30) && nearNav(-70, 60), 'el mapa llega a x -75 (arena y jungla)');
player.pos.set(-73, P.height, -30); walk(Math.PI / 2, 1.5);
check(player.pos.x > -75, 'el borde oeste frena', `(x ${player.pos.x.toFixed(2)})`);
player.pos.set(-50, P.height, -58); walk(0, 1.5);
check(player.pos.z > -60, 'el mar frena al sur de la lengua', `(z ${player.pos.z.toFixed(2)})`);

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
setPlayer(-58, -38);
check(!nearNav(-58, -47) && !nearNav(-58, -54), 'cerrada: no se entra (montículo)');
G.startRound(H.openRound);
setPlayer(-58, -38);
check(SQHEAD.open && SQHEAD.target === 0 && nearNav(-58, -47) && nearNav(-58, -54), 'R13: afuera del todo y se entra por la boca hasta la cámara',
  `(open ${SQHEAD.open}, target ${SQHEAD.target}, túnel ${G.flowAt(-58, -47)}, cámara ${G.flowAt(-58, -54)}, nav ${G.isNav(-58, -47)})`);
check(!G.isNav(Math.floor(tx1) - 2, -46) && !G.isNav(Math.floor(tx2) + 1, -46), 'los costados del túnel siguen sólidos');
player.pos.set(-58, P.height, -44); walk(Math.PI * 0, 3);   // yaw 0 = hacia -z: adentro
check(player.pos.z < -50, 'el jugador camina hasta la cámara', `(z ${player.pos.z.toFixed(2)})`);
const rc = new THREE.Raycaster(new THREE.Vector3(-66, 1.2, -46), new THREE.Vector3(1, 0, 0), 0, 20);
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
check(E.x2 - E.x1 >= 5 && WORLD.colliders.some(c => c.tag === 'bunker:entrada' && c.solid), 'entrada de hormigón sólida, de 5 m o más');
const FC = E.face || 1;                                                  // F5.15: mira al sur
setPlayer(BH.x, BH.z + FC * 0.8);
check(nearNav(BH.out[0], BH.out[1]), 'delante de la entrada se llega');
player.pos.set(BH.x, P.height, BH.z + FC * 0.8); G.updateInteract();
check(G.interactState.kind === 'hatch' && G.promptFor(G.interactState).text === 'Búnker cerrado', 'cerrada: cartel');
G.openBunker();
for (let i = 0; i < 60 * 3; i++) { G.tick(dt); G.updateBunker(dt); }
check(BUNK.halves[0].position.x < -2 && BUNK.halves[1].position.x > 2, 'al abrirse las puertas blindadas se corren');
G.updateInteract();
check(G.promptFor(G.interactState).text === '[F] Bajar al búnker', 'abierta: F para bajar');
G.resetGame();
check(Math.abs(BUNK.halves[0].position.x + 1.1) < 1e-6, 'resetGame: puertas cerradas');

console.log(fail ? `FALLA (${fail})` : 'PASA');
process.exit(fail ? 1 : 0);
