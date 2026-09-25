// V2 F2.8: el techo de la casa es sólido, con escalera desde el patio de la piscina. Segundo nivel del grid:
// los zombies suben y bajan por la escalera. Bordes: al aire libre abiertos (la caída te deja en 10 de vida),
// al vacío cerrados. El techo no cambia nada del piso.
// V2 F5.6: solo se camina una pasarela en S (UP.walk) sobre la caseta, el dormitorio, la cocina y la sala, con
// barandas de madera hacia el resto del techo, y una segunda escalera en el jardín oeste (pared oeste de la sala).
// V2 F5.7: toda la cocina y la sala ensanchada; escalera 2 de 4 m; caídas proporcionales (40 desde el techo).
const G = require('./harness.js');
const THREE = require('three');
const { state, player, CONFIG, WORLD, keys, UP, NAV, FLOW } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const P = CONFIG.PLAYER, dt = 1 / 60, TOP = UP.y + P.height, S2 = UP.stairs2;
// yaw: 0 = -z · π = +z · π/2 = -x · -π/2 = +x
const S_ = 0, N_ = Math.PI, W_ = Math.PI / 2, E_ = -Math.PI / 2;

function fresh() { G.resetGame(); state.running = true; G.debugOpenAllDoors(); state.round = 1; state.health = 100; }
function clearZombies() {
  for (const q of state.zombies.slice()) { q.active = false; q.alive = false; q.root.visible = false; }
  state.zombies.length = 0;
}
function place(x, z, onRoof) { player.pos.set(x, (onRoof ? UP.y : 0) + P.height, z); player.vel.set(0, 0, 0); player.grounded = true; player.airTop = onRoof ? UP.y : 0; }
function walk(yaw, secs, until) {
  player.yaw = yaw; keys.KeyW = true;
  let minY = 1e9;
  for (let i = 0; i < secs * 60; i++) { G.tick(dt); G.updatePlayer(dt); minY = Math.min(minY, player.pos.y); if (until && until()) break; }
  keys.KeyW = false;
  for (let i = 0; i < 30; i++) { G.tick(dt); G.updatePlayer(dt); }
  return minY;
}

// 1) el piso no cambia; el techo sigue cubriendo toda la casa; se camina solo la pasarela (un tercio)
fresh();
const over = WORLD.colliders.filter(c => c.overhead);
const withRoof = Uint8Array.from(NAV.cells);
over.forEach(c => { c.solid = false; }); G.buildNavGrid();
const same = NAV.cells.every((v, i) => v === withRoof[i]);
over.forEach(c => { c.solid = true; }); G.buildNavGrid();
check(same, 'el techo (barandas y macetas incluidas) no cambia el grid del piso', `(${over.length} colliders de arriba)`);
const indoor = G.ROOMS.filter(r => !r.outdoor);
check(indoor.every(r => G.roofAt((r.x1 + r.x2) / 2, (r.z1 + r.z2) / 2)), 'todos los cuartos cerrados tienen techo', indoor.map(r => r.id).join(','));
check([[8.5, 16], [15, 16], [17, 19], [0, 29]].every(([x, z]) => G.roofAt(x, z)), 'los huecos entre cuartos están tapados');
let roofN = 0, walkN = 0;
for (let i = 0; i < UP.mask.length; i++) { roofN += UP.mask[i]; walkN += UP.walkMask[i]; }
check(walkN > roofN * 0.35 && walkN < roofN * 0.5, 'F5.7: se camina ~40% del techo (cocina entera, sala ensanchada)', `(${walkN} de ${roofN} m²)`);
check([[20, 25], [11, 25], [11, 17], [11, 10], [17, 5], [16, 10], [5, 5], [0, 11], [-7.5, 11]].every(([x, z]) => G.walkAt(x, z)) &&
      [[-10, 24], [0, 24], [0, 16], [3, 20], [20, 29]].every(([x, z]) => !G.walkAt(x, z) && G.roofAt(x, z)),
  'pasarela sobre caseta, dormitorio, toda la cocina y la sala; garaje, pasillo y el resto quedan afuera');
// F5.7: caídas proporcionales (nada debajo de 2 m, 60 desde el techo, nunca mata)
const fall = (hp, drop) => { state.health = hp; state.gameOver = false; G.fallDamage(drop); return state.health; };
check(fall(100, 1.9) === 100 && Math.abs(fall(100, 3.15) - 70) < 1e-6 && Math.abs(fall(100, 4.3) - 40) < 1e-6 && fall(20, 4.3) === 1 && !state.gameOver,
  'caída: 1.9 m nada, 3.15 m -30, 4.3 m -60 (quedás en 40), nunca mata');
