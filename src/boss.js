//=== 5c. BOSS: EL SOMBRERÓN (V2 F5) Y EL CALAMARÓN (V2 F5.9) =================
// Leyenda guatemalteca: gigante de traje de charro negro con botonadura de plata, sombrero enorme y guitarra
// a la espalda. Es un objeto con la MISMA forma que un zombie y vive en state.zombies: usa el flow field, las
// escaleras, damageZombie y onZombieDeath. Su radio de choque es el de un zombie (entra por puertas de 2 m);
// solo el modelo es grande. Se construyen una vez.
// F5.9: hay un POOL de bosses (BOSS.pool: CONFIG.BOSS.pool.sombrero + .calamar) para que salgan varios a la vez
// (R28: 2 Sombrerones y 1 Calamarón; 5ta ronda de mobs: 4 Sombrerones). Cada uno tiene su sombrero volando
// (z.hatFly), su minigun (z.gunModel/z.barrels) y sus ojos (z.eyeMat, amarillos <20%, rojos con lágrimas <10%).
// BOSS.z / BOSS.hat / BOSS.gunModel / BOSS.barrels = el primer Sombrerón (nombres de F5, los usan los tests).
// Velocidad (F5.5b): según la vida que le falta, de speedMin a speedMax (= el jugador caminando) al 25%.
// Fases del Sombrerón: 1 golpea el piso y tira guitarras · 2 (sin sombrero) además silba y llama zombies ·
// 3 (<25%) embiste · 4 (<10%) minigun de cocos (sin guitarras ni embestida).
// El Calamarón (z.variant 'calamar'): cabeza de calamar, sin sombrero, arranca en fase 4 (minigun, golpe al
// piso, silbido, llama zombies) y con poca vida tira calamares que explotan en charcos verdes grandes.
// Acciones (z.act): 'slam' golpe al piso · 'whistle' silbido · 'windup' carga la embestida · 'charge' · 'stun' ·
// 'throw' guitarra. Mientras hay una acción, bossTick toma el control del frame (sin flow field ni watchdog).
// La minigun NO es una acción (z.gun: idle -> spin -> fire -> cool): camina mientras dispara, más lento.
// Guitarras, cocos y calamares: pools fijos (BOSS.guitars, BOSS.cocos, BOSS.squids), proyectiles propios.
const BOSS = { z: null, hat: null, fogT: 0, fogBase: null, blur: 0, guitars: [], cocos: [], squids: [], gunModel: null, barrels: null,
               ring: null, ringT: 0, pool: [] };
const BOSS_SUIT = 0x17161c, BOSS_SILVER = 0xcfd0d8, BOSS_SKIN = 0x4a3326, BOSS_WOOD = 0x6b3d1e;
const BOSS_EYE = { normal: 0xff8a20, yellow: 0xfff23a, red: 0xff1a10 };

function bossSpeed(z) {
  if (z.variant === 'bestia') return CONFIG.BEAST.speed;           // F5.26: excepción aprobada por Diego (5.0)
  const B = CONFIG.BOSS, f = z.maxHealth > 0 ? z.health / z.maxHealth : 1;
  const k = Math.max(0, Math.min(1, (1 - f) / (1 - B.fastFrac)));
  const v = B.speedMin + (B.speedMax - B.speedMin) * k;
  return Math.min(z.gun === 'spin' || z.gun === 'fire' ? v * B.gunWalkMul : v, CONFIG.PLAYER.speed);
}
function bossAlive() { return BOSS.pool.some(z => z.active && z.alive); }
function bossName(z) { return z.variant === 'bestia' ? CONFIG.BEAST.name : z.variant === 'calamar' ? CONFIG.BOSS.calamar.name : CONFIG.BOSS.name; }

