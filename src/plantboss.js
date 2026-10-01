//=== 7m. PLANTA JEFA DEL TEMPLO (V2 F5.20, F5.21) ==========================
// Reemplaza a la tumba del portal (CONFIG.PLANTBOSS). Una planta carnívora gorda y enferma, fija en la esquina NE de
// la plancha del templo, con huevos alienígenas a los pies. No es un zombie (no vive en state.zombies: no se mueve y
// la ronda no la espera). Su cuerpo es la caja 'temple:planta' de world.js (collider de arriba + hitMesh
// type 'plantBoss'); la cabeza tiene su propia caja de tiro (sin collider). Las balas (traceShot/tracePierce), el
// cuchillo y las explosiones (explodeAt -> plantBossBlast) le pegan con plantBossHit, solo desde arriba de la plancha.
// F5.22: en el centro de la nave. Se despierta con vos en el área del templo (o al primer tiro) y toma la vida del Sombrerón de esa ronda
// × hpMul. Ataques:
//   - raíces (todas las fases): salen de la plancha debajo tuyo con un aviso en el piso; te pegan y te levantan
//   - fase 1 (vida > half): ráfagas de 3 escupitajos de ácido (charcos verdes)
//   - fase 2 (half..low): chorro de tinta de calamar con más alcance
//   - fase 3 (< low): chorro + hordas de calamares, y las raíces más seguido
// F5.21 (Diego: "que sea cúbico"): todo en vóxeles (voxBlob). Se oscurece a medida que pierde vida. Al morir hay una
// cinemática: se retuerce, escupe el Pack-a-Punch entero (vuela hasta su lugar dando vueltas) y se forma una burbuja
// de cubos alrededor del portal del templo, que se abre. Todo se construye una vez; ninguna luz nueva
const PLANTB = { g: null, head: null, upper: null, lower: null, eggs: null, bodyMat: null, glowMat: null, eggMat: null,
                 hitHead: null, cocoon: null, bubble: null, mouth: new THREE.Vector3(), front: new THREE.Vector3(),
                 roots: [], burst: 0, burstT: 0, rootT: 0,
                 hp: 0, max: 0, awake: false, dead: false, spat: false, deathT: 0, bubbleT: -1,
                 spitT: 0, jetT: 0, jetAcc: 0, inkT: 0, sumT: 0, open: 0, flashT: 0, id: -77,
                 anim: false, cineT: 0, papHome: null, jaw: null, chomp: 0,
                 // F5.23: la lengua. state off | warn | shoot | grab | back; tip = punta (mundo); len = largo actual
                 tg: { state: 'off', t: 0, cd: 0, len: 0, full: 0, hits: 0, stabs: 0, stall: 0, lx: 0, lz: 0,
                       tip: new THREE.Vector3(), dir: new THREE.Vector3(), prev: new THREE.Vector3() },
                 tongue: null, tongueHit: null };
const _pbA = new THREE.Vector3(), _pbC = new THREE.Color(), _pbW = new THREE.Color(0xffffff);
const _pbM = new THREE.Matrix4(), _pbQ = new THREE.Quaternion(), _pbS = new THREE.Vector3(), _pbP = new THREE.Vector3(),
      _pbZ = new THREE.Vector3(0, 0, 1), _pbE = new THREE.Euler();

