// V2 F2.5: generadores (cuchillo), cajas de almas (kills cerca, cualquier arma) y Pack-a-Punch bloqueado
// hasta tener todo. swing() como en knife.js: el harness no corre updateWeapon(), la fase vuelve a mano.
const G = require('./harness.js');
const { state, player, CONFIG, WORLD, weaponsState, RELICS } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const SC = CONFIG.SOULS, need = SC.need;

function fresh() {
  G.resetGame(); state.running = true; G.debugOpenAllDoors();
  state.round = 1; G.updateFlowField(true);
}
// frente de un spot, a dist m de la cara
function frontOf(sp, S, dist) {
  const c = Math.cos(sp.rot), s = Math.sin(sp.rot), l = S.d / 2 + dist;
  return { x: sp.x + l * s, z: sp.z + l * c };
}
// jugador parado en (x, z) mirando al punto (tx, ty, tz)
function aimAt(x, z, tx, ty, tz) {
  player.pos.set(x, 1.7 + G.groundY(x, z), z);
  const dx = tx - x, dz = tz - z;
  G.setCam(Math.atan2(-dx, -dz));
  player.pitch = Math.atan2(ty - player.pos.y, Math.hypot(dx, dz));
  G.camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ'); G.camera.updateMatrixWorld();
  G.updateCameraFeel(0);
  G.scene.updateMatrixWorld(true);
}
function swing() {
  G.meleeState.lastAttack = -1e9;
  G.meleeAttack();
  weaponsState.phase = 'idle'; weaponsState.phaseT = 0;
}
function shoot() {
  weaponsState.phase = 'idle'; weaponsState.lastShot = -1e9;
  const s = state.weapons[state.currentWeapon]; s.mag = 5;
  G.fireWeapon();
}
function killAllAlive() { for (const q of state.zombies.slice()) { if (q.alive) G.damageZombie(q, 1e9, false); free(q); } }
// zombie vivo en (x, z)
function zombieAt(x, z) {
  const q = G.spawnZombie();
  q.state = 'walk'; q.px = x; q.pz = z;
  G.placeRoot(q, 0); G.scene.updateMatrixWorld(true);
  return q;
}
// el muerto vuelve al pool (en el juego lo hace updateZombies al terminar de caer): sin esto se agota
function free(q) {
  q.active = false; q.alive = false; q.state = 'idle'; q.root.visible = false;
  const i = state.zombies.indexOf(q);
  if (i >= 0) state.zombies.splice(i, 1);
}
// mata un zombie en (x, z) con bala (damageZombie de arma de fuego) y devuelve la caja que sumó
function bulletKillAt(x, z) {
  const q = zombieAt(x, z);
  const before = { ...state.souls };
  G.damageZombie(q, 1e9, false);
  free(q);
  return Object.keys(before).filter(k => state.souls[k] !== before[k]);
}

// 1) lugares: dentro de su cuarto, sin cambiar el grid, alcanzables
fresh();
const relicCols = WORLD.colliders.filter(c => /^(gen:|souls:|pap$)/.test(c.tag));
check(relicCols.length === 4 + 3 + 1, '4 generadores + 3 cajas + Pack-a-Punch con collider', `(${relicCols.length})`);
const all = [...Object.entries(CONFIG.GENERATORS.spots).map(([k, sp]) => [k, sp, CONFIG.GENERATORS.size]),
             ...Object.entries(SC.spots).map(([k, sp]) => [k, sp, SC.size])];