//--- modelo ---
function bossDetail(mb, parent) {
  const m = dogDetail(mb, parent, new THREE.MeshLambertMaterial({ vertexColors: true }));
  return m;
}
function buildBoss() {
  const B = CONFIG.BOSS;
  let id = 200;
  for (let i = 0; i < B.pool.sombrero; i++) BOSS.pool.push(createBoss(id++, 'sombrero'));
  for (let i = 0; i < B.pool.calamar; i++) BOSS.pool.push(createBoss(id++, 'calamar'));
  const z0 = BOSS.pool[0];
  BOSS.z = z0; BOSS.hat = z0.hatFly; BOSS.gunModel = z0.gunModel; BOSS.barrels = z0.barrels;
  // guitarras voladoras, cocos de la minigun y calamares que explotan: pools fijos, compartidos
  for (let i = 0; i < B.guitarPool; i++) {
    const g = new THREE.Group(), mg = new MeshBuilder();
    mg.box(0, 0, 0, 0.5, 0.66, 0.13, BOSS_WOOD);
    mg.box(0, 0.08, 0.07, 0.15, 0.15, 0.01, 0x1a0e06);
    mg.box(0, 0.7, 0, 0.09, 0.8, 0.06, 0x3b2410);
    mg.box(0, 1.15, 0, 0.14, 0.18, 0.07, 0x2a180a);
    for (let s = -1; s <= 1; s += 2) mg.box(s * 0.02, 0.5, 0.08, 0.008, 1.2, 0.008, 0xe8c050);   // cuerdas
    bossDetail(mg, g);
    g.visible = false; scene.add(g);
    BOSS.guitars.push({ g, active: false, p: new THREE.Vector3(), v: new THREE.Vector3(), ox: 0, oz: 0 });
  }
  // onda del golpe al piso: un anillo que se abre hasta slamRadius (creado una vez)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: 0xc8b48a,
    transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
  BOSS.ring = ring;
  const cGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2), cMat = new THREE.MeshLambertMaterial({ color: 0x5a3e22 });
  for (let i = 0; i < B.gunPool; i++) {
    const m = new THREE.Mesh(cGeo, cMat);
    m.visible = false; scene.add(m);
    BOSS.cocos.push({ m, active: false, p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, ox: 0, oz: 0 });
  }
  for (let i = 0; i < B.calamar.squidPool; i++) {                 // F5.9: calamar hinchado que explota
    const g = new THREE.Group(), ms = new MeshBuilder();
    ms.box(0, 0.1, 0, 0.5, 0.6, 0.5, 0x7a2a7a);
    ms.box(0, 0.35, 0.2, 0.3, 0.2, 0.12, 0x9a3a8a);
    ms.box(-0.12, 0.2, 0.26, 0.08, 0.08, 0.02, 0x7aff3a); ms.box(0.12, 0.2, 0.26, 0.08, 0.08, 0.02, 0x7aff3a);   // ojos verdes
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ms.box(Math.cos(a) * 0.18, -0.35, Math.sin(a) * 0.18, 0.08, 0.5, 0.08, 0x5a1a5a, 0.3 * Math.sin(a), 0, 0.3 * Math.cos(a)); }
    bossDetail(ms, g);
    g.visible = false; scene.add(g);
    BOSS.squids.push({ g, active: false, p: new THREE.Vector3(), v: new THREE.Vector3() });
  }
}
function createBoss(id, variant) {
  const B = CONFIG.BOSS, CQ = variant === 'calamar';
  const suit = new THREE.MeshLambertMaterial({ color: CQ ? B.calamar.suit : BOSS_SUIT });
  const skin = new THREE.MeshLambertMaterial({ color: CQ ? B.calamar.skin : BOSS_SKIN });
  const felt = new THREE.MeshLambertMaterial({ color: 0x0d0c10 });
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const legL = zPart(0.36, 1.15, 0.38, suit, -0.24, 1.15, 0, body, true);
  const legR = zPart(0.36, 1.15, 0.38, suit,  0.24, 1.15, 0, body, true);
  const torso = zPart(0.92, 0.95, 0.5, suit, 0, 1.62, 0, body);
  const head = zPart(0.55, 0.55, 0.55, skin, 0, 2.38, 0.02, body);
  const armL = zPart(0.26, 1.05, 0.26, suit, -0.6, 2.02, 0, body, true);
  const armR = zPart(0.26, 1.05, 0.26, suit,  0.6, 2.02, 0, body, true);
  // manos grandes y botas con espuelas (siguen a brazos y piernas)
  [armL, armR].forEach(a => { const h = new THREE.Mesh(zGeo(0.32, 0.3, 0.32), skin); h.position.y = -0.62; a.mesh.add(h); });
  [legL, legR].forEach(l => {
    const mb = new MeshBuilder();
    mb.box(0, -0.52, 0.06, 0.4, 0.16, 0.52, 0x0b0b0d);                     // bota
    mb.box(0, -0.5, -0.24, 0.1, 0.06, 0.1, BOSS_SILVER);                  // espuela
    mb.box(0.19, -0.1, 0, 0.02, 0.9, 0.06, BOSS_SILVER);                  // botonadura del pantalón
    mb.box(-0.19, -0.1, 0, 0.02, 0.9, 0.06, BOSS_SILVER);
    bossDetail(mb, l.mesh);
  });
  // saco: botonadura de plata, cinturón, moño; guitarra en la espalda (el Calamarón: ventosas en el pecho)
  const mt = new MeshBuilder();
  for (let i = 0; i < 4; i++) { mt.box(-0.2, 0.3 - i * 0.18, 0.26, 0.06, 0.06, 0.02, BOSS_SILVER); mt.box(0.2, 0.3 - i * 0.18, 0.26, 0.06, 0.06, 0.02, BOSS_SILVER); }
  mt.box(0, -0.42, 0.01, 0.96, 0.1, 0.54, 0x2a1a10);                      // cinturón
  mt.box(0, -0.42, 0.28, 0.16, 0.1, 0.02, BOSS_SILVER);                   // hebilla
  if (!CQ) {
    mt.box(0, 0.44, 0.26, 0.26, 0.1, 0.03, 0x7a0f14);                     // moño rojo
    mt.box(0.05, -0.05, -0.36, 0.56, 0.72, 0.14, BOSS_WOOD, 0, 0, 0.25);   // guitarra: caja
    mt.box(0.05, -0.05, -0.44, 0.16, 0.16, 0.02, 0x1a0e06, 0, 0, 0.25);    //   boca
    mt.box(-0.12, 0.62, -0.36, 0.1, 0.8, 0.06, 0x3b2410, 0, 0, 0.25);      //   mástil
    mt.box(-0.24, 1.04, -0.36, 0.14, 0.18, 0.07, 0x2a180a, 0, 0, 0.25);    //   clavijero
  } else {
    for (let i = 0; i < 6; i++) mt.box((i % 2 ? 0.12 : -0.12), 0.35 - i * 0.12, 0.27, 0.1, 0.1, 0.02, 0xc86ac8);   // ventosas
    for (let i = 0; i < 4; i++) mt.box(-0.35 + i * 0.23, -0.35, -0.3, 0.1, 0.9, 0.1, B.calamar.skin, 0.5, 0, (i - 1.5) * 0.15);   // tentáculos por la espalda
  }
  bossDetail(mt, torso.mesh);
  // cara: bigote (o tentáculos colgando), ojos que brillan (MeshBasic: sin luces) y lágrimas (debajo del 10%)
  const mh = new MeshBuilder();
  if (!CQ) {
    mh.box(0, -0.1, 0.285, 0.36, 0.07, 0.03, 0x0a0806);
    mh.box(-0.16, -0.16, 0.285, 0.06, 0.1, 0.03, 0x0a0806); mh.box(0.16, -0.16, 0.285, 0.06, 0.1, 0.03, 0x0a0806);
  } else {
    mh.box(0, 0.42, 0, 0.7, 0.55, 0.7, B.calamar.skin);                   // manto de calamar
    mh.box(0, 0.78, -0.05, 0.4, 0.3, 0.45, 0x7a3a7a);
    for (let k = 0; k < 8; k++) mh.box(-0.24 + (k % 4) * 0.16, -0.3 - (k > 3 ? 0.12 : 0), 0.3, 0.07, 0.45 + (k % 3) * 0.1, 0.07, k % 2 ? 0x5a1a5a : 0x7a2a7a);   // tentáculos en la cara
  }
  bossDetail(mh, head.mesh);
  const eyeMat = new THREE.MeshBasicMaterial({ color: BOSS_EYE.normal });
  [-0.12, 0.12].forEach(x => { const e = new THREE.Mesh(zGeo(0.1, 0.05, 0.02), eyeMat); e.position.set(x, 0.05, 0.285); head.mesh.add(e); });
  const tears = new THREE.Group();
  const tearMat = new THREE.MeshBasicMaterial({ color: 0x9fd4ff });
  [-0.12, 0.12].forEach(x => { const t = new THREE.Mesh(zGeo(0.03, 0.14, 0.02), tearMat); t.position.set(x, -0.04, 0.29); tears.add(t); });
  tears.visible = false; head.mesh.add(tears);
  // sombrero: ala enorme + copa. Recibe ×3 (part 'hat'); sale volando en la fase 2. El Calamarón no tiene
  const hat = new THREE.Group();
  hat.position.set(0, 0.32, 0);
  const brim = new THREE.Mesh(zGeo(1.7, 0.08, 1.7), felt); hat.add(brim);
  const crown = new THREE.Mesh(zGeo(0.62, 0.5, 0.62), felt); crown.position.y = 0.28; hat.add(crown);
  const mhat = new MeshBuilder();
  mhat.box(0, 0.08, 0, 0.66, 0.1, 0.66, BOSS_SILVER);                     // cinta de plata
  mhat.box(0, 0.045, 0, 1.74, 0.02, 1.74, 0x3a3a44);                      // borde del ala
  bossDetail(mhat, hat);
  if (!CQ) head.mesh.add(hat);

  const z = {
    id, root, body, variant,
    head: head.mesh, armL: armL.pivot, armR: armR.pivot, legL: legL.pivot, legR: legR.pivot,
    flashMats: [suit, skin, felt], hitParts: [],
    active: false, alive: false, state: 'idle', mode: 'flow', t: 0,
    px: 0, pz: 0, sx: 0, sz: 0, wantX: 0, wantZ: 0,
    nudgeX: 0, nudgeZ: 0, nudgeT: 0,
    heading: 0, health: 0, speed: 0, attackCd: 0, swingT: 0,
    walkT: 0, stuckT: 0, lastX: 0, lastZ: 0, strikes: 0, flash: 0,
    kbX: 0, kbZ: 0, kbT: 0, voice: B.voice, growlT: 0,
    kind: 'boss', boss: true, dog: false, crawl: false, legDmg: 0, maxHealth: 0,
    phase: 1, hatOn: !CQ, hatDmg: 0, hatG: hat, act: null, actT: 0, actT0: 0,
    whistleT: 0, summonT: 0, chargeT: 0, chargeX: 0, chargeZ: 0, chargeHit: false,
    throwT: 0, gun: 'idle', gunT: 0, gunAcc: 0, squidT: 0,        // F5.5b / F5.9
    eyeMat, tears,
    hatFly: { g: hat, vx: 0, vy: 0, vz: 0, spin: 0, life: 0, flying: false }
  };
  // F5.5b: minigun de cocos en la mano derecha (el brazo apunta a -y local; levantado, al frente). Oculta
  // hasta la fase 4. No recibe balas
  const gun = new THREE.Group();
  gun.position.set(0, -0.62, 0.05);
  const gm = new MeshBuilder();
  gm.box(0, -0.2, 0, 0.34, 0.4, 0.34, 0x3a3d44);                           // cuerpo
  gm.box(0.26, -0.15, 0, 0.26, 0.3, 0.3, 0x6a4a2a);                        // tambor de cocos
  gm.box(0.26, -0.15, 0.16, 0.2, 0.2, 0.02, 0x3a2410);
  bossDetail(gm, gun);
  const barrels = new THREE.Group();
  barrels.position.y = -0.4;
  const bm = new MeshBuilder();
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    bm.box(Math.cos(a) * 0.1, -0.45, Math.sin(a) * 0.1, 0.06, 0.9, 0.06, 0x24262b);
  }
  bm.box(0, -0.85, 0, 0.28, 0.06, 0.28, 0x3a3d44);                          // aro de la boca
  bossDetail(bm, barrels);
  gun.add(barrels);
  gun.visible = false;
  armR.mesh.add(gun);
  z.gunModel = gun; z.barrels = barrels;
  head.mesh.userData = { type: 'zombieHead', zombie: z };
  [torso, armL, armR, legL, legR].forEach(p => { p.mesh.userData = { type: 'zombieBody', zombie: z }; });
  [brim, crown].forEach(m => { m.userData = { type: 'zombieBody', zombie: z, part: 'hat' }; });
  z.partsBare = [head.mesh, torso.mesh, armL.mesh, armR.mesh, legL.mesh, legR.mesh];
  z.partsHat = CQ ? z.partsBare : [brim, crown].concat(z.partsBare);
  z.hitParts = z.partsHat;
  root.visible = false;
  scene.add(root);
  return z;
}

