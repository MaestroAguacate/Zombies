//=== 7n. LA BESTIA DEL BÚNKER (V2 F5.26) ===================================
// La guarida de la Bestia es el búnker (agrandado en F5.26). Acá viven:
//  - los barriles de gasolina (CONFIG.BEAST.barrels): sólidos contra las paredes (en el anillo no navegable: no
//    cambian el grid). Un tiro (traceShot/tracePierce -> shootBarrel) o una explosión cerca (explodeAt ->
//    barrelBlast) los hace explotar: explodeAt con daño grande, a los bosses una fracción de su vida (bossFrac) y daño
//    propio. Explotado: el collider deja de ser sólido y sale de hitMeshes (como una puerta abierta). Vuelven con
//    resetBarrels (al reiniciar y cuando termina la pelea con la Bestia);
//  - la escalera de la escotilla (abajo): la Bestia la arranca al despertarse (breakLadder) y los peldaños quedan
//    tirados en el piso. Rota, no se sube (hatchPrompt/useHatch) y los zombies no cruzan (buildNavGrid no arma
//    NAV.hatch). Se arregla manteniendo F (updateBeast, barra #craft, como el banco del escudo).
// La Bestia (tanda B): un objeto de boss más (variant 'bestia', en BOSS.pool: barra, niebla, damageZombie, recompensa de
// bossDeath) pero con su propio cerebro (beastTick, llamado desde bossTick). Una por partida (BEAST.phase):
//  'sleep': acurrucada en la esquina (CONFIG.BEAST.lair), fuera de state.zombies (la ronda no la espera). Una caja de tiro
//           invisible (hitMeshes, type 'beastSleep') la despierta de un tiro; también acercarte a wakeDist o una explosión.
//  'awake': entra a state.zombies. Ruge, corre a la escalera y la arranca (breakLadder), y después te caza:
//           corre a CONFIG.BEAST.speed (5.0, excepción aprobada), zarpazo que te lanza por el aire, salto desde lejos,
//           grito que aturde, charcos de slime negro detrás suyo y escupitajos de slime.
//  'dead':  no vuelve en toda la partida. Al morir los barriles reaparecen.
const BEAST = { barrels: [], broken: false, ladder: null, debris: null, buildT: 0,
                z: null, phase: 'sleep', sleepBox: null,
                // F5.28: el tentáculo que te agarra (tg: off/warn/shoot/grab/swallow/back), los del piso y la mandíbula
                tg: { state: 'off', t: 0, len: 0, full: 0, hits: 0, stabs: 0, stall: 0, lx: 0, lz: 0, d0: 0, y0: 0, k: 0, killed: false,
                      tip: new THREE.Vector3(), prev: new THREE.Vector3(), dir: new THREE.Vector3() },
                tent: null, tentHit: null, spikes: [], jawOpen: 0, mouth: new THREE.Vector3() };

// (buildBunkerShell, antes del grid) los cuerpos sólidos de los barriles
function buildBarrelSolids() {
  const B = CONFIG.BUNKER, C = CONFIG.BEAST.barrel, y0 = B.y, mat = new THREE.MeshBasicMaterial();
  CONFIG.BEAST.barrels.forEach(([x, z], i) => {
    const r = addBox(x - C.w / 2, x + C.w / 2, y0, y0 + C.h, z - C.w / 2, z + C.w / 2, mat, 'barrel:' + i, { type: 'barrel' });
    r.mesh.visible = false;
    r.mesh.userData.barrel = i;
    BEAST.barrels.push({ i, x, z, mesh: r.mesh, col: r.col, g: null, alive: true, fuseT: 0 });
  });
}

// dibujo: barril de cubos rojo con franjas, tapa, manija y el cartel de inflamable; la escalera y sus pedazos
function buildBeastLair() {
  const B = CONFIG.BUNKER, C = CONFIG.BEAST.barrel, y0 = B.y;
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x1a0a06 });
  for (const b of BEAST.barrels) {
    const mb = new MeshBuilder();
    mb.cyl(0, 0, 0, C.w / 2, C.h, 0xa8261a, 1, 10);
    for (const y of [0.18, 0.82]) mb.cyl(0, y * C.h - 0.03, 0, C.w / 2 + 0.02, 0.06, 0x6a1410, 1, 10);   // aros
    mb.box(0, C.h * 0.5, C.w / 2 + 0.005, 0.3, 0.26, 0.01, 0xe8c030);                                    // cartel amarillo
    mb.box(0, C.h * 0.5, C.w / 2 + 0.012, 0.08, 0.16, 0.005, 0x1a1a1a);                                  // llama del cartel
    mb.box(0, C.h * 0.5 + 0.1, C.w / 2 + 0.012, 0.14, 0.04, 0.005, 0x1a1a1a);
    mb.box(0, C.h + 0.02, 0, C.w * 0.8, 0.04, C.w * 0.8, 0x7a1a12);                                      // tapa
    mb.box(0.12, C.h + 0.06, 0.1, 0.1, 0.06, 0.1, 0x3a3a3a);                                             // tapón
    mb.box(-0.1, 0.01, 0.35, 0.5, 0.01, 0.35, 0x1a1208);                                                 // mancha de nafta
    const m = mb.mesh(mat);
    scene.remove(m); m.userData.theme = false;
    const g = new THREE.Group(); g.add(m); g.position.set(b.x, y0, b.z); scene.add(g);
    b.g = g;
  }
  // la escalera (rieles y peldaños) y sus pedazos tirados (se ven con la escalera rota)
  const L = B.ladder, lad = new MeshBuilder(), deb = new MeshBuilder(), n = Math.floor((B.h - 0.4) / 0.32);
  lad.box(-0.35, B.h / 2, 0, 0.08, B.h, 0.08, 0x6a6a68); lad.box(0.35, B.h / 2, 0, 0.08, B.h, 0.08, 0x6a6a68);
  for (let i = 0; i < n; i++) lad.box(0, 0.3 + i * 0.32, 0, 0.7, 0.05, 0.05, 0x7a7a78);
  const r = mulberry(26);
  for (let i = 0; i < CONFIG.BEAST.ladder.pieces; i++) {                        // peldaños y rieles doblados en el piso
    const a = r() * 6.28, d = 0.6 + r() * 2.4, rail = i < 2;
    deb.box(Math.cos(a) * d, 0.04 + r() * 0.05, 1.2 + Math.abs(Math.sin(a)) * d, rail ? 0.08 : 0.7, 0.05, rail ? 2.6 : 0.05, rail ? 0x5a5a58 : 0x7a7a78, r() * 0.3, a, 0);
  }
  deb.box(-0.35, 0.9, 0, 0.08, 1.8, 0.08, 0x5a5a58, 0, 0, 0.35);                // un tramo de riel torcido que quedó
  deb.box(0.3, B.h - 0.7, 0, 0.08, 1.4, 0.08, 0x5a5a58, 0, 0, -0.2);           // y otro colgando del techo
  const lm = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x222222 });
  BEAST.ladder = lad.mesh(lm); BEAST.debris = deb.mesh(lm);
  for (const m of [BEAST.ladder, BEAST.debris]) { m.position.set(L.x, y0, L.z); m.matrixAutoUpdate = true; m.userData.theme = false; }
  BEAST.debris.visible = false;
  // el nido de la Bestia en su esquina: slime negro en el piso y las paredes, huesos, costillares, cráneos, restos de ropa
  // del FBI y marcas de garras en la pared (un MeshBuilder; sin collider)
  const LR = CONFIG.BEAST.lair, ns = new MeshBuilder(), rn = mulberry(73);
  for (let i = 0; i < 90; i++) {
    const a = rn() * 6.28, d = Math.sqrt(rn()) * 4.2, x = LR.x + Math.cos(a) * d, z = LR.z + Math.sin(a) * d;
    if (x > B.x2 - 0.3 || z < B.z1 + 0.3) continue;
    ns.box(x, y0 + 0.02, z, 0.3 + rn() * 0.4, 0.03, 0.3 + rn() * 0.4, [0x070504, 0x0e0a07, 0x1a120c][i % 3], 0, rn() * 3, 0);
  }
  for (let i = 0; i < 26; i++) {                                                   // huesos sueltos
    const a = rn() * 6.28, d = 1.2 + rn() * 3.2, x = LR.x + Math.cos(a) * d, z = LR.z + Math.sin(a) * d;
    if (x > B.x2 - 0.4 || z < B.z1 + 0.4) continue;
    ns.box(x, y0 + 0.06, z, 0.5 + rn() * 0.3, 0.08, 0.08, 0xd4c4a0, 0, rn() * 3, 0);
    ns.box(x + 0.25, y0 + 0.07, z, 0.12, 0.12, 0.14, 0xe0d4b4, 0, rn() * 3, 0);
  }
  for (let i = 0; i < 3; i++) {                                                    // costillares
    const x = LR.x - 2.2 + i * 1.8, z = LR.z + 1.8 - i * 0.9;
    ns.box(x, y0 + 0.08, z, 0.1, 0.1, 1.0, 0xc8b894);
    for (let k = 0; k < 5; k++) for (const s of [-1, 1]) ns.box(x + s * 0.2, y0 + 0.2, z - 0.4 + k * 0.2, 0.35, 0.05, 0.05, 0xd4c4a0, 0, 0, s * 0.8);
  }
  for (let i = 0; i < 4; i++) {                                                    // cráneos
    const x = LR.x - 3 + i * 1.3, z = LR.z - 1.5 + (i % 2) * 3.2;
    ns.box(x, y0 + 0.13, z, 0.24, 0.24, 0.28, 0xe0d4b4); ns.box(x, y0 + 0.06, z + 0.12, 0.18, 0.1, 0.12, 0xd4c4a0);
    ns.box(x - 0.06, y0 + 0.16, z + 0.141, 0.06, 0.06, 0.01, 0x1a1208); ns.box(x + 0.06, y0 + 0.16, z + 0.141, 0.06, 0.06, 0.01, 0x1a1208);
  }
  ns.box(LR.x - 1.5, y0 + 0.04, LR.z - 2.4, 0.9, 0.05, 0.6, 0x1a1c24, 0, 0.6, 0);  // saco del FBI rasgado
  ns.box(LR.x - 1.3, y0 + 0.07, LR.z - 2.3, 0.3, 0.02, 0.2, 0xe8c030, 0, 0.6, 0);
  for (let k = 0; k < 4; k++) ns.box(B.x2 - 0.22, y0 + 1.6 + k * 0.08, LR.z - 1 + k * 0.25, 0.02, 1.4, 0.06, 0x0a0806, 0.4, 0, 0);   // garras en la pared
  for (let k = 0; k < 4; k++) ns.box(LR.x - 2 + k * 0.25, y0 + 1.4 + k * 0.1, B.z1 + 0.22, 0.06, 1.2, 0.02, 0x0a0806, 0, 0, 0.35);
  for (let k = 0; k < 8; k++) ns.box(B.x2 - 0.24, y0 + 0.5 + rn() * 3.5, LR.z - 3 + rn() * 5, 0.03, 0.6 + rn() * 1.2, 0.2 + rn() * 0.3, 0x070504);   // slime chorreando
  const nm = ns.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x1a1410 }));
  if (nm) { nm.userData.theme = false; nm.updateMatrix(); }
  buildBeast();                                                                  // la Bestia, dormida en su esquina
  buildCrias();                                                                  // y sus crías (pool)
}

