// V2 F5.6: jardines y techo. Plantas carnívoras (aviso, mordida letal, Quick Revive, cooldown, solo arriba, a los
// zombies no), perros del jardín trasero (solo con el jugador ahí, desde la R5, máx 3 por partida), cercos y
// puertas nuevas, reset.
const G = require('./harness.js');
const { state, player, CONFIG, WORLD, UP, PLANTS, roundState, keys } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const GD = CONFIG.GARDEN, P = CONFIG.PLAYER, dt = 1 / 60;

function fresh() {
  G.resetGame(); state.running = true; G.debugOpenAllDoors();
  state.round = 1; state.health = 100; state.lastDamageTime = -99; state.gameOver = false;
}
function onGround(x, z) { player.pos.set(x, P.height, z); player.vel.set(0, 0, 0); player.grounded = true; }
function tickGarden(secs) { for (let i = 0; i < Math.round(secs * 60); i++) { G.tick(dt); G.updateGarden(dt); } }
function clearZombies() {
  for (const q of state.zombies.slice()) { q.active = false; q.alive = false; q.root.visible = false; }
  state.zombies.length = 0;
}

// 1) plantas (F5.7: 4, cabeza ×2). F5.16: en el piso de los jardines de la casa, con maceta sólida
fresh();
check(PLANTS.length === 4 && GD.plants.every(([x, z]) => ['R12', 'R13'].includes(G.roomAt(x, z).id) && !G.roofAt(x, z)), 'F5.16: 4 plantas en los jardines de la casa (al aire libre)');
check(PLANTS.every(p => p.head.scale.x === GD.headScale), 'cabeza ×' + GD.headScale);
const pots = WORLD.colliders.filter(c => c.tag === 'plant');
check(pots.length === GD.plants.length && pots.every(c => !c.overhead && c.minY < 0.01 && c.solid), 'F5.16: maceta sólida en el piso');
const [px, pz] = GD.plants[0], pl = PLANTS[0];            // contra la pared oeste de la sala: te acercás desde el oeste
check(G.NAV.cells[G.navIdx(Math.floor(px), Math.floor(pz))] === 0, 'los zombies rodean la maceta (celda bloqueada)');
check(G.SPAWN_POINTS.filter(s => ['R12', 'R13'].includes(s.room)).every(s => s.valid && G.flowAt(s.cx, s.cz) >= 0), 'los spawns de los jardines siguen alcanzables');

// 2) aviso; no muerde (F5.10)
fresh(); onGround(px - (GD.plantWarn - 0.3), pz);
tickGarden(0.5);
check(pl.open > 0.6 && state.health === 100, 'a ' + (GD.plantWarn - 0.3).toFixed(1) + ' m se abre y avisa (no muerde)', `(boca ${pl.open.toFixed(2)})`);
state.lastDamageTime = G.clock.elapsedTime + 100;           // sin regenerar: cualquier daño se vería
onGround(px - 1, pz); pl.spitT = 99; tickGarden(5);
check(!state.gameOver && state.health === 100, 'F5.10: ya no muerde (5 s a 1 m, pedido de Diego)', `(vida ${state.health})`);
// del otro lado de la pared (adentro de la sala) no escupe
fresh(); player.pos.set(px + 2.5, P.height, pz); pl.spitT = 0; tickGarden(0.5);
check(!G.ACID.shots.some(s => s.active), 'F5.16: sin línea libre (adentro de la sala) no escupe');
fresh(); onGround(px - 3, pz); pl.spitT = 0; tickGarden(0.1);
check(G.ACID.shots.some(s => s.active && s.level === 0), 'F5.16: con línea libre escupe, en el piso');
// a los zombies no les hace nada
fresh(); clearZombies();
const q = G.spawnZombie(); q.state = 'walk'; q.level = 0; q.px = px - 0.9; q.pz = pz; q.health = 500;
onGround(-15, 5); tickGarden(2);
check(q.alive && q.health === 500, 'a los zombies no les hace nada');

// 2b) F5.7: pirañas en la primera mitad de cada tronco del muelle y en el puente
const PZ = GD.piranhas;
// F5.13: +3 zonas en el río del templo (sus 3 puentes)
check(G.PIRANHAS.zones.length === 5 && G.PIRANHAS.zones.every(z => z.fish.length === 3), 'F5.16: 5 zonas (el muelle, el puente y los 3 del río del templo), 3 carriles cada una', `(${G.PIRANHAS.zones.length})`);
function standIn(x, z, secs) {
  fresh(); player.pos.set(x, P.height, z); state.lastDamageTime = -99;
  let hits = 0, prev = 100;
  for (let i = 0; i < Math.round(secs * 60); i++) {
    G.tick(dt); G.updateGarden(dt);
    if (state.health < prev) { hits++; prev = state.health; }
    state.health = 100; prev = 100; state.lastDamageTime = -99;
  }
  return hits;
}
const zmain = PZ.zones[0];
let h = standIn(0, zmain.lanes[1], 9);
check(h >= 1 && h <= 6, 'parado en un carril del muelle: te tocan las de ese carril (orden al azar)', `(${h} en 9 s)`);
check(standIn(19, PZ.zones[1].lanes[2], 18) >= 1, 'y en el medio del puente C13');
// F5.13: en los puentes del río del templo (el oeste va a lo largo de z: carriles en x)
{ const zw = PZ.zones[2], zs = PZ.zones[4];                          // (F5.15: el templo se mudó al anexo NE)
  check(standIn(zw.lanes[1], (zw.x1 + zw.x2) / 2, 18) >= 1 && standIn((zs.x1 + zs.x2) / 2, zs.lanes[1], 18) >= 1, 'F5.13: y en los puentes del río del templo'); }
