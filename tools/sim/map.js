// V2 F1: mapa expandido (R8 piscina, R9 caseta, R10 playa, R11 muelle, D8–D12).
// V2 F1.1: puente C13 playa -> piscina (D13) y muelle en T (plataforma para el Pack-a-Punch).
// Conectividad por puerta, límites invisibles (frenan gente, no balas), muelle angosto y piscina con rampa.
const G = require('./harness.js');
const THREE = require('three');
const { state, player, CONFIG, WORLD, keys, POOL } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const room = id => G.ROOMS.find(r => r.id === id);

G.resetGame(); state.running = true;

// 1) cuartos y puertas
check(['R8', 'R9', 'R10', 'R11'].every(room), '4 cuartos nuevos');
check(room('R9').x1 === 16 && room('R9').x2 === 24, 'R9 en x 16–24 (comparte pared con R5 y R8)');
// (F5.15: sin D9 ni D10: la caseta queda unida a la piscina y al dormitorio por arcos)
const cost = { D8: 1500, D11: 1250, D12: 2000, D13: 2000 };   // F5.16: sin D18 (un solo acceso al muelle)
check(Object.keys(cost).every(id => state.doors[id] && state.doors[id].cost === cost[id]) && !state.doors.D9 && !state.doors.D10 && !state.doors.D18, 'puertas nuevas con su precio (sin D18)');
const links = { D8: 'R3,R8', D11: 'R1,R10', D12: 'R10,R11', D13: 'R10,R8' };
check(Object.keys(links).every(id => G.DOOR_LINKS[id].join() === links[id]), 'DOOR_LINKS del roadmap');

// 2) cada puerta abre exactamente lo que tiene detrás
function reachable(open) {
  G.resetGame(); state.running = true;
  open.forEach(G.openDoor);
  player.pos.set(0, 1.7, 0); G.updateFlowField(true);
  const out = [];
  for (const r of G.ROOMS) {
    if (r.hidden) continue;
    let hit = false;
    for (let x = r.x1; x < r.x2 && !hit; x++) for (let z = r.z1; z < r.z2 && !hit; z++) if (G.flowAt(x, z) >= 0) hit = true;
    if (hit) out.push(r.id);
  }
  return [...new Set(out)].sort().join();          // R11 son 2 cajas (la T)
}
const all = Object.keys(state.doors), but = (...ids) => all.filter(d => !ids.includes(d));
// (F5.11: el búnker R16 no se abre con puertas: con la escotilla, ver f511.js)
const every = [...new Set(G.ROOMS.filter(r => !r.hidden && r.id !== 'R16').map(r => r.id))].sort().join();
check(reachable([]) === 'R1', 'todo cerrado: solo el porche');
check(reachable(all) === every, `todo abierto: los ${every.split(',').length} cuartos`);
// F5.6: el techo une la piscina con el jardín oeste (escaleras 1 y 2), y el jardín oeste da a la playa por D14
// (F5.15: la playa también se abre desde el campamento (H4) y la costa del calamar (H5))
const noBeach = reachable(but('D11', 'D13', 'D14', 'H4', 'H5'));
check(!noBeach.includes('R10') && !noBeach.includes('R11'), 'sin D11, D13, D14, H4 ni H5 no hay playa ni muelle');
check(reachable(but('D11', 'D13')).includes('R10'), 'F5.6: sin D11 ni D13, a la playa por el techo y el jardín oeste (D14)');
check(reachable(but('D11')).includes('R10'), 'sin D11 la playa se llega desde la piscina (D13)');
check(reachable(but('D12')).includes('R10') && !reachable(but('D12')).includes('R11'), 'F5.16: sin D12 hay playa pero no muelle (un solo acceso)');
check(reachable(but('D8')).includes('R8'), 'sin D8 la piscina se llega por la caseta (arcos)');
let rr = reachable(['D1', 'D3']);
check(rr === 'R1,R2,R4,R5,R8,R9', 'F5.15: con D1 + D3 se abren pasillo, dormitorio, caseta y piscina (arcos D5, D9, D10)', rr);
check(reachable(['D1', 'D3', 'D6', 'D7', 'D19']).includes('R12'), 'F5.7: con la energía, del sótano al jardín oeste por el portón');
// F5.8: la escalera 1 sale del jardín trasero: el techo une el jardín trasero con el oeste
rr = reachable(['D11', 'D13']);
check(rr === 'R1,R10,R4,R5,R8,R9', 'D11 + D13: porche, playa y piscina (y por los arcos, la caseta, el dormitorio y el pasillo)', rr);
// F5.15: la jungla son áreas con entradas: el jardín oeste ya no lleva a la jungla (el rancho es por el lazo)
rr = reachable(['D11', 'D14']);
check(rr === 'R1,R10,R12,R13,R15', 'D11 + D14: del jardín oeste por el techo al jardín trasero y los jardines norte', rr);
rr = reachable(['D1', 'D3', 'D17']);
check(rr === 'R1,R12,R13,R15,R2,R4,R5,R8,R9', 'D17: del pasillo al jardín trasero (y por el techo al oeste)', rr);
check(reachable(['D1', 'D2', 'D8', 'D15']).includes('R12'), 'F5.8: D15 (pared norte de la piscina) -> jardín trasero -> techo -> jardín oeste');
check(reachable(['D1', 'D2', 'D8', 'D15']).includes('R13') && reachable(['D1', 'D3', 'D6', 'D7', 'D16']).includes('R13'),
  'al jardín trasero también desde la piscina (D15) y el sótano (D16)');
