//=== 4. WEAPONS ==========================================================
const weaponsState = {
  group: null,          // grupo raíz en weaponScene
  model: null,          // modelo del arma actual
  phase: 'idle',        // idle | reloading | switching | melee | grenade (F2.7) | shield (F3a: escudo equipado)
  phaseT: 0,
  lastShot: -9999,
  kick: { x: 0, v: 0 }, // resorte de retroceso del modelo
  kickRoll: 0,
  muzzleUntil: 0,
  muzzleLightWorld: null,
  muzzleLightView: null,
  muzzleSprite: null,
  basePos: new THREE.Vector3(0.24, -0.22, -0.42),
  baseRot: new THREE.Euler(0, 0.05, 0),
  pendingSlot: -1
};
const raycaster = new THREE.Raycaster();
const decals = { pool: [], i: 0 };

//--- F3b: ADS (clic derecho mantenido). on = input; k = 0..1 cuánto está apuntando (entra/sale en ADS.time).
// Solo con arma en la mano, en 'idle' y sin correr. Baja el FOV de la cámara del mundo (el arma tiene la
// suya), la dispersión (fireWeapon), la velocidad (updatePlayer) y la sensibilidad (lookInput)
const ADS = { on: false, k: 0 };
function adsSpread() { return (1 - (1 - CONFIG.ADS.spreadMul) * ADS.k) * (player.crouch ? CONFIG.PLAYER.crouch.spreadMul : 1); }   // F5.18: agachado
function updateAds(dt) {
  const A = CONFIG.ADS, def = curDef();
  const want = ADS.on && def && weaponsState.phase === 'idle' && !player.sprinting;
  ADS.k = want ? Math.min(1, ADS.k + dt / A.time) : Math.max(0, ADS.k - dt / A.time);
  const fov = A.baseFov - (A.baseFov - ((def && def.adsFov) || A.fov)) * ADS.k;
  if (Math.abs(camera.fov - fov) > 1e-4) { camera.fov = fov; camera.updateProjectionMatrix(); }
}
function resetAds() {
  ADS.on = false; ADS.k = 0;
  if (camera) { camera.fov = CONFIG.ADS.baseFov; camera.updateProjectionMatrix(); }
}

