// V2 F5.9: calamares. Vida (> perro), velocidad (entre zombie corriendo y perro, <= jugador), tinta en arco
// (20 × tamaño, mancha la pantalla, el escudo la para, no atraviesa paredes), fusión (suma vida, crece, tope 7),
// rondas de mobs (perros, calamares, mezcla, 4 Sombrerones), Max Ammo del último, pools, reset.
const G = require('./harness.js');
const { state, player, CONFIG, roundState, SQPOOL, INK, BOSS } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const S = CONFIG.SQUID, P = CONFIG.PLAYER, dt = 1 / 60;
CONFIG.POWERUPS.dropChance = 0;

function fresh() {
  G.resetGame(); state.running = true; G.debugOpenAllDoors();
  state.round = 8; roundState.phase = 'active'; state.health = 100; state.lastDamageTime = -99; state.gameOver = false;
}
function clearZ() { for (const q of state.zombies.slice()) { q.active = q.alive = false; q.root.visible = false; } state.zombies.length = 0; }
function squidAt(x, z) {
  const q = SQPOOL.find(o => !o.active);
  G.resetZombie(q, { x, z }, false); state.zombies.push(q);
  q.px = x; q.pz = z; q.state = 'walk'; q.level = 0;
  return q;
}
function setPlayer(x, z) { player.pos.set(x, P.height, z); G.updateFlowField(true); }

// 1) números
fresh();
check(S.health(8) > CONFIG.DOGS.health(8) * 1.5, 'más vida que el perro más grande', `(${S.health(8)} contra ${CONFIG.DOGS.health(8) * 1.5})`);
check(S.speed > CONFIG.ZOMBIE.gaits.run.speed && S.speed < CONFIG.DOGS.speed && S.speed <= P.speed,
  'más rápido que un zombie corriendo, más lento que el perro, nunca más que el jugador', `(${S.speed})`);
setPlayer(0, -6); clearZ();
const q = squidAt(0, -16); q.inkT = 99;
let vmax = 0;
for (let i = 0; i < 120; i++) {
  const ox = q.px, oz = q.pz;
  G.tick(dt); G.updateFlowField(false); G.updateZombies(dt); q.inkT = 99;
  vmax = Math.max(vmax, Math.hypot(q.px - ox, q.pz - oz) / dt);
}
check(vmax > 3.5 && vmax <= S.speed + 1e-6, 'se arrastra hacia vos', `(máx ${vmax.toFixed(2)} m/s)`);
check(q.kind === 'squid' && q.hitParts.length === 6, 'es un calamar, con 6 partes que reciben balas');

// 2) tinta (F5.10: chorro continuo): jet s seguidos, dps × tamaño, mancha, escudo, paredes
const I = S.ink;
// corre `secs` s el calamar quieto (solo la tinta y la fusión) y las gotas; devuelve el daño recibido (sin regenerar)
function jet(z, secs, onFrame) {
  state.health = 1000; state.lastDamageTime = -99;
  let splat = false;
  for (let i = 0; i < Math.round(secs * 60); i++) {
    G.tick(dt); G.squidTick(z, dt); G.updateSquids(dt); if (INK.splat > 0) splat = true;
    if (onFrame) onFrame(i);
  }
  return { dmg: 1000 - state.health, splat };
}
fresh(); clearZ(); setPlayer(0, -6);
const a = squidAt(0, -14); a.heading = 0; a.inkT = 0;
check(G.canInk(a), 'a 8 m con línea libre puede escupir');
let r = jet(a, 0.8);
check(a.jetT > 0 && INK.shots.filter(s => s.active).length > 5, 'echa un chorro de gotas', `(${INK.shots.filter(s => s.active).length} en el aire)`);
r = jet(a, I.jet + 1);
const expect = I.dps * I.jet;
check(r.dmg > expect * 0.3 && r.dmg <= expect * 1.05 + 1e-6, 'quieto, el chorro entero saca ~' + expect + ' (' + I.dps + '/s)', `(${r.dmg.toFixed(1)})`);
check(a.jetT <= 0 && a.inkT > 0, 'y descansa ' + I.rest + ' s');
check(r.splat, 'mancha la pantalla');
for (let i = 0; i < 60 * (I.splat + 0.3); i++) { G.tick(dt); G.updateSquids(dt); }
check(INK.splat === 0 && G.UI.ink.style.opacity === '0', 'la mancha se va ' + I.splat + ' s después de la última gota');
// corriéndote de costado a mitad del chorro, se esquiva
fresh(); clearZ(); setPlayer(0, -6);
const side = squidAt(0, -14); side.heading = 0; side.inkT = 0;
let dir = 1;
r = jet(side, I.jet + 1, () => { player.pos.x += dir * CONFIG.PLAYER.speed * dt; if (Math.abs(player.pos.x) > 4) dir = -dir; });
check(r.dmg < expect * 0.6, 'moviéndote de costado sin parar te pega mucho menos', `(${r.dmg.toFixed(1)})`);
setPlayer(0, -2); check(!G.canInk(squidAt(0, -1.5)), 'muy cerca no escupe (muerde)');
clearZ(); setPlayer(13, 9);
const w = squidAt(13, -10);
check(!G.canInk(w), 'sin línea libre no escupe');
// escudo equipado de frente: la para
fresh(); clearZ(); setPlayer(0, -6); G.setCam(0);                  // mirando a -z, hacia el calamar
state.shield.built = state.shield.has = true; state.shield.hp = CONFIG.SHIELD.durability; G.weaponsState.phase = 'shield';
{ const sq = squidAt(0, -14); sq.heading = 0; sq.inkT = 0; r = jet(sq, I.jet + 1); }
check(r.dmg === 0 && state.shield.hp < CONFIG.SHIELD.durability, 'el escudo equipado la para', `(escudo ${state.shield.hp.toFixed(0)})`);
G.weaponsState.phase = 'idle';

