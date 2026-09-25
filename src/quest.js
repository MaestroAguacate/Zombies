//=== 7e. QUEST DE LA OLA ROMPIENTE (V2 F5.5) ===============================
// 3 piezas, en cualquier orden, una vez por partida (state.quest):
//  - coco: por partida se sortea una de las 4 palmeras (QUEST.palm), sin marca. Solo un golpe de MACHETE a su
//    tronco (meleeAttack -> hitPalm) la voltea; el coco queda en la arena, se pone dorado y se recoge con F.
//  - cuerda de guitarra: la suelta El Sombrerón al morir (bossDeath -> dropString), una sola vez.
//  - caracola (F5.9, reemplaza a la granada en el agua): está sobre una tortuga bailarina en el techo del
//    sótano, opaca. Cuando QUEST.plantsNeeded plantas carnívoras se comieron plantEat arrastrados cada una
//    (garden.js plantEat) brilla; un tiro (traceShot -> shootShell) la tira en arco al jardín oeste. Mientras
//    está opaca, la bala le pega como a una pared. Su caja de tiro está en WORLD.hitMeshes (sin collider).
// Las piezas en el piso se recogen con F desde su cuarto y su nivel (al punto, como las del escudo). Sin
// colliders: no tocan el grid ni frenan balas.
// Taller de tablas (F5.6: al fondo del jardín oeste, contra el garaje; cuerpo sólido invisible como las
// reliquias, dentro del anillo no navegable): con las 3, mantener F CONFIG.QUEST.craftTime s. La Ola entra al inventario como un arma más
// (reemplaza la equipada si tenés 2) y la quest queda armada: si la perdés (Quick Revive, loseWave) o la
// cambiás, se vuelve a sacar del taller con la munición que tenía (QUEST.slot es el mismo objeto de slot).
const QUEST = { palm: 0, fallT: -1, coco: null, string: null, shell: null, shop: null, shopModel: null, craftT: 0,
                slot: null, fx: null, fxParts: null, fxT: 0, fxR: 8, turtle: null, shrimp: null };
const _qv = new THREE.Vector3(), _qd = new THREE.Vector3(), _qc = new THREE.Color();

function buildQuest() {
  const Q = CONFIG.QUEST;
  // coco: aparece cuando cae la palmera; marrón que pasa a dorado, con brillo
  const cg = new THREE.Group();
  const cm = new THREE.Mesh(new THREE.BoxGeometry(Q.cocoSize, Q.cocoSize, Q.cocoSize), new THREE.MeshLambertMaterial({ color: Q.cocoColor }));
  cg.add(cm);
  const cglow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({
    map: radialTex('rgba(255,225,120,.9)', 'rgba(255,190,60,.3)'), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  cglow.position.y = 0.2;
  cg.add(cglow);
  cg.visible = false; scene.add(cg);
  QUEST.coco = { kind: 'coco', name: 'GOLDEN COCONUT', phase: 'none', room: 'R10', level: 0, x: 0, z: 0, vy: 0, t: 0,
                 g: cg, mesh: cm, glow: cglow };
  // cuerda de guitarra: rollo dorado con brillo (se ve desde lejos)
  const sg = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 18), new THREE.MeshBasicMaterial({ color: 0xe8c050 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.03;
  sg.add(ring);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({
    map: radialTex('rgba(255,230,140,.9)', 'rgba(255,200,80,.3)'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.y = 0.3;
  sg.add(glow);
  sg.visible = false; scene.add(sg);
  QUEST.string = { kind: 'string', name: 'GUITAR STRING', phase: 'none', room: null, level: 0, x: 0, z: 0, g: sg, glow };
  // caracola (F5.9): arriba de la tortuga. F5.13: en la cabeza del calamar
  buildSquidHead();
  buildTurtle();
  const shg = new THREE.Group();
  const shMat = new THREE.MeshLambertMaterial({ color: 0xb8a498 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 7), shMat);
  cone.rotation.z = Math.PI / 2; cone.position.y = 0.13;
  shg.add(cone);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.13, 0.21), shMat);
  lip.position.set(-0.13, 0.1, 0); shg.add(lip);
  const shGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({
    map: radialTex('rgba(255,240,200,.95)', 'rgba(255,170,220,.35)'), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  shGlow.position.y = 0.15; shg.add(shGlow);
  // caja de tiro invisible, más grande que la caracola (el raycaster de r128 no mira .visible)
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), new THREE.MeshBasicMaterial());
  hit.visible = false; hit.position.y = 0.15; hit.userData = { type: 'questShell' };
  shg.add(hit);
  scene.add(shg);
  WORLD.hitMeshes.push(hit);
  QUEST.shell = { kind: 'shell', name: 'CONCH SHELL', phase: 'dull', room: Q.shellLand.room, level: 0, x: 0, z: 0, t: 0,
                  g: shg, mat: shMat, glow: shGlow, hit, from: new THREE.Vector3(), to: new THREE.Vector3() };
  placeShellOnTurtle();

  buildWorkshop();

  // la ola: láminas curvas (cilindros abiertos, solo el arco del cono) que se abren hasta el alcance.
  // F5.14: más alta, con cresta de espuma, anillo de espuma en el piso y salpicadura (un Points). Todo creado una vez
  const W = CONFIG.WEAPONS.wave, half = W.coneDeg * Math.PI / 180, a0 = Math.PI - half, al = 2 * half;
  const mat = (color, side) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: side || THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false });
  const fx = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.85, 2.6, 28, 1, true, a0, al), mat(0x8ad8ff));
  wall.position.y = 1.3;
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.8, 2.0, 28, 1, true, a0, al), mat(0x2a7ad8));
  inner.position.y = 1.0;
  const crest = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.1, 0.35, 28, 1, true, a0, al), mat(0xffffff));
  crest.position.y = 2.65;
  const foam = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.05, 28, 1, Math.PI / 2 - half, al), mat(0xe8f8ff));
  foam.rotation.x = -Math.PI / 2; foam.position.y = 0.05;
  const N = 48, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {                                     // gotas a lo largo del arco (radio 1: escala con la ola)
    const a = a0 + Math.random() * al, r = 0.9 + Math.random() * 0.3;
    pos[i * 3] = Math.sin(a) * r; pos[i * 3 + 1] = 1.6 + Math.random() * 1.6; pos[i * 3 + 2] = Math.cos(a) * r;
  }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const spray = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  fx.add(wall, inner, crest, foam, spray);
  fx.visible = false; scene.add(fx);
  QUEST.fx = fx;
  QUEST.fxParts = { wall, inner, crest, ring: foam, spray };
}

