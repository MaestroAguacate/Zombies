# Diseño del Mapa 2: YALUW

> Estado: **diseño**, nada implementado. Lo marcado **PROPUESTA** todavía lo decide Diego. Los textos visibles del juego
> van en inglés; este documento, en español.
>
> **Pedido de Diego (textual):** "Necesito que empecemos a diseñar la segunda cancha. Que sea una cueva enorme, con
> diferentes áreas, que una sea con flora y fauna morada alienígena, muy al estilo de las plantas de noche de Avatar, la
> otra que sea toda medio de lava con un hoyo en medio en el que uno puede bajar con cuidado por unas escaleras. Aquí hay
> hongos brillantes, celestes y morados. Charcos verdosos."
>
> **Decisiones de Diego (ya cerradas):**
> 1. Se juega **igual que la playa**: perks, caja, Pack-a-Punch, chicles, rondas y puertas que se compran.
> 2. La flora y la fauna alienígenas son **decoración**. Los enemigos nuevos se hablan después (ver 4.9, pendiente).
> 3. La lava **quema** si la pisás. Si caés al vacío del hoyo, **morís**.
> 4. Al hoyo se baja **en espiral**, por una rampa angosta pegada a la pared. En las paredes del pozo hay **huecos que son
>    túneles** a otras zonas: **el pozo es el nudo central del mapa**.
> 5. El mapa se llama **YALUW** y ocupa el lugar de **CITY** en el menú de mapas.
> 6. Estética de **"viaje al centro de la Tierra"**: cavernas colosales, estratos de roca a la vista, cristales gigantes,
>    ríos de lava, un mar subterráneo, hongos gigantes, columnas naturales, un "cielo" de estalactitas, restos de
>    exploradores y luz que sube desde el fondo. Cada zona con una identidad fuerte, y el descenso en espiral como corazón
>    del mapa.

---

## 0. Diagnóstico de impacto (leer antes que nada)

- **Es el cambio más grande del proyecto.** El juego está escrito para un mapa: hay unos 280 usos de ids de cuarto de
  la playa (`'R10'`, `'R20'`…) en `config.js` (88), `world.js` (145), `theme.js` (17), `audio.js`, `enemies.js`,
  `bunker.js`, `catacombs.js`, `garden.js`, `zombies.js`, `quest.js` y `souls.js`. Además, la casa está armada **en
  código** (`buildMap()`, con `addWall` a mano), no en datos.
- **Se reusa entero:** jugador, armas, PaP, zombies (pool, flow field, IA), rondas, economía (`state.doors`,
  `CONFIG.WALLBUYS`), perks, caja, chicles, tablas, power-ups, progreso, HUD y el **terreno por celdas de las
  catacumbas** (`catacombs.js`: rectángulos y rampas, paredes invisibles automáticas y luz pintada). **Técnicamente,
  YALUW son unas catacumbas colosales.**
- **El límite técnico que define el diseño:** el grid de navegación tiene 3 niveles **planos** (0, `UP` a 4.3 y `UP2` a
  8.6). Solo el nivel 0 tiene piso de altura variable (`groundY`: así funcionan el búnker, la pileta y las catacumbas).
  Toda YALUW va en el nivel 0. La regla de oro es que **dos lugares caminables nunca comparten el mismo (x, z)**.
  - Una espiral común (todas las vueltas al mismo radio) se pisa a sí misma, y un túnel que sale de una vuelta baja
    pasaría por debajo de la vuelta de arriba. Las dos cosas son imposibles en este grid.
  - **La solución (sección 2.4): el pozo es un embudo.** Cada vuelta va más adentro que la anterior. La vuelta de afuera
    tiene los túneles hacia afuera y la de adentro tiene el puente hacia el centro. Así nada se superpone.
  - Hacer que los niveles 1 y 2 tengan altura variable (para permitir más vueltas) cambiaría jugador, zombies y flow
    field a la vez. **No lo recomiendo.**
- **Dos cambios de motor nuevos, chicos pero delicados:**
  - **Paredes "solo para zombies"** en los bordes del vacío y de la lava. Sin ellas, el empuje entre zombies (multitud)
    los tira al pozo, y no habría forma de que el jugador se caiga sin que se caigan ellos.
  - **Muerte por caída al vacío.**
- **Lo que no corre en YALUW:** mar de la playa, ahogados, calamares, calamar gigante, cabeza del calamar, tiburón,
  conchas, lluvia, ciclo de sol por ronda, relámpagos y faroles de la casa. Se apagan en este mapa; no se borran.
- **Elección del mapa:** al cargar la página (`?map=yaluw`); el botón del menú recarga. Cambiar de mapa sin recargar
  (desarmar la escena) es un riesgo enorme en este código, donde todo se crea una vez en `init()`.

---

## 1. Concepto y ambiente

**YALUW** (subtítulo del menú: *"The deeper you go, the brighter it burns."*)

**Historia (para carteles, el menú y notas en el mapa):** debajo de la isla hay una sima que baja hasta un mar de magma.
En 1864, una expedición la bajó con cuerdas, andamios y una balsa, y nunca volvió. Hoy, un equipo científico bajó en
un ascensor minero, que se cayó, y su campamento quedó abandonado al borde del abismo. Alrededor de la sima, la tierra
se abre en mundos distintos: un bosque que brilla como la noche de otro planeta, un mar subterráneo con hongos del tamaño
de árboles, una geoda de cristales gigantes y un salón de ríos de lava. En el centro, colgado sobre el vacío, late
**el Corazón**: una columna de cristal que sube desde el magma y alumbra todo desde abajo.

**La regla de diseño de todo el mapa: cuanto más bajás, más luz.** Arriba (el campamento) es oscuro, frío y gris.
Cada nivel del pozo es más cálido y más brillante. En el fondo, el cristal celeste y el magma naranja se cruzan. El
jugador nunca necesita un cartel para saber que lo importante está abajo.

| Zona | Nivel (y) | Identidad | Luz dominante |
|---|---|---|---|
| BASE CAMP | 0 | campamento científico abandonado, el ascensor caído | faroles de mina amarillos, débiles |
| STRATA GALLERY | 0 → −6 | grieta con estratos de colores y fósiles gigantes | luz fría, rebotada |
| GLOWING GROVE | −6 | bosque alienígena, la noche de Pandora | morado, magenta y celeste, desde las plantas |
| ROOT FALLS | −6 → −12 | cascada entre raíces que brillan | celeste del agua |
| MIRROR SEA | −12 | mar subterráneo, bosque de hongos gigantes, columnas de basalto, la balsa de 1864 | hongos celestes y morados, charcos verdes, aurora en el techo |
| CRYSTAL GEODE | −12 → −18 | geoda con vigas de cristal gigantes (estilo Naica) | blanco y lila desde adentro de los cristales |
| MAGMA HALL | −18 | ríos y cascadas de lava, obsidiana, el puente de hierro de la expedición | naranja desde abajo |
| THE MAW (el pozo) | 0 → −34 | la sima: rampa en espiral, andamios de 1864, huecos a cada zona | sube desde el fondo: más cálida cuanto más bajás |
| THE HEART | −34 | plataforma colgada sobre el abismo, la columna de cristal, el PaP | celeste del cristal y naranja del magma |

---

## 2. Plano

### 2.1 Convenciones
- Coordenadas propias del mapa (cada partida carga un solo mapa). **El centro del pozo es (0, 0).**
- x = este (+) / oeste (−); z = norte (+) / sur (−); y = altura del piso.
- Ángulo θ alrededor del pozo: 0° = este (+x), 90° = norte (+z), 180° = oeste, 270° = sur.
- Metros enteros en los rectángulos (las paredes van por celdas de 1 m, como `CONFIG.CATA.rects`).
- Bounding box: x −120..68, z −110..110 → grid de ~188 × 220 celdas (la playa usa 200 × 206: entra).
- Ids de cuarto nuevos, `Y*`, que nunca chocan con los `R*` de la playa.

