//=== 6. ROUNDS ===========================================================
const roundState = { phase: 'idle', total: 0, spawned: 0, spawnT: 0, pauseT: 0, next: 1, dogs: false, nextDog: 0 };

// F4: vivos a la vez. Desde ROUNDS.maxAliveFrom, +1 por ronda, con tope en el pool
function maxAliveFor(n) {
  const R = CONFIG.ROUNDS;
  return n >= R.maxAliveFrom ? Math.min(CONFIG.ZOMBIE.poolSize, R.maxAlive + n - R.maxAliveFrom + 1) : R.maxAlive;
}
// F4: ¿la ronda n es de perros? (la primera entre DOGS.firstRound, después cada DOGS.every)
function isDogRound(n) { return CONFIG.DOGS.enabled && n === roundState.nextDog; }
// F5: ¿sale el Sombrerón en la ronda n? (R12, R20, R28...; roundState.forceBoss = debug J)
function isBossRound(n) {
  const B = CONFIG.BOSS;
  return B.enabled && (n === roundState.forceBoss || (n >= B.firstRound && (n - B.firstRound) % B.every === 0));
}
// F5: si los perros caen en una ronda de boss, se corren a la siguiente
function dodgeDogs(n) { if (roundState.nextDog === n && isBossRound(n)) roundState.nextDog = n + 1; }
// F5.9: qué bosses salen en la ronda n (CONFIG.BOSS.schedule(k), k = cuántas rondas de boss van antes).
// Forzado con J fuera del calendario: el primero (el Sombrerón)
function bossesFor(n) {
  const B = CONFIG.BOSS;
  if (!isBossRound(n)) return [];
  const k = n >= B.firstRound && (n - B.firstRound) % B.every === 0 ? (n - B.firstRound) / B.every : 0;
  return B.schedule(k).slice();
}
function randIn(a) { return a[0] + Math.floor(Math.random() * (a[1] - a[0] + 1)); }
// F5.9: la k-ésima ronda de mobs (1 = la primera): perros, calamares, mezcla... y cada MOBS.bossEvery, Sombrerones
function mobKind(k) {
  return k % CONFIG.MOBS.bossEvery === 0 ? 'bosses' : k === 1 ? 'dogs' : k === 2 ? 'squids' : 'mixed';
}
function mobBanner(kind) {
  return kind === 'squids' ? CONFIG.SQUID.banner : kind === 'mixed' ? CONFIG.MOBS.mixedBanner
       : kind === 'bosses' ? CONFIG.MOBS.bossBanner : CONFIG.DOGS.banner;
}
function spawnMob() {
  const m = roundState.mob;
  if (m === 'dogs') return spawnDog();
  if (m === 'squids') return spawnSquid();
  if (m === 'mixed') {
    const sq = Math.random() < 0.5;
    return (sq ? spawnSquid() : spawnDog()) || (sq ? spawnDog() : spawnSquid());
  }
  return null;
}