// taller de tablas de surf: mesa sólida (collider + hitMesh invisibles, como las reliquias) y el resto en un
// MeshBuilder: tabla a medio lijar, herramientas, tablas contra la cerca, estante con tablas y toldo a rayas
function buildWorkshop() {
  const S = CONFIG.QUEST.workshop, mb = new MeshBuilder();
  const r = relicBody(mb, S, S, 0x6e5034, 'quest:taller', 'world');   // marco local: +z = hacia la playa
  const h = S.h;
  mb.box(0, h + 0.03, 0, S.w + 0.1, 0.06, S.d + 0.1, 0x9a7048);                     // tablón de arriba
  for (let x = -0.8; x <= 0.81; x += 0.8) mb.box(x, h * 0.55, S.d / 2 + 0.005, 0.7, 0.3, 0.01, 0x5a3e26);   // cajones
  mb.box(-0.35, h + 0.09, 0.02, 1.6, 0.05, 0.44, 0x3a8ac8);                         // tabla a medio lijar
  mb.box(-0.35, h + 0.092, 0.02, 1.6, 0.052, 0.06, 0xf0ead8);
  mb.box(0.75, h + 0.1, 0.12, 0.22, 0.08, 0.1, 0x8a8a88);                           // cepillo
  mb.box(0.95, h + 0.08, -0.1, 0.1, 0.05, 0.1, 0xd8322a);                           // lata de resina
  // tablas apoyadas contra la pared, al lado de la mesa
  [[-1.6, 0xd8c060], [-2.15, 0x3a7ab8], [-2.7, 0xc86a3a]].forEach(([x, col], k) => {
    mb.box(x, 1.02, -0.12, 0.46, 2.1, 0.07, col, -0.16, 0, (k - 1) * 0.05);
    mb.box(x, 1.02, -0.08, 0.47, 0.08, 0.075, 0xf0ead8, -0.16, 0, (k - 1) * 0.05);
  });
  // estante contra la pared, del otro lado de la mesa, con tablas acostadas (F5.6: a lo largo de la pared)
  [1.7, 4.1].forEach(x => mb.box(x, 0.8, -0.2, 0.08, 1.6, 0.08, 0x5a4030));
  [[0.45, 0x3a8ac8], [0.85, 0xe8d8b0], [1.25, 0x5aa86a]].forEach(([y, col]) => {
    mb.box(2.9, y - 0.05, -0.1, 2.5, 0.04, 0.3, 0x5a4030);
    mb.box(2.9, y + 0.01, -0.1, 2.3, 0.06, 0.42, col);
  });
  // toldo a rayas en voladizo desde la cerca (sin postes adelante: no toca el grid)
  [-1.35, 1.35].forEach(x => mb.box(x, 1.35, -0.3, 0.1, 2.7, 0.1, 0x5a4030));
  [-1.35, 1.35].forEach(x => mb.box(x, 2.2, 0.35, 0.06, 0.06, 1.5, 0x5a4030, -0.62, 0, 0));   // tornapuntas
  for (let i = 0; i < 6; i++)
    mb.box(-1.5 + 0.55 * i + 0.275, 2.58, 0.6, 0.55, 0.04, 2.0, i % 2 ? 0xd8d0bc : 0x2f7ab0, 0.15, 0, 0);
  mb.setFrame(null);
  const merged = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  merged.userData.theme = false;                                 // MeshBuilder lo marca como tema: esto es lógica
  merged.updateMatrix();
  // cartel
  const tex = makeTex((c, s) => {
    c.fillStyle = '#e8dcc0'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#2f7ab0'; c.fillRect(0, s * 0.72, s, s * 0.1);
    c.fillStyle = '#3a2a1c'; c.textAlign = 'center';
    c.font = 'bold ' + Math.floor(s * 0.2) + 'px monospace'; c.fillText('BOARD', s / 2, s * 0.34);
    c.font = 'bold ' + Math.floor(s * 0.13) + 'px monospace'; c.fillText('WORKSHOP', s / 2, s * 0.6);
  }, 1, 128);
  tex.magFilter = THREE.LinearFilter;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshLambertMaterial({ map: tex }));
  sign.position.set(0, 2.2, 1.62);
  r.g.add(sign);
  // la Ola arriba de la mesa cuando está armada y no la tenés
  const wm = buildWeaponModel(CONFIG.WEAPONS.wave);
  wm.scale.setScalar(1.6); wm.position.set(0.3, h + 0.2, 0.05); wm.rotation.set(0, Math.PI / 2, 0.1);
  wm.visible = false; r.g.add(wm);
  r.g.updateMatrixWorld(true);
  QUEST.shop = { room: S.room, col: r.col, g: r.g };
  QUEST.shopModel = wm;
}

