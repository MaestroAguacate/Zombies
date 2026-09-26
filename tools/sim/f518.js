// V2 F5.18: agacharse, Quick Revive "last stand" (tirado 10 s con la Ray Gun y los zombies se alejan).
const G = require('./harness.js');
const { state, player, CONFIG, roundState } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60;
function fresh() { G.resetGame(); state.running = true; roundState.phase = 'active'; player.pos.set(0, 1.7, 8); G.debugOpenAllDoors(); }
function clearAll() { for (const q of state.zombies.slice()) { q.active = false; q.alive = false; q.root.visible = false; } state.zombies.length = 0; }
function run(s, f) { for (let i = 0; i < Math.round(s * 60); i++) { G.tick(dt); f && f(); } }

// 1) agacharse
fresh();
const CR = CONFIG.PLAYER.crouch;
G.keys.KeyW = true;
run(1, () => G.updatePlayer(dt));
const vStand = player.speedNow;
G.keys.KeyC = true;
run(1, () => G.updatePlayer(dt));
check(player.crouch && Math.abs(player.speedNow - vStand * CR.speedMul) < 0.05, 'agachado: más lento (×' + CR.speedMul + ')', `(${vStand.toFixed(2)} -> ${player.speedNow.toFixed(2)})`);
check(Math.abs(G.feel.eye.y - (player.pos.y - CR.drop)) < 0.02, 'agachado: la vista (y la bala) baja ' + CR.drop + ' m', `(${(player.pos.y - G.feel.eye.y).toFixed(2)})`);
G.keys.ShiftLeft = true; run(0.5, () => G.updatePlayer(dt));
check(!player.sprinting, 'agachado: no corre');
G.keys.Space = true; run(0.1, () => G.updatePlayer(dt)); G.keys.Space = false;
check(player.grounded, 'agachado: no salta');
G.keys.KeyC = false; G.keys.ShiftLeft = false; run(1, () => G.updatePlayer(dt)); G.keys.KeyW = false;
check(!player.crouch && Math.abs(G.feel.eye.y - player.pos.y) < 0.02, 'al soltar C se para');

// 2) last stand: los zombies se alejan y no pegan
fresh(); clearAll(); state.power = true; state.perks = ['revive'];
player.pos.set(0, 1.7, 10); run(0.1, () => G.updatePlayer(dt));
G.updateFlowField(true);
const zs = [];
for (let i = 0; i < 4; i++) { const q = G.spawnZombie(); q.state = 'walk'; q.px = -1.5 + i; q.pz = 11.2; q.level = 0; zs.push(q); }
state.health = 10; state.lastDamageTime = -99; G.damagePlayer(25, 0, 11);
check(G.DOWN.on && !state.gameOver, 'golpe letal con QR: tirado');
check(G.gfxFilter().includes('grayscale'), 'pantalla gris');
run(1, () => { G.updatePlayer(dt); G.updateDown(dt); });
check(Math.abs(player.pos.y - G.feel.eye.y - CONFIG.PERKS.lastStand.drop) < 0.15, 'la vista baja al piso', `(${(player.pos.y - G.feel.eye.y).toFixed(2)})`);
const d0 = zs.map(q => Math.hypot(q.px - player.pos.x, q.pz - player.pos.z));
let hp = state.health;
run(4, () => { G.updateFlowField(false); G.updateZombies(dt); G.updateDown(dt); });
const d1 = zs.map(q => Math.hypot(q.px - player.pos.x, q.pz - player.pos.z));
check(d1.every((d, i) => d > d0[i] + 2), 'los zombies se alejan', `(${d0.map(d => d.toFixed(1))} -> ${d1.map(d => d.toFixed(1))})`);
check(state.health === hp, 'nadie le pega');
G.keys.KeyW = true; const z0 = player.pos.z; run(1, () => G.updatePlayer(dt)); G.keys.KeyW = false;
check(Math.abs(z0 - player.pos.z) < CONFIG.PLAYER.speed * CONFIG.PERKS.lastStand.speedMul + 0.1 && Math.abs(z0 - player.pos.z) > 0.3, 'se arrastra despacio', `(${Math.abs(z0 - player.pos.z).toFixed(2)} m en 1 s)`);
run(5, () => G.updateDown(dt));
check(!G.DOWN.on && !G.gfxFilter().includes('grayscale') && state.health === G.maxHealth(), 'a los 10 s revive, sin gris y con la vida llena');
run(0.5, () => { G.updatePlayer(dt); G.updateDown(dt); });
check(player.downK < 0.1, 'se para');
G.resetGame();
check(!G.DOWN.on && G.DOWN.saved === null, 'reset');

console.log(fail ? `\n${fail} FALLAS` : '\nPASA');
process.exit(fail ? 1 : 0);
