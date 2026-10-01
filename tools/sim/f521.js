// V2 F5.21: primer chicle gratis, embarcadero de dos pisos (tanda 4) y la boca del calamar por dentro (tanda 5).
// La planta jefa, la cinemática del PaP y el portal se prueban en f520.js
const G = require('./harness.js');
const { state, player, CONFIG, roundState, UP } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, P = CONFIG.PLAYER;
CONFIG.POWERUPS.dropChance = 0;
function fresh() { G.resetGame(); state.running = true; state.round = 8; roundState.phase = 'active'; state.points = 50000; state.health = 100; G.debugOpenAllDoors(); }
function setPlayer(x, z, y) { player.pos.set(x, (y === undefined ? G.groundY(x, z) : y) + P.height, z); player.vel.set(0, 0, 0); G.updateFlowField(true); }
// yaw 0 = hacia -z · -π/2 = hacia +x · π/2 = hacia -x · π = hacia +z
function walk(yaw, secs) {
  player.vel.set(0, 0, 0); player.yaw = yaw; G.keys.KeyW = true;
  for (let i = 0; i < Math.round(secs * 60); i++) { G.tick(dt); G.updatePlayer(dt); }
  G.keys.KeyW = false;
}

// 1) primer chicle gratis
fresh();
const gm = G.GUMM.machines[0];
G.PROFILE.preset.length = 0; G.PROFILE.preset.push('beacon');
const p0 = state.points;
check(/FREE/.test(G.gumPrompt(gm).text) && G.useGumMachine(gm) && state.points === p0, 'el primer chicle de la ronda es gratis');
G.GUMM.offer = null;
check(/500/.test(G.gumPrompt(gm).text), 'el segundo cuesta 500', '("' + G.gumPrompt(gm).text + '")');
G.startRound(9);
check(/FREE/.test(G.gumPrompt(gm).text), 'en la ronda siguiente, otra vez gratis');

// 2) embarcadero de dos pisos
fresh();
const D = CONFIG.SQUIDBAY.decks;
check(D.walk.every(([x1, x2, z1, z2]) => G.isUp(Math.floor((x1 + x2) / 2), Math.floor((z1 + z2) / 2))), 'los 3 tramos de arriba son caminables (dos muelles y el puente)');
check(G.isNav(-60, -44) && G.isNav(-48, -42), 'por debajo se sigue caminando el muelle', `(${G.isNav(-60, -44)}, ${G.isNav(-48, -42)})`);
setPlayer(-57, -29.3);
walk(0, 4);
check(player.pos.z < -37 && player.pos.y > UP.y + 1, 'se sube por la escalera del muelle largo', `(z ${player.pos.z.toFixed(1)}, y ${player.pos.y.toFixed(2)})`);
setPlayer(-58, -40.5, UP.y);
walk(-Math.PI / 2, 3.5);
check(player.pos.x > -50 && player.pos.y > UP.y + 1, 'se cruza el puente al otro muelle por arriba', `(x ${player.pos.x.toFixed(1)})`);
setPlayer(-49, -41, UP.y);
walk(Math.PI, 4);
check(player.pos.z > -32 && player.pos.y < 2.5, 'y se baja por la otra escalera', `(z ${player.pos.z.toFixed(1)}, y ${player.pos.y.toFixed(2)})`);
setPlayer(-60, -31);
walk(0, 4.5);
check(player.pos.z < -45 && player.pos.y < 2.5, 'se pasa caminando por debajo del piso de arriba', `(z ${player.pos.z.toFixed(1)}, y ${player.pos.y.toFixed(2)})`);
setPlayer(-59, -42, UP.y);
walk(Math.PI / 2, 2);
check(player.pos.x > -62 && player.pos.y > UP.y + 1, 'arriba, la baranda frena (no te caés al agua)', `(x ${player.pos.x.toFixed(2)})`);
const up0 = new (player.pos.constructor)(-59, 1.5, -42);
const hitUp = G.traceShot(up0, new (player.pos.constructor)(0, 1, 0), CONFIG.WEAPONS.m1911);
check(hitUp === null && G.segmentClear(-59, -42, -59, -42.01, 0, true), 'el piso de arriba frena las balas desde abajo');
// F5.22: Double Tap y la chiclera del calamar arriba del embarcadero
const dt2 = CONFIG.PERKS.list.dtap, gsp = CONFIG.GUMS.machine.spots.find(s => s.room === 'R19');
const gmR = G.GUMM.machines.find(m => m.room === 'R19'), R19 = G.ROOMS.find(r => r.id === 'R19');
check(dt2.level === 1 && G.walkAt(dt2.x + 0.9, dt2.z) && gsp.level === 1 && G.walkAt(gsp.x - 0.9, gsp.z), 'Double Tap y la chiclera están arriba de los muelles');
setPlayer(gsp.x - 1.1, gsp.z, UP.y);
const nearUp = G.gumNear(G.roomAt(player.pos.x, player.pos.z), player.pos.x, player.pos.z, 3);
setPlayer(gsp.x - 1.1, gsp.z);
const nearDown = G.gumNear(G.roomAt(player.pos.x, player.pos.z), player.pos.x, player.pos.z, 3);
check(nearUp && nearUp.target === gmR && !nearDown, 'la chiclera se usa desde arriba, no desde abajo');
// un zombie de abajo sube por la escalera y te alcanza arriba
fresh(); setPlayer(-59, -44, UP.y);
const z = G.ZPOOL.find(q => !q.active);
G.resetZombie(z, { x: -59.5, z: -31.5 }, false, 'normal'); state.zombies.push(z); z.state = 'walk'; z.gait = 'jog';
let reached = false;
for (let i = 0; i < 60 * 25 && !reached; i++) {
  G.tick(dt); G.updateFlowField(false); G.updateZombies(dt);
  if ((z.level || 0) === 1 && Math.hypot(z.px - player.pos.x, z.pz - player.pos.z) < 2) reached = true;
  state.health = 100;
}
check(reached, 'un zombie del muelle sube la escalera y te alcanza arriba', `(nivel ${z.level}, a ${Math.hypot(z.px - player.pos.x, z.pz - player.pos.z).toFixed(1)} m)`);

