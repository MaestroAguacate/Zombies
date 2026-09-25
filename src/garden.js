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
const ACID = { shots: [], puddles: [], tickT: 0 };

function wetSandMul(x, z) {
  const G = CONFIG.GARDEN;
  for (const r of G.wetSand) if (x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]) return G.wetMul;
  return 1;
}
function buildWetSand() {
  const mb = new MeshBuilder();
  for (const r of CONFIG.GARDEN.wetSand) {
    mb.box((r[0] + r[1]) / 2, 0.004, (r[2] + r[3]) / 2, r[1] - r[0], 0.008, r[3] - r[2], 0x8a7452);
    mb.box((r[0] + r[1]) / 2, 0.006, (r[2] + r[3]) / 2, r[1] - r[0] - 0.6, 0.008, r[3] - r[2] - 0.6, 0x7a6646);   // más oscura adentro
  }
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.userData.theme = false; m.updateMatrix();
}
function buildAcid() {
  const A = CONFIG.GARDEN.acid;
  const shotMat = new THREE.MeshBasicMaterial({ color: 0x7aff3a });
  const shotGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22), padGeo = new THREE.CircleGeometry(1, 20);
  for (let i = 0; i < A.pool; i++) {
    const m = new THREE.Mesh(shotGeo, shotMat); m.visible = false; scene.add(m);
    ACID.shots.push({ m, active: false, p: new THREE.Vector3(), v: new THREE.Vector3(), level: 0 });
    const pad = new THREE.Mesh(padGeo, new THREE.MeshBasicMaterial({ color: 0x5ad82a, transparent: true, opacity: 0.6, depthWrite: false }));
    pad.rotation.x = -Math.PI / 2; pad.scale.setScalar(A.radius); pad.visible = false; scene.add(pad);
    ACID.puddles.push({ m: pad, life: 0, x: 0, z: 0, level: 0, r: A.radius });
  }
}
// escupe desde (x, y, z) hacia donde está el jugador ahora (sin adelantar: moverse lo esquiva)
function spitAcid(x, y, z, level) {
  const A = CONFIG.GARDEN.acid, S = ACID.shots.find(s => !s.active), P = player.pos;
  if (!S) return false;
  const ty = P.y - CONFIG.PLAYER.height + 0.9, d = Math.hypot(P.x - x, P.z - z), T = Math.max(0.2, d / A.speed);
  S.p.set(x, y, z); S.v.set((P.x - x) / T, (ty - y) / T + 0.5 * A.gravity * T, (P.z - z) / T);
  S.level = level; S.active = true; S.m.visible = true; S.m.position.copy(S.p);
  sfxPlantWarn(Math.hypot(P.x - x, P.z - z));
  return true;
}
// radius / life opcionales (F5.9: los calamares que tira el Calamarón dejan charcos más grandes)
function acidPuddle(x, z, level, radius, life) {
  const A = CONFIG.GARDEN.acid;
  const pd = ACID.puddles.find(q => q.life <= 0) || ACID.puddles.reduce((a, b) => (a.life < b.life ? a : b));
  pd.life = life || A.life; pd.x = x; pd.z = z; pd.level = level; pd.r = radius || A.radius;
  pd.m.scale.setScalar(pd.r);
  pd.m.position.set(x, (level === 1 ? UP.y : groundY(x, z)) + 0.03, z); pd.m.visible = true; pd.m.material.opacity = 0.6;
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
      const floor = S.level === 1 && walkAt(S.p.x, S.p.z) ? UP.y : groundY(S.p.x, S.p.z);
      if (pl === S.level && projHitsPlayer(S.p, 0.2)) {             // te toca: pega y el charco queda a tus pies
        damagePlayer(A.hit, S.p.x, S.p.z);
        acidPuddle(P.x, P.z, pl); end = true;
        ACID.tickT = 1;                                              // el charco a tus pies empieza a quemar en 1 s
      } else if (S.p.y <= floor) { acidPuddle(S.p.x, S.p.z, floor === UP.y ? 1 : 0); end = true; }
      else if (projBlocked(S.p.x, S.p.y, S.p.z)) { acidPuddle(S.p.x, S.p.z, S.level); end = true; }
      else if (S.p.y < -5) end = true;
    }
    if (end) { S.active = false; S.m.visible = false; } else S.m.position.copy(S.p);
  }
  let inside = false;
  for (const pd of ACID.puddles) {
    if (pd.life <= 0) continue;
    pd.life -= dt;
    pd.m.material.opacity = 0.6 * Math.min(1, pd.life / 0.5);
    if (pd.life <= 0) { pd.m.visible = false; continue; }
    if (pd.level === pl && Math.hypot(P.x - pd.x, P.z - pd.z) < pd.r) inside = true;
  }
  if (!inside) ACID.tickT = 0;                                      // al entrar pega enseguida, después cada 1 s
  else if ((ACID.tickT -= dt) <= 0) { ACID.tickT = 1; damagePlayer(A.tick, P.x, P.z, true); }
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
  ACID.tickT = 0;
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
}

