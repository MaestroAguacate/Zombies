// V2 F5.5: quest de la Ola Rompiente. Lugares (taller, cocos, muelle) sin tocar el grid; cada pieza se registra
// una vez; el coco solo con machete; la caracola (F5.9) de la tortuga, cuando 3 plantas comieron 6 arrastrados; la cuerda solo del boss;
// armar requiere las 3; el arma (cono, daño, empujón, boss sin insta-kill, paredes); Quick Revive la devuelve al
// taller con su munición; reset.
const G = require('./harness.js');
const THREE = require('three');
const { state, player, CONFIG, WORLD, keys, weaponsState, QUEST, feel, BOSS, NAV } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const Q = CONFIG.QUEST, W = CONFIG.WEAPONS.wave, dt = 1 / 60;
CONFIG.POWERUPS.dropChance = 0;

function fresh() {
  G.resetGame(); state.running = true; G.debugOpenAllDoors();
  state.round = 1; state.health = 100; state.lastDamageTime = -99; state.gameOver = false;
  weaponsState.phase = 'idle';
  G.scene.updateMatrixWorld(true);                 // sin render nadie actualiza las cajas de los props (el rayo del machete)
}
function clearZombies() {
  for (const q of state.zombies.slice()) { q.active = false; q.alive = false; q.root.visible = false; }
  state.zombies.length = 0;
}
const _o = new THREE.Vector3(0, 0, -1);
function aimAt(x, y, z) {                          // la bala sale de feel.eye / feel.aimQuat
  feel.eye.copy(player.pos);
  feel.aimQuat.setFromUnitVectors(_o, new THREE.Vector3(x, y, z).sub(feel.eye).normalize());
}
function shoot() { weaponsState.phase = 'idle'; weaponsState.lastShot = -1e9; G.tick(1); G.fireWeapon(); }
function update(secs) { for (let i = 0; i < Math.round(secs * 60); i++) { G.tick(dt); G.updateQuest(dt); } }
function standAt(x, z) { player.pos.set(x, 1.7, z); G.updateInteract(); }
function hold(secs) { keys.KeyF = true; for (let i = 0; i < Math.round(secs * 60); i++) { G.tick(dt); G.updateInteract(); G.updateQuest(dt); } keys.KeyF = false; }
const shopFront = () => {                          // 1 m delante de la mesa, hacia donde mira (rot)
  const c = QUEST.shop.col, S = Q.workshop, l = S.d / 2 + 1.0;
  return { x: (c.minX + c.maxX) / 2 + Math.sin(S.rot) * l, z: (c.minZ + c.maxZ) / 2 + Math.cos(S.rot) * l };
};
function atShop() { const f = shopFront(); standAt(f.x, f.z); }
function allPieces() { state.quest.coconut = true; state.quest.string = true; state.quest.shell = true; }
function zombieAt(x, z, hp) {
  const q = G.spawnZombie(); q.state = 'walk'; q.px = x; q.pz = z; q.level = 0; q.health = q.maxHealth = hp; q.mode = 'flow';
  return q;
}

// 1) lugares: taller en la playa sin cambiar el grid y alcanzable; cocos arriba de su palmera; muelle
fresh();
const col = QUEST.shop.col;
check(G.roomAt((col.minX + col.maxX) / 2, (col.minZ + col.maxZ) / 2).id === 'R10', 'el taller está en la playa (F5.13)');
col.solid = false; G.buildNavGrid(); const without = Array.from(NAV.cells);
col.solid = true; G.buildNavGrid(); const withIt = Array.from(NAV.cells);
check(without.every((v, i) => v === withIt[i]), 'el taller no cambia el grid (va en el anillo pegado a la cerca)');
player.pos.set(0, 1.7, -2); G.updateFlowField(true);
const f0 = shopFront();
check(G.flowAt(Math.floor(f0.x), Math.floor(f0.z)) >= 0, 'se llega al frente del taller caminando');
check(Q.palms.every(P => G.PROPS.some(p => p.id === P.prop && Math.abs((p.box[0] + p.box[1]) / 2 - P.x) < 0.3 && Math.abs((p.box[2] + p.box[3]) / 2 - P.z) < 0.3)),
  'las 4 palmeras coinciden con su collider en PROPS');
