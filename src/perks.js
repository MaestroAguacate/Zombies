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
function maxHealth() { return hasPerk('jugg') ? CONFIG.PERKS.juggHealth : CONFIG.PLAYER.maxHealth; }
function perkRate() { return hasPerk('dtap') ? CONFIG.PERKS.dtapRate : 1; }          // divide el intervalo entre disparos
function perkDmg() { return hasPerk('dtap') ? CONFIG.PERKS.dtapDamage : 1; }
function perkReload() { return hasPerk('speed') ? CONFIG.PERKS.speedReload : 1; }
function sprintMul() { return hasPerk('stamin') ? CONFIG.PERKS.staminSpeed : 1; }
function staminaMul() { return hasPerk('stamin') ? CONFIG.PERKS.staminTime : 1; }

function buildPerks() {
  const PK = CONFIG.PERKS, S = PK.size;
  for (const key of PERK_KEYS) {
    const P = PK.list[key];
    const mb = new MeshBuilder();
    const r = relicBody(mb, Object.assign({ y: P.level ? UP.y : 0 }, P), S, 0x3a3a40, 'perk:' + key, 'world');   // F5.8: level 1 = en el techo; F5.11: P.y (búnker)
    const c = new THREE.Color(P.color).multiplyScalar(0.55).getHex();
    const front = S.d / 2;
    mb.box(0, S.h * 0.55, front + 0.01, S.w * 0.92, S.h * 0.5, 0.02, c);              // frente pintado
    mb.box(0, S.h + 0.05, 0, S.w + 0.08, 0.1, S.d + 0.08, 0x2a2a2e);                 // techo
    mb.box(0, 0.05, 0, S.w + 0.06, 0.1, S.d + 0.06, 0x2a2a2e);                       // base
    mb.box(0, 0.35, front + 0.08, S.w * 0.6, 0.12, 0.16, 0x1c1c20);                  // bandeja de latas
    mb.setFrame(null);
    const body = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    body.userData.theme = false; body.updateMatrix();
    // cartel con el nombre y lámpara de arriba (se tiñen oscuros sin power)
    const tex = makeTex((cx, s) => {
      cx.fillStyle = '#' + P.color.toString(16).padStart(6, '0'); cx.fillRect(0, 0, s, s);
      cx.fillStyle = 'rgba(0,0,0,.35)'; cx.fillRect(0, s * 0.3, s, s * 0.4);
      cx.fillStyle = '#fff'; cx.font = 'bold ' + Math.floor(s * 0.17) + 'px monospace'; cx.textAlign = 'center';
      const w = P.name.split(' ');
      w.forEach((t, i) => cx.fillText(t, s / 2, s * (0.5 + (i - (w.length - 1) / 2) * 0.2) + s * 0.06));
    }, 1, 128);
    tex.magFilter = THREE.LinearFilter;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(S.w * 0.8, 0.55), new THREE.MeshBasicMaterial({ map: tex, color: 0x303030 }));
    sign.position.set(0, S.h * 0.78, front + 0.025);
    r.g.add(sign);
    const lamp = basicBox(S.w * 0.7, 0.08, 0.08, 0x2a2a2a, 0, S.h - 0.08, front + 0.03);
    r.g.add(lamp);
    r.g.updateMatrixWorld(true);
    PERKM.machines[key] = { key, room: P.room, level: P.level || 0, x: P.x, z: P.z, g: r.g, body, hit: r.body, col: r.col, sign, lamp, near: false, gone: false };
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
}

// qué dice la máquina (y si se puede comprar). Lo usan el prompt y buyPerk
function perkStatus(key) {
  const P = CONFIG.PERKS.list[key];
  if (!state.power) return { text: P.name + ' - necesita energía', ok: false, cost: 0 };
  if (hasPerk(key)) return { text: P.name + ' - ya la tenés', ok: false, cost: 0 };
  if (state.perks.length >= CONFIG.PERKS.max) return { text: 'Máximo ' + CONFIG.PERKS.max + ' perks', ok: false, cost: 0 };
  return { text: '[F] ' + P.name + ' - ' + P.cost, ok: true, cost: P.cost };
}
function buyPerk(key) {
  const st = perkStatus(key), m = PERKM.machines[key];
  if (!st.ok || m.gone) return false;
  if (!spendPoints(st.cost)) return false;
  state.perks.push(key);
  if (key === 'jugg') state.health = maxHealth();
  if (key === 'revive' && ++state.reviveBuys >= CONFIG.PERKS.reviveUses) hideMachine(key);
  sfxPerkDrink();
  updatePerkHUD();
  return true;
}
function hideMachine(key) {
  const m = PERKM.machines[key];
  m.gone = true; m.g.visible = false; m.body.visible = false; m.col.solid = false;
  const i = WORLD.hitMeshes.indexOf(m.hit);
  if (i >= 0) WORLD.hitMeshes.splice(i, 1);
}
function showMachine(key) {
  const m = PERKM.machines[key];
  m.gone = false; m.g.visible = true; m.body.visible = true; m.col.solid = true;
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
  const P = CONFIG.PLAYER, t = clock.elapsedTime;
  state.perks = [];
  state.health = maxHealth();
  loseWave();                                                     // F5.5: la Ola Rompiente vuelve al taller
  dropMuleWeapon();                                               // F5.11: sin Mule Kick, la 3ra arma se pierde
  // el i-frame de damagePlayer mira lastDamageTime: correrlo hacia adelante da reviveIframe s limpios
  state.lastDamageTime = t + CONFIG.PERKS.reviveIframe - P.hitIframe;
  sfxRevive(); showBanner('QUICK REVIVE', 1.6);
  updatePerkHUD();
  return true;
}

function updatePerks(dt) {
  if (!state.power) return;
  const PK = CONFIG.PERKS, px = player.pos.x, pz = player.pos.z, t = clock.elapsedTime;
  for (const key of PERK_KEYS) {
    const m = PERKM.machines[key];
    if (m.gone) continue;
    const d = Math.hypot(px - m.x, pz - m.z);
    if (d < PK.jingleDist && !m.near) { m.near = true; sfxJingle(key); }
    else if (d > PK.jingleDist + 2) m.near = false;
    const k = 0.75 + 0.25 * Math.sin(t * 3 + m.x);                  // la lámpara late
    m.lamp.material.color.setHex(PK.list[key].color).multiplyScalar(k);
  }
}

function updatePerkHUD() {
  UI.perks.innerHTML = state.perks.map(k => {
    const P = CONFIG.PERKS.list[k];
    return '<i style="background:#' + P.color.toString(16).padStart(6, '0') + '">' + P.abbr + '</i>';
  }).join('');
}
function resetPerks() {
  state.perks = []; state.reviveBuys = 0; state.power = false;
  for (const L of WORLD.lamps) if (L.mode0) L.mode = L.mode0;
  for (const key of PERK_KEYS) {
    if (!PERKM.machines[key]) continue;
    showMachine(key); PERKM.machines[key].near = false; paintMachine(key);
  }
  updatePerkHUD();
}
