//=== 7h. BÚNKER, ESCOTILLA Y ESTATUAS (V2 F5.11) ===========================
// El búnker (R16, CONFIG.BUNKER) es una zona aparte bajo tierra: sus x,z no se pisan con nada del mapa y su
// piso está en y = BUNKER.y (groundY lo devuelve). Así no hace falta un tercer nivel de grid: para el jugador
// la escotilla es un fundido y un teletransporte; para los zombies, un enlace del grid (NAV.hatch, lo arma
// buildNavGrid solo con BUNK.open) que cruzan escondidos (startClimb/updateClimb), con los ojos rojos al bajar.
// La escotilla está cerrada hasta que las 2 estatuas de plantas de al lado despiertan (5 calamares muertos
// cerca de cada una) y comen (6 arrastrados y 3 perros cada una). Ahí se abre y aparece el caballito de mar en
// el techo del sótano, con la tortuga y el langostino.
// Sin luces nuevas: el búnker es MeshBasic con la luz de los focos pintada en los colores (por baldosa).
const BUNK = { open: false, statues: [], lid: null, hole: null, lamp: null, seahorse: null,
               fadeT: 0, fadeTo: null, fadeDone: false };

// (buildMap, antes del grid) paredes, piso y techo: colliders y cajas de tiro invisibles; el dibujo va aparte
function buildBunkerShell() {
  const B = CONFIG.BUNKER, y0 = B.y, y1 = B.y + B.h, T = CONFIG.WALL_T, mat = new THREE.MeshBasicMaterial();
  const box = (x1, x2, a, b, z1, z2, tag, opts) => { const r = addBox(x1, x2, a, b, z1, z2, mat, tag, opts); r.mesh.visible = false; return r; };
  box(B.x1 - T / 2, B.x2 + T / 2, y0, y1, B.z1 - T / 2, B.z1 + T / 2, 'bunker');   // sur
  box(B.x1 - T / 2, B.x2 + T / 2, y0, y1, B.z2 - T / 2, B.z2 + T / 2, 'bunker');   // norte
  box(B.x1 - T / 2, B.x1 + T / 2, y0, y1, B.z1, B.z2, 'bunker');                    // oeste
  box(B.x2 - T / 2, B.x2 + T / 2, y0, y1, B.z1, B.z2, 'bunker');                    // este
  box(B.x1, B.x2, y0 - 0.3, y0, B.z1, B.z2, 'floor:R16', { noCollide: true });      // piso (frena balas)
  box(B.x1, B.x2, y1, y1 + 0.3, B.z1, B.z2, 'ceil:R16', { noCollide: true });       // techo (tapa la vista de arriba)
  const t = B.teleporter;                                                           // plataforma del teletransportador
  box(t.x - 1.6, t.x + 1.6, y0, y0 + 0.4, t.z - 1.4, B.z2 - T / 2, 'bunker:teleporter');
  const E = B.entrance;                                                             // F5.13: la entrada, arriba
  box(E.x1, E.x2, 0, E.h, E.z1, E.z2, 'bunker:entrada');
}

// cuánta luz de los focos llega a (x, z): 0 oscuro .. ~1 debajo de un foco
function bunkerLight(x, z) {
  let l = 0;
  for (const [bx, bz] of CONFIG.BUNKER.bulbs) l += Math.max(0, 1 - Math.hypot(x - bx, z - bz) / 7) ** 2;
  return Math.min(1, l);
}
function shade(hex, k) { const c = new THREE.Color(hex); return c.multiplyScalar(k).getHex(); }

function buildBunker() {
  buildPortals();
  buildShell();                                                                        // F5.17: el caparazón (F5.16: la estación de policía)
  const B = CONFIG.BUNKER, y0 = B.y, y1 = B.y + B.h, mb = new MeshBuilder(), lit = (x, z) => 0.16 + 0.7 * bunkerLight(x, z);
  // piso y techo por baldosa de 1 m (la luz pintada), paredes por metro
  for (let x = B.x1; x < B.x2; x++) for (let z = B.z1; z < B.z2; z++) {
    const k = lit(x + 0.5, z + 0.5), odd = (x + z) & 1;
    mb.box(x + 0.5, y0 + 0.01, z + 0.5, 1, 0.02, 1, shade(odd ? 0x6a6a64 : 0x626260, k));
    mb.box(x + 0.5, y1 - 0.01, z + 0.5, 1, 0.02, 1, shade(0x4a4a48, k * 0.8));
  }
  for (let x = B.x1; x < B.x2; x++) for (let h = 0; h < B.h; h++) {
    mb.box(x + 0.5, y0 + h + 0.5, B.z1 + 0.21, 1, 1, 0.02, shade(h ? 0x5a5a56 : 0x3a3a38, lit(x + 0.5, B.z1 + 1)));
    mb.box(x + 0.5, y0 + h + 0.5, B.z2 - 0.21, 1, 1, 0.02, shade(h ? 0x5a5a56 : 0x3a3a38, lit(x + 0.5, B.z2 - 1)));
  }
  for (let z = B.z1; z < B.z2; z++) for (let h = 0; h < B.h; h++) {
    mb.box(B.x1 + 0.21, y0 + h + 0.5, z + 0.5, 0.02, 1, 1, shade(h ? 0x5a5a56 : 0x3a3a38, lit(B.x1 + 1, z + 0.5)));
    mb.box(B.x2 - 0.21, y0 + h + 0.5, z + 0.5, 0.02, 1, 1, shade(h ? 0x5a5a56 : 0x3a3a38, lit(B.x2 - 1, z + 0.5)));
  }
  // caños por el techo, cajas, tambores y una mesa con un mapa (z relativas al sur del búnker: oz)
  const oz = B.z1 - 60;
  for (const z of [B.z1 + 3, B.z2 - 3]) mb.box((B.x1 + B.x2) / 2, y1 - 0.35, z, B.x2 - B.x1 - 1, 0.2, 0.2, shade(0x5a4a3a, 0.5));
  mb.box(B.x1 + 3, y1 - 0.35, (B.z1 + B.z2) / 2, 0.2, 0.2, B.z2 - B.z1 - 1, shade(0x5a4a3a, 0.5));
  [[-36.6, 62, 0x6a5232], [-36.6, 63.3, 0x5a4428], [-35.4, 62, 0x6a5232], [-11.4, 83, 0x5a4428], [-12.6, 83, 0x6a5232]].forEach(([x, z, c]) =>
    mb.box(x, y0 + 0.5, z + oz, 1.1, 1, 1.1, shade(c, lit(x, z + oz) + 0.2)));
  [[-11.3, 61.3], [-12.4, 61.3], [-11.3, 62.4]].forEach(([x, z]) => mb.box(x, y0 + 0.6, z + oz, 0.8, 1.2, 0.8, shade(0x3a5a3a, lit(x, z + oz) + 0.2)));
  const tz = 72 + oz;
  mb.box(-24, y0 + 0.8, tz, 2.4, 0.1, 1.4, shade(0x5a4030, lit(-24, tz) + 0.3));   // mesa
  for (const [x, dz] of [[-25.1, -0.6], [-22.9, -0.6], [-25.1, 0.6], [-22.9, 0.6]]) mb.box(x, y0 + 0.4, tz + dz, 0.1, 0.8, 0.1, shade(0x3a2a20, 0.4));
  mb.box(-24, y0 + 0.86, tz, 1.6, 0.01, 1, shade(0xc8b890, lit(-24, tz) + 0.3));   // mapa
  // F5.12: agentes del FBI muertos (traje oscuro, camisa, corbata, placa, gorra) y charcos de sangre
  const skinP = 0xc8a890, suitC = 0x1a1c24;
  [[-33, 7, 0.4, false], [-15, 9, -1.2, false], [-27, 17, 2.1, true], [-36.8, 14, Math.PI / 2, 'wall'], [-19.5, 21, 0.9, true]].forEach(([x, z, rot, faceDown], i) => {
    const zz = z + B.z1, k = lit(x, zz) + 0.25, sh = c => shade(c, k);
    mb.setFrame(x, y0, zz, rot);
    mb.box(0, 0.02, 0.3, 1.6, 0.02, 1.1, sh(0x3a0606));                      // sangre
    if (faceDown === 'wall') {                                               // sentado contra la pared
      mb.box(0, 0.35, 0, 0.45, 0.7, 0.28, sh(suitC)); mb.box(0, 0.82, 0.02, 0.26, 0.26, 0.26, sh(skinP));
      mb.box(0, 0.62, 0.15, 0.08, 0.26, 0.02, sh(0x6a1010));                 // corbata
      for (const s of [-1, 1]) mb.box(s * 0.12, 0.1, 0.45, 0.16, 0.16, 0.7, sh(suitC));   // piernas estiradas
      mb.box(-0.3, 0.2, 0.15, 0.12, 0.12, 0.45, sh(suitC));
    } else {                                                                 // tirado en el piso
      mb.box(0, 0.12, 0, 0.5, 0.22, 0.75, sh(suitC));                        // torso
      mb.box(0, 0.23, 0.02, 0.2, 0.02, 0.5, sh(faceDown ? suitC : 0xe8e8e0));   // camisa (boca arriba)
      if (!faceDown) mb.box(0, 0.245, 0.05, 0.07, 0.01, 0.4, sh(0x6a1010));  // corbata
      mb.box(0, 0.13, 0.52, 0.24, 0.22, 0.26, sh(skinP));                    // cabeza
      mb.box(0, 0.26, 0.52, 0.26, 0.05, 0.28, sh(0x0a0a0c));                 // gorra
      for (const s of [-1, 1]) mb.box(s * 0.13, 0.1, -0.75, 0.17, 0.17, 0.8, sh(suitC));   // piernas
      mb.box(0.42, 0.08, 0.1, 0.13, 0.13, 0.6, sh(suitC), 0, 0.6, 0);        // brazos abiertos
      mb.box(-0.42, 0.08, -0.05, 0.13, 0.13, 0.6, sh(suitC), 0, -0.4, 0);
      if (faceDown) mb.box(0, 0.24, -0.05, 0.36, 0.01, 0.2, sh(0xe8c030));   // "FBI" amarillo en la espalda
      mb.box(0.3, 0.02, 0.9, 0.16, 0.03, 0.1, sh(0x2a2a2a));                 // pistola caída
    }
    mb.box(0.18, 0.2, -0.05, 0.06, 0.08, 0.01, sh(0xd8b040));                // placa
  });
  mb.setFrame(null);
  // escalera de la escotilla (pared sur) y el agujero en el techo
  const L = B.ladder;
  mb.box(L.x - 0.35, (y0 + y1) / 2, L.z, 0.08, B.h, 0.08, shade(0x8a8a88, 0.6));
  mb.box(L.x + 0.35, (y0 + y1) / 2, L.z, 0.08, B.h, 0.08, shade(0x8a8a88, 0.6));
  for (let i = 0; i < 12; i++) mb.box(L.x, y0 + 0.3 + i * 0.32, L.z, 0.7, 0.05, 0.05, shade(0x9a9a98, 0.6));
  mb.box(L.x, y1 - 0.005, L.z + 0.3, 1.2, 0.02, 1.2, 0x050505);
  // teletransportador (el de Black Ops, apagado y en rojo): plataforma, dos columnas, arco y bobinas
  const t = B.teleporter, red = 0xff2a1a;
  mb.box(t.x, y0 + 0.2, t.z + 0.1, 3.2, 0.4, 2.6, shade(0x4a4a50, 0.7));
  mb.box(t.x, y0 + 0.41, t.z + 0.1, 2.4, 0.02, 1.8, 0x3a0a08);
  for (const s of [-1, 1]) {
    mb.box(t.x + s * 1.35, y0 + 1.6, t.z + 0.5, 0.35, 2.4, 0.35, shade(0x5a5a62, 0.7));
    for (let i = 0; i < 5; i++) mb.box(t.x + s * 1.35, y0 + 0.8 + i * 0.4, t.z + 0.5, 0.45, 0.08, 0.45, shade(0xb87a3a, 0.7));   // bobinas de cobre
  }
  mb.box(t.x, y0 + 2.9, t.z + 0.5, 3.1, 0.3, 0.4, shade(0x5a5a62, 0.7));
  mb.box(t.x, y0 + 2.2, B.z2 - 0.3, 1.6, 1.2, 0.2, shade(0x3a3a40, 0.7));      // tablero
  const m = mb.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
  if (m) { m.userData.theme = false; m.updateMatrix(); }
  // lo que brilla: focos, luces rojas del teletransportador y los charcos de luz en el piso (aditivos)
  const glow = new MeshBuilder();
  for (const [bx, bz] of B.bulbs) {
    glow.box(bx, y1 - 0.5, bz, 0.02, 0.5, 0.02, 0x222222);
    glow.box(bx, y1 - 0.8, bz, 0.18, 0.22, 0.18, 0xffe0a0);
  }
  glow.box(t.x, y0 + 2.2, B.z2 - 0.41, 1.2, 0.5, 0.02, red);                      // pantalla roja
  for (const s of [-1, 1]) glow.box(t.x + s * 1.35, y0 + 2.95, t.z + 0.5, 0.2, 0.2, 0.46, red);
  glow.box(t.x, y0 + 0.43, t.z + 0.1, 2.2, 0.01, 0.1, red); glow.box(t.x, y0 + 0.43, t.z + 0.1, 0.1, 0.01, 1.6, red);
  const gm = glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
  if (gm) { gm.userData.theme = false; gm.updateMatrix(); }
  const pool = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,220,150,.35)', 'rgba(255,200,120,.12)'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false });
  for (const [bx, bz] of B.bulbs) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), pool);
    p.rotation.x = -Math.PI / 2; p.position.set(bx, y0 + 0.03, bz); scene.add(p);
  }
  const sign = makeTex((c, s) => {
    c.fillStyle = '#1a0806'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#ff3a2a'; c.textAlign = 'center';
    c.font = 'bold ' + Math.floor(s * 0.13) + 'px monospace'; c.fillText('OUT OF', s / 2, s * 0.45); c.fillText('ORDER', s / 2, s * 0.65);
  }, 1, 128);
  sign.magFilter = THREE.LinearFilter;
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: sign }));
  sg.position.set(t.x, y0 + 2.2, B.z2 - 0.43); sg.rotation.y = Math.PI; scene.add(sg);
  buildHatch();
  buildStatues();
  buildSeahorse();
}