function initWeaponLayer() {
  weaponScene = new THREE.Scene();
  weaponCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 8);
  weaponScene.add(new THREE.AmbientLight(0xbfc6d4, 0.75));
  const key = new THREE.DirectionalLight(0xfff0d8, 0.95); key.position.set(-1, 2, 1);
  weaponScene.add(key);
  const rim = new THREE.DirectionalLight(0xff9a55, 0.5); rim.position.set(1.5, -0.5, -1);
  weaponScene.add(rim);

  weaponsState.group = new THREE.Group();
  weaponScene.add(weaponsState.group);

  // Luces de fogonazo creadas UNA vez con intensity 0.
  // Agregar/quitar luces en runtime obliga a Three a recompilar shaders -> tirón.
  const lw = new THREE.PointLight(0xffc165, 0, 11, 2);
  scene.add(lw); weaponsState.muzzleLightWorld = lw;
  const lv = new THREE.PointLight(0xffd79a, 0, 1.4, 2);
  lv.position.set(0.24, -0.16, -0.85);
  weaponScene.add(lv); weaponsState.muzzleLightView = lv;

  // sprite del fogonazo
  const fTex = makeTex((c, s) => {
    c.clearRect(0, 0, s, s);
    const g = c.createRadialGradient(s/2, s/2, 2, s/2, s/2, s/2);
    g.addColorStop(0, 'rgba(255,255,220,1)');
    g.addColorStop(.35, 'rgba(255,190,90,.85)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
  }, 1, 64);
  const sp = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({ map: fTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  sp.visible = false;
  weaponsState.muzzleSprite = sp;
  weaponsState.group.add(sp);

  buildDecalPool();
  buildBloodPool();
  buildFxPools();

  weaponsState.knifeModel = buildKnifeModel();
  weaponsState.group.add(weaponsState.knifeModel);
  weaponsState.macheteModel = buildMacheteModel();      // F3b
  weaponsState.group.add(weaponsState.macheteModel);
}

//--- modelos de arma con cubos ---
function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  return m;
}
function buildWeaponModel(def) {
  const g = new THREE.Group();
  const B = def.bodyColor, W = def.gripColor, D = 0x15171b;
  let grip;
  if (def.model === 'shotgun') {
    g.add(box(0.075, 0.075, 0.90, B,   0, 0.02, -0.28));   // cañón
    g.add(box(0.10, 0.10, 0.30, B,     0, -0.01, 0.06));   // recámara
    g.add(box(0.085, 0.085, 0.24, W,   0, -0.05, -0.20));  // bombeo
    grip = box(0.07, 0.17, 0.11, W,    0, -0.15, 0.16);    // empuñadura
    g.add(grip);
    g.add(box(0.07, 0.09, 0.30, W,     0, -0.09, 0.32));   // culata
    g.add(box(0.022, 0.028, 0.03, D,   0, 0.07, -0.70));   // mira
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.74);
  } else if (def.model === 'smg') {
    g.add(box(0.07, 0.09, 0.42, B,     0, 0.02, -0.12));   // cuerpo
    g.add(box(0.035, 0.035, 0.14, D,   0, 0.03, -0.39));   // cañón
    g.add(box(0.05, 0.20, 0.06, D,     0, -0.14, -0.15));  // cargador
    grip = box(0.065, 0.15, 0.09, W,   0, -0.11, 0.05);    // empuñadura
    g.add(grip);
    g.add(box(0.04, 0.05, 0.22, D,     0, 0.0, 0.19));     // culata plegable
    g.add(box(0.02, 0.03, 0.03, D,     0, 0.08, -0.28));   // mira
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.47);
  } else if (def.model === 'rifle') {
    g.add(box(0.07, 0.08, 0.50, W,     0, 0.0, -0.25));    // guardamanos de madera
    g.add(box(0.075, 0.09, 0.30, B,    0, 0.03, 0.02));    // cajón de mecanismos
    g.add(box(0.03, 0.03, 0.30, D,     0, 0.03, -0.62));   // cañón
    g.add(box(0.05, 0.15, 0.08, D,     0, -0.10, -0.07));  // cargador
    grip = box(0.065, 0.14, 0.09, W,   0, -0.12, 0.14);    // empuñadura
    g.add(grip);
    g.add(box(0.07, 0.11, 0.30, W,     0, -0.05, 0.34));   // culata
    g.add(box(0.02, 0.03, 0.03, D,     0, 0.07, -0.70));   // mira
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.78);
  } else if (def.model === 'lmg') {
    g.add(box(0.10, 0.11, 0.50, B,     0, 0.02, -0.05));   // cajón
    g.add(box(0.075, 0.075, 0.26, D,   0, 0.03, -0.40));   // camisa del cañón
    g.add(box(0.045, 0.045, 0.26, D,   0, 0.03, -0.64));   // cañón
    g.add(box(0.13, 0.13, 0.14, 0x3d4a2e, 0, -0.12, -0.04)); // caja de cinta
    grip = box(0.07, 0.15, 0.09, W,    0, -0.13, 0.16);    // empuñadura
    g.add(grip);
    g.add(box(0.08, 0.11, 0.24, W,     0, -0.04, 0.33));   // culata
    g.add(box(0.022, 0.03, 0.03, D,    0, 0.09, -0.70));   // mira
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.79);
  } else if (def.model === 'raygun') {
    const E = def.flashColor;
    g.add(box(0.075, 0.10, 0.26, B,    0, 0.03, -0.08));   // cuerpo
    g.add(box(0.04, 0.04, 0.16, D,     0, 0.03, -0.28));   // cañón
    [-0.24, -0.29, -0.34].forEach(z => g.add(box(0.10, 0.10, 0.018, E, 0, 0.03, z)));  // anillos
    g.add(box(0.045, 0.05, 0.12, E,    0, 0.105, -0.04));  // celda de energía
    grip = box(0.065, 0.17, 0.09, W,   0, -0.12, 0.05);
    g.add(grip);
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.38);
  } else if (def.model === 'sniper') {
    g.add(box(0.06, 0.07, 0.50, W,     0, 0.0, -0.20));    // guardamanos
    g.add(box(0.07, 0.08, 0.22, B,     0, 0.03, 0.04));    // cajón
    g.add(box(0.028, 0.028, 0.55, D,   0, 0.035, -0.66));  // cañón largo
    g.add(box(0.05, 0.05, 0.30, D,     0, 0.12, -0.05));   // mira telescópica
    g.add(box(0.02, 0.05, 0.02, D,     0, 0.08, -0.05));   // montura
    grip = box(0.06, 0.13, 0.08, W,    0, -0.11, 0.14);
    g.add(grip);
    g.add(box(0.065, 0.12, 0.30, W,    0, -0.05, 0.36));   // culata
    g.userData.muzzle = new THREE.Vector3(0, 0.035, -0.95);
  } else if (def.model === 'flamethrower') {
    g.add(box(0.07, 0.07, 0.55, B,     0, 0.02, -0.22));   // tubo
    g.add(box(0.06, 0.06, 0.10, D,     0, 0.02, -0.53));   // boquilla
    g.add(box(0.14, 0.14, 0.30, 0xa33a22, 0, -0.12, -0.05)); // tanque
    g.add(box(0.025, 0.025, 0.025, 0x5aa0ff, 0, -0.03, -0.56)); // piloto
    grip = box(0.065, 0.15, 0.09, W,   0, -0.10, 0.14);
    g.add(grip);
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.59);
  } else if (def.model === 'revolver') {                   // F3b
    g.add(box(0.05, 0.05, 0.32, B,     0, 0.05, -0.20));   // cañón
    g.add(box(0.03, 0.02, 0.30, D,     0, 0.085, -0.20));  // costilla
    g.add(box(0.09, 0.09, 0.12, B,     0, 0.03, -0.01));   // tambor
    for (let i = 0; i < 3; i++) g.add(box(0.095, 0.012, 0.1, D, 0, 0.0 + i * 0.03, -0.01));   // estrías
    g.add(box(0.07, 0.07, 0.1, B,      0, 0.03, 0.08));    // armazón
    g.add(box(0.03, 0.04, 0.03, D,     0, 0.09, 0.12));    // martillo
    grip = box(0.065, 0.19, 0.09, W,   0, -0.10, 0.13);
    g.add(grip);
    g.userData.muzzle = new THREE.Vector3(0, 0.05, -0.37);
  } else if (def.model === 'doublebarrel') {
    [-0.03, 0.03].forEach(x => g.add(box(0.055, 0.055, 0.72, B, x, 0.03, -0.24)));   // dos cañones
    g.add(box(0.12, 0.08, 0.2, B,      0, 0.0, 0.1));      // báscula
    g.add(box(0.1, 0.06, 0.34, W,      0, -0.03, -0.2));   // guardamano
    grip = box(0.07, 0.15, 0.1, W,     0, -0.12, 0.2);
    g.add(grip);
    g.add(box(0.08, 0.1, 0.32, W,      0, -0.07, 0.38));   // culata
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.62);
  } else if (def.model === 'crossbow') {
    g.add(box(0.07, 0.07, 0.6, B,      0, 0, -0.12));      // riel
    g.add(box(0.7, 0.04, 0.06, 0x2a2a2a, 0, 0.02, -0.38)); // arco
    [-1, 1].forEach(s => g.add(box(0.012, 0.012, 0.36, 0xd8d2c0, s * 0.18, 0.03, -0.24, 0)));   // cuerdas
    g.add(box(0.02, 0.02, 0.5, 0x8a8a88, 0, 0.055, -0.2)); // virote
    g.add(box(0.03, 0.03, 0.05, 0xb8b8b0, 0, 0.055, -0.47));
    grip = box(0.06, 0.15, 0.08, W,    0, -0.1, 0.1);
    g.add(grip);
    g.add(box(0.07, 0.09, 0.26, W,     0, -0.03, 0.3));    // culata
    g.userData.muzzle = new THREE.Vector3(0, 0.05, -0.5);
  } else if (def.model === 'uzi') {                        // F5.11
    g.add(box(0.07, 0.1, 0.3, B,       0, 0.02, -0.08));   // cuerpo
    g.add(box(0.03, 0.03, 0.1, D,      0, 0.03, -0.28));   // cañón corto
    grip = box(0.06, 0.2, 0.08, W,     0, -0.12, -0.02);   // empuñadura con el cargador adentro
    g.add(grip);
    g.add(box(0.04, 0.06, 0.04, D,     0, -0.24, -0.02));  // pie del cargador
    g.add(box(0.02, 0.02, 0.2, D,      0, -0.02, 0.16));   // culata de alambre
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.34);
  } else if (def.model === 'ak47') {
    g.add(box(0.07, 0.08, 0.34, W,     0, -0.01, -0.3));   // guardamanos de madera
    g.add(box(0.075, 0.09, 0.3, B,     0, 0.03, 0.02));    // cajón
    g.add(box(0.03, 0.03, 0.3, D,      0, 0.04, -0.6));    // cañón
    g.add(box(0.02, 0.02, 0.3, D,      0, 0.07, -0.35));   // tubo de gas
    g.add(box(0.05, 0.17, 0.08, D,     0, -0.12, -0.08));  // cargador curvo (dos piezas)
    g.add(box(0.05, 0.1, 0.08, D,      0, -0.24, -0.13));
    grip = box(0.06, 0.14, 0.08, W,    0, -0.11, 0.14);
    g.add(grip);
    g.add(box(0.07, 0.1, 0.32, W,      0, -0.05, 0.35));   // culata
    g.userData.muzzle = new THREE.Vector3(0, 0.04, -0.76);
  } else if (def.model === 'deagle') {
    g.add(box(0.09, 0.09, 0.42, B,     0, 0.05, -0.12));   // corredera grande
    g.add(box(0.05, 0.05, 0.1, D,      0, 0.05, -0.37));   // boca
    g.add(box(0.03, 0.03, 0.36, D,     0, 0.1, -0.12));    // costilla
    grip = box(0.075, 0.2, 0.11, W,    0, -0.13, 0.06);
    g.add(grip);
    g.userData.muzzle = new THREE.Vector3(0, 0.05, -0.43);
  } else if (def.model === 'spas') {
    g.add(box(0.08, 0.08, 0.8, B,      0, 0.02, -0.26));   // cañón
    g.add(box(0.1, 0.06, 0.62, B,      0, -0.04, -0.2));   // tubo de cartuchos
    g.add(box(0.1, 0.07, 0.24, D,      0, -0.04, -0.34));  // corredera con agujeros
    for (let i = 0; i < 4; i++) g.add(box(0.105, 0.02, 0.03, 0x0a0a0a, 0, -0.02, -0.26 - i * 0.05));
    g.add(box(0.11, 0.11, 0.26, B,     0, 0.0, 0.08));     // cajón
    grip = box(0.07, 0.16, 0.1, W,     0, -0.13, 0.18);
    g.add(grip);
    g.add(box(0.03, 0.08, 0.3, D,      0, 0.02, 0.36));    // culata plegable
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.68);
  } else if (def.model === 'bow') {
    g.add(box(0.04, 0.9, 0.04, B,      0, 0.02, -0.3));    // arco (vertical)
    g.add(box(0.05, 0.25, 0.05, B,     0, 0.5, -0.24));
    g.add(box(0.05, 0.25, 0.05, B,     0, -0.46, -0.24));
    g.add(box(0.008, 0.95, 0.008, 0xd8d2c0, 0, 0.02, -0.12));   // cuerda
    const arrow = box(0.015, 0.015, 0.7, 0x8a6a3a, 0, 0.02, -0.25);   // flecha (se tensa al cargar)
    arrow.add(box(0.04, 0.04, 0.08, 0xb8b8b0, 0, 0, -0.38));
    arrow.add(box(0.05, 0.01, 0.1, 0xd83a2a, 0, 0, 0.3));
    g.add(arrow);
    g.userData.arrow = arrow;
    grip = box(0.06, 0.14, 0.06, W,    0, 0.02, -0.3);
    g.add(grip);
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.62);
  } else if (def.model === 'bazooka') {
    g.add(box(0.15, 0.15, 1.1, B,      0, 0.06, -0.15));   // tubo
    g.add(box(0.19, 0.19, 0.1, D,      0, 0.06, -0.72));   // boca
    g.add(box(0.19, 0.19, 0.12, D,     0, 0.06, 0.42));    // salida de atrás
    g.add(box(0.04, 0.1, 0.12, D,      -0.1, 0.16, -0.2)); // mira
    g.add(box(0.1, 0.07, 0.3, 0x6a2a1a, 0, 0.16, -0.62)); // cohete asomando
    grip = box(0.065, 0.16, 0.09, W,   0, -0.1, -0.05);
    g.add(grip);
    g.add(box(0.06, 0.12, 0.08, W,     0, -0.08, 0.15));
    g.userData.muzzle = new THREE.Vector3(0, 0.06, -0.8);
  } else if (def.model === 'wave') {                       // F5.5: tabla de surf + caracola + cuerda + coco
    g.add(box(0.1, 0.05, 0.62, B,        0, 0.02, -0.14));  // tabla (cuerpo)
    g.add(box(0.105, 0.052, 0.05, 0xf0ead8, 0, 0.02, -0.3));// franja
    g.add(box(0.012, 0.012, 0.56, 0xe8c050, 0, 0.055, -0.14)); // cuerda de guitarra
    g.add(box(0.13, 0.13, 0.13, 0x6a4a2a, 0, -0.07, -0.02));// coco (tanque)
    g.add(box(0.1, 0.1, 0.1, 0xe8b8a0,   0, 0.03, -0.5));   // caracola (boca)
    g.add(box(0.065, 0.065, 0.08, 0xd89880, 0, 0.03, -0.58));
    grip = box(0.065, 0.15, 0.09, W,     0, -0.1, 0.12);
    g.add(grip);
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.64);
  } else {
    g.add(box(0.085, 0.078, 0.40, B,   0, 0.045, -0.10));  // corredera
    g.add(box(0.080, 0.062, 0.34, B,   0, -0.015, -0.07)); // armazón
    g.add(box(0.036, 0.036, 0.07, D,   0, 0.045, -0.33));  // boca del cañón
    grip = box(0.072, 0.20, 0.10, W,   0, -0.155, 0.055);  // empuñadura
    g.add(grip);
    g.add(box(0.050, 0.050, 0.028, D,  0, -0.075, -0.045));// guardamonte
    g.add(box(0.046, 0.045, 0.045, D,  0, 0.055, 0.115));  // martillo
    g.add(box(0.020, 0.026, 0.026, D,  0, 0.093, -0.27));  // mira delantera
    g.add(box(0.062, 0.024, 0.026, D,  0, 0.093, 0.075));  // mira trasera
    g.userData.muzzle = new THREE.Vector3(0, 0.045, -0.37);
  }
  grip.rotation.x = 0.22;
  return g;
}

