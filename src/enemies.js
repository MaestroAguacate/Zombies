//=== 5b. ENEMIGOS (V2 F4) =================================================
// Ahogado (sale del mar), arrastrado (piernas rotas), perros (F5.7: perros infernales; antes poodles y chihuahuas)
// y la noche de la ronda de perros. Todo se construye una vez: pool de perros, 1 THREE.Points de gotas.
// Ninguna luz nueva: la noche y los relámpagos cambian color/intensity de las que ya existen.
// Los perros son objetos con la MISMA forma que un zombie (root, body, head, armL/armR = patas de adelante,
// legL/legR = patas de atrás, hitParts...) y viven en state.zombies: usan el mismo flow field, IA y daño.
const DPOOL = [];
const DRIPS = { points: null, pos: null, vy: null, life: null, floor: null, n: 0, t: 0 };
const NIGHT = { k: 0, target: 0, flash: 0, dirty: false, base: null, night: null,
                p: 0, pTarget: 0, purple: null, rain: false, storm: null, thunderT: 0 };   // F5.9: clima

//--- ahogado ---
function wantDrowned() {
  const D = CONFIG.DROWNED, r = roomAt(player.pos.x, player.pos.z);
  return state.round >= D.fromRound && !!r && D.rooms.includes(r.id) && Math.random() < D.chance;
}
// gotas: 1 THREE.Points con un pool fijo; cada ahogado suelta una cada dripEvery
function buildDrips() {
  const D = CONFIG.DROWNED, n = D.drips, g = new THREE.BufferGeometry();
  DRIPS.pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) DRIPS.pos[i * 3 + 1] = -100;
  g.setAttribute('position', new THREE.BufferAttribute(DRIPS.pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: D.dripColor, size: 0.07, transparent: true, opacity: 0.85, depthWrite: false }));
  p.frustumCulled = false; p.visible = false;
  scene.add(p);
  DRIPS.points = p; DRIPS.n = n;
  DRIPS.vy = new Float32Array(n); DRIPS.life = new Float32Array(n); DRIPS.floor = new Float32Array(n);
}
function updateDrips(dt) {
  const D = CONFIG.DROWNED, P = DRIPS;
  if (!P.points) return;
  P.t -= dt;
  if (P.t <= 0) {
    P.t = D.dripEvery;
    let i = 0;
    for (const z of state.zombies) {
      if (z.kind !== 'drowned' || !z.alive || z.state === 'emerge') continue;
      while (i < P.n && P.life[i] > 0) i++;
      if (i >= P.n) break;
      const fl = z.root.position.y;
      P.pos[i * 3] = z.px + (Math.random() - 0.5) * 0.4;
      P.pos[i * 3 + 1] = fl + (z.crawl ? 0.3 : 0.6 + Math.random() * 0.9);
      P.pos[i * 3 + 2] = z.pz + (Math.random() - 0.5) * 0.4;
      P.vy[i] = -D.dripSpeed; P.life[i] = 1.5; P.floor[i] = fl;
    }
  }
  let any = false;
  for (let i = 0; i < P.n; i++) {
    if (P.life[i] <= 0) continue;
    P.life[i] -= dt; P.vy[i] -= 9.8 * dt;
    let y = P.pos[i * 3 + 1] + P.vy[i] * dt;
    if (y <= P.floor[i] + 0.02 || P.life[i] <= 0) { P.life[i] = 0; y = -100; } else any = true;
    P.pos[i * 3 + 1] = y;
  }
  P.points.visible = any;
  P.points.geometry.attributes.position.needsUpdate = true;
}

//--- arrastrado ---
function startCrawl(z) {
  z.crawl = true;
  loseLeg(z);                                            // F7b: la pierna sale volando
  setCrawlLeg(z);
  z.speed = Math.min(z.speed, CONFIG.CRAWLER.speed);
  z.swingT = 0;
}
// acostado boca abajo (el cuerpo se inclina hacia adelante y se corre atrás, así la lógica queda en el medio),
// brazos adelante alternados; el zarpazo levanta un brazo
function animateCrawl(z, dt, v) {
  const C = CONFIG.CRAWLER, k = Math.min(1, v / 0.6);
  z.walkT += dt * (3 + v * 3);
  const s = Math.sin(z.walkT);
  z.body.rotation.set(1.4, 0, s * 0.06 * k);
  z.body.position.set(0, C.lift, -C.back);
  let a = -Math.PI + 0.25;
  if (z.swingT > 0) {
    z.swingT -= dt;
    a += Math.sin(Math.PI * (1 - Math.max(0, z.swingT) / 0.35)) * 0.6;
  }
  z.armL.rotation.x = a + s * 0.45 * k;
  z.armR.rotation.x = a - s * 0.45 * k;
  z.legL.rotation.x = 0.1 + Math.max(0, s) * 0.2 * k;
}

//--- perros ---
// F5.7 (pedido de Diego: que den miedo): perros infernales ~1.6× más grandes. Flacos, costillas a la vista,
// carne expuesta, lomo con púas, hocico largo abierto y ensangrentado, orejas rotas, ojos rojos que brillan
// (MeshBasic: sin luces). Dos pelajes: 'negro' y 'sarnoso'. Cuerpo, cabeza y 4 patas son partes que se mueven y
// reciben balas; los detalles van fusionados en un MeshBuilder por parte, y los ojos aparte (9 draw calls)
const HOUND_FUR = { negro: 0x1c1512, sarnoso: 0x3b312a }, HOUND_BONE = 0xc9bb9c, HOUND_FLESH = 0x7a1a14,
      HOUND_BLOOD = 0x4a0404, HOUND_GUM = 0x5a1010, HOUND_TOOTH = 0xe8e0c8;
