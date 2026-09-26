//=== 2. WORLD ============================================================
let scene, camera, renderer, clock;
let weaponScene, weaponCamera;           // capa de armas (se renderiza encima)
const WORLD = {
  colliders: [],      // AABB para el jugador: {minX,maxX,minZ,maxZ,minY,maxY,tag}
  hitMeshes: [],      // meshes que detienen balas
  rooms: []
};

// grid de navegación 1x1 cubriendo todo el mapa (typed array, no Set)
// V2 F1: x [-21, 32) · z [-41, 42) — cubre playa y muelle (z -40) hasta el sótano (z 40) y la piscina (x 30)
const NAV = { minX: -76, minZ: -91, w: 172, h: 192 };   // F5.15: anexo del templo hasta x 95, z 100.   // F5.13: borde oeste en x -75. F5.12: jungla x -60..55, z hasta 74; búnker bajo el mar (z -90)   // F5.6/F5.7: jardines (x -27 / 35) y muelle hasta z -50; F5.10: rancho hasta x -41
NAV.cells = new Uint8Array(NAV.w * NAV.h);
// V2 F2.8: TODO el techo de la casa es sólido y caminable, a UP.y. Es un SEGUNDO NIVEL del grid: sus celdas
// van después de las del piso (índices NAV.w*NAV.h ..). La escalera del patio de la piscina lo enlaza con el
// piso, como las escaleras de la pileta. Techos, descanso y bordes son colliders 'overhead': el grid del
// piso, los zombies de abajo y la línea de vista del piso los ignoran (segmentClear capa 0).
// UP.mask (1x1) = dónde hay techo: los cuartos cerrados + rellenos de los huecos entre cuartos (si no, te
// caías a un bolsillo fuera del mapa) + el descanso. Bordes: hacia un lugar al aire libre (porche, patio,
// puente) quedan abiertos (te tirás; la caída te deja en PLAYER.fallHealth); hacia el vacío, un límite
// invisible (buildRoofEdges)
// F5.13: el grid de arriba llega hasta la esquina NE (x 55, z 74): la cima del templo está a la misma altura
// F5.15: el templo se mudó al anexo NE: el grid de arriba llega hasta x 92, z 98
// F5.17: el entrepiso del caparazón (x -58..-44): el grid de arriba arranca en x -62
const UP = { y: 4.3, x1: -62, z1: 4, w: 154, h: 94,
  fillers: [[8, 9, 14, 18], [13, 18, 14, 18], [16, 18, 18, 20], [-4, 4, 28, 30]],   // huecos entre cuartos
  landing: null,                          // F5.8: sin descanso (la escalera de la piscina se mudó al jardín trasero)
  // dir -1: sube hacia -x (de x2 a x1) · +1: sube hacia +x (de x1 a x2)
  // F5.8: escalera 1 en el cuadrado del jardín trasero, contra la pared este de la caseta (pasa por (25.6, 25.7)):
  // sube hacia el oeste hasta el techo de la caseta (x 24)
  // F5.11: ×3 de ancho (1.6 -> 4.8 m), creciendo hacia el sur (donde estaba Stamin-Up)
  // F5.16 (Diego): el techo de la casa es solo techo: sin escaleras 1 y 2 ni pasarela. El grid de arriba queda
  // para la cima del templo (el PaP) y sus rampas
  // F5.6: lo único caminable del techo (pedido de Diego: un tercio): una pasarela en S de ~6 m, de la escalera
  // de la piscina a la escalera 2. Sobre la caseta y el dormitorio, bajando por la cocina, y sobre la sala.
  // El resto del techo sigue sólido (UP.mask, levelAt, granadas) pero lo cierran barandas de madera
  // F5.7 (Diego): toda la cocina caminable (hasta (17, 5); su borde este da al patio de la piscina: te tirás)
  // y la sala ensanchada hasta su borde sur
  walk: [],
  // F5.8: todo el borde de la pasarela lleva baranda salvo estos huecos [eje, línea, desde, hasta]: la llegada de
  // las dos escaleras y un hueco de 2 m para tirarse al patio de la piscina (borde este de la cocina)
  gaps: [] };
UP.flights = [];
// F5.13: el templo (CONFIG.TEMPLE): su cima entra al techo (máscara y pasarela), con sus dos rampas de piedra
(T => {
  UP.walk.push([T.top.x1, T.top.x2, T.top.z1, T.top.z2]);
  for (const R of T.ramps) { UP.flights.push(R); UP.gaps.push(R.gap); }
})(CONFIG.TEMPLE);
// F5.17: el entrepiso del caparazón (4 tiras alrededor del hueco del medio) y su escalera
(S => {
  const [ox1, ox2, oz1, oz2] = S.deck.outer, [ix1, ix2, iz1, iz2] = S.deck.inner;
  UP.walk.push([ox1, ox2, oz1, iz1], [ox1, ox2, iz2, oz2], [ox1, ix1, iz1, iz2], [ix2, ox2, iz1, iz2]);
  UP.flights.push(S.ramp); UP.gaps.push(S.ramp.gap, S.jump);
})(CONFIG.SHELL);
// ¿(x, z) adentro de la elipse del caparazón, agrandada m metros? (0 = el borde de afuera)
function shellK(x, z, m) {
  const S = CONFIG.SHELL, a = S.a + (m || 0), b = S.b + (m || 0);
  return ((x - S.x) / a) ** 2 + ((z - S.z) / b) ** 2;
}
UP.cells = new Uint8Array(UP.w * UP.h);
UP.mask = new Uint8Array(UP.w * UP.h);     // hay techo (sólido)
UP.walkMask = new Uint8Array(UP.w * UP.h); // F5.6: se camina (pasarela + descanso)
// altura de la rampa de una escalera en x, medida en el borde delantero del cuerpo (r): nunca teletransporta
// F5.13: una escalera puede subir a lo largo de z (axis 'z', las rampas del templo). flightV = la misma escalera
// "vista" con x y z cambiados, así el resto de la lógica (pensada a lo largo de x) sirve igual
function flightV(S) {
  if (S.axis !== 'z') return S;
  return S._v || (S._v = { x1: S.z1, x2: S.z2, z1: S.x1, z2: S.x2, dir: S.dir });
}
function flightH(S, x, r, z) {
  const V = flightV(S), a = S.axis === 'z' ? z : x;
  const L = V.x2 - V.x1, k = V.dir < 0 ? (V.x2 - (a - r)) / L : ((a + r) - V.x1) / L;
  return UP.y * Math.min(1, Math.max(0, k));
}
function inFlight(S, x, z, r) {
  const V = flightV(S), a = S.axis === 'z' ? z : x, b = S.axis === 'z' ? x : z;
  return b >= V.z1 && b <= V.z2 && (V.dir < 0 ? a >= V.x1 && a <= V.x2 + r : a >= V.x1 - r && a <= V.x2);
}
function roofAt(x, z) {                   // ¿hay techo arriba de (x, z)?
  const ix = Math.floor(x) - UP.x1, iz = Math.floor(z) - UP.z1;
  return ix >= 0 && iz >= 0 && ix < UP.w && iz < UP.h && UP.mask[ix + iz * UP.w] === 1;
}
function walkAt(x, z) {                   // F5.6: ¿es parte de la pasarela (o el descanso)?
  const ix = Math.floor(x) - UP.x1, iz = Math.floor(z) - UP.z1;
  return ix >= 0 && iz >= 0 && ix < UP.w && iz < UP.h && UP.walkMask[ix + iz * UP.w] === 1;
}
NAV.base = NAV.w * NAV.h;                 // primer índice del nivel de arriba
NAV.total = NAV.base + UP.w * UP.h;
NAV.link = new Int32Array(NAV.total).fill(-1);   // F2.6: celda del otro extremo de una escalera, o -1
NAV.via = [];                                    // F2.8: por índice, recorrido fijo del enlace (escalera del techo)
function upIdx(x, z) {
  const ix = x - UP.x1, iz = z - UP.z1;
  if (ix < 0 || iz < 0 || ix >= UP.w || iz >= UP.h) return -1;
  return NAV.base + ix + iz * UP.w;
}
function isUp(x, z) { const i = upIdx(x, z); return i >= 0 && UP.cells[i - NAV.base] === 1; }
function inRect(r, x, z) { return x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]; }
// 1 = arriba del techo (o del descanso), 0 = piso
function levelAt(x, z, feet) { return feet > UP.y - 0.5 && roofAt(x, z) ? 1 : 0; }
function navIdx(x, z) {
  const ix = x - NAV.minX, iz = z - NAV.minZ;
  if (ix < 0 || iz < 0 || ix >= NAV.w || iz >= NAV.h) return -1;
  return ix + iz * NAV.w;
}
function isNav(x, z) { const i = navIdx(x, z); return i >= 0 && NAV.cells[i] === 1; }

// cuartos canónicos [xMin,xMax,zMin,zMax]. outdoor = sin techo ni tinte de interior
const ROOMS = [
  { id:'R1', name:'PORCHE',     x1:-6,  x2: 6,  z1:-4, z2: 4,  floor:'deck', outdoor:true },
  { id:'R2', name:'SALA',       x1:-8,  x2: 8,  z1: 4, z2:18,  floor:'woodLight' },
  { id:'R3', name:'COCINA',     x1: 8,  x2:18,  z1: 4, z2:14,  floor:'tile'  },
  { id:'R4', name:'PASILLO',    x1:-4,  x2: 4,  z1:18, z2:28,  floor:'wood'  },
  { id:'R5', name:'DORMITORIO', x1: 4,  x2:16,  z1:18, z2:30,  floor:'wood'  },
  { id:'R6', name:'GARAJE',     x1:-16, x2:-4,  z1:18, z2:30,  floor:'conc'  },
  { id:'R7', name:'SOTANO',     x1:-16, x2:-4,  z1:30, z2:40,  floor:'concWet' },
  // conector estructural de D4: R3 (z=14) y R5 (z=18) no son adyacentes.
  { id:'C4', name:'PASO COCINA',x1: 9,  x2:13,  z1:14, z2:18,  floor:'tile', hidden:true },
  // V2 F1. R9 va en x 16-24 (roadmap decía 18-26): así comparte pared con R5 y R8 (aprobado)
  // F2.6: x2 30 -> 31 (la franja entre la pileta y la pared este no tenía celdas navegables).
  // hole = pileta + el grosor de sus paredes (0.3) en los 3 lados sin rampa: el piso no se superpone a
  // las paredes (sus caras coplanares parpadeaban)
  // F5.8: x2 31 -> 35 (Diego: hasta el cerco del jardín); el pasillo exterior de z 10..20 pasó a ser piscina
  { id:'R8',  name:'PISCINA',    x1: 18, x2: 35, z1:  4, z2: 20, floor:'poolDeck', outdoor:true, hole:[21.7, 28.3, 8, 17.3] },
  { id:'R9',  name:'CASETA',     x1: 16, x2: 24, z1: 20, z2: 30, floor:'wood' },
  { id:'R10', name:'PLAYA',      x1:-20, x2: 20, z1:-24, z2: -4, floor:'sand', outdoor:true },
  { id:'R10', name:'PLAYA',      x1:-41, x2:-20, z1:-24, z2: -4, floor:'sand', outdoor:true, part:true },   // F5.15: la playa oeste (torre)
  // V2 F1.1: el muelle es una T. Tronco + plataforma del fondo, con el MISMO id: roomAt() devuelve la
  // primera caja que contiene el punto y los ROOMS.find(id) solo leen outdoor. part = no es un cuarto aparte
  // F5.6: más adentro del mar (tronco hasta z -44, plataforma z -50..-44) y un segundo acceso por x -17 (reja
  // D18) que se une a la plataforma por el oeste: queda un circuito. Todo R11 (4 cajas)
  { id:'R11', name:'MUELLE',     x1: -2, x2:  2, z1:-44, z2:-24, floor:'pier', outdoor:true },
  { id:'R11', name:'MUELLE',     x1: -4, x2:  4, z1:-50, z2:-44, floor:'pier', outdoor:true, part:true },
  // F5.16 (Diego): un solo acceso, como el original: sin segundo tronco, pasarela ni entrante (ni D18). Jugg al final
  // V2 F1.1: puente playa -> piscina. 6 m de ancho: es la única franja que toca la playa (x<=20) y la
  // piscina (x>=18) con 4 m o más. D13 (reja) del lado de la playa; hacia la piscina queda abierto
  { id:'C13', name:'PUENTE',     x1: 16, x2: 22, z1: -4, z2:  4, floor:'pier', outdoor:true, hidden:true },
  // V2 F5.6: Jardín Oeste, en L: al lado de la sala (desde la cerca de la playa) y del garaje/sótano. Solo se
  // entra por la reja D14 (desde la playa) y por la escalera 2 del techo. Taller de tablas al fondo
  { id:'R12', name:'JARDIN OESTE',  x1:-24, x2: -8, z1: -4, z2: 18, floor:'grass', outdoor:true },
  { id:'R12', name:'JARDIN OESTE',  x1:-27, x2:-16, z1: 18, z2: 40, floor:'grass', outdoor:true, part:true },   // F5.7: 3 m más ancho frente al taller
  // V2 F5.10: el jardín oeste sigue hasta x -41: rancho de playa (palapa con billar y barra, Speed Cola, lugar de
  // la caja) y tortugario con su trampa. Se entra solo por el lazo D20 (x -27, z 18..40) desde el jardín oeste
  // F5.13: el rancho se corrió 15 m al oeste y quedó abierto adentro de la jungla oeste (va antes que R17:
  // roomAt devuelve la primera caja que contiene el punto)
  { id:'R14', name:'RANCHO',        x1:-56, x2:-42, z1: 18, z2: 40, floor:'sand', outdoor:true },
  // F5.15: MAPA POR ÁREAS. La jungla vieja (CONFIG.THICKET) es espesura; se camina solo por las áreas y los
  // senderos (corridor: true, parte del área a la que llevan). Cada sendero tiene su entrada comprable (H2..H8)
  { id:'R14', name:'RANCHO',        x1:-42, x2:-27, z1: 26, z2: 31, floor:'jungle', outdoor:true, part:true, corridor:true },   // lazo D20
  // F5.16: el tortugario, del tamaño del rancho y abierto a él (misma área)
  { id:'R14', name:'TORTUGARIO',    x1:-70, x2:-56, z1: 18, z2: 40, floor:'sand', outdoor:true, part:true },
  // R15: los jardines del norte (detrás del sótano), abiertos a los dos jardines
  { id:'R15', name:'JARDINES NORTE',x1:-27, x2: 35, z1: 40, z2: 58, floor:'jungle', outdoor:true },
  // F5.16: 5 ÁREAS. Casa (playa, casa, jardines, muelle) ↔ Rancho (D20) y ↔ Templo (H6); Rancho ↔ Búnker (H2) y
  // ↔ Calamar (H8); Templo ↔ Calamar por el portal. Sin Campamento (R18), ni H3, H4, H5, H7
  // F5.17: el caparazón de la tortuga gigante (R21), ahuecado. Va antes que R17: roomAt devuelve la primera caja.
  // Es una elipse: 5 rectángulos adentro de ella la cubren casi toda. noFloor: su piso lo dibuja bunker.js
  { id:'R21', name:'GIANT SHELL', x1:-60,  x2:-42,  z1: 74,   z2: 88,   floor:'jungle', outdoor:true, noFloor:true },
  { id:'R21', name:'GIANT SHELL', x1:-63.5,x2:-38.5,z1: 78,   z2: 84,   floor:'jungle', outdoor:true, noFloor:true, part:true },
  { id:'R21', name:'GIANT SHELL', x1:-55,  x2:-47,  z1: 71,   z2: 91,   floor:'jungle', outdoor:true, noFloor:true, part:true },
  { id:'R21', name:'GIANT SHELL', x1:-59,  x2:-43,  z1: 73,   z2: 89,   floor:'jungle', outdoor:true, noFloor:true, part:true },
  { id:'R21', name:'GIANT SHELL', x1:-61,  x2:-40,  z1: 76,   z2: 86,   floor:'jungle', outdoor:true, noFloor:true, part:true },
  // R17: el claro del búnker (esquina NO), con un solo sendero: desde el rancho (H2). F5.17: crece al norte hasta z 95
  // (el patio del caparazón, con lugar para darle la vuelta)
  { id:'R17', name:'CLARO DEL BUNKER', x1:-75, x2:-42, z1: 53, z2: 74, floor:'jungle', outdoor:true },
  { id:'R17', name:'CLARO DEL BUNKER', x1:-46, x2:-42, z1: 40, z2: 53, floor:'jungle', outdoor:true, part:true, corridor:true },
  { id:'R17', name:'CLARO DEL BUNKER', x1:-67, x2:-35, z1: 74, z2: 95, floor:'jungle', outdoor:true, part:true },
  { id:'R17', name:'CLARO DEL BUNKER', x1:-42, x2:-35, z1: 72, z2: 74, floor:'jungle', outdoor:true, part:true },
  // R19: la playa del calamar y la costa oeste, con una sola entrada a pie: desde el rancho (H8)
  { id:'R19', name:'PLAYA DEL CALAMAR', x1:-75, x2:-41, z1:-60, z2: -4, floor:'sand', outdoor:true },
  { id:'R19', name:'PLAYA DEL CALAMAR', x1:-47, x2:-42, z1: -4, z2: 18, floor:'jungle', outdoor:true, part:true, corridor:true },
  // R20: el anexo NE con el templo, por un sendero desde los jardines norte (H6)
  { id:'R20', name:'TEMPLO',        x1: 55, x2: 95, z1: 55, z2: 100, floor:'jungle', outdoor:true },
  { id:'R20', name:'TEMPLO',        x1: 28, x2: 33, z1: 58, z2: 67, floor:'jungle', outdoor:true, part:true, corridor:true },
  { id:'R20', name:'TEMPLO',        x1: 33, x2: 55, z1: 62, z2: 67, floor:'jungle', outdoor:true, part:true, corridor:true },
  { id:'R20', name:'CHOQUE',        x1: 36, x2: 55, z1: 75, z2: 92, floor:'jungle', outdoor:true, part:true },   // F5.18: CONFIG.CRASH
  // F5.11: búnker bajo tierra (zona aparte, piso en CONFIG.BUNKER.y). Se dibuja en bunker.js (noFloor)
  { id:'R16', name:'BUNKER',        x1:-38, x2:-10, z1:-90, z2:-66, floor:'conc', outdoor:true, noFloor:true },   // F5.12: bajo el mar
  // V2 F5.6: Jardín Trasero, detrás del pasillo, el dormitorio y la caseta, con un pasillo al aire libre al este
  // de la piscina. Puertas desde la piscina (D15), el sótano (D16) y el pasillo (D17, por el hueco z 28..30)
  { id:'R13', name:'JARDIN TRASERO',x1: -4, x2: 35, z1: 30, z2: 40, floor:'grass', outdoor:true },
  { id:'R13', name:'JARDIN TRASERO',x1: -4, x2:  4, z1: 28, z2: 30, floor:'grass', outdoor:true, part:true },
  { id:'R13', name:'JARDIN TRASERO',x1: 31, x2: 35, z1: 20, z2: 30, floor:'grass', outdoor:true, part:true },   // F5.8: desde z 20
  // F5.7: el hueco de arena entre la caseta y el pasillo exterior ahora es jardín, con una fuente en el medio
  { id:'R13', name:'JARDIN TRASERO',x1: 24, x2: 31, z1: 20, z2: 30, floor:'grass', outdoor:true, part:true }
];

