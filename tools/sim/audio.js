// P8 audio: con un AudioContext FALSO que registra nodos. Verifica que nada tira error sin audio,
// que los loops se crean una sola vez, que todo sonido puntual se detiene (sin fugas de nodos),
// pasos de recarga, limitador de gruñidos, distancia/oclusión, campana de ronda y volumen.
const G = require('./harness.js');
const { state, player, CONFIG, weaponsState, AUDIO } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };

const log = { ctx: [], nodes: [], started: [] };
function param(v) {
  return { value: v, setValueAtTime(x) { this.value = x; }, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {},
           setTargetAtTime(x) { this.target = x; } };
}
function node(kind, extra) { const n = Object.assign({ kind, connect(d) { return d; }, disconnect() {} }, extra); log.nodes.push(n); return n; }
function src(kind, extra) {
  return node(kind, Object.assign({ started: false, stopped: false, loop: false,
    start() { this.started = true; log.started.push(this); }, stop() { this.stopped = true; } }, extra));
}
class FakeAC {
  constructor() { this.sampleRate = 8000; this.currentTime = 0; this.state = 'running'; this.destination = {}; log.ctx.push(this); }
  resume() {}
  createGain() { return node('gain', { gain: param(1) }); }
  createDynamicsCompressor() { return node('comp', {}); }
  createBiquadFilter() { return node('filter', { type: '', frequency: param(350), Q: param(1) }); }
  createStereoPanner() { return node('pan', { pan: param(0) }); }
  createOscillator() { return src('osc', { type: 'sine', frequency: param(440) }); }
  createBufferSource() { return src('buf', { buffer: null }); }
  createBuffer(ch, len) { const d = new Float32Array(len); return { length: len, getChannelData: () => d }; }
}
const leaks = () => log.started.filter(s => !s.loop && !s.stopped && s.kind === 'buf' || (s.kind === 'osc' && !s.stopped && !s.isLfo)).length;
const growls = () => log.nodes.filter(n => n.kind === 'osc' && n.type === 'sawtooth').length;

G.resetGame(); state.running = true; G.debugOpenAllDoors(); G.setCam(0);

// 1) sin AudioContext: todo sale sin error
let threw = null;
try {
  for (const id in CONFIG.WEAPONS) G.sfxShot(CONFIG.WEAPONS[id]);
  [0, 1, 2].forEach(G.sfxReload); G.sfxBell(); G.sfxHurt(); G.sfxPowerup('maxammo'); G.sfxBoxTick(); G.sfxTeddy();
  G.sfxSwing(); G.sfxDry(); G.sfxHit(true); G.sfxBuy(); G.sfxDeny();
  G.updateZombieAudio(0.1); G.updateFlameAudio(); G.updateAmbience(); G.setVolume(0.5);
} catch (e) { threw = e; }
check(!threw && !G.audioOn(), 'sin AudioContext no hay errores', threw ? '(' + threw.message + ')' : '');

// 2) init: un contexto, 2 loops de olas (+2 LFO), una sola vez aunque se llame en cada gesto
G.sandbox.window.AudioContext = FakeAC;
G.initAudio(); G.initAudio(); G.initAudio();
const ctx = log.ctx[0];
check(log.ctx.length === 1, 'un solo AudioContext');
const loops = log.started.filter(s => s.loop).length;
const lfos = log.started.filter(s => s.kind === 'osc').length;
// F6: + viento y bichos (2 loops + 2 LFO más)
check(loops === 4 && lfos === 4, 'olas, viento y bichos: 4 loops + 4 LFO, creados una vez', `(${loops} loops, ${lfos} osc)`);
log.started.filter(s => s.kind === 'osc').forEach(s => { s.isLfo = true; });
check(AUDIO.master.gain.value === G.SETTINGS.volume, 'master = volumen de ajustes');

// 3) disparos: cada arma suena, nada queda sin stop
const before = log.nodes.length;
for (const id in CONFIG.WEAPONS) { const n0 = log.nodes.length; G.sfxShot(CONFIG.WEAPONS[id]);
  const made = log.nodes.length - n0;
  check(CONFIG.WEAPONS[id].flame ? made === 0 : made >= 4, `disparo ${id}`, `(${made} nodos)`); }
check(leaks() === 0, 'todo sonido puntual tiene stop (sin fugas)', `(${leaks()})`);

