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
    RELICS.gens[key] = { key, room: sp.room, x: sp.x, z: sp.z, g: g, body: r.body, col: r.col, lamp,
                         fx: f.x, fy: 0.7, fz: f.z, ex: e.x, ey: GS.h + 0.55, ez: e.z, puff: 0 };
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

  //--- Pack-a-Punch (apagado hasta papReady) ---
  const PS = CONFIG.PAP.spot, PZ = CONFIG.PAP.size;
  const r = relicBody(mb, PS, PZ, 0x4a3a5a, 'pap', 'world');
  const g = r.g, front = PZ.d / 2;
  mb.box(0, PZ.h + 0.06, 0, PZ.w + 0.1, 0.12, PZ.d + 0.1, 0x2a2230);                    // techo
  [-1, 1].forEach(s => mb.box(s * (PZ.w / 2 + 0.08), 1.1, 0, 0.2, 0.7, 0.2, 0x6a6a70)); // rodillos
  mb.box(0, 0.95, front + 0.12, PZ.w * 0.65, 0.08, 0.3, 0x141418);                      // bandeja
  const lamp = basicBox(PZ.w * 0.8, 0.1, 0.06, 0x303038, 0, PZ.h - 0.1, front + 0.02);
  g.add(lamp);
  const screenTex = makeTex((c, s) => {
    c.fillStyle = '#05080a'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#7af0ff'; c.font = 'bold ' + Math.floor(s * 0.2) + 'px monospace'; c.textAlign = 'center';
    c.fillText('PACK-A', s / 2, s * 0.44); c.fillText('PUNCH', s / 2, s * 0.72);
  }, 1, 128);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshBasicMaterial({ map: screenTex, color: 0x1a1a1a }));
  screen.position.set(0, 1.35, front + 0.005);
  g.add(screen);
  const pglow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.6), new THREE.MeshBasicMaterial({
    map: radialTex('rgba(140,240,255,.9)', 'rgba(80,120,255,.35)'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  pglow.position.set(0, 1.1, front + 0.4); pglow.visible = false;
  g.add(pglow);
  g.updateMatrixWorld(true);
  RELICS.pap = { room: PS.room || 'R11', level: PS.level || 0, x: PS.x, z: PS.z, g, body: r.body, col: r.col, lamp, screen, glow: pglow };

  // F2b: arma mejorada en la bandeja, una por arma, con camo. Creadas una vez, se prenden y apagan
  const tray = relicWorld(PS, 0, front + 0.12), ty = (PS.y || 0) + 1.12;   // F5.13: arriba del templo
  RELICS.pap.trayY = ty;
  for (const id in CONFIG.WEAPONS) {
    const m = applyCamo(buildWeaponModel(CONFIG.WEAPONS[id]));
    m.position.set(tray.x, ty, tray.z); m.visible = false;
    scene.add(m);
    PAPST.display[id] = m;
  }

  mb.setFrame(null);
  const merged = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  merged.userData.theme = false;                                  // MeshBuilder lo marca como tema: esto es lógica
  merged.updateMatrix();
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
    if (full) checkPap();
    return key;
  }
  return null;
}

function papReady() {
  return GEN_KEYS.every(k => state.generators[k]) && SOUL_KEYS.every(k => state.souls[k] >= CONFIG.SOULS.need);
}
// lo que falta, para el cartel de la máquina
function papMissing() {
  const g = GEN_KEYS.filter(k => !state.generators[k]).length;
  const b = SOUL_KEYS.filter(k => state.souls[k] < CONFIG.SOULS.need).length;
  const parts = [];
  if (g) parts.push(g + (g === 1 ? ' generador' : ' generadores'));
  if (b) parts.push(b + (b === 1 ? ' caja de almas' : ' cajas de almas'));
  return 'faltan ' + parts.join(' y ');
}
// se prende una sola vez por partida (resetRelics la apaga)
function checkPap() {
  if (RELICS.papOn || !papReady()) return false;
  RELICS.papOn = true;
  const P = RELICS.pap;
  P.lamp.material.color.setHex(0x7af0ff);
  P.screen.material.color.setHex(0xffffff);
  P.glow.visible = true;
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
  if (!RELICS.papOn) return { text: 'Pack-a-Punch apagado - ' + papMissing(), cost: 0 };
  if (PAPST.phase === 'working') return { text: 'Pack-a-Punch trabajando...', cost: 0 };
  if (PAPST.phase === 'ready') return { text: '[F] Agarrar ' + papDef(PAPST.slot.id).name, cost: 0 };
  const s = curSlot();
  if (!s) return { text: 'Pack-a-Punch - sin arma', cost: 0 };
  if (s.pap) return { text: slotDef(s).name + ' - ya mejorada', cost: 0 };
  return { text: '[F] Pack-a-Punch ' + CONFIG.WEAPONS[s.id].name + ' - ' + P.cost, cost: P.cost };
}
function updatePap(dt) {
  const P = CONFIG.PAP, t = clock.elapsedTime;
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
  if (P) { P.lamp.material.color.setHex(0x303038); P.screen.material.color.setHex(0x1a1a1a); P.glow.visible = false; }
  RELICS.fx.forEach(m => { m.visible = false; });
  RELICS.smoke.forEach(m => { m.visible = false; });
  papIdle();                                                       // F2b: nada adentro de la máquina
}
