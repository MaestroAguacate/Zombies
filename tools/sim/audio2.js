// V2 F6: audio. Con un AudioContext FALSO (con y sin PannerNode): audio 3D (HRTF adelante/atrás, estéreo de
// respaldo), superficie de los pasos, pasos del jugador y de los zombies (con tope), música (agenda, bpm,
// tema del boss, intensidad, bajada con gruñidos y zombies cerca, pausa), tambor de ronda, ambiente por zona,
// volúmenes separados y que nada queda sonando (sin fugas).
const G = require('./harness.js');
const { state, player, CONFIG, AUDIO, MUSIC, FOOT, roundState } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const A = CONFIG.AUDIO;

const log = { nodes: [], started: [] };
function param(v) {
  return { value: v, target: undefined, setValueAtTime(x) { this.value = x; }, exponentialRampToValueAtTime() {},
           linearRampToValueAtTime() {}, setTargetAtTime(x) { this.target = x; } };
}
function node(kind, extra) { const n = Object.assign({ kind, connect(d) { return d; }, disconnect() {} }, extra); log.nodes.push(n); return n; }
function src(kind, extra) {
  return node(kind, Object.assign({ started: false, stopped: false, loop: false, t0: 0,
    start(t) { this.started = true; this.t0 = t || 0; log.started.push(this); }, stop() { this.stopped = true; } }, extra));
}
let withPanner = true;
class FakeAC {
  constructor() { this.sampleRate = 8000; this.currentTime = 0; this.state = 'running'; this.destination = {}; }
  resume() {}
  createGain() { return node('gain', { gain: param(1) }); }
  createDynamicsCompressor() { return node('comp', {}); }
  createBiquadFilter() { return node('filter', { type: '', frequency: param(350), Q: param(1) }); }
  createStereoPanner() { return node('pan', { pan: param(0) }); }
  createOscillator() { return src('osc', { type: 'sine', frequency: param(440) }); }
  createBufferSource() { return src('buf', { buffer: null }); }
  createBuffer(ch, len) { const d = new Float32Array(len); return { length: len, getChannelData: () => d }; }
}
FakeAC.prototype.createPanner = function () {
  if (!withPanner) return undefined;
  return node('panner', { panningModel: '', positionX: param(0), positionY: param(0), positionZ: param(0) });
};
const leaks = () => log.started.filter(s => !s.loop && !s.stopped && !s.isLfo).length;
const count = kind => log.nodes.filter(n => n.kind === kind).length;

G.resetGame(); state.running = true; G.debugOpenAllDoors(); G.setCam(0);
G.sandbox.window.AudioContext = FakeAC;
G.initAudio();
const ctx = AUDIO.ctx;
log.started.forEach(s => { if (s.kind === 'osc') s.isLfo = true; });
check(AUDIO.music && AUDIO.wind && AUDIO.bugs, 'buses: música, viento y bichos');

// 1) audio 3D
function growlAt(x, z) {
  const q = G.spawnZombie(); q.state = 'walk'; q.px = x; q.pz = z; q.level = 0;
  G.sfxGrowl(q, 'idle');
  q.active = q.alive = false; state.zombies.length = 0;
}
player.pos.set(0, 1.7, 10); G.setCam(0);                               // mira hacia -z
growlAt(0, 5);
let p = log.nodes.filter(n => n.kind === 'panner').pop();
check(p && p.panningModel === 'HRTF' && p.positionZ.value < -3, 'HRTF: el de adelante suena adelante', p ? `(z ${p.positionZ.value.toFixed(1)})` : '');
growlAt(0, 15);
p = log.nodes.filter(n => n.kind === 'panner').pop();
check(p.positionZ.value > 3 && Math.abs(p.positionX.value) < 0.01, 'el de atrás suena atrás (se oye a la espalda)', `(z ${p.positionZ.value.toFixed(1)})`);
growlAt(4, 10);
p = log.nodes.filter(n => n.kind === 'panner').pop();
check(p.positionX.value > 3, 'el de la derecha, a la derecha');
G.setCam(Math.PI / 2);                                                 // girado 90° a la izquierda: mira hacia -x
growlAt(-5, 10);
p = log.nodes.filter(n => n.kind === 'panner').pop();
check(p.positionZ.value < -3, 'girando la cabeza, el sonido gira', `(z ${p.positionZ.value.toFixed(1)})`);
G.setCam(0);
const mkPanner = FakeAC.prototype.createPanner;
delete FakeAC.prototype.createPanner;                                  // navegador sin PannerNode
growlAt(0, 15);
const lps = log.nodes.filter(n => n.kind === 'filter' && n.type === 'lowpass');
check(lps[lps.length - 1].frequency.value === 2200, 'sin PannerNode: estéreo, y de atrás más apagado');
FakeAC.prototype.createPanner = mkPanner;

