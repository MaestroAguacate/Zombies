// V2 F5.29: el easter egg THE KRAKEN. Los 6 pasos (cumplir y fallar), la pausa con el día morado, la entrada por la
// pared de agua, la pelea entera, la victoria (remolino, restos, cielo y premios), el intento fallido (castigo y el cebo
// que vuelve), el bote, la muerte = game over y la tecla L de debug.
// F5.29b: el muelle en medio del mar (lejos de la costa, con barandas y faroles), la tormenta, los tentáculos que caen
// despacio, pegan 60 y quedan SÓLIDOS, los del piso que te tiran lejos del cañón, los cañones de arpones (subirse,
// apuntar, clic), los ahogados que suben, y un boss del mar por cada fase cumplida o paso fallado
const G = require('./harness.js');
const THREE = G.sandbox ? G.sandbox.THREE : require('three');
const { state, player, CONFIG, roundState } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 30, P = CONFIG.PLAYER, E = CONFIG.EE, FC = E.fight, EE = G.EE, K = G.KRAKEN;
CONFIG.POWERUPS.dropChance = 0;
function fresh(round) {
  G.resetGame(); state.running = true; state.round = round || 14; roundState.phase = 'active'; roundState.total = 999;
  state.points = 50000; state.health = 100; G.debugOpenAllDoors();
}
function setPlayer(x, z, lvl) {
  const y = lvl === 1 ? G.UP.y : lvl === 2 ? G.UP2.y : G.groundY(x, z);
  player.pos.set(x, y + P.height, z); player.vel.set(0, 0, 0); G.updateFlowField(true);
}
// corre el juego entero (gameUpdate) s segundos, con la vida llena (heal false: sin curar)
function run(s, each, heal) {
  for (let i = 0; i < Math.round(s / dt); i++) {
    G.tick(dt); G.gameUpdate(dt);
    if (each && each() === false) break;
    if (heal !== false && !state.gameOver) state.health = Math.max(state.health, 100);
  }
}
const near = () => G.eeNear(G.roomAt(player.pos.x, player.pos.z), player.pos.x, player.pos.z, 9, G.playerLevel());
const cellOk = (x, z, lvl) => { const ix = Math.floor(x), iz = Math.floor(z); return lvl === 1 ? G.isUp(ix, iz) : lvl === 2 ? G.isUp2(ix, iz) : G.isNav(ix, iz); };
const inArena = (x, z) => { const r = G.roomAt(x, z); return !!r && r.id === 'R25'; };

// 1) la arena: un muelle aparte en el mar, caminable, cerrado, escondido, lejos de la costa y sin camino a pie
fresh();
const A = E.arena;
check(G.ROOMS.some(r => r.id === 'R25'), 'la arena es un cuarto (R25)');
const [sx, sz] = [A.x + A.start[0], A.z + A.start[1]];
check(cellOk(sx, sz, 0) && K.harps.every(h => cellOk(h.sx, h.sz, 0)) && cellOk(A.x + A.boat[0], A.z + A.boat[1] - 2, 0),
  'se camina donde se arranca, en el asiento de cada cañón y en el embarcadero del bote');
check(G.WORLD.colliders.some(c => c.tag === 'bound:kraken'), 'tiene bordes contra el agua');
let area = 0; for (const [x1, x2, z1, z2] of A.rects) area += (x2 - x1) * (z2 - z1);
check(area >= 900, 'el muelle es grande', `(${area} m²)`);
const nearShore = Math.min(...A.rects.map(r => -24 - (A.z + r[3])));
check(nearShore >= 29, 'lejos de la costa', `(${nearShore} m de la orilla)`);
check(K.edges.length > 80 && A.torches.length >= 2 && K.fires.length === A.torches.length && K.fires.every(f => f.y < -50), 'baranda en el borde y antorchas (apagadas fuera de la pelea)', `(${K.edges.length} lugares de borde)`);
check(!K.arena.visible, 'escondida hasta la pelea');
setPlayer(0, -12);
check(G.flowAt(Math.floor(sx), Math.floor(sz)) < 0, 'desde la playa no se llega caminando');
// los lugares del laboratorio y de la cabeza del calamar
check(E.consoles.every(([x, z, l]) => cellOk(x + 0.6, z, l) || cellOk(x - 0.6, z, l) || cellOk(x, z + 0.6, l) || cellOk(x, z - 0.6, l)), 'se llega a las 3 consolas (una por nivel)');
check(cellOk(E.booth.x, E.booth.z, 0) && cellOk(E.booth.x - E.booth.w / 2 - 0.8, E.booth.z, 0) && cellOk(E.booth.x + E.booth.w / 2 + 0.8, E.booth.z, 0), 'la cabina se cruza de lado a lado');
check(cellOk(E.tele.arrive[0], E.tele.arrive[1], 0) && G.roomAt(E.tele.arrive[0], E.tele.arrive[1]).id === 'R21', 'el teletransportador llega adentro del caparazón');
check(G.roomAt(E.membrane.x, E.membrane.z + 1).id === 'R22', 'la pared de agua está en la cabeza del calamar');

