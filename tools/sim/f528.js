// V2 F5.28e: catacumbas mayas (R23) y cueva (R24) con la entrada del búnker, la puerta de las 3 palancas, el HUD de
// golpes, la pantalla de carga, la caja en cualquier lugar, el techo maya del templo y la canción de las máquinas
const G = require('./harness.js');
const { state, player, CONFIG, roundState } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, P = CONFIG.PLAYER, C = CONFIG.CATA, B = CONFIG.BUNKER;
CONFIG.POWERUPS.dropChance = 0;
function fresh(open) { G.resetGame(); state.running = true; state.round = 8; roundState.phase = 'active'; state.points = 50000; state.health = 100; if (open !== false) G.debugOpenAllDoors(); }
function setPlayer(x, z) { player.pos.set(x, G.groundY(x, z) + P.height, z); player.vel.set(0, 0, 0); G.updateFlowField(true); }
const reach = (x, z) => G.flowAt(Math.floor(x), Math.floor(z)) >= 0;

// 1) los cuartos y el piso
fresh();
check(G.ROOMS.some(r => r.id === 'R23') && G.ROOMS.some(r => r.id === 'R24'), 'las catacumbas (R23) y la cueva (R24) son cuartos');
check(C.rects.every(r => r.slice(1, 5).every(Number.isInteger)), 'los lugares caminables van en metros enteros');
check(G.groundY(10, 45.5) === C.y && G.groundY(-25, 60) === C.y, 'el piso de las catacumbas y de la cueva está en CATA.y', `(${G.groundY(10, 45.5)}, ${G.groundY(-25, 60)})`);
const e0 = C.ramps[0], mid = G.groundY((e0.x1 + e0.x2) / 2, (e0.z1 + e0.z2) / 2);
check(Math.abs(G.groundY(30.5, e0.z1 + 0.01)) < 0.1 && Math.abs(mid - (e0.y1 + e0.y2) / 2) < 0.1, 'la bajada desde la liana H6 va de 0 a -6', `(medio ${mid.toFixed(2)})`);
check(C.ramps.slice(1, 4).every(R => Math.abs(G.groundY(R.x2 - 0.01, (R.z1 + R.z2) / 2)) < 0.1), 'las 3 subidas al templo llegan al suelo de arriba');
// nada caminable de arriba pisa las celdas techadas
let clash = null;
for (const [id, x1, x2, z1, z2] of C.rects) for (let x = x1 + 0.5; x < x2 && !clash; x++) for (let z = z1 + 0.5; z < z2; z++) {
  if (G.cataRamp(x, z)) continue;
  const q = G.ROOMS.find(r => !r.under && x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2);
  if (q) { clash = q.id + ' en ' + x + ',' + z; break; }
}
check(!clash, 'ningún cuarto de arriba pisa las catacumbas techadas', clash || '');
check(G.WORLD.colliders.filter(c => c.tag === 'cata').length > 30, 'las paredes de roca son colliders', `(${G.WORLD.colliders.filter(c => c.tag === 'cata').length})`);

// 2) conexiones: desde el jardín (H6) se llega a todo; con la puerta D23 cerrada, al hall se llega por la cueva y el templo
setPlayer(30.5, 38);
const pts = { antesala: [31.5, 64.5], osario: [9.5, 45.5], galeria: [16.5, 71.5], sombreron: [-3, 57], cueva: [-25.5, 60.5], escalera: [0.5, 87.5], templo: [60.5, 62.5], hall: [39.5, 60.5] };
const lost = Object.keys(pts).filter(k => !reach(...pts[k]));
check(!lost.length, 'con todo abierto se llega a todas las partes', lost.join(' '));
fresh(false);
check(state.doors.D23 && !state.doors.D23.open && state.doors.D23.levers, 'la puerta sellada D23 arranca cerrada y es de palancas');
check(G.buyDoor('D23') === false && !state.doors.D23.open, 'la D23 no se compra con puntos');
G.debugOpenAllDoors();
if (state.doors.D23.open) G.closeDoor('D23');
G.buildNavGrid(); setPlayer(-25.5, 60.5);
check(reach(60.5, 62.5) && reach(39.5, 60.5), 'con la D23 cerrada, de la cueva se llega al templo (escalera) y al hall');

