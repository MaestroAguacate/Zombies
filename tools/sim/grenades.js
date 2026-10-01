// V2 F2.7: granadas. Stock por ronda, cocinar, rebote sin atravesar colliders, radio y caída, línea libre,
// daño propio (ignora i-frame, puede matar), almas, reset.
const G = require('./harness.js');
const { state, player, CONFIG, WORLD, keys, weaponsState, GREN } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const GC = CONFIG.GRENADE, dt = 1 / 60;

function fresh() {
  G.resetGame(); state.running = true; G.debugOpenAllDoors();
  state.round = 1; state.health = 100; state.lastDamageTime = -99; state.gameOver = false;
  player.pos.set(0, 1.7, 10); G.setCam(0); G.updateFlowField(true);
}
function free(q) {
  q.active = false; q.alive = false; q.state = 'idle'; q.root.visible = false;
  const i = state.zombies.indexOf(q); if (i >= 0) state.zombies.splice(i, 1);
}
function clearZombies() { for (const q of state.zombies.slice()) free(q); }
function zombieAt(x, z, hp) {
  const q = G.spawnZombie();
  q.state = 'walk'; q.px = x; q.pz = z; q.health = hp || 1e6;
  return q;
}
function run(secs, fn) { for (let i = 0; i < secs * 60; i++) { G.tick(dt); G.updateGrenades(dt); if (fn) fn(i); } }

// 1) stock: +2 por ronda, tope 4, Max Ammo no recarga
fresh();
G.resetGame();
check(state.grenades === 0, 'resetGame: 0 granadas');
G.startRound(1);
check(state.grenades === 2, 'ronda 1: +2', `(${state.grenades})`);
G.startRound(2);
check(state.grenades === 4, 'ronda 2: 4');
G.startRound(3);
check(state.grenades === 4, 'ronda 3: tope 4, no pasa');
state.grenades = 3; G.applyPowerup('maxammo');
check(state.grenades === 3, 'Max Ammo no recarga granadas');
state.grenades = 3; G.startRound(4);
check(state.grenades === 4, 'con 3, la ronda siguiente llena hasta 4 (no 5)');

// 2) cocinar y tirar
fresh(); clearZombies(); state.grenades = 2;
keys.KeyG = true;
check(G.startCook() && state.grenades === 1 && weaponsState.phase === 'grenade', 'G: saca el pin, gasta una, el arma baja');
const shots = state.shotsFired;
weaponsState.lastShot = -1e9; G.fireWeapon();
check(state.shotsFired === shots, 'cocinando no dispara');
G.meleeState.lastAttack = -1e9; G.meleeAttack();
check(weaponsState.phase === 'grenade', 'cocinando no acuchilla');
check(!G.startCook() && state.grenades === 1, 'no saca otra mientras cocina');
run(1.0);
keys.KeyG = false;
run(dt);
const flying = GREN.pool.filter(g => g.active);
check(flying.length === 1 && Math.abs(flying[0].fuse - (GC.fuse - 1.0)) < 0.05, 'al soltar, la tira con la mecha que queda', `(${flying.length ? flying[0].fuse.toFixed(2) : '-'} s)`);
run(GC.throwTime + 0.05);
check(weaponsState.phase === 'idle', 'después del tiro vuelve al arma');
run(2.2);
check(GREN.pool.every(g => !g.active), 'explota al terminar la mecha');
state.grenades = 0; keys.KeyG = true;
check(!G.startCook(), 'sin granadas no hace nada'); keys.KeyG = false;

// 3) cocinada de más: explota en la mano, daño propio 50, ignora el i-frame, puede matar
fresh(); clearZombies(); state.grenades = 1; keys.KeyG = true;
G.startCook(); run(GC.fuse + 0.05); keys.KeyG = false;
check(state.health === 100 - GC.selfDamage && GREN.pool.every(g => !g.active), 'cocinada de más: explota en la mano (-50)', `(vida ${state.health})`);
fresh(); clearZombies();
G.damagePlayer(25, 0, 9);                                  // golpe de zombie: arranca el i-frame
G.explodeAt(player.pos.x + 2, player.pos.y - 0.85, player.pos.z);
check(state.health === 100 - 25 - GC.selfDamage, 'la granada pega aunque haya i-frame', `(vida ${state.health})`);
fresh(); clearZombies(); state.health = 40;
G.explodeAt(player.pos.x + 1, player.pos.y - 0.85, player.pos.z);
check(state.gameOver && state.health === 0, 'con 40 de vida, la granada propia te mata');
fresh(); clearZombies();
G.explodeAt(player.pos.x + 5.3, player.pos.y - 0.85, player.pos.z);
check(state.health === 100, 'fuera del radio no te lastima');