// 2) paso 1: la semilla de la planta jefa (se hunde si no la agarrás y vuelve a brotar en la ronda siguiente)
fresh();
G.eeOnPlantDeath(89, 72);
check(EE.seed && !EE.seed.sunk, 'la planta jefa suelta la semilla');
run(E.seed.time + 1);
check(EE.seed && EE.seed.sunk && !EE.hasSeed, 'si no la agarrás se hunde');
G.startRound(state.round + 1); roundState.total = 999; run(0.2);
check(EE.seed && !EE.seed.sunk, 'a la ronda siguiente vuelve a brotar');
setPlayer(EE.seed.x, EE.seed.z, 1);
const ns = near();
check(ns && ns.target.k === 'seed', 'parado al lado, la F la agarra (sin cartel)', ns ? '' : '(nada cerca)');
check(G.promptFor({ kind: 'ee', target: ns && ns.target }).text === '', 'el cartel está vacío: no hay pistas');
G.eeUse(ns.target);
check(EE.hasSeed && EE.step >= 1, 'semilla en la mano (paso 1)');

// 3) paso 2: la Bestia
G.eeOnBeastDeath();
check(EE.beastDead && EE.step >= 2, 'la Bestia muerta (paso 2)');

// 4) paso 3: el teletransportador del búnker (si te bajás se corta; si aguantás, te lleva al laboratorio)
const TP = CONFIG.BUNKER.teleporter;
// (la plataforma es un sólido de 0.4 m: el jugador va parado arriba)
const onPad = () => { player.pos.set(TP.x, CONFIG.BUNKER.y + 0.4 + P.height, TP.z); player.vel.set(0, 0, 0); player.grounded = true; G.updateFlowField(true); };
onPad();
const nt = near();
check(nt && nt.target.k === 'tele', 'con la semilla, la plataforma se usa');
G.eeUse(nt.target);
run(1); setPlayer(TP.x + 8, TP.z - 8); run(E.tele.leave + 0.5);
check(EE.tele.state === 'off', 'si te bajás de la plataforma, se corta');
onPad(); G.eeUse(near().target);
run(E.tele.charge + E.travel + 0.5, () => { if (EE.tele.state === 'done' && !(G.BUNK.fadeT > 0)) return false; });
run(E.travel + 0.2);
check(EE.tele.state === 'done' && EE.step >= 3, 'cargado (paso 3)');
check(G.roomAt(player.pos.x, player.pos.z).id === 'R21', 'y te dejó en el laboratorio del caparazón');

// 5) paso 4: las pruebas (si se acaba el tiempo de las consolas, se reinicia; aguantar adentro del caparazón)
const pressConsole = i => { const [x, z, l] = E.consoles[i]; setPlayer(x + 0.6, z, l); const n = near(); if (n && n.target.k === 'console') G.eeUse(n.target); return n; };
check(!!pressConsole(0), 'la primera consola se usa');
run(E.calib + 0.5);
check(EE.trial.state === 'off' && !EE.trial.lit.some(Boolean), 'si se acaba el tiempo de la calibración, se reinicia');
for (let i = 0; i < 3; i++) pressConsole(i);
check(EE.trial.n === 1 && EE.trial.state === 'hold', 'las 3 a tiempo: prueba 1 cumplida, arranca la 2');
setPlayer(E.tele.arrive[0], E.tele.arrive[1]);
// (quieto adentro: los zombies de la ronda empujan y a veces sacaban al jugador de la cúpula)
run(E.hold + 0.5, () => { player.pos.x = E.tele.arrive[0]; player.pos.z = E.tele.arrive[1]; G.DOWN.on = false; });
check(EE.trial.n === 2 && EE.step >= 4, 'aguantar adentro: pruebas cumplidas (paso 4)');

// 6) paso 5: el Sombrerón en la cabina (si lo matás, falla; vacía, falla; débil y adentro, se lo traga)
setPlayer(E.gramo[0] + 0.8, E.gramo[1]);
const ng = near();
check(ng && ng.target.k === 'gramo', 'el tocadiscos se usa');
G.eeUse(ng.target);
const sb = EE.cap.boss;
check(EE.cap.state === 'waiting' && sb && sb.alive, 'aparece un Sombrerón');
G.damageZombie(sb, 1e9, false); run(0.3);
check(EE.cap.state === 'off' && EE.cap.cd > 0, 'si lo matás, falla (el tocadiscos espera)');
EE.cap.cd = 0; G.eeUse({ k: 'gramo' });
const sb2 = EE.cap.boss;
setPlayer(E.boothConsole[0], E.boothConsole[1] - 0.5);
G.eeUse({ k: 'booth' });
check(EE.cap.state === 'waiting', 'cerrarla vacía no sirve');
run(E.shutTime + 0.2);
sb2.px = E.booth.x; sb2.pz = E.booth.z; sb2.health = sb2.maxHealth * (E.weak - 0.1);
G.eeUse({ k: 'booth' });
check(EE.cap.state === 'process' && !sb2.alive && EE.step >= 5, 'débil y adentro: atrapado (paso 5)');
run(E.process + 0.5);
check(EE.cap.state === 'ready' && G.EE.g.lure.visible, 'la cabina suelta el cebo');