### 2.2 Esquema general: la rueda
El pozo es el eje. Cada zona está en una dirección y a una profundidad distinta, y se une al pozo por un **rayo**
(túnel recto que sale de la pared del pozo). Además, las zonas vecinas se unen por afuera (la **llanta**): siempre hay
dos caminos a cada zona, por el pozo o por afuera.

```
                                   N (z +)
                 +---------------------------------------+
            110  |                                       |
                 |      Y3  GLOWING GROVE  (y -6)        |
                 |   árboles abanico · plantas que se    |
                 |   cierran · semillas · cielo de       |
     Y4 ROOT     |   estalactitas con luciérnagas        |
     FALLS       |                                       |   Y2 STRATA GALLERY
   +----+    C4==+                                       +==C3==+-------------+
   |cas-|        |                                       |      |  y -6 -> 0  |
   |cada|     40 +------------------+ +------------------+      |  fósiles    |
   |    |                           | |  rayo N (y -6)          |  estratos   |
 35+----+--------------+            | |                         +-----+  +----+
   |                   |       .----+-+----.                          |C2|
   |  Y5 MIRROR SEA    |     .'   THE MAW    '.                 +-----+--+----+
   |  (y -12)          |    /  rampa 1: r21-24 \                |  Y1 BASE    |
 W |  mar · hongos     +===|=== rayo O         |=== rayo E ==C1=|  CAMP (y 0) |  E (x +)
   |  gigantes ·       |   |   rampa 2: r15-18 |    (y 0)       | INICIO      |
   |  basalto · balsa  |    \   Y9 HEART       /                +-------------+
   |                   |     '.  (y -34)   .'                   x 44       68
-35+-+-----+-----------+       '----+-+----'
     |pasa-|C5                      | |  rayo S (y -18)
     |je   |                -40 +---+-+------------------------------+
   +-+-----+--------+           |                                    |
   | Y6 CRYSTAL     +===========+   Y7 MAGMA HALL  (y -18)           |
   | GEODE          | -12 -> -18|   ríos de lava · cascadas ·        |
   | (x -75..-45,   |           |   obsidiana · puente de 1864 ·     |
   |  z -75..-45)   |           |   bomba geotérmica (ENERGÍA)       |
   +----------------+      -110 +------------------------------------+
                                  x -35                           35
                                   S (z -)
```

### 2.3 Áreas

| Id | Nombre (juego) | Rect / forma | Piso y | Techo | Contenido |
|---|---|---|---|---|---|
| Y1 | BASE CAMP | x 44..68, z −11..11 (24 × 22) | 0 | 7 | **Arranque.** Carpas, el ascensor caído (jaula de barras), rieles, vagonetas, mesa con mapas, generador diésel. Empalizada con tablas |
| Y1t | (rayo E) | x 24..44, z −2..2 | 0 | 4.5 | Túnel del campamento al borde del pozo, con un codo de andamio |
| Y2 | STRATA GALLERY | x 52..58, z 11..45 (rampa 0 → −6 en z 20..40) + x 35..58, z 45..51 | 0 → −6 | 10 | Grieta alta y angosta: estratos de colores a la vista, amonites y un esqueleto gigante en la pared, cuerdas de 1864 |
| Y3 | GLOWING GROVE | x −35..35, z 40..110 (70 × 70) | −6 | 30 | El bosque alienígena (3.4). Una laguna que brilla y un árbol madre en el centro (x 0, z 80) |
| Y3t | (rayo N) | x −2..2, z 24..40 | −6 | 5 | Boca del pozo, a nivel del bosque |
| Y4 | ROOT FALLS | x −60..−35, z 50..56 + x −66..−60, z 35..56 (rampa −6 → −12) | −6 → −12 | 12 | Cascada que cae entre raíces que brillan; el agua corre al mar |
| Y5 | MIRROR SEA | x −120..−40, z −35..35; agua en x −120..−82 | −12 | 35 | Mar subterráneo con orilla de arena negra, **bosque de hongos gigantes**, calzada de columnas de basalto que entra al agua, la balsa y el campamento de 1864, el esqueleto de un ictiosaurio. Charcos verdes |
| Y5t | (rayo O) | x −40..−24, z −2..2 | −12 | 5 | Boca del pozo, a nivel del mar |
| Y5c | CAUSEWAY | x −100..−82, z −4..4 | −12 | — | Calzada de basalto hasta un islote (x −106..−96, z −8..8) |
| Y6 | CRYSTAL GEODE | x −75..−45, z −75..−45 (30 × 30) + pasos x −64..−58, z −45..−35 (desde el mar) y x −45..−35, z −64..−58 (al magma) | −12 → −18 | 20 | Geoda gigante: vigas de cristal de 1–2 m de grueso y 10–20 m de largo que se cruzan en diagonal; el piso, lleno de cristales |
| Y7 | MAGMA HALL | x −35..35, z −110..−40 (70 × 70) | −18 | 25 | Dos ríos de lava con puentes de basalto, 2 cascadas de lava, costra de obsidiana, el **puente de hierro de 1864** sobre el río, la bomba geotérmica |
| Y7t | (rayo S) | x −2..2, z −40..−24 | −18 | 5 | Boca del pozo, a nivel del magma |
| Y8 | THE MAW | embudo alrededor de (0, 0) (2.4) | 0 → −34 | 36 sobre el borde | La sima: 2 vueltas de rampa, andamios y una cúpula de estalactitas arriba |
| Y9 | THE HEART | anillo r 4..9 alrededor de (0, 0) | −34 | abierto | La plataforma alrededor de la columna de cristal (r < 4), colgada sobre el abismo |

Tamaños de referencia: la casa de la playa mide ~34 × 44 m. El bosque y el salón de lava (70 × 70) son como el templo
con su plancha. El pozo (48 m de diámetro y 34 m de bajada visible, más el abismo) tiene que dar vértigo: es lo más
grande del juego.

### 2.4 THE MAW: el embudo en espiral (el corazón del mapa)

```
  corte (de costado, mirando al norte)                 vista de arriba

  y 0  ==campamento==|                                        rayo N (y -6)
                     |\  rampa 1 (r 21..24)                     ||
  y -6     bosque ===| \   0° -> 330°, y 0 -> -22         .-''''''''''-.
                     |  \                               .'  .-''''''-.  '.
  y -12      mar  ===|   \                             /  .'  .--.  '.  \
                     |    \ rampa 2 (r 15..18)         |  |  ( ** )  |  |== rayo E (y 0)
  y -18   magma   ===|  |  \  345° -> 645°, -22 -> -34 |  |  '----'  |  |   campamento
                     |  |   \                          \  '.  HEART .'  /
  y -34              |  |    [puente]==[HEART]==(*)     '.  '-....-'  .'
                     |  |  vacío         columna de      '-.......-'
  y -90   ~~~~~~~~~~~~~~~~~~~~ mar de magma (solo se ve) ~~~~~~~~~~~
```

**Geometría (todo en el nivel 0, con `groundY` según el ángulo):**
- **Pared del pozo:** r = 24. Arriba del borde, la sima sigue 36 m más hasta la cúpula (y +36). Desde el borde no se
  camina: solo se llega por el rayo E, desde el campamento.
- **Rampa 1 (afuera):** anillo r 21..24 (3 m: angosta para el tamaño del pozo, pero en celdas de 1 m siempre quedan
  2 celdas libres para los zombies). Va de θ 0° a 330° bajando de y 0 a y −22 (`y = −θ / 15`). Largo ≈ 2π·22.5·330/360
  ≈ 130 m, con 17% de pendiente; se dibuja como escalones de 0.25 m.
- **Las 4 bocas** (los huecos de la pared son los rayos): θ 0° (y 0, el campamento), **θ 90° (y −6, el bosque)**,
  **θ 180° (y −12, el mar)** y **θ 270° (y −18, el magma)**. Cada boca es un descanso plano de 4 × 4 m pegado a la pared.
