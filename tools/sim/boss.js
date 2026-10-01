// V2 F5: El Sombrerón. Rondas, aparición, navegación por las puertas, barrido, sombrero (×3, fase 2), silbido,
// invocación, embestida (4.4 m/s, aturdido al chocar), recompensa, reset
const G = require('./harness.js');
const { state, player, CONFIG, roundState, BOSS, STATS } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, P = CONFIG.PLAYER, B = CONFIG.BOSS;
CONFIG.BOSS.enabled = true;
CONFIG.POWERUPS.dropChance = 0;
const Z = () => BOSS.z;
function clearZ() { for (const q of state.zombies) { q.active = q.alive = false; q.root.visible = false; } state.zombies.length = 0; }
function fresh(open) {
  G.resetGame(); state.running = true; if (open) G.debugOpenAllDoors();
  state.round = 12; roundState.phase = 'active';
}
function setPlayer(x, z, yaw) { player.pos.set(x, P.height, z); G.setCam(yaw || 0); G.updateFlowField(true); }
function bossAt(x, z) {
  const b = Z(); G.spawnBoss(); b.px = x; b.pz = z; b.state = 'walk'; b.level = 0; b.act = null;
  return b;
}
function tickAll(n, keepHp = true) {
  for (let i = 0; i < n; i++) {
    G.tick(dt); G.updateFlowField(false); G.updateZombies(dt); G.updateBoss(dt);
    if (keepHp) { state.health = 100; state.lastDamageTime = -99; }
  }
}

// 1) rondas
check([12, 20, 28, 36].every(G.isBossRound) && ![11, 13, 19, 21].some(G.isBossRound), 'sale en la R12, R20, R28... (cada 8)');
CONFIG.BOSS.enabled = false; check(!G.isBossRound(12), 'BOSS.enabled = false: no sale'); CONFIG.BOSS.enabled = true;
CONFIG.DOGS.enabled = true;
fresh(true); roundState.nextDog = 12; G.startRound(12);
check(!roundState.dogs && roundState.nextDog === 13 && roundState.bossPending, 'perros en la ronda del boss: se corren a la 13');
CONFIG.DOGS.enabled = false;

// 2) aparición en la playa
fresh(true); setPlayer(0, 10);
const fog0 = G.scene.fog.far;
G.startRound(12); G.updateRounds(dt);
const b = Z();
check(G.bossAlive() && !roundState.bossPending && Math.hypot(b.px - B.spawn.x, b.pz - B.spawn.z) < 0.3, 'con la playa abierta, sale de la playa');
check(b.health === B.health(12) && b.maxHealth === Math.round(13600 * 1.3), 'F5.9: vida (4000 + 800 × ronda) × 1.3', `(${b.health})`);
check(G.UI.banner.textContent === B.name, 'cartel "' + B.name + '"');
tickAll(90);
check(G.scene.fog.far < fog0 * 0.7, 'la niebla se cierra', `(${fog0} -> ${G.scene.fog.far.toFixed(0)})`);
check(G.UI.boss.style.display === 'block' && G.UI.bossName.textContent === B.name, 'barra de vida con el nombre');
tickAll(60 * 10);
check(G.scene.fog.far === B.fogFar, 'F5.8: queda cerrada toda la pelea', `(${G.scene.fog.far})`);
G.damageZombie(b, 1e7, false);
tickAll(60 * 3);
check(G.scene.fog.far === fog0, 'al morir se vuelve a abrir');
// con la playa cerrada: el punto abierto más lejano, fuera de vista
fresh(false); setPlayer(0, -1, Math.PI);
G.startRound(12); G.updateRounds(dt);
check(G.bossAlive() && Z().pz > -4 && G.flowAt(Math.floor(Z().px), Math.floor(Z().pz)) >= 0, 'con la playa cerrada: sale adentro, en un lugar alcanzable',
  `(${Z().px.toFixed(1)}, ${Z().pz.toFixed(1)})`);

// 3) navegación: de la playa a cada cuarto, por las puertas de 2 m, sin trabarse
const dests = [['sala', 0, 10], ['cocina', 13, 9], ['pasillo', 0, 23], ['dormitorio', 10, 24], ['garaje', -10, 24],
               ['sótano', -10, 35], ['piscina', 24, 6], ['caseta', 20, 25], ['muelle', 0, -30]];