// 4) radio y caída: centro = 300 + 50 × ronda
fresh(); clearZombies();
const ex = 0, ez = 12, ey = 1.0;                           // centro de la sala, a la altura del cuerpo
const dists = [0, 1, 2.5, 4, 4.9, 5.1, 6];
const zs = dists.map(d => zombieAt(ex + d, ez));           // en línea hacia +x: sin muebles en el medio
G.explodeAt(ex, ey, ez);
const dmg = zs.map(q => 1e6 - q.health);
const expect = d => d > GC.radius ? 0 : (GC.dmgBase + GC.dmgPerRound) * (1 - (1 - GC.edgeMul) * d / GC.radius);
check(dists.every((d, k) => Math.abs(dmg[k] - expect(d)) < 1e-6), 'daño = centro × caída lineal hasta 25% en el borde',
  `(${dmg.map(v => Math.round(v)).join(' / ')} a ${dists.join(' / ')} m)`);
check(dmg[4] > 0 && dmg[5] === 0, 'a 4.9 m pega, a 5.1 m no');
clearZombies();
state.round = 10; const zc = zombieAt(ex, ez); G.explodeAt(ex, ey, ez);
check(1e6 - zc.health === GC.dmgBase + GC.dmgPerRound * 10, 'ronda 10: 800 en el centro');
// F4: desde la R11 la vida crece ×1.1 por ronda y la granada +50: en la R15 (1691) ya no mata sola
state.round = 15; const zk = zombieAt(ex, ez, 1050); G.explodeAt(ex, ey, ez);
check(!zk.alive, 'ronda 15: 1050 en el centro mata a uno de 1050 (vida de la R10)');
clearZombies();
const z15 = zombieAt(ex, ez, CONFIG.ZOMBIE.health(15)); G.explodeAt(ex, ey, ez);
check(z15.alive && Math.abs(z15.health - (CONFIG.ZOMBIE.health(15) - 1050)) < 1e-6, 'ronda 15: a uno de vida R15 lo deja vivo',
  `(${CONFIG.ZOMBIE.health(15)} -> ${Math.round(z15.health)})`);
clearZombies();

// 5) no atraviesa paredes: pared este de la sala (x=8, z 4..8) entre la explosión y la cocina
fresh(); clearZombies();
const zw = zombieAt(9.5, 6);
player.pos.set(9.5, 1.7, 6.8);
G.explodeAt(6.5, 1.0, 6);
check(zw.health === 1e6 && state.health === 100, 'detrás de una pared: ni zombie ni jugador reciben daño');
// ...pero un mueble más bajo que el centro del cuerpo (1 m) no tapa: granada en el piso detrás de la mesa volcada (0.45 m)
fresh(); clearZombies();
const zt = zombieAt(-3.2, 10.6);
G.explodeAt(-3.2, GC.size, 8.2);
check(zt.health < 1e6, 'la mesa volcada (0.45 m) no tapa la explosión', `(daño ${Math.round(1e6 - zt.health)})`);
// la cerca del porche (1.2 m) sí: granada en la arena, zombie del otro lado
clearZombies();
const zr = zombieAt(3, -3.0);
G.explodeAt(3, GC.size, -5.2);
check(zr.health === 1e6, 'la cerca del porche (1.2 m, más alta que el cuerpo) sí tapa');

// 6) kills: cuentan para las cajas de almas y las estadísticas
fresh(); clearZombies();
const sp = CONFIG.SOULS.spots.sotano, zs2 = zombieAt(sp.x + 1.5, sp.z, 10);   // F5.20: la del jardín oeste (sin la del pasillo)
G.explodeAt(sp.x + 1.5, 1.0, sp.z + 0.5);
check(!zs2.alive && state.souls.sotano === 1, 'kill de granada suma un alma a la caja cercana');
check(G.STATS.killsBy.grenade === 1 && G.favoriteWeapon().startsWith(GC.name), 'estadísticas: kill de GRANADA', `("${G.favoriteWeapon()}")`);
free(zs2);

// 7) rebote: contra la pared oeste de la sala, contra el piso, y en la pileta
fresh(); clearZombies();
let g = G.spawnGrenade(-5, 1.2, 12, -15, 0, 0, 10);
let minX = 1e9, back = false;
run(1.5, () => { minX = Math.min(minX, g.p.x); if (g.v.x > 0) back = true; });
check(minX >= -7.8 + GC.size - 1e-6 && back, 'rebota contra la pared, no la atraviesa', `(x mín ${minX.toFixed(3)})`);
g.active = false; g.mesh.visible = false;
g = G.spawnGrenade(0, 2.5, 12, 0, 0, 0, 10);
let ups = 0, vyPrev = 0;
run(3, () => { if (g.v.y > 0 && vyPrev <= 0) ups++; vyPrev = g.v.y; });
check(ups >= 1 && Math.abs(g.p.y - GC.size) < 1e-6 && g.v.length() === 0, 'contra el piso rebota y queda quieta', `(${ups} rebotes)`);
g.active = false; g.mesh.visible = false;
g = G.spawnGrenade(25, 1.0, 14, 0, 0, 0, 10);
run(3);
check(Math.abs(g.p.y - (-G.POOL.depth + GC.size)) < 1e-6, 'en la pileta cae al fondo', `(y ${g.p.y.toFixed(2)})`);
g.active = false; g.mesh.visible = false;
g = G.spawnGrenade(5, 3.5, 12, 0, 8, 0, 10);             // hacia arriba dentro de la sala: techo
let maxY = 0;
run(2, () => { maxY = Math.max(maxY, g.p.y); });
check(maxY <= CONFIG.WALL_H - GC.size + 1e-6, 'adentro no pasa el techo', `(y máx ${maxY.toFixed(2)})`);
g.active = false; g.mesh.visible = false;