function buildKnifeModel() {
  const K = CONFIG.KNIFE;
  const g = new THREE.Group();
  g.add(box(0.028, 0.028, 0.30, K.bladeColor, 0, 0.006, -0.16));   // hoja
  g.add(box(0.014, 0.014, 0.30, 0xe8edf1,     0, 0.014, -0.16));   // filo (brillo)
  g.add(box(0.085, 0.022, 0.03, 0x1c1c1e,     0, 0,      0.015));  // guarda
  g.add(box(0.036, 0.045, 0.15, K.handleColor,0, -0.004, 0.11));   // mango
  g.visible = false;
  return g;
}
// F3b: machete = hoja larga y ancha, mango de madera
function buildMacheteModel() {
  const M = CONFIG.MACHETE, g = new THREE.Group();
  g.add(box(0.012, 0.07, 0.48, M.bladeColor, 0, 0.012, -0.26));      // hoja
  g.add(box(0.013, 0.02, 0.48, 0xe8edf1,     0, -0.02, -0.26));      // filo
  g.add(box(0.03, 0.05, 0.05, 0x1c1c1e,      0, 0,      0.0));       // guarda
  g.add(box(0.036, 0.045, 0.16, M.handleColor, 0, -0.004, 0.11));    // mango
  g.visible = false;
  return g;
}
// el arma de cuerpo a cuerpo vigente: cuchillo o, si lo compraste, machete (mismo cooldown, alcance y swing)
let MACHETE_DEF = null;
function meleeDef() {
  if (!state.machete) return CONFIG.KNIFE;
  return MACHETE_DEF || (MACHETE_DEF = Object.assign({}, CONFIG.KNIFE,
    { name: CONFIG.MACHETE.name, damage: CONFIG.MACHETE.damage, headshotMul: CONFIG.MACHETE.headshotMul }));
}
const meleeState = { lastAttack: -9999 };

//--- F2b: Pack-a-Punch. El def mejorado se arma UNA vez por arma y se cachea: todo el daño ×dmgMul,
// cargador y reserva ×ammoMul, nombre papName. CONFIG.WEAPONS no se toca.
const PAP_DEFS = {};
function papDef(id) {
  if (PAP_DEFS[id]) return PAP_DEFS[id];
  const b = CONFIG.WEAPONS[id], P = CONFIG.PAP, d = Object.assign({}, b);
  if (b.damage !== undefined) d.damage = b.damage * P.dmgMul;
  if (b.dps !== undefined) d.dps = b.dps * P.dmgMul;
  d.magSize = Math.ceil(b.magSize * P.ammoMul);
  d.reserveMax = Math.ceil(b.reserveMax * P.ammoMul);
  d.name = b.papName; d.pap = true;
  return (PAP_DEFS[id] = d);
}
// el def que rige un slot del inventario (mejorado o no). Todo lo que lee munición o daño pasa por acá
function slotDef(s) { return s ? (s.pap ? papDef(s.id) : CONFIG.WEAPONS[s.id]) : null; }
let CAMO_MAT = null;
function camoMat() {
  if (CAMO_MAT) return CAMO_MAT;
  const tex = makeTex((c, s) => {                                  // camo violeta/cian con brillo
    c.fillStyle = '#2a1640'; c.fillRect(0, 0, s, s);
    const cols = ['#5a2a8a', '#1fb8c8', '#8a3ac8', '#16707a'];
    for (let i = 0; i < 26; i++) {
      c.fillStyle = cols[i % cols.length];
      const x = Math.random() * s, y = Math.random() * s, r = 4 + Math.random() * 10;
      c.fillRect(x - r, y - r * 0.6, r * 2, r * 1.2);
    }
  }, 1, 64);
  CAMO_MAT = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x3a1a5a, emissiveIntensity: 0.6 });
  return CAMO_MAT;
}
function applyCamo(model) { model.traverse(o => { if (o.isMesh) o.material = camoMat(); }); return model; }

