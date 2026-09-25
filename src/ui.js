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
  UI.dmgNums = document.getElementById('dmgNums');  // F5.11: ajuste "números de daño"
  UI.ink = document.getElementById('ink');          // F5.9: tinta de calamar
  UI.fade = document.getElementById('fade');        // F5.11: fundido de la escotilla
  UI.go = document.getElementById('gameover');
  UI.goRound = document.getElementById('goRound');
  UI.goKills = document.getElementById('goKills');
  UI.goAcc = document.getElementById('goAcc');
  ['goTime', 'goHeads', 'goKnife', 'goFav', 'goPts', 'goDmg', 'goDoors', 'goBox', 'btnGoMenu', 'btnPlay', 'btnControls',
   'btnSettings', 'btnQuit', 'panelControls', 'panelSettings', 'sens', 'sensVal', 'vol', 'volVal', 'menuMsg']
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
  if (it.kind === 'door' && it.target.power) return { text: 'Portón - se abre con la energía', cost: 0 };   // F5.7
  if (it.kind === 'door' && it.target.burning) return { text: 'El cerco se está quemando...', cost: 0 };   // F5.12
  if (it.kind === 'door' && it.target.burn) return { text: '[F] Quemar el cerco - ' + it.target.cost, cost: it.target.cost };
  if (it.kind === 'door') return { text: '[F] Abrir puerta - ' + it.target.cost, cost: it.target.cost };
  if (it.kind === 'gen') return { text: 'Generador apagado - [V] golpealo con el cuchillo', cost: 0 };
  if (it.kind === 'perk') { const st = perkStatus(it.target.key); return { text: st.text, cost: st.cost }; }
  if (it.kind === 'power') {                                        // F5.6: pide los 4 generadores
    const n = powerMissing();
    return { text: n ? 'Energía - ' + (n === 1 ? 'falta 1 generador' : 'faltan ' + n + ' generadores') : '[F] Encender la energía', cost: 0 };
  }
  if (it.kind === 'part') return { text: '[F] Recoger ' + CONFIG.SHIELD.parts[it.target.key].name, cost: 0 };
  if (it.kind === 'bench') return benchPrompt();
  if (it.kind === 'qpiece') return { text: '[F] Recoger ' + it.target.name, cost: 0 };   // F5.5
  if (it.kind === 'workshop') return workshopPrompt();
  if (it.kind === 'trap') return trapPrompt(it.target);   // F5.9
  if (it.kind === 'hatch') return hatchPrompt(it.target); // F5.11
  if (it.kind === 'portal') return portalPrompt(it.target); // F5.16
  if (it.kind === 'fumigator' || it.kind === 'clam') return clamPrompt(it);   // F5.14
  if (it.kind === 'pap') return papPrompt();
  if (it.kind === 'box') {
    if (BOX.phase === 'ready') return { text: '[F] Agarrar ' + (BOX.result === 'monkey' ? CONFIG.MONKEY.name : CONFIG.WEAPONS[BOX.result].name), cost: 0 };
    return { text: '[F] Mystery Box - ' + CONFIG.BOX.cost, cost: CONFIG.BOX.cost };
  }
  const wb = it.target;
  if (wb.weapon === 'machete') return state.machete ? { text: 'MACHETE - ya lo tenés', cost: 0 }
                                                     : { text: '[F] Comprar MACHETE - ' + wb.cost, cost: wb.cost };
  const owned = state.weapons.find(w => w.id === wb.weapon);
  if (!owned) return { text: '[F] Comprar ' + CONFIG.WEAPONS[wb.weapon].name + ' - ' + wb.cost, cost: wb.cost };
  const def = slotDef(owned), ac = ammoCostOf(owned);            // F2b: mejorada = su nombre y munición a 2500
  if (owned.reserve >= def.reserveMax) return { text: def.name + ' - munición llena', cost: 0 };
  return { text: '[F] Munición ' + def.name + ' - ' + ac, cost: ac };
}
function updatePromptUI(dt) {
  const it = interactState;
  let text = '', poor = false;
  if (it.kind && state.running) {
    const p = promptFor(it);
    text = p.text; poor = state.points < p.cost;
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
  const parts = [];
  if (state.effects.instakill > 0) parts.push('<b style="color:#ff5a4d">UN GOLPE</b> ' + Math.ceil(state.effects.instakill) + 's');
  if (state.effects.doublePoints > 0) parts.push('<b style="color:#5ab0ff">x2 PUNTOS</b> ' + Math.ceil(state.effects.doublePoints) + 's');
  UI.fx.innerHTML = parts.join('<br>');
}

//--- HUD de partida ---
let pendingPts = 0, pendingSpend = 0, shownPts = -1, bannerT = 0;
function showSpend(cost) { pendingSpend += cost; }
function resetHUD() {
  pendingPts = 0; pendingSpend = 0; shownPts = -1; bannerT = 0;
  UI.banner.style.opacity = '0';
  UI.go.classList.remove('show');
  UI.round.textContent = '';
  UI.best.textContent = 'Récord: ronda ' + loadHighScore();
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
  UI.round.classList.remove('flash');
  void UI.round.offsetWidth;               // reinicia la animación CSS
  UI.round.classList.add('flash');
}
function showBanner(text, secs) {
  UI.banner.textContent = text;
  UI.banner.classList.toggle('long', text.length > 14);   // F4: el del Chicharito no entra con la letra grande
  UI.banner.style.opacity = '1';
  bannerT = secs;
}
//--- menú de inicio y pausa: el mismo overlay (#start) con data-mode main | pause ---
// Esc lo maneja el navegador (suelta el pointer lock); pointerlockchange decide qué mostrar.
const MENU = { started: false };
function showMenu(mode) {                  // 'main' | 'pause' | null (ocultar)
  if (!mode) { UI.start.classList.add('hidden'); return; }
  UI.start.setAttribute('data-mode', mode);
  UI.btnPlay.textContent = mode === 'pause' ? 'CONTINUAR' : 'JUGAR';
  UI.best.textContent = 'Récord: ronda ' + loadHighScore();
  UI.start.classList.remove('hidden');
}
function menuPanel(which) {                // abre uno, cierra el otro; clic de nuevo = cerrar
  const c = UI.panelControls.classList, s = UI.panelSettings.classList;
  const openC = which === 'controls' && !c.contains('open'), openS = which === 'settings' && !s.contains('open');
  c.toggle('open', openC); s.toggle('open', openS);
}
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
  UI.record.textContent = isNew ? 'NUEVO RÉCORD' : '';
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
  // viñeta de salud baja: 0 a media vida, máximo en 0, con pulso (F2: relativa a la vida máxima, Juggernog)
  const hp = state.health, half = maxHealth() / 2;
  let v = hp < half ? (half - hp) / half : 0;
  if (v > 0) v *= 0.8 + 0.2 * Math.sin(clock.elapsedTime * 6);
  UI.lowhp.style.opacity = v.toFixed(2);
}
let dmgT = 0;
function flashDamage() { dmgT = CONFIG.FEEL.hurtFlash; }
// F2.7: una granada llena por cada una en el bolsillo, vacías hasta el tope
function updateGrenadeHUD() {
  let h = '';
  for (let i = 0; i < CONFIG.GRENADE.max; i++) h += i < state.grenades ? '<i></i>' : '<i class="off"></i>';
  if (MONKEY.has) for (let i = 0; i < CONFIG.MONKEY.max; i++) h += i < MONKEY.count ? '<i class="mk"></i>' : '<i class="mk off"></i>';   // F5.11
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
    '\nSALA ' + (r ? r.id + ' ' + r.name : 'FUERA') +
    '\nHP   ' + Math.round(state.health) +
    '\nRND  ' + state.round + '  quedan ' + zombiesLeft() + '  ' + roundState.phase +
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