// 7) paso 6: el cebo. Se cortan los zombies, la ronda queda en pausa y el día se pone morado
G.spawnZombie(); G.spawnZombie();
const sp0 = roundState.spawned;
setPlayer(E.booth.x + 0.5, E.booth.z); G.eeUse(near().target);
check(EE.lure && EE.calm && EE.step >= 6, 'cebo en la mano (paso 6)');
check(state.zombies.filter(z => !z.boss).length === 0, 'se fueron los zombies');
run(5);
check(roundState.spawned === sp0 && state.zombies.filter(z => !z.boss).length === 0, 'y no salen más (la ronda está en pausa)');
check(G.NIGHT.target === 0 && G.NIGHT.pTarget === 1, 'de día y con el cielo morado');

// 8) la pared de agua de la cabeza del calamar te lleva al muelle, con la tormenta
setPlayer(E.membrane.x, E.membrane.z + 1);
const nm = near();
check(nm && nm.target.k === 'membrane', 'con el cebo, la pared de agua se usa');
G.eeUse(nm.target);
run(E.travel + 0.3);
check(EE.fight && inArena(player.pos.x, player.pos.z) && K.arena.visible, 'estás en el muelle, con el Kraken');
run(3);
check(G.NIGHT.target === E.storm.night && G.NIGHT.pTarget === 0 && G.rainZone() && !!G.stormZone(G.roomAt(player.pos.x, player.pos.z)), 'de noche, con lluvia y relámpagos');
check(G.THEMEFX.sea && !G.THEMEFX.sea.far.visible && !G.THEMEFX.sea.near.visible, 'el mar de la playa se esconde (el del muelle lo reemplaza)');
check(G.weatherFogFar(40) === E.storm.fogFar && G.camera.far >= E.storm.fogFar, 'la niebla y la cámara llegan al Kraken');
K.g.updateMatrixWorld(true);
const eyeW = new THREE.Vector3(); K.eye.getWorldPosition(eyeW);
check(eyeW.y > 10 && K.body.scale.x === A.scale, 'el Kraken es el calamar gigante, enorme (el ojo a ' + eyeW.y.toFixed(1) + ' m)');
check(K.fires.every(f => f.y > 1), 'las antorchas del muelle se prenden');

// 9) la pelea, fase 1
const F = () => EE.fight;
// ahogados que suben al muelle (el primero tarda drowned.first s)
run(FC.drowned.first - 6);
check(!state.zombies.some(z => z.alive && z.kind === 'drowned'), 'los ahogados tardan en salir');
// (se cuentan todos los que subieron: los tentáculos aplastan a los que quedan abajo)
const drowned = [];
run(12, () => { for (const z of state.zombies) if (z.alive && z.kind === 'drowned' && drowned.indexOf(z) < 0 && inArena(z.px, z.pz)) drowned.push(z); });
check(drowned.length >= 2, 'después suben ahogados al muelle', `(${drowned.length})`);
check(state.zombies.some(z => z.squid && z.alive), 'y calamarcitos');
// se da vuelta hacia donde estés (también en la punta de un brazo, a su costado)
{ const face = () => { const want = Math.atan2(player.pos.x - K.g.position.x, player.pos.z - K.g.position.z); const d = want - K.g.rotation.y; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); };
  setPlayer(A.x - 22, A.z - 3); run(4, () => { player.pos.x = A.x - 22; player.pos.z = A.z - 3; });
  const l = face();
  setPlayer(A.x + 22, A.z - 3); run(4, () => { player.pos.x = A.x + 22; player.pos.z = A.z - 3; });
  check(l < 0.25 && face() < 0.25, 'el Kraken se da vuelta hacia donde estés (las puntas de la C)', `(${l.toFixed(2)}, ${face().toFixed(2)} rad)`);
  setPlayer(A.x + A.start[0], A.z + A.start[1]); }
// un golpe: aviso largo, cae, pega 60 y queda sólido (aislado: sin ahogados, calamarcitos ni otros golpes)
const quiet = () => { FC.drowned.max = 0; FC.squidMax = 0; for (const z of state.zombies.slice()) if (!z.boss) G.damageZombie(z, 1e9, false, 0, 0); F().slamT = 999; F().floorT = 999; F().inkT = 999; };
const loud = () => { FC.drowned.max = 12; FC.squidMax = 6; F().slamT = 1; F().floorT = 6; F().inkT = 6; };
quiet(); run(1.5);
setPlayer(A.x + 4, A.z + 20);
state.perks.length = 0; state.health = 100; state.lastDamageTime = -99;
const T0 = K.tents.find(T => T.state === 'off');
// F5.29d: no todos traen la herida (y nunca más de woundMax - 1 seguidos sin ella)
{ let w = 0, run0 = 0, worst = 0;
  for (let i = 0; i < 60; i++) { G.krakenSlam(T0); if (T0.wound) { w++; run0 = 0; } else worst = Math.max(worst, ++run0); }
  check(w > 5 && w < 55 && worst <= FC.woundMax - 1, 'no todos los tentáculos traen la herida', `(${w} de 60; a lo sumo ${worst} seguidos sin)`); }
