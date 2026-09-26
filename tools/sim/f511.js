// V2 F5.11: rancho hasta el mar, jardín norte, escalera ancha, búnker (escotilla, estatuas, ojos rojos, Mule
// Kick, bazooka), armas nuevas (arco, bazooka), caja (todas, Ray Gun menos), langostino bailarín, calamar
// gigante, tortugas desde la R11, números de daño apagables.
const G = require('./harness.js');
const THREE = require('three');
const { state, player, CONFIG, roundState, WORLD, NAV, BUNK, MONKEY, FLOW, GIANT, SQPOOL, DPOOL, TRAPS, BOSS } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, P = CONFIG.PLAYER, B = CONFIG.BUNKER;
CONFIG.POWERUPS.dropChance = 0;

function fresh(open) {
  G.resetGame(); state.running = true; if (open) G.debugOpenAllDoors();
  state.round = 8; roundState.phase = 'active'; state.health = 100; state.lastDamageTime = -99; state.gameOver = false;
  state.points = 50000;
}
function clearZ() { for (const q of state.zombies.slice()) { q.active = q.alive = false; q.root.visible = false; } state.zombies.length = 0; }
function setPlayer(x, z) { player.pos.set(x, G.groundY(x, z) + P.height, z); G.updateFlowField(true); }
function zombieAt(x, z, hp) {
  const q = G.spawnZombie(); q.state = 'walk'; q.px = x; q.pz = z; q.level = 0; q.mode = 'flow';
  if (hp) q.health = q.maxHealth = hp;
  return q;
}
function squidAt(x, z) { const q = SQPOOL.find(o => !o.active); G.resetZombie(q, { x, z }, false); state.zombies.push(q); q.px = x; q.pz = z; q.state = 'walk'; return q; }
function dogAt(x, z) { const q = DPOOL.find(o => !o.active); G.resetZombie(q, { x, z }, false); state.zombies.push(q); q.px = x; q.pz = z; q.state = 'walk'; return q; }
const nearNav = (x, z) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (G.flowAt(Math.floor(x) + dx, Math.floor(z) + dz) >= 0) return true; return false; };

// 1) mapa
fresh(true); setPlayer(-22, 29);
// F5.15: al oeste del jardín es espesura; del rancho al mar va el sendero de la Playa del Calamar (R19)
check(!G.roomAt(-30, 8) && G.inThicket(-30, 8), 'F5.15: entre el jardín oeste y el rancho es espesura (no se camina)');
check(G.roomAt(-44, 8).id === 'R19' && G.roomAt(-30, -15).id === 'R10', 'F5.15: sendero rancho → Playa del Calamar (R19) y la playa oeste es R10');
check(nearNav(-44, 8) && nearNav(-44, -10), 'se llega caminando desde el rancho por el sendero');
check(G.roomAt(0, 48).id === 'R15' && nearNav(-20, 48) && nearNav(30, 48), 'jardín norte: de un jardín al otro por detrás del sótano');
fresh(false); Object.keys(state.doors).filter(id => id !== 'D20' && !/^H\d$/.test(id)).forEach(G.openDoor); setPlayer(0, -10);
{ const d = G.flowAt(-60, 60);   // F5.15: el Claro del Búnker está detrás de las lianas H2/H3
  check(d < 0, 'con el lazo y las lianas cerradas, desde la playa no se llega al Claro del Búnker', `(${d})`); }
check(!G.UP.stairs, 'F5.16: sin escalera en el jardín trasero');
const st = CONFIG.PERKS.list.stamin;
check(st.room === 'R21', 'F5.16: Stamin-Up en la estación de policía');
check(CONFIG.RANCHO.palapa.h > 4, 'techo de la palapa más alto (' + CONFIG.RANCHO.palapa.h + ' m)');
check(G.PROPS.filter(p => p.id.startsWith('reposeraJ') && p.collider).length === CONFIG.DECOR.loungers.length, 'reposeras sólidas');