// 2) superficies
const S = (x, z, feet) => G.surfaceAt(x, z, feet || 0);
const cases = [[0, 0, 0, 'wood'], [0, 10, 0, 'wood'], [12, 8, 0, 'tile'], [-10, 24, 0, 'conc'], [0, -15, 0, 'sand'],
  [-15, 5, 0, 'grass'], [10, 35, 0, 'grass'], [25, 14, -1.6, 'water'], [6, -19.5, 0, 'water'], [11, 17, 4.3, 'wood'],
  [80, 85, 4.3, 'stone'], [73.5, 90, 2, 'stone'], [-24, -80, -8, 'conc'], [30, 8, 0, 'tile'], [0, -35, 0, 'wood']];
const bad = cases.filter(([x, z, f, s]) => S(x, z, f) !== s);
check(!bad.length, 'superficie: madera, azulejo, concreto, arena, pasto, agua, piedra', bad.map(([x, z, f, s]) => `(${x},${z}) ${S(x, z, f)}≠${s}`).join(' '));

// 3) pasos del jugador
function walkSteps(dist, speed, grounded) {
  FOOT.init = false; G.updateFootsteps(1 / 60); FOOT.acc = 0;
  const n0 = FOOT.steps, dt = 1 / 60, step = speed * dt;
  player.grounded = grounded;
  for (let d = 0; d < dist; d += step) { player.pos.x += step; G.updateFootsteps(dt); }
  player.grounded = true;
  return FOOT.steps - n0;
}
player.pos.set(-4, 1.7, 10);
const w = walkSteps(8.5, 4.4, true), r = walkSteps(8.5, 7, true), air = walkSteps(4, 4.4, false);
check(w === Math.floor(8.5 / A.stepLen) || w === Math.floor(8.5 / A.stepLen) - 1, 'caminando: un paso cada ' + A.stepLen + ' m', `(${w} en 8.5 m)`);
check(r < w && r >= 5, 'corriendo: pasos más largos', `(${r})`);
check(air === 0, 'en el aire no hay pasos');
player.pos.set(0, 1.7, 5); G.updateFootsteps(1 / 60); player.pos.set(-24, -6.3, -80); G.updateFootsteps(1 / 60);
check(FOOT.acc === 0, 'teletransporte (escotilla): no cuenta como caminar');
player.pos.set(12, 1.7, 8); FOOT.init = false; walkSteps(2, 4.4, true);
check(FOOT.last === 'tile', 'en la cocina suena azulejo');

// 4) pasos de zombies: cerca sí, lejos no, con tope por segundo
player.pos.set(0, 1.7, 10); G.setCam(0);
const zs = [];
for (let i = 0; i < 20; i++) { const q = G.spawnZombie(); if (!q) break; q.state = 'walk'; q.px = -5 + (i % 10); q.pz = 6 + Math.floor(i / 10) * 8; q.gait = 'run'; q.stepT = 0; zs.push(q); }
const far = zs[zs.length - 1]; far.px = 0; far.pz = 10 + A.zStepDist + 10;
const pan0 = count('panner');
AUDIO.zStepT0 = 0; ctx.currentTime += 5;
for (let i = 0; i < 60; i++) { ctx.currentTime += 1 / 60; G.zombieSteps(1 / 60); }
const made = count('panner') - pan0;
check(made > 0 && made <= A.zStepMax + 1, 'pasos de zombies en 3D, con tope de ' + A.zStepMax + ' por segundo', `(${made} en 1 s)`);
check(far.stepT === 0 || far.stepT === undefined, 'el que está lejos no suena');
for (const q of zs) { q.active = q.alive = false; } state.zombies.length = 0;

