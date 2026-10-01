// V2 F5.26: la guarida de la Bestia. Tanda A: búnker grande, pilares, barriles de gasolina y la escalera rota
const G = require('./harness.js');
const { state, player, CONFIG, roundState } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, P = CONFIG.PLAYER, B = CONFIG.BUNKER, BE = CONFIG.BEAST;
CONFIG.POWERUPS.dropChance = 0;
function fresh() { G.resetGame(); state.running = true; state.round = 8; roundState.phase = 'active'; state.points = 50000; state.health = 100; G.debugOpenAllDoors(); }
function setPlayer(x, z, y) { player.pos.set(x, (y === undefined ? G.groundY(x, z) : y) + P.height, z); player.vel.set(0, 0, 0); G.updateFlowField(true); }

// 1) búnker grande
fresh();
check(B.x2 - B.x1 >= 44 && B.z2 - B.z1 >= 30 && B.h >= 7, 'el búnker mide 44×30 y 7 de alto', `(${B.x2 - B.x1}×${B.z2 - B.z1}×${B.h})`);
const R16 = G.ROOMS.find(r => r.id === 'R16');
check(R16.x1 === B.x1 && R16.x2 === B.x2 && R16.z1 === B.z1 && R16.z2 === B.z2, 'el cuarto R16 coincide con CONFIG.BUNKER');
check(G.groundY(B.x1 + 1, B.z2 - 1) === B.y && G.groundY(B.x2 - 1, B.z1 + 1) === B.y, 'las esquinas nuevas están bajo tierra');
// nada caminable de arriba pisa las x,z del búnker (salvo el propio R16)
let clash = null;
for (let x = B.x1 + 0.5; x < B.x2 && !clash; x += 1) for (let z = B.z1 + 0.5; z < B.z2; z += 1) {
  const r = G.ROOMS.find(q => q.id !== 'R16' && x >= q.x1 && x <= q.x2 && z >= q.z1 && z <= q.z2);
  if (r) { clash = r.id + ' en ' + x + ',' + z; break; }
}
check(!clash, 'ningún otro cuarto pisa las x,z del búnker', clash ? '(' + clash + ')' : '');
G.openBunker();
const reach = (x, z) => { setPlayer(B.ladder.out[0], B.ladder.out[1]); return G.flowAt(Math.floor(x), Math.floor(z)) >= 0; };
const cx1 = B.x1 + 1.5, cx2 = B.x2 - 1.5, cz1 = B.z1 + 1.5, cz2 = B.z2 - 1.5;
check(reach(cx1, cz2) && reach(cx2, cz1) && reach(cx2, cz2) && reach(cx1, cz1), 'desde la escalera se llega a las 4 esquinas');
// F5.26: nada del mundo de arriba (barco hundido, pilotes) se mete adentro del búnker
G.scene.updateMatrixWorld(true);
const T3 = G.sandbox.THREE;
const inside = new T3.Box3(new T3.Vector3(B.x1 + 0.3, B.y + 0.5, B.z1 + 0.3), new T3.Vector3(B.x2 - 0.3, B.y + B.h - 1.5, B.z2 - 0.3));
let intr = null; const v = new T3.Vector3();
G.scene.traverse(o => {
  if (intr || !o.isMesh || !o.geometry || !o.geometry.attributes.position || !o.userData.theme) return;
  const p = o.geometry.attributes.position, c = o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere);
  v.copy(c.center).applyMatrix4(o.matrixWorld);
  if (Math.hypot(v.x - (B.x1 + B.x2) / 2, v.z - (B.z1 + B.z2) / 2) < 25 && v.y > B.y) return;   // lo del propio búnker
  for (let i = 0; i < p.count; i += 7) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); if (inside.containsPoint(v)) { intr = `(${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})`; break; } }
});
check(!intr, 'nada de afuera se mete adentro del búnker', intr || '');
check(B.pillars.every(([x, z]) => !G.isNav(Math.floor(x), Math.floor(z))), 'los pilares son sólidos (bloquean su celda)');
const mule = CONFIG.PERKS.list.mule, baz = CONFIG.WALLBUYS.find(w => w.weapon === 'bazooka');
check(Math.abs(mule.x - B.x1) < 0.8 && Math.abs(baz.x - B.x2) < 0.1, 'Mule Kick y la bazooka contra las paredes nuevas');
check(Math.abs(B.teleporter.z - (B.z2 - 1.6)) < 0.01, 'el teletransportador contra la pared norte nueva');

// 2) barriles
fresh(); G.openBunker();
check(G.BEAST.barrels.length === BE.barrels.length && G.BEAST.barrels.every(b => b.col.solid && G.WORLD.hitMeshes.includes(b.mesh)), 'los barriles son sólidos y frenan balas', `(${G.BEAST.barrels.length})`);
// no cambian el grid: con y sin sus colliders, las mismas celdas
const cells0 = Array.from(G.NAV.cells);
G.BEAST.barrels.forEach(b => { b.col.solid = false; }); G.buildNavGrid();
const same = cells0.every((c, i) => c === G.NAV.cells[i]);
G.BEAST.barrels.forEach(b => { b.col.solid = true; }); G.buildNavGrid();
check(same, 'los barriles no cambian el grid (van en el anillo pegado a la pared)');
// un tiro al barril lo hace explotar y lastima al boss con una fracción de su vida
const b0 = G.BEAST.barrels[0];
const boss = G.BOSS.pool.find(q => q.variant === 'sombrero');
G.resetZombie(boss, { x: b0.x + 2.5, z: b0.z }, false); boss.state = 'walk'; state.zombies.push(boss);
const hp0 = boss.health;
setPlayer(b0.x + 10, b0.z);
G.scene.updateMatrixWorld(true);
const eye = new (player.pos.constructor)(player.pos.x, B.y + 0.5, b0.z), dir = new (player.pos.constructor)(-1, 0, 0);
G.traceShot(eye, dir, CONFIG.WEAPONS.m1911);
check(!b0.alive && !b0.col.solid && !G.WORLD.hitMeshes.includes(b0.mesh), 'un tiro lo hace explotar (deja de ser sólido y de frenar balas)');
const lost = hp0 - boss.health;
check(lost > boss.maxHealth * BE.barrel.bossFrac * 0.4 && lost <= boss.maxHealth * BE.barrel.bossFrac + 1, 'al boss le saca una parte de su vida máxima', `(${lost.toFixed(0)} de ${boss.maxHealth})`);
G.resetGame();
// en cadena: una explosión al lado prende el de al lado
fresh(); G.openBunker();
const [ba, bb] = [G.BEAST.barrels[4], G.BEAST.barrels[5]];     // pared sur: -38 y -12, lejos
G.blowBarrel(ba);
for (let i = 0; i < 30; i++) G.updateBeast(dt);
check(bb.alive, 'un barril lejos no explota por otro');
const near = G.BEAST.barrels[1];
G.explodeAt(near.x + 1, B.y + 0.5, near.z, { damage: 10, radius: 4, self: 0 });
for (let i = 0; i < 30; i++) G.updateBeast(dt);
check(!near.alive, 'una granada al lado lo prende (explota en cadena)');
state.health = 100; setPlayer(ba.x + 1.5, ba.z + 1.5);
G.resetBarrels(); G.blowBarrel(ba);
check(state.health < 100, 'de cerca lastima al jugador', `(vida ${state.health})`);
G.resetGame();
check(G.BEAST.barrels.every(b => b.alive && b.col.solid && G.WORLD.hitMeshes.includes(b.mesh) && b.g.visible), 'resetGame: vuelven todos los barriles');

