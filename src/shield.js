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

// el escudo armado: puerta de alacena + franja de tabla de surf + manija atrás (frente = +z)
function shieldModel() {
  const g = new THREE.Group();
  g.add(box(0.7, 0.95, 0.06, 0x7a5a34, 0, 0, 0));                     // puerta (tablas)
  for (let i = -1; i <= 1; i++) g.add(box(0.02, 0.93, 0.065, 0x5a4024, i * 0.23, 0, 0.002));   // juntas
  g.add(box(0.74, 0.2, 0.07, 0xd8c060, 0, 0.28, 0.01));                // franja de tabla de surf
  g.add(box(0.74, 0.05, 0.075, 0x3a7ab8, 0, 0.2, 0.012));
  g.add(box(0.3, 0.05, 0.05, 0x8a8a88, 0, -0.05, -0.08));              // manija
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
  if (!state.running || !S.has) return false;
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
      SHIELDST.craftT = 0; S.built = true;
      for (const k of SHIELD_PARTS) SHIELDST.pieces[k].visible = false;
      takeShield();
      showBanner('SHIELD BUILT', 1.4);
    }
  } else SHIELDST.craftT = 0;
  UI.craft.style.opacity = SHIELDST.craftT > 0 ? '1' : '0';
  if (SHIELDST.craftT > 0) UI.craftBar.style.width = (100 * SHIELDST.craftT / C.craftTime).toFixed(1) + '%';
  // modelos: en el banco si está armado y no lo tenés; en primera persona si está equipado
  SHIELDST.benchModel.visible = S.built && !S.has;
  const eq = W.phase === 'shield';
  SHIELDST.view.visible = eq;
  if (SHIELDST.bashAnim > 0) SHIELDST.bashAnim = Math.max(0, SHIELDST.bashAnim - dt);
  if (eq) {
    const k = SHIELDST.bashAnim > 0 ? Math.sin(Math.PI * (1 - SHIELDST.bashAnim / 0.25)) : 0;
    SHIELDST.view.position.z = -0.62 - 0.25 * k;
  }
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