// F5.13: la entrada del búnker: un bloque de hormigón contra la pared norte del sótano, 5.2 m de ancho (×4 la
// escotilla de antes), techo inclinado, franjas de peligro, bolsas de arena, cartel, dos puertas blindadas que se
// corren a los costados al abrirse (el hueco negro queda atrás) y una luz roja/verde (MeshBasic)
// F5.15: en la esquina NO y medio destruida por fuera: la esquina de arriba derrumbada (con la losa caída al
// costado y hierros a la vista), el techo partido y hundido, grietas, musgo y lianas, escombros, un cráter con el
// piso quemado, barriles oxidados volcados, bolsas de arena desparramadas, franjas gastadas, cartel torcido y
// puertas oxidadas (una torcida). Todo se dibuja en un marco local con +z = hacia afuera (E.face); el sólido
// sigue siendo el bloque entero
function buildHatch() {
  const E = CONFIG.BUNKER.entrance, face = E.face || 1, W = E.x2 - E.x1, D = E.z2 - E.z1, H = E.h;
  const cx = (E.x1 + E.x2) / 2, cz = (E.z1 + E.z2) / 2, ry = face > 0 ? 0 : Math.PI;
  const mb = new MeshBuilder().setFrame(cx, 0, cz, ry), F = D / 2;              // F = cara de adelante (local z)
  const conc = 0x7a7a74, dark = 0x5a5a56, rust = 0x7a4a2a, moss = 0x4a6a32;
  let s = 11; const r = (a, b) => { s = (s * 16807) % 2147483647; return a + (b - a) * s / 2147483647; };
  // bloque: la parte baja entera y la de arriba solo del lado izquierdo (la esquina derecha se derrumbó)
  mb.box(0, (H - 0.9) / 2, 0, W, H - 0.9, D, conc);
  mb.box(-W * 0.15, H - 0.45, 0, W * 0.7, 0.9, D, conc);
  mb.box(W / 2 - 0.5, H - 1.1, 0, 1.0, 0.5, D, 0x6a6a64, 0, 0, 0.5);                  // borde roto en diagonal
  // techo partido: un pedazo en su lugar y el otro hundido hacia la esquina rota
  mb.box(-W * 0.2, H + 0.2, -0.1, W * 0.65, 0.4, D + 0.5, dark, 0.06, 0, 0);
  mb.box(W * 0.3, H - 0.25, 0, W * 0.45, 0.35, D + 0.3, dark, 0.05, 0.1, -0.32);
  // la losa que se cayó, apoyada contra el costado derecho
  mb.box(W / 2 + 0.9, 0.9, 0.1, 0.35, 2.2, D * 0.8, 0x6e6e68, 0.05, 0, -0.45);
  for (let i = 0; i < 7; i++) mb.box(W / 2 - 0.3 + r(-0.3, 0.4), H - 0.9 + r(-0.2, 0.3), r(-F, F), 0.04, r(0.6, 1.2), 0.04, rust, r(-0.5, 0.5), 0, r(-0.8, 0.8));   // hierros
  // grietas en la fachada
  for (const [x0, y0, n] of [[-1.8, 2.8, 5], [1.2, 2.4, 4], [-0.6, 0.6, 3]]) {
    let x = x0, y = y0;
    for (let k = 0; k < n; k++) { const dx = r(-0.3, 0.3), dy = -r(0.2, 0.4); mb.box(x + dx / 2, y + dy / 2, F + 0.02, 0.04, Math.hypot(dx, dy), 0.01, 0x2a2a28, 0, 0, Math.atan2(dx, -dy)); x += dx; y += dy; }
  }
  // marco, dintel partido, el hueco
  for (const sx of [-1, 1]) mb.box(sx * (W / 2 - 0.2), H / 2 - 0.3, F + 0.15, 0.4, H - 0.6, 0.3, dark);
  mb.box(-0.8, 2.55, F + 0.15, W / 2 - 0.2, 0.3, 0.3, dark);
  mb.box(1.1, 2.4, F + 0.15, W / 2 - 0.9, 0.3, 0.3, dark, 0, 0, -0.18);
  mb.box(0, 1.25, F - 0.05, 4.4, 2.4, 0.1, 0x050505);
  for (let i = 0; i < 5; i++) if (i !== 3) mb.box(-W / 2 + 0.6 + i * 1.0, H - 1.4, F + 0.01, 0.5, 0.25, 0.02, i % 2 ? 0x2a2a2a : 0xb8962a, 0, 0, 0.6);   // franjas gastadas
  // musgo arriba y lianas colgando de la fachada
  mb.box(-W * 0.15, H + 0.42, 0, W * 0.55, 0.06, D * 0.8, moss);
  for (let i = 0; i < 9; i++) mb.box(-W / 2 + 0.3 + i * 0.55, H - 0.3 - r(0, 1.2) / 2, F + 0.05, 0.06, r(0.6, 1.8), 0.03, i % 2 ? moss : 0x3a5a2a);
  // bolsas de arena: un parapeto a la izquierda y otras desparramadas
  for (let k = 0; k < 3; k++) mb.box(-W / 2 - 0.7, 0.2 + k * 0.32, F + 0.4, 1.1, 0.3, 0.6, [0xb8a878, 0xa89868, 0xc0b080][k]);
  for (let i = 0; i < 5; i++) mb.box(W / 2 + r(0.2, 2), 0.15, F + r(0.2, 2.2), 0.9, 0.28, 0.55, 0xb0a070, 0, r(0, 3), r(-0.2, 0.2));
  // escombros
  for (let i = 0; i < 14; i++) { const w = r(0.2, 0.7); mb.box(r(-W / 2 - 1, W / 2 + 2.5), w * 0.3, F + r(0.3, 3), w, w * 0.6, w * 0.8, i % 3 ? conc : 0x6a6a64, r(0, 1), r(0, 3), r(0, 1)); }
  // cráter con el piso quemado, adelante a la derecha
  const kx = W / 2 - 0.2, kz = F + 3.2;
  mb.box(kx, 0.01, kz, 3.4, 0.02, 3.4, 0x2a241c, 0, 0.4, 0);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; mb.box(kx + Math.cos(a) * 1.4, 0.12, kz + Math.sin(a) * 1.4, 0.7, 0.24, 0.35, 0x5a4a38, 0.2, -a, 0); }
  // barriles oxidados, dos volcados
  const barrel = new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10);
  mb.add(barrel, -W / 2 - 1.3, 0.45, F + 1.6, 1, 1, 1, 0, 0, 0, rust);
  mb.add(barrel, -W / 2 - 0.9, 0.3, F + 2.5, 1, 1, 1, Math.PI / 2, 0.6, 0, 0x6a3a1a);
  mb.add(barrel, W / 2 + 2.6, 0.3, F + 1.2, 1, 1, 1, Math.PI / 2, -0.3, 0, 0x5a4a3a);
  mb.setFrame(null);
  const f = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (f) { f.userData.theme = false; f.updateMatrix(); }
  // puertas blindadas oxidadas (se corren al abrir); la derecha, torcida
  const doors = new THREE.Group(), dm = new THREE.MeshLambertMaterial({ color: 0x6a5a4a });
  const halves = [-1, 1].map(sx => {
    const d = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 0.2), dm);
    d.position.set(sx * 1.1, 1.25, 0); doors.add(d);
    if (sx > 0) d.rotation.set(0.03, 0.06, -0.03);
    for (let k = 0; k < 4; k++) { const rv = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.06), new THREE.MeshLambertMaterial({ color: 0x8a6a4a })); rv.position.set(sx * (0.4 + k * 0.45), 1.8, 0.12); d.add(rv); rv.position.x -= sx * 1.1; }
    return d;
  });
  const front = (x, y, z) => new THREE.Vector3(cx + x * Math.cos(ry) + z * Math.sin(ry), y, cz - x * Math.sin(ry) + z * Math.cos(ry));
  doors.position.copy(front(0, 0, F + 0.08)); doors.rotation.y = ry;
  scene.add(doors);
  const sign = makeTex((c, s) => {
    c.fillStyle = '#2a2a28'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#f0c020'; c.textAlign = 'center';
    c.font = 'bold ' + Math.floor(s * 0.2) + 'px monospace'; c.fillText('BUNKER', s / 2, s * 0.45);
    c.font = 'bold ' + Math.floor(s * 0.12) + 'px monospace'; c.fillText('34B', s / 2, s * 0.7);
  }, 1, 128);
  sign.magFilter = THREE.LinearFilter;
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshLambertMaterial({ map: sign }));
  sg.position.copy(front(-1.2, 2.95, F + 0.32)); sg.rotation.set(0, ry, 0.18); scene.add(sg);   // cartel torcido
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
  lamp.position.copy(front(0.6, 2.85, F + 0.32)); lamp.rotation.y = ry; scene.add(lamp);
  BUNK.lid = doors; BUNK.halves = halves; BUNK.hole = { visible: false }; BUNK.lamp = lamp;
}