const spots = Q.palms.map(P => G.cocoSpot(P));
const nearNav = s => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (G.flowAt(Math.floor(s.x) + dx, Math.floor(s.z) + dz) >= 0) return true; return false; };
check(spots.every(s => G.roomAt(s.x, s.z) && G.roomAt(s.x, s.z).id === 'R10' && nearNav(s)),
  'el coco de cada palmera cae en la playa, donde se llega', spots.map(s => `(${s.x.toFixed(1)}, ${s.z.toFixed(1)})`).join(' '));
const seen = new Set();
for (let i = 0; i < 80; i++) { G.resetGame(); seen.add(QUEST.palm); }
check(seen.size === 4 && !QUEST.coco.g.visible, 'se sortea una de las 4 por partida (sin coco a la vista)');
{
  const L = Q.shellLand, cx = Math.floor(L.x), cz = Math.floor(L.z);
  G.debugOpenAllDoors(); player.pos.set(-20, 1.7, 30); G.updateFlowField(true);   // (el loop de resetGame de arriba las cerró)
  check(G.roomAt(L.x, L.z).id === 'R19' && !WORLD.colliders.some(c => c.solid && !c.overhead && L.x > c.minX - 0.3 && L.x < c.maxX + 0.3 && L.z > c.minZ - 0.3 && L.z < c.maxZ + 0.3) &&
    nearNav(L), 'F5.13: la caracola cae enfrente de la boca del calamar, libre y donde se llega', `(${cx}, ${cz})`);
  const CH = CONFIG.SQUIDHEAD.chamber;
  check([Q.turtle, Q.shrimp, CONFIG.BUNKER.seahorse].every(T => T.x > CH[0] && T.x < CH[1] && T.z > CH[2] && T.z < CH[3]),
    'F5.13: las 3 estatuas están en la cámara de la cabeza del calamar');
}
check(WORLD.colliders.filter(c => c.tag.startsWith('quest')).length === 1, 'un solo collider nuevo (la mesa del taller)');