let upN = 0; for (let i = 0; i < UP.cells.length; i++) upN += UP.cells[i];
place(0, 11, true); G.updateFlowField(true);
const b = G.navIdx(UP.bottom[0], UP.bottom[1]), b2 = G.navIdx(S2.bottom[0], S2.bottom[1]);
check(upN > 120 && FLOW.srcLevel === 1 && FLOW.dist[b] > 0 && FLOW.dist[b2] > 0 && G.flowAt(-10, 35) > 0,
  'desde la sala, el campo baja por las dos escaleras y llega a todo el mapa',
  `(${upN} celdas arriba, pie de la escalera 1 a ${FLOW.dist[b]}, de la 2 a ${FLOW.dist[b2]})`);

// 2) de la escalera 1 (F5.8: en el jardín trasero, contra la caseta) a la escalera 2 por la pasarela, sin caer
// (sin plantas: updateGarden no corre)
const S1 = UP.stairs;
fresh(); place(29.8, (S1.z1 + S1.z2) / 2, false);
walk(W_, 4, () => player.pos.x <= 23.2);
check(Math.abs(player.pos.y - TOP) < 1e-6 && G.roomAt(29.8, 25.7).id === 'R13', 'F5.8: desde el jardín trasero sube la escalera 1 al techo de la caseta', `(x ${player.pos.x.toFixed(2)})`);
let low = 1e9;
low = Math.min(low, walk(N_, 3, () => player.pos.z >= 25));
low = Math.min(low, walk(W_, 6, () => player.pos.x <= 11));
low = Math.min(low, walk(S_, 6, () => player.pos.z <= 11));
check(low > TOP - 0.01 && G.playerLevel() === 1, 'caseta -> dormitorio -> cocina -> sala por arriba, sin caer', `(x ${player.pos.x.toFixed(1)}, z ${player.pos.z.toFixed(1)})`);
walk(W_, 8, () => player.pos.x <= -14.2);
check(G.roomAt(player.pos.x, player.pos.z).id === 'R12' && Math.abs(player.pos.y - P.height) < 1e-6 && state.health === 100,
  'baja por la escalera 2 al jardín oeste, sin golpe', `(x ${player.pos.x.toFixed(2)}, y ${player.pos.y.toFixed(2)})`);
// y sube por ella
fresh(); place(-14.6, 11, false);
walk(E_, 4, () => player.pos.x >= -6.5);
check(Math.abs(player.pos.y - TOP) < 1e-6 && G.playerLevel() === 1, 'F5.6: desde el jardín oeste sube la escalera 2 al techo de la sala');
// su costado frena como el de la escalera 1
fresh(); place(-10.5, S2.z2 + 0.8, false);
for (let k = 0; k < 3; k++) { keys.Space = true; walk(S_, 0.4); keys.Space = false; }
check(player.pos.y - P.height < 0.5 && player.pos.z >= S2.z2 + P.radius - 0.05, 'escalera 2: de costado no se trepa', `(z ${player.pos.z.toFixed(2)})`);

// 3) barandas: frenan hacia el resto del techo (y las balas, por debajo de 1.1 m)
fresh(); place(20, 25, true); walk(N_, 3);
check(Math.abs(player.pos.y - TOP) < 1e-6 && player.pos.z <= 28 - 0.06 - P.radius + 0.02, 'baranda norte (sobre el dormitorio y la caseta) frena');
fresh(); place(11, 25, true); walk(W_, 3);
check(player.pos.x >= 8 + 0.06 + P.radius - 0.02 && G.playerLevel() === 1, 'no se pasa al techo del pasillo ni del garaje');
fresh(); place(0, 11, true); walk(N_, 3);
check(player.pos.z <= 14 - 0.06 - P.radius + 0.02 && G.playerLevel() === 1, 'baranda norte de la sala frena (hacia el pasillo)');
check(S2.z2 - S2.z1 === 4, 'F5.7: la escalera 2 mide 4 m de ancho');
check(WORLD.colliders.filter(c => c.tag === 'roofrail').every(c => c.overhead && !G.standable(c)), 'las barandas son de arriba y no se pisan');
G.scene.updateMatrixWorld(true);
const ray = new THREE.Raycaster(new THREE.Vector3(4, UP.y + 0.6, 11), new THREE.Vector3(0, 0, 1), 0, 10);   // a la baranda norte (en x 0 está Juggernog)
const hit = ray.intersectObjects(WORLD.hitMeshes, false)[0];
check(hit && hit.object.userData.tag === 'roofrail', 'la bala baja frena en la baranda');

