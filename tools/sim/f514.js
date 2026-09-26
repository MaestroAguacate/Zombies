// V2 F5.14: fumigador (porche o playa), 9 almejas que cambian de color cada 3–4 rondas, premios por color,
// la pieza de la Ola sale de la almeja morada (ya no de la palmera), calamar grande que sale escarbando, Ola más
// grande (12 m, ±40°) con cresta, anillo y salpicadura.
const G = require('./harness.js');
const { state, player, CONFIG, roundState, CLAMS, QUEST, NAV, WORLD, weaponsState } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, P = CONFIG.PLAYER, C = CONFIG.CLAMS;
CONFIG.POWERUPS.dropChance = 0;
function fresh() { G.resetGame(); state.running = true; state.round = 8; roundState.phase = 'active'; state.points = 50000; state.health = 100; G.debugOpenAllDoors(); }
function clearZ() { for (const q of state.zombies) { q.active = q.alive = false; q.root.visible = false; } state.zombies.length = 0; }
const nearNav = (x, z) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (G.flowAt(Math.floor(x) + dx, Math.floor(z) + dz) >= 0) return true; return false; };
const at = (x, z) => { player.pos.set(x, G.groundY(x, z) + P.height, z); G.updateInteract(); };
const prompt = () => G.interactState.kind ? G.promptFor(G.interactState).text : '(nada)';
function hold(secs) {
  G.keys.KeyF = true;
  for (let i = 0; i < Math.round(secs * 60); i++) { G.tick(dt); G.updateClams(dt); }
  G.keys.KeyF = false;
}

// 1) lugares
fresh();
player.pos.set(0, P.height, 0); G.updateFlowField(true);
const L = CLAMS.list;
check(L.length === 9, '9 almejas');
check(L.every(c => G.roomAt(c.x, c.z) && G.roomAt(c.x, c.z).id === c.room), 'cada una en su cuarto', L.map(c => c.room).join(' '));
check(new Set(L.map(c => c.room)).size >= 8, 'repartidas por el mapa (8 cuartos distintos o más)');
check(L.every(c => nearNav(c.x, c.z)), 'se llega a todas');
check(!WORLD.colliders.some(c => /clam|almeja/.test(c.tag)), 'sin collider (no tocan el grid)');

// 2) fumigador
const rooms = new Set();
for (let i = 0; i < 60; i++) { G.resetGame(); rooms.add(CLAMS.fum.room); }
check(rooms.has('R1') && rooms.has('R10') && [...rooms].every(r => r === 'R1' || r === 'R10'), 'el fumigador sale en el porche o en la playa', [...rooms].join(' '));
fresh();
const F = CLAMS.fum;
check(F.g.visible && !CLAMS.have && nearNav(F.x, F.z), 'arranca en el piso, visible y alcanzable');
at(F.x + 0.6, F.z);
check(G.interactState.kind === 'fumigator' && prompt() === '[F] Take FUMIGATOR', 'cartel del fumigador');
check(G.interact() && CLAMS.have && !F.g.visible, 'F lo agarra');
at(F.x + 0.6, F.z);
check(G.interactState.kind !== 'fumigator', 'no se agarra dos veces');

// 3) colores: cada una avanza sola cada 3–4 rondas, en orden
fresh();
check(L.every(c => c.stage === 0), 'arrancan vacías');
const hist = L.map(() => []);
for (let n = 1; n <= 40; n++) { G.clamsRound(n); L.forEach((c, i) => { const h = hist[i]; if (!h.length || h[h.length - 1].s !== c.stage) h.push({ n, s: c.stage }); }); }
let orderOk = true, gapOk = true;
for (const h of hist) for (let k = 1; k < h.length; k++) {
  if (h[k].s !== (h[k - 1].s + 1) % 4) orderOk = false;
  if (k > 1 && (h[k].n - h[k - 1].n < 3 || h[k].n - h[k - 1].n > 4)) gapOk = false;
}
check(orderOk, 'vacía -> verde -> amarilla -> morada -> vacía');
check(gapOk, 'cambian cada 3 o 4 rondas');
check(new Set(L.map(c => c.next)).size > 1, 'no cambian todas juntas');

