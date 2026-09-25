//=== 7. ECONOMY ==========================================================
function addPoints(p) {
  const amt = state.effects.doublePoints > 0 ? p * 2 : p;
  state.points += amt;
  STATS.pointsEarned += amt;
  pendingPts += amt;
}

//--- POWER-UPS: drop al morir un zombie, se recogen al pasar por encima ---
const PICKUPS = { pool: [] };
const POWERUP_KEYS = Object.keys(CONFIG.POWERUPS.types);   // ['maxammo','instakill','doublepoints']

function buildPickupPool() {
  const geo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
  for (let i = 0; i < CONFIG.POWERUPS.poolSize; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x000000, emissiveIntensity: 0.55 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    scene.add(mesh);
    const light = new THREE.PointLight(0xffffff, 0, 3.2, 2);
    scene.add(light);
    PICKUPS.pool.push({ mesh, light, active: false, type: null, life: 0, x: 0, z: 0, spin: Math.random() * 6.28 });
  }
}
// llamado desde damageZombie() al morir un zombie (gun o cuchillo, mismo camino)
function onZombieDeath(z) {
  sfxGrowl(z, 'death');
  soulFromKill(z);                         // F2.5: alma para la caja de almas cercana, cualquier arma
  statueKill(z);                           // F5.11: calamar muerto cerca de una estatua de la escotilla
  if (z.boss) { bossDeath(z); return; }    // F5: su propia recompensa (Max Ammo, perk, puntos)
  const G = CONFIG.POWERUPS.guaranteeEveryRounds;
  let forced = null;
  if (G > 0 && state.round % G === 0 && !roundState.guaranteedDrop) {
    forced = 'maxammo';
    roundState.guaranteedDrop = true;
  }
  // F4: el último perro de la ronda suelta un Max Ammo seguro
  if ((z.dog || z.squid) && roundState.dogs && roundState.spawned >= roundState.total && aliveCount() === 0) forced = 'maxammo';   // F5.9: o calamar
  if (KABOOM.active && forced !== 'maxammo') return;              // F5.10: el Kaboom no suelta drops
  trySpawnPickup(z.px, z.pz, forced);
}
function trySpawnPickup(x, z, forceType) {
  let type = forceType;
  if (!type) {
    if (Math.random() > CONFIG.POWERUPS.dropChance) return;
    type = POWERUP_KEYS[Math.floor(Math.random() * POWERUP_KEYS.length)];
  }
  const slot = PICKUPS.pool.find(p => !p.active);
  if (!slot) return;                       // pool lleno (muy raro con 8 slots): se pierde el drop
  const info = CONFIG.POWERUPS.types[type];
  slot.active = true; slot.type = type; slot.life = CONFIG.POWERUPS.lifespan;
  slot.x = x; slot.z = z;
  slot.mesh.material.color.setHex(info.color);
  slot.mesh.material.emissive.setHex(info.color);
  slot.mesh.visible = true;
  slot.light.color.setHex(info.color);
  slot.light.intensity = 1.3;
}
function collectPickup(p) {
  applyPowerup(p.type);
  deactivatePickup(p);
}
function deactivatePickup(p) { p.active = false; p.mesh.visible = false; p.light.intensity = 0; }
function applyPowerup(type) {
  if (type === 'maxammo') {
    state.weapons.forEach(w => {
      const def = slotDef(w);                   // F2b: la mejorada llena su cargador y reserva ×1.5
      w.mag = def.magSize; w.reserve = def.reserveMax;
    });
    if (MONKEY.has) { MONKEY.count = CONFIG.MONKEY.max; updateGrenadeHUD(); }   // F5.11: recarga los langostinos
    updateAmmoHUD();
  } else if (type === 'instakill') {
    state.effects.instakill = CONFIG.POWERUPS.types.instakill.duration;
  } else if (type === 'doublepoints') {
    state.effects.doublePoints = CONFIG.POWERUPS.types.doublepoints.duration;
  } else if (type === 'kaboom') {
    kaboom();
  }
  showPowerupBanner(type);
  sfxPowerup(type);
}
function updatePickups(dt) {
  const F = CONFIG.POWERUPS, t = clock.elapsedTime;
  for (const p of PICKUPS.pool) {
    if (!p.active) continue;
    p.life -= dt;
    p.spin += dt * F.spinSpeed;
    const y = groundY(p.x, p.z) + 0.55 + Math.sin(t * F.bobFreq + p.spin) * F.bobAmp;   // piscina: sobre el fondo
    p.mesh.position.set(p.x, y, p.z);
    p.mesh.rotation.set(p.spin * 0.6, p.spin, 0);
    p.light.position.set(p.x, y + 0.15, p.z);
    const dx = player.pos.x - p.x, dz = player.pos.z - p.z;
    if (dx * dx + dz * dz < F.pickupRadius * F.pickupRadius) { collectPickup(p); continue; }
    if (p.life <= 0) deactivatePickup(p);
  }
}
function updateEffects(dt) {
  if (state.effects.instakill > 0) state.effects.instakill = Math.max(0, state.effects.instakill - dt);
  if (state.effects.doublePoints > 0) state.effects.doublePoints = Math.max(0, state.effects.doublePoints - dt);
  updateKaboom(dt);
}
function resetPickups() {
  PICKUPS.pool.forEach(deactivatePickup);
  state.effects.instakill = 0; state.effects.doublePoints = 0;
  roundState.spawnHold = 0; KABOOM.active = false;
  for (const f of KABOOM.flames) { f.z = null; f.g.visible = false; }
}

