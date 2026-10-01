// =====================================================================================================================
// 7l BARRICADAS (V2 F5.19b) — ventanas con 5 tablas y trampillas del piso, estilo BO. Los zombies de la casa entran por
// ahí: arrancan las tablas de a una (tearTime) y se meten (climbTime). Se reparan manteniendo F (repairTime por tabla):
// ROUNDS.boardPoints por tabla, las primeras ROUNDS.boardCap de cada ronda. Afuera saltan desde la espesura o el agua.
// F5.19c: la ventana es un marco hondo (depth m hacia adentro) con las tablas adelante y el zombie en el hueco, DETRÁS de
// las tablas. Antes de arrancar una, la sacude (shakeFrom de tearTime); al arrancarla la tira hacia atrás y cae.
// Todo se construye una vez: las tablas son UN InstancedMesh (se mueven sus matrices), marcos y huecos un MeshBuilder
// =====================================================================================================================
const BARS = { list: [], byId: {}, boards: null, repairT: 0, pts: 0 };
const BAR_M = new THREE.Matrix4(), BAR_Q = new THREE.Quaternion(), BAR_E = new THREE.Euler(), BAR_S = new THREE.Vector3(), BAR_P = new THREE.Vector3();

function buildBarriers() {
  const C = CONFIG.BARRIERS, N = C.boards, mb = new MeshBuilder(), dk = new MeshBuilder();
  const count = C.list.length * N;
  BARS.boards = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), count);
  BARS.boards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  BARS.boards.frustumCulled = false; BARS.boards.userData.theme = false;
  const col = new THREE.Color(), wood = 0x4a3422, face = 0.215;
  C.list.forEach((d, bi) => {
    const hatch = d.kind === 'hatch', rail = d.kind === 'rail', n = d.n || [0, 1], y0 = hatch ? 0 : groundY(d.x, d.z);
    const B = { ...d, n, i0: bi * N, boards: N, occ: null, anim: new Array(N).fill(0), animK: new Array(N).fill(0), rot: [], off: [], shake: -1, shakeA: 0 };
    // la entrada (adentro), el plano de las tablas (bx, bz) y dónde queda el zombie mientras arranca (zx, zz)
    // F5.20 (Diego: "que el cuadro de la barricada se vea en la pared, no saliendo"): la ventana es un hueco de verdad en
    // la pared (theme.js wallHoles), las tablas van al ras de la cara de adentro y el zombie está del otro lado, afuera
    const bd = rail ? face + 0.08 : face + 0.03;
    B.ix = hatch ? d.x : d.x + n[0] * C.inside; B.iz = hatch ? d.z : d.z + n[1] * C.inside;
    B.bx = hatch ? d.x : d.x + n[0] * bd;       B.bz = hatch ? d.z : d.z + n[1] * bd;
    const zd = rail ? -0.6 : -(face + 0.32);                              // afuera, pegado a la pared (los brazos llegan)
    B.zx = hatch ? d.x : d.x + n[0] * zd;       B.zz = hatch ? d.z : d.z + n[1] * zd;
    B.fx = hatch ? d.x : d.x + n[0] * 0.55;     B.fz = hatch ? d.z : d.z + n[1] * 0.55;   // posición lógica (anillo pegado)
    B.yaw = hatch ? 0 : Math.atan2(n[0], n[1]);  // hacia adentro
    const rr = mulberry(77 + bi * 13);
    for (let k = 0; k < N; k++) { B.rot.push((rr() - 0.5) * 0.35); B.off.push((rr() - 0.5) * 0.12); col.setHex([0x7a5a3a, 0x6a4a2e, 0x8a6a44][k % 3]); BARS.boards.setColorAt(B.i0 + k, col); }
    if (hatch) {                                                          // hueco oscuro con marco en el piso
      dk.box(d.x, y0 + 0.012, d.z, 1.3, 0.02, 1.3, 0x080604);
      for (const s of [-1, 1]) { mb.box(d.x + s * 0.7, y0 + 0.03, d.z, 0.12, 0.06, 1.52, 0x3a2a1a); mb.box(d.x, y0 + 0.03, d.z + s * 0.7, 1.52, 0.06, 0.12, 0x3a2a1a); }
      mb.box(d.x + 0.55, y0 + 0.07, d.z - 0.5, 0.08, 0.03, 0.2, 0x5a5a60);          // bisagra
    } else {
      const w = rail ? 1.5 : C.winW, h = rail ? 1.1 : C.winY1 - C.winY0, yc = rail ? 0.6 : (C.winY0 + C.winY1) / 2, sx = Math.abs(n[1]), sz = Math.abs(n[0]);
      const ry = Math.atan2(n[0], n[1]);
      if (!rail) {
        // F5.20: el hueco forrado de madera en todo el grosor (la pared se ve gruesa) y un marco en las dos caras.
        // Las piernas del zombie quedan tapadas por la pared de abajo del hueco (arranca a winY0)
        const T = face * 2, fr = 0.12;
        for (const s of [-1, 1]) mb.box(d.x + sx * s * (w / 2 + 0.02), yc, d.z + sz * s * (w / 2 + 0.02), sx * 0.04 + sz * T, h, sz * 0.04 + sx * T, 0x5a4230);   // jambas del hueco
        mb.box(d.x, C.winY1 - 0.02, d.z, sx * w + sz * T, 0.04, sz * w + sx * T, 0x5a4230);                                    // dintel del hueco
        mb.box(d.x, C.winY0 + 0.02, d.z, sx * (w + 0.1) + sz * (T + 0.12), 0.05, sz * (w + 0.1) + sx * (T + 0.12), wood);   // alféizar
        for (const side of [1, -1]) {                                          // marco en la cara de adentro (+n) y de afuera
          const fx = d.x + n[0] * side * (face + 0.02), fz = d.z + n[1] * side * (face + 0.02);
          for (const s of [-1, 1]) mb.box(fx + sx * s * (w / 2 + fr / 2), yc, fz + sz * s * (w / 2 + fr / 2), sx * fr + sz * 0.05, h + fr * 2, sz * fr + sx * 0.05, wood);
          mb.box(fx, C.winY1 + fr / 2, fz, sx * (w + fr * 2) + sz * 0.05, fr, sz * (w + fr * 2) + sx * 0.05, wood);
          mb.box(fx, C.winY0 - fr / 2, fz, sx * (w + fr * 2) + sz * 0.05, fr, sz * (w + fr * 2) + sx * 0.05, wood);
        }
      } else {
        for (const s of [-1, 1]) mb.box(B.bx + sx * s * (w / 2 + 0.06), yc, B.bz + sz * s * (w / 2 + 0.06), sx * 0.12 + sz * 0.1, h + 0.1, sz * 0.12 + sx * 0.1, wood);
      }
      B.yc = yc; B.h = h; B.ry = ry;
    }
    B.y0 = y0;
    BARS.list.push(B); BARS.byId[d.id] = B;
    for (let k = 0; k < N; k++) setBoard(B, k, 'rest', 0);
  });
  BARS.boards.instanceColor.needsUpdate = true;
  scene.add(BARS.boards);
  const m1 = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })), m2 = dk.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
  for (const m of [m1, m2]) if (m) { m.userData.theme = false; m.updateMatrix(); }
  // las entradas de las ventanas son spawns; a los de afuera se les busca de dónde saltar (espesura o agua)
  for (const sp of SPAWN_POINTS) {
    sp.bar = BARS.list.find(B => Math.hypot(B.ix - sp.x, B.iz - sp.z) < 0.2) || null;
    sp.jump = sp.bar ? null : jumpFrom(sp);
  }
}
// una tabla: 'rest' puesta · 'shake' la sacuden (p = segundos) · 'tear' la arrancan (p 0 -> 1: sale hacia atrás, gira y
// cae) · 'place' la ponen (p 0 -> 1: llega desde adentro) · 'gone' no está (escala 0)
function setBoard(B, k, mode, p) {
  const C = CONFIG.BARRIERS, i = B.i0 + k;
  if (mode === 'gone') { BAR_M.makeScale(0, 0, 0); BARS.boards.setMatrixAt(i, BAR_M); return; }
  let dx = 0, dy = 0, dz = 0, rx = 0, rz = 0, sc = 1;
  const sh = mode === 'shake' ? Math.sin(p * 38) * 0.05 : 0;
  if (B.kind === 'hatch') {
    const zz = -0.5 + k * 0.25 + B.off[k] * 0.3;
    if (mode === 'tear') { dy = p * 0.9 - p * p * 0.5; dx = p * 0.8 * (k % 2 ? 1 : -1); rx = p * 2.2; rz = p * 1.2; sc = p > 0.85 ? (1 - p) / 0.15 : 1; }
    if (mode === 'place') { dy = (1 - p) * 0.5; }
    BAR_P.set(B.x + B.off[k] + dx, B.y0 + 0.05 + dy + Math.abs(sh), B.z + zz);
    BAR_E.set(rx + sh * 2, B.rot[k] * 0.6, rz);
    BAR_S.set(1.45 * sc, 0.05 * sc, 0.2 * sc);
  } else {
    const rail = B.kind === 'rail', y = B.yc - B.h / 2 + 0.15 + k * (B.h - 0.3) / (C.boards - 1);
    let back = 0;                                                          // hacia afuera (-n), hacia el zombie
    if (mode === 'tear') { back = p * 1.1; dy = -p * p * (y - B.y0 - 0.05); rz = p * 1.8 * (k % 2 ? 1 : -1); sc = p > 0.85 ? (1 - p) / 0.15 : 1; }
    if (mode === 'place') back = -(1 - p) * 0.5;                         // llega desde adentro
    if (mode === 'shake') back = Math.abs(sh) * 1.5;
    BAR_P.set(B.bx - B.n[0] * back, y + (rail ? 0 : B.off[k]) + dy, B.bz - B.n[1] * back);
    BAR_E.set(0, B.ry, B.rot[k] + rz + sh * 3, 'YXZ');
    BAR_S.set(1.7 * sc, 0.18 * sc, 0.05 * sc);
  }
  BAR_Q.setFromEuler(BAR_E); BAR_M.compose(BAR_P, BAR_Q, BAR_S);
  BARS.boards.setMatrixAt(i, BAR_M);
}
// F5.20: ¿el punto p cae adentro del hueco de alguna ventana de barricada? (para que las balas pasen)
function inWindowHole(p) {
  const C = CONFIG.BARRIERS;
  if (p.y < C.winY0 || p.y > C.winY1) return false;
  for (const B of BARS.list) {
    if (B.kind !== 'window') continue;
    const dx = p.x - B.x, dz = p.z - B.z, across = dx * B.n[0] + dz * B.n[1], along = dx * B.n[1] - dz * B.n[0];
    if (Math.abs(across) <= 0.3 && Math.abs(along) <= C.winW / 2) return true;
  }
  return false;
}
// busca afuera (fuera de todo cuarto: espesura, agua, afuera del borde) a menos de jumpProbe m, en 16 direcciones
// F5.20: agua (mar de la playa, bahía del calamar, lagunas): de ahí no se salta
function isWaterAt(x, z) {
  const B = CONFIG.SQUIDBAY.bounds;
  if (z < SEA.z0 + 0.6) return true;                                     // el mar al sur de la playa
  if (x >= B[0] && x <= B[1] && z >= B[2] && z <= B[3]) return true;     // la bahía del calamar
  return false;
}
function jumpFrom(sp) {
  const L = CONFIG.BARRIERS.jumpProbe;
  if (groundY(sp.x, sp.z) < -1 || sp.sea) return null;                  // F5.19c: bajo tierra (búnker) salen del piso; F5.20: los del mar (ahogados), también
  let best = null;
  for (let a = 0; a < 16; a++) {
    const dx = Math.cos(a * Math.PI / 8), dz = Math.sin(a * Math.PI / 8);
    for (let s = 0.5; s <= L; s += 0.5) {
      const x = sp.x + dx * s, z = sp.z + dz * s;
      if (roomAt(x, z)) continue;
      if (roomAt(x + dx, z + dz) || roomAt(x + dx * 1.5, z + dz * 1.5)) break;   // una pared entre dos cuartos, no afuera
      if (isWaterAt(x, z)) break;                                         // F5.20 (Diego): del mar no salen caminando
      if (!best || s < best.s) best = { s, ex: x - dx * 0.25, ez: z - dz * 0.25, dx, dz };   // borde (del lado de adentro)
      break;
    }
  }
  if (!best) return null;
  const C = CONFIG.BARRIERS, b = best;
  // F5.19c: sale caminando de la jungla (from -> pre) y salta el borde como una pared a la cintura (pre -> land)
  return { x: b.ex + b.dx * C.walkIn, z: b.ez + b.dz * C.walkIn, px: b.ex + b.dx * 0.45, pz: b.ez + b.dz * 0.45,
           lx: b.ex - b.dx * 0.9, lz: b.ez - b.dz * 0.9 };
}
// resetZombie la llama al spawnear: ventana/trampilla, salto o el piso de siempre
function barrierSpawn(z, sp) {
  z.bar = null; z.jump = null;
  if (!CONFIG.BARRIERS.enabled || z.boss || z.fromClam) return;
  if (sp.bar && !sp.bar.occ) {
    const B = sp.bar; B.occ = z; z.bar = B; z.state = 'barrier'; z.barT = 0; z.barPhase = 'tear';
    z.px = B.fx; z.pz = B.fz;
    z.heading = B.yaw;
  } else if (sp.jump && !z.squid) {
    const J = sp.jump, land = isNav(J.lx, J.lz);
    z.jump = { x0: J.x, z0: J.z, px: J.px, pz: J.pz, lx: J.lx, lz: J.lz, phase: 'walk', t: 0 };
    z.state = 'jump'; z.t = 0;
    if (land) { z.px = J.lx; z.pz = J.lz; }                          // (lógico: donde cae; si no es navegable, el spawn)
    z.jump.ex = z.px; z.jump.ez = z.pz;
    z.heading = Math.atan2(J.px - J.x, J.pz - J.z);
    z.root.position.set(J.x, groundY(J.x, J.z), J.z);
  }
}
function barrierFree(z) { if (z.bar && z.bar.occ === z) { z.bar.occ = null; z.bar.shake = -1; } z.bar = null; }
// un frame del zombie en la ventana o trampilla (desde updateZombies)
function barrierTick(z, dt) {
  const C = CONFIG.BARRIERS, B = z.bar, P = player.pos;
  if (!B) { z.state = 'walk'; return; }
  z.barT += dt;
  const hatch = B.kind === 'hatch';
  if (z.barPhase === 'tear') {
    let pull = 0;                                                         // 0 agarra · 1 tironea la tabla que sigue
    if (B.boards > 0) {
      const k = B.boards - 1, f = z.barT / C.tearTime;
      B.shake = f >= C.shakeFrom ? k : -1; B.shakeA = z.barT;
      pull = f >= C.shakeFrom ? 1 : f / C.shakeFrom;
      if (z.barT >= C.tearTime) { z.barT = 0; B.boards--; B.shake = -1; B.anim[k] = -1; B.animK[k] = 1; sfxBoardTear(B); }
    } else { B.shake = -1; if (z.barT >= 0.35) { z.barPhase = 'climb'; z.barT = 0; } }
    // pega por el hueco si estás pegado a las tablas
    z.attackCd -= dt;
    const reach = hatch ? C.hatchHit : C.hitRange;
    if (z.attackCd <= 0 && playerLevel() === 0 && Math.hypot(P.x - B.bx, P.z - B.bz) < reach) {
      z.attackCd = CONFIG.ZOMBIE.attackCooldown || 1; z.swingT = 0.35;
      if (!shieldBlocks(z.px, z.pz, CONFIG.ZOMBIE.damage)) damagePlayer(CONFIG.ZOMBIE.damage, z.px, z.pz, false, 'zombie');
    }
    const s = Math.sin(z.t * 11), yank = pull >= 1 ? Math.sin(z.barT * 38) * 0.25 : 0;
    if (hatch) {                                                          // abajo, empujando las tablas con las manos
      z.root.position.set(B.x, B.y0 - 2.15 + Math.max(0, s) * 0.05, B.z);
      if (z.armL) { z.armL.rotation.x = -3.0 + yank; z.armR.rotation.x = -3.0 - yank; }
    } else {                                                              // detrás de las tablas: estira los brazos y tironea
      z.root.position.set(B.zx, B.y0, B.zz);
      if (z.armL) { const a = -1.25 - 0.35 * pull; z.armL.rotation.x = a + yank; z.armR.rotation.x = a - yank + s * 0.1; }
      if (z.body) z.body.rotation.x = 0.1 + 0.15 * pull - Math.abs(yank) * 0.3;
    }
    z.root.rotation.set(0, B.yaw, 0);
    return;
  }
  // climb: la ventana -> la entrada (pasa por el hueco y cae adentro); la trampilla -> sube a la superficie
  const p = Math.min(1, z.barT / C.climbTime), e = p * p * (3 - 2 * p);
  if (hatch) {
    z.root.position.set(B.x, B.y0 - 2.15 * (1 - e), B.z);
  } else {
    z.root.position.set(B.zx + (B.ix - B.zx) * e, B.y0 + Math.sin(p * Math.PI) * (B.kind === 'rail' ? 0.9 : CONFIG.BARRIERS.winY0 + 0.25), B.zz + (B.iz - B.zz) * e);
    if (z.body) z.body.rotation.x = 0.6 * Math.sin(p * Math.PI);
  }
  if (p >= 1) {
    if (z.body) z.body.rotation.x = 0;
    if (z.armL) z.armL.rotation.x = z.armR.rotation.x = 0;
    z.px = B.ix; z.pz = B.iz; z.lastX = z.px; z.lastZ = z.pz; z.stuckT = 0;
    barrierFree(z);
    z.state = 'walk'; z.t = 0; z.mode = 'recover';
  }
}
// F5.19c (Diego): sale caminando de la jungla (o del agua) hasta el borde y lo salta como una pared a la cintura:
// apoya las manos, sube las piernas y cae del otro lado. Después sigue con la IA de siempre
function jumpTick(z, dt) {
  const C = CONFIG.BARRIERS, J = z.jump;
  if (!J) { z.state = 'walk'; return; }
  J.t += dt;
  if (J.phase === 'walk') {
    const v = Math.max(1.6, Math.min(z.speed || 1.6, 3)), L = Math.hypot(J.px - J.x0, J.pz - J.z0), p = Math.min(1, J.t * v / Math.max(L, 0.1));
    const x = J.x0 + (J.px - J.x0) * p, zz = J.z0 + (J.pz - J.z0) * p;
    z.root.position.set(x, groundY(x, zz), zz);
    z.root.rotation.set(0, z.heading, 0);
    animateZombie(z, dt, v);
    if (p >= 1) { J.phase = 'vault'; J.t = 0; }
    return;
  }
  const p = Math.min(1, J.t / C.vaultTime), e = p * p * (3 - 2 * p);
  const x = J.px + (J.lx - J.px) * e, zz = J.pz + (J.lz - J.pz) * e;
  z.root.position.set(x, groundY(x, zz) + Math.sin(p * Math.PI) * C.vaultH, zz);
  z.root.rotation.set(0, z.heading, 0);
  const k = Math.sin(p * Math.PI);
  if (z.armL && !z.dog) { z.armL.rotation.x = z.armR.rotation.x = -1.2 + 0.9 * k; }   // se apoya y empuja
  if (z.legL) { z.legL.rotation.x = -1.1 * k; z.legR.rotation.x = -0.8 * k; }           // recoge las piernas
  if (z.body) z.body.rotation.x = 0.55 * k;
  if (p >= 1) {
    if (z.body) z.body.rotation.x = 0;
    if (z.armL) z.armL.rotation.x = z.armR.rotation.x = 0;
    if (z.legL) { z.legL.rotation.x = 0; if (!z.crawl) z.legR.rotation.x = 0; }
    z.px = J.ex; z.pz = J.ez; z.lastX = z.px; z.lastZ = z.pz; z.stuckT = 0;
    z.jump = null; z.state = 'walk'; z.t = 0; z.mode = 'recover';
  }
}
// cada frame: animación de las tablas, soltar ventanas de zombies muertos y la reparación con F
function updateBarriers(dt) {
  if (!BARS.boards) return;
  const C = CONFIG.BARRIERS;
  let dirty = false;
  for (const B of BARS.list) {
    if (B.occ && (!B.occ.alive || B.occ.bar !== B)) { B.occ = null; if (B.shake >= 0) { setBoard(B, B.shake, 'rest', 0); dirty = true; } B.shake = -1; }
    for (let k = 0; k < C.boards; k++) {
      if (B.anim[k]) {
        B.animK[k] = Math.max(0, B.animK[k] - dt / (B.anim[k] < 0 ? 0.6 : 0.3));
        const p = 1 - B.animK[k];
        if (B.anim[k] < 0) setBoard(B, k, p >= 1 ? 'gone' : 'tear', p);
        else setBoard(B, k, p >= 1 ? 'rest' : 'place', p);
        if (B.animK[k] <= 0) B.anim[k] = 0;
        dirty = true;
      } else if (k === B.shake && k < B.boards) { setBoard(B, k, 'shake', B.shakeA); dirty = true; }
    }
  }
  // reparar: mantener F con el cartel de la barricada (una tabla cada repairTime)
  const it = interactState;
  if (state.running && it.kind === 'barrier' && keys['KeyF'] && it.target.boards < C.boards && !(it.target.occ && it.target.occ.barPhase === 'climb')) {
    BARS.repairT += dt;
    if (BARS.repairT >= C.repairTime) { BARS.repairT = 0; repairBoard(it.target); }
  } else BARS.repairT = 0;
  if (dirty) BARS.boards.instanceMatrix.needsUpdate = true;
}
function repairBoard(B) {
  const k = B.boards;
  if (k >= CONFIG.BARRIERS.boards) return false;
  B.boards++; B.anim[k] = 1; B.animK[k] = 1;
  setBoard(B, k, 'place', 0); BARS.boards.instanceMatrix.needsUpdate = true;
  if (B.occ && B.occ.barPhase === 'tear') { B.occ.barT = 0; B.shake = -1; }   // el que tironeaba empieza de nuevo
  const R = CONFIG.ROUNDS;
  if (BARS.pts < R.boardCap) { BARS.pts++; addPoints(R.boardPoints); }
  sfxBoardRepair(B);
  return true;
}
// F5.19c: solo pegado a las tablas (repairRange m del plano de las tablas, o del centro de la trampilla)
function barrierNear(room, px, pz, bd) {
  if (!room || !BARS.list.length || playerLevel() !== 0) return null;
  let best = null;
  for (const B of BARS.list) {
    if (B.room !== room.id || B.boards >= CONFIG.BARRIERS.boards) continue;
    const d = Math.hypot(px - B.bx, pz - B.bz);
    if (d < Math.min(bd, CONFIG.BARRIERS.repairRange) && (!best || d < best.dist)) best = { dist: d, target: B };
  }
  return best;
}
function barrierPrompt(B) {
  const R = CONFIG.ROUNDS;
  return { text: '[Hold F] Rebuild barrier' + (BARS.pts < R.boardCap ? ' (+' + R.boardPoints + ')' : ''), cost: 0 };
}
// F5.19c: power-up CARPENTER: todas las barricadas vuelven a tener sus 5 tablas (con la animación de ponerlas); el
// que estaba tironeando empieza de nuevo
function repairAllBarriers() {
  const N = CONFIG.BARRIERS.boards;
  for (const B of BARS.list) {
    for (let k = B.boards; k < N; k++) { B.anim[k] = 1; B.animK[k] = 1; setBoard(B, k, 'place', 0); }
    B.boards = N; B.shake = -1;
    if (B.occ && B.occ.barPhase === 'tear') B.occ.barT = 0;
  }
  if (BARS.boards) BARS.boards.instanceMatrix.needsUpdate = true;
  if (typeof sfxBoardRepair === 'function') sfxBoardRepair();
}
// nueva ronda: vuelven a dar puntos
function barriersRound() { BARS.pts = 0; }
function resetBarriers() {
  BARS.pts = 0; BARS.repairT = 0;
  for (const B of BARS.list) {
    B.boards = CONFIG.BARRIERS.boards; B.occ = null; B.shake = -1;
    for (let k = 0; k < CONFIG.BARRIERS.boards; k++) { B.anim[k] = 0; setBoard(B, k, 'rest', 0); }
  }
  if (BARS.boards) BARS.boards.instanceMatrix.needsUpdate = true;
}
