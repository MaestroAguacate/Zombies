// Partidas automáticas en el navegador de verdad (Chrome + WebGL), para ver si todo corre: node tools/play.js [carpeta] [partidas]
// Cada partida arranca como si apretaras PLAY, y un "bot" apunta y dispara al zombie más cercano, recarga, compra lo
// que tiene enfrente y va cambiando de lugar (porche, casa, playa, templo, búnker, claro). Saca capturas cada tanto y
// al final imprime: errores de la página, FPS promedio, ronda alcanzada, kills y si murió.
// Requiere playwright-core en tools/sim (npm install --prefix tools/sim --no-save playwright-core) y Chrome o Edge.
const path = require('path'), fs = require('fs');
const pw = require(path.join(__dirname, 'sim', 'node_modules', 'playwright-core'));
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const ROOT = path.join(__dirname, '..'), out = process.argv[2] || path.join(ROOT, 'shots', 'play'), runs = +(process.argv[3] || 3);
fs.mkdirSync(out, { recursive: true });

// lugares a visitar (x, z, y de los pies) y cuánto quedarse (s)
const TOUR = [
  { name: 'porche', x: 0, z: 0, t: 25 }, { name: 'sala', x: 0, z: 11, t: 20 }, { name: 'playa', x: 0, z: -14, t: 20 },
  { name: 'claro', x: -60, z: 58, t: 20 }, { name: 'templo', x: 70, z: 62, t: 20 }, { name: 'nave', x: 89, z: 70, y: 4.3, t: 15 },
  { name: 'bunker', bunker: true, t: 25 }, { name: 'embarcadero', x: -60, z: -22, t: 15 }
];

(async () => {
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
  const report = [];
  for (let r = 0; r < runs; r++) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.route('**/three.min.js', rt => rt.fulfill({ path: path.join(ROOT, 'tools/sim/node_modules/three/build/three.min.js'), contentType: 'text/javascript' }));
    await page.goto('file://' + path.join(ROOT, 'index.html'));
    await page.waitForFunction(() => typeof scene !== 'undefined' && scene && scene.children.length > 10, null, { timeout: 120000 });
    await page.screenshot({ path: path.join(out, 'r' + r + '_00_menu.png') });
    // arrancar la partida (como PLAY sin el mouse capturado) y el bot
    await page.evaluate(run => {
      resetGame(); MENU.started = true; showMenu(null); state.running = true;
      if (run > 0) debugUnlockAll();                        // la 2da y 3ra, con todo abierto (templo, búnker, PaP)
      window.BOT = { frames: 0, t0: performance.now(), fps: [], deaths: 0, target: null };
      const THREE_ = THREE, dir = new THREE_.Vector3();
      setInterval(() => {                                   // apuntar y disparar al más cercano con línea libre
        if (!state.running) return;
        const P = player.pos; let best = null, bd = 25;
        for (const z of state.zombies) {
          if (!z.alive) continue;
          const d = Math.hypot(z.px - P.x, z.pz - P.z);
          if (d < bd && segmentClear(P.x, P.z, z.px, z.pz, 0, true)) { bd = d; best = z; }
        }
        keys.Mouse0 = false;
        if (best) {
          const gy = (best.level === 1 ? UP.y : groundY(best.px, best.pz)) + 1.55;
          dir.set(best.px - P.x, gy - P.y, best.pz - P.z).normalize();
          player.yaw = Math.atan2(-dir.x, -dir.z); player.pitch = Math.asin(dir.y);
          const s = curSlot();
          if (s && s.mag === 0) reloadWeapon(); else { fireWeapon(); keys.Mouse0 = true; }
          if (bd < 1.6) meleeAttack();
        }
        state.points += 20;                                 // para que compre cosas
        if (state.health < 30 && !BOT.low) { BOT.low = true; }
      }, 120);
      let last = performance.now();
      const fpsTick = () => { const n = performance.now(); BOT.fps.push(1000 / Math.max(1, n - last)); last = n; if (BOT.fps.length > 5000) BOT.fps.shift(); requestAnimationFrame(fpsTick); };
      requestAnimationFrame(fpsTick);
    }, r);
    const t0 = Date.now();
    let shot = 1;
    for (const stop of TOUR) {
      await page.evaluate(s => {
        if (s.bunker) { if (BUNK.open) useHatch({ down: true }); return; }
        player.pos.set(s.x, (s.y || groundY(s.x, s.z)) + CONFIG.PLAYER.height, s.z); player.vel.set(0, 0, 0); updateFlowField(true);
      }, stop);
      const n = Math.max(1, Math.round(stop.t / 5));
      for (let k = 0; k < n; k++) {
        await page.waitForTimeout(5000);
        const dead = await page.evaluate(() => state.gameOver);
        if (dead) { await page.screenshot({ path: path.join(out, 'r' + r + '_' + String(shot++).padStart(2, '0') + '_muerte.png') }); break; }
        if (k === n - 1) await page.screenshot({ path: path.join(out, 'r' + r + '_' + String(shot++).padStart(2, '0') + '_' + stop.name + '.png') });
      }
      const over = await page.evaluate(() => state.gameOver);
      if (over) {                                           // la cinemática y el menú
        await page.waitForTimeout(4000);
        await page.screenshot({ path: path.join(out, 'r' + r + '_' + String(shot++).padStart(2, '0') + '_cinematica.png') });
        await page.evaluate(() => { resetGame(); MENU.started = true; showMenu(null); state.running = true; debugUnlockAll(); BOT.deaths++; });
      }
    }
    const res = await page.evaluate(() => {
      const f = BOT.fps.slice(100), avg = f.reduce((a, b) => a + b, 0) / Math.max(1, f.length);
      const low = f.slice().sort((a, b) => a - b)[Math.floor(f.length * 0.05)] || 0;
      return { round: state.round, kills: state.kills, points: state.points, deaths: BOT.deaths, over: state.gameOver,
               fps: Math.round(avg), fps5: Math.round(low), alive: state.zombies.filter(z => z.alive).length, draw: renderer.info.render.calls };
    });
    report.push(Object.assign({ run: r, secs: Math.round((Date.now() - t0) / 1000), errors: errors.slice(0, 20), nErrors: errors.length }, res));
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(report, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
