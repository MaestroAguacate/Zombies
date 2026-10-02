# Beach House Zombies

Juego web estilo CoD Zombies, en cubos (voxel), en una isla con una casa de playa abandonada. Proyecto personal de Diego.

> **Cómo leer este archivo:** está lo vigente. El detalle de cada fase (qué se hizo, por qué, con qué números y qué test
> lo cubre) está en **`HISTORIAL-FASES.md`**: buscá ahí la sección de la fase antes de tocar un sistema viejo. Para
> retomar el trabajo, leé también la sección "PLAN VIGENTE" de `ROADMAP-V2.md` y `MEMORIA-CHAT.md`.

## Estado (2026-10-01)
- V1 cerrada (tag local `v1-final`). **V2 cerrada** (tag `v2-final`, subido). El compañero CPU queda para V3.
- **F5.29: el easter egg del Kraken** (`kraken.js`, `CONFIG.EE`, test `f529.js`; guía en `GUIA-EASTER-EGG.md`).
  `CONFIG.DEBUG_MODE` volvió a **true** para desarrollar (antes de publicar, a false).
- **Lo próximo: el segundo mapa, YALUW** (una cueva enorme estilo "viaje al centro de la Tierra"; en el menú, en el lugar
  de CITY). Se juega como la playa; la fauna alienígena es decoración; la lava quema y caer al pozo mata; se baja en
  espiral por el pozo central y sus paredes tienen túneles a otras zonas. Diseño en `DISEÑO-MAPA2.md`.
- **Repo:** GitHub `MaestroAguacate/Zombies`, rama `claude/compassionate-knuth-tcnxws`. Arrancó de cero con subidas web:
  los tags viejos solo existen en la copia local de Diego.
- **Todo el juego está en inglés** (textos visibles). Código, comentarios y docs, en español.

## Reglas no negociables
- **Se edita `src/`, nunca `index.html`.** `node build.js` concatena `src/*.js` (en el orden de `ORDER`) dentro de
  `src/shell.html`, embebe los sonidos y genera `index.html`: un solo archivo que se abre con doble clic y se commitea.
  `buildcheck.js` falla si `index.html` no coincide con `src/`.
- Three.js **r128** por `<script>` UMD desde cdnjs. Nada de ES modules ni bundlers: `src/*.js` son pedazos de UN script
  clásico con scope compartido.
- Sin assets externos: texturas por canvas, modelos en cubos por código. Los únicos archivos son los sonidos de Diego
  (`sonidos/`, `Nuevos sonidos/`, `Nuevos sonidos 2/`), que `build.js` embebe.
- `localStorage` solo para el récord (`CONFIG.HIGHSCORE_KEY`) y las cuentas (`CONFIG.PROGRESSION.accountsKey`: XP, pase,
  accesorios, chicles, tinta, kills de boss).
- **Todo número de balance vive en `CONFIG`.** Si hay que tocar un número fuera de CONFIG, está mal.
- **Nombres fijos: nunca renombrar.** `state.round, state.points, state.health, state.zombies[], state.doors{},
  state.power, state.weapons[], state.currentWeapon, spawnZombie(), damageZombie(z, dmg, headshot, killPoints,
  hitPoints, part), buyDoor(id), fireWeapon(hand), startRound(n)`. La lista completa (cientos de nombres de V2 que los
  tests usan) está en `HISTORIAL-FASES.md`, sección "Nombres fijos". Todo nombre nuevo que un test necesite va al objeto
  `G` de `tools/sim/harness.js`.
- Español y directo. Si algo es mala idea técnica, decirlo **antes** de codear.
- Al editar: decir SOLO qué cambió. Al final: **3 bugs probables y cómo probarlos**.
- Pedidos que mezclan varias cosas o inventan una mecánica: primero un diagnóstico de impacto y las preguntas abiertas,
  y recién después se planea (ver la memoria `separar-pedidos-diagnostico`).

