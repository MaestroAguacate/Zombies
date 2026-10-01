//=== 7g. TRAMPAS (V2 F5.9) =================================================
// Dos trampas con palanca (CONFIG.TRAPS). La palanca se usa con F desde su cuarto, al punto (sin collider: no
// toca el grid ni frena balas). Estado: 'idle' -> 'on' (time s) -> 'cool' (cooldown s) -> 'idle'.
//  - Tiburón (muelle): salta de un costado al otro del tronco, cada salto a la z de un zombie del muelle (o al
//    azar). Mientras cruza por encima de las tablas se come a lo que toque (radius). Al jugador le saca
//    playerDamage una vez por salto.
//  - Cortadora (jardín oeste): da vueltas en un círculo delante del taller. Mata lo que toca (hitRadius) y al
//    jugador le saca playerDamage cada playerCd s.
// Matan con damageZombie(..., killPoints 0, hitPoints 0): sin puntos, cuentan para la ronda y las almas.
// Al boss no le hacen nada. Modelos construidos una vez; ocultos cuando la trampa no anda.
//  - Tortugas (F5.10, rancho): salen del corral y cada una se come al zombie más cercano. No te hacen nada.
const TRAPS = { shark: null, mower: null, turtles: null };

function buildTraps() {
  const T = CONFIG.TRAPS;
  const sg = sharkMesh();
  sg.visible = false; scene.add(sg);
  TRAPS.shark = { key: 'shark', cfg: T.shark, g: sg, phase: 'idle', t: 0, jumpT: 0, dir: 1, jz: 0, hitP: false,
                  lever: buildLever(T.shark) };
  // cortadora: carcasa roja, motor, manija y ruedas (mira a +x)
  const mg = new THREE.Group(), mb = new MeshBuilder();
  mb.box(0, 0.25, 0, 0.9, 0.24, 0.7, 0xc8322a);
  mb.box(0.05, 0.47, 0, 0.36, 0.22, 0.32, 0x2a2a2e);                       // motor
  mb.box(0.05, 0.6, 0, 0.2, 0.06, 0.2, 0x8a8a90);
  for (const [x, z] of [[-0.36, 0.36], [-0.36, -0.36], [0.36, 0.36], [0.36, -0.36]]) mb.box(x, 0.12, z, 0.22, 0.22, 0.08, 0x1a1a1a);
  mb.box(-0.62, 0.62, 0.22, 0.05, 0.8, 0.05, 0x9a9aa0, 0, 0, 0.7);         // manija
  mb.box(-0.62, 0.62, -0.22, 0.05, 0.8, 0.05, 0x9a9aa0, 0, 0, 0.7);
  mb.box(-0.9, 0.92, 0, 0.05, 0.05, 0.5, 0x2a2a2e);
  mb.box(0, 0.14, 0, 0.85, 0.02, 0.65, 0x8a8a90);                          // cuchilla (abajo)
  const mm = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.remove(mm); mm.matrixAutoUpdate = true; mm.userData.theme = false; mg.add(mm);
  mg.visible = false; scene.add(mg);
  TRAPS.mower = { key: 'mower', cfg: T.mower, g: mg, phase: 'idle', t: 0, a: 0, hitCd: 0, tickT: 0,
                  lever: buildLever(T.mower) };
  // F5.10: tortugas (pool fijo): caparazón, cabeza que muerde y 4 aletas que caminan
  const list = [];
  for (let i = 0; i < T.turtles.count; i++) {
    const tu = makeTurtle(i % 2 ? 0x4a6a3a : 0x5a5a2a);
    tu.g.scale.setScalar(T.turtles.scale); scene.add(tu.g);
    list.push(tu);
  }
  TRAPS.turtles = { key: 'turtles', cfg: T.turtles, g: { visible: false }, list, phase: 'idle', t: 0,
                    lever: buildLever(T.turtles) };
  // F5.19: tortuga mariachi (da vueltas y atrae a todos) y mini tortugas que salen de los charcos del claro
  const MC = T.mariachi, minis = [], mcfg = Object.assign({}, MC.minis, { center: MC.center });
  for (let i = 0; i < MC.minis.count; i++) {
    const tu = makeTurtle([0x3a6a2a, 0x2a5a3a, 0x4a7a2a][i % 3], true);
    tu.g.scale.setScalar(MC.minis.scale); scene.add(tu.g);
    tu.home = { x: MC.puddles[i % MC.puddles.length][0], z: MC.puddles[i % MC.puddles.length][1] };
    minis.push(tu);
  }
  const mz = buildMariachi();
  mz.g.scale.setScalar(MC.scale); mz.g.visible = false; scene.add(mz.g);
  TRAPS.mariachi = { key: 'mariachi', cfg: MC, g: mz.g, parts: mz, phase: 'idle', t: 0, a: 0, x: MC.center.x, z: MC.center.z,
                     minis: { cfg: mcfg, list: minis, phase: 'idle' }, lever: buildLever(MC) };
}
// F5.10: una tortuga de cubos (caparazón, cabeza que muerde y 4 aletas). Sin agregar a la escena
// F5.19: glow = manchas de sangre verde que brillan (las mini tortugas de los charcos del claro)
function makeTurtle(shellC, glow) {
  const g = new THREE.Group(), body = new MeshBuilder();
  body.box(0, 0.28, 0, 0.8, 0.3, 1.0, shellC);
  body.box(0, 0.45, 0, 0.6, 0.12, 0.8, shellC);
  for (let k = 0; k < 4; k++) body.box((k % 2 ? 0.16 : -0.16), 0.52, (k < 2 ? 0.18 : -0.18), 0.22, 0.04, 0.26, 0x3a4a2a);
  body.box(0, 0.16, 0, 0.76, 0.06, 0.96, 0xc8b878);                       // panza
  body.box(0, 0.24, -0.55, 0.14, 0.1, 0.2, 0x6a8a5a);                     // cola
  const bm = body.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.remove(bm); bm.matrixAutoUpdate = true; bm.userData.theme = false; g.add(bm);
  if (glow) {
    const gb = new MeshBuilder();
    for (const [x, z, w] of [[0.2, 0.25, 0.22], [-0.18, -0.2, 0.28], [0.05, -0.05, 0.16], [-0.28, 0.3, 0.12]]) gb.box(x, 0.525, z, w, 0.02, w * 0.8, 0x8aff5a);
    gb.box(0, 0.09, 0.2, 0.5, 0.02, 0.3, 0x8aff5a);                        // chorrea por abajo
    const gm = gb.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
    scene.remove(gm); gm.matrixAutoUpdate = true; gm.userData.theme = false; g.add(gm);
  }
  const head = new THREE.Group(); head.position.set(0, 0.3, 0.5); g.add(head);
  const hb = new MeshBuilder();
  hb.box(0, 0, 0.14, 0.26, 0.22, 0.3, 0x6a8a5a);
  hb.box(-0.1, 0.05, 0.25, 0.05, 0.05, 0.02, glow ? 0xc8ff4a : 0x101010); hb.box(0.1, 0.05, 0.25, 0.05, 0.05, 0.02, glow ? 0xc8ff4a : 0x101010);
  hb.box(0, -0.06, 0.29, 0.2, 0.03, 0.02, 0x3a2a1a);                      // pico
  const hm = hb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.remove(hm); hm.matrixAutoUpdate = true; hm.userData.theme = false; head.add(hm);
  const flip = [];
  for (const [x, z] of [[-0.42, 0.3], [0.42, 0.3], [-0.38, -0.32], [0.38, -0.32]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.2), new THREE.MeshLambertMaterial({ color: 0x6a8a5a }));
    f.position.set(x, 0.15, z); g.add(f); flip.push(f);
  }
  g.visible = false;
  return { g, head, flip, px: 0, pz: 0, level: 0, state: 'off', target: null, t: 0, wait: 0, walk: 0, stuck: 0, rise: 0, rise0: 1 };
}
// F5.19 (Diego: "una tortuga pequeña con un sombrero de mariachi"): la tortuga de siempre, chica, en cuatro patas, con un
// sombrero de charro enorme (ala negra con ribete y bordado dorados) sobre la cabeza, moño rojo y una guitarrita
// colgada del caparazón. Camina moviendo las aletas y cabecea con el sombrero
function buildMariachi() {
  const tu = makeTurtle(0x3e6a2e), gold = 0xe8c040, black = 0x1a1a1e;
  const hat = new THREE.Group(); hat.position.set(0, 0.2, 0.12); tu.head.add(hat);
  const hb = new MeshBuilder();
  hb.cyl(0, 0, 0, 0.62, 0.035, black, 1, 20);                                          // ala ancha
  hb.cyl(0, 0.035, 0, 0.62, 0.01, gold, 0.97, 20);                                     // ribete
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; hb.box(Math.cos(a) * 0.45, 0.047, Math.sin(a) * 0.45, 0.07, 0.01, 0.07, gold, 0, a, 0); }   // bordado
  hb.cyl(0, 0.03, 0, 0.19, 0.32, black, 0.72, 14);                                     // copa
  hb.cyl(0, 0.07, 0, 0.2, 0.06, gold, 0.95, 14);                                       // cinta
  hb.sphere(0, 0.35, 0, 0.14, 0.06, 0.14, black, 10);
  const hm = hb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.remove(hm); hm.matrixAutoUpdate = true; hm.userData.theme = false; hat.add(hm);
  const db = new MeshBuilder();
  db.box(0, 0.26, 0.5, 0.26, 0.08, 0.05, 0xc82020); db.box(0, 0.26, 0.53, 0.07, 0.07, 0.03, 0x8a1010);   // moño
  db.box(0.18, 0.62, -0.12, 0.34, 0.08, 0.42, 0xc07a30, 0, 0.3, 0.2);                  // guitarrita en el caparazón
  db.box(0.18, 0.665, -0.1, 0.1, 0.01, 0.1, 0x1a0e06, 0, 0.3, 0.2);
  db.box(0.05, 0.64, -0.46, 0.06, 0.05, 0.36, 0x6a4020, 0, 0.3, 0.2);
  for (const s of [-1, 1]) db.box(s * 0.36, 0.3, 0.1, 0.02, 0.05, 0.5, gold);             // ribetes dorados del caparazón
  const dm = db.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.remove(dm); dm.matrixAutoUpdate = true; dm.userData.theme = false; tu.g.add(dm);
  tu.g.visible = true;
  return { g: tu.g, head: tu.head, hat, flip: tu.flip, walk: 0 };
}
// tiburón: cuerpo gris, panza blanca, aleta, cola y dientes (un MeshBuilder en un grupo, mira a +x). F5.19: también lo
// usan los tiburones del río del templo (garden.js)
function sharkMesh() {
  const sg = new THREE.Group(), sb = new MeshBuilder();
  sb.box(0, 0, 0, 2.2, 0.62, 0.62, 0x6a7a88);
  sb.box(0.1, -0.2, 0, 2.0, 0.22, 0.56, 0xe8e8e0);
  sb.box(1.25, 0, 0, 0.4, 0.44, 0.46, 0x6a7a88);                           // hocico
  sb.box(1.2, -0.12, 0, 0.36, 0.1, 0.42, 0x3a1010);                        // boca
  for (let i = 0; i < 5; i++) sb.box(1.05 + i * 0.07, -0.08, 0.2, 0.04, 0.08, 0.02, 0xffffff);
  for (let i = 0; i < 5; i++) sb.box(1.05 + i * 0.07, -0.08, -0.2, 0.04, 0.08, 0.02, 0xffffff);
  sb.box(1.1, 0.12, 0.24, 0.08, 0.08, 0.02, 0x0a0a0a); sb.box(1.1, 0.12, -0.24, 0.08, 0.08, 0.02, 0x0a0a0a);
  sb.box(0.1, 0.52, 0, 0.5, 0.6, 0.08, 0x5a6a78, 0, 0, -0.4);              // aleta
  sb.box(-1.3, 0.2, 0, 0.3, 0.8, 0.1, 0x5a6a78, 0, 0, 0.5);                // cola
  sb.box(-1.3, -0.25, 0, 0.3, 0.5, 0.1, 0x5a6a78, 0, 0, -0.5);
  sb.box(0.3, -0.2, 0.36, 0.5, 0.06, 0.3, 0x5a6a78, 0.3, 0, 0);            // aletas del costado
  sb.box(0.3, -0.2, -0.36, 0.5, 0.06, 0.3, 0x5a6a78, -0.3, 0, 0);
  const sm = sb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.remove(sm); sm.matrixAutoUpdate = true; sm.userData.theme = false; sg.add(sm);
  return sg;
}
// palanca: poste con caja y una manija que baja al usarla. Luz MeshBasic: verde lista, roja andando/esperando
function buildLever(C) {
  const g = new THREE.Group(), mb = new MeshBuilder();
  mb.box(0, 0.55, 0, 0.12, 1.1, 0.12, 0x4a4a50);
  mb.box(0, 1.15, 0, 0.3, 0.3, 0.2, 0x5a5a60);
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.remove(m); m.matrixAutoUpdate = true; m.userData.theme = false; g.add(m);
  const arm = new THREE.Group(); arm.position.set(0, 1.15, 0.1);
  const stick = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.05), new THREE.MeshLambertMaterial({ color: 0x9a9aa0 }));
  stick.position.y = 0.18; arm.add(stick);
  const knob = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshLambertMaterial({ color: 0xd8322a }));
  knob.position.y = 0.38; arm.add(knob);
  arm.rotation.x = -0.6; g.add(arm);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), new THREE.MeshBasicMaterial({ color: 0x3aff5a }));
  lamp.position.set(0, 1.22, 0.105); g.add(lamp);
  g.position.set(C.lever.x, groundY(C.lever.x, C.lever.z), C.lever.z);
  scene.add(g);
  return { g, arm, lamp, x: C.lever.x, z: C.lever.z, room: C.room };
}