// qué cuartos une cada puerta (C4 es parte de D4 y C13 de D13, no cuentan como cuartos)
const DOOR_LINKS = {
  D1:['R1','R2'], D2:['R2','R3'], D3:['R2','R4'], D4:['R3','R5'], D6:['R4','R6'], D7:['R6','R7'],   // F5.15: sin D5, D9, D10
  D8:['R3','R8'], D11:['R1','R10'], D12:['R10','R11'],
  D13:['R10','R8'],
  D14:['R10','R12'],                           // F5.6: reja de la playa al jardín oeste
  D15:['R8','R13'], D16:['R7','R13'], D17:['R4','R13'],  // F5.6: jardín trasero
  D19:['R7','R12'],                            // F5.7: portón sótano -> jardín oeste (se abre solo con la energía)
  D20:['R12','R14'],                           // F5.10: lazo del jardín oeste (F5.15: sendero al rancho)
  // F5.15: las entradas de las áreas (lianas que se queman)
  H2:['R14','R17'], H6:['R15','R20'], H8:['R14','R19'],     // F5.16: sin H3, H4, H5 ni H7
  D21:['R17','R21']                                          // F5.17: la boca del caparazón (F5.16: estación de policía)
};

// piscina de R8: el ÚNICO lugar donde el piso no está en y=0. Rampa en el lado sur (z1 -> rampEnd),
// parte honda hasta z2. Los otros 3 bordes tienen un collider invisible (poolRim) que no frena balas.
// F2.6: el jugador se tira desde cualquier borde y sale solo por la rampa; los zombies entran y salen
// por la rampa y las escaleras (ladders). Ver buildPool().
const POOL = { x1: 22, x2: 28, z1: 8, z2: 17, rampEnd: 11.5, depth: 1.6,
  // F2.6: escaleras para zombies. Celda de abajo (pileta) <-> celda de arriba (orilla): un enlace del flow
  // field. El zombie las cruza en estado 'climb' (sin colisión). Solo por acá y por la rampa entran y salen
  ladders: [
    { id: 'N', bot: [25, 15], top: [25, 18] },     // la escalerilla de siempre (pared norte)
    { id: 'O', bot: [23, 13], top: [20, 13] },     // pared oeste
    { id: 'E', bot: [26, 13], top: [29, 13] }      // pared este (franja caminable desde F2.6)
  ] };
function groundY(x, z) {
  const P = POOL, B = CONFIG.BUNKER;
  if (x >= B.x1 && x <= B.x2 && z >= B.z1 && z <= B.z2) return B.y;   // F5.11: el búnker, bajo tierra
  if (x <= P.x1 || x >= P.x2 || z <= P.z1 || z >= P.z2) return 0;
  return -P.depth * Math.min(1, (z - P.z1) / (P.rampEnd - P.z1));
}

// collider sin mesh: frena jugador y zombies (y entra al grid), NO frena balas ni tapa la vista
function addBoundary(minX, maxX, minZ, maxZ, tag, minY, maxY) {
  const col = { minX, maxX, minY: minY === undefined ? 0 : minY, maxY: maxY === undefined ? CONFIG.WALL_H : maxY,
                minZ, maxZ, tag, mesh: null, solid: true };
  WORLD.colliders.push(col);
  return col;
}
// cuartos alcanzables desde el porche por puertas abiertas
// F5.6: pasos siempre abiertos que no son puertas: el techo une dos lugares por sus dos escaleras
const OPEN_LINKS = [['R12', 'R15'], ['R13', 'R15'],    // F5.16: sin el paso por el techo (R13 ↔ R12)    // F5.11: el jardín norte, abierto a los dos jardines
                    // F5.15: los arcos de la casa (sin D5, D9, D10). La jungla ya no da la vuelta: son áreas con entradas
                    ['R4', 'R5'], ['R8', 'R9'], ['R5', 'R9']];
function openRooms() {
  const seen = new Set(['R1']), q = ['R1'];
  while (q.length) {
    const r = q.shift();
    const links = [];
    for (const id in DOOR_LINKS) { const d = state.doors[id]; if (d && d.open) links.push(DOOR_LINKS[id]); }
    if (typeof portalOn === 'function' && portalOn()) links.push(['R20', 'R19']);   // F5.16: portal del templo
    if (state.doors.H8 && state.doors.H8.open) links.push(['R10', 'R19']);           // F5.17b: la pared de la playa se fue con H8
    for (const L of links.concat(OPEN_LINKS)) {
      const o = L[0] === r ? L[1] : L[1] === r ? L[0] : null;
      if (o && !seen.has(o)) { seen.add(o); q.push(o); }
    }
  }
  return [...seen];
}

// muebles. box = AABB sólido [x1, x2, z1, z2, alto]: collider (jugador, zombies, nav) + caja INVISIBLE en
// hitMeshes (frena balas; el raycaster no mira .visible). decor = solo visual, sin colisión.
// Es lógica: se construye con o sin tema. Las coordenadas coinciden con buildTheme() (si movés un mueble
// allá, movelo acá). Pegado a pared: el anillo no navegable ya lo cubre, no cambia caminos.
// F5.18: matriz de un auto del choque (CONFIG.CRASH.cars): parado en (x, z), girado ry y volcado (de techo o de costado).
// La usan PROPS (caja del collider) y el dibujo (garden.js buildCrash)
function crashFrame(c) {
  const [x, z, ry, , , flip] = c, side = flip === 'side';
  const e = new THREE.Euler(side ? Math.PI / 2 : Math.PI, ry, 0, 'YXZ');
  return new THREE.Matrix4().compose(new THREE.Vector3(x, side ? 0.92 : 1.5, z), new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(1, 1, 1));
}
// caja [x1, x2, z1, z2, alto] de una caja local [x1, x2, y1, y2, z1, z2] con la matriz M
function crashBox(M, b) {
  let x1 = Infinity, x2 = -Infinity, z1 = Infinity, z2 = -Infinity, y2 = 0;
  const v = new THREE.Vector3();
  for (const x of [b[0], b[1]]) for (const y of [b[2], b[3]]) for (const z of [b[4], b[5]]) {
    v.set(x, y, z).applyMatrix4(M);
    x1 = Math.min(x1, v.x); x2 = Math.max(x2, v.x); z1 = Math.min(z1, v.z); z2 = Math.max(z2, v.z); y2 = Math.max(y2, v.y);
  }
  return [x1, x2, z1, z2, y2];
}
const PROPS = [
  { id: 'sofa',        room: 'R2', box: [  2.05,   4.35, 16.85, 17.75, 0.92] },
  { id: 'tv',          room: 'R2', box: [ -7.78,  -7.25, 14.3,  15.5,  1.12] },
  { id: 'mesaVolcada', room: 'R2', box: [ -3.85,  -2.6,   8.95,  9.65, 0.45] },
  { id: 'gabinete',    room: 'R3', box: [ 13.35,  17.85, 13.14, 13.8,  0.95] },
  { id: 'refri',       room: 'R3', box: [  8.44,   9.2,  10.8,  12.6,  0.85] },
  { id: 'cama',        room: 'R5', box: [  4.25,   6.35, 18.2,  20.4,  0.65] },
  { id: 'mesaNoche',   room: 'R5', box: [  6.5,    7.0,  18.32, 18.78, 0.6 ] },
  { id: 'ropero',      room: 'R5', box: [ 15.2,   15.8,  26.25, 27.75, 2.2 ] },
  { id: 'camioneta',   room: 'R6', box: [ -8.7,   -4.8,  27.95, 29.8,  1.85] },
  { id: 'banco',       room: 'R6', box: [-15.8,  -15.1,  26.0,  27.6,  0.95] },
  { id: 'llantas',     room: 'R6', box: [-15.58, -14.62, 21.42, 22.38, 0.66] },
  { id: 'generador',   room: 'R7', box: [-15.7,  -14.5,  31.35, 33.25, 1.4 ] },
  { id: 'estante',     room: 'R7', box: [-13.55, -11.45, 39.34, 39.76, 1.8 ] },
  { id: 'cajas',       room: 'R7', box: [ -5.45,  -4.65, 30.65, 31.4,  1.2 ] },
  // V2 F1
  // F2.6: corridos al este con la pared nueva (x 31). El macetero, angosto, deja libre la columna x 29.5
  // F5.8: +4 en x con la pared este nueva (x 35)
  { id: 'reposera',    room: 'R8', box: [ 33.5,   34.7,   4.4,   6.2,  0.5 ] },
  { id: 'macetero',    room: 'R8', box: [ 33.95,  34.75, 16.5,  17.7,  0.9 ] },
  { id: 'catre',       room: 'R9', box: [ 16.5,   18.5,  29.0,  29.8,  0.5 ] },
  { id: 'locker',      room: 'R9', box: [ 23.2,   23.8,  21.0,  22.0,  1.9 ] },
  { id: 'escritorio',  room: 'R9', box: [ 23.1,   23.8,  26.0,  27.6,  0.8 ] },
  { id: 'palma1',      room: 'R10', box: [ -9.75,  -9.25, -7.75, -7.25, 3  ] },
  { id: 'palma2',      room: 'R10', box: [ 10.75,  11.25,-12.25,-11.75, 3  ] },
  { id: 'palma3',      room: 'R10', box: [-16.25, -15.75,-18.25,-17.75, 3  ] },
  { id: 'palma4',      room: 'R10', box: [ 12.75,  13.25, -6.25, -5.75, 3  ] },
  { id: 'cayuco',      room: 'R10', box: [  3.35,   6.65,-12.86,-11.14, 0.45] },
  { id: 'lancha',      room: 'R10', box: [-12.76,  -9.24,-17.78,-16.22, 0.5 ] },
  // F5.13: patas de la torre de salvavidas (el dibujo, en garden.js buildLifeguard)
  ...lifeguardLegs().map(([x, z], i) => ({ id: 'torre' + i, room: roomAt(x, z).id, box: [x - 0.15, x + 0.15, z - 0.15, z + 0.15, CONFIG.LIFEGUARD.h] })),
  // F5.7: palmeras de adorno de playa y jardines (el dibujo, en theme.js) y la fuente del jardín trasero
  ...CONFIG.GARDEN.palms.map((P, i) => ({ id: 'palmaJ' + i, room: P.room, box: [P.x - 0.25, P.x + 0.25, P.z - 0.25, P.z + 0.25, 3] })),
  (F => ({ id: 'fuente', room: 'R13', box: [F.x1, F.x2, F.z1, F.z2, F.h] }))(CONFIG.GARDEN.fountain),
  // F5.10: rancho (el dibujo, en garden.js buildRancho): billar en el medio de la palapa, barra contra el
  // cerco oeste y los 4 postes de la palapa
  ...CONFIG.RANCHO.props.map(p => ({ id: p.id, room: 'R14', box: p.box })),
  // F5.11: reposeras de los jardines (sólidas, contra los bordes; el dibujo en garden.js)
  ...CONFIG.DECOR.loungers.map(([x, z, ax], i) => ({ id: 'reposeraJ' + i, room: roomAt(x, z).id,
    box: ax === 'z' ? [x - 0.35, x + 0.35, z - 0.95, z + 0.95, 0.45] : [x - 0.95, x + 0.95, z - 0.35, z + 0.35, 0.45] })),
  // F5.11: macetas de las estatuas de plantas, a los lados de la entrada del búnker (el dibujo, en bunker.js)
  ...CONFIG.BUNKER.statues.map((s, i) => ({ id: 'estatua' + i, room: 'R17', box: [s.x - 0.4, s.x + 0.4, s.z - 0.4, s.z + 0.4, 0.9] })),
  // F5.17: cabezas colosales y estelas del templo (el dibujo, en garden.js buildTempleDress)
  ...CONFIG.TEMPLE.heads.map(([x, z], i) => ({ id: 'cabeza' + i, room: 'R20', box: [x - 1.0, x + 1.0, z - 0.95, z + 0.95, 2.3] })),
  ...CONFIG.TEMPLE.stelae.map(([x, z, r], i) => {
    const w = Math.abs(Math.sin(r)) > 0.5 ? [0.25, 0.5] : [0.5, 0.25];
    return { id: 'estela' + i, room: 'R20', box: [x - w[0], x + w[0], z - w[1], z + w[1], 2.6] };
  }),
  // F5.18: el choque al oeste del templo: autos volcados, el calamar muerto y el Sombrerón (el dibujo, en garden.js buildCrash)
  ...CONFIG.CRASH.cars.map((c, i) => ({ id: 'auto' + i, room: 'R20', box: crashBox(crashFrame(c), [-2.15, 2.15, 0, 1.5, -0.92, 0.92]) })),
  { id: 'calamarMuerto', room: 'R20', box: [CONFIG.CRASH.squid[0] - 1.9, CONFIG.CRASH.squid[0] + 1.9, CONFIG.CRASH.squid[1] - 1.6, CONFIG.CRASH.squid[1] + 1.6, 1.3] },
  { id: 'sombreronMuerto', room: 'R20', box: [CONFIG.CRASH.boss[0] - 1.5, CONFIG.CRASH.boss[0] + 1.5, CONFIG.CRASH.boss[1] - 0.7, CONFIG.CRASH.boss[1] + 0.7, 0.9] },
  // F5.17: postes del entrepiso del caparazón y el jeep de la policía volcado en el claro (el dibujo, en bunker.js)
  ...CONFIG.SHELL.posts.map(([x, z], i) => ({ id: 'shellPost' + i, room: 'R21', box: [x - 0.16, x + 0.16, z - 0.16, z + 0.16, UP.y - 0.3] })),
  (J => ({ id: 'jeep', room: 'R17', box: [J[0], J[1], J[2], J[3], 1.7] }))(CONFIG.SHELL.jeep),
  // decorativos: chicos, planos, colgados o fuera del mapa jugable
  ...['hamaca', 'letrero34B', 'placaMarena', 'arena', 'seVende'].map(id => ({ id, room: 'R1', decor: true })),
  ...['alfombra', 'cojin', 'tablas', 'botellas'].map(id => ({ id, room: 'R2', decor: true })),
  ...['silla', 'latas', 'puertaCaida', 'alacenas'].map(id => ({ id, room: 'R3', decor: true })),
  ...['mesita', 'maceta', 'cuadros', 'papelTapiz'].map(id => ({ id, room: 'R4', decor: true })),
  ...['ropa', 'lampara', 'sabana', 'puertaRopero'].map(id => ({ id, room: 'R5', decor: true })),
  ...['tablaSurf', 'tablaRota', 'ruedaSuelta', 'bidon'].map(id => ({ id, room: 'R6', decor: true })),
  ...['charcos', 'tuberias', 'palanca'].map(id => ({ id, room: 'R7', decor: true })),
  ...['bordeCurb', 'agua', 'escalerilla'].map(id => ({ id, room: 'R8', decor: true })),
  ...['redes', 'ventanaCaseta'].map(id => ({ id, room: 'R9', decor: true })),
  ...['troncos', 'algas', 'laguna'].map(id => ({ id, room: 'R10', decor: true })),
  ...['pilotes', 'faroles', 'bote'].map(id => ({ id, room: 'R11', decor: true }))
];
// F5.15: patas de la torre de salvavidas: 3 por lado a lo largo de x (la usan PROPS y el dibujo, garden.js)
function lifeguardLegs() {
  const L = CONFIG.LIFEGUARD, out = [];
  for (const a of [-1, 0, 1]) for (const b of [-1, 1]) out.push([L.x + a * (L.w / 2 - 0.15), L.z + b * (L.d / 2 - 0.15)]);
  return out;
}
function addPropCollider(p) {
  const b = p.box;
  const r = addBox(b[0], b[1], 0, b[4], b[2], b[3], PROP_HIT_MAT, 'prop:' + p.id);
  r.mesh.visible = false;
  p.collider = r.col;
  return r;
}
let PROP_HIT_MAT = null;
// F5.12: árboles de la jungla (semilla fija: siempre los mismos, con o sin tema). Solo en R15/R17/R18, lejos del
// borde de los otros cuartos, de los spawns, de las puertas y cercos, de la escotilla y de lo que ya hay.
// Cada uno es un PROPS sólido (el tronco); el dibujo, en garden.js buildJungle
const JUNGLE = { trees: [] };
function planJungle() {
  if (JUNGLE.trees.length) return;
  const J = CONFIG.JUNGLE, jung = new Set(['R15', 'R17', 'R20']);   // F5.16: sin campamento   // F5.15: + el anexo del templo
  let s = J.seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const avoid = [];
  SPAWN_POINTS.forEach(p => avoid.push([p.x, p.z]));
  CONFIG.GARDEN.palms.forEach(p => avoid.push([p.x, p.z]));
  CONFIG.DECOR.loungers.forEach(p => avoid.push([p[0], p[1]]));
  CONFIG.DECOR.umbrellas.forEach(p => avoid.push([p[0], p[1]]));
  const BK = CONFIG.BUNKER.entrance;                                  // F5.13: la entrada del búnker, más ancha
  // F5.15: libre el frente (escombros, cráter, estatuas): una grilla hasta 6 m hacia afuera
  const bkf = BK.face || 1, bkz = bkf > 0 ? BK.z2 : BK.z1;
  for (let k = -1; k <= 5; k++) for (let j = 0; j <= 3; j++) avoid.push([BK.x1 + (BK.x2 - BK.x1) * k / 4, bkz + bkf * (1 + j * 1.7)]);
  CONFIG.BUNKER.statues.forEach(p => avoid.push([p.x, p.z]));
  lifeguardLegs().forEach(p => avoid.push(p));                        // F5.15: la torre de salvavidas
  avoid.push([CONFIG.LIFEGUARD.x, CONFIG.LIFEGUARD.z + CONFIG.LIFEGUARD.d / 2 + 2]);   // y su tablón
  for (const B of CONFIG.BURN.hedges) for (let k = 0; k <= 8; k++) avoid.push([B.x1 + (B.x2 - B.x1) * k / 8, B.z1 + (B.z2 - B.z1) * k / 8]);
  const SJ = CONFIG.SHELL.jeep;                                        // F5.17: el jeep volcado y los policías muertos
  avoid.push([(SJ[0] + SJ[1]) / 2, (SJ[2] + SJ[3]) / 2]);
  CONFIG.SHELL.bodies.forEach(p => avoid.push([p[0], p[1]]));
  const TC = CONFIG.TEMPLE.clear;                                     // F5.13: el templo y su río, sin árboles
  const otherRoom = (x, z, m) => ROOMS.some(r => !jung.has(r.id) && x > r.x1 - m && x < r.x2 + m && z > r.z1 - m && z < r.z2 + m);
  for (let x = -75 + J.spacing / 2; x < 55; x += J.spacing) for (let z = -24 + J.spacing / 2; z < 74; z += J.spacing) {
    const tx = x + (rnd() - 0.5) * 2 * J.jitter, tz = z + (rnd() - 0.5) * 2 * J.jitter, big = rnd();
    const r = roomAt(tx, tz);
    if (!r || !jung.has(r.id) || r.corridor || tx < -73.5 || tx > 53.5 || tz > 72.5 || tz < -20) continue;   // F5.15: no en los senderos
    if (tx > TC[0] && tx < TC[1] && tz > TC[2] && tz < TC[3]) continue;
    if (otherRoom(tx, tz, 2.5) || shellK(tx, tz, 3) < 1) continue;    // F5.17: ni pegado al caparazón
    if (avoid.some(([ax, az]) => Math.hypot(ax - tx, az - tz) < J.keepClear)) continue;
    JUNGLE.trees.push({ x: tx, z: tz, big, id: 'arbol' + JUNGLE.trees.length, room: r.id });
  }
  // F5.15: el anexo del templo, en una pasada aparte (así la jungla de antes queda igual)
  for (let x = 55 + J.spacing / 2; x < 95; x += J.spacing) for (let z = 55 + J.spacing / 2; z < 100; z += J.spacing) {
    const tx = x + (rnd() - 0.5) * 2 * J.jitter, tz = z + (rnd() - 0.5) * 2 * J.jitter, big = rnd();
    const r = roomAt(tx, tz);
    if (!r || r.id !== 'R20' || r.corridor || tx < 56.5 || tx > 93.5 || tz < 56.5 || tz > 98.5) continue;
    if (tx > TC[0] && tx < TC[1] && tz > TC[2] && tz < TC[3]) continue;
    if (avoid.some(([ax, az]) => Math.hypot(ax - tx, az - tz) < J.keepClear)) continue;
    JUNGLE.trees.push({ x: tx, z: tz, big, id: 'arbol' + JUNGLE.trees.length, room: r.id });
  }
  for (const t of JUNGLE.trees) PROPS.push({ id: t.id, room: t.room, box: [t.x - 0.3, t.x + 0.3, t.z - 0.3, t.z + 0.3, 6] });
}
function buildPropColliders() {
  planJungle();                                    // F5.12: agrega los troncos de la jungla a PROPS
  PROP_HIT_MAT = new THREE.MeshBasicMaterial();
  for (const p of PROPS) if (!p.decor) addPropCollider(p);
}

