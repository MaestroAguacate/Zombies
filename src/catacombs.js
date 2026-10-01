//=== 7p. CATACUMBAS Y CUEVA (V2 F5.28e) =====================================
// Pedido de Diego: "en el camino para el templo que uno baje un nivel: unas catacumbas mayas de selva, de piedra, musgosas,
// con plantas carnívoras metidas, medio laberinto, cráneos, goteras, charcos de agua y lodo, del tamaño de la casa; de un
// lado desembocan en el templo (tres caminos, pero hay que abrir una puerta) y del otro en el búnker: un pasillo oscuro
// con un Sombrerón muerto sentado en la puerta, un cuarto oscuro con antorchas del tamaño del caparazón, una cueva con el
// búnker al fondo y una escalera a un costado del templo; con la chiclera, la ballesta y Speed Cola".
// Bajo tierra como el búnker (CONFIG.CATA): sus x,z están debajo de la espesura (nada caminable arriba), piso en CATA.y
// (groundY lo devuelve: cataGround) y rampas a cielo abierto. Los lugares caminables son cuartos (R23 catacumbas, R24
// cueva y 4 partes de R20 del templo: el hall de la puerta y las 3 subidas) con `under`. Las paredes son cajas invisibles
// en cada borde entre un lugar caminable y la roca (buildCataShell, antes del grid); el dibujo es MeshBasic con la luz de
// las antorchas pintada en los colores (cataLight), como el búnker: ninguna luz nueva
const CATA = { grid: null, levers: [], plants: [], flames: [], drops: null, dropList: [], doorLamps: [], built: false, meshes: [], shown: null };

// (al cargar) los lugares caminables entran a ROOMS: roomAt, el grid, los spawns y openRooms los ven como cuartos
(function () {
  const seen = {};
  for (const [id, x1, x2, z1, z2, tag] of CONFIG.CATA.rects) {
    ROOMS.push({ id, name: id === 'R23' ? 'CATACOMBAS' : id === 'R24' ? 'CUEVA' : 'TEMPLO (ABAJO)', x1, x2, z1, z2, floor: 'rock',
      outdoor: true, noFloor: true, under: true, dark: id !== 'R20', part: id === 'R20' || !!seen[id], cata: tag });
    seen[id] = true;
  }
})();

// altura del piso de las catacumbas en (x, z), o undefined si no es de ahí (groundY sigue con lo de siempre)
function cataGround(x, z) {
  const C = CONFIG.CATA, B = C.bbox;
  if (x < B[0] || x > B[1] || z < B[2] || z > B[3]) return undefined;
  for (const R of C.ramps) if (x >= R.x1 && x <= R.x2 && z >= R.z1 && z <= R.z2) {
    const k = R.axis === 'x' ? (x - R.x1) / (R.x2 - R.x1) : (z - R.z1) / (R.z2 - R.z1);
    return R.y1 + (R.y2 - R.y1) * Math.max(0, Math.min(1, k));
  }
  for (const r of C.rects) if (x >= r[1] && x <= r[2] && z >= r[3] && z <= r[4]) return C.y;
  return undefined;
}
// ¿(x, z) está en una bajada a cielo abierto (con margen m)? La espesura no se dibuja ahí
function cataOpen(x, z, m) {
  m = m || 0;
  return CONFIG.CATA.ramps.some(R => x > R.x1 - m && x < R.x2 + m && z > R.z1 - m && z < R.z2 + m);
}
function cataRamp(x, z) { return CONFIG.CATA.ramps.find(R => x >= R.x1 && x <= R.x2 && z >= R.z1 && z <= R.z2) || null; }
// un rectángulo [x1, x2, z1, z2] menos los agujeros: la lista de pedazos que quedan (sin superponerse)
function cutRects(rect, holes) {
  let list = [rect];
  for (const h of holes) {
    const out = [];
    for (const r of list) {
      if (h[0] >= r[1] || h[1] <= r[0] || h[2] >= r[3] || h[3] <= r[2]) { out.push(r); continue; }
      if (h[0] > r[0]) out.push([r[0], h[0], r[2], r[3]]);
      if (h[1] < r[1]) out.push([h[1], r[1], r[2], r[3]]);
      const x1 = Math.max(r[0], h[0]), x2 = Math.min(r[1], h[1]);
      if (h[2] > r[2]) out.push([x1, x2, r[2], h[2]]);
      if (h[3] < r[3]) out.push([x1, x2, h[3], r[3]]);
    }
    list = out;
  }
  return list;
}
// ¿la celda (ix, iz) es caminable de las catacumbas?
function cataWalk(ix, iz) {
  const G = CATA.grid;
  if (!G || ix < G.x0 || ix >= G.x0 + G.w || iz < G.z0 || iz >= G.z0 + G.h) return false;
  return !!G.walk[(ix - G.x0) * G.h + (iz - G.z0)];
}

