//=== 5. ZOMBIES ==========================================================
// Navegación: UN BFS desde el jugador cada 400ms = flow field.
// Cada zombie baja por el gradiente de distancia. O(celdas) total, no O(zombies*celdas).
// Modos de IA: flow | direct | recover (fuera del grid) | lost | unreachable
const ZPOOL = [];
const ZMAT = {};
const ZGEO = {};
const FLOW = {
  dist: new Int16Array(NAV.total),        // F2.8: piso + nivel de arriba (techo de la caseta)
  pdist: new Int16Array(NAV.total),       // F5.11: hacia el jugador, para el boss mientras hay un langostino
  queue: new Int32Array(NAV.total),
  lastCalc: -1e9, srcX: 0, srcZ: 0, srcLevel: 0, lure: null
};
FLOW.dist.fill(-1); FLOW.pdist.fill(-1);
const ZSHIRTS = [0x6f8fa8, 0xb07a5a, 0x7e8f6a, 0x9a6f8e, 0xc2b28a, 0x5d6f7d];
const DIRS8 = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

function easeOut(p) { return 1 - (1 - p) * (1 - p); }
function lerpAngle(a, b, t) {
  let d = (b - a + Math.PI) % (Math.PI * 2);
  if (d < 0) d += Math.PI * 2;
  return a + (d - Math.PI) * t;
}
function flowAt(x, z) { const i = navIdx(x, z); return i < 0 ? -1 : FLOW.dist[i]; }
// F2.8: helpers por nivel (0 = piso, 1 = techo de la caseta)
function lvIdx(L, x, z) { return lvCellIdx(L, x, z); }                 // F5.22: niveles 0, 1 y 2
function lvNav(L, x, z) { return L === 2 ? isUp2(x, z) : L === 1 ? isUp(x, z) : isNav(x, z); }
function lvFlow(L, x, z) { const i = lvIdx(L, x, z); return i < 0 ? -1 : FLOW.dist[i]; }
// F5.15 (costo): se pide por zombie y por frame; se guarda mientras el jugador no se mueva (depende solo de su
// posición: el techo y los pisos no cambian)
const PLV = { x: NaN, y: NaN, z: NaN, lvl: 0, top: undefined };
function plvFresh() {
  const P = player.pos;
  if (P.x === PLV.x && P.y === PLV.y && P.z === PLV.z) return;
  PLV.x = P.x; PLV.y = P.y; PLV.z = P.z;
  const pf = P.y - CONFIG.PLAYER.height;
  PLV.lvl = levelAt(P.x, P.z, pf);
  PLV.top = PLV.lvl === 0 && pf - groundY(P.x, P.z) > 0.1 ? pf + 0.01 : undefined;
}
function playerLevel() { plvFresh(); return PLV.lvl; }
// celda válida más cercana del nivel de arriba (anillos, sin línea libre: arriba no hay paredes)
function nearestUp(cx, cz, R, fx, fz, L) {                               // F5.22: L = 1 (por defecto) o 2
  const ok = L === 2 ? isUp2 : isUp;
  for (let r = 0; r <= R; r++) {
    let best = null, bd = 1e9;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || !ok(cx + dx, cz + dz)) continue;
      const d = (cx + dx + 0.5 - fx) ** 2 + (cz + dz + 0.5 - fz) ** 2;
      if (d < bd) { bd = d; best = { x: cx + dx, z: cz + dz }; }
    }
    if (best) return best;
  }
  return null;
}

// tope de velocidad: PLAYER.speed para todos (regla de Diego), salvo los perros (F5.8: DOGS.speed, excepción)
// F5.26: excepciones aprobadas por Diego: los perros (y las crías de la Bestia) a DOGS.speed, la Bestia a BEAST.speed
function speedCap(z) { return z.dog ? Math.max(CONFIG.PLAYER.speed, CONFIG.DOGS.speed) : z.variant === 'bestia' ? CONFIG.BEAST.speed : CONFIG.PLAYER.speed; }
// F5.6: jugador parado arriba de un mueble (en el piso de abajo): la altura de sus pies (+1 cm), para que la
// línea libre ignore lo que tiene debajo. undefined si está en el piso o en el techo
function playerOnTop() { plvFresh(); return PLV.top; }
//--- flow field ---
function updateFlowField(force) {
  const now = clock.elapsedTime * 1000;
  const R = CONFIG.ZOMBIE.repathMs;
  if (!force && now - FLOW.lastCalc < R) return;
  // el reloj avanza de a R (no salta a "ahora"): si no, a 60 fps 250 ms se redondea a 266 ms.
  // Forzado (puerta abierta, reset) o tras una pausa larga: arranca de cero.
  FLOW.lastCalc = !force && now - FLOW.lastCalc < R * 2 ? FLOW.lastCalc + R : now;
  // F5.11: con un langostino bailando, el campo sale de él (todos van ahí); el boss usa FLOW.pdist (jugador)
  const lure = monkeyLure();
  if (lure) {
    flowFrom(lure.x, lure.z, 0, undefined, FLOW.dist, true);
    FLOW.lure = lure;
    if (bossAlive()) flowFrom(player.pos.x, player.pos.z, playerLevel(), playerOnTop(), FLOW.pdist, false);
  } else {
    FLOW.lure = null;
    flowFrom(player.pos.x, player.pos.z, playerLevel(), playerOnTop(), FLOW.dist, true);
  }
  if (navDebug.visible) drawNavDebug();
}
// BFS desde (px, pz) en el nivel lvl, sobre `dist`. false = sin celda válida cerca (conserva el campo anterior)
function flowFrom(px, pz, lvl, onTop, dist, isMain) {
  // origen = celda del jugador; pegado a pared (fuera del grid) -> celda válida más cercana CON LÍNEA LIBRE
  // (F2.6: sin eso, parado en la orilla este de la piscina el origen caía dentro de la pileta, del otro
  // lado del borde, y todos los zombies se juntaban abajo sin poder llegar)
  let sx = Math.floor(px), sz = Math.floor(pz), s0;
  if (lvl >= 1) {                           // F2.8: arriba del techo, el origen es una celda del nivel de arriba (F5.22: o del 2)
    if (!lvNav(lvl, sx, sz)) {
      const n = nearestUp(sx, sz, 3, px, pz, lvl);
      if (!n) return false;
      sx = n.x; sz = n.z;
    }
    s0 = lvCellIdx(lvl, sx, sz);
  } else {
    if (!isNav(sx, sz)) {
      const n = nearestNav(sx, sz, 4, px, pz, true, onTop);   // F5.6: arriba de la cama
      if (!n) return false;
      sx = n.x; sz = n.z;
    }
    s0 = navIdx(sx, sz);
  }
  if (isMain) { FLOW.srcX = sx; FLOW.srcZ = sz; FLOW.srcLevel = lvl; }
  const q = FLOW.queue, cells = NAV.cells, link = NAV.link, W = NAV.w, N = cells.length;
  const up = UP.cells, UW = UP.w, UN = up.length, N2 = NAV.base2;
  const up2 = UP2.cells, VW = UP2.w, VN = up2.length;
  dist.fill(-1);
  let head = 0, tail = 0;
  dist[s0] = 0; q[tail++] = s0;
  while (head < tail) {
    const i = q[head++], d = dist[i] + 1;
    if (i < N) {
      const ix = i % W;
      // 4 vecinos (Manhattan): los zombies eligen diagonales solos al leer 8 vecinos
      if (ix + 1 < W && cells[i+1] && dist[i+1] < 0) { dist[i+1] = d; q[tail++] = i+1; }
      if (ix > 0     && cells[i-1] && dist[i-1] < 0) { dist[i-1] = d; q[tail++] = i-1; }
      if (i + W < N  && cells[i+W] && dist[i+W] < 0) { dist[i+W] = d; q[tail++] = i+W; }
      if (i - W >= 0 && cells[i-W] && dist[i-W] < 0) { dist[i-W] = d; q[tail++] = i-W; }
    } else if (i < N2) {                    // F2.8: nivel de arriba (mismo BFS, otra grilla)
      const k = i - N, ux = k % UW;
      if (ux + 1 < UW && up[k+1] && dist[i+1] < 0) { dist[i+1] = d; q[tail++] = i+1; }
      if (ux > 0      && up[k-1] && dist[i-1] < 0) { dist[i-1] = d; q[tail++] = i-1; }
      if (k + UW < UN && up[k+UW] && dist[i+UW] < 0) { dist[i+UW] = d; q[tail++] = i+UW; }
      if (k - UW >= 0 && up[k-UW] && dist[i-UW] < 0) { dist[i-UW] = d; q[tail++] = i-UW; }
    } else {                                // F5.22: tercer nivel
      const k = i - N2, ux = k % VW;
      if (ux + 1 < VW && up2[k+1] && dist[i+1] < 0) { dist[i+1] = d; q[tail++] = i+1; }
      if (ux > 0      && up2[k-1] && dist[i-1] < 0) { dist[i-1] = d; q[tail++] = i-1; }
      if (k + VW < VN && up2[k+VW] && dist[i+VW] < 0) { dist[i+VW] = d; q[tail++] = i+VW; }
      if (k - VW >= 0 && up2[k-VW] && dist[i-VW] < 0) { dist[i-VW] = d; q[tail++] = i-VW; }
    }
    const j = link[i];                    // F2.6: escalera (pileta o techo) = un vecino más
    if (j >= 0 && dist[j] < 0) { dist[j] = d; q[tail++] = j; }
  }
  return true;
}