// arranca la ronda n: cantidad y stats salen de CONFIG.ZOMBIE (health/speed los lee resetZombie)
function startRound(n) {
  if (n > 1 && n > state.round) { addXP(CONFIG.PROGRESSION.xp.round * (n - 1)); saveProfile(); }   // F5.18: XP por ronda terminada
  state.round = n;
  trophiesRound();                     // F5.26: la cría domesticada cuenta sus rondas
  // (F5.20, Diego: sin la voz del inicio: hablaba de una playa)
  GUMM.uses = 0;                       // F5.18b: la chiclera vuelve a 500
  barriersRound();                     // F5.19b: las tablas vuelven a dar puntos
  roundState.phase = 'active';
  setSquidHead(n);                     // F5.13: la cabeza del calamar sube un poco por ronda
  clamsRound(n);                       // F5.14: las almejas que tocan cambian de color
  dodgeDogs(n);
  roundState.dogs = isDogRound(n);
  roundState.bossQueue = bossesFor(n);          // F5/F5.9: salen al arrancar la ronda (reintenta si no hay lugar)
  roundState.bossPending = roundState.bossQueue.length > 0;
  // F5.9: ronda de mobs: cuál toca (perros, calamares, mezcla o 4 Sombrerones)
  roundState.mob = roundState.dogs ? mobKind(roundState.mobCount = (roundState.mobCount || 0) + 1) : null;
  const mob = roundState.mob;
  roundState.total = !mob ? CONFIG.ZOMBIE.count(n) : mob === 'bosses' ? 0
                   : mob === 'squids' ? CONFIG.SQUID.count(n) : CONFIG.DOGS.count(n);
  if (mob === 'squids' || mob === 'mixed') giantRise();   // F5.11: el calamar gigante sale del mar (rugido)
  if (mob === 'bosses') {
    for (let i = 0; i < CONFIG.MOBS.bosses; i++) roundState.bossQueue.push('sombrero');
    roundState.bossPending = true;
  }
  roundState.spawned = 0;
  roundState.spawnT = 0;
  roundState.guaranteedDrop = false;   // se consume con el primer kill de una ronda de garantía
  if (roundState.dogs) {
    roundState.nextDog = n + randIn(CONFIG.DOGS.every);
    if (!roundState.dogBanner) showBanner(mobBanner(mob), CONFIG.DOGS.bannerTime);   // sin pausa (debug ])
  }
  roundState.dogBanner = false;
  setSky(n, roundState.dogs);          // F4/F5.9: noche en la de perros; si no, el cielo de la ronda
  addRoundGrenades();                  // F2.7: +2 granadas, tope 4
  roundBlink(false);                   // F5.24: arranca la ronda: deja de parpadear (y hace el destello)
  setRoundHUD(n);                      // (F5.19: la campanada y el tambor suenan al empezar la pausa, en updateRounds)
}
// pausa con cartel "RONDA n" (o el de los perros, y ya se va haciendo de noche), luego startRound(n)
function queueRound(n, delay) {
  roundState.phase = 'pause';
  roundState.next = n;
  roundState.pauseT = delay;
  roundState.pause0 = delay; roundState.bellDone = false; roundState.hudDone = false;   // F5.19
  dodgeDogs(n);
  const dogs = isDogRound(n);
  roundState.bannerText = dogs ? mobBanner(mobKind((roundState.mobCount || 0) + 1)) : 'ROUND ' + n;   // F5.19: sale con el número
  roundState.dogBanner = dogs;
  setSky(n, dogs);
}
function aliveCount() {
  let a = 0;
  for (const z of state.zombies) if (z.alive) a++;
  return a;
}
function zombiesLeft() {
  return roundState.phase === 'active' ? roundState.total - roundState.spawned + aliveCount() : 0;
}
function updateRounds(dt) {
  const R = roundState, C = CONFIG.ROUNDS;
  if (eeHold()) return;                                         // F5.29: con el cebo del Kraken y en la pelea, nada sale
  if (R.phase === 'pause') {
    // F5.19: el audio de ronda suena apenas termina la anterior (o al arrancar la partida), el número cambia a los
    // hudAt s y la ronda (los zombies) arranca al terminar la pausa
    if (!R.bellDone) {
      R.bellDone = true; sfxBell(); sfxRoundDrum(R.next);
      roundBlink(true);                                        // F5.24: el número parpadea toda la pausa
      // F5.19: si terminó una ronda de perros, el personaje festeja; si viene una de mobs, avisa
      if (R.prevMob === 'dogs' || R.prevMob === 'mixed') voice('audio_del_personaje_al_matar_muchos_perros', 1, 0);
      if (R.dogBanner) { const k = mobKind((R.mobCount || 0) + 1);
        if (k === 'dogs') voice('audio_personaje_en_ronda_de_perros', 1, 0); else if (k === 'squids' || k === 'mixed') voice('audio_personaje_al_iniciar_ronda_de_squids', 1, 0); }
    }
    R.pauseT -= dt;
    if (!R.hudDone && ((R.pause0 || 0) - R.pauseT >= C.hudAt || R.pauseT <= dt)) {
      R.hudDone = true; setRoundHUD(R.next);
      if (R.bannerText) showBanner(R.bannerText, Math.max(2, R.pauseT + 1.5));
    }
    if (R.pauseT <= 0) startRound(R.next);
    return;
  }
  if (R.phase !== 'active') return;

  // spawn escalonado con tope de vivos
  if (R.bossPending) {                                         // F5/F5.9: de a uno por frame, en orden
    if (!R.bossQueue || !R.bossQueue.length) R.bossQueue = ['sombrero'];   // (tests que ponen bossPending a mano)
    if (spawnBoss(R.bossQueue[0])) R.bossQueue.shift();
    R.bossPending = R.bossQueue.length > 0;
  }
  const D = CONFIG.DOGS, SQ = CONFIG.SQUID;
  const cap = R.dogs ? (R.mob === 'squids' ? SQ.maxAlive : D.maxAlive) : maxAliveFor(state.round);
  if (R.spawnHold > 0) R.spawnHold = Math.max(0, R.spawnHold - dt);   // F5.10: Kaboom: nadie sale mientras arden
  else if (R.spawned < R.total && aliveCount() < cap) {
    R.spawnT -= dt;
    if (R.spawnT <= 0) {
      const slow = bossAlive() ? CONFIG.BOSS.spawnSlow : 1;   // F5: con el boss vivo, a la mitad de ritmo
      const gap = !R.dogs ? C.spawnInterval : R.mob === 'squids' ? SQ.spawnInterval : D.spawnInterval;
      // F5.6: en el jardín trasero, a veces un perro en vez del zombie (spawnGardenDog, garden.js)
      // F5.9: en las rondas de mobs, perros, calamares o los dos (spawnMob)
      if (R.dogs ? spawnMob() : (spawnGardenDog() || spawnZombie())) { R.spawned++; R.spawnT = gap * slow; }
      else R.spawnT = C.spawnRetry;          // todo visible o pool lleno: reintenta pronto
    }
  }
  // fin: todos spawneados y el array vacío (espera a que terminen de colapsar)
  if (R.spawned >= R.total && state.zombies.length === 0 && !R.bossPending && !giantBusy()) {   // F5.11: y ninguno en el aire
    R.prevMob = R.mob;                                         // F5.19: para la voz de "matar muchos perros"
    queueRound(state.round + 1, C.intermission);
  }
}

