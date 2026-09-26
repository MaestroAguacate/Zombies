# MARENA 34B — ROADMAP V2

> Claude Code: este archivo manda sobre el roadmap de V1 en CLAUDE.md.
> Se ejecuta en orden. Una fase = una sesión. No adelantes fases.
> Al terminar cada fase: tests verdes → commit → tag `v2-fN` → reporta y espera.

---

## REGLAS V2

1. **Orden estricto.** F0 antes que todo. Nada de boss antes de F5.
2. **Tests siempre.** Cada fase agrega sus tests en `tools/sim`. Nada se marca hecho sin `npm test` verde.
3. **Presupuesto de rendimiento:** 60 FPS con 24 zombies vivos en el cuarto más cargado. Si una fase lo rompe, se recorta esa fase, no se ignora.
4. **Nombres fijos de V1 no se renombran.** Nuevos nombres se agregan a la tabla de CLAUDE.md.
5. **Antes de codear cada fase:** plan corto (qué archivos, qué riesgo). Espera OK.
6. **Balance en CONFIG, siempre.** Cero números mágicos en la lógica.
7. **Modelo:** Sonnet por defecto. Opus solo donde dice `[OPUS]`.

---

## F0 — DEUDA TÉCNICA `[OPUS]`
Sin esto, V2 se cae sola. Cero features nuevas.

**0.1 Colisión de props**
- Todo prop sólido (sofá, cama, refri, camioneta, mesas, cajas) tiene AABB.
- Jugador no los atraviesa. Balas se detienen en ellos.
- Las celdas que ocupan se marcan bloqueadas en el grid de navegación.
- Props decorativos chicos (botellas, conchas) quedan sin colisión — marcarlos `decor: true`.
- Test: zombie rodea un sofá entre él y el jugador, no lo cruza.

**0.2 Separar el archivo**
`index.html` ya es difícil de editar. Pasar a:
```
src/config.js  src/world.js  src/player.js  src/weapons.js
src/zombies.js src/rounds.js src/economy.js src/ui.js
src/audio.js   src/loop.js
build.js  →  concatena todo en un index.html autocontenido
```
- `node build.js` genera el `index.html` final. Sigue siendo un solo archivo jugable con doble click.
- Los tests importan desde `src/`, no del HTML.
- Resultado del build idéntico en comportamiento a v1: tests verdes antes y después.

**0.3 Flow field en vez de BFS por zombie**
Con mapa más grande y más zombies, un BFS por zombie no escala.
- Un solo BFS desde la celda del jugador hacia todo el grid, cada 250ms.
- Cada zombie lee la dirección de su celda. Costo fijo sin importar cuántos zombies.
- Test: 24 zombies en mapa V2, tiempo de nav por frame < 1ms.

---

## F1 — MAPA EXPANDIDO
De 7 a 11 zonas. Se agrega el exterior: playa y muelle.

Propuesta de coordenadas (ajustables en el plan, avisar si se cambian):

```
R8  PISCINA          [ 18,  30,   4,  20]  conecta R3 Cocina
R9  CASETA GUARDIÁN  [ 18,  26,  20,  30]  conecta R5 Dormitorio, R8
R10 PLAYA            [-20,  20, -24,  -4]  conecta R1 Porche. Abierta, arena.
R11 MUELLE           [ -2,   2, -40, -24]  conecta R10. Angosto, madera.
```

Puertas nuevas:
```
D8  R3→R8   1500
D9  R8→R9   1750
D10 R5→R9   1750
D11 R1→R10  1250   (reja de madera del porche)
D12 R10→R11 2000
```

- Playa: arena, palmeras (algunas caídas), lanchas volteadas, olas animadas en el borde. Límite invisible hacia el mar.
- Muelle: tablones con huecos, faroles, bote amarrado al final.
- Piscina: vacía, verde, con agua estancada al fondo. Se puede bajar a ella.
- Caseta: cuarto chico de madera. ~~Aquí va el Pack-a-Punch (F2).~~ F1.1: generador de F2.5; el PaP va al final del muelle (ver `F2.5-generadores-cajas.md`).
- Todo prop sólido con colisión desde el día uno (regla F0.1).

---

## F2 — POWER, PERKS Y PACK-A-PUNCH — HECHO (tag `v2-f2`)
Decisiones al cerrar: stamina 4 s / 3 s; Quick Revive como en Black Ops solo (revive sin perks, 3 compras y
desaparece); el arma del PaP se agarra en 10 s o se pierde; munición mejorada en la pared a 2500; papName en
inglés (RED TIDE, BREAKWATER, CICADA, THE LIGHTHOUSE, HURRICANE, LUNAR TIDE, PELICAN EYE, WATER VOLCANO).

**Power** — generador en R7 Sótano. Palanca, 0 puntos. Hasta encenderlo, perks y PaP apagados. Luces de toda la casa cambian al encender.

**Perks** (máx 4 por jugador, se pierden al morir):
```
Juggernog      2500  R2 Sala          HP 100 → 250
Speed Cola     3000  R6 Garaje        recarga x0.5
Double Tap     2000  R8 Piscina       cadencia x1.33, daño x1.33
Quick Revive    500  R1 Porche        solo: auto-revive, 3 usos, luego desaparece
Stamin-Up      2000  R10 Playa        sprint x1.2 y más largo
```
- Máquina cúbica con color propio y luz. Jingle procedural al acercarse.
- Íconos de perks abajo a la izquierda del HUD.

**Stamina** (nota del playtest de F2.6): hoy el sprint es infinito, y así Stamin-Up no tiene sentido.
Agregar stamina: p.ej. 4 s de sprint y recarga en 3 s, todo en CONFIG. Stamin-Up la alarga, además del x1.2.
~~Ojo: desde F2.6 los zombies de R9+ corren a 5.6 m/s~~ Después de F3: regla dura, ningún zombie va más
rápido que el jugador caminando (4.4). Pasos 1.6 / 2.6 / 4.0, y corren recién desde R12.

**Pack-a-Punch** — ~~R9 Caseta~~ final del muelle R11 (F2.5, lugar en `CONFIG.PAP.spot`). 5000. ~~Solo con power.~~ Lo habilitan los 4 generadores + 3 cajas de almas (`F2.5-generadores-cajas.md`).
- Animación 4s, arma sale con brillo de camo, nombre nuevo, daño x2, cargador y reserva x1.5.
- Re-PaP no existe en V2.

---

## F2.6 — FIXES DEL PLAYTEST (hasta ronda 15)
- Piscina: zombies atrapados en el fondo. Causa: con el jugador en la franja este (fuera del grid), el origen
  del flow field saltaba el borde y caía dentro de la pileta. Fix: origen con línea libre, R8 hasta x=31
  (franja este caminable), el jugador se tira desde cualquier borde, y los zombies suben y bajan solo por
  la rampa y 3 escaleras (enlaces del flow field + estado `climb`).
- Velocidad por ronda con 3 pasos (caminar 1.9 / trotar 3.4 / correr 5.6), correr < sprint. Después de F3
  bajó a 1.6 / 2.6 / 4.0, con tope en la velocidad del jugador caminando (ver CLAUDE.md, Balance).
- Bordes de la pileta: z-fighting entre las paredes de la pileta y el piso, más filtrado anisotrópico.