// F5.10: rancho de playa (solo dibujo; los sólidos están en PROPS y el corral en buildMap). Palapa con techo de
// palma en capas, deck de madera, billar con bolas y tacos, barra con botellas y bancos, hamaca, foquitos
// (MeshBasic: ninguna luz nueva), tablas, red con boyas, cartel, y el tortugario con nidos, huevos y crías
const RANCHO = { bulbs: null, t: 0 };
function buildRancho() {
  const R = CONFIG.RANCHO, P = R.palapa, mb = new MeshBuilder();
  const wood = 0x7a5432, dark = 0x4a321e, straw = 0xc8a860, straw2 = 0xa88848, felt = 0x1f6a3a;
  const cx = (P.x1 + P.x2) / 2, cz = (P.z1 + P.z2) / 2, W = P.x2 - P.x1, D = P.z2 - P.z1;
  // deck
  for (let i = 0; i < 20; i++) mb.box(cx, 0.03, P.z1 + 0.25 + i * 0.5, W + 0.6, 0.05, 0.46, i % 2 ? 0x9a7048 : 0x8a6440);
  // postes (troncos) y vigas
  for (const [x, z] of [[P.x1, P.z1], [P.x2, P.z1], [P.x1, P.z2], [P.x2, P.z2]]) {
    mb.box(x, P.h / 2, z, 0.3, P.h, 0.3, wood);
    mb.box(x, 0.4, z, 0.36, 0.1, 0.36, dark);
  }
  mb.box(cx, P.h, P.z1, W + 0.4, 0.2, 0.2, dark); mb.box(cx, P.h, P.z2, W + 0.4, 0.2, 0.2, dark);
  mb.box(P.x1, P.h, cz, 0.2, 0.2, D + 0.4, dark); mb.box(P.x2, P.h, cz, 0.2, 0.2, D + 0.4, dark);
  // techo de palma: capas que se achican hacia arriba, con flecos en el borde
  for (let k = 0; k < 5; k++) {
    const s = 1 - k * 0.19;
    mb.box(cx, P.h + 0.2 + k * 0.32, cz, (W + 1.6) * s, 0.3, (D + 1.6) * s, k % 2 ? straw : straw2);
  }
  mb.box(cx, P.h + 1.85, cz, 0.5, 0.35, 0.5, straw2);
  for (let i = 0; i < 24; i++) {                                         // flecos
    const t = i / 24, along = -0.5 + t;
    mb.box(cx + along * (W + 1.6), P.h + 0.02, P.z1 - 0.8, 0.35, 0.35, 0.06, straw, 0.3, 0, 0);
    mb.box(cx + along * (W + 1.6), P.h + 0.02, P.z2 + 0.8, 0.35, 0.35, 0.06, straw, -0.3, 0, 0);
    mb.box(P.x1 - 0.8, P.h + 0.02, cz + along * (D + 1.6), 0.06, 0.35, 0.35, straw, 0, 0, -0.3);
    mb.box(P.x2 + 0.8, P.h + 0.02, cz + along * (D + 1.6), 0.06, 0.35, 0.35, straw, 0, 0, 0.3);
  }
  // billar (PROPS billar): patas, caja, paño, bandas, troneras, bolas y dos tacos
  const [bx1, bx2, bz1, bz2, bh] = R.props.find(p => p.id === 'billar').box;
  const bcx = (bx1 + bx2) / 2, bcz = (bz1 + bz2) / 2, bw = bx2 - bx1, bd = bz2 - bz1;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mb.box(bcx + sx * (bw / 2 - 0.15), 0.35, bcz + sz * (bd / 2 - 0.15), 0.16, 0.7, 0.16, dark);
  mb.box(bcx, bh - 0.12, bcz, bw, 0.22, bd, wood);
  mb.box(bcx, bh + 0.005, bcz, bw - 0.24, 0.02, bd - 0.24, felt);
  mb.box(bcx, bh + 0.04, bz1 + 0.06, bw, 0.08, 0.12, 0x5a2a1a); mb.box(bcx, bh + 0.04, bz2 - 0.06, bw, 0.08, 0.12, 0x5a2a1a);
  mb.box(bx1 + 0.06, bh + 0.04, bcz, 0.12, 0.08, bd, 0x5a2a1a); mb.box(bx2 - 0.06, bh + 0.04, bcz, 0.12, 0.08, bd, 0x5a2a1a);
  for (const [sx, sz] of [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]]) mb.box(bcx + sx * (bw / 2 - 0.13), bh + 0.02, bcz + sz * (bd / 2 - 0.13), 0.12, 0.03, 0.12, 0x0a0a0a);
  const balls = [0xf0f0e8, 0xf0c020, 0x2040c0, 0xc02020, 0x6a2a8a, 0xe86a1a, 0x1a8a3a, 0x7a1a1a, 0x101010];
  balls.forEach((c, i) => mb.box(bcx + 0.5 - (i % 4) * 0.1, bh + 0.05, bcz - 0.15 + Math.floor(i / 4) * 0.1, 0.07, 0.07, 0.07, c));
  mb.box(bcx - 0.4, bh + 0.05, bcz + 0.05, 0.07, 0.07, 0.07, 0xf0f0e8);   // la blanca
  mb.box(bcx - 0.2, bh + 0.06, bcz + 0.35, 1.5, 0.03, 0.03, 0xd8b070, 0, 0.3, 0);   // taco sobre la mesa
  mb.box(P.x2 - 0.25, 0.8, P.z2 - 0.3, 0.03, 1.5, 0.03, 0xd8b070, 0.1, 0, 0.12);    // taco apoyado en el poste
  // barra (PROPS barra) con botellas atrás, en el cerco, y 3 bancos
  const [rx1, rx2, rz1, rz2, rh] = R.props.find(p => p.id === 'barra').box;
  const rcx = (rx1 + rx2) / 2, rcz = (rz1 + rz2) / 2;
  mb.box(rcx, rh / 2, rcz, rx2 - rx1, rh, rz2 - rz1, wood);
  mb.box(rcx + 0.05, rh + 0.03, rcz, rx2 - rx1 + 0.2, 0.06, rz2 - rz1 + 0.2, 0xa87a4a);
  for (let i = 0; i < 6; i++) mb.box(rx2 + 0.005, rh * 0.5, rz1 + 0.4 + i * 0.7, 0.01, rh * 0.8, 0.5, i % 2 ? 0x6a4a2a : 0x5a3a20);   // tablas del frente
  const bottles = [0x3a8a3a, 0x8a4a1a, 0xd8d0b0, 0x2a5a8a, 0x8a1a1a];
  for (let i = 0; i < 10; i++) mb.box(rcx - 0.15 + (i % 2) * 0.2, rh + 0.2, rz1 + 0.3 + i * 0.42, 0.08, 0.3, 0.08, bottles[i % 5]);
  for (let i = 0; i < 3; i++) {
    const sz = rz1 + 0.8 + i * 1.4;
    mb.box(rx2 + 0.6, 0.35, sz, 0.08, 0.7, 0.08, dark);
    mb.box(rx2 + 0.6, 0.72, sz, 0.36, 0.06, 0.36, 0xc83a2a);
  }
  // hamaca entre dos postes, contra el cerco norte (F5.13: al este de la caja)
  mb.box(-45.6, 0.9, 38.8, 0.12, 1.8, 0.12, wood); mb.box(-42.4, 0.9, 38.8, 0.12, 1.8, 0.12, wood);
  mb.box(-44, 0.7, 38.8, 2.9, 0.05, 0.9, 0xe0503a);
  for (let i = 0; i < 4; i++) mb.box(-45.2 + i * 0.8, 0.72, 38.8, 0.4, 0.06, 0.92, i % 2 ? 0xf0c040 : 0x3a8ac8);
  // tablas de surf en un soporte y una red con boyas en un bastidor (F5.13: el rancho ya no tiene cercos)
  mb.box(-46, 0.5, 19.4, 3, 0.08, 0.3, dark); mb.box(-46, 1.6, 19.4, 3, 0.08, 0.3, dark);
  [[-47.2, 0xe86a3a], [-46.4, 0x3aa0d8], [-45.6, 0xf0e0a0], [-44.8, 0x5ab86a]].forEach(([x, c]) => {
    mb.box(x, 1.05, 19.4, 0.5, 2.1, 0.07, c, 0.15, 0, 0);
    mb.box(x, 1.05, 19.44, 0.51, 0.08, 0.075, 0xf0ead8, 0.15, 0, 0);
  });
  for (const z of [36.8, 38.9]) mb.box(-55.6, 1.1, z, 0.1, 2.2, 0.1, dark);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) mb.box(-55.6, 0.8 + j * 0.35, 37 + i * 0.4, 0.02, 0.02, 0.36, 0x6a5a3a);
  [[37.3, 1.5, 0xe84a2a], [38.1, 1.1, 0xf0c030], [38.6, 1.8, 0xe84a2a]].forEach(([z, y, c]) => mb.box(-55.5, y, z, 0.2, 0.2, 0.2, c));
  // tortugario: arena, nidos, huevos, crías y cartel (F5.13: más grande)
  const C = R.corral;
  mb.box((C.x1 + C.x2) / 2, 0.04, (C.z1 + C.z2) / 2, C.x2 - C.x1, 0.06, C.z2 - C.z1, 0xe8d4a0);
  [[-55, 19.3], [-53.4, 19.8], [-51.6, 19.2], [-54.6, 21.5], [-52.8, 22.2], [-51.2, 22.8]].forEach(([x, z], i) => {
    mb.box(x, 0.1, z, 0.7, 0.12, 0.7, 0xd0b880);
    for (let k = 0; k < 4; k++) mb.box(x - 0.12 + (k % 2) * 0.24, 0.2, z - 0.1 + Math.floor(k / 2) * 0.2, 0.12, 0.12, 0.12, 0xf4f0e0);
    if (i % 2) { mb.box(x + 0.4, 0.1, z - 0.3, 0.18, 0.08, 0.22, 0x3a6a3a); mb.box(x + 0.4, 0.1, z - 0.18, 0.08, 0.06, 0.08, 0x5a8a4a); }
  });
  mb.box(-50.4, 1.0, 24.4, 0.08, 1.0, 0.08, dark);                         // poste del cartel
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (m) { m.userData.theme = false; m.updateMatrix(); }
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
  sign('RANCHO', 'DON MARENA', cx, P.h - 0.2, P.z1 - 0.12, Math.PI, 1.8);
  sign('TORTUGARIO', 'NO MOLESTAR', -50.4, 1.55, 24.5, 0, 1.0);
  // foquitos colgando del borde de la palapa: un InstancedMesh MeshBasic que late (sin luces)
  const n = 28, geo = new THREE.BoxGeometry(0.12, 0.16, 0.12);
  const bulbs = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd890 }), n);
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const t = i / n * 4, side = Math.floor(t), f = t - side;
    const x = side === 0 ? P.x1 + f * W : side === 1 ? P.x2 : side === 2 ? P.x2 - f * W : P.x1;
    const z = side === 0 ? P.z1 : side === 1 ? P.z1 + f * D : side === 2 ? P.z2 : P.z2 - f * D;
    o.position.set(x, P.h - 0.35 - 0.12 * Math.sin(f * Math.PI), z); o.updateMatrix();
    bulbs.setMatrixAt(i, o.matrix);
  }
  scene.add(bulbs);
  RANCHO.bulbs = bulbs;
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
  const petals = [0xe83a5a, 0xf0c030, 0xf0f0f0, 0xc85af0, 0xff8a3a];
  D.flowers.forEach(([x1, x2, z1, z2], i) => {
    mb.box((x1 + x2) / 2, 0.06, (z1 + z2) / 2, x2 - x1, 0.12, z2 - z1, 0x5a3a22);   // tierra
    const n = Math.round((x2 - x1) * (z2 - z1) * 6);
    for (let k = 0; k < n; k++) {
      const px = x1 + 0.1 + ((k * 0.618 + i) % 1) * (x2 - x1 - 0.2), pz = z1 + 0.1 + ((k * 0.382 + i * 0.3) % 1) * (z2 - z1 - 0.2);
      const h = 0.25 + ((k * 0.73) % 1) * 0.3;
      mb.box(px, 0.12 + h / 2, pz, 0.03, h, 0.03, 0x3f7a2a);
      mb.box(px, 0.14 + h, pz, 0.12, 0.08, 0.12, petals[(k + i) % petals.length]);
    }
  });
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (m) { m.userData.theme = false; m.updateMatrix(); }
}