for (const [name, x, zz] of dests) {
  fresh(true); setPlayer(x, zz);
  const q = bossAt(B.spawn.x, B.spawn.z);
  let t = 0, maxStr = 0, vmax = 0, reached = false;
  for (; t < 150 && !reached; t += dt) {
    const ox = q.px, oz = q.pz, walking = !q.act && q.state === 'walk';
    tickAll(1);
    if (walking && !q.act) vmax = Math.max(vmax, Math.hypot(q.px - ox, q.pz - oz) / dt);
    maxStr = Math.max(maxStr, q.strikes);
    if (Math.hypot(q.px - x, q.pz - zz) < 2.2) reached = true;
  }
  check(reached && maxStr < 2 && vmax <= B.speedMin * 1.25 + 1e-6, 'llega a ' + name, `(${t.toFixed(0)} s, strikes ${maxStr}, vel máx ${vmax.toFixed(2)})`);
  clearZ();
}

// 4) golpe al piso (F5.5c, como el Margwa): de cerca, aviso, onda de slamRadius, 50 de daño, empujón
fresh(true); setPlayer(0, 10);
let q = bossAt(0, 11.6); q.attackCd = 0; q.throwT = 99;
state.health = 100; state.lastDamageTime = -99;
let hit = -1, x0 = player.pos.z;
for (let i = 0; i < 90 && hit < 0; i++) {
  G.tick(dt); G.updateFlowField(false); G.updateZombies(dt); G.updatePlayer(dt); G.updateBoss(dt);
  if (state.health < 100) hit = i;
}
check(hit >= Math.round(B.slamWind * 60) - 2, 'golpe al piso con aviso (' + B.slamWind + ' s)', `(pegó a los ${(hit / 60).toFixed(2)} s)`);
check(state.health === 100 - B.slamDamage, 'golpe al piso: ' + B.slamDamage + ' de daño', `(vida ${state.health})`);
check(BOSS.ring.visible, 'se ve la onda en el piso');
for (let i = 0; i < 30; i++) { G.tick(dt); G.updatePlayer(dt); G.updateBoss(dt); }
check(x0 - player.pos.z > 1.2, 'te empuja hacia afuera', `(${(x0 - player.pos.z).toFixed(2)} m)`);
check(!BOSS.ring.visible, 'la onda se va');
// alejarse durante el aviso: a 3.3 m te alcanza la onda, a 4.2 m no
function slamAt(dz, extra) {
  fresh(true); setPlayer(0, 10);
  const b = bossAt(0, 10 + 1.8); b.throwT = 99; if (extra) extra(b);
  state.health = 100; state.lastDamageTime = -99;
  G.startAct(b, 'slam', 0.01);
  player.pos.z = b.pz - dz;
  for (let i = 0; i < 3; i++) { G.tick(dt); G.updateZombies(dt); }
  return state.health;
}
check(slamAt(3.3) === 100 - B.slamDamage, 'a 3.3 m la onda te alcanza');
check(slamAt(4.2) === 100, 'a 4.2 m no');
check(slamAt(2, () => { state.shield.built = state.shield.has = true; state.shield.hp = CONFIG.SHIELD.durability; G.weaponsState.phase = 'shield'; }) === 100 - B.slamDamage,
  'el escudo no lo para (viene del piso)');
G.weaponsState.phase = 'idle';
fresh(true); setPlayer(6.8, 6);                            // en la sala, con la pared de la cocina (x 8) en el medio
q = bossAt(9.2, 6); q.throwT = 99; state.health = 100; state.lastDamageTime = -99;
G.startAct(q, 'slam', 0.01); for (let i = 0; i < 3; i++) { G.tick(dt); G.updateZombies(dt); }
check(state.health === 100, 'no atraviesa paredes');
clearZ();

// 5) sombrero: ×3, fase 2 al 25%, sale volando y cae al piso; insta-kill no lo mata
fresh(true); setPlayer(0, 10);
q = bossAt(0, 3);
let h0 = q.health;
G.damageZombie(q, 100, false, undefined, undefined, 'hat');
check(h0 - q.health === 300 && q.hatDmg === 300, 'el sombrero recibe ×3');
state.effects.instakill = 30; h0 = q.health;
G.damageZombie(q, 100, false);
check(q.alive && h0 - q.health === 100, 'insta-kill: al boss le hace el daño normal');
state.effects.instakill = 0;
check(q.hitParts.some(m => m.userData.part === 'hat'), 'con el sombrero puesto, se le puede pegar');
while (q.hatOn) G.damageZombie(q, 100, false, undefined, undefined, 'hat');
check(q.phase === 2 && Math.abs(q.hatDmg - B.hatFrac * q.maxHealth) < 300 && q.speed === G.bossSpeed(q), 'con el 25% de su vida en el sombrero: fase 2',
  `(sombrero ${q.hatDmg} de ${B.hatFrac * q.maxHealth}, vel ${q.speed.toFixed(2)})`);