//--- barriles ---
function shootBarrel(mesh) {
  const b = BEAST.barrels[mesh.userData.barrel];
  if (b && b.alive && b.fuseT <= 0) blowBarrel(b);
}
function blowBarrel(b) {
  const B = CONFIG.BUNKER, C = CONFIG.BEAST.barrel;
  b.alive = false; b.fuseT = 0;
  b.col.solid = false;
  const k = WORLD.hitMeshes.indexOf(b.mesh);
  if (k >= 0) WORLD.hitMeshes.splice(k, 1);
  b.g.visible = false;
  explodeAt(b.x, B.y + C.h * 0.5, b.z, { damage: C.damage, radius: C.radius, self: C.self, bossFrac: C.bossFrac, src: 'barrel', color: 0xff6a1a });
  spawnSplashFx(b.x, B.y + 1.2, b.z, 0xff9a2a, C.radius * 0.8);
}
// una explosión cerca prende a los barriles vivos a menos de radius m (con un poquito de retraso: cadena)
function barrelBlast(x, y, z, R) {
  for (const b of BEAST.barrels) {
    if (!b.alive || b.fuseT > 0) continue;
    if (Math.hypot(b.x - x, b.z - z) < R * 0.8 && Math.abs(y - CONFIG.BUNKER.y) < 4) b.fuseT = CONFIG.BEAST.barrel.chain;
  }
  const L = CONFIG.BEAST.lair;                                                   // una explosión cerca la despierta
  if (BEAST.phase === 'sleep' && Math.hypot(L.x - x, L.z - z) < R + 2 && Math.abs(y - CONFIG.BUNKER.y) < 4) wakeBeast();
}
function resetBarrels() {
  for (const b of BEAST.barrels) {
    b.fuseT = 0;
    if (b.alive) continue;
    b.alive = true; b.col.solid = true;
    if (WORLD.hitMeshes.indexOf(b.mesh) < 0) WORLD.hitMeshes.push(b.mesh);
    if (b.g) b.g.visible = true;
  }
}

//--- escalera ---
function breakLadder() {
  if (BEAST.broken) return;
  BEAST.broken = true;
  if (BEAST.ladder) { BEAST.ladder.visible = false; BEAST.debris.visible = true; }
  const L = CONFIG.BUNKER.ladder;
  spawnSplashFx(L.x, CONFIG.BUNKER.y + 1.5, L.z + 0.5, 0x8a8a88, 1.6);
  addTrauma(0.5);
  sfxExplosion(Math.hypot(player.pos.x - L.x, player.pos.z - L.z) + 6);
  buildNavGrid(); updateFlowField(true);                                          // sin el enlace de la escotilla
}
function fixLadder() {
  BEAST.broken = false; BEAST.buildT = 0;
  if (BEAST.ladder) { BEAST.ladder.visible = true; BEAST.debris.visible = false; }
  buildNavGrid(); updateFlowField(true);
}
function ladderBroken() { return BEAST.broken; }

//--- la Bestia: modelo (F5.28, Diego: "como el Lich de Hora de Aventura, un cráneo con tentáculos y sangre, carne abierta,
// que dé miedo") ---
// Un cráneo gigante (la cabeza: recibe headshots) con la tapa partida y el cerebro a la vista, cuernos de ciervo, cuencas
// con ojos verdes que brillan (z.eyeMat: bossEyes los pone amarillos y rojos con poca vida), mandíbula colgando con dientes
// (BEAST.jaw: se abre para lanzar el tentáculo y para tragarte). Debajo, una masa de carne abierta con costillas, columna y
// venas, chorreando sangre. Camina sobre 4 tentáculos gruesos (armL/armR adelante, legL/legR atrás: reciben balas) y le
// cuelgan 6 más, que ondulan (z.tents). Todo en cubos
// F5.28b: ya no camina: se arrastra como pulpo, con el cuerpo bajo y 12 tentáculos abiertos sobre el piso (animateBeast)
const LIMB_A = [-0.75, 0.75, -2.3, 2.3], LIMB_SP = 1.3;            // ángulo de cada pata (armL, armR, legL, legR) y apertura
function setLimb(p, i, x, y) { p.rotation.set(-LIMB_SP + x, LIMB_A[i] + y, 0); }
const LICH_BONE = 0xd8cfb4, LICH_BONE2 = 0xb8ae94, LICH_DARK = 0x1a0606, LICH_FLESH = 0x7a1a1a, LICH_FLESH2 = 0x5a0e10,
      LICH_BRAIN = 0xc86a7a, LICH_BLOOD = 0x8a0000, LICH_TENT = 0x4a1418, LICH_TENT2 = 0x6a2226, LICH_SUCK = 0xd89aa0;
