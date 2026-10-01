// V2 F5.19: el oeste (rancho y tortugario corridos, sendero del lazo de 30 m, sendero al claro al lado de la cueva),
// el caparazón 7 m más atrás, el claro rocoso y oscuro, la trampa de la tortuga mariachi (mini tortugas de los
// charcos y señuelo) y el taller de la Ola al lado del caparazón.
const G = require('./harness.js');
const { state, player, CONFIG, roundState, TRAPS, NIGHT, FLOW } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, P = CONFIG.PLAYER;
CONFIG.POWERUPS.dropChance = 0;

function fresh(open) {
  G.resetGame(); state.running = true; if (open) G.debugOpenAllDoors();
  state.round = 8; roundState.phase = 'active'; state.health = 100; state.lastDamageTime = -99; state.gameOver = false;
  state.points = 20000;
}
function clearZ() { for (const q of state.zombies.slice()) { q.active = q.alive = false; q.root.visible = false; } state.zombies.length = 0; }
function setPlayer(x, z) { player.pos.set(x, P.height, z); G.updateFlowField(true); }
function zombieAt(x, z, hp) {
  const q = G.spawnZombie(); q.state = 'walk'; q.px = x; q.pz = z; q.level = 0; q.mode = 'flow';
  if (hp) q.health = q.maxHealth = hp;
  return q;
}
const rooms = id => G.ROOMS.filter(r => r.id === id);

// 1) el oeste
fresh(true);
const lazo = rooms('R14').find(r => r.corridor);
check(lazo && lazo.x2 - lazo.x1 >= 30, 'sendero del lazo de 30 m (casa -> rancho)', `(${lazo && lazo.x2 - lazo.x1} m)`);
const RA = CONFIG.RANCHO.area, PN = CONFIG.RANCHO.pen, CV = CONFIG.RANCHO.cave;
check(RA.x2 === lazo.x1 && PN.x2 === RA.x1 && G.roomAt((RA.x1 + RA.x2) / 2, 30).id === 'R14' && G.roomAt((PN.x1 + PN.x2) / 2, 25).name === 'TORTUGARIO',
  'rancho y tortugario corridos (rancho x ' + RA.x1 + '..' + RA.x2 + ', tortugario x ' + PN.x1 + '..' + PN.x2 + ')');
const H2 = CONFIG.BURN.hedges.find(h => h.id === 'H2');
const dCave = Math.hypot((H2.x1 + H2.x2) / 2 - (CV.x1 + CV.x2) / 2, H2.z1 - CV.z2);
check(H2.x1 >= PN.x1 && H2.x2 <= PN.x2 && H2.z1 === PN.z2 && dCave < 6, 'H2 (al claro) sale del tortugario al lado de la cueva', `(${dCave.toFixed(1)} m)`);
check(!G.ROOMS.some(r => r.id === 'R17' && r.corridor && r.x2 === -42), 'el sendero viejo del claro (x -46..-42) ya no está');
const lazoEnd = [RA.x2 - 1, 28.5];
setPlayer(lazoEnd[0], lazoEnd[1]);
const dClaro = G.flowAt(-60, 60), dTort = G.flowAt(-78, 30);
check(dClaro > 0 && dTort > 0 && dClaro > dTort, 'con todo abierto, al claro se llega por el tortugario', `(${dTort} -> ${dClaro})`);
// (F5.28e: Speed Cola se fue a la cueva de las catacumbas)
check(['caseta'].every(k => { const s = CONFIG.GENERATORS.spots.caseta; return s.x > RA.x1 && s.x < RA.x2; }) &&
  CONFIG.BOX.spots.R14.x > RA.x1 && CONFIG.BOX.spots.R14.x < RA.x2, 'generador y caja se mudaron con el rancho');

// 2) el caparazón, más atrás
const S = CONFIG.SHELL;
// F5.22: el caparazón creció (34 × 28 m, centro z 89): la boca bajó a z 75.4 y el patio de adelante quedó en ~22 m
check(S.z >= 88 && S.door.z > 75, 'el caparazón 7 m más atrás (centro z ' + S.z + ', boca z ' + S.door.z + ')');
const patio = S.door.z - 53;
check(patio >= 22, 'más lugar para correr delante de la boca', `(${patio.toFixed(1)} m de patio)`);

// 3) el claro: rocoso y oscuro
check(rooms('R17').filter(r => !r.corridor).every(r => r.floor === 'rock' && r.dark) && rooms('R21').every(r => r.dark), 'el claro es rocoso y oscuro (el caparazón también)');
fresh(true); player.pos.set(0, P.height, -10);
for (let i = 0; i < 120; i++) { G.tick(dt); G.updateNight(dt); }
const hDay = G.WORLD.hemi.intensity;
player.pos.set(-60, P.height, 62);
for (let i = 0; i < 180; i++) { G.tick(dt); G.updateNight(dt); }
const hDark = G.WORLD.hemi.intensity;
check(NIGHT.zd === 1 && hDark < hDay * 0.6, 'en el claro la luz baja', `(${hDay.toFixed(2)} -> ${hDark.toFixed(2)})`);
player.pos.set(0, P.height, -10);
for (let i = 0; i < 180; i++) { G.tick(dt); G.updateNight(dt); }
check(NIGHT.zd === 0 && Math.abs(G.WORLD.hemi.intensity - hDay) < 1e-6, 'al salir vuelve la luz');

