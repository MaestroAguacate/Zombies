// V2 F0.1: colisión de props. Sólidos frenan jugador, zombies y balas, y bloquean el grid.
// Decorativos no colisionan. El mapa sigue conectado y todo lo comprable/spawneable sigue alcanzable.
const G = require('./harness.js');
const THREE = require('three');
const { state, player, CONFIG, WORLD, PROPS, keys } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const solid = PROPS.filter(p => !p.decor), decor = PROPS.filter(p => p.decor);

G.resetGame(); state.running = true; G.debugOpenAllDoors();
G.openBunker();                                        // F5.11: el búnker solo se alcanza con la escotilla abierta
G.scene.updateMatrixWorld(true);

// 1) cada sólido: collider + caja invisible en hitMeshes; decorativos sin nada
check(solid.length >= 25 && solid.every(p => p.collider && p.collider.solid && WORLD.colliders.includes(p.collider)),
  'sólidos con collider', `(${solid.length})`);
check(solid.every(p => WORLD.hitMeshes.includes(p.collider.mesh) && !p.collider.mesh.visible), 'caja invisible que frena balas');
check(decor.length > 20 && decor.every(p => !p.collider && !p.box), 'decorativos marcados, sin colisión', `(${decor.length})`);
check(WORLD.colliders.filter(c => c.tag.startsWith('prop:')).length === solid.length, 'ningún collider de prop extra');

// 2) el grid bloquea las celdas debajo de cada sólido
let under = 0, free = 0;
for (const p of solid) {
  const [x1, x2, z1, z2] = p.box;
  for (let x = Math.floor(x1); x < x2; x++) for (let z = Math.floor(z1); z < z2; z++) {
    const cx = x + .5, cz = z + .5;
    if (cx > x1 && cx < x2 && cz > z1 && cz < z2) { under++; if (G.isNav(x, z)) free++; }
  }
}
check(under > 0 && free === 0, 'celdas bajo props: bloqueadas', `(${under} celdas)`);

// 3) conectividad: con todas las puertas abiertas, todo alcanzable desde la sala
player.pos.set(0, 1.7, 10); G.updateFlowField(true);
const rooms = G.ROOMS.filter(r => !r.hidden);
const unreached = rooms.filter(r => {
  for (let x = Math.floor(r.x1); x < r.x2; x++) for (let z = Math.floor(r.z1); z < r.z2; z++) if (G.flowAt(x, z) >= 0) return false;   // F5.17: cuartos con bordes no enteros
  return true;
});
check(unreached.length === 0, `los ${rooms.length} cuartos conectados`, unreached.length ? `(sin llegar: ${unreached.map(r => r.id)})` : '');
const badSpawns = G.SPAWN_POINTS.filter(sp => !sp.valid || G.flowAt(sp.cx, sp.cz) < 0);
check(badSpawns.length === 0, `los ${G.SPAWN_POINTS.length} spawns válidos y alcanzables`);
const reach = (x, z, R) => {
  for (let cx = Math.floor(x) - 4; cx <= Math.floor(x) + 4; cx++)
    for (let cz = Math.floor(z) - 4; cz <= Math.floor(z) + 4; cz++)
      if (G.flowAt(cx, cz) >= 0 && Math.hypot(cx + .5 - x, cz + .5 - z) < R) return true;
  return false;
};
check(G.WALLBUYS.every(w => reach(w.mx, w.mz, CONFIG.ECONOMY.interactRange - 0.3)), 'wall buys alcanzables');
check(Object.values(CONFIG.BOX.spots).every(s => reach(s.x, s.z, CONFIG.ECONOMY.interactRange + 0.3)), 'spots de la caja alcanzables');
for (const r in CONFIG.BOX.spots) {                       // la caja tampoco puede quedar encima de un mueble
  const s = CONFIG.BOX.spots[r], hit = solid.find(p => Math.abs(s.x - (p.box[0] + p.box[1]) / 2) < 1.2 && Math.abs(s.z - (p.box[2] + p.box[3]) / 2) < 1.2);
  if (hit) check(false, `spot de la caja en ${r} pisa ${hit.id}`);
}