check(!q.hitParts.some(m => m.userData.part === 'hat') && BOSS.hat.flying, 'el sombrero sale volando y ya no recibe balas');
for (let i = 0; i < 180; i++) G.updateBoss(dt);
const hg = BOSS.hat.g.position;
check(Math.abs(hg.y - (G.groundY(hg.x, hg.z) + 0.05)) < 1e-6, 'y cae al piso', `(y ${hg.y.toFixed(2)})`);
check(q.speed <= P.speed && B.chargeSpeed <= P.speed, 'ninguna fase más rápida que el jugador caminando');

// 6) invocación: 4 zombies alrededor, fuera del total de la ronda
const sp0 = roundState.spawned, n0 = state.zombies.length;
q.summonT = 0; G.bossTick(q, dt);
const summoned = state.zombies.filter(o => !o.boss);
check(state.zombies.length - n0 === B.summonCount && roundState.spawned === sp0, 'llama ' + B.summonCount + ' zombies (no cuentan para la ronda)');
check(summoned.every(o => Math.hypot(o.px - q.px, o.pz - q.pz) < 3 && G.isNav(Math.floor(o.px), Math.floor(o.pz))), 'alrededor suyo, en celdas libres');
clearZ(); state.zombies.push(q); q.active = q.alive = true; q.root.visible = true;

// 7) silbido: visión borrosa, controles a la mitad, 2 s
fresh(true); setPlayer(0, 14);
q = bossAt(0, 4); while (q.hatOn) G.damageZombie(q, 200, false, undefined, undefined, 'hat');
clearZ(); state.zombies.push(q); q.active = q.alive = true;
q.whistleT = 0; q.summonT = 99; q.throwT = 99; q.attackCd = 99;
G.bossTick(q, dt);
check(!q.act && q.whistleT > 0, 'a 10 m no silba: espera a tenerte cerca (' + B.whistleRange + ' m)');
q.pz = 8; q.whistleT = 0;
G.bossTick(q, dt);
check(q.act === 'whistle', 'a 6 m silba (' + B.whistleWind + ' s de aviso)');
tickAll(Math.ceil(B.whistleWind * 60) + 1);
check(player.dazeT > 1.9 && G.renderer.domElement.style.filter.indexOf('blur') === 0, 'a 6 m: visión borrosa', `(${G.renderer.domElement.style.filter})`);
const yaw0 = player.yaw; G.lookInput(100, 0); const dYaw = Math.abs(player.yaw - yaw0);
player.dazeT = 0; const yaw1 = player.yaw; G.lookInput(100, 0); const dYaw1 = Math.abs(player.yaw - yaw1);
check(Math.abs(dYaw / dYaw1 - B.dazeMul) < 1e-6, 'sensibilidad a la mitad');
player.dazeT = B.dazeTime; G.keys.KeyW = true; player.yaw = 0;
for (let i = 0; i < 40; i++) { G.tick(dt); G.updatePlayer(dt); }
check(Math.abs(player.speedNow - P.speed * B.dazeMul) < 0.05, 'velocidad a la mitad', `(${player.speedNow.toFixed(2)})`);
G.keys.KeyW = false;
for (let i = 0; i < 150; i++) { G.tick(dt); G.updatePlayer(dt); G.updateBoss(dt); }
check(player.dazeT === 0 && G.renderer.domElement.style.filter.indexOf('blur') < 0, 'a los 2 s se pasa');   // (F7a: el color del post queda)
setPlayer(0, 14); q.px = 0; q.pz = 8; q.whistleT = 0; q.act = null; G.bossTick(q, dt);
setPlayer(0, 17);                                           // te alejás durante el aviso (a 9 m)
for (let i = 0; i < Math.ceil(B.whistleWind * 60) + 1; i++) { G.tick(dt); G.bossTick(q, dt); q.px = 0; q.pz = 8; }
check(player.dazeT === 0, 'si te alejás a más de ' + B.whistleRange + ' m durante el aviso, no te afecta');