// hash de posición (0..1): manchas y pústulas sin azar que cambie entre cargas
function pbHash(x, y, z) { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); }
// elipsoide de cubos de lado v: solo la cáscara (los de adentro no se ven). col(x, y, z) -> [color, brilla?] o null
// para saltear ese cubo; keep(x, y, z) recorta (mitades de mandíbula, huecos)
function voxBlob(mb, gl, cx, cy, cz, rx, ry, rz, v, col, keep, thick) {
  const nx = Math.ceil(rx / v), ny = Math.ceil(ry / v), nz = Math.ceil(rz / v), t = thick || 0;
  const inside = (i, j, k) => {
    const x = i * v, y = j * v, z = k * v, e = (x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2;
    if (e > 1) return false;
    if (t > 0 && (x / (rx - t)) ** 2 + (y / (ry - t)) ** 2 + (z / (rz - t)) ** 2 < 1) return false;   // hueco adentro
    return !keep || keep(x, y, z);
  };
  let n = 0;
  for (let i = -nx; i <= nx; i++) for (let j = -ny; j <= ny; j++) for (let k = -nz; k <= nz; k++) {
    if (!inside(i, j, k)) continue;
    if (inside(i + 1, j, k) && inside(i - 1, j, k) && inside(i, j + 1, k) && inside(i, j - 1, k) && inside(i, j, k + 1) && inside(i, j, k - 1)) continue;
    const c = col(i * v, j * v, k * v);
    if (!c) continue;
    (c[1] ? gl : mb).box(cx + i * v, cy + j * v, cz + k * v, v, v, v, c[0]);
    n++;
  }
  return n;
}
// cadena de cubos que se afina (raíces, lianas, púas): de p0 en dirección (dx, dy, dz), `steps` cubos, girando
function voxChain(mb, p, d, steps, s0, s1, color, turn, rr, glowEnd, gl) {
  let [x, y, z] = p, [dx, dy, dz] = d;
  for (let i = 0; i < steps; i++) {
    const k = i / Math.max(1, steps - 1), s = s0 + (s1 - s0) * k;
    const c = typeof color === 'function' ? color(i, k) : color;
    (glowEnd && i === steps - 1 ? gl : mb).box(x, y, z, s, s, s, glowEnd && i === steps - 1 ? glowEnd : c);
    x += dx * s * 0.85; y += dy * s * 0.85; z += dz * s * 0.85;
    if (turn) { dx += (rr() - 0.5) * turn; dz += (rr() - 0.5) * turn; dy += (rr() - 0.5) * turn * 0.5; }
    const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
  }
  return [x, y, z];
}

function buildPlantBoss() {
  const C = CONFIG.PLANTBOSS, y = UP.y, rr = mulberry(313);
  const g = new THREE.Group();
  g.position.set(C.x, y, C.z);
  g.rotation.y = Math.atan2(C.look[0] - C.x, C.look[1] - C.z);          // +z local mira a la nave
  g.scale.setScalar(C.scale);
  scene.add(g); PLANTB.g = g;
  PLANTB.bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  PLANTB.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  PLANTB.eggMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false });
  const add = (mb, mat, parent) => { const m = mb.mesh(mat); if (!m) return null; scene.remove(m); m.matrixAutoUpdate = true; m.userData.theme = false; parent.add(m); return m; };
  const PUR = [0x6a2082, 0x7a2a92, 0x5c1a74, 0x842ea0], BLK = 0x160c1a, DPU = 0x3a0e48, SICK = 0x6a7a2a, YEL = 0x9a9a3a,
        BONE = 0xe8dcb0, BONED = 0xb8a880, GRN = 0x7aff3a, FLU = 0x3affa0, GUM = 0x6a1028, STONE = [0x6a6a5a, 0x5e5e50, 0x74746a], MOSS = 0x4a6a2a;
  const b = new MeshBuilder(), gl = new MeshBuilder();
  // ---- la maceta: un macetero de piedra del templo, partido, con musgo y glifos que brillan ----
  for (let i = -5; i <= 5; i++) for (let k = -5; k <= 5; k++) {
    const r = Math.max(Math.abs(i), Math.abs(k));
    if (r < 3) continue;
    const h = r === 5 ? 0.5 : r === 4 ? 0.9 : 1.2, broke = pbHash(i, 1, k) < 0.12;
    const x = i * 0.36, z = k * 0.36;
    if (broke) { b.box(x, 0.12, z, 0.34, 0.24, 0.34, STONE[1]); continue; }
    b.box(x, h / 2, z, 0.36, h, 0.36, STONE[(i * 7 + k * 3 + 30) % 3]);
    if (pbHash(i, 2, k) < 0.3) b.box(x, h + 0.04, z, 0.36, 0.08, 0.36, MOSS);   // musgo arriba
    if (r === 5 && pbHash(i, 3, k) < 0.18) gl.box(x * 1.03, h * 0.55, z * 1.03, 0.2, 0.2, 0.06, FLU);   // glifo
  }
  for (let i = 0; i < 5; i++) {                                         // pedazos de maceta caídos
    const a = rr() * Math.PI * 2, r = 2.3 + rr() * 0.8;
    b.box(Math.sin(a) * r, 0.14, Math.cos(a) * r, 0.4 + rr() * 0.3, 0.28, 0.35 + rr() * 0.3, STONE[i % 3], rr() * 0.4, a, rr() * 0.3);
  }
  // ---- raíces: cadenas de cubos que se arrastran por la plancha, se meten entre las piedras ----
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + rr() * 0.3;
    voxChain(b, [Math.sin(a) * 1.2, 0.9 + rr() * 0.3, Math.cos(a) * 1.2], [Math.sin(a), -0.6, Math.cos(a)], 9 + Math.floor(rr() * 6),
             0.42, 0.14, (j, k) => k > 0.7 ? BLK : j % 3 ? DPU : PUR[1], 0.6, rr, i % 3 === 0 ? GRN : 0, gl);
  }
  // ---- la panza: hinchada, en cubos, morada con manchas negras y enfermas, pústulas y grietas que brillan ----
  const BY = 2.5;
  voxBlob(b, gl, 0, BY, 0, 1.75, 1.55, 1.65, 0.3, (x, yy, z) => {
    const h = pbHash(Math.floor(x / 0.6), Math.floor(yy / 0.6), Math.floor(z / 0.6)), f = pbHash(x, yy, z);
    if (f > 0.975) return [GRN, true];                                  // pústula
    if (f < 0.07) return [BLK, false];                                  // manchas negras: cubos sueltos
    if (h < 0.2) return [f < 0.5 ? SICK : YEL, false];
    return [PUR[Math.floor(f * 4)], false];
  });
  for (let i = 0; i < 10; i++) {                                         // pústulas grandes que asoman (2×2)
    const a = rr() * Math.PI * 2, yy = BY - 1.0 + rr() * 2.0, k = Math.sqrt(Math.max(0.05, 1 - ((yy - BY) / 1.55) ** 2));
    const x = Math.sin(a) * 1.8 * k, z = Math.cos(a) * 1.7 * k;
    gl.box(x, yy, z, 0.34, 0.34, 0.34, GRN, 0, a, 0); gl.box(x * 1.06, yy + 0.1, z * 1.06, 0.18, 0.18, 0.18, 0xd8ff9a, 0, a, 0);
  }
  for (let i = 0; i < 3; i++) {                                          // venas verdes que suben por la panza (en zigzag)
    const a = i / 3 * Math.PI * 2 + 0.5;
    for (let j = 0; j < 7; j++) {
      const yy = BY - 1.0 + j * 0.3, k = Math.sqrt(Math.max(0.05, 1 - ((yy - BY) / 1.55) ** 2)), aa = a + (j % 2 ? 0.08 : -0.08);
      gl.box(Math.sin(aa) * 1.8 * k, yy, Math.cos(aa) * 1.7 * k, 0.12, 0.3, 0.12, FLU, 0, aa, 0);
    }
  }
  // ---- cuello: cubos apilados que se retuercen ----
  for (let j = 0; j < 7; j++) {
    const s = 1.35 - j * 0.07, a = j * 0.22;
    b.box(Math.sin(j * 0.7) * 0.12, 3.85 + j * 0.2, -0.25 + j * 0.02, s, 0.24, s, j % 2 ? DPU : PUR[0], 0, a, 0);
    if (j % 2) gl.box(Math.sin(a) * s * 0.52, 3.85 + j * 0.2, Math.cos(a) * s * 0.52 - 0.25, 0.12, 0.12, 0.12, GRN);
  }
  // ---- hojas grandes caídas: tiras de cubos con dientes al costado, la punta podrida ----
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + 0.25, ca = Math.cos(a), sa = Math.sin(a);
    for (let s = 0; s < 8; s++) {
      const r = 1.2 + s * 0.4, yy = Math.max(0.12, 1.6 - s * s * 0.03 - s * 0.1), w = 1.1 * (1 - s / 10) * (s < 2 ? 0.6 + s * 0.2 : 1);
      const col = s > 5 ? BLK : s > 4 ? DPU : PUR[(i + s) % 4];
      b.box(sa * r, yy, ca * r, w, 0.1, 0.46, col, -0.12 * s * 0.4, a, 0);
      gl.box(sa * r, yy + 0.06, ca * r, 0.08, 0.02, 0.44, s > 5 ? 0x2a5a1a : FLU, 0, a, 0);   // nervadura
      if (s % 2 === 0 && s < 7) for (const e of [-1, 1]) b.box(sa * r + ca * e * (w / 2 + 0.06), yy, ca * r - sa * e * (w / 2 + 0.06), 0.12, 0.08, 0.12, BLK, 0, a, 0);
    }
  }
  add(b, PLANTB.bodyMat, g); add(gl, PLANTB.glowMat, g);
  // ---- huevos alienígenas: 3 racimos de huevos de cubos translúcidos, con el bicho oscuro adentro ----
  const eg = new THREE.Group(); g.add(eg); PLANTB.eggs = eg;
  const em = new MeshBuilder(), emb = new MeshBuilder(), eslime = new MeshBuilder();
  for (const [cx, cz] of [[-2.2, 1.4], [2.1, 1.7], [0.2, 2.7]]) {
    for (let i = 0; i < 6; i++) {
      const ex = cx + (rr() - 0.5) * 1.1, ez = cz + (rr() - 0.5) * 0.9, s = 0.3 + rr() * 0.14;
      voxBlob(em, em, ex, s * 1.25, ez, s, s * 1.3, s, 0.12, (x, yy, z) => [pbHash(x, yy, z) < 0.5 ? 0x9aff6a : 0x6affc0, false]);
      emb.box(ex, s * 1.2, ez, s * 0.7, s * 0.9, s * 0.7, BLK, rr(), rr(), rr());   // el bicho
      emb.box(ex, s * 1.55, ez, s * 0.25, s * 0.25, s * 0.25, 0xff2a2a);             // su ojo
    }
    for (let i = 0; i < 9; i++) eslime.box(cx + (rr() - 0.5) * 1.6, 0.04, cz + (rr() - 0.5) * 1.3, 0.4, 0.06, 0.4, 0x3a8a2a);   // baba
  }
  add(emb, PLANTB.bodyMat, eg); add(em, PLANTB.eggMat, eg); add(eslime, PLANTB.glowMat, eg);
  // ---- cabeza: dos mandíbulas huecas de cubos (se abren desde la bisagra de atrás), labios, dientes, boca que brilla ----
  const head = new THREE.Group(); head.position.set(0, 5.1, -0.9); g.add(head); PLANTB.head = head;
  const up = new THREE.Group(), lo = new THREE.Group(); head.add(up); head.add(lo);
  PLANTB.upper = up; PLANTB.lower = lo;
  const hu = new MeshBuilder(), hl = new MeshBuilder(), gu = new MeshBuilder(), glo = new MeshBuilder();
  const JX = 1.95, JZ = 1.75, JC = 1.55;                                  // radios de las mandíbulas y centro (z)
  voxBlob(hu, gu, 0, 0, JC, JX, 1.15, JZ, 0.26, (x, yy, z) => {
    const f = pbHash(x, yy, z), h = pbHash(Math.floor(x / 0.8), 3, Math.floor(z / 0.8));
    if (yy < 0.2) return [GUM, false];                                  // labio (encía roja oscura)
    if (f > 0.93) return [GRN, true];
    if (h < 0.25) return [BLK, false];
    if (h < 0.35) return [SICK, false];
    return [PUR[Math.floor(f * 4)], false];
  }, (x, yy) => yy >= 0, 0.3);
  voxBlob(hl, glo, 0, 0, JC, JX - 0.1, 0.85, JZ - 0.1, 0.26, (x, yy, z) => {
    const f = pbHash(x, yy + 7, z);
    if (yy > -0.2) return [GUM, false];
    if (f > 0.93) return [GRN, true];
    return [f < 0.3 ? BLK : DPU, false];
  }, (x, yy) => yy <= 0, 0.3);
  for (let i = -6; i <= 6; i++) for (let k = -6; k <= 6; k++) {          // la boca por dentro: paladar y lengua que brillan
    const x = i * 0.26, z = JC + k * 0.26;
    if ((x / (JX - 0.4)) ** 2 + ((z - JC) / (JZ - 0.4)) ** 2 > 1) continue;
    gu.box(x, 0.3, z, 0.26, 0.06, 0.26, pbHash(x, 1, z) < 0.3 ? GRN : FLU);
    glo.box(x, -0.22, z, 0.26, 0.06, 0.26, pbHash(x, 2, z) < 0.25 ? 0x9a1a3a : 0x6a0a28);
  }
  for (let k = 0; k < 7; k++) glo.box(Math.sin(k * 0.8) * 0.1, -0.1 + (k > 4 ? -(k - 4) * 0.14 : 0), JC - 0.6 + k * 0.32, 0.5 - k * 0.03, 0.16, 0.34, 0xc8205a);   // lengua
  const rim = (k, n) => { const a = -1.5 + k / (n - 1) * 3.0; return [Math.sin(a) * (JX - 0.12), JC + Math.cos(a) * (JZ - 0.12)]; };
  for (let i = 0; i < 17; i++) {                                         // dientes de arriba (hacia abajo): colmillos cada 3
    const [x, z] = rim(i, 17), fang = i % 3 === 1, L = fang ? 0.75 : 0.42;
    for (let s = 0; s < (fang ? 4 : 3); s++) hu.box(x * (1 - s * 0.02), -0.05 - s * L / (fang ? 4 : 3), z, 0.16 - s * 0.03, L / (fang ? 4 : 3), 0.16 - s * 0.03, s > 1 ? BONED : BONE);
  }
  for (let i = 0; i < 15; i++) {                                         // dientes de abajo (hacia arriba)
    const [x, z] = rim(i + 1, 17), L = i % 4 === 2 ? 0.6 : 0.34;
    for (let s = 0; s < 3; s++) hl.box(x * 0.97, 0.02 + s * L / 3, z * 0.99, 0.14 - s * 0.03, L / 3, 0.14 - s * 0.03, s > 1 ? BONED : BONE);
  }
  for (let i = 0; i < 11; i++) {                                         // púas negras en el lomo de la cabeza
    const a = -1.3 + i * 0.26, x = Math.sin(a) * 1.2, z = JC + Math.cos(a) * 0.6 - 0.5;
    voxChain(hu, [x, 0.9, z], [Math.sin(a) * 0.5, 1, -0.3], 4 + (i % 3), 0.26, 0.08, BLK, 0, null);
  }
  for (let i = 0; i < 8; i++) {                                          // babas que cuelgan del borde (brillan)
    const [x, z] = rim(1 + i * 2, 17), L = 1 + (i % 3);
    for (let s = 0; s < L; s++) glo.box(x * 0.98, -0.3 - s * 0.2, z * 0.98, 0.07, 0.2, 0.07, GRN);
  }
  add(hu, PLANTB.bodyMat, up); add(gu, PLANTB.glowMat, up); add(hl, PLANTB.bodyMat, lo); add(glo, PLANTB.glowMat, lo);
  // caja de tiro de la cabeza (sin collider): recibe ×headMul
  const hh = new THREE.Mesh(new THREE.BoxGeometry(JX * 2, 2.2, JZ * 2), new THREE.MeshBasicMaterial());
  hh.visible = false; hh.userData = { type: 'plantBoss', head: true }; hh.scale.setScalar(C.scale); hh.rotation.y = g.rotation.y;
  g.updateMatrixWorld(true);
  head.localToWorld(hh.position.set(0, 0.2, JC)); scene.add(hh); hh.updateMatrixWorld(true);
  PLANTB.hitHead = hh;
  PLANTB.headHome = head.position.clone();                              // F5.24: al explotar se suelta; resetGame la vuelve
  buildPlantChunks();
  head.rotation.order = 'YXZ';                                         // F5.23: la cara gira (y) y después cabecea (x)
  PLANTB.jaw = { JC, JZ };
  plantHeadSync();
  buildPlantTongue();
  // ---- raíces sobre el Pack-a-Punch (hasta que lo escupe): una maraña de cubos con pústulas ----
  const S = CONFIG.PAP.spot, co = new MeshBuilder(), cog = new MeshBuilder(), crr = mulberry(77);
  co.setFrame(S.x, S.y || 0, S.z, S.rot || 0); cog.setFrame(S.x, S.y || 0, S.z, S.rot || 0);
  voxBlob(co, cog, 0, 0.9, 0, 1.0, 1.2, 0.8, 0.22, (x, yy, z) => { const f = pbHash(x, yy, z); return f > 0.93 ? [GRN, true] : [f < 0.3 ? BLK : f < 0.6 ? DPU : PUR[0], false]; });
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; voxChain(co, [Math.sin(a) * 0.8, 0.5 + crr(), Math.cos(a) * 0.6], [Math.sin(a), -0.7, Math.cos(a)], 6, 0.26, 0.1, BLK, 0.5, crr); }
  co.setFrame(null); cog.setFrame(null);
  PLANTB.cocoon = new THREE.Group(); scene.add(PLANTB.cocoon);
  add(co, PLANTB.bodyMat, PLANTB.cocoon); add(cog, PLANTB.glowMat, PLANTB.cocoon);
  // ---- la burbuja del portal: una cáscara de cubos de vidrio tornasolado ----
  const bb = new MeshBuilder();
  voxBlob(bb, bb, 0, 0, 0, 1, 1, 1, 0.16, (x, yy, z) => {
    const f = pbHash(x, yy, z), a = Math.atan2(z, x) + yy * 2;
    return [[0xff7aff, 0x7afff0, 0xfff07a, 0x9a7aff, 0x7aff9a][Math.floor((Math.sin(a) * 0.5 + 0.5) * 4.99)], f > 0.5];
  });
  PLANTB.bubble = bb.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false }));
  const T = CONFIG.PORTAL.temple;
  PLANTB.bubble.matrixAutoUpdate = true; PLANTB.bubble.userData.theme = false;
  PLANTB.bubble.position.set(T.x, (T.y || 0) + 1.9, T.z); PLANTB.bubble.visible = false;
  buildPlantRoots();
  resetPlantBoss();
}
// ---- el ataque de raíces: un pool de grupos (aviso en el piso + púas de raíz que suben) ----
function buildPlantRoots() {
  const R = CONFIG.PLANTBOSS.roots, rr = mulberry(911), sp = new MeshBuilder(), ring = new MeshBuilder(), cr = new MeshBuilder();
  for (let i = 0; i < 13; i++) {                                         // 13 púas curvas en un círculo del radio del golpe (F5.24: más ancho)
    const a = i / 13 * Math.PI * 2 + rr() * 0.4, r = i === 0 ? 0 : R.radius * (0.35 + rr() * 0.55);
    const h = i === 0 ? 11 : 6 + Math.floor(rr() * 4);
    voxChain(sp, [Math.cos(a) * r, 0, Math.sin(a) * r], [Math.cos(a) * 0.35 * (r ? 1 : 0), 1, Math.sin(a) * 0.35 * (r ? 1 : 0)], h, 0.5, 0.1,
             (j, k) => k > 0.8 ? 0x0a060c : j % 2 ? 0x3a0e48 : 0x5c1a74, 0.4, rr);
  }
  for (let i = 0; i < 28; i++) {                                         // el aviso: anillo de cubos verdes + grietas
    const a = i / 28 * Math.PI * 2;
    ring.box(Math.cos(a) * R.radius, 0.03, Math.sin(a) * R.radius, 0.3, 0.05, 0.3, 0x7aff3a);
    if (i % 3 === 0) for (let s = 1; s < 5; s++) ring.box(Math.cos(a + s * 0.05) * R.radius * s / 5, 0.02, Math.sin(a + s * 0.05) * R.radius * s / 5, 0.18, 0.04, 0.18, 0x3affa0);
  }
  for (let i = 0; i < 14; i++) {                                         // piedras de la plancha que saltan
    const a = rr() * Math.PI * 2, r = R.radius * (0.6 + rr() * 0.5);
    cr.box(Math.cos(a) * r, 0.15, Math.sin(a) * r, 0.35, 0.18, 0.3, [0x6a6a5a, 0x5e5e50][i % 2], rr(), a, rr());
  }
  const spG = sp.geometry(), ringG = ring.geometry(), crG = cr.geometry();
  for (let i = 0; i < R.pool; i++) {                                    // F5.24: 3 -> R.pool (salen más a la vez)
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    const spikes = new THREE.Mesh(spG, PLANTB.bodyMat), warn = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    const chips = new THREE.Mesh(crG, new THREE.MeshLambertMaterial({ vertexColors: true }));
    g.add(spikes); g.add(warn); g.add(chips);
    PLANTB.roots.push({ g, spikes, warn, chips, state: 'off', t: 0, x: 0, z: 0, hit: false });
  }
  buildPlantTrap();
}
// ---- F5.24: la jaula de raíces que te atrapa: 10 raíces en círculo que suben y se cierran arriba tuyo (una cúpula), con
// un anillo de aviso rojo y morado. Una sola (no hay dos jaulas a la vez) ----
function buildPlantTrap() {
  const T = CONFIG.PLANTBOSS.trap, rr = mulberry(4077), cg = new MeshBuilder(), rg = new MeshBuilder();
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, r = T.radius + 0.25;
    // sube derecha y se dobla hacia adentro: una cadena que gira hacia el centro
    let x = Math.cos(a) * r, z = Math.sin(a) * r, y = 0, dx = 0, dy = 1, dz = 0;
    for (let j = 0; j < 14; j++) {
      const k = j / 13, s = 0.36 - 0.24 * k;
      cg.box(x, y, z, s, s, s, k > 0.85 ? 0x0a060c : j % 3 === 0 ? 0x7aff3a : j % 2 ? 0x3a0e48 : 0x5c1a74);
      if (j > 4) { dx -= Math.cos(a) * 0.14; dz -= Math.sin(a) * 0.14; }   // se cierra hacia el centro
      const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
      x += dx * s * 0.9; y += dy * s * 0.9; z += dz * s * 0.9;
      x += (rr() - 0.5) * 0.04; z += (rr() - 0.5) * 0.04;
    }
    for (let j = 0; j < 3; j++) cg.box(Math.cos(a + 0.2) * (r + 0.1), 0.25 + j * 0.5, Math.sin(a + 0.2) * (r + 0.1), 0.12, 0.35, 0.12, 0x3a0e48);   // raicitas
  }
  for (let i = 0; i < 32; i++) {                                         // el aviso: anillo rojo con cubos morados
    const a = i / 32 * Math.PI * 2;
    rg.box(Math.cos(a) * T.radius, 0.03, Math.sin(a) * T.radius, 0.28, 0.05, 0.28, i % 2 ? 0xff2a3a : 0xb04aff);
  }
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const cage = new THREE.Mesh(cg.geometry(), PLANTB.bodyMat), warn = new THREE.Mesh(rg.geometry(),
    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
  g.add(cage); g.add(warn);
  PLANTB.trap = { g, cage, warn, state: 'off', t: 0, x: 0, z: 0, level: 0, hold: 0, tickT: 0 };
}
function plantRooted() { return !!PLANTB.trap && PLANTB.trap.state === 'hold'; }
// larga el aviso alrededor tuyo (en tu nivel, en el área del templo)
function plantTrapStart() {
  const TR = PLANTB.trap, P = player.pos, A = CONFIG.TEMPLE.area;
  if (!TR || TR.state !== 'off' || P.x < A[0] || P.x > A[1] || P.z < A[2] || P.z > A[3]) return false;
  const lv = playerLevel();
  TR.state = 'warn'; TR.t = 0; TR.x = P.x; TR.z = P.z; TR.level = lv;
  TR.g.position.set(P.x, lv ? lvY(lv) : groundY(P.x, P.z), P.z); TR.g.visible = true;
  TR.cage.position.y = -3.5; TR.warn.visible = true;
  playSample('pb_ataque_de_raices', { pos: [P.x, TR.g.position.y, P.z], maxDist: 60, vol: 1.2 });
  return true;
}
// un cuchillazo con la jaula cerrada: corta `cut` s
function plantRootCut() {
  const TR = PLANTB.trap;
  if (!TR || TR.state !== 'hold') return false;
  TR.hold -= CONFIG.PLANTBOSS.trap.cut;
  spawnSplashFx(player.pos.x, player.pos.y - 0.6, player.pos.z, 0x7a2a8a, 0.8);
  onHitConfirm(false, false);
  return true;
}
function updatePlantTrap(dt, t) {
  const TR = PLANTB.trap, T = CONFIG.PLANTBOSS.trap, P = player.pos;
  if (!TR || TR.state === 'off') return;
  TR.t += dt;
  if (TR.state === 'warn') {
    TR.warn.material.opacity = 0.4 + 0.5 * Math.abs(Math.sin(t * 16));
    TR.cage.position.y = -3.5 + 0.6 * Math.min(1, TR.t / T.warn) + Math.sin(t * 40) * 0.04;
    if (TR.t >= T.warn) {
      const caught = playerLevel() === TR.level && Math.hypot(P.x - TR.x, P.z - TR.z) < T.radius && !DOWN.on && !plantGrabbed();
      TR.state = caught ? 'hold' : 'down'; TR.t = 0; TR.hold = T.time; TR.tickT = 0; TR.warn.visible = false;
      spawnSplashFx(TR.x, TR.g.position.y + 0.4, TR.z, 0x5a3a2a, 2);
      if (caught) { showBanner('STAB THE ROOTS!', 2); if (typeof addTrauma === 'function') addTrauma(0.4); player.vel.set(0, 0, 0); }
    }
  } else if (TR.state === 'hold') {
    TR.cage.position.y = Math.min(0, TR.cage.position.y + dt * 14) + Math.sin(t * 22) * 0.02;
    P.x += (TR.x - P.x) * Math.min(1, dt * 6); P.z += (TR.z - P.z) * Math.min(1, dt * 6);   // te tira al medio
    if ((TR.tickT -= dt) <= 0) { TR.tickT = T.tick; damagePlayer(T.dps * T.tick, TR.x, TR.z, true, 'roots'); }
    if ((TR.hold -= dt) <= 0 || DOWN.on || state.gameOver || PLANTB.dead) { TR.state = 'down'; TR.t = 0; }
  } else if (TR.state === 'down') {
    TR.cage.position.y = Math.max(-3.5, TR.cage.position.y - dt * 8);
    if (TR.cage.position.y <= -3.5) { TR.state = 'off'; TR.g.visible = false; }
  }
}
// ---- F5.23: la cara te sigue. Recalcula la boca, el frente y la caja de tiro de la cabeza con el giro ----
function plantHeadSync() {
  const g = PLANTB.g, head = PLANTB.head, J = PLANTB.jaw, hh = PLANTB.hitHead;
  g.updateMatrixWorld(true);
  head.localToWorld(PLANTB.mouth.set(0, 0, J.JC + J.JZ));
  const yaw = g.rotation.y + head.rotation.y, C = CONFIG.PLANTBOSS;
  PLANTB.front.set(C.x + Math.sin(yaw) * 3.4 * C.scale, UP.y, C.z + Math.cos(yaw) * 3.4 * C.scale);
  head.localToWorld(hh.position.set(0, 0.2, J.JC));
  hh.rotation.set(0, yaw, 0); hh.updateMatrixWorld(true);
}
function plantFaceTrack(dt) {
  const C = CONFIG.PLANTBOSS, P = player.pos, g = PLANTB.g;
  let d = Math.atan2(P.x - C.x, P.z - C.z) - g.rotation.y - PLANTB.head.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));                            // el camino más corto
  const s = C.turn * dt;
  PLANTB.head.rotation.y += Math.abs(d) <= s ? d : Math.sign(d) * s;
}
// ---- F5.23: la lengua (InstancedMesh de cubos, se arma por frame siguiendo una curva) + su caja de tiro ----
const TONGUE_N = 64;
function buildPlantTongue() {
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ emissive: 0x5a0a22 }), TONGUE_N);
  m.frustumCulled = false; m.count = 0; m.visible = false; m.userData.theme = false;
  const cols = [0xc8205a, 0xb01848, 0xd83a6a, 0x9a1040];
  for (let i = 0; i < TONGUE_N; i++) {
    const tip = i >= TONGUE_N - 6, f = pbHash(i, 5, 1);
    m.setColorAt(i, _pbC.setHex(tip ? (f < 0.5 ? 0x7aff3a : 0x5a0a28) : f < 0.12 ? 0x3a0616 : cols[i % 4]));
  }
  m.instanceColor.needsUpdate = true;
  scene.add(m); PLANTB.tongue = m;
  // DoubleSide: con la lengua pegada al pecho, el ojo puede quedar adentro de la caja (el rayo tiene que salir igual)
  const hb = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  hb.visible = false; hb.userData = { type: 'plantTongue' }; scene.add(hb);
  PLANTB.tongueHit = hb;
}
// dibuja la lengua de la boca a la punta: se comba, ondula y se afina; en la punta, un grumo pegajoso
function drawTongue(t) {
  const T = PLANTB.tg, M = PLANTB.mouth, m = PLANTB.tongue, E = T.tip;
  const dx = E.x - M.x, dy = E.y - M.y, dz = E.z - M.z, L = Math.hypot(dx, dy, dz);
  if (L < 0.05) { m.visible = false; return; }
  const body = Math.min(TONGUE_N - 6, Math.max(2, Math.ceil(L / 0.3)));
  const yaw = Math.atan2(dx, dz), sag = Math.min(1.6, L * 0.12), px = -dz / (Math.hypot(dx, dz) || 1), pz = dx / (Math.hypot(dx, dz) || 1);
  let n = 0;
  const put = (x, y, z, s, ry, rx) => { _pbQ.setFromEuler(_pbE.set(rx || 0, ry, 0, 'YXZ')); _pbM.compose(_pbP.set(x, y, z), _pbQ, _pbS.set(s, s, s)); m.setMatrixAt(n++, _pbM); };
  for (let i = 0; i < body; i++) {
    const u = i / body, b = Math.sin(Math.PI * u), w = Math.sin(t * 9 + u * 11) * 0.18 * b;
    put(M.x + dx * u + px * w, M.y + dy * u - sag * b + Math.sin(t * 7 + u * 8) * 0.08 * b, M.z + dz * u + pz * w, 0.46 - 0.16 * u, yaw);
  }
  for (let i = 0; i < 6; i++) {                                         // la punta: cubos gordos pegoteados
    const a = i * 1.1 + t * 3, r = i ? 0.22 : 0;
    put(E.x + Math.cos(a) * r, E.y + Math.sin(a * 1.3) * r * 0.7, E.z + Math.sin(a) * r, i ? 0.3 : 0.5, yaw + a, a * 0.5);
  }
  m.count = n; m.instanceMatrix.needsUpdate = true; m.visible = true;
  const hb = PLANTB.tongueHit;                                          // la caja de tiro: de la boca a la punta, gorda
  hb.position.set((M.x + E.x) / 2, (M.y + E.y) / 2 - sag * 0.5, (M.z + E.z) / 2);
  hb.quaternion.setFromUnitVectors(_pbZ, _pbA.set(dx / L, dy / L, dz / L));
  hb.scale.set(0.9, 0.9 + sag, L); hb.updateMatrixWorld(true);
}
function tongueShootable(on) {
  const i = WORLD.hitMeshes.indexOf(PLANTB.tongueHit);
  if (on && i < 0) WORLD.hitMeshes.push(PLANTB.tongueHit);
  if (!on && i >= 0) WORLD.hitMeshes.splice(i, 1);
}
// agarrado o adentro de la boca: no caminás, no saltás, y la altura la pone la lengua (plantLiftY)
function plantGrabbed() { return PLANTB.tg.state === 'grab' || PLANTB.tg.state === 'swallow'; }
// la altura de los ojos mientras te lleva: sube de a poco con lo que avanzaste hacia la boca, hasta la boca
function plantLiftY() {
  const T = PLANTB.tg, U = CONFIG.PLANTBOSS.tongue, M = PLANTB.mouth, P = player.pos;
  if (T.state === 'swallow') return M.y - 0.2;
  const d = Math.hypot(P.x - M.x, P.z - M.z), span = Math.max(0.5, T.d0 - U.swallowAt);
  const k = Math.max(0, Math.min(1, 1 - (d - U.swallowAt) / span));
  T.k = k;                                                              // cuánto te falta (la vista nublada lo usa)
  return T.y0 + U.lift * Math.min(1, T.t / 0.3) * (1 - k) + (M.y - 0.2 - T.y0) * k * k * (3 - 2 * k);
}
// sonido de la planta (Nuevos sonidos 2/Planta Boss): uno al azar de la lista, desde la boca
function plantSfx(keys, vol) {
  const M = PLANTB.mouth, k = Array.isArray(keys) ? keys[Math.floor(Math.random() * keys.length)] : keys;
  playSample(k, { pos: [M.x, M.y, M.z], maxDist: 90, vol: vol || 1 });
}
function plantAttackSfx() { plantSfx(['pb_ataque', 'pb_ataque_2', 'pb_ataque_3', 'pb_ataque_4']); }
// el pecho del jugador (a donde se pega la lengua)
function chestPos(out) { return out.set(player.pos.x, player.pos.y - 0.6, player.pos.z); }
function canTongue() {
  const U = CONFIG.PLANTBOSS.tongue, P = player.pos, M = PLANTB.mouth;
  if (playerLevel() !== 1 || DOWN.on || BUNK.travel || state.gameOver) return false;
  const d = Math.hypot(P.x - M.x, P.z - M.z);
  return d >= U.min && d <= U.range && segmentClear(M.x, M.z, P.x, P.z, 0, true, undefined, 1);
}
// suelta al jugador y la lengua vuelve a la boca
function releaseTongue(cut) {
  const T = PLANTB.tg, U = CONFIG.PLANTBOSS.tongue;
  if (T.state === 'grab') DEBUG.safeFall = true;                       // te suelta en el aire: la caída no lastima
  plantFog(0);
  T.state = 'back'; T.t = 0; tongueShootable(false);
  T.cd = U.every[0] + Math.random() * (U.every[1] - U.every[0]);
  if (cut) {
    spawnSplashFx(T.tip.x, T.tip.y, T.tip.z, 0xc8205a, 1.6);
    playSample('sonido_de_escupir_planta_boss', { pos: [PLANTB.mouth.x, PLANTB.mouth.y, PLANTB.mouth.z], maxDist: 60, vol: 0.8 });
    PLANTB.flashT = 0.2;
  }
}
// tiro a la lengua: te suelta (U.shots tiros)
function plantTongueShot(point) {
  const T = PLANTB.tg;
  if (T.state !== 'grab' && T.state !== 'shoot') return false;
  if (point) spawnSplashFx(point.x, point.y, point.z, 0xc8205a, 0.5);
  onHitConfirm(false, false);
  if (++T.hits >= CONFIG.PLANTBOSS.tongue.shots) releaseTongue(true);
  return true;
}
// cuchillazo: cuenta si estás agarrado y mirás hacia la boca (±70°); U.stabs cuchillazos te sueltan
function plantTongueStab(dir) {
  const T = PLANTB.tg, M = PLANTB.mouth, P = player.pos;
  if (T.state !== 'grab') return false;
  const L = Math.hypot(M.x - P.x, M.z - P.z) || 1, dl = Math.hypot(dir.x, dir.z) || 1;
  if (((M.x - P.x) * dir.x + (M.z - P.z) * dir.z) / (L * dl) < Math.cos(70 * Math.PI / 180)) return false;
  chestPos(_pbA).addScaledVector(_pbS.set(M.x - P.x, 0, M.z - P.z).normalize(), 0.6);
  spawnSplashFx(_pbA.x, _pbA.y, _pbA.z, 0xc8205a, 0.7);
  onHitConfirm(false, false);
  if (++T.stabs >= CONFIG.PLANTBOSS.tongue.stabs) releaseTongue(true);
  return true;
}
// el arrastre (desde updatePlayer, con colisión): hacia la boca a U.drag m/s
function plantDragStep(dt) {
  if (PLANTB.tg.state === 'swallow') {                                  // adentro de la boca: te mete y te da vuelta hacia ella
    const M = PLANTB.mouth, P = player.pos, k = Math.min(1, dt * 5);
    P.x += (M.x - P.x) * k; P.z += (M.z - P.z) * k;
    const dx = PLANTB.g.position.x - P.x, dz = PLANTB.g.position.z - P.z;
    if (dx * dx + dz * dz > 0.01) {
      let d = Math.atan2(-dx, -dz) - player.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      player.yaw += d * k;
    }
    player.vel.x = player.vel.z = 0; return;
  }
  const U = CONFIG.PLANTBOSS.tongue, P = player.pos, M = PLANTB.mouth;
  const dx = M.x - P.x, dz = M.z - P.z, L = Math.hypot(dx, dz) || 1;
  moveAxis('x', dx / L * U.drag * dt);
  moveAxis('z', dz / L * U.drag * dt);
  player.vel.x = player.vel.z = 0;
}
// te traga (F5.23): llegaste a la boca con la vista nublada del todo. La lengua se mete, la boca se cierra y a
// swallowKill s el golpe letal (Quick Revive te deja tirado, como siempre)
function plantSwallow() {
  const T = PLANTB.tg, M = PLANTB.mouth;
  T.state = 'swallow'; T.t = 0; T.killed = false; tongueShootable(false); PLANTB.tongue.visible = false;
  PLANTB.chomp = CONFIG.PLANTBOSS.tongue.swallowTime; PLANTB.open = 0;
  spawnSplashFx(M.x, M.y - 0.5, M.z, 0x7aff3a, 2);
  if (typeof addTrauma === 'function') addTrauma(0.8);
  plantSfx('pb_ataque_3', 1.3); plantSfx('pb_splash', 1.2);
  plantFog(1);
}
// la vista nublada (gfx.js la compone con el resto del filtro)
function plantFog(k) {
  if ((GFX.fog || 0) === k) return;
  GFX.fog = k; gfxApplyFilter();
}
function updatePlantTongue(dt, t, near) {
  const U = CONFIG.PLANTBOSS.tongue, T = PLANTB.tg, M = PLANTB.mouth, P = player.pos;
  T.t += dt;
  if (T.state === 'off') {
    if (!near) return;
    if ((T.cd -= dt) <= 0) {
      if (canTongue()) { T.state = 'warn'; T.t = 0; if (typeof sfxPlantWarn === 'function') sfxPlantWarn(2); plantSfx(['pb_grunido', 'pb_grunido_2'], 1.1); }
      else T.cd = 0.4;
    }
  } else if (T.state === 'warn') {                                     // abre la boca y tiembla
    PLANTB.open = 1;
    PLANTB.head.rotation.z = Math.sin(t * 40) * 0.06;
    if (T.t >= U.warn) {
      if (!canTongue()) { T.state = 'off'; T.cd = 0.8; return; }
      chestPos(_pbA);
      T.full = M.distanceTo(_pbA); T.dir.copy(_pbA).sub(M).normalize();
      T.state = 'shoot'; T.t = 0; T.len = 0; T.hits = 0; T.stabs = 0;
      T.tip.copy(M); T.prev.copy(M);
      tongueShootable(true);
      playSample('sonido_de_escupir_planta_boss', { pos: [M.x, M.y, M.z], maxDist: 60, vol: 1 });
    }
  } else if (T.state === 'shoot') {                                    // sale derecho a donde estabas
    PLANTB.open = 1;
    T.prev.copy(T.tip);
    T.len += U.speed * dt;
    T.tip.copy(M).addScaledVector(T.dir, T.len);
    // ¿te toca en este frame? punto más cercano del tramo recorrido a tu pecho
    chestPos(_pbA);
    const sx = T.tip.x - T.prev.x, sy = T.tip.y - T.prev.y, sz = T.tip.z - T.prev.z, ss = sx * sx + sy * sy + sz * sz || 1;
    const k = Math.max(0, Math.min(1, ((_pbA.x - T.prev.x) * sx + (_pbA.y - T.prev.y) * sy + (_pbA.z - T.prev.z) * sz) / ss));
    const d = Math.hypot(T.prev.x + sx * k - _pbA.x, T.prev.y + sy * k - _pbA.y, T.prev.z + sz * k - _pbA.z);
    if (d <= U.miss && playerLevel() === 1 && !DOWN.on) {
      T.state = 'grab'; T.t = 0; T.stall = 0; T.lx = P.x; T.lz = P.z;
      T.d0 = Math.hypot(P.x - M.x, P.z - M.z); T.y0 = P.y;              // de dónde te levanta (plantLiftY)
      plantAttackSfx();
      showBanner('SHOOT OR STAB THE TONGUE!', 2);
      if (typeof addTrauma === 'function') addTrauma(0.4);
      damagePlayer(U.damage, M.x, M.z, true, 'tongue');
    } else if (T.len >= T.full + 2) { T.state = 'back'; T.t = 0; tongueShootable(false); T.cd = U.every[0] + Math.random() * (U.every[1] - U.every[0]); }
  } else if (T.state === 'grab') {                                     // te arrastra (plantDragStep lo hace en updatePlayer)
    PLANTB.open = 1;
    chestPos(T.tip);
    T.len = M.distanceTo(T.tip);
    if (DOWN.on || state.gameOver || playerLevel() !== 1 || T.t > U.maxGrab) { releaseTongue(false); return; }
    if (Math.random() < dt * 3) spawnSplashFx(T.tip.x, T.tip.y, T.tip.z, 0x7aff3a, 0.3);
    plantFog(Math.round(Math.min(1, 0.15 + 0.85 * (T.k || 0)) * 40) / 40);   // se nubla más cuanto más cerca de la boca
    // llegó a la boca: te traga. Trabado contra algo (no avanza): cerca de la boca te traga igual; lejos, te suelta
    const moved = Math.hypot(P.x - T.lx, P.z - T.lz), dM = Math.hypot(P.x - M.x, P.z - M.z); T.lx = P.x; T.lz = P.z;
    T.stall = moved < U.drag * dt * 0.25 ? T.stall + dt : 0;
    if (dM <= U.swallowAt || (T.stall >= U.stallTime && dM <= U.swallowAt * 2)) plantSwallow();
    else if (T.stall >= U.stallTime) releaseTongue(false);
  } else if (T.state === 'swallow') {                                  // adentro: mastica y a swallowKill te mata
    if (!T.killed && T.t >= U.swallowKill) {
      T.killed = true;
      plantSfx('pb_ataque_4', 1.2);
      damagePlayer(99999, M.x, M.z, true, 'tongue');
      plantFog(0);                                                      // la muerte (o el last stand) toma la pantalla
    }
    PLANTB.head.rotation.z = Math.sin(t * 30) * 0.07;                  // mastica sacudiéndose
    if (T.t >= U.swallowTime || (T.killed && (state.gameOver || DOWN.on))) {
      T.state = 'off'; T.cd = U.every[0] + Math.random() * (U.every[1] - U.every[0]);
      DEBUG.safeFall = true;                                            // la caída desde la boca no suma daño
      plantFog(0);
    }
    PLANTB.tongue.visible = false;
    return;
  } else if (T.state === 'back') {                                     // vuelve a la boca
    T.len = Math.max(0, T.len - U.back * dt);
    T.tip.sub(M).setLength(T.len).add(M);
    if (T.len <= 0) { T.state = 'off'; PLANTB.tongue.visible = false; return; }
  }
  if (T.state !== 'off' && T.state !== 'warn') drawTongue(t);
  else PLANTB.tongue.visible = false;
}
function plantOn() { return CONFIG.PLANTBOSS.enabled && !!PLANTB.g; }
// el PaP ya salió (o no hay planta): souls.js lo pide para prenderse
function plantPapFree() { return !plantOn() || PLANTB.spat; }
// ¿el jugador está en el área del templo? (F5.22: la planta ataca y se le pega desde cualquier lugar del área, en el
// piso o arriba de la plancha; de afuera del templo la bala le pega a la piedra)
function inTempleArea() {
  const A = CONFIG.TEMPLE.area, P = player.pos;
  return P.x >= A[0] && P.x <= A[1] && P.z >= A[2] && P.z <= A[3];
}
function plantShooterOk() { return inTempleArea(); }
// la barra de boss (boss.js): despierta, viva y con vos en el templo
function plantBossBar() {
  return plantOn() && PLANTB.awake && !PLANTB.dead && inTempleArea();
}
function wakePlant() {
  if (PLANTB.awake) return;
  const C = CONFIG.PLANTBOSS;
  PLANTB.awake = true;
  PLANTB.max = PLANTB.hp = Math.round(CONFIG.BOSS.health(Math.max(1, state.round)) * C.hpMul);   // el Sombrerón de la ronda × hpMul
  PLANTB.spitT = 1.5; PLANTB.inkT = 1; PLANTB.sumT = 2; PLANTB.rootT = 2.5; PLANTB.tg.cd = 2;
  PLANTB.trapT = C.trap.every[0];                                        // F5.24: la primera jaula tarda
  showBanner(C.name + ' AWAKENS', 3);
  if (typeof sfxGiantRoar === 'function') sfxGiantRoar();
  plantSfx('pb_grunido', 1.4);
}
// daño (balas, cuchillo, explosiones). true = le pegó (viva)
function plantBossHit(dmg, head, point) {
  if (!plantOn() || PLANTB.dead || !(dmg > 0) || !plantShooterOk()) return false;
  wakePlant();
  const d = dmg * (head ? CONFIG.PLANTBOSS.headMul : 1);
  PLANTB.hp -= d; PLANTB.flashT = 0.12;
  addPoints(CONFIG.POINTS.hit);
  if (point) { spawnDamageNumber(PLANTB, point, d, head); spawnSplashFx(point.x, point.y, point.z, 0x7aff3a, 0.35); }
  const kill = PLANTB.hp <= 0;
  if (kill) plantDeath();
  else if (clock.elapsedTime - (PLANTB.hurtT || 0) >= CONFIG.PLANTBOSS.hurtGap) {   // se queja (no en cada bala)
    PLANTB.hurtT = clock.elapsedTime;
    if (PLANTB.hp / PLANTB.max < CONFIG.PLANTBOSS.low) plantSfx('pb_dano_cuando_este_menos_de_20', 1.1);
    else plantSfx(['pb_dano', 'pb_dano_2', 'pb_dano_3'], 0.9);
  }
  onHitConfirm(head, kill);
  return true;
}
// explosión: distancia al punto más cercano del cuerpo (caja), solo desde arriba de la plancha
function plantBossBlast(x, y, z, center, R, gl) {
  if (!plantOn() || PLANTB.dead || gl !== 1) return 0;
  const B = CONFIG.PLANTBOSS.box, py = UP.y;
  const cx = Math.max(B[0], Math.min(B[1], x)), cy = Math.max(py, Math.min(py + B[4] + 1.5, y)), cz = Math.max(B[2], Math.min(B[3], z));
  const d = Math.hypot(cx - x, cy - y, cz - z);
  if (d > R) return 0;
  const dmg = center * (1 - (1 - CONFIG.GRENADE.edgeMul) * d / R);
  return plantBossHit(dmg, false, _pbA.set(cx, cy + 0.5, cz)) ? 1 : 0;
}
function plantDeath() {
  const C = CONFIG.PLANTBOSS;
  PLANTB.dead = true; PLANTB.hp = 0; PLANTB.deathT = 0; PLANTB.jetT = 0; PLANTB.burst = 0;
  for (const R of PLANTB.roots) if (R.state !== 'off') { R.state = 'down'; R.t = 0; }
  STATS.bosses++;
  addXP(C.xp);
  state.points += C.points; STATS.pointsEarned += C.points; pendingPts += C.points;   // fijo: sin doble puntos
  // F5.24 (Diego): el doble de volumen (deathVol)
  playSample('muerte_de_planta_carnivora_en_templo', { pos: [PLANTB.mouth.x, PLANTB.mouth.y, PLANTB.mouth.z], maxDist: 120, vol: C.deathVol });
  if (PLANTB.trap && PLANTB.trap.state !== 'off' && PLANTB.trap.state !== 'down') { PLANTB.trap.state = 'down'; PLANTB.trap.t = 0; }
  showBanner(C.name + ' IS DOWN', 3);
  // F5.26: sus trofeos caen delante de ella, arriba de la plancha
  const fx = PLANTB.mouth ? PLANTB.mouth.x : C.x, fz = PLANTB.mouth ? PLANTB.mouth.z : C.z;
  bossTrophies('plant', fx, fz, 1);
  startPlantCine();
}
// ---- F5.22: animación (el juego sigue, sin tomar la cámara): se retuerce, escupe el PaP (vuela a su lugar dando vueltas),
// aterriza, y la burbuja se forma en el portal ----
function startPlantCine() {
  PLANTB.anim = true; PLANTB.cineT = 0; PLANTB.boomed = false;
  if (RELICS.pap && !PLANTB.papHome) PLANTB.papHome = { p: RELICS.pap.g.position.clone(), r: RELICS.pap.g.rotation.clone() };
}
// ---- F5.24: la explosión. Pedazos de cubos (un InstancedMesh creado una vez) con física simple sobre la plancha ----
function buildPlantChunks() {
  const N = CONFIG.PLANTBOSS.chunks, m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), N);
  m.frustumCulled = false; m.count = 0; m.visible = false; m.userData.theme = false;
  const cols = [0x6a2082, 0x3a0e48, 0x160c1a, 0x7aff3a, 0x842ea0, 0x5c1a74, 0xc8205a];
  for (let i = 0; i < N; i++) m.setColorAt(i, _pbC.setHex(cols[i % cols.length]));
  m.instanceColor.needsUpdate = true;
  scene.add(m);
  PLANTB.chunks = { m, list: Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), w: new THREE.Vector3(), s: 0.3, life: 0 })) };
}
function updatePlantChunks(dt) {
  const CH = PLANTB.chunks;
  if (!CH || !CH.m.visible) return;
  const m = CH.m, fl = UP.y;
  let alive = 0;
  CH.list.forEach((c, i) => {
    c.life -= dt;
    if (c.life > 0) {
      alive++;
      c.v.y -= 16 * dt; c.p.addScaledVector(c.v, dt); c.r.addScaledVector(c.w, dt);
      if (c.p.y < fl + c.s / 2) { c.p.y = fl + c.s / 2; c.v.y *= -0.3; c.v.x *= 0.6; c.v.z *= 0.6; c.w.multiplyScalar(0.6); }
    }
    const s = c.s * Math.max(0, Math.min(1, c.life / 0.6));
    _pbQ.setFromEuler(_pbE.set(c.r.x, c.r.y, c.r.z)); _pbM.compose(c.p, _pbQ, _pbS.set(s, s, s)); m.setMatrixAt(i, _pbM);
  });
  m.instanceMatrix.needsUpdate = true;
  if (!alive) m.visible = false;
}
// el cuerpo de la planta deja de ser sólido (y la cabeza de recibir balas) al explotar; vuelve con resetGame
function plantBodySolid(on) {
  const r = WORLD.plantBody;
  if (!r || r.col.solid === on) return;
  r.col.solid = on;
  const i = WORLD.hitMeshes.indexOf(r.mesh);
  if (on && i < 0) WORLD.hitMeshes.push(r.mesh);
  if (!on && i >= 0) WORLD.hitMeshes.splice(i, 1);
  const h = WORLD.hitMeshes.indexOf(PLANTB.hitHead);
  if (!on && h >= 0) WORLD.hitMeshes.splice(h, 1);
  buildNavGrid();                                                       // la celda de la planta se camina (y vuelve)
}
function plantExplode() {
  const C = CONFIG.PLANTBOSS, g = PLANTB.g, cx = C.x, cz = C.z, y = UP.y;
  PLANTB.boomed = true;
  PLANTB.boom = PLANTB.mouth.clone();                                   // de acá sale el PaP
  // la cabeza se suelta (queda en la escena) y el resto desaparece
  scene.attach(PLANTB.head);
  PLANTB.headFrom = PLANTB.head.position.clone(); PLANTB.headRot0 = PLANTB.head.rotation.clone();
  g.visible = false;
  plantBodySolid(false);
  // los pedazos
  const CH = PLANTB.chunks;
  if (CH) {
    CH.m.visible = true; CH.m.count = CH.list.length;
    for (const c of CH.list) {
      const a = Math.random() * Math.PI * 2, h = 0.5 + Math.random() * 4.5, sp = 3 + Math.random() * 7;
      c.p.set(cx + Math.cos(a) * 1.2, y + h, cz + Math.sin(a) * 1.2);
      c.v.set(Math.cos(a) * sp, 4 + Math.random() * 8, Math.sin(a) * sp);
      c.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); c.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      c.s = 0.25 + Math.random() * 0.45; c.life = 3 + Math.random() * 2;
    }
  }
  for (let k = 0; k < 5; k++) spawnSplashFx(cx + (Math.random() - 0.5) * 3, y + 1 + Math.random() * 4, cz + (Math.random() - 0.5) * 3, k % 2 ? 0x7aff3a : 0x8a2aa0, 3);
  spawnSplashFx(cx, y + 0.5, cz, 0xffd23a, 3.5);
  if (typeof addTrauma === 'function') addTrauma(0.9);
  const d = Math.hypot(player.pos.x - cx, player.pos.z - cz);
  sfxExplosion(d);
  playSample('pb_splash', { pos: [cx, y + 1, cz], maxDist: 90, vol: 1.6 });
  portalPuddleGrow();                                                   // bunker.js: el charco amarillo empieza a crecer
}
function endPlantCine() {
  PLANTB.anim = false;
  const H = PLANTB.papHome;
  if (H && RELICS.pap) { RELICS.pap.g.position.copy(H.p); RELICS.pap.g.rotation.copy(H.r); RELICS.pap.g.scale.setScalar(1); RELICS.pap.g.updateMatrixWorld(true); }
}
// el PaP sale de las raíces y se prende si ya estaba todo lo demás
function plantSpitPap() {
  PLANTB.spat = true;
  if (PLANTB.cocoon) PLANTB.cocoon.visible = false;
  if (RELICS.pap) RELICS.pap.g.visible = true;
  const S = CONFIG.PAP.spot;
  spawnSplashFx(S.x, (S.y || 0) + 1, S.z, 0x7aff3a, 2.5);
  checkPap();
  showBanner('THE MAW SPAT OUT THE PACK-A-PUNCH', 3);
}
function updatePlantCine(dt, t) {
  const C = CONFIG.PLANTBOSS, K = C.cine, S = CONFIG.PAP.spot;
  const c = (PLANTB.cineT += dt);
  const sy = (S.y || 0) + 1, t1 = K.rear, t2 = t1 + K.fly;
  const papG = RELICS.pap && RELICS.pap.g, H = PLANTB.papHome;
  // la planta: se retuerce (tiembla, se hincha cada vez más, echa la cabeza atrás) y a los t1 s EXPLOTA (F5.24)
  if (c < t1) {
    const k = c / t1, M = PLANTB.mouth;
    PLANTB.head.rotation.x = -0.55 * k + Math.sin(c * 30) * 0.05 * k; PLANTB.head.rotation.z = Math.sin(c * 23) * 0.08 * k;
    PLANTB.upper.rotation.x = -0.15 - 0.2 * k; PLANTB.lower.rotation.x = 0.15;
    PLANTB.g.scale.setScalar(C.scale * (1 + 0.16 * k * k + Math.sin(c * 26) * 0.03 * k));
    if (Math.random() < dt * 10) spawnSplashFx(M.x, M.y - 0.5, M.z, 0x7aff3a, 0.6);
  } else if (!PLANTB.boomed) plantExplode();
  // la cabeza: vuela en arco dando vueltas y cae de costado en una esquina de la plancha, con la boca entreabierta
  if (PLANTB.boomed && PLANTB.headFrom) {
    const R = C.headRest, f = Math.min(1, (c - t1) / K.headFly), e = f * (2 - f), hd = PLANTB.head;
    const ty = UP.y + R.y;                                               // casi derecha, apoyada en la mandíbula de abajo
    hd.position.set(PLANTB.headFrom.x + (R.x - PLANTB.headFrom.x) * e, PLANTB.headFrom.y + (ty - PLANTB.headFrom.y) * f + Math.sin(f * Math.PI) * 6,
                    PLANTB.headFrom.z + (R.z - PLANTB.headFrom.z) * e);
    hd.rotation.set(0.3 * f + (1 - f) * c * 5, R.ry + (1 - f) * c * 3, 0.22 * f);
    PLANTB.upper.rotation.x = -0.45; PLANTB.lower.rotation.x = 0.35;
    if (f >= 1 && !PLANTB.headDown) {
      PLANTB.headDown = true;
      spawnSplashFx(R.x, UP.y + 0.3, R.z, 0x5a3a2a, 2.5);
      if (typeof addTrauma === 'function') addTrauma(0.3);
    }
  }
  // el PaP: sale de la explosión chico, crece, vuela en arco dando vueltas y aterriza en su lugar
  const M = PLANTB.boom || PLANTB.mouth;
  if (papG && H && !PLANTB.spat) {
    if (c < t1) papG.visible = false;
    else if (c < t2) {
      const f = (c - t1) / K.fly, e = f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f);
      papG.visible = true;
      papG.position.set(M.x + (H.p.x - M.x) * e, M.y + (H.p.y - M.y) * e + Math.sin(e * Math.PI) * 7, M.z + (H.p.z - M.z) * e);
      papG.rotation.set(H.r.x + (1 - e) * 5.5, H.r.y + (1 - e) * 3.1, H.r.z + (1 - e) * 2.2);
      papG.scale.setScalar(Math.min(1, 0.35 + f * 2));
      papG.updateMatrixWorld(true);
      if (PLANTB.cocoon) PLANTB.cocoon.scale.set(1, Math.max(0.05, 1 - f * 1.2), 1);   // las raíces se abren
      if (Math.random() < dt * 14) spawnSplashFx(papG.position.x, papG.position.y, papG.position.z, 0x7aff3a, 0.7);
      if (c - dt < t1) playSample('sonido_de_escupir_planta_boss', { pos: [M.x, M.y, M.z], maxDist: 90, vol: 1.4 });
    } else {
      papG.position.copy(H.p); papG.rotation.copy(H.r); papG.scale.setScalar(1); papG.updateMatrixWorld(true);
      if (PLANTB.cocoon) PLANTB.cocoon.scale.set(1, 1, 1);
      plantSpitPap();
      if (typeof addTrauma === 'function') addTrauma(0.5);
      spawnSplashFx(S.x, sy, S.z, 0x9a8a6a, 3);
    }
  } else if (!PLANTB.spat && c >= t2) plantSpitPap();
  // F5.24: sin burbuja: el portal es el charco amarillo que dejó la explosión (bunker.js lo hace crecer y lo abre)
  if (c >= K.dur) endPlantCine();
}
// un chorro de tinta desde la boca (el de los calamares, con más alcance; updateSquids lo mueve y pega)
function plantCanInk() {
  const J = CONFIG.PLANTBOSS.jet, P = player.pos, d = Math.hypot(P.x - PLANTB.mouth.x, P.z - PLANTB.mouth.z);
  if (d < J.range[0] || d > J.range[1]) return false;
  // la línea sale de adelante del cuerpo (desde adentro de su propia caja siempre estaría tapada)
  return playerLevel() !== 1 || segmentClear(PLANTB.front.x, PLANTB.front.z, P.x, P.z, 0, true, undefined, 1);
}
function plantInk() {
  const J = CONFIG.PLANTBOSS.jet, I = CONFIG.SQUID.ink, P = player.pos, s = INK.shots.find(q => !q.active);
  if (!s) return false;
  s.p.copy(PLANTB.mouth);
  const T = Math.max(0.3, Math.hypot(P.x - s.p.x, P.z - s.p.z) / J.speed), ty = P.y - 0.5;
  const j = () => (Math.random() * 2 - 1) * I.spread * J.speed;
  s.v.set((P.x - s.p.x) / T + j(), (ty - s.p.y) / T + 0.5 * I.gravity * T + j(), (P.z - s.p.z) / T + j());
  s.dmg = I.dps / I.rate * J.size; s.ox = CONFIG.PLANTBOSS.x; s.oz = CONFIG.PLANTBOSS.z; s.active = true;
  s.m.position.copy(s.p); s.m.visible = true;
  return true;
}
// un escupitajo de la ráfaga: el del medio a vos, los otros abiertos `spread` m a los costados
function plantSpitOne(i, n) {
  const C = CONFIG.PLANTBOSS, P = player.pos, M = PLANTB.mouth;
  const dx = P.x - M.x, dz = P.z - M.z, L = Math.hypot(dx, dz) || 1, off = (i - (n - 1) / 2) * C.spit.spread;
  if (!spitAcid(M.x, M.y, M.z, playerLevel(), P.x - dz / L * off, P.z + dx / L * off)) return false;   // F5.22: también al piso
  PLANTB.open = 1;
  if (i === 0) playSample('sonido_de_escupir_planta_boss', { pos: [M.x, M.y, M.z], maxDist: 70 });
  return true;
}
// raíces: salen donde vas a estar (con un poco de ventaja) y, con más de una, alrededor
function plantRoots(n) {
  const R = CONFIG.PLANTBOSS.roots, P = player.pos;
  const bx = P.x + player.vel.x * R.lead, bz = P.z + player.vel.z * R.lead;
  let made = 0;
  for (let i = 0; i < n; i++) {
    const r = PLANTB.roots.find(q => q.state === 'off');
    if (!r) break;
    const a = Math.random() * Math.PI * 2, d = i === 0 ? 0 : R.spread[0] + Math.random() * (R.spread[1] - R.spread[0]);   // F5.24: más abiertas
    const x = bx + Math.cos(a) * d, z = bz + Math.sin(a) * d;
    // F5.22: en el nivel donde estás (la plancha o el piso del templo), en una celda caminable del área
    const lv = playerLevel(), cx = Math.floor(x), cz = Math.floor(z), A = CONFIG.TEMPLE.area;
    if (x < A[0] || x > A[1] || z < A[2] || z > A[3] || !(lv ? isUp(cx, cz) : isNav(cx, cz))) continue;
    r.state = 'warn'; r.t = 0; r.x = x; r.z = z; r.hit = false; r.level = lv;
    r.g.position.set(x, lv ? UP.y : groundY(x, z), z); r.g.rotation.y = Math.random() * 6.28; r.g.visible = true;
    r.spikes.position.y = -3.2; r.chips.visible = false; r.warn.visible = true;
    made++;
  }
  if (made && typeof sfxPlantWarn === 'function') sfxPlantWarn(4);
  if (made) playSample('pb_ataque_de_raices', { pos: [bx, UP.y, bz], maxDist: 60, vol: 1.1 });   // desde el piso donde salen
  return made;
}
function updatePlantRoots(dt, t) {
  const R = CONFIG.PLANTBOSS.roots, P = player.pos;
  for (const r of PLANTB.roots) {
    if (r.state === 'off') continue;
    r.t += dt;
    if (r.state === 'warn') {
      r.warn.material.opacity = 0.35 + 0.55 * Math.abs(Math.sin(t * 14));
      r.warn.scale.setScalar(0.6 + 0.4 * Math.min(1, r.t / R.warn));
      r.spikes.position.y = -3.2 + 0.5 * Math.min(1, r.t / R.warn) + Math.sin(t * 40) * 0.05;   // asoman
      if (r.t >= R.warn) { r.state = 'rise'; r.t = 0; r.chips.visible = true; r.warn.visible = false; }
    } else if (r.state === 'rise') {
      const k = Math.min(1, r.t / R.rise);
      r.spikes.position.y = -2.7 + 2.7 * k; r.chips.position.y = 0.6 * k;
      if (!r.hit) {                                                      // te pegan y te levantan (una vez)
        r.hit = true;
        if (playerLevel() === r.level && Math.hypot(P.x - r.x, P.z - r.z) < R.radius) {
          damagePlayer(R.damage, r.x, r.z, false, 'roots');
          player.vel.y = R.lift; player.grounded = false;
          const L = Math.hypot(P.x - r.x, P.z - r.z) || 1;
          player.pushX = (P.x - r.x) / L * 3; player.pushZ = (P.z - r.z) / L * 3; player.pushT = 0.3;
        }
        spawnSplashFx(r.x, r.g.position.y + 0.5, r.z, 0x5a3a2a, 1.8);
        if (typeof addTrauma === 'function') addTrauma(Math.max(0, 0.45 - Math.hypot(P.x - r.x, P.z - r.z) * 0.03));
      }
      if (k >= 1) { r.state = 'hold'; r.t = 0; }
    } else if (r.state === 'hold') {
      r.spikes.position.y = Math.sin(t * 25) * 0.03; r.chips.position.y = Math.max(0, 0.6 - r.t * 1.5);
      if (r.t >= R.hold) { r.state = 'down'; r.t = 0; }
    } else if (r.state === 'down') {
      const k = Math.min(1, r.t / R.down);
      r.spikes.position.y = -3.2 * k; r.chips.visible = false; r.warn.visible = false;
      if (k >= 1) { r.state = 'off'; r.g.visible = false; }
    }
  }
}
// una horda: calamares del pool en celdas de la plancha, entre 3 y 8 m de la planta, del lado de la nave
function plantSummon() {
  const C = CONFIG.PLANTBOSS, U = C.summon;
  let alive = 0;
  for (const q of SQPOOL) if (q.active && q.alive && q.fromPlant) alive++;
  let n = Math.min(U.count, U.max - alive), k = 0;
  if (n <= 0) return 0;
  const yaw = PLANTB.g.rotation.y, out = [];
  for (let tries = 0; tries < 40 && out.length < n; tries++, k++) {
    const a = yaw + (k % 7 - 3) * 0.3, r = 3 + (k % 6);
    const x = C.x + Math.sin(a) * r, zz = C.z + Math.cos(a) * r, cx = Math.floor(x), cz = Math.floor(zz);
    if (!isUp(cx, cz) || out.some(p => p[0] === cx && p[1] === cz)) continue;
    out.push([cx, cz]);
  }
  let made = 0;
  for (const [cx, cz] of out) {
    const q = SQPOOL.find(s => !s.active);
    if (!q) break;
    resetZombie(q, { x: cx + 0.5, z: cz + 0.5 }, false);
    q.level = 1; q.fromPlant = true; q.fromClam = true;               // extra de la ronda (como los de las almejas)
    state.zombies.push(q); made++;
    spawnSplashFx(cx + 0.5, UP.y + 0.4, cz + 0.5, 0x7a2a8a, 1);
  }
  if (made) playSample('invocar_calamares_planta_boss', { pos: [PLANTB.mouth.x, PLANTB.mouth.y, PLANTB.mouth.z], maxDist: 80, vol: 1.2 });
  return made;
}
function updatePlantBoss(dt, t) {
  if (!plantOn()) return;
  const C = CONFIG.PLANTBOSS, P = player.pos;
  // color: morada/negra/verde fluorescente -> negra con la vida que pierde
  const k = PLANTB.dead ? 1 : PLANTB.awake && PLANTB.max ? 1 - PLANTB.hp / PLANTB.max : 0;
  PLANTB.bodyMat.color.copy(_pbW).lerp(_pbC.setHex(0x1a141c), k * 0.85);
  PLANTB.glowMat.color.copy(_pbW).lerp(_pbC.setHex(0x0a120a), k * 0.92);
  PLANTB.eggMat.color.copy(_pbW).lerp(_pbC.setHex(0x101810), k * 0.8);
  PLANTB.flashT = Math.max(0, PLANTB.flashT - dt);
  PLANTB.bodyMat.emissive.setHex(PLANTB.flashT > 0 ? 0x3a0a0a : 0x000000);
  PLANTB.eggs.scale.setScalar(1 + 0.05 * Math.sin(t * 2.3));            // los huevos laten
  updatePlantRoots(dt, t);
  updatePlantTrap(dt, t);                                                // F5.24
  updatePlantChunks(dt);                                                 // F5.24: los pedazos de la explosión
  if (PLANTB.bubbleT >= 0) {                                             // la burbuja crece y se abre el portal adentro
    PLANTB.bubbleT += dt;
    const f = Math.min(1, PLANTB.bubbleT / C.bubble), s = 2.9 * (f < 1 ? f * f * (3 - 2 * f) : 1);
    PLANTB.bubble.scale.set(s * (1 + 0.04 * Math.sin(t * 3)), s * (1 + 0.04 * Math.cos(t * 2.6)), s);
    PLANTB.bubble.rotation.y = t * 0.3;
    if (f >= 1 && !PORTAL.open) {                                        // se abre el portal y la burbuja revienta (F5.22)
      openPortals();
      const B = PLANTB.bubble.position;
      PLANTB.bubble.visible = false; PLANTB.bubbleT = -1;
      spawnSplashFx(B.x, B.y, B.z, 0xd8b0ff, 3);
    }
  }
  if (PLANTB.anim) updatePlantCine(dt, t);                             // F5.22: el juego sigue mientras escupe el PaP
  if (PLANTB.dead) {
    if (PLANTB.tg.state !== 'off') { if (PLANTB.tg.state !== 'back') releaseTongue(false); updatePlantTongue(dt, t, false); }
    return;
  }
  // respira y la cabeza se hamaca; la boca se abre al escupir (y al sacar la lengua); al tragar, cierra de golpe
  PLANTB.open = Math.max(0, PLANTB.open - dt * 1.6);
  PLANTB.chomp = Math.max(0, PLANTB.chomp - dt);
  const o = PLANTB.chomp > 0 ? -0.5 : Math.max(PLANTB.open, PLANTB.jetT > 0 ? 1 : 0);
  const br = 0.06 * Math.sin(t * 1.7);                                   // respira con la boca entreabierta
  PLANTB.upper.rotation.x = -0.28 - br - 0.45 * o; PLANTB.lower.rotation.x = 0.2 + br + 0.3 * o;
  PLANTB.head.rotation.z = Math.sin(t * 0.7) * 0.05; PLANTB.head.rotation.x = Math.sin(t * 0.9) * 0.04 + (PLANTB.chomp > 0 ? 0.25 : 0);
  const near = inTempleArea() && !DOWN.on;                              // F5.22: toda el área del templo
  if (near || PLANTB.tg.state !== 'off') plantFaceTrack(dt);          // F5.23: la cara te sigue
  plantHeadSync();
  if (PLANTB.awake) updatePlantTongue(dt, t, near && state.running);
  if (!PLANTB.awake) { if (near && state.running) wakePlant(); return; }
  if (!near || !state.running) return;
  if ((PLANTB.growlT -= dt) <= 0) {                                      // gruñe de vez en cuando
    PLANTB.growlT = C.growl[0] + Math.random() * (C.growl[1] - C.growl[0]);
    if (PLANTB.tg.state === 'off') plantSfx(['pb_grunido', 'pb_grunido_2'], 0.9);
  }
  if (PLANTB.tg.state !== 'off' && PLANTB.tg.state !== 'back') return;   // con la lengua afuera no escupe ni echa raíces
  const frac = PLANTB.hp / PLANTB.max, dm = Math.hypot(P.x - PLANTB.mouth.x, P.z - PLANTB.mouth.z);
  const ph = frac > C.half ? 0 : frac > C.low ? 1 : 2;
  // raíces (todas las fases, más seguido y más a la vez cuanto menos vida)
  const R = C.roots;
  if ((PLANTB.rootT -= dt) <= 0) {
    PLANTB.rootT = plantRoots(R.count[ph]) ?R.every[ph][0] + Math.random() * (R.every[ph][1] - R.every[ph][0]) : 0.5;
  }
  const TP = C.trap;                                                     // F5.24: la jaula de raíces (todas las fases)
  if ((PLANTB.trapT -= dt) <= 0) PLANTB.trapT = plantTrapStart() ? TP.every[0] + Math.random() * (TP.every[1] - TP.every[0]) : 1;
  if (ph === 0) {                                                        // 1: ráfagas de 3 escupitajos
    if (PLANTB.burst > 0) {
      if ((PLANTB.burstT -= dt) <= 0) {
        const n = C.spit.burst, i = n - PLANTB.burst;
        plantSpitOne(i, n); PLANTB.burst--; PLANTB.burstT = C.spit.gap;
      }
    } else if ((PLANTB.spitT -= dt) <= 0) {
      if (dm < C.spit.range) { PLANTB.burst = C.spit.burst; PLANTB.burstT = 0; plantAttackSfx(); PLANTB.spitT = C.spit.every[0] + Math.random() * (C.spit.every[1] - C.spit.every[0]); }
      else PLANTB.spitT = 0.5;
    }
    return;
  }
  const J = C.jet;                                                       // 2 y 3: el chorro del calamar
  if (PLANTB.jetT > 0) {
    PLANTB.jetT -= dt; PLANTB.jetAcc += dt * CONFIG.SQUID.ink.rate;
    if (!plantCanInk()) PLANTB.jetT = 0;
    while (PLANTB.jetAcc >= 1 && PLANTB.jetT > 0) { PLANTB.jetAcc -= 1; plantInk(); }
    if (PLANTB.jetT <= 0) PLANTB.inkT = J.rest;
  } else if ((PLANTB.inkT -= dt) <= 0) {
    if (plantCanInk()) { PLANTB.jetT = J.jet; PLANTB.jetAcc = 1; sfxInk(dm); plantAttackSfx(); }
    else PLANTB.inkT = 0.5;
  }
  if (ph === 2 && (PLANTB.sumT -= dt) <= 0) { PLANTB.sumT = C.summon.every; plantSummon(); }   // 3: hordas
}
function resetPlantBoss() {
  if (!PLANTB.g) return;
  const on = CONFIG.PLANTBOSS.enabled;
  if (PLANTB.anim) endPlantCine();
  Object.assign(PLANTB, { hp: 0, max: 0, awake: false, dead: false, spat: !on, deathT: 0, bubbleT: -1, burst: 0, burstT: 0, rootT: 0,
                          spitT: 0, jetT: 0, jetAcc: 0, inkT: 0, sumT: 0, open: 0, flashT: 0, anim: false, cineT: 0 });
  // F5.24: la cabeza vuelve a su lugar (al explotar quedó suelta en la escena), el cuerpo vuelve a ser sólido y sin pedazos
  if (PLANTB.head.parent !== PLANTB.g) PLANTB.g.add(PLANTB.head);
  if (PLANTB.headHome) PLANTB.head.position.copy(PLANTB.headHome);
  PLANTB.head.scale.setScalar(1); PLANTB.boomed = false; PLANTB.headFrom = null; PLANTB.headDown = false; PLANTB.boom = null;
  if (PLANTB.chunks) { PLANTB.chunks.m.visible = false; for (const c of PLANTB.chunks.list) c.life = 0; }
  if (on) plantBodySolid(true);
  if (PLANTB.trap) { PLANTB.trap.state = 'off'; PLANTB.trap.g.visible = false; }
  PLANTB.trapT = CONFIG.PLANTBOSS.trap.every[0];
  PLANTB.g.visible = on; PLANTB.g.scale.setScalar(CONFIG.PLANTBOSS.scale); PLANTB.head.rotation.set(0, 0, 0);
  if (PLANTB.cocoon) { PLANTB.cocoon.visible = on; PLANTB.cocoon.scale.set(1, 1, 1); }
  PLANTB.bubble.visible = false; PLANTB.bubble.scale.setScalar(0.01);
  for (const r of PLANTB.roots) { r.state = 'off'; r.g.visible = false; }
  if (RELICS.pap) RELICS.pap.g.visible = !on;
  const i = WORLD.hitMeshes.indexOf(PLANTB.hitHead);
  if (on && i < 0) WORLD.hitMeshes.push(PLANTB.hitHead);
  if (!on && i >= 0) WORLD.hitMeshes.splice(i, 1);
  for (const q of SQPOOL) q.fromPlant = false;
  Object.assign(PLANTB.tg, { state: 'off', t: 0, cd: 0, len: 0, full: 0, hits: 0, stabs: 0, stall: 0 });   // F5.23
  PLANTB.chomp = 0; PLANTB.tongue.visible = false; tongueShootable(false); plantFog(0);
  PLANTB.hurtT = 0; PLANTB.growlT = 3;
  plantHeadSync();
}
