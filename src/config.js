"use strict";

//=== 1. CONFIG ===========================================================
const CONFIG = {
  // MODO DEBUG: true SOLO EN DESARROLLO. Se apaga (false) antes de cualquier build final: habilita trucos
  // (P puntos, N noclip, [ ] rondas, O puertas, B grid, H overlay), el overlay y el cartel "DEBUG MODE"
  // (F8, cierre de V2: apagado y con tag v2-final. F5.29: prendido otra vez para desarrollar el easter egg y YALUW;
  // los tests lo prenden igual en tools/sim/harness.js)
  DEBUG_MODE: true,
  DEBUG: { points: 5000, unlockPoints: 15000, flySpeed: 9, flyFast: 2.5, devHealthMul: 4 },   // F5.19c: X = vida ×devHealthMul con barra   // O suma unlockPoints (F5.10)   // P suma points; noclip a flySpeed m/s (×flyFast con Shift)
  // F5.20 (Diego): arrancás en el garaje (antes, el porche R1). yaw -PI/2 = mirando a +x (a la puerta del pasillo)
  START: { room: 'R6', x: -10, z: 22.3, yaw: -Math.PI / 2 },
  WALL_H: 4,          // altura pared (spec)
  WALL_T: 0.4,        // grosor pared
  RAIL_H: 1.2,        // altura barandal del porche
  GRID: 1,            // celda de navegación 1x1 (spec)

  PLAYER: {
    height: 1.7, radius: 0.35,
    speed: 4.4, sprint: 7.0,
    jump: 4.2, gravity: 20,
    maxHealth: 100,
    regenDelay: 4.0,     // s sin recibir daño antes de regenerar
    regenRate: 20,       // hp/s
    hitIframe: 0.3,      // s de invulnerabilidad tras un golpe (0 = spec puro)
    // trepar muebles: caminando sube escalones hasta stepUp; en el aire (saltando) se sube a lo que tenga el
    // tope hasta climbReach por encima de los pies. Salto 0.44 + 0.55 = hasta ~1 m (mesas, sofá, cama, banco)
    stepUp: 0.3, climbReach: 0.55,
    // F5.18: agacharse (mantener C). Solo baja los ojos (y la bala) drop m: el cuerpo y las colisiones no cambian.
    // Más lento, sin sprint ni salto, y dispersión ×spreadMul
    crouch: { drop: 0.65, speedMul: 0.5, rate: 10, spreadMul: 0.75 },
    // F5.7 (reemplaza "te deja en 10" de F2.8): daño proporcional a la caída. Nada debajo de fallHeight m; de
    // ahí a fallMaxDrop (el techo, 4.3) sube parejo hasta fallMaxDmg. Del techo con 100 quedás en 40. No mata
    fallHeight: 2.0, fallMaxDrop: 4.3, fallMaxDmg: 60
  },

  // balance V1 (spec) — se usa en P3/P4
  ZOMBIE: {
    // F5.20 (Diego): variantes. beaten/shorts = chances desde la R1; horror desde `from` con `chance`; black desde la R15:
    // negro con ojos rojos, a menos de `trigger` m se infla `fuseTime` s y explota (a vos `damage`, a los zombies
    // `zombieDamage`, en `radius` m)
    variants: { beaten: 0.3, shorts: 0.2, horror: { from: 10, chance: 0.4, skin: 0x5a6a4a, shirt: 0x3a2a24 },
                black: { from: 15, chance: 0.12, color: 0x0e0e10, trigger: 1.8, fuseTime: 0.7, damage: 45, zombieDamage: 250, radius: 3.2 } },
    shellCrawl: true,      // F5.20: los que nacen adentro del caparazón son arrastrados
    // F4: hasta la ronda 10 como V1 (tope 1050); desde la 11, ×1.1 por ronda (como CoD)
    health: n => n <= 10 ? Math.min(150 + (n - 1) * 100, 1050) : Math.round(1050 * Math.pow(1.1, n - 10)),
    count:  n => 6 + n * 2,          // F4: total de la ronda sin tope (los vivos a la vez los limita ROUNDS)
    // F2.6: velocidad por tipo de paso (reemplaza la fórmula de V1 y al "Corredor" de F4). Se sortea al
    // spawnear con gaitByRound(n) y se conserva en el respawn. ±speedJitter por zombie.
    // Regla dura: NINGÚN zombie va más rápido que el jugador caminando (PLAYER.speed). Igual sí, más no.
    // run.speed * (1 + speedJitter) <= PLAYER.speed, y zombies.js recorta a PLAYER.speed igual (también
    // el empujón de separación). gaits.js lo verifica.
    // lean = inclinación hacia adelante (rad) · stride = ritmo del bob · swing = apertura de piernas ·
    // arms = pose de brazos (0 al frente, 1 hacia atrás) · bob = rebote vertical (m)
    gaits: {
      walk: { speed: 1.6, lean: 0.05, stride: 1.0, swing: 0.55, arms: 0,   bob: 0.02 },
      jog:  { speed: 2.6, lean: 0.20, stride: 1.5, swing: 0.75, arms: 0.4, bob: 0.05 },
      run:  { speed: 4.0, lean: 0.40, stride: 2.1, swing: 0.95, arms: 1,   bob: 0.08 }
    },
    speedJitter: 0.1,
    // mezcla de pasos por ronda: la primera fila con upTo >= n
    gaitByRound: [
      { upTo: 4,        mix: { walk: 1 } },
      { upTo: 5,        mix: { jog: 0.8, walk: 0.2 } },
      { upTo: 8,        mix: { jog: 1 } },
      { upTo: 11,       mix: { jog: 0.6, run: 0.4 } },
      { upTo: Infinity, mix: { run: 1 } }
    ],
    climbUpTime: 1.1,      // F2.6: s para subir una escalera de la piscina
    climbDownTime: 0.7,    //       s para bajarla (se deja caer)
    damage: 25, attackCooldown: 1.0, attackRange: 1.2,
    attackRangeOnTop: 1.9, // F5.6: con el jugador arriba de un mueble (cama 2.1 x 2.2: del borde al medio ~1.4 m + radio)

    radius: 0.30,          // colisión contra paredes
    poolSize: 24,          // = tope de zombies por ronda del spec
    repathMs: 250,         // BFS / flow field (V1: 400; V2 F0.3: 250 -> reaccionan antes al cambio de rumbo)
    directRange: 3.0,      // debajo de esto y con línea libre: persecución directa
    losCache: 0.1,         // F5.15: s que un zombie reusa su línea libre del tramo directo (costo por frame)
    stopDist: 0.75,        // no se meten dentro del jugador
    separationRadius: 0.85,
    separationForce: 2.4,
    emergeTime: 2.0,       // s saliendo del piso (F5.13: 0.7 -> 2.0, escarbando y tirando tierra)
    emergeDirt: 0.28,      // F5.13: s entre puñados de tierra mientras sale
    deathTime: 0.3,        // colapso 300ms (spec)
    spawnMinDist: 4.5,     // m mínimos al jugador para spawnear
    stuckCheck: 1.5,       // s entre chequeos de progreso
    stuckMinMove: 0.3,     // m mínimos por chequeo
    stuckStrikes: 4,       // chequeos fallidos seguidos -> respawn fuera de vista
    stuckIgnoreDist: 4.0,  // cerca del jugador no es atasco, es fila detrás de otros
    recoverRadius: 3,      // celdas para buscar grid si quedó fuera
    skinColor: 0xa9c29a,
  },

  ROUNDS: {
    spawnInterval: 1.5,  // s entre spawns (spec)
    maxAlive: 8,         // vivos simultáneos (spec)
    maxAliveFrom: 8,     // F4: desde esta ronda, +1 vivo por ronda (R8 9, R9 10...) hasta el pool (24)
    // F5.19 (Diego): al terminar una ronda suena el audio de ronda enseguida, el número cambia a los hudAt s y los
    // zombies salen a los intermission s. La R1 igual (firstDelay)
    intermission: 12,    // s de pausa entre rondas (antes 8)
    firstDelay: 12,      // s antes de la ronda 1 (antes 3)
    hudAt: 10,           // s desde el fin de la ronda hasta que cambia el número
    // F5.19b (Diego): cinemática de muerte que dura lo que la música de muerte (dur si no hay muestra). La cámara cae
    // de costado (fall s), después sube en grúa dando la vuelta al cuerpo hasta craneH m. El resumen entra a cardAt s
    // F5.28e (Diego: "que salga mi POV de cómo caigo al suelo y me empieza a comer el que me botó, oscuro y que dé miedo;
    // al terminar, pantalla negra con loading... y al menú"): fall s de caída de costado; eat s mientras el que te mató
    // (o el más cercano) se inclina y te muerde cada `bite` s (a `dist` m, inclinado `lean` rad), la imagen se oscurece
    // hasta `dark`; después LOADING.death s en negro con el resumen (ahí se resetea la partida) y al menú
    // F5.28f (Diego: "como si estuviera viendo de lado: le veo los pies a los zombies y mi charco de sangre"): tirado de
    // costado a eyeY m del piso (roll rad de giro, pitch apenas hacia abajo), mirando hacia el que te mató; los demás
    // (peekers: el que te mató y los más cercanos, uno cada peekEvery s, llegan en peekIn s) se paran alrededor en abanico
    // (fan rad entre uno y otro) inclinados `lean` sobre vos y muerden; el charco crece hasta poolR m; drips = gotas de
    // sangre que chorrean por la pantalla (tope)
    // F5.28f (Diego: "que se vaya poniendo borrosa hasta quedar en negro"): dark 0 (antes .22) y blur px al final
    death: { fall: 0.9, eat: 6.2, bite: [0.45, 0.8], dist: 1.1, lean: 0.3, dark: 0, blur: 10, search: 14,
             eyeY: 0.16, roll: 1.35, pitch: -0.22, fan: 0.5, peekers: 4, peekEvery: 0.8, peekIn: 0.7, poolR: 1.5, drips: 24 },
    boardPoints: 10,     // F5.19b: puntos por tabla reparada
    boardCap: 5,         // F5.19b: tablas que dan puntos por ronda
    spawnRetry: 0.3      // s para reintentar si no hay spawn válido fuera de vista
  },

  // F4: variantes. Ahogado: sale del mar si estás en la playa o el muelle
  DROWNED: {
    fromRound: 6, chance: 0.25,      // desde esta ronda, esta parte de los spawns con el jugador en rooms
    rooms: ['R10', 'R11'],
    minDist: 8,                      // m al jugador (no mira si lo ves: sale del agua a la vista)
    healthMul: 1.5, gait: 'jog',     // F5.9: trotan (antes caminaban)
    skinColor: 0x6f9a8e, shirtColor: 0x2f4a55,
    drips: 48, dripEvery: 0.09, dripSpeed: 0.6, dripColor: 0x9fd4e6
  },
  // Arrastrado: si las piernas se llevan esta parte de su vida y sigue vivo, se arrastra (sin
  // desmembrar: eso es F7; la pierna derecha se esconde)
  CRAWLER: { legFrac: 0.4, speed: 1.0, lift: 0.22, back: 0.85 },
  // Ronda de perros: poodles y chihuahuas blancos. De noche. Nunca más rápidos que el jugador caminando
  DOGS: {
    enabled: true,                   // el harness de tests lo apaga (enemies.js lo prende)
    firstRound: [10, 11], every: [5, 7],   // F5.19 (Diego: "perros antes de la ronda 10, no"): la primera ronda de mobs en la R10-11
    count:  n => Math.min(6 + n, 24),
    health: n => 100 + 30 * n,
    // F5.8: 4.7 fijo. EXCEPCIÓN aprobada por Diego a "nunca más rápido que el jugador caminando" (solo perros)
    speed: 4.7, speedJitter: 0,
    damage: 13, attackCooldown: 0.6, attackRange: 1.1, radius: 0.32,   // F5.7: perros infernales, más grandes
    sizes: [1, 1.25, 1.5],           // F5.8: tamaño al azar (radio y vida ×tamaño); el de F5.7 es el chico
    poolSize: 8, maxAlive: 8, spawnInterval: 1.0,
    voice: [1.8, 2.4],
    banner: 'WHO WOKE UP CHICHARITO?!', bannerTime: 4,
    night: { fade: 2.5, hemi: 0.32, hemiSky: 0x5a6f9e, hemiGround: 0x0c0c18, sun: 0.14, sunColor: 0x8fa6ff,
             fog: 0x141a2c, sky: 0x283052 },
    lightning: { time: 0.35, hemiBoost: 2.2 }
  },
  // F5.9: calamares (enemies.js). Grandes, feos, se arrastran. Más vida que los perros, más rápidos que los zombies
  // y más lentos que los perros (4.3 <= el jugador caminando). Escupen chorros de tinta en arco (daño × tamaño y
  // mancha la pantalla). Dos que se tocan se fusionan: el grande suma la vida del otro, hasta `maxFuse` fusiones
  SQUID: {
    health: n => 2 * (100 + 30 * n), speed: 4.3,
    damage: 20, attackCooldown: 1.0, attackRange: 1.3, radius: 0.4,   // radio de choque fijo (entra por las puertas)
    count: n => Math.min(6 + n, 24), poolSize: 8, maxAlive: 6, spawnInterval: 1.2,
    maxFuse: 7, grow: 0.2,                   // escala = 1 + grow × fusiones; daño de la tinta y del golpe también
    // F5.10: chorro continuo. Echa `jet` s seguidos (rate gotas/s en arco hacia vos) y descansa `rest` s. Pega
    // dps × tamaño por segundo que te toque (cada gota dps/rate, ignorando el i-frame). La mancha dura `splat` s
    // desde la última gota
    ink: { jet: 1.5, rest: 3, rate: 36, dps: 20, range: [3, 10], speed: 11, gravity: 9.8, radius: 0.3, pool: 64,
           splat: 1.2, spread: 0.05 },
    voice: [0.7, 1.0],
    banner: 'THE SQUIDS CRAWLED OUT OF THE SEA!',
    // F5.11: en las rondas con calamares (solo o mezcla) sale del mar un calamar gigante con un rugido y escupe
    // calamares a la playa: así sale la parte `share`; el resto sale de la orilla (spawns del mar). Solo del mar:
    // si la playa no se alcanza, salen de los spawns normales. Se hunde cuando ya salieron todos
    // F5.12: casi el doble de grande (5 -> 9) y más lejos, para no pisar el muelle
    giant: { x: 16, z: -46, scale: 9, rise: 3, sink: 3, share: 0.75, fly: 1.5, arc: 9,
             land: { x1: -16, x2: 16, z1: -21, z2: -8 }, minDist: 7 }
  },
  // F5.9: rondas de mobs (las que caen en DOGS.firstRound/every). 1ra perros, 2da calamares, después mezcla;
  // cada `bossEvery` (la 5ta, la 10ma...) son 4 Sombrerones normales
  MOBS: { bossEvery: 5, bosses: 4, mixedBanner: 'DOGS AND SQUIDS!', bossBanner: 'FOUR SOMBRERONES!' },
  // F5.9: el cielo por ronda (enemies.js setSky). Se oscurece de a poco de R1 a R15 (noche = la de los perros);
  // R15-R20 truenos; R21+ neblina morada; R25+ además truenos y lluvia. Rondas de mobs: noche, lluvia y rayos
  // más seguidos. La lluvia es un solo LineSegments (creado una vez) alrededor del jugador; frena en los techos
  // F7b: desmembramiento (solo zombies humanos: perros, calamares y bosses no). Pedazos de un pool fijo (`gibs`)
  // con física simple (gravedad, rebote contra el piso, frenan contra paredes) que duran `life` s.
  //  - cabeza: un headshot que mata la vuela con probabilidad `headChance` (cabeza = kill).
  //  - brazo: un golpe al brazo de `armFrac` de la vida máxima o más lo arranca (sigue vivo, sin ese brazo).
  //  - pierna: al arrastrarse (F4) la pierna sale volando.
  //  - explosivos (granada, bazooka, langostino, Ray Gun) que matan: `blast` pedazos al azar.
  // poses de muerte (al azar, con pesos): de espalda, de cara, de costado, de rodillas (más lenta: kneeTime s)
  GORE: {
    gibs: 16, life: 6, headChance: 0.7, armFrac: 0.3, blast: [1, 3],
    up: [2.5, 4.5], out: [1, 3], spin: 9, bounce: 0.3, friction: 0.7,
    explosive: ['grenade', 'bazooka', 'monkey', 'raygun'],
    poses: [['back', 0.35], ['front', 0.3], ['side', 0.2], ['knees', 0.15]], kneeTime: 0.9,
    attacks: [['swipe', 0.5], ['lunge', 0.3], ['bite', 0.2]]
  },
  // F7a: calidad (Ajustes: Bajo / Medio / Alto; dura la sesión). Sombras solo en Alto: el sol proyecta con un
  // mapa de `shadowMap` px que sigue al jugador (`shadowBox` m de lado a lado; F5.16: 50, la niebla tapa a 40); las luces de adentro, sin sombra.
  // particles: fracción de la lluvia; dust/shafts: polvo y haces de luz del tema; pixelRatio: tope.
  // post (CSS sobre el canvas, sin shaders): viñeta, color según la hora (cálido de día, frío de noche) y grano
  GFX: {
    // F5.28e: el mar (theme.js): colores del lejano y el cercano (Lambert: de noche se oscurecen), luz propia mínima, y
    // las olas en cubos: bloques de `cube` m en `rows` filas desde la orilla, altura en escalones de `step` m
    sea: { far: 0x263e3c, near: 0x2e4a48, emissive: 0x06100f, crest: 0x4a6c68, foam: 0x9a9e8e, cube: 2, rows: 12, step: 0.08 },
    // F5.28f (Diego: "no me gusta el gris de interferencia como tv vieja, se ve apagado"): la corrección de color (gfx.js
    // GRADE) es un revelado como el de Lightroom, igual en todo el mapa, con los valores de Diego (escala -100..100):
    // temp (temperatura: + cálido), tint (tono: + magenta), con (contraste), high (luces), shad (sombras), white
    // (blancos), black (negros), sat (saturación), sharp (nitidez: - suaviza) y clarity (claridad: - baja el contraste
    // local de los medios tonos). Sin grano, aberración, viñeta ni negro levantado
    grade: { temp: 48, con: 26, high: -64, shad: -12, white: -25, black: 8, tint: 12, sat: 8, sharp: -9, clarity: -9 },
    // F5.28f (rendimiento): muestras del antialiasing de la textura de la corrección (WebGL2); antes 4
    gradeSamples: 2,
    quality: 'medio',
    presets: {
      bajo:  { shadows: false, post: false, particles: 0.4, dust: false, shafts: false, pixelRatio: 1 },
      medio: { shadows: false, post: true,  particles: 1,   dust: true,  shafts: true,  pixelRatio: 1.5 },
      alto:  { shadows: true,  post: true,  particles: 1,   dust: true,  shafts: true,  pixelRatio: 2, shadowMap: 1024 }
    },
    shadowBox: 50, shadowFar: 140,
    post: { vignette: 0.55, grain: 0.06, warm: 0.14, cold: 14, contrast: 1.06 },
    // el disco del sol (atardecer, bajo al oeste) y la luna (se ve de noche, sobre el mar)
    sunDisk: { dir: [-0.85, 0.1, -0.52], size: 34, color: 0xff9a4a },
    // F5.20 (Diego): el sol hacia XZ (4, -66) y baja de elev0 (R1) a elev1 (radianes, R lastRound); después, noche
    sunPath: { dir: [4, -66], elev0: 0.5, elev1: 0.02, lastRound: 8 },
    moon: { dir: [0.35, 0.42, -0.84], size: 22, color: 0xe8ecff, from: 0.55 },
    // F5.17b: domo del cielo (sigue a la cámara, adentro de camera.far): abajo el color de la niebla, arriba este
    sky: { dayTop: 0x5a3a78, nightTop: 0x080c1e, purpleTop: 0x2a0c48 }
  },
  // F5.16: niebla permanente (Diego): no se ve de un área a la otra. `clip` = camera.far: lo que queda más lejos
  // ni se dibuja (el frustum lo descarta). El cielo no se ve: el fondo es el color de la niebla
  FOG: { near: 6, far: 40, clip: 44, min: 20, max: 90 },   // F5.16: 30 -> 40 (pedido de Diego); Ajustes: min..max
  WEATHER: {
    // F5.20 (Diego): mientras baja el sol (R1..R8) oscurece de a poco hasta 0.55 (atardecer); después se hace de noche
    // rápido (R12 = noche cerrada)
    darkBy: n => n <= 8 ? Math.max(0, (n - 1) / 7 * 0.55) : Math.min(1, 0.55 + (n - 8) * 0.1125),
    // F7a: ciclo de luz por ronda. La oscuridad k (darkBy) recorre 4 paradas de color: atardecer dorado (R1, el
    // cielo del tema), atardecer rojo (R5, k ~0.3), anochecer azul-violeta (R10, k ~0.65) y noche con luna (R15+).
    // null = el color del tema (k 0) o el de la noche de CONFIG.DOGS.night (k 1)
    palette: [
      { k: 0,    sky: null,     fog: null,     hemiSky: null,     sun: null },
      { k: 0.3,  sky: 0xe0785a, fog: 0xc88a78, hemiSky: 0xffa888, sun: 0xff7a3a },
      { k: 0.65, sky: 0x4a4a8a, fog: 0x55527a, hemiSky: 0x8a86c8, sun: 0x8a7ac8 },
      { k: 1,    sky: null,     fog: null,     hemiSky: null,     sun: null }
    ],
    thunder: [[15, 20], [25, Infinity]], purpleFrom: 21, rainFrom: 25,
    rainRooms: ['R20', 'R17'],       // F5.16: en el templo y en el claro del búnker llueve siempre (adentro del búnker no)
    thunderEvery: [8, 16], mobThunderEvery: [3, 7],     // s entre truenos (tormenta / ronda de mobs)
    // F5.10: más cerrada y más morada (Diego no la notaba con 60 m)
    purple: { fog: 0x5a2680, sky: 0x5a2a7c, hemiSky: 0x9a62d0, fogFar: 22, fade: 4 },
    // F5.19: cuartos con `dark` (el claro del caparazón): la luz baja a ×light y la niebla a ×fog, en fade s
    // F5.24 (Diego: "los cambios de luces se ven muy abruptos"): fade = s en que se asienta un resorte suave (arranca y
    // frena de a poco); antes lineal en 1.2 s
    darkZone: { light: 0.45, fog: 0.5, fade: 2.5 },
    // F5.28f (Diego: "los árboles brillan de noche; que se oscurezcan completamente"): el follaje (árboles, matas,
    // espesura) multiplica su color por night con la noche entera (NIGHT.k 1) y pierde su luz propia
    foliage: { night: 0.1 },
    // F5.28f: luces falsas (garden.js fakeLightTint): a los enemigos cerca de una antorcha, brasero o charco que brilla
    // se les suma un brillo propio del color de la luz, hasta `gain` (0..1)
    fakeLight: { gain: 0.3 },
    // F5.10: estrellas. Empiezan a verse con la oscuridad por encima de `from`
    stars: { count: 700, radius: 300, minElev: 0.12, size: 2, from: 0.25 },
    rain: { count: 500, area: 26, top: 14, speed: 20, len: 0.55, wind: 2.0, color: 0xa8b8d8, opacity: 0.45 }
  },

  // F5: El Sombrerón. Sale de la playa (o del punto abierto más lejano) en la R12 y cada 8 rondas
  BOSS: {
    enabled: true,                   // el harness de tests lo apaga (boss.js lo prende)
    name: 'EL SOMBRERÓN',
    firstRound: 12, every: 8,
    health: n => Math.round((4000 + 800 * n) * 1.3),   // F5.9: ×1.3 (Diego)
    eyeYellow: 0.20, eyeRed: 0.10,   // F5.9: debajo del 20% ojos amarillos; debajo del 10% rojos y llorosos
    hatMul: 3, hatFrac: 0.25,        // el sombrero recibe ×3; con el 25% de su vida en daño al sombrero -> fase 2
    rageFrac: 0.25,                  // debajo del 25% de vida -> fase 3 (embiste)
    gunFrac: 0.10,                   // debajo del 10% -> fase 4: minigun de cocos (sin guitarras ni embestida)
    // velocidad según la vida que le falta: speedMin con la vida llena, sube parejo hasta speedMax al llegar a
    // fastFrac y ahí se queda. Regla: nunca más rápido que PLAYER.speed (speedMax = el jugador caminando)
    speedMin: 1.6, speedMax: 4.4, fastFrac: 0.25,
    chargeSpeed: 4.4,                //   (la embestida, igual al jugador caminando)
    radius: 0.35,                    // colisión y grid: como un zombie (entra por las puertas de 2 m)
    bodyRadius: 0.6,                 // solo para que el jugador no se le meta adentro
    // F5.5c: golpe al piso (como el Margwa de Shadows of Evil), reemplaza al barrido. Si estás a menos de
    // slamRange, levanta los dos brazos slamWind s y golpea el piso: slamDamage a slamRadius de él (en su nivel,
    // con línea libre) y empujón hacia afuera. El escudo no lo para: viene del piso
    slamRange: 2.5, slamWind: 0.7, slamRadius: 3.5, slamDamage: 50, slamCooldown: 1.8, slamFx: 0.35,
    chargeDamage: 40, chargeHitRange: 1.4,   // la embestida: atropello al pasar a menos de chargeHitRange
    push: 7, pushTime: 0.3,          // empujón del golpe al piso y la embestida (m/s, s): respeta paredes
    spawn: { x: 0, z: -21 },         // playa, cerca del agua
    fogTime: 6, fogFar: 18,          // la niebla se cierra al aparecer (F5.8: y queda cerrada hasta que muere)
    spawnSlow: 2,                    // mientras vive, los zombies normales salen a la mitad de ritmo
    deathTime: 1.4,
    reward: { points: 1000, noPerkPoints: 1000 },
    voice: 0.45,
    hatFly: { up: 5, side: 2.5, spin: 9, life: 12 },
    // F5b
    // silbido: solo si estás a menos de whistleRange m y en su nivel (F5.5c: con 25 m aturdía en todo el mapa)
    whistleEvery: 12, whistleWind: 1.0, whistleRange: 8, dazeTime: 2, dazeMul: 0.5, dazeBlur: 4,
    summonCount: 4, summonEvery: 25,
    summonMax: 6,          // F5.10: invocados vivos a la vez, entre todos los bosses
    chargeEvery: 6, chargeWind: 0.7, chargeMax: 14, chargeRange: 16, stunTime: 2,
    // F5.5b: guitarras (fases 1-3). Cada guitarEvery s, si te ve con línea libre entre rangeMin y rangeMax m:
    // guitarWind s de aviso y la tira en arco apuntando a donde vas a estar. Frenan en paredes; el escudo las para
    guitarEvery: 4, guitarWind: 0.6, guitarSpeed: 18, guitarGravity: 9.8, guitarRadius: 0.45,
    guitarDamage: 30, guitarPush: 3.5, guitarPool: 6,   // empujón: guitarPush m/s durante pushTime (~1 m)
    rangeMin: 5, rangeMax: 20,
    // minigun de cocos (fase 4), mismo rango: gunSpin s de aviso, ráfaga de gunBurst s a gunRate cocos/s, pausa
    // gunCool s. Cada coco gunDamage IGNORANDO el i-frame (si no, el i-frame la limita a ~65/s y no mata).
    // Sin adelantar el tiro: correr de costado o cubrirse te salva. Mientras gira o dispara camina a gunWalkMul
    gunSpin: 1.0, gunBurst: 2.5, gunCool: 2.0, gunRate: 8, gunDamage: 10, gunSpeed: 30, gunSpread: 0.06,
    gunRadius: 0.12, gunWalkMul: 0.5, gunPool: 48,
    // F5.9: varios bosses a la vez (pool) y el Calamarón. Qué sale en la k-ésima ronda de boss (k = 0 en la R12):
    // 0 el Sombrerón, 1 el Calamarón, de ahí en más 2 Sombrerones y 1 Calamarón. Desde el 2do, cada uno sale
    // `spread` m al costado del anterior
    pool: { sombrero: 4, calamar: 1 }, spread: 3,
    schedule: k => k === 0 ? ['sombrero'] : k === 1 ? ['calamar'] : ['sombrero', 'sombrero', 'calamar'],
    calamar: {
      name: 'THE BIG SQUID', healthMul: 2,          // vida del Sombrerón ×2
      summonCount: 2,                               // F5.10: llama menos (Diego: eran demasiados)
      skin: 0x6a2a6a, suit: 0x241022,
      // con poca vida (squidFrac) lanza calamares cada squidEvery s: vuelan en arco (squidSpeed m/s horizontal) y
      // al caer explotan en un charco verde grande (acid con puddleR y puddleLife)
      squidFrac: 0.3, squidEvery: 6, squidSpeed: 10, squidGravity: 9.8, puddleR: 4, puddleLife: 5, squidPool: 3
    }
  },

  ECONOMY: {
    startPoints: 500,
    ammoCost: 500,        // recompra en la pared del arma que ya tenés = llena la reserva
    interactRange: 3      // m al borde de la puerta / al punto del wall buy para mostrar el prompt
  },
  HIGHSCORE_KEY: 'bhz_highscore',
  // F5.28e: pantallas de carga (ui.js startLoading): s con el wallpaper al empezar y s en negro después de la muerte
  LOADING: { start: 1.0, death: 2.4 },
  // F5.28e (Diego): las CATACUMBAS mayas (R23) debajo de la espesura, entre la liana H6 y el templo, y la CUEVA (R24) con la
  // entrada del búnker (src/catacombs.js). Bajo tierra, como el búnker: piso en y, techo a h m, sus x,z no se pisan con
  // nada caminable de arriba (es espesura). rects: los lugares caminables [cuarto, x1, x2, z1, z2]; ramps: los que tienen
  // piso inclinado (axis: a lo largo de qué eje sube; y1 en el comienzo, y2 al final) y quedan a cielo abierto; seps:
  // paredes a mano entre dos lugares caminables (la antesala y el hall de la puerta); door: la puerta sellada D23 (se abre
  // con las 3 palancas: levers [x, z, ry]); pillars: rocas sólidas de la cueva [x, z, medio ancho x, medio ancho z];
  // plants: plantas carnívoras [x, z] (maceta sólida, escupen ácido a menos de plantRange m con línea libre); torches:
  // antorchas [x, z, ry] (luz pintada, radio torchR); sombreron: el Sombrerón muerto sentado en la puerta de la cueva
  CATA: {
    y: -6, h: 4.4, wallTop: 2.4, zd: 1.5, bbox: [-42, 56, 40, 90],
    base: 0.07, gain: 0.85, torchR: 8.5, sun: 0.9,
    // F5.28f: lo que queda a cielo abierto (bajadas, sus muros y las portadas) se oscurece con la noche hasta `night`
    night: 0.15,
    // F5.28f (rendimiento): las catacumbas se dibujan solo con el jugador abajo o a menos de showDist m de una bajada
    showDist: 40,
    // (todo en metros enteros: las paredes van por celdas de 1 m y tienen que calzar con los lugares caminables)
    rects: [
      ['R23', 28, 33, 40, 54, 'E0'], ['R23', 22, 36, 54, 59, 'H1'], ['R23', 22, 27, 44, 54, 'C3'], ['R23', 12, 22, 55, 58, 'W1'],
      ['R23', 7, 13, 48, 62, 'J1'], ['R23', 2, 16, 43, 48, 'C1'], ['R23', 0, 7, 55, 59, 'W2'], ['R23', 8, 12, 62, 70, 'N1'],
      ['R23', 2, 30, 70, 73, 'TG'], ['R23', 0, 4, 63, 70, 'C2'], ['R23', 26, 30, 68, 70, 'D1'], ['R23', 26, 37, 62, 68, 'AC'],
      ['R20', 37, 41, 55, 73, 'HD'], ['R20', 41, 55, 56, 60, 'RA'], ['R20', 41, 55, 63, 67, 'RB'], ['R20', 41, 55, 70, 73, 'RC'],
      ['R24', -10, 0, 55, 59, 'DK'], ['R24', -41, -10, 43, 71, 'CV'], ['R24', -15, -11, 71, 89, 'K1'], ['R24', -15, 12, 85, 89, 'K2'],
      ['R24', 12, 26, 85, 89, 'K3']
    ],
    ramps: [
      { x1: 28, x2: 33, z1: 40, z2: 54, axis: 'z', y1: 0, y2: -6 },       // la bajada desde la liana H6
      { x1: 41, x2: 55, z1: 56, z2: 60, axis: 'x', y1: -6, y2: 0 },       // las 3 subidas al templo
      { x1: 41, x2: 55, z1: 63, z2: 67, axis: 'x', y1: -6, y2: 0 },
      { x1: 41, x2: 55, z1: 70, z2: 73, axis: 'x', y1: -6, y2: 0 },
      { x1: 12, x2: 26, z1: 85, z2: 89, axis: 'x', y1: -6, y2: 0 }        // la escalera de la cueva al choque (costado del templo)
    ],
    seps: [[36.75, 37.25, 62, 64], [36.75, 37.25, 67, 68]],
    door: { id: 'D23', x1: 36.8, x2: 37.2, z1: 64, z2: 67 },
    levers: [[2.3, 45.5, Math.PI / 2], [0.3, 66.5, Math.PI / 2], [24.5, 44.3, 0]], leverUse: 1.8,
    pillars: [[-30, 63, 1.8, 1.4], [-24, 50, 2.2, 1.6], [-19, 62, 1.4, 2.0], [-29, 49, 1.2, 1.2], [-16, 47, 1.3, 1.1], [-22, 56, 1.2, 1.2]],
    plants: [[15.3, 43.7], [12.3, 61.3], [29.3, 72.5], [-10.7, 46]], plantRange: 11, plantEvery: [3.5, 5.5],
    torches: [[8, 43.3, 0], [7.3, 51, Math.PI / 2], [29, 58.7, Math.PI], [35.7, 56, -Math.PI / 2], [10, 72.7, Math.PI], [22, 72.7, Math.PI],
              [31, 62.3, 0], [17, 55.3, 0], [26.7, 48, -Math.PI / 2], [40.7, 60, -Math.PI / 2], [40.7, 69, -Math.PI / 2], [3.7, 66, -Math.PI / 2],
              [8.3, 66, Math.PI / 2],
              [-40.7, 49, Math.PI / 2], [-40.7, 64, Math.PI / 2], [-33, 43.3, 0], [-24, 43.3, 0], [-12, 43.3, 0], [-10.3, 64, -Math.PI / 2],
              [-22, 70.7, Math.PI], [-35, 70.7, Math.PI], [-14.7, 79, Math.PI / 2], [0, 88.7, Math.PI], [-11.3, 80, -Math.PI / 2],
              [-24, 51.95, 0], [-30, 64.75, 0], [-20.75, 62, -Math.PI / 2]],
    drips: [[9, 46], [18, 56.5], [31, 57], [4, 72], [24, 71.5], [28, 65], [10, 52], [-20, 66], [-35, 60], [-15, 55], [-26, 45]],
    water: [[9.5, 45.5, 1.6], [16, 71.8, 1.4], [30.5, 56, 1.3], [-26, 60, 2.2], [-35, 67, 1.6], [-4, 57, 1.1]],
    mud: [[4.5, 45, 1.3], [10, 57, 1.5], [24.5, 49, 1.4], [-18, 68, 1.8], [-33, 45.5, 1.4], [-12, 80, 1.2]],
    sombreron: [-6, 58.35, Math.PI]
  },
  // F5.18 (pedido de Diego, como BO3): XP que se acumula entre partidas y sube de nivel; cada nivel desbloquea
  // accesorios y camuflajes para las armas. Se guarda en localStorage (`key`; se levantó la regla de "solo el récord").
  // XP para pasar del nivel n al n+1 = base + step × (n − 1). tiers: [desde nivel, nombre]
  PROGRESSION: {
    // F5.27 (Diego): hasta el nivel 100. xpCap: tope de XP por nivel (desde el 61 cada nivel pide lo mismo; los niveles de
    // antes no cambian)
    key: 'bhz_profile_v1', maxLevel: 100, base: 600, step: 90, xpCap: 6000, maxAtt: 3,
    xp: { kill: 10, headshot: 6, round: 40, boss: 500 },       // round: × la ronda que terminaste
    // F5.19 (Diego): cada arma sube de nivel con sus kills (la XP del kill va también al arma) y desbloquea SUS
    // accesorios (attachments[k].level = nivel del arma). XP para el nivel L del arma: sum(base + step × (n - 1))
    weaponLevel: { max: 20, base: 260, step: 110 },   // F5.19d: más difícil subir de nivel las armas (antes 120 / 40)
    // F5.20 (Diego): el menú de armas agrupado por tipo (lo que no esté en ninguna va en el último)
    // F5.28f (Diego: "en WEAPONS que no me deje ver ninguna arma aparte de la 1911 en el nivel 1; que se vayan
    // desbloqueando por nivel, repartidas hasta el 100"): el nivel de cuenta desde el que se ve cada arma en el menú
    // (antes sale como "?"; en la partida se pueden usar todas, como siempre)
    weaponLevels: { m1911: 1, smg: 4, shotgun: 8, rifle: 12, revolver: 16, uzi: 21, doublebarrel: 26, ak47: 31, spas: 36,
                    deagle: 41, sniper: 46, lmg: 51, marksman: 56, crossbow: 61, bow: 66, chopper: 71, farmhand: 76,
                    pigiron: 81, bazooka: 86, raygun: 91, leviathan: 95, wave: 100 },
    weaponCats: [
      { name: 'PISTOLS', ids: ['m1911', 'revolver', 'deagle'] },
      { name: 'SHOTGUNS', ids: ['shotgun', 'spas', 'doublebarrel'] },
      { name: 'SUBMACHINE GUNS', ids: ['smg', 'uzi'] },
      { name: 'ASSAULT RIFLES', ids: ['rifle', 'ak47'] },
      { name: 'LIGHT MACHINE GUNS', ids: ['lmg', 'chopper', 'pigiron', 'leviathan'] },
      { name: 'SNIPERS', ids: ['sniper', 'marksman', 'farmhand'] },
      { name: 'SPECIAL', ids: ['raygun', 'crossbow', 'bow', 'bazooka', 'wave'] }
    ],
    // F5.19: el nivel general da chicles: los clásicos por nivel, y cada `gumEvery` niveles un chicle raro o mejor
    // (un sobre de la tienda gratis); cada `inkEvery` niveles, `ink` KRAKEN INK
    // F5.19d: tinta cada 6 niveles. F5.27: sin el chicle gratis (el pase no da chicles).
    // F5.28d (Diego: "menos probable ganar kraken ink, uno cada tres niveles"): 1 cada 3 niveles, del 1 al 100
    levelUp: { inkEvery: 3, ink: 1 },
    // F5.27 (Diego: "puro battle pass de Fortnite, solo XP, camos y KRAKEN INK"): lo que da cada nivel (passRewards).
    //  - tinta: `levelUp.ink` cada `levelUp.inkEvery` niveles; el 100 da ink100 (F5.28d: ya no hay tinta en todos los
    //    niveles desde el 40);
    //  - fichas de XP doble en xp2Levels;
    //  - camos: los de `camos` con level. Los chicles CLASSIC se siguen desbloqueando por nivel, fuera del pase.
    // La ficha de XP doble se gasta sola en la próxima partida (con la primera XP que ganás) y dura esa partida.
    // `inkFrom` solo lo usa la migración de cuentas viejas (useAccount: lo cobrado antes del pase)
    pass: { inkFrom: 40, ink100: 5, xp2Levels: [5, 15, 25, 35, 45, 55, 65, 75, 85, 95] },
    tiers: [[1, 'RECRUIT'], [4, 'PRIVATE'], [8, 'CORPORAL'], [12, 'SERGEANT'], [17, 'STAFF SERGEANT'], [22, 'LIEUTENANT'],
            [28, 'CAPTAIN'], [34, 'MAJOR'], [40, 'COLONEL'], [46, 'BRIGADIER'], [51, 'GENERAL'], [55, 'COMMANDER'],
            [62, 'WARLORD'], [70, 'LEGEND'], [80, 'MYTHIC'], [90, 'IMMORTAL'], [100, 'KRAKEN']],
    // accesorios: nivel en que se desbloquean y efecto (lo aplican progress.js attDef y weapons.js)
    attachments: {
      quickdraw: { name: 'QUICKDRAW',    level: 2,  desc: 'Aim down sights 50% faster', adsTime: 0.5 },
      fastmag:   { name: 'FAST MAG',     level: 4,  desc: 'Reload 30% faster', reload: 0.7 },
      reflex:    { name: 'REFLEX SIGHT', level: 6,  desc: 'Red dot: more zoom, 30% tighter aim', adsSpread: 0.7, zoom: 8 },
      laser:     { name: 'LASER SIGHT',  level: 9,  desc: 'Hip fire 40% tighter', hipSpread: 0.6 },
      barrel:    { name: 'LONG BARREL',  level: 12, desc: '+15% damage, 15% tighter', damage: 1.15, spread: 0.85 },
      stock:     { name: 'STOCK',        level: 15, desc: 'Move faster aiming, 25% less recoil', adsMove: 0.5, recoil: 0.75 },
      // F5.18b: solo del arco
      limbs:      { name: 'LIGHT LIMBS', level: 5,  desc: 'Draw the bow 35% faster', charge: 0.65 },
      broadhead:  { name: 'BROADHEAD',   level: 10, desc: '+25% arrow damage', damage: 1.25 },
      stabilizer: { name: 'STABILIZER',  level: 16, desc: 'Arrows 50% tighter', spread: 0.5 }
    },
    // F5.18b: qué accesorios tiene sentido poner en cada arma (el resto no se ofrece). Sin entrada = los 6 de siempre
    weaponAtt: {
      m1911: ['quickdraw', 'fastmag', 'reflex', 'laser', 'barrel'], deagle: ['quickdraw', 'fastmag', 'reflex', 'laser', 'barrel'],
      revolver: ['quickdraw', 'fastmag', 'reflex', 'laser', 'barrel'], raygun: ['quickdraw', 'fastmag', 'reflex', 'laser'],
      shotgun: ['quickdraw', 'fastmag', 'laser', 'barrel', 'stock'], spas: ['quickdraw', 'fastmag', 'laser', 'barrel', 'stock'],
      doublebarrel: ['quickdraw', 'laser', 'barrel', 'stock'], sniper: ['quickdraw', 'fastmag', 'barrel', 'stock'],
      marksman: ['quickdraw', 'fastmag', 'barrel', 'stock'], farmhand: ['quickdraw', 'fastmag', 'barrel', 'stock'],
      crossbow: ['quickdraw', 'fastmag', 'laser', 'stock'], bow: ['quickdraw', 'limbs', 'broadhead', 'stabilizer'],
      bazooka: ['quickdraw', 'fastmag', 'laser']
    },
    // nombre del accesorio en un arma puntual (el efecto es el mismo)
    attAlias: { revolver: { fastmag: 'SPEED LOADER' }, shotgun: { fastmag: 'SHELL CARRIER', barrel: 'CHOKE' },
                spas: { fastmag: 'SHELL CARRIER', barrel: 'CHOKE' }, doublebarrel: { barrel: 'CHOKE' },
                crossbow: { fastmag: 'BOLT QUIVER' }, bazooka: { fastmag: 'ROCKET RACK' }, sniper: { barrel: 'SUPPRESSOR' },
                marksman: { barrel: 'SUPPRESSOR' }, farmhand: { barrel: 'SUPPRESSOR' } },
    camos: [
      { id: 'jungle',  name: 'JUNGLE',  color: 0x4a6a32, level: 3 },
      { id: 'sand',    name: 'DESERT',  color: 0xc8a868, level: 10 },
      { id: 'arctic',  name: 'ARCTIC',  color: 0xdce6ee, level: 20 },
      { id: 'crimson', name: 'CRIMSON', color: 0xa01c1c, level: 30 },
      // F5.27: los del pase hasta el 100
      { id: 'toxic',   name: 'TOXIC',      color: 0x6aff3a, level: 50 },
      { id: 'obsidian', name: 'OBSIDIAN',  color: 0x1a1420, level: 60 },
      { id: 'bloodmoon', name: 'BLOOD MOON', color: 0x6a0a14, level: 70 },
      { id: 'abyssal', name: 'ABYSSAL',    color: 0x1a3a6a, level: 80 },
      { id: 'gold',    name: 'GOLD',       color: 0xe8b830, level: 90 },
      { id: 'kraken',  name: 'KRAKEN',     color: 0x8a2ae8, level: 100 },
      // F5.26: camos de boss: se ganan matando a ese boss `kills` veces (en la cuenta, entre partidas). boss 'any' = cualquiera
      { id: 'hide',    name: 'BEAST HIDE', color: 0x3a2416, boss: 'bestia',   kills: 1 },
      { id: 'charro',  name: 'CHARRO',     color: 0x2a2630, boss: 'sombrero', kills: 5 },
      { id: 'abyss',   name: 'ABYSS',      color: 0x5a1a6a, boss: 'calamar',  kills: 5 },
      { id: 'thorn',   name: 'THORN',      color: 0x2a4a1a, boss: 'plant',    kills: 5 },
      { id: 'boneking', name: 'BONE KING', color: 0xe8dcc0, boss: 'any',      kills: 25 },
      // F5.29: el del easter egg (matar al Kraken: PROFILE.krakenSlayer)
      { id: 'kraken', name: 'KRAKEN', color: 0x6a2a9a, ee: true }
    ],
    noAtt: ['wave'],
    // F5.18b: cuentas locales (varias en la misma compu), todas en una sola clave
    accountsKey: 'bhz_accounts_v1'                                     // sin accesorios (la Ola y el lanzallamas)
  },

  POINTS: { hit: 10, kill: 60, headshotKill: 130, meleeKill: 130 },

  //--- DEFINICIONES DE ARMAS ---
  // damage       daño por bala al cuerpo
  // headshotMul  multiplicador a la cabeza
  // magSize      capacidad del cargador
  // reserveMax   munición máxima en reserva
  // fireRate     ms entre disparos
  // auto         true = mantener click dispara
  // reloadTime   ms de la animación de recarga
  // spread       dispersión en radianes (semilla del cono)
  // recoil       unidad de retroceso, escala el kick del modelo y la cámara
  // pellets      balas por disparo
  // recoilReturn s de vuelta de la mira (opcional; sin él = FEEL.recoilReturn). Más alto = acumula más en ráfaga
  // fireShake    trauma por disparo (opcional; sin él = daño*pellets*FEEL.fireShakePerDamage). Las
  //              automáticas lo necesitan: con la fórmula la LMG satura el shake en 3 disparos
  WEAPONS: {
    m1911: {
      id:'m1911', name:'M1911', papName:'GRAVE WHISPER',
      damage:40, headshotMul:2, magSize:8, reserveMax:80,
      fireRate:300, auto:false, reloadTime:1400,
      range:120, spread:0.004, recoil:1.0, pellets:1, reloadAnim:'pistol',
      model:'pistol', bodyColor:0x30343c, gripColor:0x6b4526,
      // F5.19c (Diego): la pistola inicial con PaP se vuelve DOS (una en cada mano, disparan alternadas: cargador ×2 y
      // papFireRate) y cada bala explota como una granada chica (papExplosive: daño + perRound×ronda, radio; sin daño propio)
      papDual: true, papFireRate: 170, papExplosive: { damage: 120, perRound: 35, radius: 2.4 },
      papDmgMul: 1.5,     // F5.19d (Diego): GRAVE WHISPER hace 1.5× más daño (bala y explosión)
      // F5.24 (Diego): mata de un tiro hasta la ronda papOneShot (a los que no son boss). Clic izquierdo = pistola
      // izquierda, clic derecho = la derecha, cada una con su cadencia papHandRate (ms); sin ADS
      papOneShot: 9, papHandRate: 260
    },
    shotgun: {
      id:'shotgun', name:'SHOTGUN', papName:'BONECRUSHER 9000',
      damage:25, headshotMul:2, magSize:6, reserveMax:48,
      fireRate:850, auto:false, reloadTime:2100,
      range:40, spread:0.05, recoil:2.4, pellets:8, recoilReturn:0.30, reloadAnim:'shells',
      model:'shotgun', bodyColor:0x2b2f35, gripColor:0x7a4e28
    },
    smg: {
      id:'smg', name:'SMG', papName:'HIVEMIND',
      damage:30, headshotMul:2, magSize:32, reserveMax:160,
      fireRate:90, auto:true, reloadTime:1900,
      range:70, spread:0.016, recoil:0.55, pellets:1, recoilReturn:0.34, fireShake:0.07,
      model:'smg', bodyColor:0x26292e, gripColor:0x1e2024
    },
    // el spec no define cadencia: automático a 130ms queda entre SMG y LMG en dps y precio
    rifle: {
      id:'rifle', name:'RIFLE', papName:'DEAD RECKONING',
      damage:55, headshotMul:2, magSize:30, reserveMax:150,
      fireRate:130, auto:true, reloadTime:2200,
      range:120, spread:0.006, recoil:0.9, pellets:1, recoilReturn:0.28, fireShake:0.10,
      model:'rifle', bodyColor:0x2e3136, gripColor:0x5a3a20
    },
    lmg: {
      id:'lmg', name:'LMG', papName:'ABYSS CHOIR',
      // F5.19d (Diego): las LMG cargan 300 balas en total (cargador + reserva), 500 con PaP (PAP.lmgCap), y pegan un poco menos
      damage:52, headshotMul:2, magSize:75, reserveMax:225, lmg:true,
      fireRate:120, auto:true, reloadTime:3800,
      range:100, spread:0.02, recoil:0.8, pellets:1, recoilReturn:0.38, fireShake:0.10, reloadAnim:'belt',
      model:'lmg', bodyColor:0x33372c, gripColor:0x4a3a28
    },
    // F5.19 (Diego): 3 LMG de la caja con mucha munición y recarga larga: dos malas y una muy buena
    // RUSTY CHOPPER: vieja y oxidada, tambor de 150, poco daño y se abre mucho; PIG IRON: pesada y lenta, retrocede
    // fuerte; LEVIATHAN: la buena, mucho daño, cadencia alta, precisa, 150 por cinta y 600 de reserva (sale menos)
    chopper: {
      id:'chopper', name:'RUSTY CHOPPER', papName:'SCRAP REAPER',
      damage:36, headshotMul:1.8, magSize:100, reserveMax:200, lmg:true,   // F5.19d: 300 en total, menos daño
      fireRate:125, auto:true, reloadTime:5600,
      range:80, spread:0.034, recoil:1.0, pellets:1, recoilReturn:0.34, fireShake:0.11, reloadAnim:'belt',
      model:'chopper', bodyColor:0x7a4a2a, gripColor:0x5a3a1e
    },
    pigiron: {
      id:'pigiron', name:'PIG IRON', papName:'IRON SOW',
      damage:50, headshotMul:1.8, magSize:75, reserveMax:225, lmg:true,    // F5.19d: 300 en total, menos daño
      fireRate:165, auto:true, reloadTime:6200,
      range:90, spread:0.026, recoil:1.5, pellets:1, recoilReturn:0.42, fireShake:0.15, reloadAnim:'belt',
      model:'pigiron', bodyColor:0x4a4a4e, gripColor:0x2a2a2c
    },
    leviathan: {
      id:'leviathan', name:'LEVIATHAN', papName:'ABYSSAL TITAN',
      // F5.19d: 300 en total, menos daño. F5.24 (Diego: "es muy buena"): daño ×0.8 (100 -> 80)
      damage:80, headshotMul:2.2, magSize:100, reserveMax:200, lmg:true,
      fireRate:85, auto:true, reloadTime:6500,
      range:130, spread:0.011, recoil:0.75, pellets:1, recoilReturn:0.32, fireShake:0.10, reloadAnim:'belt',
      model:'leviathan', bodyColor:0x1c2a30, gripColor:0x14181c, flashColor:0x6af0ff
    },
    //--- exclusivas de la mystery box ---
    // splashRadius  daño en área alrededor del impacto (pared o zombie). splashMin = fracción en el borde
    raygun: {
      id:'raygun', name:'RAY GUN', papName:'STARBLEED X9',
      damage:500, headshotMul:1, magSize:20, reserveMax:160,
      fireRate:350, auto:false, reloadTime:2600,
      range:100, spread:0.004, recoil:1.3, pellets:1, recoilReturn:0.25, fireShake:0.25,
      splashRadius:2.5, splashMin:0.5, flashColor:0x5aff6a,
      model:'raygun', bodyColor:0x9aa3ad, gripColor:0x3a3f47
    },
    sniper: {
      id:'sniper', name:'SNIPER', papName:'SILENT REQUIEM',
      damage:300, headshotMul:3, magSize:5, reserveMax:40,
      fireRate:1300, auto:false, reloadTime:3000,
      range:200, spread:0, recoil:3.0, pellets:1, recoilReturn:0.45, fireShake:0.35, adsFov:14, scope:true,   // F5.19: mira telescópica (antes adsFov 30, sin mira)
      model:'sniper', bodyColor:0x2a2d31, gripColor:0x4e3a24, penetrate: 2   // F5.19c: atraviesa (ver def.penetrate)
    },
    // F5.19c (Diego): 2 francotiradores más. MARKSMAN: 3 balas seguidas rápido y recarga; FARMHAND: uno malo (viejo, lento,
    // poco daño y mira turbia). penetrate = cuántos zombies de más atraviesa si la bala le sobra daño (y están pegados)
    marksman: {
      id:'marksman', name:'MARKSMAN', papName:'TRIPLE OMEN',
      damage:260, headshotMul:3, magSize:3, reserveMax:36,
      fireRate:260, auto:false, reloadTime:2600,
      range:200, spread:0.002, recoil:2.2, pellets:1, recoilReturn:0.3, fireShake:0.25, adsFov:18, scope:true, penetrate: 2,
      model:'marksman', bodyColor:0x30343a, gripColor:0x2a2a2e, flashColor:0xffe0a0
    },
    farmhand: {
      id:'farmhand', name:'FARMHAND', papName:'OLD YELLER',
      damage:150, headshotMul:2, magSize:4, reserveMax:24,
      fireRate:1700, auto:false, reloadTime:4200,
      range:150, spread:0.01, recoil:3.2, pellets:1, recoilReturn:0.5, fireShake:0.35, adsFov:32, scope:true, penetrate: 1,
      model:'farmhand', bodyColor:0x6a4a2a, gripColor:0x8a6a3a
    },
    // F5.28 (Diego): sin el lanzallamas. (El cono de fuego de weapons.js, def.flame, queda sin ninguna arma que lo use)
    //--- V2 F3b ---
    // reloadAnim: cómo se ve la recarga (mag = cargador, por defecto). pierce: zombies que atraviesa
    revolver: {
      id:'revolver', name:'REVOLVER', papName:'SIX FEET UNDER',
      damage:110, headshotMul:2, magSize:6, reserveMax:48,
      fireRate:400, auto:false, reloadTime:2000,
      range:120, spread:0.003, recoil:1.6, pellets:1, recoilReturn:0.30, fireShake:0.14, reloadAnim:'revolver',
      model:'revolver', bodyColor:0x3a3d44, gripColor:0x6b4526
    },
    doublebarrel: {
      id:'doublebarrel', name:'DOUBLE BARREL', papName:'CERBERUS',
      damage:45, headshotMul:2, magSize:2, reserveMax:32,
      fireRate:250, auto:false, reloadTime:2000,
      range:30, spread:0.07, recoil:3.0, pellets:10, recoilReturn:0.35, fireShake:0.30, reloadAnim:'break',
      model:'doublebarrel', bodyColor:0x2b2f35, gripColor:0x8a5a30
    },
    crossbow: {
      id:'crossbow', name:'CROSSBOW', papName:'NIGHTSTINGER',
      damage:400, headshotMul:2, magSize:1, reserveMax:24,
      fireRate:900, auto:false, reloadTime:1600,
      range:150, spread:0, recoil:1.2, pellets:1, pierce:3, recoilReturn:0.30, fireShake:0.12, reloadAnim:'bolt',
      model:'crossbow', bodyColor:0x5a4030, gripColor:0x3a2a1c
    },
    //--- V2 F5.11: armas nuevas. Todas salen en la caja; ninguna en paredes (la bazooka, además, en el búnker) ---
    uzi: {
      id:'uzi', name:'UZI', papName:'LIL RIPPER',
      damage:28, headshotMul:2, magSize:32, reserveMax:192,
      fireRate:70, auto:true, reloadTime:1700,
      range:60, spread:0.022, recoil:0.45, pellets:1, recoilReturn:0.3, fireShake:0.06,
      model:'uzi', bodyColor:0x2a2c30, gripColor:0x1a1c20
    },
    ak47: {
      id:'ak47', name:'AK-47', papName:'RED ZEPHYR',
      damage:70, headshotMul:2, magSize:30, reserveMax:180,
      fireRate:110, auto:true, reloadTime:2400,
      range:120, spread:0.012, recoil:1.1, pellets:1, recoilReturn:0.3, fireShake:0.12,
      model:'ak47', bodyColor:0x2e3034, gripColor:0x8a4a22
    },
    deagle: {
      id:'deagle', name:'DESERT EAGLE', papName:'THUNDERJAW',
      damage:180, headshotMul:2.5, magSize:7, reserveMax:56,
      fireRate:380, auto:false, reloadTime:1800,
      range:120, spread:0.004, recoil:2.2, pellets:1, recoilReturn:0.32, fireShake:0.18, reloadAnim:'pistol',
      model:'deagle', bodyColor:0x9a9ca2, gripColor:0x2a2a2e
    },
    spas: {
      id:'spas', name:'SPAS-12', papName:'MEAT GRINDER',
      damage:30, headshotMul:2, magSize:8, reserveMax:64,
      fireRate:320, auto:false, reloadTime:2600,
      range:40, spread:0.045, recoil:2.0, pellets:8, recoilReturn:0.3, fireShake:0.2, reloadAnim:'shells',
      model:'spas', bodyColor:0x1e2024, gripColor:0x2a2c30
    },
    // arco: se carga manteniendo el clic y dispara al soltar. Daño de chargeMin (toque) a damage (carga llena,
    // chargeTime s). Atraviesa pierce zombies
    bow: {
      id:'bow', name:'BOW', papName:'ECLIPSE STRING',
      damage:900, headshotMul:2, magSize:1, reserveMax:30, charge:true, chargeTime:0.9, chargeMin:0.2,
      fireRate:250, auto:false, reloadTime:600,
      range:150, spread:0, recoil:1.0, pellets:1, pierce:2, recoilReturn:0.3, fireShake:0.1, reloadAnim:'bolt',
      model:'bow', bodyColor:0x6a4a2a, gripColor:0x3a2a1c
    },
    // bazooka: cohete que vuela (rocketSpeed m/s) y explota al tocar algo: damage en el centro, radius m, cae
    // como la granada. selfDamage si te agarra la explosión
    bazooka: {
      id:'bazooka', name:'BAZOOKA', papName:'DOOMSDAY PARADE',
      damage:1600, headshotMul:1, magSize:1, reserveMax:12, rocket:true, rocketSpeed:36, radius:5, selfDamage:60,
      fireRate:900, auto:false, reloadTime:2600,
      range:150, spread:0, recoil:3.2, pellets:1, recoilReturn:0.4, fireShake:0.35, flashColor:0xffa040,
      model:'bazooka', bodyColor:0x4a5a3a, gripColor:0x2a2a22
    },
    //--- V2 F5.5: la Ola Rompiente (solo de la quest, ver CONFIG.QUEST). wave: cono de range m y ±coneDeg
    // que daña (damage) y empuja (knock m, menos en el borde) a todos los que tenga con línea libre.
    // Al Sombrerón le hace damage × bossMul (daño alto, no insta-kill) y no lo mueve
    wave: {
      id:'wave', name:'BREAKING WAVE', papName:"MARENA'S WRATH", wave:true,
      damage:2500, headshotMul:1, magSize:12, reserveMax:36,
      fireRate:900, auto:false, reloadTime:2600,
      range:12, coneDeg:40, knock:4, bossMul:0.4,          // F5.14: 8 m ±30° -> 12 m ±40°
      spread:0, recoil:2.0, pellets:1, recoilReturn:0.35, fireShake:0.3, flashColor:0x5ac8ff,
      model:'wave', bodyColor:0x2a6a9a, gripColor:0x8a5a30
    }
  },
  // V2 F3b: machete. Se compra en la pared de la cocina y reemplaza al cuchillo toda la partida (mismo
  // cooldown y alcance). 500 parejo, sin multiplicador de cabeza (el spec dice "daño 500"). El PaP no lo toca
  MACHETE: { name: 'MACHETE', cost: 3000, damage: 500, headshotMul: 1, bladeColor: 0x9aa0a6, handleColor: 0x2a1c12 },
  // V2 F3b: apuntar (ADS) con clic derecho mantenido. El cuchillo queda solo en V
  ADS: {
    baseFov: 75,          // FOV normal de la cámara del mundo
    fov: 55,              // FOV de la cámara al apuntar (sin apuntar: 75). Un arma puede traer def.adsFov (francotirador 30)
    time: 0.15,           // s para entrar / salir del todo
    spreadMul: 0.4,       // dispersión ×0.4 apuntando
    // F5.19 (Diego: la mira del francotirador casi no servía): las armas con def.scope muestran una mira telescópica a
    // pantalla completa (y esconden el arma) desde scopeAt de ADS.k. Las demás, un punto de mira al centro
    scopeAt: 0.85,
    moveMul: 0.7          // velocidad ×0.7 apuntando (y no se corre)
  },
  // Mystery box. spots: centro de la caja por cuarto, contra una pared, fuera del grid navegable
  // (profundidad 0.7 < anillo no navegable). rot = yaw; la tapa abre hacia el frente (+Z local).
  BOX: {
    cost: 950, rollTime: 4, grabTime: 8, teddyChance: 0.15,
    teddyTime: 2.2, moveTime: 2.4,
    cycleStart: 0.07, cycleEnd: 0.45,     // s entre armas: arranca rápido y frena
    // F5.11: todas las armas (menos la M1911 y la Ola), y el langostino bailarín. weights: la Ray Gun sale menos
    pool: ['shotgun', 'smg', 'rifle', 'lmg', 'raygun', 'sniper', 'crossbow', 'revolver', 'doublebarrel',
           'uzi', 'ak47', 'deagle', 'spas', 'bow', 'bazooka', 'chopper', 'pigiron', 'leviathan', 'marksman', 'farmhand', 'monkey'],   // F5.19: + 3 LMG (F5.19c: + 2 snipers)
    weights: { raygun: 0.45, leviathan: 0.4 },   // el resto pesa 1 (F5.19: la LMG buena sale menos)
    lightColor: 0xffc84a, lightIntensity: 1.8,
    beamColor: 0xa8d8ff, beamWidth: 1.4, beamHeight: 60,   // F5.17: rayo del cielo a la caja (como en Black Ops)
    size: { w: 1.6, h: 0.8, d: 0.7 },
    startRoom: 'R5',
    spots: {
      R1: { x:   5.45, z:  0,    rot: -Math.PI / 2 },     // V2 F1: el frente (z -3.45) tapaba la reja D11
      R2: { x:   7.45, z: 14,    rot: -Math.PI / 2 },
      R3: { x:  13.5,  z:  4.55, rot: 0 },
      R4: { x:   0,    z: 27.45, rot: Math.PI },
      R5: { x:  10,    z: 29.45, rot: Math.PI },
      R6: { x: -10,    z: 18.55, rot: 0 },
      R7: { x:  -4.55, z: 34,    rot: -Math.PI / 2 },
      R8: { x:  34.45, z: 14.5,  rot: -Math.PI / 2 },     // F2.8: pared este (F5.8: la pared está en x 35)
      R10:{ x: -17,    z: -4.55, rot: Math.PI },          // V2 F1: contra la cerca de la playa (F5.6: en x -12 tapaba la reja D14)
      R13:{ x:   7,    z: 30.45, rot: 0 },                // F5.11: contra la pared norte del dormitorio (el cerco norte ya no está)
      R14:{ x: -61.5,  z: 39.45, rot: Math.PI },          // V2 F5.10: rancho, contra el cerco norte (F5.13 y F5.19: corrido al oeste)
      // F5.28e (Diego: "una mystery box más variada, que después del primer lugar pueda salir en cualquier otro, hasta en
      // el muelle"): más lugares, y se muda a cualquiera (aunque ese cuarto esté cerrado todavía, como en CoD)
      R11:{ x:  -3.45, z: -46.5, rot: Math.PI / 2 },      // muelle: plataforma, borde oeste
      R12:{ x:  -8.55, z:  1.0,  rot: -Math.PI / 2 },     // jardín oeste: contra la pared oeste de la sala (por fuera)
      R16:{ x: -20,    z: -89.45, rot: 0 }                // búnker: contra la pared sur
    }
  },
  // V2 F2: stamina del sprint (antes era infinito). Stamin-Up multiplica sprintTime y la velocidad
  STAMINA: {
    sprintTime: 4,        // s de sprint con la barra llena
    rechargeTime: 3,      // s para recargarla entera
    delay: 0.3,           // s sin correr antes de empezar a recargar
    minToSprint: 0.3      // si se vació, no volvés a correr hasta tener esto (evita correr-parar-correr)
  },
  // V2 F2: power = palanca del generador del sótano (prop 'generador' de R7). Prende perks y luces.
  // NO habilita el Pack-a-Punch (eso son los generadores y las cajas de almas de F2.5)
  POWER: { lampMul: 1.8 },   // F5.28f (Diego: "que alumbren más"): antes 1.35   // las 6 lámparas pasan a 'steady' y un 35% más fuertes
  // F5.20 (Diego): la casa está oscura hasta que prendés la energía (sus lámparas apagadas y la luz general baja a
  // `dark` como en el claro, pero más fuerte). Cada cuarto con lámpara tiene un farol colgado: F lo prende y alumbra su
  // cuarto `time` s (prende la lámpara de ese cuarto; con el farol, la oscuridad baja a `litDark`). Ninguna luz nueva
  // F5.28f (Diego: "que alumbren como lámparas y no el cuarto siguiente"): el farol ya no baja la oscuridad (se sacó
  // litDark): prende la lámpara del cuarto con alcance lanternDist m (antes 14, atravesaba las paredes) y ×lanternMul
  // (F5.28f: + C4, el paso de la cocina al dormitorio: sin él, al cruzarlo se aclaraba todo)
  // F5.28f (Diego: "que las lámparas alumbren más"): lanternDist 6.5 → 8, lanternMul 2.4 → 4.2. Luz por las puertas de
  // afuera abiertas (perks.js DOORLIGHT): una franja de doorLightLen m en el piso (opacidad doorLightOpacity) y, a menos
  // de doorReach m de la puerta, la oscuridad baja hasta ×(1 − doorLight); de noche queda (1 − doorNight)
  HOUSE: { rooms: ['R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R9', 'C4'], dark: 1.35, lanternDist: 8, lanternMul: 4.2, time: 120, lanternOff: 0.7, reach: 2.4,
    doorLightLen: 3.2, doorLightOpacity: 0.32, doorReach: 6, doorLight: 0.5, doorNight: 0.85,
    // F5.20: la gotera del garaje (x = cara de adentro de la pared oeste, z donde estaba la ventana) y lo tirado por la casa
    goo: { x: -15.78, z: 20.6,
      decor: [[-6.3, 15.8, 0.4, 'shell'], [-2.5, 9, 1.2, 'bones'], [12, 12.6, 2.1, 'bones'], [2.9, 21.5, 0.8, 'shell'],
              [15, 21.2, 2.6, 'bones'], [6.2, 19.6, 1.7, 'shell'], [-7, 26.2, 0.3, 'bones'], [-14.6, 38.3, 1.9, 'shell'],
              [-6.5, 32.6, 2.8, 'bones'], [22.5, 21.2, 1.1, 'shell'], [-12.3, 29.2, 0.6, 'shell']] } },
  // V2 F2: perks. Máquina contra la pared, dentro del anillo no navegable (no cambia el grid). Máx 4.
  PERKS: {
    max: 4,
    size: { w: 1.0, h: 2.0, d: 0.7 },
    jingleDist: 8,        // m: jingle al acercarse (una vez por visita). F5.28e: con o sin energía, y a 8 m (antes 4)
    list: {
      // F5.20: Quick Revive en el garaje, donde arrancás (pared oeste, entre la trampilla y la ventana)
      revive: { name: 'QUICK REVIVE', abbr: 'QR', cost: 500,  room: 'R6',  x: -15.45, z: 23.5, rot:  Math.PI / 2, color: 0x4aa8ff },
      // F5.8: en el techo (level 1), sobre la sala, contra la baranda norte
      jugg:   { name: 'JUGGERNOG',    abbr: 'JG', cost: 2500, room: 'R11', x: 0, z: -49.4, rot: 0,     color: 0xd8322a },   // F5.16: al final del muelle (un solo acceso)
      // F5.13: rancho. F5.28e (Diego): en la cueva de las catacumbas, contra la pared sur
      speed:  { name: 'SPEED COLA',   abbr: 'SC', cost: 3000, room: 'R24', x: -30, z: 43.55, rot: 0,           color: 0x3ac85a, y: -6 },
      // F5.22 (Diego): arriba del embarcadero, contra la baranda oeste del muelle largo (antes, en la orilla)
      dtap:   { name: 'DOUBLE TAP',   abbr: 'DT', cost: 2000, room: 'R19', x: -61.45, z: -40.5, rot:  Math.PI / 2, color: 0xe8a22a, level: 1 },
      stamin: { name: 'STAMIN-UP',    abbr: 'SU', cost: 2000, room: 'R21', x: -56.3, z: 93.5, rot: Math.PI, level: 1, color: 0xe8d24a },   // F5.17b: en el entrepiso del caparazón   // F5.17: adentro del caparazón, lado oeste  // F5.16: estación de policía
      // F5.11: Mule Kick (3 armas) en el búnker, contra la pared oeste (y = piso del búnker)
      mule:   { name: 'MULE KICK',    abbr: 'MK', cost: 4000, room: 'R16', x: -37.55, z: -78, rot:  Math.PI / 2, color: 0x4aa84a, y: -8 }
    },
    juggHealth: 250,      // vida máxima con Juggernog
    drinkTime: 3,         // F5.19c: s que dura tomarse el perk (sin disparar)
    speedReload: 0.5,     // Speed Cola: tiempo de recarga ×0.5
    dtapRate: 1.33,       // Double Tap: cadencia ×1.33 ...
    dtapDamage: 1.33,     //             ... y daño ×1.33
    staminSpeed: 1.2,     // Stamin-Up: sprint ×1.2 ...
    staminTime: 2,        //            ... y stamina ×2 (8 s)
    reviveUses: 3,        // Quick Revive (solo, como Black Ops): se compra 3 veces por partida y desaparece
    reviveIframe: 2,      // s de invulnerabilidad al revivir
    // F5.18 (pedido de Diego, como Black Ops): con Quick Revive, el golpe letal te deja `time` s tirado: pantalla gris,
    // te arrastrás a speedMul, con la Ray Gun (y la munición llena), invulnerable, y los zombies se alejan hasta flee m.
    // Después te parás con la vida llena y tus armas de vuelta
    lastStand: { time: 10, speedMul: 0.25, drop: 1.2, flee: 16, weapon: 'raygun' }
  },
  // V2 F3a: escudo. 3 piezas (cada una sorteada en 1 de sus 3 lugares por partida), se arma en el banco del
  // garaje (prop 'banco') manteniendo F. En la espalda bloquea de atrás; equipado (tecla 3) de frente y clic
  // = empujón. Al romperse se vuelve a sacar del banco sin piezas. Piezas sin collider: no tocan el grid.
  SHIELD: {
    // F5.13: el banco de armado subió al techo (pasarela sobre la sala, donde estaba Juggernog). Antes era el
    // prop 'banco' del garaje (que queda como mueble)
    // F5.16: el techo ya no se camina: el banco vuelve al garaje, contra la pared sur (el prop 'banco' queda de mueble)
    bench: { room: 'R6', level: 0, x: -10, z: 18.45, rot: 0, y: 0, w: 1.8, h: 0.95, d: 0.75 },
    durability: 500,      // daño que absorbe (20 golpes de 25)
    blockAngle: 60,       // grados a cada lado: de frente equipado, de espaldas en la espalda
    craftTime: 3,         // s manteniendo F en el banco
    bashDamage: 100, bashRange: 2, bashAngle: 60, bashKnock: 2, bashCooldown: 0.8,
    raiseTime: 0.32,      // F5.24: s que tarda en subir a la cara al ponerlo de frente
    parts: {
      door:   { name: 'CUPBOARD DOOR', spots: [
        { room: 'R3', x: 15.5, z: 12.8 }, { room: 'R2', x: 6.5, z: 4.5 }, { room: 'R5', x: 4.5, z: 26.5 } ] },
      board:  { name: 'BROKEN SURFBOARD', spots: [
        { room: 'R6', x: -12.5, z: 18.5 }, { room: 'R10', x: -6, z: -20 }, { room: 'R1', x: 4, z: 3.5 } ] },
      handle: { name: 'METAL HANDLE', spots: [
        { room: 'R7', x: -8, z: 39.5 }, { room: 'R9', x: 16.5, z: 25 }, { room: 'R4', x: 3.5, z: 19.5 } ] }
    }
  },
  // V2 F5.5: quest de la Ola Rompiente. 3 piezas en cualquier orden: los 2 cocos (se les dispara en la
  // palmera, caen y se recogen con F), la cuerda de guitarra (la suelta El Sombrerón al morir) y la caracola
  // (granada al agua al final del muelle: sale flotando hasta el muelle). Se arma en el taller de tablas de la
  // playa manteniendo F. Queda armada: si la perdés (Quick Revive), se vuelve a sacar del taller como la dejaste
  QUEST: {
    craftTime: 3,         // s manteniendo F en el taller
    // taller: F5.6 al fondo del jardín oeste, contra la pared oeste del garaje (frente hacia -x), dentro del
    // anillo no navegable: no cambia el grid
    // F5.19 (Diego: "a un costado del caparazón"): en el claro, contra el borde este, al lado de la entrada
    workshop: { room: 'R17', x: -42.45, z: 67.5, rot: -Math.PI / 2, w: 2.4, h: 0.95, d: 0.7 },   // F5.13: contra la cerca de la playa
    // las 4 palmeras de la playa (prop = su collider en PROPS). theme.js las dibuja con estos números, cada una
    // en su grupo. Por partida se sortea UNA: un golpe de MACHETE al tronco la voltea (hacia donde se inclina,
    // en fallTime s) y deja el coco en la arena, que se pone dorado en colorTime s. El cuchillo no sirve
    palms: [
      { prop: 'palma1', x: -9.5, z: -7.5, segs: 6, broken: true,  lean: 0.9, rot: 0.3 },   // la quebrada del porche
      { prop: 'palma2', x: 11,   z: -12,  segs: 9, broken: false, lean: 0.5, rot: -2.4 },
      { prop: 'palma3', x: -16,  z: -18,  segs: 8, broken: false, lean: 0.4, rot: 0.9 },
      { prop: 'palma4', x: 13,   z: -6,   segs: 7, broken: true,  lean: 0.6, rot: 2.0 }
    ],
    palmCoco: false,                                   // F5.14: ya no: la pieza sale de la almeja morada (CONFIG.CLAMS)
    fallTime: 1.5, fallShake: 0.35,
    cocoSize: 0.26, cocoGravity: 20, cocoDrop: 1.2,    // el coco cae de cocoDrop m sobre donde quedó la copa
    cocoColor: 0x5a3e22, cocoGold: 0xffc83a, colorTime: 0.8,
    cocoArea: { x1: -19, x2: 19, z1: -22.8, z2: -5 },   // la copa puede caer al mar: el coco queda en la arena
    // F5.9: caracola sobre la tortuga bailarina del techo del sótano. Opaca hasta que plantsNeeded plantas
    // carnívoras se comieron plantEat arrastrados cada una (en el techo, a menos de GARDEN.plantKill m, una cada
    // plantEatEvery s); ahí brilla, un tiro la tira (en shellFall s, en arco) al jardín oeste y se recoge con F
    // F5.13: las estatuas se mudaron al fondo de la cabeza del calamar muerto (CONFIG.SQUIDHEAD). Suben con ella
    // F5.22: en el hueco norte de la cámara (la lengua va al este). F5.10: el doble de grande (la caracola también).
    // F5.24 (Diego): las 3 estatuas de la cabeza del calamar más chicas (2 -> 1.2)
    turtle: { x: -89.5, z: -47, scale: 1.2 },
    // F5.10: langostino bailarín al lado de la tortuga: aparece cuando las 3 cajas de almas están llenas
    shrimp: { x: -91, z: -43.5, scale: 1.2 },
    shellLand: { room: 'R22', x: -88, z: -30.2 },    // F5.13: enfrente de la boca (F5.19: la boca en z -32)
    shellFall: 1.1, shellArc: 2.5,
    plantEat: 6, plantsNeeded: 4, plantEatEvery: 1.5     // F5.11: las 4 plantas (antes 3)
  },
  // F5.11: langostino bailarín (el mono de BO). Sale de la caja con `max` cargas; tecla 4. Baila `dance` s
  // atrayendo a todos los zombies (no al boss) y explota con el daño de la granada × dmgMul en `radius` m
  // F5.12: baila 10 s y casi no rebota (bounce/friction propios, en vez de los de la granada)
  MONKEY: { name: 'DANCING SHRIMP', max: 3, dance: 10, beat: 0.25, radius: 5, dmgMul: 1.5, flyMax: 4, pool: 3,
            bounce: 0.12, friction: 9, landDamp: 0.55 },   // landDamp: velocidad horizontal que conserva por cuadro en el piso
  // F5.10: rancho de playa (R14, x -41..-27, z 18..40), detrás del lazo D20. Palapa abierta en el medio con el
  // billar; barra contra el cerco oeste; los 4 postes de la palapa son sólidos (finos: casi no cortan el grid).
  // El dibujo va en garden.js (buildRancho); los AABB acá (PROPS)
  // F5.19 (Diego: sendero del lazo más largo): rancho y tortugario otros 15 m al oeste. Rancho x -71..-57,
  // tortugario x -85..-71; el sendero del lazo va de x -57 a -27 (30 m)
  RANCHO: {
    ropeH: 1.2,                                           // lazo D20: alto de reja (se dispara por encima)
    // F5.13: todo 15 m al oeste (x -56..-42). Cerco fijo al norte (z 40), contra el que se apoyan la caja y Speed Cola
    area: { x1: -71, x2: -57, z1: 18, z2: 40 },           // F5.19: el rancho (sin el tortugario)
    palapa: { x1: -69, x2: -59, z1: 24, z2: 34, h: 4.5 },  // postes en las 4 esquinas; techo de palma arriba (F5.11: 3.2 -> 4.5)
    props: [
      { id: 'billar', box: [-65.3, -62.7, 28.3, 29.7, 0.85] },
      { id: 'barra',  box: [-69.4, -64.6, 18.3, 19.1, 1.1] },   // F5.17 (Diego): contra el cerco sur (antes tapaba la salida de la tortuga)
      { id: 'posteP1', box: [-69.15, -68.85, 23.85, 24.15, 4.5] }, { id: 'posteP2', box: [-59.15, -58.85, 23.85, 24.15, 4.5] },
      { id: 'posteP3', box: [-69.15, -68.85, 33.85, 34.15, 4.5] }, { id: 'posteP4', box: [-59.15, -58.85, 33.85, 34.15, 4.5] },
      { id: 'cueva', box: [-85, -80, 31, 39, 3.6] }     // F5.16: la cueva de la tortuga (tortugario)
    ],
    backHedge: [-71, -57, 40],                              // cerco fijo del norte del rancho [x1, x2, z] (F5.19: H2 sale del tortugario)
    // F5.16 tanda C (Diego): sin el corral chico. El tortugario es un área abierta del tamaño del rancho, al oeste
    // (parte de R14), con huesos de zombies y de tortugas, y una cueva contra el borde oeste donde se esconde la
    // única tortuga viva (la trampa sale de ahí). La cueva es sólida (PROPS 'cueva'); `mouth` = la boca
    pen: { x1: -85, x2: -71, z1: 18, z2: 40 },
    cave: { x1: -85, x2: -80, z1: 31, z2: 39, h: 3.6, mouth: { x: -79.3, z: 35 } }   // (al norte: al sur la barra tapaba la salida)
  },
  // F5.13: cabeza de calamar gigante muerto en la playa del calamar (R19), con la boca al norte. Sale del piso
  // de a poco: `minRise` en la R1 y entera en `openRound`; recién ahí se entra por la boca (túnel de 4 m) a la
  // cámara del fondo, donde están las estatuas. Antes es un montículo sólido. El cuerpo se hunde en el mar (sur)
  // F5.15: más grande y larga (16 × 24, 9 m): túnel de 5 m con techo a tunnelH, cámara con techo a chamberH
  // (entra la cabeza del langostino)
  // F5.19 (Diego): mudada al mar, al oeste (centro -88, -44), y se llega por un corredor de rocas desde el embarcadero
  // F5.21 (Diego: "más grande por dentro, que se pueda subir, bajar y todo", "cúbico todo"): la cámara ocupa casi toda
  // la cabeza (14 × 15 m, 8.2 de alto) y tiene un entrepiso en U a UP.y (deck: galerías oeste, este y del fondo; el
  // hueco del medio da a la cámara) con una escalera de cartílago que sube al fondo. Por dentro, todo en cubos
  // F5.22 (Diego: "más grande, que las estructuras para subir sean órganos del calamar, no madera"): la cabeza creció
  // hacia el sur (18 × 34 m, 12 de alto) y la cámara es de 16 × 25 m y 11 de alto. Galerías oeste, este y del fondo
  // unidas por un puente en el medio (queda un hueco al norte y otro al sur), dos rampas: una lengua (norte) y un
  // esófago con anillos (sur). Pilares = tentáculos enroscados con ventosas; barandas = cordones de cartílago
  SQUIDHEAD: { x1: -98, x2: -78, z1: -66, z2: -32, h: 13.5, minRise: 0.3, openRound: 13,
               tunnel: [-90.5, -85.5, -40, -32], chamber: [-96, -80, -65, -40], tunnelH: 4.5, chamberH: 10.5,
               deck: { walk: [[-96, -92, -62, -40], [-84, -80, -62, -40], [-96, -80, -65, -62], [-92, -84, -53, -51]],
                       flights: [
                         { x1: -86, x2: -84, z1: -51, z2: -42, axis: 'z', dir: -1, steps: 16, bottom: [-85, -41], top: [-85, -52],
                           gap: ['z', -51, -86, -84], open: true, optional: true, organ: 'tongue' },
                         { x1: -92, x2: -90, z1: -62, z2: -55, axis: 'z', dir: -1, steps: 14, bottom: [-91, -54], top: [-91, -63],
                           gap: ['z', -62, -92, -90], open: true, optional: true, organ: 'gullet' }
                       ],
                       // bordes contra las paredes de la cabeza: sin baranda (la pared frena; una baranda fina pegada a la pared
                       // te dejaba medio adentro y al resolver el choque te mandaba a la punta)
                       wallGaps: [['x', -96, -65, -40], ['x', -80, -65, -40], ['z', -65, -96, -80], ['z', -40, -96, -92], ['z', -40, -84, -80]],
                       // pilares (tentáculos) bajo el borde de las galerías y del puente (sólidos abajo; arriba no molestan)
                       pillars: [[-92.3, -58], [-92.3, -47], [-92.3, -43], [-83.7, -58], [-83.7, -47], [-83.7, -43],
                                 [-94, -62.3], [-82, -62.3], [-88, -53.3], [-88, -50.7]],
                       heart: [-88, -58, 1.4] } },   // el corazón que late en el hueco sur [x, z, radio] (sólido)
  // F5.19: la bahía del calamar. Donde estaba la cabeza va el EMBARCADERO: la arena pasó a ser agua (más baja que
  // el mar de la playa: `waterY`), con el muelle arriba, sobre pilotes. `bounds` = rectángulo donde world.js pone
  // límites de agua (bound:mar) en cada borde entre lo caminable y el agua. El dibujo, en garden.js buildSquidBay
  // F5.19c (Diego): la bala de los snipers que mata con daño de sobra sigue al zombie de atrás si está a menos de gap m
  // del anterior (def.penetrate = cuántos más como máximo)
  PENETRATE: { gap: 1.6 },
  // F5.19c (Diego): catarata de sangre verde de tortuga en el claro: un peñasco sólido (rock, alto h) con la caída en la
  // cara sur (ancho w) a una poza que brilla (radio pool). Todo dibujo salvo el peñasco (PROPS 'catarata')
  // F5.20 (Diego): contra el borde oeste del claro (x -79), cayendo hacia el este. face = hacia dónde cae (+1 = +x)
  GOOFALL: { x: -79, z: 63, rock: [-81, -77.2, 60, 66], h: 4.8, w: 2.2, pool: 2.6, face: 1 },
  SQUIDBAY: { bounds: [-100, -41, -62, -4], waterY: -1.1,
    // F5.19c (Diego): franja de lodo entre el embarcadero y la playa (x -26, 3 veces más ancha): frena solo al jugador
    mud: { x1: -30.9, x2: -21.1, z1: -24, z2: -3, mul: 0.55 },   // F5.20: 1.4× más ancho (9.8 m)
    // F5.20 (Diego): barco pesquero grande volcado en la bahía, con cadáveres flotando y humo (todo dibujo)
    wreck: { x: -55, z: -68, rot: 0.45, len: 14, smoke: 40 },   // F5.21: 14 m, en cubos
    // F5.21 (Diego: "que se pueda subir y bajar, pasar abajo, más elaborado sin dejar de ser muelle"): un piso de arriba
    // (a UP.y, el grid de arriba) sobre cada muelle, unidos por un puente, con una escalera en cada uno (UP.flights, eje z,
    // suben hacia -z). Por abajo se sigue caminando el muelle. walk = [x1, x2, z1, z2]; posts = pilotes sólidos
    decks: {
      walk: [[-62, -56, -48, -36], [-56, -50, -42, -39], [-50, -46, -44, -38]],
      flights: [
        { x1: -58, x2: -56, z1: -36, z2: -30, axis: 'z', dir: -1, steps: 16, bottom: [-57, -29], top: [-57, -37], gap: ['z', -36, -58, -56] },
        { x1: -50, x2: -48, z1: -38, z2: -32, axis: 'z', dir: -1, steps: 16, bottom: [-49, -31], top: [-49, -39], gap: ['z', -38, -50, -48] }
      ],
      posts: [[-61.85, -47.85], [-56.15, -47.85], [-61.85, -42], [-61.85, -36.15], [-56.15, -36.15],
              [-49.85, -43.85], [-46.15, -43.85], [-46.15, -41], [-46.15, -38.15], [-53, -42.3], [-53, -38.7]],
      // arriba, contra las barandas (sólidos): la grúa [x, z] y la carga [x, z, tipo 0/1 cajón, 2 barriles, 3 soga]
      crane: [-61.4, -47.4],
      cargo: [[-61.4, -46.4, 0], [-61.4, -45.7, 1], [-56.6, -43.5, 2], [-56.6, -44.3, 2], [-46.6, -43.4, 3], [-46.6, -39, 0], [-61.4, -37.2, 3]]
    },
    // botes rotos en el agua [x, z, rot, tipo, color] y el bote volcado sobre el muelle (sólido: PROPS 'botin')
    boats: [[-66, -36, 0.4, 'capsized', 0x8e6a4a], [-52, -52, -0.3, 'split', 0x3a6a8a], [-76, -40, 1.2, 'sunk', 0xd8d0c0],
            [-40, -34, 2.2, 'capsized', 0x5f7f7a], [-64, -54, 1.6, 'split', 0xa8322a]],
    dinghy: [-66.5, -17.5, 0.2],
    // animales de mar muertos sobre el muelle [x, z, rot, tipo]: tiburón (sólido), pulpo, raya, pilas de pescados,
    // esqueleto; alienígenas: medusas que brillan, pez de muchos ojos, cangrejo de 10 patas
    carcasses: [[-55, -26, 0.5, 'shark'], [-67, -26.5, 1.9, 'octopus'], [-49, -19, -0.4, 'ray'], [-60.5, -15.8, 0, 'fish'],
                [-45.5, -28.5, 0.9, 'fish'], [-58.8, -40, 1.57, 'skeleton'], [-63, -20.5, 0.3, 'jelly'], [-47.8, -39, 0, 'jelly'],
                [-52.5, -16.5, 2.4, 'eyes'], [-69.5, -15.5, 1.1, 'crab'], [-60.5, -47.5, 0.7, 'crab']] },
  // F5.14: almejas y fumigador (src/clams.js). El fumigador aparece por partida en uno de `fumigator` (porche o
  // playa) y se agarra con F. Las 9 almejas no tienen collider (no tocan el grid; si su punto cae en una celda
  // bloqueada se corre a la navegable más cercana). Cada una avanza de color sola cada `every` rondas (al azar
  // entre los dos): vacía -> verde -> amarilla -> morada -> vacía. Con el fumigador, mantener F `openTime` s: se
  // abre y da el premio de su color (una vez por color: queda vacía hasta el próximo cambio)
  CLAMS: {
    fumigator: [{ room: 'R1', x: 3, z: -2.5 }, { room: 'R1', x: -3.5, z: 2 }, { room: 'R10', x: 7, z: -9 },
                { room: 'R10', x: -12, z: -11 }, { room: 'R10', x: 1, z: -19 }],
    spots: [
      { room: 'R10', x: -3, z: -13 }, { room: 'R13', x: 16, z: 35 },  { room: 'R12', x: -21, z: 30 },
      { room: 'R17', x: -58, z: 64 }, { room: 'R11', x: -0.9, z: -38 }, { room: 'R20', x: 58.5, z: 66 },   // F5.15: áreas (F5.19: sin jardines norte, una al muelle)
      { room: 'R20', x: 74, z: 64 },  { room: 'R19', x: -53, z: -21 }, { room: 'R14', x: -60, z: 31 }
    ],
    every: [3, 4], openTime: 1.5, range: 1.8, offerTime: 10,   // F5.18b: el arma espera offerTime s a que la agarres
    // F5.24 (Diego): al abrirla vuelve a vacía y a las `regrow` rondas sale verde (antes seguía su ciclo y podía volver
    // amarilla: "tarda en crecer")
    regrow: 2,
    colors: [0x8a8478, 0x4ad86a, 0xf0d040, 0xa04ae8],               // vacía, verde, amarilla, morada
    names: ['EMPTY', 'GREEN', 'YELLOW', 'PURPLE'],
    // premios por color: [tipo, peso]. 'piece' = pieza de la Ola (hasta que sale; si ya salió, su peso se reparte)
    rewards: [
      null,
      [['zombie', 0.5], ['powerup', 0.25], ['weapon:sniper', 0.25]],
      [['squid', 0.5], ['powerup', 0.25], ['weapon:shotgun|revolver', 0.25]],
      [['piece', 0.35], ['bigsquid', 0.4], ['weapon:rifle|crossbow', 0.25]]
    ],
    bigSquid: { fused: 4, healthMul: 4, emerge: 6, depth: 2.6 }     // sale escarbando despacio
  },
  // F5.13: torre de salvavidas en la playa (patas sólidas en PROPS 'torreN'; se camina por debajo). El revólver
  // se compra en su tablón (WALLBUYS)
  // F5.15: en la playa oeste (-27, -20), más larga (w a lo largo de x) y de estilo rancho: 6 patas, techo de palma
  LIFEGUARD: { x: 14.4, z: -22, w: 6, d: 3.4, h: 2.6 },   // F5.19 (Diego): a la playa de la casa, lado este
  // F5.18b: chicles (como las Gobble Gums de BO3). CLASSIC: se desbloquean por nivel y no se gastan. RARE, ULTRA y EPIC
  // se ganan en la tienda (con `currency`, que cae al comprar puertas, lianas y la caja con chance `inkChance`) y se
  // gastan al agarrarlos. Antes de la partida se eligen `presetSize` para el preset; la chiclera del mapa da uno al azar
  // del preset (que tengas). type: instant (al agarrarlo), timed (dura `time` s), charges (T usa una carga), melee
  // (cargas que gasta el cuchillo), passive (hasta que se usa)
  GUMS: {
    // F5.19: el preset tiene que tener `presetSize` chicles con stock para jugar (con 2 se forzaba el que querías);
    // las cuentas nuevas (o con el preset vacío) arrancan con `defaultPreset`, los 5 clásicos de nivel 1
    // F5.19d: 6% (antes 14%). F5.28d (Diego): 3%
    currency: 'KRAKEN INK', inkChance: 0.03, presetSize: 5,
    presetSets: 3,        // F5.20: sets de chicles guardados por cuenta
    defaultPreset: ['shadow', 'beacon', 'quickhands', 'ironlungs', 'sharpedge'],
    // F5.19: `vend` s desde que pagás hasta que el chicle cae en la bandeja (baja por el globo). F5.19c: 5 (el ruido dura 6 s)
    // F5.21 (Diego): el primero de cada ronda es gratis (cost[0] = 0)
    machine: { cost: [0, 500, 1000, 2000], maxPerRound: 4, offer: 6, vend: 5, size: { w: 0.9, h: 1.7, d: 0.7 },
               // F5.20: la del porche pasó al garaje (pared este, al sur de la puerta del pasillo)
               spots: [{ room: 'R6', x: -4.55, z: 20.2, rot: -Math.PI / 2 }, { room: 'R14', x: -58.5, z: 39.45, rot: Math.PI },
                       // F5.28e (Diego): la del templo, en la cueva. F5.22: la del calamar, arriba del muelle chico (antes, en la orilla)
                       { room: 'R24', x: -18, z: 43.45, rot: 0, y: -6 },
                       { room: 'R19', x: -46.55, z: -41.2, rot: -Math.PI / 2, level: 1, y: 4.3 }] },
    shop: [null, { count: 1, odds: { rare: 0.72, ultra: 0.23, epic: 0.05 } },
                 { count: 2, odds: { rare: 0.55, ultra: 0.33, epic: 0.12 } },
                 { count: 3, odds: { rare: 0.38, ultra: 0.42, epic: 0.2 } }],
    // F5.28d: el tambor 3D de la tienda (ui.js GDRUM): tamaño del canvas en px, lado del tambor, cantidad y lado de los
    // chicles-cubo, velocidad de giro quieto y girando (rad/s), y cuándo sale cada ganado (s después de girar)
    drum: { w: 340, h: 380, size: 1.1, balls: 16, ball: 0.14, idleSpeed: 0.4, spinSpeed: 9, outDelay: 0.2, outEach: 0.6 },
    vault: { w: 620, h: 250 },   // F5.28e: la bóveda 3D de la pestaña GUMS (px del canvas)
    rarities: { classic: { name: 'CLASSIC', color: '#4aa8ff' }, rare: { name: 'RARE', color: '#6ad86a' },
                ultra: { name: 'ULTRA RARE', color: '#ffb347' }, epic: { name: 'EPIC', color: '#d060ff' } },
    list: {
      // F5.19c (Diego): SHADOW STEP ya no se activa al agarrarlo: queda en la mano y se usa con T (1 carga de 10 s)
      shadow:     { name: 'SHADOW STEP',     rarity: 'classic', level: 1,  icon: '👻', color: '#7a8a9a', type: 'charges', charges: 1, time: 10,  desc: 'Press T: zombies ignore you for 10 s' },
      beacon:     { name: 'BEACON',          rarity: 'classic', level: 1,  icon: '📣', color: '#e8c030', type: 'timed', time: 10,  desc: 'Every zombie rushes you for 10 s. Double points' },
      quickhands: { name: 'QUICK HANDS',     rarity: 'classic', level: 1,  icon: '✋', color: '#4ac8c8', type: 'timed', time: 180, desc: 'Reload and aim 50% faster for 3 min' },
      ironlungs:  { name: 'IRON LUNGS',      rarity: 'classic', level: 1,  icon: '💨', color: '#8ad8ff', type: 'timed', time: 120, desc: 'Unlimited sprint for 2 min' },
      sharpedge:  { name: 'SHARP EDGE',      rarity: 'classic', level: 1,  icon: '🔪', color: '#c8c8d0', type: 'timed', time: 120, desc: 'Knife does 4x damage for 2 min' },
      restock:    { name: 'RESTOCK',         rarity: 'classic', level: 12, icon: '📦', color: '#a8844a', type: 'instant',          desc: 'Refills the reserve ammo of your weapon' },
      hardskin:   { name: 'HARD SKIN',       rarity: 'classic', level: 15, icon: '🛡️', color: '#6a7ab8', type: 'timed', time: 60,  desc: 'Take 50% less damage for 1 min' },
      insta3:     { name: 'TRIPLE THREAT',   rarity: 'rare',  icon: '💀', color: '#e8e8e8', type: 'charges', charges: 3, desc: '3 Insta-Kills: press T to trigger one (15 s each)' },
      freefire:   { name: 'FREE FIRE',       rarity: 'rare',  icon: '♾️', color: '#ff8a4a', type: 'timed', time: 30, desc: 'No ammo used for 30 s' },
      popshock:   { name: 'POP SHOCKS',      rarity: 'rare',  icon: '⚡', color: '#f0e040', type: 'melee', charges: 5, desc: 'Your next 5 knife hits explode' },
      luckybox:   { name: 'LUCKY BOX',       rarity: 'rare',  icon: '🎁', color: '#e84a8a', type: 'passive', desc: 'Next Mystery Box is free and never the teddy' },
      pointrain:  { name: 'POINT RAIN',      rarity: 'rare',  icon: '💰', color: '#6ad86a', type: 'instant', points: 2500, desc: '+2500 points' },
      secretsip:  { name: 'SECRET SIP',      rarity: 'ultra', icon: '🥤', color: '#4aa8ff', type: 'charges', charges: 1, desc: 'Press T: a random perk you do not have' },
      sunburn:    { name: 'SUNBURN',         rarity: 'ultra', icon: '☀️', color: '#ff6a1a', type: 'charges', charges: 1, desc: 'Press T: Kaboom, every zombie burns' },
      powerdrop:  { name: 'POWER DROP',      rarity: 'ultra', icon: '🎲', color: '#ffd23a', type: 'charges', charges: 1, desc: 'Press T: 2 random power-ups at your feet' },
      crawlspace: { name: 'CRAWL SPACE',     rarity: 'ultra', icon: '🐛', color: '#8a6a4a', type: 'charges', charges: 1, desc: 'Press T: every zombie near you crawls' },
      freeall:    { name: 'SHOPPING SPREE',  rarity: 'epic',  icon: '🛒', color: '#ff4ad0', type: 'timed', time: 60, desc: 'Everything is free for 60 s' },
      perkaholic: { name: 'PERKAHOLIC',      rarity: 'epic',  icon: '🍾', color: '#c060ff', type: 'instant', desc: 'Every perk' },
      blessing:   { name: "KRAKEN'S BLESSING", rarity: 'epic', icon: '🐙', color: '#8a3ac8', type: 'instant', desc: 'Pack-a-Punch your weapon for free' },
      // F5.20 (Diego: "10 más, random, también malos"). Por nivel (clásicos): HEAVY BOOTS, GLASS CANNON, HEADHUNTER,
      // COIN FLIP. Con KRAKEN INK: HALF MAG (malo), CURSED CANDY (malo), GRENADIER, POWER MAGNET, SECOND WIND, UNDYING
      heavyboots: { name: 'HEAVY BOOTS',     rarity: 'classic', level: 4,  icon: '🥾', color: '#6a5040', type: 'timed', time: 60,  desc: 'Points x1.5 for 1 min, but you walk 25% slower' },
      glasscannon:{ name: 'GLASS CANNON',    rarity: 'classic', level: 7,  icon: '🥃', color: '#b8e8f0', type: 'timed', time: 45,  desc: 'Your bullets do x1.5 damage for 45 s, but zombies hit you x2' },
      headhunter: { name: 'HEADHUNTER',      rarity: 'classic', level: 10, icon: '🎯', color: '#d84a4a', type: 'timed', time: 90,  desc: 'Headshot kills give double points for 90 s' },
      coinflip:   { name: 'COIN FLIP',       rarity: 'classic', level: 18, icon: '🪙', color: '#d8b040', type: 'instant', desc: 'Heads: +1500 points. Tails: -750 points' },
      halfmag:    { name: 'HALF MAG',        rarity: 'rare',  icon: '🩸', color: '#a02a2a', type: 'timed', time: 45, desc: 'Every shot costs 2 bullets, but points x2 for 45 s' },
      cursed:     { name: 'CURSED CANDY',    rarity: 'rare',  icon: '🍬', color: '#6a2a8a', type: 'instant', points: 2000, count: 6, desc: '+2000 points... and 6 zombies crawl out around you' },
      grenadier:  { name: 'GRENADIER',       rarity: 'rare',  icon: '💣', color: '#5a7a3a', type: 'instant', desc: 'Your grenades are refilled' },
      magnet:     { name: 'POWER MAGNET',    rarity: 'ultra', icon: '🧲', color: '#e84a4a', type: 'timed', time: 90, mul: 4, desc: 'Power-ups drop 4x more often for 90 s' },
      secondwind: { name: 'SECOND WIND',     rarity: 'ultra', icon: '💚', color: '#4ad86a', type: 'passive', desc: 'The next hit that would put you down leaves you at full health' },
      undying:    { name: 'UNDYING',         rarity: 'epic',  icon: '👑', color: '#ffd23a', type: 'charges', charges: 1, time: 15, desc: 'Press T: nothing can hurt you for 15 s' },
      // F5.28d (Diego: "5 chicles normales y 5 por kraken ink"). Clásicos por nivel (22, 28, 34, 40, 46):
      //  - NIGHT EYES: la oscuridad de zona × zdMul y el filtro verde `filter` (gfxFilter) mientras dura
      //  - DEAD AIM: los headshots hacen × mul · SCAVENGER: cada kill suma `bullets` al cargador
      //  - HALF-PRICE PERK: el próximo perk × mul (se gasta al comprarlo) · STICKY FINGERS: power-ups desde `radius` m
      nighteyes:  { name: 'NIGHT EYES',      rarity: 'classic', level: 22, icon: '👁️', color: '#6ad86a', type: 'timed', time: 180, zdMul: 0.15,
                    filter: 'brightness(3.6) saturate(0.25) sepia(0.6) hue-rotate(55deg) contrast(1.15)', desc: 'See in the dark (bunker, temple, house) for 3 min' },
      deadaim:    { name: 'DEAD AIM',        rarity: 'classic', level: 28, icon: '🔭', color: '#e8e8a0', type: 'timed', time: 60, mul: 2, desc: 'Headshots do double damage for 60 s' },
      scavenger:  { name: 'SCAVENGER',       rarity: 'classic', level: 34, icon: '🧺', color: '#b8a070', type: 'timed', time: 120, bullets: 2, desc: 'Every kill puts 2 bullets back in your mag for 2 min' },
      halfperk:   { name: 'HALF-PRICE PERK', rarity: 'classic', level: 40, icon: '🏷️', color: '#ff8ac8', type: 'passive', mul: 0.5, desc: 'Your next perk costs half' },
      sticky:     { name: 'STICKY FINGERS',  rarity: 'classic', level: 46, icon: '🍯', color: '#e8a030', type: 'timed', time: 120, radius: 8, desc: 'Grab power-ups from 8 m away for 2 min' },
      // con KRAKEN INK: BONE ARMOR (se come `hits` golpes enteros), AMMO FOUNTAIN (Max Ammo), WONDERBAR (la próxima caja da
      // la Ray Gun), KILLING TIME (con T: congela a los zombies `time` s; los que baleaste mueren al terminar), KRAKEN'S
      // WRATH (con T: `count` tentáculos de `len` m salen del piso; mata a todo zombie a `radius` m en tu nivel, y a los
      // bosses les saca bossFrac de su vida; el dibujo dura fxTime s)
      bonearmor:  { name: 'BONE ARMOR',      rarity: 'rare',  icon: '🦴', color: '#e8dcc0', type: 'passive', hits: 3, desc: 'The next 3 hits do nothing to you' },
      ammofountain:{ name: 'AMMO FOUNTAIN',  rarity: 'rare',  icon: '⛲', color: '#4ac8ff', type: 'instant', desc: 'Max Ammo, right now' },
      wonderbar:  { name: 'WONDERBAR',       rarity: 'ultra', icon: '🍫', color: '#8a5a2a', type: 'passive', desc: 'Your next Mystery Box gives the Ray Gun' },
      killingtime:{ name: 'KILLING TIME',    rarity: 'ultra', icon: '⏳', color: '#a0a0ff', type: 'charges', charges: 1, time: 8, desc: 'Press T: zombies freeze for 8 s; the ones you shoot die when it ends' },
      krakenwrath:{ name: "KRAKEN'S WRATH",  rarity: 'epic',  icon: '🦑', color: '#8a1a3a', type: 'charges', charges: 1, radius: 10, len: 4.5, count: 10, fxTime: 1.8, bossFrac: 0.1,
                    desc: 'Press T: tentacles burst from the ground and kill every zombie within 10 m' }
    }
  },
  // F5.18: choque en la jungla al oeste del templo (parte de R20, `area`), abierto al anexo por el borde x 55 (z gap).
  // cars: [x, z, ry, color, arde, vuelco ('roof' | 'side')]: sólidos (PROPS 'autoN', caja del vuelco girado).
  // squid: calamar muerto del tamaño de un auto (sólido). boss: Sombrerón muerto con la guitarra atravesada (sólido).
  // bodies: cadáveres [x, z, ry] (sin collider). Fuego y humo sin luces: llamas aditivas y un Points de humo
  // F5.19 (Diego): llega a x 26 (ahí, escondida, la entrada del búnker) y los autos van contra los bordes: el medio se
  // camina
  CRASH: { area: [26, 55, 75, 92], gap: [78, 88],
    cars: [[33, 76.5, 0.05, 0xa8322a, true, 'roof'], [41, 76.6, -0.08, 0xd8d4c8, false, 'roof'], [49, 76.4, 0.1, 0x4a6a3a, false, 'side'],
           [38.5, 90.6, 0.04, 0x3a5a8a, true, 'side'], [50.5, 90.6, -0.06, 0xe8b820, true, 'roof']],
    squid: [44.2, 90.1, 0.1], boss: [27.8, 79.5, 1.5],
    bodies: [[36, 78.9, 0.4], [44.5, 79, 2.1], [52, 79.2, -1.2], [30.5, 84, 1.1], [46, 87.8, 2.8], [53.5, 84.5, -0.6], [38, 85.5, 1.9]],
    smoke: 36, fire: false },   // F5.19 (Diego): el fuego se veía raro; los autos quedan quemados, sin llamas ni humo
  // F5.13: templo estilo Tikal en la esquina NE. La cima (top) está a UP.y: entra al grid de arriba (los zombies
  // suben por las 2 rampas de piedra). Base sólida debajo de la cima; escalones bajos (tiers) sólidos alrededor,
  // sin tapar las rampas; santuario decorativo encima (collider de arriba: no se atraviesa). Afuera del templo,
  // pasto y un río en L que rodea la entrada (x 32..35 y z 51..54) con 3 puentes de 4 m y pirañas (GARDEN.piranhas)
  // F5.15: se mudó al anexo NE de la jungla (R20, x 55..95, z 55..100), más lejos de la casa y más grande: cima de
  // 14 × 14, anillo de escalones de 3 m y un SANTUARIO en la cima (cuarto de 10 × 10 con 2 puertas, techo a `h` m y
  // crestería de `comb` m) con el Pack-a-Punch adentro. Las rampas, 4 m de ancho
  // F5.19 (Diego): una GRAN NAVE de lado a lado del área (z 50..100): una plancha de piedra a UP.y de x 80 a 98 con
  // columnas a los dos lados y dinteles, el Pack-a-Punch en el medio y la tumba/portal en la punta de z 100. Se sube
  // por 3 rampas de x 70 a 80 (z ~50, 75 y 100). El río va de norte a sur (x 62..65) sin cruzar el templo, con un
  // puente frente a cada rampa y un TIBURÓN por puente (sharks) en vez de pirañas
  TEMPLE: {
    // F5.28d (Diego): tormenta siempre en el templo (R20): oscuridad de zona zd, un relámpago con trueno cada `every` s
    // y la lluvia más cerrada (opacidad × rainOpacity). Ya llovía siempre ahí (WEATHER.rainRooms)
    storm: { zd: 1.3, every: [4, 9], rainOpacity: 1.8 },
    // F5.28f (Diego: "antorchas que iluminen un poco en el templo"): la mancha de luz del piso de cada brasero (radio r m,
    // opacidad del plano aditivo) y la luz falsa para los zombies (mismo radio)
    // F5.28f (Diego: "que iluminen más"): r 5.5 → 7.5, opacidad .4 → .6; halo = opacidad del halo que rodea la llama
    // (haloSize m de lado); light = fuerza de la luz falsa sobre los zombies
    // stoneGlow: el brillo propio del brasero (lo ilumina su fuego). F5.28f (Diego: "iluminan raro el piso"): la mancha
    // del piso aparte, más chica y suave (pool m de radio, opacidad; antes 7.5 y .6: cruzaba escalones y tapaba el piso)
    glow: { r: 7.5, pool: 4.2, opacity: 0.3, halo: 0.55, haloSize: 3, light: 1.3, stoneGlow: 0x4a2408 },
    area: [55, 98, 50, 100],
    top: { x1: 80, x2: 98, z1: 50, z2: 100 },
    tiers: [], tierH: 1.6,
    ramps: [
      { x1: 70, x2: 80, z1: 50.5, z2: 54.5, steps: 18, dir: 1, bottom: [69, 52], top: [80, 52], stone: true, gap: ['x', 80, 50.5, 54.5] },
      { x1: 70, x2: 80, z1: 73, z2: 77, steps: 18, dir: 1, bottom: [69, 75], top: [80, 75], stone: true, gap: ['x', 80, 73, 77] },
      { x1: 70, x2: 80, z1: 95.5, z2: 99.5, steps: 18, dir: 1, bottom: [69, 97], top: [80, 97], stone: true, gap: ['x', 80, 95.5, 99.5] }
    ],
    // columnas sobre la plancha (sólidas arriba: el grid de arriba las rodea) [x de cada fila], cada `every` m, alto h
    // F5.28e (Diego: "una barra del techo atraviesa la planta; un techo más alto, maya, con un par de hoyos"): columnas de
    // 9 m y, encima, una bóveda maya en saledizo (`roof`): `steps` hiladas de piedra de `stepH` m que avanzan `stepIn` m
    // hacia adentro de cada lado hasta cerrarse con la piedra de cumbrera, friso de glifos, crestería calada de `comb` m y
    // hoyos (tramos de z sin cumbrera) por donde entran la luz y la lluvia
    columns: { xs: [81.2, 96.8], every: 5, h: 9, r: 0.45 },
    roof: { steps: 7, stepH: 0.6, stepIn: 1.05, frieze: 1.2, comb: 3.2, holes: [[61, 63], [73.8, 76.2], [89.5, 91.5]] },
    river: { w: [62, 65, 50, 100],                                   // [x1, x2, z1, z2]; los puentes, frente a las rampas
             bridges: [['w', 50.5, 54.5], ['w', 73, 77], ['w', 95.5, 99.5]] },
    // tiburón del río: cada `every` s (al azar) cruza por debajo de un puente de lado a lado y salta por encima. Si te
    // toca sobre el puente, `damage` y un empujón. Solo con el jugador a menos de `near` m
    shark: { every: [3, 6], cross: 1.3, peak: 1.9, damage: 50, radius: 1.3, push: 3, near: 16, span: 7 },
    clear: [59, 99, 49, 101],                                       // sin árboles de jungla adentro
    // F5.17: cabezas colosales de piedra (a los lados del puente del medio) y estelas talladas (sólidas: PROPS)
    heads: [[67.3, 71, Math.PI / 2], [67.3, 79, Math.PI / 2]],
    stelae: [[72.5, 60, Math.PI / 2], [72.5, 90, Math.PI / 2], [59.5, 95, 0]],
    // F5.19b (Diego): 3 estatuas moradas de plantas carnívoras (sólidas: PROPS plantaMoradaN, caja de ±box m). Giran la
    // cabeza hacia vos y, si te ven a menos de range m, escupen un chorro "espacial" de burst s (rate bolitas/s en arco,
    // speed m/s, gravity) cada every s. Cada bolita pega damage (respeta el i-frame)
    // F5.20: muro sólido en el borde este de la plancha (z 78..100), h m por encima de la plancha
    eastWall: { x1: 98, x2: 98.6, z1: 78, z2: 100.2, h: 4 },
    // F5.21: y en el borde norte (z 100), de punta a punta de la plancha: la planta queda encerrada en su esquina
    northWall: { x1: 80, x2: 98.6, z1: 100, z2: 100.6, h: 6 },
    voidPlants: { spots: [[76.5, 63.5], [76.5, 82], [58.8, 55.5]], box: 0.8, h: 3.6, range: 16, every: [4, 7], burst: 1.2,
                  rate: 18, speed: 13, gravity: 6, damage: 6, spread: 0.12, pool: 48 }
  },
  // F5.20 (Diego): la planta carnívora jefa del templo, en lugar de la tumba. Fija en la esquina NE de la plancha
  // (box = su cuerpo sólido [x1, x2, z1, z2, alto sobre la plancha]; mira a `look`). Se despierta con vos en el templo
  // a menos de `aggro` m y ahí toma la vida del Sombrerón de esa ronda (BOSS.health). Por vida:
  //   arriba de `half`: escupe ácido como las plantas chicas, con la mitad del intervalo, y deja charcos verdes
  //   de `half` a `low`: el chorro de tinta del calamar (jet), con más alcance
  //   debajo de `low`: sigue con el chorro y además llama hordas de calamares cada summon.every s
  // Arranca morada, negra y verde fluorescente y se va poniendo negra. La cabeza (headMul) recibe más daño.
  // Al morir escupe el Pack-a-Punch (escondido bajo raíces hasta entonces; vuela `fly` s) y se forma una burbuja
  // alrededor del portal del templo, que se abre
  // F5.21 (Diego: "feísimo, que sea cúbico", "no es desafiante"): todo en vóxeles, vida ×hpMul, ráfagas de 3
  // escupitajos (spit), raíces que salen de la plancha debajo tuyo (roots: aviso warn s, suben, pegan damage y te
  // levantan; cada `every` s según la fase, `count` a la vez) y la cinemática de escupir el PaP (cine, s desde que muere)
  // Solo se le pega desde arriba de la plancha (plantShooterOk): de afuera del templo la bala le pega a la piedra
  // F5.22 (Diego): en el CENTRO de la nave (el PaP se corrió al norte); ataca en toda el área del templo (TEMPLE.area, en
  // el piso o arriba), y escupe y tira raíces más seguido. Se le pega desde cualquier lugar del área
  PLANTBOSS: {
    enabled: true, name: 'THE TEMPLE MAW', x: 89, z: 75, look: [80, 75], scale: 1.25,
    box: [87.4, 90.6, 73.4, 76.6, 4.8], headMul: 1.5, hpMul: 1.5,
    half: 0.5, low: 0.2,
    spit: { every: [2, 3.5], burst: 3, gap: 0.25, spread: 1.8, range: 60 },
    // F5.24 (Diego: "amplía el campo de las raíces"): radio 1.7 -> 2.4, una más por fase, y las de alrededor más abiertas
    // (spread: de spread[0] a spread[1] m de la del medio). pool = cuántas pueden estar afuera a la vez
    roots: { every: [[3.5, 5], [2.5, 3.5], [1.8, 2.5]], count: [2, 3, 4], warn: 0.9, rise: 0.15, hold: 0.8, down: 0.45,
             radius: 2.4, damage: 35, lift: 6.5, lead: 0.5, spread: [3, 5.5], pool: 5 },
    // F5.24: raíces que te ATRAPAN. Aviso en un anillo alrededor tuyo (warn s); si seguís adentro (radius m) te encierran:
    // no te movés `time` s y te sacan `dps` por segundo; cada cuchillazo corta `cut` s. Cada `every` s (en su nivel)
    trap: { every: [9, 13], warn: 0.8, radius: 1.6, time: 3, dps: 12, cut: 1.1, tick: 0.5 },
    jet: { range: [3, 45], speed: 20, gravity: 9.8, jet: 2.0, rest: 2.0, size: 1.6 },
    // F5.23 (Diego): la LENGUA. Si estás cerca (en su nivel, entre min y range m, con línea libre) abre la boca (warn s) y
    // la dispara (speed m/s); si te toca te agarra y te arrastra a `drag` m/s hacia la boca: a `swallowAt` m te traga.
    // Te soltás con `shots` tiros a la lengua o `stabs` cuchillazos (mirando a la boca). Cada `every` s. Al agarrarte pega
    // `damage`; si te quedás trabado `stallTime` s también te traga. turn = qué tan rápido gira la cara hacia vos (rad/s)
    // F5.24 (Diego: "más probabilidad de que me agarre"): cada 2.5–4.5 s (antes 4–7), hasta 15 m (antes 11) y más ancha
    // para acertar (miss 1.0 -> 1.35)
    tongue: { min: 2.5, range: 15, every: [2.5, 4.5], warn: 0.6, speed: 22, drag: 2.8, swallowAt: 2.4, shots: 1, stabs: 2,
              back: 26, miss: 1.35, damage: 10, maxGrab: 10, stallTime: 0.8,
              // te levanta hasta la boca (lift = salto al agarrarte) y la vista se nubla (blur hasta blurMax px y oscuro
              // hasta darkMax) a medida que llegás; en la boca, a swallowKill s te mata; a swallowTime s termina
              lift: 0.8, swallowKill: 0.25, swallowTime: 0.6, blurMax: 10, darkMax: 0.65 },
    // sonidos de Diego (Nuevos sonidos 2/Planta Boss, claves pb_*): gruñido cada growl s con vos en el templo, y el de
    // daño como mucho cada hurtGap s
    growl: [6, 11], hurtGap: 0.7,
    turn: 3.5,
    summon: { every: 14, count: 3, max: 8 },
    points: 2000, xp: 500, bubble: 1.8,
    // al morir (F5.22: animación, el juego sigue): se retuerce (rear), escupe el PaP que vuela `fly` s, aterriza, y después
    // la burbuja se forma en el portal y revienta al abrirse
    // F5.24 (Diego): se retuerce `rear` s y EXPLOTA: vuelan pedazos (chunks), el PaP sale volando a su lugar, la cabeza cae
    // en una esquina de la plancha (headRest) y donde estaba queda un charco amarillo que crece `puddle` s: ese charco es
    // el portal (CONFIG.PORTAL.puddle). El cuerpo deja de ser sólido. deathVol = volumen del sonido de muerte (×2)
    cine: { rear: 2.2, fly: 2.0, hold: 1.4, bubble: 2.4, dur: 5.6, headFly: 1.3, puddle: 1.6 },
    chunks: 40, headRest: { x: 92, z: 57, ry: 2.4, y: 1.0 }, deathVol: 2.6
  },
  // F5.12: cercos que se compran y se queman (son puertas: CONFIG.DOORS, DOOR_LINKS). Al comprarlo arde `time` s
  // (llamas de un pool fijo a lo largo del cerco, se pone negro y se hunde) y después se abre
  BURN: {
    time: 2.2, flames: 10,
    // F5.15: las entradas de las áreas (estilo BO3): lianas que se queman en la boca de cada sendero
    hedges: [
      { id: 'H2', x1: -80, x2: -76, z1: 40,  z2: 40 },   // tortugario -> claro del caparazón (F5.19: al lado de la cueva)
      { id: 'H6', x1: 28,  x2: 33,  z1: 40,  z2: 40 },   // jardín trasero -> sendero largo al templo (F5.19: sin jardines norte)
      { id: 'H8', x1: -62, x2: -57, z1: 18,  z2: 18 }    // rancho -> costa del calamar (sendero sur del rancho)
    ]
  },
  // F5.15: la espesura: la jungla vieja [x1, x2, z1, z2]. Lo que cae acá y no es un área ni un sendero no se
  // camina: world.js buildThicketWalls pone una pared de vegetación en cada borde con lo caminable
  // F5.19: el oeste llega a x -86 (rancho y tortugario corridos) y el patio del caparazón a z 103
  // F5.19: sin [-75, -20, -24, -4] (ahí está la bahía del calamar) ni el anexo viejo del templo [55, 95, 55, 100]
  THICKET: [[-86, 55, 40, 74], [-86, -24, -4, 18], [-86, -27, 18, 40], [20, 55, -24, -4], [35, 55, -4, 40],
            [-86, -20, 74, 111], [20, 55, 74, 100]],   // F5.22: el patio del caparazón llega a z 110   // F5.18: la espesura alrededor del choque   // F5.17: la espesura alrededor del patio del caparazón (claro hasta z 95)
  thicketWallH: 3,
  // F5.12: jungla. Árboles con tronco sólido cada ~spacing m (al azar con semilla fija, lejos de lo que hay que
  // usar), helechos, rocas, lianas y flores; y una franja tupida afuera del borde que tapa el vacío
  JUNGLE: { seed: 7, spacing: 7.5, jitter: 2.2, keepClear: 3.2, ferns: 680, rocks: 64, outer: 5 },   // F5.15: + el anexo
  // F5.25 A: árboles de cubos en instancias por celda de `chunk` m; a menos de `near` m (del borde de la celda) el detalle alto
  // F5.28f (rendimiento): 3 detalles: cerca (a menos de near m del borde de la celda), medio (a menos de mid) y lejos
  VOXTREES: { chunk: 24, near: 6, mid: 24 },
  // F5.29 (Diego): el easter egg THE KRAKEN (src/kraken.js; guía en GUIA-EASTER-EGG.md, diseño en EASTER-EGG.md).
  // travel: s del fundido de cada viaje (al laboratorio, a la arena, a la playa). seed: s antes de que la semilla se
  // hunda y alcance para agarrarla. tele: s de carga, s fuera de la plataforma que la cortan, alcance y llegada al
  // laboratorio. consoles: [x, z, nivel] (0 planta baja, 1 anillo, 2 galería); calib: s para las 3; hold: s adentro del
  // caparazón. gramo: el tocadiscos; lureSpawn: dónde aparece el Sombrerón; booth: la cabina [centro, ancho x, fondo z] y
  // su consola; weak: vida máxima (fracción) para atraparlo; process: s hasta el cebo; retry: s del tocadiscos tras un
  // fallo; shutTime: s que las puertas quedan cerradas. membrane: la pared de agua de la cabeza del calamar. beachOut:
  // adonde volvés. arena: centro (x, z) y en coordenadas relativas los rectángulos caminables (enteros), dónde arrancás,
  // el bote, los 4 arpones, los restos de barco y dónde salen los calamarcitos
  EE: {
    travel: 0.8,
    debugHpMul: 5,                   // F5.29d: la tecla L (debug) multiplica la vida máxima, para probar la pelea entera
    seed: { time: 30, pick: 1.8 },
    tele: { charge: 20, leave: 3, reach: 2.2, arrive: [-58, 90] },
    consoles: [[-44, 82, 0], [-60.5, 89, 1], [-50, 96.5, 2]], use: 1.9, calib: 25, hold: 60,
    gramo: [-55, 97.6], lureSpawn: [-51, 68],
    booth: { x: -44.5, z: 96.5, w: 3, d: 3 }, boothConsole: [-44.5, 94.4], weak: 0.35, process: 10, retry: 60, shutTime: 2.5,
    membrane: { x: -88, z: -64.3, w: 4, h: 4, use: 2.4 },
    beachOut: [0, -12],
    // F5.29b (Diego: "un muelle en medio del mar, lejos de la costa, más grande porque el calamar es gigante"): el muelle
    // en la esquina sureste del grid (centro x, z; la costa queda a 46 m o más, tapada por la tormenta). rects:
    // tablones caminables, relativos y enteros (cubierta, dos puntas al frente, dos alas, el fondo y el embarcadero);
    // kraken: dónde sale (relativo, fuera del grid: solo dibujo) y su escala (el modelo del calamar gigante de la playa,
    // F5.11, × scale); rise: altura del Kraken en cada fase (en la 3 sube y se acerca lunge m). harpoons: los 4 cañones
    // (el asiento queda detrás, mirando al Kraken); lanterns: faroles de la baranda (marcan el borde de noche)
    // (más ancho que hondo: lo más cercano a la costa, la punta del embarcadero, queda a 39 m; la cubierta, a 48 m)
    // F5.29c (Diego: "que el muelle sea una L un poco más grande; oscuro y con un par de antorchas; el boss más grande"):
    // el brazo largo frente al Kraken (14 de hondo), la pata de la L hacia la costa (al este) y el embarcadero en su punta
    // (1072 m²; lo más cercano a la costa, a 34 m). torches: las antorchas (fuego en cubos y una mancha de luz de torchR m)
    // F5.29e (Diego: "el muelle una C que rodee un poco al calamar, para tener espacio para correr de la Bestia"): el centro
    // (x, z) es el Kraken; la barra de atrás (al norte, entre el Kraken y la costa), dos brazos a los costados del Kraken
    // y el embarcadero al norte de la barra (el último rectángulo). Todo se corrió al norte: el grid termina en z −91 y los
    // brazos tienen que llegar al costado del Kraken (1168 m²; lo más cercano a la costa, a 30 m). lunge: la boca no llega
    // a la barra
    arena: { x: 60, z: -84, kraken: [0, 0], scale: 10.5, rise: [-6, -5, -2],
             rects: [[-28, 28, 14, 26], [-28, -16, -6, 14], [16, 28, -6, 14], [-2, 2, 26, 30]],
             start: [0, 22], boat: [0, 31.6],
             harpoons: [[-18, -4], [18, -4], [-8, 16], [8, 16]],
             torches: [[-27.4, -5.4], [27.4, -5.4], [-27.4, 25.4], [27.4, 25.4], [-16.6, 14.6], [16.6, 14.6]],
             torchR: 6, torchOpacity: 0.6, ammo: [0, 20],                 // ammo: el Max Ammo de cada fase cumplida
             // F5.29d: la mesa de trabajo de la fase 3 (contra la baranda de atrás de la barra)
             table: [-14, 25.3],
             wrecks: [[-42, -12, 0.6], [42, -16, 2.1], [-44, 22, -1], [44, 26, 0.4]] },
    // la tormenta en el muelle (enemies.js stormZone): noche (night: la oscuridad, 1 = la más cerrada), zd oscuridad de
    // zona, relámpagos cada every s, lluvia × rainOpacity, niebla a fogFar m (la cámara también), el mar a seaY (cubos de
    // cube m, olas de wave m). F5.29c (Diego: "de noche con rayos, oscuro"): noche cerrada y más relámpagos
    storm: { night: 1, zd: 0.2, every: [0.8, 2.6], rainOpacity: 2.2, fogFar: 64, seaY: -1.7, cube: 2, wave: 0.45 },
    // la pelea: time s en total.
    // Golpe (fase 1, F5.29b: más lento y sólido): slamEvery s entre golpes (×slowK en las fases 2 y 3), maxDown apoyados a la
    // vez; warn s mientras sube y se marca la franja roja, fall s de la caída, stay s apoyado (SÓLIDO: no se cruza), up s
    // que tarda en irse; lift m de alto; slamW m de medio ancho, slamDmg y push si te pega; reach m más allá de vos;
    // segs cubos por tentáculo; boxes colliders por tentáculo (cada boxStep m). suckerHP: la ventosa que brilla; cuts.
    // Del piso (todas las fases): floorEvery s (×1.4 en la fase 1) y, subido a un cañón, a los mountGrace s; floorWarn s
    // de aviso (las tablas que se rajan), floorDmg, floorPush (te tira lejos y te baja del cañón), floorStay s parado
    // (sólido), floorR m del empujón. Ahogados: drowned.max a la vez, uno cada every s, a más de minDist m.
    // squidEvery s (salen 2), squidMax vivos, inkEvery s. Fase 2: eyeHits arponazos al ojo; eyeR m (radio del ojo);
    // harpoonUse m del asiento; harpoonReload s; harpoonSpeed m/s; harpoonRange m; flinch s con el ojo cerrado. Fase 3:
    // mouthOpen / mouthClosed s del pico, mouthR m para que la carga entre en la boca, lunge m que se acerca. boat s cerca del bote
    // (boatUse m). helpers: los bosses que salen del mar al cumplir una fase o fallar un paso (en orden), hasta helpersMax
    // vivos; si ya están, helperDrowned ahogados de golpe
    // F5.29c: tentáculos más gruesos (thick: ancho en la base y la punta; slamW sigue al ancho), los ahogados salen más
    // despacio (drowned.first s hasta el primero) y eyeR crece con el Kraken.
    // F5.29d (Diego): fase 1: no todos los tentáculos traen la herida (woundChance; a lo sumo woundMax seguidos sin ella).
    // Fase 2: el ojo se abre en ventanas cortas (eyeOpen s abierto, eyeClosed s cerrado); un arponazo te baja del cañón.
    // Fase 3 (en lugar del cebo y la panza): salen del mar p3Bosses (de a p3Alive, cada p3Every s) y cada uno suelta una
    // GRANADA MORADA (se agarra a orbPick m; si cae afuera del muelle, vuela a orbFly m/s hasta delante de la mesa); con las 4, en la mesa (tableUse m) se atan a la Ola Rompiente; esa carga
    // (chargeSpeed m/s, chargeGrav) a la boca abierta lo mata (la cinemática: win.blast). F5.29f: los "granadas" son HUEVOS
    // DE CALAMAR; si la carga erra, se pierde y vuelven a salir los 4 bosses
    fight: { time: 420,
             woundChance: 0.4, woundMax: 4, eyeOpen: 2.4, eyeClosed: 3.6,
             p3Bosses: ['sombrero', 'sombrero', 'calamar', 'bestia'], p3Alive: 2, p3Every: 4, orbPick: 1.8, orbFly: 7, tableUse: 2.2,
             // F5.29f: atar los huevos a la Ola se hace manteniendo F craftTime s (con la animación de construir); errar la
             // carga la pierde y vuelven a salir los 4 bosses
             chargeSpeed: 32, chargeGrav: 5, craftTime: 2.5, slamEvery: [4.5, 6.5], slowK: 1.6, maxDown: 2, warn: 2.2, fall: 0.5, stay: 8, up: 1.2, lift: 15,
             thick: [3.4, 1.1], floorThick: [2.4, 0.8],
             slamW: 1.6, slamDmg: 60, push: 9, reach: 2.5, segs: 24, boxes: 14, boxStep: 1.5, suckerHP: 3000, cuts: 4,
             floorEvery: [8, 11], mountGrace: 3, floorWarn: 1.1, floorDmg: 25, floorPush: 11, floorStay: 2.5, floorR: 2.2, floorSegs: 12,
             drowned: { max: 8, every: 3.5, first: 10, minDist: 8 },
             squidEvery: 10, squidMax: 6, inkEvery: 8,
             eyeHits: 3, eyeR: 3.3, harpoonUse: 1.9, harpoonReload: 6, harpoonSpeed: 70, harpoonRange: 75, flinch: 2.5,
             mouthOpen: 6, mouthClosed: 5, mouthR: 4.2, lunge: 4, turn: 1.2,   // turn: qué tan rápido gira hacia vos
             boat: 5, boatUse: 2.2,
             helpers: ['sombrero', 'calamar', 'sombrero', 'calamar'], helpersMax: 2, helperDrowned: 4 },
    // intento fallido (se acabó el tiempo): bosses y perros en la playa; el cebo vuelve a la cabina en lureRounds rondas
    punish: { bosses: ['sombrero', 'sombrero', 'calamar'], dogs: 4, lureRounds: 2 },
    // victoria: cine s mirando el remolino; premios; el remolino en el mar (whirl, radio whirlR); el cielo (arriba y
    // niebla) morado y azul; los restos del Kraken [x, z, tamaño] por el mapa.
    // F5.29d (Diego: "explota una parte y se hunde; yo salgo en un pedazo de madera nadando a la playa, volteo un segundo
    // y está el remolino; al llegar a la playa se ve el remolino"): cine s del Kraken que se hunde (boom: cuándo vuela el
    // pedazo), swim s en el tablón hasta la playa (de swimFrom, relativo al muelle, a beachOut); entre look[0] y look[1]
    // (fracción del viaje) mirás para atrás; al final quedás mirando el remolino
    // F5.29e (Diego: "la cinemática le falta mucho: que explote poco a poco, que se vea el remolino y que salgan luces
    // moradas en el cielo como un portal cúbico"): blast s explotando de a poco (una explosión cada blastEvery s, de la
    // primera a la última; se le abren cracks grietas que brillan), boomT s de la gran explosión (chunks pedazos),
    // whirlT s mirando desde arriba cómo se lo traga el remolino mientras se abre el PORTAL en el cielo (portal: altura y
    // los radios de sus anillos de cubos; aurora: cintas de luces de ribbons × per cubos), y el tablón
    // F5.29f (Diego: "quitá esas luces que simulan explosiones; que abra la boca gritando y chorree líquido negro, que le
    // salgan pedazos volando de a poco, sacudiendo los tentáculos desesperado, con muchos rayos alrededor que destruyan el
    // muelle; las luces del portal mar adentro; en el tablón, flashbacks como screamers de los bosses con gritos"):
    // blast: pieceEvery s entre pedazos (de la primera a la última); cracks chorreones negros; drops gotas negras;
    // boltEvery s entre rayos (los rayos rompen el muelle: holes agujeros); screamEvery s entre gritos.
    // portalSea: dónde queda el portal después de ganar (mar adentro, alto: portalSeaY). flashes: cuándo (fracción del
    // viaje en el tablón) sale cada flashback y flashT s que dura
    win: { blast: 6, pieceEvery: [0.6, 0.15], cracks: 48, drops: 140, boltEvery: [0.6, 0.25], holes: 10, screamEvery: 1.8,
           boomT: 1.4, chunks: 30, whirlT: 5,
           portal: { y: 44, rings: [9, 12.5, 16], tilt: 0.45 }, aurora: { ribbons: 5, per: 46, y: 62 },
           portalSea: [10, -110], portalSeaY: 58,
           flashes: [0.14, 0.28, 0.64, 0.8], flashT: 0.35,
           swim: 12, swimFrom: [0, 32], look: [0.38, 0.52], points: 10000, ink: 5, xp: 5000, whirl: [14, -36], whirlR: 9, skyTop: 0x4a8aff, fog: 0x8a5ae0,
           debris: [[-6, -14, 1], [8, -17, 1.2], [-14, -9, 0.9], [14, -10, 1], [-18, -18, 1], [2, -30, 0.8], [-15, 8, 0.8],
                    [12, 36, 0.9], [-60, 30, 1], [-55, 62, 1.1], [66, 62, 0.9], [-60, -10, 1]] }
  },
  // F5.28f (Diego: "el fuego no tiene diseño cúbico"): el fuego en cubos (garden.js voxFire): cubes cubos por fuego más
  // el núcleo, de size m (× la escala de cada fuego), suben height × size en 1/speed s; colores de la base a la punta;
  // solo se anima a menos de near m (suma de |dx| + |dz|) de la cámara
  // (cube: tamaño de cada cubo al nacer, × size)
  VOXFIRE: { cubes: 10, size: 0.3, cube: 0.8, height: 2.4, speed: 1.3, near: 70, colors: [0xffd850, 0xff8a1a, 0xd8300e] },
  // F5.11: decoración de los jardines. Reposeras sólidas (PROPS, contra los bordes: [x, z, largo a lo largo de
  // 'x' o 'z']), sombrillas y canteros de flores (solo dibujo, en garden.js buildGardenDecor)
  DECOR: {
    // F7c: la playa (solo dibujo, sin collider: no tocan el grid ni frenan balas). [x, z, rot]
    beach: {
      // F5.28e (Diego: "en la playa quitá los props; dejá cadáveres de personas, uno de tiburón y un ojo gigante de calamar
      // medio abierto"): sin toallas, sombrillas, castillo, heladerita, pelota ni radio. bodies: [x, z, ry] (dibujo);
      // shark: [x, z, ry] (4.6 m, sólido: PROPS tiburon); eye: [x, z, ry, radio] (sólido: PROPS ojoCalamar)
      bodies: [[-2.5, -12, 0.6], [12.5, -9.5, 2.2], [-14, -15.5, -0.8]],
      shark: [-8.5, -20.3, 0.35], eye: [6.5, -15.2, 0.5, 1.3],
      logs: [[-18, -21, 0.4], [19, -12.5, -0.3], [-2, -23, 1.2]],
      seaweed: 14, shells: 22, shoreZ: [-23.4, -19.5],
      crabs: 5, crabArea: [-18, 18, -23.2, -19.5], crabSpeed: 0.7, crabFlee: 2.5
    },
    // F5.28e: cadáveres adentro de la casa (dibujo, sin collider). bodies: [x, z, ry, camisa, pantalón] tirados;
    // sitting: [x, z, ry] sentados contra una pared (ry: hacia dónde miran); smears: [x, y, z, ry, ancho, alto] sangre en
    // paredes (x, z sobre la cara, ry: la normal)
    house: {
      bodies: [[-3.5, 11, 0.9, 0x5a6a7a, 0x2a2a3a], [15.5, 8.5, 2.6, 0x8a7a5a, 0x3a3a2a], [-1.2, 24, -0.4, 0x6a2a2a, 0x2a2a38],
               [12.5, 21.5, 1.8, 0xd8d0c0, 0x3a4a6a], [-9, 37, 0.3, 0x4a5a4a, 0x3a3228]],
      sitting: [[-15.45, 26, Math.PI / 2], [4.55, 26.5, Math.PI / 2]],
      smears: [[-7.78, 1.6, 8, Math.PI / 2, 0.9, 0.6], [17.78, 1.4, 11, -Math.PI / 2, 0.8, 0.5], [3.78, 1.5, 21, -Math.PI / 2, 0.8, 0.6]]
    },
    // F5.19: sin las del jardín norte (se borró)
    loungers: [[-64, -9, 'x'], [-64, -7, 'x']],               // F5.15: a la costa del calamar (la jungla oeste es espesura)
    umbrellas: [[-62.6, -8]],
    flowers: [[-23.6, -22.9, 1.5, 5.8], [-23.6, -22.9, 8.3, 10],   // F5.17: sin pisar la caja de almas
              [34.2, 34.9, 35, 37.5]]   // F5.15: el de x 34 no tapa H7
  },
  // F5.11: búnker bajo tierra (R16). No está literalmente debajo del sótano: es una zona aparte (x,z libres,
  // piso en y = `y`) a la que se baja por la escotilla del jardín norte. Para el jugador, fundido y
  // teletransporte; para los zombies, un enlace del grid (NAV.link) que cruzan escondidos (ojos rojos al bajar).
  // Cerrada hasta que las 2 estatuas de plantas (al lado de la escotilla) despiertan y comen
  // F5.17 (Diego): el caparazón de una tortuga gigante reemplaza a la estación de policía (R21), al fondo del claro
  // del búnker (que creció hasta z 95). Ahuecado: se entra por la boca (D21, barricada baja de la policía: se ve
  // adentro por encima), se da la vuelta abajo y se sube por una escalera a un entrepiso de andamios a UP.y (el
  // grid de arriba, como la cima del templo). Adentro: la columna y las costillas pegadas a la cúpula y sangre verde
  // que brilla. 3 zombies se comen a un policía (dibujo; al abrir D21 se paran y salen de verdad: extra de la ronda)
  // x, z = centro · a, b = semiejes del borde (x, z) · h = alto · t = grosor del borde
  // deck: [x1, x2, z1, z2] de afuera y el hueco del medio · ramp: escalera (UP.flights) del hueco al lado este
  // F5.19 (Diego: más lugar para correr en la entrada): todo 7 m al norte (centro z 81 -> 88); el patio llega a z 102
  // F5.22 (Diego: "más grande, que el área sea más grande, tercer nivel, adentro un área de investigación, todo
  // cúbico"): 34 × 28 m y 17 de alto, centro (-51, 89). Planta baja (laboratorio), nivel 1 = anillo alrededor del hueco
  // (deck), nivel 2 = galería de observación al norte (lab2, a UP2.y) con su escalera desde el anillo (lab2.flight)
  SHELL: { x: -51, z: 89, a: 17, b: 14, h: 17, t: 0.6, rimH: 5,
           lab2: { walk: [[-60, -40, 93, 98]],
                   flight: { x1: -43, x2: -41, z1: 86, z2: 93, axis: 'z', dir: 1, steps: 16, bottom: [-42, 85], top: [-42, 93],
                             gap: ['z', 93, -43, -41], y0: 4.3, toLevel: 2, open: true },
                   posts: [[-59.8, 93.2], [-52, 93.2], [-46, 93.2]] },
           // equipos sólidos del laboratorio (PROPS) [x, z, ancho x, fondo z, alto, tipo]: tanques de especímenes, racks,
           // escritorios, la mesa de disección y la cápsula de contención del centro (debajo del hueco)
           labProps: [[-64.5, 85, 1.4, 1.4, 2.8, 'tank'], [-64.5, 89, 1.4, 1.4, 2.8, 'tank'], [-64.5, 93, 1.4, 1.4, 2.8, 'tank'],
                      [-37.8, 84.5, 1.0, 2.0, 2.4, 'rack'], [-37.8, 93.5, 1.0, 2.0, 2.4, 'rack'],
                      [-55, 100.6, 2.4, 1.0, 0.9, 'desk'], [-47, 100.6, 2.4, 1.0, 0.9, 'desk'],
                      [-60, 80.8, 2.2, 1.0, 0.95, 'table'], [-51, 90.5, 3.0, 3.0, 3.6, 'pod']],
           // F5.19c (Diego): otro cráneo de tortuga, tirado de costado en la esquina NO del claro (box = su collider)
           skull2: { x: -76.6, y: 0.95, z: 73.4, k: 1.0, ry: 2.2, roll: 1.25, box: [-78.4, -74.8, 71.8, 75, 1.9] },
           door: { id: 'D21', x1: -53, x2: -49, z: 75.4, h: 1.2, cost: 1250 },
           // F5.24 (Diego): no se lo rodea. Dos paredes de espesura en z (una a cada lado) desde el borde del patio (x1, x2)
           // hasta la cúpula: solo se llega a la boca por adelante; lo de atrás queda cerrado
           sideWalls: { z: 79, t: 1, x1: -66, x2: -36 },   // F5.28e: del ancho de la franja de enfrente
           // F5.28f (Diego: "que los charcos iluminen un poco a su alrededor"): el halo de cada charco del claro mide
           // puddleGlow × su ancho (antes 3) y la opacidad de los halos late entre haloOpacity[0] y la suma (antes .35–.6)
           puddleGlow: 5, haloOpacity: [0.5, 0.3],
           // F5.28f (Diego: "que las lámparas del laboratorio iluminen un poco pero que titileen"): cada tubo, una mancha
           // de luz de r m en el piso (opacidad), luz falsa `light` para los zombies, y una ráfaga de cortes cada every s
           labLamps: { r: 3.2, opacity: 0.3, light: 0.7, every: [2, 7] },
           // F5.24 (Diego): sin energía, adentro es más oscuro (NIGHT.zd; el claro es 1, la casa sin energía 1.35) y los
           // LEDs y balizas del laboratorio están apagados
           unpoweredDark: 1.7,
           deck: { outer: [-62, -40, 80, 98], inner: [-56, -46, 85, 93] },
           ramp: { x1: -55, x2: -46, z1: 85.3, z2: 87.7, dir: 1, steps: 18, bottom: [-56, 86], top: [-46, 86], gap: ['x', -46, 85, 88], open: true },
           jump: ['z', 93, -54, -48],   // F5.17b: hueco en la baranda del entrepiso para tirarse al medio
           posts: [[-61.8, 80.2], [-40.2, 80.2], [-61.8, 97.8], [-40.2, 97.8], [-56, 84.8], [-46, 84.8], [-56, 93.2], [-46, 93.2],
                   [-61.8, 89], [-40.2, 89], [-51, 97.8]],
           feeders: [[-51.9, 80.9, 0.9], [-49.4, 81.7, -2.2], [-50.2, 79.6, 3.1]], cop: [-50.6, 80.8],
           bodies: [[-58.5, 85, 0.6], [-44.5, 92.6, 2.2], [-60.5, 91, -1.2], [-55.5, 67.2, 1.4], [-46.8, 66.6, 3.5]],
           jeep: [-63.4, -61.4, 60.5, 65], skylight: 1.42 },
  // F5.16: portal Templo ↔ Calamar, ida y vuelta, gratis. Solo el jugador:
  // F cerca del arco, fundido a negro (el de la escotilla) y aparece en `out` del otro. Los zombies no lo cruzan
  // (el flow field no lo ve: si no llegan, el watchdog los respawnea cerca). Sin collider: no toca el grid
  // F5.16b: sin portal al principio: una tumba en el lugar del arco del templo. Un tiro la hace sangrar `bleed` s y
  // aparecen los dos arcos. `cooldown` s entre usos. Los que te persiguen a menos de `carry` m cruzan con vos
  // F5.26 (Diego): el viaje es un destello de `travel` s y los que te perseguían cruzan en el mismo instante, a su misma
  // distancia de vos (mínimo minGap m)
  PORTAL: { use: 2.3, bleed: 1.5, cooldown: 2, carry: 20, travel: 0.35, minGap: 3,
    // F5.19: en la punta norte de la nave del templo, arriba de la plancha (y: out[2] = altura donde aparecés)
    temple: { room: 'R20', x: 89, z: 98.2, rot: Math.PI, y: 4.3, out: [89, 96, 4.3] },
    squid:  { room: 'R22', x: -78, z: -21.5, rot: Math.PI, out: [-78, -23.6] },   // F5.19b: llega a las rocas de la cabeza
    // F5.24 (Diego): con la planta jefa, el portal son dos CHARCOS AMARILLOS: el del templo donde explotó la planta (arriba
    // de la plancha) y el de la playa del calamar donde estaba el arco. Se viaja SALTANDO adentro (cayendo sobre el charco,
    // a menos de radius m; sin F). out = dónde aparecés en la otra punta (afuera del charco)
    puddle: { radius: 1.9,
              temple: { room: 'R20', x: 89, z: 75, y: 4.3, out: [89, 80.5, 4.3] },
              // (soak: en z -21.5 medio charco quedaba sobre el agua; el pasillo de rocas se camina en z -26..-22)
              squid:  { room: 'R22', x: -78, z: -24.5, y: 0, out: [-81.5, -24.5] } } },
  BUNKER: {
    // F5.12: se mudó bajo el mar, al sur del muelle (la jungla norte ocupaba sus x,z de antes)
    // F5.26 (Diego: la guarida de la Bestia, "más grande, más alto y espacioso, sin mucho diseño"): 44×30 m y 7 de alto
    // (antes x -38..-10, z -90..-66, 4 de alto). Bajo el mar: sus x,z siguen sin pisarse con nada caminable de arriba.
    // Crece al este y al norte: al oeste el casco del barco hundido (SQUIDBAY.wreck, x -55) baja hasta y -2 y se metía
    x1: -38, x2: 6, z1: -90, z2: -60, y: -8, h: 7,
    // F5.13: la entrada es un búnker de hormigón de 5.2 m de ancho (×4) contra la pared norte del sótano, con
    // puertas blindadas al frente (z2). F se usa delante de las puertas; el enlace de los zombies sale de ahí
    // F5.15: la entrada se mudó a la esquina NO (-73, 73), contra el borde norte, mirando al sur (face -1 = las
    // puertas en z1). Por fuera está medio destruida (bunker.js buildHatch)
    // F5.19 (Diego): escondida en el choque al oeste del templo (x 30.3), contra el borde norte, mirando al sur
    // F5.28e (Diego: "una cueva con antorchas y al fondo el búnker"): al fondo (oeste) de la cueva de las catacumbas (R24), en
    // la pared oeste, mirando al este (axis 'x': el ancho va a lo largo de z; face 1 = las puertas hacia +x). Se sacó del choque
    entrance: { x1: -41, x2: -38.2, z1: 54.4, z2: 59.6, h: 3.2, face: 1, axis: 'x' },
    hatch:  { x: -37.4, z: 57, cell: [-38, 57], out: [-36.6, 57] },   // delante de las puertas, la celda del enlace, donde aparecés
    ladder: { x: -24, z: -89.4, cell: [-24, -89], out: [-24, -87.8] },   // abajo, contra la pared sur
    use: 1.6,              // m para usar la escotilla o la escalera con F
    fade: 0.35,            // s de fundido a negro (ida) y vuelta
    // F5.19c (Diego): bajar/subir al búnker y cruzar el portal tardan travel s, con una cinemática en pantalla
    // (escalera oscura / portal morado de galaxia). Te teletransporta a la mitad; mientras tanto no te movés ni te pegan
    travel: 5, stepEvery: 0.55,
    climbTime: 1.0,        // s que el zombie tarda en bajar o subir (escondido)
    bulbs: [[-30, -83], [-16, -83], [-3, -82], [-30, -67], [-16, -67], [-2, -67]],   // focos (sin luces: brillo pintado en el piso)
    teleporter: { x: -24, z: -61.6 },
    // estatuas de plantas a los dos lados de la entrada (F5.15: en la esquina, mirando al sur)
    // F5.28e: en la cueva, contra la pared oeste a los dos lados de la entrada (room: el cuarto, porque PROPS se arma al cargar)
    statues: [{ x: -39.8, z: 52.6, room: 'R24' }, { x: -39.8, z: 61.4, room: 'R24' }],
    // F5.20 (Diego): lápida con un poema que da la pista para abrir el búnker. F5.28e: en la cueva, contra la pared oeste
    tablet: { x: -39.6, z: 47.5, rot: Math.PI / 2, box: [-40.0, -39.2, 46.3, 48.7, 2.7], room: 'R24',   // (sólida: PROPS 'lapida')
      poem: ['TWO STONE MOUTHS GUARD THE IRON DOOR,', 'ASLEEP UNTIL BLOOD SOAKS THE FLOOR.', 'FIVE MUST FALL WHERE THE JAWS REST,',
             'THEN FEED THEM THOSE WHO CRAWL THE BEST.', 'THREE HOUNDS OF HELL FOR EVERY MAW,', 'AND THE EARTH SHALL OPEN ITS JAW.'] },
    wakeKills: 5, wakeRadius: 4,     // F5.15: kills de cualquier tipo cerca de cada una para despertarla (antes, calamares)
    eatCrawlers: 6, eatDogs: 3, eatRange: 4,   // despierta, come arrastrados y perros del piso (una cada plantEatEvery)
    seahorse: { x: -88, z: -43.5, scale: 1.2 },   // F5.24: más chico. F5.22: la cámara nueva   // caballito de mar con las otras estatuas (F5.13: en la cabeza del calamar)
    // F5.26: pilares de hormigón (sólidos, en buildBunkerShell); lejos de spawns, escalera y teletransportador
    pillars: [[-27, -75], [-5, -75]],
    // F5.28 (Diego): mucho más oscuro, sin ninguna luz que se pueda prender (F5.28c: se sacaron las antorchas). La pintura
    // queda en `paint` y la zona en `zd` (NIGHT.zd: baja la luz de la escena y la niebla)
    dark: { paint: 0.035, zd: 1.75 }
  },
  // F5.26: la guarida de la Bestia (src/beast.js). Barriles de gasolina contra las paredes del búnker (a 0.55 m de la
  // cara: quedan en el anillo no navegable y no cambian el grid). Un tiro los hace explotar: daño de granada grande a
  // los zombies, a los bosses una fracción de su vida máxima (bossFrac, con caída) y daño propio de cerca. Vuelven a
  // aparecer cuando termina la pelea con la Bestia (o al reiniciar)
  BEAST: {
    barrels: [[-37.45, -84, 'x'], [-37.45, -70, 'x'], [5.45, -84, 'x'], [5.45, -66, 'x'],
              [-32, -89.45, 'z'], [-4, -89.45, 'z'], [-32, -60.55, 'z'], [-4, -60.55, 'z']],
    barrel: { w: 0.6, h: 1.0, damage: 1600, radius: 5.5, bossFrac: 0.07, self: 45, chain: 0.25 },   // chain: s hasta que explota el de al lado
    // escalera rota: la Bestia la arranca al despertarse; se arregla manteniendo F (como el banco del escudo)
    ladder: { rebuild: 3.5, pieces: 10 },
    // la Bestia: una por partida. Duerme en la esquina SE (lair) hasta que te acercás a wakeDist m o le pegás
    name: 'THE BEAST',
    lair: { x: 2, z: -85.5, rot: -2.4 },
    wakeDist: 9,
    // F5.28b: tamaño del modelo (solo dibujo y cajas de tiro; el radio de choque no cambia)
    scale: 1.45,
    // vida: la del Sombrerón de la ronda (mínimo minRound) × healthMul
    // F5.28c (Diego: "más vida y un poco más de daño"): 1.6 → 2.2, y los golpes ~+20%
    minRound: 12, healthMul: 2.2,
    // F5.26: excepción aprobada por Diego a la regla dura: corre a 5.0 (más que el jugador caminando, 4.4; menos que
    // corriendo, 7.0). Enojada (debajo de rageFrac) los ataques vienen más seguido
    speed: 5.0, rageFrac: 0.4,
    roar: 1.3, smash: 1.1, ladderReach: 1.6,       // s del rugido al despertar, s arrancando la escalera, m para llegar
    // zarpazo: aviso wind s, alcance range m; te lanza `fly` m por el aire (up m/s hacia arriba) durante flyTime s
    // F5.28c (Diego: "que me pegue y me saque volando"): alcance de los tentáculos largos, vuelo de fly m en flyTime s y
    // salto de up m/s; la caída de ese vuelo no lastima (el daño es el del golpe)
    claw: { range: 4.5, wind: 0.42, damage: 85, cooldown: 1.3, fly: 13, up: 10, flyTime: 1.0, arc: 1.2 },
    // salto: entre min y max m, con línea libre y cada `every` s; vuela a `speed` m/s y al caer pega en `hit` m
    pounce: { min: 5, max: 15, every: [5, 8], wind: 0.55, speed: 13, maxTime: 1.0, hit: 1.9, damage: 65 },
    // grito: cada `every` s, aviso wind; a menos de range m te aturde daze s; llama crías (tanda C)
    scream: { every: [13, 18], wind: 0.9, range: 14, daze: 1.6 },
    // slime negro: deja un charco cada `every` s mientras corre (frena al jugador a `slow` y quema como el ácido)
    slime: { every: 1.8, radius: 1.3, life: 7, slow: 0.55, spitEvery: [4, 6], spitMin: 6, spitMax: 16 },
    // F5.28 (Diego: "que pegue con los tentáculos, que te agarre y te trague como la planta, que te sueltes cortando el
    // tentáculo; difícil, con golpes difíciles de esquivar"):
    //  - tentacle: cada `every` s, entre min y range m con línea libre, abre la mandíbula `warn` s y dispara un tentáculo a tu
    //    pecho a `speed` m/s (miss = cuánto hay que correrse). Te agarra (damage), te arrastra a `drag` m/s y te levanta
    //    hacia la boca; a swallowAt m te traga (golpe letal a swallowKill s). Te soltás con `shots` tiros al tentáculo o
    //    `stabs` cuchillazos mirando hacia ella (más duro que la lengua de la planta: 4 y 3)
    //    F5.28c (Diego: "más gruesa y que aumente las probabilidades de agarrarme"): más seguido, más lejos y más ancho (miss)
    tentacle: { every: [3.5, 5.5], min: 3.5, range: 20, warn: 0.75, speed: 24, miss: 1.8, damage: 20, drag: 3.4, lift: 0.8,
                swallowAt: 2.2, stallTime: 1.0, maxGrab: 9, swallowTime: 1.6, swallowKill: 1.0, shots: 4, stabs: 3, back: 30 },
    //  - whip: de cerca (range m), latigazo en arco de ±arc rad con aviso wind s: pega damage y te tira de costado push m
    whip: { range: 5.2, arc: 1.15, wind: 0.6, damage: 55, push: 8, up: 7, every: [2.5, 4] },
    // F5.28c: sangre que le chorrea de la boca (pool de drops gotas, una cada every s, caen con gravedad grav)
    drool: { drops: 24, every: 0.07, grav: 14 },
    //  - spikes: tentáculos del piso (como las raíces de la planta): uno debajo tuyo y `extra` alrededor (a spread m), aviso
    //    warn s, salen, pegan damage y te levantan; pool fijo
    spikes: { every: [4, 6.5], warn: 0.85, radius: 1.7, damage: 48, up: 5.5, extra: [1, 3], spread: [2.5, 5], stay: 0.8, pool: 5 },
    // crías (tanda C): mini-bestias del pool propio. Son perros para la IA (z.dog: DOGS.speed 4.7, excepción aprobada, y
    // la mordida de los perros). Salen de a `per` al lado de la madre al gritar y al romper la escalera, hasta `max` vivas.
    // Vida = la del perro × healthMul. Cuentan como extra de la ronda (no terminan la ronda sin matarlas)
    crias: { pool: 6, per: 3, max: 5, healthMul: 0.8 }
  },
  // F5.26 (tanda D): trofeos de boss (src/trophies.js). Cada boss suelta su trofeo común y, con rareChance (la Bestia:
  // bestiaRare), el raro, flotando donde murió; se agarran pasando cerca (pick m). Cada trofeo da `ink` KRAKEN INK y `xp`.
  // F5.28 (Diego): sin el Altar ni el crafteo en la partida. Los trofeos van al PERFIL y son la moneda de la tienda ITEMS
  // (menú): cada ítem (`recipes`, need = lo que cuesta) se compra para UNA partida y se acumula en el perfil. Se equipa 1
  // antes de jugar y en la partida aparece desde el inicio en su lugar fijo (`spots`: un spawn de ese cuarto); se agarra
  // pasando cerca y ahí se gasta
  TROPHIES: {
    pick: 1.7, rareChance: 0.15, bestiaRare: 0.45, ink: 1, xp: 150, pool: 4, life: 90,
    items: {
      brim:   { name: 'HAT BRIM',      color: 0x1a1a22 }, guitar: { name: 'CURSED GUITAR', color: 0x8a4a1e, rare: true },
      inksac: { name: 'INK SAC',       color: 0x6a2a8a }, abyss:  { name: 'ABYSS EYE',     color: 0xe8e0c8, rare: true },
      seed:   { name: 'BLACK SEED',    color: 0x1a2410 }, root:   { name: 'ROOT HEART',    color: 0xa01a3a, rare: true },
      claw:   { name: 'BEAST CLAW',    color: 0xd4c4a0 }, gland:  { name: 'SLIME GLAND',   color: 0x2a1a0e, rare: true }
    },
    drops: { sombrero: ['brim', 'guitar'], calamar: ['inksac', 'abyss'], plant: ['seed', 'root'], bestia: ['claw', 'gland'] },
    // dónde aparece cada ítem equipado (cuarto; el lugar es el primer spawn de ese cuarto) y qué trofeo lo representa
    spots: { claws: 'R16', slime: 'R22', talisman: 'R20', pet: 'R14', armor: 'R21', guitar: 'R2' },
    look:  { claws: 'claw', slime: 'gland', talisman: 'seed', pet: 'root', armor: 'abyss', guitar: 'guitar' },
    // F5.28f (Diego: "que no los pueda ver hasta que llegue a su nivel"): level = nivel de cuenta desde el que se ve
    // (antes sale como "?")
    recipes: [
      { id: 'guitar',   name: 'SERENADE',       need: { guitar: 1 },                   desc: 'max ammo, full health and 2000 points', level: 5 },
      { id: 'armor',    name: 'SHELL ARMOR',    need: { abyss: 1, claw: 1 },           desc: 'takes 25% of every hit until it breaks', level: 15 },
      { id: 'slime',    name: 'SLIME BOMBS x3', need: { gland: 1, inksac: 1 },         desc: 'your next 3 grenades leave killing black slime', level: 30 },
      { id: 'talisman', name: 'BONE TALISMAN',  need: { brim: 1, inksac: 1, seed: 1 }, desc: '+1 perk slot', level: 45 },
      { id: 'pet',      name: 'TAMED WHELP',    need: { gland: 1, root: 1 },           desc: 'a beast whelp fights for you for 2 rounds', level: 60 },
      { id: 'claws',    name: 'BEAST CLAWS',    need: { claw: 1, brim: 1 },            desc: 'melee hits for 900', level: 75 }
    ],
    claws: { damage: 900 },
    slimeBomb: { count: 3, radius: 4.5, life: 8, dps: 120, perRound: 40 },
    pet: { rounds: 2, speed: 5.2, range: 14, reach: 1.3, every: 0.7, dmgMul: 0.45, follow: 3 },
    armor: { hp: 400, absorb: 0.25 },
    serenade: { points: 2000 },
    // entre partidas (cuenta): kills de cada boss. Placas a 1, 5 y 25
    plates: [1, 5, 25]
  },
  // F5.9: trampas. Palanca con F (sin collider: al punto, desde su cuarto), dura `time` s y después espera
  // `cooldown` s. Los zombies que matan no dan puntos (sí cuentan para la ronda). Al jugador le pegan
  TRAPS: {
    shark: {
      name: 'SHARK', cost: 1500, time: 10, cooldown: 60, room: 'R11', lever: { x: 1.75, z: -26.5 },
      // salta de un lado al otro del tronco del muelle; cada salto elige la z de un zombie del muelle (o al azar)
      zone: { x1: -2, x2: 2, z1: -43.5, z2: -25.5 }, side: 3.6, jumpTime: 1.0, peak: 2.4, radius: 1.4,
      playerDamage: 20
    },
    mower: {
      name: 'MOWER', cost: 1000, time: 20, cooldown: 60, room: 'R12', lever: { x: -16.35, z: 29.0 },
      // da vueltas en un círculo delante del taller de tablas
      center: { x: -21, z: 24 }, radius: 4, lap: 3.2, hitRadius: 0.9, playerDamage: 40, playerCd: 1.0
    },
    // F5.10: tortugario del rancho. Salen `count` tortugas (de a una cada `stagger` s) desde la puerta del corral;
    // cada una va al zombie más cercano (a menos de `range` m de la salida, con línea libre) y se lo come (`eat`
    // s masticando). Al jugador no le hacen nada. Al terminar vuelven al corral
    turtles: {
      // F5.16: una sola tortuga (la última viva), grande y rápida, que sale de la cueva del tortugario; la palanca
      // está al lado de la boca
      name: 'TURTLES', cost: 1500, time: 20, cooldown: 60, room: 'R14', lever: { x: -79.2, z: 30.2 },
      exit: { x: -79.3, z: 35 }, count: 1, stagger: 0, speed: 3.8, range: 26, reach: 1.2, eat: 0.35,
      radius: 0.45, scale: 1.7,
      biteRound: 10          // F5.11: hasta esta ronda matan de un mordisco; después cada uno saca la vida de la R10
    },
    // F5.19 (Diego): trampa del claro del caparazón. La palanca está en la entrada del caparazón. Mientras dura, una
    // tortuga MARIACHI (más grande, con sombrero y guitarra) da vueltas en el patio (center, radius, lap s por vuelta)
    // y atrae a todos los zombies (como el langostino; el boss no). Mini tortugas salen de los charcos de sangre verde
    // (puddles) y muerden a los zombies del claro y del caparazón (rooms) a menos de range m del centro. No te hacen
    // nada. Al terminar, las mini tortugas vuelven a su charco y se hunden
    mariachi: {
      name: 'MARIACHI TURTLE', cost: 1000, time: 20, cooldown: 60, room: 'R17', lever: { x: -60.5, z: 72.8 },
      center: { x: -51, z: 64 }, radius: 6, lap: 9, scale: 0.8,
      puddles: [[-62, 70.5], [-47.5, 58.5], [-58, 57], [-70, 63], [-38.5, 76.5], [-63.5, 76.5], [-53.5, 64]],
      // F5.19c (Diego): cuesta 1000 y desde la R10 las mini tortugas no matan de un mordisco: sacan biteFrac de la vida
      minis: { count: 8, stagger: 0.35, speed: 4.3, range: 40, reach: 0.9, eat: 0.9, radius: 0.25, scale: 0.6,
               rise: 0.5, rooms: ['R17', 'R21'], biteRound: 9, biteFrac: 0.25 }
    }
  },
  // V2 F5.6: jardines y techo. Ver src/garden.js
  GARDEN: {
    hedgeH: 2.2,          // cerco de arbustos (frena gente y balas, como una pared)
    // perros del jardín trasero: en una ronda normal desde fromRound, con el jugador en `room`, cada spawn tiene
    // `chance` de salir como perro desde un spawn del jardín. max por PARTIDA (no por ronda). Sin noche ni Max Ammo
    dogs: { room: 'R13', fromRound: 10, chance: 0.2, max: 3 },   // F5.19: sin perros sueltos antes de la R10
    // techo: solo una pasarela de madera en S (UP.walk en world.js) con barandas. Plantas carnívoras en macetas:
    // a menos de warn m se abren; a menos de kill m te muerden y te matan (con Quick Revive revivís). A los
    // zombies no les hacen nada. cooldown = s entre mordidas de la misma planta
    // F5.7 (Diego): solo 4, una en cada esquina de la pasarela, con la cabeza ×headScale; muerden plantDamage
    // (antes mataban). Respeta el i-frame
    // F5.16 (Diego): el techo ya no se camina; las 4 plantas bajan a los jardines de la casa, contra los bordes
    plants: [[-9.2, 10], [-22.9, 12], [8, 38.6], [24, 38.6]],
    // F5.8: muerden desde 4 m (el radio de las cajas de almas, pedido de Diego); avisan a 5.5
    // F5.10: ya no muerden al jugador. plantKill queda como el radio en el que comen arrastrados
    plantWarn: 5.5, plantKill: 4, potR: 0.35, potH: 0.7, headScale: 2,
    // F5.10: animación de comer (s): se lanza, cierra, lo sube y mastica (total = la suma)
    eat: { lunge: 0.3, snap: 0.1, lift: 0.35, total: 1.4 },
    // F5.8: escupitajo verde, muy de vez en cuando. Plantas: cada plantEvery s (al azar entre los dos) si estás a
    // menos de plantRange en el techo. Ahogados: cada drownedEvery s si estás en drownedRange y con línea libre.
    // Proyectil lento en arco (speed m/s horizontal, se esquiva): si te toca, hit. Donde cae deja un charco de
    // radius m que dura life s y saca tick por segundo si lo pisás
    acid: { plantEvery: [12, 20], plantRange: 10, drownedEvery: [8, 12], drownedRange: [5, 15],
            speed: 9, gravity: 9.8, hit: 15, radius: 1.5, life: 3, tick: 10, pool: 10,   // F5.24: 6 -> 10 (ráfagas de la planta)
            bubbles: 6, steam: 3 },   // F5.24: cada charco en cubos, con burbujas que revientan y vapor
    railH: 1.1,           // barandas de madera del techo
    // F5.7: palmeras de adorno (sólidas: tronco en PROPS), contra los bordes para no cortar caminos. El coco de
    // la quest sigue saliendo solo de CONFIG.QUEST.palms
    palms: [
      { room: 'R10', x: -18.5, z: -11,  segs: 8, lean: 0.5, rot: 0.4 },  { room: 'R10', x: 18.5, z: -17, segs: 7, lean: 0.6, rot: 2.8 },
      { room: 'R10', x: -4,    z: -17,  segs: 9, lean: 0.3, rot: -1.2 },
      { room: 'R12', x: -22.5, z: 0,    segs: 7, lean: 0.5, rot: 0.2 },  { room: 'R12', x: -11,  z: 16.5, segs: 8, lean: 0.4, rot: -1.8 },
      { room: 'R12', x: -25.5, z: 38.5, segs: 9, lean: 0.4, rot: -0.6 },
      { room: 'R13', x: 1.5,   z: 39.2, segs: 8, lean: 0.5, rot: 1.2 },  { room: 'R13', x: 20,   z: 38.5, segs: 7, lean: 0.6, rot: 1.6 },
      { room: 'R8',  x: 34.3,  z: 18.5, segs: 9, lean: 0.4, rot: 3.0 },  // F5.8: quedó en la piscina ampliada
      // F5.11: el rancho hasta el mar (F5.19: sin las del jardín norte)
      { room: 'R14', x: -39.8, z: 12,   segs: 8, lean: 0.5, rot: 1.0 },  { room: 'R14', x: -39.8, z: -1,  segs: 9, lean: 0.4, rot: -0.3 },
      { room: 'R14', x: -39.5, z: -20,  segs: 7, lean: 0.6, rot: 0.6 }
    ],
    // F5.8: charcos de arena mojada en la playa, [x1, x2, z1, z2] (6x3 m = 0.75 del radio de almas), frenan a
    // wetMul al jugador y a los zombies
    wetSand: [[-13, -7, -15, -12], [3, 9, -21, -18], [11, 17, -10, -7], [-9, -3, -8.5, -5.5]], wetMul: 0.6,
    // F5.8: fuente esquinera en la esquina NE del jardín trasero (x2 = cerco este, z2 = cerco norte). El sólido
    // es la caja [x1..x2, z1..z2] (PROPS 'fuente'), dentro del anillo de los cercos; el dibujo es un cuarto de pileta
    fountain: { x1: 32.8, x2: 34.8, z1: 37.8, z2: 39.8, h: 0.7 },
    // F5.7: pirañas zombis en la primera mitad de cada tronco del muelle y en el puente C13. Cada zona tiene 3
    // carriles (lanes, en z); cada `every` s salta una, rotando carriles (cada carril cada 3 s) y alternando el
    // costado. Cruza en arco de lado a lado (de x1 - out a x2 + out, pico `height`) en `flight` s. Si te toca:
    // damage (respeta el i-frame) y un empujón hacia donde iba. A los zombies nada
    piranhas: {
      every: 1.0, flight: 0.7, height: 1.9, out: 1.5, damage: 25, push: 4, radius: 0.3, sound: 18,
      near: 12,                    // F5.15: una zona salta solo con el jugador a menos de `near` m
      zones: [
        { x1: -2,  x2:  2,  lanes: [-26.5, -29.5, -32.5] },    // tronco principal (z -24..-44)
        // puente C13 (F5.8): salen de más lejos y en un arco más largo, así pasan por encima de la baranda (1.2 m)
        // y en el medio siguen a la altura del cuerpo
        { x1: 16,  x2: 22,  lanes: [-2.5, 0, 2.5], out: 6, height: 1.85, flight: 1.0 }
        // (F5.19: en los puentes del río del templo ya no hay pirañas: hay un tiburón, CONFIG.TEMPLE.shark)
      ]
    }
  },
  // V2 F2.7: granadas (tecla G; mantener = cocinar). Ver src/grenades.js
  GRENADE: {
    name: 'GRENADE',
    max: 4, perRound: 2,           // +2 al empezar cada ronda, tope 4. Max Ammo NO las recarga
    fuse: 3.0,                     // s de mecha total desde que sacás el pin (cocinar la consume)
    radius: 5,                     // m (3D, al centro del cuerpo), con línea libre (no atraviesa paredes)
    dmgBase: 300, dmgPerRound: 50, // daño en el centro = 300 + 50 × ronda
    edgeMul: 0.25,                 // caída lineal: en el borde del radio pega 25% del daño del centro
    selfDamage: 50,                // al jugador dentro del radio. Ignora el i-frame y PUEDE matar
    throwSpeed: 15, throwUp: 3,    // m/s a lo largo de la mira + extra hacia arriba
    gravity: 20, size: 0.09,       // radio de colisión (m)
    bounce: 0.45,                  // fracción de velocidad que conserva al rebotar
    friction: 3.0,                 // 1/s: frenado rodando por el piso
    restSpeed: 0.4,                // m/s: debajo de esto en el piso, se queda quieta
    substeps: 4,                   // subpasos de física por frame (a 15 m/s no atraviesa una pared de 0.4)
    shakeMax: 0.7, shakeDist: 14,  // trauma de cámara: máximo al lado, 0 a shakeDist m
    poolSize: 6,
    throwTime: 0.3,                // s de animación de tiro antes de volver al arma
    lightColor: 0xffa24a, lightIntensity: 5, lightTime: 0.35
  },
  // V2 F1.1: lugar reservado para el Pack-a-Punch (la máquina llega en F2.5). Contra el final de la
  // plataforma del muelle, mirando a +z, dentro del anillo no navegable: no cambia el grid
  // F5.8: a la orilla del entrante al sur de la pasarela que une los dos troncos del muelle (Diego: (-9.5, -49)),
  // mirando a la pasarela. Dentro del anillo no navegable: no cambia el grid
  // F5.13: arriba del templo (y = UP.y, nivel 1), contra el santuario, mirando a -z
  // F5.15: adentro del santuario del templo, contra la pared norte
  // F5.19: spot en el medio de la nave del templo. F5.22: al norte de la nave (en el medio está la planta jefa)
  PAP: { spot: { x: 89, z: 88, rot: -Math.PI / 2, y: 4.3, room: 'R20', level: 1 }, size: { w: 1.4, h: 1.8, d: 1.0 },
    // V2 F2b: la mejora. El arma entra, tarda `time` s y sale; tenés grabTime s para agarrarla o se pierde.
    // Mejorada: todo el daño ×dmgMul, cargador y reserva ×ammoMul, nombre papName, camo. Sin re-PaP.
    cost: 5000, time: 4, grabTime: 10, dmgMul: 2, ammoMul: 1.5,
    lmgCap: 500,          // F5.19d: una LMG con PaP carga como mucho 500 balas (cargador + reserva)
    ammoCost: 2500 },     // munición de un arma mejorada en su pared (la normal cuesta ECONOMY.ammoCost)
  // V2 F2.5: generadores (se prenden de UN golpe de cuchillo) y cajas de almas. Los 4 + las 3 llenas
  // habilitan el Pack-a-Punch. Nada que ver con state.power (palanca del sótano, F2).
  // Spots contra la pared, dentro del anillo no navegable (como los de la caja): no cambian el grid.
  // rot: hacia dónde mira el frente (0 = +z, π/2 = +x, π = -z, -π/2 = -x)
  GENERATORS: {
    size: { w: 1.2, h: 1.1, d: 0.7 },
    spots: {
      muelle:  { room: 'R11', x: 3.45,  z: -47,   rot: -Math.PI / 2 },   // F5.6: lado este (al oeste entra la pasarela)
      caseta:  { room: 'R14', x: -64.5, z: 39.45, rot:  Math.PI },       // F5.16: en el rancho, contra el cerco norte (la clave no cambia: state.generators es nombre fijo)
      // F5.22: en el anillo del caparazón (nivel 1), contra la baranda de afuera del lado este (el borde curvo no deja
      // ponerlo en el piso sin cambiar el grid)
      garaje:  { room: 'R21', x: -40.4, z: 89.8, rot: -Math.PI / 2, y: 4.3 },   // F5.17: adentro del caparazón, contra el borde este (la clave no cambia)
      piscina: { room: 'R8',  x: 25,    z: 4.55,  rot:  0 }              // pared sur, frente a la rampa
    },
    lampOff: 0xff3a2a, lampOn: 0x46ff6e
  },
  SOULS: {
    need: 15,            // almas por caja (fijo, no escala con la ronda)
    radius: 4,           // m (plano xz) del centro de la caja al zombie que muere, con línea libre
    showDist: 8,         // m: la barra de sangre se ve más cerca que esto (y con línea de vista)
    flyTime: 0.55,       // s que tarda el alma en llegar a la caja
    size: { w: 0.9, h: 1.0, d: 0.7 },
    spots: {
      // F5.7: se mudó al jardín oeste (la clave sigue siendo 'sotano': state.souls.sotano es nombre fijo)
      sotano:  { room: 'R12', x: -23.45, z: 7,   rot: Math.PI / 2 },     // contra el cerco oeste, al lado de la sala
      piscina: { room: 'R8', x: 18.55,  z: 16.5, rot: Math.PI / 2 }      // franja oeste: D8, D9 y el puente
      // (F5.20, Diego: sin la caja de adentro de la casa, la del pasillo: el PaP pide solo estas 2. state.souls.pasillo
      // sigue existiendo por el nombre fijo, sin uso)
    }
  },
  // armas de pared. x,z = punto sobre el eje de la pared; face = hacia dónde mira la cara (+1 = +X)
  WALLBUYS: [
    { weapon:'shotgun', room:'R2', cost:1200, x: -8, z:11, face: 1 },
    { weapon:'smg',     room:'R3', cost:1500, x: 18, z: 9, face:-1 },
    // F5.16 (Diego): la casa queda con 3 (escopeta, subfusil, revólver; el machete es cuerpo a cuerpo) y cada área
    // con 1-2: rancho doble cañón + rifle · calamar LMG · búnker bazooka + Uzi · templo ballesta
    // (en tablón propio y a ~2.3 m de la espesura: los arbustos del borde tapaban la tiza pegada a la pared)
    { weapon:'rifle',   room:'R14', cost:2000, x:-57.7, z:21.6, face:-1, post:true },            // F5.17 (Diego: estaba en medio del camino): esquina SE del rancho
    { weapon:'lmg',     room:'R19', cost:2500, x:-44.4, z:-25, face:-1, post:true },             // F5.19: en el borde este del embarcadero
    { weapon:'uzi',     room:'R21', cost:1200, x:-51, z:96.4, face:-1, axis:'z', level:1, post:true },   // F5.22: en el anillo norte, debajo de la galería   // F5.17: en el entrepiso del caparazón
    { weapon:'crossbow',room:'R24', floorY: -6, cost:2000, x: -41, z: 67.5, face: 1 },   // F5.28e (Diego): en la cueva, pared oeste (antes, en la plancha del templo)
    // V2 F3b. axis 'z' = pared a lo largo de x (face ±1 = hacia ±z). y = altura de la tiza (cerca de 1.2 m).
    // post = tablón propio (el muelle no tiene paredes). 'machete' no es arma de inventario: ver CONFIG.MACHETE
    // F5.13: en el tablón de la torre de salvavidas (CONFIG.LIFEGUARD), mirando a la casa
    { weapon:'revolver',     room:'R10', cost:900,  x: 14.4, z:-19.9, face: 1, axis:'z', post:true },   // F5.15: torre en la playa oeste (F5.19: se mudó al este)
    // F5.6: en el techo (level 1), en un tablón contra la baranda norte de la pasarela, sobre el dormitorio
    { weapon:'doublebarrel', room:'R14', cost:1500, x: -69.5, z:39.8, face:-1, axis:'z' },   // F5.16: baja del techo al cerco norte del rancho
    // F5.11: la bazooka en la pared este del búnker (floorY = su piso). Las demás armas nuevas, solo en la caja
    { weapon:'bazooka', room:'R16', floorY: -8, cost:3000, x:6, z:-78, face:-1 },
    { weapon:'machete',      room:'R3',  cost:3000, x: 10.5, z: 4,  face: 1, axis:'z' }            // pared sur de la cocina
  ],
  START_LOADOUT: ['m1911'],   // el jugador arranca solo con la pistola
  MAX_WEAPONS: 2,

  // Cuchillo: NO vive en state.weapons[] (no ocupa slot, no gasta munición, siempre disponible).
  // "un golpe" = headshot (mismo criterio que las armas de fuego, dmg*headshotMul).
  // 1 headshot (300) mata rondas 1-2. 2 headshots (600) mata hasta ronda 5 (pide "hasta ronda 4").
  // Golpe al cuerpo sin apuntar cabeza es más débil: 1 mata solo ronda 1, 2 solo hasta ronda 2.
  KNIFE: {
    id:'knife', name:'KNIFE',
    damage:150, headshotMul:2, range:2, cooldown:800, swingTime:380,
    bladeColor:0xcfd6dc, handleColor:0x3a2a1c
  },

  FX: { decalPool: 48, muzzleMs: 50, switchTime: 420 },

  // Drops de zombie al morir. Solo economía/duración; el daño y la IA no cambian.
  POWERUPS: {
    dropChance: 0.03, lifespan: 15, pickupRadius: 1.0,
    guaranteeEveryRounds: 4,             // ronda 4, 8, 12... el primer kill garantiza MAX AMMO
    spinSpeed: 2.4, bobFreq: 2.0, bobAmp: 0.12,
    poolSize: 8,
    types: {
      maxammo:      { color: 0xffd23a, label: 'MAX AMMO' },
      instakill:    { color: 0xff3a3a, label: 'INSTA-KILL', duration: 30 },
      doublepoints: { color: 0x3aa0ff, label: 'DOUBLE POINTS',       duration: 30 },
      // F5.10: al agarrarlo mueren todos los zombies vivos (menos los bosses), sin puntos ni drops; los cuerpos
      // arden `burn` s y mientras tanto no sale nadie nuevo
      // F5.13: y siempre da points(ronda) puntos (fijo: el doble puntos no lo duplica)
      kaboom:       { color: 0xff6a1a, label: 'KABOOM',              burn: 5, points: n => 1000 + 50 * (n - 1) },
      // F5.19c (Diego): CARPENTER repara todas las barricadas (y da `points`); FIRE SALE pone la caja en todos sus
      // lugares durante `duration` s (sin oso; al terminar vuelve a donde estaba)
      carpenter:    { color: 0xc8883a, label: 'CARPENTER', points: 200 },
      // F5.24 (Diego): 30 s (antes 60) y la caja cuesta `boxCost` mientras dura (como en CoD; antes cobraba 950)
      firesale:     { color: 0xff4aa8, label: 'FIRE SALE', duration: 30, boxCost: 10 }
    },
    flamePool: 32                          // F5.10: llamas de los cuerpos quemados (creadas una vez)
  },


  //--- GAME FEEL: solo presentación. Nada acá cambia daño, velocidad tope ni IA ---
  // Tiempos de "vuelta" en segundos = cuándo el resorte queda en ~5% del pico.
  FEEL: {
    // movimiento (m/s²). La velocidad TOPE sigue siendo PLAYER.speed / sprint
    accel: 38, decel: 30, airAccel: 10,

    // head bob (cámara)
    bobFreq: 2.2,                     // rad de fase por metro recorrido
    bobWalkY: 0.030, bobWalkX: 0.022,
    bobRunY: 0.055,  bobRunX: 0.038,
    bobRoll: 0.006,
    // bob del arma
    gunBobWalk: 0.012, gunBobRun: 0.022,

    // aterrizaje: se hunde y rebota (resorte sub-amortiguado)
    landDipPerSpeed: 0.022, landDipMax: 0.14,
    landFreq: 13, landDamping: 0.42,

    // disparo: retroceso de cámara (afecta la mira, vuelve solo)
    recoilPitch: 0.022, recoilYaw: 0.006, recoilReturn: 0.20,
    // disparo: retroceso del modelo
    weaponKickBack: 0.065, weaponKickRot: 0.20, weaponKickRoll: 0.06, weaponReturn: 0.16, weaponKickMax: 2.2,
    // disparo: shake según daño total del disparo (damage * pellets)
    fireShakePerDamage: 0.006, fireShakeMax: 0.5,

    // screen shake (trauma^2 * máximo). NO afecta la mira
    shakeMaxPitch: 0.05, shakeMaxYaw: 0.05, shakeMaxRoll: 0.07, shakeMaxPos: 0.05,
    shakeFreq: 22, shakeDecay: 2.2,

    // daño recibido
    hurtShake: 0.7,                   // trauma agregado
    hurtTug: 0.09,                    // rad de giro hacia el atacante
    hurtFlinch: 0.035,                // rad de cabeceo hacia abajo
    hurtRoll: 0.06, hurtReturn: 0.35,
    hurtFlash: 0.45,                  // s del flash rojo

    // weapon sway al mover el mouse
    swayAmount: 0.0012, swayMax: 0.09, swayReturn: 9, swayTilt: 1.4,

    // impacto en zombie
    bloodBody: 6, bloodHead: 8, bloodLife: 0.4, bloodSpeed: 3.2,
    knockback: 0.15, knockbackTime: 0.15,          // solo visual
    flashTime: 0.06, flashColor: 0xffffff,
    dmgNumLife: 0.7, dmgNumRise: 0.9, dmgNumMerge: 0.08,
    crossFireSpread: 5, crossHitSpread: 7, crossMax: 18, crossReturn: 14,
    hitmarkTime: 0.16
  },

  // audio procedural (Web Audio, sin archivos). Volúmenes 0..1
  // F5.24: mapa con la tecla 5 (mapview.js). px = píxeles por metro del dibujo; reveal = radio que destapás al caminar;
  // every = cada cuánto se destapa (s); floors = color del piso de cada cuarto en el mapa
  // F5.24b (Diego: "digno de la cancha, que dé miedo"): un mapa de campo viejo en papel manchado de sangre. Los pisos
  // son tintas claras que se multiplican con el papel; las paredes, trazo de tinta; la espesura, rayado; el mar, olas.
  // Lo no explorado es papel quemado con brasas en el borde. zombies = radio en que se ven como manchas rojas que laten
  MAPVIEW: {
    key: 'Digit5', px: 4, reveal: 13, every: 0.2, zombies: 22,
    floors: { wood: '#d8b88a', deck: '#d2b080', pier: '#c8a070', tile: '#e2ddcc', conc: '#cfc6b0', sand: '#f0e2b4',
              grass: '#bcc794', jungle: '#a3b07e', rock: '#bfb4a0' },
    floorDefault: '#d4c8aa', blocked: '#3a2616', sea: '#93a3a0', seaInk: '#4e6466', thicket: '#72704c', thicketInk: '#34301c',
    upper: 'rgba(70,40,15,.55)', ink: '#241408', char: '#0c0604', ember: '#ff5a1a',
    // notas escritas a mano (en rojo) cerca del nombre del cuarto, cuando ya lo viste
    notes: { R20: 'IT FEEDS HERE', R21: "DON'T GO INSIDE", R17: 'they come up from the ground', R19: 'the sea is wrong',
             R11: 'no boats left', R7: 'it hums at night', R14: 'the turtle is still hungry', R22: 'IT WAS ALIVE' },
    // la vista encuadra lo explorado (con margin m alrededor, como mínimo minView m) en un canvas de size px
    margin: 10, minView: 70, size: 1000,
    names: { R1: 'PORCH', R2: 'LIVING ROOM', R3: 'KITCHEN', R4: 'HALLWAY', R5: 'BEDROOM', R6: 'GARAGE', R7: 'BASEMENT',
             R8: 'POOL', R9: 'SHED', R10: 'BEACH', R11: 'PIER', R12: 'WEST GARDEN', R13: 'BACK GARDEN', R14: 'RANCH',
             R15: 'NORTH GARDENS', R17: 'BUNKER CLEARING', R19: 'SQUID BEACH', R20: 'TEMPLE', R21: 'GIANT SHELL',
             R22: 'SQUID DOCK' }
  },
  AUDIO: {
    master: 0.7, sfx: 0.9, ambience: 0.35,
    // F5.23: vida baja (CoD). from = desde qué intensidad suena (0.3 de 0..1 = menos de ~35% de la vida máxima);
    // beat/breath = período en s [recién entrado, casi muerto]
    lowHp: { from: 0.3, beat: [0.95, 0.55], breath: [1.6, 1.0], beatVol: 0.5, breathVol: 0.16 },
    // F5.28e (Diego): sangre por golpe en el HUD (ui.js HURT). Cada golpe prende una esquina (hasta 4); en vida crítica
    // (la zona del latido: vida < maxHealth × (1 - lowHp.from) / 2) se llena todo el contorno. `inT`/`outT` s de fundido
    // (al volver a vida llena se apaga), `cells` bloques del canvas de cada esquina (cuadriculado)
    hurt: { inT: 0.08, outT: 1.2, cells: [44, 28] },
    // F5.19: los sonidos de Diego. voice = volumen de las líneas del personaje; track = soundtrack (×trackMenu en el menú)
    voice: 1.0, track: 0.45, trackMenu: 0.8,
    // F5.19c: la segunda tanda. Canciones de los perks (se cortan a jingleFade m), músicas por lugar y del boss con poca
    // vida (bossLowFrac), y el ruido de la chiclera (dura ~6 s; el chicle sale a GUMS.machine.vend s)
    jingleVol: 0.45, jingleFade: 18, bossLowFrac: 0.3,
    zGrowlVol: 0.9,       // F5.20: volumen de los gruñidos naturales de zombie   // F5.19d: las canciones de los perks más bajas (antes 0.7)
    zoneVol: { boss: 0.7, bunker: 0.55, bunkerAmb: 0.35, temple: 0.5 },
    boxOffset: 1.0,               // s de silencio al principio del audio de la caja (se saltea)
    growlMin: 3, growlMax: 9,     // s entre gruñidos de cada zombie
    growlGap: 0.35,               // s mínimos entre gruñidos de cualquier zombie (limitador global)
    growlMaxDist: 22,             // m: más lejos no suena
    // F6: música procedural (marimba grave). bpm sube un poco por ronda; el boss tiene tema propio
    music: 0.32, musicBpm: 78, bpmPerRound: 0.8, bpmMax: 104, bossBpm: 122,
    musicDuck: 0.35,              // × mientras gruñe un zombie (la música nunca los tapa)
    musicNearDuck: 0.6,           // × con un zombie a menos de musicNearDist m
    musicNearDist: 6,
    musicLookahead: 0.25,         // s de notas agendadas por adelantado
    // F6: audio 3D. HRTF si el navegador tiene PannerNode (se escucha adelante/atrás); si no, paneo estéreo
    hrtf: true,
    // F6: pasos del jugador por superficie (cada stepLen m caminados en el piso; corriendo, stepLenRun)
    stepLen: 0.85, stepLenRun: 1.25, stepVol: 0.2,
    // F6: pasos de zombies: cada cuánto según el paso, a menos de zStepDist m, con tope global por segundo
    zStepDist: 14, zStepMax: 10, zStepEvery: { walk: 0.55, jog: 0.38, run: 0.28, dog: 0.17, squid: 0.3, boss: 0.7 },
    // F6: ambiente por zona. olas: fuertes cerca del mar (sea z0) y bajan hasta seaFar m tierra adentro
    seaFar: 60, wind: 0.22, insects: 0.1, dripEvery: [0.7, 2.4], birdEvery: [3, 9],
    // F6: anuncio de ronda: tambor (cada `longEvery` rondas, redoble largo)
    drumLongEvery: 5
  },
  // mouse: rad por píxel * multiplicador del slider (solo dura la sesión: localStorage es solo para el récord)
  INPUT: { mouseSens: 0.0022, sensMin: 0.2, sensMax: 3 },

  //--- TEMA "MARENA" (34B): solo visual. Nada acá toca colliders, hitMeshes, nav ni IA ---
  // No hay sombras: el sol ilumina interiores igual que el porche. La oscuridad interior se logra
  // tiñendo materiales interiores (interiorTint) + luces puntuales parpadeantes + haces falsos en ventanas.
  THEME: {
    enabled: true /*THEME_ENABLED*/,
    interiorTint: 0x8f8a84, ceilTint: 0x6a6560,
    hemiIntensity: 0.52, sunIntensity: 0.78,
    lampIntensity: 0.62, lampColor: 0xffc27a,
    dust: 650, dustSize: 0.05, dustOpacity: 0.5, sandWind: 0.6,
    shaftOpacity: 0.2,
    curtainAmp: 0.1, curtainSpeed: 1.7,
    // gobernador de calidad: si el promedio de fps en fpsWindow s cae bajo fpsFloor, apaga un nivel
    fpsFloor: 55, fpsWindow: 3, fpsGrace: 4
  },

  DOORS: {                     // costos del spec
    // F5.15: sin D5, D9 ni D10 (arcos abiertos); D6 1250 y D7 1500. Toda la casa: 8.250 (antes 13.750)
    D1:750, D2:1000, D3:1000, D4:1250, D6:1250, D7:1500,
    D8:1500, D11:1250, D12:2000,                          // V2 F1
    D13:2000,                 // F1.1: D11+D13 = D1+D2+D8 = 3250, la playa no es atajo a la piscina
    // F5.6: jardines. D14 no menos de 2000: el techo une el jardín oeste con la piscina, y D11+D14 = 3250 =
    // D1+D2+D8 (map.js lo verifica con Dijkstra, contando el techo como un paso gratis)
    D14:2000, D15:2000, D16:2000, D17:1500,
    D19:0,                    // F5.7: portón sótano -> jardín oeste, no se compra: lo abre turnOnPower
    D20:1500,                 // F5.10: lazo del jardín oeste al rancho
    // F5.12: cercos que se queman. H4 cuesta 2000 como D14: D11 + H4 = 3250, la jungla no abarata los jardines
    // F5.13: H5 también 2000 (ahora da a la jungla, que lleva a los jardines); sin H2/H3
    // F5.15: las entradas de las áreas (lianas). Desde la playa (H4, H5) 2000: D11 + 2000 = 3250, lo mismo que los
    // jardines; al templo (H6) 2000; las demás 1500
    H2:1500, H6:2000, H8:1500,     // F5.16: sin H3, H4, H5 ni H7
    D21:1250,                      // F5.17: barricada de la policía en la boca del caparazón (F5.16: de la estación)
    D22:1500,                      // F5.19b: baranda del embarcadero a las rocas de la cabeza del calamar
    D23:0                          // F5.28e: la puerta sellada de las catacumbas al templo: se abre con las 3 palancas
  },

  // F5.19b (Diego: "como en BO"): los zombies de la casa entran por ventanas con 5 tablas (las arrancan de a una,
  // tearTime s cada una, y después se meten en climbTime s) o por trampillas del piso (mismas tablas, salen de abajo).
  // Se reparan manteniendo F cerca (repairTime s por tabla, repairRange m): ROUNDS.boardPoints por tabla, las primeras
  // ROUNDS.boardCap de cada ronda. Afuera (jungla, mar, jardines) saltan desde la espesura o el agua si hay una a menos de
  // jumpProbe m (jumpTime s, arco de jumpH m); si no, salen del piso como antes.
  // kind: 'window' (pared: x, z en el eje de la pared, n = hacia adentro) | 'rail' (baranda del porche) | 'hatch' (piso).
  // La entrada (donde aparece el zombie adentro) es el spawn que está a inside m de la pared (o en la trampilla)
  BARRIERS: {
    // F5.19c (Diego): reparar solo pegado (repairRange m de las tablas) y más lento; pegado de verdad (hitRange) el zombie
    // te pega. Las tablas van en un marco hondo (depth m desde la pared) y el zombie queda detrás, en el hueco
    enabled: true, boards: 5, tearTime: 1.0, climbTime: 0.9, repairTime: 1.0, repairRange: 1.3, inside: 1.5,
    // F5.20: hatchHit = repairRange: reparando una trampilla, el de abajo te puede pegar
    hitRange: 1.0, hatchHit: 1.3, depth: 0.65, shakeFrom: 0.45, jumpProbe: 7,
    // F5.20: el hueco de las ventanas en la pared (ancho y de qué altura a qué altura): las balas pasan por ahí
    winW: 1.5, winY0: 0.9, winY1: 2.3,
    // F5.19c: afuera salen caminando walkIn m desde adentro de la jungla/agua y saltan el borde (vaultTime s, vaultH m)
    walkIn: 4, vaultTime: 0.6, vaultH: 0.75,
    list: [
      { id: 'W1',  room: 'R1', kind: 'rail',   x: 6,     z: -2.5, n: [-1, 0] },   // porche: del lado de la laguna (F5.19c: z 2.5 caía detrás de la chiclera)
      { id: 'T1',  room: 'R1', kind: 'hatch',  x: -4.5,  z: 2.5 },                // porche: trampilla del piso
      { id: 'W2',  room: 'R2', kind: 'window', x: -8,    z: 6.5,  n: [1, 0] },
      { id: 'W3',  room: 'R2', kind: 'window', x: -8,    z: 16.5, n: [1, 0] },
      { id: 'T2',  room: 'R2', kind: 'hatch',  x: 6.5,   z: 6.5 },
      { id: 'W4',  room: 'R3', kind: 'window', x: 16.5,  z: 4,    n: [0, 1] },
      { id: 'W5',  room: 'R3', kind: 'window', x: 18,    z: 7,    n: [-1, 0] },   // F5.19c: en (10.5, 4) estaba el machete
      { id: 'W6',  room: 'R4', kind: 'window', x: -2.5,  z: 28,   n: [0, -1] },
      { id: 'T3',  room: 'R4', kind: 'hatch',  x: -2.5,  z: 19.5 },
      { id: 'W7',  room: 'R5', kind: 'window', x: 14.5,  z: 30,   n: [0, -1] },
      { id: 'W8',  room: 'R5', kind: 'window', x: 5.5,   z: 30,   n: [0, -1] },
      { id: 'T7',  room: 'R6', kind: 'hatch',  x: -14.5, z: 19.5 },               // F5.20 (Diego): era la ventana W9
      { id: 'W10', room: 'R6', kind: 'window', x: -16,   z: 28.5, n: [1, 0] },
      { id: 'W11', room: 'R7', kind: 'window', x: -14.5, z: 40,   n: [0, -1] },
      { id: 'W12', room: 'R7', kind: 'window', x: -5.5,  z: 40,   n: [0, -1] },
      { id: 'T4',  room: 'R7', kind: 'hatch',  x: -10.5, z: 35.5 },
      { id: 'T5',  room: 'R9', kind: 'hatch',  x: 17.5,  z: 23.5 },
      { id: 'W13', room: 'R9', kind: 'window', x: 22.5,  z: 30,   n: [0, -1] },
      { id: 'T6',  room: 'R11', kind: 'hatch', x: -0.5,  z: -33.5 }                // muelle: trampilla entre las tablas
    ]
  }
};

