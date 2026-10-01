//=== 7o. TROFEOS DE BOSS E ÍTEMS (V2 F5.26, F5.28) ==========================
// Diego: "que los bosses suelten objetos para volverlo más adictivo". F5.28: "que sean ítems que se acumulen en el
// perfil, que los compre en una store por una partida, que los tenga que equipar, con su lugar de spawn en el mapa".
//  - Cada boss (Sombrerón, Calamarón, planta jefa, Bestia) suelta al morir su trofeo común y, con suerte, el raro
//    (CONFIG.TROPHIES.drops). Quedan flotando donde murió (pool TROPH.drops) y se agarran pasando cerca: van al PERFIL
//    (PROFILE.trophies) y dan KRAKEN INK y XP. La muerte suma a la cuenta (PROFILE.bossKills): camos y placas.
//  - La tienda ITEMS (menú) cambia trofeos por ítems (CONFIG.TROPHIES.recipes, need = precio), que se acumulan en
//    PROFILE.items. Se equipa uno (PROFILE.itemEquip). En la partida aparece desde el inicio en su lugar (itemSpot); al
//    agarrarlo se gasta y hace su efecto: garras (melee), bombas de slime (las próximas 3 granadas), talismán (+1 perk),
//    cría domesticada (pelea de tu lado 2 rondas), armadura (se come el 25% de cada golpe) o serenata (max ammo, vida
//    llena y puntos).
//  - Lo de la partida se reinicia en resetGame (resetTrophies); el perfil, no.
const TROPH = { drops: [], item: null, claws: false, talisman: false, slime: 0, armor: 0, pet: null, petRounds: 0, zones: [] };
const BOSS_LABEL = { sombrero: 'EL SOMBRERÓN', calamar: 'EL CALAMARÓN', plant: 'THE PLANT', bestia: 'THE BEAST' };
function itemDef(id) { return CONFIG.TROPHIES.recipes.find(r => r.id === id); }