//--- pool de meshes (se crean una vez) ---
function zGeo(w, h, d) {
  const k = w + '_' + h + '_' + d;
  return ZGEO[k] || (ZGEO[k] = new THREE.BoxGeometry(w, h, d));
}
function zPart(w, h, d, mat, x, y, z, parent, pivotTop) {
  const m = new THREE.Mesh(zGeo(w, h, d), mat);
  if (pivotTop) {                       // pivote arriba (hombro / cadera)
    const g = new THREE.Group();
    g.position.set(x, y, z);
    m.position.y = -h / 2;
    g.add(m); parent.add(g);
    return { pivot: g, mesh: m };
  }
  m.position.set(x, y, z); parent.add(m);
  return { pivot: m, mesh: m };
}
function createZombie(i) {
  const C = CONFIG.ZOMBIE;
  // materiales propios por zombie: permiten el flash de impacto individual
  const skin  = new THREE.MeshLambertMaterial({ color: C.skinColor });
  const shirt = new THREE.MeshLambertMaterial({ color: ZSHIRTS[i % ZSHIRTS.length] });
  const pants = new THREE.MeshLambertMaterial({ color: 0x3f3a33 });
  const root = new THREE.Group();
  const body = new THREE.Group();       // lo que colapsa al morir (pivote en los pies)
  root.add(body);

  const legL  = zPart(0.22, 0.80, 0.24, pants, -0.14, 0.80, 0, body, true);
  const legR  = zPart(0.22, 0.80, 0.24, pants,  0.14, 0.80, 0, body, true);
  const torso = zPart(0.56, 0.68, 0.30, shirt,  0,    1.14, 0, body);
  const head  = zPart(0.40, 0.40, 0.40, skin,   0,    1.70, 0.03, body);
  const armL  = zPart(0.16, 0.62, 0.16, skin,  -0.37, 1.40, 0, body, true);
  const armR  = zPart(0.16, 0.62, 0.16, skin,   0.37, 1.40, 0, body, true);
  const eyeL = new THREE.Mesh(zGeo(0.08, 0.05, 0.02), ZMAT.eye);
  const eyeR = new THREE.Mesh(zGeo(0.08, 0.05, 0.02), ZMAT.eye);
  eyeL.position.set(-0.09, 0.03, 0.205); eyeR.position.set(0.09, 0.03, 0.205);
  head.mesh.add(eyeL); head.mesh.add(eyeR);
  const eyes = [eyeL, eyeR];                                     // F5.11: rojos en el búnker (setZombieEyes)

  const z = {
    id: i, root, body,
    head: head.mesh, armL: armL.pivot, armR: armR.pivot, legL: legL.pivot, legR: legR.pivot,
    flashMats: [skin, shirt, pants], hitParts: [],
    active: false, alive: false, state: 'idle', mode: 'flow', t: 0,
    px: 0, pz: 0, sx: 0, sz: 0, wantX: 0, wantZ: 0,
    nudgeX: 0, nudgeZ: 0, nudgeT: 0,
    heading: 0, health: 0, speed: 0, attackCd: 0, swingT: 0,
    walkT: Math.random() * 6, stuckT: 0, lastX: 0, lastZ: 0, strikes: 0, flash: 0,
    kbX: 0, kbZ: 0, kbT: 0,     // empujón visual por impacto
    voice: 0.8 + Math.random() * 0.45, growlT: 0,  // audio: tono propio de cada zombie
    kind: 'normal', dog: false, crawl: false, legDmg: 0, maxHealth: 0,   // F4
    shirtColor: ZSHIRTS[i % ZSHIRTS.length], eyes, redEyes: false,
    // F7b: renguera propia (0..1), brazos que se pueden perder, pose de muerte y tipo de ataque
    limp: Math.random(), armOff: { L: false, R: false }, deathPose: null, deathSide: 1, atk: null
  };
  // F5.20 (Diego): variantes. Piezas extra hijas de las partes (no están en hitParts: la bala le pega a la parte). Se
  // arman una vez y setZombieVariant prende las de cada variante
  const X = z.extras = { blood: [], shorts: [], horror: [], black: [] };
  const add = (list, parent, w, h, d, mat, x, y, zz, rx, rz) => {
    const m = new THREE.Mesh(zGeo(w, h, d), mat); m.position.set(x, y, zz); m.rotation.set(rx || 0, 0, rz || 0);
    m.visible = false; parent.add(m); list.push(m); return m;
  };
  add(X.blood, torso.mesh, 0.26, 0.22, 0.02, ZMAT.blood, 0.09, 0.06, 0.156, 0, 0.2);    // manchas de sangre y golpes
  add(X.blood, torso.mesh, 0.14, 0.3, 0.02, ZMAT.blood, -0.15, -0.12, 0.156);
  add(X.blood, torso.mesh, 0.02, 0.24, 0.18, ZMAT.blood, 0.285, 0.05, 0.02);
  add(X.blood, head.mesh, 0.16, 0.12, 0.02, ZMAT.blood, 0.08, 0.1, 0.206);
  add(X.blood, head.mesh, 0.1, 0.18, 0.02, ZMAT.bruise, -0.12, -0.02, 0.206);
  add(X.blood, armR.mesh, 0.17, 0.2, 0.17, ZMAT.blood, 0, 0.1, 0);
  add(X.shorts, legL.mesh, 0.23, 0.42, 0.25, skin, 0, -0.2, 0);                         // shorts: pantorrillas de piel
  add(X.shorts, legR.mesh, 0.23, 0.42, 0.25, skin, 0, -0.2, 0);
  add(X.horror, torso.mesh, 0.34, 0.36, 0.02, ZMAT.cavity, 0, 0.02, 0.152);             // pecho abierto con costillas
  for (let k = 0; k < 4; k++) add(X.horror, torso.mesh, 0.36, 0.035, 0.03, ZMAT.bone, 0, 0.14 - k * 0.09, 0.16);
  add(X.horror, head.mesh, 0.26, 0.08, 0.22, skin, 0, -0.26, 0.05, 0.5);                // mandíbula colgando
  add(X.horror, head.mesh, 0.18, 0.16, 0.02, ZMAT.bone, -0.08, 0.1, 0.206);             // hueso a la vista
  add(X.horror, head.mesh, 0.02, 0.2, 0.2, ZMAT.cavity, 0.206, 0, 0);
  add(X.black, torso.mesh, 0.04, 0.4, 0.02, ZMAT.crack, 0.06, 0, 0.156, 0, 0.3);         // grietas que brillan (el negro)
  add(X.black, torso.mesh, 0.03, 0.3, 0.02, ZMAT.crack, -0.1, 0.1, 0.156, 0, -0.5);
  add(X.black, head.mesh, 0.03, 0.2, 0.02, ZMAT.crack, -0.05, 0.12, 0.206, 0, 0.4);
  head.mesh.userData = { type: 'zombieHead', zombie: z };
  head.mesh.rotation.z = (Math.random() - 0.5) * 0.5;   // cabeza ladeada, cada uno distinto
  z.hitParts.push(head.mesh);
  [torso, armL, armR, legL, legR].forEach(p => {
    // F4: piernas -> arrastrado. F7b: brazos -> se pueden arrancar
    const part = p === legL || p === legR ? 'leg' : p === armL ? 'armL' : p === armR ? 'armR' : undefined;
    p.mesh.userData = { type: 'zombieBody', zombie: z, part };
    z.hitParts.push(p.mesh);
  });
  root.visible = false;
  scene.add(root);
  return z;
}
// F5.20: variante del zombie humano: 'normal' | 'beaten' (sangre y golpes) | 'shorts' | 'horror' (desde la R10: pecho
// abierto, mandíbula colgando, piel podrida) | 'black' (desde la R15: todo negro, ojos rojos, grietas; si te acercás, explota)
function rollVariant(n) {
  const V = CONFIG.ZOMBIE.variants, r = Math.random();
  if (n >= V.black.from && r < V.black.chance) return 'black';
  const r2 = Math.random();
  if (n >= V.horror.from && r2 < V.horror.chance) return 'horror';
  const r3 = Math.random();
  return r3 < V.beaten ? 'beaten' : r3 < V.beaten + V.shorts ? 'shorts' : 'normal';
}
function setZombieVariant(z, v) {
  const X = z.extras, V = CONFIG.ZOMBIE.variants;
  if (!X) return;
  z.variant = v; z.fuseT = 0; z.root.scale.setScalar(1);          // (si lo mataron inflado)
  for (const k in X) for (const m of X[k]) m.visible = false;
  const on = k => X[k].forEach(m => { m.visible = true; });
  if (v === 'beaten' || v === 'horror') on('blood');
  if (v === 'shorts') on('shorts');
  if (v === 'horror') on('horror');
  if (v === 'black') on('black');
  if (v === 'horror') { z.flashMats[0].color.setHex(V.horror.skin); z.flashMats[1].color.setHex(V.horror.shirt); }
  if (v === 'black') { for (const m of z.flashMats) m.color.setHex(V.black.color); }
  else z.flashMats[2].color.setHex(0x3f3a33);                       // pantalón de siempre
  setZombieEyes(z, v === 'black' || z.redEyes);
}
// F5.20: el negro se infla fuseTime s cuando te tiene cerca y explota: daño en área (a vos y a los zombies)
function blackFuse(z, dt, distP) {
  const V = CONFIG.ZOMBIE.variants.black;
  if (!z.fuseT && distP < V.trigger && (z.level || 0) === playerLevel()) { z.fuseT = V.fuseTime; if (typeof sfxPin === 'function') sfxPin(); }
  if (!z.fuseT) return false;
  z.fuseT = Math.max(0, z.fuseT - dt);
  const k = 1 - z.fuseT / V.fuseTime;
  z.root.scale.setScalar(1 + 0.25 * k + Math.sin(k * 40) * 0.03 * k);
  ZMAT.crack.color.setRGB(1, 0.23 + 0.6 * k, 0.06);
  if (z.fuseT > 0) return true;
  const x = z.px, y = (z.level ? lvY(z.level) : groundY(z.px, z.pz)) + 1, zz = z.pz;
  z.root.scale.setScalar(1);
  damageZombie(z, z.health + 1, false, CONFIG.POINTS.kill, 0);
  explodeAt(x, y, zz, { damage: V.zombieDamage, radius: V.radius, self: V.damage, color: 0xff3a10, src: 'black' });
  ZMAT.crack.color.setHex(0xff3a10);                                // (el material de las grietas es compartido)
  return true;
}
// F5.11: ojos rojos (los que bajaron o salieron en el búnker). Solo zombies (perros, calamares y bosses tienen los suyos)
function setZombieEyes(z, red) {
  if (!z.eyes || z.redEyes === red) return;
  z.redEyes = red;
  for (const e of z.eyes) e.material = red ? ZMAT.eyeRed : ZMAT.eye;
}
function buildZombiePool() {
  ZMAT.eye = new THREE.MeshBasicMaterial({ color: 0xffa531 });
  ZMAT.eyeRed = new THREE.MeshBasicMaterial({ color: 0xff1a10 });   // F5.11
  ZMAT.stump = new THREE.MeshBasicMaterial({ color: 0x6a0808 });     // F7b: la herida de los pedazos
  // F5.20: variantes (sangre, moretón, hueso, pecho abierto, grietas del negro que brillan)
  ZMAT.blood = new THREE.MeshLambertMaterial({ color: 0x5a0a08 });
  ZMAT.bruise = new THREE.MeshLambertMaterial({ color: 0x3a2a4a });
  ZMAT.bone = new THREE.MeshLambertMaterial({ color: 0xd8ccb0 });
  ZMAT.cavity = new THREE.MeshLambertMaterial({ color: 0x2a0606 });
  ZMAT.crack = new THREE.MeshBasicMaterial({ color: 0xff3a10 });
  for (let i = 0; i < CONFIG.ZOMBIE.poolSize; i++) ZPOOL.push(createZombie(i));
  buildGibs();                                                      // F7b
  const bad = SPAWN_POINTS.filter(sp => !sp.valid);
  if (bad.length) console.warn('Spawn points fuera del grid:', bad);
}