function equipModel(def) {
  if (weaponsState.model) weaponsState.group.remove(weaponsState.model);
  weaponsState.model = null;
  if (!def) return;                                   // manos vacías (el arma está en el Pack-a-Punch)
  weaponsState.model = buildWeaponModel(def);
  if (def.pap) applyCamo(weaponsState.model);
  weaponsState.group.add(weaponsState.model);
  const mz = weaponsState.model.userData.muzzle;
  weaponsState.muzzleSprite.position.copy(mz).add(new THREE.Vector3(0, 0, -0.04));
  weaponsState.muzzleLightView.position.copy(mz).add(new THREE.Vector3(0, 0.05, -0.15));
}

//--- API de inventario ---
function curSlot() { return state.weapons[state.currentWeapon]; }
function curDef()  { return slotDef(curSlot()); }

function giveWeapon(id) {
  const def = CONFIG.WEAPONS[id];
  if (!def) return;
  const existing = state.weapons.find(w => w.id === id);
  if (existing) { existing.reserve = slotDef(existing).reserveMax; return; }
  const slot = { id, mag: def.magSize, reserve: def.reserveMax };
  if (state.weapons.length < maxWeapons()) {                    // F5.11: Mule Kick = 3
    state.weapons.push(slot);
    state.currentWeapon = state.weapons.length - 1;
  } else {
    state.weapons[state.currentWeapon] = slot;   // reemplaza la equipada (regla P5)
  }
  equipModel(def);
  updateAmmoHUD();
}

function switchWeapon(dir) {
  if (state.weapons.length < 2 || DOWN.on) return;
  if (weaponsState.phase === 'switching' || weaponsState.phase === 'grenade') return;
  const n = state.weapons.length;
  weaponsState.pendingSlot = (state.currentWeapon + (dir || 1) + n) % n;
  weaponsState.phase = 'switching';
  weaponsState.phaseT = 0;
}

// F3a: teclas 1 y 2. Con el escudo equipado, guarda el escudo y saca esa arma
function selectWeapon(i) {
  const W = weaponsState;
  if (DOWN.on || i >= state.weapons.length || W.phase === 'switching' || W.phase === 'grenade' || W.phase === 'melee') return;
  if (i === state.currentWeapon && W.phase !== 'shield') return;
  if (W.phase === 'reloading') UI.reload.style.opacity = '0';
  W.pendingSlot = i; W.phase = 'switching'; W.phaseT = 0;
}

// cancela recarga / cambio / cuchillo y muestra el arma actual subiendo (segunda mitad del switch).
// Lo usa la compra en pared: sin esto una recarga en curso se completaba sobre el arma nueva.
function raiseWeapon() {
  const W = weaponsState;
  W.pendingSlot = -1;
  W.phase = 'switching';
  W.phaseT = CONFIG.FX.switchTime / 2;
  UI.reload.style.opacity = '0';
}

function reloadWeapon() {
  const s = curSlot(), def = curDef();
  if (!s || !def) return;
  if (weaponsState.phase !== 'idle') return;
  if (s.mag >= def.magSize || s.reserve <= 0) return;
  weaponsState.phase = 'reloading';
  weaponsState.phaseT = 0;
  weaponsState.reloadStep = 0;
  UI.reload.style.opacity = '1';
}

//--- CUCHILLO: hitscan corto, cooldown propio, ignora munición ---
// Interrumpe una recarga en curso (no se pierde munición: la transferencia
// solo ocurre al completarse). No interrumpe un cambio de arma.
function meleeAttack() {
  if (!state.running || state.gameOver || DOWN.on) return;
  const K = meleeDef(), W = weaponsState;              // F3b: cuchillo o machete
  const now = performance.now();
  if (now - meleeState.lastAttack < K.cooldown) return;
  if (W.phase === 'switching' || W.phase === 'melee' || W.phase === 'grenade' || W.phase === 'shield') return;

  meleeState.lastAttack = now;
  W.phase = 'melee'; W.phaseT = 0;
  STATS.src = state.machete ? 'machete' : 'knife';
  sfxSwing();

  const origin = feel.eye.clone();
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(feel.aimQuat);
  raycaster.set(origin, dir);
  raycaster.far = K.range;

  const targets = WORLD.hitMeshes.slice();
  for (const z of state.zombies) {
    if (!z.alive) continue;
    for (let k = 0; k < z.hitParts.length; k++) targets.push(z.hitParts[k]);
  }
  const hits = raycaster.intersectObjects(targets, false);
  if (!hits.length) return;

  const h = hits[0], t = h.object.userData.type;
  if (t === 'generator') { hitGenerator(h.object.userData.gen); return; }   // F2.5: solo el cuchillo lo prende
  if (hitPalm(h.object)) return;                                            // F5.5: el machete voltea la palmera
  if (t !== 'zombieHead' && t !== 'zombieBody') { addImpactDecal(h); return; }

  const head = t === 'zombieHead';
  const z = h.object.userData.zombie;
  const dmg = K.damage * (head ? K.headshotMul : 1);
  const wasAlive = z.alive;
  damageZombie(z, dmg, head, CONFIG.POINTS.meleeKill, undefined, h.object.userData.part);   // kill siempre da 130, headshot o no
  feelOnZombieHit(z, h, dir, dmg, head);
  onHitConfirm(head, wasAlive && !z.alive);
  // no toca state.shotsFired/shotsHit: munición infinita no debe inflar la precisión
}