// 8) embestida: aviso, 4.4 m/s, te atropella, choca con la pared y queda aturdido 2 s
// (puertas cerradas: con D3 abierta, detrás del jugador, la embestida sigue por el pasillo)
fresh(false); setPlayer(0, 11);
q = bossAt(0, 5); q.health = q.maxHealth * 0.26; G.damageZombie(q, 1, false);
check(q.phase < 3, 'al 26% todavía no embiste');
q.health = q.maxHealth * 0.24; G.damageZombie(q, 1, false);
check(q.phase === 3 && !q.hatOn, 'debajo del 25%: fase 3 (y se le cae el sombrero)');
clearZ(); state.zombies.push(q); q.active = q.alive = true;
q.whistleT = q.summonT = 99; q.chargeT = 0;
G.bossTick(q, dt);
check(q.act === 'windup', 'avisa antes de embestir');
state.health = 100; state.lastDamageTime = -99;
let vch = 0, stunAt = -1, zmax = 0, hpStun = -1;
for (let i = 0; i < 60 * 6 && stunAt < 0; i++) {
  const oz = q.pz, wasCharge = q.act === 'charge';
  G.tick(dt); G.updateFlowField(false); G.updateZombies(dt); G.updatePlayer(dt);
  if (wasCharge && q.act === 'charge') vch = Math.max(vch, Math.abs(q.pz - oz) / dt);
  zmax = Math.max(zmax, q.pz);
  if (q.act === 'stun' && stunAt < 0) { stunAt = i; hpStun = state.health; }
}
check(Math.abs(vch - B.chargeSpeed) < 0.05, 'embiste a ' + B.chargeSpeed + ' m/s (tu velocidad caminando)', `(${vch.toFixed(2)})`);
check(hpStun === 100 - B.chargeDamage, 'te atropella: ' + B.chargeDamage + ' (una vez)', `(vida ${hpStun})`);
check(stunAt > 0 && zmax < 18 - B.radius + 0.01, 'choca con la pared (sin atravesarla) y queda aturdido', `(z máx ${zmax.toFixed(2)})`);
// aturdido 2 s y vuelve
fresh(true); setPlayer(0, 11);
q = bossAt(0, 5); q.phase = 3; q.speed = G.bossSpeed(q);
G.startAct(q, 'stun', B.stunTime);
let st = 0; while (q.act === 'stun' && st < 5) { tickAll(1); st += dt; }
check(Math.abs(st - B.stunTime) < 0.05, 'aturdido ' + B.stunTime + ' s', `(${st.toFixed(2)})`);
// 60 embestidas desde lugares al azar: ninguna cruza una pared
let bad = 0, runs = 0;
fresh(true);
const cells = [];
for (let cz = G.NAV.minZ; cz < G.NAV.minZ + G.NAV.h; cz++) for (let cx = G.NAV.minX; cx < G.NAV.minX + G.NAV.w; cx++) if (G.isNav(cx, cz)) cells.push([cx + 0.5, cz + 0.5]);
for (let k = 0; k < 4000 && runs < 60; k++) {
  // el destino cerca del origen (con el mapa grande, dos celdas al azar casi nunca quedan a menos de chargeRange)
  const a = cells[Math.floor(Math.random() * cells.length)], ang = Math.random() * Math.PI * 2, r = 4 + Math.random() * (B.chargeRange - 4);
  const cx = Math.floor(a[0] + Math.cos(ang) * r), cz = Math.floor(a[1] + Math.sin(ang) * r);
  if (!G.isNav(cx, cz)) continue;
  const c = [cx + 0.5, cz + 0.5], d = Math.hypot(a[0] - c[0], a[1] - c[1]);
  if (d < 4 || d > B.chargeRange) continue;
  player.pos.set(c[0], P.height, c[1]);
  q = bossAt(a[0], a[1]); q.phase = 3;
  if (!G.canCharge(q)) { clearZ(); continue; }
  runs++;
  G.startAct(q, 'windup', 0.01);
  // cada paso libre (se desliza por los costados de un mueble o una cerca: la recta inicio-fin puede no serlo)
  let lx = q.px, lz = q.pz, crossed = false;
  for (let i = 0; i < 60 * 4 && q.act; i++) {
    G.tick(dt); G.updateZombies(dt); state.health = 100; state.lastDamageTime = -99;
    if (q.state !== 'climb' && !G.segmentClear(lx, lz, q.px, q.pz, 0.05)) crossed = true;   // la escalera de la pileta cruza el borde a propósito
    lx = q.px; lz = q.pz;
  }
  if (crossed) bad++;
  clearZ();
}
check(runs >= 40 && bad === 0, 'embestidas al azar: ninguna cruza una pared', `(${runs} embestidas, ${bad} malas)`);

