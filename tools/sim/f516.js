// V2 F5.16 tanda A: niebla permanente (30 m, camera.far, fondo = niebla, sin domo), lluvia siempre en el templo
// y en el claro del búnker (adentro del búnker no), el oso de la caja devuelve lo pagado, techo sin escaleras,
// muelle de un solo acceso con Jugg al final, generador en el rancho, plantas en los jardines.
const G = require('./harness.js');
const { state, player, CONFIG, WORLD, RAIN, BOX, roundState, UP } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60, F = CONFIG.FOG;
function fresh() { G.resetGame(); state.running = true; roundState.phase = 'active'; player.pos.set(0, 1.7, -10); }
function rain(s) { for (let i = 0; i < Math.round(s * 60); i++) { G.tick(dt); G.updateNight(dt); G.updateRain(dt); } }

// 1) niebla
fresh();
check(G.scene.fog.far === F.far && G.scene.fog.near === F.near, 'niebla permanente a ' + F.far + ' m');
check(G.camera.far === F.clip && F.clip > F.far && F.clip < F.far + 10, 'no se dibuja más allá de ' + F.clip + ' m (camera.far)');
check(G.scene.background === G.scene.fog.color && !WORLD.sky.visible, 'el fondo es el color de la niebla (mismo objeto) y el domo no se ve');
check(CONFIG.BOSS.fogFar < F.far && CONFIG.WEATHER.purple.fogFar < F.far, 'el boss y la neblina morada la cierran más');
check(CONFIG.GFX.shadowBox <= 2 * F.clip, 'la caja de sombras no pasa de lo que se ve');

// 2) lluvia por zona (ronda 1, sin lluvia de ronda)
fresh(); state.round = 1; G.setSky(1, false);
rain(0.2);
check(!RAIN.lines.visible, 'en la playa en R1 no llueve');
const T = CONFIG.TEMPLE.top;
player.pos.set((T.x1 + T.x2) / 2 - 12, 1.7, (T.z1 + T.z2) / 2); rain(0.2);
check(G.roomAt(player.pos.x, player.pos.z).id === 'R20' && RAIN.lines.visible, 'en el templo llueve siempre');
player.pos.set(-60, 1.7, 62); rain(0.2);
check(G.roomAt(-60, 62).id === 'R17' && RAIN.lines.visible, 'en el claro del búnker llueve siempre');
player.pos.set(-24, -8 + 1.7, -78); rain(0.2);
check(G.inBunker() && !RAIN.lines.visible, 'adentro del búnker no');
player.pos.set(0, 1.7, -10); rain(0.2);
check(!RAIN.lines.visible, 'al volver a la playa se corta');

// 3) el oso devuelve (doble puntos no la duplica)
fresh(); G.debugOpenAllDoors();
state.effects.doublePoints = 30; BOX.paid = 950; state.points = 0;
const e0 = G.STATS.pointsEarned; G.refundBox();
check(state.points === 950 && G.STATS.pointsEarned === e0 && BOX.paid === 0, 'refundBox: 950 exactos, sin doble puntos ni estadísticas');
G.refundBox();
check(state.points === 950, 'no devuelve dos veces');

// 4) mapa de la tanda A
check(!UP.flights.some(S => !S.stone) && !G.walkAt(0, 11) && !G.walkAt(20, 25), 'techo de la casa: sin escaleras ni pasarela');
check(!state.doors.D18 && !G.roomAt(-17, -35), 'muelle de un solo acceso (sin D18 ni segundo tronco)');
const J = CONFIG.PERKS.list.jugg;
check(G.roomAt(J.x, J.z).id === 'R11' && J.z < -49, 'Juggernog al final del muelle');
check(CONFIG.GENERATORS.spots.caseta.room === 'R14' && G.roomAt(CONFIG.GENERATORS.spots.caseta.x, CONFIG.GENERATORS.spots.caseta.z).id === 'R14', 'un generador en el rancho (clave caseta)');
check(CONFIG.GARDEN.plants.every(([x, z]) => ['R12', 'R13'].includes(G.roomAt(x, z).id)), 'plantas en los jardines de la casa');
check(CONFIG.SHIELD.bench.room === 'R6' && !CONFIG.SHIELD.bench.level, 'banco del escudo en el garaje');

