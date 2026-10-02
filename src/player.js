//=== 3. PLAYER ===========================================================
const player = {
  pos: new THREE.Vector3(0, CONFIG.PLAYER.height, 0),
  vel: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  grounded: true,
  speedNow: 0,
  crouch: false, crouchK: 0,        // F5.18: agachado (C) y cuánto bajó la vista (0..1)
  downK: 0                          // F5.18: tirado en el piso (Quick Revive), 0..1
};
const keys = Object.create(null);
// F2: stamina del sprint. v = 0..1; exhausted = se vació y todavía no llegó a STAMINA.minToSprint
const stamina = { v: 1, exhausted: false, idleT: 0 };

function initPlayer() {
  const S = CONFIG.START;                        // F5.20: spawn en el garaje (antes, R1 porche)
  player.pos.set(S.x, CONFIG.PLAYER.height, S.z);
  player.yaw = S.yaw; player.pitch = 0;
  player.grounded = true; player.airTop = 0;
  player.pushT = 0; player.pushX = player.pushZ = 0; player.dazeT = 0;   // F5
  player.crouch = false; player.crouchK = 0;                            // F5.18
  state.health = CONFIG.PLAYER.maxHealth;
  stamina.v = 1; stamina.exhausted = false; stamina.idleT = 0;
}