//--- sólidos (buildMap, antes del grid): paredes, pisos y techos que frenan balas, las rocas, las macetas y la puerta ---
function buildCataShell() {
  const C = CONFIG.CATA, y0 = C.y, mat = new THREE.MeshBasicMaterial(), T = 0.5;
  const inv = (x1, x2, a, b, z1, z2, tag, opts) => { const r = addBox(x1, x2, a, b, z1, z2, mat, tag, opts); r.mesh.visible = false; return r; };
  const [bx1, bx2, bz1, bz2] = C.bbox, G = CATA.grid = { x0: bx1, z0: bz1, w: bx2 - bx1, h: bz2 - bz1, walk: new Uint8Array((bx2 - bx1) * (bz2 - bz1)) };
  for (const [, x1, x2, z1, z2] of C.rects)
    for (let x = x1; x < x2; x++) for (let z = z1; z < z2; z++) G.walk[(x - G.x0) * G.h + (z - G.z0)] = 1;
  // paredes: cada borde entre una celda caminable y una que no lo es (ni de las catacumbas ni un cuarto de arriba, como la
  // boca de la liana H6 o el templo), del lado de la roca. Tramos rectos juntados, como las de la espesura
  const runs = {}, push = (k, i) => (runs[k] = runs[k] || []).push(i);
  const open = (x, z) => cataWalk(x, z) || !!roomAt(x + 0.5, z + 0.5);
  for (let x = G.x0; x < G.x0 + G.w; x++) for (let z = G.z0; z < G.z0 + G.h; z++) {
    if (!cataWalk(x, z)) continue;
    if (!open(x, z - 1)) push('h|' + z + '|-1', x);
    if (!open(x, z + 1)) push('h|' + (z + 1) + '|1', x);
    if (!open(x - 1, z)) push('v|' + x + '|-1', z);
    if (!open(x + 1, z)) push('v|' + (x + 1) + '|1', z);
  }
  CATA.wallRuns = [];
  for (const k in runs) {
    const [ax, line, side] = k.split('|'), L = +line, s = +side, list = runs[k].sort((a, b) => a - b);
    for (let i = 0; i < list.length;) {
      let j = i;
      while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
      const a = list[i], b = list[j] + 1, w1 = s > 0 ? L : L - T, w2 = s > 0 ? L + T : L;
      const seg = ax === 'h' ? [a, b, w1, w2] : [w1, w2, a, b];
      inv(seg[0], seg[1], y0 - 1, C.wallTop, seg[2], seg[3], 'cata');
      CATA.wallRuns.push(seg);
      i = j + 1;
    }
  }
  for (const s of C.seps) inv(s[0], s[1], y0 - 1, y0 + C.h, s[2], s[3], 'cata');
  // pisos (frenan balas) y techos (tapan la vista de arriba): solo los lugares planos; las bajadas quedan abiertas
  for (const [, x1, x2, z1, z2] of C.rects) {
    for (const p of cutRects([x1, x2, z1, z2], C.ramps.map(R => [R.x1, R.x2, R.z1, R.z2]))) {
      inv(p[0], p[1], y0 - 0.3, y0, p[2], p[3], 'floor:cata', { noCollide: true });
      inv(p[0], p[1], y0 + C.h, y0 + C.h + 0.3, p[2], p[3], 'ceil:cata', { noCollide: true });
    }
  }
  // rocas de la cueva (se rodean: la cueva es fácil de perderse) y las macetas de las plantas
  for (const [x, z, rx, rz] of C.pillars) inv(x - rx, x + rx, y0, y0 + C.h, z - rz, z + rz, 'cata:roca');
  for (const [x, z] of C.plants) inv(x - 0.4, x + 0.4, y0, y0 + 0.9, z - 0.4, z + 0.4, 'cata:maceta');
  // la puerta sellada D23: un bloque que se abre con las 3 palancas (el dibujo va de hijo: se va con el bloque)
  const D = C.door, d = addBox(D.x1, D.x2, y0 - 0.3, y0 + C.h, D.z1, D.z2, new THREE.MeshBasicMaterial({ visible: false }), 'door:' + D.id);
  state.doors[D.id] = { id: D.id, cost: CONFIG.DOORS[D.id] || 0, open: false, mesh: d.mesh, collider: d.col, levers: true };
}

// luz pintada: la de las antorchas (0..1) más la del día en las bajadas (más cerca de arriba, más luz)
function cataLight(x, z) {
  const C = CONFIG.CATA;
  let l = 0;
  for (const [tx, tz] of C.torches) l += Math.max(0, 1 - Math.hypot(x - tx, z - tz) / C.torchR) ** 2;
  let day = 0;
  const R = cataRamp(x, z);
  if (R) { const gy = cataGround(x, z); day = C.sun * Math.max(0, 1 + gy / 6); }
  return Math.min(1, C.base + C.gain * Math.min(1, l) + day);
}