check(all.every(([k, sp]) => G.roomAt(sp.x, sp.z) && G.roomAt(sp.x, sp.z).id === sp.room), 'cada uno en su cuarto');
// (F5.7: el PaP va en el medio de la plazoleta del muelle y sí bloquea sus celdas: se prueba en map.js)
const wall = relicCols.filter(c => !c.tag.startsWith('pap'));
const withRelics = Uint8Array.from(G.NAV.cells);
wall.forEach(c => { c.solid = false; }); G.buildNavGrid();
const same = G.NAV.cells.every((v, i) => v === withRelics[i]);
wall.forEach(c => { c.solid = true; }); G.buildNavGrid();
check(same, 'generadores y cajas no cambian el grid (anillo no navegable, como la caja)');
player.pos.set(0, 1.7, -2); G.updateFlowField(true);
const unreach = all.filter(([k, sp, S]) => {
  const f = frontOf(sp, S, 0.8), cx = Math.floor(f.x), cz = Math.floor(f.z);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (G.flowAt(cx + dx, cz + dz) >= 0) return false;
  return true;
});
check(unreach.length === 0, 'se llega caminando al frente de cada uno', unreach.length ? JSON.stringify(unreach.map(u => u[0])) : '');
let minD = 1e9;
for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
  const a = Object.values(SC.spots)[i], b = Object.values(SC.spots)[j];
  minD = Math.min(minD, Math.hypot(a.x - b.x, a.z - b.z));
}
check(minD > 2 * SC.radius, 'las cajas están a más de 2 radios: un kill cuenta para una sola', `(${minD.toFixed(1)} m)`);
check(SC.radius === 4 && need === 15, 'radio 4 m, 15 almas por caja');

// 2) generador: solo el cuchillo lo prende, de un golpe
fresh();
const GS = CONFIG.GENERATORS.size, gp = CONFIG.GENERATORS.spots.garaje, gf = frontOf(gp, GS, 1.1);
aimAt(gf.x, gf.z, gp.x, 0.7, gp.z);
shoot(); shoot(); shoot();
const marks = G.decals.pool.filter(d => d.visible && Math.hypot(d.position.x - gp.x, d.position.z - gp.z) < 1).length;
check(marks > 0 && !state.generators.garaje, 'las balas le pegan (dejan marca) pero no lo prenden', `(${marks} marcas)`);
swing();
check(state.generators.garaje, 'un golpe de cuchillo lo prende');
check(Object.keys(state.generators).filter(k => state.generators[k]).join() === 'garaje', 'prende solo ese');
check(RELICS.gens.garaje.lamp.material.color.getHex() === CONFIG.GENERATORS.lampOn, 'la luz pasa de roja a verde');
swing();
check(state.generators.garaje, 'no se apaga con otro golpe');
check(state.power === false, 'no toca state.power');
const mp = CONFIG.GENERATORS.spots.muelle, mf = frontOf(mp, GS, 1.1);
aimAt(mf.x, mf.z, mp.x, 0.7, mp.z + 3);                        // mirando al costado: no le pega
swing();
check(!state.generators.muelle, 'el golpe que no apunta al generador no lo prende');
aimAt(mf.x, mf.z, mp.x, 0.7, mp.z);
swing();
check(state.generators.muelle, 'generador del muelle (plataforma) también');