//--- DISPARO (hitscan) ---
function fireWeapon() {
  const s = curSlot(), def = curDef();
  if (!s || !def || !state.running) return;
  if (weaponsState.phase !== 'idle') return;

  const now = performance.now();
  const rate = def.fireRate / perkRate();                // F2: Double Tap acorta el intervalo
  if (now - weaponsState.lastShot < rate) return;

  if (s.mag <= 0) {
    if (s.reserve > 0) reloadWeapon(); else sfxDry();
    return;
  }
  STATS.src = def.id;                                    // "arma favorita" de la pantalla final
  const W = weaponsState;
  // F5.11: arco: el clic empieza a cargar; dispara al soltar (updateBow -> releaseBow)
  if (def.charge) { W.charging = true; W.charge = 0; return; }

  // fuego sostenido: el reloj avanza de a fireRate, no salta a "ahora". Si no, la cadencia se redondea
  // al frame siguiente (SMG 90ms -> 100ms a 60fps, -10% dps). Tras una pausa larga, arranca de cero.
  W.lastShot = now - W.lastShot < rate * 2 ? W.lastShot + rate : now;
  s.mag--;

  // F5.11: bazooka: un cohete que vuela y explota (no es hitscan, no cuenta para precisión)
  if (def.rocket) {
    launchRocket(def);
    feelOnFire(def); sfxShot(def);
    updateAmmoHUD();
    if (s.mag === 0 && s.reserve > 0) reloadWeapon();
    return;
  }

  // lanzallamas: tick de cono, no es "disparo" (no cuenta para precisión, igual que el cuchillo)
  if (def.flame) {
    fireFlame(def);
    updateAmmoHUD();
    if (s.mag === 0 && s.reserve > 0) reloadWeapon();
    return;
  }
  // F5.5: Ola Rompiente, cono con empujón (tampoco cuenta para precisión)
  if (def.wave) {
    fireWave(def);
    feelOnFire(def); sfxShot(def);
    updateAmmoHUD();
    if (s.mag === 0 && s.reserve > 0) reloadWeapon();
    return;
  }
  state.shotsFired++;

  // la bala sale del AIM, no de la cámara visual (bob/shake no desvían)
  const origin = feel.eye.clone();
  const baseDir = new THREE.Vector3(0, 0, -1).applyQuaternion(feel.aimQuat);

  let anyHit = false, anyHead = false, anyKill = false;
  const pellets = def.pellets || 1;
  for (let p = 0; p < pellets; p++) {
    const dir = baseDir.clone();
    if (def.spread > 0) {
      const sp = def.spread * adsSpread();               // F3b: apuntando, ×0.4
      dir.x += (Math.random() - 0.5) * sp * 2;
      dir.y += (Math.random() - 0.5) * sp * 2;
      dir.z += (Math.random() - 0.5) * sp * 2;
      dir.normalize();
    }
    const r = traceShot(origin, dir, def);
    if (r) { anyHit = true; if (r.head) anyHead = true; if (r.kill) anyKill = true; }
  }
  if (def.splashRadius) {
    const sp = applySplash(def, baseDir);
    if (sp) { anyHit = true; if (sp.kills) anyKill = true; }
  }
  if (anyHit) { state.shotsHit++; onHitConfirm(anyHead, anyKill); }

  // fx
  feelOnFire(def);
  sfxShot(def);
  const fc = def.flashColor || 0xffc165;
  weaponsState.muzzleLightWorld.color.setHex(fc);        // cambiar color no recompila shaders
  weaponsState.muzzleLightView.color.setHex(fc);
  weaponsState.muzzleSprite.material.color.setHex(def.flashColor || 0xffffff);
  weaponsState.muzzleUntil = now + CONFIG.FX.muzzleMs;
  weaponsState.muzzleSprite.visible = true;
  weaponsState.muzzleSprite.rotation.z = Math.random() * Math.PI;
  weaponsState.muzzleLightView.intensity = 2.6;
  weaponsState.muzzleLightWorld.intensity = 2.2;
  weaponsState.muzzleLightWorld.position.copy(origin)
    .add(baseDir.clone().multiplyScalar(0.7))
    .add(new THREE.Vector3(0, -0.12, 0));

  updateAmmoHUD();
  if (s.mag === 0 && s.reserve > 0) reloadWeapon();
}

//--- F5.11: ARCO (carga) y BAZOOKA (cohete) ---
// arco: mientras se mantiene el clic, carga (la flecha se tensa); al soltar dispara con daño según la carga
function updateBow(dt) {
  const W = weaponsState, def = curDef();
  if (!W.charging) return;
  if (!def || !def.charge || W.phase !== 'idle' || !state.running) { W.charging = false; return; }
  W.charge += dt;
  const k = Math.min(1, W.charge / def.chargeTime), arrow = W.model && W.model.userData.arrow;
  if (arrow) arrow.position.z = -0.25 + 0.14 * k;
  if (!keys['Mouse0']) releaseBow(def);
}
function releaseBow(def) {
  const W = weaponsState, s = curSlot();
  W.charging = false;
  const arrow = W.model && W.model.userData.arrow;
  if (arrow) arrow.position.z = -0.25;
  if (!s || s.mag <= 0) return null;
  s.mag--;
  W.lastShot = performance.now();
  state.shotsFired++;
  const k = Math.min(1, W.charge / def.chargeTime);
  const shot = Object.assign({}, def, { damage: def.damage * (def.chargeMin + (1 - def.chargeMin) * k) });
  const origin = feel.eye.clone(), dir = new THREE.Vector3(0, 0, -1).applyQuaternion(feel.aimQuat);
  const r = traceShot(origin, dir, shot);
  if (r) { state.shotsHit++; onHitConfirm(r.head, r.kill); }
  feelOnFire(def); sfxShot(def);
  updateAmmoHUD();
  if (s.mag === 0 && s.reserve > 0) reloadWeapon();
  return { k, damage: shot.damage, hit: r };
}
// bazooka: pool fijo de cohetes (mesh + estela). Vuelan en línea recta y explotan en lo primero que tocan
// (pared, mueble, piso o zombie), con explodeAt (daño en área, te lastima si estás cerca)
const ROCKETS = { pool: [], ray: new THREE.Raycaster() };
function buildRockets() {
  const geo = new THREE.BoxGeometry(0.12, 0.12, 0.45), mat = new THREE.MeshBasicMaterial({ color: 0x8a3a1a });
  const fire = new THREE.MeshBasicMaterial({ color: 0xffa040 });
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(geo, mat), f = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.2), fire);
    f.position.z = 0.3; m.add(f);
    m.visible = false; scene.add(m);
    ROCKETS.pool.push({ m, active: false, p: new THREE.Vector3(), d: new THREE.Vector3(), life: 0, def: null });
  }
}
function launchRocket(def) {
  const R = ROCKETS.pool.find(r => !r.active);
  if (!R) return false;
  R.p.copy(feel.eye); R.d.set(0, 0, -1).applyQuaternion(feel.aimQuat);
  R.p.addScaledVector(R.d, 0.3);
  R.life = def.range / def.rocketSpeed; R.def = def; R.active = true;
  R.m.position.copy(R.p); R.m.lookAt(R.p.clone().sub(R.d)); R.m.visible = true;
  return true;
}
function updateRockets(dt) {
  for (const R of ROCKETS.pool) {
    if (!R.active) continue;
    const step = R.def.rocketSpeed * dt;
    R.life -= dt;
    const targets = WORLD.hitMeshes.slice();
    for (const z of state.zombies) if (z.alive) for (const h of z.hitParts) targets.push(h);
    ROCKETS.ray.set(R.p, R.d); ROCKETS.ray.far = step;
    const hit = ROCKETS.ray.intersectObjects(targets, false)[0];
    if (hit || R.life <= 0) {
      const at = hit ? hit.point.clone().addScaledVector(R.d, -0.2) : R.p;
      R.active = false; R.m.visible = false;
      explodeAt(at.x, at.y, at.z, { damage: R.def.damage * perkDmg(), radius: R.def.radius, self: R.def.selfDamage, src: R.def.id });
      continue;
    }
    R.p.addScaledVector(R.d, step);
    R.m.position.copy(R.p);
  }
}
function resetRockets() { for (const R of ROCKETS.pool) { R.active = false; R.m.visible = false; } weaponsState.charging = false; }

// un rayo: la bala se detiene en lo PRIMERO que toca. Paredes incluidas.
// devuelve { head, kill } si pegó a un zombie, null si no
// shotImpact: dónde terminó el último rayo (lo usa el área de la Ray Gun)
const shotImpact = { valid: false, point: new THREE.Vector3(), zombie: null };
function traceShot(origin, dir, def) {
  raycaster.set(origin, dir);
  raycaster.far = def.range;
  shotImpact.valid = false;

  const targets = WORLD.hitMeshes.slice();
  for (const z of state.zombies) {
    if (!z.alive) continue;
    for (let k = 0; k < z.hitParts.length; k++) targets.push(z.hitParts[k]);
  }

  const hits = raycaster.intersectObjects(targets, false);
  if (!hits.length) return null;
  if (def.pierce) return tracePierce(hits, dir, def);  // F3b: ballesta

  const h = hits[0];                     // <- el más cercano: nada atraviesa paredes
  const t = h.object.userData.type;
  shotImpact.valid = true; shotImpact.point.copy(h.point); shotImpact.zombie = null;

  if (t === 'zombieHead' || t === 'zombieBody') {
    const head = t === 'zombieHead';
    const z = h.object.userData.zombie;
    shotImpact.zombie = z;
    const dmg = def.damage * (head ? def.headshotMul : 1) * perkDmg();   // F2: Double Tap
    damageZombie(z, dmg, head, undefined, undefined, h.object.userData.part);   // F4/F5: piernas, sombrero
    feelOnZombieHit(z, h, dir, dmg, head);
    return { head, kill: !z.alive };
  }

  if (t === 'questShell' && shootShell()) return null;   // F5.9: la caracola brillante se cae de la tortuga
  if (t === 'tomb') shootTomb();                          // F5.16: la tumba del templo sangra y se abre el portal
  addImpactDecal(h);
  return null;                           // impacto en mundo no cuenta como "hit" de precisión
}

