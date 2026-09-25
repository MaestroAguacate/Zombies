// V2 F4: ahogado (sale del mar), arrastrado (piernas), ronda de perros (noche, relámpagos, Max Ammo al final)
const G = require('./harness.js');
const { state, player, CONFIG, roundState, NIGHT, DRIPS, WORLD } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, P = CONFIG.PLAYER;
CONFIG.POWERUPS.dropChance = 0;                     // solo drops forzados
function clearZ() { for (const q of state.zombies) { q.active = q.alive = false; q.root.visible = false; } state.zombies.length = 0; }
function fresh(round) {
  G.resetGame(); state.running = true; G.debugOpenAllDoors();
  state.round = round; roundState.phase = 'active';
}
function step(n, keepHp = true) {
  for (let i = 0; i < n; i++) {
    G.tick(dt); G.updateFlowField(false); G.updateZombies(dt); G.updateDrips(dt); G.updateNight(dt);
    if (keepHp) { state.health = 100; state.lastDamageTime = -99; }
  }
}

// 1) ahogado
const sea = G.SPAWN_POINTS.filter(s => s.sea);
check(sea.length === 4 && sea.every(s => s.valid && s.room === 'R10' && s.z < -22), '4 spawns en la orilla, navegables', `(${sea.length})`);
const atSea = s => Math.abs(s.z + 22.5) < 0.3;
function spawnMany(round, px, pz, N) {
  fresh(round); player.pos.set(px, P.height, pz); G.setCam(Math.PI); G.updateFlowField(true);
  const out = [];
  for (let i = 0; i < N; i++) {
    const z = G.spawnZombie(); if (!z) continue;
    out.push({ kind: z.kind, z: z.pz, hp: z.health, gait: z.gait, skin: z.flashMats[0].color.getHex(), speed: z.speed });
    clearZ();
  }
  return out;
}
let S = spawnMany(8, 0, -12, 800);
const dr = S.filter(s => s.kind === 'drowned'), frac = dr.length / S.length;
check(Math.abs(frac - CONFIG.DROWNED.chance) < 0.05, 'en la playa, ronda 8: ~25% ahogados', `(${(frac * 100).toFixed(1)}% de ${S.length})`);
check(dr.every(atSea), 'los ahogados salen de la orilla');
check(!S.filter(s => s.kind !== 'drowned').some(atSea), 'los normales nunca salen del mar');
check(dr.every(s => Math.abs(s.hp - CONFIG.ZOMBIE.health(8) * 1.5) < 1e-6 && s.gait === 'jog' && s.skin === CONFIG.DROWNED.skinColor),
  'ahogado: vida ×1.5, trota (F5.9), piel verdosa', `(${dr[0] && dr[0].hp})`);
check(S.filter(s => s.kind === 'normal').every(s => s.skin === CONFIG.ZOMBIE.skinColor), 'el zombie normal recupera su piel (pool reusado)');
check(spawnMany(8, 0, 10, 200).every(s => s.kind === 'normal'), 'en la sala: ningún ahogado');
check(spawnMany(5, 0, -12, 200).every(s => s.kind === 'normal'), 'ronda 5: todavía no hay ahogados');
S = spawnMany(8, 0, -30, 400);                                   // en el muelle también
check(S.some(s => s.kind === 'drowned'), 'en el muelle también salen', `(${S.filter(s => s.kind === 'drowned').length})`);

