//=== 7c. PERKS Y POWER (V2 F2) ============================================
// Power: F sobre el generador del sótano (prop 'generador' de R7), SOLO con los 4 generadores de F2.5 prendidos
// (F5.6). Prende las máquinas de perks y deja las 6
// lámparas parejas y más fuertes (solo intensity: nunca se agregan luces). No toca el Pack-a-Punch.
// Perks: máx CONFIG.PERKS.max, se pierden al morir (resetGame) o al revivir con Quick Revive.
// Los efectos se leen con helpers (perkRate, perkDmg, perkReload, maxHealth, sprintMul, staminaMul) en el
// lugar donde se usa cada número: no se modifica CONFIG.WEAPONS ni CONFIG.PLAYER.
// Quick Revive (solo, como Black Ops): un golpe letal te revive con la vida llena, reviveIframe s de
// invulnerabilidad y SIN perks. La máquina se compra reviveUses veces por partida y después desaparece.
// Máquinas: una por perk, construidas una vez. Cuerpo + detalles en un MeshBuilder propio (así la de Quick
// Revive puede desaparecer), cartel con el nombre y lámpara (MeshBasic que cambia de color, no una luz).
const PERKM = { machines: {}, power: null };
const PERK_KEYS = Object.keys(CONFIG.PERKS.list);

function hasPerk(id) { return state.perks.indexOf(id) >= 0; }
function maxHealth() {
  const h = hasPerk('jugg') ? CONFIG.PERKS.juggHealth : CONFIG.PLAYER.maxHealth;
  return DEV.hp ? h * CONFIG.DEBUG.devHealthMul : h;              // F5.19c: tecla X (modo dev)
}
function perkRate() { return hasPerk('dtap') ? CONFIG.PERKS.dtapRate : 1; }          // divide el intervalo entre disparos
function perkDmg() { return (hasPerk('dtap') ? CONFIG.PERKS.dtapDamage : 1) * (gumActive('glasscannon') ? 1.5 : 1); }   // F5.20: GLASS CANNON
function perkReload() { return (hasPerk('speed') ? CONFIG.PERKS.speedReload : 1) * (gumActive('quickhands') ? 0.5 : 1); }   // F5.18b: QUICK HANDS
function sprintMul() { return hasPerk('stamin') ? CONFIG.PERKS.staminSpeed : 1; }
function staminaMul() { return hasPerk('stamin') ? CONFIG.PERKS.staminTime : 1; }

