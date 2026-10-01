// P6: mystery box (spots, cobro, animación 4s, ventana 8s, pool sin repetidas, teddy + mudanza a cuarto abierto)
// y armas exclusivas (Ray Gun área, Francotirador x3, Lanzallamas 40/s sin puntos de impacto).
const G = require('./harness.js');
const { state, player, CONFIG, BOX, weaponsState, NAV, STATS } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const B = CONFIG.BOX, dt = 1 / 60;
const run = secs => { for (let i = 0; i < Math.round(secs / dt); i++) { G.tick(dt); G.updateBox(dt); } };
const at = (x, z) => { player.pos.set(x, 1.7, z); G.updateInteract(); return G.interactState; };
const withRandom = (v, fn) => { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } };

G.resetGame(); state.running = true; G.setCam(0);

// 1) spots: dentro de su cuarto, no tocan el grid, lejos de spawns y wall buys, alcanzables
check(BOX.room === B.startRoom && BOX.phase === 'idle', 'arranca en R5 quieta');
G.debugOpenAllDoors();
BOX.collider.solid = false; G.buildNavGrid();
const base = Uint8Array.from(NAV.cells);
BOX.collider.solid = true;
for (const r in B.spots) {
  const s = B.spots[r];
  G.placeBox(r);
  const same = NAV.cells.every((v, i) => v === base[i]);
  check(G.roomAt(s.x, s.z) && G.roomAt(s.x, s.z).id === r && same, `${r}: dentro del cuarto y no cambia el grid`);
  const near = G.SPAWN_POINTS.filter(p => Math.hypot(p.x - s.x, p.z - s.z) < 1.5).length
             + G.WALLBUYS.filter(w => Math.hypot(w.mx - s.x, w.mz - s.z) < 2).length;
  check(near === 0, `${r}: lejos de spawns y wall buys`);
  const c = BOX.collider; let best = 99;
  for (let x = Math.floor(s.x) - 4; x <= Math.floor(s.x) + 4; x++)
    for (let z = Math.floor(s.z) - 4; z <= Math.floor(s.z) + 4; z++)
      if (G.isNav(x, z)) best = Math.min(best, Math.hypot(Math.max(c.minX - x - .5, 0, x + .5 - c.maxX), Math.max(c.minZ - z - .5, 0, z + .5 - c.maxZ)));
  check(best < CONFIG.ECONOMY.interactRange - 0.5, `${r}: alcanzable`, `(${best.toFixed(2)}m)`);
}
G.placeBox('R5');

// 2) cobro y prompt
let it = at(10, 28.2);
check(it.kind === 'box' && G.promptFor(it).text === '[F] Mystery Box - 950', 'prompt de la caja', `("${it.kind && G.promptFor(it).text}")`);
check(at(10, 31).kind !== 'box', 'desde afuera del cuarto no hay prompt');
at(10, 28.2);
state.points = 900;
check(G.interact() === false && BOX.phase === 'idle' && state.points === 900, 'sin puntos no gira');
state.points = 1000;
withRandom(0.5, () => G.interact());
check(BOX.phase === 'rolling' && state.points === 50, 'cobra 950 y gira');
G.updateInteract();
check(G.interactState.kind !== 'box', 'girando no se puede usar');

// 3) animación 4s -> ventana 8s
const res = BOX.result;
check(res !== 'teddy' && B.pool.includes(res), 'resultado es un arma del pool', `(${res})`);
run(B.rollTime - 0.1);
check(BOX.phase === 'rolling', 'sigue girando a los 3.9s');
check(BOX.shown && B.pool.includes(BOX.shown), 'muestra armas rotando');
run(0.2);
check(BOX.phase === 'ready' && BOX.shown === res, 'a los 4s se detiene en el resultado');
check(BOX.light.intensity > 0 && BOX.lidA > 0.5, 'luz dorada prendida y tapa abierta');
G.updateInteract();
check(G.promptFor(G.interactState).text === '[F] Take ' + CONFIG.WEAPONS[res].name, 'prompt de agarrar');
run(B.grabTime - 0.2);
check(BOX.phase === 'ready', 'sigue disponible a los 7.8s');
G.updateInteract();
check(G.interact() === true && state.weapons.some(w => w.id === res) && BOX.phase === 'idle', 'F la agarra (gratis)');
check(state.points === 50, 'agarrar no cobra');