//--- visibilidad: frustum + línea de vista contra el mundo ---
const _frus = new THREE.Frustum(), _pm = new THREE.Matrix4();
const _sph = new THREE.Sphere(new THREE.Vector3(), 0.7);
const _v3 = new THREE.Vector3(), _d3 = new THREE.Vector3();
const losRay = new THREE.Raycaster();            // separado del raycaster de armas
function isVisibleToPlayer(x, z) {
  camera.updateMatrixWorld();
  _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frus.setFromProjectionMatrix(_pm);
  const g = groundY(x, z);
  _sph.center.set(x, g + 1.0, z);
  if (!_frus.intersectsSphere(_sph)) return false;
  for (const y of [0.6, 1.7]) {
    _v3.set(x, g + y, z);
    _d3.copy(_v3).sub(camera.position);
    const d = _d3.length();
    if (d < 0.01) return true;
    _d3.divideScalar(d);
    losRay.set(camera.position, _d3);
    losRay.far = d - 0.1;
    if (losRay.intersectObjects(WORLD.hitMeshes, false).length === 0) return true;
  }
  return false;
}

//--- spawn ---
// "solo cuartos abiertos" = el punto es alcanzable en el flow field.
// Un cuarto tras puerta cerrada tiene distancia -1: nunca spawnea ahí.
// F4: sea = los de la orilla (solo ahogados). Esos no miran si los ves: salen del agua a la vista
// room (F5.6): solo spawns de ese cuarto (los perros del jardín trasero)
function pickSpawnPoint(sea, room) {
  const C = CONFIG.ZOMBIE, P = player.pos, md = sea ? CONFIG.DROWNED.minDist : C.spawnMinDist, min2 = md * md;
  const cand = [];
  for (const sp of SPAWN_POINTS) {
    if (!sp.valid || !sp.sea !== !sea || (room && sp.room !== room)) continue;
    const d = flowAt(sp.cx, sp.cz);
    if (d < 0) continue;
    const dx = sp.x - P.x, dz = sp.z - P.z;
    if (dx * dx + dz * dz < min2) continue;
    let busy = false;
    for (const z of state.zombies) {
      if (z.alive && (z.px - sp.x) ** 2 + (z.pz - sp.z) ** 2 < 1.0) { busy = true; break; }
    }
    if (busy) continue;
    const bar = sp.bar && CONFIG.BARRIERS.enabled;                 // F5.19b: la ventana puede estar a la vista (como en BO)
    if (bar && sp.bar.occ) continue;
    // F5.19c (bug del playtest): el búnker es chico y sus spawns siempre se ven; con vos adentro salen igual del piso
    const bunk = sp.room === 'R16' && typeof inBunker === 'function' && inBunker();
    if (!sea && !bar && !bunk && isVisibleToPlayer(sp.x, sp.z)) continue;
    cand.push({ sp, d });
  }
  if (!cand.length) return null;
  cand.sort((a, b) => a.d - b.d);                 // preferir cercanos por camino, no por aire
  return cand[Math.floor(Math.random() * Math.min(4, cand.length))].sp;
}
// F2.6: paso por ronda (CONFIG.ZOMBIE.gaitByRound): 'walk' | 'jog' | 'run'
function gaitMix(n) { return CONFIG.ZOMBIE.gaitByRound.find(r => n <= r.upTo).mix; }
function rollGait(n) {
  const mix = gaitMix(n), keys = Object.keys(mix);
  let r = Math.random();
  for (const k of keys) { r -= mix[k]; if (r < 0) return k; }
  return keys[keys.length - 1];
}
// kind (F4): 'normal' | 'drowned'. Los perros (z.dog) salen de su propio pool, siempre 'dog'.
// Respawn (keepHealth): misma vida, mismo paso, mismo tipo y sigue arrastrándose si ya lo hacía
function resetZombie(z, sp, keepHealth, kind) {
  const C = CONFIG.ZOMBIE, D = CONFIG.DOGS, DR = CONFIG.DROWNED, n = Math.max(1, state.round);
  z.active = true; z.alive = true; z.state = 'emerge'; z.mode = 'flow'; z.t = 0;
  z.px = sp.x + (Math.random() - 0.5) * 0.3;
  z.pz = sp.z + (Math.random() - 0.5) * 0.3;
  z.sx = z.sz = z.wantX = z.wantZ = 0; z.nudgeT = 0; z.climb = null; z.level = 0;   // F2.8: siempre spawnea en el piso
  z.emergeT = 0; z.digDepth = 1; z.fromClam = false;              // F5.14: los pone la almeja
  z.fromPlant = false;                                             // F5.20: los llama la planta jefa del templo
  if (!keepHealth) {
    z.kind = z.boss ? 'boss' : z.dog ? 'dog' : z.squid ? 'squid' : (kind || 'normal');
    z.crawl = false; z.legDmg = 0;
    if (z.boss) { z.health = CONFIG.BOSS.health(n); z.gait = 'walk'; }   // F5
    else if (z.squid) {                                      // F5.9: nace chico; crece al fusionarse
      z.health = CONFIG.SQUID.health(n); z.gait = 'run';
      z.fused = 0; setSquidSize(z); z.inkT = 1 + Math.random() * CONFIG.SQUID.ink.rest; z.jetT = 0; z.jetAcc = 0;
    }
    else if (z.dog) {                                        // F5.8: tres tamaños al azar; la vida sube con el tamaño
      z.size = D.sizes[Math.floor(Math.random() * D.sizes.length)];
      z.health = D.health(n) * z.size; z.gait = 'run';
      z.root.scale.setScalar(z.size); z.rad = D.radius * z.size;
    }
    else if (z.kind === 'drowned') { z.health = C.health(n) * DR.healthMul; z.gait = DR.gait; }
    else { z.health = C.health(n); z.gait = rollGait(n); }
    z.maxHealth = z.health;
  }
  else if (!z.gait) z.gait = rollGait(n);                     // respawn: misma vida y mismo paso
  const r = Math.random() * 2 - 1;
  const base = z.boss ? bossSpeed(z) : z.dog ? D.speed * (1 + r * D.speedJitter) : z.squid ? CONFIG.SQUID.speed
             : C.gaits[z.gait].speed * (1 + r * C.speedJitter);
  // nunca más que el jugador caminando. F5.8: excepción aprobada por Diego, los perros van a DOGS.speed (4.7)
  z.speed = Math.min(base, z.crawl ? CONFIG.CRAWLER.speed : Infinity, speedCap(z));
  z.attackCd = 0.5; z.swingT = 0; z.flash = 0; z.kbT = 0;
  z.growlT = 1 + Math.random() * CONFIG.AUDIO.growlMax;
  z.stuckT = 0; z.strikes = 0; z.lastX = z.px; z.lastZ = z.pz;
  z.heading = Math.atan2(player.pos.x - z.px, player.pos.z - z.pz);
  z.head.visible = true;
  z.body.rotation.set(0, 0, 0); z.body.position.set(0, 0, 0);
  z.flashMats.forEach(m => m.emissive.setHex(0));
  if (!z.dog && !z.boss && !z.squid) {                        // piel y camisa del ahogado, o las de siempre
    const dr = z.kind === 'drowned';
    z.flashMats[0].color.setHex(dr ? DR.skinColor : C.skinColor);
    z.flashMats[1].color.setHex(dr ? DR.shirtColor : z.shirtColor);
    setCrawlLeg(z);
    // F7b: vuelve entero (cabeza y brazos), sin pose de muerte ni ataque a medias
    if (!keepHealth) { z.armOff.L = z.armOff.R = false; }
    z.head.scale.setScalar(1); setArm(z, 'L'); setArm(z, 'R');
    z.legL.rotation.set(0, 0, 0); if (!z.crawl) z.legR.rotation.set(0, 0, 0);
    z.deathPose = null; z.atk = null; z.body.rotation.y = 0;
  }
  z.root.position.set(z.px, -1.95, z.pz);
  z.root.rotation.set(0, z.heading, 0);                        // F5.10: la planta lo sacude al comerlo
  if (!keepHealth) z.summoned = false;                          // F5.10: lo marca bossSummon (tope de invocados)
  z.burnT = 0;                                                  // F5.10: Kaboom
  if (!keepHealth) z.fromGiant = false;                         // F5.11: lo marca el calamar gigante al escupirlo
  if (!keepHealth) setZombieEyes(z, groundY(sp.x, sp.z) < -1);  // F5.11: nace en el búnker = ojos rojos
  // F5.20: variante (solo zombies humanos comunes; el respawn conserva la suya). Adentro del caparazón nacen arrastrados
  if (!z.dog && !z.squid && !z.boss) {
    if (!keepHealth) z.variant = z.kind === 'normal' ? rollVariant(n) : 'normal';
    setZombieVariant(z, z.variant || 'normal');
    if (!keepHealth && sp.room === 'R21' && CONFIG.ZOMBIE.shellCrawl && !z.crawl) {
      z.crawl = true; setCrawlLeg(z); z.speed = Math.min(z.speed, CONFIG.CRAWLER.speed);
    }
  }
  if (z.eaten) { z.eaten = null; if (!z.dog && !z.squid && !z.boss) z.root.scale.setScalar(1); }
  z.root.visible = true;
  barrierFree(z); barrierSpawn(z, sp);                          // F5.19b: ventana, trampilla o salto (barriers.js)
}
// F4: arrastrado = sin la pierna derecha. Escala casi 0 (el raycaster de r128 no mira .visible)
function setCrawlLeg(z) {
  z.legR.scale.setScalar(z.crawl ? 1e-3 : 1);
  z.legR.visible = !z.crawl;
}
// F7b: brazo arrancado = escala casi 0 (igual que la pierna)
function setArm(z, s) {
  const a = s === 'L' ? z.armL : z.armR, off = z.armOff[s];
  a.scale.setScalar(off ? 1e-3 : 1); a.visible = !off;
}
function spawnZombie() {
  const z = ZPOOL.find(q => !q.active);
  if (!z) return null;
  let sp = null, kind = 'normal';
  if (wantDrowned()) { sp = pickSpawnPoint(true); if (sp) kind = 'drowned'; }
  if (!sp) sp = pickSpawnPoint(false);
  if (!sp) return null;
  resetZombie(z, sp, false, kind);
  state.zombies.push(z);
  return z;
}
function respawnZombie(z) {               // atascado/perdido: reaparece fuera de vista, misma vida
  const sp = pickSpawnPoint();
  if (!sp) return false;
  resetZombie(z, sp, true);
  return true;
}
function deactivateZombie(z) {
  barrierFree(z);                                               // F5.19b
  z.active = false; z.alive = false; z.state = 'idle';
  z.root.visible = false;
}