function buildPerks() {
  const PK = CONFIG.PERKS, S = PK.size;
  for (const key of PERK_KEYS) {
    const P = PK.list[key];
    const mb = new MeshBuilder();
    const r = relicBody(mb, Object.assign({ y: P.level ? UP.y : 0 }, P), S, 0x3a3a40, 'perk:' + key, 'world');   // F5.8: level 1 = en el techo; F5.11: P.y (búnker)
    const c = new THREE.Color(P.color).multiplyScalar(0.55).getHex(), cD = new THREE.Color(P.color).multiplyScalar(0.3).getHex();
    const front = S.d / 2, W = S.w, H = S.h, chrome = 0xc8c8cc, dark = 0x18181c;
    // F5.19 (Diego: "que impresionen"): máquina expendedora de verdad. Plinto con patas, gabinete con paneles laterales
    // y ribetes cromados, techo en arco, vidriera con botellas del color del perk, botonera con ranura de monedas,
    // bandeja con una botella, cables atrás y un adorno arriba propio de cada perk. Lo que brilla (neones de los
    // bordes y del arco) va en otro mesh MeshBasic que se prende con la energía. Ninguna luz nueva
    mb.box(0, 0.07, 0, W + 0.14, 0.14, S.d + 0.14, dark);                              // plinto
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mb.cyl(x * (W / 2 + 0.02), 0, z * (S.d / 2 + 0.02), 0.05, 0.08, chrome, 1, 8);   // patas
    for (const s of [-1, 1]) {
      mb.box(s * (W / 2 + 0.015), H * 0.52, 0, 0.03, H * 0.84, S.d + 0.02, cD);           // paneles laterales
      for (let k = 0; k < 5; k++) mb.box(s * (W / 2 + 0.032), 0.35 + k * 0.3, 0, 0.004, 0.02, S.d - 0.1, c);   // rayas
      mb.box(s * (W / 2 - 0.02), H * 0.52, front + 0.01, 0.04, H * 0.84, 0.03, chrome);   // ribetes cromados
    }
    // F5.19c (Diego): sin el tambor acostado de arriba ("un cilindro raro"): corona plana escalonada con ribete
    mb.box(0, H + 0.03, 0, W + 0.08, 0.06, S.d + 0.06, c);
    mb.box(0, H + 0.08, 0, W - 0.02, 0.05, S.d - 0.06, cD);
    mb.box(0, H + 0.035, front + 0.04, W + 0.1, 0.03, 0.02, chrome);
    mb.box(0, H * 0.33, front + 0.005, W * 0.86, H * 0.2, 0.02, dark);                 // vidriera (fondo)
    for (let row = 0; row < 2; row++) for (let k = 0; k < 5; k++) {                   // botellas
      const x = -W * 0.34 + k * W * 0.17, y = H * 0.25 + row * 0.18;
      mb.cyl(x, y, front - 0.03, 0.035, 0.11, P.color, 1, 8); mb.cyl(x, y + 0.11, front - 0.03, 0.013, 0.04, P.color, 1, 6);
      mb.cyl(x, y + 0.15, front - 0.03, 0.016, 0.012, 0xd8c040, 1, 6);
    }
    mb.box(W * 0.3, H * 0.5, front + 0.02, W * 0.22, 0.2, 0.03, dark);                // botonera
    mb.box(W * 0.3, H * 0.52, front + 0.035, 0.03, 0.08, 0.01, chrome);                // ranura de monedas
    for (let k = 0; k < 3; k++) mb.box(W * 0.24 + k * 0.05, H * 0.46, front + 0.04, 0.03, 0.03, 0.02, [0xe84a2a, 0xf0c030, 0x4ad86a][k]);
    mb.box(-W * 0.12, 0.26, front + 0.1, W * 0.5, 0.1, 0.2, dark);                     // bandeja
    mb.cyl(-W * 0.12, 0.33, front + 0.1, 0.035, 0.2, P.color, 1, 8, 0, 0, Math.PI / 2);   // botella acostada
    mb.tube([[W * 0.3, 0.2, -S.d / 2], [W * 0.4, 0.05, -S.d / 2 - 0.2], [W * 0.1, 0.02, -S.d / 2 - 0.45]], 0.03, 0.03, 0x1a1a1a, 10, 5);   // cable
    // adorno arriba, según el perk
    const top = H + 0.1, gold = 0xd8a838;
    if (key === 'jugg') {                                                              // botella gigante con escudo
      mb.cyl(0, top, 0, 0.17, 0.42, P.color, 0.9, 12); mb.cyl(0, top + 0.42, 0, 0.07, 0.18, P.color, 1, 10); mb.cyl(0, top + 0.6, 0, 0.08, 0.05, gold, 1, 10);
      mb.box(0, top + 0.2, 0.17, 0.2, 0.24, 0.02, gold); mb.box(0, top + 0.2, 0.18, 0.14, 0.17, 0.02, P.color);
    } else if (key === 'speed') {                                                      // rayo
      mb.box(0.02, top + 0.32, 0, 0.1, 0.3, 0.06, 0xf0d020, 0, 0, -0.5); mb.box(-0.02, top + 0.12, 0, 0.1, 0.3, 0.06, 0xf0d020, 0, 0, -0.5);
      mb.box(0, top + 0.22, 0, 0.18, 0.06, 0.06, 0xf0d020);
      for (const s of [-1, 1]) mb.box(s * 0.3, top + 0.08, 0, 0.26, 0.05, 0.05, P.color, 0, 0, s * 0.4);
    } else if (key === 'dtap') {                                                       // dos barriles de cerveza
      for (let k = 0; k < 2; k++) { mb.cyl(-0.22, top + 0.13 + k * 0.26, 0, 0.13, 0.44, 0x8a5a2a, 1, 12, 0, 0, Math.PI / 2);
        for (const x of [-0.18, 0.18]) mb.cyl(x - 0.02, top + 0.13 + k * 0.26, 0, 0.135, 0.03, 0x3a3a3a, 1, 12, 0, 0, Math.PI / 2); }
    } else if (key === 'revive') {                                                     // cruz con halo
      mb.box(0, top + 0.28, 0, 0.12, 0.44, 0.08, 0xf4f4f0); mb.box(0, top + 0.32, 0, 0.36, 0.12, 0.08, 0xf4f4f0);
      mb.box(0, top + 0.28, 0.045, 0.06, 0.38, 0.01, P.color); mb.box(0, top + 0.32, 0.045, 0.3, 0.06, 0.01, P.color);
    } else if (key === 'stamin') {                                                     // botella alta con alas
      mb.cyl(0, top, 0, 0.12, 0.5, P.color, 0.85, 12); mb.cyl(0, top + 0.5, 0, 0.05, 0.14, P.color, 1, 8);
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) mb.box(s * (0.2 + k * 0.08), top + 0.3 - k * 0.06, 0, 0.14, 0.05, 0.03, 0xf4f4f0, 0, 0, s * (0.5 + k * 0.15));
    } else if (key === 'mule') {                                                       // herradura
      for (let k = 0; k <= 6; k++) { const a = Math.PI * k / 6; mb.box(Math.cos(a) * 0.22, top + 0.1 + Math.sin(a) * 0.26, 0, 0.1, 0.1, 0.06, 0xa8a8b0, 0, 0, a); }
      for (const s of [-1, 1]) mb.box(s * 0.22, top + 0.05, 0.035, 0.04, 0.04, 0.01, 0x3a3a3a);
    }
    mb.setFrame(null);
    const body = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    body.userData.theme = false; body.updateMatrix();
    // neones: bordes del frente y el arco de arriba (MeshBasic, blanco por vértice × el color del material)
    const nb = new MeshBuilder();
    nb.setFrame(P.x, (P.level ? UP.y : 0) + (P.y || 0), P.z, P.rot);
    for (const s of [-1, 1]) nb.box(s * (W / 2 + 0.005), H * 0.52, front + 0.03, 0.015, H * 0.84, 0.01, 0xffffff);
    nb.box(0, H - 0.02, front + 0.02, W, 0.02, 0.01, 0xffffff);                     // borde de arriba
    nb.box(0, H * 0.43, front + 0.02, W * 0.88, 0.015, 0.01, 0xffffff);             // sobre la vidriera
    nb.setFrame(null);
    const neon = nb.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x202020 }));
    if (neon) { neon.userData.theme = false; neon.updateMatrix(); }
    // cartel: franja con el color, emblema redondo con la sigla y el nombre (se tiñe oscuro sin power)
    const hex = '#' + P.color.toString(16).padStart(6, '0');
    const tex = makeTex((cx, s) => {
      const gr = cx.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, hex); gr.addColorStop(1, '#101010');
      cx.fillStyle = gr; cx.fillRect(0, 0, s, s);
      cx.strokeStyle = 'rgba(255,255,255,.8)'; cx.lineWidth = 3; cx.strokeRect(4, 4, s - 8, s - 8);
      cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(s / 2, s * 0.36, s * 0.2, 0, 7); cx.fill();
      cx.fillStyle = hex; cx.beginPath(); cx.arc(s / 2, s * 0.36, s * 0.16, 0, 7); cx.fill();
      cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.font = 'bold ' + Math.floor(s * 0.15) + 'px monospace'; cx.fillText(P.abbr, s / 2, s * 0.41);
      cx.font = 'bold ' + Math.floor(s * 0.12) + 'px monospace';
      const w = P.name.split(' ');
      w.forEach((t, i) => cx.fillText(t, s / 2, s * (0.72 + i * 0.14 - (w.length - 1) * 0.05)));
    }, 1, 128);
    tex.magFilter = THREE.LinearFilter;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.86, 0.7), new THREE.MeshBasicMaterial({ map: tex, color: 0x303030 }));
    sign.position.set(0, H * 0.74, front + 0.025);
    r.g.add(sign);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.86, H * 0.2), new THREE.MeshLambertMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.22, depthWrite: false }));
    glass.position.set(0, H * 0.33, front + 0.03); r.g.add(glass);
    const lamp = basicBox(W * 0.7, 0.04, 0.02, 0x2a2a2a, 0, H + 0.08, front + 0.035);   // F5.19c: tira en el frente de la corona
    r.g.add(lamp);
    r.g.updateMatrixWorld(true);
    PERKM.machines[key] = { key, room: P.room, level: P.level || 0, x: P.x, z: P.z, g: r.g, body, hit: r.body, col: r.col, sign, lamp, neon, near: false, gone: false };
  }
  const gen = PROPS.find(p => p.id === 'generador');
  PERKM.power = { room: gen.room, col: gen.collider };
  for (const L of WORLD.lamps) L.mode0 = L.mode;                      // para volver al estado sin power
}

