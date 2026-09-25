//=== 9. LOOP =============================================================
function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(CONFIG.ADS.baseFov, window.innerWidth / window.innerHeight, 0.1, CONFIG.FOG.clip);   // F5.16: la niebla tapa el resto
  camera.rotation.order = 'YXZ';

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.autoClear = false;             // renderizamos 2 pasadas
  if (renderer.info) renderer.info.autoReset = false;   // draw calls de las 2 pasadas juntas (overlay DRAW)
  // F7a (bug del playtest): el canvas va PRIMERO en el body. Con un filtro CSS (post-proceso, blur del silbido) el
  // canvas se pinta en la capa de los elementos posicionados, en orden del documento: agregado al final tapaba el
  // HUD (munición, granadas, puntos) y el menú de pausa
  document.body.insertBefore(renderer.domElement, document.body.firstChild);

  clock = new THREE.Clock();

  buildTextures();
  buildMaterials();
  buildSky();
  buildLights();
  buildMap();
  buildTheme();

  initUI();
  initPlayer();
  initWeaponLayer();
  buildGrenades();
  buildZombiePool();
  buildDogPool();                       // F4
  buildSquidPool();                     // F5.9: calamares y su tinta
  buildGiantSquid();                    // F5.11: el calamar gigante de las rondas de calamares
  buildDrips();
  buildRain();                          // F5.9: lluvia (tormenta y rondas de mobs)
  buildStars();                         // F5.10: estrellas (con la oscuridad)
  buildBoss();                          // F5
  buildPickupPool();
  buildKaboom();                        // F5.10: llamas del Kaboom
  buildRockets();                       // F5.11: cohetes de la bazooka
  buildMonkeys();                       // F5.11: langostinos bailarines
  buildWallBuys();
  buildBox();
  buildRelics();
  buildPerks();
  buildShield();
  buildQuest();                         // F5.5
  buildGarden();                        // F5.6: plantas carnívoras del techo
  buildTraps();                         // F5.9: tiburón y cortadora
  buildBunker();                        // F5.11: búnker, escotilla, estatuas y caballito de mar
  setSquidHead(1, true);                // F5.13: la cabeza del calamar, enterrada
  buildClams();                         // F5.14: almejas y fumigador
  resetClams();
  buildNavDebug();
  buildGfx();                           // F7a: sol, luna, grano
  applyQuality(CONFIG.GFX.quality);     // F7a: Medio de entrada (sombras solo en Alto)

  resetGame();

  bindInput();
  window.addEventListener('resize', onResize);
  animate();
}

