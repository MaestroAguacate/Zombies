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
  return this.addM(geo, _mbL, color, uvRect);
};
// F5.17: lo mismo con la matriz ya armada (seg() orienta con un cuaternión). Acepta geometrías sin índice
// (IcosahedronGeometry de r128 no lo tiene)
MeshBuilder.prototype.addM = function (geo, L, color, uvRect) {
  if (this.frame) _mbM.multiplyMatrices(this.frame, L); else _mbM.copy(L);
  _mbN.getNormalMatrix(_mbM);
  _mbC.setHex(color === undefined ? 0xffffff : color);
  if (this.tint) _mbC.multiply(this.tint);
  const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv, base = this.p.length / 3;
  const Cg = geo.userData.vox ? geo.attributes.color : null;           // F5.25: las piezas de cubos traen su sombreado
  for (let k = 0; k < P.count; k++) {
    _mbV.fromBufferAttribute(P, k).applyMatrix4(_mbM); this.p.push(_mbV.x, _mbV.y, _mbV.z);
    _mbV.fromBufferAttribute(N, k).applyMatrix3(_mbN).normalize(); this.n.push(_mbV.x, _mbV.y, _mbV.z);
    let u = U ? U.getX(k) : 0, v = U ? U.getY(k) : 0;
    if (uvRect) { u = uvRect[0] + u * (uvRect[2] - uvRect[0]); v = uvRect[1] + v * (uvRect[3] - uvRect[1]); }
    if (Cg) this.uv.push(u, v), this.c.push(_mbC.r * Cg.getX(k), _mbC.g * Cg.getY(k), _mbC.b * Cg.getZ(k));
    else this.uv.push(u, v), this.c.push(_mbC.r, _mbC.g, _mbC.b);
  }
  if (geo.index) { const I = geo.index.array; for (let k = 0; k < I.length; k++) this.i.push(base + I[k]); }
  else for (let k = 0; k < P.count; k++) this.i.push(base + k);
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
// F5.17c: la geometría sola (sin mesh ni escena): para piezas que se reusan (cuerpos de zombies, perros)
MeshBuilder.prototype.geometry = function () {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
  g.setIndex(this.i);
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
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

//--- F5.17 (Diego: "que no sea tan Minecraft, más BO2"): formas curvas en el MeshBuilder ---
// Geometrías de unidad cacheadas (cilindros, esferas, rocas, gotas) + tubos y tornos a medida. Todo se fusiona
// igual que las cajas: un draw call por MeshBuilder. Las rotaciones son como en box() (Euler YXZ)
const MBGEO = {};
const _mbUp = new THREE.Vector3(0, 1, 0);
function mbGeo(key, make) { return MBGEO[key] || (MBGEO[key] = make()); }
// F5.25 (Diego: "todos los props cúbicos, pero ultra bien diseñados"): las formas curvas de F5.17 pasaron a CUBOS con
// las mismas firmas, así los ~330 lugares que las usan (casa, playa, muelle, rancho, templo, reliquias, máquinas) quedan
// en vóxeles sin tocarlos uno por uno. Cada pieza de unidad se arma una vez (mbGeo) con cubos escalonados y su propio
// sombreado por vértice (`userData.vox`: arriba más claro, abajo más oscuro, alguna piedra más clara), que addM multiplica
// por el color del llamador
function voxGeo(fill) {
  const mb = new MeshBuilder(); fill(mb);
  const g = mb.geometry(); g.userData.vox = true; return g;
}
// una caja de una pieza de unidad con su tono `k` (multiplicador del color del llamador: 1 = igual, <1 más oscuro,
// >1 más claro; recortado a 0.5..1.25). Las piezas dan a cada capa un k distinto: así queda más oscuro abajo y más claro arriba
function vxShade(mb, x, y, z, w, h, d, k, rx, ry, rz) {
  const c = new THREE.Color().setScalar(Math.max(0.5, Math.min(1.25, k)));
  mb.box(x, y, z, w, h, d, c.getHex(), rx, ry, rz);
}
// cilindro de unidad (radio 1, alto 0..1) escalonado: cruz de dos cajas por tramo (octógono de cubos), `top` = radio arriba
function voxCylGeo(seg, top) {
  return voxGeo(mb => {
    const n = Math.abs(top - 1) < 0.05 ? 1 : 3, round = seg >= 7;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, r = 1 + (top - 1) * t, h = 1 / n, y = i / n + h / 2, k = 0.86 + t * 0.2;
      if (round) { vxShade(mb, 0, y, 0, r * 1.84, h, r * 1.24, k); vxShade(mb, 0, y, 0, r * 1.24, h * 1.001, r * 1.84, k * 0.97); }
      else vxShade(mb, 0, y, 0, r * 1.7, h, r * 1.7, k);
    }
    if (seg >= 7 && n === 1) vxShade(mb, 0, 0.96, 0, 1.3, 0.08, 1.3, 1.12);        // tapa más clara
  });
}
MeshBuilder.prototype.cyl = function (x, y, z, r, h, color, top, seg, rx, ry, rz) {
  top = top === undefined ? 1 : top; seg = seg || 8;
  const g = mbGeo('vcyl' + (seg >= 7 ? 8 : 4) + '_' + top.toFixed(1), () => voxCylGeo(seg, +top.toFixed(1)));
  return this.add(g, x, y, z, r, h, r, rx, ry, rz, color);
};
// tramo de a (x,y,z) a b, radio r0 -> r1 (vigas, ramas, sogas, huesos): cajas orientadas
MeshBuilder.prototype.seg = function (a, b, r0, r1, color, seg) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1e-4;
  const top = r1 === undefined ? 1 : r1 / r0; seg = seg || 6;
  const g = mbGeo('vcyl' + (seg >= 7 ? 8 : 4) + '_' + top.toFixed(1), () => voxCylGeo(seg, +top.toFixed(1)));
  _mbQ.setFromUnitVectors(_mbUp, _mbV2.set(dx / L, dy / L, dz / L));
  _mbL.compose(_mbP.set(a[0], a[1], a[2]), _mbQ, _mbS.set(r0, L, r0));
  return this.addM(g, _mbL, color);
};
// esfera de unidad en capas: cada capa una cruz de dos cajas, más chica hacia los polos (bola de cubos)
function voxSphereGeo(layers, noise) {
  return voxGeo(mb => {
    const r = noise ? mulberry(noise) : null;
    for (let i = 0; i < layers; i++) {
      const y0 = -1 + i * 2 / layers, y = y0 + 1 / layers, h = 2 / layers;
      const w = Math.sqrt(Math.max(0.05, 1 - y * y)) * 2 * (r ? 0.85 + r() * 0.3 : 1), k = 0.78 + (y + 1) * 0.2;
      const ox = r ? (r() - 0.5) * 0.18 : 0, oz = r ? (r() - 0.5) * 0.18 : 0;
      vxShade(mb, ox, y, oz, w, h, w * 0.66, k); vxShade(mb, ox, y, oz, w * 0.66, h * 1.001, w, k * 0.97);
    }
  });
}
MeshBuilder.prototype.sphere = function (x, y, z, sx, sy, sz, color, seg, rx, ry, rz) {
  const L = (seg || 8) >= 10 ? 7 : (seg || 8) >= 7 ? 5 : 3;
  return this.add(mbGeo('vsph' + L, () => voxSphereGeo(L, 0)), x, y, z, sx, sy, sz, rx, ry, rz, color);
};
// F5.17c "caja redondeada" → en cubos: el cuerpo más un marco un poco más angosto (canto escalonado)
MeshBuilder.prototype.rbox = function (x, y, z, w, h, d, color, r, rx, ry, rz) {
  r = Math.min(r || 0.06, h / 2 - 1e-3, d / 2 - 1e-3);
  _mbE.set(rx || 0, ry || 0, rz || 0, 'YXZ');
  _rbM.compose(_mbP.set(x, y, z), _mbQ.setFromEuler(_mbE), _mbS.set(1, 1, 1));
  const part = (px, py, pz, sx, sy, sz, c) => { _rbL.compose(_rbV.set(px, py, pz), _rbQ0, _rbS.set(sx, sy, sz)).premultiply(_rbM); this.addM(UNIT_BOX, _rbL, c); };
  const dk = new THREE.Color(color === undefined ? 0xffffff : color).multiplyScalar(0.86).getHex();
  part(0, 0, 0, w, h - 2 * r, d, color);
  part(0, 0, 0, w * 0.999, h, d - 2 * r, color);
  part(0, -h / 2 + r * 0.5, 0, w * 1.002, r, d * 0.9, dk);                  // zócalo más oscuro
  return this;
};
const _rbM = new THREE.Matrix4(), _rbL = new THREE.Matrix4(), _rbV = new THREE.Vector3(), _rbS = new THREE.Vector3(), _rbQ0 = new THREE.Quaternion();
// aro (toro) de radio R y grosor r, acostado en xz: 8 cajas en octógono (salvavidas, llantas, rollos)
MeshBuilder.prototype.ring = function (x, y, z, R, r, color, rx, ry, rz) {
  const k = Math.max(0.05, Math.min(0.9, r / R)).toFixed(2);
  const g = mbGeo('vtor' + k, () => voxGeo(mb => {
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      vxShade(mb, Math.cos(a), 0, Math.sin(a), +k * 1.8, +k * 1.8, 0.83 + +k * 0.8, i % 2 ? 1 : 0.92, 0, -a, 0);
    }
  }));
  return this.add(g, x, y, z, R, R, R, rx, ry, rz, color);
};
// roca de cubos: 3 capas de bloques desparejos, base plana, arriba más claro con alguna piedra suelta. 8 variantes
MeshBuilder.prototype.rock = function (x, y, z, sx, sy, sz, color, seed, rx, ry, rz) {
  const k = Math.abs(Math.floor(seed || 0)) % 8;
  return this.add(mbGeo('vrock' + k, () => voxRockGeo(k)), x, y, z, sx, sy, sz, rx, ry, rz, color);
};
function voxRockGeo(k) {
  return voxGeo(mb => {
    const r = mulberry(k * 97 + 13);
    const layers = [[-0.45, 0.55, 1.9], [0.12, 0.6, 1.45], [0.62, 0.42, 0.85]];      // y centro, alto, ancho
    layers.forEach(([y, h, w], li) => {
      const n = 1 + Math.floor(r() * 2) + (li === 0 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const ww = w * (0.6 + r() * 0.4), dd = w * (0.55 + r() * 0.4);
        const ox = (r() - 0.5) * (w - ww) * 1.2, oz = (r() - 0.5) * (w - dd) * 1.2;
        vxShade(mb, ox, y + (r() - 0.5) * 0.08, oz, ww, h * (0.85 + r() * 0.3), dd, 0.82 + li * 0.13 + (r() - 0.5) * 0.12, 0, (r() - 0.5) * 0.5, 0);
      }
    });
    if (r() < 0.7) vxShade(mb, (r() - 0.5) * 1.4, -0.72, (r() - 0.5) * 1.4, 0.35, 0.3, 0.3, 1.05);   // piedrita al pie
  });
}
// gota de cubos (musgo, barro, baba, carne, montículos): bola en capas desparejas. 6 variantes
MeshBuilder.prototype.blob = function (x, y, z, sx, sy, sz, color, seed, rx, ry, rz) {
  const k = Math.abs(Math.floor(seed || 0)) % 6;
  return this.add(mbGeo('vblob' + k, () => voxSphereGeo(5, k * 131 + 7)), x, y, z, sx, sy, sz, rx, ry, rz, color);
};
// tubo por una curva (puntos [x,y,z]), radio r0 -> r1: tramos de cajas que siguen la curva (lianas, raíces, tentáculos)
MeshBuilder.prototype.tube = function (pts, r0, r1, color, seg, radial) {
  seg = seg || 8;
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  let prev = curve.getPointAt(0);
  for (let i = 1; i <= seg; i++) {
    const t = i / seg, P = curve.getPointAt(t), r = r0 + (r1 - r0) * (t - 0.5 / seg);
    const dx = P.x - prev.x, dy = P.y - prev.y, dz = P.z - prev.z, L = Math.hypot(dx, dy, dz) || 1e-4;
    _mbQ.setFromUnitVectors(_mbUp, _mbV2.set(dx / L, dy / L, dz / L));
    _mbL.compose(_mbP.set((P.x + prev.x) / 2, (P.y + prev.y) / 2, (P.z + prev.z) / 2), _mbQ, _mbS.set(r * 1.75, L + r * 0.9, r * 1.75));
    this.addM(UNIT_BOX, _mbL, color);
    prev = P;
  }
  return this;
};
// torno: perfil [[r, y], ...] de abajo hacia arriba → pila de cajas en cruz (cúpulas, frascos, botellas). Si el perfil
// termina abierto arriba (el último radio no es ~0: macetas, nidos, braseros, murallas), la pieza es HUECA: fondo macizo
// y paredes en anillo cuadrado, así se ve lo que va adentro (tierra, huevos, brasas)
MeshBuilder.prototype.lathe = function (profile, x, y, z, sx, sy, sz, color, seg, rx, ry, rz) {
  const key = 'vlat' + profile.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(';');
  const g = mbGeo(key, () => voxGeo(mb => {
    const maxR = Math.max(...profile.map(p => p[0])), open = profile[profile.length - 1][0] > maxR * 0.3;
    for (let i = 0; i + 1 < profile.length; i++) {
      const [ra, ya] = profile[i], [rb, yb] = profile[i + 1], h = Math.abs(yb - ya), r = Math.max(ra, rb);
      if (h < 1e-3 || r < 1e-3) continue;
      const yc = (ya + yb) / 2, k = 0.84 + (i / profile.length) * 0.26;
      if (!open || i === 0) { vxShade(mb, 0, yc, 0, r * 1.84, h, r * 1.24, k); vxShade(mb, 0, yc, 0, r * 1.24, h * 1.001, r * 1.84, k * 0.97); continue; }
      const s = r * 1.7, t = Math.max(0.02, maxR * 0.22);
      for (const sd of [-1, 1]) {
        vxShade(mb, 0, yc, sd * (s - t) / 2, s, h, t, k);
        vxShade(mb, sd * (s - t) / 2, yc, 0, t, h, s - 2 * t, k * 0.95);
      }
    }
  }));
  return this.add(g, x, y, z, sx, sy, sz, rx, ry, rz, color);
};
// hoja: plano del atlas de follaje (FOLI.r[reg]) parado en (x, y, z) con la base abajo. Normales tiradas hacia
// arriba: el follaje se ilumina parejo de los dos lados (el material de FOLI no da vuelta la luz atrás)
// F5.25 B (Diego: "todo cúbico, ultra bien diseñado"): la vegetación ya no son planos con alfa sino CUBOS (FOLI.mat pasó a
// color por vértice). card / frond / clump arman cubos según la región (paja, liana, musgo, panel de hojas, hoja grande,
// telaraña, pasto, helecho, flores, penacho), con paletas propias multiplicadas por el tinte que se pasaba antes. Las
// firmas no cambiaron: todo lo que las usaba (cercos, lianas de las lianas que se queman, hiedra, la palapa) pasó solo
// F5.28f (Diego: "no ese verde brillante, un verde normal de jungla mojada"): los verdes, más oscuros, profundos y
// apenas azulados (antes, verde lima)
const VOXPAL = {
  leaf: [0x183016, 0x1d381a, 0x23401e, 0x294a24, 0x30522a], ivy: [0x1f3c1e, 0x284824, 0x30522a, 0x264420],
  grass: [0x3e5a26, 0x46622a, 0x4e6a30, 0x365222, 0x566e34], fern: [0x22421e, 0x2a4c22, 0x325628, 0x284a22],
  moss: [0x30482a, 0x3a522e, 0x283e22], vine: [0x26401c, 0x2e4a22, 0x1f3818], palm: [0x243e1a, 0x2c4820, 0x345226],
  thatch: [0xb89a5a, 0xa88a4a, 0xc8aa6a, 0x9a7a40], dead: [0x8a6a3a, 0x7a5a2a, 0x9a7a44], bigleaf: [0x1c3e1a, 0x24481f, 0x2c5226],
  flower: [0xd84a6a, 0xe8b84a, 0xf07ad8, 0xf4f0e8, 0xe86a3a, 0x8a5ae8]
};
const _vxE = new THREE.Euler(), _vxV = new THREE.Vector3(), _vxC = new THREE.Color(), _vxT = new THREE.Color();
let _vxS = 7;
function vxRand() { _vxS = (_vxS * 16807) % 2147483647; return _vxS / 2147483647; }
function vxCol(reg, tint, k) {
  const P = VOXPAL[reg] || VOXPAL.leaf;
  _vxC.setHex(P[(k === undefined ? Math.floor(vxRand() * P.length) : k) % P.length]);
  if (tint !== undefined && tint !== 0xffffff) { _vxT.setHex(tint); _vxC.r *= 0.55 + _vxT.r * 0.45; _vxC.g *= 0.55 + _vxT.g * 0.45; _vxC.b *= 0.55 + _vxT.b * 0.45; }
  return _vxC.getHex();
}
// un cubo en el marco local de una hoja (lx, ly, lz), girado como ella, desde la base (x, y, z)
MeshBuilder.prototype.vbox = function (x, y, z, rx, ry, rz, lx, ly, lz, w, h, d, color) {
  _vxV.set(lx, ly, lz).applyEuler(_vxE.set(rx || 0, ry || 0, rz || 0));
  return this.box(x + _vxV.x, y + _vxV.y, z + _vxV.z, w, h, d, color, rx || 0, ry || 0, rz || 0);
};
MeshBuilder.prototype.card = function (x, y, z, w, h, rx, ry, rz, reg, color) {
  const B = (lx, ly, lz, bw, bh, bd, c) => this.vbox(x, y, z, rx, ry, rz, lx, ly, lz, bw, bh, bd, c);
  if (reg === 'thatch') {                                                  // flecos de paja
    const n = Math.max(2, Math.round(w / 0.12));
    for (let i = 0; i < n; i++) { const hh = h * (0.75 + vxRand() * 0.25); B(-w / 2 + (i + 0.5) * w / n, h - hh / 2, (vxRand() - 0.5) * 0.04, w / n * 0.95, hh, 0.05, vxCol('thatch', color)); }
  } else if (reg === 'vine') {                                             // liana: tallo de cubitos y hojas a los costados
    for (let yy = h; yy > 0; yy -= 0.16) {
      B((vxRand() - 0.5) * 0.04, yy, 0, 0.06, 0.17, 0.06, vxCol('vine', color, 2));
      if (vxRand() < 0.6) B((vxRand() < 0.5 ? -1 : 1) * 0.09, yy, 0.02, 0.14, 0.11, 0.05, vxCol('vine', color));
    }
  } else if (reg === 'moss' || reg === 'ivy') {                            // parche de musgo / hiedra pegado a una cara
    const s = 0.16;
    for (let i = 0; i < Math.round(w / s); i++) for (let j = 0; j < Math.round(h / s); j++) {
      const u = (i + 0.5) / Math.round(w / s) - 0.5, v = (j + 0.5) / Math.round(h / s);
      if (vxRand() < 0.25 + Math.abs(u) * 0.8 + Math.abs(v - 0.5) * 0.6) continue;   // bordes ralos
      B(u * w, v * h, vxRand() * 0.03, s, s, 0.05, vxCol(reg, color));
    }
  } else if (reg === 'web') {                                              // telaraña: rayos y dos vueltas
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; for (let t = 0.1; t < 0.5; t += 0.07) B(Math.cos(a) * w * t, h * 0.5 + Math.sin(a) * h * t, 0, 0.02, 0.02, 0.01, color || 0xd8d0c0); }
    for (const r of [0.2, 0.38]) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; B(Math.cos(a) * w * r, h * 0.5 + Math.sin(a) * h * r, 0, 0.03, 0.015, 0.01, color || 0xd8d0c0); }
  } else if (reg === 'bigleaf') {                                          // hoja grande: tallo y lámina en escalones
    const n = 7;
    for (let j = 0; j < n; j++) {
      const v = j / (n - 1), ww = w * Math.sin(Math.PI * (0.15 + v * 0.85)) * 0.9;
      B(0, h * (0.3 + v * 0.7), 0, ww, h * 0.7 / n * 1.05, 0.04, vxCol('bigleaf', color));
      B(0, h * (0.3 + v * 0.7), 0.025, 0.04, h * 0.7 / n, 0.02, 0x5a8a3a);   // nervadura
    }
    B(0, h * 0.15, 0, 0.05, h * 0.3, 0.05, 0x3a5a22);
  } else {                                                                 // panel de hojas (cercos, matas): cubos con relieve
    const s = Math.min(0.34, Math.max(0.2, Math.min(w, h) / 5));
    const nx = Math.max(1, Math.round(w / s)), ny = Math.max(1, Math.round(h / s));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const u = (i + 0.5) / nx - 0.5, v = (j + 0.5) / ny;
      if ((v > 0.85 || Math.abs(u) > 0.42) && vxRand() < 0.5) continue;   // borde de arriba y costados desparejo
      B(u * w, v * h, (vxRand() - 0.5) * s * 0.8, s, s, s * 0.7, vxCol(reg === 'dead' ? 'dead' : 'leaf', color));
    }
  }
  return this;
};
// fronda acostada: base en (x, y, z), largo hacia `yaw` (0 = +x), cae `droop` rad; ancho wid. En cubos: la nervadura y
// hojitas a los costados que se achican hacia la punta, curvándose hacia abajo
MeshBuilder.prototype.frond = function (x, y, z, len, wid, yaw, droop, reg, color, uvRect) {
  const r = reg || 'palm', n = Math.max(3, Math.round(len / 0.26)), st = len / n, cy = Math.cos(yaw), sy = -Math.sin(yaw);
  let px = x, py = y, pz = z;
  for (let k = 0; k < n; k++) {
    const f = k / n, dr = droop * (0.5 + f * 1.1);
    px += cy * Math.cos(dr) * st; pz += sy * Math.cos(dr) * st; py -= Math.sin(dr) * st;
    const c = vxCol(r === 'fern' ? 'fern' : 'palm', color);
    this.box(px, py, pz, st * 1.08, 0.04, Math.max(0.05, wid * 0.14), c, 0, yaw, -dr);
    if (k % 2 === 0 || n < 5) for (const sd of [-1, 1]) {
      const lw = Math.max(0.06, wid * 0.42 * (1 - f * 0.8));
      this.box(px - sy * sd * lw * 0.55, py - lw * 0.15, pz + cy * sd * lw * 0.55, st * 1.1, 0.03, lw, c, sd * 0.35, yaw, -dr);
    }
  }
  return this;
};
// quad con normales por vértice (superficies curvas armadas a mano, como la cúpula del caparazón). pts/nrm/uvs de 4.
// Si el orden deja la cara al revés de las normales, lo da vuelta
MeshBuilder.prototype.quadN = function (pts, nrm, uvs, color) {
  const a = pts[0], b = pts[1], d = pts[3], base = this.p.length / 3;
  const gx = (b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]), gy = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]),
        gz = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
  const n0 = nrm[0], flip = gx * n0[0] + gy * n0[1] + gz * n0[2] < 0, ord = flip ? [0, 3, 2, 1] : [0, 1, 2, 3];
  _mbC.setHex(color === undefined ? 0xffffff : color);
  if (this.tint) _mbC.multiply(this.tint);
  for (const k of ord) {
    this.p.push(pts[k][0], pts[k][1], pts[k][2]); this.n.push(nrm[k][0], nrm[k][1], nrm[k][2]);
    this.uv.push(uvs[k][0], uvs[k][1]); this.c.push(_mbC.r, _mbC.g, _mbC.b);
  }
  this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  return this;
};
MeshBuilder.prototype.upNormals = function (n0) {
  for (let k = n0; k < this.n.length; k += 3) {
    const x = this.n[k] * 0.3, y = this.n[k + 1] * 0.3 + 1, z = this.n[k + 2] * 0.3, l = Math.hypot(x, y, z);
    this.n[k] = x / l; this.n[k + 1] = y / l; this.n[k + 2] = z / l;
  }
  return this;
};
// mata (F5.25 B, en cubos): arbusto (cáscara de cubos de hoja), mata de pasto (hojas finas torcidas), helecho (frondas
// en ronda), flores (tallos y pétalos), penacho de palma, hiedra
MeshBuilder.prototype.clump = function (x, y, z, w, h, reg, color, rot, top) {
  rot = rot || 0;
  if (reg === 'grass') {
    const n = 5 + Math.floor(vxRand() * 3);
    for (let k = 0; k < n; k++) {
      const a = rot + k * 2.4, r = vxRand() * w * 0.3, bh = h * (0.5 + vxRand() * 0.5);
      this.box(x + Math.cos(a) * r, y + bh / 2, z + Math.sin(a) * r, 0.05, bh, 0.05, vxCol('grass', color), (vxRand() - 0.5) * 0.5, a, (vxRand() - 0.5) * 0.5);
    }
  } else if (reg === 'fern' || reg === 'palm') {
    const n = reg === 'palm' ? 6 : 5;
    for (let k = 0; k < n; k++) this.frond(x, y + h * 0.15, z, w * 0.6, w * 0.35, rot + k / n * Math.PI * 2, 0.35 + vxRand() * 0.4, reg, color);
  } else if (reg === 'flower') {
    const n = 3 + Math.floor(vxRand() * 3);
    for (let k = 0; k < n; k++) {
      const a = rot + k * 2.1, r = vxRand() * w * 0.35, sh = h * (0.5 + vxRand() * 0.5), fx = x + Math.cos(a) * r, fz = z + Math.sin(a) * r;
      this.box(fx, y + sh / 2, fz, 0.04, sh, 0.04, 0x4a7a26);
      const pc = vxCol('flower', 0xffffff);
      for (const [dx, dz] of [[0.07, 0], [-0.07, 0], [0, 0.07], [0, -0.07]]) this.box(fx + dx, y + sh, fz + dz, 0.07, 0.04, 0.07, pc);
      this.box(fx, y + sh + 0.01, fz, 0.06, 0.05, 0.06, 0xf0d040);
      this.box(fx + 0.06, y + sh * 0.5, fz, 0.1, 0.03, 0.05, 0x5a8a2e, 0, a, 0.3);   // hojita del tallo
    }
  } else {                                                                 // arbusto / hiedra / hojas: cáscara de cubos
    const s = Math.min(0.42, Math.max(0.2, w / 5)), rx = w / 2, ry = Math.max(0.2, h / 2), cy = y + ry * 0.9;
    const nx = Math.ceil(rx / s), ny = Math.ceil(ry / s);
    for (let i = -nx; i <= nx; i++) for (let j = -ny; j <= ny; j++) for (let k = -nx; k <= nx; k++) {
      const e = (i * s / rx) ** 2 + (j * s / ry) ** 2 + (k * s / rx) ** 2;
      if (e > 1 || e < 0.45 || (j < -ny * 0.5)) continue;                // solo la cáscara, sin fondo
      if (vxRand() < 0.1) continue;                                       // huecos sueltos
      const tone = Math.max(0, Math.min(4, Math.floor(1.5 + (j / ny) * 2 + (vxRand() - 0.5) * 1.5)));
      this.box(x + i * s, cy + j * s, z + k * s, s, s, s, vxCol(reg === 'ivy' ? 'ivy' : 'leaf', color, tone));
    }
  }
  return this;
};