// 3) las 3 palancas abren la puerta
fresh();
if (state.doors.D23.open) G.closeDoor('D23');
G.resetCatacombs();
check(G.CATA.levers.length === 3 && G.cataLeversOn() === 0, 'hay 3 palancas y arrancan arriba');
const L0 = G.CATA.levers[0];
setPlayer(L0.x, L0.z);
const room0 = G.roomAt(L0.x, L0.z), near = G.cataLeverNear(room0, L0.x, L0.z, 9);
check(near && near.target === L0, 'parado al lado de una palanca, el prompt la encuentra');
G.pullLever(L0);
check(G.cataLeversOn() === 1 && !state.doors.D23.open, 'una palanca: la puerta sigue cerrada');
check(G.pullLever(L0) === false, 'la misma palanca no cuenta dos veces');
G.pullLever(G.CATA.levers[1]); G.pullLever(G.CATA.levers[2]);
check(state.doors.D23.open && !state.doors.D23.collider.solid, 'con las 3, la puerta se abre');
G.resetGame();
check(G.cataLeversOn() === 0 && !state.doors.D23.open, 'resetGame vuelve a subir las palancas y cierra la puerta');

// 4) la entrada del búnker, las estatuas y la lápida están en la cueva, a la altura de su piso
fresh();
const ent = G.WORLD.colliders.filter(c => c.tag === 'bunker:entrada');
check(ent.length && ent.every(c => c.minX >= -42 && c.maxX <= -37 && c.minY >= C.y - 0.5), 'la entrada del búnker está al fondo de la cueva', JSON.stringify(ent.map(c => [c.minX, c.minY])));
check(G.roomAt(B.hatch.out[0], B.hatch.out[1]).id === 'R24' && G.isNav(Math.floor(B.hatch.out[0]), Math.floor(B.hatch.out[1])), 'la salida de la escotilla es caminable en la cueva');
G.openBunker(); setPlayer(B.hatch.out[0], B.hatch.out[1]);
const hn = G.hatchNear(G.roomAt(B.hatch.out[0], B.hatch.out[1]), B.hatch.out[0], B.hatch.out[1], 9);
check(hn && hn.target.down, 'desde la cueva se baja por la escotilla');
check(B.statues.every(s => s.room === 'R24') && G.WORLD.colliders.filter(c => /estatua/.test(c.tag)).every(c => c.minY < C.y + 1), 'las estatuas están en la cueva, en su piso');
setPlayer(-20, 60);
check(reach(B.hatch.out[0], B.hatch.out[1]), 'se llega caminando a la escotilla');

// 5) Speed Cola, la chiclera y la ballesta en la cueva, alcanzables
const sc = CONFIG.PERKS.list.speed, cb = CONFIG.WALLBUYS.find(w => w.weapon === 'crossbow');
check(sc.room === 'R24' && G.roomAt(sc.x, sc.z + 1).id === 'R24', 'Speed Cola en la cueva');
check(cb && cb.room === 'R24' && cb.floorY === C.y, 'la ballesta en la pared de la cueva');
check(reach(sc.x, sc.z + 1) && reach(cb.x + 1, cb.z), 'se llega a Speed Cola y a la ballesta');
const gm = G.GUMM && G.GUMM.machines ? G.GUMM.machines.find(m => m.room === 'R24' || (m.x < -10 && m.z > 40 && m.z < 72)) : null;
check(!!gm, 'hay una chiclera en la cueva');

// 6) los spawns de las catacumbas y de la cueva son válidos
const sps = G.SPAWN_POINTS.filter(s => s.room === 'R23' || s.room === 'R24');
check(sps.length >= 8 && sps.every(s => G.isNav(Math.floor(s.x), Math.floor(s.z))), 'los spawns de abajo están en celdas caminables', `(${sps.length})`);

// 7) las paredes frenan balas: un tiro desde la galería hacia la roca pega en algo
fresh(); setPlayer(16.5, 71.5);
check(G.WORLD.hitMeshes.some(m => m.userData && /cata/.test(m.userData.tag || '')), 'las paredes, pisos y techos están en hitMeshes');

// 8) el HUD de golpes: una esquina por golpe, todas con la vida crítica, y se apaga con vida llena
fresh(); setPlayer(0, 0);
G.HURT.on.fill(0);
G.hurtHit(player.pos.x + 3, player.pos.z);
check(G.HURT.on.filter(Boolean).length === 1, 'un golpe prende una esquina');
G.hurtHit(player.pos.x + 3, player.pos.z); G.hurtHit(player.pos.x - 3, player.pos.z); G.hurtHit(player.pos.x, player.pos.z + 3);
check(G.HURT.on.every(Boolean), 'cuatro golpes prenden las 4 esquinas');
state.health = 5; G.updateHurtHUD(0.2);
check(G.HURT.k[0] > 0, 'con la vida crítica se prende el contorno');
state.health = G.maxHealth(); G.updateHurtHUD(0.2);
check(G.HURT.on.every(v => !v), 'con vida llena se apagan las esquinas');