G.krakenSlam(T0); T0.wound = true;
let hp0 = state.health, warnT = 0;
run(FC.warn + FC.fall + 0.2, () => { if (T0.state === 'warn' || T0.state === 'fall') warnT += dt; }, false);
check(warnT >= FC.warn + FC.fall - 0.1, 'el golpe avisa (franja roja) y cae despacio', `(${warnT.toFixed(1)} s)`);
check(hp0 - state.health === FC.slamDmg, 'si te agarra, te baja ' + FC.slamDmg + ' de vida', `(${hp0} -> ${state.health})`);
const solid = K.cols.filter(c => c.solid && c.tag === 'kraken:tent');
check(T0.state === 'down' && solid.length >= 3, 'queda apoyado y sólido', `(${solid.length} cajas)`);
// cruzarlo de costado: no se puede (segmentClear frena gente)
const mid = T0.boxes[Math.floor(T0.boxes.length / 2)], ldx = T0.tx - T0.ex, ldz = T0.tz - T0.ez, ll = Math.hypot(ldx, ldz);
const nx = -ldz / ll, nz = ldx / ll;
check(!G.segmentClear(mid[0] - nx * 3, mid[1] - nz * 3, mid[0] + nx * 3, mid[1] + nz * 3, 0.3), 'no se puede pasar a través del tentáculo apoyado');
check(!solid.some(c => player.pos.x > c.minX && player.pos.x < c.maxX && player.pos.z > c.minZ && player.pos.z < c.maxZ), 'y no te deja metido adentro');
// un tiro de verdad a la ventosa (traceShot): la daña
G.state.health = 100;
T0.spot.updateWorldMatrix(true, false);
const spw = T0.spot.position.clone();
const side = [4, -4, 3, -3, 2.5, -2.5].find(s => inArena(spw.x + nx * s, spw.z + nz * s)) || 4;
setPlayer(spw.x + nx * side, spw.z + nz * side);
G.camera.position.copy(player.pos); G.camera.lookAt(spw); G.camera.updateMatrixWorld();
G.feel.aimQuat.copy(G.camera.quaternion); G.feel.eye.copy(G.camera.position);
const shp = T0.hp;
G.traceShot(G.camera.position.clone(), new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion), G.slotDef({ id: 'raygun', pap: true }));
check(T0.hp < shp, 'un balazo a la ventosa la lastima', `(${Math.round(shp)} -> ${Math.round(T0.hp)})`);
run(FC.stay + 0.2);
check(!K.cols.some(c => c.solid && c.tag === 'kraken:tent') && G.segmentClear(mid[0] - nx * 3, mid[1] - nz * 3, mid[0] + nx * 3, mid[1] + nz * 3, 0.3), 'cuando se va, se vuelve a pasar');
// cortar 4: fase 2, y sale un boss del mar
setPlayer(A.x + 6, A.z + 20);
loud();
for (let k = 0; k < FC.cuts && F().phase === 1; k++) {
  let T = null;
  run(40, () => { T = K.tents.find(q => q.state === 'down' && q.spot.visible); return !T; });
  if (T) G.krakenHit(T.spot, 1e9);
}
check(F().phase === 2 && F().cuts >= FC.cuts, 'cortados los 4 tentáculos: fase 2 (abre el ojo)', `(fase ${F().phase}, ${F().cuts} cortes)`);
check(G.BOSS.pool.some(z => z.active && z.alive && inArena(z.px, z.pz)) || F().helpers > 0, 'al cumplir la fase sale un boss del mar', `(${F().helpers})`);
const bossOne = G.BOSS.pool.find(z => z.active && z.alive && inArena(z.px, z.pz));
check(!!bossOne && G.scene.fog.far > 30, 'y la niebla no se cierra (el Kraken se sigue viendo)', `(${G.scene.fog.far.toFixed(0)} m)`);
check(G.PICKUPS.pool.some(p => p.active && p.type === 'maxammo' && Math.hypot(p.x - (A.x + A.ammo[0]), p.z - (A.z + A.ammo[1])) < 0.5), 'y un Max Ammo en el medio del muelle');

