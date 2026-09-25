// Game feel NO debe tocar balance ni lógica. Verifica eso + que los tiempos de CONFIG.FEEL se cumplan.
const G = require('./harness.js');
const THREE = require('three');
const { state, player, keys, feel, CONFIG, camera } = G;
const P = CONFIG.PLAYER, F = CONFIG.FEEL;
const dt = 1 / 60; let fail = 0;
const check = (c, msg, extra = '') => { console.log((c ? '  ok   ' : '  FALLA') + ' ' + msg + ' ' + extra); if (!c) fail++; };
const step = (n = 1) => { for (let i = 0; i < n; i++) { G.tick(dt); G.updatePlayer(dt); } };
state.running = true;
player.pos.set(0, P.height, 0); player.yaw = 0; player.pitch = 0;

// 1) velocidad tope intacta, con aceleración (puertas abiertas: recta porche -> sala)
G.debugOpenAllDoors();
player.pos.set(0, P.height, -3); player.yaw = Math.PI;      // yaw π mira hacia +z
keys.KeyW = true; step(6);
check(player.speedNow < P.speed * 0.95, 'arranca acelerando, no instantáneo', `(${player.speedNow.toFixed(2)} a los 100ms)`);
step(60);
check(Math.abs(player.speedNow - P.speed) < 1e-6, 'tope caminando = PLAYER.speed', `(${player.speedNow.toFixed(3)})`);
player.pos.set(0, P.height, -3); player.vel.set(0, 0, 0);
keys.ShiftLeft = true; step(60);
check(Math.abs(player.speedNow - P.sprint) < 1e-6, 'tope corriendo = PLAYER.sprint', `(${player.speedNow.toFixed(3)})`);
keys.KeyW = false; keys.ShiftLeft = false; step(3);
check(player.speedNow > 0, 'frena progresivo, no en seco');
step(30);
check(player.speedNow === 0, 'se detiene del todo');

// 2) colisión: corre 3s contra el barandal sur del porche (z=-4). En x=3: en x=0 está la reja D11 (V2 F1),
// que el test abrió arriba con debugOpenAllDoors
player.pos.set(3, P.height, 0); player.vel.set(0, 0, 0); player.yaw = Math.PI;   // mirando a -z... yaw=π mira +z
player.yaw = 0; keys.KeyW = true; keys.ShiftLeft = true;   // yaw 0 mira -z
let minZ = 9; for (let i = 0; i < 180; i++) { step(); minZ = Math.min(minZ, player.pos.z); }
keys.KeyW = false; keys.ShiftLeft = false;
check(minZ >= -4 + 0.2 + P.radius - 1e-3, 'no atraviesa pared con aceleración', `(z mín ${minZ.toFixed(3)})`);
check(Math.abs(player.vel.z) < 1e-6, 'pared anula la velocidad contra ella', `(vz ${player.vel.z.toFixed(4)})`);

// 3) la mira ignora shake / bob / tirón / aterrizaje
player.pos.set(0, P.height, 0); player.vel.set(0, 0, 0); step(40);
player.pitch = 0.1; player.yaw = 0.7;
G.feelOnHurt(player.pos.x + 1, player.pos.z);   // golpe desde la derecha
feel.trauma = 1; feel.land.x = -0.1; feel.bobAmt = 1; feel.bobT = 1.3;
G.updateCameraFeel(dt);
const expect = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1 + feel.recoilP.x, 0.7 + feel.recoilY.x, 0, 'YXZ'));
check(feel.aimQuat.angleTo(expect) < 1e-9, 'aimQuat = mouse + retroceso exacto');
check(camera.quaternion.angleTo(feel.aimQuat) > 0.005, 'la cámara visual sí se mueve', `(${camera.quaternion.angleTo(feel.aimQuat).toFixed(4)} rad)`);
check(feel.eye.distanceTo(player.pos) === 0, 'origen de bala = ojo, sin bob/shake');
check(feel.hurtY.v < 0, 'tirón hacia el atacante (derecha = yaw negativo)');