## Trampas conocidas (pasaron varias veces)
- **Un `// comentario` agregado en medio de una línea comenta todo lo que sigue.** Rompió CONFIG 4 veces (campos en
  `undefined` o `NaN` sin error) y en F5.26 dejó el portal y la escalera del búnker sin viajar. En F5.28c apareció en
  `interact()`: los faroles de la casa no se prendían y F caía en la compra de pared (daba puntos), y en `promptFor` el
  cartel del Fire Sale. El comentario va en su propia línea. Para buscarlos:
  Grep `//[^\n]*\S  +(if \(|const |let |for \(|return )` en `src/`.
- **Herramientas:** para leer, buscar y editar se usan Read, Grep y Edit, nunca sed, grep o cat por Bash, ni scripts que
  empalmen código. Bash solo para comandos simples de una instrucción (`node build.js`, `node <test>.js`, `npm test`, git).
- En OneDrive, Grep sobre una carpeta a veces no encuentra nada: buscar archivo por archivo. `index.html` es una línea de
  43 MB y Grep no ve adentro.
- **La suite tarda más de 1.5 h y lee `src/` al arrancar cada test.** Para seguir editando mientras corre: copiar
  `index.html` y correrla con `BHZ_FILE=<copia>`. Ojo: si después se agregan exportaciones al harness, la copia vieja
  falla con `ReferenceError`. `npm test` corta en el primer fallo.
- El raycaster de r128 no mira `.visible`: para que algo no reciba balas hay que sacarlo de `hitMeshes` o escalarlo a
  1e-3.
- **Toda luz nueva recompila shaders (tirones).** Nunca `scene.add(light)` durante el juego: los brillos van con
  MeshBasic y aditivos.

## Arquitectura (orden de carga = `ORDER` de `build.js`)
| Archivo | Sección | Contenido |
|---|---|---|
| `config.js` | 1 CONFIG | todo el balance + `state` |
| `world.js` | 2 WORLD | escena, cuartos (`ROOMS`), grid de navegación (3 niveles), `PROPS`, puertas, colliders, texturas |
| `theme.js` | 2b TEMA | lo visual (casa, playa, muelle), `MeshBuilder` y sus primitivas en cubos, follaje en cubos |
| `player.js` | 3 PLAYER | movimiento, colisión 3D, game feel, `damagePlayer` |
| `weapons.js` | 4 WEAPONS | armas, cuchillo, ADS, Pack-a-Punch (`papDef`), accesorios (`attDef`), balas (`traceShot`) |
| `grenades.js` | 4b | granadas, langostino, `explodeAt` |
| `zombies.js` | 5 | pool, flow field, IA, `damageZombie`, variantes |
| `enemies.js` | 5b | ahogados, arrastrados, perros, calamares, noche y clima |
| `boss.js` | 5c | Sombrerón y Calamarón (pool `BOSS.pool`; la Bestia también está en el pool) |
| `rounds.js` | 6 | rondas, `STATS`, game over, cinemática de muerte, `resetGame` |
| `economy.js` | 7 | puntos, puertas, paredes, caja, power-ups, `updateInteract`/`interact` |
| `souls.js` | 7b | generadores, cajas de almas, Pack-a-Punch |
| `perks.js` | 7c | energía, perks, last stand, faroles de la casa |
| `shield.js` | 7d | escudo y banco |
| `quest.js` | 7e | Ola Rompiente (coco dorado, cuerda, caracola, taller), cabeza del calamar |
| `garden.js` | 7f | jardines, plantas carnívoras, ácido y slime, jungla y árboles (`VOXT`), rancho, templo |
| `traps.js` | 7g | tiburón, cortadora, tortuga de la cueva |
| `bunker.js` | 7h | búnker, escotilla, estatuas, portal, caparazón con laboratorio, policías |
| `clams.js` | 7i | fumigador y conchas |
| `progress.js` | 7j | cuentas, XP, pase hasta el 100, accesorios, camos, chicles (inventario y tienda) |
| `gums.js` | 7k | chicleras y efectos de los chicles |
| `barriers.js` | 7l | ventanas y trampillas con tablas |
| `plantboss.js` | 7m | la planta jefa del templo |
| `beast.js` | 7n | la Bestia del búnker, sus crías, barriles de gasolina, escalera rota |
| `trophies.js` | 7o | trofeos de boss (al perfil), tienda ITEMS, ítem equipado en el mapa y sus efectos, placas |
| `catacombs.js` | 7p | catacumbas mayas (R23), cueva del búnker (R24), puerta de las 3 palancas (D23) |
| `kraken.js` | 7q | easter egg: pasos, arena R25 en el mar y la pelea con el Kraken, victoria |
| `ui.js` | 8 | HUD, menús, perfil, prompt |
| `mapview.js` | 8d | el mapa (tecla 5) |
| `gfx.js` | 8c | calidad, sombras, post, cielo, ciclo de luz |
| `audio.js` | 8b | audio procedural y muestras embebidas |
| `debug.js` | 8c | modo debug |
| `loop.js` | 9 | `init`, input, `gameUpdate(dt)` (el frame sin dibujar), `animate` |
| `shell.html` | — | HTML y CSS, con `@@BUNDLE@@` |

