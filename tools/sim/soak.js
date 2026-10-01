// V2 F5.24: prueba de resistencia ("soak"). Juega partidas enteras en Node con el código real (gameUpdate, el mismo
// frame que en el navegador, sin dibujar) y un bot que camina por el grid a lugares al azar (los 3 niveles), pelea,
// acuchilla, tira granadas y langostinos, compra lo que tiene enfrente, abre el mapa y salta. Mientras juega mira
// invariantes y junta PROBLEMAS; al final imprime un resumen corto (pocas líneas: barato de leer) y guarda el detalle
// en soak-report.json.
//
// Uso:  node soak.js [partidas=6] [minutos de juego=4] [semilla=1] [escenario]
//   escenarios: casa · todo · templo · noche · (sin nada = rotan)
//   El resultado depende solo de la semilla: una falla se repite con la misma semilla y escenario.
//
// Qué busca: excepciones (con el primer renglón del stack), NaN en posiciones o vida, el jugador metido en un sólido o
// cayéndose del mapa, zombies perdidos o afuera del grid, rondas trabadas (sin zombies y sin avanzar), la escena o los
// colliders que crecen (fugas), frames lentos (dónde y con cuántos zombies), estados de la planta colgados, y lugares
// donde el bot se traba (posibles paredes invisibles o escalones).
const path = require('path'), fs = require('fs');
const RUNS = +(process.argv[2] || 6), MINS = +(process.argv[3] || 4), SEED0 = +(process.argv[4] || 1), ONLY = process.argv[5] || null;

// azar con semilla (el juego usa Math.random: lo mismo con la misma semilla)
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
Math.random = mulberry(12345);   // el arranque del mundo, siempre igual (así una semilla se repite sola)
// SOAK_TRACE="t0,t1": imprime la posición y el estado del jugador frame a frame entre t0 y t1 (para reproducir una falla)
const TRACE = process.env.SOAK_TRACE ? process.env.SOAK_TRACE.split(',').map(Number) : null;

// los avisos del juego (console.warn) cuentan como problemas; los del gobernador de calidad no (en Node siempre salta)
const WARNS = new Map(), warn0 = console.warn;
console.warn = (...a) => { const m = a.join(' '); if (/^\[calidad\]/.test(m)) return; WARNS.set(m, (WARNS.get(m) || 0) + 1); };
const G = require('./harness.js');
const { state, player, CONFIG, roundState, keys, weaponsState } = G;
CONFIG.DOGS.enabled = true; CONFIG.BOSS.enabled = true; CONFIG.BARRIERS.enabled = true; CONFIG.PLANTBOSS.enabled = true;
G.resetPlantBoss();
const P = CONFIG.PLAYER, DT = 1 / 30, SCEN = ['casa', 'todo', 'templo', 'noche'];

// lugares que interesan (x, z, nivel): la nave del templo, el caparazón en sus 3 niveles, el muelle de arriba, la cabeza
// del calamar, el rancho, la playa, el claro, el charco del portal
// (la galería de adentro de la cabeza del calamar [-88,-45,1] solo existe desde la R13: si no está, no cuenta como problema)
const HOT = [[89, 70, 1], [89, 60, 1], [70, 62, 0], [-51, 88, 0], [-59, 88, 1], [-50, 95, 2], [-60, -45, 1], [-88, -50, 0],
             [-88, -45, 1], [-65, 30, 0], [0, -14, 0], [-60, 60, 0], [0, 11, 0], [20, 12, 0], [-10, 35, 0], [-78, -24.5, 0],
             [0, -40, 0], [-24, -78, 0], [-51, 72, 0], [-75, 25, 0], [40, 84, 0],
             // F5.28e: las catacumbas, la cueva del búnker y el hall de la puerta de las palancas (abajo, a -6: nivel 0)
             [10, 45.5, 0], [16, 71.5, 0], [-25, 60, 0], [-12.5, 80, 0], [39.5, 60.5, 0]];