// 8) 500 tiros al azar desde celdas navegables: ninguno termina adentro de un collider ni cruza una pared
fresh(); clearZombies();
const walls = WORLD.colliders.filter(c => c.solid && c.mesh && c.maxY - c.minY >= 3);   // paredes de 4 m
const solids = WORLD.colliders.filter(c => c.solid && (c.mesh || c.tag === 'poolRim'));
const cells = [];
for (let x = G.NAV.minX; x < G.NAV.minX + G.NAV.w; x++) for (let z = G.NAV.minZ; z < G.NAV.minZ + G.NAV.h; z++) if (G.isNav(x, z)) cells.push([x, z]);
let seed = 11;
const rnd = (a, b) => { seed = (seed * 16807) % 2147483647; return a + (b - a) * seed / 2147483647; };
function crossesWall(a, b) {
  for (const c of walls) {
    if (Math.max(a.y, b.y) >= c.maxY - 0.05) continue;
    let t0 = 0, t1 = 1;
    const dx = b.x - a.x, dz = b.z - a.z;
    for (const [p0, d, lo, hi] of [[a.x, dx, c.minX, c.maxX], [a.z, dz, c.minZ, c.maxZ]]) {
      if (Math.abs(d) < 1e-9) { if (p0 < lo || p0 > hi) { t0 = 2; break; } continue; }
      let u = (lo - p0) / d, v = (hi - p0) / d; if (u > v) [u, v] = [v, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    }
    if (t0 <= t1) {
      // el tramo toca la pared: solo es cruce si entra de un lado y sale del otro
      const inA = a.x > c.minX && a.x < c.maxX && a.z > c.minZ && a.z < c.maxZ;
      const inB = b.x > c.minX && b.x < c.maxX && b.z > c.minZ && b.z < c.maxZ;
      if (!inA && !inB && t0 > 0 && t1 < 1) return true;
    }
  }
  return false;
}
let inside = 0, crossed = 0;
for (let n = 0; n < 500; n++) {
  const [cx, cz] = cells[Math.floor(rnd(0, cells.length))];
  const a = rnd(0, 6.283), up = rnd(-0.3, 0.9), sp2 = rnd(4, GC.throwSpeed);
  g = G.spawnGrenade(cx + 0.5, 1.5 + G.groundY(cx + 0.5, cz + 0.5), cz + 0.5, Math.cos(a) * sp2, up * sp2 + GC.throwUp, Math.sin(a) * sp2, 99);
  const prev = g.p.clone();
  for (let i = 0; i < 180; i++) {
    G.tick(dt); G.stepGrenade(g, dt);
    if (crossesWall(prev, g.p)) crossed++;
    prev.copy(g.p);
  }
  const r = GC.size - 0.01, p = g.p;
  if (solids.some(c => p.x + r > c.minX && p.x - r < c.maxX && p.z + r > c.minZ && p.z - r < c.maxZ && p.y + r > c.minY && p.y - r < c.maxY)) inside++;
  g.active = false; g.mesh.visible = false;
}
check(inside === 0 && crossed === 0, '500 tiros al azar: ninguno queda adentro de un collider ni cruza una pared', `(adentro ${inside}, cruces ${crossed})`);

// 9) pools y reset
fresh(); clearZombies();
const nObj = (() => { let n = 0; G.scene.traverse(() => n++); return n; })();
for (let i = 0; i < 20; i++) G.explodeAt(0, 1, 12);
state.grenades = 4; keys.KeyG = true; G.startCook(); run(0.5); keys.KeyG = false; run(0.1);
const nObj2 = (() => { let n = 0; G.scene.traverse(() => n++); return n; })();
check(nObj2 === nObj, 'explosiones y tiros no crean objetos', `(${nObj} -> ${nObj2})`);
keys.KeyG = true; G.startCook(); keys.KeyG = false;
G.resetGame();
check(state.grenades === 0 && !GREN.cooking && GREN.pool.every(q => !q.active) && GREN.light.intensity === 0, 'resetGame: sin granadas, nada cocinándose ni en vuelo');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