//--- aparición ---
// la playa si se llega (flow field); si no, el spawn abierto más lejano (por camino) fuera de vista.
// F5.9: n = cuántos bosses ya hay en juego; en la playa, cada uno sale `spread` m al costado del anterior
function bossSpawnPoint(n) {
  const S = CONFIG.BOSS.spawn, k = n || 0, off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * CONFIG.BOSS.spread;
  if (flowAt(Math.floor(S.x + off), Math.floor(S.z)) >= 0) return { x: S.x + off, z: S.z };
  if (flowAt(Math.floor(S.x), Math.floor(S.z)) >= 0) return { x: S.x, z: S.z };
  let best = null, bd = -1;
  for (const sp of SPAWN_POINTS) {
    if (!sp.valid || sp.sea) continue;
    const d = flowAt(sp.cx, sp.cz);
    if (d > bd && !isVisibleToPlayer(sp.x, sp.z)) { bd = d; best = sp; }
  }
  return best;
}
function attachHat(z) {
  const H = z.hatFly;
  H.flying = false; H.life = 0;
  if (z.variant !== 'sombrero') { z.hatOn = false; z.hitParts = z.partsBare; z.hatG.visible = false; return; }   // Calamarón y Bestia (F5.26)
  z.head.add(z.hatG);
  z.hatG.position.set(0, 0.32, 0); z.hatG.rotation.set(0, 0, 0); z.hatG.visible = true;
  z.hatOn = true; z.hitParts = z.partsHat;
}
// variant (F5.9): 'sombrero' (por defecto) | 'calamar'. true = salió (o no hay nada que sacar)
function spawnBoss(variant) {
  const B = CONFIG.BOSS, v = variant || 'sombrero';
  const z = BOSS.pool.find(q => q.variant === v && !q.active);
  if (!z) return true;                                            // ya están todos en juego: no reintenta
  const sp = bossSpawnPoint(BOSS.pool.filter(q => q.active).length);
  if (!sp) return false;
  attachHat(z);
  z.phase = 1; z.hatDmg = 0; z.act = null; z.gun = 'idle'; z.gunT = 0; z.gunAcc = 0; z.squidT = B.calamar.squidEvery;
  z.gunModel.visible = false;
  resetZombie(z, sp, false);
  if (z.variant === 'calamar') {                                  // F5.9: minigun desde el arranque, vida ×2
    z.phase = 4; z.gunModel.visible = true;
    z.health = z.maxHealth = Math.round(z.health * B.calamar.healthMul);
    z.speed = bossSpeed(z);
  }
  z.state = 'walk'; z.t = 0;                                    // no sale del piso: camina saliendo de la niebla
  z.whistleT = B.whistleEvery; z.summonT = z.variant === 'calamar' ? 8 : 0; z.chargeT = B.chargeEvery; z.attackCd = 1; z.throwT = B.guitarEvery;
  bossEyes(z);
  placeRoot(z, 0);
  state.zombies.push(z);
  BOSS.fogT = B.fogTime;
  showBanner(bossName(z), 3);
  // F5.19: los sonidos de Diego para cada boss (si no están, el rugido procedural)
  if (!playSample(z.variant === 'calamar' ? 'sonido_de_spawn_de_boss_2' : 'silvido_de_spawn_del_sombreron')) sfxBossRoar();
  if (z.variant !== 'calamar') voice('audio_personaje_al_ver_al_boss1', 1, 30);
  z.nearSfxT = 6;
  return true;
}