---

## F2.7 — GRANADAS (después de F2.6) — HECHO (tag `v2-f2.7`)
Decisiones al cerrar: la granada propia ignora el i-frame y **puede matar**; no atraviesa paredes; ignora los
límites invisibles; atraviesa zombies.
- Tecla G. Máx 4. +2 al inicio de cada ronda (sin pasar de 4).
- Mantener G = cocinarla. Mecha 3 s total, explota en la mano si la cocinás de más.
- Radio 5 m, daño con caída por distancia. Daño 300 + 50×ronda en el centro, para que no quede inútil en
  rondas altas.
- Daño propio: 50 si estás dentro del radio (castiga tirarla a tus pies, no te mata).
- Rebota en paredes y props. No atraviesa colliders.
- Kills de granada cuentan para las cajas de almas.
- Max Ammo NO recarga granadas.
- HUD: íconos de granada junto a la munición.
- Sonido de pin, rebote y explosión + screen shake por distancia.
- Test: rebote, radio, daño propio, conteo por ronda, tope de 4.
- Notas técnicas (Claude Code, a confirmar en el plan de F2.7):
  - Propuesta: la explosión no atraviesa paredes (`segmentClear(..., shotOnly)`, como el área de la Ray Gun).
  - Las kills pasan por `damageZombie` → `onZombieDeath`, así que las almas se cuentan solas.
  - "50 de daño propio" choca con el `hitIframe`: definir si la explosión lo respeta.
  - Pool de granadas (4 meshes) creado una vez; la explosión reusa `splashFx` y una luz existente, sin
    `scene.add(light)`.

---

## F3 — ARMAS — HECHO (tag `v2-f3`)
Decisiones al cerrar: escudo 500 de durabilidad, empujón 100 + 2 m cada 0.8 s, equipado no dispara; machete
500 parejo (sin ×cabeza), una vez por partida, sin PaP; doble cañón en un tablón propio del muelle; ADS con
clic derecho (el cuchillo quedó solo en V). papName: SEA SERPENT, TWIN TIDES, NARWHAL. Los modelos de las
armas de V1 no se detallaron (pasa a F7).

Nuevas:
```
Revolver         wall R10 Playa     900    daño 110, 6 balas
Doble cañón      wall R11 Muelle   1500    daño 45x10, 2 balas
Machete          wall R3 Cocina    3000    reemplaza cuchillo: daño 500, mismo cooldown
Ballesta         box                       daño 400, perfora 3 zombies
```

Nombres PaP para todas las armas en CONFIG.WEAPONS[*].papName (las 8 actuales ya lo tienen desde F2; las
nuevas de F3 necesitan el suyo, en inglés).

**Mesa de crafteo + Escudo.** La mesa es el banco de trabajo que ya existe en R6 Garaje (prop `banco`), no
un prop nuevo.
- Escudo: 3 piezas. Cada una aparece en 1 de 3 lugares posibles, sorteado por partida:
  - Puerta de alacena: R3 Cocina / R2 Sala / R5 Dormitorio
  - Tabla de surf rota: R6 Garaje / R10 Playa / R1 Porche
  - Manija de metal: R7 Sótano / R9 Caseta / R4 Pasillo
- Se recogen con F. 3 íconos en el HUD. Construir: mantener F 3 s en la mesa.
- En la espalda: bloquea golpes por detrás. Equipado (tecla 3): bloquea de frente, clic = empujón.
- Teclas numéricas (primeras del juego): 1 y 2 = armas, 3 = escudo. Q sigue alternando las armas.
- Durabilidad en CONFIG. Al romperse se retoma de la mesa sin piezas nuevas: una vez construido, queda
  disponible toda la partida.
- `resetGame()` limpia piezas y escudo.

La Ola Rompiente dejó de ser arma de la caja: ahora es la quest de F5.5.

Mejoras al sistema:
- Animaciones de recarga por arma (no todas iguales).
- Modelos de arma más detallados (más cubos, colores por pieza).
- ADS (apuntar con click derecho mantenido): zoom + menos dispersión. El cuchillo pasa solo a V.

---

## F4 — ENEMIGOS — HECHO (tag `v2-f4`)
Decisiones al cerrar: vivos a la vez 8, y desde R8 +1 por ronda (tope 24); total por ronda `6 + 2n` sin tope.
Ahogado desde R6, 25% de los spawns con el jugador en playa/muelle. Arrastrado por daño en las piernas (40%), sin
desmembrar (F7). Perros: poodles y chihuahuas blancos con puntos negros, a 4.2 m/s con tope en la velocidad del
jugador caminando (la regla no tiene excepciones), de noche, cartel "¿QUIÉN DESPERTÓ AL CHICHARITO!?".

**Balance post ronda 10:** vida x1.1 por ronda (como CoD). Cantidad tope sigue 24 vivos, total por ronda sube.

**Variantes:**
- ~~**Corredor** — desde ronda 8, 30% de los spawns. Velocidad x1.4.~~ Absorbido en F2.6: pasos
  caminar/trotar/correr por ronda (`CONFIG.ZOMBIE.gaits` y `gaitByRound`).
- **Arrastrado** — si se le vuela la pierna (F7 desmembramiento) se arrastra, lento, sigue atacando.
- **Ahogado** — sale del mar en R10/R11. Vida x1.5, lento, gotea agua. Solo si playa abierta.

**Ronda especial — Perros de playa:** cada 5-7 rondas (aleatorio). Rápidos, poca vida, spawnean con relámpago. Al terminar la ronda: Max Ammo garantizado.

---

## F5 — BOSS: EL SOMBRERÓN `[OPUS]` — HECHO (tag `v2-f5`)
Decisiones al cerrar: velocidad 1.6 / 3.0 / embestida 4.4 (nunca más que el jugador caminando); no rompe
muebles: si choca con uno o con una pared queda aturdido 2 s; si los perros caen en su ronda se corren a la
siguiente; insta-kill le hace el daño normal. Radio de choque de zombie (el modelo es grande). Con 4 perks, 1000
puntos más en vez del perk. La cuerda de guitarra queda para F5.5.

Leyenda guatemalteca. Enorme, sombrero gigante, se mueve con guitarra a la espalda.

- **Aparece** ronda 12, luego cada 8 rondas. Sale de la neblina en R10 Playa y camina hacia el jugador por la ruta de puertas abiertas.
- **Vida:** 4000 + 800 × ronda. Barra arriba de la pantalla con su nombre.
- **Punto débil:** el sombrero. Daño x3. Volarle el sombrero (25% de su vida en daño al sombrero) = pasa a fase 2.

**Fases:**
1. Camina lento, barrido de mano (40 dmg, empuja).
2. Sin sombrero: más rápido, **silbido** cada 12s → visión borrosa y controles lentos 2s. Invoca 4 zombies.
3. Bajo 30%: carga en línea recta, rompe props en su camino.

- Los zombies normales siguen spawneando durante la pelea, a la mitad de ritmo.
- **Recompensa:** Max Ammo + perk gratis aleatorio que no tengas + 1000 puntos.
- Música de pelea (F6).
- Test: boss navega por flow field, no se traba en puertas de 2 unidades.

---

## F5.5 — QUEST DE LA OLA ROMPIENTE — HECHO (tag `v2-f5.5`)

