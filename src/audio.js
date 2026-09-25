//--- AUDIO: todo procedural (Web Audio), sin archivos ---
// sfx -> compresor -> master; olas -> filtro de ambiente -> amb -> master. master = SETTINGS.volume.
// Sin AudioContext (harness, navegador viejo) todas las funciones salen sin hacer nada.
// Loops persistentes (se crean UNA vez): olas (2 fuentes + 2 LFO) y lanzallamas (1 fuente, lazy).
// F6: volúmenes separados (general, música, efectos) y música por su propio bus
const SETTINGS = { sens: 1, volume: CONFIG.AUDIO.master, music: 1, sfx: 1, dmgNumbers: true };   // F5.11: números de daño
const AUDIO = { ctx: null, master: null, sfx: null, amb: null, ambLP: null, noise: null, brown: null,
  lastGrowl: -9, lastDry: 0, flame: null, music: null, wind: null, bugs: null };
function audioOn() { return !!AUDIO.ctx && AUDIO.ctx.state === 'running'; }
function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!AUDIO.ctx) {
    const ctx = new AC(), A = CONFIG.AUDIO, sr = ctx.sampleRate;
    const master = ctx.createGain(); master.gain.value = SETTINGS.volume; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.connect(master);   // la escopeta + 8 gruñidos no saturan
    const sfx = ctx.createGain(); sfx.gain.value = A.sfx * SETTINGS.sfx; sfx.connect(comp);
    const amb = ctx.createGain(); amb.gain.value = 0; amb.connect(master);
    const music = ctx.createGain(); music.gain.value = 0; music.connect(master);   // F6: lo maneja updateMusic
    const noise = ctx.createBuffer(1, sr * 2, sr), d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const brown = ctx.createBuffer(1, sr * 6, sr), b = brown.getChannelData(0);   // ruido marrón = rumor de mar
    let last = 0;
    for (let i = 0; i < b.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    const fade = Math.floor(sr * 0.3);                   // sin click en el borde del loop
    for (let i = 0; i < fade; i++) { const k = i / fade; b[i] *= k; b[b.length - 1 - i] *= k; }
    Object.assign(AUDIO, { ctx, master, sfx, amb, noise, brown, music });
    startAmbience();
  }
  if (AUDIO.ctx.state === 'suspended') AUDIO.ctx.resume();
}
function setVolume(v) {
  SETTINGS.volume = Math.max(0, Math.min(1, v));
  if (AUDIO.master) AUDIO.master.gain.setTargetAtTime(SETTINGS.volume, AUDIO.ctx.currentTime, 0.05);
}
// F6: música (la lee updateMusic en cada frame) y efectos (sfx + ambiente)
function setMusicVolume(v) { SETTINGS.music = Math.max(0, Math.min(1, v)); }
function setSfxVolume(v) {
  SETTINGS.sfx = Math.max(0, Math.min(1, v));
  if (AUDIO.sfx) AUDIO.sfx.gain.setTargetAtTime(CONFIG.AUDIO.sfx * SETTINGS.sfx, AUDIO.ctx.currentTime, 0.05);
}
function sfxEnv(g, t, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function sfxNoise(t, dur, type, freq, q, peak, dest) {
  const c = AUDIO.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = AUDIO.noise;
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  sfxEnv(g, t, peak, dur);
  src.connect(f); f.connect(g); g.connect(dest || AUDIO.sfx);
  src.start(t, Math.random() * Math.max(0, 1.9 - dur)); src.stop(t + dur + 0.02);
}
function sfxTone(t, dur, type, f0, f1, peak, dest) {
  const c = AUDIO.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  sfxEnv(g, t, peak, dur);
  o.connect(g); g.connect(dest || AUDIO.sfx);
  o.start(t); o.stop(t + dur + 0.02);
}

//--- disparo por arma: capas [n=ruido filtrado | t=tono, dur, tipo, f, q/f1, pico, retardo] ---
const SHOT_SFX = {
  // F5.11: armas nuevas
  uzi:     [['n', .05, 'bandpass', 3000, .9, .5], ['t', .05, 'sine', 260, 110, .35]],
  ak47:    [['n', .12, 'bandpass', 1500, .8, .8], ['t', .1, 'sine', 140, 55, .7], ['n', .04, 'highpass', 4000, .7, .3]],
  deagle:  [['n', .2, 'lowpass', 1600, .8, 1], ['t', .16, 'sine', 120, 40, .9], ['n', .05, 'highpass', 4500, .7, .4]],
  spas:    [['n', .3, 'lowpass', 1500, .7, .95], ['t', .22, 'sine', 100, 40, .9]],
  bow:     [['t', .08, 'triangle', 420, 160, .4], ['n', .12, 'bandpass', 900, 1.2, .25]],
  bazooka: [['n', .5, 'lowpass', 900, .7, 1], ['t', .4, 'sine', 70, 30, 1], ['n', .8, 'bandpass', 600, .8, .4, .05]],
  m1911:   [['n', .12, 'bandpass', 1800, .8, .8], ['t', .10, 'sine', 180, 60, .6], ['n', .025, 'highpass', 5000, .7, .35]],
  shotgun: [['n', .35, 'lowpass', 1400, .7, 1], ['t', .25, 'sine', 95, 38, 1], ['n', .5, 'bandpass', 420, .9, .35]],
  smg:     [['n', .07, 'bandpass', 2600, .9, .55], ['t', .06, 'sine', 230, 90, .4]],
  rifle:   [['n', .16, 'bandpass', 2000, .8, .8], ['t', .14, 'sine', 150, 55, .7], ['n', .04, 'highpass', 4200, .7, .45]],
  lmg:     [['n', .14, 'bandpass', 1400, .8, .85], ['t', .14, 'sine', 120, 45, .85]],
  sniper:  [['n', .6, 'lowpass', 2600, .7, 1], ['t', .45, 'sine', 80, 34, 1], ['n', .05, 'highpass', 3600, .7, .8],
            ['n', .9, 'bandpass', 600, .8, .22, .22]],                                  // eco
  raygun:  [['t', .25, 'square', 1400, 220, .22], ['t', .3, 'sine', 700, 110, .4], ['n', .1, 'highpass', 3000, .7, .2]],
  // F5.5: ola que rompe: golpe grave + agua que barre y espuma
  wave:    [['t', .35, 'sine', 90, 40, .9], ['n', .7, 'lowpass', 900, .6, .8], ['n', .9, 'bandpass', 2400, .5, .3, .12]]
};
function sfxShot(def) {
  if (!audioOn() || def.flame) return;                  // el lanzallamas es un loop (updateFlameAudio)
  const t = AUDIO.ctx.currentTime, r = 0.94 + Math.random() * 0.12;
  for (const L of SHOT_SFX[def.id] || SHOT_SFX.m1911) {
    const at = t + (L[6] || 0);
    if (L[0] === 'n') sfxNoise(at, L[1], L[2], L[3] * r, L[4], L[5]);
    else sfxTone(at, L[1], L[2], L[3] * r, L[4] * r, L[5]);
  }
}
function updateFlameAudio() {
  if (!audioOn()) return;
  const def = curDef();
  const on = state.running && !!def && !!def.flame && performance.now() < (weaponsState.flameUntil || 0);
  if (!AUDIO.flame) {
    if (!on) return;
    const c = AUDIO.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = AUDIO.noise; src.loop = true;
    f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 0.6;
    g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(AUDIO.sfx); src.start();
    AUDIO.flame = { src, f, g };
  }
  const t = AUDIO.ctx.currentTime;
  AUDIO.flame.g.gain.setTargetAtTime(on ? 0.5 : 0, t, on ? 0.04 : 0.12);
  if (on) AUDIO.flame.f.frequency.setTargetAtTime(520 + Math.random() * 300, t, 0.05);
}
// recarga en 3 pasos según el progreso de la animación (si se interrumpe, no suenan los que faltan)
const RELOAD_STEPS = [0.2, 0.62, 0.9];
function sfxReload(step) {
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, r = 0.95 + Math.random() * 0.1;
  if (step === 0) { sfxNoise(t, .05, 'bandpass', 2400 * r, 2, .35); sfxTone(t, .05, 'square', 620 * r, 380, .06); }  // sale
  else if (step === 1) { sfxNoise(t, .07, 'bandpass', 1500 * r, 2, .5); sfxTone(t, .06, 'triangle', 320 * r, 200, .2); } // entra
  else { sfxNoise(t, .03, 'highpass', 3200, 1, .4); sfxNoise(t + .08, .04, 'highpass', 2600, 1, .45); }             // corredera
}
function sfxDry() {
  if (!audioOn()) return;
  const now = performance.now();
  if (now - AUDIO.lastDry < 250) return;                 // las automáticas lo pedirían cada frame
  AUDIO.lastDry = now;
  sfxNoise(AUDIO.ctx.currentTime, .025, 'highpass', 3500, 1, .3);
}
function sfxSwing() {
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxNoise(t, .16, 'bandpass', 900 + Math.random() * 300, 1.5, .35);
  sfxNoise(t + .03, .1, 'bandpass', 2000, 2, .15);
}
function sfxHurt() {
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxTone(t, .2, 'sine', 90, 45, .7);
  sfxNoise(t, .15, 'lowpass', 400, .7, .5);
}
function sfxBell() {                                       // campanada de ronda: parciales inarmónicos, 2 golpes
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, f = 196;
  [0, 1.1].forEach((dt, k) => {
    const a = k ? 0.6 : 1;
    [[1, .45, 3.4], [2.0, .25, 2.6], [2.76, .22, 1.9], [5.4, .1, 1.0], [0.5, .22, 3.8]]
      .forEach(([m, amp, dur]) => sfxTone(t + dt, dur, 'sine', f * m, f * m * 0.996, amp * a));
  });
}
function sfxPowerup(type) {
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  const notes = type === 'instakill' ? [330, 262, 196] : type === 'doublepoints' ? [523, 784, 1047] : [392, 523, 659, 784];
  notes.forEach((n, i) => sfxTone(t + i * 0.09, 0.22, 'triangle', n, n, 0.3));
}
function sfxBoxTick() {                                    // caja girando: cajita de música pentatónica
  if (!audioOn()) return;
  const penta = [523, 587, 659, 784, 880, 1047, 1175];
  const n = penta[Math.floor(Math.random() * penta.length)];
  sfxTone(AUDIO.ctx.currentTime, 0.14, 'triangle', n, n, 0.14);
}
function sfxTeddy() {
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  [262, 220, 175, 131].forEach((n, i) => sfxTone(t + i * 0.18, 0.3, 'square', n, n * 0.97, 0.12));
}

//--- F2.5: generador, almas y Pack-a-Punch ---
function sfxGenerator() {                                   // motor que arranca: cuerda, toses y rumor parejo
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxNoise(t, 0.18, 'bandpass', 900, 1.5, 0.35);                          // tirón de la cuerda
  [0.25, 0.45, 0.62, 0.76, 0.88, 0.98].forEach((d, i) => {                // toses cada vez más seguidas
    sfxTone(t + d, 0.12, 'sawtooth', 55 + i * 4, 40, 0.35);
    sfxNoise(t + d, 0.1, 'lowpass', 400, 0.8, 0.3);
  });
  sfxTone(t + 1.05, 1.4, 'sawtooth', 62, 70, 0.22);                       // ya anda
  sfxTone(t + 1.05, 1.4, 'square', 31, 35, 0.12);
}
function sfxSoul(full) {                                    // alma que entra; si llenó la caja, acorde
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxNoise(t, 0.4, 'bandpass', 700, 2.5, 0.18);
  sfxTone(t + 0.35, 0.5, 'sine', 220, 180, 0.2);
  if (full) [196, 247, 294, 392].forEach((n, i) => sfxTone(t + 0.5 + i * 0.1, 0.9, 'triangle', n, n, 0.18));
}
function sfxPapOn() {                                       // la máquina se enciende: barrido + arpegio
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxTone(t, 1.2, 'sawtooth', 60, 240, 0.2);
  sfxNoise(t, 1.2, 'highpass', 3000, 0.7, 0.1);
  [262, 330, 392, 523, 659].forEach((n, i) => sfxTone(t + 0.9 + i * 0.12, 1.2, 'triangle', n, n, 0.2));
}

//--- F3a: escudo ---
function sfxPartPickup() {                                  // pieza: golpe de madera/metal + dos notas
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxNoise(t, 0.08, 'bandpass', 900, 1.5, 0.3);
  [440, 660].forEach((f, i) => sfxTone(t + 0.05 + i * 0.09, 0.18, 'triangle', f, f, 0.15));
}
function sfxShieldTake() {                                  // agarrar / terminar de armar
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxNoise(t, 0.15, 'lowpass', 700, 0.8, 0.4);
  [330, 440, 554].forEach((f, i) => sfxTone(t + i * 0.08, 0.3, 'triangle', f, f, 0.15));
}
function sfxShieldHit() {                                   // golpe contra la madera
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxNoise(t, 0.1, 'bandpass', 500, 1.2, 0.5);
  sfxTone(t, 0.12, 'sine', 140, 70, 0.4);
}
function sfxShieldBreak() {                                 // madera que se parte
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  [0, 0.06, 0.15].forEach(d => sfxNoise(t + d, 0.12, 'bandpass', 1400, 1, 0.45));
  sfxTone(t, 0.4, 'sawtooth', 120, 50, 0.25);
}
function sfxShieldBash(hit) {                               // empujón: aire + golpe sordo si pegó
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxNoise(t, 0.12, 'bandpass', 700, 0.8, 0.25);
  if (hit) sfxTone(t + 0.05, 0.12, 'sine', 110, 55, 0.5);
}

//--- F5.5: quest de la Ola Rompiente ---
function sfxCoconut(land) {                                 // coco: golpe de bala (tac) o contra la arena (tum)
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  if (land) { sfxTone(t, 0.15, 'sine', 160, 70, 0.5); sfxNoise(t, 0.1, 'lowpass', 500, 0.8, 0.3); }
  else { sfxNoise(t, 0.05, 'bandpass', 1300, 2, 0.45); sfxTone(t, 0.08, 'triangle', 420, 300, 0.2); }
}
function sfxPalmCrack() {                                   // machetazo que parte el tronco: crujidos que se aceleran
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  [0, 0.35, 0.6, 0.78, 0.9].forEach((d, i) => sfxNoise(t + d, 0.1, 'bandpass', 900 + i * 150, 1.2, 0.3 + i * 0.06));
  sfxTone(t, 1.2, 'sawtooth', 70, 45, 0.12);
}
function sfxPalmFall(dist) {                                // la palmera contra la arena, más baja lejos
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, k = Math.max(0.2, 1 - dist / 40);
  sfxTone(t, 0.5, 'sine', 70, 30, 0.9 * k);
  sfxNoise(t, 0.6, 'lowpass', 500, 0.7, 0.7 * k);
  sfxNoise(t + 0.05, 0.4, 'bandpass', 2200, 0.8, 0.15 * k);          // hojas
}
//--- F5.6: plantas carnívoras ---
function sfxPlantWarn(dist) {                              // se abre: siseo húmedo
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, k = Math.max(0.3, 1 - dist / 5);
  sfxNoise(t, 0.5, 'bandpass', 3200, 1.5, 0.25 * k);
  sfxTone(t, 0.4, 'sawtooth', 140, 90, 0.08 * k);
}
function sfxPlantBite() {                                   // mordida: chasquido seco + crujido
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxNoise(t, 0.06, 'highpass', 2500, 1, 0.7);
  sfxTone(t, 0.12, 'square', 220, 60, 0.3);
  sfxNoise(t + 0.05, 0.2, 'bandpass', 900, 1, 0.4);
}
function sfxPiranha(dist) {                                 // F5.7: piraña que salta: chapoteo
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, k = Math.max(0.15, 1 - dist / CONFIG.GARDEN.piranhas.sound);
  sfxNoise(t, 0.18, 'bandpass', 1400, 0.9, 0.3 * k);
  sfxTone(t, 0.1, 'sine', 500, 900, 0.06 * k);
}
//--- F5.9: trampas ---
function sfxLever() {                                       // palanca: clac metálico + zumbido
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxNoise(t, 0.05, 'highpass', 3000, 1, 0.5);
  sfxTone(t + 0.03, 0.25, 'square', 180, 120, 0.15);
}
function sfxSharkJump(dist) {                               // tiburón que sale del agua: chapuzón grande
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, k = Math.max(0.15, 1 - dist / 40);
  sfxNoise(t, 0.5, 'lowpass', 1200, 0.8, 0.6 * k);
  sfxTone(t, 0.3, 'sine', 90, 50, 0.4 * k);
}
function sfxMower(dist) {                                   // cortadora: un pulso del motor (se repite mientras anda)
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, k = Math.max(0, 1 - dist / 30);
  if (k <= 0) return;
  sfxTone(t, 0.12, 'sawtooth', 95, 85, 0.12 * k);
  sfxNoise(t, 0.1, 'bandpass', 1800, 1.2, 0.08 * k);
}
// F5.11: el calamar gigante sale del mar: rugido grave y largo, fuerte en todo el mapa
function sfxGiantRoar() {
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxTone(t, 2.4, 'sawtooth', 70, 38, 0.55);
  sfxTone(t + 0.1, 2.2, 'sawtooth', 105, 55, 0.35);
  sfxNoise(t, 2.6, 'lowpass', 400, 0.8, 0.7);
  sfxNoise(t + 0.3, 1.8, 'bandpass', 900, 1.2, 0.25);
}
// F5.11: langostino bailarín: un golpe de la cumbia (platillo + nota), cada beat mientras baila
let MONKEY_BEAT = 0;
function sfxMonkeyBeat(dist) {
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, k = Math.max(0.1, 1 - dist / 40), notes = [392, 494, 587, 494];
  sfxNoise(t, 0.05, 'highpass', 6000, 0.8, 0.25 * k);                       // platillo
  if (MONKEY_BEAT % 2 === 0) sfxTone(t, 0.12, 'square', notes[(MONKEY_BEAT / 2) % 4], notes[(MONKEY_BEAT / 2) % 4], 0.08 * k);
  MONKEY_BEAT++;
}
function sfxInk(dist) {                                     // calamar que escupe tinta: chorro húmedo
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, k = Math.max(0.1, 1 - dist / 25);
  sfxNoise(t, 0.25, 'bandpass', 700, 0.8, 0.35 * k);
  sfxTone(t, 0.2, 'sine', 260, 120, 0.12 * k);
}
function sfxSquidFuse(dist) {                               // dos calamares se funden: chapoteo grave
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, k = Math.max(0.1, 1 - dist / 30);
  sfxNoise(t, 0.5, 'lowpass', 500, 0.9, 0.5 * k);
  sfxTone(t, 0.6, 'sawtooth', 70, 40, 0.18 * k);
}
function sfxShellRise() {                                   // caracola que sale del agua: burbujas + nota larga
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  for (let i = 0; i < 5; i++) sfxTone(t + i * 0.07, 0.08, 'sine', 500 + i * 120, 900 + i * 120, 0.12);
  sfxTone(t + 0.4, 1.4, 'sine', 330, 294, 0.18);
}

//--- F2b: Pack-a-Punch trabajando (4 s de engranajes y martillazos) y listo (ding) ---
function sfxPapWork() {
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, T = CONFIG.PAP.time;
  sfxTone(t, T, 'sawtooth', 55, 70, 0.1);                                  // motor de fondo
  for (let d = 0.2; d < T - 0.2; d += 0.45) {                               // martillazos
    sfxNoise(t + d, 0.08, 'bandpass', 1200, 2, 0.35);
    sfxTone(t + d, 0.1, 'square', 220, 110, 0.1);
  }
}
function sfxPapDone() {
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  [1047, 1319, 1568].forEach((f, i) => sfxTone(t + i * 0.07, 1.0, 'sine', f, f, 0.2));
}

//--- F2: power, perks, revive, stamina ---
function sfxPowerOn() {                                     // golpe grave + zumbido que sube (la casa se prende)
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxNoise(t, 0.3, 'lowpass', 300, 0.7, 0.8);
  sfxTone(t + 0.1, 2.2, 'sawtooth', 40, 120, 0.15);
  sfxTone(t + 0.1, 2.2, 'sine', 60, 60, 0.2);
}
// jingle de cada máquina: 5 notas propias (triangular, tipo cajita)
const PERK_JINGLES = {
  revive: [523, 659, 784, 659, 1047], jugg: [196, 247, 294, 247, 392], speed: [392, 494, 587, 740, 784],
  dtap: [330, 330, 440, 330, 494], stamin: [587, 698, 880, 698, 587]
};
function sfxJingle(key) {
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, n = PERK_JINGLES[key] || PERK_JINGLES.revive;
  n.forEach((f, i) => sfxTone(t + i * 0.16, 0.24, 'triangle', f, f, 0.14));
}
function sfxPerkDrink() {                                   // lata que se abre + trago + eructo corto
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxNoise(t, 0.08, 'highpass', 3500, 0.8, 0.35);
  [0.25, 0.45, 0.65].forEach(d => sfxTone(t + d, 0.12, 'sine', 180, 120, 0.2));
  sfxTone(t + 1.0, 0.3, 'sawtooth', 90, 70, 0.15);
}
function sfxRevive() {                                      // revivir: acorde que sube
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  [262, 330, 392, 523].forEach((f, i) => sfxTone(t + i * 0.08, 0.8, 'triangle', f, f * 1.01, 0.2));
}
function sfxBreath() {                                      // sin aire: dos respiraciones agitadas
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  [0, 0.45].forEach(d => sfxNoise(t + d, 0.35, 'bandpass', 900, 1.2, 0.18));
}

//--- F2.7: granadas ---
function sfxPin() {                                         // pin: clic metálico + resorte de la palanca
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxNoise(t, 0.03, 'highpass', 4500, 0.8, 0.4);
  sfxTone(t + 0.02, 0.08, 'square', 2400, 1800, 0.08);
  sfxNoise(t + 0.12, 0.05, 'bandpass', 3200, 3, 0.25);
}
function sfxGrenadeBounce(dist) {                           // golpe seco contra piso/pared, más bajo lejos
  if (!audioOn()) return;
  const k = Math.max(0, 1 - dist / 25);
  if (k <= 0) return;
  const t = AUDIO.ctx.currentTime;
  sfxTone(t, 0.06, 'triangle', 900 * rnd(0.9, 1.1), 500, 0.25 * k);
  sfxNoise(t, 0.04, 'bandpass', 2000, 1.5, 0.2 * k);
}
function sfxExplosion(dist) {                               // explosión: ruido grave + seno que cae, lejos más apagada
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, k = 0.35 + 0.65 * Math.max(0, 1 - dist / 30);
  sfxNoise(t, 0.9, 'lowpass', 900 * k + 200, 0.7, 1.0 * k);
  sfxTone(t, 0.7, 'sine', 90, 30, 0.9 * k);
  sfxNoise(t, 0.12, 'bandpass', 2500, 0.8, 0.5 * k);           // crack inicial
}
function sfxThunder() {                                     // F4: relámpago de los perros: crack + retumbo largo
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxNoise(t, 0.15, 'highpass', 1800, 0.7, 0.45);
  sfxNoise(t + 0.05, 2.2, 'lowpass', 260, 0.6, 0.9);
  sfxTone(t + 0.05, 1.6, 'sine', 55, 32, 0.5);
}
function sfxWhistle() {                                     // F5: silbido del Sombrerón: sube, baja y vuelve a subir
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxTone(t, 0.35, 'sine', 1300, 2100, 0.35);
  sfxTone(t + 0.35, 0.3, 'sine', 2100, 1500, 0.35);
  sfxTone(t + 0.65, 0.55, 'sine', 1500, 2600, 0.4);
  sfxNoise(t, 1.2, 'bandpass', 2000, 4, 0.08);
}
function sfxBossSlamWind() {                                // F5.5c: levanta los brazos: gruñido que sube
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, T = CONFIG.BOSS.slamWind;
  sfxTone(t, T, 'sawtooth', 55, 95, 0.25);
  sfxNoise(t, T, 'lowpass', 400, 0.8, 0.2);
}
function sfxBossSlam(dist) {                                // F5.5c: golpe al piso: impacto grave y tierra
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, k = Math.max(0.2, 1 - dist / 30);
  sfxTone(t, 0.6, 'sine', 65, 28, 1.0 * k);
  sfxNoise(t, 0.5, 'lowpass', 600, 0.7, 0.8 * k);
  sfxNoise(t + 0.04, 0.35, 'bandpass', 1800, 0.8, 0.2 * k);          // piedritas
}
//--- F5.5b: guitarras y minigun del Sombrerón ---
function sfxGuitarWind() {                                  // levanta la guitarra: rasguido desafinado
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  [196, 247, 294, 370].forEach((f, i) => sfxTone(t + i * 0.03, 0.7, 'triangle', f, f * 0.98, 0.1));
}
function sfxGuitarThrow() {                                 // la tira: zumbido de aire
  if (!audioOn()) return;
  sfxNoise(AUDIO.ctx.currentTime, 0.4, 'bandpass', 600, 0.8, 0.3);
}
function sfxGuitarBreak(dist) {                             // madera que se parte + cuerdas que saltan
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, k = Math.max(0.15, 1 - dist / 35);
  sfxNoise(t, 0.12, 'bandpass', 1300, 1, 0.5 * k); sfxNoise(t + 0.05, 0.1, 'bandpass', 800, 1, 0.4 * k);
  [330, 494].forEach((f, i) => sfxTone(t + 0.02 + i * 0.04, 0.5, 'sawtooth', f, f * 0.7, 0.08 * k));
}
function sfxMinigunSpin() {                                 // la minigun arranca a girar: zumbido que sube
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, T = CONFIG.BOSS.gunSpin;
  sfxTone(t, T + 0.2, 'sawtooth', 60, 260, 0.14);
  sfxNoise(t, T, 'bandpass', 1500, 2, 0.12);
}
function sfxCocoShot(dist) {                                // cada coco: golpe hueco, más bajo lejos
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, k = Math.max(0.2, 1 - dist / 35);
  sfxNoise(t, 0.05, 'bandpass', 700, 1.5, 0.4 * k);
  sfxTone(t, 0.06, 'sine', 180, 90, 0.35 * k);
}
function sfxBossRoar() {                                    // F5: aparece / embiste / muere: rugido grave
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxTone(t, 1.3, 'sawtooth', 70, 42, 0.45);
  sfxTone(t, 1.3, 'sawtooth', 104, 60, 0.25);
  sfxNoise(t, 1.2, 'lowpass', 500, 0.8, 0.35);
}

//--- F6: salida posicional. Devuelve el nodo al que se conecta un sonido que sale de (x, y, z).
// Con PannerNode (HRTF) se oye adelante/atrás/arriba; la distancia la maneja cada sonido (rolloff 0).
// Sin PannerNode: paneo estéreo (+ = a tu derecha) y, si viene de atrás, un poco más apagado
function spatialOut(x, y, z, dest) {
  const c = AUDIO.ctx, P = player.pos, out = dest || AUDIO.sfx;
  const dx = x - P.x, dy = y - P.y, dz = z - P.z, cs = Math.cos(player.yaw), sn = Math.sin(player.yaw);
  const right = dx * cs - dz * sn, back = dx * sn + dz * cs;          // marco del oyente: mira hacia -z
  if (CONFIG.AUDIO.hrtf && c.createPanner) {
    const p = c.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'linear'; p.rolloffFactor = 0; p.refDistance = 1;
    if (p.positionX) { p.positionX.value = right; p.positionY.value = dy; p.positionZ.value = back; }
    else p.setPosition(right, dy, back);
    p.connect(out);
    return p;
  }
  if (!c.createStereoPanner) return out;
  const d = Math.hypot(right, back), pan = c.createStereoPanner();
  pan.pan.value = Math.max(-1, Math.min(1, right / Math.max(d, 1e-3))) * 0.85;
  if (back > 0.5) {                                                    // detrás: sin agudos
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    lp.connect(out); pan.connect(lp);
  } else pan.connect(out);
  return pan;
}

//--- gruñidos: sierra con vibrato -> formante (boca) -> oclusión -> paneo. Cada zombie tiene su voz ---
function sfxGrowl(z, kind) {
  if (!audioOn()) return;
  const A = CONFIG.AUDIO, P = player.pos;
  const dx = z.px - P.x, dz = z.pz - P.z, d = Math.hypot(dx, dz);
  if (d > A.growlMaxDist) return;
  const c = AUDIO.ctx, t = c.currentTime, v = z.voice || 1;
  const dur = kind === 'death' ? rnd(0.8, 1.2) : kind === 'attack' ? rnd(0.25, 0.4) : rnd(0.5, 1.1);
  const f0 = (kind === 'attack' ? 140 : 95) * v * rnd(0.9, 1.1);
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * (kind === 'death' ? 0.45 : rnd(0.7, 0.95)), t + dur);
  const lfo = c.createOscillator(), lg = c.createGain();
  lfo.frequency.value = rnd(5, 11); lg.gain.value = f0 * rnd(0.04, 0.12);
  lfo.connect(lg); lg.connect(o.frequency);
  const n = c.createBufferSource(), ng = c.createGain();
  n.buffer = AUDIO.noise; ng.gain.value = 0.35;
  const form = c.createBiquadFilter();
  form.type = 'bandpass'; form.frequency.value = rnd(380, 900) * v; form.Q.value = rnd(2, 5);
  const clear = segmentClear(P.x, P.z, z.px, z.pz, 0, true);   // detrás de una pared: apagado y más bajo
  const occl = c.createBiquadFilter();
  occl.type = 'lowpass'; occl.frequency.value = clear ? 3200 : 500;
  const peak = Math.max(0.0002, (kind === 'death' ? 0.9 : kind === 'attack' ? 1.0 : 0.7) * (clear ? 1 : 0.5) / (1 + d * 0.18));
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.06);
  g.gain.setValueAtTime(peak, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(form); n.connect(ng); ng.connect(form); form.connect(occl); occl.connect(g);
  g.connect(spatialOut(z.px, (z.level ? UP.y : groundY(z.px, z.pz)) + 1.4, z.pz));   // F6: 3D (HRTF) o estéreo
  o.start(t); lfo.start(t); n.start(t, Math.random());
  o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05); n.stop(t + dur + 0.05);
  AUDIO.lastGrowl = t;
}
function updateZombieAudio(dt) {
  if (!audioOn() || !state.running) return;
  const A = CONFIG.AUDIO, t = AUDIO.ctx.currentTime;
  zombieSteps(dt);                                        // F6: pasos, en 3D
  for (const z of state.zombies) {
    if (!z.alive || z.state !== 'walk') continue;
    z.growlT -= dt;
    if (z.growlT > 0) continue;
    z.growlT = rnd(A.growlMin, A.growlMax);
    if (t - AUDIO.lastGrowl < A.growlGap) continue;       // limitador global
    sfxGrowl(z, 'idle');
  }
}

