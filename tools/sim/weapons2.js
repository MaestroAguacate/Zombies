// V2 F3b: armas nuevas (revólver, doble cañón, ballesta, machete) y ADS con clic derecho.
const G = require('./harness.js');
const { state, player, CONFIG, keys, weaponsState, ADS } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const W = CONFIG.WEAPONS, A = CONFIG.ADS, dt = 1 / 60;

function fresh() {
  G.resetGame(); state.running = true; G.debugOpenAllDoors();
  state.points = 99999; state.round = 1; state.health = 100; state.lastDamageTime = -99;
  weaponsState.phase = 'idle';
}
function clearZombies() {
  for (const q of state.zombies.slice()) { q.active = false; q.alive = false; q.root.visible = false; }
  state.zombies.length = 0;
}
function zombieAt(x, z, hp) {
  const q = G.spawnZombie(); q.state = 'walk'; q.px = x; q.pz = z; q.health = hp || 1e6;
  G.placeRoot(q, 0); return q;
}
const wbOf = id => G.WALLBUYS.find(w => w.weapon === id);
function atWall(wb, floor) {                               // 1.2 m frente a la tiza, en su cuarto (y su nivel)
  const n = wb.axis === 'z' ? [0, wb.face] : [wb.face, 0];
  player.pos.set(wb.mx + n[0] * 1.2, (wb.level && !floor ? G.UP.y : 0) + 1.7, wb.mz + n[1] * 1.2); G.updateInteract();
}

// 1) números del ROADMAP
check(W.revolver.damage === 110 && W.revolver.magSize === 6, 'revólver: 110, 6 balas');
check(W.doublebarrel.damage === 45 && W.doublebarrel.pellets === 10 && W.doublebarrel.magSize === 2, 'doble cañón: 45 × 10, 2 balas');
check(W.crossbow.damage === 400 && W.crossbow.pierce === 3 && CONFIG.BOX.pool.includes('crossbow') && wbOf('crossbow') && wbOf('crossbow').room === 'R24', 'ballesta: 400, atraviesa 3, en la caja y (F5.28e) en la cueva');
check(CONFIG.MACHETE.damage === 500 && CONFIG.MACHETE.cost === 3000, 'machete: 500, 3000');
check(['revolver', 'doublebarrel', 'crossbow'].every(id => /^[A-Z ]+$/.test(W[id].papName)), 'papName en inglés', ['revolver', 'doublebarrel', 'crossbow'].map(id => W[id].papName).join(' · '));

// 2) paredes nuevas: cartel, precio, en su cuarto
for (const [id, cost, room] of [['revolver', 900, 'la torre de la playa oeste (F5.15)'], ['doublebarrel', 1500, 'el rancho (F5.16)']]) {
  fresh(); const wb = wbOf(id); atWall(wb);
  const txt = G.interactState.kind === 'wall' ? G.promptFor(G.interactState).text : '(sin cartel)';
  check(txt === '[F] Buy ' + W[id].name + ' - ' + cost, `${id}: cartel en ${room}`, `("${txt}")`);
  const pts = state.points;
  check(G.interact() && state.points === pts - cost && G.curDef().id === id, `${id}: cobra ${cost} y la da`);
}
{ const db = CONFIG.WALLBUYS.find(w => w.weapon === 'doublebarrel');   // F5.19: el rancho se corrió al oeste
  check(!db.level && G.roomAt(db.x, db.z - 0.8).id === 'R14', 'F5.16: doble cañón en el piso, en el cerco del rancho'); }

// 3) machete: reemplaza al cuchillo, una vez, 500 parejo; resetGame vuelve al cuchillo
fresh(); const wm = wbOf('machete'); atWall(wm);
check(G.promptFor(G.interactState).text === '[F] Buy MACHETE - 3000', 'machete: cartel en la cocina');
let pts = state.points;
check(G.interact() && state.machete && state.points === pts - 3000 && state.weapons.length === 1, 'lo compra (no ocupa slot de arma)');
pts = state.points; G.updateInteract();
check(G.promptFor(G.interactState).text === 'MACHETE - already owned' && !G.interact() && state.points === pts, 'no se compra dos veces');
function swingAt(head) {
  clearZombies();
  player.pos.set(0, 1.7, 10); G.setCam(0);
  const q = zombieAt(0, 8.6, 1000); G.scene.updateMatrixWorld(true);
  if (!head) { player.pitch = -0.35; G.camera.rotation.set(player.pitch, 0, 0, 'YXZ'); G.updateCameraFeel(0); }
  G.meleeState.lastAttack = -1e9; weaponsState.phase = 'idle';
  G.meleeAttack(); weaponsState.phase = 'idle';
  return 1000 - q.health;
}
check(swingAt(true) === 500 && swingAt(false) === 500, 'machete: 500 a la cabeza y al cuerpo');
check(G.meleeDef().cooldown === CONFIG.KNIFE.cooldown && G.meleeDef().range === CONFIG.KNIFE.range, 'mismo cooldown y alcance que el cuchillo');
clearZombies(); G.resetGame(); state.running = true;
check(!state.machete && G.meleeDef() === CONFIG.KNIFE, 'resetGame: vuelve el cuchillo');
clearZombies();

