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

// 3) choque al oeste del templo
fresh();
const CC = CONFIG.CRASH;
check(G.roomAt(44.6, 83) && G.roomAt(44.6, 83).id === 'R20', 'el choque es parte del templo (R20)');
check(CC.cars.every((c, i) => G.WORLD.colliders.some(q => q.tag === 'prop:auto' + i && q.solid)), 'los autos son sólidos');
player.pos.set(58, 1.7, 83); G.updateFlowField(true);
check(G.flowAt(44, 77) > 0 && G.flowAt(52, 86) > 0, 'se llega desde el anexo del templo (hueco en x 55)');
check(G.CRASH.flames.length === CC.cars.filter(c => c[4]).length && G.CRASH.smoke, 'llamas en los autos que arden y humo');

// 4) XP, niveles y accesorios
fresh();
const PR = CONFIG.PROGRESSION;
G.PROFILE.xp = 0; G.PROFILE.loadout = {}; G.sanitizeLoadout(); G.resetMatchXP();
check(G.xpForLevel(1) === 0 && G.xpForLevel(2) === PR.base && G.xpForLevel(3) === 2 * PR.base + PR.step, 'curva de XP');
check(G.levelOf(G.xpForLevel(12)) === 12 && G.levelOf(G.xpForLevel(12) - 1) === 11 && G.levelOf(1e12) === PR.maxLevel, 'nivel por XP (tope ' + PR.maxLevel + ')');
check(G.tierName(1) === 'RECRUIT' && G.tierName(PR.maxLevel) === 'COMMANDER', 'rangos');
check(!G.attUnlocked('quickdraw') && !G.toggleAttachment('smg', 'quickdraw'), 'nivel 1: nada desbloqueado');
G.addXP(PR.base);
check(G.rankLevel() === 2 && G.attUnlocked('quickdraw') && G.PROFILE.matchXP === PR.base, 'subir de nivel desbloquea quickdraw');
G.PROFILE.xp = G.xpForLevel(PR.maxLevel);
const base = CONFIG.WEAPONS.smg;
check(G.toggleAttachment('smg', 'fastmag') && G.toggleAttachment('smg', 'barrel') && G.toggleAttachment('smg', 'stock'), 'poner 3 accesorios');
check(!G.toggleAttachment('smg', 'laser') && G.PROFILE.loadout.smg.att.length === PR.maxAtt, 'tope de ' + PR.maxAtt);
state.weapons = [{ id: 'smg', mag: 30, reserve: 120 }]; state.currentWeapon = 0;
const d = G.curDef();
check(Math.abs(d.reloadTime - base.reloadTime * PR.attachments.fastmag.reload) < 1e-9, 'fast mag: recarga ×' + PR.attachments.fastmag.reload);
check(Math.abs(d.damage - base.damage * PR.attachments.barrel.damage) < 1e-9 && d.spread < base.spread, 'long barrel: más daño y menos dispersión');
check(Math.abs(d.recoil - base.recoil * PR.attachments.stock.recoil) < 1e-9, 'culata: menos retroceso');
check(CONFIG.WEAPONS.smg.damage === base.damage && G.slotDef({ id: 'shotgun' }) === CONFIG.WEAPONS.shotgun, 'CONFIG.WEAPONS intacto; sin carga, el def de siempre');
G.toggleAttachment('smg', 'stock'); G.toggleAttachment('smg', 'laser');
G.ADS.k = 0; const hipL = G.adsSpread(); G.toggleAttachment('smg', 'laser'); const hip0 = G.adsSpread();
check(Math.abs(hipL / hip0 - PR.attachments.laser.hipSpread) < 1e-9, 'láser: cadera ×' + PR.attachments.laser.hipSpread);
check(G.setCamo('smg', 'crimson') && G.curDef().camo === PR.camos.find(c => c.id === 'crimson').color, 'camuflaje');
G.PROFILE.xp = 0; G.sanitizeLoadout();
check(G.PROFILE.loadout.smg.att.length === 0 && !G.PROFILE.loadout.smg.camo, 'sin nivel, se sacan los accesorios');
const x0 = G.PROFILE.xp;
G.startRound(2);
check(G.PROFILE.xp === x0 + PR.xp.round, 'terminar la ronda 1 da ' + PR.xp.round + ' XP');
const z = G.spawnZombie(); z.state = 'walk'; const x1 = G.PROFILE.xp;
G.damageZombie(z, 1e6, true);
check(G.PROFILE.xp === x1 + PR.xp.kill + PR.xp.headshot, 'kill con headshot: ' + (PR.xp.kill + PR.xp.headshot) + ' XP');