// puntos de spawn fijos por cuarto (centros de celda validados contra el grid)
const SPAWN_POINTS = [
  { room:'R1', x:-4.5, z:-2.5 }, { room:'R1', x: 4.5, z:-2.5 },
  { room:'R1', x:-4.5, z: 2.5 }, { room:'R1', x: 4.5, z: 2.5 },
  { room:'R2', x:-6.5, z: 6.5 }, { room:'R2', x: 6.5, z: 6.5 },
  { room:'R2', x:-6.5, z:16.5 }, { room:'R2', x: 6.5, z:16.5 },
  { room:'R3', x:16.5, z: 5.5 }, { room:'R3', x:16.5, z:12.5 }, { room:'R3', x:10.5, z: 5.5 },
  { room:'R4', x:-2.5, z:26.5 }, { room:'R4', x: 2.5, z:26.5 }, { room:'R4', x:-2.5, z:19.5 },
  { room:'R5', x:14.5, z:28.5 }, { room:'R5', x: 5.5, z:28.5 }, { room:'R5', x:14.5, z:19.5 },
  { room:'R6', x:-14.5,z:19.5 }, { room:'R6', x:-14.5,z:28.5 }, { room:'R6', x:-6.5, z:19.5 },
  { room:'R7', x:-14.5,z:38.5 }, { room:'R7', x:-5.5, z:38.5 }, { room:'R7', x:-10.5,z:35.5 },
  { room:'R8', x:27.5, z: 7.5 }, { room:'R8', x:19.5, z:18.5 }, { room:'R8', x:25.5, z: 5.5 },
  { room:'R9', x:17.5, z:23.5 }, { room:'R9', x:22.5, z:28.5 },
  { room:'R10', x:-16.5,z:-21.5 }, { room:'R10', x:16.5,z:-21.5 }, { room:'R10', x:-16.5,z:-7.5 }, { room:'R10', x:16.5,z:-7.5 },
  { room:'R11', x:-0.5, z:-33.5 }, { room:'R11', x: 0.5, z:-30.5 },  // F1.1: ninguno en la plataforma del PaP
  // F5.6: jardines
  { room:'R12', x:-20.5, z: 1.5 }, { room:'R12', x:-12.5, z:14.5 }, { room:'R12', x:-20.5, z:34.5 },
  { room:'R13', x:  0.5, z:37.5 }, { room:'R13', x: 12.5, z:37.5 }, { room:'R13', x: 27.5, z:37.5 },
  { room:'R13', x: 33.5, z:22.5 }, { room:'R13', x: 29.5, z:28.5 },   // F5.7: y en el cuadrado (F5.8: 22.5, la pared norte de la piscina tapaba 20.5)
  { room:'R12', x:-25.5, z:26.5 },
  // F5.10: rancho (solo con el lazo D20 abierto: detrás de una puerta cerrada flowAt = -1)
  { room:'R14', x:-44.5, z:36.5 }, { room:'R14', x:-43.5, z:27.5 }, { room:'R14', x:-46.5, z:21.5 },   // F5.13: corrido
  { room:'R14', x:-60.5, z:21.5 }, { room:'R14', x:-61.5, z:37.5 },    // F5.16: tortugario
  { room:'R21', x:-55.5, z:88.5 }, { room:'R21', x:-46.5, z:88.5 }, { room:'R21', x:-41.5, z:76.5 },   // F5.17: adentro del caparazón
  { room:'R17', x:-64.5, z:92.5 }, { room:'R17', x:-37.5, z:92.5 }, { room:'R17', x:-36.5, z:75.5 },   // F5.17: el patio de atrás
  { room:'R10', x:-30.5, z:-14.5 },                                     // F5.15: la playa oeste
  { room:'R19', x:-48.5, z:-30.5 }, { room:'R19', x:-70.5, z:-30.5 },  // F5.13: playa del calamar
  { room:'R15', x:-22.5, z:52.5 }, { room:'R15', x: 2.5, z:53.5 }, { room:'R15', x: 30.5, z:52.5 },   // F5.11: jardín norte
  { room:'R16', x:-35.5, z:-69.5 }, { room:'R16', x:-12.5, z:-75.5 },   // F5.11: búnker (solo con la escotilla abierta)
  // F5.12: jungla
  // F5.15: por áreas (claro del búnker, jardines norte, costa del calamar, campamento y su sendero de arena)
  { room:'R17', x:-50.5, z:60.5 }, { room:'R17', x:-65.5, z:62.5 }, { room:'R15', x:-12.5, z:55.5 },
  { room:'R19', x:-50.5, z:-12.5 }, { room:'R19', x:-66.5, z:-14.5 },
  // F5.15: anexo del templo (afuera del río y en la franja oeste)
  { room:'R20', x: 57.5, z:60.5 }, { room:'R20', x: 72.5, z:58.5 }, { room:'R20', x: 90.5, z:60.5 }, { room:'R20', x: 57.5, z:90.5 },
  // F4: orilla del mar, solo para ahogados (pickSpawnPoint los separa por `sea`)
  // (z −22.5: la celda de −23.5 queda bloqueada por el límite del mar)
  { room:'R10', x:-13.5, z:-22.5, sea:true }, { room:'R10', x:-7.5, z:-22.5, sea:true },
  { room:'R10', x:  7.5, z:-22.5, sea:true }, { room:'R10', x:13.5, z:-22.5, sea:true }
];

//--- texturas procedurales por canvas (sin assets externos) ---
function makeTex(draw, rep = 1, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  // F5.17 (Diego: menos Minecraft): filtrado lineal y anisotrópico. Antes NearestFilter (píxeles cuadrados de cerca)
  t.anisotropy = texAniso();
  return t;
}
function noise(ctx, s, amount, alpha, h) {
  const img = ctx.getImageData(0, 0, s, h || s), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n; d[i+1] += n; d[i+2] += n;
  }
  ctx.putImageData(img, 0, 0);
}
// canvas no cuadrado (pieles de pared 2m x 4m, atlas)
function makeTexWH(w, h, draw, nearest) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (nearest === true) t.magFilter = THREE.NearestFilter;      // F5.17: lineal salvo que se pida
  t.anisotropy = texAniso();
  return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);
