// V2 F3a: escudo. Piezas sorteadas, recoger, armar manteniendo F, bloqueo de espalda / de frente, empujón,
// durabilidad, se vuelve a sacar del banco, teclas 1/2/3, reset.
const G = require('./harness.js');
const { state, player, CONFIG, WORLD, keys, weaponsState, SHIELDST } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const S = CONFIG.SHIELD, dt = 1 / 60;

function fresh() {
  G.resetGame(); state.running = true; G.debugOpenAllDoors();
  state.round = 1; state.health = 100; state.lastDamageTime = -99; state.gameOver = false;
}
function clearZombies() {
  for (const q of state.zombies.slice()) { q.active = false; q.alive = false; q.root.visible = false; }
  state.zombies.length = 0;
}
function giveAllParts() { for (const k of G.SHIELD_PARTS) state.shield.parts[k] = true; }
function atBench() {                               // F5.13: el banco está en el techo (pasarela de la sala)
  const B = CONFIG.SHIELD.bench;
  player.pos.set(B.x, B.y + 1.7, B.z - 1.1); G.updateInteract();
}
function hold(secs) { keys.KeyF = true; for (let i = 0; i < Math.round(secs * 60); i++) { G.tick(dt); G.updateInteract(); G.updateShield(dt); } keys.KeyF = false; }
function buildShieldNow() { fresh(); giveAllParts(); atBench(); G.interact(); hold(S.craftTime + 0.1); }

// 1) los 9 lugares: en su cuarto, fuera de todo collider, alcanzables caminando
fresh();
const all = [];
for (const k of G.SHIELD_PARTS) for (const sp of S.parts[k].spots) all.push({ k, sp });
check(all.length === 9, '9 lugares (3 por pieza)');
check(all.every(({ sp }) => G.roomAt(sp.x, sp.z) && G.roomAt(sp.x, sp.z).id === sp.room), 'cada lugar en su cuarto');
check(all.every(({ sp }) => !WORLD.colliders.some(c => c.solid && !c.overhead && sp.x > c.minX && sp.x < c.maxX && sp.z > c.minZ && sp.z < c.maxZ)),   // el techo de la caseta está arriba
  'ninguno adentro de un collider');
player.pos.set(0, 1.7, -2); G.updateFlowField(true);
const unreach = all.filter(({ sp }) => {
  const cx = Math.floor(sp.x), cz = Math.floor(sp.z);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (G.flowAt(cx + dx, cz + dz) >= 0) return false;
  return true;
});
check(unreach.length === 0, 'se llega a cada uno', unreach.map(u => u.sp.room).join());
// (F5.13: el banco del techo sí es sólido, 'shield:banco')
check(WORLD.colliders.every(c => !c.tag.startsWith('shield') || c.tag === 'shield:banco'), 'las piezas no tienen collider (no tocan el grid)');

// 2) sorteo por partida: en 60 partidas cada pieza usa sus 3 lugares; la pieza está donde dice el sorteo
const used = {};
for (let i = 0; i < 60; i++) {
  G.resetGame();
  for (const k of G.SHIELD_PARTS) {
    const sp = SHIELDST.spot[k];
    (used[k] = used[k] || new Set()).add(sp.room);
    const m = SHIELDST.pieces[k];
    if (!m.visible || Math.abs(m.position.x - sp.x) > 1e-9 || Math.abs(m.position.z - sp.z) > 1e-9) used.bad = true;
  }
}
check(G.SHIELD_PARTS.every(k => used[k].size === 3) && !used.bad, 'se sortean los 3 lugares de cada pieza, y la pieza aparece ahí',
  G.SHIELD_PARTS.map(k => k + ':' + [...used[k]].join('/')).join(' '));

// 3) recoger: desde su cuarto, una vez
fresh();
const sp0 = SHIELDST.spot.door, rm = G.ROOMS.find(q => q.id === sp0.room);
const cxr = (rm.x1 + rm.x2) / 2 - sp0.x, czr = (rm.z1 + rm.z2) / 2 - sp0.z, lr = Math.hypot(cxr, czr);
player.pos.set(sp0.x + cxr / lr * 0.9, 1.7, sp0.z + czr / lr * 0.9); G.updateInteract();   // 0.9 m hacia el centro del cuarto
check(G.interactState.kind === 'part' && G.promptFor(G.interactState).text === '[F] Recoger PUERTA DE ALACENA', 'cartel de la pieza');
check(G.interact() && state.shield.parts.door && !SHIELDST.pieces.door.visible, 'F la recoge');
G.updateInteract();
check(G.interactState.kind !== 'part' || G.interactState.target.key !== 'door', 'no se recoge dos veces');
check(/class="door"/.test(G.UI.shield.innerHTML) && /board off/.test(G.UI.shield.innerHTML), 'HUD: pieza llena, las otras grises');

// 4) banco: sin las 3 no arma; con las 3, mantener F 3 s
fresh(); state.shield.parts.door = true; atBench();
check(G.interactState.kind === 'bench' && G.promptFor(G.interactState).text === 'Banco de trabajo - faltan piezas (1/3)', 'banco: faltan piezas (1/3)');
check(!G.interact(), 'F sin piezas: nada');
hold(S.craftTime + 0.2);
check(!state.shield.built, 'mantener F sin piezas no arma');
giveAllParts(); G.updateInteract();
check(G.promptFor(G.interactState).text === '[F] Mantener para armar el escudo', 'con las 3: "mantener para armar"');
G.interact(); hold(1.5);
keys.KeyF = false; G.updateShield(dt);
check(!state.shield.built && SHIELDST.craftT === 0, 'soltar F a la mitad corta el armado');
hold(S.craftTime - 0.1);
check(!state.shield.built, 'a los 2.9 s todavía no');
hold(0.2);
check(state.shield.built && state.shield.has && state.shield.hp === S.durability, 'a los 3 s: armado, en la espalda, 500 de durabilidad');