// 3) la boca del calamar por dentro: cámara grande, galerías arriba y escalera
fresh();
const SH = CONFIG.SQUIDHEAD, F = SH.deck.flights[0], F2 = SH.deck.flights[1], NAV = G.NAV;
G.startRound(3);
check(!G.SQHEAD.open && NAV.link[G.navIdx(F.bottom[0], F.bottom[1])] < 0, 'cerrada: la escalera de adentro no está enlazada');
G.SQHEAD.force = SH.openRound; G.setSquidHead(SH.openRound, true);
const [cx1, cx2, cz1, cz2] = SH.chamber;
check(G.SQHEAD.open && (cx2 - cx1) * (cz2 - cz1) >= 200, 'abierta: la cámara ocupa casi toda la cabeza (' + (cx2 - cx1) + ' × ' + (cz2 - cz1) + ' m)');
check([F, F2].every(f => NAV.link[G.navIdx(f.bottom[0], f.bottom[1])] >= 0) && SH.deck.walk.every(([x1, x2, z1, z2]) => G.isUp(Math.floor((x1 + x2) / 2), Math.floor((z1 + z2) / 2))), 'galerías y puente caminables, las dos rampas (lengua y esófago) enlazadas');
check(G.isNav(-94, -50) && G.isNav(-89, -45) && G.isNav(-86, -60), 'se camina por debajo de las galerías y en los dos huecos');
check(G.WORLD.colliders.some(c => c.tag === 'squidhead:corazon' && c.solid), 'el corazón del hueco sur es sólido');
setPlayer(-85, -41.2);
walk(0, 4);
check(player.pos.z < -51.3 && player.pos.y > UP.y + 1, 'se sube por la lengua hasta el puente del medio', `(z ${player.pos.z.toFixed(1)}, y ${player.pos.y.toFixed(2)})`);
const before = player.pos.clone();
walk(Math.PI / 2, 3);
check(player.pos.x < -91.5 && player.pos.y > UP.y + 1, 'y se cruza el puente hasta la galería oeste', `(de ${before.x.toFixed(1)},${before.z.toFixed(1)} a ${player.pos.x.toFixed(1)},${player.pos.y.toFixed(1)},${player.pos.z.toFixed(1)})`);
setPlayer(-91, -53.8);
walk(0, 4);
check(player.pos.z < -62.3 && player.pos.y > UP.y + 1, 'y por el esófago se sube a la galería del fondo', `(z ${player.pos.z.toFixed(1)}, y ${player.pos.y.toFixed(2)})`);
setPlayer(-93.5, -47, UP.y);
walk(-Math.PI / 2, 2);
check(player.pos.x < -92 && player.pos.y > UP.y + 1, 'la baranda del borde frena (no te caés al hueco sin querer)', `(x ${player.pos.x.toFixed(2)})`);