// F3b: atraviesa hasta def.pierce zombies (cada uno una vez, aunque el rayo toque varias partes) y frena en
// la primera pared. Devuelve { head, kill } si pegó a alguno
function tracePierce(hits, dir, def) {
  const seen = new Set();
  let head = false, kill = false, n = 0;
  for (const h of hits) {
    const t = h.object.userData.type;
    if (t !== 'zombieHead' && t !== 'zombieBody') {
      if (t === 'tomb') shootTomb();                    // F5.16
      if (!(t === 'questShell' && shootShell())) addImpactDecal(h);
      shotImpact.point.copy(h.point); break;
    }
    const z = h.object.userData.zombie;
    if (seen.has(z) || !z.alive) continue;
    seen.add(z);
    const hd = t === 'zombieHead', dmg = def.damage * (hd ? def.headshotMul : 1) * perkDmg();
    damageZombie(z, dmg, hd, undefined, undefined, h.object.userData.part);
    feelOnZombieHit(z, h, dir, dmg, hd);
    if (hd) head = true;
    if (!z.alive) kill = true;
    if (++n >= def.pierce) break;
  }
  return n ? { head, kill } : null;
}

//--- RAY GUN: área alrededor del impacto (el impactado directo ya recibió daño completo en traceShot) ---
// Sin línea libre (segmentClear) no hay daño: el área no atraviesa paredes. No daña al jugador.
const _sp = new THREE.Vector3();
function applySplash(def, dir) {
  const I = shotImpact;
  if (!I.valid) return null;
  const cx = I.point.x - dir.x * 0.15, cy = I.point.y - dir.y * 0.15, cz = I.point.z - dir.z * 0.15;
  spawnSplashFx(cx, cy, cz, def.flashColor, def.splashRadius);
  const R = def.splashRadius;
  let hits = 0, kills = 0;
  for (const z of state.zombies) {
    if (!z.alive || z === I.zombie) continue;
    const g = groundY(z.px, z.pz);                       // torso relativo al piso (piscina)
    const d = Math.hypot(z.px - cx, g + 1.1 - cy, z.pz - cz);
    if (d > R || !segmentClear(cx, cz, z.px, z.pz, 0, true)) continue;
    const dmg = def.damage * (1 - (1 - def.splashMin) * d / R) * perkDmg();
    damageZombie(z, dmg, false);
    spawnDamageNumber(z, _sp.set(z.px, g + 1.3, z.pz), dmg, false);
    hits++; if (!z.alive) kills++;
  }
  return hits ? { hits, kills } : null;
}

//--- LANZALLAMAS: un tick = daño a todos los zombies dentro del cono con línea libre ---
const _fdir = new THREE.Vector3(), _fto = new THREE.Vector3();
function fireFlame(def) {
  const W = weaponsState, eye = feel.eye;
  const dir = _fdir.set(0, 0, -1).applyQuaternion(feel.aimQuat);
  // largo visual del chorro: hasta la primera pared
  raycaster.set(eye, dir); raycaster.far = def.range;
  const wh = raycaster.intersectObjects(WORLD.hitMeshes, false);
  W.flameLen = wh.length ? wh[0].distance : def.range;
  const rate = def.fireRate / perkRate();
  W.flameUntil = performance.now() + rate + 40;
  feelOnFire(def);

  // F2: con Double Tap tickea más seguido (rate) y cada tick pega más: dps × 1.33 × 1.33
  const dmg = def.dps * perkRate() * perkDmg() * rate / 1000, tanC = Math.tan(def.coneDeg * Math.PI / 180);
  let kill = false;
  for (const z of state.zombies) {
    if (!z.alive) continue;
    // punto del zombie más cercano al eje (cuerpo = segmento vertical 0.2..1.8): así pega a los de cerca
    const g = groundY(z.px, z.pz);                       // el cuerpo va de g+0.2 a g+1.8 (piscina)
    _fto.set(z.px - eye.x, g + 1.1 - eye.y, z.pz - eye.z);
    const yc = Math.max(g + 0.2, Math.min(g + 1.8, eye.y + dir.y * _fto.dot(dir)));
    _fto.y = yc - eye.y;
    const t = _fto.dot(dir);
    if (t <= 0 || t > def.range) continue;
    const perp = Math.sqrt(Math.max(0, _fto.lengthSq() - t * t));
    if (perp > t * tanC + 0.35) continue;
    if (!segmentClear(eye.x, eye.z, z.px, z.pz, 0, true)) continue;
    damageZombie(z, dmg, false, undefined, def.hitPoints);
    spawnDamageNumber(z, _sp.set(z.px, g + 1.5, z.pz), dmg, false);
    if (!z.alive) kill = true;
  }
  if (kill) onHitConfirm(false, true);    // hitmarker/sonido solo en kill: 4 ticks/s serían ruido
}

//--- fx de Ray Gun y lanzallamas: pools fijos, billboards aditivos ---
const splashFx = { pool: [], i: 0 };
const flameFx = { pool: [], i: 0, acc: 0 };
function radialTex(inner, mid) {
  return makeTex((c, s) => {
    c.clearRect(0, 0, s, s);
    const g = c.createRadialGradient(s/2, s/2, 1, s/2, s/2, s/2);
    g.addColorStop(0, inner); g.addColorStop(.4, mid); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
  }, 1, 64);
}
function buildFxPools() {
  const geo = new THREE.PlaneGeometry(1, 1);
  const sTex = radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,.55)');
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: sTex, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false; m.userData = { life: 0, size: 1 };
    scene.add(m); splashFx.pool.push(m);
  }
  const fMat = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,240,180,1)', 'rgba(255,120,30,.6)'),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(geo, fMat);
    m.visible = false; m.userData = { life: 0, v: new THREE.Vector3(), dist: 0, max: 0 };
    scene.add(m); flameFx.pool.push(m);
  }
}
function spawnSplashFx(x, y, z, color, radius) {
  const m = splashFx.pool[splashFx.i];
  splashFx.i = (splashFx.i + 1) % splashFx.pool.length;
  m.position.set(x, y, z);
  m.material.color.setHex(color || 0xffffff);
  m.userData.life = 0.28; m.userData.size = radius * 1.6;
  m.visible = true;
}
const _fr = new THREE.Vector3();
function updateWeaponFx(dt) {
  for (const m of splashFx.pool) {
    if (!m.visible) continue;
    const u = m.userData;
    u.life -= dt;
    if (u.life <= 0) { m.visible = false; continue; }
    const k = 1 - u.life / 0.28;
    m.scale.setScalar(u.size * (0.3 + 0.7 * easeOut(k)));
    m.material.opacity = 1 - k;
    m.quaternion.copy(camera.quaternion);
  }
  // chorro: emite mientras dure el último tick
  const W = weaponsState, def = curDef();
  if (def && def.flame && performance.now() < (W.flameUntil || 0)) {
    flameFx.acc += dt * 90;                               // partículas por segundo
    const dir = _fdir.set(0, 0, -1).applyQuaternion(feel.aimQuat);
    _fr.set(1, 0, 0).applyQuaternion(feel.aimQuat);
    while (flameFx.acc >= 1) {
      flameFx.acc -= 1;
      const m = flameFx.pool[flameFx.i];
      flameFx.i = (flameFx.i + 1) % flameFx.pool.length;
      const u = m.userData;
      m.position.copy(feel.eye).addScaledVector(dir, 0.6).addScaledVector(_fr, 0.12);
      m.position.y -= 0.16;
      u.v.copy(dir).multiplyScalar(9).add(_sp.set(Math.random() - .5, Math.random() - .3, Math.random() - .5).multiplyScalar(1.4));
      u.life = 0.5; u.dist = 0; u.max = Math.max(0.3, (W.flameLen || 0) - 0.5);
      m.visible = true;
    }
  } else flameFx.acc = 0;
  for (const m of flameFx.pool) {
    if (!m.visible) continue;
    const u = m.userData;
    u.life -= dt; u.dist += u.v.length() * dt;
    if (u.life <= 0 || u.dist > u.max) { m.visible = false; continue; }
    m.position.addScaledVector(u.v, dt);
    m.scale.setScalar(0.15 + (1 - u.life / 0.5) * 0.9);
    m.quaternion.copy(camera.quaternion);
  }
}
function resetWeaponFx() {
  splashFx.pool.forEach(m => { m.visible = false; });
  flameFx.pool.forEach(m => { m.visible = false; });
  weaponsState.flameUntil = 0;
}

