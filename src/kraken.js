//=== 7q. EASTER EGG "THE KRAKEN" (V2 F5.29) ==================================
// Pedido de Diego: un easter egg en la playa que termina en una pelea difícil contra el calamar gigante del mar, que
// escupe calamarcitos. Pasos (cada uno necesita el anterior; sin pistas en el juego, solo un sonido de paso cumplido
// y otro de paso fallido, procedurales en audio.js):
//   1) matar a la planta jefa y agarrar la SEMILLA NEGRA que suelta (se hunde en seed.time s; vuelve a brotar en la
//      ronda siguiente);  2) matar a la Bestia;  3) con la semilla, cargar el TELETRANSPORTADOR del búnker (tele.charge s
//      parado en la plataforma) -> te lleva al laboratorio del caparazón;  4) las PRUEBAS: las 3 consolas en calib s y
//      aguantar hold s adentro del caparazón;  5) el tocadiscos llama a un SOMBRERÓN: bajarle la vida a menos de weak,
//      meterlo en la CABINA y cerrarla con su consola;  6) la cabina procesa process s y suelta el CEBO DEL ABISMO.
// Con el cebo: se cortan los zombies (la ronda queda en pausa) y el día se pone morado. La PARED DE AGUA del fondo de
// la cámara de la cabeza del calamar (piso de abajo) te lleva a la ARENA.
// F5.29b (Diego, tras probarla: "muy básica y mal diseñada"): la arena es un MUELLE en medio del mar, lejos de la costa
// y grande (barandas y faroles en todo el borde), de noche con tormenta (lluvia cerrada y relámpagos). El KRAKEN es el
// calamar gigante de la playa (F5.11) a escala enorme, con un OJO que brilla. Ahogados que suben al muelle sin parar.
// Fases: 1) los tentáculos se levantan (franja roja de aviso), caen despacio (slamDmg) y quedan apoyados, SÓLIDOS; solo
// algunos traen la HERIDA que brilla: cortar cuts a balazos;  2) el ojo se abre en ventanas cortas: subirte a un CAÑÓN
// DE ARPONES (F), apuntar y disparar con el clic: eyeHits arponazos (cada acierto te baja del cañón);  3) F5.29d: salen
// del mar 2 Sombrerones, el Calamarón y la Bestia; cada uno suelta una GRANADA MORADA; con las 4, en la mesa del muelle se
// atan a la Ola Rompiente, y esa carga, a la boca abierta, lo revienta de a poco. En todas: tentáculos que salen del piso
// (más si estás en un cañón: te tiran lejos), calamarcitos y tinta. Cada fase cumplida deja un Max Ammo, y cada fase
// cumplida o paso fallado hace salir un boss del mar (en la 3, ahogados).
// Morir en la arena = game over. Si se acaba el tiempo: te escupe a la playa, salen bosses y perros, y el cebo vuelve a
// la cabina en punish.lureRounds rondas. El bote (F, boat s cerca) te saca sin castigo.
// Victoria (F5.29e): la cinemática (explota de a poco con grietas que brillan, la gran explosión, el remolino visto desde
// arriba y el PORTAL CÚBICO morado que se abre en el cielo con auroras; después el tablón) y volvés a la playa: el
// remolino y el portal quedan en el mar, hay restos del Kraken por todo el mapa, el cielo queda morado y azul, y los premios.
// Todo lo que se dibuja se arma una vez en buildKraken (pools fijos); la arena es un cuarto aparte (R25) en el mar,
// dentro del grid, sin conexión a pie: solo se entra y se sale por teletransporte.
const EE = {
  step: 0, hasSeed: false, plantDead: false, beastDead: false,
  seed: null,                                    // { x, y, z, t, sunk, back } la semilla en la plancha del templo
  tele: { state: 'off', t: 0, out: 0 },          // off · charging · done
  trial: { n: 0, state: 'off', t: 0, lit: [false, false, false] },   // n = pruebas cumplidas · calib · hold
  cap: { state: 'off', boss: null, t: 0, cd: 0, doorK: 0, shut: 0 },  // off · waiting · process · ready
  lure: false, calm: false, lureBackRound: 0,
  fight: null, cine: null, won: false, skyK: 0, travelTo: null, storm: false,
  g: {}, built: false
};
const KRAKEN = { g: null, body: null, eye: null, eyeHit: null, eyeHalo: null, lid: null, bodyHit: null, mouth: null,
  mouthHalo: null, idle: [], tents: [], floors: [], tentIM: null, harps: [], whirl: null, debris: null, arena: null,
  membrane: null, sea: null, edges: [], cols: [], fires: [],
  // F5.29d: las granadas moradas en el piso, los huecos de la mesa, la carga atada a la Ola (en la mano y volando), el
  // tablón del final y los pedazos que vuelan
  orbs: [], sockets: [], table: null, bundle: null, chargeM: null, plank: null, chunks: [],
  v: new THREE.Vector3(), v2: new THREE.Vector3(), m4: new THREE.Matrix4() };

// (al cargar) la arena entra a ROOMS: el grid, roomAt y los colliders la ven como un cuarto más
(function () {
  const A = CONFIG.EE.arena;
  for (const [x1, x2, z1, z2] of A.rects)
    ROOMS.push({ id: 'R25', name: 'KRAKEN SEA', x1: A.x + x1, x2: A.x + x2, z1: A.z + z1, z2: A.z + z2, floor: 'deck',
      outdoor: true, noFloor: true, part: ROOMS.some(r => r.id === 'R25'), hideMap: true });
})();
function inArena(x, z) { const r = roomAt(x, z); return !!r && r.id === 'R25'; }
function arenaWalk(ix, iz) {
  const A = CONFIG.EE.arena, x = ix + 0.5 - A.x, z = iz + 0.5 - A.z;
  return A.rects.some(([x1, x2, z1, z2]) => x > x1 && x < x2 && z > z1 && z < z2);
}
// (buildMap, antes del grid) los bordes de la arena: límites invisibles en cada borde entre lo caminable y el agua;
// la base de cada cañón (sólida); y los colliders de los tentáculos, que arrancan apagados (solid false: no tocan el
// grid) y se prenden y mueven cuando un tentáculo queda apoyado (solo marcan COLHASH: el grid no los ve)
function buildKrakenShell() {
  const A = CONFIG.EE.arena, F = CONFIG.EE.fight, T = 0.3, runs = {};
  const push = (k, i) => (runs[k] = runs[k] || []).push(i);
  for (let x = A.x - 45; x < A.x + 45; x++) for (let z = A.z - 45; z < A.z + 45; z++) {
    if (!arenaWalk(x, z)) continue;
    if (!arenaWalk(x, z - 1)) push('h|' + z + '|-1', x);
    if (!arenaWalk(x, z + 1)) push('h|' + (z + 1) + '|1', x);
    if (!arenaWalk(x - 1, z)) push('v|' + x + '|-1', z);
    if (!arenaWalk(x + 1, z)) push('v|' + (x + 1) + '|1', z);
  }
  for (const k in runs) {
    const [ax, line, side] = k.split('|'), L = +line, s = +side, list = runs[k].sort((a, b) => a - b);
    for (let i = 0; i < list.length;) {
      let j = i;
      while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
      const a = list[i], b = list[j] + 1, w1 = s > 0 ? L : L - T, w2 = s > 0 ? L + T : L;
      if (ax === 'h') addBoundary(a, b, w1, w2, 'bound:kraken'); else addBoundary(w1, w2, a, b, 'bound:kraken');
      i = j + 1;
    }
  }
  for (const [hx, hz] of A.harpoons) addBoundary(A.x + hx - 0.5, A.x + hx + 0.5, A.z + hz - 0.5, A.z + hz + 0.5, 'kraken:cannon');
  addBoundary(A.x + A.table[0] - 1.2, A.x + A.table[0] + 1.2, A.z + A.table[1] - 0.5, A.z + A.table[1] + 0.5, 'kraken:table');   // F5.29d
  KRAKEN.cols = [];
  for (let i = 0; i < 4 * F.boxes + 2; i++) {
    const c = addBoundary(A.x, A.x + 0.1, A.z, A.z + 0.1, 'kraken:tent');
    c.solid = false; KRAKEN.cols.push(c);
  }
}