Depende del boss de F5 (la cuerda) y de la mesa de F3 (se arma ahí).

Piezas, en cualquier orden, progreso por partida:
1. **Cocos:** 2 cocos en palmeras de R10 Playa. Se les dispara, caen, y hay que recoger los dos.
2. **Cuerda de guitarra:** la suelta El Sombrerón al morir.
3. **Caracola:** tirar una granada al agua al final del muelle R11. Sale flotando.

- HUD: 3 íconos grises que se llenan.
- Con las 3: mantener F 3 s en la mesa del Garaje → Ola Rompiente.
- **Ola Rompiente:** una ola en cono de 8 u que empuja y mata. 12 cargas, reserva 36. PaP: "MARENA'S TSUNAMI" (en inglés, como los demás).
- Una por partida; se pierde si morís.
- Test: cada pieza se registra una vez, los cocos solo con bala, la caracola solo con granada en esa zona, la
  cuerda solo del boss, construir requiere las 3, el reset limpia todo.

Decisiones al cerrar:
- **Se arma en un taller de tablas nuevo, en la esquina NO de la playa, no en el garaje.** El banco del garaje
  queda para el escudo.
- **"Se pierde si morís" = al revivir con Quick Revive.** Queda armada: vuelve a la mesa y se saca con F con la
  munición que tenía.
- **Daño alto, no insta-kill:** 2500 por zombie, y al Sombrerón ×0.4 (1000) sin empujarlo.
- La cuerda recién aparece en la R12 (el primer boss), así que la quest no se completa antes.
- **Después del playtest (Diego):**
  - **Coco:** uno solo, en 1 de las 4 palmeras sorteada por partida y sin marca. Solo el machete voltea la
    palmera; deja el coco en la arena y el coco se pone dorado.
  - **El Sombrerón (reabre F5):**
    - Velocidad según la vida: de 1.6 a 4.4 al 25%.
    - La embestida pasa al 25%.
    - Tira guitarras (5–20 m, cada 4 s, 30 de daño).
    - Al 10% saca una minigun de cocos: 20 por coco ignorando el i-frame, ráfagas de 2.5 s. Mata.
    - La vida no cambia.
    - Segunda ronda: la minigun baja a 10 por coco. El barrido pasa a ser un golpe al piso como el Margwa:
      0.7 s de aviso, onda de 3.5 m, 50 de daño, y el escudo no lo para.
    - El silbido solo aturde de cerca: a menos de 8 m y en su nivel (antes 25 m, casi todo el mapa).

---

## F5.6 — JARDINES, TECHO Y MUELLE — HECHO (falta playtest, commit y tag `v2-f5.6`)

Implementado como se propuso abajo. Cambios de detalle al hacerlo:
- La caja de la playa pasó a x −17: en x −12 tapaba la reja D14.
- El generador del muelle pasó al lado este de la plataforma: al oeste entra la pasarela.
- Bug de la cama: el origen del flow field ya caía en el dormitorio. Lo que te hacía intocable era el
  alcance: se arregló con `playerOnTop` y un golpe de 1.9 m cuando estás arriba de un mueble.
- Arriba del techo, `updateInteract` solo ofrece lo que está arriba.

Reabre F1 (mapa), F2.8 (techo), F2 (power), F2.5 (lugares del muelle) y F3 (wall buys). Diego contestó las
preguntas (2026-09-24); abajo ya van sus respuestas. El techo cambió de recorrido (C).

Mapa de hoy, para ubicarse (x hacia el este, z hacia el norte):
- z −40..−24 muelle (x −4..4) · z −24..−4 playa (x −20..20) · z −4..4 porche (x −6..6).
- z 4..18 sala (x −8..8), cocina (x 8..18) y piscina (x 18..31, hasta z 20).
- z 18..30 garaje (x −16..−4), pasillo (x −4..4), dormitorio (x 4..16), caseta (x 16..24).
- z 30..40 sótano (x −16..−4).

### A. Bugs (primero, son chicos)
1. **La cama:** parado encima, los zombies no te encuentran.
   - Causa confirmada: el origen del flow field se busca con línea libre desde tus pies, pero los pies
     están adentro del collider de la cama. Ninguna celda pasa y cae al respaldo sin línea: la celda más
     cercana, del otro lado de la pared del pasillo.
   - Fix: esa línea libre ignora lo que está debajo de tus pies (`minTop`, como ya hace el ataque). Sirve
     para la cama y para cualquier mueble.
   - Test en `climb.js`: parado en cama, sofá y mesa, un zombie te alcanza.
2. **El power se prende sin generadores:** hoy es a propósito (el power es independiente, F2). Diego lo ve
   como bug.
   - **Respuesta: la palanca del sótano pide los 4 generadores prendidos.** Sin ellos, el cartel dice cuántos
     faltan y F no hace nada.
   - Consecuencia aceptada: los perks llegan más tarde.

### B. Jardín Oeste (R12, nuevo)
- En forma de L, al costado oeste de la casa, desde la cerca de la playa (z −4) hasta el fondo del sótano
  (z 40). Una parte x −24..−8 al lado de la sala (z −4..18) y otra x −24..−16 al lado del garaje y el
  sótano (z 18..40). Dos cajas con el mismo id, como el muelle.
- Pasto, cerco de arbustos de 2 m en el borde oeste y el norte (frena todo, como una pared).
- **Acceso: solo la reja D14** en la cerca de la playa (x −14..−10). Diego: la L sí, pero sin puertas desde
  la sala ni el garaje.
  - **Precio 2000**, no menos: D11 + D14 = 3250 = el camino más barato a la piscina (el techo conecta este
    jardín con la piscina).
- **El taller de tablas se muda acá**, al fondo de la L (al lado del garaje).
- **Escalera 2** al techo, pegada a la **pared oeste de la sala** (el techo accesible pasa por la sala, ver
  C). Es una rampa como la de la piscina, de 1 m de ancho, y llega directo al techo de la sala.

### C. Techo: solo un tercio, una pasarela de madera
- **Respuesta de Diego: por encima de la caseta, el dormitorio, la cocina y la sala.** Es una pasarela de
  ~6 m de ancho en forma de S, de ~340 m² (un tercio):
  - arranca en el descanso de la escalera de la piscina;
  - cruza la caseta y el dormitorio hacia el oeste (z 22..28, x 25 → 8);
  - baja al sur por encima del paso de la cocina y la cocina (x 8..14, z 28 → 8);
  - cruza la sala hacia el oeste (z 8..14, x 14 → −8);
  - termina en la escalera 2, en la pared oeste de la sala.
- El resto del techo sigue siendo sólido, pero no se llega (barandas). `UP.mask` y el grid de arriba se
  achican a la pasarela.
- **Piso de madera** (tablones, textura por canvas) sobre la franja.
- **Barandas de madera** de 1.1 m en los dos bordes largos: bloquean el acceso al resto del techo. Se
  dispara por encima, como las rejas. El borde hacia la escalera y el descanso queda abierto.
- **Plantas carnívoras** en macetas a lo largo de la pasarela, en zig-zag para que haya que esquivarlas:
  - la maceta es sólida (collider de nivel 1: los zombies la rodean);
  - a menos de 2.5 m se abre y avisa (sonido);
  - a menos de **1.2 m te muerde y te mata** (con Quick Revive, revivís);
  - a los zombies no les hace nada (respuesta de Diego).
  - Construidas una vez, fusionadas en un `MeshBuilder`. Solo la boca de cada una se anima.