// para updateInteract: la palanca más cercana de tu cuarto
function trapNear(room, px, pz, bd) {
  let best = null;
  for (const k in TRAPS) {
    const T = TRAPS[k];
    if (!T || !room || room.id !== T.lever.room) continue;
    const d = Math.hypot(px - T.lever.x, pz - T.lever.z);
    if (d < bd) { bd = d; best = T; }
  }
  return best ? { target: best, dist: bd } : null;
}
function trapPrompt(T) {
  const C = T.cfg;
  if (T.phase === 'on') return { text: C.name + ' - running', cost: 0 };
  if (T.phase === 'cool') return { text: C.name + ' - recharging (' + Math.ceil(T.t) + ' s)', cost: 0 };
  return { text: '[F] Activate ' + C.name, cost: C.cost };
}
function useTrap(T) {
  if (T.phase !== 'idle' || !spendPoints(T.cfg.cost)) return false;
  T.phase = 'on'; T.t = T.cfg.time;
  if (T.key === 'shark') { T.jumpT = 0; T.dir = Math.random() < 0.5 ? 1 : -1; }
  else if (T.key === 'turtles') T.list.forEach((tu, i) => { tu.state = 'wait'; tu.wait = i * T.cfg.stagger; tu.target = null; });
  else if (T.key === 'mariachi') {                                 // F5.19
    T.a = 0; T.x = T.cfg.center.x + T.cfg.radius; T.z = T.cfg.center.z;
    T.minis.list.forEach((tu, i) => { tu.state = 'wait'; tu.wait = i * T.minis.cfg.stagger; tu.target = null; });
  }
  else { T.a = 0; T.hitCd = 0; T.tickT = 0; }
  T.g.visible = T.key === 'mower' || T.key === 'mariachi';
  sfxLever();
  // F5.19: voces del personaje (el tiburón; las tortugas, la segunda vez que las comprás)
  T.uses = (T.uses || 0) + 1;
  if (T.key === 'shark') voice('audio_al_comprar_el_tiburon', 1, 0);
  if (T.key === 'turtles' && T.uses === 2) voice('audio_al_comprar_las_tortugas_por_segunda_vez', 1, 0);
  return true;
}
// mata al zombie (sin puntos). Al boss no
function trapKill(z) {
  if (!z.alive || z.boss) return false;
  damageZombie(z, z.health + 1, false, 0, 0);
  return true;
}