//--- sonidos (procedurales: paso cumplido, paso fallido y el acorde de "listo") ---
function sfxEEOk() {
  if (typeof audioOn !== 'function' || !audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => sfxTone(t + i * 0.09, 0.9, 'triangle', f, f, 0.16));   // arpegio que sube
  [1568, 2093].forEach((f, i) => sfxTone(t + 0.36 + i * 0.05, 1.6, 'sine', f, f * 0.998, 0.07));   // campanitas
  sfxTone(t, 1.2, 'sine', 65, 49, 0.25);                                                           // golpe grave
  sfxNoise(t, 0.25, 'lowpass', 400, 0.7, 0.35);
}
function sfxEEFail() {
  if (typeof audioOn !== 'function' || !audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxTone(t, 0.45, 'sawtooth', 311, 300, 0.12); sfxTone(t + 0.4, 0.9, 'sawtooth', 233, 196, 0.12);   // dos notas que caen
  sfxTone(t, 1.2, 'square', 58, 52, 0.08);                                                             // zumbido
  sfxTone(t + 0.4, 0.9, 'sine', 247, 247 * 0.97, 0.08);                                               // desafinada
}
function sfxEEReady() {
  if (typeof audioOn !== 'function' || !audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  [131, 196, 262, 311, 392].forEach((f, i) => sfxTone(t + i * 0.25, 5, 'sine', f, f * 1.002, 0.1));  // acorde largo (menor)
  sfxTone(t, 5, 'sawtooth', 41, 41, 0.07);
  sfxNoise(t + 1, 3, 'lowpass', 220, 0.5, 0.2);                                                       // el mar que respira
}
// F5.29b: las tablas que se rajan (el tentáculo del piso) y el arpón que sale
function sfxKrakenCrack() {
  if (typeof audioOn !== 'function' || !audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  for (let i = 0; i < 5; i++) sfxNoise(t + i * 0.07 + Math.random() * 0.04, 0.09, 'bandpass', 900 + Math.random() * 900, 1.2, 0.3);
  sfxTone(t, 0.9, 'sine', 70, 38, 0.3);
}
function sfxHarpoon() {
  if (typeof audioOn !== 'function' || !audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxNoise(t, 0.18, 'highpass', 1200, 0.8, 0.4);
  sfxTone(t, 0.35, 'square', 180, 60, 0.18);
  sfxTone(t + 0.02, 0.6, 'sawtooth', 900, 300, 0.05);                                                  // la cuerda que silba
}

// F5.29c (Diego): el golpe del tentáculo contra el muelle (estruendo grave, tablas que se rompen y el agua) y el acierto
// en el lugar correcto (la ventosa o el ojo: carne que revienta y un timbre que sube)
function sfxKrakenSlam() {
  if (typeof audioOn !== 'function' || !audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxTone(t, 1.4, 'sine', 55, 28, 0.55); sfxTone(t, 0.5, 'square', 90, 40, 0.12);
  sfxNoise(t, 0.35, 'lowpass', 600, 0.8, 0.5);
  for (let i = 0; i < 6; i++) sfxNoise(t + 0.02 + i * 0.05 + Math.random() * 0.03, 0.08, 'bandpass', 1200 + Math.random() * 1500, 1.5, 0.22);
  sfxNoise(t + 0.15, 1.1, 'bandpass', 900, 0.4, 0.25);
}
function sfxKrakenWeak() {
  if (typeof audioOn !== 'function' || !audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxNoise(t, 0.18, 'lowpass', 900, 1.2, 0.35);                                                    // carne que revienta
  sfxTone(t, 0.25, 'sine', 140, 60, 0.25);
  sfxTone(t + 0.03, 0.4, 'triangle', 880, 1320, 0.12); sfxTone(t + 0.1, 0.45, 'sine', 1320, 1760, 0.08);   // timbre que sube
}

//--- dibujo (una vez, en init) ---
function krakenPut(B, mat, parent) {
  const m = B.mesh(mat);
  if (!m) return null;
  scene.remove(m); m.matrixAutoUpdate = true; m.userData.theme = false; parent.add(m);
  return m;
}
function buildKraken() {
  const E = CONFIG.EE;
  const lam = new THREE.MeshLambertMaterial({ vertexColors: true }), basic = () => new THREE.MeshBasicMaterial({ vertexColors: true });
  const grp = (parent) => { const g = new THREE.Group(); (parent || scene).add(g); g.userData.theme = false; return g; };
  const meshOf = (B, mat, parent) => krakenPut(B, mat, parent);
  // ---- la semilla negra ----
  { const g = EE.g.seed = grp(), b = new MeshBuilder(), gl = new MeshBuilder();
    b.box(0, 0.15, 0, 0.3, 0.3, 0.3, 0x141016); b.box(0, 0.32, 0, 0.18, 0.12, 0.18, 0x1e1a22); b.box(0.06, 0.4, 0, 0.04, 0.12, 0.04, 0x2a3a1a);
    gl.box(0, 0.15, 0.151, 0.08, 0.08, 0.01, 0x7aff4a); gl.box(0.151, 0.18, 0, 0.01, 0.06, 0.06, 0x7aff4a); gl.box(-0.151, 0.12, 0, 0.01, 0.06, 0.06, 0x7aff4a);
    meshOf(b, lam, g); meshOf(gl, basic(), g); g.visible = false; }
  // ---- el haz del teletransportador (verde al cargar) ----
  { const t = CONFIG.BUNKER.teleporter, g = EE.g.tele = grp(), b = new MeshBuilder();
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; b.box(Math.cos(a) * 1.1, 1.6, Math.sin(a) * 1.1, 0.12, 3.2, 0.12, 0xffffff); }
    EE.g.teleMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x3aff6a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    meshOf(b, EE.g.teleMat, g); g.position.set(t.x, CONFIG.BUNKER.y + 0.4, t.z + 0.1); }
  // ---- las 3 consolas del laboratorio (pantalla que cambia de color) ----
  EE.g.consoles = E.consoles.map(([x, z, lv]) => {
    const g = grp(), b = new MeshBuilder(), y = lv === 0 ? 0 : lv === 1 ? UP.y : UP2.y;
    b.box(0, 0.5, 0, 0.7, 1.0, 0.5, 0x3a3e44); b.box(0, 1.08, -0.05, 0.75, 0.16, 0.6, 0x2e3238, -0.4, 0, 0);
    for (let k = 0; k < 3; k++) b.box(-0.2 + k * 0.2, 1.17, 0.12, 0.1, 0.03, 0.1, [0xff3a3a, 0xffd23a, 0x3aff6a][k]);
    meshOf(b, lam, g);
    const scr = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.38, 0.02), new THREE.MeshBasicMaterial({ color: 0x2a0806 }));
    scr.position.set(0, 1.35, -0.27); scr.rotation.x = -0.25; g.add(scr);
    g.position.set(x, y, z); g.rotation.y = Math.atan2(CONFIG.SHELL.x - x, CONFIG.SHELL.z - z);
    return { g, scr };
  });
  // ---- el tocadiscos (gramófono de bronce) ----
  { const [x, z] = E.gramo, g = EE.g.gramo = grp(), b = new MeshBuilder();
    b.box(0, 0.45, 0, 0.8, 0.9, 0.6, 0x5a3a20); b.box(0, 0.92, 0, 0.6, 0.04, 0.5, 0x1a1a1a); b.box(0, 0.95, 0, 0.12, 0.02, 0.12, 0xc8a050);
    for (let k = 0; k < 6; k++) { const s = 0.12 + k * 0.09; b.box(0.15 + k * 0.05, 1.05 + k * 0.12, -0.1 - k * 0.06, s, 0.08, s, 0xd8a840, 0.4, 0, -0.3); }
    meshOf(b, lam, g); g.position.set(x, 0, z); }
  // ---- la cabina de contención (puertas de vidrio que se cierran a los costados x) ----
  { const C = E.booth, g = EE.g.booth = grp(), b = new MeshBuilder(), hw = C.w / 2, hd = C.d / 2;
    b.box(0, 0.05, 0, C.w + 0.4, 0.1, C.d + 0.4, 0x2e3238);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(sx * hw, 1.5, sz * hd, 0.22, 3, 0.22, 0x4a4e54);
    b.box(0, 3.05, 0, C.w + 0.4, 0.2, C.d + 0.4, 0x2e3238);
    for (const sz of [-1, 1]) b.box(0, 1.5, sz * hd, C.w, 3, 0.08, 0x1e2226);                  // paredes de los lados z
    for (let k = 0; k < 6; k++) b.box(-hw + 0.25 + k * (C.w - 0.5) / 5, 2.85, 0, 0.1, 0.1, C.d, 0xe8c020);   // franjas de peligro
    meshOf(b, lam, g);
    EE.g.doorMat = new THREE.MeshBasicMaterial({ color: 0x7aff9a, transparent: true, opacity: 0.3, depthWrite: false });
    EE.g.doors = [-1, 1].map(s => { const d = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.8, C.d - 0.3), EE.g.doorMat); d.position.set(s * hw, 1.45, 0); d.scale.z = 0.01; g.add(d); return d; });
    EE.g.boothLight = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.3), new THREE.MeshBasicMaterial({ color: 0x3a0a08 }));
    EE.g.boothLight.position.set(0, 3.25, 0); g.add(EE.g.boothLight);
    const cb = new MeshBuilder(), [cx, cz] = E.boothConsole;                                     // la consola de la cabina
    cb.box(0, 0.55, 0, 0.5, 1.1, 0.4, 0x3a3e44); cb.box(0, 1.15, 0, 0.36, 0.2, 0.3, 0xd83a2a);
    const cm = meshOf(cb, lam, grp()); if (cm) cm.parent.position.set(cx, 0, cz);
    g.position.set(C.x, 0, C.z); }
  // ---- el cebo del abismo (ampolla de vidrio con tinta que brilla) ----
  { const g = EE.g.lure = grp(), b = new MeshBuilder(), gl = new MeshBuilder();
    b.box(0, 0.32, 0, 0.26, 0.04, 0.26, 0xc8a050); b.box(0, 0.02, 0, 0.26, 0.04, 0.26, 0xc8a050);
    gl.box(0, 0.17, 0, 0.2, 0.26, 0.2, 0x9a3aff); gl.box(0, 0.17, 0, 0.1, 0.18, 0.1, 0xf0c8ff);
    meshOf(b, lam, g); meshOf(gl, basic(), g); g.visible = false; }
  // ---- la pared de agua de la cabeza del calamar ----
  { const M = E.membrane, cv = typeof document !== 'undefined' && document.createElement ? document.createElement('canvas') : null;
    let tex = null;
    if (cv && cv.getContext) {
      cv.width = 64; cv.height = 128; const c = cv.getContext('2d');
      if (c && c.fillRect) {
        for (let y = 0; y < 128; y += 4) for (let x = 0; x < 64; x += 4) { const v = 30 + Math.floor(Math.random() * 60); c.fillStyle = 'rgb(' + (v * 0.3 | 0) + ',' + (v + 40) + ',' + (v + 90) + ')'; c.fillRect(x, y, 4, 4); }
        tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.NearestFilter;
      }
    }
    const mat = new THREE.MeshBasicMaterial({ color: 0x5aa8d8, map: tex, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false });
    const m = KRAKEN.membrane = new THREE.Mesh(new THREE.PlaneGeometry(M.w, M.h, 1, 1), mat);
    m.position.set(M.x, M.h / 2, M.z); m.userData.theme = false; scene.add(m); }
  buildArena();
  buildKrakenBody();
  buildKrakenTentacles();
  buildKrakenPhase3();
  buildKrakenFinale();
  buildWhirlAndDebris();
  EE.built = true;
}
// el muelle (F5.29b): tablones, pilotes, barandas y faroles en todo el borde, los 4 cañones de arpones, el bote, restos
// de barcos en el agua y el mar de la tormenta (un plano oscuro y olas en cubos alrededor)
function buildArena() {
  const E = CONFIG.EE, A = E.arena, ST = E.storm, g = KRAKEN.arena = new THREE.Group(); g.userData.theme = false; scene.add(g);
  const lam = () => new THREE.MeshLambertMaterial({ vertexColors: true });
  const deck = new MeshBuilder(), rail = new MeshBuilder(), glow = new MeshBuilder(), rr = mulberry(9090), r = (a, b) => a + (b - a) * rr();
  const WOOD = [0x6a4a2a, 0x5a3e24, 0x4e3420, 0x7a5632], GAP = 0x1e140a, PILE = 0x3a2a1a, MOSS = 0x34442a, IRON = 0x3a3a40;
  const X0 = A.x - 45, X1 = A.x + 45, Z0 = A.z - 45, Z1 = A.z + 45;
  // el embarcadero es el último rectángulo: su punta queda abierta (el bote) y por ahí no suben los del mar
  const J = A.rects[A.rects.length - 1];
  const jetty = (x, z) => { const rx = x + 0.5 - A.x, rz = z + 0.5 - A.z; return rx > J[0] && rx < J[1] && rz > J[2] && rz < J[3]; };
  KRAKEN.edges = [];
  for (let x = X0; x < X1; x++) for (let z = Z0; z < Z1; z++) {
    if (!arenaWalk(x, z)) continue;
    // dos tablones por celda (a lo largo de x), sobre el fondo oscuro de las juntas; alguna mancha y algún clavo
    deck.box(x + 0.5, -0.3, z + 0.5, 1, 0.08, 1, GAP);
    for (let k = 0; k < 2; k++) deck.box(x + 0.5 + r(-0.02, 0.02), -0.13, z + 0.25 + k * 0.5, 1.0, 0.26, 0.45, WOOD[Math.floor(rr() * 4)]);
    if (rr() < 0.06) deck.box(x + r(0.2, 0.8), 0.005, z + r(0.2, 0.8), r(0.3, 0.7), 0.012, r(0.2, 0.4), 0x2a1a0c);
    if (rr() < 0.08) deck.box(x + r(0.1, 0.9), 0.01, z + r(0.1, 0.9), 0.05, 0.02, 0.05, 0x8a8a90);
    // pilotes cada 4 m (con algas y percebes a la altura del agua)
    if (x % 4 === 0 && z % 4 === 0) {
      deck.box(x, -2.6, z, 0.5, 4.6, 0.5, PILE); deck.box(x, -1.75, z, 0.56, 0.35, 0.56, MOSS); deck.box(x, -1.3, z, 0.54, 0.12, 0.54, 0x6a6a5a);
    }
    // el borde: viga, baranda (postes cada 2 m, dos travesaños) y lugares para que suban los ahogados
    const sides = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    let edge = false;
    for (const [dx, dz] of sides) {
      if (arenaWalk(x + dx, z + dz)) continue;
      edge = true;
      // la punta del embarcadero queda abierta (ahí está el bote)
      if (dz === 1 && jetty(x, z)) continue;
      const ex = x + 0.5 + dx * 0.5, ez = z + 0.5 + dz * 0.5, along = dx === 0;
      deck.box(ex + dx * 0.1, -0.45, ez + dz * 0.1, along ? 1 : 0.22, 0.5, along ? 0.22 : 1, PILE);
      if ((x + z) % 2 === 0) rail.box(ex, 0.55, ez, 0.16, 1.1, 0.16, 0x4a3420);
      rail.box(ex, 1.06, ez, along ? 1.02 : 0.1, 0.1, along ? 0.1 : 1.02, 0x5a3e24);
      rail.box(ex, 0.55, ez, along ? 1.02 : 0.07, 0.07, along ? 0.07 : 1.02, 0x4a3420);
      if (rr() < 0.05) rail.box(ex + dx * 0.15, 0.7, ez + dz * 0.15, 0.5, 0.5, 0.5, 0xd84a2a);              // salvavidas
      if (rr() < 0.06) rail.box(ex + dx * 0.12, 0.8, ez + dz * 0.12, along ? 1 : 0.05, 0.6, along ? 0.05 : 1, 0x3a4a3a);   // red
    }
    if (edge && !jetty(x, z)) KRAKEN.edges.push([x + 0.5, z + 0.5]);
  }
  // F5.29c (Diego: "oscuro y con un par de antorchas"): antorchas de palo con brasero de hierro, fuego en cubos (voxFire;
  // fuera de la pelea se esconden bajo el agua: eeStorm) y una mancha de luz cálida en el piso (todas en un solo mesh)
  const pool = radialTex('rgba(255,170,70,.8)', 'rgba(255,110,30,.25)');
  const pv = [], puv = [], pix = [], R = A.torchR;
  KRAKEN.fires = [];
  A.torches.forEach(([lx, lz], i) => {
    const x = A.x + lx, z = A.z + lz;
    rail.box(x, 0.9, z, 0.2, 1.8, 0.2, 0x3a2a1a); rail.box(x, 0.3, z, 0.4, 0.12, 0.4, IRON);
    rail.box(x, 1.85, z, 0.46, 0.14, 0.46, IRON); rail.box(x, 2.0, z, 0.5, 0.12, 0.5, 0x2a2a30);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rail.box(x + sx * 0.22, 2.12, z + sz * 0.22, 0.06, 0.18, 0.06, IRON);
    glow.box(x, 2.08, z, 0.34, 0.06, 0.34, 0xff6a1a);                                          // brasas
    voxFire(x, 2.1, z, 1.1); KRAKEN.fires.push(VFIRE.list[VFIRE.list.length - 1]);
    pv.push(x - R, 0.03, z - R, x + R, 0.03, z - R, x + R, 0.03, z + R, x - R, 0.03, z + R);
    puv.push(0, 0, 1, 0, 1, 1, 0, 1);
    const o = i * 4; pix.push(o, o + 2, o + 1, o, o + 3, o + 2);
  });
  for (const F of KRAKEN.fires) { F.y0 = F.y; F.y = -100; }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pv, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(puv, 2)); pg.setIndex(pix);
  g.add(new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: pool, transparent: true, opacity: A.torchOpacity, blending: THREE.AdditiveBlending, depthWrite: false })));
  // restos de barcos en el agua (mástiles rotos, cascos que asoman)
  for (const [wx, wz, ry] of A.wrecks) {
    deck.setFrame(A.x + wx, ST.seaY, A.z + wz, ry);
    deck.box(0, 0.2, 0, 5, 1.4, 2, WOOD[1], 0, 0, 0.25); deck.box(-1.5, 0.9, 0, 1.6, 0.3, 1.8, WOOD[2], 0, 0, 0.25);
    deck.box(1, 3, 0, 0.3, 6, 0.3, WOOD[0], 0, 0, -0.45); deck.box(1.8, 4.6, 0, 0.12, 0.12, 2.4, WOOD[2]);
    deck.box(0.4, 2.6, 0.2, 0.05, 2.5, 1.6, 0x8a8470, 0, 0.2, -0.4);                                // vela rota
    deck.setFrame(null);
  }
  // el bote, atado a la punta del embarcadero
  { const [bx, bz] = A.boat; deck.setFrame(A.x + bx, ST.seaY + 0.5, A.z + bz, 0);
    deck.box(0, -0.2, 0, 1.6, 0.4, 3, WOOD[0]); for (const s of [-1, 1]) deck.box(s * 0.8, 0.1, 0, 0.12, 0.5, 3, WOOD[2]);
    deck.box(0, 0.1, 1.5, 1.4, 0.5, 0.12, WOOD[2]); deck.box(0, 0.05, -0.2, 1.5, 0.08, 0.3, WOOD[1]);
    deck.box(0, 0.35, 1.5, 0.4, 0.5, 0.4, 0x2a2a2a); deck.box(0, 0.6, -1.4, 0.04, 0.04, 1.4, 0xb8a878, 0.7, 0, 0);
    deck.setFrame(null); }
  // (la madera mojada brilla un poco: de noche se ven las tablas)
  krakenPut(deck, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x0a0603 }), g);
  krakenPut(rail, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x090502 }), g);
  krakenPut(glow, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), g);
  buildHarpoons(g);
  // el mar de la tormenta: un plano oscuro hasta el horizonte y olas en cubos alrededor del muelle (el mar de la playa
  // se esconde durante la pelea: eeStorm)
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshLambertMaterial({ color: 0x10202a, emissive: 0x050e14 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(A.x, ST.seaY - 0.35, A.z); g.add(sea);
  const cells = [];
  for (let x = A.x - 46; x < A.x + 46; x += ST.cube) for (let z = A.z - 34; z < A.z + 42; z += ST.cube) {
    const cx = x + ST.cube / 2, cz = z + ST.cube / 2;
    if (arenaWalk(Math.floor(cx), Math.floor(cz))) continue;
    cells.push([cx, cz]);
  }
  const vox = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ emissive: 0x061218 }), cells.length);
  vox.frustumCulled = false; g.add(vox);
  // (alguna cresta con espuma clara: el mar picado se lee de noche)
  const col = new THREE.Color(), SEAC = [0x1c3a46, 0x16303c, 0x22465a, 0x12282e, 0x16303c, 0x4a6a72];
  cells.forEach((c, i) => { col.setHex(SEAC[Math.floor(rr() * SEAC.length)]); vox.setColorAt(i, col); });
  KRAKEN.sea = { vox, cells, foam: new THREE.Color(0x6a8a8a) };
  g.visible = false;
}
// los 4 cañones de arpones: base giratoria, caño de hierro con mira, culata y manijas, el arpón cargado que asoma y
// la lámpara (verde: listo; roja: recargando; apagada: el ojo está cerrado). El asiento queda detrás, mirando al Kraken
function buildHarpoons(g) {
  const A = CONFIG.EE.arena, KX = A.x + A.kraken[0], KZ = A.z + A.kraken[1], IRON = 0x3a3a40;
  const lam = new THREE.MeshLambertMaterial({ vertexColors: true });
  KRAKEN.harps = A.harpoons.map(([hx, hz]) => {
    const x = A.x + hx, z = A.z + hz, dx = KX - x, dz = KZ - z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
    const hg = new THREE.Group(); hg.position.set(x, 0, z); g.add(hg);
    const b = new MeshBuilder();
    b.box(0, 0.2, 0, 1.3, 0.4, 1.3, 0x4a321c); b.box(0, 0.42, 0, 1.36, 0.06, 1.36, IRON); b.box(0, 0.05, 0, 1.36, 0.06, 1.36, IRON);
    b.box(0, 0.85, 0, 0.36, 0.9, 0.36, IRON); b.box(0, 1.28, 0, 0.62, 0.12, 0.62, 0x2a2a30);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(sx * 0.5, 0.45, sz * 0.5, 0.12, 0.12, 0.12, 0x6a6a70);   // remaches
    krakenPut(b, lam, hg);
    const head = new THREE.Group(); head.position.y = 1.45; hg.add(head);
    const hb = new MeshBuilder();
    hb.box(0, 0, -0.6, 0.42, 0.42, 2.2, IRON); hb.box(0, 0, -1.75, 0.56, 0.56, 0.18, 0x2a2a30);         // caño y boca
    hb.box(0, 0, -0.9, 0.48, 0.48, 0.1, 0x2a2a30); hb.box(0, 0, -0.2, 0.48, 0.48, 0.1, 0x2a2a30);       // zunchos
    hb.box(0, 0.27, -0.6, 0.06, 0.1, 1.6, 0x5a5a62); hb.box(0, 0.38, -1.35, 0.04, 0.14, 0.04, 0x8a8a90);   // mira
    hb.box(0, -0.05, 0.62, 0.52, 0.32, 0.56, 0x4a321c);                                                 // culata
    for (const s of [-1, 1]) { hb.box(s * 0.4, -0.05, 0.8, 0.08, 0.08, 0.42, 0x2a1a0e); hb.box(s * 0.4, -0.05, 1.0, 0.12, 0.2, 0.12, 0x1a120a); }
    hb.box(0.3, -0.05, 0.1, 0.06, 0.34, 0.34, IRON); hb.box(0.36, 0.1, 0.22, 0.06, 0.06, 0.2, 0x6a6a70);  // manivela
    krakenPut(hb, lam, head);
    // el arpón cargado (la punta hacia -z)
    const sb = new MeshBuilder();
    sb.box(0, 0, 0, 0.09, 0.09, 1.8, 0xc8c8c0); sb.box(0, 0, -0.95, 0.26, 0.06, 0.26, 0xd8d8d0); sb.box(0, 0, -0.95, 0.06, 0.26, 0.26, 0xd8d8d0);
    sb.box(0, 0, -1.12, 0.12, 0.12, 0.14, 0xe8e8e0); sb.box(0, 0, 0.85, 0.2, 0.2, 0.12, 0x6a4a2a);
    const loaded = krakenPut(sb, lam, head); loaded.position.z = -1.6;
    const spear = loaded.clone(); spear.visible = false; g.add(spear);
    const rope = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1), new THREE.MeshLambertMaterial({ color: 0x9a8a62 }));
    rope.visible = false; g.add(rope);
    // (la lámpara va al costado del caño, adelante: subido, no te tapa la vista)
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0x1a0806, fog: false }));
    lamp.position.set(0.3, 0.12, -1.1); head.add(lamp);
    head.rotation.y = Math.atan2(-ux, -uz);                                   // (el caño apunta al Kraken)
    return { x, z, sx: x - ux * 1.4, sz: z - uz * 1.4, ux, uz, g: hg, head, loaded, spear, rope, lamp, cd: 0,
             shot: { on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), o: new THREE.Vector3(), d: 0, stuck: 0 } };
  });
}
// el Kraken (F5.29b): el calamar gigante de la playa (enemies.js buildGiantSquid) a escala scale, con más detalle, un
// OJO grande que brilla (con párpado), la boca roja con dientes en anillo, la panza (se prende con el cebo) y 8
// tentáculos que se enroscan saliendo del agua a los costados (cada uno, 3 tramos encadenados)
function buildKrakenBody() {
  const A = CONFIG.EE.arena, K = KRAKEN;
  const g = K.g = new THREE.Group(); g.userData.theme = false; K.arena.add(g);
  const body = K.body = new THREE.Group(); body.scale.setScalar(A.scale); g.add(body);
  // F5.29c (Diego: "más grande, más diseño cúbico, que dé miedo, con heridas, oscuro, con varios ojos pequeños"): piel
  // casi negra, el manto en capas de cubos (bordes irregulares, placas), cresta de púas, dos cuernos ganchudos, percebes,
  // arpones viejos clavados, heridas abiertas que chorrean y un enjambre de ojitos rojos y amarillos
  const C = 0x2a0826, D = 0x16040f, S = 0x4a1a3a, SC = 0x3a0a20, PL = 0x200618, rr = mulberry(707), r = (a, b) => a + (b - a) * rr();
  const mb = new MeshBuilder();
  for (let y = 0; y < 2.4; y += 0.2) {                                                           // manto en capas
    const k = Math.floor(y / 0.2), ind = k % 2 ? 0.04 : 0;
    // (solo hacia adentro: lo que va pegado al frente y a los costados no queda tapado)
    mb.box(0, y + 0.1, 0, 1.4 - ind - r(0, 0.06), 0.21, 1.2 - ind - r(0, 0.06), k % 3 ? C : PL);
  }
  for (let y = 2.4; y < 3.4; y += 0.2) {                                                         // cabeza: se afina
    const k = (y - 2.4) / 1.0, w = 1.05 - k * 0.5;
    mb.box(0, y + 0.1, -0.03 * k, w - r(0, 0.05), 0.21, w * 0.88 - r(0, 0.05), Math.floor(y * 5) % 2 ? C : PL);
  }
  for (let i = 0; i < 60; i++) {                                                                  // placas que sobresalen
    const y = 0.15 + rr() * 3.1, w = r(0.08, 0.24), h = r(0.06, 0.2), hw = y > 2.4 ? 0.5 - (y - 2.4) * 0.25 : 0.7, hd = y > 2.4 ? 0.44 - (y - 2.4) * 0.22 : 0.6, side = rr();
    if (side < 0.4) mb.box((rr() < 0.5 ? -1 : 1) * (hw + 0.02), y, r(-hd, hd), r(0.04, 0.09), h, w, rr() < 0.5 ? D : PL);
    else if (side < 0.8) mb.box(r(-hw, hw), y, -hd - 0.02, w, h, r(0.04, 0.09), rr() < 0.5 ? D : PL);
    else if (y < 0.35 || y > 2.5) mb.box(r(-hw * 0.8, hw * 0.8), y, hd + 0.02, w, h, 0.05, D);
  }
  for (let i = 0; i < 6; i++) mb.box(i % 2 ? 0.35 : -0.35, 0.6 + i * 0.35, 0.61, 0.25, 0.2, 0.02, S);   // ventosas del frente
  for (let i = 0; i < 8; i++) mb.box(-0.6 + (i % 4) * 0.4, 1.6 + Math.floor(i / 4) * 0.7, 0.605, 0.06, 0.4, 0.02, SC, 0, 0, 0.6);   // cicatrices
  for (let i = 0; i < 9; i++) {                                                                   // la cresta de púas
    const z = -0.42 + i * 0.1, h = 0.3 + Math.sin(i / 8 * Math.PI) * 0.35;
    mb.box(0, 3.35 + h / 2, z, 0.08, h, 0.08, D, -0.35, 0, 0);
    if (i % 2) mb.box(0, 2.9 - i * 0.25, -0.62, 0.07, 0.24, 0.12, D, 0.6, 0, 0);                   // y por la espalda
  }
  for (const s of [-1, 1]) {                                                                      // cuernos ganchudos
    let x = s * 0.4, y = 3.2, a = 0.5;
    for (let k = 0; k < 7; k++) {
      const w = 0.16 - k * 0.018;
      mb.box(x, y, 0.1, w, 0.16, w, k > 4 ? 0x8a8070 : D, 0, 0, -s * a);
      x += s * Math.sin(a) * 0.13; y += Math.cos(a) * 0.13; a += 0.28;
    }
  }
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) mb.box(s * (0.58 + k * 0.12), 2.9 - k * 0.14, -0.1, 0.12, 0.5 - k * 0.1, 0.6 - k * 0.12, D, 0, 0, s * 0.5);   // aletas
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; mb.box(Math.cos(a) * 0.62, 0.05, Math.sin(a) * 0.55, 0.3, 0.22, 0.3, D, 0, -a, 0); }   // la falda
  for (let c = 0; c < 6; c++) {                                                                   // percebes
    const sx = rr() < 0.5 ? -1 : 1, y = r(0.3, 2.2), z = r(-0.5, 0.3), back = rr() < 0.4;
    for (let i = 0; i < 6; i++) {
      const s = r(0.03, 0.06), px = back ? r(-0.5, 0.5) : sx * 0.72, pz = back ? -0.62 : z + r(-0.1, 0.1);
      mb.box(px, y + r(-0.1, 0.1), pz, s, s, s, i % 2 ? 0x6a6a5e : 0x4a4a42);
    }
  }
  for (const [x, y, z, rx, rz] of [[-0.72, 1.6, 0.1, 0, 1.0], [0.72, 1.1, -0.2, 0, -1.2], [-0.3, 2.1, -0.62, -1.1, 0.2], [0.35, 0.8, -0.62, -1.3, -0.3], [0.5, 2.7, 0.2, 0, -0.9]]) {
    // arpones viejos clavados: el palo que sale y un pedazo de cuerda
    const L = 0.55, dx = Math.sin(rz) * -1, dy = Math.cos(rz) * Math.cos(rx), dz = Math.sin(rx) * -1;
    mb.box(x + dx * L * 0.5, y + dy * L * 0.3, z + dz * L * 0.5, 0.03, L, 0.03, 0x4a3a2a, rx, 0, rz);
    mb.box(x + dx * L * 0.9, y + dy * L * 0.55 - 0.08, z + dz * L * 0.9, 0.015, 0.25, 0.015, 0x7a6a4a);
  }
  krakenPut(mb, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x12040e }), body);
  // heridas abiertas (carne viva, oscura; sin luz propia fuerte): el corte, la carne de adentro, huesos y lo que chorrea
  const wb = new MeshBuilder();
  for (const [x, y, z, w, h, rot, face] of [[-0.35, 0.95, 0.6, 0.32, 0.12, 0.5, 'f'], [0.4, 2.25, 0.6, 0.22, 0.1, -0.7, 'f'], [0.71, 1.7, 0.1, 0.4, 0.13, 0.3, 'x'],
                                            [-0.71, 0.7, -0.2, 0.36, 0.12, -0.4, 'x'], [0.1, 1.4, -0.61, 0.45, 0.14, 0.2, 'b'], [-0.2, 2.9, 0.42, 0.25, 0.09, 0.4, 'f']]) {
    const px = face === 'x' ? Math.sign(x) * 0.012 : 0, pz = face === 'f' ? 0.012 : face === 'b' ? -0.012 : 0;
    const bw = face === 'x' ? 0.02 : w, bd = face === 'x' ? w : 0.02;
    wb.box(x + px, y, z + pz, bw * 1.15, h * 1.5, bd * 1.15, 0x2a0303, 0, 0, face === 'x' ? 0 : rot);
    wb.box(x + px * 2, y, z + pz * 2, bw, h, bd, 0x6a0c0a, 0, 0, face === 'x' ? 0 : rot);
    wb.box(x + px * 3, y, z + pz * 3, bw * 0.6, h * 0.45, bd * 0.6, 0x9a1a12, 0, 0, face === 'x' ? 0 : rot);
    for (let i = 0; i < 3; i++) wb.box(x + px * 3 + (face === 'x' ? 0 : (i - 1) * w * 0.25), y, z + pz * 3 + (face === 'x' ? (i - 1) * w * 0.25 : 0),
      face === 'x' ? 0.02 : 0.02, h * 0.9, face === 'x' ? 0.02 : 0.02, 0xa89a88);                            // costillas
    for (let i = 0; i < 4; i++) {
      const dl = r(0.1, 0.35), ox = face === 'x' ? 0 : r(-w * 0.4, w * 0.4), oz = face === 'x' ? r(-w * 0.4, w * 0.4) : 0;
      wb.box(x + px * 2 + ox, y - h * 0.5 - dl / 2, z + pz * 2 + oz, 0.025, dl, 0.025, 0x4a0606);         // chorrea
    }
  }
  krakenPut(wb, new THREE.MeshBasicMaterial({ vertexColors: true }), body);
  // F5.29e: las grietas de la muerte: cubos que brillan (lava morada y naranja) pegados al cuerpo; se van prendiendo de a
  // uno mientras explota (InstancedMesh: escondidas con escala 0)
  { const n = CONFIG.EE.win.cracks, im = K.cracks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ fog: false }), n), col = new THREE.Color(), CR = [0xff7a1a, 0xffc040, 0xb05aff, 0xff3a10];
    K.crackM = [];
    for (let i = 0; i < n; i++) {
      const y = 0.2 + rr() * 3.0, head = y > 2.4, hw = head ? 0.5 - (y - 2.4) * 0.25 : 0.7, hd = head ? 0.44 - (y - 2.4) * 0.22 : 0.6;
      const side = rr(), long = r(0.18, 0.5), thin = r(0.03, 0.06), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
      if (side < 0.3) { p.set(r(-hw, hw), y, hd + 0.015); s.set(long, thin, 0.03); }
      else if (side < 0.55) { p.set(r(-hw, hw), y, -hd - 0.015); s.set(long, thin, 0.03); }
      else { p.set((rr() < 0.5 ? -1 : 1) * (hw + 0.015), y, r(-hd, hd)); s.set(0.03, thin, long); }
      q.setFromEuler(new THREE.Euler(0, 0, side < 0.55 ? r(-1.2, 1.2) : 0));
      if (side >= 0.55) q.setFromEuler(new THREE.Euler(r(-1.2, 1.2), 0, 0));
      m.compose(p, q, s); K.crackM.push(m);
      im.setMatrixAt(i, _kZero); col.setHex(CR[i % CR.length]); im.setColorAt(i, col);
    }
    im.frustumCulled = false; body.add(im); }
  // el enjambre de ojitos (brillan: rojos, ámbar y amarillo enfermo), con su cuenca oscura y la pupila
  const gl = new MeshBuilder(), EYEC = [0xff2a10, 0xffa020, 0xe8ff40, 0xff2a10];
  const eyes = [[-0.5, 2.05, 0.09], [0.48, 2.12, 0.08], [-0.58, 1.55, 0.07], [0.6, 1.6, 0.1], [-0.45, 1.22, 0.12], [0.45, 1.27, 0.11],
                [-0.62, 0.95, 0.06], [0.62, 0.88, 0.07], [-0.36, 1.48, 0.05], [0.36, 1.42, 0.06], [-0.6, 2.2, 0.05], [0.62, 2.0, 0.05]];
  const head = [[-0.3, 2.62, 0.07], [0.28, 2.66, 0.06], [-0.1, 2.85, 0.05], [0.15, 2.95, 0.05], [-0.36, 3.05, 0.04], [0.32, 2.48, 0.05]];
  const one = (x, y, z, s, i, ax) => {
    const c = EYEC[i % EYEC.length], d = ax === 'z' ? [s * 1.5, s * 1.3, 0.02] : [0.02, s * 1.3, s * 1.5], e = ax === 'z' ? [s, s * 0.8, 0.02] : [0.02, s * 0.8, s];
    gl.box(x, y, z, d[0], d[1], d[2], 0x0a0204);
    gl.box(x + (ax === 'x' ? Math.sign(x) * 0.006 : 0), y, z + (ax === 'z' ? 0.006 : 0), e[0], e[1], e[2], c);
    gl.box(x + (ax === 'x' ? Math.sign(x) * 0.012 : 0), y, z + (ax === 'z' ? 0.012 : 0), ax === 'z' ? s * 0.2 : 0.02, s * 0.7, ax === 'z' ? 0.02 : s * 0.2, 0x050102);
  };
  eyes.forEach(([x, y, s], i) => one(x, y, 0.62, s, i, 'z'));
  head.forEach(([x, y, s], i) => { const k = (y - 2.4) / 1.0; one(x, y, (1.05 - k * 0.5) * 0.44 - 0.03 * k + 0.02, s, i + 1, 'z'); });
  for (const sx of [-1, 1]) for (const [y, z, s] of [[1.9, 0.3, 0.07], [1.4, 0.4, 0.06], [2.6, 0.2, 0.05]]) one(sx * (y > 2.4 ? 0.48 : 0.715), y, z, s, Math.round(y * 3), 'x');
  krakenPut(gl, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), body);
  // la boca: garganta roja, dientes en anillo y un halo (en la fase 3 se abre: escala)
  const mouth = K.mouth = new THREE.Group(); mouth.position.set(0, 0.55, 0.62); body.add(mouth);
  const mm = new MeshBuilder();
  mm.box(0, 0, 0.005, 0.34, 0.24, 0.02, 0xff2a10); mm.box(0, 0, 0.0, 0.2, 0.12, 0.02, 0x5a0606);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; mm.box(Math.cos(a) * 0.26, Math.sin(a) * 0.2, 0.02, 0.05, 0.1, 0.03, 0xf0ead0, 0, 0, a + Math.PI / 2); }
  krakenPut(mm, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), mouth);
  K.mouthHalo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,60,20,.95)', 'rgba(255,20,0,.35)'),
    transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  K.mouthHalo.position.z = 0.05; mouth.add(K.mouthHalo);
  // el OJO: iris ámbar escalonado que brilla, pupila horizontal, brillo, halo; el párpado de piel encima
  const eye = K.eye = new THREE.Group(); eye.position.set(0, 1.86, 0.62); body.add(eye);
  const eb = new MeshBuilder(), IR = [0.2, 0.36, 0.46, 0.5, 0.5, 0.46, 0.36, 0.2];
  IR.forEach((w, i) => {
    const y = (i - 3.5) * 0.052;
    eb.box(0, y, -0.01, w + 0.08, 0.054, 0.03, 0x2a0a24);
    eb.box(0, y, 0.01, w, 0.052, 0.02, i === 0 || i === 7 ? 0xff9a10 : (i & 1) ? 0xfff060 : 0xffd030);
  });
  eb.box(0, 0, -0.025, 0.7, 0.58, 0.02, 0x3a0606);                                            // la cuenca en carne viva
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; eb.box(Math.cos(a) * 0.3, Math.sin(a) * 0.24, -0.012, 0.12, 0.012, 0.01, 0x8a1010, 0, 0, a); }   // venas
  eb.box(0, 0, 0.025, 0.3, 0.07, 0.01, 0x0a0806); eb.box(0, 0, 0.025, 0.4, 0.03, 0.01, 0x0a0806);
  eb.box(-0.12, 0.09, 0.03, 0.05, 0.04, 0.01, 0xffffff);
  krakenPut(eb, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), eye);
  K.eyeHalo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.3), new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,230,90,.9)', 'rgba(255,150,20,.3)'),
    transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  K.eyeHalo.position.z = 0.04; eye.add(K.eyeHalo);
  K.lid = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.05), new THREE.MeshLambertMaterial({ color: 0x3a0e30, emissive: 0x1a0414 }));
  K.lid.position.z = 0.05; eye.add(K.lid);
  const hit = K.eyeHit = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.44, 0.1), new THREE.MeshBasicMaterial({ visible: false }));
  hit.userData.type = 'kraken'; hit.userData.part = 'eye'; eye.add(hit);
  // el cuerpo frena las balas (sin daño)
  const bh = K.bodyHit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.4, 1.3), new THREE.MeshBasicMaterial({ visible: false }));
  bh.position.y = 1.7; bh.userData.type = 'kraken'; bh.userData.part = 'body'; body.add(bh);
  // tentáculos que se enroscan a los costados y atrás (no tapan el muelle)
  const idleMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x12040e });
  for (const deg of [80, 105, 135, 165, -80, -105, -135, -165]) {
    const a0 = deg * Math.PI / 180, root = new THREE.Group();
    root.position.set(Math.sin(a0) * 0.6, -0.15, Math.cos(a0) * 0.6); root.rotation.y = a0 - Math.PI / 2; body.add(root);
    const parts = [];
    let parent = root;
    for (let p = 0; p < 3; p++) {
      const pg = new THREE.Group(); if (p) pg.position.x = 0.9; parent.add(pg);
      const b = new MeshBuilder();
      for (let i = 0; i < 4; i++) {
        const w = 0.28 * (1 - (p * 4 + i) / 14), x = 0.12 + i * 0.22;
        b.box(x, 0, 0, 0.24, w, w, (i + p) % 2 ? C : D);
        b.box(x, -w * 0.5, 0, 0.1, 0.02, w * 0.6, 0x6a3a5a);                                // ventosa de abajo
        if (i % 2) b.box(x, w * 0.5, 0, 0.12, 0.02, w * 0.3, SC);
        else b.box(x, w * 0.55, 0, 0.04, w * 0.35, 0.04, 0xa89a88, 0, 0, -0.5);             // ganchos de hueso
      }
      krakenPut(b, idleMat, pg);
      parts.push(pg); parent = pg;
    }
    K.idle.push({ parts, ph: rr() * 6.28 });
  }
  g.position.set(A.x + A.kraken[0], -40, A.z + A.kraken[1]);
}
// los tentáculos que atacan: 4 que golpean el muelle (segs segmentos) y 2 que salen del piso (floorSegs). Todos los
// segmentos son instancias de un solo InstancedMesh (un draw call): cuerpo, cresta, manchas y dos ventosas abajo
function buildKrakenTentacles() {
  const F = CONFIG.EE.fight, K = KRAKEN;
  // F5.29c: piel oscura en capas, cresta, ganchos de hueso arriba, ventosas claras abajo y alguna herida
  const sb = new MeshBuilder(), C = 0x2a0826, D = 0x16040f, S = 0x8a4a6a, R = 0x3a0a20;
  sb.box(0, 0, 0, 1, 0.8, 1.05, C); sb.box(0, 0, 0, 1.06, 0.6, 0.5, D);
  sb.box(0, 0.42, 0, 0.45, 0.08, 1.0, D);
  sb.box(0, 0.5, 0.2, 0.08, 0.22, 0.08, 0xa89a88, -0.6, 0, 0);                                      // gancho
  sb.box(0.52, 0.05, 0.2, 0.04, 0.3, 0.3, R); sb.box(-0.52, -0.05, -0.25, 0.04, 0.25, 0.3, 0x5a0808);
  for (const s of [-1, 1]) { sb.box(0.22 * s, -0.42, s * 0.24, 0.34, 0.06, 0.34, S); sb.box(0.22 * s, -0.46, s * 0.24, 0.16, 0.02, 0.16, 0x2a0a1a); }
  // (un poco de brillo propio: oscuro, pero se le ve la forma sobre las tablas)
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x2a0a22 });
  const sm = sb.mesh(mat); scene.remove(sm);
  const n = 4 * F.segs + 2 * F.floorSegs;
  const im = K.tentIM = new THREE.InstancedMesh(sm.geometry, mat, n);
  im.frustumCulled = false; im.userData.theme = false; K.arena.add(im);
  for (let i = 0; i < n; i++) im.setMatrixAt(i, _kZero);
  // la ventosa que brilla: redonda en escalones (borde rosado, anillo ámbar, centro claro)
  // (F5.29c, Diego: "no le vi dónde tenía que disparar": más grande y con un halo que late, visible de lejos)
  const vb = new MeshBuilder();
  vb.box(0, 0, 0, 2.0, 0.35, 1.1, 0xff4a80); vb.box(0, 0, 0, 1.1, 0.35, 2.0, 0xff4a80);
  vb.box(0, 0.15, 0, 1.5, 0.35, 0.9, 0xffa020); vb.box(0, 0.15, 0, 0.9, 0.35, 1.5, 0xffa020);
  vb.box(0, 0.3, 0, 0.7, 0.3, 0.7, 0xfff0a0);
  const vm = vb.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })); scene.remove(vm);
  const haloTex = radialTex('rgba(255,200,80,.95)', 'rgba(255,90,40,.35)');
  for (let k = 0; k < 4; k++) {
    const spot = new THREE.Mesh(vm.geometry, vm.material);
    spot.visible = false; spot.userData.type = 'kraken'; spot.userData.part = 'sucker'; spot.userData.ten = k; K.arena.add(spot);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.scale.set(4, 4, 1); halo.position.y = 0.6; spot.add(halo);
    const warn = new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, 1), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0, depthWrite: false }));
    warn.visible = false; K.arena.add(warn);
    K.tents.push({ k, i0: k * F.segs, n: F.segs, spot, halo, warn, state: 'off', t: 0, hp: 0, bx: 0, bz: 0, tx: 0, tz: 0, ex: 0, ez: 0, uEdge: 0.3, boxes: [] });
  }
  for (let f = 0; f < 2; f++) {
    const warn = new THREE.Mesh(new THREE.RingGeometry(0.5, F.floorR, 20), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    warn.rotation.x = -Math.PI / 2; warn.position.y = 0.04; warn.visible = false; K.arena.add(warn);
    K.floors.push({ f, i0: 4 * F.segs + f * F.floorSegs, n: F.floorSegs, warn, state: 'off', t: 0, x: 0, z: 0 });
  }
}
// F5.29d: la granada morada en cubos (cuerpo que brilla, bandas oscuras, la tapa, la anilla); s = tamaño
function krakenGrenadeMB(b, x, y, z, s) {
  b.box(x, y, z, 0.5 * s, 0.62 * s, 0.5 * s, 0x8a2aff);
  b.box(x, y, z, 0.54 * s, 0.08 * s, 0.54 * s, 0x2a0a4a); b.box(x, y + 0.16 * s, z, 0.54 * s, 0.06 * s, 0.54 * s, 0x2a0a4a);
  b.box(x, y + 0.4 * s, z, 0.24 * s, 0.16 * s, 0.24 * s, 0x5a5a62); b.box(x + 0.14 * s, y + 0.46 * s, z, 0.04 * s, 0.14 * s, 0.14 * s, 0xe8c040);
  b.box(x, y - 0.1 * s, z + 0.26 * s, 0.2 * s, 0.2 * s, 0.02 * s, 0xf0c8ff);
}
// F5.29d: lo de la fase 3: 4 granadas moradas (en el piso, donde muere cada boss), la mesa de trabajo con 4 huecos, la
// carga (las 4 atadas: chica en la Ola y grande volando), el tablón del final y los pedazos del Kraken que vuelan
function buildKrakenPhase3() {
  const A = CONFIG.EE.arena, K = KRAKEN, g = K.arena;
  const glow = () => new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const halo = radialTex('rgba(190,110,255,.95)', 'rgba(120,40,255,.3)');
  const spr = (s, o) => { const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); h.scale.set(s, s, 1); return h; };
  for (let i = 0; i < 4; i++) {
    const og = new THREE.Group(), b = new MeshBuilder();
    krakenGrenadeMB(b, 0, 0, 0, 1);
    krakenPut(b, glow(), og); og.add(spr(2.2, 0.8));
    og.visible = false; g.add(og);
    K.orbs.push({ g: og, on: false, x: 0, z: 0 });
  }
  // la mesa: patas, tablero, la morsa, cuerda enrollada, herramientas y 4 huecos que se prenden con cada granada
  { const [tx, tz] = A.table, tg = K.table = new THREE.Group(), b = new MeshBuilder(), W = 0x5a3e24, D = 0x3a2a1a, I = 0x4a4a52;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(sx * 1.05, 0.45, sz * 0.38, 0.14, 0.9, 0.14, D);
    b.box(0, 0.94, 0, 2.4, 0.1, 1.0, W); b.box(0, 0.35, 0, 2.2, 0.06, 0.8, D);
    b.box(0.85, 1.08, -0.2, 0.3, 0.18, 0.4, I); b.box(0.85, 1.2, -0.2, 0.08, 0.08, 0.5, I);                // morsa
    for (let k = 0; k < 5; k++) b.box(-0.8, 1.0 + k * 0.035, 0.25, 0.42 - k * 0.04, 0.03, 0.42 - k * 0.04, 0xb8a878);   // cuerda
    b.box(0.2, 1.0, 0.32, 0.5, 0.03, 0.06, I); b.box(0.45, 1.01, 0.32, 0.08, 0.05, 0.12, 0x6a4a2a);        // un cuchillo
    b.box(0, 1.25, 0.45, 2.3, 0.5, 0.05, D);                                                                // el respaldo
    krakenPut(b, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x0c0804 }), tg);
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.26), new THREE.MeshBasicMaterial({ color: 0x1a0a2a, fog: false }));
      s.position.set(-0.45 + i * 0.3, 1.02, -0.15); tg.add(s); K.sockets.push(s);
    }
    tg.position.set(A.x + tx, 0, A.z + tz); g.add(tg); }
  // la carga en la Ola (chica, la dibuja la escena del arma) y la que vuela
  { const b = new MeshBuilder();
    for (let i = 0; i < 4; i++) krakenGrenadeMB(b, (i % 2 - 0.5) * 0.08, (i < 2 ? 0 : 0.08), 0, 0.15);
    b.box(0, 0.04, 0, 0.19, 0.02, 0.19, 0xb8a878); b.box(0, 0.04, 0, 0.02, 0.19, 0.19, 0xb8a878);         // la cuerda
    const m = b.mesh(glow()); scene.remove(m); K.bundle = new THREE.Group(); K.bundle.add(m); K.bundle.position.set(0, 0.07, -0.32); }
  { const b = new MeshBuilder(), cg = K.chargeM = new THREE.Group();
    for (let i = 0; i < 4; i++) krakenGrenadeMB(b, (i % 2 - 0.5) * 0.55, (i < 2 ? 0 : 0.6), 0, 1);
    b.box(0, 0.3, 0, 1.3, 0.12, 1.3, 0xb8a878); b.box(0, 0.3, 0, 0.12, 1.3, 1.3, 0xb8a878);
    krakenPut(b, glow(), cg); cg.add(spr(4, 0.9)); cg.visible = false; g.add(cg); }
  // el tablón del final (con astillas) y los pedazos que vuelan cuando explota
  { const b = new MeshBuilder(), pg = K.plank = new THREE.Group();
    b.box(0, 0, 0, 1.0, 0.14, 2.4, 0x6a4a2a); b.box(0.3, 0.02, 0.2, 0.08, 0.15, 2.2, 0x4e3420);
    b.box(-0.35, 0.02, -1.25, 0.3, 0.12, 0.3, 0x5a3e24, 0, 0.5, 0); b.box(0.2, 0.08, 0.9, 0.06, 0.04, 0.6, 0x3a2a1a);
    krakenPut(b, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x1a1008 }), pg); pg.visible = false; scene.add(pg); }
  // (F5.29e: los pedazos son carne con la grieta que brilla, de varios tamaños)
  const cm = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x1a040e });
  for (let i = 0; i < CONFIG.EE.win.chunks; i++) {
    const s = 0.9 + (i % 5) * 0.7, b = new MeshBuilder();
    b.box(0, 0, 0, s, s * 0.8, s, i % 2 ? 0x2a0826 : 0x16040f); b.box(0, s * 0.41, 0, s * 0.6, 0.05, s * 0.2, 0xff7a1a);
    b.box(s * 0.51, 0, 0, 0.05, s * 0.5, s * 0.2, 0x9a1a12);
    const m = b.mesh(cm); scene.remove(m); m.visible = false; m.matrixAutoUpdate = true; g.add(m); K.chunks.push({ m, v: new THREE.Vector3(), on: false });
  }
}
// F5.29e: el final. Bolas de fuego en cubos (pool: crecen y se apagan), el PORTAL en el cielo (3 anillos de cubos que
// giran al revés uno del otro, el remolino de cubos del medio, el centro que brilla y un halo), los rayos que suben del
// remolino al portal y las AURORAS (cintas de cubos que ondulan). Todo MeshBasic aditivo y sin niebla (de lejos se ve)
function buildKrakenFinale() {
  const K = KRAKEN, W = CONFIG.EE.win, add = (o, parent) => { o.userData.theme = false; (parent || scene).add(o); return o; };
  const glowMat = () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  K.fire = [];
  for (let i = 0; i < 14; i++) {
    const b = new MeshBuilder();
    for (let k = 0; k < 9; k++) { const a = k * 2.4, rr = 0.4 + (k % 3) * 0.25; b.box(Math.cos(a) * rr, Math.sin(k * 1.7) * 0.4, Math.sin(a) * rr, 0.6, 0.6, 0.6, k < 3 ? 0xffe0a0 : k < 6 ? 0xff7a1a : 0xb03aff); }
    const m = add(b.mesh(glowMat()), K.arena); m.visible = false; m.matrixAutoUpdate = true;
    K.fire.push({ m, t: 0, life: 0, s: 1, on: false });
  }
  const P = K.portal = add(new THREE.Group());
  K.rings = W.portal.rings.map((R, j) => {
    const b = new MeshBuilder(), n = Math.round(R * 3.2), C = [[0xb05aff, 0x7a2aff], [0xe0a0ff, 0x9a3aff], [0x5a1aff, 0xc86aff]][j];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, s = 0.9 + (i % 3) * 0.35;
      b.box(Math.cos(a) * R, Math.sin(a) * R, 0, s, s, s, i % 2 ? C[0] : C[1], 0, 0, a);
      if (i % 4 === 0) b.box(Math.cos(a) * (R + 1.2), Math.sin(a) * (R + 1.2), 0, 0.4, 0.4, 0.4, 0xffffff);   // chispas
    }
    const ring = new THREE.Group(); add(b.mesh(glowMat()), ring); P.add(ring);
    return ring;
  });
  { const b = new MeshBuilder();                                                                    // el remolino de cubos del medio
    for (let i = 0; i < 90; i++) { const u = i / 90, a = u * Math.PI * 8, R = 0.6 + u * 7.5; b.box(Math.cos(a) * R, Math.sin(a) * R, -u * 2, 0.7 - u * 0.3, 0.7 - u * 0.3, 0.7, u < 0.3 ? 0xffffff : u < 0.6 ? 0xe0a0ff : 0x9a3aff, 0, 0, a); }
    K.vortex = new THREE.Group(); add(b.mesh(glowMat()), K.vortex); P.add(K.vortex); }
  K.portalCore = add(new THREE.Mesh(new THREE.CircleGeometry(8, 24), new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,240,255,1)', 'rgba(160,80,255,.6)'),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })), P);
  K.portalCore.position.z = -0.5;
  K.portalHalo = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('rgba(190,110,255,.8)', 'rgba(110,40,255,.25)'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false })), P);
  K.portalHalo.scale.set(60, 60, 1);
  P.visible = false;
  // los rayos: columnas de cubos que suben del remolino al portal
  { const b = new MeshBuilder();
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; for (let i = 0; i < 24; i++) b.box(Math.cos(a) * 3, i * 1.9, Math.sin(a) * 3, 0.5 + (i % 3) * 0.2, 1.4, 0.5 + (i % 3) * 0.2, i % 2 ? 0xc86aff : 0x7a2aff); }
    for (let i = 0; i < 24; i++) b.box(0, i * 1.9, 0, 1.4, 1.6, 1.4, 0xf0d0ff);
    K.beams = add(b.mesh(glowMat())); K.beams.matrixAutoUpdate = true; K.beams.visible = false; }
  // las auroras: cintas de cubos (un InstancedMesh) que ondulan en el cielo
  { const A = W.aurora, n = A.ribbons * A.per, im = K.aurora = add(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), n));
    const col = new THREE.Color(), AC = [0xb05aff, 0x7a2aff, 0x3ad8ff, 0xe06aff, 0x5a3aff];
    for (let i = 0; i < n; i++) { im.setMatrixAt(i, _kZero); col.setHex(AC[Math.floor(i / A.per) % AC.length]); im.setColorAt(i, col); }
    im.frustumCulled = false; im.visible = false; }
}
// el portal, los rayos y las auroras en (x, z), con k = 0..1 (abriéndose)
function krakenPortalAt(x, z, k) {
  const K = KRAKEN, W = CONFIG.EE.win;
  K.portal.visible = k > 0; K.portal.position.set(x, W.portal.y, z); K.portal.rotation.set(W.portal.tilt, 0, 0);
  K.portal.scale.setScalar(Math.max(0.001, k));
  K.beams.visible = k > 0.3; K.beams.position.set(x, SEA.y, z);
  K.aurora.visible = k > 0; K.aurora.userData.x = x; K.aurora.userData.z = z; K.aurora.userData.k = k;
}
// gira el portal, late el centro y ondulan las auroras (también después de ganar, sobre la playa)
function updateKrakenPortal(dt, t) {
  const K = KRAKEN, W = CONFIG.EE.win;
  if (!K.portal || !K.portal.visible) return;
  K.rings.forEach((r, j) => { r.rotation.z += dt * (j % 2 ? -0.6 : 0.45) * (1 + j * 0.3); });
  K.vortex.rotation.z -= dt * 1.4;
  const p = 0.85 + 0.15 * Math.sin(t * 2.3);
  K.portalCore.scale.setScalar(p); K.portalHalo.material.opacity = 0.5 + 0.25 * Math.sin(t * 1.7);
  K.beams.material.opacity = 0.35 + 0.25 * Math.abs(Math.sin(t * 5));
  const A = W.aurora, im = K.aurora, ud = im.userData, M = K.m4, k = ud.k || 1;
  for (let r = 0; r < A.ribbons; r++) for (let i = 0; i < A.per; i++) {
    const u = i / (A.per - 1), a = r / A.ribbons * Math.PI * 2 + 0.6, span = 90;
    const x = ud.x + Math.cos(a) * (u - 0.5) * span * k, z = ud.z + Math.sin(a) * (u - 0.5) * span * k - 10;
    const y = A.y + r * 4 + Math.sin(u * 7 + t * 1.3 + r) * 4 + Math.sin(u * 17 - t * 2.1) * 1.2;
    const s = (1.6 + Math.sin(u * 11 + t * 3 + r) * 0.6) * k;
    M.makeScale(s, s * (2.2 + Math.sin(u * 5 + t + r) * 1.2), s); M.setPosition(x, y, z);
    im.setMatrixAt(r * A.per + i, M);
  }
  im.instanceMatrix.needsUpdate = true;
}
// una bola de fuego en cubos (crece y se apaga)
function krakenFireball(x, y, z, s) {
  const F = KRAKEN.fire.find(f => !f.on) || KRAKEN.fire[0];
  F.on = true; F.t = 0; F.life = 0.7 + Math.random() * 0.4; F.s = s;
  F.m.visible = true; F.m.position.set(x, y, z); F.m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
}
function updateKrakenFire(dt) {
  for (const F of KRAKEN.fire) {
    if (!F.on) continue;
    F.t += dt; const k = F.t / F.life;
    if (k >= 1) { F.on = false; F.m.visible = false; continue; }
    F.m.scale.setScalar(F.s * (0.4 + k * 1.6)); F.m.material.opacity = 1 - k * k; F.m.rotation.y += dt * 2;
  }
}
// F5.29e: un sonido para el portal: un brillo que sube (arpegio con eco) y un zumbido grave
function sfxKrakenPortal() {
  if (typeof audioOn !== 'function' || !audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  [392, 466, 587, 698, 784, 932, 1175].forEach((f, i) => { sfxTone(t + i * 0.12, 1.6, 'sine', f, f * 1.003, 0.09); sfxTone(t + i * 0.12 + 0.3, 1.2, 'triangle', f * 2, f * 2, 0.03); });
  sfxTone(t, 4, 'sawtooth', 55, 82, 0.08); sfxNoise(t, 3, 'bandpass', 2200, 0.6, 0.08);
}
// el remolino (en el mar, cerca de la playa, después de ganar) y los restos del Kraken por el mapa
function buildWhirlAndDebris() {
  const E = CONFIG.EE.win, w = KRAKEN.whirl = new THREE.Group(); w.userData.theme = false; scene.add(w);
  const b = new MeshBuilder();
  for (let k = 0; k < 220; k++) {
    const t = k / 220, a = t * Math.PI * 14, R = 1 + t * E.whirlR;
    b.box(Math.cos(a) * R, -0.05 - (1 - t) * 1.2, Math.sin(a) * R, 1.0 + t, 0.15, 0.5 + t * 0.6, t > 0.85 ? 0xd8e8f0 : k % 3 ? 0x1a3a5a : 0x2a5a7a, 0, -a, 0);
  }
  b.box(0, -1.4, 0, 2, 0.2, 2, 0x050a14);
  // (sin niebla: desde el tablón y desde la playa se ve de lejos)
  const m = b.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, fog: false })); scene.remove(m); m.matrixAutoUpdate = true; w.add(m);
  w.visible = false;
  // restos: pedazos de tentáculo con ventosas, tinta y la carne en cubos, a ras del piso
  const db = new MeshBuilder(), rr = mulberry(31337), r = (a, c) => a + (c - a) * rr(), SK = [0x5a1e4e, 0x6a2a5a, 0x4a1640];
  for (const [x, z, s] of E.debris) {
    const y = groundY(x, z), n = 3 + Math.floor(rr() * 4); let px = x, pz = z, ang = rr() * 6.28;
    for (let i = 0; i < n; i++) { const wdt = (0.7 - i * 0.08) * s; db.box(px, y + wdt * 0.4, pz, wdt, wdt * 0.8, wdt, SK[i % 3], 0, ang, 0); if (i % 2) db.box(px, y + wdt * 0.85, pz, wdt * 0.45, 0.06, wdt * 0.45, 0xd8a0c0); ang += r(-0.6, 0.6); px += Math.sin(ang) * wdt * 0.9; pz += Math.cos(ang) * wdt * 0.9; }
    for (let i = 0; i < 6; i++) db.box(x + r(-1.2, 1.2) * s, y + 0.015, z + r(-1.2, 1.2) * s, r(0.3, 0.8) * s, 0.02, r(0.3, 0.8) * s, 0x1a0a2a);   // tinta
  }
  const dm = KRAKEN.debris = db.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (dm) { dm.userData.theme = false; dm.visible = false; }
}