// F5.6 (pedido de Diego): la palanca solo funciona con los 4 generadores de F2.5 prendidos
function powerMissing() { return GEN_KEYS.filter(k => !state.generators[k]).length; }
// F sobre el generador del sótano
function turnOnPower() {
  if (state.power || powerMissing() > 0) return false;
  state.power = true;
  for (const id in state.doors) if (state.doors[id].power) openDoor(id);   // F5.7: portón del sótano al jardín oeste
  for (const L of WORLD.lamps) L.mode = 'steady';
  for (const key of PERK_KEYS) paintMachine(key);
  sfxGenerator(); sfxPowerOn();
  return true;
}
function paintMachine(key) {
  const m = PERKM.machines[key];
  m.sign.material.color.setHex(state.power ? 0xffffff : 0x303030);
  m.lamp.material.color.setHex(state.power ? CONFIG.PERKS.list[key].color : 0x2a2a2a);
  if (m.neon) m.neon.material.color.setHex(state.power ? CONFIG.PERKS.list[key].color : 0x202020);   // F5.19
}

// qué dice la máquina (y si se puede comprar). Lo usan el prompt y buyPerk
function perkStatus(key) {
  const P = CONFIG.PERKS.list[key];
  if (!state.power) return { text: P.name + ' - needs power', ok: false, cost: 0 };
  if (hasPerk(key)) return { text: P.name + ' - already owned', ok: false, cost: 0 };
  if (state.perks.length >= perkMax()) return { text: 'Max ' + perkMax() + ' perks', ok: false, cost: 0 };   // F5.26: +1 con el talismán
  const cost = gumActive('halfperk') ? Math.round(P.cost * CONFIG.GUMS.list.halfperk.mul) : P.cost;   // F5.28d: HALF-PRICE PERK
  return { text: '[F] ' + P.name + ' - ' + cost, ok: true, cost };
}
function buyPerk(key) {
  const st = perkStatus(key), m = PERKM.machines[key];
  if (!st.ok || m.gone) return false;
  if (!spendPoints(st.cost)) return false;
  if (gumActive('halfperk')) { delete GUMM.fx.halfperk; updateGumHUD(); gumEnded(); }   // F5.28d: se gasta con el perk
  state.perks.push(key);
  if (key === 'jugg') state.health = maxHealth();
  if (key === 'revive' && ++state.reviveBuys >= CONFIG.PERKS.reviveUses) hideMachine(key);
  sfxPerkDrink();
  // F5.19c (Diego): se ve cuando te lo tomás; drinkTime s sin disparar
  if (weaponsState.phase !== 'grenade' && weaponsState.phase !== 'shield') startDrink(CONFIG.PERKS.list[key].color);
  showBanner(CONFIG.PERKS.list[key].name, 2);
  if (key === 'jugg') voice('audio_al_tomar_jugger', 1, 0);                               // F5.19
  if (key === 'revive') voice('audio_del_personaje_al_tomar_quick_revive', 1, 0);
  updatePerkHUD();
  return true;
}
function hideMachine(key) {
  const m = PERKM.machines[key];
  m.gone = true; m.g.visible = false; m.body.visible = false; m.col.solid = false;
  if (m.neon) m.neon.visible = false;
  const i = WORLD.hitMeshes.indexOf(m.hit);
  if (i >= 0) WORLD.hitMeshes.splice(i, 1);
}
function showMachine(key) {
  const m = PERKM.machines[key];
  m.gone = false; m.g.visible = true; m.body.visible = true; m.col.solid = true;
  if (m.neon) m.neon.visible = true;
  if (WORLD.hitMeshes.indexOf(m.hit) < 0) WORLD.hitMeshes.push(m.hit);
}