// 10) fase 2: los cañones de arpones. Subirse (F), apuntar al ojo y clic
quiet();
for (const z of G.BOSS.pool) if (z.active) { G.damageZombie(z, 1e9, false, 0, 0); }
run(1);
const aimAt = v => { G.camera.position.copy(player.pos); G.camera.lookAt(v); G.camera.updateMatrixWorld(); G.feel.aimQuat.copy(G.camera.quaternion); G.feel.eye.copy(G.camera.position); };
const eyeNow = () => { K.g.updateMatrixWorld(true); const e = new THREE.Vector3(); K.eye.getWorldPosition(e); return e; };
const H0 = K.harps[2];
setPlayer(H0.sx, H0.sz);
const nh = near();
check(nh && nh.target.k === 'harpoon', 'al lado del asiento, la F te sube al cañón');
G.eeUse(nh.target);
check(G.eeMounted() && Math.hypot(player.pos.x - H0.sx, player.pos.z - H0.sz) < 0.01, 'subido: quedás quieto en el asiento');
G.keys['KeyW'] = true; run(0.5); G.keys['KeyW'] = false;
check(Math.hypot(player.pos.x - H0.sx, player.pos.z - H0.sz) < 0.05, 'y no caminás');
// F5.29d: el ojo se abre en ventanas cortas; cerrado, el arpón rebota (sin contar). (Mientras se prueban los arpones, el
// tentáculo del piso no sale: mountGrace muy alto; se prueba aparte)
const grace0 = FC.mountGrace; FC.mountGrace = 999;
run(12, () => F().eyeOpen || F().flinch > 0);
const hitsC = F().eyeHits;
aimAt(eyeNow()); G.fireWeapon();
check(H0.shot.on && H0.cd > 0 && !H0.loaded.visible, 'el clic tira el arpón (y hay que recargar)');
run(1, () => { aimAt(eyeNow()); });
check(F().eyeHits === hitsC && F().fails === 0, 'con el ojo cerrado no cuenta (rebota)');
let openT = 0, wasOpen = false, windows = 0;
run(FC.eyeOpen * 2 + FC.eyeClosed * 2 + 1, () => { if (F().eyeOpen) { openT += dt; if (!wasOpen) windows++; } wasOpen = F().eyeOpen; });
check(windows >= 1 && openT / windows <= FC.eyeOpen + 0.1, 'el ojo se abre en ventanas cortas', `(${windows} ventanas de ${(openT / Math.max(1, windows)).toFixed(1)} s)`);
G.krakenDismount(); H0.cd = 0; H0.loaded.visible = true;
setPlayer(H0.sx, H0.sz); G.krakenMount(2);
run(12, () => !F().eyeOpen || F().flinch > 0);
const hits0 = F().eyeHits;
aimAt(eyeNow()); G.fireWeapon();
run(1, () => { aimAt(eyeNow()); });
check(F().eyeHits === hits0 + 1, 'apuntando al ojo abierto, le pega', `(${F().eyeHits})`);
check(!G.eeMounted(), 'y te baja del cañón');
// subido mucho tiempo: sale un tentáculo del piso, te pega y te tira lejos del cañón
FC.mountGrace = grace0;
const H3 = K.harps[3]; setPlayer(H3.sx, H3.sz); G.krakenMount(3);
state.health = 100; state.lastDamageTime = -99;
const hpF = state.health;
let floorSolid = false;
run(FC.mountGrace + FC.floorWarn + 1, () => { if (!G.eeMounted() && K.cols.some(c => c.solid && c.tag === 'kraken:tent')) floorSolid = true; }, false);
// (el golpe se mira por lastDamageTime: con un perk de un boss muerto la vida se regenera por encima de 100)
check(!G.eeMounted() && hpF !== undefined && state.lastDamageTime > 0 && Math.hypot(player.pos.x - H3.sx, player.pos.z - H3.sz) > 4,
  'subido, sale un tentáculo del piso, te pega y te tira lejos del cañón', `(${Math.hypot(player.pos.x - H3.sx, player.pos.z - H3.sz).toFixed(1)} m)`);
check(floorSolid, 'el tentáculo del piso queda parado (sólido)');
state.health = 100;
// un arpón errado (al cielo) es un paso fallado: sale otro del mar
const H1 = K.harps[0], fails0 = F().fails, help0 = F().helpers, alive0 = state.zombies.filter(z => z.alive).length;
setPlayer(H1.sx, H1.sz); G.krakenMount(0); run(0.2);
aimAt(new THREE.Vector3(player.pos.x - 30, player.pos.y + 40, player.pos.z + 10)); G.fireWeapon();
run(2);
check(F().fails === fails0 + 1, 'un arpón errado es un paso fallado');
check(F().helpers > help0 || state.zombies.filter(z => z.alive).length > alive0, 'y sale un boss (o una tanda de ahogados) del mar');
G.krakenDismount();
// los otros dos arponazos (esperando que se abra)
FC.mountGrace = 999;
for (let k = 0; k < 16 && F().phase === 2; k++) {
  const H = K.harps[k % K.harps.length];
  if (H.cd > 0) continue;
  setPlayer(H.sx, H.sz); G.krakenMount(K.harps.indexOf(H));
  run(12, () => !(F().eyeOpen && F().flinch <= 0));
  aimAt(eyeNow()); G.fireWeapon();
  run(1, () => { aimAt(eyeNow()); });
  G.krakenDismount();
}
check(F().phase === 3 && F().eyeHits >= FC.eyeHits, '3 arponazos al ojo: fase 3', `(${F().eyeHits})`);

