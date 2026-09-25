// P7: el tema "Marena" es SOLO visual. Carga el juego con y sin tema (BHZ_NOTHEME) en dos procesos y
// compara todo lo que es lógica: colliders, hitMeshes, grid, rayos de bala, visibilidad para spawns.
// Además: ningún objeto del tema en hitMeshes/colliders, paredes ocultas siguen frenando balas,
// y un estimado de draw calls estáticos con y sin tema.
const { execFileSync } = require('child_process');

if (process.argv[2] === 'dump') {
  const G = require('./harness.js');
  const THREE = require('three');
  const { WORLD, NAV, scene, player, state } = G;
  G.resetGame(); G.debugOpenAllDoors();
  scene.updateMatrixWorld(true);              // sin render nadie lo hace: los rayos verían todo en el origen
  // rayos pseudoaleatorios deterministas por toda la casa
  let seed = 12345; const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const ray = new THREE.Raycaster(), rays = [];
  for (let i = 0; i < 400; i++) {
    const o = new THREE.Vector3(-16 + rand() * 34, 0.3 + rand() * 3.4, -4 + rand() * 44);
    const d = new THREE.Vector3(rand() - .5, (rand() - .5) * .6, rand() - .5).normalize();
    ray.set(o, d); ray.far = 60;
    const h = ray.intersectObjects(WORLD.hitMeshes, false);
    rays.push(h.length ? +h[0].distance.toFixed(4) : -1);
  }
  // visibilidad (la usa pickSpawnPoint)
  const vis = [];
  player.pos.set(0, 1.7, 10);
  for (let yaw = 0; yaw < 6.28; yaw += 0.8) {
    G.setCam(yaw);
    for (let x = -15; x <= 17; x += 4) for (let z = -3; z <= 39; z += 4) vis.push(G.isVisibleToPlayer(x + .5, z + .5) ? 1 : 0);
  }
  // draw calls estáticos (todo lo visible en escena, sin frustum culling)
  let calls = 0, themeObjs = 0;
  scene.traverseVisible(o => {
    if (o.userData && o.userData.theme) themeObjs++;
    if (o.isMesh || o.isPoints) calls += Array.isArray(o.material) ? (o.geometry.groups.length || 1) : 1;
  });
  const themeInLogic = WORLD.hitMeshes.filter(m => m.userData.theme).length
    + WORLD.colliders.filter(c => c.mesh && c.mesh.userData.theme).length;
  let hiddenWalls = 0;
  for (const c of WORLD.colliders) if ((c.tag === 'wall' || c.tag === 'rail') && !c.mesh.visible) hiddenWalls++;
  // un tick del tema no debe crear objetos
  const before = scene.children.length;
  G.tick(0.1); G.updateTheme(0.1); G.updateTheme(0.1);
  const after = scene.children.length;
  console.log(JSON.stringify({
    colliders: WORLD.colliders.map(c => [c.tag, c.minX, c.maxX, c.minY, c.maxY, c.minZ, c.maxZ, c.solid]),
    hitMeshes: WORLD.hitMeshes.map(m => m.userData.tag || m.userData.type),
    nav: Array.from(NAV.cells).join(''),
    rays, vis, calls, themeObjs, themeInLogic, hiddenWalls, grew: after - before,
    lamps: WORLD.lamps.length
  }));
  process.exit(0);
}

let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const run = env => JSON.parse(execFileSync(process.execPath, [__filename, 'dump'], { env: Object.assign({}, process.env, env), maxBuffer: 1 << 26 }).toString());
const on = run({}), off = run({ BHZ_NOTHEME: '1' });

check(JSON.stringify(on.colliders) === JSON.stringify(off.colliders), 'colliders idénticos', `(${on.colliders.length})`);
check(JSON.stringify(on.hitMeshes) === JSON.stringify(off.hitMeshes), 'hitMeshes idénticos', `(${on.hitMeshes.length})`);
check(on.nav === off.nav, 'grid de navegación idéntico');
const diff = on.rays.filter((d, i) => d !== off.rays[i]).length;
const hits = on.rays.filter(d => d >= 0).length;
check(diff === 0 && hits > 200, '400 rayos de bala: mismas distancias', `(${diff} distintos, ${hits} pegan)`);
check(JSON.stringify(on.vis) === JSON.stringify(off.vis), 'visibilidad para spawns idéntica', `(${on.vis.length} muestras)`);
check(on.themeInLogic === 0, 'ningún objeto del tema en hitMeshes/colliders');
check(on.hiddenWalls > 0 && off.hiddenWalls === 0, 'paredes originales ocultas solo con tema', `(${on.hiddenWalls})`);
check(on.themeObjs > 0 && off.themeObjs === 0, 'objetos del tema presentes', `(${on.themeObjs})`);
check(on.grew === 0, 'animar el tema no agrega objetos a la escena');
check(on.lamps === off.lamps && on.lamps === 6, 'misma cantidad de luces (6 lámparas)');
console.log(`  draw calls estáticos (todo visible, sin culling): sin tema ${off.calls} · con tema ${on.calls}`);
check(on.calls <= off.calls + 25, 'el tema no dispara los draw calls', `(+${on.calls - off.calls})`);

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
