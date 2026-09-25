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
  // grano: una textura de ruido chica que se repite (la mueve updateGfx)
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  if (g && g.createImageData) {
    const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
  }
  GFX.el = document.getElementById('post');
  if (GFX.el && GFX.el.style && cv.toDataURL) GFX.el.style.setProperty('--grain', 'url(' + cv.toDataURL() + ')');
  if (WORLD.sun && WORLD.sun.target) scene.add(WORLD.sun.target);         // el sol apunta al jugador (sombras)
  GFX.sunBase = WORLD.sun ? WORLD.sun.position.clone().normalize() : new THREE.Vector3(-0.7, 0.3, -0.5);
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
function applyQuality(name) {
  const C = CONFIG.GFX, Q = C.presets[name] || C.presets.medio;
  GFX.quality = name in C.presets ? name : 'medio';
  if (typeof renderer !== 'undefined' && renderer) {
    renderer.setPixelRatio(Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, Q.pixelRatio));
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
  if (GFX.el) GFX.el.style.display = GFX.post ? 'block' : 'none';
  GFX.filter = null;                                                      // lo rearma updateGfx
}
// el filtro CSS del canvas: color según la hora (post) + blur del silbido
function gfxFilter() {
  const P = CONFIG.GFX.post, k = typeof NIGHT !== 'undefined' ? NIGHT.k : 0;
  let f = GFX.blur > 0 ? 'blur(' + GFX.blur.toFixed(1) + 'px)' : '';
  if (GFX.post) {
    const warm = 1 - k;
    f += (f ? ' ' : '') + 'contrast(' + P.contrast + ') saturate(' + (1.02 + 0.1 * warm).toFixed(3) + ') sepia(' +
         (P.warm * warm).toFixed(3) + ') hue-rotate(' + (-P.cold * k).toFixed(1) + 'deg)';
  }
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
  // grano: salta de lugar cada 2 frames
  if (GFX.post && GFX.el && (GFX.grainT += dt) > 0.033) {
    GFX.grainT = 0;
    GFX.el.style.setProperty('--gx', Math.floor(Math.random() * 128) + 'px');
    GFX.el.style.setProperty('--gy', Math.floor(Math.random() * 128) + 'px');
  }
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