function updatePlayer(dt) {
  if (dt <= 0) return;
  const P = CONFIG.PLAYER, F = CONFIG.FEEL;
  if (DEBUG.noclip) { updateNoclip(dt); updateCameraFeel(dt); return; }   // modo debug: vuelo sin colisiones
  if (BUNK.travel) { player.vel.set(0, 0, 0); updateCameraFeel(dt); return; }   // F5.19c: bajando al búnker / en el portal

  // input local
  let fx = 0, fz = 0;
  if (keys['KeyW']) fz -= 1;
  if (keys['KeyS']) fz += 1;
  if (keys['KeyA']) fx -= 1;
  if (keys['KeyD']) fx += 1;
  // F5.23: la lengua de la planta te arrastra (no caminás). F5.28: el tentáculo de la Bestia, igual
  const byBeast = beastGrabbed(), grabbed = plantGrabbed() || byBeast;
  // F5.24: la jaula de raíces te tiene quieto. F5.29b: subido a un cañón de arpones (el Kraken), también
  // F5.29f: armando (escudo, Ola, la carga del Kraken) tampoco
  const rooted = plantRooted() || (typeof eeMounted === 'function' && eeMounted()) || (typeof buildBusy === 'function' && buildBusy());
  if (grabbed || rooted) fx = fz = 0;
  const len = Math.hypot(fx, fz);
  if (len > 0) { fx /= len; fz /= len; }

  // F2: el sprint gasta stamina (sprintTime s llena, Stamin-Up la alarga); si se vacía, no se vuelve a
  // correr hasta minToSprint. Recarga tras delay s sin correr, en rechargeTime s
  const ST = CONFIG.STAMINA, CR = P.crouch;
  player.crouch = !!keys['KeyC'] && !DOWN.on;                                        // F5.18: agacharse (mantener C)
  player.crouchK += ((player.crouch ? 1 : 0) - player.crouchK) * Math.min(1, dt * CR.rate);
  const sprinting = !player.crouch && !DOWN.on && keys['ShiftLeft'] && fz < 0 && weaponsState.phase !== 'reloading' && !stamina.exhausted && stamina.v > 0 && !ADS.on;
  player.sprinting = sprinting;                 // F3b: el ADS no entra corriendo
  if (sprinting) {
    stamina.idleT = 0;
    if (!gumActive('ironlungs')) stamina.v = Math.max(0, stamina.v - dt / (ST.sprintTime * staminaMul()));   // F5.18b: IRON LUNGS
    if (stamina.v === 0) { stamina.exhausted = true; sfxBreath(); }
  } else {
    stamina.idleT += dt;
    if (stamina.idleT > ST.delay) stamina.v = Math.min(1, stamina.v + dt / ST.rechargeTime);
    if (stamina.exhausted && stamina.v >= ST.minToSprint) stamina.exhausted = false;
  }
  const adsMove = (1 - CONFIG.ADS.moveMul) * (curAtt('stock') ? CONFIG.PROGRESSION.attachments.stock.adsMove : 1);   // F5.18: culata
  const spd = (sprinting ? P.sprint * sprintMul() : P.speed) * (1 - adsMove * ADS.k)   // F3b: apuntando ×0.7
            * (player.dazeT > 0 ? CONFIG.BOSS.dazeMul : 1)    // F5: silbido del Sombrerón
            * (playerLevel() === 0 ? wetSandMul(player.pos.x, player.pos.z) : 1)    // F5.8: arena mojada
            * (player.crouch ? CR.speedMul : 1)                                     // F5.18: agachado
            * (DOWN.on ? CONFIG.PERKS.lastStand.speedMul : 1)                      // F5.18: arrastrándose
            * (gumActive('heavyboots') ? 0.75 : 1);                                // F5.20: HEAVY BOOTS

  // input local rotado por +yaw
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const wx =  fx * cy + fz * sy;
  const wz = -fx * sy + fz * cy;

  // aceleración / frenado hacia la velocidad objetivo (el tope no cambia)
  const v = player.vel, tx = wx * spd, tz = wz * spd;
  const dx = tx - v.x, dz = tz - v.z, dl = Math.hypot(dx, dz);
  const rate = !player.grounded ? F.airAccel : (len > 0 ? F.accel : F.decel);
  const step = rate * dt;
  if (dl <= step) { v.x = tx; v.z = tz; } else { v.x += dx / dl * step; v.z += dz / dl * step; }

  // gravedad / salto
  v.y -= P.gravity * dt;
  if (keys['Space'] && player.grounded && !player.crouch && !DOWN.on && !grabbed && !rooted) { v.y = P.jump; player.grounded = false; }

  // movimiento + colisión. Si una pared frena, se pierde esa componente (no queda "cargada")
  const x0 = player.pos.x, z0 = player.pos.z;
  moveAxis('x', v.x * dt);
  moveAxis('z', v.z * dt);
  if (Math.abs(player.pos.x - x0) < Math.abs(v.x * dt) * 0.5) v.x = (player.pos.x - x0) / dt;
  if (Math.abs(player.pos.z - z0) < Math.abs(v.z * dt) * 0.5) v.z = (player.pos.z - z0) / dt;
  pushPlayerFromZombies();
  if (player.pushT > 0) {                       // F5: empujón del barrido del boss (con colisión)
    const k = Math.min(dt, player.pushT) / CONFIG.BOSS.pushTime;
    player.pushT -= dt;
    moveAxis('x', player.pushX * CONFIG.BOSS.pushTime * k);
    moveAxis('z', player.pushZ * CONFIG.BOSS.pushTime * k);
  }
  if (grabbed) { if (byBeast) beastDragStep(dt); else plantDragStep(dt); }   // F5.23: con colisión, hacia la boca
  else unstickPlayer();                         // F5.24: nunca quedar metido adentro de un sólido
  if (player.dazeT > 0) player.dazeT = Math.max(0, player.dazeT - dt);
  player.speedNow = Math.hypot(v.x, v.z);

  const vyBefore = v.y, feetBefore = player.pos.y - P.height;
  if (grabbed) {                                // F5.23: la lengua te levanta hacia la boca (sin gravedad ni piso)
    player.pos.y = byBeast ? beastLiftY() : plantLiftY(); v.y = 0; player.grounded = false; player.airTop = player.pos.y - P.height;
  } else {
  player.pos.y += v.y * dt;
  // piso: el terreno (0 salvo la piscina) o el tope del mueble en el que estás parado (F2.8). Con los pies de
  // ANTES de moverse: si caés rápido sobre una mesa, un frame la atravesaría
  const floor = floorAt(player.pos.x, player.pos.z, feetBefore) + P.height;
  // en la rampa, bajando: pegarse a la pendiente (si no, cae un poco cada frame y el aterrizaje rebota la cámara)
  const stick = player.grounded && vyBefore <= 0 && player.pos.y - floor < 0.35;
  if (player.pos.y <= floor || stick) {
    if (!player.grounded) { onLand(-vyBefore); fallDamage((player.airTop || 0) - (floor - P.height)); }
    player.pos.y = floor; v.y = 0; player.grounded = true;
    player.airTop = floor - P.height;
  } else {
    // F2.8: en el aire (salto o caminando por un borde). Antes, al caer de un borde seguía "en el piso":
    // no aterrizaba ni contaba la altura de la caída
    player.grounded = false;
    player.airTop = Math.max(player.airTop || 0, feetBefore);
  }
  }

  // regeneración
  const t = clock.elapsedTime;
  const maxHp = maxHealth();                    // F2: 250 con Juggernog
  if (state.health > maxHp) state.health = maxHp;
  if (state.health < maxHp && t - state.lastDamageTime > P.regenDelay) {
    state.health = Math.min(maxHp, state.health + P.regenRate * dt);
  }
  UI.stam.style.opacity = stamina.v < 1 ? '1' : '0';
  UI.stamBar.style.width = (stamina.v * 100).toFixed(1) + '%';
  UI.stam.classList.toggle('empty', stamina.exhausted);

  updateCameraFeel(dt);
}