// F5.8: orden al azar (nunca el mismo carril dos veces seguidas) y en el puente pasan por encima de la baranda
fresh();
const seq = [], zb = G.PIRANHAS.zones[1], PB = PZ.zones[1];
let overRail = true;
for (let i = 0; i < 60 * 30; i++) {
  const before = zb.last; G.tick(dt); G.updateGarden(dt);
  if (zb.last !== before) seq.push(zb.fish.indexOf(zb.last));
  for (const f of zb.fish) if (f.k < 1 && (Math.abs(f.p.x - PB.x1) < 0.15 || Math.abs(f.p.x - PB.x2) < 0.15) && f.p.y < CONFIG.RAIL_H + 0.05) overRail = false;
}
const repeats = seq.filter((v, i) => i && v === seq[i - 1]).length, orders = new Set();
for (let i = 0; i + 2 < seq.length; i += 3) orders.add(seq.slice(i, i + 3).join(''));
check(repeats === 0 && orders.size > 1, 'orden al azar, sin repetir carril seguido', `(${orders.size} órdenes distintos)`);
check(overRail, 'en el puente pasan por encima de la baranda');
check(standIn(0, -40, 4) === 0 && standIn(-17, -44, 4) === 0, 'en la segunda mitad del muelle no saltan');
fresh(); player.pos.set(0, P.height, zmain.lanes[0]); state.lastDamageTime = -99;
let got = 0;
for (let i = 0; i < 60 * 18 && !got; i++) { G.tick(dt); G.updateGarden(dt); if (state.health < 100) got = 100 - state.health; }   // (el carril sale al azar)
check(got === PZ.damage && player.pushT > 0, 'cada una pega ' + PZ.damage + ' y te empuja', `(${got})`);
fresh(); clearZombies();
const zq = G.spawnZombie(); zq.state = 'walk'; zq.level = 0; zq.px = 0; zq.pz = zmain.lanes[0]; zq.health = 500;
player.pos.set(0, P.height, -8);
for (let i = 0; i < 60 * 4; i++) { G.tick(dt); G.updateGarden(dt); }
check(zq.health === 500, 'a los zombies no les hacen nada');
const kids = G.scene.children.length;
for (let i = 0; i < 60 * 5; i++) { G.tick(dt); G.updateGarden(dt); }
check(G.scene.children.length === kids, 'las pirañas son un pool fijo (la escena no crece)');

// 2c) F5.7: fuente, portón del sótano y caja de almas del jardín oeste
fresh();
const F = GD.fountain, fx = (F.x1 + F.x2) / 2, fz = (F.z1 + F.z2) / 2;
check(WORLD.colliders.some(c => c.tag === 'prop:fuente') && G.roomAt(fx, fz).id === 'R13' && !G.isNav(Math.floor(fx), Math.floor(fz)) && F.x2 > 34.5 && F.z2 > 39.5,
  'F5.8: fuente esquinera, sólida, en la esquina NE del jardín trasero');
player.pos.set(0, P.height, 34); G.updateFlowField(true);
check(G.flowAt(27, 21) >= 0 && G.flowAt(29, 25) >= 0 && G.flowAt(31, 38) >= 0, 'el cuadrado de la caseta es jardín y se llega a la esquina de la fuente');

