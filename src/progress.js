//=== 7j. PROGRESO (V2 F5.18) ================================================
// XP entre partidas, niveles con rango (tier), accesorios y camuflajes para las armas (CONFIG.PROGRESSION).
// PROFILE se guarda en localStorage (CONFIG.PROGRESSION.key); si no hay (modo privado, tests) arranca de cero.
// La carga: PROFILE.loadout[idArma] = { att: ['reflex', ...], camo: 'jungle' | null }. slotDef (weapons.js) aplica
// los accesorios con attDef: un def cacheado por arma y combinación, CONFIG.WEAPONS no se toca
const PROFILE = { name: 'SURVIVOR', xp: 0, loadout: {}, matchXP: 0, startLevel: 1 };
const ATT_DEFS = {};

function loadProfile() {
  try {
    const raw = localStorage.getItem(CONFIG.PROGRESSION.key);
    if (raw) { const p = JSON.parse(raw); PROFILE.name = String(p.name || 'SURVIVOR').slice(0, 16); PROFILE.xp = Math.max(0, +p.xp || 0); PROFILE.loadout = p.loadout || {}; }
  } catch (e) {}
  sanitizeLoadout();
}
function saveProfile() {
  try { localStorage.setItem(CONFIG.PROGRESSION.key, JSON.stringify({ name: PROFILE.name, xp: PROFILE.xp, loadout: PROFILE.loadout })); } catch (e) {}
}
// XP total para llegar al nivel L (nivel 1 = 0)
function xpForLevel(L) { const P = CONFIG.PROGRESSION; let t = 0; for (let n = 1; n < L; n++) t += P.base + P.step * (n - 1); return t; }
function levelOf(xp) { const P = CONFIG.PROGRESSION; let L = 1; while (L < P.maxLevel && xp >= xpForLevel(L + 1)) L++; return L; }
function rankLevel() { return levelOf(PROFILE.xp); }
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
function loadoutOf(id) { return PROFILE.loadout[id] || (PROFILE.loadout[id] = { att: [], camo: null }); }
// saca lo que no está desbloqueado o no existe, y respeta el tope de accesorios
function sanitizeLoadout() {
  const P = CONFIG.PROGRESSION;
  for (const id in PROFILE.loadout) {
    const L = PROFILE.loadout[id];
    if (!canAttach(id) || !L) { delete PROFILE.loadout[id]; continue; }
    L.att = (Array.isArray(L.att) ? L.att : []).filter((k, i, a) => a.indexOf(k) === i && attUnlocked(k)).slice(0, P.maxAtt);
    if (L.camo && !camoUnlocked(L.camo)) L.camo = null;
  }
  for (const k in ATT_DEFS) delete ATT_DEFS[k];
}
// prende/apaga un accesorio en un arma (menú). Devuelve si quedó puesto
function toggleAttachment(id, key) {
  if (!canAttach(id) || !attUnlocked(key)) return false;
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
  d.att = att;
  const C = L.camo && CONFIG.PROGRESSION.camos.find(c => c.id === L.camo);
  d.camo = C ? C.color : null;
  return (ATT_DEFS[key] = d);
}
function curAtt(k) { const d = curDef(); return !!(d && d.att && d.att[k]); }

// suma XP de la partida; avisa si subís de nivel (y qué se desbloqueó)
function addXP(n) {
  if (!(n > 0)) return;
  const before = rankLevel();
  PROFILE.xp += n; PROFILE.matchXP += n;
  const after = rankLevel();
  if (after > before) {
    const P = CONFIG.PROGRESSION, un = [];
    for (const k in P.attachments) if (P.attachments[k].level > before && P.attachments[k].level <= after) un.push(P.attachments[k].name);
    for (const c of P.camos) if (c.level > before && c.level <= after) un.push(c.name + ' CAMO');
    showBanner('LEVEL ' + after + ' · ' + tierName(after) + (un.length ? '  —  UNLOCKED: ' + un.join(', ') : ''), 3.5);
    if (typeof sfxRoundDrum === 'function') sfxRoundDrum(5);
    saveProfile();
  }
}
function resetMatchXP() { PROFILE.matchXP = 0; PROFILE.startLevel = rankLevel(); }