//--- daño ---
// killPoints: override para el bonus de kill (el cuchillo siempre da 130, headshot o no).
// Sin ese argumento usa el criterio normal de arma de fuego (60 / 130 headshot).
// hitPoints: override de los puntos por impacto no letal (el lanzallamas pasa 0).
// part (F4/F5): la parte que recibió el golpe (userData.part): 'leg' -> si las piernas suman CRAWLER.legFrac de
// su vida y sigue vivo, se arrastra · 'hat' -> sombrero del boss, daño ×BOSS.hatMul
function damageZombie(z, dmg, headshot, killPoints, hitPoints, part) {
  if (!z || !z.alive) return;
  if (part === 'hat') dmg *= CONFIG.BOSS.hatMul;
  // insta-kill: cualquier golpe es letal, sin importar el daño real de origen (F5: salvo el boss).
  // El número flotante ya se calculó con el dmg original (se ve normal, no "99999").
  if (state.effects.instakill > 0 && !z.boss) dmg = Math.max(dmg, z.health);
  if (headshot && gumActive('deadaim')) dmg *= CONFIG.GUMS.list.deadaim.mul;   // F5.28d: DEAD AIM
  if (gumActive('killingtime') && !z.boss) z.ktMark = GUMM.ktGen;   // F5.28d: KILLING TIME, muere cuando termina
  z.health -= dmg;
  if (part === 'leg' && !z.dog && !z.boss && !z.crawl && z.health > 0 &&
      (z.legDmg += dmg) >= CONFIG.CRAWLER.legFrac * z.maxHealth) startCrawl(z);
  if (z.boss && z.health > 0) bossDamaged(z, dmg, part === 'hat');
  // F7b: un golpe fuerte al brazo lo arranca (sigue vivo)
  if ((part === 'armL' || part === 'armR') && z.health > 0 && isHuman(z) && dmg >= CONFIG.GORE.armFrac * z.maxHealth) loseArm(z, part.slice(3));
  z.flash = CONFIG.FEEL.flashTime;
  z.flashMats.forEach(m => m.emissive.setHex(CONFIG.FEEL.flashColor));
  if (z.health <= 0) {
    z.alive = false; z.state = 'dying'; z.t = 0;
    if (headshot) z.head.visible = false;
    goreKill(z, headshot);                                     // F7b: cabeza, pedazos y pose de muerte
    state.kills++;
    STATS.killsBy[STATS.src] = (STATS.killsBy[STATS.src] || 0) + 1;
    if (headshot) STATS.headshots++;
    addXP(CONFIG.PROGRESSION.xp.kill + (headshot ? CONFIG.PROGRESSION.xp.headshot : 0));   // F5.18
    addWeaponXP(STATS.src, CONFIG.PROGRESSION.xp.kill + (headshot ? CONFIG.PROGRESSION.xp.headshot : 0));   // F5.19: nivel del arma
    { const t = clock.elapsedTime, K = MULTIKILL;                  // F5.19: varios kills seguidos -> el personaje festeja
      K.list = K.list.filter(v => t - v < K.window); K.list.push(t);
      if (K.list.length >= K.count) { voice('audio_personaje_al_matar_varios_zombies', 1, 20); K.list.length = 0; } }
    addPoints(killPoints !== undefined ? killPoints : (headshot ? CONFIG.POINTS.headshotKill * (gumActive('headhunter') ? 2 : 1) : CONFIG.POINTS.kill));   // F5.20: HEADHUNTER
    onZombieDeath(z);
    if (gumActive('scavenger')) gumScavenge();                    // F5.28d: SCAVENGER
  } else {
    const hp = hitPoints !== undefined ? hitPoints : CONFIG.POINTS.hit;
    if (hp > 0) addPoints(hp);
  }
}

