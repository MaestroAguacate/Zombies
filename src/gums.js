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
    mb.setFrame(sp.x, 0, sp.z, sp.rot);
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
    glass.position.set(sp.x, 1.2, sp.z); glass.rotation.y = sp.rot; glass.userData.theme = false; scene.add(glass);
    // el chicle que sale: un cubo que brilla en la bandeja, con el color del chicle (MeshBasic, sin luces)
    const ball = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const f = new THREE.Vector3(0, 0.66, 0.34).applyAxisAngle(new THREE.Vector3(0, 1, 0), sp.rot);
    ball.position.set(sp.x + f.x, f.y, sp.z + f.z); ball.visible = false; ball.userData.theme = false; scene.add(ball);
    GUMM.machines.push({ room: sp.room, x: sp.x, z: sp.z, col: r.col, ball, y0: f.y });
  }
}
function gumActive(id) { return (GUMM.fx[id] || 0) > 0; }
function gumCost() { const C = CONFIG.GUMS.machine.cost; return C[Math.min(GUMM.uses, C.length - 1)]; }
function gumNear(room, px, pz, bd) {
  let best = null;
  for (const m of GUMM.machines) {
    if (!room || room.id !== m.room) continue;
    const d = colDist(m.col, px, pz);
    if (d < bd) { bd = d; best = { dist: d, target: m }; }
  }
  return best;
}
function gumPrompt(m) {
  const O = GUMM.offer, G = CONFIG.GUMS;
  if (O && O.m === m) { const g = gumDef(O.id); return { text: '[F] Take ' + g.name + ' (' + G.rarities[g.rarity].name + ')', cost: 0 }; }
  if (!presetGums().length) return { text: 'Gum machine - pick your gums in the menu', cost: 0 };
  if (GUMM.uses >= G.machine.maxPerRound) return { text: 'Gum machine - come back next round', cost: 0 };
  return { text: '[F] Gum machine (' + gumCost() + ')', cost: gumCost() };
}
function useGumMachine(m) {
  const O = GUMM.offer, G = CONFIG.GUMS;
  if (O && O.m === m) return takeGum();
  if (O) return false;                                            // ya hay uno esperando en otra
  const pool = presetGums();
  if (!pool.length || GUMM.uses >= G.machine.maxPerRound) return false;
  if (!spendPoints(gumCost())) return false;
  GUMM.uses++;
  const id = pool[Math.floor(Math.random() * pool.length)];
  GUMM.offer = { id, m, t: G.machine.offer };
  m.ball.material.color.set(gumDef(id).color); m.ball.visible = true;
  showBanner(gumDef(id).icon + ' ' + gumDef(id).name + ' — [F] take', 2.2);
  return true;
}
function takeGum() {
  const O = GUMM.offer;
  if (!O) return false;
  if (!useGumItem(O.id)) { O.m.ball.visible = false; GUMM.offer = null; return false; }
  O.m.ball.visible = false; GUMM.offer = null;
  activateGum(O.id);
  return true;
}
function activateGum(id) {
  const g = gumDef(id);
  if (!g) return false;
  if (g.type === 'instant') applyGum(id);
  else if (g.type === 'timed') GUMM.fx[id] = g.time;
  else if (g.type === 'passive') GUMM.fx[id] = Infinity;
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
  if (--H.charges <= 0) GUMM.held = null;
  updateGumHUD();
  return true;
}
function applyGum(id) {
  const P = player.pos;
  if (id === 'restock') { const s = curSlot(); if (s) s.reserve = slotDef(s).reserveMax; updateAmmoHUD(); }
  else if (id === 'pointrain') state.points += gumDef(id).points;
  else if (id === 'insta3') state.effects.instakill = Math.max(state.effects.instakill, 15);
  else if (id === 'secretsip') freePerk();
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
  if (--H.charges <= 0) GUMM.held = null;
  updateGumHUD();
}
function updateGums(dt) {
  for (const k in GUMM.fx) if (GUMM.fx[k] > 0 && GUMM.fx[k] !== Infinity) { GUMM.fx[k] = Math.max(0, GUMM.fx[k] - dt); if (!GUMM.fx[k]) updateGumHUD(); }
  const O = GUMM.offer;
  if (O) {
    O.t -= dt;
    O.m.ball.position.y = O.m.y0 + Math.sin(clock.elapsedTime * 6) * 0.02;
    O.m.ball.rotation.y += dt * 3;
    if (O.t <= 0) { O.m.ball.visible = false; GUMM.offer = null; }   // no lo agarraste: no se gastó
  }
  if (UI.gumhud && (GUMM.held || Object.keys(GUMM.fx).some(k => GUMM.fx[k] > 0))) updateGumHUD();
}
function updateGumHUD() {
  if (!UI.gumhud) return;
  let h = '';
  const chip = (g, txt) => '<i style="border-color:' + CONFIG.GUMS.rarities[g.rarity].color + ';background:' + g.color + '">' + g.icon + '<b>' + txt + '</b></i>';
  if (GUMM.held) h += chip(gumDef(GUMM.held.id), (gumDef(GUMM.held.id).type === 'charges' ? 'T ' : '') + '×' + GUMM.held.charges);
  for (const k in GUMM.fx) if (GUMM.fx[k] > 0) h += chip(gumDef(k), GUMM.fx[k] === Infinity ? '' : Math.ceil(GUMM.fx[k]) + 's');
  if (h !== UI.gumhud.innerHTML) UI.gumhud.innerHTML = h;
}
function resetGums() {
  GUMM.offer = null; GUMM.held = null; GUMM.fx = {}; GUMM.uses = 0;
  for (const m of GUMM.machines) m.ball.visible = false;
  updateGumHUD();
}