//--- olas en loop: ruido marrón con oleaje (LFO lento) + espuma (siseo) desfasada. Se apaga adentro ---
function startAmbience() {
  const c = AUDIO.ctx, now = c.currentTime;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(AUDIO.amb);
  const sea = c.createBufferSource(); sea.buffer = AUDIO.brown; sea.loop = true;
  const seaF = c.createBiquadFilter(); seaF.type = 'lowpass'; seaF.frequency.value = 700;
  const seaG = c.createGain(); seaG.gain.value = 0.55;
  const lfo = c.createOscillator(); lfo.frequency.value = 0.09;
  const lfoG = c.createGain(); lfoG.gain.value = 0.4;
  lfo.connect(lfoG); lfoG.connect(seaG.gain);
  sea.connect(seaF); seaF.connect(seaG); seaG.connect(lp);
  const foam = c.createBufferSource(); foam.buffer = AUDIO.noise; foam.loop = true;
  const foamF = c.createBiquadFilter(); foamF.type = 'bandpass'; foamF.frequency.value = 3000; foamF.Q.value = 0.4;
  const foamG = c.createGain(); foamG.gain.value = 0.05;
  const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.09;
  const lfo2G = c.createGain(); lfo2G.gain.value = 0.05;
  lfo2.connect(lfo2G); lfo2G.connect(foamG.gain);
  foam.connect(foamF); foamF.connect(foamG); foamG.connect(lp);
  sea.start(now); foam.start(now); lfo.start(now); lfo2.start(now + 1.6);   // la espuma llega después de la ola
  AUDIO.ambLP = lp;
  // F6: viento (ruido marrón por un pasabanda que sube y baja) y bichos de la jungla (chirrido con trémolo).
  // Los dos loops se crean acá, una vez, y updateAmbience les sube o baja el volumen según la zona
  const loop = (buf, type, f, q, lfoHz, lfoAmt) => {
    const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(); g.gain.value = 0;
    const out = c.createGain(); out.gain.value = 1;
    const l = c.createOscillator(); l.frequency.value = lfoHz;
    const lg = c.createGain(); lg.gain.value = lfoAmt;
    l.connect(lg); lg.connect(out.gain);
    s.connect(fl); fl.connect(out); out.connect(g); g.connect(AUDIO.master);
    s.start(now); l.start(now);
    return { g, f: fl };
  };
  AUDIO.wind = loop(AUDIO.brown, 'bandpass', 420, 0.6, 0.13, 0.6);
  AUDIO.bugs = loop(AUDIO.noise, 'bandpass', 5200, 6, 17, 0.9);
  AUDIO.nextDrip = now + 1; AUDIO.nextBird = now + 3;
}
// F6: olas según la distancia al mar (fuertes en la playa, bajas tierra adentro), apagadas bajo techo y casi
// nada en el sótano y el búnker; viento en el muelle y arriba (techo, templo); bichos en la jungla (más de
// noche); gotas en el sótano y el búnker; pájaros en la jungla de día
function ambienceZone() {
  const P = player.pos, r = roomAt(P.x, P.z), id = r ? r.id : 'R1';
  const deep = id === 'R7' || id === 'R16' || (typeof inBunker === 'function' && inBunker());
  const up = playerLevel() === 1;
  const outdoor = !deep && (up || (r ? !!r.outdoor : true));
  const sea = Math.max(0, Math.min(1, 1 - (P.z - SEA.z0 - 14) / CONFIG.AUDIO.seaFar));   // 1 cerca de la orilla
  const jungle = !!r && (r.floor === 'jungle' || id === 'R15' || id === 'R17') && !up;
  return { id, deep, up, outdoor, sea, jungle, pier: id === 'R11' || id === 'C13' };
}
function updateAmbience() {
  if (!audioOn()) return;
  const A = CONFIG.AUDIO, t = AUDIO.ctx.currentTime, Z = ambienceZone(), fx = SETTINGS.sfx * (state.running ? 1 : 0.6);
  const waves = Z.deep ? 0.25 : Z.outdoor ? 0.35 + 0.65 * Z.sea : 0.55 * (0.4 + 0.6 * Z.sea);
  AUDIO.amb.gain.setTargetAtTime(A.ambience * waves * fx, t, 0.6);
  AUDIO.ambLP.frequency.setTargetAtTime(Z.deep ? 260 : Z.outdoor ? 700 + 900 * Z.sea : 520, t, 0.6);
  if (!AUDIO.wind) return;
  const night = typeof NIGHT !== 'undefined' ? NIGHT.k || 0 : 0;
  AUDIO.wind.g.gain.setTargetAtTime(A.wind * fx * (Z.pier || Z.up ? 1 : Z.outdoor ? 0.3 : 0), t, 0.8);
  AUDIO.bugs.g.gain.setTargetAtTime(A.insects * fx * (Z.jungle ? 0.6 + 0.8 * night : 0), t, 0.8);
  if (Z.deep && t > AUDIO.nextDrip) {                                  // gota que cae en un charco
    AUDIO.nextDrip = t + randIn(A.dripEvery);
    const f = rnd(900, 1500);
    sfxTone(t, 0.09, 'sine', f, f * 2.2, 0.08 * fx);
    sfxTone(t + 0.11, 0.06, 'sine', f * 1.4, f * 2.6, 0.03 * fx);    // eco
  }
  if (Z.jungle && night < 0.5 && t > AUDIO.nextBird) {                 // pájaro: dos o tres silbidos que bajan
    AUDIO.nextBird = t + randIn(A.birdEvery);
    const f = rnd(1800, 3200), n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) sfxTone(t + i * 0.13, 0.1, 'sine', f * (1 + 0.1 * i), f * 0.7, 0.05 * fx);
  }
}

