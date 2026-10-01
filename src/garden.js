//=== 7f. JARDINES Y TECHO (V2 F5.6) =======================================
// Plantas carnívoras sobre la pasarela del techo (CONFIG.GARDEN.plants). Las macetas son colliders de arriba
// (world.js buildPlantPots: frenan al jugador y los zombies las rodean); acá van la cabeza y la mordida:
//  - con el jugador en el techo a menos de plantWarn m, la planta lo mira y abre la boca (aviso + siseo);
//  - F5.10: ya no muerde al jugador (antes: plantDamage a menos de plantKill). Escupe y come arrastrados.
//  - A los zombies no les hacen nada (pedido de Diego).
// Perros del jardín trasero: en una ronda normal desde GARDEN.dogs.fromRound, con el jugador en el jardín,
// cada spawn tiene `chance` de ser un perro del pool de F4 que sale de un spawn del jardín. Máximo `max` por
// partida (roundState.gardenDogs). Sin noche, sin relámpago y sin Max Ammo seguro (eso es de la ronda de perros).
// F5.8: arena mojada (frena a wetMul al jugador y a los zombies) y escupitajo verde (plantas y ahogados): un
// proyectil lento en arco que, si te toca, pega; donde cae deja un charco que saca `tick` por segundo
const PLANTS = [];
const PIRANHAS = { zones: [], water: null };
const ACID = { shots: [], puddles: [], tickT: 0, slow: false };

function wetSandMul(x, z) {
  const G = CONFIG.GARDEN;
  if (ACID.slow) return CONFIG.BEAST.slime.slow;                   // F5.26: parado en el slime negro de la Bestia
  for (const r of G.wetSand) if (x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]) return G.wetMul;
  const M = CONFIG.SQUIDBAY.mud;                                   // F5.19c: el lodo de la playa oeste
  if (M && x >= M.x1 && x <= M.x2 && z >= M.z1 && z <= M.z2) return M.mul;
  return 1;
}
// F5.28e (Diego: "a los charcos de lodo les falta diseño"): cada rectángulo de arena mojada (frena al jugador, la lógica
// no cambia) se dibuja como un charco de lodo en cubos: borde irregular de arena oscura, barro en capas de tonos, agua
// estancada que brilla (MeshBasic tenue: refleja el cielo), burbujas, huellas hundidas, piedras, algas y algún hueso
function buildWetSand() {
  const mb = new MeshBuilder(), wt = new MeshBuilder(), rr = mulberry(313), v = 0.2;
  const MUD = [0x4a3a26, 0x3e3020, 0x54422c, 0x33281a], EDGE = [0x6a5a40, 0x7a6848, 0x5e5038];
  for (const [x1, x2, z1, z2] of CONFIG.GARDEN.wetSand) {
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, hx = (x2 - x1) / 2, hz = (z2 - z1) / 2, ph = rr() * 6;
    for (let x = x1 - 0.4; x <= x2 + 0.4; x += v) for (let z = z1 - 0.4; z <= z2 + 0.4; z += v) {
      const a = Math.atan2((z - cz) / hz, (x - cx) / hx), wob = 1 + 0.12 * Math.sin(a * 3 + ph) + 0.07 * Math.sin(a * 7 - ph);
      const d = Math.hypot((x - cx) / hx, (z - cz) / hz) / wob;
      if (d > 1.12) continue;
      if (d > 0.92) { if (rr() < 0.7) mb.box(x, 0.005, z, v, 0.01, v, EDGE[Math.floor(rr() * 3)]); continue; }   // borde mojado
      const deep = 1 - d;
      mb.box(x, 0.008 + (rr() < 0.15 ? 0.012 : 0), z, v, 0.016, v, MUD[Math.floor(rr() * 2 + deep * 2.2) % 4]);
      if (deep > 0.35 && Math.sin(x * 1.7 + z * 2.3 + ph) > 0.1) wt.box(x, 0.02, z, v, 0.004, v, deep > 0.6 ? 0x5a6468 : 0x4a5256);   // agua
    }
    for (let k = 0; k < 5; k++) {                                        // burbujas y grumos
      const bx = cx + (rr() - 0.5) * hx, bz = cz + (rr() - 0.5) * hz;
      mb.box(bx, 0.035, bz, 0.08, 0.05, 0.08, 0x5a4a34); mb.box(bx + 0.1, 0.03, bz - 0.05, 0.05, 0.04, 0.05, 0x5a4a34);
    }
    for (let k = 0; k < 4; k++) {                                        // huellas hundidas que cruzan el charco
      const fx = cx - hx * 0.7 + k * hx * 0.45, fz = cz + (k % 2 ? 0.25 : -0.25);
      mb.box(fx, 0.02, fz, 0.14, 0.012, 0.28, 0x2a2014); mb.box(fx, 0.02, fz + 0.18, 0.1, 0.012, 0.08, 0x2a2014);
    }
    for (let k = 0; k < 3; k++) mb.box(cx + (rr() - 0.5) * hx * 1.8, 0.05, cz + (rr() - 0.5) * hz * 1.6, 0.16 + rr() * 0.12, 0.1, 0.14, [0x6a6a66, 0x5a5854][k % 2], 0, rr() * 3, 0);   // piedras
    for (let k = 0; k < 3; k++) {                                        // algas pegadas
      let ax = cx + (rr() - 0.5) * hx * 1.6, az = cz + (rr() - 0.5) * hz * 1.4;
      for (let q = 0; q < 5; q++) { ax += (rr() - 0.5) * 0.2; az += 0.12; mb.box(ax, 0.028, az, 0.07, 0.015, 0.12, 0x2a3a1e); }
    }
    if (rr() < 0.6) { mb.box(cx + hx * 0.4, 0.035, cz, 0.36, 0.05, 0.06, 0xc8bea0, 0, 0.6, 0); mb.box(cx + hx * 0.4 + 0.18, 0.04, cz + 0.1, 0.08, 0.07, 0.08, 0xc8bea0); }   // hueso
  }
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (m) { m.userData.theme = false; m.updateMatrix(); }
  const w = wt.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false }));
  if (w) { w.userData.theme = false; w.updateMatrix(); }
}
// F5.24 (Diego: "más diseño en el charco"): cada charco es un grupo de radio 1 (se escala al radio del charco), en cubos:
// la baba de borde irregular con tonos y grumos que brillan, la tierra quemada alrededor, burbujas que suben y revientan
// y vapor que sube. Todo se crea una vez (pool); el material de cada charco es propio para poder apagarlo al irse
function buildAcid() {
  const A = CONFIG.GARDEN.acid, rr = mulberry(55), v = 0.13;
  const shotMat = new THREE.MeshBasicMaterial({ color: 0x7aff3a });
  const shotGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  const goo = new MeshBuilder(), burn = new MeshBuilder();
  const GREENS = [0x2a7a12, 0x3aa01a, 0x4ac424, 0x5ad82a, 0x7aff3a, 0xa8ff6a];
  for (let x = -1.3; x <= 1.3; x += v) for (let z = -1.3; z <= 1.3; z += v) {
    const a = Math.atan2(z, x), edge = 1 + 0.17 * Math.sin(3 * a + 0.6) + 0.09 * Math.sin(7 * a + 2), d = Math.hypot(x, z) / edge;
    if (d < 1) {
      const c = GREENS[Math.min(5, Math.max(0, Math.floor((1 - d) * 4 + rr() * 2.2)))], lump = rr() < 0.12;
      goo.box(x, lump ? 0.05 : 0.025, z, v, lump ? 0.08 : 0.04, v, c);
    } else if (d < 1.28 && rr() < 0.75) {
      burn.box(x, 0.012, z, v, 0.02, v, [0x140c06, 0x22160a, 0x0c0806, 0x33401a][Math.floor(rr() * 4)]);
    }
  }
  for (let i = 0; i < 7; i++) {                                        // salpicaduras sueltas afuera del charco
    const a = rr() * Math.PI * 2, d = 1.15 + rr() * 0.4;
    goo.box(Math.cos(a) * d, 0.02, Math.sin(a) * d, v * 0.8, 0.03, v * 0.8, GREENS[3]);
  }
  // F5.24 (Diego): el de las plantas moradas (alienígenas, ya comieron) es morado: la misma forma en tonos violeta
  const gooP = new MeshBuilder(), PURPLES = [0x4a1260, 0x5c1a74, 0x7a2a92, 0x9a3ab8, 0xc04ae8, 0xe0a0ff];
  const rp = mulberry(55);
  for (let x = -1.3; x <= 1.3; x += v) for (let z = -1.3; z <= 1.3; z += v) {
    const a = Math.atan2(z, x), edge = 1 + 0.17 * Math.sin(3 * a + 0.6) + 0.09 * Math.sin(7 * a + 2), d = Math.hypot(x, z) / edge;
    if (d < 1) { const c = PURPLES[Math.min(5, Math.max(0, Math.floor((1 - d) * 4 + rp() * 2.2)))], lump = rp() < 0.12; gooP.box(x, lump ? 0.05 : 0.025, z, v, lump ? 0.08 : 0.04, v, c); }
    else rp();
  }
  ACID.gooGeoP = gooP.geometry();
  ACID.shotMatP = new THREE.MeshBasicMaterial({ color: 0xc04ae8 }); ACID.shotMat = shotMat;
  // F5.26: el slime negro de la Bestia: brea con vetas café y brillos aceitosos (la misma forma)
  const gooB = new MeshBuilder(), BLACKS = [0x050404, 0x0c0806, 0x16100a, 0x241810, 0x3a2818, 0x6a5a4a];
  const rb = mulberry(55);
  for (let x = -1.3; x <= 1.3; x += v) for (let z = -1.3; z <= 1.3; z += v) {
    const a = Math.atan2(z, x), edge = 1 + 0.17 * Math.sin(3 * a + 0.6) + 0.09 * Math.sin(7 * a + 2), d = Math.hypot(x, z) / edge;
    if (d < 1) { const q = rb(), c = q < 0.04 ? BLACKS[5] : BLACKS[Math.min(4, Math.floor((1 - d) * 2 + q * 3))], lump = q > 0.86; gooB.box(x, lump ? 0.06 : 0.03, z, v, lump ? 0.1 : 0.05, v, c); }
    else rb();
  }
  ACID.gooGeoB = gooB.geometry();
  ACID.shotMatB = new THREE.MeshBasicMaterial({ color: 0x1a120c }); ACID.bubMatB = new THREE.MeshBasicMaterial({ color: 0x4a3a2a });
  const gooGeo = goo.geometry(), burnGeo = burn.geometry(), bubGeo = new THREE.BoxGeometry(0.13, 0.13, 0.13), steamGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const bubMat = new THREE.MeshBasicMaterial({ color: 0xc8ff8a });
  ACID.gooGeo = gooGeo; ACID.bubMat = bubMat; ACID.bubMatP = new THREE.MeshBasicMaterial({ color: 0xf0b0ff });
  for (let i = 0; i < A.pool; i++) {
    const m = new THREE.Mesh(shotGeo, shotMat); m.visible = false; scene.add(m);
    ACID.shots.push({ m, active: false, p: new THREE.Vector3(), v: new THREE.Vector3(), level: 0, purple: false });
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    const gooMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
    const burnMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false });
    const steamMat = new THREE.MeshBasicMaterial({ color: 0x9ad88a, transparent: true, opacity: 0.25, depthWrite: false });
    const gooMesh = new THREE.Mesh(gooGeo, gooMat);
    g.add(new THREE.Mesh(burnGeo, burnMat)); g.add(gooMesh);
    const bubbles = [], steam = [];
    for (let k = 0; k < A.bubbles; k++) { const b = new THREE.Mesh(bubGeo, bubMat); b.userData.ph = rr(); g.add(b); bubbles.push(b); }
    for (let k = 0; k < A.steam; k++) { const s = new THREE.Mesh(steamGeo, steamMat); s.userData.ph = k / A.steam; g.add(s); steam.push(s); }
    ACID.puddles.push({ m: g, gooMesh, gooMat, burnMat, steamMat, bubbles, steam, life: 0, x: 0, z: 0, level: 0, r: A.radius });
  }
}
// burbujas (suben, se inflan y revientan en otro lugar) y vapor (sube, crece y se apaga), en el marco del charco
function animatePuddle(pd, dt) {
  for (const b of pd.bubbles) {
    const u = (b.userData.ph += dt * 1.4);
    if (u >= 1) { b.userData.ph = 0; const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 0.8; b.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); }
    const k = Math.min(1, b.userData.ph);
    b.position.y = 0.04 + k * 0.1; b.scale.setScalar(0.2 + 0.9 * Math.sin(k * Math.PI));
  }
  for (const s of pd.steam) {
    const u = (s.userData.ph += dt * 0.55);
    if (u >= 1) { s.userData.ph = 0; s.position.set((Math.random() - 0.5) * 1.2, 0, (Math.random() - 0.5) * 1.2); s.rotation.y = Math.random() * 3; }
    const k = s.userData.ph;
    s.position.y = 0.15 + k * 1.3; s.scale.setScalar(0.5 + k * 1.2);
  }
  const fade = Math.min(1, pd.life / 0.5), pulse = 0.82 + 0.18 * Math.sin(performance.now() * 0.006 + pd.x);
  pd.gooMat.opacity = 0.9 * fade * pulse; pd.burnMat.opacity = 0.85 * fade; pd.steamMat.opacity = 0.22 * fade;
}
// escupe desde (x, y, z) hacia donde está el jugador ahora (sin adelantar: moverse lo esquiva)
// F5.21: tx, tz opcionales = a dónde apunta (la ráfaga de la planta jefa abre a los costados)
// F5.24: purple = el de una planta morada (la bola y el charco salen morados)
function spitAcid(x, y, z, level, tx, tz, purple) {
  const A = CONFIG.GARDEN.acid, S = ACID.shots.find(s => !s.active), P = player.pos;
  if (!S) return false;
  const ax = tx !== undefined && tx !== null ? tx : P.x, az = tz !== undefined && tz !== null ? tz : P.z;
  const ty = P.y - CONFIG.PLAYER.height + 0.9, d = Math.hypot(ax - x, az - z), T = Math.max(0.2, d / A.speed);
  S.p.set(x, y, z); S.v.set((ax - x) / T, (ty - y) / T + 0.5 * A.gravity * T, (az - z) / T);
  S.level = level; S.active = true; S.m.visible = true; S.m.position.copy(S.p);
  S.purple = purple || false; S.m.material = purple === 'black' ? ACID.shotMatB : purple ? ACID.shotMatP : ACID.shotMat;   // F5.26: 'black'
  sfxPlantWarn(Math.hypot(P.x - x, P.z - z));
  return true;
}
// radius / life opcionales (F5.9: los calamares que tira el Calamarón dejan charcos más grandes)
function acidPuddle(x, z, level, radius, life, purple) {
  const A = CONFIG.GARDEN.acid;
  const pd = ACID.puddles.find(q => q.life <= 0) || ACID.puddles.reduce((a, b) => (a.life < b.life ? a : b));
  const blk = purple === 'black';                                       // F5.26: el slime negro de la Bestia (frena)
  pd.gooMesh.geometry = blk ? ACID.gooGeoB : purple ? ACID.gooGeoP : ACID.gooGeo;   // F5.24: morado o verde
  for (const b of pd.bubbles) b.material = blk ? ACID.bubMatB : purple ? ACID.bubMatP : ACID.bubMat;
  pd.steamMat.color.setHex(blk ? 0x2a2420 : purple ? 0xc08ad8 : 0x9ad88a); pd.purple = purple || false;
  pd.life = life || A.life; pd.x = x; pd.z = z; pd.level = level; pd.r = radius || A.radius;
  pd.m.scale.setScalar(pd.r); pd.m.rotation.y = Math.random() * Math.PI * 2;   // cada charco con otra forma
  pd.m.position.set(x, (level ? lvY(level) : groundY(x, z)) + 0.01, z); pd.m.visible = true;
  animatePuddle(pd, 0);
  return pd;
}
function updateAcid(dt) {
  const A = CONFIG.GARDEN.acid, pl = playerLevel(), P = player.pos;
  for (const S of ACID.shots) {
    if (!S.active) continue;
    let end = false;
    for (let k = 0; k < 3 && !end; k++) {
      const h = dt / 3;
      S.v.y -= A.gravity * h; S.p.addScaledVector(S.v, h);
      const floor = S.level === 2 && roof2At(S.p.x, S.p.z) ? UP2.y : S.level >= 1 && walkAt(S.p.x, S.p.z) ? UP.y : groundY(S.p.x, S.p.z);
      if (pl === S.level && projHitsPlayer(S.p, 0.2)) {             // te toca: pega y el charco queda a tus pies
        damagePlayer(A.hit, S.p.x, S.p.z, false, 'spit');
        acidPuddle(P.x, P.z, pl, 0, 0, S.purple); end = true;
        ACID.tickT = 1;                                              // el charco a tus pies empieza a quemar en 1 s
      } else if (S.p.y <= floor) { acidPuddle(S.p.x, S.p.z, floor === UP2.y ? 2 : floor === UP.y ? 1 : 0, 0, 0, S.purple); end = true; }
      else if (projBlocked(S.p.x, S.p.y, S.p.z)) { acidPuddle(S.p.x, S.p.z, S.level, 0, 0, S.purple); end = true; }
      else if (S.p.y < -5) end = true;
    }
    if (end) { S.active = false; S.m.visible = false; } else S.m.position.copy(S.p);
  }
  let inside = false;
  ACID.slow = false;
  for (const pd of ACID.puddles) {
    if (pd.life <= 0) continue;
    pd.life -= dt;
    if (pd.life <= 0) { pd.m.visible = false; continue; }
    animatePuddle(pd, dt);
    if (pd.level === pl && Math.hypot(P.x - pd.x, P.z - pd.z) < pd.r) { inside = true; if (pd.purple === 'black') ACID.slow = true; }
  }
  if (!inside) ACID.tickT = 0;                                      // al entrar pega enseguida, después cada 1 s
  else if ((ACID.tickT -= dt) <= 0) { ACID.tickT = 1; damagePlayer(A.tick, P.x, P.z, true, 'puddle'); }
  // los ahogados escupen de vez en cuando, desde el piso, si te ven entre drownedRange
  if (pl !== 0) return;
  for (const z of state.zombies) {
    if (z.kind !== 'drowned' || !z.alive || z.state !== 'walk' || (z.level || 0) !== 0) continue;
    if (z.spitT === undefined) z.spitT = randIn(A.drownedEvery);
    if ((z.spitT -= dt) > 0) continue;
    const d = Math.hypot(P.x - z.px, P.z - z.pz);
    if (d >= A.drownedRange[0] && d <= A.drownedRange[1] && segmentClear(z.px, z.pz, P.x, P.z, 0, true) &&
        spitAcid(z.px, groundY(z.px, z.pz) + 1.5, z.pz, 0)) z.spitT = randIn(A.drownedEvery);
    else z.spitT = 1;
  }
}
function resetAcid() {
  for (const S of ACID.shots) { S.active = false; S.m.visible = false; }
  for (const pd of ACID.puddles) { pd.life = 0; pd.m.visible = false; }
  ACID.tickT = 0; ACID.slow = false;
}

// F5.8: fuente esquinera (el cuerpo sólido es el prop 'fuente', la caja x1..x2, z1..z2): un cuarto de pileta
// contra la esquina de los cercos (x2, z2), con un pilar en la esquina y el chorro que cae al agua
function buildFountain() {
  const F = CONFIG.GARDEN.fountain, mb = new MeshBuilder(), R = Math.min(F.x2 - F.x1, F.z2 - F.z1), cx = F.x2, cz = F.z2;
  const n = 6;
  for (let i = 0; i < n; i++) {                                                  // borde curvo de piedra
    const a = Math.PI + (i + 0.5) / n * Math.PI / 2, len = R * Math.PI / 2 / n + 0.04;
    mb.box(cx + (R - 0.12) * Math.cos(a), F.h / 2, cz + (R - 0.12) * Math.sin(a), len, F.h, 0.24, i % 2 ? 0x9a948a : 0x928c82, 0, -(a + Math.PI / 2), 0);
    mb.box(cx + (R - 0.1) * Math.cos(a), F.h + 0.03, cz + (R - 0.1) * Math.sin(a), len + 0.04, 0.06, 0.3, 0xaaa498, 0, -(a + Math.PI / 2), 0);
  }
  mb.box(cx - 0.3, 1.1, cz - 0.3, 0.6, 2.2, 0.6, 0x8a847a);                     // pilar en la esquina
  mb.box(cx - 0.62, 1.45, cz - 0.62, 0.22, 0.18, 0.22, 0x6e6a62, 0, Math.PI / 4, 0);   // caño (cabeza de piedra)
  mb.box(cx - 0.3, 2.25, cz - 0.3, 0.72, 0.1, 0.72, 0xaaa498);
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.userData.theme = false; m.updateMatrix();
  // agua: un cuarto de disco (CircleGeometry acostada: el ángulo π/2..π queda hacia -x y -z)
  const water = new THREE.Mesh(new THREE.CircleGeometry(R - 0.2, 16, Math.PI / 2, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x5a9ab0, transparent: true, opacity: 0.8 }));
  water.rotation.x = -Math.PI / 2; water.position.set(cx, F.h - 0.12, cz);
  scene.add(water);
  const jet = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.6 }));
  jet.position.set(cx - 0.8, 1.0, cz - 0.8); scene.add(jet);
  PIRANHAS.water = { water, jet };
}

// F5.7: una piraña zombi (un mesh fusionado): cuerpo verde podrido, panza roja, boca con dientes, ojo que brilla
function piranhaMesh() {
  const b = new MeshBuilder();
  b.box(0, 0, 0, 0.5, 0.34, 0.16, 0x4a5a3a);                                     // cuerpo (mira a +x)
  b.box(0, -0.1, 0, 0.42, 0.12, 0.17, 0x9a2a22);                                 // panza
  b.box(0.3, -0.04, 0, 0.14, 0.16, 0.15, 0x3a4a2e);                              // cabeza
  b.box(0.36, -0.12, 0, 0.12, 0.05, 0.14, 0x2a1a14);                             // mandíbula
  for (let i = 0; i < 3; i++) b.box(0.32 + i * 0.03, -0.08, 0, 0.02, 0.05, 0.15, 0xf0ead8);   // dientes
  b.box(-0.32, 0, 0, 0.16, 0.26, 0.04, 0x3a4a2e);                                // cola
  b.box(0.3, 0.04, 0.08, 0.05, 0.05, 0.02, 0xffd020); b.box(0.3, 0.04, -0.08, 0.05, 0.05, 0.02, 0xffd020);   // ojos
  b.box(0.02, 0.2, 0, 0.18, 0.1, 0.03, 0x3a4a2e);                                // aleta
  const m = b.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.userData.theme = false; m.matrixAutoUpdate = true; m.visible = false;
  return m;
}
function buildPiranhas() {
  const C = CONFIG.GARDEN.piranhas;
  for (const Z of C.zones) {
    const fish = Z.lanes.map((z, i) => ({ mesh: piranhaMesh(), z, dir: i % 2 ? -1 : 1, k: 1, hit: false, p: new THREE.Vector3() }));
    PIRANHAS.zones.push({ Z, fish, t: 0, next: 0 });
  }
}
const _pirAt = new THREE.Vector3();
function updatePiranhas(dt) {
  const C = CONFIG.GARDEN.piranhas, P = player.pos, ground = playerLevel() === 0;
  for (const zn of PIRANHAS.zones) {
    const Z = zn.Z, out = Z.out || C.out, hgt = Z.height || C.height, xs = Z.x1 - out, xe = Z.x2 + out;
    const zAx = Z.axis === 'z';                                     // F5.13: saltan a lo largo de z (puentes del río)
    const at = (u, y, w) => zAx ? _pirAt.set(w, y, u) : _pirAt.set(u, y, w);
    // F5.15: solo saltan con el jugador cerca (a menos de `near` m del rectángulo de la zona)
    const w0 = Math.min(...Z.lanes), w1 = Math.max(...Z.lanes), pu = zAx ? P.z : P.x, pw = zAx ? P.x : P.z;
    const dz = Math.hypot(Math.max(xs - pu, 0, pu - xe), Math.max(w0 - pw, 0, pw - w1));
    zn.near = dz < C.near;
    if (zn.near) zn.t += dt;
    if (zn.near && zn.t >= C.every) {                               // salta una y alterna su costado
      zn.t -= C.every;
      // F5.8: carril al azar entre los que no están en el aire (nunca el mismo dos veces seguidas)
      const free = zn.fish.filter(f => f.k >= 1 && f !== zn.last);
      const f = free.length ? free[Math.floor(Math.random() * free.length)] : zn.fish[zn.next];
      zn.next = (zn.next + 1) % zn.fish.length; zn.last = f;
      f.dir = -f.dir; f.k = 0; f.hit = false; f.mesh.visible = true;
      const c = at((xs + xe) / 2, 0, f.z), d = Math.hypot(P.x - c.x, P.z - c.z);
      if (d < C.sound) { sfxPiranha(d); const s = at(f.dir > 0 ? xs : xe, SEA.y + 0.2, f.z); spawnSplashFx(s.x, s.y, s.z, 0x9fd4e6, 0.8); }
    }
    for (const f of zn.fish) {
      if (f.k >= 1) continue;
      f.k = Math.min(1, f.k + dt / (Z.flight || C.flight));
      const a = f.dir > 0 ? xs : xe, b = f.dir > 0 ? xe : xs;
      f.p.copy(at(a + (b - a) * f.k, SEA.y + 4 * hgt * f.k * (1 - f.k), f.z));
      f.mesh.position.copy(f.p);
      f.mesh.rotation.set(0, (f.dir > 0 ? 0 : Math.PI) + (zAx ? -Math.PI / 2 : 0), Math.atan(4 * hgt * (1 - 2 * f.k) / (xe - xs)));   // la nariz sigue el arco
      if (!f.hit && ground && projHitsPlayer(f.p, C.radius)) {
        f.hit = true;
        damagePlayer(C.damage, f.p.x, f.p.z);
        player.pushX = zAx ? 0 : f.dir * C.push; player.pushZ = zAx ? f.dir * C.push : 0; player.pushT = CONFIG.BOSS.pushTime;
        sfxPlantBite();
      }
      if (f.k >= 1) f.mesh.visible = false;
    }
  }
  // fuente: el agua respira y el chorro titila
  if (PIRANHAS.water) {
    const t = clock.elapsedTime;
    PIRANHAS.water.water.material.opacity = 0.75 + 0.08 * Math.sin(t * 3);
    PIRANHAS.water.jet.scale.y = 0.85 + 0.2 * Math.sin(t * 17);
  }
}
function resetPiranhas() {
  for (const zn of PIRANHAS.zones) { zn.t = 0; zn.next = 0; for (const f of zn.fish) { f.k = 1; f.hit = false; f.mesh.visible = false; } }
  for (const s of RSHARK.list) { s.k = 1; s.t = 0; s.hit = false; s.g.visible = false; }
}
// F5.19 (Diego: "cambia las pirañas por un tiburón que vaya de lado a lado"): un tiburón por puente del río del templo
// (CONFIG.TEMPLE.shark). Cada `every` s (al azar) pasa nadando por el río de un lado al otro del puente (a lo largo de
// z) y salta por encima de las tablas. Si te toca arriba del puente: `damage` y un empujón. Solo con el jugador cerca
const RSHARK = { list: [] };
function buildRiverSharks() {
  const T = CONFIG.TEMPLE, [wx1, wx2] = T.river.w;
  for (const [, c1, c2] of T.river.bridges) {
    const g = sharkMesh(); g.visible = false; scene.add(g);
    RSHARK.list.push({ g, x: (wx1 + wx2) / 2, zb: (c1 + c2) / 2, half: (c2 - c1) / 2, dir: 1, k: 1, t: 0, hit: false, p: new THREE.Vector3() });
  }
}
function updateRiverSharks(dt) {
  const C = CONFIG.TEMPLE.shark, P = player.pos, ground = playerLevel() === 0;
  for (const s of RSHARK.list) {
    const near = Math.hypot(P.x - s.x, P.z - s.zb) < C.near;
    if (s.k >= 1) {
      if (!near) continue;
      if ((s.t -= dt) > 0) continue;
      s.t = C.every[0] + Math.random() * (C.every[1] - C.every[0]);
      s.k = 0; s.dir = -s.dir; s.hit = false; s.g.visible = true;
      sfxSharkJump(Math.hypot(P.x - s.x, P.z - s.zb));
      spawnSplashFx(s.x, 0.1, s.zb - s.dir * C.span * 0.6, 0x9fd4e6, 0.7);
    }
    s.k = Math.min(1, s.k + dt / C.cross);
    const u = -1 + 2 * s.k, z = s.zb + s.dir * u * C.span;
    const b = Math.max(0, 1 - ((z - s.zb) / (s.half + 2)) ** 2);            // salta sobre el puente
    const y = -0.45 + (C.peak + 0.45) * b;
    s.p.set(s.x, y, z);
    s.g.position.copy(s.p);
    s.g.rotation.set(0, s.dir > 0 ? -Math.PI / 2 : Math.PI / 2, -s.dir * (z - s.zb) / (s.half + 2) * 0.9 * (b > 0 ? 1 : 0));
    if (!s.hit && ground && b > 0 && projHitsPlayer(s.p, C.radius)) {
      s.hit = true;
      damagePlayer(C.damage, s.x, z);
      player.pushX = 0; player.pushZ = s.dir * C.push; player.pushT = CONFIG.BOSS.pushTime;
      sfxPlantBite();
    }
    if (s.k >= 1) s.g.visible = false;
  }
}