- **Scope compartido:** un archivo puede usar nombres de otro **dentro de funciones** (corren después de que todo se
  cargó). El código que corre al cargarse solo ve lo que viene antes en `ORDER`. `init()` es la última línea de `loop.js`.
- **Archivo nuevo en `src/`:** agregarlo a `ORDER` (buildcheck falla si hay un `.js` suelto).
- **Estado nuevo:** tiene que volver a cero en `resetGame()` (con su `resetX()`).
- **Nada se crea durante el juego:** todo va en pools fijos (zombies, decals, sangre, proyectiles, charcos, pedazos).

## Decisiones técnicas que no hay que deshacer
Todas tienen su porqué en `HISTORIAL-FASES.md`:
- **Arma en su propia escena y cámara** (`weaponScene`/`weaponCamera`), para que las paredes no la corten.
- **Hitscan contra `WORLD.hitMeshes` + `z.hitParts`, tomando el primer impacto:** nada atraviesa paredes.
- **Navegación:**
  - grid de celdas de 1 m en 3 niveles: piso, `UP` a 4.3 y `UP2` a 8.6;
  - un solo BFS desde el jugador cada 250 ms (flow field) y los zombies bajan por el gradiente;
  - las escaleras son enlaces (`NAV.link`, con recorrido `NAV.via`);
  - una celda está bloqueada si tiene un collider a menos de 0.4 m;
  - lo que se apoya contra una pared (a menos de ~0.7 m de su cara) no cambia el grid: por eso ahí van cajas, máquinas,
    barriles y el altar.
- **Hash espacial de colliders (`COLHASH`):** todo código que mueva un collider llama a `buildNavGrid()`. Abrir una puerta
  solo cambia `solid`.
- **Aim ≠ cámara:** las balas salen de `feel.aimQuat`/`feel.eye`, nunca de `camera.quaternion`. El empujón de un zombie
  es solo visual (`placeRoot`).
- **Resortes con la solución exacta** (`springStep`); nada de Euler.
- **Cadencias** (`lastShot`, `FLOW.lastCalc`): avanzan de a un paso fijo, no saltan a `now`.
- **Colliders `overhead`:** no cuentan para el piso. Los tests que recorren colliders en 2D los saltean. Los de arriba se
  filtran por nivel (`colInLayer`).
- **Límites invisibles (`addBoundary`, `mesh: null`):** frenan gente, no balas. Todo código que recorra colliders tolera
  `c.mesh === null`.
- **Niebla permanente:** `camera.far` va atado a la niebla, y `scene.background` es el mismo objeto que `scene.fog.color`
  (nunca reemplazarlo).
- **Lo que cubre mucho mapa se dibuja por celdas** (`ChunkMB`, `InstancedMesh` por celda): el frustum descarta lo lejano.