// 4) el jugador no los atraviesa
function walkInto(x, z, yaw, secs) {
  player.pos.set(x, 1.7, z); player.vel.set(0, 0, 0); player.yaw = yaw; player.grounded = true;
  keys.KeyW = true;
  for (let i = 0; i < secs * 60; i++) { G.tick(1 / 60); G.updatePlayer(1 / 60); }
  keys.KeyW = false;
  return player.pos;
}
const inside = (p, pos, r) => pos.x + r > p.box[0] && pos.x - r < p.box[1] && pos.z + r > p.box[2] && pos.z - r < p.box[3];
const byId = id => PROPS.find(p => p.id === id);
const R = CONFIG.PLAYER.radius - 0.01;
[['sofa', 3.2, 15.2, Math.PI], ['camioneta', -6.6, 26.3, Math.PI], ['refri', 10.8, 11.7, Math.PI / 2],
 ['cama', 5.3, 21.8, 0], ['generador', -12.5, 32.3, Math.PI / 2]].forEach(([id, x, z, yaw]) => {
  const pos = walkInto(x, z, yaw, 2);
  check(!inside(byId(id), pos, R), `jugador choca con ${id}`, `(quedó en ${pos.x.toFixed(2)}, ${pos.z.toFixed(2)})`);
});

// 5) las balas se detienen en el mueble, no en la pared de atrás
const ray = new THREE.Raycaster();
[['sofa', [3.2, 0.5, 13], [0, 0, 1]], ['camioneta', [-6.6, 1.0, 24], [0, 0, 1]], ['ropero', [12, 1.5, 27], [1, 0, 0]]]
  .forEach(([id, o, d]) => {
    ray.set(new THREE.Vector3(...o), new THREE.Vector3(...d)); ray.far = 30;
    const h = ray.intersectObjects(WORLD.hitMeshes, false)[0];
    check(h && h.object.userData.tag === 'prop:' + id, `bala frena en ${id}`, `(pegó en ${h && h.object.userData.tag})`);
  });
ray.set(new THREE.Vector3(3.2, 1.6, 13), new THREE.Vector3(0, 0, 1));                 // por encima del sofá pasa
const over = ray.intersectObjects(WORLD.hitMeshes, false)[0];
check(over && over.object.userData.tag === 'wall', 'por encima del sofá (0.92 m) la bala sigue a la pared');

// 6) un zombie rodea un sofá entre él y el jugador, sin cruzarlo.
// Los sofás del mapa están contra la pared; para que quede ENTRE los dos, este test pone uno en el
// medio de la sala (mismas medidas que el real, girado).
const testSofa = { id: 'sofaTest', box: [-0.45, 0.45, 9.85, 12.15, 0.92] };
G.addPropCollider(testSofa); G.buildNavGrid();
G.startRound(1);
player.pos.set(3.5, 1.7, 11); G.setCam(Math.PI / 2); G.updateFlowField(true);
const z = G.spawnZombie(); z.state = 'walk'; z.px = -3.5; z.pz = 11; z.mode = 'flow';
check(!G.segmentClear(z.px, z.pz, player.pos.x, player.pos.z, 0), 'el sofá está en la línea zombie → jugador');
let crossed = 0, reachedT = -1;
for (let i = 0; i < 60 * 15 && reachedT < 0; i++) {
  G.tick(1 / 60); G.updateFlowField(false); G.updateZombies(1 / 60);
  state.health = 100; state.lastDamageTime = -99;
  if (inside(testSofa, { x: z.px, z: z.pz }, CONFIG.ZOMBIE.radius - 0.02)) crossed++;
  if (Math.hypot(z.px - player.pos.x, z.pz - player.pos.z) < CONFIG.ZOMBIE.attackRange) reachedT = i / 60;
}
check(crossed === 0, 'el zombie nunca pisa el sofá', `(${crossed} frames adentro)`);
check(reachedT > 0, 'y llega igual al jugador (lo rodea)', `(${reachedT.toFixed(1)} s)`);

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
