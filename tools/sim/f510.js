// V2 F5.10: rancho (lazo D20, props, Speed Cola, caja, spawns), trampa de tortugas, Kaboom, tope de invocados,
// tecla O, estrellas, neblina morada, arena mojada solo al jugador, animación de la planta, tortuga ×2 y
// langostino.
const G = require('./harness.js');
const THREE = require('three');
const { state, player, CONFIG, roundState, WORLD, NAV, TRAPS, KABOOM, BOSS, PLANTS, QUEST } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, P = CONFIG.PLAYER;
CONFIG.POWERUPS.dropChance = 0;

function fresh(open) {
  G.resetGame(); state.running = true; if (open) G.debugOpenAllDoors();
  state.round = 8; roundState.phase = 'active'; state.health = 100; state.lastDamageTime = -99; state.gameOver = false;
  state.points = 20000;
}
function clearZ() { for (const q of state.zombies.slice()) { q.active = q.alive = false; q.root.visible = false; } state.zombies.length = 0; }
function setPlayer(x, z) { player.pos.set(x, P.height, z); G.updateFlowField(true); }
function zombieAt(x, z, hp) {
  const q = G.spawnZombie(); q.state = 'walk'; q.px = x; q.pz = z; q.level = 0; q.mode = 'flow';
  if (hp) q.health = q.maxHealth = hp;
  return q;
}
const nearNav = (x, z) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (G.flowAt(Math.floor(x) + dx, Math.floor(z) + dz) >= 0) return true; return false; };

// 1) rancho: el lazo D20
fresh(false);
const D20 = state.doors.D20;
check(D20 && D20.cost === 1500 && !D20.open, 'lazo D20: 1500, cerrado');
check(G.roomAt(-49, 29).id === 'R14' && G.roomAt(-34, 29).id === 'R14' && G.roomAt(-26, 29).id === 'R12', 'F5.13: el rancho (R14) va de x -56 a -42 (F5.15: con su sendero hasta el lazo)');
Object.keys(state.doors).filter(id => id !== 'D20' && !/^H\d$/.test(id)).forEach(G.openDoor);   // todo abierto menos el lazo (F5.12: y los cercos del rancho)
setPlayer(-22, 29);
const dClosed = G.flowAt(-49, 36);
check(dClosed < 0 || dClosed > 30, 'F5.13: con el lazo cerrado el rancho queda lejos (se llega solo dando la vuelta por la jungla)', `(${dClosed})`);
player.pos.set(-25.5, P.height, 29); G.updateInteract();
check(G.interactState.kind === 'door' && G.interactState.target === D20, 'se compra desde el jardín');
state.points = 1500;
check(G.interact() && D20.open && state.points === 0, 'cobra 1500 y abre');
G.buildNavGrid(); setPlayer(-22, 29);
check(nearNav(-49, 36) && nearNav(-53.5, 38.5), 'abierto se llega a todo el rancho');
// frena al jugador cerrado y las balas pasan por encima
fresh(false); G.scene.updateMatrixWorld(true);
player.pos.set(-25.5, P.height, 29); player.vel.set(-P.speed, 0, 0);
for (let i = 0; i < 60; i++) { G.tick(dt); player.vel.x = -P.speed; G.updatePlayer(dt); }
check(player.pos.x > -27, 'cerrado frena al jugador', `(x ${player.pos.x.toFixed(2)})`);
const rc = new THREE.Raycaster();
rc.set(new THREE.Vector3(-25, 1.6, 29), new THREE.Vector3(-1, 0, 0)); rc.far = 5;
const hiLow = rc.intersectObjects(WORLD.hitMeshes, false);
rc.set(new THREE.Vector3(-25, 0.6, 29), new THREE.Vector3(-1, 0, 0));
const low = rc.intersectObjects(WORLD.hitMeshes, false);
check(!hiLow.some(h => h.object === D20.mesh) && low.some(h => h.object === D20.mesh), 'balas: a 0.6 m frena, a 1.6 m pasa por encima (reja)');
const kids0 = D20.mesh.children.length;
G.debugOpenAllDoors();
check(kids0 >= 2 && !D20.mesh.parent, 'la soga y los postes se van con el lazo');
// props y cosas del rancho: sólidos, alcanzables, sin cortar el grid de más
fresh(true); setPlayer(-22, 29);
const ids = CONFIG.RANCHO.props.map(p => p.id);
check(ids.every(id => G.PROPS.find(p => p.id === id && p.collider)), 'billar, barra y postes son sólidos', ids.join(', '));
const bil = G.PROPS.find(p => p.id === 'billar').box;
check(nearNav(bil[0] - 1, (bil[2] + bil[3]) / 2) && nearNav(bil[1] + 1, (bil[2] + bil[3]) / 2), 'se rodea el billar por los dos lados');
const sp = CONFIG.PERKS.list.speed;
check(sp.room === 'R14' && nearNav(sp.x + 1.2, sp.z), 'Speed Cola en el rancho y se llega');
const bs = CONFIG.BOX.spots.R14;
check(bs && G.roomAt(bs.x, bs.z).id === 'R14' && nearNav(bs.x, bs.z - 1.2), 'lugar de la caja en el rancho y se llega');
const spR14 = G.SPAWN_POINTS.filter(s => s.room === 'R14');
// (F5.11: +2 en el rancho hasta el mar)
check(spR14.length >= 3 && spR14.every(s => s.valid && G.flowAt(s.cx, s.cz) >= 0), 'spawns del rancho válidos y alcanzables');
player.pos.set(sp.x, P.height, sp.z - 1.2); G.updateInteract();
check(G.interactState.kind === 'perk' && G.interactState.target.key === 'speed', 'cartel de Speed Cola desde el rancho');

