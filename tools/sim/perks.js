// V2 F2: power (palanca del sótano) y perks. Efectos exactos, tope, Quick Revive estilo Black Ops, reset.
const G = require('./harness.js');
const { state, player, CONFIG, WORLD, weaponsState, PERKM } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const PK = CONFIG.PERKS, L = PK.list, dt = 1 / 60;

function fresh() {
  G.resetGame(); state.running = true; G.debugOpenAllDoors();
  state.points = 99999; state.round = 1; state.health = 100; state.lastDamageTime = -99; state.gameOver = false;
}
// F5.6: la palanca pide los 4 generadores
function powerOn() { for (const k of G.GEN_KEYS) state.generators[k] = true; return G.turnOnPower(); }
function frontOf(sp, S, dist) {
  const l = S.d / 2 + dist;
  return { x: sp.x + l * Math.sin(sp.rot), z: sp.z + l * Math.cos(sp.rot) };
}
// pararse frente a la máquina y apretar F
function useMachine(key) {
  const f = frontOf(L[key], PK.size, 0.8);
  player.pos.set(f.x, (L[key].level ? G.UP.y : 0) + 1.7, f.z); G.updateInteract();   // F5.8: Juggernog en el techo
  return G.interactState.kind === 'perk' && G.interactState.target.key === key && G.interact();
}
function clearZombies() {
  for (const q of state.zombies.slice()) { q.active = false; q.alive = false; q.root.visible = false; }
  state.zombies.length = 0;
}

// 1) máquinas: en su cuarto, sin cambiar el grid, alcanzables
fresh();
const cols = WORLD.colliders.filter(c => c.tag.startsWith('perk:'));
check(cols.length === 6, '6 máquinas con collider (F5.11: + Mule Kick)');
check(G.PERK_KEYS.every(k => G.roomAt(L[k].x, L[k].z).id === L[k].room), 'cada una en su cuarto');
const withM = Uint8Array.from(G.NAV.cells);
cols.forEach(c => { c.solid = false; }); G.buildNavGrid();
const same = G.NAV.cells.every((v, i) => v === withM[i]);
cols.forEach(c => { c.solid = true; }); G.buildNavGrid();
check(same, 'no cambian el grid');
G.openBunker();                                           // F5.11: Mule Kick está en el búnker (con la escotilla)
player.pos.set(0, 1.7, -2); G.updateFlowField(true);
const unreach = G.PERK_KEYS.filter(k => {
  const f = frontOf(L[k], PK.size, 0.8), cx = Math.floor(f.x), cz = Math.floor(f.z);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (G.flowAt(cx + dx, cz + dz) >= 0) return false;
  return true;
});
check(unreach.length === 0, 'se llega caminando a cada una', unreach.join());

// 2) sin power no se compran; la palanca del sótano la prende
fresh();
let pts = state.points;
check(!useMachine('jugg') && state.points === pts && !G.hasPerk('jugg'), 'sin power: no compra ni cobra');
check(G.perkStatus('jugg').text === 'JUGGERNOG - needs power', 'cartel "necesita energía"');
const gen = G.PROPS.find(p => p.id === 'generador');
player.pos.set(gen.box[1] + 1.2, 1.7, (gen.box[2] + gen.box[3]) / 2); G.updateInteract();
check(G.interactState.kind === 'power' && G.promptFor(G.interactState).text === 'Energía - faltan 4 generadores', 'sin generadores: la palanca dice que faltan 4');
check(!G.interact() && !state.power, 'sin generadores: F no la prende (bug del playtest)');
state.generators.muelle = state.generators.caseta = state.generators.garaje = true; G.updateInteract();
check(G.promptFor(G.interactState).text === 'Power - 1 generator missing' && !G.interact() && !state.power, 'con 3 de 4: tampoco');
state.generators.piscina = true; G.updateInteract();
check(G.promptFor(G.interactState).text === '[F] Turn on the power', 'con los 4: cartel de la palanca en el sótano');
check(G.interact() && state.power && state.points === pts, 'F prende la energía, gratis');
G.updateTheme(dt);
check(WORLD.lamps.every(l => l.mode === 'steady') &&
  WORLD.lamps.every(l => Math.abs(l.light.intensity - CONFIG.THEME.lampIntensity * l.k * CONFIG.POWER.lampMul) < 1e-9),
  'las 6 lámparas quedan parejas y más fuertes (sin luces nuevas)');
G.updateInteract();
check(G.interactState.kind !== 'power', 'prendida, la palanca ya no muestra cartel');
check(G.perkStatus('jugg').text === '[F] JUGGERNOG - 2500', 'con power: cartel de compra');

// 3) compra: precio exacto, una vez, tope 4
const costs = {};
for (const k of ['jugg', 'speed', 'dtap', 'stamin']) { pts = state.points; useMachine(k); costs[k] = pts - state.points; }
check(Object.keys(costs).every(k => costs[k] === L[k].cost), 'cobra el precio de cada una', JSON.stringify(costs));
pts = state.points;
check(!useMachine('jugg') && state.points === pts, 'no se compra dos veces');
check(!useMachine('revive') && state.perks.length === PK.max && G.perkStatus('revive').text === 'Máximo 4 perks', 'tope de 4');
fresh(); powerOn(); state.points = 100;
check(!useMachine('jugg') && !G.hasPerk('jugg'), 'sin puntos no compra');

