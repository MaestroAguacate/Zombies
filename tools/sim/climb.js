// V2 F2.8: subirse a muebles. Caminando, escalones de hasta 0.3 m; saltando, lo que tenga el tope hasta
// 0.55 m arriba de los pies (~1 m del piso). Nunca paredes, barandales, rejas ni límites. Parado arriba,
// los zombies igual te pegan.
const G = require('./harness.js');
const { state, player, CONFIG, keys } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const P = CONFIG.PLAYER, dt = 1 / 60;
const prop = id => G.PROPS.find(p => p.id === id);

// corre hacia (tx, tz) desde (x0, z0), saltando si jump; devuelve la altura de los pies al final
function approach(x0, z0, tx, tz, secs, jump) {
  G.resetGame(); state.running = true;
  player.pos.set(x0, P.height, z0); player.vel.set(0, 0, 0); player.grounded = true;
  player.yaw = Math.atan2(-(tx - x0), -(tz - z0));
  keys.KeyW = true;
  for (let i = 0; i < secs * 60; i++) {
    keys.Space = !!jump && i % 25 === 5;
    G.tick(dt); G.updatePlayer(dt);
    const d = Math.hypot(tx - player.pos.x, tz - player.pos.z);
    if (d < 0.2) keys.KeyW = false;
  }
  keys.KeyW = false; keys.Space = false;
  for (let i = 0; i < 60; i++) { G.tick(dt); G.updatePlayer(dt); }
  return player.pos.y - P.height;
}
function center(id) { const b = prop(id).box; return [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2, b[4]]; }

// 1) mesa volcada (0.45): caminando no sube (escalón 0.3); saltando sí
let [cx, cz, top] = center('mesaVolcada');
check(approach(cx, cz + 2, cx, cz, 2, false) < 0.01, 'mesa volcada: caminando no se sube (escalón máximo 0.3)');
let f = approach(cx, cz + 2, cx, cz, 2, true);
check(Math.abs(f - top) < 1e-6, 'mesa volcada: saltando, arriba', `(pies a ${f.toFixed(2)} m)`);
// bajar caminando: cae al piso
keys.KeyW = true; player.yaw = 0;
for (let i = 0; i < 60; i++) { G.tick(dt); G.updatePlayer(dt); }
keys.KeyW = false;
for (let i = 0; i < 30; i++) { G.tick(dt); G.updatePlayer(dt); }
check(Math.abs(player.pos.y - P.height) < 1e-6, 'se baja caminando y cae al piso');

// 2) sofá (0.92) y cama (0.65): saltando sí
[cx, cz, top] = center('sofa');
f = approach(cx, cz - 2, cx, cz, 2, true);
check(Math.abs(f - top) < 1e-6, 'sofá (0.92): saltando, arriba', `(${f.toFixed(2)})`);
[cx, cz, top] = center('cama');
f = approach(cx + 2, cz, cx, cz, 2, true);
check(Math.abs(f - top) < 1e-6, 'cama (0.65): saltando, arriba', `(${f.toFixed(2)})`);

// 3) lo alto no: generador del sótano (1.4), camioneta (1.85); nunca paredes, barandales ni rejas
[cx, cz, top] = center('generador');
check(approach(cx + 2.5, cz, cx, cz, 2, true) < 0.5, 'generador (1.4): no llega');
[cx, cz] = center('camioneta');
check(approach(cx, cz - 3, cx, cz, 2, true) < 0.5, 'camioneta (1.85): no llega');
f = approach(3, -1, 3, -8, 2, true);                       // barandal del porche (1.2)
check(f < 0.5 && player.pos.z > -4.2 - P.radius - 0.02, 'barandal del porche: no se trepa (y sigue frenando)');
f = approach(0, -1, 0, -8, 2, true);                       // reja D11 cerrada (1.2)
check(f < 0.5 && player.pos.z > -4.2 - P.radius - 0.02, 'reja D11: no se trepa');
check(['wall', 'rail', 'poolRim', 'door:D1', 'bound:mar'].every(t => !G.standable({ tag: t, mesh: {} })), 'paredes, barandales, puertas, límites y borde de piscina: no se pisan');

// 4) arriba de un mueble los zombies igual te pegan (el mueble no tapa el golpe)
[cx, cz, top] = center('mesaVolcada');
approach(cx, cz + 2, cx, cz, 2, true);
const q = G.spawnZombie(); q.state = 'walk'; q.px = cx; q.pz = cz + 0.75; q.attackCd = 0;
state.health = 100; state.lastDamageTime = -99;
for (let i = 0; i < 20 && state.health === 100; i++) { G.tick(dt); G.updateZombies(dt); }
check(state.health < 100, 'parado en la mesa, el zombie de al lado te pega');

// 5) F5.6 (bug del playtest): parado en el MEDIO de la cama, los zombies te pegan. Antes llegaban al borde y
// no te alcanzaban (golpe de 1.2 m, del borde al medio ~1.4 m) ni se acercaban directo (la cama tapaba)
for (const id of ['cama', 'sofa']) {
  [cx, cz, top] = center(id);
  G.resetGame(); state.running = true; G.debugOpenAllDoors(); state.round = 1;
  player.pos.set(cx, top + P.height, cz); player.vel.set(0, 0, 0); player.grounded = true;
  G.updateFlowField(true);
  const src = G.roomAt(G.FLOW.srcX + 0.5, G.FLOW.srcZ + 0.5);
  check(src && src.id === prop(id).room, id + ': el origen del flow field queda en su cuarto', `(${src && src.id})`);
  const r = G.ROOMS.find(o => o.id === prop(id).room);
  const z0 = G.spawnZombie(); z0.state = 'walk'; z0.level = 0;
  z0.px = id === 'cama' ? r.x2 - 1.5 : r.x1 + 1.5; z0.pz = id === 'cama' ? r.z2 - 1.5 : r.z1 + 1.5;
  state.health = 100; state.lastDamageTime = -99;
  let t = 0;
  for (; t < 25 && state.health === 100; t += dt) { G.tick(dt); G.updateFlowField(false); G.updateZombies(dt); }
  check(state.health < 100, id + ': parado en el medio, el zombie llega y te pega', `(${t.toFixed(1)} s)`);
}

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
