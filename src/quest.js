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
// Todo el dibujo va en un grupo que sube por ronda: carne (Lambert) y saliva que brilla (MeshBasic).
// F5.17b: superficies curvas (superelipse) en vez de rebanadas de cajas
function buildSquidHead() {
  const H = CONFIG.SQUIDHEAD, fl = new MeshBuilder(), gl = new MeshBuilder(), bk = new MeshBuilder(), rr = mulberry(71);
  const cx = (H.x1 + H.x2) / 2, W = H.x2 - H.x1, L = H.z2 - H.z1, [tx1, tx2, tz1] = H.tunnel, [cx1, cx2, cz1, cz2] = H.chamber;
  const TH = H.tunnelH, CH = H.chamberH, mz = H.z2, TW = tx2 - tx1, tcx = (tx1 + tx2) / 2, eyeZ = cz2 - 1, eyeY = H.h * 0.55;
  const skin = [0xffffff, 0xf0e4e8, 0xe4d4dc], inner = 0xc07888, dark = 0x3a1018;
  // F5.17b: piel de calamar (cromatóforos) y carne de adentro con venas, por canvas
  const skinTex = makeTex((c, s) => {
    c.fillStyle = '#7a3a4e'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) { c.fillStyle = ['rgba(150,70,90,.55)', 'rgba(60,20,34,.5)', 'rgba(190,120,130,.35)', 'rgba(110,40,60,.6)'][i % 4];
      c.beginPath(); c.arc(Math.random() * s, Math.random() * s, 1.5 + Math.random() * 6, 0, 7); c.fill(); }
    c.strokeStyle = 'rgba(40,10,20,.35)'; c.lineWidth = 1;
    for (let i = 0; i < 8; i++) { let x = Math.random() * s, y = Math.random() * s; c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; c.lineTo(x, y); } c.stroke(); }
    noise(c, s, 18);
  }, 1, 128);
  const fleshTex = makeTex((c, s) => {
    c.fillStyle = '#6a2230'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) { c.fillStyle = ['rgba(140,50,70,.5)', 'rgba(40,8,16,.5)', 'rgba(170,90,100,.3)'][i % 3];
      c.beginPath(); c.ellipse(Math.random() * s, Math.random() * s, 4 + Math.random() * 14, 2 + Math.random() * 6, Math.random() * 3, 0, 7); c.fill(); }
    c.strokeStyle = 'rgba(30,4,10,.6)'; c.lineWidth = 2;
    for (let i = 0; i < 12; i++) { let x = Math.random() * s, y = Math.random() * s; c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 30; y += Math.random() * 25; c.lineTo(x, y); } c.stroke(); }
    noise(c, s, 20);
  }, 1, 128);
  const inn = new MeshBuilder();
  // ---- afuera: rebanadas de superelipse (redondeada) a lo largo de z; atrás se hunde en el mar ----
  const E = 2.6;
  const A = k => W / 2 * 1.06 * (1 - 0.22 * Math.max(0, k) ** 2) * (k < 0 ? 1 + 0.08 * k : 1);   // F5.22: ×1.06, así la cámara no asoma
  const Hh = k => (k < 0 ? H.h * (1 + 0.12 * k) : H.h * (1 - 0.32 * k * k)) + 0.6;
  const sink = k => (k < 0 ? -k * 16 : 0);
  const bump = (k, th) => 1 + 0.035 * Math.sin(k * 23 + th * 5) + 0.025 * Math.sin(k * 41 - th * 9);
  // F5.25 (Diego: "todo cúbico"): la piel de afuera en COLUMNAS DE CUBOS de VX m. Cada columna va de su tope (la misma
  // superelipse de antes: mismo ancho, alto y hundido en el mar) hasta el tope más bajo de sus vecinas, así queda una
  // cáscara escalonada sin rellenar la cámara de adentro. La fila del frente es la cara de la boca, con el hueco del túnel.
  // Tonos: manchas de cromatóforos (hash) y la cresta más clara
  const kEnd = 1 - 1 / L, kBeg = -0.8, VX = 0.8, SK = CONFIG.SQUIDBAY.waterY - 0.8;
  const hs = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };
  const topAt = (x, z) => {                                            // tope de la piel en (x, z), o -Infinity afuera
    const k = (z - H.z1) / L;
    if (k < kBeg || k > kEnd + 1e-6) return -Infinity;
    const a = A(k), ux = Math.abs(x - cx) / a;
    if (ux >= 1) return -Infinity;
    const c = ux ** (E / 2), v = Math.sqrt(Math.max(0, 1 - c * c)) ** (2 / E);
    return Hh(k) * v * bump(k, Math.acos(Math.min(1, c))) - sink(k);
  };
  const zf = H.z1 + kEnd * L, nz = Math.ceil((zf - (H.z1 + kBeg * L)) / VX), nx = Math.ceil(W * 1.1 / VX / 2);
  const tops = new Map(), key = (i, j) => i + ',' + j;
  for (let j = 0; j < nz; j++) for (let i = -nx; i <= nx; i++) tops.set(key(i, j), topAt(cx + i * VX, zf - VX / 2 - j * VX));
  for (let j = 0; j < nz; j++) for (let i = -nx; i <= nx; i++) {
    let t = tops.get(key(i, j));
    if (!(t > SK)) continue;
    const x = cx + i * VX, z = zf - VX / 2 - j * VX, h = hs(i, j);
    t = Math.round(t / 0.2) * 0.2;                                     // escalones de 20 cm
    let lo = Infinity;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = tops.get(key(i + a, j + b)); lo = Math.min(lo, n === undefined || !(n > SK) ? SK : n); }
    lo = Math.max(SK, Math.min(lo, t - VX) - 0.1);
    if (j === 0) lo = SK;                                              // la cara de la boca baja hasta el agua
    // la columna va en cubos de VX apilados desde arriba (así la textura no se estira y cada cubo lleva su tono)
    const stack = (y0, y1) => {
      for (let y = y1, n = 0; y > y0 + 1e-3; y -= VX, n++) {
        const hh = Math.min(VX, y - y0), q = hs(i * 3 + n, j * 7 - n);
        const c = n === 0 && Math.abs(i) < 2 && t > 8 ? 0xfff0f4 : q < 0.1 ? 0x8a4458 : q < 0.25 ? skin[2] : skin[(i + j + n) % 3];
        fl.box(x, y - hh / 2, z, VX, hh, VX, c);
      }
    };
    if (j <= 1 && Math.abs(x - tcx) < TW / 2 + 0.25) {                 // hueco del túnel: arriba del techo y abajo del piso
      if (t > TH + 0.25) stack(TH + 0.25, t);
      stack(SK, 0);
      continue;
    }
    stack(lo, t);
    if (h > 0.93 && t > 2) fl.box(x + (h - 0.965) * 6, t + 0.08, z, 0.3, 0.16, 0.3, 0xc05878);   // grano de piel
  }
  // ---- adentro (F5.21: todo en cubos, y la cámara ocupa casi toda la cabeza) ----
  buildSquidGut(inn, fl, gl, rr);
  // ---- ojos muertos a los costados: globo lechoso con párpado caído ----
  for (const s of [-1, 1]) {
    const x = cx + s * (A((eyeZ - H.z1) / L) - 0.5);
    bk.sphere(x, eyeY, eyeZ, 1.3, 1.9, 1.9, 0xd8d0c0, 16);
    bk.sphere(x + s * 0.95, eyeY - 0.1, eyeZ + 0.1, 0.4, 1.0, 0.9, 0x6a7a7a, 12);
    bk.sphere(x + s * 1.18, eyeY - 0.1, eyeZ + 0.1, 0.2, 0.55, 0.28, 0x1a1a1a, 10);
    fl.blob(x + s * 0.3, eyeY + 1.25, eyeZ, 1.3, 0.8, 2.3, 0xffd0d8, s + 3);                        // párpado
    fl.tube([[x + s * 0.2, eyeY - 1.6, eyeZ - 1.8], [x + s * 0.9, eyeY - 0.9, eyeZ], [x + s * 0.2, eyeY - 1.6, eyeZ + 1.8]], 0.3, 0.3, 0xffd0d8, 10, 6);
  }
  // ---- pico: dos mitades curvas negras alrededor de la boca, y dientes cónicos ----
  const lipPts = [];
  for (let k = 0; k <= 20; k++) {
    const a = Math.PI * k / 20, x = tcx - Math.cos(a) * (TW / 2 + 0.5), y = Math.min(TH + 0.5, Math.sin(a) * (TH + 0.5) * 1.35);
    lipPts.push([x, Math.max(0.1, y), mz - 0.05]);
  }
  lipPts.unshift([tx1 - 0.5, 0, mz - 0.05]); lipPts.push([tx2 + 0.5, 0, mz - 0.05]);
  bk.tube(lipPts, 0.62, 0.62, 0x241a20, 48, 8);
  fl.tube(lipPts.map(p => [p[0] + (p[0] < tcx ? -0.55 : 0.55), p[1] + 0.3, p[2] - 0.35]), 0.5, 0.5, 0xffc8d0, 40, 7);   // labio de carne
  for (const s of [-1, 1]) bk.tube([[tcx + s * 1.2, TH + 0.9, mz + 0.1], [tcx + s * 0.4, TH + 0.2, mz + 0.9], [tcx + s * 0.15, TH - 0.6, mz + 0.6]], 0.45, 0.06, 0x181014, 12, 7);   // gancho del pico
  for (let i = 0; i < 9; i++) {
    const x = tx1 + 0.35 + i * (TW - 0.7) / 8, y = Math.min(TH, Math.sin(Math.PI * (x - tx1) / TW) * TH * 1.35) - 0.15;
    bk.cyl(x, y, mz - 0.1, 0.13, 0.55, 0xe8e0c8, 0, 6, Math.PI, 0, 0.2 * (i % 2 ? 1 : -1));
  }
  // ---- tentáculos tirados en la arena, con ventosas ----
  const tent = (x, z, a, len, r0) => {
    const pts = []; let ang = a;
    for (let i = 0; i <= len; i++) { pts.push([x, r0 * (1 - i / len) * 0.8 + 0.12, z]); ang += Math.sin(i * 0.7 + a * 3) * 0.28; x += Math.sin(ang) * 0.9; z += Math.cos(ang) * 0.9; }
    fl.tube(pts, r0, 0.08, 0xffffff, len * 3, 8);
    for (let i = 1; i < len; i += 1) { const p = pts[i], r = r0 * (1 - i / len); bk.cyl(p[0], p[1] + r * 0.55, p[2], r * 0.35, 0.08, 0xd8a0a8, 1, 8); }
  };
  tent(tx1 - 1.4, mz - 0.4, -0.9, 14, 0.8); tent(tx2 + 1.4, mz - 0.4, 0.9, 14, 0.8);
  tent(H.x1 + 0.8, mz - 2.5, -1.6, 12, 0.7); tent(H.x2 - 0.8, mz - 2.5, 1.6, 12, 0.7);
  tent(tx1 - 2.6, mz - 0.8, -0.35, 10, 0.6); tent(tx2 + 2.6, mz - 0.8, 0.35, 10, 0.6);
  fl.blob(cx + 2, 0.4, H.z1 - 18, 2.4, 1.4, 3.4, 0xffffff, 2, 0.4, 0.3, 0);                          // aleta asomando del agua
  // ---- saliva que brilla: charcos, hilos del techo y el borde de la boca ----
  for (let i = 0; i < 8; i++) { const p = lipPts[3 + i * 2], hh = 0.5 + (i % 3) * 0.4; gl.seg([p[0], p[1] - 0.4, p[2] + 0.1], [p[0], p[1] - 0.4 - hh, p[2] + 0.1], 0.04, 0.02, 0x8affc0, 4); }
  const g = new THREE.Group();
  const mats = [
    [fl, new THREE.MeshLambertMaterial({ vertexColors: true, map: skinTex })],
    [inn, new THREE.MeshLambertMaterial({ vertexColors: true, map: fleshTex, side: THREE.DoubleSide, emissive: 0x220408 })],
    [bk, new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: 0x444444 })],
    [gl, new THREE.MeshBasicMaterial({ vertexColors: true })]
  ];
  for (const [mb, mat] of mats) {
    const m = mb.mesh(mat);
    scene.remove(m); m.matrixAutoUpdate = true; m.userData.theme = false; g.add(m);
  }
  buildSquidHeart(g);                                                  // F5.22: el corazón que late
  scene.add(g);
  SQHEAD.g = g;
}
// F5.21: las tripas de la cabeza en cubos. inn = carne de adentro (textura de venas), fl = cartílago y hueso, gl = lo
// que brilla. Túnel y cámara en arco (paredes, techo abovedado, tapas), costillas, venas y sacos que brillan, colmillos
// en el techo del túnel, saliva, y el entrepiso: galerías de placas de cartílago con barandas de hueso, pilares y la
// escalera de vértebras. Todo en coordenadas del mundo con la cabeza a su altura final (el grupo sube con dy)
function buildSquidGut(inn, fl, gl, rr) {
  const H = CONFIG.SQUIDHEAD, v = 0.5, [tx1, tx2, tz1] = H.tunnel, [cx1, cx2, cz1, cz2] = H.chamber, mz = H.z2;
  const TH = H.tunnelH, CH = H.chamberH, D = H.deck, y = UP.y;
  const FLESH = [0x8a3448, 0x7a2a3e, 0x9a4458, 0x6a2234, 0xa85468], DARK = [0x3a1018, 0x4a1622, 0x2e0c14];
  const CART = [0xd8a8b0, 0xc8909a, 0xe8c0c4], BONE = [0xe8dcc8, 0xd8ccb0];
  const hsh = (a, b, c) => { const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return s - Math.floor(s); };
  const archTop = (x, x1, x2, top) => {                                 // alto del techo abovedado en x
    const w = (x2 - x1) / 2, dx = Math.abs(x - (x1 + x2) / 2), wall = top * 0.5;
    return dx >= w ? wall : wall + (top - wall) * Math.sqrt(1 - (dx / w) ** 2);
  };
  const flesh = (x, yy, z) => { const f = hsh(x, yy, z); return f < 0.05 ? 0xff5a7a : FLESH[Math.floor(f * 5)]; };
  // una bóveda: piso, paredes y techo de cubos (con relleno donde el techo baja de a saltos), tapas opcionales
  const vault = (x1, x2, z1, z2, top, capBack, capFront, hole) => {
    for (let x = x1 + v / 2; x < x2; x += v) {
      const h = archTop(x, x1, x2, top), hn = Math.min(archTop(x - v, x1, x2, top), archTop(x + v, x1, x2, top));
      for (let z = z1 + v / 2; z < z2; z += v) {
        inn.box(x, -0.12, z, v, 0.25, v, DARK[Math.floor(hsh(x, 1, z) * 3)]);                      // piso
        if (hsh(x, 2, z) < 0.12) inn.box(x, 0.12, z, v, 0.2 + hsh(x, 3, z) * 0.2, v, 0x5a1a28);     // pliegues
        for (let yy = h; yy >= Math.min(h, hn) - 0.01; yy -= v) inn.box(x, yy + v / 2, z, v, v, v, flesh(x, yy, z));   // techo
      }
    }
    for (const x of [x1 - v / 2, x2 + v / 2]) for (let z = z1 + v / 2; z < z2; z += v)       // paredes
      for (let yy = 0; yy < top * 0.5 + v; yy += v) inn.box(x, yy + v / 2, z, v, v, v, flesh(x, yy, z));
    for (const [z, on] of [[z1 - v / 2, capBack], [z2 + v / 2, capFront]]) {
      if (!on) continue;
      for (let x = x1 - v / 2; x < x2 + v; x += v) {
        const h = archTop(Math.min(x2 - 0.01, Math.max(x1 + 0.01, x)), x1, x2, top);
        for (let yy = 0; yy < h + v / 2; yy += v) {
          if (hole && Math.abs(x - hole[0]) < hole[1] && yy < hole[2]) continue;
          inn.box(x, yy + v / 2, z, v, v, v, flesh(x, yy, z));
        }
      }
    }
  };
  vault(tx1, tx2, cz2, mz - 0.3, TH, false, false);
  vault(cx1, cx2, cz1, cz2, CH, true, true, [(tx1 + tx2) / 2, (tx2 - tx1) / 2, TH]);
  // costillas de cartílago cruzando la bóveda de la cámara, cada 2.5 m
  for (let z = cz1 + 1.5; z < cz2 - 0.5; z += 2.5)
    for (let x = cx1 + 0.3; x < cx2 - 0.2; x += 0.4) fl.box(x, archTop(x, cx1, cx2, CH) - 0.35, z, 0.42, 0.42, 0.5, CART[Math.floor(hsh(x, z, 4) * 3)]);
  // colmillos que cuelgan del techo del túnel y venas / sacos que brillan en las paredes
  for (let z = tz1 + 0.5; z < mz - 0.6; z += 1.1) for (const x of [tx1 + 0.6, tx2 - 0.6]) {
    const t = archTop(x, tx1, tx2, TH);
    for (let k = 0; k < 3; k++) fl.box(x, t - 0.2 - k * 0.25, z, 0.3 - k * 0.08, 0.25, 0.3 - k * 0.08, BONE[k % 2]);
  }
  for (const x of [cx1 + 0.05, cx2 - 0.05]) for (let z = cz1 + 1; z < cz2 - 1; z += 1.7) {
    let yy = 0.4 + hsh(x, z, 5) * 0.5;
    for (let k = 0; k < 7; k++, yy += 0.45) gl.box(x, yy, z + Math.sin(k * 1.3 + z) * 0.25, 0.12, 0.45, 0.12, 0x8affc0);   // vena
    if (hsh(x, z, 6) < 0.5) { gl.box(x, 2.6, z + 0.6, 0.5, 0.6, 0.5, 0x6aff9a); gl.box(x, 2.6, z + 0.6, 0.3, 0.8, 0.3, 0xb8ffd0); }   // saco
  }
  // saliva: charcos en el piso (cuadrados que brillan) e hilos que cuelgan del techo y de las galerías
  for (let i = 0; i < 26; i++) {
    const inT = i < 8, x = inT ? tx1 + 0.5 + rr() * (tx2 - tx1 - 1) : cx1 + 0.5 + rr() * (cx2 - cx1 - 1);
    const z = inT ? cz2 + 0.5 + rr() * (mz - cz2 - 1) : cz1 + 0.5 + rr() * (cz2 - cz1 - 1), n = 1 + Math.floor(rr() * 3);
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) if (a * a + b * b <= n * n) gl.box(x + a * 0.3, 0.03, z + b * 0.3, 0.3, 0.02, 0.3, 0x6aff9a);
    const top = inT ? archTop(x, tx1, tx2, TH) : archTop(x, cx1, cx2, CH), L = 2 + Math.floor(rr() * 4);
    for (let k = 0; k < L; k++) gl.box(x, top - 0.15 - k * 0.3, z, 0.06, 0.3, 0.06, 0x8affc0);
  }
  // ---- F5.22 (Diego: "que no sean de madera, que sean órganos del calamar"): el entrepiso ----
  const MEMB = [0xb0607a, 0x9a4a68, 0xc07890, 0xa85470], TENT = [0xe0b0c0, 0xc88898, 0xf0c8d4], SUCK = 0xfff0f4;
  const walk = (x, z) => D.walk.some(r => x >= r[0] && x < r[1] && z >= r[2] && z < r[3]);
  // galerías: membranas carnosas con venas, capilares que brillan y un labio que cuelga en los bordes libres
  for (const [x1, x2, z1, z2] of D.walk) for (let x = x1 + v / 2; x < x2; x += v) for (let z = z1 + v / 2; z < z2; z += v) {
    const vein = Math.abs(Math.sin(x * 1.7 + Math.sin(z * 0.9) * 2)) < 0.12;
    fl.box(x, y - 0.12, z, v, 0.24, v, vein ? 0x5a1a30 : MEMB[Math.floor(hsh(x, 7, z) * 4)]);
    if (hsh(x, 8, z) < 0.06) gl.box(x, y + 0.01, z, 0.24, 0.02, 0.24, 0xff7aa8);                    // capilar
    if (!walk(x - v, z) || !walk(x + v, z) || !walk(x, z - v) || !walk(x, z + v)) {
      const L = 1 + Math.floor(hsh(x, 9, z) * 3);
      for (let k = 0; k < L; k++) fl.box(x, y - 0.4 - k * 0.3, z, v * (1 - k * 0.2), 0.3, v * (1 - k * 0.2), k ? 0x7a2a44 : MEMB[1]);   // labio que cuelga
      if (hsh(x, 10, z) < 0.25) for (let k = 0; k < 3; k++) gl.box(x, y - 0.5 - L * 0.3 - k * 0.25, z, 0.05, 0.25, 0.05, 0x8affc0);   // gota de baba
    }
  }
  // pilares: tentáculos enroscados, más gruesos abajo, con ventosas de un lado
  for (const [x, z] of D.pillars) {
    const n = Math.round((y - 0.2) / 0.3);
    for (let k = 0; k < n; k++) {
      const a = k * 0.45 + x, r = 0.12, s = 0.62 - k * 0.012, yy = k * 0.3 + 0.15;
      fl.box(x + Math.cos(a) * r, yy, z + Math.sin(a) * r, s, 0.32, s, TENT[k % 3], 0, a, 0);
      if (k % 2) fl.box(x + Math.cos(a) * (r + s / 2), yy, z + Math.sin(a) * (r + s / 2), 0.12, 0.16, 0.16, SUCK, 0, a, 0);   // ventosa
    }
    for (let k = 0; k < 6; k++) { const a = k * 1.05; fl.box(x + Math.cos(a) * 0.55, 0.12, z + Math.sin(a) * 0.55, 0.36, 0.24, 0.36, TENT[1], 0, a, 0); }   // se abre en el piso
  }
  // barandas: cordones de cartílago rosado, con nudos, sobre postes cortos que parecen dedos
  const G = CONFIG.GARDEN.railH, gaps = D.flights.map(f => f.gap);
  for (const [x1, x2, z1, z2] of D.walk) for (let x = x1; x < x2; x++) for (let z = z1; z < z2; z++) {
    const cx = x + 0.5, cz = z + 0.5;
    const edges = [[!walk(cx - 1, cz) && x !== cx1, 'x', x, cz], [!walk(cx + 1, cz) && x + 1 !== cx2, 'x', x + 1, cz],
                   [!walk(cx, cz - 1) && z !== cz1, 'z', z, cx], [!walk(cx, cz + 1) && z + 1 !== cz2, 'z', z + 1, cx]];
    for (const [on, ax, line, a] of edges) {
      if (!on || gaps.some(gp => gp[0] === ax && gp[1] === line && a >= gp[2] && a < gp[3])) continue;   // llegadas de las rampas
      const px = ax === 'x' ? line : a, pz = ax === 'x' ? a : line;
      for (let k = 0; k < 4; k++) fl.box(px, y + 0.14 + k * 0.24, pz, 0.2 - k * 0.03, 0.24, 0.2 - k * 0.03, TENT[k % 3]);   // dedo
      fl.box(px, y + G - 0.05, pz, ax === 'x' ? 0.18 : 1.02, 0.18, ax === 'x' ? 1.02 : 0.18, 0xd87898);   // cordón
      fl.box(px, y + G - 0.05, pz, 0.26, 0.24, 0.26, 0xb85070);                                         // nudo
    }
  }
  // rampas: la lengua (papilas, rosada, se afina arriba) y el esófago (anillos que la envuelven)
  for (const F of D.flights) {
    const steps = F.steps, run = (F.z2 - F.z1) / steps, rise = y / steps;                // suben hacia -z
    for (let i = 0; i < steps; i++) {
      const za = F.z2 - (i + 1) * run, h = (i + 1) * rise, zc = za + run / 2;
      for (let x = F.x1 + v / 2; x < F.x2; x += v) {
        const top = F.organ === 'tongue' ? [0xd84a6a, 0xc83a5a][i % 2] : [0x9a3a4a, 0x8a2e40][i % 2];
        fl.box(x, h - 0.12, zc, v, 0.24, run, top);                                                  // pisada
        if (F.organ === 'tongue' && hsh(x, i, 11) < 0.5) fl.box(x + 0.1, h + 0.03, zc, 0.1, 0.06, 0.1, 0xf08aa8);   // papilas
        for (let yy = 0; yy < h - 0.24; yy += 0.5) inn.box(x, yy + 0.25, zc, v, 0.5, run, FLESH[(i + Math.floor(yy * 2)) % 5]);   // carne debajo
      }
      if (F.organ === 'gullet' && i % 3 === 1) {                                               // anillo del esófago
        const w = F.x2 - F.x1, xm = (F.x1 + F.x2) / 2;
        for (let a = 0; a <= 12; a++) {
          const t = a / 12 * Math.PI, rx = Math.cos(t) * (w / 2 + 0.3), ry = Math.sin(t) * 2.3;
          fl.box(xm + rx, h + ry, zc, 0.3, 0.3, 0.35, a % 2 ? 0x7a2a3e : 0x9a3a52);
        }
      }
    }
    if (F.organ === 'tongue') for (let k = 0; k < 5; k++) gl.box((F.x1 + F.x2) / 2 + (k % 2 ? 0.4 : -0.4), 0.03, F.z2 + 0.4 + k * 0.3, 0.3, 0.02, 0.3, 0x6aff9a);   // babea abajo
  }
  // órganos: agallas en las paredes (ranuras con bordes que brillan) y la bolsa de tinta colgando del techo del hueco norte
  for (const x of [cx1 + 0.3, cx2 - 0.3]) for (let z = cz1 + 3; z < cz2 - 3; z += 4) for (let k = 0; k < 5; k++) {
    inn.box(x, 1.2 + k * 0.45, z, 0.2, 0.18, 2.2, 0x2a0610);
    gl.box(x, 1.32 + k * 0.45, z, 0.22, 0.05, 2.2, 0xff6a9a);
  }
  voxBlob(inn, gl, -88, CH - 2.3, -45, 1.3, 1.6, 1.3, 0.3, (xx, yy2, zz) => [pbHash(xx, yy2, zz) > 0.93 ? 0x9a4aff : 0x0a0610, pbHash(xx, yy2, zz) > 0.93]);
  for (let k = 0; k < 4; k++) fl.box(-88, CH - 0.5 + k * 0.1, -45, 0.4, 0.3, 0.4, 0x3a1020);   // el cordón que la cuelga
}
// F5.22: el corazón del calamar (en el hueco sur): late. Grupo aparte, hijo del de la cabeza
function buildSquidHeart(g) {
  const O = CONFIG.SQUIDHEAD.deck.heart, hm = new MeshBuilder(), hg = new MeshBuilder(), heart = new THREE.Group();
  heart.position.set(O[0], 1.5, O[1]);
  voxBlob(hm, hg, 0, 0, 0, O[2], 1.5, O[2] * 0.85, 0.3, (x, y, z) => {
    const f = pbHash(x, y, z), vein = Math.abs(Math.sin(x * 3 + y * 2)) < 0.15;
    return vein ? [0xff4a6a, true] : [f < 0.3 ? 0x7a0a1a : f < 0.6 ? 0x9a1428 : 0xb82038, false];
  });
  for (let k = 0; k < 3; k++) for (let j = 0; j < 5; j++) hm.box(-0.6 + k * 0.6, 1.4 + j * 0.3, (k - 1) * 0.2, 0.36 - j * 0.04, 0.3, 0.36 - j * 0.04, j % 2 ? 0x6a1a2a : 0x8a2238);   // arterias
  for (const [mb, mat] of [[hm, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x2a0408 })], [hg, new THREE.MeshBasicMaterial({ vertexColors: true })]]) {
    const m = mb.mesh(mat); if (m) { scene.remove(m); m.matrixAutoUpdate = true; m.userData.theme = false; heart.add(m); }
  }
  g.add(heart); SQHEAD.heart = heart;
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
  if (SQHEAD.heart && SQHEAD.open) {                                   // F5.22: late (dos golpes y una pausa)
    const t = clock.elapsedTime % 1.1, k = 1 + 0.07 * Math.exp(-(((t - 0.1) / 0.06) ** 2)) + 0.05 * Math.exp(-(((t - 0.32) / 0.07) ** 2));
    SQHEAD.heart.scale.setScalar(k);
  }
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
  if (!SQHEAD.open) return false;           // F5.19b: enterrada en el mar, la bala llegaba por el agua (sin piso que la frene)
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
  if (!playSample('musica_al_agarrar_la_wonder_weapon', { dest: AUDIO.game })) sfxShieldTake();   // F5.19c
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
    const g = z.level ? lvY(z.level) : groundY(z.px, z.pz);
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
    playSample('musica_al_haber_llenado_todas_las_plantas_carnivoras', { dest: AUDIO.game });   // F5.19c
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
  // F5.19c: música mientras se arma (escudo u Ola). F5.29f: y la mesa del Kraken
  craftMusic(QUEST.craftT > 0 || SHIELDST.craftT > 0 || (typeof EE !== 'undefined' && EE.craftT > 0));
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
  voice('audio_personaje_al_construir_wonder_weapon', 1, 0);           // F5.19
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
