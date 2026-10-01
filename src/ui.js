//=== 8. UI ===============================================================
const UI = {};
function initUI() {
  UI.debug = document.getElementById('debug');
  UI.cross = document.getElementById('cross');
  UI.hitmark = document.getElementById('hitmark');
  UI.wname = document.getElementById('wname');
  UI.wammo = document.getElementById('wammo');
  UI.gren = document.getElementById('gren');        // F2.7
  UI.perks = document.getElementById('perks');      // F2
  UI.debugMode = document.getElementById('debugmode');   // cartel del modo debug
  UI.boss = document.getElementById('bossbar');          // F5: barra del boss
  UI.bossName = document.getElementById('bossname');
  UI.bossFill = document.getElementById('bossfill');
  UI.bossHat = document.getElementById('bosshat');
  UI.shield = document.getElementById('shieldhud'); // F3a
  UI.quest = document.getElementById('questhud');   // F5.5
  UI.craft = document.getElementById('craft');
  UI.craftBar = document.getElementById('craftbar');
  UI.stam = document.getElementById('stam');
  UI.stamBar = document.getElementById('stambar');
  UI.cook = document.getElementById('cook');
  UI.cookBar = document.getElementById('cookbar');
  UI.reload = document.getElementById('reloadmsg');
  UI.start = document.getElementById('start');
  UI.dmg = document.getElementById('dmg');
  UI.points = document.getElementById('points');
  UI.round = document.getElementById('round');
  UI.banner = document.getElementById('banner');
  UI.lowhp = document.getElementById('lowhp');
  buildHurtHUD(UI.lowhp);                            // F5.28e: sangre cuadriculada por esquinas (antes bloodEdge, redonda)
  UI.dmgNums = document.getElementById('dmgNums');  // F5.11: ajuste "números de daño"
  UI.ink = document.getElementById('ink');          // F5.9: tinta de calamar
  UI.fade = document.getElementById('fade');
  UI.gumhud = document.getElementById('gumhud');    // F5.18b: chicles activos        // F5.11: fundido de la escotilla
  UI.go = document.getElementById('gameover');
  UI.goRound = document.getElementById('goRound');
  UI.goKills = document.getElementById('goKills');
  UI.goAcc = document.getElementById('goAcc');
  ['goTime', 'goHeads', 'goKnife', 'goFav', 'goPts', 'goDmg', 'goDoors', 'goBox', 'btnGoMenu', 'btnPlay', 'btnControls',
   'btnSettings', 'btnQuit', 'panelControls', 'panelSettings', 'sens', 'sensVal', 'vol', 'volVal', 'menuMsg',
   'btnMaps', 'btnWeapons', 'btnProfile', 'panelMaps', 'panelWeapons', 'panelProfile', 'mProfMini', 'btnShop', 'panelShop', 'scope', 'adsdot', 'goXP', 'goLvl',   // F5.18
   'mapCity', 'mapBeach', 'mapQ', 'btnGums', 'panelGums', 'goRound2', 'goName', 'goBar', 'devhp', 'devhpFill', 'devhpText', 'devhpHit', 'travel', 'btnLineup', 'panelLineup',
   'btnItems', 'panelItems']   // F5.28
    .forEach(id => { UI[id] = document.getElementById(id); });
  UI.goBest = document.getElementById('goBest');
  UI.record = document.getElementById('record');
  UI.restart = document.getElementById('restart');
  UI.best = document.getElementById('best');
  UI.hud = document.getElementById('hud');
  UI.pu = document.getElementById('pubanner');
  UI.fx = document.getElementById('effects');
  UI.prompt = document.getElementById('prompt');
  buildDmgNums();
}

//--- prompt de interacción [F] ---
let promptText = '', promptPoor = null, promptDenyT = 0;
function promptFor(it) {
  if (it.kind === 'door' && it.target.power) return { text: 'Gate - opens with the power', cost: 0 };   // F5.7
  if (it.kind === 'door' && it.target.levers) return cataDoorPrompt();                                 // F5.28e: D23
  if (it.kind === 'lever') return { text: '[F] Pull the lever', cost: 0 };                           // F5.28e
  if (it.kind === 'ee') return { text: '', cost: 0 };                // F5.29: el easter egg no da pistas (F igual funciona)
  if (it.kind === 'door' && it.target.burning) return { text: 'The vines are burning...', cost: 0 };   // F5.12
  if (it.kind === 'door' && it.target.burn) return { text: '[F] Burn the vines - ' + it.target.cost, cost: it.target.cost };
  if (it.kind === 'door') return { text: '[F] Open door - ' + it.target.cost, cost: it.target.cost };
  if (it.kind === 'gen') return { text: 'Generator off - [V] hit it with the knife', cost: 0 };
  if (it.kind === 'perk') { const st = perkStatus(it.target.key); return { text: st.text, cost: st.cost }; }
  if (it.kind === 'power') {                                        // F5.6: pide los 4 generadores
    const n = powerMissing();
    return { text: n ? 'Power - ' + (n === 1 ? '1 generator missing' : n + ' generators missing') : '[F] Turn on the power', cost: 0 };
  }
  if (it.kind === 'part') return { text: '[F] Pick up ' + CONFIG.SHIELD.parts[it.target.key].name, cost: 0 };
  if (it.kind === 'bench') return benchPrompt();
  if (it.kind === 'barrier') return barrierPrompt(it.target);   // F5.19b
  if (it.kind === 'lantern') return lanternPrompt(it.target);   // F5.20
  if (it.kind === 'firesale') return { text: '[F] Mystery Box - ' + boxCost() + ' (FIRE SALE)', cost: boxCost() };   // F5.19c (F5.24: 10)
  if (it.kind === 'qpiece') return { text: '[F] Pick up ' + it.target.name, cost: 0 };   // F5.5
  if (it.kind === 'workshop') return workshopPrompt();
  if (it.kind === 'trap') return trapPrompt(it.target);   // F5.9
  if (it.kind === 'hatch') return hatchPrompt(it.target); // F5.11
  if (it.kind === 'portal') return portalPrompt(it.target); // F5.16
  if (it.kind === 'fumigator' || it.kind === 'clam') return clamPrompt(it);   // F5.14
  if (it.kind === 'pap') return papPrompt();
  if (it.kind === 'gum') return gumPrompt(it.target);   // F5.18b: chiclera
  if (it.kind === 'box') {
    if (BOX.phase === 'ready') return { text: '[F] Take ' + (BOX.result === 'monkey' ? CONFIG.MONKEY.name : CONFIG.WEAPONS[BOX.result].name), cost: 0 };
    return { text: '[F] Mystery Box - ' + boxCost() + (state.effects.fireSale > 0 ? ' (FIRE SALE)' : ''), cost: boxCost() };
  }
  const wb = it.target;
  if (wb.weapon === 'machete') return state.machete ? { text: 'MACHETE - already owned', cost: 0 }
                                                     : { text: '[F] Buy MACHETE - ' + wb.cost, cost: wb.cost };
  const owned = state.weapons.find(w => w.id === wb.weapon);
  if (!owned) return { text: '[F] Buy ' + CONFIG.WEAPONS[wb.weapon].name + ' - ' + wb.cost, cost: wb.cost };
  const def = slotDef(owned), ac = ammoCostOf(owned);            // F2b: mejorada = su nombre y munición a 2500
  if (owned.reserve >= def.reserveMax) return { text: def.name + ' - ammo full', cost: 0 };
  return { text: '[F] Ammo ' + def.name + ' - ' + ac, cost: ac };
}
function updatePromptUI(dt) {
  const it = interactState;
  let text = '', poor = false;
  if (it.kind && state.running) {
    const p = promptFor(it);
    text = p.text; poor = state.points < p.cost && !gumActive('freeall');   // F5.18b: SHOPPING SPREE
  }
  if (text !== promptText) {
    promptText = text;
    if (text) UI.prompt.textContent = text;          // al ocultar deja el texto viejo para el fade
    UI.prompt.classList.toggle('show', !!text);
  }
  if (poor !== promptPoor) { promptPoor = poor; UI.prompt.classList.toggle('poor', poor); }
  if (promptDenyT > 0) { promptDenyT -= dt; if (promptDenyT <= 0) UI.prompt.classList.remove('deny'); }
}
function denyPrompt() {
  UI.prompt.classList.remove('deny');
  void UI.prompt.offsetWidth;                         // reinicia la animación CSS
  UI.prompt.classList.add('deny');
  promptDenyT = 0.35;
}
function resetPromptUI() {
  promptText = ''; promptPoor = null; promptDenyT = 0;
  UI.prompt.classList.remove('show', 'poor', 'deny');
}

//--- banner de power-up + indicador de efectos activos ---
let puT = 0;
function showPowerupBanner(type) {
  const info = CONFIG.POWERUPS.types[type];
  UI.pu.textContent = info.label;
  UI.pu.style.color = '#' + info.color.toString(16).padStart(6, '0');
  UI.pu.style.opacity = '1';
  puT = 2.2;
}
function updatePowerupUI(dt) {
  if (puT > 0) { puT -= dt; if (puT < 0.6) UI.pu.style.opacity = '0'; }
  // F5.19c: íconos (X2 para el doble puntos, calavera para el insta-kill, fire sale); parpadean los últimos 5 s
  const parts = [], icon = (sym, c, t) => '<span class="fxi' + (t < 5 ? ' blink' : '') + '" style="--c:' + c + '"><i>' + sym + '</i><em>' + Math.ceil(t) + '</em></span>';
  if (state.effects.instakill > 0) parts.push(icon('☠', '#c8261c', state.effects.instakill));
  if (state.effects.doublePoints > 0) parts.push(icon('X2', '#1f7ae0', state.effects.doublePoints));
  if (state.effects.fireSale > 0) parts.push(icon('$', '#e0409a', state.effects.fireSale));
  const h = parts.join('');
  if (h !== UI.fx.innerHTML) UI.fx.innerHTML = h;
}

