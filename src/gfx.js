//=== 8c. GRÁFICOS (V2 F7a) =================================================
// Calidad Bajo / Medio / Alto (CONFIG.GFX.presets; Ajustes, dura la sesión): pixel ratio, sombras (solo Alto),
// post-proceso, polvo y haces del tema y densidad de la lluvia. El gobernador de calidad (updateQuality) sigue
// bajando niveles solo si los FPS no alcanzan.
// Sombras: solo el sol (WORLD.sun), con un mapa que sigue al jugador. Las lámparas de adentro no proyectan. Los
// meshes se marcan una vez (gfxMarkShadows, al final de init): los transparentes, Points y MeshBasic, no.
// Post-proceso sin shaders: un div (#post) con viñeta y grano sobre el canvas y un filtro CSS de color en el canvas
// (cálido al atardecer, frío de noche). El blur del silbido del boss (GFX.blur) se compone acá, en un solo filtro.
// Cielo: disco del sol bajo al oeste (se apaga al anochecer) y luna sobre el mar (de noche). Creados una vez.
const GFX = { quality: null, post: true, shadows: false, blur: 0, filter: null, grainT: 0, sunDisk: null, moon: null,
              marked: false, el: null };

function buildGfx() {
  const C = CONFIG.GFX;
  const disk = (cfg, inner, outer) => {
    const tex = radialTex(inner, outer);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(cfg.size, cfg.size), new THREE.MeshBasicMaterial({ map: tex, color: cfg.color,
      transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    const d = new THREE.Vector3().fromArray(cfg.dir).normalize().multiplyScalar(280);
    m.position.copy(d); m.lookAt(0, 0, 0);
    m.frustumCulled = false; m.visible = false; m.userData.theme = false;
    scene.add(m);
    return m;
  };
  GFX.sunDisk = disk(C.sunDisk, 'rgba(255,240,200,1)', 'rgba(255,140,60,0.35)');
  GFX.moon = disk(C.moon, 'rgba(255,255,255,1)', 'rgba(170,190,255,0.25)');
  // F5.28f (Diego): sin grano ni viñeta por CSS: el div #post queda siempre apagado
  GFX.el = document.getElementById('post');
  if (GFX.el && GFX.el.style) GFX.el.style.display = 'none';
  if (WORLD.sun && WORLD.sun.target) scene.add(WORLD.sun.target);         // el sol apunta al jugador (sombras)
  GFX.sunBase = WORLD.sun ? WORLD.sun.position.clone().normalize() : new THREE.Vector3(-0.7, 0.3, -0.5);
  buildSkyDome();
  buildGrade();                                                            // F5.28e: la corrección de color (sin WebGL: no)
}
//--- F5.28e/f: la corrección de color. El mundo se dibuja a una textura (con MSAA si hay WebGL2) y un solo shader le
// aplica el revelado de Diego (CONFIG.GFX.grade, escala -100..100 como Lightroom), en este orden: nitidez (vecinos a 1 px),
// claridad (contraste local de los medios tonos, vecinos a 8 px), balance de blancos (temperatura y tono, sin cambiar el
// brillo), luces / sombras / blancos / negros (sobre la luminancia), contraste y saturación. F5.28f (Diego: "no me gusta
// el gris de interferencia como tv vieja"): sin grano, aberración, viñeta, negro levantado ni perfiles por zona. El arma
// se dibuja después, sin el filtro, y el HUD es HTML. En calidad Bajo (post off) no se usa
const GRADE = { on: false, rt: null, quad: null, cam: null, u: null, size: null };
const GRADE_KEYS = ['temp', 'tint', 'con', 'high', 'shad', 'white', 'black', 'sat', 'sharp', 'clarity'];
function buildGrade() {
  if (typeof renderer === 'undefined' || !renderer || !renderer.capabilities || !renderer.setRenderTarget || !renderer.getDrawingBufferSize ||
      typeof THREE.WebGLRenderTarget === 'undefined') return false;       // (sin WebGL de verdad, como en los tests: no hay corrección)
  try {
    const opt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: true };
    GRADE.rt = renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget
      ? Object.assign(new THREE.WebGLMultisampleRenderTarget(4, 4, opt), { samples: CONFIG.GFX.gradeSamples }) : new THREE.WebGLRenderTarget(4, 4, opt);
    const u = GRADE.u = { tDiffuse: { value: GRADE.rt.texture }, res: { value: new THREE.Vector2(4, 4) } };
    for (const k of GRADE_KEYS) u[k] = { value: 0 };
    const m = new THREE.ShaderMaterial({ uniforms: u, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: [
        'uniform sampler2D tDiffuse; uniform vec2 res; uniform float ' + GRADE_KEYS.join(', ') + ';',
        'varying vec2 vUv;',
        'vec3 tx(vec2 uv) { return texture2D(tDiffuse, uv).rgb; }',
        'float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }',
        'void main() {',
        '  vec2 px = 1.0 / res;',
        '  vec3 c = tx(vUv);',
        '  vec3 b1 = (tx(vUv + vec2(px.x, 0.0)) + tx(vUv - vec2(px.x, 0.0)) + tx(vUv + vec2(0.0, px.y)) + tx(vUv - vec2(0.0, px.y))) * 0.25;',
        '  c += (c - b1) * sharp * 1.5;',                                              // nitidez (- suaviza)
        '  vec2 q = px * 7.0;',                                                        // (4 diagonales: más barato que 8)
        '  vec3 b8 = (tx(vUv + q) + tx(vUv - q) + tx(vUv + vec2(q.x, -q.y)) + tx(vUv + vec2(-q.x, q.y))) * 0.25;',
        '  float l0 = luma(c);',
        '  c += (c - b8) * clarity * 1.2 * (1.0 - abs(l0 * 2.0 - 1.0));',              // claridad: solo los medios tonos
        '  l0 = max(luma(c), 1e-4);',
        '  c *= vec3(1.0 + 0.16 * temp + 0.04 * tint, 1.0 + 0.02 * temp - 0.10 * tint, 1.0 - 0.24 * temp + 0.04 * tint);',
        '  c *= l0 / max(luma(c), 1e-4);',                                             // (el balance no cambia el brillo)
        '  float l = max(luma(c), 1e-4);',
        '  float d = high * 0.35 * smoothstep(0.35, 1.0, l) * l',                      // luces
        '          + shad * 0.3 * smoothstep(0.0, 0.12, l) * (1.0 - smoothstep(0.12, 0.5, l)) * l',   // sombras
        '          + white * 0.25 * smoothstep(0.6, 1.0, l);',                         // blancos
        '  c *= max(l + d, 0.0) / l;',
        '  c += black * 0.12 * (1.0 - smoothstep(0.0, 0.25, l));',                     // negros
        '  c = (c - 0.45) * (1.0 + con * 0.6) + 0.45;',                                // contraste
        '  float ls = luma(c);',
        '  c = mix(vec3(ls), c, 1.0 + sat);',                                          // saturación
        '  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);',
        '}'].join('\n') });
    GRADE.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); GRADE.quad.frustumCulled = false;
    GRADE.scene = new THREE.Scene(); GRADE.scene.add(GRADE.quad);
    GRADE.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    GRADE.size = new THREE.Vector2();
    return true;
  } catch (e) { GRADE.rt = null; return false; }
}
// los valores de CONFIG (-100..100) al shader (-1..1): se leen cada frame, así se pueden probar desde la consola
function updateGrade() {
  const G = CONFIG.GFX.grade, u = GRADE.u;
  for (const k of GRADE_KEYS) u[k].value = (G[k] || 0) / 100;
}
// el frame entero (animate): mundo (a la textura, si hay corrección), la corrección a la pantalla, y el arma encima
function renderFrame(dt) {
  GRADE.on = GFX.post && !!GRADE.rt;
  if (!GRADE.on) {                                                        // (el destino siempre queda en la pantalla)
    renderer.clear();
    renderer.render(scene, camera);
  } else {
    renderer.getDrawingBufferSize(GRADE.size);
    if (GRADE.rt.width !== GRADE.size.x || GRADE.rt.height !== GRADE.size.y) { GRADE.rt.setSize(GRADE.size.x, GRADE.size.y); GRADE.u.res.value.copy(GRADE.size); }
    updateGrade();
    renderer.setRenderTarget(GRADE.rt); renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.clear();
    renderer.render(GRADE.scene, GRADE.cam);
  }
  renderer.clearDepth();                                                  // el arma nunca la corta una pared
  renderer.render(weaponScene, weaponCamera);
}
// F5.17b (Diego: "¿es muy costoso ver el cielo?"): lo caro no es el cielo sino ver lejos (más geometría). El cielo es
// un domo que sigue a la cámara, más chico que camera.far, dibujado primero sin profundidad: detrás de todo. Abajo
// es el color de la niebla (lo lejano se funde en el horizonte) y arriba degrada al cielo de la hora, con el sol, la
// luna y estrellas pintados en el shader. Un draw call, ninguna luz. La niebla sigue recortando igual
const SKYDOME = { mesh: null, u: null };
function buildSkyDome() {
  const C = CONFIG.GFX.sky, u = {
    horizon: { value: scene.fog.color }, top: { value: new THREE.Color(C.dayTop) },
    sunDir: { value: new THREE.Vector3().fromArray(CONFIG.GFX.sunDisk.dir).normalize() }, sunCol: { value: new THREE.Color(CONFIG.GFX.sunDisk.color) },
    moonDir: { value: new THREE.Vector3().fromArray(CONFIG.GFX.moon.dir).normalize() }, sunA: { value: 1 }, moonA: { value: 0 }, starA: { value: 0 }
  };
  const m = new THREE.ShaderMaterial({ uniforms: u, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform vec3 horizon, top, sunCol, sunDir, moonDir; uniform float sunA, moonA, starA; varying vec3 vDir;',
      'void main() {',
      '  vec3 d = normalize(vDir); float h = d.y;',
      '  vec3 c = mix(horizon, top, smoothstep(0.03, 0.62, h));',
      '  float s = max(dot(d, sunDir), 0.0);',
      '  c += sunCol * (pow(s, 48.0) * 0.55 + smoothstep(0.9988, 0.9994, s) * 1.4) * sunA;',
      '  float m = max(dot(d, moonDir), 0.0);',
      '  c += vec3(0.92, 0.95, 1.0) * smoothstep(0.9992, 0.9996, m) * moonA + vec3(0.45, 0.55, 0.9) * pow(m, 160.0) * 0.35 * moonA;',
      '  vec3 q = floor(d * 260.0); float n = fract(sin(dot(q, vec3(12.9898, 78.233, 45.164))) * 43758.5453);',
      '  c += vec3(step(0.9975, n)) * starA * smoothstep(0.08, 0.35, h);',
      '  gl_FragColor = vec4(c, 1.0);',
      '}'].join('\n')
  });
  const g = new THREE.SphereGeometry(1, 32, 16);
  SKYDOME.mesh = new THREE.Mesh(g, m); SKYDOME.u = u;
  SKYDOME.mesh.renderOrder = -1e6; SKYDOME.mesh.frustumCulled = false; SKYDOME.mesh.userData.theme = false;
  scene.add(SKYDOME.mesh);
}
const _skyC = new THREE.Color(), _skyN = new THREE.Color(), _skyP = new THREE.Color();
// F5.20 (Diego): el sol está hacia XZ (4, -66) y va bajando de la R1 a la R8 (sunPath.elev0 -> elev1); después es noche
// (darkBy). Mueve la luz del sol (y la base de las sombras), el disco y el sol del domo del cielo
const _sunV = new THREE.Vector3();
function setSunForRound(n) {
  const S = CONFIG.GFX.sunPath, k = Math.max(0, Math.min(1, (n - 1) / Math.max(1, S.lastRound - 1)));
  const e = S.elev0 + (S.elev1 - S.elev0) * k, h = Math.hypot(S.dir[0], S.dir[1]);
  _sunV.set(S.dir[0] / h * Math.cos(e), Math.sin(e), S.dir[1] / h * Math.cos(e)).normalize();
  if (WORLD.sun) WORLD.sun.position.copy(_sunV).multiplyScalar(60);
  if (GFX.sunBase) GFX.sunBase.copy(_sunV);
  if (GFX.sunDisk) { GFX.sunDisk.position.copy(_sunV).multiplyScalar(280); GFX.sunDisk.lookAt(0, 0, 0); }
  if (SKYDOME.u && SKYDOME.u.sunDir) SKYDOME.u.sunDir.value.copy(_sunV);
}
function updateSkyDome() {
  const D = SKYDOME.mesh;
  if (!D) return;
  const C = CONFIG.GFX.sky, k = typeof NIGHT !== 'undefined' ? NIGHT.k : 0, p = typeof NIGHT !== 'undefined' ? NIGHT.p : 0;
  D.position.copy(camera.position);
  D.scale.setScalar(Math.max(10, camera.far - 3));
  // arriba: del violeta del atardecer al azul de la noche (la neblina morada lo tiñe)
  SKYDOME.u.top.value.copy(_skyC.setHex(C.dayTop)).lerp(_skyN.setHex(C.nightTop), k).lerp(_skyP.setHex(C.purpleTop), p);
  if (typeof eeSkyTint === 'function') eeSkyTint(SKYDOME.u.top.value, 'top');   // F5.29: después del Kraken, azul brillante
  SKYDOME.u.sunA.value = Math.max(0, 1 - k / 0.6) * (1 - p);
  SKYDOME.u.moonA.value = Math.max(0, (k - CONFIG.GFX.moon.from) / (1 - CONFIG.GFX.moon.from)) * (1 - 0.6 * p);
  SKYDOME.u.starA.value = Math.max(0, (k - 0.3) / 0.7) * (1 - 0.7 * p);
}
// una vez, con todo construido: quién proyecta y quién recibe sombra
function gfxMarkShadows() {
  if (GFX.marked) return;
  GFX.marked = true;
  scene.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    const lit = !m.isMeshBasicMaterial && !m.transparent;
    o.receiveShadow = lit;
    o.castShadow = lit && o.visible;
    if (m === FOLI.mat && FOLI.depth) o.customDepthMaterial = FOLI.depth;          // F5.17: la sombra de las hojas respeta el alfa (si no, cuadrados)
  });
}
// F5.16: distancia de la niebla elegida en Ajustes (dura la sesión). camera.far la sigue (lo de más allá no se
// dibuja), y el boss y la neblina morada la cierran desde ahí
function setFog(far) {
  const F = CONFIG.FOG;
  far = Math.max(F.min, Math.min(F.max, far || F.far));
  SETTINGS.fog = far;
  if (typeof scene !== 'undefined' && scene && scene.fog) {
    if (typeof BOSS !== 'undefined' && BOSS.fogBase) BOSS.fogBase.far = far;
    if (!(typeof bossAlive === 'function' && bossAlive())) scene.fog.far = typeof weatherFogFar === 'function' ? weatherFogFar(far) : far;
  }
  if (typeof camera !== 'undefined' && camera) { camera.far = far + (F.clip - F.far); camera.updateProjectionMatrix(); }
  return far;
}
// F5.19d (optimización): escala de resolución (Ajustes). El juego se dibuja a scale × la resolución y el navegador lo
// estira: con una placa integrada es lo que más FPS da (70% = la mitad de píxeles)
function renderScale(base) { return base * (SETTINGS.scale || 1); }
function setRenderScale(s) {
  SETTINGS.scale = Math.max(0.4, Math.min(1, +s || 1));
  applyQuality(GFX.quality || CONFIG.GFX.quality);
  return SETTINGS.scale;
}
function applyQuality(name) {
  const C = CONFIG.GFX, Q = C.presets[name] || C.presets.medio;
  GFX.quality = name in C.presets ? name : 'medio';
  if (typeof renderer !== 'undefined' && renderer) {
    renderer.setPixelRatio(renderScale(Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, Q.pixelRatio)));
    renderer.setSize(window.innerWidth, window.innerHeight);
    setShadows(Q.shadows, Q.shadowMap || 1024);
  }
  if (THEMEFX.dust) THEMEFX.dust.visible = Q.dust;
  if (THEMEFX.shafts) THEMEFX.shafts.visible = Q.shafts;
  if (RAIN.lines) RAIN.lines.geometry.setDrawRange(0, Math.floor(RAIN.n * Q.particles) * 2);
  setPost(Q.post);
  return GFX.quality;
}
function setShadows(on, size) {
  const S = WORLD.sun;
  GFX.shadows = !!on;
  if (size) GFX.shadowSize = size;
  if (!renderer.shadowMap || !S) return;
  if (renderer.shadowMap.enabled === GFX.shadows && S.castShadow === GFX.shadows) return;
  if (GFX.shadows) gfxMarkShadows();
  renderer.shadowMap.enabled = GFX.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  S.castShadow = GFX.shadows;
  if (GFX.shadows && S.shadow) {
    const B = CONFIG.GFX.shadowBox / 2, cam = S.shadow.camera;
    S.shadow.mapSize.set(size, size);
    cam.left = -B; cam.right = B; cam.top = B; cam.bottom = -B; cam.near = 1; cam.far = CONFIG.GFX.shadowFar;
    cam.updateProjectionMatrix();
    S.shadow.bias = -0.0008;
    S.shadow.normalBias = 0.03;                  // F5.16: menos acné en pisos grandes
  }
  // prender o apagar el shadow map cambia los shaders: una sola recompilación, al tocar el ajuste
  scene.traverse(o => { if (o.isMesh && o.material && !Array.isArray(o.material)) o.material.needsUpdate = true; });
}
function setPost(on) {
  GFX.post = !!on;
  // F5.28f: el div del grano y la viñeta queda siempre apagado
  if (GFX.el) GFX.el.style.display = 'none';
  GFX.filter = null;                                                      // lo rearma updateGfx
}
// el filtro CSS del canvas: color según la hora (post) + blur del silbido
function gfxFilter() {
  const P = CONFIG.GFX.post, k = typeof NIGHT !== 'undefined' ? NIGHT.k : 0;
  // F5.23: la lengua de la planta te nubla la vista (GFX.fog 0..1) mientras te lleva a la boca
  const fog = GFX.fog || 0, TF = CONFIG.PLANTBOSS.tongue, blur = Math.max(GFX.blur, fog * TF.blurMax);
  let f = blur > 0 ? 'blur(' + blur.toFixed(1) + 'px)' : '';
  if (fog > 0) f += (f ? ' ' : '') + 'brightness(' + (1 - TF.darkMax * fog).toFixed(3) + ')';
  if (GFX.post && !GRADE.rt) {                                             // (F5.28e: con GRADE el color lo hace el shader)
    const warm = 1 - k;
    f += (f ? ' ' : '') + 'contrast(' + P.contrast + ') saturate(' + (1.02 + 0.1 * warm).toFixed(3) + ') sepia(' +
         (P.warm * warm).toFixed(3) + ') hue-rotate(' + (-P.cold * k).toFixed(1) + 'deg)';
  }
  // F5.28d: NIGHT EYES: visión nocturna verde (sube el brillo: se ve también lo pintado a oscuras, como el búnker)
  if (typeof gumActive === 'function' && gumActive('nighteyes')) f += (f ? ' ' : '') + CONFIG.GUMS.list.nighteyes.filter;
  // F5.19b: muerte. F5.28e: mientras te comen, se va oscureciendo (GFX.deathK 0..1 hasta ROUNDS.death.dark). F5.28f
  // (Diego: "que se vaya poniendo poco a poco borrosa hasta quedar en negro"): y cada vez más borrosa (hasta death.blur px)
  if (typeof DEATH !== 'undefined' && DEATH.on) {
    const D = CONFIG.ROUNDS.death, k = GFX.deathK || 0, b = 0.8 - (0.8 - D.dark) * k;
    f += (f ? ' ' : '') + 'blur(' + (Math.round(k * D.blur * 2) / 2).toFixed(1) + 'px) saturate(' + (0.45 - 0.25 * k).toFixed(2) +
         ') brightness(' + (Math.round(b * 40) / 40).toFixed(3) + ') contrast(1.15)';
  }
  else if (typeof DOWN !== 'undefined' && DOWN.on) f +=(f ? ' ' : '') + 'grayscale(1) brightness(0.8)';   // F5.18: tirado
  else if (typeof MENU !== 'undefined' && MENU.mode === 'main' && !state.running) f += (f ? ' ' : '') + 'grayscale(1) brightness(0.75) contrast(1.15)';   // F5.18: menú
  return f;
}
function gfxApplyFilter() {
  const f = gfxFilter();
  if (f !== GFX.filter && typeof renderer !== 'undefined' && renderer) { GFX.filter = f; renderer.domElement.style.filter = f; }
}
const SNAP = { r: new THREE.Vector3(), u: new THREE.Vector3(), f: new THREE.Vector3(), out: new THREE.Vector3() };
function shadowSnap(p) {
  const G = CONFIG.GFX, tex = G.shadowBox / (GFX.shadowSize || 1024);
  SNAP.f.copy(GFX.sunBase).normalize();
  SNAP.r.set(0, 1, 0).cross(SNAP.f).normalize(); SNAP.u.copy(SNAP.f).cross(SNAP.r);
  SNAP.out.set(p.x, 0, p.z);
  const a = Math.round(SNAP.out.dot(SNAP.r) / tex) * tex, b = Math.round(SNAP.out.dot(SNAP.u) / tex) * tex, c = SNAP.out.dot(SNAP.f);
  return SNAP.out.copy(SNAP.r).multiplyScalar(a).addScaledVector(SNAP.u, b).addScaledVector(SNAP.f, c);
}
function updateGfx(dt) {
  // sombras: el sol (y su cámara de sombra) sigue al jugador, en la dirección de siempre
  const S = WORLD.sun;
  if (GFX.shadows && S) {
    // F5.16 (bug del piso del rancho): la cámara de sombra salta de a un texel en el plano de la luz. Siguiendo al
    // jugador de forma continua, el borde de cada sombra titilaba al caminar (bajo la palapa se veía el piso "vivo")
    S.target.position.copy(shadowSnap(player.pos));
    S.position.copy(GFX.sunBase).multiplyScalar(CONFIG.GFX.shadowFar * 0.5).add(S.target.position);
    S.target.updateMatrixWorld();
  }
  gfxApplyFilter();                                                       // solo toca el DOM cuando cambia
  updateSkyDome();                                                        // F5.17b
  // sol y luna
  const k = typeof NIGHT !== 'undefined' ? NIGHT.k : 0, M = CONFIG.GFX.moon;
  if (GFX.sunDisk) {
    const o = Math.max(0, 1 - k / 0.6) * (1 - NIGHT.p);
    GFX.sunDisk.visible = o > 0.01; GFX.sunDisk.material.opacity = o;
  }
  if (GFX.moon) {
    const o = Math.max(0, (k - M.from) / (1 - M.from)) * (1 - 0.6 * NIGHT.p);
    GFX.moon.visible = o > 0.01; GFX.moon.material.opacity = o;
  }
}