function updateTraps(dt) {
  for (const k in TRAPS) {
    const T = TRAPS[k];
    if (!T) continue;
    if (k === 'turtles') updateTurtles(T, dt);                    // (también en 'cool': vuelven al corral)
    if (k === 'mariachi') { T.minis.phase = T.phase; updateTurtles(T.minis, dt); }   // F5.19: vuelven a su charco
    if (T.phase === 'on') {
      T.t -= dt;
      if (k === 'shark') updateShark(T, dt); else if (k === 'mower') updateMower(T, dt); else if (k === 'mariachi') updateMariachi(T, dt);
      if (T.t <= 0) { T.phase = 'cool'; T.t = T.cfg.cooldown; T.g.visible = false; }
    } else if (T.phase === 'cool') {
      T.t -= dt;
      if (T.t <= 0) { T.phase = 'idle'; T.t = 0; }
    }
    T.lever.arm.rotation.x += ((T.phase === 'idle' ? -0.6 : 0.6) - T.lever.arm.rotation.x) * Math.min(1, dt * 10);
    T.lever.lamp.material.color.setHex(T.phase === 'idle' ? 0x3aff5a : 0xff3a2a);
  }
}
function updateShark(T, dt) {
  const C = T.cfg, Z = C.zone, P = player.pos;
  if (T.jumpT <= 0) {                                             // nuevo salto: a la z de un zombie del muelle
    const on = state.zombies.filter(z => z.alive && !z.boss && (z.level || 0) === 0 &&
      z.px > Z.x1 - 0.5 && z.px < Z.x2 + 0.5 && z.pz > Z.z1 && z.pz < Z.z2);
    const tz = on.length ? on[Math.floor(Math.random() * on.length)].pz : Z.z1 + Math.random() * (Z.z2 - Z.z1);
    T.jz = Math.max(Z.z1, Math.min(Z.z2, tz));
    T.dir = -T.dir; T.jumpT = C.jumpTime; T.hitP = false;
    T.g.visible = true;
    sfxSharkJump(Math.hypot(P.x - (Z.x1 + Z.x2) / 2, P.z - T.jz));
  }
  T.jumpT -= dt;
  const k = 1 - Math.max(0, T.jumpT) / C.jumpTime, cx = (Z.x1 + Z.x2) / 2;
  const x = cx - T.dir * C.side + T.dir * 2 * C.side * k, y = -0.8 + (C.peak + 0.8) * 4 * k * (1 - k);
  T.g.position.set(x, y, T.jz);
  T.g.rotation.set(0, T.dir > 0 ? 0 : Math.PI, (0.5 - k) * 1.6);  // sale con la nariz arriba, entra de cabeza
  // por arriba de las tablas: come
  if (x > Z.x1 - 0.3 && x < Z.x2 + 0.3) {
    for (const z of state.zombies) {
      if ((z.level || 0) === 0 && Math.hypot(z.px - x, z.pz - T.jz) < C.radius) trapKill(z);
    }
    if (!T.hitP && playerLevel() === 0 && Math.hypot(P.x - x, P.z - T.jz) < C.radius + CONFIG.PLAYER.radius) {
      T.hitP = true;
      damagePlayer(C.playerDamage, x, T.jz);
    }
  }
  if (T.jumpT <= 0) T.g.visible = false;
}
function updateMower(T, dt) {
  const C = T.cfg, P = player.pos;
  T.a += dt * Math.PI * 2 / C.lap;
  const x = C.center.x + Math.cos(T.a) * C.radius, z = C.center.z + Math.sin(T.a) * C.radius;
  T.g.position.set(x, groundY(x, z) + 0.02 * Math.sin(T.a * 40), z);
  T.g.rotation.y = -T.a - Math.PI / 2;                            // mira hacia donde avanza (tangente)
  for (const q of state.zombies) {
    if ((q.level || 0) === 0 && Math.hypot(q.px - x, q.pz - z) < C.hitRadius + (q.rad || CONFIG.ZOMBIE.radius)) trapKill(q);
  }
  T.hitCd = Math.max(0, T.hitCd - dt);
  if (T.hitCd <= 0 && playerLevel() === 0 && Math.hypot(P.x - x, P.z - z) < C.hitRadius + CONFIG.PLAYER.radius) {
    T.hitCd = C.playerCd;
    damagePlayer(C.playerDamage, x, z);
  }
  if ((T.tickT -= dt) <= 0) { T.tickT = 0.15; sfxMower(Math.hypot(P.x - x, P.z - z)); }
}
// F5.19: la tortuga mariachi da vueltas en el patio y el langostino-señuelo sale de ella (mariachiLure)
function updateMariachi(T, dt) {
  const C = T.cfg, M = T.parts, t = clock.elapsedTime;
  T.a += dt * Math.PI * 2 / C.lap;
  T.x = C.center.x + Math.cos(T.a) * C.radius; T.z = C.center.z + Math.sin(T.a) * C.radius;
  T.g.position.set(T.x, groundY(T.x, T.z) + Math.abs(Math.sin(t * 7)) * 0.06, T.z);
  T.g.rotation.set(0, -T.a, Math.sin(t * 3.5) * 0.08);            // mira hacia donde avanza (tangente) y se hamaca
  M.walk += dt * 9;
  const s = Math.sin(M.walk) * 0.5;
  M.flip[0].rotation.y = s; M.flip[3].rotation.y = s; M.flip[1].rotation.y = -s; M.flip[2].rotation.y = -s;
  M.head.rotation.x = Math.sin(t * 7) * 0.12;                     // cabecea al ritmo
  M.hat.rotation.z = Math.sin(t * 3.5) * 0.1;
}
function mariachiLure() {
  const T = TRAPS.mariachi;
  return T && T.phase === 'on' ? { x: T.x, z: T.z } : null;
}
// F5.10: tortugas. wait (escalonadas) -> go (al zombie más cercano) -> eat -> go ... -> home (al terminar) -> off
// F5.19: sirve también para las mini tortugas del claro: cada una con su casa (tu.home, el charco), `center` en vez
// de `exit` para el alcance y `rooms` en vez de `room`; salen del charco (rise s)
function turtlePrey(T, tu) {
  const C = T.cfg, O = C.center || C.exit, rooms = C.rooms || [C.room];
  let best = null, bd = Infinity;
  for (const z of state.zombies) {
    if (!z.alive || z.boss || (z.level || 0) !== 0) continue;
    if (Math.hypot(z.px - O.x, z.pz - O.z) > C.range) continue;
    if (T.list.some(o => o !== tu && o.target === z)) continue;     // una tortuga por zombie
    // del rancho, o del jardín con el lazo abierto (sin línea libre: el billar o un poste se rodean de costado)
    const r = roomAt(z.px, z.pz);
    if (!r || rooms.indexOf(r.id) < 0) continue;                      // F5.15: el rancho (con sus senderos)
    const d = Math.hypot(z.px - tu.px, z.pz - tu.pz);
    if (d < bd) { bd = d; best = z; }
  }
  return best;
}
function updateTurtles(T, dt) {
  const C = T.cfg, on = T.phase === 'on', t = clock.elapsedTime;
  T.list.forEach((tu, i) => {
    if (tu.state === 'off') return;
    const home = tu.home || C.exit;
    if (tu.state === 'wait') {
      if (!on) { tu.state = 'off'; return; }
      if ((tu.wait -= dt) > 0) return;
      tu.state = 'go'; tu.px = home.x; tu.pz = home.z; tu.g.visible = true; tu.stuck = 0; tu.heading = 0;
      tu.rise = tu.rise0 = C.rise || 0;                              // F5.19: sale del charco
    }
    if (!on && tu.state !== 'home') { tu.state = 'home'; tu.target = null; tu.stuck = 0; }
    if (tu.state === 'eat') {                                         // mastica
      tu.t -= dt;
      tu.head.position.z = 0.5 + 0.12 * Math.abs(Math.sin(tu.t * 24));
      if (tu.t <= 0) { tu.state = 'go'; tu.head.position.z = 0.5; }
      placeTurtle(tu, 0, dt);
      return;
    }
    let tx, tz;
    if (tu.state === 'home') {
      tx = home.x; tz = home.z;
      if (Math.hypot(tx - tu.px, tz - tu.pz) < 0.4 || tu.stuck > 3) { tu.state = 'off'; tu.g.visible = false; return; }
    } else {
      if (!tu.target || !tu.target.alive || tu.stuck > 3) { tu.target = turtlePrey(T, tu); tu.stuck = 0; }
      const z = tu.target;
      if (z) {
        tx = z.px; tz = z.pz;
        if (Math.hypot(tx - tu.px, tz - tu.pz) < C.reach + CONFIG.ZOMBIE.radius) {
          // F5.11: hasta biteRound matan de una; después cada mordisco saca la vida de un zombie de esa ronda
          // F5.19c (Diego): las mini tortugas, después de biteRound, sacan biteFrac de la vida máxima por mordisco
          if (state.round <= C.biteRound) trapKill(z);
          else damageZombie(z, C.biteFrac ? z.maxHealth * C.biteFrac : CONFIG.ZOMBIE.health(C.biteRound), false, 0, 0);
          tu.state = 'eat'; tu.t = C.eat; tu.target = z.alive ? z : null;   // si sigue vivo, lo vuelve a morder
          if (!z.alive) voice('audio_cuando_una_tortuga_se_coma_a_un_zombie', 0.4, 15);   // F5.19
          sfxPlantBite(Math.hypot(player.pos.x - tu.px, player.pos.z - tu.pz));
          placeTurtle(tu, 0, dt);
          return;
        }
      } else {                                                        // sin presa: da vueltas cerca de la salida
        tx = home.x + 2 + 1.5 * Math.cos(t * 0.7 + i); tz = home.z + 2.5 + 1.5 * Math.sin(t * 0.7 + i);
      }
    }
    const dx = tx - tu.px, dz = tz - tu.pz, d = Math.hypot(dx, dz);
    let v = 0;
    if (d > 0.05) {
      const step = Math.min(d, C.speed * dt), ox = tu.px, oz = tu.pz;
      let mx = dx / d, mz = dz / d;
      // trabada contra algo (billar, poste, barra): camina de costado un rato y vuelve a intentar
      if (tu.sideT > 0) { tu.sideT -= dt; const s = tu.side; [mx, mz] = [mx * 0.3 - mz * s, mz * 0.3 + mx * s]; }
      moveCircle(tu, 'x', mx * step, C.radius);
      moveCircle(tu, 'z', mz * step, C.radius);
      const moved = Math.hypot(tu.px - ox, tu.pz - oz);
      tu.stuck = moved < step * 0.3 ? tu.stuck + dt : 0;
      if (tu.stuck > 0.3 && !(tu.sideT > 0)) { tu.sideT = 0.8; tu.side = Math.random() < 0.5 ? 1 : -1; }
      v = moved / Math.max(dt, 1e-4);
      tu.heading = lerpAngle(tu.heading || 0, Math.atan2(dx, dz), Math.min(1, dt * 10));
    }
    placeTurtle(tu, v, dt);
  });
}
function placeTurtle(tu, v, dt) {
  tu.walk += (4 + v * 3) * dt;
  if (tu.rise > 0) tu.rise = Math.max(0, tu.rise - dt);            // F5.19: sale del charco (de abajo)
  tu.g.position.set(tu.px, groundY(tu.px, tu.pz) - (tu.rise > 0 ? 0.5 * tu.rise / tu.rise0 : 0), tu.pz);
  tu.g.rotation.y = tu.heading || 0;
  const s = Math.sin(tu.walk * 3) * Math.min(1, v / 1.5) * 0.6;
  tu.flip[0].rotation.y = s; tu.flip[3].rotation.y = s; tu.flip[1].rotation.y = -s; tu.flip[2].rotation.y = -s;
}
function resetTraps() {
  if (TRAPS.turtles) for (const tu of TRAPS.turtles.list) { tu.state = 'off'; tu.target = null; tu.g.visible = false; }
  if (TRAPS.mariachi) for (const tu of TRAPS.mariachi.minis.list) { tu.state = 'off'; tu.target = null; tu.g.visible = false; tu.rise = 0; }
  for (const k in TRAPS) {
    const T = TRAPS[k];
    if (!T) continue;
    T.phase = 'idle'; T.t = 0; T.g.visible = false; T.lever.arm.rotation.x = -0.6; T.uses = 0;
    T.lever.lamp.material.color.setHex(0x3aff5a);
  }
}
