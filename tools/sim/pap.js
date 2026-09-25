// V2 F2b: la mejora del Pack-a-Punch. Cobro, 4 s, 10 s para agarrar, stats, papName, sin re-PaP,
// munición (Max Ammo y pared a 2500), la caja no ofrece la que está adentro, manos vacías, reset.
const G = require('./harness.js');
const { state, player, CONFIG, weaponsState, PAPST } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const P = CONFIG.PAP, dt = 1 / 60;

function fresh() {
  G.resetGame(); state.running = true; G.debugOpenAllDoors();
  state.points = 99999; state.round = 1;
  Object.keys(state.generators).forEach(k => { state.generators[k] = true; });
  Object.keys(state.souls).forEach(k => { state.souls[k] = CONFIG.SOULS.need; });
  G.checkPap();
  atPap();
}
function atPap() {
  // F5.13: arriba del templo (spot.y); con rot π el frente mira a -z
  const s = P.spot, f = Math.cos(s.rot || 0) >= 0 ? 1 : -1;
  player.pos.set(s.x, (s.y || 0) + 1.7, s.z + f * (P.size.d / 2 + 0.9)); G.updateInteract();
}
function wait(secs) { for (let i = 0; i < Math.round(secs * 60); i++) { G.tick(dt); G.updateRelics(dt); G.updateWeapon(dt); } }
const prompt = () => { atPap(); return G.interactState.kind === 'pap' ? G.promptFor(G.interactState).text : '(sin cartel)'; };
const press = () => { atPap(); return G.interact(); };