// F5.16: números al azar con semilla fija (el dibujo del tortugario sale igual siempre)
function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
// F5.10: rancho de playa (solo dibujo; los sólidos están en PROPS). F5.17 (Diego: "le falta mucho diseño", menos
// Minecraft): palapa de troncos con techo de paja a 4 aguas en capas y flecos, tiki bar de bambú contra el cerco sur
// (antes tapaba a la tortuga), billar con lámpara, hamaca curva, antorchas, arco de entrada, tablas de surf, red con
// boyas, barriles; el tortugario con huesos de verdad y la cueva de rocas facetadas con ojos que brillan adentro
const RANCHO = { bulbs: null, t: 0, eyes: null, blink: 0 };
function buildRancho() {
  const R = CONFIG.RANCHO, P = R.palapa, RA = R.area;   // F5.19: lo de los bordes, relativo al área (antes números a mano)
  // wd: troncos y bambú (corteza) · lf: hojas y flecos (FOLI) · rk: rocas y huesos · th/tu: paja arriba/abajo · mb: resto
  const wd = new MeshBuilder(), lf = new MeshBuilder(), rk = new MeshBuilder(), th = new MeshBuilder(), tu = new MeshBuilder(), mb = new MeshBuilder();
  const log = 0xa88a66, logD = 0x7a5a3a, rope = 0xd8b878, plank = [0x9a7048, 0x8a6440, 0xa87a50], felt = 0x1f6a3a, dark = 0x4a321e;
  const cx = (P.x1 + P.x2) / 2, cz = (P.z1 + P.z2) / 2, W = P.x2 - P.x1, D = P.z2 - P.z1, H = P.h;
  // deck de tablones con un tronco de borde
  for (let i = 0; i < 22; i++) mb.box(cx, 0.04, P.z1 - 0.5 + 0.25 + i * 0.5, W + 1, 0.06, 0.45, plank[i % 3]);
  for (const z of [P.z1 - 0.55, P.z2 + 0.55]) wd.seg([P.x1 - 0.55, 0.09, z], [P.x2 + 0.55, 0.09, z], 0.09, 0.09, logD, 7);
  for (const x of [P.x1 - 0.55, P.x2 + 0.55]) wd.seg([x, 0.09, P.z1 - 0.55], [x, 0.09, P.z2 + 0.55], 0.09, 0.09, logD, 7);
  // postes de tronco con amarras de soga y una piedra al pie
  for (const [x, z] of [[P.x1, P.z1], [P.x2, P.z1], [P.x1, P.z2], [P.x2, P.z2]]) {
    wd.cyl(x, 0, z, 0.17, H + 0.25, log, 0.82, 9);
    for (const y of [H - 0.45, H - 0.25, 1.1]) wd.cyl(x, y, z, 0.18, 0.09, rope, 1, 9);
    rk.rock(x, 0.02, z, 0.42, 0.28, 0.42, 0x8a8478, x * 3 + z);
  }
  // vigas del borde y cabios hasta la punta
  const yT = H + 2.7, ov = 1.1;
  for (const z of [P.z1, P.z2]) wd.seg([P.x1 - 0.5, H, z], [P.x2 + 0.5, H, z], 0.13, 0.13, logD, 8);
  for (const x of [P.x1, P.x2]) wd.seg([x, H + 0.1, P.z1 - 0.5], [x, H + 0.1, P.z2 + 0.5], 0.12, 0.12, logD, 8);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) wd.seg([cx + sx * (W / 2 + ov), H - 0.1, cz + sz * (D / 2 + ov)], [cx, yT - 0.15, cz], 0.09, 0.06, logD, 6);
  for (let k = 1; k < 4; k++) for (const [ax, sd] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]]) {   // cabios intermedios
    const f = -0.5 + k / 4, bx = ax === 'x' ? cx + f * (W + 2 * ov) : cx + sd * (W / 2 + ov), bz = ax === 'x' ? cz + sd * (D / 2 + ov) : cz + f * (D + 2 * ov);
    wd.seg([bx, H - 0.05, bz], [cx, yT - 0.15, cz], 0.055, 0.04, logD, 5);
  }
  // F5.25: techo de paja a 4 aguas en cubos: pirámide escalonada de N capas (cada capa, un marco de 4 tablones de paja
  // con tonos que se alternan y un borde más oscuro), panza de abajo en tono sombra, y flecos de cubos colgando del borde
  const S0 = W / 2 + ov + 0.15, N = 9, lh = (yT - H) / N;
  const straw = [0xc8aa6a, 0xb89a5a, 0xd4b878, 0xa88a4a];
  for (let k = 0; k < N; k++) {
    const t = k / N, s = S0 * (1 - t) + 0.12, y = H + 0.05 + lh * (k + 0.5), wid = Math.min(s, S0 / N * 1.6 + 0.15);
    for (let i = 0; i < 4; i++) {                                      // marco de 4 tablones (norte, sur, este, oeste)
      const c = straw[(k + i) % 4], ax = i < 2;
      const px = ax ? cx : cx + (i === 2 ? 1 : -1) * (s - wid / 2), pz = ax ? cz + (i === 0 ? 1 : -1) * (s - wid / 2) : cz;
      mb.box(px, y, pz, ax ? s * 2 : wid, lh * 1.05, ax ? wid : s * 2 - wid * 2, c);
      mb.box(px, y + lh * 0.52, pz, ax ? s * 2 - 0.1 : wid - 0.1, 0.03, ax ? wid - 0.1 : s * 2 - wid * 2, 0xe0c88a);   // brillo arriba
    }
    if (k === 0) mb.box(cx, H + 0.02, cz, s * 2 - wid * 2 + 0.02, 0.04, s * 2 - wid * 2 + 0.02, 0x5a4630);   // panza (sombra)
    if (k === 0) for (let q = 0; q < 4 * 16; q++) {                   // flecos de cubos
      const side = q >> 4, f = ((q & 15) + 0.5) / 16 - 0.5, len = 0.35 + ((q * 7) % 5) * 0.07;
      const fx = side < 2 ? cx + f * s * 2 : cx + (side === 2 ? 1 : -1) * s, fz = side < 2 ? cz + (side === 0 ? 1 : -1) * s : cz + f * s * 2;
      mb.box(fx, H - len / 2 + 0.05, fz, side < 2 ? 0.3 : 0.08, len, side < 2 ? 0.08 : 0.3, straw[q % 4]);
    }
  }
  mb.box(cx, yT, cz, 0.6, 0.3, 0.6, 0xc8a868); mb.box(cx, yT + 0.2, cz, 0.35, 0.2, 0.35, 0xb89a5a);   // moño de la punta
  wd.cyl(cx, yT + 0.1, cz, 0.05, 0.7, logD, 0.6, 6);
  // billar (PROPS billar): patas torneadas, caja, paño, bandas, troneras, bolas, tacos y lámpara colgando
  const [bx1, bx2, bz1, bz2, bh] = R.props.find(p => p.id === 'billar').box;
  const bcx = (bx1 + bx2) / 2, bcz = (bz1 + bz2) / 2, bw = bx2 - bx1, bd = bz2 - bz1;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const lx = bcx + sx * (bw / 2 - 0.16), lz = bcz + sz * (bd / 2 - 0.16);
    wd.cyl(lx, 0, lz, 0.09, bh - 0.2, dark, 0.7, 8); wd.sphere(lx, 0.32, lz, 0.1, 0.09, 0.1, dark, 8);
  }
  mb.box(bcx, bh - 0.12, bcz, bw, 0.22, bd, 0x6a3a1e);
  mb.box(bcx, bh + 0.005, bcz, bw - 0.24, 0.02, bd - 0.24, felt);
  for (const z of [bz1 + 0.06, bz2 - 0.06]) mb.box(bcx, bh + 0.04, z, bw, 0.08, 0.12, 0x5a2a1a);
  for (const x of [bx1 + 0.06, bx2 - 0.06]) mb.box(x, bh + 0.04, bcz, 0.12, 0.08, bd, 0x5a2a1a);
  for (const [sx, sz] of [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]]) mb.cyl(bcx + sx * (bw / 2 - 0.13), bh + 0.01, bcz + sz * (bd / 2 - 0.13), 0.065, 0.03, 0x0a0a0a, 1, 8);
  const balls = [0xf0f0e8, 0xf0c020, 0x2040c0, 0xc02020, 0x6a2a8a, 0xe86a1a, 0x1a8a3a, 0x7a1a1a, 0x101010];
  balls.forEach((c, i) => mb.sphere(bcx + 0.5 - (i % 4) * 0.075, bh + 0.045, bcz - 0.12 + Math.floor(i / 4) * 0.075, 0.035, 0.035, 0.035, c, 8));
  mb.sphere(bcx - 0.45, bh + 0.045, bcz + 0.05, 0.035, 0.035, 0.035, 0xf8f8f0, 8);
  wd.seg([bcx - 0.9, bh + 0.06, bcz + 0.1], [bcx + 0.5, bh + 0.08, bcz + 0.55], 0.014, 0.008, 0xd8b070, 5);   // taco sobre la mesa
  wd.seg([P.x2 - 0.3, 0.02, P.z2 - 0.45], [P.x2 - 0.2, 1.45, P.z2 - 0.25], 0.015, 0.009, 0xd8b070, 5);        // taco en el poste
  wd.seg([bcx, H, bcz], [bcx, 2.3, bcz], 0.012, 0.012, 0x2a2a2a, 4);                                         // lámpara del billar
  mb.cyl(bcx, 2.0, bcz, 0.34, 0.3, 0x2f5a3a, 0.35, 12);
  // tiki bar (PROPS barra) contra el cerco sur: frente de bambú, mostrador, estantes con botellas, alero de paja
  const [rx1, rx2, rz1, rz2, rh] = R.props.find(p => p.id === 'barra').box;
  const rcx = (rx1 + rx2) / 2, rl = rx2 - rx1;
  mb.box(rcx, rh / 2, (rz1 + rz2) / 2, rl - 0.1, rh - 0.05, rz2 - rz1 - 0.1, 0x5a3a20);                          // cuerpo
  for (let x = rx1 + 0.06; x < rx2; x += 0.115) wd.cyl(x, 0, rz2 - 0.04, 0.052, rh - 0.02, [0xc8b070, 0xb8a060, 0xd0b878][Math.round(x * 9) % 3], 1, 7);   // bambú
  for (const y of [0.25, rh - 0.2]) wd.seg([rx1, y, rz2 + 0.02], [rx2, y, rz2 + 0.02], 0.03, 0.03, 0x8a6a3a, 6);                   // amarras
  mb.box(rcx, rh + 0.04, (rz1 + rz2) / 2 + 0.08, rl + 0.25, 0.08, rz2 - rz1 + 0.35, 0xa87a4a);                                      // mostrador
  wd.seg([rx1 - 0.12, rh + 0.04, rz2 + 0.2], [rx2 + 0.12, rh + 0.04, rz2 + 0.2], 0.05, 0.05, 0x8a5a34, 8);
  const bottles = [0x2a6a2a, 0x8a4a1a, 0xd8d0b0, 0x2a5a8a, 0x8a1a1a, 0x3a2a14];
  for (const sy of [1.45, 1.95]) {                                    // estantes atrás, contra el cerco
    mb.box(rcx, sy, rz1 - 0.12, rl - 0.4, 0.05, 0.28, 0x6a4a2a);
    for (let i = 0; i < 14; i++) {
      const bx = rx1 + 0.4 + i * (rl - 0.8) / 13, c = bottles[(i + sy * 3) % 6 | 0], bhh = 0.22 + (i % 3) * 0.04;
      mb.cyl(bx, sy + 0.03, rz1 - 0.12, 0.04, bhh, c, 1, 6); mb.cyl(bx, sy + 0.03 + bhh, rz1 - 0.12, 0.015, 0.1, c, 1, 5);
    }
  }
  for (const x of [rx1 + 0.1, rx2 - 0.1]) wd.cyl(x, 0, rz1 - 0.15, 0.09, 3.2, log, 0.85, 8);                    // postes de atrás
  for (let i = 0; i < 5; i++) {                                                                               // botellas y cocos arriba
    const bx = rx1 + 0.5 + i * 1.0;
    if (i % 2) mb.sphere(bx, rh + 0.16, rz2 - 0.15, 0.11, 0.1, 0.11, 0x6a4a2a, 7);
    else { mb.cyl(bx, rh + 0.08, rz2 - 0.15, 0.04, 0.24, bottles[i % 6], 1, 6); mb.cyl(bx, rh + 0.32, rz2 - 0.15, 0.015, 0.09, bottles[i % 6], 1, 5); }
  }
  // alero de paja en voladizo (sin postes adelante: se camina por debajo)
  const ay0 = 3.25, ay1 = 2.55, az0 = rz1 - 0.3, az1 = rz2 + 1.35;
  for (let k = 0; k < 5; k++) {                                        // F5.25: alero en 5 tablones de paja escalonados
    const f = (k + 0.5) / 5, c = [0xc8aa6a, 0xb89a5a, 0xd4b878][k % 3];
    mb.box(rcx, ay0 + (ay1 - ay0) * f, az0 + (az1 - az0) * f, rl + 0.8, 0.16, (az1 - az0) / 5 + 0.08, c);
  }
  for (let q = 0; q < 12; q++) lf.card(rx1 - 0.3 + (rl + 0.6) * (q + 0.5) / 12, ay1 - 0.5, az1, 0.55, 0.5, 0, 0, 0, 'thatch', 0xffffff);
  for (const x of [rx1 + 0.1, rcx, rx2 - 0.1]) wd.seg([x, 2.2, rz1 - 0.15], [x, ay1 + 0.12, az1 - 0.2], 0.05, 0.04, logD, 5);   // tornapuntas
  for (let i = 0; i < 4; i++) {                                                                               // banquetas
    const sx = rx1 + 0.7 + i * (rl - 1.4) / 3, sz = rz2 + 0.75;
    for (const [dx, dz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) wd.seg([sx + dx * 1.3, 0, sz + dz * 1.3], [sx + dx * 0.6, 0.72, sz + dz * 0.6], 0.025, 0.02, logD, 5);
    mb.cyl(sx, 0.72, sz, 0.21, 0.07, 0xc83a2a, 1, 10);
  }
  // máscaras tiki en los postes de atrás
  for (const x of [rx1 + 0.1, rx2 - 0.1]) {
    mb.box(x, 2.55, rz1 - 0.02, 0.34, 0.6, 0.1, 0x6a4a2a);
    mb.box(x - 0.08, 2.65, rz1 + 0.04, 0.09, 0.12, 0.04, 0xf0e0a0); mb.box(x + 0.08, 2.65, rz1 + 0.04, 0.09, 0.12, 0.04, 0xf0e0a0);
    mb.box(x, 2.42, rz1 + 0.04, 0.2, 0.08, 0.04, 0x2a1a0a); mb.box(x, 2.9, rz1 - 0.02, 0.42, 0.08, 0.12, 0xc83a2a);
  }
  // barriles y heladerita al lado del bar
  for (const [x, z] of [[rx2 + 0.55, rz1 + 0.35], [rx2 + 1.2, rz1 + 0.3]]) {
    wd.cyl(x, 0, z, 0.3, 0.85, 0x7a5a36, 0.92, 12);
    for (const y of [0.12, 0.42, 0.72]) mb.cyl(x, y, z, 0.305 - y * 0.02, 0.05, 0x3a3a38, 1, 12);
  }
  mb.box(rx1 - 0.55, 0.22, rz1 + 0.4, 0.6, 0.44, 0.42, 0x3a8ac8); mb.box(rx1 - 0.55, 0.46, rz1 + 0.4, 0.62, 0.06, 0.44, 0xf0f0e8);
  // hamaca curva entre dos troncos (borde norte de la palapa)
  const hx = cx - 2, hz = P.z2 + 0.8, hL = 2.9;
  for (const sx of [-1, 1]) { wd.cyl(hx + sx * 1.65, 0, hz, 0.1, 1.9, log, 0.85, 8); wd.seg([hx + sx * 1.62, 1.45, hz], [hx + sx * hL / 2, 0.95, hz], 0.012, 0.012, rope, 4); }
  for (let i = 0; i < 12; i++) {
    const u0 = -1 + i / 6, u1 = u0 + 1 / 6, y0 = 0.55 + 0.4 * u0 * u0, y1 = 0.55 + 0.4 * u1 * u1;
    const x0 = hx + u0 * hL / 2, x1 = hx + u1 * hL / 2, ang = Math.atan2(y1 - y0, x1 - x0);
    mb.box((x0 + x1) / 2, (y0 + y1) / 2, hz, Math.hypot(x1 - x0, y1 - y0) + 0.01, 0.03, 0.95, [0xe0503a, 0xf0c040, 0x3a8ac8][i % 3], 0, 0, ang);
  }
  // antorchas tiki: flanquean la entrada del sendero (este), el bar y el paso al tortugario
  // (F5.28f: el fuego en cubos, voxFire; antes planos con textura)
  for (const [x, z] of [[RA.x2 - 0.6, 25.3], [RA.x2 - 0.6, 31.7], [rx1 - 0.2, rz2 + 1.8], [rx2 + 0.2, rz2 + 1.8], [RA.x1 + 0.4, 23], [RA.x1 + 0.4, 36.2]]) {
    wd.cyl(x, 0, z, 0.045, 1.9, 0xc8b070, 0.9, 6);
    wd.cyl(x, 1.9, z, 0.08, 0.22, 0x5a3a20, 1.5, 8);
    voxFire(x, 2.1, z, 0.75);
  }
  // arco de entrada al final del sendero del lazo (x -42) con el cartel colgando
  const gx = RA.x2 - 0.3, gz1 = 25.9, gz2 = 31.1;
  for (const z of [gz1, gz2]) { wd.cyl(gx, 0, z, 0.16, 3.4, log, 0.85, 8); wd.cyl(gx, 3.0, z, 0.17, 0.1, rope, 1, 8); }
  wd.seg([gx, 3.25, gz1 - 0.4], [gx, 3.25, gz2 + 0.4], 0.13, 0.13, logD, 8);
  for (const z of [(gz1 + gz2) / 2 - 0.9, (gz1 + gz2) / 2 + 0.9]) wd.seg([gx, 3.2, z], [gx, 2.72, z], 0.01, 0.01, rope, 4);
  mb.box(gx, 2.45, (gz1 + gz2) / 2, 0.08, 0.6, 2.3, 0x8a6a3a);
  for (let q = 0; q < 10; q++) lf.card(gx, 3.05, gz1 - 0.3 + (gz2 - gz1 + 0.6) * (q + 0.5) / 10, 0.5, 0.6, 0, Math.PI / 2, 0, 'vine', 0xffffff);
  // tablas de surf contra la espesura del este y red con boyas en la esquina SO
  [[33.4, 0xe86a3a], [34.3, 0x3aa0d8], [35.2, 0xf0e0a0], [36.1, 0x5ab86a]].forEach(([z, c], i) => {
    mb.sphere(RA.x2 - 0.75, 1.05, z, 0.05, 1.05, 0.3, c, 10, 0, 0, 0.14 + i * 0.02);
    mb.box(RA.x2 - 0.72, 1.05, z, 0.02, 1.9, 0.05, 0xf0ead8, 0, 0, 0.14 + i * 0.02);
  });
  wd.seg([RA.x2 - 0.55, 0.3, 32.8], [RA.x2 - 0.55, 0.3, 36.7], 0.06, 0.06, logD, 6);
  const nx = RA.x1 + 0.4;
  for (const z of [19.2, 21.6]) wd.cyl(nx, 0, z, 0.07, 2.2, log, 0.85, 7);
  for (let i = 0; i < 7; i++) wd.seg([nx, 0.5, 19.2 + i * 0.4], [nx, 2.0, 19.2 + i * 0.4], 0.006, 0.006, 0x8a7a5a, 3);
  for (let j = 0; j < 5; j++) wd.seg([nx, 0.55 + j * 0.35, 19.2], [nx, 0.55 + j * 0.35, 21.6], 0.006, 0.006, 0x8a7a5a, 3);
  [[19.8, 1.5, 0xe84a2a], [20.6, 1.1, 0xf0c030], [21.2, 1.8, 0xe84a2a]].forEach(([z, y, c]) => mb.sphere(nx + 0.1, y, z, 0.13, 0.13, 0.13, c, 8));
  // F5.16: tortugario: arena revuelta, nidos rotos, huesos de zombies y de tortugas
  const PN = R.pen, CV = R.cave, rr = mulberry(34), bone = 0xe0d8c0, boneOld = 0xb8ae90;
  for (let k = 0; k < 16; k++) {                                        // hojas secas y pisadas en la arena
    const x = PN.x1 + 1 + rr() * (PN.x2 - PN.x1 - 2), z = PN.z1 + 1 + rr() * (PN.z2 - PN.z1 - 2);
    lf.add(UNIT_PLANE, x, 0.02, z, 1.2 + rr(), 1.2 + rr(), 1, -Math.PI / 2, rr() * 6.3, 0, 0xffffff, FOLI.r.dead);
  }
  const skull = (x, z, r) => {
    rk.sphere(x, 0.12, z, 0.12, 0.11, 0.14, bone, 8, 0.3, r, 0);
    rk.box(x + Math.sin(r) * 0.08, 0.05, z + Math.cos(r) * 0.08, 0.14, 0.05, 0.1, bone, 0, r, 0);           // mandíbula
    for (const sx of [-1, 1]) rk.sphere(x + Math.cos(r) * sx * 0.05 + Math.sin(r) * 0.1, 0.14, z - Math.sin(r) * sx * 0.05 + Math.cos(r) * 0.1, 0.035, 0.035, 0.03, 0x14100c, 6);
  };
  const ribs = (x, z, r) => {
    const c = Math.cos(r), sn = Math.sin(r);
    rk.seg([x - sn * 0.45, 0.05, z - c * 0.45], [x + sn * 0.45, 0.05, z + c * 0.45], 0.03, 0.025, boneOld, 5);
    for (let q = 0; q < 5; q++) {
      const t = -0.3 + q * 0.15, bx = x + sn * t, bz = z + c * t;
      for (const sd of [-1, 1]) rk.tube([[bx, 0.06, bz], [bx + c * sd * 0.2, 0.2, bz - sn * sd * 0.2], [bx + c * sd * 0.3, 0.05, bz - sn * sd * 0.3]], 0.018, 0.012, bone, 4, 4);
    }
  };
  const femur = (x, z, r) => {
    const c = Math.cos(r), sn = Math.sin(r), a = [x - sn * 0.25, 0.04, z - c * 0.25], b = [x + sn * 0.25, 0.04, z + c * 0.25];
    rk.seg(a, b, 0.028, 0.028, bone, 6); rk.sphere(a[0], a[1], a[2], 0.05, 0.045, 0.05, bone, 6); rk.sphere(b[0], b[1], b[2], 0.05, 0.045, 0.05, bone, 6);
  };
  for (let k = 0; k < 18; k++) {
    const x = PN.x1 + 6.5 + rr() * (PN.x2 - PN.x1 - 7.5), z = PN.z1 + 1 + rr() * (PN.z2 - PN.z1 - 2), r = rr() * 6.3;
    if (k % 3 === 0) skull(x, z, r); else if (k % 3 === 1) ribs(x, z, r); else femur(x, z, r);
  }
  for (let k = 0; k < 7; k++) {                                        // caparazones vacíos, algunos dados vuelta
    const x = PN.x1 + 6 + rr() * (PN.x2 - PN.x1 - 7), z = PN.z1 + 1.5 + rr() * (PN.z2 - PN.z1 - 3), r = rr() * 6.3, flip = k % 3 === 0;
    rk.sphere(x, flip ? 0.24 : 0.02, z, 0.42, 0.26, 0.52, k % 2 ? 0x4a5a32 : 0x5a5030, 10, flip ? Math.PI : (rr() - 0.5) * 0.4, r, 0);
    for (let q = 0; q < 4; q++) rk.blob(x + Math.sin(r + q * 1.6) * 0.18, flip ? 0.05 : 0.22, z + Math.cos(r + q * 1.6) * 0.2, 0.14, 0.05, 0.16, 0x6a6a3a, q);
  }
  [[PN.x2 - 2, 20], [PN.x2 - 3.5, 23], [PN.x2 - 1.5, 38.3], [PN.x2 - 6, 20.5]].forEach(([x, z], i) => {   // nidos rotos con huevos y cáscaras
    rk.lathe([[0.25, 0], [0.45, 0.06], [0.5, 0.14], [0.36, 0.16]], x, 0, z, 1, 1, 1, 0xc0a870, 10);
    for (let q = 0; q < 4; q++) rk.sphere(x + Math.cos(q * 1.7 + i) * 0.14, 0.1, z + Math.sin(q * 1.7 + i) * 0.14, 0.07, 0.085, 0.07, q % 2 ? 0xf4f0e0 : 0xe8e0c8, 7);
    for (let q = 0; q < 3; q++) rk.box(x + 0.5 + q * 0.12, 0.03, z - 0.3 + q * 0.2, 0.08, 0.02, 0.06, 0xf4f0e0, 0.4, q, 0.3);
  });
  // cueva: rocas facetadas apiladas que tapan la caja sólida, con la boca oscura al este (la tortuga sale de ahí)
  const ccx = (CV.x1 + CV.x2) / 2, ccz = (CV.z1 + CV.z2) / 2, mz = CV.mouth.z, rockC = [0x9a9284, 0x8a8274, 0xa89e8e, 0x7e776a];
  rk.rock(ccx - 0.7, 0, ccz, 2.5, 4.3, 4.7, rockC[0], 1, 0, 0.2, 0);                       // núcleo
  rk.rock(ccx - 1.2, 0, ccz - 3.1, 2.6, 3.3, 2.4, rockC[1], 2, 0, 1.1, 0.05);
  rk.rock(ccx - 1.0, 0, ccz + 3.2, 2.7, 3.5, 2.5, rockC[2], 3, 0, 2.0, -0.05);
  rk.rock(CV.x2 - 0.8, 0, mz - 2.2, 1.5, 2.9, 1.4, rockC[3], 4, 0, 0.6, 0.12);             // jambas de la boca (inclinadas)
  rk.rock(CV.x2 - 0.8, 0, mz + 2.2, 1.5, 3.1, 1.4, rockC[0], 5, 0, 2.6, -0.12);
  rk.rock(CV.x2 - 0.75, 2.45, mz - 0.9, 1.1, 0.9, 1.3, rockC[1], 6, 0, 0.4, 0.3);          // dintel en dos piedras (arco)
  rk.rock(CV.x2 - 0.75, 2.5, mz + 0.9, 1.1, 0.95, 1.3, rockC[2], 7, 0, 1.4, -0.3);
  rk.rock(CV.x2 - 0.9, 3.0, mz, 1.2, 0.8, 1.6, rockC[3], 0, 0, 0, 0);
  for (const [dx, dz, w, h, sd] of [[0.2, -3.7, 1.0, 1.0, 1], [0.5, 3.9, 0.7, 0.7, 2], [0.9, -2.9, 0.5, 0.45, 3], [1.1, 2.9, 0.45, 0.4, 4],
                                    [-0.3, -4.6, 1.3, 1.6, 5], [-0.4, 4.7, 1.2, 1.5, 6], [-3.4, -4.2, 1.5, 1.9, 7], [-3.3, 4.4, 1.4, 1.8, 0]])
    rk.rock(CV.x2 + dx, 0, mz + dz, w, h, w * 1.1, rockC[sd % 4], sd, 0, sd, 0);             // piedras sueltas al pie
  rk.rock(ccx - 2.6, 3.0, ccz - 1, 1.5, 1.2, 2.2, rockC[2], 3, 0, 0.9, 0);                  // cima
  for (let q = 0; q < 9; q++) {                                                             // musgo y pasto arriba, sin tapar la forma
    const x = ccx - 2.8 + (q % 3) * 1.3, z = ccz - 3 + Math.floor(q / 3) * 3, y = q === 4 ? 4.2 : 3.2 + (q % 2) * 0.5;
    lf.clump(x, y - 0.15, z, 0.9, 0.6, 'grass', 0xe8f0d0, q);
    if (q % 2) lf.clump(x + 0.3, y - 0.2, z - 0.2, 1.0, 0.8, 'ivy', 0xd8e8c8, q);
  }
  for (const [dz, w, h] of [[0, 1.6, 2.1], [-0.35, 1.3, 2.3], [0.35, 1.3, 2.25], [0, 1.0, 2.45]])
    mb.box(CV.x2 - 0.45, h / 2, mz + dz, 0.8, h, w, 0x020201);                             // boca: hueco negro con forma de arco
  for (let k = 0; k < 7; k++) {                                                             // estalactitas del dintel
    const sz = mz - 0.9 + k * 0.3;
    rk.cyl(CV.x2 - 0.1 + (k % 2) * 0.1, 2.3 - Math.abs(k - 3) * 0.06, sz, 0.07, 0.25 + (k % 3) * 0.12, rockC[k % 4], 0, 6, Math.PI, 0, 0);
  }
  for (let q = 0; q < 7; q++) lf.card(CV.x2 + 0.05, 2.5 - (0.8 + (q % 3) * 0.3), mz - 1.1 + q * 0.37, 0.4, 0.8 + (q % 3) * 0.3, 0, Math.PI / 2, 0, q % 2 ? 'moss' : 'vine', 0xffffff);
  for (const dz of [-2.6, 2.7, -4.2, 4.3]) lf.clump(CV.x2 + 0.6, -0.1, mz + dz, 1.5, 1.2, 'leaf', 0xd8e4c4, dz);   // matas al pie
  for (let q = 0; q < 4; q++) mb.box(CV.x2 + 0.8 + q * 0.45, 0.035, mz + (q % 2 ? 0.35 : -0.35), 0.28, 0.01, 0.06, 0x4a3a24, 0, 0.3, 0);   // arañazos
  skull(CV.x2 + 1.6, mz - 1.3, 0.8); femur(CV.x2 + 2.2, mz + 1.2, 2.1); ribs(CV.x2 + 1.0, mz + 1.9, 0.5);
  // ojos de la tortuga en la oscuridad (se esconden cuando sale)
  const eg = new MeshBuilder();
  for (const dz of [-0.28, 0.28]) eg.sphere(CV.x2 - 0.15, 0.75, mz + dz, 0.03, 0.06, 0.07, 0xf0e040, 6);
  RANCHO.eyes = eg.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
  if (RANCHO.eyes) RANCHO.eyes.userData.theme = false;
  wd.cyl(PN.x2 - 1, 0, 30, 0.05, 2.0, logD, 0.9, 6);                                       // poste del cartel
  const put = (B, mat) => { const m = B.mesh(mat); if (m) { m.userData.theme = false; m.updateMatrix(); } return m; };
  put(wd, MAT.bark); put(lf, FOLI.mat); put(rk, MAT.rock); put(th, MAT.thatch); put(tu, MAT.thatchIn); put(mb, MAT.grimeV);
  // carteles
  const sign = (text, sub, x, y, z, ry, w) => {
    const tex = makeTex((c, s) => {
      c.fillStyle = '#e8d8b0'; c.fillRect(0, 0, s, s);
      c.fillStyle = '#3a2a1c'; c.textAlign = 'center';
      c.font = 'bold ' + Math.floor(s * 0.2) + 'px monospace'; c.fillText(text, s / 2, s * 0.42);
      if (sub) { c.font = 'bold ' + Math.floor(s * 0.12) + 'px monospace'; c.fillText(sub, s / 2, s * 0.66); }
    }, 1, 128);
    tex.magFilter = THREE.LinearFilter;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.5), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
    s.position.set(x, y, z); s.rotation.y = ry; scene.add(s);
  };
  // F5.20 (Diego): "RANCHO DE DON DIEGO". El del arco iba del lado de adentro de la tabla (la tabla lo tapaba viniendo
  // de la casa): ahora va en la cara de afuera (+x), la que ves al llegar por el sendero del lazo
  sign('RANCHO', 'DE DON DIEGO', cx, P.h - 0.35, P.z1 - 0.14, Math.PI, 1.8);
  sign('RANCHO', 'DE DON DIEGO', gx + 0.05, 2.45, (gz1 + gz2) / 2, Math.PI / 2, 2.1);
  sign('TIKI BAR', 'OPEN 24/7', rcx, ay1 - 0.15, az1 + 0.02, 0, 1.4);
  sign('TURTLE PEN', 'DO NOT DISTURB', PN.x2 - 1, 1.85, 30.06, 0, 1.2);
  // foquitos colgando del borde de la palapa: un InstancedMesh MeshBasic que late (sin luces), con su cable
  const n = 28, geo = new THREE.SphereGeometry(0.075, 6, 5);
  const bulbs = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd890 }), n + 1);
  const o = new THREE.Object3D(), cable = new MeshBuilder();
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n * 4, side = Math.min(3, Math.floor(t)), f = t - side;
    const x = side === 0 ? P.x1 + f * W : side === 1 ? P.x2 : side === 2 ? P.x2 - f * W : P.x1;
    const z = side === 0 ? P.z1 : side === 1 ? P.z1 + f * D : side === 2 ? P.z2 : P.z2 - f * D;
    const y = H - 0.35 - 0.12 * Math.sin(f * Math.PI), pt = [x, y + 0.08, z];
    if (prev) cable.seg(prev, pt, 0.008, 0.008, 0x1a1a1a, 3);
    prev = pt;
    if (i < n) { o.position.set(x, y, z); o.updateMatrix(); bulbs.setMatrixAt(i, o.matrix); }
  }
  o.position.set(bcx, 2.1, bcz); o.scale.setScalar(1.4); o.updateMatrix(); bulbs.setMatrixAt(n, o.matrix);   // foco de la lámpara del billar
  scene.add(bulbs);
  put(cable, MAT.grimeV);
  RANCHO.bulbs = bulbs;
}
// ojos de la tortuga: parpadean de vez en cuando y se apagan mientras la trampa la tiene afuera
function updateRanchoEyes(dt) {
  const E = RANCHO.eyes;
  if (!E) return;
  const out = TRAPS.turtles && TRAPS.turtles.list.some(tu => tu.state !== 'off');
  RANCHO.blink -= dt;
  if (RANCHO.blink < -0.15) RANCHO.blink = 2 + Math.random() * 4;
  E.visible = !out && RANCHO.blink > 0;
}

// F5.11: reposeras (el sólido está en PROPS), sombrillas y canteros de flores. Un solo mesh
function buildGardenDecor() {
  const D = CONFIG.DECOR, mb = new MeshBuilder(), cloth = [0x3a8ac8, 0xe86a3a, 0xf0c040, 0x5ab86a];
  D.loungers.forEach(([x, z, ax], i) => {
    const alongZ = ax === 'z', c = cloth[i % cloth.length];
    const L = (dx, dy, dz, w, h, d, col, rx, rz) => alongZ ? mb.box(x + dx, dy, z + dz, w, h, d, col, rx || 0, 0, rz || 0)
                                                           : mb.box(x + dz, dy, z + dx, d, h, w, col, rz || 0, 0, rx || 0);
    for (const s of [-0.3, 0.3]) for (const e of [-0.8, 0.8]) L(s, 0.15, e, 0.05, 0.3, 0.05, 0xd8d8d0);   // patas
    L(0, 0.32, -0.2, 0.66, 0.06, 1.4, 0xf0f0e8);                                     // marco
    L(0, 0.36, -0.2, 0.6, 0.04, 1.36, c);                                            // colchoneta
    L(0, 0.55, 0.62, 0.66, 0.06, 0.6, 0xf0f0e8, -0.8); L(0, 0.57, 0.6, 0.6, 0.04, 0.56, c, -0.8);   // respaldo
  });
  D.umbrellas.forEach(([x, z], i) => {
    mb.box(x, 1.2, z, 0.06, 2.4, 0.06, 0xd8d8d0);
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      mb.box(x + Math.cos(a) * 0.55, 2.3, z + Math.sin(a) * 0.55, 1.1, 0.04, 0.5, k % 2 ? 0xf0f0e8 : cloth[i % cloth.length], 0, -a, 0.25);
    }
  });
  // F5.17: canteros con borde de piedras y flores de hojas con alfa (antes cajitas)
  const lf = new MeshBuilder(), rk = new MeshBuilder();
  D.flowers.forEach(([x1, x2, z1, z2], i) => {
    mb.box((x1 + x2) / 2, 0.05, (z1 + z2) / 2, x2 - x1, 0.1, z2 - z1, 0x4a3020);   // tierra
    const alongX = x2 - x1 > z2 - z1, L = alongX ? x2 - x1 : z2 - z1, n = Math.max(2, Math.round(L / 0.55));
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n, px = alongX ? x1 + f * (x2 - x1) : (x1 + x2) / 2, pz = alongX ? (z1 + z2) / 2 : z1 + f * (z2 - z1);
      lf.clump(px, 0.08, pz, 0.62, 0.55 + (k % 3) * 0.08, 'flower', 0xffffff, k * 1.3 + i);
      for (const sd of [-1, 1]) rk.rock(alongX ? px : x1 + (sd > 0 ? x2 - x1 : 0), 0.02, alongX ? z1 + (sd > 0 ? z2 - z1 : 0) : pz,
        0.2, 0.14, 0.18, [0x9a968a, 0x8a867a][k % 2], k + i, 0, k, 0);          // borde de piedras
    }
  });
  const m = mb.mesh(MAT.grimeV);
  if (m) { m.userData.theme = false; m.updateMatrix(); }
  for (const [B, mat] of [[lf, FOLI.mat], [rk, MAT.rock]]) { const q = B.mesh(mat); if (q) { q.userData.theme = false; q.updateMatrix(); } }
}