// 3) cajas: bala y cuchillo dentro del radio suman; fuera, no
fresh();
const bp = SC.spots.pasillo, bf = frontOf(bp, SC.size, 1.5);
check(bulletKillAt(bf.x, bf.z).join() === 'pasillo', 'kill de bala a 1.5 m suma a la caja del pasillo');
const bf2 = frontOf(bp, SC.size, SC.radius - SC.size.d / 2 - 0.2);
check(bulletKillAt(bf2.x, bf2.z).join() === 'pasillo', 'kill en el borde del radio suma', `(${Math.hypot(bf2.x - bp.x, bf2.z - bp.z).toFixed(2)} m)`);
const far = frontOf(bp, SC.size, SC.radius + 0.5);
check(bulletKillAt(far.x, far.z).length === 0, 'kill fuera del radio no suma', `(${Math.hypot(far.x - bp.x, far.z - bp.z).toFixed(2)} m)`);
check(bulletKillAt(bp.x - 1.6, bp.z).length === 0, 'kill del otro lado de la pared (garaje, a 1.6 m) no suma');
// cuchillo: zombie entre el jugador y la caja
const kz = frontOf(bp, SC.size, 1.2), kp = frontOf(bp, SC.size, 2.5);
const zk = zombieAt(kz.x, kz.z);
aimAt(kp.x, kp.z, kz.x, 1.6, kz.z);
const s0 = state.souls.pasillo;
swing();
check(!zk.alive && state.souls.pasillo === s0 + 1, 'kill de cuchillo dentro del radio suma', `(${state.souls.pasillo})`);
free(zk);
// cuchillo fuera del radio
const kz2 = frontOf(bp, SC.size, SC.radius + 1), kp2 = frontOf(bp, SC.size, SC.radius + 2.3);
const zk2 = zombieAt(kz2.x, kz2.z);
aimAt(kp2.x, kp2.z, kz2.x, 1.6, kz2.z);
swing();
check(!zk2.alive && state.souls.pasillo === s0 + 1, 'kill de cuchillo fuera del radio no suma');
free(zk2);
// piscina: un zombie que muere dentro de la pileta (el borde invisible no tapa) cuenta
const pp = SC.spots.piscina;
check(bulletKillAt(pp.x + 3.7, pp.z).join() === 'piscina', 'kill dentro de la pileta, a 3.7 m, suma a la caja de la piscina');

// 4) independientes y con tope
fresh();
const sp7 = SC.spots.sotano, sf = frontOf(sp7, SC.size, 1.5);
for (let i = 0; i < need + 3; i++) bulletKillAt(sf.x, sf.z);
check(state.souls.sotano === need, 'la caja del sótano se llena y no pasa de ' + need, `(${state.souls.sotano})`);
check(state.souls.pasillo === 0 && state.souls.piscina === 0, 'llenar una no toca las otras');
bulletKillAt(bf.x, bf.z);
check(state.souls.pasillo === 1 && state.souls.sotano === need, 'otra caja progresa sola');
check(!RELICS.papOn, 'una caja llena no prende el Pack-a-Punch');

// 5) Pack-a-Punch: bloqueado si falta cualquier cosa
function setAll(gens, souls) {
  G.resetRelics();
  Object.keys(state.generators).forEach(k => { state.generators[k] = gens.includes(k); });
  Object.keys(state.souls).forEach(k => { state.souls[k] = souls[k] !== undefined ? souls[k] : need; });
}
const GK = Object.keys(state.generators), SK = Object.keys(state.souls);
let blocked = true;
for (const g of GK) { setAll(GK.filter(k => k !== g), {}); if (G.papReady() || G.checkPap()) blocked = false; }
check(blocked, 'falta 1 generador (cualquiera), con las 3 cajas llenas: bloqueado');
blocked = true;
for (const s of SK) { setAll(GK, { [s]: need - 1 }); if (G.papReady() || G.checkPap()) blocked = false; }
check(blocked, 'falta 1 alma en 1 caja (cualquiera), con los 4 generadores: bloqueado');
setAll([], {});
check(!G.papReady(), 'cajas llenas sin generadores: bloqueado');
// todo por el camino real: 3 generadores + cajas, el 4to golpe lo prende
fresh();
const pp0 = G.RELICS.pap;
Object.keys(state.souls).forEach(k => { state.souls[k] = need; });
['muelle', 'caseta', 'piscina'].forEach(k => { state.generators[k] = true; });
check(!RELICS.papOn && pp0.glow.visible === false, 'con 3 generadores sigue apagado');
aimAt(gf.x, gf.z, gp.x, 0.7, gp.z);
swing();
check(RELICS.papOn && pp0.glow.visible, 'el 4to generador prende el Pack-a-Punch');
G.updateRelics(1 / 60);
check(Object.values(RELICS.boxes).every(b => b.glow.visible), 'las 3 cajas brillan');
// y al revés: el último alma lo prende
fresh();
GK.forEach(k => { state.generators[k] = true; });
state.souls.sotano = need; state.souls.piscina = need; state.souls.pasillo = need - 1;
check(!RELICS.papOn, '4 generadores y 1 alma faltante: apagado');
bulletKillAt(bf.x, bf.z);
check(RELICS.papOn, 'la última alma prende el Pack-a-Punch');