//--- HUD de partida ---
let pendingPts = 0, pendingSpend = 0, shownPts = -1, bannerT = 0;
function showSpend(cost) { pendingSpend += cost; }
function resetHUD() {
  pendingPts = 0; pendingSpend = 0; shownPts = -1; bannerT = 0;
  UI.banner.style.opacity = '0';
  UI.go.classList.remove('show');
  UI.round.textContent = '';
  UI.best.textContent = 'Best: round ' + loadHighScore();
}
// F5.12: la ronda en números romanos (12 -> XII)
function roman(n) {
  const T = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
             [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of T) while (n >= v) { s += r; n -= v; }
  return s;
}
function setRoundHUD(n) {
  UI.round.textContent = n > 0 ? roman(n) : '';
  if (UI.round.classList.contains('blink')) return;   // F5.24: entre rondas sigue parpadeando (lo apaga roundBlink)
  UI.round.classList.remove('flash');
  void UI.round.offsetWidth;               // reinicia la animación CSS
  UI.round.classList.add('flash');
}
// F5.24: el parpadeo del número entre rondas (on al terminar la ronda, off al arrancar la siguiente)
function roundBlink(on) {
  if (!UI.round || !UI.round.classList) return;
  UI.round.classList.remove('flash');
  UI.round.classList.toggle('blink', on);
}
function showBanner(text, secs) {
  UI.banner.textContent = text;
  UI.banner.classList.toggle('long', text.length > 14);   // F4: el del Chicharito no entra con la letra grande
  UI.banner.style.opacity = '1';
  bannerT = secs;
}
//--- menú de inicio y pausa: el mismo overlay (#start) con data-mode main | pause ---
// Esc lo maneja el navegador (suelta el pointer lock); pointerlockchange decide qué mostrar.
// F5.18: menú a la izquierda (mapas, armas, perfil, ajustes, controles), el mundo en gris detrás (gfxFilter) con una
// cámara que recorre la playa (menuCamera, loop.js) y siluetas de mobs en cubos
const MENU = { started: false, mode: null, map: 'beach', weapon: null };
function showMenu(mode) {                  // 'main' | 'pause' | null (ocultar)
  MENU.mode = mode;
  if (UI.hud && UI.hud.style) UI.hud.style.visibility = mode === 'main' ? 'hidden' : '';   // F5.19c: sin HUD detrás del menú de inicio
  // F5.20 (bug: ESC bajando al búnker): la pantalla del viaje tapaba el menú de pausa. Con un menú abierto no se ve; al
  // volver, el viaje sigue donde estaba (updateBunker no corre en la pausa)
  if (UI.travel && UI.travel.style) UI.travel.style.visibility = mode ? 'hidden' : '';
  if (typeof gfxApplyFilter === 'function') gfxApplyFilter();
  if (mode && MAPV.on) toggleMap(false);   // F5.24: el menú cierra el mapa
  if (!mode) { UI.start.classList.add('hidden'); return; }
  UI.start.setAttribute('data-mode', mode);
  UI.btnPlay.textContent = mode === 'pause' ? 'RESUME' : 'PLAY';
  UI.best.textContent = 'Best: round ' + loadHighScore();
  if (mode === 'main') { renderProfileMini(); updateWeaponsBadge(); }   // F5.19c: aviso de accesorios nuevos
  else menuPanel(null);
  UI.start.classList.remove('hidden');
}
const MENU_PANELS = { maps: ['panelMaps', 'btnMaps'], weapons: ['panelWeapons', 'btnWeapons'], profile: ['panelProfile', 'btnProfile'],
                      settings: ['panelSettings', 'btnSettings'], controls: ['panelControls', 'btnControls'], gums: ['panelGums', 'btnGums'],
                      shop: ['panelShop', 'btnShop'],     // F5.19: la tienda de KRAKEN INK, aparte
                      items: ['panelItems', 'btnItems'],  // F5.28: la tienda de ítems (trofeos de boss)
                      lineup: ['panelLineup', 'btnLineup'] };   // F5.19c: los chicles, en la pausa