//--- los pasos ---
function eeOk(t) { sfxEEOk(); if (t) EE.step = Math.max(EE.step, t); }
function eeFail() { sfxEEFail(); }
// paso 1: la planta jefa muere y suelta la semilla delante de su boca, en la plancha
function eeOnPlantDeath(x, z) {
  EE.plantDead = true;
  if (EE.hasSeed) return;
  EE.seed = { x, z, y: UP.y, t: CONFIG.EE.seed.time, sunk: false, back: 0 };
}
// paso 2: la Bestia
function eeOnBeastDeath() {
  if (EE.fight) return;                                                  // (F5.29d: la del muelle es otra cosa: una granada)
  EE.beastDead = true;
  if (EE.hasSeed) eeOk(2);
}
function eeHold() { return EE.calm || !!EE.fight || !!EE.cine; }
// lo que se usa con F (sin cartel: interactState.kind 'ee')
function eeNear(room, px, pz, bd, lvl) {
  const E = CONFIG.EE;
  let best = null;
  const take = (d, target) => { if (d < bd && (!best || d < best.dist)) best = { dist: d, target }; };
  const id = room ? room.id : null;
  if (EE.seed && !EE.seed.sunk && !EE.hasSeed && id === 'R20' && lvl === 1) take(Math.hypot(px - EE.seed.x, pz - EE.seed.z) < E.seed.pick ? 0 : 99, { k: 'seed' });
  if (id === 'R16' && lvl === 0 && EE.hasSeed && EE.tele.state === 'off') {
    const t = CONFIG.BUNKER.teleporter; take(Math.hypot(px - t.x, pz - t.z) < E.tele.reach ? 0.1 : 99, { k: 'tele' });
  }
  if (id === 'R21' && EE.tele.state === 'done' && EE.trial.n < 2 && EE.trial.state !== 'hold')
    E.consoles.forEach(([x, z, l], i) => { if (l === lvl && !EE.trial.lit[i]) take(Math.hypot(px - x, pz - z) < E.use ? 0.1 : 99, { k: 'console', i }); });
  if (id === 'R21' && lvl === 0 && EE.trial.n >= 2) {
    const C = EE.cap;
    if (C.state === 'off' && C.cd <= 0) take(Math.hypot(px - E.gramo[0], pz - E.gramo[1]) < E.use ? 0.1 : 99, { k: 'gramo' });
    if (C.state === 'waiting' && C.shut <= 0) take(Math.hypot(px - E.boothConsole[0], pz - E.boothConsole[1]) < E.use ? 0.1 : 99, { k: 'booth' });
    if (C.state === 'ready' && !EE.lure) take(Math.hypot(px - E.booth.x, pz - E.booth.z) < E.use ? 0.1 : 99, { k: 'lure' });
  }
  if (id === 'R22' && lvl === 0 && EE.lure && EE.calm && SQHEAD.open && !EE.fight)
    take(Math.hypot(px - E.membrane.x, pz - E.membrane.z) < E.membrane.use ? 0.1 : 99, { k: 'membrane' });
  const F = EE.fight;
  if (F && id === 'R25') {
    // F5.29b: subirse a un cañón (F) y bajarse (F otra vez)
    if (F.mount >= 0) take(0, { k: 'dismount' });
    else KRAKEN.harps.forEach((h, i) => take(Math.hypot(px - h.sx, pz - h.sz) < E.fight.harpoonUse ? 0.1 : 99, { k: 'harpoon', i }));
    const A = E.arena; take(Math.hypot(px - (A.x + A.boat[0]), pz - (A.z + A.boat[1])) < E.fight.boatUse ? 0.1 : 99, { k: 'boat' });
    // F5.29d: la mesa: con las 4 granadas moradas, atarlas a la Ola
    if (F.phase === 3 && F.charges >= 4 && !F.loaded && !F.shot && F.chargeBack <= 0 && !F.dying)
      take(Math.hypot(px - (A.x + A.table[0]), pz - (A.z + A.table[1])) < E.fight.tableUse ? 0.1 : 99, { k: 'craft' });
  }
  return best;
}
function eeUse(t) {
  const E = CONFIG.EE;
  if (!t) return false;
  if (t.k === 'seed') { EE.hasSeed = true; EE.seed = null; EE.g.seed.visible = false; eeOk(1); if (EE.beastDead) eeOk(2); return true; }
  if (t.k === 'tele') { EE.tele.state = 'charging'; EE.tele.t = 0; EE.tele.out = 0; if (typeof sfxPowerOn === 'function') sfxPowerOn(); return true; }
  if (t.k === 'console') {
    const T = EE.trial;
    if (T.state === 'off') { T.state = 'calib'; T.t = E.calib; }
    T.lit[t.i] = true;
    if (typeof sfxPin === 'function') sfxPin();
    if (T.lit.every(Boolean)) { T.n = 1; T.state = 'hold'; T.t = E.hold; eeOk(); }
    return true;
  }
  if (t.k === 'gramo') { return eeLureSombrero(); }
  if (t.k === 'booth') { return eeCloseBooth(); }
  if (t.k === 'lure') { eeTakeLure(); return true; }
  if (t.k === 'membrane') { eeStartFight(); return true; }
  if (t.k === 'harpoon') { return krakenMount(t.i); }
  if (t.k === 'dismount') { krakenDismount(); return true; }
  if (t.k === 'craft') { return krakenCraft(); }
  if (t.k === 'boat') { if (EE.fight.boat <= 0) EE.fight.boat = E.fight.boat; return true; }
  return false;
}
// paso 5: el tocadiscos llama a un Sombrerón al claro del caparazón
function eeLureSombrero() {
  const E = CONFIG.EE, C = EE.cap;
  if (!spawnBoss('sombrero', { x: E.lureSpawn[0], z: E.lureSpawn[1] })) return false;
  const z = BOSS.pool.filter(q => q.variant === 'sombrero' && q.active && q.alive).pop();
  if (!z) return false;
  z.px = E.lureSpawn[0]; z.pz = E.lureSpawn[1]; placeRoot(z, 0);
  C.state = 'waiting'; C.boss = z; C.t = 0;
  if (typeof sfxShellRise === 'function') sfxShellRise();
  return true;
}
function eeBoothHas(z) {
  const B = CONFIG.EE.booth;
  return !!z && z.alive && Math.abs(z.px - B.x) < B.w / 2 - 0.2 && Math.abs(z.pz - B.z) < B.d / 2 - 0.2;
}
function eeCloseBooth() {
  const E = CONFIG.EE, C = EE.cap, z = C.boss;
  C.shut = E.shutTime;                                                   // las puertas se cierran y se vuelven a abrir
  if (z && eeBoothHas(z) && z.health < E.weak * z.maxHealth) {
    deactivateZombie(z);
    const i = state.zombies.indexOf(z); if (i >= 0) state.zombies.splice(i, 1);
    C.state = 'process'; C.t = E.process; C.boss = null;
    if (typeof spawnSplashFx === 'function') spawnSplashFx(E.booth.x, 1.5, E.booth.z, 0x7aff9a, 1.5);
    eeOk(5);
    return true;
  }
  eeFail();                                                              // vacía (o fuerte todavía): no lo agarra
  return true;
}
// paso 6: el cebo. Se cortan los zombies y el día se pone morado
function eeTakeLure() {
  const C = EE.cap;
  C.state = 'off'; EE.lure = true; EE.g.lure.visible = false;
  eeCalm(true);
  EE.step = Math.max(EE.step, 6);
  sfxEEReady();
}
function eeCalm(on) {
  EE.calm = on;
  if (on) {
    for (const z of state.zombies.slice()) if (!z.boss) deactivateZombie(z);
    for (let i = state.zombies.length - 1; i >= 0; i--) if (!state.zombies[i].active) state.zombies.splice(i, 1);
    NIGHT.target = 0; NIGHT.pTarget = 1;
  } else if (!EE.fight) setSky(Math.max(1, state.round));
}