//--- estadísticas de la partida (pantalla final). src = arma del último ataque, para "arma favorita" ---
const STATS = { time: 0, pointsEarned: 0, headshots: 0, damageTaken: 0, doors: 0, boxUses: 0, killsBy: {}, src: 'm1911', bosses: 0 };
function resetStats() {
  Object.assign(STATS, { time: 0, pointsEarned: 0, headshots: 0, damageTaken: 0, doors: 0, boxUses: 0, killsBy: {}, src: 'm1911', bosses: 0 });
}
function favoriteWeapon() {
  let best = null, n = 0;
  for (const k in STATS.killsBy) if (STATS.killsBy[k] > n) { n = STATS.killsBy[k]; best = k; }
  if (!best) return '—';
  const name = best === 'knife' ? CONFIG.KNIFE.name : best === 'grenade' ? CONFIG.GRENADE.name
             : best === 'shield' ? 'SHIELD' : best === 'machete' ? CONFIG.MACHETE.name
             : CONFIG.WEAPONS[best] ? CONFIG.WEAPONS[best].name : String(best).toUpperCase();   // F5.28d: fuentes sin arma
  return name + ' (' + n + ')';
}

//--- game over / reinicio ---
function loadHighScore() {
  try { return parseInt(localStorage.getItem(CONFIG.HIGHSCORE_KEY), 10) || 0; } catch (e) { return 0; }
}
function saveHighScore(r) {
  try { localStorage.setItem(CONFIG.HIGHSCORE_KEY, String(r)); } catch (e) {}
}
function gameOver() {
  if (state.gameOver) return;
  state.gameOver = true;
  state.running = false;
  saveProfile();                       // F5.18
  roundState.phase = 'over';
  const best = loadHighScore();
  const isNew = state.round > best;
  if (isNew) saveHighScore(state.round);
  showGameOver(isNew, Math.max(best, state.round));
  // F5.28f (Diego): el GAME OVER glitcheado aparece enseguida, sobre la cinemática; la tablita, en la pantalla negra
  if (UI.go) { UI.go.classList.remove('card'); UI.go.classList.add('show'); }
  playSample('end_of_the_game', { dest: AUDIO.master });          // F5.19 (F5.19c: al master, lo demás se calla)
  startDeathCam();                                                // F5.19b
  if (document.exitPointerLock) document.exitPointerLock();
}
// F5.19b: cinemática de muerte. F5.28e (Diego): en primera persona. F5.28f (Diego: "como si estuviera viendo de lado: le
// veo los pies a los zombies y mi charco de sangre"; antes, boca arriba, parecía que se tiraban encima): 1) caés de
// costado a ras del piso, mirando hacia el que te mató (el más cercano a donde vino el golpe letal); 2) los que te
// rodean llegan de a uno y se paran alrededor en abanico, apenas inclinados, y muerden con sacudón, crujido y gruñido;
// el charco de sangre crece debajo tuyo (deathPool), la sangre chorrea por la pantalla (deathDrips) y la imagen se va
// oscureciendo; 3) negro con LOADING... abajo a la derecha y el resumen (se resetea la partida) y al menú. Se mide con el
// reloj real (con pocos FPS el dt del loop se recorta)
const DEATH = { on: false, t: 0, dur: 10, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, card: false, done: false, phase: 'fall',
                eater: null, peek: [], biteT: 0, biteLen: 0.6, bites: 0, hitX: undefined, hitZ: undefined, v: new THREE.Vector3(),
                cv: null, g: null, drips: [] };