// 9) ronda: mitad de ritmo con el boss vivo, no termina hasta matarlo
fresh(true); setPlayer(0, 10);
G.startRound(12);
let times = [], last = 0;
for (let i = 0; i < 60 * 30; i++) {
  G.tick(dt); G.updateRounds(dt); G.updateFlowField(false); G.updateZombies(dt);
  state.health = 100; state.lastDamageTime = -99;
  if (roundState.spawned !== last) { times.push(i / 60); last = roundState.spawned; }
  for (const o of state.zombies) if (!o.boss && o.alive && o.state === 'walk') G.damageZombie(o, 1e6, false);
}
const gaps = times.slice(1).map((v, i) => v - times[i]);
check(gaps.length > 3 && Math.min(...gaps) >= CONFIG.ROUNDS.spawnInterval * B.spawnSlow - 0.02, 'con el boss vivo, zombies a la mitad de ritmo', `(gap mín ${Math.min(...gaps).toFixed(2)} s)`);
roundState.spawned = roundState.total;
for (let i = 0; i < 120; i++) { G.tick(dt); G.updateRounds(dt); G.updateZombies(dt); for (const o of state.zombies) if (!o.boss && o.alive) G.damageZombie(o, 1e6, false); }
check(roundState.phase === 'active' && G.bossAlive(), 'la ronda no termina con el boss vivo');

// 10) muerte y recompensa
const pts0 = state.points, perks0 = state.perks.length, kids0 = G.scene.children.length;
state.effects.doublePoints = 30;
G.damageZombie(Z(), 1e7, false);
check(state.points - pts0 === B.reward.points + CONFIG.POINTS.kill * 2, 'recompensa: 1000 puntos fijos (más el kill)', `(+${state.points - pts0})`);
check(state.perks.length === perks0 + 1, 'perk gratis', `(${state.perks.join(', ')})`);
check(G.PICKUPS.pool.some(p => p.active && p.type === 'maxammo'), 'Max Ammo en el piso');
check(STATS.bosses === 1, 'estadísticas: 1 boss');
state.effects.doublePoints = 0;
for (let i = 0; i < 200; i++) { G.tick(dt); G.updateRounds(dt); G.updateZombies(dt); G.updateBoss(dt); state.health = 100; }   // (una guitarra en el aire igual cae)
check(!G.bossAlive() && G.UI.boss.style.display === 'none' && roundState.phase === 'pause', 'muere, se va la barra y termina la ronda');
check(G.scene.children.length === kids0, 'la escena no crece');
// con 4 perks: 1000 más en vez del perk
fresh(true); setPlayer(0, 10);
state.perks = ['jugg', 'speed', 'dtap', 'stamin'];
q = bossAt(0, 3); const p1 = state.points;
G.damageZombie(q, 1e7, false);
check(state.perks.length === 4 && state.points - p1 === B.reward.points + B.reward.noPerkPoints + CONFIG.POINTS.kill, 'con 4 perks: 2000 en vez del perk');

// 12) F5.5b: velocidad según la vida, hasta el jugador caminando al 25%
fresh(true); setPlayer(0, 10);
q = bossAt(0, 3);
const spAt = f => { q.health = q.maxHealth * f; return G.bossSpeed(q); };
const s100 = spAt(1), s62 = spAt(0.625), s25 = spAt(0.25), s10 = spAt(0.1);
check(Math.abs(s100 - B.speedMin) < 1e-9 && Math.abs(s62 - (B.speedMin + B.speedMax) / 2) < 1e-9 && s25 === P.speed && s10 === P.speed,
  'velocidad: 1.6 con la vida llena, sube parejo, 4.4 (= jugador caminando) desde el 25%',
  `(${s100.toFixed(2)} / ${s62.toFixed(2)} / ${s25.toFixed(2)} / ${s10.toFixed(2)})`);
let fast = 0;
for (let f = 1; f >= 0; f -= 0.01) if (spAt(f) > P.speed + 1e-9) fast++;
check(fast === 0, 'nunca más rápido que el jugador caminando');
q.health = q.maxHealth * 0.5; G.damageZombie(q, 1, false);
check(Math.abs(q.speed - G.bossSpeed(q)) < 1e-9 && q.speed > B.speedMin, 'al recibir daño se acelera', `(${q.speed.toFixed(2)} al 50%)`);
clearZ();