//--- daño y fases ---
// F5.9: ojos según la vida (amarillos debajo de eyeYellow, rojos con lágrimas debajo de eyeRed)
function bossEyes(z) {
  const B = CONFIG.BOSS, f = z.maxHealth > 0 ? z.health / z.maxHealth : 1;
  // F5.28: los ojos de la Bestia (el Lich) son verdes con la vida llena
  z.eyeMat.color.setHex(f < B.eyeRed ? BOSS_EYE.red : f < B.eyeYellow ? BOSS_EYE.yellow : z.variant === 'bestia' ? 0x9aff3a : BOSS_EYE.normal);
  z.tears.visible = f < B.eyeRed;
}
function bossDamaged(z, dmg, hat) {
  if (z.variant === 'bestia') return beastDamaged(z, dmg);        // F5.26 (beast.js)
  const B = CONFIG.BOSS;
  if (hat && z.hatOn) { z.hatDmg += dmg; if (z.hatDmg >= B.hatFrac * z.maxHealth) knockHat(z); }
  if (z.phase < 3 && z.health < B.rageFrac * z.maxHealth) {       // fase 3: si tenía el sombrero, se le cae
    if (z.hatOn) knockHat(z);
    z.phase = 3; z.chargeT = 1.5;
    sfxBossRoar();
  }
  if (z.phase < 4 && z.health < B.gunFrac * z.maxHealth) {        // fase 4: saca la minigun de cocos
    if (z.act === 'throw' || z.act === 'windup') endAct(z);
    z.phase = 4; z.gun = 'idle'; z.gunT = 0;
    z.gunModel.visible = true;
    sfxBossRoar();
  }
  bossEyes(z);
  z.speed = bossSpeed(z);                                         // F5.5b: más rápido mientras menos vida le queda
}
function knockHat(z) {
  const H = z.hatFly, F = CONFIG.BOSS.hatFly;
  z.hatOn = false; z.hitParts = z.partsBare;
  scene.attach(z.hatG);                                         // conserva la posición en el mundo
  const a = Math.random() * Math.PI * 2;
  H.vx = Math.sin(a) * F.side; H.vz = Math.cos(a) * F.side; H.vy = F.up;
  H.spin = F.spin; H.life = F.life; H.flying = true;
  if (z.phase === 1) {
    z.phase = 2;
    z.summonT = 0; z.whistleT = 3;                              // llama zombies ya, silba en 3 s
    sfxBossRoar();
  }
}
function bossDeath(z) {
  const B = CONFIG.BOSS;
  STATS.bosses++;
  addXP(CONFIG.PROGRESSION.xp.boss);        // F5.18
  trySpawnPickup(z.px, z.pz, 'maxammo');
  if (z.variant === 'bestia') beastDeath(z);                      // F5.26: la guarida vuelve a tener barriles
  else dropString(z);                                             // F5.5: la cuerda de guitarra (una vez)
  bossTrophies(z.variant, z.px, z.pz, z.level || 0);              // F5.26: los trofeos (y la cuenta)
  z.gun = 'idle'; z.gunModel.visible = false;                     // los cocos en vuelo terminan su recorrido
  z.tears.visible = false;
  const perk = freePerk();
  const pts = B.reward.points + (perk ? 0 : B.reward.noPerkPoints);
  state.points += pts; STATS.pointsEarned += pts; pendingPts += pts;   // fijo: el doble puntos no lo duplica
  z.act = null;
  if (z.variant !== 'bestia') playSample(z.variant === 'calamar' ? 'muerte_del_2do_boss' : 'muerte_sombreron');   // F5.19
  playSample('ruido_al_matar_al_boss_2', { dest: AUDIO.master });                       // F5.19c: el golpe de la victoria
  showBanner(bossName(z) + ' IS DOWN', 3);
  sfxBossRoar();
}
// perk gratis al azar que no tengas (aunque no haya power). null = ya tenés el máximo o no queda ninguno
function freePerk() {
  if (state.perks.length >= perkMax()) return null;
  const opts = PERK_KEYS.filter(k => !hasPerk(k) && !(PERKM.machines[k] && PERKM.machines[k].gone));
  if (!opts.length) return null;
  const k = opts[Math.floor(Math.random() * opts.length)];
  state.perks.push(k);
  if (k === 'jugg') state.health = maxHealth();
  if (k === 'revive' && ++state.reviveBuys >= CONFIG.PERKS.reviveUses) hideMachine(k);
  sfxPerkDrink();
  updatePerkHUD();
  return k;
}