//--- las palancas y la puerta sellada ---
function cataLeverNear(room, px, pz, bd) {
  if (!room || room.id !== 'R23' || playerLevel() !== 0) return null;
  let best = null;
  for (const L of CATA.levers) {
    if (L.on) continue;
    const d = Math.hypot(px - L.x, pz - L.z);
    if (d < Math.min(bd, CONFIG.CATA.leverUse) && (!best || d < best.dist)) best = { dist: d, target: L };
  }
  return best;
}
function cataLeversOn() { return CATA.levers.filter(L => L.on).length; }
function pullLever(L) {
  if (!L || L.on) return false;
  L.on = true; L.k = 0;
  if (L.lamp) L.lamp.material.color.setHex(0x3aff4a);
  const i = CATA.levers.indexOf(L);
  if (CATA.doorLamps[i]) CATA.doorLamps[i].material.color.setHex(0x3aff4a);
  if (!playSample('palanca_de_energia')) sfxShieldTake();
  const n = cataLeversOn();
  if (n >= CATA.levers.length) {
    openDoor(CONFIG.CATA.door.id);
    showBanner('THE SEALED DOOR OPENED', 2.5);
    sfxShellRise();
  } else showBanner('LEVER ' + n + ' / ' + CATA.levers.length, 1.6);
  return true;
}
function cataDoorPrompt() { return { text: 'Sealed door - pull the ' + CATA.levers.length + ' levers (' + cataLeversOn() + '/' + CATA.levers.length + ')', cost: 0 }; }

//--- cada frame: llamas, gotas, plantas y palancas ---
function updateCatacombs(dt) {
  if (!CATA.built) return;
  const t = clock.elapsedTime, C = CONFIG.CATA, P = player.pos;
  // F5.28f (rendimiento: son ~185 000 triángulos bajo tierra que se dibujaban desde la casa): solo se dibujan con el
  // jugador abajo o a menos de C.showDist m de una bajada (por las bajadas se ve adentro)
  const cg = cataGround(P.x, P.z);
  const show = (cg !== undefined && cg < -1) || C.ramps.some(R => Math.hypot(Math.max(R.x1 - P.x, 0, P.x - R.x2), Math.max(R.z1 - P.z, 0, P.z - R.z2)) < C.showDist);
  if (show !== CATA.shown) {
    CATA.shown = show;
    for (const m of CATA.meshes) m.visible = show;
    for (const f of CATA.flames) f.visible = show;
    if (CATA.drops) CATA.drops.visible = show;
  }
  const near = Math.hypot(P.x - 7, P.z - 62) < 70;                    // (lejos, nada: está todo bajo tierra)
  if (!near) return;
  CATA.flames.forEach((f, i) => { const k = 0.8 + 0.3 * Math.sin(t * 11 + i * 1.7) * Math.sin(t * 7.3 + i); f.scale.set(k, k * (1 + 0.12 * Math.sin(t * 13 + i)), 1); });
  for (const L of CATA.levers) if (L.on && L.k < 1) { L.k = Math.min(1, L.k + dt * 3); L.handle.rotation.x = 0.7 - 1.4 * L.k; }
  // gotas: caen del techo a su charco y vuelven a salir
  if (CATA.drops) {
    const M = CATA.m4, S = CATA.v3;
    CATA.dropList.forEach((d, i) => {
      d.y -= dt * (2 + d.v); d.v += dt * 9;
      if (d.y < C.y + 0.02) { d.y = C.y + C.h - 0.1; d.v = Math.random() * 0.5; }
      M.makeScale(0.04, 0.12, 0.04); M.setPosition(d.x, d.y, d.z);
      CATA.drops.setMatrixAt(i, M);
    });
    CATA.drops.instanceMatrix.needsUpdate = true;
  }
  // plantas: miran al jugador si lo ven de cerca y escupen ácido
  const pl = playerLevel();
  for (const p of CATA.plants) {
    const d = Math.hypot(P.x - p.x, P.z - p.z);
    const sees = state.running && pl === 0 && d < C.plantRange && inBunker() && segmentClear(p.x, p.z, P.x, P.z, 0, true);
    p.open += ((sees ? 0.9 : 0.12 + 0.08 * Math.sin(t * 2 + p.x)) - p.open) * Math.min(1, dt * 6);
    p.top.rotation.x = -p.open * 0.9; p.bot.rotation.x = p.open * 0.54;
    if (sees) {
      p.head.rotation.y = lerpAngle(p.head.rotation.y, Math.atan2(P.x - p.x, P.z - p.z), Math.min(1, dt * 6));
      if ((p.spitT -= dt) <= 0) {
        p.spitT = randIn(C.plantEvery);
        spitAcid(p.x, p.head.position.y + 0.2, p.z, 0);
        sfxPlantWarn(d);
      }
    }
  }
}
function resetCatacombs() {
  for (const L of CATA.levers) {
    L.on = false; L.k = 0;
    if (L.handle) L.handle.rotation.x = 0.7;
    if (L.lamp) L.lamp.material.color.setHex(0xff2a1a);
  }
  CATA.doorLamps.forEach(l => l.material.color.setHex(0xff2a1a));
  for (const p of CATA.plants) p.spitT = randIn(CONFIG.CATA.plantEvery);
}