- **Doble cañón:** su pared se muda al techo, en un poste de la baranda (`post:true`, como en el muelle).
- Zombies arriba: suben y bajan por las 2 escaleras (dos enlaces `NAV.link`).
- El techo del garaje y el del pasillo quedan fuera de la pasarela.

### D. Jardín Trasero (R13, nuevo)
- Detrás del pasillo, el dormitorio y la caseta: x −4..35, z 30..40. Se agrega un pasillo al aire libre
  x 31..35, z 16..30, pegado al este de la piscina.
- **Accesos** (puertas nuevas):
  - D15 desde la piscina (pared este, x 31);
  - D16 desde el sótano (pared este, x −4);
  - D17 desde el pasillo (pared norte, z 28).
  - Precios propuestos: 2000 / 2000 / 1500. `map.js` verifica con Dijkstra que ninguna abarate el camino
    a la piscina.
- **Mystery box:** un lugar más acá. Sigue arrancando en el dormitorio (respuesta de Diego).
- **Rifle:** su pared se muda acá, a la pared norte del dormitorio, del lado de afuera.
- **Perros del jardín:**
  - Con el jugador en R13, durante una ronda normal desde la R5 (confirmado), el 20% de los spawns sale como perro desde
    2 puntos del jardín.
  - **Máximo 3 por partida** (`roundState.gardenDogs`).
  - No hace de noche ni suelta Max Ammo (eso es de la ronda de perros).
  - Usa el pool de perros que ya existe.

### E. Muelle más adentro y con un segundo acceso
- Tronco x −2..2 hasta z −44. **Plataforma** x −4..4, z −50..−44.
- **Segundo acceso por x ≈ −17:** una pasarela de la playa x −19..−15, de z −24 a z −47, y un tramo que la
  une con la plataforma (z −47..−45). Queda un circuito.
  - Reja D18 en la entrada (2000, igual que D12).
  - Con cualquiera de las dos rejas abierta llegás al muelle.
- Se mudan: el PaP (0, −49.5), el generador del muelle, los spawns del muelle y la zona de la caracola.
  - El límite del mar se corta para dejar pasar la pasarela nueva.

### Orden de trabajo y costo
1. A (bugs).
2. E (muelle).
3. B (jardín oeste y taller).
4. C (techo).
5. D (jardín trasero y perros).

Cada paso con sus tests. Lo que más se toca: `world.js` (cuartos, puertas, límites, techo, grid), `map.js`,
`roof.js`, `mysterybox.js`, `wallbuys.js`, `generators.js`, `pap.js`, `quest.js`, `navcost.js` (más colliders
y un grid más grande) y el conteo de draw calls de `theme.js`.

Estimado: 2–3 sesiones. Riesgo principal: el techo (grid de 2 niveles y bordes automáticos).

### Respuestas de Diego (2026-09-24)
1. Power: los 4 generadores.
2. Jardín oeste: la L, sin más puertas (solo la reja de la playa).
3. Techo: sobre la sala, la cocina, el dormitorio y la caseta.
4. Plantas: no se comen a los zombies.
5. Mystery box: un lugar más.
6. Perros del jardín: desde la R5.

---

## F5.7 — AJUSTES DEL PLAYTEST DE F5.6 (aprobado por Diego, 2026-09-24) — HECHO (falta playtest y commit)

Al hacerlo: la plazoleta quedó en x −14..−6 (el grid trabaja en metros enteros) con el PaP en (−10, −46).
La caja de almas 'sotano' está en (−23.45, 7), en la parte de la L al lado de la sala. Las pirañas saltan
una por segundo por zona, rotando carriles (cada carril cada 3 s): así se puede pasar.

1. **Techo:**
   - Las plantas muerden 30 (no matan). Quedan 4, una en cada esquina de la pasarela, con la cabeza ×2.
   - Toda la cocina caminable (hasta (17, 5)) y la sala ensanchada hasta su borde sur. El borde este de la
     cocina da al patio de la piscina: abierto, te tirás.
   - La escalera 2, ×4 de ancha (4 m).
2. **Caídas proporcionales** (reemplaza "te deja en 10"): nada debajo de 2 m; de 2 m a 4.3 m (el techo), de
   0 a 60 de daño, parejo. Desde el techo con 100 quedás en 40. Nunca mata.
3. **Jardín Trasero:**
   - Se suma el hueco de arena entre la caseta y el pasillo exterior (x 24..31, z 20..30), con una fuente
     sólida en el medio.
   - Stamin-Up se muda acá.
4. **Jardín Oeste:**
   - Frente al taller, 3 m más ancho (x −27).
   - La caja de almas del sótano se muda acá.
   - Portón del sótano al jardín (pared oeste): se abre solo al prender la electricidad.
5. **Palmeras nuevas** (3 en la playa, 3 por jardín), sólidas y contra los bordes. El coco sigue saliendo de
   las 4 de siempre.
6. **Muelle:**
   - El PaP va en el medio de la pasarela que une los dos troncos, ensanchada a una plazoleta de 8×8. La
     plataforma del fondo queda.
   - Pirañas zombis en la primera mitad de cada tronco y en el puente C13: 3 carriles intercalados, una
     salta cada segundo de un costado al otro. 25 de daño y un empujón (respeta el i-frame); a los zombies
     nada.
7. **Laguna** este del puente: extendida hasta el mar (solo visual).
8. **Perros infernales:** ~1.6× más grandes, costillas, carne expuesta, hocico con sangre, ojos rojos, pelo
   sarnoso. Radio 0.32. La velocidad no cambia.

---

## F5.8 — SEGUNDO PLAYTEST (aprobado por Diego, 2026-09-24) — HECHO (falta playtest y commit)

Al hacerlo:
- El entrante del PaP mide 7×2 (x −13..−6), así quedan celdas libres a los costados.
- El PaP en (−9.5, −49) ocupa parte del entrante, pero no la pasarela.
- El primer tick del charco espera 1 s si el escupitajo te acababa de tocar.
- En el puente las pirañas salen de 6 m afuera con 1 s de vuelo: pasan sobre la baranda y en el medio pegan.

**Bug:** atrapado en la escalera del jardín oeste. Causa (reproducida): el costado de la rampa frenaba cualquier
movimiento con el cuerpo tocando una parte alta, también el que te aleja. Bajando por el borde o cayendo al
lado de la rampa quedabas trabado. Fix: el costado solo frena lo que te mete más adentro o más arriba.

**Piscina, escalera y jardín trasero (van juntos):**
- La escalera de la piscina se saca, con su descanso. En su lugar va una escalera en el cuadrado del jardín
  trasero, contra la pared este de la caseta, en (25.6, 25.7): sube hacia el oeste hasta el techo de la caseta.
- La piscina se agranda hasta x 35 (alineada con el cerco del jardín). El pasillo exterior del jardín de
  z 10..20 pasa a ser piscina; el de z 20..30 sigue siendo jardín.
