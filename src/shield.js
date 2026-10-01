//=== 7d. ESCUDO (V2 F3a) ==================================================
// Piezas: 3, cada una sorteada en 1 de sus 3 lugares por partida (rollShieldSpots, en resetGame). Se agarran
// con F desde su cuarto. Sin collider: no tocan el grid ni frenan balas.
// Banco (prop 'banco' del garaje): con las 3, mantener F CONFIG.SHIELD.craftTime s lo arma. Queda "armado"
// toda la partida: si se rompe, se vuelve a sacar del banco con F, sin piezas.
// En la espalda (state.shield.has y sin equipar) bloquea golpes de atrás; equipado (tecla 3,
// weaponsState.phase 'shield') bloquea de frente, no se dispara, y clic = empujón (shieldBash).
// El bloqueo se decide en el ataque del zombie (shieldBlocks), antes de damagePlayer: la granada propia no
// pasa por acá, el escudo no la para.
const SHIELDST = { pieces: {}, spot: {}, craftT: 0, bashT: -99, bashAnim: 0, bench: null, benchModel: null, view: null };
const SHIELD_PARTS = Object.keys(CONFIG.SHIELD.parts);

// el escudo armado. F5.24 (Diego: "mejorar cómo se ve"): en cubos y con detalle. Atrás (+z, lo que ves en primera
// persona): 4 tablas de la puerta de alacena con vetas, dos travesaños clavados, la manija de metal con la empuñadura
// encintada, la correa de cuero del antebrazo y cinta gris en los bordes. Adelante (-z, hacia los zombies): la tabla de
// surf cruzada con su franja azul y la aleta, esquineros de metal con remaches, clavos oxidados que asoman, una calavera
// pintada y manchas de sangre. `cracks` (grietas) se prende con poca durabilidad
function shieldModel() {
  const g = new THREE.Group(), mb = new MeshBuilder(), ck = new MeshBuilder(), rr = mulberry(34);
  const WOOD = [0x7a5a34, 0x6a4a2a, 0x8a6a40, 0x70502e], GRAIN = 0x4a3018, MET = 0x8a8a90, METD = 0x5a5a62, RUST = 0x8a4a22;
  // tablas (con el borde de arriba desparejo)
  for (let i = 0; i < 4; i++) {
    const x = -0.27 + i * 0.18, top = 0.48 + (rr() - 0.5) * 0.06, h = top + 0.5;
    mb.box(x, top - h / 2, 0, 0.17, h, 0.06, WOOD[i]);
    for (let k = 0; k < 3; k++) mb.box(x + (rr() - 0.5) * 0.1, top - h * (0.2 + k * 0.3), 0.031, 0.012, h * 0.22, 0.004, GRAIN);   // vetas atrás
    for (let k = 0; k < 2; k++) mb.box(x + (rr() - 0.5) * 0.1, top - h * (0.3 + k * 0.35), -0.031, 0.012, h * 0.2, 0.004, GRAIN); // y adelante
  }
  // atrás: travesaños clavados, manija, correa y cinta
  for (const y of [0.3, -0.3]) {
    mb.box(0, y, 0.05, 0.72, 0.1, 0.04, 0x5a3e22);
    for (let i = 0; i < 5; i++) mb.box(-0.3 + i * 0.15, y, 0.072, 0.02, 0.02, 0.01, 0xc8c8cc);          // cabezas de clavos
  }
  for (let d = 0; d < 7; d++) mb.box(-0.24 + d * 0.08, -0.21 + d * 0.07, 0.05, 0.09, 0.05, 0.035, 0x4e3620);   // diagonal en escalera
  mb.box(0, -0.02, 0.13, 0.3, 0.04, 0.04, MET);                                                              // manija
  for (const s of [-1, 1]) mb.box(s * 0.13, -0.02, 0.09, 0.04, 0.05, 0.08, METD);
  for (let k = 0; k < 6; k++) mb.box(-0.1 + k * 0.04, -0.02, 0.13, 0.035, 0.05, 0.048, k % 2 ? 0x2a2a2e : 0x1c1c20);   // empuñadura encintada
  mb.box(0, 0.16, 0.085, 0.36, 0.07, 0.025, 0x5a3a1c); mb.box(0.12, 0.16, 0.1, 0.05, 0.08, 0.02, 0xb0a070);    // correa y hebilla
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) mb.box(s * 0.36, 0.4 - k * 0.2, 0, 0.03, 0.14, 0.075, k % 2 ? 0x9a9a9e : 0x8a8a8e);   // cinta
  // adelante: la tabla de surf cruzada (con franja y aleta)
  for (let i = 0; i < 9; i++) {
    const x = -0.36 + i * 0.09, w = i === 0 || i === 8 ? 0.05 : 0.09;
    mb.box(x, 0.12, -0.05, w, 0.22, 0.04, 0xe0c870);
    mb.box(x, 0.06, -0.072, w, 0.04, 0.006, 0x3a7ab8);
    if (i % 3 === 1) mb.box(x, 0.18, -0.072, 0.03, 0.03, 0.006, 0xf0e0a0);                              // cera
  }
  for (let k = 0; k < 4; k++) mb.box(0.22, 0.12 + k * 0.02, -0.08 - k * 0.018, 0.03, 0.04, 0.03, 0x2a5a8a);    // aleta
  // esquineros de metal con remaches
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const cx = sx * 0.3, cy = sy === 1 ? 0.43 : -0.47;
    mb.box(cx, cy, -0.036, 0.14, 0.04, 0.012, MET); mb.box(sx * 0.35, cy - sy * 0.05, -0.036, 0.04, 0.13, 0.012, MET);
    for (const [ox, oy] of [[0, 0], [sx * 0.05, -sy * 0.08]]) mb.box(cx + ox, cy + oy, -0.044, 0.02, 0.02, 0.01, 0x3a3a40);
  }
  // clavos oxidados que asoman (pinchos)
  for (let i = 0; i < 9; i++) {
    const x = -0.3 + rr() * 0.6, y = -0.4 + rr() * 0.8;
    if (y > 0.0 && y < 0.25) continue;                                                                   // no sobre la tabla de surf
    for (let k = 0; k < 3; k++) mb.box(x, y, -0.04 - k * 0.025, 0.018 - k * 0.004, 0.018 - k * 0.004, 0.025, k ? RUST : 0x6a6a70);
  }
  // calavera pintada y sangre
  const skull = [[0, 1, 1, 1, 0], [1, 1, 1, 1, 1], [1, 0, 1, 0, 1], [1, 1, 1, 1, 1], [0, 1, 0, 1, 0]];
  skull.forEach((row, j) => row.forEach((v, i) => { if (v) mb.box(-0.12 + i * 0.03, -0.12 - j * 0.03, -0.034, 0.03, 0.03, 0.004, 0xe8e0d0); }));
  for (let i = 0; i < 14; i++) mb.box(0.05 + rr() * 0.25, -0.2 - rr() * 0.25, -0.034, 0.02 + rr() * 0.04, 0.02 + rr() * 0.06, 0.004, 0x6a0a08);
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (m) { scene.remove(m); m.matrixAutoUpdate = true; m.userData.theme = false; g.add(m); }
  // grietas (de los dos lados): con poca durabilidad
  for (let c = 0; c < 3; c++) {
    let x = -0.2 + c * 0.2, y = 0.45;
    for (let k = 0; k < 9; k++) { for (const zz of [0.032, -0.032]) ck.box(x, y, zz, 0.018, 0.06, 0.004, 0x140a04); x += (rr() - 0.5) * 0.06; y -= 0.06; }
  }
  const cm = ck.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
  if (cm) { scene.remove(cm); cm.matrixAutoUpdate = true; cm.visible = false; g.add(cm); g.userData.cracks = cm; }
  return g;
}
function buildShield() {
  const P = CONFIG.SHIELD.parts;
  // piezas sueltas
  const door = new THREE.Group();
  door.add(box(0.5, 0.7, 0.04, 0x7a5a34, 0, 0.35, 0)); door.add(box(0.05, 0.05, 0.03, 0x8a8a88, 0.18, 0.35, 0.03));
  door.rotation.x = -0.25;
  const board = new THREE.Group();
  board.add(box(0.4, 0.06, 1.0, 0xd8c060, 0, 0.05, 0)); board.add(box(0.41, 0.065, 0.12, 0x3a7ab8, 0, 0.05, 0.1));
  board.rotation.y = 0.6;
  const handle = new THREE.Group();
  handle.add(box(0.34, 0.05, 0.05, 0x8a8a88, 0, 0.1, 0));
  [-0.15, 0.15].forEach(x => handle.add(box(0.05, 0.1, 0.05, 0x8a8a88, x, 0.05, 0)));
  SHIELDST.pieces = { door, board, handle };
  for (const k of SHIELD_PARTS) { SHIELDST.pieces[k].visible = false; scene.add(SHIELDST.pieces[k]); }
  // escudo apoyado en el banco (armado y no lo tenés encima)
  // F5.13: banco de trabajo en el techo (collider de arriba + caja de tiro, como las máquinas), con morsa,
  // herramientas y un escudo dibujado en la pared de atrás
  const BC = CONFIG.SHIELD.bench, mbb = new MeshBuilder();
  const r = relicBody(mbb, BC, BC, 0x6a4a2a, 'shield:banco', 'world');
  mbb.box(0, BC.h + 0.03, 0, BC.w + 0.1, 0.06, BC.d + 0.1, 0x8a6a44);             // tablón
  mbb.box(-0.6, BC.h + 0.14, 0.1, 0.2, 0.16, 0.16, 0x4a4a52);                      // morsa
  mbb.box(0.55, BC.h + 0.08, -0.1, 0.3, 0.04, 0.08, 0x8a8a90);                     // llave
  mbb.box(0.3, BC.h + 0.08, 0.15, 0.1, 0.04, 0.3, 0x6a3a1a);                       // martillo
  for (const s of [-1, 1]) mbb.box(s * (BC.w / 2 - 0.1), BC.h / 2, 0, 0.1, BC.h, BC.d, 0x4a321e);   // patas
  mbb.setFrame(null);
  const bmm = mbb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (bmm) { bmm.userData.theme = false; bmm.updateMatrix(); }
  SHIELDST.bench = { room: BC.room, level: BC.level, col: r.col };
  const bm = shieldModel();
  bm.position.set(BC.x, BC.y + BC.h + 0.45, BC.z); bm.rotation.set(0, 0, -0.15);
  bm.visible = false; scene.add(bm);
  SHIELDST.benchModel = bm;
  // primera persona (capa del arma)
  const v = shieldModel();
  v.position.set(0.02, -0.3, -0.62); v.rotation.set(0.05, 0.12, 0); v.visible = false;
  weaponScene.add(v);
  SHIELDST.view = v;
}
function rollShieldSpots() {
  for (const k of SHIELD_PARTS) {
    const opts = CONFIG.SHIELD.parts[k].spots, sp = opts[Math.floor(Math.random() * opts.length)];
    SHIELDST.spot[k] = sp;
    const m = SHIELDST.pieces[k];
    if (m) { m.position.set(sp.x, groundY(sp.x, sp.z), sp.z); m.visible = !state.shield.parts[k]; }
  }
}
function partsCount() { return SHIELD_PARTS.filter(k => state.shield.parts[k]).length; }