let HOUND_EYE = null;
function dogDetail(mb, parent, mat) {
  const m = mb.mesh(mat);
  scene.remove(m);
  m.userData.theme = false; m.matrixAutoUpdate = true;
  parent.add(m);
  return m;
}
function createDog(i, breed) {
  const D = CONFIG.DOGS, furC = HOUND_FUR[breed];
  const fur = new THREE.MeshLambertMaterial({ color: furC });       // propio: flash de impacto
  const det = new THREE.MeshLambertMaterial({ vertexColors: true });
  if (!HOUND_EYE) HOUND_EYE = new THREE.MeshBasicMaterial({ color: 0xff2a10 });
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  // ~1.6× el poodle de F4. La cabeza va baja y adelante (postura de ataque)
  const L = 0.62, bw = 0.4, bh = 0.4, bl = 1.0;
  const by = L + bh / 2, hs = 0.34, hy = by + 0.02, hz = bl / 2 + 0.2;
  const lw = 0.12, lx = bw / 2 - lw / 2, lz = bl / 2 - lw / 2 - 0.04;
  const torso = zPart(bw, bh, bl, fur, 0, by, 0, body);
  const fl = zPart(lw, L, lw, fur, -lx, L, lz, body, true), fr = zPart(lw, L, lw, fur, lx, L, lz, body, true);
  const bL = zPart(lw, L, lw, fur, -lx, L, -lz, body, true), bR = zPart(lw, L, lw, fur, lx, L, -lz, body, true);
  const head = zPart(hs, hs, hs, fur, 0, hy, hz, body);

  const mt = new MeshBuilder(), mh = new MeshBuilder();          // detalles del cuerpo / de la cabeza (locales)
  // costillas a la vista en los dos costados, carne expuesta y sangre
  for (let k = 0; k < 5; k++) [-1, 1].forEach(s => mt.box(s * (bw / 2 + 0.006), -0.02, 0.22 - k * 0.1, 0.012, bh * 0.75, 0.035, HOUND_BONE));
  mt.box(bw / 2 + 0.004, -0.02, 0.05, 0.008, bh * 0.6, 0.3, HOUND_FLESH);               // carne detrás de las costillas
  mt.box(-bw / 2 - 0.004, -0.04, -0.02, 0.008, bh * 0.5, 0.22, HOUND_FLESH);
  mt.box(bw / 2 + 0.01, -0.12, -0.3, 0.01, 0.14, 0.2, HOUND_BLOOD);                      // manchas de sangre
  mt.box(-bw / 2 - 0.01, 0.08, 0.3, 0.01, 0.1, 0.16, HOUND_BLOOD);
  mt.box(0, -bh / 2 - 0.005, 0.12, bw * 0.7, 0.01, 0.4, HOUND_FLESH);                    // panza abierta
  for (let k = 0; k < 7; k++) mt.box(0, bh / 2 + 0.05 + (k % 2) * 0.04, 0.4 - k * 0.13, 0.05, 0.12 + (k % 2) * 0.06, 0.05, HOUND_BONE, 0.4);   // púas del lomo
  mt.box(0, bh / 2 + 0.02, bl / 2 - 0.04, bw * 0.9, 0.12, 0.2, furC);                   // hombros encorvados
  mt.box(0, bh * 0.25, -bl / 2 - 0.2, 0.05, 0.05, 0.42, HOUND_BONE, 0.5);                // cola de hueso
  // cabeza: hocico largo con la boca abierta, dientes, encías, sangre, orejas rotas y ojos que brillan
  mh.box(0, 0.03, hs / 2 + 0.14, 0.2, 0.12, 0.3, furC);                                  // hocico
  mh.box(0, 0.075, hs / 2 + 0.28, 0.08, 0.05, 0.04, 0x0a0606);                           // nariz
  mh.box(0, -0.12, hs / 2 + 0.12, 0.18, 0.06, 0.28, furC, -0.35);                        // mandíbula (abierta)
  mh.box(0, -0.04, hs / 2 + 0.12, 0.16, 0.06, 0.26, HOUND_GUM, -0.17);                   // adentro de la boca
  for (let k = 0; k < 5; k++) [-1, 1].forEach(s => {
    mh.box(s * 0.08, -0.02, hs / 2 + 0.04 + k * 0.05, 0.02, 0.06, 0.02, HOUND_TOOTH);   // colmillos de arriba
    mh.box(s * 0.075, -0.1, hs / 2 + 0.05 + k * 0.045, 0.02, 0.05, 0.02, HOUND_TOOTH, -0.35);
  });
  mh.box(0, -0.2, hs / 2 + 0.22, 0.14, 0.03, 0.06, HOUND_BLOOD);                          // sangre en el mentón
  [[-0.05, -0.28], [0.06, -0.34]].forEach(([x, y]) => mh.box(x, y, hs / 2 + 0.2, 0.02, 0.1, 0.02, HOUND_BLOOD));   // gotas colgando
  mh.box(-0.13, hs / 2 + 0.06, -0.06, 0.06, 0.16, 0.04, furC, 0, 0, 0.5);               // orejas rotas
  mh.box(0.13, hs / 2 + 0.03, -0.06, 0.06, 0.1, 0.04, furC, 0, 0, -0.6);
  mh.box(0.1, 0.05, hs / 2 - 0.02, 0.1, 0.02, 0.04, HOUND_FLESH, 0, 0, 0.4);             // cicatriz
  dogDetail(mt, torso.mesh, det);
  dogDetail(mh, head.mesh, det);
  [-0.09, 0.09].forEach(x => {                                                          // ojos rojos
    const e = new THREE.Mesh(zGeo(0.06, 0.035, 0.02), HOUND_EYE);
    e.position.set(x, 0.07, hs / 2 + 0.005); e.rotation.z = x < 0 ? -0.3 : 0.3;
    head.mesh.add(e);
  });

  const z = {
    id: 100 + i, root, body,
    head: head.mesh, armL: fl.pivot, armR: fr.pivot, legL: bL.pivot, legR: bR.pivot,
    flashMats: [fur], hitParts: [],
    active: false, alive: false, state: 'idle', mode: 'flow', t: 0,
    px: 0, pz: 0, sx: 0, sz: 0, wantX: 0, wantZ: 0,
    nudgeX: 0, nudgeZ: 0, nudgeT: 0,
    heading: 0, health: 0, speed: 0, attackCd: 0, swingT: 0,
    walkT: Math.random() * 6, stuckT: 0, lastX: 0, lastZ: 0, strikes: 0, flash: 0,
    kbX: 0, kbZ: 0, kbT: 0,
    voice: D.voice[0] + Math.random() * (D.voice[1] - D.voice[0]), growlT: 0,
    kind: 'dog', dog: true, breed, crawl: false, legDmg: 0, maxHealth: 0
  };
  head.mesh.userData = { type: 'zombieHead', zombie: z };
  z.hitParts.push(head.mesh);
  [torso, fl, fr, bL, bR].forEach(p => {
    p.mesh.userData = { type: 'zombieBody', zombie: z };
    z.hitParts.push(p.mesh);
  });
  root.visible = false;
  scene.add(root);
  return z;
}
function buildDogPool() {
  for (let i = 0; i < CONFIG.DOGS.poolSize; i++) DPOOL.push(createDog(i, i % 2 ? 'sarnoso' : 'negro'));   // F5.7
}
// trote: patas en diagonal (adelante izquierda con atrás derecha); al morder se para en las de atrás
function animateDog(z, dt, v) {
  const k = Math.min(1, v / 1.5);
  z.walkT += dt * (6 + v * 2.2);
  const s = Math.sin(z.walkT) * 0.75 * k;
  z.armL.rotation.x = s; z.armR.rotation.x = -s;
  z.legL.rotation.x = -s; z.legR.rotation.x = s;
  let lunge = 0;
  if (z.swingT > 0) {
    z.swingT -= dt;
    lunge = Math.sin(Math.PI * (1 - Math.max(0, z.swingT) / 0.35));
  }
  z.body.rotation.set(-0.35 * lunge, 0, 0);
  z.body.position.set(0, Math.abs(Math.sin(z.walkT)) * 0.05 * k, 0.15 * lunge);
}
function spawnDog() {
  let n = 0;
  for (const q of DPOOL) if (!q.active) n++;
  if (!n) return null;
  const sp = pickSpawnPoint(false);
  if (!sp) return null;
  let r = Math.floor(Math.random() * n), z = null;
  for (const q of DPOOL) if (!q.active && r-- === 0) { z = q; break; }
  resetZombie(z, sp, false);
  state.zombies.push(z);
  lightning();
  return z;
}