//--- piezas ---
// golpe de cuerpo a cuerpo contra algo: si es el tronco de una palmera y tenés el machete, lo maneja (true).
// La sorteada se voltea (una vez); las otras, golpe seco. Con el cuchillo, false: marca normal
function hitPalm(obj) {
  if (!CONFIG.QUEST.palmCoco) return false;                      // F5.14: la pieza sale de la almeja morada
  const i = CONFIG.QUEST.palms.findIndex(P => { const p = PROPS.find(q => q.id === P.prop); return p && p.collider.mesh === obj; });
  if (i < 0 || !state.machete) return false;
  if (i === QUEST.palm && QUEST.fallT < 0 && !state.quest.coconut && !state.quest.built) {
    QUEST.fallT = 0;
    sfxPalmCrack();
  } else sfxCoconut(false);
  return true;
}
// dónde queda la copa con la palmera volteada: sobre la línea en la que se inclina, adentro de la playa
function cocoSpot(P) {
  const Q = CONFIG.QUEST, t = palmTop(P), A = Math.PI / 2 - 0.08, a = Q.cocoArea;
  const d = t.px * Math.cos(A) + t.py * Math.sin(A);
  return { x: Math.max(a.x1, Math.min(a.x2, P.x + d * Math.cos(P.rot))), z: Math.max(a.z1, Math.min(a.z2, P.z - d * Math.sin(P.rot))) };
}
function dropString(z) {
  const S = QUEST.string, room = roomAt(z.px, z.pz);
  if (state.quest.string || state.quest.built || S.phase !== 'none' || !room) return false;
  S.phase = 'ground'; S.room = room.id; S.level = z.level || 0; S.x = z.px; S.z = z.pz;
  S.g.position.set(z.px, S.level === 1 ? UP.y : groundY(z.px, z.pz), z.pz);
  S.g.visible = true;
  return true;
}
// F5.9: tortuga bailarina de piedra en el techo del sótano (solo visual: el techo ahí no es caminable).
// Parada en las patas de atrás, caparazón, brazos arriba sosteniendo la caracola. Se mece cuando brilla
function buildTurtle() {
  const T = CONFIG.QUEST.turtle, g = new THREE.Group(), mb = new MeshBuilder();
  const stone = 0x6f8a6a, shell = 0x4f6a48, belly = 0xb8b08a;
  mb.box(0, 0.12, 0, 1.0, 0.24, 1.0, 0x8a8478);                            // pedestal
  mb.box(-0.2, 0.42, 0.05, 0.2, 0.4, 0.22, stone, 0, 0, 0.15);             // patas de atrás (una levantada)
  mb.box(0.24, 0.5, 0.05, 0.2, 0.4, 0.22, stone, 0, 0, -0.5);
  mb.box(0, 1.0, -0.12, 0.72, 0.9, 0.36, shell);                           // caparazón
  for (let i = 0; i < 3; i++) mb.box(0, 0.75 + i * 0.24, -0.31, 0.5 - i * 0.08, 0.16, 0.04, 0x3e5a3a);
  mb.box(0, 1.0, 0.1, 0.56, 0.8, 0.14, belly);                             // panza
  for (let i = 0; i < 3; i++) mb.box(0, 0.74 + i * 0.26, 0.18, 0.5, 0.02, 0.02, 0x8a8260);
  mb.box(0, 1.6, 0.08, 0.3, 0.3, 0.32, stone);                             // cabeza
  mb.box(-0.08, 1.64, 0.25, 0.06, 0.06, 0.02, 0x1a1a1a); mb.box(0.08, 1.64, 0.25, 0.06, 0.06, 0.02, 0x1a1a1a);
  mb.box(0, 1.52, 0.25, 0.14, 0.03, 0.02, 0x2a2a2a);                       // sonrisa
  mb.box(-0.3, 1.72, 0.05, 0.14, 0.5, 0.14, stone, 0, 0, -0.35);           // brazos arriba, hacia la caracola
  mb.box(0.3, 1.72, 0.05, 0.14, 0.5, 0.14, stone, 0, 0, 0.35);
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.remove(m); g.add(m);
  m.matrixAutoUpdate = true; m.userData.theme = false;           // es de la quest, no del tema
  g.position.set(T.x, SQHEAD.dy, T.z);
  g.scale.setScalar(T.scale);
  scene.add(g);
  QUEST.turtle = g;
  buildShrimp();
}
// F5.10: langostino de piedra rosada bailando (cola arriba, pinzas abiertas). Solo visual; aparece con las 3
// cajas de almas llenas (updateQuest) y baila
function buildShrimp() {
  const T = CONFIG.QUEST.shrimp, g = new THREE.Group(), mb = new MeshBuilder();
  const shell = 0xd86a4a, dark = 0xa84a32, pale = 0xf0a080;
  mb.box(0, 0.12, 0, 1.0, 0.24, 1.0, 0x8a8478);                            // pedestal
  mb.box(-0.12, 0.42, 0, 0.1, 0.36, 0.1, dark, 0, 0, 0.2);                  // patitas
  mb.box(0.12, 0.42, 0, 0.1, 0.36, 0.1, dark, 0, 0, -0.2);
  for (let i = 0; i < 5; i++) mb.box(0, 0.62 + i * 0.2, -0.02 * i, 0.4 - i * 0.03, 0.2, 0.34 - i * 0.02, i % 2 ? shell : pale);   // cuerpo segmentado
  mb.box(0, 1.72, 0.06, 0.34, 0.3, 0.4, shell, 0.3, 0, 0);                  // cabeza
  mb.box(-0.08, 1.8, 0.27, 0.06, 0.06, 0.02, 0x1a1a1a); mb.box(0.08, 1.8, 0.27, 0.06, 0.06, 0.02, 0x1a1a1a);
  mb.box(-0.06, 2.05, 0.2, 0.02, 0.6, 0.02, dark, 0.6, 0, -0.3);            // antenas largas
  mb.box(0.06, 2.05, 0.2, 0.02, 0.6, 0.02, dark, 0.6, 0, 0.3);
  mb.box(-0.36, 1.45, 0.1, 0.1, 0.5, 0.1, shell, 0, 0, -0.8);               // brazos arriba
  mb.box(0.36, 1.45, 0.1, 0.1, 0.5, 0.1, shell, 0, 0, 0.8);
  mb.box(-0.6, 1.72, 0.1, 0.22, 0.14, 0.14, dark, 0, 0, -0.4);              // pinzas abiertas
  mb.box(-0.62, 1.84, 0.1, 0.18, 0.08, 0.12, shell, 0, 0, -0.1);
  mb.box(0.6, 1.72, 0.1, 0.22, 0.14, 0.14, dark, 0, 0, 0.4);
  mb.box(0.62, 1.84, 0.1, 0.18, 0.08, 0.12, shell, 0, 0, 0.1);
  mb.box(0, 0.5, -0.3, 0.4, 0.1, 0.3, dark, -0.5, 0, 0);                    // abanico de la cola
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.remove(m); g.add(m);
  m.matrixAutoUpdate = true; m.userData.theme = false;
  g.position.set(T.x, SQHEAD.dy, T.z);
  g.scale.setScalar(T.scale);
  g.visible = false;
  scene.add(g);
  QUEST.shrimp = g;
}
//--- F5.13: cabeza del calamar gigante muerto (CONFIG.SQUIDHEAD; lo sólido, en world.js buildSquidHeadShell).
// Todo el dibujo va en un grupo que sube por ronda: carne (Lambert) y saliva que brilla (MeshBasic)
function buildSquidHead() {
  const H = CONFIG.SQUIDHEAD, fl = new MeshBuilder(), gl = new MeshBuilder();
  const cx = (H.x1 + H.x2) / 2, W = H.x2 - H.x1, [tx1, tx2, tz1, tz2] = H.tunnel, [cx1, cx2, cz1, cz2] = H.chamber;
  const skin = [0x7a3a4e, 0x6a3044, 0x8a4658, 0x5e2a3c], inner = 0x4a1420, dark = 0x2a0a12;
  const TH = H.tunnelH, CH = H.chamberH, eyeZ = cz2 - 1, eyeY = H.h * 0.55;   // F5.15: techos del túnel y la cámara
  let n = 0;
  const sk = () => skin[(n++ * 5) % 4];
  // la cabeza: rebanadas a lo largo de z, más angostas y bajas hacia la boca (redondeada)
  for (let z = H.z1; z < H.z2; z += 1) {
    const k = (z - H.z1) / (H.z2 - H.z1), w = W * (1 - 0.25 * k * k), h = H.h * (1 - 0.3 * k * k) + 0.6;
    const tun = z + 0.5 > tz1, cham = z + 0.5 > cz1 && z + 0.5 < cz2;
    const ix1 = tun ? tx1 : cham ? cx1 : null, ix2 = tun ? tx2 : cham ? cx2 : null;
    if (ix1 === null) fl.box(cx, h / 2, z + 0.5, w, h, 1.02, sk());
    else {                                                            // paredes a los costados del hueco y techo
      const L = cx - w / 2, R = cx + w / 2, top = tun ? TH : CH;
      fl.box((L + ix1) / 2, h / 2, z + 0.5, ix1 - L, h, 1.02, sk());
      fl.box((ix2 + R) / 2, h / 2, z + 0.5, R - ix2, h, 1.02, sk());
      fl.box((ix1 + ix2) / 2, (top + h) / 2, z + 0.5, ix2 - ix1, h - top, 1.02, sk());
      fl.box(ix1 + 0.05, top / 2, z + 0.5, 0.1, top, 1.02, inner);   // carne de adentro
      fl.box(ix2 - 0.05, top / 2, z + 0.5, 0.1, top, 1.02, inner);
      fl.box((ix1 + ix2) / 2, top - 0.05, z + 0.5, ix2 - ix1, 0.1, 1.02, inner);
      fl.box((ix1 + ix2) / 2, 0.02, z + 0.5, ix2 - ix1, 0.04, 1.02, dark);
    }
    if ((z | 0) % 3 === 0) for (const s of [-1, 1]) fl.box(cx + s * (w / 2 + 0.02), h * 0.6, z + 0.5, 0.05, 0.6, 0.6, 0x9a5a70);   // manchas
  }
  for (const s of [-1, 1]) {                                          // ojos muertos a los costados
    const x = cx + s * (W * 0.47);
    fl.box(x, eyeY, eyeZ, 0.3, 3.4, 3.4, 0xc8c0b0);
    fl.box(x + s * 0.12, eyeY, eyeZ, 0.1, 1.8, 1.8, 0x8a9a9a);
    fl.box(x + s * 0.16, eyeY, eyeZ, 0.06, 0.5, 1.3, 0x3a3a3a);
  }
  // pico alrededor de la boca, dientes y tentáculos tirados en la arena (sin colisión)
  const mz = H.z2, TW = tx2 - tx1;
  fl.box(tx1 - 0.3, TH / 2, mz + 0.2, 0.6, TH, 0.6, 0x1a1418); fl.box(tx2 + 0.3, TH / 2, mz + 0.2, 0.6, TH, 0.6, 0x1a1418);
  fl.box(cx, TH + 0.3, mz + 0.2, TW + 1.2, 0.6, 0.6, 0x1a1418);
  const nT = Math.round(TW / 0.64);
  for (let i = 0; i < nT; i++) fl.box(tx1 + 0.4 + i * 0.64, TH - 0.5, mz + 0.3, 0.18, 0.5, 0.12, 0xe8e0c8, 0, 0, 0.3 * (i % 2 ? 1 : -1));
  const tent = (x, z, a, len) => {
    for (let i = 0; i < len; i++) {
      const t = i / len, r = 0.7 * (1 - t) + 0.15, ang = a + Math.sin(i * 0.5) * 0.35;
      x += Math.sin(ang) * 0.9; z += Math.cos(ang) * 0.9;
      fl.box(x, r * 0.6, z, r * 1.8, r * 1.2, 1.0, i % 2 ? skin[0] : skin[2], 0, ang, 0);
      if (i % 2 === 0) fl.box(x, r * 1.2 + 0.02, z, r * 0.6, 0.04, r * 0.6, 0xe0b0b8, 0, ang, 0);   // ventosa
    }
  };
  tent(tx1 - 1.2, mz, -0.9, 14); tent(tx2 + 1.2, mz, 0.9, 14);
  tent(H.x1 + 0.5, mz - 2, -1.6, 12); tent(H.x2 - 0.5, mz - 2, 1.6, 12);
  tent(tx1 - 2.2, mz - 0.5, -0.4, 10); tent(tx2 + 2.2, mz - 0.5, 0.4, 10);
  // el manto se hunde en el mar hacia el sur
  for (let i = 0; i < 12; i++) {
    const z = H.z1 - 1 - i * 1.6, w = W * (0.92 - i * 0.05), h = H.h * (1 - i * 0.07) + 0.6, y = h / 2 - i * 0.55;
    fl.box(cx + Math.sin(i * 0.4) * 0.4, y, z, w, h, 1.7, sk(), -0.08, 0, 0);
  }
  fl.box(cx, 0.5, H.z1 - 21, 3, 1.2, 4, skin[1], 0.4, 0.3, 0);         // aleta asomando
  // saliva que brilla: charcos en el piso del túnel y la cámara, hilos del techo y el borde de la boca
  let s = 97; const r = (a, b) => { s = (s * 16807) % 2147483647; return a + (b - a) * s / 2147483647; };
  for (let i = 0; i < 30; i++) {
    const inT = i < 16, x = inT ? r(tx1 + 0.4, tx2 - 0.4) : r(cx1 + 0.4, cx2 - 0.4), z = inT ? r(tz1, tz2 - 0.3) : r(cz1 + 0.3, cz2);
    gl.box(x, 0.06, z, r(0.4, 1.2), 0.02, r(0.4, 1.2), 0x6aff9a);
    if (i % 2) gl.box(x, (inT ? TH : CH) - 0.6, z, 0.04, 1.2, 0.04, 0x8affc0);
  }
  gl.box(cx, TH - 0.08, mz + 0.05, TW, 0.12, 0.08, 0x7affb0);
  for (let i = 0; i < 6; i++) gl.box(tx1 + 0.5 + i * 0.75, TH - 0.7 - (i % 2) * 0.4, mz + 0.06, 0.05, 0.6 + (i % 2) * 0.4, 0.05, 0x8affc0);
  const g = new THREE.Group();
  for (const [mb, mat] of [[fl, new THREE.MeshLambertMaterial({ vertexColors: true })], [gl, new THREE.MeshBasicMaterial({ vertexColors: true })]]) {
    const m = mb.mesh(mat);
    scene.remove(m); m.matrixAutoUpdate = true; m.userData.theme = false; g.add(m);
  }
  scene.add(g);
  SQHEAD.g = g;
}
// rise de la ronda n (0..1)
function squidRise(n) {
  const H = CONFIG.SQUIDHEAD;
  return Math.min(1, H.minRise + (1 - H.minRise) * Math.max(0, n - 1) / (H.openRound - 1));
}
// al empezar cada ronda: nueva altura (sube de a poco en updateSquidHead; snap = de una) y se abre en openRound
function setSquidHead(n, snap) {
  const H = CONFIG.SQUIDHEAD;
  n = Math.max(n, SQHEAD.force || 0);                              // tecla O: abierta aunque sea la R1
  const rise = squidRise(n);
  SQHEAD.target = rise >= 1 - 1e-9 ? 0 : -(1 - rise) * (H.h + 1);
  if (snap || !SQHEAD.g) moveSquidHead(SQHEAD.target);
  if (squidHeadSolid(n >= H.openRound)) {
    buildNavGrid();
    if (typeof FLOW !== 'undefined' && FLOW.dist) updateFlowField(true);
    if (SQHEAD.open && !snap) showBanner('THE SQUID HEAD OPENED', 3);
  }
}
function moveSquidHead(y) {
  SQHEAD.dy = y;
  if (SQHEAD.g) SQHEAD.g.position.y = y;
  if (QUEST.turtle) QUEST.turtle.position.y = y;
  if (QUEST.shrimp) QUEST.shrimp.position.y = y;
  if (BUNK.seahorse) BUNK.seahorse.position.y = y;
  const S = QUEST.shell;
  if (S && (S.phase === 'dull' || S.phase === 'glow')) S.g.position.y = y + 1.98 * CONFIG.QUEST.turtle.scale;
}
function updateSquidHead(dt) {
  if (SQHEAD.target === undefined || SQHEAD.dy === SQHEAD.target) return;
  const d = SQHEAD.target - SQHEAD.dy, step = 0.6 * dt;               // sube 0.6 m/s, temblando
  moveSquidHead(Math.abs(d) < step ? SQHEAD.target : SQHEAD.dy + Math.sign(d) * step);
  if (SQHEAD.g) SQHEAD.g.position.x = SQHEAD.dy === SQHEAD.target ? 0 : Math.sin(clock.elapsedTime * 40) * 0.03;
}