//--- F5.12: la jungla (solo dibujo; los troncos sólidos están en PROPS, planJungle). Un mesh para todo lo fijo
function buildJungle() {
  const J = CONFIG.JUNGLE, mb = new MeshBuilder();
  let s = J.seed * 31 + 5;
  const rnd = (a, b) => { s = (s * 16807) % 2147483647; return a + (b - a) * s / 2147483647; };
  const greens = [0x2f5a24, 0x3a6a2a, 0x264a1e, 0x4a7a32, 0x1e3e18];
  const tree = (x, z, big, full) => {
    const h = 5.5 + big * 3.5, g = greens[Math.floor(big * 5) % 5];
    if (big < 0.3) {                                                   // palmera de jungla, curva
      for (let i = 0; i < 7; i++) mb.box(x + i * 0.12, 0.5 + i * h / 7, z + i * 0.05, 0.42 - i * 0.02, h / 7 + 0.05, 0.42 - i * 0.02, i % 2 ? 0x6a5234 : 0x5a4428);
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; mb.box(x + 0.84 + Math.cos(a) * 1.3, h + 0.3, z + 0.35 + Math.sin(a) * 1.3, 2.8, 0.08, 0.6, g, 0, -a, -0.35); }
      return;
    }
    mb.box(x, h / 2, z, 0.6, h, 0.6, 0x5a4028);                        // tronco
    mb.box(x, 0.3, z, 1.1, 0.6, 1.1, 0x4a3420);                         // raíces
    for (let k = 0; k < 3; k++) mb.box(x, h - 0.4 + k * 0.9, z, 4.2 - k * 1.1, 1.0, 4.2 - k * 1.1, greens[(k + Math.floor(big * 7)) % 5], 0, big * 3 + k, 0);   // copa en capas
    if (!full) return;
    for (let k = 0; k < 5; k++) {                                       // hojas grandes y lianas colgando
      const a = k / 5 * Math.PI * 2 + big;
      mb.box(x + Math.cos(a) * 2.2, h - 0.6, z + Math.sin(a) * 2.2, 1.8, 0.06, 0.7, g, 0, -a, -0.4);
      if (k % 2 === 0) mb.box(x + Math.cos(a) * 1.6, h - 2.2 - big, z + Math.sin(a) * 1.6, 0.05, 3.2 + big * 1.5, 0.05, 0x3a5a22);
    }
  };
  for (const t of JUNGLE.trees) tree(t.x, t.z, t.big, true);
  // F5.15: la espesura: árboles tupidos con sotobosque (sin collider: la pared la pone world.js buildThicketWalls),
  // sin pisar lo caminable, y una hilera de arbustos altos sobre cada pared de vegetación
  const bush = (x, z, w, g) => { mb.box(x, w * 0.5, z, w, w, w * 0.9, g, 0, rnd(0, 3), 0); mb.box(x + 0.2, w * 1.05, z - 0.1, w * 0.7, w * 0.6, w * 0.7, greens[(greens.indexOf(g) + 2) % 5], 0, rnd(0, 3), 0); };
  for (let x = -74; x < 95; x += 3.4) for (let z = -23; z < 100; z += 3.4) {
    const tx = x + rnd(-1.2, 1.2), tz = z + rnd(-1.2, 1.2);
    if (![[0, 0], [1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3]].every(([a, b]) => inThicket(tx + a, tz + b))) continue;
    tree(tx, tz, rnd(0.25, 1), false);
    bush(tx + rnd(-1.4, 1.4), tz + rnd(-1.4, 1.4), rnd(1.2, 2.2), greens[Math.floor(rnd(0, 5))]);
  }
  for (const s of THICKET.segs) {
    const len = Math.max(s[1] - s[0], s[3] - s[2]), n = Math.ceil(len / 1.2);
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n, x = s[0] + (s[1] - s[0]) * k, z = s[2] + (s[3] - s[2]) * k;
      bush(x, z, rnd(1.4, 2.2), greens[i % 5]);
      if (i % 3 === 0) mb.box(x, 2.6, z, 0.05, rnd(1.2, 2.4), 0.05, 0x3a5a22);          // lianas colgando
    }
  }
  // franja tupida afuera del borde (tapa el vacío): dos filas alrededor
  const ring = [];
  for (let z = -60; z <= 78; z += 3) for (let k = 0; k < J.outer; k += 2.5) ring.push([-76.5 - k, z]);   // F5.13: borde x -75
  for (let z = -22; z <= 53; z += 3) for (let k = 0; k < J.outer; k += 2.5) ring.push([56.5 + k, z]);
  for (let x = -81; x <= 53; x += 3) for (let k = 0; k < J.outer; k += 2.5) ring.push([x, 75.5 + k]);
  // F5.15: alrededor del anexo del templo (oeste sobre z 74, sur, este y norte)
  for (let z = 76; z <= 104; z += 3) for (let k = 0; k < J.outer; k += 2.5) ring.push([53.5 - k, z]);
  for (let x = 57; x <= 100; x += 3) for (let k = 0; k < J.outer; k += 2.5) ring.push([x, 53.5 - k]);
  for (let z = 53; z <= 104; z += 3) for (let k = 0; k < J.outer; k += 2.5) ring.push([96.5 + k, z]);
  for (let x = 53; x <= 100; x += 3) for (let k = 0; k < J.outer; k += 2.5) ring.push([x, 101.5 + k]);
  for (const [x, z] of ring) tree(x + rnd(-1, 1), z + rnd(-1, 1), rnd(0.25, 1), false);
  // helechos, rocas y flores: solo en la jungla, sin colisión
  const TCl = CONFIG.TEMPLE.clear;
  const inJungle = (x, z) => { const r = roomAt(x, z); return r && (r.id === 'R15' || r.id === 'R17' || r.id === 'R18' || r.id === 'R20') && r.floor === 'jungle' &&
    !(x > TCl[0] && x < TCl[1] && z > TCl[2] && z < TCl[3]); };   // F5.15: + el anexo (sin tapar el templo)
  for (let n = 0, tries = 0; n < J.ferns && tries < J.ferns * 6; tries++) {
    const x = rnd(-74.5, 94.5), z = rnd(-4, 99.5);
    if (!inJungle(x, z)) continue;
    n++;
    const g = greens[n % 5], sc = rnd(0.6, 1.4);
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + rnd(0, 1); mb.box(x + Math.cos(a) * 0.4 * sc, 0.3 * sc, z + Math.sin(a) * 0.4 * sc, 0.9 * sc, 0.05, 0.3 * sc, g, 0, -a, 0.5); }
    if (n % 7 === 0) mb.box(x, 0.35, z, 0.14, 0.14, 0.14, [0xe83a5a, 0xf0c030, 0xc85af0][n % 3]);   // flor
  }
  for (let n = 0, tries = 0; n < J.rocks && tries < J.rocks * 6; tries++) {
    const x = rnd(-74, 94), z = rnd(-20, 99);
    if (!inJungle(x, z)) continue;
    n++;
    const w = rnd(0.4, 1.1);
    mb.box(x, w * 0.3, z, w, w * 0.6, w * 0.8, 0x6a6a62, 0, rnd(0, 3), 0);
    mb.box(x + 0.1, w * 0.62, z, w * 0.5, 0.04, w * 0.4, 0x4a6a2a);    // musgo
  }
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (m) { m.userData.theme = false; m.updateMatrix(); }
  // niebla verde baja (planos transparentes)
  const mist = new THREE.MeshBasicMaterial({ color: 0xcfe8c8, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  for (let n = 0, tries = 0; n < 24 && tries < 200; tries++) {
    const x = rnd(-71, 91), z = rnd(0, 96);
    if (!inJungle(x, z)) continue;
    n++;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), mist);
    p.rotation.x = -Math.PI / 2; p.position.set(x, 0.5 + rnd(0, 0.4), z); scene.add(p);
  }
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
}
function startBurn(d) {
  d.burning = true; d.burnT = CONFIG.BURN.time;
  for (const f of d.flames) f.visible = true;
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
}