- D15 se muda a la pared norte de la piscina, en x 30.1..32.1 (la entrada directa en (31.1, 20.1)).
- Double Tap, la caja, la reposera y el macetero se corren 4 m a la pared este nueva.
- La fuente pasa a ser esquinera, en la esquina NE del jardín (34.3, 39.5). Stamin-Up se corre a z 22 para no
  tocar la escalera.
- Paso gratis por el techo: ahora es jardín trasero ↔ jardín oeste (antes piscina ↔ jardín oeste).

**Techo:**
- Barandas en TODO el borde de la pasarela. Se dejan abiertos solo la llegada de las dos escaleras y un hueco
  de 2 m sobre la piscina, en el borde este de la cocina.
- Juggernog en el techo, sobre la sala.
- Plantas: muerden desde 4 m.
- Escupitajo verde, muy de vez en cuando:
  - de las plantas, cada 12–20 s si estás a menos de 10 m; de los ahogados, cada ~10 s entre 5 y 15 m;
  - es un proyectil lento que se esquiva; si te toca, 15;
  - deja un charco de 1.5 m que dura 3 s y saca 10 por segundo si lo pisás.

**Otros:**
- Perros a 4.7 m/s: **excepción aprobada por Diego a la regla "nunca más rápido que el jugador caminando"**.
- Tres tamaños de perro al azar (×1, ×1.25, ×1.5; el actual es el chico), con la vida en la misma proporción.
- Muelle: sin plazoleta (los pisos superpuestos parpadeaban). Queda un entrante de 5×2 m al sur de la
  pasarela, con el PaP a la orilla en (−9.5, −49).
- Pirañas en orden al azar. En el puente saltan desde más lejos y más alto.
- Cajas de almas sin el círculo rojo.
- Charcos de arena mojada en la playa: 4 rectángulos de 6×3 m que ralentizan a ×0.6 al jugador y a los zombies.
- Boss: la niebla se cierra al aparecer y queda cerrada toda la pelea (se abre cuando muere).

---

## F5.9 — TRAMPAS, CALAMARES, CALAMARÓN Y NOCHE (aprobado por Diego, 2026-09-24) — HECHO (falta playtest y commit)

Decisiones tomadas al implementar (ver CLAUDE.md):
- Las plantas comen arrastrados **en el techo** (están arriba). La tortuga se ve y se le dispara desde la pasarela.
- Mobs: la 5ta **y cada 5** son 4 Sombrerones. Las demás desde la 3ra, mezcla.
- Las trampas no le hacen nada al boss.

**A. Chicos:**
- Sombrerón con vida ×1.3.
- Ahogados: trotan (antes caminaban).
- Ojos del Sombrerón: amarillos debajo del 20% y rojos con lágrimas debajo del 10%.

**B. Quest de la caracola (reemplaza la granada al agua):**
- 3 de las 4 plantas se tienen que comer 6 arrastrados cada una.
  - Una planta se come a un arrastrado que entra a su radio, uno cada 1.5 s.
  - A los zombies normales siguen sin tocarlos.
- La planta completa se vuelve morada y medio alienígena.
- Con 3 completas, la caracola sobre la **estatua de una tortuga bailando** (techo del sótano, (−10.2, 32.3))
  se pone brillante.
- Si le disparás, cae al jardín oeste y se recoge con F. Antes de eso está opaca y no le pasa nada.

**C. Trampas** (no dan puntos por kill; enfriamiento de 60 s):
- **Tiburón:** palanca en el muelle, 1500. Durante 10 s salta de lado a lado y se come a los zombies del muelle.
  A vos te pega poco (20) si te cruza.
- **Cortadora de césped:** palanca en el jardín oeste, 1000. Durante 20 s da vueltas en un círculo de ~4 m
  frente al taller. Mata zombies y a vos te pega 40.

**D. Noche por rondas:**
- De la R1 a la R15 se oscurece parejo.
- R15–R20: noche con truenos.
- R21–R25: neblina morada.
- R25 en adelante: neblina morada, truenos y lluvia.
- En las rondas de mobs: lluvia y más rayos.

**E. Calamares** (mob nuevo):
- Grandes, feos, se arrastran, con más vida que un perro y más rápidos que un zombie, pero no tanto como un
  perro.
- Chorro de tinta morada y roja: 20 de daño y una mancha en la pantalla. Más grande = más fuerte.
- Se fusionan al tocarse: hasta 7 fusiones, con la vida sumada.
- Rondas de mobs:
  - 1ª perros, 2ª calamares, desde la 3ª perros y calamares mezclados;
  - **la 5ª son 4 Sombrerones normales**.

**F. Bosses:**
- R12: el Sombrerón.
- R20: el **Calamarón**, mitad Sombrerón y mitad calamar, con la vida del Sombrerón ×2.
  - Tiene la minigun desde el principio.
  - Con poca vida lanza calamares que explotan en charcos verdes grandes.
- R28 (y después): 2 Sombrerones y 1 Calamarón.
- `boss.js` pasa a soportar varios bosses a la vez.

---

## F5.10 — RANCHO, KABOOM Y AJUSTES (aprobado por Diego, 2026-09-24) — HECHO (falta playtest y commit)
- Plantas: sin mordida al jugador; animación en el mundo cuando se comen un arrastrado. El paso de la quest no cambia.
- Calamar: chorro continuo (1.5 s echando, 20/s × tamaño, 3 s de descanso).
- Calamarón: tope de 6 invocados vivos entre todos los bosses; él llama 2.
- Kaboom (power-up): mueren todos los zombies menos el boss, arden 5 s y mientras tanto no sale nadie.
- Tecla O: +15000, puertas, generadores, energía, almas y PaP. No toca las plantas.
- Neblina morada a 30 m; estrellas; la arena mojada no frena a los zombies; tortuga ×2.
- Langostino bailando al lado de la tortuga cuando las 3 cajas de almas están llenas.
- Rancho de playa (R14, x −41..−27): palapa abierta con billar y barra, caja y Speed Cola, tras un lazo de 1500
  que se compra desde el jardín. Tortugario con trampa de tortugas (1500, 20 s, no te hacen nada).

## F5.11 — JARDÍN NORTE, BÚNKER, ARMAS Y LANGOSTINO (aprobado por Diego, 2026-09-24) — HECHO (falta playtest y commit)
- **Mapa:**
  - El rancho baja hasta el mar: pasto en x −41..−24, z −4..18, y arena en x −41..−20, z −24..−4. Queda detrás
    del lazo, con cerco hacia la playa y el jardín.
  - **Jardín Norte** (z 40..55.7, x −27..35): une el jardín oeste y el trasero por detrás del sótano. El rancho
    sigue con su cerco.
  - Escalera del jardín trasero ×3 de ancho (hacia donde estaba Stamin-Up). Stamin-Up pasa a la pared norte de
    la caseta.
  - Techo de la palapa más alto. Reposeras, flores, palmeras y sombrillas en los jardines.
- **Escotilla y búnker:**
  - Escotilla detrás de la pared norte del sótano.
  - El búnker es una zona aparte bajo tierra, porque debajo del sótano literal pediría un tercer nivel de grid.
    Se entra por la escotilla con un fundido; los zombies bajan por un enlace del grid.
  - Los zombies que bajan tienen los ojos rojos.
  - Adentro: el teletransportador de BO apagado (rojo), Mule Kick (3 armas) y la bazooka en la pared.
  - Oscuro, con focos que brillan sin ser luces.