//--- GAME FEEL de cámara ---
// Dos cosas distintas:
//   aim    = mouse + retroceso. Lo usa fireWeapon (feel.aimQuat / feel.eye).
//   cámara = aim + bob + shake + tirón por daño + aterrizaje. Solo visual.
const feel = {
  recoilP: { x: 0, v: 0 }, recoilY: { x: 0, v: 0 },
  hurtP: { x: 0, v: 0 }, hurtY: { x: 0, v: 0 }, hurtR: { x: 0, v: 0 },
  land: { x: 0, v: 0 },
  trauma: 0, bobT: 0, bobAmt: 0, run: 0,
  swayX: 0, swayY: 0, swayTX: 0, swayTY: 0,
  aimQuat: new THREE.Quaternion(), eye: new THREE.Vector3()
};
const _feelEuler = new THREE.Euler(0, 0, 0, 'YXZ');

// resorte x'' = -w²x - 2ζw x', solución EXACTA (forma cerrada): estable y precisa a cualquier dt.
// ζ=1 crítico (vuelve sin rebotar), ζ<1 sub-amortiguado (rebota)
function springStep(s, w, zeta, dt) {
  const x0 = s.x, v0 = s.v;
  if (zeta >= 1) {
    const e = Math.exp(-w * dt), c = v0 + w * x0;
    s.x = (x0 + c * dt) * e;
    s.v = (v0 - w * c * dt) * e;
  } else {
    const wd = w * Math.sqrt(1 - zeta * zeta), e = Math.exp(-zeta * w * dt);
    const co = Math.cos(wd * dt), si = Math.sin(wd * dt);
    s.x = e * (x0 * co + (v0 + zeta * w * x0) / wd * si);
    s.v = e * (v0 * co - (zeta * w * v0 + w * w * x0) / wd * si);
  }
}
// impulso: con ζ=1 el pico es ≈ peak a los 1/w segundos
function springKick(s, peak, w) { s.v += peak * w * Math.E; }
// ω crítico para quedar en ~5% del pico a los t segundos
function springW(t) { return 6 / t; }
function addTrauma(a) { feel.trauma = Math.min(1, feel.trauma + a); }
function shakeNoise(t, seed) {
  return Math.sin(t + seed) * 0.55 + Math.sin(t * 2.17 + seed * 1.9) * 0.3 + Math.sin(t * 4.31 + seed * 3.1) * 0.15;
}