// F5.16b: el techo del santuario frena la lluvia
{ const S = CONFIG.TEMPLE.sanctum, cx = (S.x1 + S.x2) / 2, cz = (S.z1 + S.z2) / 2;
  check(G.rainRoof(cx, cz) > UP.y + 4 && G.rainRoof(cx, S.z1 - 3) === UP.y && G.rainRoof(60, 60) < 1, 'la lluvia frena en el techo del santuario (en la cima, en la piedra; abajo, en el piso)'); }

// 5) tanda B: 5 áreas. Casa ↔ Rancho (D20), Casa ↔ Templo (H6), Rancho ↔ Búnker (H2), Rancho ↔ Calamar (H8)
const nav = (x, z) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (G.flowAt(Math.floor(x) + dx, Math.floor(z) + dz) >= 0) return true; return false; };
function reachWith(open) { G.resetGame(); state.running = true; open.forEach(G.openDoor); player.pos.set(0, 1.7, 0); G.updateFlowField(true); }
const casa = Object.keys(state.doors).filter(id => /^D/.test(id) && id !== 'D20');
check(!state.doors.H3 && !state.doors.H4 && !state.doors.H5 && !state.doors.H7 && !G.ROOMS.some(r => r.id === 'R18'), 'sin Campamento (R18) ni H3, H4, H5, H7');
reachWith(casa.concat(['H2', 'H8']));
check(!nav(-50, 30) && !nav(-60, 64) && !nav(-60, -10), 'sin el lazo, desde la casa no se llega a pie al rancho, al búnker ni al calamar');
reachWith(casa.concat(['D20']));
check(nav(-50, 30) && !nav(-60, 64) && !nav(-60, -10) && !nav(70, 60), 'con el lazo: el rancho sí; búnker, calamar y templo no');
reachWith(casa.concat(['D20', 'H2', 'H8']));
check(nav(-60, 64) && nav(-60, -10), 'desde el rancho: búnker (H2) y calamar (H8)');
reachWith(casa.concat(['H6']));
check(nav(70, 60) && !nav(-60, -10), 'desde la casa: templo (H6); el calamar a pie no');
check(!nav(-30, -15) || G.WORLD.colliders.some(c => c.tag === 'hedge' && c.minX < -40.5 && c.maxX > -41.5 && c.minZ <= -14 && c.maxZ >= -9), 'la playa oeste y el calamar: cerco fijo entero en x -41');

// 6) portal Templo ↔ Calamar
const PT = CONFIG.PORTAL;
fresh(); G.debugOpenAllDoors(); state.doors.H6.open = false;
player.pos.set(PT.temple.x, 1.7, PT.temple.z + 1.2); G.updateInteract();
check(G.interactState.kind === 'portal' && !G.portalOn() && /apagado/.test(G.promptFor(G.interactState).text) && !G.interact(), 'con el templo cerrado el portal está apagado');
G.openDoor('H6'); G.updateInteract();
check(G.portalOn() && /Calamar/.test(G.promptFor(G.interactState).text), 'al abrir el templo se prende', `("${G.promptFor(G.interactState).text}")`);
check(G.interact(), 'F lo usa');
for (let i = 0; i < 90; i++) { G.tick(dt); G.updateBunker(dt); }
check(Math.hypot(player.pos.x - PT.squid.out[0], player.pos.z - PT.squid.out[1]) < 0.01 && G.roomAt(player.pos.x, player.pos.z).id === 'R19', 'aparece en la playa del calamar');
G.updateInteract();
check(G.interactState.kind === 'portal' && /Templo/.test(G.promptFor(G.interactState).text) && G.interact(), 'y de vuelta');
for (let i = 0; i < 90; i++) { G.tick(dt); G.updateBunker(dt); }
check(Math.hypot(player.pos.x - PT.temple.out[0], player.pos.z - PT.temple.out[1]) < 0.01, 'vuelve al templo');
check(G.openRooms().includes('R19') && G.openRooms().includes('R20'), 'la caja puede mudarse por el portal (openRooms)');
check(nav(PT.temple.out[0], PT.temple.out[1]) && nav(PT.squid.out[0], PT.squid.out[1]), 'las salidas del portal son caminables');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
