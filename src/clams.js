//=== 7i. ALMEJAS Y FUMIGADOR (V2 F5.14) =====================================
// El fumigador aparece por partida en un lugar al azar de CONFIG.CLAMS.fumigator (porche o playa) y se agarra
// con F. Las 9 almejas (CONFIG.CLAMS.spots) no tienen collider: se usan con F desde su cuarto, en el piso. Cada
// una avanza de color sola cada 3–4 rondas (clamsRound, desde startRound): vacía -> verde -> amarilla -> morada
// -> vacía. Con el fumigador y un color, mantener F openTime s: la almeja se abre y en vez de perla está el premio
// (rollClam, pesos por color). Da una sola cosa por color: queda usada (se ve vacía) hasta el próximo cambio.
// Premios: zombie o calamar que salen del piso al lado; power-up; arma (giveWeapon); la pieza de la Ola (el
// "coco" de la quest, que ya no sale de la palmera); calamar grande que tarda en salir escarbando.
const CLAMS = { list: [], fum: null, have: false, holdT: 0, last: null };

// punto navegable más cercano (las almejas y el fumigador no tienen collider: que no caigan en un tronco)
function clamSnap(sp) {
  const cx = Math.floor(sp.x), cz = Math.floor(sp.z);
  for (let r = 0; r <= 4; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const x = cx + dx, z = cz + dz, room = roomAt(x + 0.5, z + 0.5);
    if (isNav(x, z) && room && room.id === sp.room) return { room: sp.room, x: x + 0.5, z: z + 0.5 };
  }
  return { room: sp.room, x: sp.x, z: sp.z };
}
function buildClams() {
  const C = CONFIG.CLAMS;
  const halo = radialTex('rgba(255,255,255,.9)', 'rgba(255,255,255,.25)');
  // F7: cada valva es UN mesh (media valva + 5 estrías fusionadas) y los 9 nidos van en uno solo: 4 draw calls
  // por almeja (valvas, premio y brillo) en vez de 15
  // F5.18b: concha cúbica (como los personajes): capas de cajas que se angostan hacia la bisagra, con costillas en
  // abanico y un borde festoneado de cubitos. Cada valva sigue siendo UN mesh
  const valve = up => {
    const mb = new MeshBuilder(), R = 0.5, c = 0.085;
    for (let i = -5; i <= 5; i++) for (let j = 0; j < 7; j++) {       // vieira de voxels: semicírculo desde la bisagra
      const x = i * c, z = 0.04 + j * c, r = Math.hypot(x, z);
      if (r > R) continue;
      const h = 0.04 + 0.07 * (1 - r / R);                                // cúpula: más alta en el medio
      mb.box(x, up * h / 2, z, c, h, c, (i & 1) ? 0xe2e2e2 : 0xffffff);  // columnas claras y oscuras = estrías
    }
    for (let i = -5; i <= 5; i += 2) { const a = Math.atan2(i * c, 0.46); mb.box(Math.sin(a) * 0.47, up * 0.02, Math.cos(a) * 0.47, 0.07, 0.04, 0.05, 0xd4d4d4, 0, a, 0); }   // festón
    mb.box(0, up * 0.025, -0.02, 0.3, 0.05, 0.08, 0xc8c8c8);            // orejuelas de la bisagra
    return mb;
  };
  const nests = new MeshBuilder(), nestGeo = new THREE.CylinderGeometry(0.7, 0.8, 0.08, 10);
  for (const s of C.spots) {
    const sp = clamSnap(s), g = new THREE.Group();
    g.position.set(sp.x, groundY(sp.x, sp.z), sp.z);
    g.rotation.y = Math.random() * Math.PI * 2;
    const mat = new THREE.MeshLambertMaterial({ color: C.colors[0], vertexColors: true });
    const bottom = new THREE.Group(), top = new THREE.Group();
    for (const [grp, up] of [[bottom, -1], [top, 1]]) {
      const m = valve(up).mesh(mat);
      scene.remove(m); m.matrixAutoUpdate = true; m.userData.theme = false; grp.add(m);
    }
    bottom.position.y = 0.1; top.position.set(0, 0.14, -0.02);        // bisagra atrás (z -0.02)
    g.add(bottom); g.add(top);
    nests.add(nestGeo, sp.x, groundY(sp.x, sp.z) + 0.04, sp.z, 1, 1, 1, 0, 0, 0, 0x5a4a34);   // la canasta
    const prize = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    prize.position.set(0, 0.26, 0.22); prize.visible = false; g.add(prize);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: halo, color: C.colors[0],
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.y = 0.55; g.add(glow);
    scene.add(g);
    CLAMS.list.push({ room: sp.room, level: 0, x: sp.x, z: sp.z, g, top, mat, glow, prize, stage: 0, next: 0, used: false, openT: 0 });
  }
  const nm = nests.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (nm) { nm.userData.theme = false; nm.updateMatrix(); }
  // fumigador: tanque amarillo con manguera y boquilla, brillando en el piso
  const f = new THREE.Group(), mb = new MeshBuilder();
  mb.box(0, 0.35, 0, 0.3, 0.6, 0.3, 0xe8c030);
  mb.box(0, 0.68, 0, 0.18, 0.08, 0.18, 0x3a3a3a);
  mb.box(0.2, 0.5, 0, 0.06, 0.06, 0.3, 0x2a2a2a, 0.4, 0, 0);
  mb.box(0.2, 0.3, 0.25, 0.05, 0.05, 0.5, 0x2a2a2a, -0.6, 0, 0);
  mb.box(0.2, 0.12, 0.5, 0.08, 0.08, 0.22, 0x8a8a8a);
  mb.box(0, 0.35, 0.155, 0.2, 0.14, 0.01, 0x1a1a1a);                // etiqueta
  const fm = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.remove(fm); fm.matrixAutoUpdate = true; fm.userData.theme = false; f.add(fm);
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: halo, color: 0xfff08a,
    transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  fg.position.y = 0.45; f.add(fg);
  f.visible = false; scene.add(f);
  CLAMS.fum = { kind: 'fum', g: f, glow: fg, room: null, level: 0, x: 0, z: 0, taken: false };
}

