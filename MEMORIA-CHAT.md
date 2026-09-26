# Memoria para arrancar un chat nuevo (Beach House Zombies)

Leer primero `CLAUDE.md` (manda) y `ROADMAP-V2.md`. Esto es el resumen corto del estado al 2026-09-25.

## Cómo trabajar
- Rama: `claude/compassionate-knuth-tcnxws` (repo GitHub `MaestroAguacate/Zombies`). PR solo si Diego lo pide.
- Se edita `src/`, nunca `index.html`: `node build.js` lo genera. Tests: `cd tools/sim && npm test` (44 tests;
  `npm test` corta en el primero que falla: para ver todo, correr cada `node X.js`).
- Ver el juego sin navegador: `node tools/shots.js vistas.json carpeta` (capturas headless; ver CLAUDE.md F5.17).
- Diego: respuestas cortas, directas, sin relleno; decir lo que está mal; al final 3 bugs probables y cómo probarlos.
- `CONFIG.DEBUG_MODE` en `true` solo en desarrollo: ponerlo en `false` antes del build final.

## Hecho (sin playtest de Diego todavía)
- F5.16 tandas A, B, C y D (5 áreas, portal con tumba, niebla, todo en inglés, rancho + tortugario).
- F5.17 (estilo BO2, "menos Minecraft"):
  - `MeshBuilder` con formas curvas (cilindros, tubos, rocas, gotas, tornos) y hojas con alfa (`FOLI`), texturas
    con filtrado lineal, jungla por celdas (`ChunkMB`) para FPS.
  - Rancho (palapa de paja, tiki bar contra el cerco sur, rifle a la esquina SE), cueva de rocas con ojos que brillan,
    templo (raíces, cabezas colosales, estelas, braseros), jardines (cercos de hojas, lajas, faroles, hiedra), plantas
    carnívoras orgánicas, lo verde junto a Double Tap (arbustos que atravesaban la pared) arreglado.
  - Caparazón de tortuga gigante (R21) en lugar de la estación de policía: entrepiso con escalera, costillas, sangre
    verde que brilla, claro agrandado hasta z 95. Stamin-Up, generador `garaje` y Uzi (arriba) adentro.

## Pendiente
- Playtest de Diego: FPS (sobre todo Alto con sombras y el follaje), el caparazón, el rancho.
- F5.18b hecho: accesorios por arma + preview, cuentas, modo dev (X), chicles (gums.js), conchas. Ver CLAUDE.md F5.18b.
- F5.18 hecho: vuelta a cubos (personajes, plantas), cráneo en el caparazón, agacharse, last stand con QR, choque al
  oeste del templo, XP/niveles/accesorios/camos (progress.js), menú nuevo. Ver CLAUDE.md F5.18.
- F5.17b/c hecho: cielo (domo), rayo de la caja, pared playa-calamar con H8, formas curvas en personajes, casa, muelle,
  cabeza del calamar y playa. Sigue de cajas: estatuas del calamar, perks, PaP, armas en primera persona.
- Diego está juntando sonidos para implementar (esperar su lista).
- Tanda E: embarcadero oscuro al lado de la cabeza del calamar, animales de mar muertos (algunos alienígenas),
  Double Tap (hoy en la piscina), LMG, llegada del portal. Después F8 (cierre V2).