// 3) escalera rota
fresh(); G.openBunker();
check(G.NAV.hatch !== null, 'con la escalera sana, los zombies cruzan por la escotilla');
setPlayer(B.ladder.out[0], B.ladder.out[1]);
const tUp = G.hatchNear(G.roomAt(player.pos.x, player.pos.z), player.pos.x, player.pos.z, 3);
check(tUp && /Climb up/.test(G.hatchPrompt(tUp.target).text), 'abajo, el cartel dice subir');
G.breakLadder();
check(G.ladderBroken() && G.NAV.hatch === null && !G.BEAST.ladder.visible && G.BEAST.debris.visible, 'rota: sin enlace para los zombies, y los pedazos en el piso');
check(/Rebuild/.test(G.hatchPrompt(tUp.target).text), 'el cartel dice reconstruirla');
const y0 = player.pos.y;
G.useHatch(tUp.target);
check(G.BUNK.fadeT === 0, 'con F no se sube');
// mantener F arma la escalera en rebuild s; soltar antes corta
G.interactState.kind = 'hatch'; G.interactState.target = tUp.target; G.keys.KeyF = true;
for (let i = 0; i < Math.round(BE.ladder.rebuild * 0.5 * 60); i++) G.updateBeast(dt);
G.keys.KeyF = false; G.updateBeast(dt);
check(G.ladderBroken() && G.BEAST.buildT === 0, 'soltar F a la mitad corta el arreglo');
G.keys.KeyF = true;
for (let i = 0; i < Math.round((BE.ladder.rebuild + 0.2) * 60); i++) G.updateBeast(dt);
G.keys.KeyF = false;
check(!G.ladderBroken() && G.NAV.hatch !== null && G.BEAST.ladder.visible, 'manteniendo F se arregla y vuelve el enlace');
G.breakLadder(); G.resetGame();
check(!G.ladderBroken() && G.BEAST.ladder.visible, 'resetGame: la escalera sana');