// F5.17: MeshBuilder por celdas de `size` m: cada celda es su propio mesh (con su esfera de límites), así la
// cámara (camera.far = la niebla) descarta lo lejano y el frustum lo de atrás. La jungla entera era un mesh
// que se dibujaba siempre
function ChunkMB(size) { this.size = size || 24; this.map = {}; }
ChunkMB.prototype.at = function (x, z) {
  const k = Math.floor(x / this.size) + ',' + Math.floor(z / this.size);
  return this.map[k] || (this.map[k] = new MeshBuilder());
};
ChunkMB.prototype.meshes = function (mat) {
  const out = [];
  for (const k in this.map) {
    const m = this.map[k].mesh(mat);
    if (m) { m.userData.theme = false; out.push(m); }
  }
  return out;
};
// F5.28f (rendimiento): un reemplazo de MeshBuilder que manda cada pieza a la celda de su (x, z), con las mismas firmas
// (box / card / clump / frond: x, y, z primero; add: geometría y después x, y, z). Sirve para lo que se armaba en un solo
// MeshBuilder que cubría medio mapa (no se descartaba nunca por estar fuera de la vista). Sin setFrame: coordenadas del
// mundo. mesh(mat) arma todas las celdas y devuelve la primera (como MeshBuilder.mesh)
ChunkMB.prototype.proxy = function () {
  const C = this;
  return {
    box: (x, y, z, ...a) => C.at(x, z).box(x, y, z, ...a),
    card: (x, y, z, ...a) => C.at(x, z).card(x, y, z, ...a),
    clump: (x, y, z, ...a) => C.at(x, z).clump(x, y, z, ...a),
    frond: (x, y, z, ...a) => C.at(x, z).frond(x, y, z, ...a),
    add: (g, x, y, z, ...a) => C.at(x, z).add(g, x, y, z, ...a),
    mesh: mat => { const ms = C.meshes(mat); ms.forEach(m => m.updateMatrix()); return ms[0] || null; }
  };
};