//--- F5.9: calamares ---
// Misma forma de objeto que un zombie (z.squid, kind 'squid'): armL/armR = tentáculos de adelante, legL/legR =
// los de atrás. Acostado, se arrastra con los tentáculos. La cabeza (ojos) es la parte de headshot.
// Tinta (F5.10: chorro continuo): jet s de gotas en arco (pool fijo INK.shots), cada una dps/rate × tamaño, y
// mancha la pantalla mientras te toca. Después descansa rest s.
// Fusión: dos vivos que se tocan (mismo nivel) se juntan en el más grande, que suma la vida del otro y crece;
// el otro se va sin puntos ni almas. Hasta SQUID.maxFuse fusiones por calamar.
const SQPOOL = [];
const INK = { shots: [], splat: 0 };
const SQUID_SKIN = [[0x6a2a7a, 0x4a1a5a, 0xc86ac8], [0x8a1e3a, 0x5a0e20, 0xe86a8a]];   // morado / rojo: piel, manchas, ventosas
function createSquid(i) {
  const S = CONFIG.SQUID, [col, spot, suck] = SQUID_SKIN[i % 2];
  const skin = new THREE.MeshLambertMaterial({ color: col });
  const det = new THREE.MeshLambertMaterial({ vertexColors: true });
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const torso = zPart(0.72, 0.5, 1.15, skin, 0, 0.42, -0.25, body);          // manto, acostado hacia atrás
  const head = zPart(0.62, 0.46, 0.42, skin, 0, 0.36, 0.52, body);           // cabeza con los ojos
  // 4 tentáculos grandes que reciben balas: cuelgan del pivote y la animación los acuesta adelante/atrás
  const tl = zPart(0.16, 0.95, 0.16, skin, -0.24, 0.2, 0.7, body, true), tr = zPart(0.16, 0.95, 0.16, skin, 0.24, 0.2, 0.7, body, true);
  const bl = zPart(0.16, 0.8, 0.16, skin, -0.28, 0.2, -0.6, body, true), br = zPart(0.16, 0.8, 0.16, skin, 0.28, 0.2, -0.6, body, true);
  const mt = new MeshBuilder(), mh = new MeshBuilder();
  for (let k = 0; k < 6; k++) mt.box((k % 2 ? 0.2 : -0.18), 0.26, 0.4 - k * 0.16, 0.16, 0.02, 0.14, spot);   // manchas del lomo
  mt.box(0, 0.12, -0.62, 0.5, 0.3, 0.3, col);                                  // punta del manto
  mt.box(-0.37, 0, -0.1, 0.03, 0.2, 0.6, spot); mt.box(0.37, 0, -0.1, 0.03, 0.2, 0.6, spot);   // aletas
  for (let k = 0; k < 6; k++) [-1, 1].forEach(s => mt.box(s * 0.2, -0.26, 0.4 - k * 0.14, 0.12, 0.02, 0.1, suck));   // ventosas panza
  // cabeza: ojos grandes (MeshBasic aparte), pico y tentáculos chicos colgando (solo visuales)
  mh.box(0, -0.16, 0.22, 0.16, 0.12, 0.08, 0x1a1008);                          // pico
  for (let k = 0; k < 6; k++) mh.box(-0.25 + k * 0.1, -0.3, 0.16, 0.06, 0.24 + (k % 3) * 0.08, 0.06, k % 2 ? col : spot, 0.4, 0, 0);
  for (let k = 0; k < 3; k++) mh.box(-0.12 + k * 0.12, 0.26, 0.05, 0.05, 0.08, 0.05, spot);   // bultos feos
  dogDetail(mt, torso.mesh, det);
  dogDetail(mh, head.mesh, det);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xf0e040 }), pupil = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
  [-0.2, 0.2].forEach(x => {
    const e = new THREE.Mesh(zGeo(0.16, 0.14, 0.02), eyeMat); e.position.set(x, 0.06, 0.215); head.mesh.add(e);
    const p = new THREE.Mesh(zGeo(0.14, 0.03, 0.02), pupil); p.position.set(x, 0.06, 0.225); head.mesh.add(p);   // pupila rayada
  });
  // tentáculos: ventosas
  [tl, tr, bl, br].forEach(t => { const mb = new MeshBuilder(); for (let k = 0; k < 5; k++) mb.box(0, -0.12 - k * 0.16, 0.085, 0.08, 0.06, 0.02, suck); dogDetail(mb, t.mesh, det); });
  const z = {
    id: 300 + i, root, body,
    head: head.mesh, armL: tl.pivot, armR: tr.pivot, legL: bl.pivot, legR: br.pivot,
    flashMats: [skin], hitParts: [],
    active: false, alive: false, state: 'idle', mode: 'flow', t: 0,
    px: 0, pz: 0, sx: 0, sz: 0, wantX: 0, wantZ: 0,
    nudgeX: 0, nudgeZ: 0, nudgeT: 0,
    heading: 0, health: 0, speed: 0, attackCd: 0, swingT: 0,
    walkT: Math.random() * 6, stuckT: 0, lastX: 0, lastZ: 0, strikes: 0, flash: 0,
    kbX: 0, kbZ: 0, kbT: 0,
    voice: S.voice[0] + Math.random() * (S.voice[1] - S.voice[0]), growlT: 0,
    kind: 'squid', squid: true, dog: false, crawl: false, legDmg: 0, maxHealth: 0,
    size: 1, fused: 0, inkT: 0
  };
  head.mesh.userData = { type: 'zombieHead', zombie: z };
  z.hitParts.push(head.mesh);
  [torso, tl, tr, bl, br].forEach(p => { p.mesh.userData = { type: 'zombieBody', zombie: z }; z.hitParts.push(p.mesh); });
  root.visible = false;
  scene.add(root);
  return z;
}
function buildSquidPool() {
  const S = CONFIG.SQUID;
  for (let i = 0; i < S.poolSize; i++) SQPOOL.push(createSquid(i));
  const geo = new THREE.BoxGeometry(0.17, 0.17, 0.17);                 // F5.10: gotas del chorro
  const mats = [new THREE.MeshBasicMaterial({ color: 0x5a1070 }), new THREE.MeshBasicMaterial({ color: 0x9a1030 })];
  for (let i = 0; i < S.ink.pool; i++) {
    const m = new THREE.Mesh(geo, mats[i % 2]);
    m.visible = false; scene.add(m);
    INK.shots.push({ m, active: false, p: new THREE.Vector3(), v: new THREE.Vector3(), dmg: 0, ox: 0, oz: 0 });
  }
}
function setSquidSize(z) {
  z.size = 1 + CONFIG.SQUID.grow * z.fused;
  z.root.scale.setScalar(z.size);
}
// los tentáculos reman: los de adelante se estiran y tiran, los de atrás empujan; el cuerpo ondula
function animateSquid(z, dt, v) {
  const k = Math.min(1, v / 1.5);
  z.walkT += dt * (4 + v * 1.6);
  const s = Math.sin(z.walkT);
  z.armL.rotation.x = -1.3 + s * 0.35 * k; z.armR.rotation.x = -1.3 - s * 0.35 * k;
  z.legL.rotation.x = 1.35 - s * 0.3 * k; z.legR.rotation.x = 1.35 + s * 0.3 * k;
  z.armL.rotation.z = -0.25; z.armR.rotation.z = 0.25; z.legL.rotation.z = -0.3; z.legR.rotation.z = 0.3;
  let lunge = 0;
  if (z.swingT > 0) { z.swingT -= dt; lunge = Math.sin(Math.PI * (1 - Math.max(0, z.swingT) / 0.35)); }
  z.body.rotation.set(-0.3 * lunge, 0, Math.sin(z.walkT * 0.5) * 0.05);
  z.body.position.set(0, Math.abs(s) * 0.04 * k, 0.25 * lunge);
  z.body.scale.set(1 + 0.04 * s * k, 1 - 0.04 * s * k, 1);
}
function spawnSquid() {
  const z = SQPOOL.find(q => !q.active);
  if (!z) return null;
  // F5.11: la mayoría los escupe el calamar gigante; el resto sale de la orilla. Solo del mar (si la playa
  // no se alcanza, de los spawns normales)
  if (GIANT.state === 'rise') return null;                                // espera a que termine de salir
  if (GIANT.state === 'up' && Math.random() < CONFIG.SQUID.giant.share && giantLaunch(z)) return z;
  const sp = pickSpawnPoint(true) || (beachReachable() ? null : pickSpawnPoint(false));
  if (!sp) return null;
  resetZombie(z, sp, false);
  state.zombies.push(z);
  return z;
}