- **Descanso de cambio:** de θ 330° a 345°, un pasaje radial plano a y −22, de r 24 a r 15, por un puente natural sobre
  el hueco r 18..21.
- **Rampa 2 (adentro):** anillo r 15..18. Va de θ 345° a 645° (= 285°) bajando de y −22 a y −34. Largo ≈ 90 m (13%).
  No tiene bocas hacia afuera (pasarían por debajo de la rampa 1): **es el tramo más expuesto**, con vacío a los dos
  lados en partes.
- **Puente del Corazón:** en θ 285°, de r 15 a r 9, a y −34, 3 m de ancho. Es la única entrada al Corazón.
- **THE HEART:** anillo r 4..9 a y −34. La columna de cristal (r < 4) es sólida: frena balas y gente.
- **Vacío:** r 18..21 (entre rampas), r 9..15 (alrededor del Corazón) y todo lo que está debajo. El fondo visible es
  el mar de magma a y −90.
- **¿Por qué no se superpone nada?** Las rampas son anillos distintos (21..24 y 15..18), los rayos salen de r 24 hacia
  afuera y el puente va de r 15 hacia adentro. Rampa 1 y rampa 2 no comparten ángulos con el mismo radio. Hay que
  agregar un test que recorra todas las celdas caminables y verifique que cada (x, z) tiene una sola altura (por
  construcción ya es así, porque `groundY` es una función).

**Recorrido:** bajar todo caminando son ~220 m (~50 s). No hace falta hacerlo seguido: cada zona tiene su boca, así que
el pozo funciona como **autopista entre zonas** y la bajada completa es un viaje que se hace pocas veces, hasta el
Corazón.

**Subir rápido desde el Corazón (PROPUESTA):** la **corriente de aire caliente**. Un círculo marcado en el borde del
Corazón te lanza por el aire hasta el descanso de la rampa 1 (θ 330°), con el vuelo del zarpazo de la Bestia
(`beastLaunch` con `DEBUG.safeFall`: aterrizaje sin daño), con enfriamiento. Sin esto, el Corazón es una trampa mortal
en rondas altas (una sola salida, 220 m de rampa).

### 2.5 Bordes: el vacío mata, la lava quema
- **Bordes del vacío** (el lado de adentro de las rampas, el puente y el Corazón): sin baranda. Hay un **labio de
  piedras de 0.25 m** que se ve pero no frena a nadie, y una **pared invisible solo para zombies** (motor, 5.4). El
  jugador se puede caer; los zombies, no.
- **Caer al vacío = morir.** Si el jugador baja de y −40 en una celda de vacío, se termina la partida: fundido a negro
  con el brillo del magma subiendo y un grito que se aleja, y después la pantalla de muerte de siempre. Ver la pregunta
  sobre Quick Revive en la sección 7.
- **Nada empuja al jugador al vacío sin querer:** el empujón de los zombies ya es solo visual (`placeRoot`), y el
  zarpazo de la Bestia no existe en este mapa. Cualquier efecto futuro que mueva al jugador tiene que mirar el vacío.
  También hay que revisar el retroceso de explosiones, si existe.
- **Lava:** las celdas de lava **se pueden pisar** (no tienen collider para el jugador), están hundidas 0.3 m y **queman**
  (`CONFIG.YALUW.lava.dps`, PROPUESTA: 30 de vida por segundo, más una pantalla naranja y un sonido de chisporroteo). No
  matan de un golpe, pero quedarse adentro sí. Para los zombies no son celdas del grid y tienen pared solo para zombies
  alrededor: **nunca entran**.
- **Charcos verdes:** frenan como el slime de `garden.js` (PROPUESTA: sin daño; es el contraste "seguro" de la lava).

### 2.6 Puertas, obstáculos y costos
Igual que la playa: arranque chico, dos salidas baratas, áreas grandes más caras, y **ningún camino abarata otro** (el
Dijkstra de `map.js`, corrido para YALUW, lo verifica).

| Id | Dónde | Qué es (juego) | Costo |
|---|---|---|---|
| C1 | campamento → rayo E (el borde del pozo) | `Clear rubble` (derrumbe) | 750 |
| C2 | campamento → STRATA GALLERY | `Open mine gate` (reja de mina) | 1000 |
| C3 | STRATA → bosque | `Cut glowing vines` (las lianas alienígenas se retraen) | 1250 |
| S1 | rampa 1, θ ≈ 45° (entre la boca del campamento y la del bosque) | `Clear the ledge` (rocas caídas sobre la rampa) | 1500 |
| C4 | bosque → ROOT FALLS | `Cut roots` | 1500 |
| S2 | rampa 1, θ ≈ 135° (bosque → mar) | `Repair scaffold` (andamio de 1864 roto) | 1500 |
| C5 | mar → CRYSTAL GEODE | `Break crystals` (cristales que tapan el paso) | 1500 |
| S3 | rampa 1, θ ≈ 225° (mar → magma) | `Clear the ledge` | 1500 |
| S4 | descanso de cambio, θ 330° (la rampa 2 y el Corazón) | portón de hierro de la expedición | 0: **lo abre la energía** (como D19) |

**Verificación de costos:**
- Bosque: por STRATA, 1000 + 1250 = 2250; por el pozo, 750 + 1500 = 2250. Iguales.
- Mar: por ROOT FALLS, 2250 + 1500 = 3750; por el pozo, 2250 + 1500 = 3750. Iguales.
- Magma: por la geoda, 3750 + 1500 = 5250; por el pozo, 3750 + 1500 = 5250. Iguales (de la geoda al magma no hay puerta).
- Las bocas del pozo (los descansos) no tienen puerta: lo que se compra es el tramo de rampa.
- Abrir todo: 10 500 de puertas (la playa entera cuesta bastante más).

### 2.7 Dónde arranca el jugador
`START: { room: 'Y1', x: 60, z: 0, yaw: hacia el oeste }`. Arrancás de espaldas al ascensor caído, mirando el túnel del
derrumbe C1. Por el túnel se ve un brillo naranja que sube del pozo: es la invitación a ir para allá.

---

## 3. Dirección de arte en cubos

### 3.1 Reglas generales
- **"Viaje al centro de la Tierra": escala.** Lo caminable es angosto (rampas de 3 m, túneles de 4 m) y lo que se ve
  es enorme (el pozo de 48 m, techos de 30 m, la columna de cristal hasta la cúpula). El contraste es lo que da vértigo.
- **Estratos en todas las paredes de roca.** El color de cada cubo de pared depende de su altura: bandas de 1.5 a 3 m,
  onduladas con un ruido suave en x y z, y más cálidas cuanto más hondo. Sale gratis: es solo el color pintado al
  armar.
- **Restos de 1864 en todo el mapa** (la marca del mapa): andamios de madera pegados a la pared del pozo, cuerdas que
  cuelgan al vacío, faroles de aceite apagados, cajones con "1864", una brújula gigante tallada, un esqueleto con
  mochila en la rampa 2, la balsa en el mar y el puente de hierro sobre la lava.
- **Restos científicos modernos** (solo en el campamento y el borde): cinta amarilla, carteles, cables, focos rotos.

### 3.2 Paletas (hex)

**Estratos (de arriba hacia abajo; se repiten con variación):**
`0x2a2a30` gris pizarra · `0x3a3328` arcilla · `0x4a3a2a` ocre oscuro · `0x2e2a34` violeta pizarra · `0x5a4630` arenisca
· `0x3a2422` rojo hierro · `0x1c1a1e` basalto. Las vetas finas (0.25 m): `0x8a7a5a` cuarzo, `0xb89a55` azufre viejo.