function sfxHit(head) {
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, r = 0.94 + Math.random() * 0.12;   // variación: no suena clonado
  sfxTone(t, 0.09, 'sine', 160 * r, 55, 0.55);                        // golpe sordo en carne
  sfxNoise(t, 0.08, 'bandpass', 900 * r, 1.2, 0.45);                  // textura húmeda
  if (head) {
    sfxNoise(t, 0.05, 'highpass', 3000, 0.7, 0.5);                    // crack seco
    sfxTone(t, 0.14, 'triangle', 1650 * r, 980, 0.22);                // ping de headshot
  }
}
function sfxBuy() {
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxTone(t, 0.08, 'square', 880, 880, 0.12);                         // ca-
  sfxTone(t + 0.08, 0.18, 'square', 1320, 1320, 0.12);                // -ching
  sfxNoise(t, 0.06, 'highpass', 4000, 0.7, 0.2);
}
function sfxDeny() {
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxTone(t, 0.16, 'sawtooth', 140, 110, 0.18);                       // buzz sordo
}

//=== F6: pasos por superficie, música procedural y tambor de ronda ===========
// superficie bajo (x, z) a la altura de los pies: el piso del cuarto, el agua (pileta y arena mojada), la
// piedra del templo, las tablas del techo y el concreto del búnker
const STEP_FLOOR = { deck: 'wood', woodLight: 'wood', wood: 'wood', pier: 'wood', tile: 'tile', poolDeck: 'tile',
  conc: 'conc', concWet: 'conc', sand: 'sand', grass: 'grass', jungle: 'grass' };