// 4) ballesta: atraviesa 3 zombies, no el 4to, y frena en la pared
fresh(); G.giveWeapon('crossbow');
player.pos.set(0, 1.7, 16); G.setCam(0);
const line = [13, 12, 11, 10].map(z => zombieAt(0, z));
G.scene.updateMatrixWorld(true);
weaponsState.lastShot = -1e9; G.fireWeapon();
const hit = line.map(q => 1e6 - q.health);
check(hit.slice(0, 3).every(d => d >= 400) && hit[3] === 0, 'atraviesa 3, el 4to no', `(${hit.map(Math.round).join(' / ')})`);
clearZombies();
player.pos.set(6.5, 1.7, 6); G.setCam(-Math.PI / 2);                      // mirando a +x: pared x=8 (z 4..8)
const behind = zombieAt(9.5, 6); G.scene.updateMatrixWorld(true);
G.curSlot().mag = 1; weaponsState.phase = 'idle'; weaponsState.lastShot = -1e9; G.fireWeapon();
check(behind.health === 1e6, 'no atraviesa la pared');
clearZombies();

// 5) doble cañón: 2 disparos y recarga "quebrada" con los mismos tiempos y munición
fresh(); G.giveWeapon('doublebarrel');
const s = G.curSlot(); s.mag = 0; s.reserve = 10; G.reloadWeapon();
let t = 0; while (weaponsState.phase === 'reloading' && t < 5) { G.tick(dt); G.updateWeapon(dt); t += dt; }
check(Math.abs(t - W.doublebarrel.reloadTime / 1000) < 0.05 && s.mag === 2 && s.reserve === 8, 'recarga: 2 s, llena 2 cartuchos', `(${t.toFixed(2)} s)`);

// 6) ADS
fresh();
check(Math.abs(G.camera.fov - A.baseFov) < 1e-9 && ADS.k === 0, 'sin apuntar: FOV 75');
ADS.on = true;
for (let i = 0; i < Math.round(A.time * 60) + 1; i++) G.updateWeapon(dt);
check(ADS.k === 1 && Math.abs(G.camera.fov - A.fov) < 1e-9, 'apuntando: FOV 55 en 0.15 s');
check(Math.abs(G.adsSpread() - A.spreadMul) < 1e-9, 'dispersión ×0.4');
G.giveWeapon('sniper'); for (let i = 0; i < 20; i++) G.updateWeapon(dt);
check(Math.abs(G.camera.fov - W.sniper.adsFov) < 1e-9, 'francotirador: FOV 30');
// sensibilidad proporcional al FOV
player.yaw = 0; G.lookInput(100, 0); const yawAds = -player.yaw;
ADS.on = false; for (let i = 0; i < 20; i++) G.updateWeapon(dt);
player.yaw = 0; G.lookInput(100, 0); const yawHip = -player.yaw;
check(Math.abs(yawAds / yawHip - W.sniper.adsFov / A.baseFov) < 1e-6, 'sensibilidad ×FOV/75 al apuntar', `(${(yawAds / yawHip).toFixed(2)})`);
check(ADS.k === 0 && Math.abs(G.camera.fov - A.baseFov) < 1e-9, 'soltar: vuelve a 75');
// velocidad y sprint
function speedFor(adsOn, sprint) {
  fresh(); ADS.on = adsOn; ADS.k = adsOn ? 1 : 0;
  player.pos.set(-15, 1.7, -14); player.vel.set(0, 0, 0); player.yaw = -Math.PI / 2; player.grounded = true;
  keys.KeyW = true; keys.ShiftLeft = !!sprint;
  let v = 0;
  for (let i = 0; i < 90; i++) { G.tick(dt); G.updatePlayer(dt); G.updateWeapon(dt); v = Math.max(v, player.speedNow); }
  keys.KeyW = false; keys.ShiftLeft = false; ADS.on = false;
  return v;
}
check(Math.abs(speedFor(true) - CONFIG.PLAYER.speed * A.moveMul) < 0.02, 'apuntando camina ×0.7 (3.08)', `(${speedFor(true).toFixed(2)})`);
check(Math.abs(speedFor(true, true) - CONFIG.PLAYER.speed * A.moveMul) < 0.02, 'apuntando no corre');
// no apunta recargando ni sin arma
fresh(); G.curSlot().mag = 0; G.reloadWeapon(); ADS.on = true;
for (let i = 0; i < 20; i++) G.updateWeapon(dt);
check(ADS.k === 0, 'recargando no apunta');
G.resetGame();
check(!ADS.on && ADS.k === 0 && Math.abs(G.camera.fov - A.baseFov) < 1e-9, 'resetGame: sin apuntar');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