check(G.attsFor('m1911').indexOf('stock') < 0 && !G.toggleAttachment('m1911', 'stock'), 'la pistola no lleva culata');
check(G.attsFor('bow').indexOf('reflex') < 0 && G.attsFor('bow').indexOf('limbs') >= 0, 'el arco tiene sus propios accesorios');
// 5) menú
G.showMenu('main');
check(G.MENU.mode === 'main' && G.UI.btnPlay.textContent === 'PLAY', 'menú de inicio');
check(!G.pickMap('city') && !G.pickMap('q') && G.pickMap('beach') && G.MENU.map === 'beach', 'City y ??? bloqueados, Beach sí');
state.running = false; check(G.gfxFilter().includes('grayscale'), 'el mundo en gris detrás del menú');
G.showMenu(null); check(!G.gfxFilter().includes('grayscale'), 'jugando, sin gris');

// 6) cuentas y modo desarrollador
fresh();
const n0 = G.accountNames().length;
check(G.createAccount('Maestro Aguacate') && G.PROFILE.name === 'MAESTRO AGUACATE' && G.PROFILE.xp === 0, 'crear cuenta nueva (arranca de cero)');
G.PROFILE.xp = 5000; G.saveProfile();
check(G.createAccount('Diego') && G.PROFILE.xp === 0 && G.switchAccount('MAESTRO AGUACATE') && G.PROFILE.xp === 5000, 'cada cuenta guarda lo suyo');
check(!G.createAccount('Diego'), 'no se repiten nombres');
check(G.renameAccount('AGUACATE') && G.accountNames().indexOf('AGUACATE') >= 0 && G.accountNames().indexOf('MAESTRO AGUACATE') < 0, 'renombrar');
const realXp = G.PROFILE.xp;
CONFIG.DEBUG_MODE = true;
check(G.devMaxAccount() && G.rankLevel() === CONFIG.PROGRESSION.maxLevel && G.gumCount('freeall') === Infinity, 'dev: nivel máximo y todos los chicles');
G.addXP(99999); G.saveProfile();
check(G.ACCOUNTS.list.AGUACATE.xp === realXp, 'dev: no se guarda nada');
G.DEV.on = false;
check(G.rankLevel() === G.levelOf(realXp), 'al salir del modo dev vuelve la cuenta real');

// 7) chicles: preset, chiclera, efectos, tienda
fresh(); G.PROFILE.xp = 0; G.PROFILE.gums = {}; G.PROFILE.ink = 0; G.PROFILE.preset = [];
check(G.gumCount('shadow') === Infinity && G.gumCount('restock') === 0 && G.gumCount('freeall') === 0, 'clásicos por nivel; raros por inventario');
check(!G.setPresetSlot(0, 'freeall') && G.setPresetSlot(0, 'shadow'), 'solo se ponen en el preset los que tenés');
const gm = G.GUMM.machines[0];
state.points = 5000;
check(G.useGumMachine(gm) && state.points === 4500 && G.GUMM.offer && G.GUMM.offer.id === 'shadow', 'la chiclera cobra 500 y ofrece uno del preset');
check(G.gumPrompt(gm).text.indexOf('[F] Take SHADOW STEP') === 0, 'cartel: agarrarlo con F');
for (let i = 0; i < 60 * (CONFIG.GUMS.machine.offer + 0.2); i++) { G.tick(dt); G.updateGums(dt); }
check(!G.GUMM.offer, 'si no lo agarrás en ' + CONFIG.GUMS.machine.offer + ' s, se va');
check(G.useGumMachine(gm) && state.points === 3500, 'la segunda cuesta 1000');
check(G.takeGum() && G.gumActive('shadow'), 'agarrarlo lo activa');
G.PROFILE.gums.freeall = 1; G.setPresetSlot(0, 'freeall');
G.GUMM.uses = 0; G.useGumMachine(gm); G.takeGum();
check(G.PROFILE.gums.freeall === 0 && G.gumActive('freeall'), 'el épico se gasta al agarrarlo');
const pts = state.points;
check(G.spendPoints(2000) && state.points === pts, 'SHOPPING SPREE: todo gratis');
G.GUMM.fx = {};
G.activateGum('insta3'); state.effects.instakill = 0;
check(G.useHeldGum() && state.effects.instakill > 0 && G.GUMM.held.charges === 2, 'TRIPLE THREAT: T dispara un insta-kill (quedan 2)');
G.GUMM.held = null;
G.PROFILE.ink = 3;
const w = G.rollGumPack(3, () => 0.99);
check(w && w.length === 3 && G.PROFILE.ink === 0 && w.every(id => G.PROFILE.gums[id] >= 1), 'tienda: 3 monedas = 3 chicles al inventario');
check(!G.rollGumPack(1), 'sin monedas no se compra');
G.resetGame();
check(!G.GUMM.offer && !G.GUMM.held && !Object.keys(G.GUMM.fx).length && G.GUMM.uses === 0, 'reset de chicles');

console.log(fail ? `\n${fail} FALLAS` : '\nPASA');
process.exit(fail ? 1 : 0);
