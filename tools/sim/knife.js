// Cuchillo: cooldown, alcance, munición infinita, puntos fijos al matar, umbrales de una/dos.
// El harness no corre updateWeapon() cuadro a cuadro, así que swing() simula que la animación
// de 380ms ya terminó (en el juego real, mucho antes de los 800ms de cooldown) — se usa SIEMPRE
// tras meleeAttack(), incluso en un fallo, porque la animación corre igual haya pegado o no.
const G = require('./harness.js');
const { state, player, CONFIG, weaponsState } = G;
const check = (c, msg, extra = '') => { console.log((c ? '  ok   ' : '  FALLA') + ' ' + msg + ' ' + extra); if (!c) fail++; };
let fail = 0;
state.running = true; G.debugOpenAllDoors();

function swing() {
  G.meleeAttack();
  weaponsState.phase = 'idle'; weaponsState.phaseT = 0;
}
// un sobreviviente de un test anterior (p.ej. ronda 6, que resiste 2 golpes) puede quedar
// parado justo donde spawnea el siguiente: el rayo pegaría en él, no en el nuevo objetivo.
function killAllAlive() {
  for (const q of state.zombies.slice()) if (q.alive) G.damageZombie(q, 999999, false);
}
// player mirando hacia -z (yaw 0), zombie 1.5u por delante, dentro de rango (2u)
function freshZombie(round) {
  killAllAlive();
  state.round = round; G.updateFlowField(true);
  player.pos.set(0, 1.7, 10); G.setCam(0);
  const z = G.spawnZombie(); z.state = 'walk'; z.px = 0; z.pz = 8.5;
  G.placeRoot(z, 0);
  G.scene.updateMatrixWorld(true);
  return z;
}

// 1) daño: un golpe mata ronda 1
let z = freshZombie(1);
const shots0 = state.shotsFired;
G.meleeState.lastAttack = -9999;
swing();
check(!z.alive, 'un golpe mata ronda 1 (headshot asumido, 300 dmg vs 150 hp)');
check(state.shotsFired === shots0, 'no toca shotsFired/shotsHit (munición infinita no infla precisión)');

// 2) cooldown real: segundo golpe inmediato se ignora, pasado el cooldown sí conecta
z = freshZombie(1);
G.meleeState.lastAttack = -9999;
swing();                                    // ataque de control: mata
check(!z.alive, 'ataque de control también mata');
z = freshZombie(1);                         // nuevo objetivo para el segundo intento
swing();                                    // inmediato: cooldown de 800ms (vm-time) aún no pasó
check(z.alive, 'cooldown bloquea un segundo golpe inmediato', `(${CONFIG.KNIFE.cooldown}ms)`);
G.meleeState.lastAttack = -1e9;             // "hace mucho" en el reloj interno del juego
swing();
check(!z.alive, 'pasado el cooldown, el golpe sí conecta');

// 3) alcance: fuera de 2 unidades no pega
G.meleeState.lastAttack = -9999;
z = freshZombie(1); z.pz = 6.5;   // a 3.5u
G.placeRoot(z, 0); G.scene.updateMatrixWorld(true);
swing();
check(z.alive, 'fuera de alcance (2u) no golpea', `(estaba a ${(10 - 6.5).toFixed(1)}u)`);

// 4) puntos: siempre 130 al matar con cuchillo (override, no depende de POINTS.kill/headshotKill)
z = freshZombie(1);           // limpia sobrevivientes ANTES de resetear puntos
G.meleeState.lastAttack = -9999;
state.points = 0;
swing();
check(!z.alive, 'control: el golpe de la prueba de puntos sí mató');
check(state.points === CONFIG.POINTS.meleeKill, 'kill con cuchillo da exactamente 130', `(${state.points})`);

// 5) umbrales exactos del spec, asumiendo headshot (criterio documentado en CONFIG.KNIFE)
for (const [r, oneShot, twoShot] of [[1, true, true], [2, true, true], [3, false, true], [4, false, true], [5, false, true], [6, false, false]]) {
  G.meleeState.lastAttack = -9999;
  z = freshZombie(r);
  swing();
  check(!z.alive === oneShot, `ronda ${r}: 1 golpe mata=${oneShot}`, `(hp ${CONFIG.ZOMBIE.health(r)}, quedó ${z.alive ? Math.round(z.health) : 'muerto'})`);
  if (z.alive) {
    G.meleeState.lastAttack = -9999;
    swing();
    check(!z.alive === twoShot, `ronda ${r}: 2 golpes mata=${twoShot}`);
  }
}

// 6) no atraviesa paredes (mismo principio que las balas)
G.debugOpenAllDoors();
state.round = 1; G.updateFlowField(true);
z = freshZombie(1);
z.px = 6; z.pz = 3.9;                                  // detrás de la pared sur de la Sala (el hueco de D1 es x[-1,1])
G.placeRoot(z, 0);
player.pos.set(6, 1.7, 4.3); G.setCam(0);
G.scene.updateMatrixWorld(true);
G.meleeState.lastAttack = -9999;
const hpW = z.health;
swing();
check(z.health === hpW, 'no golpea a través de una pared sólida');

// 7) instakill: cualquier golpe (incluso al cuerpo, sin headshot) mata
G.debugOpenAllDoors();
z = freshZombie(6);                                    // 650 hp, ni 1 ni 2 golpes normales alcanzan
state.effects.instakill = 30;
G.meleeState.lastAttack = -9999;
swing();
check(!z.alive, 'insta-kill: un golpe mata aunque el daño normal no alcance', `(hp ${CONFIG.ZOMBIE.health(6)})`);
state.effects.instakill = 0;

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