- **Estatuas de plantas** en la escotilla:
  - Cada una despierta con 5 calamares muertos cerca; después come 6 arrastrados y 3 perros.
  - Solo comen, no escupen.
  - Con las 2, se abre la escotilla y aparece un caballito de mar en el techo del sótano.
- **Armas nuevas (6)**, todas en la caja y ninguna en paredes: Arco (tiro cargado), Bazooka (también en el
  búnker), Uzi, AK-47, Desert Eagle y SPAS-12. La caja ofrece todas las armas, y la Ray Gun sale menos.
- **Langostino bailarín** (el mono de BO):
  - Sale de la caja con 3 cargas, se tira con la tecla 4 y el Max Ammo lo recarga.
  - Baila 8 s y todos los zombies van hacia él, menos el boss. Después explota.
- **Tortugas:** matan de una hasta la R10; después cada mordisco saca la vida de la R10.
- **Caracola:** hacen falta las 4 plantas del techo.
- **Menú:** opción para quitar los números de daño.
- **Rondas con calamares:**
  - Al empezar suena un rugido y sale un calamar gigante del mar que escupe calamares a la playa: así salen
    la mayoría.
  - El resto sale de la orilla. Solo salen del mar.

## F5.12 — JUNGLA ALREDEDOR, CERCOS QUE SE QUEMAN Y AJUSTES (aprobado por Diego, 2026-09-24) — HECHO (falta playtest y commit)
- **Mapa cuadrado rodeado de jungla** (el sur sigue siendo el mar):
  - Jungla norte: x −60..55, z 40..74.
  - Jungla oeste: x −60..−41, z −24..40.
  - Jungla este: x 35..55 hasta el mar, más la parte de la laguna que bajaba al mar (x 20..35, z −24..−4).
  - La laguna queda solo al lado del puente, con sus pirañas.
  - El borde de afuera es un límite invisible tapado por jungla tupida.
- **Cercos que se compran y se queman** (arden unos segundos y desaparecen): rancho ↔ jardín oeste, rancho ↔
  jungla norte, rancho ↔ jungla oeste y rancho ↔ playa (1500 cada uno); playa ↔ jungla este (2000, para que la
  jungla no abarate la ruta a los jardines). El lazo D20 queda. Los cercos que solo dividían jardines se sacan.
- **Jungla:** pasto oscuro, árboles y palmeras (troncos sólidos, separados), helechos, lianas, rocas y flores,
  con instancias.
- **El búnker se muda** bajo el mar, al sur del muelle (el jardín norte lo pisaba en x,z). Se sigue bajando por
  la escotilla.
- **Otros:**
  - Agentes del FBI muertos en el búnker.
  - El langostino rebota menos, brilla y baila 10 s.
  - El calamar gigante: el doble de grande, más ojos, dientes y la boca brillando en rojo.
  - La ronda arriba a la derecha, en números romanos.

## F5.13 — TEMPLO, CABEZA DE CALAMAR Y REUBICACIONES (aprobado por Diego, 2026-09-24) — HECHO (sin commit)
Nota: la cabeza es un montículo sólido desde la R1 (no se atraviesa algo que ya se ve); en la R13 se abre el túnel.
- **Kaboom:** siempre da 1000 + 50 × (ronda − 1) puntos.
- **Tecla O:** también abre el búnker.
- **Zombies:** salen del piso escarbando, ~2 s, con tierra.
- **Templo estilo Tikal** en la esquina NE (53.9, 73.4):
  - Cima caminable a 4.3 m (el nivel del techo, así los zombies suben), con dos rampas y el Pack-a-Punch arriba.
  - Santuario decorativo alto encima.
  - Pasto alrededor y un río que rodea la entrada, con pirañas y tres puentes.
- **Reubicaciones:**
  - Juggernog al muelle (donde estaba el PaP).
  - Mesa del escudo arriba, en la pasarela.
  - Taller de la Ola en la playa.
- **Puesto de salvavidas** en la playa: ahí se compra el revólver.
- **Borde oeste en x −75**, con una lengua de arena al suroeste (hasta z −60).
  - **Cabeza de calamar muerto** en (−58, −52): sube un poco cada ronda y en la R13 termina de salir. Recién
    entonces es sólida y se entra por la boca, un túnel largo con saliva que brilla.
  - El cuerpo se hunde en el mar.
  - Las estatuas del techo del sótano (tortuga con la caracola, langostino y caballito) se mudan ahí. La
    caracola cae enfrente de la boca.
- **Rancho** ~15 m al oeste, abierto dentro de la jungla. El lazo queda entre el jardín oeste y la jungla.
  Tortugario contra un borde y más grande.
- **Entrada del búnker:** mismo lugar y misma F, pero se ve como un búnker de hormigón con puertas blindadas,
  4 veces más ancho. Las plantas estatua a los costados.

## F5.14 — ALMEJAS, FUMIGADOR Y OLA MEJORADA (aprobado por Diego, 2026-09-24) — HECHO (sin commit)
Nota: "40°" se tomó como ±40° desde el eje (antes ±30°).
- **Fumigador:** aparece por partida en el porche o en la playa (al azar); se agarra con F.
- **9 almejas** repartidas por el mapa. Con el fumigador, mantener F 1.5 s: se abren y en vez de perla está el
  premio. Cada una da una cosa por color y vuelve a vacía hasta el próximo cambio.
- **Colores** (cada almeja avanza sola cada 3–4 rondas): vacía → verde → amarilla → morada → vacía.

  | Color | Premios |
  |---|---|
  | Verde | zombie 50% · power-up 25% · francotirador 25% |
  | Amarilla | calamar 50% · power-up 25% · escopeta o revólver 25% |
  | Morada | pieza de la Ola 35% (hasta que sale; reemplaza al coco) · calamar grande que sale escarbando 40% · rifle o ballesta 25% |

- **Ola Rompiente:** cono de 12 m y 40°, ola alta con cresta de espuma, salpicadura y anillo de espuma.

## F5.15 — MAPA POR ÁREAS (aprobado por Diego, 2026-09-25; va después de F7) — HECHO (sin commit)
Notas: H5 quedó en 2000 (D11 + H5 = 3250, como los demás accesos desde la playa). Sin D9/D10, la piscina se abre
con D1 + D3 (1750) por los arcos de la casa.
Bug del playtest de F7 (ya arreglado): el filtro CSS del post-proceso ponía el canvas encima del HUD y del menú de
pausa. El canvas va primero en el body.

Decisiones de Diego: sacar D5, D9 y D10 · jungla con espesura total fuera de áreas y senderos · extender solo la
esquina NE para el templo · las estatuas del búnker despiertan con 5 kills de cualquier tipo.

- **Tanda 1:**
  - Pirañas: cada zona salta solo con el jugador a menos de ~12 m.
  - Cabeza del calamar más grande: 16 × 24 m y 9 m de alto; túnel de 5 m con techo a 4.5 m, cámara con techo a
    6 m (entra la cabeza del langostino).
  - Torre de salvavidas en (−26, −22), más larga y de estilo rancho. Se saca el cerco H5: esa arena queda en la
    playa y el revólver se compra ahí.