const HOP = 50;   // fuera de "casa", cada HOP s el bot salta a un lugar de HOT (así recorre todo el mapa en pocos minutos)

const issues = new Map();   // clave -> { n, first: {seed, t, where}, msg }
function issue(kind, msg, where, seed, t) {
  const k = kind + '|' + msg;
  const e = issues.get(k) || { kind, msg, n: 0, seeds: new Set(), first: null };
  e.n++; e.seeds.add(seed); if (!e.first) e.first = { seed, t: +t.toFixed(1), where };
  issues.set(k, e);
}
const where = () => {
  const r = G.roomAt(player.pos.x, player.pos.z);
  return `${player.pos.x.toFixed(1)},${player.pos.y.toFixed(1)},${player.pos.z.toFixed(1)} L${G.playerLevel()} ${r ? r.id : '-'} R${state.round}`;
};
const stuckSpots = new Map(), stuckInfo = new Map();
const perf = [];

function countScene() { let n = 0; G.scene.traverse(() => n++); return n; }

function setupScenario(sc) {
  G.resetGame(); G.MENU.started = true; G.showMenu(null); state.running = true;
  if (sc === 'casa') { G.startRound(1); return; }
  G.debugUnlockAll(); state.points = 1e6;
  if (sc === 'todo') G.startRound(4 + Math.floor(Math.random() * 10));
  else if (sc === 'noche') G.startRound(15 + Math.floor(Math.random() * 15));
  else if (sc === 'templo') {
    G.startRound(12);
    player.pos.set(70, G.groundY(70, 62) + P.height, 62); player.vel.set(0, 0, 0);
  }
}