// 2) búnker: cerrado, estatuas, apertura, escotilla, ojos rojos
// F5.15: la entrada está en la esquina NO y mira al sur (face -1): "adelante" = hacia -z
const FC = B.entrance.face || 1, HO = B.hatch.out;
fresh(true); clearZ(); setPlayer(HO[0], HO[1] + FC * 2);
check(!BUNK.open && !NAV.hatch, 'la escotilla arranca cerrada, sin enlace');
player.pos.set(B.hatch.x, P.height, B.hatch.z + FC * 0.8); G.updateInteract();
check(G.interactState.kind === 'hatch' && G.promptFor(G.interactState).text === 'Bunker closed' && !G.interact(), 'cartel "Bunker closed" y no se usa');
const [s1, s2] = BUNK.statues;
setPlayer(HO[0], HO[1] + FC * 6);
// F5.15: despiertan con 5 kills de cualquier tipo (antes, calamares)
for (let i = 0; i < B.wakeKills - 1; i++) { const q = i % 2 ? squidAt(s1.x, s1.z + FC * 2) : zombieAt(s1.x + 0.5, s1.z + FC * 1.5, 9999); G.damageZombie(q, 99999, false); }
check(!s1.awake && s1.kills === B.wakeKills - 1, (B.wakeKills - 1) + ' kills: sigue de piedra');
const zc = zombieAt(s1.x + 1, s1.z + FC * 8, 9999);  G.damageZombie(zc, 99999, false);
check(!s1.awake, 'uno lejos no cuenta');
G.damageZombie(zombieAt(s1.x, s1.z + FC * 2, 9999), 99999, false);
check(s1.awake && !s2.awake, 'el 5to (un zombie cualquiera) la despierta (la otra sigue de piedra)');
function feed(s, crawlers, dogs) {
  for (let i = 0; i < crawlers + dogs; i++) {
    const q = i < crawlers ? zombieAt(s.x + 1, s.z + FC * 2, 500) : dogAt(s.x + 1, s.z + FC * 2);
    if (i < crawlers) q.crawl = true;
    q.state = 'idle';                                                   // quieto: que no se vaya del radio
    for (let k = 0; k < 60 * (CONFIG.QUEST.plantEatEvery + CONFIG.GARDEN.eat.total) && q.alive; k++) { G.tick(dt); G.updateStatues(dt); G.updateZombies(dt); }
    for (let k = 0; k < 60 * CONFIG.GARDEN.eat.total; k++) { G.tick(dt); G.updateStatues(dt); G.updateZombies(dt); }
  }
}
const n0 = zombieAt(s1.x + 1, s1.z + FC * 2, 500);                     // uno normal: no lo come
for (let k = 0; k < 120; k++) { G.tick(dt); G.updateStatues(dt); }
check(n0.alive, 'despierta no come zombies normales');
clearZ();
feed(s1, B.eatCrawlers, B.eatDogs);
check(s1.crawlers === B.eatCrawlers && s1.dogs === B.eatDogs && s1.done && !BUNK.open, 'come 6 arrastrados y 3 perros (con una sola, sigue cerrada)',
  `(${s1.crawlers} / ${s1.dogs})`);
for (let i = 0; i < B.wakeKills; i++) G.damageZombie(zombieAt(s2.x, s2.z + FC * 2, 9999), 99999, false);
clearZ(); feed(s2, B.eatCrawlers, B.eatDogs);
check(BUNK.open && NAV.hatch && BUNK.seahorse.visible, 'con las 2: se abre la escotilla, el enlace y el caballito de mar');
player.pos.set(B.hatch.x, P.height, B.hatch.z + FC * 0.8); G.updateInteract();
check(G.promptFor(G.interactState).text === '[F] Go down to the bunker' && G.interact(), 'F: bajar');
for (let i = 0; i < 60 * B.fade * 2 + 5; i++) { G.tick(dt); G.updateBunker(dt); }
check(G.inBunker() && Math.abs(player.pos.y - (B.y + P.height)) < 1e-6 && state.health === 100, 'fundido y aparecés abajo (sin daño)', `(y ${player.pos.y.toFixed(2)})`);
// zombie de arriba baja por la escotilla, escondido, y llega con los ojos rojos
clearZ(); G.updateFlowField(true);
const dz = zombieAt(HO[0] + 4, HO[1] + FC * 3);
let hidden = false;
for (let i = 0; i < 60 * 25 && !(dz.redEyes && G.groundY(dz.px, dz.pz) < -1 && dz.state === 'walk'); i++) {
  G.tick(dt); G.updateFlowField(false); G.updateZombies(dt); state.health = 100;
  if (!dz.root.visible && dz.alive) hidden = true;
}
check(hidden && dz.redEyes && G.groundY(dz.px, dz.pz) < -1, 'un zombie del jardín baja por la escotilla (escondido) con los ojos rojos');
// Mule Kick y bazooka en el búnker
state.power = true;
const mk = G.PERKM.machines.mule;
check(mk && mk.room === 'R16', 'Mule Kick está en el búnker');
state.weapons = [{ id: 'm1911', mag: 8, reserve: 80 }]; state.currentWeapon = 0;
G.giveWeapon('smg'); G.giveWeapon('rifle');
check(state.weapons.length === 2, 'sin Mule Kick: 2 armas');
state.perks.push('mule');
G.giveWeapon('lmg');
check(state.weapons.length === 3 && G.maxWeapons() === 3, 'con Mule Kick: 3 armas');
state.perks = ['mule', 'revive']; state.lastDamageTime = -99; G.damagePlayer(9999, 0, 0);
if (G.DOWN.on) G.updateDown(CONFIG.PERKS.lastStand.time + 0.1);   // F5.18: 10 s tirado con la Ray Gun
check(!state.gameOver && state.weapons.length === 2, 'Quick Revive: sin perks, la 3ra arma se pierde');
check(CONFIG.WALLBUYS.some(w => w.weapon === 'bazooka' && w.room === 'R16'), 'la bazooka está en la pared del búnker');
G.resetGame();
check(!BUNK.open && !NAV.hatch && s1.looks[0].s.visible && !BUNK.seahorse.visible, 'resetGame: escotilla cerrada, estatuas de piedra');