// gotas: un ahogado caminando gotea; reset limpia
fresh(8); player.pos.set(0, P.height, -12); G.setCam(Math.PI); G.updateFlowField(true);
let dz = null;
for (let i = 0; i < 400 && !dz; i++) { const z = G.spawnZombie(); if (z && z.kind === 'drowned') dz = z; else clearZ(); }
step(200);                                                        // (F5.13: sale del piso en 2 s)
check(dz && DRIPS.points.visible && DRIPS.life.some(l => l > 0), 'gotea');
let under = false;
for (let i = 0; i < 300; i++) { step(1); for (let k = 0; k < DRIPS.n; k++) if (DRIPS.life[k] > 0 && DRIPS.pos[k * 3 + 1] < DRIPS.floor[k]) under = true; }
check(!under, 'ninguna gota debajo del piso');
dz.health = 77; G.respawnZombie(dz);
check(dz.kind === 'drowned' && dz.health === 77 && dz.flashMats[0].color.getHex() === CONFIG.DROWNED.skinColor, 'respawn: sigue siendo ahogado, misma vida');
G.resetGame();
check(!DRIPS.points.visible && DRIPS.life.every(l => l === 0), 'resetGame: sin gotas');

// 2) arrastrado
fresh(5); player.pos.set(0, P.height, 4.5); G.setCam(0); G.updateFlowField(true);
let z = G.spawnZombie(); z.state = 'walk';
check(z.hitParts.filter(m => m.userData.part === 'leg').length === 2, 'las 2 piernas marcadas como pierna');
const hp0 = z.maxHealth, lim = CONFIG.CRAWLER.legFrac * hp0;
G.damageZombie(z, 300, false);                                      // torso: no cuenta
G.damageZombie(z, lim - 1, false, undefined, undefined, 'leg');
check(!z.crawl, 'torso + piernas por debajo del 40%: sigue de pie', `(${Math.round(lim - 1)} de ${Math.round(lim)})`);
G.damageZombie(z, 2, false, undefined, undefined, 'leg');
check(z.crawl && z.alive && z.speed <= CONFIG.CRAWLER.speed + 1e-9, 'llega al 40% en las piernas: se arrastra', `(vel ${z.speed.toFixed(2)})`);
check(z.legR.scale.x < 0.01 && !z.legR.visible, 'sin la pierna derecha (escala ~0: no recibe balas)');
z.px = 0; z.pz = 12; z.state = 'walk';
const d0 = Math.hypot(z.px - player.pos.x, z.pz - player.pos.z);
step(180);
const d1 = Math.hypot(z.px - player.pos.x, z.pz - player.pos.z);
check(d1 < d0 - 1.5 && (d0 - d1) / 3 <= CONFIG.CRAWLER.speed * 1.25 + 0.05, 'avanza, lento', `(${((d0 - d1) / 3).toFixed(2)} m/s)`);
check(z.body.rotation.x > 1.2, 'pose de arrastrado (acostado)');
state.health = 100; state.lastDamageTime = -99;
z.px = 0; z.pz = 5.3; z.attackCd = 0;
step(30, false);
check(state.health < 100, 'se arrastra y pega igual', `(vida ${state.health})`);
z.health = 55; G.respawnZombie(z);
check(z.crawl && z.health === 55 && z.speed <= CONFIG.CRAWLER.speed + 1e-9 && z.legR.scale.x < 0.01, 'respawn: sigue arrastrándose');
G.damageZombie(z, 1e6, false);
step(40);
check(!z.active && state.zombies.indexOf(z) < 0, 'muere y vuelve al pool');
z = G.spawnZombie();
check(z && !z.crawl && z.legR.scale.x === 1 && z.legR.visible, 'el pool vuelve con las dos piernas');
clearZ();
// un golpe letal en la pierna no lo hace arrastrarse (muere igual)
z = G.spawnZombie(); z.state = 'walk';
G.damageZombie(z, 1e6, false, undefined, undefined, 'leg');
check(!z.alive && !z.crawl, 'golpe letal en la pierna: muere, no se arrastra');
clearZ();