// 4) F5.22: el caparazón grande con el laboratorio y un TERCER NIVEL real
fresh();
const SL = CONFIG.SHELL, L2 = SL.lab2, F3 = L2.flight, UP2 = G.UP2;
check(SL.a >= 17 && SL.b >= 14 && SL.h >= 17, 'el caparazón es más grande (' + SL.a * 2 + ' × ' + SL.b * 2 + ' m, ' + SL.h + ' de alto)');
check(L2.walk.every(([x1, x2, z1, z2]) => G.isUp2(Math.floor((x1 + x2) / 2), Math.floor((z1 + z2) / 2))), 'la galería del laboratorio es caminable a ' + UP2.y + ' m (nivel 2)');
const aL = G.upIdx(F3.bottom[0], F3.bottom[1]), bL = G.up2Idx(F3.top[0], F3.top[1]);
check(G.NAV.link[aL] === bL && G.NAV.link[bL] === aL, 'la escalera enlaza el anillo (nivel 1) con la galería (nivel 2)');
setPlayer(-42, 85.4, UP.y);
walk(Math.PI, 3.5);
check(player.pos.z > 93.2 && player.pos.y > UP2.y + 1 && G.levelAt(player.pos.x, player.pos.z, player.pos.y - P.height) === 2, 'el jugador sube por la escalera de metal al nivel 2', `(z ${player.pos.z.toFixed(1)}, y ${player.pos.y.toFixed(2)})`);
setPlayer(-50, 96, UP2.y);
walk(0, 2);
check(player.pos.z > 92.8 && player.pos.y > UP2.y + 1, 'la baranda del nivel 2 frena (no te caés al anillo)', `(z ${player.pos.z.toFixed(2)})`);
check(G.levelAt(-50, 95, UP.y + 0.05) === 1 && G.levelAt(-50, 95, 0.05) === 0, 'debajo de la galería sigue el anillo (nivel 1) y más abajo el piso');
// (F5.24b: la cápsula se llama 'labpod': no se pisa)
check(SL.labProps.every((p, i) => G.WORLD.colliders.some(c => c.tag === (p[5] === 'pod' ? 'prop:labpod' : 'prop:lab' + i))), 'tanques, racks, escritorios, mesa y cápsula sólidos');
// un zombie del piso sube la rampa y la escalera y te alcanza en el nivel 2
fresh(); setPlayer(-50, 96.5, UP2.y);
const zz = G.ZPOOL.find(q => !q.active);
G.resetZombie(zz, { x: -58.5, z: 83.5 }, false, 'normal'); state.zombies.push(zz); zz.state = 'walk'; zz.gait = 'jog';
let top = false;
for (let i = 0; i < 60 * 40 && !top; i++) {
  G.tick(dt); G.updateFlowField(false); G.updateZombies(dt);
  if ((zz.level || 0) === 2 && Math.hypot(zz.px - player.pos.x, zz.pz - player.pos.z) < 2) top = true;
  state.health = 100;
}
check(top, 'un zombie de la planta baja sube hasta el nivel 2 y te alcanza', `(nivel ${zz.level}, a ${Math.hypot(zz.px - player.pos.x, zz.pz - player.pos.z).toFixed(1)} m)`);
check(Math.abs(zz.root.position.y - UP2.y) < 0.6, 'y se dibuja a la altura del nivel 2', `(y ${zz.root.position.y.toFixed(2)})`);

console.log(fail ? `FALLA (${fail})` : 'PASA');
process.exit(fail ? 1 : 0);