function pickPart(k) {
  const S = state.shield;
  if (S.parts[k] || S.built) return false;
  S.parts[k] = true;
  SHIELDST.pieces[k].visible = false;
  sfxPartPickup();
  updateShieldHUD();
  return true;
}

// banco: qué dice y qué hace F (agarrar es un toque; armar es mantener, en updateShield)
function benchPrompt() {
  const S = state.shield;
  if (S.has) return { text: 'SHIELD - already owned', cost: 0 };
  if (S.built) return { text: '[F] Take the shield', cost: 0 };
  const n = partsCount();
  if (n < SHIELD_PARTS.length) return { text: 'Workbench - missing parts (' + n + '/' + SHIELD_PARTS.length + ')', cost: 0 };
  return { text: '[F] Hold to build the shield', cost: 0 };
}
function benchPress() {
  const S = state.shield;
  if (S.built && !S.has) { takeShield(); return true; }
  if (!S.built && partsCount() === SHIELD_PARTS.length) return true;   // el armado sigue mientras mantengas F
  sfxDeny(); denyPrompt();
  return false;
}
function takeShield() {
  const S = state.shield;
  S.has = true; S.hp = CONFIG.SHIELD.durability;
  sfxShieldTake();
  updateShieldHUD();
}

// tecla 3: equipar / guardar en la espalda
function toggleShield() {
  const W = weaponsState, S = state.shield;
  if (!state.running || !S.has || DOWN.on) return false;
  if (W.phase === 'shield') { unequipShield(); return true; }
  if (W.phase === 'grenade' || W.phase === 'melee' || W.phase === 'switching') return false;
  if (W.phase === 'reloading') UI.reload.style.opacity = '0';     // se corta (la munición pasa al completarse)
  W.phase = 'shield'; W.phaseT = 0;
  return true;
}
function unequipShield() {
  const W = weaponsState;
  if (W.phase !== 'shield') return;
  if (curDef()) raiseWeapon(); else { W.phase = 'idle'; W.phaseT = 0; }
}