//--- la pelea ---
const _kZero = new THREE.Matrix4().makeScale(0, 0, 0), _kUp = new THREE.Vector3(0, 1, 0), _kM = new THREE.Matrix4();
const _kQ = new THREE.Quaternion(), _kS = new THREE.Vector3(), _kPts = [], _kb = new THREE.Vector3(), _kSeg = { d: 0, x: 0, z: 0 };
for (let i = 0; i < 32; i++) _kPts.push(new THREE.Vector3());
function arenaPt(p) { const A = CONFIG.EE.arena; return [A.x + p[0], A.z + p[1]]; }
function krakenHome() { const A = CONFIG.EE.arena; return [A.x + A.kraken[0], A.z + A.kraken[1]]; }
// distancia del punto (px, pz) al segmento (ax, az)-(bx, bz) y el punto más cercano (objeto reusado)
function krakenSegDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  const u = L2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2)) : 0;
  _kSeg.x = ax + dx * u; _kSeg.z = az + dz * u; _kSeg.d = Math.hypot(px - _kSeg.x, pz - _kSeg.z);
  return _kSeg;
}
function eeStartFight() {
  const E = CONFIG.EE, A = E.arena;
  EE.fight = { phase: 1, t: 0, cuts: 0, eyeHits: 0, slamT: 3, floorT: 7, squidT: 6, inkT: 8, drownT: E.fight.drowned.first,
               mouthT: 0, mouthOpen: false, lunge: 0, boat: 0, flinch: 0, noWound: 0, eyeOpen: false, eyeT: 0,
               mount: -1, mountT: 0, mountFloor: false, helper: 0, helpers: 0, fails: 0,
               // F5.29d, fase 3: los bosses de las granadas (cola, los que salieron), granadas juntadas, la carga en la Ola,
               // la carga volando, cuándo vuelve a la mesa, y la muerte (explota de a poco)
               p3: null, charges: 0, loaded: false, shot: null, chargeBack: 0, dying: null };
  krakenClear();
  const [kx, kz] = krakenHome();
  KRAKEN.arena.visible = true; KRAKEN.g.position.set(kx, -40, kz); KRAKEN.g.rotation.set(0, 0, 0);
  KRAKEN.lid.scale.y = 1; KRAKEN.mouth.scale.setScalar(1);
  krakenSetHit(KRAKEN.bodyHit, true); krakenSetHit(KRAKEN.eyeHit, true);
  eeTravel(arenaPt(A.start));
  eeStorm(true);
  if (typeof sfxGiantRoar === 'function') sfxGiantRoar();
}
function eeTravel(to) {
  BUNK.fadeTo = to; PORTAL.from = null;
  startTravel('portal', undefined, CONFIG.EE.travel);
}
// F5.29b: la tormenta del muelle. El mar de la playa se esconde (el del muelle lo reemplaza), noche, y la cámara ve
// hasta la niebla de la tormenta (weatherFogFar la usa: eeFogFar). Al terminar, vuelve todo
function eeStorm(on) {
  const S = typeof THEMEFX !== 'undefined' ? THEMEFX.sea : null, ST = CONFIG.EE.storm;
  EE.storm = on;
  if (S) for (const m of [S.far, S.near, S.foam, S.vox]) if (m) m.visible = !on;
  // las antorchas del muelle: arriba en la pelea, bajo el agua fuera de ella (se reescribe todo el fuego una vez: de
  // lejos updateVoxFire no las toca)
  if (KRAKEN.fires) { for (const F of KRAKEN.fires) F.y = on ? F.y0 : -100; if (typeof updateVoxFire === 'function') updateVoxFire(clock.elapsedTime, true); }
  if (on) {
    NIGHT.target = ST.night; NIGHT.pTarget = 0; NIGHT.dirty = true;
    if (typeof camera !== 'undefined' && camera && camera.far < ST.fogFar + 4) { camera.far = ST.fogFar + 4; if (camera.updateProjectionMatrix) camera.updateProjectionMatrix(); }
  } else if (typeof setFog === 'function' && typeof SETTINGS !== 'undefined') setFog(SETTINGS.fog);
}
// (también en el tablón de la cinemática: al mirar para atrás se tiene que ver el remolino)
function eeFogFar() { return EE.storm || (EE.cine && EE.cine.stage === 'swim') ? CONFIG.EE.storm.fogFar : 0; }
function krakenTentOff(T) {
  T.state = 'off'; T.t = 0; T.spot.visible = false; T.warn.visible = false;
  krakenSetHit(T.spot, false); krakenTentCols(T, false);
  krakenHideSegs(T.i0, T.n);
}
function krakenFloorOff(L) {
  L.state = 'off'; L.t = 0; L.warn.visible = false;
  const c = KRAKEN.cols[4 * CONFIG.EE.fight.boxes + L.f];
  if (c && c.solid) { c.solid = false; COLHASH.dirty = true; }
  krakenHideSegs(L.i0, L.n);
}
function krakenHideSegs(i0, n) {
  const im = KRAKEN.tentIM;
  for (let i = 0; i < n; i++) im.setMatrixAt(i0 + i, _kZero);
  im.instanceMatrix.needsUpdate = true;
}
function krakenSetHit(m, on) {
  const i = WORLD.hitMeshes.indexOf(m);
  if (on && i < 0) WORLD.hitMeshes.push(m);
  if (!on && i >= 0) WORLD.hitMeshes.splice(i, 1);
}
// los colliders del tentáculo apoyado (cajas de slamW de medio ancho a lo largo, del borde del muelle a la punta)
function krakenTentCols(T, on) {
  const F = CONFIG.EE.fight, cols = KRAKEN.cols;
  let changed = false;
  for (let i = 0; i < F.boxes; i++) {
    const c = cols[T.k * F.boxes + i];
    if (!c) continue;
    const b = on && i < T.boxes.length ? T.boxes[i] : null;
    if (b) { c.minX = b[0] - F.slamW; c.maxX = b[0] + F.slamW; c.minZ = b[1] - F.slamW; c.maxZ = b[1] + F.slamW; c.solid = true; changed = true; }
    else if (c.solid) { c.solid = false; changed = true; }
  }
  if (changed) COLHASH.dirty = true;
}
// una bala o una explosión en el Kraken: part = sucker | eye | body
function krakenHit(obj, dmg, blast) {
  const F = EE.fight;
  if (!F || !obj || !(dmg > 0)) return false;
  const part = obj.userData.part;
  if (part === 'sucker') {
    const T = KRAKEN.tents[obj.userData.ten];
    if (!T || T.state !== 'down' || F.phase !== 1) return false;
    T.hp -= dmg;
    const now = clock.elapsedTime;
    if (!(now - (F.weakT || -9) < 0.12)) { F.weakT = now; sfxKrakenWeak(); }
    if (T.hp <= 0) krakenCut(T);
    return true;
  }
  // el ojo y el cuerpo frenan las balas (sin daño: el ojo, con los arpones; la muerte, con la carga de la Ola)
  return part === 'eye' || part === 'body';
}
function krakenCut(T) {
  const F = EE.fight;
  T.state = 'cut'; T.t = 0; T.spot.visible = false; krakenSetHit(T.spot, false); krakenTentCols(T, false);
  F.cuts++;
  if (typeof spawnSplashFx === 'function') spawnSplashFx(T.spot.position.x, T.spot.position.y, T.spot.position.z, 0x9a3aff, 2.4);
  if (typeof sfxGiantRoar === 'function') sfxGiantRoar();
  addTrauma(0.35);
  if (F.cuts >= CONFIG.EE.fight.cuts && F.phase === 1) krakenPhase(2);
}
// explosiones (granadas, la Ray Gun, cohetes) cerca de una ventosa
function krakenBlast(x, y, z, dmg, R) {
  if (!EE.fight) return 0;
  let n = 0;
  const v = KRAKEN.v;
  for (const T of KRAKEN.tents) if (T.state === 'down' && T.spot.visible) { T.spot.getWorldPosition(v); if (v.distanceTo(_kb.set(x, y, z)) < R + 0.8) { krakenHit(T.spot, dmg, true); n++; } }
  return n;
}
// una fase cumplida: ruge, se recogen los tentáculos, suena el paso cumplido y sale un boss del mar
function krakenPhase(n) {
  const F = EE.fight;
  F.phase = n; F.flinch = 1.2; F.slamT = 5;
  for (const T of KRAKEN.tents) if (T.state === 'warn' || T.state === 'fall' || T.state === 'down') { T.state = 'up'; T.t = 0; T.warn.visible = false; T.spot.visible = false; krakenSetHit(T.spot, false); krakenTentCols(T, false); }
  if (typeof sfxGiantRoar === 'function') sfxGiantRoar();
  addTrauma(0.5);
  eeOk();
  // F5.29c (Diego): un Max Ammo en el medio del muelle por cada fase cumplida
  const A = CONFIG.EE.arena;
  if (typeof trySpawnPickup === 'function') trySpawnPickup(A.x + A.ammo[0], A.z + A.ammo[1], 'maxammo');
  if (n === 3) {
    // F5.29d: la fase 3. Los ayudantes que quedaban se hunden (los que importan ahora son los de las granadas) y empieza
    // la cola de bosses: cada uno suelta una granada morada
    F.mouthT = 2;
    for (const z of BOSS.pool) if (z.active && z.alive && z.variant !== 'bestia' && inArena(z.px, z.pz)) { deactivateZombie(z); if (typeof spawnSplashFx === 'function') spawnSplashFx(z.px, 0.3, z.pz, 0x9fd4e6, 2); }
    for (let i = state.zombies.length - 1; i >= 0; i--) if (!state.zombies[i].active) state.zombies.splice(i, 1);
    F.p3 = { queue: CONFIG.EE.fight.p3Bosses.slice(), t: 2, refs: [] };
  } else krakenHelper();
}
// un paso fallado en la pelea (arpón errado, la carga de la Ola errada): el sonido de fallo y sale un boss del mar (en
// la fase 3, ahogados: los bosses de esa fase son los de las granadas)
function krakenFail() {
  const F = EE.fight;
  if (!F) return;
  F.fails++;
  eeFail();
  krakenHelper();
}
// un lugar del borde del muelle (por donde suben los del mar), a más de minD m de vos
function krakenEdgeSpot(minD, maxD) {
  const E = KRAKEN.edges, P = player.pos;
  if (!E.length) return null;
  for (let k = 0; k < 16; k++) {
    const c = E[Math.floor(Math.random() * E.length)], d = Math.hypot(c[0] - P.x, c[1] - P.z);
    if (d > minD && d < (maxD || 99)) return c;
  }
  return null;
}
// los ahogados suben al muelle por el borde
function krakenDrowned(n) {
  const FC = CONFIG.EE.fight;
  let made = 0;
  for (let k = 0; k < n; k++) {
    const z = ZPOOL.find(q => !q.active), sp = krakenEdgeSpot(FC.drowned.minDist, 30);
    if (!z || !sp) break;
    resetZombie(z, { x: sp[0], z: sp[1] }, false, 'drowned');
    state.zombies.push(z); made++;
    if (typeof spawnSplashFx === 'function') spawnSplashFx(sp[0], 0.2, sp[1], 0x9fd4e6, 1.2);
  }
  return made;
}
// un boss que sale del mar (Sombrerón o Calamarón, en orden); si ya hay helpersMax vivos, una tanda de ahogados
function krakenHelper() {
  const FC = CONFIG.EE.fight, F = EE.fight;
  if (!F) return;
  const alive = BOSS.pool.filter(z => z.active && z.alive && z.variant !== 'bestia').length;
  const sp = alive < FC.helpersMax && F.phase < 3 ? krakenEdgeSpot(9, 26) : null;
  if (sp) {
    const v = FC.helpers[F.helper % FC.helpers.length];
    const was = BOSS.pool.filter(z => z.active).length;
    if (spawnBoss(v, { x: sp[0], z: sp[1] }) && BOSS.pool.filter(z => z.active).length > was) {
      F.helper++; F.helpers++;
      if (typeof spawnSplashFx === 'function') spawnSplashFx(sp[0], 0.4, sp[1], 0x9fd4e6, 2.5);
      lightning();
      return;
    }
  }
  krakenDrowned(FC.helperDrowned);
}
// F5.29d, fase 3: el próximo boss de las granadas sale del mar (la Bestia, con su propia función: beast.js)
function krakenP3Spawn(v) {
  const sp = krakenEdgeSpot(9, 28);
  if (!sp) return null;
  let z = null;
  if (v === 'bestia') { const was = BEAST.phase; if (beastAwakeAt(sp[0], sp[1])) { z = BEAST.z; EE.fight.beastWas = was; } }
  else {
    const before = BOSS.pool.filter(q => q.variant === v && q.active);
    if (spawnBoss(v, { x: sp[0], z: sp[1] })) z = BOSS.pool.find(q => q.variant === v && q.active && q.alive && before.indexOf(q) < 0) || null;
  }
  if (z) { if (typeof spawnSplashFx === 'function') spawnSplashFx(sp[0], 0.4, sp[1], 0x9fd4e6, 3); lightning(); }
  return z;
}
// la granada morada cae donde murió el boss
function krakenDropOrb(x, z) {
  const O = KRAKEN.orbs.find(o => !o.on);
  if (!O) return;
  O.on = true; O.x = x; O.z = z; O.g.visible = true; O.g.position.set(x, 0.6, z); O.fly = null;
  // F5.29e (Diego: "que no puedan caer afuera del muelle; si es así, que floten hasta el frente de la mesa"): si el boss
  // murió en el agua (o pegado a la baranda), la granada vuela flotando hasta delante de la mesa
  const A = CONFIG.EE.arena;
  if (!inArena(x, z) || !inArena(x + 0.6, z) || !inArena(x - 0.6, z) || !inArena(x, z + 0.6) || !inArena(x, z - 0.6)) {
    const i = KRAKEN.orbs.indexOf(O);
    O.fly = { tx: A.x + A.table[0] - 0.9 + i * 0.6, tz: A.z + A.table[1] - 1.6 };
  }
  if (typeof spawnSplashFx === 'function') spawnSplashFx(x, 0.8, z, 0x9a3aff, 1.6);
}
// en la mesa: las 4 granadas atadas a la Ola Rompiente (si no la tenés, la mesa te la da) y la Ola en la mano
function krakenCraft() {
  const F = EE.fight;
  if (!F || F.phase !== 3 || F.charges < 4 || F.loaded || F.shot) return false;
  if (!state.weapons.some(w => w.id === 'wave')) giveWeapon('wave');
  const i = state.weapons.findIndex(w => w.id === 'wave');
  if (i >= 0 && i !== state.currentWeapon) { state.currentWeapon = i; equipModel(slotDef(state.weapons[i])); raiseWeapon(); if (typeof updateAmmoHUD === 'function') updateAmmoHUD(); }
  F.loaded = true;
  if (typeof sfxShieldTake === 'function') sfxShieldTake();
  addTrauma(0.15);
  return true;
}
// fireWeapon: con la carga atada y la Ola en la mano, el clic tira la carga (vuela en arco)
function eeChargeFire() {
  const F = EE.fight;
  if (!F || !F.loaded || F.dying) return false;
  const s = curSlot();
  if (!s || s.id !== 'wave' || weaponsState.phase !== 'idle') return false;
  const FC = CONFIG.EE.fight, e = feel.eye || camera.position, d = new THREE.Vector3(0, 0, -1).applyQuaternion(feel.aimQuat || camera.quaternion);
  F.shot = { p: new THREE.Vector3(e.x + d.x, e.y - 0.2 + d.y, e.z + d.z), v: d.multiplyScalar(FC.chargeSpeed), t: 0 };
  F.loaded = false;
  KRAKEN.chargeM.visible = true;
  addTrauma(0.35);
  if (typeof sfxHarpoon === 'function') sfxHarpoon();
  return true;
}
// le entró la carga en la boca: grita y explota de a poco; después la cinemática
function krakenDying() {
  const F = EE.fight;
  F.dying = true; F.charges = 0; F.mouthOpen = true; F.mouthT = 99;
  if (typeof sfxGiantRoar === 'function') sfxGiantRoar();
  if (typeof sfxBossRoar === 'function') sfxBossRoar();
  addTrauma(0.8);
  krakenWin();                                                           // (F5.29e: la cinemática arranca acá)
}
function krakenSquid() {
  const E = CONFIG.EE;
  if (state.zombies.filter(q => q.squid && q.alive).length >= E.fight.squidMax) return;
  const z = SQPOOL.find(q => !q.active), sp = krakenEdgeSpot(6, 28);
  if (!z || !sp) return;
  resetZombie(z, { x: sp[0], z: sp[1] }, false);
  state.zombies.push(z);
  if (typeof spawnSplashFx === 'function') spawnSplashFx(sp[0], 0.2, sp[1], 0x9fd4e6, 1.2);
}
// un golpe: la punta donde estás (y reach m más allá), la base en el agua delante del Kraken; dónde entra al muelle y
// las cajas sólidas hasta la punta; la franja roja de aviso
function krakenSlam(T) {
  const F = CONFIG.EE.fight, P = player.pos, [kx, kz] = krakenHome();
  const tx = P.x + (Math.random() - 0.5) * 1.5, tz = P.z + (Math.random() - 0.5) * 1.5;
  const a = Math.atan2(tx - kx, tz - kz) + (Math.random() - 0.5) * 0.5;
  const br = CONFIG.EE.arena.scale * 0.85;                                     // (la base, en el agua al pie del Kraken)
  T.bx = kx + Math.sin(a) * br; T.bz = kz + Math.cos(a) * br;
  let dx = tx - T.bx, dz = tz - T.bz;
  const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
  T.tx = tx + dx * F.reach; T.tz = tz + dz * F.reach;
  const LL = L + F.reach;
  let s0 = LL;
  for (let s = 0; s <= LL; s += 0.5) if (inArena(T.bx + dx * s, T.bz + dz * s)) { s0 = s; break; }
  T.uEdge = Math.max(0.05, Math.min(0.95, s0 / LL));
  T.ex = T.bx + dx * s0; T.ez = T.bz + dz * s0;
  T.boxes.length = 0;
  for (let s = LL; s >= s0 - 0.01 && T.boxes.length < F.boxes; s -= F.boxStep) T.boxes.push([T.bx + dx * s, T.bz + dz * s]);
  const on = Math.max(1, LL - s0), w = T.warn;
  w.visible = true; w.material.opacity = 0;
  w.position.set((T.ex + T.tx) / 2, 0.05, (T.ez + T.tz) / 2); w.scale.set(F.slamW * 2, 1, on); w.rotation.y = Math.atan2(dx, dz);
  T.state = 'warn'; T.t = 0; T.hp = F.suckerHP;
  // F5.29d (Diego: "entre 1 y 4 tentáculos que salga la herida"): solo algunos traen la herida; a lo sumo woundMax
  // seguidos sin ella (el último seguro la trae)
  const FG = EE.fight;
  T.wound = !!FG && FG.phase === 1 && (Math.random() < F.woundChance || FG.noWound >= F.woundMax - 1);
  if (FG) FG.noWound = T.wound ? 0 : FG.noWound + 1;
}
// cae: si te agarra, slamDmg y te corre de costado; los zombies de abajo se aplastan; queda apoyado y sólido
function krakenImpact(T) {
  const FC = CONFIG.EE.fight, P = player.pos, F = EE.fight, R = CONFIG.PLAYER.radius;
  T.state = 'down'; T.t = 0; T.warn.visible = false;
  // (las cajas son cuadradas: en diagonal, sus esquinas llegan a slamW·√2 de la línea; el golpe cubre todo eso, así
  // nadie queda metido en una caja que se prende)
  const W = FC.slamW * 1.42, d = krakenSegDist(P.x, P.z, T.ex, T.ez, T.tx, T.tz);
  if (d.d < W + R && P.y - CONFIG.PLAYER.height < 2) {
    const cx = d.x, cz = d.z;
    let nx = P.x - cx, nz = P.z - cz, nl = Math.hypot(nx, nz);
    if (nl < 1e-3) { nx = -(T.tz - T.ez); nz = T.tx - T.ex; nl = Math.hypot(nx, nz) || 1; }
    nx /= nl; nz /= nl;
    const out = W + R + 0.05;
    if (!inArena(cx + nx * out, cz + nz * out)) { nx = -nx; nz = -nz; }
    if (inArena(cx + nx * out, cz + nz * out)) { P.x = cx + nx * out; P.z = cz + nz * out; }
    damagePlayer(FC.slamDmg, T.bx, T.bz, false, 'kraken');
    const pt = CONFIG.BOSS.pushTime;
    player.pushX = nx * FC.push / pt; player.pushZ = nz * FC.push / pt; player.pushT = pt;
    krakenDismount();
  }
  for (const z of state.zombies.slice()) if (z.alive && !z.boss && krakenSegDist(z.px, z.pz, T.ex, T.ez, T.tx, T.tz).d < W + 0.35) damageZombie(z, 1e9, false, 0, 0);
  krakenTentCols(T, true);
  if (typeof spawnSplashFx === 'function') { spawnSplashFx(T.tx, 0.6, T.tz, 0x8a6a4a, 2.2); spawnSplashFx(T.ex, 0.3, T.ez, 0x9fd4e6, 3); }
  addTrauma(Math.max(0.15, 0.6 - d.d * 0.04));
  sfxKrakenSlam();
  if (F.phase === 1 && T.wound) { T.spot.visible = true; krakenSetHit(T.spot, true); }
}
// la pose del tentáculo que golpea. mode: 0 sale del agua y se levanta (k), 1 cae (k), 2 apoyado, 3 se va al agua (k)
function krakenTentPose(T, mode, k, t) {
  const F = CONFIG.EE.fight, n = T.n, pts = _kPts, [w0, w1] = F.thick;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), deckY = (w0 + (w1 - w0) * u) * 0.36;               // (apoyado sobre las tablas, un poco hundido)
    const fx = T.bx + (T.tx - T.bx) * u, fz = T.bz + (T.tz - T.bz) * u;
    const fy = u < T.uEdge ? -2.4 + (2.4 + deckY) * (u / T.uEdge) : deckY;
    const ru = u * 0.72, rx = T.bx + (T.tx - T.bx) * ru, rz = T.bz + (T.tz - T.bz) * ru;
    const ry = -2 + F.lift * Math.sin(Math.PI * 0.5 * Math.min(1, u * 1.15)) - (u > 0.85 ? (u - 0.85) * 22 : 0) + Math.sin(t * 3 + u * 6) * 0.7 * u;
    const sx = T.bx + (T.tx - T.bx) * u * 0.25, sz = T.bz + (T.tz - T.bz) * u * 0.25, sy = -10 + u * 3;
    let x, y, z;
    if (mode === 0) { x = sx + (rx - sx) * k; y = sy + (ry - sy) * k; z = sz + (rz - sz) * k; }
    else if (mode === 1) { x = rx + (fx - rx) * k; y = ry + (fy - ry) * k; z = rz + (fz - rz) * k; }
    else if (mode === 2) { x = fx; y = fy + (u > T.uEdge ? Math.sin(t * 5 + u * 9) * 0.05 : 0); z = fz; }
    else { x = fx + (sx - fx) * k; y = fy + (sy - fy) * k; z = fz + (sz - fz) * k; }
    pts[i].set(x, y, z);
  }
  krakenSegs(T.i0, n, w0, w1);
  // la ventosa que brilla (fase 1): arriba del tramo apoyado, y el halo que late
  if (T.state === 'down' && T.spot.visible) {
    const u = 0.72, j = Math.round((n - 1) * u), p = pts[j], s = 1 + 0.15 * Math.sin(t * 8), w = w0 + (w1 - w0) * u;
    T.spot.position.set(p.x, p.y + w * 0.43 + 0.1, p.z); T.spot.scale.set(s, 1, s);
    T.halo.material.opacity = 0.5 + 0.45 * Math.abs(Math.sin(t * 4));
  }
}
// escribe los segmentos de _kPts[0..n) en el InstancedMesh: cada uno mira al siguiente y se afina hacia la punta
function krakenSegs(i0, n, w0, w1) {
  const im = KRAKEN.tentIM, pts = _kPts;
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[Math.min(n - 1, i + 1)], pr = pts[Math.max(0, i - 1)];
    const len = Math.max(0.3, i < n - 1 ? p.distanceTo(q) : p.distanceTo(pr)) * 1.2;
    const w = w0 + (w1 - w0) * (i / (n - 1));
    if (i < n - 1) _kM.lookAt(q, p, _kUp); else _kM.lookAt(p, pr, _kUp);
    _kQ.setFromRotationMatrix(_kM);
    _kM.compose(p, _kQ, _kS.set(w, w * 0.85, len));
    im.setMatrixAt(i0 + i, _kM);
  }
  im.instanceMatrix.needsUpdate = true;
}
// el tentáculo que sale del piso: aviso (las tablas se rajan), sale, queda parado (sólido) y se va
function krakenFloor(L, x, z) {
  L.state = 'warn'; L.t = 0; L.x = x; L.z = z;
  L.warn.visible = true; L.warn.position.x = x; L.warn.position.z = z; L.warn.material.opacity = 0;
  sfxKrakenCrack();
}
function krakenFloorBurst(L) {
  const FC = CONFIG.EE.fight, P = player.pos, A = CONFIG.EE.arena;
  L.state = 'rise'; L.t = 0; L.warn.visible = false;
  const d = Math.hypot(P.x - L.x, P.z - L.z);
  if (d < FC.floorR + CONFIG.PLAYER.radius && P.y - CONFIG.PLAYER.height < 2) {
    // te tira lejos: hacia afuera del tentáculo; si saliste justo encima (el asiento del cañón), hacia el medio del muelle
    let nx = P.x - L.x, nz = P.z - L.z, nl = Math.hypot(nx, nz);
    if (nl < 0.2) { nx = A.x + A.start[0] - L.x; nz = A.z + A.start[1] - L.z; nl = Math.hypot(nx, nz) || 1; }   // (F5.29e: el medio de la barra)
    nx /= nl; nz /= nl;
    damagePlayer(FC.floorDmg, L.x, L.z, false, 'kraken');
    const pt = CONFIG.BOSS.pushTime;
    player.pushX = nx * FC.floorPush / pt; player.pushZ = nz * FC.floorPush / pt; player.pushT = pt;
    player.vel.y = 6; player.grounded = false;
    krakenDismount();
  }
  for (const z of state.zombies.slice()) if (z.alive && !z.boss && Math.hypot(z.px - L.x, z.pz - L.z) < FC.floorR) damageZombie(z, 1e9, false, 0, 0);
  const c = KRAKEN.cols[4 * FC.boxes + L.f];
  if (c) { c.minX = L.x - 0.7; c.maxX = L.x + 0.7; c.minZ = L.z - 0.7; c.maxZ = L.z + 0.7; c.solid = true; COLHASH.dirty = true; }
  if (typeof spawnSplashFx === 'function') { spawnSplashFx(L.x, 0.4, L.z, 0x6a4a2a, 2); spawnSplashFx(L.x, 0.2, L.z, 0x9fd4e6, 1.4); }
  addTrauma(0.45);
  if (typeof sfxBossSlam === 'function') sfxBossSlam();
}
function krakenFloorPose(L, k, t) {
  const n = L.n, pts = _kPts;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    pts[i].set(L.x + Math.sin(t * 3 + u * 4) * 0.5 * u * k + (u > 0.75 ? (u - 0.75) * 4 * k : 0),
               -3 + (3 + 5.5 * u) * k - (u > 0.85 ? (u - 0.85) * 6 * k : 0),
               L.z + Math.cos(t * 2.4 + u * 3) * 0.4 * u * k);
  }
  krakenSegs(L.i0, n, CONFIG.EE.fight.floorThick[0], CONFIG.EE.fight.floorThick[1]);
}
// F5.29b: los cañones de arpones. F al lado del asiento te sube (quedás quieto y el arma se guarda); el clic dispara
// (weapons.js fireWeapon llama a eeMountFire); F o saltar te baja
// (F5.29d: también durante la cinemática del final: quieto y sin el arma)
function eeMounted() { return (!!EE.fight && EE.fight.mount >= 0) || !!EE.cine; }
function krakenMount(i) {
  const F = EE.fight, H = KRAKEN.harps[i];
  if (!F || !H) return false;
  F.mount = i; F.mountT = 0; F.mountFloor = false;
  player.pos.x = H.sx; player.pos.z = H.sz; player.vel.set(0, 0, 0);
  if (typeof sfxLever === 'function') sfxLever();
  return true;
}
function krakenDismount() {
  const F = EE.fight;
  if (!F || F.mount < 0) return;
  F.mount = -1; F.mountT = 0; F.mountFloor = false;
}
function eeMountFire() {
  const F = EE.fight;
  if (!F || F.mount < 0) return false;
  const H = KRAKEN.harps[F.mount], FC = CONFIG.EE.fight, S = H.shot;
  if (H.cd > 0 || S.on) { if (typeof sfxDry === 'function') sfxDry(); return true; }
  S.v.set(0, 0, -1).applyQuaternion(feel.aimQuat || camera.quaternion).normalize();
  if (feel.aimQuat) H.head.quaternion.copy(feel.aimQuat);
  H.head.updateWorldMatrix(true, false);
  S.o.set(0, 0, -1.9).applyMatrix4(H.head.matrixWorld); S.p.copy(S.o);
  S.v.multiplyScalar(FC.harpoonSpeed); S.on = true; S.d = 0; S.stuck = 0;
  H.loaded.visible = false; H.cd = FC.harpoonReload; H.spear.visible = true; H.rope.visible = true;
  addTrauma(0.25); sfxHarpoon();
  return true;
}
// el arpón en vuelo: si la línea pasa por el ojo abierto, cuenta; si pega en el cuerpo o se pierde en el mar (en la
// fase 2), es un fallo
function krakenShotStep(H, dt) {
  const F = EE.fight, FC = CONFIG.EE.fight, S = H.shot, K = KRAKEN, e = K.v, p0 = K.v2;
  if (S.stuck > 0) {
    S.stuck -= dt;
    if (S.stuck <= 0) { S.on = false; H.spear.visible = false; H.rope.visible = false; return; }
  } else {
    p0.copy(S.p); S.p.addScaledVector(S.v, dt); S.d += S.v.length() * dt;
    K.eye.getWorldPosition(e);
    // el punto del tramo p0-p más cercano al ojo
    const dx = S.p.x - p0.x, dy = S.p.y - p0.y, dz = S.p.z - p0.z, L2 = dx * dx + dy * dy + dz * dz;
    const u = L2 > 0 ? Math.max(0, Math.min(1, ((e.x - p0.x) * dx + (e.y - p0.y) * dy + (e.z - p0.z) * dz) / L2)) : 0;
    const dEye = Math.hypot(p0.x + dx * u - e.x, p0.y + dy * u - e.y, p0.z + dz * u - e.z);
    const g = K.g.position, sc = CONFIG.EE.arena.scale;
    const inBody = Math.hypot(S.p.x - g.x, S.p.z - g.z) < 0.72 * sc && S.p.y > g.y && S.p.y < g.y + 3.4 * sc;
    if (dEye < FC.eyeR) {
      S.stuck = FC.flinch; S.p.set(p0.x + dx * u, p0.y + dy * u, p0.z + dz * u);
      if (F.phase === 2 && F.flinch <= 0 && F.eyeOpen) {
        // (F5.29d: si le pegás, te baja del cañón)
        F.eyeHits++; F.flinch = FC.flinch; F.eyeOpen = false; F.eyeT = FC.eyeClosed; addTrauma(0.5); sfxKrakenWeak();
        if (F.mount === K.harps.indexOf(H)) krakenDismount();
        if (typeof spawnSplashFx === 'function') spawnSplashFx(e.x, e.y, e.z, 0xffd040, 3);
        if (typeof sfxGiantRoar === 'function') sfxGiantRoar();
        if (F.eyeHits >= FC.eyeHits) krakenPhase(3);
      } else if (typeof sfxShieldHit === 'function') sfxShieldHit();         // el párpado: rebota
    } else if (inBody) {
      S.stuck = 1.5;
      if (typeof spawnSplashFx === 'function') spawnSplashFx(S.p.x, S.p.y, S.p.z, 0x9a3aff, 1.5);
      if (F.phase === 2) krakenFail();
    } else if (S.d > FC.harpoonRange || S.p.y < CONFIG.EE.storm.seaY) {
      S.on = false; H.spear.visible = false; H.rope.visible = false;
      if (typeof spawnSplashFx === 'function' && S.p.y < CONFIG.EE.storm.seaY + 1) spawnSplashFx(S.p.x, CONFIG.EE.storm.seaY, S.p.z, 0x9fd4e6, 1.5);
      if (F.phase === 2) krakenFail();
      return;
    }
  }
  H.spear.position.copy(S.p);
  H.spear.lookAt(S.p.x - S.v.x, S.p.y - S.v.y, S.p.z - S.v.z);
  // la cuerda: de la boca del cañón al arpón
  H.head.updateWorldMatrix(true, false);
  e.set(0, 0, -1.9).applyMatrix4(H.head.matrixWorld);
  const len = e.distanceTo(S.p);
  H.rope.position.set((e.x + S.p.x) / 2, (e.y + S.p.y) / 2, (e.z + S.p.z) / 2);
  H.rope.scale.set(1, 1, Math.max(0.01, len)); H.rope.lookAt(S.p);
}
function krakenMouth(out) { KRAKEN.g.updateMatrixWorld(true); return KRAKEN.mouth.getWorldPosition(out); }
// saca del muelle todo lo de la pelea: tentáculos, arpones, granadas, la carga, y los ahogados, calamarcitos y bosses de
// la arena (la Bestia, si salió en el muelle, vuelve a como estaba: dormida en el búnker o muerta)
function krakenClear() {
  const K = KRAKEN;
  for (const T of K.tents) krakenTentOff(T);
  for (const L of K.floors) krakenFloorOff(L);
  for (const H of K.harps) { H.shot.on = false; H.spear.visible = false; H.rope.visible = false; H.loaded.visible = true; H.cd = 0; }
  krakenSetHit(K.eyeHit, false); krakenSetHit(K.bodyHit, false);
  for (const O of K.orbs) { O.on = false; O.g.visible = false; }
  if (K.bundle && K.bundle.parent) K.bundle.parent.remove(K.bundle);
  if (K.chargeM) K.chargeM.visible = false;
  for (const C of K.chunks) { C.on = false; C.m.visible = false; }
  for (const z of state.zombies.slice()) if (z.active && z.variant !== 'bestia' && inArena(z.px, z.pz)) deactivateZombie(z);
  if (typeof BEAST !== 'undefined' && BEAST.away && BEAST.z) {
    deactivateZombie(BEAST.z); BEAST.away = false;
    if (EE.fight && EE.fight.beastWas === 'sleep') { BEAST.z.root.visible = false; sleepBeast(); } else BEAST.phase = 'dead';
  }
  for (let i = state.zombies.length - 1; i >= 0; i--) if (!state.zombies[i].active) state.zombies.splice(i, 1);
  if (typeof UI !== 'undefined' && UI.boss && UI.boss.style) UI.boss.style.display = 'none';
}
// ganar (F5.29e): la cinemática, en 4 tomas (EE.cine.stage):
//  blast: la cámara da la vuelta alrededor del Kraken mientras explota de a poco (cada vez más seguido): bolas de fuego en
//         cubos, grietas que se prenden, pedazos que saltan, el ojo que se apaga, se sacude y se va hundiendo;
//  boom:  la gran explosión (vuelan los pedazos grandes, relámpago) y se va al fondo;
//  whirl: desde arriba: el remolino se abre y se lo traga; la cámara sube la vista al cielo, donde se abre el PORTAL
//         cúbico morado con las auroras y los rayos que suben del remolino;
//  swim:  el tablón hacia la playa (mirás para atrás un momento: el remolino y el portal).
function krakenWin() {
  const F = EE.fight;
  if (!F || EE.cine) return;
  const [kx, kz] = krakenHome();
  EE.cine = { t: 0, stage: 'blast', x: player.pos.x, y: player.pos.y, z: player.pos.z, boom: false, sx: 0, sz: 0, next: 0,
              a0: Math.atan2(player.pos.x - kx, player.pos.z - kz), cracks: 0 };
  krakenDismount();
  krakenClear();
  KRAKEN.whirl.position.set(kx, CONFIG.EE.storm.seaY + 0.1, kz); KRAKEN.whirl.scale.setScalar(0.01); KRAKEN.whirl.visible = false;
  KRAKEN.mouth.scale.setScalar(2.3);
  if (typeof sfxGiantRoar === 'function') sfxGiantRoar();
  addTrauma(0.8);
}
// una explosión de la muerte: en un lugar del cuerpo, bola de fuego, salpicadura, a veces un pedazo que salta
function krakenBlastFx(big) {
  const K = KRAKEN, g = K.g.position, sc = CONFIG.EE.arena.scale, a = (Math.random() - 0.5) * 2.4;
  const x = g.x + Math.sin(a) * 0.65 * sc, y = g.y + (0.4 + Math.random() * 2.8) * sc, z = g.z + Math.cos(a) * 0.62 * sc;
  krakenFireball(x, y, z, big ? 9 : 3 + Math.random() * 3);
  if (typeof spawnSplashFx === 'function') spawnSplashFx(x, y, z, Math.random() < 0.5 ? 0xff5a10 : 0x9a1010, big ? 8 : 3);
  if (typeof sfxExplosion === 'function') sfxExplosion();
  const C = K.chunks.find(c => !c.on);
  if (C && Math.random() < 0.5) {
    C.on = true; C.m.visible = true; C.m.position.set(x, y, z);
    C.v.set(Math.sin(a) * (6 + Math.random() * 8), 8 + Math.random() * 10, Math.cos(a) * (6 + Math.random() * 8));
  }
}
// la gran explosión: vuelan todos los pedazos que quedan, varias bolas de fuego, relámpago
function krakenBoom() {
  const K = KRAKEN, g = K.g.position, sc = CONFIG.EE.arena.scale;
  K.chunks.forEach((C, i) => {
    if (C.on) return;
    const a = i / K.chunks.length * Math.PI * 2;
    C.on = true; C.m.visible = true; C.m.position.set(g.x + Math.sin(a) * 3, g.y + (1.5 + (i % 3) * 0.6) * sc, g.z + Math.cos(a) * 3);
    C.v.set(Math.sin(a) * (10 + i), 16 + (i % 4) * 6, Math.cos(a) * (10 + i));
  });
  for (let k = 0; k < 6; k++) krakenFireball(g.x + (Math.random() - 0.5) * 10, g.y + (1 + Math.random() * 2.5) * sc, g.z + (Math.random() - 0.5) * 10, 8 + Math.random() * 6);
  if (typeof spawnSplashFx === 'function') { spawnSplashFx(g.x, g.y + 2.8 * sc, g.z, 0xff3a10, 10); spawnSplashFx(g.x, CONFIG.EE.storm.seaY, g.z, 0x9fd4e6, 12); }
  if (typeof sfxExplosion === 'function') { sfxExplosion(); sfxExplosion(); }
  if (typeof sfxGiantRoar === 'function') sfxGiantRoar();
  lightning();
  addTrauma(1);
}
function krakenAfterWin() {
  const W = CONFIG.EE.win;
  EE.fight = null; EE.cine = null; EE.won = true; EE.lure = false; EE.calm = false; EE.step = 7;
  KRAKEN.arena.visible = false; KRAKEN.plank.visible = false; KRAKEN.g.visible = true;
  if (EE.storm) eeStorm(false);
  if (typeof setFog === 'function' && typeof SETTINGS !== 'undefined') setFog(SETTINGS.fog);
  KRAKEN.whirl.position.set(W.whirl[0], 0, W.whirl[1]); KRAKEN.whirl.scale.setScalar(1); KRAKEN.whirl.visible = true;
  // el portal queda en el cielo, sobre el remolino de la playa (la pista del mapa que viene)
  krakenPortalAt(W.whirl[0], W.whirl[1], 1); KRAKEN.beams.position.y = 0;
  if (KRAKEN.debris) KRAKEN.debris.visible = true;
  setSky(Math.max(1, state.round));
  // lo que queda de la ronda es de día (cielo morado y azul brillante); la ronda que viene vuelve a su cielo
  NIGHT.target = 0;
  // el premio: todos los perks, puntos, tinta, XP, munición llena y el camo del Kraken en el perfil
  for (const k of PERK_KEYS) if (!hasPerk(k)) state.perks.push(k);
  state.health = maxHealth(); if (typeof updatePerkHUD === 'function') updatePerkHUD();
  state.points += W.points; STATS.pointsEarned += W.points;
  addInk(W.ink); addXP(W.xp);
  PROFILE.krakenSlayer = true; saveProfile();
  if (typeof applyPowerup === 'function') applyPowerup('maxammo');
  showBanner('THE KRAKEN IS DEAD', 4);
  sfxEEReady();
}
function krakenLose(punish) {
  const E = CONFIG.EE;
  krakenDismount();
  krakenClear();
  // (la Ola de la mesa queda: si te la dio la mesa, es tuya)
  EE.fight = null; EE.lure = false; EE.calm = false;
  EE.lureBackRound = state.round + E.punish.lureRounds;
  EE.travelTo = { punish: !!punish };
  eeTravel(E.beachOut);
  eeFail();
}
// después de volver a la playa por un intento fallido: el castigo
function eePunish() {
  const P = CONFIG.EE.punish;
  setSky(Math.max(1, state.round));
  roundState.bossQueue = (roundState.bossQueue || []).concat(P.bosses); roundState.bossPending = true;
  for (let k = 0; k < P.dogs; k++) if (typeof spawnDog === 'function') spawnDog();
}