function surfaceAt(x, z, feet) {
  const r = roomAt(x, z);
  if (r && r.id === 'R16') return 'conc';
  const T = CONFIG.TEMPLE, TC = T.clear;
  if (feet > 2.5) return x >= T.top.x1 - 0.5 && z >= T.top.z1 - 0.5 ? 'stone' : 'wood';   // templo o techo
  if (feet > 0.15 && x > TC[0] && x < TC[1] && z > TC[2] && z < TC[3]) return 'stone';     // rampas del templo
  if (groundY(x, z) < -0.1 || wetSandMul(x, z) < 1) return 'water';
  return r ? STEP_FLOOR[r.floor] || 'sand' : 'sand';
}
// capas como SHOT_SFX: [n=ruido | t=tono, dur, tipo, f, q/f1, pico]
const STEP_SFX = {
  wood:  [['t', .07, 'sine', 120, 70, .5], ['n', .06, 'bandpass', 700, 2, .35]],
  sand:  [['n', .12, 'lowpass', 900, .7, .4], ['n', .06, 'bandpass', 2500, 1, .12]],
  conc:  [['t', .05, 'sine', 95, 60, .45], ['n', .04, 'highpass', 2500, .7, .25]],
  tile:  [['t', .04, 'sine', 140, 90, .35], ['n', .03, 'bandpass', 3500, 4, .35]],
  water: [['n', .18, 'bandpass', 1200, 1, .45], ['n', .1, 'highpass', 3000, .7, .15]],
  grass: [['n', .09, 'bandpass', 4000, .7, .3], ['n', .07, 'lowpass', 600, .7, .2]],
  stone: [['t', .06, 'sine', 85, 55, .5], ['n', .05, 'bandpass', 1800, 1.5, .3]]
};
// un paso: vol relativo; pos = de dónde sale (zombies, en 3D); sin pos, el jugador (centrado)
function sfxStep(surf, vol, pos) {
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, r = rnd(0.9, 1.1), L = STEP_SFX[surf] || STEP_SFX.sand;
  const dest = pos ? spatialOut(pos.x, pos.y, pos.z) : AUDIO.sfx;
  for (const [k, dur, type, f, q, peak] of L) {
    if (k === 'n') sfxNoise(t, dur, type, f * r, q, peak * vol, dest);
    else sfxTone(t, dur, type, f * r, q * r, peak * vol, dest);
  }
}
// pasos del jugador: cada stepLen m caminados en el piso (corriendo, pasos más largos y fuertes)
const FOOT = { x: 0, z: 0, acc: 0, init: false, steps: 0, last: null };
function updateFootsteps(dt) {
  const A = CONFIG.AUDIO, P = player.pos;
  if (!FOOT.init) { FOOT.x = P.x; FOOT.z = P.z; FOOT.init = true; }
  const d = Math.hypot(P.x - FOOT.x, P.z - FOOT.z);
  FOOT.x = P.x; FOOT.z = P.z;
  if (d > 2) { FOOT.acc = 0; return; }                                 // teletransporte (escotilla, reset)
  if (!player.grounded || dt <= 0) return;
  const run = d / dt > CONFIG.PLAYER.speed * 1.1, len = run ? A.stepLenRun : A.stepLen;
  FOOT.acc += d;
  if (FOOT.acc < len) return;
  FOOT.acc -= len;
  FOOT.last = surfaceAt(P.x, P.z, P.y - CONFIG.PLAYER.height);
  FOOT.steps++;
  sfxStep(FOOT.last, A.stepVol * (run ? 1.4 : 1));
}
// pasos de zombies (desde updateZombieAudio): cada uno según su paso, cerca, con tope global por segundo
function zombieSteps(dt) {
  const A = CONFIG.AUDIO, P = player.pos, E = A.zStepEvery, t = AUDIO.ctx.currentTime;
  if (t - (AUDIO.zStepT0 || 0) >= 1) { AUDIO.zStepT0 = t; AUDIO.zStepN = 0; }
  for (const z of state.zombies) {
    if (!z.alive || z.state !== 'walk') continue;
    const d = Math.hypot(z.px - P.x, z.pz - P.z);
    if (d > A.zStepDist) continue;
    if ((z.stepT = (z.stepT || 0) - dt) > 0) continue;
    const key = z.boss ? 'boss' : z.dog ? 'dog' : z.squid ? 'squid' : z.gait || 'walk';
    z.stepT = (E[key] || E.walk) * (z.crawl ? 1.6 : 1) * rnd(0.9, 1.1);
    if (AUDIO.zStepN >= A.zStepMax) continue;
    AUDIO.zStepN++;
    const y = z.level ? UP.y : groundY(z.px, z.pz);
    sfxStep(surfaceAt(z.px, z.pz, y), (z.boss ? 1.4 : z.dog ? 0.5 : 0.8) / (1 + d * 0.25), { x: z.px, y: y + 0.1, z: z.pz });
  }
}