//--- GAME FEEL de disparo e impacto ---
// mismo ω en el kick y en updateCameraFeel, si no el pico deja de ser exacto
function recoilReturnOf(def) { return (def && def.recoilReturn) || CONFIG.FEEL.recoilReturn; }
function feelOnFire(def) {
  const F = CONFIG.FEEL, w = springW(recoilReturnOf(def)), W = weaponsState;
  springKick(feel.recoilP, F.recoilPitch * def.recoil, w);                            // patada arriba
  springKick(feel.recoilY, (Math.random() - 0.5) * 2 * F.recoilYaw * def.recoil, w);
  springKick(W.kick, def.recoil, springW(F.weaponReturn));
  W.kickRoll = (Math.random() - 0.5) * 2;
  addTrauma(def.fireShake !== undefined ? def.fireShake
    : Math.min(F.fireShakeMax, F.fireShakePerDamage * def.damage * (def.pellets || 1)));
  crossPunch(F.crossFireSpread * Math.min(2, def.recoil));
}
// por bala que pega
function feelOnZombieHit(z, hit, dir, dmg, head) {
  const F = CONFIG.FEEL;
  spawnBloodDecalAt(hit, head, dir);
  spawnDamageNumber(z, hit.point, dmg, head);
  const hl = Math.hypot(dir.x, dir.z) || 1;              // empujón visual en XZ
  z.kbX = dir.x / hl * F.knockback;
  z.kbZ = dir.z / hl * F.knockback;
  z.kbT = F.knockbackTime;
}
// una vez por disparo (la escopeta no suena 8 veces)
function onHitConfirm(head, kill) {
  const F = CONFIG.FEEL;
  showHitmarker(kill ? '#ff4a3d' : head ? '#ffd23a' : '#ffffff');
  crossPunch(F.crossHitSpread);
  sfxHit(head);
}

//--- marcas de impacto (pool fijo, se reciclan) ---
function buildDecalPool() {
  const tex = makeTex((c, s) => {
    c.clearRect(0, 0, s, s);
    const g = c.createRadialGradient(s/2, s/2, 1, s/2, s/2, s/2);
    g.addColorStop(0, 'rgba(10,8,6,.95)');
    g.addColorStop(.45, 'rgba(30,24,18,.75)');
    g.addColorStop(.75, 'rgba(60,50,40,.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(s/2, s/2, s/2, 0, 7); c.fill();
    c.strokeStyle = 'rgba(20,16,12,.55)'; c.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * 7, r0 = s * 0.14, r1 = s * (0.22 + Math.random() * 0.22);
      c.beginPath();
      c.moveTo(s/2 + Math.cos(a)*r0, s/2 + Math.sin(a)*r0);
      c.lineTo(s/2 + Math.cos(a)*r1, s/2 + Math.sin(a)*r1);
      c.stroke();
    }
  }, 1, 64);

  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
  });
  const geo = new THREE.PlaneGeometry(0.22, 0.22);
  for (let i = 0; i < CONFIG.FX.decalPool; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    scene.add(m);
    decals.pool.push(m);
  }
}
const _n = new THREE.Vector3(), _p = new THREE.Vector3();
function addImpactDecal(hit) {
  if (!hit.face) return;
  const d = decals.pool[decals.i];
  decals.i = (decals.i + 1) % decals.pool.length;
  _n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
  _p.copy(hit.point).add(_n.clone().multiplyScalar(0.015));
  d.position.copy(_p);
  d.lookAt(_p.clone().add(_n));
  d.rotation.z = Math.random() * Math.PI * 2;
  d.scale.setScalar(0.8 + Math.random() * 0.5);
  d.visible = true;
}
//--- sangre: pool de cubitos con gravedad ---
const blood = { pool: [], i: 0 };
function buildBloodPool() {
  const geo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  const mat = new THREE.MeshBasicMaterial({ color: 0x5a0d0a });
  for (let i = 0; i < 64; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    m.userData.v = new THREE.Vector3();
    m.userData.life = 0;
    scene.add(m);
    blood.pool.push(m);
  }
}
// chorro en la dirección de la bala + dispersión, gravedad y rebote en el piso
function spawnBloodDecalAt(hit, head, dir) {
  const F = CONFIG.FEEL, n = head ? F.bloodHead : F.bloodBody;
  const dx = dir ? dir.x : 0, dz = dir ? dir.z : 0;
  for (let k = 0; k < n; k++) {
    const m = blood.pool[blood.i];
    blood.i = (blood.i + 1) % blood.pool.length;
    const sp = F.bloodSpeed * (0.5 + Math.random() * 0.7);
    m.position.copy(hit.point);
    m.userData.v.set(dx * sp * 0.7 + (Math.random() - .5) * sp, Math.random() * sp * 0.8 + 0.6,
                     dz * sp * 0.7 + (Math.random() - .5) * sp);
    m.userData.life = F.bloodLife;
    m.userData.size = 0.7 + Math.random() * 0.7;
    m.scale.setScalar(m.userData.size);
    m.visible = true;
  }
}
function updateBlood(dt) {
  const L = CONFIG.FEEL.bloodLife;
  for (const m of blood.pool) {
    if (!m.visible) continue;
    const u = m.userData;
    u.life -= dt; u.v.y -= 12 * dt;
    m.position.addScaledVector(u.v, dt);
    const fy = groundY(m.position.x, m.position.z) + 0.035;   // rebota en el fondo de la piscina también
    if (m.position.y < fy) {
      m.position.y = fy;
      if (u.v.y < 0) { u.v.y *= -0.25; u.v.x *= 0.5; u.v.z *= 0.5; }
    }
    const k = u.life / L;
    if (k < 0.3) m.scale.setScalar(u.size * Math.max(0.01, k / 0.3));
    if (u.life <= 0) m.visible = false;
  }
}