// 5) música
function run(secs, fn) { for (let i = 0; i < Math.round(secs * 60); i++) { ctx.currentTime += 1 / 60; if (fn) fn(); G.updateMusic(); } }
G.resetGame(); state.running = true; state.round = 1; roundState.phase = 'active'; G.setCam(0);
player.pos.set(0, 1.7, 0);
let n0 = MUSIC.notes; run(10);
const calm1 = MUSIC.notes - n0;
check(calm1 > 5 && MUSIC.next <= ctx.currentTime + A.musicLookahead + 0.5, 'suena la marimba y agenda poco por adelantado', `(${calm1} notas en 10 s)`);
check(AUDIO.music.gain.target > 0 && Math.abs(AUDIO.music.gain.target - A.music * G.SETTINGS.music) < 1e-9, 'volumen de la música = config × ajuste');
state.round = 15; n0 = MUSIC.notes; run(10);
const hot = MUSIC.notes - n0;
check(G.musicIntensity() === 1 && hot > calm1 * 1.5, 'en la R15 hay más capas', `(${hot} contra ${calm1})`);
roundState.phase = 'intermission';
check(G.musicIntensity() < 0.5, 'entre rondas baja la intensidad');
roundState.phase = 'active';
CONFIG.BOSS.enabled = true; state.round = 12; G.spawnBoss();
run(0.5);
check(MUSIC.boss === true, 'con un boss vivo: tema del boss');
n0 = MUSIC.notes; run(10);
check(MUSIC.notes - n0 > calm1, 'más movido', `(${MUSIC.notes - n0})`);
for (const q of state.zombies) { q.active = q.alive = false; } state.zombies.length = 0; CONFIG.BOSS.enabled = false;
run(0.5);
check(!MUSIC.boss, 'muerto el boss, vuelve la marimba');
// los zombies mandan
AUDIO.lastGrowl = ctx.currentTime; run(1 / 60);
const ducked = AUDIO.music.gain.target;
AUDIO.lastGrowl = -99; run(1 / 60);
check(ducked < AUDIO.music.gain.target * 0.5, 'baja mientras gruñe un zombie');
const zq = G.spawnZombie(); zq.state = 'walk'; zq.px = 2; zq.pz = 0; run(1 / 60);
check(AUDIO.music.gain.target < A.music * 0.7, 'baja con un zombie cerca');
zq.active = zq.alive = false; state.zombies.length = 0;
G.setMusicVolume(0); run(1 / 60);
check(AUDIO.music.gain.target === 0, 'volumen de música en 0: no suena');
G.setMusicVolume(1);
state.running = false; n0 = MUSIC.notes; run(2);
check(MUSIC.notes === n0 && AUDIO.music.gain.target === 0, 'en pausa no agenda y se apaga');
state.running = true;

// 6) tambor de ronda
let o0 = count('osc'); G.sfxRoundDrum(4); const short = count('osc') - o0;
o0 = count('osc'); G.sfxRoundDrum(5); const long = count('osc') - o0;
check(short === 2 && long > 8, 'tambor: 2 golpes, y redoble largo cada 5 rondas', `(${short} / ${long})`);

// 7) ambiente por zona
function amb(x, z, y) {
  player.pos.set(x, (y || 0) + 1.7, z); G.updateAmbience();
  return { waves: AUDIO.amb.gain.target, wind: AUDIO.wind.g.gain.target, bugs: AUDIO.bugs.g.gain.target };
}
const beach = amb(0, -15), pier = amb(0, -35), sala = amb(0, 10), jung = amb(-60, 60), sot = amb(-10, 35);
check(beach.waves > jung.waves && jung.waves > sot.waves && beach.waves > sala.waves, 'olas: fuertes en la playa, bajas en la jungla, casi nada en el sótano',
  `(${beach.waves.toFixed(2)} / ${jung.waves.toFixed(2)} / ${sala.waves.toFixed(2)} / ${sot.waves.toFixed(2)})`);
check(pier.wind > beach.wind && sala.wind === 0, 'viento: fuerte en el muelle, nada adentro');
check(jung.bugs > 0 && beach.bugs === 0 && sala.bugs === 0, 'bichos solo en la jungla');
const t0 = count('osc'); amb(-10, 35); AUDIO.nextDrip = 0; for (let i = 0; i < 300; i++) { ctx.currentTime += 1 / 60; G.updateAmbience(); }
check(count('osc') - t0 >= 4, 'gotas en el sótano');
const b0 = count('osc'); amb(-60, 60); AUDIO.nextBird = 0; G.updateAmbience();
check(count('osc') - b0 >= 2, 'pájaros en la jungla');

// 8) volúmenes
G.setSfxVolume(0.5);
check(AUDIO.sfx.gain.target === A.sfx * 0.5 && G.SETTINGS.sfx === 0.5, 'efectos: su propio volumen');
G.setSfxVolume(3); check(G.SETTINGS.sfx === 1, 'con tope en 1');
const beachHalf = (G.setSfxVolume(0.5), amb(0, -15).waves);
check(Math.abs(beachHalf - beach.waves * 0.5) < 1e-9, 'el ambiente sigue al volumen de efectos');

check(leaks() === 0, 'nada queda sonando (todo lo puntual tiene stop)', `(${leaks()})`);
console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