//--- F5.12: la jungla (solo dibujo; los troncos sólidos están en PROPS, planJungle)
// F5.17 (Diego: "que no sea tan Minecraft, más BO2"): troncos curvos (tubos) con raíces tablares y ramas, copas y
// arbustos de hojas con alfa (FOLI), palmeras arqueadas, helechos, pasto y rocas deformadas. Por celdas de 32 m
// (ChunkMB): la niebla recorta a 44 m y la cámara descarta las celdas lejanas (antes, un mesh que se dibujaba siempre).
// Los arbustos de las paredes de espesura van DETRÁS de su cara caminable: antes se metían 1 m en los senderos y,
// detrás de la pared este de la piscina, asomaban adentro (las "cosas verdes" junto a Double Tap)
//--- F5.25 tanda A (Diego: "todos los árboles cúbicos pero ultra bien diseñados"): árboles y palmeras de la jungla en cubos.
// 5 variantes armadas UNA vez (3 de hoja ancha y 2 palmeras), cada una en 2 detalles (near: detallado; far: liviano).
// Se repiten con InstancedMesh por celda de CONFIG.VOXTREES.chunk m y cada frame (updateVoxTrees) se prende solo lo que
// está en pantalla y dentro de la niebla, con el detalle según la distancia. El tronco va en el origen: el collider de
// los árboles de las áreas (PROPS arbolN, 0.6 m) no cambió
const VOXT = { geos: null, chunks: [], mat: null, frustum: null, m4: null, sph: null };
// F5.28f (Diego: "los árboles brillan de noche; que se oscurezcan completamente"): con la oscuridad k el follaje (árboles
// y matas: VOXT.mat y FOLI.mat, Lambert con un poco de luz propia) multiplica su color hasta WEATHER.foliage.night y
// pierde la luz propia; lo de las catacumbas a cielo abierto (CATA.skyMat, pintado) baja hasta CATA.night. El
// relámpago (f) los vuelve a mostrar. Solo cambia colores de materiales: ningún shader se recompila
// F5.28f (Diego: "cuando la luz de la antorcha le pega al zombie que se vea: en las catacumbas se queda completamente
// negro"): luces falsas. Cada antorcha, brasero o charco que brilla se anota acá (x, y, z, radio, color, fuerza) y
// fakeLightTint le pone a cada enemigo cerca un brillo propio (emissive) del color de la luz, más fuerte cuanto más
// cerca. Nada de luces de verdad (recompilan shaders); el golpe (flash) manda sobre esto
const FLIGHT = { list: [], c: new THREE.Color() };
// F5.28f (Diego: "el fuego de las lámparas del templo y del rancho no tiene diseño cúbico"): fuego en cubos. Cada fuego
// (voxFire) es un núcleo que late y `cubes` cubos que nacen en la base, suben corriéndose un poco y se achican, de
// amarillo a naranja y rojo, en loop con fases distintas. Todos los fuegos del mapa van en un solo InstancedMesh
// (buildVoxFire, al final de init) que updateVoxFire mueve cada frame (solo los que están cerca de la cámara)
const VFIRE = { list: [], mesh: null, m4: new THREE.Matrix4(), cols: null };
function voxFire(x, y, z, s) { VFIRE.list.push({ x, y, z, s: s || 1, ph: Math.random() * 10 }); }
function buildVoxFire() {
  const C = CONFIG.VOXFIRE, n = VFIRE.list.length * (C.cubes + 1);
  if (!n) return;
  VFIRE.cols = C.colors.map(h => new THREE.Color(h));
  VFIRE.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
  VFIRE.mesh.frustumCulled = false; VFIRE.mesh.userData.theme = false;
  for (let i = 0; i < n; i++) VFIRE.mesh.setColorAt(i, VFIRE.cols[1]);
  scene.add(VFIRE.mesh);
  updateVoxFire(0, true);
}
function updateVoxFire(t, all) {
  const M = VFIRE.mesh;
  if (!M || typeof camera === 'undefined') return;
  const C = CONFIG.VOXFIRE, P = camera.position, m = VFIRE.m4, K = VFIRE.cols;
  let i = 0;
  for (const F of VFIRE.list) {
    if (!all && Math.abs(F.x - P.x) + Math.abs(F.z - P.z) > C.near) { i += C.cubes + 1; continue; }
    const s = F.s * C.size, k0 = 0.85 + 0.15 * Math.sin(t * 13 + F.ph);
    m.makeScale(s * 0.62 * k0, s * 0.85 * k0, s * 0.62 * k0).setPosition(F.x, F.y + s * 0.45, F.z);   // el núcleo
    M.setMatrixAt(i, m); M.setColorAt(i, K[0]); i++;
    for (let q = 0; q < C.cubes; q++) {
      const u = (t * C.speed + F.ph + q / C.cubes) % 1, a = q * 2.39 + F.ph, w = s * C.cube * (1 - u * 0.85) * (0.75 + 0.25 * Math.sin(a * 3));
      const ox = Math.sin(a + t * 3.1) * s * 0.35 * (0.4 + u), oz = Math.cos(a * 1.3 + t * 2.7) * s * 0.35 * (0.4 + u);
      m.makeScale(w, w, w).setPosition(F.x + ox, F.y + s * 0.3 + u * s * C.height, F.z + oz);
      M.setMatrixAt(i, m); M.setColorAt(i, K[u < 0.28 ? 0 : u < 0.6 ? 1 : 2]); i++;
    }
  }
  M.instanceMatrix.needsUpdate = true;
  if (M.instanceColor) M.instanceColor.needsUpdate = true;
}
function fakeLightAdd(x, y, z, r, color, k) { FLIGHT.list.push({ x, y, z, r, c: new THREE.Color(color), k }); }
function fakeLightTint(z) {
  // (los bosses no: Diego pidió que la Bestia no brille en la oscuridad. Los perros tampoco: el brillo iba solo al pelo,
  // casi negro, y lo dejaba gris y parejo al lado de los detalles, que están en otro material)
  if (z.boss || z.dog || !z.flashMats || !z.flashMats.length || (z.flash || 0) > 0) return;
  const c = FLIGHT.c.setRGB(0, 0, 0), y = z.root ? z.root.position.y + 1 : 1;
  let any = false;
  for (const L of FLIGHT.list) {
    const dx = z.px - L.x, dz = z.pz - L.z;
    if (Math.abs(dx) > L.r || Math.abs(dz) > L.r || Math.abs(y - L.y) > 4) continue;
    const d = Math.hypot(dx, dz);
    if (d >= L.r) continue;
    const w = (1 - d / L.r) ** 2 * L.k;
    c.r += L.c.r * w; c.g += L.c.g * w; c.b += L.c.b * w; any = true;
  }
  if (!any && !z.fakeLit) return;
  const g = CONFIG.WEATHER.fakeLight.gain;
  c.r = Math.min(g, c.r * g); c.g = Math.min(g, c.g * g); c.b = Math.min(g, c.b * g);
  for (const m of z.flashMats) if (m.emissive) m.emissive.copy(c);
  z.fakeLit = any;
}
function nightTint(k, f) {
  f = f || 0;
  const fol = 1 - (1 - CONFIG.WEATHER.foliage.night) * k, m = fol + (1 - fol) * f;
  for (const mat of [VOXT.mat, typeof FOLI !== 'undefined' ? FOLI.mat : null]) {
    if (!mat) continue;
    if (!mat.userData.em0) mat.userData.em0 = mat.emissive.clone();
    mat.color.setScalar(m);
    mat.emissive.copy(mat.userData.em0).multiplyScalar(Math.max(0, 1 - k));
  }
  if (typeof CATA !== 'undefined' && CATA.skyMat) {
    const c = 1 - (1 - CONFIG.CATA.night) * k;
    CATA.skyMat.color.setScalar(c + (1 - c) * f);
  }
}
function voxTreeGeos() {
  // F5.28f (Diego): verde de jungla mojada, oscuro (antes, verde lima brillante)
  const LEAF = [0x132811, 0x183015, 0x1d3819, 0x23401d, 0x294822, 0x305026], BARK = [0x5a4028, 0x6a4a30, 0x4a3420, 0x7a5a3a];
  // color de cada cubo de hoja: más claro arriba y afuera, manchas de tono por zona (no cubo a cubo: se ven parches), y
  // muy de vez en cuando una flor, solo en la cáscara de arriba
  const leafCol = (rr, ox, oy, oz) => (x, y, z) => {
    const f = rr(), patch = pbHash(Math.floor((x + ox) / 1.1), Math.floor((y + oy) / 1.1), Math.floor((z + oz) / 1.1));
    if (y > 0.2 && f < 0.012) return [f < 0.006 ? 0xd84a6a : 0xf0c850, false];
    const k = Math.max(0, Math.min(5, Math.floor(2.2 + y * 1.1 + (patch - 0.5) * 2.6 + (f - 0.5) * 0.9)));
    return [LEAF[k], false];
  };
  // árbol de hoja ancha. near: tronco de cubos con corteza, musgo y nudos, raíces tablares, ramas en cadena, copas huecas
  // de cubos con varios tonos, lianas y flores. far: el mismo tronco en menos cubos y copas gruesas
  // F5.28f (rendimiento: un árbol de cerca pesaba 15 800 triángulos y el de lejos 11 000): lod 0 cerca (cubos de hoja de
  // 0.5), 1 medio (0.95) y 2 lejos (1.6, sin ramas: bloques grandes, lo que se ve a través de la niebla)
  const broad = (seed, H, spread, clusters, lod) => {
    const near = lod === 0, low = lod === 2;
    const mb = new MeshBuilder(), rr = mulberry(seed), s = near ? 0.34 : low ? 1.1 : 0.6;
    let x = 0, z = 0; const lx = (rr() - 0.5) * 0.08, lz = (rr() - 0.5) * 0.08;
    for (let y = 0; y < H; y += s) {                                     // tronco (se inclina de a poco; ensanchado abajo)
      const w = (0.62 - (y / H) * 0.22 + (y < 0.7 ? 0.18 * (1 - y / 0.7) : 0)) * (near ? 1 : 1.05);
      mb.box(x, y + s / 2, z, w, s, w, BARK[Math.floor(rr() * 4)]);
      if (near) for (const sd of [-1, 1]) mb.box(x + sd * w * 0.22, y + s / 2, z + w / 2 + 0.005, 0.05, s, 0.02, 0x3a2818);   // surcos de la corteza
      if (near && rr() < 0.25) mb.box(x + (rr() < 0.5 ? -w / 2 : w / 2), y + s / 2, z + (rr() - 0.5) * w * 0.6, 0.06, s * 0.8, 0.14, 0x3a2818);   // nudos
      if (near && y < 1.6 && rr() < 0.6) mb.box(x - w / 2 - 0.02, y + s / 2, z + (rr() - 0.5) * w * 0.5, 0.06, s, 0.2, 0x4a6a2a);          // musgo
      x += lx * s * 3; z += lz * s * 3;
    }
    if (near) for (let k = 0; k < 4; k++) {                            // raíces tablares
      const a = k * 1.57 + rr() * 0.6;
      voxChain(mb, [Math.cos(a) * 0.25, 0.7, Math.sin(a) * 0.25], [Math.cos(a), -0.8, Math.sin(a)], 4, 0.32, 0.16, BARK[2], 0.2, rr);
    }
    const tx = x, tz = z, tops = [];
    for (let k = 0; k < clusters; k++) {                                // ramas y copas
      const a = k / clusters * Math.PI * 2 + rr() * 0.8, by = H * (0.62 + rr() * 0.22);
      // (lejos, sin rama: la copa va donde terminaría una rama del medio)
      const end = low ? [tx + Math.cos(a) * 1.6, by + 1.1, tz + Math.sin(a) * 1.6]
        : voxChain(mb, [tx, by, tz], [Math.cos(a), 0.7, Math.sin(a)], near ? 5 : 3, near ? 0.26 : 0.34, near ? 0.14 : 0.24, BARK[1], near ? 0.25 : 0, rr);
      tops.push([end[0] + Math.cos(a) * spread * 0.3, end[1] + 0.5, end[2] + Math.sin(a) * spread * 0.3, spread * (0.75 + rr() * 0.3)]);
    }
    tops.push([tx, H + 0.6, tz, spread * 1.1]);
    for (const [cx, cy, cz, r] of tops) {
      // la copa en dos pisos: uno ancho y chato abajo y otro más chico arriba, con huecos sueltos que rompen la silueta
      const v = near ? 0.5 : low ? 1.6 : 0.95, holes = (x, y, z) => pbHash(x + cx, y + cy, z + cz) > (near ? 0.08 : 0.03);
      voxBlob(mb, mb, cx, cy, cz, r, r * 0.42, r, v, leafCol(rr, cx, cy, cz), holes, near ? 0.5 : 0);
      voxBlob(mb, mb, cx + (rr() - 0.5) * r * 0.3, cy + r * 0.45, cz + (rr() - 0.5) * r * 0.3, r * 0.68, r * 0.38, r * 0.68, v, leafCol(rr, cx, cy + 1, cz), holes, near ? 0.45 : 0);
      if (near) {                                                         // hojas sueltas que cuelgan del borde y lianas
        for (let i = 0; i < 6; i++) { const a = rr() * 6.28; mb.box(cx + Math.cos(a) * r * 0.95, cy - r * 0.45 - rr() * 0.3, cz + Math.sin(a) * r * 0.95, 0.3, 0.3, 0.3, LEAF[Math.floor(rr() * 3)]); }
        if (rr() < 0.7) { const a = rr() * 6.28; voxChain(mb, [cx + Math.cos(a) * r * 0.6, cy - r * 0.5, cz + Math.sin(a) * r * 0.6], [0, -1, 0], 4 + Math.floor(rr() * 5), 0.14, 0.1, 0x3a5a1e, 0.3, rr); }
      }
    }
    return mb.geometry();
  };
  // palmera: tronco en cadena de cubos arqueado con anillos, cocos y frondas en cadena que caen, con hojitas a los costados
  const palmV = (seed, H, bend, lod) => {
    const near = lod === 0, low = lod === 2;
    const mb = new MeshBuilder(), rr = mulberry(seed), n = near ? 20 : low ? 5 : 9, pts = [];
    for (let i = 0; i <= n; i++) { const k = i / n; pts.push([bend * k * k * 1.6, H * k, 0]); }
    for (let i = 0; i < n; i++) {
      const [x, y] = pts[i], w = 0.42 - 0.16 * (i / n);
      mb.box(x, y + H / n / 2, 0, w, H / n * 1.02, w, i % 2 ? 0x8a7a60 : 0x6e5e46);
      if (near && i % 2 === 0) mb.box(x, y + H / n * 0.1, 0, w + 0.06, 0.07, w + 0.06, 0x4a3e2c);          // anillos
    }
    const [tx, ty] = pts[n];
    mb.box(tx, ty, 0, 0.5, 0.35, 0.5, 0x5a4a34);
    for (let k = 0; k < 3; k++) { const a = k * 2.1; mb.box(tx + Math.cos(a) * 0.28, ty - 0.25, Math.sin(a) * 0.28, 0.26, 0.26, 0.26, 0x6a4a22); }   // cocos
    const nf = near ? 8 : low ? 5 : 6;
    for (let k = 0; k < nf; k++) {
      const a = k / nf * Math.PI * 2 + rr() * 0.3;
      let px = tx, py = ty + 0.1, pz = 0, dy = 0.45;
      const steps = near ? 8 : low ? 2 : 4, st = near ? 0.36 : low ? 1.4 : 0.7;
      for (let j = 0; j < steps; j++) {
        px += Math.cos(a) * st; pz += Math.sin(a) * st; py += dy * st; dy -= near ? 0.2 : low ? 0.8 : 0.4;
        const c = j > steps - 3 ? 0x34542a : 0x28461e;
        mb.box(px, py, pz, st * 1.05, 0.08, st * 1.05, c, 0, -a, 0);
        if (near && j > 0) for (const sd of [-1, 1]) {                    // hojitas a los costados, cayendo
          const lx = px + Math.cos(a + sd * 1.57) * 0.28, lz = pz + Math.sin(a + sd * 1.57) * 0.28;
          mb.box(lx, py - 0.1, lz, 0.3, 0.06, 0.12, j % 2 ? 0x2e4e24 : 0x3a5a2c, 0, -a, sd * 0.6);
        }
      }
    }
    return mb.geometry();
  };
  const G = {};
  const defs = { broadA: s => broad(71, 6.4, 1.9, 4, s), broadB: s => broad(137, 5.2, 2.4, 3, s), broadC: s => broad(223, 7.4, 1.5, 3, s),
                 palmJ: s => palmV(311, 7.5, 1.6, s), palmT: s => palmV(419, 6.2, 0.6, s) };
  for (const k in defs) G[k] = { near: defs[k](0), far: defs[k](1), low: defs[k](2) };
  return G;
}
// arma las instancias: list = [{ x, z, big, kind: 'broad' | 'palm', rot, h }]
function buildVoxTrees(list) {
  const C = CONFIG.VOXTREES, S = C.chunk;
  VOXT.geos = voxTreeGeos();
  VOXT.mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x0c1608 });   // un poco de luz propia: la cara de abajo de las copas no queda negra
  VOXT.frustum = new THREE.Frustum(); VOXT.m4 = new THREE.Matrix4(); VOXT.sph = new THREE.Sphere();
  const by = new Map(), q = new THREE.Quaternion(), e = new THREE.Euler(), m = new THREE.Matrix4(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const t of list) {
    const key = Math.floor(t.x / S) + ',' + Math.floor(t.z / S);
    let ch = by.get(key);
    if (!ch) { ch = { cx: (Math.floor(t.x / S) + 0.5) * S, cz: (Math.floor(t.z / S) + 0.5) * S, lists: {}, near: [], far: [], low: [], lod: -1 }; by.set(key, ch); }
    const v = t.kind === 'palm' ? (t.h > 0.5 ? 'palmJ' : 'palmT') : ['broadA', 'broadB', 'broadC'][t.v % 3];
    (ch.lists[v] = ch.lists[v] || []).push(t);
  }
  for (const ch of by.values()) {
    for (const v in ch.lists) {
      const L = ch.lists[v];
      for (const lod of ['near', 'far', 'low']) {
        const im = new THREE.InstancedMesh(VOXT.geos[v][lod], VOXT.mat, L.length);
        L.forEach((t, i) => {
          const s = t.kind === 'palm' ? 0.8 + t.big * 0.6 : 0.7 + t.big * 0.55;
          m.compose(p.set(t.x, 0, t.z), q.setFromEuler(e.set(0, t.rot, 0)), sc.set(s, s * (0.9 + (t.h || 0) * 0.25), s));
          im.setMatrixAt(i, m);
        });
        im.frustumCulled = false; im.visible = false; im.userData.theme = false; im.matrixAutoUpdate = false;
        scene.add(im); ch[lod].push(im);
      }
    }
    VOXT.chunks.push(ch);
  }
}
// cada frame: por celda, prendida si está en pantalla y a menos de la niebla; cerca, el detalle alto
function updateVoxTrees() {
  if (!VOXT.chunks.length || typeof camera === 'undefined' || !camera) return;
  const C = CONFIG.VOXTREES, S = C.chunk, cam = camera.position, far = (scene.fog ? scene.fog.far : 60) + S * 0.72;
  camera.updateMatrixWorld();
  VOXT.m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); VOXT.frustum.setFromProjectionMatrix(VOXT.m4);
  for (const ch of VOXT.chunks) {
    const d = Math.hypot(ch.cx - cam.x, ch.cz - cam.z);
    VOXT.sph.center.set(ch.cx, 5, ch.cz); VOXT.sph.radius = S * 0.75 + 8;
    const on = d < far && VOXT.frustum.intersectsSphere(VOXT.sph);
    const lod = !on ? -1 : d < C.near + S * 0.72 ? 0 : d < C.mid + S * 0.72 ? 1 : 2;
    if (lod === ch.lod) continue;
    ch.lod = lod;
    for (const im of ch.near) im.visible = lod === 0;
    for (const im of ch.far) im.visible = lod === 1;
    for (const im of ch.low) im.visible = lod === 2;
  }
}
function buildJungle() {
  const J = CONFIG.JUNGLE, C = new ChunkMB(32), CL = new ChunkMB(32), CR = new ChunkMB(32);   // corteza, hojas, rocas
  let s = J.seed * 31 + 5;
  const rnd = (a, b) => { s = (s * 16807) % 2147483647; return a + (b - a) * s / 2147483647; };
  const bark = [0x8a7058, 0x7a6048, 0x6a5440, 0x9a7e62], leafT = [0xffffff, 0xe0ecd0, 0xc8dab8, 0xf0f8e0, 0xb8cca8];
  // F5.25 A: los árboles y las palmeras son instancias de cubos (buildVoxTrees): acá solo se junta dónde va cada uno.
  // Mismo sorteo que antes (big < 0.3 = palmera), así caen en los mismos lugares
  const trees = [];
  const tree = (x, z, big) => {
    trees.push({ x, z, big, kind: big < 0.3 ? 'palm' : 'broad', rot: rnd(0, 6.28), h: rnd(0, 1), v: Math.floor(rnd(0, 3)) });
  };
  const bush = (x, z, w, t) => {
    const L = CL.at(x, z);
    L.clump(x, -0.1, z, w, w * 0.85, 'leaf', leafT[t % 5], rnd(0, 3), true);
    L.clump(x + rnd(-0.4, 0.4), -0.1, z + rnd(-0.4, 0.4), w * 0.7, w * 1.05, 'leaf', leafT[(t + 2) % 5], rnd(0, 3), false);
    if (t % 3 === 0) for (let k = 0; k < 3; k++)
      L.card(x + rnd(-0.5, 0.5), 0, z + rnd(-0.5, 0.5), 0.9, 1.4, rnd(-0.3, 0.3), rnd(0, 6.3), rnd(-0.3, 0.3), 'bigleaf', 0xffffff);
  };
  const fern = (x, z, sc) => {
    const L = CL.at(x, z);
    for (let k = 0; k < 6; k++) L.frond(x, 0.04, z, 1.1 * sc, 0.45 * sc, k / 6 * 6.28 + rnd(0, 0.5), -rnd(0.25, 0.7), 'fern', leafT[k % 5]);
  };
  for (const t of JUNGLE.trees) tree(t.x, t.z, t.big, true);
  // F5.15: la espesura: árboles tupidos con sotobosque (sin collider: la pared la pone world.js buildThicketWalls)
  let nb = 0;
  for (let x = -86; x < 99; x += 3.4) for (let z = -23; z < 104; z += 3.4) {   // F5.19: el mapa creció al oeste, norte y este
    const tx = x + rnd(-1.2, 1.2), tz = z + rnd(-1.2, 1.2);
    if (![[0, 0], [1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3]].every(([a, b]) => thicketDraw(tx + a, tz + b))) continue;   // F5.28e: + sobre las catacumbas
    tree(tx, tz, rnd(0.25, 1), false);
    bush(tx + rnd(-1.4, 1.4), tz + rnd(-1.4, 1.4), rnd(1.4, 2.4), nb++);
  }
  // una hilera de arbustos sobre cada pared de vegetación, del lado de la espesura (su cara = la de la pared)
  for (const sg of THICKET.segs) {
    const horiz = sg[1] - sg[0] > sg[3] - sg[2], len = horiz ? sg[1] - sg[0] : sg[3] - sg[2], n = Math.ceil(len / 1.3);
    const xm = (sg[0] + sg[1]) / 2, zm = (sg[2] + sg[3]) / 2;
    // F5.24: un tramo puede traer su lado y su cara (las paredes del caparazón tienen patio de los dos lados)
    const sd = sg.side || (horiz ? (inThicket(xm, sg[3] + 0.6) ? 1 : -1) : (inThicket(sg[1] + 0.6, zm) ? 1 : -1));
    const face = sg.face !== undefined ? sg.face : horiz ? (sd > 0 ? sg[2] : sg[3]) : (sd > 0 ? sg[0] : sg[1]);
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n, w = rnd(1.5, 2.3), off = face + sd * w * 0.42;
      const x = horiz ? sg[0] + (sg[1] - sg[0]) * k : off, z = horiz ? off : sg[2] + (sg[3] - sg[2]) * k;
      bush(x, z, w, i);
      if (i % 3 === 0) { const vl = rnd(1.2, 2.4); CL.at(x, z).card(x, 3 - vl, z, 0.5, vl, 0, rnd(0, 3), 0, 'vine', 0xffffff); }
      const fx = horiz ? x + rnd(-0.4, 0.4) : face - sd * 0.2, fz = horiz ? face - sd * 0.2 : z + rnd(-0.4, 0.4), fr = roomAt(fx, fz);
      if (i % 2 === 0 && fr && /jungle|grass|sand/.test(fr.floor)) fern(fx, fz, rnd(0.5, 0.8));   // no al pie de la pared de la piscina
    }
  }
  // franja tupida afuera del borde (tapa el vacío): los puntos de afuera a menos de J.outer m del mapa (espesura o
  // cuartos). F5.19: se calcula sola (antes eran tramos a mano, que había que rehacer cada vez que el borde cambiaba).
  // Al sur de z -4 solo del lado este (al oeste está el mar)
  const inMap = (x, z) => !!roomAt(x, z) || inThicket(x, z);
  const nearMap = (x, z) => [[J.outer, 0], [-J.outer, 0], [0, J.outer], [0, -J.outer], [2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]]
    .some(([a, b]) => inMap(x + a, z + b));
  for (let x = NAV.minX - J.outer; x < NAV.minX + NAV.w + J.outer; x += 3) for (let z = -24; z < NAV.minZ + NAV.h + J.outer; z += 3) {
    const tx = x + rnd(-1, 1), tz = z + rnd(-1, 1), big = rnd(0.3, 1);
    if (tz < -4 && tx < 55) continue;
    if (inMap(tx, tz) || !nearMap(tx, tz)) continue;                // F5.17: la fila de afuera nunca adentro del mapa
    tree(tx, tz, big, false);
  }
  // helechos, pasto, flores y rocas con musgo: solo en la jungla caminable, sin colisión
  const TCl = CONFIG.TEMPLE.clear;
  const inJungle = (x, z) => { const r = roomAt(x, z); return r && (r.id === 'R15' || r.id === 'R17' || r.id === 'R20') && r.floor === 'jungle' &&
    !(x > TCl[0] && x < TCl[1] && z > TCl[2] && z < TCl[3]); };   // F5.15: + el anexo (sin tapar el templo)
  for (let n = 0, tries = 0; n < J.ferns && tries < J.ferns * 6; tries++) {
    const x = rnd(-85.5, 97.5), z = rnd(-4, 101.5);
    if (!inJungle(x, z)) continue;
    n++;
    fern(x, z, rnd(0.6, 1.3));
    if (n % 5 === 0) CL.at(x, z).clump(x + 0.4, 0, z, 0.7, 0.7, 'flower', 0xffffff, rnd(0, 3));
  }
  for (let n = 0, tries = 0; n < J.ferns * 3 && tries < J.ferns * 18; tries++) {   // matas de pasto
    const x = rnd(-85.5, 97.5), z = rnd(-4, 101.5);
    if (!inJungle(x, z)) continue;
    n++;
    CL.at(x, z).clump(x, -0.02, z, rnd(0.6, 1.0), rnd(0.45, 0.8), 'grass', leafT[n % 5], rnd(0, 3));
  }
  for (let n = 0, tries = 0; n < J.rocks && tries < J.rocks * 6; tries++) {
    const x = rnd(-85, 97), z = rnd(-20, 101);
    if (!inJungle(x, z)) continue;
    n++;
    const w = rnd(0.4, 1.1), R = CR.at(x, z);
    R.rock(x, w * 0.22, z, w, w * 0.62, w * 0.82, [0x8a8a80, 0x7a7a70, 0x9a968a][n % 3], n, 0, rnd(0, 3), 0);
    R.blob(x + 0.05, w * 0.55, z, w * 0.62, w * 0.16, w * 0.5, 0x4a6a2a, n);           // musgo
  }
  // F5.17b (Diego: "en los bosques deja el piso verde, ahorita es arena"): pasto oscuro debajo de la espesura y de la
  // franja de afuera. Justo debajo del piso de los cuartos (que lo tapan); UV en metros, así los tramos que se pisan
  // quedan iguales y no titilan
  // F5.28e: con agujeros en las bajadas a cielo abierto de las catacumbas (si no, el pasto las tapa desde arriba)
  const gf = new MeshBuilder(), q0 = (x1, x2, z1, z2) => gf.quad([x1, -0.012, z2], [x2, -0.012, z2], [x2, -0.012, z1], [x1, -0.012, z1],
    [[x1 / 3, -z2 / 3], [x2 / 3, -z2 / 3], [x2 / 3, -z1 / 3], [x1 / 3, -z1 / 3]], 0xffffff);
  const q = (x1, x2, z1, z2) => { for (const p of cutRects([x1, x2, z1, z2], CONFIG.CATA.ramps.map(R => [R.x1, R.x2, R.z1, R.z2]))) q0(p[0], p[1], p[2], p[3]); };
  for (const r of CONFIG.THICKET) q(r[0], r[1], r[2], r[3]);
  q(-110, 125, 74, 125); q(-110, -86, -4, 74); q(55, 125, -24, 55); q(95, 125, 55, 74);   // F5.19: bordes nuevos
  const gm = gf.mesh(new THREE.MeshLambertMaterial({ map: TEX.grass, color: 0x5a7446 }));
  if (gm) { gm.userData.theme = false; gm.updateMatrix(); }
  for (const m of C.meshes(MAT.bark)) m.updateMatrix();
  for (const m of CL.meshes(FOLI.mat)) m.updateMatrix();
  for (const m of CR.meshes(MAT.rock)) m.updateMatrix();
  buildVoxTrees(trees);                                               // F5.25 A
  // niebla verde baja (planos transparentes)
  const mist = new THREE.MeshBasicMaterial({ map: radialTex('rgba(215,235,205,1)', 'rgba(215,235,205,.45)'), transparent: true, opacity: 0.16,
    depthWrite: false, side: THREE.DoubleSide });                   // F5.17: con bordes suaves (antes se veía el cuadrado)
  for (let n = 0, tries = 0; n < 24 && tries < 200; tries++) {
    const x = rnd(-82, 95), z = rnd(0, 100);
    if (!inJungle(x, z)) continue;
    n++;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), mist);
    p.rotation.x = -Math.PI / 2; p.position.set(x, 0.5 + rnd(0, 0.4), z); scene.add(p);
  }
}

//--- F5.17 (Diego: "los jardines se ven muy planos", "menos Minecraft"): cercos de hojas, lianas en los cercos que
// se queman, pasto y helechos en los bordes, caminos de lajas, faroles, bancos, tikis, macetas y hiedra en las
// paredes de la casa. Todo dibujo (sin collider): no toca el grid. No tapa tizas, máquinas ni cajas
const LAMPS = { mat: null };
function buildGardenDress() {
  // (F5.28f, rendimiento: el follaje de los jardines en celdas de 24 m; en un solo mesh eran 148 000 triángulos siempre)
  const lf = new ChunkMB(24).proxy(), rk = new MeshBuilder(), wd = new MeshBuilder(), mb = new MeshBuilder(), bl = new MeshBuilder(), hl = new MeshBuilder(), rr = mulberry(88);
  const leafT = [0xffffff, 0xe0ecd0, 0xc8dab8, 0xf0f8e0, 0xb8cca8], keep = [];
  for (const w of CONFIG.WALLBUYS) keep.push([w.x, w.z]);
  for (const k in CONFIG.PERKS.list) keep.push([CONFIG.PERKS.list[k].x, CONFIG.PERKS.list[k].z]);
  for (const k in CONFIG.GENERATORS.spots) keep.push([CONFIG.GENERATORS.spots[k].x, CONFIG.GENERATORS.spots[k].z]);
  for (const k in CONFIG.SOULS.spots) keep.push([CONFIG.SOULS.spots[k].x, CONFIG.SOULS.spots[k].z]);
  for (const k in CONFIG.BOX.spots) keep.push([CONFIG.BOX.spots[k].x, CONFIG.BOX.spots[k].z]);
  const free = (x, z, r) => !keep.some(([a, b]) => Math.hypot(a - x, b - z) < r);
  const fern = (x, z, sc) => { for (let k = 0; k < 6; k++) lf.frond(x, 0.04, z, 1.1 * sc, 0.45 * sc, k / 6 * 6.28 + rr() * 0.5, -0.25 - rr() * 0.45, 'fern', leafT[k % 5]); };
  // 1) cercos de arbustos: hojas pegadas a las dos caras y matas arriba (el bloque verde queda de núcleo)
  for (const c of WORLD.colliders) {
    if (c.tag !== 'hedge' || !c.mesh || (WORLD.beachWall && c === WORLD.beachWall.col)) continue;   // (la de la playa va aparte: se va con H8)
    const alongX = c.maxX - c.minX > c.maxZ - c.minZ, L = alongX ? c.maxX - c.minX : c.maxZ - c.minZ, n = Math.ceil(L / 1.1), H = c.maxY;
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n, x = alongX ? c.minX + f * (c.maxX - c.minX) : (c.minX + c.maxX) / 2, z = alongX ? (c.minZ + c.maxZ) / 2 : c.minZ + f * (c.maxZ - c.minZ);
      for (const sd of [-1, 1]) {
        const fx = alongX ? x : (sd > 0 ? c.maxX : c.minX), fz = alongX ? (sd > 0 ? c.maxZ : c.minZ) : z;
        if (!free(fx, fz, 1.3)) continue;
        for (const off of [0.04, 0.14]) {
          const px = alongX ? fx + (rr() - 0.5) * 0.3 : fx + sd * off, pz = alongX ? fz + sd * off : fz + (rr() - 0.5) * 0.3;
          lf.card(px, -0.12, pz, 1.5, H + 0.3, 0, alongX ? 0 : Math.PI / 2, (rr() - 0.5) * 0.2, 'leaf', leafT[(i + (off > 0.1 ? 2 : 0)) % 5]);
        }
      }
      lf.clump(x, H - 0.5, z, 1.25, 0.95, 'leaf', leafT[(i + 1) % 5], rr() * 3, true);
    }
  }
  // 2) los cercos que se queman son lianas: cortina de lianas y hojas, hija del bloque (se hunde y se va con él)
  for (const H of CONFIG.BURN.hedges) {
    const d = state.doors[H.id];
    if (!d) continue;
    const vb = new MeshBuilder(), alongX = H.z1 === H.z2, L = alongX ? H.x2 - H.x1 : H.z2 - H.z1, n = Math.ceil(L / 0.3);
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n, x = alongX ? H.x1 + f * (H.x2 - H.x1) : H.x1, z = alongX ? H.z1 : H.z1 + f * (H.z2 - H.z1), len = 2.1 + rr() * 0.9;
      for (const sd of [-0.16, 0.16]) vb.card(alongX ? x : x + sd, 2.9 - len, alongX ? z + sd : z, 0.55, len, 0, alongX ? 0 : Math.PI / 2, (rr() - 0.5) * 0.1, i % 3 ? 'vine' : 'moss', 0xffffff);
      if (i % 3 === 0) vb.clump(x, -0.1, z, 1.3, 1.2 + rr() * 0.6, 'leaf', leafT[i % 5], rr() * 3);
    }
    const vm = vb.mesh(FOLI.mat);
    if (vm) { scene.remove(vm); vm.userData.theme = false; vm.matrixAutoUpdate = true; vm.position.copy(d.mesh.position).negate(); d.mesh.add(vm); }
  }
  // la pared de la playa oeste (se quema con H8): hojas y lianas hijas del bloque
  if (WORLD.beachWall) {
    const W = WORLD.beachWall, c = W.col, vb = new MeshBuilder(), x = (c.minX + c.maxX) / 2;
    for (let z = c.minZ + 0.5; z < c.maxZ; z += 1.1) for (const sd of [-1, 1]) {
      vb.card(x + sd * 0.25, -0.12, z + (rr() - 0.5) * 0.3, 1.5, c.maxY + 0.3, 0, Math.PI / 2, (rr() - 0.5) * 0.2, 'leaf', leafT[Math.floor(z) % 5]);
      if (Math.floor(z) % 3 === 0) vb.card(x + sd * 0.3, c.maxY - 1.6, z, 0.5, 1.8, 0, Math.PI / 2, 0, 'vine', 0xffffff);
    }
    const vm = vb.mesh(FOLI.mat);
    if (vm) { scene.remove(vm); vm.userData.theme = false; vm.matrixAutoUpdate = true; vm.position.copy(W.mesh.position).negate(); W.mesh.add(vm); }
  }
  // 3) pasto y helechos al pie de los bordes de los jardines (sin tapar tizas ni máquinas)
  for (const r of ROOMS.filter(q => q.id === 'R12' || q.id === 'R13')) {
    const w = r.x2 - r.x1, h = r.z2 - r.z1, per = 2 * (w + h), n = Math.round(per / 1.1);
    for (let k = 0; k < n; k++) {
      let t = rr() * per, x, z;
      const inset = 0.3 + rr() * 0.55;
      if (t < w) { x = r.x1 + t; z = r.z1 + inset; } else if ((t -= w) < h) { x = r.x2 - inset; z = r.z1 + t; }
      else if ((t -= h) < w) { x = r.x2 - t; z = r.z2 - inset; } else { t -= w; x = r.x1 + inset; z = r.z2 - t; }
      const rm = roomAt(x, z);
      if (!rm || rm.id !== r.id || !free(x, z, 1.6)) continue;
      if (k % 4 === 0) fern(x, z, 0.5 + rr() * 0.4);
      else lf.clump(x, -0.02, z, 0.7 + rr() * 0.5, 0.45 + rr() * 0.4, 'grass', leafT[k % 5], rr() * 3);
      if (k % 9 === 0) lf.clump(x, 0, z, 0.6, 0.5, 'flower', 0xffffff, rr() * 3);
    }
  }
  // 4) caminos de lajas
  const path = pts => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.95);
      for (let k = 0; k < n; k++) {
        const f = (k + rr() * 0.3) / n, x = ax + (bx - ax) * f + (rr() - 0.5) * 0.3, z = az + (bz - az) * f + (rr() - 0.5) * 0.3;
        rk.rock(x, -0.02, z, 0.42 + rr() * 0.2, 0.07, 0.36 + rr() * 0.16, [0xa8a498, 0x98948a, 0xb4b0a4][k % 3], k, 0, rr() * 3, 0);
      }
    }
  };
  path([[-12, -3], [-13.5, 4], [-18.5, 10.5], [-20, 18], [-21, 25], [-25.5, 28.5]]);      // jardín oeste: de la reja al lazo
  path([[2.5, 29], [3, 34], [12, 35], [22, 34.5], [30.5, 33], [33, 26], [33, 21]]);      // trasero: del pasillo a la piscina
  // 5) faroles de hierro (foco MeshBasic que brilla: sin luces), bancos y tikis
  for (const [x, z] of [[-9, 5.5], [-23, 15.5], [-17, 37.5], [5.5, 39.3], [18.5, 39.3], [30.5, 31]]) {
    mb.cyl(x, 0, z, 0.16, 0.25, 0x2a2a2e, 0.8, 8); mb.cyl(x, 0.25, z, 0.055, 2.3, 0x2a2a2e, 0.8, 8);
    mb.cyl(x, 2.55, z, 0.2, 0.08, 0x2a2a2e, 1, 8); mb.cyl(x, 2.63, z, 0.16, 0.34, 0x3a3a3e, 1, 6);
    mb.cyl(x, 2.97, z, 0.23, 0.2, 0x2a2a2e, 0, 6);
    bl.sphere(x, 2.8, z, 0.1, 0.12, 0.1, 0xffe8b0, 6);
    for (const r of [0, Math.PI / 2]) hl.add(UNIT_PLANE, x, 2.8, z, 1.3, 1.3, 1, 0, r, 0, 0xffffff);
  }
  const bench = (x, z, ry) => {
    mb.setFrame(x, 0, z, ry);
    for (let q = 0; q < 4; q++) mb.box(0, 0.45, -0.18 + q * 0.12, 1.6, 0.04, 0.1, [0x8a6440, 0x7a5a38][q % 2]);
    for (let q = 0; q < 3; q++) mb.box(0, 0.62 + q * 0.12, 0.24, 1.6, 0.09, 0.03, 0x8a6440, -0.2, 0, 0);
    for (const sx of [-0.7, 0.7]) { mb.box(sx, 0.22, 0, 0.06, 0.44, 0.5, 0x2a2a2e); mb.box(sx, 0.6, 0.26, 0.05, 0.4, 0.05, 0x2a2a2e, -0.2, 0, 0); }
    mb.setFrame(null);
  };
  bench(-23.1, 12.5, Math.PI / 2); bench(12, 39.3, Math.PI);
  const tiki = (x, z, ry, h) => {
    wd.cyl(x, 0, z, 0.34, h, 0x8a6a48, 0.92, 10);
    mb.setFrame(x, 0, z, ry);
    for (let q = 0; q < 2; q++) {                                    // dos caras apiladas
      const y = h * (0.35 + q * 0.4);
      mb.box(0, y + 0.18, 0.3, 0.5, 0.08, 0.1, 0x5a3e24);            // ceja
      for (const sx of [-0.12, 0.12]) { mb.box(sx, y + 0.06, 0.31, 0.12, 0.1, 0.05, 0xf0e8c8); mb.box(sx, y + 0.06, 0.34, 0.05, 0.06, 0.02, 0x1a1208); }
      mb.box(0, y - 0.05, 0.33, 0.12, 0.2, 0.1, 0x6a4a2e);           // nariz
      mb.box(0, y - 0.24, 0.31, 0.36, 0.12, 0.06, 0x2a1a0e);         // boca
      mb.box(0, y - 0.24, 0.32, 0.3, 0.04, 0.06, 0xf0e8c8);          // dientes
    }
    mb.setFrame(null);
    lf.clump(x, h - 0.1, z, 0.7, 0.5, 'palm', 0xe8f0d0, ry);        // penacho de hojas
  };
  tiki(-9.3, -3.1, Math.PI, 2.1); tiki(-3.2, 30.8, Math.PI / 2, 1.9);
  // 6) macetas grandes de barro con plantas de hoja grande, contra las paredes
  for (const [x, z] of [[-8.9, 16.9], [-15.3, 19.4], [23.2, 30.9], [-3.1, 33.5], [33.9, 30.5]]) {
    if (!free(x, z, 1.2)) continue;
    rk.lathe([[0.25, 0], [0.34, 0.1], [0.4, 0.55], [0.46, 0.62], [0.42, 0.66]], x, 0, z, 1, 1, 1, 0xb0643a, 12);
    rk.box(x, 0.55, z, 0.6, 0.06, 0.6, 0x3a2616);                      // tierra (F5.25: la maceta de cubos es hueca)
    for (let q = 0; q < 6; q++) lf.card(x, 0.55, z, 0.7, 1.2 + rr() * 0.4, (rr() - 0.5) * 0.7, q * 1.05, (rr() - 0.5) * 0.7, 'bigleaf', 0xffffff);
  }
  // 7) hiedra que trepa por las paredes de la casa que dan a los jardines. F5.28e (Diego: "cuadrados verdes en las paredes"):
  // eran planos con la textura de hojas, que desde el follaje en cubos se veían como cuadrados llenos. Ahora es hiedra en
  // cubos: un tallo que sube zigzagueando pegado a la cara y hojas chatas (verdes oliva) a los costados
  const ivy = (x1, z1, x2, z2, ry, n) => voxIvy(mb, rr, x1, z1, x2, z2, ry, n, 3.0, 0, (x, z) => free(x, z, 1.5));
  ivy(-8.23, 4.5, -8.23, 17.5, -Math.PI / 2, 26);                   // sala, cara oeste (al jardín oeste)
  ivy(-16.23, 18.5, -16.23, 34.5, -Math.PI / 2, 26);                // garaje y sótano, cara oeste
  ivy(4.5, 30.23, 23.5, 30.23, 0, 34);                              // dormitorio y caseta, cara norte (al jardín trasero)
  ivy(-3.77, 30.5, -3.77, 35.5, Math.PI / 2, 10);                   // sótano, cara este
  const put = (B, mat) => { const m = B.mesh(mat); if (m) { m.userData.theme = false; m.updateMatrix(); } return m; };
  put(lf, FOLI.mat); put(rk, MAT.rock); put(wd, MAT.bark); put(mb, MAT.grimeV);
  put(bl, new THREE.MeshBasicMaterial({ vertexColors: true }));
  LAMPS.mat = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,236,190,1)', 'rgba(255,200,120,.35)'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, vertexColors: true, opacity: 0.55 });
  put(hl, LAMPS.mat);
}