- **Tanda 2: búnker.** La entrada va a la esquina (−73, 73), con exterior semidestruido (hormigón rajado, esquina
  derrumbada, hierros, puertas oxidadas y torcidas, lianas, cráter, barriles). Las estatuas van con ella y
  despiertan con 5 kills de cualquier tipo cerca. El cuarto de abajo y la F quedan igual.
- **Tanda 3: templo.** Anexo NE (x 60..95, z 60..100, jungla). Templo de base 20 m, 5 escalones y cima a 4.3 m (nivel
  del techo). El PaP va en un cuarto (santuario 8×8 con puerta, techo a 5 m, crestería alta). Río y puentes
  alrededor. Crecen NAV y UP.
- **Tanda 4: áreas y corredores (estilo BO3).**
  - Áreas con identidad: Casa, Playa (con la oeste), Muelle, Rancho + Jardín oeste, Jardines (norte), Campamento
    (jungla este), Playa del Calamar, Claro del Búnker y Templo.
  - Las unen senderos de 5 m con paredes de vegetación densa (frenan gente y balas). Lo demás es espesura
    impenetrable.
  - Cada área tiene 1 o 2 entradas con barrera comprable (lianas que se queman, escombros, reja), sin atajos
    (Dijkstra en `map.js`).
  - **Casa:** sin D5, D9 ni D10 (arcos), D6 1250 y D7 1500. Toda la casa: 8.250 (antes 13.750), con D1 + D2 + D8 =
    3250.
- Cada tanda con tests y una partida simulada (`soak.js`).

## F5.16 — 5 ÁREAS (aprobado por Diego, 2026-09-25) — PLAN, va por tandas

**Áreas:** 1 Casa (playa + casa + jardines + muelle) · 2 Templo · 3 Búnker · 4 Rancho + tortugario · 5 Calamar +
embarcadero.
**Conexiones:** Casa ↔ Rancho · Casa ↔ Templo · Rancho ↔ Calamar · Rancho ↔ Búnker · Templo ↔ Calamar por un
portal. Nada más: Casa no llega directo ni al Búnker ni al Calamar.

Decisiones de Diego (2026-09-25):
- El Campamento (R18, lianas H4 y H7) se elimina y queda como espesura. Su almeja y sus spawns se reubican.
- Portal de ida y vuelta, gratis. Se activa al abrir el templo. Los zombies no lo usan: el flow field no cruza
  portales.
- ~~El corredor de la estación lleva al búnker actual~~ **Cambio de Diego (2026-09-25): el búnker actual se queda
  como está** (escotilla, estatuas, Mule Kick, bazooka), un poco alejado de la estación. El corredor oscuro de la
  estación lleva a un búnker nuevo, más chico.
- Niebla permanente de ~30 m (Diego la subió a 40 m tras probar). Con eso se recorta el dibujo lejano (camera.far / ocultar lo que está lejos) para
  ganar FPS.

**Perks:** QR en el porche (ya está) · Jugg al final del muelle · Speed Cola en el rancho (ya está) · Double Tap
en el calamar · Stamin-Up en el búnker · Mule Kick abajo en el búnker (no cambia).
**Generadores:** piscina (ya está) · muelle (ya está) · rancho (sale de la caseta) · estación de policía (sale del
garaje).
**Armas de pared** (Casa 3, cada área 1-2; propuesta, a confirmar en su tanda): Casa: escopeta, subfusil, revólver
(+ machete, que es cuerpo a cuerpo) · Rancho: doble cañón, rifle · Calamar: LMG · Búnker: bazooka (abajo) + Uzi
(estación) · Templo: ballesta o francotirador.

### Tanda A — ajustes sin tocar la topología — HECHO (falta playtest)
- La caja devuelve los 950 cuando sale el oso.
- Niebla fija de ~30 m, más el recorte de dibujo lejano. Medir draw calls antes y después.
- Lluvia siempre en el templo y en el búnker, en cualquier ronda (clima por zona, no por ronda).
- Bug: el piso del rancho parpadea (z-fighting entre planos superpuestos).
- Techo solo techo: se sacan las escaleras 1 y 2 y la pasarela deja de caminarse (el grid de arriba queda solo
  para la cima del templo). Las plantas carnívoras bajan a los jardines, repartidas. El banco del escudo vuelve
  al garaje y el doble cañón baja.
- Muelle de un solo acceso, como el original: sin segundo tronco, pasarela ni D18. Jugg al final.
- Generador de la caseta al rancho.
- Ojo: la quest de la caracola pide plantas que comen arrastrados en el techo. Pasa a ser en el piso del jardín.

### Tanda B — topología — HECHO (falta playtest)
- Borrar el Campamento (R18, H4, H7) y los accesos que sobran: H3 (casa → búnker) y H5 (playa oeste → calamar).
- Quedan: Casa ↔ Rancho (lazo D20), Rancho ↔ Búnker (H2), Rancho ↔ Calamar (H8), Casa ↔ Templo (H6).
- Portal Templo ↔ Calamar (fundido a negro, como la escotilla).
- Recalcular precios con Dijkstra en `map.js`. Reubicar almejas, spawns y armas de pared.

### Tanda C — Rancho y tortugario — HECHO (falta playtest)
- Rancho un poco más grande. Tortugario del tamaño del rancho, abierto y corrible.
- Cueva en el tortugario, con la única tortuga viva. La trampa se activa ahí.
- Huesos de zombies y de tortugas por el piso.
- Speed Cola, generador, doble cañón y rifle.

### Tanda D — Búnker y estación de policía — HECHO (F5.17: la estación pasó a ser el caparazón de tortuga gigante)
- Mini estación de policía destrozada en el Claro del Búnker, con cadáveres de policías.
- Puerta comprable. Al asomarte, 3 zombies comiéndose a un policía muerto. Al comprar la puerta se dan cuenta y
  van por vos.
- Adentro, un corredor muy oscuro que baja a un búnker nuevo y chico. El búnker actual (escotilla, estatuas,
  caballito de mar) no cambia y queda algo alejado de la estación.
- Generador en la estación, Stamin-Up y Uzi. Lluvia siempre.

### F5.17 — Estilo BO2 y rediseños (pedido de Diego, 2026-09-25) — HECHO (falta playtest)
Pedido: "que no sea tanto Minecraft, más BO2 zombies". Rediseñar la estación (se ve mal), la cueva de la tortuga, el
templo (básico), el rancho y los jardines (planos). La barra contra el cerco sur (tapaba a la tortuga), el rifle
fuera del camino, sacar lo verde junto al perk de la piscina. **La estación se cambia por un caparazón de tortuga
gigante** que se recorre adentro, con gradas, sangre verde viscosa que brilla, casi hasta z 90, más atrás en el
claro (que crece).
- Herramientas: formas curvas y hojas con alfa en el `MeshBuilder`, filtrado lineal, jungla por celdas (FPS).
- Hecho en las áreas nombradas.
- **F5.17b:** cielo visible (domo barato: un draw call), rayo de luz sobre la mystery box, la pared playa ↔ playa del
  calamar arde con H8, Stamin-Up arriba en el caparazón con hueco en la baranda, piso verde bajo la espesura.
- **F5.17c:** zombies, perros, calamares y bosses con formas curvas; la casa (zócalos, molduras, guardasillas,
  muebles redondeados), el muelle (pilotes redondos, sogas, faroles de hierro, bote torneado), la cabeza del calamar
  (superficie curva con túnel en arco, pico, ojos, tentáculos) y la playa (sombrillas, castillo, botes, troncos).