//--- ESTADO GLOBAL (nombres fijos del spec, no renombrar) ---
const state = {
  round: 0,
  points: 0,
  health: CONFIG.PLAYER.maxHealth,
  zombies: [],
  doors: {},              // { D1:{id,cost,open,mesh,collider}, ... }
  power: false,
  weapons: [],            // [{ id, mag, reserve }]
  currentWeapon: 0,       // índice dentro de state.weapons
  // auxiliares
  running: false,
  lastDamageTime: -99,
  shotsFired: 0,
  shotsHit: 0,
  kills: 0,
  gameOver: false,
  effects: { instakill: 0, doublePoints: 0 },  // timers en segundos, 0 = inactivo
  // V2 F2.5 (no confundir con power): generadores prendidos y almas por caja. resetGame() los apaga
  generators: { muelle: false, caseta: false, garaje: false, piscina: false },
  souls: { sotano: 0, piscina: 0, pasillo: 0 },
  grenades: 0,            // V2 F2.7: granadas en el bolsillo (0..GRENADE.max)
  machete: false,         // V2 F3b: compraste el machete (reemplaza al cuchillo)
  perks: [],              // V2 F2: ids de CONFIG.PERKS.list que tenés (se pierden al morir o al revivir)
  reviveBuys: 0,          // V2 F2: compras de Quick Revive en la partida (a las 3, la máquina desaparece)
  // V2 F3a: escudo. parts = piezas recogidas; built = ya se armó en el banco (queda para toda la partida);
  // has = lo tenés encima (en la espalda o equipado); hp = durabilidad. Equipado = weaponsState.phase 'shield'
  shield: { parts: { door: false, board: false, handle: false }, built: false, has: false, hp: 0 },
  // V2 F5.5: piezas de la Ola Rompiente recogidas (cocos 0..2) y si ya se armó (queda toda la partida)
  quest: { coconut: false, string: false, shell: false, built: false }
};