// manchas irregulares (sal, humedad, óxido, aceite)
function blotches(c, w, h, n, color, rMin, rMax) {
  c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = rnd(0, w), y = rnd(0, h), r = rnd(rMin, rMax);
    for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + rnd(-r, r) * .6, y + rnd(-r, r) * .6, r * rnd(.4, .9), 0, 7); c.fill(); }
  }
}
// chorreado vertical desde arriba (agua, óxido)
function drips(c, w, h, n, color, maxLen) {
  c.fillStyle = color;
  for (let i = 0; i < n; i++) { const x = rnd(0, w); c.fillRect(x, 0, rnd(1, 3), rnd(maxLen * .3, maxLen)); }
}
// tablones: horizontales (o verticales), junta oscura y veta
function planks(c, w, h, n, base, vertical, jitter) {
  const step = (vertical ? w : h) / n;
  for (let i = 0; i < n; i++) {
    const col = base[i % base.length];
    c.fillStyle = col;
    if (vertical) c.fillRect(i * step, 0, step, h); else c.fillRect(0, i * step, w, step);
    c.fillStyle = 'rgba(0,0,0,' + rnd(0, jitter || .12).toFixed(2) + ')';
    if (vertical) c.fillRect(i * step, 0, step, h); else c.fillRect(0, i * step, w, step);
    c.fillStyle = 'rgba(25,18,12,.45)';
    if (vertical) c.fillRect(i * step, 0, 1, h); else c.fillRect(0, i * step, w, 1);
  }
}
const TEX = {};
function buildTextures() {
  //--- pisos (128 = 2m, repeat por tamaño de cuarto) ---
  TEX.deck = makeTex((c, s) => {                                // porche: tablones grises + arena
    planks(c, s, s, 8, ['#8f8b82', '#98938a', '#87837b'], false, .15);
    noise(c, s, 26);
    blotches(c, s, s, 4, 'rgba(176,166,142,.16)', 6, 14);
    blotches(c, s, s, 3, 'rgba(186,176,150,.22)', 2, 4);
  });
  TEX.woodLight = makeTex((c, s) => {                           // sala: madera clara gastada
    planks(c, s, s, 6, ['#b09878', '#a89070', '#b8a07e'], false, .1);
    noise(c, s, 20);
    c.strokeStyle = 'rgba(80,60,40,.25)';
    for (let i = 0; i < 10; i++) { c.beginPath(); const x = rnd(0, s), y = rnd(0, s); c.moveTo(x, y); c.lineTo(x + rnd(-20, 20), y + rnd(-3, 3)); c.stroke(); }
    blotches(c, s, s, 2, 'rgba(60,45,30,.08)', 8, 18);
  });
  TEX.wood = makeTex((c, s) => {                                // pasillo / dormitorio
    planks(c, s, s, 6, ['#86705a', '#7d6852', '#8e7760'], false, .12);
    noise(c, s, 22);
    blotches(c, s, s, 2, 'rgba(40,30,20,.08)', 6, 14);
  });
  TEX.tile = makeTex((c, s) => {                                // cocina: azulejo sucio
    c.fillStyle = '#bab3a2'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      c.fillStyle = 'rgba(0,0,0,' + rnd(0, .08).toFixed(2) + ')'; c.fillRect(i * 32, j * 32, 32, 32);
    }
    noise(c, s, 14);
    c.fillStyle = 'rgba(70,64,52,.55)';
    for (let i = 0; i <= 4; i++) { c.fillRect(i * 32 - 1, 0, 2, s); c.fillRect(0, i * 32 - 1, s, 2); }
    blotches(c, s, s, 3, 'rgba(90,76,50,.1)', 6, 14);
    c.strokeStyle = 'rgba(40,36,30,.5)'; c.beginPath(); c.moveTo(40, 70); c.lineTo(58, 84); c.lineTo(62, 100); c.stroke();
  });
  TEX.conc = makeTex((c, s) => {                                // garaje: concreto con aceite
    c.fillStyle = '#7b7a76'; c.fillRect(0, 0, s, s);
    noise(c, s, 30);
    blotches(c, s, s, 1, 'rgba(25,22,20,.14)', 10, 18);
    c.strokeStyle = 'rgba(40,40,38,.4)'; c.beginPath(); c.moveTo(0, 90); c.lineTo(50, 84); c.lineTo(128, 96); c.stroke();
  });
  TEX.concWet = makeTex((c, s) => {                             // sótano: concreto húmedo
    c.fillStyle = '#5b5e5a'; c.fillRect(0, 0, s, s);
    noise(c, s, 26);
    blotches(c, s, s, 2, 'rgba(20,26,24,.14)', 10, 20);
    blotches(c, s, s, 3, 'rgba(60,80,50,.14)', 2, 5);
  });
  TEX.pier = makeTex((c, s) => {                                // muelle: tablones grises con huecos
    planks(c, s, s, 6, ['#8a857b', '#7f7a70', '#938e84'], true, .15);
    noise(c, s, 24);
    c.fillStyle = '#1c2a30';                                    // agua entre tablones
    for (let i = 1; i < 6; i++) c.fillRect(i * s / 6 - 1, 0, 3, s);
    c.fillRect(2 * s / 6 + 2, 40, s / 6 - 4, 22);               // tablón faltante
    blotches(c, s, s, 3, 'rgba(220,214,196,.18)', 3, 7);        // sal
  });
  TEX.poolDeck = makeTex((c, s) => {                            // borde de piscina: baldosa clara gastada
    c.fillStyle = '#b9b3a3'; c.fillRect(0, 0, s, s);
    noise(c, s, 16);
    c.fillStyle = 'rgba(80,76,66,.45)';
    for (let i = 0; i <= 2; i++) { c.fillRect(i * 64 - 1, 0, 2, s); c.fillRect(0, i * 64 - 1, s, 2); }
    blotches(c, s, s, 3, 'rgba(70,90,60,.14)', 6, 14);
  });
  TEX.poolTile = makeTex((c, s) => {                            // adentro de la piscina: azulejo celeste con lama verde
    c.fillStyle = '#6a9a8c'; c.fillRect(0, 0, s, s);              // verdoso: con el sol naranja se lee "piscina sucia"
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      c.fillStyle = 'rgba(0,0,0,' + rnd(0, .08).toFixed(2) + ')'; c.fillRect(i * 16, j * 16, 16, 16);
    }
    c.fillStyle = 'rgba(50,70,70,.5)';
    for (let i = 0; i <= 8; i++) { c.fillRect(i * 16, 0, 1, s); c.fillRect(0, i * 16, s, 1); }
    blotches(c, s, s, 7, 'rgba(70,100,40,.35)', 5, 14);
    noise(c, s, 14);
  });
  // F2.6: en ángulo rasante (paredes de la pileta, la orilla) el mipmap lavaba las juntas. Anisotrópico
  // hasta 8 (lo copian los clones de buildPool). Sin renderer real (tests) no hay capabilities
  const aniso = renderer && renderer.capabilities ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
  TEX.poolDeck.anisotropy = TEX.poolTile.anisotropy = aniso;

  //--- techo: lámina de zinc corrugada y oxidada ---
  TEX.tin = makeTex((c, s) => {
    for (let x = 0; x < s; x += 8) {
      c.fillStyle = '#8b8378'; c.fillRect(x, 0, 4, s);
      c.fillStyle = '#6d665d'; c.fillRect(x + 4, 0, 4, s);
    }
    noise(c, s, 18);
    blotches(c, s, s, 10, 'rgba(138,79,44,.55)', 5, 14);
    blotches(c, s, s, 6, 'rgba(94,53,32,.6)', 3, 8);
    drips(c, s, s, 14, 'rgba(120,64,34,.35)', 60);
  });
  TEX.ceil = TEX.tin;
  //--- puerta tapiada ---
  TEX.door = makeTex((c, s) => {
    planks(c, s, s, 5, ['#6e5a44', '#665340', '#75604a'], true, .15);
    noise(c, s, 22);
    c.save(); c.translate(s / 2, s / 2);
    c.fillStyle = '#4e3e2e';
    [0.9, -0.9].forEach(a => { c.save(); c.rotate(a); c.fillRect(-s * .75, -6, s * 1.5, 12); c.restore(); });
    c.restore();
    c.fillStyle = '#2a241e';
    for (let i = 0; i < 12; i++) c.fillRect(rnd(4, s - 6), rnd(4, s - 6), 2, 2);
    drips(c, s, s, 6, 'rgba(0,0,0,.18)', 50);
  });
  //--- pieles de pared: 128x256 = 2m de ancho x 4m de alto (v=0 piso, v=1 techo) ---
  const W = 128, H = 256, M = 64;                               // 64 px por metro
  const skin = draw => makeTexWH(W, H, draw);
  TEX.skin = {};
  TEX.skin.EXT = skin(c => {                                    // fachada: tablas pintadas turquesa, descascaradas
    planks(c, W, H, 16, ['#86a39c', '#7f9c95', '#8aa7a0'], false, .1);
    for (let i = 0; i < 26; i++) {                              // pintura saltada -> madera gris
      c.fillStyle = 'rgba(' + [139, 133, 122].join(',') + ',' + rnd(.6, 1).toFixed(2) + ')';
      c.fillRect(rnd(0, W), Math.floor(rnd(0, 16)) * 16 + rnd(2, 8), rnd(6, 30), rnd(3, 8));
    }
    noise(c, W, 22, 0, H);
    const g = c.createLinearGradient(0, H * .7, 0, H);          // sal/salitre abajo
    g.addColorStop(0, 'rgba(230,226,210,0)'); g.addColorStop(1, 'rgba(230,226,210,.35)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    drips(c, W, H, 8, 'rgba(60,50,40,.18)', 90);
  });
  TEX.skin.RAIL = makeTexWH(128, 64, (c, w, h) => {             // barandal: 1.2m de alto
    planks(c, w, h, 4, ['#8e8a80', '#86827a', '#95918a'], false, .15);
    noise(c, w, 24, 0, h);
    blotches(c, w, h, 3, 'rgba(220,214,196,.25)', 4, 8);
  });
  TEX.skin.TRIM = makeTex((c, s) => {
    planks(c, s, s, 4, ['#5c4a38', '#544434'], true, .15); noise(c, s, 20);
  });
  TEX.skin.R2 = skin(c => {                                     // sala: yeso durazno desteñido
    c.fillStyle = '#c4ad96'; c.fillRect(0, 0, W, H);
    noise(c, W, 18, 0, H);
    drips(c, W, H, 12, 'rgba(90,70,50,.18)', 140);
    blotches(c, W, H, 4, 'rgba(110,90,60,.14)', 10, 22);
    c.fillStyle = '#5a4430'; c.fillRect(0, H - 10, W, 10);     // zócalo
    c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(0, H - 11, W, 1);
  });
  TEX.skin.R3 = skin(c => {                                     // cocina: azulejo abajo (1.2m), yeso grasoso arriba
    c.fillStyle = '#b9ae8c'; c.fillRect(0, 0, W, H);
    noise(c, W, 16, 0, H);
    drips(c, W, H, 8, 'rgba(90,70,30,.2)', 100);
    const ty = H - 1.2 * M;
    c.fillStyle = '#d2cdbf'; c.fillRect(0, ty, W, H - ty);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) {
      c.fillStyle = (j === 0 ? 'rgba(80,130,125,' : 'rgba(0,0,0,') + (j === 0 ? '.55)' : rnd(0, .1).toFixed(2) + ')');
      c.fillRect(i * 16, ty + j * 16, 16, 16);
    }
    c.fillStyle = 'rgba(80,74,60,.5)';
    for (let i = 0; i <= 8; i++) c.fillRect(i * 16, ty, 1, H - ty);
    for (let j = 0; j <= 5; j++) c.fillRect(0, ty + j * 16, W, 1);
    blotches(c, W, H, 4, 'rgba(70,60,40,.2)', 6, 14);
  });
  TEX.skin.R4 = skin(c => {                                     // pasillo: papel tapiz de conchas despegado
    c.fillStyle = '#a3b6a2'; c.fillRect(0, 0, W, H);
    for (let y = 8; y < H; y += 24) for (let x = ((y / 24) % 2) * 12 + 4; x < W; x += 24) {
      c.fillStyle = '#ddd4c2';                                  // concha (abanico)
      c.beginPath(); c.moveTo(x, y + 6); c.arc(x, y + 6, 7, Math.PI * 1.1, Math.PI * 1.9); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(150,130,110,.6)';
      for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x, y + 6); c.lineTo(x + k * 3, y); c.stroke(); }
    }
    noise(c, W, 14, 0, H);
    for (let i = 0; i < 2; i++) {                               // parches despegados: yeso a la vista
      const x = rnd(0, W - 30), y = rnd(0, H - 60), w = rnd(14, 34), h = rnd(30, 80);
      c.fillStyle = '#aaa596';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + rnd(-6, 6)); c.lineTo(x + w * rnd(.6, 1), y + h); c.lineTo(x + rnd(-4, 6), y + h * rnd(.7, 1)); c.fill();
      c.fillStyle = 'rgba(240,235,220,.6)'; c.fillRect(x, y, w, 2);
    }
    drips(c, W, H, 6, 'rgba(70,60,40,.2)', 120);
  });
  TEX.skin.R5 = skin(c => {                                     // dormitorio: azul desteñido con moho
    c.fillStyle = '#8b9fa8'; c.fillRect(0, 0, W, H);
    noise(c, W, 18, 0, H);
    blotches(c, W, H, 5, 'rgba(40,52,40,.3)', 3, 9);
    drips(c, W, H, 10, 'rgba(60,70,60,.18)', 110);
    c.fillStyle = '#5b4a3a'; c.fillRect(0, H - 8, W, 8);
  });
  TEX.skin.R6 = skin(c => {                                     // garaje: bloque de concreto
    c.fillStyle = '#8a8985'; c.fillRect(0, 0, W, H);
    noise(c, W, 22, 0, H);
    c.fillStyle = 'rgba(60,60,58,.55)';
    for (let r = 0; r < H / 13; r++) {
      c.fillRect(0, r * 13, W, 1);
      for (let x = (r % 2) * 13; x < W; x += 26) c.fillRect(x, r * 13, 1, 13);
    }
    blotches(c, W, H, 1, 'rgba(20,20,18,.12)', 8, 14);
  });
  TEX.skin.R7 = skin(c => {                                     // sótano: concreto húmedo, línea de agua, moho
    c.fillStyle = '#676964'; c.fillRect(0, 0, W, H);
    noise(c, W, 24, 0, H);
    const wy = H - 1.0 * M;
    c.fillStyle = 'rgba(30,36,32,.45)'; c.fillRect(0, wy, W, H - wy);
    c.fillStyle = 'rgba(90,80,60,.5)'; c.fillRect(0, wy - 2, W, 3);
    blotches(c, W, H, 10, 'rgba(60,90,50,.35)', 2, 6);
    drips(c, W, H, 16, 'rgba(20,24,22,.3)', 200);
  });
  TEX.skin.R8 = skin(c => {                                     // patio de la piscina: estuco blanco-celeste, salitre
    c.fillStyle = '#c7cfc8'; c.fillRect(0, 0, W, H);
    noise(c, W, 18, 0, H);
    c.fillStyle = 'rgba(110,150,150,.35)'; c.fillRect(0, H - 0.5 * M, W, 0.5 * M);   // franja celeste abajo
    drips(c, W, H, 14, 'rgba(90,80,60,.2)', 150);
    blotches(c, W, H, 3, 'rgba(90,110,70,.18)', 6, 14);
    c.strokeStyle = 'rgba(60,60,55,.45)'; c.beginPath(); c.moveTo(30, 40); c.lineTo(44, 90); c.lineTo(38, 130); c.stroke();
  });
  TEX.skin.R9 = skin(c => {                                     // caseta: tablas de madera sin pintar
    planks(c, W, H, 5, ['#6f5a44', '#665240', '#77614a'], true, .18);
    noise(c, W, 22, 0, H);
    drips(c, W, H, 8, 'rgba(20,14,10,.25)', 180);
    blotches(c, W, H, 3, 'rgba(40,50,35,.25)', 4, 10);
  });
  //--- arena de afuera ---
  TEX.sand = makeTex((c, s) => {
    c.fillStyle = '#c9b48d'; c.fillRect(0, 0, s, s);
    noise(c, s, 20);
    c.strokeStyle = 'rgba(150,130,95,.35)';
    for (let y = 6; y < s; y += 11) { c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= s; x += 16) c.lineTo(x, y + Math.sin(x * .2 + y) * 2); c.stroke(); }
  });
  // F5.6: jardines. Pasto con matas y tierra; cerco de arbustos
  TEX.grass = makeTex((c, s) => {
    c.fillStyle = '#56703a'; c.fillRect(0, 0, s, s);
    noise(c, s, 30);
    blotches(c, s, s, 5, 'rgba(120,98,60,.25)', 4, 10);             // tierra
    for (let i = 0; i < 260; i++) {                                  // briznas
      c.strokeStyle = ['#6c8a44', '#4a6230', '#7e9a50'][i % 3];
      const x = Math.random() * s, y = Math.random() * s;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (Math.random() - .5) * 3, y - 3 - Math.random() * 4); c.stroke();
    }
  });
  TEX.hedge = makeTex((c, s) => {
    c.fillStyle = '#34502a'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 220; i++) {
      c.fillStyle = ['#3f6232', '#2a4222', '#4e7438', '#223a1c'][i % 4];
      const x = Math.random() * s, y = Math.random() * s, r = 2 + Math.random() * 5;
      c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    }
  });
  // F5.13: piedra del templo (bloques grises con musgo)
  TEX.stone = makeTex((c, s) => {
    c.fillStyle = '#8a8676'; c.fillRect(0, 0, s, s);
    noise(c, s, 34);
    c.strokeStyle = 'rgba(40,38,30,.55)'; c.lineWidth = 2;
    for (let y = 0; y < s; y += s / 4) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(s, y); c.stroke();
      const off = (y / (s / 4)) % 2 ? s / 4 : 0;
      for (let x = off; x < s; x += s / 2) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + s / 4); c.stroke(); }
    }
    blotches(c, s, s, 6, 'rgba(70,100,50,.3)', 5, 14);              // musgo
  });
  // F5.17: corteza (troncos de la jungla, postes de troncos) y roca con vetas (rocas, cueva, templo erosionado).
  // Claras: el color va por vértice
  TEX.bark = makeTex((c, s) => {
    c.fillStyle = '#bcb0a0'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * s, w = 1 + Math.random() * 3;
      c.fillStyle = Math.random() < 0.5 ? 'rgba(60,45,30,.35)' : 'rgba(230,220,200,.25)';
      c.beginPath(); c.moveTo(x, 0);
      for (let y = 0; y <= s; y += 16) c.lineTo(x + Math.sin(y * 0.08 + i) * 3, y);
      c.lineTo(x + w, s); c.lineTo(x + w, 0); c.fill();
    }
    noise(c, s, 30);
  }, 1, 128);
  TEX.thatch = makeTex((c, s) => {                               // F5.17: paja de los techos (palapa, bar)
    c.fillStyle = '#b8955a'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 520; i++) {
      const x = Math.random() * s, y = Math.random() * s, len = 10 + Math.random() * 22;
      c.strokeStyle = ['#c8a868', '#a07c44', '#d8b878', '#8a6a3a', '#b89050'][i % 5]; c.lineWidth = 1 + Math.random();
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (Math.random() - 0.5) * 5, y + len); c.stroke();
    }
    c.fillStyle = 'rgba(60,40,20,.35)';
    for (let y = 0; y < s; y += s / 4) c.fillRect(0, y, s, 2);    // hileras atadas
  }, 1, 128);
  TEX.rock = makeTex((c, s) => {
    c.fillStyle = '#b8b4aa'; c.fillRect(0, 0, s, s);
    noise(c, s, 46);
    blotches(c, s, s, 8, 'rgba(60,58,50,.25)', 6, 18);
    c.strokeStyle = 'rgba(40,38,34,.5)'; c.lineWidth = 1;
    for (let i = 0; i < 7; i++) { c.beginPath(); let x = Math.random() * s, y = Math.random() * s; c.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 30; y += Math.random() * 20; c.lineTo(x, y); } c.stroke(); }
  }, 1, 128);
  //--- grano genérico para props (se multiplica por color de vértice) ---
  TEX.grime = makeTex((c, s) => {
    c.fillStyle = '#dcdcdc'; c.fillRect(0, 0, s, s);
    noise(c, s, 36);
    c.fillStyle = 'rgba(0,0,0,.08)';
    for (let i = 0; i < 16; i++) c.fillRect(0, rnd(0, s), s, 1);
    blotches(c, s, s, 4, 'rgba(0,0,0,.1)', 6, 14);
  });
  buildAtlases();
}