// golpe de zombie desde (fx, fz): ¿lo para el escudo? Equipado: de frente. En la espalda: de atrás
const _deg = Math.PI / 180;
function shieldBlocks(fx, fz, dmg) {
  const S = state.shield;
  if (!S.has) return false;
  const dx = fx - player.pos.x, dz = fz - player.pos.z, d = Math.hypot(dx, dz) || 1;
  const cos = (dx * -Math.sin(player.yaw) + dz * -Math.cos(player.yaw)) / d;   // 1 = de frente
  const lim = Math.cos(CONFIG.SHIELD.blockAngle * _deg);
  const blocked = weaponsState.phase === 'shield' ? cos >= lim : cos <= -lim;
  if (!blocked) return false;
  S.hp -= dmg;
  sfxShieldHit(); addTrauma(0.12);
  SHIELDST.hitT = 0.22;                                                  // F5.24: el escudo se sacude en primera persona
  if (S.hp <= 0) breakShield();
  updateShieldHUD();
  return true;
}
function breakShield() {
  const S = state.shield;
  S.has = false; S.hp = 0;
  unequipShield();
  sfxShieldBreak(); showBanner('SHIELD BROKEN', 1.4);
}

// clic con el escudo equipado: empujón en cono al frente, con línea libre. Devuelve cuántos pegó
function shieldBash() {
  const C = CONFIG.SHIELD, t = clock.elapsedTime;
  if (weaponsState.phase !== 'shield' || t - SHIELDST.bashT < C.bashCooldown) return 0;
  SHIELDST.bashT = t; SHIELDST.bashAnim = 0.25;
  const px = player.pos.x, pz = player.pos.z, fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  const lim = Math.cos(C.bashAngle * _deg), prevSrc = STATS.src;
  STATS.src = 'shield';
  let hits = 0, kills = 0;
  for (const z of state.zombies.slice()) {
    if (!z.alive || z.state !== 'walk') continue;
    const dx = z.px - px, dz = z.pz - pz, d = Math.hypot(dx, dz) || 1e-4;
    if (d > C.bashRange || (dx * fx + dz * fz) / d < lim || !segmentClear(px, pz, z.px, z.pz, 0)) continue;
    damageZombie(z, C.bashDamage, false);
    hits++;
    if (!z.alive) { kills++; continue; }
    if (z.boss) continue;                                                          // F5: al Sombrerón no lo mueve
    const n = 10, sx = dx / d * C.bashKnock / n, sz = dz / d * C.bashKnock / n;   // empujón de a pasos: respeta paredes
    for (let i = 0; i < n; i++) { moveCircle(z, 'x', sx, CONFIG.ZOMBIE.radius); moveCircle(z, 'z', sz, CONFIG.ZOMBIE.radius); }
  }
  STATS.src = prevSrc;
  sfxShieldBash(hits > 0);
  if (hits) onHitConfirm(false, kills > 0);
  return hits;
}

