// Prueba de juego larga (no va en npm test): una partida simulada con el frame completo de animate() (sin
// render), perros y bosses prendidos. El jugador recorre el mapa y mata al más cercano cada tanto; la vida se
// mantiene (se registra el daño). Busca: excepciones, NaN, zombies fuera del mapa o perdidos, rondas trabadas,
// la escena que crece (fugas), y que la cabeza del calamar, las almejas y los bosses sigan su calendario.
// Uso: node soak.js [rondas=30] [semilla=1]
const G = require('./harness.js');
const vm = require('vm');
const { state, player, CONFIG, roundState } = G;
const ROUNDS = +process.argv[2] || 30;
let seed = +process.argv[3] || 1;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };   // reproducible
CONFIG.DOGS.enabled = true; CONFIG.BOSS.enabled = true;

// el cuerpo de animate() sin requestAnimationFrame ni render, en el scope del juego
const frame = vm.runInContext(`(function (dt) {
  if (state.running) {
    updatePlayer(dt); updateFootsteps(dt); updateRounds(dt); updateFlowField(false); updateZombies(dt); updateGibs(dt); updateDrips(dt); updateNight(dt);
    updateSquids(dt); updateGiant(dt); updateBoss(dt); updateWeapon(dt); updateGrenades(dt); updateMonkeys(dt);
    updateBlood(dt); updatePickups(dt); updateEffects(dt); updateBox(dt); updateRelics(dt); updatePerks(dt);
    updateShield(dt); updateQuest(dt); updateClams(dt); updateGarden(dt); updateTraps(dt); updateBunker(dt);
    updateWeaponFx(dt); updateInteract(); updateBow(dt); updateRockets(dt); STATS.time += dt;
  }
  updateZombieAudio(dt); updateFlameAudio(); updateAmbience(); updateMusic();
  updateHUD(dt); updateFeelUI(dt); updatePowerupUI(dt); updatePromptUI(dt); updateTheme(dt);
})`, G.sandbox);

// recorrido: [x, z, y del piso] (y 4.3 = techo/templo)
const WAY = [[0, 0, 0], [0, 10, 0], [12, 8, 0], [25, 6, 0], [20, 25, 0], [10, 35, 0], [-10, 35, 0], [-20, 10, 0],
  [0, -12, 0], [0, -35, 0], [-10, -46, 0], [-45, 30, 0], [-60, 0, 0], [-50, -35, 0], [-58, -46, 0], [-30, 60, 0],
  [20, 60, 0], [40, 65, 0], [50, 69, 4.3], [45, 20, 0], [30, -12, 0], [11, 17, 4.3], [-10, 45, 0]];
const dt = 1 / 30;
G.resetGame(); state.running = true;
G.debugUnlockAll();                                    // todo abierto, energía, PaP (como la tecla O)
state.points = 1e6;
const issues = [], note = (k, msg) => { if (!issues.some(i => i.k === k)) issues.push({ k, msg }); };
let t = 0, wp = 0, wpT = 0, killT = 0, dmg = 0, lastHp = 100, roundStart = 0, lastRound = state.round, frames = 0;
let kids0 = G.scene.children.length, maxKids = kids0, bosses = [], headOpenAt = null, clamChanges = 0, respawns = 0;
const clamStage = G.CLAMS.list.map(c => c.stage);
const B = G.NAV;
function goTo(i) {
  const [x, z, y] = WAY[i % WAY.length];
  player.pos.set(x, (y || G.groundY(x, z)) + CONFIG.PLAYER.height, z);
  player.vel.set(0, 0, 0); player.airTop = player.pos.y;
}
goTo(0);
const t0 = Date.now();
while (state.round <= ROUNDS && t < ROUNDS * 400) {
  G.tick(dt); t += dt; frames++;
  try { frame(dt); } catch (e) { note('exc:' + e.message, `excepción en ronda ${state.round}: ${e.stack.split('\n').slice(0, 4).join(' | ')}`); break; }
  // el jugador: se mueve de punto en punto, mira hacia adelante, no muere
  if ((wpT += dt) > 18) { wpT = 0; goTo(++wp); }
  if (state.health < lastHp) dmg += lastHp - state.health;
  state.health = G.maxHealth(); lastHp = state.health; state.gameOver = false; state.running = true;
  // mata al más cercano cada 0.4 s (al boss le saca 8%)
  if ((killT += dt) > 0.4) {
    killT = 0;
    let best = null, bd = 1e9;
    for (const z of state.zombies) if (z.alive && z.state !== 'emerge') { const d = Math.hypot(z.px - player.pos.x, z.pz - player.pos.z); if (d < bd) { bd = d; best = z; } }
    if (best) G.damageZombie(best, best.boss ? best.maxHealth * 0.08 : 1e9, false);
  }
  // chequeos
  for (const z of state.zombies) {
    if (!Number.isFinite(z.px) || !Number.isFinite(z.pz)) note('nan', `zombie con posición NaN (${z.kind}) en ronda ${state.round}`);
    if (z.alive && (z.px < B.minX - 2 || z.px > B.minX + B.w + 2 || z.pz < B.minZ - 2 || z.pz > B.minZ + B.h + 2))
      note('out:' + z.kind, `zombie ${z.kind} fuera del mapa (${z.px.toFixed(1)}, ${z.pz.toFixed(1)}) en ronda ${state.round}`);
    if (z.boss && z.alive && !bosses.includes(state.round)) bosses.push(state.round);
  }
  if (!Number.isFinite(player.pos.x)) note('pnan', 'jugador NaN');
  if (state.round !== lastRound) {
    const dur = t - roundStart;
    if (dur > 300) note('slow:' + lastRound, `la ronda ${lastRound} duró ${dur.toFixed(0)} s`);
    roundStart = t; lastRound = state.round;
    const k = G.scene.children.length; maxKids = Math.max(maxKids, k);
    G.CLAMS.list.forEach((c, i) => { if (c.stage !== clamStage[i]) { clamChanges++; clamStage[i] = c.stage; } });
    if (G.SQHEAD.open && headOpenAt === null) headOpenAt = state.round;
  }
  if (t - roundStart > 400) { note('stuck:' + state.round, `ronda ${state.round} trabada: ${state.zombies.length} vivos, ${roundState.spawned}/${roundState.total} spawneados, boss pendiente ${roundState.bossPending}, fase ${roundState.phase}`); break; }
}
const Z = state.zombies;
console.log(`partida: ronda ${state.round}, ${(t / 60).toFixed(1)} min de juego, ${frames} frames en ${((Date.now() - t0) / 1000).toFixed(0)} s reales`);
console.log(`daño recibido (la vida se repone): ${dmg.toFixed(0)} · kills ${G.STATS.kills || '?'} · bosses en rondas ${bosses.join(',') || 'ninguna'}`);
console.log(`escena: ${kids0} al empezar, máximo ${maxKids} · cambios de color de almejas: ${clamChanges} · cabeza abierta desde R${headOpenAt}`);
console.log(`vivos al final: ${Z.length} (${[...new Set(Z.map(z => z.kind))].join(',')})`);
for (const i of issues) console.log('  PROBLEMA  ' + i.msg);
console.log(issues.length ? `FALLA (${issues.length})` : 'PASA');
process.exit(issues.length ? 1 : 0);
