// V2 F5.15: mapa por áreas. Tanda 1: pirañas solo de cerca, cabeza del calamar más grande (techo alto, túnel
// ancho), torre de salvavidas en la playa oeste (estilo rancho, 6 patas, revólver).
const G = require('./harness.js');
const { state, player, CONFIG, roundState, SQHEAD } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, P = CONFIG.PLAYER;
CONFIG.POWERUPS.dropChance = 0;
function fresh() { G.resetGame(); state.running = true; state.round = 8; roundState.phase = 'active'; state.points = 50000; state.health = 100; G.debugOpenAllDoors(); }
function setPlayer(x, z) { player.pos.set(x, G.groundY(x, z) + P.height, z); G.updateFlowField(true); }
const nearNav = (x, z) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (G.flowAt(Math.floor(x) + dx, Math.floor(z) + dz) >= 0) return true; return false; };

// 1) pirañas: solo de cerca
fresh();
const PZ = CONFIG.GARDEN.piranhas;
function jumps(x, z, secs) {
  player.pos.set(x, P.height, z);
  let n = 0;
  for (let i = 0; i < Math.round(secs * 60); i++) {
    const before = G.PIRANHAS.zones.map(zn => zn.last);
    G.tick(dt); G.updateGarden(dt);
    G.PIRANHAS.zones.forEach((zn, k) => { if (zn.last !== before[k]) n++; });
    state.health = 100; state.lastDamageTime = -99;
  }
  return n;
}
check(jumps(0, 10, 6) === 0, 'con el jugador en la sala no salta ninguna');
check(jumps(0, -28, 6) >= 4, 'parado en el muelle saltan las de ahí', '');
const far = jumps(0, -28, 3), zones = G.PIRANHAS.zones.filter(zn => zn.near).length;
check(zones >= 1 && zones <= 2, 'solo las zonas cercanas', `(${zones} de ${G.PIRANHAS.zones.length})`);
check(PZ.near === 12, 'a menos de 12 m');

// 2) cabeza del calamar
fresh();
const H = CONFIG.SQUIDHEAD, [tx1, tx2] = H.tunnel;
// F5.22 la agrandó (20 × 34 × 13.5): se pide al menos lo de F5.15
check(H.x2 - H.x1 >= 16 && H.z2 - H.z1 >= 24 && H.h >= 9, 'cabeza de al menos 16 × 24 m y 9 m de alto (' + (H.x2 - H.x1) + ' × ' + (H.z2 - H.z1) + ' × ' + H.h + ')');
const shrimpTop = 2.35 * CONFIG.QUEST.shrimp.scale;                       // antenas del langostino (local ~2.35)
check(shrimpTop < H.chamberH && H.tunnelH >= 4.5, 'el langostino entra en la cámara (techo a ' + H.chamberH + ' m)', `(${shrimpTop.toFixed(1)} m)`);
G.setSquidHead(H.openRound, true);
const hx = (tx1 + tx2) / 2;                                               // F5.19: la cabeza se mudó al mar
setPlayer(hx, H.z2 + 2);
let minW = 99;
for (let z = Math.ceil(H.tunnel[2]); z < H.tunnel[3]; z++) { let w = 0; for (let x = Math.floor(tx1); x < tx2; x++) if (G.isNav(x, z)) w++; minW = Math.min(minW, w); }
check(minW >= 4, 'túnel de 4 celdas o más de ancho', `(${minW})`);
check(nearNav(hx, H.z2 - 17) && nearNav(hx - 4, H.z2 - 20) && nearNav(hx + 4, H.z2 - 20), 'la cámara se recorre (con lugar entre las estatuas)');
const Q = CONFIG.QUEST, CH = H.chamber;
check([Q.turtle, Q.shrimp, CONFIG.BUNKER.seahorse].every(T => T.x > CH[0] && T.x < CH[1] && T.z > CH[2] && T.z < CH[3]), 'las estatuas en la cámara');
check(G.roomAt(Q.shellLand.x, Q.shellLand.z).id === 'R22' && Q.shellLand.z > H.z2 && nearNav(Q.shellLand.x, Q.shellLand.z), 'la caracola cae enfrente de la boca');

// 3) torre de salvavidas
fresh();
const L = CONFIG.LIFEGUARD;
check(L.w >= 6 && G.PROPS.filter(p => /^torre\d$/.test(p.id) && p.collider).length === 6, 'torre más larga, 6 patas sólidas');
check(Math.abs(L.x - 14.4) < 1 && Math.abs(L.z + 22) < 1, 'F5.19: en la playa de la casa, lado este (~ 14.4, -22)', `(${L.x}, ${L.z})`);
setPlayer(L.x, L.z + 4);
check(nearNav(L.x, L.z) && nearNav(L.x - 2, L.z) && nearNav(L.x + 2, L.z), 'se camina por debajo');
const rv = CONFIG.WALLBUYS.find(w => w.weapon === 'revolver');
player.pos.set(rv.x, P.height, rv.z + 1.2); G.updateInteract();
check(G.interactState.kind === 'wall' && G.interactState.target.weapon === 'revolver', 'el revólver se compra en su tablón');
check(!G.JUNGLE.trees.some(t => Math.abs(t.x - L.x) < L.w / 2 + 2 && Math.abs(t.z - L.z) < L.d / 2 + 2), 'ningún árbol de la jungla encima de la torre');