//--- cada frame ---
function updateKraken(dt) {
  if (!EE.built) return;
  const E = CONFIG.EE, t = clock.elapsedTime, P = player.pos;
  // la semilla: flota y se hunde si no la agarrás
  if (EE.seed) {
    const S = EE.seed, g = EE.g.seed;
    if (!S.sunk) {
      S.t -= dt; g.visible = true; g.position.set(S.x, S.y + 0.1 + 0.05 * Math.sin(t * 3), S.z); g.rotation.y = t;
      if (S.t <= 0) { S.sunk = true; S.back = state.round + 1; g.visible = false; eeFail(); }
    } else if (state.round >= S.back) { S.sunk = false; S.t = E.seed.time; }
  }
  // el teletransportador: cargando (quedate arriba de la plataforma)
  const TL = EE.tele;
  if (TL.state === 'charging') {
    TL.t += dt;
    const T = CONFIG.BUNKER.teleporter, on = Math.abs(P.x - T.x) < 1.9 && Math.abs(P.z - T.z) < 1.9 && inBunker();
    TL.out = on ? 0 : TL.out + dt;
    EE.g.teleMat.opacity = 0.25 + 0.35 * Math.min(1, TL.t / E.tele.charge) + 0.1 * Math.sin(t * 20);
    if (TL.out > E.tele.leave || DOWN.on) { TL.state = 'off'; EE.g.teleMat.opacity = 0; eeFail(); }
    else if (TL.t >= E.tele.charge) { TL.state = 'done'; eeOk(3); EE.g.teleMat.opacity = 0.3; eeTravel(E.tele.arrive); }
  } else if (TL.state === 'done') EE.g.teleMat.opacity = 0.2 + 0.05 * Math.sin(t * 3);
  // las pruebas
  const TR = EE.trial;
  if (TR.state === 'calib') { TR.t -= dt; if (TR.t <= 0) { TR.state = 'off'; TR.lit = [false, false, false]; eeFail(); } }
  else if (TR.state === 'hold') {
    TR.t -= dt;
    // adentro = bajo la cúpula (la elipse del caparazón: sus cuartos R21 no llegan a todos los bordes)
    const S = CONFIG.SHELL, inside = ((P.x - S.x) / S.a) ** 2 + ((P.z - S.z) / S.b) ** 2 < 1;
    if (!inside || DOWN.on) { TR.state = 'off'; TR.lit = [false, false, false]; eeFail(); }
    else if (TR.t <= 0) { TR.state = 'off'; TR.n = 2; eeOk(4); }
  }
  EE.g.consoles.forEach((c, i) => c.scr.material.color.setHex(TR.n >= 2 ? 0x3aff6a : TR.lit[i] ? (TR.state === 'hold' ? (Math.sin(t * 8) > 0 ? 0x3aff6a : 0x1a6a2a) : 0xffb03a) : EE.tele.state === 'done' ? 0x6a1a10 : 0x2a0806));
  // la cabina
  const C = EE.cap;
  if (C.cd > 0) C.cd -= dt;
  if (C.shut > 0) C.shut = Math.max(0, C.shut - dt);
  if (C.state === 'waiting' && C.boss && !C.boss.alive) { C.state = 'off'; C.boss = null; C.cd = E.retry; eeFail(); }
  if (C.state === 'process') { C.t -= dt; if (C.t <= 0) C.state = 'ready'; }
  if (EE.lureBackRound && state.round >= EE.lureBackRound && !EE.lure && C.state === 'off') { C.state = 'ready'; EE.lureBackRound = 0; }
  const shutK = C.state === 'process' ? 1 : C.shut > 0 ? Math.min(1, (E.shutTime - C.shut) * 4, C.shut * 4) : 0;
  C.doorK += (shutK - C.doorK) * Math.min(1, dt * 10);
  for (const d of EE.g.doors) d.scale.z = Math.max(0.01, C.doorK);
  EE.g.doorMat.opacity = 0.2 + 0.3 * C.doorK;
  EE.g.boothLight.material.color.setHex(C.state === 'process' ? (Math.sin(t * 12) > 0 ? 0x9a3aff : 0x3a0a5a) : C.state === 'ready' ? 0x9a3aff : EE.trial.n >= 2 ? 0x3aff6a : 0x3a0a08);
  EE.g.lure.visible = C.state === 'ready' && !EE.lure;
  if (EE.g.lure.visible) { EE.g.lure.position.set(E.booth.x, 0.6 + 0.08 * Math.sin(t * 2.5), E.booth.z); EE.g.lure.rotation.y = t * 0.8; }
  // la pared de agua
  if (KRAKEN.membrane) {
    const m = KRAKEN.membrane; m.position.y = SQHEAD.dy + E.membrane.h / 2; m.visible = !!SQHEAD.open || SQHEAD.dy > -2;
    if (m.material.map) m.material.map.offset.y = (t * 0.15) % 1;
    m.material.opacity = (EE.lure && EE.calm ? 0.85 : 0.7) + 0.06 * Math.sin(t * 2);
  }
  // viajes que terminan (el castigo, la vuelta de la victoria)
  if (EE.travelTo && !(BUNK.fadeT > 0)) {
    const T = EE.travelTo; EE.travelTo = null;
    if (!EE.fight && !EE.cine && EE.storm) eeStorm(false);
    if (T.punish) eePunish(); else setSky(Math.max(1, state.round));
  }
  // el remolino gira; el cielo de la victoria entra de a poco
  if (KRAKEN.whirl.visible) KRAKEN.whirl.rotation.y -= dt * 0.9;
  if (EE.won && EE.skyK < 1) { EE.skyK = Math.min(1, EE.skyK + dt / 4); NIGHT.dirty = true; }
  if (KRAKEN.arena.visible) updateKrakenSea(t);
  updateKrakenFire(dt);                                                  // F5.29e: las bolas de fuego del final
  updateKrakenPortal(dt, t);                                             // F5.29e: el portal y las auroras (quedan después de ganar)
  if (EE.fight || EE.cine) updateKrakenFight(dt, t);
}
// las olas en cubos del mar de la tormenta (más altas que las de la playa)
function updateKrakenSea(t) {
  const S = KRAKEN.sea, ST = CONFIG.EE.storm, M = KRAKEN.m4, c = ST.cube;
  if (!S) return;
  for (let i = 0; i < S.cells.length; i++) {
    const [x, z] = S.cells[i];
    let h = Math.sin(x * 0.17 + t * 1.6 + z * 0.29) * 0.6 + Math.sin(x * 0.07 - t * 0.9 + z * 0.6) * 0.35 + Math.sin(z * 0.45 + t * 2.3) * 0.15;
    h = Math.round(h * ST.wave / 0.1) * 0.1;
    M.makeScale(c * 0.98, 0.6 + Math.max(0, h) * 1.4, c * 0.98); M.setPosition(x, ST.seaY - 0.3 + h, z);
    S.vox.setMatrixAt(i, M);
  }
  S.vox.instanceMatrix.needsUpdate = true;
}
function updateKrakenFight(dt, t) {
  const E = CONFIG.EE, FC = E.fight, F = EE.fight, K = KRAKEN, A = E.arena, P = player.pos, g = K.g;
  const [kx, kz] = krakenHome();
  // la cinemática de la victoria (F5.29d): 1) se hunde en el remolino mientras vuela un pedazo (la cámara sube detrás
  // tuyo); 2) vas en un tablón hacia la playa, mirás para atrás un momento y ahí está el remolino; llegás a la playa
  if (EE.cine) {
    const CI = EE.cine, W = E.win;
    CI.t += dt;
    for (const C of K.chunks) if (C.on) {
      C.v.y -= 20 * dt; C.m.position.addScaledVector(C.v, dt); C.m.rotation.x += dt * 3; C.m.rotation.z += dt * 2;
      if (C.m.position.y < E.storm.seaY - 2) { C.on = false; C.m.visible = false; if (typeof spawnSplashFx === 'function') spawnSplashFx(C.m.position.x, E.storm.seaY, C.m.position.z, 0x9fd4e6, 2); }
    }
    if (CI.stage !== 'swim') {
      player.pos.set(CI.x, CI.y, CI.z); player.vel.set(0, 0, 0);
      // la cámara: da la vuelta alrededor del Kraken (blast, boom) y en whirl sube y mira desde arriba; se sacude
      const orbit = (u, shake) => {
        const a = CI.a0 + u * 1.1, h = 10 + u * 6;
        camera.position.set(kx + Math.sin(a) * 46 + (Math.random() - 0.5) * shake, h + (Math.random() - 0.5) * shake, kz + Math.cos(a) * 46 + (Math.random() - 0.5) * shake);
      };
      for (const T of K.idle) {                                          // los tentáculos se retuercen
        T.parts[0].rotation.z = 0.5 + 0.35 * Math.sin(t * 5 + T.ph);
        T.parts[1].rotation.z = 0.45 + 0.6 * Math.sin(t * 7 + T.ph);
        T.parts[2].rotation.z = 0.6 + 0.8 * Math.sin(t * 9 + T.ph);
      }
      if (CI.stage === 'blast') {
        // explota de a poco: cada vez más seguido; se prenden las grietas; el ojo titila y se apaga; se va hundiendo
        const u = Math.min(1, CI.t / W.blast);
        if ((CI.next -= dt) <= 0) { CI.next = W.blastEvery[0] + (W.blastEvery[1] - W.blastEvery[0]) * u; krakenBlastFx(false); CI.nb = (CI.nb || 0) + 1; }
        const want = Math.floor(u * W.cracks);
        for (; CI.cracks < want; CI.cracks++) K.cracks.setMatrixAt(CI.cracks, K.crackM[CI.cracks]);
        K.cracks.instanceMatrix.needsUpdate = true;
        g.position.y -= dt * (0.4 + u * 1.2); g.rotation.z = Math.sin(t * 23) * (0.02 + u * 0.05); g.rotation.x = Math.sin(t * 17) * 0.03 * (1 + u);
        K.eyeHalo.material.opacity = Math.random() < 0.3 + u * 0.5 ? 0.05 : 0.9 * (1 - u * 0.7);
        K.lid.scale.y = 0.3 + Math.random() * 0.4; K.lid.position.y = (1 - K.lid.scale.y) * 0.25;
        K.mouthHalo.material.opacity = 0.7 + 0.3 * Math.random();
        orbit(u * 0.8, 0.15 + u * 0.6);
        camera.lookAt(kx, g.position.y + 16, kz);
        if (u >= 1) { CI.stage = 'boom'; CI.t = 0; krakenBoom(); K.whirl.visible = true; K.whirl.scale.setScalar(0.3); }
        return;
      }
      if (CI.stage === 'boom') {
        // la gran explosión: se va al fondo; el remolino empieza a abrirse
        const u = Math.min(1, CI.t / W.boomT);
        g.position.y -= dt * 14; g.rotation.y += dt * 0.8;
        K.eyeHalo.material.opacity = 0;
        K.whirl.scale.setScalar(0.3 + u * 0.9); K.whirl.rotation.y -= dt * 3;
        orbit(0.8 + u * 0.15, 1.2 * (1 - u) + 0.3);
        camera.lookAt(kx, Math.max(2, g.position.y + 16), kz);
        if (u >= 1) { CI.stage = 'whirl'; CI.t = 0; CI.cx = camera.position.x; CI.cy = camera.position.y; CI.cz = camera.position.z; }
        return;
      }
      // whirl: desde arriba se ve cómo se lo traga el remolino; después la vista sube al cielo: se abre el portal
      const u = Math.min(1, CI.t / W.whirlT), e2 = u * u * (3 - 2 * u);
      g.position.y -= dt * 8; if (g.position.y < -50) g.visible = false;
      K.whirl.scale.setScalar(1.2 + Math.min(1, u * 2) * 1.4); K.whirl.rotation.y -= dt * 2.4;
      const pk = Math.max(0, Math.min(1, (CI.t - 1) / 2));
      if (pk > 0 && !CI.portal) { CI.portal = true; sfxKrakenPortal(); lightning(); }
      krakenPortalAt(kx, kz, pk * pk * (3 - 2 * pk));
      const ux = CI.cx + (kx + 14 - CI.cx) * e2, uy = CI.cy + (40 - CI.cy) * e2, uz = CI.cz + (kz + 30 - CI.cz) * e2;
      camera.position.set(ux, uy, uz);
      const up = Math.max(0, (u - 0.55) / 0.45), lu = up * up * (3 - 2 * up);
      camera.lookAt(kx, E.storm.seaY + (W.portal.y - E.storm.seaY) * lu, kz);
      if (u >= 1) {
        // al agua: se va la tormenta, amanece y aparece el tablón
        CI.stage = 'swim'; CI.t = 0; g.visible = false;
        eeStorm(false); setSky(Math.max(1, state.round)); NIGHT.target = 0.35;
        if (camera.far < E.storm.fogFar + 4) { camera.far = E.storm.fogFar + 4; camera.updateProjectionMatrix(); }
        CI.sx = A.x + W.swimFrom[0]; CI.sz = A.z + W.swimFrom[1];
        K.plank.visible = true;
        // (el muelle ya no está: al mirar para atrás se ve el remolino, sobre el mar de la playa que volvió)
        K.arena.visible = false; K.whirl.position.y = SEA.y + 0.05;
      }
      return;
    }
    // el tablón: de swimFrom a la orilla, meciéndose; entre look[0] y look[1] la cámara mira para atrás, al remolino
    const u = Math.min(1, CI.t / W.swim), e = u * u * (3 - 2 * u), [bx, bz] = E.beachOut, ex = bx, ez = SEA.z0 + 1.5;
    const px = CI.sx + (ex - CI.sx) * e, pz = CI.sz + (ez - CI.sz) * e, fx = ex - CI.sx, fz = ez - CI.sz, fl = Math.hypot(fx, fz) || 1;
    const bob = Math.sin(t * 2.2) * 0.12, py = SEA.y + 0.75 + bob;
    player.pos.set(px, py, pz); player.vel.set(0, 0, 0);
    K.plank.position.set(px, SEA.y + 0.05 + bob * 0.6, pz); K.plank.rotation.set(Math.sin(t * 1.7) * 0.06, Math.atan2(fx, fz), Math.sin(t * 2.2) * 0.08);
    const [l0, l1] = W.look, wl = Math.min(1, Math.max(0, (u - l0) / 0.04)) * Math.min(1, Math.max(0, (l1 - u) / 0.04));
    const wx = K.whirl.position.x, wz = K.whirl.position.z;
    const tx = (px + fx / fl * 12) * (1 - wl) + wx * wl, tz = (pz + fz / fl * 12) * (1 - wl) + wz * wl;
    camera.position.set(px, py, pz);
    // (mirando para atrás se levanta un poco la vista: el remolino abajo y el portal en el cielo)
    camera.lookAt(tx, SEA.y + 0.6 - 0.2 * (1 - wl) + 12 * wl, tz);
    if (u >= 1) {
      // en la playa, mirando el remolino
      const W2 = W.whirl, gy = groundY(bx, bz);
      player.pos.set(bx, gy + CONFIG.PLAYER.height, bz);
      player.yaw = Math.atan2(-(W2[0] - bx), -(W2[1] - bz)); player.pitch = 0;
      krakenAfterWin();
    }
    return;
  }
  if (!F) return;
  // la tormenta: noche siempre (applyNight la oscurece; los relámpagos los pone updateNight con stormZone)
  NIGHT.target = E.storm.night; NIGHT.pTarget = 0;
  if (BUNK.fadeT > 0) return;                                            // llegando a la arena
  F.t += dt;
  // nunca fuera del muelle: si algo te empujó afuera (un sólido que se prendió encima), volvés al último lugar bueno
  if (inArena(P.x, P.z)) { F.okX = P.x; F.okZ = P.z; }
  else if (F.okX !== undefined) { P.x = F.okX; P.z = F.okZ; player.vel.x = player.vel.z = 0; player.pushT = 0; }
  g.updateMatrixWorld(true);
  // sube del agua y te mira (poco: es enorme); en la fase 3 se acerca al muelle con el pico
  const want = A.rise[F.phase - 1] + Math.sin(t * 0.8) * 0.3;
  g.position.y += (want - g.position.y) * Math.min(1, dt * 0.8);
  // (F5.29e, Diego: "que se voltee a donde yo vaya": sin tope, gira hacia vos por el lado más corto; con la C podés estar
  // a sus costados)
  let da = Math.atan2(P.x - kx, P.z - kz) - g.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
  g.rotation.y += da * Math.min(1, dt * FC.turn);
  g.rotation.z = Math.sin(t * 0.5) * 0.03;
  F.lunge = F.phase === 3 ? Math.min(1, F.lunge + dt * 0.4) : Math.max(0, F.lunge - dt);
  g.position.x = kx + Math.sin(g.rotation.y) * FC.lunge * F.lunge; g.position.z = kz + Math.cos(g.rotation.y) * FC.lunge * F.lunge;
  for (const T of K.idle) {
    T.parts[0].rotation.z = 0.5 + 0.2 * Math.sin(t * 0.9 + T.ph);
    T.parts[1].rotation.z = 0.45 + 0.35 * Math.sin(t * 1.3 + T.ph);
    T.parts[2].rotation.z = 0.6 + 0.45 * Math.sin(t * 1.7 + T.ph);
  }
  // el ojo: cerrado en la fase 1 (la luz se escapa por los bordes), abierto en la 2 (se cierra al recibir un arponazo),
  // entrecerrado en la 3
  if (F.flinch > 0) F.flinch -= dt;
  // F5.29d (Diego: "una ventana un poco más corta para dispararle"): en la fase 2 el ojo se abre eyeOpen s y se cierra
  // eyeClosed s; justo antes de abrirse, el halo late (aviso)
  if (F.phase === 2 && (F.eyeT -= dt) <= 0) {
    F.eyeOpen = !F.eyeOpen; F.eyeT = F.eyeOpen ? FC.eyeOpen : FC.eyeClosed;
    if (F.eyeOpen && typeof sfxGiantRoar === 'function') sfxGiantRoar();
  }
  if (F.phase !== 2) F.eyeOpen = false;
  const open = F.phase === 2 && F.eyeOpen && F.flinch <= 0;
  const lidK = F.phase === 2 ? (open ? 0.05 : 1) : F.phase === 3 ? 0.45 : 1;
  K.lid.scale.y += (lidK - K.lid.scale.y) * Math.min(1, dt * 12);
  K.lid.position.y = (1 - K.lid.scale.y) * 0.25;
  const soon = F.phase === 2 && !F.eyeOpen && F.eyeT < 0.8;
  K.eyeHalo.material.opacity = (open ? 0.95 : soon ? 0.6 + 0.35 * Math.abs(Math.sin(t * 14)) : 0.4) + 0.05 * Math.sin(t * 3);
  // el pico: se abre y cierra en la fase 3
  if (F.phase === 3) {
    F.mouthT -= dt;
    if (F.mouthT <= 0) { F.mouthOpen = !F.mouthOpen; F.mouthT = F.mouthOpen ? FC.mouthOpen : FC.mouthClosed; if (F.mouthOpen && typeof sfxGiantRoar === 'function') sfxGiantRoar(); }
  } else F.mouthOpen = false;
  const ms = F.mouthOpen ? 2.3 : 1;
  K.mouth.scale.setScalar(K.mouth.scale.x + (ms - K.mouth.scale.x) * Math.min(1, dt * 5));
  K.mouthHalo.material.opacity = F.mouthOpen ? 0.9 + 0.1 * Math.sin(t * 10) : 0.5;
  // los tentáculos que golpean: se levantan con la franja roja, caen, quedan apoyados (sólidos) y se van
  F.slamT -= dt;
  if (F.slamT <= 0) {
    const down = K.tents.filter(q => q.state !== 'off' && q.state !== 'up' && q.state !== 'cut').length;
    const T = K.tents.find(q => q.state === 'off');
    if (T && down < FC.maxDown && inArena(P.x, P.z)) krakenSlam(T);
    F.slamT = (FC.slamEvery[0] + Math.random() * (FC.slamEvery[1] - FC.slamEvery[0])) * (F.phase === 1 ? 1 : FC.slowK);
  }
  for (const T of K.tents) {
    if (T.state === 'off') continue;
    T.t += dt;
    if (T.state === 'warn') {
      const k = Math.min(1, T.t / FC.warn);
      krakenTentPose(T, 0, 1 - (1 - k) * (1 - k), t);
      T.warn.material.opacity = 0.15 + 0.35 * k * Math.abs(Math.sin(t * (5 + 9 * k)));
      if (k >= 1) { T.state = 'fall'; T.t = 0; if (typeof sfxBossSlamWind === 'function') sfxBossSlamWind(); }
    } else if (T.state === 'fall') {
      const k = Math.min(1, T.t / FC.fall);
      krakenTentPose(T, 1, k * k, t);
      if (k >= 1) krakenImpact(T);
    } else if (T.state === 'down') {
      krakenTentPose(T, 2, 1, t);
      if (T.t >= FC.stay) { T.state = 'up'; T.t = 0; krakenTentCols(T, false); T.spot.visible = false; krakenSetHit(T.spot, false); }
    } else {
      const k = Math.min(1, T.t / (T.state === 'cut' ? 0.6 : FC.up));
      krakenTentPose(T, 3, k, t);
      if (k >= 1) krakenTentOff(T);
    }
  }
  // los tentáculos del piso: cada floorEvery s donde estés; subido a un cañón, a los mountGrace s debajo del asiento
  if (F.mount >= 0) {
    const H = K.harps[F.mount];
    P.x = H.sx; P.z = H.sz; player.vel.x = player.vel.z = 0;
    if (keys['Space']) krakenDismount();
    F.mountT += dt;
    if (F.mountT >= FC.mountGrace && !F.mountFloor) { const L = K.floors.find(q => q.state === 'off'); if (L) { krakenFloor(L, H.sx, H.sz); F.mountFloor = true; } }
  }
  F.floorT -= dt;
  if (F.floorT <= 0) {
    F.floorT = (FC.floorEvery[0] + Math.random() * (FC.floorEvery[1] - FC.floorEvery[0])) * (F.phase === 1 ? 1.4 : 1);
    const L = K.floors.find(q => q.state === 'off');
    if (L && F.mount < 0 && inArena(P.x, P.z)) krakenFloor(L, P.x, P.z);
  }
  for (const L of K.floors) {
    if (L.state === 'off') continue;
    L.t += dt;
    if (L.state === 'warn') {
      L.warn.material.opacity = 0.25 + 0.5 * Math.abs(Math.sin(t * 14));
      const sk = 1 + 0.2 * Math.sin(t * 20); L.warn.scale.set(sk, sk, 1);
      if (Math.hypot(P.x - L.x, P.z - L.z) < 6) addTrauma(dt * 0.6);
      if (L.t >= FC.floorWarn) krakenFloorBurst(L);
    } else if (L.state === 'rise') {
      krakenFloorPose(L, Math.min(1, L.t / 0.3), t);
      if (L.t >= 0.3) { L.state = 'stand'; L.t = 0; }
    } else if (L.state === 'stand') {
      krakenFloorPose(L, 1, t);
      if (L.t >= FC.floorStay) {
        L.state = 'sink'; L.t = 0;
        const c = K.cols[4 * FC.boxes + L.f]; if (c) { c.solid = false; COLHASH.dirty = true; }
      }
    } else {
      krakenFloorPose(L, Math.max(0, 1 - L.t / 0.6), t);
      if (L.t >= 0.6) krakenFloorOff(L);
    }
  }
  // los cañones: la lámpara (verde listo, roja recargando, apagada fuera de la fase 2), el caño sigue tu mira, el arpón
  for (let i = 0; i < K.harps.length; i++) {
    const H = K.harps[i];
    if (H.cd > 0 && (H.cd -= dt) <= 0) H.loaded.visible = true;
    H.lamp.material.color.setHex(F.phase !== 2 ? 0x1a0806 : H.cd > 0 ? (Math.sin(t * 10) > 0 ? 0xff2a1a : 0x5a0a06) : 0x3aff6a);
    if (F.mount === i && feel.aimQuat) H.head.quaternion.copy(feel.aimQuat);
    if (H.shot.on) krakenShotStep(H, dt);
  }
  // ahogados que suben sin parar, calamarcitos y tinta
  F.drownT -= dt;
  if (F.drownT <= 0) {
    F.drownT = FC.drowned.every;
    // (el que quedó fuera del muelle, en el agua, se va)
    for (const z of state.zombies) if (z.alive && z.state !== 'emerge' && !inArena(z.px, z.pz)) deactivateZombie(z);
    for (let i = state.zombies.length - 1; i >= 0; i--) if (!state.zombies[i].active) state.zombies.splice(i, 1);
    const n = state.zombies.filter(z => z.alive && z.kind === 'drowned').length;
    if (n < FC.drowned.max) krakenDrowned(1);
  }
  F.squidT -= dt;
  if (F.squidT <= 0) { F.squidT = FC.squidEvery; krakenSquid(); krakenSquid(); }
  F.inkT -= dt;
  if (F.inkT <= 0) {
    F.inkT = FC.inkEvery;
    const m = krakenMouth(K.v);
    for (let k = 0; k < 3; k++) fireInk({ px: m.x, pz: m.z, heading: Math.atan2(P.x - m.x, P.z - m.z), size: 2.5, swingT: 0 });
  }
  // F5.29d, fase 3: los bosses de las granadas salen del mar (de a p3Alive); cada uno que muere suelta una granada
  // morada; se agarran pasando cerca; los huecos de la mesa se prenden; con las 4, la mesa las ata a la Ola
  if (F.phase === 3 && F.p3) {
    const Q = F.p3;
    Q.t -= dt;
    const alive = Q.refs.filter(r => r.z.active && r.z.alive).length;
    if (Q.queue.length && alive < FC.p3Alive && Q.t <= 0) {
      const z = krakenP3Spawn(Q.queue[0]);
      if (z) { Q.queue.shift(); Q.refs.push({ z, dropped: false }); Q.t = FC.p3Every; } else Q.t = 1;
    }
    for (const r of Q.refs) if (!r.dropped && !r.z.alive) { r.dropped = true; krakenDropOrb(r.z.px, r.z.pz); }
  }
  for (const O of K.orbs) {
    if (!O.on) continue;
    if (O.fly) {
      // vuela flotando (alto, con estela) hasta delante de la mesa; recién ahí se puede agarrar
      const dx = O.fly.tx - O.x, dz = O.fly.tz - O.z, d = Math.hypot(dx, dz), step = Math.min(d, FC.orbFly * dt);
      if (d > 0.05) { O.x += dx / d * step; O.z += dz / d * step; }
      const near = Math.min(1, d / 4);
      O.g.position.set(O.x, 0.6 + near * 2.4 + Math.sin(t * 3 + O.x) * 0.15, O.z); O.g.rotation.y += dt * 4;
      if (Math.random() < dt * 6 && typeof spawnSplashFx === 'function') spawnSplashFx(O.x, O.g.position.y, O.z, 0x9a3aff, 0.6);
      if (d <= 0.05) O.fly = null;
      continue;
    }
    O.g.position.y = 0.6 + Math.sin(t * 3 + O.x) * 0.15; O.g.rotation.y += dt * 2;
    if (Math.hypot(P.x - O.x, P.z - O.z) < FC.orbPick) {
      O.on = false; O.g.visible = false; F.charges = Math.min(4, F.charges + 1);
      if (typeof sfxPartPickup === 'function') sfxPartPickup();
    }
  }
  K.sockets.forEach((s, i) => s.material.color.setHex(F.loaded || F.shot ? 0x1a0a2a : i < F.charges ? (Math.sin(t * 6 + i) > -0.3 ? 0xb05aff : 0x7a2aff) : 0x1a0a2a));
  // la carga atada a la Ola (en la escena del arma), mientras la tengas en la mano
  { const s = curSlot(), M = typeof weaponsState !== 'undefined' ? weaponsState.model : null, want = F.loaded && !!s && s.id === 'wave' && !!M;
    if (want && K.bundle.parent !== M) M.add(K.bundle);
    else if (!want && K.bundle.parent) K.bundle.parent.remove(K.bundle); }
  // la carga volando: a la boca abierta (lo mata), o al cuerpo / al agua (fallo: vuelve a la mesa en chargeBack s)
  if (F.shot) {
    const S = F.shot; S.t += dt; S.v.y -= FC.chargeGrav * dt; S.p.addScaledVector(S.v, dt);
    K.chargeM.position.copy(S.p); K.chargeM.rotation.x += dt * 5; K.chargeM.rotation.y += dt * 3;
    const m = krakenMouth(K.v), sc = A.scale, gp = g.position;
    const inBody = Math.hypot(S.p.x - gp.x, S.p.z - gp.z) < 0.72 * sc && S.p.y > gp.y && S.p.y < gp.y + 3.4 * sc;
    if (F.mouthOpen && S.p.distanceTo(m) < FC.mouthR) {
      F.shot = null; K.chargeM.visible = false;
      if (typeof spawnSplashFx === 'function') spawnSplashFx(m.x, m.y, m.z, 0x9a3aff, 5);
      krakenDying();
    } else if (inBody || S.p.y < E.storm.seaY || S.t > 4) {
      if (typeof spawnSplashFx === 'function') spawnSplashFx(S.p.x, Math.max(S.p.y, E.storm.seaY), S.p.z, 0x9a3aff, 2.5);
      F.shot = null; K.chargeM.visible = false; F.chargeBack = FC.chargeBack;
      krakenFail();
    }
  }
  if (F.chargeBack > 0) F.chargeBack = Math.max(0, F.chargeBack - dt);
  // el bote: F y quedarte cerca boat s
  if (F.boat > 0) {
    const bx = A.x + A.boat[0], bz = A.z + A.boat[1];
    if (Math.hypot(P.x - bx, P.z - bz) > FC.boatUse + 1) F.boat = 0;
    else if ((F.boat -= dt) <= 0) { krakenLose(false); return; }
  }
  // el tiempo
  if (F.t >= FC.time) { krakenLose(true); return; }
  // la barra: cuánto le falta (tentáculos, ojo, panza) y el tiempo que queda
  if (typeof UI !== 'undefined' && UI.boss && UI.boss.style) {
    const k = F.phase === 1 ? 1 - F.cuts / FC.cuts * 0.4 : F.phase === 2 ? 0.6 - F.eyeHits / FC.eyeHits * 0.3 : 0.3 - F.charges / 4 * 0.15;
    UI.boss.style.display = 'block'; UI.bossName.textContent = 'THE KRAKEN';
    UI.bossFill.style.width = (k * 100).toFixed(1) + '%';
    UI.bossHat.style.width = (Math.max(0, 1 - F.t / FC.time) * 100).toFixed(1) + '%';
  }
}
// el cielo de la victoria (morado y azul brillante): lo usan applyNight (niebla) y updateSkyDome (arriba)
const _eeC = new THREE.Color();
function eeSkyTint(color, which) {
  if (!(EE.skyK > 0)) return color;
  const W = CONFIG.EE.win;
  return color.lerp(_eeC.setHex(which === 'top' ? W.skyTop : W.fog), EE.skyK * (which === 'top' ? 0.85 : 0.6));
}
function resetKraken() {
  const C = EE.cap, wasCine = !!EE.cine;
  if (EE.built && (EE.fight || EE.cine)) krakenClear();
  if (EE.storm) eeStorm(false);
  else if (wasCine && typeof setFog === 'function' && typeof SETTINGS !== 'undefined') setFog(SETTINGS.fog);
  Object.assign(EE, { step: 0, hasSeed: false, plantDead: false, beastDead: false, seed: null, lure: false, calm: false, lureBackRound: 0,
    fight: null, cine: null, won: false, skyK: 0, travelTo: null, debugHp: false });
  Object.assign(EE.tele, { state: 'off', t: 0, out: 0 });
  Object.assign(EE.trial, { n: 0, state: 'off', t: 0, lit: [false, false, false] });
  Object.assign(C, { state: 'off', boss: null, t: 0, cd: 0, doorK: 0, shut: 0 });
  if (!EE.built) return;
  EE.g.seed.visible = false; EE.g.lure.visible = false; EE.g.teleMat.opacity = 0;
  KRAKEN.arena.visible = false; KRAKEN.whirl.visible = false; KRAKEN.plank.visible = false; KRAKEN.g.visible = true;
  KRAKEN.whirl.scale.setScalar(1);
  if (KRAKEN.debris) KRAKEN.debris.visible = false;
  for (const T of KRAKEN.tents) krakenTentOff(T);
  for (const L of KRAKEN.floors) krakenFloorOff(L);
  krakenSetHit(KRAKEN.eyeHit, false); krakenSetHit(KRAKEN.bodyHit, false);
  for (const H of KRAKEN.harps) { H.cd = 0; H.shot.on = false; H.spear.visible = false; H.rope.visible = false; H.loaded.visible = true; }
  for (const O of KRAKEN.orbs) { O.on = false; O.g.visible = false; }
  if (KRAKEN.bundle && KRAKEN.bundle.parent) KRAKEN.bundle.parent.remove(KRAKEN.bundle);
  KRAKEN.chargeM.visible = false;
  for (const Ch of KRAKEN.chunks) { Ch.on = false; Ch.m.visible = false; }
  // F5.29e: el final (portal, auroras, rayos, bolas de fuego, grietas)
  KRAKEN.portal.visible = false; KRAKEN.aurora.visible = false; KRAKEN.beams.visible = false;
  for (const Fb of KRAKEN.fire) { Fb.on = false; Fb.m.visible = false; }
  for (let i = 0; i < KRAKEN.crackM.length; i++) KRAKEN.cracks.setMatrixAt(i, _kZero);
  KRAKEN.cracks.instanceMatrix.needsUpdate = true;
  KRAKEN.g.rotation.set(0, 0, 0);
}
// tecla de debug (L): directo a la pelea, con Perkaholic, la Ray Gun mejorada y (F5.29d, Diego: "dame la wonder weapon en
// vez de Bahamut") la Ola Rompiente en lugar de la LEVIATHAN
function eeDebugFight() {
  debugGodLoadout();
  const li = state.weapons.findIndex(w => w.id === 'leviathan');
  if (li >= 0) { const d = CONFIG.WEAPONS.wave; state.weapons[li] = { id: 'wave', mag: d.magSize, reserve: d.reserveMax }; }
  // (Diego: "solo con la L, 5× de vida": para probar la pelea entera; dura hasta que termina la partida)
  EE.debugHp = true; state.health = maxHealth();
  if (typeof updatePerkHUD === 'function') updatePerkHUD();
  EE.step = 6; EE.hasSeed = true; EE.plantDead = EE.beastDead = true; EE.tele.state = 'done'; EE.trial.n = 2;
  EE.lure = true; eeCalm(true);
  eeStartFight();
}