| Zona | Base de roca | Acentos | Niebla |
|---|---|---|---|
| BASE CAMP | `0x24222a` `0x2c2a30` | lona `0x5a6a4a`, cinta `0xe8c020`, farol `0xffc27a` | `0x0c0c10` |
| STRATA GALLERY | estratos completos | fósiles `0xd8cfb4`, hueso viejo `0xb8a888` | `0x101014` |
| GLOWING GROVE | `0x140e22` `0x1c1430` | violeta `0xb04dff`, magenta `0xff4fd8`, celeste `0x3ff0ff`, turquesa `0x1fc8b0`, azul `0x4a7dff`; troncos `0x2a1f3a` con bandas `0x7a5cff`; hojas `0x5b2a9e` con borde `0xd36bff`; semillas `0xeaf8ff` / `0xa6f4ff` | `0x0b0618` |
| ROOT FALLS | `0x18202a` | agua `0x2a6a9a`, espuma `0xcfefff`, raíces `0x3a2a4a` con venas `0x5ee6ff` | `0x08121a` |
| MIRROR SEA | arena negra `0x15141a`, basalto `0x1c1a20` `0x262430` | hongos celestes `0x5ee6ff` `0x9af4ff` (motas `0xe8fdff`), hongos morados `0x9a4dff` `0xc77dff` (motas `0xf0d8ff`), tallos `0xb8b0cc`; agua `0x0a1a2a`; charcos verdes `0x3aff8a` (fondo `0x0f3a24`, borde `0x7affb0`); aurora `0x6a3aff` / `0x3affc0` | `0x07121c` |
| CRYSTAL GEODE | `0x2a2430` | cristal `0xdfe8f0` `0xc8d0ff`, núcleo lila `0xb89aff`, polvo blanco `0xf4f4ff` | `0x141420` |
| MAGMA HALL | basalto `0x1c1614` `0x2a201c` `0x3a2a22`, obsidiana `0x120e14` | lava (caliente → fría) `0xffe066` → `0xffb030` → `0xff6a14` → `0xd8300e` → costra `0x5a1a0a` → `0x2a0e08`; azufre `0xd8c840`; hierro oxidado `0x6a3a22` | `0x1e0a06` |
| THE MAW | estratos, cada vez más cálidos | brasas `0xff8a2a`, madera de 1864 `0x4a3420` | arriba `0x100c0c`, abajo `0x2a1008` |
| THE HEART | obsidiana `0x120e14` | cristal `0x6ff6ff` con núcleo `0xeaffff`, venas de magma `0xff6a14` | `0x14100e` |

### 3.3 Cómo iluminar sin luces nuevas (**nunca `scene.add(light)`**)
1. **Luz pintada en RGB.** Es `cataLight` de las catacumbas, generalizada: `yaluwLight(x, y, z)` devuelve un
   `THREE.Color` sumando faroles (amarillo), plantas (morado/celeste), hongos (su color), lava (naranja), cristal
   (celeste), charcos (verde) y **"la luz que sube"** (en el pozo, naranja que crece con la profundidad y con la cercanía
   al vacío). Cada cubo se arma con su color ya multiplicado. Las catacumbas usan un escalar: acá va por canal.
2. **MeshBasic con `vertexColors`** para todo lo pintado (no depende del sol ni de la hemisférica).
3. **Lo que brilla de verdad** (sombreros de hongos, venas de plantas, lava, cristales, semillas, brasas): MeshBasic con
   el color puro. Se ve "emisivo" sin serlo.
4. **Planos aditivos** (`AdditiveBlending`, `depthWrite: false`) con una textura de círculo difuso hecha por canvas: el
   charco de luz debajo de cada hongo grande y sobre la lava, el halo de la columna y el gran resplandor del abismo (un
   plano enorme a y −60, debajo del Corazón: **la luz que sube**).
5. **`fakeLightAdd(x, y, z, r, color, k)`** (garden.js) en cada fuente fuerte, para que los zombies se tiñan: morados en
   el bosque, naranjas en el magma y en la rampa, celestes junto al cristal. Es lo que hace que se los vea en la
   oscuridad.
6. **`voxFire`** para chorros de lava, fumarolas y brasas grandes. Hoy hay **una sola paleta** para todos los fuegos
   (`CONFIG.VOXFIRE.colors`, un solo `InstancedMesh`). Cambio chico: paleta por fuego, para el "fuego frío"
   celeste/morado de flores alienígenas en el bosque.
7. **Ambiente:** la hemisférica de siempre, baja y fija. Sin sol, sin ciclo por ronda y sin mapa de sombras en este mapa
   (no hay de dónde vengan).
8. **Latidos baratos:** variar con un seno `material.color` de cada grupo (hongos, lava, cristal). No recompila nada.

### 3.4 Zona por zona

**BASE CAMP (y 0).** Chico, gris, encerrado: que dé ganas de salir.
- Las carpas son cubos de lona inclinados.
- El ascensor caído es una jaula de barras torcidas con cables colgando del agujero del techo, por donde entra un hilo
  de luz gris (plano aditivo) que es el único "cielo" del mapa.
- Hay un generador diésel con un farol que parpadea, cajones, catres, una mesa con mapas y fotos de la sima clavadas.
- Empalizada de tablas contra la roca, con las ventanas con tablas (4.6).
- Las paredes ya muestran los primeros estratos.

**STRATA GALLERY (0 → −6).**
- Grieta de 6 m de ancho y 10 m de alto. Las dos paredes son un corte geológico: bandas de colores de lado a lado.
- Incrustados: amonites (espirales de cubos de 1–2 m), la columna vertebral de un bicho gigante a lo largo de 15 m de
  pared y huesos sueltos en el piso.
- Las cuerdas de 1864 bajan por la rampa con estacas. Entra luz morada del bosque por el final.

**GLOWING GROVE (−6): la noche de Pandora.**
- *Techo:* 30 m. Es un **cielo de estalactitas**: cientos de estalactitas (`InstancedMesh`, 6 variantes) y entre ellas
  **luciérnagas de cueva** (puntos celestes, como las estrellas de `buildStars`) que hacen de cielo estrellado.
- *Árboles abanico:* troncos de 0.8–1.4 m y 10–18 m de alto, con bandas que brillan. Arriba, 4–7 abanicos de hojas planas
  de cubos de 0.25 m, con borde claro. Las raíces salen en arco.
  - Igual que `VOXT`: 5 variantes armadas una vez, en 2 detalles, repetidas con `InstancedMesh` por celda de 24 m.
  - ~35 árboles. En el centro, el **árbol madre** (30 m, con raíces que caen como cortinas de luz).
- *Plantas que se cierran* (tipo "helicoradian"): espirales de cubos naranja/magenta de 1.5–2.5 m. Si pasás a menos de
  3 m, se enroscan y se meten en el piso en 0.4 s, y vuelven a los 4 s.
  - ~60 en `InstancedMesh`; se animan solo las que están a menos de 15 m (como `updateVoxFire` con `near`).
  - Cada una hace un "fwip" corto.
- *Más flora:* matas de tubos con punta celeste, helechos morados, anémonas que laten y musgo luminoso en manchas que
  brilla un poco más donde pisás (PROPUESTA: un círculo aditivo que te sigue).
- *Semillas flotantes* (tipo "woodsprite"): pool fijo de ~250 cubitos que flotan con deriva. Las cercanas se acercan un
  poco al jugador.
- *Fauna (decorado, sin colisión, fuera de `hitMeshes`):*
  - polillas de luz en grupos (pool de 30);
  - 6 "lagartos abanico" que se abren como paraguas de cubos y salen volando si te acercás;
  - criaturas de 6 patas que pastan lejos y se van (4).
- *Laguna:* plano celeste translúcido con borde de plantas. Las ondas son una textura con el `offset` corriendo.
- *Columnas naturales:* 4 columnas de piso a techo, de 4–6 m de diámetro, envueltas en raíces.

**ROOT FALLS (−6 → −12).**
- Bajada al lado de una cascada de 12 m. El agua son cubos alargados en un `InstancedMesh` que caen en loop, y la espuma
  son cubos blancos que rebotan.