// al empezar cada ronda: las que tocan avanzan de color
function clamsRound(n) {
  const E = CONFIG.CLAMS.every;
  for (const c of CLAMS.list) {
    if (n < c.next) continue;
    c.stage = (c.stage + 1) % 4; c.used = false;
    c.next = n + E[0] + Math.floor(Math.random() * (E[1] - E[0] + 1));
    clamPaint(c);
  }
}
function clamPaint(c) {
  const C = CONFIG.CLAMS, st = c.used ? 0 : c.stage;
  c.mat.color.setHex(C.colors[st]);
  c.glow.material.color.setHex(C.colors[st]);
}

// premio según el color. Devuelve el tipo ('zombie', 'squid', 'bigsquid', 'powerup', 'piece', 'weapon:<id>')
function rollClam(stage, r) {
  const opts = CONFIG.CLAMS.rewards[stage].filter(([k]) => k !== 'piece' || pieceAvailable());
  const sum = opts.reduce((a, o) => a + o[1], 0);
  let x = (r === undefined ? Math.random() : r) * sum;
  for (const [k, w] of opts) { if ((x -= w) <= 0) return pick(k); }
  return pick(opts[opts.length - 1][0]);
  function pick(k) {
    if (!k.startsWith('weapon:')) return k;
    const ids = k.slice(7).split('|');
    return 'weapon:' + ids[Math.floor(Math.random() * ids.length)];
  }
}
function pieceAvailable() {
  return !state.quest.built && !state.quest.coconut && QUEST.coco && QUEST.coco.phase === 'none';
}
function clamSpawn(pool, c, kind) {
  const q = pool.find(o => !o.active);
  if (!q) return null;
  const a = Math.random() * Math.PI * 2;                               // al lado de la almeja, en una celda libre
  let x = c.x, z = c.z;
  for (let k = 0; k < 8; k++) {
    const tx = c.x + Math.cos(a + k * 0.8) * 1.2, tz = c.z + Math.sin(a + k * 0.8) * 1.2;
    if (isNav(Math.floor(tx), Math.floor(tz))) { x = tx; z = tz; break; }
  }
  resetZombie(q, { x, z }, false, kind);
  q.fromClam = true;
  state.zombies.push(q);
  return q;
}
function openClam(c, force) {                                        // force: premio fijo (tests)
  const B = CONFIG.CLAMS.bigSquid, type = force || rollClam(c.stage);
  CLAMS.last = type;
  c.used = true; c.openT = 2.5;
  c.prize.material.color.setHex(CONFIG.CLAMS.colors[c.stage]); c.prize.visible = true;
  if (type === 'zombie') clamSpawn(ZPOOL, c, 'normal');
  else if (type === 'squid') clamSpawn(SQPOOL, c);
  else if (type === 'bigsquid') {
    const q = clamSpawn(SQPOOL, c);
    if (q) {
      q.fused = B.fused; setSquidSize(q);
      q.health *= B.healthMul; q.maxHealth = q.health;
      q.emergeT = B.emerge; q.digDepth = B.depth;
    }
  } else if (type === 'powerup') {
    trySpawnPickup(c.x + 0.8, c.z, POWERUP_KEYS[Math.floor(Math.random() * POWERUP_KEYS.length)]);
  } else if (type === 'piece') {
    const P = QUEST.coco, Q = CONFIG.QUEST;
    P.phase = 'drop'; P.vy = 3; P.t = 0; P.x = c.x; P.z = c.z + 0.6; P.room = c.room; P.level = 0;
    P.g.position.set(P.x, groundY(P.x, P.z) + 0.4, P.z); P.g.visible = true;
    P.mesh.material.color.setHex(Q.cocoColor); P.glow.material.opacity = 0;
  } else if (type.startsWith('weapon:')) {
    // F5.18b (pedido de Diego): el arma queda flotando arriba de la concha y se agarra con F (antes te la daba sola)
    const id = type.slice(7), m = buildWeaponModel(CONFIG.WEAPONS[id]);
    m.scale.setScalar(1.6); m.rotation.y = Math.PI / 2; m.position.set(0, 0.95, 0.22);
    c.g.add(m); c.offer = { id, t: CONFIG.CLAMS.offerTime, model: m };
    c.openT = 0; c.prize.visible = false;
    showBanner(CONFIG.WEAPONS[id].name + ' — [F] take', 2);
  }
  clamPaint(c);
  sfxShellRise();
  return type;
}