// 3) ronda de perros
CONFIG.DOGS.enabled = true;
const firsts = new Set();
for (let i = 0; i < 300; i++) { G.resetGame(); firsts.add(roundState.nextDog); }
check([...firsts].sort().join() === '5,6,7', 'la primera ronda de perros cae en la 5, 6 o 7', `(${[...firsts].sort()})`);
check(G.DPOOL.length === 8 && G.DPOOL.filter(d => d.breed === 'negro').length === 4, '8 perros infernales (F5.7): 4 negros y 4 sarnosos');
check(G.DPOOL.every(d => d.hitParts.length === 6 && d.hitParts[0].userData.type === 'zombieHead'), 'cabeza, cuerpo y 4 patas reciben balas');

G.resetGame(); state.running = true; G.debugOpenAllDoors();
player.pos.set(0, P.height, 10); G.setCam(0);
roundState.nextDog = 5;
G.queueRound(5, 8);
check(G.UI.banner.textContent === CONFIG.DOGS.banner && NIGHT.target === 1, 'antes de la ronda: "' + CONFIG.DOGS.banner + '" y se hace de noche');
const hemiDay = WORLD.hemi.intensity, skyDay = WORLD.sky.material.color.getHex();
const kids0 = G.scene.children.length;
let t = 0, maxAlive = 0, allDogs = true, vmax = 0, flashSeen = false, ammoBefore = false, ammoAtLast = false, ammoEarly = false;
while (roundState.phase !== 'active' && t < 20) { G.tick(dt); G.updateRounds(dt); G.updateNight(dt); t += dt; }
check(roundState.dogs && state.round === 5 && roundState.total === CONFIG.DOGS.count(5), 'ronda 5 de perros', `(${roundState.total} perros)`);
check(NIGHT.k === 1 && Math.abs(WORLD.hemi.intensity - CONFIG.DOGS.night.hemi) < 1e-9 && WORLD.sky.material.color.getHex() !== skyDay, 'de noche al arrancar',
  `(hemi ${hemiDay.toFixed(2)} -> ${WORLD.hemi.intensity.toFixed(2)})`);
check(roundState.nextDog >= 10 && roundState.nextDog <= 12, 'la próxima ronda de perros en 5-7 rondas', `(${roundState.nextDog})`);
t = 0;
while (roundState.phase === 'active' && t < 240) {
  G.tick(dt); t += dt;
  const prev = state.zombies.map(q => [q, q.px, q.pz, q.state]);
  G.updateRounds(dt); G.updateFlowField(false); G.updateZombies(dt); G.updateNight(dt);
  state.health = 100; state.lastDamageTime = -99;
  if (NIGHT.flash > 0) flashSeen = true;
  maxAlive = Math.max(maxAlive, G.aliveCount());
  for (const [q, x, zz, st] of prev) if (st === 'walk' && q.state === 'walk') vmax = Math.max(vmax, Math.hypot(q.px - x, q.pz - zz) / dt);
  for (const q of state.zombies) {
    if (!q.dog) allDogs = false;
    if (q.alive && q.state === 'walk' && q.t > 1) {             // los deja correr 1 s y los mata
      const last = roundState.spawned >= roundState.total && G.aliveCount() === 1;
      ammoBefore = G.PICKUPS.pool.some(p => p.active && p.type === 'maxammo');
      G.damageZombie(q, 1e6, false);
      const now = G.PICKUPS.pool.some(p => p.active && p.type === 'maxammo');
      if (last) ammoAtLast = now && !ammoBefore; else if (now) ammoEarly = true;
    }
  }
}
check(allDogs, 'en la ronda de perros solo hay perros');
check(maxAlive <= CONFIG.DOGS.maxAlive && maxAlive > 1, 'tope de vivos', `(${maxAlive})`);
// F5.8: excepción aprobada por Diego: los perros van a DOGS.speed (4.7), un poco más que el jugador caminando
check(vmax <= CONFIG.DOGS.speed + 1e-6 && vmax > P.speed, 'perros a ' + CONFIG.DOGS.speed + ' m/s (excepción a la regla, F5.8)', `(máx ${vmax.toFixed(2)} m/s)`);
check(flashSeen, 'relámpago al aparecer');
check(ammoAtLast && !ammoEarly, 'el último perro suelta Max Ammo (y ninguno antes)');
check(G.scene.children.length === kids0, 'la escena no crece (pools)', `(${kids0})`);
const dark6 = CONFIG.WEATHER.darkBy(6);
check(roundState.phase === 'pause' && roundState.next === 6 && NIGHT.target === dark6 && G.UI.banner.textContent === 'RONDA 6', 'termina: ronda 6 y aclara (F5.9: al cielo de la R6)');
for (let i = 0; i < 60 * 3; i++) { G.tick(dt); G.updateNight(dt); }
const hemiNight = CONFIG.DOGS.night.hemi;
check(NIGHT.k === dark6 && Math.abs(WORLD.hemi.intensity - (hemiDay + (hemiNight - hemiDay) * dark6)) < 1e-9, 'vuelve exacto al cielo de la R6',
  `(k ${dark6.toFixed(3)})`);