//--- acciones ---
function startAct(z, kind, t) {
  z.act = kind; z.actT = z.actT0 = t; z.t = 0;
  if (kind === 'slam') sfxBossSlamWind();
  else if (kind === 'windup') sfxBossRoar();
}
function bossTryAttack(z, distP, pl, minTop) {
  if (z.variant === 'bestia') return beastTryAttack(z, distP, pl, minTop);   // F5.26: zarpazo
  const B = CONFIG.BOSS, P = player.pos;
  if ((z.level || 0) === pl && distP < B.slamRange && z.attackCd <= 0 &&
      segmentClear(z.px, z.pz, P.x, P.z, 0.02, false, minTop, pl)) startAct(z, 'slam', B.slamWind);
}
// golpe al jugador: daño (con shield = true, el escudo lo puede parar) + empujón (el escudo no)
function bossHitPlayer(z, nx, nz, dmg, shield) {
  const B = CONFIG.BOSS;
  if (!(shield && shieldBlocks(z.px, z.pz, dmg))) damagePlayer(dmg, z.px, z.pz);
  player.pushX = nx * B.push; player.pushZ = nz * B.push; player.pushT = B.pushTime;
  addTrauma(0.45);
}
// F5.5c: golpe al piso. Onda de slamRadius alrededor suyo (en su nivel y con línea libre); el escudo no la para
function bossSlam(z) {
  const B = CONFIG.BOSS, P = player.pos, lv = z.level || 0;
  const dx = P.x - z.px, dz = P.z - z.pz, d = Math.hypot(dx, dz) || 1e-4;
  BOSS.ring.position.set(z.px, (lv ? lvY(lv) : groundY(z.px, z.pz)) + 0.04, z.pz);
  BOSS.ringT = B.slamFx; BOSS.ring.visible = true;
  spawnSplashFx(z.px, BOSS.ring.position.y + 0.3, z.pz, 0xc8b48a, B.slamRadius * 0.5);
  addTrauma(0.6 * Math.max(0, 1 - d / 14));
  sfxBossSlam(d);
  z.attackCd = B.slamCooldown;
  if (lv !== playerLevel() || d > B.slamRadius + CONFIG.PLAYER.radius ||
      !segmentClear(z.px, z.pz, P.x, P.z, 0.02, false, undefined, lv)) return false;
  bossHitPlayer(z, dx / d, dz / d, B.slamDamage, false);
  return true;
}
function canCharge(z) {
  const B = CONFIG.BOSS, P = player.pos, d = Math.hypot(P.x - z.px, P.z - z.pz);
  return (z.level || 0) === 0 && playerLevel() === 0 && d > 3 && d < B.chargeRange &&
         segmentClear(z.px, z.pz, P.x, P.z, B.radius, false, undefined, 0);
}
// F5.5b: ¿te ve para tirarte algo? Los dos en el piso, entre rangeMin y rangeMax, con línea libre
function canShootAt(z) {
  const B = CONFIG.BOSS, P = player.pos, d = Math.hypot(P.x - z.px, P.z - z.pz);
  return (z.level || 0) === 0 && playerLevel() === 0 && d >= B.rangeMin && d <= B.rangeMax &&
         segmentClear(z.px, z.pz, P.x, P.z, 0, true);
}
// silbido: solo de cerca y en su nivel
function inWhistle(z) {
  const P = player.pos;
  return (z.level || 0) === playerLevel() && Math.hypot(P.x - z.px, P.z - z.pz) < CONFIG.BOSS.whistleRange;
}
// true = el boss hizo algo propio este frame (updateZombies no lo mueve)
function bossTick(z, dt) {
  if (z.variant === 'bestia') return beastTick(z, dt);            // F5.26 (beast.js)
  const B = CONFIG.BOSS;
  // F5.19: el Calamarón cerca suena (el sample de Diego), cada tanto
  if (z.variant === 'calamar' && (z.nearSfxT = (z.nearSfxT || 0) - dt) <= 0) {
    z.nearSfxT = 9 + Math.random() * 5;
    playSample('sonido_del_2do_boss_cuando_esta_cerca', { pos: [z.px, 2.5, z.pz], maxDist: 22, vol: 2 });
  }
  if (z.act) { bossAct(z, dt); return true; }
  if (z.phase === 4) bossGun(z, dt);
  z.speed = bossSpeed(z);                                          // (la minigun lo frena mientras gira)
  // F5.9: el Calamarón, con poca vida, tira calamares que explotan
  if (z.variant === 'calamar' && z.health < B.calamar.squidFrac * z.maxHealth && (z.squidT -= dt) <= 0) {
    z.squidT = canShootAt(z) && throwSquid(z) ? B.calamar.squidEvery : 0.5;
  }
  if (z.phase >= 2) {
    z.summonT -= dt; z.whistleT -= dt;
    if (z.summonT <= 0) { bossSummon(z); z.summonT = B.summonEvery; }
    if (z.whistleT <= 0 && z.gun === 'idle') {
      if (inWhistle(z)) { z.whistleT = B.whistleEvery; startAct(z, 'whistle', B.whistleWind); return true; }
      z.whistleT = 0.5;                                            // lejos: espera a tenerte cerca
    }
  }
  if (z.phase < 4) {                                               // guitarras hasta sacar la minigun
    z.throwT -= dt;
    if (z.throwT <= 0) {
      const free = BOSS.guitars.some(g => !g.active);
      if (free && canShootAt(z)) { z.throwT = B.guitarEvery; startAct(z, 'throw', B.guitarWind); sfxGuitarWind(); return true; }
      z.throwT = 0.5;                                              // sin línea libre o fuera de rango: reintenta pronto
    }
  }
  if (z.phase === 3) {
    z.chargeT -= dt;
    if (z.chargeT <= 0) {
      z.chargeT = canCharge(z) ? B.chargeEvery : 0.5;             // sin línea libre, reintenta pronto
      if (z.chargeT === B.chargeEvery) { startAct(z, 'windup', B.chargeWind); return true; }
    }
  }
  return false;
}
function faceHeading(z, x, zz, dt, k) {
  z.heading = lerpAngle(z.heading, Math.atan2(x - z.px, zz - z.pz), Math.min(1, dt * k));
  z.root.rotation.y = z.heading;
}
function bossAct(z, dt) {
  const B = CONFIG.BOSS, P = player.pos;
  z.actT -= dt; z.t += dt;
  const dxp = P.x - z.px, dzp = P.z - z.pz, dist = Math.hypot(dxp, dzp) || 1e-4;
  if (z.act === 'charge') {
    const step = B.chargeSpeed * dt, ox = z.px, oz = z.pz;
    moveCircle(z, 'x', z.chargeX * step, B.radius);
    moveCircle(z, 'z', z.chargeZ * step, B.radius);
    const moved = Math.hypot(z.px - ox, z.pz - oz);
    if (!z.chargeHit && dist < B.chargeHitRange && playerLevel() === 0) {   // lo atropella al pasar
      z.chargeHit = true;
      bossHitPlayer(z, z.chargeX, z.chargeZ, B.chargeDamage, true);
    }
    if (moved < step * 0.5) {                                       // chocó con una pared o un mueble
      startAct(z, 'stun', B.stunTime);
      if (dist < 12) addTrauma(0.35);
      sfxExplosion(dist);
    } else if (z.actT <= 0) endAct(z);
  } else if (z.actT <= 0) {
    if (z.act === 'slam') {
      bossSlam(z);
      endAct(z);
    } else if (z.act === 'whistle') {
      sfxWhistle();
      if (inWhistle(z)) player.dazeT = B.dazeTime;
      endAct(z);
    } else if (z.act === 'windup') {
      z.chargeX = dxp / dist; z.chargeZ = dzp / dist; z.chargeHit = false;
      z.heading = Math.atan2(z.chargeX, z.chargeZ);
      startAct(z, 'charge', B.chargeMax / B.chargeSpeed);
    } else if (z.act === 'throw') {
      throwGuitar(z);
      endAct(z);
    } else endAct(z);                                               // stun
  } else if (z.act !== 'stun') faceHeading(z, P.x, P.z, dt, 6);
  placeRoot(z, 0);
  z.root.rotation.y = z.heading;
  animateBoss(z, dt, z.act === 'charge' ? B.chargeSpeed : 0);
}
function endAct(z) {
  z.act = null; z.t = 0;
  z.stuckT = 0; z.strikes = 0; z.lastX = z.px; z.lastZ = z.pz;     // el watchdog no cuenta el tiempo quieto
}
// llama zombies alrededor (del pool normal, fuera del total de la ronda). Solo en el piso y con lugar libre
function bossSummon(z) {
  const B = CONFIG.BOSS;
  if ((z.level || 0) !== 0) return 0;
  // F5.10: tope de invocados vivos entre todos los bosses (con varios, eran demasiados); el Calamarón llama menos
  let alive = 0;
  for (const q of state.zombies) if (q.alive && q.summoned) alive++;
  const want = Math.min(z.variant === 'calamar' ? B.calamar.summonCount : B.summonCount, B.summonMax - alive);
  let n = 0;
  const a0 = Math.random() * Math.PI * 2;
  for (let k = 0; k < 12 && n < want; k++) {
    const q = ZPOOL.find(o => !o.active);
    if (!q) break;
    const a = a0 + k / 12 * Math.PI * 2, x = z.px + Math.sin(a) * 2, zz = z.pz + Math.cos(a) * 2;
    const cx = Math.floor(x), cz = Math.floor(zz);
    if (!isNav(cx, cz) || flowAt(cx, cz) < 0 || !segmentClear(z.px, z.pz, cx + 0.5, cz + 0.5, 0.3)) continue;
    resetZombie(q, { x: cx + 0.5, z: cz + 0.5 }, false, 'normal');
    q.summoned = true;
    state.zombies.push(q);
    n++;
  }
  if (n) sfxBossRoar();
  return n;
}