//--- actualización por frame del arma ---
function updateWeapon(dt) {
  // F2b: sin arma (está en el Pack-a-Punch) igual corre: el cuchillo y las granadas necesitan las fases
  const def = curDef();
  const W = weaponsState;
  if (!def && W.phase === 'reloading') { W.phase = 'idle'; W.phaseT = 0; }
  updateAds(dt);                                       // F3b
  const now = performance.now();

  // apagar fogonazo
  if (W.muzzleSprite.visible && now > W.muzzleUntil) {
    W.muzzleSprite.visible = false;
    W.muzzleLightView.intensity = 0;
    W.muzzleLightWorld.intensity = 0;
  }

  const F = CONFIG.FEEL;
  // retroceso del modelo (resorte)
  springStep(W.kick, springW(F.weaponReturn), 1, dt);
  const kick = Math.max(-0.3, Math.min(F.weaponKickMax, W.kick.x));

  // sway: el arma se queda atrás al girar y vuelve
  feel.swayX += (feel.swayTX - feel.swayX) * Math.min(1, dt * F.swayReturn * 1.6);
  feel.swayY += (feel.swayTY - feel.swayY) * Math.min(1, dt * F.swayReturn * 1.6);
  const sd = Math.exp(-dt * F.swayReturn);
  feel.swayTX *= sd; feel.swayTY *= sd;

  // bob al caminar: misma fase que la cámara
  const moving = player.speedNow > 0.3 && player.grounded;
  const amp = (F.gunBobWalk + (F.gunBobRun - F.gunBobWalk) * feel.run) * feel.bobAmt;
  const bobX = Math.sin(feel.bobT) * amp;
  const bobY = -Math.abs(Math.cos(feel.bobT)) * amp * 0.9 + feel.land.x * 0.35;

  // fases
  let phX = 0, phY = 0, phZ = 0, phRotX = 0, phRotZ = 0;

  // fuera de 'melee' el modelo del arma y el cuchillo vuelven a su pose neutra
  if (W.phase !== 'melee') {
    if (W.model) { W.model.position.set(0, 0, 0); W.model.rotation.set(0, 0, 0); }
    if (W.knifeModel) W.knifeModel.visible = false;
    if (W.macheteModel) W.macheteModel.visible = false;
  }

  if (W.phase === 'melee') {
    W.phaseT += dt * 1000;
    const K = CONFIG.KNIFE, p = Math.min(1, W.phaseT / K.swingTime);
    // el arma se va a la izquierda y abajo, fuera de vista
    const goP = p < 0.55 ? easeOut(p / 0.55) : 1 - easeOut((p - 0.55) / 0.45);
    if (W.model) {
      W.model.position.set(-0.46 * goP, -0.14 * goP, 0.06 * goP);
      W.model.rotation.set(0.18 * goP, -0.55 * goP, 0.32 * goP);
    }
    // el cuchillo (o el machete, F3b) entra y barre de abajo-derecha a arriba-izquierda
    const km = state.machete ? W.macheteModel : W.knifeModel;
    if (km) {
      km.visible = true;
      const sw = easeOut(p);
      km.position.set(0.18 - 0.34 * sw, -0.16 + 0.09 * Math.sin(Math.PI * sw), -0.26 - 0.06 * Math.sin(Math.PI * sw));
      km.rotation.set(0.15, 0.35 - 0.95 * sw, -0.55 + 1.05 * sw);
    }
    if (p >= 1) { W.phase = 'idle'; W.phaseT = 0; }
  } else if (W.phase === 'reloading') {
    W.phaseT += dt * 1000;
    const p = Math.min(1, W.phaseT / (def.reloadTime * perkReload()));   // F2: Speed Cola
    while (W.reloadStep < RELOAD_STEPS.length && p >= RELOAD_STEPS[W.reloadStep]) sfxReload(W.reloadStep++);
    const dip = Math.sin(Math.PI * p);           // baja y sube
    // F3b: cada arma recarga distinto (solo visual; los tiempos y la munición son los mismos)
    const anim = def.reloadAnim || 'mag';
    if (anim === 'pistol') {                     // cargador por abajo, rápido y ladeada
      phY = -0.15 * dip; phRotX = -0.6 * dip; phRotZ = 0.5 * dip;
    } else if (anim === 'revolver') {            // de costado: se abre el tambor
      phX = -0.05 * dip; phY = -0.12 * dip; phRotZ = 0.95 * dip;
    } else if (anim === 'break') {               // doble cañón: se quiebra hacia abajo
      phY = -0.18 * dip; phZ = 0.08 * dip; phRotX = -0.9 * dip;
    } else if (anim === 'bolt') {                // ballesta: arriba y de costado, tensa la cuerda
      phY = -0.1 * dip; phRotX = 0.35 * dip; phRotZ = -0.3 * dip;
    } else if (anim === 'shells') {              // escopeta: un empujón por cartucho
      const n = Math.max(1, def.magSize - curSlot().mag);
      phY = -0.14 * dip - 0.05 * Math.abs(Math.sin(Math.PI * p * n)); phRotZ = 0.45 * dip; phRotX = -0.35 * dip;
    } else if (anim === 'belt') {                // LMG: la tapa arriba, más larga y pesada
      phY = -0.08 * dip; phRotX = 0.3 * dip; phRotZ = -0.55 * dip;
    } else {                                     // cargador: baja y gira (V1)
      phY = -0.26 * dip; phZ = 0.10 * dip; phRotX = -1.15 * dip; phRotZ = 0.35 * dip;
    }
    if (p >= 1) {
      const s = curSlot();
      const need = def.magSize - s.mag;
      const take = Math.min(need, s.reserve);
      s.mag += take; s.reserve -= take;
      W.phase = 'idle'; W.phaseT = 0;
      UI.reload.style.opacity = '0';
      updateAmmoHUD();
    }
  } else if (W.phase === 'switching') {
    W.phaseT += dt * 1000;
    const T = CONFIG.FX.switchTime;
    const p = Math.min(1, W.phaseT / T);
    const dip = Math.sin(Math.PI * p);
    phY = -0.40 * dip;
    phRotX = -1.4 * dip;
    if (p >= 0.5 && W.pendingSlot >= 0) {
      state.currentWeapon = W.pendingSlot;
      W.pendingSlot = -1;
      equipModel(curDef());
      updateAmmoHUD();
    }
    if (p >= 1) { W.phase = 'idle'; W.phaseT = 0; }
  } else if (W.phase === 'shield') {
    phY = -0.7; phRotX = -1.0;                         // F3a: con el escudo el arma queda fuera de vista
  } else if (W.phase === 'grenade') {
    // F2.7: el arma baja mientras cocinás y vuelve después del tiro
    const l = GREN.cooking ? 1 : Math.max(0, GREN.throwT / CONFIG.GRENADE.throwTime);
    phY = -0.32 * l;
    phRotX = -0.7 * l;
  }

  // sprint: arma ladeada
  const sprintT = (keys['ShiftLeft'] && moving && player.speedNow > 5 && W.phase === 'idle') ? 1 : 0;
  W.sprintLerp = (W.sprintLerp || 0) + (sprintT - (W.sprintLerp || 0)) * Math.min(1, dt * 9);

  const g = weaponsState.group;
  g.position.set(
    W.basePos.x * (1 - ADS.k) + bobX * (1 - 0.7 * ADS.k) + phX + W.sprintLerp * 0.06 + feel.swayX * 0.15,   // F3b: apuntando, al centro
    W.basePos.y + 0.07 * ADS.k + bobY * (1 - 0.7 * ADS.k) + phY - W.sprintLerp * 0.05 - feel.swayY * 0.10,
    W.basePos.z + phZ + kick * F.weaponKickBack
  );
  g.rotation.set(
    W.baseRot.x + phRotX + kick * F.weaponKickRot + feel.swayY,
    W.baseRot.y + W.sprintLerp * 0.45 + feel.swayX,
    W.baseRot.z + phRotZ + W.sprintLerp * 0.35 + feel.swayX * F.swayTilt + kick * F.weaponKickRoll * W.kickRoll
  );
}