// 4) F5.8: baranda en todo el borde, salvo la llegada de las escaleras y un hueco de 2 m sobre la piscina
const H40 = 100 - CONFIG.PLAYER.fallMaxDmg;
fresh(); place(17, 9, true);
walk(E_, 2);
check(G.roomAt(player.pos.x, player.pos.z).id === 'R8' && Math.abs(state.health - H40) < 1e-6, 'por el hueco de la cocina (z 8..10) te tirás al patio de la piscina: 40');
fresh(); place(17, 12, true); walk(E_, 2);
check(G.playerLevel() === 1 && player.pos.x <= 18 - 0.06 - P.radius + 0.02, 'fuera del hueco, la baranda de la cocina frena');
fresh(); place(0, 5, true); walk(S_, 2);
check(G.playerLevel() === 1 && player.pos.z >= 4 + 0.06 + P.radius - 0.02, 'baranda sobre todo el porche');
fresh(); place(-7.6, 6, true); walk(W_, 2);
check(G.playerLevel() === 1 && player.pos.x >= -8 + 0.06 + P.radius - 0.02, 'baranda sobre el jardín oeste (fuera de la escalera 2)');
fresh(); place(23.4, 27.5, true); walk(E_, 2);   // F5.11: la llegada de la escalera ancha va de z 21 a 27
check(G.playerLevel() === 1 && player.pos.x <= 24 - 0.06 - P.radius + 0.02, 'baranda sobre el jardín trasero al norte de la escalera 1, sin taparla');
fresh(); state.health = 6; place(17, 9, true);
state.lastDamageTime = G.clock.elapsedTime + 100;                  // sin regenerar durante la prueba
walk(E_, 2);
check(state.health === 1 && !state.gameOver, 'con 6 de vida, la caída te deja en 1 y no te mata');
fresh(); place(0, 0, false);
keys.Space = true; G.tick(dt); G.updatePlayer(dt); keys.Space = false;
for (let i = 0; i < 90; i++) { G.tick(dt); G.updatePlayer(dt); }
check(state.health === 100, 'un salto normal no lastima');
fresh(); place(21, 14, false);                                    // de la orilla a la pileta (1.6 m): no lastima
walk(E_, 1.5);
check(state.health === 100 && player.pos.y < 1, 'tirarse a la pileta (1.6 m) no lastima');

// 5) la escalera 1: sin pasamanos, pero el costado frena (no se trepa ni se mete adentro a mitad)
check(!WORLD.colliders.some(c => c.tag === 'stairrail'), 'sin pasamanos');
fresh(); place(26, S1.z1 - 0.7, false);
for (let k = 0; k < 3; k++) { keys.Space = true; walk(N_, 0.4); keys.Space = false; }
check(player.pos.y - P.height < 0.5 && player.pos.z <= S1.z1 - P.radius + 0.05, 'a mitad de la escalera, de costado, no se trepa ni se mete', `(z ${player.pos.z.toFixed(2)})`);
fresh(); place(23.6, (S1.z1 + S1.z2) / 2, true);
let py = player.pos.y, maxDrop = 0;
player.yaw = E_; keys.KeyW = true;
for (let i = 0; i < 150; i++) { G.tick(dt); G.updatePlayer(dt); maxDrop = Math.max(maxDrop, py - player.pos.y); py = player.pos.y; }
keys.KeyW = false;
check(player.pos.x > S1.x2 && Math.abs(player.pos.y - P.height) < 1e-6 && maxDrop < 0.1 && state.health === 100, 'baja la escalera caminando, sin golpe');
// F5.8 (bug del playtest): pegado al costado de una rampa, en la parte alta, te podés alejar (antes quedabas trabado)
const away = (x, z, yaw) => { fresh(); place(x, z, false); const x0 = player.pos.x, z0 = player.pos.z; walk(yaw, 1.5); return Math.hypot(player.pos.x - x0, player.pos.z - z0); };
check(away(-9.2, S2.z2 + 0.2, N_) > 2 && away(-9.2, S2.z2 + 0.2, W_) > 2 && away(26, S1.z1 - 0.2, E_) > 2,   // (F5.11: al sur está la pared de la piscina)
  'pegado al costado de una rampa no te trabás: te alejás hacia afuera o hacia abajo');

