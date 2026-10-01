# Memoria para arrancar un chat nuevo (Beach House Zombies)

Leer primero `CLAUDE.md` (manda; las secciones de más abajo mandan sobre las de arriba cuando se contradicen) y
`ROADMAP-V2.md` (sección "PLAN VIGENTE" al final de F5). Estado al 2026-09-28.

## Cómo trabajar
- Rama: `claude/compassionate-knuth-tcnxws` (repo `MaestroAguacate/Zombies`). Commit y push ahí. PR solo si Diego lo pide.
- Se edita `src/`, nunca `index.html`: `node build.js` lo genera (y se commitea). Archivo nuevo en `src/` → agregarlo a
  `ORDER` en `build.js`.
- Tests: `cd tools/sim && npm install && npm test` (55 archivos). `npm test` corta en el primero que falla: para ver todo,
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

- **F5.19 y F5.19b (2026-09-26, sin commit: la carpeta local no es un repo git)**: ver `ROADMAP-V2.md` F5.19 y la
  sección F5.19b de `CLAUDE.md`. Oeste corrido, caparazón +7 m, claro rocoso con la trampa de la tortuga mariachi,
  embarcadero con la cabeza del calamar en el mar (R22, baranda D22), templo con plancha a 4.3 m y PaP azteca-calamar,
  búnker en el choque, sonidos de `sonidos/` embebidos (index.html ~15 MB), nivel por arma, tienda KRAKEN INK con
  tómbola, 3 LMG nuevas, cinemática de muerte, **barricadas estilo BO** (`barriers.js`). 48 tests (`f519.js`, `f519b.js`).
- F5.19c (2026-09-26): sonidos de `Nuevos sonidos/` (index.html ~38 MB), bug de zombies en el búnker, CARPENTER y FIRE
  SALE, un chicle a la vez, line up en la pausa, aviso de accesorios nuevos, 2 snipers que atraviesan, M1911 con PaP doble
  y explosiva, animación de tomar el perk. Ver la sección F5.19c de `CLAUDE.md`. 49 tests.
- F5.20 (2026-09-27): las 3 tandas hechas (A–C chicos, sonidos y chicles; D–F garaje, casa oscura con faroles,
  ventanas con hueco, variantes de zombie, barco, portal, sol; G la **planta jefa del templo** en `plantboss.js`). Ver
  las secciones F5.20 de `CLAUDE.md`. 50 tests (`f520.js`).
- F5.21 (2026-09-27): primer chicle gratis, cinemática de muerte = la canción, lápida legible, planta jefa en cubos con
  raíces y ráfagas de 3 y cinemática de escupir el PaP, portal y barco en cubos, embarcadero de dos pisos, cabeza del
  calamar grande por dentro con galerías. Ver la sección F5.21 de `CLAUDE.md`. 51 tests (`f521.js`).
- F5.22 (2026-09-28): Double Tap y chiclera arriba del embarcadero, planta en el centro del templo (toda el área, más
  rápida), escupir el PaP sin pausa, sin burbuja blanca, cabeza del calamar más grande con órganos, y el caparazón grande
  con laboratorio y TERCER NIVEL real (motor de 3 niveles: `UP2`, `lvY`, `colInLayer`). Ver la sección F5.22 de `CLAUDE.md`.
- F5.23 (2026-09-28): la planta te mira siempre y te agarra con la lengua (te arrastra y te traga; te soltás con un tiro a
  la lengua o 2 cuchillazos), y vida baja estilo CoD (borde de sangre y respiración con latido). Después: la lengua te
  levanta y se te nubla la vista hasta la boca (Diego sacó las mandíbulas en pantalla), sonidos de `Nuevos sonidos 2/Planta Boss` (`pb_*`), y los 3 tests viejos
  arreglados: la suite de 55 archivos está en verde. Sección F5.23 de `CLAUDE.md`.
- Capturas y partidas automáticas en esta compu (Windows): `playwright-core` en tools/sim (`npm install --prefix tools/sim
  --no-save playwright-core`) + el Chrome instalado. `node tools/play.js [carpeta] [partidas]`.
- Para correr todos los tests sin cortar en el primero: un script que ejecute cada archivo de `package.json` por separado.
- **Buscar bugs barato:** `node tools/sim/soak.js 16 4 1` (bot que juega solo en Node; resumen corto y detalle en
  `soak-report.json`; ver `CLAUDE.md`). La guía de prueba manual para Diego está en `PLAYTEST.md`.

## Pendiente (en orden; detalle en ROADMAP-V2 "PLAN VIGENTE", actualizado 2026-09-28)
1. **F5.24: HECHO (2026-09-28)** (sección F5.24 de `CLAUDE.md`). Era:
   - planta: charcos de ácido con diseño, raíces más amplias, raíces que atrapan, lengua más seguido que te levanta y te
     traga;
   - al morir la planta: sonido ×2, explota y deja un charco amarillo que es el portal (en las dos puntas; se salta
     adentro, sin F), más su cabeza en una esquina;
   - estatuas del calamar más chicas;
   - GRAVE WHISPER: un tiro mata hasta la R9, clic izquierdo/derecho = pistola izquierda/derecha, sin ADS, impacto
     con el sonido de la bazooka;
   - sonidos para las armas mudas;
   - caparazón que no se rodea (**hecho**), oscuro sin energía (falta);
   - mapa con la tecla 5: **ya hecho** (`mapview.js`; papel viejo con sangre, lo no explorado quemado con brasas, notas en
    rojo, zombies cercanos, "NO SIGNAL" en el búnker);
   - íconos de granada y langostino en el HUD.
2. **Playtest definitivo de Diego** de todo lo hecho desde F5.16 y arreglar lo que salga.
3. Compañero CPU con dificultad (pedido "de último, si no es muy difícil"): sin empezar; decidir si entra en V2.
4. F8 cierre V2 (DEBUG_MODE false, balance P9, suite en verde, tag). Subir los cambios al repo (la carpeta local no
   tiene git).