//--- atlas: todo lo pintado (letreros, cuadros, arena, charcos) en UNA textura -> un draw call ---
// ATLAS.r[key] = [u0, v0, u1, v1]
const ATLAS = { r: {}, tex: null, win: null, wr: {} };
function atlasRect(key, x, y, w, h, S, SH, store) {
  (store || ATLAS.r)[key] = [x / S, 1 - (y + h) / SH, (x + w) / S, 1 - y / SH];
}
function buildAtlases() {
  const S = 512;
  ATLAS.tex = makeTexWH(S, S, c => {
    c.clearRect(0, 0, S, S);
    // cada dibujo queda recortado a su región: si no, se mete en la vecina (rayas de POWER en el charco)
    const region = (x, y, w, h, draw) => { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); draw(); c.restore(); };
    // 34B: tabla de madera, pintura blanca gastada
    planks(c, 256, 128, 3, ['#7a6248', '#715a42', '#806850'], false, .15);
    c.fillStyle = 'rgba(232,226,210,.88)'; c.font = 'bold 92px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('34B', 128, 68);
    c.fillStyle = '#7a6248';
    for (let i = 0; i < 40; i++) c.fillRect(rnd(40, 216), rnd(24, 110), rnd(2, 7), rnd(2, 5));   // pintura saltada
    // MARENA: placa de metal oxidada
    region(256, 0, 256, 128, () => {
      c.fillStyle = '#8a5a3a'; c.fillRect(256, 0, 256, 128);
      for (let i = 0; i < 30; i++) { c.fillStyle = 'rgba(' + (rnd(90, 150) | 0) + ',' + (rnd(50, 80) | 0) + ',30,.5)'; c.beginPath(); c.arc(256 + rnd(0, 256), rnd(0, 128), rnd(3, 14), 0, 7); c.fill(); }
      c.fillStyle = 'rgba(214,206,186,.85)'; c.font = 'bold 50px monospace';
      c.fillText('MARENA', 384, 64);
      for (let i = 0; i < 70; i++) { c.fillStyle = 'rgba(' + (rnd(110, 150) | 0) + ',70,40,.9)'; c.fillRect(256 + rnd(20, 236), rnd(34, 94), rnd(2, 9), rnd(2, 6)); }
      c.fillStyle = 'rgba(80,40,20,.5)';
      for (let i = 0; i < 9; i++) c.fillRect(256 + rnd(0, 256), 90, rnd(1, 3), rnd(10, 38));
      c.fillStyle = '#3a2a1e'; [[266, 10], [498, 10], [266, 114], [498, 114]].forEach(p => c.fillRect(p[0], p[1], 5, 5));
    });
    // cuadros (128x128 c/u)
    const frame = (x, y, draw) => {
      c.save(); c.beginPath(); c.rect(x, y, 128, 128); c.clip(); draw(x, y);
      c.fillStyle = 'rgba(210,200,180,.25)'; c.fillRect(x, y, 128, 128);   // desteñido
      c.restore();
    };
    frame(0, 128, (x, y) => {                                   // atardecer en la playa
      const g = c.createLinearGradient(0, y, 0, y + 128);
      g.addColorStop(0, '#6d4a6e'); g.addColorStop(.5, '#d98a58'); g.addColorStop(.62, '#e8c07a'); g.addColorStop(.63, '#4f6f78'); g.addColorStop(1, '#c9b48d');
      c.fillStyle = g; c.fillRect(x, y, 128, 128);
      c.fillStyle = '#f2d08a'; c.beginPath(); c.arc(x + 64, y + 78, 14, Math.PI, 0); c.fill();
    });
    frame(128, 128, (x, y) => {                                 // volcán y lago (Atitlán)
      c.fillStyle = '#9cb4bd'; c.fillRect(x, y, 128, 128);
      c.fillStyle = '#5b6b5a'; c.beginPath(); c.moveTo(x + 10, y + 90); c.lineTo(x + 64, y + 30); c.lineTo(x + 118, y + 90); c.fill();
      c.fillStyle = '#4c6f86'; c.fillRect(x, y + 90, 128, 38);
    });
    frame(256, 128, (x, y) => {                                 // cayuco en el mar
      c.fillStyle = '#86a2a8'; c.fillRect(x, y, 128, 128);
      c.fillStyle = '#3f6272'; c.fillRect(x, y + 70, 128, 58);
      c.fillStyle = '#7a4a2e'; c.beginPath(); c.moveTo(x + 30, y + 72); c.lineTo(x + 98, y + 72); c.lineTo(x + 88, y + 84); c.lineTo(x + 40, y + 84); c.fill();
    });
    frame(384, 128, (x, y) => {                                 // flores (buganvilia)
      c.fillStyle = '#6f7d5c'; c.fillRect(x, y, 128, 128);
      for (let i = 0; i < 26; i++) { c.fillStyle = ['#b5507a', '#c96a8e', '#e0a3b8'][i % 3]; c.beginPath(); c.arc(x + rnd(10, 118), y + rnd(10, 118), rnd(4, 9), 0, 7); c.fill(); }
    });
    // TV rota
    region(0, 256, 128, 128, () => {
      c.fillStyle = '#1b1e20'; c.fillRect(0, 256, 128, 128);
      c.strokeStyle = 'rgba(210,220,225,.7)'; c.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(52, 312); let px = 52, py = 312; for (let k = 0; k < 4; k++) { px += rnd(-28, 28); py += rnd(-28, 28); c.lineTo(px, py); } c.stroke(); }
    });
    // arena (transparente, borde irregular)
    const blob = (x, y, rgb, a) => {
      for (let i = 0; i < 40; i++) {
        const r = rnd(10, 34), cx = x + 64 + rnd(-30, 30), cy = y + 64 + rnd(-30, 30);
        const g = c.createRadialGradient(cx, cy, 1, cx, cy, r);
        g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
        c.fillStyle = g; c.fillRect(x, y, 128, 128);
      }
    };
    blob(128, 256, '176,166,142', .2);                          // arena apagada: el sol la satura
    blob(256, 256, '40,52,58', .35);                             // charco
    c.fillStyle = 'rgba(200,215,220,.25)'; c.fillRect(290, 300, 40, 2); c.fillRect(300, 320, 26, 2);
    // POWER: etiqueta de peligro
    region(384, 256, 128, 128, () => {
      c.fillStyle = '#d9b43a'; c.fillRect(384, 256, 128, 128);
      c.fillStyle = '#1c1a16';
      for (let i = -40; i < 128; i += 20) { c.beginPath(); c.moveTo(384 + i, 256); c.lineTo(394 + i, 256); c.lineTo(394 + i + 30, 286); c.lineTo(384 + i + 30, 286); c.fill(); }
      c.fillRect(384, 286, 128, 70);
      c.fillStyle = '#d9b43a'; c.font = 'bold 30px monospace'; c.fillText('POWER', 448, 322);
    });
    noise(c, S, 10);
    // ventana tapiada vista desde afuera (fachada)
    region(0, 384, 128, 128, () => {
      c.fillStyle = '#16130f'; c.fillRect(0, 384, 128, 128);
      for (let i = 0; i < 4; i++) { c.fillStyle = ['#6e5a44', '#665340'][i % 2]; c.save(); c.translate(64, 400 + i * 30); c.rotate(rnd(-.12, .12)); c.fillRect(-68, -9, 136, 18); c.restore(); }
    });
    // "SE VENDE" pintado a mano
    c.fillStyle = '#d8d0bc'; c.fillRect(128, 384, 256, 128);
    c.fillStyle = 'rgba(170,40,30,.85)'; c.font = 'bold 44px monospace'; c.fillText('FOR SALE', 256, 430);
    c.font = 'bold 22px monospace'; c.fillText('TEL 5? 34 ??', 256, 478);
  }, false);
  atlasRect('sign34', 0, 0, 256, 128, S, S);
  atlasRect('marena', 256, 0, 256, 128, S, S);
  atlasRect('pBeach', 0, 128, 128, 128, S, S);
  atlasRect('pVolcan', 128, 128, 128, 128, S, S);
  atlasRect('pBoat', 256, 128, 128, 128, S, S);
  atlasRect('pFlower', 384, 128, 128, 128, S, S);
  atlasRect('tv', 0, 256, 128, 128, S, S);
  atlasRect('sand', 128, 256, 128, 128, S, S);
  atlasRect('puddle', 256, 256, 128, 128, S, S);
  atlasRect('power', 384, 256, 128, 128, S, S);
  atlasRect('boarded', 0, 384, 128, 128, S, S);
  atlasRect('sevende', 128, 384, 256, 128, S, S);

  // ventanas (MeshBasic: "emiten" el atardecer). 2 vistas de 256x256
  ATLAS.win = makeTexWH(512, 256, c => {
    const view = (x, palmBroken, cracked) => {
      const g = c.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#4d3560'); g.addColorStop(.35, '#b0566a'); g.addColorStop(.6, '#f08a4c'); g.addColorStop(.7, '#ffcf7a');
      g.addColorStop(.71, '#5d6f80'); g.addColorStop(.85, '#3f5566'); g.addColorStop(.86, '#d9c08c'); g.addColorStop(1, '#b89e74');
      c.fillStyle = g; c.fillRect(x, 0, 256, 256);
      c.fillStyle = '#ffe2a0'; c.beginPath(); c.arc(x + 170, 180, 22, Math.PI, 0); c.fill();
      c.fillStyle = 'rgba(255,230,170,.6)'; for (let i = 0; i < 6; i++) c.fillRect(x + 150 + rnd(-10, 10), 186 + i * 5, rnd(20, 40), 2);
      // palmera: tronco y hojas secas colgando
      c.fillStyle = '#231a18'; c.strokeStyle = '#231a18'; c.lineWidth = 7;
      const bx = x + 60, top = palmBroken ? 110 : 60, lean = palmBroken ? 26 : 14;
      c.beginPath(); c.moveTo(bx, 256); c.quadraticCurveTo(bx + lean * .3, 170, bx + lean, top); c.stroke();
      c.lineWidth = 3;
      const fronds = palmBroken ? 4 : 7;
      for (let i = 0; i < fronds; i++) {
        const a = (i / fronds) * Math.PI - Math.PI * .05, len = rnd(40, 70);
        c.beginPath(); c.moveTo(bx + lean, top);
        c.quadraticCurveTo(bx + lean + Math.cos(a) * len * .7 * (i % 2 ? 1 : -1), top - 20, bx + lean + Math.cos(a) * len * (i % 2 ? 1 : -1), top + len * .8);
        c.stroke();
      }
      if (palmBroken) { c.lineWidth = 6; c.beginPath(); c.moveTo(bx + lean, top); c.lineTo(bx + lean + 50, top + 60); c.stroke(); }
      if (cracked) {
        c.strokeStyle = 'rgba(240,240,235,.75)'; c.lineWidth = 1.5;
        for (let i = 0; i < 10; i++) { c.beginPath(); c.moveTo(x + 150, 90); let px = x + 150, py = 90; for (let k = 0; k < 4; k++) { px += rnd(-40, 40); py += rnd(-40, 40); c.lineTo(px, py); } c.stroke(); }
        c.fillStyle = 'rgba(20,16,14,.85)'; c.beginPath(); c.moveTo(x + 130, 70); c.lineTo(x + 190, 60); c.lineTo(x + 175, 130); c.lineTo(x + 140, 115); c.fill();  // hueco
      }
    };
    view(0, true, false);
    view(256, false, true);
  }, false);
  atlasRect('palm', 0, 0, 256, 256, 512, 256, ATLAS.wr);
  atlasRect('sea', 256, 0, 256, 256, 512, 256, ATLAS.wr);

  TEX.shaft = makeTexWH(64, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,200,130,.9)'); g.addColorStop(1, 'rgba(255,170,90,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const e = c.createLinearGradient(0, 0, w, 0);
    e.addColorStop(0, 'rgba(0,0,0,1)'); e.addColorStop(.2, 'rgba(0,0,0,0)'); e.addColorStop(.8, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(0,0,0,1)');
    c.globalCompositeOperation = 'destination-out'; c.fillStyle = e; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
  }, false);
  TEX.dust = makeTexWH(32, 32, (c, w) => {
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 32, 32);
  }, false);
}

const MAT = {};
function buildMaterials() {
  const m = (map, extra) => new THREE.MeshLambertMaterial(Object.assign({ map }, extra || {}));
  MAT.wall = m(TEX.skin.TRIM);            // material de las cajas-pared originales (quedan ocultas si hay tema)
  MAT.deck = m(TEX.deck);
  MAT.woodLight = m(TEX.woodLight);
  MAT.wood = m(TEX.wood);
  MAT.tile = m(TEX.tile);
  MAT.conc = m(TEX.conc);
  MAT.concWet = m(TEX.concWet);
  MAT.sand = m(TEX.sand);
  MAT.pier = m(TEX.pier);
  MAT.poolDeck = m(TEX.poolDeck);
  MAT.poolTile = m(TEX.poolTile);
  MAT.ceil = m(TEX.ceil);
  MAT.door = new THREE.MeshLambertMaterial({ map: TEX.door, emissive: 0x1a0e06 });
  MAT.grass = m(TEX.grass);                    // F5.6
  MAT.jungle = m(TEX.grass); MAT.jungle.color.setHex(0x6a8a5a);   // F5.12: pasto de jungla, más oscuro
  MAT.hedge = m(TEX.hedge);
  MAT.stone = m(TEX.stone);                    // F5.13: templo
  MAT.gate = new THREE.MeshLambertMaterial({ map: TEX.door, color: 0x6a7076 });   // F5.7: portón de metal
  // F5.17: materiales de los MeshBuilder con formas curvas (color por vértice encima de la textura)
  MAT.bark = new THREE.MeshLambertMaterial({ map: TEX.bark, vertexColors: true });
  MAT.rock = new THREE.MeshLambertMaterial({ map: TEX.rock, vertexColors: true });
  MAT.grimeV = new THREE.MeshLambertMaterial({ map: TEX.grime, vertexColors: true });
  MAT.thatch = new THREE.MeshLambertMaterial({ map: TEX.thatch, vertexColors: true });
  MAT.thatchIn = new THREE.MeshLambertMaterial({ map: TEX.thatch, vertexColors: true, emissive: 0x2a1c0e });   // por debajo (si no, negro)
}

// caja genérica: registra mesh + collider
function addBox(minX, maxX, minY, maxY, minZ, maxZ, mat, tag, opts) {
  opts = opts || {};
  const w = maxX - minX, h = maxY - minY, d = maxZ - minZ;
  const g = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.set((minX+maxX)/2, (minY+maxY)/2, (minZ+maxZ)/2);
  mesh.userData.type = opts.type || 'world';
  mesh.userData.tag = tag;
  scene.add(mesh);
  WORLD.hitMeshes.push(mesh);
  const col = { minX, maxX, minY, maxY, minZ, maxZ, tag, mesh, solid: true };
  if (!opts.noCollide) WORLD.colliders.push(col);
  // escalar UV por tamaño para que la textura no se estire
  const tex = mat.map;
  if (tex) mesh.userData.uvScale = 1;
  return { mesh, col };
}

// muro axis-aligned entre dos puntos, con grosor
function addWall(x1, z1, x2, z2, h, mat, tag) {
  const t = CONFIG.WALL_T / 2;
  let minX, maxX, minZ, maxZ;
  if (Math.abs(x2 - x1) < 1e-6) {              // muro vertical (eje Z)
    minX = x1 - t; maxX = x1 + t;
    minZ = Math.min(z1, z2); maxZ = Math.max(z1, z2);
  } else {                                      // muro horizontal (eje X)
    minZ = z1 - t; maxZ = z1 + t;
    minX = Math.min(x1, x2); maxX = Math.max(x1, x2);
  }
  return addBox(minX, maxX, 0, h, minZ, maxZ, mat, tag || 'wall');
}

function floorMat(kind) {
  return { deck: MAT.deck, woodLight: MAT.woodLight, wood: MAT.wood, tile: MAT.tile,
           conc: MAT.conc, concWet: MAT.concWet, sand: MAT.sand, pier: MAT.pier, poolDeck: MAT.poolDeck,
           grass: MAT.grass, jungle: MAT.jungle }[kind] || MAT.wood;
}