// un tentáculo de cubos colgando hacia -y desde (0,0,0) (en el marco de la parte), afinándose, con ventosas
function lichTentacle(mb, L, r0, bend, seed) {
  const n = Math.max(4, Math.round(L / 0.22)), rr = mulberry(seed);
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), s = r0 * (1 - 0.7 * k);
    x += Math.sin(k * 3 + seed) * bend * 0.05; z += bend * 0.04 * k;
    mb.box(x, y, z, s, L / n * 1.15, s, i % 2 ? LICH_TENT : LICH_TENT2);
    if (i % 2 === 0 && s > 0.08) mb.box(x, y, z + s * 0.5, s * 0.5, s * 0.3, 0.04, LICH_SUCK);   // ventosa
    if (rr() < 0.25) mb.box(x + s * 0.5, y, z, 0.03, 0.12, 0.03, LICH_BLOOD);                     // sangre
    y -= L / n;
  }
}
function createBeast() {
  const bone = new THREE.MeshLambertMaterial({ color: LICH_BONE });
  const flesh = new THREE.MeshLambertMaterial({ color: LICH_FLESH });
  // F5.28c (Diego: "que no brille en la oscuridad"): sin luz propia; solo brillan los ojos (MeshBasic)
  const det = new THREE.MeshLambertMaterial({ vertexColors: true });
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  // F5.28b (Diego: "que se arrastre como pulpo, más grande y aterrador"): la masa de carne va baja (1.0 m) y el cráneo
  // encima y adelante; todo el modelo va a CONFIG.BEAST.scale. Los 4 tentáculos-pata salen de la base de la carne y se
  // abren hacia los costados, apoyados en el piso (animateBeast los arquea en ola)
  const torso = zPart(1.6, 1.0, 1.5, flesh, 0, 1.05, -0.1, body);
  const head = zPart(1.5, 1.35, 1.5, bone, 0, 2.15, 0.3, body);
  // (la caja que recibe balas va fina y más corta que el dibujo: si no, asomaba como un tablón rojo liso)
  const armL = zPart(0.36, 2.8, 0.36, flesh, -0.6, 0.85, 0.45, body, true), armR = zPart(0.36, 2.8, 0.36, flesh, 0.6, 0.85, 0.45, body, true);
  const legL = zPart(0.36, 2.8, 0.36, flesh, -0.6, 0.85, -0.6, body, true), legR = zPart(0.36, 2.8, 0.36, flesh, 0.6, 0.85, -0.6, body, true);
  const mt = new MeshBuilder(), mh = new MeshBuilder();
  // carne abierta: costillas que asoman, columna, venas, sangre y bolsas de carne
  for (let k = 0; k < 6; k++) for (const s of [-1, 1]) {
    mt.box(s * 0.78, 0.2 - k * 0.14, 0.2, 0.06, 0.08, 0.9 - k * 0.05, LICH_BONE2, 0, 0, s * 0.3);
    mt.box(s * 0.62, 0.0 - k * 0.14, 0.55, 0.3, 0.06, 0.06, LICH_BONE2, 0, 0, s * 0.5);
  }
  for (let k = 0; k < 7; k++) mt.box(0, 0.6, 0.5 - k * 0.2, 0.18, 0.16, 0.14, k % 2 ? LICH_BONE : LICH_BONE2);   // columna
  for (let k = 0; k < 10; k++) mt.box(-0.6 + (k % 5) * 0.3, 0.45 - (k % 3) * 0.3, 0.72, 0.04, 0.35, 0.03, k % 2 ? 0x3a0a2a : 0x2a0a3a, 0, 0, (k % 3 - 1) * 0.4);   // venas
  mt.box(0, -0.2, 0.71, 1.0, 0.5, 0.02, LICH_FLESH2);                              // la carne abierta del pecho
  for (let k = 0; k < 5; k++) mt.box(-0.4 + k * 0.2, -0.1 + (k % 2) * 0.2, 0.73, 0.12, 0.1, 0.03, 0xa02a2a);   // tripas
  for (let k = 0; k < 12; k++) mt.box((k % 6 - 2.5) * 0.25, -0.58 - (k % 3) * 0.18, (k < 6 ? 0.4 : -0.3), 0.05, 0.3 + (k % 4) * 0.12, 0.05, LICH_BLOOD);   // sangre chorreando
  for (const s of [-1, 1]) mt.blob(s * 0.55, 0.3, -0.45, 0.35, 0.3, 0.35, LICH_FLESH2, s + 2);   // bolsas de carne
  // el cráneo: frente, pómulos, cuencas negras, nariz, dientes de arriba, la tapa partida con el cerebro, grietas, cuernos
  mh.box(0, 0.35, 0, 1.52, 0.7, 1.4, LICH_BONE);                                    // bóveda
  mh.box(0, -0.2, 0.25, 1.35, 0.5, 1.1, LICH_BONE2);                                // cara
  for (const s of [-1, 1]) {
    mh.box(s * 0.36, 0.0, 0.76, 0.42, 0.4, 0.06, LICH_DARK);                        // cuencas
    mh.box(s * 0.66, -0.22, 0.6, 0.2, 0.18, 0.3, LICH_BONE);                        // pómulos
  }
  mh.box(0, -0.25, 0.79, 0.2, 0.26, 0.04, LICH_DARK);                               // nariz
  for (let k = 0; k < 9; k++) mh.box(-0.48 + k * 0.12, -0.5, 0.74, 0.08, 0.16, 0.06, 0xe8e0c8);   // dientes de arriba
  mh.box(0.1, 0.72, -0.1, 1.0, 0.1, 0.9, LICH_DARK);                                // la tapa partida (hueco)
  for (let k = 0; k < 8; k++) mh.box(-0.35 + (k % 4) * 0.22, 0.74 + (k % 2) * 0.06, -0.35 + Math.floor(k / 4) * 0.4, 0.2, 0.14, 0.28, k % 3 ? LICH_BRAIN : 0xa04a5a);   // cerebro
  for (let k = 0; k < 5; k++) mh.box(-0.6 + k * 0.3, 0.55, 0.71, 0.03, 0.25, 0.02, 0x3a2a1a, 0, 0, (k - 2) * 0.3);   // grietas
  for (let k = 0; k < 6; k++) mh.box(-0.5 + k * 0.2, 0.2 - (k % 3) * 0.2, 0.72, 0.04, 0.3 + (k % 2) * 0.2, 0.02, LICH_BLOOD);   // sangre en la cara
  // F5.28c: del lado derecho no hay cuerno: un muñón roto con sangre, y de ahí cuelga el ojo (z.eyeHang, más abajo)
  mh.box(0.62, 0.78, -0.1, 0.3, 0.22, 0.3, 0x9a9078); mh.box(0.64, 0.9, -0.08, 0.2, 0.1, 0.2, LICH_FLESH2);
  for (let k = 0; k < 3; k++) mh.box(0.55 + k * 0.08, 0.5 - k * 0.1, 0.1 + k * 0.1, 0.04, 0.3, 0.04, LICH_BLOOD);
  for (const s of [-1]) {                                                           // cuerno de ciervo grueso, abierto hacia afuera
    let x = s * 0.6, y = 0.65, z = -0.1;
    for (let i = 0; i < 10; i++) {
      x += s * (0.12 - i * 0.006); y += 0.13 + (i > 5 ? 0.03 : 0); z -= 0.05;
      const w = 0.24 - i * 0.015;
      mh.box(x, y, z, w, 0.2, w, i % 2 ? LICH_BONE2 : 0x9a9078);
      if (i === 2 || i === 5 || i === 8) for (let j = 1; j < 5; j++) mh.box(x + s * j * 0.05, y + j * 0.12, z + 0.06 + j * 0.03, 0.12 - j * 0.02, 0.14, 0.12 - j * 0.02, 0x9a9078);   // puntas
    }
    for (let k = 0; k < 3; k++) mh.box(x - s * k * 0.3, y - 0.2 - k * 0.3, z, 0.03, 0.25, 0.03, LICH_BLOOD);   // sangre chorreando de los cuernos
  }
  dogDetail(mt, torso.mesh, det); dogDetail(mh, head.mesh, det);
  // la mandíbula: un grupo propio que se abre (lanza el tentáculo, te traga)
  const jaw = new THREE.Group(); jaw.position.set(0, -0.55, 0.2); head.mesh.add(jaw);
  const mj = new MeshBuilder();
  mj.box(0, -0.12, 0.25, 1.1, 0.2, 0.9, LICH_BONE2);
  for (let k = 0; k < 8; k++) mj.box(-0.42 + k * 0.12, 0.02, 0.66, 0.07, 0.14, 0.05, 0xe8e0c8);   // dientes de abajo
  mj.box(0, -0.02, 0.2, 0.8, 0.06, 0.6, 0x3a0808);                                  // adentro
  // sangre colgando de la boca (F5.28c: más hilos y más largos; las gotas que caen son buildBeastDrool)
  for (let k = 0; k < 7; k++) { const L = 0.35 + (k * 37 % 5) * 0.14; mj.box(-0.42 + k * 0.14, -0.2 - L / 2, 0.55 + (k % 2) * 0.1, 0.05, L, 0.05, k % 2 ? LICH_BLOOD : 0x5a0004); mj.box(-0.42 + k * 0.14, -0.22 - L, 0.55 + (k % 2) * 0.1, 0.09, 0.09, 0.09, LICH_BLOOD); }
  mj.box(0, 0.0, 0.64, 0.9, 0.05, 0.1, LICH_BLOOD);                                // el labio empapado
  dogDetail(mj, jaw, det);
  // tentáculos: los 4 que son patas (dibujo sobre la parte que recibe balas) y 6 que cuelgan de la carne y ondulan
  [armL, armR, legL, legR].forEach((p, i) => { const m = new MeshBuilder(); m.setFrame(0, 1.4, 0, 0); lichTentacle(m, 3.8, 0.7, i < 2 ? 2 : -2, i * 7 + 3); dogDetail(m, p.mesh, det); });
  // 8 tentáculos más alrededor de la base, abiertos en abanico sobre el piso (se arrastran y ondulan)
  const tents = [];
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group(), a = (i + 0.5) / 8 * Math.PI * 2;
    const len = 3.0 + (i % 3) * 0.7;                                   // F5.28c: el doble de largos y más gruesos
    g.position.set(Math.sin(a) * 0.7, 0.7, Math.cos(a) * 0.65 - 0.05); body.add(g);
    // YXZ: gira hacia su lado (y = a) y se inclina hacia afuera (x) hasta que la punta toca el piso (sp)
    g.rotation.order = 'YXZ'; g.userData.a = a; g.userData.sp = Math.acos(Math.min(0.95, 0.72 / len));
    const m = new MeshBuilder(); lichTentacle(m, len, 0.5, i % 2 ? 3 : -3, i * 13 + 5); dogDetail(m, g, det);
    tents.push(g);
  }
  // los 4 que reciben balas, también abiertos: adelante-izq, adelante-der, atrás-izq, atrás-der. F5.28c: su caja recta no se
  // dibuja (el tentáculo se curva y la caja asomaba como un tablón): material invisible; el raycaster la toca igual y el
  // dibujo, que es su hijo, se sigue viendo
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  [armL, armR, legL, legR].forEach(p => { p.pivot.rotation.order = 'YXZ'; p.mesh.material = hidden; });
  // los ojos: verdes, que brillan (sin luces)
  const eyeMat = new THREE.MeshBasicMaterial({ color: BOSS_EYE.normal });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(zGeo(0.2, 0.16, 0.05), eyeMat); e.position.set(s * 0.36, 0.0, 0.8); head.mesh.add(e);
    const p = new THREE.Mesh(zGeo(0.08, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff })); p.position.set(s * 0.36, 0.02, 0.83); head.mesh.add(p);
  }
  // F5.28c: el ojo colgando del muñón del cuerno: un nervio de cubos que baja hasta la boca y un ojo grande con venas
  // (el iris usa eyeMat: cambia de color con la vida como los otros). animateBeast lo balancea como un péndulo
  const eyeHang = new THREE.Group(); eyeHang.position.set(0.86, 0.8, 0.1); head.mesh.add(eyeHang);
  const me = new MeshBuilder();
  for (let k = 0; k < 7; k++) me.box(Math.sin(k * 0.9) * 0.04, -0.08 - k * 0.15, 0.02 * k, 0.1 - k * 0.006, 0.17, 0.1 - k * 0.006, k % 2 ? 0x8a2a3a : 0xa8404e);   // nervio
  for (let k = 0; k < 4; k++) me.box(0.05 - k * 0.03, -0.2 - k * 0.25, 0.08, 0.03, 0.14, 0.03, LICH_BLOOD);
  me.box(0, -1.32, 0.12, 0.44, 0.42, 0.42, 0xe8dcc8);                              // el ojo
  me.box(0, -1.32, 0.12, 0.48, 0.34, 0.34, 0xd8c8b0); me.box(0, -1.32, 0.12, 0.34, 0.48, 0.34, 0xd8c8b0);
  for (let k = 0; k < 6; k++) me.box(-0.2 + k * 0.08, -1.2 - (k % 3) * 0.08, 0.34, 0.02, 0.14, 0.02, 0xb02030, 0, 0, (k - 2.5) * 0.4);   // venas
  me.box(0, -1.14, 0.1, 0.24, 0.08, 0.24, 0x8a2a3a);                               // donde se une al nervio
  dogDetail(me, eyeHang, det);
  const iris = new THREE.Mesh(zGeo(0.24, 0.24, 0.04), eyeMat); iris.position.set(0, -1.32, 0.34); eyeHang.add(iris);
  const pupil = new THREE.Mesh(zGeo(0.1, 0.14, 0.03), new THREE.MeshBasicMaterial({ color: 0x050000 })); pupil.position.set(0, -1.32, 0.365); eyeHang.add(pupil);
  const dummy = () => { const g = new THREE.Group(); g.visible = false; return g; };
  const hatG = dummy(), gun = dummy(), barrels = dummy(), tears = dummy();
  root.add(hatG); root.add(gun); gun.add(barrels); root.add(tears);
  const B = CONFIG.BOSS;
  const z = {
    id: 260, root, body, variant: 'bestia',
    head: head.mesh, armL: armL.pivot, armR: armR.pivot, legL: legL.pivot, legR: legR.pivot, jaw, tents, eyeHang,
    flashMats: [bone, flesh], hitParts: [],
    active: false, alive: false, state: 'idle', mode: 'flow', t: 0,
    px: 0, pz: 0, sx: 0, sz: 0, wantX: 0, wantZ: 0, nudgeX: 0, nudgeZ: 0, nudgeT: 0,
    heading: 0, health: 0, speed: 0, attackCd: 0, swingT: 0,
    walkT: 0, stuckT: 0, lastX: 0, lastZ: 0, strikes: 0, flash: 0, kbX: 0, kbZ: 0, kbT: 0, voice: B.voice * 0.6, growlT: 0,
    tentT: 0, spikeT: 0, whipT: 0,                                                 // F5.28: tentáculo, tentáculos del piso, latigazo
    kind: 'boss', boss: true, dog: false, crawl: false, legDmg: 0, maxHealth: 0,
    phase: 1, hatOn: false, hatDmg: 0, hatG, act: null, actT: 0, actT0: 0,
    whistleT: 0, summonT: 0, chargeT: 0, chargeX: 0, chargeZ: 0, chargeHit: false, throwT: 0, gun: 'idle', gunT: 0, gunAcc: 0, squidT: 0,
    eyeMat, tears, gunModel: gun, barrels,
    hatFly: { g: hatG, vx: 0, vy: 0, vz: 0, spin: 0, life: 0, flying: false },
    // la Bestia
    screamT: 0, pounceT: 0, slimeT: 0, spitT: 0, pvx: 0, pvz: 0, pDist: 0, hitDone: false
  };
  head.mesh.userData = { type: 'zombieHead', zombie: z };
  [torso, armL, armR, legL, legR].forEach(p => { p.mesh.userData = { type: 'zombieBody', zombie: z }; });
  z.partsBare = z.partsHat = z.hitParts = [head.mesh, torso.mesh, armL.mesh, armR.mesh, legL.mesh, legR.mesh];
  root.visible = false;
  scene.add(root);
  return z;
}