// dónde va la caracola sobre la tortuga (entre las manos)
function placeShellOnTurtle() {
  const T = CONFIG.QUEST.turtle, S = QUEST.shell;
  S.g.position.set(T.x, SQHEAD.dy + 1.98 * T.scale, T.z + 0.05 * T.scale); S.g.rotation.set(0, 0, 0); S.g.visible = true;
  S.g.scale.setScalar(T.scale);
  S.glow.material.opacity = 0; S.mat.color.setHex(0xb8a498); S.mat.emissive.setHex(0);
  if (WORLD.hitMeshes.indexOf(S.hit) < 0) WORLD.hitMeshes.push(S.hit);
  if (QUEST.turtle) QUEST.turtle.rotation.set(0, 0, 0);
}
// ¿ya comieron lo suficiente las plantas? (garden.js PLANTS[].fed)
function shellReady() {
  const Q = CONFIG.QUEST;
  return PLANTS.filter(p => p.fed >= Q.plantEat).length >= Q.plantsNeeded;
}
// un tiro a la caracola: si brilla, se cae en arco al jardín oeste (true = la bala no deja marca)
function shootShell() {
  const S = QUEST.shell, L = CONFIG.QUEST.shellLand;
  if (S.phase !== 'glow') return false;
  S.phase = 'fall'; S.t = 0;
  S.from.copy(S.g.position); S.to.set(L.x, groundY(L.x, L.z) + 0.02, L.z);
  S.x = L.x; S.z = L.z;
  const i = WORLD.hitMeshes.indexOf(S.hit);
  if (i >= 0) WORLD.hitMeshes.splice(i, 1);
  if (QUEST.turtle) QUEST.turtle.rotation.set(0, 0, 0);          // deja de bailar
  sfxCoconut(false);
  return true;
}
// piezas en el piso que se pueden recoger ahora (las lee updateInteract)
function questPieces() {
  const out = [];
  if (state.quest.built) return out;
  if (QUEST.coco.phase === 'ground') out.push(QUEST.coco);
  if (QUEST.string.phase === 'ground') out.push(QUEST.string);
  if (QUEST.shell.phase === 'ground') out.push(QUEST.shell);
  return out;
}
function pickQuestPiece(p) {
  const Q = state.quest;
  if (Q.built) return false;
  if (p.kind === 'coco' && p.phase === 'ground') { p.phase = 'taken'; p.g.visible = false; Q.coconut = true; }
  else if (p.kind === 'string' && p.phase === 'ground') { p.phase = 'taken'; p.g.visible = false; Q.string = true; }
  else if (p.kind === 'shell' && p.phase === 'ground') { p.phase = 'taken'; p.g.visible = false; Q.shell = true; }
  else return false;
  sfxPartPickup();
  updateQuestHUD();
  return true;
}
function questCount() {
  const Q = state.quest;
  return (Q.coconut ? 1 : 0) + (Q.string ? 1 : 0) + (Q.shell ? 1 : 0);
}