// 2) trampa de tortugas
fresh(true); clearZ(); setPlayer(-45, 36);
const TT = TRAPS.turtles, TC = CONFIG.TRAPS.turtles;
check(G.roomAt(TC.lever.x, TC.lever.z).id === 'R14', 'palanca del tortugario en el rancho');
player.pos.set(TC.lever.x + 1, P.height, TC.lever.z + 0.5); G.updateInteract();
check(G.interactState.kind === 'trap' && G.promptFor(G.interactState).text === '[F] Activate TURTLES' && G.promptFor(G.interactState).cost === TC.cost,
  'cartel: activar tortugas, ' + TC.cost);
setPlayer(-45, 36);
const prey = [zombieAt(-47, 22, 5000), zombieAt(-45, 26, 5000), zombieAt(-50, 31, 5000)];
const far = zombieAt(-20, 36, 5000);                            // en el jardín, fuera del alcance
state.health = 100;
G.useTrap(TT);
const pts = state.points;
let playerHit = false;
for (let i = 0; i < 60 * 12; i++) {
  G.tick(dt); G.updateTraps(dt);
  for (const q of prey.concat([far])) if (q.alive) { q.state = 'walk'; }
  if (state.health < 100) playerHit = true;
}
check(prey.every(q => !q.alive), 'se comen a los 3 del rancho', prey.map(q => q.alive ? `vivo (${q.px},${q.pz})` : 'comido').join(' '));
check(far.alive, 'al que está lejos del tortugario no');
check(state.points === pts, 'sin puntos', `(${state.points - pts})`);
check(!playerHit, 'a vos no te hacen nada');
check(TT.list.some(tu => tu.g.visible), 'andan por el rancho');
for (let i = 0; i < 60 * (TC.time - 12 + 6); i++) { G.tick(dt); G.updateTraps(dt); }
check(TT.phase === 'cool' && TT.list.every(tu => tu.state === 'off' && !tu.g.visible), 'al terminar vuelve a la cueva y se esconde (F5.16)');
fresh(true); clearZ(); CONFIG.BOSS.enabled = true; state.round = 12;
G.spawnBoss(); const b = BOSS.z; b.px = -47; b.pz = 24; b.state = 'walk'; const bh = b.health;
G.useTrap(TT);
for (let i = 0; i < 60 * 8; i++) { G.tick(dt); G.updateTraps(dt); b.px = -47; b.pz = 24; b.act = null; }
check(b.alive && b.health === bh, 'al boss no');
CONFIG.BOSS.enabled = false; clearZ();