//--- la Bestia: dormida, despertar ---
function buildBeast() {
  const z = createBeast();
  BEAST.z = z;
  BOSS.pool.push(z);
  buildBeastTentacle(); buildBeastSpikes();                            // F5.28
  buildBeastDrool();                                                   // F5.28c
  // caja de tiro invisible sobre la Bestia dormida (no es collider: al despertar sale de hitMeshes)
  const L = CONFIG.BEAST.lair, y0 = CONFIG.BUNKER.y;
  const S = CONFIG.BEAST.scale;
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.6 * S, 1.4 * S, 2.8 * S), new THREE.MeshBasicMaterial({ visible: false }));
  box.position.set(L.x, y0 + 0.7 * S, L.z); box.rotation.y = L.rot; box.userData = { type: 'beastSleep' };
  scene.add(box);
  BEAST.sleepBox = box;
  sleepBeast();
}
// acurrucada: acostada, patas dobladas, la cabeza sobre las patas de adelante; respira (animateSleep)
function sleepBeast() {
  const z = BEAST.z, L = CONFIG.BEAST.lair;
  BEAST.phase = 'sleep';
  z.active = false; z.alive = false; z.act = null;
  z.px = L.x; z.pz = L.z; z.level = 0; z.heading = L.rot;
  z.root.position.set(L.x, CONFIG.BUNKER.y, L.z); z.root.rotation.set(0, L.rot, 0); z.root.scale.setScalar(CONFIG.BEAST.scale);
  // acostada: la carne apoyada en el piso y los tentáculos enroscados alrededor
  z.body.position.set(0, -0.4, 0); z.body.rotation.set(0.05, 0, 0.12);
  [z.armL, z.armR, z.legL, z.legR].forEach((p, i) => setLimb(p, i, -0.35, 0.4 * (i % 2 ? -1 : 1)));
  for (const g of z.tents) g.rotation.set(-g.userData.sp - 0.3, g.userData.a + 0.5, 0);
  z.head.rotation.set(0.35, 0.3, 0);
  z.flashMats.forEach(m => m.emissive.setHex(0));
  z.eyeMat.color.setHex(0x3a1a08);                                                  // agallas apagadas: duerme
  z.root.visible = true;
  if (WORLD.hitMeshes.indexOf(BEAST.sleepBox) < 0) WORLD.hitMeshes.push(BEAST.sleepBox);
}
function animateSleep(t) {
  const z = BEAST.z, br = Math.sin(t * 1.6);
  z.body.scale.set(1 + br * 0.03, 1 + br * 0.05, 1);
  z.head.rotation.x = 0.35 + br * 0.04;
}
function wakeBeast() {
  if (BEAST.phase !== 'sleep') return false;
  const z = BEAST.z, C = CONFIG.BEAST, L = C.lair;
  BEAST.phase = 'awake';
  const k = WORLD.hitMeshes.indexOf(BEAST.sleepBox);
  if (k >= 0) WORLD.hitMeshes.splice(k, 1);
  z.body.scale.set(1, 1, 1); z.head.rotation.set(0, 0, 0);
  resetZombie(z, { x: L.x, z: L.z }, false);
  z.health = z.maxHealth = Math.round(CONFIG.BOSS.health(Math.max(state.round, C.minRound)) * C.healthMul);
  z.speed = C.speed;
  z.state = 'walk'; z.t = 0; z.phase = 1;
  z.screamT = randIn(C.scream.every); z.pounceT = randIn(C.pounce.every); z.slimeT = C.slime.every; z.spitT = randIn(C.slime.spitEvery);
  z.tentT = randIn(C.tentacle.every); z.spikeT = randIn(C.spikes.every); z.whipT = 1;   // F5.28
  z.attackCd = 1;
  bossEyes(z);
  z.heading = L.rot; placeRoot(z, 0);
  state.zombies.push(z);
  BOSS.fogT = CONFIG.BOSS.fogTime;
  showBanner(C.name + ' AWAKENS', 3);
  sfxBossRoar(); addTrauma(0.5);
  startAct(z, 'roar', C.roar);
  return true;
}

