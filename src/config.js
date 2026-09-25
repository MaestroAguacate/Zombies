"use strict";

//=== 1. CONFIG ===========================================================
const CONFIG = {
  // MODO DEBUG: true SOLO EN DESARROLLO. Se apaga (false) antes de cualquier build final: habilita trucos
  // (P puntos, N noclip, [ ] rondas, O puertas, B grid, H overlay), el overlay y el cartel "DEBUG MODE"
  DEBUG_MODE: true,
  DEBUG: { points: 5000, unlockPoints: 15000, flySpeed: 9, flyFast: 2.5 },   // O suma unlockPoints (F5.10)   // P suma points; noclip a flySpeed m/s (×flyFast con Shift)
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
    // F5.7 (reemplaza "te deja en 10" de F2.8): daño proporcional a la caída. Nada debajo de fallHeight m; de
    // ahí a fallMaxDrop (el techo, 4.3) sube parejo hasta fallMaxDmg. Del techo con 100 quedás en 40. No mata
    fallHeight: 2.0, fallMaxDrop: 4.3, fallMaxDmg: 60
  },

  // balance V1 (spec) — se usa en P3/P4
  ZOMBIE: {
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
    intermission: 8,     // s de pausa entre rondas (spec)
    firstDelay: 3,       // s antes de la ronda 1
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
    firstRound: [5, 7], every: [5, 7],
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
    moon: { dir: [0.35, 0.42, -0.84], size: 22, color: 0xe8ecff, from: 0.55 },
    // F5.17b: domo del cielo (sigue a la cámara, adentro de camera.far): abajo el color de la niebla, arriba este
    sky: { dayTop: 0x5a3a78, nightTop: 0x080c1e, purpleTop: 0x2a0c48 }
  },
  // F5.16: niebla permanente (Diego): no se ve de un área a la otra. `clip` = camera.far: lo que queda más lejos
  // ni se dibuja (el frustum lo descarta). El cielo no se ve: el fondo es el color de la niebla
  FOG: { near: 6, far: 40, clip: 44, min: 20, max: 90 },   // F5.16: 30 -> 40 (pedido de Diego); Ajustes: min..max
  WEATHER: {
    darkBy: n => Math.max(0, Math.min(1, (n - 1) / 14)),
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
      model:'pistol', bodyColor:0x30343c, gripColor:0x6b4526
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
      damage:60, headshotMul:2, magSize:100, reserveMax:300,
      fireRate:120, auto:true, reloadTime:3800,
      range:100, spread:0.02, recoil:0.8, pellets:1, recoilReturn:0.38, fireShake:0.10, reloadAnim:'belt',
      model:'lmg', bodyColor:0x33372c, gripColor:0x4a3a28
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
      range:200, spread:0, recoil:3.0, pellets:1, recoilReturn:0.45, fireShake:0.35, adsFov:30,
      model:'sniper', bodyColor:0x2a2d31, gripColor:0x4e3a24
    },
    // flame: cono continuo. Cada fireRate ms aplica dps*fireRate/1000 a TODOS los zombies del cono.
    // mag = combustible (1 unidad por tick). hitPoints:0 -> los ticks no dan puntos de impacto (solo kill):
    // si no, 8 zombies en el cono = ~320 pts/s de farmeo.
    flamethrower: {
      id:'flamethrower', name:'FLAMETHROWER', papName:'HELLKISS', flame:true,
      dps:40, headshotMul:1, magSize:40, reserveMax:160,
      fireRate:250, auto:true, reloadTime:2500,
      range:6, coneDeg:15, spread:0, recoil:0.15, pellets:1, fireShake:0.03, hitPoints:0,
      model:'flamethrower', bodyColor:0x3b3f45, gripColor:0x2a2622
    },
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
    moveMul: 0.7          // velocidad ×0.7 apuntando (y no se corre)
  },
  // Mystery box. spots: centro de la caja por cuarto, contra una pared, fuera del grid navegable
  // (profundidad 0.7 < anillo no navegable). rot = yaw; la tapa abre hacia el frente (+Z local).
  BOX: {
    cost: 950, rollTime: 4, grabTime: 8, teddyChance: 0.15,
    teddyTime: 2.2, moveTime: 2.4,
    cycleStart: 0.07, cycleEnd: 0.45,     // s entre armas: arranca rápido y frena
    // F5.11: todas las armas (menos la M1911 y la Ola), y el langostino bailarín. weights: la Ray Gun sale menos
    pool: ['shotgun', 'smg', 'rifle', 'lmg', 'raygun', 'sniper', 'flamethrower', 'crossbow', 'revolver', 'doublebarrel',
           'uzi', 'ak47', 'deagle', 'spas', 'bow', 'bazooka', 'monkey'],
    weights: { raygun: 0.45 },            // el resto pesa 1
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
      R14:{ x: -47,    z: 39.45, rot: Math.PI }           // V2 F5.10: rancho, contra el cerco norte (F5.13: corrido)
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
  POWER: { lampMul: 1.35 },   // las 6 lámparas pasan a 'steady' y un 35% más fuertes
  // V2 F2: perks. Máquina contra la pared, dentro del anillo no navegable (no cambia el grid). Máx 4.
  PERKS: {
    max: 4,
    size: { w: 1.0, h: 2.0, d: 0.7 },
    jingleDist: 4,        // m: jingle al acercarse (una vez por visita, solo con power)
    list: {
      revive: { name: 'QUICK REVIVE', abbr: 'QR', cost: 500,  room: 'R1',  x: -5.45, z: 0,     rot:  Math.PI / 2, color: 0x4aa8ff },
      // F5.8: en el techo (level 1), sobre la sala, contra la baranda norte
      jugg:   { name: 'JUGGERNOG',    abbr: 'JG', cost: 2500, room: 'R11', x: 0, z: -49.4, rot: 0,     color: 0xd8322a },   // F5.16: al final del muelle (un solo acceso)
      speed:  { name: 'SPEED COLA',   abbr: 'SC', cost: 3000, room: 'R14', x: -52, z: 39.45, rot: Math.PI,     color: 0x3ac85a },   // F5.13: rancho, contra el cerco norte
      dtap:   { name: 'DOUBLE TAP',   abbr: 'DT', cost: 2000, room: 'R8',  x: 34.45, z: 10,    rot: -Math.PI / 2, color: 0xe8a22a },   // F5.8: pared este nueva
      stamin: { name: 'STAMIN-UP',    abbr: 'SU', cost: 2000, room: 'R21', x: -56.3, z: 86.5, rot: Math.PI, level: 1, color: 0xe8d24a },   // F5.17b: en el entrepiso del caparazón   // F5.17: adentro del caparazón, lado oeste  // F5.16: estación de policía
      // F5.11: Mule Kick (3 armas) en el búnker, contra la pared oeste (y = piso del búnker)
      mule:   { name: 'MULE KICK',    abbr: 'MK', cost: 4000, room: 'R16', x: -37.55, z: -78, rot:  Math.PI / 2, color: 0x4aa84a, y: -8 }
    },
    juggHealth: 250,      // vida máxima con Juggernog
    speedReload: 0.5,     // Speed Cola: tiempo de recarga ×0.5
    dtapRate: 1.33,       // Double Tap: cadencia ×1.33 ...
    dtapDamage: 1.33,     //             ... y daño ×1.33
    staminSpeed: 1.2,     // Stamin-Up: sprint ×1.2 ...
    staminTime: 2,        //            ... y stamina ×2 (8 s)
    reviveUses: 3,        // Quick Revive (solo, como Black Ops): se compra 3 veces por partida y desaparece
    reviveIframe: 2       // s de invulnerabilidad al revivir
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
    workshop: { room: 'R10', x: 9, z: -4.55, rot: Math.PI, w: 2.4, h: 0.95, d: 0.7 },   // F5.13: contra la cerca de la playa
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
    turtle: { x: -58, z: -54, scale: 2 },             // F5.10: el doble de grande (la caracola también)
    // F5.10: langostino bailarín al lado de la tortuga: aparece cuando las 3 cajas de almas están llenas
    shrimp: { x: -61.5, z: -54, scale: 2 },
    shellLand: { room: 'R19', x: -58, z: -33.2 },    // F5.13: enfrente de la boca (F5.15: la boca en z -35)
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
  RANCHO: {
    ropeH: 1.2,                                           // lazo D20: alto de reja (se dispara por encima)
    // F5.13: todo 15 m al oeste (x -56..-42). Cerco fijo al norte (z 40), contra el que se apoyan la caja y Speed Cola
    palapa: { x1: -54, x2: -44, z1: 24, z2: 34, h: 4.5 },  // postes en las 4 esquinas; techo de palma arriba (F5.11: 3.2 -> 4.5)
    props: [
      { id: 'billar', box: [-50.3, -47.7, 28.3, 29.7, 0.85] },
      { id: 'barra',  box: [-54.4, -49.6, 18.3, 19.1, 1.1] },   // F5.17 (Diego): contra el cerco sur (antes tapaba la salida de la tortuga)
      { id: 'posteP1', box: [-54.15, -53.85, 23.85, 24.15, 4.5] }, { id: 'posteP2', box: [-44.15, -43.85, 23.85, 24.15, 4.5] },
      { id: 'posteP3', box: [-54.15, -53.85, 33.85, 34.15, 4.5] }, { id: 'posteP4', box: [-44.15, -43.85, 33.85, 34.15, 4.5] },
      { id: 'cueva', box: [-70, -65, 31, 39, 3.6] }     // F5.16: la cueva de la tortuga (tortugario)
    ],
    backHedge: [-56, -46, 40],                              // cerco fijo del norte del rancho [x1, x2, z] (F5.15: x -46..-42 es H2)
    // F5.16 tanda C (Diego): sin el corral chico. El tortugario es un área abierta del tamaño del rancho, al oeste
    // (parte de R14), con huesos de zombies y de tortugas, y una cueva contra el borde oeste donde se esconde la
    // única tortuga viva (la trampa sale de ahí). La cueva es sólida (PROPS 'cueva'); `mouth` = la boca
    pen: { x1: -70, x2: -56, z1: 18, z2: 40 },
    cave: { x1: -70, x2: -65, z1: 31, z2: 39, h: 3.6, mouth: { x: -64.3, z: 35 } }   // (al norte: al sur la barra tapaba la salida)
  },
  // F5.13: cabeza de calamar gigante muerto en la playa del calamar (R19), con la boca al norte. Sale del piso
  // de a poco: `minRise` en la R1 y entera en `openRound`; recién ahí se entra por la boca (túnel de 4 m) a la
  // cámara del fondo, donde están las estatuas. Antes es un montículo sólido. El cuerpo se hunde en el mar (sur)
  // F5.15: más grande y larga (16 × 24, 9 m): túnel de 5 m con techo a tunnelH, cámara con techo a chamberH
  // (entra la cabeza del langostino)
  SQUIDHEAD: { x1: -66, x2: -50, z1: -59, z2: -35, h: 9, minRise: 0.3, openRound: 13,
               tunnel: [-60.5, -55.5, -46, -35], chamber: [-64, -52, -57.5, -46], tunnelH: 4.5, chamberH: 6 },
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
      { room: 'R17', x: -58, z: 64 }, { room: 'R15', x: 15, z: 50 },  { room: 'R20', x: 45, z: 64.5 },   // F5.15: áreas (F5.16: la del campamento, al sendero del templo)
      { room: 'R20', x: 80, z: 60 },  { room: 'R19', x: -48, z: -40 }, { room: 'R14', x: -45, z: 31 }
    ],
    every: [3, 4], openTime: 1.5, range: 1.8,
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
  LIFEGUARD: { x: -27, z: -20, w: 6, d: 3.4, h: 2.6 },
  // F5.13: templo estilo Tikal en la esquina NE. La cima (top) está a UP.y: entra al grid de arriba (los zombies
  // suben por las 2 rampas de piedra). Base sólida debajo de la cima; escalones bajos (tiers) sólidos alrededor,
  // sin tapar las rampas; santuario decorativo encima (collider de arriba: no se atraviesa). Afuera del templo,
  // pasto y un río en L que rodea la entrada (x 32..35 y z 51..54) con 3 puentes de 4 m y pirañas (GARDEN.piranhas)
  // F5.15: se mudó al anexo NE de la jungla (R20, x 55..95, z 55..100), más lejos de la casa y más grande: cima de
  // 14 × 14, anillo de escalones de 3 m y un SANTUARIO en la cima (cuarto de 10 × 10 con 2 puertas, techo a `h` m y
  // crestería de `comb` m) con el Pack-a-Punch adentro. Las rampas, 4 m de ancho
  TEMPLE: {
    // F5.16 (Diego): pegado a la esquina NE del anexo (+4 en x, +3 en z): los escalones tocan x 95 y z 100, no se
    // camina por detrás
    top: { x1: 78, x2: 92, z1: 83, z2: 97 },
    tiers: [[75, 78, 80, 88], [75, 78, 92, 100], [92, 95, 80, 100], [78, 83, 80, 83], [87, 92, 80, 83], [78, 92, 97, 100]], tierH: 1.6,
    ramps: [
      { x1: 69, x2: 78, z1: 88, z2: 92, steps: 16, dir: 1, bottom: [68, 90], top: [78, 90], stone: true, gap: ['x', 78, 88, 92] },
      { axis: 'z', x1: 83, x2: 87, z1: 74, z2: 83, steps: 16, dir: 1, bottom: [85, 73], top: [85, 83], stone: true, gap: ['z', 83, 83, 87] }
    ],
    // santuario [x1, x2, z1, z2], paredes de `t` m; puertas [eje de la pared, línea, desde, hasta]
    sanctum: { x1: 82, x2: 92, z1: 87, z2: 97, t: 0.5, h: 5, comb: 8,
               doors: [['z', 87, 85.5, 88], ['x', 82, 89, 91.5]] },
    river: { w: [60, 63, 66, 100], s: [60, 95, 66, 69],            // brazo oeste y brazo sur [x1, x2, z1, z2]
             bridges: [['w', 76, 80], ['w', 90, 94], ['s', 83, 87]] },   // F5.16: el del sur, con la rampa
    clear: [58, 95, 64, 100],                                       // sin árboles de jungla adentro
    // F5.17: cabezas colosales de piedra a los lados del camino del puente sur y estelas talladas (sólidas: PROPS)
    heads: [[80.5, 71.5, 0.25], [89.5, 71.5, -0.25]],
    stelae: [[71, 83.6, Math.PI / 2], [71, 96.4, Math.PI / 2], [81, 76.2, 0], [89, 76.2, 0]]
  },
  // F5.12: cercos que se compran y se queman (son puertas: CONFIG.DOORS, DOOR_LINKS). Al comprarlo arde `time` s
  // (llamas de un pool fijo a lo largo del cerco, se pone negro y se hunde) y después se abre
  BURN: {
    time: 2.2, flames: 10,
    // F5.15: las entradas de las áreas (estilo BO3): lianas que se queman en la boca de cada sendero
    hedges: [
      { id: 'H2', x1: -46, x2: -42, z1: 40,  z2: 40 },   // rancho -> claro del búnker (sendero norte del rancho)
      { id: 'H6', x1: 28,  x2: 33,  z1: 58,  z2: 58 },   // jardines norte -> templo
      { id: 'H8', x1: -47, x2: -42, z1: 18,  z2: 18 }    // rancho -> costa del calamar (sendero sur del rancho)
    ]
  },
  // F5.15: la espesura: la jungla vieja [x1, x2, z1, z2]. Lo que cae acá y no es un área ni un sendero no se
  // camina: world.js buildThicketWalls pone una pared de vegetación en cada borde con lo caminable
  THICKET: [[-75, 55, 40, 74], [-75, -20, -24, -4], [-75, -24, -4, 18], [-75, -27, 18, 40], [20, 55, -24, -4], [35, 55, -4, 40],
            [55, 95, 55, 100], [-75, -20, 74, 98]],   // F5.17: la espesura alrededor del patio del caparazón (claro hasta z 95)
  thicketWallH: 3,
  // F5.12: jungla. Árboles con tronco sólido cada ~spacing m (al azar con semilla fija, lejos de lo que hay que
  // usar), helechos, rocas, lianas y flores; y una franja tupida afuera del borde que tapa el vacío
  JUNGLE: { seed: 7, spacing: 7.5, jitter: 2.2, keepClear: 3.2, ferns: 680, rocks: 64, outer: 5 },   // F5.15: + el anexo
  // F5.11: decoración de los jardines. Reposeras sólidas (PROPS, contra los bordes: [x, z, largo a lo largo de
  // 'x' o 'z']), sombrillas y canteros de flores (solo dibujo, en garden.js buildGardenDecor)
  DECOR: {
    // F7c: la playa (solo dibujo, sin collider: no tocan el grid ni frenan balas). [x, z, rot]
    beach: {
      towels: [[-6, -14, 0.3, 0xd84a3a], [13, -17.5, -0.2, 0x3a8ad8], [-15, -8.5, 1.2, 0xf0c030], [4, -20.5, 0.9, 0x5ac86a]],
      umbrellas: [[-6.9, -15.3, 0xd84a3a], [13.9, -18.8, 0x3a8ad8], [4.9, -21.6, 0xf0f0e0]],
      castle: [1.5, -9], cooler: [-4.8, -13.3], ball: [15.5, -13], radio: [-15.8, -7.4],
      logs: [[-18, -21, 0.4], [17, -22.5, -0.3], [-2, -23, 1.2]],
      seaweed: 14, shells: 22, shoreZ: [-23.4, -19.5],
      crabs: 5, crabArea: [-18, 18, -23.2, -19.5], crabSpeed: 0.7, crabFlee: 2.5
    },
    loungers: [[-19, 54.5, 'z'], [-17.4, 54.5, 'z'], [7, 54.5, 'z'], [8.6, 54.5, 'z'], [25, 54.5, 'z'], [26.6, 54.5, 'z'],
               [-64, -9, 'x'], [-64, -7, 'x']],               // F5.15: a la costa del calamar (la jungla oeste es espesura)
    umbrellas: [[-18.2, 53.2], [7.8, 53.2], [25.8, 53.2], [-62.6, -8]],
    flowers: [[-22, -16, 40.4, 41.2], [0, 6, 40.4, 41.2], [18, 26, 40.4, 41.2], [-23.6, -22.9, 1.5, 5.8], [-23.6, -22.9, 8.3, 10],   // F5.17: sin pisar la caja de almas
              [34.2, 34.9, 35, 39.5], [-26.6, -25.9, 42, 50]]   // F5.15: el de x 34 no tapa H7
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
  SHELL: { x: -51, z: 81, a: 13, b: 11, h: 12, t: 0.6, rimH: 4.5,
           door: { id: 'D21', x1: -53, x2: -49, z: 70.4, h: 1.2, cost: 1250 },
           deck: { outer: [-58, -44, 75, 87], inner: [-55, -47, 78, 84] },
           ramp: { x1: -54, x2: -47, z1: 78.3, z2: 80.7, dir: 1, steps: 16, bottom: [-55, 79], top: [-47, 79], gap: ['x', -47, 78, 81], open: true },
           jump: ['z', 84, -54, -48],   // F5.17b: hueco en la baranda del entrepiso para tirarse al medio
           posts: [[-57.8, 75.2], [-44.2, 75.2], [-57.8, 86.8], [-44.2, 86.8], [-55, 77.8], [-47, 77.8], [-55, 84.2], [-47, 84.2],
                   [-57.8, 81], [-44.2, 81], [-51, 86.8]],
           feeders: [[-51.9, 73.9, 0.9], [-49.4, 74.7, -2.2], [-50.2, 72.6, 3.1]], cop: [-50.6, 73.8],
           bodies: [[-58.5, 78, 0.6], [-44.5, 85.6, 2.2], [-60.5, 84, -1.2], [-55.5, 67.2, 1.4], [-46.8, 66.6, 3.5]],
           jeep: [-63.4, -61.4, 60.5, 65], skylight: 1.42 },
  // F5.16: portal Templo ↔ Calamar, ida y vuelta, gratis. Solo el jugador:
  // F cerca del arco, fundido a negro (el de la escotilla) y aparece en `out` del otro. Los zombies no lo cruzan
  // (el flow field no lo ve: si no llegan, el watchdog los respawnea cerca). Sin collider: no toca el grid
  // F5.16b: sin portal al principio: una tumba en el lugar del arco del templo. Un tiro la hace sangrar `bleed` s y
  // aparecen los dos arcos. `cooldown` s entre usos. Los que te persiguen a menos de `carry` m cruzan con vos
  PORTAL: { use: 2.3, bleed: 1.5, cooldown: 2, carry: 20,
    temple: { room: 'R20', x: 65, z: 59.2, rot: 0,       out: [65, 61.2] },
    squid:  { room: 'R19', x: -45, z: -25, rot: Math.PI, out: [-45, -27] } },
  BUNKER: {
    // F5.12: se mudó bajo el mar, al sur del muelle (la jungla norte ocupaba sus x,z de antes)
    x1: -38, x2: -10, z1: -90, z2: -66, y: -8, h: 4,
    // F5.13: la entrada es un búnker de hormigón de 5.2 m de ancho (×4) contra la pared norte del sótano, con
    // puertas blindadas al frente (z2). F se usa delante de las puertas; el enlace de los zombies sale de ahí
    // F5.15: la entrada se mudó a la esquina NO (-73, 73), contra el borde norte, mirando al sur (face -1 = las
    // puertas en z1). Por fuera está medio destruida (bunker.js buildHatch)
    entrance: { x1: -72.6, x2: -67.4, z1: 71.2, z2: 74, h: 3.2, face: -1 },
    hatch:  { x: -70, z: 70.4, cell: [-71, 69], out: [-70, 69.2] },   // delante de las puertas, la celda del enlace, donde aparecés
    ladder: { x: -24, z: -89.4, cell: [-24, -89], out: [-24, -87.8] },   // abajo, contra la pared sur
    use: 1.6,              // m para usar la escotilla o la escalera con F
    fade: 0.35,            // s de fundido a negro (ida) y vuelta
    climbTime: 1.0,        // s que el zombie tarda en bajar o subir (escondido)
    bulbs: [[-31, -84], [-17, -84], [-31, -72], [-17, -72]],   // focos (sin luces: brillo pintado en el piso)
    teleporter: { x: -24, z: -67.6 },
    // estatuas de plantas a los dos lados de la entrada (F5.15: en la esquina, mirando al sur)
    statues: [{ x: -73.9, z: 71.6 }, { x: -66.1, z: 71.6 }],
    wakeKills: 5, wakeRadius: 4,     // F5.15: kills de cualquier tipo cerca de cada una para despertarla (antes, calamares)
    eatCrawlers: 6, eatDogs: 3, eatRange: 4,   // despierta, come arrastrados y perros del piso (una cada plantEatEvery)
    seahorse: { x: -54.5, z: -54, scale: 2 }   // caballito de mar con las otras estatuas (F5.13: en la cabeza del calamar)
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
      name: 'TURTLES', cost: 1500, time: 20, cooldown: 60, room: 'R14', lever: { x: -64.2, z: 30.2 },
      exit: { x: -64.3, z: 35 }, count: 1, stagger: 0, speed: 3.8, range: 26, reach: 1.2, eat: 0.35,
      radius: 0.45, scale: 1.7,
      biteRound: 10          // F5.11: hasta esta ronda matan de un mordisco; después cada uno saca la vida de la R10
    }
  },
  // V2 F5.6: jardines y techo. Ver src/garden.js
  GARDEN: {
    hedgeH: 2.2,          // cerco de arbustos (frena gente y balas, como una pared)
    // perros del jardín trasero: en una ronda normal desde fromRound, con el jugador en `room`, cada spawn tiene
    // `chance` de salir como perro desde un spawn del jardín. max por PARTIDA (no por ronda). Sin noche ni Max Ammo
    dogs: { room: 'R13', fromRound: 5, chance: 0.2, max: 3 },
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
            speed: 9, gravity: 9.8, hit: 15, radius: 1.5, life: 3, tick: 10, pool: 6 },
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
      // F5.11: jardín norte y el rancho hasta el mar
      { room: 'R15', x: -25.3, z: 54,   segs: 8, lean: 0.5, rot: 0.8 },  { room: 'R15', x: 13,   z: 54.8, segs: 9, lean: 0.4, rot: -0.5 },
      { room: 'R15', x: 33.8,  z: 41.5, segs: 7, lean: 0.6, rot: 2.2 },
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
        { x1: 16,  x2: 22,  lanes: [-2.5, 0, 2.5], out: 6, height: 1.85, flight: 1.0 },
        // F5.13: los 3 puentes del río del templo. axis 'z': saltan a lo largo de z (el puente va a lo largo de x);
        // x1/x2 = el ancho del puente en el eje del salto, lanes = posiciones sobre el otro eje
        // F5.15: los 3 puentes del río del templo, en el anexo NE
        { axis: 'z', x1: 76, x2: 80, lanes: [60.6, 61.5, 62.4], out: 1.2 },
        { axis: 'z', x1: 90, x2: 94, lanes: [60.6, 61.5, 62.4], out: 1.2 },
        { x1: 83, x2: 87, lanes: [66.6, 67.5, 68.4], out: 1.2 }
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
  PAP: { spot: { x: 87, z: 95.8, rot: Math.PI, y: 4.3, room: 'R20', level: 1 }, size: { w: 1.4, h: 1.8, d: 1.0 },
    // V2 F2b: la mejora. El arma entra, tarda `time` s y sale; tenés grabTime s para agarrarla o se pierde.
    // Mejorada: todo el daño ×dmgMul, cargador y reserva ×ammoMul, nombre papName, camo. Sin re-PaP.
    cost: 5000, time: 4, grabTime: 10, dmgMul: 2, ammoMul: 1.5,
    ammoCost: 2500 },     // munición de un arma mejorada en su pared (la normal cuesta ECONOMY.ammoCost)
  // V2 F2.5: generadores (se prenden de UN golpe de cuchillo) y cajas de almas. Los 4 + las 3 llenas
  // habilitan el Pack-a-Punch. Nada que ver con state.power (palanca del sótano, F2).
  // Spots contra la pared, dentro del anillo no navegable (como los de la caja): no cambian el grid.
  // rot: hacia dónde mira el frente (0 = +z, π/2 = +x, π = -z, -π/2 = -x)
  GENERATORS: {
    size: { w: 1.2, h: 1.1, d: 0.7 },
    spots: {
      muelle:  { room: 'R11', x: 3.45,  z: -47,   rot: -Math.PI / 2 },   // F5.6: lado este (al oeste entra la pasarela)
      caseta:  { room: 'R14', x: -49.5, z: 39.45, rot:  Math.PI },       // F5.16: en el rancho, contra el cerco norte (la clave no cambia: state.generators es nombre fijo)
      garaje:  { room: 'R21', x: -38.75, z: 81,  rot: -Math.PI / 2 },   // F5.17: adentro del caparazón, contra el borde este (la clave no cambia)
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
      piscina: { room: 'R8', x: 18.55,  z: 16.5, rot: Math.PI / 2 },     // franja oeste: D8, D9 y el puente
      pasillo: { room: 'R4', x: -3.45,  z: 26.5, rot: Math.PI / 2 }      // cruce D3/D5/D6
    }
  },
  // armas de pared. x,z = punto sobre el eje de la pared; face = hacia dónde mira la cara (+1 = +X)
  WALLBUYS: [
    { weapon:'shotgun', room:'R2', cost:1200, x: -8, z:11, face: 1 },
    { weapon:'smg',     room:'R3', cost:1500, x: 18, z: 9, face:-1 },
    // F5.16 (Diego): la casa queda con 3 (escopeta, subfusil, revólver; el machete es cuerpo a cuerpo) y cada área
    // con 1-2: rancho doble cañón + rifle · calamar LMG · búnker bazooka + Uzi · templo ballesta
    // (en tablón propio y a ~2.3 m de la espesura: los arbustos del borde tapaban la tiza pegada a la pared)
    { weapon:'rifle',   room:'R14', cost:2000, x:-42.7, z:21.6, face:-1, post:true },            // F5.17 (Diego: estaba en medio del camino): esquina SE del rancho
    { weapon:'lmg',     room:'R19', cost:2500, x:-60, z:-6.3, face:-1, axis:'z', post:true },    // F5.16: calamar, norte
    { weapon:'uzi',     room:'R21', cost:1200, x:-51, z:86.4, face:-1, axis:'z', level:1, post:true },   // F5.17: en el entrepiso del caparazón
    { weapon:'crossbow',room:'R20', cost:2000, x: 58, z:57.5, face: 1, axis:'z', post:true },    // F5.16: entrada del templo
    // V2 F3b. axis 'z' = pared a lo largo de x (face ±1 = hacia ±z). y = altura de la tiza (cerca de 1.2 m).
    // post = tablón propio (el muelle no tiene paredes). 'machete' no es arma de inventario: ver CONFIG.MACHETE
    // F5.13: en el tablón de la torre de salvavidas (CONFIG.LIFEGUARD), mirando a la casa
    { weapon:'revolver',     room:'R10', cost:900,  x: -27,  z:-17.9, face: 1, axis:'z', post:true },   // F5.15: torre en la playa oeste
    // F5.6: en el techo (level 1), en un tablón contra la baranda norte de la pasarela, sobre el dormitorio
    { weapon:'doublebarrel', room:'R14', cost:1500, x: -54.5, z:39.8, face:-1, axis:'z' },   // F5.16: baja del techo al cerco norte del rancho
    // F5.11: la bazooka en la pared este del búnker (floorY = su piso). Las demás armas nuevas, solo en la caja
    { weapon:'bazooka', room:'R16', floorY: -8, cost:3000, x:-10, z:-78, face:-1 },
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
      kaboom:       { color: 0xff6a1a, label: 'KABOOM',              burn: 5, points: n => 1000 + 50 * (n - 1) }
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
  AUDIO: {
    master: 0.7, sfx: 0.9, ambience: 0.35,
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
    D21:1250                       // F5.17: barricada de la policía en la boca del caparazón (F5.16: de la estación)
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