## Reglas de diseño de Diego
- **Velocidad:** ningún enemigo va más rápido que el jugador caminando (`PLAYER.speed` 4.4; `speedCap` lo recorta).
  Excepciones aprobadas: perros y crías de la Bestia a 4.7, y la Bestia a 5.0.
- **Bosses:**
  - insta-kill no les hace el daño completo;
  - las trampas no los tocan;
  - no cruzan el portal;
  - los que viven en `state.zombies` bloquean el fin de la ronda (la Bestia dormida y la planta jefa, no).
- **Puntos:** 10 por impacto, 60 por kill y 130 por headshot. El doble puntos pasa solo por `addPoints`, y los gastos
  solo por `spendPoints`.
- **Balance base:**
  - vida del zombie: 150 + 100 × (n − 1) hasta la R10, después ×1.1 por ronda;
  - cantidad: 6 + 2n;
  - vivos a la vez: 8, y desde la R8 uno más por ronda.
- **`CONFIG.DEBUG_MODE`:** va en `true` solo en desarrollo (buildcheck avisa; desde F8 está en `false` y
  `tools/sim/harness.js` lo prende para los tests). Teclas:
  - `P` +5000 · `]`/`[` ronda · `N` noclip · `K` perros · `J` boss · `B` grid · `H` overlay · `X` cuenta dev;
  - `L` te tira a la pelea del Kraken con el equipo de dios (con la Ola Rompiente en lugar de la LEVIATHAN) y 5× de vida
    hasta que termina la partida;
  - **`O` desbloquea todo:** puertas, energía, generadores, almas, PaP, búnker y cabeza del calamar, más el equipo de
    dios (Perkaholic, Ray Gun y LEVIATHAN con PaP, langostinos y escudo).

## Qué hay en el juego (resumen; el detalle está en `HISTORIAL-FASES.md`)
- **Mapa:**
  - casa de 7 cuartos; arrancás en el garaje;
  - playa, muelle y embarcadero de 2 pisos;
  - jardines con plantas carnívoras;
  - rancho con tortugario;
  - templo con la planta jefa y el Pack-a-Punch. F5.28d: tormenta siempre (oscuridad de zona, relámpagos con trueno y
    lluvia más cerrada: `CONFIG.TEMPLE.storm`);
  - claro con el caparazón de tortuga gigante (laboratorio de 3 niveles);
  - **catacumbas mayas** (R23, bajo tierra a −6, reemplazan el sendero de H6): laberinto con plantas carnívoras, 3
    salidas al templo tras la puerta D23 (3 palancas), y un pasillo con el Sombrerón muerto hacia la **cueva** (R24) con
    Speed Cola, chiclera, ballesta, las estatuas y **la entrada del búnker**; escalera de la cueva al costado del templo;
  - búnker bajo el mar (la Bestia). **F5.28c:** muy oscuro y sin ninguna luz que se prenda (`BUNKER.dark`: pintura `paint`,
    zona `zd`); las antorchas de F5.28b se sacaron;
  - playa del calamar con la cabeza del calamar gigante;
  - portal templo ↔ calamar (inmediato).
- **Puertas:**
  - la casa (D1–D8, sin D5, D9 ni D10) y las rejas D11 a D17;
  - D19, el portón que abre la energía;
  - el lazo D20, la barricada D21 del caparazón y la baranda D22 del embarcadero;
  - D23, la puerta sellada de las catacumbas (no se compra: 3 palancas);
  - las lianas que se queman: H2, H6 y H8.
  - `map.js` verifica con Dijkstra que ninguna puerta abarate otra zona.