// estatuas de plantas (piedra) a los dos lados de la escotilla; la maceta es un PROPS sólido
function buildStatues() {
  const B = CONFIG.BUNKER, S = CONFIG.GARDEN.headScale;
  for (const sp of B.statues) {
    const potH = 0.9, stone = new MeshBuilder(), alive = new MeshBuilder();
    for (const mb of [stone, alive]) mb.box(sp.x, potH / 2, sp.z, 0.8, potH, 0.8, mb === stone ? 0x8a8a84 : 0x7a4a2a);   // maceta
    plantStem(stone, sp.x, potH, sp.z, S, true);
    plantStem(alive, sp.x, potH, sp.z, S, false);
    const ms = stone.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })), ma = alive.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    [ms, ma].forEach(m => { m.userData.theme = false; m.updateMatrix(); });
    ma.visible = false;
    const h = makePlantHead(sp.x, potH + 0.7 * S + 0.05, sp.z, S, true);
    h.head.rotation.y = (B.entrance.face || 1) > 0 ? 0 : Math.PI;                    // mira hacia afuera (F5.15)
    BUNK.statues.push(Object.assign(h, { x: sp.x, z: sp.z, ground: true, stoneMesh: ms, aliveMesh: ma,
      kills: 0, crawlers: 0, dogs: 0, awake: false, done: false, eatT: 0, open: 0 }));
  }
}
function statueLook(s, look) {                                                        // 'stone' | 'normal'
  for (const L of s.looks) { L.s.visible = look === 'stone'; L.n.visible = look === 'normal'; L.a.visible = false; }
  s.stoneMesh.visible = look === 'stone'; s.aliveMesh.visible = look !== 'stone';
}

// caballito de mar de piedra rosada (solo visual), al lado de la tortuga y el langostino
function buildSeahorse() {
  const T = CONFIG.BUNKER.seahorse, g = new THREE.Group(), mb = new MeshBuilder(), c = 0xe89a7a, d = 0xc8704a;
  mb.box(0, 0.12, 0, 1.0, 0.24, 1.0, 0x8a8478);                                     // pedestal
  mb.box(0, 0.45, 0.15, 0.12, 0.3, 0.12, d, 0.6, 0, 0);                               // cola enrollada
  mb.box(0, 0.35, 0.3, 0.22, 0.12, 0.22, d);
  mb.box(0, 0.75, 0, 0.3, 0.5, 0.26, c, -0.15, 0, 0);                                 // panza
  mb.box(0, 1.15, -0.05, 0.28, 0.4, 0.24, c, 0.1, 0, 0);                              // pecho
  for (let i = 0; i < 5; i++) mb.box(0, 0.6 + i * 0.16, 0.14, 0.2, 0.04, 0.04, d);    // anillos
  mb.box(0, 1.5, 0.05, 0.26, 0.26, 0.3, c);                                            // cabeza
  mb.box(0, 1.45, 0.35, 0.1, 0.1, 0.36, d);                                            // hocico
  mb.box(-0.13, 1.55, 0.1, 0.02, 0.07, 0.07, 0x1a1a1a); mb.box(0.13, 1.55, 0.1, 0.02, 0.07, 0.07, 0x1a1a1a);
  mb.box(0, 1.7, -0.05, 0.06, 0.16, 0.2, d, -0.4, 0, 0);                              // cresta
  mb.box(0, 1.0, -0.2, 0.04, 0.3, 0.2, 0xf0c0a0, 0.3, 0, 0);                           // aleta
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.remove(m); g.add(m); m.matrixAutoUpdate = true; m.userData.theme = false;
  g.position.set(T.x, SQHEAD.dy, T.z); g.scale.setScalar(T.scale); g.visible = false;   // F5.13: en la cabeza del calamar
  scene.add(g);
  BUNK.seahorse = g;
}

//--- estatuas: despiertan con calamares muertos cerca, después comen arrastrados y perros ---
function statueKill(z) {                                                              // onZombieDeath
  if (z.boss || BUNK.open) return false;                  // F5.15: cualquier enemigo (antes, solo calamares)
  const B = CONFIG.BUNKER;
  for (const s of BUNK.statues) {
    if (s.awake || Math.hypot(z.px - s.x, z.pz - s.z) > B.wakeRadius || (z.level || 0) !== 0) continue;
    if (++s.kills >= B.wakeKills) wakeStatue(s);
    return true;
  }
  return false;
}
function wakeStatue(s) {
  s.awake = true;
  statueLook(s, 'normal');
  spawnSplashFx(s.x, 2, s.z, 0x8aff6a, 1.5);
  sfxPlantWarn(Math.hypot(player.pos.x - s.x, player.pos.z - s.z));
}
function statueWants(s, z) {
  const B = CONFIG.BUNKER;
  return (z.crawl && s.crawlers < B.eatCrawlers) || (z.dog && s.dogs < B.eatDogs);
}
function updateStatues(dt) {
  const B = CONFIG.BUNKER, t = clock.elapsedTime;
  for (const s of BUNK.statues) {
    if (!s.awake) continue;
    if (s.prey) { plantEatAnim(s, dt); continue; }
    s.eatT = Math.max(0, s.eatT - dt);
    let prey = null;
    if (!s.done) for (const z of state.zombies) {
      if (!z.alive || (z.level || 0) !== 0 || Math.hypot(z.px - s.x, z.pz - s.z) > B.eatRange || !statueWants(s, z)) continue;
      prey = z; break;
    }
    if (prey && s.eatT <= 0) { statueEat(s, prey); continue; }
    // boca: respira (y se abre si hay algo que le sirve cerca)
    const target = prey ? 1 : 0.12 + 0.08 * Math.sin(t * 2 + s.x);
    s.open += (target - s.open) * Math.min(1, dt * 6);
    const a = Math.max(0, s.open) * 0.9;
    s.top.rotation.x = -a; s.bot.rotation.x = a * 0.6;
    if (prey) s.head.rotation.y = lerpAngle(s.head.rotation.y, Math.atan2(prey.px - s.x, prey.pz - s.z), Math.min(1, dt * 8));
  }
}
function statueEat(s, z) {
  const B = CONFIG.BUNKER;
  s.eatT = CONFIG.QUEST.plantEatEvery;
  if (z.dog) s.dogs++; else s.crawlers++;
  z.eaten = { p: s, x0: z.px, z0: z.pz };
  s.prey = z; s.eatK = 0;
  damageZombie(z, z.health + 1, false, 0, 0);
  sfxPlantBite();
  if (s.crawlers >= B.eatCrawlers && s.dogs >= B.eatDogs) s.done = true;
  if (BUNK.statues.every(q => q.done)) openBunker();
}
function openBunker() {
  if (BUNK.open) return false;
  BUNK.open = true;
  buildNavGrid();                                  // arma el enlace de la escotilla
  updateFlowField(true);
  BUNK.hole.visible = true;
  BUNK.lamp.material.color.setHex(0x3aff5a);
  BUNK.seahorse.visible = true;
  showBanner('THE BUNKER OPENED', 3);
  sfxShellRise();
  return true;
}