// 4) la Bestia (tanda B)
const BC = CONFIG.BEAST, L = BC.lair;
function run(secs, f) { for (let i = 0; i < Math.round(secs * 60); i++) { G.tick(dt); G.updatePlayer(dt); G.updateZombies(dt); G.updateBeast(dt); G.updateAcid(dt); if (f && f()) return true; } return false; }
fresh(); G.openBunker();
const Z = G.BEAST.z;
check(Z && G.BEAST.phase === 'sleep' && Z.root.visible && !state.zombies.includes(Z), 'duerme en su esquina, fuera de la ronda');
check(G.WORLD.hitMeshes.includes(G.BEAST.sleepBox), 'dormida tiene una caja de tiro');
// la ronda termina aunque esté dormida
state.zombies.length = 0; roundState.spawned = roundState.total = 0; roundState.bossPending = false;
check(!state.zombies.some(q => q.variant === 'bestia'), 'dormida no frena el fin de la ronda');
// despierta al acercarte
setPlayer(L.x - BC.wakeDist - 2, L.z); run(0.5);
check(G.BEAST.phase === 'sleep', 'a más de wakeDist sigue durmiendo');
setPlayer(L.x - BC.wakeDist + 1.5, L.z); run(0.2);
check(G.BEAST.phase === 'awake' && state.zombies.includes(Z) && Z.alive, 'al acercarte se despierta y entra a la pelea');
check(Z.maxHealth >= CONFIG.BOSS.health(BC.minRound) * BC.healthMul - 1, 'vida de boss grande', `(${Z.maxHealth})`);
check(!G.WORLD.hitMeshes.includes(G.BEAST.sleepBox), 'la caja de dormida ya no frena balas');
// lo primero: corre a la escalera y la rompe (vos lejos, en la otra punta)
state.health = 9999;
setPlayer(B.x2 - 2, B.z2 - 2);
const broke = run(20, () => G.ladderBroken());
check(broke, 'corre a la escalera y la arranca', `(en ${Z.act || '-'}, a ${Math.hypot(Z.px - B.ladder.x, Z.pz - B.ladder.z).toFixed(1)} m)`);
check(G.BEAST.debris.visible && G.NAV.hatch === null, 'quedan los pedazos y los zombies no cruzan');
// de un tiro también se despierta
fresh(); G.openBunker();
setPlayer(L.x - 14, L.z); G.scene.updateMatrixWorld(true);
const e2 = new (player.pos.constructor)(player.pos.x, B.y + 0.7, L.z), d2 = new (player.pos.constructor)(1, 0, 0);
G.traceShot(e2, d2, CONFIG.WEAPONS.m1911);
check(G.BEAST.phase === 'awake', 'un tiro a la dormida la despierta');
// velocidad: más que caminando, nunca más que 5.0
run(12, () => G.ladderBroken() && !Z.act);
Z.screamT = Z.pounceT = Z.spitT = Z.tentT = Z.whipT = Z.spikeT = 99;
let vmax = 0, lx = Z.px, lz = Z.pz;
setPlayer(B.x1 + 3, B.z2 - 3);
run(3, () => { const v = Math.hypot(Z.px - lx, Z.pz - lz) / dt; lx = Z.px; lz = Z.pz; if (!Z.act) vmax = Math.max(vmax, v); return false; });
check(vmax > P.speed && vmax <= BC.speed * 1.26, 'corre más que vos caminando y no más de 5 (×1.25 de empujones)', `(${vmax.toFixed(2)} m/s)`);
// zarpazo: pega fuerte y te lanza
fresh(); G.openBunker(); G.wakeBeast(); G.breakLadder();
Z.act = null; Z.px = -16; Z.pz = -80; Z.attackCd = 0; Z.screamT = Z.pounceT = Z.spitT = Z.tentT = Z.whipT = Z.spikeT = 99;
setPlayer(-16, -78.2); state.health = 250; state.lastDamageTime = -99;
const x0 = player.pos.x, z0 = player.pos.z;
let flew = 0;
run(1.5, () => { flew = Math.max(flew, player.pos.y - (B.y + P.height)); return false; });
check(state.health <= 250 - BC.claw.damage, 'el zarpazo pega fuerte', `(vida ${state.health})`);
check(Math.hypot(player.pos.x - x0, player.pos.z - z0) > BC.claw.fly * 0.5 && flew > 1, 'y te lanza por el aire', `(${Math.hypot(player.pos.x - x0, player.pos.z - z0).toFixed(1)} m, ${flew.toFixed(1)} m de alto)`);
// grito: aturde de cerca
fresh(); G.openBunker(); G.wakeBeast(); G.breakLadder();
Z.act = null; Z.px = -16; Z.pz = -80; Z.attackCd = 99; Z.pounceT = Z.spitT = Z.tentT = Z.whipT = Z.spikeT = 99; Z.screamT = 0;
setPlayer(-16, -75); state.health = 9999;
run(1.5);
check(player.dazeT > 0 || G.BEAST.z.act === null, 'el grito te aturde', `(daze ${player.dazeT.toFixed(2)})`);
// salto desde lejos
fresh(); G.openBunker(); G.wakeBeast(); G.breakLadder();
Z.act = null; Z.px = -20; Z.pz = -80; Z.attackCd = 99; Z.screamT = Z.spitT = Z.tentT = Z.whipT = Z.spikeT = 99; Z.pounceT = 0;
setPlayer(-9, -80); state.health = 9999;
let pounced = false;
run(2, () => { if (Z.act === 'pounce') pounced = true; return false; });
check(pounced && Math.hypot(Z.px + 9, Z.pz + 80) < 6, 'de lejos te salta encima', `(quedó a ${Math.hypot(Z.px + 9, Z.pz + 80).toFixed(1)} m)`);
// slime negro: deja charcos que frenan
fresh(); G.openBunker(); G.wakeBeast(); G.breakLadder();
Z.act = null; Z.slimeT = 0; Z.screamT = Z.pounceT = Z.spitT = Z.tentT = Z.whipT = Z.spikeT = 99; Z.attackCd = 99;
setPlayer(Z.px - 12, Z.pz);
run(0.05);
const blk = G.ACID.puddles.find(p => p.life > 0 && p.purple === 'black');
check(!!blk, 'deja charcos de slime negro');
setPlayer(blk.x, blk.z); G.updateAcid(dt);
check(G.wetSandMul(blk.x, blk.z) === BC.slime.slow, 'parado en el slime te frena', `(×${G.wetSandMul(blk.x, blk.z)})`);
// F5.28: el tentáculo te agarra, te arrastra y te traga; te soltás con tiros o cuchillazos
const TG = BC.tentacle, calm = () => { Z.screamT = Z.pounceT = Z.spitT = Z.whipT = Z.spikeT = Z.slimeT = 99; Z.attackCd = 99; };
function grabbed(secs) { return run(secs, () => G.beastGrabbed()); }
fresh(); G.openBunker(); G.wakeBeast(); G.breakLadder(); G.resetAcid && G.resetAcid();
Z.act = null; Z.px = -16; Z.pz = -80; calm(); Z.tentT = 0; Z.speed = 0;
setPlayer(-16, -70); state.health = 9999;
check(grabbed(3), 'el tentáculo te agarra (con aviso)', `(${G.BEAST.tg.state})`);
const dg0 = Math.hypot(player.pos.x - Z.px, player.pos.z - Z.pz);
run(0.6);
check(Math.hypot(player.pos.x - Z.px, player.pos.z - Z.pz) < dg0 - 1 && player.pos.y > B.y + P.height + 0.3, 'te arrastra hacia la boca y te levanta');
const hitPt = new (player.pos.constructor)();
for (let i = 0; i < TG.shots - 1; i++) G.beastTentacleShot(hitPt.copy(player.pos));
check(G.beastGrabbed(), 'con ' + (TG.shots - 1) + ' tiros todavía te tiene (más duro que la lengua)');
G.beastTentacleShot(hitPt.copy(player.pos));
check(!G.beastGrabbed() && G.BEAST.tg.state === 'back', TG.shots + ' tiros al tentáculo te sueltan');
run(1.5);
check(Z.act !== 'tentacle' && G.BEAST.tg.state === 'off', 'el tentáculo vuelve y la Bestia sigue');
// con el cuchillo mirando hacia ella (partida nueva: con el zarpazo largo y más daño, el tramo anterior te pudo matar)
fresh(); G.openBunker(); G.wakeBeast(); G.breakLadder();
Z.act = null; Z.px = -16; Z.pz = -80; calm(); Z.tentT = 0; Z.speed = 0;
// (al soltarte cerca, el zarpazo te pudo lanzar: sin ese empujón)
setPlayer(-16, -70); player.pushT = 0;
check(grabbed(3), 'te vuelve a agarrar', `(${G.BEAST.tg.state})`);
const toward = new (player.pos.constructor)(Z.px - player.pos.x, 0, Z.pz - player.pos.z).normalize();
for (let i = 0; i < TG.stabs - 1; i++) G.beastTentacleStab(toward);
check(G.beastGrabbed(), (TG.stabs - 1) + ' cuchillazos no alcanzan', `(${G.BEAST.tg.state}, ${Z.act})`);
G.beastTentacleStab(toward);
check(!G.beastGrabbed(), TG.stabs + ' cuchillazos mirándola te sueltan');
run(1.5);
// si no te soltás, te traga (partida nueva: con el alcance largo, el zarpazo del tramo anterior te pudo matar)
fresh(); G.openBunker(); G.wakeBeast(); G.breakLadder();
Z.act = null; Z.px = -16; Z.pz = -80; calm(); Z.tentT = 0; Z.speed = 0;
setPlayer(-16, -72); player.pushT = 0; state.health = 250; state.perks = [];
grabbed(3);
let swallowed = false;
run(12, () => { if (G.BEAST.tg.state === 'swallow') swallowed = true; return state.gameOver; });
check(swallowed && state.gameOver, 'si no te soltás, llegás al cráneo y te traga');
// si te corrés de costado cuando sale, no te agarra
fresh(); G.openBunker(); G.wakeBeast(); G.breakLadder();
Z.act = null; Z.px = -16; Z.pz = -80; calm(); Z.tentT = 0; Z.speed = 0;
setPlayer(-16, -68); state.health = 9999;
run(3, () => G.BEAST.tg.state === 'shoot');
setPlayer(-19.5, -68);
check(!grabbed(1.2), 'si te corrés cuando sale, no te agarra');
// latigazo de cerca: pega y te tira de costado
fresh(); G.openBunker(); G.wakeBeast(); G.breakLadder();
Z.act = null; Z.px = -16; Z.pz = -80; calm(); Z.tentT = 99; Z.attackCd = 0; Z.whipT = 0; Z.speed = 0;
setPlayer(-16, -77); state.health = 100; state.lastDamageTime = -99;
const wx0 = player.pos.x, hw0 = state.health;
let whipped = false;
run(1.2, () => { if (Z.act === 'whip') whipped = true; return false; });
check(whipped && hw0 - state.health >= BC.whip.damage - 1, 'latigazo de cerca: pega', `(${(hw0 - state.health).toFixed(0)})`);
check(Math.abs(player.pos.x - wx0) > 1.5, 'y te tira de costado', `(${(player.pos.x - wx0).toFixed(1)} m)`);
// tentáculos del piso: debajo tuyo y alrededor, con aviso
fresh(); G.openBunker(); G.wakeBeast(); G.breakLadder();
Z.act = null; Z.px = -16; Z.pz = -80; calm(); Z.tentT = 99; Z.spikeT = 0; Z.speed = 0;
setPlayer(-10, -70); state.health = 9999; state.lastDamageTime = -99;
run(0.5);
const sp = G.BEAST.spikes.filter(r => r.state !== 'off');
check(sp.length >= 2 && sp.some(r => Math.hypot(r.x - player.pos.x, r.z - player.pos.z) < 1), 'tentáculos del piso: uno debajo tuyo y otros alrededor', `(${sp.length})`);
const hs0 = state.health;
run(0.3);
check(state.health === hs0, 'durante el aviso no pegan');
run(0.6);
check(state.health < hs0, 'si te quedás, salen y pegan', `(${(hs0 - state.health).toFixed(0)})`);
// muerte: una sola por partida, vuelven los barriles
fresh(); G.openBunker(); G.wakeBeast(); G.breakLadder();
G.blowBarrel(G.BEAST.barrels[0]);
G.damageZombie(Z, Z.health + 10, false);
check(!Z.alive && G.BEAST.phase === 'dead' && G.BEAST.barrels.every(b => b.alive), 'al morir no vuelve y reaparecen los barriles');
run(0.5);
check(G.BEAST.phase === 'dead' && !state.zombies.some(q => q.variant === 'bestia' && q.alive), 'muerta, no vuelve a despertar');
G.resetGame();
check(G.BEAST.phase === 'sleep' && G.WORLD.hitMeshes.includes(G.BEAST.sleepBox), 'resetGame: otra vez dormida en su esquina');

