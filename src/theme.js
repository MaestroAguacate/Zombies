//=== TEMA "MARENA" 34B — SOLO VISUAL ======================================
// Regla: NINGÚN mesh de acá entra a WORLD.hitMeshes ni WORLD.colliders. Los muebles no tienen colisión.
// Las paredes originales se ocultan (visible=false) pero siguen en hitMeshes/colliders: el raycaster de
// Three r128 no mira .visible, así que balas, línea de vista y spawns no cambian. Encima va una "piel"
// fusionada por textura -> ~10 draw calls en lugar de ~40 cajas.
const THEMEFX = { built: false, dust: null, dustData: null, shafts: null, curtains: [], bulbs: null, quality: 0 };
const TMAT = {};

//--- MeshBuilder: fusiona cajas/planos en UNA geometría con color por vértice (un draw call) ---
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1), UNIT_PLANE = new THREE.PlaneGeometry(1, 1);
const _mbM = new THREE.Matrix4(), _mbL = new THREE.Matrix4(), _mbN = new THREE.Matrix3(), _mbQ = new THREE.Quaternion();
const _mbE = new THREE.Euler(0, 0, 0, 'YXZ'), _mbP = new THREE.Vector3(), _mbS = new THREE.Vector3();
const _mbV = new THREE.Vector3(), _mbV2 = new THREE.Vector3(), _mbC = new THREE.Color();
function MeshBuilder(tint) {
  this.p = []; this.n = []; this.uv = []; this.c = []; this.i = [];
  this.tint = tint !== undefined ? new THREE.Color(tint) : null;
  this.frame = null;
}
// marco local: (x,z) sobre la pared, ry tal que +Z local = hacia adentro del cuarto
MeshBuilder.prototype.setFrame = function (x, y, z, ry) {
  if (x === null) { this.frame = null; return this; }
  _mbE.set(0, ry || 0, 0, 'YXZ');
  this.frame = new THREE.Matrix4().compose(_mbP.set(x, y, z), _mbQ.setFromEuler(_mbE), _mbS.set(1, 1, 1));
  return this;
};
MeshBuilder.prototype.local = function (x, y, z) {
  _mbV2.set(x, y, z);
  if (this.frame) _mbV2.applyMatrix4(this.frame);
  return [_mbV2.x, _mbV2.y, _mbV2.z];
};
MeshBuilder.prototype.add = function (geo, x, y, z, sx, sy, sz, rx, ry, rz, color, uvRect) {
  _mbE.set(rx || 0, ry || 0, rz || 0, 'YXZ');
  _mbL.compose(_mbP.set(x, y, z), _mbQ.setFromEuler(_mbE), _mbS.set(sx, sy, sz));
  if (this.frame) _mbM.multiplyMatrices(this.frame, _mbL); else _mbM.copy(_mbL);
  _mbN.getNormalMatrix(_mbM);
  _mbC.setHex(color === undefined ? 0xffffff : color);
  if (this.tint) _mbC.multiply(this.tint);
  const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv, base = this.p.length / 3;
  for (let k = 0; k < P.count; k++) {
    _mbV.fromBufferAttribute(P, k).applyMatrix4(_mbM); this.p.push(_mbV.x, _mbV.y, _mbV.z);
    _mbV.fromBufferAttribute(N, k).applyMatrix3(_mbN).normalize(); this.n.push(_mbV.x, _mbV.y, _mbV.z);
    let u = U.getX(k), v = U.getY(k);
    if (uvRect) { u = uvRect[0] + u * (uvRect[2] - uvRect[0]); v = uvRect[1] + v * (uvRect[3] - uvRect[1]); }
    this.uv.push(u, v); this.c.push(_mbC.r, _mbC.g, _mbC.b);
  }
  const I = geo.index.array;
  for (let k = 0; k < I.length; k++) this.i.push(base + I[k]);
  return this;
};
MeshBuilder.prototype.box = function (x, y, z, w, h, d, color, rx, ry, rz) {
  return this.add(UNIT_BOX, x, y, z, w, h, d, rx, ry, rz, color);
};
// plano con normal local +Z; uvRect = región del atlas
MeshBuilder.prototype.plane = function (x, y, z, w, h, rx, ry, rz, uvRect, color) {
  return this.add(UNIT_PLANE, x, y, z, w, h, 1, rx, ry, rz, color, uvRect);
};
// quad con esquinas explícitas (antihorario visto desde el frente)
MeshBuilder.prototype.quad = function (a, b, c, d, uvs, color) {
  const base = this.p.length / 3;
  _mbV.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(_mbV2.set(d[0] - a[0], d[1] - a[1], d[2] - a[2])).normalize();
  _mbC.setHex(color === undefined ? 0xffffff : color);
  if (this.tint) _mbC.multiply(this.tint);
  [a, b, c, d].forEach((q, k) => {
    this.p.push(q[0], q[1], q[2]); this.n.push(_mbV.x, _mbV.y, _mbV.z);
    this.uv.push(uvs[k][0], uvs[k][1]); this.c.push(_mbC.r, _mbC.g, _mbC.b);
  });
  this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  return this;
};
MeshBuilder.prototype.mesh = function (mat) {
  if (!this.i.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
  g.setIndex(this.i);
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat);
  m.userData.theme = true;
  m.matrixAutoUpdate = false;
  scene.add(m);
  return m;
};

