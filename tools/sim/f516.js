// V2 F5.16 tanda A: niebla permanente (30 m, camera.far, fondo = niebla, sin domo), lluvia siempre en el templo
// y en el claro del búnker (adentro del búnker no), el oso de la caja devuelve lo pagado, techo sin escaleras,
// muelle de un solo acceso con Jugg al final, generador en el rancho, plantas en los jardines.
const G = require('./harness.js');
const { state, player, CONFIG, WORLD, RAIN, BOX, roundState, UP } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, F = CONFIG.FOG;
function fresh() { G.resetGame(); state.running = true; roundState.phase = 'active'; player.pos.set(0, 1.7, -10); }
function clearAll() { for (const q of state.zombies.slice()) { q.active = false; q.alive = false; q.root.visible = false; } state.zombies.length = 0; }
function rain(s) { for (let i = 0; i < Math.round(s * 60); i++) { G.tick(dt); G.updateNight(dt); G.updateRain(dt); } }

// 1) niebla
fresh();
check(G.scene.fog.far === F.far && G.scene.fog.near === F.near, 'niebla permanente a ' + F.far + ' m');
check(G.camera.far === F.clip && F.clip > F.far && F.clip < F.far + 10, 'no se dibuja más allá de ' + F.clip + ' m (camera.far)');
check(G.scene.background === G.scene.fog.color && !WORLD.sky.visible, 'el fondo es el color de la niebla (mismo objeto) y el domo no se ve');
check(CONFIG.BOSS.fogFar < F.far && CONFIG.WEATHER.purple.fogFar < F.far, 'el boss y la neblina morada la cierran más');
check(CONFIG.GFX.shadowBox <= 2 * F.clip, 'la caja de sombras no pasa de lo que se ve');

// 1b) niebla configurable en Ajustes (menos niebla = más lejos se dibuja)
fresh(); for (let i = 0; i < 10; i++) { G.tick(dt); G.updateBoss(dt); }
G.setFog(60); for (let i = 0; i < 10; i++) { G.tick(dt); G.updateBoss(dt); }
check(Math.abs(G.scene.fog.far - 60) < 1e-6 && G.camera.far === 64 && G.SETTINGS.fog === 60, 'Ajustes: niebla a 60 m (camera.far 64)', `(${G.scene.fog.far}, ${G.camera.far})`);
check(G.setFog(5) === F.min && G.setFog(500) === F.max, 'con tope (' + F.min + '..' + F.max + ' m)');
G.setFog(F.far);
check(G.scene.fog.far === F.far && G.camera.far === F.clip, 'vuelve a la normal');

// 2) lluvia por zona (ronda 1, sin lluvia de ronda)
fresh(); state.round = 1; G.setSky(1, false);
rain(0.2);
check(!RAIN.lines.visible, 'en la playa en R1 no llueve');
const T = CONFIG.TEMPLE.top;
player.pos.set((T.x1 + T.x2) / 2 - 12, 1.7, (T.z1 + T.z2) / 2); rain(0.2);
check(G.roomAt(player.pos.x, player.pos.z).id === 'R20' && RAIN.lines.visible, 'en el templo llueve siempre');
player.pos.set(-60, 1.7, 62); rain(0.2);
check(G.roomAt(-60, 62).id === 'R17' && RAIN.lines.visible, 'en el claro del búnker llueve siempre');
player.pos.set(-24, -8 + 1.7, -78); rain(0.2);
check(G.inBunker() && !RAIN.lines.visible, 'adentro del búnker no');
player.pos.set(0, 1.7, -10); rain(0.2);
check(!RAIN.lines.visible, 'al volver a la playa se corta');

// 3) el oso devuelve (doble puntos no la duplica)
fresh(); G.debugOpenAllDoors();
state.effects.doublePoints = 30; BOX.paid = 950; state.points = 0;
const e0 = G.STATS.pointsEarned; G.refundBox();
check(state.points === 950 && G.STATS.pointsEarned === e0 && BOX.paid === 0, 'refundBox: 950 exactos, sin doble puntos ni estadísticas');
G.refundBox();
check(state.points === 950, 'no devuelve dos veces');

