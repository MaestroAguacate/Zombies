//=== 4b. GRANADAS (V2 F2.7) ===============================================
// G apretada = saca el pin y cocina (la mecha corre en la mano). Soltar G = tirar con la mecha que queda.
// Si la mecha llega a 0 en la mano, explota ahí. Stock en state.grenades: +2 por ronda (startRound),
// tope 4, Max Ammo no las recarga.
// Física propia: gravedad, rebote contra colliders en 3D (usan minY/maxY) con subpasos, piso con groundY
// (la pileta) y techo de los cuartos cerrados. Atraviesa zombies e ignora los límites invisibles, como una
// bala; el borde de la pileta sí la frena desde adentro, como al jugador.
// Explosión: daño con caída lineal en GRENADE.radius, con línea libre (no atraviesa paredes; los muebles más
// bajos que la explosión o que el centro del cuerpo del objetivo no tapan). Al jugador le
// hace selfDamage ignorando el i-frame, y puede matarlo. Las kills pasan por damageZombie -> onZombieDeath:
// cuentan para las cajas de almas solas.
// Todo se crea una vez (buildGrenades): pool de granadas, modelo en la mano y UNA luz con intensity 0.
const GREN = { pool: [], i: 0, cooking: false, cookT: 0, throwT: 0, light: null, lightT: 0, hand: null };
const GREN_AXES = ['x', 'z', 'y'];

function buildGrenades() {
  const G = CONFIG.GRENADE, s = G.size;
  const geo = new THREE.BoxGeometry(s * 2, s * 2.6, s * 2);
  const mat = new THREE.MeshLambertMaterial({ color: 0x4f5a36 });
  const capGeo = new THREE.BoxGeometry(s * 1.1, s * 0.7, s * 1.1), capMat = new THREE.MeshLambertMaterial({ color: 0x8a8a80 });
  for (let i = 0; i < G.poolSize; i++) {
    const m = new THREE.Mesh(geo, mat);
    const cap = new THREE.Mesh(capGeo, capMat); cap.position.y = s * 1.6; m.add(cap);   // espoleta
    m.visible = false;
    scene.add(m);
    GREN.pool.push({ mesh: m, active: false, p: new THREE.Vector3(), v: new THREE.Vector3(), fuse: 0, bounceT: 0 });
  }
  // luz de la explosión: creada UNA vez (agregar luces en runtime recompila shaders)
  GREN.light = new THREE.PointLight(G.lightColor, 0, 12, 2);
  scene.add(GREN.light);
  // granada en la mano mientras se cocina (capa del arma, no la corta una pared)
  const hand = new THREE.Group();
  hand.add(box(0.07, 0.09, 0.07, 0x4f5a36, 0, 0, 0));
  hand.add(box(0.04, 0.03, 0.04, 0x8a8a80, 0, 0.06, 0));
  hand.add(box(0.05, 0.08, 0.05, 0xb88a6a, 0, -0.07, 0.02));        // mano
  hand.position.set(-0.2, -0.2, -0.42); hand.visible = false;
  weaponScene.add(hand);
  GREN.hand = hand;
}

// G apretada: saca el pin. true = empezó a cocinar
function startCook() {
  const W = weaponsState;
  if (!state.running || state.gameOver || GREN.cooking || GREN.throwT > 0 || DOWN.on) return false;
  if (state.grenades <= 0) { sfxDry(); return false; }
  if (W.phase === 'switching' || W.phase === 'melee' || W.phase === 'shield') return false;
  if (W.phase === 'reloading') UI.reload.style.opacity = '0';   // se corta (la munición pasa recién al completarse)
  W.phase = 'grenade'; W.phaseT = 0;
  state.grenades--;
  GREN.cooking = true; GREN.cookT = 0;
  sfxPin();
  updateGrenadeHUD();
  return true;
}
// G suelta: la tira con la mecha que le queda. Devuelve la granada en vuelo (o null)
function releaseGrenade() {
  if (!GREN.cooking) return null;
  const G = CONFIG.GRENADE;
  GREN.cooking = false; GREN.throwT = G.throwTime;
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(feel.aimQuat);
  // sale a 0.25 m del ojo: menos que el radio del jugador (0.35), así nunca nace dentro de una pared
  const e = feel.eye;
  sfxSwing();
  return spawnGrenade(e.x + dir.x * 0.25, e.y + dir.y * 0.25 - 0.1, e.z + dir.z * 0.25,
    dir.x * G.throwSpeed, dir.y * G.throwSpeed + G.throwUp, dir.z * G.throwSpeed, G.fuse - GREN.cookT);
}
function spawnGrenade(x, y, z, vx, vy, vz, fuse) {
  const g = GREN.pool.find(q => !q.active);
  if (!g) return null;                     // pool lleno (no pasa con tope 4): se pierde
  g.active = true; g.fuse = fuse; g.bounceT = 0;
  g.p.set(x, y, z); g.v.set(vx, vy, vz);
  g.mesh.position.copy(g.p); g.mesh.visible = true;
  return g;
}