// 5) crías (tanda C)
const CC = BC.crias;
fresh(); G.openBunker(); G.wakeBeast(); G.breakLadder();
Z.act = null; Z.px = -16; Z.pz = -80; Z.attackCd = 99; Z.pounceT = Z.spitT = Z.slimeT = Z.tentT = Z.whipT = Z.spikeT = 99;
setPlayer(-10, -70);
const nS = G.beastSummon(Z);
const crias = state.zombies.filter(q => q.cria);
check(nS === CC.per && crias.length === CC.per && crias.every(q => q.dog && q.alive), 'al gritar salen crías (son perros para la IA)', `(${nS})`);
G.beastSummon(Z); G.beastSummon(Z);
check(state.zombies.filter(q => q.cria && q.alive).length === CC.max, 'nunca más de max vivas', `(${state.zombies.filter(q => q.cria && q.alive).length})`);
check(crias.every(q => q.speed > P.speed && q.speed <= CONFIG.DOGS.speed + 1e-9), 'corren como los perros (más que vos caminando, nunca más que DOGS.speed)', `(${crias.map(q => q.speed.toFixed(2)).join(' ')})`);
check(crias.every(q => q.root.scale.x === 1 && q.fromClam), 'tamaño de cría y extra de la ronda');
// te persiguen
setPlayer(-30, -66); state.health = 9999;
Z.px = 4; Z.pz = -88; Z.speed = 0;
const d0 = Math.min(...crias.map(q => Math.hypot(q.px - player.pos.x, q.pz - player.pos.z)));
run(4);                                                             // (2 s saliendo del piso y 2 corriendo)
const d1 = Math.min(...crias.map(q => Math.hypot(q.px - player.pos.x, q.pz - player.pos.z)));
check(d1 < d0 - 6, 'te persiguen', `(${d0.toFixed(1)} -> ${d1.toFixed(1)} m)`);
// la ronda no termina con crías vivas
check(state.zombies.some(q => q.cria && q.alive), 'con crías vivas la ronda sigue');
G.resetGame();
check(!state.zombies.length && G.CRIAS.every(q => !q.active), 'resetGame: sin crías');