function updateShield(dt) {
  const C = CONFIG.SHIELD, S = state.shield, W = weaponsState;
  // armado: mantener F frente al banco con las 3 piezas
  const ready = !S.built && partsCount() === SHIELD_PARTS.length;
  if (ready && interactState.kind === 'bench' && keys['KeyF']) {
    SHIELDST.craftT += dt;
    if (SHIELDST.craftT >= C.craftTime) {
      SHIELDST.craftT = 0; S.built = true; voice('audio_personaje_al_construir_escudo', 1, 0);   // F5.19
      for (const k of SHIELD_PARTS) SHIELDST.pieces[k].visible = false;
      takeShield();
      showBanner('SHIELD BUILT', 1.4);
    }
  } else SHIELDST.craftT = 0;
  UI.craft.style.opacity = SHIELDST.craftT > 0 ? '1' : '0';
  if (SHIELDST.craftT > 0) UI.craftBar.style.width = (100 * SHIELDST.craftT / C.craftTime).toFixed(1) + '%';
  // modelos: en el banco si está armado y no lo tenés; en primera persona si está equipado
  SHIELDST.benchModel.visible = S.built && !S.has;
  const eq = W.phase === 'shield', V = SHIELDST.view;
  V.visible = eq;
  if (SHIELDST.bashAnim > 0) SHIELDST.bashAnim = Math.max(0, SHIELDST.bashAnim - dt);
  if (SHIELDST.hitT > 0) SHIELDST.hitT = Math.max(0, SHIELDST.hitT - dt);
  // F5.24 (Diego: "mejorar la animación cuando lo pongo de frente"): sube desde abajo a la izquierda girando (raise, con
  // un rebote al final), se balancea al caminar, se sacude cuando para un golpe y el empujón lo tira adelante y abajo
  if (!eq) { SHIELDST.raise = 0; return; }
  SHIELDST.raise = Math.min(1, (SHIELDST.raise || 0) + dt / C.raiseTime);
  const r = SHIELDST.raise, e = 1 - Math.pow(1 - r, 3), over = Math.sin(r * Math.PI) * 0.06;   // entra rápido y rebota un poco
  const t = clock.elapsedTime, sp = Math.min(1, (player.speedNow || 0) / CONFIG.PLAYER.speed), bob = Math.sin(t * 9) * 0.012 * sp;
  const bash = SHIELDST.bashAnim > 0 ? Math.sin(Math.PI * (1 - SHIELDST.bashAnim / 0.25)) : 0;
  const hit = SHIELDST.hitT > 0 ? Math.sin(SHIELDST.hitT * 60) * (SHIELDST.hitT / 0.22) : 0;
  V.position.set(0.02 + (1 - e) * 0.32 + Math.cos(t * 4.5) * 0.008 * sp + hit * 0.02,
                 -0.3 - (1 - e) * 0.62 + over + bob - bash * 0.06,
                 -0.62 + (1 - e) * 0.12 - bash * 0.28 + Math.abs(hit) * 0.05);
  V.rotation.set(0.05 + (1 - e) * 0.9 - bash * 0.18 + hit * 0.06, 0.12 + (1 - e) * 0.7, (1 - e) * -0.55 + hit * 0.08);
  if (V.userData.cracks) V.userData.cracks.visible = S.hp < CONFIG.SHIELD.durability * 0.5;
}

function updateShieldHUD() {
  const S = state.shield;
  let h = '';
  if (!S.built) for (const k of SHIELD_PARTS) h += '<i class="' + k + (S.parts[k] ? '' : ' off') + '"></i>';
  else if (S.has) h = '<b style="width:' + Math.round(38 * S.hp / CONFIG.SHIELD.durability) + 'px"></b>';
  UI.shield.innerHTML = h;
}
function resetShield() {
  const S = state.shield;
  for (const k of SHIELD_PARTS) S.parts[k] = false;
  S.built = false; S.has = false; S.hp = 0;
  SHIELDST.craftT = 0; SHIELDST.bashT = -99; SHIELDST.bashAnim = 0;
  rollShieldSpots();
  if (SHIELDST.benchModel) { SHIELDST.benchModel.visible = false; SHIELDST.view.visible = false; }
  UI.craft.style.opacity = '0';
  updateShieldHUD();
}