// F5.28e: altura del techo de la nave del templo en (x, z), o 0 si ahí no hay techo (afuera o en un hoyo). La usa la
// lluvia (rainRoof): frena en la bóveda y entra por los hoyos
function templeRoofAt(x, z) {
  const T = CONFIG.TEMPLE, C = T.columns, RF = T.roof;
  if (x < C.xs[0] - 0.5 || x > C.xs[1] + 0.5 || z < T.top.z1 || z > T.top.z2) return 0;
  if (RF.holes.some(([a, b]) => z > a && z < b) && Math.abs(x - (C.xs[0] + C.xs[1]) / 2) < 1.6) return 0;
  return UP.y + C.h + 0.6 + RF.frieze;
}
// F5.28e: hiedra en cubos pegada a una pared vertical (de (x1, z1) a (x2, z2), cara hacia ry: 0 = +z, ±π/2 = ±x). Cada
// planta: un tallo que sube zigzagueando hasta `maxH` m (desde y0) con hojas chatas verde oliva a los costados. `ok(x, z)`
// descarta lugares (tizas, máquinas). Reemplaza a los planos con textura de hojas, que se veían como cuadrados llenos
// (más claros que la paleta del plan de color: el material con grano y la cara en sombra los oscurecen bastante)
const IVY_COLS = [0x7a8a48, 0x8a9452, 0x9aa05c, 0x6a8448, 0xa4b066];
function voxIvy(mb, rr, x1, z1, x2, z2, ry, n, maxH, y0, ok) {
  const nx = ry === 0 ? 0 : ry > 0 ? 1 : -1, nz = ry === 0 ? 1 : 0;       // normal de la cara
  const tx = nz, tz = -nx;                                               // a lo largo de la pared
  for (let k = 0; k < n; k++) {
    const f = rr(), bx = x1 + (x2 - x1) * f, bz = z1 + (z2 - z1) * f, top = y0 + 0.8 + Math.pow(rr(), 1.4) * maxH;
    if (ok && !ok(bx, bz)) continue;
    let u = 0;
    for (let y = y0 + 0.1; y < top; y += 0.16) {
      u += (rr() - 0.5) * 0.12;
      const x = bx + tx * u + nx * 0.03, z = bz + tz * u + nz * 0.03;
      mb.box(x, y, z, 0.05 + Math.abs(tx) * 0.02, 0.18, 0.05 + Math.abs(tz) * 0.02, 0x6a5a3a);   // tallo
      const leaves = 1 + Math.floor(rr() * 3);
      for (let q = 0; q < leaves; q++) {
        const s = 0.1 + rr() * 0.12, o = (rr() - 0.5) * 0.55;
        mb.box(x + tx * o + nx * 0.03, y + (rr() - 0.5) * 0.1, z + tz * o + nz * 0.03,
               Math.abs(tx) > 0.5 ? s : 0.03, s * 0.8, Math.abs(tz) > 0.5 ? s : 0.03, IVY_COLS[Math.floor(rr() * IVY_COLS.length)]);
      }
    }
  }
}
//--- F5.17 (Diego: "el templo está muy básico"): raíces gigantes que bajan por la pirámide (como Ta Prohm), hiedra y
// lianas, bloques caídos, cabezas colosales de piedra a los lados del puente sur, estelas talladas, cabezas de
// serpiente al pie de las rampas, juncos y nenúfares en el río
// F5.19: para la nave nueva: las raíces bajan por la cara oeste de la plancha (la que se ve), hiedra en esa cara y
// lianas colgando de los dinteles
function buildTempleDress() {
  const T = CONFIG.TEMPLE, P = T.top, Y = UP.y, rr = mulberry(99);
  const wd = new MeshBuilder(), lf = new MeshBuilder(), st = new MeshBuilder(), rk = new MeshBuilder(), gl = new MeshBuilder();
  const leafT = [0xffffff, 0xe0ecd0, 0xc8dab8, 0xf0f8e0, 0xb8cca8];
  const onRamp = (z, m) => T.ramps.some(R => z > R.z1 - (m || 0.8) && z < R.z2 + (m || 0.8));
  // perfil de la cara hacia afuera desde el borde de la plancha: [cuánto afuera, alto]
  const prof = [[-0.4, Y + 0.2], [0.1, Y + 0.05], [0.25, Y * 0.62], [0.55, Y * 0.3], [1.3, 0.3], [2.1, 0.05], [2.9, -0.1]];
  for (let k = 0; k < 20; k++) {
    const side = k % 7 === 5 ? 's' : k % 7 === 6 ? 'n' : 'w';
    const a = side === 'w' ? P.z1 + 1 + rr() * (P.z2 - P.z1 - 2) : P.x1 + 1 + rr() * (P.x2 - P.x1 - 2);
    if (side === 'w' && onRamp(a)) continue;
    const pt = ([o, y]) => side === 's' ? [a + Math.sin(o * 1.3 + k) * 0.25, y, P.z1 - o] : side === 'n' ? [a, y, P.z2 + o]
                        : [P.x1 - o, y, a + Math.sin(o * 1.3 + k) * 0.25];
    const pts = prof.map(pt), r0 = 0.3 + rr() * 0.12;
    wd.tube(pts, r0, 0.1, [0x7a6450, 0x6a5440, 0x8a7258][k % 3], 22, 7);
    if (k % 2 === 0) {                                                // raíz que se abre en dos al pie
      const e = pts[pts.length - 2], sd = rr() < 0.5 ? -1 : 1;
      wd.tube([e, [e[0] + (side === 'w' ? -0.6 : sd * 1.2), 0.1, e[2] + (side === 'w' ? sd * 1.2 : side === 's' ? -0.6 : 0.6)]], 0.14, 0.05, 0x6a5440, 5, 6);
    }
    for (let q = 1; q < 5; q++) { const p = pts[q]; lf.clump(p[0], p[1] - 0.3, p[2], 0.9, 0.7, q % 2 ? 'ivy' : 'fern', leafT[q % 5], rr() * 3); }
  }
  // hiedra en la cara oeste de la plancha (F5.28e: en cubos; los planos se veían como cuadrados verdes) y lianas del borde
  voxIvy(gl, rr, P.x1 - 0.9, P.z1, P.x1 - 0.9, P.z2, -Math.PI / 2, 60, Y - 1.2, 0, (x, z) => !onRamp(z));
  for (let k = 0; k < 27; k++) {
    const z = P.z1 + rr() * (P.z2 - P.z1);
    if (onRamp(z)) continue;
    const L = 0.8 + rr() * 1.6; lf.card(P.x1 - 0.05, Y - L, z, 0.45, L, 0, -Math.PI / 2, 0, k % 2 ? 'vine' : 'moss', 0xffffff);
  }
  for (const [x, z] of templeColumns()) {                             // lianas que cuelgan de los dinteles
    if (rr() < 0.4) continue;
    const L = 1 + rr() * 2.4;
    lf.card(x + (rr() - 0.5) * 2, Y + T.columns.h - L + 0.2, z + (rr() - 0.5) * 3, 0.5, L, 0, rr() * 3, 0, rr() < 0.5 ? 'vine' : 'moss', 0xffffff);
  }
  // bloques caídos al pie de la cara oeste (pegados a la pared, lejos de las rampas)
  for (let k = 0; k < 26; k++) {
    const z = P.z1 + 1 + rr() * (P.z2 - P.z1 - 2), x = P.x1 - 0.4 - rr() * 1.1, sc = 0.4 + rr() * 0.5;
    if (onRamp(z, 1.6)) continue;
    st.box(x, sc * 0.35, z, sc * 1.4, sc * 0.7, sc, [0xffffff, 0xeae6da, 0xd6d2c4][k % 3], rr() * 0.4, rr() * 3, rr() * 0.3);
  }
  // F5.19b (Diego): en lugar de las cabezas, estatuas cúbicas de plantas carnívoras (PROPS cabezaN, misma caja):
  // pedestal con glifos tallados, tallo de bloques, hojas en losas, y la cabeza en cubos con la boca abierta y dientes
  const glyph = (x, y, z, s, seed) => {                                  // un glifo: marco hundido y un dibujo de bloquecitos
    st.box(x, y, z, s, s, 0.03, 0x8a8478);
    for (let q = 0; q < 4; q++) {
      const b = (seed * 7 + q * 3) % 9, gx = (b % 3 - 1) * s * 0.28, gy = (Math.floor(b / 3) - 1) * s * 0.28;
      st.box(x + gx, y + gy, z + 0.02, s * 0.24, s * 0.24, 0.02, [0x9a2a1e, 0x2a6a5a, 0xd8a838, 0x5a4a3a][(seed + q) % 4]);
    }
  };
  T.heads.forEach(([x, z, r], i) => {
    st.setFrame(x, 0, z, r + Math.PI);                                 // mira al camino
    st.box(0, 0.3, 0, 2.0, 0.6, 1.9, 0xd6d2c4);                        // pedestal
    st.box(0, 0.64, 0, 1.8, 0.08, 1.7, 0xb8b4a4);
    for (let q = 0; q < 4; q++) { glyph(-0.66 + q * 0.44, 0.3, 0.96, 0.34, i * 5 + q); glyph(-0.66 + q * 0.44, 0.3, -0.96, 0.34, i * 3 + q + 1); }
    for (let k = 0; k < 4; k++) st.box(0, 0.85 + k * 0.4, 0, 0.5 - k * 0.04, 0.38, 0.5 - k * 0.04, k % 2 ? 0xc8c4b4 : 0xd6d2c4, 0, k * 0.2, 0);   // tallo
    for (const s of [-1, 1]) {                                          // hojas en losas, bajando a los costados
      st.box(s * 0.62, 1.05, 0.1, 0.9, 0.1, 0.5, 0xc8c4b4, 0, 0, s * -0.35);
      st.box(s * 0.55, 1.65, -0.15, 0.7, 0.08, 0.4, 0xd6d2c4, 0, 0.3 * s, s * -0.5);
      for (let q = 0; q < 3; q++) st.box(s * (0.35 + q * 0.2), 1.08 - q * 0.07 + 0.05, 0.36, 0.06, 0.1, 0.06, 0xb8b4a4);   // espinas
    }
    // cabeza: dos mandíbulas en cubo abiertas hacia adelante, con dientes de bloque y el glifo del sol en la frente
    st.box(0, 2.3, 0.05, 1.3, 0.34, 1.2, 0xd6d2c4, -0.18, 0, 0);         // mandíbula de abajo
    st.box(0, 2.95, -0.05, 1.3, 0.42, 1.2, 0xc8c4b4, 0.42, 0, 0);        // mandíbula de arriba, abierta
    for (let q = 0; q < 5; q++) {
      st.box(-0.5 + q * 0.25, 2.52, 0.55, 0.1, 0.22, 0.1, 0xf0ece0);
      st.box(-0.5 + q * 0.25 + 0.12, 2.78, 0.62, 0.1, 0.22, 0.1, 0xf0ece0);
    }
    st.box(0, 2.46, 0.1, 1.0, 0.04, 0.9, 0x2a1a2a);                    // garganta oscura
    glyph(0, 3.02, 0.62, 0.42, i + 11);
    st.setFrame(null);
    for (let q = 0; q < 3; q++) lf.clump(x + (rr() - 0.5) * 2, 0.62, z + (rr() - 0.5) * 1.6, 0.7, 0.4, 'ivy', leafT[q], rr() * 3);
    lf.clump(x, -0.05, z + 1.2, 1.4, 0.7, 'fern', 0xffffff, rr() * 3);
  });
  // estelas talladas (PROPS estelaN) con glifos pintados
  for (const [x, z, r] of T.stelae) {
    st.setFrame(x, 0, z, r);
    st.box(0, 1.3, 0, 0.9, 2.6, 0.4, 0xeae6da);
    st.box(0, 2.66, 0, 1.0, 0.14, 0.48, 0xc8c4b4);
    st.box(0, 0.08, 0, 1.2, 0.16, 0.7, 0xb8b4a4);
    for (let q = 0; q < 4; q++) for (const sd of [-1, 1]) st.box(sd * 0.2, 0.6 + q * 0.5, 0.21 * (sd > 0 ? 1 : 1), 0.3, 0.32, 0.02, [0x9a2a1e, 0x2a6a5a, 0xd8a838, 0x6a5a48][(q + (sd > 0 ? 1 : 0)) % 4]);
    st.setFrame(null);
    lf.clump(x, -0.05, z, 1.0, 0.6, 'grass', 0xffffff, r);
  }
  // cabezas de serpiente emplumada al pie de las alfardas de las rampas
  for (const R of T.ramps) {
    const zAx = R.axis === 'z';
    for (const sd of [-1, 1]) {
      const x = zAx ? (sd < 0 ? R.x1 - 0.2 : R.x2 + 0.2) : R.x1 - 0.1, z = zAx ? R.z1 - 0.1 : (sd < 0 ? R.z1 - 0.2 : R.z2 + 0.2);
      st.setFrame(x, 0, z, zAx ? Math.PI : -Math.PI / 2);
      st.blob(0, 0.45, 0.2, 0.34, 0.36, 0.55, 0xd6d2c4, 1);
      st.box(0, 0.22, 0.5, 0.5, 0.12, 0.5, 0xb8b4a4);                  // mandíbula
      for (let q = 0; q < 4; q++) st.cyl(-0.18 + q * 0.12, 0.28, 0.72, 0.03, 0.14, 0xf0ece0, 0, 5);   // colmillos
      for (const ex of [-0.2, 0.2]) st.blob(ex, 0.62, 0.45, 0.07, 0.06, 0.05, 0x3a2a1a, 2);
      for (let q = 0; q < 5; q++) st.box((q - 2) * 0.13, 0.9, -0.05, 0.1, 0.35, 0.05, [0x2a6a5a, 0x9a2a1e][q % 2], 0.3, 0, (q - 2) * 0.2);   // plumas
      st.setFrame(null);
    }
  }
  // juncos en las orillas del río y nenúfares con flor
  const Rv = T.river, [wx1, wx2, wz1, wz2] = Rv.w, bridgeFree = (z, m) => !Rv.bridges.some(g => z > g[1] - m && z < g[2] + m);   // F5.19: un solo brazo
  for (let k = 0; k < 44; k++) {
    const z = wz1 + rr() * (wz2 - wz1), x = rr() < 0.5 ? wx1 - 0.35 : wx2 + 0.35;
    if (!bridgeFree(z, 0.8)) continue;
    lf.clump(x, 0, z, 0.8, 1.1 + rr() * 0.5, 'grass', 0xd8e4b0, rr() * 3);
  }
  for (let k = 0; k < 30; k++) {
    const x = wx1 + 0.6 + rr() * (wx2 - wx1 - 1.2), z = wz1 + 1 + rr() * (wz2 - wz1 - 2);
    if (!bridgeFree(z, 0.5)) continue;
    gl.cyl(x, 0.085, z, 0.28 + rr() * 0.15, 0.01, [0x3a7a3a, 0x4a8a44][k % 2], 1, 10);
    if (k % 4 === 0) gl.sphere(x + 0.05, 0.12, z, 0.07, 0.05, 0.07, [0xf0a0c0, 0xf8f0f0][k % 2], 6);
  }
  const put = (B, mat) => { const m = B.mesh(mat); if (m) { m.userData.theme = false; m.updateMatrix(); } return m; };
  put(wd, MAT.bark); put(lf, FOLI.mat); put(rk, MAT.rock); put(gl, MAT.grimeV);
  put(st, new THREE.MeshLambertMaterial({ map: TEX.stone, vertexColors: true }));
}

//--- F5.12: cercos que se queman (puertas con burn). Llamas creadas una vez por cerco, ocultas
const BURNS = { mat: null };
function buildBurns() {
  const B = CONFIG.BURN;
  BURNS.mat = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,230,120,1)', 'rgba(255,90,0,0.5)'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const geo = new THREE.PlaneGeometry(1.6, 2.4);
  for (const H of B.hedges) {
    const d = state.doors[H.id], list = [];
    for (let i = 0; i < B.flames; i++) {
      const k = (i + 0.5) / B.flames, f = new THREE.Mesh(geo, BURNS.mat);
      f.position.set(H.x1 + (H.x2 - H.x1) * k, 1.2, H.z1 + (H.z2 - H.z1) * k);
      f.rotation.y = H.x1 === H.x2 ? Math.PI / 2 : 0;
      f.visible = false; scene.add(f); list.push(f);
    }
    d.flames = list;
  }
  // F5.17b: el cerco de la playa oeste arde junto con H8 (llamas propias a lo largo de sus 20 m)
  const W = WORLD.beachWall;
  if (W) {
    W.flames = [];
    const c = W.col;
    for (let i = 0; i < 24; i++) {
      const f = new THREE.Mesh(geo, BURNS.mat);
      f.position.set((c.minX + c.maxX) / 2, 1.2, c.minZ + (c.maxZ - c.minZ) * (i + 0.5) / 24); f.rotation.y = Math.PI / 2;
      f.visible = false; scene.add(f); W.flames.push(f);
    }
  }
}
function startBurn(d) {
  d.burning = true; d.burnT = CONFIG.BURN.time;
  for (const f of d.flames) f.visible = true;
  if (d.id === 'H8' && WORLD.beachWall && WORLD.beachWall.flames) for (const f of WORLD.beachWall.flames) f.visible = true;   // F5.17b
  sfxExplosion(Math.hypot(player.pos.x - d.mesh.position.x, player.pos.z - d.mesh.position.z));
  return true;
}
function updateBurns(dt) {
  const B = CONFIG.BURN, t = clock.elapsedTime;
  for (const H of B.hedges) {
    const d = state.doors[H.id];
    if (!d || !d.burning) continue;
    d.burnT -= dt;
    const k = 1 - Math.max(0, d.burnT) / B.time;                       // 0 -> 1
    d.mesh.material.color.setRGB(1 - 0.85 * k, 1 - 0.9 * k, 1 - 0.9 * k);   // se pone negro
    d.mesh.position.y = d.y0 - Math.max(0, k - 0.5) * 2 * CONFIG.GARDEN.hedgeH;   // y se hunde
    d.flames.forEach((f, i) => { f.scale.set(1, 0.7 + 0.5 * Math.abs(Math.sin(t * 9 + i)) * (1 - k * 0.5), 1); });
    const W = H.id === 'H8' && WORLD.beachWall;                       // F5.17b: el cerco de la playa arde con H8
    if (W) {
      W.mesh.material.color.setRGB(1 - 0.85 * k, 1 - 0.9 * k, 1 - 0.9 * k);
      W.mesh.position.y = W.y0 - Math.max(0, k - 0.5) * 2 * CONFIG.GARDEN.hedgeH;
      W.flames.forEach((f, i) => { f.scale.set(1, 0.7 + 0.5 * Math.abs(Math.sin(t * 8 + i)) * (1 - k * 0.5), 1); if (d.burnT <= 0) f.visible = false; });
    }
    if (d.burnT <= 0) {
      d.burning = false;
      for (const f of d.flames) f.visible = false;
      openDoor(H.id);
      d.mesh.position.y = d.y0; d.mesh.material.color.setHex(0xffffff);
      STATS.doors++;
      updateFlowField(true);
    }
  }
}
function resetBurns() {
  for (const H of CONFIG.BURN.hedges) {
    const d = state.doors[H.id];
    if (!d) continue;
    d.burning = false; d.burnT = 0;
    if (d.y0 !== undefined) d.mesh.position.y = d.y0;
    d.mesh.material.color.setHex(0xffffff);
    if (d.flames) for (const f of d.flames) f.visible = false;
  }
  if (WORLD.beachWall && WORLD.beachWall.flames) for (const f of WORLD.beachWall.flames) f.visible = false;   // F5.17b
}

//--- F5.13: el templo (solo dibujo; lo sólido va en world.js buildTempleShell). Bloques de piedra de ~1.5 m
// (así la textura no se estira) en un mesh, detalles pintados en otro, y antorchas con fuego aditivo
const TEMPLEFX = { flames: [] };
function buildTemple() {
  const T = CONFIG.TEMPLE, Y = UP.y, st = new MeshBuilder(), dt = new MeshBuilder();
  const tones = [0xffffff, 0xeae6da, 0xd6d2c4, 0xc8c4b4], moss = [0xb8c8a0, 0xa8bc90, 0xc0c8a8], tr = mulberry(61);
  let n = 0;
  const tone = () => tr() < 0.16 ? moss[(n++) % 3] : tones[(n++ * 7) % 4];   // F5.17: con manchas de musgo
  // caja de piedra: bloques de hasta `b` m en las 4 caras y arriba (inset 0 = pegada a lo sólido)
  const block = (x1, x2, y1, y2, z1, z2, b) => {
    b = b || 1.5;
    const band = 0.55, nx = Math.max(1, Math.round((x2 - x1) / b)), nz = Math.max(1, Math.round((z2 - z1) / b));
    for (let y = y1; y < y2 - 0.01; y += band) {
      const h = Math.min(band, y2 - y), yc = y + h / 2, sh = ((y - y1) / band) % 2 ? 0.5 : 0;
      for (let i = 0; i < nx; i++) {
        const w = (x2 - x1) / nx, cx = x1 + (i + 0.5) * w + sh * 0.2;
        st.box(cx, yc, z1 + 0.05, w - 0.04, h - 0.04, 0.1, tone());
        st.box(cx, yc, z2 - 0.05, w - 0.04, h - 0.04, 0.1, tone());
      }
      for (let i = 0; i < nz; i++) {
        const w = (z2 - z1) / nz, cz = z1 + (i + 0.5) * w + sh * 0.2;
        st.box(x1 + 0.05, yc, cz, 0.1, h - 0.04, w - 0.04, tone());
        st.box(x2 - 0.05, yc, cz, 0.1, h - 0.04, w - 0.04, tone());
      }
    }
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const w = (x2 - x1) / nx, d = (z2 - z1) / nz;
      st.box(x1 + (i + 0.5) * w, y2 - 0.05, z1 + (k + 0.5) * d, w - 0.03, 0.1, d - 0.03, tone());
    }
  };
  const P = T.top, torchesHall = [];
  block(P.x1, P.x2, 0, Y, P.z1, P.z2);
  for (const t of T.tiers) block(t[0], t[1], 0, T.tierH, t[2], t[3]);
  // F5.19: la plancha de la nave. Cara oeste en talud y tablero (como Teotihuacán): talud inclinado abajo, tablero
  // saliente arriba con un friso rojo de glifos, y cornisa oscura en el borde
  for (let z = P.z1; z < P.z2 - 0.01; z += 2) {
    if (T.ramps.some(R => z + 2 > R.z1 && z < R.z2)) continue;
    st.box(P.x1 - 0.45, 0.8, z + 1, 0.9, 1.6, 1.96, tone(), 0, 0, 0.28);      // talud
    st.box(P.x1 - 0.3, 2.9, z + 1, 0.6, 1.6, 1.96, tone());                  // tablero
    dt.box(P.x1 - 0.61, 2.9, z + 1, 0.02, 0.9, 1.7, 0x9a2a1e);               // friso
    dt.box(P.x1 - 0.62, 2.9, z + 1, 0.02, 0.4, 0.4, [0xd8a838, 0x2a6a5a][Math.round(z) % 2]);   // glifo
  }
  for (const [x1, x2, z1, z2] of [[P.x1 - 0.7, P.x2, P.z1 - 0.12, P.z1 + 0.12], [P.x1 - 0.7, P.x2, P.z2 - 0.12, P.z2 + 0.12], [P.x1 - 0.72, P.x1 - 0.48, P.z1, P.z2]])
    dt.box((x1 + x2) / 2, Y - 0.05, (z1 + z2) / 2, x2 - x1, 0.14, z2 - z1, 0x6a665a);   // cornisas
  // alfardas (muros bajos a los costados de las rampas)
  for (const R of T.ramps) {
    const run = R.axis === 'z' ? R.z2 - R.z1 : R.x2 - R.x1, L = Math.hypot(run, Y), a = Math.atan2(Y, run);
    if (R.axis === 'z') for (const x of [R.x1 - 0.15, R.x2 + 0.15]) st.box(x, Y / 2 + 0.2, (R.z1 + R.z2) / 2, 0.3, 0.5, L, tone(), -a, 0, 0);
    else for (const z of [R.z1 - 0.15, R.z2 + 0.15]) st.box((R.x1 + R.x2) / 2, Y / 2 + 0.2, z, L, 0.5, 0.3, tone(), 0, 0, a);
    // portal de la llegada arriba: dos pilares y un dintel con glifos
    const gz = (R.z1 + R.z2) / 2, gw = R.z2 - R.z1;
    for (const z of [R.z1 - 0.45, R.z2 + 0.45]) block(P.x1 + 0.05, P.x1 + 0.85, Y, Y + 3.6, z - 0.4, z + 0.4, 0.8);
    block(P.x1, P.x1 + 0.9, Y + 3.6, Y + 4.3, R.z1 - 0.9, R.z2 + 0.9, 1.2);
    for (let q = 0; q < 3; q++) dt.box(P.x1 - 0.03, Y + 3.95, gz - gw / 3 + q * gw / 3, 0.02, 0.4, 0.5, [0x9a2a1e, 0xd8a838, 0x2a6a5a][q]);
  }
  // F5.19: columnas de la nave (sólidas arriba: world.js templeColumns) con basa, fuste en tambores y capitel; dinteles a
  // lo largo de cada fila y vigas cruzadas por encima, como una pérgola de piedra
  const C = T.columns, cols = templeColumns(), cy = Y + C.h, xm = (C.xs[0] + C.xs[1]) / 2;
  for (const [x, z] of cols) {
    st.box(x, Y + 0.15, z, C.r * 2 + 0.35, 0.3, C.r * 2 + 0.35, tone());
    for (let k = 0; k < 5; k++) st.cyl(x, Y + 0.3 + k * (C.h - 0.9) / 5, z, C.r * (0.98 - k * 0.03), (C.h - 0.9) / 5 - 0.03, tone(), 1, 10);
    st.box(x, cy - 0.3, z, C.r * 2 + 0.4, 0.6, C.r * 2 + 0.4, tone());
    dt.box(x, Y + 1.6, z, C.r * 2 + 0.04, 0.25, C.r * 2 + 0.04, 0x9a2a1e);   // anillo pintado
  }
  for (const xr of C.xs) {                                            // dinteles de cada fila
    const row = cols.filter(c => c[0] === xr).sort((a, b) => a[1] - b[1]);
    for (let i = 0; i + 1 < row.length; i++) {
      const [x, za] = row[i], zb = row[i + 1][1];
      if (zb - za > C.every + 0.1) continue;                            // hueco (llegada de una rampa)
      st.box(x, cy + 0.3, (za + zb) / 2, 1.0, 0.6, zb - za + 0.9, tone());
      dt.box(x + (x < xm ? -0.51 : 0.51), cy + 0.3, (za + zb) / 2, 0.02, 0.3, zb - za - 0.6, 0x2a6a5a);
    }
  }
  // F5.28e: bóveda maya en saledizo (sin las vigas cruzadas: una atravesaba la planta). Sobre los dinteles, un friso de
  // glifos; encima, hiladas que avanzan hacia adentro de los dos lados (y hacia adentro por afuera: el techo se ve
  // escalonado) hasta la piedra de cumbrera, y arriba la crestería calada. En los hoyos (RF.holes) falta la cumbrera
  { const RF = T.roof, xa = C.xs[0] - 0.5, xb = C.xs[1] + 0.5, y0 = cy + 0.6, span = xb - xa, seg = 2;
    const hole = (z1, z2) => RF.holes.some(([a, b]) => z2 > a + 0.01 && z1 < b - 0.01);
    const yTop = y0 + RF.frieze + RF.steps * RF.stepH;
    for (let z = P.z1; z < P.z2 - 0.01; z += seg) {
      const z2 = Math.min(P.z2, z + seg), zm = (z + z2) / 2, L = z2 - z - 0.03, h = hole(z, z2);
      for (const s of [-1, 1]) {
        const xo = s < 0 ? xa : xb;                                   // borde de afuera de este lado
        st.box(xo - s * 0.45, y0 + RF.frieze / 2, zm, 0.9, RF.frieze, L, tone());      // friso
        dt.box(xo + s * 0.01, y0 + RF.frieze / 2, zm, 0.02, RF.frieze * 0.62, L * 0.86, 0x7a2a1e);
        const g = Math.round(zm) % 3;                                  // glifo: marco y bloquecitos
        dt.box(xo + s * 0.02, y0 + RF.frieze / 2, zm, 0.02, 0.5, 0.5, [0xb89a55, 0x2a5a4a, 0x8a7a5a][g]);
        dt.box(xo + s * 0.03, y0 + RF.frieze / 2 + 0.08, zm - 0.1, 0.02, 0.14, 0.14, 0x3a2a1e);
        dt.box(xo + s * 0.03, y0 + RF.frieze / 2 - 0.1, zm + 0.1, 0.02, 0.14, 0.14, 0x3a2a1e);
        for (let k = 0; k < RF.steps; k++) {                          // hiladas en saledizo
          const inner = 0.8 + (k + 1) * RF.stepIn, outer = k * RF.stepIn * 0.42, w = inner - outer;
          const xc = s < 0 ? xa + outer + w / 2 : xb - outer - w / 2;
          st.box(xc, y0 + RF.frieze + k * RF.stepH + RF.stepH / 2, zm, w, RF.stepH - 0.02, L, tone());
          if (tr() < 0.12) st.box(xc + s * 0.3, y0 + RF.frieze + k * RF.stepH, zm, 0.5, 0.25, 0.6, tone(), tr() * 0.4, 0, tr() * 0.4);   // bloque suelto
        }
        // el borde de abajo de cada hilada, por adentro, más oscuro (se lee el escalonado de la bóveda desde abajo)
        for (let k = 0; k < RF.steps; k++) {
          const x = s < 0 ? xa + 0.8 + (k + 1) * RF.stepIn : xb - 0.8 - (k + 1) * RF.stepIn;
          dt.box(x, y0 + RF.frieze + k * RF.stepH + 0.02, zm, 0.04, 0.04, L, 0x2a2622);
        }
      }
      if (h) continue;
      const gap = span - 2 * (0.8 + RF.steps * RF.stepIn);             // lo que queda abierto arriba: la cumbrera
      st.box((xa + xb) / 2, yTop + RF.stepH / 2, zm, gap + 0.8, RF.stepH, L, tone());
      // crestería calada: dos pilares y un dintel por tramo, estuco rojo y una máscara en el medio
      const xm = (xa + xb) / 2, yc = yTop + RF.stepH;
      for (const dz of [-0.7, 0.7]) st.box(xm, yc + RF.comb / 2, zm + dz, 0.5, RF.comb, 0.4, tone());
      st.box(xm, yc + RF.comb - 0.25, zm, 0.55, 0.5, L, tone());
      st.box(xm, yc + 0.2, zm, 0.55, 0.4, L, tone());
      dt.box(xm - 0.29, yc + RF.comb * 0.55, zm, 0.02, 0.6, 0.6, [0x7a2a1e, 0xb89a55][Math.round(zm) % 2]);
      dt.box(xm + 0.29, yc + RF.comb * 0.55, zm, 0.02, 0.6, 0.6, [0x7a2a1e, 0xb89a55][Math.round(zm + 1) % 2]);
    }
    // haces de luz por los hoyos (aditivos, sin luces) hasta la plancha
    const sh = new MeshBuilder();
    for (const [a, b] of RF.holes) {
      const zm = (a + b) / 2, xm = (xa + xb) / 2, H = yTop - Y;
      for (const r of [0, Math.PI / 2]) sh.box(xm, Y + H / 2, zm, r ? 0.02 : 2.2, H, r ? b - a : 0.02, 0x8a8a70);
    }
    const shm = sh.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    if (shm) { shm.userData.theme = false; shm.updateMatrix(); }
  }
  // la procesión: camino de mosaico de punta a punta y el estrado del Pack-a-Punch en el medio
  const px = (C.xs[0] + C.xs[1]) / 2 - 1;
  for (let z = P.z1 + 0.5; z < P.z2 - 0.4; z += 1.1) dt.box(px, Y + 0.012, z, 3.2, 0.02, 1.05, Math.round(z) % 2 ? 0x6a5a48 : 0x8a7a5a);
  const PS = CONFIG.PAP.spot;
  st.box(PS.x, Y + 0.08, PS.z, 5, 0.16, 5, tone()); st.box(PS.x, Y + 0.2, PS.z, 3.6, 0.1, 3.6, tone());
  for (const [dx, dz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) dt.box(PS.x + dx, Y + 0.25, PS.z + dz, 0.5, 0.02, 0.5, 0xd8a838);
  // F5.19: el río de norte a sur (un brazo): fondo, orillas de piedra, agua que se mueve y 3 puentes de tablones
  const R = T.river, [wx1, wx2, wz1, wz2] = R.w;
  dt.box((wx1 + wx2) / 2, 0.015, (wz1 + wz2) / 2, wx2 - wx1, 0.01, wz2 - wz1, 0x3a5a4a);             // fondo
  for (const [a, b] of [[wx1, wx1 + 0.3], [wx2 - 0.3, wx2]]) st.box((a + b) / 2, 0.12, (wz1 + wz2) / 2, b - a, 0.24, wz2 - wz1, 0xb0ac9c);
  { const w = new THREE.Mesh(new THREE.PlaneGeometry(wx2 - wx1 - 0.6, wz2 - wz1), waterMat(0x3a8a9a, wx2 - wx1, wz2 - wz1, 0.82));   // F7c: se mueve
    w.rotation.x = -Math.PI / 2; w.position.set((wx1 + wx2) / 2, 0.07, (wz1 + wz2) / 2);
    w.userData.theme = false; scene.add(w); }
  for (const [, c1, c2] of R.bridges) {
    const x1 = wx1 - 0.4, x2 = wx2 + 0.4, cx = (x1 + x2) / 2, m = c2 - c1;
    for (let i = 0; i < 8; i++) dt.box(cx, 0.18, c1 + (i + 0.5) / 8 * m, x2 - x1, 0.08, m / 8 - 0.05, i % 2 ? 0x7a5634 : 0x6a4a2c);   // tablones
    for (const c of [c1, c2]) { dt.box(cx, 0.9, c, x2 - x1, 0.06, 0.06, 0xb89a6a); for (const x of [x1, x2]) dt.box(x, 0.55, c, 0.14, 1.1, 0.14, 0x5a4028); }
  }
  // braseros a lo largo de la nave (entre las columnas del lado este)
  for (let z = P.z1 + 5; z < P.z2 - 3; z += 10) torchesHall.push([C.xs[1] - 1.4, z, Y]);
  // antorchas: arriba de cada rampa y al pie (y las de la nave)
  const torches = torchesHall;
  for (const Rm of T.ramps) {
    const [bx, bz] = Rm.bottom, [tx, tz] = Rm.top;
    if (Rm.axis === 'z') torches.push([Rm.x1 - 0.5, bz + 0.6, 0], [Rm.x2 + 0.5, bz + 0.6, 0], [Rm.x1 - 0.1, tz + 0.4, Y], [Rm.x2 + 0.1, tz + 0.4, Y]);
    else torches.push([bx + 0.6, Rm.z1 - 0.5, 0], [bx + 0.6, Rm.z2 + 0.5, 0], [tx + 0.4, Rm.z1 - 0.1, Y], [tx + 0.4, Rm.z2 + 0.1, Y]);
  }
  const glow = new MeshBuilder(), TG = T.glow, coal = new MeshBuilder();
  const hmat = new THREE.SpriteMaterial({ map: radialTex('rgba(255,200,120,.9)', 'rgba(255,120,30,.25)'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: TG.halo });
  TEMPLEFX.halo = hmat;
  // (el brasero va en sus propios meshes con un brillo cálido: lo ilumina su fuego; si no, de noche era una silueta negra)
  const bst = new MeshBuilder(), bdt = new MeshBuilder();
  for (const [x, z, y] of torches) {
    // F5.28f (Diego: "metele diseño a las antorchas del templo, que iluminen más"): brasero maya en cubos. Base de dos
    // escalones, fuste con una calavera tallada en cada cara, cuenco escalonado con borde y 4 colmillos en las esquinas,
    // brasas que brillan (MeshBasic), llama de 3 planos cruzados con un núcleo blanco y un halo que titila
    bst.box(x, y + 0.1, z, 0.95, 0.2, 0.95, tone()); bst.box(x, y + 0.28, z, 0.72, 0.16, 0.72, tone());
    bst.box(x, y + 0.66, z, 0.44, 0.6, 0.44, tone());
    for (let k = 0; k < 4; k++) {                                       // la calavera de cada cara
      const a = k * Math.PI / 2, sx = Math.sin(a), sz = Math.cos(a), fx = x + sx * 0.225, fz = z + sz * 0.225, px = Math.cos(a), pz = -Math.sin(a);
      bdt.box(fx + sx * 0.01, y + 0.72, fz + sz * 0.01, sx ? 0.03 : 0.3, 0.26, sz ? 0.03 : 0.3, 0xb8ad90);
      for (const e of [-1, 1]) bdt.box(fx + sx * 0.03 + px * e * 0.07, y + 0.76, fz + sz * 0.03 + pz * e * 0.07, sx ? 0.02 : 0.07, 0.07, sz ? 0.02 : 0.07, 0x1a100a);
      bdt.box(fx + sx * 0.03, y + 0.63, fz + sz * 0.03, sx ? 0.02 : 0.16, 0.04, sz ? 0.02 : 0.16, 0x3a2a1a);
    }
    bst.box(x, y + 1.0, z, 0.62, 0.1, 0.62, tone()); bst.box(x, y + 1.12, z, 0.86, 0.14, 0.86, tone());
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      bst.box(x + sx * 0.4, y + 1.24, z + sz * 0.4, 0.1, 0.1, 0.1, tone());   // borde
      bdt.box(x + sx * 0.44, y + 1.34, z + sz * 0.44, 0.08, 0.2, 0.08, 0xd8ccb0, sz * 0.3, 0, -sx * 0.3);   // colmillos
    }
    for (let k = 0; k < 9; k++) coal.box(x + ((k % 3) - 1) * 0.2, y + 1.21 + (k % 2) * 0.03, z + (Math.floor(k / 3) - 1) * 0.2, 0.17, 0.08, 0.17,
      [0xff8a2a, 0xff5a10, 0xffc050][k % 3]);                           // brasas
    voxFire(x, y + 1.25, z, 1.25);                                     // la llama, en cubos
    const h = new THREE.Sprite(hmat); h.position.set(x, y + 1.75, z); h.scale.set(TG.haloSize, TG.haloSize, 1);
    h.userData.theme = false; scene.add(h);
    // F5.28f (Diego: "antorchas que iluminen un poco en el templo"): una mancha de luz cálida en el piso alrededor (plano
    // aditivo, titila con el fuego) y luz falsa para los zombies que pasan (fakeLightTint). Sin luces de verdad
    glow.add(UNIT_PLANE, x, y + 0.06, z, TG.pool * 2, TG.pool * 2, 1, -Math.PI / 2, 0, 0, 0xffffff);
    fakeLightAdd(x, y + 1.2, z, TG.r, 0xffa050, TG.light);
  }
  const cm = coal.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
  if (cm) { cm.userData.theme = false; cm.updateMatrix(); }
  for (const [B, mat] of [[bst, new THREE.MeshLambertMaterial({ map: TEX.stone, vertexColors: true, emissive: TG.stoneGlow })],
                          [bdt, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: TG.stoneGlow })]]) {
    const m = B.mesh(mat);
    if (m) { m.userData.theme = false; m.updateMatrix(); }
  }
  const sm = st.mesh(new THREE.MeshLambertMaterial({ map: TEX.stone, vertexColors: true }));
  if (sm) { sm.userData.theme = false; sm.updateMatrix(); }
  const dm = dt.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (dm) { dm.userData.theme = false; dm.updateMatrix(); }
  TEMPLEFX.glow = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,190,110,1)', 'rgba(255,120,40,.3)'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true, opacity: TG.opacity, polygonOffset: true, polygonOffsetFactor: -2 });
  const gm = glow.mesh(TEMPLEFX.glow);
  if (gm) { gm.userData.theme = false; gm.updateMatrix(); }
}
function updateTemple(t) {
  TEMPLEFX.flames.forEach((f, i) => { const k = 0.85 + 0.25 * Math.abs(Math.sin(t * 11 + i * 1.7)); f.scale.set(1, k, 1); });
  const fl = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3);
  if (TEMPLEFX.glow) TEMPLEFX.glow.opacity = CONFIG.TEMPLE.glow.opacity * fl;
  if (TEMPLEFX.halo) TEMPLEFX.halo.opacity = CONFIG.TEMPLE.glow.halo * (0.8 + 0.2 * fl);
}