//--- modelos (cubos) de cada trofeo, armados una vez ---
function trophyModel(id) {
  const mb = new MeshBuilder(), c = CONFIG.TROPHIES.items[id].color;
  if (id === 'brim') { mb.ring(0, 0, 0, 0.32, 0.06, c); mb.cyl(0, 0, 0, 0.16, 0.14, c, 0.9, 8); mb.cyl(0, 0.02, 0, 0.17, 0.04, 0xcfd0d8, 1, 8); }
  else if (id === 'guitar') { mb.box(0, -0.1, 0, 0.26, 0.34, 0.07, c); mb.box(0, 0.26, 0, 0.05, 0.4, 0.04, 0x3b2410); mb.box(0, -0.06, 0.04, 0.08, 0.08, 0.01, 0x1a0e06); mb.box(0, 0.5, 0, 0.08, 0.1, 0.05, 0x2a180a); }
  else if (id === 'inksac') { mb.blob(0, 0, 0, 0.22, 0.28, 0.22, c, 2); mb.box(0, 0.3, 0, 0.06, 0.1, 0.06, 0x4a1a5a); }
  else if (id === 'abyss') { mb.sphere(0, 0, 0, 0.22, 0.22, 0.22, c, 10); mb.box(0, 0, 0.2, 0.14, 0.14, 0.04, 0x5aa8c8); mb.box(0, 0, 0.225, 0.07, 0.1, 0.02, 0x0a0a0a); }
  else if (id === 'seed') { mb.blob(0, 0, 0, 0.18, 0.26, 0.18, c, 4); for (let k = 0; k < 4; k++) mb.box(Math.cos(k * 1.57) * 0.12, 0, Math.sin(k * 1.57) * 0.12, 0.03, 0.3, 0.03, 0x7aff3a); }
  else if (id === 'root') { mb.blob(0, 0, 0, 0.22, 0.24, 0.2, c, 1); for (let k = 0; k < 4; k++) mb.seg([0, -0.1, 0], [Math.cos(k * 1.57) * 0.3, -0.35, Math.sin(k * 1.57) * 0.3], 0.04, 0.015, 0x5a3a1a, 4); }
  else if (id === 'claw') { for (let k = -1; k <= 1; k++) { mb.seg([k * 0.1, -0.2, 0], [k * 0.12, 0.1, 0.06], 0.05, 0.04, c, 4); mb.seg([k * 0.12, 0.1, 0.06], [k * 0.1, 0.26, 0.2], 0.04, 0.01, c, 4); } mb.box(0, -0.22, 0, 0.36, 0.1, 0.14, 0x3a2416); }
  else if (id === 'gland') { mb.blob(0, 0, 0, 0.24, 0.2, 0.22, c, 3); for (let k = 0; k < 5; k++) mb.box(Math.cos(k * 1.26) * 0.18, 0.05, Math.sin(k * 1.26) * 0.16, 0.06, 0.06, 0.06, 0xff7a1a); }
  const g = new THREE.Group();
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x2a2018 }));
  scene.remove(m); m.matrixAutoUpdate = true; g.add(m);
  return g;
}
function buildTrophies() {
  const T = CONFIG.TROPHIES, haloMat = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,210,140,.9)', 'rgba(255,140,40,.25)'), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < T.pool; i++) {
    const g = new THREE.Group(), models = {};
    for (const id in T.items) { const m = trophyModel(id); m.visible = false; g.add(m); models[id] = m; }
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), haloMat); g.add(halo);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3, 0.08), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.35, depthWrite: false }));
    beam.position.y = 1.5; g.add(beam);
    g.visible = false; scene.add(g);
    TROPH.drops.push({ g, models, halo, id: null, x: 0, y: 0, z: 0, level: 0, t: 0, life: 0 });
  }
  // F5.28: el ítem equipado en su lugar del mapa: su trofeo girando sobre un pedestal de huesos, con halo y haz violeta
  { const g = new THREE.Group(), models = {}, top = new THREE.Group();
    for (const id in T.items) { const m = trophyModel(id); m.visible = false; m.scale.setScalar(1.4); top.add(m); models[id] = m; }
    top.position.y = 1.3; g.add(top);
    const ped = new MeshBuilder();
    ped.box(0, 0.35, 0, 0.7, 0.7, 0.7, 0x4a4640); ped.box(0, 0.72, 0, 0.8, 0.06, 0.8, 0x5a5650);
    for (let k = 0; k < 4; k++) ped.box(Math.cos(k * 1.57) * 0.3, 0.8, Math.sin(k * 1.57) * 0.3, 0.1, 0.12, 0.1, 0xe0d4b4);   // cráneos chicos
    for (let k = 0; k < 6; k++) ped.box(Math.cos(k) * 0.6, 0.04, Math.sin(k) * 0.6, 0.4, 0.05, 0.06, 0xd4c4a0, 0, k, 0);        // huesos alrededor
    const pm = ped.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x1a1410 }));
    scene.remove(pm); g.add(pm);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: radialTex('rgba(200,140,255,.9)', 'rgba(120,40,200,.25)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.y = 1.3; g.add(halo);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.1, 6, 0.1), new THREE.MeshBasicMaterial({ color: 0xb070ff, transparent: true, opacity: 0.35, depthWrite: false }));
    beam.position.y = 3.5; g.add(beam);
    g.visible = false; scene.add(g);
    TROPH.item = { g, top, halo, models, id: null, x: 0, z: 0, level: 0, t: 0 };
  }
  // el charco de slime de las bombas (pool fijo)
  for (let i = 0; i < 3; i++) {
    const mz = new THREE.Mesh(ACID.gooGeoB, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
    mz.visible = false; scene.add(mz);
    TROPH.zones.push({ m: mz, life: 0, x: 0, z: 0, level: 0 });
  }
}