// F5.18: cuánto bajan los ojos (agachado; tirado en el piso con Quick Revive)
function eyeDrop() { return CONFIG.PLAYER.crouch.drop * player.crouchK + CONFIG.PERKS.lastStand.drop * player.downK; }
function updateCameraFeel(dt) {
  const F = CONFIG.FEEL, P = CONFIG.PLAYER;
  const wR = springW(recoilReturnOf(curDef())), wH = springW(F.hurtReturn);
  springStep(feel.recoilP, wR, 1, dt); springStep(feel.recoilY, wR, 1, dt);
  springStep(feel.hurtP, wH, 1, dt);   springStep(feel.hurtY, wH, 1, dt); springStep(feel.hurtR, wH, 1, dt);
  springStep(feel.land, F.landFreq, F.landDamping, dt);

  // head bob: fase avanza por distancia recorrida, amplitud por velocidad real
  const v = player.speedNow;
  feel.bobT += dt * v * F.bobFreq;
  const bobTarget = player.grounded && v > 0.3 ? Math.min(1, v / P.speed) : 0;
  const runTarget = Math.min(1, Math.max(0, (v - P.speed) / (P.sprint - P.speed)));
  feel.bobAmt += (bobTarget - feel.bobAmt) * Math.min(1, dt * 10);
  feel.run += (runTarget - feel.run) * Math.min(1, dt * 8);
  const ay = (F.bobWalkY + (F.bobRunY - F.bobWalkY) * feel.run) * feel.bobAmt;
  const ax = (F.bobWalkX + (F.bobRunX - F.bobWalkX) * feel.run) * feel.bobAmt;
  const bobY = Math.sin(feel.bobT * 2) * ay;          // 2 pasos por ciclo lateral
  const bobX = Math.sin(feel.bobT) * ax;
  const bobRoll = Math.sin(feel.bobT) * F.bobRoll * feel.bobAmt;

  // shake por trauma
  feel.trauma = Math.max(0, feel.trauma - F.shakeDecay * dt);
  const sh = feel.trauma * feel.trauma, tn = clock.elapsedTime * F.shakeFreq;
  const n1 = shakeNoise(tn, 1.3), n2 = shakeNoise(tn, 7.1), n3 = shakeNoise(tn, 3.7), n4 = shakeNoise(tn, 9.9);

  // AIM (lo que usa la bala)
  const lim = Math.PI / 2 - 0.02;
  const aimPitch = Math.max(-lim, Math.min(lim, player.pitch + feel.recoilP.x));
  const aimYaw = player.yaw + feel.recoilY.x;
  _feelEuler.set(aimPitch, aimYaw, 0, 'YXZ');
  feel.aimQuat.setFromEuler(_feelEuler);
  feel.eye.copy(player.pos); feel.eye.y -= eyeDrop();                  // F5.18: agachado / tirado

  // CÁMARA (visual)
  const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);   // derecha local
  const side = bobX + sh * F.shakeMaxPos * n4;
  camera.position.set(
    player.pos.x + rx * side,
    player.pos.y - eyeDrop() + bobY + feel.land.x + sh * F.shakeMaxPos * n1 * 0.5,
    player.pos.z + rz * side
  );
  camera.rotation.set(
    aimPitch + feel.hurtP.x + sh * F.shakeMaxPitch * n1,
    aimYaw + feel.hurtY.x + sh * F.shakeMaxYaw * n2,
    bobRoll + feel.hurtR.x + sh * F.shakeMaxRoll * n3,
    'YXZ'
  );
}

function onLand(fallSpeed) {
  const F = CONFIG.FEEL;
  springKick(feel.land, -Math.min(F.landDipMax, fallSpeed * F.landDipPerSpeed), F.landFreq);
}

function feelOnHurt(fromX, fromZ) {
  const F = CONFIG.FEEL, w = springW(F.hurtReturn);
  addTrauma(F.hurtShake);
  springKick(feel.hurtP, -F.hurtFlinch, w);
  if (fromX === undefined) return;
  // ángulo relativo del atacante respecto a donde mirás (+ = a tu izquierda)
  const attYaw = Math.atan2(-(fromX - player.pos.x), -(fromZ - player.pos.z));
  let rel = attYaw - player.yaw;
  rel = Math.atan2(Math.sin(rel), Math.cos(rel));
  springKick(feel.hurtY, Math.sin(rel) * F.hurtTug, w);     // tirón hacia el golpe
  springKick(feel.hurtR, -Math.sin(rel) * F.hurtRoll, w);
}