function themeMaterials() {
  const T = CONFIG.THEME;
  TMAT.prop = new THREE.MeshLambertMaterial({ map: TEX.grime, vertexColors: true });
  TMAT.deco = new THREE.MeshLambertMaterial({ map: ATLAS.tex, vertexColors: true, transparent: true, alphaTest: 0.03,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  TMAT.window = new THREE.MeshBasicMaterial({ map: ATLAS.win, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  TMAT.shaft = new THREE.MeshBasicMaterial({ map: TEX.shaft, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, opacity: T.shaftOpacity });
  TMAT.tin = new THREE.MeshLambertMaterial({ map: TEX.tin, side: THREE.DoubleSide });
  TMAT.strut = new THREE.MeshLambertMaterial({ map: TEX.grime });
  TMAT.bulb = new THREE.MeshBasicMaterial({ color: 0xffffff });
  TMAT.curtain = new THREE.MeshLambertMaterial({ map: TEX.grime, side: THREE.DoubleSide,
    color: new THREE.Color(0xb3a288).multiply(new THREE.Color(T.interiorTint)) });
}

//--- pieles de pared: cada cara de cada pared, cortada por metro según el cuarto al que mira ---
function buildWallSkins() {
  const T = CONFIG.THEME, builders = {};
  const get = key => builders[key] || (builders[key] = new MeshBuilder());
  const roomKey = (x, z) => {
    const r = roomAt(x, z);
    if (!r || (r.outdoor && !TEX.skin[r.id])) return 'EXT';   // porche, playa, muelle: fachada
    return r.id === 'C4' ? 'R3' : r.id;
  };
  for (const c of WORLD.colliders) {
    if (c.tag !== 'wall' && c.tag !== 'rail') continue;
    const rail = c.tag === 'rail';
    c.mesh.visible = false;                         // sigue en hitMeshes: frena balas igual
    // n = normal, t x b = n. punto(s, r) = n*d + t*s + b*r
    const faces = [
      { n: [1, 0, 0],  t: [0, 0, -1], b: [0, 1, 0],  d:  c.maxX, s: [-c.maxZ, -c.minZ], r: [c.minY, c.maxY] },
      { n: [-1, 0, 0], t: [0, 0, 1],  b: [0, 1, 0],  d: -c.minX, s: [c.minZ, c.maxZ],   r: [c.minY, c.maxY] },
      { n: [0, 0, 1],  t: [1, 0, 0],  b: [0, 1, 0],  d:  c.maxZ, s: [c.minX, c.maxX],   r: [c.minY, c.maxY] },
      { n: [0, 0, -1], t: [-1, 0, 0], b: [0, 1, 0],  d: -c.minZ, s: [-c.maxX, -c.minX], r: [c.minY, c.maxY] },
      { n: [0, 1, 0],  t: [1, 0, 0],  b: [0, 0, -1], d:  c.maxY, s: [c.minX, c.maxX],   r: [-c.maxZ, -c.minZ], top: true }
    ];
    for (const f of faces) {
      const P = (s, r) => [f.n[0] * f.d + f.t[0] * s + f.b[0] * r, f.n[1] * f.d + f.t[1] * s + f.b[1] * r,
                           f.n[2] * f.d + f.t[2] * s + f.b[2] * r];
      if (f.top || f.s[1] - f.s[0] <= 0.5) {        // cantos y tapas
        const key = rail ? 'RAIL' : 'TRIM';
        emitSkin(get(key), P, f.s[0], f.s[1], f.r[0], f.r[1], key);
        continue;
      }
      const cuts = [f.s[0]];
      for (let k = Math.floor(f.s[0]) + 1; k < f.s[1]; k++) cuts.push(k);
      cuts.push(f.s[1]);
      let runStart = cuts[0], runKey = null;
      for (let k = 0; k < cuts.length - 1; k++) {
        const q = P((cuts[k] + cuts[k + 1]) / 2, 2);
        const key = rail ? 'RAIL' : roomKey(q[0] + f.n[0] * 0.3, q[2] + f.n[2] * 0.3);
        if (runKey !== null && key !== runKey) {
          emitSkin(get(runKey), P, runStart, cuts[k], f.r[0], f.r[1], runKey);
          runStart = cuts[k];
        }
        runKey = key;
      }
      emitSkin(get(runKey), P, runStart, f.s[1], f.r[0], f.r[1], runKey);
    }
  }
  for (const key in builders) {
    const room = ROOMS.find(r => r.id === key);
    const lit = key === 'EXT' || key === 'RAIL' || (room && room.outdoor);   // afuera no se tiñe
    builders[key].mesh(new THREE.MeshLambertMaterial({ map: TEX.skin[key], color: lit ? 0xffffff : T.interiorTint }));
  }
}
function emitSkin(b, P, s0, s1, r0, r1, key) {
  const uS = 2, vS = key === 'RAIL' ? 1.2 : key === 'TRIM' ? 2 : 4;
  b.quad(P(s0, r0), P(s1, r0), P(s1, r1), P(s0, r1),
    [[s0 / uS, r0 / vS], [s1 / uS, r0 / vS], [s1 / uS, r1 / vS], [s0 / uS, r1 / vS]]);
}

//--- ventanas pintadas (vista al atardecer), marcos, tablas, haces de luz ---
// axis 'x' = pared en x=face; n = +1/-1 hacia adentro; c = centro a lo largo de la pared
const WINDOWS = [
  { room: 'R2', axis: 'x', face: -7.8,  n:  1, c:  6.8, w: 3.6, y0: 0.9, y1: 2.9, view: 'palm', boards: true },
  { room: 'R3', axis: 'z', face: 13.8,  n: -1, c: 15.5, w: 1.8, y0: 1.2, y1: 2.4, view: 'palm' },
  { room: 'R5', axis: 'z', face: 29.8,  n: -1, c: 13.2, w: 2.4, y0: 1.1, y1: 2.5, view: 'sea', curtains: true },
  { room: 'R6', axis: 'x', face: -15.8, n:  1, c: 20.0, w: 1.6, y0: 2.4, y1: 3.2, view: 'palm' },
  { room: 'R7', axis: 'x', face: -15.8, n:  1, c: 36.8, w: 1.4, y0: 3.2, y1: 3.7, view: 'sea' },
  { room: 'R9', axis: 'x', face: 23.8,  n: -1, c: 24.2, w: 1.4, y0: 1.2, y1: 2.2, view: 'sea' }
];
function wallRy(axis, n) { return axis === 'x' ? (n > 0 ? Math.PI / 2 : -Math.PI / 2) : (n > 0 ? 0 : Math.PI); }
function onWall(b, axis, face, n, c) {
  b.setFrame(axis === 'x' ? face : c, 0, axis === 'x' ? c : face, wallRy(axis, n));
}
function buildWindows(props, win, shaft) {
  const T = CONFIG.THEME, FR = 0x4a3a2c;
  for (const w of WINDOWS) {
    const pb = props(w.room), h = w.y1 - w.y0, ym = (w.y0 + w.y1) / 2;
    onWall(win, w.axis, w.face, w.n, w.c);
    win.plane(0, ym, 0.012, w.w, h, 0, 0, 0, ATLAS.wr[w.view]);
    onWall(pb, w.axis, w.face, w.n, w.c);
    pb.box(0, w.y1 + 0.05, 0.04, w.w + 0.2, 0.1, 0.08, FR);                  // dintel
    pb.box(0, w.y0 - 0.05, 0.08, w.w + 0.3, 0.1, 0.16, FR);                  // alféizar
    pb.box(-w.w / 2 - 0.05, ym, 0.04, 0.1, h, 0.08, FR);
    pb.box( w.w / 2 + 0.05, ym, 0.04, 0.1, h, 0.08, FR);
    if (w.boards) {                                                         // ventanal tablado
      [0.25, 0.55, 0.9, 1.35, 1.75].forEach((f, i) => {
        pb.box(rnd(-0.1, 0.1), w.y0 + f * h / 2 + 0.1, 0.07, w.w + 0.35, 0.2, 0.04,
          i % 2 ? 0x6e5a44 : 0x75604a, 0, 0, rnd(-0.08, 0.08));
      });
    }
    // haz de luz: del borde superior de la ventana al piso, adentro del cuarto
    shaft.frame = pb.frame;
    const depth = Math.min(4, 1.4 + w.y1 * 0.9), spread = 0.5;
    shaft.quad(shaft.local(-w.w / 2, w.y1 - 0.1, 0.05), shaft.local(w.w / 2, w.y1 - 0.1, 0.05),
               shaft.local(w.w / 2 + spread, 0.03, depth), shaft.local(-w.w / 2 - spread, 0.03, depth),
               [[0, 1], [1, 1], [1, 0], [0, 0]]);
    if (w.curtains) {                                                       // cortinas que se mueven
      for (const sx of [-1, 1]) {
        const geo = new THREE.PlaneGeometry(0.7, 1.7, 3, 8);
        const m = new THREE.Mesh(geo, TMAT.curtain);
        const p = pb.local(sx * (w.w / 2 - 0.2), ym + 0.1, 0.14);
        m.position.set(p[0], p[1], p[2]);
        m.rotation.y = wallRy(w.axis, w.n);
        m.userData.theme = true;
        scene.add(m);
        THEMEFX.curtains.push({ mesh: m, base: Float32Array.from(geo.attributes.position.array), ph: rnd(0, 6) });
      }
    }
    win.setFrame(null); pb.setFrame(null); shaft.frame = null;
  }
}

//--- palmera seca (con marco propio). lean = inclinación, rot = hacia dónde se inclina ---
function palm(b, x, z, segs, broken, lean, rot) {
  b.setFrame(x, 0, z, rot);
  let px = 0, py = 0;
  for (let i = 0; i < segs; i++) {
    const h = 0.9, wd = 0.36 - i * 0.012, ang = lean * Math.pow(i / segs, 2) * 1.6;
    b.box(px + Math.sin(ang) * h / 2, py + Math.cos(ang) * h / 2, 0, wd, h + 0.05, wd, i % 2 ? 0x6e5f50 : 0x645646, 0, 0, -ang);
    px += Math.sin(ang) * h; py += Math.cos(ang) * h;
  }
  const n = broken ? 4 : 8;
  if (broken) b.box(px + 0.4, py - 0.45, 0, 0.24, 1.0, 0.24, 0x5e5044, 0, 0, 2.5);   // punta quebrada colgando
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2 + rnd(-0.2, 0.2), droop = broken ? rnd(0.9, 1.3) : rnd(0.35, 0.9), len = rnd(1.6, 2.4);
    const dx = Math.cos(droop) * Math.cos(a), dy = -Math.sin(droop), dz = -Math.cos(droop) * Math.sin(a);
    b.box(px + dx * len / 2, py + dy * len / 2, dz * len / 2, len, 0.03, 0.3,
      [0x8a7a55, 0x7a6a48, 0x9a8a62][k % 3], 0, a, -droop);
  }
  b.setFrame(null);
}
// F5.5: punta del tronco en el marco de la palmera (+x = hacia donde se inclina). La misma cuenta que palm()
function palmTop(P) {
  let px = 0, py = 0;
  for (let i = 0; i < P.segs; i++) {
    const ang = P.lean * Math.pow(i / P.segs, 2) * 1.6;
    px += Math.sin(ang) * 0.9; py += Math.cos(ang) * 0.9;
  }
  return { px, py };
}

//--- afuera: arena, mar con olas, espuma, palmeras y lanchas de la playa (R10) ---
// Las palmeras (base del tronco) y las lanchas son sólidas: sus AABB viven en PROPS (world.js).
const SEA = { z0: -24, y: -0.25 };                  // la orilla = el límite invisible de la playa
function buildOutside() {
  const add = m => { m.userData.theme = true; scene.add(m); return m; };
  // arena del patio: pasa por debajo de toda la casa, así que lleva un AGUJERO en la piscina (si no, la tapa).
  // Shape en XY, girada a XZ: y del shape = -z. UV = metros -> repeat 0.25 = una baldosa de arena cada 4 m.
  const sandTex = TEX.sand.clone(); sandTex.needsUpdate = true; sandTex.repeat.set(0.25, 0.25);
  const shape = new THREE.Shape();
  shape.moveTo(-120, -(SEA.z0 + 120)); shape.lineTo(120, -(SEA.z0 + 120)); shape.lineTo(120, -SEA.z0); shape.lineTo(-120, -SEA.z0);
  const P = POOL, hole = new THREE.Path();
  hole.moveTo(P.x1, -P.z1); hole.lineTo(P.x2, -P.z1); hole.lineTo(P.x2, -P.z2); hole.lineTo(P.x1, -P.z2);
  shape.holes.push(hole);
  const sand = add(new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ map: sandTex })));
  sand.rotation.x = -Math.PI / 2; sand.position.y = -0.03;
  // mar lejano (estático) + franja cerca de la orilla con olas (vértices animados, color por altura)
  const far = add(new THREE.Mesh(new THREE.PlaneGeometry(600, 280), new THREE.MeshBasicMaterial({ color: 0x3d5462 })));
  far.rotation.x = -Math.PI / 2; far.position.set(0, SEA.y - 0.02, SEA.z0 - 40 - 140);
  const ng = new THREE.PlaneGeometry(120, 40, 48, 16);
  ng.rotateX(-Math.PI / 2);
  ng.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(ng.attributes.position.count * 3).fill(1), 3));
  const near = add(new THREE.Mesh(ng, new THREE.MeshBasicMaterial({ color: 0x3d5462, vertexColors: true })));
  near.position.set(0, SEA.y, SEA.z0 - 20);
  const foam = add(new THREE.Mesh(new THREE.PlaneGeometry(120, 1.6),
    new THREE.MeshBasicMaterial({ color: 0xd8d0bc, transparent: true, opacity: 0.55, depthWrite: false })));
  foam.rotation.x = -Math.PI / 2; foam.position.set(0, SEA.y + 0.04, SEA.z0 - 0.6);
  THEMEFX.sea = { near, foam, base: Float32Array.from(ng.attributes.position.array) };

  const b = new MeshBuilder();
  // F5.5: cada palmera en su grupo (base, girado hacia donde se inclina) con un hijo que puede voltearse
  // (THEMEFX.palms[i], rotation.z). El tocón queda en el mesh fijo de afuera
  THEMEFX.palms = CONFIG.QUEST.palms.map(P => {
    const pb = new MeshBuilder();
    palm(pb, 0, 0, P.segs, P.broken, P.lean, 0);
    const m = pb.mesh(TMAT.prop), outer = new THREE.Group(), tilt = new THREE.Group();
    outer.position.set(P.x, 0, P.z); outer.rotation.y = P.rot; outer.userData.theme = true;
    outer.add(tilt); tilt.add(m);
    scene.add(outer);
    b.box(P.x, 0.3, P.z, 0.42, 0.6, 0.42, 0x5e5044);                                  // tocón
    return tilt;
  });
  b.box(5, 0.18, -12, 3.2, 0.36, 0.8, 0x5f7f7a, 0, 0.3, 0);    // cayuco volteado
  b.box(5, 0.38, -12, 3.0, 0.06, 0.12, 0x4a3a2c, 0, 0.3, 0);
  b.box(-11, 0.22, -17, 3.4, 0.44, 0.9, 0x8e6a4a, 0, -0.2, 0);  // lancha volteada
  b.box(-11, 0.46, -17, 3.1, 0.06, 0.14, 0xa8a090, 0, -0.2, 0);
  b.box(-12.3, 0.3, -16.8, 0.08, 0.5, 0.7, 0x3a3a38, 0, -0.2, 0.1);   // motor fuera de borda
  b.box(-4, 0.12, -9, 2.4, 0.22, 0.26, 0x8a7d6a, 0, 1.1, 0);    // troncos (decorativos, bajos)
  b.box(8, 0.1, -6.5, 1.6, 0.18, 0.2, 0x7d7060, 0, -0.4, 0.05);
  [[-7, -22.6], [-3.5, -23.1], [6, -22.8], [12, -23.2], [-14, -22.9]]                   // algas en la orilla
    .forEach(p => b.box(p[0], 0.015, p[1], rnd(0.8, 1.6), 0.02, rnd(0.2, 0.4), 0x33402a, 0, rnd(0, 3), 0));
  // F1.1: laguna a los dos lados del puente C13. Agua apenas sobre la arena (no hace falta agujero);
  // fuera de todo cuarto: nadie la pisa. Va en este mismo mesh: sin draw call extra
  [[6.2, 15.8], [22.2, 35]].forEach(([x1, x2]) => {                                    // F5.8: la del este llega a x 35
    b.box((x1 + x2) / 2, 0.01, 0, x2 - x1, 0.02, 7.6, 0x3f5a52);
    b.box((x1 + x2) / 2, 0.022, 0.4, x2 - x1 - 1.4, 0.004, 5.2, 0x4d6c62);             // reflejo
  });
  [[7, 3.2], [8.2, -3.1], [15.1, 2.8], [23, -3.2], [29, 3.1], [26, -2.9]]               // juncos
    .forEach(p => { for (let k = 0; k < 4; k++) b.box(p[0] + rnd(-0.3, 0.3), 0.35, p[1] + rnd(-0.2, 0.2), 0.04, rnd(0.5, 0.9), 0.04, 0x55603a, rnd(-0.2, 0.2), 0, rnd(-0.2, 0.2)); });
  for (let z = -3.4; z <= 3.4; z += 2.27) [16, 22].forEach(x => b.box(x, -0.5, z, 0.22, 1.1, 0.22, 0x5e5446));
  // (F5.12: la laguna que bajaba al mar se sacó: ahí se pasa de la playa a la jungla este)
  for (const P of CONFIG.GARDEN.palms) palm(b, P.x, P.z, P.segs, false, P.lean, P.rot);
  b.mesh(TMAT.prop);
}
function updateSea(t) {
  const S = THEMEFX.sea;
  if (!S) return;
  const pos = S.near.geometry.attributes.position, col = S.near.geometry.attributes.color, B = S.base;
  for (let i = 0; i < pos.count; i++) {
    const x = B[i * 3], z = B[i * 3 + 2];
    const h = Math.sin(x * 0.25 + t * 1.1 + z * 0.35) * 0.07 + Math.sin(x * 0.11 - t * 0.7 + z * 0.9) * 0.05;
    pos.setY(i, h);
    const k = 0.85 + h * 2.2;
    col.setXYZ(i, k, k, k);
  }
  pos.needsUpdate = true; col.needsUpdate = true;
  const w = 0.5 + 0.5 * Math.sin(t * 0.9);                        // la espuma sube y baja por la orilla
  S.foam.position.z = SEA.z0 - 0.3 - w * 1.2;
  S.foam.material.opacity = 0.25 + 0.4 * (1 - w);
}