function buildMap() {
  const H = CONFIG.WALL_H, R = CONFIG.RAIL_H;

  // --- pisos y techos ---
  ROOMS.forEach(r => {
    if (r.noFloor) { WORLD.rooms.push(r); return; }             // F5.11: el búnker se arma en buildBunkerShell
    // piso: un rectángulo, o 4 alrededor del hueco (piscina)
    const h = r.hole, pieces = !h ? [[r.x1, r.x2, r.z1, r.z2]] : [
      [r.x1, r.x2, r.z1, h[2]], [r.x1, r.x2, h[3], r.z2], [r.x1, h[0], h[2], h[3]], [h[1], r.x2, h[2], h[3]]];
    for (const [x1, x2, z1, z2] of pieces) {
      const mat = floorMat(r.floor).clone();
      mat.map = mat.map.clone();
      mat.map.needsUpdate = true;
      mat.map.repeat.set((x2 - x1) / 2, (z2 - z1) / 2);
      if (!r.outdoor) mat.color.setHex(CONFIG.THEME.interiorTint);   // interiores más oscuros (no hay sombras)
      addBox(x1, x2, -0.3, 0, z1, z2, mat, 'floor:' + r.id, { noCollide: true });
    }
    if (!r.outdoor) {
      const cm = MAT.ceil.clone();
      cm.color.setHex(CONFIG.THEME.ceilTint);
      cm.map = cm.map.clone(); cm.map.needsUpdate = true;
      cm.map.repeat.set((r.x2 - r.x1) / 2, (r.z2 - r.z1) / 2);
      // F2.8: el techo es sólido y caminable (nivel de arriba). overhead: el piso no lo ve; roofSurface: arriba es piso
      const ceil = addBox(r.x1, r.x2, H, H + 0.3, r.z1, r.z2, cm, 'ceil:' + r.id);
      ceil.col.overhead = true; ceil.col.roofSurface = true;
    }
    WORLD.rooms.push(r);
  });

  // --- R1 PORCHE: barandales (no paredes). El del frente tiene la reja D11 hacia la playa ---
  addWall(-6, -4, -1, -4, R, MAT.deck, 'rail');
  addWall( 1, -4,  6, -4, R, MAT.deck, 'rail');
  addWall(-6, -4, -6,  4, R, MAT.deck, 'rail');
  addWall( 6, -4,  6,  4, R, MAT.deck, 'rail');

  // --- R2 SALA ---
  addWall(-8, 4, -1, 4, H, MAT.wall);          // sur izq  (hueco D1 en x[-1,1])
  addWall( 1, 4,  8, 4, H, MAT.wall);          // sur der
  addWall(-8, 4, -8,18, H, MAT.wall);          // oeste
  addWall( 8, 4,  8, 8, H, MAT.wall);          // este bajo (hueco D2 en z[8,10])
  addWall( 8,10,  8,18, H, MAT.wall);          // este alto
  addWall(-8,18, -1,18, H, MAT.wall);          // norte izq (hueco D3 en x[-1,1])
  addWall( 1,18,  8,18, H, MAT.wall);          // norte der

  // --- R3 COCINA ---
  addWall( 8, 4, 18, 4, H, MAT.wall);          // sur
  addWall(18, 4, 18,11, H, MAT.wall);          // este bajo (hueco D8 en z[11,13]; el subfusil está en z 9)
  addWall(18,13, 18,14, H, MAT.wall);          // este alto
  addWall( 8,14,  9,14, H, MAT.wall);          // norte izq (hueco D4 en x[9,13])
  addWall(13,14, 18,14, H, MAT.wall);          // norte der

  // --- C4 conector cocina→dormitorio ---
  addWall( 9,14,  9,18, H, MAT.wall);
  addWall(13,14, 13,18, H, MAT.wall);

  // --- R4 PASILLO ---
  addWall(-4,18, -4,22, H, MAT.wall);          // oeste bajo  (hueco D6 en z[22,24])
  addWall(-4,24, -4,28, H, MAT.wall);          // oeste alto
  addWall( 4,18,  4,22, H, MAT.wall);          // este bajo   (hueco D5 en z[22,24])
  addWall( 4,24,  4,28, H, MAT.wall);          // este alto
  addWall(-4,28, 1.5,28, H, MAT.wall);         // norte (F5.6: hueco D17 en x[1.5,3.5] al jardín trasero;
  addWall(3.5,28, 4,28, H, MAT.wall);          //        la caja del pasillo está en x 0)

  // --- R5 DORMITORIO ---
  addWall( 4,18,  9,18, H, MAT.wall);          // sur izq (hueco C4 en x[9,13])
  addWall(13,18, 16,18, H, MAT.wall);          // sur der
  addWall(16,18, 16,20, H, MAT.wall);          // este bajo (hueco D10 en z[20,22])
  addWall(16,22, 16,30, H, MAT.wall);          // este alto (rifle en z 24, del lado de R5)
  addWall( 4,30, 16,30, H, MAT.wall);          // norte
  addWall( 4,28,  4,30, H, MAT.wall);          // oeste (tramo fuera del pasillo)

  // --- R6 GARAJE ---
  addWall(-16,18, -4,18, H, MAT.wall);         // sur
  addWall(-16,18,-16,30, H, MAT.wall);         // oeste
  addWall(-16,30,-11,30, H, MAT.wall);         // norte izq (hueco D7 en x[-11,-9])
  addWall( -9,30, -4,30, H, MAT.wall);         // norte der
  addWall( -4,28, -4,30, H, MAT.wall);         // este (tramo fuera del pasillo)

  // --- R7 SOTANO ---
  addWall(-16,30,-16,35, H, MAT.wall);         // oeste (F5.7: hueco del portón D19 en z[35,37], al jardín oeste)
  addWall(-16,37,-16,40, H, MAT.wall);
  addWall( -4,30, -4,36, H, MAT.wall);         // este (F5.6: hueco D16 en z[36,38]; la caja está en z 34)
  addWall( -4,38, -4,40, H, MAT.wall);
  addWall(-16,40, -4,40, H, MAT.wall);

  // --- R8 PISCINA (patio sin techo) ---
  addWall(22, 4, 35, 4, H, MAT.wall);          // sur (F1.1: abierto en x[18,22] hacia el puente C13; F5.8: hasta x 35)
  addWall(35, 4, 35,20, H, MAT.wall);          // este (F5.8: x 31 -> 35)
  addWall(18,14, 18,20, H, MAT.wall);          // oeste (tramo fuera de la cocina)
  addWall(16,20, 20,20, H, MAT.wall);          // norte izq, compartida con R9 (hueco D9 en x[20,22])
  addWall(22,20, 30.1,20, H, MAT.wall);        // norte der (F5.8: hueco D15 en x[30.1,32.1], al jardín trasero)
  addWall(32.1,20, 35,20, H, MAT.wall);

  // --- R9 CASETA ---
  addWall(16,30, 24,30, H, MAT.wall);          // norte
  addWall(24,20, 24,30, H, MAT.wall);          // este
  buildRoof();                                 // F2.8: techo caminable + escalera desde el patio

  // --- R10 PLAYA: cerca baja contra el patio de la casa; mar y costados = límite invisible ---
  addWall(-20, -4, -14, -4, R, MAT.deck, 'rail');  // F5.6: hueco D14 en x[-14,-10] al jardín oeste
  addWall(-10, -4, -6, -4, R, MAT.deck, 'rail');
  addWall(  6, -4, 16, -4, R, MAT.deck, 'rail');   // F1.1: la reja D13 va en x[16,20]
  // (F5.11: el límite oeste de la playa es la cerca del rancho; F5.12: los dos costados son cercos que se queman)
  addBoundary(-20.2,  -2,   -24.2, -23.8, 'bound:mar');   // F5.16: sin el hueco del segundo muelle
  addBoundary(  2,    20.2, -24.2, -23.8, 'bound:mar');
  addBoundary( 20.2,  55.2, -24.2, -23.8, 'bound:mar');   // F5.12: la orilla de la jungla este
  // F5.12: borde de afuera del mapa (la jungla tupida lo tapa) y la laguna del puente, que no se pisa
  // F5.13: el oeste pasa a x -75 (y baja hasta z -60 por la lengua de arena)
  addBoundary(-75.2, -74.8, -60, 98.2, 'bound:jungla');           // F5.17: hasta z 98 (el patio del caparazón)
  addBoundary( 54.8,  55.2, -24, 55.2, 'bound:jungla');           // F5.15: de z 55 a 74 se pasa al anexo del templo
  addBoundary(-75.2, -67.2, 73.8, 74.2, 'bound:jungla');           // F5.17: con el hueco del patio (x -67..-35)
  addBoundary(-34.8,  55.2, 73.8, 74.2, 'bound:jungla');
  addBoundary(-75.2, -19.8, 97.8, 98.2, 'bound:jungla');           // F5.17: la espesura alrededor del patio
  addBoundary(-20.2, -19.8, 74, 98, 'bound:jungla');
  // F5.15: el anexo NE del templo (R20, x 55..95, z 55..100)
  addBoundary( 54.8,  55.2, 73.8, CONFIG.CRASH.gap[0], 'bound:jungla');   // F5.18: hueco al choque (z gap)
  addBoundary( 54.8,  55.2, CONFIG.CRASH.gap[1], 100.2, 'bound:jungla');
  addBoundary( 55,    95.2, 54.8, 55.2, 'bound:jungla');
  addBoundary( 94.8,  95.2, 54.8, 100.2, 'bound:jungla');
  addBoundary( 54.8,  95.2, 99.8, 100.2, 'bound:jungla');
  addBoundary( 22,    35,   -4.2, -3.8, 'bound:laguna');
  addBoundary( 34.8,  35.2, -4, 4, 'bound:laguna');

  // --- C13 PUENTE playa -> piscina: barandales sobre la laguna (la laguna es solo tema) ---
  addWall(16, -4, 16,  4, R, MAT.deck, 'rail');  // oeste (termina contra la pared sur de la cocina)
  addWall(22, -4, 22,  4, R, MAT.deck, 'rail');  // este
  addWall(20, -4, 22, -4, R, MAT.deck, 'rail');  // sur, fuera de la playa (la playa termina en x=20)

  // --- R11 MUELLE: sin barandal, límite invisible en todo el borde ---
  // F5.6: tronco hasta z -44 y plataforma z -50..-44. F5.16: un solo acceso (sin segundo tronco ni pasarela)
  addBoundary(-2.2, -1.8, -44, -24, 'bound:muelle');          // tronco
  addBoundary( 1.8,  2.2, -44, -24, 'bound:muelle');
  addBoundary(-4.2, -1.8, -44.2, -43.8, 'bound:muelle');      // hombro oeste
  addBoundary( 1.8,  4.2, -44.2, -43.8, 'bound:muelle');      // hombro este
  addBoundary( 3.8,  4.2, -50, -44, 'bound:muelle');          // plataforma: este
  addBoundary(-4.2, -3.8, -50, -44, 'bound:muelle');          //   oeste
  addBoundary(-4.2,  4.2, -50.2, -49.8, 'bound:muelle');      //   fondo

  // --- F5.6 JARDINES: cerco de arbustos (frena todo, como una pared; no es 'wall': el tema no le pone piel) ---
  const HG = CONFIG.GARDEN.hedgeH, hedge = (x1, z1, x2, z2) => addWall(x1, z1, x2, z2, HG, MAT.hedge, 'hedge');
  // F5.12: los cercos que separan el rancho, la playa y la jungla son puertas que se queman (H1..H5, más abajo);
  // los que solo dividían jardines (norte y este) se sacaron
  hedge(-27, 18, -24, 18);                     // R12: escalón donde se ensancha (F5.7)
  hedge(-24, -4, -24, 10);                     // R12: oeste fijo (la caja de almas 'sotano' se apoya acá; H1 sigue)
  const RB = CONFIG.RANCHO.backHedge;
  hedge(RB[0], RB[2], RB[1], RB[2]);           // R14: cerco norte fijo del rancho (caja y Speed Cola se apoyan acá)
  addBoundary(-41.2, -20.2, -24.2, -23.8, 'bound:mar');   // el mar entre la playa y la lengua de arena
  // F5.13: la lengua de arena del calamar (x -75..-41, z -60..-24): su costa este y sur
  addBoundary(-41.2, -40.8, -60, -24, 'bound:mar');
  addBoundary(-75.2, -40.8, -60.2, -59.8, 'bound:mar');
  // (F5.16: sin el corral chico: el tortugario es un área abierta al oeste del rancho)
  hedge(-24, -4, -20, -4);                     //      sur, fuera de la playa
  hedge( -8, -4,  -8,  4);                     //      este, entre la cerca y la sala
  // F5.15: la playa oeste y la costa del calamar comparten el borde x -41. F5.16: cerco fijo entero (sin H5): al
  // calamar se llega por el rancho (H8) o por el portal del templo
  WORLD.beachWall = addWall(-41, -24, -41, -4, HG, MAT.hedge.clone(), 'hedge');   // F5.17b: se quema y se abre con H8 (rancho -> calamar)
  WORLD.beachWall.y0 = WORLD.beachWall.mesh.position.y;
  // (F5.12: sin cerco este del jardín trasero: sigue la jungla este)
  // (F5.7: el hueco entre la caseta y el pasillo exterior ya no está cercado: es parte del jardín)

  buildPool();

  // --- PUERTAS (bloques sólidos; la compra vive en ECONOMY) ---
  makeDoor('D1', -1, 1, 4, 4);
  makeDoor('D2', 8, 8, 8, 10);
  makeDoor('D3', -1, 1, 18, 18);
  makeDoor('D4', 9, 13, 14, 14);
  makeDoor('D6', -4, -4, 22, 24);                // (F5.15: D5, D9 y D10 quedan como arcos abiertos)
  makeDoor('D7', -11, -9, 30, 30);
  makeDoor('D8', 18, 18, 11, 13);
  makeDoor('D11', -1, 1, -4, -4, R);           // reja de madera del porche (alto de barandal)
  makeDoor('D12', -2, 2, -24, -24, R);         // reja del muelle
  makeDoor('D13', 16, 20, -4, -4, R);          // F1.1: reja del puente a la piscina
  makeDoor('D14', -14, -10, -4, -4, R);        // F5.6: reja de la playa al jardín oeste
  makeDoor('D15', 30.1, 32.1, 20, 20);         // F5.6: piscina -> jardín trasero (F5.8: en la pared norte, (31.1, 20))
  makeDoor('D16', -4, -4, 36, 38);             //       sótano  -> jardín trasero
  makeDoor('D17', 1.5, 3.5, 28, 28);           //       pasillo -> jardín trasero
  makeDoor('D19', -16, -16, 35, 37, H, MAT.gate);   // F5.7: portón de metal; lo abre turnOnPower (no se compra)
  state.doors.D19.power = true;
  // F5.10: lazo del jardín oeste al rancho. Bloque invisible de alto de reja (frena el paso, se dispara por
  // encima; el raycaster no mira material.visible) con postes y soga de adorno como hijos: al abrirse se van
  // F5.15: el lazo es la boca del sendero al rancho (z 26..31); el resto del borde lo cierra la espesura
  makeDoor('D20', -27, -27, 26, 31, CONFIG.RANCHO.ropeH, new THREE.MeshBasicMaterial({ visible: false }));
  buildRope(state.doors.D20);
  buildShellWalls();                   // F5.17: el caparazón (F5.16: la estación de policía)
  // F5.12: cercos que se compran y se queman (burn: buyDoor -> startBurn, arden y se abren)
  for (const B of CONFIG.BURN.hedges) {
    makeDoor(B.id, B.x1, B.x2, B.z1, B.z2, HG, MAT.hedge.clone());   // material propio: se pone negro al arder
    state.doors[B.id].burn = true; state.doors[B.id].y0 = state.doors[B.id].mesh.position.y;
  }

  buildThicketWalls();                 // F5.15: paredes de la espesura (áreas y senderos)
  buildBunkerShell();                  // F5.11: paredes, piso y techo del búnker (bunker.js)
  buildTempleShell();                  // F5.13: templo (base, escalones, santuario) y el río con sus puentes
  buildSquidHeadShell();               // F5.13: cabeza del calamar (montículo hasta la R13)
  buildPropColliders();
  buildNavGrid();
}

// piscina: fondo, rampa y paredes interiores frenan balas (hitMeshes) pero no son colliders: el que
// frena el paso es el borde invisible (poolRim).
// F2.6: el borde va de -1.8 a -0.2 m. Al jugador (su colisión mira la altura) lo frena desde abajo, aun
// saltando (llega a -1.16), y desde la orilla le pasa por debajo: se tira a la pileta por cualquier lado.
// Zombies, grid y segmentClear no miran la altura: para ellos sigue siendo una pared (entran y salen por
// la rampa y las escaleras, POOL.ladders).
function buildPool() {
  const P = POOL, t = 0.15, rim = [-1.8, -0.2];
  const deep = -P.depth, nc = { noCollide: true };
  // azulejo repetido cada ~1 m (con la textura estirada una vez por cara se ven píxeles enormes)
  const tile = (u, v) => { const m = MAT.poolTile.clone(); m.map = m.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(u, v); return m; };
  const W = P.x2 - P.x1, L = P.z2 - P.z1;
  addBox(P.x1, P.x2, deep - 0.3, deep, P.rampEnd, P.z2, tile(W, P.z2 - P.rampEnd), 'pool', nc);   // fondo
  // paredes: suben hasta el piso (y=0) y el piso de R8 termina donde empiezan (ROOMS R8 hole). Antes el
  // piso se metía 30 cm sobre ellas y la cara interna de la pared y la del piso, coplanares, parpadeaban
  addBox(P.x1 - 0.3, P.x1, deep - 0.3, 0, P.z1, P.z2, tile(L, P.depth), 'pool', nc);
  addBox(P.x2, P.x2 + 0.3, deep - 0.3, 0, P.z1, P.z2, tile(L, P.depth), 'pool', nc);
  addBox(P.x1 - 0.3, P.x2 + 0.3, deep - 0.3, 0, P.z2, P.z2 + 0.3, tile(W, P.depth), 'pool', nc);
  // rampa: caja girada, su cara de arriba coincide con groundY()
  const len = P.rampEnd - P.z1, ang = Math.atan2(P.depth, len), slope = Math.hypot(len, P.depth);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(W, 0.3, slope), tile(W, slope));
  ramp.rotation.x = ang;                                   // baja hacia +z
  ramp.position.set((P.x1 + P.x2) / 2, deep / 2 - 0.15 * Math.cos(ang), (P.z1 + P.rampEnd) / 2 - 0.15 * Math.sin(ang));
  ramp.userData.type = 'world'; ramp.userData.tag = 'pool';
  scene.add(ramp); WORLD.hitMeshes.push(ramp);
  // bordes (3 lados; el sur es la rampa)
  addBoundary(P.x1 - t, P.x1 + t, P.z1, P.z2, 'poolRim', rim[0], rim[1]);
  addBoundary(P.x2 - t, P.x2 + t, P.z1, P.z2, 'poolRim', rim[0], rim[1]);
  addBoundary(P.x1 - t, P.x2 + t, P.z2 - t, P.z2 + t, 'poolRim', rim[0], rim[1]);
}

// V2 F2.8: todo el techo de la casa. Los techos de los cuartos ya son sólidos (buildMap); acá van los
// rellenos de los huecos entre cuartos, el descanso de la escalera, los bordes (buildRoofEdges) y los 15
// escalones (solo visual: para el jugador la escalera es una rampa, ver floorAt/moveAxis)
function buildRoof() {
  const U = UP, y = U.y, L = U.landing;
  const surf = r => { r.col.overhead = true; r.col.roofSurface = true; return r; };
  const cm = MAT.ceil.clone(); cm.color.setHex(CONFIG.THEME.ceilTint);
  for (const f of U.fillers) surf(addBox(f[0], f[1], y - 0.3, y, f[2], f[3], cm, 'roof'));
  // descanso (F2.8; F5.8 ya no hay): solo lo que queda FUERA del techo de la caseta. Encima de ese techo, las dos
  // caras de arriba quedaban a la misma altura y parpadeaban
  if (L) {
    surf(addBox(L[0], L[1], y - 0.3, y, L[2], 20, MAT.deck, 'roof'));
    surf(addBox(24, L[1], y - 0.3, y, 20, L[3], MAT.deck, 'roof'));
  }
  // máscaras: dónde hay techo (cuartos cerrados + rellenos + descanso) y dónde se camina (F5.6: pasarela + descanso)
  U.mask.fill(0); U.walkMask.fill(0);
  const mark = (M, x1, x2, z1, z2) => {
    for (let x = x1; x < x2; x++) for (let z = z1; z < z2; z++) {
      const ix = x - U.x1, iz = z - U.z1;
      if (ix >= 0 && iz >= 0 && ix < U.w && iz < U.h) M[ix + iz * U.w] = 1;
    }
  };
  for (const r of ROOMS) if (!r.outdoor) mark(U.mask, r.x1, r.x2, r.z1, r.z2);
  for (const f of U.fillers) mark(U.mask, f[0], f[1], f[2], f[3]);
  const TT = CONFIG.TEMPLE.top; mark(U.mask, TT.x1, TT.x2, TT.z1, TT.z2);   // F5.13: la cima del templo
  for (const w of U.walk) mark(U.mask, w[0], w[1], w[2], w[3]);      // F5.17: y el entrepiso del caparazón
  if (L) mark(U.mask, L[0], L[1], L[2], L[3]);
  for (const w of U.walk) mark(U.walkMask, w[0], w[1], w[2], w[3]);
  if (L) mark(U.walkMask, L[0], L[1], L[2], L[3]);
  for (let i = 0; i < U.walkMask.length; i++) U.walkMask[i] &= U.mask[i];   // solo donde hay techo de verdad
  // F5.6: visual de la pasarela: tablones, barandas (buildRoofEdges) y macetas, en un solo mesh
  // F5.8: los tablones salen de la máscara (tiras seguidas por fila), no de los rectángulos: donde dos tramos se
  // cruzaban quedaban dos tablones a la misma altura y parpadeaban
  const mb = new MeshBuilder();
  for (let iz = 0; iz < U.h; iz++) for (let ix = 0; ix < U.w; ) {
    if (!U.walkMask[ix + iz * U.w]) { ix++; continue; }
    let jx = ix; while (jx + 1 < U.w && U.walkMask[jx + 1 + iz * U.w]) jx++;
    const x1 = U.x1 + ix, x2 = U.x1 + jx + 1, z0 = U.z1 + iz;
    if (x1 < CONFIG.TEMPLE.top.x1)                             // F5.13: la cima del templo es de piedra (buildTemple)
      for (const dz of [0.25, 0.75])
        mb.box((x1 + x2) / 2, y + 0.012, z0 + dz, x2 - x1, 0.02, 0.46, [0x8a6a44, 0x7a5c3a, 0x967550][Math.floor((z0 + dz) * 2) % 3]);
    ix = jx + 1;
  }
  buildRoofEdges(mb);
  buildPlantPots(mb);
  const deck = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  if (deck) { deck.userData.theme = false; deck.updateMatrix(); }   // es mapa, no tema
  // escalones (solo visual: para el jugador la escalera es una rampa, ver floorAt/moveAxis)
  for (const S of U.flights) {
    if (S.open) continue;                                             // F5.17: escalera abierta (la dibuja quien la usa)
    const V = flightV(S), run = (V.x2 - V.x1) / S.steps, rise = y / S.steps, zAx = S.axis === 'z';
    for (let i = 0; i < S.steps; i++) {
      const a1 = V.dir < 0 ? V.x2 - (i + 1) * run : V.x1 + i * run, a2 = a1 + run, h = (i + 1) * rise;
      const wa = a2 - a1, wb = V.z2 - V.z1, ca = (a1 + a2) / 2, cb = (V.z1 + V.z2) / 2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(zAx ? wb : wa, h, zAx ? wa : wb), S.stone ? MAT.stone : MAT.deck);   // F5.13
      m.position.set(zAx ? cb : ca, h / 2, zAx ? ca : cb); scene.add(m);
      WORLD.hitMeshes.push(m); m.userData.type = 'world';
    }
  }
  // dos postes bajo el descanso (solo visual; F5.8 ya no hay descanso)
  if (L) [[L[0] + 0.1, L[2] + 0.1], [L[1] - 0.1, L[2] + 0.1]].forEach(([px, pz]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.15, y - 0.3, 0.15), MAT.deck);
    m.position.set(px, (y - 0.3) / 2, pz); scene.add(m);
  });
}