// 4) mapa de la tanda A
check(!UP.flights.some(S => !S.stone && S !== CONFIG.SHELL.ramp) && !G.walkAt(0, 11) && !G.walkAt(20, 25), 'techo de la casa: sin escaleras ni pasarela (F5.17: la escalera del caparazón no cuenta)');
check(!state.doors.D18 && !G.roomAt(-17, -35), 'muelle de un solo acceso (sin D18 ni segundo tronco)');
const J = CONFIG.PERKS.list.jugg;
check(G.roomAt(J.x, J.z).id === 'R11' && J.z < -49, 'Juggernog al final del muelle');
check(CONFIG.GENERATORS.spots.caseta.room === 'R14' && G.roomAt(CONFIG.GENERATORS.spots.caseta.x, CONFIG.GENERATORS.spots.caseta.z).id === 'R14', 'un generador en el rancho (clave caseta)');
check(CONFIG.GARDEN.plants.every(([x, z]) => ['R12', 'R13'].includes(G.roomAt(x, z).id)), 'plantas en los jardines de la casa');
check(CONFIG.SHIELD.bench.room === 'R6' && !CONFIG.SHIELD.bench.level, 'banco del escudo en el garaje');

// F5.16b: el techo del santuario frena la lluvia
{ const S = CONFIG.TEMPLE.sanctum, cx = (S.x1 + S.x2) / 2, cz = (S.z1 + S.z2) / 2;
  check(G.rainRoof(cx, cz) > UP.y + 4 && G.rainRoof(cx, S.z1 - 3) === UP.y && G.rainRoof(60, 60) < 1, 'la lluvia frena en el techo del santuario (en la cima, en la piedra; abajo, en el piso)'); }

// 5) tanda B: 5 áreas. Casa ↔ Rancho (D20), Casa ↔ Templo (H6), Rancho ↔ Búnker (H2), Rancho ↔ Calamar (H8)
const nav = (x, z) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (G.flowAt(Math.floor(x) + dx, Math.floor(z) + dz) >= 0) return true; return false; };
function reachWith(open) { G.resetGame(); state.running = true; open.forEach(G.openDoor); player.pos.set(0, 1.7, 0); G.updateFlowField(true); }
const casa = Object.keys(state.doors).filter(id => /^D/.test(id) && id !== 'D20');
check(!state.doors.H3 && !state.doors.H4 && !state.doors.H5 && !state.doors.H7 && !G.ROOMS.some(r => r.id === 'R18'), 'sin Campamento (R18) ni H3, H4, H5, H7');
reachWith(casa.concat(['H2']));
check(!nav(-50, 30) && !nav(-60, 64) && !nav(-60, -10), 'sin el lazo, desde la casa no se llega a pie al rancho, al búnker ni al calamar');
reachWith(casa.concat(['H8']));
check(nav(-60, -10) && !G.WORLD.beachWall.col.solid, 'F5.17b: con H8 abierta se va la pared oeste de la playa: el calamar se abre desde la playa');
G.resetGame();
check(G.WORLD.beachWall.col.solid && G.WORLD.hitMeshes.includes(G.WORLD.beachWall.mesh), 'resetGame: la pared vuelve');
reachWith(casa.concat(['D20']));
check(nav(-50, 30) && !nav(-60, 64) && !nav(-60, -10) && !nav(70, 60), 'con el lazo: el rancho sí; búnker, calamar y templo no');
reachWith(casa.concat(['D20', 'H2', 'H8']));
check(nav(-60, 64) && nav(-60, -10), 'desde el rancho: búnker (H2) y calamar (H8)');
reachWith(casa.concat(['H6']));
check(nav(70, 60) && !nav(-60, -10), 'desde la casa: templo (H6); el calamar a pie no');
check(!nav(-30, -15) || G.WORLD.colliders.some(c => c.tag === 'hedge' && c.minX < -40.5 && c.maxX > -41.5 && c.minZ <= -14 && c.maxZ >= -9), 'la playa oeste y el calamar: cerco fijo entero en x -41');