//--- F5.10: KABOOM. Todos los zombies vivos (no bosses) mueren al instante, sin puntos ni drops; el cuerpo queda
// ardiendo types.kaboom.burn s (z.burnT: updateZombies lo deja en 'dying' hasta que se apaga) y mientras tanto
// no sale nadie (roundState.spawnHold). Las llamas son un pool fijo que sigue a cada cuerpo
const KABOOM = { flames: [], active: false };
function buildKaboom() {
  const tex = radialTex('rgba(255,230,120,1)', 'rgba(255,80,0,0.45)');
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide });
  const geo = new THREE.PlaneGeometry(1, 1.2);
  for (let i = 0; i < CONFIG.POWERUPS.flamePool; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set((k - 1) * 0.5, 0.5, 0); m.rotation.y = k * Math.PI / 3;
      g.add(m);
    }
    g.visible = false; scene.add(g);
    KABOOM.flames.push({ g, z: null, t: Math.random() * 6 });
  }
}
function kaboom() {
  const burn = CONFIG.POWERUPS.types.kaboom.burn;
  KABOOM.active = true;                                           // onZombieDeath: sin drops
  let n = 0;
  for (const z of state.zombies.slice()) {
    if (!z.alive || z.boss) continue;
    damageZombie(z, z.health + 1, false, 0, 0);
    z.burnT = burn;
    const f = KABOOM.flames.find(q => !q.z);
    if (f) { f.z = z; f.g.visible = true; }
    spawnSplashFx(z.px, groundY(z.px, z.pz) + 1, z.pz, 0xff6a1a, 1.2);
    n++;
  }
  KABOOM.active = false;
  roundState.spawnHold = burn;
  const pts = CONFIG.POWERUPS.types.kaboom.points(Math.max(1, state.round));   // F5.13: plata fija
  state.points += pts; STATS.pointsEarned += pts; pendingPts += pts;
  addTrauma(0.5);
  sfxExplosion(0);
  return n;
}
function updateKaboom(dt) {
  const t = clock.elapsedTime;
  for (const f of KABOOM.flames) {
    const z = f.z;
    if (!z) continue;
    if (!z.active || !(z.burnT > 0)) { f.z = null; f.g.visible = false; continue; }
    f.g.position.copy(z.root.position);
    f.g.rotation.y = z.root.rotation.y;
    const k = Math.min(1, z.burnT / 1);                            // se apaga en el último segundo
    f.g.scale.set(1.6, (0.8 + 0.3 * Math.sin(t * 17 + z.id)) * k, 1.6);
    const e = 0.5 + 0.5 * Math.sin(t * 13 + z.id);                 // cuerpo al rojo
    for (const m of z.flashMats) m.emissive.setRGB(0.9 * k * e, 0.25 * k * e, 0);
  }
}

// único punto de gasto (el doble puntos NO afecta gastos)
// F5.16: devolución (el oso de la caja). No es ganancia: el doble puntos no la toca y no suma a STATS
function refundBox() {
  const n = BOX.paid || 0;
  BOX.paid = 0;
  if (!n) return;
  state.points += n;
  pendingPts += n;
}
function spendPoints(cost) {
  if (state.points < cost) return false;
  state.points -= cost;
  showSpend(cost);
  return true;
}

function buyDoor(id) {
  const d = state.doors[id];
  if (!d || d.open || d.power || d.burning) return false;   // F5.7: el portón del sótano solo lo abre la energía
  if (!spendPoints(d.cost)) return false;
  if (d.burn) return startBurn(d);                 // F5.12: el cerco arde y se abre al terminar (updateBurns lo cuenta)
  openDoor(id);
  STATS.doors++;
  return true;
}