function menuPanel(which) {                // abre uno, cierra los otros; clic de nuevo = cerrar
  for (const k in MENU_PANELS) {
    const p = UI[MENU_PANELS[k][0]], b = UI[MENU_PANELS[k][1]];
    if (!p) continue;
    const open = k === which && !p.classList.contains('open');
    p.classList.toggle('open', open); if (b) b.classList.toggle('on', open);
    if (k === 'profile' && UI.start) UI.start.classList.toggle('prof', open);   // F5.28f: con PROFILE abierto no va el nivel de arriba
  }
  if (which === 'weapons') renderWeaponsPanel();
  if (which === 'profile') renderProfilePanel();
  if (which === 'gums') renderGumsPanel();
  if (which === 'shop') renderShopPanel();
  if (which === 'items') renderItemsPanel();                      // F5.28
  if (which === 'lineup') renderLineupPanel();                    // F5.19c
}
function xpBarHTML(cls) {
  const [a, b] = levelProgress(PROFILE.xp), k = b ? a / b : 1;
  return '<div class="' + cls + '"><i style="width:' + (k * 100).toFixed(1) + '%"></i></div>';
}
function renderProfileMini() {
  if (!UI.mProfMini) return;
  const L = rankLevel();
  UI.mProfMini.innerHTML = esc(PROFILE.name) + ' · LV ' + L + ' · ' + tierName(L) + xpBarHTML('bar');
  // F5.28f (Diego: "que en el menú principal siempre salga mi nivel actual hasta arriba, con una barrita de cuánto llevo")
  const top = typeof document !== 'undefined' && document.getElementById ? document.getElementById('lvTop') : null;
  if (top) {
    const [a, b] = levelProgress(PROFILE.xp);
    top.innerHTML = '<div class="lvb"><small>LV</small>' + L + '</div><div class="lvt"><b>' + esc(PROFILE.name) + ' · ' + tierName(L) + '</b>' +
      xpBarHTML('lvbar') + '<span>' + (b ? a + ' / ' + b + ' XP · NEXT LV ' + (L + 1) : 'MAX LEVEL') + '</span></div>';
  }
}
function esc(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
function renderProfilePanel() {
  const L = rankLevel(), [a, b] = levelProgress(PROFILE.xp), P = CONFIG.PROGRESSION;
  const next = [];                                    // F5.27: lo próximo del pase (y los chicles CLASSIC, que van aparte)
  for (let lv = L + 1; lv <= P.maxLevel && !next.length; lv++) { const r = passRewards(lv); if (r.length) next.push([lv, r.map(passText).join(' + ')]); }
  for (const id in CONFIG.GUMS.list) { const g = CONFIG.GUMS.list[id]; if (g.rarity === 'classic' && g.level > L) next.push([g.level, g.name + ' GUM']); }
  next.sort((x, y) => x[0] - y[0]);
  const opts = accountNames().map(n => '<option' + (n === PROFILE.name ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
  UI.panelProfile.innerHTML = '<h3>PROFILE</h3>' +
    '<div class="acct">ACCOUNT <select id="acctSel">' + opts + '</select><input id="acctNew" maxlength="16" placeholder="NEW ACCOUNT"><button id="acctAdd">CREATE</button>' +
    (accountNames().length > 1 ? '<button id="acctDel">DELETE</button>' : '') +
    (CONFIG.DEBUG_MODE ? '<button id="devMax" class="dev">' + (DEV.on ? 'DEV ACCOUNT ON' : 'DEV: MAX ACCOUNT (this session)') + '</button>' : '') + '</div>' +
    '<div class="prof"><div class="badge">' + L + '</div><div>' +
    '<input id="profName" maxlength="16" value="' + esc(PROFILE.name) + '">' +
    '<div class="tier">' + tierName(L) + '</div>' + xpBarHTML('pbar') +
    '<p class="dim">' + (b ? a + ' / ' + b + ' XP to level ' + (L + 1) : 'MAX LEVEL') + '</p></div></div>' +
    '<div class="pstats"><span>Level</span><span>' + L + ' / ' + P.maxLevel + '</span><span>Total XP</span><span>' + PROFILE.xp + '</span>' +
    '<span>Best round</span><span>' + loadHighScore() + '</span>' +
    '<span>Next unlock</span><span>' + (next.length ? next[0][1] + ' (level ' + next[0][0] + ')' : 'Everything unlocked') + '</span>' +
    '<span>' + CONFIG.GUMS.currency + '</span><span>' + (DEV.on ? '∞' : PROFILE.ink) + '</span>' +
    '<span>Double XP tokens</span><span>' + (PROFILE.xp2 | 0) + (PROFILE.xp2On ? ' (one active now)' : '') + '</span></div>' +
    passTrackHTML(L) +                                 // F5.27: el pase del 1 al 100
    bossPlatesHTML();                                  // F5.26: placas por boss (1, 5 y 25 kills)
  const inp = document.getElementById('profName'), on = (id, ev, f) => { const e = document.getElementById(id); if (e && e.addEventListener) e.addEventListener(ev, f); };
  on('profName', 'change', () => { if (!renameAccount(inp.value)) UI.menuMsg.textContent = 'That name is taken.'; renderProfilePanel(); renderProfileMini(); });
  on('acctSel', 'change', e => { switchAccount(e.target.value); renderProfilePanel(); renderProfileMini(); });
  on('acctAdd', 'click', () => { const n = document.getElementById('acctNew').value; if (!createAccount(n)) UI.menuMsg.textContent = 'Pick a new name.'; renderProfilePanel(); renderProfileMini(); });
  on('acctDel', 'click', () => { if (confirm('Delete account ' + PROFILE.name + '?')) deleteAccount(PROFILE.name); renderProfilePanel(); renderProfileMini(); });
  on('devMax', 'click', () => { devMaxAccount(); renderProfilePanel(); renderProfileMini(); });
  const tr = document.getElementById('passTrack');                   // F5.27: la tira arranca en tu nivel
  if (tr && tr.querySelector) { const cur = tr.querySelector('.cur'); if (cur) tr.scrollLeft = Math.max(0, cur.offsetLeft - 160); }
}
// F5.27: el pase estilo Fortnite: una casilla por nivel (1..maxLevel) con lo que da: tinta, camo (con su color) o XP doble.
// Las que ya pasaste, marcadas; la tuya, resaltada. Lo que no da nada queda como un casillero vacío con la XP que pide
function passTrackHTML(L) {
  const P = CONFIG.PROGRESSION;
  let h = '<div class="pass"><b style="letter-spacing:3px">BATTLE PASS · LEVEL ' + L + ' / ' + P.maxLevel + '</b><div class="ptrack" id="passTrack">';
  for (let lv = 1; lv <= P.maxLevel; lv++) {
    const r = passRewards(lv), done = lv <= L, cls = 'ptile' + (done ? ' done' : '') + (lv === L ? ' cur' : '') + (r.length ? '' : ' empty');
    let body = '';
    for (const q of r) {
      if (q.type === 'camo') body += '<i class="pcamo" style="background:repeating-linear-gradient(45deg,#' + q.color.toString(16).padStart(6, '0') + ' 0 6px,rgba(0,0,0,.35) 6px 9px)"></i><em>' + q.name + '</em>';
      else if (q.type === 'ink') body += '<i class="pink">' + q.n + '</i><em>INK</em>';
      else body += '<i class="pxp">2×</i><em>XP</em>';
    }
    if (!r.length) body = '<em class="dim">' + (xpForLevel(lv) - xpForLevel(lv - 1 || 1)) + ' XP</em>';
    h += '<div class="' + cls + '"><span>' + lv + '</span>' + body + '</div>';
  }
  return h + '</div></div>';
}
// F5.28: la tienda ITEMS. Arriba, tus trofeos de boss (la moneda). Cada ítem: qué hace, dónde aparece, cuánto cuesta en
// trofeos, cuántos tenés, BUY y EQUIP (uno por partida: aparece desde el inicio en su lugar y se gasta al agarrarlo)
const ROOM_LABEL = { R16: 'the bunker', R22: 'the squid harbor', R20: 'the temple', R14: 'the ranch', R21: 'the shell', R2: 'the living room' };
function renderItemsPanel() {
  const T = CONFIG.TROPHIES, H = PROFILE.trophies || {}, I = PROFILE.items || {};
  let h = '<h3>ITEMS · BOSS TROPHIES</h3><p class="dim">Kill bosses for trophies, trade them for items. Equip one: it waits for you on the map, ' +
          'in its spot, from the start of the match. Picking it up uses it.</p><div class="trophies">';
  for (const k in T.items) h += '<span><i style="background:#' + T.items[k].color.toString(16).padStart(6, '0') + '"></i>' + T.items[k].name + ' ×' + (H[k] | 0) + '</span>';
  h += '</div><div class="items">';
  for (const r of T.recipes) {
    // F5.28f (Diego): cada ítem se ve desde su nivel de cuenta (r.level); antes, "?"
    if (!DEV.on && rankLevel() < (r.level || 1)) { h += '<div class="item lock"><b>?</b><span>Unlocks at account level ' + r.level + '</span></div>'; continue; }
    const n = I[r.id] | 0, eq = PROFILE.itemEquip === r.id;
    h += '<div class="item' + (eq ? ' eq' : '') + '"><b>' + r.name + '</b><span>' + r.desc + '</span>' +
         '<div class="cost">Cost: ' + needText(r) + '<br>Spawns in ' + (ROOM_LABEL[T.spots[r.id]] || T.spots[r.id]) + ' · You have ' + n + '</div>' +
         '<button data-buy="' + r.id + '"' + (canBuyItem(r.id) ? '' : ' disabled') + '>BUY</button>' +
         '<button data-eq="' + r.id + '"' + (n > 0 ? '' : ' disabled') + '>' + (eq ? 'UNEQUIP' : 'EQUIP') + '</button></div>';
  }
  UI.panelItems.innerHTML = h + '</div>';
  if (!UI.panelItems.querySelectorAll) return;
  UI.panelItems.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => { if (buyItem(b.dataset.buy)) sfxBuy(); else sfxDeny(); renderItemsPanel(); }));
  UI.panelItems.querySelectorAll('[data-eq]').forEach(b => b.addEventListener('click', () => { equipItem(b.dataset.eq); renderItemsPanel(); }));
}
// F5.19c (Diego): aviso rojo en WEAPONS con la cantidad de accesorios desbloqueados que no miraste
function updateWeaponsBadge() {
  if (!UI.btnWeapons) return;
  const n = unseenTotal(), h = 'WEAPONS' + (n ? '<i class="nbadge">' + n + '</i>' : '');
  if (UI.btnWeapons.innerHTML !== h) UI.btnWeapons.innerHTML = h;
}
// F5.28f (Diego): el arma se ve en el menú desde su nivel de cuenta (PROGRESSION.weaponLevels); antes, "?"
function weaponSeen(w) { return DEV.on || rankLevel() >= (CONFIG.PROGRESSION.weaponLevels[w] || 1); }
function renderWeaponsPanel() {
  const P = CONFIG.PROGRESSION, ids = Object.keys(CONFIG.WEAPONS).filter(canAttach);
  if (!MENU.weapon || ids.indexOf(MENU.weapon) < 0 || !weaponSeen(MENU.weapon)) MENU.weapon = ids.find(weaponSeen) || ids[0];
  // F5.19: los accesorios van por NIVEL DEL ARMA (se sube con sus kills); los camos, por el nivel general
  const id = MENU.weapon, L = loadoutOf(id), lv = rankLevel(), wl = weaponLevel(id), [wa, wb] = weaponProgress(id);
  let h = '<h3>WEAPONS · ATTACHMENTS (' + L.att.length + '/' + P.maxAtt + ')</h3><div class="wgrid"><div class="wlist">';
  const fresh = unseenAtts(id);                        // F5.19c: accesorios nuevos de esta arma (se marcan "NEW")
  // F5.20 (Diego): la lista va agrupada por tipo (CONFIG.PROGRESSION.weaponCats), con un título por grupo
  const cats = CONFIG.PROGRESSION.weaponCats, catOf = w => cats.find(c => c.ids.includes(w)) || cats[cats.length - 1];
  for (const c of cats) {
    const list = ids.filter(w => catOf(w) === c);
    if (!list.length) continue;
    h += '<div class="wcat">' + c.name + '</div>';
    for (const w of list) {
      if (!weaponSeen(w)) { h += '<button class="wlock" disabled>?<small>ACCOUNT LV ' + P.weaponLevels[w] + '</small></button>'; continue; }
      const n = (PROFILE.loadout[w] && PROFILE.loadout[w].att.length) || 0, u = w === id ? 0 : unseenAtts(w).length;
      h += '<button data-w="' + w + '" class="' + (w === id ? 'on' : '') + '">' + CONFIG.WEAPONS[w].name + (u ? '<i class="nbadge">' + u + '</i>' : '') +
           '<small>LV ' + weaponLevel(w) + (n ? ' · ' + n : '') + '</small></button>'; }
  }
  h += '</div><div><b style="letter-spacing:3px">' + CONFIG.WEAPONS[id].name + '</b> <span class="dim">· WEAPON LEVEL ' + wl +
       (wb ? ' · ' + wa + ' / ' + wb + ' XP' : ' · MAX') + '</span><div class="pbar"><i style="width:' + (wb ? wa / wb * 100 : 100).toFixed(1) + '%"></i></div>' +
       '<div id="wprev" class="wprev"></div><div class="atts">';
  for (const k of attsFor(id)) {                     // F5.18b: solo los que tienen sentido en esa arma
    const A = P.attachments[k], lock = wl < A.level, on = L.att.indexOf(k) >= 0;
    h += '<div class="att' + (on ? ' on' : '') + (lock ? ' locked' : '') + (fresh.indexOf(k) >= 0 ? ' new' : '') + '" data-a="' + k + '"><b>' + attName(id, k) + '</b><span>' +
         (lock ? 'Weapon level ' + A.level : A.desc) + '</span></div>';
  }
  h += '</div><b style="letter-spacing:3px">CAMO</b><div class="camos" style="margin-top:8px">' +
       '<div class="camo' + (!L.camo ? ' on' : '') + '" data-c=""><i style="background:#3a3a3a"></i>NONE</div>';
  for (const c of P.camos) {
    const lock = !camoUnlocked(c.id), col = '#' + c.color.toString(16).padStart(6, '0');
    // F5.26: los de boss dicen a quién y cuántas veces (BEAST ×1, CHARRO: SOMBRERÓN ×5, ...)
    const why = c.ee ? '???' : c.boss ? (c.boss === 'any' ? 'ANY BOSS' : BOSS_LABEL[c.boss]) + ' ' + bossKillCount(c.boss) + '/' + c.kills : 'LV ' + c.level;   // F5.29: el del easter egg, sin pista
    h += '<div class="camo' + (L.camo === c.id ? ' on' : '') + (lock ? ' locked' : '') + '" data-c="' + c.id + '"><i style="background:' +
         'repeating-linear-gradient(45deg,' + col + ' 0 8px,rgba(0,0,0,.35) 8px 12px)"></i>' + (lock ? why : c.name) + '</div>';
  }
  h += '</div></div></div>';
  UI.panelWeapons.innerHTML = h;
  markAttsSeen(id); updateWeaponsBadge();                          // F5.19c: ya los viste
  if (!UI.panelWeapons.querySelectorAll) return;
  weaponPreview(document.getElementById('wprev'), id);   // F5.18b: el arma con lo que le pusiste, girando
  UI.panelWeapons.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => { MENU.weapon = b.dataset.w; renderWeaponsPanel(); }));
  UI.panelWeapons.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.a;
    if (!attUnlocked(k, id)) return;
    if (L.att.indexOf(k) < 0 && L.att.length >= P.maxAtt) { UI.menuMsg.textContent = 'Max ' + P.maxAtt + ' attachments per weapon.'; return; }
    toggleAttachment(id, k); UI.menuMsg.textContent = ''; renderWeaponsPanel();
  }));
  UI.panelWeapons.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => {
    const c = b.dataset.c;
    if (c && !camoUnlocked(c)) return;
    setCamo(id, c); renderWeaponsPanel();
  }));
}
// F5.18b: vista previa del arma en el menú de armas. Un renderer chico aparte (se crea la primera vez que se abre el
// panel); el modelo se arma igual que en la mano (accesorios y camo) y gira despacio mientras el panel está abierto
const WPREV = { r: null, scene: null, cam: null, model: null };
function weaponPreview(host, id) {
  if (!host) return;
  if (!WPREV.r) {
    try { WPREV.r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return; }
    WPREV.r.setPixelRatio(Math.min(devicePixelRatio, 2)); WPREV.r.setSize(440, 180);
    WPREV.scene = new THREE.Scene();
    WPREV.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x404858, 1.15));
    const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(1.5, 2, 2); WPREV.scene.add(dl);
    WPREV.cam = new THREE.PerspectiveCamera(28, 440 / 180, 0.01, 20);
  }
  host.appendChild(WPREV.r.domElement);
  if (WPREV.model) WPREV.scene.remove(WPREV.model);
  const def = slotDef({ id }), m = buildWeaponModel(def);
  if (def.camo) tintModel(m, def.camo);
  if (def.att) addAttachmentModels(m, def.att, def);
  const beams = []; m.traverse(o => { if (o.userData.beam) beams.push(o); });
  beams.forEach(o => o.parent.remove(o));                              // el haz del láser no entra en la vista (ni en la caja)
  const w = Math.max(240, Math.min(560, host.clientWidth || 440));
  WPREV.r.setSize(w, 180); WPREV.cam.aspect = w / 180; WPREV.cam.updateProjectionMatrix();
  m.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(m), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
  m.position.sub(c);
  const g = new THREE.Group(); g.add(m); g.rotation.y = Math.PI / 2 + 0.35; WPREV.model = g; WPREV.scene.add(g);
  const r = Math.max(sz.z * 0.62, sz.y, 0.25);
  WPREV.cam.position.set(0, r * 0.2, r * 2.2); WPREV.cam.lookAt(0, 0, 0);
  WPREV.r.render(WPREV.scene, WPREV.cam);
}
function updateWeaponPreview(dt) {
  if (!WPREV.model || !UI.panelWeapons || !UI.panelWeapons.classList.contains('open')) return;
  WPREV.model.rotation.y += dt * 0.6;
  WPREV.r.render(WPREV.scene, WPREV.cam);
}
// F5.18b: pestaña de chicles: preset de 5, todos los chicles (con cuántos tenés) y la tienda con la moneda
const GUMUI = { slot: 0, rolling: false };
function gumChip(g, cls) { return '<i class="gum ' + (cls || '') + '" style="background:' + g.color + ';border-color:' + CONFIG.GUMS.rarities[g.rarity].color + '">' + g.icon + '</i>'; }
function renderGumsPanel() {
  const G = CONFIG.GUMS, n = G.presetSize, lv = rankLevel(), tab = GUMUI.tab || 'level';
  // F5.20 (Diego): 3 sets guardados; los chicles del set que no tenés se ven en gris (siguen en el set)
  // F5.28e: cabecera como la de la tienda, la bóveda 3D (gumVaultMount) y los casilleros y cartas en estilo cúbico
  let h = '<div class="shophead gumhead"><span class="kraken">🍬</span><div><h3>GUM VAULT</h3><div class="dim">Your set of ' + n +
          '. Pick a slot, then a gum.</div></div><div class="inkbag"><b>' + (DEV.on ? '∞' : PROFILE.ink) + '</b><span>' + G.currency + '</span></div></div>' +
          '<div class="gvault" id="gvault"></div><div class="gsets">';
  for (let s = 0; s < G.presetSets; s++) h += '<button data-set="' + s + '" class="' + (PROFILE.presetIdx === s ? 'on' : '') + '">SET ' + (s + 1) + '</button>';
  h += '</div><div class="dim">Gray = you have none: the machine can still roll it, but you cannot take it.</div><div class="preset">';
  for (let i = 0; i < n; i++) {
    const id = PROFILE.preset[i], g = id && gumDef(id), none = g && gumCount(id) <= 0;
    h += '<div class="pslot' + (g ? '' : ' empty') + (none ? ' none' : '') + (GUMUI.slot === i ? ' sel' : '') + '" data-slot="' + i + '">' +
         (g ? gumChip(g) + '<div>' + g.name + (none ? '<br><small>×0</small>' : '') + '</div>' : '<i class="gum">+</i><div>EMPTY</div>') + '</div>';
  }
  // F5.20 (Diego): dos pestañas: los que se desbloquean por nivel (básicos) y los de KRAKEN INK
  h += '</div><div class="gtabs"><button data-tab="level" class="' + (tab === 'level' ? 'on' : '') + '">BY LEVEL</button>' +
       '<button data-tab="ink" class="' + (tab === 'ink' ? 'on' : '') + '">' + G.currency + '</button></div><div class="gumgrid">';
  // F5.19: el fondo de cada carta por rareza (clásico gris, raro verde, ultra rojo, épico morado) y la cantidad arriba a
  // la derecha, grande
  for (const r of tab === 'level' ? ['classic'] : ['rare', 'ultra', 'epic']) for (const id in G.list) {
    const g = G.list[id];
    if (g.rarity !== r) continue;
    const c = gumCount(id), lock = r === 'classic' && lv < g.level && !DEV.on;
    // F5.28f (Diego): los de tinta que nunca tuviste (sin entrada en PROFILE.gums) salen como "?": solo se ve la rareza
    if (r !== 'classic' && !DEV.on && !(id in PROFILE.gums)) {
      h += '<div class="gcard vox r-' + r + ' none lock"><i class="gum" style="border-color:' + G.rarities[r].color + '">?</i>' +
           '<div><b>???</b><span>' + G.rarities[r].name + ' · UNDISCOVERED</span><br><span>Win it in the ' + G.currency + ' drum.</span></div></div>';
      continue;
    }
    const tag = lock ? 'LOCKED · LV ' + g.level : G.rarities[r].name;
    h += '<div class="gcard vox r-' + r + (c > 0 ? '' : ' none') + (lock ? ' lock' : '') + '" data-gum="' + id + '" title="' + esc(g.desc) + '">' + gumChip(g) +
         '<div><b>' + g.name + '</b><span>' + tag + '</span><br><span>' + esc(g.desc) + '</span></div>' +
         '<i class="cnt">' + (lock ? '' : c === Infinity ? '∞' : '×' + c) + '</i></div>';
  }
  h += '</div><div class="dim">More gums: ' + G.currency + ' tab.</div>';
  UI.panelGums.innerHTML = h;
  if (!UI.panelGums.querySelectorAll) return;
  UI.panelGums.querySelectorAll('[data-slot]').forEach(e => e.addEventListener('click', () => {
    const i = +e.dataset.slot;
    if (GUMUI.slot === i && PROFILE.preset[i]) setPresetSlot(i, null);
    GUMUI.slot = i; renderGumsPanel();
  }));
  UI.panelGums.querySelectorAll('[data-gum]').forEach(e => e.addEventListener('click', () => {
    if (!setPresetSlot(GUMUI.slot, e.dataset.gum)) return;
    GUMUI.slot = Math.min(n - 1, GUMUI.slot + 1); renderGumsPanel();
  }));
  UI.panelGums.querySelectorAll('[data-set]').forEach(e => e.addEventListener('click', () => { selectPreset(+e.dataset.set); GUMUI.slot = 0; renderGumsPanel(); }));   // F5.20
  UI.panelGums.querySelectorAll('[data-tab]').forEach(e => e.addEventListener('click', () => { GUMUI.tab = e.dataset.tab; renderGumsPanel(); }));
  gumVaultMount(document.getElementById('gvault'));                  // F5.28e: la bóveda 3D con tu set
}
// F5.19c (Diego): en la pausa, tu line up de chicles (el preset) con lo que hace cada uno, cuántos te quedan y cuál
// tenés activo ahora (con el tiempo o las cargas que le quedan)
function renderLineupPanel() {
  if (!UI.panelLineup) return;
  const G = CONFIG.GUMS, active = [];
  if (GUMM.held) active.push(GUMM.held.id);
  for (const k in GUMM.fx) if (GUMM.fx[k] > 0) active.push(k);
  const typeTxt = { instant: 'Instant', timed: 'Timed', charges: 'Charges - press T', melee: 'Knife hits', passive: 'Whole match' };
  let h = '<h3>GOBBLEGUM LINE UP</h3><div class="dim">One gum at a time. A timed gum blocks the machine until it ends; ' +
          'a new gum replaces the one you are holding.</div><div class="lineup">';
  for (const id of PROFILE.preset) {
    const g = gumDef(id);
    if (!g) continue;
    const c = gumCount(id), on = active.includes(id);
    let st = '';
    if (on && GUMM.held && GUMM.held.id === id) st = 'IN HAND · ' + GUMM.held.charges + '/' + (g.charges || 1);
    else if (on) st = GUMM.fx[id] === Infinity ? 'ACTIVE' : 'ACTIVE · ' + Math.ceil(GUMM.fx[id]) + ' s';
    h += '<div class="lcard r-' + g.rarity + (on ? ' on' : '') + (c <= 0 ? ' none' : '') + '">' + gumChip(g) +   // F5.20: gris si no tenés
         '<div class="lt"><b>' + g.name + '</b><span>' + G.rarities[g.rarity].name + ' · ' + (typeTxt[g.type] || g.type) +
         (g.time ? ' · ' + g.time + ' s' : '') + '</span><p>' + esc(g.desc) + '</p>' + (st ? '<em>' + st + '</em>' : '') + '</div>' +
         '<i class="cnt">' + (c === Infinity ? '∞' : '×' + c) + '</i></div>';
  }
  h += '</div>';
  UI.panelLineup.innerHTML = h;
}
// F5.19 (Diego): la tienda de KRAKEN INK en su pestaña, con una tómbola de bingo: al comprar gira la jaula con bolas de
// colores (los chicles) y van saliendo por la canaleta los ganados
function renderShopPanel() {
  const G = CONFIG.GUMS, all = Object.keys(G.list).filter(id => !gumClassic(id));
  // F5.19c: cartel de feria con el pulpo y la tinta que tenés, barras de probabilidad por rareza
  let h = '<div class="shophead"><span class="kraken">🐙</span><div><h3>KRAKEN INK · GUM DRUM</h3><div class="dim">Spend ink, spin the drum, win gums.</div></div>' +
          '<div class="inkbag"><b>' + (DEV.on ? '∞' : PROFILE.ink) + '</b><span>' + G.currency + '</span></div></div><div class="shopwrap"><div>' +
          // F5.28d (Diego: "la ruleta cúbica y mucho mejor"): el tambor es una escena 3D en cubos (GDRUM, renderer aparte)
          '<div class="drum3d" id="gdrum"></div>';
  h += '</div><div><div class="dim">Spend ' + G.currency + ' (drops from doors, vines and the Mystery Box). The drum picks your gums.</div>' +
       '<div class="shop col" style="margin:14px 0">';
  for (let t = 1; t <= 3; t++) {
    const o = G.shop[t].odds;
    const R = G.rarities, pc = k => Math.round(o[k] * 100);
    h += '<button data-shop="' + t + '"' + ((PROFILE.ink >= t || DEV.on) && !GUMUI.rolling ? '' : ' disabled') + '><span class="tprice">' + t + ' 🐙</span> ' + G.shop[t].count + ' GUM' + (t > 1 ? 'S' : '') +
         '<div class="odds"><i style="width:' + pc('rare') + '%;background:' + R.rare.color + '"></i><i style="width:' + pc('ultra') + '%;background:' + R.ultra.color + '"></i><i style="width:' + pc('epic') + '%;background:' + R.epic.color + '"></i></div>' +
         '<small>RARE ' + pc('rare') + '% · ULTRA ' + pc('ultra') + '% · EPIC ' + pc('epic') + '%</small></button>';
  }
  h += '</div><div id="gumRoll"></div></div></div>';
  UI.panelShop.innerHTML = h;
  if (!UI.panelShop.querySelectorAll) return;
  UI.panelShop.querySelectorAll('[data-shop]').forEach(e => e.addEventListener('click', () => gumShop(+e.dataset.shop)));
  gumDrumMount(document.getElementById('gdrum'), all);
}
// sorteo con animación: la jaula gira ~2 s con las bolas saltando adentro y después sale una bola por cada chicle ganado
function gumShop(tier) {
  if (GUMUI.rolling) return;
  const won = rollGumPack(tier);
  if (!won) { UI.menuMsg.textContent = 'Not enough ' + CONFIG.GUMS.currency + '.'; return; }
  GUMUI.rolling = true; renderShopPanel();
  // F5.19c: con el ruido de la chiclera (~6 s): el tambor gira hasta el segundo 5 y ahí salen los chicles.
  // F5.28d: el tambor 3D (GDRUM) gira y después suelta un cubo por chicle ganado por la canaleta
  if (!(typeof playSample === 'function' && playSample('ruido_de_la_gumball_machine')) && typeof sfxBuy === 'function') sfxBuy();
  const spinMs = CONFIG.GUMS.machine.vend * 1000, D = CONFIG.GUMS.drum;
  GDRUM.phase = 'spin'; GDRUM.t = 0; GDRUM.won = won;
  let t = 0;
  const tick = () => {
    t += 60;
    if (t < spinMs) { setTimeout(tick, 60); return; }
    GDRUM.phase = 'out'; GDRUM.t = 0;
    GUMUI.rolling = false; renderShopPanel();
    const box = document.getElementById('gumRoll');
    if (box) box.innerHTML = won.map((id, i) => { const g = gumDef(id), R = CONFIG.GUMS.rarities[g.rarity];
      return '<div class="won" style="animation-delay:' + (D.outDelay + i * D.outEach).toFixed(2) + 's">' + gumChip(g) + '<div style="color:' + R.color + '">' + R.name + '</div><div>' + g.name + '</div></div>'; }).join('');
  };
  tick();
}
//--- F5.28d: el tambor de la tienda en 3D, en cubos. Renderer chico aparte (como WPREV), armado una vez la primera vez que
// se abre la tienda. Pedestal escalonado con tentáculos de kraken, foquitos que corren, dos postes con un tambor cúbico
// (marco de barras doradas y vidrio morado) que gira sobre su eje con la manivela, chicles-cubo adentro, canaleta y
// bandeja. Fases (GDRUM.phase): idle (gira despacio) · spin (acelera, los chicles saltan) · out (sale un cubo por chicle
// ganado, cae por la canaleta a la bandeja y revienta con el brillo de su rareza) ---
const GDRUM = { r: null, scene: null, cam: null, root: null, drum: null, crank: null, balls: [], outs: [], bulbs: [], phase: 'idle', t: 0, won: [], spin: 0, ang: 0 };
function buildGumDrum() {
  const D = CONFIG.GUMS.drum;
  try { GDRUM.r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { GDRUM.r = null; return false; }
  GDRUM.r.setPixelRatio(Math.min(devicePixelRatio, 2)); GDRUM.r.setSize(D.w, D.h);
  const S = GDRUM.scene = new THREE.Scene();
  S.add(new THREE.HemisphereLight(0xffe8d0, 0x302040, 1.0));
  const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(2, 4, 3); S.add(dl);
  const rim = new THREE.DirectionalLight(0xb060ff, 0.7); rim.position.set(-3, 2, -2); S.add(rim);
  GDRUM.cam = new THREE.PerspectiveCamera(30, D.w / D.h, 0.1, 40);
  GDRUM.cam.position.set(3.1, 3.1, 6.9); GDRUM.cam.lookAt(0, 1.3, 0.45);   // (F5.28f: un poco más atrás y arriba: el cartel subió)
  const root = GDRUM.root = new THREE.Group(); S.add(root);
  const lam = new THREE.MeshLambertMaterial({ vertexColors: true });
  const WOOD = 0x4a2a18, WOOD2 = 0x6a3a1e, GOLD = 0xe8b040, GOLD2 = 0xb8862a, INK = 0x3a1a5a, INK2 = 0x5a2a8a, SUCK = 0xd8a0e8;
  const mb = new MeshBuilder();
  // pedestal escalonado con borde dorado
  // (el borde dorado son 4 listones: una plancha entera tapaba la madera de arriba)
  const trim = (y, w, d, cz, col) => { mb.box(0, y, cz + d / 2, w, 0.05, 0.06, col); mb.box(0, y, cz - d / 2, w, 0.05, 0.06, col);
    mb.box(w / 2, y, cz, 0.06, 0.05, d, col); mb.box(-w / 2, y, cz, 0.06, 0.05, d, col); };
  mb.box(0, 0.1, 0.2, 2.6, 0.2, 2.2, WOOD); trim(0.21, 2.62, 2.22, 0.2, GOLD2);
  mb.box(0, 0.35, 0.15, 2.1, 0.26, 1.7, WOOD2); trim(0.49, 2.12, 1.72, 0.15, GOLD);
  for (let i = 0; i < 6; i++) mb.box(-0.9 + i * 0.36, 0.485, 0.15, 0.3, 0.01, 1.6, i % 2 ? 0x5a321a : 0x74421f);   // tablas del piso
  // postes con remates dorados y el eje
  for (const s of [-1, 1]) {
    mb.box(s * 0.95, 1.1, 0, 0.22, 1.2, 0.22, WOOD2); mb.box(s * 0.95, 0.56, 0, 0.34, 0.08, 0.34, GOLD2);
    mb.box(s * 0.95, 1.72, 0, 0.3, 0.1, 0.3, GOLD); mb.box(s * 0.95, 1.8, 0, 0.14, 0.1, 0.14, GOLD2);
    // tentáculos de kraken que suben por los postes (cubos que se afinan y giran alrededor)
    for (let i = 0; i < 14; i++) {
      const k = i / 13, a = k * 5 + (s > 0 ? 0 : Math.PI), r = 0.16 + 0.02 * (1 - k), w = 0.13 * (1 - 0.6 * k);
      mb.box(s * 0.95 + Math.cos(a) * r, 0.58 + k * 1.05, Math.sin(a) * r, w, 0.1, w, i % 2 ? INK : INK2);
      if (i % 3 === 0) mb.box(s * 0.95 + Math.cos(a) * (r + w * 0.5), 0.58 + k * 1.05, Math.sin(a) * (r + w * 0.5), 0.03, 0.04, 0.04, SUCK);
    }
  }
  mb.box(0, 1.6, 0, 2.0, 0.06, 0.06, GOLD2);                                   // el eje
  // canaleta (de la boca del tambor a la bandeja) y la bandeja
  for (let i = 0; i < 8; i++) { const k = i / 7; mb.box(0.35, 1.02 - k * 0.42, 0.62 + k * 0.62, 0.34, 0.04, 0.1, GOLD2); }
  for (const s of [-1, 1]) for (let i = 0; i < 8; i++) { const k = i / 7; mb.box(0.35 + s * 0.18, 1.07 - k * 0.42, 0.62 + k * 0.62, 0.03, 0.1, 0.1, GOLD); }
  mb.box(0, 0.56, 1.34, 1.3, 0.06, 0.34, 0x1a1020); mb.box(0, 0.62, 1.52, 1.34, 0.12, 0.04, GOLD); mb.box(0, 0.62, 1.16, 1.34, 0.12, 0.04, GOLD);
  for (const s of [-1, 1]) mb.box(s * 0.66, 0.62, 1.34, 0.04, 0.12, 0.4, GOLD);
  // cartel arriba: plancha con el pulpo en cubos (ojos, tentáculos). F5.28f (Diego: "choca con el spin"): medio metro más
  // arriba (el tambor girando llega a 1.6 + 0.55·√2 ≈ 2.38 m) y colgado de dos postes por fuera del tambor
  const SY = 2.72;
  mb.box(0, SY, -0.05, 1.5, 0.36, 0.08, WOOD); mb.box(0, SY, -0.01, 1.56, 0.42, 0.04, GOLD2);
  mb.box(0, SY + 0.06, 0.04, 0.3, 0.22, 0.06, INK2); for (const s of [-1, 1]) mb.box(s * 0.07, SY + 0.08, 0.08, 0.06, 0.06, 0.02, 0xf0f0f0);
  for (let i = 0; i < 6; i++) mb.box(-0.3 + i * 0.12, SY - 0.1, 0.05, 0.05, 0.14, 0.05, INK);
  for (const s of [-1, 1]) { mb.box(s * 0.95, (1.85 + SY + 0.3) / 2, -0.02, 0.08, SY + 0.3 - 1.85, 0.08, GOLD2); mb.box(s * 0.95, SY + 0.34, -0.02, 0.14, 0.08, 0.14, GOLD); }
  mb.box(0, SY + 0.28, -0.02, 1.96, 0.06, 0.06, GOLD2);                       // el travesaño del que cuelga
  for (const s of [-1, 1]) mb.box(s * 0.55, SY + 0.24, -0.02, 0.03, 0.1, 0.03, 0x2a2a2a);   // las cadenas
  root.add(new THREE.Mesh(mb.geometry(), lam));
  // foquitos del pedestal: dos juegos que se alternan (corren durante el giro). MeshBasic: brillan solos
  const bulbs = [new MeshBuilder(), new MeshBuilder()];
  for (let i = 0; i < 20; i++) {
    const u = i / 20, side = Math.floor(u * 4), f = (u * 4) % 1;
    const x = side === 0 ? -1.0 + f * 2 : side === 1 ? 1.0 : side === 2 ? 1.0 - f * 2 : -1.0;
    const z = side === 0 ? 1.0 : side === 1 ? 1.0 - f * 1.7 : side === 2 ? -0.7 : -0.7 + f * 1.7;
    bulbs[i % 2].box(x * 1.05, 0.5, z * 1.0 + 0.15, 0.08, 0.08, 0.08, i % 4 < 2 ? 0xffe070 : 0xff60c0);
  }
  GDRUM.bulbs = bulbs.map(b => { const m = new THREE.Mesh(b.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true })); root.add(m); return m; });
  // el tambor: un grupo que gira sobre x. Marco de 12 barras doradas con esquinas, vidrio morado y tapas de las caras
  const drum = GDRUM.drum = new THREE.Group(); drum.position.set(0, 1.6, 0); root.add(drum);
  const fm = new MeshBuilder(), h = D.size / 2;
  for (const a of [-h, h]) for (const b of [-h, h]) {
    fm.box(0, a, b, D.size, 0.07, 0.07, GOLD); fm.box(a, 0, b, 0.07, D.size, 0.07, GOLD); fm.box(a, b, 0, 0.07, 0.07, D.size, GOLD);
  }
  for (const a of [-h, h]) for (const b of [-h, h]) for (const c of [-h, h]) fm.box(a, b, c, 0.14, 0.14, 0.14, GOLD2);
  for (const s of [-1, 1]) { fm.box(s * (h + 0.03), 0, 0, 0.04, 0.3, 0.3, GOLD2); fm.box(s * (h + 0.06), 0, 0, 0.04, 0.12, 0.12, INK2); }
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) fm.box(0, -h + (i + 1) * D.size / 4, s * h, D.size, 0.03, 0.03, GOLD2);   // barrotes
  drum.add(new THREE.Mesh(fm.geometry(), lam));
  drum.add(new THREE.Mesh(new THREE.BoxGeometry(D.size - 0.04, D.size - 0.04, D.size - 0.04),
    new THREE.MeshLambertMaterial({ color: 0x8a50d0, transparent: true, opacity: 0.22, depthWrite: false })));
  // la manivela (del lado derecho, gira con el tambor)
  const crank = GDRUM.crank = new THREE.Group(); crank.position.set(1.12, 1.6, 0); root.add(crank);
  const cm = new MeshBuilder(); cm.box(0.05, 0, 0, 0.1, 0.1, 0.1, GOLD2); cm.box(0.1, 0.22, 0, 0.05, 0.44, 0.06, GOLD); cm.box(0.2, 0.44, 0, 0.2, 0.08, 0.08, 0xc02020);
  crank.add(new THREE.Mesh(cm.geometry(), lam));
  // chicles-cubo adentro del tambor (se pintan con los colores de la tienda en gumDrumMount)
  for (let i = 0; i < D.balls; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(D.ball, D.ball, D.ball), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x111111 }));
    m.userData.seed = i * 1.37; drum.add(m); GDRUM.balls.push(m);
  }
  // los que salen: cubo MeshBasic + brillo (sprite aditivo) del color de la rareza; hasta 3 (el sobre más grande)
  const glow = radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group(), c = new THREE.Mesh(new THREE.BoxGeometry(D.ball * 1.6, D.ball * 1.6, D.ball * 1.6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(halo); g.add(c); g.visible = false; root.add(g);
    GDRUM.outs.push({ g, c, halo });
  }
  return true;
}
function gumDrumMount(host, ids) {
  if (!host) return;
  if (!GDRUM.r && !buildGumDrum()) return;
  const D = CONFIG.GUMS.drum;
  GDRUM.owner = 'drum'; GDRUM.r.setSize(D.w, D.h);                     // (el renderer es compartido con la bóveda)
  host.appendChild(GDRUM.r.domElement);
  ids = ids && ids.length ? ids : ['pointrain'];
  GDRUM.balls.forEach((m, i) => { m.material.color.set(gumDef(ids[i % ids.length]).color); });
  renderGumDrum(0);
}
function updateGumDrum(dt) {
  if (!GDRUM.r) return;
  if (GDRUM.owner === 'vault') { if (UI.panelGums && UI.panelGums.classList.contains('open')) renderGumVault(dt); return; }
  if (!UI.panelShop || !UI.panelShop.classList.contains('open')) return;
  renderGumDrum(dt);
}
//--- F5.28e (Diego: "la pantalla de la chiclera te quedó espectacular, necesito ese mismo empeño para la de chicles"): la
// bóveda de chicles en 3D arriba de la pestaña GUMS. Usa el mismo renderer que el tambor (un solo contexto WebGL más).
// Un mueble de cubos (madera oscura, borde dorado, tentáculos de kraken) con 5 vitrinas de vidrio: en cada una, tu
// chicle del set es un cubo de su color que gira sobre un pedestal con el brillo de su rareza; el casillero elegido sube
// y tiene un haz de luz; vacío, un "?" oscuro; si no lo tenés, gris
const GVAULT = { scene: null, cam: null, slots: [], built: false };
function buildGumVault() {
  if (!GDRUM.r && !buildGumDrum()) return false;
  const V = CONFIG.GUMS.vault, S = GVAULT.scene = new THREE.Scene();
  S.add(new THREE.HemisphereLight(0xffe8d0, 0x281a38, 0.95));
  const dl = new THREE.DirectionalLight(0xffffff, 0.75); dl.position.set(1.5, 4, 4); S.add(dl);
  const rim = new THREE.DirectionalLight(0xb060ff, 0.6); rim.position.set(-3, 2, -3); S.add(rim);
  GVAULT.cam = new THREE.PerspectiveCamera(26, V.w / V.h, 0.1, 50);
  GVAULT.cam.position.set(0, 2.9, 12.4); GVAULT.cam.lookAt(0, 2.45, 0);
  const lam = new THREE.MeshLambertMaterial({ vertexColors: true }), mb = new MeshBuilder();
  const WOOD = 0x2e1a12, WOOD2 = 0x4a2a18, GOLD = 0xe8b040, GOLD2 = 0xb8862a, INK = 0x3a1a5a, INK2 = 0x5a2a8a, SUCK = 0xd8a0e8;
  const W = 7.4, span = W / 5;
  mb.box(0, 0.2, 0, W + 0.6, 0.4, 1.8, WOOD); mb.box(0, 0.42, 0.9, W + 0.62, 0.06, 0.06, GOLD);   // base
  mb.box(0, 2.35, -0.55, W + 0.4, 3.9, 0.3, WOOD);                     // fondo
  mb.box(0, 4.35, 0, W + 0.8, 0.3, 1.9, WOOD2); mb.box(0, 4.2, 0.95, W + 0.82, 0.08, 0.08, GOLD);   // techo
  for (const s of [-1, 1]) { mb.box(s * (W / 2 + 0.25), 2.3, 0, 0.3, 3.9, 1.8, WOOD2); mb.box(s * (W / 2 + 0.25), 2.3, 0.91, 0.34, 3.9, 0.04, GOLD2); }
  for (let i = 0; i <= 5; i++) mb.box(-W / 2 + i * span, 2.3, 0.8, 0.08, 3.8, 0.08, GOLD2);   // parantes dorados
  // cartel con el pulpo, y tentáculos que bajan por los costados
  mb.box(0, 4.85, 0.3, 3.2, 0.7, 0.14, WOOD); mb.box(0, 4.85, 0.36, 3.3, 0.8, 0.04, GOLD2);
  mb.box(0, 4.9, 0.42, 0.6, 0.45, 0.1, INK2); for (const s of [-1, 1]) mb.box(s * 0.13, 4.95, 0.48, 0.1, 0.1, 0.04, 0xf0f0f0);
  for (let k = 0; k < 7; k++) mb.box(-0.5 + k * 0.17, 4.6, 0.43, 0.08, 0.22, 0.08, INK);
  for (const s of [-1, 1]) for (let i = 0; i < 16; i++) {
    const k = i / 15, a = k * 6 + (s > 0 ? 0 : Math.PI), w = 0.2 * (1 - 0.55 * k);
    mb.box(s * (W / 2 + 0.45) + Math.cos(a) * 0.12, 4.2 - k * 3.8, 0.7 + Math.sin(a) * 0.12, w, 0.24, w, i % 2 ? INK : INK2);
    if (i % 3 === 0) mb.box(s * (W / 2 + 0.45) + Math.cos(a) * 0.12 + s * w * 0.5, 4.2 - k * 3.8, 0.7, 0.04, 0.08, 0.08, SUCK);
  }
  S.add(new THREE.Mesh(mb.geometry(), lam));
  const glass = new THREE.MeshLambertMaterial({ color: 0x9a70d8, transparent: true, opacity: 0.18, depthWrite: false });
  const halo = radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  for (let i = 0; i < 5; i++) {
    const x = -W / 2 + span * (i + 0.5), g = new THREE.Group(); g.position.set(x, 0, 0.1); S.add(g);
    const pm = new MeshBuilder();
    pm.box(0, 0.6, 0, 1.0, 0.36, 1.0, WOOD2); pm.box(0, 0.8, 0, 1.06, 0.06, 1.06, GOLD2);   // pedestal
    g.add(new THREE.Mesh(pm.geometry(), lam));
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.9), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ring.position.y = 0.85; g.add(ring);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 1.0), glass); box.position.y = 1.58; g.add(box);   // la vitrina
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.56, 0.56), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x000000 }));
    cube.position.y = 1.5; g.add(cube);
    const q = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.44, 0.08), new THREE.MeshBasicMaterial({ color: 0x3a2a4a })); q.position.y = 1.5; g.add(q);   // "?"
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.y = 1.5; glow.scale.setScalar(1.3); g.add(glow);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.2, 0.9), new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.y = 2.5; g.add(beam);
    GVAULT.slots.push({ g, ring, cube, q, glow, beam, lift: 0 });
  }
  GVAULT.built = true;
  return true;
}
function gumVaultMount(host) {
  if (!host) return;
  if (!GVAULT.built && !buildGumVault()) return;
  const V = CONFIG.GUMS.vault, w = Math.max(320, Math.min(V.w, (host.clientWidth || V.w) - 4));   // al ancho del panel
  GDRUM.owner = 'vault'; GDRUM.r.setSize(w, V.h);
  GVAULT.cam.aspect = w / V.h; GVAULT.cam.position.z = 12.4 * Math.max(1, V.w / w * 0.92); GVAULT.cam.updateProjectionMatrix();
  host.appendChild(GDRUM.r.domElement);
  // lo que muestra cada vitrina: tu set (color del chicle, brillo de la rareza, gris si no tenés, "?" si está vacío)
  GVAULT.slots.forEach((s, i) => {
    const id = PROFILE.preset[i], g = id && gumDef(id), none = g && gumCount(id) <= 0, R = g && CONFIG.GUMS.rarities[g.rarity];
    s.cube.visible = !!g; s.q.visible = !g; s.glow.visible = !!g && !none;
    if (g) { s.cube.material.color.set(none ? 0x4a4a4a : g.color); s.cube.material.emissive.set(none ? 0x000000 : g.color).multiplyScalar(0.18); s.glow.material.color.set(R.color); }
    s.ring.material.color.set(g && !none ? R.color : 0x2a2230);
  });
  renderGumVault(0);
}
function renderGumVault(dt) {
  if (!GVAULT.built) return;
  const now = performance.now() / 1000;
  GVAULT.slots.forEach((s, i) => {
    const sel = GUMUI.slot === i;
    s.lift += ((sel ? 0.28 : 0) - s.lift) * Math.min(1, dt * 8);
    s.cube.position.y = 1.5 + s.lift + Math.sin(now * 2 + i) * 0.05;
    s.cube.rotation.set(now * 0.6 + i, now * (sel ? 1.6 : 0.8) + i * 1.3, 0);
    s.glow.position.y = s.cube.position.y; s.glow.scale.setScalar((sel ? 1.8 : 1.25) + Math.sin(now * 3 + i) * 0.08);
    s.beam.visible = sel; s.beam.material.opacity = 0.1 + 0.04 * Math.sin(now * 4);
  });
  GDRUM.r.render(GVAULT.scene, GVAULT.cam);
}
function renderGumDrum(dt) {
  const D = CONFIG.GUMS.drum, t = (GDRUM.t += dt), now = performance.now() / 1000;
  const spin = GDRUM.phase === 'spin';
  // velocidad del tambor: sube al girar, baja sola después
  const want = spin ? D.spinSpeed * Math.min(1, t / 0.8) : D.idleSpeed;
  GDRUM.spin += (want - GDRUM.spin) * Math.min(1, dt * 3);
  GDRUM.ang += GDRUM.spin * dt;
  GDRUM.drum.rotation.x = GDRUM.ang; GDRUM.crank.rotation.x = GDRUM.ang;
  GDRUM.root.rotation.y = -0.35 + Math.sin(now * 0.4) * 0.12;
  // los chicles adentro: quietos en el fondo o saltando con el giro (en el marco del tambor)
  const lim = D.size / 2 - D.ball * 0.7, k = Math.min(1, GDRUM.spin / D.spinSpeed);
  GDRUM.balls.forEach(m => {
    const s = m.userData.seed;
    m.position.set(Math.sin(now * (2 + k * 9) + s * 3) * lim * (0.4 + 0.6 * k), Math.cos(now * (1.7 + k * 11) + s * 5) * lim * (0.3 + 0.7 * k),
                   Math.sin(now * (2.3 + k * 8) + s * 7) * lim * (0.4 + 0.6 * k));
    m.rotation.set(now * (1 + k * 6) + s, now * (0.7 + k * 5) + s * 2, 0);
  });
  // foquitos: corren durante el giro, laten despacio quieto
  const blink = spin ? Math.floor(now * 12) % 2 : Math.floor(now * 1.5) % 2;
  GDRUM.bulbs[0].visible = blink === 0 || !spin && Math.sin(now * 3) > -0.6; GDRUM.bulbs[1].visible = blink === 1;
  // los que salen: del tambor a la boca de la canaleta, bajan, caen a la bandeja y revientan con su brillo
  GDRUM.outs.forEach((o, i) => {
    const id = GDRUM.phase === 'out' && GDRUM.won[i];
    o.g.visible = !!id && t >= D.outDelay + i * D.outEach;
    if (!o.g.visible) return;
    const g = gumDef(id), rc = CONFIG.GUMS.rarities[g.rarity].color, u = t - D.outDelay - i * D.outEach;
    o.c.material.color.set(g.color); o.halo.material.color.set(rc);
    const tx = -0.4 + i * 0.4, P = o.g.position;
    if (u < 0.25) { const q = u / 0.25; P.set(0.35 * q, 1.6 - 0.55 * q, 0.62 * q); }
    else if (u < 0.6) { const q = (u - 0.25) / 0.35; P.set(0.35, 1.05 - q * 0.42, 0.62 + q * 0.62); }
    else { const q = Math.min(1, (u - 0.6) / 0.25); P.set(0.35 + (tx - 0.35) * q, 0.63 + Math.sin(q * Math.PI) * 0.25 + 0.05, 1.24 + 0.1 * q); }
    o.c.rotation.set(u * 7, u * 5, 0);
    const pop = u > 0.85 ? Math.min(1, (u - 0.85) / 0.2) : 0;
    o.c.scale.setScalar(1 + 0.5 * Math.sin(pop * Math.PI) + 0.15 * pop);
    o.halo.scale.setScalar(0.2 + pop * (0.9 + 0.12 * Math.sin(now * 6 + i)));
    o.halo.material.opacity = pop ? 0.9 : 0;
  });
  GDRUM.r.render(GDRUM.scene, GDRUM.cam);
}
// mapas: solo la playa; los otros dos, bloqueados
function pickMap(key) {
  const card = { city: UI.mapCity, beach: UI.mapBeach, q: UI.mapQ }[key];
  if (key !== 'beach') {
    UI.menuMsg.textContent = 'Locked. Coming soon.';
    if (card) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
    return false;
  }
  MENU.map = key; UI.menuMsg.textContent = '';
  return true;
}
// (F5.19, Diego: sin las siluetas de mobs en el menú)
function setSensitivity(mult) {
  const I = CONFIG.INPUT;
  SETTINGS.sens = Math.max(I.sensMin, Math.min(I.sensMax, mult));
  UI.sensVal.textContent = SETTINGS.sens.toFixed(2) + 'x';
}
function fmtTime(s) { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function showGameOver(isNew, best) {
  UI.goRound.textContent = state.round;
  UI.goTime.textContent = fmtTime(STATS.time);
  UI.goKills.textContent = state.kills;
  UI.goHeads.textContent = STATS.headshots;
  UI.goKnife.textContent = STATS.killsBy.knife || 0;
  UI.goFav.textContent = favoriteWeapon();
  UI.goAcc.textContent = (state.shotsFired ? Math.round(state.shotsHit / state.shotsFired * 100) : 0) + '%';
  UI.goPts.textContent = STATS.pointsEarned;
  UI.goDmg.textContent = Math.round(STATS.damageTaken);
  UI.goDoors.textContent = STATS.doors + ' / ' + Object.keys(state.doors).length;
  UI.goBox.textContent = STATS.boxUses;
  UI.goBest.textContent = best;
  if (UI.goXP) UI.goXP.textContent = '+' + PROFILE.matchXP;                                   // F5.18
  if (UI.goLvl) { const L = rankLevel(); UI.goLvl.textContent = L + ' · ' + tierName(L) + (L > PROFILE.startLevel ? '  (LEVEL UP!)' : ''); }
  UI.record.textContent = isNew ? 'NEW RECORD' : '';
  if (UI.goRound2) UI.goRound2.textContent = state.round;                                   // F5.19b: resumen estilo BO3
  if (UI.goName) UI.goName.textContent = (PROFILE.name || 'PLAYER').toUpperCase();
  if (UI.goBar) { const [a, b] = levelProgress(PROFILE.xp); UI.goBar.style.width = (b ? Math.round(a / b * 100) : 100) + '%'; }
  UI.go.classList.add('show');
}
function updateHUD(dt) {
  if (state.points !== shownPts) { UI.points.textContent = state.points; shownPts = state.points; }
  if (pendingPts > 0) {                     // un popup por frame (la escopeta suma varios)
    const s = document.createElement('span');
    s.className = 'pop';
    s.textContent = '+' + pendingPts;
    UI.points.appendChild(s);
    setTimeout(() => s.remove(), 800);
    pendingPts = 0;
  }
  if (pendingSpend > 0) {
    const s = document.createElement('span');
    s.className = 'pop neg';
    s.textContent = '-' + pendingSpend;
    UI.points.appendChild(s);
    setTimeout(() => s.remove(), 800);
    pendingSpend = 0;
  }
  if (bannerT > 0) {
    bannerT -= dt;
    if (bannerT < 0.8) UI.banner.style.opacity = '0';
  }
  // F5.19c: barra de vida del modo dev (tecla X)
  if (DEV.hp && UI.devhpFill) {
    const mh = maxHealth(), h = Math.round(state.health), key = h + '/' + mh + '/' + DEV.lastHitT;
    if (key !== DEV.shown) {
      DEV.shown = key;
      UI.devhpFill.style.width = Math.max(0, Math.min(100, state.health / mh * 100)) + '%';
      UI.devhpText.textContent = h + ' / ' + mh;
      if (DEV.lastHitT) UI.devhpHit.textContent = '-' + (Math.round(DEV.lastHit * 10) / 10) + (DEV.lastSrc ? ' (' + DEV.lastSrc + ')' : '');
    }
    UI.devhpHit.style.opacity = clock.elapsedTime - DEV.lastHitT < 2.5 ? '1' : '0.35';
  }
  // viñeta de salud baja: 0 a media vida, máximo en 0 (F2: relativa a la vida máxima, Juggernog). F5.23: sangre en los
  // bordes que late con el corazón (lowHealthK/lowHealthBeat en audio.js) y respiración agitada
  // F5.28e: la sangre va por esquinas y golpes (updateHurtHUD); el latido y la respiración siguen igual
  const v = lowHealthK();
  updateHurtHUD(dt);
  updateLowHealthAudio(v);
  updateMapView(dt);                                 // F5.24: destapa el mapa alrededor tuyo
}
// F5.28e (Diego: "al presionar Empezar juego que ponga el wallpaper y espere un segundo mientras carga; al morir, negra con
// loading... abajo a la derecha, y al menú"): una pantalla de carga de `time` s. `wall` = con el wallpaper. Mientras está,
// el juego no corre (loop.js). La primera vez aprovecha para compilar los shaders de la escena (los tirones de la primera
// vez que algo aparece). onDone se llama al terminar
const LOADSCR = { on: false, t: 0, t0: 1, done: null, compiled: false };
function startLoading(time, wall, onDone) {
  const el = typeof document !== 'undefined' && document.getElementById ? document.getElementById('loadscr') : null;
  LOADSCR.on = true; LOADSCR.t = LOADSCR.t0 = Math.max(0.05, time); LOADSCR.done = onDone || null;
  if (el) { el.classList.toggle('wall', !!wall); el.classList.add('on'); const b = el.querySelector && el.querySelector('.lsbar i'); if (b) b.style.width = '0%'; }
  if (!LOADSCR.compiled && typeof renderer !== 'undefined' && renderer && renderer.compile) {
    // F5.28f (Diego: "se está trabando"): compila y sube a la GPU también lo que está oculto (los árboles en sus 3
    // detalles, las catacumbas, los pools): si no, se hacía la primera vez que aparecía, en medio del juego (tirones).
    // Se prende todo un frame debajo de la pantalla de carga y se vuelve a dejar como estaba
    const hidden = [];
    try {
      scene.traverse(o => { if (!o.visible && (o.isMesh || o.isPoints)) { hidden.push(o); o.visible = true; } });
      renderer.compile(scene, camera); renderer.compile(weaponScene, weaponCamera);
      if (renderer.render) renderer.render(scene, camera);
      LOADSCR.compiled = true;
    } catch (e) {}
    for (const o of hidden) o.visible = false;
  }
}
function updateLoading(dt) {
  if (!LOADSCR.on) return false;
  LOADSCR.t -= dt;
  const el = typeof document !== 'undefined' && document.getElementById ? document.getElementById('loadscr') : null;
  const b = el && el.querySelector && el.querySelector('.lsbar i');
  if (b) b.style.width = Math.min(100, (1 - Math.max(0, LOADSCR.t) / LOADSCR.t0) * 100).toFixed(0) + '%';
  if (LOADSCR.t > 0) return true;
  LOADSCR.on = false;
  if (el) el.classList.remove('on');
  const f = LOADSCR.done; LOADSCR.done = null;
  if (f) f();
  return false;
}
// F5.28e (Diego: "que cada golpe ponga una esquina roja, hasta todo el contorno en vida crítica, con sangre cuadriculada"):
// 4 esquinas (0 arriba-izq, 1 arriba-der, 2 abajo-izq, 3 abajo-der) y el contorno entero, cada uno un canvas chico de
// bloques (un pixel = un bloque) escalado con image-rendering: pixelated. HURT.on[i] = esquina prendida; HURT.k = fundido
const HURT = { on: [0, 0, 0, 0], k: [0, 0, 0, 0, 0], els: null };
// la sangre de una esquina (i 0..3) o del contorno (i = -1): manchas que salen del borde, más densas y oscuras cuanto
// más cerca, con ruido por bloques, gotas sueltas y chorreadas que bajan desde arriba
function pixelBlood(i) {
  const [cw, ch] = CONFIG.AUDIO.hurt.cells, edge = i < 0, W = edge ? cw * 2 : cw, H = edge ? ch * 2 : ch;
  const c = document.createElement('canvas');
  if (!c.getContext) return null;
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  if (!x || !x.createImageData) return null;
  const img = x.createImageData(W, H), d = img.data, rr = mulberry(777 + i * 31);
  const noise = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) noise[k] = rr();
  const drips = [];                                                    // chorreadas: columnas que bajan desde arriba
  for (let k = 0; k < (edge ? 14 : 5); k++) drips.push([Math.floor(rr() * W), 3 + rr() * H * 0.45]);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    let dist;                                                          // 0 en el borde/esquina, 1 lejos
    if (edge) dist = Math.min(px / W, (W - 1 - px) / W, py / H * 1.4, (H - 1 - py) / H * 1.4) * 5.2;
    else {
      const ox = i % 2 ? W - 1 - px : px, oy = i > 1 ? H - 1 - py : py;
      dist = Math.hypot(ox / W, oy / H * 0.9) * 1.25;
    }
    const n = noise[py * W + px], smooth = (noise[Math.max(0, py - 1) * W + px] + noise[py * W + Math.max(0, px - 1)] + n) / 3;
    let a = 1.15 - dist * 1.35 + (smooth - 0.5) * 0.7;
    const top = edge || i < 2;
    for (const [dx, L] of drips) if (top && Math.abs(px - dx) <= (py < L * 0.8 ? 0 : 1) && py < L) a = Math.max(a, 0.9 - py / L * 0.4);
    if (a < 0.1 && n > 0.985) a = 0.7;                                 // gotitas sueltas
    if (a <= 0.05) continue;
    a = Math.min(1, a);
    const o = (py * W + px) * 4, deep = Math.min(1, a * 1.2);
    d[o] = 60 + (1 - deep) * 60 + n * 30; d[o + 1] = 2 + n * 6; d[o + 2] = 3 + n * 5;   // rojo oscuro (más negro adentro)
    d[o + 3] = Math.round(Math.min(0.92, a) * 255);
  }
  x.putImageData(img, 0, 0);
  return c;
}
function buildHurtHUD(el) {
  if (!el || typeof document === 'undefined' || !document.createElement) return;
  try {
    el.style.background = 'none';
    const els = [];
    for (let i = -1; i < 4; i++) {
      const c = pixelBlood(i);
      if (!c) return;                                                  // sin canvas (tests): nada que dibujar
      c.className = i < 0 ? 'hedge' : 'hc hc' + i; c.style.opacity = '0';
      el.appendChild(c); els.push(c);
    }
    HURT.els = els;                                                    // [contorno, esquina 0, 1, 2, 3]
  } catch (e) { HURT.els = null; }
}
// un golpe (damagePlayer): prende la esquina libre más cercana a donde vino (de adelante, arriba; de atrás, abajo)
function hurtHit(fromX, fromZ) {
  const H = HURT;
  let right = 0, front = -1;                                           // sin dirección (la caída): abajo
  if (fromX !== undefined && fromZ !== undefined && typeof camera !== 'undefined') {
    const dx = fromX - player.pos.x, dz = fromZ - player.pos.z, L = Math.hypot(dx, dz) || 1;
    const e = camera.matrixWorld.elements;                             // columnas: x = derecha, z = atrás
    right = (dx * e[0] + dz * e[2]) / L; front = -(dx * e[8] + dz * e[10]) / L;
  }
  const want = (front >= 0 ? 0 : 2) + (right >= 0 ? 1 : 0);
  const order = [want, want ^ 1, want ^ 2, want ^ 3];                  // la de al lado, la de arriba/abajo, la opuesta
  const i = order.find(q => !H.on[q]);
  if (i !== undefined) H.on[i] = 1;
}
function updateHurtHUD(dt) {
  const H = HURT, C = CONFIG.AUDIO.hurt, mh = maxHealth();
  const alive = state.running && !state.gameOver && !DOWN.on;
  if (!alive || state.health >= mh - 0.5) H.on.fill(0);                // volviste a vida llena: se apaga
  const crit = alive && state.health < mh * (1 - CONFIG.AUDIO.lowHp.from) / 2;
  const beat = lowHealthBeat(), want = [crit ? 1 : 0, ...H.on];
  let any = 0;
  for (let k = 0; k < 5; k++) {
    const t = want[k] ? C.inT : C.outT;
    H.k[k] += (want[k] - H.k[k]) * Math.min(1, dt / Math.max(0.01, t) * 2.5);
    if (H.k[k] < 0.005) H.k[k] = 0;
    any = Math.max(any, H.k[k]);
    if (H.els) H.els[k].style.opacity = (H.k[k] * (crit ? 0.75 + 0.25 * beat : 0.9)).toFixed(2);
  }
  UI.lowhp.style.opacity = any > 0.01 ? '1' : '0';
}
let dmgT = 0;
function flashDamage() { dmgT = CONFIG.FEEL.hurtFlash; }
// F2.7: una granada llena por cada una en el bolsillo, vacías hasta el tope
// F5.24 (Diego): los slots son dibujos: una granada de fragmentación (cuerpo cuadriculado, cuchara y anillo) y el
// langostino bailarín (cuerpo, pinzas, cola en abanico y antenas). SVG en línea, sin archivos
const GREN_SVG = '<svg class="gi" viewBox="0 0 20 24"><path class="ring" d="M13 4.5a3 3 0 1 1 3.5 3"/>' +
  '<path class="spoon" d="M9 5h3l4 3.5v6.5"/><rect class="cap" x="6.5" y="4" width="6" height="3.5" rx="1"/>' +
  '<ellipse class="body" cx="9.5" cy="15" rx="6.5" ry="7.5"/>' +
  '<path class="grid" d="M3.5 12.5h12M3.2 16h12.6M4 19.5h11M7 8.2v14M12 8.2v14"/></svg>';