// perro que muerde: 13 por mordida, cada 0.6 s
G.resetGame(); state.running = true; G.debugOpenAllDoors();
player.pos.set(0, P.height, 10); G.setCam(0); G.updateFlowField(true);
state.round = 5; roundState.phase = 'active';
const dog = G.spawnDog(); dog.state = 'walk'; dog.px = 0; dog.pz = 6;
state.health = 100; state.lastDamageTime = -99;
let bites = 0, h = 100;
for (let i = 0; i < 60 * 3; i++) {
  G.tick(dt); G.updateFlowField(false); G.updateZombies(dt);
  if (state.health < h) { bites++; check(h - state.health === CONFIG.DOGS.damage, 'mordida de ' + CONFIG.DOGS.damage); h = state.health = 100; state.lastDamageTime = -99; h = 100; }
}
check(bites >= 3 && bites <= 5, 'llega y muerde cada ~0.6 s', `(${bites} en 3 s)`);
check(Math.abs(dog.health - CONFIG.DOGS.health(5) * dog.size) < 1e-6 && CONFIG.DOGS.sizes.includes(dog.size) &&
  dog.root.scale.x === dog.size && Math.abs(dog.rad - CONFIG.DOGS.radius * dog.size) < 1e-9,
  'vida del perro ' + CONFIG.DOGS.health(5) + ' × tamaño (F5.8), y radio y modelo del mismo tamaño', `(×${dog.size})`);
const sz = new Set(); for (let i = 0; i < 60; i++) { const q = G.spawnDog(); if (q) { sz.add(q.size); q.active = q.alive = false; q.root.visible = false; state.zombies.splice(state.zombies.indexOf(q), 1); } }
check(sz.size === CONFIG.DOGS.sizes.length, 'salen los ' + CONFIG.DOGS.sizes.length + ' tamaños', `(${[...sz].join(', ')})`);
G.damageZombie(dog, 50, false, undefined, undefined, 'leg');
check(!dog.crawl, 'los perros no se arrastran');
G.damageZombie(dog, 1e6, true);
check(!dog.alive && !dog.head.visible, 'headshot al perro');

// debug K: ronda de perros ya
G.resetGame(); state.running = true; state.round = 2;
G.debugKey('KeyK', false);
check(state.round === 3 && roundState.dogs && G.UI.banner.textContent === CONFIG.DOGS.banner, 'K: la siguiente ronda es de perros, con el cartel');
G.resetGame();
check(!roundState.dogs && NIGHT.target === 0 && NIGHT.k === 0 && Math.abs(WORLD.hemi.intensity - hemiDay) < 1e-9, 'resetGame: de día, sin perros');
check(G.DPOOL.every(d => !d.active && !d.root.visible), 'resetGame: perros guardados');

// apagado (como en el resto de los tests): nunca hay ronda de perros
CONFIG.DOGS.enabled = false;
G.resetGame(); roundState.nextDog = 5; G.startRound(5);
check(!roundState.dogs, 'DOGS.enabled = false: sin perros');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
