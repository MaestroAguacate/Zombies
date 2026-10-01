// V2 F5.19c (cuarta tanda): zombies en el búnker, CARPENTER y FIRE SALE, un chicle a la vez, line up en la pausa,
// aviso de accesorios nuevos, 2 snipers que atraviesan, la pistola con PaP (dos y explosiva), tomarse el perk,
// ícono X2, cráneo tirado y sonidos embebidos.
const G = require('./harness.js');
const { state, player, CONFIG, roundState, weaponsState, keys } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, P = CONFIG.PLAYER;
CONFIG.POWERUPS.dropChance = 0;
function fresh(open) {
  G.resetGame(); state.running = true; if (open) G.debugOpenAllDoors();
  state.round = 8; roundState.phase = 'active'; state.health = 100; state.lastDamageTime = -99; state.gameOver = false;
  state.points = 50000;
}
function clearZ() { for (const q of state.zombies.slice()) { q.active = q.alive = false; q.root.visible = false; } state.zombies.length = 0; }
function setPlayer(x, z, y) { player.pos.set(x, (y || 0) + P.height, z); G.updateFlowField(true); }
function zombieAt(x, z, hp) { const q = G.spawnZombie(); q.state = 'walk'; q.px = q.pz = 0; q.px = x; q.pz = z; q.level = 0; if (hp) q.health = q.maxHealth = hp; G.placeRoot(q, 0); return q; }

// 1) búnker en la ronda 1: salen zombies adentro aunque se vean
fresh(false); G.debugUnlockAll();
const B = CONFIG.BUNKER;
setPlayer(B.ladder.out[0], B.ladder.out[1], G.groundY(B.ladder.out[0], B.ladder.out[1]));
let inside = 0;
for (let i = 0; i < 40; i++) { const sp = G.pickSpawnPoint(false); if (sp && sp.room === 'R16') inside++; }
check(inside > 0, 'en el búnker también salen zombies adentro (aunque se vean)', '(' + inside + ' de 40)');

// 2) CARPENTER y FIRE SALE
fresh(true);
for (const b of G.BARS.list) b.boards = 1;
const p0 = state.points;
G.applyPowerup('carpenter');
check(G.BARS.list.every(b => b.boards === CONFIG.BARRIERS.boards) && state.points - p0 === CONFIG.POWERUPS.types.carpenter.points, 'CARPENTER: todas las barricadas con 5 tablas (+' + (state.points - p0) + ')');
const home = G.BOX.room;
G.applyPowerup('firesale');
const vis = G.FIRESALE.ghosts.filter(g => g.g.visible).map(g => g.room);
check(state.effects.fireSale === CONFIG.POWERUPS.types.firesale.duration && vis.length === Object.keys(CONFIG.BOX.spots).length - 1 && vis.indexOf(home) < 0,
  'FIRE SALE: caja en todos sus lugares (' + (vis.length + 1) + ') por ' + CONFIG.POWERUPS.types.firesale.duration + ' s');
const gh = G.FIRESALE.ghosts.find(g => g.room === 'R2');
setPlayer(gh.x + Math.sin(gh.rot) * 1.5, gh.z + Math.cos(gh.rot) * 1.5); G.updateInteract();   // enfrente de la caja
check(G.interactState.kind === 'firesale', 'cartel en una caja del fire sale');
check(G.interact() && G.BOX.room === 'R2' && G.BOX.phase === 'rolling', 'usarla muda la caja ahí y gira');
let teddy = 0; for (let i = 0; i < 400; i++) if (G.rollBoxResult() === 'teddy') teddy++;
check(teddy === 0, 'sin oso durante el fire sale');
G.BOX.phase = 'idle';
for (let i = 0; i < Math.ceil(61 / 0.5); i++) { G.tick(0.5); G.updateEffects(0.5); }
check(!(state.effects.fireSale > 0) && G.BOX.room === home && G.FIRESALE.ghosts.every(g => !g.g.visible), 'al terminar la caja vuelve a ' + home);

// 3) un chicle a la vez
fresh(false);
const GU = G.GUMM, gm = GU.machines[0];
G.PROFILE.preset = ['shadow', 'beacon', 'quickhands', 'ironlungs', 'sharpedge'];
G.activateGum('beacon');                                          // por tiempo
const pt = state.points;
check(!G.useGumMachine(gm) && state.points === pt && /still active/.test(G.gumPrompt(gm).text), 'con uno por tiempo activo la chiclera no vende', '("' + G.gumPrompt(gm).text + '")');
GU.fx = {};
G.activateGum('shadow');                                          // de cargas: queda en la mano
check(GU.held && GU.held.id === 'shadow' && /replaces/.test(G.gumPrompt(gm).text), 'con uno en la mano sí se puede comprar (avisa que lo reemplaza)');
G.activateGum('insta3');
check(GU.held && GU.held.id === 'insta3', 'agarrar otro reemplaza al de la mano (el anterior se pierde)');
GU.held = null;
check(CONFIG.GUMS.machine.vend === 5, 'la chiclera entrega a los 5 s (el ruido dura 6)');