// 4) si no la agarrás en 8s, se pierde
state.points = 950; at(10, 28.2);
withRandom(0.5, () => G.interact());
const lost = BOX.result;
run(B.rollTime + B.grabTime + 0.1);
check(BOX.phase === 'idle' && BOX.shown === null, 'a los 8s se pierde');
check(!state.weapons.some(w => w.id === lost) || lost === res, 'no se entregó');
run(1);
check(BOX.light.intensity === 0 && BOX.lidA < 0.05, 'luz apagada y tapa cerrada');

// 5) pool: nunca ofrece un arma que ya tenés; teddy ≈15%
state.weapons = [{ id: 'm1911', mag: 8, reserve: 80 }, { id: 'smg', mag: 32, reserve: 160 }];
state.currentWeapon = 0;
let teddy = 0, smgOffered = 0; const seen = new Set(); const N = 20000;
for (let i = 0; i < N; i++) { const r = G.rollBoxResult(); if (r === 'teddy') teddy++; else { seen.add(r); if (r === 'smg') smgOffered++; } }
check(smgOffered === 0, 'no ofrece el SMG que ya tenés');
check(seen.size === B.pool.length - 1, `ofrece las otras ${B.pool.length - 1}`, `(${[...seen]})`);
check(Math.abs(teddy / N - B.teddyChance) < 0.01, 'teddy ≈ 15%', `(${(teddy / N * 100).toFixed(2)}%)`);

// 6) teddy: cobra, no da arma, se muda a otro cuarto abierto
const wBefore = state.weapons.map(w => w.id).join();
state.points = 950; at(10, 28.2);
withRandom(0.01, () => G.interact());
check(BOX.result === 'teddy' && state.points === 0, 'teddy cobra al tirar');
const earned0 = STATS.pointsEarned;
run(B.rollTime + 0.05);
check(BOX.phase === 'teddy' && BOX.shown === 'teddy', 'muestra el oso');
check(state.points === 950 && STATS.pointsEarned === earned0, 'F5.16: el oso devuelve los 950 (sin contar como ganancia)', `(${state.points})`);
run(B.teddyTime + B.moveTime + 0.1);
check(BOX.phase === 'idle' && BOX.room !== 'R5', 'se mudó', `(a ${BOX.room})`);
check(!!B.spots[BOX.room], 'a otro lugar de la caja (F5.28e: cualquiera, abierto o no)');
check(state.weapons.map(w => w.id).join() === wBefore, 'no dio arma');
const sp = B.spots[BOX.room];
check(Math.abs((BOX.collider.minX + BOX.collider.maxX) / 2 - sp.x) < 1e-9 && BOX.group.position.y === 0, 'collider y mesh en el spot nuevo');
check(at(10, 28.2).kind !== 'box', 'el spot viejo ya no responde');

// 7) F5.28e (Diego): la caja se muda a CUALQUIER lugar (abierto o no), menos al que está y al que tenés encima
// F5.20: se arranca en el garaje; esta prueba mira la topología desde el porche
const start0 = CONFIG.START.room; CONFIG.START.room = 'R1';
G.resetGame(); state.running = true; G.setCam(0);
check(G.openRooms().join() === 'R1', 'puertas cerradas: solo R1 abierto');
G.placeBox('R2'); player.pos.set(5, 1.7, 14);
const dests = G.boxDestinations();
check(dests.length === Object.keys(B.spots).length - 1 && !dests.includes('R2') && dests.includes('R11'),
  'con todo cerrado, los destinos son todos los otros lugares (hasta el muelle)', `(${dests.length})`);