// 2) coco: solo el machete, solo la palmera sorteada. Se voltea, deja el coco y se pone dorado
function swingAt(P) {                              // parado a 1.2 m del tronco, mirándolo a la altura del pecho
  const a = P.rot + Math.PI / 2;
  player.pos.set(P.x + Math.cos(a) * 1.2, 1.7, P.z - Math.sin(a) * 1.2);
  aimAt(P.x, 1.2, P.z);
  G.meleeState.lastAttack = -1e9; weaponsState.phase = 'idle';
  G.meleeAttack(); weaponsState.phase = 'idle';
}
// F5.14: la pieza sale de la almeja morada (f514.js). La palmera queda detrás de CONFIG.QUEST.palmCoco
fresh(); QUEST.palm = 1;
const PP = Q.palms[1], wrong = Q.palms[2];
state.machete = true; swingAt(PP);
check(QUEST.fallT < 0, 'F5.14: con palmCoco apagado, el machete ya no voltea la palmera');
state.machete = false; Q.palmCoco = true;                         // lo de abajo prueba la mecánica vieja
swingAt(PP);
check(QUEST.fallT < 0, 'con el cuchillo no pasa nada');
player.pos.set(PP.x + 3, 1.7, PP.z + 3); aimAt(PP.x, 1.5, PP.z); shoot();
check(QUEST.fallT < 0, 'con una bala tampoco');
G.explodeAt(PP.x + 1, 0.1, PP.z);
check(QUEST.fallT < 0, 'ni con una granada');
state.machete = true;
swingAt(wrong);
check(QUEST.fallT < 0, 'machete a otra palmera: nada');
swingAt(PP);
check(QUEST.fallT === 0, 'machete a la sorteada: se empieza a voltear');
update(Q.fallTime * 0.5);
const tilt = G.THEMEFX.palms[1];
check(tilt.rotation.z < -0.2 && tilt.rotation.z > -1.2 && QUEST.coco.phase === 'none', 'cae de a poco (acelerando)', `(${tilt.rotation.z.toFixed(2)} rad)`);
update(Q.fallTime * 0.5 + 0.05);
check(tilt.rotation.z < -1.4 && QUEST.coco.phase === 'drop' && QUEST.coco.g.visible, 'queda acostada y suelta el coco');
update(1.5);
const C = QUEST.coco;
check(C.phase === 'ground' && G.roomAt(C.x, C.z).id === 'R10', 'el coco cae a la arena', `(${C.x.toFixed(1)}, ${C.z.toFixed(1)})`);
check(C.mesh.material.color.getHex() === Q.cocoGold && C.glow.material.opacity > 0, 'y se pone dorado, con brillo');
swingAt(PP);
check(QUEST.fallT === Q.fallTime && G.THEMEFX.palms.filter(t => t.rotation.z !== 0).length === 1, 'otro machetazo no la levanta ni voltea otra');
standAt(C.x + 0.8, C.z);
check(G.interactState.kind === 'qpiece' && G.promptFor(G.interactState).text === '[F] Recoger COCO DORADO', 'cartel: recoger coco dorado');
check(G.interact() && state.quest.coconut && !C.g.visible, 'F lo recoge');
G.updateInteract();
check(G.interactState.kind !== 'qpiece' && !G.pickQuestPiece(C), 'no se recoge dos veces');
check(/class="coco"/.test(G.UI.quest.innerHTML) && /string off/.test(G.UI.quest.innerHTML), 'HUD: coco lleno, lo demás gris');
Q.palmCoco = false;

// 3) cuerda: un zombie normal no la suelta; el boss sí, una vez
fresh(); clearZombies(); state.round = 12;
player.pos.set(0, 1.7, -10); G.updateFlowField(true);
const qz = zombieAt(0, -14, 100);
G.damageZombie(qz, 1000, false);
check(QUEST.string.phase === 'none', 'un zombie normal no suelta la cuerda');
CONFIG.BOSS.enabled = true;
const b = BOSS.z; G.spawnBoss(); b.px = 5; b.pz = -15; b.state = 'walk'; b.level = 0; b.act = null;
G.damageZombie(b, b.health + 10, false);
CONFIG.BOSS.enabled = false;
check(QUEST.string.phase === 'ground' && QUEST.string.room === 'R10' && QUEST.string.x === 5 && QUEST.string.g.visible,
  'El Sombrerón la suelta donde muere');
check(!G.dropString({ px: 0, pz: -8, level: 0 }) && QUEST.string.x === 5, 'un segundo boss no suelta otra');
standAt(5.8, -15);
check(G.promptFor(G.interactState).text === '[F] Recoger CUERDA DE GUITARRA' && G.interact() && state.quest.string && !QUEST.string.g.visible,
  'F la recoge');
check(!G.dropString({ px: 0, pz: -8, level: 0 }), 'ya recogida: no vuelve a caer');

