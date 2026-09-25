// P5: prompt [F], compra de puertas, armas de pared, recompra de munición, reemplazo de arma, reset.
const G = require('./harness.js');
const { state, player, CONFIG, feel, weaponsState } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const at = (x, z) => { player.pos.set(x, 1.7, z); G.updateInteract(); return G.interactState; };
const settle = () => { for (let i = 0; i < 60; i++) { G.tick(1 / 60); G.updateWeapon(1 / 60); } };
const wb = id => G.WALLBUYS.find(w => w.weapon === id);

G.resetGame(); state.running = true; G.setCam(0);

// 1) puerta D1
check(at(0, 0).kind === null, 'spawn: D1 a 4m no muestra prompt');
let it = at(0, 1.5);
check(it.kind === 'door' && it.target.id === 'D1', 'D1 a 2.5m → prompt');
check(G.promptFor(it).text === '[F] Abrir puerta - 750', 'texto del prompt', `("${G.promptFor(it).text}")`);
state.points = 700;
check(G.interact() === false && !state.doors.D1.open && state.points === 700, 'sin puntos: no abre ni cobra');
state.points = 800;
check(G.interact() === true && state.doors.D1.open && state.points === 50, 'compra D1 por 750');
check(!state.doors.D1.collider.solid && G.isNav(0, 4), 'collider libre y hueco navegable');
it = at(0, 1.5);
check(!(it.kind === 'door' && it.target.id === 'D1'), 'puerta abierta ya no da prompt');

// 2) doble puntos no toca los gastos
state.effects.doublePoints = 30; state.points = 1000;
at(6.5, 9);
check(G.interactState.target && G.interactState.target.id === 'D2', 'D2 desde la sala');
G.interact();
check(state.doors.D2.open && state.points === 0, 'doble puntos no duplica el gasto', `(${state.points})`);
state.effects.doublePoints = 0;

// 3) wall buys alcanzables: hay una celda navegable a menos de interactRange-0.5 de cada uno
G.debugOpenAllDoors();
for (const w of G.WALLBUYS) {
  check(G.roomAt(w.mx, w.mz) && G.roomAt(w.mx, w.mz).id === w.room, `${w.weapon}: montado dentro de ${w.room}`);
  let best = 99;
  for (let x = Math.floor(w.mx) - 4; x <= Math.floor(w.mx) + 4; x++)
    for (let z = Math.floor(w.mz) - 4; z <= Math.floor(w.mz) + 4; z++)
      if (G.isNav(x, z)) best = Math.min(best, Math.hypot(x + 0.5 - w.mx, z + 0.5 - w.mz));
  check(best < CONFIG.ECONOMY.interactRange - 0.5, `${w.weapon}: alcanzable`, `(celda a ${best.toFixed(2)}m)`);
}

// 4) escopeta en R2
const sg = wb('shotgun');
it = at(sg.mx + 1.2, sg.mz);
check(it.kind === 'wall' && it.target === sg, 'prompt escopeta');
check(G.promptFor(it).text === '[F] Comprar ESCOPETA - 1200', 'texto compra', `("${G.promptFor(it).text}")`);
check(at(-8.6, 11).kind === null, 'fuera del cuarto no hay prompt aunque esté cerca');
at(sg.mx + 1.2, sg.mz);
state.points = 1000;
check(G.interact() === false && state.weapons.length === 1, 'sin puntos no compra');
state.points = 1300;
check(G.interact() === true && state.points === 100, 'compra escopeta 1200');
check(state.weapons.length === 2 && state.weapons[state.currentWeapon].id === 'shotgun', 'queda equipada en el slot 2');
check(weaponsState.phase === 'switching', 'animación de subida');
settle();
check(weaponsState.phase === 'idle', 'vuelve a idle');

