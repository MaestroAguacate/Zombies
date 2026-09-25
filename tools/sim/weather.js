// V2 F5.9: el cielo por ronda. Se oscurece de R1 a R15, truenos R15-R20 y R25+, neblina morada R21+ (y la
// niebla del boss la respeta), lluvia R25+ y en rondas de mobs; la lluvia no crea objetos y frena en los techos.
const G = require('./harness.js');
const { state, player, CONFIG, NIGHT, RAIN, WORLD, roundState } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const W = CONFIG.WEATHER, dt = 1 / 60;
function settle(s) { for (let i = 0; i < Math.round(s * 60); i++) { G.tick(dt); G.updateNight(dt); G.updateBoss(dt); } }
function fresh() { G.resetGame(); state.running = true; roundState.phase = 'active'; player.pos.set(0, 1.7, -10); }

fresh(); settle(0.1);
const hemiDay = WORLD.hemi.intensity, fogFar0 = G.scene.fog.far;
// 1) oscuridad gradual
const ks = [1, 5, 10, 15, 20].map(W.darkBy);
check(ks[0] === 0 && ks[1] > 0 && ks[2] > ks[1] && ks[3] === 1 && ks[4] === 1, 'se oscurece de a poco: R1 día, R15 noche', ks.map(k => k.toFixed(2)).join(' '));
G.setSky(8, false); settle(4);
check(Math.abs(NIGHT.k - W.darkBy(8)) < 1e-9 && WORLD.hemi.intensity < hemiDay, 'R8: medio oscuro', `(k ${NIGHT.k.toFixed(2)})`);
check(!NIGHT.storm && !NIGHT.rain && NIGHT.p === 0, 'R8: sin truenos, lluvia ni neblina');
// 2) truenos
const storm = n => { G.setSky(n, false); return NIGHT.storm; };
check(storm(15) && storm(20) && !storm(21) && !storm(24) && storm(25) && storm(40), 'truenos: R15-R20 y R25+');
fresh(); G.setSky(16, false);
function countFlashes(s) {                                       // relámpagos nuevos (la fuerza sube de golpe)
  let n = 0, prev = NIGHT.flash;
  for (let i = 0; i < Math.round(s * 60); i++) { G.tick(dt); G.updateNight(dt); if (NIGHT.flash > prev) n++; prev = NIGHT.flash; }
  return n;
}
let flashes = countFlashes(40);
check(flashes >= 2 && flashes <= 6, 'R16: un trueno cada ' + W.thunderEvery.join('-') + ' s', `(${flashes} en 40 s)`);
fresh(); G.setSky(8, true);
check(NIGHT.target === 1 && NIGHT.rain && NIGHT.storm === 'mob', 'ronda de mobs: noche, lluvia y tormenta');
flashes = countFlashes(40);
check(flashes >= 6, 'ronda de mobs: rayos más seguidos', `(${flashes} en 40 s)`);
// 3) neblina morada: color y distancia; el boss la cierra y al morir vuelve a la morada
fresh(); G.setSky(22, false); settle(6);
check(NIGHT.p === 1 && Math.abs(G.scene.fog.far - W.purple.fogFar) < 1e-6, 'R21+: neblina morada (se acerca a ' + W.purple.fogFar + ' m)', `(${G.scene.fog.far.toFixed(1)})`);
const fc = G.scene.fog.color;
check(fc.b > fc.g && fc.r > fc.g, 'y es morada', `(#${fc.getHexString()})`);
check(!G.setSky(21, false) && !NIGHT.rain && !NIGHT.storm, 'R21: sin lluvia ni truenos');
// 4) lluvia: R25+, no crea objetos, gotas alrededor, frenan en el techo
fresh(); settle(0.1);
const kids = G.scene.children.length;
G.setSky(26, false); player.pos.set(0, 1.7, 10);                // en la sala: arriba hay techo
check(NIGHT.rain && NIGHT.p === 0 && NIGHT.storm, 'R25+: lluvia, truenos y (de a poco) neblina morada');
settle(2);
check(RAIN.lines.visible && G.scene.children.length === kids, 'llueve sin crear objetos');
let under = 0, bad = 0;
for (let i = 0; i < RAIN.n; i++) {
  const x = RAIN.pos[i * 6], y = RAIN.pos[i * 6 + 1], z = RAIN.pos[i * 6 + 2];
  if (G.roofAt(x, z)) { under++; if (y < G.UP.y - 0.5) bad++; }
}
check(under > 20 && bad === 0, 'adentro no llueve: las gotas frenan en el techo', `(${under} sobre techo, ${bad} debajo)`);
G.resetGame(); settle(0.1);
check(!RAIN.lines.visible && NIGHT.p === 0 && NIGHT.k === 0 && !NIGHT.storm && Math.abs(G.scene.fog.far - fogFar0) < 1e-6, 'resetGame: de día, sin lluvia ni neblina');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
