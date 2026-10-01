//=== 8d. MAPA (V2 F5.24) ================================================================
// Tecla 5 (CONFIG.MAPVIEW.key). F5.24b (Diego: "digno de la cancha, que dé miedo"): un mapa de campo viejo, en papel
// amarillento con pliegues, manchas de café y de sangre, una mano ensangrentada, rosa de los vientos, escala y el
// título. Los pisos son tintas claras que se multiplican con el papel, las paredes van con trazo de tinta, la espesura
// rayada y el mar con olitas. Lo que no caminaste es papel QUEMADO: negro carbón con brasas que titilan en el borde (la
// niebla de guerra se destapa en un radio `reveal` alrededor tuyo). Encima: los nombres escritos a mano, notas en rojo
// ("IT FEEDS HERE"), la caja, el PaP y los perks dibujados en tinta, los zombies cercanos como manchas rojas que laten, y
// vos, un alfiler rojo con un halo de vela. Abajo, lo que llevás (etiquetas de papel con íconos de tinta; lo que falta,
// tachado). En el búnker no hay señal: pantalla con estática y "NO SIGNAL" que falla.
// El dibujo base, el papel, la sangre y el marco se arman una vez (la primera vez que se abre). El juego sigue con el
// mapa abierto. resetGame lo vuelve a tapar
const MAPV = { on: false, base: null, paper: null, stains: null, frame: null, fog: null, fogCtx: null, fogImg: null,
               char: null, ember: null, seen: null, t: 0, drawT: 0, lx: 1e9, lz: 1e9, bb: null, labels: null,
               el: null, cv: null, items: null, dirty: true, nosig: false, noise: null, itemsKey: '' };
const MAP_HAND = "'Segoe Print','Ink Free','Bradley Hand','Comic Sans MS',cursive";
const MAP_SERIF = "'Palatino Linotype','Book Antiqua',Georgia,serif";

// bajo tierra (el búnker, a −8): sin señal. No se usa inBunker(): la parte honda de la pileta (−1.6) también le da true
function mapUnderground() { return groundY(player.pos.x, player.pos.z) < -4; }
function mapviewEls() {
  if (MAPV.el) return true;
  if (typeof document === 'undefined') return false;
  MAPV.el = document.getElementById('mapview');
  MAPV.cv = document.getElementById('mapCanvas');
  MAPV.items = document.getElementById('mapItems');
  return !!MAPV.el;
}
function mapCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext && c.getContext('2d');
  return g ? [c, g] : [null, null];
}
// lo caminado: un byte por celda del grid del piso (NAV)
function mapSeenInit() {
  if (!MAPV.seen || MAPV.seen.length !== NAV.w * NAV.h) MAPV.seen = new Uint8Array(NAV.w * NAV.h);
}
// destapa un círculo de `reveal` m alrededor de (x, z). Devuelve cuántas celdas nuevas
function mapReveal(x, z) {
  mapSeenInit();
  const R = CONFIG.MAPVIEW.reveal, cx = Math.floor(x) - NAV.minX, cz = Math.floor(z) - NAV.minZ;
  let n = 0;
  for (let j = -R; j <= R; j++) {
    const iz = cz + j;
    if (iz < 0 || iz >= NAV.h) continue;
    const w = Math.floor(Math.sqrt(R * R - j * j));
    for (let i = -w; i <= w; i++) {
      const ix = cx + i;
      if (ix < 0 || ix >= NAV.w) continue;
      const k = iz * NAV.w + ix;
      if (!MAPV.seen[k]) { MAPV.seen[k] = 1; n++; if (MAPV.fogImg) MAPV.fogImg.data[k * 4 + 3] = 0; }
    }
  }
  if (n) {
    MAPV.dirty = true;
    const B = MAPV.bb || (MAPV.bb = [cx, cx, cz, cz]);                  // lo explorado (para encuadrar la vista)
    B[0] = Math.min(B[0], cx - R); B[1] = Math.max(B[1], cx + R); B[2] = Math.min(B[2], cz - R); B[3] = Math.max(B[3], cz + R);
  }
  return n;
}
function mapSeenAt(x, z) {
  if (!MAPV.seen) return false;
  const ix = Math.floor(x) - NAV.minX, iz = Math.floor(z) - NAV.minZ;
  return ix >= 0 && iz >= 0 && ix < NAV.w && iz < NAV.h && !!MAPV.seen[iz * NAV.w + ix];
}

