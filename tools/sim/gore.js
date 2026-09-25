// V2 F7b: desmembramiento (cabeza con headshot letal, brazo con golpe fuerte, pierna al arrastrarse, pedazos en
// explosiones), física de los pedazos (caen, rebotan, no cruzan paredes, se van), pool fijo, reset; poses de
// muerte, ataques variados y renguera. Perros, calamares y bosses no se desarman.
const G = require('./harness.js');
const { state, player, CONFIG, GIBS, STATS, DPOOL } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, GO = CONFIG.GORE;
CONFIG.POWERUPS.dropChance = 0;
function fresh() { G.resetGame(); state.running = true; state.round = 5; G.debugOpenAllDoors(); player.pos.set(0, 1.7, 0); G.updateFlowField(true); }
function clearZ() { for (const q of state.zombies) { q.active = q.alive = false; q.root.visible = false; } state.zombies.length = 0; }
function zAt(x, z) { const q = G.spawnZombie(); q.state = 'walk'; q.px = x; q.pz = z; G.placeRoot(q, 0); G.scene.updateMatrixWorld(true); return q; }
const live = () => GIBS.list.filter(g => g.life > 0).length;
function stepGibs(s) { for (let i = 0; i < Math.round(s * 60); i++) { G.tick(dt); G.updateGibs(dt); } }

// 1) cabeza: headshot que mata
fresh(); clearZ();
check(GIBS.list.length === GO.gibs, 'pool de ' + GO.gibs + ' pedazos');
GO.headChance = 1;
let q = zAt(0, 6); STATS.src = 'm1911';
G.damageZombie(q, 1e9, true);
check(q.head.scale.x < 0.01 && live() === 1, 'headshot que mata: la cabeza sale volando', `(${live()})`);
const hg = GIBS.list.find(g => g.life > 0);
check(Math.abs(hg.m.geometry.parameters.width - 0.4) < 1e-9 && hg.v.y > 0, 'el pedazo es la cabeza y sale para arriba');
GO.headChance = 0; clearZ(); G.resetGibs();
q = zAt(0, 6); G.damageZombie(q, 1e9, true);
check(live() === 0, 'con headChance 0 no');
GO.headChance = 0.7; clearZ(); G.resetGibs();
q = zAt(0, 6); G.damageZombie(q, 10, true);
check(live() === 0 && q.head.scale.x === 1, 'un headshot que no mata no le saca la cabeza');

// 2) brazo
clearZ(); G.resetGibs();
q = zAt(0, 6);
G.damageZombie(q, q.maxHealth * GO.armFrac * 0.9, false, undefined, undefined, 'armR');
check(!q.armOff.R && live() === 0, 'un golpe flojo al brazo no lo arranca');
q.health = q.maxHealth;
G.damageZombie(q, q.maxHealth * GO.armFrac, false, undefined, undefined, 'armR');
check(q.alive && q.armOff.R && q.armR.scale.x < 0.01 && live() === 1, 'un golpe fuerte al brazo lo arranca (sigue vivo)');
G.damageZombie(q, q.maxHealth, false, undefined, undefined, 'armR');
check(live() === 1, 'no se arranca dos veces');

// 3) pierna al arrastrarse
clearZ(); G.resetGibs();
q = zAt(0, 6);
G.damageZombie(q, q.maxHealth * CONFIG.CRAWLER.legFrac, false, undefined, undefined, 'leg');
check(q.crawl && live() === 1, 'al arrastrarse, la pierna sale volando');

// 4) explosivos
clearZ(); G.resetGibs();
let blasts = 0, maxB = 0;
for (let i = 0; i < 30; i++) {
  q = zAt(0, 6); STATS.src = 'grenade';
  const n0 = live(); G.damageZombie(q, 1e9, false);
  const n = live() - n0; blasts += n; maxB = Math.max(maxB, n);
  check.silent = true; clearZ(); G.resetGibs();
}
check(blasts >= 30 * GO.blast[0] && maxB <= GO.blast[1], 'granada que mata: de ' + GO.blast[0] + ' a ' + GO.blast[1] + ' pedazos', `(${blasts} en 30, máx ${maxB})`);
STATS.src = 'm1911';
q = zAt(0, 6); G.damageZombie(q, 1e9, false);
check(live() === 0, 'una bala al cuerpo que mata: entero');

// 5) no humanos
clearZ(); G.resetGibs(); GO.headChance = 1;
const d = DPOOL.find(o => !o.active); G.resetZombie(d, { x: 0, z: 6 }, false); state.zombies.push(d); d.state = 'walk';
STATS.src = 'grenade'; G.damageZombie(d, 1e9, true);
check(live() === 0, 'el perro no se desarma');
GO.headChance = 0.7; STATS.src = 'm1911'; clearZ();