//--- taller ---
function haveWave() {
  const s = QUEST.slot;
  return !!s && (state.weapons.indexOf(s) >= 0 || PAPST.slot === s);
}
function workshopPrompt() {
  if (state.quest.built) {
    if (haveWave()) return { text: slotDef(QUEST.slot).name + ' - already owned', cost: 0 };
    return { text: '[F] Take ' + slotDef(QUEST.slot).name, cost: 0 };
  }
  const n = questCount();
  if (n < 3) return { text: 'Board workshop - missing parts (' + n + '/3)', cost: 0 };
  return { text: '[F] Hold to build the ' + CONFIG.WEAPONS.wave.name, cost: 0 };
}
function workshopPress() {
  if (weaponsState.phase !== 'grenade') {
    if (state.quest.built && !haveWave()) { takeWave(); return true; }
    if (!state.quest.built && questCount() === 3) return true;   // el armado sigue mientras mantengas F
  }
  sfxDeny(); denyPrompt();
  return false;
}
// la Ola al inventario: al slot libre o en lugar de la equipada (como una compra)
function takeWave() {
  const s = QUEST.slot;
  if (state.weapons.length < maxWeapons()) { state.weapons.push(s); state.currentWeapon = state.weapons.length - 1; }
  else state.weapons[state.currentWeapon] = s;
  equipModel(slotDef(s)); raiseWeapon(); updateAmmoHUD();
  sfxShieldTake();
}
// Quick Revive: la Ola sale del inventario y vuelve al taller (con su munición)
function loseWave() {
  const i = QUEST.slot ? state.weapons.indexOf(QUEST.slot) : -1;
  if (i < 0) return false;
  const W = weaponsState;
  state.weapons.splice(i, 1);
  state.currentWeapon = Math.max(0, Math.min(state.currentWeapon, state.weapons.length - 1));
  if (W.phase === 'reloading') UI.reload.style.opacity = '0';
  equipModel(curDef());
  if (curDef()) raiseWeapon(); else { W.phase = 'idle'; W.phaseT = 0; W.pendingSlot = -1; }
  updateAmmoHUD();
  return true;
}