// 4) Tanda 2: búnker en la esquina NO, medio destruido; estatuas con kills de cualquier tipo
fresh();
const B = CONFIG.BUNKER, E = B.entrance;
// F5.28e: la entrada se mudó al fondo (oeste) de la cueva de las catacumbas y mira al este (axis 'x')
check(E.x1 < -37 && E.axis === 'x' && E.face === 1 && G.roomAt(B.hatch.out[0], B.hatch.out[1]).id === 'R24',
  'F5.28e: la entrada está al fondo de la cueva (R24), mirando al este', `(${(E.x1 + E.x2) / 2}, ${B.hatch.z})`);
check(G.WORLD.colliders.some(c => c.tag === 'bunker:entrada' && c.solid && c.minX === E.x1 && c.maxZ === E.z2), 'el bloque de la entrada es sólido');
setPlayer(B.hatch.out[0], B.hatch.out[1] - 3);
check(nearNav(B.hatch.out[0], B.hatch.out[1]) && G.isNav(B.hatch.cell[0], B.hatch.cell[1]), 'se llega al frente y la celda del enlace es navegable');
check(B.statues.every(s => G.PROPS.find(p => /^estatua/.test(p.id) && Math.abs((p.box[0] + p.box[1]) / 2 - s.x) < 1e-6 && Math.abs((p.box[2] + p.box[3]) / 2 - s.z) < 1e-6)),
  'las macetas de las estatuas van con ella');
check(G.BUNK.statues.every(s => Math.abs(s.head.rotation.y - Math.PI / 2) < 1e-6), 'las estatuas miran hacia afuera (F5.28e: al este)', G.BUNK.statues.map(s => s.head.rotation.y.toFixed(3)).join(' '));
check(!G.JUNGLE.trees.some(t => t.x > E.x1 - 3 && t.x < E.x2 + 3 && t.z > E.z1 - 7 && t.z < E.z2), 'ningún árbol tapa el frente');
// despiertan con 5 kills de cualquier tipo cerca
const s1 = G.BUNK.statues[0];
for (let i = 0; i < B.wakeKills; i++) {
  const q = G.spawnZombie(); q.state = 'walk'; q.px = s1.x + 0.5; q.pz = s1.z - 2; G.damageZombie(q, 1e9, false);
  q.active = q.alive = false; state.zombies.length = 0;
}
check(s1.awake, B.wakeKills + ' zombies comunes la despiertan');
G.resetGame();
check(!s1.awake && s1.kills === 0, 'resetGame: de piedra');

// 5) Tanda 3: templo en el anexo NE, más grande, PaP adentro del santuario
fresh();
// F5.19: el templo es una nave de lado a lado del área (z 50..100), sin santuario
const T = CONFIG.TEMPLE, PS = CONFIG.PAP.spot, UP = G.UP;
const tcx = (T.top.x1 + T.top.x2) / 2, tcz = (T.top.z1 + T.top.z2) / 2;
check(G.roomAt(tcx - 12, tcz).id === 'R20' && Math.hypot(tcx, tcz - 18) > 90, 'el templo está en el anexo NE, lejos de la casa', `(${Math.hypot(tcx, tcz - 18).toFixed(0)} m)`);
check(T.top.z2 - T.top.z1 >= 45 && T.top.x2 - T.top.x1 >= 15 && !T.sanctum, 'F5.19: una nave de ' + (T.top.z2 - T.top.z1) + ' m de largo (sin santuario)');
check(PS.room === 'R20' && PS.level === 1 && PS.x > T.top.x1 && PS.x < T.top.x2, 'el PaP está arriba de la nave');
// desde el PaP el campo baja por las rampas y llega al sendero
setPlayer(PS.x - 1.5, PS.z); player.pos.y = UP.y + P.height; G.updateFlowField(true);
check(G.FLOW.srcLevel === 1 && G.flowAt(45, 64) > 0 && G.flowAt(30, 50) > 0, 'los zombies llegan a la nave desde el jardín trasero (por el sendero)');
const inside = (x, z) => G.FLOW.dist[G.upIdx(x, z)];                   // (upIdx ya suma NAV.base)
check(inside(Math.floor(T.top.x1) + 3, Math.floor(T.top.z1) + 3) >= 0 && inside(Math.floor(T.top.x2) - 5, Math.floor(T.top.z2) - 3) >= 0, 'la nave se recorre de punta a punta');
// la jungla del templo viejo volvió
// (F5.28e: en (45, 70) está la tercera subida de las catacumbas; se mide entre dos subidas)
check(G.inThicket(45, 68.5) && !G.JUNGLE.trees.some(t => G.inThicket(t.x, t.z)), 'donde estaba el templo viejo es espesura (F5.15, tanda 4)');
check(G.JUNGLE.trees.some(t => G.roomAt(t.x, t.z).id === 'R20'), 'el anexo tiene jungla');
check(G.SPAWN_POINTS.filter(s => s.room === 'R20').every(s => s.valid && G.flowAt(s.cx, s.cz) >= 0), 'spawns del anexo válidos y alcanzables');