// 13) guitarras: aviso, arco, 30 de daño, frenan en paredes, el escudo las para, solo en rango
function stepAll(n) { for (let i = 0; i < n; i++) { G.tick(dt); G.updateFlowField(false); G.updateZombies(dt); G.updateBoss(dt); } }
function quiet(q) { q.whistleT = q.summonT = q.chargeT = 99; q.attackCd = 99; }
fresh(true); setPlayer(0, -8);
q = bossAt(0, -20); quiet(q); q.throwT = 0;
G.bossTick(q, dt);
check(q.act === 'throw', 'a 12 m con línea libre: levanta la guitarra (' + B.guitarWind + ' s de aviso)');
state.health = 100; state.lastDamageTime = -99;
stepAll(Math.round(B.guitarWind * 60) + 1);
check(BOSS.guitars.some(g => g.active), 'la tira');
let peak = 0;
for (let i = 0; i < 120 && BOSS.guitars.some(g => g.active); i++) { stepAll(1); for (const g of BOSS.guitars) if (g.active) peak = Math.max(peak, g.p.y); }
check(state.health === 100 - B.guitarDamage, 'quieto: te pega ' + B.guitarDamage, `(vida ${state.health})`);
check(peak > 2.5 && peak < 4, 'por arriba de la cabeza y por debajo del techo de los cuartos', `(altura máx ${peak.toFixed(2)} m)`);
// de lejos (19 m) sube más, pero sigue por debajo de los 4 m del techo
fresh(true); setPlayer(0, -1.5);
q = bossAt(0, -20.5); quiet(q); G.throwGuitar(q); peak = 0;
for (let i = 0; i < 120 && BOSS.guitars.some(g => g.active); i++) { stepAll(1); state.health = 100; for (const g of BOSS.guitars) if (g.active) peak = Math.max(peak, g.p.y); }
check(peak < 4, 'a 19 m el arco no pasa los 4 m', `(${peak.toFixed(2)} m)`);
// te movés de costado después de que la tira (sin adelantar): no te pega
fresh(true); setPlayer(0, -8);
q = bossAt(0, -20); quiet(q);
state.health = 100; state.lastDamageTime = -99;
G.startAct(q, 'throw', 0.01); stepAll(2);
player.pos.x = 3;
for (let i = 0; i < 120; i++) stepAll(1);
check(state.health === 100 && BOSS.guitars.every(g => !g.active), 'si te corrés 3 m de costado, no te pega');
// adelanta: con el jugador caminando de costado apunta a donde va a estar
fresh(true); setPlayer(0, -8);
q = bossAt(0, -20); quiet(q);
player.vel.set(P.speed, 0, 0);
G.throwGuitar(q);
const gv = BOSS.guitars.find(g => g.active).v;
check(gv.x > 1, 'con el jugador moviéndose, apunta adelante', `(vx ${gv.x.toFixed(2)})`);
player.vel.set(0, 0, 0);
// escudo equipado de frente: lo para
fresh(true); setPlayer(0, -8);
state.shield.built = state.shield.has = true; state.shield.hp = CONFIG.SHIELD.durability;
G.weaponsState.phase = 'shield';
q = bossAt(0, -20); quiet(q);
state.health = 100; state.lastDamageTime = -99;
G.startAct(q, 'throw', 0.01);
for (let i = 0; i < 120; i++) stepAll(1);
check(state.health === 100 && state.shield.hp === CONFIG.SHIELD.durability - B.guitarDamage, 'el escudo equipado la para');
G.weaponsState.phase = 'idle';
// fuera de rango o sin línea libre: no la tira
fresh(true);
q = bossAt(0, -20); quiet(q);
setPlayer(0, -16.5); check(!G.canShootAt(q), 'a 3.5 m no tira (golpea el piso)');
setPlayer(0, 1); check(!G.canShootAt(q), 'a 21 m no tira');
setPlayer(13, 9); q.px = 13; q.pz = -10; check(!G.canShootAt(q), 'desde la playa, con vos en la cocina, no tira');
check(G.projBlocked(8, 2, 6) && !G.projBlocked(-10, 1, -24) && !G.projBlocked(0, 2, -10) && G.projBlocked(0, -0.1, -10),
  'frenan en paredes y en el piso, no en los límites invisibles');