//--- el arma: un tiro = daño y empujón a todos los del cono con línea libre ---
function fireWave(def) {
  const eye = feel.eye, dir = _qd.set(0, 0, -1).applyQuaternion(feel.aimQuat);
  const pl = playerLevel(), tanC = Math.tan(def.coneDeg * Math.PI / 180), base = def.damage * perkDmg();
  let hits = 0, kills = 0;
  for (const z of state.zombies.slice()) {
    if (!z.alive || (z.level || 0) !== pl) continue;
    const g = z.level === 1 ? UP.y : groundY(z.px, z.pz);
    // punto del cuerpo (segmento vertical g+0.2..g+1.8) más cercano al eje, como el lanzallamas
    _qv.set(z.px - eye.x, g + 1.1 - eye.y, z.pz - eye.z);
    const yc = Math.max(g + 0.2, Math.min(g + 1.8, eye.y + dir.y * _qv.dot(dir)));
    _qv.y = yc - eye.y;
    const t = _qv.dot(dir);
    if (t <= 0 || t > def.range) continue;
    if (Math.sqrt(Math.max(0, _qv.lengthSq() - t * t)) > t * tanC + 0.35) continue;
    if (!segmentClear(eye.x, eye.z, z.px, z.pz, 0, true, undefined, pl)) continue;
    const dmg = base * (z.boss ? def.bossMul : 1);                // al Sombrerón: daño alto, no insta-kill
    damageZombie(z, dmg, false);
    spawnDamageNumber(z, _sp.set(z.px, g + 1.5, z.pz), dmg, false);
    hits++;
    if (!z.alive) { kills++; continue; }
    if (z.boss || z.state !== 'walk' || pl !== 0) continue;       // al boss no lo mueve (como el escudo)
    // empujón hacia afuera, de a pasos con colisión (respeta paredes); más fuerte cerca
    const dx = z.px - eye.x, dz = z.pz - eye.z, d = Math.hypot(dx, dz) || 1e-4;
    const k = def.knock * (1 - 0.5 * t / def.range), n = 10, r = z.dog ? CONFIG.DOGS.radius : CONFIG.ZOMBIE.radius;
    for (let i = 0; i < n; i++) { moveCircle(z, 'x', dx / d * k / n, r); moveCircle(z, 'z', dz / d * k / n, r); }
  }
  QUEST.fx.position.set(eye.x, eye.y - CONFIG.PLAYER.height, eye.z);   // F5.14: la ola sale del piso
  QUEST.fx.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
  QUEST.fxT = 0.6; QUEST.fxR = def.range;                        // F5.14: 0.35 -> 0.6 s (ola más grande)
  if (hits) onHitConfirm(false, kills > 0);
  return { hits, kills };
}