//--- la Bestia: cerebro (desde bossTick) ---
// true = hizo algo propio este frame (updateZombies no la mueve)
function beastTick(z, dt) {
  const C = CONFIG.BEAST, P = player.pos, pl = playerLevel();
  const dx = P.x - z.px, dz = P.z - z.pz, dist = Math.hypot(dx, dz) || 1e-4, rage = z.health < C.rageFrac * z.maxHealth ? 0.65 : 1;
  z.speed = C.speed;
  if (z.act) { beastAct(z, dt, dist, dx, dz); return true; }
  if (DOWN.on) return false;                                           // tirado (last stand): nada especial
  const lv = z.level || 0, same = lv === pl;
  // slime negro detrás suyo mientras corre
  if ((z.slimeT -= dt) <= 0) { z.slimeT = C.slime.every; acidPuddle(z.px, z.pz, lv, C.slime.radius, C.slime.life, 'black'); }
  // F5.28: el tentáculo que te agarra (de media distancia, con línea libre)
  if ((z.tentT -= dt) <= 0) {
    if (canBeastTentacle(z)) {
      z.tentT = randIn(C.tentacle.every) * rage;
      const T = BEAST.tg; T.state = 'warn'; T.t = 0; beastMouth();
      startAct(z, 'tentacle', 99); sfxBossRoar(); return true;
    }
    z.tentT = 0.5;
  }
  // F5.28: latigazo de cerca
  if ((z.whipT -= dt) <= 0) {
    if (same && dist < C.whip.range && z.attackCd <= 0) { z.whipT = randIn(C.whip.every) * rage; startAct(z, 'whip', C.whip.wind); sfxBossSlamWind(); return true; }
    z.whipT = 0.3;
  }
  // F5.28: tentáculos del piso debajo tuyo y alrededor
  if ((z.spikeT -= dt) <= 0) {
    if (same && dist < 24) { z.spikeT = randIn(C.spikes.every) * rage; startAct(z, 'cast', 0.35); return true; }
    z.spikeT = 1;
  }
  // grito: de cerca, aturde y llama a las crías
  if ((z.screamT -= dt) <= 0) {
    if (same && dist < C.scream.range * 1.2) { z.screamT = randIn(C.scream.every) * rage; startAct(z, 'scream', C.scream.wind); return true; }
    z.screamT = 1;
  }
  // salto desde lejos (en el piso, con línea libre)
  if ((z.pounceT -= dt) <= 0) {
    if (same && lv === 0 && dist > C.pounce.min && dist < C.pounce.max && segmentClear(z.px, z.pz, P.x, P.z, CONFIG.BOSS.radius, false, undefined, 0)) {
      z.pounceT = randIn(C.pounce.every) * rage; startAct(z, 'pwind', C.pounce.wind); return true;
    }
    z.pounceT = 0.5;
  }
  // escupitajo de slime
  if ((z.spitT -= dt) <= 0) {
    if (same && dist > C.slime.spitMin && dist < C.slime.spitMax && segmentClear(z.px, z.pz, P.x, P.z, 0, true, undefined, lv) &&
        spitAcid(z.px, (lv ? lvY(lv) : groundY(z.px, z.pz)) + 1.9, z.pz, lv, null, null, 'black')) z.spitT = randIn(C.slime.spitEvery) * rage;
    else z.spitT = 0.7;
  }
  return false;
}
//--- F5.28c: la sangre que le chorrea de la boca (despierta): gotas de un InstancedMesh que caen de la mandíbula y quedan
// aplastadas en el piso un rato. Pool fijo de CONFIG.BEAST.drool.drops ---
const _bdM = new THREE.Matrix4(), _bdQ = new THREE.Quaternion(), _bdS = new THREE.Vector3(), _bdP = new THREE.Vector3();
function buildBeastDrool() {
  const D = CONFIG.BEAST.drool;
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x8a0006 }), D.drops);   // (Lambert: a oscuras no brilla)
  m.frustumCulled = false; m.count = 0; scene.add(m);
  BEAST.drool = { m, acc: 0, list: [] };
  for (let i = 0; i < D.drops; i++) BEAST.drool.list.push({ on: false, x: 0, y: 0, z: 0, vy: 0, fy: 0, s: 0, land: 0 });
}
function updateBeastDrool(dt) {
  const R = BEAST.drool, D = CONFIG.BEAST.drool, z = BEAST.z;
  if (!R) return;
  if (z && z.alive && BEAST.phase === 'awake' && (R.acc += dt) >= D.every) {
    R.acc = 0;
    const d = R.list.find(q => !q.on);
    if (d) {
      const M = beastMouth(), sc = CONFIG.BEAST.scale;
      d.on = true; d.land = 0; d.vy = -0.5 - Math.random();
      d.x = M.x + (Math.random() - 0.5) * 0.7 * sc; d.y = M.y; d.z = M.z + (Math.random() - 0.5) * 0.3 * sc;
      d.fy = z.level ? lvY(z.level) : groundY(d.x, d.z); d.s = 0.06 + Math.random() * 0.07;
    }
  }
  let n = 0;
  for (const d of R.list) {
    if (!d.on) continue;
    if (!d.land) {
      d.vy -= D.grav * dt; d.y += d.vy * dt;
      if (d.y <= d.fy + 0.01) { d.y = d.fy + 0.01; d.land = 2.5; }
      _bdS.set(d.s, d.s * 2.2, d.s);
    } else {
      if ((d.land -= dt) <= 0) { d.on = false; continue; }
      const k = Math.min(1, d.land / 0.6);                             // se achica al final
      _bdS.set(d.s * 4 * k, 0.015, d.s * 4 * k);
    }
    _bdM.compose(_bdP.set(d.x, d.y, d.z), _bdQ, _bdS);
    R.m.setMatrixAt(n++, _bdM);
  }
  R.m.count = n; R.m.instanceMatrix.needsUpdate = true;
}
function resetBeastDrool() {
  if (!BEAST.drool) return;
  for (const d of BEAST.drool.list) d.on = false;
  BEAST.drool.m.count = 0; BEAST.drool.acc = 0;
}
// zarpazo (desde updateZombies, en vez del golpe al piso del Sombrerón)
function beastTryAttack(z, distP, pl, minTop) {
  const C = CONFIG.BEAST.claw, P = player.pos;
  // F5.28c: con el alcance largo, mientras te arrastra el tentáculo no te pega el zarpazo (te soltaría)
  if (z.act || beastGrabbed()) return;
  if ((z.level || 0) === pl && distP < C.range && z.attackCd <= 0 && segmentClear(z.px, z.pz, P.x, P.z, 0.02, false, minTop, pl)) {
    startAct(z, 'claw', C.wind); sfxBossSlamWind();
  }
}
// te lanza por el aire en la dirección (nx, nz): empujón con colisión + velocidad hacia arriba
function beastLaunch(nx, nz, dist, up, time) {
  player.pushX = nx * dist / time; player.pushZ = nz * dist / time; player.pushT = time;
  player.vel.y = Math.max(player.vel.y, up); player.grounded = false;
  player.airTop = Math.max(player.airTop || 0, player.pos.y - CONFIG.PLAYER.height);
  DEBUG.safeFall = true;                                               // F5.28c: el vuelo no suma daño por caída
}
//--- F5.28: el tentáculo que te agarra y te traga (el mismo esquema que la lengua de la planta jefa) ---
const BT_N = 56, _btA = new THREE.Vector3(), _btB = new THREE.Vector3(), _btZ = new THREE.Vector3(0, 0, 1);
const _btM = new THREE.Matrix4(), _btQ = new THREE.Quaternion(), _btE = new THREE.Euler(), _btS = new THREE.Vector3(), _btC = new THREE.Color();
function buildBeastTentacle() {
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), BT_N);
  m.frustumCulled = false; m.count = 0; m.visible = false; m.userData.theme = false;
  for (let i = 0; i < BT_N; i++) m.setColorAt(i, _btC.setHex(i >= BT_N - 6 ? 0xd89aa0 : i % 5 === 0 ? LICH_SUCK : i % 2 ? LICH_TENT : LICH_TENT2));
  m.instanceColor.needsUpdate = true;
  scene.add(m); BEAST.tent = m;
  // su caja de tiro (DoubleSide: pegado al pecho, el ojo puede quedar adentro)
  const hb = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  hb.visible = false; hb.userData = { type: 'beastTentacle' }; scene.add(hb);
  BEAST.tentHit = hb;
}
// la boca: adelante de la mandíbula, en el mundo
function beastMouth() {
  const z = BEAST.z;
  z.root.updateMatrixWorld(true);
  return z.head.localToWorld(BEAST.mouth.set(0, -0.45, 0.9));
}
function drawBeastTentacle(t) {
  const T = BEAST.tg, M = BEAST.mouth, m = BEAST.tent, E = T.tip;
  const dx = E.x - M.x, dy = E.y - M.y, dz = E.z - M.z, L = Math.hypot(dx, dy, dz);
  if (L < 0.05) { m.visible = false; return; }
  const body = Math.min(BT_N - 6, Math.max(2, Math.ceil(L / 0.32)));
  const yaw = Math.atan2(dx, dz), sag = Math.min(1.4, L * 0.1), hl = Math.hypot(dx, dz) || 1, px = -dz / hl, pz = dx / hl;
  let n = 0;
  const put = (x, y, z, s, ry, rx) => { _btQ.setFromEuler(_btE.set(rx || 0, ry, 0, 'YXZ')); _btM.compose(_btA.set(x, y, z), _btQ, _btS.set(s, s, s)); m.setMatrixAt(n++, _btM); };
  for (let i = 0; i < body; i++) {
    const u = i / body, b = Math.sin(Math.PI * u), w = Math.sin(t * 8 + u * 10) * 0.22 * b;
    put(M.x + dx * u + px * w, M.y + dy * u - sag * b + Math.sin(t * 6 + u * 7) * 0.1 * b, M.z + dz * u + pz * w, 0.95 - 0.45 * u, yaw);   // F5.28c: más grueso
  }
  for (let i = 0; i < 6; i++) {                                           // la punta: se abre en ganchos alrededor tuyo
    const a = i * 1.05 + t * 2, r = i ? 0.4 : 0;
    put(E.x + Math.cos(a) * r, E.y + Math.sin(a * 1.4) * r * 0.6, E.z + Math.sin(a) * r, i ? 0.28 : 0.5, yaw + a, a);
  }
  m.count = n; m.instanceMatrix.needsUpdate = true; m.visible = true;
  const hb = BEAST.tentHit;
  hb.position.set((M.x + E.x) / 2, (M.y + E.y) / 2 - sag * 0.5, (M.z + E.z) / 2);
  hb.quaternion.setFromUnitVectors(_btZ, _btB.set(dx / L, dy / L, dz / L));
  hb.scale.set(1.5, 1.5 + sag, L); hb.updateMatrixWorld(true);
}
function beastTentacleShootable(on) {
  const i = WORLD.hitMeshes.indexOf(BEAST.tentHit);
  if (on && i < 0) WORLD.hitMeshes.push(BEAST.tentHit);
  if (!on && i >= 0) WORLD.hitMeshes.splice(i, 1);
}
function beastGrabbed() { return BEAST.tg.state === 'grab' || BEAST.tg.state === 'swallow'; }
function beastLiftY() {
  const T = BEAST.tg, U = CONFIG.BEAST.tentacle, M = BEAST.mouth, P = player.pos;
  if (T.state === 'swallow') return M.y - 0.3;
  const d = Math.hypot(P.x - M.x, P.z - M.z), span = Math.max(0.5, T.d0 - U.swallowAt);
  const k = Math.max(0, Math.min(1, 1 - (d - U.swallowAt) / span));
  T.k = k;
  return T.y0 + U.lift * Math.min(1, T.t / 0.3) * (1 - k) + (M.y - 0.3 - T.y0) * k * k * (3 - 2 * k);
}
function canBeastTentacle(z) {
  const U = CONFIG.BEAST.tentacle, P = player.pos, lv = z.level || 0;
  if (playerLevel() !== lv || DOWN.on || BUNK.travel || state.gameOver || plantGrabbed()) return false;
  const d = Math.hypot(P.x - z.px, P.z - z.pz);
  return d >= U.min && d <= U.range && segmentClear(z.px, z.pz, P.x, P.z, 0, true, undefined, lv);
}
function releaseBeastTentacle(cut) {
  const T = BEAST.tg;
  if (T.state === 'grab') DEBUG.safeFall = true;                        // te suelta en el aire: la caída no lastima
  plantFog(0);
  T.state = 'back'; T.t = 0; beastTentacleShootable(false);
  if (cut) {
    spawnSplashFx(T.tip.x, T.tip.y, T.tip.z, LICH_BLOOD, 1.8);
    showBanner('YOU CUT IT!', 1.2);
    sfxBossRoar();
  }
}
// tiro al tentáculo (traceShot/tracePierce): U.shots te sueltan
function beastTentacleShot(point) {
  const T = BEAST.tg;
  if (T.state !== 'grab' && T.state !== 'shoot') return false;
  if (point) spawnSplashFx(point.x, point.y, point.z, LICH_BLOOD, 0.5);
  onHitConfirm(false, false);
  if (++T.hits >= CONFIG.BEAST.tentacle.shots) releaseBeastTentacle(true);
  return true;
}
// cuchillazo (meleeAttack): agarrado y mirando hacia la Bestia (±70°); U.stabs te sueltan
function beastTentacleStab(dir) {
  const T = BEAST.tg, M = BEAST.mouth, P = player.pos;
  if (T.state !== 'grab') return false;
  const L = Math.hypot(M.x - P.x, M.z - P.z) || 1, dl = Math.hypot(dir.x, dir.z) || 1;
  if (((M.x - P.x) * dir.x + (M.z - P.z) * dir.z) / (L * dl) < Math.cos(70 * Math.PI / 180)) return false;
  spawnSplashFx(P.x + (M.x - P.x) / L * 0.6, P.y - 0.6, P.z + (M.z - P.z) / L * 0.6, LICH_BLOOD, 0.8);
  onHitConfirm(false, false);
  if (++T.stabs >= CONFIG.BEAST.tentacle.stabs) releaseBeastTentacle(true);
  return true;
}
// el arrastre (desde updatePlayer, con colisión) hacia la boca; adentro, te mete y te da vuelta hacia ella
function beastDragStep(dt) {
  const U = CONFIG.BEAST.tentacle, P = player.pos, M = BEAST.mouth;
  if (BEAST.tg.state === 'swallow') {
    const k = Math.min(1, dt * 5);
    P.x += (M.x - P.x) * k; P.z += (M.z - P.z) * k;
    let d = Math.atan2(-(BEAST.z.px - P.x), -(BEAST.z.pz - P.z)) - player.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    player.yaw += d * k; player.vel.x = player.vel.z = 0; return;
  }
  const dx = M.x - P.x, dz = M.z - P.z, L = Math.hypot(dx, dz) || 1;
  moveAxis('x', dx / L * U.drag * dt); moveAxis('z', dz / L * U.drag * dt);
  player.vel.x = player.vel.z = 0;
}
// la máquina del tentáculo (mientras dura el act 'tentacle'). Devuelve false cuando terminó (la Bestia sigue)
function updateBeastTentacle(z, dt, t) {
  const U = CONFIG.BEAST.tentacle, T = BEAST.tg, P = player.pos;
  const M = beastMouth();
  T.t += dt;
  if (!z.alive && T.state !== 'off' && T.state !== 'back') releaseBeastTentacle(false);
  if (T.state === 'warn') {                                             // abre la mandíbula y tiembla
    BEAST.jawOpen = Math.min(1, T.t / U.warn);
    if (T.t >= U.warn) {
      if (!canBeastTentacle(z)) { T.state = 'off'; return false; }
      _btA.set(P.x, P.y - 0.6, P.z);
      T.full = M.distanceTo(_btA); T.dir.copy(_btA).sub(M).normalize();
      T.state = 'shoot'; T.t = 0; T.len = 0; T.hits = 0; T.stabs = 0;
      T.tip.copy(M); T.prev.copy(M);
      beastTentacleShootable(true);
      sfxBossRoar();
    }
  } else if (T.state === 'shoot') {                                     // sale derecho a donde estabas
    BEAST.jawOpen = 1;
    T.prev.copy(T.tip); T.len += U.speed * dt;
    T.tip.copy(M).addScaledVector(T.dir, T.len);
    _btA.set(P.x, P.y - 0.6, P.z);
    const sx = T.tip.x - T.prev.x, sy = T.tip.y - T.prev.y, sz = T.tip.z - T.prev.z, ss = sx * sx + sy * sy + sz * sz || 1;
    const k = Math.max(0, Math.min(1, ((_btA.x - T.prev.x) * sx + (_btA.y - T.prev.y) * sy + (_btA.z - T.prev.z) * sz) / ss));
    const d = Math.hypot(T.prev.x + sx * k - _btA.x, T.prev.y + sy * k - _btA.y, T.prev.z + sz * k - _btA.z);
    if (d <= U.miss && playerLevel() === (z.level || 0) && !DOWN.on) {
      T.state = 'grab'; T.t = 0; T.stall = 0; T.lx = P.x; T.lz = P.z;
      T.d0 = Math.hypot(P.x - M.x, P.z - M.z); T.y0 = P.y;
      showBanner('SHOOT OR STAB THE TENTACLE!', 2);
      addTrauma(0.5);
      damagePlayer(U.damage, M.x, M.z, true, 'tentacle');
    } else if (T.len >= T.full + 2) { T.state = 'back'; T.t = 0; beastTentacleShootable(false); }
  } else if (T.state === 'grab') {                                      // te arrastra (beastDragStep en updatePlayer)
    BEAST.jawOpen = 1;
    T.tip.set(P.x, P.y - 0.6, P.z);
    T.len = M.distanceTo(T.tip);
    if (DOWN.on || state.gameOver || T.t > U.maxGrab) { releaseBeastTentacle(false); }
    else {
      if (Math.random() < dt * 4) spawnSplashFx(T.tip.x, T.tip.y, T.tip.z, LICH_BLOOD, 0.3);
      plantFog(Math.round(Math.min(1, 0.15 + 0.85 * (T.k || 0)) * 40) / 40);   // se nubla más cuanto más cerca de la boca
      const moved = Math.hypot(P.x - T.lx, P.z - T.lz), dM = Math.hypot(P.x - M.x, P.z - M.z); T.lx = P.x; T.lz = P.z;
      T.stall = moved < U.drag * dt * 0.25 ? T.stall + dt : 0;
      if (dM <= U.swallowAt || (T.stall >= U.stallTime && dM <= U.swallowAt * 2)) {
        T.state = 'swallow'; T.t = 0; T.killed = false; beastTentacleShootable(false); BEAST.tent.visible = false;
        spawnSplashFx(M.x, M.y - 0.5, M.z, LICH_BLOOD, 2.2); addTrauma(0.9); sfxBossRoar();
        plantFog(1);
      } else if (T.stall >= U.stallTime) releaseBeastTentacle(false);
    }
  } else if (T.state === 'swallow') {                                   // adentro del cráneo: mastica y te mata
    BEAST.jawOpen = Math.abs(Math.sin(T.t * 9)) * 0.6;
    if (!T.killed && T.t >= U.swallowKill) {
      T.killed = true;
      damagePlayer(99999, M.x, M.z, true, 'tentacle');
      plantFog(0);
    }
    if (T.t >= U.swallowTime || (T.killed && (state.gameOver || DOWN.on))) {
      T.state = 'off'; DEBUG.safeFall = true; plantFog(0); BEAST.jawOpen = 0;
      return false;
    }
    return true;
  } else if (T.state === 'back') {                                      // vuelve a la boca
    BEAST.jawOpen = Math.max(0, BEAST.jawOpen - dt * 2);
    T.len = Math.max(0, T.len - U.back * dt);
    T.tip.sub(M).setLength(T.len).add(M);
    if (T.len <= 0) { T.state = 'off'; BEAST.tent.visible = false; BEAST.jawOpen = 0; return false; }
  } else return false;
  if (T.state !== 'warn' && T.state !== 'swallow') drawBeastTentacle(t); else BEAST.tent.visible = false;
  return true;
}