// 4) la trampa de la tortuga mariachi
fresh(true); clearZ();
const MT = CONFIG.TRAPS.mariachi, TM = TRAPS.mariachi;
// F5.22: con la boca más ancha, la palanca quedó a un costado de la entrada (~10 m del centro)
const leverD = Math.hypot(MT.lever.x - (S.door.x1 + S.door.x2) / 2, MT.lever.z - S.door.z);
check(G.roomAt(MT.lever.x, MT.lever.z).id === 'R17' && leverD < 11 && MT.lever.z < S.door.z,
  'palanca en la entrada del caparazón', `(${leverD.toFixed(1)} m de la boca, del lado de afuera)`);
check(MT.puddles.every(([x, z]) => G.roomAt(x, z) && G.roomAt(x, z).id === 'R17'), 'charcos en el claro');
setPlayer(-56.5, 73);
player.pos.set(MT.lever.x + 0.8, P.height, MT.lever.z - 0.6); G.updateInteract();
check(G.interactState.kind === 'trap' && G.promptFor(G.interactState).text === '[F] Activate MARIACHI TURTLE' && G.promptFor(G.interactState).cost === MT.cost,
  'cartel: activar la tortuga mariachi, ' + MT.cost);
setPlayer(-56.5, 73);
const prey = [zombieAt(-62, 60, 5000),   // F5.19c: (-62, 62) quedó pegado al peñasco de la catarata
 zombieAt(-45, 60, 5000), zombieAt(-68, 70, 5000), zombieAt(-46, 72, 5000)];
const far = zombieAt(-22, 36, 5000);
state.health = 100;
const pts = state.points;
check(G.interact() && TM.phase === 'on' && state.points === pts - MT.cost, 'cobra ' + MT.cost + ' y arranca');
G.tick(dt); G.updateTraps(dt);
G.updateFlowField(true);
check(FLOW.lure && Math.hypot(FLOW.lure.x - TM.x, FLOW.lure.z - TM.z) < 0.5, 'la mariachi atrae a los zombies (el flow field sale de ella)');
const p0 = [TM.x, TM.z];
let hit = false, minR = 99, maxR = 0, risen = false;
for (let i = 0; i < 60 * 15; i++) {                                    // F5.19c: comen más lento (eat 0.9 s)
  G.tick(dt); G.updateTraps(dt);
  for (const q of prey.concat([far])) if (q.alive) q.state = 'walk';
  if (state.health < 100) hit = true;
  const r = Math.hypot(TM.x - MT.center.x, TM.z - MT.center.z); minR = Math.min(minR, r); maxR = Math.max(maxR, r);
  if (TM.minis.list.some(tu => tu.g.visible && tu.g.position.y < -0.05)) risen = true;
}
check(Math.abs(minR - MT.radius) < 0.01 && Math.abs(maxR - MT.radius) < 0.01 && Math.hypot(TM.x - p0[0], TM.z - p0[1]) > 1, 'da vueltas en el patio', `(radio ${MT.radius})`);
check(risen, 'las mini tortugas salen de los charcos (desde abajo)');
check(prey.every(q => !q.alive), 'se comen a los del claro', prey.map(q => q.alive ? `vivo (${q.px.toFixed(0)},${q.pz.toFixed(0)})` : 'comido').join(' '));
check(far.alive, 'al que está lejos no');
check(!hit, 'a vos no te hacen nada');
for (let i = 0; i < 60 * (MT.time - 12 + 8); i++) { G.tick(dt); G.updateTraps(dt); }
check(TM.phase === 'cool' && !TM.g.visible && TM.minis.list.every(tu => tu.state === 'off' && !tu.g.visible), 'al terminar se van (y vuelven a su charco)',
  `(${TM.phase} ${TM.g.visible} ${TM.minis.list.map(tu => tu.state + (tu.g.visible ? '+' : '-') + (tu.state === 'home' ? '@' + tu.px.toFixed(1) + ',' + tu.pz.toFixed(1) + ' st' + tu.stuck.toFixed(2) : '')).join(' ')})`);
G.updateFlowField(true);
check(!FLOW.lure, 'sin la trampa, el flow field vuelve al jugador');
fresh(true); clearZ(); CONFIG.BOSS.enabled = true; state.round = 12;
G.spawnBoss(); const b = G.BOSS.z; b.px = -50; b.pz = 60; b.state = 'walk'; const bh = b.health;
TM.phase = 'idle'; state.points = 5000; G.useTrap(TM);
for (let i = 0; i < 60 * 6; i++) { G.tick(dt); G.updateTraps(dt); b.px = -50; b.pz = 60; b.act = null; }
check(b.alive && b.health === bh, 'al boss no');
CONFIG.BOSS.enabled = false; clearZ();
G.resetGame();
check(TM.phase === 'idle' && !TM.g.visible && TM.minis.list.every(tu => tu.state === 'off' && !tu.g.visible), 'resetGame la apaga');

// 5) el taller de la Ola, al lado del caparazón
const WS = CONFIG.QUEST.workshop;
check(WS.room === 'R17' && G.roomAt(WS.x, WS.z).id === 'R17' && Math.hypot(WS.x - S.x, WS.z - S.door.z) < 16, 'el taller de la Ola al costado del caparazón');

console.log(fail ? `\n${fail} FALLAS` : '\nPASA');
process.exit(fail ? 1 : 0);
