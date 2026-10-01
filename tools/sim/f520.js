// V2 F5.20, tanda 1 (A–C): bugs y ajustes chicos, sonidos de "Nuevos sonidos 2", chicles (grises, 3 sets, pestañas, 10 nuevos)
const G = require('./harness.js');
const { state, player, CONFIG, roundState, weaponsState } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const P = CONFIG.PLAYER;
CONFIG.POWERUPS.dropChance = 0;
function fresh() { G.resetGame(); state.running = true; state.round = 8; roundState.phase = 'active'; state.health = 100; state.lastDamageTime = -99; state.points = 50000; }

// A) chicos
fresh();
check(Object.keys(CONFIG.SOULS.spots).join() === 'sotano,piscina' && G.RELICS.boxes.pasillo === undefined, 'sin la caja de almas de la casa: el PaP pide 2');
for (const k of Object.keys(CONFIG.SOULS.spots)) state.souls[k] = CONFIG.SOULS.need;
for (const k in state.generators) state.generators[k] = true;
check(G.papReady(), 'con las 2 cajas y los 4 generadores, el PaP se prende');
const M = CONFIG.SQUIDBAY.mud;
check(Math.abs((M.x2 - M.x1) - 9.8) < 0.01, 'lodo 1.4× más ancho (' + (M.x2 - M.x1).toFixed(1) + ' m)');
check(CONFIG.GOOFALL.x === -79 && G.WORLD.colliders.some(c => c.tag === 'prop:catarata' && c.minX < -79 && c.maxX > -79), 'catarata en x -79');
check(CONFIG.BARRIERS.hatchHit >= CONFIG.BARRIERS.repairRange, 'reparando una trampilla, el de abajo te alcanza');
const cb = CONFIG.WALLBUYS.find(w => w.weapon === 'crossbow');
// F5.28e: se mudó a la pared oeste de la cueva de las catacumbas
check(!cb.post && cb.room === 'R24' && cb.x === CONFIG.CATA.rects.find(r => r[5] === 'CV')[1], 'ballesta contra la pared oeste de la cueva');
G.showMenu('pause'); const hid = G.UI.travel.style.visibility; G.showMenu(null);
check(hid === 'hidden' && G.UI.travel.style.visibility === '', 'con un menú abierto no se ve la pantalla del viaje (bug del ESC en el búnker)');

// B) sonidos
const html = require('../../build.js').html(), keys = Object.keys(JSON.parse(html.match(/id="bhzSounds">([\s\S]*?)<\/script>/)[1]));
const growls = keys.filter(k => k.startsWith('zgrowl_'));
check(growls.length >= 10, 'gruñidos naturales embebidos (' + growls.length + ')');
check(['shotgun_disparo', 'machine_gun_reload', 'rifle_reload', 'sniper_reload', 'revolver_reload', 'shotgun_reload', 'bazooka_cuando_pega', 'bazooka_cuando_pega_pap',
  'invocar_calamares_planta_boss', 'sonido_de_escupir_planta_boss', 'muerte_de_planta_carnivora_en_templo'].every(k => keys.includes(k)), 'recargas, escopeta, bazooka y planta boss embebidos');
// F5.23: la carpeta "Planta Boss" va con prefijo pb_ y su nombre; todo pb_ que pide el código existe
const pbUsed = [...new Set((require('../../build.js').bundle().match(/'pb_[a-z0-9_]+'/g) || []).map(s => s.slice(1, -1)))];
check(pbUsed.length >= 10 && pbUsed.every(k => keys.includes(k)), 'sonidos de la planta (pb_*) embebidos: ' + pbUsed.length + ' usados',
      pbUsed.filter(k => !keys.includes(k)).join(' '));