check(reachable(['D11']) === 'R1,R10', 'solo D11: porche + playa');
G.resetGame(); ['D11', 'D12'].forEach(G.openDoor);
check(G.openRooms().sort().join() === 'R1,R10,R11', 'openRooms() sigue DOOR_LINKS');
G.resetGame(); ['D11', 'D13'].forEach(G.openDoor);
rr = G.openRooms().sort().join();
check(rr === 'R1,R10,R4,R5,R8,R9', 'openRooms() incluye D13 (y los arcos de la casa, F5.15)', rr);
G.resetGame(); ['D11', 'D14'].forEach(G.openDoor);
rr = G.openRooms().sort().join();
check(rr === 'R1,R10,R12,R13,R15', 'openRooms() incluye el techo (jardín oeste -> jardín trasero) y los jardines norte', rr);

// F1.1: D13 no es atajo. Ruta más barata desde el porche a cada cuarto, con y sin D13 (Dijkstra sobre puertas)
// F5.6: el techo es un paso gratis entre sus dos escaleras (ROOF; F5.8: jardín trasero y jardín oeste)
// F5.15: todos los pasos gratis cuentan (OPEN_LINKS: el techo, los jardines y los arcos de la casa)
function cheapest(doors) {
  const best = { R1: 0 }, todo = ['R1'];
  const free = G.OPEN_LINKS.map((l, i) => 'FREE' + i);
  while (todo.length) {
    todo.sort((a, b) => best[a] - best[b]);
    const r = todo.shift();
    // (F5.7: el portón D19 no se compra: lo abre la energía, que pide los 4 generadores; no cuenta para precios)
    for (const d of doors.filter(d => !state.doors[d].power).concat(free)) {
      const isFree = d.startsWith('FREE');
      const [a, b] = isFree ? G.OPEN_LINKS[+d.slice(4)] : G.DOOR_LINKS[d], o = a === r ? b : b === r ? a : null;
      if (!o) continue;
      const c = best[r] + (isFree ? 0 : CONFIG.DOORS[d]);
      if (best[o] === undefined || c < best[o]) { best[o] = c; todo.push(o); }
    }
  }
  return best;
}
const sinD13 = cheapest(but('D13')), conD13 = cheapest(all);
const cheaper = Object.keys(sinD13).filter(r => conD13[r] < sinD13[r]);
check(cheaper.length === 0, 'D13 no abarata la ruta a ningún cuarto', cheaper.length ? JSON.stringify(cheaper) : `(piscina ${conD13.R8})`);
check(CONFIG.DOORS.D11 + CONFIG.DOORS.D13 === CONFIG.DOORS.D1 + CONFIG.DOORS.D2 + CONFIG.DOORS.D8, 'playa + D13 cuesta lo mismo que por la cocina');
// F5.6: ninguna puerta nueva (D14–D18) abarata la ruta a un cuarto que ya existía, contando el techo
const viejos = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11'];
const sinNuevas = cheapest(but('D14', 'D15', 'D16', 'D17', 'D18')), conNuevas = cheapest(all);
const cheaper56 = viejos.filter(r => conNuevas[r] < sinNuevas[r]);
check(cheaper56.length === 0, 'F5.6: los jardines y el techo no abaratan la ruta a ningún cuarto', cheaper56.length ? JSON.stringify(cheaper56.map(r => r + ' ' + sinNuevas[r] + '->' + conNuevas[r])) : `(piscina ${conNuevas.R8}, sótano ${conNuevas.R7})`);
// F5.15: las entradas de las áreas de la jungla (H2..H8) no abaratan la ruta a la casa, la playa ni los jardines
const H = all.filter(d => /^H\d$/.test(d)), casa = viejos.concat(['R12', 'R13', 'R15']);
const sinH = cheapest(all.filter(d => !H.includes(d))), conH = cheapest(all);
const cheaperH = casa.filter(r => conH[r] < sinH[r]);
check(cheaperH.length === 0, 'F5.15: las lianas no abaratan la ruta a ningún cuarto de antes', cheaperH.length ? JSON.stringify(cheaperH.map(r => r + ' ' + sinH[r] + '->' + conH[r])) : '');
check(['R14', 'R17', 'R18', 'R19', 'R20'].every(r => conH[r] >= 3250), 'F5.15: cada área de la jungla cuesta 3250 o más desde el porche',
  ['R14', 'R17', 'R18', 'R19', 'R20'].map(r => r + ' ' + conH[r]).join(' '));