// golpe letal: con Quick Revive, revive (sin perks, vida llena, invulnerable un rato). true = revivió
// F5.11: Mule Kick permite una 3ra arma. Si lo perdés (Quick Revive), se va la última que entró
function maxWeapons() { return CONFIG.MAX_WEAPONS + (hasPerk('mule') ? 1 : 0); }
function dropMuleWeapon() {
  while (state.weapons.length > maxWeapons()) state.weapons.pop();
  if (state.currentWeapon >= state.weapons.length) {
    state.currentWeapon = Math.max(0, state.weapons.length - 1);
    equipModel(curDef());
    if (curDef()) raiseWeapon();
  }
  updateAmmoHUD();
}
function tryRevive() {
  if (!hasPerk('revive')) return false;
  state.perks = [];
  loseWave();                                                     // F5.5: la Ola Rompiente vuelve al taller
  dropMuleWeapon();                                               // F5.11: sin Mule Kick, la 3ra arma se pierde
  updatePerkHUD();
  startDown();                                                    // F5.18: tirado 10 s con la Ray Gun
  return true;
}
// F5.18: "last stand" (CONFIG.PERKS.lastStand). DOWN.saved = tus armas mientras tanto
const DOWN = { on: false, t: 0, saved: null, cur: 0 };
function startDown() {
  const L = CONFIG.PERKS.lastStand, def = CONFIG.WEAPONS[L.weapon], W = weaponsState;
  if (W.phase === 'shield') unequipShield();
  if (W.phase === 'reloading') UI.reload.style.opacity = '0';
  DOWN.on = true; DOWN.t = L.time; DOWN.saved = state.weapons; DOWN.cur = state.currentWeapon;
  state.weapons = [{ id: L.weapon, mag: def.magSize, reserve: def.reserveMax }]; state.currentWeapon = 0;
  state.health = 1; ADS.on = false;
  W.phase = 'idle'; raiseWeapon(); equipModel(def); updateAmmoHUD();
  sfxRevive(); showBanner('QUICK REVIVE', 1.6); gfxApplyFilter();
}
function endDown() {
  const P = CONFIG.PLAYER;
  DOWN.on = false;
  state.weapons = DOWN.saved || []; DOWN.saved = null;
  state.currentWeapon = Math.max(0, Math.min(DOWN.cur, state.weapons.length - 1));
  state.health = maxHealth();
  // el i-frame de damagePlayer mira lastDamageTime: correrlo hacia adelante da reviveIframe s limpios
  state.lastDamageTime = clock.elapsedTime + CONFIG.PERKS.reviveIframe - P.hitIframe;
  weaponsState.phase = 'idle'; raiseWeapon(); equipModel(curDef()); updateAmmoHUD();
  sfxRevive(); showBanner('REVIVED', 1.2); gfxApplyFilter();
}
function updateDown(dt) {
  player.downK += ((DOWN.on ? 1 : 0) - player.downK) * Math.min(1, dt * 6);
  if (DOWN.on && (DOWN.t -= dt) <= 0) endDown();
}

