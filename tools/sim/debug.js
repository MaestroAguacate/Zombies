// Modo debug: P puntos, N noclip, [ ] rondas, O/B/H, cartel. Con CONFIG.DEBUG_MODE = false no hace nada.
const G = require('./harness.js');
const { state, player, CONFIG, keys, DEBUG } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, P = CONFIG.PLAYER;
const key = code => G.debugKey(code, false);

function fresh() { G.resetGame(); state.running = true; state.round = 3; }
check(CONFIG.DEBUG_MODE === true, 'en desarrollo DEBUG_MODE está prendido');

// 1) cartel y overlay
fresh();
check(G.UI.debugMode.style.display === '' && G.UI.debugMode.textContent === 'DEBUG MODE', 'cartel "DEBUG MODE" visible');
check(G.UI.debug.style.display === '', 'overlay de debug visible');

// 2) P: +5000
let pts = state.points;
key('KeyP');
check(state.points === pts + CONFIG.DEBUG.points, 'P suma 5000', `(${pts} -> ${state.points})`);
check(!G.debugKey('KeyP', true) && state.points === pts + CONFIG.DEBUG.points, 'mantener P no repite');

// 3) ] y [
fresh(); G.startRound(3);
for (let i = 0; i < 3; i++) { const q = G.spawnZombie(); if (q) q.state = 'walk'; }
key('BracketRight');
check(state.round === 4 && state.zombies.length === 0 && G.roundState.phase === 'active', '] salta a la ronda 4 y limpia los zombies');
key('BracketLeft'); key('BracketLeft');
check(state.round === 2, '[ dos veces: ronda 2');
key('BracketLeft'); key('BracketLeft');
check(state.round === 1, '[ no baja de la ronda 1');

// 4) N: noclip, atraviesa paredes, sin gravedad; al apagarlo cae sin daño
fresh();
player.pos.set(0, P.height, 10); player.pitch = 0; player.yaw = Math.PI / 2;   // mirando a -x: la pared oeste de la sala (x -8)
key('KeyN');
check(DEBUG.noclip && /NOCLIP/.test(G.UI.debugMode.textContent), 'N prende el noclip (y lo dice el cartel)');
keys.KeyW = true;
for (let i = 0; i < 90; i++) { G.tick(dt); G.updatePlayer(dt); }
keys.KeyW = false;
check(player.pos.x < -9 && Math.abs(player.pos.y - P.height) < 1e-6, 'vuela a través de la pared, sin caer', `(x ${player.pos.x.toFixed(1)})`);
keys.Space = true;
for (let i = 0; i < 60; i++) { G.tick(dt); G.updatePlayer(dt); }
keys.Space = false;
check(player.pos.y > P.height + 5, 'Espacio sube', `(y ${player.pos.y.toFixed(1)})`);
player.pos.set(0, 12, 0);                                          // sobre el porche (sin techo)
key('KeyN');
for (let i = 0; i < 120; i++) { G.tick(dt); G.updatePlayer(dt); }
check(!DEBUG.noclip && Math.abs(player.pos.y - P.height) < 1e-6 && state.health === 100, 'N otra vez: cae al piso sin daño por caída', `(vida ${state.health})`);

// 5) con DEBUG_MODE = false no hay nada
CONFIG.DEBUG_MODE = false;
fresh();
pts = state.points;
key('KeyP'); key('KeyN'); key('BracketRight'); key('KeyO');
check(state.points === pts && !DEBUG.noclip && state.round === 3 && Object.values(state.doors).every(d => !d.open), 'apagado: P, N, ], O no hacen nada');
check(G.UI.debugMode.style.display === 'none' && G.UI.debug.style.display === 'none', 'apagado: sin cartel ni overlay');
CONFIG.DEBUG_MODE = true;
G.resetGame();
check(!DEBUG.noclip && G.UI.debugMode.style.display === '', 'resetGame: sin noclip, cartel de nuevo');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