- **Enemigos:**
  - zombies en 3 pasos (caminar, trotar, correr) y con variantes; el negro explota;
  - ahogados, arrastrados, perros infernales, calamares que se fusionan y el calamar gigante;
  - bosses: Sombrerón, Calamarón, planta jefa y la Bestia.
  - **La Bestia (F5.28), estilo el Lich de Hora de Aventura:** cráneo gigante con cuernos, cerebro a la vista, ojos
    verdes y carne abierta. **F5.28b:** se arrastra como pulpo (cuerpo bajo, 12 tentáculos abiertos en el piso que
    reptan en ola, `LIMB_A`/`setLimb`), a escala `BEAST.scale` 1.45 (solo dibujo y cajas de tiro; el radio de choque no
    cambia). **F5.28c:** tentáculos del doble de largo y más gruesos (las cajas de tiro de las patas tienen material
    invisible), un ojo colgando en lugar del cuerno derecho (`z.eyeHang`), sangre que le chorrea de la boca
    (`buildBeastDrool`, pool fijo), sin luz propia (solo brillan los ojos), vida ×2.2 y golpes ~+20%. Ataques:
    - el tentáculo que te agarra, te arrastra y te traga: te soltás con 4 tiros o 3 cuchillazos mirándola (mismo
      esquema que la lengua de la planta). F5.28c: más grueso, cada 3.5–5.5 s, hasta 20 m, `miss` 1.8;
    - zarpazo de 4.5 m que te lanza ~13 m por el aire; ese vuelo no suma daño por caída (`DEBUG.safeFall` en
      `beastLaunch`); no arranca mientras el tentáculo te tiene;
    - latigazo en arco;
    - tentáculos del piso con aviso;
    - salto, grito, slime y crías.
- **Armas:** unas 24 con PaP (nombres propios), accesorios y camos por arma, la Ola Rompiente (wonder weapon por
  quest), granadas, langostino, escudo y cuchillo, machete o garras. **Sin lanzallamas** (F5.28: su código del cono
  queda sin ninguna arma que lo use).
- **Sistemas:**
  - perks con last stand;
  - chicles (clásicos por nivel, raros con KRAKEN INK). F5.28d: 10 nuevos: NIGHT EYES, DEAD AIM, SCAVENGER,
    HALF-PRICE PERK, STICKY FINGERS (clásicos, niveles 22–46) y BONE ARMOR, AMMO FOUNTAIN, WONDERBAR, KILLING TIME, KRAKEN'S
    WRATH (tinta). La tienda de tinta tiene un tambor 3D en cubos (`GDRUM` en ui.js, renderer aparte como `WPREV`);
  - KRAKEN INK (F5.28d): 1 cada 3 niveles (el 100 da 5) y 3% al comprar puertas, lianas o la caja, más los trofeos;
  - conchas de colores;
  - trampas y barricadas;
  - trofeos de boss: van al perfil y se cambian en la tienda **ITEMS** por ítems (garras, bombas de slime, talismán,
    cría, armadura, serenata). Se equipa 1 por partida; aparece desde el inicio en su lugar fijo del mapa y se gasta al
    agarrarlo (F5.28; ya no hay Altar);
  - pase hasta el nivel 100 (solo XP doble, camos y tinta), placas y camos de boss;
  - cuentas locales;
  - mapa con niebla de guerra (bajo tierra, "sin señal"; las catacumbas no se dibujan);
  - F5.28e: HUD de golpes (una esquina de sangre pixelada por golpe, contorno que late con vida crítica), pantalla de
    carga con `WALLPAPER.jpg` al empezar, muerte en primera persona comido por el que te mató y después negro con
    "loading...", y la caja misteriosa que después del primer lugar va a cualquiera (hasta el muelle).