//--- F5.13: torre de salvavidas (patas sólidas en PROPS 'torreN'; lo demás es dibujo, arriba de la cabeza)
function buildLifeguard() {
  // F5.15: más larga y de estilo rancho: 6 patas de tronco con franjas rojas, deck de tablones, cabina de caña
  // con ventanas al mar, techo de palma en capas (como la palapa del rancho), baranda de troncos y bandera
  const L = CONFIG.LIFEGUARD, mb = new MeshBuilder(), H = L.h, W = L.w, D = L.d;
  const red = 0xd8322a, white = 0xf2eee4, wood = 0x8a6a44, log = 0x7a5a3a, palm = [0xb89a5a, 0xa8884a, 0xc8aa6a];
  for (const [x, z] of lifeguardLegs()) {
    mb.box(x, H / 2, z, 0.3, H, 0.3, log);
    for (let k = 0; k < 2; k++) mb.box(x, 0.5 + k * 1.1, z, 0.32, 0.22, 0.32, red);      // franjas rojas
  }
  for (const s of [-1, 1]) {                                                           // cruces de refuerzo
    for (const h of [-1, 1]) mb.box(L.x + h * W / 4, H * 0.5, L.z + s * (D / 2 - 0.15), 0.08, 0.08, W * 0.55, wood, 0, Math.PI / 2, h * Math.atan2(H * 0.6, W / 2));
  }
  mb.box(L.x, H + 0.08, L.z, W + 0.8, 0.16, D + 0.8, wood);                           // plataforma
  for (let i = 0; i < 12; i++) mb.box(L.x - (W + 0.8) / 2 + (i + 0.5) * (W + 0.8) / 12, H + 0.17, L.z, (W + 0.8) / 12 - 0.04, 0.02, D + 0.8, i % 2 ? 0x9a7a52 : wood);
  const cw = W - 1.6, cd = D - 1.2;                                                    // cabina de caña
  for (let i = 0; i < 14; i++) {
    const x = L.x - cw / 2 + (i + 0.5) * cw / 14;
    mb.box(x, H + 1.1, L.z + cd / 2, cw / 14 - 0.02, 1.9, 0.08, i % 2 ? 0xc8aa78 : 0xb89a68);
    if (i < 4 || i > 9) mb.box(x, H + 1.1, L.z - cd / 2, cw / 14 - 0.02, 1.9, 0.08, i % 2 ? 0xc8aa78 : 0xb89a68);
  }
  for (const s of [-1, 1]) mb.box(L.x + s * cw / 2, H + 1.1, L.z, 0.08, 1.9, cd, 0xb89a68);
  mb.box(L.x, H + 1.5, L.z - cd / 2, cw * 0.43, 0.8, 0.02, 0x3a5a6a);                 // ventana grande al mar
  mb.box(L.x, H + 2.06, L.z, cw + 0.1, 0.06, cd + 0.1, wood);
  mb.box(L.x + 1, H + 1.1, L.z + cd / 2 + 0.05, 0.9, 1.6, 0.02, 0x3a2a1a);           // puerta
  // techo de palma a 2 aguas, 3 capas que sobresalen (como la palapa del rancho)
  for (let c = 0; c < 3; c++) for (const s of [-1, 1]) {
    const y = H + 2.4 + c * 0.22, over = 0.9 - c * 0.25;
    mb.box(L.x, y - c * 0.05, L.z + s * (D / 4 + 0.2 - c * 0.2), W + 2 * over, 0.12, D / 2 + 0.9 - c * 0.3, palm[c], s * 0.42, 0, 0);
  }
  mb.box(L.x, H + 3.15, L.z, W + 0.4, 0.14, 0.3, 0x8a6a3a);                            // cumbrera
  for (let i = 0; i < 10; i++) mb.box(L.x - W / 2 - 0.6 + i * (W + 1.2) / 9, H + 2.05, L.z + (i % 2 ? 1 : -1) * (D / 2 + 0.75), 0.12, 0.35, 0.03, palm[i % 3]);   // flecos
  for (const s of [-1, 1]) mb.box(L.x, H + 0.6, L.z + s * (D + 0.8) / 2, W + 0.8, 0.12, 0.12, log);   // baranda de troncos
  for (const s of [-1, 1]) mb.box(L.x + s * (W + 0.8) / 2, H + 0.6, L.z, 0.12, 0.12, D + 0.8, log);
  for (let i = 0; i <= 6; i++) for (const s of [-1, 1]) mb.box(L.x - (W + 0.8) / 2 + i * (W + 0.8) / 6, H + 0.35, L.z + s * (D + 0.8) / 2, 0.1, 0.5, 0.1, log);
  // escalera al costado (dibujo)
  for (let k = 0; k < 8; k++) mb.box(L.x - W / 2 - 0.7, 0.3 + k * H / 8, L.z + 0.6, 0.6, 0.06, 0.14, wood);
  for (const s of [-0.3, 0.3]) mb.box(L.x - W / 2 - 0.7 + s, H / 2 + 0.2, L.z + 0.6, 0.07, H + 0.6, 0.07, log);
  // salvavidas colgados, tabla de surf, mástil y bandera
  for (const dx of [-1.6, 1.8]) {
    mb.box(L.x + dx, H + 1.3, L.z + cd / 2 + 0.07, 0.6, 0.6, 0.06, 0xf07a1a);
    mb.box(L.x + dx, H + 1.3, L.z + cd / 2 + 0.09, 0.28, 0.28, 0.04, white);
  }
  mb.box(L.x + W / 2 + 0.6, 1.1, L.z + D / 2 - 0.3, 0.5, 2.2, 0.08, 0xd8c060, -0.12, 0, 0.1);
  mb.box(L.x + W / 2 + 0.3, H + 2.8, L.z - D / 2, 0.08, 5.6, 0.08, 0xbababa);
  mb.box(L.x + W / 2 + 0.75, H + 5.2, L.z - D / 2, 0.9, 0.55, 0.02, red);
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (m) { m.userData.theme = false; m.updateMatrix(); }
  const tex = makeTex((c, s) => {
    c.fillStyle = '#d8322a'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#fff'; c.textAlign = 'center';
    c.font = 'bold ' + Math.floor(s * 0.2) + 'px monospace'; c.fillText('LIFE', s / 2, s * 0.42);
    c.fillText('GUARD', s / 2, s * 0.68);
  }, 1, 128);
  tex.magFilter = THREE.LinearFilter;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), new THREE.MeshLambertMaterial({ map: tex }));
  sign.position.set(L.x - 0.2, H + 1.75, L.z + (D - 1.2) / 2 + 0.06); scene.add(sign);
}