// 6) trofeos (tanda D) y la tienda ITEMS (F5.28)
const TR = CONFIG.TROPHIES;
fresh();
G.DEV.on = false;
G.PROFILE.bossKills = {};
const ink0 = G.PROFILE.ink, xp0 = G.PROFILE.xp;
const origRand = Math.random;
Math.random = () => 0.99;                                           // sin el raro
const got = G.bossTrophies('sombrero', -10, 24, 0);
Math.random = origRand;
check(got.length === 1 && got[0] === 'brim' && G.PROFILE.bossKills.sombrero === 1, 'el Sombrerón suelta su trofeo común y suma a la cuenta');
Math.random = () => 0.01;
const got2 = G.bossTrophies('bestia', -10, 26, 0);
Math.random = origRand;
check(got2.join() === 'claw,gland', 'con suerte, también el raro (la Bestia: garra y glándula)');
check(G.TROPH.drops.filter(d => d.id).length === 3, 'quedan flotando en el piso');
G.PROFILE.trophies = {}; G.PROFILE.items = {}; G.PROFILE.itemEquip = null;
setPlayer(-10, 24); G.updateTrophies(dt);
setPlayer(-10, 26); G.updateTrophies(dt);
setPlayer(-8.8, 26.6); G.updateTrophies(dt);
check(G.PROFILE.trophies.brim === 1 && G.PROFILE.trophies.claw === 1 && G.PROFILE.trophies.gland === 1, 'F5.28: se agarran pasando cerca y van al perfil');
check(G.PROFILE.ink >= ink0 + 3 * TR.ink && G.PROFILE.xp >= xp0 + 3 * TR.xp, 'cada trofeo da KRAKEN INK y XP');
// F5.28: sin el Altar; la tienda ITEMS cambia trofeos por ítems del perfil
check(!TR.altar && !G.WORLD.colliders.some(c => c.tag === 'trophy:altar'), 'F5.28: no hay Altar de Huesos');
// F5.28f: cada ítem se ve (y se compra) desde su nivel de cuenta: las garras, desde el 75
const xpKeep = G.PROFILE.xp;
check(!G.canBuyItem('claws') || G.rankLevel() >= CONFIG.TROPHIES.recipes.find(r => r.id === 'claws').level, 'F5.28f: antes de su nivel no se compra');
G.PROFILE.xp = Math.max(G.PROFILE.xp, G.xpForLevel(100));
check(G.canBuyItem('claws') && !G.canBuyItem('talisman'), 'la tienda: alcanza para las garras (garra + ala), no para el talismán');
check(G.buyItem('claws') && G.PROFILE.items.claws === 1 && !G.PROFILE.trophies.brim && !G.PROFILE.trophies.claw, 'comprar gasta los trofeos y suma el ítem al perfil');
check(!G.buyItem('claws'), 'sin trofeos no se compra otro');
check(!G.equipItem('armor') && G.equipItem('claws') && G.PROFILE.itemEquip === 'claws', 'se equipa uno que tenés (el que no tenés, no)');
G.renderItemsPanel();
check(/BEAST CLAWS/.test(G.UI.panelItems.innerHTML) && /UNEQUIP/.test(G.UI.panelItems.innerHTML), 'el panel ITEMS lo muestra equipado');
G.PROFILE.xp = xpKeep;
G.renderItemsPanel();
check(!/BEAST CLAWS/.test(G.UI.panelItems.innerHTML) || G.rankLevel() >= 75, 'F5.28f: por debajo de su nivel, el panel no lo muestra (sale "?")');
// en la partida: aparece desde el inicio en su lugar y se agarra (ahí se gasta)
G.MENU.started = false; G.resetGame();
const spot = G.itemSpot('claws');
check(G.TROPH.item.id === 'claws' && G.TROPH.item.g.visible && G.roomAt(spot.x, spot.z).id === TR.spots.claws, 'al empezar, el ítem equipado espera en su lugar (garras: el búnker)');
state.running = true;
setPlayer(spot.x, spot.z); G.updateTrophies(dt);
check(G.TROPH.claws && G.meleeDef().damage === TR.claws.damage && !G.TROPH.item.id && !G.PROFILE.items.claws && !G.PROFILE.itemEquip, 'al agarrarlo: garras (900) y se gasta del perfil');
G.resetGame();
check(!G.TROPH.item.id && !G.TROPH.item.g.visible, 'sin stock, la partida siguiente no aparece');
// talismán: +1 perk
G.applyItem(G.itemDef('talisman'));
check(G.perkMax() === CONFIG.PERKS.max + 1, 'el talismán da un perk más');
// armadura: se come el 25% de cada golpe hasta romperse
G.applyItem(G.itemDef('armor'));
check(Math.abs(G.armorAbsorb(100) - 75) < 1e-6, 'la armadura se come el 25%');
G.TROPH.armor = 5; G.armorAbsorb(100);
check(G.TROPH.armor === 0, 'y se rompe');
// bomba de slime: quema zombies, no a vos
G.TROPH.slime = 1;
G.startRound(5);
const zz = G.ZPOOL.find(q => !q.active);
G.resetZombie(zz, { x: -10, z: 22 }, false); zz.state = 'walk'; state.zombies.push(zz);
const hz = zz.health;
setPlayer(-10, 22.5); state.health = 100;
G.slimeZone(-10, 22, 0);
for (let i = 0; i < 60; i++) G.updateTrophies(dt);
check(zz.health < hz || !zz.alive, 'el slime de la bomba quema a los zombies');
check(state.health === 100, 'y a vos no');
// la cría domesticada: pelea de tu lado 2 rondas
G.applyItem(G.itemDef('pet'));
const pet = G.TROPH.pet;
check(pet && pet.z.root.visible && !state.zombies.includes(pet.z), 'aparece la cría de tu lado (no es un enemigo)');
G.resetZombie(zz, { x: -7, z: 22.5 }, false); zz.state = 'walk'; if (!state.zombies.includes(zz)) state.zombies.push(zz);
const h2 = zz.health;
for (let i = 0; i < 180; i++) { G.tick(dt); G.updateTrophies(dt); }
check(zz.health < h2 || !zz.alive, 'y ataca a los zombies', `(${h2.toFixed(0)} -> ${zz.health.toFixed(0)})`);
G.trophiesRound(); G.trophiesRound();
check(!pet.z.root.visible, 'a las 2 rondas se va');
// camos de boss: la cuenta los desbloquea
check(G.camoUnlocked('hide') && !G.camoUnlocked('charro'), 'BEAST HIDE con 1 Bestia; CHARRO pide 5 Sombrerones');
G.resetGame();
check(!G.TROPH.claws && !G.TROPH.talisman && G.TROPH.armor === 0 && !G.TROPH.drops.some(d => d.id) && G.perkMax() === CONFIG.PERKS.max, 'resetGame: sin trofeos ni recetas (la cuenta queda)');
check(G.PROFILE.bossKills.bestia === 1, 'la cuenta guarda las kills de boss');