function updateQuest(dt) {
  const Q = CONFIG.QUEST, t = clock.elapsedTime;
  updateSquidHead(dt);                                             // F5.13
  // la palmera se voltea (cada vez más rápido) y al golpear la arena suelta el coco
  if (QUEST.fallT >= 0 && QUEST.coco.phase === 'none') {
    QUEST.fallT = Math.min(Q.fallTime, QUEST.fallT + dt);
    const k = QUEST.fallT / Q.fallTime, tilt = THEMEFX.palms && THEMEFX.palms[QUEST.palm];
    if (tilt) tilt.rotation.z = -(Math.PI / 2 - 0.08) * k * k;
    if (k >= 1) {
      const P = Q.palms[QUEST.palm], sp = cocoSpot(P), C = QUEST.coco;
      C.phase = 'drop'; C.vy = 0; C.t = 0; C.x = sp.x; C.z = sp.z;
      C.g.position.set(sp.x, groundY(sp.x, sp.z) + Q.cocoDrop, sp.z); C.g.visible = true;
      C.mesh.material.color.setHex(Q.cocoColor); C.glow.material.opacity = 0;
      sfxPalmFall(Math.hypot(P.x - player.pos.x, P.z - player.pos.z));
      addTrauma(Q.fallShake * Math.max(0, 1 - Math.hypot(P.x - player.pos.x, P.z - player.pos.z) / 20));
    }
  }
  // coco: cae de la copa, rebota una vez y se pone dorado
  const C = QUEST.coco;
  if (C.phase === 'drop') {
    C.vy -= Q.cocoGravity * dt;
    const p = C.g.position, fy = groundY(p.x, p.z) + Q.cocoSize / 2;
    p.y += C.vy * dt; C.mesh.rotation.x += dt * 8;
    if (p.y <= fy) { p.y = fy; C.phase = 'ground'; C.t = 0; sfxCoconut(true); }
  }
  if (C.phase === 'ground') {
    C.t += dt;
    const k = Math.min(1, C.t / Q.colorTime);
    C.mesh.material.color.setHex(Q.cocoColor).lerp(_qc.setHex(Q.cocoGold), k);
    C.glow.material.opacity = k * (0.6 + 0.4 * Math.sin(t * 4));
    C.glow.quaternion.copy(camera.quaternion);
  }
  // cuerda: brilla
  const S = QUEST.string;
  if (S.phase === 'ground') {
    S.glow.quaternion.copy(camera.quaternion);
    S.glow.material.opacity = 0.6 + 0.4 * Math.sin(t * 4);
  }
  // caracola (F5.9): opaca sobre la tortuga -> brilla cuando las plantas comieron -> un tiro la tira en arco
  // al jardín oeste -> en el piso sigue brillando hasta que la recogés
  const H = QUEST.shell;
  if (H.phase === 'dull' && !state.quest.shell && !state.quest.built && shellReady()) {
    H.phase = 'glow';
    sfxShellRise();
  }
  if (H.phase === 'glow' || H.phase === 'fall' || H.phase === 'ground') {
    const k = 0.6 + 0.4 * Math.sin(t * 4);
    H.glow.material.opacity = k; H.glow.quaternion.copy(camera.quaternion);
    H.mat.color.setHex(0xffd8e8); H.mat.emissive.setHex(0x6a3a50);
  }
  // F5.10: el langostino aparece con las 3 cajas de almas llenas (jugando o con la tecla O) y baila
  const shrimpOn = SOUL_KEYS.every(k => state.souls[k] >= CONFIG.SOULS.need);
  QUEST.shrimp.visible = shrimpOn;
  if (shrimpOn) QUEST.shrimp.rotation.set(0, Math.sin(t * 2.6) * 0.5, Math.sin(t * 5.2) * 0.12);
  if (H.phase === 'glow' && QUEST.turtle) {                       // la tortuga baila
    QUEST.turtle.rotation.set(0, Math.sin(t * 2) * 0.35, Math.sin(t * 4) * 0.08);
  } else if (H.phase === 'fall') {
    H.t += dt;
    const k = Math.min(1, H.t / Q.shellFall), p = H.g.position;
    p.lerpVectors(H.from, H.to, k);
    p.y += Q.shellArc * 4 * k * (1 - k);
    H.g.rotation.x += dt * 9;
    if (k >= 1) { H.phase = 'ground'; H.g.rotation.set(0, 0, 0); sfxCoconut(true); }
  }
  // armado: mantener F en el taller con las 3 piezas
  const ready = !state.quest.built && questCount() === 3;
  if (ready && interactState.kind === 'workshop' && keys['KeyF'] && weaponsState.phase !== 'grenade') {
    QUEST.craftT += dt;
    if (QUEST.craftT >= Q.craftTime) {
      QUEST.craftT = 0;
      craftWave();
    }
  } else QUEST.craftT = 0;
  if (QUEST.craftT > 0) {                                         // la barra es la misma del escudo
    UI.craft.style.opacity = '1';
    UI.craftBar.style.width = (100 * QUEST.craftT / Q.craftTime).toFixed(1) + '%';
  }
  QUEST.shopModel.visible = state.quest.built && !haveWave();
  // la ola se abre hasta el alcance y se desvanece
  if (QUEST.fxT > 0) {
    QUEST.fxT = Math.max(0, QUEST.fxT - dt);
    const k = 1 - QUEST.fxT / 0.6, r = 0.5 + (QUEST.fxR - 0.5) * easeOut(k), F = QUEST.fxParts;
    const rise = k < 0.5 ? k * 2 : 1 - (k - 0.5) * 0.6;              // sube, rompe y baja un poco
    QUEST.fx.scale.set(r, 0.4 + 0.8 * rise, r);
    F.wall.material.opacity = 0.55 * (1 - k);
    F.inner.material.opacity = 0.45 * (1 - k);
    F.crest.material.opacity = 0.95 * (1 - k * k);
    F.crest.rotation.x = -0.25 * k;                                  // la cresta se vuelca hacia adelante
    F.ring.material.opacity = 0.75 * (1 - k * 0.7);
    F.spray.material.opacity = k > 0.3 ? 0.9 * (1 - k) / 0.7 : 0;
    F.spray.position.y = 0.8 * k;
  }
  QUEST.fx.visible = QUEST.fxT > 0;
}
function craftWave() {
  const def = CONFIG.WEAPONS.wave;
  state.quest.built = true;
  QUEST.slot = { id: 'wave', mag: def.magSize, reserve: def.reserveMax };
  takeWave();
  showBanner(def.name, 1.6);
  updateQuestHUD();
}