//--- el botín ---
// kind: 'sombrero' | 'calamar' | 'plant' | 'bestia'. Suma a la cuenta y deja caer los trofeos
function bossTrophies(kind, x, z, level) {
  const T = CONFIG.TROPHIES, D = T.drops[kind];
  if (!D) return [];
  if (!DEV.on) {
    PROFILE.bossKills = PROFILE.bossKills || {};
    const before = CONFIG.PROGRESSION.camos.filter(c => c.boss && camoUnlocked(c.id)).map(c => c.id);
    PROFILE.bossKills[kind] = (PROFILE.bossKills[kind] | 0) + 1;
    const now = CONFIG.PROGRESSION.camos.filter(c => c.boss && camoUnlocked(c.id) && before.indexOf(c.id) < 0);
    saveProfile();
    if (now.length) setTimeout(() => showBanner('UNLOCKED: ' + now.map(c => c.name + ' CAMO').join(', '), 3.5), 3200);
  }
  const out = [D[0]];
  if (Math.random() < (kind === 'bestia' ? T.bestiaRare : T.rareChance)) out.push(D[1]);
  out.forEach((id, i) => dropTrophy(id, x + (i ? 1.2 : 0), z + (i ? 0.6 : 0), level || 0));
  return out;
}
function dropTrophy(id, x, z, level) {
  const d = TROPH.drops.find(q => !q.id) || TROPH.drops[0];
  for (const k in d.models) d.models[k].visible = k === id;
  d.id = id; d.x = x; d.z = z; d.level = level; d.t = 0; d.life = CONFIG.TROPHIES.life;
  d.y = (level ? lvY(level) : groundY(x, z)) + 1.0;
  d.g.position.set(x, d.y, z); d.g.visible = true;
  return d;
}
function pickTrophy(d) {
  const T = CONFIG.TROPHIES, it = T.items[d.id];
  PROFILE.trophies = PROFILE.trophies || {};
  PROFILE.trophies[d.id] = (PROFILE.trophies[d.id] | 0) + 1;       // F5.28: al perfil (moneda de la tienda ITEMS)
  addInk(T.ink); addXP(T.xp); saveProfile();
  showBanner('+ ' + it.name + (it.rare ? ' (RARE)' : '') + '  ·  +' + T.ink + ' ' + CONFIG.GUMS.currency, 2.5);
  sfxShieldTake();
  d.id = null; d.g.visible = false;
}

//--- F5.28: la tienda ITEMS (menú) y el ítem equipado ---
function needText(r) { const H = PROFILE.trophies || {}; return Object.keys(r.need).map(k => r.need[k] + '× ' + CONFIG.TROPHIES.items[k].name + ((H[k] | 0) >= r.need[k] ? ' ✓' : '')).join(' + '); }
// (F5.28f: y desde su nivel de cuenta, r.level: antes ni se ve)
function canBuyItem(id) {
  const r = itemDef(id), H = PROFILE.trophies || {};
  if (!r || (!DEV.on && rankLevel() < (r.level || 1))) return false;
  for (const k in r.need) if ((H[k] | 0) < r.need[k]) return false;
  return true;
}
// trofeos -> 1 ítem en el perfil. true = lo compró
function buyItem(id) {
  if (!canBuyItem(id)) return false;
  const r = itemDef(id);
  for (const k in r.need) PROFILE.trophies[k] -= r.need[k];
  PROFILE.items = PROFILE.items || {};
  PROFILE.items[id] = (PROFILE.items[id] | 0) + 1;
  saveProfile();
  return true;
}
// equipar (uno por partida): el mismo otra vez = desequipar. Solo si tenés alguno
function equipItem(id) {
  if (id && !((PROFILE.items || {})[id] > 0)) return false;
  PROFILE.itemEquip = PROFILE.itemEquip === id ? null : (id || null);
  saveProfile();
  if (!MENU.started) placeItem();                                   // en el menú: lo acomoda en el mapa para la partida
  return true;
}
// dónde aparece: el primer spawn común del cuarto designado (siempre alcanzable; no una ventana ni un salto: ahí entran
// los zombies). Si el cuarto solo tiene ventanas, la primera
function itemSpot(id) {
  const room = CONFIG.TROPHIES.spots[id], all = SPAWN_POINTS.filter(s => s.room === room && !s.sea);
  const sp = all.find(s => !s.bar && !s.jump) || all[0];
  return sp ? { x: sp.x, z: sp.z } : null;
}
// pone el ítem equipado en su lugar (al empezar la partida). Sin ítem equipado o sin stock, nada
function placeItem() {
  const I = TROPH.item, id = PROFILE.itemEquip;
  if (!I) return;
  I.id = null; I.g.visible = false;
  if (!id || !((PROFILE.items || {})[id] > 0)) return;
  const sp = itemSpot(id);
  if (!sp) return;
  const look = CONFIG.TROPHIES.look[id];
  for (const k in I.models) I.models[k].visible = k === look;
  I.id = id; I.x = sp.x; I.z = sp.z; I.level = 0; I.t = 0;
  I.g.position.set(sp.x, groundY(sp.x, sp.z), sp.z); I.g.visible = true;
}
// lo agarrás: se gasta del perfil y hace su efecto
function pickItem() {
  const I = TROPH.item, id = I.id;
  PROFILE.items[id] = Math.max(0, (PROFILE.items[id] | 0) - 1);
  if (!PROFILE.items[id] && PROFILE.itemEquip === id) PROFILE.itemEquip = null;
  saveProfile();
  I.id = null; I.g.visible = false;
  applyItem(itemDef(id));
}
function applyItem(r) {
  const T = CONFIG.TROPHIES;
  if (r.id === 'claws') TROPH.claws = true;
  else if (r.id === 'slime') TROPH.slime += T.slimeBomb.count;
  else if (r.id === 'talisman') { TROPH.talisman = true; updatePerkHUD(); }
  else if (r.id === 'pet') spawnPet();
  else if (r.id === 'armor') TROPH.armor = T.armor.hp;
  else if (r.id === 'guitar') {                                                   // la serenata
    for (const w of state.weapons) { const d = slotDef(w); if (d) { w.mag = d.mag; w.reserve = d.reserveMax; } }
    state.health = maxHealth();
    state.points += T.serenade.points; STATS.pointsEarned += T.serenade.points; pendingPts += T.serenade.points;
  }
  showBanner(r.name + ' - ' + r.desc, 2.5);
  sfxPerkDrink();
}