//--- interacción: la lee updateInteract ---
function clamNear(room, px, pz, bd) {
  let best = null;
  const R = CONFIG.CLAMS.range, F = CLAMS.fum;
  if (F && !F.taken && room && room.id === F.room) {
    const d = Math.hypot(px - F.x, pz - F.z);
    if (d < Math.min(bd, R)) { bd = d; best = { kind: 'fumigator', target: F, dist: d }; }
  }
  for (const c of CLAMS.list) {
    if (!room || room.id !== c.room) continue;
    const d = Math.hypot(px - c.x, pz - c.z);
    if (d < Math.min(bd, R)) { bd = d; best = { kind: 'clam', target: c, dist: d }; }
  }
  return best;
}
function clamReady(c) { return CLAMS.have && c.stage > 0 && !c.used && !c.offer; }
function clamDropOffer(c) { if (c.offer) { c.g.remove(c.offer.model); c.offer = null; } }
function clamPrompt(it) {
  if (it.kind === 'fumigator') return { text: '[F] Take FUMIGATOR', cost: 0 };
  const c = it.target;
  if (c.offer) return { text: '[F] Take ' + CONFIG.WEAPONS[c.offer.id].name, cost: 0 };   // F5.18b
  if (c.stage === 0 || c.used) return { text: 'Empty clam', cost: 0 };
  const name = CONFIG.CLAMS.names[c.stage] + ' clam';
  if (!CLAMS.have) return { text: name + ' - you need the fumigator', cost: 0 };
  return { text: '[F] Hold: fumigate ' + name, cost: 0 };
}
function clamPress(it) {
  if (it.kind === 'fumigator') {
    const F = it.target;
    if (F.taken) return false;
    F.taken = true; F.g.visible = false; CLAMS.have = true;
    sfxPartPickup();
    showBanner('FUMIGATOR', 1.5);
    return true;
  }
  const c = it.target;
  if (c.offer) {                                                      // F5.18b: agarrar el arma de la concha
    giveWeapon(c.offer.id); raiseWeapon(); showBanner(CONFIG.WEAPONS[c.offer.id].name, 1.5);
    clamDropOffer(c); sfxBuy();
    return true;
  }
  return clamReady(c);
}