//--- ARMAS DE PARED: tiza + modelo en la pared. Estáticas, se construyen una vez en init ---
const WALLBUYS = [];
function buildWallBuys() {
  const T = CONFIG.WALL_T / 2;
  CONFIG.WALLBUYS.forEach(cfg => {
    const def = cfg.weapon === 'machete' ? CONFIG.MACHETE : CONFIG.WEAPONS[cfg.weapon];
    // F3b: axis 'z' = pared a lo largo de x (cara hacia ±z). Se arma en x y se gira el grupo entero
    // F5.6: level 1 = en el techo (el doble cañón): todo sube UP.y y solo se compra desde arriba
    // F5.11: floorY = piso del búnker (la bazooka)
    const alongX = cfg.axis === 'z', base = cfg.level ? UP.y : (cfg.floorY || 0), y = base + (cfg.y || 1.5);
    const fx = alongX ? cfg.x : cfg.x + cfg.face * T;   // cara de la pared
    const fz = alongX ? cfg.z + cfg.face * T : cfg.z;
    const wb = Object.assign({}, cfg, { mx: alongX ? fx : fx + cfg.face * 0.05, mz: alongX ? fz + cfg.face * 0.05 : fz });
    if (cfg.post) {                                    // tablón propio (el muelle y el techo no tienen paredes)
      const post = alongX ? box(2.4, 2.3, 0.1, 0x6a5440, fx, base + 1.15, fz - cfg.face * 0.05)
                          : box(0.1, 2.3, 2.4, 0x6a5440, fx - cfg.face * 0.05, base + 1.15, fz);
      scene.add(post); wb.post = post;
    }

    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 256, 128);
    x.strokeStyle = 'rgba(236,230,214,.85)'; x.lineWidth = 3;
    x.strokeRect(6, 6, 244, 116);
    x.fillStyle = 'rgba(236,230,214,.9)';
    x.font = 'bold 18px monospace'; x.textAlign = 'center';
    x.fillText(def.name + '  ' + cfg.cost, 128, 112);
    const tex = new THREE.CanvasTexture(c);
    const chalk = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1),
      new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, emissive: 0x2a2824 }));
    if (alongX) {
      chalk.position.set(fx, y, fz + cfg.face * 0.01);
      chalk.rotation.y = cfg.face > 0 ? 0 : Math.PI;
    } else {
      chalk.position.set(fx + cfg.face * 0.01, y, fz);
      chalk.rotation.y = cfg.face > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    scene.add(chalk);

    const model = cfg.weapon === 'machete' ? buildMacheteModel() : buildWeaponModel(def);   // de costado contra la pared
    model.visible = true;
    model.scale.setScalar(1.3);
    if (alongX) { model.position.set(fx, y + 0.12, fz + cfg.face * 0.07); model.rotation.y = Math.PI / 2; }
    else { model.position.set(fx + cfg.face * 0.07, y + 0.12, fz); model.rotation.y = cfg.face > 0 ? 0 : Math.PI; }
    scene.add(model);

    wb.chalk = chalk; wb.model = model;
    WALLBUYS.push(wb);
  });
}

function ammoCostOf(slot) { return slot.pap ? CONFIG.PAP.ammoCost : CONFIG.ECONOMY.ammoCost; }
// true = compró algo (arma o munición)
function buyWallWeapon(wb) {
  if (wb.weapon === 'machete') {                                 // F3b: reemplaza al cuchillo, una vez
    if (state.machete || !spendPoints(wb.cost)) return false;
    state.machete = true;
    return true;
  }
  const owned = state.weapons.find(w => w.id === wb.weapon);
  if (owned) {
    const def = slotDef(owned);                                  // F2b: mejorada = reserva ×1.5 y cuesta PAP.ammoCost
    if (owned.reserve >= def.reserveMax) return false;          // lleno: no cobra
    if (!spendPoints(ammoCostOf(owned))) return false;
    owned.reserve = def.reserveMax;
    updateAmmoHUD();
    return true;
  }
  if (!spendPoints(wb.cost)) return false;
  giveWeapon(wb.weapon);        // 3ra arma reemplaza la equipada
  raiseWeapon();
  return true;
}

