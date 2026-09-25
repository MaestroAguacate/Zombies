// V2 F2.8: el techo de la casa es sólido, con escalera desde el patio de la piscina. Segundo nivel del grid:
// los zombies suben y bajan por la escalera. Bordes: al aire libre abiertos (la caída te deja en 10 de vida),
// al vacío cerrados. El techo no cambia nada del piso.
// V2 F5.6: solo se camina una pasarela en S (UP.walk) sobre la caseta, el dormitorio, la cocina y la sala, con
// barandas de madera hacia el resto del techo, y una segunda escalera en el jardín oeste (pared oeste de la sala).
// V2 F5.7: toda la cocina y la sala ensanchada; escalera 2 de 4 m; caídas proporcionales (40 desde el techo).
// V2 F5.16: el techo de la casa es solo techo: sin escaleras ni pasarela. El grid de arriba es solo la cima del templo.
const G = require('./harness.js');
const THREE = require('three');
const { state, player, CONFIG, WORLD, keys, UP, NAV, FLOW } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const P = CONFIG.PLAYER, dt = 1 / 60;
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

// 1) el piso no cambia; el techo sigue cubriendo toda la casa; F5.16: no se camina
fresh();
const over = WORLD.colliders.filter(c => c.overhead);
const withRoof = Uint8Array.from(NAV.cells);
over.forEach(c => { c.solid = false; }); G.buildNavGrid();
const same = NAV.cells.every((v, i) => v === withRoof[i]);
over.forEach(c => { c.solid = true; }); G.buildNavGrid();
check(same, 'el techo (barandas y macetas incluidas) no cambia el grid del piso', `(${over.length} colliders de arriba)`);
const indoor = G.ROOMS.filter(r => !r.outdoor);   // (F5.17: R21 ya es el caparazón, al aire libre)
check(indoor.every(r => G.roofAt((r.x1 + r.x2) / 2, (r.z1 + r.z2) / 2)), 'todos los cuartos cerrados tienen techo', indoor.map(r => r.id).join(','));
check([[8.5, 16], [15, 16], [17, 19], [0, 29]].every(([x, z]) => G.roofAt(x, z)), 'los huecos entre cuartos están tapados');
const T = CONFIG.TEMPLE.top;
check(UP.flights.every(S => S.stone || S === CONFIG.SHELL.ramp) && UP.flights.length === CONFIG.TEMPLE.ramps.length + 1, 'F5.16: sin escaleras en la casa (F5.17: las rampas del templo y la escalera del caparazón)');
check([[20, 25], [11, 25], [11, 10], [0, 11], [-7.5, 11], [-10, 24]].every(([x, z]) => !G.walkAt(x, z) && G.roofAt(x, z)) &&
      G.walkAt((T.x1 + T.x2) / 2 - 3, (T.z1 + T.z2) / 2 - 5), 'F5.16: el techo de la casa no se camina; la cima del templo sí');
check(!WORLD.colliders.some(c => c.tag === 'roofrail' && c.maxX > -17 && c.minX < 36 && c.maxZ > 3 && c.minZ < 41), 'F5.16: sin barandas en el techo de la casa (quedan las del templo y del caparazón)');
// F5.7: caídas proporcionales (nada debajo de 2 m, 60 desde el techo, nunca mata)
const fall = (hp, drop) => { state.health = hp; state.gameOver = false; G.fallDamage(drop); return state.health; };
check(fall(100, 1.9) === 100 && Math.abs(fall(100, 3.15) - 70) < 1e-6 && Math.abs(fall(100, 4.3) - 40) < 1e-6 && fall(20, 4.3) === 1 && !state.gameOver,
  'caída: 1.9 m nada, 3.15 m -30, 4.3 m -60 (quedás en 40), nunca mata');
// F5.16: desde el jardín, contra la pared de la sala (donde estaba la escalera 2), no se sube
fresh(); place(-10, 11, false); walk(Math.PI / -2, 2);
check(player.pos.y < 2 && G.playerLevel() === 0, 'F5.16: donde estaba la escalera 2 ya no se sube', `(y ${player.pos.y.toFixed(2)})`);
fresh(); place(27, 24, false); walk(Math.PI / 2, 2);
check(player.pos.y < 2 && G.playerLevel() === 0, 'F5.16: donde estaba la escalera 1 tampoco', `(y ${player.pos.y.toFixed(2)})`);

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