// música: marimba grave que se arma en capas según la intensidad (ronda, mobs), y un tema propio mientras
// hay un boss vivo (frigio, bombo en cada negra, bordón y golpes de metal). Las notas se agendan con
// musicLookahead s de adelanto en el bus AUDIO.music; su volumen baja cuando gruñe un zombie o hay uno cerca
const MUSIC = { next: 0, step: 0, bar: 0, notes: 0, boss: false, k: 0 };
const MUSIC_CALM = { scale: [0, 3, 5, 7, 10], roots: [0, 8, 5, 7] };            // menor pentatónica: Am F Dm Em
const MUSIC_BOSS = { scale: [0, 1, 3, 5, 7, 8, 10], roots: [0, 1, 0, -2] };     // frigio
function mhash(a, b) { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); }
function marimba(t, f, peak) {
  const M = AUDIO.music;
  sfxTone(t, 0.55, 'sine', f, f * 0.998, peak, M);
  sfxTone(t, 0.12, 'sine', f * 4, f * 3.98, peak * 0.22, M);                     // el golpe de la tecla
  MUSIC.notes++;
}
function musicIntensity() {
  const n = Math.max(1, state.round || 1);
  let k = Math.min(1, (n - 1) / 14);
  if (roundState.mob) k = Math.min(1, k + 0.25);
  if (roundState.phase !== 'active') k *= 0.4;                                   // entre rondas, tranquila
  return k;
}
function musicStep(s, t, boss, k) {
  const M = AUDIO.music, P = boss ? MUSIC_BOSS : MUSIC_CALM, bar = MUSIC.bar;
  const root = 110 * Math.pow(2, P.roots[bar % 4] / 12);
  if (s === 0) marimba(t, root * 0.5, 0.5);                                     // bajo
  if (s === 4) marimba(t, root * 0.5 * 1.5, 0.2 + 0.15 * k);                    // la quinta
  {                                                                              // melodía: más notas con la intensidad
    const h = mhash(bar % 8, s);
    if (h < 0.2 + 0.45 * k || (boss && h < 0.6)) {
      const deg = P.scale[Math.floor(mhash(s, bar % 8 + 3) * P.scale.length)];
      marimba(t, root * 2 * Math.pow(2, deg / 12), 0.22 + 0.12 * k);
    }
  }
  if ((k > 0.35 || boss) && s % 2 === 1) { sfxNoise(t, 0.03, 'highpass', 7000, 0.7, 0.05 + 0.04 * k, M); MUSIC.notes++; }   // shaker
  if ((k > 0.55 && (s === 0 || s === 4)) || (boss && s % 2 === 0)) {            // bombo
    sfxTone(t, 0.2, 'sine', 75, 40, 0.5, M); MUSIC.notes++;
  }
  if ((k > 0.7 || boss) && bar % 4 === 3 && s >= 6) {                           // redoble al final de la frase
    sfxTone(t, 0.12, 'sine', 180 - s * 10, 90, 0.3, M); sfxTone(t + 0.07, 0.12, 'sine', 170 - s * 10, 85, 0.25, M);
    MUSIC.notes += 2;
  }
  if (boss && s === 0) {                                                          // bordón y golpe de metal
    sfxTone(t, 2.2, 'triangle', root * 0.25, root * 0.25, 0.18, M);
    if (bar % 2 === 0) sfxNoise(t, 0.4, 'bandpass', 1400, 3, 0.12, M);
    MUSIC.notes += 2;
  }
}
function updateMusic() {
  if (!audioOn() || !AUDIO.music) return;
  const A = CONFIG.AUDIO, t = AUDIO.ctx.currentTime, P = player.pos;
  const playing = state.running && !state.gameOver;
  // volumen: los zombies mandan
  let near = Infinity;
  for (const z of state.zombies) if (z.alive) near = Math.min(near, Math.hypot(z.px - P.x, z.pz - P.z));
  let g = playing ? A.music * SETTINGS.music : 0;
  if (t - AUDIO.lastGrowl < 0.5) g *= A.musicDuck;
  if (near < A.musicNearDist) g *= A.musicNearDuck;
  AUDIO.music.gain.setTargetAtTime(g, t, 0.08);
  if (!playing) return;
  const boss = typeof bossAlive === 'function' && bossAlive();
  const k = musicIntensity();
  MUSIC.boss = boss; MUSIC.k = k;
  const bpm = boss ? A.bossBpm : Math.min(A.bpmMax, A.musicBpm + A.bpmPerRound * Math.max(0, (state.round || 1) - 1));
  const eighth = 30 / bpm;
  if (MUSIC.next < t) MUSIC.next = t + 0.05;                                     // arranque o vuelta de la pausa
  while (MUSIC.next < t + A.musicLookahead) {
    musicStep(MUSIC.step, MUSIC.next, boss, k);
    MUSIC.next += eighth;
    if (++MUSIC.step === 8) { MUSIC.step = 0; MUSIC.bar++; }
  }
}

// anuncio de ronda: tambor grave con la campanada; cada drumLongEvery rondas, un redoble largo que crece
function sfxRoundDrum(n) {
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime, hit = (tt, p) => { sfxTone(tt, 0.5, 'sine', 80, 45, p); sfxNoise(tt, 0.3, 'lowpass', 320, 0.7, p * 0.5); };
  if (n % CONFIG.AUDIO.drumLongEvery === 0) {
    for (let i = 0; i < 10; i++) hit(t + i * 0.12 * (1 - i * 0.04), 0.15 + i * 0.05);
    hit(t + 1.25, 0.9); hit(t + 1.6, 0.7);
  } else { hit(t, 0.7); hit(t + 0.35, 0.5); }
}