//--- MYSTERY BOX ---
// Fases: idle -> rolling (4s) -> ready (8s para agarrar) -> idle
//                             \-> teddy (oso) -> moving (se hunde, se muda, sube) -> idle
// El resultado se decide al pagar. Nunca ofrece un arma que ya tenés.
// Todo se construye una vez: la luz dorada nace con intensity 0 y los modelos de display se prenden/apagan.
const BOX = {
  phase: 'idle', t: 0, room: null, result: null, shown: null, nextCycle: 0, moveTo: null, relocated: false,
  group: null, lid: null, light: null, glow: null, hit: null, collider: null, display: {}, teddy: null, lidA: 0
};
function buildBox() {
  const B = CONFIG.BOX, S = B.size;
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ map: TEX.door, color: 0xc9a57a });
  const qTex = makeTex((c, s) => {
    c.fillStyle = '#4a2f1c'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#ffd35a'; c.font = 'bold ' + (s * 0.8) + 'px monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('?', s / 2, s / 2 + 4);
  }, 1, 64);
  const qMat = new THREE.MeshBasicMaterial({ map: qTex });
  // cuerpo abierto arriba: 4 paredes + fondo (se ve el brillo adentro al abrir)
  const body = new THREE.Mesh(new THREE.BoxGeometry(S.w, S.h, S.d), wood);
  body.position.y = S.h / 2;
  g.add(body);
  [-S.w * 0.28, S.w * 0.28].forEach(x => {                   // signos "?" en el frente
    const q = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), qMat);
    q.position.set(x, S.h / 2, S.d / 2 + 0.005);
    g.add(q);
  });
  // tapa con pivote en el borde trasero
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, S.h, -S.d / 2);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(S.w + 0.04, 0.08, S.d + 0.04), wood);
  lid.position.set(0, 0.04, S.d / 2);
  lidPivot.add(lid);
  const q2 = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), qMat);
  q2.rotation.x = -Math.PI / 2; q2.position.set(0, 0.085, S.d / 2);
  lidPivot.add(q2);
  g.add(lidPivot);
  // haz dorado (solo visual, aditivo)
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(S.w * 0.9, 2.2),
    new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,230,140,.9)', 'rgba(255,190,60,.35)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  glow.position.y = S.h + 0.6; glow.visible = false;
  g.add(glow);
  scene.add(g);

  // luz dorada: creada UNA vez (intensity 0), se mueve con la caja
  const light = new THREE.PointLight(B.lightColor, 0, 7, 2);
  scene.add(light);

  // display: un modelo por arma del pool + oso. Hijos de la escena, no de la caja (no heredan la tapa)
  const disp = new THREE.Group();
  scene.add(disp);
  B.pool.forEach(id => {
    const m = id === 'monkey' ? buildMonkeyModel(0.5) : buildWeaponModel(CONFIG.WEAPONS[id]);   // F5.11: el langostino
    m.visible = false; disp.add(m); BOX.display[id] = m;
  });
  BOX.teddy = buildTeddy(); BOX.teddy.visible = false; disp.add(BOX.teddy);

  body.userData.type = 'world';
  WORLD.hitMeshes.push(body);                      // frena balas
  const col = { minX: 0, maxX: 0, minY: 0, maxY: S.h, minZ: 0, maxZ: 0, tag: 'box', mesh: body, solid: true };
  WORLD.colliders.push(col);

  Object.assign(BOX, { group: g, lid: lidPivot, light, glow, hit: body, collider: col, disp });
  // F5.17 (Diego, como en Black Ops): rayo de luz del cielo a la caja. 3 planos aditivos cruzados, sin niebla (se ve
  // de lejos, hasta camera.far). Se esconde mientras la caja se muda
  const bt = makeTexWH(32, 128, (c, w, h) => {
    const gx = c.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gx; c.fillRect(0, 0, w, h);
    const gy = c.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, 'rgba(0,0,0,1)'); gy.addColorStop(0.35, 'rgba(0,0,0,0)'); gy.addColorStop(0.97, 'rgba(0,0,0,0)'); gy.addColorStop(1, 'rgba(0,0,0,.6)');
    c.globalCompositeOperation = 'destination-out'; c.fillStyle = gy; c.fillRect(0, 0, w, h);
  });
  const beam = new THREE.Group(), bm = new THREE.MeshBasicMaterial({ map: bt, color: B.beamColor, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  for (let k = 0; k < 3; k++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(B.beamWidth, B.beamHeight), bm);
    p.position.y = B.beamHeight / 2; p.rotation.y = k * Math.PI / 3; p.frustumCulled = false; beam.add(p);
  }
  scene.add(beam);
  BOX.beam = beam; BOX.beamMat = bm;
}
function buildTeddy() {
  const g = new THREE.Group(), C = 0x8a5a34, L = 0xc79a6a, D = 0x1a1210;
  g.add(box(0.30, 0.34, 0.22, C, 0, 0, 0));          // cuerpo
  g.add(box(0.16, 0.18, 0.02, L, 0, -0.02, 0.115));  // panza
  g.add(box(0.26, 0.24, 0.22, C, 0, 0.28, 0));       // cabeza
  g.add(box(0.09, 0.09, 0.06, C, -0.11, 0.42, 0));   // orejas
  g.add(box(0.09, 0.09, 0.06, C,  0.11, 0.42, 0));
  g.add(box(0.10, 0.07, 0.04, L, 0, 0.25, 0.12));    // hocico
  g.add(box(0.04, 0.04, 0.02, D, -0.06, 0.32, 0.115)); // ojos
  g.add(box(0.04, 0.04, 0.02, D,  0.06, 0.32, 0.115));
  g.add(box(0.09, 0.22, 0.09, C, -0.2, 0.02, 0));    // brazos
  g.add(box(0.09, 0.22, 0.09, C,  0.2, 0.02, 0));
  g.add(box(0.11, 0.12, 0.13, C, -0.09, -0.22, 0.03)); // patas
  g.add(box(0.11, 0.12, 0.13, C,  0.09, -0.22, 0.03));
  return g;
}
// coloca la caja en el spot del cuarto (collider + nav). No crea nada.
function placeBox(roomId) {
  const sp = CONFIG.BOX.spots[roomId], S = CONFIG.BOX.size;
  BOX.room = roomId;
  BOX.group.position.set(sp.x, 0, sp.z);
  BOX.group.rotation.y = sp.rot;
  const sideways = Math.abs(Math.sin(sp.rot)) > 0.5;
  const hx = (sideways ? S.d : S.w) / 2, hz = (sideways ? S.w : S.d) / 2;
  const c = BOX.collider;
  c.minX = sp.x - hx; c.maxX = sp.x + hx; c.minZ = sp.z - hz; c.maxZ = sp.z + hz;
  BOX.light.position.set(sp.x, 1.6, sp.z);
  BOX.disp.position.set(sp.x, 0, sp.z);
  BOX.disp.rotation.y = sp.rot;
  if (BOX.beam) BOX.beam.position.set(sp.x, 0, sp.z);            // F5.17
  buildNavGrid();
}
function boxShow(id) {           // id de arma, 'teddy' o null
  for (const k in BOX.display) BOX.display[k].visible = k === id;
  BOX.teddy.visible = id === 'teddy';
  BOX.shown = id;
}
function resetBox() {
  BOX.phase = 'idle'; BOX.t = 0; BOX.result = null; BOX.moveTo = null; BOX.lidA = 0;
  boxShow(null);
  BOX.glow.visible = false; BOX.light.intensity = 0;
  BOX.group.position.y = 0; BOX.lid.rotation.x = 0;
  placeBox(CONFIG.BOX.startRoom);
}
// cuartos a los que se puede mudar: abiertos, distintos del actual, sin el jugador encima del spot
function boxDestinations() {
  return openRooms().filter(r => r !== BOX.room && CONFIG.BOX.spots[r] &&
    Math.hypot(player.pos.x - CONFIG.BOX.spots[r].x, player.pos.z - CONFIG.BOX.spots[r].z) > 2);
}
function rollBoxResult() {
  const B = CONFIG.BOX, dest = boxDestinations();
  if (dest.length && Math.random() < B.teddyChance) {
    BOX.moveTo = dest[Math.floor(Math.random() * dest.length)];
    return 'teddy';
  }
  const owned = new Set(state.weapons.map(w => w.id));
  if (PAPST.slot) owned.add(PAPST.slot.id);                      // F2b: la que está en el Pack-a-Punch también es tuya
  if (MONKEY.count >= CONFIG.MONKEY.max) owned.add('monkey');    // F5.11: con los langostinos llenos no los ofrece
  const opts = B.pool.filter(id => !owned.has(id));
  // F5.11: por peso (la Ray Gun sale menos)
  const w = id => (B.weights && B.weights[id] !== undefined ? B.weights[id] : 1);
  let r = Math.random() * opts.reduce((s, id) => s + w(id), 0);
  for (const id of opts) { r -= w(id); if (r < 0) return id; }
  return opts[opts.length - 1];
}
// F sobre la caja: pagar (idle) o agarrar (ready)
function useBox() {
  if (BOX.phase === 'idle') {
    if (!spendPoints(CONFIG.BOX.cost)) return false;
    STATS.boxUses++;
    BOX.phase = 'rolling'; BOX.t = 0; BOX.nextCycle = 0;
    BOX.result = rollBoxResult();
    BOX.paid = CONFIG.BOX.cost;                                  // F5.16: el oso devuelve lo pagado
    return true;
  }
  if (BOX.phase === 'ready') {
    if (BOX.result === 'monkey') giveMonkeys();                  // F5.11: langostinos, no ocupan slot
    else { giveWeapon(BOX.result); raiseWeapon(); }
    BOX.phase = 'idle'; BOX.t = 0;
    boxShow(null);
    return true;
  }
  return false;
}
function updateBox(dt) {
  const B = CONFIG.BOX, S = B.size;
  BOX.t += dt;
  const t = BOX.t;
  if (BOX.beam) {                                                 // F5.17: el rayo late y se va mientras se muda
    BOX.beam.visible = BOX.phase !== 'moving' && BOX.phase !== 'teddy';
    BOX.beamMat.opacity = 0.45 + 0.12 * Math.sin(clock.elapsedTime * 2.4);
  }
  let lidTarget = 0, light = 0, dispY = S.h + 0.3;

  if (BOX.phase === 'rolling') {
    lidTarget = 1; light = B.lightIntensity;
    dispY = S.h + 0.3 + 0.55 * Math.min(1, t / 0.8);
    if (t >= B.rollTime) {
      boxShow(BOX.result);
      BOX.phase = BOX.result === 'teddy' ? 'teddy' : 'ready';
      BOX.t = 0;
      if (BOX.result === 'teddy') { sfxTeddy(); refundBox(); } else sfxBoxTick();
    } else if (t >= BOX.nextCycle) {
      sfxBoxTick();
      // armas rotando: intervalo crece con el tiempo (frena)
      const k = t / B.rollTime;
      BOX.nextCycle = t + B.cycleStart + (B.cycleEnd - B.cycleStart) * k * k;
      let id;
      do { id = B.pool[Math.floor(Math.random() * B.pool.length)]; } while (id === BOX.shown && B.pool.length > 1);
      boxShow(id);
    }
  } else if (BOX.phase === 'ready') {
    lidTarget = 1; light = B.lightIntensity;
    dispY = S.h + 0.85 - 0.55 * (t / B.grabTime);      // baja despacio: cuenta regresiva visual
    if (t >= B.grabTime) { BOX.phase = 'idle'; BOX.t = 0; boxShow(null); }
  } else if (BOX.phase === 'teddy') {
    lidTarget = 1; light = B.lightIntensity * 0.5;
    dispY = S.h + 0.85 + t * 0.6;                       // el oso sube y se va
    if (t >= B.teddyTime) { BOX.phase = 'moving'; BOX.t = 0; BOX.relocated = false; boxShow(null); }
  } else if (BOX.phase === 'moving') {
    // primera mitad se hunde, a la mitad se muda, segunda mitad sube en el cuarto nuevo
    const half = B.moveTime / 2;
    if (t < half) BOX.group.position.y = -(S.h + 0.1) * (t / half);
    else {
      if (!BOX.relocated) { placeBox(BOX.moveTo); updateFlowField(true); BOX.relocated = true; }
      BOX.group.position.y = -(S.h + 0.1) * Math.max(0, 1 - (t - half) / half);
    }
    if (t >= B.moveTime) { BOX.group.position.y = 0; BOX.phase = 'idle'; BOX.t = 0; BOX.moveTo = null; }
  }

  BOX.lidA += (lidTarget - BOX.lidA) * Math.min(1, dt * 6);
  BOX.lid.rotation.x = -1.9 * BOX.lidA;
  BOX.glow.visible = BOX.lidA > 0.05 && BOX.phase !== 'moving';
  BOX.glow.material.opacity = BOX.lidA;
  BOX.glow.quaternion.copy(camera.quaternion);          // billboard
  BOX.glow.quaternion.premultiply(_boxQ.copy(BOX.group.quaternion).invert());
  BOX.light.intensity = light * (0.9 + 0.1 * Math.sin(clock.elapsedTime * 13));
  BOX.disp.position.y = dispY;
  const spin = clock.elapsedTime * 2.2;
  for (const k in BOX.display) BOX.display[k].rotation.y = spin;
  BOX.teddy.rotation.y = spin * 0.5;
}
const _boxQ = new THREE.Quaternion();