// un frame de física: gravedad, colliders por eje, piso, techo, fricción. true = rebotó fuerte
function stepGrenade(g, dt) {
  const G = CONFIG.GRENADE, n = G.substeps, h = dt / n, r = G.size, p = g.p, v = g.v, H = CONFIG.WALL_H;
  const bounce = g.bounce !== undefined ? g.bounce : G.bounce;     // F5.12: el langostino rebota menos
  const friction = g.friction !== undefined ? g.friction : G.friction;
  let bounced = false, onFloor = false;
  for (let s = 0; s < n; s++) {
    const y0 = p.y;                                               // F2.8: para el techo interior (ver abajo)
    v.y -= G.gravity * h;
    for (const axis of GREN_AXES) {
      const d = v[axis] * h;
      if (!d) continue;
      p[axis] += d;
      const cols = collidersNear(p.x - r, p.x + r, p.z - r, p.z + r);
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        if (!c.solid || !(c.mesh || c.tag === 'poolRim')) continue;   // límites invisibles: pasa, como una bala
        if (p.x + r <= c.minX || p.x - r >= c.maxX || p.z + r <= c.minZ || p.z - r >= c.maxZ ||
            p.y + r <= c.minY || p.y - r >= c.maxY) continue;
        if (axis === 'x')      p.x = d > 0 ? c.minX - r - 1e-3 : c.maxX + r + 1e-3;
        else if (axis === 'z') p.z = d > 0 ? c.minZ - r - 1e-3 : c.maxZ + r + 1e-3;
        else                   p.y = d > 0 ? c.minY - r - 1e-3 : c.maxY + r + 1e-3;
        if (Math.abs(v[axis]) > 1.5) bounced = true;
        v[axis] = -v[axis] * bounce;
        if (axis === 'y' && d < 0) onFloor = true;                // apoyada arriba de un mueble
        break;
      }
    }
    const floor = groundY(p.x, p.z);
    if (p.y - r < floor) {
      p.y = floor + r;
      if (v.y < -1.5) { v.y = -v.y * bounce; bounced = true; } else v.y = 0;
      onFloor = true;
    }
    const room = roomAt(p.x, p.z);
    // techo de un cuarto cerrado: solo si venía de ADENTRO (F2.8: la que cae sobre el techo de la caseta
    // desde arriba no se mete adentro; ahí la frena el collider del techo)
    if (room && !room.outdoor && y0 < H && p.y + r > H) { p.y = H - r; if (v.y > 0) v.y = -v.y * bounce; }
    if (onFloor) { const k = Math.max(0, 1 - friction * h); v.x *= k; v.z *= k; }
  }
  if (onFloor && v.y === 0 && Math.hypot(v.x, v.z) < G.restSpeed) { v.x = 0; v.z = 0; }
  return bounced;
}