// 5) recompra de munición
const slot = state.weapons.find(w => w.id === 'shotgun');
state.points = 1000;
check(G.promptFor(G.interactState).text === 'ESCOPETA - munición llena', 'prompt munición llena');
check(G.interact() === false && state.points === 1000, 'munición llena: no cobra');
slot.reserve = 10; state.points = 400;
check(G.promptFor(G.interactState).text === '[F] Munición ESCOPETA - 500', 'prompt recompra');
check(G.interact() === false && slot.reserve === 10, 'recompra sin puntos');
state.points = 600;
check(G.interact() === true && slot.reserve === CONFIG.WEAPONS.shotgun.reserveMax && state.points === 100, 'recompra llena reserva por 500');
check(state.weapons.length === 2, 'recompra no agrega slot');

// 6) tercera arma reemplaza la equipada
const smg = wb('smg');
at(smg.mx - 1.2, smg.mz); state.points = 1500;
G.interact(); settle();
check(state.weapons.map(w => w.id).join() === 'm1911,smg', 'SMG reemplaza escopeta equipada', `(${state.weapons.map(w => w.id)})`);
state.currentWeapon = 0;
const rf = wb('rifle');
at(rf.mx + (rf.axis === 'z' ? 0 : rf.face * 1.2), rf.mz + (rf.axis === 'z' ? rf.face * 1.2 : 0)); state.points = 2000;   // F5.16: el rifle está en el rancho
G.interact(); settle();
check(state.weapons.map(w => w.id).join() === 'rifle,smg' && state.currentWeapon === 0, 'rifle reemplaza M1911 equipada');

// 7) compra durante recarga: la recarga se cancela, no transfiere al arma nueva
state.currentWeapon = 1;
state.weapons[1].mag = 5;
weaponsState.phase = 'reloading'; weaponsState.phaseT = 0;
const lm = wb('lmg');
at(lm.mx + 1.2, lm.mz); state.points = 2500;
G.interact();
check(weaponsState.phase === 'switching', 'recarga cancelada');
settle(); settle();
const lslot = state.weapons[state.currentWeapon];
check(lslot.id === 'lmg' && lslot.mag === 100 && lslot.reserve === 300, 'LMG llena, sin transferencia fantasma', `(${lslot.mag}/${lslot.reserve})`);

// 8) automática: cadencia y retroceso/shake por arma
const L = CONFIG.WEAPONS.lmg;
G.tick(1); G.setCam(0);
G.fireWeapon(); G.fireWeapon();
check(lslot.mag === 99, 'dos disparos en el mismo instante = uno');
G.tick(L.fireRate / 1000 + 0.001); G.fireWeapon();
check(lslot.mag === 98, 'segundo disparo tras fireRate');
['recoilP', 'recoilY'].forEach(k => { feel[k].x = 0; feel[k].v = 0; }); feel.trauma = 0;
G.feelOnFire(L);
check(Math.abs(feel.trauma - L.fireShake) < 1e-9, 'fireShake por arma', `(${feel.trauma})`);
const dt = 1 / 240; let peak = 0, atRet = 0;
for (let t = dt; t <= L.recoilReturn + 1e-9; t += dt) { G.tick(dt); G.updateCameraFeel(dt); peak = Math.max(peak, feel.recoilP.x); atRet = feel.recoilP.x; }
const want = CONFIG.FEEL.recoilPitch * L.recoil;
check(Math.abs(peak - want) / want < 0.1, 'pico de retroceso exacto con ω del arma', `(${peak.toFixed(4)} vs ${want.toFixed(4)})`);
check(atRet / peak < 0.06, 'vuelve en recoilReturn del arma', `(${(atRet / peak * 100).toFixed(1)}%)`);
check(G.recoilReturnOf(CONFIG.WEAPONS.m1911) === CONFIG.FEEL.recoilReturn, 'M1911 usa el global');

// 9) reset
G.resetGame();
check(G.interactState.kind === null && state.weapons.length === 1 && state.weapons[0].id === 'm1911', 'reset: inventario y prompt');
check(Object.values(state.doors).every(d => !d.open), 'reset: puertas cerradas');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