// 3) armas: todas en la caja, Ray Gun menos; arco y bazooka
const pool = CONFIG.BOX.pool;
check(['uzi', 'ak47', 'deagle', 'spas', 'bow', 'bazooka', 'monkey', 'revolver', 'doublebarrel'].every(id => pool.includes(id)), 'la caja ofrece todas las armas nuevas (y el langostino)');
fresh(true); state.weapons = [{ id: 'm1911', mag: 8, reserve: 80 }];
const cnt = {};
for (let i = 0; i < 20000; i++) { const r = G.rollBoxResult(); if (r !== 'teddy') cnt[r] = (cnt[r] || 0) + 1; }
const avg = (cnt.smg + cnt.rifle + cnt.lmg) / 3;
check(cnt.raygun < avg * 0.6 && cnt.raygun > avg * 0.3, 'la Ray Gun sale menos', `(${cnt.raygun} contra ~${avg.toFixed(0)})`);
// arco: toque débil, carga llena fuerte
fresh(true); clearZ(); setPlayer(0, 10); G.setCam(Math.PI);                   // mirando a +z
state.weapons = [{ id: 'bow', mag: 1, reserve: 30 }]; state.currentWeapon = 0; G.equipModel(G.curDef()); G.weaponsState.phase = 'idle';
function bowShot(hold) {
  const W = G.weaponsState, s = G.curSlot(); s.mag = 1; W.phase = 'idle'; W.lastShot = -1e9; G.tick(1);
  G.fireWeapon(); G.keys.Mouse0 = true;
  let r = null;
  for (let i = 0; i < Math.round(hold * 60); i++) { G.tick(dt); G.updateBow(dt); }
  G.keys.Mouse0 = false; G.tick(dt);
  const W0 = W.charge; G.updateBow(dt);
  return W0;
}
const za = zombieAt(0, 14, 5000); za.state = 'idle'; za.root.position.set(0, 0, 14); G.scene.updateMatrixWorld(true);
G.feel.eye.set(0, 1.4, 10); G.feel.aimQuat.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1));
bowShot(0.05);
const tap = 5000 - za.health;
za.health = 5000;
bowShot(1.2);
const full = 5000 - za.health;
const Bw = CONFIG.WEAPONS.bow;
check(tap > 0 && tap < Bw.damage * 0.35 && Math.abs(full - Bw.damage) < 1, 'arco: un toque pega poco, la carga llena pega ' + Bw.damage, `(${tap.toFixed(0)} / ${full.toFixed(0)})`);
// bazooka: cohete que explota con área
fresh(true); clearZ(); setPlayer(0, -6);
const ra = zombieAt(0, -16, 5000), rb = zombieAt(1.5, -16.5, 5000), far = zombieAt(8, -16, 5000);
[ra, rb, far].forEach(q => { q.state = 'idle'; q.root.position.set(q.px, 0, q.pz); });
G.scene.updateMatrixWorld(true);
G.feel.eye.set(0, 1.4, -6); G.feel.aimQuat.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -0.02, -1).normalize());
G.launchRocket(CONFIG.WEAPONS.bazooka);
for (let i = 0; i < 90; i++) { G.tick(dt); G.updateRockets(dt); }
check(ra.health < 5000 && rb.health < 5000 && far.health === 5000, 'bazooka: el cohete explota y pega en área (no al lejano)', `(${(5000 - ra.health).toFixed(0)}, ${(5000 - rb.health).toFixed(0)})`);
check(state.health === 100 && !G.ROCKETS.pool.some(r => r.active), 'lejos no te lastima y el cohete se va');
fresh(true); clearZ(); setPlayer(0, -6);
G.feel.eye.set(0, 1.4, -6); G.feel.aimQuat.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, -0.6).normalize());
G.launchRocket(CONFIG.WEAPONS.bazooka);
for (let i = 0; i < 30; i++) { G.tick(dt); G.updateRockets(dt); }
check(state.health === 100 - CONFIG.WEAPONS.bazooka.selfDamage, 'al piso, a tus pies: te saca ' + CONFIG.WEAPONS.bazooka.selfDamage, `(vida ${state.health})`);

