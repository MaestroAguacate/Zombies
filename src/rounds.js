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
  GUMM.uses = 0;                       // F5.18b: la chiclera vuelve a 500
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
  setRoundHUD(n);
  sfxBell();
  sfxRoundDrum(n);                     // F6: tambor (redoble largo cada 5 rondas)
}
// pausa con cartel "RONDA n" (o el de los perros, y ya se va haciendo de noche), luego startRound(n)
function queueRound(n, delay) {
  roundState.phase = 'pause';
  roundState.next = n;
  roundState.pauseT = delay;
  dodgeDogs(n);
  const dogs = isDogRound(n);
  showBanner(dogs ? mobBanner(mobKind((roundState.mobCount || 0) + 1)) : 'ROUND ' + n, delay);
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
  if (R.phase === 'pause') {
    R.pauseT -= dt;
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
             : best === 'shield' ? 'SHIELD' : best === 'machete' ? CONFIG.MACHETE.name : CONFIG.WEAPONS[best].name;
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
  if (document.exitPointerLock) document.exitPointerLock();
}
// resetea TODO el estado de partida sin recargar la página
function resetGame() {
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
  resetClams();                        // F5.14
  resetMatchXP();                      // F5.18
  resetGums();                         // F5.18b
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