function runOne(seed, sc) {
  Math.random = mulberry(seed * 104729 + 17);
  setupScenario(sc);
  const bot = { target: null, tdist: new Int16Array(G.NAV.total), via: null, lastMove: { x: player.pos.x, z: player.pos.z, t: 0 },
                t: 0, deaths: 0, kills0: 0, mapT: 0, grenT: 0, god: Math.floor(seed / 4) % 2 === 0, hopT: HOP };
  const scene0 = countScene(), cols0 = G.WORLD.colliders.length, hit0 = G.WORLD.hitMeshes.length;
  let t = 0, lastRound = state.round, roundT = 0, frames = 0, grabT = 0, trapT = 0, walked = 0, px0 = player.pos.x, pz0 = player.pos.z;
  const rooms = new Set(), hist = [];
  const times = [];
  const newTarget = () => {
    let i = -1;
    if (Math.random() < 0.35) {                                            // un lugar que interesa
      const h = HOT[Math.floor(Math.random() * HOT.length)];
      const c = G.lvCellIdx(h[2], Math.floor(h[0]), Math.floor(h[1]));
      if (c >= 0 && G.FLOW.dist[c] >= 0) i = c;
    }
    for (let k = 0; k < 300 && i < 0; k++) {                               // o una celda alcanzable al azar
      const c = Math.floor(Math.random() * G.NAV.total);
      if (G.FLOW.dist[c] > 8) i = c;
    }
    if (i < 0) return;
    const [x, z] = G.idxCenter(i), L = G.idxLevel(i);
    bot.target = { i, x, z, L }; bot.via = null;
    G.flowFrom(x, z, L, 0, bot.tdist, false);
  };
  const stepToward = (x, z) => { player.yaw = Math.atan2(-(x - player.pos.x), -(z - player.pos.z)); keys.KeyW = true; };
  const moveBot = () => {
    keys.KeyW = false;
    if (!bot.target || Math.random() < 0.002) newTarget();
    const T = bot.target; if (!T) return;
    const L = G.playerLevel(), cx = Math.floor(player.pos.x), cz = Math.floor(player.pos.z), ci = G.lvCellIdx(L, cx, cz), D = bot.tdist;
    if (ci >= 0 && D[ci] >= 0 && D[ci] <= 1) { newTarget(); return; }
    if (bot.via && bot.via.length) {                                        // escalera: su recorrido
      const v = bot.via[0];
      if (Math.hypot(v[0] - player.pos.x, v[1] - player.pos.z) < 0.6) bot.via.shift(); else stepToward(v[0], v[1]);
      return;
    }
    let best = ci >= 0 && D[ci] >= 0 ? D[ci] : 1e9, bx = null, bz = null;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      if (!dx && !dz) continue;
      const j = G.lvCellIdx(L, cx + dx, cz + dz);
      if (j >= 0 && D[j] >= 0 && D[j] < best && (Math.abs(dx) < 2 && Math.abs(dz) < 2 || ci < 0 || D[ci] < 0)) { best = D[j]; bx = cx + dx + 0.5; bz = cz + dz + 0.5; }
    }
    const li = ci >= 0 ? G.NAV.link[ci] : -1;
    if (li >= 0 && D[li] >= 0 && D[li] < best) {                             // escalera o enlace
      if (G.NAV.via[ci]) { bot.via = G.NAV.via[ci].map(p => p.slice()); const c2 = G.idxCenter(li); bot.via.push(c2); return; }
      const c2 = G.idxCenter(li);                                           // escalerita de la pileta o escotilla: el jugador no trepa
      player.pos.set(c2[0], (G.idxLevel(li) ? G.lvY(G.idxLevel(li)) : G.groundY(c2[0], c2[1])) + P.height, c2[1]);
      return;
    }
    if (bx !== null) stepToward(bx, bz);
    else if (ci >= 0 && D[ci] >= 0) newTarget();                            // mínimo local (puerta cerrada, enlace): otro destino
    else stepToward(T.x, T.z);
  };
  const fight = () => {
    // en Node nadie dibuja: las matrices de los zombies (las partes que reciben balas) se actualizan a mano
    for (const z of state.zombies) if (z.alive && z.root) z.root.updateMatrixWorld(true);
    let best = null, bd = 18;
    for (const z of state.zombies) {
      if (!z.alive || (z.level || 0) !== G.playerLevel()) continue;
      const d = Math.hypot(z.px - player.pos.x, z.pz - player.pos.z);
      if (d < bd && G.segmentClear(player.pos.x, player.pos.z, z.px, z.pz, 0, true)) { bd = d; best = z; }
    }
    if (!best) return false;
    keys.KeyW = bd > 6 && Math.random() < 0.3;
    G.setCam(Math.atan2(-(best.px - player.pos.x), -(best.pz - player.pos.z)));
    if (bd < 1.8) G.meleeAttack();
    else {
      const def = G.curDef();
      if (def && def.dual) G.fireWeapon(Math.random() < 0.5 ? 'L' : 'R'); else G.fireWeapon();
    }
    return true;
  };
  while (t < MINS * 60) {
    // el bot
    try {
      if (state.running && !G.BUNK.travel) {
        const fighting = fight();
        if (!fighting) moveBot();
        keys.Space = Math.random() < 0.01;
        if (Math.random() < 0.004) { G.interact(); }                          // comprar / usar lo que tenga enfrente
        if (Math.random() < 0.002 && state.grenades > 0) { keys.KeyG = true; G.startCook(); bot.grenT = 0.5; }
        if (bot.grenT > 0 && (bot.grenT -= DT) <= 0) keys.KeyG = false;
        if (Math.random() < 0.001) G.throwMonkey();
        if (Math.random() < 0.002) G.switchWeapon(1);
        if (Math.random() < 0.002) { G.toggleMap(true); bot.mapT = 2; }
        if (bot.mapT > 0 && (bot.mapT -= DT) <= 0) G.toggleMap(false);
        if (bot.god) { state.health = G.maxHealth(); state.lastDamageTime = -99; }
        if (sc !== 'casa' && (bot.hopT -= DT) <= 0) {                        // salto a otro lugar del mapa
          bot.hopT = HOP;
          const h = HOT[Math.floor(Math.random() * HOT.length)], Lh = h[2];
          const ok = Lh === 2 ? G.isUp2(Math.floor(h[0]), Math.floor(h[1])) : Lh === 1 ? G.isUp(Math.floor(h[0]), Math.floor(h[1])) : G.isNav(Math.floor(h[0]), Math.floor(h[1]));
          if (ok) {
            player.pos.set(Math.floor(h[0]) + 0.5, (Lh ? G.lvY(Lh) : G.groundY(h[0], h[1])) + P.height, Math.floor(h[1]) + 0.5);
            player.vel.set(0, 0, 0); bot.target = null; bot.lastMove = { x: player.pos.x, z: player.pos.z, t };
            G.updateFlowField(true);
          } else if (!(h[0] === -88 && h[2] === 1)) issue('BOT', 'lugar de la lista fuera del grid: ' + h.join(','), '-', seed, t);
        }
      }
    } catch (e) { issue('EXCEPCION-BOT', String(e.message).slice(0, 120), where(), seed, t); }
    // el frame del juego
    const t0 = process.hrtime.bigint();
    try { G.tick(DT); G.gameUpdate(DT); }
    catch (e) {
      const st = (e.stack || '').split('\n').slice(1, 3).map(s => s.trim().replace(/\(.*?evalmachine.*?:(\d+):\d+\)/, 'L$1')).join(' | ');
      issue('EXCEPCION', String(e.message).slice(0, 120) + ' @ ' + st.slice(0, 140), where(), seed, t);
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    times.push(ms);
    if (ms > 25) perf.push({ ms: +ms.toFixed(1), seed, sc, t: +t.toFixed(1), where: where(), zombies: state.zombies.filter(z => z.alive).length });
    t += DT; frames++;
    if (TRACE && t >= TRACE[0] && t <= TRACE[1]) {
      const T = G.PLANTB.tg, TR = G.PLANTB.trap;
      console.log(`t=${t.toFixed(2)} ${where()} vy=${player.vel.y.toFixed(2)} gr=${player.grounded} tongue=${T ? T.state : '-'} trap=${TR ? TR.state : '-'} travel=${!!G.BUNK.travel} run=${state.running}`);
    }
    // invariantes (cada 0.5 s)
    if (frames % 15 === 0) {
      const p = player.pos, st = Math.hypot(p.x - px0, p.z - pz0);
      {                                                                      // rastro de las últimas 5 s (para explicar una falla)
        const T = G.PLANTB.tg, TR = G.PLANTB.trap;
        hist.push(`${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}${T && T.state !== 'off' ? ' lengua:' + T.state : ''}${TR && TR.state !== 'off' ? ' jaula:' + TR.state : ''}${G.BUNK.travel ? ' viaje' : ''}${player.grounded ? '' : ' aire'}`);
        if (hist.length > 10) hist.shift();
      }
      if (st < 8) walked += st;                                              // (los saltos grandes son teletransportes)
      px0 = p.x; pz0 = p.z;
      const rm = G.roomAt(p.x, p.z); if (rm) rooms.add(rm.id + (G.playerLevel() ? '^' + G.playerLevel() : ''));
      if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) { issue('NAN', 'posición del jugador NaN', where(), seed, t); player.pos.set(0, P.height, 0); }
      if (!isFinite(state.health) || !isFinite(state.points)) issue('NAN', 'vida o puntos NaN', where(), seed, t);
      if (state.points < 0) issue('ESTADO', 'puntos negativos', where(), seed, t);
      const s = G.curSlot(); if (s && (s.mag < 0 || s.reserve < 0)) issue('ESTADO', 'munición negativa (' + s.id + ')', where(), seed, t);
      if (p.y < -12 || p.x < G.NAV.minX - 2 || p.z < G.NAV.minZ - 2 || p.x > G.NAV.minX + G.NAV.w + 2 || p.z > G.NAV.minZ + G.NAV.h + 2) {
        issue('MAPA', 'el jugador se cayó / salió del mapa', where(), seed, t);
        setupScenario(sc);
      }
      // metido adentro de un sólido (a la altura del cuerpo)
      const feet = p.y - P.height;
      if (state.running && !G.BUNK.travel) for (const c of G.WORLD.colliders) {
        if (!c.solid || c.zombieOnly || c.maxY < feet + 0.4 || c.minY > feet + 1.2) continue;
        if (p.x > c.minX + 0.15 && p.x < c.maxX - 0.15 && p.z > c.minZ + 0.15 && p.z < c.maxZ - 0.15) {
          issue('COLISION', 'jugador adentro de ' + (c.tag || '?'), where() + ' · antes: ' + hist.slice(-10).join(' > '), seed, t); break;
        }
      }
      for (const z of state.zombies) {
        if (!z.alive) continue;
        if (!isFinite(z.px) || !isFinite(z.pz) || !isFinite(z.health)) issue('NAN', 'zombie con NaN (' + (z.kind || 'normal') + ')', where(), seed, t);
        else if (G.navIdx(Math.floor(z.px), Math.floor(z.pz)) < 0) issue('ZOMBIE', 'zombie afuera del grid (' + (z.kind || 'normal') + ')', `${z.px.toFixed(1)},${z.pz.toFixed(1)}`, seed, t);
        if (z.mode === 'lost' || z.mode === 'unreachable') issue('ZOMBIE', 'zombie ' + z.mode, `${z.px.toFixed(1)},${z.pz.toFixed(1)} L${z.level || 0}`, seed, t);
      }
      // planta: estados colgados
      if (G.PLANTB.tg && G.PLANTB.tg.state === 'grab') grabT += 0.5; else grabT = 0;
      if (grabT > 15) issue('PLANTA', 'la lengua te tiene agarrado más de 15 s', where(), seed, t);
      if (G.PLANTB.trap && G.PLANTB.trap.state === 'hold') trapT += 0.5; else trapT = 0;
      if (trapT > 6) issue('PLANTA', 'la jaula de raíces no te suelta', where(), seed, t);
      // ronda trabada: con la ronda activa, sin nadie vivo y sin avanzar 120 s
      if (state.round !== lastRound) { lastRound = state.round; roundT = 0; } else roundT += 0.5;
      const alive = state.zombies.filter(z => z.alive).length;
      if (roundT > 120 && alive === 0 && state.running && roundState.phase === 'active') { issue('RONDA', 'ronda trabada sin zombies (fase ' + roundState.phase + ')', where(), seed, t); roundT = -1e9; }
      // el bot trabado (moviéndose y sin avanzar 4 s): posibles paredes invisibles o escalones
      if (keys.KeyW && state.running) {
        if (Math.hypot(p.x - bot.lastMove.x, p.z - bot.lastMove.z) > 0.5) bot.lastMove = { x: p.x, z: p.z, t };
        else if (t - bot.lastMove.t > 4) {
          const k = `${Math.round(p.x / 2) * 2},${Math.round(p.z / 2) * 2} L${G.playerLevel()}`;
          stuckSpots.set(k, (stuckSpots.get(k) || 0) + 1);
          if (!stuckInfo.has(k)) {                                           // el primer caso: a dónde iba y qué tenía al lado
            const L = G.playerLevel(), cx = Math.floor(p.x), cz = Math.floor(p.z), ci = G.lvCellIdx(L, cx, cz);
            stuckInfo.set(k, { seed, sc, t: +t.toFixed(1), pos: [+p.x.toFixed(2), +p.z.toFixed(2)], yaw: +player.yaw.toFixed(2),
              target: bot.target && [bot.target.x, bot.target.z, bot.target.L], distHere: ci >= 0 ? bot.tdist[ci] : null,
              via: !!bot.via, room: (G.roomAt(p.x, p.z) || {}).id });
          }
          bot.lastMove = { x: p.x, z: p.z, t }; newTarget();
        }
      } else bot.lastMove = { x: p.x, z: p.z, t };
    }
    // muerte: esperar la cinemática un poco y volver a empezar
    if (!state.running) {
      if (state.gameOver) { bot.deaths++; setupScenario(sc); }
      else { state.running = true; }
    }
    // fugas: cada minuto
    if (frames % 1800 === 0) {
      const n = countScene();
      if (n > scene0 + 60) issue('FUGA', `la escena crece (${scene0} -> ${n} objetos)`, where(), seed, t);
      if (G.WORLD.colliders.length !== cols0) issue('FUGA', `los colliders cambian (${cols0} -> ${G.WORLD.colliders.length})`, where(), seed, t);
      if (G.WORLD.hitMeshes.length > hit0 + 10) issue('FUGA', `hitMeshes crece (${hit0} -> ${G.WORLD.hitMeshes.length})`, where(), seed, t);
    }
  }
  times.sort((a, b) => a - b);
  return { seed, sc, round: state.round, deaths: bot.deaths, kills: state.kills, god: bot.god, walked: Math.round(walked), rooms: [...rooms],
           p50: times[Math.floor(times.length * 0.5)], p99: times[Math.floor(times.length * 0.99)], max: times[times.length - 1] };
}

