// V2 F7a: calidad Bajo / Medio / Alto (pixel ratio, sombras solo en Alto, post, polvo, haces, lluvia), sombras
// que siguen al jugador, post-proceso CSS (color según la hora, blur del boss compuesto), ciclo de luz por ronda
// (paradas de color, intensidades iguales que antes), sol y luna, y que nada crea objetos al animar.
const G = require('./harness.js');
const THREE = require('three');
const { state, player, CONFIG, WORLD, NIGHT, GFX } = G;
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };
const dt = 1 / 60;
function settle(s) { for (let i = 0; i < Math.round(s * 60); i++) { G.tick(dt); G.updateNight(dt); G.updateGfx(dt); } }
G.resetGame(); state.running = true; settle(0.1);

// 1) calidad
check(GFX.quality === 'medio' && !GFX.shadows && GFX.post, 'arranca en Medio: sin sombras, con post');
check(!G.renderer.shadowMap.enabled && !WORLD.sun.castShadow, 'sin shadow map');
G.applyQuality('alto');
check(GFX.shadows && G.renderer.shadowMap.enabled && WORLD.sun.castShadow && WORLD.sun.shadow.mapSize.x === CONFIG.GFX.presets.alto.shadowMap,
  'Alto: sombras del sol');
const cast = [], recv = [];
G.scene.traverse(o => { if (o.isMesh) { if (o.castShadow) cast.push(o); if (o.receiveShadow) recv.push(o); } });
check(cast.length > 50 && recv.length > 50, 'los meshes proyectan y reciben', `(${cast.length} / ${recv.length})`);
check(!cast.some(o => { const m = Array.isArray(o.material) ? o.material[0] : o.material; return m.transparent || m.isMeshBasicMaterial; }),
  'ni transparentes ni MeshBasic proyectan');
check(WORLD.lamps.every(L => !L.castShadow), 'las lámparas de adentro no proyectan');
const lights = []; G.scene.traverse(o => { if (o.isLight) lights.push(o); });
player.pos.set(30, 1.7, -12); settle(dt);
const tg = WORLD.sun.target.position;
check(Math.abs(tg.x - 30) < 1e-6 && Math.abs(tg.z + 12) < 1e-6 && WORLD.sun.target.parent === G.scene, 'la sombra sigue al jugador');
G.applyQuality('bajo');
check(!GFX.shadows && !G.renderer.shadowMap.enabled && !GFX.post && G.renderer.pixelRatio === 1, 'Bajo: sin sombras, sin post, pixel ratio 1');
check(G.THEMEFX.dust && !G.THEMEFX.dust.visible && !G.THEMEFX.shafts.visible, 'Bajo: sin polvo ni haces');
check(G.RAIN.lines.geometry.drawRange.count === Math.floor(G.RAIN.n * 0.4) * 2, 'Bajo: 40% de la lluvia');
G.applyQuality('medio');
check(G.THEMEFX.dust.visible && GFX.post && G.RAIN.lines.geometry.drawRange.count === G.RAIN.n * 2, 'Medio: vuelve todo');
const lights2 = []; G.scene.traverse(o => { if (o.isLight) lights2.push(o); });
check(lights2.length === lights.length, 'cambiar la calidad no agrega luces');