- Las raíces del bosque atraviesan el techo, con venas celestes. El ruido del agua tapa los pasos (audio, 4.8).

**MIRROR SEA (−12): mar subterráneo y bosque de hongos.**
- *El mar:* ocupa la mitad oeste. El horizonte se pierde en la niebla. Agua oscura con brillos pintados y ondas lentas.
  El borde es un límite invisible (`addBoundary`: frena gente, no balas).
- *Techo de 35 m con aurora* (el "cielo eléctrico" de Verne): 3–4 planos aditivos con una textura de cortina que se
  desplaza, en morado y verde.
- *Bosque de hongos gigantes* sobre la orilla:
  - 10–14 hongos de 5–9 m (tallos de cubos claros, sombreros de 3–4 capas, motas blancas y láminas oscuras abajo, con un
    círculo de luz en el piso). Celestes y morados mezclados.
  - Debajo, cientos de hongos chicos en grupos.
  - Los gigantes tienen collider de tallo (`PROPS`). **Es la zona de "los hongos brillantes, celestes y morados".**
- *Charcos verdosos* en la orilla:
  - piletas de 1–3 m con fondo oscuro, superficie verde translúcida y borde de baba en cubos chatos;
  - 2–3 burbujas por charco (pool fijo), un plano aditivo verde y `fakeLightAdd` verde.
- *La calzada de basalto:* columnas hexagonales en cubos (escalonadas, de alturas distintas, como la Calzada del
  Gigante) que entran al mar hasta un islote. En el islote, un perk (4.1).
- *1864:* la balsa encallada, una carpa de lona podrida, un fogón y el **esqueleto de un ictiosaurio** de 20 m en la
  arena.

**CRYSTAL GEODE (−12 → −18).**
- Sala de 30 × 30 m forrada de cristal. Se baja por adentro con una rampa en curva.
- Vigas de cristal gigantes (1–2 m de grueso, 10–20 m de largo) cruzan la sala en diagonal a distintas alturas. Algunas
  son paredes (colliders), otras van arriba.
- *Material:* MeshBasic opaco con un degradé pintado (claro en las puntas, lila en el centro), más una arista aditiva por
  cristal. Opaco, para no pelear con el orden de lo transparente.
- Hace calor: polvo blanco en el aire y el resplandor naranja del magma entra por el paso del este.

**MAGMA HALL (−18).**
- Sala de 70 × 70 m con techo de 25 m. Dos ríos de lava de 3–6 m de ancho la cruzan de norte a sur y desembocan en el
  vacío del pozo por la boca sur, con una **cascada de lava que cae al abismo** (desde el pozo se ve caer).
- Se cruza por 3 puentes de basalto y el **puente de hierro de 1864** (vigas oxidadas y remaches).
- Hay 2 cascadas de lava más en la pared del fondo, islas de costra negra y columnas de basalto.
- La **bomba geotérmica** (la energía) está en un islote al que se llega por el puente de hierro.

**Cómo se ve y se mueve la lava en cubos:**
- *Superficie:* textura de canvas en celdas de 8 × 8 px (`NearestFilter`, para que se vea en cubos) con manchas de los
  6 tonos, sobre MeshBasic. Se mueve **corriendo el `offset`** en la dirección del río (cero CPU, cero shaders). Encima va
  una segunda capa aditiva más lenta, con los hilos amarillos.
- *Costras flotantes:* ~60 cubos chatos oscuros (`InstancedMesh`) que bajan con el río y vuelven a salir arriba.
- *Burbujas:* pool de ~40 cubos amarillos que crecen, revientan en 3–4 cubitos y vuelven a salir.
- *Cascadas:* cubos alargados que caen en loop, con colores que se enfrían al bajar, `voxFire` en el pie y brasas.
- *Brillo:* las paredes y el techo cerca de la lava ya vienen pintados de naranja (3.3.1), con planos aditivos sobre los
  ríos y un latido de ±10% en el color.
- *Calor:* cerca de la lava, un tinte naranja suave en la pantalla (filtro CSS, como el de los chicles).

**THE MAW (0 → −34).**
- *Arriba:* la cúpula a y +36, con el cielo de estalactitas más denso del mapa. Algunas estalactitas miden 8–10 m y
  cuelgan sobre el vacío.
- *Paredes:* estratos completos, que se ven cortados por la sima. Cada boca (rayo) es un arco de piedra con la luz de
  su zona saliendo hacia el pozo: morada (bosque), celeste (mar) y naranja (magma). **Desde arriba ves los 3 colores
  escalonados:** es el mapa leído en vertical.
- *Rampa:* escalones de piedra de 0.25 m tallados en la pared, con el labio de piedras al borde. Sobre la rampa 1 hay
  tramos con andamio de 1864 (tablas, postes y cuerdas): el tramo S2 es el andamio roto que se repara.
- *La luz que sube:* el abismo (el resplandor a y −60 y el mar de magma a y −90) pinta las paredes de naranja cada vez
  más fuerte hacia abajo.
- *Brasas:* un pool de ~150 cubitos naranjas suben despacio por el centro del pozo, desde el abismo hasta la cúpula, y
  se apagan.
- Cuerdas que cuelgan al vacío desde el borde. Un esqueleto de 1864 sentado en la rampa 2, con su farol.

**THE HEART (−34).**
- La **columna de cristal** sube desde el magma (se pierde abajo en el resplandor) hasta la cúpula, pasando por el centro
  del pozo: es el eje visual del mapa y se ve desde todas las bocas.
  - 8 m de diámetro, hecha de prismas de cubos, celeste con núcleo blanco.
  - Late lento: color, más un halo aditivo que crece y se achica.
- La plataforma es de obsidiana con venas de magma. Charcos verdes en los bordes. Hongos celestes y morados creciendo
  pegados a la columna. El PaP (4.4).

### 3.5 Niebla
- Siempre: `camera.far` atado a la niebla y `scene.background === scene.fog.color`. **Nunca se reemplaza el objeto**:
  se cambia con `.setHex()` o `.lerp()`.
- **Color y distancia por zona**, con fundido de ~2 s (el esquema de `WEATHER.darkZone`). Colores en la tabla 3.2.
- **Distancias:**
  - zonas: cerca 4..6 m, lejos 32..36 m (más cerrada que la playa, que usa 6..40: ayuda al miedo y al rendimiento);
  - **pozo y Corazón: lejos 70 m**, porque tienen que verse el otro lado (48 m) y el fondo. En el pozo, la niebla es
    cálida y hacia abajo se funde con el resplandor: el abismo "brilla" aunque el magma esté más allá de la niebla.

---

## 4. Dónde va cada sistema (se juega igual que la playa)

### 4.1 Perks (`CONFIG.PERKS.list`: los mismos ids, otros lugares)
| Perk | Lugar | Por qué |
|---|---|---|
| QUICK REVIVE | BASE CAMP | como el garaje |
| SPEED COLA | GLOWING GROVE, al pie del árbol madre | premia abrir el norte |
| STAMIN-UP | STRATA GALLERY, en la mitad de la rampa | recompensa el camino de afuera |
| DOUBLE TAP | MIRROR SEA, en el islote de la calzada | un lugar icónico, con una sola entrada |
| JUGGERNOG | MAGMA HALL, cerca de la boca sur | el área más cara (como el muelle) |
| MULE KICK | THE HEART | premia la bajada entera |

### 4.2 Caja misteriosa (`CONFIG.BOX.spots`)
- Arranca en el **descanso del borde del pozo** (boca E, detrás de C1), como la playa arranca en R5: hay que abrir la
  primera puerta.
- Lugares: borde del pozo, campamento, bosque (2), mar, geoda, magma y el Corazón.
- El rayo de luz del cielo pasa a ser un rayo que sube hacia la cúpula (el mismo efecto). En el pozo se ve desde
  todos los niveles.