// 4) F5.9: caracola. Las plantas comen arrastrados (F5.16: en el jardín); con 3 plantas llenas brilla; un tiro la tira
fresh(); clearZombies();
const spread0 = CONFIG.WEAPONS.m1911.spread; CONFIG.WEAPONS.m1911.spread = 0;   // tiro exacto a 19 m
const PL = G.PLANTS, GD = CONFIG.GARDEN;
function crawlerAt(x, z, level) { const q = zombieAt(x, z, 500); q.level = level; q.crawl = true; return q; }
function feed(p, n) { for (let i = 0; i < n; i++) { const q = crawlerAt(p.x, p.z + 1.5, 0); for (let k = 0; k < Q.plantEatEvery * 60 + 2 && q.alive; k++) { G.tick(dt); G.updateGarden(dt); } } }
player.pos.set(0, 1.7, -10);                                     // en la playa, lejos de las plantas
const p0 = PL[1];
const walker = zombieAt(p0.x, p0.z + 1.5, 500); walker.level = 0;
const above = crawlerAt(p0.x, p0.z + 1.5, 1);                    // F5.16: las plantas están en el piso
const farC = crawlerAt(p0.x, p0.z + GD.plantKill + 0.5, 0);
for (let i = 0; i < 120; i++) { G.tick(dt); G.updateGarden(dt); }
check(walker.alive && above.alive && farC.alive && p0.fed === 0, 'no come zombies normales, ni arrastrados en otro nivel o fuera del radio');
clearZombies();
const pts4 = state.points;
const c1 = crawlerAt(p0.x, p0.z + 1.5, 0), c2 = crawlerAt(p0.x, p0.z - 1.5, 0);
G.tick(dt); G.updateGarden(dt);
check(!c1.alive && c2.alive && p0.fed === 1 && state.points === pts4, 'se come un arrastrado del jardín (sin puntos)');
for (let i = 0; i < Math.round(Q.plantEatEvery * 60) - 5; i++) { G.tick(dt); G.updateGarden(dt); }
check(c2.alive, 'espera ' + Q.plantEatEvery + ' s para el siguiente');
for (let i = 0; i < 10; i++) { G.tick(dt); G.updateGarden(dt); }
check(!c2.alive && p0.fed === 2, 'y se come el otro');
clearZombies();
feed(p0, Q.plantEat - 2);
check(p0.fed === Q.plantEat && p0.looks.every(L => L.a.visible && !L.n.visible), 'con ' + Q.plantEat + ': se vuelve alienígena');
const extra = crawlerAt(p0.x, p0.z + 1.5, 0);
for (let i = 0; i < 200; i++) { G.tick(dt); G.updateGarden(dt); }
check(extra.alive && p0.fed === Q.plantEat, 'llena: ya no come');
clearZombies();
feed(PL[2], Q.plantEat);
feed(PL[0], Q.plantEat);                                           // F5.11: hacen falta las 4
G.updateQuest(dt);
check(QUEST.shell.phase === 'dull' && QUEST.shell.glow.material.opacity === 0, '3 plantas llenas: la caracola sigue opaca (F5.11: pide las 4)');
// opaca: la bala le pega como a una pared. F5.13: se tira desde el túnel de la cabeza del calamar, abierta
G.setSquidHead(CONFIG.SQUIDHEAD.openRound, true);
G.scene.updateMatrixWorld(true);
const sp = QUEST.shell.g.position.clone();
player.pos.set(-58, 1.7, -47);
aimAt(sp.x, sp.y + 0.15, sp.z); shoot();
check(QUEST.shell.phase === 'dull', 'opaca: el tiro no le hace nada');
feed(PL[3], Q.plantEat);
G.updateQuest(dt);
check(QUEST.shell.phase === 'glow' && QUEST.shell.glow.material.opacity > 0, '4 plantas llenas: brilla');
update(0.5);
check(QUEST.turtle.rotation.y !== 0, 'la tortuga baila');
// F5.13: con la cabeza cerrada (montículo) la bala no llega
G.setSquidHead(1, true); G.scene.updateMatrixWorld(true);
player.pos.set(-58, 1.7, -38);
aimAt(sp.x, sp.y + 0.15 - (CONFIG.SQUIDHEAD.h + 1) * (1 - CONFIG.SQUIDHEAD.minRise), sp.z); shoot();
check(QUEST.shell.phase === 'glow', 'F5.13: con la cabeza enterrada no se le llega');
G.setSquidHead(CONFIG.SQUIDHEAD.openRound, true);
player.pos.set(-58, 1.7, -47); G.scene.updateMatrixWorld(true);
aimAt(sp.x, sp.y + 0.15, sp.z); shoot();
check(QUEST.shell.phase === 'fall' && !WORLD.hitMeshes.includes(QUEST.shell.hit), 'un tiro desde el túnel del calamar: se cae (y ya no frena balas)');
update(Q.shellFall + 0.1);
check(QUEST.shell.phase === 'ground' && Math.hypot(QUEST.shell.g.position.x - Q.shellLand.x, QUEST.shell.g.position.z - Q.shellLand.z) < 0.01,
  'cae enfrente de la boca');
