# Memoria para arrancar un chat nuevo (Beach House Zombies)

Leer primero `CLAUDE.md` (manda; las secciones de más abajo mandan sobre las de arriba cuando se contradicen) y
`ROADMAP-V2.md` (sección "PLAN VIGENTE" al final de F5). Estado al 2026-09-26.

## Cómo trabajar
- Rama: `claude/compassionate-knuth-tcnxws` (repo `MaestroAguacate/Zombies`). Commit y push ahí. PR solo si Diego lo pide.
- Se edita `src/`, nunca `index.html`: `node build.js` lo genera (y se commitea). Archivo nuevo en `src/` → agregarlo a
  `ORDER` en `build.js`.
- Tests: `cd tools/sim && npm install && npm test` (46 tests). `npm test` corta en el primero que falla: para ver todo,
  correr cada `node X.js`. La suite entera tarda ~15 min (correrla en background). `f511.js` tiene un chequeo del
  calamar gigante que a veces falla por azar (7 de 14 contra > 50%): si falla solo eso, re-correrlo.
- Capturas sin navegador: `node tools/shots.js vistas.json carpeta` (Chromium headless). Opciones por vista: `x,y,z`,
  `look`, `fog`, `round`, `open`, `eval` (JS en la página, imprime el resultado), `menu: true` + `panel` (maps, weapons,
  gums, profile, settings, controls). Ojo: con `state.running = false` el arma no se ubica (hay que correr `updateWeapon`
  en el eval si se quiere ver en mano).
- Diego: español, respuestas cortas, directas, sin relleno, estilo cavernícola; decir lo que está mal antes de codear;
  al final 3 bugs probables y cómo probarlos. Crear/actualizar este archivo al migrar de chat.
- `CONFIG.DEBUG_MODE` está en `true` (desarrollo): ponerlo en `false` antes del build final. Con él: P puntos, ] [ rondas,
  N noclip, K perros, J boss, O desbloquear todo, X cuenta dev (nivel máx + todos los chicles, sin guardar), B grid, H overlay.

## Estado (todo commiteado y pusheado; falta el playtest de Diego de casi todo desde F5.16)
- Mapa por áreas (F5.15/F5.16): casa + playa + jardines + muelle, rancho y tortugario, claro del búnker con el
  caparazón de tortuga gigante (R21), templo (R20, con el PaP) y playa del calamar (R19, cabeza gigante). Portal
  templo ↔ calamar tras disparar a la tumba. Todo el juego en inglés; código en español.
- Estilo: personajes, mobs, bosses, plantas carnívoras y armas **en cubos** (Diego lo pidió así, F5.18). El entorno sí
  tiene formas curvas (F5.17/F5.17c: jungla, rancho, templo, caparazón, casa, muelle, playa, **cabeza del calamar**).
- F5.18: cráneo de tortuga en la boca del caparazón, agacharse (C), Quick Revive = 10 s tirado en gris con la Ray Gun y
  los zombies alejándose, choque en llamas al oeste del templo (R20 x 36..55 z 75..92), XP y 55 niveles, 6 accesorios +
  4 camos, menú nuevo (mundo en gris, siluetas, MAPS con City y ??? bloqueados, WEAPONS, GUMS, PROFILE, SETTINGS).
- F5.18b: accesorios según el arma (el arco con los suyos) y vista previa 3D en WEAPONS; cuentas locales (varias);
  modo dev (X); **chicles** (19 en 4 rarezas, moneda KRAKEN INK, tienda 1/2/3, preset de 5, chicleras cúbicas en
  porche/rancho/templo/calamar, T usa cargas); almejas → conchas cúbicas que ofrecen el arma con F.
- La pausa solo tiene RESUME, SETTINGS, CONTROLS, QUIT TO MENU (a propósito: no se cambia la carga en partida).
  QUIT guarda la XP.

## Pendiente (en orden; detalle en ROADMAP-V2 "PLAN VIGENTE")
1. Playtest de Diego y arreglar lo que salga (FPS en Alto, chicles, last stand, accesorios, menú, choque, conchas).
2. **Sonidos:** Diego va a subir una carpeta `sonidos/` al repo (le pasé el comando de PowerShell con un clon aparte).
   Implica levantar otra vez la regla "sin assets externos": embeberlos en `index.html` (base64) para seguir con un solo
   archivo. Esperar su lista de qué va con qué.
3. Tanda E de F5.16: embarcadero oscuro junto a la cabeza del calamar, animales de mar muertos (algunos alienígenas),
   Double Tap y LMG ahí, llegada del portal.
4. Lo que sigue de cajas en el entorno y quedó sin tocar: estatuas de la cámara del calamar, máquinas de perks, PaP.
5. F8 cierre V2 (DEBUG_MODE false, balance P9, tag).