//--- F5.11: el calamar gigante. Sale del mar al arrancar una ronda con calamares (rugido), escupe calamares en
// arco a la playa (cada uno aparece donde cae) y se hunde cuando ya salieron todos. Un solo modelo, creado una vez
const GIANT = { g: null, state: 'off', t: 0, shots: [], spit: 0 };
function buildGiantSquid() {
  const S = CONFIG.SQUID.giant, g = new THREE.Group(), mb = new MeshBuilder(), c = 0x5a1e5e, d = 0x3a0e3e, s = 0xc86ac8;
  mb.box(0, 1.2, 0, 1.4, 2.4, 1.2, c);                                   // manto
  mb.box(0, 2.6, 0, 1.0, 0.8, 0.9, c); mb.box(0, 3.1, -0.05, 0.6, 0.4, 0.6, d);
  for (let i = 0; i < 6; i++) mb.box((i % 2 ? 0.35 : -0.35), 0.6 + i * 0.35, 0.61, 0.25, 0.2, 0.02, s);   // ventosas del frente
  mb.box(-0.38, 1.3, 0.62, 0.34, 0.3, 0.02, 0xf0e040); mb.box(0.38, 1.3, 0.62, 0.34, 0.3, 0.02, 0xf0e040);   // ojos
  mb.box(-0.38, 1.3, 0.63, 0.3, 0.06, 0.02, 0x0a0a0a); mb.box(0.38, 1.3, 0.63, 0.3, 0.06, 0.02, 0x0a0a0a);
  mb.box(0, 0.55, 0.62, 0.4, 0.3, 0.02, 0x1a0a0a);                       // boca
  // F5.12: más aterrador: cicatrices, bultos y púas en el manto
  for (let i = 0; i < 8; i++) mb.box(-0.6 + (i % 4) * 0.4, 1.6 + Math.floor(i / 4) * 0.7, 0.605, 0.06, 0.4, 0.02, 0x7a2a5a, 0, 0, 0.6);
  for (let i = 0; i < 6; i++) mb.box(-0.5 + i * 0.2, 3.3 + (i % 2) * 0.15, 0, 0.1, 0.35, 0.1, d, 0.3, 0, (i - 2.5) * 0.15);
  const body = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.remove(body); body.matrixAutoUpdate = true; body.userData.theme = false; g.add(body);
  // F5.12: lo que brilla (MeshBasic, sin luces): 6 ojos más, anillo de dientes y la boca roja con un halo
  const glow = new MeshBuilder();
  [[-0.55, 1.75], [0.55, 1.75], [-0.2, 2.0], [0.2, 2.0], [-0.62, 1.0], [0.62, 1.0]].forEach(([x, y]) => {
    glow.box(x, y, 0.62, 0.16, 0.14, 0.02, 0xfff040); glow.box(x, y, 0.63, 0.14, 0.03, 0.02, 0x0a0a0a);
  });
  glow.box(0, 0.55, 0.625, 0.34, 0.24, 0.02, 0xff2a10);                   // garganta roja
  for (let i = 0; i < 12; i++) {                                         // dientes en anillo
    const a = i / 12 * Math.PI * 2;
    glow.box(Math.cos(a) * 0.26, 0.55 + Math.sin(a) * 0.2, 0.64, 0.05, 0.1, 0.03, 0xf0ead0, 0, 0, a + Math.PI / 2);
  }
  const gm = glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
  scene.remove(gm); gm.matrixAutoUpdate = true; gm.userData.theme = false; g.add(gm);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({
    map: radialTex('rgba(255,60,20,.95)', 'rgba(255,20,0,.35)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.set(0, 0.55, 0.7); g.add(halo);
  g.userData.halo = halo;
  const tent = [];
  for (let i = 0; i < 8; i++) {                                          // tentáculos que se mueven
    const a = i / 8 * Math.PI * 2, t = new THREE.Group();
    t.position.set(Math.cos(a) * 0.5, 0.3, Math.sin(a) * 0.5); t.rotation.y = -a;
    const tb = new MeshBuilder();
    for (let k = 0; k < 5; k++) tb.box(0.3 + k * 0.28, -0.1 - k * 0.12, 0, 0.3, 0.22 - k * 0.03, 0.22 - k * 0.03, k % 2 ? c : d);
    const tm = tb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
    scene.remove(tm); tm.matrixAutoUpdate = true; tm.userData.theme = false; t.add(tm);
    g.add(t); tent.push(t);
  }
  g.userData.tent = tent;
  g.scale.setScalar(S.scale); g.position.set(S.x, -20, S.z); g.visible = false;
  scene.add(g);
  GIANT.g = g;
  // calamares en vuelo (uno por calamar del pool)
  for (let i = 0; i < CONFIG.SQUID.poolSize; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.8), new THREE.MeshLambertMaterial({ color: i % 2 ? 0x8a1e3a : 0x6a2a7a }));
    m.visible = false; scene.add(m);
    GIANT.shots.push({ m, active: false, z: null, t: 0, from: new THREE.Vector3(), to: new THREE.Vector3() });
  }
}
function beachReachable() { return flowAt(0, -14) >= 0; }
// arranque de una ronda con calamares: sale con un rugido (si la playa se alcanza)
function giantRise() {
  if (!GIANT.g || !beachReachable()) return false;
  GIANT.state = 'rise'; GIANT.t = 0; GIANT.g.visible = true;
  sfxGiantRoar();
  addTrauma(0.35);
  return true;
}
// escupe a `z` (reservado del pool) hacia un lugar de la playa. true = salió
function giantLaunch(z) {
  const S = CONFIG.SQUID.giant, L = S.land, P = player.pos, shot = GIANT.shots.find(s => !s.active);
  if (!shot) return false;
  let to = null;
  for (let k = 0; k < 12 && !to; k++) {
    const x = L.x1 + Math.random() * (L.x2 - L.x1), zz = L.z1 + Math.random() * (L.z2 - L.z1);
    if (isNav(Math.floor(x), Math.floor(zz)) && flowAt(Math.floor(x), Math.floor(zz)) >= 0 && Math.hypot(x - P.x, zz - P.z) >= S.minDist) to = [x, zz];
  }
  if (!to) return false;
  z.active = true; z.alive = false;                                      // reservado mientras vuela
  shot.active = true; shot.z = z; shot.t = 0;
  shot.from.set(S.x, 3.2 * S.scale * 0.6, S.z + 0.7 * S.scale); shot.to.set(to[0], 0.3, to[1]);
  shot.m.position.copy(shot.from); shot.m.visible = true;
  GIANT.spit = 0.4;
  sfxInk(Math.hypot(P.x - S.x, P.z - S.z));
  return true;
}
function giantBusy() { return GIANT.shots.some(s => s.active); }
function updateGiant(dt) {
  const S = CONFIG.SQUID.giant, g = GIANT.g, t = clock.elapsedTime;
  if (!g) return;
  for (const s of GIANT.shots) {                                         // calamares en el aire
    if (!s.active) continue;
    s.t += dt;
    const k = Math.min(1, s.t / S.fly), p = s.m.position;
    p.lerpVectors(s.from, s.to, k); p.y += S.arc * 4 * k * (1 - k);
    s.m.rotation.x += dt * 6; s.m.rotation.z += dt * 4;
    if (k >= 1) {
      s.active = false; s.m.visible = false;
      spawnSplashFx(s.to.x, 0.4, s.to.z, 0x7a2a8a, 1.2);
      const z = s.z; s.z = null;
      z.active = false;                                                  // resetZombie lo activa de nuevo
      resetZombie(z, { x: s.to.x, z: s.to.z }, false);
      z.state = 'walk'; placeRoot(z, 0);                                 // cae directo, sin salir del piso
      z.fromGiant = true;
      state.zombies.push(z);
    }
  }
  if (GIANT.state === 'off') return;
  GIANT.t += dt;
  let y = 0;
  if (GIANT.state === 'rise') {
    y = -3.5 * S.scale * (1 - easeOut(Math.min(1, GIANT.t / S.rise)));
    if (GIANT.t >= S.rise) { GIANT.state = 'up'; GIANT.t = 0; }
  } else if (GIANT.state === 'up') {
    y = Math.sin(t * 1.3) * 0.3;
    const R = roundState;
    if (!R.dogs || R.spawned >= R.total || roundState.phase !== 'active') { GIANT.state = 'sink'; GIANT.t = 0; }
  } else if (GIANT.state === 'sink') {
    y = -3.5 * S.scale * easeOut(Math.min(1, GIANT.t / S.sink));
    if (GIANT.t >= S.sink) { GIANT.state = 'off'; g.visible = false; }
  }
  GIANT.spit = Math.max(0, GIANT.spit - dt);
  g.position.set(S.x, SEA.y - 1 + y, S.z);
  g.rotation.set(-0.15 - GIANT.spit * 0.6, Math.atan2(player.pos.x - S.x, player.pos.z - S.z) * 0.3, Math.sin(t * 0.7) * 0.05);
  g.userData.tent.forEach((tn, i) => { tn.rotation.z = Math.sin(t * 2 + i) * 0.35; });
  const hl = g.userData.halo;                                            // F5.12: la boca late (más fuerte al escupir)
  hl.material.opacity = 0.55 + 0.3 * Math.sin(t * 5) + GIANT.spit;
  hl.scale.setScalar(1 + 0.2 * Math.sin(t * 5) + GIANT.spit * 1.5);
}
function resetGiant() {
  GIANT.state = 'off'; GIANT.t = 0; GIANT.spit = 0;
  if (GIANT.g) GIANT.g.visible = false;
  for (const s of GIANT.shots) {
    if (s.z) { s.z.active = false; s.z = null; }
    s.active = false; s.m.visible = false;
  }
}
function squidsAlive() { let n = 0; for (const q of SQPOOL) if (q.active && q.alive) n++; return n; }
function dogsAlive() { let n = 0; for (const q of DPOOL) if (q.active && q.alive) n++; return n; }
// por frame, antes de moverse (updateZombies): tinta y fusión
function squidTick(z, dt) {
  const S = CONFIG.SQUID, P = player.pos;
  // F5.10: chorro continuo: jet s echando gotas (rate por segundo), después rest s de descanso
  if (z.jetT > 0) {
    z.jetT -= dt; z.jetAcc += dt * S.ink.rate;
    if (!canInk(z)) z.jetT = 0;                                      // saliste del rango o te tapaste: corta
    while (z.jetAcc >= 1 && z.jetT > 0) { z.jetAcc -= 1; fireInk(z); }
    if (z.jetT <= 0) z.inkT = S.ink.rest;
  } else if ((z.inkT -= dt) <= 0) {
    if (canInk(z)) { z.jetT = S.ink.jet; z.jetAcc = 1; sfxInk(Math.hypot(P.x - z.px, P.z - z.pz)); }
    else z.inkT = 0.5;
  }
  if (z.fused >= S.maxFuse) return;
  for (const q of SQPOOL) {
    if (q === z || !q.alive || q.state !== 'walk' || (q.level || 0) !== (z.level || 0) || z.fused + q.fused + 1 > S.maxFuse) continue;
    const touch = S.radius * (z.size + q.size) + 0.2;
    if (Math.hypot(q.px - z.px, q.pz - z.pz) < touch) { fuseSquids(z, q); return; }
  }
}
// el más grande (o el que tiene más vida) se come al otro
function fuseSquids(a, b) {
  if (b.fused > a.fused || (b.fused === a.fused && b.health > a.health)) { const t = a; a = b; b = t; }
  a.fused += b.fused + 1; a.health += b.health; a.maxHealth += b.maxHealth;
  setSquidSize(a);
  b.alive = false; b.state = 'dying'; b.t = 99; b.root.visible = false;   // se va sin puntos (updateZombies lo saca)
  spawnSplashFx(a.px, groundY(a.px, a.pz) + 0.5, a.pz, 0x7a2a8a, 1 + 0.2 * a.fused);
  sfxSquidFuse(Math.hypot(player.pos.x - a.px, player.pos.z - a.pz));
  return a;
}
function canInk(z) {
  const R = CONFIG.SQUID.ink.range, P = player.pos, d = Math.hypot(P.x - z.px, P.z - z.pz);
  return z.state === 'walk' && (z.level || 0) === 0 && playerLevel() === 0 && d >= R[0] && d <= R[1] &&
         segmentClear(z.px, z.pz, P.x, P.z, 0, true);
}
// una gota del chorro, en arco hacia el pecho del jugador (sin adelantar, con un poco de dispersión)
function fireInk(z) {
  const I = CONFIG.SQUID.ink, P = player.pos, s = INK.shots.find(q => !q.active);
  if (!s) return false;
  const oy = groundY(z.px, z.pz) + 0.5 * z.size, fx = Math.sin(z.heading), fz = Math.cos(z.heading);
  s.p.set(z.px + fx * 0.7 * z.size, oy, z.pz + fz * 0.7 * z.size);
  const T = Math.max(0.25, Math.hypot(P.x - s.p.x, P.z - s.p.z) / I.speed), ty = P.y - 0.5;
  const j = () => (Math.random() * 2 - 1) * I.spread * I.speed;
  s.v.set((P.x - s.p.x) / T + j(), (ty - s.p.y) / T + 0.5 * I.gravity * T + j(), (P.z - s.p.z) / T + j());
  s.dmg = I.dps / I.rate * z.size; s.ox = z.px; s.oz = z.pz; s.active = true;
  s.m.position.copy(s.p); s.m.visible = true;
  z.swingT = 0.2;
  return true;
}
function inkSplat() { INK.splat = CONFIG.SQUID.ink.splat; }
function updateSquids(dt) {
  const I = CONFIG.SQUID.ink;
  for (const s of INK.shots) {
    if (!s.active) continue;
    let end = false;
    for (let k = 0; k < 3 && !end; k++) {
      const h = dt / 3;
      s.v.y -= I.gravity * h;
      s.p.addScaledVector(s.v, h);
      if (projHitsPlayer(s.p, I.radius)) {
        // F5.10: cada gota pega poquito e ignora el i-frame (si no, el chorro pegaría 1 de cada 10)
        if (!shieldBlocks(s.ox, s.oz, s.dmg)) { damagePlayer(s.dmg, s.ox, s.oz, true); inkSplat(); }
        end = true;
      } else if (projBlocked(s.p.x, s.p.y, s.p.z) || s.p.y < -5) end = true;
    }
    if (end) {
      s.active = false; s.m.visible = false;
      if (Math.random() < 0.25) spawnSplashFx(s.p.x, s.p.y, s.p.z, 0x6a1a7a, 0.5);
      continue;
    }
    s.m.position.copy(s.p); s.m.rotation.x += dt * 9;
  }
  if (INK.splat > 0) INK.splat = Math.max(0, INK.splat - dt);
  if (UI.ink) {
    const o = INK.splat > 0 ? Math.min(1, INK.splat / (I.splat * 0.6)) : 0;
    if (UI.ink._o !== o) { UI.ink.style.opacity = o > 0 ? o.toFixed(3) : '0'; UI.ink._o = o; }
  }
}
function resetSquids() {
  for (const s of INK.shots) { s.active = false; s.m.visible = false; }
  INK.splat = 0;
  for (const q of SQPOOL) { q.fused = 0; setSquidSize(q); }
  if (UI.ink) { UI.ink.style.opacity = '0'; UI.ink._o = 0; }
}

//--- noche (ronda de perros) y relámpagos ---
function captureDay() {
  if (NIGHT.base || !WORLD.hemi) return !!NIGHT.base;
  const W = WORLD, N = CONFIG.DOGS.night;
  NIGHT.base = { hemi: W.hemi.intensity, hemiSky: W.hemi.color.clone(), hemiGround: W.hemi.groundColor.clone(),
                 sun: W.sun.intensity, sunColor: W.sun.color.clone(), fog: scene.fog.color.clone(),
                 sky: W.sky.material.color.clone() };
  NIGHT.night = { hemi: N.hemi, hemiSky: new THREE.Color(N.hemiSky), hemiGround: new THREE.Color(N.hemiGround),
                  sun: N.sun, sunColor: new THREE.Color(N.sunColor), fog: new THREE.Color(N.fog), sky: new THREE.Color(N.sky) };
  const Pp = CONFIG.WEATHER.purple;                        // F5.9
  NIGHT.purple = { fog: new THREE.Color(Pp.fog), sky: new THREE.Color(Pp.sky), hemiSky: new THREE.Color(Pp.hemiSky) };
  NIGHT.white = new THREE.Color(0xdfe6ff);
  // F7a: paradas de color del ciclo (null = el día del tema en k 0, la noche en k 1)
  NIGHT.pal = CONFIG.WEATHER.palette.map((s, i, a) => {
    const end = i === 0 ? NIGHT.base : i === a.length - 1 ? NIGHT.night : null;
    const c = (v, key) => v !== null ? new THREE.Color(v) : end[key].clone();
    return { k: s.k, sky: c(s.sky, 'sky'), fog: c(s.fog, 'fog'), hemiSky: c(s.hemiSky, 'hemiSky'), sun: c(s.sun, 'sunColor') };
  });
  return true;
}
// F7a: color del ciclo en la oscuridad k (entre las dos paradas que la rodean)
function paletteAt(key, k, out) {
  const P = NIGHT.pal;
  let i = 0;
  while (i < P.length - 2 && k > P[i + 1].k) i++;
  const a = P[i], b = P[i + 1], t = Math.max(0, Math.min(1, (k - a.k) / (b.k - a.k)));
  return out.copy(a[key]).lerp(b[key], t);
}
function setNight(on) { NIGHT.target = on ? 1 : 0; }
// F5.9: el cielo de la ronda n (mob = ronda de perros/calamares): oscuridad, neblina morada, truenos y lluvia
function setSky(n, mob) {
  const W = CONFIG.WEATHER;
  NIGHT.target = mob ? 1 : W.darkBy(n);
  NIGHT.pTarget = n >= W.purpleFrom ? 1 : 0;
  NIGHT.rain = !!mob || n >= W.rainFrom;
  NIGHT.storm = mob ? 'mob' : W.thunder.some(r => n >= r[0] && n <= r[1]) ? 'storm' : null;
  if (NIGHT.storm && NIGHT.thunderT <= 0) NIGHT.thunderT = randIn(NIGHT.storm === 'mob' ? W.mobThunderEvery : W.thunderEvery);
}
// cuánto se cierra la niebla sin boss (la neblina morada la acerca). La usa updateBoss
function weatherFogFar(base) { return base + (CONFIG.WEATHER.purple.fogFar - base) * NIGHT.p; }
function lightning() {
  NIGHT.flash = CONFIG.DOGS.lightning.time;
  sfxThunder();
}
// k = 0 día -> 1 noche; f = fuerza del relámpago (0..1); p = neblina morada (0..1)
function applyNight(k, f, p) {
  const B = NIGHT.base, T = NIGHT.night, W = WORLD, Lg = CONFIG.DOGS.lightning, P = NIGHT.purple;
  p = p || 0;
  W.hemi.intensity = B.hemi + (T.hemi - B.hemi) * k + Lg.hemiBoost * f;
  // F7a: los colores recorren la paleta del ciclo (atardecer -> anochecer -> noche); las intensidades, parejo
  paletteAt('hemiSky', k, W.hemi.color).lerp(P.hemiSky, p * 0.6).lerp(NIGHT.white, f * 0.6);
  W.hemi.groundColor.copy(B.hemiGround).lerp(T.hemiGround, k);
  W.sun.intensity = B.sun + (T.sun - B.sun) * k;
  paletteAt('sun', k, W.sun.color);
  paletteAt('fog', k, scene.fog.color).lerp(P.fog, p).lerp(NIGHT.white, f * 0.4);
  paletteAt('sky', k, W.sky.material.color).lerp(P.sky, p).lerp(NIGHT.white, f * 0.7);
}
function updateNight(dt) {
  if (!captureDay()) return;
  const W = CONFIG.WEATHER;
  const step = dt / CONFIG.DOGS.night.fade, k0 = NIGHT.k, p0 = NIGHT.p, ps = dt / W.purple.fade;
  NIGHT.k = NIGHT.target > NIGHT.k ? Math.min(NIGHT.target, NIGHT.k + step) : Math.max(NIGHT.target, NIGHT.k - step);
  NIGHT.p = NIGHT.pTarget > NIGHT.p ? Math.min(NIGHT.pTarget, NIGHT.p + ps) : Math.max(NIGHT.pTarget, NIGHT.p - ps);
  if (NIGHT.storm && state.running && roundState.phase === 'active' && (NIGHT.thunderT -= dt) <= 0) {   // tormenta
    NIGHT.thunderT = randIn(NIGHT.storm === 'mob' ? W.mobThunderEvery : W.thunderEvery);
    lightning();
  }
  updateRain(dt);
  updateStars();                                           // F5.10
  let f = 0;
  if (NIGHT.flash > 0) { NIGHT.flash = Math.max(0, NIGHT.flash - dt); f = NIGHT.flash / CONFIG.DOGS.lightning.time; }
  if (NIGHT.k === k0 && NIGHT.p === p0 && f === 0 && !NIGHT.dirty) return;
  NIGHT.dirty = f > 0;                                     // un frame más para apagar el relámpago
  applyNight(NIGHT.k, f, NIGHT.p);
}

//--- F5.10: estrellas. Un THREE.Points (creado una vez) en la mitad de arriba, adentro de la esfera del cielo
// (radio 320). Sin niebla. Aparecen con la oscuridad (NIGHT.k) y la neblina morada las apaga un poco
const STARS = { points: null };
function buildStars() {
  const S = CONFIG.WEATHER.stars, pos = new Float32Array(S.count * 3), col = new Float32Array(S.count * 3);
  for (let i = 0; i < S.count; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.asin(S.minElev + (1 - S.minElev) * Math.random());
    pos[i * 3] = Math.cos(e) * Math.cos(a) * S.radius;
    pos[i * 3 + 1] = Math.sin(e) * S.radius;
    pos[i * 3 + 2] = Math.cos(e) * Math.sin(a) * S.radius;
    const b = 0.55 + 0.45 * Math.random(), warm = Math.random() < 0.2;
    col[i * 3] = b; col[i * 3 + 1] = b * (warm ? 0.9 : 0.97); col[i * 3 + 2] = b * (warm ? 0.75 : 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ size: S.size, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0, depthWrite: false, fog: false }));
  m.frustumCulled = false; m.visible = false;
  scene.add(m);
  STARS.points = m;
}
function updateStars() {
  if (!STARS.points) return;
  const o = Math.max(0, NIGHT.k - CONFIG.WEATHER.stars.from) / (1 - CONFIG.WEATHER.stars.from) * (1 - 0.5 * NIGHT.p);
  STARS.points.visible = o > 0.01;
  STARS.points.material.opacity = o;
}