function updatePerks(dt) {
  updateLanterns(dt);                                              // F5.20: faroles de la casa
  const PK = CONFIG.PERKS, px = player.pos.x, pz = player.pos.z, t = clock.elapsedTime;
  // F5.19c: la canción de la máquina al acercarte (se aleja con vos). F5.28e (Diego: "verifica que se active cuando uno
  // esté cerca"): suena también sin energía (antes salía antes de mirar) y desde más lejos, en el mismo nivel
  for (const key of PERK_KEYS) {
    const m = PERKM.machines[key];
    if (m.gone || state.gameOver || !state.running) continue;
    const d = Math.hypot(px - m.x, pz - m.z) + Math.abs(playerLevel() - (m.level || 0)) * 99;
    if (d < PK.jingleDist && !m.near) { m.near = true; sfxJingle(key, m); }
    else if (d > PK.jingleDist + 4) m.near = false;
  }
  if (!state.power) return;
  for (const key of PERK_KEYS) {
    const m = PERKM.machines[key];
    if (m.gone) continue;
    const k = 0.75 + 0.25 * Math.sin(t * 3 + m.x);                  // la lámpara late
    m.lamp.material.color.setHex(PK.list[key].color).multiplyScalar(k);
    if (m.neon) m.neon.material.color.setHex(PK.list[key].color).multiplyScalar(0.8 + 0.2 * Math.sin(t * 5 + m.z));   // F5.19: el neón titila
  }
}