//--- F5.17: atlas de follaje (hojas con alfa, dibujadas por canvas). FOLI.r[reg] = [u0, v0, u1, v1] ---
const FOLI = { tex: null, mat: null, depth: null, r: {} };
function buildFoliage() {
  const S = 512, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d'), R = mulberry(71);
  const reg = (key, x0, y0, x1, y1, draw) => {
    c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
    draw(x0, y0, x1 - x0, y1 - y0);
    c.restore();
    FOLI.r[key] = [x0 / S, 1 - y1 / S, x1 / S, 1 - y0 / S];
  };
  const leaf = (x, y, len, wid, ang, col, rib) => {              // hoja con nervio
    c.save(); c.translate(x, y); c.rotate(ang);
    c.fillStyle = col; c.beginPath(); c.moveTo(0, 0);
    c.quadraticCurveTo(len * 0.5, -wid, len, 0); c.quadraticCurveTo(len * 0.5, wid, 0, 0); c.fill();
    if (rib) { c.strokeStyle = rib; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(len * 0.9, 0); c.stroke(); }
    c.restore();
  };
  const greens = ['#3f6a2c', '#4f7c34', '#355a26', '#5c8a3c', '#2c4c20', '#6a9444'];
  // copa: racimo de hojas anchas desde abajo al centro, más densas en el medio
  reg('leaf', 0, 0, 256, 256, (x0, y0, w, h) => {
    for (let i = 0; i < 140; i++) {
      const a = -Math.PI / 2 + (R() - 0.5) * 2.9, d = 20 + R() * 95, px = x0 + w / 2 + Math.cos(a) * d * 0.9, py = y0 + h * 0.62 + Math.sin(a) * d * 0.8;
      leaf(px, py, 26 + R() * 22, 7 + R() * 6, a + (R() - 0.5), greens[i % 6], 'rgba(20,40,12,.5)');
    }
  });
  // fronda de palmera: nervio curvo (base a la izquierda) con folíolos finos que cuelgan
  reg('palm', 256, 0, 512, 128, (x0, y0, w, h) => {
    const cy = y0 + h / 2;
    for (let i = 0; i < 64; i++) {
      const t = i / 64, x = x0 + 8 + t * (w - 16), sp = (1 - t * 0.7) * 50;
      for (const sd of [-1, 1]) leaf(x, cy, sp, 3.2, sd * (1.1 + t * 0.3), greens[(i + (sd > 0 ? 1 : 3)) % 6]);
    }
    c.strokeStyle = '#6a5a34'; c.lineWidth = 4; c.beginPath(); c.moveTo(x0, cy); c.lineTo(x0 + w, cy); c.stroke();
  });
  // helecho: nervio con folíolos que se achican a la punta
  reg('fern', 256, 128, 512, 256, (x0, y0, w, h) => {
    const cy = y0 + h / 2;
    for (let i = 0; i < 40; i++) {
      const t = i / 40, x = x0 + 10 + t * (w - 20), sp = (1 - t) * 48 + 6;
      for (const sd of [-1, 1]) leaf(x, cy, sp, 5, sd * 1.25, greens[(i + 2) % 6], 'rgba(20,40,12,.4)');
    }
    c.strokeStyle = '#3a5424'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, cy); c.lineTo(x0 + w, cy); c.stroke();
  });
  // pasto: briznas desde abajo
  reg('grass', 0, 256, 128, 384, (x0, y0, w, h) => {
    for (let i = 0; i < 70; i++) {
      const bx = x0 + 6 + R() * (w - 12), tall = h * (0.45 + R() * 0.55), lean = (R() - 0.5) * 30;
      c.strokeStyle = ['#5c7a34', '#4a6a2a', '#7a9444', '#6a8a3a', '#8a9a4a'][i % 5]; c.lineWidth = 2 + R() * 2;
      c.beginPath(); c.moveTo(bx, y0 + h); c.quadraticCurveTo(bx + lean * 0.3, y0 + h - tall * 0.6, bx + lean, y0 + h - tall); c.stroke();
    }
  });
  // liana colgando (arriba = de donde cuelga)
  reg('vine', 128, 256, 192, 512, (x0, y0, w, h) => {
    c.strokeStyle = '#4a5a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0 + w / 2, y0);
    for (let y = 0; y <= h; y += 16) c.lineTo(x0 + w / 2 + Math.sin(y * 0.05) * 8, y0 + y); c.stroke();
    for (let y = 8; y < h - 6; y += 9) leaf(x0 + w / 2 + Math.sin(y * 0.05) * 8, y0 + y, 14 + R() * 8, 5, (y % 18 ? 0.5 : Math.PI - 0.5) + (R() - 0.5) * 0.5, greens[y % 6]);
  });
  // paja del techo: flecos que cuelgan
  reg('thatch', 192, 256, 320, 384, (x0, y0, w, h) => {
    for (let i = 0; i < 160; i++) {
      const bx = x0 + R() * w, len = h * (0.55 + R() * 0.45);
      c.strokeStyle = ['#b8955a', '#a07c44', '#c8a868', '#8a6a3a', '#d0b070'][i % 5]; c.lineWidth = 1.5 + R() * 1.5;
      c.beginPath(); c.moveTo(bx, y0); c.lineTo(bx + (R() - 0.5) * 8, y0 + len); c.stroke();
    }
  });
  // hiedra / musgo: mancha redonda de hojitas
  reg('ivy', 320, 256, 448, 384, (x0, y0, w, h) => {
    for (let i = 0; i < 180; i++) {
      const a = R() * 6.3, d = Math.sqrt(R()) * w * 0.45;
      leaf(x0 + w / 2 + Math.cos(a) * d, y0 + h / 2 + Math.sin(a) * d, 9 + R() * 6, 4, R() * 6.3, greens[i % 6]);
    }
  });
  // flores tropicales (rojas, naranjas, rosas) con hojitas
  reg('flower', 448, 256, 512, 320, (x0, y0, w, h) => {
    for (let i = 0; i < 14; i++) leaf(x0 + w / 2, y0 + h, 18 + R() * 12, 4, -Math.PI / 2 + (R() - 0.5) * 2, greens[i % 6]);
    for (let i = 0; i < 9; i++) {
      c.fillStyle = ['#e83a4a', '#f08a2a', '#e85aa0', '#f0c030'][i % 4];
      const fx = x0 + 10 + R() * (w - 20), fy = y0 + 8 + R() * (h * 0.55);
      for (let p = 0; p < 5; p++) { const a = p / 5 * 6.28; c.beginPath(); c.arc(fx + Math.cos(a) * 3, fy + Math.sin(a) * 3, 2.6, 0, 7); c.fill(); }
      c.fillStyle = '#f8e070'; c.beginPath(); c.arc(fx, fy, 1.6, 0, 7); c.fill();
    }
  });
  // hojas secas (piso)
  reg('dead', 448, 320, 512, 384, (x0, y0, w, h) => {
    for (let i = 0; i < 26; i++) leaf(x0 + 6 + R() * (w - 12), y0 + 6 + R() * (h - 12), 10 + R() * 8, 4, R() * 6.3, ['#7a5a2a', '#8a6a34', '#5a4420', '#9a7a3a'][i % 4], 'rgba(40,20,5,.5)');
  });
  // hoja grande (banano / monstera), base abajo
  reg('bigleaf', 0, 384, 128, 512, (x0, y0, w, h) => {
    c.fillStyle = '#3f7030'; c.beginPath(); c.moveTo(x0 + w / 2, y0 + h);
    c.bezierCurveTo(x0 - 10, y0 + h * 0.5, x0 + w * 0.2, y0 + 4, x0 + w / 2, y0 + 2);
    c.bezierCurveTo(x0 + w * 0.8, y0 + 4, x0 + w + 10, y0 + h * 0.5, x0 + w / 2, y0 + h); c.fill();
    c.strokeStyle = '#6a9a4a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0 + w / 2, y0 + h); c.lineTo(x0 + w / 2, y0 + 6); c.stroke();
    c.lineWidth = 1;
    for (let y = 16; y < h - 8; y += 8) for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(x0 + w / 2, y0 + y + 6); c.lineTo(x0 + w / 2 + sd * w * 0.42, y0 + y); c.stroke(); }
    c.globalCompositeOperation = 'destination-out';                  // cortes de la monstera
    for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(x0 + w / 2 + (i % 2 ? 1 : -1) * w * 0.3, y0 + 20 + i * 16, 8, 3, (i % 2 ? -0.4 : 0.4), 0, 7); c.fill(); }
    c.globalCompositeOperation = 'source-over';
  });
  // telaraña (rincones del caparazón, la cueva)
  reg('web', 256, 384, 384, 512, (x0, y0, w, h) => {
    c.strokeStyle = 'rgba(230,230,220,.8)'; c.lineWidth = 1;
    const cx = x0 + 6, cy = y0 + 6;
    for (let k = 0; k < 9; k++) { const a = k / 8 * Math.PI / 2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * w, cy + Math.sin(a) * h); c.stroke(); }
    for (let d = 14; d < w * 1.3; d += 12) { c.beginPath(); for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI / 2, rr = d + Math.sin(k * 3) * 2; k ? c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : c.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } c.stroke(); }
  });
  // raíces colgando / flecos de musgo
  reg('moss', 384, 384, 512, 512, (x0, y0, w, h) => {
    for (let i = 0; i < 90; i++) {
      const bx = x0 + R() * w, len = h * (0.3 + R() * 0.7);
      c.strokeStyle = ['#4a5a2a', '#5a6a34', '#3a4a22', '#6a7a3a'][i % 4]; c.lineWidth = 1 + R() * 2;
      c.beginPath(); c.moveTo(bx, y0); c.quadraticCurveTo(bx + (R() - 0.5) * 12, y0 + len * 0.5, bx + (R() - 0.5) * 6, y0 + len); c.stroke();
    }
  });
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = texAniso();
  FOLI.tex = t;
  // F5.25 B: la vegetación es de cubos: color por vértice, sin textura ni alfa (un poco de luz propia: las caras de abajo
  // de las matas no quedan negras). La textura del atlas queda armada por si algo la necesita
  FOLI.mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x0c1608 });
  FOLI.depth = null;
}
function texAniso() {
  return typeof renderer !== 'undefined' && renderer && renderer.capabilities ? Math.min(4, renderer.capabilities.getMaxAnisotropy()) : 1;
}

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
  const trims = new MeshBuilder(T.interiorTint), runs = [];     // F5.17c: zócalos, molduras y guardasillas
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
      const cuts = [f.s[0]], holes = rail ? null : wallHoles(c, f);   // F5.20: huecos de las ventanas
      for (let k = Math.floor(f.s[0]) + 1; k < f.s[1]; k++) cuts.push(k);
      cuts.push(f.s[1]);
      let runStart = cuts[0], runKey = null;
      for (let k = 0; k < cuts.length - 1; k++) {
        const q = P((cuts[k] + cuts[k + 1]) / 2, 2);
        const key = rail ? 'RAIL' : roomKey(q[0] + f.n[0] * 0.3, q[2] + f.n[2] * 0.3);
        if (runKey !== null && key !== runKey) {
          emitSkin(get(runKey), P, runStart, cuts[k], f.r[0], f.r[1], runKey, holes);
          runs.push([runStart, cuts[k], runKey]);
          runStart = cuts[k];
        }
        runKey = key;
      }
      emitSkin(get(runKey), P, runStart, f.s[1], f.r[0], f.r[1], runKey, holes);
      trimRun(trims, f, P, runs.concat([[runStart, f.s[1], runKey]]));
      runs.length = 0;
    }
  }
  trims.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  for (const key in builders) {
    const room = ROOMS.find(r => r.id === key);
    const lit = key === 'EXT' || key === 'RAIL' || (room && room.outdoor);   // afuera no se tiñe
    builders[key].mesh(new THREE.MeshLambertMaterial({ map: TEX.skin[key], color: lit ? 0xffffff : T.interiorTint }));
  }
}
// F5.17c: zócalo abajo, moldura redondeada arriba y guardasillas en sala y pasillo, a lo largo de cada tramo de pared
// de un cuarto cerrado (ni fachada, ni baranda). Un solo mesh con color por vértice y el tinte de adentro
function trimRun(b, f, P, runs) {
  const along = f.t[0] !== 0;
  for (const [s0, s1, key] of runs) {
    if (!/^R[2-79]$/.test(key) || s1 - s0 < 0.3) continue;
    const len = s1 - s0, bar = (y, h, dp, col, round) => {
      const c = P((s0 + s1) / 2, y), x = c[0] + f.n[0] * dp / 2, z = c[2] + f.n[2] * dp / 2;
      b.box(x, y, z, along ? len : dp, h, along ? dp : len, col);
      if (round) { const a = P(s0, y + h / 2), e = P(s1, y + h / 2), o = dp * 0.9;
        b.seg([a[0] + f.n[0] * o, a[1], a[2] + f.n[2] * o], [e[0] + f.n[0] * o, e[1], e[2] + f.n[2] * o], dp * 0.55, dp * 0.55, col, 6); }
    };
    if (f.r[0] < 0.1) bar(0.08, 0.16, 0.035, 0x5a4636, true);
    if (f.r[1] > 3.6) bar(3.84, 0.14, 0.05, 0x7a6a54, true);
    if ((key === 'R2' || key === 'R4') && f.r[0] < 0.8 && f.r[1] > 1.2) bar(0.84, 0.06, 0.03, 0x6a5440, true);
  }
}
function emitSkin(b, P, s0, s1, r0, r1, key, holes) {
  // F5.20: huecos de las ventanas de las barricadas ([hs0, hs1, hr0, hr1] en las coordenadas de la cara): se parte el
  // tramo en izquierda, derecha, abajo y arriba del hueco
  if (holes) for (const h of holes) {
    if (h[1] <= s0 || h[0] >= s1 || h[3] <= r0 || h[2] >= r1) continue;
    const rest = holes.filter(q => q !== h), a = Math.max(s0, h[0]), c = Math.min(s1, h[1]);
    if (a > s0) emitSkin(b, P, s0, a, r0, r1, key, rest);
    if (c < s1) emitSkin(b, P, c, s1, r0, r1, key, rest);
    if (h[2] > r0) emitSkin(b, P, a, c, r0, h[2], key, rest);
    if (h[3] < r1) emitSkin(b, P, a, c, h[3], r1, key, rest);
    return;
  }
  const uS = 2, vS = key === 'RAIL' ? 1.2 : key === 'TRIM' ? 2 : 4;
  b.quad(P(s0, r0), P(s1, r0), P(s1, r1), P(s0, r1),
    [[s0 / uS, r0 / vS], [s1 / uS, r0 / vS], [s1 / uS, r1 / vS], [s0 / uS, r1 / vS]]);
}
// F5.20: los huecos de las ventanas de barricada que caen en este collider de pared, en coordenadas de la cara f
function wallHoles(c, f) {
  const B = CONFIG.BARRIERS, out = [];
  for (const d of B.list) {
    if (d.kind !== 'window') continue;
    if (d.x < c.minX - 0.05 || d.x > c.maxX + 0.05 || d.z < c.minZ - 0.05 || d.z > c.maxZ + 0.05) continue;
    const along = Math.abs(d.n[1]) > 0.5 ? [1, 0] : [0, 1];              // la ventana corre a lo largo de x o de z
    if ((along[0] && f.t[0] === 0) || (along[1] && f.t[2] === 0)) continue;   // cara que no es la de la ventana
    const sc = f.t[0] * d.x + f.t[2] * d.z;
    out.push([sc - B.winW / 2, sc + B.winW / 2, B.winY0, B.winY1]);
  }
  return out.length ? out : null;
}