//--- muebles por cuarto (un mesh por cuarto) + atlas + vigas ---
function buildTheme() {
  if (!CONFIG.THEME.enabled) return;
  const T = CONFIG.THEME, IT = T.interiorTint;
  themeMaterials();
  buildWallSkins();
  buildOutside();

  const rooms = {};
  const outdoor = id => { const r = ROOMS.find(q => q.id === id); return !!(r && r.outdoor); };
  const props = id => rooms[id] || (rooms[id] = new MeshBuilder(outdoor(id) ? undefined : IT));
  const deco = new MeshBuilder(), win = new MeshBuilder(), shaft = new MeshBuilder();
  const glow = new MeshBuilder();              // vidrio de faroles: MeshBasic, "prende" sin agregar luces
  const struts = [];      // {x,y,z,w,h,d,color,rx,ry,rz} -> InstancedMesh
  const strut = (x, y, z, w, h, d, color, rx, ry, rz) => struts.push({ x, y, z, w, h, d, color, rx, ry, rz });
  const floorDeco = (key, x, z, w, d, ry, color) => deco.plane(x, 0.012, z, w, d, -Math.PI / 2, ry || 0, 0, ATLAS.r[key], color);
  const WOOD = 0x5c4a38, GRAY = 0x8e8a80, DARK = 0x2a2a2a;
  const tintC = new THREE.Color(IT), beamC = new THREE.Color(0x4a3a2c);

  buildWindows(props, win, shaft);

  //--- R1 PORCHE ---
  let b = props('R1');
  [[-6, -4], [6, -4], [-6, 3.7], [6, 3.7]].forEach(p => b.box(p[0], 1.95, p[1], 0.22, 3.9, 0.22, GRAY));   // postes
  for (let x = -6; x <= 6; x += 2) strut(x, 3.9, -0.1, 0.18, 0.2, 7.9, 0x6a5a48);                          // vigas del techo
  strut(0, 3.8, -4, 12.3, 0.2, 0.2, 0x6a5a48);
  strut(0, 3.8, 0, 12.1, 0.16, 0.16, 0x5c4c3c);
  // 34B: cuelga de una sola cuerda, la otra cortada (semi-caído)
  const sx = -2.6, sy = 2.75, sz = -3.85, rz = 0.5;
  b.box(sx, sy, sz, 1.2, 0.46, 0.05, 0x7a6248, 0, 0, rz);
  deco.plane(sx, sy, sz + 0.03, 1.1, 0.42, 0, 0, rz, ATLAS.r.sign34);
  deco.plane(sx, sy, sz - 0.03, 1.1, 0.42, 0, Math.PI, -rz, ATLAS.r.sign34);
  b.box(sx + 0.39, 3.5, sz, 0.03, 0.62, 0.03, 0x9a8c70);          // cuerda sana
  b.box(sx - 0.58, 3.68, sz, 0.03, 0.24, 0.03, 0x9a8c70);         // cuerda cortada, arriba
  b.box(sx - 0.6, 2.56, sz, 0.03, 0.2, 0.03, 0x9a8c70, 0, 0, 0.3); // pedazo colgando del letrero
  // MARENA: placa oxidada en la fachada, arriba de la ventana izquierda
  b.box(-3.5, 3.0, 3.765, 2.72, 0.84, 0.05, 0x6e4a32, 0, 0, 0.03);
  deco.plane(-3.5, 3.0, 3.735, 2.6, 0.78, 0, Math.PI, -0.03, ATLAS.r.marena);
  // ventanas tapiadas en la fachada + "SE VENDE" en el barandal
  [-3.5, 3.5].forEach(x => {
    deco.plane(x, 1.55, 3.785, 2.6, 1.3, 0, Math.PI, 0, ATLAS.r.boarded);
    b.box(x, 2.25, 3.76, 2.8, 0.1, 0.08, WOOD); b.box(x, 0.85, 3.72, 2.9, 0.1, 0.16, WOOD);
  });
  deco.plane(5.78, 0.72, -1.5, 1.0, 0.5, 0, -Math.PI / 2, 0.06, ATLAS.r.sevende);
  // arena entrando
  [[-4.2, -3.2, 3.2, 1.6, 0.2], [3.8, -3.3, 3.6, 1.5, -0.1], [-5.2, 0.5, 1.4, 3.2, 0], [0.3, -1.5, 2.2, 4.5, 0.15],
   [5.1, 1.8, 1.6, 2.6, 0.3], [1.5, 2.8, 1.5, 1.2, 0.8], [-1.6, 3.3, 1.3, 0.9, 0.4]]
    .forEach(s => floorDeco('sand', s[0], s[1], s[2], s[3], s[4]));
  // hamaca rota entre los postes del lado izquierdo
  const hz0 = -3.3, hz1 = 3.0, segs = 8, hx = -5.25;
  const hy = z => 1.55 - 0.85 * (1 - Math.pow((z - (hz0 + hz1) / 2) / ((hz1 - hz0) / 2), 2));
  for (let i = 0; i < segs; i++) {
    if (i === 5) continue;                                            // desgarro
    const z0 = hz0 + (hz1 - hz0) * i / segs, z1 = hz0 + (hz1 - hz0) * (i + 1) / segs;
    const y0 = hy(z0), y1 = hy(z1), len = Math.hypot(z1 - z0, y1 - y0);
    b.box(hx, (y0 + y1) / 2, (z0 + z1) / 2, 0.9, 0.03, len + 0.02, [0x8e5a4c, 0xb8a46c, 0x5a7486][i % 3], -Math.atan2(y1 - y0, z1 - z0), 0, 0);
  }
  b.box(hx, 1.2, hz0 + 3.5, 0.5, 0.03, 0.5, 0x5a7486, 1.2, 0.3, 0);   // jirón colgando
  b.box(-5.9, 1.75, -3.6, 0.03, 0.4, 0.03, 0x9a8c70, 0.8, 0, 0);
  b.box(-5.9, 1.75, 3.35, 0.03, 0.4, 0.03, 0x9a8c70, -0.8, 0, 0);

  //--- R2 SALA ---
  b = props('R2');
  b.setFrame(3.2, 0, 17.3, Math.PI);                                  // sofá viejo contra la pared norte
  b.box(0, 0.22, 0, 2.3, 0.44, 0.9, 0x4f5244);
  b.box(0, 0.62, -0.38, 2.3, 0.6, 0.18, 0x6b6f58);
  b.box(-1.1, 0.42, 0, 0.2, 0.5, 0.9, 0x6b6f58); b.box(1.1, 0.42, 0, 0.2, 0.5, 0.9, 0x6b6f58);
  b.box(-0.55, 0.5, 0.05, 1.0, 0.14, 0.72, 0x74785f);
  b.box(0.35, 0.47, 0.1, 0.25, 0.05, 0.2, 0xd8d0b8);                   // relleno salido
  b.box(0.9, 0.08, 0.95, 0.95, 0.14, 0.7, 0x74785f, 0, 0.4, 0.2);      // cojín en el piso
  b.setFrame(-7.8, 0, 14.9, Math.PI / 2);                              // TV rota sobre mueble, pared oeste
  b.box(0, 0.25, 0.3, 1.2, 0.5, 0.5, 0x5a4636);
  b.box(0.1, 0.8, 0.28, 0.9, 0.6, 0.45, DARK, 0, 0, 0.08);
  deco.setFrame(-7.8, 0, 14.9, Math.PI / 2);
  deco.plane(0.1, 0.8, 0.506, 0.78, 0.5, 0, 0, 0.08, ATLAS.r.tv, IT);
  deco.setFrame(null); b.setFrame(null);
  b.box(-1, 0.006, 10.5, 3.2, 0.012, 2.4, 0x7a4a3e, 0, 0.1, 0);        // alfombra manchada
  b.box(-3.2, 0.22, 9.3, 1.2, 0.05, 0.6, 0x6a5440, 0.1, 0.2, 0.35);    // mesa volcada (a un costado: sólida, no corta D1->D3)
  b.box(-3.75, 0.2, 9.1, 0.06, 0.4, 0.06, 0x5a4636, 0, 0, 0.35); b.box(-2.7, 0.05, 9.5, 0.06, 0.06, 0.4, 0x5a4636);
  [[-5, 8, 0.4], [4.8, 6.5, -0.8], [-2.5, 15.5, 1.3]].forEach(p => b.box(p[0], 0.03, p[1], 1.4, 0.04, 0.18, 0x6e5a44, 0, p[2], 0));
  [[-4.3, 7.7], [5.1, 7.2], [1.6, 15.8]].forEach(p => b.box(p[0], 0.1, p[1], 0.08, 0.08, 0.26, 0x4a6a4a, 0, rnd(0, 3), Math.PI / 2));  // botellas

  //--- R3 COCINA ---
  b = props('R3');
  b.box(15.6, 0.45, 13.5, 4.4, 0.9, 0.6, 0xb8b09a);                    // gabinete bajo
  b.box(15.6, 0.925, 13.47, 4.5, 0.05, 0.66, 0x6d675c);                // cubierta
  b.box(14.6, 0.955, 13.5, 0.6, 0.02, 0.4, 0x3a3a3a);                  // lavatrastos
  [13.9, 14.9, 15.9, 16.9].forEach(x => b.box(x, 0.45, 13.195, 0.02, 0.7, 0.01, 0x55504a));
  b.box(16.2, 0.02, 12.5, 0.5, 0.03, 0.7, 0xb0a890, 0, 0.3, 0);        // puerta caída
  b.box(13.9, 2.25, 13.62, 1.0, 0.7, 0.36, 0xa89f88);                  // alacenas
  b.box(17.2, 2.25, 13.62, 1.2, 0.7, 0.36, 0xa89f88);
  b.box(16.45, 2.25, 13.2, 0.5, 0.66, 0.02, 0x9f9680, 0, 0.9, 0);      // puerta abierta
  b.box(8.8, 0.36, 11.7, 0.72, 0.72, 1.75, 0xc9c4b2);                  // refri volteado (de espaldas)
  b.box(8.9, 0.79, 11.7, 0.66, 0.04, 1.6, 0xbeb8a4, 0, 0, -0.35);      // puerta entreabierta
  [[8.6, 0.73, 11.2], [9.0, 0.5, 12.3]].forEach(p => b.box(p[0], p[1], p[2], 0.2, 0.02, 0.15, 0x8a5a3a));
  b.box(12.2, 0.25, 12.6, 0.45, 0.45, 0.05, 0x6a5440, 1.35, 0.4, 0);   // silla volcada
  b.box(12.2, 0.22, 12.9, 0.45, 0.05, 0.45, 0x6a5440, 0, 0.4, 0);
  [[11, 11.5], [13.2, 10.8], [9.8, 6.4]].forEach(p => b.box(p[0], 0.07, p[1], 0.14, 0.14, 0.14, 0x7c8084, 0, rnd(0, 3), 0));

  //--- R4 PASILLO ---
  b = props('R4');
  [['x', -3.8, 1, 20.2, 1.75, 0.14, 'pBeach'], ['x', -3.8, 1, 25.6, 1.8, -0.22, 'pVolcan'],
   ['x', 3.8, -1, 20.4, 1.7, -0.1, 'pBoat'], ['x', 3.8, -1, 26.0, 1.85, 0.3, 'pFlower']].forEach(f => {
    onWall(b, f[0], f[1], f[2], f[3]); onWall(deco, f[0], f[1], f[2], f[3]);
    b.box(0, f[4], 0.02, 0.8, 1.0, 0.04, 0x4a3526, 0, 0, f[5]);        // marco torcido
    deco.plane(0, f[4], 0.045, 0.68, 0.86, 0, 0, f[5], ATLAS.r[f[6]], IT);
  });
  onWall(b, 'x', 3.8, -1, 24.9); onWall(deco, 'x', 3.8, -1, 24.9);     // cuadro caído, apoyado en el piso
  b.box(0, 0.48, 0.22, 0.8, 1.0, 0.04, 0x4a3526, -0.25, 0, 0.05);
  deco.plane(0, 0.48, 0.245, 0.68, 0.86, -0.25, 0, 0.05, ATLAS.r.pBeach, IT);
  deco.setFrame(null); b.setFrame(null);
  [[-3.75, 19.2, 0.25], [-3.75, 23.9, 0.35], [3.75, 21.3, -0.3], [3.75, 27.1, -0.2]]
    .forEach(p => b.box(p[0], 3.45, p[1], 0.02, 1.1, 0.42, 0xa3b6a2, 0, 0, p[2]));   // papel tapiz despegado
  b.box(3.4, 0.4, 18.9, 0.6, 0.05, 0.45, 0x6a5440, 0, 0.2, 0.25);      // mesita volcada
  b.box(3.1, 0.12, 19.5, 0.22, 0.24, 0.22, 0x8a5a3a);                  // maceta
  b.box(3.1, 0.35, 19.5, 0.03, 0.3, 0.03, 0x6a5a3a, 0.3, 0, 0.2);      // planta seca

  //--- R5 DORMITORIO ---
  b = props('R5');
  b.box(5.3, 0.2, 19.3, 2.0, 0.3, 2.2, 0x5a4636, 0, 0, 0.04);          // cama
  b.box(5.3, 0.7, 18.28, 2.1, 1.1, 0.1, 0x5a4636);
  b.box(5.3, 0.45, 19.35, 1.85, 0.2, 2.05, 0xb5ab8f, 0.03, 0.06, 0);
  [[5.0, 19.8, 0.5, 0.6], [5.7, 19.1, 0.35, 0.3]].forEach(s => b.box(s[0], 0.555, s[1], s[2], 0.01, s[3], 0x7d6f55));
  b.box(5.0, 0.6, 18.65, 0.6, 0.12, 0.35, 0xcfc6ae);
  b.box(6.35, 0.3, 19.6, 0.05, 0.45, 1.2, 0xc8c0aa, 0, 0, 0.15);       // sábana colgando
  b.box(6.75, 0.3, 18.55, 0.5, 0.6, 0.45, 0x6a5440);                   // mesa de noche
  b.box(6.75, 0.7, 18.55, 0.12, 0.2, 0.12, 0x9a9080, 0, 0, 1.2);       // lámpara caída
  b.box(15.5, 1.1, 27.0, 0.6, 2.2, 1.5, 0x6a5440);                     // ropero
  b.box(15.05, 1.1, 26.05, 0.04, 2.0, 0.7, 0x5e4a38, 0, 0.9, 0);       // puerta abierta
  b.box(15.2, 1.3, 27.2, 0.3, 0.6, 0.3, 0x7a8a9a); b.box(15.2, 1.2, 26.7, 0.3, 0.5, 0.25, 0x9a6a5a);  // ropa
  [[9.5, 22.5, 0x7a8a9a], [11.6, 20.4, 0x9a6a5a], [7.4, 26.8, 0xb8ae96]]
    .forEach(p => b.box(p[0], 0.02, p[1], 0.7, 0.03, 0.5, p[2], 0, rnd(0, 3), 0));

  //--- R6 GARAJE ---
  b = props('R6');
  b.box(-13.2, 1.1, 29.55, 0.52, 2.3, 0.07, 0xd8c890, 0.15, 0, 0);    // tabla de surf apoyada
  b.box(-13.2, 1.1, 29.51, 0.12, 2.1, 0.02, 0x5f8fa0, 0.15, 0, 0);
  b.box(-12, 0.04, 28.2, 0.5, 0.06, 1.1, 0xd8c890, 0, 0.5, 0);         // la otra, partida
  b.setFrame(-6.6, 0, 28.9, 0);                                        // camioneta a medias (sin palangana)
  b.box(0, 0.55, 0, 3.6, 0.25, 1.7, 0x3a3a38);
  b.box(1.1, 0.95, 0, 1.3, 0.55, 1.6, 0x5f7f7a);
  b.box(0.2, 1.6, 0, 1.3, 0.05, 1.5, 0x5f7f7a, 0, 0, -1.0);            // capó abierto
  b.box(-0.35, 1.25, 0, 1.3, 1.1, 1.65, 0x5f7f7a);
  b.box(0.32, 1.45, 0, 0.05, 0.55, 1.4, 0x2b3336, 0, 0, -0.3);
  b.box(1.0, 1.15, 0, 0.9, 0.1, 1.2, 0x2e2e2c);                        // motor
  [[-1.4, 0.6], [-1.4, -0.6]].forEach(p => b.box(-1.5, 0.5, p[1], 1.2, 0.12, 0.12, 0x2e2e2c));  // largueros
  [[1.1, 0.8], [1.1, -0.8]].forEach(p => b.box(p[0], 0.35, p[1], 0.7, 0.7, 0.3, 0x1e1e1e));    // ruedas
  [[-1.4, 0.6], [-1.4, -0.6]].forEach(p => b.box(p[0], 0.2, p[1], 0.4, 0.4, 0.3, 0x8a8985));   // bloques
  [[0.6, 1.4, 0.83], [-0.9, 0.9, -0.83], [1.5, 1.05, 0.81]].forEach(p => b.box(p[0], p[1], p[2], 0.35, 0.25, 0.02, 0x8a5a3a));
  b.setFrame(null);
  b.box(-4.7, 0.36, 26.9, 0.3, 0.7, 0.7, 0x1e1e1e, 0, 0, 0.2);         // rueda suelta
  b.box(-15.45, 0.9, 26.8, 0.7, 0.08, 1.6, 0x6a5440);                  // banco de trabajo
  [[26.1], [27.5]].forEach(z => b.box(-15.45, 0.45, z[0], 0.6, 0.9, 0.06, 0x5a4636));
  b.box(-15.3, 0.25, 25.9, 0.3, 0.4, 0.2, 0x8a3a2e);                   // bidón
  b.box(-15.4, 0.97, 27.1, 0.4, 0.06, 0.1, 0x7c8084, 0, 0.4, 0);
  [0.11, 0.33, 0.55].forEach((y, i) => b.box(-15.1, y, 21.9, 0.7, 0.22, 0.7, 0x1e1e1e, 0, i * 0.3, 0));  // llantas

  //--- R7 SÓTANO ---
  b = props('R7');
  b.box(-15.1, 0.55, 32.3, 1.2, 1.1, 1.9, 0x5a5e3c);                   // generador
  b.box(-15.1, 1.25, 32.0, 0.8, 0.3, 0.9, 0x3e403a);
  b.box(-15.1, 1.22, 32.9, 0.9, 0.25, 0.6, 0x8a3a2e);
  b.box(-14.45, 0.9, 31.7, 0.06, 0.3, 0.06, 0xb8b0a0, 0, 0, -0.5);     // palanca
  deco.plane(-14.49, 0.7, 32.3, 0.6, 0.6, 0, Math.PI / 2, 0, ATLAS.r.power, IT);
  strut(-15.3, 2.4, 31.5, 0.12, 2.3, 0.12, 0x5a5a58);                  // escape
  for (let x = -13.5; x <= -11.5; x += 2) b.box(x, 0.9, 39.55, 0.06, 1.8, 0.4, 0x5a4636);   // estante
  [0.3, 0.9, 1.5].forEach(y => b.box(-12.5, y, 39.55, 2.1, 0.04, 0.42, 0x6a5440));
  [[-13.1, 0.42], [-12.7, 0.42], [-12, 1.02], [-12.9, 1.62]].forEach(p => b.box(p[0], p[1], 39.5, 0.14, 0.2, 0.14, 0x7a8a6a));
  b.box(-5.0, 0.35, 31.0, 0.7, 0.7, 0.7, 0x6e5a44); b.box(-5.1, 0.95, 31.1, 0.5, 0.5, 0.5, 0x75604a, 0, 0.4, 0);   // cajas
  [[-8, 35.5, 2.6, 1.8], [-12.5, 36.8, 1.6, 1.2], [-6, 32.2, 1.2, 1.0], [-13.6, 33.6, 1.4, 1.0]]
    .forEach(p => floorDeco('puddle', p[0], p[1], p[2], p[3], rnd(0, 3), IT));
  // tuberías (instanciadas con las vigas)
  strut(-15.4, 3.65, 35, 0.14, 0.14, 9.2, 0x6e5a4a);
  strut(-15.0, 3.5, 35, 0.1, 0.1, 9.2, 0x5a5a58);
  strut(-10, 3.4, 30.45, 11.2, 0.12, 0.12, 0x6e5a4a);
  strut(-15.6, 1.9, 30.45, 0.12, 3.1, 0.12, 0x6e5a4a);
  strut(-4.45, 1.8, 38.5, 0.1, 3.6, 0.1, 0x5a5a58);

  //--- R8 PISCINA (V2 F1): borde, agua estancada, escalerilla, reposera, macetero ---
  b = props('R8');
  const PL = POOL, CURB = 0xd6d0c0;
  b.box(PL.x1, 0.06, (PL.z1 + PL.z2) / 2, 0.3, 0.12, PL.z2 - PL.z1, CURB);            // borde (visual; el que frena es poolRim)
  b.box(PL.x2, 0.06, (PL.z1 + PL.z2) / 2, 0.3, 0.12, PL.z2 - PL.z1, CURB);
  b.box((PL.x1 + PL.x2) / 2, 0.06, PL.z2, PL.x2 - PL.x1 + 0.3, 0.12, 0.3, CURB);
  b.box((PL.x1 + PL.x2) / 2, 0.005, PL.z1 - 0.1, PL.x2 - PL.x1, 0.01, 0.2, 0x8a8577);   // línea de la rampa
  // escalerillas: por acá (y la rampa) suben y bajan los zombies (POOL.ladders, F2.6)
  [24.6, 25.4].forEach(x => b.box(x, -0.4, PL.z2 - 0.12, 0.05, 2.4, 0.05, 0xb8b8b0));   // norte
  for (let y = -1.3; y < 0; y += 0.4) b.box(25, y, PL.z2 - 0.12, 0.8, 0.04, 0.05, 0xb8b8b0);
  [PL.x1 + 0.12, PL.x2 - 0.12].forEach(x => {                                          // oeste y este
    [13.1, 13.9].forEach(z => b.box(x, -0.4, z, 0.05, 2.4, 0.05, 0xb8b8b0));
    for (let y = -1.3; y < 0; y += 0.4) b.box(x, y, 13.5, 0.05, 0.04, 0.8, 0xb8b8b0);
  });
  [[23, 14], [26.5, 12.8], [24.2, 16.2], [27.2, 15.6]]                                  // lama en el fondo
    .forEach(p => b.box(p[0], -PL.depth + 0.01, p[1], rnd(0.6, 1.4), 0.02, rnd(0.5, 1.2), 0x3e5a2e, 0, rnd(0, 3), 0));
  b.box(34.1, 0.3, 5.3, 1.1, 0.12, 1.7, 0xd8d2c4);                                      // reposera (F2.6: +1.1 en x; F5.8: +4)
  b.box(34.1, 0.62, 6.0, 1.1, 0.7, 0.1, 0xd8d2c4, -0.9, 0, 0);
  [[33.65, 4.55], [34.55, 4.55], [33.65, 6.05], [34.55, 6.05]].forEach(p => b.box(p[0], 0.13, p[1], 0.05, 0.26, 0.05, 0xb0aa9c));
  b.box(34.35, 0.45, 17.1, 0.8, 0.9, 1.2, 0x9a5a3e);                                     // macetero con palma muerta (F5.8: +4 en x)
  b.box(34.35, 0.91, 17.1, 0.7, 0.04, 1.1, 0x4a3a2c);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(PL.x2 - PL.x1, PL.z2 - 11.2),
    new THREE.MeshLambertMaterial({ color: 0x3e5a2c, transparent: true, opacity: 0.8, depthWrite: false }));
  water.rotation.x = -Math.PI / 2;
  water.position.set((PL.x1 + PL.x2) / 2, -PL.depth + 0.15, (11.2 + PL.z2) / 2);
  water.userData.theme = true; scene.add(water);                                         // agua estancada (15 cm)

  //--- R9 CASETA: catre, locker, escritorio con radio, salvavidas, redes ---
  b = props('R9');
  b.box(17.5, 0.25, 29.4, 2.0, 0.08, 0.8, 0x5a4636);                                     // catre
  b.box(17.5, 0.32, 29.4, 1.9, 0.08, 0.72, 0x8a8468);
  [[16.6, 29.05], [18.4, 29.05], [16.6, 29.75], [18.4, 29.75]].forEach(p => b.box(p[0], 0.12, p[1], 0.05, 0.24, 0.05, 0x4a3a2c));
  b.box(23.5, 0.95, 21.5, 0.6, 1.9, 1.0, 0x6e7a78);                                      // locker
  b.box(23.19, 1.0, 21.25, 0.02, 1.7, 0.45, 0x5e6a68); b.box(23.19, 1.0, 21.75, 0.02, 1.7, 0.45, 0x5e6a68);
  b.box(23.45, 0.78, 26.8, 0.7, 0.06, 1.6, 0x6a5440);                                    // escritorio
  [[23.2, 26.05], [23.2, 27.55]].forEach(p => b.box(p[0], 0.38, p[1], 0.06, 0.76, 0.06, 0x5a4636));
  b.box(23.5, 0.93, 27.1, 0.3, 0.2, 0.4, 0x3a3a38);                                      // radio
  onWall(b, 'z', 29.8, -1, 21);                                                          // salvavidas en la pared norte
  [[0, 0.35], [0, -0.35], [0.35, 0], [-0.35, 0]].forEach((p, i) =>
    b.box(p[0], 1.9 + p[1], 0.05, i < 2 ? 0.5 : 0.14, i < 2 ? 0.14 : 0.5, 0.1, i % 2 ? 0xe8e2d6 : 0xc8502e));
  b.setFrame(null);
  onWall(b, 'x', 16.2, 1, 26.5);                                                         // redes colgadas
  for (let k = 0; k < 5; k++) b.box(0, 2.2 - k * 0.25, 0.04, 1.6 - k * 0.1, 0.02, 0.02, 0x8a7a5a, 0, 0, rnd(-0.1, 0.1));
  for (let k = 0; k < 6; k++) b.box(-0.7 + k * 0.28, 1.7, 0.04, 0.02, 1.1, 0.02, 0x8a7a5a);
  b.setFrame(null);

  //--- R10 PLAYA: arena que entra por la reja; R11 MUELLE en T (F1.1): pilotes, faroles, bote ---
  [[0.4, -5.2, 2.2, 1.6, 0.2], [-6, -10, 3, 2, 0.8], [9, -15, 2.6, 1.8, -0.4]]
    .forEach(s => floorDeco('sand', s[0], s[1], s[2], s[3], s[4]));
  b = props('R11');
  const pile = (x, z) => b.box(x, -0.95, z, 0.25, 2.1, 0.25, 0x5e5446);
  // F5.6: tronco hasta z -44, plataforma z -50..-44, segundo tronco x -19..-15 y pasarela z -48..-44
  for (let z = -25; z >= -44; z -= 3) [-2.15, 2.15].forEach(x => pile(x, z));                   // pilotes del tronco
  for (let z = -44.15; z >= -50; z -= 2.9) pile(4.15, z);                                      // ...de la plataforma
  pile(-4.15, -49); [-3, 0, 3].forEach(x => pile(x, -50.15));
  for (let z = -25; z >= -47; z -= 3) [-19.15, -14.85].forEach(x => { if (x < -15 || z > -44) pile(x, z); });   // segundo tronco
  for (let x = -14; x <= -5; x += 3) pile(x, -43.85);                                         // pasarela
  [-14.5, -4.5].forEach(x => pile(x, -48.15));
  [-13.15, -5.85].forEach(x => pile(x, -50.15));                                               // F5.8: entrante del PaP
  [[-1.85, -31], [3.85, -44.3], [-18.85, -33], [-9.5, -43.85]].forEach(([x, z]) => {           // faroles
    b.box(x, 1.3, z, 0.1, 2.6, 0.1, 0x2e2e2c);
    b.box(x, 2.72, z, 0.28, 0.06, 0.28, 0x2e2e2c); b.box(x, 2.98, z, 0.3, 0.06, 0.3, 0x2e2e2c);
    glow.box(x, 2.85, z, 0.22, 0.2, 0.22, 0xffd38a);
  });
  // bote al costado este de la plataforma (el fondo queda para el Pack-a-Punch)
  b.box(5.3, -0.28, -46, 1.3, 0.45, 3.2, 0x5f7f7a, 0.03, 0.12, 0.08);                    // bote amarrado
  b.box(5.3, -0.04, -46, 1.1, 0.04, 2.8, 0x4a3a2c, 0.03, 0.12, 0.08);
  b.box(4.4, 0.02, -45.2, 1.4, 0.03, 0.03, 0x9a8c70, 0, 0.5, 0.15);                      // cuerda a la bita
  b.box(3.7, 0.15, -44.9, 0.25, 0.3, 0.25, 0x3a3a38);                                    // bita

  //--- vigas bajo el techo de lámina de cada cuarto interior + focos colgando ---
  for (const r of ROOMS) {
    if (r.outdoor || r.id === 'C4') continue;
    const w = r.x2 - r.x1, d = r.z2 - r.z1, cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2;
    if (w <= d) for (let z = r.z1 + 1; z < r.z2; z += 2) strut(cx, 3.88, z, w - 0.4, 0.22, 0.18, 0x4a3a2c, 0, 0, 0, true);
    else        for (let x = r.x1 + 1; x < r.x2; x += 2) strut(x, 3.88, cz, 0.18, 0.22, d - 0.4, 0x4a3a2c, 0, 0, 0, true);
  }
  for (const L of WORLD.lamps) strut(L.light.position.x, 3.45, L.light.position.z, 0.02, 1.0, 0.02, 0x222222);

  //--- instanciados: vigas/tuberías (1 draw call), láminas del porche (1), focos (1) ---
  const im = new THREE.InstancedMesh(UNIT_BOX, TMAT.strut, struts.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), col = new THREE.Color();
  struts.forEach((s, i) => {
    m4.compose(p3.set(s.x, s.y, s.z), q.setFromEuler(e.set(s.rx || 0, s.ry || 0, s.rz || 0, 'YXZ')), s3.set(s.w, s.h, s.d));
    im.setMatrixAt(i, m4);
    col.setHex(s.color); if (s.z > 4 || s.x > 6.5 || s.x < -6.5) col.multiply(tintC);   // interiores más oscuros
    im.setColorAt(i, col);
  });
  im.userData.theme = true; scene.add(im);

  const sheets = [];
  const zRows = [-2.7, -0.1, 2.5], xCols = [-5, -3, -1, 1, 3, 5], holes = { '0,1': 1, '1,4': 1, '2,0': 1, '0,4': 1 };
  zRows.forEach((z, ri) => xCols.forEach((x, ci) => {
    if (!holes[ri + ',' + ci]) sheets.push([x, 4.02, z, 2.05, 0.03, 2.62, 0.05 + rnd(-0.04, 0.04), 0, rnd(-0.04, 0.04)]);
  }));
  sheets.push([3.0, 2.95, -4.25, 2.0, 0.03, 2.4, 1.35, 0.1, 0.15]);     // lámina colgando al frente
  const tin = new THREE.InstancedMesh(UNIT_BOX, TMAT.tin, sheets.length);
  sheets.forEach((s, i) => {
    m4.compose(p3.set(s[0], s[1], s[2]), q.setFromEuler(e.set(s[6], s[7], s[8], 'YXZ')), s3.set(s[3], s[4], s[5]));
    tin.setMatrixAt(i, m4);
  });
  tin.userData.theme = true; scene.add(tin);

  const bulbs = new THREE.InstancedMesh(UNIT_BOX, TMAT.bulb, WORLD.lamps.length);
  WORLD.lamps.forEach((L, i) => {
    m4.compose(p3.set(L.light.position.x, 2.93, L.light.position.z), q.set(0, 0, 0, 1), s3.set(0.12, 0.14, 0.12));
    bulbs.setMatrixAt(i, m4); bulbs.setColorAt(i, col.setHex(0xfff0c0));
  });
  bulbs.userData.theme = true; scene.add(bulbs);
  THEMEFX.bulbs = bulbs;

  for (const id in rooms) rooms[id].mesh(TMAT.prop);
  deco.mesh(TMAT.deco);
  win.mesh(TMAT.window);
  glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
  THEMEFX.shafts = shaft.mesh(TMAT.shaft);
  buildDust();
  THEMEFX.built = true;
}