// 6) zombies: suben, cruzan la pasarela, te pegan; el de abajo no
function chase(zx, zz, zlevel, px, pz, plevel, secs) {
  fresh(); clearZombies(); place(px, pz, plevel === 1); G.updateFlowField(true);
  const q = G.spawnZombie(); q.state = 'walk'; q.px = zx; q.pz = zz; q.level = zlevel; q.mode = 'flow';
  q.gait = 'run'; q.speed = CONFIG.ZOMBIE.gaits.run.speed;
  let hit = -1, stairs = false, strikes = 0, wrong = false, off = 0;
  for (let i = 0; i < secs * 60 && hit < 0; i++) {
    state.health = 100; state.lastDamageTime = -99;
    G.tick(dt); G.updateFlowField(false); G.updateZombies(dt);
    if (state.health < 100) { hit = i / 60; if (q.level !== plevel) wrong = true; }
    if (q.state === 'climb' && q.climb && q.climb.stairs) stairs = true;
    if (q.level === 1 && q.state === 'walk' && !G.walkAt(q.px, q.pz)) off++;
    strikes = Math.max(strikes, q.strikes);
  }
  return { hit, stairs, strikes, level: q.level, wrong, off };
}
let m = chase(27.5, 7.5, 0, 0, 11, 1, 60);
check(m.hit > 0 && m.stairs && !m.wrong && m.off === 0 && m.strikes < CONFIG.ZOMBIE.stuckStrikes, 'zombie de la piscina: sube, sigue la pasarela y te pega en la sala', `(${m.hit.toFixed(1)} s, strikes ${m.strikes})`);
m = chase(-20, 5, 0, 5, 11, 1, 60);
check(m.hit > 0 && m.stairs && !m.wrong && m.off === 0, 'F5.6: zombie del jardín oeste: sube por la escalera 2', `(${m.hit.toFixed(1)} s)`);
m = chase(0, 11, 0, 0, 11, 1, 1.5);
check(m.hit < 0, 'el de adentro de la sala, justo abajo, no te pega a través del techo');
m = chase(0, 11, 1, 25, 6, 0, 60);
check(m.hit > 0 && m.stairs && m.level === 0 && !m.wrong, 'zombie en el techo: baja por una escalera cuando bajás', `(${m.hit.toFixed(1)} s)`);

// 6b) amontonados contra un borde abierto (sobre el jardín oeste) no se salen: el borde frena solo a los zombies
fresh(); clearZombies(); state.round = 12;
place(-7.6, 9, true); G.updateFlowField(true);
const pack = [];
for (let i = 0; i < 12; i++) {
  const q = G.spawnZombie(); if (!q) continue;
  q.state = 'walk'; q.level = 1; q.px = -6 + (i % 6) * 1.2; q.pz = 10.3 + Math.floor(i / 6) * 1.0; q.gait = 'run'; q.speed = 5.6;
  pack.push(q);
}
let outside = 0;
for (let i = 0; i < 60 * 15; i++) {
  state.health = 100; state.lastDamageTime = -99;
  G.tick(dt); G.updateFlowField(false); G.updateZombies(dt);
  for (const q of pack) if (q.alive && q.level === 1 && q.state === 'walk' && !G.walkAt(q.px, q.pz)) outside++;
}
check(pack.length >= 10 && outside === 0, '12 zombies apretados contra el borde sobre el jardín: ninguno se sale de la pasarela', `(${outside} cuadros afuera)`);
check(WORLD.colliders.some(c => c.zombieOnly) && WORLD.colliders.filter(c => c.zombieOnly).every(c => !c.mesh), 'los bordes abiertos tienen límite solo para zombies (sin mesh)');

// 7) granadas
fresh(); clearZombies();
const g = G.spawnGrenade(0, 7, 11, 0, 0, 0, 99);
for (let i = 0; i < 120; i++) { G.tick(dt); G.stepGrenade(g, dt); }
check(Math.abs(g.p.y - (UP.y + CONFIG.GRENADE.size)) < 0.01, 'la granada queda sobre el techo de la sala', `(y ${g.p.y.toFixed(3)})`);
g.active = false; g.mesh.visible = false;
const below = G.spawnZombie(); below.state = 'walk'; below.px = 0; below.pz = 11.5; below.health = 1e6; below.level = 0;
const above = G.spawnZombie(); above.state = 'walk'; above.px = 1; above.pz = 11; above.health = 1e6; above.level = 1;
G.explodeAt(0, UP.y + 0.1, 11);
check(below.health === 1e6 && above.health < 1e6, 'explosión en el techo: daña al de arriba, no al de abajo');
// fuera de la pasarela (techo del garaje) sigue siendo techo: la explosión no baja
fresh(); clearZombies();
const under = G.spawnZombie(); under.state = 'walk'; under.px = -10; under.pz = 24; under.health = 1e6; under.level = 0;
G.explodeAt(-10, UP.y + 0.1, 24.5);
check(under.health === 1e6, 'una granada sobre el techo del garaje no daña al de abajo');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