// 3) fusión: suma vida, crece, pega más; tope 7
fresh(); clearZ(); setPlayer(0, -2);
const f1 = squidAt(3, -14), f2 = squidAt(3.5, -14);
const hp = f1.health + f2.health;
G.squidTick(f1, dt);
const big = f1.alive ? f1 : f2, gone = big === f1 ? f2 : f1;
check(!gone.alive && big.alive && big.fused === 1 && big.health === hp && big.maxHealth === hp, 'dos que se tocan se fusionan (vida sumada)', `(${big.health})`);
check(Math.abs(big.size - (1 + S.grow)) < 1e-9 && big.root.scale.x === big.size, 'y crece', `(×${big.size.toFixed(2)})`);
const pts = state.points;
for (let i = 0; i < 3; i++) { G.tick(dt); G.updateZombies(dt); }
check(!state.zombies.includes(gone) && !gone.active && state.points === pts, 'el otro se va sin dar puntos');
// hasta 7
clearZ();
const g = squidAt(3, -14); g.fused = 6; G.setSquidSize(g);
const h1 = squidAt(3.3, -14);
G.squidTick(g, dt);
check(g.fused === 7 && !h1.alive, 'llega a 7 fusiones');
const h2 = squidAt(3.3, -14.2);
G.squidTick(g, dt); G.squidTick(h2, dt);
check(g.fused === S.maxFuse && h2.alive, 'con ' + S.maxFuse + ' no se fusiona más');
// el grande escupe más fuerte
clearZ(); setPlayer(0, -6);
const gg = squidAt(0, -14); gg.fused = 7; G.setSquidSize(gg); gg.heading = 0;
G.fireInk(gg);
const drop = INK.shots.find(s => s.active);
check(Math.abs(drop.dmg - I.dps / I.rate * (1 + S.grow * 7)) < 1e-9, 'el grande escupe más fuerte (cada gota × ' + (1 + S.grow * 7).toFixed(1) + ')');

// 4) rondas de mobs
check(['dogs', 'squids', 'mixed', 'mixed', 'bosses', 'mixed', 'mixed', 'mixed', 'mixed', 'bosses'].every((k, i) => G.mobKind(i + 1) === k),
  'mobs: 1ra perros, 2da calamares, 3ra+ mezcla, 5ta (y cada 5) Sombrerones');
CONFIG.DOGS.enabled = true;
function mobRound(k) {
  fresh(); clearZ(); setPlayer(0, 10);
  roundState.mobCount = k - 1; roundState.nextDog = 8;
  G.startRound(8);
  const kinds = new Set();
  for (let i = 0; i < 60 * 20; i++) {
    G.tick(dt); G.updateRounds(dt); G.updateGiant(dt);   // F5.11: el calamar gigante escupe calamares
    for (const z of state.zombies) if (z.alive) kinds.add(z.kind);
    for (const z of state.zombies) if (z.alive && !z.boss) { z.health = 0; z.alive = false; z.state = 'dying'; z.t = 99; }   // los mata al instante
    G.updateZombies(dt);
  }
  return kinds;
}
let kinds = mobRound(2);
check(roundState.mob === 'squids' && [...kinds].join() === 'squid', '2da ronda de mobs: solo calamares', `(${roundState.mob}: ${[...kinds].join(', ')})`);
fresh(); roundState.mobCount = 1; roundState.nextDog = 9; G.queueRound(9, 1);
check(G.UI.banner.textContent === S.banner, 'con su cartel', `("${G.UI.banner.textContent}")`);
kinds = mobRound(3);
check(roundState.mob === 'mixed' && kinds.has('dog') && kinds.has('squid') && kinds.size === 2, '3ra: perros y calamares', `(${[...kinds].join(', ')})`);
fresh(); clearZ(); setPlayer(0, 10);
roundState.mobCount = 4; roundState.nextDog = 8; CONFIG.BOSS.enabled = true;
G.startRound(8);
for (let i = 0; i < 10; i++) { G.tick(dt); G.updateRounds(dt); }
const bosses = BOSS.pool.filter(z => z.active && z.alive);
check(roundState.mob === 'bosses' && roundState.total === 0 && bosses.length === 4 && bosses.every(z => z.variant === 'sombrero'),
  '5ta: 4 Sombrerones normales', `(${bosses.length})`);
check(G.NIGHT.target === 1 && G.NIGHT.rain, 'de noche y con lluvia');
CONFIG.DOGS.enabled = false; CONFIG.BOSS.enabled = false;

// 5) la escena no crece y reset
fresh(); clearZ(); setPlayer(0, -6);
const kids = G.scene.children.length;
for (let i = 0; i < 6; i++) { const s = squidAt(-4 + i * 1.6, -14); G.fireInk(s); }
for (let i = 0; i < 120; i++) { G.tick(dt); G.updateZombies(dt); G.updateSquids(dt); state.health = 100; }
check(G.scene.children.length === kids, 'calamares y tinta no crean objetos');
G.resetGame();
check(SQPOOL.every(z => !z.active && z.fused === 0 && z.size === 1) && INK.shots.every(s => !s.active) && roundState.mobCount === 0,
  'resetGame: calamares guardados, sin tinta, cuenta de mobs en 0');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