//--- F5.9: lluvia. Un LineSegments con `count` gotas alrededor del jugador; cada una cae hasta el piso o el techo
const RAIN = { lines: null, pos: null, floor: null, n: 0 };
function buildRain() {
  const R = CONFIG.WEATHER.rain, n = R.count;
  RAIN.pos = new Float32Array(n * 6); RAIN.floor = new Float32Array(n); RAIN.n = n;
  for (let i = 0; i < n; i++) { RAIN.pos[i * 6 + 1] = RAIN.pos[i * 6 + 4] = -100; RAIN.floor[i] = 0; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(RAIN.pos, 3));
  const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: R.color, transparent: true, opacity: R.opacity, depthWrite: false }));
  m.frustumCulled = false; m.visible = false;
  scene.add(m);
  RAIN.lines = m;
}
function rainDrop(i, top) {
  const R = CONFIG.WEATHER.rain, P = player.pos, a = RAIN.pos, o = i * 6;
  const x = P.x + (Math.random() - 0.5) * R.area, z = P.z + (Math.random() - 0.5) * R.area;
  const y = top ? P.y + R.top * (0.6 + 0.4 * Math.random()) : P.y - 2 + Math.random() * (R.top + 2);
  RAIN.floor[i] = rainRoof(x, z);
  a[o] = x; a[o + 1] = y; a[o + 2] = z;
  a[o + 3] = x - R.wind * R.len / R.speed; a[o + 4] = y + R.len; a[o + 5] = z;
}
// altura donde frena una gota: techo de la casa, techo del santuario del templo (F5.16) o el piso
function rainRoof(x, z) {
  const S = CONFIG.TEMPLE.sanctum;
  if (x > S.x1 && x < S.x2 && z > S.z1 && z < S.z2) return UP.y + S.h;
  return roofAt(x, z) ? UP.y : groundY(x, z);
}
// F5.16: áreas donde llueve siempre, sea la ronda que sea (CONFIG.WEATHER.rainRooms)
function rainZone() {
  const r = roomAt(player.pos.x, player.pos.z);
  return !!r && CONFIG.WEATHER.rainRooms.includes(r.id);
}
function updateRain(dt) {
  if (!RAIN.lines) return;
  const on = (!!NIGHT.rain || rainZone()) && !state.gameOver && !inBunker();   // F5.11: en el búnker no llueve
  if (on && !RAIN.lines.visible) for (let i = 0; i < RAIN.n; i++) rainDrop(i, false);
  RAIN.lines.visible = on;
  if (!on) return;
  const R = CONFIG.WEATHER.rain, a = RAIN.pos, dy = R.speed * dt, dx = R.wind * dt, P = player.pos, h = R.area / 2;
  for (let i = 0; i < RAIN.n; i++) {
    const o = i * 6;
    a[o + 1] -= dy; a[o + 4] -= dy; a[o] += dx; a[o + 3] += dx;
    // el viento puede meterla bajo un techo: se mira el techo donde está ahora
    if (a[o + 1] < RAIN.floor[i] || a[o + 1] < rainRoof(a[o], a[o + 2]) ||
        Math.abs(a[o] - P.x) > h || Math.abs(a[o + 2] - P.z) > h) rainDrop(i, true);
  }
  RAIN.lines.geometry.attributes.position.needsUpdate = true;
}

function resetEnemies() {
  roundState.dogs = false; roundState.dogBanner = false;
  roundState.nextDog = randIn(CONFIG.DOGS.firstRound);
  NIGHT.target = 0; NIGHT.k = 0; NIGHT.flash = 0; NIGHT.dirty = false;
  NIGHT.p = NIGHT.pTarget = 0; NIGHT.rain = false; NIGHT.storm = null; NIGHT.thunderT = 0;   // F5.9
  roundState.mobCount = 0; roundState.mob = null;
  resetSquids();
  resetGiant();                                            // F5.11
  if (RAIN.lines) RAIN.lines.visible = false;
  if (captureDay()) applyNight(0, 0, 0);
  if (DRIPS.points) {
    DRIPS.life.fill(0);
    for (let i = 0; i < DRIPS.n; i++) DRIPS.pos[i * 3 + 1] = -100;
    DRIPS.points.visible = false;
    DRIPS.points.geometry.attributes.position.needsUpdate = true;
  }
}