clearZ();

// 14) minigun de cocos al 10%: aviso, ráfaga, mata quieto, correr de costado te salva, sin guitarras ni embestida
function gunBoss(px, pz) {
  fresh(true); setPlayer(px, pz);
  const b = bossAt(0, -20); quiet(b); b.throwT = 0;
  b.health = b.maxHealth * 0.11; G.damageZombie(b, b.maxHealth * 0.02, false);
  quiet(b);
  return b;
}
q = gunBoss(0, -12);
check(q.phase === 4 && BOSS.gunModel.visible, 'debajo del 10%: fase 4, saca la minigun');
G.bossTick(q, dt);
check(q.act !== 'throw' && q.act !== 'windup' && q.gun === 'spin', 'ya no tira guitarras ni embiste: la minigun gira');
q.px = 0; q.pz = -20;
state.health = 100; state.lastDamageTime = -99;
let firstHit = -1;
for (let i = 0; i < 60 * 4 && !state.gameOver; i++) {
  G.tick(dt); G.updateBoss(dt); G.bossTick(q, dt); q.px = 0; q.pz = -20;
  if (firstHit < 0 && state.health < 100) firstHit = i / 60;
}
check(firstHit >= B.gunSpin, 'avisa ' + B.gunSpin + ' s antes (gira)', `(primer coco a los ${firstHit.toFixed(2)} s)`);
check(state.gameOver, 'quieto a 8 m: te mata en una ráfaga');
// a 15 m corriendo de costado: casi nada
q = gunBoss(0, -5);
state.health = 100; state.lastDamageTime = -99;
let dir = 1;
for (let i = 0; i < 60 * (B.gunSpin + B.gunBurst) + 15; i++) {
  G.tick(dt); player.pos.x += dir * P.speed * dt; if (Math.abs(player.pos.x) > 6) dir = -dir;
  G.updateBoss(dt); G.bossTick(q, dt); q.px = 0; q.pz = -20;
}
check(!state.gameOver && state.health >= 60, 'a 15 m corriendo de costado te salvás', `(vida ${state.health})`);
check(q.gun === 'cool' || q.gun === 'idle', 'la ráfaga dura ' + B.gunBurst + ' s y descansa');
q = gunBoss(0, -12); G.bossTick(q, dt);
check(q.speed === Math.min(P.speed, G.bossSpeed(q)) && Math.abs(q.speed - P.speed * B.gunWalkMul) < 1e-9, 'mientras gira camina a la mitad', `(${q.speed.toFixed(2)})`);
// escudo equipado: los para (y se gasta)
q = gunBoss(0, -12);
state.shield.built = state.shield.has = true; state.shield.hp = CONFIG.SHIELD.durability;
G.weaponsState.phase = 'shield'; setPlayer(0, -12, 0);
state.health = 100;
for (let i = 0; i < 60 * 2; i++) { G.tick(dt); G.updateBoss(dt); G.bossTick(q, dt); q.px = 0; q.pz = -20; }
check(state.health === 100 && state.shield.hp < CONFIG.SHIELD.durability, 'el escudo equipado los para', `(escudo ${state.shield.hp})`);
G.weaponsState.phase = 'idle';
// detrás de la pared: no dispara
q = gunBoss(13, 9); q.px = 13; q.pz = -10;
for (let i = 0; i < 90; i++) { G.tick(dt); G.bossTick(q, dt); q.px = 13; q.pz = -10; }
check(q.gun === 'idle', 'sin línea libre no gira');
const kidsGun = G.scene.children.length;
q = gunBoss(0, -12);
for (let i = 0; i < 60 * 4; i++) { G.tick(dt); G.updateBoss(dt); G.bossTick(q, dt); q.px = 0; q.pz = -20; state.health = 100; }
check(G.scene.children.length === kidsGun, 'guitarras y cocos no crean objetos');

// 11) debug J y reset
fresh(true); state.round = 3;
G.debugKey('KeyJ', false); G.updateRounds(dt);
check(state.round === 4 && G.bossAlive(), 'J: la siguiente ronda trae al boss');
while (Z().hatOn) G.damageZombie(Z(), 500, false, undefined, undefined, 'hat');
player.dazeT = 1; G.updateBoss(dt);
G.resetGame(); G.updateBoss(dt);
check(!G.bossAlive() && Z().hatOn && Z().hatG.parent === Z().head && G.scene.fog.far === fog0 && G.renderer.domElement.style.filter.indexOf('blur') < 0,
  'resetGame: sin boss, sombrero puesto, sin niebla ni borroso');