FC.mountGrace = grace0;

// 11) fase 3 (F5.29d): salen 2 Sombrerones, el Calamarón y la Bestia; cada uno suelta una granada morada; con las 4, la
// mesa las ata a la Ola; la carga a la boca abierta lo revienta
quiet();
setPlayer(A.x, A.z + 20);
// una granada que cae en el agua (el boss murió afuera) vuela flotando hasta delante de la mesa
{ G.krakenDropOrb(A.x, A.z + 2);
  const O = K.orbs.find(o => o.on);
  check(!!O && !!O.fly, 'si una granada cae afuera del muelle, sale volando');
  run(8);
  const tx = A.x + A.table[0], tz = A.z + A.table[1];
  check(O && !O.fly && O.on && Math.hypot(O.x - tx, O.z - tz) < 2.5 && inArena(O.x, O.z), 'y queda delante de la mesa', O ? `(${(O.x - A.x).toFixed(1)}, ${(O.z - A.z).toFixed(1)})` : '');
  O.on = false; O.g.visible = false; }
const p3seen = [];
const orbsNow = () => K.orbs.filter(o => o.on);
// juntar los 4 huevos: matar a los bosses que van saliendo y pasar por encima de lo que sueltan
const collect = () => {
  for (let k = 0; k < 40 && F().charges < 4; k++) {
    run(2, () => { for (const r of F().p3.refs) if (p3seen.indexOf(r) < 0) p3seen.push(r); });
    for (const r of F().p3.refs) if (r.z.alive) G.damageZombie(r.z, 1e9, false);
    run(0.3);
    for (const o of orbsNow()) { setPlayer(o.x, o.z); run(0.2); }
    setPlayer(A.x, A.z + 20);
  }
};
collect();
const kinds = p3seen.map(r => r.z.variant);
check(kinds.filter(v => v === 'sombrero').length === 2 && kinds.includes('calamar') && kinds.includes('bestia'),
  'salen del mar 2 Sombrerones, el Calamarón y la Bestia', `(${kinds.join(', ')})`);
