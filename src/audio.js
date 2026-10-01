//--- AUDIO: todo procedural (Web Audio), sin archivos ---
// sfx -> compresor -> master; olas -> filtro de ambiente -> amb -> master. master = SETTINGS.volume.
// Sin AudioContext (harness, navegador viejo) todas las funciones salen sin hacer nada.
// Loops persistentes (se crean UNA vez): olas (2 fuentes + 2 LFO) y lanzallamas (1 fuente, lazy).
// F6: volúmenes separados (general, música, efectos) y música por su propio bus
const SETTINGS = { sens: 1, volume: CONFIG.AUDIO.master, music: 1, sfx: 1, dmgNumbers: true, scale: 1 };   // F5.11: números de daño (F5.19d: scale = resolución)
const AUDIO = { ctx: null, master: null, sfx: null, amb: null, ambLP: null, noise: null, brown: null,
  lastGrowl: -9, lastDry: 0, flame: null, music: null, wind: null, bugs: null };
function audioOn() { return !!AUDIO.ctx && AUDIO.ctx.state === 'running'; }
function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!AUDIO.ctx) {
    const ctx = new AC(), A = CONFIG.AUDIO, sr = ctx.sampleRate;
    const master = ctx.createGain(); master.gain.value = SETTINGS.volume; master.connect(ctx.destination);
    // F5.19c: todo lo de la partida (efectos, ambiente, música procedural, viento y bichos) pasa por `game`, que se
    // calla en la pausa y al morir (updateGameAudio). El soundtrack del menú y la música de muerte van directo al master
    const game = ctx.createGain(); game.gain.value = 1; game.connect(master);
    const comp = ctx.createDynamicsCompressor(); comp.connect(game);     // la escopeta + 8 gruñidos no saturan
    const sfx = ctx.createGain(); sfx.gain.value = A.sfx * SETTINGS.sfx; sfx.connect(comp);
    const amb = ctx.createGain(); amb.gain.value = 0; amb.connect(game);
    const music = ctx.createGain(); music.gain.value = 0; music.connect(game);   // F6: lo maneja updateMusic
    AUDIO.game = game; AUDIO.gameOn = true;
    const noise = ctx.createBuffer(1, sr * 2, sr), d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const brown = ctx.createBuffer(1, sr * 6, sr), b = brown.getChannelData(0);   // ruido marrón = rumor de mar
    let last = 0;
    for (let i = 0; i < b.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    const fade = Math.floor(sr * 0.3);                   // sin click en el borde del loop
    for (let i = 0; i < fade; i++) { const k = i / fade; b[i] *= k; b[b.length - 1 - i] *= k; }
    Object.assign(AUDIO, { ctx, master, sfx, amb, noise, brown, music });
    startAmbience();
    loadSamples();                                        // F5.19: los sonidos de sonidos/
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
  chopper: [['n', .12, 'bandpass', 1100, .6, .7], ['t', .12, 'square', 95, 50, .35], ['n', .05, 'highpass', 3500, .7, .25]],   // F5.19: traqueteo oxidado
  pigiron: [['n', .2, 'lowpass', 900, .8, 1.0], ['t', .2, 'sine', 70, 35, 1.0]],                                              // F5.19: grave y pesado
  leviathan: [['n', .12, 'bandpass', 1800, 1, .8], ['t', .1, 'sine', 160, 60, .8], ['t', .16, 'sawtooth', 420, 90, .18]],     // F5.19: con zumbido
  sniper:  [['n', .6, 'lowpass', 2600, .7, 1], ['t', .45, 'sine', 80, 34, 1], ['n', .05, 'highpass', 3600, .7, .8],
            ['n', .9, 'bandpass', 600, .8, .22, .22]],                                  // eco
  marksman: [['n', .35, 'lowpass', 3200, .7, .9], ['t', .3, 'sine', 110, 45, .9], ['n', .05, 'highpass', 4000, .7, .7]],   // F5.19c
  farmhand: [['n', .7, 'lowpass', 1800, .7, 1], ['t', .5, 'sine', 70, 30, 1], ['n', .06, 'highpass', 3000, .7, .6]],
  raygun:  [['t', .25, 'square', 1400, 220, .22], ['t', .3, 'sine', 700, 110, .4], ['n', .1, 'highpass', 3000, .7, .2]],
  // F5.5: ola que rompe: golpe grave + agua que barre y espuma
  wave:    [['t', .35, 'sine', 90, 40, .9], ['n', .7, 'lowpass', 900, .6, .8], ['n', .9, 'bandpass', 2400, .5, .3, .12]]
};
// F5.19: disparos con sample de Diego (la M1911 al doble de velocidad, pedido suyo)
// [clave, velocidad (tono), volumen, corte en s (las automáticas cortan la cola: si no, se pisan)]
// F5.24 (Diego: "muchas pistolas no tienen sonido"): las que sonaban con el procedural flojo usan ahora las muestras de
// disparo que hay (pistola inicial, sniper, escopeta, ballesta) con un tono y un corte propios
const PISTOL_S = 'disparo_de_la_arma_inicial_pero_ponerla_en_2x';
const SHOT_SAMPLE = { m1911: [PISTOL_S, 2], sniper: ['sniper', 1], crossbow: ['ballesta', 1],
                      raygun: ['ray_gun_shooting_sound', 1],
                      marksman: ['sniper', 1.25], farmhand: ['sniper', 0.8],     // F5.19c: los snipers nuevos, con otro tono
                      shotgun: ['shotgun_disparo', 1], spas: ['shotgun_disparo', 1.12], doublebarrel: ['shotgun_disparo', 0.86],   // F5.20
                      // F5.24: pistolas pesadas (más grave que la M1911)
                      revolver: [PISTOL_S, 1.25, 1.05], deagle: [PISTOL_S, 1.1, 1.1],
                      // subfusiles: la pistola aguda y cortita
                      smg: [PISTOL_S, 2.5, 0.75, 0.3], uzi: [PISTOL_S, 2.8, 0.7, 0.26],
                      // rifles y LMG: el sniper más agudo y cortado (sin el eco largo)
                      rifle: ['sniper', 1.6, 0.8, 0.35], ak47: ['sniper', 1.45, 0.85, 0.35], lmg: ['sniper', 1.7, 0.75, 0.3],
                      chopper: ['sniper', 1.9, 0.7, 0.25], pigiron: ['sniper', 1.25, 0.9, 0.4], leviathan: ['sniper', 1.55, 0.85, 0.32],
                      // el arco: la ballesta más aguda; la bazooka: la escopeta muy grave (el cohete saliendo)
                      bow: ['ballesta', 1.2, 0.9], bazooka: ['shotgun_disparo', 0.55, 1.1] };
function sfxShot(def) {
  if (!audioOn() || def.flame) return;                  // el lanzallamas es un loop (updateFlameAudio)
  voice('audio_del_personaje_al_dispararle_a_zombies', 0.03, 40);
  // F5.19c (Diego): las armas con Pack-a-Punch suenan con PAP GUN SHOOT, con un tono propio por arma (más grave las
  // pesadas, más agudo las chicas) y un poco de variación por tiro
  if (def.pap && hasSample('pap_gun_shoot')) {
    const pr = papShotRate(def), vol = def.id === 'sniper' || def.id === 'bazooka' ? 1 : 0.85;
    if (playSample('pap_gun_shoot', { rate: pr * (0.96 + Math.random() * 0.08), vol })) return;
  }
  const S = SHOT_SAMPLE[def.id];
  if (S && playSample(S[0], { rate: S[1] * (0.97 + Math.random() * 0.06), vol: 0.9 * (S[2] || 1), max: S[3] })) return;
  const t = AUDIO.ctx.currentTime, r = 0.94 + Math.random() * 0.12;
  for (const L of SHOT_SFX[def.id] || SHOT_SFX.m1911) {
    const at = t + (L[6] || 0);
    if (L[0] === 'n') sfxNoise(at, L[1], L[2], L[3] * r, L[4], L[5]);
    else sfxTone(at, L[1], L[2], L[3] * r, L[4] * r, L[5]);
  }
}
// tono del disparo con PaP: según el daño por bala (pesadas graves) y un corrimiento fijo por arma (no suenan iguales)
function papShotRate(def) {
  let h = 0; for (const ch of def.id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const heavy = Math.min(1, Math.max(0, Math.log10(Math.max(10, def.damage || 40)) - 1.3) / 1.4);   // 0 chica -> 1 pesada
  return (1.25 - 0.5 * heavy) * (0.94 + (h % 13) / 100);
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
// F5.20: + las recargas de Nuevos sonidos 2 (machine gun para las LMG, rifle para rifle/AK/SMG/UZI, sniper, revólver)
const RELOAD_SAMPLE = { raygun: ['raygun_recarga', 'raygun_recarga_2'], crossbow: ['recarga_ballesta'],
                        shotgun: ['shotgun_reload'], spas: ['shotgun_reload'], doublebarrel: ['shotgun_reload'],
                        lmg: ['machine_gun_reload'], chopper: ['machine_gun_reload'], pigiron: ['machine_gun_reload'], leviathan: ['machine_gun_reload'],
                        rifle: ['rifle_reload'], ak47: ['rifle_reload'], smg: ['rifle_reload'], uzi: ['rifle_reload'],
                        sniper: ['sniper_reload'], marksman: ['sniper_reload'], farmhand: ['sniper_reload'], revolver: ['revolver_reload'] };
function sfxReload(step) {
  if (!audioOn()) return;
  const d = typeof curDef === 'function' && curDef(), RS = d && RELOAD_SAMPLE[d.id];
  if (RS && RS.some(hasSample)) { if (step === 0) playAny(RS); return; }   // F5.19: el sample entero en el primer paso
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
  const s = typeof curSlot === 'function' && curSlot();   // F5.19: sin balas del todo, el personaje se queja
  if (s && !s.mag && !s.reserve) voice(['audio_personaje_no_ammo', 'audio_personaje_no_ammo_2'], 1, 10);
  sfxNoise(AUDIO.ctx.currentTime, .025, 'highpass', 3500, 1, .3);
}
function sfxSwing() {
  if (!audioOn()) return;
  if (playSample('acuchillar', { rate: 0.95 + Math.random() * 0.1 })) return;   // F5.19
  const t = AUDIO.ctx.currentTime;
  sfxNoise(t, .16, 'bandpass', 900 + Math.random() * 300, 1.5, .35);
  sfxNoise(t + .03, .1, 'bandpass', 2000, 2, .15);
}
const HIT_Z = [1, '2_1', 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(n => 'golpe_z_' + n);   // F5.19: golpes de zombie
function sfxHurt(zombie) {
  if (!audioOn()) return;
  voice(['audio_personaje_al_ser_golpeado', 'audio_personaje_al_ser_golpeado_2', 'audio_personaje_al_ser_golpeado_3',
         'audio_personaje_al_ser_golpeado_4', 'audio_personaje_al_ser_golpeado_5'], 0.35, 5);
  if (zombie && playAny(HIT_Z, { vol: 0.9 })) return;             // F5.19: el golpe de zombie, solo si fue un zombie
  const t = AUDIO.ctx.currentTime;
  sfxTone(t, .2, 'sine', 90, 45, .7);
  sfxNoise(t, .15, 'lowpass', 400, .7, .5);
}
function sfxBell() {                                       // campanada de ronda: parciales inarmónicos, 2 golpes
  if (!audioOn()) return;
  if (playSample('cambio_de_ronda')) return;              // F5.19
  const t = AUDIO.ctx.currentTime, f = 196;
  [0, 1.1].forEach((dt, k) => {
    const a = k ? 0.6 : 1;
    [[1, .45, 3.4], [2.0, .25, 2.6], [2.76, .22, 1.9], [5.4, .1, 1.0], [0.5, .22, 3.8]]
      .forEach(([m, amp, dur]) => sfxTone(t + dt, dur, 'sine', f * m, f * m * 0.996, amp * a));
  });
}
const POWERUP_SAMPLE = { instakill: 'insta_kill', doublepoints: 'double_points', maxammo: 'max_ammo', kaboom: 'kaboom' };   // F5.19
function sfxPowerup(type) {
  if (!audioOn()) return;
  if (type === 'instakill' || type === 'doublepoints') voice('audio_del_personaje_al_insta_kill_o_double_points', 0.7, 20);
  if (type === 'kaboom') voice('audio_del_personaje_al_obtener_la_raygun_o_kaboom', 0.8, 20);
  if (playSample(POWERUP_SAMPLE[type])) return;
  const t = AUDIO.ctx.currentTime;
  const notes = type === 'instakill' ? [330, 262, 196] : type === 'doublepoints' ? [523, 784, 1047] : [392, 523, 659, 784];
  notes.forEach((n, i) => sfxTone(t + i * 0.09, 0.22, 'triangle', n, n, 0.3));
}
// F5.19: al abrir la caja suena la canción de la caja de Diego (y a veces el personaje); con ella no hay tic-tac
// (F5.19: el mp3 arranca con 1 s de silencio: se salta con offset)
function sfxBoxStart() {
  const ok = playSample('mystery_box', { offset: CONFIG.AUDIO.boxOffset });
  voice('audio_al_comprar_mystery_box', 0.3, 40);
  return ok;
}
function sfxBoxTick() {                                    // caja girando: cajita de música pentatónica
  if (!audioOn() || hasSample('mystery_box')) return;
  const penta = [523, 587, 659, 784, 880, 1047, 1175];
  const n = penta[Math.floor(Math.random() * penta.length)];
  sfxTone(AUDIO.ctx.currentTime, 0.14, 'triangle', n, n, 0.14);
}
function sfxTeddy() {
  if (!audioOn()) return;
  // F5.24 (Diego: "hay dos sonidos"): antes salía uno de los dos archivos al azar; ahora siempre el mismo
  if (playSample('se_va_la_mystery_box')) return;   // F5.19
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
  voice(['audio_del_personaje_al_pap', 'audio_del_personaje_al_pap_2'], 0.8, 8);   // F5.19
  if (playSample('drill')) return;                                           // F5.19: el taladro de Diego
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
// F5.19c: las canciones de Diego de cada perk. Suenan al acercarte (una vez por visita), en 3D, y bajan de volumen al
// alejarte hasta cortarse (updatePerkJingle)
const PERK_SONGS = { jugg: 'juger_music', revive: 'quick_revive_music', speed: 'speed_cola_music', stamin: 'stamin_up_music' };
function sfxJingle(key, m) {
  if (!audioOn()) return;
  const song = PERK_SONGS[key];
  if (song && hasSample(song) && m) {
    if (AUDIO.jingle) { try { AUDIO.jingle.src.stop(); } catch (e) {} }
    const c = AUDIO.ctx, src = c.createBufferSource(), g = c.createGain();
    src.buffer = SAMPLES.buf[song]; g.gain.value = 0;
    src.connect(g); g.connect(AUDIO.sfx); src.start();
    AUDIO.jingle = { src, g, m, end: c.currentTime + src.buffer.duration };
    return;
  }
  const t = AUDIO.ctx.currentTime, n = PERK_JINGLES[key] || PERK_JINGLES.revive;
  n.forEach((f, i) => sfxTone(t + i * 0.16, 0.24, 'triangle', f, f, 0.14));
}
// F5.19c: la música de Diego mientras se arma el escudo o la Ola (se corta si soltás F)
function craftMusic(on) {
  if (!audioOn()) return;
  const k = 'musica_al_construir_el_escudo_o_wonder_weapon_proceso', c = AUDIO.ctx;
  if (on && !AUDIO.craftSrc && hasSample(k)) {
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = SAMPLES.buf[k]; src.loop = true; g.gain.value = 0.8;
    src.connect(g); g.connect(AUDIO.sfx); src.start();
    AUDIO.craftSrc = { src, g };
  } else if (!on && AUDIO.craftSrc) {
    const S = AUDIO.craftSrc; AUDIO.craftSrc = null;
    S.g.gain.setTargetAtTime(0, c.currentTime, 0.1); S.src.stop(c.currentTime + 0.5);
  }
}
function updatePerkJingle() {
  const J = AUDIO.jingle;
  if (!J) return;
  const c = AUDIO.ctx, d = Math.hypot(player.pos.x - J.m.x, player.pos.z - J.m.z), R = CONFIG.AUDIO.jingleFade;
  if (d > R || c.currentTime > J.end) { J.g.gain.setTargetAtTime(0, c.currentTime, 0.3); try { J.src.stop(c.currentTime + 1); } catch (e) {} AUDIO.jingle = null; return; }
  J.g.gain.setTargetAtTime(CONFIG.AUDIO.jingleVol * SETTINGS.music * Math.max(0, 1 - d / R), c.currentTime, 0.2);
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
// F5.23 (Diego: "como en CoD"): con poca vida, latido grave y respiración agitada. lowHealthK() = 0 (media vida o más)
// a 1 (sin vida); el sonido arranca en CONFIG.AUDIO.lowHp.from. Los tiempos van por el reloj del juego (así el borde de
// sangre late junto con el corazón aunque no haya audio). Va por el bus de la partida: en pausa y al morir no suena
const LOWHP = { beatT: 0, beatAt: -9, breathT: 0, inhale: true };
function lowHealthK() {
  if (state.gameOver || DOWN.on) return 0;
  const half = maxHealth() / 2, hp = state.health;
  return hp < half ? Math.min(1, (half - hp) / half) : 0;
}
function lowHealthBeat() { return Math.exp(-(clock.elapsedTime - LOWHP.beatAt) * 7); }
function updateLowHealthAudio(v) {
  const L = CONFIG.AUDIO.lowHp, now = clock.elapsedTime;
  if (v < L.from || !state.running) { LOWHP.beatT = now; LOWHP.breathT = now; LOWHP.inhale = true; return; }
  const k = (v - L.from) / (1 - L.from);                    // 0..1 dentro de la zona de sonido
  if (now >= LOWHP.beatT) {                                  // latido: dos golpes (lub-dub)
    LOWHP.beatT = now + L.beat[0] + (L.beat[1] - L.beat[0]) * k; LOWHP.beatAt = now;
    if (audioOn()) {
      const t = AUDIO.ctx.currentTime, vol = L.beatVol * (0.6 + 0.4 * k);
      sfxTone(t, 0.16, 'sine', 70, 38, vol); sfxTone(t + 0.2, 0.13, 'sine', 62, 36, vol * 0.7);
      sfxNoise(t, 0.08, 'lowpass', 140, 0.7, vol * 0.35);
    }
  }
  if (now >= LOWHP.breathT) {                                // respiración: aspira (sube) y exhala (baja, más larga)
    const per = L.breath[0] + (L.breath[1] - L.breath[0]) * k;
    LOWHP.breathT = now + per * (LOWHP.inhale ? 0.42 : 0.58);
    if (audioOn()) {
      const t = AUDIO.ctx.currentTime, vol = L.breathVol * (0.55 + 0.45 * k);
      if (LOWHP.inhale) { sfxNoise(t, per * 0.34, 'bandpass', 1300, 1.6, vol); sfxNoise(t, per * 0.3, 'highpass', 2600, 0.8, vol * 0.4); }
      else { sfxNoise(t, per * 0.46, 'bandpass', 700, 1.1, vol * 1.1); sfxNoise(t + 0.03, per * 0.3, 'lowpass', 380, 0.9, vol * 0.5); }
    }
    LOWHP.inhale = !LOWHP.inhale;
  }
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
  if (playSample('boss_cuando_pega_al_piso', { vol: k }) || playSample('golpe_de_sombreron', { vol: k })) return;   // F5.19 (F5.19c: el nuevo)
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
  // F5.19: perros y calamares con los samples de Diego (en 3D)
  const pos = [z.px, (z.level ? lvY(z.level) : groundY(z.px, z.pz)) + 0.8, z.pz];
  // (F5.19: perros y calamares nunca caen al gruñido de zombie, haya sample o no)
  if (z.dog) { playAny(['perro_1', 'perro_2', 'perro_3', 'perro_4'], { pos, vol: 1.2, maxDist: A.growlMaxDist }); AUDIO.lastGrowl = AUDIO.ctx.currentTime; return; }
  if (z.kind === 'squid' || z.squid) {
    if (kind === 'death') playAny(['muerte_calamar', 'muerte_calamar_2'], { pos, vol: 1.2, maxDist: A.growlMaxDist });
    else if (kind === 'attack') playAny(['golpe_de_squid', 'golpe_de_squid_2'], { pos, maxDist: A.growlMaxDist });
    else playSample('calamar', { pos, vol: 0.9, maxDist: A.growlMaxDist });
    AUDIO.lastGrowl = AUDIO.ctx.currentTime; return;
  }
  if (z.boss) return;                                               // el boss tiene sus sonidos (boss.js)
  // F5.20 (Diego): gruñidos naturales (Nuevos sonidos 2) en vez de los procedurales. Cada zombie se queda con uno (z.gk)
  // y su tono (z.voice); el ataque sale más agudo y corto, la muerte más grave. Detrás de una pared, más bajo
  if (!SAMPLES.zg) SAMPLES.zg = Object.keys(SAMPLES.buf).filter(k => k.startsWith('zgrowl_'));
  if (SAMPLES.zg.length) {
    if (z.gk === undefined || z.gk >= SAMPLES.zg.length) z.gk = Math.floor(Math.random() * SAMPLES.zg.length);
    const clear = segmentClear(P.x, P.z, z.px, z.pz, 0, true), v = z.voice || 1;
    const rate = v * (kind === 'attack' ? 1.18 : kind === 'death' ? 0.82 : 1) * rnd(0.96, 1.04);
    const vol = (kind === 'death' ? 1.1 : kind === 'attack' ? 1.2 : 0.9) * (clear ? 1 : 0.45) * A.zGrowlVol;
    if (playSample(SAMPLES.zg[z.gk], { pos: [z.px, pos[1] + 0.6, z.pz], vol, rate, maxDist: A.growlMaxDist, max: kind === 'attack' ? 0.9 : 2.2 })) {
      AUDIO.lastGrowl = AUDIO.ctx.currentTime; return;
    }
  }
  if (!SAMPLES.zg.length) SAMPLES.zg = null;                          // (todavía no se decodificaron: volver a mirar)
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
  g.connect(spatialOut(z.px, (z.level ? lvY(z.level) : groundY(z.px, z.pz)) + 1.4, z.pz));   // F6: 3D (HRTF) o estéreo
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
    s.connect(fl); fl.connect(out); out.connect(g); g.connect(AUDIO.game || AUDIO.master);
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
  updatePerkJingle();                                                  // F5.19c
  if (Z.deep && t > AUDIO.nextDrip) {                                  // gota que cae en un charco
    AUDIO.nextDrip = t + randIn(A.dripEvery);
    if (hasSample('gotas')) { AUDIO.nextDrip += 4; playSample('gotas', { vol: 0.5 * fx, rate: 0.9 + Math.random() * 0.2 }); return; }   // F5.19c
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
// F5.19b: tablas de las barricadas. Arrancar = crujido de madera que se parte (más bajo de lejos); poner = martillazo
function sfxBoardTear(B) {
  if (!audioOn()) return;
  const d = Math.hypot(player.pos.x - B.x, player.pos.z - B.z), v = Math.max(0, 1 - d / 28);
  if (v <= 0) return;
  const t = AUDIO.ctx.currentTime;
  sfxNoise(t, 0.12, 'bandpass', 700 + Math.random() * 300, 2.5, 0.45 * v);
  sfxNoise(t + 0.05, 0.2, 'lowpass', 400, 1, 0.3 * v);
  sfxTone(t, 0.1, 'triangle', 220, 90, 0.12 * v);
}
function sfxBoardRepair() {
  if (!audioOn()) return;
  const t = AUDIO.ctx.currentTime;
  sfxTone(t, 0.06, 'square', 320, 180, 0.16);
  sfxNoise(t, 0.05, 'bandpass', 1800, 2, 0.3);
  sfxTone(t + 0.14, 0.06, 'square', 340, 190, 0.14);
  sfxNoise(t + 0.14, 0.05, 'bandpass', 1900, 2, 0.26);
}
function sfxDeny() {
  if (!audioOn()) return;
  voice('tratar_de_comprar_una_puerta_sin_dinero', 1, 10);   // F5.19
  const t = AUDIO.ctx.currentTime;
  sfxTone(t, 0.16, 'sawtooth', 140, 110, 0.18);                       // buzz sordo
}

//=== F6: pasos por superficie, música procedural y tambor de ronda ===========
// superficie bajo (x, z) a la altura de los pies: el piso del cuarto, el agua (pileta y arena mojada), la
// piedra del templo, las tablas del techo y el concreto del búnker
const STEP_FLOOR = { deck: 'wood', woodLight: 'wood', wood: 'wood', pier: 'wood', tile: 'tile', poolDeck: 'tile',
  conc: 'conc', concWet: 'conc', sand: 'sand', grass: 'grass', jungle: 'grass', rock: 'stone' };   // F5.19: el claro del caparazón
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
    const y = z.level ? lvY(z.level) : groundY(z.px, z.pz);
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
  const zone = updateZoneTracks(playing);                                               // F5.19c: templo, búnker, boss
  if (updateTrack(playing)) { AUDIO.music.gain.setTargetAtTime(0, t, 0.2); return; }   // F5.19: el soundtrack de Diego
  if (zone) { AUDIO.music.gain.setTargetAtTime(0, t, 0.3); return; }
  // volumen: los zombies mandan
  let near = Infinity;
  for (const z of state.zombies) if (z.alive) near = Math.min(near, Math.hypot(z.px - P.x, z.pz - P.z));
  let g = playing ? A.music * SETTINGS.music : 0;
  if (t - AUDIO.lastGrowl < 0.5) g *= A.musicDuck;
  if (near < A.musicNearDist) g *= A.musicNearDuck;
  AUDIO.music.gain.setTargetAtTime(g, t, 0.08);
  if (!playing) return;
  // (sin la pista de Diego, en la pelea del Kraken suena el tema procedural del boss)
  const boss = (typeof bossAlive === 'function' && bossAlive()) || (typeof EE !== 'undefined' && !!EE.fight);
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

//=== F5.19: los sonidos de Diego (carpeta sonidos/). build.js los embebe en index.html como un bloque JSON aparte
// (<script type="application/json" id="bhzSounds">: no es código y el harness no lo ve). Se decodifican una vez,
// al primer gesto (initAudio). playSample(clave) suena si el sample está cargado y devuelve true; si no, el llamador
// sigue con el sonido procedural de siempre. voice() = líneas del personaje: una a la vez, con pausa mínima
const SAMPLES = { buf: {}, loading: false, voiceUntil: 0, gap: {}, track: null, trackG: null };
function loadSamples() {
  if (SAMPLES.loading || !AUDIO.ctx || typeof document === 'undefined' || !document.getElementById) return;
  SAMPLES.loading = true;
  const el = document.getElementById('bhzSounds');
  if (!el || !el.textContent) return;
  let data = null;
  try { data = JSON.parse(el.textContent); } catch (e) { return; }
  for (const k in data) {
    try {
      const bin = atob(data[k]), ab = new ArrayBuffer(bin.length), u = new Uint8Array(ab);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      AUDIO.ctx.decodeAudioData(ab).then(b => { SAMPLES.buf[k] = b; }, () => {});
    } catch (e) {}
  }
}
function hasSample(key) { return !!SAMPLES.buf[key]; }
// o = { vol, rate, dest, pos: [x, y, z] (3D), maxDist }. Devuelve true si sonó
function playSample(key, o) {
  if (!audioOn()) return false;
  const buf = SAMPLES.buf[key];
  if (!buf) return false;
  o = o || {};
  const c = AUDIO.ctx, src = c.createBufferSource(), g = c.createGain();
  src.buffer = buf; src.playbackRate.value = o.rate || 1;
  let vol = o.vol === undefined ? 1 : o.vol;
  if (o.pos) {
    const d = Math.hypot(o.pos[0] - player.pos.x, o.pos[2] - player.pos.z);
    if (d > (o.maxDist || 40)) return false;
    vol /= 1 + d * 0.12;
    g.connect(spatialOut(o.pos[0], o.pos[1], o.pos[2]));
  } else g.connect(o.dest || AUDIO.sfx);
  g.gain.value = vol;
  const off = Math.min(o.offset || 0, Math.max(0, buf.duration - 0.05));   // F5.19: saltear silencio del principio
  // F5.20: o.max = segundos como mucho (los gruñidos largos se cortan con un fundido corto)
  const len = Math.min(buf.duration - off, o.max || Infinity) / (o.rate || 1), t0 = c.currentTime;
  // (F5.24: el fundido es como mucho el 40% de lo que suena: los disparos cortados de las automáticas duran ~0.1 s)
  if (o.max && len < (buf.duration - off) / (o.rate || 1)) { g.gain.setValueAtTime(vol, t0 + Math.max(0, len - Math.min(0.15, len * 0.4))); g.gain.linearRampToValueAtTime(0.0001, t0 + len); }
  src.connect(g); src.start(t0, off); src.stop(t0 + len + 0.05);
  return true;
}
// una de varias claves al azar (las que estén cargadas)
function playAny(keys, o) {
  const ok = keys.filter(hasSample);
  return ok.length ? playSample(ok[Math.floor(Math.random() * ok.length)], o) : false;
}
// línea del personaje: con probabilidad `chance`, si no está hablando y si esa línea no sonó hace menos de `gap` s
function voice(keys, chance, gap) {
  if (!audioOn()) return false;
  const t = AUDIO.ctx.currentTime, id = [].concat(keys).join('|');
  if (t < SAMPLES.voiceUntil || t < (SAMPLES.gap[id] || 0)) return false;
  if (chance !== undefined && Math.random() > chance) return false;
  const ok = [].concat(keys).filter(hasSample);
  if (!ok.length) return false;
  const k = ok[Math.floor(Math.random() * ok.length)];
  if (!playSample(k, { vol: CONFIG.AUDIO.voice })) return false;
  SAMPLES.voiceUntil = t + SAMPLES.buf[k].duration + 0.3; SAMPLES.gap[id] = t + (gap || 0);
  return true;
}
// el soundtrack, en loop por su propio volumen (el de la música). Mientras suena, la música procedural no toca
function updateTrack(playing) {
  if (!hasSample('game_soundtrack')) return false;
  const c = AUDIO.ctx;
  if (!SAMPLES.track) {
    SAMPLES.trackG = c.createGain(); SAMPLES.trackG.gain.value = 0; SAMPLES.trackG.connect(AUDIO.master);
    const s = c.createBufferSource(); s.buffer = SAMPLES.buf.game_soundtrack; s.loop = true; s.connect(SAMPLES.trackG); s.start();
    SAMPLES.track = s;
  }
  // F5.19 (Diego): el soundtrack es solo del menú de inicio (ni en partida, ni en pausa, ni al morir)
  // F5.19c: MENU.started = hay una partida en curso (también en la pausa); al salir de la partida se corta rápido
  const menu = !playing && !state.gameOver && typeof MENU !== 'undefined' && MENU.mode === 'main' && !MENU.started &&
               !(typeof DEATH !== 'undefined' && DEATH.on);
  SAMPLES.trackG.gain.setTargetAtTime(menu ? CONFIG.AUDIO.track * SETTINGS.music : 0, c.currentTime, menu ? 0.4 : 0.05);
  return menu;
}
// F5.19c: músicas de Diego por lugar y momento (loops que se cruzan): boss con menos del 30% de vida > búnker (música +
// ambiente) > templo. Mientras suena una, la marimba procedural se calla. Van por `music` (la pausa y la muerte las callan)
const ZTRACKS = {};
function updateZoneTracks(playing) {
  const want = {}, A = CONFIG.AUDIO;
  if (playing) {
    const low = typeof BOSS !== 'undefined' && state.zombies.some(z => z.boss && z.alive && z.health < z.maxHealth * A.bossLowFrac);
    const r = roomAt(player.pos.x, player.pos.z);
    // F5.29c (Diego: "que suene una música de boss fight"): toda la pelea del Kraken, la pista del boss
    const kraken = typeof EE !== 'undefined' && (!!EE.fight || !!EE.cine);
    if (low || kraken) want.cuando_al_boss_le_queda_menos_de_30_de_vida = A.zoneVol.boss;
    else if (typeof inBunker === 'function' && inBunker()) { want.musica_del_buker = A.zoneVol.bunker; want.bunker = A.zoneVol.bunkerAmb; }
    else if (r && r.id === 'R20') want.background_music_in_temple = A.zoneVol.temple;
  }
  const c = AUDIO.ctx;
  let any = false;
  for (const k in want) {
    if (!hasSample(k)) continue;
    any = true;
    if (!ZTRACKS[k]) {
      const src = c.createBufferSource(), g = c.createGain();
      src.buffer = SAMPLES.buf[k]; src.loop = true; g.gain.value = 0;
      src.connect(g); g.connect(AUDIO.game || AUDIO.master); src.start();
      ZTRACKS[k] = { src, g };
    }
  }
  for (const k in ZTRACKS) ZTRACKS[k].g.gain.setTargetAtTime(want[k] ? want[k] * SETTINGS.music : 0, c.currentTime, want[k] ? 0.8 : 0.6);
  return any;
}
// F5.19c (Diego): en la pausa y al morir se calla todo lo de la partida (solo suena la música de muerte, que va al master)
function updateGameAudio() {
  if (!audioOn() || !AUDIO.game) return;
  const dead = typeof DEATH !== 'undefined' && DEATH.on;
  const paused = typeof MENU !== 'undefined' && MENU.started && !state.running && !state.gameOver;
  const on = !dead && !paused;
  if (on === AUDIO.gameOn) return;
  AUDIO.gameOn = on;
  const t = AUDIO.ctx.currentTime;
  AUDIO.game.gain.cancelScheduledValues(t);
  AUDIO.game.gain.setTargetAtTime(on ? 1 : 0, t, on ? 0.15 : 0.03);
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