//--- F5.5b: guitarras y minigun de cocos; F5.9: calamares que explotan ---
// punto del boss en su marco: adelante (hacia yaw), a la derecha y arriba del piso
const _bp = new THREE.Vector3();
function bossPoint(z, yaw, fwd, right, up) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  return _bp.set(z.px + fx * fwd + fz * right, groundY(z.px, z.pz) + up, z.pz + fz * fwd - fx * right);   // +x local = (cos, -sin)
}
// ¿un proyectil en (x, y, z) le pega a algo sólido? Los límites invisibles no frenan (como las balas)
function projBlocked(x, y, z) {
  if (y <= groundY(x, z)) return true;
  for (const c of collidersNear(x, x, z, z)) {
    if (!c.solid || !c.mesh) continue;
    if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ && y > c.minY && y < c.maxY) return true;
  }
  return false;
}
// ¿toca al jugador? Distancia al segmento vertical pies-ojos contra radio del proyectil + el del jugador
function projHitsPlayer(p, r) {
  const P = player.pos, cy = Math.max(P.y - CONFIG.PLAYER.height, Math.min(P.y, p.y));
  return Math.hypot(p.x - P.x, p.y - cy, p.z - P.z) < r + CONFIG.PLAYER.radius;
}
// la guitarra sale de la mano levantada y cae en arco donde vas a estar (adelanta tu velocidad)
function throwGuitar(z) {
  const B = CONFIG.BOSS, P = player.pos, G = BOSS.guitars.find(g => !g.active);
  if (!G) return false;
  const yaw = Math.atan2(P.x - z.px, P.z - z.pz), o = bossPoint(z, yaw, 0.4, 0.5, 2.9);
  let tx = P.x, tz = P.z, T = 0.1;
  for (let i = 0; i < 2; i++) {
    T = Math.max(0.1, Math.hypot(tx - o.x, tz - o.z) / B.guitarSpeed);
    tx = P.x + player.vel.x * T; tz = P.z + player.vel.z * T;
  }
  const ty = P.y - 0.8;
  G.p.copy(o);
  G.v.set((tx - o.x) / T, (ty - o.y) / T + 0.5 * B.guitarGravity * T, (tz - o.z) / T);
  G.ox = z.px; G.oz = z.pz; G.active = true;
  G.g.position.copy(o); G.g.rotation.set(0, yaw, 0); G.g.visible = true;
  sfxGuitarThrow();
  return true;
}
// F5.9: el Calamarón tira un calamar en arco a donde estás (sin adelantar): al caer explota en un charco verde
function throwSquid(z) {
  const C = CONFIG.BOSS.calamar, P = player.pos, S = BOSS.squids.find(s => !s.active);
  if (!S) return false;
  const yaw = Math.atan2(P.x - z.px, P.z - z.pz), o = bossPoint(z, yaw, 0.5, -0.5, 2.9);
  const T = Math.max(0.3, Math.hypot(P.x - o.x, P.z - o.z) / C.squidSpeed), ty = P.y - CONFIG.PLAYER.height;
  S.p.copy(o); S.v.set((P.x - o.x) / T, (ty - o.y) / T + 0.5 * C.squidGravity * T, (P.z - o.z) / T);
  S.active = true; S.g.position.copy(o); S.g.visible = true;
  sfxGuitarThrow();
  return true;
}
// un coco de la minigun: recto hacia el pecho, con dispersión y sin adelantar
function fireCoco(z) {
  const B = CONFIG.BOSS, P = player.pos, C = BOSS.cocos.find(c => !c.active);
  if (!C) return false;
  const yaw = Math.atan2(P.x - z.px, P.z - z.pz), o = bossPoint(z, yaw, 1.5, 0.6, 2.0);
  const dx = P.x - o.x, dy = P.y - 0.7 - o.y, dz = P.z - o.z, d = Math.hypot(dx, dy, dz) || 1;
  const a = Math.atan2(dx, dz) + (Math.random() * 2 - 1) * B.gunSpread;
  const e = Math.asin(dy / d) + (Math.random() * 2 - 1) * B.gunSpread;
  C.p.copy(o);
  C.v.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(B.gunSpeed);
  C.ox = z.px; C.oz = z.pz; C.life = B.rangeMax * 1.5 / B.gunSpeed; C.active = true;
  C.m.position.copy(o); C.m.visible = true;
  sfxCocoShot(Math.hypot(dx, dz));
  return true;
}
// minigun: idle -> spin (aviso) -> fire (ráfaga) -> cool (pausa) -> idle. Camina mientras tanto
function bossGun(z, dt) {
  const B = CONFIG.BOSS;
  if (z.gun === 'idle') {
    if (canShootAt(z)) { z.gun = 'spin'; z.gunT = B.gunSpin; sfxMinigunSpin(); }
  } else if (z.gun === 'spin') {
    z.gunT -= dt;
    if (z.gunT <= 0) { z.gun = 'fire'; z.gunT = B.gunBurst; z.gunAcc = 1; }
  } else if (z.gun === 'fire') {
    z.gunT -= dt; z.gunAcc += dt * B.gunRate;
    while (z.gunAcc >= 1) { z.gunAcc -= 1; fireCoco(z); }
    if (z.gunT <= 0) { z.gun = 'cool'; z.gunT = B.gunCool; }
  } else if ((z.gunT -= dt) <= 0) z.gun = 'idle';                 // cool
}
function updateBossShots(dt) {
  const B = CONFIG.BOSS, P = player.pos;
  for (const G of BOSS.guitars) {
    if (!G.active) continue;
    let end = false;
    for (let s = 0; s < 3 && !end; s++) {
      const h = dt / 3;
      G.v.y -= B.guitarGravity * h;
      G.p.addScaledVector(G.v, h);
      if (projHitsPlayer(G.p, B.guitarRadius)) {
        if (!shieldBlocks(G.ox, G.oz, B.guitarDamage)) damagePlayer(B.guitarDamage, G.ox, G.oz);
        const hl = Math.hypot(G.v.x, G.v.z) || 1;
        player.pushX = G.v.x / hl * B.guitarPush; player.pushZ = G.v.z / hl * B.guitarPush; player.pushT = B.pushTime;
        addTrauma(0.3);
        end = true;
      } else if (projBlocked(G.p.x, G.p.y, G.p.z)) end = true;
    }
    if (end || G.p.y < -5) {
      G.active = false; G.g.visible = false;
      sfxGuitarBreak(Math.hypot(G.p.x - P.x, G.p.z - P.z));
      continue;
    }
    G.g.position.copy(G.p); G.g.rotation.x += dt * 11;
  }
  for (const C of BOSS.cocos) {
    if (!C.active) continue;
    C.life -= dt;
    let end = C.life <= 0;
    for (let s = 0; s < 4 && !end; s++) {
      C.p.addScaledVector(C.v, dt / 4);
      if (projHitsPlayer(C.p, B.gunRadius)) {
        if (!shieldBlocks(C.ox, C.oz, B.gunDamage)) damagePlayer(B.gunDamage, C.ox, C.oz, true);   // ignora el i-frame
        end = true;
      } else if (projBlocked(C.p.x, C.p.y, C.p.z)) end = true;
    }
    if (end) { C.active = false; C.m.visible = false; continue; }
    C.m.position.copy(C.p); C.m.rotation.x += dt * 15;
  }
  // F5.9: calamares del Calamarón: al tocar algo (o a vos) explotan en un charco verde grande
  const CQ = B.calamar;
  for (const S of BOSS.squids) {
    if (!S.active) continue;
    let end = false;
    for (let s = 0; s < 3 && !end; s++) {
      const h = dt / 3;
      S.v.y -= CQ.squidGravity * h;
      S.p.addScaledVector(S.v, h);
      if (projHitsPlayer(S.p, 0.35) || projBlocked(S.p.x, S.p.y, S.p.z) || S.p.y < -5) end = true;
    }
    if (end) {
      S.active = false; S.g.visible = false;
      acidPuddle(S.p.x, S.p.z, 0, CQ.puddleR, CQ.puddleLife);
      spawnSplashFx(S.p.x, groundY(S.p.x, S.p.z) + 0.4, S.p.z, 0x7aff3a, CQ.puddleR * 0.6);
      sfxExplosion(Math.hypot(S.p.x - P.x, S.p.z - P.z));
      continue;
    }
    S.g.position.copy(S.p); S.g.rotation.x += dt * 6; S.g.rotation.z += dt * 4;
  }
}