function resetFeel() {
  ['recoilP', 'recoilY', 'hurtP', 'hurtY', 'hurtR', 'land'].forEach(k => { feel[k].x = 0; feel[k].v = 0; });
  feel.trauma = 0; feel.bobAmt = 0; feel.run = 0;
  feel.swayX = feel.swayY = feel.swayTX = feel.swayTY = 0;
}

// V2 F2.8: ¿se puede parar arriba de este collider? Muebles, cajas, máquinas: sí. Paredes, barandales,
// puertas/rejas, límites invisibles y el borde de la piscina: no
function standable(c) {
  const t = c.tag;
  return !!c.mesh && t !== 'wall' && t !== 'rail' && t !== 'poolRim' && !t.startsWith('door:') && !t.startsWith('bound:') &&
         t !== 'roofrail' && t !== 'hedge' && t !== 'plant' && t !== 'pwall' && t !== 'shell' &&   // F5.6: barandas del techo, cerco, macetas · F5.16 · F5.17: borde del caparazón
         t !== 'prop:labpod';   // F5.24 (bug de Diego): la cápsula del laboratorio, debajo del hueco: arriba los zombies no llegaban
}
// hay lugar para el cuerpo parado arriba de c en (x, z)
function headroom(c, x, z) {
  const r = CONFIG.PLAYER.radius, y0 = c.maxY, y1 = c.maxY + CONFIG.PLAYER.height;
  for (const o of WORLD.colliders) {
    if (o === c || !o.solid || o.zombieOnly || o.maxY <= y0 + 0.01 || o.minY >= y1) continue;
    if (x + r <= o.minX || x - r >= o.maxX || z + r <= o.minZ || z - r >= o.maxZ) continue;
    return false;
  }
  return true;
}
// piso bajo el jugador: el terreno (groundY, la piscina) o el tope más alto de un mueble debajo de los pies
function floorAt(x, z, feet) {
  const r = CONFIG.PLAYER.radius;
  let f = groundY(x, z);
  // F2.8: las escaleras del techo son rampas (F5.6: dos, UP.flights). Solo si está a mano: nunca teletransporta
  // (la altura se mide en el borde delantero: al tocar el techo ya está a su altura, sin escalón)
  for (const S of UP.flights) {
    if (!inFlight(S, x, z, r)) continue;
    const h = flightH(S, x, r, z);
    if (h <= feet + CONFIG.PLAYER.stepUp) f = Math.max(f, h);
  }
  for (const c of WORLD.colliders) {
    if (!c.solid || c.maxY <= f || c.maxY > feet + 0.05 || !standable(c)) continue;
    if (x + r <= c.minX || x - r >= c.maxX || z + r <= c.minZ || z - r >= c.maxZ) continue;
    f = c.maxY;
  }
  return f;
}