function updateQuestHUD() {
  const Q = state.quest;
  if (Q.built) { UI.quest.innerHTML = ''; return; }
  UI.quest.innerHTML = '<i class="coco' + (Q.coconut ? '' : ' off') + '"></i>' +
    '<i class="string' + (Q.string ? '' : ' off') + '"></i><i class="shell' + (Q.shell ? '' : ' off') + '"></i>';
}
function resetQuest() {
  const Q = state.quest;
  Q.coconut = false; Q.string = false; Q.shell = false; Q.built = false;
  QUEST.palm = Math.floor(Math.random() * CONFIG.QUEST.palms.length); QUEST.fallT = -1;
  if (THEMEFX.palms) for (const tilt of THEMEFX.palms) tilt.rotation.z = 0;
  if (QUEST.coco) { QUEST.coco.phase = 'none'; QUEST.coco.g.visible = false; QUEST.coco.mesh.rotation.set(0, 0, 0); }
  if (QUEST.string) { QUEST.string.phase = 'none'; QUEST.string.g.visible = false; }
  SQHEAD.force = 0; setSquidHead(1, true);                       // F5.13: cabeza enterrada y cerrada
  if (QUEST.shell) { QUEST.shell.phase = 'dull'; placeShellOnTurtle(); }
  QUEST.craftT = 0; QUEST.slot = null; QUEST.fxT = 0;
  if (QUEST.shopModel) { QUEST.shopModel.visible = false; QUEST.fx.visible = false; }
  updateQuestHUD();
}