//--- animación ---
function animateBoss(z, dt, v) {
  if (z.variant === 'bestia') return animateBeast(z, dt, v);      // F5.26 (beast.js)
  const k = Math.min(1, v / 1.2);
  z.walkT += dt * (2.2 + v * 1.4);
  const s = Math.sin(z.walkT);
  z.legL.rotation.x = s * 0.45 * k; z.legR.rotation.x = -s * 0.45 * k;
  z.body.rotation.set(0.06 * k, 0, s * 0.04 * k);
  z.body.position.set(0, Math.abs(s) * 0.06 * k, 0);
  let aL = -0.15 - s * 0.35 * k, aR = -0.15 + s * 0.35 * k;
  const p = z.actT0 > 0 ? 1 - Math.max(0, z.actT) / z.actT0 : 1;
  if (z.act === 'slam') {                                      // F5.5c: sube los dos brazos, se estira y baja de golpe
    const up = Math.min(1, p / 0.85), down = p > 0.85 ? (p - 0.85) / 0.15 : 0;
    aL = aR = -3.0 * up + 2.2 * down;
    z.body.rotation.x = -0.25 * up + 0.75 * down;
    z.body.position.y = 0.15 * up * (1 - down);
  } else if (z.act === 'whistle') {                            // dedos a la boca
    aL = aR = -2.3 * Math.min(1, p * 3);
  } else if (z.act === 'windup') {                             // se echa atrás, brazos abiertos
    z.body.rotation.x = -0.2 * Math.min(1, p * 2); aL = aR = -1.2;
  } else if (z.act === 'charge') {                             // agachado, brazos atrás
    z.body.rotation.x = 0.45; aL = aR = 0.8;
  } else if (z.act === 'stun') {                               // mareado
    z.body.rotation.set(0.15, 0, Math.sin(z.t * 5) * 0.12); aL = aR = 0.1;
  } else if (z.act === 'throw') {                              // F5.5b: guitarra atrás, por encima de la cabeza
    aR = -3.0 * Math.min(1, p * 1.4); z.body.rotation.x = -0.15 * p;
  }
  if (z.phase === 4 && !z.act) {                               // F5.5b: minigun al frente, el torso apunta al jugador
    aR = -Math.PI / 2;
    if (z.gun === 'spin' || z.gun === 'fire') {
      let d = Math.atan2(player.pos.x - z.px, player.pos.z - z.pz) - z.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      z.body.rotation.y = Math.max(-1.2, Math.min(1.2, d));
    }
  }
  z.barrels.rotation.y += dt * (z.gun === 'fire' ? 30 : z.gun === 'spin' ? 15 : 0);
  z.armL.rotation.x = aL; z.armR.rotation.x = aR;
}