//--- gobernador de calidad: si el promedio de fps cae bajo THEME.fpsFloor, apaga un nivel y avisa ---
// nivel 1: polvo · nivel 2: cortinas y haces de luz · nivel 3: pixel ratio 1
const QUALITY = { acc: 0, frames: 0, grace: 0, fps: 0, msg: '' };
function updateQuality(dt) {
  const T = CONFIG.THEME;
  if (!state.running || !THEMEFX.built) { QUALITY.acc = QUALITY.frames = QUALITY.grace = 0; return; }
  QUALITY.grace += dt;
  if (QUALITY.grace < T.fpsGrace) return;               // deja pasar la carga inicial y el re-lock
  QUALITY.acc += dt; QUALITY.frames++;
  if (QUALITY.acc < T.fpsWindow) return;
  QUALITY.fps = QUALITY.frames / QUALITY.acc;
  QUALITY.acc = QUALITY.frames = 0;
  if (QUALITY.fps >= T.fpsFloor || THEMEFX.quality >= 3) return;
  const lvl = ++THEMEFX.quality;
  if (lvl === 1) { THEMEFX.dust.visible = false; QUALITY.msg = 'polvo off'; }
  if (lvl === 2) { THEMEFX.shafts.visible = false; QUALITY.msg = 'polvo, haces off'; }
  if (lvl === 3) { renderer.setPixelRatio(1); renderer.setSize(window.innerWidth, window.innerHeight); QUALITY.msg = 'polvo, haces off, pixel ratio 1'; }
  console.warn('[calidad] ' + QUALITY.fps.toFixed(0) + ' fps < ' + T.fpsFloor + ' -> ' + QUALITY.msg);
  QUALITY.grace = 0;                                     // mide de nuevo desde cero
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  weaponCamera.aspect = camera.aspect;
  weaponCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function bindInput() {
  const el = renderer.domElement;
  const lock = () => { initAudio(); UI.menuMsg.textContent = ''; el.requestPointerLock(); };
  UI.btnPlay.addEventListener('click', lock);                      // JUGAR / CONTINUAR
  UI.btnControls.addEventListener('click', () => menuPanel('controls'));
  UI.btnSettings.addEventListener('click', () => menuPanel('settings'));
  UI.btnQuit.addEventListener('click', () => { resetGame(); MENU.started = false; showMenu('main'); });
  UI.btnGoMenu.addEventListener('click', () => { resetGame(); MENU.started = false; showMenu('main'); });
  UI.sens.addEventListener('input', () => setSensitivity(UI.sens.value / 100));
  UI.vol.addEventListener('input', () => { initAudio(); setVolume(UI.vol.value / 100); UI.volVal.textContent = UI.vol.value + '%'; });
  if (UI.dmgNums) UI.dmgNums.addEventListener('change', () => { SETTINGS.dmgNumbers = UI.dmgNums.checked; });   // F5.11
  // F7a: calidad y post-proceso
  const qs = document.getElementById('quality'), pp = document.getElementById('postFx');
  if (qs) qs.addEventListener('change', () => { applyQuality(qs.value); if (pp) pp.checked = GFX.post; });
  if (pp) pp.addEventListener('change', () => setPost(pp.checked));
  const fs = document.getElementById('fogSel');                 // F5.16: niebla configurable (menos niebla, menos FPS)
  if (fs) fs.addEventListener('change', () => setFog(+fs.value));
  // F6: volúmenes separados
  const mv = document.getElementById('musicVol'), sv = document.getElementById('sfxVol');
  if (mv) mv.addEventListener('input', () => { initAudio(); setMusicVolume(mv.value / 100); document.getElementById('musicVal').textContent = mv.value + '%'; });
  if (sv) sv.addEventListener('input', () => { initAudio(); setSfxVolume(sv.value / 100); document.getElementById('sfxVal').textContent = sv.value + '%'; });
  el.addEventListener('mousedown', e => {
    if (document.pointerLockElement !== el) { initAudio(); el.requestPointerLock(); return; }
    if (e.button === 0) { if (weaponsState.phase === 'shield') shieldBash(); else fireWeapon(); }   // F3a: escudo = empujón
    if (e.button === 2) ADS.on = true;                 // F3b: clic derecho = apuntar (el cuchillo queda en V)
    if (e.button === 1) { e.preventDefault(); meleeAttack(); }   // clic de la ruedita = cuchillo
  });
  // girar la ruedita también acuchilla (el cooldown del cuchillo evita que una vuelta larga pegue de más).
  // Se acumula el giro y recién pega con un "clic" entero de ruedita (100): un touchpad manda decenas de
  // micro-giros y cualquier roce acuchillaba. El acumulado se olvida a los 0.3 s
  let wheelAcc = 0, wheelT = 0;
  el.addEventListener('wheel', e => {
    e.preventDefault();
    if (document.pointerLockElement !== el || !state.running) return;
    const now = performance.now();
    if (now - wheelT > 300) wheelAcc = 0;
    wheelT = now;
    wheelAcc += Math.abs(e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY);   // deltaMode 1 = líneas (Firefox)
    if (wheelAcc >= 100) { wheelAcc = 0; meleeAttack(); }
  }, { passive: false });
  el.addEventListener('contextmenu', e => e.preventDefault());   // clic derecho = cuchillo, no menú
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === el;
    state.running = locked && !state.gameOver;
    if (locked) { MENU.started = true; showMenu(null); }
    else {
      for (const k in keys) keys[k] = false;
      ADS.on = false;
      if (!state.gameOver) showMenu(MENU.started ? 'pause' : 'main');   // Esc = pausa real (nada se actualiza)
    }
  });
  // Chrome rechaza el re-lock ~1 s después de soltarlo: se avisa en vez de quedar colgado
  document.addEventListener('pointerlockerror', () => {
    if (state.gameOver) return;
    showMenu(MENU.started ? 'pause' : 'main');
    UI.menuMsg.textContent = 'The browser blocked the mouse for a moment. Try again.';
  });
  UI.restart.addEventListener('click', () => {
    initAudio();
    resetGame();
    MENU.started = false;
    el.requestPointerLock();                       // si lo rechaza, pointerlockerror muestra el menú
  });
  document.addEventListener('mousemove', e => {
    if (state.running) lookInput(e.movementX, e.movementY);
  });
  document.addEventListener('mousedown', e => {
    if (e.button === 0) keys['Mouse0'] = true;
  });
  document.addEventListener('mouseup', e => {
    if (e.button === 0) keys['Mouse0'] = false;
    if (e.button === 2) ADS.on = false;
  });
  document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (!state.running) return;
    if (e.code === 'KeyR') reloadWeapon();
    if (e.code === 'KeyQ') switchWeapon(1);
    if (e.code === 'Digit1') selectWeapon(0);          // F3a: 1 y 2 = armas, 3 = escudo
    if (e.code === 'Digit2') selectWeapon(1);
    if (e.code === 'Digit3' && !e.repeat) toggleShield();
    if (e.code === 'KeyV') meleeAttack();
    if (e.code === 'KeyG' && !e.repeat) startCook();   // soltar G la tira (updateGrenades mira keys.KeyG)
    if (e.code === 'Digit4' && !e.repeat) throwMonkey();   // F5.11: langostino bailarín
    if (e.code === 'KeyF' && !e.repeat) interact();   // sin repeat: mantener F no compra dos veces
    debugKey(e.code, e.repeat);                        // P, N, [, ], O, B, H: solo con CONFIG.DEBUG_MODE (debug.js)
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; });
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state.running) {
    updatePlayer(dt);
    updateFootsteps(dt);                // F6: pasos por superficie
    updateRounds(dt);
    updateFlowField(false);
    updateZombies(dt);
    updateGibs(dt);                     // F7b: pedazos volando
    updateDrips(dt);                    // F4: ahogados
    updateNight(dt);                    // F4: noche de la ronda de perros + relámpagos
    updateSquids(dt);                   // F5.9: tinta en vuelo y la mancha de la pantalla
    updateGiant(dt);                    // F5.11: calamar gigante y los calamares que escupe
    updateBoss(dt);                     // F5: niebla, sombrero volando, barra, visión borrosa
    updateWeapon(dt);
    updateGrenades(dt);
    updateMonkeys(dt);                  // F5.11: langostino bailarín
    updateBlood(dt);
    updatePickups(dt);
    updateEffects(dt);
    updateBox(dt);
    updateRelics(dt);
    updatePerks(dt);
    updateShield(dt);
    updateQuest(dt);                    // F5.5: después de updateShield (comparten la barra de armado)
    updateClams(dt);                    // F5.14: almejas (también usa la barra)
    updateGarden(dt);                   // F5.6: plantas carnívoras
    updateTraps(dt);                    // F5.9
    updateBunker(dt);                   // F5.11: estatuas, escotilla y fundido
    updateWeaponFx(dt);
    updateInteract();
    // fuego automático sostenido
    const def = curDef();
    if (def && def.auto && keys['Mouse0']) fireWeapon();
    updateBow(dt);                      // F5.11: el arco carga mientras mantenés el clic
    updateRockets(dt);                  // F5.11: cohetes de la bazooka
    STATS.time += dt;
  }
  updateZombieAudio(dt);
  updateFlameAudio();
  updateAmbience();
  updateMusic();                        // F6: marimba / tema del boss

  updateHUD(dt);
  updateFeelUI(dt);
  updatePowerupUI(dt);
  updatePromptUI(dt);
  updateTheme(dt);
  updateQuality(dt);
  updateGfx(dt);                        // F7a: sombras que siguen al jugador, post, sol y luna
  if (dmgT > 0) { dmgT -= dt; UI.dmg.style.opacity = Math.max(0, dmgT / CONFIG.FEEL.hurtFlash).toFixed(2); }
  updateDebug(dt);

  if (renderer.info) renderer.info.reset();
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();                 // el arma nunca la corta una pared
  renderer.render(weaponScene, weaponCamera);
}

init();