// explosión en (x, y, z). Devuelve { hits, kills, self } (self = daño al jugador)
const _gp = new THREE.Vector3();
// F5.11: opts (bazooka, langostino): { damage (centro), radius, self (daño propio), src (estadísticas), skipBoss }
function explodeAt(x, y, z, opts) {
  const G = CONFIG.GRENADE, o = opts || {}, R = o.radius || G.radius;
  const center = o.damage !== undefined ? o.damage : G.dmgBase + G.dmgPerRound * Math.max(1, state.round);
  const selfDmg = o.self !== undefined ? o.self : G.selfDamage;
  const prevSrc = STATS.src, gl = levelAt(x, z, y - 0.2);       // F2.8: ¿explota arriba del techo de la caseta?
  STATS.src = o.src || 'grenade';                                 // damageZombie lo lee al matar
  let hits = 0, kills = 0;
  for (const q of state.zombies.slice()) {
    if (!q.alive || (q.level || 0) !== gl || (o.skipBoss && q.boss)) continue;   // el techo separa: arriba no daña abajo ni al revés
    const cy = (q.level === 1 ? UP.y : groundY(q.px, q.pz)) + 1.0;  // centro del cuerpo
    const d = Math.hypot(q.px - x, cy - y, q.pz - z);
    // línea libre, sin contar lo más bajo que la explosión o que el centro del cuerpo (mesas, sofás)
    if (d > R || !segmentClear(x, z, q.px, q.pz, 0, true, gl ? undefined : Math.max(y, cy), gl)) continue;
    const dmg = center * (1 - (1 - G.edgeMul) * d / R);
    damageZombie(q, dmg, false);
    spawnDamageNumber(q, _gp.set(q.px, cy + 0.6, q.pz), dmg, false);
    hits++;
    if (!q.alive) kills++;
  }
  STATS.src = prevSrc;
  // jugador: daño propio ignorando el i-frame (puede matar) y shake por distancia
  const pc = player.pos.y - CONFIG.PLAYER.height / 2;
  const dp = Math.hypot(player.pos.x - x, pc - y, player.pos.z - z);
  let self = 0;
  if (selfDmg > 0 && dp <= R && playerLevel() === gl && segmentClear(x, z, player.pos.x, player.pos.z, 0, true, gl ? undefined : Math.max(y, pc), gl)) {
    self = selfDmg;
    damagePlayer(selfDmg, x, z, true);
  }
  addTrauma(G.shakeMax * Math.max(0, 1 - dp / G.shakeDist));
  spawnSplashFx(x, y + 0.3, z, o.color || 0xffa040, R * 0.6);
  GREN.light.position.set(x, y + 0.6, z); GREN.lightT = G.lightTime;
  sfxExplosion(dp);
  if (hits) onHitConfirm(false, kills > 0);
  return { hits, kills, self };
}