check(F().charges === 4, 'cada uno suelta un huevo de calamar (4 juntados)', `(${F().charges})`);
const TB = [A.x + A.table[0], A.z + A.table[1] - 1.4];
// atarlos: manteniendo F en la mesa craftTime s; mientras, no te movés, el arma se guarda y aparece el martillo
const craftHold = () => {
  setPlayer(TB[0], TB[1]);
  let moved = 0, hammer = false, busy = false;
  G.keys['KeyF'] = true; G.keys['KeyW'] = true;
  run(FC.craftTime + 0.4, () => {
    if (!G.buildBusy()) return;
    busy = true; if (G.SHIELDST.hammer.visible) hammer = true; moved = Math.max(moved, Math.hypot(player.pos.x - TB[0], player.pos.z - TB[1]));
  });
  G.keys['KeyF'] = false; G.keys['KeyW'] = false;
  return { moved, hammer, busy };
};
setPlayer(TB[0], TB[1]);
const nc = near();
check(nc && nc.target.k === 'craft', 'con los 4, la mesa se usa');
G.eeUse(nc.target);
check(!F().loaded, 'apretar F una vez no alcanza (hay que mantener)');
const c1 = craftHold();
check(F().loaded && G.curSlot().id === 'wave', 'manteniendo F: quedan atados a la Ola Rompiente (en la mano)');
// (el primer cuadro todavía camina: el armado empieza al cuadro siguiente)
check(c1.busy && c1.hammer && c1.moved < 0.1, 'mientras arma: la animación del martillo y no te movés', `(${c1.moved.toFixed(2)} m)`);
run(0.5);
check(!G.weaponsState.model || K.bundle.parent === G.weaponsState.model, 'y se ve la carga atada');
// errarle: paso fallado; la carga se pierde y vuelven a salir los 4 bosses
const f3 = F().fails;
G.weaponsState.phase = 'idle';
G.camera.position.copy(player.pos); G.camera.lookAt(player.pos.x + 20, player.pos.y + 30, player.pos.z + 20); G.camera.updateMatrixWorld();
G.feel.aimQuat.copy(G.camera.quaternion); G.feel.eye.copy(G.camera.position);
G.fireWeapon();
check(!!F().shot && !F().loaded, 'el clic tira la carga');
run(4.5);
check(!F().shot && F().fails === f3 + 1 && F().charges === 0 && F().p3.queue.length === FC.p3Bosses.length, 'si le errás: se pierde y vuelven a salir los 4 bosses');
p3seen.length = 0; collect();
check(F().charges === 4 && p3seen.length >= 4, 'y te vuelven a dar los 4 huevos', `(${F().charges})`);
craftHold();
check(F().loaded, 'se vuelven a atar en la mesa');
// a la boca abierta
run(14, () => !F().mouthOpen);
check(F().mouthOpen, 'abre el pico');
G.weaponsState.phase = 'idle';
G.fireWeapon();
const mo = new THREE.Vector3(); G.krakenMouth(mo); F().shot.p.copy(mo);
run(0.1);
check(!!EE.cine && EE.cine.stage === 'blast', 'la carga en la boca: grita y arranca la cinemática');
// la cinemática (F5.29f): la agonía (la boca gritando, líquido negro, pedazos que saltan cada vez más seguido, los
// tentáculos sacudiéndose, rayos que rompen el muelle), el último golpe, el remolino y el portal; el tablón con los
// flashbacks; mira para atrás al remolino y al portal
let chunks = false, swim = false, lookBack = false, plank = false, pieces = [], whirlBig = 0, portalK = 0, aurora = false, beams = false;
let ooze = 0, holes = 0, flail = false, mouthBig = 0, flashes = new Set(), flashFace = false, flashRed = false;
const W = E.win, ink0 = G.PROFILE.ink, pts0 = state.points, eggs0 = G.PROFILE.krakenEggs | 0;
let lastN = 0, crackMax = 0;
run(W.blast + W.boomT + W.whirlT + W.swim + 2, () => {
  if (!EE.cine) return false;
  const st = EE.cine.stage;
  if (st === 'blast') {
    const n = EE.cine.nb || 0; if (n > lastN) pieces.push(EE.cine.t); lastN = n; crackMax = Math.max(crackMax, EE.cine.cracks);
    ooze = Math.max(ooze, K.drops.filter(d => d.on).length); mouthBig = Math.max(mouthBig, K.mouth.scale.x);
    if (K.tents.every(T => T.state === 'flail')) flail = true;
  }
  holes = Math.max(holes, K.holes.filter(h => h.visible).length);
  if (K.chunks.some(c => c.on)) chunks = true;
  if (st === 'whirl') { whirlBig = Math.max(whirlBig, K.whirl.scale.x); portalK = Math.max(portalK, K.portal.scale.x); if (K.aurora.visible) aurora = true; if (K.beams.visible) beams = true; }
  if (st === 'swim') {
    swim = true; if (K.plank.visible) plank = true;
    if (EE.cine.flashT > 0) { flashes.add(EE.cine.flash); if (K.flash.some(f => f.visible)) flashFace = true; if (K.flashRed.visible) flashRed = true; }
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion), w = K.whirl.position.clone().sub(G.camera.position).setY(0).normalize();
    if (f.setY(0).normalize().dot(w) > 0.9) lookBack = true;
  }
});
const gaps = pieces.slice(1).map((b, i) => b - pieces[i]);
check(mouthBig > 2.4 && ooze > 20 && crackMax >= W.cracks - 2, 'abre la boca gritando y chorrea líquido negro', `(${ooze} gotas, ${crackMax} chorreones)`);
check(pieces.length >= 12 && gaps[gaps.length - 1] < gaps[0] && chunks, 'le saltan pedazos de a poco, cada vez más seguido', `(${pieces.length})`);
check(!K.fire, 'sin las luces de explosiones');
check(flail, 'sacude los tentáculos desesperado');
check(holes >= 3, 'caen rayos que rompen el muelle', `(${holes} agujeros)`);
check(whirlBig > 2, 'se lo traga el remolino', `(${whirlBig.toFixed(1)})`);
check(portalK > 0.95 && aurora && beams, 'y se abre el portal cúbico en el cielo, con auroras y rayos');
check(swim && plank, 'después vas en un tablón hacia la playa');
check(flashes.size === W.flashes.length && flashFace && flashRed && K.flash.length === 4, 'con los flashbacks de los 4 bosses (screamers)', `(${flashes.size} de ${K.flash.length})`);
check(lookBack, 'y mirás para atrás: el remolino');
check(!K.flash.some(f => f.visible) && !K.flashRed.visible, 'los flashbacks no quedan en pantalla');