// ---- el terreno en tinta, una vez, a px píxeles por metro (la fila 0 es el norte) ----
function buildMapBase() {
  const C = CONFIG.MAPVIEW, px = C.px, W = NAV.w * px, H = NAV.h * px;
  const [cv, g] = mapCanvas(W, H);
  if (!g) return null;
  const kind = new Uint8Array(NAV.w * NAV.h);                           // 1 caminable, 2 arriba, 3 bloqueado, 4 espesura, 5 mar
  for (let iz = 0; iz < NAV.h; iz++) for (let ix = 0; ix < NAV.w; ix++) {
    const X = ix + NAV.minX, Z = iz + NAV.minZ, x = X + 0.5, z = Z + 0.5, r = roomAt(x, z), k = iz * NAV.w + ix;
    const sx = ix * px, sy = (NAV.h - 1 - iz) * px;
    let col;
    // F5.28e: las catacumbas y la cueva (r.cata) no van al mapa: abajo no hay señal y el laberinto es para perderse
    // (F5.29: la arena del Kraken, r.hideMap, tampoco: es mar)
    if (r && (r.cata || r.hideMap)) { kind[k] = r.hideMap ? 5 : inThicket(x, z) ? 4 : 3; col = kind[k] === 4 ? C.thicket : kind[k] === 5 ? C.sea : C.blocked; }
    else if (isNav(X, Z)) { kind[k] = 1; col = r ? (C.floors[r.floor] || C.floorDefault) : C.floorDefault; }
    else if (r) { kind[k] = 3; col = C.blocked; }
    else if (inThicket(x, z)) { kind[k] = 4; col = C.thicket; }
    else if (isWaterAt(x, z)) { kind[k] = 5; col = C.sea; }
    else { kind[k] = 3; col = C.blocked; }
    if (kind[k] !== 1 && isUp(X, Z)) kind[k] = 2;
    g.fillStyle = col; g.fillRect(sx, sy, px, px);
    if (kind[k] === 4) {                                                  // espesura: rayado en diagonal
      g.strokeStyle = C.thicketInk; g.lineWidth = 1;
      g.beginPath(); g.moveTo(sx, sy + px); g.lineTo(sx + px, sy); g.stroke();
    } else if (kind[k] === 5 && (ix * 3 + iz * 7) % 23 === 0) {           // mar: olitas sueltas
      g.strokeStyle = C.seaInk; g.lineWidth = 1;
      g.beginPath(); g.arc(sx, sy + px, px * 0.8, -Math.PI * 0.9, -Math.PI * 0.1); g.arc(sx + px * 1.6, sy + px, px * 0.8, -Math.PI * 0.9, -Math.PI * 0.1); g.stroke();
    }
    if (kind[k] === 2 || (kind[k] === 1 && isUp(X, Z))) {                 // lo que se camina arriba: rayado cruzado
      g.strokeStyle = C.upper; g.lineWidth = 1;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + px, sy + px); g.moveTo(sx, sy + px); g.lineTo(sx + px, sy); g.stroke();
    }
  }
  // paredes: trazo de tinta en cada borde entre lo caminable y lo que no
  g.strokeStyle = C.ink; g.lineWidth = Math.max(1.5, px * 0.45); g.lineCap = 'round';
  g.beginPath();
  for (let iz = 0; iz < NAV.h; iz++) for (let ix = 0; ix < NAV.w; ix++) {
    if (kind[iz * NAV.w + ix] !== 1) continue;
    const sx = ix * px, sy = (NAV.h - 1 - iz) * px, at = (i, j) => i < 0 || j < 0 || i >= NAV.w || j >= NAV.h ? 0 : kind[j * NAV.w + i];
    if (at(ix, iz + 1) !== 1) { g.moveTo(sx, sy); g.lineTo(sx + px, sy); }                 // norte (arriba)
    if (at(ix, iz - 1) !== 1) { g.moveTo(sx, sy + px); g.lineTo(sx + px, sy + px); }       // sur
    if (at(ix - 1, iz) !== 1) { g.moveTo(sx, sy); g.lineTo(sx, sy + px); }
    if (at(ix + 1, iz) !== 1) { g.moveTo(sx + px, sy); g.lineTo(sx + px, sy + px); }
  }
  g.stroke();
  // los nombres (en inglés, CONFIG.MAPVIEW.names): uno por cuarto, en el centro de su rectángulo más grande. Se
  // escriben al dibujar (a la resolución de la vista)
  const big = {};
  for (const r of ROOMS) {
    if (!C.names[r.id]) continue;
    const a = (r.x2 - r.x1) * (r.z2 - r.z1);
    if (!big[r.id] || a > big[r.id].a) big[r.id] = { r, a };
  }
  MAPV.labels = Object.keys(big).map(k => {
    const r = big[k].r;
    return { id: k, name: C.names[k], note: C.notes[k], x: (r.x1 + r.x2) / 2, z: (r.z1 + r.z2) / 2, rot: (pbHash(r.x1, r.z1, 3) - 0.5) * 0.18 };
  });
  return cv;
}
// ---- el papel (una vez, del tamaño de la vista): amarillento, fibras, pliegues, manchas de café y bordes gastados ----
function buildMapPaper(S) {
  const [cv, g] = mapCanvas(S, S);
  if (!g) return null;
  const rr = mulberry(1987);
  const bg = g.createRadialGradient(S * 0.45, S * 0.42, S * 0.1, S / 2, S / 2, S * 0.75);
  bg.addColorStop(0, '#e6d3a4'); bg.addColorStop(0.6, '#d2b882'); bg.addColorStop(1, '#8a6a3a');
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) {                                       // grano y fibras
    g.fillStyle = `rgba(${rr() < 0.5 ? '90,60,30' : '255,245,220'},${0.03 + rr() * 0.06})`;
    const w = 1 + rr() * 3; g.fillRect(rr() * S, rr() * S, w, rr() < 0.8 ? 1 : w);
  }
  for (let i = 0; i < 7; i++) {                                         // manchas de agua / café (anillos)
    const x = rr() * S, y = rr() * S, r = 30 + rr() * 90;
    g.strokeStyle = `rgba(110,70,30,${0.12 + rr() * 0.12})`; g.lineWidth = 2 + rr() * 5;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    const f = g.createRadialGradient(x, y, 0, x, y, r); f.addColorStop(0, 'rgba(120,80,30,0.10)'); f.addColorStop(1, 'rgba(120,80,30,0)');
    g.fillStyle = f; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  for (const [x0, y0, x1, y1] of [[S / 3, 0, S / 3 + 8, S], [0, S * 0.52, S, S * 0.5], [S * 0.7, 0, S * 0.68, S]]) {   // pliegues
    g.strokeStyle = 'rgba(80,50,20,.22)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.strokeStyle = 'rgba(255,245,215,.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 + 3, y0); g.lineTo(x1 + 3, y1); g.stroke();
  }
  return cv;
}
// ---- la sangre (encima del terreno, con multiply): salpicaduras, chorreadas y una mano ----
function buildMapStains(S) {
  const [cv, g] = mapCanvas(S, S);
  if (!g) return null;
  const rr = mulberry(666);
  const splat = (x, y, r, a) => {
    g.fillStyle = `rgba(${110 + Math.floor(rr() * 50)},${8 + Math.floor(rr() * 10)},${6},${a})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 14; k++) {                                      // gotas alrededor
      const an = rr() * Math.PI * 2, d = r * (1.1 + rr() * 1.8);
      g.beginPath(); g.arc(x + Math.cos(an) * d, y + Math.sin(an) * d, 1 + rr() * r * 0.18, 0, Math.PI * 2); g.fill();
    }
  };
  for (let i = 0; i < 6; i++) splat(rr() * S, rr() * S, 8 + rr() * 26, 0.55 + rr() * 0.3);
  for (let i = 0; i < 5; i++) {                                         // chorreadas desde arriba
    const x = rr() * S, L = 40 + rr() * 140, w = 3 + rr() * 5;
    g.fillStyle = 'rgba(120,10,8,.6)'; g.fillRect(x - w / 2, 0, w, L);
    g.beginPath(); g.arc(x, L, w * 0.9, 0, Math.PI * 2); g.fill();
  }
  // una mano ensangrentada en la esquina de abajo a la derecha (palma + 5 dedos, apoyada de costado)
  g.save(); g.translate(S * 0.84, S * 0.8); g.rotate(-0.5); g.fillStyle = 'rgba(125,12,10,.62)';
  g.beginPath(); g.ellipse(0, 0, 34, 40, 0, 0, Math.PI * 2); g.fill();
  for (const [dx, len, w] of [[-26, 46, 9], [-10, 62, 10], [6, 66, 10], [21, 56, 9]]) {
    g.beginPath(); g.ellipse(dx, -34 - len / 2, w, len / 2, dx * 0.004, 0, Math.PI * 2); g.fill();
  }
  g.beginPath(); g.ellipse(-44, 6, 9, 26, -0.9, 0, Math.PI * 2); g.fill();
  g.restore();
  return cv;
}
// ---- el marco: bordes quemados y rotos, título, rosa de los vientos y escala (arriba de todo) ----
function buildMapFrame(S) {
  const [cv, g] = mapCanvas(S, S);
  if (!g) return null;
  const rr = mulberry(31);
  // borde quemado: una franja irregular de carbón con un filo marrón
  g.fillStyle = CONFIG.MAPVIEW.char;
  g.beginPath(); g.rect(0, 0, S, S);
  const pts = [], N = 120;
  for (let i = 0; i < N; i++) {
    const t = i / N, side = Math.floor(t * 4), u = (t * 4) % 1, m = 10 + rr() * 22 + (rr() < 0.08 ? 30 : 0);
    pts.push(side === 0 ? [u * S, m] : side === 1 ? [S - m, u * S] : side === 2 ? [S - u * S, S - m] : [m, S - u * S]);
  }
  g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.closePath();
  g.fill('evenodd');
  g.strokeStyle = 'rgba(120,60,20,.9)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.closePath(); g.stroke();
  // título en un cartucho
  // (encima del papel quemado: el título y la rosa van en un parche de papel propio)
  const patch = (x, y, w, h, rot) => {
    g.save(); g.translate(x, y); g.rotate(rot);
    const pg = g.createLinearGradient(0, -h / 2, 0, h / 2); pg.addColorStop(0, '#dcc89a'); pg.addColorStop(1, '#bfa16a');
    g.fillStyle = pg; g.beginPath();
    for (let i = 0; i <= 20; i++) { const u = i / 20; g.lineTo(-w / 2 + u * w, -h / 2 + (rr() - 0.5) * 5); }
    for (let i = 0; i <= 20; i++) { const u = i / 20; g.lineTo(w / 2 - u * w, h / 2 + (rr() - 0.5) * 5); }
    g.closePath(); g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 12; g.fill(); g.shadowBlur = 0;
    g.restore();
  };
  patch(S * 0.06 + 157, S * 0.075, 360, 84, -0.012);
  patch(S * 0.88, S * 0.13 - 6, 118, 132, 0.03);
  g.save(); g.translate(S * 0.06, S * 0.075);
  g.fillStyle = 'rgba(40,24,10,.12)'; g.fillRect(-8, -30, 330, 64);
  g.strokeStyle = 'rgba(40,24,10,.75)'; g.lineWidth = 2; g.strokeRect(-8, -30, 330, 64); g.strokeRect(-4, -26, 322, 56);
  g.fillStyle = '#2a170a'; g.font = 'bold 24px ' + MAP_SERIF; g.textBaseline = 'middle'; g.fillText('MARENA ISLAND', 8, -8);
  g.font = 'italic 14px ' + MAP_SERIF; g.fillText('field survey — sector 34B — do not distribute', 8, 16);
  g.restore();
  // rosa de los vientos
  g.save(); g.translate(S * 0.88, S * 0.13); g.strokeStyle = '#2a170a'; g.fillStyle = '#2a170a'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(0, 0, 38, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 4; i++) {
    g.rotate(Math.PI / 2);
    g.beginPath(); g.moveTo(0, -48); g.lineTo(7, 0); g.lineTo(-7, 0); g.closePath(); i === 3 ? g.fill() : g.stroke();
  }
  g.rotate(Math.PI / 4); for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -28); g.lineTo(4, 0); g.lineTo(-4, 0); g.closePath(); g.stroke(); }
  g.restore();
  g.fillStyle = '#7a0c08'; g.font = 'bold 20px ' + MAP_SERIF; g.textAlign = 'center'; g.fillText('N', S * 0.88, S * 0.13 - 54);
  return cv;
}
// ---- la niebla de guerra: 1 píxel por metro. De ahí salen el carbón (sin transparencia) y las brasas ----
function buildMapFog() {
  const [cv, g] = mapCanvas(NAV.w, NAV.h);
  if (!g) return;
  const img = g.createImageData(NAV.w, NAV.h);
  mapSeenInit();
  for (let k = 0; k < NAV.w * NAV.h; k++) img.data[k * 4 + 3] = MAPV.seen[k] ? 0 : 255;
  MAPV.fog = cv; MAPV.fogCtx = g; MAPV.fogImg = img;
  [MAPV.char] = mapCanvas(NAV.w, NAV.h); [MAPV.ember] = mapCanvas(NAV.w, NAV.h);
}
// el ImageData guarda z hacia abajo: se da vuelta al pintarlo; después se tiñen las dos copias (carbón y brasa)
function mapFogFlush() {
  if (!MAPV.fogCtx || !MAPV.dirty) return;
  const W = NAV.w, H = NAV.h, src = MAPV.fogImg.data, out = MAPV.fogCtx.createImageData(W, H);
  for (let iz = 0; iz < H; iz++) {
    const a = iz * W * 4, b = (H - 1 - iz) * W * 4;
    for (let i = 0; i < W * 4; i++) out.data[b + i] = src[a + i];
  }
  MAPV.fogCtx.putImageData(out, 0, 0);
  for (const [c, col] of [[MAPV.char, CONFIG.MAPVIEW.char], [MAPV.ember, CONFIG.MAPVIEW.ember]]) {
    const g = c && c.getContext('2d');
    if (!g) continue;
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
    g.fillStyle = col; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(MAPV.fog, 0, 0);
    g.globalCompositeOperation = 'source-over';
  }
  MAPV.dirty = false;
}

function toggleMap(on) {
  if (!mapviewEls()) return;
  MAPV.on = on === undefined ? !MAPV.on : on;
  MAPV.el.style.display = MAPV.on ? 'flex' : 'none';
  if (MAPV.on) {
    const S = CONFIG.MAPVIEW.size;
    if (!MAPV.base) MAPV.base = buildMapBase();
    if (!MAPV.paper) { MAPV.paper = buildMapPaper(S); MAPV.stains = buildMapStains(S); MAPV.frame = buildMapFrame(S); }
    if (!MAPV.fog) buildMapFog();
    MAPV.nosig = mapUnderground();                                      // en el búnker: sin señal
    if (MAPV.el.classList) MAPV.el.classList.toggle('nosig', MAPV.nosig);
    MAPV.dirty = true; MAPV.drawT = 0; MAPV.itemsKey = '';
    drawMap(); renderMapItems();
  }
}
// el encuadre: lo explorado con margen, cuadrado, de al menos minView m (en metros desde NAV.minX / NAV.minZ)
function mapView() {
  const C = CONFIG.MAPVIEW, B = MAPV.bb;
  let x0, x1, z0, z1;
  if (B) { x0 = B[0] - C.margin; x1 = B[1] + C.margin; z0 = B[2] - C.margin; z1 = B[3] + C.margin; }
  else { const P = player.pos; x0 = P.x - NAV.minX - 35; x1 = x0 + 70; z0 = P.z - NAV.minZ - 35; z1 = z0 + 70; }
  const side = Math.max(C.minView, x1 - x0, z1 - z0) * 1.12, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;   // ×1.12: aire para el marco
  return { x0: cx - side / 2, z0: cz - side / 2, side };
}
// de metros del mundo a píxeles de la vista (k = píxeles por metro); el norte (+z) arriba
function mapPt(V, k, x, z) { return [(x - NAV.minX - V.x0) * k, (V.z0 + V.side - (z - NAV.minZ)) * k]; }

// ---- íconos en tinta de los puntos de interés ----
function mapIcon(g, kind, x, y, s, col) {
  g.save(); g.translate(x, y); g.lineWidth = 2; g.strokeStyle = '#1e1006'; g.fillStyle = col;
  if (kind === 'box') {                                                  // cajón con "?" y un círculo rojo alrededor
    g.fillRect(-s, -s * 0.7, 2 * s, 1.4 * s); g.strokeRect(-s, -s * 0.7, 2 * s, 1.4 * s);
    g.beginPath(); g.moveTo(-s, -s * 0.2); g.lineTo(s, -s * 0.2); g.stroke();
    g.fillStyle = '#1e1006'; g.font = 'bold ' + Math.round(s * 1.2) + 'px ' + MAP_SERIF; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, s * 0.25);
    g.strokeStyle = 'rgba(150,10,8,.85)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(0, 0, s * 2, s * 1.6, 0.3, 0.2, Math.PI * 2.05); g.stroke();
  } else if (kind === 'pap') {                                           // calavera morada con ojos que brillan
    g.beginPath(); g.arc(0, -s * 0.2, s, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillRect(-s * 0.6, s * 0.5, s * 1.2, s * 0.6); g.strokeRect(-s * 0.6, s * 0.5, s * 1.2, s * 0.6);
    g.fillStyle = '#e8ff7a'; g.beginPath(); g.arc(-s * 0.4, -s * 0.25, s * 0.25, 0, Math.PI * 2); g.arc(s * 0.4, -s * 0.25, s * 0.25, 0, Math.PI * 2); g.fill();
  } else {                                                               // perk: botella del color
    g.beginPath(); g.moveTo(-s * 0.5, s); g.lineTo(-s * 0.5, -s * 0.2); g.lineTo(-s * 0.2, -s * 0.5); g.lineTo(-s * 0.2, -s);
    g.lineTo(s * 0.2, -s); g.lineTo(s * 0.2, -s * 0.5); g.lineTo(s * 0.5, -s * 0.2); g.lineTo(s * 0.5, s); g.closePath(); g.fill(); g.stroke();
  }
  g.restore();
}
function mapPoi(g, V, k, x, z, kind, col, label) {
  if (!mapSeenAt(x, z)) return;
  const q = roomAt(x, z);
  if (q && (q.cata || q.hideMap)) return;
  const [sx, sy] = mapPt(V, k, x, z), s = Math.max(6, Math.min(12, k * 0.9));
  mapIcon(g, kind, sx, sy, s, col);
  if (label) {
    g.font = 'bold 13px ' + MAP_HAND; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#1e1006';
    g.fillText(label, sx + s + 5, sy);
  }
}
// ---- sin señal (en el búnker): estática, barras corridas y el cartel que falla ----
function drawNoSignal(g, S, t) {
  const n = 180;
  if (!MAPV.noise) [MAPV.noise] = mapCanvas(n, n);
  const nc = MAPV.noise && MAPV.noise.getContext('2d');
  if (nc) {
    const img = nc.createImageData(n, n);
    for (let i = 0; i < n * n; i++) { const v = Math.random() * 200; img.data[i * 4] = v; img.data[i * 4 + 1] = v * 0.95; img.data[i * 4 + 2] = v * 1.05; img.data[i * 4 + 3] = 255; }
    nc.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = false; g.drawImage(MAPV.noise, 0, 0, S, S);
  }
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 6; i++) {                                         // barras que se corren
    const y = Math.random() * S, h = 4 + Math.random() * 30;
    g.drawImage(g.canvas, 0, y, S, h, (Math.random() - 0.5) * 80, y, S, h);
  }
  for (let y = 0; y < S; y += 4) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y, S, 2); }   // líneas de TV
  const jx = (Math.random() - 0.5) * (Math.random() < 0.2 ? 30 : 6), jy = (Math.random() - 0.5) * 4;
  g.font = 'bold 92px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,30,40,.8)'; g.fillText('NO SIGNAL', S / 2 + jx - 5, S / 2 + jy);
  g.fillStyle = 'rgba(30,230,255,.8)'; g.fillText('NO SIGNAL', S / 2 + jx + 5, S / 2 + jy);
  g.fillStyle = '#f4f4f4'; g.fillText('NO SIGNAL', S / 2 + jx, S / 2 + jy);
  g.font = '18px monospace'; g.fillStyle = 'rgba(230,230,230,.7)';
  g.fillText(Math.sin(t * 3) > 0 ? '— searching... —' : '— too deep underground —', S / 2, S / 2 + 80);
}
function drawMap() {
  const cv = MAPV.cv, C = CONFIG.MAPVIEW, S = C.size;
  if (!cv || !cv.getContext) return;                                    // sin canvas (tests)
  const g = cv.getContext('2d');
  if (!g) return;
  if (cv.width !== S) { cv.width = S; cv.height = S; }
  const t = clock.elapsedTime;
  if (MAPV.nosig) { drawNoSignal(g, S, t); return; }
  if (!MAPV.base || !MAPV.paper) return;
  const px = C.px, V = mapView(), k = S / V.side;
  // 1) el papel  2) el terreno multiplicado (se ve el papel a través)  3) la sangre
  g.globalCompositeOperation = 'source-over'; g.drawImage(MAPV.paper, 0, 0);
  const sx0 = V.x0, sy0 = NAV.h - (V.z0 + V.side);
  g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true;
  g.drawImage(MAPV.base, sx0 * px, sy0 * px, V.side * px, V.side * px, 0, 0, S, S);
  if (MAPV.stains) g.drawImage(MAPV.stains, 0, 0);
  g.globalCompositeOperation = 'source-over';
  // 4) nombres escritos a mano y notas en rojo (solo lo que ya viste)
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const fs = Math.round(Math.max(12, Math.min(20, k * 3)));
  for (const L of MAPV.labels || []) {
    if (!mapSeenAt(L.x, L.z)) continue;
    const [lx, ly] = mapPt(V, k, L.x, L.z);
    g.save(); g.translate(lx, ly); g.rotate(L.rot);
    g.font = 'bold ' + fs + 'px ' + MAP_HAND; g.fillStyle = 'rgba(240,225,190,.55)'; g.fillText(L.name, 1, 1);
    g.fillStyle = '#24130a'; g.fillText(L.name, 0, 0);
    if (L.note) { g.font = Math.round(fs * 0.75) + 'px ' + MAP_HAND; g.fillStyle = 'rgba(150,8,6,.9)'; g.fillText(L.note, fs * 0.6, fs * 1.15); }
    g.restore();
  }
  // 5) la caja, el PaP y los perks (dibujados en tinta)
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  if (BOX.room && CONFIG.BOX.spots[BOX.room]) { const s = CONFIG.BOX.spots[BOX.room]; mapPoi(g, V, k, s.x, s.z, 'box', '#c89a4a', 'MYSTERY BOX'); }
  const PS = CONFIG.PAP.spot; mapPoi(g, V, k, PS.x, PS.z, 'pap', '#6a2a9a', 'PACK-A-PUNCH');
  for (const key in CONFIG.PERKS.list) { const p = CONFIG.PERKS.list[key]; mapPoi(g, V, k, p.x, p.z, 'perk', hex(p.color || 0xffffff), p.name); }
  // 6) los zombies cerca tuyo: manchas rojas que laten (el boss, una cruz grande)
  const P = player.pos, beat = 0.55 + 0.45 * Math.abs(Math.sin(t * 5));
  for (const z of state.zombies) {
    if (!z.alive || Math.hypot(z.px - P.x, z.pz - P.z) > C.zombies || !mapSeenAt(z.px, z.pz)) continue;
    const [zx, zy] = mapPt(V, k, z.px, z.pz), r = Math.max(3, k * 0.5) * (z.boss ? 2 : 1);
    g.fillStyle = `rgba(170,10,8,${(0.5 * beat).toFixed(2)})`; g.beginPath(); g.arc(zx, zy, r * 2.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = `rgba(120,0,0,${(0.9 * beat).toFixed(2)})`; g.beginPath(); g.arc(zx, zy, r, 0, Math.PI * 2); g.fill();
    if (z.boss) { g.strokeStyle = '#5a0000'; g.lineWidth = 3; g.beginPath(); g.moveTo(zx - r * 2, zy - r * 2); g.lineTo(zx + r * 2, zy + r * 2); g.moveTo(zx + r * 2, zy - r * 2); g.lineTo(zx - r * 2, zy + r * 2); g.stroke(); }
  }
  // 7) vos: halo de vela y un alfiler rojo que mira para donde mirás
  const [sx, sy] = mapPt(V, k, P.x, P.z), fl = 0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 7.3);
  const halo = g.createRadialGradient(sx, sy, 0, sx, sy, 60 * fl);
  halo.addColorStop(0, 'rgba(255,200,110,.45)'); halo.addColorStop(1, 'rgba(255,200,110,0)');
  g.fillStyle = halo; g.fillRect(sx - 70, sy - 70, 140, 140);
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), a = Math.atan2(-fz, fx), L = Math.max(11, k * 2.4);
  g.save(); g.translate(sx, sy); g.rotate(a);
  g.fillStyle = '#b01010'; g.strokeStyle = '#1e0404'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(L, 0); g.lineTo(-L * 0.7, L * 0.62); g.lineTo(-L * 0.3, 0); g.lineTo(-L * 0.7, -L * 0.62); g.closePath();
  g.fill(); g.stroke(); g.restore();
  g.fillStyle = '#1e0404'; g.beginPath(); g.arc(sx, sy, 3, 0, Math.PI * 2); g.fill();
  // 8) lo quemado: primero la brasa (difusa, titila), después el carbón encima (un poco menos difuso)
  mapFogFlush();
  if (MAPV.char && MAPV.ember) {
    const src = [sx0, sy0, V.side, V.side, 0, 0, S, S];
    g.save();
    g.globalAlpha = 0.55 + 0.25 * Math.sin(t * 2.3) * Math.sin(t * 3.7);
    g.filter = 'blur(' + Math.round(k * 2.2) + 'px)'; g.drawImage(MAPV.ember, ...src);
    g.globalAlpha = 1; g.filter = 'blur(' + Math.round(k * 0.9) + 'px)'; g.drawImage(MAPV.char, ...src);
    g.filter = 'none'; g.restore();
  }
  // la sangre también sobre lo quemado (se ve roja oscura en el carbón)
  if (MAPV.stains) { g.globalAlpha = 0.7; g.drawImage(MAPV.stains, 0, 0); g.globalAlpha = 1; }
  // 9) el marco quemado, el título y la rosa
  if (MAPV.frame) g.drawImage(MAPV.frame, 0, 0);
  // la escala: 20 m, en su parche de papel
  const bar = 20 * k;
  g.fillStyle = 'rgba(214,192,142,.92)'; g.fillRect(S * 0.06, S * 0.905, bar + 70, 40);
  g.strokeStyle = '#2a170a'; g.fillStyle = '#2a170a'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(S * 0.07, S * 0.93); g.lineTo(S * 0.07 + bar, S * 0.93); g.moveTo(S * 0.07, S * 0.925); g.lineTo(S * 0.07, S * 0.935);
  g.moveTo(S * 0.07 + bar, S * 0.925); g.lineTo(S * 0.07 + bar, S * 0.935); g.stroke();
  g.font = 'italic 13px ' + MAP_SERIF; g.textAlign = 'left'; g.fillText('20 m', S * 0.07 + bar + 8, S * 0.93);
}

// ---- abajo: lo que llevás, en etiquetas de papel con íconos de tinta (lo que falta, tachado) ----
const MAP_ICONS = {
  door: '<rect x="6" y="3" width="12" height="18" rx="1"/><circle cx="15" cy="12" r="1.2"/>',
  board: '<path d="M12 2c4 4 5 13 0 20c-5-7-4-16 0-20z"/><path d="M9 9l3 2l-2 3l3 2"/>',
  handle: '<path d="M5 18v-8a7 7 0 0 1 14 0v8"/><path d="M3 18h4M17 18h4"/>',
  coconut: '<circle cx="12" cy="13" r="8"/><circle cx="9.5" cy="9.5" r="1"/><circle cx="14.5" cy="9.5" r="1"/><circle cx="12" cy="13" r="1"/>',
  string: '<path d="M3 20l14-14"/><path d="M17 6l3-3M16 3l5 5"/><path d="M5 18c2-3 4 1 6-2s4 1 6-2"/>',
  conch: '<path d="M4 19c3-10 13-15 16-9c2 5-6 9-9 5c-2-3 3-5 4-2"/><path d="M4 19l4-1"/>',
  fumigator: '<rect x="7" y="8" width="9" height="13" rx="2"/><path d="M11 8V5h5l3-2M16 12h4"/>',
  shield: '<path d="M12 2l8 3v6c0 6-4 9-8 11c-4-2-8-5-8-11V5z"/>',
  wave: '<path d="M2 16c3-6 6-8 9-4c2 3 4 3 6-1c1-2 3-3 5-1"/><path d="M2 20c4-2 7-2 10 0s7 2 10 0"/>'
};
function renderMapItems() {
  if (!MAPV.items) return;
  if (MAPV.nosig) { if (MAPV.itemsKey !== 'nosig') { MAPV.items.innerHTML = ''; MAPV.itemsKey = 'nosig'; } return; }
  const SP = CONFIG.SHIELD.parts, sh = state.shield, q = state.quest, fum = typeof CLAMS !== 'undefined' && CLAMS.have;
  const key = [Object.keys(SP).map(k => sh.parts[k] ? 1 : 0).join(''), sh.built, sh.has, q.coconut, q.string, q.shell, q.built, fum].join('|');
  if (key === MAPV.itemsKey) return;                                      // solo si cambió algo
  MAPV.itemsKey = key;
  const it = (have, icon, name) => `<div class="mi${have ? ' on' : ''}"><svg viewBox="0 0 24 24">${MAP_ICONS[icon]}</svg><span>${name}</span></div>`;
  let h = '<div class="mg"><h4>SHIELD</h4>' +
    Object.keys(SP).map(k => it(sh.parts[k] || sh.built, k, SP[k].name)).join('') +
    (sh.built ? it(true, 'shield', sh.has ? 'SHIELD BUILT · ON YOU' : 'SHIELD BUILT') : '') + '</div>';
  h += '<div class="mg"><h4>BREAKING WAVE</h4>' +
    it(q.coconut || q.built, 'coconut', 'GOLDEN COCONUT') + it(q.string || q.built, 'string', 'GUITAR STRING') +
    it(q.shell || q.built, 'conch', 'CONCH SHELL') + (q.built ? it(true, 'wave', 'WAVE BUILT') : '') + '</div>';
  h += '<div class="mg"><h4>TOOLS</h4>' + it(fum, 'fumigator', 'FUMIGATOR') + '</div>';
  MAPV.items.innerHTML = h;
}
// cada frame: destapa alrededor tuyo (cada `every` s, si te moviste; en el búnker no: ahí no hay señal) y, con el
// mapa abierto, lo redibuja
function updateMapView(dt) {
  if (!state.running) return;
  const C = CONFIG.MAPVIEW, P = player.pos, under = mapUnderground();
  if ((MAPV.t -= dt) <= 0) {
    MAPV.t = C.every;
    if (!under && Math.abs(P.x - MAPV.lx) + Math.abs(P.z - MAPV.lz) > 0.5) { MAPV.lx = P.x; MAPV.lz = P.z; mapReveal(P.x, P.z); }
  }
  if (!MAPV.on) return;
  if (under !== MAPV.nosig) { MAPV.nosig = under; MAPV.el.classList.toggle('nosig', under); MAPV.itemsKey = ''; MAPV.drawT = 0; }
  if ((MAPV.drawT -= dt) <= 0) { MAPV.drawT = MAPV.nosig ? 0.05 : 0.1; drawMap(); renderMapItems(); }
}
function resetMapView() {
  mapSeenInit(); MAPV.seen.fill(0);
  if (MAPV.fogImg) { for (let k = 0; k < NAV.w * NAV.h; k++) MAPV.fogImg.data[k * 4 + 3] = 255; }
  MAPV.lx = MAPV.lz = 1e9; MAPV.t = 0; MAPV.dirty = true; MAPV.bb = null; MAPV.itemsKey = '';
  if (MAPV.on) toggleMap(false);
}