// 6) Tanda 4: áreas, senderos y entradas
const D = state.doors, C = CONFIG.DOORS;
check(!D.D5 && !D.D9 && !D.D10 && C.D6 === 1250 && C.D7 === 1500, 'casa: sin D5, D9 ni D10; D6 1250 y D7 1500');
const house = ['D1', 'D2', 'D3', 'D4', 'D6', 'D7', 'D8'].reduce((s, id) => s + C[id], 0);
check(house === 8250 && C.D1 + C.D2 + C.D8 === 3250, 'toda la casa: 8.250 (D1 + D2 + D8 = 3250)', `(${house})`);
// áreas: todas abiertas se llega a cada una
fresh(); setPlayer(0, 0);
// F5.19c: el claro se mide en (-60, 59): en (-60, 64) está el peñasco de la catarata
const areas = { 'claro del búnker': [-60, 59], 'costa del calamar': [-60, -10], templo: [70, 60],   // F5.16: sin campamento
  rancho: [-64, 30], 'jardín trasero': [10, 35], 'playa oeste': [-30, -15] };   // F5.19: sin jardines norte
const miss = Object.entries(areas).filter(([, [x, z]]) => !nearNav(x, z)).map(([k]) => k);
check(!miss.length, 'con todo abierto se llega a las 6 áreas de afuera', miss.join(', '));
// la espesura no se camina ni se ve a través
// (F5.28e: (0, 66) cae sobre las catacumbas, que se caminan abajo: se mide en (-5, 66))
check([[-65, 10], [45, 50], [-5, 66], [-35, 5], [45, -18], [60, 80]].every(([x, z]) => G.inThicket(x, z) && G.flowAt(x, z) < 0) ||
  [[-65, 10], [45, 50], [-5, 66], [-35, 5], [45, -18]].every(([x, z]) => G.inThicket(x, z) && G.flowAt(x, z) < 0), 'la espesura no se camina');
const tw = G.WORLD.colliders.filter(c => c.tag === 'thicket');
check(tw.length > 20 && tw.every(c => c.solid && c.maxY >= 3), 'paredes de vegetación sólidas', `(${tw.length} tramos)`);
// F5.19: detrás del jardín trasero (antes jardín norte) es espesura
player.pos.set(10, P.height, 38); player.vel.set(0, 0, 0); player.yaw = 0; G.keys.KeyW = true;   // yaw 0 = hacia -z: da la vuelta
player.yaw = Math.PI;                                                     // hacia +z: a la espesura
for (let i = 0; i < 120; i++) { G.tick(dt); G.updatePlayer(dt); }
G.keys.KeyW = false;
check(player.pos.z < 40, 'la pared de la espesura frena al jugador', `(z ${player.pos.z.toFixed(2)})`);
G.scene.updateMatrixWorld(true);
const THREE = require('three'), rc = new THREE.Raycaster(new THREE.Vector3(10, 1.5, 38), new THREE.Vector3(0, 0, 1), 0, 20);
const hit = rc.intersectObjects(G.WORLD.hitMeshes, false)[0];
check(hit && hit.object.userData.tag === 'thicket', 'y frena las balas', `(${hit && hit.object.userData.tag})`);
// senderos de 4 m o más (3 celdas navegables de ancho como mínimo)
const corridors = G.ROOMS.filter(r => r.corridor);
// F5.28e: los 2 del templo se fueron (los reemplazan las catacumbas)
check(corridors.length === 3 && corridors.every(r => Math.min(r.x2 - r.x1, r.z2 - r.z1) >= 4),
  'F5.16: 3 senderos de 4-5 m (lazo, claro y calamar; F5.28e: los del templo son catacumbas)', `(${corridors.length})`);
// cada área se abre solo por sus entradas
function reach(open) {
  G.resetGame(); state.running = true; open.forEach(G.openDoor);
  player.pos.set(0, P.height, 0); G.updateFlowField(true);
  return ([x, z]) => nearNav(x, z);
}
const base = ['D1', 'D2', 'D3', 'D4', 'D6', 'D7', 'D8', 'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D17', 'D20'];
let r = reach(base);
check(!r(areas['claro del búnker']) && !r(areas['costa del calamar']) && !r(areas.templo), 'sin lianas: ni claro, ni costa, ni templo');
check(r(areas.rancho) && r(areas['jardín trasero']) && r(areas['playa oeste']), 'el rancho (lazo), los jardines y la playa oeste sí');
const via = { H2: 'claro del búnker', H8: 'costa del calamar', H6: 'templo' };   // F5.16
const bad = Object.entries(via).filter(([h, a]) => !reach(base.concat([h]))(areas[a])).map(([h]) => h);
check(!bad.length, 'cada liana abre su área (H2 claro, H8 costa, H6 templo)', bad.join(' '));
check(!reach(base.filter(d => d !== 'D20'))(areas.rancho), 'sin el lazo D20 no se llega al rancho');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