player.pos.set(B.spots.R11.x, 1.7, B.spots.R11.z);
check(!G.boxDestinations().includes('R11'), 'no se muda al lugar donde estás parado');
state.points = 5000; at(6.6, 14); withRandom(0.01, () => G.interact());
run(B.rollTime + B.teddyTime + B.moveTime + 0.2);
check(BOX.room !== 'R2' && !!B.spots[BOX.room], 'se mudó (' + BOX.room + ')');
CONFIG.START.room = start0;

// ---------- armas exclusivas ----------
function freshZombie(round, x, z) {
  state.round = round;
  const q = G.spawnZombie(); q.state = 'walk'; q.px = x; q.pz = z; G.placeRoot(q, 0);
  return q;
}
function killAll() { for (const q of state.zombies.slice()) if (q.alive) G.damageZombie(q, 1e9, false); }
function equip(id) {
  state.weapons = []; state.currentWeapon = 0; G.giveWeapon(id);
  weaponsState.phase = 'idle'; weaponsState.lastShot = -1e12;
}
G.resetGame(); state.running = true; G.debugOpenAllDoors(); G.updateFlowField(true);

// 8) Ray Gun: 500 directo + área con caída, no atraviesa paredes
player.pos.set(0, 1.7, 10); G.setCam(0); G.updateFlowField(true);
equip('raygun');
let A = freshZombie(5, 0, 7), D = freshZombie(5, 1.3, 6.9);
G.scene.updateMatrixWorld(true);
G.fireWeapon();
check(A.health === CONFIG.ZOMBIE.health(5) - 500, 'impacto directo 500', `(hp ${A.health})`);
const dD = CONFIG.ZOMBIE.health(5) - D.health;
check(dD > 250 && dD < 500, 'vecino recibe área con caída', `(${dD.toFixed(0)})`);
killAll();
player.pos.set(4, 1.7, 7); G.setCam(0);
weaponsState.lastShot = -1e12;
const Bz = freshZombie(5, 5.2, 5.2), Cz = freshZombie(5, 4.5, 3.2);
G.scene.updateMatrixWorld(true);
G.fireWeapon();
check(Bz.health < CONFIG.ZOMBIE.health(5), 'disparo a la pared: área pega al del mismo lado');
check(Cz.health === CONFIG.ZOMBIE.health(5), 'no atraviesa la pared', `(hp ${Cz.health})`);
G.updateWeaponFx(dt);
killAll();

// 9) Francotirador: 300 cuerpo, 900 cabeza
player.pos.set(0, 1.7, 10); G.setCam(0);
equip('sniper');
A = freshZombie(8, 0, 6); G.scene.updateMatrixWorld(true);
G.fireWeapon();
check(!A.alive, 'headshot 900 mata ronda 8 (850 hp)');
weaponsState.lastShot = -1e12;
player.pos.set(0, 1.1, 10); G.setCam(0);          // a la altura del torso
A = freshZombie(8, 0, 6); G.scene.updateMatrixWorld(true);
G.fireWeapon();
check(A.health === CONFIG.ZOMBIE.health(8) - 300, 'cuerpo 300', `(hp ${A.health})`);
killAll();

// 10) F5.28 (Diego): sin lanzallamas: ni en la caja ni como arma
check(!CONFIG.WEAPONS.flamethrower && CONFIG.BOX.pool.indexOf('flamethrower') < 0, 'F5.28: el lanzallamas no existe ni sale de la caja');

// 11) cadencia real de una automática a 60fps: no se redondea al frame
equip('smg'); const sm = state.weapons[0]; sm.mag = 999;
G.fireWeapon(); const m0 = sm.mag;
for (let i = 0; i < 600; i++) { G.tick(dt); G.fireWeapon(); }
const rate = (m0 - sm.mag) / 10, want = 1000 / CONFIG.WEAPONS.smg.fireRate;
check(Math.abs(rate - want) < 0.3, 'SMG a 60fps dispara a su cadencia real', `(${rate.toFixed(2)}/s vs ${want.toFixed(2)})`);

// 12) reset
G.resetGame();
check(BOX.room === 'R5' && BOX.phase === 'idle' && BOX.shown === null && BOX.light.intensity === 0, 'reset: caja vuelve a R5 quieta');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