//--- INTERACCIÓN [F]: lo más cercano dentro de ECONOMY.interactRange ---
// Puertas: distancia al borde del bloque (se compra desde cualquier lado).
// Wall buys: distancia al punto y además estar en SU cuarto (no se compra a través de la pared).
const interactState = { kind: null, target: null };
function updateInteract() {
  const R = CONFIG.ECONOMY.interactRange, px = player.pos.x, pz = player.pos.z;
  let kind = null, target = null, bd = R;
  // F5.6: arriba del techo solo se usa lo que está arriba (la pared del doble cañón). Antes, parado en el techo
  // de la sala se podía comprar una puerta de abajo
  const lvl = playerLevel(), room = roomAt(px, pz);
  for (const wb of WALLBUYS) {
    if (!room || room.id !== wb.room || (wb.level || 0) !== lvl) continue;
    const dist = Math.hypot(px - wb.mx, pz - wb.mz);
    if (dist < bd) { bd = dist; kind = 'wall'; target = wb; }
  }
  // F5.5: piezas de la Ola Rompiente en el piso (desde su cuarto y su nivel, al punto: la cuerda puede caer arriba)
  for (const p of questPieces()) {
    if (!room || room.id !== p.room || lvl !== p.level) continue;
    const dist = Math.hypot(px - p.x, pz - p.z);
    if (dist < bd) { bd = dist; kind = 'qpiece'; target = p; }
  }
  // F2: máquinas de perks (desde su cuarto y su nivel; F5.8: Juggernog está en el techo)
  for (const k in PERKM.machines) {
    const m = PERKM.machines[k];
    if (m.gone || !room || room.id !== m.room || m.level !== lvl) continue;
    const dist = colDist(m.col, px, pz);
    if (dist < bd) { bd = dist; kind = 'perk'; target = m; }
  }
  // F5.13: el Pack-a-Punch (arriba del templo) y la mesa del escudo (en la pasarela) miran su nivel
  if (RELICS.pap && room && room.id === RELICS.pap.room && RELICS.pap.level === lvl) {
    const dist = colDist(RELICS.pap.col, px, pz);
    if (dist < bd) { bd = dist; kind = 'pap'; target = RELICS.pap; }
  }
  if (SHIELDST.bench && room && room.id === SHIELDST.bench.room && (SHIELDST.bench.level || 0) === lvl) {
    const dist = colDist(SHIELDST.bench.col, px, pz);
    if (dist < bd) { bd = dist; kind = 'bench'; target = SHIELDST.bench; }
  }
  if (lvl === 1) { interactState.kind = kind; interactState.target = target; return; }
  for (const id in state.doors) {
    const d = state.doors[id];
    if (d.open) continue;
    const c = d.collider;
    const dx = Math.max(c.minX - px, 0, px - c.maxX), dz = Math.max(c.minZ - pz, 0, pz - c.maxZ);
    const dist = Math.hypot(dx, dz);
    if (dist < bd) { bd = dist; kind = 'door'; target = d; }
  }
  // caja: solo pagable (idle) o agarrable (ready), y desde su cuarto
  if ((BOX.phase === 'idle' || BOX.phase === 'ready') && room && room.id === BOX.room) {
    const c = BOX.collider;
    const dist = Math.hypot(Math.max(c.minX - px, 0, px - c.maxX), Math.max(c.minZ - pz, 0, pz - c.maxZ));
    if (dist < bd) { bd = dist; kind = 'box'; target = BOX; }
  }
  // F2.5: generador apagado (cartel: se prende con el cuchillo) y Pack-a-Punch (cartel de estado)
  for (const k in RELICS.gens) {
    const g = RELICS.gens[k];
    if (state.generators[k] || !room || room.id !== g.room) continue;
    const dist = colDist(g.col, px, pz);
    if (dist < bd) { bd = dist; kind = 'gen'; target = g; }
  }
  // F2: la palanca del power (hasta que se prende)
  // F3a: piezas del escudo (desde su cuarto, al punto) y el banco de trabajo
  for (const k of SHIELD_PARTS) {
    const sp = SHIELDST.spot[k];
    if (!sp || state.shield.parts[k] || state.shield.built || !room || room.id !== sp.room) continue;
    const dist = Math.hypot(px - sp.x, pz - sp.z);
    if (dist < bd) { bd = dist; kind = 'part'; target = { key: k }; }
  }
  // F5.5: el taller de tablas (F5.6: en el jardín oeste)
  if (QUEST.shop && room && room.id === QUEST.shop.room) {
    const dist = colDist(QUEST.shop.col, px, pz);
    if (dist < bd) { bd = dist; kind = 'workshop'; target = QUEST.shop; }
  }
  if (!state.power && PERKM.power && room && room.id === PERKM.power.room) {
    const dist = colDist(PERKM.power.col, px, pz);
    if (dist < bd) { bd = dist; kind = 'power'; target = PERKM.power; }
  }
  const tr = trapNear(room, px, pz, bd);                          // F5.9: palancas de las trampas
  if (tr) { bd = tr.dist; kind = 'trap'; target = tr.target; }
  const ht = hatchNear(room, px, pz, bd);                         // F5.11: escotilla (arriba) o su escalera (abajo)
  if (ht) { bd = ht.dist; kind = 'hatch'; target = ht.target; }
  const pt = portalNear(room, px, pz, bd);                        // F5.16: portal Templo ↔ Calamar
  if (pt) { bd = pt.dist; kind = 'portal'; target = pt.target; }
  const cl = clamNear(room, px, pz, bd);                          // F5.14: fumigador y almejas
  if (cl) { bd = cl.dist; kind = cl.kind; target = cl.target; }
  interactState.kind = kind; interactState.target = target;
}
function interact() {
  const it = interactState;
  if (!it.kind || !state.running) return false;
  // el generador no se usa con F (va con el cuchillo)
  if (it.kind === 'gen') { sfxDeny(); denyPrompt(); return false; }
  if (it.kind === 'part') return pickPart(it.target.key);        // F3a: suenan solos
  if (it.kind === 'bench') return benchPress();
  if (it.kind === 'qpiece') return pickQuestPiece(it.target);   // F5.5
  if (it.kind === 'workshop') return workshopPress();
  if (it.kind === 'fumigator' || it.kind === 'clam') {             // F5.14: la almeja se abre manteniendo F (updateClams)
    const ok = clamPress(it); if (!ok) { sfxDeny(); denyPrompt(); } return ok;
  }
  if (it.kind === 'hatch') { const ok = useHatch(it.target); if (!ok) { sfxDeny(); denyPrompt(); } return ok; }   // F5.11
  if (it.kind === 'portal') { const ok = usePortal(it.target); if (!ok) { sfxDeny(); denyPrompt(); } return ok; }  // F5.16
  const ok = it.kind === 'door' ? buyDoor(it.target.id)
           : it.kind === 'pap'  ? usePap()
           : it.kind === 'box'  ? useBox()
           : it.kind === 'perk' ? buyPerk(it.target.key)
           : it.kind === 'power' ? turnOnPower()
           : it.kind === 'trap' ? useTrap(it.target)
           : buyWallWeapon(it.target);
  if (ok) sfxBuy(); else { sfxDeny(); denyPrompt(); }
  updateInteract();
  return ok;
}
function openDoor(id) {
  const d = state.doors[id];
  if (!d || d.open) return;
  d.open = true;
  d.collider.solid = false;
  scene.remove(d.mesh);
  const i = WORLD.hitMeshes.indexOf(d.mesh);
  if (i >= 0) WORLD.hitMeshes.splice(i, 1);
  // marcas de bala que estaban sobre la puerta quedarían flotando
  const c = d.collider;
  decals.pool.forEach(m => {
    const p = m.position;
    if (p.x > c.minX - 0.1 && p.x < c.maxX + 0.1 && p.z > c.minZ - 0.1 && p.z < c.maxZ + 0.1) m.visible = false;
  });
  if (id === 'H8') beachWall(false);                             // F5.17b: con el sendero del calamar se abre la playa
  buildNavGrid();
  updateFlowField(true);
}
function closeDoor(id) {
  const d = state.doors[id];
  if (!d || !d.open) return;
  d.open = false;
  d.collider.solid = true;
  scene.add(d.mesh);
  if (WORLD.hitMeshes.indexOf(d.mesh) < 0) WORLD.hitMeshes.push(d.mesh);
  if (id === 'H8') beachWall(true);
}
// F5.17b: el cerco entre la playa oeste y la costa del calamar (x -41) se va cuando se compra H8
function beachWall(on) {
  const W = WORLD.beachWall;
  if (!W) return;
  W.col.solid = on;
  const i = WORLD.hitMeshes.indexOf(W.mesh);
  if (on) { scene.add(W.mesh); if (i < 0) WORLD.hitMeshes.push(W.mesh); W.mesh.position.y = W.y0; W.mesh.material.color.setHex(0xffffff); }
  else { scene.remove(W.mesh); if (i >= 0) WORLD.hitMeshes.splice(i, 1); }
}
function closeAllDoors() {
  Object.keys(state.doors).forEach(closeDoor);
  buildNavGrid();
}
function debugOpenAllDoors() { Object.keys(state.doors).forEach(openDoor); }