//--- por frame: niebla, sombreros volando, barra, visión borrosa ---
function updateBoss(dt) {
  const B = CONFIG.BOSS;
  if (!BOSS.fogBase && scene.fog) BOSS.fogBase = { near: scene.fog.near, far: scene.fog.far };
  // F5.8 (Diego): la niebla se cierra al aparecer (1 s) y queda cerrada TODA la pelea; se abre al morir (2 s)
  if (BOSS.fogBase && scene.fog) {
    // F5.9: sin boss, la niebla va a la del clima (la neblina morada la acerca)
    const on = bossAlive(), base = BOSS.fogBase, target = on ? B.fogFar : weatherFogFar(base.far), f = scene.fog.far;
    if (f !== target) {
      const rate = (base.far - B.fogFar) * dt / (on ? 1 : 2);
      scene.fog.far = f > target ? Math.max(target, f - rate) : Math.min(target, f + rate);
      scene.fog.near = scene.fog.far === base.far ? base.near : Math.min(base.near, scene.fog.far * 0.25);
    }
  }
  updateBossShots(dt);                                         // F5.5b: guitarras y cocos en vuelo
  if (BOSS.ringT > 0) {                                        // F5.5c: onda del golpe al piso
    BOSS.ringT = Math.max(0, BOSS.ringT - dt);
    const k = 1 - BOSS.ringT / B.slamFx;
    BOSS.ring.scale.setScalar(0.4 + (B.slamRadius - 0.4) * easeOut(k));
    BOSS.ring.material.opacity = 0.8 * (1 - k);
    BOSS.ring.visible = BOSS.ringT > 0;
  }
  for (const z of BOSS.pool) {
    const H = z.hatFly;
    if (!H.flying) continue;
    const g = H.g;
    if (g.position.y > groundY(g.position.x, g.position.z) + 0.05 || H.vy > 0) {
      H.vy -= 9.8 * dt;
      g.position.x += H.vx * dt; g.position.y += H.vy * dt; g.position.z += H.vz * dt;
      g.rotation.y += H.spin * dt; g.rotation.x += H.spin * 0.3 * dt;
      const gy = groundY(g.position.x, g.position.z) + 0.05;
      if (g.position.y <= gy && H.vy < 0) { g.position.y = gy; g.rotation.x = 0; H.vy = 0; H.vx = H.vz = 0; }
    }
    H.life -= dt;
    if (H.life <= 0) { H.flying = false; g.visible = false; }
  }
  // barra: el boss vivo más cercano (F5.9: puede haber varios)
  if (UI.boss) {
    let z = null, bd = Infinity;
    for (const q of BOSS.pool) {
      if (!q.active || !q.alive) continue;
      const d = Math.hypot(q.px - player.pos.x, q.pz - player.pos.z);
      if (d < bd) { bd = d; z = q; }
    }
    const plant = !z && typeof plantBossBar === 'function' && plantBossBar();   // F5.20: la planta del templo
    UI.boss.style.display = z || plant ? 'block' : 'none';
    if (plant) {
      UI.bossName.textContent = CONFIG.PLANTBOSS.name;
      UI.bossFill.style.width = (Math.max(0, PLANTB.hp / PLANTB.max) * 100).toFixed(1) + '%';
      UI.bossHat.style.width = '0%';
    }
    if (z) {
      UI.bossName.textContent = bossName(z);
      UI.bossFill.style.width = (Math.max(0, z.health / z.maxHealth) * 100).toFixed(1) + '%';
      UI.bossHat.style.width = z.hatOn ? (Math.min(1, z.hatDmg / (B.hatFrac * z.maxHealth)) * 100).toFixed(1) + '%' : '0%';
    }
  }
  const blur = player.dazeT > 0 ? B.dazeBlur * Math.min(1, player.dazeT / 0.5) : 0;
  if (blur !== BOSS.blur) {                                    // F7a: el filtro lo arma gfx.js (con el color)
    BOSS.blur = blur; GFX.blur = blur;
    gfxApplyFilter();
  }
}

function resetBoss() {
  roundState.bossPending = false; roundState.bossQueue = []; roundState.forceBoss = 0;
  BOSS.fogT = 0;
  if (BOSS.fogBase && scene.fog) { scene.fog.far = BOSS.fogBase.far; scene.fog.near = BOSS.fogBase.near; }
  for (const z of BOSS.pool) {
    z.act = null; z.phase = 1; z.hatDmg = 0; z.gun = 'idle'; attachHat(z);
    z.gunModel.visible = false; z.tears.visible = false;
    if (z.variant !== 'bestia') z.eyeMat.color.setHex(BOSS_EYE.normal);   // F5.28: la Bestia dormida tiene los ojos apagados
  }
  BOSS.ringT = 0; if (BOSS.ring) BOSS.ring.visible = false;
  for (const G of BOSS.guitars) { G.active = false; G.g.visible = false; }
  for (const C of BOSS.cocos) { C.active = false; C.m.visible = false; }
  for (const S of BOSS.squids) { S.active = false; S.g.visible = false; }
  if (UI.boss) UI.boss.style.display = 'none';
  BOSS.blur = 0; GFX.blur = 0; gfxApplyFilter();              // F7a: sin blur (el color del post queda)
}