// bordes de la pasarela: por cada lado de celda caminable que no toca otra caminable:
//  - F5.8: si el lado está en UP.gaps (llegada de las escaleras, hueco sobre la piscina) -> abierto (te tirás)
//  - si no -> BARANDA de madera (sólida, frena balas por debajo). Antes solo iban donde del otro lado había
//    techo, y los bordes al aire libre quedaban abiertos (Diego pidió barandas en todo el borde)
//  - (sin UP.gaps: hacia el aire libre abierto, hacia el vacío un límite invisible, como en F2.8)
// Los tramos seguidos van en un solo collider
function buildRoofEdges(mb) {
  // Los bordes abiertos llevan igual un límite SOLO PARA ZOMBIES (zombieOnly: el jugador lo ignora): sin eso,
  // amontonados contra el borde, la separación los empujaba afuera y quedaban flotando sobre el porche
  const U = UP, runs = {};
  const at = (M, x, z) => { const ix = x - U.x1, iz = z - U.z1; return ix >= 0 && iz >= 0 && ix < U.w && iz < U.h && M[ix + iz * U.w] === 1; };
  const outdoor = (x, z) => { const r = roomAt(x + 0.5, z + 0.5); return !!(r && r.outdoor); };
  const inGap = (axis, line, a) => (U.gaps || []).some(g => g[0] === axis && g[1] === line && a >= g[2] && a < g[3]);
  const kind = (x, z, axis, line, a) => U.gaps ? (inGap(axis, line, a) ? 'o' : 'r')
                                                : at(U.mask, x, z) ? 'r' : outdoor(x, z) ? 'o' : '';
  const add = (key, x, z, a) => { const k = key + kind(x, z, key[0], parseFloat(key.slice(1)), a); (runs[k] = runs[k] || []).push(a); };
  for (let ix = 0; ix < U.w; ix++) for (let iz = 0; iz < U.h; iz++) {
    if (!U.walkMask[ix + iz * U.w]) continue;
    const x = U.x1 + ix, z = U.z1 + iz;
    if (!at(U.walkMask, x - 1, z)) add('x' + x, x - 1, z, z);           // borde en la línea x (lado oeste)
    if (!at(U.walkMask, x + 1, z)) add('x' + (x + 1), x + 1, z, z);     // lado este
    if (!at(U.walkMask, x, z - 1)) add('z' + z, x, z - 1, x);           // lado sur
    if (!at(U.walkMask, x, z + 1)) add('z' + (z + 1), x, z + 1, x);     // lado norte
  }
  const t = 0.05, G = CONFIG.GARDEN;
  if (!ROOF_RAIL_MAT) ROOF_RAIL_MAT = new THREE.MeshBasicMaterial();
  for (const key in runs) {
    const k = key[key.length - 1], isOpen = k === 'o', isRail = k === 'r';
    const axis = key[0], line = parseFloat(key.slice(1).replace(/[or]$/, ''));
    const vals = runs[key].sort((p, q) => p - q);
    for (let i = 0; i < vals.length; ) {
      let j = i;
      while (j + 1 < vals.length && vals[j + 1] === vals[j] + 1) j++;
      const a = vals[i], b = vals[j] + 1;
      if (isRail) {
        // baranda: caja invisible (collider + hitMesh) + el dibujo en el mesh de la pasarela
        const tr = 0.06, r = axis === 'x' ? addBox(line - tr, line + tr, U.y, U.y + G.railH, a, b, ROOF_RAIL_MAT, 'roofrail')
                                          : addBox(a, b, U.y, U.y + G.railH, line - tr, line + tr, ROOF_RAIL_MAT, 'roofrail');
        r.mesh.visible = false; r.col.overhead = true;
        if (mb) {
          const cx = axis === 'x' ? line : (a + b) / 2, cz = axis === 'x' ? (a + b) / 2 : line, len = b - a;
          const sx = axis === 'x' ? 0.08 : len, sz = axis === 'x' ? len : 0.08;
          mb.box(cx, U.y + G.railH - 0.04, cz, sx + 0.04, 0.08, sz + 0.04, 0x6e4e2e);          // pasamanos
          mb.box(cx, U.y + G.railH * 0.5, cz, sx, 0.06, sz, 0x7a5a38);                         // travesaño
          for (let p = a; p <= b + 1e-6; p += 1) mb.box(axis === 'x' ? line : p, U.y + G.railH / 2, axis === 'x' ? p : line,
            0.1, G.railH, 0.1, 0x5a3e24);                                                      // postes
        }
      } else {
        const tag = isOpen ? 'bound:roofz' : 'bound:roof';
        const c = axis === 'x' ? addBoundary(line - t, line + t, a, b, tag, U.y, U.y + 2)
                               : addBoundary(a, b, line - t, line + t, tag, U.y, U.y + 2);
        c.overhead = true;
        if (isOpen) c.zombieOnly = true;
      }
      i = j + 1;
    }
  }
}
let ROOF_RAIL_MAT = null;
// F5.6: macetas de las plantas carnívoras, sin mesh: frenan al jugador y bloquean el grid (los zombies las
// rodean). La planta vive en garden.js. F5.16: en el piso de los jardines (antes, colliders de arriba en el techo)
function buildPlantPots(mb) {
  const G = CONFIG.GARDEN;
  for (const [x, z] of G.plants) {
    const y = groundY(x, z);
    const r = G.potR, c = { minX: x - r, maxX: x + r, minY: y, maxY: y + G.potH, minZ: z - r, maxZ: z + r,
                            tag: 'plant', mesh: null, solid: true };
    WORLD.colliders.push(c);
    if (mb) {                                                           // F5.18: de vuelta a cajas (pedido de Diego)
      mb.box(x, y + G.potH * 0.45, z, r * 2, G.potH * 0.9, r * 2, 0xa0522d);                  // maceta de barro
      mb.box(x, y + G.potH * 0.92, z, r * 2 + 0.08, 0.08, r * 2 + 0.08, 0x8a4424);             // borde
      mb.box(x, y + G.potH * 0.9, z, r * 1.8, 0.04, r * 1.8, 0x3a2a1a);                        // tierra
    }
  }
}

function makeDoor(id, x1, x2, z1, z2, h, mat) {
  const b = addWall(x1, z1, x2, z2, h || CONFIG.WALL_H, mat || MAT.door, 'door:' + id);
  state.doors[id] = { id, cost: CONFIG.DOORS[id], open: false, mesh: b.mesh, collider: b.col };
}

// F5.10: el lazo D20: postes de madera cada ~2.75 m y una soga que cuelga entre ellos, con un cartel. Va como
// hijo del bloque de la puerta (que es invisible): openDoor saca el bloque de la escena y se va todo junto
function buildRope(d) {
  const c = d.collider, x = (c.minX + c.maxX) / 2, h = CONFIG.RANCHO.ropeH, mb = new MeshBuilder();
  const n = 8, z0 = c.minZ + 0.2, z1 = c.maxZ - 0.2, step = (z1 - z0) / n;
  for (let i = 0; i <= n; i++) {
    const z = z0 + i * step;
    mb.box(x, h / 2 + 0.1, z, 0.16, h + 0.2, 0.16, 0x6a4a2a);            // poste
    mb.box(x, h + 0.22, z, 0.2, 0.06, 0.2, 0x4a321a);                    // tapa
  }
  for (let i = 0; i < n; i++) {                                          // soga: 2 tramos por vano, colgando
    const za = z0 + i * step, zm = za + step / 2, sag = 0.25, len = Math.hypot(step / 2, sag);
    const ang = Math.atan2(sag, step / 2);
    mb.box(x, h - sag / 2, za + step / 4, 0.05, 0.05, len, 0xc8a870, ang, 0, 0);
    mb.box(x, h - sag / 2, zm + step / 4, 0.05, 0.05, len, 0xc8a870, -ang, 0, 0);
  }
  mb.box(x, h - 0.3, (z0 + z1) / 2, 0.06, 0.5, 1.4, 0x8a6a3a);          // tabla del cartel
  const m = mb.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.remove(m);
  m.userData.theme = false; m.matrixAutoUpdate = true;
  m.position.copy(d.mesh.position).negate();                             // el MeshBuilder está en coordenadas del mundo
  d.mesh.add(m);
  const tex = makeTex((ctx, s) => {
    ctx.fillStyle = '#8a6a3a'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#f0e0b0'; ctx.textAlign = 'center';
    ctx.font = 'bold ' + Math.floor(s * 0.26) + 'px monospace'; ctx.fillText('RANCHO', s / 2, s * 0.62);
  }, 1, 128);
  tex.magFilter = THREE.LinearFilter;
  [1, -1].forEach(sd => {                                                // las dos caras del cartel
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.45), new THREE.MeshLambertMaterial({ map: tex }));
    sign.position.set(x + sd * 0.04, h - 0.3, (z0 + z1) / 2).sub(d.mesh.position);   // local al bloque
    sign.rotation.y = sd * Math.PI / 2;
    d.mesh.add(sign);
  });
}

// F5.15: espesura = celda de la jungla vieja (CONFIG.THICKET) que no es de ningún cuarto
function inThicket(x, z) { return CONFIG.THICKET.some(r => x > r[0] && x < r[1] && z > r[2] && z < r[3]) && !roomAt(x, z); }
// F5.15: pared de vegetación en cada borde entre una celda de espesura y una caminable. Recorre celdas de 1 m, junta
// los bordes en tramos rectos y pone cada tramo del lado de la espesura (0.5 m): no le quita ancho a los senderos.
// Sólida (frena gente y balas: caja invisible en hitMeshes), tag 'thicket'. THICKET.segs queda para el dibujo
const THICKET = { segs: [] };
function buildThicketWalls() {
  const H = CONFIG.thicketWallH, mat = new THREE.MeshBasicMaterial(), T = 0.5;
  let bx1 = Infinity, bx2 = -Infinity, bz1 = Infinity, bz2 = -Infinity;
  for (const r of CONFIG.THICKET) { bx1 = Math.min(bx1, r[0]); bx2 = Math.max(bx2, r[1]); bz1 = Math.min(bz1, r[2]); bz2 = Math.max(bz2, r[3]); }
  const walk = (x, z) => !!roomAt(x + 0.5, z + 0.5) && !(roomAt(x + 0.5, z + 0.5).noFloor);
  const thick = (x, z) => inThicket(x + 0.5, z + 0.5);
  const runs = {};                                    // clave: 'h|z|lado' o 'v|x|lado' -> lista de celdas a lo largo
  const push = (k, i) => (runs[k] = runs[k] || []).push(i);
  for (let x = bx1; x < bx2; x++) for (let z = bz1; z < bz2; z++) {
    if (!thick(x, z)) continue;
    if (walk(x, z - 1)) push('h|' + z + '|1', x);     // caminable al sur: pared en z..z+T
    if (walk(x, z + 1)) push('h|' + (z + 1) + '|-1', x);   // al norte: pared en z+1-T..z+1
    if (walk(x - 1, z)) push('v|' + x + '|1', z);     // al oeste
    if (walk(x + 1, z)) push('v|' + (x + 1) + '|-1', z);   // al este
  }
  for (const k in runs) {
    const [ax, line, side] = k.split('|'), L = +line, s = +side, list = runs[k].sort((a, b) => a - b);
    for (let i = 0; i < list.length;) {
      let j = i;
      while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
      const a = list[i], b = list[j] + 1, w1 = s > 0 ? L : L - T, w2 = s > 0 ? L + T : L;
      const seg = ax === 'h' ? [a, b, w1, w2] : [w1, w2, a, b];
      const r = addBox(seg[0], seg[1], 0, H, seg[2], seg[3], mat, 'thicket'); r.mesh.visible = false;
      THICKET.segs.push(seg);
      i = j + 1;
    }
  }
}
// F5.15: las 4 paredes del santuario [x1, x2, z1, z2], cortadas por sus puertas (las usa el dibujo también)
// F5.17: el caparazón (CONFIG.SHELL). Borde de cajas invisibles por la elipse (tag 'shell': frena todo, no se pisa,
// sin piel del tema) salvo la boca, donde va la barricada D21 (bloque invisible; su dibujo va de hijo en bunker.js:
// al abrirse se va todo). El entrepiso: 4 losas de arriba (overhead + roofSurface: el grid de abajo no las ve) y la
// huella de la escalera, que frena solo a los zombies del piso (los que suben van por el enlace, sin colisión)
function shellRim() {
  const S = CONFIG.SHELL, D = S.door, out = [], n = 64, ra = S.a - S.t / 2, rb = S.b - S.t / 2, ht = S.t / 2;
  const hw = (D.x2 - D.x1) / 2 + 1.2;                                 // la boca y sus jambas van aparte
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    const x0 = S.x + Math.cos(a0) * ra, z0 = S.z + Math.sin(a0) * rb, x1 = S.x + Math.cos(a1) * ra, z1 = S.z + Math.sin(a1) * rb;
    if ((z0 + z1) / 2 < S.z && Math.abs((x0 + x1) / 2 - S.x) < hw) continue;
    out.push([Math.min(x0, x1) - ht, Math.max(x0, x1) + ht, Math.min(z0, z1) - ht, Math.max(z0, z1) + ht]);
  }
  const zAt = dx => S.z - rb * Math.sqrt(1 - (dx / ra) ** 2);
  for (const sd of [-1, 1]) {                                         // jambas: de la barricada a donde sigue el borde
    const xa = S.x + sd * (D.x2 - D.x1) / 2, xb = S.x + sd * (hw + 0.3);
    out.push([Math.min(xa, xb), Math.max(xa, xb), Math.min(zAt(hw + 0.3), D.z) - ht, Math.max(zAt(hw + 0.3), D.z) + ht]);
  }
  return out;
}
function buildShellWalls() {
  const S = CONFIG.SHELL, D = S.door, R = S.ramp, inv = new THREE.MeshBasicMaterial();
  for (const b of shellRim()) { const r = addBox(b[0], b[1], 0, S.rimH, b[2], b[3], inv, 'shell'); r.mesh.visible = false; }
  const [ox1, ox2, oz1, oz2] = S.deck.outer, [ix1, ix2, iz1, iz2] = S.deck.inner;
  for (const [x1, x2, z1, z2] of [[ox1, ox2, oz1, iz1], [ox1, ox2, iz2, oz2], [ox1, ix1, iz1, iz2], [ix2, ox2, iz1, iz2]]) {
    const r = addBox(x1, x2, UP.y - 0.3, UP.y, z1, z2, inv, 'shell:deck'); r.mesh.visible = false;
    r.col.overhead = true; r.col.roofSurface = true;
  }
  addBoundary(R.x1, R.x2, R.z1, R.z2, 'bound:rampa', 0, UP.y).zombieOnly = true;
  makeDoor(D.id, D.x1, D.x2, D.z, D.z, D.h, new THREE.MeshBasicMaterial({ visible: false }));
}
function sanctumWalls() {
  const S = CONFIG.TEMPLE.sanctum, t = S.t, out = [];
  const wall = (alongX, line0, line1, a, b, axis, line) => {        // pared de a a b, salteando sus puertas
    const cuts = S.doors.filter(d => d[0] === axis && d[1] === line).map(d => [d[2], d[3]]).sort((p, q) => p[0] - q[0]);
    let s = a;
    for (const [c1, c2] of cuts.concat([[b, b]])) {
      if (c1 > s) out.push(alongX ? [s, c1, line0, line1] : [line0, line1, s, c1]);
      s = Math.max(s, c2);
    }
  };
  wall(true, S.z1, S.z1 + t, S.x1, S.x2, 'z', S.z1);               // sur
  wall(true, S.z2 - t, S.z2, S.x1, S.x2, 'z', S.z2);               // norte
  wall(false, S.x1, S.x1 + t, S.z1 + t, S.z2 - t, 'x', S.x1);      // oeste
  wall(false, S.x2 - t, S.x2, S.z1 + t, S.z2 - t, 'x', S.x2);      // este
  return out;
}
// F5.13: lo sólido del templo (cajas invisibles: el dibujo va en garden.js buildTemple) y el río en L: orillas
// como límites invisibles de 0.4 m (así las celdas pegadas quedan bloqueadas y el grid no cruza el agua), con los
// huecos de los 3 puentes y los costados de cada puente
function buildTempleShell() {
  const T = CONFIG.TEMPLE, y = UP.y, mat = new THREE.MeshBasicMaterial();
  const solid = (x1, x2, a, b, z1, z2, tag, over) => {
    const r = addBox(x1, x2, a, b, z1, z2, mat, tag); r.mesh.visible = false;
    if (over) r.col.overhead = true;
    return r;
  };
  // F5.16 (bug del playtest): los zombies del piso cruzaban las rampas de costado (el grid de abajo no las ve).
  // Su huella es un límite SOLO para zombies (el jugador sube por la rampa; los de la escalera van por el enlace,
  // sin colisión). tag bound:*: no frena balas
  for (const R of T.ramps) addBoundary(R.x1, R.x2, R.z1, R.z2, 'bound:rampa', 0, UP.y).zombieOnly = true;
  solid(T.top.x1, T.top.x2, 0, y, T.top.z1, T.top.z2, 'temple');       // la base: arriba se pisa (y = UP.y)
  for (const t of T.tiers) solid(t[0], t[1], 0, T.tierH, t[2], t[3], 'temple');
  // F5.15: el santuario es un cuarto (paredes con 2 puertas) y adentro está el Pack-a-Punch. Colliders de arriba:
  // el grid de arriba los ve, el de abajo no
  for (const w of sanctumWalls()) solid(w[0], w[1], y, y + T.sanctum.h, w[2], w[3], 'temple:santuario', true);
  const R = T.river, h = 0.2;
  // una línea de orilla de `a` a `b` (en z si alongZ, en x si no) salteando los puentes de ese brazo
  const bank = (alongZ, line, a, b, arm) => {
    const cuts = R.bridges.filter(g => g[0] === arm).map(g => [g[1], g[2]]).sort((p, q) => p[0] - q[0]);
    let s = a;
    for (const [c1, c2] of cuts.concat([[b, b]])) {
      if (c1 > s) alongZ ? addBoundary(line - h, line + h, s, c1, 'bound:rio') : addBoundary(s, c1, line - h, line + h, 'bound:rio');
      s = Math.max(s, c2);
    }
  };
  const [wx1, wx2, wz1, wz2] = R.w, [sx1, sx2, sz1, sz2] = R.s;
  bank(true, wx1, wz1, wz2, 'w');                                    // brazo oeste: orilla de afuera y de adentro
  bank(true, wx2, sz2, wz2, 'w');
  bank(false, sz1, sx1, sx2, 's');                                   // brazo sur
  bank(false, sz2, wx2, sx2, 's');
  for (const [arm, c1, c2] of R.bridges) for (const c of [c1, c2]) {  // costados de los puentes
    if (arm === 'w') addBoundary(wx1, wx2, c - h, c + h, 'bound:rio');
    else addBoundary(c - h, c + h, sz1, sz2, 'bound:rio');
  }
}