// 4) abrir: sin fumigador no, manteniendo F 1.5 s sí, una vez por color
fresh(); clearZ();
const c0 = L[1];                                        // jardín trasero
c0.stage = 1; c0.used = false;
at(c0.x + 0.8, c0.z);
check(G.interactState.target === c0 && prompt() === 'GREEN clam - you need the fumigator', 'sin fumigador: cartel', `("${prompt()}")`);
hold(2);
check(!c0.used, 'sin fumigador no se abre');
CLAMS.have = true; G.updateInteract();
check(prompt() === '[F] Hold: fumigate GREEN clam', 'con fumigador: mantener F', `("${prompt()}")`);
hold(1.4);
check(!c0.used, 'a los 1.4 s todavía no');
G.keys.KeyF = false; G.tick(dt); G.updateClams(dt);
check(CLAMS.holdT === 0, 'soltar F corta');
hold(1.55);
check(c0.used && CLAMS.last && c0.openT > 0, 'a los 1.5 s se abre y da el premio', `(${CLAMS.last})`);
hold(2);
check(c0.used && prompt() === 'Empty clam', 'da una sola cosa por color: queda vacía');
G.clamsRound(c0.next);
check(c0.stage === 2 && !c0.used, 'al cambiar de color vuelve a dar');

// 5) pesos por color
function dist(stage, N) { const o = {}; for (let i = 0; i < N; i++) { const k = G.rollClam(stage).replace(/^weapon:.*/, 'weapon'); o[k] = (o[k] || 0) + 1 / N; } return o; }
fresh();
const near = (a, b) => Math.abs((a || 0) - b) < 0.04;
let d = dist(1, 4000);
check(near(d.zombie, 0.5) && near(d.powerup, 0.25) && near(d.weapon, 0.25), 'verde: zombie 50 · power-up 25 · arma 25', JSON.stringify(d));
d = dist(2, 4000);
check(near(d.squid, 0.5) && near(d.powerup, 0.25) && near(d.weapon, 0.25), 'amarilla: calamar 50 · power-up 25 · arma 25', JSON.stringify(d));
d = dist(3, 4000);
check(near(d.piece, 0.35) && near(d.bigsquid, 0.4) && near(d.weapon, 0.25), 'morada: pieza 35 · calamar grande 40 · arma 25', JSON.stringify(d));
state.quest.coconut = true;
d = dist(3, 4000);
check(!d.piece && near(d.bigsquid, 0.4 / 0.65) && near(d.weapon, 0.25 / 0.65), 'con la pieza ya sacada, no sale más', JSON.stringify(d));
const wv = { 1: new Set(), 2: new Set(), 3: new Set() };
for (let i = 0; i < 400; i++) for (const s of [1, 2, 3]) { const k = G.rollClam(s); if (k.startsWith('weapon:')) wv[s].add(k.slice(7)); }
check([...wv[1]].join() === 'sniper' && [...wv[2]].sort().join() === 'revolver,shotgun' && [...wv[3]].sort().join() === 'crossbow,rifle',
  'armas: francotirador / escopeta o revólver / rifle o ballesta');

// 6) cada premio
fresh(); clearZ();
const c1 = L[5];
let n0 = state.zombies.length;
G.openClam(c1, 'zombie');
let q = state.zombies[state.zombies.length - 1];
check(state.zombies.length === n0 + 1 && q.kind === 'normal' && q.state === 'emerge' && q.fromClam && Math.hypot(q.px - c1.x, q.pz - c1.z) < 2,
  'zombie: sale del piso al lado de la almeja');