const LOBSTER_SVG = '<svg class="gi lb" viewBox="0 0 28 24"><path class="ant" d="M11 6C8 2 4 1 1 2M17 6c3-4 7-5 10-4"/>' +
  '<path class="body" d="M14 4c3 0 4 3 4 6s-1 6-4 6s-4-3-4-6s1-6 4-6z"/>' +
  '<path class="body" d="M10 9L5 7L2 9l2 3l4-1zM18 9l5-2l3 2l-2 3l-4-1z"/>' +
  '<path class="body" d="M12 16h4l1 3h-6zM11 19h6l3 4H8z"/><circle class="eye" cx="12.5" cy="6.5" r=".9"/><circle class="eye" cx="15.5" cy="6.5" r=".9"/></svg>';
function updateGrenadeHUD() {
  let h = '';
  for (let i = 0; i < CONFIG.GRENADE.max; i++) h += '<i' + (i < state.grenades ? '' : ' class="off"') + '>' + GREN_SVG + '</i>';
  if (MONKEY.has) for (let i = 0; i < CONFIG.MONKEY.max; i++) h += '<i class="mk' + (i < MONKEY.count ? '' : ' off') + '">' + LOBSTER_SVG + '</i>';   // F5.11
  UI.gren.innerHTML = h;
}
function updateAmmoHUD() {
  const s = curSlot(), def = curDef();
  if (!s || !def) { UI.wname.textContent = '—'; UI.wname.classList.remove('pap'); UI.wammo.textContent = '—'; return; }
  UI.wname.textContent = def.name;
  UI.wname.classList.toggle('pap', !!def.pap);          // F2b: nombre de arma mejorada en violeta
  UI.wammo.innerHTML = s.mag + ' <span class="res">/ ' + s.reserve + '</span>';
  UI.wammo.classList.toggle('low', s.mag <= Math.ceil(def.magSize * 0.25));
}
//--- GAME FEEL de UI: crosshair, hitmarker, números de daño ---
let hitmarkT = 0, crossS = 0;
function showHitmarker(color) {
  UI.hitmark.style.setProperty('--hm', color);
  hitmarkT = CONFIG.FEEL.hitmarkTime;
}
function crossPunch(px) { crossS = Math.min(CONFIG.FEEL.crossMax, crossS + px); }

