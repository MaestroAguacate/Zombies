// Perfil por frame en Chrome: node tools/prof.js
// Mide en cada lugar (con 20 zombies cerca) cuánto tarda cada update de animate() (JS, lo que sí se puede medir sin
// placa de video) y cuántos draw calls, triángulos y objetos visibles tiene la escena (lo que le cuesta a la GPU)
const path = require('path'), fs = require('fs');
const pw = require(path.join(__dirname, 'sim', 'node_modules', 'playwright-core'));
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const ROOT = path.join(__dirname, '..');
const SPOTS = [
  { name: 'porche', x: 0, z: 0, yaw: 0 }, { name: 'sala', x: 0, z: 11, yaw: Math.PI }, { name: 'playa', x: 0, z: -14, yaw: 0 },
  { name: 'claro', x: -60, z: 58, yaw: Math.PI }, { name: 'templo', x: 70, z: 62, yaw: -Math.PI / 2 }, { name: 'jungla/rancho', x: -64, z: 30, yaw: 0 },
  { name: 'embarcadero', x: -60, z: -22, yaw: 0 }, { name: 'caparazon', x: -51, z: 85, yaw: 0 }
];
(async () => {
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.route('**/three.min.js', rt => rt.fulfill({ path: path.join(ROOT, 'tools/sim/node_modules/three/build/three.min.js'), contentType: 'text/javascript' }));
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction(() => typeof scene !== 'undefined' && scene && scene.children.length > 10, null, { timeout: 120000 });
  await page.evaluate(() => {
    resetGame(); MENU.started = true; showMenu(null); state.running = true; debugUnlockAll();
    state.round = 12; roundState.phase = 'active'; roundState.total = 999;
    // envolver cada update con un cronómetro
    window.PROF = {};
    const names = ['updatePlayer', 'updateFootsteps', 'updateRounds', 'updateFlowField', 'updateZombies', 'updateGibs', 'updateDrips', 'updateNight',
      'updateSquids', 'updateGiant', 'updateBoss', 'updateWeapon', 'updateGrenades', 'updateMonkeys', 'updateBlood', 'updatePickups',
      'updateEffects', 'updateBox', 'updateRelics', 'updatePerks', 'updateDown', 'updateGums', 'updateBarriers', 'updateShield', 'updateQuest',
      'updateClams', 'updateGarden', 'updateTraps', 'updateBunker', 'updateWeaponFx', 'updateInteract', 'updateZombieAudio', 'updateAmbience',
      'updateMusic', 'updateHUD', 'updateTheme', 'updateGfx', 'updateDebug'];
    for (const n of names) {
      const f = window[n] || eval(n);
      const w = function () { const t = performance.now(); const r = f.apply(this, arguments); PROF[n] = (PROF[n] || 0) + performance.now() - t; return r; };
      try { eval(n + ' = w'); } catch (e) {}
    }
    const r0 = renderer.render.bind(renderer);
    renderer.render = function (s, c) { const t = performance.now(); r0(s, c); PROF.render = (PROF.render || 0) + performance.now() - t; };
  });
  const rows = [];
  for (const s of SPOTS) {
    const res = await page.evaluate(async s => {
      player.pos.set(s.x, groundY(s.x, s.z) + CONFIG.PLAYER.height, s.z); player.yaw = s.yaw; player.pitch = 0; updateFlowField(true);
      for (const z of state.zombies.slice()) deactivateZombie(z); state.zombies.length = 0;
      for (let i = 0; i < 20; i++) { const z = spawnZombie(); if (!z) break; z.state = 'walk'; const a = i * 0.9; z.px = s.x + Math.cos(a) * (6 + i % 5); z.pz = s.z + Math.sin(a) * (6 + i % 5); }
      for (const k in PROF) PROF[k] = 0;
      let frames = 0; const t0 = performance.now();
      await new Promise(res => { const f = () => { frames++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      renderer.info.autoReset = false; renderer.info.reset(); renderer.render(scene, camera);
      const info = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
      renderer.info.autoReset = true;
      let vis = 0, mats = new Set(); scene.traverseVisible(o => { if (o.isMesh || o.isPoints || o.isLine) { vis++; mats.add(o.material); } });
      const per = {}; for (const k in PROF) per[k] = +(PROF[k] / frames).toFixed(3);
      const top = Object.entries(per).filter(([k]) => k !== 'render').sort((a, b) => b[1] - a[1]).slice(0, 6);
      const js = Object.entries(per).filter(([k]) => k !== 'render').reduce((a, [, v]) => a + v, 0);
      return { name: s.name, frames, jsMs: +js.toFixed(2), top, calls: info.calls, tris: info.tris, visibles: vis, materiales: mats.size, alive: state.zombies.filter(z => z.alive).length };
    }, s);
    rows.push(res);
    console.log(JSON.stringify(res));
  }
  const scene = await page.evaluate(() => { let v = 0, n = 0, m = 0; scene.traverse(o => { if (o.geometry && o.geometry.attributes && o.geometry.attributes.position) { v += o.geometry.attributes.position.count; n++; } if (o.isMesh) m++; }); return { vertices: v, objetos: n, meshes: m, lights: (() => { let l = 0; scene.traverse(o => { if (o.isLight) l++; }); return l; })() }; });
  console.log('escena', JSON.stringify(scene));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
