//=== 7j. PROGRESO (V2 F5.18) ================================================
// XP entre partidas, niveles con rango (tier), accesorios y camuflajes para las armas (CONFIG.PROGRESSION).
// PROFILE se guarda en localStorage (CONFIG.PROGRESSION.key); si no hay (modo privado, tests) arranca de cero.
// La carga: PROFILE.loadout[idArma] = { att: ['reflex', ...], camo: 'jungle' | null }. slotDef (weapons.js) aplica
// los accesorios con attDef: un def cacheado por arma y combinación, CONFIG.WEAPONS no se toca
// F5.19: wxp = XP por arma. F5.27: xp2 (fichas de XP doble), passClaimed (hasta dónde se cobró el pase), xp2On/xp2Used (partida)
const PROFILE = { name: 'SURVIVOR', xp: 0, loadout: {}, ink: 0, gums: {}, preset: [], wxp: {}, matchXP: 0, startLevel: 1,
                  xp2: 0, passClaimed: 0, xp2On: false, xp2Used: false };
const ATT_DEFS = {};
// F5.18b: cuentas locales. ACCOUNTS.list[nombre] = { xp, loadout, ink, gums, preset }; PROFILE es la activa.
// DEV (solo con CONFIG.DEBUG_MODE): cuenta al máximo y todos los chicles, solo en memoria (no se guarda: al recargar vuelve)
const ACCOUNTS = { current: 'SURVIVOR', list: {} };
const DEV = { on: false, hp: false, lastHit: 0, lastHitT: 0 };   // F5.19c: hp = vida ×4 con barra (tecla X)
function blankAccount() { return { xp: 0, loadout: {}, ink: 0, gums: {}, preset: CONFIG.GUMS.defaultPreset.slice(), wxp: {}, bossKills: {} }; }
function loadProfile() {
  try {
    const raw = localStorage.getItem(CONFIG.PROGRESSION.accountsKey);
    if (raw) { const a = JSON.parse(raw); ACCOUNTS.list = a.list || {}; ACCOUNTS.current = a.current || Object.keys(ACCOUNTS.list)[0] || 'SURVIVOR'; }
    else {                                                      // F5.18: la cuenta única de antes pasa a ser una cuenta
      const old = localStorage.getItem(CONFIG.PROGRESSION.key);
      if (old) { const p = JSON.parse(old), n = String(p.name || 'SURVIVOR').slice(0, 16); ACCOUNTS.list[n] = Object.assign(blankAccount(), { xp: +p.xp || 0, loadout: p.loadout || {} }); ACCOUNTS.current = n; }
    }
  } catch (e) {}
  if (!ACCOUNTS.list[ACCOUNTS.current]) ACCOUNTS.list[ACCOUNTS.current] = blankAccount();
  useAccount(ACCOUNTS.current);
}
function useAccount(name) {
  const a = Object.assign(blankAccount(), ACCOUNTS.list[name] || {});
  ACCOUNTS.list[name] = a; ACCOUNTS.current = name;
  PROFILE.name = name; PROFILE.xp = Math.max(0, +a.xp || 0); PROFILE.loadout = a.loadout || {}; PROFILE.ink = Math.max(0, a.ink | 0);
  PROFILE.gums = a.gums || {}; PROFILE.preset = Array.isArray(a.preset) ? a.preset.slice(0, CONFIG.GUMS.presetSize) : [];
  PROFILE.wxp = a.wxp || {};                                    // F5.19
  PROFILE.bossKills = a.bossKills || {};                        // F5.26: kills de cada boss (camos y placas)
  // F5.27: el pase. passClaimed = hasta qué nivel ya se cobró; una cuenta de antes cobra desde el 40 (lo de antes del 40, la
  // tinta cada 6 niveles, ya se lo dio el sistema viejo). xp2 = fichas de XP doble sin usar
  PROFILE.xp2 = Math.max(0, a.xp2 | 0);
  PROFILE.passClaimed = a.passClaimed !== undefined ? a.passClaimed | 0 : Math.min(levelOf(PROFILE.xp), CONFIG.PROGRESSION.pass.inkFrom - 1);
  PROFILE.xp2On = false; PROFILE.xp2Used = false;
  claimPass();                                                  // lo que falte (una cuenta de nivel 43: la tinta del 40 al 43)
  // F5.28: trofeos de boss (moneda de la tienda ITEMS), ítems comprados y el equipado
  PROFILE.trophies = a.trophies || {}; PROFILE.items = a.items || {}; PROFILE.itemEquip = a.itemEquip || null;
  PROFILE.krakenSlayer = !!a.krakenSlayer;                      // F5.29: mató al Kraken (el camo KRAKEN)
  // F5.20: 3 sets de chicles (una cuenta de antes arranca con su set en el primero)
  PROFILE.presetIdx = Math.max(0, Math.min(CONFIG.GUMS.presetSets - 1, a.presetIdx | 0));
  PROFILE.presets = Array.isArray(a.presets) ? a.presets.map(p => Array.isArray(p) ? p.slice(0, CONFIG.GUMS.presetSize) : []) : [PROFILE.preset];
  while (PROFILE.presets.length < CONFIG.GUMS.presetSets) PROFILE.presets.push([]);
  PROFILE.preset = PROFILE.presets[PROFILE.presetIdx];
  sanitizeLoadout(); sanitizePreset();
  PROFILE.presets[PROFILE.presetIdx] = PROFILE.preset;
  // F5.19c: accesorios que ya viste (aviso en WEAPONS). Una cuenta de antes arranca con todo lo que ya tenía, visto
  if (a.seen) PROFILE.seen = a.seen;
  else { PROFILE.seen = {}; for (const w in CONFIG.WEAPONS) if (canAttach(w)) PROFILE.seen[w] = attsFor(w).filter(k => attUnlocked(k, w)); }
}
// F5.19c: accesorios desbloqueados que todavía no miraste (el aviso rojo del menú WEAPONS)
function unseenAtts(w) { const s = (PROFILE.seen && PROFILE.seen[w]) || []; return attsFor(w).filter(k => attUnlocked(k, w) && s.indexOf(k) < 0); }
// (F5.28f: solo las armas que ya se ven en el menú: weaponSeen)
function unseenTotal() { let n = 0; for (const w in CONFIG.WEAPONS) if (canAttach(w) && weaponSeen(w)) n += unseenAtts(w).length; return n; }
function markAttsSeen(w) {
  if (!unseenAtts(w).length) return;
  PROFILE.seen = PROFILE.seen || {};
  PROFILE.seen[w] = attsFor(w).filter(k => attUnlocked(k, w));
  saveProfile();
}
function saveProfile() {
  if (DEV.on) return;                                           // la cuenta de desarrollador no se guarda
  ACCOUNTS.list[PROFILE.name] = { xp: PROFILE.xp, loadout: PROFILE.loadout, ink: PROFILE.ink, gums: PROFILE.gums, preset: PROFILE.preset, wxp: PROFILE.wxp,
                                  seen: PROFILE.seen || {},     // F5.19c
                                  bossKills: PROFILE.bossKills || {},   // F5.26
                                  xp2: PROFILE.xp2 | 0, passClaimed: PROFILE.passClaimed | 0,   // F5.27
                                  trophies: PROFILE.trophies || {}, items: PROFILE.items || {}, itemEquip: PROFILE.itemEquip || null,   // F5.28
                                  krakenSlayer: !!PROFILE.krakenSlayer,   // F5.29
                                  presets: (PROFILE.presets || []).map((p, i) => i === PROFILE.presetIdx ? PROFILE.preset : p), presetIdx: PROFILE.presetIdx | 0 };   // F5.20
  try { localStorage.setItem(CONFIG.PROGRESSION.accountsKey, JSON.stringify({ current: ACCOUNTS.current, list: ACCOUNTS.list })); } catch (e) {}
}
function accountNames() { return Object.keys(ACCOUNTS.list); }
function switchAccount(name) { if (!ACCOUNTS.list[name]) return false; saveProfile(); useAccount(name); saveProfile(); return true; }
function createAccount(name) {
  name = String(name || '').trim().toUpperCase().slice(0, 16);
  if (!name || ACCOUNTS.list[name]) return false;
  saveProfile(); ACCOUNTS.list[name] = blankAccount(); useAccount(name); saveProfile(); return true;
}
function renameAccount(name) {
  name = String(name || '').trim().toUpperCase().slice(0, 16);
  if (!name || (ACCOUNTS.list[name] && name !== PROFILE.name)) return false;
  const a = ACCOUNTS.list[PROFILE.name]; delete ACCOUNTS.list[PROFILE.name];
  ACCOUNTS.list[name] = a; ACCOUNTS.current = name; PROFILE.name = name; saveProfile(); return true;
}
function deleteAccount(name) {
  if (!ACCOUNTS.list[name] || accountNames().length < 2) return false;
  delete ACCOUNTS.list[name];
  if (ACCOUNTS.current === name) useAccount(accountNames()[0]);
  saveProfile(); return true;
}
// F5.18b: modo desarrollador: nivel máximo y todos los chicles, sin guardar (solo con CONFIG.DEBUG_MODE)
function devMaxAccount() {
  if (!CONFIG.DEBUG_MODE) return false;
  saveProfile(); DEV.on = true;
  for (const k in ATT_DEFS) delete ATT_DEFS[k];
  if (typeof showBanner === 'function') showBanner('DEV ACCOUNT: MAX LEVEL + ALL GUMS (this session only)', 3);
  return true;
}
// XP total para llegar al nivel L (nivel 1 = 0)
function xpForLevel(L) { const P = CONFIG.PROGRESSION; let t = 0; for (let n = 1; n < L; n++) t += Math.min(P.xpCap || Infinity, P.base + P.step * (n - 1)); return t; }
function levelOf(xp) { const P = CONFIG.PROGRESSION; let L = 1; while (L < P.maxLevel && xp >= xpForLevel(L + 1)) L++; return L; }
function rankLevel() { return DEV.on ? CONFIG.PROGRESSION.maxLevel : levelOf(PROFILE.xp); }
function tierName(L) { let n = ''; for (const [lv, name] of CONFIG.PROGRESSION.tiers) if (L >= lv) n = name; return n; }
// progreso dentro del nivel: [xp en el nivel, xp que pide el nivel] (en el máximo, [0, 0])
function levelProgress(xp) {
  const L = levelOf(xp), P = CONFIG.PROGRESSION;
  if (L >= P.maxLevel) return [0, 0];
  const a = xpForLevel(L), b = xpForLevel(L + 1);
  return [xp - a, b - a];
}
// F5.19: nivel de cada arma (PROFILE.wxp[id] = XP de esa arma). Los accesorios se desbloquean con el nivel del arma
function wxpForLevel(L) { const W = CONFIG.PROGRESSION.weaponLevel; let t = 0; for (let n = 1; n < L; n++) t += W.base + W.step * (n - 1); return t; }
function weaponLevel(id) {
  const W = CONFIG.PROGRESSION.weaponLevel;
  if (DEV.on) return W.max;
  const xp = (PROFILE.wxp && PROFILE.wxp[id]) || 0;
  let L = 1; while (L < W.max && xp >= wxpForLevel(L + 1)) L++;
  return L;
}
function weaponProgress(id) {
  const L = weaponLevel(id), W = CONFIG.PROGRESSION.weaponLevel, xp = (PROFILE.wxp && PROFILE.wxp[id]) || 0;
  if (L >= W.max) return [0, 0];
  const a = wxpForLevel(L), b = wxpForLevel(L + 1);
  return [xp - a, b - a];
}
function attUnlocked(key, id) { const A = CONFIG.PROGRESSION.attachments[key]; return !!A && !!id && weaponLevel(id) >= A.level; }
// la XP de un kill también va al arma con que lo mataste (si lleva accesorios); avisa si sube y qué desbloqueó
function addWeaponXP(id, n) {
  if (!(n > 0) || !canAttach(id) || DEV.on) return;
  PROFILE.wxp = PROFILE.wxp || {};
  const before = weaponLevel(id);
  PROFILE.wxp[id] = (PROFILE.wxp[id] || 0) + n;
  const after = weaponLevel(id);
  if (after > before) {
    const P = CONFIG.PROGRESSION, un = attsFor(id).filter(k => P.attachments[k].level > before && P.attachments[k].level <= after).map(k => attName(id, k));
    showBanner(CONFIG.WEAPONS[id].name + ' LEVEL ' + after + (un.length ? '  —  UNLOCKED: ' + un.join(', ') : ''), 3);
    saveProfile();
  }
}
function camoUnlocked(id) {
  const C = CONFIG.PROGRESSION.camos.find(c => c.id === id);
  if (!C) return false;
  if (C.boss) return DEV.on || bossKillCount(C.boss) >= C.kills;   // F5.26: camos de boss (kills en la cuenta)
  if (C.ee) return DEV.on || !!PROFILE.krakenSlayer;                // F5.29: el del easter egg
  return rankLevel() >= C.level;
}
// F5.26: cuántas veces mató la cuenta a ese boss ('any' = a cualquiera)
function bossKillCount(k) {
  const K = PROFILE.bossKills || {};
  if (k !== 'any') return K[k] | 0;
  let n = 0; for (const b in K) n += K[b] | 0; return n;
}
function canAttach(id) { return !!CONFIG.WEAPONS[id] && CONFIG.PROGRESSION.noAtt.indexOf(id) < 0; }
// F5.18b: los accesorios que tiene sentido poner en esa arma, y cómo se llaman en ella
const STD_ATT = ['quickdraw', 'fastmag', 'reflex', 'laser', 'barrel', 'stock'];
function attsFor(id) { return CONFIG.PROGRESSION.weaponAtt[id] || STD_ATT; }
function attName(id, key) { const a = CONFIG.PROGRESSION.attAlias[id]; return (a && a[key]) || CONFIG.PROGRESSION.attachments[key].name; }
function loadoutOf(id) { return PROFILE.loadout[id] || (PROFILE.loadout[id] = { att: [], camo: null }); }
// saca lo que no está desbloqueado o no existe, y respeta el tope de accesorios
function sanitizeLoadout() {
  const P = CONFIG.PROGRESSION;
  for (const id in PROFILE.loadout) {
    const L = PROFILE.loadout[id];
    if (!canAttach(id) || !L) { delete PROFILE.loadout[id]; continue; }
    // (primero que exista en esa arma: una cuenta vieja puede tener uno que se sacó, como la linterna de F5.28f)
    L.att = (Array.isArray(L.att) ? L.att : []).filter((k, i, a) => a.indexOf(k) === i && attsFor(id).indexOf(k) >= 0 && P.attachments[k] && attUnlocked(k, id)).slice(0, P.maxAtt);
    if (L.camo && !camoUnlocked(L.camo)) L.camo = null;
  }
  for (const k in ATT_DEFS) delete ATT_DEFS[k];
}
// prende/apaga un accesorio en un arma (menú). Devuelve si quedó puesto
function toggleAttachment(id, key) {
  if (!canAttach(id) || !attUnlocked(key, id) || attsFor(id).indexOf(key) < 0) return false;
  const L = loadoutOf(id), i = L.att.indexOf(key);
  if (i >= 0) L.att.splice(i, 1);
  else if (L.att.length < CONFIG.PROGRESSION.maxAtt) L.att.push(key);
  sanitizeLoadout(); saveProfile();
  return L.att.indexOf(key) >= 0;
}
function setCamo(id, camo) {
  if (!canAttach(id) || (camo && !camoUnlocked(camo))) return false;
  loadoutOf(id).camo = camo || null; sanitizeLoadout(); saveProfile();
  return true;
}
// el def con los accesorios del arma (o el mismo def si no tiene)
function attDef(b, id) {
  const L = PROFILE.loadout[id];
  if (!b || !L || (!L.att.length && !L.camo) || !canAttach(id)) return b;
  const key = id + (b.pap ? '*' : '') + ':' + L.att.slice().sort().join(',') + ':' + (L.camo || '');
  if (ATT_DEFS[key]) return ATT_DEFS[key];
  const A = CONFIG.PROGRESSION.attachments, d = Object.assign({}, b), att = {};
  for (const k of L.att) att[k] = true;
  if (att.barrel) { if (d.damage !== undefined) d.damage *= A.barrel.damage; if (d.dps !== undefined) d.dps *= A.barrel.damage; d.spread *= A.barrel.spread; }
  if (att.fastmag) d.reloadTime *= A.fastmag.reload;
  if (att.stock) d.recoil *= A.stock.recoil;
  if (att.reflex && !b.adsFov) d.adsFov = CONFIG.ADS.fov - A.reflex.zoom;
  if (att.limbs && d.chargeTime) d.chargeTime *= A.limbs.charge;                          // F5.18b: arco
  if (att.broadhead) d.damage *= A.broadhead.damage;
  if (att.stabilizer) d.spread *= A.stabilizer.spread;
  d.att = att;
  const C = L.camo && CONFIG.PROGRESSION.camos.find(c => c.id === L.camo);
  d.camo = C ? C.color : null;
  return (ATT_DEFS[key] = d);
}
function curAtt(k) { const d = curDef(); return !!(d && d.att && d.att[k]); }

