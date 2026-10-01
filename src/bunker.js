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
  for (const [px, pz] of B.pillars) box(px - 0.6, px + 0.6, y0, y1, pz - 0.6, pz + 0.6, 'bunker:pilar');   // F5.26
  buildBarrelSolids();                                                              // F5.26: barriles de gasolina (beast.js)
  const E = B.entrance, ey = groundY((E.x1 + E.x2) / 2, (E.z1 + E.z2) / 2);   // F5.13: la entrada (F5.28e: en la cueva, a -6)
  box(E.x1, E.x2, ey, ey + E.h, E.z1, E.z2, 'bunker:entrada');
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
  buildPlantBoss();                                                                    // F5.20: la planta jefa del templo
  buildShell();                                                                       // F5.17: el caparazón (F5.16: la estación de policía)
  const B = CONFIG.BUNKER, y0 = B.y, y1 = B.y + B.h;
  // F5.28 (Diego: "el búnker mucho más oscuro"): la luz va pintada en los colores (MeshBasic, sin luces), con los focos
  // muertos. `lit(x, z)` da el brillo de cada lugar (F5.28c: se sacaron las antorchas, es parejo: BUNKER.dark.paint)
  const paint = lit => {
  const mb = new MeshBuilder();
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
  // F5.26: el búnker creció 8 m a cada lado en x; lo que iba contra las paredes oeste/este de antes se corre con ellas
  const oz = B.z1 - 60, wx = x => x < -24 ? x + (B.x1 + 38) : x + (B.x2 + 10);
  for (const z of [B.z1 + 3, B.z2 - 3]) mb.box((B.x1 + B.x2) / 2, y1 - 0.35, z, B.x2 - B.x1 - 1, 0.2, 0.2, shade(0x5a4a3a, lit((B.x1 + B.x2) / 2, z) * 0.8));
  mb.box(B.x1 + 3, y1 - 0.35, (B.z1 + B.z2) / 2, 0.2, 0.2, B.z2 - B.z1 - 1, shade(0x5a4a3a, lit(B.x1 + 3, (B.z1 + B.z2) / 2) * 0.8));
  [[-36.6, 62, 0x6a5232], [-36.6, 63.3, 0x5a4428], [-35.4, 62, 0x6a5232], [-11.4, 83, 0x5a4428], [-12.6, 83, 0x6a5232]].forEach(([x, z, c]) =>
    mb.box(wx(x), y0 + 0.5, z + oz, 1.1, 1, 1.1, shade(c, lit(wx(x), z + oz) + 0.2)));
  [[-11.3, 61.3], [-12.4, 61.3], [-11.3, 62.4]].forEach(([x, z]) => mb.box(wx(x), y0 + 0.6, z + oz, 0.8, 1.2, 0.8, shade(0x3a5a3a, lit(wx(x), z + oz) + 0.2)));
  // F5.26: pilares de hormigón (sólidos: PROPS 'bunkerPilarN') con franjas de peligro abajo
  for (const [px, pz] of CONFIG.BUNKER.pillars) {
    const k = lit(px, pz) + 0.15;
    mb.box(px, y0 + B.h / 2, pz, 1.2, B.h, 1.2, shade(0x5e5e58, k));
    mb.box(px, y1 - 0.3, pz, 1.5, 0.6, 1.5, shade(0x4e4e4a, k));
    for (let i = 0; i < 4; i++) mb.box(px, y0 + 0.2 + i * 0.25, pz, 1.24, 0.12, 1.24, shade(i % 2 ? 0x1a1a18 : 0xd8b030, k));
  }
  const tz = 72 + oz;
  mb.box(-24, y0 + 0.8, tz, 2.4, 0.1, 1.4, shade(0x5a4030, lit(-24, tz) + 0.3));   // mesa
  for (const [x, dz] of [[-25.1, -0.6], [-22.9, -0.6], [-25.1, 0.6], [-22.9, 0.6]]) mb.box(x, y0 + 0.4, tz + dz, 0.1, 0.8, 0.1, shade(0x3a2a20, lit(-24, tz)));
  mb.box(-24, y0 + 0.86, tz, 1.6, 0.01, 1, shade(0xc8b890, lit(-24, tz) + 0.3));   // mapa
  // F5.12: agentes del FBI muertos (traje oscuro, camisa, corbata, placa, gorra) y charcos de sangre
  const skinP = 0xc8a890, suitC = 0x1a1c24;
  [[-33, 7, 0.4, false], [-15, 9, -1.2, false], [-27, 17, 2.1, true], [B.x1 + 1.2, 14, Math.PI / 2, 'wall'], [-19.5, 21, 0.9, true]].forEach(([x, z, rot, faceDown], i) => {
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
  // (F5.26: los peldaños van aparte, en beast.js: la Bestia los arranca y quedan tirados)
  mb.box(L.x, y1 - 0.005, L.z + 0.3, 1.2, 0.02, 1.2, 0x050505);
  // teletransportador (el de Black Ops, apagado y en rojo): plataforma, dos columnas, arco y bobinas
  const t = B.teleporter, tk = lit(t.x, t.z) + 0.15;                     // F5.28: lo tiñe su propio brillo rojo
  mb.box(t.x, y0 + 0.2, t.z + 0.1, 3.2, 0.4, 2.6, shade(0x4a4a50, tk));
  mb.box(t.x, y0 + 0.41, t.z + 0.1, 2.4, 0.02, 1.8, 0x3a0a08);
  for (const s of [-1, 1]) {
    mb.box(t.x + s * 1.35, y0 + 1.6, t.z + 0.5, 0.35, 2.4, 0.35, shade(0x5a5a62, tk));
    for (let i = 0; i < 5; i++) mb.box(t.x + s * 1.35, y0 + 0.8 + i * 0.4, t.z + 0.5, 0.45, 0.08, 0.45, shade(0xb87a3a, tk));   // bobinas de cobre
  }
  mb.box(t.x, y0 + 2.9, t.z + 0.5, 3.1, 0.3, 0.4, shade(0x5a5a62, tk));
  mb.box(t.x, y0 + 2.2, B.z2 - 0.3, 1.6, 1.2, 0.2, shade(0x3a3a40, lit(t.x, B.z2 - 1) + 0.1));   // tablero
  const m = mb.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
  if (m) { m.userData.theme = false; m.updateMatrix(); }
  return m;
  };
  paint(() => B.dark.paint);
  const t = B.teleporter, red = 0xff2a1a;
  // lo que brilla: las luces rojas del teletransportador (los focos del techo están muertos: cable y vidrio negro)
  const glow = new MeshBuilder();
  for (const [bx, bz] of B.bulbs) {
    glow.box(bx, y1 - 0.5, bz, 0.02, 0.5, 0.02, 0x111111);
    glow.box(bx, y1 - 0.8, bz, 0.18, 0.22, 0.18, 0x1a1a14);
  }
  glow.box(t.x, y0 + 2.2, B.z2 - 0.41, 1.2, 0.5, 0.02, red);                      // pantalla roja
  for (const s of [-1, 1]) glow.box(t.x + s * 1.35, y0 + 2.95, t.z + 0.5, 0.2, 0.2, 0.46, red);
  glow.box(t.x, y0 + 0.43, t.z + 0.1, 2.2, 0.01, 0.1, red); glow.box(t.x, y0 + 0.43, t.z + 0.1, 0.1, 0.01, 1.6, red);
  const gm = glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
  if (gm) { gm.userData.theme = false; gm.updateMatrix(); }
  const sign = makeTex((c, s) => {
    c.fillStyle = '#1a0806'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#ff3a2a'; c.textAlign = 'center';
    c.font = 'bold ' + Math.floor(s * 0.13) + 'px monospace'; c.fillText('OUT OF', s / 2, s * 0.45); c.fillText('ORDER', s / 2, s * 0.65);
  }, 1, 128);
  sign.magFilter = THREE.LinearFilter;
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: sign }));
  sg.position.set(t.x, y0 + 2.2, B.z2 - 0.43); sg.rotation.y = Math.PI; scene.add(sg);
  buildHatch();
  buildBeastLair();                                                     // F5.26: barriles, escalera y sus pedazos
  buildStatues();
  buildTablet();                                                        // F5.20: la lápida con el poema
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
// F5.28e: puede ir contra una pared en x (axis 'x': el ancho va a lo largo de z) y bajo tierra (a la altura del piso)
function buildHatch() {
  const E = CONFIG.BUNKER.entrance, face = E.face || 1, ax = E.axis === 'x', H = E.h;
  const W = ax ? E.z2 - E.z1 : E.x2 - E.x1, D = ax ? E.x2 - E.x1 : E.z2 - E.z1;
  const cx = (E.x1 + E.x2) / 2, cz = (E.z1 + E.z2) / 2, ry = ax ? (face > 0 ? Math.PI / 2 : -Math.PI / 2) : (face > 0 ? 0 : Math.PI);
  const ey = groundY(cx, cz);
  const mb = new MeshBuilder().setFrame(cx, ey, cz, ry), F = D / 2;             // F = cara de adelante (local z)
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
  // F5.25: barriles de cubos (cyl de cubos, parado en la base: el centro se baja 0.45 a lo largo de su eje)
  const barrel = (x, y, z, rx, ry, c) => {
    const L = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), d = new THREE.Vector3(0, -0.45, 0).applyMatrix4(L);
    mb.cyl(x + d.x, y + d.y, z + d.z, 0.3, 0.9, c, 1, 10, rx, ry, 0);
    for (const t of [0.15, 0.75]) { const e = new THREE.Vector3(0, t - 0.45, 0).applyMatrix4(L); mb.cyl(x + e.x, y + e.y, z + e.z, 0.32, 0.06, 0x3a2a1a, 1, 10, rx, ry, 0); }   // aros
  };
  barrel(-W / 2 - 1.3, 0.45, F + 1.6, 0, 0, rust);
  barrel(-W / 2 - 0.9, 0.3, F + 2.5, Math.PI / 2, 0.6, 0x6a3a1a);
  barrel(W / 2 + 2.6, 0.3, F + 1.2, Math.PI / 2, -0.3, 0x5a4a3a);
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
  const front = (x, y, z) => new THREE.Vector3(cx + x * Math.cos(ry) + z * Math.sin(ry), ey + y, cz - x * Math.sin(ry) + z * Math.cos(ry));
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
    const potH = 0.9, stone = new MeshBuilder(), alive = new MeshBuilder(), gy = groundY(sp.x, sp.z);   // F5.28e: bajo tierra
    for (const mb of [stone, alive]) mb.box(sp.x, gy + potH / 2, sp.z, 0.8, potH, 0.8, mb === stone ? 0x8a8a84 : 0x7a4a2a);   // maceta
    plantStem(stone, sp.x, gy + potH, sp.z, S, true);
    plantStem(alive, sp.x, gy + potH, sp.z, S, false);
    const ms = stone.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })), ma = alive.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    [ms, ma].forEach(m => { m.userData.theme = false; m.updateMatrix(); });
    ma.visible = false;
    const h = makePlantHead(sp.x, gy + potH + 0.7 * S + 0.05, sp.z, S, true);
    const E = B.entrance, out = (E.face || 1) > 0 ? 0 : Math.PI;
    h.head.rotation.y = E.axis === 'x' ? out + Math.PI / 2 : out;                    // mira hacia afuera (F5.15; F5.28e: al este)
    BUNK.statues.push(Object.assign(h, { x: sp.x, z: sp.z, ground: true, stoneMesh: ms, aliveMesh: ma,
      kills: 0, crawlers: 0, dogs: 0, awake: false, done: false, eatT: 0, open: 0 }));
  }
}
// F5.20 (Diego): lápida con el poema del búnker (CONFIG.BUNKER.tablet). Losa de piedra con el texto tallado (canvas),
// musgo, dos velas que brillan (MeshBasic) y huesitos al pie. Sin collider: queda afuera del área caminable
function buildTablet() {
  const T = CONFIG.BUNKER.tablet, mb = new MeshBuilder(), gl = new MeshBuilder(), ty = groundY(T.x, T.z);   // F5.28e: en la cueva
  mb.setFrame(T.x, ty, T.z, T.rot); gl.setFrame(T.x, ty, T.z, T.rot);
  mb.box(0, 0.15, 0, 2.4, 0.3, 0.9, 0x4a4640);                                        // base
  mb.box(0, 1.35, -0.1, 2.0, 2.2, 0.28, 0x6a6660);                                   // losa
  // F5.21 (Diego): remate escalonado en cubos, arriba de la losa y un poco más atrás (el cilindro de antes quedaba casi en
  // el plano del poema y le tapaba la mitad de arriba)
  mb.box(0, 2.55, -0.14, 1.7, 0.2, 0.24, 0x625e58); mb.box(0, 2.72, -0.14, 1.2, 0.16, 0.22, 0x6a6660);
  mb.box(0, 2.86, -0.14, 0.7, 0.14, 0.2, 0x625e58); mb.box(0, 3.05, -0.14, 0.14, 0.26, 0.14, 0x5a5650);   // cruz arriba
  mb.box(0, 3.08, -0.14, 0.4, 0.1, 0.14, 0x5a5650);
  for (const s of [-1, 1]) mb.box(s * 1.05, 1.35, -0.1, 0.12, 2.3, 0.34, 0x5a5650);   // pilastras a los costados
  for (let k = 0; k < 6; k++) mb.blob(-0.9 + k * 0.36, 0.3 + (k % 2) * 0.08, 0.05, 0.22, 0.15, 0.06, 0x4a6a3a, k);   // musgo (solo abajo: no tapa el poema)
  for (const s of [-1, 1]) mb.blob(s * 1.02, 1.4, -0.1, 0.1, 0.5, 0.18, 0x4a6a3a, 3);
  for (const s of [-1, 1]) { mb.cyl(s * 0.95, 0.3, 0.3, 0.06, 0.22, 0xe8dcc0, 1, 8); gl.sphere(s * 0.95, 0.58, 0.3, 0.05, 0.09, 0.05, 0xffc860, 6); }   // velas
  for (let k = 0; k < 4; k++) mb.seg([-0.6 + k * 0.4, 0.32, 0.4], [-0.4 + k * 0.4, 0.32, 0.55], 0.035, 0.03, 0xe0d4b8, 5);   // huesitos
  mb.setFrame(null); gl.setFrame(null);
  const m1 = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })), m2 = gl.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
  for (const m of [m1, m2]) if (m) { m.userData.theme = false; m.updateMatrix(); }
  // el poema tallado (letras oscuras con un filo claro, sobre la piedra)
  const tex = makeTexWH(512, 512, (c, w, h) => {
    c.fillStyle = '#6a6660'; c.fillRect(0, 0, w, h);
    for (let k = 0; k < 300; k++) { c.fillStyle = 'rgba(0,0,0,' + Math.random() * 0.15 + ')'; c.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    // F5.21: tipografía clásica (romana con serifas, como grabada en mármol), el título en versalitas y un filete
    const F = '"Times New Roman", Times, Georgia, serif';
    c.textAlign = 'center';
    const fit = (txt, px, style) => { let s = px; do { c.font = style + ' ' + s + 'px ' + F; s--; } while (((c.measureText(txt) || {}).width || 0) > w - 56 && s > 10); };
    fit('THE SLEEPING DOOR', 30, 'bold');
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillText('THE SLEEPING DOOR', w / 2 + 2, 64);
    c.fillStyle = '#efe4c8'; c.fillText('THE SLEEPING DOOR', w / 2, 62);
    c.fillStyle = '#d8ccb0'; c.fillRect(w / 2 - 150, 80, 300, 2); c.fillRect(w / 2 - 5, 76, 10, 10);   // filete
    T.poem.forEach((line, i) => {                                                    // letras claras con sombra: se leen en la penumbra
      fit(line, 23, 'italic');
      c.fillStyle = 'rgba(0,0,0,.6)'; c.fillText(line, w / 2 + 2, 130 + i * 50 + 2);
      c.fillStyle = '#efe4c8'; c.fillText(line, w / 2, 130 + i * 50);
    });
    c.fillStyle = '#d8ccb0'; c.fillRect(w / 2 - 150, 450, 300, 2);
    c.font = 'bold 22px ' + F; c.fillText('R · I · P', w / 2, 482);
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.1),
    new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }));
  const off = 0.045, ry = T.rot;
  face.position.set(T.x + Math.sin(ry) * off, ty + 1.4, T.z + Math.cos(ry) * off); face.rotation.y = ry;
  face.userData.theme = false; scene.add(face);
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
  if (s.crawlers >= B.eatCrawlers && s.dogs >= B.eatDogs && !s.done) {
    s.done = true;
    plantAlien(s, true);                                              // F5.20 (Diego): la que cumplió su parte cambia (como las del jardín)
    spawnSplashFx(s.x, 2, s.z, 0xb04aff, 1.8); showBanner('A STATUE IS SATISFIED', 2.5);
  }
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
  if (!playSample('grito_hombre_al_abrir_puerta_bunker_a_lo_lejos')) sfxShellRise();   // F5.19
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
  if (!t.down && ladderBroken()) return { text: '[Hold F] Rebuild the ladder', cost: 0 };   // F5.26: la rompió la Bestia
  return { text: t.down ? '[F] Go down to the bunker' : '[F] Climb up', cost: 0 };
}
function useHatch(t) {
  if (!BUNK.open || BUNK.fadeT > 0) return false;
  if (!t.down && ladderBroken()) return true;                          // F5.26: se arregla manteniendo F (updateBeast)
  const B = CONFIG.BUNKER;
  BUNK.fadeTo = t.down ? B.ladder.out : B.hatch.out;
  startTravel('stairs', t.down);                                      // F5.19c: 5 s bajando/subiendo la escalera
  if (!(t.down && playSample('bajar_al_bunker'))) sfxShieldTake();   // F5.19
  return true;
}
function hatchTeleport(p) {
  player.pos.set(p[0], (p[2] !== undefined ? p[2] : groundY(p[0], p[1])) + CONFIG.PLAYER.height, p[1]);   // F5.19: p[2] = altura (la nave del templo)
  player.vel.set(0, 0, 0);
  player.airTop = player.pos.y;                    // sin daño por caída
  updateFlowField(true);
}
function updateBunker(dt) {
  updateStatues(dt);
  if (!BUNK.shellVoice && state.running) {                                          // F5.19: la primera vez adentro del caparazón
    const r = roomAt(player.pos.x, player.pos.z);
    if (r && r.id === 'R21') BUNK.shellVoice = voice('audio_del_personaje_al_entrar_al_caparazon', 1, 0) || !audioOn();
  }
  updatePortals(dt, clock.elapsedTime);                                                // F5.16
  updatePlantBoss(dt, clock.elapsedTime);                                              // F5.20
  updatePolice(dt, clock.elapsedTime);
  updateBeast(dt);                                                                     // F5.26
  if (BUNK.open && BUNK.halves[0].position.x > -2.3) {                               // F5.13: las puertas se corren
    const x = Math.max(-2.3, BUNK.halves[0].position.x - dt * 1.2);
    BUNK.halves[0].position.x = x; BUNK.halves[1].position.x = -x;
  }
  if (BUNK.fadeT > 0) updateTravel(dt);
}
// F5.19c (Diego): el viaje dura BUNKER.travel s. Entra la cinemática (fade s), a la mitad te teletransporta y al final
// se va. 'stairs': pantalla oscura con escalones que suben y pasos (bajás o subís la escalera del búnker).
// 'portal': remolino morado de galaxia con estrellas. Mientras tanto no te movés ni te pegan (BUNK.travel)
function startTravel(kind, down, time) {
  const B = CONFIG.BUNKER;
  // F5.26: `time` (el portal es casi inmediato: PORTAL.travel); sin él, BUNKER.travel (la escalera del búnker)
  BUNK.fadeT = BUNK.fadeT0 = time || B.travel; BUNK.fadeDone = false; BUNK.travel = kind; BUNK.stepT = 0.4;
  if (UI.travel) { UI.travel.className = kind + (down === false ? ' up' : ''); UI.travel.style.opacity = '0'; UI.travel.style.display = ''; }
}
function updateTravel(dt) {
  const B = CONFIG.BUNKER, T = BUNK.fadeT0 || B.travel, F = Math.min(B.fade, T / 2);
  BUNK.fadeT = Math.max(0, BUNK.fadeT - dt);
  const e = T - BUNK.fadeT;
  if (!BUNK.fadeDone && e >= T / 2) {
    BUNK.fadeDone = true;
    player.prevX = player.pos.x; player.prevZ = player.pos.z;       // F5.26: portalCarry mide desde donde estabas
    hatchTeleport(BUNK.fadeTo);
    if (BUNK.travel === 'stairs' && inBunker()) playSample('entrada_am_bunker');       // F5.19c: llegás abajo
    if (PORTAL.from) { portalCarry(PORTAL.from, BUNK.fadeTo); PORTAL.from = null; }   // F5.16
  }
  const o = e < F ? e / F : BUNK.fadeT < F ? BUNK.fadeT / F : 1;
  if (UI.travel) UI.travel.style.opacity = Math.max(0, Math.min(1, o)).toFixed(3);
  if (BUNK.travel === 'stairs' && (BUNK.stepT -= dt) <= 0 && BUNK.fadeT > F) {          // pasos en la escalera
    BUNK.stepT = B.stepEvery;
    if (typeof sfxStep === 'function') sfxStep('concrete', 0.9);
  }
  if (BUNK.fadeT <= 0) { BUNK.travel = null; if (UI.travel) { UI.travel.style.opacity = '0'; UI.travel.style.display = 'none'; } }
}
// F5.16: portal Templo ↔ Calamar (CONFIG.PORTAL). Al principio no hay portal: en el templo hay una tumba. Un tiro
// (traceShot/tracePierce -> shootTomb) la hace sangrar `bleed` s y se convierte en los dos arcos (templo y
// calamar). F cerca de un arco: fundido de la escotilla (BUNK.fadeT) y aparecés en `out` del otro, con `cooldown`
// s de espera. Los que te perseguían (a menos de `carry` m, no bosses) salen del piso cerca del otro arco
const PORTAL = { arcs: [], open: false, bleedT: 0, dripT: 0, cd: 0, tomb: null, tombHit: null, pool: null, from: null };
function portalOn() { return PORTAL.open; }
function buildPortals() {
  const P = CONFIG.PORTAL, mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  // F5.20 (Diego: "más diseño, una recopilación de piedras raras, como del espacio, con colores brillantes"): en vez del
  // arco, un anillo de piedras facetadas de colores que flotan y giran despacio alrededor del centro, con cristales que
  // brillan entre ellas, una base de piedras partidas y un remolino de galaxia adentro. `arc` es un grupo (gira)
  // F5.21 (Diego: "que sea cúbico, está horrible"): una puerta de piedra en cubos (gradas, dos pilares irregulares con
  // glifos que brillan y un dintel con la piedra clave), cristales cúbicos de colores que orbitan, un marco cuadrado de
  // cubos de luz que gira y un remolino de galaxia PIXELADO (textura chica con filtro Nearest) en el medio
  const swirlTex = makeTexWH(32, 32, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const pal = ['#1a0640', '#3a1080', '#6a28d0', '#b04af0', '#ff7aff', '#ffffff'];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - w / 2, dy = y + 0.5 - h / 2, r = Math.hypot(dx, dy) / (w / 2);
      if (r > 1) continue;
      const a = Math.atan2(dy, dx), s = Math.sin(a * 2 + r * 9) * 0.5 + 0.5;
      const k = Math.max(0, Math.min(5, Math.floor((1 - r) * 4 + s * 2.2)));
      c.fillStyle = pal[k]; c.fillRect(x, y, 1, 1);
    }
    c.fillStyle = '#7afff0'; for (let k = 0; k < 14; k++) c.fillRect(Math.floor(Math.random() * w), Math.floor(Math.random() * h), 1, 1);
  }, true);
  const crystal = [0xff4ad8, 0x4af0ff, 0xffd23a, 0x9a4aff, 0x4aff8a, 0xff7a3a];
  const STN = [0x4a4458, 0x3a3448, 0x5a5468, 0x2e2a3a], GLY = [0x5af8ff, 0xff4af0, 0xffd84a];
  for (const key of ['temple', 'squid']) {
    const S = P[key], sy = S.y || 0, rr = mulberry(key === 'temple' ? 77 : 99);   // F5.19: el del templo está arriba de la nave
    const arc = new THREE.Group(); arc.position.set(S.x, sy, S.z); arc.rotation.y = S.rot; scene.add(arc);
    const st = new MeshBuilder(), gw = new MeshBuilder(), v = 0.34;
    for (let k = 0; k < 3; k++) {                                      // gradas
      const w = 4.4 - k * 0.7, d = 1.9 - k * 0.45;
      for (let x = -w / 2 + v / 2; x < w / 2; x += v) for (let z = -d / 2 + v / 2; z < d / 2; z += v)
        st.box(x, k * 0.2 + 0.1, z, v, 0.2, v, STN[Math.floor(rr() * 4)]);
    }
    for (const s of [-1, 1]) {                                          // pilares de cubos, un poco torcidos
      for (let j = 0; j < 10; j++) {
        const y = 0.6 + j * v, off = (rr() - 0.5) * 0.06;
        for (const dx of [0, 1]) for (const dz of [-1, 0, 1]) {
          const glyph = dx === 0 && dz === 1 && j % 3 === 1;
          (glyph ? gw : st).box(s * (1.55 + dx * v) + off, y + v / 2, dz * v, v, v, v, glyph ? GLY[(j + (s > 0 ? 1 : 0)) % 3] : STN[Math.floor(rr() * 4)]);
        }
      }
    }
    for (let x = -2.0; x <= 2.01; x += v) {                             // dintel, con la piedra clave que brilla
      const key0 = Math.abs(x) < v / 2;
      st.box(x, 0.6 + 10 * v + v / 2, 0, v, v, v * 2, STN[Math.floor(rr() * 4)]);
      (key0 ? gw : st).box(x, 0.6 + 11 * v + v / 2, 0, v, v, key0 ? v * 2.2 : v * 1.4, key0 ? 0xff4af0 : STN[Math.floor(rr() * 4)]);
    }
    for (let k = 0; k < 8; k++) st.box((rr() - 0.5) * 4.8, 0.12, (rr() - 0.5) * 2.8, 0.26, 0.24, 0.26, STN[k % 4], rr(), rr(), rr());   // cascotes
    const bm = st.mesh(mat.clone()), gm = gw.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
    for (const m of [bm, gm]) if (m) { scene.remove(m); m.matrixAutoUpdate = true; m.userData.theme = false; arc.add(m); }
    const orbit = new THREE.Group(); orbit.position.y = 1.9; arc.add(orbit);
    const rk = new MeshBuilder(), cr = new MeshBuilder();
    for (let k = 0; k < 16; k++) {                                     // cristales cúbicos en anillo (plano xy), de canto
      const a = k / 16 * Math.PI * 2, R = 1.5 + (k % 2) * 0.15, s = 0.16 + rr() * 0.14;
      rk.box(Math.cos(a) * R, Math.sin(a) * R, (rr() - 0.5) * 0.3, s, s * 1.6, s, crystal[k % crystal.length], Math.PI / 4, a, Math.PI / 4);
      if (k % 2) cr.box(Math.cos(a + 0.2) * (R - 0.2), Math.sin(a + 0.2) * (R - 0.2), 0, 0.08, 0.08, 0.08, [0xffffff, 0xff9aff, 0x9afff0][k % 3]);
    }
    const rm = rk.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x3a1a4a }));
    const cm = cr.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
    for (const m of [rm, cm]) if (m) { scene.remove(m); m.matrixAutoUpdate = true; m.userData.theme = false; orbit.add(m); }
    const rb = new MeshBuilder();                                       // marco cuadrado de cubos de luz (gira)
    for (let i = -5; i <= 5; i++) for (const e of [-1, 1]) {
      rb.box(i * 0.24, e * 1.2, 0, 0.16, 0.16, 0.08, i % 2 ? 0xc06aff : 0x5af8ff);
      rb.box(e * 1.2, i * 0.24, 0, 0.16, 0.16, 0.08, i % 2 ? 0xc06aff : 0xff4af0);
    }
    const ring = new THREE.Mesh(rb.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    const core = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24),
      new THREE.MeshBasicMaterial({ map: swirlTex, color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    for (const o of [ring, core]) { o.position.set(S.x, sy + 1.9, S.z); o.rotation.y = S.rot; scene.add(o); }
    PORTAL.arcs.push({ key, S, arc, ring, core, orbit });
  }
  // la tumba: lápida de piedra con cruz, montículo de tierra; su caja de tiro (sin collider) en hitMeshes
  const S = P.temple, tb = new MeshBuilder(), ty = S.y || 0;
  tb.setFrame(S.x, ty, S.z, S.rot);
  tb.box(0, 0.15, 0.9, 1.1, 0.3, 2.0, 0x4a3a28);                       // montículo
  tb.box(0, 0.75, -0.15, 0.95, 1.5, 0.25, 0x6a6a62);                   // lápida
  tb.box(0, 1.55, -0.15, 0.55, 0.18, 0.26, 0x5a5a54);
  tb.box(0, 1.1, -0.01, 0.1, 0.55, 0.02, 0x2a2a28); tb.box(0, 1.2, -0.01, 0.34, 0.1, 0.02, 0x2a2a28);   // cruz tallada
  for (let k = 0; k < 5; k++) tb.box(-0.5 + k * 0.25, 0.32, 0.4 + (k % 2) * 0.9, 0.12, 0.05, 0.12, 0xd8d0b8);   // huesitos
  tb.setFrame(null);
  PORTAL.tomb = tb.mesh(mat); if (PORTAL.tomb) { PORTAL.tomb.userData.theme = false; PORTAL.tomb.updateMatrix(); }
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.7, 0.5), new THREE.MeshBasicMaterial());
  hit.visible = false; hit.position.set(S.x, ty + 0.85, S.z); hit.rotation.y = S.rot; hit.userData = { type: 'tomb' };
  scene.add(hit); PORTAL.tombHit = hit;
  PORTAL.pool = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0x4a0808, transparent: true, opacity: 0.85, depthWrite: false }));
  PORTAL.pool.rotation.x = -Math.PI / 2; PORTAL.pool.position.set(S.x, ty + 0.03, S.z); PORTAL.pool.visible = false;
  scene.add(PORTAL.pool);
  buildPortalPuddles();
  resetPortals();
}
// ---- F5.24 (Diego): con la planta jefa, el portal son dos charcos amarillos (CONFIG.PORTAL.puddle): el del templo donde
// explotó la planta y el de la playa del calamar. Cubos de baba amarilla y ámbar con un remolino que brilla en el
// medio, un borde de raíces y huesos, chispas que suben y un haz de luz tenue (todo MeshBasic/aditivo: ninguna luz).
// Se viaja saltando adentro (updatePortals). Un grupo de radio 1 por charco, escalado al radio del charco ----
function buildPortalPuddles() {
  const PP = CONFIG.PORTAL.puddle, rr = mulberry(1313), v = 0.16;
  const goo = new MeshBuilder(), rim = new MeshBuilder(), core = new MeshBuilder();
  const YEL = [0x8a6a0a, 0xb89010, 0xe0b820, 0xffd23a, 0xffe87a, 0xfff4c0];
  for (let x = -1.3; x <= 1.3; x += v) for (let z = -1.3; z <= 1.3; z += v) {
    const a = Math.atan2(z, x), edge = 1 + 0.12 * Math.sin(4 * a + 1) + 0.07 * Math.sin(9 * a), d = Math.hypot(x, z) / edge;
    if (d < 0.55) core.box(x, 0.05, z, v, 0.04, v, YEL[Math.min(5, 3 + Math.floor((0.55 - d) * 6 + rr()))]);
    else if (d < 1) goo.box(x, 0.03 + (rr() < 0.1 ? 0.03 : 0), z, v, 0.05, v, YEL[Math.floor(rr() * 3) + (d < 0.8 ? 2 : 0)]);
    else if (d < 1.22 && rr() < 0.8) rim.box(x, 0.06, z, v, 0.1 + rr() * 0.1, v, [0x2a1a0a, 0x3a0e48, 0x160c1a, 0x5a4a1a][Math.floor(rr() * 4)]);
  }
  for (let i = 0; i < 9; i++) {                                         // raíces y huesos que rodean el charco
    const a = rr() * Math.PI * 2, d = 1.1 + rr() * 0.25;
    rim.box(Math.cos(a) * d, 0.12, Math.sin(a) * d, 0.55, 0.14, 0.14, i % 3 ? 0x3a0e48 : 0xe8dcb0, 0, a, 0);
  }
  const gooG = goo.geometry(), rimG = rim.geometry(), coreG = core.geometry();
  const moteG = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  PORTAL.puddles = [];
  for (const key of ['temple', 'squid']) {
    const S = PP[key], g = new THREE.Group(); g.position.set(S.x, (S.y || 0) + 0.01, S.z); g.visible = false; scene.add(g);
    const gooMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false });
    const coreMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    g.add(new THREE.Mesh(rimG, new THREE.MeshLambertMaterial({ vertexColors: true })));
    g.add(new THREE.Mesh(gooG, gooMat));
    const coreM = new THREE.Mesh(coreG, coreMat); g.add(coreM);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.95, 5, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23a,
      transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 2.5; g.add(beam);
    const motes = [];
    for (let k = 0; k < 10; k++) {
      const mo = new THREE.Mesh(moteG, new THREE.MeshBasicMaterial({ color: k % 3 ? 0xffe87a : 0xb04aff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      mo.userData.ph = k / 10; mo.userData.a = rr() * Math.PI * 2; g.add(mo); motes.push(mo);
    }
    PORTAL.puddles.push({ key, S, g, coreM, beam, motes, gooMat, coreMat });
  }
  PORTAL.growT = -1;
}
function puddleMode() { return typeof plantOn === 'function' && plantOn(); }
// la planta explotó: el charco del templo empieza a crecer; al llegar a su tamaño se abre el portal (y aparece el otro)
function portalPuddleGrow() { PORTAL.growT = 0; const P = PORTAL.puddles && PORTAL.puddles[0]; if (P) { P.g.visible = true; P.g.scale.setScalar(0.01); } }
// las puntas del portal según el modo: charcos (con la planta) o arcos (tumba, sin la planta)
function portalEnds() { const P = CONFIG.PORTAL; return puddleMode() ? P.puddle : P; }
function resetPortals() {
  PORTAL.open = false; PORTAL.bleedT = 0; PORTAL.cd = 0; PORTAL.from = null;
  for (const A of PORTAL.arcs) { A.arc.visible = A.ring.visible = A.core.visible = false; }
  for (const D of PORTAL.puddles || []) D.g.visible = false;           // F5.24
  PORTAL.growT = -1;
  // F5.20: con la planta jefa no hay tumba (el portal se abre cuando muere, plantboss.js). La tumba queda para
  // PLANTBOSS.enabled = false (tests viejos)
  const tomb = !CONFIG.PLANTBOSS.enabled;
  if (PORTAL.tomb) PORTAL.tomb.visible = tomb;
  if (PORTAL.pool) { PORTAL.pool.visible = false; PORTAL.pool.scale.setScalar(0.01); }
  const ti = WORLD.hitMeshes.indexOf(PORTAL.tombHit);
  if (PORTAL.tombHit && tomb && ti < 0) WORLD.hitMeshes.push(PORTAL.tombHit);
  if (!tomb && ti >= 0) WORLD.hitMeshes.splice(ti, 1);
}
// un tiro a la tumba: sangra y después se abre el portal. true = le pegó a la tumba cerrada
function shootTomb() {
  if (PORTAL.open || PORTAL.bleedT > 0 || CONFIG.PLANTBOSS.enabled) return false;
  PORTAL.bleedT = CONFIG.PORTAL.bleed; PORTAL.dripT = 0;
  PORTAL.pool.visible = true;
  sfxThunder();
  return true;
}
function openPortals() {
  PORTAL.open = true; PORTAL.bleedT = 0;
  PORTAL.tomb.visible = false;
  const i = WORLD.hitMeshes.indexOf(PORTAL.tombHit); if (i >= 0) WORLD.hitMeshes.splice(i, 1);
  // F5.24: con la planta, los dos charcos amarillos (sin arcos)
  if (puddleMode()) { for (const D of PORTAL.puddles) { D.g.visible = true; D.g.scale.setScalar(CONFIG.PORTAL.puddle.radius); } PORTAL.growT = -1; }
  else for (const A of PORTAL.arcs) { A.arc.visible = A.ring.visible = A.core.visible = true; }
  showBanner('A PORTAL OPENED', 3);
  if (!playSample('portal_2')) sfxShieldTake();                       // F5.19
}
function portalNear(room, px, pz, bd) {
  if (!PORTAL.open) return null;
  const P = CONFIG.PORTAL;
  if (puddleMode()) {                                                   // F5.24: el cartel avisa que se salta adentro
    for (const D of PORTAL.puddles) {
      if (!room || room.id !== D.S.room || ((D.S.y || 0) > 1 ? 1 : 0) !== playerLevel()) continue;
      const d = Math.hypot(px - D.S.x, pz - D.S.z);
      if (d < Math.min(bd, P.puddle.radius + 1.5)) return { target: { portal: D.key, puddle: true }, dist: d };
    }
    return null;
  }
  for (const A of PORTAL.arcs) {
    if (!room || room.id !== A.S.room) continue;
    if (((A.S.y || 0) > 1 ? 1 : 0) !== playerLevel()) continue;       // F5.19: el del templo, desde arriba de la nave
    const d = Math.hypot(px - A.S.x, pz - A.S.z);
    if (d < Math.min(bd, P.use)) return { target: { portal: A.key }, dist: d };
  }
  return null;
}
function portalPrompt(t) {
  if (PORTAL.cd > 0) return { text: 'The portal is recharging...', cost: 0 };
  if (t.puddle) return { text: t.portal === 'temple' ? '[Space] Jump in: travel to Squid Beach' : '[Space] Jump in: travel to the Temple', cost: 0 };
  return { text: t.portal === 'temple' ? '[F] Travel to Squid Beach' : '[F] Travel to the Temple', cost: 0 };
}
function usePortal(t) {
  if (!PORTAL.open || PORTAL.cd > 0 || BUNK.fadeT > 0) return false;
  const P = CONFIG.PORTAL, E = portalEnds();                           // F5.24: charcos o arcos
  BUNK.fadeTo = t.portal === 'temple' ? E.squid.out : E.temple.out;
  PORTAL.from = t.portal === 'temple' ? E.temple : E.squid;
  // F5.26 (Diego: "que sea inmediato que viaje y que ellos también viajen inmediato"): un destello de PORTAL.travel s (antes
  // 5 s de galaxia, y los zombies te esperaban del otro lado)
  startTravel('portal', undefined, P.travel);
  PORTAL.cd = BUNK.fadeT + P.cooldown;                               // se cuenta desde que llegás
  if (!playSample('portal')) sfxShieldTake();                          // F5.19
  return true;
}
// los que te perseguían cruzan con vos, en el mismo instante: aparecen ya caminando (sin salir del piso), a la misma
// distancia y en la misma dirección respecto de vos que tenían antes (los de atrás siguen atrás), como mínimo a `minGap` m.
// Si ese lugar no se camina, el más cercano en un anillo alrededor. F5.19: si la llegada está arriba (la nave del
// templo), en celdas del nivel de arriba; los de arriba también cruzan
function portalCarry(from, to) {
  const P = CONFIG.PORTAL, fromL = (from.y || 0) > 1 ? 1 : 0, up = (to[2] || 0) > 1;
  const px = player.prevX !== undefined ? player.prevX : from.x, pz = player.prevZ !== undefined ? player.prevZ : from.z;
  const ok = (x, zz) => up ? isUp(Math.floor(x), Math.floor(zz)) : isNav(Math.floor(x), Math.floor(zz));
  let k = 0;
  for (const z of state.zombies) {
    if (!z.active || !z.alive || z.boss || z.climb || (z.level || 0) !== fromL) continue;
    if (z.state !== 'walk' && z.state !== 'emerge') continue;
    if (Math.hypot(z.px - from.x, z.pz - from.z) > P.carry) continue;
    let dx = z.px - px, dz = z.pz - pz, d = Math.hypot(dx, dz) || 1e-4;
    if (d < P.minGap) { dx *= P.minGap / d; dz *= P.minGap / d; }
    let x = to[0] + dx, zz = to[1] + dz;
    if (!ok(x, zz)) {
      let found = false;
      for (let tries = 0; tries < 24 && !found; tries++, k++) {
        const a = Math.atan2(dz, dx) + (tries % 2 ? 1 : -1) * Math.ceil(tries / 2) * 0.4, r = Math.max(P.minGap, Math.min(d, 7));
        const tx = to[0] + Math.cos(a) * r, tz = to[1] + Math.sin(a) * r;
        if (ok(tx, tz)) { x = tx; zz = tz; found = true; }
      }
      if (!found) continue;                                          // no hay dónde: se queda (lo respawnea el watchdog)
    }
    resetZombie(z, { x: Math.floor(x) + 0.5, z: Math.floor(zz) + 0.5 }, true);
    z.level = up ? 1 : 0;
    z.state = 'walk'; z.t = 0; z.emergeT = 0; z.digDepth = 0;
    z.heading = Math.atan2(to[0] - z.px, to[1] - z.pz);
    placeRoot(z, 0); z.root.rotation.y = z.heading;
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
      spawnBloodDecalAt({ point: new THREE.Vector3(S.x, (S.y || 0) + 1.5, S.z) }, true, null);
    }
    if (PORTAL.bleedT <= 0) openPortals();
  }
  // F5.24: el charco del templo crece después de la explosión y al llegar a su tamaño se abre el portal
  const PP = CONFIG.PORTAL.puddle;
  if (PORTAL.growT >= 0 && PORTAL.puddles) {
    PORTAL.growT += dt;
    const f = Math.min(1, PORTAL.growT / CONFIG.PLANTBOSS.cine.puddle), D = PORTAL.puddles[0];
    D.g.scale.setScalar(PP.radius * Math.max(0.01, f * (2 - f)));
    if (f >= 1) { PORTAL.growT = -1; if (!PORTAL.open) openPortals(); }
  }
  for (const D of PORTAL.puddles || []) {                              // el remolino, el haz y las chispas que suben
    if (!D.g.visible) continue;
    D.coreM.rotation.y = -t * 1.2; D.coreMat.opacity = (PORTAL.cd > 0 ? 0.35 : 0.8) + 0.2 * Math.sin(t * 4);
    D.beam.material.opacity = (PORTAL.cd > 0 ? 0.04 : 0.1) + 0.05 * Math.sin(t * 2.3); D.beam.rotation.y = t * 0.4;
    for (const mo of D.motes) {
      const u = (mo.userData.ph = (mo.userData.ph + dt * 0.35) % 1), a = mo.userData.a + u * 4;
      mo.position.set(Math.cos(a) * (0.9 - u * 0.5), 0.1 + u * 3.2, Math.sin(a) * (0.9 - u * 0.5)); mo.material.opacity = 1 - u;
    }
  }
  // F5.24: se viaja SALTANDO adentro: cayendo sobre el charco (en el aire, bajando, con los pies cerca de él), sin F
  if (PORTAL.open && puddleMode() && PORTAL.cd <= 0 && !BUNK.travel && BUNK.fadeT <= 0 && state.running && !player.grounded && player.vel.y < 0) {
    const P = player.pos, feet = P.y - CONFIG.PLAYER.height;
    for (const D of PORTAL.puddles) {
      if (Math.hypot(P.x - D.S.x, P.z - D.S.z) < PP.radius && feet - (D.S.y || 0) < 0.6 && feet - (D.S.y || 0) > -0.3) {
        usePortal({ portal: D.key, puddle: true });
        spawnSplashFx(D.S.x, (D.S.y || 0) + 0.3, D.S.z, 0xffd23a, 2);
        break;
      }
    }
  }
  if (!PORTAL.open) return;
  for (const A of PORTAL.arcs) {
    A.ring.rotation.z = t * 1.6;
    A.ring.material.opacity = (PORTAL.cd > 0 ? 0.35 : 0.75) + 0.2 * Math.sin(t * 4);
    A.core.material.opacity = (PORTAL.cd > 0 ? 0.3 : 0.75) + 0.15 * Math.sin(t * 3);
    A.core.rotation.z = -t * 0.9;                                    // F5.20: el remolino gira
    if (A.orbit) { A.orbit.rotation.z = t * 0.25; A.orbit.position.y = 1.9 + Math.sin(t * 1.3) * 0.08; }   // las piedras flotan
  }
}
// F5.17 (Diego): el caparazón de una tortuga gigante en lugar de la estación de policía (CONFIG.SHELL). Cúpula de
// placas afuera y de hueso y carne adentro, armadas a mano (anillos × gajos) para dejar los huecos: la boca, las 4
// patas y la cola (con escombros y baba) y el tragaluz y dos placas rotas arriba. Adentro: la columna y las
// costillas pegadas a la cúpula (como en una tortuga de verdad), el entrepiso de andamios, sangre verde que brilla
// (MeshBasic: ninguna luz nueva) con gotas que caen, y los 3 zombies comiéndose a un policía (solo dibujo: al
// abrirse la barricada D21 se paran y salen 3 zombies de verdad donde estaban, extra de la ronda)
const POLICE = { feeders: [], woke: false };
const SHELLFX = { goo: null, halo: null, drops: [], dropMesh: null, shafts: [], eyes: null, leds: null, beacons: [], lamps: [] };
// F5.22 (Diego: "más grande, tercer nivel, adentro un área de investigación, todo cúbico"). Todo en cubos:
//  - la cúpula: columnas de cubos sobre la elipse (placas del caparazón con sus bordes oscuros, anillos de crecimiento,
//    musgo arriba, percebes abajo), con la boca, 4 patas y la cola tapadas con escombros, y el tragaluz arriba
//  - adentro, el laboratorio: piso de baldosas, columna y costillas de hueso pegadas a la cúpula, el anillo (nivel 1) y la
//    galería (nivel 2) de reja de metal con barandas amarillas, escaleras de metal, columnas de acero, tanques de
//    especímenes que brillan, racks con luces, escritorios con monitores, mesa de disección, la cápsula de contención del
//    medio con un embrión de tortuga gigante, barriles de riesgo biológico, trajes, cables, lámparas y balizas
//  - afuera y en la boca, lo de antes: policías muertos, los 3 que comen (POLICE), la barricada D21, el jeep, carteles
function buildShell() {
  const S = CONFIG.SHELL, A = S.a, B = S.b, H = S.h, cx = S.x, cz = S.z, rr = mulberry(55), v = 0.9, Y = UP.y, Y2 = UP2.y;
  const ex = new MeshBuilder(), lab = new MeshBuilder(), gw = new MeshBuilder(), goo = new MeshBuilder(), halo = new MeshBuilder(),
        rk = new MeshBuilder(), mb = new MeshBuilder(), gls = new MeshBuilder(), led = new MeshBuilder(), wd = new MeshBuilder();
  const hsh = pbHash, kAt = (x, z) => ((x - cx) / A) ** 2 + ((z - cz) / B) ** 2;
  const hAt = (x, z) => { const k = kAt(x, z); return k >= 1 ? 0 : H * Math.sqrt(1 - k); };
  const legTh = [-Math.PI / 2 - 0.78, -Math.PI / 2 + 0.78, Math.PI / 2 - 0.8, Math.PI / 2 + 0.8];
  const legs = legTh.map(th => [cx + A * Math.cos(th), cz + B * Math.sin(th)]);
  const hole = (x, y, z) => {
    const dx = x - cx, dz = z - cz;
    if (dz < 0 && Math.abs(dx) < 2.6 && y < 3.6) return 'mouth';
    for (const [lx, lz] of legs) if (((x - lx) / 2.2) ** 2 + (y / 2.3) ** 2 + ((z - lz) / 2.2) ** 2 < 1) return 'leg';
    if (dz > 0 && Math.abs(dx) < 1.6 && y < 2.0) return 'tail';
    if (kAt(x, z) < 0.022) return 'sky';                                  // el tragaluz
    return null;
  };
  // ---- la cúpula en cubos: placas (sectores por anillo) con bordes oscuros y anillos de crecimiento ----
  const plateCol = (x, y, z) => {
    const th = Math.atan2((z - cz) / B, (x - cx) / A), e = Math.min(0.999, y / H), ring = Math.floor(e * 3.2);
    const nS = [12, 10, 7, 4][Math.min(3, ring)], s = (th + Math.PI) / (Math.PI * 2) * nS, fs = s - Math.floor(s), fe = e * 3.2 - ring;
    if (fs < 0.07 || fs > 0.93 || fe < 0.08) return 0x2a2016;                              // borde entre placas
    const f = hsh(x, y, z), id = Math.floor(s) + ring * 13;
    if (e > 0.5 && f < 0.12) return f < 0.05 ? 0x7a9a4a : 0x5a7a3a;                          // musgo
    if (e < 0.18 && f > 0.86) return 0xd8d0c0;                                             // percebes
    const mid = Math.min(Math.abs(fs - 0.5), Math.abs(fe - 0.5)) < 0.12;                   // centro de la placa: más claro
    return mid ? [0x8a7248, 0x967c50, 0x7e6840][id % 3] : [0x6a5430, 0x5a4626, 0x74603a, 0x604c2c][id % 4];
  };
  for (let x = cx - A + v / 2; x < cx + A; x += v) for (let z = cz - B + v / 2; z < cz + B; z += v) {
    const h = hAt(x, z);
    if (h <= 0) continue;
    const hn = Math.min(hAt(x - v, z), hAt(x + v, z), hAt(x, z - v), hAt(x, z + v));
    for (let y = h - v / 2; y > Math.min(h - v, hn - v / 2) - 0.01 && y > -v / 2; y -= v) {
      if (hole(x, y, z)) continue;
      ex.box(x, y, z, v, v, v, plateCol(x, y, z));
    }
  }
  // los huecos: la boca con un labio de cubos, las patas y la cola tapadas con escombros y baba, el aro del tragaluz
  for (let k = 0; k <= 12; k++) {
    const a = k / 12 * Math.PI, x = cx + Math.cos(a) * 2.9, y = Math.max(0.2, Math.sin(a) * 3.9), z = cz - B * Math.sqrt(Math.max(0, 1 - ((x - cx) / A) ** 2 - (y / H) ** 2)) + 0.2;
    ex.box(x, y, z, 0.8, 0.8, 0.9, k % 2 ? 0x4a3a22 : 0x5e4c30);
  }
  for (const [lx, lz] of legs.concat([[cx, cz + B]])) {
    const dx = lx - cx, dz = lz - cz, l = Math.hypot(dx, dz), ox = dx / l, oz = dz / l;
    for (let k = 0; k < 16; k++) {
      const s = 0.4 + rr() * 0.6;
      rk.box(lx - ox * 0.3 + oz * (rr() - 0.5) * 3.6, s / 2 + rr() * 1.6, lz - oz * 0.3 - ox * (rr() - 0.5) * 3.6, s, s, s, [0x7a6a50, 0x6a5a44, 0x8a7a5e][k % 3], rr(), rr() * 3, rr());
    }
    for (let a = -2; a <= 2; a++) for (let b = 0; b < 3; b++) goo.box(lx + ox * (1.2 + b * 0.5) + oz * a * 0.5, 0.03, lz + oz * (1.2 + b * 0.5) - ox * a * 0.5, 0.5, 0.04, 0.5, 0xffffff);
    halo.add(UNIT_PLANE, lx + ox * 1.6, 0.06, lz + oz * 1.6, 4, 4, 1, -Math.PI / 2, 0, 0, 0xffffff);
  }
  for (let j = 0; j < 20; j++) { const a = j / 20 * Math.PI * 2, r = Math.sqrt(0.022); ex.box(cx + Math.cos(a) * A * r, H * Math.sqrt(1 - 0.022) - 0.2, cz + Math.sin(a) * B * r, 0.7, 0.5, 0.7, 0xd8ccb0); }
  // ---- adentro: la columna y las costillas de hueso pegadas a la cúpula (cadenas de cubos) ----
  const inner = (x, z) => hAt(x, z) - v - 0.2;
  for (let z = cz - B * 0.9; z <= cz + B * 0.9; z += 0.5) lab.box(cx, inner(cx, z) + 0.1, z, 0.7, 0.5, 0.45, 0xe0d4b8);   // vértebras
  for (let z = cz - B * 0.75; z <= cz + B * 0.8; z += 2.4) for (const sd of [-1, 1]) {
    for (let x = cx + sd * 0.6; Math.abs(x - cx) < A * Math.sqrt(Math.max(0, 1 - ((z - cz) / B) ** 2)) - 1.2; x += sd * 0.45) {
      const y = inner(x, z);
      if (y < Y2 + 2.4) break;                                            // no bajan hasta los pisos
      lab.box(x, y, z, 0.5, 0.4, 0.45, [0xd8ccb0, 0xc8bca0][Math.round(x * 2) % 2 ? 1 : 0]);
    }
  }
  // ---- el piso del laboratorio: baldosas blancas con juntas, franjas de peligro alrededor de la cápsula ----
  for (let x = Math.floor(cx - A) + 0.5; x < cx + A; x += 1) for (let z = Math.floor(cz - B) + 0.5; z < cz + B; z += 1) {
    if (kAt(x, z) > 0.97) continue;
    const pod = Math.abs(x - (-51)) < 2.6 && Math.abs(z - 90.5) < 2.6 && !(Math.abs(x + 51) < 1.6 && Math.abs(z - 90.5) < 1.6);
    const col = pod ? ((Math.floor(x + z) % 2) ? 0xe8c020 : 0x1a1a1a) : (hsh(x, 1, z) < 0.12 ? 0x9a9e98 : ((Math.floor(x) + Math.floor(z)) % 2 ? 0xc8ccc6 : 0xb8bcb4));
    lab.box(x, 0.02, z, 0.96, 0.04, 0.96, col);
    if (!pod && hsh(x, 2, z) < 0.05) goo.box(x + 0.2, 0.05, z, 0.5, 0.02, 0.4, 0xffffff);          // manchas de baba verde
  }
  // ---- el anillo (nivel 1) y la galería (nivel 2): reja de metal, borde amarillo, vigas por debajo ----
  const [ox1, ox2, oz1, oz2] = S.deck.outer, [ix1, ix2, iz1, iz2] = S.deck.inner;
  const ring = [[ox1, ox2, oz1, iz1], [ox1, ox2, iz2, oz2], [ox1, ix1, iz1, iz2], [ix2, ox2, iz1, iz2]];
  const deck = (rects, y) => {
    for (const [x1, x2, z1, z2] of rects) {
      for (let x = x1 + 0.5; x < x2; x += 1) for (let z = z1 + 0.5; z < z2; z += 1) {
        lab.box(x, y - 0.06, z, 0.98, 0.1, 0.98, 0x5a6068);
        for (let q = -0.3; q <= 0.31; q += 0.3) lab.box(x + q, y - 0.005, z, 0.04, 0.02, 0.96, 0x3a3e44);   // reja
      }
      for (const z of [z1 + 0.15, z2 - 0.15]) lab.box((x1 + x2) / 2, y - 0.35, z, x2 - x1, 0.4, 0.2, 0x2e3238);   // vigas
      for (const x of [x1 + 0.15, x2 - 0.15]) lab.box(x, y - 0.35, (z1 + z2) / 2, 0.2, 0.4, z2 - z1, 0x2e3238);
    }
  };
  deck(ring, Y); deck(S.lab2.walk, Y2);
  // barandas de metal (amarillas) en los bordes libres, salvo las llegadas de las escaleras y el hueco para tirarse
  const railsFor = (rects, y, gaps) => {
    const walk = (x, z) => rects.some(r => x >= r[0] && x < r[1] && z >= r[2] && z < r[3]);
    for (const [x1, x2, z1, z2] of rects) for (let x = x1; x < x2; x++) for (let z = z1; z < z2; z++) {
      const px0 = x + 0.5, pz0 = z + 0.5;
      for (const [on, ax, line, a] of [[!walk(px0 - 1, pz0), 'x', x, pz0], [!walk(px0 + 1, pz0), 'x', x + 1, pz0], [!walk(px0, pz0 - 1), 'z', z, px0], [!walk(px0, pz0 + 1), 'z', z + 1, px0]]) {
        if (!on || gaps.some(g => g[0] === ax && g[1] === line && a >= g[2] && a < g[3])) continue;
        const px = ax === 'x' ? line : a, pz = ax === 'x' ? a : line, G = 1.1;
        lab.box(px, y + G / 2, pz, 0.08, G, 0.08, 0xe8c020);
        lab.box(px, y + G, pz, ax === 'x' ? 0.1 : 1.02, 0.08, ax === 'x' ? 1.02 : 0.1, 0xe8c020);
        lab.box(px, y + 0.55, pz, ax === 'x' ? 0.05 : 1.0, 0.05, ax === 'x' ? 1.0 : 0.05, 0x8a8e94);
        lab.box(px, y + 0.06, pz, ax === 'x' ? 0.04 : 1.0, 0.12, ax === 'x' ? 1.0 : 0.04, 0x2a2a2a);   // zócalo
      }
    }
  };
  railsFor(ring, Y, [S.ramp.gap, S.jump]); railsFor(S.lab2.walk, Y2, [S.lab2.flight.gap]);
  // columnas de acero (con franja amarilla) del anillo y de la galería
  for (const [x, z] of S.posts) for (let y = 0; y < Y - 0.3; y += 0.5) lab.box(x, y + 0.25, z, 0.32, 0.5, 0.32, y > 0.4 && y < 1.1 ? 0xe8c020 : 0x4a4e54);
  for (const [x, z] of S.lab2.posts) for (let y = Y; y < Y2 - 0.3; y += 0.5) lab.box(x, y + 0.25, z, 0.3, 0.5, 0.3, 0x4a4e54);
  // escaleras de metal: la del hueco (piso -> anillo, sube hacia +x) y la de la galería (anillo -> nivel 2, sube hacia +z)
  const stairs = (F, y0, y1) => {
    const n = F.steps, along = F.axis === 'z', L = along ? F.z2 - F.z1 : F.x2 - F.x1, run = L / n;
    for (let q = 0; q < n; q++) {
      const a = (along ? F.z1 : F.x1) + (q + 0.5) * run, y = y0 + (q + 1) * (y1 - y0) / n;
      if (along) lab.box((F.x1 + F.x2) / 2, y - 0.05, a, F.x2 - F.x1 - 0.1, 0.1, run + 0.04, q % 2 ? 0x6a7078 : 0x5a6068);
      else lab.box(a, y - 0.05, (F.z1 + F.z2) / 2, run + 0.04, 0.1, F.z2 - F.z1 - 0.1, q % 2 ? 0x6a7078 : 0x5a6068);
    }
    for (const sdv of [0, 1]) for (let q = 0; q <= n; q += 2) {                                       // zancas y pasamanos
      const a = (along ? F.z1 : F.x1) + q * run, y = y0 + q * (y1 - y0) / n;
      const px = along ? (sdv ? F.x2 : F.x1) : a, pz = along ? a : (sdv ? F.z2 : F.z1);
      lab.box(px, y - 0.2, pz, 0.14, 0.4, 0.14, 0x2e3238); lab.box(px, y + 0.6, pz, 0.06, 1.1, 0.06, 0xe8c020);
    }
  };
  stairs(S.ramp, 0, Y); stairs(S.lab2.flight, Y, Y2);
  // ---- los equipos (los sólidos son PROPS: lab0..) ----
  const PURPLE = 0x9a4aff, LEDC = [0x3aff6a, 0xff3a3a, 0x3ab0ff, 0xffd23a];
  for (const [x, z, w, d, h, kind] of S.labProps) {
    if (kind === 'tank') {                                                 // tanque: base, vidrio que brilla, bicho adentro
      lab.box(x, 0.2, z, w + 0.2, 0.4, d + 0.2, 0x3a3e44); lab.box(x, h - 0.15, z, w + 0.2, 0.3, d + 0.2, 0x3a3e44);
      gls.box(x, h / 2, z, w, h - 0.7, d, 0x6affc0);
      voxBlob(lab, gw, x, h / 2, z, 0.4, 0.55, 0.35, 0.14, (a, b, c) => [pbHash(a, b, c) < 0.1 ? 0xff3a3a : 0x1a2418, pbHash(a, b, c) < 0.1]);   // espécimen
      for (let k = 0; k < 4; k++) gw.box(x + (rr() - 0.5) * 0.8, 0.6 + rr() * (h - 1.4), z + (rr() - 0.5) * 0.8, 0.07, 0.07, 0.07, 0xd8fff0);   // burbujas
      for (let k = 0; k < 3; k++) lab.box(x + w / 2 + 0.25, 0.3 + k * 0.4, z + (k - 1) * 0.3, 0.3, 0.12, 0.12, 0x1a1a1a);   // tubos
    } else if (kind === 'rack') {                                          // rack de servidores con luces
      lab.box(x, h / 2, z, w, h, d, 0x1e2226);
      for (let k = 0; k < 10; k++) { lab.box(x - w / 2 - 0.01, 0.2 + k * 0.22, z, 0.02, 0.16, d - 0.2, 0x2e3238);
        for (let j = 0; j < 5; j++) led.box(x - w / 2 - 0.03, 0.22 + k * 0.22, z - d / 2 + 0.25 + j * 0.3, 0.02, 0.05, 0.05, LEDC[(k + j) % 4]); }
    } else if (kind === 'desk') {                                          // escritorio con 2 monitores, teclado y papeles
      lab.box(x, h - 0.04, z, w, 0.08, d, 0xd8d4c8);
      for (const sx of [-1, 1]) lab.box(x + sx * (w / 2 - 0.1), (h - 0.08) / 2, z, 0.08, h - 0.08, d - 0.1, 0x6a6e74);
      for (const sx of [-0.55, 0.55]) { lab.box(x + sx, h + 0.35, z + 0.25, 0.8, 0.55, 0.06, 0x1a1a1a); gw.box(x + sx, h + 0.35, z + 0.215, 0.72, 0.46, 0.01, [0x3aff8a, 0x3a9aff][sx > 0 ? 1 : 0]); lab.box(x + sx, h + 0.05, z + 0.25, 0.1, 0.1, 0.1, 0x1a1a1a); }
      lab.box(x, h + 0.02, z - 0.15, 0.7, 0.03, 0.2, 0x2a2a2a);
      for (let k = 0; k < 4; k++) lab.box(x + (rr() - 0.5) * (w - 0.4), h + 0.005, z + (rr() - 0.5) * 0.4, 0.3, 0.01, 0.22, 0xf0ece0, 0, rr() * 3, 0);
      lab.box(x, 0.45, z - d / 2 - 0.5, 0.5, 0.08, 0.5, 0x2a2e34); lab.box(x, 0.8, z - d / 2 - 0.72, 0.5, 0.6, 0.06, 0x2a2e34);   // silla
    } else if (kind === 'table') {                                         // mesa de disección con la tortuga abierta
      lab.box(x, h - 0.05, z, w, 0.1, d, 0xb8bcc0);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lab.box(x + sx * (w / 2 - 0.1), (h - 0.1) / 2, z + sz * (d / 2 - 0.1), 0.08, h - 0.1, 0.08, 0x6a6e74);
      voxBlob(lab, gw, x, h + 0.2, z, 0.75, 0.25, 0.4, 0.12, (a, b, c) => [b > 0.08 ? 0x5a4626 : 0x9a3040, false]);   // caparazón abierto
      for (let k = 0; k < 6; k++) lab.box(x + (rr() - 0.5) * 1.6, h + 0.02, z + (rr() - 0.5) * 0.7, 0.2, 0.02, 0.2, 0x5a0a08);   // sangre
      for (let k = 0; k < 3; k++) lab.box(x + w / 2 - 0.2, h + 0.01, z - 0.3 + k * 0.2, 0.25, 0.02, 0.04, 0xd8dce0);            // bisturíes
    } else if (kind === 'pod') {                                           // cápsula de contención: vidrio rajado, embrión que brilla
      lab.box(x, 0.2, z, w + 0.3, 0.4, d + 0.3, 0x2e3238); lab.box(x, h - 0.2, z, w + 0.3, 0.4, d + 0.3, 0x2e3238);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lab.box(x + sx * w / 2, h / 2, z + sz * d / 2, 0.2, h, 0.2, 0x4a4e54);
      gls.box(x, h / 2, z, w - 0.1, h - 0.8, d - 0.1, 0x7aff9a);
      voxBlob(lab, gw, x, h / 2, z, 0.95, 0.8, 0.8, 0.16, (a, b, c) => {
        const f = pbHash(a, b, c); return f < 0.08 ? [0xb8ff6a, true] : [b > 0.2 ? 0x3a5a2a : 0x6a8a3a, false];
      });
      for (let k = 0; k < 8; k++) lab.box(x - 0.5 + k * 0.15, h - 0.6 - (k % 3) * 0.2, z + d / 2 - 0.02, 0.05, 0.4, 0.02, 0xd8fff0);   // rajadura
      for (let k = 0; k < 5; k++) lab.box(x + (k - 2) * 0.6, h + 0.3 + (k % 2) * 0.3, z, 0.18, 0.6, 0.18, 0x1a1a1a);             // cables arriba
    }
  }
  // barriles de riesgo biológico, cajas, trajes colgados, cables por el piso, lámparas colgando y dos balizas rojas
  for (const [x, z] of [[-41.5, 97.5], [-40.5, 96.5], [-62, 97], [-58, 78.5], [-43, 79]]) {
    lab.box(x, 0.5, z, 0.6, 1.0, 0.6, 0xe8c020); lab.box(x, 0.5, z + 0.301, 0.3, 0.3, 0.01, 0x1a1a1a);
  }
  for (const [x, z] of [[-65, 97.5], [-36.5, 79.5]]) for (let k = 0; k < 2; k++) lab.box(x, 0.4 + k * 0.8, z, 0.8, 0.8, 0.8, 0x7a6a4a);
  for (let k = 0; k < 3; k++) {                                            // trajes amarillos colgados en la galería
    const x = -58 + k * 1.2, z = 97.4;
    lab.box(x, Y2 + 1.1, z, 0.55, 0.8, 0.3, 0xe8d020); lab.box(x, Y2 + 1.6, z, 0.36, 0.36, 0.3, 0xe8d020); gw.box(x, Y2 + 1.62, z - 0.16, 0.24, 0.16, 0.01, 0x9adfff);
    lab.box(x - 0.15, Y2 + 0.5, z, 0.2, 0.5, 0.25, 0xe8d020); lab.box(x + 0.15, Y2 + 0.5, z, 0.2, 0.5, 0.25, 0xe8d020);
  }
  for (let k = 0; k < 14; k++) lab.box(-60 + k * 1.3, 0.05, 79.2 + Math.sin(k) * 0.3, 1.3, 0.06, 0.08, 0x1a1a1a);                // cable
  // F5.28f (Diego: "en el laboratorio que las lámparas iluminen un poco pero que titileen"): cada tubo es su propio mesh
  // (MeshBasic) con una mancha de luz fría en el piso de su nivel (plano aditivo) y luz falsa para los zombies; titilan
  // cada uno por su cuenta (updateShellFX). Sin luces de verdad
  const LL = S.labLamps, poolTex = radialTex('rgba(220,235,255,1)', 'rgba(160,190,255,.3)');
  for (const [x, z, y, fy] of [[-59, 87, Y - 0.6, 0], [-43, 87, Y - 0.6, 0], [-51, 81.5, Y - 0.6, 0], [-51, 96, Y - 0.6, 0], [-56, 95.5, Y2 + 2.8, Y2], [-45, 95.5, Y2 + 2.8, Y2]]) {
    lab.box(x, y + 0.4, z, 0.04, 0.8, 0.04, 0x2a2a2a); lab.box(x, y, z, 1.2, 0.08, 0.35, 0x3a3e44);
    const tube = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 0.28), new THREE.MeshBasicMaterial({ color: 0xf0f4ff }));
    tube.position.set(x, y - 0.05, z); tube.userData.theme = false; scene.add(tube);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(LL.r * 2, LL.r * 2), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: LL.opacity, polygonOffset: true, polygonOffsetFactor: -2 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, fy + 0.05, z); pool.userData.theme = false; scene.add(pool);
    fakeLightAdd(x, fy + 1.2, z, LL.r, 0xc8dcff, LL.light);
    SHELLFX.lamps.push({ tube, pool, k: 1, t: Math.random() * 3, cut: 0, light: FLIGHT.list[FLIGHT.list.length - 1] });
  }
  // galería (nivel 2): microscopios, estantes con frascos que brillan y la pared de monitores
  for (let k = 0; k < 3; k++) {
    const x = -48 + k * 2.2, z = 97.3;
    lab.box(x, Y2 + 0.45, z, 1.6, 0.9, 0.7, 0xd8d4c8);
    lab.box(x - 0.3, Y2 + 1.0, z, 0.14, 0.2, 0.14, 0x2a2a2a); lab.box(x - 0.3, Y2 + 1.2, z - 0.05, 0.08, 0.3, 0.08, 0x3a3e44);   // microscopio
    for (let j = 0; j < 5; j++) gw.box(x + 0.1 + j * 0.12, Y2 + 0.98, z + 0.1, 0.06, 0.14, 0.06, [0x3aff6a, 0xff4ad8, 0x3ab0ff][j % 3]);   // tubos de ensayo
  }
  for (let j = 0; j < 4; j++) for (let k = 0; k < 6; k++) {                // pared de monitores sobre la galería (mirando al hueco)
    const x = -58 + k * 1.1, y = Y2 + 1.6 + j * 0.62;
    lab.box(x, y, 97.85, 1.0, 0.56, 0.1, 0x111111);
    gw.box(x, y, 97.79, 0.9, 0.48, 0.01, [0x3aff8a, 0x2a6aff, 0xff3a3a, 0x3adfff][(j + k * 3) % 4]);
  }
  // ---- policías y científicos muertos, el que se están comiendo ----
  const blood = 0x5a0a08, skin = 0xc89a7a;
  const dead = (x, z, r, coat) => {
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (hsh(x + a, 7, z + b) < 0.7) mb.box(x + a * 0.4, 0.02, z + b * 0.4, 0.4, 0.02, 0.4, blood);
    mb.box(x, 0.16, z, 0.5, 0.28, 1.0, coat, 0, r, 0);
    mb.box(x + Math.sin(r) * 0.65, 0.15, z + Math.cos(r) * 0.65, 0.28, 0.28, 0.3, skin, 0, r, 0);
    mb.box(x - Math.sin(r) * 0.8, 0.1, z - Math.cos(r) * 0.8, 0.4, 0.18, 0.6, 0x1a1e2a, 0, r, 0);
  };
  S.bodies.forEach(([x, z, r], i) => dead(x, z, r, kAt(x, z) < 1 && i % 2 ? 0xe8e8e4 : 0x1e2a44));   // adentro, batas blancas
  const [kx, kz] = S.cop;
  for (let a = -2; a <= 2; a++) for (let b = -1; b <= 1; b++) mb.box(kx + a * 0.4, 0.02, kz + b * 0.4, 0.4, 0.02, 0.4, blood);
  mb.box(kx, 0.14, kz, 0.5, 0.24, 1.0, 0x1e2a44, 0, 0.3, 0); mb.box(kx + 0.2, 0.14, kz + 0.62, 0.28, 0.28, 0.3, skin, 0, 0.3, 0);
  for (let k = 0; k < 5; k++) mb.box(kx - 0.5 + k * 0.15, 0.06, kz - 0.2 + Math.sin(k) * 0.2, 0.14, 0.1, 0.14, 0x8a1a14);   // tripas
  // ---- afuera: jeep volcado, caballetes con cinta, carteles, la barricada D21 ----
  const J = S.jeep, jx = (J[0] + J[1]) / 2, jz = (J[2] + J[3]) / 2, jw = J[1] - J[0], jl = J[3] - J[2];
  mb.box(jx, 0.75, jz, jw, 0.9, jl, 0xe8e8e4, 0.04, 0, 0.06);
  mb.box(jx, 0.8, jz, jw + 0.02, 0.18, jl + 0.02, 0x1e2a44, 0.04, 0, 0.06);
  mb.box(jx, 1.45, jz + 0.3, jw - 0.2, 0.55, jl * 0.5, 0x2a2e34, 0.04, 0, 0.06);
  mb.box(jx, 1.78, jz + 0.2, 0.9, 0.12, 0.25, 0xc82020, 0.04, 0, 0.06); mb.box(jx + 0.25, 1.79, jz + 0.2, 0.4, 0.12, 0.26, 0x2040d8, 0.04, 0, 0.06);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mb.box(jx + sx * (jw / 2 + 0.1), 0.38, jz + sz * (jl / 2 - 0.8), 0.25, 0.7, 0.7, 0x151515);
  const D = S.door, dcx = (D.x1 + D.x2) / 2, zc = D.z - 3;
  for (const x of [dcx - 4.5, dcx + 4.5, dcx - 8]) {
    mb.box(x, 0.9, zc - (x < dcx - 6 ? 1.6 : 0), 1.4, 0.1, 0.1, 0xf0f0f0);
    for (const sx of [-0.6, 0.6]) mb.box(x + sx, 0.45, zc - (x < dcx - 6 ? 1.6 : 0), 0.08, 0.9, 0.5, 0x6a6a6a);
  }
  mb.box(dcx, 0.85, zc + 1.4, 9, 0.05, 0.05, 0xf0d020, 0, 0.12, 0);
  const dm = new MeshBuilder();
  for (let q = 0; q < 3; q++) dm.box(dcx, 0.3 + q * 0.38, D.z, D.x2 - D.x1 + 0.4, 0.22, 0.08, [0x8a6440, 0x7a5a38, 0x6a4a2a][q], 0, 0, (q - 1) * 0.07);
  for (const sd of [-1, 1]) dm.box(dcx + sd * 1.1, 0.6, D.z, 0.1, 1.2, 0.1, 0x5a3e24, 0, 0, sd * 0.3);
  for (let q = 0; q < 7; q++) dm.box(D.x1 + 0.3 + q * 0.57, 0.18, D.z + 0.35, 0.5, 0.36, 0.4, 0xa89868);   // bolsas de arena
  dm.box(dcx, 0.95, D.z - 0.06, D.x2 - D.x1 + 0.8, 0.06, 0.02, 0xf0d020, 0, 0, 0.05);
  const dmesh = dm.mesh(MAT.grimeV), door = state.doors[D.id];
  if (dmesh && door) { scene.remove(dmesh); dmesh.userData.theme = false; dmesh.matrixAutoUpdate = true; dmesh.position.copy(door.mesh.position).negate(); door.mesh.add(dmesh); }
  // ---- el cráneo sobre la boca y el otro tirado en el claro ----
  { const sk = new MeshBuilder();
    turtleSkull(sk, cx, 4.8, cz - B + 0.6, 1.5, 0, 0, rr);
    const TS = S.skull2; turtleSkull(sk, TS.x, TS.y, TS.z, TS.k, TS.ry, TS.roll, rr);
    sk.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })).userData.theme = false; }
  // ---- el claro: charcos de sangre verde de la trampa y rocas contra los bordes ----
  { const MT = CONFIG.TRAPS.mariachi;
    MT.puddles.forEach(([px, pz], i) => {
      const w = 2.3 + (i % 3) * 0.5;
      for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if ((a / 3) ** 2 + (b / 3) ** 2 <= 1) goo.box(px + a * w / 3.2, 0.03, pz + b * w / 4, w / 3.2, 0.04, w / 4, 0xffffff);
      // F5.28f (Diego: "que los charcos iluminen un poco a su alrededor"): el halo más grande y luz falsa verde para los
      // zombies que pasan
      halo.add(UNIT_PLANE, px, 0.07, pz, w * S.puddleGlow, w * S.puddleGlow, 1, -Math.PI / 2, 0, 0, 0xffffff);
      fakeLightAdd(px, 0.5, pz, w * S.puddleGlow * 0.5, 0x7dff4a, 0.8);
      for (let q = 0; q < 4; q++) { const a = q * 1.6 + i, d = w + 0.45, s = 0.4 + (q % 2) * 0.25; rk.box(px + Math.cos(a) * d, s / 2, pz + Math.sin(a) * d * 0.8, s, s * 0.6, s, [0x7e7e7c, 0x6a6a6a][q % 2], 0, a, 0); }
    });
    const Rm = ROOMS.filter(r => r.id === 'R17' && !r.corridor);
    for (const r of Rm) for (let k = 0; k < 12; k++) {
      const side = k % 4, t = 0.08 + rr() * 0.84;
      const x = side < 2 ? r.x1 + t * (r.x2 - r.x1) : (side === 2 ? r.x1 + 0.6 : r.x2 - 0.6);
      const z = side < 2 ? (side === 0 ? r.z1 + 0.6 : r.z2 - 0.6) : r.z1 + t * (r.z2 - r.z1);
      if (kAt(x, z) < 1.3 || roomAt(x, z) !== r || MT.puddles.some(([a, b]) => Math.hypot(a - x, b - z) < 4)) continue;
      const s = 1.0 + rr() * 0.9;
      rk.box(x, s * 0.35, z, s, s * 0.7, s * 0.9, [0x8c8c8a, 0x7a7a7a, 0x9c9a98][k % 3], 0, rr() * 3, 0);
    }
  }
  // ---- materiales y mallas ----
  const put = (B2, mat) => { const m = B2.mesh(mat); if (m) { m.userData.theme = false; m.updateMatrix(); } return m; };
  put(ex, new THREE.MeshLambertMaterial({ vertexColors: true }));
  put(lab, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x141418 }));
  put(rk, MAT.rock); put(mb, MAT.grimeV); put(wd, MAT.bark);
  put(gw, new THREE.MeshBasicMaterial({ vertexColors: true }));
  put(gls, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false }));
  SHELLFX.leds = put(led, new THREE.MeshBasicMaterial({ vertexColors: true }));
  SHELLFX.goo = new THREE.MeshBasicMaterial({ color: CONFIG.SHELL.goo || 0x7dff4a, vertexColors: true });
  put(goo, SHELLFX.goo);
  SHELLFX.halo = new THREE.MeshBasicMaterial({ map: radialTex('rgba(150,255,110,1)', 'rgba(60,200,40,.45)'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true, opacity: 0.5 });
  put(halo, SHELLFX.halo);
  // balizas rojas que giran en la galería y en la boca (MeshBasic: ninguna luz nueva)
  SHELLFX.beacons = [];
  for (const [x, y, z] of [[-40.5, Y2 + 1.4, 93.4], [-60.2, Y2 + 1.4, 93.4], [cx - 3.2, 3.8, cz - B + 1.2]]) {
    const g = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.28), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    fl.position.x = 0.8; g.add(m); g.add(fl); g.position.set(x, y, z); scene.add(g); SHELLFX.beacons.push(g);
  }
  // gotas de baba que caen de las costillas (un InstancedMesh, sin crear nada en el juego)
  for (let k = 0; k < 10; k++) {
    const x = cx + (rr() - 0.5) * A, z = cz + (rr() - 0.5) * B * 1.2, y0 = hAt(x, z) - 1.3;
    if (y0 < Y2 + 3) continue;
    SHELLFX.drops.push({ x, z, y0, y: y0 - rr() * 3, v: 0 });
    for (let q = 0; q < 3; q++) goo.box(x, y0 + 0.3 + q * 0.2, z, 0.08, 0.2, 0.08, 0xffffff);
  }
  const dg = new THREE.BoxGeometry(0.1, 0.12, 0.1), dmat = new THREE.MeshBasicMaterial({ color: 0x9dff6a });
  SHELLFX.dropMesh = new THREE.InstancedMesh(dg, dmat, Math.max(1, SHELLFX.drops.length));
  SHELLFX.dropMesh.userData.theme = false; scene.add(SHELLFX.dropMesh);
  // carteles: cuarentena en la boca, peligro biológico y el del laboratorio
  const sign = (t1, t2, x, y, z, ry, w, bg, fg) => {
    const tex = makeTex((c, s) => { c.fillStyle = bg; c.fillRect(0, 0, s, s); c.fillStyle = fg; c.textAlign = 'center';
      c.font = 'bold ' + Math.floor(s * 0.19) + 'px monospace'; c.fillText(t1, s / 2, s * 0.42);
      c.font = 'bold ' + Math.floor(s * 0.12) + 'px monospace'; c.fillText(t2, s / 2, s * 0.66); }, 1, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.5), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; m.userData.theme = false; scene.add(m);
  };
  sign('QUARANTINE', 'POLICE LINE', dcx - 6.3, 1.3, D.z - 3.4, 0.3, 1.3, '#f0d020', '#1a1a1a');
  sign('BIOHAZARD', 'DO NOT ENTER', dcx + 6, 1.5, D.z - 2.9, -0.2, 1.2, '#e8e8e0', '#b01818');
  sign('SPECIMEN C-34B', 'CONTAINMENT: FAILED', -44.5, Y2 + 2.3, 97.8, Math.PI, 2.6, '#1a1e24', '#ff4a3a');   // en la pared de la galería, se lee desde el hueco
  // los que comen: figuras de zombie arrodilladas (un grupo por cada uno, con los brazos aparte)
  const zskin = CONFIG.ZOMBIE.skinColor;
  for (const [x, z, r] of S.feeders) {
    const g = new THREE.Group(), b = new MeshBuilder();
    b.box(0, 0.25, -0.1, 0.5, 0.3, 0.7, 0x3f3a33);
    b.box(0, 0.75, 0.05, 0.56, 0.62, 0.3, 0x5a4a3a, 0.45, 0, 0);
    b.box(0, 1.08, 0.32, 0.4, 0.4, 0.4, zskin, 0.3, 0, 0);
    b.box(-0.09, 1.1, 0.53, 0.08, 0.05, 0.02, 0xffdd33); b.box(0.09, 1.1, 0.53, 0.08, 0.05, 0.02, 0xffdd33);
    b.box(0, 0.98, 0.53, 0.2, 0.06, 0.02, blood);
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
  SHELLFX.halo.opacity = CONFIG.SHELL.haloOpacity[0] + CONFIG.SHELL.haloOpacity[1] * k;
  // F5.28f: los tubos del laboratorio titilan: prendidos con un zumbido leve, y cada tanto se cortan en ráfagas cortas
  const LL = CONFIG.SHELL.labLamps;
  for (const L of SHELLFX.lamps) {
    if ((L.t -= dt) <= 0) { L.cut = 1 + Math.floor(Math.random() * 4); L.t = LL.every[0] + Math.random() * (LL.every[1] - LL.every[0]); }
    let on = 0.88 + 0.12 * Math.sin(t * 60 + L.pool.position.x);
    if (L.cut > 0) { const blink = Math.sin(t * 38 + L.pool.position.z) > 0; on = blink ? 0.9 : 0.08; if (Math.random() < dt * 6) L.cut--; }
    L.k = on;
    L.tube.material.color.setRGB(0.94 * on, 0.96 * on, on);
    L.pool.material.opacity = LL.opacity * on;
    if (L.light) L.light.k = LL.light * on;
  }
  for (const s of SHELLFX.shafts) s.material.opacity = 0.16 + 0.08 * Math.sin(t * 0.7);
  // F5.22: los racks titilan y las balizas giran. F5.24: sin energía, los LEDs quedan casi negros y las balizas apagadas
  const pw = state.power;
  if (SHELLFX.leds) { const b = !pw ? 0.06 : Math.sin(t * 9) > 0 ? 1 : 0.35; SHELLFX.leds.material.color.setRGB(b, b, b); }
  for (let i = 0; i < SHELLFX.beacons.length; i++) { SHELLFX.beacons[i].visible = pw; if (pw) SHELLFX.beacons[i].rotation.y = t * 3 + i; }
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

// F5.18: el cráneo de la tortuga gigante (centro kx, ky, kz; escala K; mira a -z local). F5.19c: función aparte para
// poner otro tirado en el claro; ry lo gira y roll lo acuesta de costado
function turtleSkull(sk, kx, ky, kz, K, ry, roll, rr) {
  const kBone = 0xd8ccb0, kBoneD = 0xb8a88a, kHole = 0x1a120c, cr = Math.cos(roll), sr = Math.sin(roll), cy = Math.cos(ry), sy = Math.sin(ry);
  const P = (x, y, z) => {
    const x1 = x * cr - y * sr, y1 = x * sr + y * cr;                    // roll (sobre z)
    return [kx + (x1 * cy + z * sy) * K, ky + y1 * K, kz + (-x1 * sy + z * cy) * K];
  };
  const sph = (x, y, z, a, b2, c, col, seg) => { const q = P(x, y, z); sk.sphere(q[0], q[1], q[2], a * K, b2 * K, c * K, col, seg, 0, ry, roll); };
  sph(0, 0.3, 0.6, 1.05, 0.85, 1.35, kBone, 14);                          // bóveda (cuña ancha atrás)
  sph(0, 0.05, -0.5, 0.85, 0.7, 0.95, kBone, 12);                          // cara
  sph(0, -0.1, -1.25, 0.55, 0.5, 0.5, kBoneD, 10);                         // hocico
  sk.tube([P(0, 0.25, -1.3), P(0, 0.05, -1.75), P(0, -0.45, -1.8), P(0, -0.75, -1.55)], 0.3 * K, 0.06 * K, kBoneD, 10, 7);   // pico ganchudo hacia abajo
  for (const s2 of [-1, 1]) {
    sph(s2 * 0.62, 0.12, -0.55, 0.3, 0.45, 0.48, kHole, 10);              // cuencas grandes, al frente y a los costados
    sk.tube([P(s2 * 0.5, 0.55, -0.2), P(s2 * 0.82, 0.35, -0.55), P(s2 * 0.72, -0.25, -0.8), P(s2 * 0.4, -0.35, -0.85)], 0.09 * K, 0.07 * K, kBoneD, 10, 6);   // arco de la cuenca
    sph(s2 * 0.13, 0.02, -1.62, 0.07, 0.09, 0.06, kHole, 6);               // narinas
    sk.tube([P(s2 * 0.9, -0.15, 0.4), P(s2 * 0.95, -0.55, -0.3), P(s2 * 0.6, -0.8, -1.1), P(s2 * 0.12, -0.85, -1.5)], 0.14 * K, 0.08 * K, kBone, 12, 6);   // mandíbula
    sph(s2 * 0.95, 0.25, 0.7, 0.3, 0.5, 0.6, kBoneD, 10);                  // sien
  }
  sk.tube([P(0, 1.05, 1.7), P(0, 1.1, 0.5), P(0, 0.75, -0.5)], 0.12 * K, 0.05 * K, kBoneD, 8, 6);   // cresta
  for (let i = 0; i < 5; i++) sk.tube([P(-0.5 + i * 0.25, 1.0, 0.3 + i * 0.1), P(-0.35 + i * 0.22, 0.7, -0.2), P(-0.45 + i * 0.26, 0.25, -0.3)], 0.02, 0.012, 0x3a2e22, 5, 4);   // grietas
  for (let i = 0; i < 6; i++) { const q = P((rr() - 0.5) * 1.6, 0.7 + rr() * 0.4, rr() * 1.2); sk.blob(q[0], q[1], q[2], 0.35, 0.12, 0.35, 0x5a7a3a, i); }   // musgo
  for (let i = 0; i < 3; i++) sk.tube([P(-0.7 + i * 0.7, 0.8, 0.3), P(-0.6 + i * 0.7, -0.3, -0.4), P(-0.65 + i * 0.7, -1.0 - i * 0.2, -0.5)], 0.03, 0.02, 0x3f5a2a, 6, 4);   // lianas
}

function resetBunker() {
  const was = BUNK.open;
  BUNK.open = false; BUNK.fadeT = 0; BUNK.fadeTo = null; BUNK.shellVoice = false; BUNK.travel = null;
  if (UI.travel) { UI.travel.style.opacity = '0'; UI.travel.style.display = 'none'; }
  resetPortals();                                                                      // F5.16
  resetPlantBoss();                                                                    // F5.20
  resetPolice();
  resetBeast();                                                                        // F5.26: barriles y escalera
  if (UI.fade) UI.fade.style.opacity = '0';
  if (BUNK.lid) {
    BUNK.halves[0].position.x = -1.1; BUNK.halves[1].position.x = 1.1;               // puertas cerradas
    BUNK.lamp.material.color.setHex(0xff2a1a); BUNK.seahorse.visible = false;
  }
  for (const s of BUNK.statues) {
    s.kills = 0; s.crawlers = 0; s.dogs = 0; s.awake = false; s.done = false; s.prey = null; s.eatT = 0;
    const E = CONFIG.BUNKER.entrance, out = (E.face || 1) > 0 ? 0 : Math.PI;
    s.head.position.copy(s.base); s.head.rotation.set(0, E.axis === 'x' ? out + Math.PI / 2 : out, 0);
    statueLook(s, 'stone');
  }
  if (was) buildNavGrid();                         // saca el enlace de la escotilla
}