// 1) nombres PaP: las 8 armas, en inglés y distintos
const names = Object.values(CONFIG.WEAPONS).map(w => w.papName), nW = Object.keys(CONFIG.WEAPONS).length;
check(names.every(n => n && /^[A-Z' ]+$/.test(n)) && new Set(names).size === nW, `${nW} papName en inglés, distintos`, `(${names.join(' · ')})`);

// 2) compra: cartel, cobro, el arma entra, manos vacías
fresh();
check(prompt() === '[F] Pack-a-Punch M1911 - ' + P.cost, 'cartel con precio', `("${prompt()}")`);
state.points = P.cost - 1;
check(!press() && PAPST.phase === 'idle' && state.weapons.length === 1, 'sin puntos no la toma');
state.points = 99999;
let pts = state.points;
check(press() && state.points === pts - P.cost && PAPST.phase === 'working', 'cobra 5000 y empieza a trabajar');
check(state.weapons.length === 0 && G.curDef() === null && weaponsState.model === null, 'única arma adentro: manos vacías');
check(prompt() === 'Pack-a-Punch working...' && !press(), 'trabajando: cartel y F no hace nada');
G.meleeState.lastAttack = -1e9; G.meleeAttack();
wait(0.6);
check(weaponsState.phase === 'idle', 'con las manos vacías el cuchillo funciona y vuelve a idle');
// 3) 4 s y sale
wait(P.time - 0.6 - 0.1);
check(PAPST.phase === 'working', 'a los 3.9 s sigue trabajando');
wait(0.15);
check(PAPST.phase === 'ready' && PAPST.display.m1911.visible, 'a los 4 s sale, con el arma en la bandeja');
check(prompt() === '[F] Take ' + CONFIG.WEAPONS.m1911.papName, 'cartel para agarrarla');
pts = state.points;
check(press() && state.points === pts, 'F la agarra (gratis)');
const s = G.curSlot(), d = G.curDef(), b = CONFIG.WEAPONS.m1911;
check(s.pap && d.pap && d.name === 'GRAVE WHISPER', 'queda mejorada: GRAVE WHISPER');
check(d.damage === b.damage * 2 && d.magSize === Math.ceil(b.magSize * 1.5) && d.reserveMax === Math.ceil(b.reserveMax * 1.5),
  'daño ×2, cargador y reserva ×1.5', `(${d.damage} · ${d.magSize} / ${d.reserveMax})`);
check(s.mag === d.magSize && s.reserve === d.reserveMax, 'sale llena');
check(b.damage === 40 && !b.pap, 'CONFIG.WEAPONS no se tocó');
let camo = 0; weaponsState.model.traverse(o => { if (o.isMesh && o.material.emissive && o.material.emissive.getHex() === 0x3a1a5a) camo++; });
check(camo > 0, 'modelo con camo');
check(PAPST.phase === 'idle' && Object.values(PAPST.display).every(m => !m.visible), 'la máquina queda libre');
// 4) sin re-PaP
pts = state.points;
check(prompt() === 'GRAVE WHISPER - already upgraded' && !press() && state.points === pts, 'sin re-PaP: no cobra');

// 5) daño real ×2 contra un zombie
function dmgPerShot() {
  for (const q of state.zombies.slice()) { q.active = false; q.alive = false; q.root.visible = false; }
  state.zombies.length = 0;
  player.pos.set(0, 1.7, 10); G.setCam(0); G.updateFlowField(true);
  const q = G.spawnZombie(); q.state = 'walk'; q.px = 0; q.pz = 7; q.health = 1e6;
  G.placeRoot(q, 0); G.scene.updateMatrixWorld(true);
  weaponsState.phase = 'idle'; weaponsState.lastShot = -1e9; G.curSlot().mag = 5;
  G.fireWeapon();
  return 1e6 - q.health;
}
const dPap = dmgPerShot();
G.curSlot().pap = false; const dBase = dmgPerShot(); G.curSlot().pap = true;
check(dBase > 0 && dPap === dBase * 2, 'un disparo pega el doble', `(${dBase} -> ${dPap})`);

// 6) munición: Max Ammo llena la reserva mejorada; en la pared cuesta 2500
fresh(); press(); wait(P.time + 0.1); press();
G.curSlot().mag = 1; G.curSlot().reserve = 0;
G.applyPowerup('maxammo');
check(G.curSlot().mag === 12 && G.curSlot().reserve === 120, 'Max Ammo llena 12 / 120 (no 8 / 80)');
fresh(); G.giveWeapon('smg'); press(); wait(P.time + 0.1); press();
const smg = G.curSlot(); smg.reserve = 10;
const wb = G.WALLBUYS.find(w => w.weapon === 'smg');
player.pos.set(wb.mx - 1.2, 1.7, wb.mz); G.updateInteract();
check(G.promptFor(G.interactState).text === '[F] Ammo HIVEMIND - ' + P.ammoCost, 'pared: munición de la mejorada a 2500', `("${G.promptFor(G.interactState).text}")`);
pts = state.points;
check(G.interact() && state.points === pts - P.ammoCost && smg.reserve === Math.ceil(160 * 1.5), 'cobra 2500 y llena 240');

// 7) con dos armas: te quedás con la otra; la de la pared no se duplica
fresh(); G.giveWeapon('smg');
check(G.curSlot().id === 'smg' && press(), 'con SMG equipado');
check(state.weapons.length === 1 && G.curDef().id === 'm1911' && weaponsState.model !== null, 'mientras trabaja, en la mano queda la M1911');
state.round = 2;
let offered = 0;
for (let i = 0; i < 400; i++) if (G.rollBoxResult() === 'smg') offered++;
check(offered === 0, 'la caja no ofrece la que está en la máquina');
G.buyWallWeapon(G.WALLBUYS.find(w => w.weapon === 'smg'));   // se compra otra SMG mientras tanto
wait(P.time + 0.1); press();
check(state.weapons.filter(w => w.id === 'smg').length === 1 && state.weapons.find(w => w.id === 'smg').pap, 'al agarrarla, reemplaza a la comprada: una sola, mejorada');

// 8) 10 s para agarrarla: si no, se pierde
fresh(); press();
wait(P.time + P.grabTime - 0.2);
check(PAPST.phase === 'ready', 'a los 9.8 s de salir sigue disponible');
wait(0.3);
check(PAPST.phase === 'idle' && state.weapons.length === 0 && Object.values(PAPST.display).every(m => !m.visible), 'a los 10 s se pierde');

// 9) las demás armas: daño de área (Ray Gun) y dps (lanzallamas) también ×2
check(G.papDef('raygun').damage === 1000 && G.papDef('flamethrower').dps === 80 && G.papDef('shotgun').damage === 50, 'Ray Gun 1000, lanzallamas 80/s, escopeta 50 por perdigón');

// 10) reset
fresh(); press();
G.resetGame();
check(PAPST.phase === 'idle' && !PAPST.slot && state.weapons.length === 1 && !state.weapons[0].pap, 'resetGame: máquina vacía, M1911 normal');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