### 4.3 Armas de pared (`CONFIG.WALLBUYS`; sobre roca van en tablón propio, `post: true`)
| Arma | Lugar | Costo |
|---|---|---|
| revolver | BASE CAMP | 900 |
| smg | BASE CAMP | 1500 |
| shotgun | STRATA GALLERY | 1200 |
| rifle | GLOWING GROVE | 2000 |
| crossbow | GLOWING GROVE | 2000 |
| lmg | MIRROR SEA | 2500 |
| uzi | ROOT FALLS | 1200 |
| machete | CRYSTAL GEODE | 3000 |
| doublebarrel | MAGMA HALL | 1500 |
| bazooka | THE HEART | 3000 |

### 4.4 Energía, generadores, almas y Pack-a-Punch
- **Energía:** la **bomba geotérmica** en el islote del MAGMA HALL (se llega por el puente de hierro). Prende los perks
  y **abre S4** (el portón de la rampa 2). Cuando se prende, las cascadas de lava se ponen más brillantes y suena un
  rugido desde el fondo.
- **Generadores (4):** campamento, bosque, mar y magma. **Las claves de `state.generators` son nombres fijos**
  (`muelle`, `caseta`, `garaje`, `piscina`): se quedan las claves y YALUW pone sus lugares, como ya se hizo en F5.16
  y F5.17.
- **Cajas de almas (2):** bosque y geoda (claves fijas `sotano` y `piscina`).
- **Pack-a-Punch:** en **THE HEART**, al pie de la columna de cristal. Con los 4 generadores y las 2 cajas llenas, la
  columna se agrieta y el PaP sale de adentro del cristal (en lugar de las raíces de la planta jefa). **Recorrido del
  mapa:** abrir la llanta o el pozo → energía en el magma → bajar la rampa 2 → el Corazón.

### 4.5 Chicleras, escudo y trampas
- **Chicleras (3):** campamento, bosque y magma.
- **Banco del escudo:** campamento. Piezas en el campamento, STRATA y el borde del pozo (3 lugares por pieza, como hoy).
- **Trampa (PROPUESTA): `LAVA GEYSER`** sobre el puente de hierro (1000, 20 s activa, 60 s de enfriamiento). Salta la
  lava y quema lo que cruza. Usa el esquema de `traps.js`: los bosses no la sienten.

### 4.6 Spawns y barricadas
- **BASE CAMP:** 4 ventanas con tablas en la empalizada (`kind: 'window'`) y 1 trampilla en el piso de tablas
  (`kind: 'hatch'`). Es la "casa" del mapa.
- **STRATA y túneles:** salen de grietas (2 por túnel).
- **Bosque:** saltan desde la espesura alienígena (ya existe: `jumpProbe`, `walkIn`, `vault`).
- **Mar:** salen del agua. Es la marca `sea` de `SPAWN_POINTS` con la animación de salida que ya existe, pero con
  zombies comunes.
- **Magma:** salen de las grietas de la costra, cerca de la lava, nunca de adentro.
- **El pozo (lo mejor del mapa):** los zombies **trepan desde el vacío** y saltan el labio de la rampa: es el mismo
  `vault` de las barricadas de afuera, con el punto de partida colgado del borde. Hay 3 por vuelta, a ángulos fijos.
- **THE HEART:** trepan por los bordes de la plataforma (4 puntos).
- En total, ~55 spawns (la playa tiene ~70).

### 4.7 Peligros (resumen)
- **Vacío:** caer = morir (2.5).
- **Lava:** quema por segundo; los zombies no entran (2.5).
- **Charcos verdes:** frenan (PROPUESTA: sin daño).
- **Rondas especiales:**
  - Las de perros siguen, pero sin noche ni relámpagos: un **temblor** (sacudón de cámara, polvo y piedritas que caen
    del techo, la niebla que se pone roja y un rugido desde el abismo).
  - Las de calamares no van en este mapa: por ahora, son rondas de perros.
  - Las rondas propias de YALUW quedan para cuando se diseñen los enemigos nuevos.

### 4.8 Audio (con lo procedural que ya existe)
- **Base:** zumbido grave de cueva y goteras (las de las catacumbas).
- **Por zona:** chirridos agudos y "fwip" de plantas en el bosque, cascada en ROOT FALLS, oleaje lento y eco largo en el
  mar, campanitas al rozar los cristales de la geoda, burbujeo y estallidos de la lava en el magma.
- **En el pozo:** el viento que sube del abismo (ruido filtrado), más fuerte cuanto más bajás.
- **Eco:** un delay corto en todo el mapa, más largo en el pozo y el mar.

### 4.9 Pendiente (no se diseña ahora)
- **Enemigos propios de YALUW** (Diego: "se habla después"). Mientras tanto, YALUW usa zombies comunes, sus variantes,
  los perros y el Sombrerón como boss, si su comportamiento no depende de la playa (revisar `boss.js`). Dejar en
  `CONFIG.YALUW` un lugar vacío para las rondas especiales y el boss.
- **Quest propia y wonder weapon de YALUW.** El cristal del Corazón es el gancho natural.
- **Fauna que reaccione más** (por ahora es solo decorado).

---

## 5. Propuesta técnica: dos mapas en un juego hecho para uno

### 5.1 Cómo se elige el mapa
- **Al cargar la página:** `index.html?map=yaluw`. En `config.js`, arriba de todo:
  `const MAP_ID = (typeof location !== 'undefined' && /[?&]map=yaluw\b/.test(location.search)) ? 'yaluw' : 'beach';`
  Sin el parámetro, la playa: todo lo de hoy (y la suite de tests) sigue igual.
- **Menú:** YALUW ocupa la tarjeta **CITY**.
  - `shell.html` línea ~717: `<div class="mapcard locked" id="mapCity">…<b>CITY</b><span>LOCKED</span>` pasa a ser
    **YALUW**, sin `locked`, con su arte (`.art.city`: la sima con el brillo naranja abajo, en CSS).
  - `ui.js` `pickMap(key)` (línea ~766) hoy deja solo `'beach'`. Con `'city'`, recarga la página con `?map=yaluw`. Con
    `'beach'`, sin el parámetro.
  - Recomiendo **no renombrar** el id `mapCity` ni la clave `'city'` (solo cambian el texto y el arte): menos cosas que
    romper.
- **Funciona con doble clic:** `file:///.../index.html?map=yaluw`.
- **Récord por mapa:** `CONFIG.HIGHSCORE_KEY + (MAP_ID === 'yaluw' ? '_yaluw' : '')`. Las cuentas (XP, pase, chicles,
  tinta, trofeos) son **compartidas**: no se tocan.
- **Tests:** `harness.js` lee `BHZ_MAP=yaluw` y define `ctx.location = { search: '?map=yaluw' }` antes de correr el
  bundle (hoy el contexto del harness no tiene `location`: por eso el `typeof`).