//--- F5.28: tentáculos que salen del piso (como las raíces de la planta): aviso rojo, suben, pegan y te levantan ---
function buildBeastSpikes() {
  const S = CONFIG.BEAST.spikes, sp = new MeshBuilder(), ring = new MeshBuilder(), rr = mulberry(911);
  for (let k = 0; k < 5; k++) {                                          // 5 tentáculos que salen juntos
    const a = k / 5 * Math.PI * 2 + rr(), r = k ? S.radius * 0.55 : 0;
    let x = Math.cos(a) * r, z = Math.sin(a) * r;
    for (let i = 0; i < 12; i++) {
      const u = i / 11, s = 0.42 - 0.3 * u;
      x += Math.sin(u * 4 + k) * 0.03; z += Math.cos(u * 4 + k) * 0.03;
      sp.box(x, i * 0.26, z, s, 0.3, s, i % 2 ? LICH_TENT : LICH_TENT2);
      if (i % 3 === 0) sp.box(x, i * 0.26, z + s * 0.5, s * 0.5, 0.12, 0.04, LICH_SUCK);
    }
    sp.box(x, 12 * 0.26, z, 0.08, 0.2, 0.08, LICH_BLOOD);
  }
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; ring.box(Math.cos(a) * S.radius, 0.03, Math.sin(a) * S.radius, 0.3, 0.05, 0.3, i % 2 ? 0xff1a1a : 0x6a0000); }
  for (let i = 0; i < 10; i++) { const a = rr() * 6.28, r = rr() * S.radius; ring.box(Math.cos(a) * r, 0.02, Math.sin(a) * r, 0.4, 0.03, 0.4, LICH_BLOOD); }
  const spG = sp.geometry(), ringG = ring.geometry(), mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  for (let i = 0; i < S.pool; i++) {
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    const spikes = new THREE.Mesh(spG, mat), warn = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    g.add(spikes); g.add(warn);
    BEAST.spikes.push({ g, spikes, warn, state: 'off', t: 0, x: 0, z: 0, level: 0, hit: false });
  }
}
// uno debajo tuyo y `extra` alrededor
function beastSpikesCast(z) {
  const S = CONFIG.BEAST.spikes, P = player.pos, lv = z.level || 0;
  const n = 1 + Math.floor(S.extra[0] + Math.random() * (S.extra[1] - S.extra[0] + 1));
  let placed = 0;
  for (let i = 0; i < n; i++) {
    const R = BEAST.spikes.find(q => q.state === 'off');
    if (!R) break;
    let x = P.x, zz = P.z;
    if (i) {                                                             // alrededor: donde podrías escapar
      const a = Math.random() * 6.28, d = S.spread[0] + Math.random() * (S.spread[1] - S.spread[0]);
      x += Math.cos(a) * d; zz += Math.sin(a) * d;
      if (!isNav(Math.floor(x), Math.floor(zz))) continue;
    } else { x += player.vel.x * 0.35; zz += player.vel.z * 0.35; }       // el de abajo te adelanta un poco
    R.state = 'warn'; R.t = 0; R.x = x; R.z = zz; R.level = lv; R.hit = false;
    R.g.position.set(x, lv ? lvY(lv) : groundY(x, zz), zz); R.g.visible = true;
    R.spikes.position.y = -3.4; R.warn.visible = true;
    placed++;
  }
  if (placed) sfxBossSlamWind();
  return placed;
}
function updateBeastSpikes(dt, t) {
  const S = CONFIG.BEAST.spikes, P = player.pos;
  for (const R of BEAST.spikes) {
    if (R.state === 'off') continue;
    R.t += dt;
    if (R.state === 'warn') {
      R.warn.material.opacity = 0.35 + 0.55 * Math.abs(Math.sin(t * 14));
      R.spikes.position.y = -3.4 + 0.5 * Math.min(1, R.t / S.warn) + Math.sin(t * 40) * 0.05;
      if (R.t >= S.warn) {
        R.state = 'up'; R.t = 0; R.warn.visible = false;
        spawnSplashFx(R.x, R.g.position.y + 0.3, R.z, LICH_BLOOD, 1.6);
        sfxBossSlam(Math.hypot(P.x - R.x, P.z - R.z));
      }
    } else if (R.state === 'up') {
      R.spikes.position.y = Math.min(0, R.spikes.position.y + dt * 22);
      if (!R.hit && playerLevel() === R.level && Math.hypot(P.x - R.x, P.z - R.z) < S.radius && !DOWN.on && !beastGrabbed()) {
        R.hit = true;
        damagePlayer(S.damage, R.x, R.z, false, 'tentacle');
        player.vel.y = Math.max(player.vel.y, S.up); player.grounded = false;
        addTrauma(0.5);
      }
      if (R.t >= S.stay) { R.state = 'down'; R.t = 0; }
    } else if (R.state === 'down') {
      R.spikes.position.y -= dt * 8;
      if (R.spikes.position.y <= -3.4) { R.state = 'off'; R.g.visible = false; }
    }
  }
}