//--- polvo / arena flotando: UN THREE.Points ---
function buildDust() {
  const T = CONFIG.THEME, N = T.dust;
  const pos = new Float32Array(N * 3), colr = new Float32Array(N * 3);
  const base = new Float32Array(N * 3), ph = new Float32Array(N), sandy = new Uint8Array(N);
  const inner = ROOMS.filter(r => !r.outdoor && r.id !== 'C4');
  const area = inner.reduce((a, r) => a + (r.x2 - r.x1) * (r.z2 - r.z1), 0);
  const nSand = Math.floor(N * 0.25);
  const porch = ROOMS.find(r => r.id === 'R1');
  for (let i = 0; i < N; i++) {
    let r, y;
    if (i < nSand) { r = porch; y = rnd(0.05, 1.3); sandy[i] = 1; }
    else {
      let a = Math.random() * area; r = inner[0];
      for (const q of inner) { a -= (q.x2 - q.x1) * (q.z2 - q.z1); if (a <= 0) { r = q; break; } }
      y = rnd(0.2, 3.6);
    }
    base[i * 3] = rnd(r.x1 + 0.3, r.x2 - 0.3); base[i * 3 + 1] = y; base[i * 3 + 2] = rnd(r.z1 + 0.3, r.z2 - 0.3);
    ph[i] = rnd(0, 20);
    const c = sandy[i] ? [0.85, 0.77, 0.6] : [0.9, 0.84, 0.72];
    colr[i * 3] = c[0]; colr[i * 3 + 1] = c[1]; colr[i * 3 + 2] = c[2];
  }
  pos.set(base);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  g.computeBoundingSphere();
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: T.dustSize, map: TEX.dust, transparent: true,
    depthWrite: false, opacity: T.dustOpacity, vertexColors: true, sizeAttenuation: true }));
  pts.frustumCulled = false;                 // las posiciones cambian; el bounding sphere no se recalcula
  pts.userData.theme = true;
  scene.add(pts);
  THEMEFX.dust = pts;
  THEMEFX.dustData = { base, ph, sandy, porch };
}

