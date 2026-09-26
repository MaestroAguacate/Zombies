// Genera index.html (autocontenido, se abre con doble clic) desde src/.
//
//   node build.js          escribe index.html
//   node build.js --check  falla si index.html no coincide con src/ (lo corre npm test)
//
// src/*.js NO son módulos: se concatenan en ORDER dentro de un solo <script>, así que comparten un scope
// (igual que V1). Un archivo puede usar nombres de otro dentro de funciones (se llaman en runtime, cuando
// ya está todo definido), pero no en código que se ejecute al cargarse el archivo.
const fs = require('fs'), path = require('path');

const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'index.html');
const ORDER = [
  'config.js',   // 1 CONFIG + state
  'world.js',    // 2 WORLD: mapa, grid, props, luces, texturas
  'theme.js',    // 2b tema "Marena" 34B (solo visual)
  'player.js',   // 3 PLAYER + game feel de cámara
  'weapons.js',  // 4 WEAPONS
  'grenades.js', // 4b granadas (V2 F2.7)
  'zombies.js',  // 5 ZOMBIES: pool, flow field, IA
  'enemies.js',  // 5b ahogado, arrastrado, perros y la noche (V2 F4)
  'boss.js',     // 5c El Sombrerón (V2 F5)
  'rounds.js',   // 6 ROUNDS + estadísticas + game over
  'economy.js',  // 7 ECONOMY: puntos, puertas, wall buys, caja, power-ups
  'souls.js',    // 7b generadores, cajas de almas y Pack-a-Punch (V2 F2.5)
  'perks.js',    // 7c power y perks (V2 F2)
  'shield.js',   // 7d escudo y banco de trabajo (V2 F3a)
  'quest.js',    // 7e quest de la Ola Rompiente y taller de la playa (V2 F5.5)
  'garden.js',   // 7f plantas carnívoras del techo y perros del jardín trasero (V2 F5.6)
  'traps.js',    // 7g trampas: tiburón del muelle y cortadora del jardín oeste (V2 F5.9)
  'bunker.js',   // 7h búnker, escotilla y estatuas de plantas (V2 F5.11)
  'clams.js',    // 7i almejas y fumigador (V2 F5.14)
  'progress.js', // 7j XP, niveles, accesorios de armas, perfil (V2 F5.18)
  'gums.js',     // 7k chicles: chicleras en el mapa y sus efectos (V2 F5.18b)
  'ui.js',       // 8 UI: HUD, menús, overlay de debug
  'audio.js',    // 8b audio procedural
  'gfx.js',      // 8c calidad, sombras, post-proceso CSS, sol y luna (V2 F7a)
  'debug.js',    // 8c modo debug (CONFIG.DEBUG_MODE)
  'loop.js'      // 9 LOOP: init, input, animate, calidad
];
const MARK = '@@BUNDLE@@';

function bundle() {
  return ORDER.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('');
}
function html() {
  const shell = fs.readFileSync(path.join(SRC, 'shell.html'), 'utf8');
  if (shell.split(MARK).length !== 2) throw new Error('src/shell.html debe tener exactamente un ' + MARK);
  return shell.replace(MARK, () => bundle());          // función: el código puede tener "$&" y similares
}
module.exports = { ORDER, SRC, OUT, bundle, html };

if (require.main === module) {
  const out = html();
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== out) {
      console.error('index.html NO coincide con src/. Editá src/ y corré: node build.js');
      process.exit(1);
    }
    console.log('index.html al día con src/ (' + ORDER.length + ' archivos, ' + out.length + ' bytes)');
  } else {
    fs.writeFileSync(OUT, out);
    console.log('index.html generado (' + ORDER.length + ' archivos, ' + out.length + ' bytes)');
  }
}