//--- F5.19: la bahía del calamar. Agua más baja que el mar de la playa (CONFIG.SQUIDBAY.waterY), con una escollera en
// x -41 que tapa el escalón; la orilla baja al agua; el embarcadero sobre pilotes; el corredor de rocas a la cabeza;
// botes rotos en el agua y animales de mar muertos (algunos alienígenas, que brillan) sobre las tablas. Todo dibujo:
// lo sólido es el bote volcado y el tiburón (PROPS). Ninguna luz nueva (faroles MeshBasic con halo aditivo)
function buildSquidBay() {
  const B = CONFIG.SQUIDBAY, WY = B.waterY, rr = mulberry(1919);
  const wd = new MeshBuilder(), rk = new MeshBuilder(), mb = new MeshBuilder(), gl = new MeshBuilder(), sd = new MeshBuilder(), lf = new MeshBuilder();
  const pier = ROOMS.filter(r => r.id === 'R19' && r.floor === 'pier'), rocks = ROOMS.filter(r => r.id === 'R22' && r.floor === 'rock');
  const wood = [0x6a5038, 0x5a4230, 0x7a5a3e], dark = 0x2a2018, rockC = [0x5a5850, 0x4a4842, 0x6a665a, 0x3e3c36];
  // agua de la bahía (con la textura de ondas que se mueve) hasta el horizonte
  const water = new THREE.Mesh(new THREE.PlaneGeometry(259, 316), waterMat(0x2e4c5a, 259, 316, 1));
  water.rotation.x = -Math.PI / 2; water.position.set(-41 - 129.5, WY, -14 - 158); water.userData.theme = false; scene.add(water);
  // escollera en x -41 (del mar de la playa a la bahía hay un escalón de agua: las piedras lo tapan)
  for (let z = -23.5; z > -75; z -= 1.6) {
    rk.rock(-41 + (rr() - 0.5) * 1.2, WY - 0.4, z, 1.6 + rr() * 0.9, 1.6 + rr() * 0.8, 1.5 + rr() * 0.8, rockC[Math.floor(rr() * 4)], Math.floor(rr() * 8), 0, rr() * 3, 0);
    if (rr() < 0.5) rk.rock(-40 + rr(), WY - 0.2, z + 0.6, 0.9, 0.9, 0.9, rockC[Math.floor(rr() * 4)], Math.floor(rr() * 8), 0, rr() * 3, 0);
  }
  // la orilla (arena) baja al agua por el sur y por el oeste
  const slope = (a, b, c, d) => sd.quad(a, b, c, d, [[0, 0], [1, 0], [1, 1], [0, 1]], 0x6e6c66);   // F5.19b: roca, no arena
  slope([-75, 0.001, -14], [-41, 0.001, -14], [-41, WY - 0.3, -17], [-75, WY - 0.3, -17]);
  slope([-75, 0.001, -4], [-75, 0.001, -14], [-78, WY - 0.3, -17], [-78, WY - 0.3, -4]);
  for (let k = 0; k < 16; k++) {                                         // algas y maderas tiradas en la orilla
    const x = -74 + rr() * 32, z = -13.2 + rr() * 8;
    if (rr() < 0.6) lf.add(UNIT_PLANE, x, 0.02, z, 1 + rr(), 0.6 + rr() * 0.6, 1, -Math.PI / 2, rr() * 6, 0, 0x7a8a5a, FOLI.r.dead);
    else wd.seg([x, 0.08, z], [x + 1.2 + rr(), 0.1, z + (rr() - 0.5)], 0.09, 0.07, 0x8a7a64, 6);
  }
  // embarcadero: borde de vigas, pilotes que asoman como postes, cruces abajo, soga entre postes y tablas rotas
  for (const r of pier) {
    const W = r.x2 - r.x1, D = r.z2 - r.z1, cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2;
    for (const z of [r.z1, r.z2]) wd.box(cx, -0.25, z, W + 0.2, 0.5, 0.22, dark);
    for (const x of [r.x1, r.x2]) wd.box(x, -0.25, cz, 0.22, 0.5, D + 0.2, dark);
    for (let q = 0; q < Math.floor(D / 3); q++) wd.box(cx, -0.55, r.z1 + 1.5 + q * 3, W, 0.25, 0.25, dark);   // vigas de abajo
    const posts = [];
    for (let x = r.x1; x <= r.x2 + 0.01; x += W / Math.max(1, Math.round(W / 3))) for (const z of [r.z1, r.z2]) posts.push([x, z]);
    for (let z = r.z1 + D / Math.max(1, Math.round(D / 3)); z < r.z2 - 0.01; z += D / Math.max(1, Math.round(D / 3))) for (const x of [r.x1, r.x2]) posts.push([x, z]);
    for (const [x, z] of posts) {
      const inside = pier.some(o => o !== r && x > o.x1 + 0.3 && x < o.x2 - 0.3 && z > o.z1 + 0.3 && z < o.z2 - 0.3);
      if (inside || (x > r.x1 + 0.1 && x < r.x2 - 0.1 && pier.some(o => o !== r && Math.abs(z - (z === r.z1 ? o.z2 : o.z1)) < 0.1 && x > o.x1 && x < o.x2))) continue;
      const top = rr() < 0.25 ? 0.2 : 0.9;
      wd.cyl(x, WY - 1.8, z, 0.17, top - WY + 1.8, 0x5a4634, 0.9, 8);
      for (let k = 0; k < 4; k++) mb.sphere(x + Math.cos(k * 1.6) * 0.17, WY + 0.05 + k * 0.12, z + Math.sin(k * 1.6) * 0.17, 0.07, 0.06, 0.07, 0xd8d0c0, 5);   // percebes
      wd.seg([x - 0.3, WY - 1.2, z], [x + 0.3, -0.5, z], 0.05, 0.05, dark, 5);
    }
    for (let i = 0; i < W * D / 18; i++) {                               // tablas sueltas, levantadas o rotas
      const x = r.x1 + 0.6 + rr() * (W - 1.2), z = r.z1 + 0.6 + rr() * (D - 1.2);
      if (rr() < 0.5) mb.box(x, 0.02, z, 0.25, 0.02, 1.2 + rr(), 0x241a12, 0, rr() < 0.5 ? 0 : Math.PI / 2, 0);   // hueco oscuro entre tablas
      else wd.box(x, 0.06, z, 0.22, 0.04, 1.1, wood[i % 3], 0.12, rr() * 3, 0.06);
    }
  }
  // soga entre los postes del borde oeste y el muelle largo
  for (const [a, b] of [[[-72, -30], [-72, -27.2]], [[-72, -20.8], [-72, -14]], [[-62, -50], [-62, -30]], [[-56, -50], [-56, -30]]]) {
    const n = 6, pts = [];
    for (let k = 0; k <= n; k++) { const f = k / n; pts.push([a[0] + (b[0] - a[0]) * f, 0.75 - 0.25 * Math.sin(f * Math.PI * 3) ** 2, a[1] + (b[1] - a[1]) * f]); }
    wd.tube(pts, 0.03, 0.03, 0xc8b078, 24, 4);
  }
  // cajones, barriles, redes y rollos de soga contra los bordes (sin tapar el paso)
  for (const [x, z, k] of [[-71, -29, 0], [-70.2, -29, 1], [-70.6, -28.2, 2], [-45, -15, 0], [-45, -16, 3], [-61.3, -49.2, 1], [-46.6, -43.3, 2], [-44.9, -29.3, 3]]) {
    if (k < 2) { mb.box(x, 0.35, z, 0.7, 0.7, 0.7, [0x7a5a36, 0x6a4a2c][k]); mb.box(x, 0.36, z + 0.351, 0.6, 0.06, 0.01, 0x3a2a1a); }
    else if (k === 2) { wd.cyl(x, 0, z, 0.33, 0.9, 0x5a4a34, 0.95, 10); mb.cyl(x, 0.15, z, 0.335, 0.05, 0x2a2a28, 1, 10); mb.cyl(x, 0.7, z, 0.335, 0.05, 0x2a2a28, 1, 10); }
    else { wd.cyl(x, 0, z, 0.35, 0.18, 0xc8b078, 1, 12); wd.cyl(x, 0.18, z, 0.25, 0.1, 0xb8a068, 1, 12); }
  }
  for (const [x, z, w, d] of [[-68, -29.2, 2.2, 1.4], [-47, -14.8, 1.6, 1.2], [-58.8, -49.2, 2.4, 1]]) {   // redes de pesca tiradas
    lf.add(UNIT_PLANE, x, 0.03, z, w, d, 1, -Math.PI / 2, rr(), 0, 0xb8b0a0, FOLI.r.web);
    for (let k = 0; k < 3; k++) mb.sphere(x + (rr() - 0.5) * w, 0.1, z + (rr() - 0.5) * d, 0.1, 0.1, 0.1, [0xe84a2a, 0xf0c030][k % 2], 6);
  }
  // corredor de rocas a la cabeza: piedras grandes a los costados (medio hundidas) y debajo, y piedras sueltas en el agua
  for (const r of rocks) {
    const W = r.x2 - r.x1, D = r.z2 - r.z1;
    rk.box((r.x1 + r.x2) / 2, WY - 0.2, (r.z1 + r.z2) / 2, W - 0.2, -WY - 0.1, D - 0.2, rockC[3]);   // relleno debajo del paso
    for (let x = r.x1; x <= r.x2; x += 1.5) for (const z of [r.z1, r.z2]) {
      if (rocks.some(o => o !== r && x >= o.x1 && x <= o.x2 && z >= o.z1 && z <= o.z2) || (z === r.z1 && r.x1 < -84 && x > -91 && x < -85)) continue;
      rk.rock(x + (rr() - 0.5) * 0.8, WY - 0.5, z + (z === r.z1 ? -0.3 : 0.3), 1.2 + rr() * 0.8, 1.5 + rr() * 0.7, 1.2 + rr() * 0.6, rockC[Math.floor(rr() * 4)], Math.floor(rr() * 8), 0, rr() * 3, 0);
    }
    for (let z = r.z1; z <= r.z2; z += 1.5) for (const x of [r.x1, r.x2]) {
      if (rocks.some(o => o !== r && x >= o.x1 && x <= o.x2 && z >= o.z1 && z <= o.z2) || (x === r.x2 && r.x2 === -72)) continue;
      rk.rock(x + (x === r.x1 ? -0.3 : 0.3), WY - 0.5, z + (rr() - 0.5) * 0.8, 1.2 + rr() * 0.8, 1.5 + rr() * 0.7, 1.2 + rr() * 0.6, rockC[Math.floor(rr() * 4)], Math.floor(rr() * 8), 0, rr() * 3, 0);
    }
    for (let k = 0; k < W * D / 10; k++) {                               // superficie: piedras planas y musgo
      const x = r.x1 + 0.5 + rr() * (W - 1), z = r.z1 + 0.5 + rr() * (D - 1);
      rk.rock(x, -0.05, z, 0.6 + rr() * 0.8, 0.12, 0.5 + rr() * 0.6, rockC[k % 4], k % 8, 0, rr() * 3, 0);
      if (k % 3 === 0) sd.blob(x, 0.02, z, 0.5, 0.04, 0.4, 0x4a6a3a, k);
    }
  }
  // F5.19b (Diego): rocas altas al oeste del embarcadero, de z -23 a -10 (al lado del corredor) y detrás de la chiclera
  for (let z = -19.8; z <= -4.5; z += 1.3) {                             // (de z -23 a -21 las pone el lado norte del corredor)
    const x = z > -14 ? -76.6 : -74.6, h = 2.6 + rr() * 2.2;
    rk.rock(x + (rr() - 0.5) * 0.6, WY - 0.3, z, 1.3 + rr() * 0.7, h, 1.2 + rr() * 0.6, rockC[Math.floor(rr() * 4)], Math.floor(rr() * 8), (rr() - 0.5) * 0.2, rr() * 3, 0);
    if (rr() < 0.6) rk.rock(x - 1.2, WY - 0.2, z + 0.5, 1.1, h * 0.7, 1.1, rockC[Math.floor(rr() * 4)], Math.floor(rr() * 8), 0, rr() * 3, 0);
  }
  for (let x = -83; x <= -73; x += 1.4)                                   // el lado norte del corredor, más alto
    if (Math.abs(x - CONFIG.PORTAL.squid.x) > 1.8) rk.rock(x + (rr() - 0.5) * 0.5, WY - 0.3, -20.1, 1.2 + rr() * 0.6, 2.2 + rr() * 1.6, 1.0 + rr() * 0.5, rockC[Math.floor(rr() * 4)], Math.floor(rr() * 8), 0, rr() * 3, 0);
  // la orilla es de roca: piedras planas y sueltas grises
  for (let k = 0; k < 60; k++) {
    const x = -74.5 + rr() * 33, z = -13.6 + rr() * 9.2;
    rk.rock(x, -0.05, z, 0.35 + rr() * 0.8, 0.1 + rr() * 0.25, 0.3 + rr() * 0.7, [0x7a7a78, 0x6a6a68, 0x8a8886][k % 3], k % 8, 0, rr() * 3, 0);
  }
  // F5.19b: franja de barro con piedras en la playa oeste (x -26, de z -3 a -24). F5.19c: 3 veces más ancha
  // (SQUIDBAY.mud, frena al jugador): base de lodo, manchones más oscuros y mojados, charquitos y piedras
  { const M = B.mud, mx = (M.x1 + M.x2) / 2, mw = M.x2 - M.x1;
    sd.box(mx, 0.004, (M.z1 + M.z2) / 2, mw - 0.4, 0.006, M.z2 - M.z1 - 0.3, 0x4a3a28);
    for (let z = M.z1 + 0.6; z < M.z2 - 0.3; z += 0.8) {
      for (let q = 0; q < 3; q++)
        sd.blob(M.x1 + 0.4 + rr() * (mw - 0.8), 0.009 + q * 0.002, z + (rr() - 0.5) * 0.6, 0.9 + rr() * 0.8, 0.03, 0.6 + rr() * 0.5, [0x4a3a28, 0x3e3020, 0x54422e, 0x33281a][Math.floor(rr() * 4)], Math.floor(rr() * 6));
      if (rr() < 0.35) sd.blob(M.x1 + 0.8 + rr() * (mw - 1.6), 0.016, z, 0.5 + rr() * 0.4, 0.01, 0.35, 0x5a5448, 7);   // charquito
      if (rr() < 0.8) rk.rock(M.x1 + rr() * mw, -0.02, z + (rr() - 0.5) * 0.6, 0.2 + rr() * 0.4, 0.1 + rr() * 0.2, 0.2 + rr() * 0.35, [0x6a6a66, 0x5a5854][Math.floor(rr() * 2)], Math.floor(rr() * 8), 0, rr() * 3, 0);
    }
  }
  for (let k = 0; k < 26; k++) {                                          // piedras sueltas en el agua
    const x = -98 + rr() * 50, z = -60 + rr() * 42;
    if (ROOMS.some(r => (r.id === 'R19' || r.id === 'R22') && x > r.x1 - 1.5 && x < r.x2 + 1.5 && z > r.z1 - 1.5 && z < r.z2 + 1.5)) continue;
    rk.rock(x, WY - 0.6, z, 1 + rr() * 1.5, 1 + rr() * 0.9, 1 + rr() * 1.2, rockC[k % 4], k % 8, 0, rr() * 3, 0);
  }
  // botes rotos en el agua
  const hull = [[0, -1], [0.45, -0.8], [0.8, -0.4], [1, 0], [0.8, 0.45], [0.45, 0.82], [0, 1]];
  for (const [x, z, r, kind, col] of B.boats) {
    const c = Math.cos(r), s = Math.sin(r);
    if (kind === 'capsized') {                                            // volcado: el casco boca arriba asomando
      mb.lathe(hull, x, WY + 0.1, z, 0.9, 2.6, 0.7, col, 14, 0, r, Math.PI / 2);
      mb.box(x, WY + 0.72, z, 0.12, 0.1, 5.0, 0x3a2a1a, 0, r, 0);        // quilla
      for (let k = 0; k < 3; k++) mb.box(x + s * (k - 1) * 1.4, WY + 0.5, z + c * (k - 1) * 1.4, 1.2, 0.04, 0.2, 0x2a1e14, 0.2, r + Math.PI / 2, 0);   // agujeros
    } else if (kind === 'split') {                                        // partido en dos, cada mitad inclinada
      for (const sg of [-1, 1]) {
        const hx = x + s * sg * 1.8, hz = z + c * sg * 1.8;
        mb.lathe(hull.map(([a, b]) => [a, b * 0.5]), hx, WY + 0.2, hz, 0.8, 1.4, 0.55, col, 12, sg * 0.5, r, -Math.PI / 2 + sg * 0.3);
        for (let k = 0; k < 4; k++) wd.seg([hx + s * sg * 0.3 * k, WY + 0.2, hz + c * sg * 0.3 * k], [hx + s * sg * 0.3 * k + 0.2, WY + 1.1, hz + c * sg * 0.3 * k], 0.04, 0.03, 0x4a3624, 4);   // costillas
      }
    } else {                                                              // hundido: solo la proa y el mástil
      mb.lathe(hull, x, WY - 0.6, z, 0.8, 2.2, 0.6, col, 12, -0.6, r, -Math.PI / 2);
      wd.seg([x, WY - 0.5, z], [x + 0.6, WY + 3.4, z + 0.3], 0.08, 0.06, 0x6a5a44, 6);
      wd.seg([x + 0.45, WY + 2.6, z + 0.2], [x - 0.6, WY + 2.0, z + 0.1], 0.03, 0.03, 0x6a5a44, 4);
      lf.card(x + 0.2, WY + 1.4, z + 0.15, 1.1, 1.2, 0.1, r, 0.1, 'web', 0xd8d0c0);   // vela rota
    }
  }
  { const [x, z, r] = B.dinghy;                                           // bote volcado sobre las tablas (sólido)
    mb.lathe(hull, x, 0.35, z, 0.75, 1.55, 0.5, 0x5f7f7a, 14, 0, r, -Math.PI / 2);
    mb.box(x, 0.8, z, 0.1, 0.08, 3.0, 0x3a2a1a, 0, r + Math.PI / 2, 0);
    wd.seg([x - 1.8, 0.05, z + 0.9], [x - 0.3, 0.05, z + 1.4], 0.04, 0.04, 0x8a6a44, 5);   // remo
  }
  // animales de mar muertos
  const blood = 0x5a0a0a;
  for (const [x, z, r, kind] of B.carcasses) {
    const c = Math.cos(r), s = Math.sin(r), L = (a, b) => [x + c * a - s * b, z + s * a + c * b];   // a: a lo largo, b: de costado
    if (kind === 'shark') {
      mb.blob(x, 0.02, z, 2.6, 0.02, 1.4, blood, 3, 0, r, 0);
      mb.sphere(x, 0.42, z, 1.55, 0.42, 0.5, 0x6a7a88, 12, 0, -r, 0);
      mb.sphere(x, 0.3, z, 1.4, 0.3, 0.46, 0xe0dcd0, 12, 0, -r, 0);       // panza
      let p = L(1.5, 0); mb.sphere(p[0], 0.3, p[1], 0.4, 0.28, 0.4, 0x5a6a78, 8, 0, -r, 0);
      p = L(1.55, 0.12); mb.box(p[0], 0.2, p[1], 0.5, 0.12, 0.3, 0x3a0a0a, 0, -r, 0.2);   // boca abierta
      for (let k = 0; k < 5; k++) { p = L(1.35 + k * 0.08, 0.2); mb.cyl(p[0], 0.24, p[1], 0.025, 0.08, 0xf4f0e0, 0, 4); }
      p = L(0, 0); mb.box(p[0], 0.95, p[1], 0.55, 0.6, 0.06, 0x5a6a78, 0, -r, -0.4);      // aleta
      p = L(-1.7, 0); mb.box(p[0], 0.45, p[1], 0.4, 0.9, 0.08, 0x5a6a78, 0, -r, 0.5);    // cola
      p = L(-0.4, -0.45); mb.blob(p[0], 0.45, p[1], 0.7, 0.3, 0.3, 0x8a1a1a, 5, 0, r, 0);   // mordida
      for (let k = 0; k < 4; k++) { p = L(-0.7 + k * 0.18, -0.45); wd.seg([p[0], 0.3, p[1]], [p[0], 0.62, p[1] - 0.05], 0.025, 0.02, 0xe8e0d0, 4); }   // costillas
    } else if (kind === 'octopus') {
      mb.blob(x, 0.02, z, 2, 0.02, 2, 0x2a0a2a, 4);
      mb.sphere(x, 0.35, z, 0.55, 0.35, 0.7, 0x9a3a5a, 10, 0, r, 0.3);
      for (const sg of [-1, 1]) { const p = L(0.35, sg * 0.3); mb.sphere(p[0], 0.4, p[1], 0.1, 0.1, 0.1, 0xe8e0c0, 6); }
      for (let k = 0; k < 8; k++) {
        const a = r + k / 8 * 6.28, pts = [];
        for (let i = 0; i <= 5; i++) pts.push([x + Math.cos(a + Math.sin(i) * 0.4) * (0.4 + i * 0.4), 0.1 - i * 0.012, z + Math.sin(a + Math.sin(i) * 0.4) * (0.4 + i * 0.4)]);
        mb.tube(pts, 0.14, 0.03, 0x8a3450, 14, 6);
      }
    } else if (kind === 'ray') {
      mb.sphere(x, 0.08, z, 1.2, 0.08, 0.9, 0x5a5a48, 10, 0, r, 0);
      const t = L(-2.2, 0); mb.seg([x, 0.06, z], [t[0], 0.03, t[1]], 0.05, 0.01, 0x4a4a3a, 5);
      mb.blob(x, 0.015, z, 1.5, 0.02, 1.1, blood, 2, 0, r, 0);
    } else if (kind === 'fish') {                                         // pila de pescados muertos
      for (let k = 0; k < 14; k++) {
        const a = rr() * 6.3, d = rr() * 0.8;
        mb.sphere(x + Math.cos(a) * d, 0.08 + (k % 3) * 0.07, z + Math.sin(a) * d, 0.3, 0.08, 0.1, [0xb8c0c8, 0x9aa8b0, 0xc8b890][k % 3], 7, 0, rr() * 6, 0);
      }
      mb.box(x + 0.9, 0.2, z - 0.4, 0.8, 0.4, 0.55, 0x6a5a3a, 0, r, 0);  // cajón volcado
    } else if (kind === 'skeleton') {                                     // esqueleto de pez gigante sobre el muelle largo
      const a0 = L(-2.6, 0), a1 = L(2.2, 0);
      mb.seg([a0[0], 0.3, a0[1]], [a1[0], 0.35, a1[1]], 0.08, 0.06, 0xe0d8c0, 6);
      for (let k = 0; k < 9; k++) {
        const p = L(-2 + k * 0.45, 0), h = 0.9 - Math.abs(k - 4) * 0.12;
        for (const sg of [-1, 1]) { const q = L(-2 + k * 0.45 + 0.1, sg * h * 0.7); mb.tube([[p[0], 0.33, p[1]], [q[0], 0.45 + h * 0.3, q[1]], [q[0], 0.05, q[1]]], 0.035, 0.02, 0xd8d0b8, 6, 4); }
      }
      const hd = L(2.6, 0); mb.sphere(hd[0], 0.35, hd[1], 0.55, 0.4, 0.4, 0xe0d8c0, 8, 0, -r, 0);
      mb.sphere(hd[0], 0.42, hd[1] + 0.3, 0.12, 0.12, 0.08, 0x1a120c, 6);
    } else if (kind === 'jelly') {                                        // medusa alienígena: campana que brilla
      gl.sphere(x, 0.2, z, 0.8, 0.28, 0.8, 0x7ad8ff, 12);
      gl.sphere(x, 0.28, z, 0.35, 0.14, 0.35, 0xd08aff, 10);
      for (let k = 0; k < 9; k++) { const a = k * 0.7; gl.tube([[x + Math.cos(a) * 0.5, 0.05, z + Math.sin(a) * 0.5], [x + Math.cos(a) * 1.1, 0.03, z + Math.sin(a) * 1.3], [x + Math.cos(a + 0.4) * 1.7, 0.02, z + Math.sin(a + 0.4) * 1.9]], 0.03, 0.012, 0x6ac8ff, 8, 4); }
    } else if (kind === 'eyes') {                                         // pez alienígena de muchos ojos
      mb.sphere(x, 0.35, z, 1.1, 0.35, 0.45, 0x3a4a3a, 10, 0, -r, 0);
      for (let k = 0; k < 9; k++) {
        const p = L(0.8 - (k % 3) * 0.35, (Math.floor(k / 3) - 1) * 0.22);
        mb.sphere(p[0], 0.55, p[1], 0.1, 0.1, 0.1, 0xf0f0d0, 6); gl.sphere(p[0], 0.6, p[1], 0.05, 0.05, 0.05, 0x9aff4a, 5);
      }
      for (let k = 0; k < 6; k++) { const p = L(-0.8 + k * 0.3, 0.42 * (k % 2 ? 1 : -1)); gl.sphere(p[0], 0.3, p[1], 0.07, 0.07, 0.07, 0x6aff9a, 5); }
      mb.blob(x, 0.015, z, 1.4, 0.02, 1, 0x1a4a1a, 6, 0, r, 0);
      gl.blob(x + 0.3, 0.02, z, 0.8, 0.02, 0.6, 0x5aff6a, 7, 0, r, 0);   // baba verde
    } else if (kind === 'crab') {                                         // cangrejo alienígena de 10 patas
      mb.sphere(x, 0.3, z, 0.6, 0.22, 0.45, 0x8a2a4a, 10, 0, -r, 0);
      for (let k = 0; k < 10; k++) {
        const sg = k % 2 ? 1 : -1, i = Math.floor(k / 2), p0 = L(-0.3 + i * 0.15, sg * 0.35), p1 = L(-0.6 + i * 0.3, sg * 1.1);
        mb.tube([[p0[0], 0.3, p0[1]], [(p0[0] + p1[0]) / 2, 0.55, (p0[1] + p1[1]) / 2], [p1[0], 0.02, p1[1]]], 0.04, 0.02, 0x6a1a3a, 6, 4);
      }
      for (const sg of [-1, 1]) { const p = L(0.55, sg * 0.18); gl.seg([p[0], 0.4, p[1]], [p[0], 0.7, p[1]], 0.015, 0.015, 0xd08aff, 3); gl.sphere(p[0], 0.72, p[1], 0.06, 0.06, 0.06, 0xffe04a, 5); }
    }
  }
  // faroles de hierro (pocos: el embarcadero es oscuro), uno roto
  const lampPos = [[-71.6, -14.4], [-44.4, -29.6], [-56.4, -49.6]], halo = new MeshBuilder();
  lampPos.forEach(([x, z], i) => {
    wd.cyl(x, 0, z, 0.06, 2.6, 0x1a1a1a, 1, 6);
    wd.seg([x, 2.5, z], [x + 0.45, 2.7, z], 0.03, 0.03, 0x1a1a1a, 4);
    mb.cyl(x + 0.45, 2.35, z, 0.14, 0.3, 0x2a2a2a, 0.6, 8);
    if (i !== 2) { gl.sphere(x + 0.45, 2.45, z, 0.09, 0.12, 0.09, 0xffc870, 6); halo.add(UNIT_PLANE, x + 0.45, 2.45, z, 2.2, 2.2, 1, 0, 0, 0, 0xffffff); }
  });
  const put = (Bd, mat) => { const m = Bd.mesh(mat); if (m) { m.userData.theme = false; m.updateMatrix(); } return m; };
  put(wd, MAT.bark); put(rk, MAT.rock); put(mb, MAT.grimeV); put(lf, FOLI.mat);
  put(sd, new THREE.MeshLambertMaterial({ map: TEX.sand, vertexColors: true, side: THREE.DoubleSide }));
  put(gl, new THREE.MeshBasicMaterial({ vertexColors: true }));
  put(halo, new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,210,140,1)', 'rgba(255,160,60,.3)'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true, opacity: 0.35 }));
  // cartel
  const tex = makeTex((c, s) => {
    c.fillStyle = '#d8c8a0'; c.fillRect(0, 0, s, s); c.fillStyle = '#2a1a10'; c.textAlign = 'center';
    c.font = 'bold ' + Math.floor(s * 0.19) + 'px monospace'; c.fillText('SQUID BAY', s / 2, s * 0.42);
    c.font = 'bold ' + Math.floor(s * 0.12) + 'px monospace'; c.fillText('DOCK CLOSED', s / 2, s * 0.66);
    c.strokeStyle = 'rgba(90,10,10,.8)'; c.lineWidth = 5; c.beginPath(); c.moveTo(s * 0.1, s * 0.2); c.lineTo(s * 0.9, s * 0.85); c.stroke();
  }, 1, 128);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
  sign.position.set(-60.2, 1.6, -13.2); sign.rotation.set(0, 0, 0.08); sign.userData.theme = false; scene.add(sign);
  const pb = new MeshBuilder(); pb.cyl(-61, 0, -13.25, 0.06, 1.9, 0x5a4634, 1, 6); pb.cyl(-59.4, 0, -13.25, 0.06, 1.9, 0x5a4634, 1, 6); put(pb, MAT.bark);
}
//--- F7c: agua que se mueve (río del templo y fondo de la pileta) con una textura de ondas que se desplaza,
// y la playa: toallas, sombrillas, castillo de arena, heladerita, pelota, radio, troncos, algas, conchas y
// cangrejos que caminan de costado por la orilla (y se escapan si te acercás). Todo sin collider
const BEACH = { crabs: [], waterTex: null, waterMats: [] };
function waterTexture() {
  if (BEACH.waterTex) return BEACH.waterTex;
  const t = makeTex((c, s) => {
    c.fillStyle = '#9ad0dc'; c.fillRect(0, 0, s, s);
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2;
    for (let y = 8; y < s; y += 16) {
      c.beginPath();
      for (let x = 0; x <= s; x += 4) c.lineTo(x, y + Math.sin(x * 0.1 + y) * 3);
      c.stroke();
    }
    c.fillStyle = 'rgba(40,90,110,.25)';
    for (let i = 0; i < 40; i++) c.fillRect(Math.random() * s, Math.random() * s, 6, 2);
  }, 1, 128);
  BEACH.waterTex = t;
  return t;
}
// material de agua con su propia copia de la textura (repeat por tamaño) para que cada una se mueva sola
function waterMat(color, w, h, opacity) {
  const tex = waterTexture().clone(); tex.needsUpdate = true;
  tex.repeat.set(Math.max(1, w / 3), Math.max(1, h / 3));
  const m = new THREE.MeshLambertMaterial({ color, map: tex, transparent: true, opacity, emissive: 0x06181c });
  BEACH.waterMats.push({ m, tex, sp: 0.04 + Math.random() * 0.03 });
  return m;
}
function buildPoolWater() {
  const x1 = 21.7, x2 = 28.3, z1 = 11.6, z2 = 17.3;                    // la parte honda (ver ROOMS R8 hole)
  const w = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), waterMat(0x4a8a6a, x2 - x1, z2 - z1, 0.75));
  w.rotation.x = -Math.PI / 2; w.position.set((x1 + x2) / 2, -1.45, (z1 + z2) / 2);   // 15 cm de agua verde estancada
  w.userData.theme = false; scene.add(w);
}
// F5.28e: una mancha irregular de bloques en el piso (charco de sangre, baba, lodo): celdas de `cell` m adentro de un
// radio que ondula con el ruido; el borde, con el segundo color. En el marco del MeshBuilder (setFrame)
function blotch(mb, x, z, R, c1, c2, r, y, cell) {
  const s = cell || 0.22, n = Math.ceil(R / s), ph = r(0, 6), k1 = r(2, 4), k2 = r(4, 7);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const px = i * s, pz = j * s, d = Math.hypot(px, pz), a = Math.atan2(pz, px);
    const edge = R * (0.72 + 0.18 * Math.sin(a * k1 + ph) + 0.1 * Math.sin(a * k2 - ph * 2));
    if (d > edge) continue;
    mb.box(x + px, (y || 0.012) + (d > edge - s * 1.5 ? 0 : 0.003), z + pz, s + 0.01, 0.02, s + 0.01, d > edge - s * 1.5 ? c2 : c1);
  }
}
// F5.28e: un cadáver de bañista tirado en la arena (marco local: la cabeza hacia +z), mordido: le falta una pierna,
// costillas a la vista, charco de sangre y un rastro que lo arrastra hacia el mar. i cambia la ropa y la pose
// (trail false: sin el rastro al mar, para los de adentro de la casa; ropa: [arriba, abajo] en vez del traje de baño)
function beachCorpse(mb, x, z, rot, i, r, trail, cloth) {
  const SKIN = [0x9a8a78, 0x8a7a6a, 0xa89480][i % 3], HAIR = [0x2a1a10, 0x6a4a20, 0x1a1a1a][i % 3];
  const SUIT = cloth ? cloth[0] : [0x2a4a7a, 0x7a2a2a, 0x3a3a3a][i % 3], PANTS = cloth ? cloth[1] : SUIT;
  const BLOOD = 0x3a0404, DARK = 0x220202, BONE = 0xd8cfb4, FLESH = 0x6a1414;
  mb.setFrame(x, 0, z, rot);
  blotch(mb, 0, 0, 1.25, DARK, BLOOD, r);                                // charco
  for (let k = 0; k < 6; k++) blotch(mb, r(-1.3, 1.3), r(-1.5, 1.5), r(0.12, 0.3), BLOOD, DARK, r, 0.014, 0.1);   // salpicaduras
  mb.box(0, 0.13, 0, 0.5, 0.24, 0.72, SKIN);                             // torso
  mb.box(0, 0.26, 0.12, 0.52, 0.02, cloth ? 0.46 : 0.3, SUIT); mb.box(0, 0.14, -0.28, 0.52, 0.2, 0.2, PANTS);   // ropa
  if (cloth) mb.box(0.13, 0.1, -0.72, 0.19, 0.19, 0.66, PANTS);          // pantalón
  mb.box(0, 0.255, -0.02, 0.32, 0.02, 0.36, FLESH);                      // mordida en el pecho
  for (let k = 0; k < 5; k++) for (const s of [-1, 1]) mb.box(s * 0.1, 0.27, -0.14 + k * 0.07, 0.12, 0.03, 0.03, BONE);   // costillas
  mb.box(0, 0.14, 0.52, 0.24, 0.22, 0.26, SKIN);                         // cabeza
  mb.box(0, 0.2, 0.61, 0.26, 0.12, 0.12, HAIR);
  mb.box(0.06, 0.26, 0.47, 0.05, 0.02, 0.04, 0x1a0a0a); mb.box(-0.06, 0.26, 0.47, 0.05, 0.02, 0.04, 0x1a0a0a);   // ojos
  mb.box(0.13, 0.1, -0.78, 0.17, 0.17, 0.82, SKIN);                      // la pierna que quedó
  mb.box(-0.13, 0.1, -0.46, 0.18, 0.18, 0.2, FLESH);                     // la otra: muñón con hueso
  mb.box(-0.13, 0.1, -0.62, 0.05, 0.05, 0.2, BONE);
  mb.box(0.42, 0.08, 0.12, 0.13, 0.13, 0.62, SKIN, 0, i % 2 ? 0.6 : -0.3, 0);   // brazos abiertos
  mb.box(-0.42, 0.08, 0.2, 0.13, 0.13, 0.55, SKIN, 0, i % 2 ? -0.4 : 0.9, 0);
  mb.setFrame(null);
  if (trail === false) return;
  // el rastro de sangre hasta el agua (lo arrastró algo)
  let px = x, pz = z;
  while (pz > -22.6) { pz -= 0.45; px += r(-0.15, 0.15); mb.box(px, 0.013, pz, r(0.25, 0.45), 0.02, 0.4, pz < -18 ? DARK : BLOOD); }
}
// F5.28e (Diego: "agregá cadáveres adentro de la casa"): tirados en los cuartos (sin collider), uno sentado contra la
// pared y manchas de sangre en las paredes con la marca de una mano arrastrada. CONFIG.DECOR.house
function buildHouseCorpses() {
  const H = CONFIG.DECOR.house, mb = new MeshBuilder(), rr = mulberry(2024), r = (a, b) => a + (b - a) * rr();
  H.bodies.forEach(([x, z, rot, c1, c2], i) => beachCorpse(mb, x, z, rot, i, r, false, [c1, c2]));
  for (const [x, z, rot] of H.sitting) {                                // sentado contra la pared, la cabeza caída
    mb.setFrame(x, 0, z, rot);
    blotch(mb, 0, 0.5, 0.9, 0x220202, 0x3a0404, r);
    mb.box(0, 0.42, 0, 0.46, 0.62, 0.3, 0x4a4a52);                       // torso con camisa
    mb.box(0.05, 0.86, 0.1, 0.24, 0.24, 0.24, 0x8a7a6a, 0.5, 0, 0.3);    // cabeza caída
    for (const s of [-1, 1]) mb.box(s * 0.12, 0.1, 0.42, 0.17, 0.17, 0.7, 0x2a2a3a);   // piernas estiradas
    mb.box(-0.3, 0.25, 0.25, 0.12, 0.12, 0.45, 0x8a7a6a); mb.box(0.3, 0.12, 0.3, 0.12, 0.12, 0.4, 0x8a7a6a);
    mb.box(0, 0.5, 0.16, 0.3, 0.3, 0.02, 0x5a0808);                      // sangre en la camisa
    mb.setFrame(null);
  }
  for (const [x, y, z, ry, w, h] of H.smears) {                         // sangre en la pared: mancha y dedos que bajan
    mb.setFrame(x, 0, z, ry);
    for (let k = 0; k < 14; k++) mb.box(r(-w / 2, w / 2), y + r(-h / 2, h / 2), 0, r(0.08, 0.22), r(0.08, 0.22), 0.02, [0x3a0404, 0x5a0808, 0x2a0202][k % 3]);
    for (let f = 0; f < 4; f++) { const fx = -0.12 + f * 0.08; for (let q = 0; q < 6; q++) mb.box(fx, y - h / 2 - q * 0.1, 0.005, 0.04, 0.1, 0.02, 0x4a0606); }
    mb.setFrame(null);
  }
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (m) { m.userData.theme = false; m.updateMatrix(); }
}
// F5.28e: un tiburón muerto varado de costado (marco local: la cabeza hacia +x, el lomo hacia +z), abierto al medio:
// costillas, carne, tripas en la arena, la boca abierta con dientes y un charco de sangre enorme
function beachShark(mb, S, r) {
  const [x, z, rot] = S, GRAY = 0x5a646a, GRAY2 = 0x4a5258, WHITE = 0xc8c8c0, FLESH = 0x7a1a1a, DARK = 0x220202, BONE = 0xd8cfb4, L = 4.6, N = 24;
  mb.setFrame(x, 0, z, rot);
  for (const dx of [-1.6, 0, 1.6]) blotch(mb, dx, -0.3, 1.5, DARK, 0x3a0404, r, 0.012, 0.25);   // charco largo
  for (let k = 0; k < 8; k++) blotch(mb, r(-2.8, 2.8), r(-2, 1.3), r(0.15, 0.4), 0x3a0404, DARK, r, 0.014, 0.12);
  for (let k = 0; k < N; k++) {
    const u = (k + 0.5) / N, px = -L / 2 + u * L, dx = L / N + 0.02;
    const hgt = 0.18 + 0.78 * Math.sin(Math.PI * Math.min(1, Math.pow(u, 0.75) * 1.02)), w = hgt * 0.62;
    const open = u > 0.3 && u < 0.56;                                    // la mordida: arriba está abierto
    mb.box(px, w * 0.5, hgt * 0.25, dx, open ? w * 0.55 : w, hgt * 0.5, k % 3 ? GRAY : GRAY2);   // lomo
    mb.box(px, w * 0.48, -hgt * 0.25, dx, w * 0.95, hgt * 0.5, WHITE);   // panza
    if (open) {
      mb.box(px, w * 0.58, 0, dx, 0.04, hgt * 0.8, FLESH);               // carne
      if (k % 2 === 0) mb.box(px, w * 0.7, 0, 0.05, 0.1, hgt * 0.85, BONE);   // costillas
    }
    if (u > 0.74 && u < 0.86) mb.box(px, w + 0.005, 0.05, 0.03, 0.02, hgt * 0.55, 0x2a2e30);   // agallas
  }
  for (let k = 0; k < 6; k++) mb.box(0.1 - k * 0.05, 0.12, 0.62 + k * 0.1, 0.55 - k * 0.08, 0.1, 0.12, GRAY2);   // aleta dorsal (en la arena)
  for (let k = 0; k < 6; k++) for (const s of [-1, 1]) mb.box(-L / 2 - 0.12 - k * 0.07, 0.1, s * (0.12 + k * 0.12) * (s > 0 ? 1.3 : 0.8), 0.12, 0.1, 0.14, GRAY2);   // cola
  mb.box(0.9, 0.62, -0.15, 0.5, 0.06, 0.3, GRAY, 0, 0.3, 0.4);            // aleta de arriba
  mb.box(2.05, 0.46, 0.14, 0.07, 0.02, 0.07, 0x050505);                    // ojo
  mb.box(2.1, 0.26, -0.36, 0.42, 0.34, 0.16, 0x4a0808);                   // la boca abierta
  for (let k = 0; k < 6; k++) { mb.box(1.93 + k * 0.07, 0.42, -0.36, 0.03, 0.06, 0.03, 0xe8e0c8); mb.box(1.93 + k * 0.07, 0.11, -0.36, 0.03, 0.06, 0.03, 0xe8e0c8); }
  // tripas que salen de la mordida y se desparraman hacia el mar (-z)
  let gx = -0.2, gz = -0.5;
  for (let k = 0; k < 16; k++) { gx += r(-0.18, 0.2); gz -= r(0.08, 0.16); mb.box(gx, 0.07, gz, 0.16, 0.12, 0.16, k % 2 ? 0x9a3a4a : 0x7a2a3a); }
  mb.setFrame(null);
}
// F5.28e: el ojo de un calamar gigante, medio enterrado en la arena y entreabierto: blanco lechoso con venas, el párpado
// de arriba (piel morada) tapando la mitad, iris dorado con la pupila en W, baba alrededor y dos pedazos de tentáculo
function beachSquidEye(mb, em, E, r) {
  const [x, z, rot, R] = E, cy = R * 0.55, SKIN = [0x4a3448, 0x5a3e54, 0x3e2a3c], SCL = 0xd8cfb8, VEIN = 0x8a1a1a;
  mb.setFrame(x, 0, z, rot);                                             // +z local: hacia donde mira
  blotch(mb, 0, 0.4, R * 1.8, 0x3a4228, 0x4a5a30, r, 0.011, 0.25);      // baba
  mb.sphere(0, cy, 0, R, R * 0.85, R, SCL, 12);                          // el ojo (la mitad de abajo, enterrada)
  for (let k = 0; k < 46; k++) {                                         // venas sobre el blanco
    const th = r(0.2, 1.4), ph = r(-2.6, 2.6), d = R * 1.0;
    mb.box(Math.sin(th) * Math.sin(ph) * d, cy + Math.cos(th) * d * 0.85, Math.sin(th) * Math.cos(ph) * d, r(0.08, 0.2), 0.03, 0.03, VEIN, 0, r(0, 3), r(0, 3));
  }
  // iris dorado y pupila en W, en `em` (con un poco de luz propia: la cara del ojo casi siempre queda en sombra)
  em.setFrame(x, 0, z, rot);
  em.sphere(0, cy, R * 0.9, R * 0.58, R * 0.52, R * 0.12, 0xc8942a, 12);
  em.sphere(0, cy, R * 0.97, R * 0.42, R * 0.38, R * 0.08, 0x9a6a1e, 10);
  em.box(0, cy, R * 1.03, R * 0.62, R * 0.12, 0.05, 0x050505);
  for (const s of [-1, 0, 1]) em.box(s * R * 0.2, cy - R * 0.1, R * 1.03, 0.1, R * 0.14, 0.05, 0x050505);
  em.setFrame(null);
  // el párpado de arriba: casquete de piel que tapa lo que está arriba de cy + R*0.42 (queda medio abierto: se ve el iris)
  const cut = cy + R * 0.42;
  for (let a = 0; a < 12; a++) for (let b = 0; b < 26; b++) {
    const th = (a + 0.5) / 12 * Math.PI * 0.62, ph = b / 26 * Math.PI * 2, d = R * 1.07;
    const px = Math.sin(th) * Math.sin(ph) * d, py = cy + Math.cos(th) * d * 0.88, pz = Math.sin(th) * Math.cos(ph) * d;
    if (py < cut) continue;
    mb.box(px, py, pz, 0.26, 0.2, 0.26, SKIN[(a + b) % 3]);
  }
  for (let b = 0; b < 18; b++) {                                         // el borde húmedo del párpado
    const ph = (b / 17 - 0.5) * 2.2, d = R * 1.03;
    mb.box(Math.sin(ph) * d * 0.95, cut, Math.cos(ph) * d * 0.95, 0.2, 0.08, 0.14, 0x8a3a4a);
  }
  mb.setFrame(null);
  // pedazos de tentáculo tirados cerca, con ventosas
  for (let t = 0; t < 2; t++) {
    let px = x + (t ? -2.2 : 2.0), pz = z + (t ? 0.8 : -0.6), a = r(0, 6);
    for (let k = 0; k < 11; k++) {
      a += r(-0.4, 0.4); px += Math.cos(a) * 0.2; pz += Math.sin(a) * 0.2;
      const s = 0.3 - k * 0.02;
      mb.box(px, s / 2, pz, s, s, s, SKIN[k % 3]);
      if (k % 2 === 0) mb.box(px, s + 0.01, pz, s * 0.45, 0.03, s * 0.45, 0xc89aa8);
    }
  }
}
function buildBeachDecor() {
  const B = CONFIG.DECOR.beach, mb = new MeshBuilder();
  let s = 777; const r = (a, b) => { s = (s * 16807) % 2147483647; return a + (b - a) * s / 2147483647; };
  // F5.28e (Diego): sin toallas, sombrillas, castillo, heladerita, pelota ni radio. En su lugar, lo que dejó el mar:
  // cadáveres mordidos con un rastro de sangre hacia el agua, un tiburón muerto abierto y el ojo de un calamar gigante
  B.bodies.forEach(([x, z, rot], i) => beachCorpse(mb, x, z, rot, i, r));
  beachShark(mb, B.shark, r);
  const em = new MeshBuilder();
  beachSquidEye(mb, em, B.eye, r);
  const emm = em.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x3a2808 }));
  if (emm) { emm.userData.theme = false; emm.updateMatrix(); }
  for (const [x, z, rot] of B.logs) {                                  // troncos que trajo el mar: curvos, con ramas y raíces
    const c = Math.cos(rot), sn = Math.sin(rot), P = t => [x + c * t, 0.15 + Math.sin(t * 1.3) * 0.03, z - sn * t + Math.sin(t * 0.9) * 0.12];
    mb.tube([P(-1.2), P(-0.4), P(0.4), P(1.2)], 0.17, 0.12, 0x8a7a64, 10, 7);
    const q = P(0.5); mb.seg(q, [q[0] + Math.cos(rot + 0.8) * 0.6, 0.32, q[2] - Math.sin(rot + 0.8) * 0.6], 0.05, 0.02, 0x7a6a54, 5);
    const e = P(-1.2); for (let k = 0; k < 4; k++) mb.seg(e, [e[0] - c * 0.35 + Math.cos(k * 1.6) * 0.25, 0.05 + k * 0.08, e[2] + sn * 0.35 + Math.sin(k * 1.6) * 0.25], 0.05, 0.015, 0x7a6a54, 4);
  }
  const [zs1, zs2] = B.shoreZ;
  for (let i = 0; i < B.seaweed; i++) {                                // algas en la orilla: tiras curvas
    const x = r(-19, 19), z = r(zs1, zs2);
    for (let k = 0; k < 4; k++) { const a = r(0, 3), l = r(0.3, 0.7), x0 = x + r(-0.4, 0.4), z0 = z + r(-0.3, 0.3);
      mb.tube([[x0, 0.02, z0], [x0 + Math.cos(a) * l * 0.5 + 0.06, 0.03, z0 + Math.sin(a) * l * 0.5], [x0 + Math.cos(a) * l, 0.02, z0 + Math.sin(a) * l + 0.05]], 0.03, 0.015, k % 2 ? 0x2a4a2a : 0x3a5a2a, 4, 4); }
  }
  for (let i = 0; i < B.shells; i++) {                                 // conchas y estrellas de mar
    const x = r(-19, 19), z = r(zs1 - 0.2, -8);
    if (i % 4 === 0) for (let k = 0; k < 5; k++) mb.seg([x, 0.02, z], [x + Math.sin(k * 1.26) * 0.16, 0.015, z + Math.cos(k * 1.26) * 0.16], 0.035, 0.012, 0xe8784a, 4);
    else mb.lathe([[0.06, 0], [0.05, 0.02], [0.02, 0.035], [0, 0.04]], x, 0.005, z, 1, 1, 0.8, [0xf0e8d8, 0xe8c8b0, 0xd8b8d8][i % 3], 7, 0, r(0, 3), 0);
  }
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (m) { m.userData.theme = false; m.updateMatrix(); }
  // cangrejos: un pool fijo; caminan de costado por la orilla
  for (let i = 0; i < B.crabs; i++) {
    const g = new THREE.Group(), cb = new MeshBuilder();
    cb.sphere(0, 0.08, 0, 0.14, 0.05, 0.1, 0xd8482a, 10);                                    // F5.17c: caparazón curvo
    for (const sx of [-1, 1]) {
      for (let k = -1; k <= 1; k++) cb.tube([[sx * 0.1, 0.08, k * 0.05], [sx * 0.2, 0.1, k * 0.07], [sx * 0.26, 0.0, k * 0.08]], 0.012, 0.008, 0xb8382a, 4, 4);   // patas
      cb.seg([sx * 0.08, 0.08, 0.08], [sx * 0.12, 0.1, 0.15], 0.015, 0.015, 0xb8382a, 4);
      cb.sphere(sx * 0.12, 0.1, 0.17, 0.04, 0.03, 0.05, 0xe8583a, 8);                           // pinzas
      cb.seg([sx * 0.04, 0.1, 0.08], [sx * 0.05, 0.16, 0.09], 0.008, 0.008, 0xb8382a, 4); cb.sphere(sx * 0.05, 0.165, 0.09, 0.015, 0.015, 0.015, 0x1a1a1a, 6);   // ojos
    }
    const cm = cb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    scene.remove(cm); cm.matrixAutoUpdate = true; cm.userData.theme = false; g.add(cm);
    scene.add(g);
    BEACH.crabs.push({ g, x: r(B.crabArea[0], B.crabArea[1]), z: r(B.crabArea[2], B.crabArea[3]), dir: Math.random() < 0.5 ? -1 : 1, t: r(1, 4) });
  }
}
function updateBeach(dt, t) {
  for (const W of BEACH.waterMats) { W.tex.offset.x = (t * W.sp) % 1; W.tex.offset.y = (t * W.sp * 0.6) % 1; }
  const B = CONFIG.DECOR.beach, A = B.crabArea, P = player.pos;
  for (const c of BEACH.crabs) {
    const d = Math.hypot(P.x - c.x, P.z - c.z), flee = d < B.crabFlee;
    if ((c.t -= dt) <= 0) { c.t = 1 + Math.random() * 3; c.dir = Math.random() < 0.5 ? -1 : 1; c.stop = Math.random() < 0.3; }
    if (flee) { c.dir = P.x > c.x ? -1 : 1; c.stop = false; }
    const v = c.stop ? 0 : B.crabSpeed * (flee ? 3 : 1);
    c.x += c.dir * v * dt;
    if (c.x < A[0] || c.x > A[1]) { c.dir = -c.dir; c.x = Math.max(A[0], Math.min(A[1], c.x)); }
    c.g.position.set(c.x, groundY(c.x, c.z) + Math.abs(Math.sin(t * 20 + c.z)) * 0.02 * (v > 0 ? 1 : 0), c.z);
    c.g.rotation.y = Math.sin(t * 0.7 + c.z) * 0.2;
  }
}

//--- F5.19b: las 3 plantas moradas del templo. Estatuas majestuosas (pedestal escalonado, tallo de cristal, hojas en
// abanico) con la cabeza viva: gira hacia vos y escupe un chorro "espacial" (bolitas moradas con estrellas, en un solo
// THREE.Points creado una vez). La cabeza y las mandíbulas son grupos; lo que brilla, MeshBasic. Ninguna luz nueva
const VOID = { plants: [], orbs: [], pts: null };
function buildVoidPlants() {
  const C = CONFIG.TEMPLE.voidPlants, rr = mulberry(4242);
  const st = new MeshBuilder(), gl = new MeshBuilder();
  const pur = [0x5a2a8a, 0x6a3a9a, 0x4a1a74], gold = 0xd8a830;
  for (const [x, z] of C.spots) {
    for (let k = 0; k < 3; k++) st.box(x, 0.15 + k * 0.3, z, 1.6 - k * 0.3, 0.3, 1.6 - k * 0.3, pur[k % 3]);   // pedestal
    for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2; st.box(x + Math.cos(a) * 0.81, 0.15, z + Math.sin(a) * 0.81, 0.3, 0.1, 0.02, gold, 0, -a + Math.PI / 2, 0); }
    // F5.19c (Diego): en CUBOS, como las plantas de los jardines, pero moradas y alienígenas
    for (let k = 0; k < 5; k++) st.box(x + (k % 2 ? 0.05 : -0.05), 0.95 + k * 0.42, z, 0.42 - k * 0.03, 0.4, 0.42 - k * 0.03, k % 2 ? 0x5a2a8a : 0x4a1a74, 0, k * 0.25, 0);   // tallo de bloques
    for (let k = 0; k < 5; k++) gl.box(x, 1.0 + k * 0.42, z + 0.23 - k * 0.015, 0.1, 0.05, 0.02, 0xd07aff);   // venas que brillan
    for (let q = 0; q < 6; q++) {                                        // hojas en losas, con el borde que brilla
      const a = q * Math.PI / 3 + 0.3, L = 1.2 + rr() * 0.4;
      st.box(x + Math.cos(a) * L * 0.45, 1.0 + (q % 2) * 0.35, z + Math.sin(a) * L * 0.45, L, 0.08, 0.4, pur[q % 3], 0, -a, 0.3);
      gl.box(x + Math.cos(a) * L * 0.9, 1.22 + (q % 2) * 0.35, z + Math.sin(a) * L * 0.9, 0.12, 0.1, 0.44, 0xd07aff, 0, -a, 0.3);
      for (let t = 0; t < 3; t++) st.box(x + Math.cos(a) * L * (0.3 + t * 0.2), 1.06 + (q % 2) * 0.35 + t * 0.04, z + Math.sin(a) * L * (0.3 + t * 0.2), 0.05, 0.12, 0.05, 0x8aff5a, 0, -a, 0);   // espinas verdes
    }
    for (let q = 0; q < 10; q++) gl.box(x + (rr() - 0.5) * 0.46, 1.0 + rr() * 2, z + (rr() - 0.5) * 0.46, 0.05, 0.05, 0.05, rr() < 0.5 ? 0xffffff : 0xb87aff);   // estrellas del tallo
    // la cabeza (grupo que gira): mandíbulas en cubos con dientes verdes, manchas que brillan y 2 antenas con ojo
    const head = new THREE.Group(); head.position.set(x, C.h - 0.2, z); scene.add(head);
    const jaw = s => {
      const j = new THREE.Group(), b = new MeshBuilder(), g2 = new MeshBuilder();
      b.box(0, s * 0.14, 0.38, 1.0, 0.26, 0.9, s > 0 ? 0x6a3a9a : 0x5a2a8a);
      b.box(0, s * 0.3, 0.3, 0.8, 0.1, 0.7, s > 0 ? 0x7a4aaa : 0x4a1a74);
      for (let q = 0; q < 6; q++) {                                     // dientes verdes alrededor
        b.box(-0.4 + q * 0.16, 0, 0.82, 0.07, 0.14, 0.07, 0x8aff5a);
        if (q < 4) for (const sx of [-1, 1]) b.box(sx * 0.47, 0, 0.2 + q * 0.16, 0.07, 0.14, 0.07, 0x8aff5a);
      }
      for (let q = 0; q < 6; q++) g2.box((rr() - 0.5) * 0.7, s * 0.28, 0.1 + rr() * 0.6, 0.09, 0.03, 0.09, [0xff6aff, 0x8af0ff, 0xffffff][q % 3]);   // manchas
      // (F5.20, Diego: sin las antenas con ojos)
      const m1 = b.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })), m2 = g2.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
      for (const m of [m1, m2]) { scene.remove(m); m.matrixAutoUpdate = true; m.userData.theme = false; j.add(m); }
      head.add(j); return j;
    };
    const top = jaw(1), bot = jaw(-1);
    const throat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.6), new THREE.MeshBasicMaterial({ color: 0xc040ff }));
    throat.position.set(0, 0, 0.35); head.add(throat);
    VOID.plants.push({ x, z, head, top, bot, throat, t: 1 + rr() * 3, burst: 0, emit: 0, open: 0 });
  }
  for (const [B, mat] of [[st, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x1a0828 })], [gl, new THREE.MeshBasicMaterial({ vertexColors: true })]]) {
    const m = B.mesh(mat); if (m) { m.userData.theme = false; m.updateMatrix(); }
  }
  // el chorro: bolitas en un Points aditivo (posiciones fuera de vista cuando no vuelan)
  const n = C.pool, pos = new Float32Array(n * 3).fill(-999);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  VOID.pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.55, map: radialTex('rgba(255,210,255,1)', 'rgba(150,40,255,.5)'),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xe070ff }));
  VOID.pts.frustumCulled = false; scene.add(VOID.pts);
  for (let i = 0; i < n; i++) VOID.orbs.push({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3() });
}
function updateVoidPlants(dt) {
  if (!VOID.pts) return;
  const C = CONFIG.TEMPLE.voidPlants, P = player.pos, t = clock.elapsedTime, feet = P.y - CONFIG.PLAYER.height;
  for (const V of VOID.plants) {
    const d = Math.hypot(P.x - V.x, P.z - V.z), near = d < C.range + 6;
    if (near) V.head.rotation.y = lerpAngle(V.head.rotation.y, Math.atan2(P.x - V.x, P.z - V.z), Math.min(1, dt * 3));
    V.head.position.y = C.h - 0.2 + Math.sin(t * 1.3 + V.x) * 0.06;
    if (V.burst > 0) {
      V.burst -= dt; V.emit += dt * C.rate;
      while (V.emit >= 1) { V.emit -= 1; voidOrb(V, C); }
    } else if ((V.t -= dt) <= 0) {
      const hy = V.head.position.y;
      const ux = (P.x - V.x) / (d || 1), uz = (P.z - V.z) / (d || 1), o = C.box + 0.25;   // desde afuera de su propia caja
      if (d < C.range && d > o && segmentClear(V.x + ux * o, V.z + uz * o, P.x, P.z, 0, true, Math.min(hy, feet + 0.5))) { V.burst = C.burst; sfxPlantWarn(d); }
      V.t = randIn(C.every);
    }
    V.open += ((V.burst > 0 ? 1 : 0.15 + 0.1 * Math.sin(t * 2 + V.z)) - V.open) * Math.min(1, dt * 8);
    V.top.rotation.x = -0.6 * V.open; V.bot.rotation.x = 0.35 * V.open;
    V.throat.material.color.setHSL(0.8, 1, 0.45 + 0.2 * V.open + 0.08 * Math.sin(t * 6));
  }
  const arr = VOID.pts.geometry.attributes.position.array;
  VOID.orbs.forEach((O, i) => {
    if (O.on) {
      O.v.y -= C.gravity * dt; O.p.addScaledVector(O.v, dt);
      if (projHitsPlayer(O.p, 0.25)) { damagePlayer(C.damage, O.p.x, O.p.z, false, 'void plant'); O.on = false; }
      else if (O.p.y <= groundY(O.p.x, O.p.z) || projBlocked(O.p.x, O.p.y, O.p.z) || O.p.y < -5) O.on = false;
      // F5.19c (Diego): salpicadura morada donde pega (una de cada 3 bolitas, para no llenar el pool de partículas)
      if (!O.on && O.p.y > -5 && (VOID.splashN = (VOID.splashN || 0) + 1) % 3 === 0) spawnSplashFx(O.p.x, Math.max(O.p.y, groundY(O.p.x, O.p.z) + 0.1), O.p.z, 0xb04aff, 0.9);
    }
    if (O.on) { arr[i * 3] = O.p.x; arr[i * 3 + 1] = O.p.y; arr[i * 3 + 2] = O.p.z; } else arr[i * 3 + 1] = -999;
  });
  VOID.pts.geometry.attributes.position.needsUpdate = true;
}
function voidOrb(V, C) {
  const O = VOID.orbs.find(o => !o.on); if (!O) return;
  const P = player.pos, a = V.head.rotation.y, y0 = V.head.position.y;
  const o = C.box + 0.25;
  O.p.set(V.x + Math.sin(a) * o, y0, V.z + Math.cos(a) * o);
  const ty = P.y - CONFIG.PLAYER.height + 0.9, d = Math.hypot(P.x - O.p.x, P.z - O.p.z), T = Math.max(0.2, d / C.speed);
  const s = C.spread;
  O.v.set((P.x - O.p.x) / T + (Math.random() - 0.5) * s * C.speed, (ty - y0) / T + 0.5 * C.gravity * T + (Math.random() - 0.5) * s * C.speed,
          (P.z - O.p.z) / T + (Math.random() - 0.5) * s * C.speed);
  O.on = true;
}
function resetVoidPlants() {
  for (const O of VOID.orbs) O.on = false;
  for (const V of VOID.plants) { V.burst = 0; V.t = 2; }
  if (VOID.pts) { VOID.pts.geometry.attributes.position.array.fill(-999); VOID.pts.geometry.attributes.position.needsUpdate = true; }
}