//--- ventanas pintadas (vista al atardecer), marcos, tablas, haces de luz ---
// axis 'x' = pared en x=face; n = +1/-1 hacia adentro; c = centro a lo largo de la pared
const WINDOWS = [
  // (F5.20: sin el ventanal tablado de la sala: en esa pared va la ventana de barricada W2, con hueco de verdad)
  { room: 'R3', axis: 'z', face: 13.8,  n: -1, c: 15.5, w: 1.8, y0: 1.2, y1: 2.4, view: 'palm' },
  { room: 'R5', axis: 'z', face: 29.8,  n: -1, c: 10.2, w: 2.4, y0: 1.1, y1: 2.5, view: 'sea', curtains: true },   // F5.20: corrida (W7 en x 14.5)
  // (F5.20, Diego: sin la ventana del garaje: ahí va una gotera de sangre verde, garden.js buildHouseGoo)
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
// F5.17: tronco de cilindros con anillos (antes cajas) y frondas de hojas con alfa en `fb` (FOLI.mat), arqueadas en
// dos tramos. Sin `fb`, las frondas van como antes (tablas). La cuenta del tronco no cambia (palmTop)
// F5.25 A (Diego: "todos los árboles cúbicos, ultra bien diseñados"): en cubos. El tronco sigue la MISMA curva (palmTop
// la usa para el coco de la quest): cada tramo son 2 cubos inclinados con su anillo oscuro y alguna fibra que cuelga; la
// corona, cubos con cocos; las frondas, cadenas de tablitas que salen, suben un poco y caen, con hojitas a los costados
// (verdes; las rotas, secas y caídas). `fb` ya no se usa (quedó por compatibilidad)
function palm(b, x, z, segs, broken, lean, rot, fb) {
  b.setFrame(x, 0, z, rot);
  let px = 0, py = 0;
  for (let i = 0; i < segs; i++) {
    const h = 0.9, wd = 0.4 - i * 0.013, ang = lean * Math.pow(i / segs, 2) * 1.6;
    const nx = px + Math.sin(ang) * h, ny = py + Math.cos(ang) * h;
    for (let k = 0; k < 2; k++) {                                        // 2 cubos por tramo, inclinados con el tronco
      const u = (k + 0.5) / 2;
      b.box(px + (nx - px) * u, py + (ny - py) * u, 0, wd, h * 0.52, wd, (i + k) % 2 ? 0x6e5f50 : 0x7a6a56, 0, 0, -ang);
    }
    b.box(px, py + 0.04, 0, wd + 0.08, 0.08, wd + 0.08, 0x4a3e30, 0, 0, -ang);   // anillo
    if (i % 3 === 1) b.box(px + wd / 2 + 0.02, py + 0.3, (rnd(-1, 1)) * 0.1, 0.04, 0.35, 0.08, 0x9a8a62, 0, 0, -ang);   // fibra que cuelga
    px = nx; py = ny;
  }
  if (broken) for (let k = 0; k < 3; k++) b.box(px + 0.2 + k * 0.18, py - 0.25 - k * 0.3, 0.05, 0.14, 0.34, 0.14, 0x5e5044, 0, 0, 0.6);   // punta quebrada colgando
  b.box(px, py, 0, 0.56, 0.4, 0.56, 0x5a4a34);                          // corona
  b.box(px, py + 0.26, 0, 0.36, 0.2, 0.36, broken ? 0x7a6a3a : 0x4a7a26);
  if (!broken) for (let k = 0; k < 4; k++) { const a = k * 1.57 + 0.4; b.box(px + Math.cos(a) * 0.3, py - 0.26, Math.sin(a) * 0.3, 0.26, 0.28, 0.26, k % 2 ? 0x6a4a22 : 0x5a3e1c); }   // cocos
  const n = broken ? 5 : 11, GREEN = [0x5a9030, 0x6aa038, 0x7ab040, 0x4e8028], DRY = [0x9a8a55, 0x8a7a48, 0xa89a62];
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2 + rnd(-0.2, 0.2), ca = Math.cos(a), sa = -Math.sin(a), steps = broken ? 5 : 7 + Math.floor(rnd(0, 2));
    let fx = px, fy = py + 0.15, fz = 0, dy = broken ? -0.1 : rnd(0.35, 0.6);
    const st = 0.32;
    for (let j = 0; j < steps; j++) {
      fx += ca * st; fz += sa * st; fy += dy * st; dy -= broken ? 0.35 : rnd(0.18, 0.26);
      const col = broken ? DRY[(k + j) % 3] : j > steps - 3 ? GREEN[2] : GREEN[(k + j) % 4];
      b.box(fx, fy, fz, st * 1.1, 0.08, 0.14, broken ? 0x7a6a3a : 0x3e6a20, 0, a, 0);   // la nervadura (a lo largo de la fronda)
      if (j > 0) for (const sd of [-1, 1]) {                             // hojitas a los costados, cayendo: se tocan (hoja continua)
        const w = (1 - j / steps) * 0.42 + 0.16;
        b.box(fx - sa * sd * (0.07 + w / 2), fy - 0.05 - w * 0.22, fz + ca * sd * (0.07 + w / 2), st * 1.12, 0.06, w, col, sd * 0.4, a, 0);
      }
    }
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
  // F5.19: sin la bahía del calamar (x < -41, z < -14): ahí hay agua más baja (garden.js buildSquidBay)
  const shape = new THREE.Shape(), BX = -41, BZ = -14;
  shape.moveTo(-120, -(SEA.z0 + 120)); shape.lineTo(120, -(SEA.z0 + 120)); shape.lineTo(120, -SEA.z0);
  shape.lineTo(BX, -SEA.z0); shape.lineTo(BX, -BZ); shape.lineTo(-120, -BZ);
  const P = POOL, hole = new THREE.Path();
  hole.moveTo(P.x1, -P.z1); hole.lineTo(P.x2, -P.z1); hole.lineTo(P.x2, -P.z2); hole.lineTo(P.x1, -P.z2);
  shape.holes.push(hole);
  for (const R of CONFIG.CATA.ramps) {                                // F5.28e: las bajadas a cielo abierto de las catacumbas
    const h = new THREE.Path();
    h.moveTo(R.x1, -R.z1); h.lineTo(R.x2, -R.z1); h.lineTo(R.x2, -R.z2); h.lineTo(R.x1, -R.z2);
    shape.holes.push(h);
  }
  const sand = add(new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ map: sandTex })));
  sand.rotation.x = -Math.PI / 2; sand.position.y = -0.03;
  // mar lejano (estático) + franja cerca de la orilla con olas (vértices animados, color por altura)
  // F5.19: el mar de la playa empieza en x -41 (al oeste, la bahía del calamar: agua más baja, en garden.js)
  // F5.28e (Diego: "el mar se ve muy simple: oscurecelo y dale detalle cúbico"): verde azulado apagado (plan de color:
  // ocean #365B59), Lambert (de noche se oscurece con la luz) y olas en cubos (seaVoxels) sobre la franja cercana
  const C = CONFIG.GFX.sea;
  const far = add(new THREE.Mesh(new THREE.PlaneGeometry(341, 280), new THREE.MeshLambertMaterial({ color: C.far, emissive: C.emissive })));
  far.rotation.x = -Math.PI / 2; far.position.set(BX + 170.5, SEA.y - 0.02, SEA.z0 - 40 - 140);
  const ng = new THREE.PlaneGeometry(101, 40, 40, 16);
  ng.rotateX(-Math.PI / 2);
  ng.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(ng.attributes.position.count * 3).fill(1), 3));
  const near = add(new THREE.Mesh(ng, new THREE.MeshLambertMaterial({ color: C.near, emissive: C.emissive, vertexColors: true })));
  near.position.set(BX + 50.5, SEA.y, SEA.z0 - 20);
  const foam = add(new THREE.Mesh(new THREE.PlaneGeometry(101, 1.6),
    new THREE.MeshBasicMaterial({ color: 0xa8a494, transparent: true, opacity: 0.45, depthWrite: false })));
  foam.rotation.x = -Math.PI / 2; foam.position.set(BX + 50.5, SEA.y + 0.04, SEA.z0 - 0.6);
  // olas en cubos: una grilla de bloques de C.cube m (un InstancedMesh, un draw call) que suben y bajan de a escalones
  // de C.step m; la cresta, más clara; la fila de la orilla, con espuma
  const nx = Math.floor(101 / C.cube), nz = C.rows, vox = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ emissive: C.emissive }), nx * nz);
  vox.frustumCulled = false; vox.userData.theme = true; scene.add(vox);
  const cells = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) cells.push([BX + C.cube * (i + 0.5), SEA.z0 - C.cube * (j + 0.5), j]);
  // (F5.29b: far también, para esconder todo el mar de la playa durante la tormenta del Kraken)
  THEMEFX.sea = { far, near, foam, base: Float32Array.from(ng.attributes.position.array), vox, cells, col: new THREE.Color(), m: new THREE.Matrix4(),
                  cBase: new THREE.Color(C.near), cCrest: new THREE.Color(C.crest), cFoam: new THREE.Color(C.foam) };

  const b = new MeshBuilder();
  // F5.5: cada palmera en su grupo (base, girado hacia donde se inclina) con un hijo que puede voltearse
  // (THEMEFX.palms[i], rotation.z). El tocón queda en el mesh fijo de afuera
  THEMEFX.palms = CONFIG.QUEST.palms.map(P => {
    const pb = new MeshBuilder(), fpb = new MeshBuilder();
    palm(pb, 0, 0, P.segs, P.broken, P.lean, 0, fpb);
    const m = pb.mesh(TMAT.prop), fm = fpb.mesh(FOLI.mat), outer = new THREE.Group(), tilt = new THREE.Group();
    outer.position.set(P.x, 0, P.z); outer.rotation.y = P.rot; outer.userData.theme = true;
    outer.add(tilt); tilt.add(m); if (fm) tilt.add(fm);
    scene.add(outer);
    b.cyl(P.x, 0, P.z, 0.24, 0.6, 0x5e5044, 0.85, 9);                                  // tocón
    return tilt;
  });
  // F5.17c: troncos curvos. F5.28e (Diego: "quitá los props de la playa"): sin los botes volteados (el cayuco y la lancha)
  b.tube([[-5.1, 0.12, -9.5], [-4, 0.14, -9.05], [-2.9, 0.12, -8.4]], 0.12, 0.09, 0x8a7d6a, 8, 7);   // troncos (decorativos, bajos)
  b.tube([[7.25, 0.1, -6.2], [8, 0.11, -6.5], [8.75, 0.09, -6.85]], 0.1, 0.07, 0x7d7060, 6, 6);
  [[-7, -22.6], [-3.5, -23.1], [6, -22.8], [12, -23.2], [-14, -22.9]]                   // algas en la orilla
    .forEach(p => { const a = rnd(0, 3), l = rnd(0.8, 1.6); b.tube([[p[0] - Math.cos(a) * l / 2, 0.02, p[1] + Math.sin(a) * l / 2], [p[0], 0.03, p[1] + 0.1], [p[0] + Math.cos(a) * l / 2, 0.02, p[1] - Math.sin(a) * l / 2]], 0.06, 0.03, 0x33402a, 5, 4); });
  // F1.1: laguna a los dos lados del puente C13. Agua apenas sobre la arena (no hace falta agujero);
  // fuera de todo cuarto: nadie la pisa. Va en este mismo mesh: sin draw call extra
  [[6.2, 15.8], [22.2, 35]].forEach(([x1, x2]) => {                                    // F5.8: la del este llega a x 35
    b.box((x1 + x2) / 2, 0.01, 0, x2 - x1, 0.02, 7.6, 0x3f5a52);
    b.box((x1 + x2) / 2, 0.022, 0.4, x2 - x1 - 1.4, 0.004, 5.2, 0x4d6c62);             // reflejo
  });
  [[7, 3.2], [8.2, -3.1], [15.1, 2.8], [23, -3.2], [29, 3.1], [26, -2.9]]               // juncos
    .forEach(p => { for (let k = 0; k < 5; k++) { const x = p[0] + rnd(-0.3, 0.3), z = p[1] + rnd(-0.2, 0.2), h = rnd(0.6, 1.1);
      b.seg([x, 0, z], [x + rnd(-0.15, 0.15), h, z + rnd(-0.1, 0.1)], 0.02, 0.008, 0x55603a, 4);
      if (k % 2) b.cyl(x + 0.02, h * 0.7, z, 0.035, 0.18, 0x5a3a24, 1, 6); } });   // juncos con espiga
  for (let z = -3.4; z <= 3.4; z += 2.27) [16, 22].forEach(x => b.cyl(x, -1.05, z, 0.12, 1.1, 0x5e5446, 0.9, 8));
  // (F5.12: la laguna que bajaba al mar se sacó: ahí se pasa de la playa a la jungla este)
  const fb = new MeshBuilder();
  for (const P of CONFIG.GARDEN.palms) palm(b, P.x, P.z, P.segs, false, P.lean, P.rot, fb);
  b.mesh(TMAT.prop);
  fb.mesh(FOLI.mat);
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
  // F5.28e: las olas en cubos. Altura cuantizada (escalones), color por altura; la fila de la orilla lleva espuma
  if (S.vox) {
    const C = CONFIG.GFX.sea, c = S.col, M = S.m, base = S.cBase, crest = S.cCrest, foamC = S.cFoam;
    for (let i = 0; i < S.cells.length; i++) {
      const [x, z, j] = S.cells[i];
      let h = Math.sin(x * 0.21 + t * 1.2 + z * 0.33) * 0.16 + Math.sin(x * 0.07 - t * 0.6 + z * 0.8) * 0.1 + Math.sin(z * 0.5 + t * 1.9) * 0.05;
      h = Math.round(h / C.step) * C.step;
      const k = Math.max(0, Math.min(1, (h + 0.2) / 0.45));
      c.copy(base).lerp(crest, k * k);
      if (j === 0 && h > 0) c.lerp(foamC, 0.5 + 0.5 * w);            // espuma en la orilla
      else if (h >= 0.2) c.lerp(foamC, 0.35);                        // cresta que rompe
      const sy = 0.3 + Math.max(0, h) * 0.6;
      M.makeScale(C.cube * 0.98, sy, C.cube * 0.98); M.setPosition(x, SEA.y - 0.18 + h, z);
      S.vox.setMatrixAt(i, M); S.vox.setColorAt(i, c);
    }
    S.vox.instanceMatrix.needsUpdate = true; if (S.vox.instanceColor) S.vox.instanceColor.needsUpdate = true;
  }
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
  [[-6, -4], [6, -4], [-6, 3.7], [6, 3.7]].forEach(p => { b.cyl(p[0], 0, p[1], 0.14, 0.25, GRAY, 0.8, 10); b.cyl(p[0], 0.25, p[1], 0.1, 3.5, GRAY, 0.9, 10);
    b.cyl(p[0], 3.72, p[1], 0.1, 0.18, GRAY, 1.4, 10); });   // postes (F5.17c: torneados)
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
  b.rbox(0, 0.24, 0, 2.3, 0.4, 0.9, 0x4f5244, 0.1);                   // F5.17c: cantos redondos
  b.rbox(0, 0.66, -0.36, 2.3, 0.62, 0.22, 0x6b6f58, 0.1, -0.12, 0, 0);
  for (const sx of [-1, 1]) { b.rbox(sx * 1.08, 0.42, 0.02, 0.22, 0.46, 0.92, 0x6b6f58, 0.1, 0, Math.PI / 2, 0); b.cyl(sx * 1.08, 0.62, 0.02, 0.13, 0.9, 0x6b6f58, 1, 10, Math.PI / 2, 0, 0); }
  b.rbox(-0.5, 0.5, 0.05, 0.95, 0.16, 0.74, 0x74785f, 0.07); b.rbox(0.45, 0.5, 0.05, 0.95, 0.16, 0.74, 0x6e7259, 0.07, 0, 0, -0.08);
  b.blob(0.45, 0.6, 0.1, 0.16, 0.06, 0.12, 0xd8d0b8, 2);                 // relleno salido
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(sx * 1.05, 0, sz * 0.38, 0.04, 0.06, 0x2a2018, 0.7, 6);   // patas
  b.rbox(0.9, 0.08, 0.95, 0.95, 0.14, 0.7, 0x74785f, 0.06, 0, 0.4, 0.2); // cojín en el piso
  b.setFrame(-7.8, 0, 14.9, Math.PI / 2);                              // TV rota sobre mueble, pared oeste
  b.box(0, 0.25, 0.3, 1.2, 0.5, 0.5, 0x5a4636);
  b.rbox(0.1, 0.8, 0.28, 0.9, 0.6, 0.45, DARK, 0.08, 0, 0, 0.08); b.rbox(0.1, 0.8, 0.02, 0.7, 0.46, 0.3, 0x222222, 0.1, 0, 0, 0.08);
  deco.setFrame(-7.8, 0, 14.9, Math.PI / 2);
  deco.plane(0.1, 0.8, 0.506, 0.78, 0.5, 0, 0, 0.08, ATLAS.r.tv, IT);
  deco.setFrame(null); b.setFrame(null);
  b.box(-1, 0.006, 10.5, 3.2, 0.012, 2.4, 0x7a4a3e, 0, 0.1, 0);        // alfombra manchada
  b.box(-3.2, 0.22, 9.3, 1.2, 0.05, 0.6, 0x6a5440, 0.1, 0.2, 0.35);    // mesa volcada (a un costado: sólida, no corta D1->D3)
  b.seg([-3.75, 0.02, 9.1], [-3.62, 0.4, 9.1], 0.03, 0.025, 0x5a4636, 6); b.seg([-2.7, 0.04, 9.3], [-2.7, 0.04, 9.7], 0.03, 0.025, 0x5a4636, 6);
  [[-5, 8, 0.4], [4.8, 6.5, -0.8], [-2.5, 15.5, 1.3]].forEach(p => b.box(p[0], 0.03, p[1], 1.4, 0.04, 0.18, 0x6e5a44, 0, p[2], 0));
  [[-4.3, 7.7], [5.1, 7.2], [1.6, 15.8]].forEach(p => b.lathe([[0, 0], [0.04, 0], [0.04, 0.17], [0.015, 0.22], [0.015, 0.27], [0, 0.27]], p[0], 0.04, p[1], 1, 1, 1, 0x4a6a4a, 8, Math.PI / 2, rnd(0, 3), 0));  // botellas

  //--- R3 COCINA ---
  b = props('R3');
  b.box(15.6, 0.45, 13.5, 4.4, 0.9, 0.6, 0xb8b09a);                    // gabinete bajo
  b.box(15.6, 0.05, 13.23, 4.4, 0.1, 0.04, 0x3a342c);                    // F5.17c: zócalo hundido
  [13.4, 14.4, 15.4, 16.4, 17.4].forEach(x => b.seg([x, 0.78, 13.19], [x + 0.2, 0.78, 13.19], 0.012, 0.012, 0x9a9488, 4));   // tiradores
  b.box(15.6, 0.925, 13.47, 4.5, 0.05, 0.66, 0x6d675c);                // cubierta
  b.box(14.6, 0.955, 13.5, 0.6, 0.02, 0.4, 0x3a3a3a);                  // lavatrastos
  b.tube([[14.6, 0.95, 13.72], [14.6, 1.25, 13.72], [14.6, 1.3, 13.6], [14.6, 1.2, 13.5]], 0.018, 0.015, 0xa8a8a0, 8, 5);   // canilla
  [13.9, 14.9, 15.9, 16.9].forEach(x => b.box(x, 0.45, 13.195, 0.02, 0.7, 0.01, 0x55504a));
  b.box(16.2, 0.02, 12.5, 0.5, 0.03, 0.7, 0xb0a890, 0, 0.3, 0);        // puerta caída
  b.box(13.9, 2.25, 13.62, 1.0, 0.7, 0.36, 0xa89f88);                  // alacenas
  b.box(17.2, 2.25, 13.62, 1.2, 0.7, 0.36, 0xa89f88);
  b.box(16.45, 2.25, 13.2, 0.5, 0.66, 0.02, 0x9f9680, 0, 0.9, 0);      // puerta abierta
  b.rbox(8.8, 0.36, 11.7, 1.75, 0.72, 0.72, 0xc9c4b2, 0.14, 0, Math.PI / 2, 0);   // refri volteado (de espaldas; F5.17c: cantos redondos)
  b.box(8.9, 0.79, 11.7, 0.66, 0.04, 1.6, 0xbeb8a4, 0, 0, -0.35);      // puerta entreabierta
  [[8.6, 0.73, 11.2], [9.0, 0.5, 12.3]].forEach(p => b.box(p[0], p[1], p[2], 0.2, 0.02, 0.15, 0x8a5a3a));
  b.rbox(12.2, 0.25, 12.6, 0.45, 0.45, 0.05, 0x6a5440, 0.02, 1.35, 0.4, 0);   // silla volcada
  b.rbox(12.2, 0.22, 12.9, 0.45, 0.05, 0.45, 0x6a5440, 0.02, 0, 0.4, 0);
  for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
    const c = Math.cos(0.4), sn = Math.sin(0.4), px = 12.2 + dx * c + dz * sn, pz = 12.9 - dx * sn + dz * c;
    b.seg([px, 0.22, pz], [px + sn * 0.4, 0.3, pz + c * 0.4], 0.02, 0.018, 0x5a4636, 5); }
  [[11, 11.5], [13.2, 10.8], [9.8, 6.4]].forEach(p => b.cyl(p[0], 0.04, p[1], 0.05, 0.12, 0x7c8084, 1, 10, Math.PI / 2, rnd(0, 3), 0));   // latas

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
  b.rbox(3.4, 0.4, 18.9, 0.6, 0.05, 0.45, 0x6a5440, 0.02, 0, 0.2, 0.25);  // mesita volcada
  b.lathe([[0, 0], [0.08, 0], [0.13, 0.2], [0.14, 0.24], [0.12, 0.24]], 3.1, 0, 19.5, 1, 1, 1, 0x8a5a3a, 10);   // maceta
  b.box(3.1, 0.2, 19.5, 0.16, 0.03, 0.16, 0x3a2a1a);                                                        // tierra
  for (let k = 0; k < 4; k++) b.tube([[3.1, 0.22, 19.5], [3.1 + Math.cos(k * 1.6) * 0.1, 0.4, 19.5 + Math.sin(k * 1.6) * 0.1], [3.1 + Math.cos(k * 1.6) * 0.25, 0.3, 19.5 + Math.sin(k * 1.6) * 0.25]], 0.012, 0.005, 0x6a5a3a, 5, 4);   // planta seca

  //--- R5 DORMITORIO ---
  b = props('R5');
  b.box(5.3, 0.2, 19.3, 2.0, 0.3, 2.2, 0x5a4636, 0, 0, 0.04);          // cama
  b.box(5.3, 0.7, 18.28, 2.1, 1.1, 0.1, 0x5a4636);
  b.rbox(5.3, 0.45, 19.35, 1.85, 0.2, 2.05, 0xb5ab8f, 0.08, 0.03, 0.06, 0);   // colchón (F5.17c: redondo)
  for (const dx of [-1, 1]) b.cyl(5.3 + dx * 1.05, 0, 18.28, 0.06, 1.35, 0x4a3a2c, 1, 8); 
  [[5.0, 19.8, 0.5, 0.6], [5.7, 19.1, 0.35, 0.3]].forEach(s => b.box(s[0], 0.555, s[1], s[2], 0.01, s[3], 0x7d6f55));
  b.blob(5.0, 0.6, 18.65, 0.3, 0.08, 0.17, 0xcfc6ae, 4);                  // almohada
  b.box(6.35, 0.3, 19.6, 0.05, 0.45, 1.2, 0xc8c0aa, 0, 0, 0.15);       // sábana colgando
  b.box(6.75, 0.3, 18.55, 0.5, 0.6, 0.45, 0x6a5440);                   // mesa de noche
  b.lathe([[0.06, 0], [0.12, 0.18], [0.1, 0.2], [0.04, 0.02]], 6.75, 0.62, 18.55, 1, 1, 1, 0xd8c8a0, 10, 0, 0, 1.2);   // lámpara caída (pantalla)
  b.seg([6.65, 0.62, 18.55], [6.9, 0.66, 18.55], 0.015, 0.015, 0x9a9080, 5);
  b.box(15.5, 1.1, 27.0, 0.6, 2.2, 1.5, 0x6a5440);                     // ropero
  b.box(15.05, 1.1, 26.05, 0.04, 2.0, 0.7, 0x5e4a38, 0, 0.9, 0);       // puerta abierta
  b.box(15.2, 1.3, 27.2, 0.3, 0.6, 0.3, 0x7a8a9a); b.box(15.2, 1.2, 26.7, 0.3, 0.5, 0.25, 0x9a6a5a);  // ropa
  [[9.5, 22.5, 0x7a8a9a], [11.6, 20.4, 0x9a6a5a], [7.4, 26.8, 0xb8ae96]]
    .forEach(p => b.box(p[0], 0.02, p[1], 0.7, 0.03, 0.5, p[2], 0, rnd(0, 3), 0));

  //--- R6 GARAJE ---
  b = props('R6');
  b.sphere(-13.2, 1.1, 29.55, 0.27, 1.15, 0.04, 0xd8c890, 12, 0.15, 0, 0);   // tabla de surf apoyada (F5.17c: ovalada)
  b.sphere(-13.2, 1.1, 29.52, 0.06, 1.05, 0.02, 0x5f8fa0, 8, 0.15, 0, 0);
  b.box(-12, 0.04, 28.2, 0.5, 0.06, 1.1, 0xd8c890, 0, 0.5, 0);         // la otra, partida
  b.setFrame(-6.6, 0, 28.9, 0);                                        // camioneta a medias (sin palangana)
  b.box(0, 0.55, 0, 3.6, 0.25, 1.7, 0x3a3a38);
  b.box(1.1, 0.95, 0, 1.3, 0.55, 1.6, 0x5f7f7a);
  b.box(0.2, 1.6, 0, 1.3, 0.05, 1.5, 0x5f7f7a, 0, 0, -1.0);            // capó abierto
  b.box(-0.35, 1.25, 0, 1.3, 1.1, 1.65, 0x5f7f7a);
  b.box(0.32, 1.45, 0, 0.05, 0.55, 1.4, 0x2b3336, 0, 0, -0.3);
  b.box(1.0, 1.15, 0, 0.9, 0.1, 1.2, 0x2e2e2c);                        // motor
  [[-1.4, 0.6], [-1.4, -0.6]].forEach(p => b.box(-1.5, 0.5, p[1], 1.2, 0.12, 0.12, 0x2e2e2c));  // largueros
  [[1.1, 0.8], [1.1, -0.8]].forEach(p => { b.ring(p[0], 0.35, p[1], 0.26, 0.1, 0x1e1e1e, Math.PI / 2, 0, 0); b.cyl(p[0], 0.35, p[1] - 0.08, 0.17, 0.16, 0x8a8985, 1, 10, Math.PI / 2, 0, 0); });   // ruedas
  [[-1.4, 0.6], [-1.4, -0.6]].forEach(p => b.box(p[0], 0.2, p[1], 0.4, 0.4, 0.3, 0x8a8985));   // bloques
  [[0.6, 1.4, 0.83], [-0.9, 0.9, -0.83], [1.5, 1.05, 0.81]].forEach(p => b.box(p[0], p[1], p[2], 0.35, 0.25, 0.02, 0x8a5a3a));
  b.setFrame(null);
  b.ring(-4.7, 0.36, 26.9, 0.25, 0.1, 0x1e1e1e, 0, 0, Math.PI / 2 - 0.2); // rueda suelta
  b.box(-15.45, 0.9, 26.8, 0.7, 0.08, 1.6, 0x6a5440);                  // banco de trabajo
  [[26.1], [27.5]].forEach(z => b.box(-15.45, 0.45, z[0], 0.6, 0.9, 0.06, 0x5a4636));
  b.rbox(-15.3, 0.25, 25.9, 0.2, 0.4, 0.3, 0x8a3a2e, 0.05, 0, Math.PI / 2, 0); b.cyl(-15.3, 0.45, 25.85, 0.04, 0.06, 0x2a2a2a, 1, 8);   // bidón
  b.box(-15.4, 0.97, 27.1, 0.4, 0.06, 0.1, 0x7c8084, 0, 0.4, 0);
  [0.11, 0.33, 0.55].forEach((y, i) => b.ring(-7.5 + i * 0.03, y, 18.95, 0.26, 0.1, 0x1e1e1e, 0, i * 0.3, 0));  // llantas (F5.20: fuera de entre las ventanas)

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
  [[-13.1, 0.32], [-12.7, 0.32], [-12, 0.92], [-12.9, 1.52]].forEach(p => { b.lathe([[0, 0], [0.07, 0], [0.07, 0.16], [0.05, 0.19], [0, 0.19]], p[0], p[1], 39.5, 1, 1, 1, 0x7a8a6a, 8); b.cyl(p[0], p[1] + 0.19, 39.5, 0.05, 0.03, 0x8a6a3a, 1, 8); });
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
  [24.6, 25.4].forEach(x => b.tube([[x, -1.6, PL.z2 - 0.12], [x, 0.2, PL.z2 - 0.12], [x, 0.7, PL.z2 + 0.05], [x, 0.3, PL.z2 + 0.35], [x, 0, PL.z2 + 0.35]], 0.025, 0.025, 0xb8b8b0, 12, 6));   // norte (F5.17c: pasamanos curvos)
  for (let y = -1.3; y < 0; y += 0.4) b.box(25, y, PL.z2 - 0.12, 0.8, 0.04, 0.05, 0xb8b8b0);
  [PL.x1 + 0.12, PL.x2 - 0.12].forEach(x => {                                          // oeste y este
    const o = x < 25 ? -1 : 1;
    [13.1, 13.9].forEach(z => b.tube([[x, -1.6, z], [x, 0.2, z], [x + o * 0.17, 0.7, z], [x + o * 0.47, 0.3, z], [x + o * 0.47, 0, z]], 0.025, 0.025, 0xb8b8b0, 12, 6));
    for (let y = -1.3; y < 0; y += 0.4) b.box(x, y, 13.5, 0.05, 0.04, 0.8, 0xb8b8b0);
  });
  [[23, 14], [26.5, 12.8], [24.2, 16.2], [27.2, 15.6]]                                  // lama en el fondo
    .forEach(p => b.box(p[0], -PL.depth + 0.01, p[1], rnd(0.6, 1.4), 0.02, rnd(0.5, 1.2), 0x3e5a2e, 0, rnd(0, 3), 0));
  b.box(34.1, 0.3, 5.3, 1.1, 0.12, 1.7, 0xd8d2c4);                                      // reposera (F2.6: +1.1 en x; F5.8: +4)
  b.box(34.1, 0.62, 6.0, 1.1, 0.7, 0.1, 0xd8d2c4, -0.9, 0, 0);
  [[33.65, 4.55], [34.55, 4.55], [33.65, 6.05], [34.55, 6.05]].forEach(p => b.box(p[0], 0.13, p[1], 0.05, 0.26, 0.05, 0xb0aa9c));
  b.rbox(34.35, 0.45, 17.1, 1.2, 0.9, 0.8, 0x9a5a3e, 0.08, 0, Math.PI / 2, 0);            // macetero con palma muerta (F5.8: +4 en x)
  b.box(34.35, 0.91, 17.1, 0.7, 0.04, 1.1, 0x4a3a2c);
  b.tube([[34.35, 0.9, 17.1], [34.4, 1.5, 17.0], [34.3, 2.1, 17.2]], 0.07, 0.05, 0x6a5a44, 6, 6);
  for (let k = 0; k < 5; k++) { const a = k * 1.25; b.tube([[34.3, 2.1, 17.2], [34.3 + Math.cos(a) * 0.4, 2.2, 17.2 + Math.sin(a) * 0.4], [34.3 + Math.cos(a) * 0.8, 1.6, 17.2 + Math.sin(a) * 0.8]], 0.04, 0.01, 0x7a6a44, 6, 4); }
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
  b.ring(0, 1.9, 0.1, 0.34, 0.1, 0xc8502e, Math.PI / 2, 0, 0);            // F5.17c: aro de verdad
  [0, 1.57, 3.14, 4.71].forEach(a => b.rbox(Math.cos(a) * 0.34, 1.9 + Math.sin(a) * 0.34, 0.1, 0.1, 0.22, 0.22, 0xe8e2d6, 0.09, 0, 0, a));
  b.setFrame(null);
  onWall(b, 'x', 16.2, 1, 26.5);                                                         // redes colgadas
  for (let k = 0; k < 5; k++) b.box(0, 2.2 - k * 0.25, 0.04, 1.6 - k * 0.1, 0.02, 0.02, 0x8a7a5a, 0, 0, rnd(-0.1, 0.1));
  for (let k = 0; k < 6; k++) b.box(-0.7 + k * 0.28, 1.7, 0.04, 0.02, 1.1, 0.02, 0x8a7a5a);
  b.setFrame(null);

  //--- R10 PLAYA: arena que entra por la reja; R11 MUELLE en T (F1.1): pilotes, faroles, bote ---
  [[0.4, -5.2, 2.2, 1.6, 0.2], [-6, -10, 3, 2, 0.8], [9, -15, 2.6, 1.8, -0.4]]
    .forEach(s => floorDeco('sand', s[0], s[1], s[2], s[3], s[4]));
  b = props('R11');
  // F5.17c: pilotes redondos con percebes que asoman 1 m como postes, soga que cuelga entre ellos, faroles de hierro
  // con brazo curvo y bote de casco torneado
  const pr = mulberry(311), posts = [];
  const pile = (x, z, post) => {
    b.cyl(x, -2.2, z, 0.15, post ? 3.2 : 2.3, [0x5e5446, 0x54493c, 0x665a4a][(pr() * 3) | 0], 0.92, 8, pr() * 0.04, pr() * 3, pr() * 0.04);
    b.cyl(x, -0.55, z, 0.19, 0.3, 0x8a8a78, 0.9, 8);                                          // percebes en la línea del agua
    b.cyl(x, -0.3, z, 0.17, 0.12, 0x4a6a3a, 1, 8);                                             // algas
    if (post) { b.sphere(x, 1.0, z, 0.15, 0.06, 0.15, 0x4a4034, 8); posts.push([x, z]); }
  };
  const rope = (a, c) => {
    const pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push([a[0] + (c[0] - a[0]) * t, 0.85 - Math.sin(Math.PI * t) * 0.22, a[1] + (c[1] - a[1]) * t]); }
    b.tube(pts, 0.035, 0.035, 0xb8a47a, 8, 4);
  };
  // F5.6: tronco hasta z -44, plataforma z -50..-44 (F5.16: sin segundo tronco)
  for (const x of [-2.15, 2.15]) { let prev = null; for (let z = -25; z >= -44; z -= 3) { pile(x, z, true); if (prev) rope([x, prev], [x, z]); prev = z; } }
  for (const x of [-4.15, 4.15]) { let prev = null; for (let z = -44.15; z >= -50; z -= 2.9) { pile(x, z, true); if (prev) rope([x, prev], [x, z]); prev = z; } }
  [-3, 0, 3].forEach(x => pile(x, -50.15, true));
  rope([-4.15, -50.15], [-3, -50.15]); rope([-3, -50.15], [0, -50.15]); rope([0, -50.15], [3, -50.15]); rope([3, -50.15], [4.15, -50.15]);
  for (const s of [-1, 1]) { pile(s * 3.1, -43.85, true); rope([s * 2.15, -44], [s * 3.1, -43.85]); rope([s * 3.1, -43.85], [s * 4.15, -44.15]); }
  // tablones sueltos y rollo de soga en la plataforma
  for (let k = 0; k < 3; k++) b.box(-3.2 + k * 0.1, 0.03 + k * 0.05, -45.2 + k * 0.3, 0.25, 0.05, 1.8, 0x6a5a44, 0, 0.2 + k * 0.3, 0);
  { const pts = []; for (let k = 0; k <= 36; k++) { const a = k * 0.55, r = 0.35 - k * 0.006; pts.push([3.3 + Math.cos(a) * r, 0.05 + k * 0.004, -48.8 + Math.sin(a) * r]); } b.tube(pts, 0.04, 0.04, 0xb8a47a, 60, 4); }
  [[-1.85, -31], [3.85, -44.3], [-3.85, -44.3], [1.85, -38]].forEach(([x, z]) => {             // faroles
    const s = x < 0 ? 1 : -1;
    b.cyl(x, 0, z, 0.12, 0.3, 0x2e2e2c, 0.6, 8);
    b.cyl(x, 0.3, z, 0.05, 2.5, 0x2e2e2c, 0.8, 6);
    b.tube([[x, 2.7, z], [x, 3.05, z], [x + s * 0.2, 3.15, z], [x + s * 0.42, 3.0, z]], 0.035, 0.03, 0x2e2e2c, 8, 5);
    const lx = x + s * 0.42;
    b.cyl(lx, 2.56, z, 0.13, 0.05, 0x2e2e2c, 1, 8); b.cyl(lx, 2.9, z, 0.15, 0.12, 0x2e2e2c, 0.2, 8);
    for (let k = 0; k < 4; k++) b.box(lx + Math.cos(k * 1.57 + 0.78) * 0.11, 2.74, z + Math.sin(k * 1.57 + 0.78) * 0.11, 0.025, 0.32, 0.025, 0x2e2e2c);
    glow.sphere(lx, 2.74, z, 0.09, 0.14, 0.09, 0xffd38a, 8);
  });
  // bote al costado este de la plataforma: casco torneado, bancos, remos
  { const hull = [[0, -1.65], [0.32, -1.35], [0.55, -0.8], [0.66, 0], [0.62, 0.8], [0.45, 1.35], [0, 1.7]];
    b.lathe(hull, 5.3, -0.25, -46, 1.05, 1, 0.55, 0x5f7f7a, 14, Math.PI / 2, 0.12, 0);
    b.lathe(hull, 5.3, -0.22, -46, 0.9, 0.92, 0.1, 0x4a3a2c, 14, Math.PI / 2, 0.12, 0);
    for (const d of [-0.6, 0.5]) b.box(5.3 + Math.sin(0.12) * d, 0.02, -46 + Math.cos(0.12) * d, 1.1, 0.05, 0.25, 0x6a5440, 0, 0.12, 0);
    b.seg([4.9, 0.08, -46.8], [5.6, 0.12, -44.9], 0.03, 0.03, 0x8a6a48, 5); b.box(5.62, 0.12, -44.8, 0.14, 0.02, 0.4, 0x8a6a48, 0, 0.3, 0);
    b.tube([[4.5, 0.1, -45.3], [4.0, 0.0, -45.1], [3.7, 0.25, -44.9]], 0.025, 0.025, 0x9a8c70, 6, 4);   // cuerda a la bita
    b.cyl(3.7, 0, -44.9, 0.13, 0.3, 0x3a3a38, 0.8, 8); b.sphere(3.7, 0.3, -44.9, 0.15, 0.06, 0.15, 0x3a3a38, 8); }

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
    // F2: con power, más fuertes. F5.20: sin power, apagadas salvo que el farol del cuarto esté prendido (L.litT)
    L.on = state.power || (L.litT || 0) > 0;
    // F5.28f (Diego: "que las lámparas alumbren como lámparas y no el cuarto siguiente"): con el farol (sin energía) la luz
    // llega solo a HOUSE.lanternDist m (no atraviesa las paredes: sin sombras, una luz de 14 m pintaba el cuarto de al
    // lado) y es más fuerte cerca. Cambiar distance/intensity no recompila shaders
    const lantern = !state.power && L.on, H = CONFIG.HOUSE;
    L.light.distance = lantern ? H.lanternDist : 14;
    L.light.intensity = L.on ? T.lampIntensity * L.k * (state.power ? CONFIG.POWER.lampMul : H.lanternMul) : 0;
  }
  if (!THEMEFX.built) return;
  WORLD.lamps.forEach((L, i) => THEMEFX.bulbs.setColorAt(i, _bulbC.setHex(0xfff0c0).multiplyScalar(L.on ? 0.25 + 0.75 * Math.min(1, L.k) : 0.06)));
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

