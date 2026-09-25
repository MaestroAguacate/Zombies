// Capturas del juego sin navegador a mano: node tools/shots.js vistas.json [carpeta]
// vistas.json = [{ name, x, y, z, yaw, pitch, look?: [x, y, z], fog?, round?, open?, eval? }]
//   yaw 0 mira a -z, PI/2 mira a -x, PI mira a +z, -PI/2 mira a +x · pitch negativo mira abajo
//   y es la altura de la cámara (ojos a 1.7 sobre el piso) · open: abre todas las puertas (y el portal)
// Usa el Playwright global y el Chromium de /opt/pw-browsers (WebGL por SwiftShader, lento pero sirve).
// three.js se sirve desde tools/sim/node_modules (sin red).
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
let pw;
try { pw = require('playwright'); } catch (e) {
  pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}
const ROOT = path.join(__dirname, '..');
const views = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3] || path.join(ROOT, 'shots');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await pw.chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', e => console.log('pageerror:', e.message));
  page.on('console', m => { if (m.text().startsWith('eval:')) console.log(m.text()); });
  await page.route('**/three.min.js', r => r.fulfill({
    path: path.join(ROOT, 'tools/sim/node_modules/three/build/three.min.js'), contentType: 'text/javascript' }));
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction(() => typeof scene !== 'undefined' && scene && scene.children.length > 10, null, { timeout: 60000 });
  await page.evaluate(() => {
    for (const id of ['start', 'hud', 'post', 'debugmode', 'debug', 'banner', 'prompt', 'lowhp', 'dmg', 'ink', 'fade']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
  });
  for (const v of views) {
    await page.evaluate(v => {
      if (v.open && typeof debugOpenAllDoors === 'function') {
        debugOpenAllDoors();
        if (typeof openPortals === 'function' && !PORTAL.open) openPortals();
      }
      state.round = v.round || 1; setSky(state.round);
      if (typeof captureDay === 'function') captureDay();
      NIGHT.k = NIGHT.target; NIGHT.p = NIGHT.pTarget; applyNight(NIGHT.k, 0, NIGHT.p);
      setFog(v.fog || 90);
      state.running = false;
      if (typeof weaponScene !== 'undefined') weaponScene.visible = false;
      if (v.look) {
        const dx = v.look[0] - v.x, dy = v.look[1] - v.y, dz = v.look[2] - v.z;
        v.yaw = Math.atan2(-dx, -dz); v.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      }
      camera.position.set(v.x, v.y, v.z);
      camera.rotation.set(v.pitch || 0, v.yaw || 0, 0, 'YXZ');
      if (v.eval) console.log('eval:', JSON.stringify(eval(v.eval)));
      player.pos.set(v.x, v.y, v.z);
    }, v);
    await page.waitForTimeout(v.wait || 1500);
    const file = path.join(out, v.name + '.png');
    await page.screenshot({ path: file });
    console.log('ok', file);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
