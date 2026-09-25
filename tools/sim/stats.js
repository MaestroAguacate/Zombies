// P8: estadísticas de la pantalla final, sensibilidad del mouse y menú de inicio/pausa.
const G = require('./harness.js');
const { state, player, CONFIG, weaponsState, STATS, feel } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };

G.resetGame(); state.running = true; G.debugOpenAllDoors(); G.updateFlowField(true);
function freshZombie(round, x, z) {
  state.round = round;
  const q = G.spawnZombie(); q.state = 'walk'; q.px = x; q.pz = z; G.placeRoot(q, 0);
  G.scene.updateMatrixWorld(true);
  return q;
}

// 1) kills por arma, headshots, cuchillo
player.pos.set(0, 1.7, 10); G.setCam(0);
weaponsState.lastShot = -1e12;
let z = freshZombie(1, 0, 7);
G.fireWeapon(); weaponsState.lastShot = -1e12; G.fireWeapon(); weaponsState.lastShot = -1e12; G.fireWeapon();
weaponsState.lastShot = -1e12; G.fireWeapon();
check(!z.alive && STATS.killsBy.m1911 === 1, 'kill con M1911 contado');
check(STATS.headshots === 1, 'headshot contado (apunta a la cabeza)', `(${STATS.headshots})`);
z = freshZombie(1, 0, 8.6);
G.meleeState.lastAttack = -1e12; G.meleeAttack(); weaponsState.phase = 'idle';
check(!z.alive && STATS.killsBy.knife === 1, 'kill con cuchillo contado');
z = freshZombie(1, 0, 8.6);
G.meleeState.lastAttack = -1e12; G.meleeAttack(); weaponsState.phase = 'idle';
check(G.favoriteWeapon() === 'KNIFE (2)', 'arma favorita', `("${G.favoriteWeapon()}")`);

// 2) puntos ganados (con doble puntos cuenta lo acreditado), gastos no restan
const p0 = STATS.pointsEarned;
G.addPoints(10); state.effects.doublePoints = 30; G.addPoints(10); state.effects.doublePoints = 0;
check(STATS.pointsEarned - p0 === 30, 'puntos ganados incluyen doble puntos');
G.resetGame(); state.running = true; state.points = 5000;
check(G.buyDoor('D1') && STATS.doors === 1 && STATS.pointsEarned === 0, 'puerta contada; gastar no toca puntos ganados');

// 3) daño recibido: no cuenta más que la vida que quedaba
state.health = 100; state.lastDamageTime = -99; G.tick(1);
G.damagePlayer(25);
state.health = 10; G.tick(1); G.damagePlayer(25);
check(STATS.damageTaken === 35, 'daño recibido (25 + los 10 que quedaban)', `(${STATS.damageTaken})`);

// 4) mystery box
G.resetGame(); state.running = true; state.points = 5000; G.debugOpenAllDoors();
player.pos.set(10, 1.7, 28.2); G.updateInteract(); G.interact();
check(STATS.boxUses === 1, 'uso de mystery box contado');

// 5) reset
STATS.time = 99;
G.resetGame();
check(STATS.time === 0 && STATS.boxUses === 0 && Object.keys(STATS.killsBy).length === 0 && STATS.headshots === 0,
  'resetGame limpia estadísticas');
check(G.fmtTime(125.7) === '2:05' && G.fmtTime(0) === '0:00', 'formato de tiempo');

// 6) sensibilidad: multiplica el giro, se limita al rango
state.running = true;
G.setSensitivity(1); player.yaw = 0; G.lookInput(100, 0); const y1 = -player.yaw;
G.setSensitivity(2); player.yaw = 0; G.lookInput(100, 0); const y2 = -player.yaw;
check(Math.abs(y2 / y1 - 2) < 1e-9 && Math.abs(y1 - 100 * CONFIG.INPUT.mouseSens) < 1e-12, 'sensibilidad 2x = el doble de giro');
G.setSensitivity(50); check(G.SETTINGS.sens === CONFIG.INPUT.sensMax, 'tope máximo');
G.setSensitivity(0); check(G.SETTINGS.sens === CONFIG.INPUT.sensMin, 'tope mínimo');
G.setSensitivity(1); player.pitch = 0; G.lookInput(0, -1e6);
check(player.pitch < Math.PI / 2 && player.pitch > 1.5, 'pitch limitado');
G.setSensitivity(1);

// 7) menú: inicio vs pausa
G.showMenu('main');
check(G.UI.btnPlay.textContent === 'PLAY' && G.UI.start.attrs['data-mode'] === 'main', 'menú de inicio');
G.showMenu('pause');
check(G.UI.btnPlay.textContent === 'RESUME' && G.UI.start.attrs['data-mode'] === 'pause', 'menú de pausa');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