standAt(Q.shellLand.x + 0.6, Q.shellLand.z);
check(G.promptFor(G.interactState).text === '[F] Recoger CARACOLA' && G.interact() && state.quest.shell && !QUEST.shell.g.visible, 'F la recoge');
check(!G.shootShell(), 'ya recogida: no se vuelve a caer');
CONFIG.WEAPONS.m1911.spread = spread0;

// 5) taller: faltan piezas / mantener F 3 s
fresh(); state.quest.coconut = true; atShop();
check(G.interactState.kind === 'workshop' && G.promptFor(G.interactState).text === 'Taller de tablas - faltan piezas (1/3)', 'taller: faltan piezas (1/3)');
check(!G.workshopPress(), 'F sin piezas: nada');
hold(Q.craftTime + 0.2);
check(!state.quest.built, 'mantener F sin piezas no arma');
allPieces(); G.updateInteract();
check(G.promptFor(G.interactState).text === '[F] Mantener para armar la OLA ROMPIENTE', 'con las 3: "mantener para armar"');
G.giveWeapon('smg'); weaponsState.phase = 'idle';
G.interact(); hold(1.5); G.updateQuest(dt);
check(!state.quest.built && QUEST.craftT === 0, 'soltar F a la mitad corta el armado');
hold(Q.craftTime - 0.1);
check(!state.quest.built, 'a los 2.9 s todavía no');
hold(0.2);
const ws = state.weapons.map(w => w.id).join(',');
check(state.quest.built && ws === 'm1911,wave' && G.curDef().id === 'wave', 'a los 3 s: la Ola reemplaza a la equipada (subfusil)', ws);
check(G.curSlot().mag === 12 && G.curSlot().reserve === 36, '12 cargas y 36 de reserva');
check(G.UI.quest.innerHTML === '', 'HUD: los íconos se van');
G.updateInteract();
check(G.promptFor(G.interactState).text === 'OLA ROMPIENTE - ya la tenés' && !G.workshopPress(), 'taller: ya la tenés');
check(G.papDef('wave').name === "MARENA'S TSUNAMI" && G.papDef('wave').damage === W.damage * 2, "PaP: MARENA'S TSUNAMI, daño ×2");

