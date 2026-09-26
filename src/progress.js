//=== 7j. PROGRESO (V2 F5.18) ================================================
// XP entre partidas, niveles con rango (tier), accesorios y camuflajes para las armas (CONFIG.PROGRESSION).
// PROFILE se guarda en localStorage (CONFIG.PROGRESSION.key); si no hay (modo privado, tests) arranca de cero.
// La carga: PROFILE.loadout[idArma] = { att: ['reflex', ...], camo: 'jungle' | null }. slotDef (weapons.js) aplica
// los accesorios con attDef: un def cacheado por arma y combinación, CONFIG.WEAPONS no se toca
const PROFILE = { name: 'SURVIVOR', xp: 0, loadout: {}, ink: 0, gums: {}, preset: [], matchXP: 0, startLevel: 1 };
const ATT_DEFS = {};
// F5.18b: cuentas locales. ACCOUNTS.list[nombre] = { xp, loadout, ink, gums, preset }; PROFILE es la activa.
// DEV (solo con CONFIG.DEBUG_MODE): cuenta al máximo y todos los chicles, solo en memoria (no se guarda: al recargar vuelve)
const ACCOUNTS = { current: 'SURVIVOR', list: {} };
const DEV = { on: false };
function blankAccount() { return { xp: 0, loadout: {}, ink: 0, gums: {}, preset: [] }; }
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
  sanitizeLoadout(); sanitizePreset();
}
function saveProfile() {
  if (DEV.on) return;                                           // la cuenta de desarrollador no se guarda
  ACCOUNTS.list[PROFILE.name] = { xp: PROFILE.xp, loadout: PROFILE.loadout, ink: PROFILE.ink, gums: PROFILE.gums, preset: PROFILE.preset };
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
function xpForLevel(L) { const P = CONFIG.PROGRESSION; let t = 0; for (let n = 1; n < L; n++) t += P.base + P.step * (n - 1); return t; }
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
function attUnlocked(key) { const A = CONFIG.PROGRESSION.attachments[key]; return !!A && rankLevel() >= A.level; }
function camoUnlocked(id) { const C = CONFIG.PROGRESSION.camos.find(c => c.id === id); return !!C && rankLevel() >= C.level; }
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
    L.att = (Array.isArray(L.att) ? L.att : []).filter((k, i, a) => a.indexOf(k) === i && attUnlocked(k) && attsFor(id).indexOf(k) >= 0).slice(0, P.maxAtt);
    if (L.camo && !camoUnlocked(L.camo)) L.camo = null;
  }
  for (const k in ATT_DEFS) delete ATT_DEFS[k];
}
// prende/apaga un accesorio en un arma (menú). Devuelve si quedó puesto
function toggleAttachment(id, key) {
  if (!canAttach(id) || !attUnlocked(key) || attsFor(id).indexOf(key) < 0) return false;
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

// suma XP de la partida; avisa si subís de nivel (y qué se desbloqueó)
function addXP(n) {
  if (!(n > 0)) return;
  if (DEV.on) { PROFILE.matchXP += n; return; }                 // la cuenta dev no suma XP real
  const before = rankLevel();
  PROFILE.xp += n; PROFILE.matchXP += n;
  const after = rankLevel();
  if (after > before) {
    const P = CONFIG.PROGRESSION, un = [];
    for (const k in P.attachments) if (P.attachments[k].level > before && P.attachments[k].level <= after) un.push(P.attachments[k].name);   // (incluye los del arco)
    for (const c of P.camos) if (c.level > before && c.level <= after) un.push(c.name + ' CAMO');
    showBanner('LEVEL ' + after + ' · ' + tierName(after) + (un.length ? '  —  UNLOCKED: ' + un.join(', ') : ''), 3.5);
    if (typeof sfxRoundDrum === 'function') sfxRoundDrum(5);
    saveProfile();
  }
}
function resetMatchXP() { PROFILE.matchXP = 0; PROFILE.startLevel = rankLevel(); }

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
function presetGums() { return (PROFILE.preset || []).filter(id => id && gumCount(id) > 0); }
// gasta uno (los clásicos no se gastan)
function useGumItem(id) {
  if (gumClassic(id) || DEV.on) return true;
  if ((PROFILE.gums[id] | 0) <= 0) return false;
  PROFILE.gums[id]--; saveProfile(); return true;
}
function addInk(n) { if (DEV.on) return; PROFILE.ink += n; saveProfile(); }
// sorteo de la tienda: tiers 1..3 (monedas). Devuelve la lista de ids ganados (ya sumados al inventario)
function rollGumPack(tier, rnd) {
  const S = CONFIG.GUMS.shop[tier];
  if (!S) return null;
  if (!DEV.on) { if (PROFILE.ink < tier) return null; PROFILE.ink -= tier; }
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