### 5.2 Qué asume la playa hoy (lo que encontré)
| Archivo | Qué es de la playa |
|---|---|
| `config.js` | `START` (R6), `DOORS`, `WALLBUYS`, `PERKS.list` (lugares), `BOX.spots` y `startRoom`, `GENERATORS.spots`, `SOULS.spots`, `PAP.spot`, `GUMS` (lugares), `SHIELD` (banco y piezas), `QUEST`, `BARRIERS.list`, `TRAPS`, `GARDEN`, `CATA`, `BUNKER`, `BEAST`, `SHELL`, `SQUIDHEAD`, `SQUIDBAY`, `CRASH`, `TEMPLE`, `PLANTBOSS`, `THICKET`, `JUNGLE`, `LIFEGUARD`, `RANCHO`, `CLAMS`, `TROPHIES.spots`, `PORTAL`, `HOUSE`, `WEATHER.rainRooms` y `darkBy` (ciclo de luz por ronda), `FOG` |
| `world.js` | `NAV`, `UP` y `UP2` (los límites de la playa, en constantes), `ROOMS`, `DOOR_LINKS`, `OPEN_LINKS`, `POOL`, `groundY` (pileta, búnker y `cataGround`), `openRooms` (el portal `R20`↔`R22` y `H8` `R10`↔`R19` escritos a mano), `PROPS` (muebles), `planJungle`, `SPAWN_POINTS`, **`buildMap()` (la casa con `addWall` a mano)**, `buildRoof`, `buildThicketWalls`, `buildShellWalls`, `buildPierDeckSolids`, `buildTempleShell`, `buildSquidHeadShell`, `buildSky` |
| `catacombs.js` | **un IIFE que agrega cuartos a `ROOMS` al cargarse**: corre siempre y hay que cortarlo con `MAP_ID` |
| `theme.js` | `buildTheme()`: casa, playa y muelle |
| `garden.js` | jardines, jungla (`VOXT`), rancho, templo y choque: se reusan las técnicas, no el contenido |
| `loop.js` | `init()` llama a ~35 `buildX()` de la playa; `menuCamera()` tiene coordenadas de la playa; `gameUpdate()` llama a ~40 `updateX()` |
| `rounds.js` | `resetGame()` llama a todos los `resetX()` |
| `zombies.js` | `pickSpawnPoint(sea, room)`: los spawns `sea` son para ahogados |
| `enemies.js` | ahogados, calamares, lluvia (`rainRooms`), noche y relámpagos (`updateNight`) |
| `boss.js`, `beast.js`, `plantboss.js`, `quest.js`, `traps.js`, `clams.js`, `bunker.js`, `perks.js` (`buildLanterns`) | contenido de la playa |
| `audio.js` | ambiente del mar (`SEA.z0`, olas) y zonas por id de cuarto (`'R11'`, `'C13'`) |
| `ui.js` / `shell.html` | `pickMap` (solo la playa) y la tarjeta CITY bloqueada |
| `mapview.js` | el mapa (tecla 5) de la playa: revisar qué tanto lee de `ROOMS` |
| `tools/sim/*` | 51 tests con coordenadas de la playa; `map.js` (Dijkstra) usa `DOOR_LINKS` |

### 5.3 Qué separar (con el menor cambio posible)
1. **`MAP_ID`** en `config.js` (5.1).
2. **`config-yaluw.js`** (nuevo, justo después de `config.js` en `ORDER`). Si `MAP_ID === 'yaluw'`:
   - **pisa** los campos de lugares de `CONFIG`: `START`, `DOORS`, `WALLBUYS`, la posición de cada perk de
     `PERKS.list`, `BOX.spots`, `GENERATORS.spots`, `SOULS.spots`, `PAP.spot`, `GUMS`, `SHIELD`, `BARRIERS.list`, `FOG`
     y `WEATHER`;
   - agrega `CONFIG.YALUW`: rectángulos, rampas rectas, **rampas en espiral** (centro, radios, ángulos y alturas), vacío,
     lava, agua, hongos, charcos, fuentes de luz, paleta, estratos y niebla por zona.

   Así, todo número sigue en `CONFIG` y la playa no cambia ni un byte de comportamiento. `CONFIG` es `const`, pero sus
   campos se pueden reemplazar.
3. **`world.js`:** no se reescribe. Al final de cada lista de la playa va
   `if (MAP_ID === 'yaluw') { ROOMS.length = 0; ROOMS.push(...yaluwRooms()); }`, y lo mismo con `DOOR_LINKS`,
   `OPEN_LINKS`, `SPAWN_POINTS` y `PROPS`.
   - `NAV`, `UP` y `UP2` son objetos: se pisan sus campos (`NAV.minX = ...`); `UP` y `UP2` quedan vacíos.
   - `groundY` arranca con `if (MAP_ID === 'yaluw') return yaluwGround(x, z);`.
   - `openRooms` saltea el portal y `H8` si no es la playa.
4. **`yaluw.js`** (nuevo, sección 7q): `yaluwGround`, `yaluwLight`, `buildYaluwShell` y `buildYaluw`:
   - `buildYaluwShell` arma las paredes invisibles automáticas (las de roca, para todos; las del vacío y la lava, solo
     para zombies) y los pisos y techos que frenan balas. **Es `buildCataShell` generalizado.**
   - `buildYaluw` es el dibujo, por `ChunkMB` y por zona.
   - También van `updateYaluw` (lava, semillas, brasas, plantas, latidos, mostrar y esconder por zona), `resetYaluw` y
     el chequeo de vacío y lava del jugador.
   - **Rampa nueva: tipo espiral**, con la altura según el ángulo alrededor de un centro, entre dos radios.
5. **`init()`, `gameUpdate()` y `resetGame()`:** separar lo común de lo de cada mapa:
   `if (MAP_ID === 'beach') { buildMap(); buildTheme(); buildQuest(); ... } else { buildYaluw(); }`.
   - Cada `updateX` de la playa tiene que salir solo si no se armó (muchos ya hacen `if (!X.built) return`); revisarlos
     uno por uno.
   - Los `resetX` tienen que tolerar lo que no se armó.
6. **Enemigos por mapa:** `CONFIG.ROUNDS` y `MOBS` dicen qué rondas especiales hay. En YALUW no hay ahogados ni
   calamares.
7. **Audio:** el ambiente por mapa (4.8).
8. **`menuCamera()`:** coordenadas por mapa en `CONFIG`. En YALUW, la cámara baja despacio por el pozo.
9. **`mapview.js`:** dibuja los `ROOMS` del mapa actual y los anillos del pozo. **Con 4 profundidades**, necesita un
   selector de nivel o un corte (pregunta abierta).
10. **Tests:** la suite actual queda como está (la playa por defecto). Los tests nuevos son `yaluw*.js`, con
    `BHZ_MAP=yaluw`, más `map.js` con los `DOOR_LINKS` de YALUW.

### 5.4 Cambios de motor (chicos, pero tocan sistemas viejos: suite completa después)
- **Paredes solo para zombies:** un campo nuevo en el collider (`zombieOnly: true`).
  - `moveCircle` del jugador lo ignora; el de los zombies, no.
  - `buildNavGrid` lo cuenta como bloqueo, como cualquier collider.
  - No va en `hitMeshes` (no frena balas).
  - Todo código que recorra colliders ya tolera `mesh === null`, pero hay que revisar los que asumen "sólido para
    todos" (empuje de multitud, `segmentClear`).
- **Muerte por vacío:** en `updatePlayer`, si el piso debajo es vacío y `player.pos.y < CONFIG.YALUW.voidKillY`
  (PROPUESTA: −40), corre la secuencia de muerte de 2.5 por el camino normal de game over (`rounds.js`), sin pasar por
  `fallDamage` (que nunca mata).
- **Zombies que igual caen** (un empujón de explosión, un bug): si un zombie baja de `voidKillY`, se lo desactiva sin
  puntos y cuenta como muerto para la ronda. Si no, la ronda se traba.
- **Lava:** celdas que el jugador pisa (no hay collider) pero que no están en el grid, con paredes solo para zombies
  alrededor. `groundY` en la lava da −0.3 respecto de la orilla, y `updatePlayer` aplica el daño por segundo con
  `damagePlayer`.
- **`voxFire` con paleta por fuego** (3.3.6).
- **`yaluwLight` en RGB** (3.3.1).
- **Niebla por zona con distancia variable:** `camera.far` sigue atado a la niebla. Hay que confirmar que cambiarlo en
  caliente (32 ↔ 70) no recompila nada: es un número del shader, debería ser gratis.

### 5.5 Rendimiento (presupuesto)
- **Referencia:** la playa dibuja ~0.4–1.5 M triángulos por frame; las catacumbas solas, ~185 000 (por eso se esconden
  si no estás cerca: `CATA.showDist`). Un cubo son 12 triángulos.
- **Meta de YALUW:** ≤ 0.9 M en Alto y ≤ 0.5 M en Medio, medido con `renderer.info.render.triangles` (ya suma las 2
  pasadas: overlay DRAW).