//--- F5.13: el templo (solo dibujo; lo sólido va en world.js buildTempleShell). Bloques de piedra de ~1.5 m
// (así la textura no se estira) en un mesh, detalles pintados en otro, y antorchas con fuego aditivo
const TEMPLEFX = { flames: [] };
function buildTemple() {
  const T = CONFIG.TEMPLE, Y = UP.y, st = new MeshBuilder(), dt = new MeshBuilder();
  const tones = [0xffffff, 0xeae6da, 0xd6d2c4, 0xc8c4b4];
  let n = 0;
  const tone = () => tones[(n++ * 7) % 4];
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
  const P = T.top;
  block(P.x1, P.x2, 0, Y, P.z1, P.z2);
  for (const t of T.tiers) block(t[0], t[1], 0, T.tierH, t[2], t[3]);
  // F5.15: 5 escalones como Tikal: el anillo (tierH), 2 escalones que sobresalen de la base (solo dibujo: no se
  // llega), la cima y el santuario. Cornisas oscuras en cada borde
  const steps = [[1.5, T.tierH, T.tierH + (Y - T.tierH) / 3], [0.75, T.tierH + (Y - T.tierH) / 3, T.tierH + 2 * (Y - T.tierH) / 3]];
  for (const [o, y1, y2] of steps) block(P.x1 - o, P.x2 + o, y1, y2, P.z1 - o, P.z2 + o, 1.6);
  for (const [o, y] of [[3, T.tierH], [1.5, steps[0][2]], [0.75, steps[1][2]], [0, Y]]) {
    dt.box((P.x1 + P.x2) / 2, y, P.z1 - o - 0.12, P.x2 - P.x1 + 2 * o, 0.14, 0.24, 0x6a665a);
    dt.box((P.x1 + P.x2) / 2, y, P.z2 + o + 0.12, P.x2 - P.x1 + 2 * o, 0.14, 0.24, 0x6a665a);
    dt.box(P.x1 - o - 0.12, y, (P.z1 + P.z2) / 2, 0.24, 0.14, P.z2 - P.z1 + 2 * o, 0x6a665a);
    dt.box(P.x2 + o + 0.12, y, (P.z1 + P.z2) / 2, 0.24, 0.14, P.z2 - P.z1 + 2 * o, 0x6a665a);
  }
  // alfardas (muros bajos a los costados de las rampas)
  for (const R of T.ramps) {
    const L = Math.hypot(9, Y), a = Math.atan2(Y, 9);
    if (R.axis === 'z') for (const x of [R.x1 - 0.15, R.x2 + 0.15]) st.box(x, Y / 2 + 0.2, (R.z1 + R.z2) / 2, 0.3, 0.5, L, tone(), -a, 0, 0);
    else for (const z of [R.z1 - 0.15, R.z2 + 0.15]) st.box((R.x1 + R.x2) / 2, Y / 2 + 0.2, z, L, 0.5, 0.3, tone(), 0, 0, a);
  }
  // F5.15: santuario: un cuarto de piedra (paredes cortadas por las 2 puertas, sanctumWalls), dinteles, techo a
  // S.h con dos escalones y una crestería alta calada (comb), friso rojo con glifos, piso de mosaico y murales
  // adentro. El Pack-a-Punch va adentro (CONFIG.PAP.spot)
  const S = T.sanctum, sx = (S.x1 + S.x2) / 2, sz = (S.z1 + S.z2) / 2, top = Y + S.h;
  for (const w of sanctumWalls()) block(w[0], w[1], Y, top, w[2], w[3], 1.2);
  for (const [ax, line, a, b] of S.doors) {                            // dinteles sobre las puertas (a 3 m)
    const c = (a + b) / 2, L = b - a + 0.6;
    if (ax === 'z') st.box(c, Y + 3.25, line + (line === S.z1 ? S.t / 2 : -S.t / 2), L, 0.5, S.t + 0.1, 0xb8b4a4);
    else st.box(line + (line === S.x1 ? S.t / 2 : -S.t / 2), Y + 3.25, c, S.t + 0.1, 0.5, L, 0xb8b4a4);
    for (const s of [a, b]) {                                          // jambas oscuras
      if (ax === 'z') dt.box(s, Y + 1.5, line, 0.12, 3, S.t + 0.12, 0x3a3630);
      else dt.box(line, Y + 1.5, s, S.t + 0.12, 3, 0.12, 0x3a3630);
    }
  }
  block(S.x1 - 0.3, S.x2 + 0.3, top, top + 0.5, S.z1 - 0.3, S.z2 + 0.3, 1.6);      // techo en dos escalones
  block(S.x1 + 0.6, S.x2 - 0.6, top + 0.5, top + 1.0, S.z1 + 0.6, S.z2 - 0.6, 1.6);
  // crestería: muro alto y calado sobre el eje este-oeste, con escalones y huecos
  const cz0 = sz + 0.8, cTop = top + 1.0 + S.comb;
  for (let y = top + 1.0, k = 0; y < cTop - 0.01; y += 1.1, k++) {
    const wdt = (S.x2 - S.x1 - 2) * (1 - k * 0.09);
    for (let i = 0; i < 5; i++) {
      if (k % 2 && (i === 1 || i === 3)) continue;                     // calado
      st.box(sx - wdt / 2 + (i + 0.5) * wdt / 5, y + 0.55, cz0, wdt / 5 - 0.05, 1.08, 0.9, tone());
    }
  }
  for (let i = 0; i < 3; i++) {                                        // máscaras y glifos en la crestería
    const y = top + 2.2 + i * 2.2;
    dt.box(sx, y, cz0 - 0.47, 1.6 - i * 0.3, 1.0, 0.05, i % 2 ? 0xd8a838 : 0x9a2a1e);
    dt.box(sx - 0.3, y + 0.1, cz0 - 0.5, 0.25, 0.25, 0.04, 0x1a1a1a); dt.box(sx + 0.3, y + 0.1, cz0 - 0.5, 0.25, 0.25, 0.04, 0x1a1a1a);
  }
  // friso rojo y glifos por fuera, sur y oeste
  dt.box(sx, top - 0.6, S.z1 - 0.06, S.x2 - S.x1, 0.5, 0.12, 0x9a2a1e);
  dt.box(S.x1 - 0.06, top - 0.6, sz, 0.12, 0.5, S.z2 - S.z1, 0x9a2a1e);
  dt.box(S.x2 + 0.06, top - 0.6, sz, 0.12, 0.5, S.z2 - S.z1, 0x9a2a1e);
  for (let i = 0; i < 7; i++) {
    dt.box(S.x1 + 0.8 + i * 1.3, top - 0.6, S.z1 - 0.13, 0.36, 0.3, 0.04, 0xd8a838);
    dt.box(S.x1 - 0.13, top - 0.6, S.z1 + 0.8 + i * 1.3, 0.04, 0.3, 0.36, 0xd8a838);
  }
  // adentro: piso de mosaico y murales en las paredes
  for (let i = 0; i < 8; i++) for (let k = 0; k < 8; k++)
    dt.box(S.x1 + 0.9 + i * 1.1, Y + 0.02, S.z1 + 0.9 + k * 1.1, 1.05, 0.02, 1.05, (i + k) % 2 ? 0x6a5a48 : 0x8a7a5a);
  for (let i = 0; i < 4; i++) {
    dt.box(S.x1 + S.t + 0.03, Y + 2.2, S.z1 + 1.5 + i * 2, 0.04, 1.2, 1.3, i % 2 ? 0x9a2a1e : 0x2a6a5a);
    dt.box(S.x2 - S.t - 0.03, Y + 2.2, S.z1 + 1.5 + i * 2, 0.04, 1.2, 1.3, i % 2 ? 0x2a6a5a : 0x9a2a1e);
  }
  // pasto adentro del río, orillas de piedra, agua y puentes
  const R = T.river, [wx1, wx2, wz1, wz2] = R.w, [sx1, sx2, sz1, sz2] = R.s;
  for (const [x1, x2, z1, z2] of [[wx1, wx2, sz2, wz2], [sx1, sx2, sz1, sz2]]) {
    dt.box((x1 + x2) / 2, 0.015, (z1 + z2) / 2, x2 - x1, 0.01, z2 - z1, 0x3a5a4a);                  // fondo
    for (const [a, b, c, d] of x2 - x1 < z2 - z1 ? [[x1, x1 + 0.3, z1, z2], [x2 - 0.3, x2, z1, z2]] : [[x1, x2, z1, z1 + 0.3], [x1, x2, z2 - 0.3, z2]])
      st.box((a + b) / 2, 0.12, (c + d) / 2, b - a, 0.24, d - c, 0xb0ac9c);
  }
  for (const [x1, x2, z1, z2] of [[wx1 + 0.3, wx2 - 0.3, sz2, wz2], [sx1, sx2, sz1 + 0.3, sz2 - 0.3]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), waterMat(0x3a8a9a, x2 - x1, z2 - z1, 0.82));   // F7c: se mueve
    w.rotation.x = -Math.PI / 2; w.position.set((x1 + x2) / 2, 0.07, (z1 + z2) / 2);
    w.userData.theme = false; scene.add(w);
  }
  for (const [arm, c1, c2] of R.bridges) {
    const alongX = arm === 'w';                                         // el brazo oeste se cruza en x
    const [x1, x2, z1, z2] = alongX ? [wx1 - 0.4, wx2 + 0.4, c1, c2] : [c1, c2, sz1 - 0.4, sz2 + 0.4];
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const m = alongX ? (z2 - z1) : (x2 - x1);
    for (let i = 0; i < 8; i++) {                                       // tablones
      const k = (i + 0.5) / 8;
      if (alongX) dt.box(cx, 0.18, z1 + k * m, x2 - x1, 0.08, m / 8 - 0.05, i % 2 ? 0x7a5634 : 0x6a4a2c);
      else dt.box(x1 + k * m, 0.18, cz, m / 8 - 0.05, 0.08, z2 - z1, i % 2 ? 0x7a5634 : 0x6a4a2c);
    }
    for (const c of [c1, c2]) {                                         // barandas de soga y postes
      if (alongX) { dt.box(cx, 0.9, c, x2 - x1, 0.06, 0.06, 0xb89a6a); for (const x of [x1, x2]) dt.box(x, 0.55, c, 0.14, 1.1, 0.14, 0x5a4028); }
      else { dt.box(c, 0.9, cz, 0.06, 0.06, z2 - z1, 0xb89a6a); for (const z of [z1, z2]) dt.box(c, 0.55, z, 0.14, 1.1, 0.14, 0x5a4028); }
    }
  }
  // antorchas: arriba de cada rampa y al pie
  const torches = [];
  for (const Rm of T.ramps) {
    const [bx, bz] = Rm.bottom, [tx, tz] = Rm.top;
    if (Rm.axis === 'z') torches.push([Rm.x1 - 0.5, bz + 0.6, 0], [Rm.x2 + 0.5, bz + 0.6, 0], [Rm.x1 - 0.1, tz + 0.4, Y], [Rm.x2 + 0.1, tz + 0.4, Y]);
    else torches.push([bx + 0.6, Rm.z1 - 0.5, 0], [bx + 0.6, Rm.z2 + 0.5, 0], [tx + 0.4, Rm.z1 - 0.1, Y], [tx + 0.4, Rm.z2 + 0.1, Y]);
  }
  const fmat = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,230,140,1)', 'rgba(255,100,10,0.5)'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const fgeo = new THREE.PlaneGeometry(0.5, 0.8);
  for (const [x, z, y] of torches) {
    dt.box(x, y + 0.6, z, 0.12, 1.2, 0.12, 0x4a3420);
    dt.box(x, y + 1.25, z, 0.3, 0.14, 0.3, 0x3a3a38);
    for (const r of [0, Math.PI / 2]) {
      const f = new THREE.Mesh(fgeo, fmat); f.position.set(x, y + 1.62, z); f.rotation.y = r;
      f.userData.theme = false; scene.add(f); TEMPLEFX.flames.push(f);
    }
  }
  const sm = st.mesh(new THREE.MeshLambertMaterial({ map: TEX.stone, vertexColors: true }));
  if (sm) { sm.userData.theme = false; sm.updateMatrix(); }
  const dm = dt.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (dm) { dm.userData.theme = false; dm.updateMatrix(); }
}
function updateTemple(t) {
  TEMPLEFX.flames.forEach((f, i) => { const k = 0.85 + 0.25 * Math.abs(Math.sin(t * 11 + i * 1.7)); f.scale.set(1, k, 1); });
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
    c.font = 'bold ' + Math.floor(s * 0.2) + 'px monospace'; c.fillText('SALVA', s / 2, s * 0.42);
    c.fillText('VIDAS', s / 2, s * 0.68);
  }, 1, 128);
  tex.magFilter = THREE.LinearFilter;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), new THREE.MeshLambertMaterial({ map: tex }));
  sign.position.set(L.x - 0.2, H + 1.75, L.z + (D - 1.2) / 2 + 0.06); scene.add(sign);
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
function buildBeachDecor() {
  const B = CONFIG.DECOR.beach, mb = new MeshBuilder();
  let s = 777; const r = (a, b) => { s = (s * 16807) % 2147483647; return a + (b - a) * s / 2147483647; };
  for (const [x, z, rot, col] of B.towels) {                           // toalla a rayas
    mb.box(x, 0.012, z, 0.9, 0.02, 1.8, col, 0, rot, 0);
    for (let k = -1; k <= 1; k += 2) mb.box(x + Math.sin(rot) * k * 0.6, 0.015, z + Math.cos(rot) * k * 0.6, 0.9, 0.02, 0.12, 0xf0ece0, 0, rot, 0);
  }
  for (const [x, z, col] of B.umbrellas) {                             // sombrilla: palo y gajos
    mb.box(x, 1.1, z, 0.05, 2.2, 0.05, 0xe8e0d0, 0.08, 0, 0.05);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      mb.box(x + Math.sin(a) * 0.55, 2.12, z + Math.cos(a) * 0.55, 0.62, 0.03, 1.1, i % 2 ? col : 0xf8f4ea, -0.3, a, 0);
    }
  }
  { const [x, z] = B.castle;                                           // castillo de arena con 4 torres y bandera
    mb.box(x, 0.18, z, 1.0, 0.36, 1.0, 0xc8a878);
    for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
      mb.box(x + dx, 0.36, z + dz, 0.3, 0.72, 0.3, 0xbfa070);
      for (let k = 0; k < 2; k++) mb.box(x + dx + (k ? 0.1 : -0.1), 0.76, z + dz, 0.08, 0.08, 0.08, 0xbfa070);
    }
    mb.box(x, 0.5, z, 0.4, 0.3, 0.4, 0xc8a878);
    mb.box(x, 0.9, z, 0.02, 0.5, 0.02, 0x6a5040); mb.box(x + 0.1, 1.08, z, 0.18, 0.12, 0.01, 0xd8322a);
    mb.box(x - 0.9, 0.09, z + 0.3, 0.3, 0.18, 0.28, 0xe8c030); mb.box(x - 0.9, 0.24, z + 0.3, 0.02, 0.2, 0.02, 0x3a3a3a);   // balde
  }
  { const [x, z] = B.cooler; mb.box(x, 0.22, z, 0.6, 0.44, 0.4, 0x3a8ad8); mb.box(x, 0.46, z, 0.62, 0.06, 0.42, 0xf0f0f0);
    mb.box(x, 0.5, z, 0.4, 0.03, 0.05, 0x2a2a2a); }
  { const [x, z] = B.ball;                                             // pelota: gajos de colores
    [0xd8322a, 0xf0f0f0, 0x3a8ad8, 0xf0c030].forEach((c, i) => mb.box(x, 0.2, z, 0.38, 0.38, 0.1, c, 0, i * Math.PI / 4, 0)); }
  { const [x, z] = B.radio; mb.box(x, 0.16, z, 0.5, 0.3, 0.16, 0x2a2a2e); mb.box(x - 0.12, 0.16, z + 0.085, 0.16, 0.16, 0.01, 0x8a8a8a);
    mb.box(x + 0.12, 0.16, z + 0.085, 0.16, 0.16, 0.01, 0x8a8a8a); mb.box(x + 0.2, 0.45, z, 0.02, 0.3, 0.02, 0xbababa, 0, 0, -0.4); }
  for (const [x, z, rot] of B.logs) {                                  // troncos que trajo el mar
    mb.box(x, 0.16, z, 2.4, 0.3, 0.32, 0x8a7a64, 0, rot, 0.05);
    mb.box(x + Math.cos(rot) * 0.9, 0.3, z - Math.sin(rot) * 0.9, 0.5, 0.08, 0.08, 0x7a6a54, 0, rot + 0.8, 0.4);
  }
  const [zs1, zs2] = B.shoreZ;
  for (let i = 0; i < B.seaweed; i++) {                                // algas en la orilla
    const x = r(-19, 19), z = r(zs1, zs2);
    for (let k = 0; k < 4; k++) mb.box(x + r(-0.4, 0.4), 0.02, z + r(-0.3, 0.3), r(0.3, 0.7), 0.02, 0.08, k % 2 ? 0x2a4a2a : 0x3a5a2a, 0, r(0, 3), 0);
  }
  for (let i = 0; i < B.shells; i++) {                                 // conchas y estrellas de mar
    const x = r(-19, 19), z = r(zs1 - 0.2, -8);
    if (i % 4 === 0) for (let k = 0; k < 5; k++) mb.box(x + Math.sin(k * 1.26) * 0.08, 0.02, z + Math.cos(k * 1.26) * 0.08, 0.05, 0.02, 0.16, 0xe8784a, 0, k * 1.26, 0);
    else mb.box(x, 0.02, z, 0.1, 0.03, 0.08, [0xf0e8d8, 0xe8c8b0, 0xd8b8d8][i % 3], 0, r(0, 3), 0);
  }
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (m) { m.userData.theme = false; m.updateMatrix(); }
  // cangrejos: un pool fijo; caminan de costado por la orilla
  for (let i = 0; i < B.crabs; i++) {
    const g = new THREE.Group(), cb = new MeshBuilder();
    cb.box(0, 0.08, 0, 0.26, 0.09, 0.2, 0xd8482a);
    for (const sx of [-1, 1]) {
      for (let k = -1; k <= 1; k++) cb.box(sx * 0.17, 0.05, k * 0.07, 0.12, 0.02, 0.02, 0xb8382a, 0, 0, sx * 0.5);   // patas
      cb.box(sx * 0.12, 0.1, 0.15, 0.07, 0.06, 0.08, 0xe8583a);                                                   // pinzas
      cb.box(sx * 0.05, 0.15, 0.08, 0.02, 0.05, 0.02, 0x1a1a1a);                                                  // ojos
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

function buildGarden() {
  buildFountain();
  buildPoolWater();                                                // F7c
  buildBeachDecor();                                               // F7c
  buildLifeguard();                                                // F5.13
  buildTemple();                                                   // F5.13
  buildJungle();                                                   // F5.12
  buildBurns();                                                    // F5.12
  buildRancho();                                                   // F5.10
  buildGardenDecor();                                              // F5.11
  buildPiranhas();
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
  updateAcid(dt);                                                  // F5.8
  const G = CONFIG.GARDEN, P = player.pos, onGround = playerLevel() === 0, t = clock.elapsedTime;   // F5.16: las plantas están en el piso
  updateTemple(t);                                                 // F5.13: antorchas
  updateBeach(dt, t);                                              // F7c: agua que se mueve y cangrejos
  if (RANCHO.bulbs) RANCHO.bulbs.material.color.setRGB(1, 0.8 + 0.08 * Math.sin(t * 3), 0.5 + 0.08 * Math.sin(t * 3));   // F5.10
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
      spitAcid(p.x, p.head.position.y, p.z, 0);
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
  for (const p of PLANTS) p.spitT = randIn(CONFIG.GARDEN.acid.plantEvery);
  for (const p of PLANTS) { p.fed = 0; p.eatT = 0; plantAlien(p, false); p.prey = null; p.head.position.copy(p.base);
    p.head.rotation.x = p.head.rotation.z = 0; p.open = 0; p.cd = 0; p.warned = false; p.head.rotation.y = 0; p.top.rotation.x = 0; p.bot.rotation.x = 0; }
}
