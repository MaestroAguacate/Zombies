//=== 7b. SOULS: generadores, cajas de almas y Pack-a-Punch (V2 F2.5) =====================
// Generadores (4): un golpe de cuchillo los prende (meleeAttack -> hitGenerator). Las balas solo dejan marca.
// Cajas de almas (3): un zombie que muere a CONFIG.SOULS.radius de una caja, con línea libre, le da un alma
// (onZombieDeath -> soulFromKill), sin importar el arma. Se llenan en paralelo, una vez por partida.
// Pack-a-Punch: con los 4 generadores y las 3 cajas llenas se prende (checkPap). La mejora del arma (F2b)
// está más abajo (usePap). Nada de esto toca state.power (palanca del sótano, F2).
// Todo se construye UNA vez (buildRelics): sin luces nuevas (las lámparas son MeshBasic que cambian de
// color) y partículas en pool. En state solo viven state.generators y state.souls (afectan lógica).
const RELICS = { gens: {}, boxes: {}, pap: null, papOn: false, fx: [], fxI: 0, smoke: [], smokeI: 0 };
const GEN_KEYS = Object.keys(CONFIG.GENERATORS.spots);
const SOUL_KEYS = Object.keys(CONFIG.SOULS.spots);

// local (lx, lz) del objeto -> mundo, girado como el spot (rotación Y de three)
function relicWorld(sp, lx, lz) {
  const c = Math.cos(sp.rot), s = Math.sin(sp.rot);
  return { x: sp.x + lx * c + lz * s, z: sp.z - lx * s + lz * c };
}
// grupo en el spot (para las partes que cambian) + cuerpo sólido INVISIBLE: collider (jugador, zombies,
// nav) y hitMesh (frena balas; el raycaster no mira .visible), igual que los props. Lo que se ve del
// cuerpo va fusionado en un solo mesh (mb): sin eso eran ~60 draw calls más
// sp.y (F5.8): altura de la base (Juggernog va en el techo: UP.y). Arriba del piso es un collider de arriba
function relicBody(mb, sp, S, color, tag, type) {
  const y0 = sp.y || 0, g = new THREE.Group();
  g.position.set(sp.x, y0, sp.z); g.rotation.y = sp.rot;
  const body = new THREE.Mesh(new THREE.BoxGeometry(S.w, S.h, S.d), PROP_HIT_MAT);
  body.position.y = S.h / 2; body.visible = false;
  body.userData.type = type;
  g.add(body);
  scene.add(g);
  mb.setFrame(sp.x, y0, sp.z, sp.rot);
  mb.box(0, S.h / 2, 0, S.w, S.h, S.d, color);
  WORLD.hitMeshes.push(body);
  const side = Math.abs(Math.sin(sp.rot)) > 0.5;
  const hx = (side ? S.d : S.w) / 2, hz = (side ? S.w : S.d) / 2;
  const col = { minX: sp.x - hx, maxX: sp.x + hx, minY: y0, maxY: y0 + S.h, minZ: sp.z - hz, maxZ: sp.z + hz,
                tag, mesh: body, solid: true, overhead: y0 > 0 };
  WORLD.colliders.push(col);
  return { g, body, col };
}
function basicBox(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color }));
  m.position.set(x, y, z);
  return m;
}
// distancia del jugador al borde de un collider (mismo criterio que puertas y caja)
function colDist(c, px, pz) {
  return Math.hypot(Math.max(c.minX - px, 0, px - c.maxX), Math.max(c.minZ - pz, 0, pz - c.maxZ));
}