// 6) portal Templo ↔ Calamar: al principio una tumba; un tiro la hace sangrar y aparecen los arcos
const PT = CONFIG.PORTAL, THREE = require('three'), _o = new THREE.Vector3(0, 0, -1);
function aimAt(x, y, z) { G.feel.eye.copy(player.pos); G.feel.aimQuat.setFromUnitVectors(_o, new THREE.Vector3(x, y, z).sub(G.feel.eye).normalize()); }
function shoot() { G.weaponsState.phase = 'idle'; G.weaponsState.lastShot = -1e9; G.tick(1); G.fireWeapon(); }
function bunkerTicks(n) { for (let i = 0; i < n; i++) { G.tick(dt); G.updateBunker(dt); } }
fresh(); G.debugOpenAllDoors(); G.scene.updateMatrixWorld(true);
player.pos.set(PT.temple.x, 1.7, PT.temple.z + 2); G.updateInteract();
check(!G.portalOn() && G.PORTAL.tomb.visible && !G.PORTAL.arcs.some(A => A.arc.visible) && G.interactState.kind !== 'portal', 'al principio no hay portal: hay una tumba');
aimAt(PT.temple.x, 1, PT.temple.z); shoot();
check(G.PORTAL.bleedT > 0 && !G.portalOn(), 'un tiro a la tumba: sangra (todavía no hay portal)');
bunkerTicks(Math.ceil(PT.bleed * 60) + 2);
check(G.portalOn() && !G.PORTAL.tomb.visible && G.PORTAL.arcs.every(A => A.arc.visible) && !G.WORLD.hitMeshes.includes(G.PORTAL.tombHit), 'después se abre: los dos arcos, sin tumba');
G.updateInteract();
check(G.interactState.kind === 'portal' && /Squid/.test(G.promptFor(G.interactState).text), 'cartel del portal', `("${G.promptFor(G.interactState).text}")`);
clearAll();
const chaser = G.spawnZombie(); chaser.state = 'walk'; chaser.px = PT.temple.x + 3; chaser.pz = PT.temple.z + 4; chaser.level = 0;
const far = G.spawnZombie(); far.state = 'walk'; far.px = 0; far.pz = -10; far.level = 0;
check(G.interact(), 'F lo usa');
bunkerTicks(90);
check(Math.hypot(player.pos.x - PT.squid.out[0], player.pos.z - PT.squid.out[1]) < 0.01 && G.roomAt(player.pos.x, player.pos.z).id === 'R19', 'aparece en la playa del calamar');
const dc = Math.hypot(chaser.px - PT.squid.out[0], chaser.pz - PT.squid.out[1]);
check(dc < 9 && G.roomAt(chaser.px, chaser.pz).id === 'R19' && chaser.alive, 'el zombie que me seguía sale cerca del otro portal', `(${dc.toFixed(1)} m)`);
check(Math.hypot(far.px, far.pz + 10) < 1, 'el que estaba lejos se queda');
G.updateInteract();
check(G.interactState.kind === 'portal' && !G.interact() && /recharging/.test(G.promptFor(G.interactState).text), 'recién llegado: el portal se recarga (no te devuelve)');
bunkerTicks(Math.ceil(PT.cooldown * 60) + 5); G.updateInteract();
check(G.interact(), 'a los ' + PT.cooldown + ' s se puede volver');
bunkerTicks(90);
check(Math.hypot(player.pos.x - PT.temple.out[0], player.pos.z - PT.temple.out[1]) < 0.01, 'vuelve al templo');
check(G.openRooms().includes('R19') && G.openRooms().includes('R20'), 'la caja puede mudarse por el portal (openRooms)');
check(nav(PT.temple.out[0], PT.temple.out[1]) && nav(PT.squid.out[0], PT.squid.out[1]), 'las salidas del portal son caminables');
G.resetGame();
check(!G.portalOn() && G.PORTAL.tomb.visible && G.WORLD.hitMeshes.includes(G.PORTAL.tombHit), 'resetGame: vuelve la tumba');

// 7) templo pegado a la esquina y rampas que los zombies no cruzan de costado
fresh(); G.debugOpenAllDoors(); player.pos.set(70, 1.7, 60); G.updateFlowField(true);
let behind = 0;
for (let x = 75; x < 95; x++) for (let z = 97; z < 100; z++) if (G.flowAt(x, z) >= 0) behind++;
for (let x = 92; x < 95; x++) for (let z = 55; z < 100; z++) if (z > 80 && G.flowAt(x, z) >= 0) behind++;
check(behind === 0, 'no se camina por detrás del templo (norte y este)', `(${behind} celdas)`);
check(CONFIG.TEMPLE.ramps.every(R => !G.isNav(Math.floor((R.x1 + R.x2) / 2), Math.floor((R.z1 + R.z2) / 2))) &&
  G.WORLD.colliders.filter(c => c.tag === 'bound:rampa').every(c => c.zombieOnly), 'la huella de las rampas bloquea a los zombies del piso (solo a ellos)');