// F5.13: la cabeza del calamar (CONFIG.SQUIDHEAD). Dos juegos de sólidos invisibles: el montículo entero
// (cerrada) y las paredes del túnel y la cámara (abierta). setSquidHead (quest.js) cambia cuál está `solid`
// y cuál frena balas, como una puerta
const SQHEAD = { mound: null, walls: [], open: false, g: null, dy: 0 };
function buildSquidHeadShell() {
  const H = CONFIG.SQUIDHEAD, mat = new THREE.MeshBasicMaterial(), [tx1, tx2, tz1] = H.tunnel, [cx1, cx2, cz1] = H.chamber;
  const solid = (x1, x2, z1, z2, tag) => { const r = addBox(x1, x2, 0, H.h, z1, z2, mat, tag); r.mesh.visible = false; return r; };
  SQHEAD.mound = solid(H.x1, H.x2, H.z1, H.z2, 'squidhead');
  SQHEAD.walls = [
    solid(H.x1, tx1, tz1, H.z2, 'squidhead:pared'), solid(tx2, H.x2, tz1, H.z2, 'squidhead:pared'),
    solid(H.x1, cx1, cz1, tz1, 'squidhead:pared'), solid(cx2, H.x2, cz1, tz1, 'squidhead:pared'),
    solid(H.x1, H.x2, H.z1, cz1, 'squidhead:pared')
  ];
  SQHEAD.open = true; squidHeadSolid(false);
}
function squidHeadSolid(open) {
  if (SQHEAD.open === open) return false;
  SQHEAD.open = open;
  const set = (r, on) => {
    r.col.solid = on;
    const i = WORLD.hitMeshes.indexOf(r.mesh);
    if (on && i < 0) WORLD.hitMeshes.push(r.mesh);
    if (!on && i >= 0) WORLD.hitMeshes.splice(i, 1);
  };
  set(SQHEAD.mound, !open);
  for (const w of SQHEAD.walls) set(w, open);
  return true;
}

// grid de navegación 1x1 — lo consume la IA de zombies en P3
function buildNavGrid() {
  NAV.cells.fill(0);
  ROOMS.forEach(r => {
    for (let x = Math.floor(r.x1); x < Math.ceil(r.x2); x++) {
      for (let z = Math.floor(r.z1); z < Math.ceil(r.z2); z++) {
        if (!cellBlocked(x + 0.5, z + 0.5)) NAV.cells[navIdx(x, z)] = 1;
      }
    }
  });
  SPAWN_POINTS.forEach(sp => {
    sp.cx = Math.floor(sp.x); sp.cz = Math.floor(sp.z);
    sp.valid = isNav(sp.cx, sp.cz);
  });
  // F2.8: nivel de arriba (techo de la caseta + descanso). Navegable = centro sobre el techo o el descanso y
  // sin barandal a menos de 0.4 m
  UP.cells.fill(0);
  for (let x = UP.x1; x < UP.x1 + UP.w; x++) for (let z = UP.z1; z < UP.z1 + UP.h; z++) {
    const cx = x + 0.5, cz = z + 0.5;
    if (!walkAt(cx, cz)) continue;                       // F5.6: solo la pasarela
    if (!cellBlockedUp(cx, cz)) UP.cells[upIdx(x, z) - NAV.base] = 1;
  }
  // F2.6: escaleras de la piscina = enlaces entre dos celdas (el BFS del flow field los cruza como vecinos)
  NAV.link.fill(-1); NAV.via = [];
  for (const L of POOL.ladders) {
    const a = navIdx(L.bot[0], L.bot[1]), b = navIdx(L.top[0], L.top[1]);
    if (a < 0 || b < 0 || !NAV.cells[a] || !NAV.cells[b]) { console.warn('Escalera fuera del grid:', L.id); continue; }
    NAV.link[a] = b; NAV.link[b] = a;
  }
  // F2.8: las escaleras del techo (F5.6: dos): piso (abajo) <-> techo (arriba), con recorrido fijo por los escalones
  for (const S of UP.flights) {
    const V = flightV(S), a = navIdx(S.bottom[0], S.bottom[1]), b = upIdx(S.top[0], S.top[1]), zm = (V.z1 + V.z2) / 2;
    if (a < 0 || b < 0 || !NAV.cells[a] || !UP.cells[b - NAV.base]) { console.warn('Escalera del techo fuera del grid', S.bottom); continue; }
    const lo = V.dir < 0 ? V.x2 + 0.1 : V.x1 - 0.1, hi = V.dir < 0 ? V.x1 + 0.05 : V.x2 - 0.05;   // pie y último escalón
    const P = (u, w) => S.axis === 'z' ? [w, u] : [u, w];          // F5.13: en z, los puntos van cambiados
    NAV.link[a] = b; NAV.link[b] = a;
    NAV.via[a] = [P(lo, zm), P(hi, zm)];                           // subiendo: de la base al último escalón
    NAV.via[b] = [P(hi, zm), P(lo, zm)];                           // bajando: al revés
  }
  // F5.11: escotilla del búnker (solo abierta): jardín norte <-> pie de la escalera del búnker
  NAV.hatch = null;
  if (BUNK.open) {
    const B = CONFIG.BUNKER, a = navIdx(B.hatch.cell[0], B.hatch.cell[1]), b = navIdx(B.ladder.cell[0], B.ladder.cell[1]);
    if (a >= 0 && b >= 0 && NAV.cells[a] && NAV.cells[b]) { NAV.link[a] = b; NAV.link[b] = a; NAV.hatch = [a, b]; }
    else console.warn('Escotilla fuera del grid');
  }
  COLHASH.dirty = true;                  // si se rehízo el grid, algún collider cambió
}
// celda del nivel de arriba bloqueada por un barandal (el techo y el descanso son el piso, no bloquean)
function cellBlockedUp(cx, cz) {
  const m = 0.40;
  for (const c of WORLD.colliders) {
    if (!c.solid || !c.overhead || c.roofSurface) continue;
    if (cx + m > c.minX && cx - m < c.maxX && cz + m > c.minZ && cz - m < c.maxZ) return true;
  }
  return false;
}
function cellBlocked(cx, cz) {
  const m = 0.40;
  for (let i = 0; i < WORLD.colliders.length; i++) {
    const c = WORLD.colliders[i];
    if (!c.solid || c.overhead) continue;                 // F2.8: lo de arriba (techo) no toca el grid del piso
    if (cx + m > c.minX && cx - m < c.maxX && cz + m > c.minZ && cz - m < c.maxZ) return true;
  }
  return false;
}

// celda navegable más cercana (búsqueda en anillos). fx,fz = posición real para desempate.
// los (F2.6): solo celdas con línea libre desde (fx, fz), así no salta una pared ni el borde de la
// piscina. Si ninguna la tiene, cae a la más cercana sin línea libre.
// F5.6: minTop = ignorar en la línea libre lo que esté por debajo (el jugador parado arriba de la cama: sus pies
// están adentro del collider y si no ninguna celda "se ve")
function nearestNav(cx, cz, R, fx, fz, los, minTop) {
  if (isNav(cx, cz)) return { x: cx, z: cz };
  if (fx === undefined) { fx = cx + 0.5; fz = cz + 0.5; }
  let blind = null;
  for (let r = 1; r <= R; r++) {
    let best = null, bd = 1e9, bBlind = null, dBlind = 1e9;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = cx + dx, z = cz + dz;
      if (!isNav(x, z)) continue;
      const ex = x + 0.5 - fx, ez = z + 0.5 - fz, d = ex * ex + ez * ez;
      if (los && !segmentClear(fx, fz, x + 0.5, z + 0.5, 0, false, minTop)) {
        if (d < dBlind) { dBlind = d; bBlind = { x, z }; }
        continue;
      }
      if (d < bd) { bd = d; best = { x, z }; }
    }
    if (best) return best;
    if (!blind) blind = bBlind;
  }
  return blind;
}

// segmento 2D libre de colliders (slab test). pad engorda las cajas.
// shotOnly: ignora los colliders sin mesh (límites invisibles, borde de la piscina): los usan las armas
// de área/cono y el audio, que tienen que pasar por donde pasa una bala. Movimiento/ataque: sin shotOnly.
// minTop (F2.7, opcional): ignora los colliders cuyo tope está por debajo (mesas, sofás bajo una explosión).
// layer (F2.8): 0 / sin pasar = piso (ignora lo de arriba: el techo de la caseta no tapa nada abajo);
// 1 = arriba del techo (solo cuentan sus barandales)
function segmentClear(x0, z0, x1, z1, pad, shotOnly, minTop, layer) {
  const dx = x1 - x0, dz = z1 - z0, up = layer === 1;
  const cols = collidersNear(Math.min(x0, x1) - pad, Math.max(x0, x1) + pad, Math.min(z0, z1) - pad, Math.max(z0, z1) + pad);
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    if (!c.solid || (shotOnly && !c.mesh)) continue;
    if (up ? (!c.overhead || c.roofSurface) : c.overhead) continue;
    if (minTop !== undefined && c.maxY < minTop) continue;
    const minX = c.minX - pad, maxX = c.maxX + pad, minZ = c.minZ - pad, maxZ = c.maxZ + pad;
    let tmin = 0, tmax = 1;
    if (Math.abs(dx) < 1e-9) { if (x0 < minX || x0 > maxX) continue; }
    else {
      let t1 = (minX - x0) / dx, t2 = (maxX - x0) / dx;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    if (Math.abs(dz) < 1e-9) { if (z0 < minZ || z0 > maxZ) continue; }
    else {
      let t1 = (minZ - z0) / dz, t2 = (maxZ - z0) / dz;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    return false;
  }
  return true;
}

// círculo XZ vs AABBs, un eje a la vez (zombies). o = {px, pz, level?}. F2.8: en el piso (level 0 o sin
// definir) se ignora lo de arriba; arriba del techo (level 1) solo cuentan sus barandales
function moveCircle(o, axis, delta, r) {
  if (!delta) return;
  const bx = o.px, bz = o.pz, m = 0.01, up = o.level === 1;
  if (axis === 'x') o.px += delta; else o.pz += delta;
  // candidatos: los colliders cerca de la caja que barre el círculo
  const x0 = Math.min(bx, o.px) - m, x1 = Math.max(bx, o.px) + m, z0 = Math.min(bz, o.pz) - m, z1 = Math.max(bz, o.pz) + m;
  let cols = nearCached(o, x0 - r, x1 + r, z0 - r, z1 + r);
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    if (!c.solid) continue;
    if (up ? (!c.overhead || c.roofSurface) : c.overhead) continue;
    if (o.px + r <= c.minX || o.px - r >= c.maxX || o.pz + r <= c.minZ || o.pz - r >= c.maxZ) continue;
    if (axis === 'x') o.px = delta > 0 ? c.minX - r - 0.001 : c.maxX + r + 0.001;
    else              o.pz = delta > 0 ? c.minZ - r - 0.001 : c.maxZ + r + 0.001;
    // si arrancó metido en un collider (la caja que se mudó encima), el empujón lo puede sacar de la caja
    // consultada: de ahí en más, todos los colliders en orden, igual que sin hash
    if (cols !== WORLD.colliders && (o.px < x0 || o.px > x1 || o.pz < z0 || o.pz > z1)) { cols = WORLD.colliders; i = c.hid; }
  }
}

// V2 F1.1: hash espacial de colliders. Celdas de COLHASH.size m con los colliders que las tocan:
// moveCircle y segmentClear miran solo las celdas de su caja y no los ~100 del mapa. Los candidatos salen
// ordenados como en WORLD.colliders, así el resultado es el mismo que recorrerlos todos.
// Se reconstruye solo si cambia la cantidad de colliders o si se rehízo el grid (buildNavGrid, que ya
// se llama cada vez que un collider se mueve: la caja al mudarse). Abrir puertas cambia solid, no la caja.
const COLHASH = { size: 4, w: 0, h: 0, cells: null, n: -1, dirty: true, stamp: 0, out: [] };
function hashX(x) { return Math.min(COLHASH.w - 1, Math.max(0, Math.floor((x - NAV.minX) / COLHASH.size))); }
function hashZ(z) { return Math.min(COLHASH.h - 1, Math.max(0, Math.floor((z - NAV.minZ) / COLHASH.size))); }
function buildColliderHash() {
  const H = COLHASH, cols = WORLD.colliders;
  H.w = Math.ceil(NAV.w / H.size); H.h = Math.ceil(NAV.h / H.size);
  H.cells = [];
  for (let i = 0; i < H.w * H.h; i++) H.cells.push([]);
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    c.hid = i; c.hq = 0;
    for (let z = hashZ(c.minZ); z <= hashZ(c.maxZ); z++)
      for (let x = hashX(c.minX); x <= hashX(c.maxX); x++) H.cells[x + z * H.w].push(c);
  }
  H.n = cols.length; H.dirty = false;
  H.gen = (H.gen || 0) + 1;                          // F5.15: invalida las listas guardadas (nearCached)
}
// colliders cuya celda toca la caja [minX,maxX]x[minZ,maxZ]. Devuelve un array reutilizado: no anidar llamadas
// F5.15 (costo): cada objeto que se mueve (zombie) guarda los colliders de una caja con `pad` m de margen y los
// reusa mientras la consulta quepa adentro. Es la misma lista (un superconjunto, en el mismo orden), así que el
// resultado de moveCircle no cambia; se rehace si el hash se reconstruyó (gen)
const COLCACHE_PAD = 1.5;
function nearCached(o, x0, x1, z0, z1) {
  const H = COLHASH;
  if (H.dirty || H.n !== WORLD.colliders.length) buildColliderHash();
  let c = o.colCache;
  if (!c || c.gen !== H.gen || x0 < c.x0 || x1 > c.x1 || z0 < c.z0 || z1 > c.z1) {
    const P = COLCACHE_PAD;
    c = o.colCache = { x0: x0 - P, x1: x1 + P, z0: z0 - P, z1: z1 + P, gen: H.gen, list: collidersNear(x0 - P, x1 + P, z0 - P, z1 + P).slice() };
  }
  return c.list;
}
function collidersNear(minX, maxX, minZ, maxZ) {
  const H = COLHASH;
  if (H.dirty || H.n !== WORLD.colliders.length) buildColliderHash();
  const out = H.out, q = ++H.stamp;
  out.length = 0;
  for (let z = hashZ(minZ), z1 = hashZ(maxZ); z <= z1; z++)
    for (let x = hashX(minX), x1 = hashX(maxX); x <= x1; x++) {
      const cell = H.cells[x + z * H.w];
      for (let i = 0; i < cell.length; i++) { const c = cell[i]; if (c.hq !== q) { c.hq = q; out.push(c); } }
    }
  if (out.length > 1) out.sort((a, b) => a.hid - b.hid);
  return out;
}

function roomAt(x, z) {
  for (const r of ROOMS) if (x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2) return r;
  return null;
}

//--- cielo de atardecer + niebla ---
function buildSky() {
  const tex = makeTex((c, s) => {
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0.00, '#2a1b47');
    g.addColorStop(0.42, '#7d3b62');
    g.addColorStop(0.68, '#e0733f');
    g.addColorStop(0.86, '#f7b56a');
    g.addColorStop(1.00, '#3b2b2a');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
  }, 1, 256);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(320, 24, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
  );
  scene.add(sky);
  WORLD.sky = sky;                                   // F4: la noche de la ronda de perros lo tiñe
  // F5.16: niebla permanente. El domo queda oculto (más allá de camera.far) y el fondo ES el color de la niebla
  // (mismo objeto Color: la noche y el ciclo de luz lo cambian en el lugar)
  sky.visible = false;
  scene.fog = new THREE.Fog(0xb4693f, CONFIG.FOG.near, CONFIG.FOG.far);
  scene.background = scene.fog.color;
}

function buildLights() {
  const T = CONFIG.THEME;
  const hemi = new THREE.HemisphereLight(0xffc9a0, 0x201c24, T.hemiIntensity);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffa35a, T.sunIntensity);   // atardecer bajo, desde el mar
  sun.position.set(-40, 18, -30);
  scene.add(sun);
  WORLD.hemi = hemi; WORLD.sun = sun;                // F4: noche = cambiar color/intensity, nunca luces nuevas
  // luces de interior: MISMA cantidad que antes (6). Parpadeo = cambiar intensity, nunca add/remove.
  // modo: steady | flicker (cortes ocasionales) | broken (estroboscópica) | buzz (zumbido)
  WORLD.lamps = [];
  [[0,2.9,11,'steady'],[13,2.9,9,'flicker'],[0,2.9,23,'broken'],[10,2.9,25,'steady'],[-10,2.9,24,'flicker'],[-10,2.9,35,'buzz']]
    .forEach(p => {
      const l = new THREE.PointLight(T.lampColor, T.lampIntensity, 14, 2);
      l.position.set(p[0], p[1], p[2]);
      scene.add(l);
      WORLD.lamps.push({ light: l, mode: p[3], k: 1, timer: 0, phase: Math.random() * 10 });
    });
}