function moveAxis(axis, delta) {
  if (delta === 0) return;
  const P = CONFIG.PLAYER, r = P.radius;
  const before = player.pos[axis];
  player.pos[axis] += delta;
  const x = player.pos.x, z = player.pos.z;
  let feet = player.pos.y - P.height, head = player.pos.y;

  for (let i = 0; i < WORLD.colliders.length; i++) {
    const c = WORLD.colliders[i];
    if (!c.solid || c.zombieOnly) continue;                         // F2.8: los bordes abiertos del techo solo frenan zombies
    if (head < c.minY || feet >= c.maxY - 1e-3) continue;          // parado arriba: no choca
    if (x + r <= c.minX || x - r >= c.maxX || z + r <= c.minZ || z - r >= c.maxZ) continue;
    // F2.8: el borde de la piscina solo frena SALIENDO. Entrando despacio (rampa, apuntando, saltando) los
    // pies quedaban bajo el borde con el cuerpo encima: te devolvía a la orilla, el piso te subía, y loop
    // Además es una tira fina: solo frena a lo ancho. Resolverlo a lo largo te teletransportaba a la punta
    if (c.tag === 'poolRim') {
      const thinX = c.maxX - c.minX < c.maxZ - c.minZ;
      if ((axis === 'x') !== thinX) continue;
      const mid = axis === 'x' ? (POOL.x1 + POOL.x2) / 2 : (POOL.z1 + POOL.z2) / 2;
      if (Math.sign(delta) === Math.sign(mid - before)) continue;
    }
    // F2.8: trepar. Si el tope está a mano (caminando stepUp, en el aire climbReach) y hay lugar arriba, subir
    if (standable(c) && c.maxY - feet <= (player.grounded ? P.stepUp : P.climbReach) + 1e-3 && headroom(c, x, z)) {   // +1 mm: 4.3 - 4.0 da 0.30000000000000027
      player.pos.y = c.maxY + P.height; feet = c.maxY; head = player.pos.y;
      continue;
    }
    // F5.24 (bug de la escalera del muelle): si ya estaba metido de antes (la penetración es más que este paso), empujar en
    // el eje que se movió lo mandaba a la PUNTA de una tira fina (6 m escalera abajo). Se lo saca de costado, por el otro eje
    const pen = axis === 'x' ? (delta > 0 ? x + r - c.minX : c.maxX - (x - r)) : (delta > 0 ? z + r - c.minZ : c.maxZ - (z - r));
    if (pen > Math.abs(delta) + 0.05) {
      if (axis === 'z') { const a = x + r - c.minX, b = c.maxX - (x - r); player.pos.x = a < b ? c.minX - r - 0.001 : c.maxX + r + 0.001; }
      else              { const a = z + r - c.minZ, b = c.maxZ - (z - r); player.pos.z = a < b ? c.minZ - r - 0.001 : c.maxZ + r + 0.001; }
      continue;
    }
    // colisión: empujar en el eje que se movió (ver también el costado de la escalera, abajo)
    if (axis === 'x') player.pos.x = delta > 0 ? c.minX - r - 0.001 : c.maxX + r + 0.001;
    else              player.pos.z = delta > 0 ? c.minZ - r - 0.001 : c.maxZ + r + 0.001;
  }
  // F2.8: la escalera del techo no tiene pasamanos: su costado frena como si fuera maciza. Si el cuerpo entra
  // a la huella donde la rampa está más alta que un escalón sobre tus pies, este eje no avanza
  // F5.8 (bug del playtest): solo frena lo que te mete MÁS en la rampa o más arriba. Antes frenaba todo: pegado
  // al costado (bajando por el borde o cayendo al lado) quedabas trabado sin poder ni alejarte
  const px = player.pos.x, pz = player.pos.z, bx = axis === 'x' ? before : px, bz = axis === 'z' ? before : pz;
  const rampTouch = (x0, z0, S) => {               // [altura más alta que toca el cuerpo, penetración de costado] o null
    const V = flightV(S), x = S.axis === 'z' ? z0 : x0, z = S.axis === 'z' ? x0 : z0;   // F5.13: rampas en z
    if (!(z + r > V.z1 && z - r < V.z2 && x + r > V.x1 && x - r < V.x2)) return null;
    const k = V.dir < 0 ? (V.x2 - Math.max(V.x1, x - r)) : (Math.min(V.x2, x + r) - V.x1);
    const y0 = S.y0 || 0, y1 = S.toLevel === 2 ? UP2.y : UP.y;      // F5.22: del nivel 1 al 2
    // F5.24: también la más baja que toca el cuerpo (el borde de atrás), para pasar por debajo de las escaleras abiertas
    const k2 = V.dir < 0 ? (V.x2 - Math.min(V.x2, x + r)) : (Math.max(V.x1, x - r) - V.x1), L = V.x2 - V.x1;
    return [y0 + (y1 - y0) * Math.min(1, Math.max(0, k / L)), Math.min(z + r - V.z1, V.z2 - (z - r)),
            y0 + (y1 - y0) * Math.min(1, Math.max(0, k2 / L))];
  };
  for (const S of UP.flights) {
    const now = rampTouch(px, pz, S);
    if (!now || !(now[0] - feet > P.stepUp + 1e-3 && now[0] > feet)) continue;
    // F5.24 (Diego: "no puedo pasar debajo de las escaleras del caparazón"): en las escaleras abiertas (sin nada debajo), si
    // toda la parte de la rampa que queda sobre el cuerpo está más alta que la cabeza, se pasa por abajo
    if (S.open && now[2] > head + 0.05) continue;
    const was = rampTouch(bx, bz, S);
    if (!was || now[0] > was[0] + 1e-6 || now[1] > was[1] + 1e-6) { player.pos[axis] = before; break; }
  }
  if (!isFinite(player.pos[axis])) player.pos[axis] = before;
}