// 6) carteles
fresh();
const pap = CONFIG.PAP.spot, pf = frontOf(pap, CONFIG.PAP.size, 0.8);
player.pos.set(pf.x, (pap.y || 0) + 1.7, pf.z); G.updateInteract();   // F5.13: arriba del templo
const t0 = G.interactState.kind === 'pap' && G.promptFor(G.interactState).text;
check(t0 === 'Pack-a-Punch off - 4 generators and 3 soul boxes missing', 'cartel del PaP con lo que falta', `("${t0}")`);
const pts = state.points;
check(G.interact() === false && state.points === pts, 'F sobre el PaP no hace nada ni cobra');
GK.forEach(k => { state.generators[k] = true; }); SK.forEach(k => { state.souls[k] = need; }); G.checkPap();
G.updateInteract();
check(G.promptFor(G.interactState).text === '[F] Pack-a-Punch M1911 - ' + CONFIG.PAP.cost, 'prendido: cartel de compra (F2b; la mejora se prueba en pap.js)');
fresh();
player.pos.set(gf.x, 1.7, gf.z); G.updateInteract();
check(G.interactState.kind === 'gen' && /knife/.test(G.promptFor(G.interactState).text), 'cartel del generador apagado');
state.generators.garaje = true; G.updateInteract();
check(G.interactState.kind !== 'gen', 'prendido ya no muestra cartel');

// 7) barra de sangre: cerca y a la vista sí, lejos o detrás de la pared no
fresh();
state.souls.pasillo = 6;
player.pos.set(bf.x, 1.7, bf.z); G.updateRelics(1 / 60);
const B = RELICS.boxes.pasillo;
check(B.bar.visible && Math.abs(B.fill.scale.x - 6 / need) < 1e-9, 'barra visible cerca, con el progreso', `(${B.fill.scale.x.toFixed(2)})`);
player.pos.set(bp.x - 1.6, 1.7, bp.z); G.updateRelics(1 / 60);
check(!B.bar.visible, 'detrás de la pared no se ve');
player.pos.set(bp.x + 9, 1.7, bp.z - 3); G.updateRelics(1 / 60);
check(!B.bar.visible, 'lejos no se ve');

// 8) resetGame() apaga todo
GK.forEach(k => { state.generators[k] = true; }); SK.forEach(k => { state.souls[k] = need; }); G.checkPap();
G.resetGame();
check(GK.every(k => !state.generators[k]) && SK.every(k => state.souls[k] === 0), 'resetGame: generadores apagados y cajas vacías');
check(!RELICS.papOn && !RELICS.pap.glow.visible && Object.values(RELICS.boxes).every(b => !b.glow.visible), 'resetGame: PaP apagado, cajas sin brillo');
check(Object.values(RELICS.gens).every(g => g.lamp.material.color.getHex() === CONFIG.GENERATORS.lampOff), 'resetGame: luces rojas');
check(RELICS.fx.every(m => !m.visible) && RELICS.smoke.every(m => !m.visible), 'resetGame: sin partículas');

// 9) no crea objetos en runtime
fresh();
const nObj = (() => { let n = 0; G.scene.traverse(() => n++); return n; })();
GK.forEach(k => { state.generators[k] = true; });
for (let i = 0; i < 40; i++) bulletKillAt(sf.x, sf.z);
for (let i = 0; i < 300; i++) { G.tick(1 / 60); G.updateRelics(1 / 60); }
killAllAlive();
const nObj2 = (() => { let n = 0; G.scene.traverse(() => n++); return n; })();
check(nObj2 === nObj, 'almas, chispas y humo salen de pools (la escena no crece)', `(${nObj} -> ${nObj2})`);

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