// 9) la pantalla de carga llama al callback al terminar
let done = 0;
G.startLoading(0.5, true, () => { done++; });
check(G.LOADSCR.on, 'la pantalla de carga se prende');
for (let i = 0; i < 40; i++) G.updateLoading(dt);
check(!G.LOADSCR.on && done === 1, 'al terminar se apaga y llama una vez');

// 10) la caja: después del primer lugar puede ir a cualquiera (hasta el muelle), a la altura del piso del lugar
fresh(); setPlayer(0, 0);
G.placeBox(Object.keys(CONFIG.BOX.spots)[0]);
const dests = G.boxDestinations();
check(dests.length === Object.keys(CONFIG.BOX.spots).length - 1, 'la caja puede ir a cualquier otro lugar', `(${dests.length})`);
check(['R11', 'R12', 'R16'].every(r => CONFIG.BOX.spots[r]), 'hay lugares en el muelle, el embarcadero y el búnker');
G.placeBox('R16');
check(G.BOX.y0 < -3 && Math.abs(G.BOX.collider.minY - G.BOX.y0) < 1e-6, 'en el búnker la caja se apoya en su piso', `(${G.BOX.y0})`);
G.resetBox && G.resetBox();

// 11) el techo maya del templo: alto, con agujeros
const T = CONFIG.TEMPLE, cx = (T.columns.xs[0] + T.columns.xs[1]) / 2;
const zs = []; for (let z = T.top.z1 + 0.25; z < T.top.z2; z += 0.25) zs.push(G.templeRoofAt(cx, z));
check(zs.some(h => h > 10) && zs.some(h => h === 0), 'el techo del templo es alto y tiene agujeros', `(${Math.max(...zs).toFixed(1)})`);

// 12) la canción de la máquina suena al acercarte, aun sin energía
fresh(false); state.power = false;
const m = G.PERKM.machines.speed; m.near = false;
setPlayer(sc.x, sc.z + 2);
G.updatePerks(dt);
check(m.near, 'cerca de Speed Cola (sin energía) suena su canción');
setPlayer(sc.x + 20, sc.z + 20); G.updatePerks(dt);
check(!m.near, 'al alejarte se rearma');

// ---- F5.28f ----
// 13) menú: en el nivel 1 solo se ve la 1911; las armas se reparten hasta el 100; los ítems, desde su nivel
const WL = CONFIG.PROGRESSION.weaponLevels, xp0 = G.PROFILE.xp;
G.PROFILE.xp = 0;
const seen1 = Object.keys(WL).filter(w => G.weaponSeen(w));
check(seen1.length === 1 && seen1[0] === 'm1911', 'en el nivel 1 solo se ve la 1911', seen1.join(','));
check(Math.max(...Object.values(WL)) === 100 && Object.keys(CONFIG.PROGRESSION.weaponCats.flatMap(c => c.ids).reduce((o, w) => (o[w] = 1, o), {})).every(w => WL[w]),
  'todas las armas del menú tienen nivel, hasta el 100');
check(CONFIG.TROPHIES.recipes.every(r => r.level > 1) && !G.canBuyItem('guitar'), 'los ítems tienen nivel y antes no se compran');
G.PROFILE.xp = G.xpForLevel(100);
check(Object.keys(WL).every(w => G.weaponSeen(w)), 'en el 100 se ven todas');
G.PROFILE.xp = xp0;

// 14) luces falsas: un zombie al lado de una antorcha de las catacumbas brilla; lejos, no; los bosses nunca
fresh();
const T0 = G.FLIGHT.list[0];
const zl = G.spawnZombie(); zl.px = T0.x; zl.pz = T0.z; G.placeRoot(zl, 0); zl.root.position.y = T0.y - 1; zl.flash = 0;
G.fakeLightTint(zl);
const em = zl.flashMats[0].emissive;
check(G.FLIGHT.list.length > 30 && em.r > 0.1, 'junto a una antorcha el zombie se ilumina (no queda negro)', `(${G.FLIGHT.list.length} luces, r ${em.r.toFixed(2)})`);
zl.px = 200; zl.pz = 200; G.fakeLightTint(zl);
check(em.r === 0 && em.g === 0, 'lejos de las luces, sin brillo');