//--- F5.19c: catarata de sangre verde en el claro (CONFIG.GOOFALL). Peñasco de rocas apiladas con musgo y lianas, la
// caída en la cara sur (dos láminas con una textura de chorros que baja, MeshBasic aditiva), espuma y salpicadura al pie
// (un Points), una poza que brilla con ondas y niebla verde. El peñasco es el prop sólido 'catarata'. Ninguna luz nueva
const GOOFALL = { sheets: [], pool: null, splash: null, mist: [], t: 0 };
function buildGooFall() {
  const C = CONFIG.GOOFALL, rr = mulberry(6363), rk = new MeshBuilder(), lf = new MeshBuilder(), gl = new MeshBuilder();
  const [x1, x2, z1, z2] = C.rock, H = C.h, gray = [0x5a5850, 0x4a4842, 0x6a665a, 0x3e3c36];
  // F5.20: todo se arma en un marco local (x a lo largo de la cara, z hacia afuera, la cara en z = 0) y se gira según
  // `face` (+1: cae hacia +x desde la cara este del peñasco; si no, hacia -z desde la cara sur, como antes)
  const eastFace = C.face === 1;
  const fx = eastFace ? x2 : (x1 + x2) / 2, fzw = eastFace ? (z1 + z2) / 2 : z1, rot = eastFace ? Math.PI / 2 : Math.PI;
  const L = eastFace ? z2 - z1 : x2 - x1, Dp = eastFace ? x2 - x1 : z2 - z1;   // largo de la cara y fondo del peñasco
  for (const B2 of [rk, lf, gl]) B2.setFrame(fx, 0, fzw, rot);
  // el peñasco: rocas grandes apiladas en 3 hileras que se achican, con la canaleta de la caída en el medio del frente
  for (let row = 0; row < 3; row++) {
    const y = row * H / 3, sh = 1 - row * 0.18;
    for (let k = 0; k < 6; k++) {
      const x = -L / 2 + 0.5 + (k / 5) * (L - 1), z = -Dp + 0.6 + rr() * (Dp - 1.2) * sh;
      const s = (1.2 + rr() * 0.6) * sh;
      rk.rock(x, y - 0.2, z, s, H / 3 + 0.6, s * 0.9, gray[(k + row) % 4], (k + row * 3) % 8, 0, rr() * 3, 0);
    }
  }
  rk.rock(0, H - 0.4, -Dp / 2, 2.4, 1.0, 2.0, gray[2], 5, 0, 0.4, 0);        // la cima
  for (const s of [-1, 1]) rk.rock(s * (C.w / 2 + 0.5), H * 0.45, -0.1, 0.8, H * 0.6, 0.7, gray[1], 3 + s, 0, s * 0.3, 0);   // labios de la canaleta
  for (let k = 0; k < 10; k++) {                                           // musgo y lianas
    const x = -L / 2 + rr() * L, y = 0.5 + rr() * (H - 0.8);
    if (Math.abs(x) < C.w / 2 + 0.3) continue;
    lf.card(x, y - 1, 0.05, 0.6, 1.4 + rr(), 0, rr() * 0.5, 0, rr() < 0.5 ? 'vine' : 'moss', 0xffffff);
  }
  for (let k = 0; k < 8; k++) lf.clump(-L / 2 + rr() * L, H - 0.1 + rr() * 0.2, -rr() * Dp, 0.8, 0.5, 'fern', 0xffffff, rr() * 3);
  // piedras alrededor de la poza
  for (let k = 0; k < 14; k++) {
    const a = (k / 13) * Math.PI, r = C.pool + 0.25 + rr() * 0.3;
    rk.rock(Math.cos(a) * r, -0.05, 0.2 + Math.sin(a) * r * 0.9, 0.35 + rr() * 0.3, 0.25 + rr() * 0.2, 0.35 + rr() * 0.25, gray[k % 4], k % 8, 0, rr() * 3, 0);
  }
  gl.blob(0, 0.02, C.pool * 0.55, C.pool, 0.04, C.pool * 0.85, 0x7dff4a, 11);   // la poza
  for (const B2 of [rk, lf, gl]) B2.setFrame(null);
  for (const [B2, mat] of [[rk, MAT.rock], [lf, FOLI.mat], [gl, new THREE.MeshBasicMaterial({ vertexColors: true })]]) {
    const m = B2.mesh(mat); if (m) { m.userData.theme = false; m.updateMatrix(); }
  }
  // lo que se anima va en un grupo con el mismo marco
  const grp = new THREE.Group(); grp.position.set(fx, 0, fzw); grp.rotation.y = rot; grp.userData.theme = false; scene.add(grp);
  const ox = Math.sin(rot), oz = Math.cos(rot), ax = Math.cos(rot), az = -Math.sin(rot);   // afuera y a lo largo, en el mundo
  GOOFALL.out = [ox, oz]; GOOFALL.along = [ax, az];
  // la caída: 2 láminas con chorros que bajan (la de adelante más angosta y más rápida)
  const tex = makeTex((c, s) => {
    c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, s, s);
    for (let i = 0; i < 46; i++) {
      const x = Math.random() * s, w = 2 + Math.random() * 6, a = 0.25 + Math.random() * 0.6;
      const g = c.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, 'rgba(160,255,120,' + a + ')'); g.addColorStop(0.5, 'rgba(90,230,60,' + a * 0.6 + ')'); g.addColorStop(1, 'rgba(160,255,120,' + a + ')');
      c.fillStyle = g; c.fillRect(x, 0, w, s);
    }
  }, 1, 128);
  [[C.w, 0.9, 0.06], [C.w * 0.7, 1.6, 0.14]].forEach(([w, speed, off], i) => {
    const mat = new THREE.MeshBasicMaterial({ map: i ? tex.clone() : tex, transparent: true, opacity: i ? 0.55 : 0.85, color: 0x9aff6a,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    if (i) mat.map.needsUpdate = true;
    mat.map.repeat.set(1.2, 2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H - 0.2), mat);
    m.position.set(0, H / 2, off); m.userData.theme = false; grp.add(m);
    GOOFALL.sheets.push({ m, speed });
  });
  // espuma y salpicadura al pie (un Points; las gotas saltan y caen)
  const n = 60, pos = new Float32Array(n * 3), vel = [];
  for (let i = 0; i < n; i++) { vel.push([0, 0, 0, Math.random()]); pos[i * 3 + 1] = -99; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  GOOFALL.splash = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.28, map: radialTex('rgba(200,255,170,1)', 'rgba(90,220,60,.4)'),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xb8ff8a }));
  GOOFALL.splash.frustumCulled = false; GOOFALL.splash.userData.theme = false; scene.add(GOOFALL.splash);
  GOOFALL.vel = vel; GOOFALL.base = [fx + ox * 0.3, fzw + oz * 0.3];
  // niebla verde que late sobre la poza
  const mistMat = new THREE.MeshBasicMaterial({ map: radialTex('rgba(150,255,110,.55)', 'rgba(60,200,40,.15)'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffffff });
  for (let k = 0; k < 3; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(C.pool * 3, 1.6), mistMat);
    m.position.set(0, 0.6 + k * 0.35, C.pool * 0.5); m.rotation.y = k * 1.05; m.userData.theme = false; grp.add(m);
    GOOFALL.mist.push(m);
  }
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(C.pool * 3.2, C.pool * 3.2), new THREE.MeshBasicMaterial({
    map: radialTex('rgba(150,255,110,.9)', 'rgba(60,200,40,.35)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.06, C.pool * 0.55); ring.userData.theme = false; grp.add(ring);
  GOOFALL.pool = ring;
}
function updateGooFall(dt) {
  if (!GOOFALL.splash) return;
  const P = player.pos, [bx, bz] = GOOFALL.base;
  if (Math.hypot(P.x - bx, P.z - bz) > 45) return;                    // lejos no se ve (niebla): no se anima
  const t = (GOOFALL.t += dt);
  for (const S of GOOFALL.sheets) S.m.material.map.offset.y = t * S.speed;
  GOOFALL.pool.material.opacity = 0.55 + 0.2 * Math.sin(t * 2.3);
  GOOFALL.pool.scale.setScalar(1 + 0.04 * Math.sin(t * 3.1));
  GOOFALL.mist.forEach((m, k) => { m.material.opacity = 0.35 + 0.15 * Math.sin(t * 1.3 + k); m.rotation.y += dt * 0.1; });
  const a = GOOFALL.splash.geometry.attributes.position.array, w = CONFIG.GOOFALL.w, [ox, oz] = GOOFALL.out, [ax, az] = GOOFALL.along;
  GOOFALL.vel.forEach((v, i) => {
    if (a[i * 3 + 1] < 0) {                                            // nace al pie de la caída
      const s = (Math.random() - 0.5) * w, u = (Math.random() - 0.5) * 0.4, sa = (Math.random() - 0.5) * 1.6, so = Math.random() * 1.6;
      a[i * 3] = bx + ax * s + ox * u; a[i * 3 + 1] = 0.1; a[i * 3 + 2] = bz + az * s + oz * u;
      v[0] = ax * sa + ox * so; v[1] = 1.5 + Math.random() * 2.2; v[2] = az * sa + oz * so;
    }
    v[1] -= 9.8 * dt;
    a[i * 3] += v[0] * dt; a[i * 3 + 1] += v[1] * dt; a[i * 3 + 2] += v[2] * dt;
  });
  GOOFALL.splash.geometry.attributes.position.needsUpdate = true;
}

//--- F5.20 (Diego): barco volcado en la bahía (SQUIDBAY.wreck): casco boca arriba y partido, hélice y timón al aire,
// tablas y redes en el agua, cadáveres flotando boca abajo (se mecen), manchas de aceite y una columna de humo (Points)
// F5.21 (Diego: "cúbico y metele mucho diseño"): todo en cubos. Pesquero de ~14 m boca arriba y escorado: casco con
// pintura antiincrustante roja, franja de flotación, óxido que chorrea y percebes; quilla, hélice de 4 palas, timón y
// eje; un boquete con tablas y hierros doblados y fuego adentro; la cabina medio hundida de costado con ventanas rotas,
// salvavidas y el nombre en la popa; mástil y botavara flotando con cabos; red de pesca con boyas naranjas; cajones,
// barriles y pescados muertos; manchas de aceite; cadáveres boca abajo (algunos con chaleco) y humo
const WRECK = { smoke: null, sv: [], bodies: [], fire: null, x: 0, z: 0 };
function rnd3(x, y, z) { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); }
function buildWreck() {
  const W = CONFIG.SQUIDBAY.wreck, WY = CONFIG.SQUIDBAY.waterY, rr = mulberry(5566);
  const mb = new MeshBuilder(), wd = new MeshBuilder(), dk = new MeshBuilder(), gl = new MeshBuilder(), L = W.len, v = 0.4;
  for (const B2 of [mb, wd, dk, gl]) B2.setFrame(W.x, WY, W.z, W.rot);
  // ---- el casco boca arriba: cáscara de cubos. Media manga w(z) (la proa se afina), alto de la obra viva h(x) ----
  const half = z => { const k = z / (L / 2); return 1.9 * (k > 0.25 ? Math.max(0.15, 1 - ((k - 0.25) / 0.75) ** 1.6) : k < -0.8 ? 0.85 : 1); };
  const top = (x, w) => 0.2 + 2.1 * Math.max(0, 1 - Math.abs(x / w) ** 1.4);   // de la línea de agua a la quilla
  const holeZ = L * 0.12, holeX = 1.0;
  for (let z = -L / 2 + v / 2; z < L / 2; z += v) {
    const w = half(z);
    for (let x = -w + v / 2; x < w; x += v) {
      const h = top(x, w), roll = x * 0.12;                              // escorado: un costado más hundido
      for (let y = 0.1; y < h + roll; y += v) {
        const edge = y + v >= h + roll || Math.abs(x) + v >= w || Math.abs(z) + v >= L / 2 - 0.05;
        if (!edge) continue;
        if (Math.abs(x - holeX) < 0.7 && Math.abs(z - holeZ) < 1.0 && y > 0.6) continue;   // el boquete
        const f = rnd3(x, y, z);
        let c = y < 0.55 ? (f < 0.5 ? 0xe8e4d8 : 0x2a4a7a) : 0x8a2a1e;    // franja de flotación blanca y azul / rojo
        if (y >= 0.55 && f < 0.14) c = 0x5a2a14;                         // óxido
        if (y >= 0.55 && f > 0.9) c = 0xc8c0b0;                          // percebes
        if (y >= 0.55 && f > 0.86 && f <= 0.9) c = 0x3a5a2a;             // algas
        mb.box(x, y, z, v, v, v, c);
      }
      if (Math.abs(x) < v && rnd3(x, 9, z) < 0.3) mb.box(x, top(0, w) + v * 0.6, z, 0.2, 0.2, 0.2, 0xc8c0b0);   // percebes en la quilla
    }
    mb.box(0, top(0, w) + v * 0.3, z, 0.26, 0.3, v, 0x2a1e14);            // quilla
    if (rnd3(1, z, 2) < 0.35) for (let k = 0; k < 4; k++) mb.box(w * (rnd3(k, z, 3) < 0.5 ? -0.9 : 0.9), 0.6 + k * 0.3, z, 0.12, 0.3, 0.12, 0x6a3a1a);   // chorreadas de óxido
  }
  // el boquete: adentro oscuro, costillas partidas, tablas y hierros doblados hacia afuera, fuego
  dk.box(holeX, 0.9, holeZ, 1.3, 1.2, 1.9, 0x0a0806);
  for (let k = 0; k < 5; k++) wd.box(holeX + (rr() - 0.5) * 1.2, 1.2 + rr() * 0.6, holeZ + (k - 2) * 0.4, 0.12, 0.8 + rr() * 0.6, 0.16, 0x5a4230, rr() * 0.8, 0, 0.4 + rr() * 0.6);
  for (let k = 0; k < 4; k++) mb.box(holeX + 0.5 + rr() * 0.4, 1.4 + rr() * 0.5, holeZ + (rr() - 0.5) * 1.6, 0.06, 0.06, 0.9, 0x4a4a48, rr(), rr(), rr());
  for (let k = 0; k < 7; k++) gl.box(holeX + (rr() - 0.5) * 0.8, 0.9 + rr() * 0.6, holeZ + (rr() - 0.5) * 1.2, 0.18, 0.18, 0.18, [0xff6a1a, 0xffb02a, 0xff3a0a][k % 3]);   // brasas
  // hélice, eje y timón (en la popa, al aire)
  const sz = -L / 2, py = top(0, half(sz)) - 0.3;
  for (let k = 0; k < 4; k++) mb.box(0, py, sz - 0.4 + k * 0.2, 0.18, 0.18, 0.2, 0x5a5a5a);
  for (let k = 0; k < 4; k++) for (let s = 1; s <= 3; s++) {
    const a = k * Math.PI / 2 + 0.3;
    mb.box(Math.cos(a) * s * 0.22, py + Math.sin(a) * s * 0.22, sz - 0.6, 0.24, 0.24, 0.06, s === 3 ? 0x8a6a2a : 0xa8883a, 0, 0, a);
  }
  for (let j = 0; j < 4; j++) for (let k = 0; k < 3; k++) mb.box(0, py - 0.9 + j * 0.3, sz - 0.1 - k * 0.3, 0.12, 0.3, 0.3, 0x4a3a2a);   // timón
  // la cabina, medio hundida de costado contra el lado escorado, con ventanas rotas y un salvavidas
  const cx = -2.3, cz = -L * 0.2;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 5; k++) {
    if (i > 0 && i < 5 && j > 0 && j < 3 && k > 0 && k < 4) continue;    // hueca
    const win = i === 0 && k > 0 && k < 4 && j === 2;
    const dirt = rnd3(i, j, k) < 0.3;                                   // pintura blanca gastada, con óxido y mugre
    (win ? dk : mb).box(cx - i * v * 0.8, -0.2 + j * v, cz + k * v, v, v, v, win ? 0x0a1418 : dirt ? 0x7a5a3a : k === 4 || j === 3 ? 0xa8a090 : 0xc8c0ac);
  }
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; mb.box(cx + 0.25, 0.7 + Math.sin(a) * 0.32, cz + 0.9 + Math.cos(a) * 0.32, 0.12, 0.12, 0.12, k % 2 ? 0xff5a1a : 0xf0f0e8); }   // salvavidas
  // mástil y botavara flotando, con cabos
  for (let k = 0; k < 16; k++) wd.box(-3.2 - k * 0.05, 0.05, L * 0.05 + k * 0.3, 0.2, 0.2, 0.3, 0x6a5038, 0, 0.15, 0);
  for (let k = 0; k < 8; k++) wd.box(-3.6 + k * 0.3, 0.05, L * 0.05 + 3.5, 0.3, 0.14, 0.14, 0x5a4230);
  for (let k = 0; k < 12; k++) mb.box(-2.9 + k * 0.08, 0.02, L * 0.1 + k * 0.35, 0.04, 0.04, 0.35, 0xd8c8a0, 0, 0.2 * Math.sin(k), 0);   // cabo
  // red de pesca flotando (rejilla) con boyas naranjas
  const nx0 = 2.8, nz0 = -2.5;
  for (let i = 0; i < 8; i++) { mb.box(nx0 + i * 0.35, 0.02, nz0 + 1.2, 0.04, 0.03, 2.6, 0xb8b0a0, 0, 0.3, 0); mb.box(nx0 + 1.2, 0.02, nz0 + i * 0.35, 2.6, 0.03, 0.04, 0xb8b0a0, 0, 0.3, 0); }
  for (let k = 0; k < 6; k++) mb.box(nx0 + (rr()) * 2.8, 0.12, nz0 + rr() * 2.6, 0.3, 0.3, 0.3, 0xff6a1a);
  // cajones, barriles y pescados muertos flotando
  for (let k = 0; k < 7; k++) {
    const x = (rr() - 0.5) * 12, z = (rr() - 0.5) * 16, a = rr() * 3;
    if (Math.abs(x) < 2.5 && Math.abs(z) < L / 2) continue;
    if (k % 2) { wd.box(x, 0.2, z, 0.8, 0.5, 0.6, 0x7a5a3a, 0, a, 0.1); wd.box(x, 0.47, z, 0.82, 0.06, 0.62, 0x5a4230, 0, a, 0.1);
      for (let f = 0; f < 3; f++) mb.box(x + (f - 1) * 0.2, 0.52, z, 0.14, 0.1, 0.4, 0x9aa8b0, 0, a, 0); }
    else for (let j = 0; j < 3; j++) mb.box(x, 0.15, z + j * 0.2 - 0.2, 0.55, 0.5, 0.2, j === 1 ? 0xd8c82a : 0x3a5a8a, Math.PI / 2, a, 0);   // barril acostado
  }
  for (let k = 0; k < 14; k++) mb.box((rr() - 0.5) * 10, 0.03, (rr() - 0.5) * 14, 0.14, 0.06, 0.45, 0xa8b0b8, 0, rr() * 3, Math.PI / 2);   // pescados panza arriba
  for (let k = 0; k < 12; k++) wd.box((rr() - 0.5) * 11, 0.05, (rr() - 0.5) * 15, 0.25, 0.08, 0.9 + rr() * 1.4, [0x6a5038, 0x5a4230][k % 2], 0, rr() * 3, 0);   // tablas
  // manchas de aceite: cuadrados oscuros
  for (let k = 0; k < 5; k++) {
    const ox = (rr() - 0.5) * 10, oz = (rr() - 0.5) * 12, n = 3 + Math.floor(rr() * 3);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) if (i * i + j * j <= n * n && rnd3(i + k, j, 5) < 0.85) dk.box(ox + i * 0.5, 0.02, oz + j * 0.5, 0.5, 0.01, 0.5, 0x14121a);
  }
  // el nombre en la popa
  const nameTex = makeTexWH(256, 64, (c, w, h) => { c.fillStyle = '#8a2a1e'; c.fillRect(0, 0, w, h); c.fillStyle = '#f0e8d0';
    c.font = 'bold 40px "Courier New", monospace'; c.textAlign = 'center'; c.fillText('LA MARENA II', w / 2, 46); }, true);
  const name = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.6), new THREE.MeshLambertMaterial({ map: nameTex }));
  { const [x, y, z] = mb.local(0, 1.3, -L / 2 - 0.22); name.position.set(x, y, z); name.rotation.set(0, W.rot + Math.PI, Math.PI); scene.add(name); }
  for (const B2 of [mb, wd, dk, gl]) B2.setFrame(null);
  for (const [B2, mat] of [[mb, new THREE.MeshLambertMaterial({ vertexColors: true })], [wd, MAT.bark], [dk, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75 })],
                           [gl, new THREE.MeshBasicMaterial({ vertexColors: true })]]) {
    const m = B2.mesh(mat); if (m) { m.userData.theme = false; m.updateMatrix(); if (B2 === gl) WRECK.fire = m; }
  }
  // cadáveres flotando boca abajo (grupos que se mecen), algunos con chaleco salvavidas
  const cloth = [0x3a4a6a, 0x6a3a2a, 0x2a2a2a, 0x7a6a4a];
  for (let k = 0; k < 8; k++) {
    const a = rr() * Math.PI * 2, d = 4.5 + rr() * 5, g = new THREE.Group(), b = new MeshBuilder();
    b.box(0, 0, 0, 0.5, 0.22, 0.7, k % 3 === 0 ? 0xff6a1a : cloth[k % 4]); b.box(0, 0, 0.5, 0.3, 0.2, 0.3, 0x6a7a5a);   // espalda (o chaleco) y nuca
    b.box(0, 0.11, 0.55, 0.28, 0.04, 0.2, 0x2a1a10);                                          // pelo
    for (const s of [-1, 1]) { b.box(s * 0.4, -0.02, 0.1, 0.15, 0.12, 0.6, 0x6a7a5a, 0, s * 0.5, 0); b.box(s * 0.13, -0.02, -0.7, 0.18, 0.14, 0.7, 0x2a2622); }
    const m = b.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    scene.remove(m); m.matrixAutoUpdate = true; m.userData.theme = false; g.add(m);
    g.position.set(W.x + Math.cos(a) * d, WY + 0.05, W.z + Math.sin(a) * d); g.rotation.y = rr() * 6;
    scene.add(g); WRECK.bodies.push({ g, ph: rr() * 6 });
  }
  // humo que sube del casco (Points que suben, crecen y se apagan)
  const n = W.smoke, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { WRECK.sv.push(rr()); pos[i * 3 + 1] = -99; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  WRECK.smoke = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.2, map: radialTex('rgba(60,58,56,.55)', 'rgba(30,30,30,0)'), transparent: true, depthWrite: false, color: 0x5a5856 }));
  WRECK.smoke.frustumCulled = false; WRECK.smoke.userData.theme = false; scene.add(WRECK.smoke);
  WRECK.x = W.x; WRECK.z = W.z; WRECK.y = WY + 2;
}
function updateWreck(dt) {
  if (!WRECK.smoke || Math.hypot(player.pos.x - WRECK.x, player.pos.z - WRECK.z) > 60) return;
  const t = clock.elapsedTime, a = WRECK.smoke.geometry.attributes.position.array;
  for (let i = 0; i < WRECK.sv.length; i++) {
    WRECK.sv[i] += dt * 0.12;
    if (WRECK.sv[i] >= 1) WRECK.sv[i] -= 1;
    const k = WRECK.sv[i];
    a[i * 3] = WRECK.x + Math.sin(i * 7.1) * 0.6 + k * 3.5; a[i * 3 + 1] = WRECK.y + k * 14; a[i * 3 + 2] = WRECK.z + Math.cos(i * 3.3) * 0.6 + k * 1.5;
  }
  WRECK.smoke.geometry.attributes.position.needsUpdate = true;
  if (WRECK.fire) { const f = 0.75 + 0.25 * Math.sin(t * 17) * Math.sin(t * 7.3); WRECK.fire.material.color.setRGB(f, f * 0.9, f * 0.8); }   // las brasas titilan
  for (const B of WRECK.bodies) { B.g.position.y = CONFIG.SQUIDBAY.waterY + 0.05 + Math.sin(t * 1.2 + B.ph) * 0.06; B.g.rotation.z = Math.sin(t * 0.9 + B.ph) * 0.08; }
}

//--- F5.21: el dibujo de los pisos de arriba del embarcadero (lo sólido está en world.js buildPierDeckSolids; los
// tablones de arriba, las barandas y los escalones los pone buildRoof). Pilotes gruesos de cubos con percebes y algas,
// vigas y viguetas por debajo (se ven al pasar abajo), cruces de San Andrés, faroles colgados que brillan, un toldo de
// lona sobre el muelle largo, una grúa de carga con su gancho, cajones, barriles, redes colgadas y un cartel
const PIERDECK = { lamps: null };
function buildPierDecks() {
  const D = CONFIG.SQUIDBAY.decks, y = UP.y, WY = CONFIG.SQUIDBAY.waterY, rr = mulberry(4242);
  const mb = new MeshBuilder(), gl = new MeshBuilder();
  const WOOD = [0x6a5038, 0x5a4230, 0x7a5a3e], DARK = 0x2e2218, ROPE = 0xc8b078;
  for (const [x, z] of D.posts) {                                        // pilotes: del fondo del agua al piso de arriba
    for (let h = WY - 1.6; h < y - 0.3; h += 0.4) mb.box(x, h + 0.2, z, 0.34, 0.4, 0.34, WOOD[Math.floor(rr() * 3)]);
    for (let k = 0; k < 5; k++) mb.box(x + (rr() - 0.5) * 0.36, WY + rr() * 0.6, z + (rr() - 0.5) * 0.36, 0.1, 0.1, 0.1, rr() < 0.6 ? 0xd8d0c0 : 0x3a5a2a);   // percebes y algas
    mb.box(x, y + 0.5, z, 0.3, 1.0, 0.3, DARK); mb.box(x, y + 1.05, z, 0.38, 0.1, 0.38, 0x3a2a1a);   // asoma arriba como poste
  }
  for (const [x1, x2, z1, z2] of D.walk) {                               // por debajo: vigas maestras y viguetas
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, W = x2 - x1, L = z2 - z1;
    for (const x of [x1 + 0.2, x2 - 0.2]) mb.box(x, y - 0.5, cz, 0.3, 0.4, L, DARK);
    for (const z of [z1 + 0.2, z2 - 0.2]) mb.box(cx, y - 0.5, z, W, 0.4, 0.3, DARK);
    for (let z = z1 + 0.6; z < z2 - 0.3; z += 0.8) mb.box(cx, y - 0.4, z, W - 0.4, 0.18, 0.14, WOOD[1]);
    for (let x = x1 + 0.5; x < x2 - 0.3; x += 1.2) for (let z = z1 + 0.3; z < z2; z += 1.1) if (rr() < 0.08)
      mb.box(x, y - 0.35, z, 0.9, 0.04, 0.9, 0x2a3a1a, 0, 0, 0);                                    // musgo que cuelga
  }
  // cruces de San Andrés entre pilotes del mismo borde (del lado del agua)
  const P = D.posts;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const [ax, az] = P[i], [bx, bz] = P[j], d = Math.hypot(ax - bx, az - bz);
    if (d < 3 || d > 7 || Math.abs(ax - bx) > 0.1) continue;            // solo a lo largo de los bordes (no cruzan el paso)
    const n = Math.ceil(Math.hypot(d, y - 0.9 - WY) / 0.13);             // cubos pegados: se ve como una viga
    for (const s of [0, 1]) for (let k = 0; k <= n; k++) {
      const f = k / n, yy = (s ? f : 1 - f) * (y - 0.9 - WY) + WY + 0.2;
      mb.box(ax + (bx - ax) * f, yy, az + (bz - az) * f, 0.16, 0.16, 0.16, DARK);
    }
  }
  // toldo de lona a rayas sobre el muelle largo (postes en las barandas)
  const [ax1, ax2, az1] = D.walk[0], tz1 = az1 + 1, tz2 = az1 + 6, ty = y + 2.7;
  for (const x of [ax1 + 0.1, ax2 - 0.1]) for (const z of [tz1, tz2]) mb.box(x, y + 1.35, z, 0.14, 2.7, 0.14, DARK);
  for (let x = ax1; x < ax2; x += 0.5) {
    const k = Math.round((x - ax1) / 0.5);
    for (let z = tz1 - 0.3; z < tz2 + 0.3; z += 0.5) mb.box(x + 0.25, ty + Math.sin((x - ax1) / (ax2 - ax1) * Math.PI) * 0.4, z + 0.25, 0.5, 0.08, 0.5, k % 2 ? 0xd8d0b8 : 0xa8322a);
  }
  // grúa de carga en la punta del muelle largo: mástil, brazo, cabo y gancho con una red de pescados
  const [gx, gz] = D.crane;
  for (let k = 0; k < 10; k++) mb.box(gx, y + 0.25 + k * 0.4, gz, 0.3, 0.4, 0.3, k % 2 ? 0x8a3a2a : 0x6a2a1e);
  for (let k = 0; k < 9; k++) mb.box(gx + 0.4 + k * 0.35, y + 3.9 - k * 0.05, gz + k * 0.12, 0.35, 0.22, 0.22, 0x8a3a2a);
  const hx = gx + 3.4, hz = gz + 1.1;
  for (let k = 0; k < 6; k++) mb.box(hx, y + 3.6 - k * 0.3, hz, 0.04, 0.3, 0.04, ROPE);
  mb.box(hx, y + 1.7, hz, 0.14, 0.14, 0.14, 0x5a5a5a); mb.box(hx + 0.1, y + 1.55, hz, 0.14, 0.14, 0.14, 0x5a5a5a);
  for (let i = 0; i < 12; i++) mb.box(hx + (rr() - 0.5) * 0.7, y + 1.1 + rr() * 0.4, hz + (rr() - 0.5) * 0.7, 0.16, 0.08, 0.34, 0x9aa8b0, 0, rr() * 3, rr());   // pescados en la red
  // carga: cajones apilados, barriles y rollos de soga contra las barandas
  for (const [x, z, k] of D.cargo) {
    if (k < 2) for (let j = 0; j <= k; j++) { mb.box(x, y + 0.35 + j * 0.7, z, 0.7, 0.7, 0.7, [0x7a5a36, 0x6a4a2c][j]); mb.box(x + 0.351, y + 0.35 + j * 0.7, z, 0.01, 0.1, 0.6, 0x3a2a1a); }
    else if (k === 2) for (let j = 0; j < 3; j++) mb.box(x, y + 0.15 + j * 0.3, z, 0.55, 0.3, 0.55, j === 1 ? 0x2a2a28 : 0x3a5a7a);
    else for (let j = 0; j < 3; j++) mb.box(x, y + 0.05 + j * 0.1, z, 0.7 - j * 0.12, 0.1, 0.7 - j * 0.12, ROPE);
  }
  // redes colgando de las barandas del lado del agua, con boyas
  for (const [x, z1, z2] of [[-62.02, -45, -40], [-45.98, -43, -40]]) {
    for (let z = z1; z < z2; z += 0.3) for (let h = 0; h < 5; h++) if ((Math.round(z / 0.3) + h) % 2 === 0) mb.box(x, y - 0.2 - h * 0.3, z, 0.03, 0.03, 0.3, 0xb8b0a0);
    for (let k = 0; k < 3; k++) mb.box(x, y - 1.6, z1 + 1 + k * 1.5, 0.28, 0.28, 0.28, 0xff6a1a);
  }
  // faroles colgados debajo de los pisos y en los postes del toldo (brillan; ninguna luz nueva)
  const lampPts = [[-59, -44], [-59, -39.5], [-48, -41], [-53, -40.5], [ax1 + 0.35, tz2], [ax2 - 0.35, tz2]];
  for (const [x, z] of lampPts) {
    const under = z > -43 && z < -39 || x > -60 && x < -58 || x > -49;
    const ly = under ? y - 1.0 : y + 2.0;
    mb.box(x, ly + 0.45, z, 0.04, 0.5, 0.04, 0x2a2a2a); mb.box(x, ly + 0.2, z, 0.3, 0.06, 0.3, 0x2a2a2a); mb.box(x, ly - 0.2, z, 0.3, 0.06, 0.3, 0x2a2a2a);
    gl.box(x, ly, z, 0.22, 0.34, 0.22, 0xffc860);
  }
  // cartel en la baranda de la escalera: HARBOR
  const sx = -57, sz = -36.2;
  for (let k = 0; k < 7; k++) mb.box(sx - 1.2 + k * 0.4, y + 1.6, sz, 0.4, 0.5, 0.08, k % 2 ? 0x5a4230 : 0x6a5038);
  mb.box(sx - 1.3, y + 0.8, sz, 0.1, 1.6, 0.1, DARK); mb.box(sx + 1.3, y + 0.8, sz, 0.1, 1.6, 0.1, DARK);
  const tex = makeTexWH(256, 48, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#f0e8d0'; c.font = 'bold 34px "Courier New", monospace';
    c.textAlign = 'center'; c.fillText('HARBOR MASTER', w / 2, 36); }, true);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.45), new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: 0xd8d0c0 }));
  sign.position.set(sx, y + 1.6, sz + 0.05); scene.add(sign);
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); if (m) { m.userData.theme = false; m.updateMatrix(); }
  PIERDECK.lamps = gl.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })); if (PIERDECK.lamps) { PIERDECK.lamps.userData.theme = false; PIERDECK.lamps.updateMatrix(); }
}

