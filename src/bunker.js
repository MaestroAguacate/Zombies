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
    c.font = 'bold ' + Math.floor(s * 0.13) + 'px monospace'; c.fillText('FUERA DE', s / 2, s * 0.45); c.fillText('SERVICIO', s / 2, s * 0.65);
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
    c.font = 'bold ' + Math.floor(s * 0.2) + 'px monospace'; c.fillText('BÚNKER', s / 2, s * 0.45);
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
  showBanner('SE ABRIÓ EL BÚNKER', 3);
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
  if (!BUNK.open) return { text: 'Búnker cerrado', cost: 0 };
  return { text: t.down ? '[F] Bajar al búnker' : '[F] Subir al jardín', cost: 0 };
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
  if (BUNK.open && BUNK.halves[0].position.x > -2.3) {                               // F5.13: las puertas se corren
    const x = Math.max(-2.3, BUNK.halves[0].position.x - dt * 1.2);
    BUNK.halves[0].position.x = x; BUNK.halves[1].position.x = -x;
  }
  if (BUNK.fadeT > 0) {                                                               // negro a mitad: teletransporte
    const F = CONFIG.BUNKER.fade;
    BUNK.fadeT = Math.max(0, BUNK.fadeT - dt);
    if (!BUNK.fadeDone && BUNK.fadeT <= F) { BUNK.fadeDone = true; hatchTeleport(BUNK.fadeTo); }
    const o = BUNK.fadeT > F ? 1 - (BUNK.fadeT - F) / F : BUNK.fadeT / F;
    if (UI.fade) UI.fade.style.opacity = Math.max(0, Math.min(1, o)).toFixed(3);
  }
}
function inBunker() { return groundY(player.pos.x, player.pos.z) < -1; }

function resetBunker() {
  const was = BUNK.open;
  BUNK.open = false; BUNK.fadeT = 0; BUNK.fadeTo = null;
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