const dmgNums = { pool: [], i: 0 };
function buildDmgNums() {
  for (let i = 0; i < 24; i++) {
    const el = document.createElement('div');
    el.className = 'dmgnum';
    UI.hud.appendChild(el);
    dmgNums.pool.push({ el, life: 0, x: 0, y: 0, z: 0, val: 0, head: false, zid: -1, born: -9 });
  }
}
function spawnDamageNumber(z, p, dmg, head) {
  if (SETTINGS.dmgNumbers === false) return;       // F5.11: se pueden apagar en Ajustes
  const F = CONFIG.FEEL, now = clock.elapsedTime;
  // perdigones del mismo disparo sobre el mismo zombie = un solo número
  for (const n of dmgNums.pool) {
    if (n.life > 0 && n.zid === z.id && n.head === head && now - n.born < F.dmgNumMerge) {
      n.val += dmg; n.el.textContent = Math.round(n.val); return;
    }
  }
  const n = dmgNums.pool[dmgNums.i];
  dmgNums.i = (dmgNums.i + 1) % dmgNums.pool.length;
  n.x = p.x + (Math.random() - 0.5) * 0.25; n.y = p.y + 0.1; n.z = p.z + (Math.random() - 0.5) * 0.25;
  n.life = F.dmgNumLife; n.val = dmg; n.head = head; n.zid = z.id; n.born = now;
  n.el.textContent = Math.round(dmg);
  n.el.className = head ? 'dmgnum head' : 'dmgnum';
}
const _dn = new THREE.Vector3();
function updateFeelUI(dt) {
  const F = CONFIG.FEEL;
  // crosshair: se abre y vuelve
  crossS *= Math.exp(-dt * F.crossReturn);
  UI.cross.style.setProperty('--s', crossS.toFixed(2));
  // hitmarker X: pop de escala + fade
  if (hitmarkT > 0) {
    hitmarkT = Math.max(0, hitmarkT - dt);
    const k = hitmarkT / F.hitmarkTime;
    UI.hitmark.style.opacity = k.toFixed(2);
    UI.hitmark.style.transform = 'translate(-50%,-50%) scale(' + (0.8 + 0.5 * k).toFixed(3) + ')';
  }
  // números de daño: suben en el mundo, se proyectan a pantalla
  const W = window.innerWidth, H = window.innerHeight;
  for (const n of dmgNums.pool) {
    if (n.life <= 0) continue;
    n.life -= dt;
    n.y += F.dmgNumRise * dt;
    _dn.set(n.x, n.y, n.z).project(camera);
    if (n.life <= 0 || _dn.z > 1) { n.el.style.opacity = '0'; if (n.life <= 0) n.life = 0; continue; }
    const p = 1 - n.life / F.dmgNumLife;
    const sc = p < 0.15 ? 1 + (1 - p / 0.15) * 0.6 : 1;
    n.el.style.transform = 'translate(' + ((_dn.x * 0.5 + 0.5) * W).toFixed(1) + 'px,' +
      ((-_dn.y * 0.5 + 0.5) * H).toFixed(1) + 'px) translate(-50%,-50%) scale(' + sc.toFixed(2) + ')';
    n.el.style.opacity = (n.life < 0.3 ? n.life / 0.3 : 1).toFixed(2);
  }
}
function resetFeelUI() {
  crossS = 0; hitmarkT = 0; dmgT = 0;
  UI.hitmark.style.opacity = '0';
  UI.dmg.style.opacity = '0';
  for (const n of dmgNums.pool) { n.life = 0; n.el.style.opacity = '0'; }
  puT = 0; UI.pu.style.opacity = '0'; UI.fx.innerHTML = '';
}