// 2) post-proceso
settle(dt);
const f0 = G.renderer.domElement.style.filter;
check(/sepia/.test(f0) && !/blur/.test(f0), 'post: color en el canvas', `(${f0})`);
G.setPost(false); settle(dt);
check(G.renderer.domElement.style.filter === '', 'sin post: sin filtro');
G.setPost(true);
NIGHT.k = NIGHT.target = 1; settle(dt);
const fN = G.renderer.domElement.style.filter;
check(/hue-rotate\(-\d/.test(fN) && /sepia\(0\.000\)/.test(fN), 'de noche frío, sin sepia', `(${fN})`);
NIGHT.k = NIGHT.target = 0;
GFX.blur = 3; G.updateGfx(dt);
check(G.renderer.domElement.style.filter.indexOf('blur(3.0px)') === 0 && /sepia/.test(G.renderer.domElement.style.filter), 'el blur del boss y el color van juntos');
GFX.blur = 0;

// 3) ciclo de luz: paradas de color por ronda, intensidades como antes
G.resetGame(); state.running = true; settle(0.2);
const hemiDay = WORLD.hemi.intensity, skyDay = WORLD.sky.material.color.clone();
const col = n => { G.setSky(n, false); settle(12); return { sky: WORLD.sky.material.color.clone(), fog: G.scene.fog.color.clone(), hemi: WORLD.hemi.intensity }; };
const r5 = col(5), r10 = col(10), r15 = col(15);
const warm = c => c.r - c.b;
check(warm(r5.sky) > 0.25, 'R5: atardecer rojo (más rojo que azul)', `(${r5.sky.getHexString()})`);
check(r10.sky.b > r10.sky.r, 'R10: anochecer azul-violeta', `(${r10.sky.getHexString()})`);
check(r15.sky.getHex() === new THREE.Color(CONFIG.DOGS.night.sky).getHex(), 'R15: la noche', `(${r15.sky.getHexString()})`);
check(r5.hemi > r10.hemi && r10.hemi > r15.hemi && Math.abs(r10.hemi - (hemiDay + (CONFIG.DOGS.night.hemi - hemiDay) * CONFIG.WEATHER.darkBy(10))) < 1e-9,
  'la luz baja pareja (como antes)');
G.setSky(1, false); settle(12);
check(WORLD.sky.material.color.getHex() === skyDay.getHex(), 'R1: el cielo del tema');

// 4) sol y luna
G.setSky(1, false); settle(12);
check(GFX.sunDisk.visible && GFX.sunDisk.material.opacity > 0.9 && !GFX.moon.visible, 'de día se ve el sol, no la luna');
G.setSky(15, false); settle(12);
check(!GFX.sunDisk.visible && GFX.moon.visible && GFX.moon.material.opacity > 0.9, 'de noche, la luna');
check(GFX.moon.position.y > 50 && GFX.moon.position.z < 0 && GFX.moon.material.fog === false, 'la luna arriba, sobre el mar, sin niebla');
const kids = G.scene.children.length;
for (let n = 1; n <= 25; n++) { G.setSky(n, n % 5 === 0); settle(0.5); }
check(G.scene.children.length === kids, 'el ciclo no crea objetos');

// 5) F7c: agua que se mueve y la playa
const B = G.BEACH, BD = CONFIG.DECOR.beach;
check(B.waterMats.length === 3, 'agua animada: los 2 brazos del río y la pileta', `(${B.waterMats.length})`);
const off0 = B.waterMats.map(w => w.tex.offset.x);
G.updateBeach(dt, 10);
check(B.waterMats.every((w, i) => w.tex.offset.x !== off0[i]) && B.waterMats[0].tex !== B.waterMats[1].tex, 'cada agua mueve su textura');
check(!WORLD.colliders.some(c => /beach|playa:decor/.test(c.tag)), 'la decoración de la playa no tiene collider');
check(B.crabs.length === BD.crabs && B.crabs.every(c => c.x >= BD.crabArea[0] && c.x <= BD.crabArea[1]), BD.crabs + ' cangrejos en la orilla');
const crab = B.crabs[0];
player.pos.set(crab.x + 1, 1.7, crab.z);
const x0 = crab.x;
for (let i = 0; i < 30; i++) G.updateBeach(dt, 10 + i * dt);
check(crab.x < x0 - 0.5, 'si te acercás, el cangrejo se escapa', `(${x0.toFixed(1)} -> ${crab.x.toFixed(1)})`);
const kids2 = G.scene.children.length;
for (let i = 0; i < 600; i++) G.updateBeach(dt, 20 + i * dt);
check(G.scene.children.length === kids2 && B.crabs.every(c => c.x >= BD.crabArea[0] - 1e-6 && c.x <= BD.crabArea[1] + 1e-6), 'no se van de la orilla ni crean objetos');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