// 7) F5.27: el pase hasta el nivel 100 (solo XP doble, camos y KRAKEN INK)
{ const PR = CONFIG.PROGRESSION, PS = PR.pass;
  check(PR.maxLevel === 100 && G.levelOf(1e12) === 100, 'se llega al nivel 100');
  check(G.xpForLevel(100) - G.xpForLevel(99) === PR.xpCap && G.xpForLevel(44) - G.xpForLevel(43) === PR.base + PR.step * 42, 'la XP por nivel tiene tope (los niveles de antes no cambian)');
  // F5.28d: 1 tinta cada 3 niveles (del 1 al 100); el 100 da ink100
  let every3 = true, only = true;
  for (let L = 1; L < 100; L++) { const r = G.passRewards(L).find(q => q.type === 'ink'); if (!!r !== (L % 3 === 0) || (r && r.n !== 1)) every3 = false; }
  for (let L = 1; L <= 100; L++) if (G.passRewards(L).some(r => r.type !== 'ink' && r.type !== 'camo' && r.type !== 'xp2')) only = false;
  check(every3 && PR.levelUp.inkEvery === 3, 'KRAKEN INK: 1 cada 3 niveles, nada más');
  check(only, 'el pase da solo XP doble, camos y KRAKEN INK');
  check(G.passRewards(100).find(r => r.type === 'ink').n === PS.ink100 && G.passRewards(100).some(r => r.type === 'camo' && r.id === 'kraken'),
        'el 100 da ' + PS.ink100 + ' de tinta y el camo KRAKEN');
  check(CONFIG.GUMS.inkChance === 0.03, 'comprando, la tinta cae con 3%');
  // una cuenta de antes en el nivel 43 cobra la tinta del 40 al 43 (una sola vez)
  G.ACCOUNTS.list.TEST43 = { xp: G.xpForLevel(43) + 10, loadout: {}, ink: 5, gums: {}, preset: [], wxp: {} };
  G.useAccount('TEST43');
  const want = [40, 41, 42, 43].reduce((a, L) => a + G.passRewards(L).filter(r => r.type === 'ink').reduce((b, r) => b + r.n, 0), 5);
  check(G.PROFILE.ink === want && G.PROFILE.passClaimed === 43, 'una cuenta de nivel 43 recibe la tinta del 40 al 43', `(${G.PROFILE.ink} de ${want})`);
  G.useAccount('TEST43');
  check(G.PROFILE.ink === want, 'y no la cobra dos veces');
  // la ficha de XP doble: se gasta sola con la primera XP de la partida y duplica toda la partida
  G.PROFILE.xp2 = 1; G.resetMatchXP();
  const xpa = G.PROFILE.xp; G.addXP(100); G.addXP(50);
  check(G.PROFILE.xp - xpa === 300 && G.PROFILE.xp2 === 0 && G.PROFILE.xp2On, 'la ficha de XP doble duplica la partida (y se gasta)', `(+${G.PROFILE.xp - xpa})`);
  G.resetMatchXP(); const xpb = G.PROFILE.xp; G.addXP(100);
  check(G.PROFILE.xp - xpb === 100, 'en la partida siguiente, normal');
  const html = G.passTrackHTML(43);
  check((html.match(/class="ptile/g) || []).length === 100 && /ptile done cur/.test(html) && /KRAKEN/.test(html), 'el perfil muestra el pase: 100 casillas, la tuya marcada');
  delete G.ACCOUNTS.list.TEST43; }

// 8) F5.28b: búnker oscuro con antorchas y la Bestia pulpo
{ fresh(); G.openBunker();
  // F5.28c: sin antorchas ni interruptor: a oscuras siempre
  check(B.dark.zd > 1 && B.dark.paint < 0.1 && !B.torches, 'el búnker es muy oscuro y no tiene luces que se prendan');
  let offers = new Set();
  for (let x = B.x1 + 1; x < B.x2; x += 1.5) for (let z = B.z1 + 1; z < B.z2; z += 1.5) {
    if (!G.isNav(Math.floor(x), Math.floor(z))) continue;
    setPlayer(x, z); G.updateInteract(); offers.add(G.interactState.kind);
  }
  check(!offers.has('torches') && !offers.has('lantern'), 'en el búnker F no ofrece prender nada', `(${[...offers].join(',')})`);
  // los faroles de la casa: F prende la lámpara y no da puntos (un comentario había cortado la línea)
  G.resetGame(); state.running = true; state.round = 3; roundState.phase = 'active'; state.points = 500;
  let lanternAt = null;
  for (const T of G.LANTERNS.list) {
    for (let dx = -1.5; dx <= 1.5 && !lanternAt; dx += 0.5) for (let dz = -1.5; dz <= 1.5 && !lanternAt; dz += 0.5) {
      if (!G.isNav(Math.floor(T.x + dx), Math.floor(T.z + dz))) continue;
      setPlayer(T.x + dx, T.z + dz); G.updateInteract();
      if (G.interactState.kind === 'lantern') lanternAt = T;
    }
    if (lanternAt) break;
  }
  check(!!lanternAt, 'al lado de un farol de la casa, F ofrece prenderlo', `(${G.LANTERNS.list.length} faroles)`);
  const pts0 = state.points, ok = G.interact();
  check(ok && lanternAt && lanternAt.lamp.litT > 0, 'con F se prende', `(${ok})`);
  check(state.points <= pts0, 'prenderlo no da puntos', `(${pts0} → ${state.points})`);
  for (let i = 0; i < 5; i++) G.interact();
  check(state.points <= pts0, 'apretar F varias veces tampoco', `(${state.points})`);
  G.resetGame();
  // la Bestia: grande y reptando
  fresh(); G.openBunker();
  const bz = G.BEAST.z;
  check(Math.abs(bz.root.scale.x - BE.scale) < 1e-6 && BE.scale >= 1.3, 'la Bestia es más grande', `(×${bz.root.scale.x})`);
  G.scene.updateMatrixWorld(true);
  const torsoY = () => new T3.Vector3().setFromMatrixPosition(bz.hitParts[1].matrixWorld).y - bz.root.position.y;
  check(torsoY() < 1.2, 'dormida: la carne apoyada en el piso', `(${torsoY().toFixed(2)})`);
  bz.walkT = 0; bz.act = null; bz.actT0 = 0;
  G.animateBeast(bz, dt, 5); G.scene.updateMatrixWorld(true);
  const tipY = g => { const b = new T3.Box3().setFromObject(g); return b.min.y; };
  const low = bz.tents.filter(g => tipY(g) - bz.root.position.y < 0.6).length;
  check(low >= 5, 'reptando: los tentáculos tocan el piso', `(${low} de ${bz.tents.length})`);
  check(torsoY() < 2.2, 'reptando: el cuerpo va bajo (no parada en patas)', `(${torsoY().toFixed(2)})`);
  const spread = new T3.Box3().setFromObject(bz.root);
  check(spread.max.x - spread.min.x > 4 && spread.max.z - spread.min.z > 4, 'los tentáculos van abiertos alrededor', `(${(spread.max.x - spread.min.x).toFixed(1)} × ${(spread.max.z - spread.min.z).toFixed(1)})`);
  const r0 = bz.tents.map(g => g.rotation.x);
  for (let i = 0; i < 20; i++) G.animateBeast(bz, dt, 5);
  check(bz.tents.some((g, i) => Math.abs(g.rotation.x - r0[i]) > 0.05), 'los tentáculos se mueven en ola');
  const m = G.beastMouth();
  check(m.y - bz.root.position.y > 1.5 && m.y - bz.root.position.y < 4.5, 'la boca queda a la altura del cráneo', `(${(m.y - bz.root.position.y).toFixed(2)})`);
  // F5.28c: sin luz propia (solo los ojos); tentáculos ×2, el ojo colgando, la sangre de la boca y el vuelo
  let glow = 0;
  bz.root.traverse(o => { const ms = o.material ? [].concat(o.material) : []; for (const mt of ms) if (mt.emissive && mt.emissive.getHex() !== 0) glow++; });
  check(glow === 0, 'la Bestia no brilla en la oscuridad', `(${glow} materiales con luz propia)`);
  check(spread.max.x - spread.min.x > 9, 'los tentáculos son largos (el doble)', `(${(spread.max.x - spread.min.x).toFixed(1)} m de punta a punta)`);
  const e0 = bz.eyeHang.rotation.x;
  check(!!bz.eyeHang && bz.eyeHang.parent === bz.head, 'tiene un ojo colgando de la cabeza');
  G.clock.elapsedTime += 0.7; G.animateBeast(bz, dt, 5);
  check(Math.abs(bz.eyeHang.rotation.x - e0) > 0.01, 'el ojo se balancea');
  G.wakeBeast(); G.BEAST.phase = 'awake'; bz.alive = true;
  for (let i = 0; i < 90; i++) { G.scene.updateMatrixWorld(true); G.updateBeastDrool(dt); }
  const on = G.BEAST.drool.list.filter(d => d.on), landed = on.filter(d => d.land > 0);
  check(on.length >= 6 && landed.length >= 1 && landed.every(d => Math.abs(d.y - B.y) < 0.05), 'le chorrea sangre de la boca y las gotas quedan en el piso', `(${on.length} gotas, ${landed.length} en el piso)`);
  G.resetGame();
  check(G.BEAST.drool.list.every(d => !d.on) && G.BEAST.drool.m.count === 0, 'el reset limpia la sangre');
  // el zarpazo te saca volando y la caída no lastima (el daño es el del golpe)
  fresh(); G.openBunker();
  setPlayer(-20, -70); state.health = 100; player.grounded = true;
  G.beastLaunch(1, 0, BE.claw.fly, BE.claw.up, BE.claw.flyTime);
  const x0 = player.pos.x; let top = 0;
  for (let i = 0; i < 150; i++) { G.tick(dt); G.updatePlayer(dt); top =Math.max(top, player.pos.y - P.height - B.y); }
  check(player.pos.x - x0 > BE.claw.fly * 0.7 && top > 1.5, 'el zarpazo te lanza lejos y alto', `(${(player.pos.x - x0).toFixed(1)} m, ${top.toFixed(1)} m de alto)`);
  check(state.health === 100, 'la caída del vuelo no lastima', `(${state.health})`);
  G.resetGame(); }

// 9) F5.28d: 10 chicles nuevos, tormenta del templo y el tambor 3D
{ const GL = CONFIG.GUMS.list;
  const classic = ['nighteyes', 'deadaim', 'scavenger', 'halfperk', 'sticky'], ink = ['bonearmor', 'ammofountain', 'wonderbar', 'killingtime', 'krakenwrath'];
  check(classic.every((id, i) => GL[id] && GL[id].rarity === 'classic' && GL[id].level === [22, 28, 34, 40, 46][i]), '5 clásicos nuevos (niveles 22, 28, 34, 40, 46)');
  check(ink.every(id => GL[id] && GL[id].rarity !== 'classic'), '5 nuevos de KRAKEN INK', `(${ink.map(id => GL[id] && GL[id].rarity).join(',')})`);
  const mk = (x, z) => { const q = G.ZPOOL.find(o => !o.active); G.resetZombie(q, { x, z }, false); q.px = x; q.pz = z; q.state = 'walk'; state.zombies.push(q); return q; };
  const P0 = [0, -14];
  // NIGHT EYES: la oscuridad de la zona baja y la pantalla va en verde
  fresh(); G.openBunker(); setPlayer(-20, -75);
  for (let i = 0; i < 400; i++) G.updateNight(dt);
  const zdDark = G.NIGHT.zd;
  G.activateGum('nighteyes');
  for (let i = 0; i < 400; i++) G.updateNight(dt);
  check(zdDark > 1.5 && G.NIGHT.zd < zdDark * 0.3, 'NIGHT EYES: el búnker se ve (oscuridad ' + zdDark.toFixed(2) + ' → ' + G.NIGHT.zd.toFixed(2) + ')');
  check(/hue-rotate\(55deg\)/.test(G.gfxFilter()), 'NIGHT EYES: visión nocturna verde');
  // DEAD AIM
  fresh(); setPlayer(P0[0], P0[1]);
  let z = mk(3, -14); z.health = z.maxHealth = 1000;
  G.damageZombie(z, 100, true, undefined, 0);
  const plain = 1000 - z.health;
  G.activateGum('deadaim'); G.damageZombie(z, 100, true, undefined, 0);
  check(plain === 100 && 1000 - plain - z.health === 200, 'DEAD AIM: el headshot hace el doble', `(${plain} → ${1000 - plain - z.health})`);
  // SCAVENGER
  const s = G.curSlot(); s.mag = 3;
  G.activateGum('scavenger'); G.damageZombie(z, z.health + 1, false);
  check(s.mag === 3 + GL.scavenger.bullets, 'SCAVENGER: el kill devuelve balas al cargador', `(${s.mag})`);
  // HALF-PRICE PERK
  fresh(); state.power = true; state.points = 10000;
  const full = CONFIG.PERKS.list.jugg.cost;
  G.activateGum('halfperk');
  check(G.perkStatus('jugg').cost === Math.round(full * GL.halfperk.mul), 'HALF-PRICE PERK: el cartel muestra la mitad');
  const p0 = state.points; G.buyPerk('jugg');
  check(p0 - state.points === Math.round(full * GL.halfperk.mul) && !G.gumActive('halfperk'), 'y cobra la mitad una sola vez');
  check(G.perkStatus('speed').cost === CONFIG.PERKS.list.speed.cost, 'el siguiente perk, a precio normal');
  // STICKY FINGERS
  fresh(); setPlayer(P0[0], P0[1]);
  G.trySpawnPickup(P0[0] + 6, P0[1], 'doublepoints');
  const pk = G.PICKUPS.pool.find(p => p.active);
  G.updatePickups(dt);
  const before = !!(pk && pk.active);
  G.activateGum('sticky'); G.updatePickups(dt);
  check(before && !pk.active, 'STICKY FINGERS: agarra el power-up a 6 m (sin el chicle, no)');
  // BONE ARMOR
  fresh(); state.health = 100; G.activateGum('bonearmor');
  for (let i = 0; i < 3; i++) G.damagePlayer(40, 0, 0, true);
  check(state.health === 100, 'BONE ARMOR: 3 golpes no hacen nada');
  G.damagePlayer(40, 0, 0, true);
  check(state.health === 60 && !G.gumActive('bonearmor'), 'el cuarto sí (y se rompe)', `(${state.health})`);
  // AMMO FOUNTAIN
  fresh(); { const w = G.curSlot(); w.mag = 0; w.reserve = 0; G.activateGum('ammofountain'); const d = G.slotDef(w);
    check(w.mag === d.magSize && w.reserve === d.reserveMax, 'AMMO FOUNTAIN: Max Ammo al instante'); }
  // WONDERBAR
  fresh(); G.activateGum('wonderbar'); G.BOX.phase = 'idle'; state.points = 5000;
  G.useBox();
  check(G.BOX.result === 'raygun' && !G.gumActive('wonderbar'), 'WONDERBAR: la caja da la Ray Gun', `(${G.BOX.result})`);
  // KILLING TIME
  fresh(); setPlayer(P0[0], P0[1]);
  const a = mk(3, -14), b = mk(-3, -14);
  G.activateGum('killingtime'); G.useHeldGum();
  const ax = a.px, az = a.pz;
  for (let i = 0; i < 60; i++) { G.tick(dt); G.updateZombies(dt); }
  check(Math.hypot(a.px - ax, a.pz - az) < 0.05, 'KILLING TIME: congelados', `(se movió ${Math.hypot(a.px - ax, a.pz - az).toFixed(2)} m)`);
  G.damageZombie(a, 10, false);
  check(a.alive, 'baleado, sigue vivo mientras dura');
  G.updateGums(GL.killingtime.time + 0.1);
  check(!a.alive && b.alive, 'al terminar muere el que baleaste; el otro no');
  // KRAKEN'S WRATH
  fresh(); setPlayer(P0[0], P0[1]);
  const n1 = mk(P0[0] + 5, P0[1]), n2 = mk(P0[0] + GL.krakenwrath.radius + 4, P0[1]);
  G.activateGum('krakenwrath'); G.useHeldGum();
  check(!n1.alive && n2.alive, "KRAKEN'S WRATH: mata a los de cerca, no a los de lejos");
  check(G.WRATH.t > 0 && G.WRATH.list.length === GL.krakenwrath.count, 'salen los tentáculos (pool fijo)');
  for (let i = 0; i < 150; i++) G.updateGums(dt);
  check(G.WRATH.list.every(w => !w.g.visible), 'y se esconden');
  G.STATS.killsBy = { gum: 3 };
  let fav = ''; try { fav = G.favoriteWeapon(); } catch (e) { fav = 'ERROR ' + e.message; }
  check(!/ERROR/.test(fav), 'la pantalla final tolera kills sin arma', `(${fav})`);
  G.resetGame();
  check(!G.GUMM.armor && G.WRATH.t === 0, 'reset de los chicles nuevos');
  // la tormenta del templo: oscuro y con relámpagos
  fresh(); setPlayer(75, 62);
  let flashes = 0, prev = 0;
  for (let i = 0; i < 60 * 12; i++) { G.tick(dt); G.updateNight(dt); if (G.NIGHT.flash > prev + 0.01) flashes++; prev = G.NIGHT.flash; }
  check(Math.abs(G.NIGHT.zd - CONFIG.TEMPLE.storm.zd) < 0.02, 'el templo es oscuro', `(${G.NIGHT.zd.toFixed(2)})`);
  check(flashes >= 1, 'y caen relámpagos', `(${flashes} en 12 s)`);
  check(G.rainZone(), 'y llueve');
  // el tambor 3D: sin WebGL (Node) no se arma, y no rompe nada
  let ok = true; try { G.gumDrumMount(null); } catch (e) { ok = false; }
  check(ok && CONFIG.GUMS.drum.balls > 0, 'el tambor 3D no rompe sin WebGL');
  G.resetGame(); }

console.log(fail ? 'FALLA (' + fail + ')' : 'PASA');
process.exit(fail ? 1 : 0);
