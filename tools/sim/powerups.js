// Power-ups: drop al morir, recolección al pasar, efectos, y la garantía "cada 4 rondas".
const G = require('./harness.js');
const { state, player, CONFIG, PICKUPS } = G;
const check = (c, msg, extra = '') => { console.log((c ? '  ok   ' : '  FALLA') + ' ' + msg + ' ' + extra); if (!c) fail++; };
let fail = 0;
state.running = true; G.debugOpenAllDoors();

// 1) probabilidad: sobre muchas muertes, la tasa de drop ronda el 3% (sin forzar, sin garantía)
{
  state.round = 1;   // ronda 1 no es múltiplo de 4: sin garantía, solo el roll aleatorio
  PICKUPS.pool.forEach(p => G.applyPowerup ? null : null);
  PICKUPS.pool.forEach(p => { p.active = false; p.mesh.visible = false; });
  const N = 20000;
  let drops = 0;
  const origRandom = Math.random;
  for (let i = 0; i < N; i++) {
    const before = PICKUPS.pool.filter(p => p.active).length;
    G.trySpawnPickup(0, 0, null);
    const after = PICKUPS.pool.filter(p => p.active).length;
    if (after > before) { drops++; PICKUPS.pool.find(p => p.active).active = false; }  // libera slot para seguir midiendo
    else if (after === before && before === PICKUPS.poolSize) break;
  }
  const rate = drops / N;
  check(Math.abs(rate - CONFIG.POWERUPS.dropChance) < 0.01, 'tasa de drop ≈ 3%', `(medido ${(rate * 100).toFixed(2)}%, n=${N})`);
}

// 2) recolección: caminar sobre el cubo lo recoge y aplica el efecto
{
  PICKUPS.pool.forEach(p => { p.active = false; });
  state.weapons.forEach(w => { w.mag = 0; w.reserve = 0; });   // seco, para probar MAX AMMO
  G.trySpawnPickup(5, 5, 'maxammo');
  const slot = PICKUPS.pool.find(p => p.active);
  check(!!slot && slot.type === 'maxammo', 'trySpawnPickup(forceType) crea el slot correcto');
  player.pos.set(50, 1.7, 50);          // lejos: no se recoge todavía
  G.updatePickups(1 / 60);
  check(slot.active, 'no se recoge estando lejos');
  player.pos.set(5, 1.7, 5);            // encima
  G.updatePickups(1 / 60);
  check(!slot.active, 'se recoge al pasar por encima');
  const def = CONFIG.WEAPONS[state.weapons[0].id];
  check(state.weapons[0].mag === def.magSize && state.weapons[0].reserve === def.reserveMax,
        'MAX AMMO llena cargador y reserva de TODAS las armas', `(${state.weapons[0].mag}/${state.weapons[0].reserve})`);
}

// 3) expira solo si no se recoge (15s)
{
  PICKUPS.pool.forEach(p => { p.active = false; });
  G.trySpawnPickup(5, 5, 'maxammo');
  const slot = PICKUPS.pool.find(p => p.active);
  player.pos.set(50, 1.7, 50);
  for (let t = 0; t < CONFIG.POWERUPS.lifespan - 0.5; t += 0.5) G.updatePickups(0.5);
  check(slot.active, 'sigue activo justo antes de expirar');
  G.updatePickups(1);
  check(!slot.active, 'expira pasados los 15s sin recogerse');
}

// 4) INSTA-KILL: dura 30s, mata cualquier golpe (ya probado en knife.js con el cuchillo aquí con bala)
{
  state.effects.instakill = 0;
  G.applyPowerup('instakill');
  check(state.effects.instakill === CONFIG.POWERUPS.types.instakill.duration, 'insta-kill dura 30s', `(${state.effects.instakill})`);
  for (let t = 0; t < 30; t += 1 / 60) G.updateEffects(1 / 60);
  check(state.effects.instakill === 0, 'insta-kill termina solo, no se queda colgado');
}

// 5) DOUBLE POINTS: duplica TODO lo que suma addPoints, 30s
{
  state.effects.doublePoints = 0;
  state.points = 0;
  G.applyPowerup('doublepoints');
  check(state.effects.doublePoints === CONFIG.POWERUPS.types.doublepoints.duration, 'doble puntos dura 30s');
  G.addPoints(10);
  check(state.points === 20, 'con el efecto activo, 10 puntos se acreditan como 20', `(${state.points})`);
  state.effects.doublePoints = 0;
  state.points = 0;
  G.addPoints(10);
  check(state.points === 10, 'sin el efecto, puntos normales', `(${state.points})`);
}

// 6) garantía: ronda múltiplo de 4, el PRIMER kill fuerza maxammo aunque el roll aleatorio falle
{
  PICKUPS.pool.forEach(p => { p.active = false; });
  state.round = 4;
  G.roundState.guaranteedDrop = false;
  G.debugOpenAllDoors(); G.updateFlowField(true);
  player.pos.set(0, 1.7, 10); G.setCam(0);
  // fuerza que el roll aleatorio NUNCA de 3% (siempre falla), para aislar la garantía
  const origRandom = Math.random;
  Math.random = () => 0.99;
  const z = G.spawnZombie(); z.state = 'walk'; z.px = 0; z.pz = 8.5;
  G.placeRoot(z, 0); G.scene.updateMatrixWorld(true);
  G.damageZombie(z, 999999, false);        // muere: dispara onZombieDeath -> garantía
  Math.random = origRandom;
  const dropped = PICKUPS.pool.find(p => p.active);
  check(!!dropped && dropped.type === 'maxammo', 'ronda 4, 1er kill: garantiza MAX AMMO pese al roll fallido');
  dropped && (dropped.active = false);

  // el SEGUNDO kill de la misma ronda ya no fuerza nada (la garantía se consume una vez)
  Math.random = () => 0.99;
  const z2 = G.spawnZombie(); z2.state = 'walk'; z2.px = 0; z2.pz = 8.5;
  G.placeRoot(z2, 0); G.scene.updateMatrixWorld(true);
  G.damageZombie(z2, 999999, false);
  Math.random = origRandom;
  check(!PICKUPS.pool.some(p => p.active), 'el 2do kill de esa ronda no fuerza otro drop');
}

// 7) ronda que NO es múltiplo de 4: sin garantía
{
  PICKUPS.pool.forEach(p => { p.active = false; });
  state.round = 5;
  G.roundState.guaranteedDrop = false;
  G.debugOpenAllDoors(); G.updateFlowField(true);
  player.pos.set(0, 1.7, 10); G.setCam(0);
  const origRandom = Math.random;
  Math.random = () => 0.99;
  const z = G.spawnZombie(); z.state = 'walk'; z.px = 0; z.pz = 8.5;
  G.placeRoot(z, 0); G.scene.updateMatrixWorld(true);
  G.damageZombie(z, 999999, false);
  Math.random = origRandom;
  check(!PICKUPS.pool.some(p => p.active), 'ronda 5 (no múltiplo de 4): sin garantía, roll fallido = sin drop');
}

// 8) resetGame limpia pickups y efectos
{
  G.trySpawnPickup(1, 1, 'maxammo');
  state.effects.instakill = 15; state.effects.doublePoints = 8;
  G.resetGame();
  check(!PICKUPS.pool.some(p => p.active), 'resetGame desactiva todos los pickups');
  check(state.effects.instakill === 0 && state.effects.doublePoints === 0, 'resetGame apaga los efectos activos');
}

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