//--- el dibujo (una vez, en init): todo en cubos, MeshBasic con la luz pintada. Catacumbas: lajas de piedra, muros de
// sillares con musgo, nichos con cráneos, glifos mayas, raíces que cuelgan del techo, huesos, charcos de agua y de lodo,
// goteras. Cueva: roca oscura, estalactitas, hongos que brillan, las rocas grandes. Portadas de piedra en cada bajada ---
function buildCatacombs() {
  const C = CONFIG.CATA, y0 = C.y, y1 = C.y + C.h, rr = mulberry(2811), r = (a, b) => a + (b - a) * rr();
  const mb = new MeshBuilder(), wt = new MeshBuilder(), gl = new MeshBuilder(), lm = new MeshBuilder();   // pintado, agua, brillo, Lambert
  // F5.28f (Diego: "las escaleras para bajar brillan de noche"): lo pintado a cielo abierto (escalones de las bajadas, sus
  // muros y bordes, las portadas) va aparte, con un material que nightTint oscurece con la noche
  const sk = new MeshBuilder();
  const lit = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();
  const roomOf = (x, z) => { const q = roomAt(x, z); return q && q.under ? q : null; };
  const STONE = [0x6a6458, 0x5e584e, 0x74705f, 0x565048], ROCK = [0x4e463c, 0x5a5044, 0x463e34, 0x3e372e];
  const FLAG = [0x5a554a, 0x524d44, 0x625c50, 0x4a463e], DIRT = [0x3e362c, 0x463c30, 0x342e26];
  const MOSS = [0x4a5a2a, 0x3e4e24, 0x566632], BONE = 0xd8cfb4, GLY = [0x7a2a1e, 0x2a5a4a, 0xb89a55];
  // 1) pisos: por celda (lajas en las catacumbas, tierra y piedra en la cueva); las bajadas, en escalones de 0.5 m
  const G = CATA.grid;
  // una losa oscura debajo de todo (y medio metro por debajo de los muros): tapa las juntas entre lajas y la del pie del
  // muro, que si no dejan ver el cielo (el fondo de la escena) por debajo
  for (const [, x1, x2, z1, z2] of C.rects)
    for (const p of cutRects([x1, x2, z1, z2], C.ramps.map(R => [R.x1, R.x2, R.z1, R.z2])))
      mb.box((p[0] + p[1]) / 2, y0 - 0.14, (p[2] + p[3]) / 2, p[1] - p[0] + 1, 0.06, p[3] - p[2] + 1, 0x0c0a08);
  for (let x = G.x0; x < G.x0 + G.w; x++) for (let z = G.z0; z < G.z0 + G.h; z++) {
    if (!cataWalk(x, z)) continue;
    const cx = x + 0.5, cz = z + 0.5, q = roomOf(cx, cz), cave = q && q.id === 'R24', L = cataLight(cx, cz), R = cataRamp(cx, cz);
    if (R) {                                                             // escalones (dos por metro)
      for (let h = 0; h < 2; h++) {
        const px = R.axis === 'x' ? x + 0.25 + h * 0.5 : cx, pz = R.axis === 'z' ? z + 0.25 + h * 0.5 : cz, gy = cataGround(px, pz);
        sk.box(px, gy - 0.25, pz, R.axis === 'x' ? 0.5 : 1, 0.5, R.axis === 'z' ? 0.5 : 1, lit(FLAG[(x + z + h) & 3], cataLight(px, pz)));
      }
      continue;
    }
    const c = cave ? DIRT[((x * 7 + z * 3) % 3 + 3) % 3] : FLAG[(x + z * 2) & 3];
    mb.box(cx, y0 - 0.05, cz, 0.97, 0.1, 0.97, lit(c, L));
    if (!cave && rr() < 0.25) mb.box(cx + r(-0.3, 0.3), y0 + 0.01, cz + r(-0.3, 0.3), r(0.2, 0.5), 0.02, r(0.2, 0.5), lit(MOSS[x & 1], L));   // musgo
    if (cave && rr() < 0.12) mb.box(cx + r(-0.3, 0.3), y0 + 0.08, cz + r(-0.3, 0.3), r(0.2, 0.45), r(0.1, 0.25), r(0.2, 0.4), lit(ROCK[z & 3], L), r(0, 1), r(0, 3), 0);   // piedras
    // techo (no en las bajadas): losas; en la cueva, roca con estalactitas
    mb.box(cx, y1 + 0.15, cz, 1, 0.3, 1, lit(cave ? ROCK[(x + z) & 3] : 0x3a3630, L * 0.7));
    if (cave && rr() < 0.18) { const h = r(0.3, 1.4); mb.box(cx + r(-0.3, 0.3), y1 - h / 2, cz + r(-0.3, 0.3), r(0.12, 0.3), h, r(0.12, 0.3), lit(ROCK[(x * 3) & 3], L * 0.8)); }
    if (!cave && rr() < 0.07) {                                          // raíces de la jungla que cuelgan del techo
      let px = cx + r(-0.3, 0.3), pz = cz + r(-0.3, 0.3); const n = 3 + Math.floor(rr() * 6);
      for (let k = 0; k < n; k++) { px += r(-0.06, 0.06); pz += r(-0.06, 0.06); mb.box(px, y1 - 0.12 - k * 0.2, pz, 0.07, 0.22, 0.07, lit(k % 2 ? 0x5a4630 : 0x4a3a28, L)); }
    }
  }
  // 2) muros: una columna de sillares (o de roca, en la cueva) por cada celda de roca pegada a una caminable. En las
  // bajadas llegan hasta el suelo de arriba con un borde de piedra
  const open = (nx, nz) => cataWalk(nx, nz) || !!roomAt(nx + 0.5, nz + 0.5);
  for (let x = G.x0; x < G.x0 + G.w; x++) for (let z = G.z0; z < G.z0 + G.h; z++) {
    if (!cataWalk(x, z)) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      const cx = x + 0.5, cz = z + 0.5, q = roomOf(cx, cz), cave = q && q.id === 'R24', L = cataLight(cx, cz), R = cataRamp(cx, cz);
      // una bajada abierta pegada a un lugar techado: el dintel que tapa el hueco entre el techo y el suelo de arriba
      if (R && cataWalk(nx, nz) && !cataRamp(nx + 0.5, nz + 0.5)) {
        sk.box(cx + dx * 0.5 + dx * 0.25, (y1 + 0.3) / 2, cz + dz * 0.5 + dz * 0.25, dx ? 0.5 : 1, 0.3 - y1, dz ? 0.5 : 1, lit(STONE[(x + z) & 3], L));
        continue;
      }
      if (open(nx, nz)) continue;
      const fx = cx + dx * 0.5, fz = cz + dz * 0.5, top = R ? 0.3 : y1;          // la cara del muro
      const wx = fx + dx * 0.25, wz = fz + dz * 0.25, along = dx ? 'z' : 'x';
      // en una esquina de adentro, el tramo sigue 0.5 m más (si no, queda una rendija entre los dos muros)
      const px0 = along === 'x' ? 1 : 0, pz0 = along === 'z' ? 1 : 0;
      const offs = [-0.25, 0.25];
      if (!open(x + px0, z + pz0)) offs.push(0.75);
      if (!open(x - px0, z - pz0)) offs.push(-0.75);
      // el respaldo: una placa oscura detrás de los sillares (sus juntas y los torcidos de la cueva no dejan ver el cielo)
      mb.box(wx + dx * 0.3, (y0 + top) / 2, wz + dz * 0.3, dx ? 0.1 : 2, top - y0 + 0.2, dz ? 0.1 : 2, 0x0c0a08);
      const WB = R ? sk : mb;                                            // (el muro de una bajada, a cielo abierto)
      for (let yy = y0; yy < top - 0.01; yy += 0.5) {                   // sillares de 0.5 m con juntas
        const h = Math.min(0.5, top - yy), pal = cave ? ROCK : STONE;
        for (const o of offs) {
          const px = along === 'x' ? wx + o : wx, pz = along === 'z' ? wz + o : wz;
          WB.box(px, yy + h / 2, pz, along === 'x' ? 0.48 : 0.5, h - 0.03, along === 'z' ? 0.48 : 0.5,
            lit(pal[(x * 5 + z * 3 + Math.floor(yy * 2) + (o > 0 ? 1 : 0)) & 3], L * (0.85 + 0.15 * rr())), cave ? r(-0.05, 0.05) : 0, 0, cave ? r(-0.05, 0.05) : 0);
        }
      }
      if (R) sk.box(wx, 0.35, wz, dx ? 0.7 : 1, 0.12, dz ? 0.7 : 1, lit(0x7a7468, L));   // borde de arriba (lo ves desde afuera)
      if (cave || R) continue;
      // detalles en la cara: musgo, glifos mayas y nichos con cráneos (catacumbas)
      const fy = (a) => y0 + a;
      const face = (o, a, w, h, c) => mb.box(fx + (along === 'x' ? o : 0) - dx * 0.01, fy(a), fz + (along === 'z' ? o : 0) - dz * 0.01,
        along === 'x' ? w : 0.03, h, along === 'z' ? w : 0.03, lit(c, L));
      if (rr() < 0.35) face(r(-0.3, 0.3), r(0.1, 3.4), r(0.2, 0.5), r(0.15, 0.6), MOSS[Math.floor(rr() * 3)]);
      if (rr() < 0.06) {                                                 // glifo: marco y bloquecitos de colores
        face(0, 2.4, 0.6, 0.6, 0x4a463e);
        for (let k = 0; k < 4; k++) face(-0.15 + (k & 1) * 0.3, 2.25 + (k >> 1) * 0.3, 0.2, 0.2, GLY[((k + x) % 3 + 3) % 3]);
      } else if (rr() < 0.2) {                                           // nicho con un cráneo (osario)
        const a = rr() < 0.5 ? 1.1 : 2.0;
        face(0, a + 0.22, 0.7, 0.5, 0x14110e);
        const sx = fx - dx * 0.12, sz = fz - dz * 0.12;
        mb.box(sx, fy(a + 0.2), sz, 0.24, 0.22, 0.24, lit(BONE, L));      // cráneo
        mb.box(sx - dx * 0.1 + (along === 'x' ? -0.06 : 0), fy(a + 0.24), sz - dz * 0.1 + (along === 'z' ? -0.06 : 0), 0.06, 0.06, 0.06, 0x0a0806);   // cuencas
        mb.box(sx - dx * 0.1 + (along === 'x' ? 0.06 : 0), fy(a + 0.24), sz - dz * 0.1 + (along === 'z' ? 0.06 : 0), 0.06, 0.06, 0.06, 0x0a0806);
        mb.box(sx - dx * 0.11, fy(a + 0.12), sz - dz * 0.11, along === 'x' ? 0.16 : 0.03, 0.04, along === 'z' ? 0.16 : 0.03, lit(0xb8ae94, L));   // dientes
      }
    }
  }
  // 3) huesos y cráneos tirados en las catacumbas, hongos que brillan y huesos en la cueva
  for (let n = 0, tries = 0; n < 90 && tries < 900; tries++) {
    const x = r(G.x0, G.x0 + G.w), z = r(G.z0, G.z0 + G.h);
    if (!cataWalk(Math.floor(x), Math.floor(z)) || cataRamp(x, z)) continue;
    n++;
    const L = cataLight(x, z), q = roomOf(x, z), cave = q && q.id === 'R24';
    if (!cave && n % 3 === 0) { mb.box(x, y0 + 0.11, z, 0.22, 0.2, 0.24, lit(BONE, L)); mb.box(x + 0.05, y0 + 0.14, z + 0.12, 0.05, 0.05, 0.02, 0x0a0806); mb.box(x - 0.05, y0 + 0.14, z + 0.12, 0.05, 0.05, 0.02, 0x0a0806); }
    else if (cave && n % 4 === 0) {
      for (let k = 0; k < 5; k++) {                                      // hongos que brillan (lo sobrenatural de la cueva)
        const hx = x + r(-0.4, 0.4), hz = z + r(-0.4, 0.4), hh = r(0.08, 0.3);
        mb.box(hx, y0 + hh / 2, hz, 0.04, hh, 0.04, lit(0x8a8a78, L));
        gl.box(hx, y0 + hh + 0.03, hz, r(0.1, 0.18), 0.06, r(0.1, 0.18), [0x3ad8c8, 0x5ae8a0, 0x2ab8d8][k % 3]);
      }
    } else mb.box(x, y0 + 0.04, z, r(0.3, 0.6), 0.06, 0.06, lit(0xc8bea0, L), 0, r(0, 3), 0);   // hueso largo
  }
  // 4) charcos de agua (brillan un poco: reflejan) y de lodo
  for (const [x, z, R] of C.water) blotch(wt, x, z, R, 0x2a3a3a, 0x3a4a48, r, y0 + 0.02, 0.2);
  for (const [x, z, R] of C.mud) blotch(mb, x, z, R, lit(0x3a2e20, cataLight(x, z)), lit(0x4a3a28, cataLight(x, z)), r, y0 + 0.015, 0.2);
  // 5) las goteras: una mancha en el techo y un charquito; las gotas caen (updateCatacombs, un InstancedMesh)
  for (const [x, z] of C.drips) { mb.box(x, y1 - 0.02, z, 0.5, 0.04, 0.5, lit(0x2a2622, cataLight(x, z))); blotch(wt, x, z, 0.45, 0x3a4a4a, 0x2a3a3a, r, y0 + 0.02, 0.15); }
  CATA.drops = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x8ab0c0, transparent: true, opacity: 0.7 }), C.drips.length);
  CATA.drops.frustumCulled = false; scene.add(CATA.drops);
  CATA.dropList = C.drips.map(([x, z]) => ({ x, z, y: y0 + r(0, C.h), v: 0 }));
  CATA.m4 = new THREE.Matrix4(); CATA.v3 = new THREE.Vector3();
  // 6) las rocas grandes de la cueva: pilas de bloques irregulares, con estalagmitas alrededor
  for (const [x, z, rx, rz] of C.pillars) {
    const L = cataLight(x, z);
    for (let yy = y0; yy < y1; yy += 0.6) {
      const k = 1 - Math.abs((yy - y0) / C.h - 0.45) * 0.5;
      mb.box(x + r(-0.1, 0.1), yy + 0.3, z + r(-0.1, 0.1), rx * 2 * k + r(0, 0.3), 0.62, rz * 2 * k + r(0, 0.3), lit(ROCK[Math.floor(rr() * 4)], L * 0.9), 0, r(-0.2, 0.2), 0);
    }
    for (let k = 0; k < 4; k++) { const a = rr() * 6.28, h = r(0.4, 1.2); mb.box(x + Math.cos(a) * (rx + 0.3), y0 + h / 2, z + Math.sin(a) * (rz + 0.3), 0.25, h, 0.25, lit(ROCK[k & 3], L)); }
  }
  // 7) las antorchas: soporte de hierro, mango y llama (aditiva, titila)
  for (const [x, z, ry] of C.torches) {
    lm.setFrame(x, y0, z, ry);
    lm.box(0, 2.3, 0.02, 0.3, 0.3, 0.08, 0x2a2622); lm.box(0, 2.35, 0.2, 0.08, 0.08, 0.35, 0x3a3430, -0.5);
    lm.box(0, 2.55, 0.36, 0.12, 0.42, 0.12, 0x4a3020); lm.box(0, 2.8, 0.36, 0.2, 0.1, 0.2, 0x1a1210);
    lm.setFrame(null);
    const fx = x + Math.sin(ry) * 0.36, fz = z + Math.cos(ry) * 0.36;
    voxFire(fx, y0 + 2.85, fz, 0.7);                                     // F5.28f: la llama en cubos (antes planos)
    gl.box(fx, y0 + 2.9, fz, 0.14, 0.12, 0.14, 0xffb040);
    fakeLightAdd(fx, y0 + 2.2, fz, C.torchR * 0.8, 0xff9a4a, 1);        // F5.28f: ilumina a los zombies que pasan
  }
  // 8) las portadas de piedra de cada bajada (la de la liana H6, las 3 del templo y la de la escalera al choque)
  const portal = (x, z, ry, w) => {
    sk.setFrame(x, 0, z, ry);
    for (const s of [-1, 1]) { sk.box(s * (w / 2 + 0.4), 1.4, 0, 0.8, 2.8, 0.8, 0x6a6458); sk.box(s * (w / 2 + 0.4), 2.9, 0, 1.0, 0.2, 1.0, 0x5a5448); }
    sk.box(0, 3.2, 0, w + 1.8, 0.6, 0.9, 0x625c50);
    for (let k = 0; k < 5; k++) sk.box(-w / 2 + (k + 0.5) * w / 5, 3.2, 0.46, 0.3, 0.3, 0.02, GLY[k % 3]);   // glifos del dintel
    sk.box(0, 3.62, 0, 0.5, 0.3, 0.5, BONE); sk.box(0.1, 3.66, 0.26, 0.1, 0.08, 0.02, 0x0a0806); sk.box(-0.1, 3.66, 0.26, 0.1, 0.08, 0.02, 0x0a0806);   // cráneo arriba
    for (let k = 0; k < 6; k++) sk.box(r(-w / 2, w / 2), 3.4 - r(0, 0.8), 0.46, 0.06, r(0.4, 1.2), 0.04, MOSS[k % 3]);   // lianas y musgo
    sk.setFrame(null);
  };
  portal(30.5, 40.3, 0, 5);
  for (const R of C.ramps.slice(1, 4)) portal(54.7, (R.z1 + R.z2) / 2, Math.PI / 2, R.z2 - R.z1);
  portal(25.7, 87, Math.PI / 2, 4);
  // 9) la puerta sellada: losa de piedra con glifos y un sol maya, y 3 lámparas (una por palanca). Hija del bloque
  { const D = C.door, d = state.doors[D.id], g = new MeshBuilder(), cx = (D.x1 + D.x2) / 2, cz = (D.z1 + D.z2) / 2, w = D.z2 - D.z1;
    g.box(0, 0, 0, 0.36, C.h, w + 0.2, 0x5e584e);
    for (let k = 0; k < 9; k++) g.box(-0.19, -1.4 + Math.floor(k / 3) * 0.9, -1 + (k % 3), 0.02, 0.7, 0.7, GLY[k % 3]);
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; g.box(-0.2, 0.9 + Math.sin(a) * 0.6, Math.cos(a) * 0.6, 0.03, 0.18, 0.18, 0xb89a55); }
    g.box(-0.21, 0.9, 0, 0.03, 0.5, 0.5, 0x7a2a1e);
    const m = g.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x100c08 }));
    scene.remove(m); m.matrixAutoUpdate = true; m.userData.theme = false; d.mesh.add(m);
    for (let k = 0; k < 3; k++) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.22), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
      lamp.position.set(-0.2, 1.9, -0.7 + k * 0.7); d.mesh.add(lamp); CATA.doorLamps.push(lamp);
    }
    d.mesh.position.set(cx, (y0 - 0.3 + y0 + C.h) / 2, cz); }
  // 10) las palancas: placa de piedra en la pared, palanca que baja y una lámpara (roja; verde al bajarla)
  for (const [x, z, ry] of C.levers) {
    const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = ry; scene.add(g);
    const pb = new MeshBuilder();
    pb.box(0, 1.3, 0.02, 0.8, 1.0, 0.1, 0x4a463e); pb.box(0, 1.3, 0.07, 0.6, 0.8, 0.02, 0x5e584e);
    for (let k = 0; k < 4; k++) pb.box(-0.21 + k * 0.14, 1.62, 0.09, 0.1, 0.1, 0.02, GLY[k % 3]);
    const pm = pb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x141008 }));
    scene.remove(pm); pm.matrixAutoUpdate = true; pm.userData.theme = false; g.add(pm);
    const handle = new THREE.Group(); handle.position.set(0, 1.25, 0.12); handle.rotation.x = 0.7; g.add(handle);
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.08), new THREE.MeshLambertMaterial({ color: 0x6a5a4a, emissive: 0x1a120a }));
    stick.position.y = 0.27; handle.add(stick);
    const knob = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), new THREE.MeshLambertMaterial({ color: 0xd8cfb4, emissive: 0x2a2418 }));
    knob.position.y = 0.58; handle.add(knob);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
    lamp.position.set(0.3, 1.72, 0.1); g.add(lamp);
    CATA.levers.push({ x: x + Math.sin(ry) * 0.6, z: z + Math.cos(ry) * 0.6, g, handle, lamp, on: false, k: 0 });
  }
  // 11) las plantas carnívoras: maceta de piedra (sólida), tallo y cabeza (las de los jardines)
  const S = CONFIG.GARDEN.headScale;
  for (const [x, z] of C.plants) {
    lm.box(x, y0 + 0.45, z, 0.8, 0.9, 0.8, 0x5e584e); lm.box(x, y0 + 0.92, z, 0.9, 0.08, 0.9, 0x4a463e);
    for (let k = 0; k < 4; k++) lm.box(x + (k & 1 ? 0.41 : -0.41), y0 + 0.5, z + (k & 2 ? 0.2 : -0.2), 0.02, 0.2, 0.2, GLY[k % 3]);
    plantStem(lm, x, y0 + 0.95, z, S, false);
    const h = makePlantHead(x, y0 + 0.95 + 0.7 * S + 0.05, z, S, false);
    CATA.plants.push(Object.assign(h, { x, z, open: 0.12, spitT: randIn(C.plantEvery) }));
  }
  // 12) el Sombrerón muerto, sentado contra la pared en la puerta de la cueva, con sangre
  { const [x, z, ry] = C.sombreron, suit = 0x1a1a1e, skin = 0x6a7a5a, silver = 0xc8c8c0, blood = 0x3a0404, L = cataLight(x, z);
    lm.setFrame(x, y0, z, ry);
    blotch(lm, 0, 0.6, 1.4, 0x220202, blood, r);
    lm.box(0, 0.3, 0.9, 1.3, 0.5, 1.4, suit);                              // piernas estiradas (sentado)
    lm.box(-0.35, 0.3, 1.75, 0.4, 0.55, 0.4, 0x3a2412); lm.box(0.35, 0.3, 1.75, 0.4, 0.55, 0.4, 0x3a2412);   // botas
    lm.box(0, 1.25, 0.05, 1.4, 1.5, 0.8, suit, -0.12, 0, 0);               // torso contra la pared
    for (let k = 0; k < 5; k++) lm.box(0, 0.8 + k * 0.22, 0.47, 0.06, 0.04, 0.03, silver);   // botones
    lm.box(-0.2, 1.3, 0.47, 0.6, 0.7, 0.03, blood); lm.box(0.3, 0.9, 0.47, 0.3, 0.6, 0.03, 0x5a0808);   // sangre en el pecho
    lm.box(-0.85, 1.0, 0.55, 0.35, 0.35, 1.1, suit, 0.6, 0, 0); lm.box(0.85, 0.7, 0.75, 0.35, 0.35, 0.9, suit);   // brazos caídos
    lm.box(0.9, 0.35, 1.2, 0.3, 0.2, 0.35, skin);                         // mano en el piso
    lm.box(0.12, 2.3, 0.2, 0.7, 0.66, 0.66, skin, 0.35, 0, 0.35);          // la cabeza caída de costado
    lm.box(0.15, 2.3, 0.56, 0.12, 0.06, 0.03, 0x0a0a0a, 0.35, 0, 0.35); lm.box(0.4, 2.35, 0.5, 0.12, 0.06, 0.03, 0x0a0a0a, 0.35, 0, 0.35);   // ojos
    lm.box(0.25, 2.1, 0.58, 0.44, 0.08, 0.04, 0x2a1a10, 0.35, 0, 0.35);   // bigote
    lm.box(0.3, 1.75, 0.55, 0.05, 0.55, 0.03, blood);                      // sangre de la boca
    lm.box(0.3, 2.95, 0.1, 1.9, 0.1, 1.9, 0x2a2018, 0.4, 0, 0.45); lm.box(0.4, 3.25, 0.05, 0.75, 0.5, 0.75, 0x2a2018, 0.4, 0, 0.45);   // el sombrero ladeado
    lm.box(0.4, 3.05, 0.05, 0.8, 0.08, 0.8, silver, 0.4, 0, 0.45);
    lm.box(-1.4, 0.5, 1.3, 0.8, 0.14, 0.6, 0x4a2c14, 0, 0.6, 1.2); lm.box(-1.2, 1.1, 1.0, 0.12, 1.3, 0.1, 0x2e1e10, 0, 0.6, 0.6);   // la guitarra rota
    for (let k = 0; k < 6; k++) lm.box(r(-0.7, 0.7), r(0.5, 2.6), -0.38, r(0.1, 0.3), r(0.4, 1.0), 0.02, k % 2 ? blood : 0x5a0808);   // sangre en la pared
    lm.setFrame(null); }
  // los meshes
  const put = (B, mat) => { const m = B.mesh(mat); if (m) { m.userData.theme = false; m.updateMatrix(); CATA.meshes.push(m); } return m; };
  put(mb, new THREE.MeshBasicMaterial({ vertexColors: true }));
  CATA.skyMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  put(sk, CATA.skyMat);
  put(wt, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false }));
  put(gl, new THREE.MeshBasicMaterial({ vertexColors: true }));
  put(lm, new THREE.MeshLambertMaterial({ vertexColors: true }));
  CATA.built = true;
}