const casaTodo = ['D1', 'D2', 'D3', 'D4', 'D6', 'D7', 'D8'].reduce((s, d) => s + CONFIG.DOORS[d], 0);
check(casaTodo === 8250, 'F5.15: abrir toda la casa cuesta 8.250', `(${casaTodo})`);

// 3) spawns
G.resetGame(); G.debugOpenAllDoors(); G.openBunker(); player.pos.set(0, 1.7, 10); G.updateFlowField(true);   // F5.11: con la escotilla
const bad = G.SPAWN_POINTS.filter(s => !s.valid || G.flowAt(s.cx, s.cz) < 0);
check(bad.length === 0, `los ${G.SPAWN_POINTS.length} spawns válidos y alcanzables`, bad.length ? JSON.stringify(bad.map(s => s.room)) : '');
check(['R8', 'R9', 'R10', 'R11'].every(id => G.SPAWN_POINTS.some(s => s.room === id)), 'cuartos nuevos con spawns');

// 4) límites de playa y muelle: frenan al jugador...
function walk(x, z, yaw, secs) {
  player.pos.set(x, 1.7 + G.groundY(x, z), z); player.vel.set(0, 0, 0); player.yaw = yaw; player.grounded = true;
  keys.KeyW = true;
  for (let i = 0; i < secs * 60; i++) { G.tick(1 / 60); G.updatePlayer(1 / 60); }
  keys.KeyW = false;
  return player.pos.clone();
}
const r = CONFIG.PLAYER.radius, E = 0.01;
let p0;
// yaw 0 = -z · π = +z · π/2 = -x · -π/2 = +x
// F5.12: los costados de la playa son cercos que se queman (H4, H5): cerrados frenan
G.resetGame(); state.running = true; Object.keys(state.doors).filter(id => id !== 'H4' && id !== 'H5').forEach(G.openDoor);
check(walk(10, -10, 0, 4).z >= -23.8 + r - E, 'playa: no se entra al mar');
check(walk(-35, -10, Math.PI / 2, 3).x >= -40.8 + r - E, 'playa: límite oeste (F5.15: la costa, con H5 cerrada)');
check(walk(-30, -10, Math.PI, 3).z <= -4 - r + E, 'playa oeste: la espesura frena hacia el norte');
check(walk(15, -20, -Math.PI / 2, 3).x <= 20 - r + E, 'playa: la espesura frena hacia el este (fuera de H4)');
check(walk(15, -10, -Math.PI / 2, 3).x <= 19.8 - r + E, 'playa: límite este');
check(walk(-17, -8, Math.PI, 3).z <= -4.2 - r + E, 'playa: la cerca frena hacia el patio');
check(walk(0, -30, Math.PI / 2, 2).x >= -1.8 + r - E && walk(0, -30, -Math.PI / 2, 2).x <= 1.8 - r + E, 'muelle: no se cae por los costados');
check(walk(0, -26, 0, 8).z >= -49.8 + r - E, 'muelle: tope al final (F5.6: z -50)');
let cols = 0;
for (let x = -2; x < 2; x++) if (G.isNav(x, -32)) cols++;
check(cols === 2, 'muelle: 2 celdas de ancho para zombies', `(${cols})`);
check(walk(0, -49, Math.PI / 2, 2).x >= -3.8 + r - E && walk(0, -47, -Math.PI / 2, 2).x <= 3.8 - r + E, 'plataforma: no se cae por los costados');
check(walk(2.5, -45.5, Math.PI, 3).z <= -44.2 - r + E, 'plataforma: los hombros frenan (no se vuelve por fuera del tronco)');
// F5.16: un solo acceso: donde estaban el segundo tronco y la pasarela es mar
check(!G.roomAt(-17, -35) && !G.roomAt(-10, -46) && !G.isNav(-17, -35) && !G.isNav(-10, -46), 'F5.16: sin segundo tronco ni pasarela');
check(walk(-3, -46, Math.PI / 2, 2).x >= -3.8 + r - E, 'F5.16: la plataforma frena al oeste (ya no se abre a la pasarela)');