// C) chicles
fresh();
G.PROFILE.gums = {}; G.PROFILE.preset.length = 0; G.PROFILE.preset.push('shadow', 'beacon', 'insta3', 'ironlungs', 'sharpedge');
check(G.presetReady(), 'PLAY no se bloquea aunque no tengas un chicle del set');
check(G.presetGums().includes('insta3'), 'el que no tenés queda en el set (la chiclera lo puede sacar)');
const gm = G.GUMM.machines[0];
G.GUMM.offer = { id: 'insta3', m: gm, t: 6, vend: 0 };
check(!G.takeGum() && /you have none/.test(G.gumPrompt(gm).text) && G.GUMM.offer, 'sale uno que no tenés: no se agarra', '("' + G.gumPrompt(gm).text + '")');
G.GUMM.offer = null;
G.selectPreset(1);
check(G.PROFILE.presetIdx === 1 && G.PROFILE.presets.length === CONFIG.GUMS.presetSets && G.PROFILE.presets[0].includes('insta3'), '3 sets: cambiar de set conserva el anterior');
G.selectPreset(0);
check(G.PROFILE.preset.includes('insta3'), 'y al volver está igual');
G.MENU.mode = 'main'; G.renderGumsPanel();
const gh = G.UI.panelGums.innerHTML;
check(/BY LEVEL/.test(gh) && /data-set="2"/.test(gh) && /pslot[^"]* none/.test(gh), 'panel: pestañas, 3 sets y el que no tenés en gris');
const nw = ['heavyboots', 'glasscannon', 'headhunter', 'coinflip', 'halfmag', 'cursed', 'grenadier', 'magnet', 'secondwind', 'undying'];
// (F5.28d sumó 10 más: 39 en total)
check(nw.every(id => CONFIG.GUMS.list[id]) && Object.keys(CONFIG.GUMS.list).length === 39, '10 chicles nuevos (39 en total)');
// efectos
fresh(); state.weapons = [{ id: 'm1911', mag: 8, reserve: 80 }]; state.currentWeapon = 0; weaponsState.phase = 'idle';
G.GUMM.fx.halfmag = 30; weaponsState.lastShot = -1e9; G.tick(1); G.fireWeapon();
check(state.weapons[0].mag === 6, 'HALF MAG: cada tiro gasta 2');
const p0 = state.points; G.addPoints(100);
check(state.points - p0 === 200, 'HALF MAG: puntos ×2');
G.GUMM.fx = { heavyboots: 30 }; const p1 = state.points; G.addPoints(100);
check(state.points - p1 === 150, 'HEAVY BOOTS: puntos ×1.5');
G.GUMM.fx = { glasscannon: 30 }; state.health = 100; state.lastDamageTime = -99; G.damagePlayer(20, 0, 0);
check(state.health === 60 && G.perkDmg() === 1.5, 'GLASS CANNON: ×1.5 de daño, pero te pegan ×2');
G.GUMM.fx = { secondwind: Infinity }; state.health = 10; state.lastDamageTime = -99; G.damagePlayer(50, 0, 0);
check(state.health === G.maxHealth() && !G.GUMM.fx.secondwind && !state.gameOver, 'SECOND WIND: el golpe que te tiraba te deja lleno (una vez)');
G.GUMM.fx = { undying: 10 }; state.health = 50; state.lastDamageTime = -99; G.damagePlayer(40, 0, 0);
check(state.health === 50, 'UNDYING: nada te lastima');
G.GUMM.fx = {}; state.grenades = 0; G.applyGum('grenadier');
check(state.grenades === CONFIG.GRENADE.max, 'GRENADIER: granadas llenas');
const z0 = state.zombies.length; G.applyGum('cursed');
check(state.zombies.length - z0 === CONFIG.GUMS.list.cursed.count, 'CURSED CANDY: salen ' + CONFIG.GUMS.list.cursed.count + ' zombies');

// ===== tanda 2 (D–F) =====
// D) garaje, casa oscura y faroles
fresh();
const S = CONFIG.START;
check(Math.hypot(player.pos.x - S.x, player.pos.z - S.z) < 0.01 && G.roomAt(player.pos.x, player.pos.z).id === 'R6', 'arrancás en el garaje');
check(G.openRooms().includes('R6') && !G.openRooms().includes('R1'), 'con todo cerrado, lo abierto es el garaje');
const qr = CONFIG.PERKS.list.revive, gsp = CONFIG.GUMS.machine.spots;
check(G.roomAt(qr.x, qr.z).id === 'R6' && gsp.some(s => G.roomAt(s.x, s.z) && G.roomAt(s.x, s.z).id === 'R6'), 'Quick Revive y la chiclera en el garaje');
state.power = false;
const R2 = G.ROOMS.find(r => r.id === 'R2');
check(G.houseDark(R2) === CONFIG.HOUSE.dark, 'sin energía la casa está oscura');
const lan = G.LANTERNS.list.find(T => T.room === 'R2');
check(!!lan, 'hay farol en la sala');
G.useLantern(lan);
// F5.28f: el farol no aclara la zona (aclaraba los otros cuartos): prende la lámpara del cuarto, de alcance corto
G.updateTheme(1 / 60);
check(G.houseDark(R2) === CONFIG.HOUSE.dark && lan.lamp.light.intensity > 0 && lan.lamp.light.distance === CONFIG.HOUSE.lanternDist,
  'con el farol prendido: su lámpara alumbra de cerca y la casa sigue oscura');
G.updateLanterns(CONFIG.HOUSE.time + 1); G.updateTheme(1 / 60);
check(G.houseDark(R2) === CONFIG.HOUSE.dark && lan.lamp.light.intensity === 0, 'a los ' + CONFIG.HOUSE.time + ' s se apaga');
state.power = true;
check(G.houseDark(R2) === 0 && G.lanternNear(R2, lan.x, lan.z, 9) === null, 'con energía: nada oscuro y sin farol que prender');
state.power = false; G.useLantern(lan); G.resetGame();
check(!(lan.lamp.litT > 0), 'resetGame apaga los faroles');

// E) ventanas, zombies y mapa
fresh();
const win = G.BARS.list.find(B => B.kind === 'window'), CB = CONFIG.BARRIERS;
const hy = (CB.winY0 + CB.winY1) / 2;
check(G.inWindowHole({ x: win.x, y: hy, z: win.z }) && !G.inWindowHole({ x: win.x, y: 0.3, z: win.z }), 'el hueco de la ventana deja pasar balas (abajo no)');
check(G.BARS.list.some(B => B.id === 'T7' && B.kind === 'hatch'), 'la ventana del garaje ahora es trampilla (T7)');
let hor = 0, blk = 0, low = 0;
for (let i = 0; i < 4000; i++) { const v = G.rollVariant(16); if (v === 'horror') hor++; if (v === 'black') blk++; const w = G.rollVariant(5); if (w === 'horror' || w === 'black') low++; }
check(low === 0 && hor > 0 && Math.abs(blk / 4000 - CONFIG.ZOMBIE.variants.black.chance) < 0.03, 'variantes por ronda (R5 sin horror ni negro; R16 negros ' + (blk / 40).toFixed(1) + '%)');
const zb = G.ZPOOL.find(q => !q.active); G.resetZombie(zb, G.SPAWN_POINTS[0], false, 'normal'); state.zombies.push(zb); zb.state = 'walk'; zb.level = 0; G.setZombieVariant(zb, 'black');
zb.px = player.pos.x + 1; zb.pz = player.pos.z;
state.health = 100; state.lastDamageTime = -99;
let boom = false;
for (let i = 0; i < 60 && !boom; i++) { G.blackFuse(zb, 1 / 30, 1); boom = zb.health <= 0 || zb.state === 'dying'; }
check(boom && state.health < 100, 'el zombie negro se infla y explota cerca (vida ' + state.health + ')');
const sea = G.SPAWN_POINTS.filter(sp => sp.jump && (sp.jump.z < -23.4 || (() => { const B = CONFIG.SQUIDBAY.bounds; return sp.jump.x >= B[0] && sp.jump.x <= B[1] && sp.jump.z >= B[2] && sp.jump.z <= B[3]; })()));
check(sea.length === 0, 'nadie sale caminando del mar', sea.map(s => s.x + ',' + s.z).join(' '));
check(G.SPAWN_POINTS.filter(sp => sp.sea).every(sp => !sp.jump), 'los ahogados salen del piso');
const E = CONFIG.TEMPLE.eastWall;
check(!G.segmentClear(E.x2 + 2, 90, E.x1 - 2, 90, 0, true), 'la pared este del templo frena las balas');
check(G.WORLD.colliders.some(c => c.tag === 'prop:lapida'), 'lápida sólida en ' + CONFIG.BUNKER.tablet.x + ', ' + CONFIG.BUNKER.tablet.z);
G.setSunForRound(1); const y1 = G.WORLD.sun.position.y; G.setSunForRound(8); const y8 = G.WORLD.sun.position.y;
check(y8 < y1 && G.WORLD.sun.position.z < 0, 'el sol baja de la R1 a la R8, hacia el mar');
G.MENU.mode = 'main'; G.renderWeaponsPanel();
check((G.UI.panelWeapons.innerHTML.match(/class="wcat"/g) || []).length >= 5, 'armas agrupadas por tipo en el menú');

// ===== tanda 3 (G): la planta jefa del templo =====
const PB = CONFIG.PLANTBOSS, PL = G.PLANTB, dt3 = 1 / 30;
PB.enabled = true;
const onPlank = (x, z) => { player.pos.set(x, G.UP.y + P.height, z); player.vel.set(0, 0, 0); G.tick(dt3); };
const step = (s, fn) => { for (let i = 0; i < Math.round(s / dt3); i++) { G.tick(dt3); G.updatePlantBoss(dt3, i * dt3); G.updateAcid(dt3); G.updateSquids(dt3); if (fn) fn(); } };
fresh(); state.round = 12;
for (const k of Object.keys(CONFIG.SOULS.spots)) state.souls[k] = CONFIG.SOULS.need;
for (const k in state.generators) state.generators[k] = true;
check(!G.papReady() && !G.RELICS.pap.g.visible && PL.cocoon.visible, 'con todo prendido, el PaP sigue bajo las raíces de la planta');
check(!G.PORTAL.open && !G.WORLD.hitMeshes.includes(G.PORTAL.tombHit) && !G.PORTAL.tomb.visible, 'sin tumba: el portal está cerrado');
check(G.WORLD.colliders.some(c => c.tag === 'temple:planta') && G.WORLD.hitMeshes.includes(PL.hitHead), 'cuerpo sólido y cabeza que recibe balas');
onPlank(84, 86); step(0.1);   // F5.22: la planta está en el centro de la nave (89, 75)
check(PL.awake && PL.max === Math.round(CONFIG.BOSS.health(12) * PB.hpMul) && G.plantBossBar(), 'se despierta con vos en el templo, con la vida del Sombrerón ×' + PB.hpMul + ' (' + PL.max + ')');
const c0 = PL.bodyMat.color.r;
let spat = 0; PL.rootT = 99; PL.tg.cd = 1e9;                            // la lengua se prueba aparte (abajo)
step(8, () => { spat = Math.max(spat, G.ACID.shots.filter(s => s.active).length); state.health = 100; });
check(spat === PB.spit.burst, 'fase 1: escupe en ráfagas de ' + PB.spit.burst + ' (' + spat + ' en el aire a la vez)');
// raíces: salen debajo tuyo con aviso, te pegan y te levantan
state.health = 100; state.lastDamageTime = -99; PL.rootT = 0; PL.spitT = 99; PL.burst = 0;
for (const pd of G.ACID.puddles) pd.life = 0;                          // sin los charcos de la ráfaga
for (const s of G.ACID.shots) s.active = false;                         // ni los escupitajos que siguen en el aire
step(0.05);
const root = PL.roots.find(q => q.state !== 'off');
check(root && root.state === 'warn' && Math.hypot(root.x - player.pos.x, root.z - player.pos.z) < 0.5, 'raíces: aviso en el piso debajo tuyo');
check(state.health === 100, 'durante el aviso no pegan');
step(PB.roots.warn + PB.roots.rise);
check(state.health === 100 - PB.roots.damage && player.vel.y > 0, 'salen, pegan ' + PB.roots.damage + ' y te levantan (vida ' + state.health + ')');
state.health = 100; state.lastDamageTime = -99; onPlank(84, 86); PL.rootT = 0; step(0.05);
const r2 = PL.roots.find(q => q.state === 'warn'); onPlank(r2.x - 4, r2.z); step(PB.roots.warn + PB.roots.rise);
check(state.health === 100, 'si te corrés durante el aviso, no te tocan');
step(PB.roots.hold + PB.roots.down + 0.2);
check(PL.roots.every(q => q.state === 'off' && !q.g.visible), 'las raíces vuelven a bajar');
// F5.22: en el piso del templo también (toda el área)
for (const pd of G.ACID.puddles) pd.life = 0;
player.pos.set(58, G.groundY(58, 58) + P.height, 58); player.vel.set(0, 0, 0); G.tick(dt3);
state.health = 100; state.lastDamageTime = -99; PL.rootT = 0; step(0.05);
const r3 = PL.roots.find(q => q.state === 'warn');
check(r3 && r3.level === 0 && Math.hypot(r3.x - 58, r3.z - 58) < 0.8, 'las raíces salen también en el piso del templo, lejos de la planta');
step(PB.roots.warn + PB.roots.rise);
check(state.health === 100 - PB.roots.damage, 'y pegan igual (vida ' + state.health + ')');
step(PB.roots.hold + PB.roots.down + 0.2);
PL.spitT = 0; PL.burst = 0; let spatFar = false;
step(3, () => { if (G.ACID.shots.some(s => s.active)) spatFar = true; state.health = 100; });
check(spatFar, 'escupe hasta la otra punta del área del templo (' + Math.hypot(58 - PB.x, 58 - PB.z).toFixed(0) + ' m)');
// de afuera del templo no se le pega
player.pos.set(40, P.height, 64.5); G.tick(dt3);
const hpOut = PL.hp;
check(!G.plantBossHit(500, false, null) && PL.hp === hpOut, 'desde afuera del área del templo no se le pega');
PL.hp = PL.max * 0.4; PL.inkT = 0; state.health = 100; state.lastDamageTime = -99;
onPlank(84, 96);
let inked = false;
step(4, () => { if (G.INK.shots.some(s => s.active)) inked = true; state.health = 100; });
const dM = Math.hypot(player.pos.x - PL.mouth.x, player.pos.z - PL.mouth.z);
check(inked && dM > CONFIG.SQUID.ink.range[1], 'fase 2: el chorro del calamar llega más lejos (' + dM.toFixed(1) + ' m)');
check(PL.bodyMat.color.r < c0, 'se va poniendo negra (' + c0.toFixed(2) + ' -> ' + PL.bodyMat.color.r.toFixed(2) + ')');
PL.hp = PL.max * 0.15; PL.sumT = 0; const nz = state.zombies.length;
step(0.1);
const summoned = state.zombies.filter(z => z.fromPlant);
check(summoned.length > 0 && summoned.every(z => z.squid && z.level === 1), 'fase 3: llama calamares arriba de la plancha (' + summoned.length + ')');
check(state.zombies.length > nz, 'son extra de la ronda');
const hp1 = PL.hp; G.explodeAt(91.5, G.UP.y + 0.3, 75, { damage: 1000, radius: 5, self: 0 });
check(PL.hp < hp1, 'una granada al lado le pega (' + Math.round(hp1 - PL.hp) + ')');
const hp2 = PL.hp; G.plantBossHit(100, true, null);
check(Math.abs(hp2 - PL.hp - 100 * PB.headMul) < 1e-6, 'la cabeza recibe ×' + PB.headMul);
// un tiro de verdad a la cabeza
const hh = PL.hitHead.position, eye = hh.clone().set(84, G.UP.y + P.height, 86), dir = hh.clone().sub(eye).normalize();
const hp3 = PL.hp, r = G.traceShot(eye, dir, CONFIG.WEAPONS.m1911);
check(PL.hp < hp3 && r && r.head, 'la bala le pega a la cabeza');
const pts0 = state.points;
G.plantBossHit(PL.hp + 10, false, null);
check(PL.dead && state.points - pts0 >= PB.points, 'muere: ' + PB.points + ' puntos');
check(PL.anim, 'arranca la animación de escupir el PaP');
const home = G.RELICS.pap.g.position.clone();
state.health = 50; state.lastDamageTime = -99; G.damagePlayer(20, 0, 0);
check(state.health === 30, 'F5.22: no es cinemática: el juego sigue (te pueden pegar)');
let flewAt = null, far = 0;
step(PB.cine.rear + PB.cine.fly * 0.5, () => { const p = G.RELICS.pap.g.position; if (G.RELICS.pap.g.visible) { far = Math.max(far, p.distanceTo(home)); flewAt = flewAt || p.clone(); } });
check(far > 5 && flewAt && G.RELICS.pap.g.position.y > home.y + 2, 'escupe el Pack-a-Punch: sale de la boca y vuela en arco (' + far.toFixed(1) + ' m de su lugar)');
step(PB.cine.dur);
check(PL.spat && G.RELICS.pap.g.visible && !PL.cocoon.visible && G.RELICS.pap.g.position.distanceTo(home) < 1e-6, 'aterriza exacto en su lugar');
check(G.papReady() && G.RELICS.papOn, 'y se prende (ya estaba todo)');
// F5.24: explotó. La cabeza queda en una esquina, el cuerpo ya no es sólido, y el charco amarillo es el portal
for (let i = 0; i < 90; i++) G.updatePortals(dt3, i * dt3);
const HR = PB.headRest, hp_ = PL.head.position;
check(!PL.g.visible && PL.head.parent !== PL.g && Math.hypot(hp_.x - HR.x, hp_.z - HR.z) < 0.5, 'explota: el cuerpo desaparece y la cabeza queda tirada en la esquina (' + hp_.x.toFixed(1) + ', ' + hp_.z.toFixed(1) + ')');
check(!G.WORLD.plantBody.col.solid && G.isUp(Math.floor(PB.x), Math.floor(PB.z)), 'donde estaba la planta ya se camina');
check(!PL.bubble.visible && G.PORTAL.open && !PL.anim && G.PORTAL.puddles.every(D => D.g.visible) && G.PORTAL.arcs.every(A => !A.arc.visible),
  'se abre el portal: dos charcos amarillos (sin arcos ni burbuja)');
check(G.portalEnds() === CONFIG.PORTAL.puddle, 'las puntas del portal son los charcos');
// saltar adentro del charco del templo viaja (sin F)
{ const D = CONFIG.PORTAL.puddle.temple;
  player.pos.set(D.x + 0.5, D.y + P.height + 0.3, D.z); player.vel.set(0, -2, 0); player.grounded = false; G.PORTAL.cd = 0;
  G.updatePortals(dt3, 0);
  check(G.BUNK.travel && G.PORTAL.cd > 0, 'saltando adentro del charco se viaja (sin apretar F)');
  G.BUNK.travel = false; G.BUNK.fadeT = 0; G.PORTAL.cd = 0;
  player.pos.set(D.x + 0.5, D.y + P.height, D.z); player.vel.set(0, 0, 0); player.grounded = true;
  G.updatePortals(dt3, 0);
  check(!G.BUNK.travel, 'caminando por arriba no viaja'); }
G.resetGame();
check(!PL.dead && !PL.awake && !G.RELICS.pap.g.visible && !G.PORTAL.open && !PL.bubble.visible, 'resetGame: planta viva y dormida, PaP escondido, portal cerrado');
check(PL.g.visible && PL.head.parent === PL.g && G.WORLD.plantBody.col.solid && G.PORTAL.puddles.every(D => !D.g.visible),
  'resetGame: la planta entera otra vez, sólida, sin charcos');

// ===== F5.24: la jaula de raíces =====
fresh(); state.round = 12; onPlank(84, 86); step(0.1); PL.tg.cd = 1e9; PL.rootT = PL.spitT = PL.inkT = PL.sumT = 99;
state.health = 100; state.lastDamageTime = -99;
check(G.plantTrapStart() && PL.trap.state === 'warn', 'la jaula avisa con un anillo alrededor tuyo');
step(PB.trap.warn + 0.05, () => { PL.rootT = PL.spitT = PL.inkT = PL.sumT = 99; PL.tg.cd = 1e9; });
check(G.plantRooted(), 'si seguís adentro, te encierra');
const px0 = player.pos.x, pz0 = player.pos.z; G.keys['KeyW'] = true;
step(0.6, () => { G.updatePlayer(dt3); PL.rootT = PL.spitT = PL.inkT = PL.sumT = 99; PL.tg.cd = 1e9; }); G.keys['KeyW'] = false;
check(Math.hypot(player.pos.x - px0, player.pos.z - pz0) < 0.3 && state.health < 100, 'no te podés mover y te va sacando vida (' + state.health.toFixed(0) + ')');
const hold0 = PL.trap.hold; G.plantRootCut();
check(Math.abs(hold0 - PL.trap.hold - PB.trap.cut) < 1e-6, 'cada cuchillazo corta ' + PB.trap.cut + ' s');
step(PB.trap.time + 1, () => { PL.rootT = PL.spitT = PL.inkT = PL.sumT = 99; PL.tg.cd = 1e9; state.health = 100; });
check(!G.plantRooted(), 'y al rato te suelta');
onPlank(84, 86); step(0.05); G.plantTrapStart(); onPlank(84, 92);
step(PB.trap.warn + 0.1, () => { PL.rootT = PL.spitT = PL.inkT = PL.sumT = 99; PL.tg.cd = 1e9; });
check(!G.plantRooted(), 'si salís del anillo durante el aviso, no te atrapa');
check(PB.roots.radius >= 2.4 && PB.roots.count[0] >= 2 && PL.roots.length >= PB.roots.pool, 'raíces más amplias (radio ' + PB.roots.radius + ', ' + PB.roots.count.join('/') + ' por fase)');
PB.enabled = false; G.resetPlantBoss(); PB.enabled = true;

// ===== F5.23: la cara te sigue, la lengua te agarra y te traga =====
const TG = PB.tongue, quiet = () => { PL.rootT = PL.spitT = PL.inkT = PL.sumT = 99; PL.burst = 0; PL.jetT = 0; };
const faceErr = () => { const y = PL.g.rotation.y + PL.head.rotation.y, a = Math.atan2(player.pos.x - PB.x, player.pos.z - PB.z), d = a - y; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); };
fresh(); state.round = 12; onPlank(84, 86); step(0.1); quiet(); PL.tg.cd = 1e9;
step(2, () => { state.health = 100; });
check(faceErr() < 0.1, 'la cara te mira (error ' + faceErr().toFixed(3) + ' rad)');
const hq0 = PL.hitHead.position.clone(); onPlank(84, 96); step(2, () => { state.health = 100; });
check(faceErr() < 0.1 && PL.hitHead.position.distanceTo(hq0) > 0.3, 'y te sigue si te movés (la caja de tiro de la cabeza gira con ella)');
// la lengua
onPlank(84, 86); state.health = 100; state.lastDamageTime = -99; PL.tg.cd = 0;
let st = null, t0 = 0;
for (let i = 0; i < 90 && !G.plantGrabbed(); i++) { step(dt3); quiet(); if (PL.tg.state === 'warn' && st === null) st = i * dt3; }
check(st !== null && G.plantGrabbed(), 'abre la boca (aviso) y la lengua te agarra');
check(state.health === 100 - TG.damage, 'al agarrarte pega ' + TG.damage + ' (vida ' + state.health + ')');
check(PL.tongue.visible && PL.tongue.count > 5 && G.WORLD.hitMeshes.includes(PL.tongueHit), 'la lengua de cubos se ve y recibe balas');
const d0 = Math.hypot(player.pos.x - PL.mouth.x, player.pos.z - PL.mouth.z);
const stepP = (s, fn) => step(s, () => { G.updatePlayer(dt3); quiet(); if (fn) fn(); });
G.keys['KeyS'] = true; stepP(0.5); G.keys['KeyS'] = false;
const d1 = Math.hypot(player.pos.x - PL.mouth.x, player.pos.z - PL.mouth.z);
check(d0 - d1 > TG.drag * 0.5 * 0.7 && d0 - d1 < TG.drag * 0.5 * 1.2, 'te arrastra a ' + TG.drag + ' m/s aunque camines para atrás (' + (d0 - d1).toFixed(2) + ' m en 0.5 s)');
// un tiro a la lengua te suelta
const eyeT = player.pos.clone(), dirT = PL.tongueHit.position.clone().sub(eyeT).normalize();
G.traceShot(eyeT, dirT, CONFIG.WEAPONS.m1911);
check(!G.plantGrabbed() && PL.tg.state === 'back' && !G.WORLD.hitMeshes.includes(PL.tongueHit), 'un tiro a la lengua te suelta');
step(1, quiet);
check(PL.tg.state === 'off' && !PL.tongue.visible, 'la lengua vuelve a la boca');
// dos cuchillazos
onPlank(84, 86); state.health = 100; state.lastDamageTime = -99; PL.tg.cd = 0;
for (let i = 0; i < 90 && !G.plantGrabbed(); i++) { step(dt3); quiet(); }
const toM = new (require('three').Vector3)(PL.mouth.x - player.pos.x, 0, PL.mouth.z - player.pos.z).normalize();
check(!G.plantTongueStab(toM.clone().negate()), 'de espaldas a la boca el cuchillo no le pega a la lengua');
check(G.plantTongueStab(toM) && G.plantGrabbed(), 'un cuchillazo no alcanza');
check(G.plantTongueStab(toM) && !G.plantGrabbed(), 'el segundo te suelta');
// esquivarla: te corrés de costado mientras sale
step(1, quiet); onPlank(84, 86); PL.tg.cd = 0;
for (let i = 0; i < 90 && PL.tg.state !== 'shoot'; i++) { step(dt3); quiet(); }
onPlank(84, 96); state.health = 100;
step(1.2, quiet);
check(!G.plantGrabbed() && PL.tg.state !== 'grab', 'si te corrés cuando sale, no te agarra');
// no te soltás: te traga (golpe letal)
step(1, quiet); onPlank(84, 86); state.health = 100; state.lastDamageTime = -99; PL.tg.cd = 0;
for (let i = 0; i < 90 && !G.plantGrabbed(); i++) { step(dt3); quiet(); }
let swallowed = false, sawSwallow = false, hpInMouth = -1, yTop = 0, fogMid = 0, fogEnd = 0;
const yGrab = player.pos.y;
stepP(8, () => {
  yTop = Math.max(yTop, player.pos.y);
  if (PL.tg.state === 'grab') { if (PL.tg.k > 0.3 && PL.tg.k < 0.6) fogMid = G.GFX.fog; fogEnd = Math.max(fogEnd, G.GFX.fog); }
  if (PL.tg.state === 'swallow' && !sawSwallow) { sawSwallow = true; hpInMouth = state.health; }
  if (state.health <= 0 || state.gameOver) swallowed = true;
});
check(yTop > yGrab + 3, 'la lengua te levanta hacia la boca (' + (yTop - yGrab).toFixed(1) + ' m)');
check(fogMid > 0.2 && fogMid < fogEnd && fogEnd > 0.9, 'se te nubla la vista mientras te lleva (a mitad ' + fogMid.toFixed(2) + ', al llegar ' + fogEnd.toFixed(2) + ')');
check(sawSwallow && hpInMouth > 0, 'llegás a la boca vivo y la boca se cierra');
check(swallowed && G.GFX.fog === 0, 'y te traga: te morís (la vista se limpia para la muerte)');
G.resetGame();
check(PL.tg.state === 'off' && !PL.tongue.visible && !G.WORLD.hitMeshes.includes(PL.tongueHit) && Math.abs(PL.head.rotation.y) < 1e-9, 'resetGame: lengua guardada, cara al frente');
PB.enabled = false; G.resetPlantBoss();

// ===== F5.23: vida baja estilo CoD =====
fresh();
state.health = 100; check(G.lowHealthK() === 0, 'con media vida o más, sin sangre');
state.health = 10; const kL = G.lowHealthK();
check(kL > 0.75, 'con poca vida, borde de sangre fuerte (' + kL.toFixed(2) + ')');
const beat0 = G.LOWHP.beatAt; G.tick(0.05); G.updateHUD(0.05); G.tick(1.2); G.updateHUD(0.05);
check(G.LOWHP.beatAt > beat0, 'el corazón late (y el borde late con él)');
check(Number(G.UI.lowhp.style.opacity) > 0.5, 'la viñeta se ve (' + G.UI.lowhp.style.opacity + ')');

// ===== F5.24: el mapa (tecla 5) =====
fresh();
const sp0 = { x: player.pos.x, z: player.pos.z };
check(!G.mapSeenAt(60, 60), 'al empezar, lo lejos está tapado');
G.updateMapView(0.3);
check(G.mapSeenAt(sp0.x, sp0.z) && G.mapSeenAt(sp0.x + 8, sp0.z) && !G.mapSeenAt(sp0.x + 20, sp0.z), 'se destapa un círculo de ' + CONFIG.MAPVIEW.reveal + ' m alrededor tuyo');
player.pos.x += 15; G.updateMapView(0.3);
check(G.mapSeenAt(sp0.x + 20, sp0.z) && G.mapSeenAt(sp0.x, sp0.z), 'al caminar se destapa más (y lo de antes queda destapado)');
G.toggleMap();
check(G.MAPV.on && G.MAPV.base, 'la tecla 5 abre el mapa (se dibuja una vez)');
G.toggleMap();
check(!G.MAPV.on, 'y lo cierra');
G.toggleMap(); G.showMenu('pause');
check(!G.MAPV.on, 'el menú de pausa lo cierra'); G.showMenu(null);
// en el búnker (bajo tierra): sin señal, y no se destapa nada del mapa de arriba
const bk = G.SPAWN_POINTS.find(s => s.room === 'R16');
player.pos.set(bk.x, G.groundY(bk.x, bk.z) + P.height, bk.z); G.MAPV.lx = G.MAPV.lz = 1e9; G.MAPV.t = 0;
G.updateMapView(0.3);
check(!G.mapSeenAt(bk.x, bk.z), 'en el búnker no se destapa el mapa de arriba');
G.toggleMap(true);
check(G.MAPV.on && G.MAPV.nosig, 'en el búnker el mapa dice NO SIGNAL');
player.pos.set(25, G.groundY(25, 15) + P.height, 15); G.updateMapView(0.3);
check(!G.MAPV.nosig, 'en la parte honda de la pileta sí hay señal (no es el búnker)');
G.toggleMap(false);
G.resetGame();
check(!G.mapSeenAt(sp0.x + 20, sp0.z), 'resetGame lo vuelve a tapar');

// ===== F5.24: GRAVE WHISPER, sonidos, estatuas, caparazón, HUD y charcos =====
fresh();
const gw = state.weapons.find(s => s.id === 'm1911') || (G.giveWeapon('m1911'), state.weapons.find(s => s.id === 'm1911'));
gw.pap = true; gw.mag = G.papDef('m1911').magSize; state.currentWeapon = state.weapons.indexOf(gw); weaponsState.phase = 'idle';
const GW = G.curDef();
check(GW.dual && GW.oneShot === 9, 'GRAVE WHISPER: dos pistolas y un tiro mata hasta la R9');
// un tiro al cuerpo de un zombie de la ronda 9 (950 de vida) lo mata
const shotAt = (round) => {
  state.round = round; const zq = G.ZPOOL.find(q => !q.active); G.resetZombie(zq, { x: -10.5, z: 26.5 }, false, 'normal');
  state.zombies.push(zq); zq.state = 'walk'; zq.alive = true; zq.health = zq.maxHealth = CONFIG.ZOMBIE.healthFor ? CONFIG.ZOMBIE.healthFor(round) : 150 + (round - 1) * 100;
  zq.root.position.set(zq.px, 0, zq.pz); zq.root.updateMatrixWorld(true);
  const eye = new (require('three').Vector3)(zq.px, 1.6, zq.pz + 4), body = new (require('three').Vector3)(zq.px, 1.1, zq.pz);
  G.traceShot(eye, body.sub(eye).normalize(), GW);
  const dead = !zq.alive; G.deactivateZombie ? G.deactivateZombie(zq) : 0; state.zombies.length = 0; return dead;
};
check(shotAt(9), 'R9: un tiro al cuerpo lo mata (950 de vida)');
check(!shotAt(14), 'R14: un tiro ya no alcanza');
const mag0 = gw.mag; weaponsState.handShot = { L: -1e9, R: -1e9 }; G.tick(1);
G.fireWeapon('L'); G.fireWeapon('R');
check(gw.mag === mag0 - 2, 'clic izquierdo y derecho: disparan las dos pistolas a la vez (' + (mag0 - gw.mag) + ' balas)');
G.fireWeapon('L');
check(gw.mag === mag0 - 2, 'cada mano con su cadencia (la izquierda no repite al toque)');
G.ADS.on = true; G.updateWeapon(dt3);
check(!G.ADS.on, 'sin ADS con las dos pistolas');
// sonidos de disparo: toda arma (salvo lanzallamas y Ola) con una muestra que existe
const noSample = Object.keys(CONFIG.WEAPONS).filter(id => !CONFIG.WEAPONS[id].flame && !CONFIG.WEAPONS[id].wave && id !== 'knife' &&
  !(G.SHOT_SAMPLE[id] && keys.includes(G.SHOT_SAMPLE[id][0])));
check(noSample.length === 0, 'todas las armas suenan con una muestra de disparo', noSample.join(' '));
check([CONFIG.QUEST.turtle, CONFIG.QUEST.shrimp, CONFIG.BUNKER.seahorse].every(s => s.scale < 2), 'estatuas de la cabeza del calamar más chicas');
// caparazón sin energía: más oscuro que el claro
state.power = false; player.pos.set(-51, P.height, 88); G.tick(0.1);
for (let i = 0; i < 200; i++) G.updateNight(0.05);
const dShell = G.NIGHT.zd;
state.power = true; for (let i = 0; i < 200; i++) G.updateNight(0.05);
check(dShell > 1.5 && G.NIGHT.zd <= 1.01, 'el caparazón sin energía es más oscuro (' + dShell.toFixed(2) + ' -> ' + G.NIGHT.zd.toFixed(2) + ' con energía)');
state.power = false;
G.updateGrenadeHUD();
check(/<svg/.test(G.UI.gren.innerHTML), 'los slots de granadas son dibujos (SVG)');
const pd = G.acidPuddle(-10, 26, 0);
check(pd.m.visible && pd.bubbles.length > 0 && pd.steam.length > 0 && pd.m.children.length >= 4, 'charco de ácido en cubos, con burbujas y vapor');

// ===== F5.24b: arreglos del playtest =====
fresh();
// Fire Sale: la caja a 10 y 30 s
G.startFireSale();
check(G.boxCost() === 10 && state.effects.fireSale === 30, 'Fire Sale: la caja cuesta 10 y dura 30 s');
const pts1 = state.points; G.BOX.phase = 'idle'; G.useBox();
check(pts1 - state.points === 10, 'Fire Sale: tirar la caja cobra 10 (' + (pts1 - state.points) + ')');
G.endFireSale(true); G.resetGame(); fresh();
check(G.boxCost() === CONFIG.BOX.cost, 'sin Fire Sale vuelve a ' + CONFIG.BOX.cost);
// la chiclera de arriba del muelle se usa
G.debugUnlockAll();
player.pos.set(-47.5, 4.3 + P.height, -41.2); player.vel.set(0, 0, 0); for (let i = 0; i < 5; i++) { G.tick(dt3); G.updatePlayer(dt3); }
G.updateInteract();
check(G.interactState.kind === 'gum', 'la chiclera de arriba del muelle ofrece chicle (antes el nivel 1 no las miraba)');
check(CONFIG.WEAPONS.leviathan.damage === 80, 'LEVIATHAN ×0.8 (80)');
// escalera del muelle: saltando de costado arriba no se cae al agua
{ const B = CONFIG.SQUIDBAY.bounds, water = (x, z) => x >= B[0] && x <= B[1] && z >= B[2] && z <= B[3] && !G.roomAt(x, z);
  player.pos.set(-49, P.height + 0.05, -30.5); player.vel.set(0, 0, 0); player.yaw = 0; G.keys.KeyW = true;
  for (let i = 0; i < 200 && player.pos.z > -37.4; i++) { G.tick(dt3); G.updatePlayer(dt3); }
  player.yaw = Math.PI / 2; for (let i = 0; i < 20; i++) { G.tick(dt3); G.updatePlayer(dt3); }
  G.keys.Space = true; G.tick(dt3); G.updatePlayer(dt3); G.keys.Space = false;
  for (let i = 0; i < 60; i++) { G.tick(dt3); G.updatePlayer(dt3); }
  G.keys.KeyW = false;
  check(!water(player.pos.x, player.pos.z), 'escalera del muelle: saltando de costado arriba no se cae al agua (' + player.pos.x.toFixed(2) + ', ' + player.pos.z.toFixed(2) + ')'); }
// la cápsula del laboratorio no se pisa
check(!G.standable(G.WORLD.colliders.find(c => c.tag === 'prop:labpod')), 'la cápsula del caparazón no se pisa (arriba los zombies no llegaban)');
// por debajo de la escalera abierta del caparazón se pasa (del lado alto)
{ const R = CONFIG.SHELL.ramp, x = R.x2 - 1.2;
  player.pos.set(x, P.height, R.z1 - 1.2); player.vel.set(0, 0, 0); player.yaw = Math.PI; G.keys.KeyW = true;   // hacia +z
  for (let i = 0; i < 90; i++) { G.tick(dt3); G.updatePlayer(dt3); }
  G.keys.KeyW = false;
  check(player.pos.z > R.z2 + 0.2 && player.pos.y < 2, 'se pasa por debajo de la escalera del caparazón (z ' + player.pos.z.toFixed(2) + ')'); }
// ácido morado de las plantas moradas
{ const s0 = G.ACID.shots.find(s => !s.active); G.spitAcid(0, 2, 0, 0, 3, 3, true);
  check(s0.purple && s0.m.material === G.ACID.shotMatP, 'las plantas moradas escupen ácido morado');
  const pp = G.acidPuddle(3, 3, 0, 0, 0, true);
  check(pp.gooMesh.geometry === G.ACID.gooGeoP, 'y el charco queda morado'); }
// el número de ronda parpadea entre rondas
{ G.resetGame(); state.running = true; G.startRound(1);
  for (const z of state.zombies) z.alive = false;
  G.roundState.phase = 'pause'; G.roundState.bellDone = false; G.roundState.next = 2; G.roundState.pauseT = 8; G.roundState.pause0 = 8; G.roundState.hudDone = false;
  let blinked = false;
  const cl = G.UI.round.classList; const orig = cl.toggle; cl.toggle = (c, on) => { if (c === 'blink' && on) blinked = true; };
  G.updateRounds(dt3); cl.toggle = orig;
  check(blinked, 'al terminar la ronda el número parpadea'); }

console.log(fail ? `FALLA (${fail})` : 'PASA');
process.exit(fail ? 1 : 0);