//--- la escotilla: F arriba (bajar) o abajo, al pie de la escalera (subir). Fundido y teletransporte ---
function hatchNear(room, px, pz, bd) {
  const B = CONFIG.BUNKER;
  if (room && room.id === roomAt(B.hatch.out[0], B.hatch.out[1]).id) {   // F5.15: el cuarto de la entrada (claro)
    const d = Math.hypot(px - B.hatch.x, pz - B.hatch.z);
    if (d < Math.min(bd, B.use)) return { target: { down: true }, dist: d };
  } else if (room && room.id === 'R16') {
    const d = Math.hypot(px - B.ladder.x, pz - (B.ladder.z + 0.6));
    if (d < Math.min(bd, B.use)) return { target: { down: false }, dist: d };
  }
  return null;
}
function hatchPrompt(t) {
  if (!BUNK.open) return { text: 'Bunker closed', cost: 0 };
  return { text: t.down ? '[F] Go down to the bunker' : '[F] Climb up', cost: 0 };
}
function useHatch(t) {
  if (!BUNK.open || BUNK.fadeT > 0) return false;
  const B = CONFIG.BUNKER;
  BUNK.fadeTo = t.down ? B.ladder.out : B.hatch.out;
  BUNK.fadeT = B.fade * 2; BUNK.fadeDone = false;
  sfxShieldTake();
  return true;
}
function hatchTeleport(p) {
  player.pos.set(p[0], groundY(p[0], p[1]) + CONFIG.PLAYER.height, p[1]);
  player.vel.set(0, 0, 0);
  player.airTop = player.pos.y;                    // sin daño por caída
  updateFlowField(true);
}
function updateBunker(dt) {
  updateStatues(dt);
  updatePortals(dt, clock.elapsedTime);                                                // F5.16
  updatePolice(dt, clock.elapsedTime);
  if (BUNK.open && BUNK.halves[0].position.x > -2.3) {                               // F5.13: las puertas se corren
    const x = Math.max(-2.3, BUNK.halves[0].position.x - dt * 1.2);
    BUNK.halves[0].position.x = x; BUNK.halves[1].position.x = -x;
  }
  if (BUNK.fadeT > 0) {                                                               // negro a mitad: teletransporte
    const F = CONFIG.BUNKER.fade;
    BUNK.fadeT = Math.max(0, BUNK.fadeT - dt);
    if (!BUNK.fadeDone && BUNK.fadeT <= F) {
      BUNK.fadeDone = true; hatchTeleport(BUNK.fadeTo);
      if (PORTAL.from) { portalCarry(PORTAL.from, BUNK.fadeTo); PORTAL.from = null; }   // F5.16
    }
    const o = BUNK.fadeT > F ? 1 - (BUNK.fadeT - F) / F : BUNK.fadeT / F;
    if (UI.fade) UI.fade.style.opacity = Math.max(0, Math.min(1, o)).toFixed(3);
  }
}
// F5.16: portal Templo ↔ Calamar (CONFIG.PORTAL). Al principio no hay portal: en el templo hay una tumba. Un tiro
// (traceShot/tracePierce -> shootTomb) la hace sangrar `bleed` s y se convierte en los dos arcos (templo y
// calamar). F cerca de un arco: fundido de la escotilla (BUNK.fadeT) y aparecés en `out` del otro, con `cooldown`
// s de espera. Los que te perseguían (a menos de `carry` m, no bosses) salen del piso cerca del otro arco
const PORTAL = { arcs: [], open: false, bleedT: 0, dripT: 0, cd: 0, tomb: null, tombHit: null, pool: null, from: null };
function portalOn() { return PORTAL.open; }
function buildPortals() {
  const P = CONFIG.PORTAL, mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  for (const key of ['temple', 'squid']) {
    const S = P[key], mb = new MeshBuilder();
    mb.setFrame(S.x, 0, S.z, S.rot);
    for (const s of [-1, 1]) {                                        // columnas talladas
      mb.box(s * 1.35, 1.4, 0, 0.5, 2.8, 0.6, 0x5a5a52);
      mb.box(s * 1.35, 0.1, 0, 0.8, 0.2, 0.9, 0x4a4a44);
      for (let k = 0; k < 4; k++) mb.box(s * 1.35, 0.5 + k * 0.6, 0.31, 0.3, 0.12, 0.02, 0x2a6a4a);   // glifos
    }
    mb.box(0, 2.95, 0, 3.3, 0.4, 0.7, 0x5a5a52); mb.box(0, 3.25, 0, 1, 0.3, 0.5, 0x3a8a6a);   // dintel
    mb.setFrame(null);
    const arc = mb.mesh(mat); if (arc) { arc.userData.theme = false; arc.updateMatrix(); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.12, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x3aff9a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.95, 20),
      new THREE.MeshBasicMaterial({ color: 0x1a8a6a, transparent: true, opacity: 0.4, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    for (const o of [ring, core]) { o.position.set(S.x, 1.45, S.z); o.rotation.y = S.rot; scene.add(o); }
    PORTAL.arcs.push({ key, S, arc, ring, core });
  }
  // la tumba: lápida de piedra con cruz, montículo de tierra; su caja de tiro (sin collider) en hitMeshes
  const S = P.temple, tb = new MeshBuilder();
  tb.setFrame(S.x, 0, S.z, S.rot);
  tb.box(0, 0.15, 0.9, 1.1, 0.3, 2.0, 0x4a3a28);                       // montículo
  tb.box(0, 0.75, -0.15, 0.95, 1.5, 0.25, 0x6a6a62);                   // lápida
  tb.box(0, 1.55, -0.15, 0.55, 0.18, 0.26, 0x5a5a54);
  tb.box(0, 1.1, -0.01, 0.1, 0.55, 0.02, 0x2a2a28); tb.box(0, 1.2, -0.01, 0.34, 0.1, 0.02, 0x2a2a28);   // cruz tallada
  for (let k = 0; k < 5; k++) tb.box(-0.5 + k * 0.25, 0.32, 0.4 + (k % 2) * 0.9, 0.12, 0.05, 0.12, 0xd8d0b8);   // huesitos
  tb.setFrame(null);
  PORTAL.tomb = tb.mesh(mat); if (PORTAL.tomb) { PORTAL.tomb.userData.theme = false; PORTAL.tomb.updateMatrix(); }
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.7, 0.5), new THREE.MeshBasicMaterial());
  hit.visible = false; hit.position.set(S.x, 0.85, S.z); hit.rotation.y = S.rot; hit.userData = { type: 'tomb' };
  scene.add(hit); PORTAL.tombHit = hit;
  PORTAL.pool = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0x4a0808, transparent: true, opacity: 0.85, depthWrite: false }));
  PORTAL.pool.rotation.x = -Math.PI / 2; PORTAL.pool.position.set(S.x, 0.03, S.z); PORTAL.pool.visible = false;
  scene.add(PORTAL.pool);
  resetPortals();
}
function resetPortals() {
  PORTAL.open = false; PORTAL.bleedT = 0; PORTAL.cd = 0; PORTAL.from = null;
  for (const A of PORTAL.arcs) { A.arc.visible = A.ring.visible = A.core.visible = false; }
  if (PORTAL.tomb) PORTAL.tomb.visible = true;
  if (PORTAL.pool) { PORTAL.pool.visible = false; PORTAL.pool.scale.setScalar(0.01); }
  if (PORTAL.tombHit && !WORLD.hitMeshes.includes(PORTAL.tombHit)) WORLD.hitMeshes.push(PORTAL.tombHit);
}
// un tiro a la tumba: sangra y después se abre el portal. true = le pegó a la tumba cerrada
function shootTomb() {
  if (PORTAL.open || PORTAL.bleedT > 0) return false;
  PORTAL.bleedT = CONFIG.PORTAL.bleed; PORTAL.dripT = 0;
  PORTAL.pool.visible = true;
  sfxThunder();
  return true;
}
function openPortals() {
  PORTAL.open = true; PORTAL.bleedT = 0;
  PORTAL.tomb.visible = false;
  const i = WORLD.hitMeshes.indexOf(PORTAL.tombHit); if (i >= 0) WORLD.hitMeshes.splice(i, 1);
  for (const A of PORTAL.arcs) { A.arc.visible = A.ring.visible = A.core.visible = true; }
  showBanner('A PORTAL OPENED', 3);
  sfxShieldTake();
}
function portalNear(room, px, pz, bd) {
  if (!PORTAL.open) return null;
  const P = CONFIG.PORTAL;
  for (const A of PORTAL.arcs) {
    if (!room || room.id !== A.S.room) continue;
    const d = Math.hypot(px - A.S.x, pz - A.S.z);
    if (d < Math.min(bd, P.use)) return { target: { portal: A.key }, dist: d };
  }
  return null;
}
function portalPrompt(t) {
  if (PORTAL.cd > 0) return { text: 'The portal is recharging...', cost: 0 };
  return { text: t.portal === 'temple' ? '[F] Travel to Squid Beach' : '[F] Travel to the Temple', cost: 0 };
}
function usePortal(t) {
  if (!PORTAL.open || PORTAL.cd > 0 || BUNK.fadeT > 0) return false;
  const P = CONFIG.PORTAL, F = CONFIG.BUNKER.fade;
  BUNK.fadeTo = t.portal === 'temple' ? P.squid.out : P.temple.out;
  PORTAL.from = t.portal === 'temple' ? P.temple : P.squid;
  BUNK.fadeT = F * 2; BUNK.fadeDone = false;
  PORTAL.cd = F * 2 + P.cooldown;                                    // se cuenta desde que llegás
  sfxShieldTake();
  return true;
}
// los que te perseguían salen del piso alrededor del arco de llegada (celdas navegables, anillo de 3 a 7 m)
function portalCarry(from, to) {
  const P = CONFIG.PORTAL;
  let k = 0;
  for (const z of state.zombies) {
    if (!z.active || !z.alive || z.boss || z.climb || (z.level || 0) !== 0) continue;
    if (z.state !== 'walk' && z.state !== 'emerge') continue;
    if (Math.hypot(z.px - from.x, z.pz - from.z) > P.carry) continue;
    for (let tries = 0; tries < 24; tries++, k++) {
      const a = k * 2.399, r = 3 + (k % 5);
      const x = to[0] + Math.cos(a) * r, zz = to[1] + Math.sin(a) * r;
      if (isNav(Math.floor(x), Math.floor(zz))) { resetZombie(z, { x: Math.floor(x) + 0.5, z: Math.floor(zz) + 0.5 }, true); k++; break; }
    }
  }
}
function updatePortals(dt, t) {
  PORTAL.cd = Math.max(0, PORTAL.cd - dt);
  if (PORTAL.bleedT > 0) {                                           // la tumba sangra
    PORTAL.bleedT -= dt; PORTAL.dripT -= dt;
    const k = 1 - Math.max(0, PORTAL.bleedT) / CONFIG.PORTAL.bleed;
    PORTAL.pool.scale.setScalar(0.2 + 1.6 * k);
    if (PORTAL.dripT <= 0 && typeof spawnBloodDecalAt === 'function') {
      PORTAL.dripT = 0.12;
      const S = CONFIG.PORTAL.temple;
      spawnBloodDecalAt({ point: new THREE.Vector3(S.x, 1.5, S.z) }, true, null);
    }
    if (PORTAL.bleedT <= 0) openPortals();
  }
  if (!PORTAL.open) return;
  for (const A of PORTAL.arcs) {
    A.ring.rotation.z = t * 1.6;
    A.ring.material.opacity = (PORTAL.cd > 0 ? 0.35 : 0.75) + 0.2 * Math.sin(t * 4);
    A.core.material.opacity = (PORTAL.cd > 0 ? 0.15 : 0.35) + 0.15 * Math.sin(t * 3);
  }
}
// F5.17 (Diego): el caparazón de una tortuga gigante en lugar de la estación de policía (CONFIG.SHELL). Cúpula de
// placas afuera y de hueso y carne adentro, armadas a mano (anillos × gajos) para dejar los huecos: la boca, las 4
// patas y la cola (con escombros y baba) y el tragaluz y dos placas rotas arriba. Adentro: la columna y las
// costillas pegadas a la cúpula (como en una tortuga de verdad), el entrepiso de andamios, sangre verde que brilla
// (MeshBasic: ninguna luz nueva) con gotas que caen, y los 3 zombies comiéndose a un policía (solo dibujo: al
// abrirse la barricada D21 se paran y salen 3 zombies de verdad donde estaban, extra de la ronda)
const POLICE = { feeders: [], woke: false };
const SHELLFX = { goo: null, halo: null, drops: [], dropMesh: null, shafts: [], eyes: null };
function buildShell() {
  const S = CONFIG.SHELL, A = S.a, B = S.b, H = S.h, cx = S.x, cz = S.z, T = 0.55, rr = mulberry(55);
  const ex = new MeshBuilder(), inn = new MeshBuilder(), bn = new MeshBuilder(), goo = new MeshBuilder(), wd = new MeshBuilder(),
        lf = new MeshBuilder(), rk = new MeshBuilder(), mb = new MeshBuilder(), halo = new MeshBuilder();
  const PMAX = S.skylight, NP = 18, NT = 72;
  // ---- texturas: placas del caparazón (1/8 de la vuelta, todo el alto) y carne con venas ----
  const scutes = makeTexWH(256, 512, (c, w, h) => {
    c.fillStyle = '#3a2e1c'; c.fillRect(0, 0, w, h);
    const plate = (pts, base) => {
      const cxp = pts.reduce((a, p) => a + p[0], 0) / pts.length, cyp = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      for (let k = 0; k < 6; k++) {                                   // anillos de crecimiento hacia el centro
        const f = 1 - k * 0.15, col = ['#5a4626', '#6a5430', '#5e4a2a', '#7a6438', '#6e5a34', '#86703e'][k];
        c.fillStyle = k === 0 ? base : col; c.beginPath();
        pts.forEach((p, i) => { const x = cxp + (p[0] - cxp) * f, y = cyp + (p[1] - cyp) * f; i ? c.lineTo(x, y) : c.moveTo(x, y); });
        c.closePath(); c.fill();
      }
      c.strokeStyle = '#1e160c'; c.lineWidth = 7; c.beginPath();
      pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.stroke();
    };
    for (let k = 0; k < 3; k++) plate([[k * 85 + 4, 448], [k * 85 + 81, 448], [k * 85 + 81, 508], [k * 85 + 4, 508]], '#4a3a20');   // marginales
    plate([[20, 196], [128, 180], [236, 196], [250, 320], [236, 444], [20, 444], [6, 320]], '#56442a');                   // costal
    plate([[-108, 8], [0, -10], [108, 8], [118, 100], [108, 192], [-108, 192]], '#5a4a2c');                                // vertebral (partida:
    plate([[148, 8], [256, -10], [364, 8], [374, 100], [364, 192], [148, 192]], '#5a4a2c');                                //  las dos mitades)
    noise(c, w, 26, 0, h);
    for (let i = 0; i < 40; i++) { c.fillStyle = ['rgba(150,160,110,.35)', 'rgba(90,110,60,.3)', 'rgba(200,190,150,.25)'][i % 3];
      c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 9, 0, 7); c.fill(); }             // líquenes
  });
  const flesh = makeTex((c, s) => {
    c.fillStyle = '#8a6a5a'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 30; i++) { c.fillStyle = ['rgba(120,70,60,.4)', 'rgba(200,170,150,.3)', 'rgba(60,40,30,.35)'][i % 3];
      c.beginPath(); c.ellipse(Math.random() * s, Math.random() * s, 6 + Math.random() * 18, 3 + Math.random() * 8, Math.random() * 3, 0, 7); c.fill(); }
    c.strokeStyle = 'rgba(70,20,20,.55)'; c.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) { let x = Math.random() * s, y = Math.random() * s; c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.5) * 30; c.lineTo(x, y); } c.stroke(); }
    noise(c, s, 22);
  }, 1, 128);
  flesh.repeat.set(1, 1);
  // ---- la cúpula: punto, normal y huecos ----
  const rad = (ph, inner) => [inner ? A - T : A, inner ? H - T : H, inner ? B - T : B];
  const flare = ph => 1 + 0.06 * Math.max(0, 1 - ph / 0.22);         // el borde se abre un poco (placas marginales)
  const pt = (ph, th, inner) => { const [a, h, b] = rad(ph, inner), r = Math.cos(ph) * flare(ph);
    return [cx + a * r * Math.cos(th), h * Math.sin(ph), cz + b * r * Math.sin(th)]; };
  const nrm = (p, inner) => { const [a, h, b] = rad(0, inner), x = (p[0] - cx) / (a * a), y = p[1] / (h * h), z = (p[2] - cz) / (b * b), l = Math.hypot(x, y, z) * (inner ? -1 : 1);
    return [x / l, y / l, z / l]; };
  const legTh = [-Math.PI / 2 - 0.78, -Math.PI / 2 + 0.78, Math.PI / 2 - 0.8, Math.PI / 2 + 0.8];
  const legs = legTh.map(th => [cx + A * Math.cos(th), cz + B * Math.sin(th)]);
  const broken = [pt(1.02, 0.35), pt(0.95, 3.55)];
  const hole = (x, y, z) => {
    const dx = x - cx, dz = z - cz;
    if (dz < 0 && (dx / 2.3) ** 2 + (y / 3.45) ** 2 < 1) return 'mouth';
    for (const [lx, lz] of legs) if (((x - lx) / 2.0) ** 2 + (y / 2.1) ** 2 + ((z - lz) / 2.0) ** 2 < 1) return 'leg';
    if (dz > 0 && (dx / 1.5) ** 2 + (y / 1.9) ** 2 < 1) return 'tail';
    for (const b of broken) if ((x - b[0]) ** 2 + (y - b[1]) ** 2 + (z - b[2]) ** 2 < 1.6) return 'broken';
    return null;
  };
  for (let i = 0; i < NP; i++) for (let j = 0; j < NT; j++) {
    const p0 = i / NP * PMAX, p1 = (i + 1) / NP * PMAX, t0 = j / NT * Math.PI * 2, t1 = (j + 1) / NT * Math.PI * 2;
    for (const inner of [false, true]) {
      const q = [pt(p0, t0, inner), pt(p0, t1, inner), pt(p1, t1, inner), pt(p1, t0, inner)];
      const m = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2, (q[0][2] + q[2][2]) / 2];
      if (hole(m[0], m[1], m[2])) continue;
      const n = q.map(p => nrm(p, inner));
      if (!inner) {
        const top = (p0 + p1) / 2 / PMAX, moss = top > 0.55 && rr() < 0.35, dirt = top < 0.12;
        const col = moss ? 0xa8c090 : dirt ? 0xb0a490 : [0xffffff, 0xf2eadc, 0xe6dccb][(i + j) % 3];
        const uv = [[t0 / (Math.PI * 2) * 8, p0 / PMAX], [t1 / (Math.PI * 2) * 8, p0 / PMAX], [t1 / (Math.PI * 2) * 8, p1 / PMAX], [t0 / (Math.PI * 2) * 8, p1 / PMAX]];
        ex.quadN(q, n, uv, col);
      } else {
        const uv = [[t0 * 3, p0 * 4], [t1 * 3, p0 * 4], [t1 * 3, p1 * 4], [t0 * 3, p1 * 4]];
        inn.quadN(q, n, uv, [0xb89484, 0xa88474, 0xc0a090][(i * 3 + j) % 3]);
      }
    }
  }
  // borde del tragaluz y de las placas rotas: aro de hueso (tapa el grosor entre las dos caras)
  for (let j = 0; j < 24; j++) { const th = j / 24 * Math.PI * 2, p = pt(PMAX, th); bn.blob(p[0], p[1] - 0.1, p[2], 0.6, 0.4, 0.6, 0xd8ccb0, j); }
  for (const b of broken) for (let j = 0; j < 9; j++) { const a = j / 9 * Math.PI * 2;
    rk.rock(b[0] + Math.cos(a) * 1.25, b[1] - 0.1, b[2] + Math.sin(a) * 1.25, 0.45, 0.3, 0.45, 0x6a5a3a, j, rr(), rr() * 3, rr()); }
  // placas marginales: el borde festoneado de afuera
  for (let j = 0; j < 44; j++) {
    const th = j / 44 * Math.PI * 2, p = pt(0.07, th);
    if (hole(p[0], 0.4, p[2])) continue;
    rk.blob(p[0], 0.4, p[2], 1.0, 0.5, 1.0, [0x6a5638, 0x5e4c30, 0x74603e][j % 3], j, 0, -th, 0);
  }
  // labio de la boca, escombros y baba en las patas y la cola
  const lip = [];                                                        // labio liso de la boca (tapa el grosor de la cúpula)
  for (let k = 0; k <= 16; k++) {
    const ps = k / 16 * Math.PI, x = cx + 2.4 * Math.cos(ps), y = Math.max(0.05, 3.5 * Math.sin(ps)), rz = 1 - ((x - cx) / A) ** 2 - (y / H) ** 2;
    const z = cz - B * Math.sqrt(Math.max(0, rz)) + 0.3;
    lip.push([x, y, z]);
    if (k > 3 && k < 13 && k % 2) lf.card(x, y - 1.3, z - 0.3, 0.45, 1.3, 0, 0, 0, 'moss', 0xffffff);
  }
  rk.tube(lip, 0.38, 0.38, 0x5e4c34, 32, 8);
  for (const sd of [-1, 1]) rk.rock(cx + sd * 2.7, 0, lip[0][2] - 0.1, 0.7, 0.8, 0.7, 0x6a5a44, sd + 3, 0, sd, 0);
  for (const [lx, lz] of legs) {
    const dx = lx - cx, dz = lz - cz, l = Math.hypot(dx, dz), ox = dx / l, oz = dz / l;
    for (let k = 0; k < 3; k++) {                                    // el hueco tapado de escombros (se ve que no se pasa)
      const f = k - 1;
      rk.rock(lx + oz * f * 1.25, 0, lz - ox * f * 1.25, 0.95, 1.9 - Math.abs(f) * 0.5, 0.95, [0x7a6a50, 0x6a5a44, 0x8a7a5e][k], k + 2, 0, rr() * 3, 0);
    }
    for (let k = 0; k < 7; k++) rk.rock(lx + ox * (rr() * 1.2 - 0.2) + oz * (rr() - 0.5) * 3, 1.2 * rr(), lz + oz * (rr() * 1.2 - 0.2) - ox * (rr() - 0.5) * 3,
      0.4 + rr() * 0.5, 0.35 + rr() * 0.6, 0.4 + rr() * 0.5, [0x7a6a50, 0x6a5a44, 0x8a7a5e][k % 3], k, rr(), rr() * 3, rr());
    goo.blob(lx + ox * 1.6, 0.03, lz + oz * 1.6, 1.3, 0.08, 1.1, 0xffffff, 1);              // baba que sale
    goo.tube([[lx, 1.4, lz], [lx + ox * 0.8, 0.7, lz + oz * 0.8], [lx + ox * 1.5, 0.08, lz + oz * 1.5]], 0.14, 0.06, 0xffffff, 6, 5);
    halo.add(UNIT_PLANE, lx + ox * 1.6, 0.06, lz + oz * 1.6, 4, 4, 1, -Math.PI / 2, 0, 0, 0xffffff);
  }
  { const tx = cx, tz = cz + B;                                                            // cola
    for (let k = 0; k < 3; k++) rk.rock(tx + (k - 1) * 1.05, 0, tz + 0.1, 0.85, 1.75 - Math.abs(k - 1) * 0.4, 0.8, 0x74644c, k + 5, 0, rr() * 3, 0);
    for (let k = 0; k < 5; k++) rk.rock(tx + (rr() - 0.5) * 2.6, 0.8 * rr(), tz + 0.3 + rr() * 0.8, 0.4 + rr() * 0.4, 0.4 + rr() * 0.5, 0.4 + rr() * 0.4, 0x6a5a44, k + 3, rr(), rr() * 3, rr());
    goo.blob(tx, 0.03, tz + 1.4, 1.6, 0.08, 1.2, 0xffffff, 2); halo.add(UNIT_PLANE, tx, 0.06, tz + 1.4, 4.5, 4.5, 1, -Math.PI / 2, 0, 0, 0xffffff); }
  // musgo, pasto y lianas sobre la cúpula; percebes abajo
  const surfPlane = (B2, p, n, w, reg, col) => {
    _mbQ.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(n[0], n[1], n[2]));
    _mbL.compose(new THREE.Vector3(p[0] + n[0] * 0.04, p[1] + n[1] * 0.04, p[2] + n[2] * 0.04), _mbQ, new THREE.Vector3(w, w, 1));
    B2.addM(UNIT_PLANE, _mbL, col, FOLI.r[reg]);
  };
  for (let k = 0; k < 70; k++) {
    const ph = 0.45 + rr() * (PMAX - 0.5), th = rr() * Math.PI * 2, p = pt(ph, th), n = nrm(p, false);
    if (hole(p[0], p[1], p[2])) continue;
    if (k % 3) surfPlane(lf, p, n, 1.6 + rr() * 1.8, 'ivy', 0xe0ecd0);
    else lf.clump(p[0], p[1] - 0.15, p[2], 0.9 + rr() * 0.6, 0.6 + rr() * 0.5, k % 2 ? 'grass' : 'fern', 0xe8f0d8, rr() * 3);
  }
  for (let k = 0; k < 26; k++) {                                                           // lianas colgando del borde
    const th = rr() * Math.PI * 2, p = pt(0.35 + rr() * 0.3, th);
    if (hole(p[0], p[1], p[2])) continue;
    const L = 1.2 + rr() * 2.2;
    lf.card(p[0] + Math.cos(th) * 0.3, p[1] - L, p[2] + Math.sin(th) * 0.3, 0.5, L, 0, -th + Math.PI / 2, 0, k % 3 ? 'vine' : 'moss', 0xffffff);
  }
  for (let k = 0; k < 60; k++) {
    const ph = 0.05 + rr() * 0.3, th = rr() * Math.PI * 2, p = pt(ph, th);
    if (hole(p[0], p[1], p[2])) continue;
    rk.rock(p[0], p[1], p[2], 0.12 + rr() * 0.12, 0.1 + rr() * 0.1, 0.12 + rr() * 0.12, 0xd8d0c0, k);   // percebes
  }
  // ---- adentro: columna y costillas pegadas a la cúpula ----
  const Ai = A - T - 0.15, Hi = H - T - 0.15, Bi = B - T - 0.15, spine = [];
  for (let k = 0; k <= 22; k++) {
    const u = -0.92 + k / 22 * 1.84, z = cz + Bi * u, kz = Math.sqrt(Math.max(0, 1 - u * u)), y = Hi * kz;
    spine.push([cx, y, z]);
    bn.blob(cx, y - 0.1, z, 0.5, 0.32, 0.36, 0xe0d4b8, k);                                  // vértebras
    if (k % 2 === 0 && k > 1 && k < 21) {                                                  // costillas a los dos lados
      for (const sd of [-1, 1]) {
        const pts = [];
        for (let q = 0; q <= 6; q++) { const ps = Math.PI / 2 - q / 6 * (Math.PI / 2 - 0.12); pts.push([cx + sd * Ai * kz * Math.cos(ps), Hi * kz * Math.sin(ps) - 0.05, z]); }
        bn.tube(pts, 0.2, 0.09, 0xd8ccb0, 10, 6);
        if (k % 4 === 0) {                                                                 // baba que chorrea de la costilla
          const d = pts[2 + (k % 3)], L = 0.6 + rr() * 1.4;
          goo.tube([[d[0], d[1], d[2]], [d[0], d[1] - L * 0.6, d[2]], [d[0], d[1] - L, d[2]]], 0.07, 0.04, 0xffffff, 4, 5);
          goo.sphere(d[0], d[1] - L - 0.05, d[2], 0.09, 0.13, 0.09, 0xffffff, 6);
          SHELLFX.drops.push({ x: d[0], z: d[2], y0: d[1] - L - 0.1, y: d[1] - L - 0.1 - rr() * 3, v: 0 });
        }
      }
    }
  }
  bn.tube(spine, 0.22, 0.22, 0xcfc2a4, 40, 6);
  // venas verdes por la cúpula y chorros que bajan hasta el piso
  const onIn = (ph, th, d) => { const p = pt(ph, th, true), n = nrm(p, true); return [p[0] + n[0] * d, p[1] + n[1] * d, p[2] + n[2] * d]; };
  for (let k = 0; k < 14; k++) {
    let ph = 0.25 + rr() * 0.9, th = rr() * Math.PI * 2; const pts = [];
    for (let q = 0; q < 6; q++) { pts.push(onIn(ph, th, 0.04)); ph += (rr() - 0.5) * 0.18; th += (rr() - 0.5) * 0.2; }
    if (hole(...pts[0]) || hole(...pts[5])) continue;
    goo.tube(pts, 0.035, 0.02, 0xb8d8a8, 12, 4);
  }
  for (let k = 0; k < 9; k++) {
    const th = rr() * Math.PI * 2, pts = [];
    for (let q = 0; q <= 7; q++) pts.push(onIn(1.05 - q / 7 * 1.03, th + Math.sin(q * 1.3 + k) * 0.05, 0.08));
    if (pts.some(p => hole(...p))) continue;
    goo.tube(pts, 0.07, 0.13, 0xffffff, 14, 5);
    const b = pts[7]; goo.blob(b[0] * 0.97 + cx * 0.03, 0.03, b[2] * 0.97 + cz * 0.03, 1.1, 0.07, 1.1, 0xffffff, k);
    halo.add(UNIT_PLANE, b[0], 0.07, b[2], 3.2, 3.2, 1, -Math.PI / 2, 0, 0, 0xffffff);
  }
  // piso de adentro: tierra oscura y húmeda, con charcos de baba, huesos y papeles
  const floorG = new THREE.CircleGeometry(1, 56).rotateX(-Math.PI / 2);
  mb.add(floorG, cx, 0.03, cz, A - T - 0.05, 1, B - T - 0.05, 0, 0, 0, 0x4a4034);
  for (const [px, pz, w] of [[-53, 82.5, 2.4], [-49, 80, 1.6], [-56, 86, 1.8], [-46, 76.5, 1.5], [-51, 89, 2.2], [-59.5, 79, 1.4], [-43, 84, 1.6]]) {
    goo.blob(px, 0.035, pz, w, 0.06, w * 0.8, 0xffffff, Math.round(px));
    halo.add(UNIT_PLANE, px, 0.08, pz, w * 2.6, w * 2.6, 1, -Math.PI / 2, 0, 0, 0xffffff);
  }
  const bone = 0xe0d8c0;
  for (let k = 0; k < 22; k++) {
    const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * 0.85, x = cx + Math.cos(a) * d * (A - 2), z = cz + Math.sin(a) * d * (B - 2);
    if (x > S.ramp.x1 - 0.5 && x < S.ramp.x2 && z > S.ramp.z1 - 0.3 && z < S.ramp.z2 + 0.3) continue;
    if (k % 3 === 0) { rk.sphere(x, 0.12, z, 0.12, 0.11, 0.14, bone, 8, 0.3, a, 0); rk.box(x + Math.sin(a) * 0.08, 0.05, z + Math.cos(a) * 0.08, 0.14, 0.05, 0.1, bone, 0, a, 0); }
    else if (k % 3 === 1) rk.seg([x - Math.sin(a) * 0.3, 0.04, z - Math.cos(a) * 0.3], [x + Math.sin(a) * 0.3, 0.04, z + Math.cos(a) * 0.3], 0.03, 0.03, bone, 5);
    else mb.box(x, 0.035, z, 0.25, 0.01, 0.32, 0xe8e4d8, 0, a, 0);                          // papeles de la policía
  }
  // ---- entrepiso de andamios: postes de tronco, vigas, tablas de abajo y cruces ----
  const [ox1, ox2, oz1, oz2] = S.deck.outer, [ix1, ix2, iz1, iz2] = S.deck.inner, Y = UP.y, log = 0x9a7a58, logD = 0x6a4e34, ud = new MeshBuilder();
  for (const [x, z] of S.posts) { wd.cyl(x, 0, z, 0.15, Y - 0.3, log, 0.9, 8); wd.cyl(x, Y - 0.7, z, 0.17, 0.1, 0xc8a870, 1, 8); }
  for (const z of [oz1 + 0.15, iz1 - 0.1, iz2 + 0.1, oz2 - 0.15]) wd.seg([ox1, Y - 0.42, z], [ox2, Y - 0.42, z], 0.12, 0.12, logD, 7);
  for (const x of [ox1 + 0.15, ix1 - 0.1, ix2 + 0.1, ox2 - 0.15]) wd.seg([x, Y - 0.42, oz1], [x, Y - 0.42, oz2], 0.12, 0.12, logD, 7);
  for (const [x1, x2, z1, z2] of [[ox1, ox2, oz1, iz1], [ox1, ox2, iz2, oz2], [ox1, ix1, iz1, iz2], [ix2, ox2, iz1, iz2]])
    for (let q = 0; q < 6; q++) ud.box((x1 + x2) / 2, Y - 0.29 - q * 0.001, z1 + (z2 - z1) * (q + 0.5) / 6, x2 - x1 - 0.05, 0.02, (z2 - z1) / 6 - 0.04, [0x8a6440, 0x7a5a38, 0x94704a][q % 3]);
  for (const [a, b] of [[[ox1, oz1], [ox1, oz2]], [[ox2, oz1], [ox2, oz2]], [[ox1, oz2], [ox2, oz2]]]) {   // cruces de San Andrés en los lados
    const n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3.4);
    for (let q = 0; q < n; q++) {
      const f0 = q / n, f1 = (q + 1) / n, p0 = [a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0], p1 = [a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1];
      wd.seg([p0[0], 0.3, p0[1]], [p1[0], Y - 0.6, p1[1]], 0.05, 0.05, logD, 5);
      wd.seg([p1[0], 0.3, p1[1]], [p0[0], Y - 0.6, p0[1]], 0.05, 0.05, logD, 5);
    }
  }
  // escalera abierta del hueco al lado este (UP.flights con open: el techo no la dibuja maciza)
  { const R = S.ramp, n = R.steps, run = (R.x2 - R.x1) / n;
    for (let q = 0; q < n; q++) {
      const x = R.x1 + (q + 0.5) * run, y = (q + 1) * Y / n;
      wd.box(x, y - 0.04, (R.z1 + R.z2) / 2, run + 0.06, 0.08, R.z2 - R.z1 - 0.1, [0x9a7048, 0x8a6440][q % 2]);
    }
    for (const z of [R.z1 + 0.05, R.z2 - 0.05]) {
      wd.seg([R.x1 - 0.2, 0, z], [R.x2, Y - 0.05, z], 0.07, 0.07, logD, 6);                          // zancas
      wd.seg([R.x1, 1.0, z], [R.x2, Y + 0.95, z], 0.035, 0.035, log, 5);                             // pasamanos
      for (let q = 0; q <= 4; q++) { const x = R.x1 + (R.x2 - R.x1) * q / 4, y = Y * q / 4; wd.seg([x, y, z], [x, y + 1.0, z], 0.03, 0.03, log, 5); }
    }
  }
  // faroles de obra colgando del entrepiso (MeshBasic: brillan sin luz) y un generador portátil de la policía
  const bulb = new MeshBuilder();
  for (const [x, z] of [[ox1 + 0.4, oz1 + 0.4], [ox2 - 0.4, oz2 - 0.4], [ox2 - 0.4, oz1 + 0.4], [ox1 + 0.4, oz2 - 0.4]]) {
    wd.seg([x, Y - 0.45, z], [x, Y - 1.1, z], 0.01, 0.01, 0x222222, 3);
    mb.cyl(x, Y - 1.25, z, 0.16, 0.2, 0x2a2a2a, 0.55, 8);
    bulb.sphere(x, Y - 1.3, z, 0.09, 0.11, 0.09, 0xffe2a0, 6);
  }
  // policías muertos (3 adentro, 2 afuera) y el que se están comiendo
  const blood = 0x5a0a08, navy = 0x1e2a44, skin = 0xc89a7a;
  const deadCop = (x, z, r) => {
    mb.blob(x, 0.02, z, 1.0, 0.02, 0.8, blood, 3, 0, r, 0);
    mb.box(x, 0.16, z, 0.5, 0.28, 1.0, navy, 0, r, 0);
    mb.sphere(x + Math.sin(r) * 0.65, 0.15, z + Math.cos(r) * 0.65, 0.15, 0.14, 0.16, skin, 8);
    mb.box(x - Math.sin(r) * 0.8, 0.1, z - Math.cos(r) * 0.8, 0.4, 0.18, 0.6, 0x1a1e2a, 0, r, 0);
    mb.cyl(x + Math.cos(r) * 0.6, 0.02, z - Math.sin(r) * 0.6, 0.16, 0.08, 0x141a2a, 0.8, 8);              // gorra
    mb.box(x + 0.2, 0.31, z + 0.1, 0.06, 0.02, 0.08, 0xd8c040, 0, r, 0);                                    // placa
    mb.box(x - Math.cos(r) * 0.5, 0.03, z + Math.sin(r) * 0.5, 0.22, 0.05, 0.08, 0x1a1a1a, 0, r + 0.8, 0);  // pistola
  };
  for (const [x, z, r] of S.bodies) deadCop(x, z, r);
  const [kx, kz] = S.cop;
  mb.blob(kx, 0.02, kz, 1.3, 0.02, 1.1, blood, 4);
  mb.box(kx, 0.14, kz, 0.5, 0.24, 1.0, navy, 0, 0.3, 0); mb.sphere(kx + 0.2, 0.14, kz + 0.62, 0.15, 0.14, 0.16, skin, 8);
  mb.tube([[kx - 0.4, 0.06, kz - 0.3], [kx - 0.1, 0.1, kz - 0.1], [kx - 0.3, 0.07, kz + 0.2], [kx - 0.6, 0.06, kz + 0.05]], 0.05, 0.05, 0x8a1a14, 10, 5);   // tripas
  // ---- afuera: jeep de la policía volcado, cinta de cuarentena, caballetes, cartel de peligro ----
  const J = S.jeep, jx = (J[0] + J[1]) / 2, jz = (J[2] + J[3]) / 2, jw = J[1] - J[0], jl = J[3] - J[2];
  mb.box(jx, 0.75, jz, jw, 0.9, jl, 0xe8e8e4, 0.04, 0, 0.06);
  mb.box(jx, 0.8, jz, jw + 0.02, 0.18, jl + 0.02, 0x1e2a44, 0.04, 0, 0.06);                                 // franja azul
  mb.box(jx, 1.45, jz + 0.3, jw - 0.2, 0.55, jl * 0.5, 0x2a2e34, 0.04, 0, 0.06);
  mb.box(jx, 1.78, jz + 0.2, 0.9, 0.12, 0.25, 0xc82020, 0.04, 0, 0.06); mb.box(jx + 0.25, 1.79, jz + 0.2, 0.4, 0.12, 0.26, 0x2040d8, 0.04, 0, 0.06);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mb.cyl(jx + sx * (jw / 2 + 0.02), 0.38, jz + sz * (jl / 2 - 0.8), 0.38, 0.28, 0x151515, 1, 12, 0, 0, Math.PI / 2);
  mb.box(jx - jw / 2 - 0.5, 0.9, jz - 0.4, 0.06, 0.8, 1.0, 0xe8e8e4, 0, 0.9, 0);                            // puerta abierta
  for (const [x, z] of [[-55.5, 68.6], [-46.5, 68.6], [-59, 67]]) {                                         // caballetes
    wd.seg([x - 0.7, 0.9, z], [x + 0.7, 0.9, z], 0.05, 0.05, 0xf0f0f0, 5);
    for (const sx of [-0.6, 0.6]) { wd.seg([x + sx, 0, z - 0.3], [x + sx, 0.95, z], 0.03, 0.03, 0x6a6a6a, 4); wd.seg([x + sx, 0, z + 0.3], [x + sx, 0.95, z], 0.03, 0.03, 0x6a6a6a, 4); }
  }
  for (const [a, b] of [[[-59, 67], [-55.5, 68.6]], [[-55.5, 68.6], [-53.3, 70.2]], [[-48.7, 70.2], [-46.5, 68.6]]])   // cinta
    mb.seg([a[0], 0.85, a[1]], [b[0], 0.8, b[1]], 0.025, 0.025, 0xf0d020, 3);
  // barricada D21 (hija del bloque invisible de la puerta: al abrirse se va con él)
  const D = S.door, dm = new MeshBuilder(), dcx = (D.x1 + D.x2) / 2;
  for (let q = 0; q < 3; q++) dm.box(dcx, 0.3 + q * 0.38, D.z, D.x2 - D.x1 + 0.4, 0.22, 0.08, [0x8a6440, 0x7a5a38, 0x6a4a2a][q], 0, 0, (q - 1) * 0.07);
  for (const sd of [-1, 1]) dm.box(dcx + sd * 1.1, 0.6, D.z, 0.1, 1.2, 0.1, 0x5a3e24, 0, 0, sd * 0.3);
  for (let q = 0; q < 7; q++) dm.blob(D.x1 + 0.3 + q * 0.57, 0.18, D.z + 0.35, 0.34, 0.2, 0.26, 0xa89868, q);   // bolsas de arena
  dm.box(dcx, 0.95, D.z - 0.06, D.x2 - D.x1 + 0.8, 0.06, 0.02, 0xf0d020, 0, 0, 0.05);                      // cinta
  const dmesh = dm.mesh(MAT.grimeV), door = state.doors[D.id];
  if (dmesh && door) { scene.remove(dmesh); dmesh.userData.theme = false; dmesh.matrixAutoUpdate = true; dmesh.position.copy(door.mesh.position).negate(); door.mesh.add(dmesh); }
  wd.cyl(-57.3, 0, 68.25, 0.04, 1.0, 0x5a5a5a, 1, 5); wd.cyl(-45, 0, 68.75, 0.04, 1.2, 0x5a5a5a, 1, 5);   // postes de los carteles
  // ---- materiales y mallas ----
  const put = (B2, mat) => { const m = B2.mesh(mat); if (m) { m.userData.theme = false; m.updateMatrix(); } return m; };
  put(ex, new THREE.MeshLambertMaterial({ map: scutes, vertexColors: true }));
  put(inn, new THREE.MeshLambertMaterial({ map: flesh, vertexColors: true, emissive: 0x1c1410 }));
  put(bn, new THREE.MeshLambertMaterial({ map: TEX.bark, vertexColors: true, emissive: 0x16140e }));
  put(wd, MAT.bark); put(lf, FOLI.mat); put(rk, MAT.rock); put(mb, MAT.grimeV);
  put(ud, new THREE.MeshLambertMaterial({ map: TEX.grime, vertexColors: true, emissive: 0x241810 }));   // tablas vistas desde abajo
  put(bulb, new THREE.MeshBasicMaterial({ vertexColors: true }));
  SHELLFX.goo = new THREE.MeshBasicMaterial({ color: CONFIG.SHELL.goo || 0x7dff4a, vertexColors: true });
  put(goo, SHELLFX.goo);
  SHELLFX.halo = new THREE.MeshBasicMaterial({ map: radialTex('rgba(150,255,110,1)', 'rgba(60,200,40,.45)'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true, opacity: 0.5 });
  put(halo, SHELLFX.halo);
  // haces de luz del tragaluz (aditivos, creados una vez)
  const shaftMat = new THREE.MeshBasicMaterial({ map: TEX.shaft, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide, opacity: 0.22, color: 0xd8ffd0 });
  for (const r of [0, Math.PI / 2]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, H - 0.5), shaftMat);
    m.position.set(cx, (H - 0.5) / 2, cz); m.rotation.y = r; m.userData.theme = false; scene.add(m); SHELLFX.shafts.push(m);
  }
  // gotas que caen (un InstancedMesh, sin crear nada en el juego)
  const dg = new THREE.SphereGeometry(0.06, 6, 4), dmat = new THREE.MeshBasicMaterial({ color: 0x9dff6a });
  SHELLFX.dropMesh = new THREE.InstancedMesh(dg, dmat, SHELLFX.drops.length);
  SHELLFX.dropMesh.userData.theme = false; scene.add(SHELLFX.dropMesh);
  // carteles: cuarentena en la boca y peligro biológico
  const sign = (t1, t2, x, y, z, ry, w, bg, fg) => {
    const tex = makeTex((c, s) => { c.fillStyle = bg; c.fillRect(0, 0, s, s); c.fillStyle = fg; c.textAlign = 'center';
      c.font = 'bold ' + Math.floor(s * 0.19) + 'px monospace'; c.fillText(t1, s / 2, s * 0.42);
      c.font = 'bold ' + Math.floor(s * 0.12) + 'px monospace'; c.fillText(t2, s / 2, s * 0.66); }, 1, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.5), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; m.userData.theme = false; scene.add(m);
  };
  sign('QUARANTINE', 'POLICE LINE', -57.3, 1.3, 68.2, 0.3, 1.3, '#f0d020', '#1a1a1a');
  sign('BIOHAZARD', 'DO NOT ENTER', -45, 1.5, 68.7, -0.2, 1.2, '#e8e8e0', '#b01818');
  // los que comen: figuras de zombie arrodilladas (un grupo por cada uno, con los brazos aparte)
  const zskin = CONFIG.ZOMBIE.skinColor;
  for (const [x, z, r] of S.feeders) {
    const g = new THREE.Group(), b = new MeshBuilder();
    b.box(0, 0.25, -0.1, 0.5, 0.3, 0.7, 0x3f3a33);                    // piernas dobladas
    b.box(0, 0.75, 0.05, 0.56, 0.62, 0.3, 0x5a4a3a, 0.45, 0, 0);       // torso inclinado
    b.box(0, 1.08, 0.32, 0.4, 0.4, 0.4, zskin, 0.3, 0, 0);             // cabeza agachada
    b.box(-0.09, 1.1, 0.53, 0.08, 0.05, 0.02, 0xffdd33); b.box(0.09, 1.1, 0.53, 0.08, 0.05, 0.02, 0xffdd33);
    b.box(0, 0.98, 0.53, 0.2, 0.06, 0.02, blood);                      // boca con sangre
    const bm = b.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); scene.remove(bm); bm.matrixAutoUpdate = true; bm.userData.theme = false; g.add(bm);
    const arms = [];
    for (const sx of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(sx * 0.36, 0.95, 0.15);
      const am = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), new THREE.MeshLambertMaterial({ color: zskin }));
      am.position.set(0, -0.28, 0); a.add(am); g.add(a); arms.push(a);
    }
    g.position.set(x, 0, z); g.rotation.y = r; scene.add(g);
    POLICE.feeders.push({ g, arms, x, z, ph: rr() * 6 });
  }
}
// la baba late, las gotas caen desde las costillas (cada una desde su punto, en loop) y los haces respiran
function updateShellFX(dt, t) {
  if (!SHELLFX.goo) return;
  const k = 0.5 + 0.5 * Math.sin(t * 2.2);
  SHELLFX.goo.color.setRGB(0.45 + 0.2 * k, 1, 0.3 + 0.15 * k);
  SHELLFX.halo.opacity = 0.35 + 0.25 * k;
  for (const s of SHELLFX.shafts) s.material.opacity = 0.16 + 0.08 * Math.sin(t * 0.7);
  const M = SHELLFX.dropMesh, o = _shellO;
  if (!M) return;
  SHELLFX.drops.forEach((d, i) => {
    d.v += 9.8 * dt; d.y -= d.v * dt;
    if (d.y < 0.05) { d.y = d.y0; d.v = 0; }
    o.position.set(d.x, d.y, d.z); o.scale.set(1, 1 + Math.min(2, d.v * 0.25), 1); o.updateMatrix();
    M.setMatrixAt(i, o.matrix);
  });
  M.instanceMatrix.needsUpdate = true;
}
const _shellO = new THREE.Object3D();
function updatePolice(dt, t) {
  updateShellFX(dt, t);                                               // F5.17
  if (!POLICE.woke) {
    for (const f of POLICE.feeders) {                                 // mastican: brazos a la boca, cabeza que tira
      const k = Math.sin(t * 5 + f.ph);
      f.arms[0].rotation.x = -1.2 + 0.5 * k; f.arms[1].rotation.x = -1.2 - 0.5 * k;
      f.g.position.y = 0.03 * Math.abs(k);
    }
    const d = state.doors[CONFIG.SHELL.door.id];
    if (d && d.open) policeWake();
  }
}
// se dan cuenta: se esconden las figuras y salen 3 zombies de verdad donde estaban, yendo por el jugador
function policeWake() {
  POLICE.woke = true;
  for (const f of POLICE.feeders) {
    f.g.visible = false;
    const q = ZPOOL.find(o => !o.active);
    if (!q) continue;
    resetZombie(q, { x: f.x, z: f.z }, false, 'normal');
    q.state = 'walk'; q.fromClam = true;                             // extra: la ronda espera a que mueran
    state.zombies.push(q);
  }
  sfxThunder();
}
function resetPolice() {
  POLICE.woke = false;
  for (const f of POLICE.feeders) f.g.visible = true;
}
function inBunker() { return groundY(player.pos.x, player.pos.z) < -1; }

function resetBunker() {
  const was = BUNK.open;
  BUNK.open = false; BUNK.fadeT = 0; BUNK.fadeTo = null;
  resetPortals();                                                                      // F5.16
  resetPolice();
  if (UI.fade) UI.fade.style.opacity = '0';
  if (BUNK.lid) {
    BUNK.halves[0].position.x = -1.1; BUNK.halves[1].position.x = 1.1;               // puertas cerradas
    BUNK.lamp.material.color.setHex(0xff2a1a); BUNK.seahorse.visible = false;
  }
  for (const s of BUNK.statues) {
    s.kills = 0; s.crawlers = 0; s.dogs = 0; s.awake = false; s.done = false; s.prey = null; s.eatT = 0;
    s.head.position.copy(s.base); s.head.rotation.set(0, (CONFIG.BUNKER.entrance.face || 1) > 0 ? 0 : Math.PI, 0);
    statueLook(s, 'stone');
  }
  if (was) buildNavGrid();                         // saca el enlace de la escotilla
}