// 4) lanzallamas: loop lazy, uno solo, se apaga al soltar
G.giveWeapon('flamethrower'); weaponsState.phase = 'idle';
weaponsState.flameUntil = 1e15;
G.updateFlameAudio(); G.updateFlameAudio(); G.updateFlameAudio();
check(log.started.filter(s => s.loop).length === 5 && AUDIO.flame, 'loop del lanzallamas creado una vez');
check(AUDIO.flame.g.gain.target > 0, 'suena mientras dispara');
weaponsState.flameUntil = 0; G.updateFlameAudio();
check(AUDIO.flame.g.gain.target === 0, 'se apaga al soltar');

// 5) recarga en 3 pasos; interrumpida no completa los pasos
state.weapons = []; G.giveWeapon('m1911'); weaponsState.phase = 'idle';
const s0 = state.weapons[0]; s0.mag = 2;
G.reloadWeapon();
for (let i = 0; i < 200; i++) G.updateWeapon(1 / 60);
check(weaponsState.reloadStep === 3 && weaponsState.phase === 'idle', 'recarga completa: 3 sonidos', `(${weaponsState.reloadStep})`);
s0.mag = 2; weaponsState.phase = 'idle'; G.reloadWeapon();
for (let i = 0; i < 30; i++) G.updateWeapon(1 / 60);          // 0.5 s de 1.4 s
G.meleeState.lastAttack = -1e12; G.meleeAttack();              // el cuchillo interrumpe
for (let i = 0; i < 60; i++) G.updateWeapon(1 / 60);
check(weaponsState.reloadStep === 1, 'recarga interrumpida: no suenan los pasos que faltan', `(${weaponsState.reloadStep})`);

// 6) gruñidos: limitador global, distancia, oclusión, paneo
G.startRound(3); G.updateFlowField(true);
player.pos.set(0, 1.7, 10); G.setCam(0);
const zs = [];
for (let i = 0; i < 8; i++) { const z = G.spawnZombie(); z.state = 'walk'; z.px = -6 + i * 1.6; z.pz = 6; z.growlT = 0; zs.push(z); }
const g0 = growls();
for (let i = 0; i < 600; i++) { ctx.currentTime += 1 / 60; G.updateZombieAudio(1 / 60); }   // 10 s
const made = growls() - g0, cap = Math.ceil(10 / CONFIG.AUDIO.growlGap) + 1;
check(made > 5 && made <= cap, '8 zombies en 10 s: gruñen con limitador', `(${made}, tope ${cap})`);
const far = zs[0]; far.px = 0; far.pz = 10 + CONFIG.AUDIO.growlMaxDist + 5;
const g1 = growls(); G.sfxGrowl(far, 'idle');
check(growls() === g1, 'más lejos que growlMaxDist no suena');
const near = zs[1]; near.px = 3; near.pz = 10;                  // a la derecha (mirando -z)
G.sfxGrowl(near, 'attack');
const pan = log.nodes.filter(n => n.kind === 'pan').pop();
check(pan && pan.pan.value > 0.5, 'zombie a la derecha suena a la derecha', `(pan ${pan && pan.pan.value.toFixed(2)})`);
const wall = zs[2]; wall.px = 3; wall.pz = 3.2;                 // porche, detrás de la pared sur de la sala
G.sfxGrowl(wall, 'idle');
const lp = log.nodes.filter(n => n.kind === 'filter' && n.type === 'lowpass').pop();
check(lp.frequency.value <= 600, 'detrás de una pared suena apagado', `(lowpass ${lp.frequency.value})`);
const g2 = growls(); G.damageZombie(near, 1e9, false);
check(growls() === g2 + 1, 'muerte = gruñido final');
check(leaks() === 0, 'gruñidos sin fugas de nodos');

// 7) campana de ronda, volumen, ambiente según cuarto
const o0 = log.nodes.filter(n => n.kind === 'osc').length;
G.startRound(4);
// F6: + el tambor (2 golpes, un seno cada uno)
check(log.nodes.filter(n => n.kind === 'osc').length - o0 === 12, 'campanada (2 golpes x 5 parciales) y tambor (2) al empezar ronda');
G.setVolume(0.3);
check(AUDIO.master.gain.target === 0.3 && G.SETTINGS.volume === 0.3, 'volumen aplica al master');
G.setVolume(7); check(G.SETTINGS.volume === 1, 'volumen se limita a 1');
player.pos.set(0, 1.7, 0); G.updateAmbience(); const porch = AUDIO.amb.gain.target;
player.pos.set(-10, 1.7, 35); G.updateAmbience(); const base = AUDIO.amb.gain.target, cut = AUDIO.ambLP.frequency.target;
check(porch > base * 3 && cut < 400, 'olas fuertes en el porche, apagadas en el sótano', `(${porch.toFixed(2)} vs ${base.toFixed(2)}, lowpass ${cut})`);

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