// los cuerpos de zombie bloquean al jugador (respeta paredes vía moveAxis)
// F5.24 (soak.js lo encontró una vez: el jugador quedó adentro de una cabeza colosal del templo): si por algo que mueve al
// jugador sin colisión (la jaula de raíces, la lengua, un teletransporte) el CENTRO queda adentro de un sólido a la altura
// del cuerpo, se lo saca por el lado más corto. Solo corrige lo metido de verdad: el roce normal lo resuelve moveAxis
function unstickPlayer() {
  const P = player.pos, r = CONFIG.PLAYER.radius, feet = P.y - CONFIG.PLAYER.height;
  for (const c of collidersNear(P.x - r, P.x + r, P.z - r, P.z + r)) {
    if (!c.solid || c.zombieOnly || c.overhead || c.tag === 'poolRim') continue;
    if (c.maxY < feet + 0.4 || c.minY > feet + 1.2) continue;             // no está a la altura del cuerpo
    if (!(P.x > c.minX && P.x < c.maxX && P.z > c.minZ && P.z < c.maxZ)) continue;
    const out = [[c.minX - r - 0.02 - P.x, 'x'], [c.maxX + r + 0.02 - P.x, 'x'], [c.minZ - r - 0.02 - P.z, 'z'], [c.maxZ + r + 0.02 - P.z, 'z']]
      .sort((a, b) => Math.abs(a[0]) - Math.abs(b[0]))[0];
    if (out[1] === 'x') P.x += out[0]; else P.z += out[0];
    return true;
  }
  return false;
}
function pushPlayerFromZombies() {
  const pl = playerLevel();
  for (const z of state.zombies) {
    if (!z.alive || z.state === 'emerge' || (z.level || 0) !== pl) continue;   // F2.8: otro nivel no empuja
    const minD = CONFIG.PLAYER.radius + (z.boss ? CONFIG.BOSS.bodyRadius : (z.rad || CONFIG.ZOMBIE.radius));   // F5: el boss es ancho; F5.8: perros por tamaño
    const dx = player.pos.x - z.px, dz = player.pos.z - z.pz;
    const d = Math.hypot(dx, dz);
    if (d >= minD || d < 1e-4) continue;
    const push = minD - d;
    moveAxis('x', dx / d * push);
    moveAxis('z', dz / d * push);
  }
}

// mouse -> yaw/pitch. SETTINGS.sens (slider de ajustes) multiplica INPUT.mouseSens
function lookInput(mx, my) {
  // F3b: con zoom, la sensibilidad baja en proporción al FOV (apuntar no se siente más rápido)
  const s = CONFIG.INPUT.mouseSens * SETTINGS.sens * (camera ? camera.fov / CONFIG.ADS.baseFov : 1)
          * (player.dazeT > 0 ? CONFIG.BOSS.dazeMul : 1), F = CONFIG.FEEL;   // F5: silbido
  player.yaw -= mx * s;
  player.pitch -= my * s;
  const lim = Math.PI / 2 - 0.02;
  player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
  // sway: el arma se retrasa respecto al giro (escala con el giro real, no con los píxeles)
  const k = SETTINGS.sens;
  feel.swayTX = Math.max(-F.swayMax, Math.min(F.swayMax, feel.swayTX + mx * k * F.swayAmount));
  feel.swayTY = Math.max(-F.swayMax, Math.min(F.swayMax, feel.swayTY + my * k * F.swayAmount));
}