check(CONFIG.TEMPLE.ramps.every(R => G.flowAt(R.bottom[0], R.bottom[1]) >= 0), 'y el pie de cada rampa sigue enlazado');

// 8) tanda C: tortugario del tamaño del rancho, cueva con la última tortuga, sin corral
{ const R = CONFIG.RANCHO, PN = R.pen, CV = R.cave, TC = CONFIG.TRAPS.turtles;
  fresh(); G.debugOpenAllDoors(); player.pos.set(-49, 1.7, 30); G.updateFlowField(true);
  check(G.roomAt((PN.x1 + PN.x2) / 2, (PN.z1 + PN.z2) / 2).id === 'R14' && (PN.x2 - PN.x1) * (PN.z2 - PN.z1) >= 14 * 22, 'el tortugario es parte del rancho y del tamaño del rancho');
  let open = 0, tot = 0;
  for (let x = PN.x1; x < PN.x2; x++) for (let z = PN.z1; z < PN.z2; z++) { tot++; if (G.flowAt(x, z) >= 0) open++; }
  check(open / tot > 0.6, 'se corre por el tortugario (celdas alcanzables desde el rancho)', `(${open}/${tot})`);
  check(!G.WORLD.colliders.some(c => c.tag === 'corral') && G.WORLD.colliders.some(c => c.tag === 'prop:cueva'), 'sin el corral chico; la cueva es sólida');
  check(TC.count === 1 && Math.abs(TC.exit.x - CV.mouth.x) < 0.01 && Math.abs(TC.exit.z - CV.mouth.z) < 0.01 && G.roomAt(TC.lever.x, TC.lever.z).id === 'R14', 'una sola tortuga, sale de la boca de la cueva; la palanca al lado');
  check(G.SPAWN_POINTS.filter(s => s.room === 'R14' && s.x < PN.x2).every(s => s.valid && G.flowAt(s.cx, s.cz) >= 0), 'spawns del tortugario válidos'); }