let fpsAcc = 0, fpsFrames = 0, fpsShown = 0;
function updateDebug(dt) {
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc >= 0.4) { fpsShown = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }
  const r = roomAt(player.pos.x, player.pos.z);
  UI.debug.textContent =
    'FPS  ' + fpsShown +
    (renderer.info ? '  DRAW ' + renderer.info.render.calls : '') +
    (THEMEFX.quality ? '\nCAL  -' + THEMEFX.quality + ' (' + QUALITY.msg + ')' : '') +
    '\nXZ   ' + player.pos.x.toFixed(1) + ' , ' + player.pos.z.toFixed(1) +
    '\nROOM ' + (r ? r.id + ' ' + r.name : 'OUTSIDE') +
    '\nHP   ' + Math.round(state.health) +
    '\nRND  ' + state.round + '  left ' + zombiesLeft() + '  ' + roundState.phase +
    '\nPREC ' + (state.shotsFired ? Math.round(state.shotsHit / state.shotsFired * 100) : 0) + '%' +
    '\nZOMB ' + zCount() +
    '\nKILL ' + state.kills;
}
function zCount() {
  const m = { flow: 0, direct: 0, recover: 0, lost: 0, unreachable: 0 };
  let alive = 0;
  for (const z of state.zombies) if (z.alive) { alive++; if (z.state === 'walk') m[z.mode]++; }
  return alive + '  f' + m.flow + ' d' + m.direct + ' r' + m.recover + ' L' + (m.lost + m.unreachable);
}

