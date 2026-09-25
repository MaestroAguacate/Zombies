// V2 F2: stamina del sprint. 4 s llena, recarga en 3 s, no vuelve a correr hasta 30%, Stamin-Up.
const G = require('./harness.js');
const { state, player, CONFIG, keys, stamina } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const ST = CONFIG.STAMINA, P = CONFIG.PLAYER, dt = 1 / 60;

// corre por la playa hacia +x (38 m de largo) y mide cuándo deja de correr
function sprintRun(secs, sample) {
  player.pos.set(-19, 1.7, -14); player.vel.set(0, 0, 0); player.yaw = -Math.PI / 2; player.grounded = true;
  keys.KeyW = true; keys.ShiftLeft = true;
  for (let i = 0; i < secs * 60; i++) { G.tick(dt); G.updatePlayer(dt); if (sample) sample(i / 60); }
  keys.KeyW = false; keys.ShiftLeft = false;
}
function fresh() { G.resetGame(); state.running = true; G.debugOpenAllDoors(); }

// 1) 4 s de sprint y después camina
fresh();
let endT = -1, vMax = 0, at2 = 0;
sprintRun(5, t => {
  vMax = Math.max(vMax, player.speedNow);
  if (Math.abs(t - 2) < dt / 2) at2 = stamina.v;
  if (endT < 0 && stamina.exhausted) endT = t;
});
check(Math.abs(vMax - P.sprint) < 0.01, 'corre a 7.0', `(${vMax.toFixed(2)})`);
check(Math.abs(at2 - 0.5) < 0.02, 'a los 2 s queda la mitad', `(${at2.toFixed(2)})`);
check(Math.abs(endT - ST.sprintTime) < 0.05, 'se vacía a los 4 s', `(${endT.toFixed(2)} s)`);
check(player.speedNow <= P.speed + 1e-6, 'vacía: camina a 4.4 aunque siga con Shift', `(${player.speedNow.toFixed(2)})`);

// 2) no vuelve a correr hasta el 30%; recarga completa en 3 s (+0.3 de espera)
// medido desde que se vacía, con Shift apretado todo el tiempo
fresh();
let canT = -1, fullT = -1, t = 0;
endT = -1;
sprintRun(7, tt => {
  if (endT < 0 && stamina.exhausted) endT = tt;
  else if (endT >= 0 && canT < 0 && !stamina.exhausted) canT = tt - endT;
});
check(Math.abs(canT - (ST.delay + ST.minToSprint * ST.rechargeTime)) < 0.05, 'vuelve a poder correr al 30% (0.3 s + 0.9 s)', `(${canT.toFixed(2)} s)`);
fresh(); stamina.v = 0; stamina.exhausted = true; t = 0;
while (t < 6 && fullT < 0) { G.tick(dt); G.updatePlayer(dt); t += dt; if (stamina.v >= 1) fullT = t; }
check(Math.abs(fullT - (ST.delay + ST.rechargeTime)) < 0.05, 'recarga completa en 3 s (tras 0.3 s de espera)', `(${fullT.toFixed(2)} s)`);
// soltar Shift a mitad: no se vacía, recarga desde donde quedó
fresh();
sprintRun(1);
const v1 = stamina.v;
for (let i = 0; i < 60; i++) { G.tick(dt); G.updatePlayer(dt); }
check(v1 < 1 && stamina.v > v1 && !stamina.exhausted, 'soltar Shift a mitad: recarga desde donde quedó', `(${v1.toFixed(2)} -> ${stamina.v.toFixed(2)})`);

// 3) Stamin-Up: 8 s y 8.4 m/s
fresh(); for (const k of G.GEN_KEYS) state.generators[k] = true; G.turnOnPower(); state.points = 99999;   // F5.6: pide los 4 generadores
state.perks.push('stamin');
endT = -1; vMax = 0;
sprintRun(9, tt => { vMax = Math.max(vMax, player.speedNow); if (endT < 0 && stamina.exhausted) endT = tt; });
check(Math.abs(vMax - P.sprint * CONFIG.PERKS.staminSpeed) < 0.02, 'Stamin-Up: sprint ×1.2 (8.4)', `(${vMax.toFixed(2)})`);
check(Math.abs(endT - ST.sprintTime * CONFIG.PERKS.staminTime) < 0.05, 'Stamin-Up: stamina ×2 (8 s)', `(${endT.toFixed(2)} s)`);

// 4) reset
stamina.v = 0.2; stamina.exhausted = true;
G.resetGame();
check(stamina.v === 1 && !stamina.exhausted, 'resetGame: stamina llena');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