// F1.1: la plataforma del muelle y el puente
G.resetGame(); G.debugOpenAllDoors();
let free = 0;
for (let x = -4; x < 4; x++) for (let z = -50; z < -44; z++) if (G.isNav(x, z)) free++;
check(free >= 20, 'plataforma: al menos 5x4 celdas libres para esquivar', `(${free})`);
let minW = 9;
for (let z = -4; z < 4; z++) { let w = 0; for (let x = 16; x < 22; x++) if (G.isNav(x, z)) w++; minW = Math.min(minW, w); }
check(minW >= 2, 'puente C13: 2 celdas de ancho o más en todo el largo', `(mínimo ${minW})`);
check(G.roomAt(19, 0).id === 'C13' && G.roomAt(0, -48).id === 'R11' && G.roomAt(0, -30).id === 'R11', 'roomAt: puente C13, plataforma y tronco = R11');
// F5.16: Juggernog al final del muelle; el PaP, arriba del templo
const JS = CONFIG.PERKS.list.jugg;
check(G.roomAt(JS.x, JS.z).id === 'R11' && JS.z < -49 && Math.abs(JS.x) < 1, 'F5.16: Juggernog al final del muelle', `(${JS.x}, ${JS.z})`);
player.pos.set(0, 1.7, -30); G.updateFlowField(true);
check(G.flowAt(0, -48) >= 0 && G.flowAt(-3, -46) >= 0 && G.flowAt(2, -46) >= 0, 'del tronco se llega a toda la plataforma');
const fl = G.ROOMS.filter(r => r.id === 'R11'), ov = [];
for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) {
  const a = fl[i], b = fl[j];
  if (Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > 1e-6 && Math.min(a.z2, b.z2) - Math.max(a.z1, b.z1) > 1e-6) ov.push(i + '-' + j);
}
check(ov.length === 0, 'F5.8: los pisos del muelle no se superponen (parpadeaban)', ov.join(' '));
check(G.SPAWN_POINTS.filter(s => s.room === 'R11').every(s => Math.hypot(s.x - JS.x, s.z - JS.z) > 5), 'ningún spawn del muelle pegado a Juggernog');
check(G.SPAWN_POINTS.filter(s => s.room === 'R8').every(s => Math.hypot(s.x - 20, s.z - 4) > 4), 'ningún spawn de la piscina en la boca del puente');
// el puente: con D13 cerrada frena, abierta se pasa de la playa a la piscina
G.resetGame(); state.running = true;
check(walk(18.8, -8, Math.PI, 3).z <= -4.2 - r + E, 'D13 cerrada frena');
G.openDoor('D13');
p0 = walk(18.8, -8, Math.PI, 6);
check(p0.z > 5 && G.roomAt(p0.x, p0.z).id === 'R8', 'D13 abierta: de la playa a la piscina caminando', `(z ${p0.z.toFixed(1)})`);
// ...pero no a las balas
G.scene.updateMatrixWorld(true);
const ray = new THREE.Raycaster();
ray.set(new THREE.Vector3(10, 0.8, -20), new THREE.Vector3(0, 0, -1)); ray.far = 80;
check(ray.intersectObjects(WORLD.hitMeshes, false).length === 0, 'la bala sale al mar (límite invisible no frena balas)');
ray.set(new THREE.Vector3(0, 1.0, -30), new THREE.Vector3(1, 0, 0)); ray.far = 40;
check(ray.intersectObjects(WORLD.hitMeshes, false).length === 0, 'desde el muelle se dispara al agua');
check(WORLD.colliders.filter(c => c.tag.startsWith('bound:') || c.tag === 'poolRim').every(c => !c.mesh), 'límites sin mesh (fuera de hitMeshes)');
check(!G.segmentClear(10, -20, 10, -30, 0) && G.segmentClear(10, -20, 10, -30, 0, true), 'segmentClear: el límite frena gente, shotOnly lo ignora');