// los que asoman: el que te mató primero y los más cercanos del mismo nivel (hasta death.peekers), repartidos alrededor
function deathPeekers(eater) {
  const D = CONFIG.ROUNDS.death, P = player.pos, lv = playerLevel();
  const list = eater ? [eater] : [];
  const rest = state.zombies.filter(z => z !== eater && z.alive && z.root && z.state !== 'dying' && (z.level || 0) === lv && !z.boss &&
    Math.hypot(z.px - P.x, z.pz - P.z) < D.search).sort((a, b) => Math.hypot(a.px - P.x, a.pz - P.z) - Math.hypot(b.px - P.x, b.pz - P.z));
  for (const z of rest) { if (list.length >= D.peekers) break; list.push(z); }
  const a0 = eater ? Math.atan2(eater.px - P.x, eater.pz - P.z) : DEATH.yaw + Math.PI;
  return list.map((z, i) => {
    // en abanico delante de la vista (el que te mató al medio): así se les ven las piernas a todos
    const a = a0 + (i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * D.fan + (Math.random() - 0.5) * 0.15);
    if (z.root) z.root.rotation.order = 'YXZ';
    return { z, dx: Math.sin(a), dz: Math.cos(a), t0: CONFIG.ROUNDS.death.fall + i * D.peekEvery, ph: Math.random() * 6 };
  });
}
// la sangre que chorrea por la pantalla: un canvas chico (se ve en píxeles), gotas que bajan desde arriba dejando un
// hilo, más en cada mordida. Se crea la primera vez (sin canvas, como en los tests: nada)
function deathDripsCanvas() {
  if (DEATH.cv || typeof document === 'undefined' || !document.createElement || !document.body) return DEATH.g;
  try {
    const c = document.createElement('canvas');
    if (!c.getContext) return null;
    c.width = 192; c.height = 108;
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '40',
      imageRendering: 'pixelated', display: 'none' });
    document.body.appendChild(c);
    DEATH.cv = c; DEATH.g = c.getContext('2d');
  } catch (e) { DEATH.cv = null; DEATH.g = null; }
  return DEATH.g;
}
// F5.28f: el charco de sangre que crece debajo tuyo (k 0..1 del tamaño death.poolR; k 0 lo esconde). Un solo mesh en
// cubos chatos (blotch), armado la primera vez y reusado
function deathPool(x, y, z, k) {
  if (!DEATH.pool) {
    if (k <= 0 || typeof blotch !== 'function') return;
    const mb = new MeshBuilder(), rr = mulberry(4040), r = (a, b) => a + (b - a) * rr();
    blotch(mb, 0, 0, 1, 0x3a0202, 0x5a0606, r, 0.012, 0.12);
    DEATH.pool = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x160000 }));
    if (!DEATH.pool) return;
    DEATH.pool.userData.theme = false; DEATH.pool.matrixAutoUpdate = true;
  }
  const s = Math.max(0.001, k * CONFIG.ROUNDS.death.poolR);
  DEATH.pool.visible = k > 0;
  DEATH.pool.position.set(x, y, z); DEATH.pool.scale.set(s, 1, s);
}
function deathDripAdd(n) {
  const D = CONFIG.ROUNDS.death;
  for (let i = 0; i < n && DEATH.drips.length < D.drips; i++)
    DEATH.drips.push({ x: Math.floor(Math.random() * 192), y: 0, v: 6 + Math.random() * 16, w: 1 + Math.floor(Math.random() * 3), top: 2 + Math.random() * 6 });
}
function updateDeathDrips(dt, show) {
  const g = deathDripsCanvas();
  if (!g) return;
  DEATH.cv.style.display = show ? 'block' : 'none';
  if (!show) return;
  g.clearRect(0, 0, 192, 108);
  for (const d of DEATH.drips) {
    d.y = Math.min(118, d.y + d.v * dt); d.v = Math.max(3, d.v - dt * 2 + (Math.random() - 0.5) * 3);   // se frena y se atasca
    g.fillStyle = '#3a0000'; g.fillRect(d.x - 1, 0, d.w + 2, d.top);                                     // la mancha de arriba
    g.fillStyle = '#5a0404'; g.fillRect(d.x, 0, d.w, Math.floor(d.y));                                   // el hilo
    g.fillStyle = '#8a0a0a'; g.fillRect(d.x - (d.w > 1 ? 1 : 0), Math.floor(d.y), d.w + (d.w > 1 ? 2 : 1), 2);   // la gota
  }
}
function deathEater() {
  const D = CONFIG.ROUNDS.death, P = player.pos, hx = DEATH.hitX !== undefined ? DEATH.hitX : P.x, hz = DEATH.hitZ !== undefined ? DEATH.hitZ : P.z;
  let best = null, bd = D.search;
  for (const z of state.zombies) {
    if (!z.alive || !z.root || z.state === 'dying' || (z.level || 0) !== playerLevel()) continue;
    const d = Math.min(Math.hypot(z.px - hx, z.pz - hz), Math.hypot(z.px - P.x, z.pz - P.z));
    if (d < bd) { bd = d; best = z; }
  }
  return best;
}
function startDeathCam() {
  const D = CONFIG.ROUNDS.death;
  DEATH.on = true; DEATH.t = 0; DEATH.card = DEATH.done = false; DEATH.phase = 'fall';
  DEATH.dur = D.fall + D.eat + CONFIG.LOADING.death;
  DEATH.t0 = performance.now();
  DEATH.x = camera.position.x; DEATH.y = camera.position.y; DEATH.z = camera.position.z;
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  DEATH.yaw = e.y; DEATH.pitch = e.x;
  DEATH.eater = deathEater(); DEATH.biteT = 0; DEATH.bites = 0;
  DEATH.peek = deathPeekers(DEATH.eater);
  const e0 = DEATH.peek[0];
  DEATH.ex = e0 ? e0.dx : -Math.sin(DEATH.yaw); DEATH.ez = e0 ? e0.dz : -Math.cos(DEATH.yaw);
  DEATH.drips.length = 0;
  UI.go.classList.remove('card', 'done');
}
// una mordida: sacudón, sangre en toda la pantalla, crujido y gruñido (al master: el bus de la partida está callado)
function deathBite(z) {
  DEATH.bites++;
  addTrauma(0.55);
  if (typeof HURT !== 'undefined') { HURT.on.fill(1); for (let k = 0; k < 5; k++) HURT.k[k] = 1; }
  deathDripAdd(3 + Math.floor(Math.random() * 4));                // más sangre que chorrea
  const P = player.pos;
  spawnSplashFx(P.x + DEATH.ex * 0.35, groundY(P.x, P.z) + 0.3, P.z + DEATH.ez * 0.35, 0x5a0404, 1.2);
  if (typeof playSample !== 'function' || !audioOn()) return;
  const dest = AUDIO.master, pos = [P.x, P.y, P.z];
  if (z && z.dog) playSample('mordida_perro', { dest, pos, vol: 1.4, rate: 0.85 + Math.random() * 0.2 });
  else playAny(HIT_Z, { dest, pos, vol: 1.3, rate: 0.7 + Math.random() * 0.2 });
  if (DEATH.bites % 2 && SAMPLES.zg && SAMPLES.zg.length && z && !z.dog && !z.boss) playSample(SAMPLES.zg[z.gk || 0], { dest, pos, vol: 1.2, rate: 0.8, max: 1.2 });
}
function updateDeathCam(dt) {
  if (!DEATH.on) return;
  const D = CONFIG.ROUNDS.death, P = player.pos;
  const t = DEATH.t = Math.max(DEATH.t + dt, (performance.now() - DEATH.t0) / 1000);
  const floor = groundY(P.x, P.z) + lvY(playerLevel()), eye = floor + 0.25;
  if (!DEATH.done && t >= DEATH.dur) { DEATH.done = true; finishDeath(); return; }
  if (t >= D.fall + D.eat) {                                      // 3) negro, cargando, con el resumen
    if (DEATH.phase !== 'black') {
      DEATH.phase = 'black';
      startLoading(CONFIG.LOADING.death, false);
      DEATH.card = true; UI.go.classList.add('show', 'card');
      for (const p of DEATH.peek) if (p.z.root) p.z.root.rotation.set(0, p.z.root.rotation.y, 0);
      updateDeathDrips(0, false);
    }
    return;
  }
  // el mundo sigue: los otros se juntan alrededor del cuerpo (antes de la pose del que come: si no, la pisa)
  updateFlowField(false); updateZombies(dt); updateGibs(dt); updateBlood(dt);
  if (typeof HURT !== 'undefined' && HURT.els && t >= D.fall) {   // la sangre de las mordidas se va apagando entre una y otra
    for (let q = 0; q < 5; q++) { HURT.k[q] = Math.max(0.35, HURT.k[q] - dt * 0.8); HURT.els[q].style.opacity = HURT.k[q].toFixed(2); }
    UI.lowhp.style.opacity = '1';
  }
  updateDeathDrips(dt, t >= D.fall);
  // tirado de costado a ras del piso, mirando hacia el que te mató: se ven sus pies y tu charco (se mece apenas)
  const yaw = Math.atan2(-DEATH.ex, -DEATH.ez), low = floor + D.eyeY;
  if (t < D.fall) {                                               // 1) caés de costado
    DEATH.phase = 'fall';
    const k = t / D.fall, e = k * k;
    let dy = yaw - DEATH.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    camera.position.set(DEATH.x + (P.x - DEATH.x) * e, DEATH.y + (low - DEATH.y) * e, DEATH.z + (P.z - DEATH.z) * e);
    camera.rotation.set(DEATH.pitch + (D.pitch - DEATH.pitch) * e, DEATH.yaw + dy * e, D.roll * e, 'YXZ');
    deathPool(P.x, floor, P.z, 0);
    return;
  }
  DEATH.phase = 'eat';                                            // 2) se paran alrededor y te comen
  const k = (t - D.fall) / D.eat;
  camera.position.set(P.x, low, P.z);
  camera.rotation.set(D.pitch + Math.sin(t * 0.9) * 0.02, yaw + Math.sin(t * 0.6) * 0.05, D.roll + Math.sin(t * 0.5) * 0.03, 'YXZ');
  deathPool(P.x, floor, P.z, Math.min(1, k * 1.6));               // el charco de sangre crece desde vos
  DEATH.peek.forEach((p, i) => {
    const z = p.z;
    if (!z.root || z.alive === false) return;
    const u = Math.max(0, Math.min(1, (t - p.t0) / D.peekIn)), e = u * u * (3 - 2 * u);
    let lunge = 0;
    if (u >= 1) {                                                 // ya asomó: muerde (de a uno por vez se nota más)
      if (p.biteT === undefined) { p.per = 0; p.biteT = i * 0.25; }
      if ((p.biteT -= dt) <= 0) {
        p.per = (D.bite[0] + Math.random() * (D.bite[1] - D.bite[0])) * (1 + 0.4 * i);
        p.biteT = p.per; deathBite(z);
      }
      if (p.per) lunge = Math.sin(Math.PI * Math.min(1, (1 - p.biteT / p.per) * 1.6));
    }
    const sc = z.root.scale.x || 1, small = z.dog || z.squid;
    // parados alrededor, apenas inclinados sobre vos (desde el piso se ven piernas y pies); el que te mató, el más cerca.
    // Llegan desde un paso más lejos
    const dist = D.dist * sc * (small ? 1.15 : 1) * (i ? 1.25 : 1) * (1 + (1 - e) * 1.2);
    const lean = (small ? 0.08 : D.lean) * e;
    const ax = P.x + p.dx * dist, az = P.z + p.dz * dist;
    z.root.position.set(ax, floor, az);
    z.root.rotation.set(lean + 0.12 * lunge, Math.atan2(P.x - ax, P.z - az), 0);
    // el plan de color: la amenaza no se ilumina entera: un brillo rojo oscuro que late con las mordidas (se lee la silueta)
    if (z.flashMats) z.flashMats.forEach(m => m.emissive && m.emissive.setRGB(0.14 + 0.12 * lunge, 0.03, 0.02));
    if (z.head) z.head.rotation.set((0.5 + 0.3 * lunge) * e, Math.sin(t * 1.3 + p.ph) * 0.25, Math.sin(t * 7 + p.ph) * 0.12);
    if (z.armL) z.armL.rotation.set((-0.9 - 0.3 * lunge) * e, 0, 0.2);
    if (z.armR) z.armR.rotation.set((-0.8 - 0.35 * lunge) * e, 0, -0.2);
  });
  GFX.deathK = k;                                                 // gfxFilter: se va oscureciendo
}
function finishDeath() {
  endDeathCam();
  if (UI.go) UI.go.classList.remove('show');
  resetGame();
  if (typeof HURT !== 'undefined') { HURT.on.fill(0); HURT.k.fill(0); if (HURT.els) HURT.els.forEach(e => { e.style.opacity = '0'; }); }
  if (UI.lowhp) UI.lowhp.style.opacity = '0';
  if (typeof MENU !== 'undefined') { MENU.started = false; showMenu('main'); }
  if (typeof LOADSCR !== 'undefined' && LOADSCR.on) { LOADSCR.t = 0; updateLoading(0); }   // sale la pantalla negra
}
// F5.19c: salir al menú desde la pausa también termina la partida con la cinemática
function quitToMenu() {
  saveProfile();                                                  // F5.18b: la XP de la ronda en curso no se pierde
  showMenu(null);
  gameOver();
}
function endDeathCam() {
  DEATH.on = false; GFX.deathK = 0;
  for (const p of DEATH.peek) {                                   // (no quedan inclinados ni brillando en el pool)
    const z = p.z;
    if (!z.root) continue;
    z.root.rotation.x = 0; z.root.rotation.z = 0;
    if (z.flashMats) z.flashMats.forEach(m => m.emissive && m.emissive.setHex(0));
  }
  DEATH.peek = []; DEATH.drips.length = 0;
  if (typeof updateDeathDrips === 'function') updateDeathDrips(0, false);
  if (DEATH.pool) DEATH.pool.visible = false;
  DEATH.eater = null; DEATH.hitX = DEATH.hitZ = undefined;
  if (UI.go) UI.go.classList.remove('card', 'done');
}
// resetea TODO el estado de partida sin recargar la página
function resetGame() {
  endDeathCam();                       // F5.19b
  for (const z of state.zombies) deactivateZombie(z);
  state.zombies.length = 0;
  closeAllDoors();

  initPlayer();
  player.vel.set(0, 0, 0);
  resetFeel();

  state.weapons = [];
  state.currentWeapon = 0;
  weaponsState.phase = 'idle'; weaponsState.phaseT = 0;
  weaponsState.kick.x = weaponsState.kick.v = 0; weaponsState.pendingSlot = -1;
  meleeState.lastAttack = -9999;
  UI.reload.style.opacity = '0';
  CONFIG.START_LOADOUT.forEach(giveWeapon);
  resetPickups();
  interactState.kind = null; interactState.target = null;
  resetPromptUI();
  resetBox();
  resetRelics();
  resetPerks();                        // F2: sin perks, sin power, lámparas como antes
  resetShield();                       // F3a: piezas sorteadas de nuevo, sin escudo
  resetQuest();                        // F5.5: cocos en la palmera, sin cuerda ni caracola, sin Ola
  resetGarden();                       // F5.6: plantas cerradas, sin perros del jardín
  resetTraps();                        // F5.9: trampas apagadas y listas
  resetBunker();                       // F5.11: escotilla cerrada, estatuas de piedra
  resetCatacombs();                    // F5.28e: palancas arriba (la puerta D23 la cierra el reset de las puertas)
  resetKraken();                       // F5.29: el easter egg desde cero (arena escondida, sin remolino ni restos)
  resetClams();                        // F5.14
  resetMatchXP();                      // F5.18
  resetGums();                         // F5.18b
  resetBarriers();                     // F5.19b: todas las ventanas con sus 5 tablas
  resetGibs();                         // F7b: sin pedazos en el piso: almejas vacías, fumigador en otro lugar (después de resetQuest)
  resetRockets();                      // F5.11: sin cohetes en vuelo ni arco cargando
  resetMonkeys();                      // F5.11: sin langostinos
  state.machete = false;               // F3b: vuelve el cuchillo
  resetAds();                          // F3b: sin apuntar, FOV normal
  resetDebug();                        // sin noclip; overlay y cartel según CONFIG.DEBUG_MODE
  resetGrenades();
  resetWeaponFx();
  resetEnemies();                      // F4: de día, sin gotas, perros sorteados de nuevo
  resetBoss();                         // F5: sin boss, sombrero en su lugar, sin niebla ni aturdido
  resetMapView();                      // F5.24: el mapa tapado otra vez
  resetTrophies();                     // F5.26: sin trofeos ni recetas armadas

  decals.pool.forEach(d => { d.visible = false; });
  blood.pool.forEach(b => { b.visible = false; });

  state.points = CONFIG.ECONOMY.startPoints;
  state.kills = 0; state.shotsFired = 0; state.shotsHit = 0;
  resetStats();
  state.power = false; state.round = 0;
  state.lastDamageTime = -99;
  state.gameOver = false;
  resetHUD();
  resetFeelUI();

  updateFlowField(true);
  queueRound(1, CONFIG.ROUNDS.firstDelay);
}