// 6) el arma: cono (F5.14: 12 m, ±40°), daño, empujón, paredes, boss
function waveSetup() {
  fresh(); clearZombies(); allPieces(); atShop(); G.interact(); hold(Q.craftTime + 0.1);
  player.pos.set(0, 1.7, -10); G.setCam(0); G.updateFlowField(true);   // mirando a -z, la playa libre
  weaponsState.phase = 'idle';
}
waveSetup();
// F5.14: cono de 12 m y ±40°: afuera queda el de 13.5 m y el de 60° del eje
const near = zombieAt(0, -13, 10000), far = zombieAt(0.5, -17.5, 10000), out = zombieAt(1, -23.5, 10000);
const side = zombieAt(2.6, -11.5, 10000), back = zombieAt(0, -7, 10000);
const shots0 = state.shotsFired, mag0 = G.curSlot().mag;
shoot();
check(near.health === 10000 - W.damage && far.health === 10000 - W.damage, 'pega 2500 a los de 3 m y 7.5 m');
check(out.health === 10000 && side.health === 10000 && back.health === 10000, 'no pega a 13.5 m, a 60° del eje ni atrás');
check(Math.abs((-13 - near.pz) - W.knock * (1 - 0.5 * 3 / W.range)) < 0.15, 'empuja al de cerca ~3.5 m', `(${(-13 - near.pz).toFixed(2)} m)`);
check(far.pz < -17.5 - 1.5, 'y al de lejos, menos', `(${(-17.5 - far.pz).toFixed(2)} m)`);
check(state.shotsFired === shots0 && G.curSlot().mag === mag0 - 1, 'gasta una carga y no cuenta para la precisión');
clearZombies();
const k1 = zombieAt(0, -13, 100), pts = state.points;
shoot();
check(!k1.alive && state.points === pts + CONFIG.POINTS.kill, 'mata y da los puntos del kill');
// pared: jugador en la sala mirando a +x, zombie del otro lado de la pared de la cocina
clearZombies();
player.pos.set(6.8, 1.7, 6); G.setCam(-Math.PI / 2); G.updateFlowField(true);
const wz = zombieAt(9.5, 6, 10000);
shoot();
check(wz.health === 10000, 'no atraviesa paredes');
// boss: daño × bossMul, sin insta-kill, no lo mueve
clearZombies(); state.round = 12;
player.pos.set(0, 1.7, -10); G.setCam(0); G.updateFlowField(true);
CONFIG.BOSS.enabled = true;
const bb = BOSS.z; G.spawnBoss(); bb.px = 0; bb.pz = -14; bb.state = 'walk'; bb.level = 0; bb.act = null;
const bh = bb.health;
state.effects.instakill = 30;
shoot();
state.effects.instakill = 0;
CONFIG.BOSS.enabled = false;
check(bb.alive && Math.abs(bh - bb.health - W.damage * W.bossMul) < 1e-6 && bb.pz === -14,
  'al Sombrerón: 1000 (daño alto, sin insta-kill) y no lo mueve', `(${(bh - bb.health).toFixed(0)})`);

// 7) Quick Revive: la Ola vuelve al taller con su munición y se saca con F
waveSetup(); clearZombies();
shoot(); shoot();
const slot = G.curSlot(), magLeft = slot.mag;
state.perks = ['revive'];
G.damagePlayer(9999, 0, -12);
check(!state.gameOver && !state.weapons.some(w => w.id === 'wave') && !G.haveWave(), 'al revivir la perdés');
G.updateQuest(dt);
check(QUEST.shopModel.visible, 'queda arriba de la mesa del taller');
atShop();
check(G.promptFor(G.interactState).text === '[F] Agarrar OLA ROMPIENTE' && G.interact(), 'taller: F la vuelve a sacar');
check(G.curSlot() === slot && slot.mag === magLeft && state.quest.built, 'vuelve como la dejaste (misma munición)');
G.updateQuest(dt);
check(!QUEST.shopModel.visible, 'y se va de la mesa');

// 8) reset
G.resetGame();
check(!state.quest.built && !state.quest.coconut && !state.quest.string && !state.quest.shell && !QUEST.slot &&
  QUEST.coco.phase === 'none' && !QUEST.coco.g.visible && QUEST.fallT < 0 && G.THEMEFX.palms.every(t => t.rotation.z === 0) &&
  QUEST.string.phase === 'none' && !QUEST.string.g.visible && QUEST.shell.phase === 'dull' && QUEST.shell.g.visible &&
  WORLD.hitMeshes.includes(QUEST.shell.hit) && G.PLANTS.every(p => p.fed === 0 && p.looks.every(L => L.n.visible && !L.a.visible)) &&
  !QUEST.shopModel.visible && !state.weapons.some(w => w.id === 'wave') && /coco off/.test(G.UI.quest.innerHTML),
  'resetGame: palmeras paradas, sin piezas, sin Ola');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