// 6) física de los pedazos
fresh(); clearZ();
q = zAt(0, 10); G.loseArm(q, 'L'); G.loseArm(q, 'R');
stepGibs(3);
const rest = GIBS.list.filter(g => g.life > 0);
check(rest.length === 2 && rest.every(g => g.rest && g.m.position.y >= G.groundY(g.m.position.x, g.m.position.z) - 1e-6 && g.m.position.y < 0.3),
  'caen, rebotan y quedan en el piso', rest.map(g => g.m.position.y.toFixed(2)).join(' '));
// contra la pared: el pedazo no la cruza (sala, pared oeste en x -8)
G.resetGibs();
q = zAt(-7.2, 10);
const g1 = G.spawnGib(q.armL, [0.16, 0.62, 0.16], 0xffffff, -1, 0);
g1.v.set(-6, 3, 0);
stepGibs(2);
check(g1.m.position.x > -8, 'no cruza la pared', `(x ${g1.m.position.x.toFixed(2)})`);
stepGibs(GO.life);
check(live() === 0 && GIBS.list.every(g => !g.m.visible), 'a los ' + GO.life + ' s se van');
// pool fijo
const kids = G.scene.children.length;
for (let i = 0; i < 40; i++) G.spawnGib(q.armL, [0.16, 0.62, 0.16], 0xffffff, 1, 0);
check(live() === GO.gibs && G.scene.children.length === kids, 'con más de ' + GO.gibs + ' se reusa el más viejo (la escena no crece)');
G.resetGame();
check(live() === 0, 'resetGame: sin pedazos');

// 7) el pool de zombies vuelve entero
fresh(); clearZ(); GO.headChance = 1;
q = zAt(0, 6); G.loseArm(q, 'L'); G.damageZombie(q, 1e9, true);
clearZ();
G.resetZombie(q, { x: 0, z: 6 }, false);
check(q.head.scale.x === 1 && q.armL.scale.x === 1 && !q.armOff.L && q.legR.scale.x === 1 && q.deathPose === null, 'el zombie reusado vuelve entero');
q.active = q.alive = false; GO.headChance = 0.7;

// 8) poses de muerte
fresh(); clearZ();
const poses = {};
for (let i = 0; i < 400; i++) { q = zAt(0, 6); G.damageZombie(q, 1e9, false); poses[q.deathPose] = (poses[q.deathPose] || 0) + 1; clearZ(); G.resetGibs(); }
check(GO.poses.every(([k, w]) => Math.abs((poses[k] || 0) / 400 - w) < 0.07), '4 poses de muerte con sus pesos', JSON.stringify(poses));
const poseAt = (pose, t) => { q = zAt(0, 6); G.damageZombie(q, 1e9, false); q.deathPose = pose; G.deathPose(q, t); const r = { rx: q.body.rotation.x, rz: q.body.rotation.z, y: q.body.position.y, leg: q.legL.rotation.x }; clearZ(); return r; };
const fr = poseAt('front', 1), bk = poseAt('back', 1), sd = poseAt('side', 1), kn1 = poseAt('knees', CONFIG.GORE.kneeTime * 0.45), kn2 = poseAt('knees', CONFIG.GORE.kneeTime);
check(fr.rx > 1.5 && bk.rx < -1.5 && Math.abs(sd.rz) > 1.5, 'de cara, de espalda y de costado');
check(kn1.y < -0.5 && kn1.leg > 1 && Math.abs(kn1.rx) < 0.01 && kn2.rx > 1.5, 'de rodillas y después de cara');
// la de rodillas tarda kneeTime en irse; las otras, deathTime
q = zAt(0, 6); G.damageZombie(q, 1e9, false); q.deathPose = 'knees';
for (let i = 0; i < Math.round((CONFIG.ZOMBIE.deathTime + 0.1) * 60); i++) { G.tick(dt); G.updateZombies(dt); }
const still = state.zombies.includes(q);
for (let i = 0; i < Math.round(CONFIG.GORE.kneeTime * 60); i++) { G.tick(dt); G.updateZombies(dt); }
check(still && !state.zombies.includes(q), 'de rodillas tarda ' + CONFIG.GORE.kneeTime + ' s en irse');

// 9) ataques y renguera
fresh(); clearZ();
q = zAt(0, 6);
const atks = new Set();
for (let i = 0; i < 60; i++) { q.swingT = 0.35; q.atk = null; G.animateZombie(q, dt, 1); atks.add(q.atk); q.swingT = 0; G.animateZombie(q, dt, 1); }
check(['swipe', 'lunge', 'bite'].every(a => atks.has(a)) && q.atk === null, '3 ataques: zarpazo, embestida y mordida', [...atks].join(' '));
q.gait = 'walk'; q.limp = 1;
let mL = 0, mR = 0;
for (let i = 0; i < 240; i++) { G.animateZombie(q, dt, 1.6); mL = Math.max(mL, Math.abs(q.legL.rotation.x)); mR = Math.max(mR, Math.abs(q.legR.rotation.x)); }
check(mR < mL * 0.6, 'renguera: la pierna derecha se arrastra', `(${mL.toFixed(2)} / ${mR.toFixed(2)})`);

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