- **Quests:**
  - **2 cajas de almas + 4 generadores → Pack-a-Punch** (bajo las raíces de la planta jefa hasta matarla).
  - **4 plantas con 6 arrastrados cada una → la caracola brilla** en la cabeza del calamar (R13). Es una de las 3 piezas
    de la Ola, junto con el coco dorado (concha morada) y la cuerda (Sombrerón).
  - Las 2 estatuas con 5 kills cerca y después de comer → se abre el búnker.
  - **Easter egg del Kraken (F5.29):** semilla de la planta jefa → Bestia → teletransportador del búnker → pruebas del
    caparazón → Sombrerón en la cápsula → cebo (calma: sin zombies y de día morado) → pared de agua de la cabeza del
    calamar → un muelle en C en medio del mar que rodea al Kraken, de noche con tormenta (F5.29b–e). El Kraken es el calamar gigante de la playa
    ×10.5 con un ojo que brilla. Pelea en 3 fases (tentáculos sólidos, algunos con herida; cañones de arpones al ojo, que
    se abre por ventanas; 4 huevos de calamar de 2 Sombrerones, el Calamarón y la Bestia, atados a la Ola en una mesa y
    disparados a la boca; si erra, vuelven los 4), con tentáculos del piso, ahogados y un boss del mar por cada fase
    cumplida o paso fallado; ganar: cinemática (agonía con líquido negro, pedazos, tentáculos y rayos que rompen el muelle;
    el remolino y un portal cúbico morado que queda mar adentro; el tablón con flashbacks), restos, cielo morado y azul y
    un huevo de calamar como trofeo en el perfil. Armar (escudo, Ola, la mesa) tiene animación de martillo y no deja caminar;
    el tiempo o el bote te sacan; morir es game over. Sin pistas en el juego.
- **Gráficos:** todo en cubos (F5.25: las primitivas curvas del `MeshBuilder` hacen cubos), calidad Bajo/Medio/Alto,
  sombras solo en Alto, ciclo de luz por ronda y desmembramiento. F5.28f: corrección de color (`GRADE`, una pasada
  de post; el arma se dibuja después) con el revelado de Diego en `CONFIG.GFX.grade` (temperatura 48, contraste 26,
  luces −64...; sin grano ni viñeta: Diego no los quiere), mar oscuro en cubos, playa con cadáveres, tiburón y ojo de calamar, techo
  maya del templo con agujeros, hiedra en cubos.
- **Audio:** procedural más las muestras de Diego, 3D y pasos por superficie. Las músicas de confirmación (cajas de almas
  llenas, plantas completas) están embebidas y activas.

## Herramientas y tests
- **Tests headless:** `npm --prefix tools/sim test` (53 archivos; la suite entera tarda 1.5–2 h). Cargan el juego real en Node sin dibujar
  (`harness.js`).
  - Correrlos **siempre** después de tocar WORLD, ZOMBIES o ROUNDS; los de cada fase están en su sección del historial.
  - El harness apaga los perros, los bosses, las barricadas y la planta jefa: el test de cada sistema los prende.
  - `f5xx.js` = la fase (p. ej. `f526.js`: la Bestia, los trofeos y el pase).
- **Capturas sin navegador:** `node tools/shots.js vistas.json [carpeta]`. Cada vista:
  `{ name, x, y, z, look, open, fog, round, menu, panel, eval }`.
- **Soak:** `node tools/sim/soak.js [partidas] [minutos] [semilla] [escenario]` juega partidas enteras con un bot y
  reporta trabas, fugas y frames lentos (unos 20 min; correrlo en segundo plano).
- `tools/play.js` (bot en Chrome con FPS) y `tools/prof.js` (perfil del JS del frame).

## Pendiente y riesgos
- **Nunca medido en una GPU real:** los FPS después de pasar todo a cubos (F5.25) y las sombras en Alto (~1100 meshes).
- **Balance P9** nunca hecho: jugar hasta la R20; revisar los precios de los ítems y la dificultad de la Bestia.
- **Para publicar:**
  - renombrar marcas de Activision (Pack-a-Punch, Juggernog, Quick Revive, Speed Cola, Double Tap, Stamin-Up, Mule Kick,
    Perkaholic, Ray Gun, GobbleGum);
  - revisar las licencias de los sonidos;
  - `index.html` pesa 43 MB (la subida web de GitHub admite hasta 25 MB).
- Viejos: zig-zag en diagonales largas; la visibilidad del spawn se mira al elegirlo; Chrome rechaza el re-lock ~1 s.