// 5) piscina
check(G.groundY(25, 6) === 0 && Math.abs(G.groundY(25, 9.75) + 0.8) < 1e-9 && G.groundY(25, 15) === -POOL.depth,
  'groundY: piso 0, rampa a mitad −0.8, hondo −1.6');
let p = walk(25, 6, Math.PI, 5);                                  // baja por la rampa hasta la pared del fondo
check(p.z > 15.9 && Math.abs(p.y - (1.7 - POOL.depth)) < 0.02, 'baja por la rampa al fondo', `(z ${p.z.toFixed(2)}, y ${p.y.toFixed(2)})`);
check(p.z <= POOL.z2 - 0.15 - r + E, 'la pared del fondo frena');
// bajando la rampa la cámara no rebota: y nunca por encima del piso
player.pos.set(25, 1.7, 7); player.vel.set(0, 0, 0); player.yaw = Math.PI; player.grounded = true; keys.KeyW = true;
let maxAbove = 0;
for (let i = 0; i < 90; i++) { G.tick(1 / 60); G.updatePlayer(1 / 60); maxAbove = Math.max(maxAbove, player.pos.y - (1.7 + G.groundY(player.pos.x, player.pos.z))); }
keys.KeyW = false;
check(maxAbove < 1e-6 && player.grounded, 'baja pegado a la pendiente (sin saltitos)', `(${maxAbove.toFixed(4)})`);
p = walk(25, 15, 0, 5);                                           // sube por la rampa
check(p.z < POOL.z1 && Math.abs(p.y - 1.7) < 1e-6, 'sube por la rampa al borde');
p = walk(20, 14, -Math.PI / 2, 2);                                // desde el borde oeste hacia el agua
check(p.x > POOL.x1 && p.y < 0.2, 'F2.6: se tira por el borde y cae al fondo (sale solo por la rampa, ver pool.js)');
p = walk(25, 14, Math.PI / 2, 2);                                 // desde adentro contra la pared oeste
check(p.x >= POOL.x1 + 0.15 + r - E && p.y < 0.2, 'desde adentro no se sube por la pared');

// un zombie en el fondo llega al jugador en el borde... por la rampa, sin cruzar el borde.
// F2.6: con escaleras saldría por la oeste (más cerca); acá se apagan los enlaces para probar la rampa
// sola. Las escaleras se prueban en pool.js
G.resetGame(); state.running = true; G.debugOpenAllDoors();
G.startRound(1);
G.NAV.link.fill(-1);
player.pos.set(19.5, 1.7, 13); G.setCam(-Math.PI / 2); G.updateFlowField(true);
const z = G.spawnZombie(); z.state = 'walk'; z.px = 25; z.pz = 15.5; z.mode = 'flow';
const rims = WORLD.colliders.filter(c => c.tag === 'poolRim');
let crossed = 0, reached = -1, minY = 9, onRamp = false;
for (let i = 0; i < 60 * 25 && reached < 0; i++) {
  G.tick(1 / 60); G.updateFlowField(false); G.updateZombies(1 / 60);
  state.health = 100; state.lastDamageTime = -99;
  const zr = CONFIG.ZOMBIE.radius - 0.02;
  if (rims.some(c => z.px + zr > c.minX && z.px - zr < c.maxX && z.pz + zr > c.minZ && z.pz - zr < c.maxZ)) crossed++;
  if (z.pz > POOL.z1 && z.pz < POOL.rampEnd && z.px > POOL.x1 && z.px < POOL.x2) onRamp = true;
  minY = Math.min(minY, z.root.position.y);
  if (Math.hypot(z.px - player.pos.x, z.pz - player.pos.z) < CONFIG.ZOMBIE.attackRange) reached = i / 60;
}
check(crossed === 0, 'el zombie nunca atraviesa el borde', `(${crossed} frames)`);
check(onRamp && reached > 0, 'sale por la rampa y llega al jugador', `(${reached.toFixed(1)} s)`);
check(Math.abs(minY + POOL.depth) < 0.05 && Math.abs(z.root.position.y) < 1e-6, 'el modelo del zombie sigue el piso (fondo → borde)');

// 6) caja: puede mudarse a los cuartos nuevos
check(CONFIG.BOX.spots.R8 && CONFIG.BOX.spots.R10, 'la caja tiene lugar en piscina y playa');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