// F5.20: faroles de la casa. Uno colgado al lado de cada lámpara de cuarto (del techo, a la altura de la mano). F lo
// prende: la lámpara de ese cuarto se prende HOUSE.time s y la casa ahí se aclara (houseDark). Con energía no hacen falta.
// El vidrio es MeshBasic (brilla solo) y un halo aditivo; se construyen una vez
const LANTERNS = { list: [] };
function buildLanterns() {
  const glowTex = radialTex('rgba(255,210,120,1)', 'rgba(255,150,40,.35)');
  WORLD.lamps.forEach(L => {
    if (!L.room || !CONFIG.HOUSE.rooms.includes(L.room)) return;
    const x = L.light.position.x + 0.9, z = L.light.position.z, g = new THREE.Group(), mb = new MeshBuilder();
    mb.box(0, 0.62, 0, 0.02, 1.3, 0.02, 0x2a2a2a);                        // cadena
    mb.box(0, 0, 0, 0.26, 0.04, 0.26, 0x3a3228); mb.box(0, 0.36, 0, 0.3, 0.05, 0.3, 0x3a3228);   // base y techito
    mb.cyl(0, 0.39, 0, 0.12, 0.1, 0x3a3228, 0.3, 8);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mb.box(sx * 0.12, 0.18, sz * 0.12, 0.025, 0.34, 0.025, 0x3a3228);   // parantes
    const frame = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    scene.remove(frame); frame.matrixAutoUpdate = true; frame.userData.theme = false; g.add(frame);
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x2a2418 });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), glassMat); glass.position.y = 0.18; g.add(glass);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    halo.position.y = 0.18; g.add(halo);
    const y = 2.15;                                                      // arriba de la cabeza (los ojos van a 1.7)
    g.position.set(x, y, z); scene.add(g);
    LANTERNS.list.push({ lamp: L, room: L.room, x, z, g, glassMat, halo });
  });
  buildDoorLights();                                                 // F5.28f
}
function lanternNear(room, px, pz, bd) {
  if (!room || state.power || playerLevel() !== 0) return null;
  let best = null;
  for (const T of LANTERNS.list) {
    if (T.room !== room.id) continue;
    const d = Math.hypot(px - T.x, pz - T.z);
    if (d < Math.min(bd, CONFIG.HOUSE.reach) && (!best || d < best.dist)) best = { dist: d, target: T };
  }
  return best;
}
function lanternPrompt(T) {
  const left = T.lamp.litT || 0;
  return left > 0 ? { text: 'Lantern lit (' + Math.ceil(left) + ' s) - [F] refill', cost: 0 } : { text: '[F] Light the lantern', cost: 0 };
}
function useLantern(T) {
  T.lamp.litT = CONFIG.HOUSE.time;
  if (typeof sfxPin === 'function') sfxPin();                     // el clic del encendedor
  return true;
}
function updateLanterns(dt) {
  const t = clock.elapsedTime;
  updateDoorLights();                                                // F5.28f
  for (const T of LANTERNS.list) {
    const L = T.lamp;
    if (L.litT > 0) L.litT = Math.max(0, L.litT - dt);
    const on = state.power || L.litT > 0, fl = on ? 0.85 + 0.15 * Math.sin(t * 13 + T.x) * Math.sin(t * 7.1) : 0;
    // los últimos 10 s titila: se está apagando
    const dying = !state.power && L.litT > 0 && L.litT < 10 ? (Math.sin(t * 18) > 0 ? 1 : 0.35) : 1;
    T.glassMat.color.setRGB(on ? fl * dying : 0.16, on ? 0.72 * fl * dying : 0.14, on ? 0.35 * fl * dying : 0.1);
    T.halo.material.opacity = on ? 0.55 * fl * dying : 0;
    T.halo.quaternion.copy(camera.quaternion);
    T.g.rotation.z = Math.sin(t * 1.3 + T.z) * 0.04;                  // se hamaca un poco
  }
}
function resetLanterns() { for (const T of LANTERNS.list) T.lamp.litT = 0; }