check(!BOSS.gunModel.visible && BOSS.guitars.every(g => !g.active && !g.g.visible) && BOSS.cocos.every(c => !c.active && !c.m.visible),
  'resetGame: sin minigun, guitarras ni cocos');

// 15) F5.9: ojos, varios bosses a la vez, el Calamarón
fresh(true); setPlayer(0, 10);
q = bossAt(0, -15); quiet(q);
const eye = () => q.eyeMat.color.getHex();
const e0 = eye();
q.health = q.maxHealth * 0.19; G.bossDamaged(q, 0, false);
const e1 = eye();
q.health = q.maxHealth * 0.09; G.bossDamaged(q, 0, false);
check(e0 !== e1 && e1 !== eye() && e1 === 0xfff23a && eye() === 0xff1a10 && q.tears.visible, 'ojos: amarillos debajo del 20%, rojos con lágrimas debajo del 10%');
check(JSON.stringify(G.bossesFor(12)) === '["sombrero"]' && JSON.stringify(G.bossesFor(20)) === '["calamar"]' &&
  JSON.stringify(G.bossesFor(28)) === '["sombrero","sombrero","calamar"]' && JSON.stringify(G.bossesFor(36)) === JSON.stringify(G.bossesFor(28)),
  'calendario: R12 Sombrerón, R20 Calamarón, R28+ 2 Sombrerones y 1 Calamarón');
fresh(true); setPlayer(0, 10); state.round = 28;
G.startRound(28);
for (let i = 0; i < 5; i++) G.updateRounds(dt);
const alive = BOSS.pool.filter(z => z.active && z.alive);
check(alive.length === 3 && alive.filter(z => z.variant === 'calamar').length === 1 && !roundState.bossPending, 'R28: salen los 3', `(${alive.length})`);
check(Math.min(...alive.slice(1).map((z, i) => Math.hypot(z.px - alive[i].px, z.pz - alive[i].pz))) > 1, 'separados entre sí');
const cq = alive.find(z => z.variant === 'calamar');
check(cq.phase === 4 && cq.gunModel.visible && !cq.hatOn && cq.maxHealth === B.health(28) * B.calamar.healthMul,
  'Calamarón: minigun desde el arranque, sin sombrero, vida ×' + B.calamar.healthMul, `(${cq.maxHealth})`);
G.updateBoss(dt);
check(G.UI.bossName.textContent === B.name || G.UI.bossName.textContent === B.calamar.name, 'la barra muestra el más cercano');
// calamares que explotan: solo con poca vida, y dejan un charco grande
clearZ(); fresh(true); setPlayer(0, -8); state.round = 20;
G.spawnBoss('calamar'); q = BOSS.pool.find(z => z.variant === 'calamar');
q.px = 0; q.pz = -20; q.state = 'walk'; q.level = 0; q.act = null; quiet(q); q.gun = 'cool'; q.gunT = 99;
for (let i = 0; i < 60 * 8; i++) { G.tick(dt); G.bossTick(q, dt); G.updateBoss(dt); q.px = 0; q.pz = -20; q.gun = 'cool'; q.gunT = 99; }
check(!BOSS.squids.some(s => s.active) && !G.ACID.puddles.some(p => p.life > 0), 'con la vida alta no tira calamares');
q.health = q.maxHealth * (B.calamar.squidFrac - 0.05); q.squidT = 0;
let big = 0;
for (let i = 0; i < 60 * 4; i++) {
  G.tick(dt); G.bossTick(q, dt); G.updateBoss(dt); q.px = 0; q.pz = -20; q.gun = 'cool'; q.gunT = 99;
  for (const p of G.ACID.puddles) if (p.life > 0) big = Math.max(big, p.r);
}
check(big === B.calamar.puddleR, 'con poca vida tira un calamar que explota en un charco de ' + B.calamar.puddleR + ' m', `(${big})`);
G.resetGame();
// F5.26: la Bestia tampoco tiene sombrero
check(BOSS.pool.every(z => !z.active && z.hatOn === (z.variant === 'sombrero') && !z.tears.visible) && BOSS.squids.every(s => !s.active),
  'resetGame: todos los bosses afuera, ojos y calamares limpios');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