// 9) F5.17: el caparazón de la tortuga gigante (reemplaza a la estación de policía de la tanda D)
{ const S = CONFIG.SHELL, D = state.doors[S.door.id], NAVI = G.navIdx;
  fresh(); G.debugOpenAllDoors();
  check(D && D.cost === S.door.cost && G.DOOR_LINKS[S.door.id].join() === 'R17,R21', 'barricada D21 (' + S.door.cost + ') en la boca del caparazón');
  check(!G.ROOMS.some(r => /POLICE|CORRIDOR|MINI BUNKER/.test(r.name)), 'sin la estación de policía, el corredor ni el búnker chico');
  check(G.roomAt(S.x, S.z).id === 'R21' && G.roomAt(S.x, S.z + S.b - 2).id === 'R21' && G.roomAt(S.x, S.z + S.b + 2).id === 'R17', 'adentro es R21; atrás, el patio del claro');
  check(S.z + S.b >= 90 && G.roomAt(-51, 94).id === 'R17' && G.roomAt(-65.5, 81).id === 'R17' && G.roomAt(-36.5, 81).id === 'R17', 'llega a z 92 y el claro lo rodea (se le da la vuelta)');
  check(G.WORLD.colliders.filter(c => c.tag === 'shell').length > 40 && G.WORLD.colliders.filter(c => c.tag === 'shell').every(c => !G.standable(c)), 'borde sólido de cajas (no se pisa)');
  // entrada: solo por la boca
  player.pos.set(-60, 1.7, 60); G.closeDoor(S.door.id); G.buildNavGrid(); G.updateFlowField(true);
  check(G.flowAt(-60, 60) >= 0 && G.flowAt(-65, 90) >= 0 && G.flowAt(-51, 88) < 0 && G.flowAt(-60, 81) < 0, 'con la barricada cerrada no se entra (el borde no tiene huecos) y el patio de atrás se recorre');
  G.openDoor(S.door.id); G.updateFlowField(true);
  check(G.flowAt(-51, 88) >= 0 && G.flowAt(-60, 81) >= 0 && G.flowAt(-42, 81) >= 0, 'abierta: se da la vuelta adentro');
  // entrepiso a UP.y con la escalera
  const [ox1, ox2, oz1, oz2] = S.deck.outer, [ix1, ix2, iz1, iz2] = S.deck.inner;
  let up = 0, bad = 0;
  for (let x = ox1; x < ox2; x++) for (let z = oz1; z < oz2; z++) {
    const inner = x >= ix1 && x < ix2 && z >= iz1 && z < iz2;
    if (G.isUp(x, z)) up++; if (inner === G.isUp(x, z)) bad++;
  }
  check(up >= (ox2 - ox1) * (oz2 - oz1) - (ix2 - ix1) * (iz2 - iz1) - 2 && bad <= 2,   // F5.17b: Stamin-Up tapa 2 celdas
        'entrepiso: un anillo de 3 m a ' + G.UP.y + ' m alrededor del hueco', `(${up} celdas)`);
  const R = S.ramp, a = NAVI(R.bottom[0], R.bottom[1]), b = G.upIdx(R.top[0], R.top[1]);
  check(G.UP.flights.includes(R) && G.NAV.link[a] === b && G.NAV.link[b] === a, 'la escalera enlaza el piso con el entrepiso');
  player.pos.set(-51.5, G.UP.y + 1.7, 85.5); G.updateFlowField(true);
  check(G.flowAt(-60, 81) >= 0 && G.flowAt(-51, 72) >= 0, 'con el jugador arriba, los de abajo llegan (por la escalera)');
  check(G.floorAt(-51.5, 85.5, G.UP.y + 0.01) === G.UP.y && G.levelAt(-51.5, 85.5, G.UP.y) === 1 && G.levelAt(-51.5, 85.5, 0) === 0, 'arriba se pisa y es el nivel 1; abajo del entrepiso, el piso');
  check(G.WORLD.colliders.some(c => c.tag === 'roofrail' && c.minX > ox1 - 0.2 && c.maxX < ox2 + 0.2 && c.minZ > oz1 - 0.2 && c.maxZ < oz2 + 0.2), 'barandas en el entrepiso');
  const K = CONFIG.PERKS.list.stamin, GN = CONFIG.GENERATORS.spots.garaje, U = CONFIG.WALLBUYS.find(w => w.weapon === 'uzi');
  check(G.roomAt(K.x, K.z).id === 'R21' && G.roomAt(GN.x, GN.z).id === 'R21' && G.roomAt(U.x, U.z - 0.5).id === 'R21' && U.level === 1, 'Stamin-Up y un generador adentro, la Uzi en el entrepiso');
  const J = S.jump;
  check(K.level === 1 && !G.WORLD.colliders.some(c => c.tag === 'roofrail' && c.minZ < J[1] + 0.2 && c.maxZ > J[1] - 0.2 && c.maxX > J[2] + 0.1 && c.minX < J[3] - 0.1), 'F5.17b: Stamin-Up arriba y hueco en la baranda para tirarse');
  check(G.PROPS.filter(p => p.id.startsWith('shellPost')).every(p => p.collider && G.roomAt((p.box[0] + p.box[1]) / 2, (p.box[2] + p.box[3]) / 2).id === 'R21'), 'postes del entrepiso sólidos');
  // lluvia: la cúpula la frena, salvo el tragaluz
  check(Math.abs(G.rainRoof(S.x + 7, S.z) - S.h * Math.sqrt(1 - (7 / S.a) ** 2)) < 1e-6 && G.rainRoof(S.x, S.z) <= 0.01 && G.rainRoof(S.x, S.z + S.b + 2) <= 0.01, 'la cúpula frena la lluvia; por el tragaluz entra');
  // los 3 que comen: figuras al principio, zombies de verdad al abrir
  G.resetGame(); state.running = true; clearAll();
  check(G.POLICE.feeders.length === 3 && G.POLICE.feeders.every(f => f.g.visible) && !G.POLICE.woke && state.zombies.length === 0, '3 zombies comiéndose a un policía adentro (dibujo, no cuentan)');
  G.updatePolice(dt, 1);
  check(!G.POLICE.woke, 'con la barricada cerrada siguen comiendo');
  G.openDoor(S.door.id); G.updatePolice(dt, 1.1);
  const woke = state.zombies.filter(q => q.alive && G.roomAt(q.px, q.pz) && G.roomAt(q.px, q.pz).id === 'R21');
  check(G.POLICE.woke && G.POLICE.feeders.every(f => !f.g.visible) && woke.length === 3 && woke.every(q => q.state === 'walk' && q.fromClam), 'al comprar la barricada se paran: 3 zombies de verdad (extra)', `(${woke.length})`);
  G.resetGame();
  check(!G.POLICE.woke && G.POLICE.feeders.every(f => f.g.visible), 'resetGame: vuelven a comer'); }

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