// 3) Kaboom
fresh(true); clearZ(); setPlayer(0, 10); CONFIG.BOSS.enabled = true; state.round = 12;
const zs = [zombieAt(-4, 6), zombieAt(4, 12), zombieAt(0, 16)];
G.spawnBoss(); const kb = BOSS.z; kb.px = 5; kb.pz = -12; kb.state = 'walk';
roundState.total = 99; roundState.spawned = 3;
const pts2 = state.points, kbh = kb.health;
G.applyPowerup('kaboom');
check(zs.every(q => !q.alive && q.burnT > 0) && kb.alive && kb.health === kbh, 'Kaboom: todos los zombies mueren al instante, el boss no');
// F5.13: los kills no dan puntos, pero el Kaboom da 1000 + 50 por ronda (R12: 1550)
check(state.points - pts2 === 1000 + 50 * 11, 'F5.13: da 1000 + 50 × (ronda − 1), sin puntos por kill', `(${state.points - pts2})`);
check(KABOOM.flames.filter(f => f.z).length === 3, 'los 3 cuerpos arden');
check(!G.PICKUPS.pool.some(p => p.active), 'no suelta drops');
let spawnedDuring = 0, maxBurnAlive = 0;
for (let i = 0; i < 60 * (CONFIG.POWERUPS.types.kaboom.burn - 0.2); i++) {
  const s0 = roundState.spawned;
  G.tick(dt); G.updateRounds(dt); G.updateZombies(dt); G.updateEffects(dt);
  spawnedDuring += roundState.spawned - s0;
  maxBurnAlive = Math.max(maxBurnAlive, zs.filter(q => q.active).length);
}
check(spawnedDuring === 0, 'mientras arden no sale nadie (' + CONFIG.POWERUPS.types.kaboom.burn + ' s)');
check(maxBurnAlive === 3 && zs.every(q => q.active), 'los cuerpos siguen ahí ardiendo');
for (let i = 0; i < 60 * 2; i++) { G.tick(dt); G.updateRounds(dt); G.updateZombies(dt); G.updateEffects(dt); }
// (el pool se reusa: un cuerpo que se fue puede volver como zombie nuevo; se mira que ninguno siga ardiendo)
check(!state.zombies.some(q => q.state === 'dying') && KABOOM.flames.every(f => !f.z && !f.g.visible), 'a los 5 s se apagan y se van');
check(roundState.spawned > 3, 'y vuelven a salir zombies', `(${roundState.spawned - 3})`);
CONFIG.BOSS.enabled = false;

// 4) tope de invocados
fresh(true); clearZ(); setPlayer(0, -6); CONFIG.BOSS.enabled = true; state.round = 28;
G.spawnBoss('sombrero'); G.spawnBoss('sombrero'); G.spawnBoss('calamar');
const bosses = BOSS.pool.filter(z => z.active);
bosses.forEach((z, i) => { z.px = -6 + i * 6; z.pz = -14; z.state = 'walk'; z.level = 0; });
for (let k = 0; k < 4; k++) bosses.forEach(z => G.bossSummon(z));
const summoned = state.zombies.filter(q => q.alive && q.summoned).length;
check(summoned === CONFIG.BOSS.summonMax, 'invocados vivos a la vez: tope ' + CONFIG.BOSS.summonMax + ' entre todos', `(${summoned})`);
fresh(true); clearZ(); setPlayer(0, -6); state.round = 20;
G.spawnBoss('calamar'); const cq = BOSS.pool.find(z => z.variant === 'calamar' && z.active);
cq.px = 0; cq.pz = -14; cq.state = 'walk'; cq.level = 0;
check(G.bossSummon(cq) === CONFIG.BOSS.calamar.summonCount, 'el Calamarón llama ' + CONFIG.BOSS.calamar.summonCount);
CONFIG.BOSS.enabled = false;