- Sigue siendo "de cajas": las estatuas de la cámara del calamar, los perks y el PaP, las armas en primera persona.

### F5.18 — Pedidos del 2026-09-26 — HECHO (falta playtest)
- Zombies, mobs, bosses y plantas de vuelta a cubos (la cabeza del calamar curva queda).
- Cráneo de tortuga sobre la boca del caparazón. Agacharse (C). Quick Revive con 10 s tirado, gris, Ray Gun, zombies
  que se alejan.
- Choque al oeste del templo: autos volcados en llamas con humo, cadáveres, calamar y Sombrerón muertos.
- XP entre partidas, 55 niveles con rangos, 6 accesorios y 4 camos que se desbloquean y se ven en el arma.
- Menú nuevo: mundo en gris con siluetas, menú a la izquierda, mapas (City y ??? bloqueados), armas, perfil, ajustes.
- Diego subirá una carpeta `sonidos/` para implementar.

### F5.18b — HECHO (falta playtest)
- Accesorios por arma (arco propio) con vista previa 3D, cuentas locales, modo dev (X), chicles con moneda, tienda,
  preset y chicleras cúbicas, conchas cúbicas que ofrecen el arma.

### PLAN VIGENTE (2026-09-26) — leer esto primero al retomar
Todo lo de arriba está hecho, commiteado y pusheado en `claude/compassionate-knuth-tcnxws`. Orden de lo que sigue:
1. **Playtest de Diego** de F5.16–F5.18b y arreglos. Qué mirar:
   - FPS en Alto (sombras + follaje) y en el menú (renderer extra de la vista previa de armas).
   - Chicles: SHOPPING SPREE con 0 puntos en puerta, perk, caja, pared y PaP (todo pasa por `spendPoints`, confirmar);
     chicle en la bandeja cuando te tira el Quick Revive (no debe gastarse); T con TRIPLE THREAT.
   - Last stand: volver con las armas correctas (PaP en curso, recargando, escudo en mano).
   - Accesorios en cada arma (que no floten) y la vista previa.
   - Choque del templo: zombies trabados entre los autos (overlay `L`).
   - Conchas: el arma flotante se agarra con F y se va a los 10 s.
2. **Sonidos de Diego:** subirá `sonidos/` (archivos). Plan: embeberlos en base64 dentro de `index.html` (sigue siendo
   un solo archivo; hay que documentar que se levanta la regla "sin assets externos"), cargarlos con
   `decodeAudioData` en `audio.js` y reemplazar/sumar a los procedurales según la lista que mande. Cuidar el peso.
3. **Tanda E** (abajo).
4. Entorno que sigue de cajas: estatuas de la cámara del calamar, máquinas de perks, PaP (los personajes quedan en cubos
   por pedido de Diego).
5. **F8** cierre V2: `CONFIG.DEBUG_MODE = false`, P9 balance (chicles incluidos: chance de moneda 14%, costos 500/1000/2000),
   tag.

### Tanda E — Calamar y embarcadero
- Embarcadero amplio y oscuro, sobre la arena al costado de la cabeza del calamar.
- Cadáveres de animales de mar, algunos medio alienígenas.
- Double Tap, LMG y el portal de llegada.

Cada tanda: tests nuevos más los viejos adaptados, `CLAUDE.md` al día, commit y tag `v2-f5.16x`.

---

## F6 — AUDIO — HECHO (sin commit)

Sigue siendo procedural (Web Audio), sin archivos. Además de lo pedido: pasos en pasto y piedra, bichos y pájaros
en la jungla, y la música baja con un zombie cerca.
- **Música:** loop ambiente de marimba grave y lento, se intensifica con la ronda. Tema propio para el boss.
- **Anuncios de ronda:** golpe de tambor + campanada, más largo cada 5 rondas.
- **Audio 3D posicional:** gruñidos y pasos de zombie suenan desde donde están. Se tiene que poder oír un zombie a la espalda.
- **Superficies:** pasos distintos en madera, arena, concreto, azulejo, agua.
- **Ambiente por zona:** olas fuertes en playa, goteo en sótano, viento en muelle.
- Mezcla: música nunca tapa a los zombies. Volúmenes separados en opciones.

Si el audio procedural se queda corto en armas, evaluar samples CC0 embebidos en base64 — avisar el peso antes.

---

## F7 — GRÁFICOS `[OPUS]` — HECHO (sin commit; falta medir FPS en el navegador, sobre todo Alto)
Decisiones: sombras solo en Alto (Medio por defecto); post-proceso por CSS (viñeta, grano, color), sin shaders ni
scripts extra; "Cabeza = kill" = un headshot que mata la vuela (70%); poses de muerte cortas (la spec pide 0.3 s),
salvo la de rodillas (0.9 s).

Techo honesto: navegador. Objetivo: estilo fuerte, no realismo.

- **Desmembramiento:** brazos, piernas y cabeza se desprenden con física. Cabeza = kill.
- **Animación de zombies:** caminar, correr, arrastrarse, atacar, morir. Varias poses de muerte.
- **Ciclo de luz por ronda:** atardecer (1-5) → anochecer (6-10) → noche con luna (11+). Tormenta tropical con lluvia y relámpagos en rondas de perros.
- **Sombras** solo de la luz principal, resolución limitada. Luces de interiores sin sombra.
- **Post-proceso ligero:** viñeta, color grading cálido/frío según hora, grano sutil. Toggle en opciones.
- **Agua** animada en playa, piscina y charcos.
- **Opciones de calidad** Bajo / Medio / Alto que apaguen sombras, post-proceso y partículas.
- **Backlog del playtest (F2.6):**
  - Playa: más props (palmeras, etc.). Hoy se siente vacía.
  - El diseño general se siente plano y básico: subir el detalle de texturas y props, y la variedad visual
    en todo el mapa.
  - Animación real de los pasos (hoy solo cambian la inclinación y el ritmo del bob, F2.6) y de trepar las
    escaleras de la piscina.

Si algo baja de 60 FPS en Medio, se recorta.

---

## F8 — CIERRE V2

- Menú de opciones completo: sensibilidad, FOV, volúmenes, calidad, invertir Y.
- Pantalla de estadísticas ampliada: kills por arma, perks comprados, boss derrotados.
- Récords: ronda máxima, más kills, boss más rápido.
- Pase de balance completo jugando hasta ronda 20.
- `CLAUDE.md` actualizado con todo lo nuevo.

---

## FUERA DE V2 (no tocar)
Easter egg principal · Multijugador · Mapas adicionales · Guardado de partida · Móvil/touch

---

## ESTIMADO

| Fase | Tamaño | Modelo |
|---|---|---|
| F0 | 1-2 sesiones | Opus |
| F1 | 1-2 | Sonnet |
| F2 | 1-2 | Sonnet |
| F3 | 2 | Sonnet |
| F4 | 1 | Sonnet |
| F5 | 2 | Opus |
| F5.5 | 1 | Sonnet |
| F5.6 | 2-3 | Opus |
| F6 | 1 | Sonnet |
| F7 | 2-3 | Opus |
| F8 | 1 | Sonnet |
