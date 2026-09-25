// V2 F5.12: cercos que se queman (precio, arden, se abren, reset), jungla alrededor (cuartos, troncos sólidos,
// todo conectado, borde), laguna al mar sacada (playa -> jungla este con H4), búnker mudado bajo el mar,
// langostino (rebota poco, brilla, 10 s), calamar gigante más grande, ronda en romanos.
const G = require('./harness.js');
const THREE = require('three');
const { state, player, CONFIG, roundState, WORLD, BUNK, MONKEY } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, P = CONFIG.PLAYER;
CONFIG.POWERUPS.dropChance = 0;
function fresh() { G.resetGame(); state.running = true; state.round = 8; roundState.phase = 'active'; state.points = 50000; state.health = 100; }
function setPlayer(x, z) { player.pos.set(x, G.groundY(x, z) + P.height, z); G.updateFlowField(true); }
const nearNav = (x, z) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (G.flowAt(Math.floor(x) + dx, Math.floor(z) + dz) >= 0) return true; return false; };

// 1) cercos que se queman
fresh(); ['D11', 'D14'].forEach(G.openDoor); setPlayer(0, 50);            // F5.16: se prueba con H6 (jardines norte -> templo)
const H4 = state.doors.H6;
check(CONFIG.BURN.hedges.every(h => state.doors[h.id] && state.doors[h.id].burn), 'F5.16: 3 lianas que se queman (H2, H6, H8)', CONFIG.BURN.hedges.map(h => h.id).join(' '));
check(CONFIG.BURN.hedges.length === 3 && !nearNav(70, 60), 'con H6 cerrado no se llega al templo');
player.pos.set(30.5, P.height, 56.8); G.updateInteract();
check(G.interactState.kind === 'door' && G.interactState.target === H4 && G.promptFor(G.interactState).text === '[F] Quemar el cerco - 2000', 'cartel: "Quemar el cerco - 2000"');
const pts = state.points;
check(G.interact() && H4.burning && !H4.open && state.points === pts - 2000, 'cobra y empieza a arder (todavía cerrado)');
check(G.promptFor(G.interactState).text === 'El cerco se está quemando...' && !G.interact() && state.points === pts - 2000, 'mientras arde no se vuelve a cobrar');
for (let i = 0; i < 60; i++) { G.tick(dt); G.updateGarden(dt); }
const c = H4.mesh.material.color;
check(H4.flames.every(f => f.visible) && c.r < 0.8 && H4.collider.solid, 'arde: llamas, se pone negro y sigue frenando');
for (let i = 0; i < 60 * CONFIG.BURN.time; i++) { G.tick(dt); G.updateGarden(dt); }
check(H4.open && !H4.burning && !H4.collider.solid && !H4.mesh.parent && H4.flames.every(f => !f.visible), 'al terminar de quemarse se abre y desaparece');
setPlayer(0, 50);
check(nearNav(70, 60), 'ahora se pasa de los jardines al templo');
G.resetGame();
check(!H4.open && H4.collider.solid && H4.mesh.parent && H4.mesh.material.color.getHex() === 0xffffff, 'resetGame: el cerco vuelve, verde');

// 2) la jungla
fresh(); G.debugOpenAllDoors(); setPlayer(0, 50);
// F5.15: la jungla vieja es espesura; quedan áreas (R15/R17/R18/R19/R20) unidas por senderos
check(G.roomAt(0, 50).id === 'R15' && G.roomAt(-60, 60).id === 'R17' && !G.roomAt(45, 10) && G.inThicket(45, 10) && !G.roomAt(-50, 10), 'áreas de la jungla (norte, claro) y espesura entre medio (F5.16: el campamento es espesura)');
check(nearNav(-70, 70) && nearNav(57, 95) && nearNav(-70, -55) && !nearNav(50, 30), 'se llega a las 3 puntas (claro, templo, calamar); al campamento no');
const trees = G.JUNGLE.trees;
check(trees.length > 20 && trees.every(t => G.PROPS.some(p => p.id === t.id && p.collider)), 'árboles con tronco sólido', `(${trees.length})`);
check(trees.every(t => G.roomAt(t.x, t.z) && ['R15', 'R17', 'R20'].includes(G.roomAt(t.x, t.z).id)), 'todos adentro de un área de jungla (F5.15: y el templo)');
check(G.SPAWN_POINTS.filter(s => ['R15', 'R17'].includes(s.room)).every(s => s.valid && G.flowAt(s.cx, s.cz) >= 0), 'spawns de la jungla válidos y alcanzables');
// el borde de afuera frena
player.pos.set(-73, P.height, 30); player.vel.set(0, 0, 0); player.yaw = Math.PI / 2; G.keys.KeyW = true;
for (let i = 0; i < 90; i++) { G.tick(dt); G.updatePlayer(dt); }
G.keys.KeyW = false;
check(player.pos.x > -75, 'el borde de la jungla frena (F5.13: x -75)', `(x ${player.pos.x.toFixed(2)})`);

// 3) el búnker se mudó bajo el mar y sigue andando
const B = CONFIG.BUNKER;
check(B.z2 < -60 && G.roomAt(-24, -78).id === 'R16' && G.groundY(-24, -78) === B.y, 'el búnker está bajo el mar, al sur del muelle');
fresh(); G.debugOpenAllDoors(); G.openBunker(); setPlayer(-10, 50);
check(nearNav(-24, -80), 'con la escotilla abierta se llega al búnker');

// 4) langostino: rebota poco, brilla, 10 s
fresh(); setPlayer(0, 10); G.giveMonkeys();
G.feel.eye.set(0, 1.6, 10); G.feel.aimQuat.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -0.6, -1).normalize());
G.throwMonkey();
const m = MONKEY.pool.find(q => q.state === 'fly');
let firstHit = null;
for (let i = 0; i < 240 && m.state === 'fly'; i++) { G.tick(dt); G.updateMonkeys(dt); if (firstHit === null && m.p.y < 0.3) firstHit = m.p.clone(); }
check(m.state === 'dance' && Math.hypot(m.p.x - firstHit.x, m.p.z - firstHit.z) < 1.5, 'casi no rebota: se queda cerca de donde cae', `(${Math.hypot(m.p.x - firstHit.x, m.p.z - firstHit.z).toFixed(2)} m)`);
check(m.t === CONFIG.MONKEY.dance && CONFIG.MONKEY.dance === 10, 'baila 10 s');
G.tick(dt); G.updateMonkeys(dt);
check(m.g.userData.halo && m.g.userData.halo.material.opacity > 0.5, 'brilla (halo)');

// 5) calamar gigante más grande, ronda en romanos
check(CONFIG.SQUID.giant.scale >= 9 && G.GIANT.g.userData.halo, 'calamar gigante más grande y con la boca brillando');
G.startRound(12);
check(G.UI.round.textContent === 'XII', 'la ronda en romanos (XII)');
G.startRound(28);
check(G.UI.round.textContent === 'XXVIII', 'XXVIII');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