//--- animación del tema (luces, cortinas, polvo). Nunca crea ni agrega nada ---
const _bulbC = new THREE.Color();
function updateTheme(dt) {
  const T = CONFIG.THEME, t = clock.elapsedTime;
  for (const L of WORLD.lamps) {
    if (L.mode === 'steady') L.k = 0.94 + 0.06 * Math.sin(t * 2.3 + L.phase);
    else if (L.mode === 'buzz') L.k = 0.75 + 0.15 * Math.sin(t * 50 + L.phase) + 0.1 * Math.sin(t * 7.3);
    else {
      L.timer -= dt;
      if (L.timer <= 0) {
        if (L.mode === 'flicker') {
          if (L.k < 0.5) { L.k = 1; L.timer = rnd(0.8, 4); }
          else if (Math.random() < 0.35) { L.k = rnd(0.05, 0.3); L.timer = rnd(0.04, 0.18); }
          else L.timer = rnd(0.3, 2);
        } else {                                        // broken
          if (Math.random() < 0.08) { L.k = 0; L.timer = rnd(1, 2.5); }
          else { L.k = Math.random() < 0.5 ? rnd(0.6, 1.1) : 0.02; L.timer = rnd(0.03, 0.35); }
        }
      }
    }
    L.light.intensity = T.lampIntensity * L.k * (state.power ? CONFIG.POWER.lampMul : 1);   // F2: con power, más fuertes
  }
  if (!THEMEFX.built) return;
  WORLD.lamps.forEach((L, i) => THEMEFX.bulbs.setColorAt(i, _bulbC.setHex(0xfff0c0).multiplyScalar(0.25 + 0.75 * Math.min(1, L.k))));
  THEMEFX.bulbs.instanceColor.needsUpdate = true;

  if (THEMEFX.quality < 2) {
    for (const C of THEMEFX.curtains) {                 // la tela se mueve más abajo que arriba
      const a = C.mesh.geometry.attributes.position, B = C.base;
      for (let i = 0; i < a.count; i++) {
        const bx = B[i * 3], by = B[i * 3 + 1], f = (0.85 - by) / 1.7;
        const w = Math.sin(t * T.curtainSpeed + bx * 3 + by * 1.3 + C.ph) * 0.5 + Math.sin(t * T.curtainSpeed * 1.9 + C.ph) * 0.25;
        a.setZ(i, f * T.curtainAmp * (0.6 + w));
        a.setX(i, bx + f * T.curtainAmp * 0.3 * Math.sin(t * T.curtainSpeed * 0.7 + C.ph));
      }
      a.needsUpdate = true;
    }
    THEMEFX.shafts.material.opacity = T.shaftOpacity * (0.85 + 0.15 * Math.sin(t * 0.6));
    updateSea(t);                                           // olas: nivel 2 del gobernador las congela
  }
  if (THEMEFX.quality < 1) {
    const D = THEMEFX.dustData, a = THEMEFX.dust.geometry.attributes.position, arr = a.array, P = D.porch;
    for (let i = 0; i < D.ph.length; i++) {
      const k = i * 3, p = D.ph[i];
      if (D.sandy[i]) {                                  // arena: el viento la mete hacia la casa (+z)
        D.base[k + 2] += T.sandWind * dt * (0.6 + 0.4 * Math.sin(p));
        if (D.base[k + 2] > P.z2) D.base[k + 2] = P.z1;
      }
      arr[k]     = D.base[k]     + Math.sin(t * 0.31 + p) * 0.25;
      arr[k + 1] = D.base[k + 1] + Math.sin(t * 0.23 + p * 1.7) * 0.18;
      arr[k + 2] = D.base[k + 2] + Math.cos(t * 0.27 + p) * 0.25;
    }
    a.needsUpdate = true;
  }
}