// 15) rendimiento: árboles con 3 detalles (el de lejos mucho más liviano); las catacumbas no se dibujan desde la casa
const tri = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
const TG = G.VOXT.geos.broadA;
check(TG.low && tri(TG.low) < tri(TG.far) / 2 && tri(TG.near) < 12000, 'árboles: 3 detalles, el de lejos liviano', `(${tri(TG.near)} / ${tri(TG.far)} / ${tri(TG.low)})`);
setPlayer(0, 5); G.updateCatacombs(dt);
check(G.CATA.meshes.length && G.CATA.meshes.every(m => !m.visible), 'desde la casa las catacumbas no se dibujan');
setPlayer(10, 45.5); G.updateCatacombs(dt);
check(G.CATA.meshes.every(m => m.visible), 'abajo, sí');

// 16) de noche el follaje se oscurece hasta foliage.night y sin luz propia; de día vuelve
G.nightTint(1, 0);
check(Math.abs(G.VOXT.mat.color.r - CONFIG.WEATHER.foliage.night) < 1e-6 && G.VOXT.mat.emissive.r === 0, 'de noche el follaje queda casi negro');
G.nightTint(0, 0);
check(G.VOXT.mat.color.r === 1 && G.VOXT.mat.emissive.r > 0, 'de día vuelve');

// 17) la muerte: tirado de costado, los zombies en abanico delante de la vista y el charco que crece
fresh(false); setPlayer(0, -8);
const ring = [];
for (let i = 0; i < 3; i++) { const q = G.spawnZombie(); q.state = 'walk'; q.px = (i - 1) * 1.2; q.pz = -6.5; G.placeRoot(q, 0); ring.push(q); }
G.DEATH.hitX = 0; G.DEATH.hitZ = -6.5;
G.gameOver();
check(G.DEATH.peek.length === 3 && G.DEATH.peek[0].z === G.DEATH.eater, 'asoman el que te mató y los de alrededor');
for (let i = 0; i < 60 * 4; i++) { G.tick(dt); G.updateDeathCam(dt); }
const ang = G.DEATH.peek.map(p => Math.atan2(p.dx, p.dz)), spread = Math.max(...ang) - Math.min(...ang);
check(Math.abs(G.camera.rotation.z - CONFIG.ROUNDS.death.roll) < 0.1 && spread < Math.PI, 'de costado y los zombies delante (en abanico)', `(roll ${G.camera.rotation.z.toFixed(2)})`);
check(G.DEATH.pool && G.DEATH.pool.visible && G.DEATH.pool.scale.x > 0.3, 'el charco de sangre crece debajo');
G.resetGame();
check(!G.DEATH.pool.visible && ring.every(q => q.root.rotation.x === 0), 'al terminar: sin charco y nadie queda inclinado');

// 18) la linterna se sacó (Diego, F5.28f): no hay accesorio, y una cuenta vieja que la tenía queda limpia
const AT = CONFIG.PROGRESSION.attachments, WA = CONFIG.PROGRESSION.weaponAtt;
check(!AT.flashlight && !Object.keys(WA).some(w => WA[w].includes('flashlight')), 'no hay linterna');
G.PROFILE.loadout.m1911 = { att: ['flashlight', 'quickdraw'], camo: null }; G.PROFILE.wxp = { m1911: 1e7 };
G.sanitizeLoadout();
check(G.PROFILE.loadout.m1911.att.indexOf('flashlight') < 0, 'una carga vieja con la linterna queda sin ella (sin romper)');
G.PROFILE.loadout.m1911 = { att: [], camo: null }; G.PROFILE.wxp = {};

// 19) fuego en cubos: cada fuego del templo, el rancho y las catacumbas es un grupo de cubos en un solo InstancedMesh
check(G.VFIRE.list.length >= 40 && G.VFIRE.mesh && G.VFIRE.mesh.count === G.VFIRE.list.length * (CONFIG.VOXFIRE.cubes + 1), 'los fuegos son cubos (un solo InstancedMesh)', `(${G.VFIRE.list.length} fuegos)`);

// 20) la muerte: el GAME OVER sale enseguida (la tablita, en la pantalla negra)
fresh(false); setPlayer(0, 0);
G.gameOver();
// (el classList del harness es de mentira: se mira que la cinemática arrancó y la tablita todavía no)
check(G.DEATH.on && !G.DEATH.card && CONFIG.ROUNDS.death.dark === 0 && CONFIG.ROUNDS.death.blur > 0, 'al morir: cinemática que se nubla hasta negro, sin la tablita todavía');
G.resetGame();

console.log(fail ? `\n${fail} FALLAS` : '\nF5.28e OK');
process.exit(fail ? 1 : 0);
