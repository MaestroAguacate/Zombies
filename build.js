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
  'barriers.js', // 7l barricadas: ventanas y trampillas con tablas, saltos desde afuera (V2 F5.19b)
  'plantboss.js', // 7m la planta jefa del templo (V2 F5.20)
  'beast.js',     // 7n la Bestia del búnker: barriles, escalera, la Bestia y sus crías (V2 F5.26)
  'trophies.js',  // 7o trofeos de boss, el Altar de Huesos y sus recetas (V2 F5.26)
  'catacombs.js', // 7p catacumbas mayas y la cueva con la entrada del búnker (V2 F5.28e)
  'kraken.js',    // 7q easter egg THE KRAKEN: los pasos, la arena y la pelea (V2 F5.29)
  'ui.js',       // 8 UI: HUD, menús, overlay de debug
  'mapview.js',  // 8d mapa con la tecla 5 (V2 F5.24)
  'audio.js',    // 8b audio procedural
  'gfx.js',      // 8c calidad, sombras, post-proceso CSS, sol y luna (V2 F7a)
  'debug.js',    // 8c modo debug (CONFIG.DEBUG_MODE)
  'loop.js'      // 9 LOOP: init, input, animate, calidad
];
const MARK = '@@BUNDLE@@';
// V2 F5.19: los sonidos de Diego (sonidos/*.mp3|m4a) van embebidos en base64 en un bloque JSON aparte
// (<script type="application/json" id="bhzSounds">): index.html sigue siendo un solo archivo. La clave de cada uno es
// su nombre sin acentos, en minúsculas y con _ ("Golpe Z 2 (1).m4a" -> golpe_z_2_1). Se levanta la regla
// "sin assets externos" solo para esto (pedido de Diego)
// F5.19c: también "Nuevos sonidos/" (la segunda tanda). Se saltean los que dicen "(pendiente)" en el nombre
// F5.20: y "Nuevos sonidos 2/" con subcarpetas. Los de "Sonidos naturales de zombies" van como zgrowl_1..N (el código los
// elige al azar, así no importa cómo se llamen los archivos)
const SOUNDS = [path.join(__dirname, 'sonidos'), path.join(__dirname, 'Nuevos sonidos'), path.join(__dirname, 'Nuevos sonidos 2')];
const SOUND_PREFIX = { 'sonidos naturales de zombies': 'zgrowl_' };
// F5.23: carpetas con nombre genérico ("Ataque 2", "Daño"): la clave lleva un prefijo y el nombre ("Ataque 2" -> pb_ataque_2)
const SOUND_NAMED = { 'planta boss': 'pb_' };
const SMARK = '@@SOUNDS@@';
// F5.28e (Diego): el wallpaper de la pantalla de carga (WALLPAPER.jpg) va embebido como data URI donde diga @@WALLPAPER@@
// (la regla "sin assets externos" queda: salvo los sonidos y este wallpaper)
const WMARK = '@@WALLPAPER@@', WALLPAPER = path.join(__dirname, 'WALLPAPER.jpg');
function wallpaperURI() {
  return fs.existsSync(WALLPAPER) ? 'data:image/jpeg;base64,' + fs.readFileSync(WALLPAPER).toString('base64') : '';
}

function bundle() {
  return ORDER.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('');
}
function soundKey(f) {
  return f.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function soundsJSON() {
  const out = {};
  const walk = (dir, prefix) => {
    let n = 0;
    for (const f of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) {
        const k = f.toLowerCase();
        walk(p, SOUND_PREFIX[k] || (SOUND_NAMED[k] ? { named: SOUND_NAMED[k] } : null));
        continue;
      }
      if (!/\.(mp3|m4a|ogg|wav)$/i.test(f) || /pendiente/i.test(f)) continue;
      const key = !prefix ? soundKey(f) : prefix.named ? prefix.named + soundKey(f) : prefix + (++n);
      out[key] = fs.readFileSync(p).toString('base64');
    }
  };
  for (const dir of SOUNDS) if (fs.existsSync(dir)) walk(dir, null);
  return JSON.stringify(out);
}
function html() {
  const shell = fs.readFileSync(path.join(SRC, 'shell.html'), 'utf8');
  if (shell.split(MARK).length !== 2) throw new Error('src/shell.html debe tener exactamente un ' + MARK);
  return shell.replace(MARK, () => bundle()).replace(SMARK, () => soundsJSON())   // función: el código puede tener "$&" y similares
    .split(WMARK).join(wallpaperURI());
}
module.exports = { ORDER, SRC, OUT, bundle, html, soundKey };

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