// F5.28f (Diego: "cuando abra una puerta que dé al jardín o afuera, que entre un poco la luz, pero naturalmente"): cada
// puerta entre un cuarto de la casa y uno de afuera tiene, del lado de adentro, una franja de luz de día en el piso (plano
// aditivo con degradé: fuerte en el marco, se pierde hacia adentro), prendida solo con la puerta abierta. Y cerca de una
// puerta abierta la oscuridad de la casa se afloja (DOORLIGHT.spill, lo usa houseDark). De noche, casi nada
const DOORLIGHT = { list: [], spill: 0 };
function buildDoorLights() {
  const H = CONFIG.HOUSE, cv = document.createElement('canvas');
  cv.width = 4; cv.height = 64;
  const g = cv.getContext && cv.getContext('2d');
  if (g && g.createLinearGradient) {
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
  }
  const tex = new THREE.CanvasTexture(cv);
  for (const id in DOOR_LINKS) {
    const [a, b] = DOOR_LINKS[id], d = state.doors[id];
    if (!d || !d.collider) continue;
    const inA = H.rooms.includes(a), inB = H.rooms.includes(b);
    if (inA === inB) continue;
    const out = ROOMS.find(r => r.id === (inA ? b : a));
    if (!out || !out.outdoor) continue;
    const c = d.collider, cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2, alongX = c.maxX - c.minX > c.maxZ - c.minZ;
    const w = alongX ? c.maxX - c.minX : c.maxZ - c.minZ, t = alongX ? c.maxZ - c.minZ : c.maxX - c.minX, house = inA ? a : b;
    // hacia adentro: el lado del marco donde está el cuarto de la casa
    const nx = alongX ? 0 : 1, nz = alongX ? 1 : 0, rin = roomAt(cx + nx * 1.2, cz + nz * 1.2), s = rin && rin.id === house ? 1 : -1;
    const grp = new THREE.Group();
    grp.position.set(cx, groundY(cx + nx * s * 1.2, cz + nz * s * 1.2) + 0.08, cz); grp.rotation.y = Math.atan2(nx * s, nz * s);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H.doorLightLen), new THREE.MeshBasicMaterial({ map: tex, color: 0xffd6a0, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    m.rotation.x = -Math.PI / 2; m.position.z = t / 2 + H.doorLightLen / 2;           // (el borde fuerte, en el marco)
    grp.add(m); grp.visible = false; grp.userData.theme = false; scene.add(grp);
    DOORLIGHT.list.push({ id, d, g: grp, m, cx, cz });
  }
}
function updateDoorLights() {
  const H = CONFIG.HOUSE, day = 1 - H.doorNight * (typeof NIGHT !== 'undefined' ? NIGHT.k : 0), P = player.pos;
  let spill = 0;
  for (const D of DOORLIGHT.list) {
    const on = !!D.d.open;
    D.g.visible = on;
    if (!on) continue;
    D.m.material.opacity = H.doorLightOpacity * day;
    spill = Math.max(spill, Math.max(0, 1 - Math.hypot(P.x - D.cx, P.z - D.cz) / H.doorReach) * day);
  }
  DOORLIGHT.spill = spill;
}

function updatePerkHUD() {
  UI.perks.innerHTML = state.perks.map(k => {
    const P = CONFIG.PERKS.list[k];
    return '<i style="background:#' + P.color.toString(16).padStart(6, '0') + '">' + P.abbr + '</i>';
  }).join('');
}
function resetPerks() {
  state.perks = []; state.reviveBuys = 0; state.power = false;
  DOWN.on = false; DOWN.saved = null; DOWN.t = 0; player.downK = 0;   // F5.18
  for (const L of WORLD.lamps) if (L.mode0) L.mode = L.mode0;
  resetLanterns();                                                 // F5.20
  for (const key of PERK_KEYS) {
    if (!PERKM.machines[key]) continue;
    showMachine(key); PERKM.machines[key].near = false; paintMachine(key);
  }
  updatePerkHUD();
}