// 2d) F5.8: escupitajo verde y charco
fresh(); player.pos.set(0, P.height, 34); state.lastDamageTime = -99;
const A = GD.acid;
G.spitAcid(6, 1.5, 34, 0);
let t0 = 0; for (let i = 0; i < 120 && state.health === 100; i++) { G.tick(dt); G.updateGarden(dt); t0 = i; }
check(state.health === 100 - A.hit, 'el escupitajo te pega ' + A.hit, `(vida ${state.health}, a los ${(t0 / 60).toFixed(2)} s)`);
state.lastDamageTime = -99;
const hp0 = state.health; for (let i = 0; i < Math.round(A.life * 60) + 30; i++) { G.tick(dt); G.updateGarden(dt); }
check(Math.abs((hp0 - state.health) - A.tick * A.life) < A.tick + 1e-6, 'y el charco a tus pies saca ' + A.tick + ' por segundo mientras dura (' + A.life + ' s)', `(-${hp0 - state.health})`);
fresh(); player.pos.set(0, P.height, 34);
G.spitAcid(6, 1.5, 34, 0);
for (let i = 0; i < 10; i++) { G.tick(dt); G.updateGarden(dt); }
player.pos.set(0, P.height, 37);                                    // te corrés: no te toca
for (let i = 0; i < 120; i++) { G.tick(dt); G.updateGarden(dt); }
check(state.health === 100, 'moviéndote se esquiva (y no pisás el charco)');
// arena mojada: frena al jugador y a los zombies
const [wx1, wx2, wz1, wz2] = GD.wetSand[0], wcx = (wx1 + wx2) / 2, wcz = (wz1 + wz2) / 2;
check(G.wetSandMul(wcx, wcz) === GD.wetMul && G.wetSandMul(0, -20) === 1, 'arena mojada: ×' + GD.wetMul + ' adentro, ×1 afuera');
fresh(); player.pos.set(wcx - 2.5, P.height, wcz); player.vel.set(0, 0, 0); player.yaw = -Math.PI / 2; keys.KeyW = true;
for (let i = 0; i < 60; i++) { G.tick(dt); G.updatePlayer(dt); }
const vIn = player.speedNow; keys.KeyW = false;
check(Math.abs(vIn - P.speed * GD.wetMul) < 0.1, 'te frena a ' + (P.speed * GD.wetMul).toFixed(2) + ' m/s', `(${vIn.toFixed(2)})`);
G.resetGame(); state.running = true;
const gate = state.doors.D19;
player.pos.set(-15, P.height, 36); G.updateInteract();
check(!gate.open && G.interactState.kind === 'door' && G.promptFor(G.interactState).text === 'Gate - opens with the power', 'portón del sótano: cerrado, con su cartel');
state.points = 99999;
check(!G.interact() && !gate.open && state.points === 99999, 'no se compra');
for (const k of G.GEN_KEYS) state.generators[k] = true;
G.turnOnPower();
check(gate.open && !gate.collider.solid, 'al prender la energía se abre solo');
G.resetGame();
check(!state.doors.D19.open, 'resetGame lo cierra');
check(G.roomAt(CONFIG.SOULS.spots.sotano.x, CONFIG.SOULS.spots.sotano.z).id === 'R12', 'la caja de almas del sótano está en el jardín oeste');
check(G.roomAt(CONFIG.PERKS.list.stamin.x, CONFIG.PERKS.list.stamin.z).id === 'R21', 'F5.16: Stamin-Up está en la estación de policía');

// 3) perros del jardín trasero
CONFIG.DOGS.enabled = true;
function gardenTries(round, x, z, n) {
  fresh(); clearZombies(); state.round = round; roundState.dogs = false;
  player.pos.set(x, P.height, z); G.updateFlowField(true);
  let dogs = 0;
  for (let i = 0; i < n; i++) {
    const d = G.spawnGardenDog();
    if (d) { dogs++; if (G.roomAt(d.px, d.pz).id !== GD.dogs.room) dogs += 100; d.active = d.alive = false; d.root.visible = false; state.zombies.length = 0; }
  }
  return dogs;
}
check(gardenTries(4, 10, 34, 200) === 0, 'en la R4 no salen');
check(gardenTries(5, 10, 34, 200) === GD.dogs.max, 'desde la R5, con vos en el jardín trasero: salen del jardín, ' + GD.dogs.max + ' por partida');
check(gardenTries(8, 0, 10, 200) === 0, 'fuera del jardín (en la sala) no salen');
fresh(); state.round = 6; player.pos.set(10, P.height, 34); G.updateFlowField(true);
let first = 0; for (let i = 0; i < 200 && !first; i++) { const d = G.spawnGardenDog(); if (d) first = i + 1; }
check(first > 0 && first < 60, 'salen de vez en cuando (~' + (GD.dogs.chance * 100) + '% de los spawns)', `(primero al intento ${first})`);
G.resetGame();
check(roundState.gardenDogs === 0, 'resetGame: vuelve a haber ' + GD.dogs.max + ' perros para la partida');
CONFIG.DOGS.enabled = false;
check(gardenTries(9, 10, 34, 200) === 0, 'con DOGS.enabled = false tampoco (los tests de rondas no los ven)');

// 4) cercos: frenan al jugador y las balas
fresh();
// (F5.12: los que separan zonas pasaron a ser cercos que se queman, H1..H5: acá quedan los fijos)
const hedges = WORLD.colliders.filter(c => c.tag === 'hedge');
check(hedges.length >= 5 && hedges.every(c => c.mesh && WORLD.hitMeshes.includes(c.mesh) && c.maxY >= GD.hedgeH - 1e-6), 'cercos de arbustos: sólidos y frenan balas');
player.pos.set(-22, P.height, 10); player.yaw = Math.PI / 2; keys.KeyW = true;
for (let i = 0; i < 120; i++) { G.tick(dt); G.updatePlayer(dt); }
keys.KeyW = false;
check(player.pos.x >= -24 + 0.2 + P.radius - 0.02, 'el cerco oeste del jardín frena');

// 5) reset
fresh(); onGround(px - 1.5, pz); tickGarden(0.5);
G.resetGame();
check(PLANTS.every(p => p.open === 0 && p.cd === 0), 'resetGame: plantas cerradas');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