// 12) la victoria: en la playa, mirando el remolino, restos, cielo, premios; las rondas siguen
const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)), tw = new THREE.Vector3(E.win.whirl[0] - player.pos.x, 0, E.win.whirl[1] - player.pos.z).normalize();
check(fwd.dot(tw) > 0.95, 'al llegar quedás mirando el remolino');
check(EE.won && !EE.fight && !EE.cine && !EE.calm, 'ganado: el juego sigue');
check(G.roomAt(player.pos.x, player.pos.z) && G.roomAt(player.pos.x, player.pos.z).id === 'R10', 'estás en la playa');
check(!state.zombies.some(z => z.active && inArena(z.px, z.pz)), 'no quedan ahogados ni bosses en el muelle');
check(G.THEMEFX.sea.far.visible && !EE.storm && G.weatherFogFar(40) !== E.storm.fogFar, 'vuelve el mar de la playa y se va la tormenta');
check(K.whirl.visible && Math.hypot(K.whirl.position.x - E.win.whirl[0], K.whirl.position.z - E.win.whirl[1]) < 0.1, 'el remolino se ve en el mar');
check(K.debris && K.debris.visible, 'hay restos del Kraken por el mapa');
run(5);
check(EE.skyK > 0.9, 'el cielo se pone morado y azul');
check(G.PERK_KEYS.every(k => G.hasPerk(k)) && state.points >= pts0 + E.win.points && G.PROFILE.ink >= ink0 + E.win.ink && G.PROFILE.krakenSlayer, 'premios: todos los perks, puntos, tinta y el título');
check(G.PROFILE.krakenEggs === eggs0 + 1 && G.krakenEggHTML().indexOf('KRAKEN EGG') >= 0, 'el trofeo: un huevo de calamar en el perfil');
// las luces quedan mar adentro (y se ven: KRAKEN.sky las acerca a la cámara sin cambiar cómo se ven)
{ const pp = K.portal.position, ok = K.portal.visible && Math.hypot(pp.x - E.win.portalSea[0], pp.z - E.win.portalSea[1]) < 0.1 && pp.z < -90;
  const c = G.camera.position, wp = pp.clone().multiplyScalar(K.sky.scale.x).add(K.sky.position), dir0 = pp.clone().sub(c).normalize(), dir1 = wp.clone().sub(c).normalize();
  check(ok && c.distanceTo(wp) < G.camera.far && dir0.dot(dir1) > 0.999, 'el portal queda mar adentro y se ve desde la playa', `(z ${pp.z.toFixed(0)}, a ${c.distanceTo(wp).toFixed(0)} m en pantalla)`); }

// 13) intento fallido por tiempo: te escupe a la playa, castigo, y el cebo vuelve a la cabina en 2 rondas
fresh(); EE.step = 6; EE.lure = true; G.eeCalm(true); G.eeStartFight(); run(E.travel + 0.3);
EE.fight.t = FC.time;
run(E.travel + 0.5);
check(!EE.fight && !EE.lure && G.roomAt(player.pos.x, player.pos.z).id === 'R10', 'se acaba el tiempo: te escupe a la playa sin el cebo');
check(roundState.bossPending || state.zombies.some(z => z.boss || z.dog), 'y salen bosses y perros');
const back = EE.lureBackRound;
check(back === state.round + E.punish.lureRounds, 'el cebo vuelve en ' + E.punish.lureRounds + ' rondas');
state.round = back; run(0.2);
check(EE.cap.state === 'ready', 'a esa ronda está otra vez en la cabina');

// 14) el bote: te saca sin castigo
fresh(); EE.step = 6; EE.lure = true; G.eeCalm(true); G.eeStartFight(); run(E.travel + 0.3);
setPlayer(A.x + A.boat[0], A.z + A.boat[1] - 2);
G.eeUse({ k: 'boat' });
run(FC.boat + E.travel + 0.5);
check(!EE.fight && !roundState.bossPending && G.roomAt(player.pos.x, player.pos.z).id === 'R10', 'el bote te saca, sin castigo');

// 15) morir en la arena es game over (y resetGame limpia todo, también la tormenta)
fresh(); EE.step = 6; EE.lure = true; G.eeCalm(true); G.eeStartFight(); run(E.travel + 0.3);
state.perks.length = 0; state.lastDamageTime = -99;
G.damagePlayer(9999, A.x, A.z, true);
check(state.gameOver, 'morir en la pelea es game over');
G.resetGame();
check(!EE.fight && !K.arena.visible && EE.step === 0 && !EE.storm && G.THEMEFX.sea.far.visible, 'resetGame borra el easter egg (y la tormenta)');

// 16) la tecla L (debug): directo a la pelea con Perkaholic y la Ray Gun mejorada
fresh();
G.debugKey('KeyL', false);
run(E.travel + 0.3);
check(EE.fight && G.PERK_KEYS.every(k => G.hasPerk(k)) && state.weapons[0].id === 'raygun' && state.weapons[0].pap, 'L: a la pelea con Perkaholic y la Ray Gun con PaP');
check(state.weapons.some(w => w.id === 'wave') && !state.weapons.some(w => w.id === 'leviathan'), 'y la Ola Rompiente en lugar de la LEVIATHAN');
const hpL = G.maxHealth();
check(hpL === E.debugHpMul * CONFIG.PERKS.juggHealth && state.health === hpL, 'y ' + E.debugHpMul + '× de vida', `(${hpL})`);
G.resetGame();
check(G.maxHealth() === CONFIG.PLAYER.maxHealth, 'la vida extra se va al terminar la partida');

console.log(fail ? `\n${fail} FALLAS` : '\nF5.29 OK');
process.exit(fail ? 1 : 0);