//--- F7b: desmembramiento. Pedazos (brazo, pierna, cabeza) de un pool fijo con física simple ---
const GIBS = { list: [] };
const _gv = new THREE.Vector3();
function isHuman(z) { return !z.dog && !z.squid && !z.boss; }
const MULTIKILL = { list: [], count: 4, window: 2 };              // F5.19: 4 kills en 2 s
function buildGibs() {
  for (let i = 0; i < CONFIG.GORE.gibs; i++) {
    const m = new THREE.Mesh(zGeo(0.16, 0.62, 0.16), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    const stump = new THREE.Mesh(zGeo(0.1, 0.02, 0.1), ZMAT.stump);     // la herida
    m.add(stump);
    m.visible = false; scene.add(m);
    GIBS.list.push({ m, stump, v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0, h: 0, rest: false });
  }
}
// un pedazo que sale de `from` (Object3D del cuerpo) con la forma [w, h, d] y el color de `mat`
function spawnGib(from, dims, color, dirX, dirZ) {
  const G = CONFIG.GORE;
  let g = GIBS.list.find(o => o.life <= 0);
  if (!g) g = GIBS.list.reduce((a, b) => (a.life < b.life ? a : b));           // el más viejo
  from.updateMatrixWorld(true);
  from.getWorldPosition(_gv);
  g.m.geometry = zGeo(dims[0], dims[1], dims[2]);
  g.m.material.color.setHex(color);
  g.stump.position.set(0, dims[1] / 2 + 0.005, 0);
  g.m.position.copy(_gv); g.m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  const out = randIn(G.out), a = Math.atan2(dirX, dirZ) + (Math.random() - 0.5) * 1.6;
  g.v.set(Math.sin(a) * out, randIn(G.up), Math.cos(a) * out);
  g.w.set((Math.random() - 0.5) * G.spin, (Math.random() - 0.5) * G.spin, (Math.random() - 0.5) * G.spin);
  g.life = G.life; g.h = dims[1] / 2; g.rest = false; g.m.visible = true;
  spawnSplashFx(_gv.x, _gv.y, _gv.z, 0x7a0a0a, 0.7);                          // chorro de sangre
  return g;
}
function loseArm(z, s) {
  if (z.armOff[s]) return;
  z.armOff[s] = true;
  const a = s === 'L' ? z.armL : z.armR;
  spawnGib(a.children[0] || a, [0.16, 0.62, 0.16], z.flashMats[0].color.getHex(), z.px - player.pos.x, z.pz - player.pos.z);
  setArm(z, s);
}
function loseLeg(z) {                                                         // desde startCrawl (F4)
  if (!isHuman(z)) return;
  spawnGib(z.legR.children[0] || z.legR, [0.22, 0.8, 0.24], 0x3f3a33, z.px - player.pos.x, z.pz - player.pos.z);
}
function pickW(list) {
  let r = Math.random() * list.reduce((s, o) => s + o[1], 0);
  for (const [k, w] of list) if ((r -= w) <= 0) return k;
  return list[0][0];
}
// al morir: pose, cabeza (headshot) y pedazos (explosivos)
function goreKill(z, headshot) {
  if (!isHuman(z) || z.eaten) return;
  const G = CONFIG.GORE, dx = z.px - player.pos.x, dz = z.pz - player.pos.z;
  z.deathPose = z.crawl ? 'crawl' : pickW(G.poses);
  z.deathSide = Math.random() < 0.5 ? -1 : 1;
  if (headshot && Math.random() < G.headChance) {                             // cabeza = kill: sale volando
    spawnGib(z.head, [0.4, 0.4, 0.4], z.flashMats[0].color.getHex(), dx, dz);
    z.head.scale.setScalar(1e-3);
  }
  if (G.explosive.includes(STATS.src)) {                                     // explosión: brazos y piernas
    z.deathPose = 'back';
    const n = G.blast[0] + Math.floor(Math.random() * (G.blast[1] - G.blast[0] + 1));
    const parts = ['L', 'R'].filter(s => !z.armOff[s]).map(s => () => loseArm(z, s));
    if (!z.crawl) parts.push(() => { loseLeg(z); z.legR.scale.setScalar(1e-3); z.legR.visible = false; });   // resetZombie la devuelve
    parts.sort(() => Math.random() - 0.5).slice(0, n).forEach(f => f());
  }
}
function updateGibs(dt) {
  const G = CONFIG.GORE;
  for (const g of GIBS.list) {
    if (g.life <= 0) continue;
    g.life -= dt;
    if (g.life <= 0) { g.m.visible = false; continue; }
    const p = g.m.position;
    if (g.life < 1) g.m.scale.setScalar(Math.max(0.01, g.life));             // se achica al final
    else g.m.scale.setScalar(1);
    if (g.rest) continue;
    g.v.y -= 9.8 * dt;
    const nx = p.x + g.v.x * dt, nz = p.z + g.v.z * dt;
    if (projBlocked(nx, p.y, nz)) { g.v.x *= -0.3; g.v.z *= -0.3; }         // contra una pared, rebota y cae
    else { p.x = nx; p.z = nz; }
    p.y += g.v.y * dt;
    g.m.rotation.x += g.w.x * dt; g.m.rotation.y += g.w.y * dt; g.m.rotation.z += g.w.z * dt;
    const floor = floorUnder(p.x, p.z, p.y) + g.h * 0.4;
    if (p.y <= floor) {
      p.y = floor;
      if (Math.abs(g.v.y) < 1.2) { g.rest = true; g.m.rotation.x = Math.PI / 2; g.m.rotation.z = 0; }   // queda acostado
      else { g.v.y = -g.v.y * G.bounce; g.v.x *= G.friction; g.v.z *= G.friction; g.w.multiplyScalar(0.5); }
    }
  }
}
// piso debajo de un pedazo: el techo si está arriba de él, si no el terreno
function floorUnder(x, z, y) { return y > UP2.y - 0.2 && roof2At(x, z) ? UP2.y : y > UP.y - 0.2 && roofAt(x, z) ? UP.y : groundY(x, z); }
function resetGibs() { for (const g of GIBS.list) { g.life = 0; g.m.visible = false; g.m.scale.setScalar(1); } }

// F5.15 (costo): la línea libre del tramo directo se recalcula cada ZOMBIE.losCache s por zombie (con 24 pegados al
// jugador, un segmentClear por zombie y por frame era ~0.3 ms). Hacia el langostino no se guarda (otro destino)
function directClear(z, P, L, lure) {
  if (lure) return segmentClear(z.px, z.pz, P.x, P.z, 0.2, false, undefined, L);
  const t = clock.elapsedTime;
  if (t < (z.losUntil || 0) && z.losLevel === L) return z.losOk;
  z.losOk = segmentClear(z.px, z.pz, P.x, P.z, 0.2, false, L === 0 ? playerOnTop() : undefined, L);
  z.losUntil = t + CONFIG.ZOMBIE.losCache * (0.8 + 0.4 * Math.random());   // desfasados: no todos en el mismo frame
  z.losLevel = L;
  return z.losOk;
}

//--- IA: decidir dirección deseada ---
// P = a dónde va (el jugador, o F5.11 el langostino con tLevel 0)
// F5.18: con el jugador tirado (Quick Revive), se alejan en línea recta hasta lastStand.flee m y esperan
function fleeZombie(z, P) {
  const dx = z.px - P.x, dz = z.pz - P.z, d = Math.hypot(dx, dz);
  if (d >= CONFIG.PERKS.lastStand.flee) { z.mode = 'direct'; return; }
  if (d < 1e-3) { z.wantX = 1; z.wantZ = 0; } else { z.wantX = dx / d; z.wantZ = dz / d; }
  z.mode = 'direct';
}
function steerZombie(z, P, tLevel) {
  const lure = tLevel !== undefined;
  const C = CONFIG.ZOMBIE, L = z.level || 0, same = L === (lure ? tLevel : playerLevel());   // F2.8: nivel del zombie
  const dxp = P.x - z.px, dzp = P.z - z.pz, distP = Math.hypot(dxp, dzp);
  // F5: el boss es ancho: se frena antes (si no, empuja al jugador con el cuerpo todo el tiempo)
  const stop = z.boss ? CONFIG.BOSS.bodyRadius + CONFIG.PLAYER.radius + 0.05 : C.stopDist;
  if (same && distP < stop) { z.mode = 'direct'; return; }

  // 1) tramo final: directo solo con línea libre (nunca seek a través de paredes) y en el mismo nivel
  if (same && distP < C.directRange && directClear(z, P, L, lure)) {
    z.wantX = dxp / distP; z.wantZ = dzp / distP; z.mode = 'direct';
    return;
  }
  const cx = Math.floor(z.px), cz = Math.floor(z.pz);
  let tx, tz;
  if (!lvNav(L, cx, cz)) {
    // 2) fuera del grid (margen de pared): volver a la celda válida más cercana (con línea libre: no
    //    apuntar a una celda del otro lado del borde de la piscina)
    const n = L >= 1 ? nearestUp(cx, cz, C.recoverRadius, z.px, z.pz, L) : nearestNav(cx, cz, C.recoverRadius, z.px, z.pz, true);
    if (!n) { z.mode = 'lost'; return; }
    tx = n.x + 0.5; tz = n.z + 0.5; z.mode = 'recover';
  } else {
    // 3) flow field: vecino con menor distancia, sin cortar esquinas en diagonal
    const here = lvFlow(L, cx, cz);
    if (here < 0) { z.mode = 'unreachable'; return; }
    if (here === 0) { z.wantX = dxp / distP; z.wantZ = dzp / distP; z.mode = 'direct'; return; }
    let best = here, bx = 0, bz = 0;
    for (let k = 0; k < 8; k++) {
      const dx = DIRS8[k][0], dz = DIRS8[k][1];
      if (dx && dz && (!lvNav(L, cx + dx, cz) || !lvNav(L, cx, cz + dz))) continue;
      const f = lvFlow(L, cx + dx, cz + dz);
      if (f >= 0 && f < best) { best = f; bx = dx; bz = dz; }
    }
    // F2.6: parado en una punta de escalera y la otra punta está más cerca del jugador -> trepar
    const li = NAV.link[lvIdx(L, cx, cz)];
    if (li >= 0 && FLOW.dist[li] >= 0 && FLOW.dist[li] < best) { startClimb(z, li, lvIdx(L, cx, cz)); return; }
    tx = cx + bx + 0.5; tz = cz + bz + 0.5; z.mode = 'flow';
  }
  const ex = tx - z.px, ez = tz - z.pz, el = Math.hypot(ex, ez);
  if (el > 1e-4) { z.wantX = ex / el; z.wantZ = ez / el; }
}

//--- F2.6: escaleras de la piscina ---
// Tramo A (donde está) -> B (pie de la pared, de su lado) -> C (otro lado de la pared) -> D (celda destino).
// A->B y C->D caminando; B->C trepando (sube) o dejándose caer (baja). Sin colisión: el borde de la
// piscina es una pared para los zombies. La lógica (px, pz) avanza con el cuerpo: si muere a mitad, cae ahí.
// F2.8: `from` = celda donde está; si el enlace tiene recorrido fijo (NAV.via: la escalera del techo), B y C
// son la base y el tope de los escalones y el tramo B->C se camina subiendo/bajando parejo
function startClimb(z, to, from) {
  const C = CONFIG.ZOMBIE, P = POOL, toL = idxLevel(to), toUp = toL > 0;   // F5.22: a cualquier nivel
  const [dx1, dz1] = idxCenter(to);
  const ay = z.level ? lvY(z.level) : groundY(z.px, z.pz), dy = toUp ? lvY(toL) : groundY(dx1, dz1), up = dy > ay;
  const ux = dx1 - z.px, uz = dz1 - z.pz, ul = Math.hypot(ux, uz) || 1, off = C.radius + 0.05;
  const spd = Math.max(1.5, z.speed * 0.7), via = NAV.via[from];
  let pts, t2;
  const t1of = p => Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]) / spd;
  const hatch = NAV.hatch && (from === NAV.hatch[0] || from === NAV.hatch[1]);
  if (hatch) {                                                   // F5.11: escotilla del búnker (escondido al cruzar)
    const B = CONFIG.BUNKER, down = from === NAV.hatch[0];
    const top = [B.hatch.x, B.hatch.z], bot = [B.ladder.x, B.ladder.z + 0.6];
    pts = [[z.px, z.pz], down ? top : bot, down ? bot : top, [dx1, dz1]];
    t2 = t1of(pts) + B.climbTime;
  } else if (via) {                                              // escalera del techo: por los escalones
    pts = [[z.px, z.pz], via[0], via[1], [dx1, dz1]];
    t2 = t1of(pts) + Math.hypot(via[1][0] - via[0][0], via[1][1] - via[0][1]) / spd;
  } else {                                                       // escalera de la pileta: por la pared
    // la pared = donde el tramo sale del rectángulo de la pileta (desde la punta de abajo)
    const lx = up ? z.px : dx1, lz = up ? z.pz : dz1, hx = up ? dx1 : z.px, hz = up ? dz1 : z.pz;
    const sx = hx - lx, sz = hz - lz;
    let te = 1;
    if (sx > 1e-6) te = Math.min(te, (P.x2 - lx) / sx); else if (sx < -1e-6) te = Math.min(te, (P.x1 - lx) / sx);
    if (sz > 1e-6) te = Math.min(te, (P.z2 - lz) / sz); else if (sz < -1e-6) te = Math.min(te, (P.z1 - lz) / sz);
    const wx = lx + sx * te, wz = lz + sz * te;
    pts = [[z.px, z.pz], [wx - ux / ul * off, wz - uz / ul * off], [wx + ux / ul * off, wz + uz / ul * off], [dx1, dz1]];
    t2 = t1of(pts) + (up ? C.climbUpTime : C.climbDownTime);
  }
  const t1 = t1of(pts);
  const t3 = t2 + Math.hypot(pts[3][0] - pts[2][0], pts[3][1] - pts[2][1]) / spd;
  z.climb = { pts, t1, t2, t3, ay, dy, up, stairs: !!via, toLevel: toL, hatch };
  z.state = 'climb'; z.t = 0; z.mode = 'flow';
  z.heading = Math.atan2(ux, uz);
}
function updateClimb(z, dt) {
  const c = z.climb, t = z.t, p = c.pts;
  let a, b, k, y;
  if (t < c.t1)      { a = p[0]; b = p[1]; k = c.t1 > 0 ? t / c.t1 : 1; y = c.ay; }
  else if (t < c.t2) {
    a = p[1]; b = p[2]; k = (t - c.t1) / (c.t2 - c.t1);
    const e = c.stairs ? k : c.up ? k * k * (3 - 2 * k) : k * k;   // escalones: parejo; pileta: sube suave, baja cayendo
    y = c.ay + (c.dy - c.ay) * e;
  } else             { a = p[2]; b = p[3]; k = Math.min(1, (t - c.t2) / Math.max(1e-4, c.t3 - c.t2)); y = c.dy; }
  if (c.hatch && t >= c.t1 && t < c.t2) {                       // F5.11: bajando/subiendo por la escotilla: escondido
    z.root.visible = false;                                      // (se queda en la boca de salida hasta aparecer;
    z.root.position.y = -50;                                     //  el raycaster no mira .visible: lejos de las balas)
    return;
  }
  if (c.hatch && !z.root.visible && t >= c.t2) {
    z.root.visible = true;
    if (c.dy < c.ay) setZombieEyes(z, true);                     // bajó al búnker: ojos rojos
  }
  z.px = a[0] + (b[0] - a[0]) * k; z.pz = a[1] + (b[1] - a[1]) * k;
  z.root.position.set(z.px, y, z.pz);
  z.root.rotation.y = z.heading;
  // pose: trepando, brazos arriba alternados; bajando, agachado con los brazos al frente
  const climbing = !c.stairs && !z.dog && !z.squid && !z.crawl && t >= c.t1 && t < c.t2, s = Math.sin(t * 11);   // por los escalones camina; perros y arrastrados, con su pose
  if (climbing && c.up) {
    z.armL.rotation.x = -Math.PI + 0.35 * s; z.armR.rotation.x = -Math.PI - 0.35 * s;
    z.legL.rotation.x = -0.5 * Math.max(0, s); z.legR.rotation.x = -0.5 * Math.max(0, -s);
    z.body.rotation.x = 0.25;
    z.body.position.y = 0.07 * Math.abs(s);                     // F7b: se impulsa con cada brazo
    z.head.rotation.x = -0.45;                                  // mirando para arriba
  } else if (climbing) {
    z.armL.rotation.x = z.armR.rotation.x = -1.2; z.legL.rotation.x = z.legR.rotation.x = -0.4;
    z.body.rotation.x = 0.1;
  } else animateZombie(z, dt, Math.max(1.5, z.speed * 0.7));
  if (t >= c.t3) {                                              // llegó: vuelve a caminar
    z.px = p[3][0]; z.pz = p[3][1]; z.level = c.toLevel;
    z.state = 'walk'; z.t = 0; z.climb = null; z.body.rotation.x = 0;
    if (isHuman(z)) { z.body.position.y = 0; z.head.rotation.x = 0; }   // F7b
    z.stuckT = 0; z.strikes = 0; z.lastX = z.px; z.lastZ = z.pz;
  }
}