// 4) retroceso: pico y vuelta en recoilReturn
G.resetGame ? 0 : 0;
['recoilP','recoilY','hurtP','hurtY','hurtR','land'].forEach(k => { feel[k].x = 0; feel[k].v = 0; }); feel.trauma = 0;
const def = CONFIG.WEAPONS.m1911;
G.feelOnFire(def);
let peak = 0, tPeak = 0;
for (let i = 1; i <= 30; i++) { G.tick(dt); G.updateCameraFeel(dt); if (feel.recoilP.x > peak) { peak = feel.recoilP.x; tPeak = i * dt; } if (i * dt >= F.recoilReturn - 1e-9 && i * dt < F.recoilReturn + dt) var atRet = feel.recoilP.x; }
check(Math.abs(peak - F.recoilPitch * def.recoil) / (F.recoilPitch * def.recoil) < 0.1, 'pico de patada ≈ recoilPitch', `(${peak.toFixed(4)} a ${(tPeak*1000).toFixed(0)}ms)`);
check(atRet / peak < 0.06, 'vuelve en recoilReturn', `(${(atRet / peak * 100).toFixed(1)}% del pico a ${F.recoilReturn * 1000}ms)`);
check(feel.recoilP.x >= -peak * 0.02, 'sin rebote hacia abajo (crítico)');
// ráfaga a cadencia de subfusil (90ms ≈ 5 frames)
feel.recoilP.x = feel.recoilP.v = 0; let burst = 0;
for (let i = 0; i < 6; i++) { G.feelOnFire(def); for (let k = 0; k < 5; k++) { G.tick(dt); G.updateCameraFeel(dt); burst = Math.max(burst, feel.recoilP.x); } }
check(burst > peak * 1.2, 'acumula en ráfaga de 90ms', `(${(burst / peak).toFixed(2)}x el pico simple)`);
// a cadencia de M1911 (300ms) NO acumula: vuelve antes del siguiente
feel.recoilP.x = feel.recoilP.v = 0; let semi = 0;
for (let i = 0; i < 4; i++) { G.feelOnFire(def); for (let k = 0; k < 18; k++) { G.tick(dt); G.updateCameraFeel(dt); semi = Math.max(semi, feel.recoilP.x); } }
check(semi < peak * 1.05, 'a 300ms no acumula', `(${(semi / peak).toFixed(2)}x)`);

// 5) aterrizaje: se hunde y rebota
feel.land.x = feel.land.v = 0;
player.pos.set(0, P.height, 0); player.vel.set(0, 0, 0); player.grounded = true;
keys.Space = true; step(1); keys.Space = false;
let minL = 0, maxAfter = 0, landed = false;
for (let i = 0; i < 90; i++) { step(); if (feel.land.x < minL) { minL = feel.land.x; landed = true; } if (landed && feel.land.x > maxAfter) maxAfter = feel.land.x; }
check(minL < -0.05, 'se hunde al aterrizar', `(${minL.toFixed(3)} m)`);
check(maxAfter > 0.005, 'rebota', `(+${maxAfter.toFixed(3)} m)`);
check(Math.abs(feel.land.x) < 0.005, 'se asienta');

// 6) zombie: empujón solo visual, flash blanco, número de daño
G.debugOpenAllDoors(); player.pos.set(0, P.height, 10); G.setCam(Math.PI);
G.updateFlowField(true);
state.round = 1;
const z = G.spawnZombie(); z.state = 'walk';
const px = z.px, pz = z.pz;
const dir = new THREE.Vector3(1, 0, 0);
G.damageZombie(z, 40, false);
G.feelOnZombieHit(z, { point: new THREE.Vector3(z.px, 1.2, z.pz) }, dir, 40, false);
G.placeRoot(z, 0);
check(z.px === px && z.pz === pz, 'posición lógica intacta tras impacto');
check(Math.abs(z.root.position.x - px - F.knockback) < 1e-9, 'mesh empujado knockback', `(${(z.root.position.x - px).toFixed(3)})`);
check(z.flashMats[0].emissive.getHex() === F.flashColor, 'flash blanco');
for (let i = 0; i < Math.ceil(F.knockbackTime / dt) + 1; i++) { G.tick(dt); G.updateZombies(dt); }
check(Math.abs(z.root.position.x - z.px) < 1e-9, `vuelve en ${F.knockbackTime * 1000}ms`);
check(z.flashMats[0].emissive.getHex() === 0, 'flash apagado');
const hp = z.health;
check(hp === CONFIG.ZOMBIE.health(1) - 40, 'daño = spec', `(${hp})`);

// 7) escopeta: 8 perdigones al mismo zombie = 1 número
G.dmgNums.pool.forEach(n => n.life = 0);
for (let i = 0; i < 8; i++) G.spawnDamageNumber(z, new THREE.Vector3(z.px, 1.2, z.pz), 25, false);
const live = G.dmgNums.pool.filter(n => n.life > 0);
check(live.length === 1 && live[0].val === 200, 'perdigones fusionados en un número', `(${live.length} números, ${live[0] && live[0].val})`);

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