//--- F5.20 (Diego): gotera de sangre verde de tortuga en el garaje (donde estaba la ventana): mancha en el techo, chorro
// por la pared, charco que brilla y gotas que caen. Y caparazones de tortuga y huesos tirados por la casa. Todo dibujo
const HOUSEGOO = { drops: null, vel: [], x: 0, z: 0 };
function buildHouseGoo() {
  const C = CONFIG.HOUSE.goo, gl = new MeshBuilder(), mb = new MeshBuilder(), rr = mulberry(2020);
  const wx = C.x, wz = C.z;                                                // x del borde de la pared (cara de adentro)
  gl.box(wx + 0.02, 3.5, wz, 0.02, 0.5, 1.4, 0x5aff3a);                  // mancha arriba
  for (let k = 0; k < 5; k++) {                                          // chorros por la pared
    const z = wz - 0.5 + k * 0.25 + (rr() - 0.5) * 0.1, len = 1.2 + rr() * 2;
    gl.box(wx + 0.025, 3.4 - len / 2, z, 0.015, len, 0.05 + rr() * 0.05, 0x7dff4a);
  }
  gl.box(C.x + 0.5, 3.95, wz, 1.0, 0.02, 1.0, 0x4ad82a);                 // mancha en el techo
  gl.blob(C.x + 0.9, 0.02, wz + 0.2, 0.9, 0.03, 0.7, 0x7dff4a, 3);       // charco
  gl.blob(C.x + 1.5, 0.018, wz + 0.7, 0.4, 0.02, 0.3, 0x7dff4a, 5);
  // caparazones de tortuga y huesos por la casa (lejos de puertas, ventanas y máquinas)
  for (const [x, z, r, kind] of C.decor) {
    if (kind === 'shell') {
      mb.sphere(x, 0.02, z, 0.42, 0.24, 0.5, 0x4a5a32, 10, 0, r, 0);
      for (let q = 0; q < 5; q++) mb.box(x + Math.cos(q * 1.26 + r) * 0.2, 0.2, z + Math.sin(q * 1.26 + r) * 0.24, 0.16, 0.05, 0.16, 0x3a4424, 0.3, q, 0);
      mb.box(x, 0.24, z, 0.14, 0.04, 0.2, 0x5a6a3a, 0, r, 0);
    } else {                                                             // huesos: fémur, costillas, cráneo chico
      const c = Math.cos(r), s = Math.sin(r);
      mb.seg([x - c * 0.35, 0.05, z - s * 0.35], [x + c * 0.35, 0.05, z + s * 0.35], 0.04, 0.04, 0xe0d4b8, 6);
      for (const e of [-1, 1]) mb.sphere(x + c * 0.36 * e, 0.06, z + s * 0.36 * e, 0.07, 0.06, 0.07, 0xe8dcc0, 6);
      for (let q = 0; q < 4; q++) mb.tube([[x + 0.3, 0.02, z + 0.2 + q * 0.09], [x + 0.45, 0.12, z + 0.25 + q * 0.09], [x + 0.6, 0.02, z + 0.2 + q * 0.09]], 0.02, 0.015, 0xd8ccb0, 6, 4);
      mb.sphere(x - 0.25, 0.1, z + 0.35, 0.11, 0.1, 0.13, 0xe8dcc0, 8);
      mb.box(x - 0.2, 0.1, z + 0.46, 0.06, 0.04, 0.02, 0x1a120c);
    }
  }
  for (const [B2, mat] of [[gl, new THREE.MeshBasicMaterial({ vertexColors: true })], [mb, new THREE.MeshLambertMaterial({ vertexColors: true })]]) {
    const m = B2.mesh(mat); if (m) { m.userData.theme = false; m.updateMatrix(); }
  }
  // gotas que caen del techo al charco (un Points)
  const n = 14, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = C.x + 0.5 + rr() * 0.8; pos[i * 3 + 1] = 3.9 - rr() * 3.8; pos[i * 3 + 2] = wz - 0.3 + rr() * 0.8; HOUSEGOO.vel.push(rr() * 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  HOUSEGOO.drops = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.1, color: 0x9aff6a, transparent: true, opacity: 0.9 }));
  HOUSEGOO.drops.frustumCulled = false; HOUSEGOO.drops.userData.theme = false; scene.add(HOUSEGOO.drops);
  HOUSEGOO.x = C.x; HOUSEGOO.z = wz;
}
function updateHouseGoo(dt) {
  if (!HOUSEGOO.drops || Math.hypot(player.pos.x - HOUSEGOO.x, player.pos.z - HOUSEGOO.z) > 25) return;
  const a = HOUSEGOO.drops.geometry.attributes.position.array;
  for (let i = 0; i < HOUSEGOO.vel.length; i++) {
    HOUSEGOO.vel[i] += 9.8 * dt; a[i * 3 + 1] -= HOUSEGOO.vel[i] * dt;
    if (a[i * 3 + 1] < 0.03) { a[i * 3 + 1] = 3.9; HOUSEGOO.vel[i] = 0; }
  }
  HOUSEGOO.drops.geometry.attributes.position.needsUpdate = true;
}

function buildGarden() {
  buildFountain();
  buildPoolWater();                                                // F7c
  buildBeachDecor();                                               // F7c
  buildHouseCorpses();                                             // F5.28e
  buildLifeguard();                                                // F5.13
  buildSquidBay();                                                 // F5.19
  buildCrash();                                                    // F5.18: choque al oeste del templo
  buildTemple();                                                   // F5.13
  buildVoidPlants();                                               // F5.19b
  buildGooFall();                                                  // F5.19c: catarata verde del claro
  buildHouseGoo();                                                 // F5.20: gotera del garaje, caparazones y huesos
  buildWreck();                                                    // F5.20: barco volcado en la bahía
  buildPierDecks();                                                // F5.21: los pisos de arriba del embarcadero
  buildJungle();                                                  // F5.12
  buildBurns();                                                    // F5.12
  buildRancho();                                                   // F5.10
  buildGardenDecor();                                              // F5.11
  buildGardenDress();                                              // F5.17: cercos de hojas, lajas, faroles, hiedra
  buildTempleDress();                                              // F5.17: raíces, cabezas colosales, estelas
  buildPiranhas();
  buildRiverSharks();                                              // F5.19
  buildWetSand();                                                  // F5.8
  buildAcid();
  const G = CONFIG.GARDEN, S = G.headScale;
  const stems = new MeshBuilder();
  for (const [x, z] of G.plants) {
    const y = groundY(x, z) + G.potH;                              // F5.16: en el piso del jardín
    plantStem(stems, x, y, z, S, false);
    const h = makePlantHead(x, y + 0.7 * S + 0.05, z, S, false);
    PLANTS.push(Object.assign(h, { x, z, open: 0, cd: 0, warned: false, spitT: randIn(G.acid.plantEvery), fed: 0, eatT: 0 }));
  }
  const sm = stems.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (sm) { sm.userData.theme = false; sm.updateMatrix(); }
}
// tallo y hojas (F5.7: más alto y grueso para la cabeza ×headScale). F5.11: stone = de piedra (estatuas)
function plantStem(mb, x, y, z, S, stone) {
  const stemH = 0.7 * S;
  mb.box(x, y + stemH / 2, z, 0.1 * S, stemH, 0.1 * S, stone ? 0x8a8a84 : 0x3f6a2a, 0.08, 0, 0);
  for (let k = 0; k < 4; k++) mb.box(x + Math.cos(k * 1.6) * 0.22 * S, y + 0.12, z + Math.sin(k * 1.6) * 0.22 * S,
    0.38 * S, 0.04, 0.16 * S, stone ? 0x9a9a92 : 0x4e7a32, 0, -k * 1.6, 0.3);
}
// cabeza: dos mandíbulas que se abren (pivote atrás), cada una un mesh fusionado.
// F5.9: cada mandíbula tiene la versión normal (n) y la alienígena (a: morada, dientes verdes, ojos en antenas).
// F5.11: withStone = además la de piedra (s), que arranca visible (estatuas de la escotilla)
let PLANT_JAW_MAT = null;
function plantJawMesh(up, look) {
  const b = new MeshBuilder(), s = up ? 1 : -1, alien = look === 'alien', stone = look === 'stone';
  b.box(0, s * 0.07, 0.22, 0.46, 0.14, 0.44, stone ? (up ? 0x9a9a92 : 0x8a8a84) : alien ? (up ? 0x7a2ab0 : 0x5a1a8a) : (up ? 0xb0283a : 0x9a2030));
  b.box(0, s * 0.005, 0.22, 0.4, 0.01, 0.38, stone ? 0x6a6a64 : alien ? 0x9aff6a : 0xe89aa8);      // adentro
  const tooth = stone ? 0xb8b8b0 : alien ? 0xc8ff4a : 0xf0ead8, th = alien ? 0.12 : 0.08;
  for (let i = 0; i < 6; i++) b.box(-0.2 + i * 0.08, -s * 0.03, 0.43, 0.03, th, 0.03, tooth);   // dientes
  for (let i = 0; i < 3; i++) b.box(0.23, -s * 0.03, 0.1 + i * 0.12, 0.03, th, 0.03, tooth);
  if (alien && up) {                                                            // antenas con ojos y púas
    [-0.14, 0, 0.14].forEach((ax, k) => {
      b.box(ax, 0.24 + (k === 1 ? 0.05 : 0), 0.12, 0.03, 0.28 + (k === 1 ? 0.1 : 0), 0.03, 0x4a1a6a, 0, 0, ax * 1.5);
      b.box(ax * 1.3, 0.4 + (k === 1 ? 0.1 : 0), 0.12, 0.08, 0.08, 0.08, 0x7aff3a);
    });
    for (let i = 0; i < 4; i++) b.box(-0.18 + i * 0.12, 0.16, 0.3, 0.04, 0.1, 0.04, 0xd060ff, 0.4, 0, 0);
  }
  if (!PLANT_JAW_MAT) PLANT_JAW_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
  const m = b.mesh(PLANT_JAW_MAT);
  scene.remove(m);
  m.userData.theme = false; m.matrixAutoUpdate = true;
  return m;
}
function makePlantHead(x, y, z, S, withStone) {
  const head = new THREE.Group();
  head.position.set(x, y, z);
  head.scale.setScalar(S);
  const jaw = up => {
    const g = new THREE.Group(), n = plantJawMesh(up, 'normal'), a = plantJawMesh(up, 'alien');
    a.visible = false; g.add(n); g.add(a);
    const L = { g, n, a };
    if (withStone) { L.s = plantJawMesh(up, 'stone'); g.add(L.s); n.visible = false; }
    return L;
  };
  const top = jaw(true), bot = jaw(false);
  head.add(top.g); head.add(bot.g);
  scene.add(head);
  return { head, top: top.g, bot: bot.g, looks: [top, bot],
           prey: null, eatK: 0, base: head.position.clone(), mouth: new THREE.Vector3() };   // F5.10: comer
}

// F5.16: línea libre desde el borde de la maceta (desde el centro la propia maceta la tapa)
function plantSees(p, P, d) {
  const k = Math.min(1, (CONFIG.GARDEN.potR + 0.1) / Math.max(d, 1e-3));
  return segmentClear(p.x + (P.x - p.x) * k, p.z + (P.z - p.z) * k, P.x, P.z, 0, true);
}
function updateGarden(dt) {
  updateBurns(dt);                                                 // F5.12: cercos quemándose
  updatePiranhas(dt);                                              // F5.7
  updateRiverSharks(dt);                                           // F5.19
  updateAcid(dt);                                                  // F5.8
  updateVoidPlants(dt);                                            // F5.19b
  updateGooFall(dt);                                               // F5.19c
  updateHouseGoo(dt);                                              // F5.20
  updateWreck(dt);                                                 // F5.20
  const G = CONFIG.GARDEN, P = player.pos, onGround = playerLevel() === 0, t = clock.elapsedTime;   // F5.16: las plantas están en el piso
  updateTemple(t);                                                 // F5.13: antorchas
  updateBeach(dt, t);                                              // F7c: agua que se mueve y cangrejos
  updateCrash(dt, t);                                              // F5.18: autos en llamas y humo
  if (RANCHO.bulbs) RANCHO.bulbs.material.color.setRGB(1, 0.8 + 0.08 * Math.sin(t * 3), 0.5 + 0.08 * Math.sin(t * 3));   // F5.10
  updateRanchoEyes(dt);                                            // F5.17: ojos en la cueva
  for (const p of PLANTS) {
    p.cd = Math.max(0, p.cd - dt);
    const d = Math.hypot(P.x - p.x, P.z - p.z);
    const near = onGround && d < G.plantWarn;
    if (near && !p.warned) { p.warned = true; sfxPlantWarn(d); }
    else if (!near) p.warned = false;
    // (F5.10: sin mordida al jugador; pedido de Diego, no dejaba ni recargar)
    // F5.8: escupe de vez en cuando si estás a menos de plantRange (F5.16: en el piso, con línea libre)
    if (onGround && d < G.acid.plantRange && (p.spitT -= dt) <= 0 && plantSees(p, P, d)) {
      p.spitT = randIn(G.acid.plantEvery);
      spitAcid(p.x, p.head.position.y, p.z, 0, null, null, p.fed >= CONFIG.QUEST.plantEat);   // F5.24: morada = ácido morado
      p.open = 1;
    }
    // F5.9: se come a un arrastrado a menos de plantKill (uno cada plantEatEvery), hasta plantEat. F5.16: del piso
    p.eatT = Math.max(0, p.eatT - dt);
    let prey = null;
    if (p.fed < CONFIG.QUEST.plantEat && !state.quest.built) {
      for (const z of state.zombies) {
        if (z.alive && z.crawl && (z.level || 0) === 0 && Math.hypot(z.px - p.x, z.pz - p.z) < G.plantKill) { prey = z; break; }
      }
      if (prey && p.eatT <= 0 && !p.prey) plantEat(p, prey);
    }
    if (p.prey) { plantEatAnim(p, dt); continue; }                 // F5.10: se lo está comiendo
    // boca: abierta si estás cerca, respira si no. Mira al jugador cuando avisa (o al arrastrado que va a comer)
    const target = (near || prey) && p.eatT <= 0 ? 1 : 0.12 + 0.08 * Math.sin(t * 2 + p.x);
    p.open += (target - p.open) * Math.min(1, dt * (near || prey ? 10 : 3));
    const a = Math.max(0, p.open) * 0.9;
    p.top.rotation.x = -a; p.bot.rotation.x = a * 0.6;
    const look = prey || (near ? { px: P.x, pz: P.z } : null);
    if (look) p.head.rotation.y = lerpAngle(p.head.rotation.y, Math.atan2(look.px - p.x, look.pz - p.z), Math.min(1, dt * 8));
    else p.head.rotation.y += dt * 0.3;
  }
}

// F5.10: animación de comer (en el mundo, sin tocar la cámara), GARDEN.eat s:
//  lunge: la cabeza baja hasta el arrastrado con la boca abierta · snap: cierra · lift: lo sube a su lugar ·
//  chew: mastica sacudiendo la cabeza mientras el cuerpo se achica hasta desaparecer.
// El arrastrado ya está muerto (dying con z.eaten); plantCarry (updateZombies) lo pone en la boca.
const _plantTgt = new THREE.Vector3();
function plantEatAnim(p, dt) {
  const E = CONFIG.GARDEN.eat, z = p.prey, B = p.base;
  p.eatK += dt;
  const gy = groundY(z.eaten.x0, z.eaten.z0);                     // F5.16: todas comen en el piso
  const k = p.eatK, tgt = _plantTgt.set(z.eaten.x0, gy + 0.55, z.eaten.z0);
  let pos = 0, open = 0.12;
  if (k < E.lunge) { pos = easeOut(k / E.lunge); open = 1; }
  else if (k < E.lunge + E.snap) { pos = 1; open = -0.2; }
  else if (k < E.lunge + E.snap + E.lift) { pos = 1 - easeOut((k - E.lunge - E.snap) / E.lift); open = -0.1; }
  else { pos = 0; open = 0.25 + 0.25 * Math.sin(k * 22); }
  p.head.position.set(B.x + (tgt.x - B.x) * pos, B.y + (tgt.y - B.y) * pos, B.z + (tgt.z - B.z) * pos);
  p.head.rotation.y = lerpAngle(p.head.rotation.y, Math.atan2(z.eaten.x0 - p.x, z.eaten.z0 - p.z), Math.min(1, dt * 12));
  p.head.rotation.z = k > E.lunge + E.snap + E.lift ? Math.sin(k * 30) * 0.25 : 0;
  p.head.rotation.x = -0.6 * pos;                                 // mira hacia abajo al lanzarse
  p.open = open;
  const a = Math.max(0, open) * 0.9;
  p.top.rotation.x = -a; p.bot.rotation.x = a * 0.6;
  // la boca, en el mundo (adelante de la cabeza): la usa plantCarry
  const S = CONFIG.GARDEN.headScale, yaw = p.head.rotation.y;
  p.mouth.set(p.head.position.x + Math.sin(yaw) * 0.3 * S, p.head.position.y, p.head.position.z + Math.cos(yaw) * 0.3 * S);
  if (k >= E.total) {
    p.prey = null; p.head.position.copy(B); p.head.rotation.x = p.head.rotation.z = 0;
  }
}
// el arrastrado en la boca (desde el snap hasta que se lo traga). true = terminó (updateZombies lo desactiva)
function plantCarry(z, dt) {
  const e = z.eaten, p = e.p, E = CONFIG.GARDEN.eat;
  if (p.prey !== z) { z.root.scale.setScalar(1); z.eaten = null; return true; }
  const k = p.eatK;
  if (k < E.lunge) { placeRoot(z, 0); return false; }            // todavía no lo agarró
  const chew = Math.max(0, (k - E.lunge - E.snap - E.lift) / (E.total - E.lunge - E.snap - E.lift));
  z.root.position.set(p.mouth.x, p.mouth.y - 0.9 * (1 - chew), p.mouth.z);
  z.root.rotation.set(Math.sin(k * 25) * 0.4, p.head.rotation.y, Math.sin(k * 19) * 0.5);
  z.root.scale.setScalar(Math.max(0.001, 1 - chew));
  return false;
}

// F5.9: la planta se come al arrastrado (muere sin dar puntos; cuenta para la ronda). Con plantEat, se
// vuelve alienígena
function plantEat(p, z) {
  const d = Math.hypot(player.pos.x - p.x, player.pos.z - p.z);
  p.eatT = CONFIG.QUEST.plantEatEvery;
  if (d < 25) voice('audio_al_alimentar_a_las_plantas_con_crawlers', 0.5, 25);   // F5.19
  z.eaten = { p, x0: z.px, z0: z.pz };                            // F5.10: la animación (plantEatAnim / plantCarry)
  p.prey = z; p.eatK = 0;
  damageZombie(z, z.health + 1, false, 0, 0);
  sfxPlantBite(d);
  if (++p.fed >= CONFIG.QUEST.plantEat) { plantAlien(p, true); sfxPlantWarn(d); }
}
function plantAlien(p, on) { for (const L of p.looks) { L.n.visible = !on; L.a.visible = on; } }

// perro del jardín trasero en lugar de un zombie. null = esta vez no (sigue un zombie normal)
function spawnGardenDog() {
  const D = CONFIG.GARDEN.dogs, r = roomAt(player.pos.x, player.pos.z);
  if (!CONFIG.DOGS.enabled || roundState.dogs || state.round < D.fromRound || (roundState.gardenDogs || 0) >= D.max) return null;
  if (!r || r.id !== D.room || playerLevel() !== 0 || Math.random() >= D.chance) return null;
  const free = DPOOL.filter(q => !q.active);
  if (!free.length) return null;
  const sp = pickSpawnPoint(false, D.room);
  if (!sp) return null;
  const z = free[Math.floor(Math.random() * free.length)];
  resetZombie(z, sp, false);
  state.zombies.push(z);
  roundState.gardenDogs = (roundState.gardenDogs || 0) + 1;
  return z;
}

function resetGarden() {
  roundState.gardenDogs = 0;
  resetBurns();                                                    // F5.12
  resetPiranhas();
  resetAcid();                                                     // F5.8
  resetVoidPlants();                                               // F5.19b
  for (const p of PLANTS) p.spitT = randIn(CONFIG.GARDEN.acid.plantEvery);
  for (const p of PLANTS) { p.fed = 0; p.eatT = 0; plantAlien(p, false); p.prey = null; p.head.position.copy(p.base);
    p.head.rotation.x = p.head.rotation.z = 0; p.open = 0; p.cd = 0; p.warned = false; p.head.rotation.y = 0; p.top.rotation.x = 0; p.bot.rotation.x = 0; }
}

//--- F5.18: el choque al oeste del templo (CONFIG.CRASH). Autos volcados (3 en llamas, con humo), cadáveres, un
// calamar muerto del tamaño de un auto y el Sombrerón muerto con la guitarra atravesada. Cubos, como los personajes.
// Los sólidos están en PROPS (world.js); acá el dibujo. Sin luces nuevas: llamas aditivas y un Points de humo
const CRASH = { flames: [], smoke: null, puffs: [], sources: [] };
function buildCrash() {
  const C = CONFIG.CRASH, mb = new MeshBuilder(), glow = new MeshBuilder(), rr = mulberry(518);
  const blood = 0x5a0a0a, dark = 0x1a1816, burnt = 0x2a2420;
  // autos: modelo local parado (largo en x), transformado con crashFrame (volcado)
  const car = (b, col, fire) => {
    const c = fire ? burnt : col, glass = fire ? 0x0a0a0a : 0x2a3a44;
    b.box(0, 0.65, 0, 4.2, 0.6, 1.8, c);                                   // carrocería
    b.box(-0.2, 1.2, 0, 2.2, 0.55, 1.6, c);                                // cabina
    b.box(-0.2, 1.2, 0, 2.02, 0.44, 1.64, glass);                          // ventanas de los costados
    b.box(0.92, 1.18, 0, 0.06, 0.42, 1.44, glass, 0, 0, -0.5);             // parabrisas
    b.box(-1.32, 1.18, 0, 0.06, 0.42, 1.44, glass, 0, 0, 0.5);
    for (const s of [-1, 1]) {
      b.box(s * 2.12, 0.48, 0, 0.12, 0.24, 1.84, 0x3a3a3a);                // paragolpes
      for (const w of [-1, 1]) b.box(s * 1.35, 0.36, w * 0.82, 0.72, 0.72, 0.3, 0x141414);   // ruedas
      for (const w of [-1, 1]) b.box(s * 1.35, 0.36, w * 0.98, 0.34, 0.34, 0.02, 0x6a6a6a);  // llantas
    }
    b.box(2.17, 0.72, 0.6, 0.04, 0.14, 0.32, fire ? 0x3a3020 : 0xfff0c0); b.box(2.17, 0.72, -0.6, 0.04, 0.14, 0.32, fire ? 0x3a3020 : 0xfff0c0);
    b.box(-2.17, 0.72, 0.6, 0.04, 0.14, 0.3, 0x8a1010); b.box(-2.17, 0.72, -0.6, 0.04, 0.14, 0.3, 0x8a1010);
    b.box(0, 0.33, 0, 3.8, 0.06, 1.6, dark);                               // chasis
    b.box(-1.6, 0.3, 0.4, 1.4, 0.1, 0.1, 0x3a3a3a);                        // escape
    for (let k = 0; k < 5; k++) b.box(rr() * 3.6 - 1.8, 0.65 + rr() * 0.3, (rr() < 0.5 ? -1 : 1) * 0.905, 0.3 + rr() * 0.4, 0.1 + rr() * 0.2, 0.01, fire ? 0x151210 : 0x6a3a1a);   // abolladuras y óxido
  };
  const fmat = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,230,140,1)', 'rgba(255,90,10,0.55)'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, vertexColors: true });
  for (const c of C.cars) {
    const M = crashFrame(c), fire = c[4];
    mb.frame = M; car(mb, c[3], fire); mb.frame = null;
    // vidrios rotos y un charco de aceite al lado
    for (let k = 0; k < 8; k++) mb.box(c[0] + (rr() - 0.5) * 5, 0.012, c[1] + (rr() - 0.5) * 4, 0.12, 0.01, 0.08, 0x9ab8c0, 0, rr() * 3, 0);
    mb.box(c[0] + 1.2, 0.008, c[1] + 1.4, 1.6, 0.01, 1.1, 0x121010, 0, rr() * 3, 0);
    if (!fire || !C.fire) continue;                                        // F5.19: sin llamas (quedan quemados)
    // llamas: varias tarjetas cruzadas en un mesh (una por auto); el humo sale de acá
    const top = crashBox(M, [-2.15, 2.15, 0, 1.5, -0.92, 0.92])[4], fb = new MeshBuilder();
    for (let k = 0; k < 7; k++) {
      const dx = (rr() - 0.5) * 3, dz = (rr() - 0.5) * 1.2, w = 0.9 + rr() * 0.8, h = 1.2 + rr() * 1.1;
      for (const r of [0, Math.PI / 2]) fb.plane(dx, h / 2, dz, w, h, 0, r + c[2], 0, null, k % 2 ? 0xffffff : 0xffc080);
      glow.box(c[0] + dx, top + 0.05, c[1] + dz, 0.5, 0.06, 0.4, 0xff6a10);                          // brasas
    }
    const fm = fb.mesh(fmat); scene.remove(fm); fm.matrixAutoUpdate = true; fm.userData.theme = false;
    const g = new THREE.Group(); g.position.set(c[0], top - 0.1, c[1]); g.add(fm); scene.add(g);
    CRASH.flames.push(g); CRASH.sources.push([c[0], top + 1.5, c[1]]);
  }
  // cadáveres de civiles (cubos, acostados) con charco de sangre
  const body = (x, z, ry, shirt) => {
    mb.setFrame(x, 0, z, ry);
    mb.box(0, 0.14, 0, 0.5, 0.26, 0.75, shirt);                            // torso
    mb.box(0, 0.14, 0.58, 0.34, 0.3, 0.34, 0xc8a080);                      // cabeza
    mb.box(-0.12, 0.1, -0.72, 0.18, 0.18, 0.75, 0x2a3a5a, 0, 0.15, 0); mb.box(0.14, 0.1, -0.7, 0.18, 0.18, 0.75, 0x2a3a5a, 0, -0.3, 0);   // piernas
    mb.box(-0.42, 0.08, 0.2, 0.16, 0.16, 0.6, 0xc8a080, 0, 0.9, 0); mb.box(0.4, 0.08, 0.05, 0.16, 0.16, 0.6, shirt, 0, -0.5, 0);           // brazos
    mb.box(0.3, 0.01, 0.25, 1.4, 0.01, 1.1, blood, 0, 0.3, 0);
    mb.setFrame(null);
  };
  C.bodies.forEach(([x, z, r], i) => body(x, z, r, [0x8a3a2a, 0xd8d0b8, 0x3a6a8a, 0x5a7a3a, 0xa87a2a, 0x6a4a8a, 0x2a2a2a][i % 7]));
  // calamar muerto del tamaño de un auto: el de los mobs (cubos) ×3.5, de costado, con tinta y sangre verde
  { const [x, z, r] = C.squid, skin = 0x8a3a5a, skin2 = 0x6a2a48, spot = 0xb05a7a;
    mb.setFrame(x, 0, z, r);
    mb.box(0, 0.55, -0.5, 1.9, 1.1, 2.4, skin);                           // manto, acostado (largo en z)
    mb.box(0, 0.45, -2.0, 1.3, 0.8, 0.8, skin2); mb.box(0, 0.35, -2.6, 0.7, 0.5, 0.5, skin2);   // punta del manto
    for (const s of [-1, 1]) mb.box(s * 1.2, 0.3, -1.9, 0.7, 0.12, 1.0, skin2, 0, s * 0.3, 0);    // aletas caídas
    for (let k = 0; k < 7; k++) mb.box((rr() - 0.5) * 1.6, 1.11, -0.5 + (rr() - 0.5) * 2, 0.25, 0.02, 0.25, spot);   // manchas
    mb.box(0, 0.45, 1.05, 1.6, 0.9, 0.8, skin);                           // cabeza
    for (const s of [-1, 1]) {
      mb.box(s * 0.81, 0.55, 1.05, 0.04, 0.42, 0.42, 0xe8e0c0);            // ojos muertos a los costados
      mb.box(s * 0.83, 0.55, 1.08, 0.02, 0.18, 0.18, 0x101010);
    }
    for (let k = 0; k < 8; k++) {                                          // tentáculos tirados, cada uno en 4 tramos
      let a = -1.2 + k * 0.34, px = (k - 3.5) * 0.18, pz = 1.45;
      for (let j = 0; j < 4; j++) {
        const L = 0.8 - j * 0.1; a += (rr() - 0.5) * 0.6;
        px += Math.sin(a) * L * 0.5; pz += Math.cos(a) * L * 0.5;
        mb.box(px, 0.1 - j * 0.015, pz, 0.26 - j * 0.04, 0.18 - j * 0.03, L, j % 2 ? skin : skin2, 0, a, 0);
        if (j < 3) mb.box(px, 0.2 - j * 0.02, pz, 0.1, 0.02, 0.1, 0xe0b0c0, 0, a, 0);   // ventosa
        px += Math.sin(a) * L * 0.5; pz += Math.cos(a) * L * 0.5;
      }
    }
    mb.box(0.3, 0.008, 1.6, 3.4, 0.01, 2.6, 0x0a0a14, 0, 0.3, 0);         // tinta
    mb.setFrame(null);
    glow.box(x + 0.6, 0.015, z - 1.2, 1.4, 0.012, 1.0, 0x6aff7a, 0, r, 0);   // baba verde que brilla
  }
  // el Sombrerón muerto, boca arriba, con la guitarra atravesada en el pecho y el sombrero tirado al lado
  { const [x, z, r] = C.boss, suit = 0x1a1a1e, skin = 0x6a7a5a, silver = 0xc8c8c0;
    mb.setFrame(x, 0, z, r);
    mb.box(0, 0.35, 0, 1.3, 0.6, 1.0, suit);                               // torso (acostado: largo en x)
    for (let k = 0; k < 4; k++) mb.box(-0.4 + k * 0.25, 0.66, 0.15, 0.06, 0.03, 0.06, silver);   // botones
    mb.box(1.0, 0.35, 0, 0.6, 0.55, 0.55, skin);                           // cabeza
    mb.box(1.02, 0.64, 0.12, 0.08, 0.03, 0.1, 0x101010); mb.box(1.02, 0.64, -0.12, 0.08, 0.03, 0.1, 0x101010);   // ojos cerrados
    mb.box(1.16, 0.5, 0, 0.12, 0.06, 0.36, 0x2a1a10);                      // bigote
    mb.box(-1.2, 0.22, 0.25, 1.2, 0.34, 0.34, suit); mb.box(-1.2, 0.22, -0.28, 1.2, 0.34, 0.34, suit, 0, 0.2, 0);   // piernas
    mb.box(-1.85, 0.25, 0.25, 0.3, 0.4, 0.38, 0x3a2412); mb.box(-1.85, 0.25, -0.4, 0.3, 0.4, 0.38, 0x3a2412);       // botas
    mb.box(0.2, 0.2, 0.85, 1.0, 0.3, 0.3, suit, 0, 0.5, 0); mb.box(0.1, 0.2, -0.85, 1.0, 0.3, 0.3, suit, 0, -0.3, 0);   // brazos
    mb.box(0.1, 1.1, 0.05, 0.14, 1.6, 0.1, 0x6a4a2a, 0.35, 0, 0.25);       // mástil de la guitarra, clavado
    mb.box(0.32, 1.9, 0.33, 0.24, 0.3, 0.1, 0x4a2a1a, 0.35, 0, 0.25);      // clavijero
    mb.box(-0.12, 0.5, -0.12, 0.8, 0.14, 0.6, 0xb8742a, 0.35, 0, 0.25);    // caja de la guitarra, partida sobre el pecho
    mb.box(-0.1, 0.58, -0.12, 0.22, 0.02, 0.22, 0x1a0e06, 0.35, 0, 0.25);  // boca de la guitarra
    mb.box(0, 0.01, 0, 3.0, 0.012, 2.0, blood, 0, 0.2, 0);
    mb.box(1.4, 0.05, 1.5, 1.7, 0.08, 1.7, 0x2a2018, 0, 0.6, 0.15);       // ala del sombrero
    mb.box(1.4, 0.3, 1.5, 0.7, 0.45, 0.7, 0x2a2018, 0, 0.6, 0.15);        // copa
    mb.box(1.4, 0.13, 1.5, 0.74, 0.08, 0.74, silver, 0, 0.6, 0.15);       // banda
    mb.setFrame(null);
  }
  // restos: cubiertas, conos, marcas de frenada
  for (let k = 0; k < 6; k++) mb.box(38 + rr() * 16, 0.006, 76 + rr() * 15, 0.25, 0.008, 3 + rr() * 3, 0x141210, 0, rr() * 3, 0);
  [[37.5, 76.5], [53.5, 77], [37.2, 90.5]].forEach(([x, z]) => { mb.box(x, 0.02, z, 0.4, 0.04, 0.4, 0x2a2a2a); mb.box(x, 0.3, z, 0.22, 0.55, 0.22, 0xe86a1a); mb.box(x, 0.35, z, 0.24, 0.1, 0.24, 0xf0f0f0); });
  for (const B of [mb, glow]) { const m = B.mesh(B === glow ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshLambertMaterial({ vertexColors: true })); if (m) { m.userData.theme = false; m.updateMatrix(); } }
  // humo: un solo Points, puffs que suben de los autos en llamas, se abren y se van
  if (!CRASH.sources.length) return;                                      // F5.19: sin fuego, sin humo
  const N = C.smoke, pos = new Float32Array(N * 3), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  CRASH.smoke = new THREE.Points(geo, new THREE.PointsMaterial({ size: 6, map: radialTex('rgba(190,184,176,0.6)', 'rgba(150,146,140,0.3)'),
    transparent: true, depthWrite: false, color: 0x8a847a, opacity: 0.85 }));
  CRASH.smoke.frustumCulled = false; CRASH.smoke.userData.theme = false; scene.add(CRASH.smoke);
  for (let i = 0; i < N; i++) CRASH.puffs.push({ s: i % Math.max(1, CRASH.sources.length), t: i / N * 6, life: 6 });
  updateCrash(0, 0);                                                     // posiciones iniciales (si no, arrancan en el origen)
}
function updateCrash(dt, t) {
  CRASH.flames.forEach((g, i) => { const k = 0.8 + 0.3 * Math.abs(Math.sin(t * 9 + i * 2.1)) + 0.1 * Math.sin(t * 23 + i); g.scale.set(1, k, 1); });
  if (!CRASH.smoke || !CRASH.sources.length) return;
  const P = CRASH.smoke.geometry.attributes.position;
  CRASH.puffs.forEach((p, i) => {
    p.t = (p.t + dt) % p.life;
    const src = CRASH.sources[p.s], k = p.t / p.life;
    P.setXYZ(i, src[0] + Math.sin(i * 1.7 + t * 0.3) * k * 1.6 + k * 2.5, src[1] + k * 9, src[2] + Math.cos(i * 2.3) * k * 1.6);
  });
  P.needsUpdate = true;
}