| Parte | Presupuesto visible | Cómo |
|---|---|---|
| Paredes, piso y techo cercanos | 200 k | `ChunkMB(24)`; techos y paredes lejanas en bloques de 2–4 m, no de 1 m; los estratos van en el color (gratis) |
| Bosque (árboles, plantas) | 300 k | `InstancedMesh` por celda con 2 detalles (esquema `VOXT`), con frustum y niebla |
| Estalactitas del cielo | 60 k | 6 variantes instanciadas, en 2 detalles |
| Hongos, charcos, cristales y decorado | 150 k | celdas e instancias |
| Lava, agua y cascadas | 40 k | planos con textura y ~200 instancias |
| **El pozo visto desde arriba** (niebla de 70 m) | 200 k | la pared del pozo en bloques grandes; rampas y andamios en celdas; la columna, en prismas grandes |
| Zombies, armas y efectos | lo de hoy | sin cambios |

- **Esconder por zona**, como `updateCatacombs`. Desde el pozo no se dibuja el interior de ninguna zona (solo los
  primeros metros de cada rayo, con un codo que corta la vista). Desde una zona no se dibuja el pozo más allá de su boca
  ni las otras zonas.
- **La niebla larga del pozo es el mayor riesgo:** por eso ahí todo es geometría grande y simple.
- **Nada se crea durante el juego:** semillas, brasas, burbujas, costras, polillas y cubos de agua o lava son pools
  fijos.
- **Nunca se midió en una GPU real** (CLAUDE.md): medir con `tools/play.js` en Chrome **apenas exista el pozo en gris
  (M2.1)**, no al final.

### 5.6 Plan por fases chicas (cada una termina en algo que se prueba)
| Fase | Qué | Cómo se prueba |
|---|---|---|
| M2.0 | `MAP_ID`, `config-yaluw.js` vacío, guardas en `init`, `gameUpdate` y `resetGame`, el IIFE de las catacumbas con guarda. YALUW es **una caja gris** con jugador y zombies | suite de la playa en verde (no cambió nada); `yaluw0.js` carga con `BHZ_MAP=yaluw` y juega R1–R3 sin `ReferenceError` |
| M2.1 | **El pozo en gris:** rampa en espiral, vacío, paredes solo para zombies, muerte por caída, las 4 bocas, el puente y el Corazón | `yaluw1.js`: los zombies suben y bajan las 2 rampas sin caerse con 24 vivos empujándose; el jugador que pisa el vacío muere; cada (x, z) tiene una sola altura; **primera medición de FPS en Chrome** |
| M2.2 | **El resto en gris:** las zonas, la llanta, lava, agua, puertas y costos, spawns | todos los spawns alcanzables con las puertas abiertas; Dijkstra de costos (2.6); la lava quema y los zombies no entran; capturas con `tools/shots.js` |
| M2.3 | **Sistemas:** perks, caja, armas de pared, chicleras, tablas, energía (S4), generadores, almas, el PaP en el Corazón | `perks.js`, `wallbuys.js`, `mysterybox.js`, `pap.js` y `generators.js` con `BHZ_MAP=yaluw` (parametrizar lo que haga falta) |
| M2.4 | **Arte del pozo y del Corazón** (lo primero: es la cara del mapa): estratos, luz que sube, brasas, columna de cristal, andamios | capturas desde las 4 bocas; triángulos dentro del presupuesto |
| M2.5 | Campamento y STRATA GALLERY | capturas |
| M2.6 | GLOWING GROVE y ROOT FALLS | capturas; triángulos; `prof.js` |
| M2.7 | MIRROR SEA (hongos, charcos, calzada) y CRYSTAL GEODE | capturas |
| M2.8 | MAGMA HALL (lava animada, cascadas, puente de hierro, bomba) | capturas; FPS |
| M2.9 | Audio, mapa (tecla 5), menú (tarjeta CITY → YALUW), récord por mapa | test de `audio.js`; el menú recarga con el parámetro |
| M2.10 | Soak con el bot en YALUW (que aprenda la rampa), balance, playtest de Diego | `soak.js` con escenario `yaluw` |

Después, aparte y cada una con su diagnóstico: enemigos nuevos, quest y wonder weapon, boss de YALUW.

### 5.7 Riesgos
- **Regresiones en la playa** por las guardas: cada `if (MAP_ID ...)` es un lugar donde puede romperse algo. Se cubre
  con la suite entera en verde al cerrar M2.0 (más de 1.5 h).
- **Las paredes solo para zombies** tocan colisión y grid, que son lo más delicado del juego.
- **El bot del soak** (`soak.js`) no sabe de vacíos: se va a tirar al pozo. Hay que enseñarle a no pisar celdas de vacío
  ni de lava.
- **Trampa conocida:** el `// comentario` en medio de una línea. `config-yaluw.js` va a tener cientos de números: los
  comentarios, siempre en su propia línea.
- **Nombres fijos** (`state.generators`, `state.souls`, `state.doors`…): se mantienen; solo cambian los datos.
- **Jugabilidad del pozo:** 3 m de rampa con vacío al lado y zombies trepando del borde puede ser muy difícil. Se
  regula con la cantidad de spawns del pozo y con la corriente de aire (2.4). Hay que jugarlo en gris (M2.1) antes de
  invertir en el arte.
- **Tamaño:** el código nuevo suma poco (~200–300 KB). `index.html` ya pesa 43 MB por los sonidos; el problema de la
  subida web a GitHub sigue igual.
- **Esfuerzo realista:** M2.0–M2.3 (jugable en gris) equivale a una fase grande, como F5.28e. El arte (M2.4–M2.8) es lo
  más largo: cada zona es un pedido del tamaño de las catacumbas.

---

## 6. Números propuestos (para `CONFIG.YALUW` y los campos que se pisan)
- **Áreas:** tabla 2.3.
- **Pozo:**
  - centro (0, 0) y pared r 24;
  - rampa 1: r 21..24, θ 0°→330°, y 0→−22;
  - descanso de cambio: θ 330°→345°, y −22;
  - rampa 2: r 15..18, θ 345°→645°, y −22→−34;
  - puente del Corazón: θ 285°, r 9..15, y −34;
  - Corazón: r 4..9, y −34; columna r < 4;
  - bocas: θ 0°/90°/180°/270°, y 0/−6/−12/−18;
  - muerte por debajo de y −40; mar de magma (solo dibujo) a y −90; cúpula a y +36.
- **Puertas:** C1 750, C2 1000, C3 1250, S1 1500, C4 1500, S2 1500, C5 1500, S3 1500, S4 0 (energía).
- **Lava:** 30 de vida por segundo (PROPUESTA), hundida 0.3 m. **Trampa LAVA GEYSER:** 1000, 20 s activa, 60 s de
  enfriamiento.
- **Niebla:** zonas 4..6 / 32..36 m; pozo y Corazón hasta 70 m; colores en 3.2.
- **Pools:** semillas 250, brasas 150, burbujas de lava 40, costras 60, polillas 30, cubos de cascada ~200.

---

## 7. Preguntas abiertas para Diego
1. **"Aquí hay hongos brillantes y charcos verdosos":** el diseño los pone sobre todo en el MIRROR SEA (bosque de hongos
   gigantes) y en el Corazón, y unos pocos en los túneles. ¿Era eso, o los querías en la zona de lava o del pozo?
2. **Caída al vacío con Quick Revive:** ¿muerte directa aunque tengas Quick Revive, o cuenta como una caída normal y
   revivís en el último descanso de la rampa?
3. **La corriente de aire** para subir del Corazón al descanso de la rampa 1: ¿sí o no?
4. **El mapa (tecla 5) con 4 profundidades:** ¿un selector de nivel o todo junto, con colores por profundidad?
5. **Orden:** ¿se cierra V2 (playtest, F8, tag) antes de arrancar M2.0? Recomiendo que sí: M2.0 toca `init`,
   `gameUpdate` y `resetGame`, que son el corazón del juego.