// bloqueado por otro zombie = fila, no atasco
function inCrowd(z) {
  const r2 = CONFIG.ZOMBIE.separationRadius * CONFIG.ZOMBIE.separationRadius;
  for (const o of state.zombies) {
    if (o === z || !o.alive) continue;
    if ((o.px - z.px) ** 2 + (o.pz - z.pz) ** 2 < r2) return true;
  }
  return false;
}

//--- watchdog de atasco ---
function stuckWatch(z, dt, distP) {
  const C = CONFIG.ZOMBIE;
  z.stuckT += dt;
  if (z.mode === 'lost' || z.mode === 'unreachable') {
    if (z.stuckT > 1.0) { z.stuckT = 0; if (!isVisibleToPlayer(z.px, z.pz)) respawnZombie(z); }
    return;
  }
  if (z.stuckT < C.stuckCheck) return;
  const moved = Math.hypot(z.px - z.lastX, z.pz - z.lastZ);
  z.lastX = z.px; z.lastZ = z.pz; z.stuckT = 0;
  if (moved < C.stuckMinMove && distP > C.stuckIgnoreDist && !inCrowd(z)) {
    z.strikes++;
    const a = z.heading + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    z.nudgeX = Math.sin(a); z.nudgeZ = Math.cos(a); z.nudgeT = 0.5;
    if (z.strikes >= C.stuckStrikes && !isVisibleToPlayer(z.px, z.pz)) respawnZombie(z);
  } else {
    z.strikes = 0;
  }
}