// F5.27: lo que da el pase en el nivel L: [{ type: 'ink', n } | { type: 'camo', id, name, color } | { type: 'xp2' }]
function passRewards(L) {
  const P = CONFIG.PROGRESSION, S = P.pass, out = [];
  for (const c of P.camos) if (c.level === L) out.push({ type: 'camo', id: c.id, name: c.name, color: c.color });
  const ink = L === P.maxLevel ? S.ink100 : L % P.levelUp.inkEvery === 0 ? P.levelUp.ink : 0;   // F5.28d: 1 cada 3
  if (ink) out.push({ type: 'ink', n: ink });
  if (S.xp2Levels.indexOf(L) >= 0) out.push({ type: 'xp2' });
  return out;
}
function passText(r) { return r.type === 'ink' ? '+' + r.n + ' ' + CONFIG.GUMS.currency : r.type === 'xp2' ? 'DOUBLE XP (1 match)' : r.name + ' CAMO'; }
// cobra lo que falta del pase hasta tu nivel (tinta y fichas; los camos se desbloquean solos por nivel). Devuelve los premios
function claimPass() {
  if (DEV.on) return [];
  const L = levelOf(PROFILE.xp), got = [];
  while ((PROFILE.passClaimed | 0) < L) {
    const lv = ++PROFILE.passClaimed;
    for (const r of passRewards(lv)) {
      if (r.type === 'ink') PROFILE.ink += r.n;
      else if (r.type === 'xp2') PROFILE.xp2 = (PROFILE.xp2 | 0) + 1;
      got.push(r);
    }
  }
  return got;
}
// suma XP de la partida; avisa si subís de nivel (y qué te dio el pase)
function addXP(n) {
  if (!(n > 0)) return;
  if (DEV.on) { PROFILE.matchXP += n; return; }                 // la cuenta dev no suma XP real
  // F5.27: la ficha de XP doble se gasta sola con la primera XP de la partida y dura toda la partida
  if (!PROFILE.xp2Used) {
    PROFILE.xp2Used = true;
    if ((PROFILE.xp2 | 0) > 0) { PROFILE.xp2--; PROFILE.xp2On = true; saveProfile(); if (typeof showBanner === 'function') showBanner('DOUBLE XP ACTIVE (this match)', 2.5); }
  }
  if (PROFILE.xp2On) n *= 2;
  const before = rankLevel();
  PROFILE.xp += n; PROFILE.matchXP += n;
  const after = rankLevel();
  if (after > before) {
    // F5.27: el pase (tinta, camos y fichas de XP doble); los chicles CLASSIC se desbloquean por nivel aparte. Los
    // accesorios van por arma (addWeaponXP)
    const un = claimPass().map(passText);
    for (const id in CONFIG.GUMS.list) { const g = CONFIG.GUMS.list[id]; if (g.rarity === 'classic' && g.level > before && g.level <= after) un.push(g.name + ' GUM'); }
    showBanner('LEVEL ' + after + ' · ' + tierName(after) + (un.length ? '  —  ' + un.join(', ') : ''), 3.5);
    if (!playSample('musica_al_level_up') && !playSample('level_up') && typeof sfxRoundDrum === 'function') sfxRoundDrum(5);   // F5.19 (F5.19c: la música nueva)
    saveProfile();
  }
}
function resetMatchXP() { PROFILE.matchXP = 0; PROFILE.startLevel = rankLevel(); PROFILE.xp2On = false; PROFILE.xp2Used = false; }

