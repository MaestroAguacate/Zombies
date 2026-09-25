// V2 F0.2: index.html es un artefacto de build. Tiene que coincidir con src/ y src/ no puede tener
// archivos .js fuera del orden de build.js (quedarían sin incluir en silencio).
const fs = require('fs'), path = require('path');
const B = require('../../build.js');
let fail = 0;
const check = (c, msg, extra) => { console.log((c ? '  ok    ' : '  FALLA ') + msg + (extra ? ' ' + extra : '')); if (!c) fail++; };

const onDisk = fs.readdirSync(B.SRC).filter(f => f.endsWith('.js')).sort();
check(JSON.stringify(onDisk) === JSON.stringify([...B.ORDER].sort()), 'todo src/*.js está en ORDER y viceversa',
  `(${onDisk.length} archivos)`);
check(B.ORDER.every(f => fs.readFileSync(path.join(B.SRC, f), 'utf8').trim().length > 0), 'ningún archivo vacío');
const html = B.html();
check(fs.readFileSync(B.OUT, 'utf8') === html, 'index.html al día con src/ (si falla: node build.js)');
check(html.startsWith('<!DOCTYPE html>\n<!-- GENERADO'), 'index.html marcado como generado');
check((html.match(/<script>/g) || []).length === 1 && html.includes('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js">'),
  'un solo script inline + Three r128 del CDN (se abre con doble clic)');
check(!/\bimport\s|\brequire\(|\bexport\s/.test(B.bundle()), 'sin import/export/require: script clásico');
// modo debug: prendido en desarrollo está bien; en una build final, NO. Solo avisa (no falla)
const dbg = /DEBUG_MODE:\s*(true|false)/.exec(B.bundle());
check(!!dbg, 'CONFIG.DEBUG_MODE definido');
if (dbg && dbg[1] === 'true')
  console.log('  AVISO  CONFIG.DEBUG_MODE está en true (trucos, overlay y cartel activos). Ponelo en false antes de una build final.');

console.log(fail ? `FALLA (${fail})` : 'PASA'); process.exit(fail ? 1 : 0);