// 4) line up en la pausa y aviso de accesorios nuevos
G.renderLineupPanel();
check(/GOBBLEGUM LINE UP/.test(G.UI.panelLineup.innerHTML) && (G.UI.panelLineup.innerHTML.match(/class="lcard/g) || []).length === 5, 'pausa: el line up con los 5 y qué hace cada uno');
G.PROFILE.seen = {}; G.PROFILE.wxp = { rifle: 1e6 };
// (F5.28f: el rifle se ve en el menú desde su nivel de cuenta)
G.PROFILE.xp = Math.max(G.PROFILE.xp, G.xpForLevel(CONFIG.PROGRESSION.weaponLevels.rifle));
check(G.unseenAtts('rifle').length > 0 && G.unseenTotal() > 0, 'aviso: accesorios nuevos sin ver (' + G.unseenTotal() + ')');
G.MENU.weapon = 'rifle'; G.renderWeaponsPanel();
check(G.unseenAtts('rifle').length === 0, 'al mirar el arma se marcan como vistos');

// 5) snipers: 2 nuevos y la bala que atraviesa
const W = CONFIG.WEAPONS;
check(W.marksman && W.farmhand && W.marksman.magSize === 3 && W.marksman.fireRate < W.sniper.fireRate / 3 && W.farmhand.damage < W.sniper.damage,
  'MARKSMAN (3 balas seguidas rápido) y FARMHAND (el malo)');
check(CONFIG.BOX.pool.includes('marksman') && CONFIG.BOX.pool.includes('farmhand'), 'los dos en la caja');
fresh(true); clearZ();
setPlayer(0, 10); G.setCam(0);
const THREE = require('three');
const a = zombieAt(0, 6, 100), b2 = zombieAt(0, 5.2, 100), c = zombieAt(0, 1.5, 100);
G.scene.updateMatrixWorld(true);
G.feel.eye.copy(player.pos); G.feel.aimQuat.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -0.12, -1).normalize());   // al pecho
state.weapons = [{ id: 'sniper', mag: 5, reserve: 40 }]; state.currentWeapon = 0; weaponsState.phase = 'idle'; weaponsState.lastShot = -1e9; G.tick(2);
G.fireWeapon();
check(!a.alive && !b2.alive && c.alive, 'sniper: mata al de adelante y al que está pegado atrás; al lejano no', '(' + [a, b2, c].map(q => q.alive ? 'vivo' : 'muerto').join(', ') + ')');

// 6) la pistola con PaP: dos y explosiva
const d = G.papDef('m1911');
check(d.dual && d.explosive && d.magSize === Math.ceil(W.m1911.magSize * CONFIG.PAP.ammoMul) * 2, 'la pistola con PaP son dos (cargador ' + d.magSize + ') y las balas explotan');
fresh(true); clearZ();
setPlayer(0, 10); G.setCam(0);
const near = zombieAt(0.8, 4, 100000), hp0 = near.health;
state.weapons = [{ id: 'm1911', mag: 24, reserve: 120, pap: true }]; state.currentWeapon = 0; G.equipModel(G.curDef());
G.feel.eye.copy(player.pos); G.feel.aimQuat.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1.6, -6).normalize());
weaponsState.phase = 'idle'; weaponsState.lastShot = -1e9; G.tick(2); state.health = 100;
G.fireWeapon();
check(near.health < hp0 && state.health === 100, 'la bala explota en el piso y daña al de al lado (sin daño propio)', '(' + Math.round(hp0 - near.health) + ')');
let twoModels = 0; weaponsState.model.traverse(o => { if (o.userData && o.userData.muzzle) twoModels++; });
check(twoModels === 2, 'en la mano se ven las dos pistolas');

// 7) tomarse el perk: 3 s sin disparar
fresh(true); G.debugUnlockAll();                                   // (la energía pide los 4 generadores)
const m = G.PERKM.machines.revive;
setPlayer(m.x + 1.5, m.z); G.updateInteract();
state.weapons = [{ id: 'm1911', mag: 8, reserve: 80 }]; state.currentWeapon = 0; weaponsState.phase = 'idle';
check(G.buyPerk('revive') && weaponsState.phase === 'drink' && weaponsState.bottle && weaponsState.bottle.visible, 'al comprar un perk te lo tomás (se ve la botella)');
const mag0 = state.weapons[0].mag; weaponsState.lastShot = -1e9; G.tick(1); G.fireWeapon();
check(state.weapons[0].mag === mag0, 'mientras tanto no dispara');
for (let i = 0; i < Math.round(CONFIG.PERKS.drinkTime * 60) + 2; i++) { G.tick(dt); G.updateWeapon(dt); }
check(weaponsState.phase === 'idle' && !weaponsState.bottle.visible, 'a los ' + CONFIG.PERKS.drinkTime + ' s vuelve el arma');

// 8) ícono X2, cráneo, sonidos
state.effects.doublePoints = 20; G.updatePowerupUI(0.01);
check(/>X2</.test(G.UI.fx.innerHTML), 'doble puntos: el ícono dice X2');
state.effects.doublePoints = 0;
check(G.WORLD.colliders.some(q => q.tag === 'prop:craneoTortuga'), 'el cráneo de tortuga tirado en el claro es sólido');
const keysS = Object.keys(JSON.parse(require('../../build.js').html().match(/id="bhzSounds">([\s\S]*?)<\/script>/)[1]));
check(['pap_gun_shoot', 'ruido_de_la_gumball_machine', 'juger_music', 'musica_del_buker', 'background_music_in_temple'].every(k => keysS.includes(k)) && !keysS.some(k => /pendiente/.test(k)),
  'sonidos nuevos embebidos (' + keysS.length + '), sin el pendiente');
check(G.papShotRate(G.papDef('m1911')) !== G.papShotRate(G.papDef('sniper')), 'el disparo con PaP suena distinto por arma');

console.log(fail ? `FALLA (${fail})` : 'PASA');
process.exit(fail ? 1 : 0);