function beastAct(z, dt, dist, dx, dz) {
  const C = CONFIG.BEAST, P = player.pos, L = CONFIG.BUNKER.ladder;
  if (z.act === 'tentacle') {                                          // quieta, mirándote, mientras dura el tentáculo
    faceHeading(z, P.x, P.z, dt, BEAST.tg.state === 'warn' ? 6 : 2);
    placeRoot(z, 0); z.root.rotation.y = z.heading;
    if (!updateBeastTentacle(z, dt, clock.elapsedTime)) { endAct(z); z.attackCd = 0.8; }
    animateBeast(z, dt, 0);
    return;
  }
  z.actT -= dt; z.t += dt;
  if (z.act === 'toLadder') {                                          // corre derecho a la escalera
    const tx = L.x, tz = L.z + C.ladderReach, ex = tx - z.px, ez = tz - z.pz, d = Math.hypot(ex, ez);
    faceHeading(z, tx, tz, dt, 10);
    if (d < 0.6 || z.actT <= 0) startAct(z, 'smash', C.smash);
    else {
      const step = Math.min(d, C.speed * dt);
      moveCircle(z, 'x', ex / d * step, CONFIG.BOSS.radius); moveCircle(z, 'z', ez / d * step, CONFIG.BOSS.radius);
    }
    placeRoot(z, 0); z.root.rotation.y = z.heading;
    animateBeast(z, dt, z.act === 'toLadder' ? C.speed : 0);
    return;
  }
  if (z.act === 'pounce') {                                            // vuela hacia donde estabas
    const step = C.pounce.speed * dt, ox = z.px, oz = z.pz;
    moveCircle(z, 'x', z.pvx * step, CONFIG.BOSS.radius); moveCircle(z, 'z', z.pvz * step, CONFIG.BOSS.radius);
    z.pDist -= step;
    const moved = Math.hypot(z.px - ox, z.pz - oz);
    if (!z.hitDone && dist < C.pounce.hit && playerLevel() === (z.level || 0)) {
      z.hitDone = true;
      if (!shieldBlocks(z.px, z.pz, C.pounce.damage)) damagePlayer(C.pounce.damage, z.px, z.pz, false, 'beast');
      beastLaunch(z.pvx, z.pvz, C.claw.fly * 0.6, C.claw.up * 0.7, C.claw.flyTime);
      addTrauma(0.6);
    }
    if (z.pDist <= 0 || z.actT <= 0 || moved < step * 0.4) {           // cae
      sfxBossSlam(dist); addTrauma(0.4 * Math.max(0, 1 - dist / 12));
      spawnSplashFx(z.px, groundY(z.px, z.pz) + 0.2, z.pz, 0x1a120c, 1.6);
      acidPuddle(z.px, z.pz, z.level || 0, C.slime.radius * 1.3, C.slime.life, 'black');
      endAct(z); z.attackCd = 0.6;
    }
  } else if (z.actT <= 0) {
    if (z.act === 'roar') { if (BEAST.broken) endAct(z); else startAct(z, 'toLadder', 12); }
    else if (z.act === 'smash') {
      breakLadder();
      showBanner('IT BROKE THE LADDER', 2.5);
      endAct(z); z.attackCd = 0.8;
      beastSummon(z);
    } else if (z.act === 'claw') {
      const C2 = C.claw, a = Math.atan2(dx, dz) - z.heading, off = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
      if (dist < C2.range + 0.35 && off < C2.arc && playerLevel() === (z.level || 0) &&
          segmentClear(z.px, z.pz, P.x, P.z, 0.02, false, undefined, z.level || 0)) {
        if (!shieldBlocks(z.px, z.pz, C2.damage)) damagePlayer(C2.damage, z.px, z.pz, false, 'beast');
        beastLaunch(dx / dist, dz / dist, C2.fly, C2.up, C2.flyTime);   // el escudo para el daño, no el golpe
        addTrauma(0.75);
        sfxBossSlam(dist);
      }
      z.attackCd = C2.cooldown * (z.health < C.rageFrac * z.maxHealth ? 0.7 : 1);
      endAct(z);
    } else if (z.act === 'whip') {                                     // F5.28: latigazo en arco: te tira de costado
      const W = C.whip, a = Math.atan2(dx, dz) - z.heading, off = Math.atan2(Math.sin(a), Math.cos(a));
      if (dist < W.range + 0.3 && Math.abs(off) < W.arc && playerLevel() === (z.level || 0) &&
          segmentClear(z.px, z.pz, P.x, P.z, 0.02, false, undefined, z.level || 0)) {
        if (!shieldBlocks(z.px, z.pz, W.damage)) damagePlayer(W.damage, z.px, z.pz, false, 'tentacle');
        const s = off >= 0 ? 1 : -1, hx = Math.sin(z.heading), hz = Math.cos(z.heading);   // barre de un lado al otro
        beastLaunch((hz * s + dx / dist * 0.5), (-hx * s + dz / dist * 0.5), W.push, W.up, 0.6);
        addTrauma(0.6); sfxBossSlam(dist);
      }
      endAct(z);
    } else if (z.act === 'cast') {                                     // F5.28: tentáculos del piso
      beastSpikesCast(z);
      endAct(z);
    } else if (z.act === 'scream') {
      sfxBossRoar(); addTrauma(0.35 * Math.max(0, 1 - dist / 20));
      if (dist < C.scream.range && playerLevel() === (z.level || 0)) player.dazeT = C.scream.daze;
      beastSummon(z);
      endAct(z);
    } else if (z.act === 'pwind') {
      z.pvx = dx / dist; z.pvz = dz / dist; z.heading = Math.atan2(z.pvx, z.pvz);
      z.pDist = Math.min(dist + 1, C.pounce.max + 2); z.hitDone = false;
      startAct(z, 'pounce', C.pounce.maxTime);
      sfxBossRoar();
    } else endAct(z);
  } else if (z.act !== 'smash') faceHeading(z, P.x, P.z, dt, z.act === 'claw' ? 9 : 5);
  placeRoot(z, 0);
  z.root.rotation.y = z.heading;
  animateBeast(z, dt, z.act === 'pounce' ? C.pounce.speed : 0);
}
//--- las crías (tanda C) ---
// Mini-bestias con la misma forma de objeto que un perro (z.dog: flow field, mordida, velocidad DOGS.speed). F5.28: la madre
// en chico: un cráneo con cuernitos y ojos verdes sobre un nudo de carne, corriendo en 4 tentáculos
const CRIAS = [];
function createCria(i) {
  const fur = new THREE.MeshLambertMaterial({ color: LICH_FLESH }), brown = new THREE.MeshLambertMaterial({ color: LICH_BONE });
  const det = new THREE.MeshLambertMaterial({ vertexColors: true });              // F5.28c: sin luz propia
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const L = 0.55, bw = 0.5, bh = 0.4, bl = 0.6, by = L + bh / 2;
  const torso = zPart(bw, bh, bl, fur, 0, by, -0.05, body);
  const head = zPart(0.5, 0.45, 0.5, brown, 0, by + 0.2, 0.3, body);
  const lx = bw / 2 - 0.06, lz = bl / 2 - 0.06;
  const fl = zPart(0.14, L, 0.14, fur, -lx, L, lz, body, true), fr = zPart(0.14, L, 0.14, fur, lx, L, lz, body, true);
  const bL = zPart(0.14, L, 0.14, fur, -lx, L, -lz, body, true), bR = zPart(0.14, L, 0.14, fur, lx, L, -lz, body, true);
  const mt = new MeshBuilder(), mh = new MeshBuilder();
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) mt.box(s * 0.26, 0.05 - k * 0.1, 0.1, 0.03, 0.05, 0.4, LICH_BONE2, 0, 0, s * 0.3);   // costillitas
  for (let k = 0; k < 5; k++) mt.box((k % 3 - 1) * 0.12, -bh / 2 - 0.1, 0.1 - k * 0.08, 0.03, 0.15 + (k % 2) * 0.1, 0.03, LICH_BLOOD);   // sangre
  mh.box(0, -0.12, 0.2, 0.42, 0.14, 0.2, LICH_BONE2);                                // cara
  for (const s of [-1, 1]) mh.box(s * 0.11, 0.0, 0.255, 0.13, 0.11, 0.02, LICH_DARK); // cuencas
  for (let k = 0; k < 5; k++) mh.box(-0.12 + k * 0.06, -0.2, 0.26, 0.04, 0.07, 0.03, 0xe8e0c8);   // dientes
  mh.box(0, 0.23, -0.05, 0.3, 0.04, 0.3, LICH_BRAIN);                               // el cerebro asoma
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) mh.box(s * (0.2 + k * 0.04), 0.25 + k * 0.08, -0.05 - k * 0.02, 0.05, 0.08, 0.05, LICH_BONE2);   // cuernitos
  dogDetail(mt, torso.mesh, det); dogDetail(mh, head.mesh, det);
  [fl, fr, bL, bR].forEach((p, j) => { const m = new MeshBuilder(); m.setFrame(0, L / 2, 0, 0); lichTentacle(m, L * 1.05, 0.18, j < 2 ? 1 : -1, j * 5 + i); dogDetail(m, p.mesh, det); });
  const gill = new THREE.MeshBasicMaterial({ color: 0x9aff3a });                    // ojos verdes
  for (const s of [-1, 1]) { const e = new THREE.Mesh(zGeo(0.07, 0.05, 0.02), gill); e.position.set(s * 0.11, 0.0, 0.265); head.mesh.add(e); }
  const D = CONFIG.DOGS;
  const z = {
    id: 280 + i, root, body,
    head: head.mesh, armL: fl.pivot, armR: fr.pivot, legL: bL.pivot, legR: bR.pivot,
    flashMats: [fur, brown], hitParts: [],
    active: false, alive: false, state: 'idle', mode: 'flow', t: 0,
    px: 0, pz: 0, sx: 0, sz: 0, wantX: 0, wantZ: 0, nudgeX: 0, nudgeZ: 0, nudgeT: 0,
    heading: 0, health: 0, speed: 0, attackCd: 0, swingT: 0,
    walkT: Math.random() * 6, stuckT: 0, lastX: 0, lastZ: 0, strikes: 0, flash: 0, kbX: 0, kbZ: 0, kbT: 0,
    voice: D.voice[1] * 1.3, growlT: 0,
    kind: 'dog', dog: true, cria: true, breed: 'cria', crawl: false, legDmg: 0, maxHealth: 0
  };
  head.mesh.userData = { type: 'zombieHead', zombie: z };
  z.hitParts.push(head.mesh);
  [torso, fl, fr, bL, bR].forEach(p => { p.mesh.userData = { type: 'zombieBody', zombie: z }; z.hitParts.push(p.mesh); });
  root.visible = false;
  scene.add(root);
  return z;
}
function buildCrias() { for (let i = 0; i < CONFIG.BEAST.crias.pool; i++) CRIAS.push(createCria(i)); }
// salen del piso alrededor de la madre (celdas navegables con línea libre). Devuelve cuántas salieron
function beastSummon(z) {
  const C = CONFIG.BEAST.crias;
  let alive = 0;
  for (const q of CRIAS) if (q.active && q.alive) alive++;
  const want = Math.min(C.per, C.max - alive);
  let n = 0;
  const a0 = Math.random() * Math.PI * 2;
  for (let k = 0; k < 12 && n < want; k++) {
    const q = CRIAS.find(o => !o.active);
    if (!q) break;
    const a = a0 + k / 12 * Math.PI * 2, x = z.px + Math.sin(a) * 2.4, zz = z.pz + Math.cos(a) * 2.4;
    const cx = Math.floor(x), cz = Math.floor(zz);
    if (!isNav(cx, cz) || flowAt(cx, cz) < 0 || !segmentClear(z.px, z.pz, cx + 0.5, cz + 0.5, 0.3)) continue;
    resetZombie(q, { x: cx + 0.5, z: cz + 0.5 }, false);
    q.size = 1; q.root.scale.setScalar(1); q.rad = CONFIG.DOGS.radius * 0.9;      // (resetZombie sortea el tamaño de perro)
    q.health = q.maxHealth = CONFIG.DOGS.health(Math.max(1, state.round)) * C.healthMul;
    q.fromClam = true;                                                             // extra: la ronda las espera
    state.zombies.push(q);
    n++;
  }
  if (n) sfxBossRoar();
  return n;
}
function beastDamaged(z, dmg) {
  bossEyes(z);
  if (z.phase === 1 && z.health < CONFIG.BEAST.rageFrac * z.maxHealth) { z.phase = 3; sfxBossRoar(); showBanner('THE BEAST IS ENRAGED', 2); }
}
function beastDeath(z) {
  BEAST.phase = 'dead';
  if (BEAST.tg.state !== 'off' && BEAST.tg.state !== 'back') releaseBeastTentacle(false);   // F5.28: te suelta
  resetBarrels();                                                      // termina la pelea: vuelven los barriles
}