//--- efectos ---
// las garras (el cuchillo/machete de meleeDef)
let CLAWS_DEF = null;
function clawsDef() {
  return CLAWS_DEF || (CLAWS_DEF = Object.assign({}, CONFIG.KNIFE, { name: 'BEAST CLAWS', damage: CONFIG.TROPHIES.claws.damage, headshotMul: 1 }));
}
function perkMax() { return CONFIG.PERKS.max + (TROPH.talisman ? 1 : 0); }
// bomba de slime: donde explota la granada queda un charco negro que quema a los zombies (a vos no)
function slimeZone(x, z, level) {
  const S = CONFIG.TROPHIES.slimeBomb, Z = TROPH.zones.find(q => q.life <= 0) || TROPH.zones[0];
  Z.life = S.life; Z.x = x; Z.z = z; Z.level = level || 0;
  Z.m.scale.setScalar(S.radius); Z.m.rotation.y = Math.random() * 6.28;
  Z.m.position.set(x, (level ? lvY(level) : groundY(x, z)) + 0.02, z); Z.m.visible = true;
}
function armorAbsorb(dmg) {
  if (!(TROPH.armor > 0)) return dmg;
  const a = Math.min(TROPH.armor, dmg * CONFIG.TROPHIES.armor.absorb);
  TROPH.armor -= a;
  if (TROPH.armor <= 0) { TROPH.armor = 0; showBanner('SHELL ARMOR BROKE', 1.8); }
  return dmg - a;
}
// la cría domesticada: una cría de la Bestia de tu lado (fuera de state.zombies: no recibe balas ni pega)
function spawnPet() {
  if (!TROPH.pet) {
    const q = createCria(90);
    q.root.traverse(o => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial) o.material = new THREE.MeshBasicMaterial({ color: 0x3aff6a }); });
    TROPH.pet = { z: q, target: null, biteT: 0 };
  }
  const P = TROPH.pet, q = P.z;
  TROPH.petRounds = CONFIG.TROPHIES.pet.rounds;
  q.px = player.pos.x + 1.5; q.pz = player.pos.z; q.level = playerLevel();
  q.root.visible = true; q.active = true;
  placeRoot(q, 0);
}
function updatePet(dt) {
  const P = TROPH.pet;
  if (!P || !P.z.root.visible) return;
  const C = CONFIG.TROPHIES.pet, q = P.z, pl = player.pos;
  if (!P.target || !P.target.alive || P.target.boss || Math.hypot(P.target.px - pl.x, P.target.pz - pl.z) > C.range * 1.5) {
    P.target = null; let bd = C.range;
    for (const z of state.zombies) {
      if (!z.alive || z.boss || z.state !== 'walk' || (z.level || 0) !== (q.level || 0)) continue;
      const d = Math.hypot(z.px - pl.x, z.pz - pl.z);
      if (d < bd) { bd = d; P.target = z; }
    }
  }
  const tx = P.target ? P.target.px : pl.x, tz = P.target ? P.target.pz : pl.z, dx = tx - q.px, dz = tz - q.pz, d = Math.hypot(dx, dz) || 1e-4;
  const stop = P.target ? C.reach : C.follow;
  let v = 0;
  if (d > stop) {
    const step = Math.min(d - stop, C.speed * dt);
    moveCircle(q, 'x', dx / d * step, 0.3); moveCircle(q, 'z', dz / d * step, 0.3);
    v = step / dt;
  }
  if (d > 25) { q.px = pl.x + 1; q.pz = pl.z; q.level = playerLevel(); }           // se quedó muy atrás: aparece a tu lado
  q.heading = Math.atan2(dx, dz); q.root.rotation.y = q.heading;
  if (P.target && d <= C.reach + 0.2 && (P.biteT -= dt) <= 0) {
    P.biteT = C.every; q.swingT = 0.35;
    const z = P.target;
    damageZombie(z, CONFIG.ZOMBIE.health(Math.max(1, state.round)) * C.dmgMul, false);
  }
  animateDog(q, dt, v);
  placeRoot(q, 0);
}

