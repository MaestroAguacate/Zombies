//=== 7k. CHICLES EN LA PARTIDA (V2 F5.18b) ==================================
// Chicleras (CONFIG.GUMS.machine): pagás puntos (500, 1000, 2000 en la misma ronda, hasta maxPerRound) y sale uno al azar
// de tu preset (progress.js presetGums). Queda `offer` s en la bandeja: F lo agarra (recién ahí se gasta, si no es
// clásico); si no, se va y el chicle sigue en tu inventario. Al agarrarlo se activa según su tipo (instant, timed,
// charges con T, melee, passive). GUMM.fx[id] = segundos que le quedan a un efecto; GUMM.held = el de cargas
const GUMM = { machines: [], offer: null, held: null, fx: {}, uses: 0 };

function buildGumMachines() {
  const M = CONFIG.GUMS.machine, S = M.size;
  for (const sp of M.spots) {
    const mb = new MeshBuilder(), r = relicBody(mb, sp, S, 0x000000, 'gum', 'gum');
    mb.p.length = mb.n.length = mb.uv.length = mb.c.length = mb.i.length = 0;   // (relicBody dibuja una caja: la cambiamos)
    const yy = sp.y || 0;                                                // F5.22: puede ir arriba (el embarcadero)
    mb.setFrame(sp.x, yy, sp.z, sp.rot);
    // cúbica: base roja, columna, globo de vidrio con chicles de colores, tapa, ranura de monedas y bandeja
    mb.box(0, 0.12, 0, 0.9, 0.24, 0.7, 0x8a1a1a);
    mb.box(0, 0.55, 0, 0.6, 0.62, 0.5, 0xc8282a);
    mb.box(0, 0.86, 0, 0.66, 0.06, 0.56, 0xe8c030);
    mb.box(0, 0.55, 0.26, 0.2, 0.14, 0.02, 0x2a2a2a);                     // bandeja
    mb.box(0.18, 0.72, 0.26, 0.08, 0.1, 0.02, 0xd8d8d8);                  // ranura
    mb.box(-0.18, 0.72, 0.26, 0.12, 0.12, 0.04, 0xb8b8c0);                // perilla
    let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const cols = [0xff4a4a, 0x4aa8ff, 0x6ad86a, 0xffd23a, 0xd060ff, 0xff8a2a, 0xf0f0f0];
    for (let i = 0; i < 26; i++) mb.box((rnd() - 0.5) * 0.44, 0.96 + rnd() * 0.42, (rnd() - 0.5) * 0.34, 0.08, 0.08, 0.08, cols[i % cols.length], 0, rnd() * 3, 0);
    mb.box(0, 1.56, 0, 0.66, 0.08, 0.56, 0xc8282a); mb.box(0, 1.64, 0, 0.3, 0.08, 0.26, 0xe8c030);
    mb.setFrame(null);
    const body = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    if (body) { body.userData.theme = false; body.updateMatrix(); }
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.64, 0.48), new THREE.MeshLambertMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.28, depthWrite: false }));
    glass.position.set(sp.x, yy + 1.2, sp.z); glass.rotation.y = sp.rot; glass.userData.theme = false; scene.add(glass);
    // el chicle que sale: un cubo que brilla en la bandeja, con el color del chicle (MeshBasic, sin luces)
    const ball = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const f = new THREE.Vector3(0, 0.66, 0.34).applyAxisAngle(new THREE.Vector3(0, 1, 0), sp.rot);
    ball.position.set(sp.x + f.x, yy + f.y, sp.z + f.z); ball.visible = false; ball.userData.theme = false; scene.add(ball);
    GUMM.machines.push({ room: sp.room, level: sp.level || 0, x: sp.x, z: sp.z, col: r.col, ball, y0: yy + f.y, fx: f.x, fz: f.z });
  }
  buildWrathFx();                                                        // F5.28d
}
// F5.28d: KRAKEN'S WRATH: tentáculos que salen del piso alrededor tuyo (pool fijo, una geometría compartida). Suben, se
// quedan retorciéndose y se hunden (updateWrathFx)
const WRATH = { list: [], t: 0 };
function buildWrathFx() {
  const W = CONFIG.GUMS.list.krakenwrath, mb = new MeshBuilder();
  lichTentacle(mb, W.len, 0.55, 3, 17);
  const geo = mb.geometry(), mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  for (let i = 0; i < W.count; i++) {
    const g = new THREE.Group(), m = new THREE.Mesh(geo, mat);
    m.rotation.x = Math.PI;                                              // el tentáculo cuelga: dado vuelta, sale para arriba
    g.add(m); g.visible = false; g.userData.theme = false; scene.add(g);
    WRATH.list.push({ g, x: 0, z: 0, y: 0, a: 0 });
  }
}
function updateWrathFx(dt) {
  if (WRATH.t <= 0) return;
  const W = CONFIG.GUMS.list.krakenwrath, T = W.fxTime, t = clock.elapsedTime;
  WRATH.t = Math.max(0, WRATH.t - dt);
  const u = 1 - WRATH.t / T, rise = Math.min(1, u / 0.2), sink = u > 0.75 ? (u - 0.75) / 0.25 : 0, h = (rise - sink) * W.len;
  WRATH.list.forEach((w, i) => {
    w.g.visible = WRATH.t > 0;
    w.g.position.set(w.x, w.y - W.len + h, w.z);
    w.g.rotation.set(Math.sin(t * 5 + i) * 0.25, w.a + t * 0.8, Math.cos(t * 4 + i * 1.7) * 0.25);
  });
}
// el efecto: todo zombie (no boss) a menos de `radius` m en tu nivel muere; a los bosses les saca bossFrac de su vida
function gumWrath() {
  const W = CONFIG.GUMS.list.krakenwrath, P = player.pos, pl = playerLevel(), gy = pl ? lvY(pl) : groundY(P.x, P.z);
  WRATH.t = W.fxTime;
  WRATH.list.forEach((w, i) => {
    const a = i / WRATH.list.length * Math.PI * 2, r = W.radius * (0.35 + 0.5 * ((i * 37) % 10) / 10);
    w.x = P.x + Math.cos(a) * r; w.z = P.z + Math.sin(a) * r; w.y = gy; w.a = a;
    spawnSplashFx(w.x, gy + 0.2, w.z, 0x5a0a10, 1.4);
  });
  addTrauma(0.7); sfxBossRoar();
  for (const z of state.zombies.slice()) {
    if (!z.alive || (z.level || 0) !== pl || Math.hypot(z.px - P.x, z.pz - P.z) > W.radius) continue;
    if (z.boss) damageZombie(z, z.maxHealth * W.bossFrac, false, 0, 0);
    else damageZombie(z, z.health + 1, false, CONFIG.POINTS.kill, 0);
  }
}
// F5.28d: SCAVENGER: cada kill te devuelve balas al cargador del arma en la mano
function gumScavenge() {
  const s = curSlot();
  if (!s) return;
  const d = slotDef(s);
  s.mag = Math.min(d.magSize, s.mag + CONFIG.GUMS.list.scavenger.bullets); updateAmmoHUD();
}
// F5.28d: BONE ARMOR: se come el golpe entero; `hits` golpes y se rompe
function gumArmorHit(t) {
  state.lastDamageTime = t;                                              // el i-frame corre igual
  addTrauma(0.3); if (typeof sfxShieldTake === 'function') sfxShieldTake();
  if (--GUMM.armor <= 0) { delete GUMM.fx.bonearmor; showBanner('BONE ARMOR BROKE', 1.4); gumEnded(); }
  updateGumHUD();
}
// F5.28d: KILLING TIME al terminar: mueren los que baleaste mientras estaban congelados
function gumKillMarked() {
  const gen = GUMM.ktGen;
  for (const z of state.zombies.slice()) if (z.ktMark === gen && z.alive && !z.boss) damageZombie(z, z.health + 1, false, CONFIG.POINTS.kill, 0);
  GUMM.ktGen = gen + 1;
}
function gumActive(id) { return (GUMM.fx[id] || 0) > 0; }
function gumCost() { const C = CONFIG.GUMS.machine.cost; return C[Math.min(GUMM.uses, C.length - 1)]; }
function gumNear(room, px, pz, bd) {
  let best = null;
  for (const m of GUMM.machines) {
    if (!room || room.id !== m.room || m.level !== playerLevel()) continue;   // F5.22: la de arriba, solo desde arriba
    const d = colDist(m.col, px, pz);
    if (d < bd) { bd = d; best = { dist: d, target: m }; }
  }
  return best;
}
function gumPrompt(m) {
  const O = GUMM.offer, G = CONFIG.GUMS;
  if (O && O.m === m && O.vend > 0) return { text: 'Gum machine - dispensing...', cost: 0 };
  if (O && O.m === m) {
    const g = gumDef(O.id);
    if (gumCount(O.id) <= 0) return { text: g.name + ' - you have none', cost: 0 };   // F5.20: salió pero no lo tenés
    return { text: '[F] Take ' + g.name + ' (' + G.rarities[g.rarity].name + ')', cost: 0 };
  }
  if (!presetGums().length) return { text: 'Gum machine - pick your gums in the menu', cost: 0 };
  if (GUMM.uses >= G.machine.maxPerRound) return { text: 'Gum machine - come back next round', cost: 0 };
  const left = gumTimedLeft();                                     // F5.19c: uno a la vez
  if (left > 0) return { text: 'Gum machine - your gum is still active (' + Math.ceil(left) + ' s)', cost: 0 };
  return { text: '[F] Gum machine (' + (gumCost() > 0 ? gumCost() : 'FREE') + ')' + (GUMM.held ? ' - replaces your gum' : ''), cost: gumCost() };
}
function useGumMachine(m) {
  const O = GUMM.offer, G = CONFIG.GUMS;
  if (O && O.m === m) return takeGum();
  if (O) return false;                                            // ya hay uno esperando en otra
  const pool = presetGums();
  if (!pool.length || GUMM.uses >= G.machine.maxPerRound) return false;
  if (gumTimedLeft() > 0) return false;                           // F5.19c: uno por tiempo activo: hasta que se acabe, no
  const cost = gumCost();
  if (cost > 0 && !spendPoints(cost)) return false;               // F5.21: el primero de la ronda es gratis
  GUMM.uses++;
  const id = pool[Math.floor(Math.random() * pool.length)];
  // F5.19: tarda `vend` s: el chicle baja girando por el globo y recién después se puede agarrar
  // F5.19c: con el ruido de la chiclera de Diego (dura ~6 s: el chicle sale a los vend s)
  playSample('ruido_de_la_gumball_machine', { pos: [m.x, 1.2, m.z], maxDist: 30 });
  GUMM.offer = { id, m, t: G.machine.offer, vend: G.machine.vend };
  m.ball.material.color.set(gumDef(id).color); m.ball.visible = true;
  placeGumBall(m, 0);
  return true;
}
// k = 0 arriba del globo, 1 en la bandeja
function placeGumBall(m, k) {
  const e = k * k, top = m.y0 - 0.66 + 1.45;                       // cae acelerando (F5.22: desde la altura de la máquina)
  m.ball.position.set(m.x + m.fx * k, top + (m.y0 - top) * e, m.z + m.fz * k);
}
function takeGum() {
  const O = GUMM.offer;
  if (!O || O.vend > 0) return false;
  // F5.20 (Diego): uno que no tenés sale igual, pero no se agarra (queda en la bandeja hasta que se va)
  if (gumCount(O.id) <= 0 || !useGumItem(O.id)) { showBanner('You have no ' + gumDef(O.id).name, 1.6); return false; }
  O.m.ball.visible = false; GUMM.offer = null;
  activateGum(O.id);
  return true;
}
// F5.19c (Diego): un solo chicle activo. Mientras dure uno por tiempo, la chiclera no vende (gumTimedLeft). Uno por
// uso (cargas, cuchillo o pasivo) se puede cambiar: al agarrar otro, el anterior se pierde
function gumTimedLeft() {
  let t = 0;
  for (const k in GUMM.fx) if (GUMM.fx[k] > 0 && GUMM.fx[k] !== Infinity) t = Math.max(t, GUMM.fx[k]);
  return t;
}
function gumEnded() { if (state.running) playSample('musica_al_acabarse_un_gubblegum', { vol: 0.8 }); }
function activateGum(id) {
  const g = gumDef(id);
  if (!g) return false;
  GUMM.held = null;                                                // el que tenías en la mano se pierde
  for (const k in GUMM.fx) if (GUMM.fx[k] === Infinity) delete GUMM.fx[k];   // y el pasivo también
  if (g.type === 'instant') applyGum(id);
  else if (g.type === 'timed') GUMM.fx[id] = g.time;
  else if (g.type === 'passive') { GUMM.fx[id] = Infinity; if (id === 'bonearmor') GUMM.armor = g.hits; }   // F5.28d
  else GUMM.held = { id, charges: g.charges };                     // charges / melee
  showBanner(g.icon + ' ' + g.name + (g.type === 'charges' ? ' — press T' : ''), 2);
  updateGumHUD();
  return true;
}
// T: usa una carga del chicle que tenés en la mano
function useHeldGum() {
  const H = GUMM.held;
  if (!H || !state.running || DOWN.on || gumDef(H.id).type !== 'charges') return false;
  applyGum(H.id);
  if (--H.charges <= 0) { GUMM.held = null; if (!gumTimedLeft()) gumEnded(); }
  updateGumHUD();
  return true;
}
function applyGum(id) {
  const P = player.pos;
  if (id === 'restock') { const s = curSlot(); if (s) s.reserve = slotDef(s).reserveMax; updateAmmoHUD(); }
  else if (id === 'pointrain') state.points += gumDef(id).points;
  else if (id === 'insta3') state.effects.instakill = Math.max(state.effects.instakill, 15);
  else if (id === 'secretsip') freePerk();
  else if (id === 'shadow') GUMM.fx.shadow = gumDef(id).time;           // F5.19c: con T
  // F5.20: los nuevos
  else if (id === 'undying') GUMM.fx.undying = gumDef(id).time;          // con T
  // F5.28d: los nuevos
  else if (id === 'ammofountain') applyPowerup('maxammo');
  // (cada uso tiene su número: una marca vieja de un zombie reciclado del pool no cuenta)
  else if (id === 'killingtime') { GUMM.fx.killingtime = gumDef(id).time; GUMM.ktGen = (GUMM.ktGen || 0) + 1; showBanner('TIME STOPS', 1.4); }   // con T
  else if (id === 'krakenwrath') gumWrath();                              // con T
  else if (id === 'coinflip') { const win = Math.random() < 0.5; state.points = Math.max(0, state.points + (win ? 1500 : -750)); showBanner(win ? 'HEADS! +1500' : 'TAILS... -750', 2); }
  else if (id === 'grenadier') { state.grenades = CONFIG.GRENADE.max; if (typeof updateGrenadeHUD === 'function') updateGrenadeHUD(); }
  else if (id === 'cursed') {
    const g = gumDef(id);
    state.points += g.points;
    for (let k = 0; k < g.count; k++) { const a = k * Math.PI * 2 / g.count; clamSpawn(ZPOOL, { x: P.x + Math.cos(a) * 5, z: P.z + Math.sin(a) * 5 }, 'normal'); }
  }

  else if (id === 'sunburn') kaboom();
  else if (id === 'powerdrop') {
    const keys = POWERUP_KEYS.filter(k => k !== 'kaboom');
    for (let i = 0; i < 2; i++) trySpawnPickup(P.x + (i ? 1.2 : -1.2), P.z + 1, keys[Math.floor(Math.random() * keys.length)]);
  }
  else if (id === 'crawlspace') { for (const z of state.zombies) if (z.alive && isHuman(z) && !z.crawl && Math.hypot(z.px - P.x, z.pz - P.z) < 20) startCrawl(z); }
  else if (id === 'perkaholic') {
    for (const k of PERK_KEYS) if (!hasPerk(k) && !(PERKM.machines[k] && PERKM.machines[k].gone)) state.perks.push(k);
    state.health = maxHealth(); updatePerkHUD();
  }
  else if (id === 'blessing') {
    const s = curSlot();
    if (s && !s.pap && s.id !== 'wave') { s.pap = true; const d = slotDef(s); s.mag = d.magSize; s.reserve = d.reserveMax; equipModel(d); updateAmmoHUD(); }
  }
  sfxBuy();
}
// cuchillo con POP SHOCKS: la zona del golpe explota (sin daño propio)
function gumMeleeHit(z) {
  const H = GUMM.held;
  if (!H || H.id !== 'popshock') return;
  explodeAt(z.px, groundY(z.px, z.pz) + 1, z.pz, { damage: 300 + 50 * state.round, radius: 3.5, self: 0 });
  if (--H.charges <= 0) { GUMM.held = null; gumEnded(); }
  updateGumHUD();
}
function updateGums(dt) {
  for (const k in GUMM.fx) if (GUMM.fx[k] > 0 && GUMM.fx[k] !== Infinity) {
    GUMM.fx[k] = Math.max(0, GUMM.fx[k] - dt);
    if (!GUMM.fx[k]) { if (k === 'killingtime') gumKillMarked(); updateGumHUD(); gumEnded(); }   // F5.28d
  }
  updateWrathFx(dt);                                                      // F5.28d
  const O = GUMM.offer;
  if (O && O.vend > 0) {
    const V = CONFIG.GUMS.machine.vend;
    O.vend = Math.max(0, O.vend - dt);
    placeGumBall(O.m, 1 - O.vend / V);
    O.m.ball.rotation.y += dt * 9; O.m.ball.rotation.x += dt * 5;
    if (!O.vend) { const g = gumDef(O.id); showBanner(g.icon + ' ' + g.name + ' — [F] take', 2.2); sfxBuy(); }
  } else if (O) {
    O.t -= dt;
    O.m.ball.position.y = O.m.y0 + Math.sin(clock.elapsedTime * 6) * 0.02;
    O.m.ball.rotation.y += dt * 3;
    if (O.t <= 0) { O.m.ball.visible = false; GUMM.offer = null; }   // no lo agarraste: no se gastó
  }
  if (UI.gumhud && (GUMM.held || Object.keys(GUMM.fx).some(k => GUMM.fx[k] > 0))) updateGumHUD();
}
function updateGumHUD() {
  if (!UI.gumhud) return;
  // F5.19: círculo del color del chicle; el contorno se parte en `n` tramos (cargas) y se llenan `on`, o es un arco
  // continuo con la fracción de tiempo que queda (n = 0)
  let h = '';
  const ring = (on, n) => {
    if (!n) return 'conic-gradient(#fff ' + (on * 100).toFixed(1) + '%, rgba(0,0,0,.5) 0)';
    const s = 360 / n, gap = n > 1 ? 6 : 0, st = [];
    for (let i = 0; i < n; i++) {
      const c = i < on ? '#fff' : 'rgba(0,0,0,.5)', a = i * s;
      st.push('transparent ' + a + 'deg ' + (a + gap / 2) + 'deg', c + ' ' + (a + gap / 2) + 'deg ' + (a + s - gap / 2) + 'deg', 'transparent ' + (a + s - gap / 2) + 'deg ' + (a + s) + 'deg');
    }
    return 'conic-gradient(' + st.join(',') + ')';
  };
  const chip = (g, bg, txt) => '<i style="background:' + bg + '"><s style="background:' + g.color + '">' + g.icon + '</s><b>' + txt + '</b></i>';
  if (GUMM.held) { const g = gumDef(GUMM.held.id), n = g.charges || 1;
    h += chip(g, ring(GUMM.held.charges, n), (g.type === 'charges' ? '[T] ' : '') + GUMM.held.charges + '/' + n); }
  for (const k in GUMM.fx) if (GUMM.fx[k] > 0) { const g = gumDef(k), inf = GUMM.fx[k] === Infinity;
    h += chip(g, ring(inf ? 1 : GUMM.fx[k] / (g.time || 1), 0), inf ? '' : Math.ceil(GUMM.fx[k]) + 's'); }
  if (h !== UI.gumhud.innerHTML) UI.gumhud.innerHTML = h;
}
function resetGums() {
  GUMM.offer = null; GUMM.held = null; GUMM.fx = {}; GUMM.uses = 0; GUMM.armor = 0;
  WRATH.t = 0; for (const w of WRATH.list) w.g.visible = false;           // F5.28d
  GUMM.ktGen = (GUMM.ktGen || 0) + 1;
  for (const m of GUMM.machines) m.ball.visible = false;
  updateGumHUD();
}