// F5.28b: se arrastra como pulpo. Los 12 tentáculos abiertos sobre el piso se levantan y tiran hacia atrás en ola (cada uno
// con su fase según el ángulo), la carne se balancea y se estira con cada tirón, y el cráneo va bajo, meciéndose. La mandíbula
// se abre (BEAST.jawOpen: el tentáculo y el grito). Las acciones levantan las patas de adelante (aL/aR: negativo = arriba)
function animateBeast(z, dt, v) {
  const k = Math.min(1, v / 2), t = clock.elapsedTime, w = z.walkT += dt * (2.2 + v * 1.1);
  const pull = Math.sin(w * 2);                                        // el tirón de todos los tentáculos (2 por ciclo)
  let aL = 0, aR = 0, lL = 0, lR = 0, bx = 0.08 * k, by = (0.08 + 0.08 * pull) * k, hx = 0.12 * k, jaw = BEAST.jawOpen, aRz = 0;
  const p = z.actT0 > 0 ? 1 - Math.max(0, z.actT) / z.actT0 : 1;
  if (z.act === 'roar' || z.act === 'scream') {                        // se levanta, abre la boca y ruge
    const u = Math.min(1, p * 2.5);
    bx = -0.45 * u; by = 0.45 * u; aL = aR = -1.2 * u; hx = -0.45 * u; jaw = Math.max(jaw, u);
  } else if (z.act === 'claw') {                                       // un tentáculo atrás y golpe
    const up = Math.min(1, p / 0.8), down = p > 0.8 ? (p - 0.8) / 0.2 : 0;
    aR = -2.6 * up + 3.2 * down; bx = -0.2 * up + 0.3 * down;
  } else if (z.act === 'whip') {                                       // el tentáculo derecho se abre al costado y barre
    const up = Math.min(1, p / 0.85), sw = p > 0.85 ? (p - 0.85) / 0.15 : 0;
    aR = -1.4; aRz = 1.6 * up - 3.0 * sw; bx = -0.1;
  } else if (z.act === 'cast') {                                       // clava los tentáculos en el piso
    aL = aR = 0.9 * Math.min(1, p * 2); by = -0.3; hx = 0.3;
  } else if (z.act === 'smash') {                                      // golpea la escalera
    const w = Math.sin(p * Math.PI * 3);
    aL = aR = -2.2 + w * 1.4; bx = -0.3 + 0.3 * w;
  } else if (z.act === 'pwind') {                                      // se agacha
    const u = Math.min(1, p * 2); bx = 0.25 * u; by = -0.35 * u; aL = aR = 0.5 * u; lL = lR = -0.6 * u;
  } else if (z.act === 'pounce') {                                     // en el aire: estirada
    const T = CONFIG.BEAST.pounce.maxTime, u = Math.min(1, (T - Math.max(0, z.actT)) / T);
    by = Math.sin(Math.PI * Math.min(1, u * 1.6)) * 1.6; aL = aR = -1.3; lL = lR = 1.0; bx = -0.1;
  } else if (z.act === 'tentacle') { hx = -0.15; by = 0.1; }
  // la ola: cada tentáculo se levanta (lift) y barre hacia atrás (reach) con su fase; quieta, se retuercen despacio
  const idle = 0.25 * (1 - k), wave = (ph, i) => {
    const q = w + ph;
    return [(-Math.max(0, Math.sin(q)) * 0.45 * k) + Math.sin(t * 1.7 + i * 1.9) * idle, Math.cos(q) * 0.35 * k + Math.sin(t * 1.3 + i) * idle];
  };
  const limbs = [z.armL, z.armR, z.legL, z.legR], lx = [aL, aR, lL, lR];
  for (let i = 0; i < 4; i++) {
    const [wl, wr] = wave(LIMB_A[i], i + 20);
    setLimb(limbs[i], i, lx[i] * 0.6 + wl, (i === 1 ? aRz : 0) + wr * (i & 1 ? -1 : 1));
  }
  for (let i = 0; i < z.tents.length; i++) {
    const g = z.tents[i], [wl, wr] = wave(g.userData.a * 2, i);
    g.rotation.set(-g.userData.sp + wl + by * 0.5, g.userData.a + wr, Math.sin(t * 2.1 + i * 1.3) * 0.25);
  }
  // la carne: se balancea de costado y se estira hacia adelante con cada tirón
  z.body.rotation.set(bx, Math.sin(w) * 0.1 * k, Math.sin(w + 1) * 0.09 * k); z.body.position.set(0, by, 0.12 * pull * k);
  z.body.scale.set(1 - 0.04 * pull * k, 1 + 0.03 * pull * k, 1 + 0.06 * pull * k);
  z.head.rotation.set(hx + Math.sin(w * 0.5) * 0.06, Math.sin(t * 0.7) * 0.12 + Math.sin(w) * 0.1 * k, Math.sin(w + 2) * 0.08 * k);
  z.jaw.rotation.x = 0.1 + jaw * 0.75 + Math.max(0, Math.sin(t * 1.1)) * 0.12;   // baba: la boca nunca termina de cerrar
  // F5.28c: el ojo colgando se balancea (más con cada tirón y con los sacudones de las acciones)
  z.eyeHang.rotation.set(Math.sin(t * 2.3) * 0.22 + pull * 0.2 * k + bx * 0.8, 0, -0.08 + Math.sin(t * 1.7 + 1) * 0.25 + by * 0.3);
}

function updateBeast(dt) {
  for (const b of BEAST.barrels) if (b.alive && b.fuseT > 0 && (b.fuseT -= dt) <= 0) blowBarrel(b);
  updateBeastSpikes(dt, clock.elapsedTime);                            // F5.28: tentáculos del piso
  updateBeastDrool(dt);                                                // F5.28c: sangre de la boca
  // el tentáculo que vuelve cuando la Bestia ya no está en su acción (murió, o terminó mientras volvía)
  if (BEAST.tg.state === 'back' && BEAST.z && BEAST.z.act !== 'tentacle') updateBeastTentacle(BEAST.z, dt, clock.elapsedTime);
  // la Bestia dormida: respira y se despierta si te acercás (en el búnker)
  if (BEAST.z && BEAST.phase === 'sleep' && BUNK.open) {
    animateSleep(clock.elapsedTime);
    const L = CONFIG.BEAST.lair;
    if (inBunker() && Math.hypot(player.pos.x - L.x, player.pos.z - L.z) < CONFIG.BEAST.wakeDist) wakeBeast();
  }
  // arreglar la escalera: mantener F con el cartel de la escalera (abajo) activo
  if (BEAST.broken && interactState.kind === 'hatch' && interactState.target && !interactState.target.down && keys['KeyF']) {
    BEAST.buildT += dt;
    const T = CONFIG.BEAST.ladder.rebuild;
    UI.craft.style.opacity = '1';
    UI.craftBar.style.width = (100 * Math.min(1, BEAST.buildT / T)).toFixed(1) + '%';
    if (BEAST.buildT >= T) { fixLadder(); UI.craft.style.opacity = '0'; showBanner('LADDER FIXED', 1.4); sfxShieldTake(); }
  } else if (BEAST.buildT > 0) { BEAST.buildT = 0; UI.craft.style.opacity = '0'; }
}
function resetBeast() {
  resetBarrels();
  // F5.28: sin tentáculo afuera ni tentáculos del piso
  const T = BEAST.tg; T.state = 'off'; T.t = 0; BEAST.jawOpen = 0;
  if (BEAST.tent) { BEAST.tent.visible = false; beastTentacleShootable(false); }
  for (const R of BEAST.spikes) { R.state = 'off'; R.g.visible = false; }
  resetBeastDrool();                                                   // F5.28c
  if (BEAST.z) {                                                       // vuelve a dormir en su esquina
    const z = BEAST.z;
    z.act = null; z.phase = 1;
    z.root.visible = false;
    sleepBeast();
  }
  if (BEAST.broken) {
    BEAST.broken = false; BEAST.buildT = 0;
    if (BEAST.ladder) { BEAST.ladder.visible = true; BEAST.debris.visible = false; }
  }
}