// posición del mesh = lógica + empujón visual (smoothstep de vuelta). y es relativa al piso (groundY:
// 0 salvo en la piscina); la altura sale de la posición LÓGICA, no de la empujada
function placeRoot(z, y) {
  let ox = 0, oz = 0;
  if (z.kbT > 0) {
    const k = z.kbT / CONFIG.FEEL.knockbackTime, e = k * k * (3 - 2 * k);
    ox = z.kbX * e; oz = z.kbZ * e;
  }
  z.root.position.set(z.px + ox, y + (z.level ? lvY(z.level) : groundY(z.px, z.pz)), z.pz + oz);   // F2.8: arriba del techo (F5.22: o del nivel 2)
}

// F2.6: el paso (z.gait) cambia ritmo, apertura de piernas, inclinación, rebote y brazos. Mínimo visual
// para distinguir caminar / trotar / correr; la animación real es F7.
function animateZombie(z, dt, v) {
  if (z.boss) return animateBoss(z, dt, v);                  // F5 (boss.js)
  if (z.dog) return animateDog(z, dt, v);                    // F4 (enemies.js)
  if (z.squid) return animateSquid(z, dt, v);                // F5.9 (enemies.js)
  if (z.crawl) return animateCrawl(z, dt, v);
  const G = CONFIG.ZOMBIE.gaits[z.gait] || CONFIG.ZOMBIE.gaits.walk;
  const k = Math.min(1, v / 1.5);                            // 0 quieto -> 1 andando
  z.walkT += dt * G.stride * (2.2 + v * 1.0);
  // F5.15 (costo): cada rotación se calcula primero y se asigna UNA vez (cada asignación a una Euler de Three
  // recalcula el cuaternión: con 10 por zombie, animar 24 costaba ~0.3 ms por frame)
  const sn = Math.sin(z.walkT), sw = sn * k * G.swing;
  // F7b: renguera (cada uno la suya): la pierna derecha se arrastra y el cuerpo cae de ese lado
  const lp = z.limp * (1 - G.arms);
  // brazos: al frente (caminar) -> sueltos y hacia atrás, alternados con las piernas (correr)
  let arm = -Math.PI / 2 + (Math.PI / 2 - 0.3) * G.arms + Math.sin(z.walkT * 0.5) * 0.08 * (1 - G.arms);
  const armSw = sn * 0.8 * G.arms * k;
  let aL, aR, bx = G.lean * k, hx = Math.sin(z.walkT * 0.7 + z.limp * 5) * 0.12 * k;   // inclinación y cabeceo
  if (z.swingT > 0) {
    z.swingT -= dt;
    const p = 1 - Math.max(0, z.swingT) / 0.35, s = Math.sin(Math.PI * p);
    arm = -Math.PI / 2 + s * 0.9;                                // zarpazo hacia abajo (desde brazos al frente)
    aL = arm - armSw + 0.05; aR = arm + armSw - 0.05;
    // F7b: 3 ataques (se sortea uno por golpe): zarpazo, embestida con el cuerpo, mordida
    if (!z.atk) z.atk = pickW(CONFIG.GORE.attacks);
    if (z.atk === 'lunge') { bx += 0.45 * s; aL = aR = -1.8 + 0.3 * s; }
    else if (z.atk === 'bite') { bx += 0.3 * s; hx = 0.5 * s; aL = aR = -1.3; }
  } else { z.atk = null; aL = arm - armSw + 0.05; aR = arm + armSw - 0.05; }
  z.legL.rotation.x = sw;
  z.legR.rotation.x = -sw * (1 - 0.6 * lp);
  z.armL.rotation.x = aL;
  z.armR.rotation.x = aR;
  z.body.rotation.set(bx, Math.sin(z.walkT * 0.5) * 0.08 * k,                      // el torso gira un poco al andar
    sn * 0.05 * (1 - G.arms * 0.5) + Math.max(0, -sn) * 0.12 * lp * k);           // tambaleo + renguera
  z.body.position.y = Math.abs(sn) * G.bob * k;
  z.head.rotation.x = hx;
}
// F7b: poses de muerte. t = segundos desde que murió
function deathPose(z, t) {
  const p = Math.min(1, t / CONFIG.ZOMBIE.deathTime), e = p * p, b = z.body;
  switch (z.deathPose) {
    case 'front':                                              // de cara, con los brazos adelante
      b.rotation.x = Math.PI / 2 * e; b.position.y = -0.1 * p;
      z.armL.rotation.x = z.armR.rotation.x = -2.6 * p;
      break;
    case 'side':                                               // de costado, girando
      b.rotation.z = z.deathSide * Math.PI / 2 * e; b.rotation.y = z.deathSide * 0.6 * p; b.position.y = -0.1 * p;
      break;
    case 'knees': {                                            // cae de rodillas y después de cara
      const K = CONFIG.GORE.kneeTime, a = Math.min(1, t / (K * 0.45)), c = Math.max(0, (t - K * 0.45) / (K * 0.55));
      b.position.y = -0.55 * a;
      z.legL.rotation.x = z.legR.rotation.x = 1.3 * a;         // piernas dobladas hacia atrás
      z.armL.rotation.x = z.armR.rotation.x = -0.3 * a;
      b.rotation.x = Math.PI / 2 * Math.min(1, c) * Math.min(1, c);
      break;
    }
    default:                                                   // de espalda (la de siempre), brazos al aire
      b.rotation.x = -Math.PI / 2 * e; b.position.y = -0.1 * p;
      z.armL.rotation.x = -2.4 * p; z.armR.rotation.x = -1.9 * p;
  }
}

