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
  const R = CONFIG.RANCHO, P = R.palapa;
  // wd: troncos y bambú (corteza) · lf: hojas y flecos (FOLI) · rk: rocas y huesos · th/tu: paja arriba/abajo · mb: resto
  const wd = new MeshBuilder(), lf = new MeshBuilder(), rk = new MeshBuilder(), th = new MeshBuilder(), tu = new MeshBuilder(), mb = new MeshBuilder();
  const log = 0xa88a66, logD = 0x7a5a3a, rope = 0xd8b878, plank = [0x9a7048, 0x8a6440, 0xa87a50], felt = 0x1f6a3a, dark = 0x4a321e;
  const cx = (P.x1 + P.x2) / 2, cz = (P.z1 + P.z2) / 2, W = P.x2 - P.x1, D = P.z2 - P.z1, H = P.h;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // quad con la normal hacia afuera de `c` (así no hay que pensar el orden de las esquinas)
  const quadOut = (B, a, b, cc, d, c, color, uw, vh) => {
    const n = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(V(d[0] - a[0], d[1] - a[1], d[2] - a[2]));
    const m = V((a[0] + b[0] + cc[0] + d[0]) / 4 - c[0], (a[1] + b[1] + cc[1] + d[1]) / 4 - c[1], (a[2] + b[2] + cc[2] + d[2]) / 4 - c[2]);
    const uv = [[0, 0], [uw, 0], [uw, vh], [0, vh]];
    if (n.dot(m) < 0) B.quad(a, d, cc, b, [uv[0], uv[3], uv[2], uv[1]], color); else B.quad(a, b, cc, d, uv, color);
  };
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
  // techo de paja a 4 aguas: 5 capas que se solapan, cada una con flecos colgando del borde
  const S0 = W / 2 + ov + 0.15, below = [cx, H - 5, cz], above = [cx, yT + 5, cz], N = 5;
  for (let k = 0; k < N; k++) {
    const t0 = k / N, t1 = Math.min(1, (k + 1.35) / N), s0 = S0 * (1 - t0) + 0.12, s1 = S0 * (1 - t1);
    const y0 = H + 0.05 + (yT - H - 0.05) * t0 - 0.12, y1 = H + 0.05 + (yT - H - 0.05) * t1;
    const pts = s => [[cx - s, cz - s], [cx + s, cz - s], [cx + s, cz + s], [cx - s, cz + s]];
    const p0 = pts(s0), p1 = pts(s1), slope = Math.hypot(s0 - s1, y1 - y0);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, A = [p0[i][0], y0, p0[i][1]], B = [p0[j][0], y0, p0[j][1]], Cc = [p1[j][0], y1, p1[j][1]], Dd = [p1[i][0], y1, p1[i][1]];
      const tone = [0xffffff, 0xf0e4d0, 0xe4d6bc][(k + i) % 3];
      quadOut(th, A, B, Cc, Dd, below, tone, s0 * 2 / 1.6, slope / 1.2);
      const dn = 0.14;                                                 // por debajo, apenas más bajo
      quadOut(tu, [A[0], A[1] - dn, A[2]], [B[0], B[1] - dn, B[2]], [Cc[0], Cc[1] - dn, Cc[2]], [Dd[0], Dd[1] - dn, Dd[2]], above, 0x8a7458, s0 * 2 / 1.6, slope / 1.2);
      const L = Math.hypot(B[0] - A[0], B[2] - A[2]), n = Math.ceil(L / 0.55), ry = Math.atan2(B[0] - A[0], B[2] - A[2]) + Math.PI / 2;
      if (k === 0) for (let q = 0; q < n; q++) {                         // flecos del borde de afuera (los de arriba asomaban por debajo)
        const f = (q + 0.5) / n, len = 0.45 + ((q * 7 + k) % 5) * 0.06;
        lf.card(A[0] + (B[0] - A[0]) * f, y0 - len + 0.04, A[2] + (B[2] - A[2]) * f, 0.62, len, 0, ry, 0, 'thatch', 0xffffff);
      }
    }
  }
  th.sphere(cx, yT, cz, 0.35, 0.3, 0.35, 0xc8a868, 8);                // moño de la punta
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
  quadOut(th, [rx1 - 0.4, ay0, az0], [rx2 + 0.4, ay0, az0], [rx2 + 0.4, ay1, az1], [rx1 - 0.4, ay1, az1], [rcx, 0, 0], 0xffffff, rl / 1.6, 1.4);
  quadOut(tu, [rx1 - 0.4, ay0 - 0.1, az0], [rx2 + 0.4, ay0 - 0.1, az0], [rx2 + 0.4, ay1 - 0.1, az1], [rx1 - 0.4, ay1 - 0.1, az1], [rcx, 9, 40], 0x8a7458, rl / 1.6, 1.4);
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
  const hx = -51, hz = 34.8, hL = 2.9;
  for (const sx of [-1, 1]) { wd.cyl(hx + sx * 1.65, 0, hz, 0.1, 1.9, log, 0.85, 8); wd.seg([hx + sx * 1.62, 1.45, hz], [hx + sx * hL / 2, 0.95, hz], 0.012, 0.012, rope, 4); }
  for (let i = 0; i < 12; i++) {
    const u0 = -1 + i / 6, u1 = u0 + 1 / 6, y0 = 0.55 + 0.4 * u0 * u0, y1 = 0.55 + 0.4 * u1 * u1;
    const x0 = hx + u0 * hL / 2, x1 = hx + u1 * hL / 2, ang = Math.atan2(y1 - y0, x1 - x0);
    mb.box((x0 + x1) / 2, (y0 + y1) / 2, hz, Math.hypot(x1 - x0, y1 - y0) + 0.01, 0.03, 0.95, [0xe0503a, 0xf0c040, 0x3a8ac8][i % 3], 0, 0, ang);
  }
  // antorchas tiki: flanquean la entrada del sendero (este), el bar y el paso al tortugario
  const fmat = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,230,140,1)', 'rgba(255,100,10,0.5)'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const fgeo = new THREE.PlaneGeometry(0.42, 0.7);
  for (const [x, z] of [[-42.6, 25.3], [-42.6, 31.7], [rx1 - 0.2, rz2 + 1.8], [rx2 + 0.2, rz2 + 1.8], [-55.6, 23], [-55.6, 36.2]]) {
    wd.cyl(x, 0, z, 0.045, 1.9, 0xc8b070, 0.9, 6);
    wd.cyl(x, 1.9, z, 0.08, 0.22, 0x5a3a20, 1.5, 8);
    for (const r of [0, Math.PI / 2]) {
      const f = new THREE.Mesh(fgeo, fmat); f.position.set(x, 2.42, z); f.rotation.y = r;
      f.userData.theme = false; scene.add(f); TEMPLEFX.flames.push(f);
    }
  }
  // arco de entrada al final del sendero del lazo (x -42) con el cartel colgando
  const gx = -42.3, gz1 = 25.9, gz2 = 31.1;
  for (const z of [gz1, gz2]) { wd.cyl(gx, 0, z, 0.16, 3.4, log, 0.85, 8); wd.cyl(gx, 3.0, z, 0.17, 0.1, rope, 1, 8); }
  wd.seg([gx, 3.25, gz1 - 0.4], [gx, 3.25, gz2 + 0.4], 0.13, 0.13, logD, 8);
  for (const z of [(gz1 + gz2) / 2 - 0.9, (gz1 + gz2) / 2 + 0.9]) wd.seg([gx, 3.2, z], [gx, 2.72, z], 0.01, 0.01, rope, 4);
  mb.box(gx, 2.45, (gz1 + gz2) / 2, 0.08, 0.6, 2.3, 0x8a6a3a);
  for (let q = 0; q < 10; q++) lf.card(gx, 3.05, gz1 - 0.3 + (gz2 - gz1 + 0.6) * (q + 0.5) / 10, 0.5, 0.6, 0, Math.PI / 2, 0, 'vine', 0xffffff);
  // tablas de surf contra la espesura del este y red con boyas en la esquina SO
  [[33.4, 0xe86a3a], [34.3, 0x3aa0d8], [35.2, 0xf0e0a0], [36.1, 0x5ab86a]].forEach(([z, c], i) => {
    mb.sphere(-42.75, 1.05, z, 0.05, 1.05, 0.3, c, 10, 0, 0, 0.14 + i * 0.02);
    mb.box(-42.72, 1.05, z, 0.02, 1.9, 0.05, 0xf0ead8, 0, 0, 0.14 + i * 0.02);
  });
  wd.seg([-42.55, 0.3, 32.8], [-42.55, 0.3, 36.7], 0.06, 0.06, logD, 6);
  for (const z of [19.2, 21.6]) wd.cyl(-55.6, 0, z, 0.07, 2.2, log, 0.85, 7);
  for (let i = 0; i < 7; i++) wd.seg([-55.6, 0.5, 19.2 + i * 0.4], [-55.6, 2.0, 19.2 + i * 0.4], 0.006, 0.006, 0x8a7a5a, 3);
  for (let j = 0; j < 5; j++) wd.seg([-55.6, 0.55 + j * 0.35, 19.2], [-55.6, 0.55 + j * 0.35, 21.6], 0.006, 0.006, 0x8a7a5a, 3);
  [[19.8, 1.5, 0xe84a2a], [20.6, 1.1, 0xf0c030], [21.2, 1.8, 0xe84a2a]].forEach(([z, y, c]) => mb.sphere(-55.5, y, z, 0.13, 0.13, 0.13, c, 8));
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
  [[-58, 20], [-59.5, 23], [-57.5, 38.3], [-62, 20.5]].forEach(([x, z], i) => {   // nidos rotos con huevos y cáscaras
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
  wd.cyl(-57, 0, 30, 0.05, 2.0, logD, 0.9, 6);                                              // poste del cartel
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
  sign('RANCHO', 'DON MARENA', cx, P.h - 0.35, P.z1 - 0.14, Math.PI, 1.8);
  sign('RANCHO', 'DON MARENA', gx - 0.05, 2.45, (gz1 + gz2) / 2, Math.PI / 2, 2.1);
  sign('TIKI BAR', 'OPEN 24/7', rcx, ay1 - 0.15, az1 + 0.02, 0, 1.4);
  sign('TURTLE PEN', 'DO NOT DISTURB', -57, 1.85, 30.06, 0, 1.2);
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
function buildJungle() {
  const J = CONFIG.JUNGLE, C = new ChunkMB(32), CL = new ChunkMB(32), CR = new ChunkMB(32);   // corteza, hojas, rocas
  let s = J.seed * 31 + 5;
  const rnd = (a, b) => { s = (s * 16807) % 2147483647; return a + (b - a) * s / 2147483647; };
  const bark = [0x8a7058, 0x7a6048, 0x6a5440, 0x9a7e62], leafT = [0xffffff, 0xe0ecd0, 0xc8dab8, 0xf0f8e0, 0xb8cca8];
  const palmJ = (x, z, big) => {                                      // palmera de jungla, arqueada
    const B = C.at(x, z), L = CL.at(x, z), h = 5 + big * 10, dir = rnd(0, 6.28), bend = rnd(0.6, 1.6), pts = [];
    for (let i = 0; i <= 4; i++) { const k = i / 4; pts.push([x + Math.cos(dir) * bend * k * k * 1.5, h * k, z + Math.sin(dir) * bend * k * k * 1.5]); }
    B.tube(pts, 0.24, 0.15, 0x8a7a60, 6, 7);
    const t = pts[4], R = FOLI.r.palm, um = (R[0] + R[2]) / 2;
    B.sphere(t[0], t[1], t[2], 0.3, 0.25, 0.3, 0x5a4a34, 6);
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * 6.28 + rnd(0, 0.5), len = rnd(2.4, 3.3), l1 = len * 0.45, up = -0.3;
      const ex = t[0] + Math.cos(up) * l1 * Math.cos(a), ey = t[1] - Math.sin(up) * l1, ez = t[2] - Math.cos(up) * l1 * Math.sin(a);
      L.frond(t[0], t[1], t[2], l1, 1, a, up, null, 0xe8f0d0, [R[0], R[1], um, R[3]]);
      L.frond(ex, ey, ez, len - l1, 0.9, a, rnd(0.5, 0.95), null, 0xe8f0d0, [um, R[1], R[2], R[3]]);
    }
  };
  // árbol de hoja ancha: tronco curvo, raíces tablares, 3-4 ramas con una mata cada una y otra arriba
  const tree = (x, z, big, full) => {
    if (big < 0.3) return palmJ(x, z, big);
    const B = C.at(x, z), L = CL.at(x, z), h = 5.5 + big * 3.5, r0 = 0.3 + big * 0.1;
    const lean = rnd(0, 0.22), dir = rnd(0, 6.28), pts = [];
    for (let i = 0; i <= 3; i++) { const k = i / 3; pts.push([x + Math.cos(dir) * lean * h * k * k, h * k, z + Math.sin(dir) * lean * h * k * k]); }
    B.tube(pts, r0, r0 * 0.5, bark[Math.floor(big * 7) % 4], 5, 7);
    for (let k = 0; k < 4; k++) {
      const a = k * 1.57 + rnd(0, 0.8);
      B.seg([x + Math.cos(a) * r0 * 0.4, 0.8 + big * 0.5, z + Math.sin(a) * r0 * 0.4],
            [x + Math.cos(a) * (r0 + 0.8), -0.05, z + Math.sin(a) * (r0 + 0.8)], 0.17, 0.05, 0x6a5440, 5);
    }
    const top = pts[3], nb = full ? 4 : 3;
    for (let k = 0; k < nb; k++) {
      const a = k / nb * 6.28 + rnd(0, 1), len = 1.4 + big * 1.4;
      const e = [top[0] + Math.cos(a) * len, top[1] - 0.2 + rnd(0, 1.2), top[2] + Math.sin(a) * len], w = 2.6 + big * 1.6;
      B.seg([top[0], top[1] - 1.4, top[2]], e, 0.12, 0.05, bark[k % 4], 5);
      L.clump(e[0], e[1] - w * 0.4, e[2], w, w * 0.8, 'leaf', leafT[k % 5], rnd(0, 3), true);
      if (full && k % 2 === 0) { const vl = 2 + rnd(0, 2.5); L.card(e[0], e[1] - vl, e[2], 0.5, vl, 0, rnd(0, 3), 0, 'vine', 0xffffff); }
    }
    const w = 3.2 + big * 2;
    L.clump(top[0], top[1] - 0.2, top[2], w, w * 0.75, 'leaf', leafT[Math.floor(big * 9) % 5], rnd(0, 3), true);
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
  for (let x = -74; x < 95; x += 3.4) for (let z = -23; z < 100; z += 3.4) {
    const tx = x + rnd(-1.2, 1.2), tz = z + rnd(-1.2, 1.2);
    if (![[0, 0], [1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3]].every(([a, b]) => inThicket(tx + a, tz + b))) continue;
    tree(tx, tz, rnd(0.25, 1), false);
    bush(tx + rnd(-1.4, 1.4), tz + rnd(-1.4, 1.4), rnd(1.4, 2.4), nb++);
  }
  // una hilera de arbustos sobre cada pared de vegetación, del lado de la espesura (su cara = la de la pared)
  for (const sg of THICKET.segs) {
    const horiz = sg[1] - sg[0] > sg[3] - sg[2], len = horiz ? sg[1] - sg[0] : sg[3] - sg[2], n = Math.ceil(len / 1.3);
    const xm = (sg[0] + sg[1]) / 2, zm = (sg[2] + sg[3]) / 2;
    const sd = horiz ? (inThicket(xm, sg[3] + 0.6) ? 1 : -1) : (inThicket(sg[1] + 0.6, zm) ? 1 : -1);
    const face = horiz ? (sd > 0 ? sg[2] : sg[3]) : (sd > 0 ? sg[0] : sg[1]);
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n, w = rnd(1.5, 2.3), off = face + sd * w * 0.42;
      const x = horiz ? sg[0] + (sg[1] - sg[0]) * k : off, z = horiz ? off : sg[2] + (sg[3] - sg[2]) * k;
      bush(x, z, w, i);
      if (i % 3 === 0) { const vl = rnd(1.2, 2.4); CL.at(x, z).card(x, 3 - vl, z, 0.5, vl, 0, rnd(0, 3), 0, 'vine', 0xffffff); }
      const fx = horiz ? x + rnd(-0.4, 0.4) : face - sd * 0.2, fz = horiz ? face - sd * 0.2 : z + rnd(-0.4, 0.4), fr = roomAt(fx, fz);
      if (i % 2 === 0 && fr && /jungle|grass|sand/.test(fr.floor)) fern(fx, fz, rnd(0.5, 0.8));   // no al pie de la pared de la piscina
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
  // F5.17: alrededor de la espesura del patio del caparazón (x -75..-20, z 74..98)
  for (let x = -81; x <= -18; x += 3) for (let k = 0; k < J.outer; k += 2.5) ring.push([x, 99.5 + k]);
  for (let z = 79; z <= 100; z += 3) for (let k = 0; k < J.outer; k += 2.5) ring.push([-76.5 - k, z]);
  for (let z = 74; z <= 100; z += 3) for (let k = 0; k < J.outer; k += 2.5) ring.push([-18.5 + k, z]);
  for (const [x, z] of ring) {
    const tx = x + rnd(-1, 1), tz = z + rnd(-1, 1), big = rnd(0.3, 1);
    if (roomAt(tx, tz) || inThicket(tx, tz)) continue;              // F5.17: la fila de afuera nunca adentro del mapa
    tree(tx, tz, big, false);
  }
  // helechos, pasto, flores y rocas con musgo: solo en la jungla caminable, sin colisión
  const TCl = CONFIG.TEMPLE.clear;
  const inJungle = (x, z) => { const r = roomAt(x, z); return r && (r.id === 'R15' || r.id === 'R17' || r.id === 'R20') && r.floor === 'jungle' &&
    !(x > TCl[0] && x < TCl[1] && z > TCl[2] && z < TCl[3]); };   // F5.15: + el anexo (sin tapar el templo)
  for (let n = 0, tries = 0; n < J.ferns && tries < J.ferns * 6; tries++) {
    const x = rnd(-74.5, 94.5), z = rnd(-4, 99.5);
    if (!inJungle(x, z)) continue;
    n++;
    fern(x, z, rnd(0.6, 1.3));
    if (n % 5 === 0) CL.at(x, z).clump(x + 0.4, 0, z, 0.7, 0.7, 'flower', 0xffffff, rnd(0, 3));
  }
  for (let n = 0, tries = 0; n < J.ferns * 3 && tries < J.ferns * 18; tries++) {   // matas de pasto
    const x = rnd(-74.5, 94.5), z = rnd(-4, 99.5);
    if (!inJungle(x, z)) continue;
    n++;
    CL.at(x, z).clump(x, -0.02, z, rnd(0.6, 1.0), rnd(0.45, 0.8), 'grass', leafT[n % 5], rnd(0, 3));
  }
  for (let n = 0, tries = 0; n < J.rocks && tries < J.rocks * 6; tries++) {
    const x = rnd(-74, 94), z = rnd(-20, 99);
    if (!inJungle(x, z)) continue;
    n++;
    const w = rnd(0.4, 1.1), R = CR.at(x, z);
    R.rock(x, w * 0.22, z, w, w * 0.62, w * 0.82, [0x8a8a80, 0x7a7a70, 0x9a968a][n % 3], n, 0, rnd(0, 3), 0);
    R.blob(x + 0.05, w * 0.55, z, w * 0.62, w * 0.16, w * 0.5, 0x4a6a2a, n);           // musgo
  }
  // F5.17b (Diego: "en los bosques deja el piso verde, ahorita es arena"): pasto oscuro debajo de la espesura y de la
  // franja de afuera. Justo debajo del piso de los cuartos (que lo tapan); UV en metros, así los tramos que se pisan
  // quedan iguales y no titilan
  const gf = new MeshBuilder(), q = (x1, x2, z1, z2) => gf.quad([x1, -0.012, z2], [x2, -0.012, z2], [x2, -0.012, z1], [x1, -0.012, z1],
    [[x1 / 3, -z2 / 3], [x2 / 3, -z2 / 3], [x2 / 3, -z1 / 3], [x1 / 3, -z1 / 3]], 0xffffff);
  for (const r of CONFIG.THICKET) q(r[0], r[1], r[2], r[3]);
  q(-95, 115, 74, 120); q(-95, -75, -24, 74); q(55, 115, -24, 55); q(95, 115, 55, 74);
  const gm = gf.mesh(new THREE.MeshLambertMaterial({ map: TEX.grass, color: 0x5a7446 }));
  if (gm) { gm.userData.theme = false; gm.updateMatrix(); }
  for (const m of C.meshes(MAT.bark)) m.updateMatrix();
  for (const m of CL.meshes(FOLI.mat)) m.updateMatrix();
  for (const m of CR.meshes(MAT.rock)) m.updateMatrix();
  // niebla verde baja (planos transparentes)
  const mist = new THREE.MeshBasicMaterial({ map: radialTex('rgba(215,235,205,1)', 'rgba(215,235,205,.45)'), transparent: true, opacity: 0.16,
    depthWrite: false, side: THREE.DoubleSide });                   // F5.17: con bordes suaves (antes se veía el cuadrado)
  for (let n = 0, tries = 0; n < 24 && tries < 200; tries++) {
    const x = rnd(-71, 91), z = rnd(0, 96);
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
  const lf = new MeshBuilder(), rk = new MeshBuilder(), wd = new MeshBuilder(), mb = new MeshBuilder(), bl = new MeshBuilder(), hl = new MeshBuilder(), rr = mulberry(88);
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
    for (let q = 0; q < 6; q++) lf.card(x, 0.55, z, 0.7, 1.2 + rr() * 0.4, (rr() - 0.5) * 0.7, q * 1.05, (rr() - 0.5) * 0.7, 'bigleaf', 0xffffff);
  }
  // 7) hiedra que trepa por las paredes de la casa que dan a los jardines (planos pegados a la cara)
  const ivy = (x1, z1, x2, z2, ry, n) => {
    for (let k = 0; k < n; k++) {
      const f = rr(), x = x1 + (x2 - x1) * f, z = z1 + (z2 - z1) * f, y = 0.4 + Math.pow(rr(), 1.6) * 2.8, w = 1.0 + rr() * 1.0;
      if (!free(x, z, 1.5)) continue;
      lf.add(UNIT_PLANE, x, y, z, w, w, 1, 0, ry, (rr() - 0.5) * 0.6, leafT[k % 5], FOLI.r.ivy);
    }
  };
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

//--- F5.17 (Diego: "el templo está muy básico"): raíces gigantes que bajan por la pirámide (como Ta Prohm), hiedra y
// lianas, bloques caídos, cabezas colosales de piedra a los lados del puente sur, estelas talladas, cabezas de
// serpiente al pie de las rampas, juncos y nenúfares en el río
function buildTempleDress() {
  const T = CONFIG.TEMPLE, P = T.top, Y = UP.y, S = T.sanctum, rr = mulberry(99);
  const wd = new MeshBuilder(), lf = new MeshBuilder(), st = new MeshBuilder(), rk = new MeshBuilder(), gl = new MeshBuilder();
  const leafT = [0xffffff, 0xe0ecd0, 0xc8dab8, 0xf0f8e0, 0xb8cca8];
  const y2 = T.tierH + 2 * (Y - T.tierH) / 3, y1 = T.tierH + (Y - T.tierH) / 3;
  // perfil de la pirámide hacia afuera desde el borde de la cima: [cuánto afuera, alto]
  const prof = [[-0.4, Y + 0.2], [0.15, Y + 0.05], [0.9, y2 + 0.06], [1.65, y1 + 0.06], [3.15, T.tierH + 0.06], [3.6, 0.9], [4.4, 0.05], [5.2, -0.1]];
  const onRamp = (side, a) => (side === 's' && a > 82.3 && a < 87.7) || (side === 'w' && a > 87.3 && a < 92.7);
  for (let k = 0; k < 16; k++) {
    const side = ['s', 'n', 'e', 'w'][k % 4], a = side === 's' || side === 'n' ? P.x1 + 1 + rr() * (P.x2 - P.x1 - 2) : P.z1 + 1 + rr() * (P.z2 - P.z1 - 2);
    if (onRamp(side, a)) continue;
    if ((side === 'n' || side === 'e') && rr() < 0.4) continue;       // atrás casi no se ve
    const pt = ([o, y]) => side === 's' ? [a + Math.sin(o * 1.3 + k) * 0.25, y, P.z1 - o] : side === 'n' ? [a, y, P.z2 + o]
                        : side === 'w' ? [P.x1 - o, y, a + Math.sin(o * 1.3 + k) * 0.25] : [P.x2 + o, y, a];
    const pts = prof.map(pt), r0 = 0.3 + rr() * 0.12;
    wd.tube(pts, r0, 0.1, [0x7a6450, 0x6a5440, 0x8a7258][k % 3], 22, 7);
    if (k % 2 === 0) {                                                // raíz que se abre en dos al pie
      const e = pts[pts.length - 2], sd = rr() < 0.5 ? -1 : 1;
      wd.tube([e, [e[0] + (side === 'w' || side === 'e' ? 0.6 : sd * 1.2), 0.1, e[2] + (side === 's' || side === 'n' ? -0.6 : sd * 1.2)]], 0.14, 0.05, 0x6a5440, 5, 6);
    }
    for (let q = 1; q < 5; q++) { const p = pts[q]; lf.clump(p[0], p[1] - 0.3, p[2], 0.9, 0.7, q % 2 ? 'ivy' : 'fern', leafT[q % 5], rr() * 3); }
  }
  // hiedra en las caras de los escalones y lianas colgando de las cornisas y el santuario
  for (let k = 0; k < 60; k++) {
    const side = k % 4, o = [0, 0.75, 1.5, 3][Math.floor(rr() * 4)], yTop = o === 0 ? Y : o === 0.75 ? y2 : o === 1.5 ? y1 : T.tierH;
    const a = rr(), w = 0.9 + rr() * 1.2, y = yTop - 0.2 - rr() * 1.0;
    let x, z, ry;
    if (side === 0) { x = P.x1 - o + a * (P.x2 - P.x1 + 2 * o); z = P.z1 - o - 0.04; ry = Math.PI; if (x > 82.3 && x < 87.7) continue; }
    else if (side === 1) { x = P.x1 - o - 0.04; z = P.z1 - o + a * (P.z2 - P.z1 + 2 * o); ry = -Math.PI / 2; if (z > 87.3 && z < 92.7) continue; }
    else if (side === 2) { x = P.x2 + o + 0.04; z = P.z1 - o + a * (P.z2 - P.z1 + 2 * o); ry = Math.PI / 2; }
    else { x = P.x1 - o + a * (P.x2 - P.x1 + 2 * o); z = P.z2 + o + 0.04; ry = 0; }
    lf.add(UNIT_PLANE, x, Math.max(w / 2 - 0.1, y), z, w, w, 1, 0, ry, (rr() - 0.5) * 0.5, leafT[k % 5], FOLI.r.ivy);
    if (k % 3 === 0) { const L = 0.8 + rr() * 1.6; lf.card(x, yTop - L, z, 0.45, L, 0, ry, 0, k % 2 ? 'vine' : 'moss', 0xffffff); }
  }
  const top = Y + S.h;
  for (let k = 0; k < 18; k++) {                                     // del techo del santuario
    const side = k % 3, f = rr(), L = 1.0 + rr() * 2.4;
    const x = side === 0 ? S.x1 + f * (S.x2 - S.x1) : S.x1 - 0.35, z = side === 0 ? S.z1 - 0.35 : S.z1 + f * (S.z2 - S.z1);
    if (side === 0 && x > 85 && x < 88.5) continue;                  // la puerta sur
    if (side !== 0 && z > 88.5 && z < 92) continue;                  // la puerta oeste
    lf.card(x, top - L + 0.3, z, 0.5, L, 0, side === 0 ? 0 : Math.PI / 2, 0, k % 2 ? 'vine' : 'moss', 0xffffff);
  }
  // bloques caídos al pie, de la misma piedra
  for (let k = 0; k < 22; k++) {
    const side = k % 4, a = rr();
    let x = side === 0 ? 75 + a * 20 : side === 1 ? 74.2 - rr() * 1.5 : side === 2 ? 95.3 : 75 + a * 20;
    let z = side === 0 ? 79.2 - rr() * 1.8 : side === 1 ? 80 + a * 20 : 80 + a * 20, sc = 0.4 + rr() * 0.5;
    if (side === 2 || side === 3) continue;                           // atrás no se camina
    if ((side === 0 && x > 81.8 && x < 88.2) || (side === 1 && z > 86.8 && z < 93.2)) continue;   // frente a las rampas
    st.box(x, sc * 0.35, z, sc * 1.4, sc * 0.7, sc, [0xffffff, 0xeae6da, 0xd6d2c4][k % 3], rr() * 0.4, rr() * 3, rr() * 0.3);
  }
  // cabezas colosales de piedra (PROPS cabezaN): cara ancha, casco, ojos cerrados, labios gruesos
  for (const [x, z, r] of T.heads) {
    st.setFrame(x, 0, z, r + Math.PI);                                 // mira al camino (hacia -z... al sur)
    st.blob(0, 1.15, 0, 1.0, 1.15, 0.95, 0xd6d2c4, 2);
    st.blob(0, 2.05, -0.05, 1.05, 0.45, 1.0, 0xc8c4b4, 3);             // casco
    st.box(0, 1.95, 0.82, 1.7, 0.18, 0.2, 0xb8b4a4);                   // borde del casco
    for (const sx of [-0.36, 0.36]) { st.blob(sx, 1.45, 0.82, 0.22, 0.09, 0.08, 0x9a968a, 1); st.box(sx, 1.36, 0.88, 0.3, 0.04, 0.04, 0x5a564c); }   // párpados
    st.blob(0, 1.1, 0.95, 0.2, 0.32, 0.2, 0xc8c4b4, 4);                // nariz
    st.blob(0, 0.72, 0.86, 0.42, 0.14, 0.16, 0xb8b4a4, 5);             // labios
    st.box(0, 0.72, 0.99, 0.5, 0.03, 0.02, 0x4a463c);
    for (const sx of [-1.02, 1.02]) st.blob(sx, 1.25, 0.1, 0.16, 0.4, 0.3, 0xc8c4b4, 6);   // orejas
    st.setFrame(null);
    for (let q = 0; q < 4; q++) lf.clump(x + (rr() - 0.5) * 2, 1.8 + rr() * 0.5, z + (rr() - 0.5) * 1.2, 0.8, 0.5, 'ivy', leafT[q], rr() * 3);
    lf.clump(x, -0.05, z + 1.1, 1.4, 0.7, 'fern', 0xffffff, rr() * 3);
  }
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
  const Rv = T.river, [wx1, wx2, wz1, wz2] = Rv.w, [sx1, sx2, sz1, sz2] = Rv.s;
  for (let k = 0; k < 40; k++) {
    const west = k % 2 === 0, bridgeFree = (a, arm) => !Rv.bridges.some(g => g[0] === arm && a > g[1] - 0.8 && a < g[2] + 0.8);
    if (west) { const z = sz2 + rr() * (wz2 - sz2), x = rr() < 0.5 ? wx1 - 0.35 : wx2 + 0.35; if (!bridgeFree(z, 'w')) continue; lf.clump(x, 0, z, 0.8, 1.1 + rr() * 0.5, 'grass', 0xd8e4b0, rr() * 3); }
    else { const x = sx1 + rr() * (sx2 - sx1), z = rr() < 0.5 ? sz1 - 0.35 : sz2 + 0.35; if (!bridgeFree(x, 's')) continue; lf.clump(x, 0, z, 0.8, 1.1 + rr() * 0.5, 'grass', 0xd8e4b0, rr() * 3); }
  }
  for (let k = 0; k < 26; k++) {
    const west = k % 2 === 0;
    const x = west ? wx1 + 0.6 + rr() * (wx2 - wx1 - 1.2) : sx1 + 1 + rr() * (sx2 - sx1 - 2), z = west ? sz2 + 1 + rr() * (wz2 - sz2 - 2) : sz1 + 0.6 + rr() * (sz2 - sz1 - 1.2);
    if (Rv.bridges.some(g => (g[0] === 'w' && west && z > g[1] - 0.5 && z < g[2] + 0.5) || (g[0] === 's' && !west && x > g[1] - 0.5 && x < g[2] + 0.5))) continue;
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
  for (const [x, z, y] of torches) {                                   // F5.17: braseros de piedra (antes un palo)
    st.cyl(x, y, z, 0.26, 0.9, tone(), 0.75, 8);
    st.lathe([[0.12, 0], [0.34, 0.08], [0.46, 0.3], [0.48, 0.36], [0.4, 0.34]], x, y + 0.9, z, 1, 1, 1, tone(), 10);
    dt.cyl(x, y + 1.18, z, 0.36, 0.05, 0x2a1a10, 1, 10);              // brasas
    for (const r of [0, Math.PI / 2]) {
      const f = new THREE.Mesh(fgeo, fmat); f.position.set(x, y + 1.58, z); f.rotation.y = r;
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
    c.font = 'bold ' + Math.floor(s * 0.2) + 'px monospace'; c.fillText('LIFE', s / 2, s * 0.42);
    c.fillText('GUARD', s / 2, s * 0.68);
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
  buildGardenDress();                                              // F5.17: cercos de hojas, lajas, faroles, hiedra
  buildTempleDress();                                              // F5.17: raíces, cabezas colosales, estelas
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
  // F5.17: tallo curvo (tubo) y hojas carnosas (gotas aplastadas) en vez de cajas
  mb.tube([[x, y, z], [x + 0.06 * S, y + stemH * 0.5, z - 0.04 * S], [x, y + stemH, z]], 0.07 * S, 0.05 * S, stone ? 0x8a8a84 : 0x3f6a2a, 6, 6);
  for (let k = 0; k < 5; k++) {
    const a = k * 1.26, r = 0.24 * S;
    mb.blob(x + Math.cos(a) * r, y + 0.1, z + Math.sin(a) * r, 0.24 * S, 0.035, 0.1 * S, stone ? 0x9a9a92 : [0x4e7a32, 0x5a8a3a][k % 2], k, 0, -a, 0.3);
  }
}
// cabeza: dos mandíbulas que se abren (pivote atrás), cada una un mesh fusionado.
// F5.9: cada mandíbula tiene la versión normal (n) y la alienígena (a: morada, dientes verdes, ojos en antenas).
// F5.11: withStone = además la de piedra (s), que arranca visible (estatuas de la escotilla)
// F5.17: mandíbulas de media esfera con dientes cónicos todo alrededor y manchas (antes cajas)
let PLANT_JAW_MAT = null;
const PLANT_HEMI = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
function plantJawMesh(up, look) {
  const b = new MeshBuilder(), s = up ? 1 : -1, alien = look === 'alien', stone = look === 'stone';
  const shell = stone ? (up ? 0x9a9a92 : 0x8a8a84) : alien ? (up ? 0x7a2ab0 : 0x5a1a8a) : (up ? 0xb0283a : 0x9a2030);
  b.add(PLANT_HEMI, 0, 0, 0.22, 0.25, 0.15, 0.24, up ? 0 : Math.PI, 0, 0, shell);
  b.cyl(0, -s * 0.004, 0.22, 0.235, 0.012, stone ? 0x6a6a64 : alien ? 0x9aff6a : 0xe89aa8, 1, 14);      // adentro
  const tooth = stone ? 0xb8b8b0 : alien ? 0xc8ff4a : 0xf0ead8, th = alien ? 0.12 : 0.09;
  for (let i = 0; i < 13; i++) {                                               // dientes alrededor del borde
    const a = -2.3 + i / 12 * 4.6, x = 0.24 * Math.sin(a), z = 0.22 + 0.23 * Math.cos(a);
    b.cyl(x, 0, z, 0.018, th, tooth, 0, 5, up ? Math.PI : 0, 0, 0);
  }
  if (!stone) for (let i = 0; i < 5; i++) {                                    // manchas
    const a = i * 1.3, r = 0.12 + (i % 2) * 0.05;
    b.blob(Math.sin(a) * r, s * (0.1 - r * 0.3), 0.22 + Math.cos(a) * r, 0.035, 0.012, 0.035, alien ? 0xd060ff : 0xe86070, i);
  }
  if (alien && up) {                                                            // antenas con ojos y púas
    [-0.14, 0, 0.14].forEach((ax, k) => {
      const h = 0.3 + (k === 1 ? 0.1 : 0);
      b.tube([[ax, 0.1, 0.12], [ax * 1.2, 0.1 + h * 0.6, 0.1], [ax * 1.3, 0.1 + h, 0.12]], 0.018, 0.012, 0x4a1a6a, 5, 5);
      b.sphere(ax * 1.3, 0.14 + h, 0.12, 0.05, 0.05, 0.05, 0x7aff3a, 6);
    });
    for (let i = 0; i < 4; i++) b.cyl(-0.18 + i * 0.12, 0.12, 0.3, 0.02, 0.1, 0xd060ff, 0, 5, 0.4, 0, 0);
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