// 4) Juggernog: 250 de vida (aguanta 9 golpes de 25), regenera hasta 250
fresh(); powerOn(); useMachine('jugg');
check(state.health === PK.juggHealth && G.maxHealth() === 250, 'Juggernog: vida 250');
for (let i = 0; i < 9; i++) { state.lastDamageTime = -99; G.damagePlayer(25, 0, 0); }
check(!state.gameOver && state.health === 25, 'aguanta 9 golpes de 25', `(vida ${state.health})`);
for (let i = 0; i < 60 * 20; i++) { G.tick(dt); G.updatePlayer(dt); }
check(state.health === 250, 'regenera hasta 250');

// 5) Speed Cola: recarga en la mitad
function reloadTime() {
  const s = state.weapons[state.currentWeapon]; s.mag = 0; s.reserve = 80;
  weaponsState.phase = 'idle'; G.reloadWeapon();
  let t = 0;
  while (weaponsState.phase === 'reloading' && t < 10) { G.tick(dt); G.updateWeapon(dt); t += dt; }
  return t;
}
fresh(); powerOn();
const r0 = reloadTime(); useMachine('speed'); const r1 = reloadTime();
check(Math.abs(r1 / r0 - PK.speedReload) < 0.05, 'Speed Cola: recarga ×0.5', `(${r0.toFixed(2)} s -> ${r1.toFixed(2)} s)`);

// 6) Double Tap: cadencia ×1.33 y daño ×1.33
function shotsIn(secs) {
  weaponsState.phase = 'idle'; weaponsState.lastShot = -1e9;
  const s = state.weapons[state.currentWeapon]; s.mag = 999;
  const f0 = state.shotsFired;
  for (let i = 0; i < secs * 60; i++) { G.tick(dt); G.fireWeapon(); }
  return state.shotsFired - f0;
}
function dmgPerShot() {
  clearZombies();
  state.round = 1; player.pos.set(0, 1.7, 10); G.setCam(0); G.updateFlowField(true);
  const q = G.spawnZombie(); q.state = 'walk'; q.px = 0; q.pz = 7; q.health = 1e6;
  G.placeRoot(q, 0); G.scene.updateMatrixWorld(true);
  weaponsState.phase = 'idle'; weaponsState.lastShot = -1e9;
  state.weapons[state.currentWeapon].mag = 5;
  G.fireWeapon();
  return 1e6 - q.health;
}
fresh(); powerOn(); G.giveWeapon('smg'); state.weapons[state.currentWeapon].mag = 999;
const n0 = shotsIn(3), d0 = dmgPerShot();
useMachine('dtap'); G.giveWeapon('smg');
const n1 = shotsIn(3), d1 = dmgPerShot();
check(Math.abs(n1 / n0 - PK.dtapRate) < 0.05, 'Double Tap: cadencia ×1.33 (SMG)', `(${n0} -> ${n1} disparos en 3 s)`);
check(d0 > 0 && Math.abs(d1 / d0 - PK.dtapDamage) < 1e-6, 'Double Tap: daño ×1.33', `(${d0} -> ${d1.toFixed(1)})`);
clearZombies();

// 7) Quick Revive (solo, como Black Ops)
fresh(); powerOn();
useMachine('jugg'); useMachine('revive');
state.lastDamageTime = -99; state.health = 10; G.damagePlayer(25, 0, 0);
check(!state.gameOver && state.perks.length === 0 && state.health === CONFIG.PLAYER.maxHealth, 'golpe letal con QR: revive con vida llena y SIN perks (Jugg también)', `(vida ${state.health})`);
G.tick(1.0); G.damagePlayer(25, 0, 0);
check(state.health === 100, 'invulnerable 2 s después de revivir');
G.tick(1.2); G.damagePlayer(25, 0, 0);
check(state.health === 75, 'pasados los 2 s, vuelve a recibir daño');
state.health = 10; state.lastDamageTime = -99; G.damagePlayer(25, 0, 0);
check(state.gameOver, 'sin QR, el golpe letal es game over');
fresh(); powerOn();
for (let i = 0; i < PK.reviveUses; i++) {
  check(useMachine('revive'), `compra ${i + 1} de QR`);
  state.health = 1; state.lastDamageTime = -99; G.damagePlayer(25, 0, 0);
}
const qr = PERKM.machines.revive;
const f = frontOf(L.revive, PK.size, 0.8); player.pos.set(f.x, 1.7, f.z); G.updateInteract();
check(qr.gone && !qr.col.solid && WORLD.hitMeshes.indexOf(qr.hit) < 0 && G.interactState.kind !== 'perk', 'después de 3 compras la máquina desaparece');
fresh(); powerOn(); useMachine('revive');
state.health = 5; state.lastDamageTime = -99;
G.explodeAt(player.pos.x + 1, player.pos.y - 0.85, player.pos.z);
check(!state.gameOver && state.health === 100, 'tu propia granada letal también dispara el revive');

// 8) HUD y reset
fresh(); powerOn(); useMachine('jugg'); useMachine('dtap');
check((G.UI.perks.innerHTML.match(/<i /g) || []).length === 2, 'HUD: un ícono por perk');
G.resetGame();
check(state.perks.length === 0 && !state.power && state.reviveBuys === 0, 'resetGame: sin perks ni power');
check(WORLD.lamps.every(l => l.mode === l.mode0), 'resetGame: las lámparas vuelven a sus modos (parpadeo, rota, zumbido)');
check(!PERKM.machines.revive.gone && PERKM.machines.revive.col.solid, 'resetGame: vuelve la máquina de QR');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