// 5) ataque real de zombie: en la espalda bloquea de atrás, no de frente
function zombieHit(dz) {                                   // dz > 0: detrás (el jugador mira a -z)
  clearZombies(); state.round = 1;
  player.pos.set(0, 1.7, 10); G.setCam(0); G.updateFlowField(true);
  const q = G.spawnZombie(); q.state = 'walk'; q.px = 0; q.pz = 10 + dz; q.attackCd = 0; q.mode = 'flow';
  state.health = 100; state.lastDamageTime = -99;
  const hp0 = state.shield.hp;
  for (let i = 0; i < 10 && q.swingT <= 0; i++) { G.tick(dt); G.updateZombies(dt); }
  return { health: state.health, shield: hp0 - state.shield.hp };
}
let r = zombieHit(0.9);
check(r.health === 100 && r.shield === CONFIG.ZOMBIE.damage, 'en la espalda: golpe de atrás bloqueado (-25 al escudo)');
r = zombieHit(-0.9);
check(r.health === 75 && r.shield === 0, 'en la espalda: golpe de frente pega');

// 6) equipado (tecla 3): no dispara, bloquea de frente, no de atrás
check(G.toggleShield() && weaponsState.phase === 'shield', 'tecla 3: equipa');
const shots = state.shotsFired; weaponsState.lastShot = -1e9; G.fireWeapon();
check(state.shotsFired === shots, 'equipado no dispara');
G.meleeState.lastAttack = -1e9; G.meleeAttack();
check(weaponsState.phase === 'shield', 'equipado no acuchilla');
state.grenades = 2; keys.KeyG = true;
check(!G.startCook() && state.grenades === 2, 'equipado no saca granada'); keys.KeyG = false;
r = zombieHit(-0.9);
check(r.health === 100 && r.shield === 25, 'equipado: golpe de frente bloqueado');
r = zombieHit(0.9);
check(r.health === 75 && r.shield === 0, 'equipado: golpe de atrás pega');
check(G.toggleShield() && weaponsState.phase === 'switching', 'tecla 3 otra vez: lo guarda y saca el arma');

// 7) empujón: al frente, 100 de daño, lo aleja 2 m, cooldown 0.8 s; no pega atrás ni a través de paredes
buildShieldNow(); clearZombies();
player.pos.set(0, 1.7, 10); G.setCam(0); G.updateFlowField(true);
weaponsState.phase = 'idle'; G.toggleShield();
const qf = G.spawnZombie(); qf.state = 'walk'; qf.px = 0; qf.pz = 8.6; qf.health = 1000;
const qb = G.spawnZombie(); qb.state = 'walk'; qb.px = 0; qb.pz = 11.4; qb.health = 1000;
check(G.shieldBash() === 1 && qf.health === 1000 - S.bashDamage && qb.health === 1000, 'empujón: pega al de adelante (100), no al de atrás');
check(Math.abs((10 - qf.pz) - (1.4 + S.bashKnock)) < 0.05, 'lo aleja 2 m', `(quedó a ${(10 - qf.pz).toFixed(2)} m)`);
qf.pz = 8.6;
check(G.shieldBash() === 0, 'cooldown: el segundo inmediato no sale');
G.tick(S.bashCooldown + 0.01);
check(G.shieldBash() === 1, 'pasados 0.8 s, sí');
clearZombies();
player.pos.set(6.8, 1.7, 6); G.setCam(Math.PI / 2 * -1); G.updateFlowField(true);   // mirando a +x, pared x=8 (z 4..8) en el medio
const qw = G.spawnZombie(); qw.state = 'walk'; qw.px = 8.6; qw.pz = 6; qw.health = 1000;   // a 1.8 m: dentro del alcance
G.tick(1);
check(G.shieldBash() === 0 && qw.health === 1000, 'no empuja a través de una pared');

// 8) se rompe, y se vuelve a sacar del banco sin piezas
buildShieldNow(); weaponsState.phase = 'idle'; G.toggleShield();
state.shield.hp = 20;
r = zombieHit(-0.9);
check(!state.shield.has && weaponsState.phase !== 'shield' && state.shield.built, 'a 0 se rompe: lo perdés y volvés al arma (sigue armado)');
check(Object.values(state.shield.parts).every(v => v) && G.SHIELD_PARTS.every(k => !SHIELDST.pieces[k].visible), 'no reaparecen piezas');
G.tick(0.1); G.updateShield(dt);
check(SHIELDST.benchModel.visible, 'el escudo vuelve a estar en el banco');
atBench();
check(G.promptFor(G.interactState).text === '[F] Agarrar el escudo' && G.interact() && state.shield.has && state.shield.hp === S.durability,
  'F lo saca del banco con la durabilidad llena');

// 9) teclas 1 y 2
fresh(); G.giveWeapon('smg'); weaponsState.phase = 'idle';
G.selectWeapon(0);
check(weaponsState.phase === 'switching' && weaponsState.pendingSlot === 0, 'tecla 1: saca la primera');
weaponsState.phase = 'idle'; weaponsState.pendingSlot = -1;
G.selectWeapon(5);
check(weaponsState.phase === 'idle', 'tecla de un slot vacío: nada');

// 10) reset
buildShieldNow();
G.resetGame();
check(!state.shield.built && !state.shield.has && G.SHIELD_PARTS.every(k => !state.shield.parts[k] && SHIELDST.pieces[k].visible) &&
  !SHIELDST.benchModel.visible, 'resetGame: sin escudo, piezas de nuevo en el mapa');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