//--- F5.18b: chicles: inventario, preset y tienda (CONFIG.GUMS). Lo del juego (chiclera, efectos) va en gums.js ---
function gumDef(id) { return CONFIG.GUMS.list[id]; }
function gumClassic(id) { const g = gumDef(id); return !!g && g.rarity === 'classic'; }
// cuántos tenés: ∞ (Infinity) si es clásico desbloqueado (o en modo dev), si no el inventario
function gumCount(id) {
  const g = gumDef(id);
  if (!g) return 0;
  if (DEV.on) return Infinity;
  if (g.rarity === 'classic') return rankLevel() >= g.level ? Infinity : 0;
  return PROFILE.gums[id] | 0;
}
function sanitizePreset() {
  const n = CONFIG.GUMS.presetSize;
  PROFILE.preset = (PROFILE.preset || []).filter((id, i, a) => gumDef(id) && a.indexOf(id) === i).slice(0, n);
  if (!PROFILE.preset.length) PROFILE.preset = CONFIG.GUMS.defaultPreset.slice(0, n);   // F5.19: vacío = los 5 clásicos
}
// F5.19: para jugar, el preset tenía que tener los `presetSize` lugares con chicles que tengas.
// F5.20 (Diego): ya no bloquea: los que no tenés quedan en el set (en gris) y la chiclera los puede ofrecer, pero no se agarran
function presetReady() { return true; }
// F5.20: 3 sets guardados por cuenta (PROFILE.presets); PROFILE.preset es el que está elegido (el mismo arreglo)
function selectPreset(i) {
  const n = CONFIG.GUMS.presetSets;
  if (i < 0 || i >= n) return false;
  PROFILE.presets[PROFILE.presetIdx] = PROFILE.preset;
  PROFILE.presetIdx = i;
  PROFILE.preset = PROFILE.presets[i] || [];
  sanitizePreset(); PROFILE.presets[i] = PROFILE.preset;
  saveProfile(); return true;
}
// pone el chicle en el lugar i del preset (si ya estaba en otro lugar, se mueve). null = vaciar
function setPresetSlot(i, id) {
  const P = PROFILE.preset, n = CONFIG.GUMS.presetSize;
  if (i < 0 || i >= n) return false;
  if (id && (!gumDef(id) || gumCount(id) <= 0)) return false;
  const j = id ? P.indexOf(id) : -1;
  if (j >= 0) P[j] = null;
  while (P.length < n) P.push(null);
  P[i] = id || null;
  PROFILE.preset = P;
  saveProfile(); return true;
}
// F5.20: todos los del set, los tengas o no (la chiclera puede sacar uno que no tenés: se ve pero no se agarra)
function presetGums() { return (PROFILE.preset || []).filter(id => id && gumDef(id)); }
// gasta uno (los clásicos no se gastan)
function useGumItem(id) {
  if (gumClassic(id) || DEV.on) return true;
  if ((PROFILE.gums[id] | 0) <= 0) return false;
  PROFILE.gums[id]--; saveProfile(); return true;
}
function addInk(n) { if (DEV.on) return; PROFILE.ink += n; saveProfile(); }
// sorteo de la tienda: tiers 1..3 (monedas). Devuelve la lista de ids ganados (ya sumados al inventario)
// F5.19: free = regalo por subir de nivel (no cobra)
function rollGumPack(tier, rnd, free) {
  const S = CONFIG.GUMS.shop[tier];
  if (!S) return null;
  if (!DEV.on && !free) { if (PROFILE.ink < tier) return null; PROFILE.ink -= tier; }
  rnd = rnd || Math.random;
  const out = [];
  for (let i = 0; i < S.count; i++) {
    let r = rnd(), rar = 'rare';
    for (const k of ['epic', 'ultra', 'rare']) { if (r < S.odds[k]) { rar = k; break; } r -= S.odds[k]; }
    const pool = Object.keys(CONFIG.GUMS.list).filter(id => gumDef(id).rarity === rar);
    const id = pool[Math.floor(rnd() * pool.length) % pool.length];
    out.push(id);
    if (!DEV.on) PROFILE.gums[id] = (PROFILE.gums[id] | 0) + 1;
  }
  saveProfile();
  return out;
}