// fromX/fromZ opcionales: posición del atacante, para el tirón de cámara
// F2.8/F5.7: caída de PLAYER.fallHeight m o más -> daño proporcional hasta PLAYER.fallMaxDmg. No mata
function fallDamage(drop) {
  const P = CONFIG.PLAYER;
  if (DEBUG.safeFall) { DEBUG.safeFall = false; return; }       // la caída al apagar el noclip no lastima
  if (drop < P.fallHeight || state.gameOver) return;
  // F5.7: proporcional a la altura (fallHeight -> fallMaxDrop = 0 -> fallMaxDmg), nunca mata
  const k = Math.min(1, (drop - P.fallHeight) / (P.fallMaxDrop - P.fallHeight));
  const dmg = Math.min(P.fallMaxDmg * k, state.health - 1);
  if (dmg <= 0) return;
  STATS.damageTaken += dmg;
  state.health -= dmg;
  state.lastDamageTime = clock.elapsedTime;              // la regeneración espera como con un golpe
  hurtHit();                                             // F5.28e: la caída también pinta una esquina (abajo)
  flashDamage(); sfxHurt(false); addTrauma(0.5);                   // F5.19: la caída, sin golpe de zombie
}
// ignoreIframe (F2.7): la granada propia pega aunque un zombie te haya golpeado recién
// F5.19: src = 'zombie' solo para el golpe de un zombie humano (suena el golpe de zombie); el resto, sin ese sonido
function damagePlayer(dmg, fromX, fromZ, ignoreIframe, src) {
  if (state.gameOver || DOWN.on || BUNK.travel) return;           // F5.18: tirado sos invulnerable (F5.19c: y viajando)
  const t = clock.elapsedTime;
  if (!ignoreIframe && t - state.lastDamageTime < CONFIG.PLAYER.hitIframe) return;   // i-frame
  if (gumActive('hardskin')) dmg *= 0.5;                          // F5.18b: HARD SKIN
  if (gumActive('undying')) return;                               // F5.20: UNDYING (nada te lastima)
  if (gumActive('bonearmor')) { gumArmorHit(t); return; }         // F5.28d: BONE ARMOR se come el golpe entero
  if (gumActive('glasscannon')) dmg *= 2;                         // F5.20: GLASS CANNON (el contra)
  dmg = armorAbsorb(dmg);                                         // F5.26: la armadura de caparazón se come una parte
  if (dmg >= state.health && gumActive('secondwind')) {          // F5.20: SECOND WIND: el golpe que te tiraba te deja lleno
    delete GUMM.fx.secondwind; state.health = maxHealth(); state.lastDamageTime = t + 1; showBanner('SECOND WIND', 1.6);
    if (typeof gumEnded === 'function') gumEnded(); updateGumHUD(); return;
  }
  STATS.damageTaken += Math.min(dmg, state.health);
  state.health = Math.max(0, state.health - dmg);
  if (dmg > 0) hurtHit(fromX, fromZ);                               // F5.28e: una esquina de sangre más
  if (fromX !== undefined) { DEATH.hitX = fromX; DEATH.hitZ = fromZ; }   // F5.28e: la muerte busca al que te pegó
  state.lastDamageTime = t;
  DEV.lastHit = dmg; DEV.lastHitT = t; DEV.lastSrc = src || '';   // F5.19c: la barra de vida del modo dev lo muestra
  flashDamage();
  sfxHurt(src === 'zombie');
  feelOnHurt(fromX, fromZ);
  if (state.health <= 0 && !tryRevive()) gameOver();   // F2: Quick Revive
}