// 4) langostino bailarín
fresh(true); clearZ(); setPlayer(0, 10); G.setCam(0);
G.giveMonkeys();
check(MONKEY.count === CONFIG.MONKEY.max && MONKEY.has, 'de la caja: ' + CONFIG.MONKEY.max + ' langostinos');
const zs = [zombieAt(-5, 16, 5000), zombieAt(5, 16, 5000)];
// tirado hacia abajo: cae a unos metros, en la sala (con todo abierto, de frente volaba hasta la playa)
G.feel.eye.set(0, 1.6, 10); G.feel.aimQuat.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -0.6, -1).normalize());
check(G.throwMonkey() && MONKEY.count === CONFIG.MONKEY.max - 1, 'tecla 4: lo tira');
let danced = false, towards = 0, maxD = 0;
for (let i = 0; i < 60 * 12; i++) {
  G.tick(dt); G.updateMonkeys(dt); G.updateFlowField(false); G.updateZombies(dt); state.health = 100;
  const lure = G.monkeyLure();
  if (lure) {
    danced = true;
    for (const q of zs) if (q.alive && Math.hypot(q.px - lure.x, q.pz - lure.z) < 2) towards++;
    maxD = Math.max(maxD, ...zs.map(q => Math.hypot(q.px - player.pos.x, q.pz - player.pos.z)));
  }
}
check(danced, 'cae y baila');
check(towards > 0, 'los zombies van hacia él (no hacia vos)');
check(zs.every(q => q.health < 5000) && state.health === 100, 'explota: les pega y a vos no', zs.map(q => (5000 - q.health).toFixed(0)).join(' / '));
check(!G.monkeyLure() && MONKEY.pool.every(m => m.state === 'off'), 'y se termina');
G.applyPowerup('maxammo');
check(MONKEY.count === CONFIG.MONKEY.max, 'Max Ammo recarga los langostinos');

// 5) calamar gigante
CONFIG.DOGS.enabled = true;
fresh(true); clearZ(); setPlayer(0, 4);
roundState.mobCount = 1; roundState.nextDog = 8; G.startRound(8);
check(roundState.mob === 'squids' && GIANT.state === 'rise', 'ronda de calamares: sale el calamar gigante');
let landed = 0, fromGiant = 0, spawned0 = 0;
for (let i = 0; i < 60 * 25; i++) {
  G.tick(dt); G.updateRounds(dt); G.updateGiant(dt);
  for (const q of state.zombies) if (q.alive && q.squid && !q._seen) {
    q._seen = true; landed++;
    if (q.fromGiant && G.roomAt(q.px, q.pz).id === 'R10') fromGiant++;   // cayó en la playa, escupido
  }
  for (const q of state.zombies) if (q.alive) { q.alive = false; q.state = 'dying'; q.t = 99; q._seen = false; }   // (el pool se reusa)
  G.updateZombies(dt);
}
SQPOOL.forEach(q => delete q._seen);
check(landed > 5 && fromGiant / landed > 0.5, 'la mayoría los escupe a la playa', `(${fromGiant} de ${landed})`);
check(GIANT.state === 'sink' || GIANT.state === 'off', 'cuando salieron todos se hunde');
fresh(false); clearZ(); setPlayer(0, 4); roundState.mobCount = 1; roundState.nextDog = 8; G.startRound(8);
check(GIANT.state === 'off', 'con la playa cerrada no sale');
CONFIG.DOGS.enabled = false;

// 6) tortugas desde la R11: cada mordisco saca la vida de la R10
fresh(true); clearZ(); setPlayer(-45, 36); state.round = 15;
const TC = CONFIG.TRAPS.turtles, hp15 = CONFIG.ZOMBIE.health(15);
const tz = zombieAt(-47, 23, hp15); tz.state = 'idle';
G.useTrap(TRAPS.turtles);
let firstBite = null;
for (let i = 0; i < 60 * 15 && tz.alive; i++) { G.tick(dt); G.updateTraps(dt); if (firstBite === null && tz.health < hp15) firstBite = hp15 - tz.health; }
check(Math.abs(firstBite - CONFIG.ZOMBIE.health(TC.biteRound)) < 1e-6, 'R15: el mordisco saca la vida de la R10', `(${firstBite})`);
check(!tz.alive, 'y lo vuelve a morder hasta matarlo');

// 7) números de daño apagables, 4 plantas
fresh(true); clearZ();
const nq = zombieAt(0, 5, 9999);
G.SETTINGS.dmgNumbers = false;
const before = G.dmgNums.pool.filter(n => n.active).length;
G.spawnDamageNumber(nq, new THREE.Vector3(0, 1, 5), 50, false);
check(G.dmgNums.pool.filter(n => n.active).length === before, 'con el ajuste apagado no salen números de daño');
G.SETTINGS.dmgNumbers = true;
check(CONFIG.QUEST.plantsNeeded === 4, 'la caracola pide las 4 plantas');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