function updateZombies(dt) {
  const C = CONFIG.ZOMBIE, P = player.pos, list = state.zombies;

  // 1) intención
  const lure = FLOW.lure;                                        // F5.11: langostino bailando
  for (const z of list) {
    z.sx = z.sz = z.wantX = z.wantZ = 0;
    if (z.state !== 'walk') continue;
    if (DOWN.on) { fleeZombie(z, P); continue; }                // F5.18: tirado con Quick Revive, se alejan
    if (gumActive('shadow') && !z.boss) { z.mode = 'direct'; continue; }   // F5.18b: SHADOW STEP, no te ven
    if (gumActive('killingtime') && !z.boss) continue;           // F5.28d: KILLING TIME, congelados
    if (!lure) steerZombie(z, P);
    else if (!z.boss) steerZombie(z, lure, 0);                   // todos al langostino
    else { const d = FLOW.dist; FLOW.dist = FLOW.pdist; steerZombie(z, P); FLOW.dist = d; }   // el boss, al jugador
  }

  // 2) separación suave entre zombies
  const SR = C.separationRadius;
  for (let a = 0; a < list.length; a++) {
    const za = list[a];
    if (!za.alive) continue;
    for (let b = a + 1; b < list.length; b++) {
      const zb = list[b];
      if (!zb.alive || (za.level || 0) !== (zb.level || 0)) continue;   // F2.8: uno arriba del techo y otro abajo no se empujan
      const dx = za.px - zb.px, dz = za.pz - zb.pz, d2 = dx * dx + dz * dz;
      if (d2 >= SR * SR) continue;
      let d = Math.sqrt(d2), nx, nz;
      if (d < 1e-4) { const a2 = Math.random() * 6.283; nx = Math.cos(a2); nz = Math.sin(a2); d = 0; }
      else { nx = dx / d; nz = dz / d; }
      const f = (SR - d) / SR * C.separationForce;
      za.sx += nx * f; za.sz += nz * f;
      zb.sx -= nx * f; zb.sz -= nz * f;
    }
  }

  // 3) integrar + colisión + animación
  for (let i = list.length - 1; i >= 0; i--) {
    const z = list[i];
    z.t += dt;
    if (z.kbT > 0) z.kbT = Math.max(0, z.kbT - dt);
    if (z.flash > 0) {
      z.flash -= dt;
      if (z.flash <= 0) { z.flashMats.forEach(m => m.emissive.setHex(0)); z.fakeLit = true; }
    }
    fakeLightTint(z);                                               // F5.28f: antorchas y charcos que brillan

    if (z.state === 'emerge') {
      const p = Math.min(1, z.t / (z.emergeT || C.emergeTime));      // F5.14: el calamar grande de la almeja tarda más
      // F5.13: escarba: sube a tirones, se sacude, y cada tanto salta un puñado de tierra
      const k = easeOut(p) + Math.max(0, Math.sin(z.t * 9)) * 0.04 * (1 - p);
      placeRoot(z, -1.95 * (z.digDepth || 1) * (1 - Math.min(1, k)));
      z.body.rotation.z = Math.sin(z.t * 13) * 0.12 * (1 - p);
      const arms = !z.dog && !z.squid;                               // (en perros y calamares son patas o tentáculos)
      if (arms) { z.armL.rotation.x = -2.6 + Math.sin(z.t * 10) * 0.6 * (1 - p); z.armR.rotation.x = -2.6 - Math.sin(z.t * 10) * 0.6 * (1 - p); }
      if ((z.dirtT = (z.dirtT || 0) - dt) <= 0 && p < 0.95) {
        z.dirtT = C.emergeDirt;
        spawnSplashFx(z.px, groundY(z.px, z.pz) + 0.25, z.pz, 0x5a4028, 0.7);
      }
      if (p >= 1) { z.body.rotation.z = 0; if (arms) z.armL.rotation.x = z.armR.rotation.x = 0; }
      if (p >= 1) { z.state = 'walk'; z.t = 0; }
      continue;
    }
    if (z.state === 'barrier') { barrierTick(z, dt); continue; }  // F5.19b: arranca tablas y se mete (barriers.js)
    if (z.state === 'jump') { jumpTick(z, dt); continue; }        // F5.19b: salta desde la espesura o el agua
    if (z.state === 'dying') {
      // F5.10: se lo está comiendo una planta: lo lleva la boca (garden.js)
      if (z.eaten) { if (plantCarry(z, dt)) { deactivateZombie(z); list.splice(i, 1); } continue; }
      const p = Math.min(1, z.t / (z.boss ? CONFIG.BOSS.deathTime : C.deathTime));   // F5: el boss cae lento
      if (z.dog || z.squid) z.body.rotation.z = Math.PI / 2 * p * p;   // F4: el perro (y el calamar) cae de costado
      else if (z.crawl) z.body.position.y = CONFIG.CRAWLER.lift * (1 - p);   // ya está en el piso
      else if (!z.boss) deathPose(z, z.t);                     // F7b: poses de muerte
      else {
        z.body.rotation.x = -Math.PI / 2 * p * p;            // cae hacia atrás
        z.body.position.y = -0.1 * p;
      }
      placeRoot(z, 0);
      if (z.burnT > 0) z.burnT -= dt;                          // F5.10: Kaboom: el cuerpo arde en el piso
      const done = z.deathPose === 'knees' ? z.t >= CONFIG.GORE.kneeTime : p >= 1;
      if (done && !(z.burnT > 0)) { deactivateZombie(z); list.splice(i, 1); }
      continue;
    }
    if (z.state === 'climb') { updateClimb(z, dt); continue; }   // F2.6: sin colisión, ataque ni watchdog
    if (z.boss && bossTick(z, dt)) continue;                     // F5: barrido, silbido, embestida, aturdido (boss.js)
    if (z.squid) { squidTick(z, dt); if (!z.alive) continue; }   // F5.9: tinta y fusión

    let mx = z.wantX * z.speed + z.sx, mz = z.wantZ * z.speed + z.sz;
    if (z.nudgeT > 0) { z.nudgeT -= dt; mx += z.nudgeX * z.speed * 0.8; mz += z.nudgeZ * z.speed * 0.8; }
    // tope: la separación empuja hasta 1.25x, pero nunca más rápido que el sprint del jugador (F2.6)
    const ml = Math.hypot(mx, mz), maxV = Math.min(z.speed * 1.25, speedCap(z));
    if (ml > maxV) { mx *= maxV / ml; mz *= maxV / ml; }
    // (F5.10: la arena mojada ya no frena a los zombies, solo al jugador; pedido de Diego)
    const ox = z.px, oz = z.pz, K = z.boss ? CONFIG.BOSS : z.dog ? CONFIG.DOGS : z.squid ? CONFIG.SQUID : C;   // F4/F5/F5.9: radio, daño y ritmo propios
    const rad = z.rad || K.radius;                                 // F5.8: el perro grande es más ancho
    moveCircle(z, 'x', mx * dt, rad);
    moveCircle(z, 'z', mz * dt, rad);
    const realV = Math.hypot(z.px - ox, z.pz - oz) / Math.max(dt, 1e-4);

    const dxp = P.x - z.px, dzp = P.z - z.pz, distP = Math.hypot(dxp, dzp);
    const face = distP < 2.5 ? Math.atan2(dxp, dzp) : (realV > 0.2 ? Math.atan2(z.px - ox, z.pz - oz) : z.heading);
    z.heading = lerpAngle(z.heading, face, Math.min(1, dt * 8));
    placeRoot(z, 0);
    z.root.rotation.y = z.heading;
    // F5.20: el negro se infla y explota cerca tuyo (no pega: explota)
    if (z.variant === 'black' && !DOWN.on && blackFuse(z, dt, distP)) { if (!z.alive) continue; animateZombie(z, dt, realV); continue; }

    // ataque: rango + cooldown + línea libre (no pega a través de paredes)
    z.attackCd -= dt;
    // F2.8: con el jugador arriba de un mueble, el mueble no tapa el golpe (si no, parado en el sofá era intocable)
    // F2.8: y solo en el mismo nivel (el de abajo no le pega al que está en el techo)
    const pl = playerLevel(), onTop = playerOnTop();
    // F5.6: si estás arriba de un mueble te agarra de las piernas desde el borde (si no, el medio de la cama era seguro)
    const reach = onTop !== undefined ? Math.max(K.attackRange, C.attackRangeOnTop) : K.attackRange;
    if (DOWN.on || ((gumActive('shadow') || gumActive('killingtime')) && !z.boss)) { /* F5.18: tirado (o SHADOW STEP, F5.28d: KILLING TIME): nadie pega */ }
    else if (z.boss) bossTryAttack(z, distP, pl, onTop);            // F5: golpe al piso con aviso
    else if ((z.level || 0) === pl && distP < reach && z.attackCd <= 0 &&
        segmentClear(z.px, z.pz, P.x, P.z, 0.02, false, onTop, pl)) {
      const hit = z.squid ? K.damage * z.size : K.damage;       // F5.9: el calamar grande pega más
      if (!shieldBlocks(z.px, z.pz, hit)) damagePlayer(hit, z.px, z.pz, false, isHuman(z) ? 'zombie' : z.kind);   // F3a: el escudo lo para (F5.19: el golpe de zombie solo si es humano)
      if (z.dog) playSample('mordida_perro', { pos: [z.px, 0.6, z.pz], rate: 0.95 + Math.random() * 0.1 });   // F5.19c
      sfxGrowl(z, 'attack');
      z.attackCd = K.attackCooldown;
      z.swingT = 0.35;
    }

    animateZombie(z, dt, realV);
    // F5.11: esperando al lado del langostino no cuenta como atasco
    if (!DOWN.on) stuckWatch(z, dt, lure && !z.boss ? Math.min(distP, Math.hypot(lure.x - z.px, lure.z - z.pz)) : distP);
  }
}

//--- overlay de debug del grid (tecla N) ---
const navDebug = { visible: false, mesh: null, canvas: null, ctx: null, tex: null };
function buildNavDebug() {
  const c = document.createElement('canvas');
  c.width = NAV.w; c.height = NAV.h;
  navDebug.canvas = c; navDebug.ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  navDebug.tex = tex;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(NAV.w, NAV.h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.6, depthWrite: false, fog: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(NAV.minX + NAV.w / 2, 0.03, NAV.minZ + NAV.h / 2);
  m.visible = false;
  scene.add(m);
  navDebug.mesh = m;
}
function drawNavDebug() {
  const ctx = navDebug.ctx, img = ctx.createImageData(NAV.w, NAV.h), d = img.data;
  let maxD = 1;
  for (let i = 0; i < FLOW.dist.length; i++) if (FLOW.dist[i] > maxD) maxD = FLOW.dist[i];
  for (let i = 0; i < NAV.cells.length; i++) {
    const o = i * 4;
    if (!NAV.cells[i]) { d[o+3] = 0; continue; }
    const f = FLOW.dist[i];
    if (f < 0) { d[o] = 90; d[o+1] = 90; d[o+2] = 110; d[o+3] = 160; continue; }   // inalcanzable
    const t = f / maxD;
    d[o] = 60 + 195 * t; d[o+1] = 230 - 170 * t; d[o+2] = 70; d[o+3] = 200;       // verde cerca -> rojo lejos
    if (f === 0) { d[o] = d[o+1] = d[o+2] = 255; }
  }
  ctx.putImageData(img, 0, 0);
  navDebug.tex.needsUpdate = true;
}
function toggleNavDebug() {
  navDebug.visible = !navDebug.visible;
  navDebug.mesh.visible = navDebug.visible;
  if (navDebug.visible) drawNavDebug();
}