const results = [];
const t00 = Date.now();
for (let r = 0; r < RUNS; r++) {
  const seed = SEED0 + r, sc = ONLY || SCEN[r % SCEN.length];
  results.push(runOne(seed, sc));
}
// ---- resumen corto ----
console.log(`SOAK ${RUNS} partidas × ${MINS} min de juego (semillas ${SEED0}..${SEED0 + RUNS - 1}) en ${((Date.now() - t00) / 1000).toFixed(0)} s reales`);
for (const r of results) console.log(`  #${r.seed} ${r.sc.padEnd(6)} ${r.god ? 'dios ' : 'mortal'} ronda ${r.round} kills ${r.kills} muertes ${r.deaths} caminó ${r.walked} m zonas ${r.rooms.length}  frame p50 ${r.p50.toFixed(2)} p99 ${r.p99.toFixed(1)} max ${r.max.toFixed(0)} ms`);
const allRooms = new Set(results.flatMap(r => r.rooms));
console.log('  zonas visitadas: ' + [...allRooms].sort().join(' '));
for (const [m, n] of WARNS) issue('AVISO', m.slice(0, 120), '-', 0, 0);
const list = [...issues.values()].sort((a, b) => b.n - a.n);
console.log(list.length ? `PROBLEMAS (${list.length} distintos):` : 'SIN PROBLEMAS');
for (const e of list.slice(0, 25)) console.log(`  [${e.kind}] ×${e.n} ${e.msg}  — 1ra: semilla ${e.first.seed} t=${e.first.t}s en ${e.first.where}`);
const spots = [...stuckSpots.entries()].sort((a, b) => b[1] - a[1]);
if (spots.length) console.log('BOT TRABADO (x,z nivel ×veces): ' + spots.slice(0, 10).map(([k, n]) => `${k} ×${n}`).join(' · '));
for (const [k, n] of spots.slice(0, 3)) if (n >= 3) console.log('  ' + k + ': ' + JSON.stringify(stuckInfo.get(k)));
perf.sort((a, b) => b.ms - a.ms);
if (perf.length) console.log('FRAMES LENTOS (>25 ms): ' + perf.length + ' · peor ' + perf.slice(0, 3).map(f => `${f.ms}ms #${f.seed} ${f.where} (${f.zombies} z)`).join(' · '));
fs.writeFileSync(path.join(__dirname, 'soak-report.json'), JSON.stringify({ results, issues: list.map(e => ({ ...e, seeds: [...e.seeds] })), stuck: spots, perf: perf.slice(0, 50) }, null, 1));
process.exit(0);