// 5) tecla O
fresh(false);
const p0 = state.points;
G.debugKey('KeyO', false);
check(state.points === p0 + CONFIG.DEBUG.unlockPoints, 'O: +' + CONFIG.DEBUG.unlockPoints);
check(Object.values(state.doors).every(d => d.open), 'abre todas las puertas');
check(Object.values(state.generators).every(Boolean) && state.power, 'prende los generadores y la energía');
check(Object.values(state.souls).every(v => v >= CONFIG.SOULS.need) && G.RELICS.papOn, 'llena las cajas de almas y prende el Pack-a-Punch');
check(PLANTS.every(p => p.fed === 0) && QUEST.shell.phase === 'dull', 'no toca las plantas (la caracola sigue opaca)');
G.updateQuest(dt);
check(QUEST.shrimp.visible, 'aparece el langostino');
fresh(false); G.updateQuest(dt);
check(!QUEST.shrimp.visible, 'sin las cajas llenas no está');
check(QUEST.turtle.scale.x === CONFIG.QUEST.turtle.scale && QUEST.shell.g.scale.x === CONFIG.QUEST.turtle.scale, 'la tortuga (y la caracola) ×' + CONFIG.QUEST.turtle.scale);

// 6) cielo: estrellas y neblina morada
fresh(false);
for (let i = 0; i < 30; i++) { G.tick(dt); G.updateNight(dt); }
check(!G.STARS.points.visible, 'de día no hay estrellas');
G.setSky(15, false);
for (let i = 0; i < 60 * 4; i++) { G.tick(dt); G.updateNight(dt); }
check(G.STARS.points.visible && G.STARS.points.material.opacity > 0.9, 'de noche sí', `(${G.STARS.points.material.opacity.toFixed(2)})`);
G.setSky(22, false);
for (let i = 0; i < 60 * 8; i++) { G.tick(dt); G.updateNight(dt); G.updateBoss(dt); }
check(Math.abs(G.scene.fog.far - CONFIG.WEATHER.purple.fogFar) < 1e-6, 'neblina morada a ' + CONFIG.WEATHER.purple.fogFar + ' m', `(${G.scene.fog.far.toFixed(1)})`);

// 7) arena mojada: solo al jugador
fresh(true); clearZ();
const [wx1, wx2, wz1, wz2] = CONFIG.GARDEN.wetSand[0], wcx = (wx1 + wx2) / 2, wcz = (wz1 + wz2) / 2;
setPlayer(wcx + 8, wcz);
const wz = zombieAt(wcx - 2, wcz); wz.speed = 2; wz.gait = 'jog';
let vmax = 0;
for (let i = 0; i < 40; i++) {
  const ox = wz.px, oz = wz.pz;
  G.tick(dt); G.updateFlowField(false); G.updateZombies(dt);
  if (G.wetSandMul(wz.px, wz.pz) < 1) vmax = Math.max(vmax, Math.hypot(wz.px - ox, wz.pz - oz) / dt);
}
check(vmax > 1.9, 'la arena mojada ya no frena a los zombies', `(${vmax.toFixed(2)} m/s)`);

// 8) planta: animación de comer
fresh(true); clearZ();
const pl = PLANTS[1];
player.pos.set(0, 1.7, -10);                                      // F5.16: las plantas están en el jardín
const cr = zombieAt(pl.x, pl.z + 1.5, 500); cr.level = 0; cr.crawl = true;
let lifted = 0, minY = Infinity;
for (let i = 0; i < 60 * (CONFIG.GARDEN.eat.total + 0.3); i++) {
  G.tick(dt); G.updateGarden(dt); G.updateZombies(dt);
  if (cr.active) lifted = Math.max(lifted, cr.root.position.y);
  if (pl.prey) minY = Math.min(minY, pl.head.position.y);
}
check(pl.fed === 1 && !cr.alive, 'se lo come');
check(minY < pl.base.y - 0.5, 'la cabeza baja a agarrarlo', `(baja ${(pl.base.y - minY).toFixed(2)} m)`);
check(lifted > 0.8, 'y lo levanta', `(${lifted.toFixed(2)} m)`);
check(!cr.active && !pl.prey && pl.head.position.equals(pl.base) && cr.root.scale.x === 1, 'se lo traga y la cabeza vuelve a su lugar');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