function buildRelics() {
  const GC = CONFIG.GENERATORS, SC = CONFIG.SOULS;
  const glowTex = radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,.5)');
  const quad = new THREE.PlaneGeometry(1, 1);

  // partículas: almas y chispas (aditivas) + humo (normal). Pools fijos, se reciclan en ronda
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: glowTex, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false; m.userData = { kind: null, life: 0, max: 1, v: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3() };
    scene.add(m); RELICS.fx.push(m);
  }
  const smokeTex = radialTex('rgba(150,148,140,.9)', 'rgba(110,108,100,.4)');
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: smokeTex, transparent: true, depthWrite: false }));
    m.visible = false; m.userData = { life: 0, max: 1.4, v: new THREE.Vector3() };
    scene.add(m); RELICS.smoke.push(m);
  }

  const mb = new MeshBuilder();                                   // todo lo estático: un draw call

  //--- generadores ---
  const GS = GC.size;
  for (const key of GEN_KEYS) {
    const sp = GC.spots[key];
    const r = relicBody(mb, sp, GS, 0x4c5242, 'gen:' + key, 'generator');
    r.body.userData.gen = key;
    const g = r.g, front = GS.d / 2;
    mb.box(0, GS.h + 0.13, -0.04, GS.w * 0.75, 0.26, GS.d * 0.7, 0x8a2a20);           // tanque
    mb.box(GS.w * 0.38, GS.h + 0.25, -GS.d * 0.3, 0.08, 0.5, 0.08, 0x2e2e2c);        // escape
    mb.box(-0.1, 0.45, front + 0.01, GS.w * 0.6, 0.4, 0.02, 0x2a2a28);                // rejilla
    mb.box(-GS.w * 0.3, 0.82, front + 0.03, 0.14, 0.05, 0.05, 0x1e1e1e);              // manija de la cuerda
    mb.box(-GS.w / 2 - 0.02, 0.08, 0, 0.07, 0.07, 0.8, 0x3a3a38);                    // patines
    mb.box( GS.w / 2 + 0.02, 0.08, 0, 0.07, 0.07, 0.8, 0x3a3a38);
    const lamp = basicBox(0.14, 0.14, 0.06, GC.lampOff, GS.w * 0.3, 0.85, front + 0.03);
    g.add(lamp);
    g.updateMatrixWorld(true);
    const f = relicWorld(sp, 0, front + 0.1), e = relicWorld(sp, GS.w * 0.38, -GS.d * 0.3);
    const y0 = sp.y || 0;                                            // F5.22: puede ir arriba (el anillo del caparazón)
    RELICS.gens[key] = { key, room: sp.room, x: sp.x, z: sp.z, g: g, body: r.body, col: r.col, lamp,
                         fx: f.x, fy: y0 + 0.7, fz: f.z, ex: e.x, ey: y0 + GS.h + 0.55, ez: e.z, puff: 0 };
  }

  //--- cajas de almas ---
  const SS = SC.size;
  const skull = makeTex((c, s) => {                               // calavera de 32 px (NearestFilter)
    c.clearRect(0, 0, s, s);
    c.fillStyle = '#d8ccb0'; c.fillRect(8, 5, 16, 15); c.fillRect(6, 8, 20, 9); c.fillRect(10, 20, 12, 6);
    c.fillStyle = '#1a0c08'; c.fillRect(10, 11, 5, 5); c.fillRect(17, 11, 5, 5); c.fillRect(15, 17, 2, 2);
    c.fillRect(12, 23, 1, 3); c.fillRect(15, 23, 1, 3); c.fillRect(18, 23, 1, 3);
  }, 1, 32);
  const redGlow = radialTex('rgba(255,70,50,.9)', 'rgba(200,20,10,.35)');
  for (const key of SOUL_KEYS) {
    const sp = SC.spots[key];
    const r = relicBody(mb, sp, SS, 0x3a2418, 'souls:' + key, 'world');
    const g = r.g, front = SS.d / 2;
    mb.box(0, SS.h + 0.04, 0, SS.w + 0.06, 0.08, SS.d + 0.06, 0x24150e);                  // tapa
    [-1, 1].forEach(s => mb.box(s * SS.w / 2, SS.h / 2, front, 0.06, SS.h, 0.06, 0x5a4a3a));   // esquineros
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46),
      new THREE.MeshBasicMaterial({ map: skull, transparent: true, color: 0xb8ac94 }));
    plate.position.set(0, SS.h * 0.55, front + 0.005);
    g.add(plate);
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(SS.w * 0.7, SS.d * 0.6),      // brasas en la tapa
      new THREE.MeshBasicMaterial({ color: 0x2a0808 }));
    lamp.rotation.x = -Math.PI / 2; lamp.position.y = SS.h + 0.085;
    g.add(lamp);
    g.updateMatrixWorld(true);
    // brillo (con el Pack-a-Punch activo) y barra de sangre: en la escena, de frente a la cámara
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: redGlow,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.set(sp.x, SS.h * 0.7, sp.z); glow.visible = false;
    scene.add(glow);
    const barW = 0.9, bar = new THREE.Group();
    bar.position.set(sp.x, SS.h + 0.75, sp.z); bar.visible = false;
    bar.add(new THREE.Mesh(new THREE.PlaneGeometry(barW + 0.06, 0.14), new THREE.MeshBasicMaterial({ color: 0x160404 })));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(barW, 0.09), new THREE.MeshBasicMaterial({ color: 0xb3140e }));
    fill.position.z = 0.002;
    bar.add(fill);
    scene.add(bar);
    const f = relicWorld(sp, 0, front + 0.3);
    RELICS.boxes[key] = { key, room: sp.room, x: sp.x, z: sp.z, fx: f.x, fz: f.z, g, body: r.body, col: r.col,
                          lamp, glow, bar, fill, barW };   // F5.8: sin el círculo rojo en el piso (pedido de Diego)
  }

  buildPapRelic();

  mb.setFrame(null);
  const merged = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  merged.userData.theme = false;                                  // MeshBuilder lo marca como tema: esto es lógica
  merged.updateMatrix();
}
// F5.21: el Pack-a-Punch con su propio MeshBuilder (antes iba en el mesh fusionado de todas las reliquias): así todo el
// cuerpo cuelga de RELICS.pap.g, se esconde con él y la planta jefa lo puede escupir entero (cinemática)
function buildPapRelic() {
  const mb = new MeshBuilder();
  //--- Pack-a-Punch (apagado hasta papReady) ---
  const PS = CONFIG.PAP.spot, PZ = CONFIG.PAP.size;
  const r = relicBody(mb, PS, PZ, 0x4a3a5a, 'pap', 'world');
  const g = r.g, front = PZ.d / 2, W = PZ.w, H = PZ.h, D = PZ.d;
  // F5.19b (Diego: "tipo calamar, mítico, azteca, brillante y surreal"): un altar azteca escalonado de piedra con frisos
  // de jade y oro, y encima un calamar-dios: manto morado con manchas que brillan, ojos enormes, tentáculos que bajan
  // por los costados y rodean la boca (el pico, por donde entra el arma). A los costados, dos piedras del sol que
  // giran al trabajar (`rollers`). Lo que brilla va en `pg` (MeshBasic con color por vértice; `neon` lo apaga y prende).
  // Ninguna luz nueva. El collider sigue siendo PZ
  const stone = 0x6a6258, stoneD = 0x4a443c, jade = 0x2a9a7a, gold = 0xd8a830, red = 0xa8322a, mantle = 0x6a2a8a, mantleD = 0x4a1a64;
  const pg = new MeshBuilder(); pg.setFrame(PS.x, PS.y || 0, PS.z, PS.rot);
  const CY = 0x5af8ff, MG = 0xff4af0, GD = 0xffd84a;
  // altar escalonado: 3 gradas con friso de grecas
  for (let k = 0; k < 3; k++) {
    const w = W + 1.0 - k * 0.3, d = D + 0.8 - k * 0.25, y = k * 0.16;
    mb.box(0, y + 0.08, 0, w, 0.16, d, k % 2 ? stoneD : stone);
    for (let i = 0; i < 9; i++) mb.box(-w / 2 + (i + 0.5) * w / 9, y + 0.08, d / 2 + 0.005, w / 9 - 0.04, 0.07, 0.01, i % 2 ? jade : gold);   // greca
    pg.box(0, y + 0.155, d / 2 + 0.01, w - 0.1, 0.012, 0.01, k === 1 ? MG : CY);
  }
  mb.box(0, 0.78, 0, W + 0.06, 0.6, D + 0.06, stone);                                   // bloque del cuerpo
  for (const s of [-1, 1]) {                                                             // frisos laterales: glifos de serpiente
    mb.box(s * (W / 2 + 0.04), 0.78, 0, 0.02, 0.5, D - 0.1, jade);
    for (let k = 0; k < 4; k++) mb.box(s * (W / 2 + 0.055), 0.62 + (k % 2) * 0.3, -D / 2 + 0.18 + k * 0.22, 0.02, 0.12, 0.14, gold);
    pg.box(s * (W / 2 + 0.06), 0.78, 0, 0.012, 0.03, D - 0.2, CY);
  }
  // el pico: marco de oro con dientes de obsidiana, hueco oscuro que brilla por dentro
  mb.box(0, 1.05, front + 0.05, W * 0.74, 0.56, 0.1, gold);
  mb.box(0, 1.05, front + 0.08, W * 0.58, 0.38, 0.06, 0x050208);
  for (let k = 0; k < 7; k++) {
    const x = -W * 0.24 + k * W * 0.08;
    mb.cyl(x, 1.24, front + 0.1, 0.03, 0.1, 0x1a1420, 0, 5, Math.PI, 0, 0);
    mb.cyl(x + 0.04, 0.86, front + 0.1, 0.03, 0.1, 0x1a1420, 0, 5);
  }
  pg.box(0, 1.05, front + 0.06, W * 0.5, 0.26, 0.01, MG);                              // brillo de adentro
  mb.box(0, 0.8, front + 0.22, W * 0.66, 0.06, 0.36, stoneD);                           // bandeja de piedra
  for (const s of [-1, 1]) mb.box(s * W * 0.34, 0.86, front + 0.22, 0.04, 0.1, 0.36, gold);
  // el manto del calamar (bulboso, hacia atrás y arriba) con aletas y manchas que brillan
  mb.sphere(0, H + 0.05, -0.1, W * 0.5, 0.75, D * 0.62, mantle, 16);
  mb.sphere(0, H + 0.62, -0.28, W * 0.34, 0.55, D * 0.44, mantleD, 14, -0.35, 0, 0);
  for (const s of [-1, 1]) mb.box(s * 0.5, H + 0.95, -0.42, 0.5, 0.04, 0.34, mantle, 0, 0, s * 0.5);   // aletas
  const rrp = mulberry(777);
  for (let k = 0; k < 22; k++) {
    const a = rrp() * Math.PI * 2, e = 0.2 + rrp() * 1.1, rx = W * 0.5, ry = 0.75, rz = D * 0.62;
    const x = Math.cos(a) * Math.sin(e) * rx, y = H + 0.05 + Math.cos(e) * ry, z = -0.1 + Math.sin(a) * Math.sin(e) * rz;
    pg.sphere(x * 1.01, y, z * 1.01, 0.035 + rrp() * 0.03, 0.035, 0.035, [CY, MG, GD][k % 3], 6);
  }
  // ojos enormes a los costados del frente, con pupila en ranura
  for (const s of [-1, 1]) {
    mb.sphere(s * 0.42, H - 0.05, 0.3, 0.2, 0.2, 0.16, gold, 12);
    pg.sphere(s * 0.43, H - 0.05, 0.4, 0.15, 0.15, 0.1, GD, 12);
    mb.box(s * 0.43, H - 0.05, 0.5, 0.035, 0.2, 0.02, 0x0a0410);
  }
  // corona de plumas de oro y jade (quetzal) detrás del manto
  for (let k = 0; k < 9; k++) {
    const a = -1.0 + k * 0.25;
    mb.box(Math.sin(a) * 0.55, H + 0.9 + Math.cos(a) * 0.35, -0.62, 0.1, 0.62, 0.03, k % 2 ? jade : gold, 0, 0, -a);
    pg.box(Math.sin(a) * 0.62, H + 0.9 + Math.cos(a) * 0.62, -0.6, 0.06, 0.08, 0.02, k % 2 ? CY : GD);
  }
  // tentáculos: bajan por los costados y dos rodean la boca, con ventosas que brillan
  for (let t = 0; t < 6; t++) {
    const s = t % 2 ? 1 : -1, j = Math.floor(t / 2), x0 = s * (0.2 + j * 0.2);
    const pts = [[x0, H - 0.1, 0.35 - j * 0.25], [s * (0.55 + j * 0.12), H - 0.55, 0.52 - j * 0.3], [s * (0.72 + j * 0.1), 0.95, 0.4 - j * 0.3],
                 [s * (0.9 + j * 0.05), 0.55, 0.62 - j * 0.35], [s * (0.72 + j * 0.2), 0.36, 0.78 - j * 0.4]];
    mb.tube(pts, 0.1 - j * 0.015, 0.025, j === 1 ? mantleD : mantle, 16, 7);
    for (let q = 1; q < 5; q++) { const p = pts[q]; pg.sphere(p[0] * 0.98, p[1] - 0.04, p[2] + 0.05, 0.025, 0.025, 0.025, q % 2 ? MG : CY, 5); }
  }
  pg.box(0, 1.37, front + 0.1, W * 0.66, 0.025, 0.02, CY);                            // labio de arriba
  // dos braseros de obsidiana adelante del altar, con fuego violeta (MeshBasic)
  for (const s of [-1, 1]) {
    mb.cyl(s * (W / 2 + 0.3), 0.32, front + 0.3, 0.13, 0.35, 0x1a1420, 1.3, 8);
    pg.sphere(s * (W / 2 + 0.3), 0.8, front + 0.3, 0.1, 0.2, 0.1, MG, 8);
    pg.sphere(s * (W / 2 + 0.3), 0.75, front + 0.3, 0.14, 0.12, 0.14, 0x9a4aff, 8);
  }
  pg.setFrame(null);
  const pgm = pg.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x303038 }));
  if (pgm) { pgm.userData.theme = false; pgm.updateMatrix(); }
  // piedras del sol a los costados (grupos: giran al trabajar): disco con anillos, rayos y la cara en el centro
  const rollers = [-1, 1].map(s => {
    const rg = new THREE.Group(); rg.position.set(s * (W / 2 + 0.16), 1.2, 0);
    const rb = new MeshBuilder();
    rb.cyl(0, -0.04, 0, 0.42, 0.08, stone, 1, 20);
    rb.cyl(0, 0.04, 0, 0.34, 0.015, gold, 1, 20);
    rb.cyl(0, 0.055, 0, 0.26, 0.015, jade, 1, 20);
    rb.cyl(0, 0.07, 0, 0.14, 0.03, gold, 1, 12);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; rb.box(Math.cos(a) * 0.37, 0.05, Math.sin(a) * 0.37, 0.12, 0.03, 0.06, k % 2 ? red : gold, 0, -a, 0); }
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8 + 0.2; rb.box(Math.cos(a) * 0.3, 0.07, Math.sin(a) * 0.3, 0.04, 0.02, 0.04, 0x1a1420); }
    for (const e of [-1, 1]) rb.box(e * 0.05, 0.09, -0.03, 0.04, 0.02, 0.03, 0x0a0410);   // la cara del sol
    rb.box(0, 0.09, 0.05, 0.08, 0.02, 0.02, red);
    const rm = rb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    scene.remove(rm); rm.matrixAutoUpdate = true; rm.userData.theme = false; rg.add(rm);
    rg.rotation.set(0, 0, -s * Math.PI / 2, 'ZYX'); g.add(rg);        // mira hacia afuera; rotation.y lo gira sobre su eje
    return rg;
  });
  const lamp = basicBox(W * 0.8, 0.05, 0.06, 0x303038, 0, 0.5, front + 0.36);   // F5.19b: al pie del cuerpo
  g.add(lamp);
  const screenTex = makeTex((c, s) => {
    c.fillStyle = '#05080a'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#7af0ff'; c.font = 'bold ' + Math.floor(s * 0.2) + 'px monospace'; c.textAlign = 'center';
    c.fillText('PACK-A', s / 2, s * 0.44); c.fillText('PUNCH', s / 2, s * 0.72);
  }, 1, 128);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.24), new THREE.MeshBasicMaterial({ map: screenTex, color: 0x1a1a1a }));
  screen.position.set(0, 1.52, front + 0.07);                        // F5.19b: placa entre los ojos del calamar
  g.add(screen);
  const pglow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.6), new THREE.MeshBasicMaterial({
    map: radialTex('rgba(140,240,255,.9)', 'rgba(80,120,255,.35)'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  pglow.position.set(0, 1.1, front + 0.4); pglow.visible = false;
  g.add(pglow);
  g.updateMatrixWorld(true);
  RELICS.pap = { room: PS.room || 'R11', level: PS.level || 0, x: PS.x, z: PS.z, g, body: r.body, col: r.col, lamp, screen, glow: pglow,
                 neon: pgm, rollers };                               // F5.19
  g.visible = plantPapFree();                                        // F5.20: escondido bajo raíces hasta que la planta lo escupe

  // F2b: arma mejorada en la bandeja, una por arma, con camo. Creadas una vez, se prenden y apagan
  const tray = relicWorld(PS, 0, front + 0.12), ty = (PS.y || 0) + 1.12;   // F5.13: arriba del templo
  RELICS.pap.trayY = ty;
  for (const id in CONFIG.WEAPONS) {
    const m = applyCamo(buildWeaponModel(CONFIG.WEAPONS[id]));
    m.position.set(tray.x, ty, tray.z); m.visible = false;
    scene.add(m);
    PAPST.display[id] = m;
  }
  // el cuerpo y lo que brilla se dibujaron en coordenadas del mundo: cuelgan de g con la inversa de su lugar, así
  // quedan igual y siguen a g si se mueve
  mb.setFrame(null);
  const body = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const inv = g.matrixWorld.clone().invert();
  for (const m of [body, pgm]) {
    if (!m) continue;
    scene.remove(m); m.userData.theme = false; m.matrixAutoUpdate = false; m.matrix.copy(inv); g.add(m);
  }
  g.updateMatrixWorld(true);
}


// golpe de cuchillo sobre un generador. true = lo prendió
function hitGenerator(key) {
  const g = RELICS.gens[key];
  if (!g || state.generators[key]) return false;
  state.generators[key] = true;
  g.lamp.material.color.setHex(CONFIG.GENERATORS.lampOn);
  for (let i = 0; i < 10; i++) spawnRelicFx('spark', g.fx, g.fy, g.fz);
  for (let i = 0; i < 3; i++) spawnSmoke(g.ex, g.ey + i * 0.15, g.ez);
  sfxGenerator();
  checkPap();
  return true;
}

// zombie muerto (cualquier arma): alma para la caja que lo tenga en el radio, con línea libre.
// Las cajas están a más de 2 radios entre sí: un kill cuenta para una sola. Devuelve la caja o null
function soulFromKill(z) {
  const S = CONFIG.SOULS, R2 = S.radius * S.radius;
  for (const key of SOUL_KEYS) {
    if (state.souls[key] >= S.need) continue;
    const b = RELICS.boxes[key];
    const dx = z.px - b.x, dz = z.pz - b.z;
    if (dx * dx + dz * dz > R2) continue;
    if (!segmentClear(z.px, z.pz, b.fx, b.fz, 0, true)) continue;   // al frente de la caja: su collider no tapa
    state.souls[key]++;
    const full = state.souls[key] >= S.need;
    spawnRelicFx('soul', z.px, groundY(z.px, z.pz) + 1.2, z.pz, b.x, S.size.h + 0.2, b.z);
    sfxSoul(full);
    // F5.19c: la música de Diego cuando se llenan las 3 cajas de almas
    if (full && SOUL_KEYS.every(k => state.souls[k] >= S.need)) playSample('musica_al_haber_llenado_las_cajas_de_almas', { dest: AUDIO.game });
    if (full) checkPap();
    return key;
  }
  return null;
}

function papReady() {
  return GEN_KEYS.every(k => state.generators[k]) && SOUL_KEYS.every(k => state.souls[k] >= CONFIG.SOULS.need) &&
         plantPapFree();                                           // F5.20: la planta jefa lo escupe al morir
}
// lo que falta, para el cartel de la máquina
function papMissing() {
  const g = GEN_KEYS.filter(k => !state.generators[k]).length;
  const b = SOUL_KEYS.filter(k => state.souls[k] < CONFIG.SOULS.need).length;
  const parts = [];
  if (g) parts.push(g + (g === 1 ? ' generator' : ' generators'));
  if (b) parts.push(b + (b === 1 ? ' soul box' : ' soul boxes'));
  return parts.join(' and ') + ' missing';
}
// se prende una sola vez por partida (resetRelics la apaga)
function checkPap() {
  if (RELICS.papOn || !papReady()) return false;
  RELICS.papOn = true;
  const P = RELICS.pap;
  P.lamp.material.color.setHex(0x7af0ff);
  P.screen.material.color.setHex(0xffffff);
  P.glow.visible = true;
  if (P.neon) P.neon.material.color.setHex(0xffffff);                // F5.19: caños, labio y bobinas se prenden
  sfxPapOn();
  return true;
}

//--- F2b: la mejora. idle -> working (PAP.time s, el arma está adentro) -> ready (PAP.grabTime s para
// agarrarla con F; si no, se pierde) -> idle. Mientras trabaja, el slot sale del inventario: si no te queda
// otra arma, quedás con las manos vacías (cuchillo y granadas igual funcionan).
const PAPST = { phase: 'idle', t: 0, slot: null, display: {} };
function usePap() {
  const P = CONFIG.PAP, W = weaponsState;
  if (!RELICS.papOn) return false;
  if (PAPST.phase === 'ready') return grabPap();
  if (PAPST.phase !== 'idle' || W.phase === 'grenade') return false;
  const s = curSlot();
  if (!s || s.pap) return false;                                 // sin arma, o ya mejorada (no hay re-PaP)
  if (!spendPoints(P.cost)) return false;
  state.weapons.splice(state.weapons.indexOf(s), 1);
  state.currentWeapon = Math.max(0, Math.min(state.currentWeapon, state.weapons.length - 1));
  if (W.phase === 'reloading') UI.reload.style.opacity = '0';    // la recarga se pierde con el arma
  equipModel(curDef());
  if (curDef()) raiseWeapon(); else { W.phase = 'idle'; W.phaseT = 0; W.pendingSlot = -1; }
  updateAmmoHUD();
  PAPST.phase = 'working'; PAPST.t = 0; PAPST.slot = s;
  sfxPapWork();
  return true;
}
function grabPap() {
  const s = PAPST.slot, def = papDef(s.id);
  s.pap = true; s.mag = def.magSize; s.reserve = def.reserveMax;
  // si mientras tanto compraste la misma arma en la pared, la mejorada la reemplaza (nunca dos iguales)
  const dup = state.weapons.findIndex(w => w.id === s.id);
  if (dup >= 0) { state.weapons[dup] = s; state.currentWeapon = dup; }
  else if (state.weapons.length < maxWeapons()) { state.weapons.push(s); state.currentWeapon = state.weapons.length - 1; }
  else state.weapons[state.currentWeapon] = s;                   // inventario lleno: reemplaza la equipada
  equipModel(def); raiseWeapon(); updateAmmoHUD();
  papIdle();
  return true;
}
function papIdle() {
  PAPST.phase = 'idle'; PAPST.t = 0; PAPST.slot = null;
  for (const id in PAPST.display) PAPST.display[id].visible = false;
}
function papPrompt() {
  const P = CONFIG.PAP;
  if (!plantPapFree()) return { text: 'Something is buried in the roots...', cost: 0 };   // F5.20
  if (!RELICS.papOn) return { text: 'Pack-a-Punch off - ' + papMissing(), cost: 0 };
  if (PAPST.phase === 'working') return { text: 'Pack-a-Punch working...', cost: 0 };
  if (PAPST.phase === 'ready') return { text: '[F] Take ' + papDef(PAPST.slot.id).name, cost: 0 };
  const s = curSlot();
  if (!s) return { text: 'Pack-a-Punch - no weapon', cost: 0 };
  if (s.pap) return { text: slotDef(s).name + ' - already upgraded', cost: 0 };
  return { text: '[F] Pack-a-Punch ' + CONFIG.WEAPONS[s.id].name + ' - ' + P.cost, cost: P.cost };
}
function updatePap(dt) {
  const P = CONFIG.PAP, t = clock.elapsedTime, R = RELICS.pap;
  // F5.19: prendida, los rodillos giran despacio (rápido mientras trabaja) y las bobinas laten
  if (R && RELICS.papOn) {
    const sp = PAPST.phase === 'working' ? 9 : 0.6;
    for (const rg of R.rollers || []) rg.rotation.y += dt * sp;
    if (R.neon) { const k = PAPST.phase === 'working' ? 0.55 + 0.45 * Math.abs(Math.sin(t * 22)) : 0.8 + 0.2 * Math.sin(t * 3); R.neon.material.color.setRGB(k, k, k); }   // F5.19b: los colores van por vértice
  }
  if (PAPST.phase === 'working') {
    PAPST.t += dt;
    RELICS.pap.glow.material.opacity = 0.5 + 0.5 * Math.abs(Math.sin(t * 14));   // trabaja: brillo nervioso
    if (PAPST.t >= P.time) {
      PAPST.phase = 'ready'; PAPST.t = 0;
      PAPST.display[PAPST.slot.id].visible = true;
      sfxPapDone();
    }
  } else if (PAPST.phase === 'ready') {
    PAPST.t += dt;
    const m = PAPST.display[PAPST.slot.id];
    m.rotation.y = t * 2; m.position.y = RELICS.pap.trayY + 0.05 * Math.sin(t * 3);
    if (PAPST.t >= P.grabTime) { papIdle(); sfxDeny(); }          // no la agarraste: se pierde
  }
}

function spawnRelicFx(kind, x, y, z, tx, ty, tz) {
  const m = RELICS.fx[RELICS.fxI];
  RELICS.fxI = (RELICS.fxI + 1) % RELICS.fx.length;
  const u = m.userData;
  u.kind = kind; u.life = 0;
  m.position.set(x, y, z); u.a.set(x, y, z);
  if (kind === 'soul') { u.max = CONFIG.SOULS.flyTime; u.b.set(tx, ty, tz); m.material.color.setHex(0xff3322); }
  else { u.max = rnd(0.3, 0.55); u.v.set(rnd(-2, 2), rnd(1.5, 3.5), rnd(-2, 2)); m.material.color.setHex(0xffd060); }
  m.visible = true;
}
function spawnSmoke(x, y, z) {
  const m = RELICS.smoke[RELICS.smokeI];
  RELICS.smokeI = (RELICS.smokeI + 1) % RELICS.smoke.length;
  m.userData.life = 0; m.userData.v.set(rnd(-0.15, 0.15), 0.7, rnd(-0.15, 0.15));
  m.position.set(x, y, z); m.visible = true;
}

function updateRelics(dt) {
  const S = CONFIG.SOULS, t = clock.elapsedTime, px = player.pos.x, pz = player.pos.z;
  // cajas: barra de sangre (cerca y a la vista), brasas según el progreso, brillo con el PaP activo
  for (const key of SOUL_KEYS) {
    const b = RELICS.boxes[key], p = Math.min(1, state.souls[key] / S.need);
    const show = Math.hypot(px - b.x, pz - b.z) < S.showDist && segmentClear(px, pz, b.fx, b.fz, 0, true);
    b.bar.visible = show;
    if (show) {
      b.fill.scale.x = Math.max(0.001, p);
      b.fill.position.x = -b.barW / 2 * (1 - p);
      b.bar.quaternion.copy(camera.quaternion);
    }
    const heat = p >= 1 ? 0.8 + 0.2 * Math.sin(t * 5 + b.x) : p * 0.6;
    b.lamp.material.color.setRGB(0.16 + 0.84 * heat, 0.03 + 0.14 * heat, 0.03 + 0.07 * heat);
    b.glow.visible = RELICS.papOn;
    if (RELICS.papOn) {
      b.glow.quaternion.copy(camera.quaternion);
      b.glow.material.opacity = 0.55 + 0.25 * Math.sin(t * 3 + b.z);
    }
  }
  // generadores prendidos: humo por el escape (solo si el jugador está cerca)
  for (const key of GEN_KEYS) {
    const g = RELICS.gens[key];
    if (!state.generators[key]) continue;
    g.puff -= dt;
    if (g.puff <= 0) { g.puff = 0.9; if (Math.hypot(px - g.x, pz - g.z) < 16) spawnSmoke(g.ex, g.ey, g.ez); }
  }
  if (RELICS.papOn && PAPST.phase !== 'working') RELICS.pap.glow.material.opacity = 0.7 + 0.3 * Math.sin(t * 2.2);
  updatePap(dt);
  // partículas
  for (const m of RELICS.fx) {
    if (!m.visible) continue;
    const u = m.userData;
    u.life += dt;
    const k = u.life / u.max;
    if (k >= 1) { m.visible = false; continue; }
    if (u.kind === 'soul') {                                     // arco hasta la tapa
      m.position.lerpVectors(u.a, u.b, k);
      m.position.y += Math.sin(k * Math.PI) * 0.8;
      m.scale.setScalar(0.4 * (1 - 0.5 * k));
    } else {                                                     // chispa con gravedad
      u.v.y -= 9 * dt;
      m.position.addScaledVector(u.v, dt);
      m.scale.setScalar(0.03 + 0.12 * (1 - k));
    }
    m.quaternion.copy(camera.quaternion);
  }
  for (const m of RELICS.smoke) {
    if (!m.visible) continue;
    const u = m.userData;
    u.life += dt;
    const k = u.life / u.max;
    if (k >= 1) { m.visible = false; continue; }
    m.position.addScaledVector(u.v, dt);
    m.scale.setScalar(0.3 + 0.9 * k);
    m.material.opacity = 0.5 * (1 - k);
    m.quaternion.copy(camera.quaternion);
  }
}

// resetGame(): generadores apagados, cajas vacías, PaP apagado, partículas fuera
function resetRelics() {
  for (const k of GEN_KEYS) {
    state.generators[k] = false;
    const g = RELICS.gens[k];
    if (g) { g.lamp.material.color.setHex(CONFIG.GENERATORS.lampOff); g.puff = 0; }
  }
  for (const k of SOUL_KEYS) {
    state.souls[k] = 0;
    const b = RELICS.boxes[k];
    if (b) { b.glow.visible = false; b.bar.visible = false; }
  }
  RELICS.papOn = false;
  const P = RELICS.pap;
  if (P) { P.lamp.material.color.setHex(0x303038); P.screen.material.color.setHex(0x1a1a1a); P.glow.visible = false; if (P.neon) P.neon.material.color.setHex(0x303038); }
  RELICS.fx.forEach(m => { m.visible = false; });
  RELICS.smoke.forEach(m => { m.visible = false; });
  papIdle();                                                       // F2b: nada adentro de la máquina
}