function updateTrophies(dt) {
  const T = CONFIG.TROPHIES, P = player.pos, pl = playerLevel(), t = clock.elapsedTime;
  for (const d of TROPH.drops) {
    if (!d.id) continue;
    d.t += dt; d.life -= dt;
    d.g.position.y = d.y + Math.sin(d.t * 2.2) * 0.12;
    d.g.children.forEach(c => { if (c !== d.halo) c.rotation.y = d.t * 1.5; });
    d.halo.quaternion.copy(camera.quaternion);
    if (d.life <= 0) { d.id = null; d.g.visible = false; continue; }
    if (pl === d.level && Math.hypot(P.x - d.x, P.z - d.z) < T.pick) pickTrophy(d);
  }
  // F5.28: el ítem equipado, girando en su lugar; se agarra pasando cerca
  const I = TROPH.item;
  if (I && I.id) {
    I.t += dt;
    I.top.rotation.y = I.t * 1.4; I.top.position.y = 1.3 + Math.sin(I.t * 2) * 0.1;
    I.halo.quaternion.copy(camera.quaternion);
    if (pl === I.level && Math.hypot(P.x - I.x, P.z - I.z) < T.pick) pickItem();
  }
  // charcos de las bombas de slime: queman a los zombies (no a vos)
  const S = T.slimeBomb, dps = S.dps + S.perRound * Math.max(1, state.round);
  for (const Z of TROPH.zones) {
    if (Z.life <= 0) continue;
    Z.life -= dt;
    Z.m.material.opacity = 0.9 * Math.min(1, Z.life / 0.6);
    if (Z.life <= 0) { Z.m.visible = false; continue; }
    const prev = STATS.src; STATS.src = 'slime';
    for (const q of state.zombies.slice()) {
      if (q.alive && !q.boss && (q.level || 0) === Z.level && Math.hypot(q.px - Z.x, q.pz - Z.z) < S.radius) damageZombie(q, dps * dt, false, undefined, 0);
    }
    STATS.src = prev;
  }
  updatePet(dt);
}
// al empezar cada ronda: la cría cuenta sus rondas
function trophiesRound() {
  if (TROPH.pet && TROPH.pet.z.root.visible && --TROPH.petRounds <= 0) { TROPH.pet.z.root.visible = false; TROPH.pet.z.active = false; showBanner('THE WHELP WANDERED OFF', 1.8); }
}
function resetTrophies() {
  TROPH.claws = false; TROPH.talisman = false; TROPH.slime = 0; TROPH.armor = 0; TROPH.petRounds = 0;
  placeItem();                                                      // F5.28: el ítem equipado, en su lugar
  for (const d of TROPH.drops) { d.id = null; d.g.visible = false; }
  for (const Z of TROPH.zones) { Z.life = 0; Z.m.visible = false; }
  if (TROPH.pet) { TROPH.pet.z.root.visible = false; TROPH.pet.z.active = false; TROPH.pet.target = null; }
}
// PROFILE: las placas de cada boss (bronce 1, plata 5, oro 25 kills)
function bossPlatesHTML() {
  const pl = CONFIG.TROPHIES.plates, cols = ['#b87333', '#c0c0c8', '#e8c030'];
  let h = '<div class="plates"><b style="letter-spacing:3px">BOSS PLATES</b>';
  for (const k of ['sombrero', 'calamar', 'plant', 'bestia']) {
    const n = bossKillCount(k);
    h += '<div class="plate"><span>' + BOSS_LABEL[k] + '</span><span>' + pl.map((v, i) =>
      '<i title="' + v + ' kills" style="display:inline-block;width:14px;height:14px;margin-left:4px;background:' + (n >= v ? cols[i] : '#2a2a2a') + '"></i>').join('') +
      ' <small>' + n + '</small></span></div>';
  }
  return h + '</div>';
}