clearZ(); G.openClam(c1, 'squid'); q = state.zombies[0];
check(q && q.squid && q.state === 'emerge', 'calamar: sale del piso');
const hpSquid = q.health;
clearZ(); G.openClam(c1, 'bigsquid'); q = state.zombies[0];
check(q && q.squid && q.size > 1.5 && Math.abs(q.health - hpSquid * C.bigSquid.healthMul) < 1e-6 && q.emergeT === C.bigSquid.emerge,
  'calamar grande: más grande, ×' + C.bigSquid.healthMul + ' de vida', `(tamaño ${q && q.size.toFixed(2)})`);
for (let i = 0; i < 60 * 4; i++) { G.tick(dt); G.updateZombies(dt); }
check(q.state === 'emerge', 'y tarda en salir escarbando (a los 4 s sigue saliendo)');
for (let i = 0; i < 60 * 2.2; i++) { G.tick(dt); G.updateZombies(dt); }
check(q.state !== 'emerge', 'a los 6 s ya salió');
clearZ();
G.resetZombie(q, { x: 0, z: 0 }, false);
check(q.emergeT === 0 && q.digDepth === 1 && !q.fromClam, 'el pool vuelve normal');
q.active = q.alive = false; clearZ();
const pk0 = G.PICKUPS.pool.filter(p => p.active).length;
G.openClam(c1, 'powerup');
check(G.PICKUPS.pool.filter(p => p.active).length === pk0 + 1, 'power-up: aparece al lado');
G.openClam(c1, 'weapon:sniper');
check(!state.weapons.some(w => w.id === 'sniper') && c1.offer && c1.offer.id === 'sniper', 'arma: queda flotando, no te la da sola');
check(G.clamPress({ kind: 'clam', target: c1 }) && state.weapons.some(w => w.id === 'sniper') && !c1.offer, 'con F la agarrás');
// pieza
fresh();
check(G.pieceAvailable(), 'la pieza está disponible');
const c2 = L[3];
G.openClam(c2, 'piece');
for (let i = 0; i < 60 * 2; i++) { G.tick(dt); G.updateQuest(dt); }
check(QUEST.coco.phase === 'ground' && QUEST.coco.room === c2.room && Math.hypot(QUEST.coco.x - c2.x, QUEST.coco.z - c2.z) < 1, 'pieza: cae al lado de la almeja');
check(!G.pieceAvailable(), 'ya no sale otra');
at(QUEST.coco.x + 0.5, QUEST.coco.z);
check(G.interactState.kind === 'qpiece' && G.interact() && state.quest.coconut, 'F la recoge (cuenta como el coco de la quest)');
// la palmera ya no da el coco
fresh();
check(CONFIG.QUEST.palmCoco === false, 'la palmera ya no da el coco');

// 7) Ola más grande
const W = CONFIG.WEAPONS.wave;
check(W.range === 12 && W.coneDeg === 40, 'Ola: 12 m y ±40°');
check(QUEST.fxParts && ['wall', 'inner', 'crest', 'ring', 'spray'].every(k => QUEST.fxParts[k]), 'ola con cresta, anillo de espuma y salpicadura');

// 8) reset
fresh(); CLAMS.have = true; L[0].stage = 3; L[0].used = true;
G.resetGame();
check(!CLAMS.have && L.every(c => c.stage === 0 && !c.used) && CLAMS.fum.g.visible, 'resetGame: vacías y el fumigador otra vez en el piso');
fresh(); CLAMS.have = true;
const kids = G.scene.children.length;
for (const c of L) { c.stage = 1; c.used = false; G.openClam(c, 'powerup'); }
for (let i = 0; i < 200; i++) { G.tick(dt); G.updateClams(dt); }
check(G.scene.children.length === kids, 'abrir almejas no crea objetos (pools)', `(${kids} -> ${G.scene.children.length})`);

console.log(fail ? `FALLA (${fail})` : 'PASA');
process.exit(fail ? 1 : 0);
