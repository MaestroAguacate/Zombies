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

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