function updateClams(dt) {
  const t = clock.elapsedTime, C = CONFIG.CLAMS;
  const F = CLAMS.fum;
  if (F && F.g.visible) { F.glow.quaternion.copy(camera.quaternion); F.glow.material.opacity = 0.45 + 0.25 * Math.sin(t * 3); }
  for (const c of CLAMS.list) {
    const lit = c.stage > 0 && !c.used;
    c.glow.material.opacity = lit ? 0.35 + 0.25 * Math.sin(t * 2.5 + c.x) : 0;
    if (lit) c.glow.quaternion.copy(camera.quaternion);
    let open = 0;
    if (c.offer) {                                                    // F5.18b: abierta con el arma flotando, hasta que la agarres
      c.offer.t -= dt; open = 1;
      c.offer.model.rotation.y += dt * 1.5; c.offer.model.position.y = 0.95 + Math.sin(t * 2.5) * 0.05;
      if (c.offer.t <= 0) clamDropOffer(c);
    } else if (c.openT > 0) {                                                // se abre, muestra el premio y se cierra
      c.openT = Math.max(0, c.openT - dt);
      const k = 2.5 - c.openT;
      open = k < 0.3 ? k / 0.3 : c.openT < 0.4 ? c.openT / 0.4 : 1;
      c.prize.rotation.y += dt * 3;
      if (c.openT === 0) c.prize.visible = false;
    } else if (c === interactState.target && CLAMS.holdT > 0) open = 0.15 * CLAMS.holdT / C.openTime;   // tiembla al fumigar
    c.top.rotation.x = -1.1 * open;
  }
  // mantener F con el fumigador sobre una almeja con color
  const it = interactState;
  if (it.kind === 'clam' && clamReady(it.target) && keys['KeyF'] && weaponsState.phase !== 'grenade') {
    CLAMS.holdT += dt;
    if (CLAMS.holdT >= C.openTime) { CLAMS.holdT = 0; openClam(it.target); }
  } else CLAMS.holdT = 0;
  if (CLAMS.holdT > 0) {                                              // la barra es la misma del escudo y el taller
    UI.craft.style.opacity = '1';
    UI.craftBar.style.width = (100 * CLAMS.holdT / C.openTime).toFixed(1) + '%';
  }
}

function resetClams() {
  const C = CONFIG.CLAMS, E = C.every;
  for (const c of CLAMS.list) {
    clamDropOffer(c);
    c.stage = 0; c.used = false; c.openT = 0; c.prize.visible = false; c.top.rotation.x = 0;
    c.next = 1 + E[0] + Math.floor(Math.random() * (E[1] - E[0] + 1)) - Math.floor(Math.random() * 2);   // no todas a la vez
    clamPaint(c);
  }
  CLAMS.have = false; CLAMS.holdT = 0; CLAMS.last = null;
  const F = CLAMS.fum;
  if (F) {
    const sp = clamSnap(C.fumigator[Math.floor(Math.random() * C.fumigator.length)]);
    F.taken = false; F.room = sp.room; F.x = sp.x; F.z = sp.z;
    F.g.position.set(sp.x, groundY(sp.x, sp.z), sp.z); F.g.visible = true;
  }
}