//--- F5.11: LANGOSTINO BAILARÍN (el mono de Black Ops) ---
// Sale de la caja con MONKEY.give cargas (no ocupa slot); se tira con la tecla 4 (física de la granada). Cuando
// se queda quieto baila `dance` s con música: el flow field sale de él (monkeyLure) y todos los zombies van ahí,
// menos el boss, que sigue al jugador (FLOW.pdist). Después explota (daño de granada × dmgMul, sin daño propio).
// El Max Ammo lo recarga si ya lo tenías. Pool fijo de modelos
const MONKEY = { count: 0, has: false, pool: [] };
function buildMonkeyModel(s) {
  const g = new THREE.Group(), c = 0xe86a4a, d = 0xb84a32, p = 0xf0a080;
  const body = new THREE.Group(); g.add(body);
  for (let i = 0; i < 4; i++) body.add(box(0.2 - i * 0.02, 0.12, 0.18, i % 2 ? c : p, 0, 0.1 + i * 0.11, 0));
  body.add(box(0.18, 0.16, 0.2, c, 0, 0.56, 0.02));                                   // cabeza
  body.add(box(0.03, 0.03, 0.02, 0x101010, -0.05, 0.6, 0.12)); body.add(box(0.03, 0.03, 0.02, 0x101010, 0.05, 0.6, 0.12));
  body.add(box(0.012, 0.3, 0.012, d, -0.04, 0.78, 0.06)); body.add(box(0.012, 0.3, 0.012, d, 0.04, 0.78, 0.06));   // antenas
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-0.13, 0.42, 0); armR.position.set(0.13, 0.42, 0);
  armL.add(box(0.05, 0.2, 0.05, c, 0, 0.1, 0)); armL.add(box(0.11, 0.08, 0.08, d, 0, 0.22, 0));   // pinzas
  armR.add(box(0.05, 0.2, 0.05, c, 0, 0.1, 0)); armR.add(box(0.11, 0.08, 0.08, d, 0, 0.22, 0));
  body.add(armL); body.add(armR);
  body.add(box(0.2, 0.04, 0.12, d, 0, 0.02, -0.1));                                   // cola
  g.scale.setScalar(s || 1);
  g.userData.body = body; g.userData.armL = armL; g.userData.armR = armR;
  return g;
}
function buildMonkeys() {
  for (let i = 0; i < CONFIG.MONKEY.pool; i++) {
    const g = buildMonkeyModel(1);
    // F5.12: brilla: un halo aditivo que late (MeshBasic, sin luces)
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({
      map: radialTex('rgba(255,200,120,.95)', 'rgba(255,110,60,.35)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.y = 0.4; g.add(halo); g.userData.halo = halo;
    g.visible = false; scene.add(g);
    MONKEY.pool.push({ g, state: 'off', t: 0, beat: 0, p: new THREE.Vector3(), v: new THREE.Vector3(),
                       bounce: CONFIG.MONKEY.bounce, friction: CONFIG.MONKEY.friction });
  }
}
function giveMonkeys() {
  MONKEY.has = true; MONKEY.count = CONFIG.MONKEY.max;
  updateGrenadeHUD(); sfxPartPickup();
}
// tecla 4: lo tira como una granada (sin cocinar). true = salió
function throwMonkey() {
  const M = CONFIG.MONKEY, W = weaponsState;
  if (!state.running || state.gameOver || MONKEY.count <= 0 || GREN.cooking || DOWN.on) return false;
  if (W.phase === 'switching' || W.phase === 'melee' || W.phase === 'grenade') return false;
  const m = MONKEY.pool.find(q => q.state === 'off');
  if (!m) return false;
  MONKEY.count--;
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(feel.aimQuat), e = feel.eye, G = CONFIG.GRENADE;
  m.p.set(e.x + dir.x * 0.25, e.y + dir.y * 0.25 - 0.1, e.z + dir.z * 0.25);
  m.v.set(dir.x * G.throwSpeed, dir.y * G.throwSpeed + G.throwUp, dir.z * G.throwSpeed);
  m.state = 'fly'; m.t = M.flyMax; m.g.visible = true;
  m.g.position.copy(m.p);
  sfxSwing(); updateGrenadeHUD();
  return true;
}
// el que está bailando (el más nuevo): el flow field sale de acá. null = ninguno
function monkeyLure() {
  let best = null;
  for (const m of MONKEY.pool) if (m.state === 'dance' && (!best || m.t > best.t)) best = m;
  return best ? { x: best.p.x, z: best.p.z } : null;
}
function updateMonkeys(dt) {
  const M = CONFIG.MONKEY;
  for (const m of MONKEY.pool) {
    if (m.state === 'fly') {
      stepGrenade(m, dt);
      // F5.12: apoyado en el piso casi no se desliza (frena en seco en unos cuadros)
      if (m.p.y <= groundY(m.p.x, m.p.z) + CONFIG.GRENADE.size + 0.02) { m.v.x *= CONFIG.MONKEY.landDamp; m.v.z *= CONFIG.MONKEY.landDamp; }
      m.t -= dt;
      m.g.position.copy(m.p); m.g.position.y -= CONFIG.GRENADE.size;
      m.g.rotation.x += dt * 8;
      if ((m.v.x === 0 && m.v.z === 0 && m.v.y === 0) || m.t <= 0) {         // quieto: a bailar
        m.state = 'dance'; m.t = M.dance; m.beat = 0; m.g.rotation.set(0, 0, 0);
        updateFlowField(true);
      }
    } else if (m.state === 'dance') {
      m.t -= dt; m.beat -= dt;
      const k = (M.dance - m.t) * 7, U = m.g.userData;
      U.body.rotation.set(0, Math.sin(k * 0.5) * 0.6, Math.sin(k) * 0.25);
      U.body.position.y = Math.abs(Math.sin(k)) * 0.08;
      U.armL.rotation.z = 0.6 + Math.sin(k) * 0.9; U.armR.rotation.z = -0.6 - Math.sin(k) * 0.9;
      U.halo.quaternion.copy(camera.quaternion);                    // F5.12: el halo mira a la cámara y late
      U.halo.material.opacity = 0.6 + 0.4 * Math.abs(Math.sin(k * 0.5));
      U.halo.scale.setScalar(1 + 0.25 * Math.abs(Math.sin(k * 0.5)));
      if (m.beat <= 0) { m.beat = M.beat; sfxMonkeyBeat(Math.hypot(player.pos.x - m.p.x, player.pos.z - m.p.z)); }
      if (m.t <= 0) {
        m.state = 'off'; m.g.visible = false;
        const G = CONFIG.GRENADE, dmg = (G.dmgBase + G.dmgPerRound * Math.max(1, state.round)) * M.dmgMul;
        explodeAt(m.p.x, m.p.y, m.p.z, { damage: dmg, radius: M.radius, self: 0, src: 'monkey', color: 0xff7a4a });
        updateFlowField(true);
      }
    }
  }
}
function resetMonkeys() {
  MONKEY.count = 0; MONKEY.has = false;
  for (const m of MONKEY.pool) { m.state = 'off'; m.g.visible = false; }
}

function updateGrenades(dt) {
  const G = CONFIG.GRENADE, W = weaponsState;
  if (GREN.cooking) {
    GREN.cookT += dt;
    if (GREN.cookT >= G.fuse) {                                   // la cocinó de más: explota en la mano
      GREN.cooking = false; GREN.throwT = 0;
      if (W.phase === 'grenade') { W.phase = 'idle'; W.phaseT = 0; }
      explodeAt(player.pos.x, player.pos.y - 0.6, player.pos.z);
    } else if (!keys['KeyG']) releaseGrenade();
  }
  if (GREN.throwT > 0) {
    GREN.throwT -= dt;
    if (GREN.throwT <= 0 && W.phase === 'grenade') { W.phase = 'idle'; W.phaseT = 0; }
  }
  for (const g of GREN.pool) {
    if (!g.active) continue;
    g.fuse -= dt; g.bounceT -= dt;
    if (stepGrenade(g, dt) && g.bounceT <= 0) {
      sfxGrenadeBounce(Math.hypot(g.p.x - player.pos.x, g.p.z - player.pos.z));
      g.bounceT = 0.1;
    }
    g.mesh.position.copy(g.p);
    const sp = Math.hypot(g.v.x, g.v.z);
    g.mesh.rotation.x += sp * dt * 4; g.mesh.rotation.z += sp * dt * 2;
    if (g.fuse <= 0) {
      g.active = false; g.mesh.visible = false;
      explodeAt(g.p.x, g.p.y, g.p.z);
    }
  }
  if (GREN.lightT > 0) {
    GREN.lightT = Math.max(0, GREN.lightT - dt);
    GREN.light.intensity = G.lightIntensity * (GREN.lightT / G.lightTime);
  }
  GREN.hand.visible = GREN.cooking;
  UI.cook.style.opacity = GREN.cooking ? '1' : '0';
  if (GREN.cooking) UI.cookBar.style.width = (100 * (1 - GREN.cookT / G.fuse)).toFixed(1) + '%';
}

// +perRound al empezar cada ronda, sin pasar del tope
function addRoundGrenades() {
  const G = CONFIG.GRENADE;
  state.grenades = Math.min(G.max, state.grenades + G.perRound);
  updateGrenadeHUD();
}
function resetGrenades() {
  state.grenades = 0;
  GREN.cooking = false; GREN.cookT = 0; GREN.throwT = 0; GREN.lightT = 0;
  for (const g of GREN.pool) { g.active = false; g.mesh.visible = false; }
  if (GREN.light) GREN.light.intensity = 0;
  if (GREN.hand) GREN.hand.visible = false;
  UI.cook.style.opacity = '0';
  updateGrenadeHUD();
}
