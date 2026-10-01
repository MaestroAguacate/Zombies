# Easter egg de la playa: "THE KRAKEN" (diseño, F5.29)

> **Cambios aprobados por Diego (2026-09-30):** el boss se llama **THE KRAKEN** (LEVIATHAN ya es una ametralladora; la
> moneda KRAKEN INK es su tinta). **Morir en la arena = game over.** Al ganar, la cámara muestra un poco el remolino y
> te devuelve a la playa: el **remolino queda en el mar** (se ve desde la playa), hay **restos del Kraken** en la playa
> y por el mapa, y el cielo queda **morado y azul brillante**. Tecla **L** (modo debug): directo a la pelea con Perkaholic
> y la Ray Gun mejorada. Donde abajo dice "Leviatán", leer "Kraken".

> Documento de diseño (con spoilers). En el juego no hay ninguna pista: ni carteles, ni banners que digan qué hacer.
> Solo suenan dos sonidos nuevos: el de **paso cumplido** y el de **paso fallido**.

## La historia (lo que cuenta la cinemática final)
La isla no es una isla: es el lomo de algo. Lo que hay debajo del mar, el **Leviatán** (el calamar gigante que en las
rondas de calamares escupe calamarcitos a la playa), es el guardián de un pozo que baja al centro de la Tierra. El
laboratorio del caparazón y el búnker eran una expedición que quería abrirlo: el teletransportador une los dos, la
cápsula de contención era para un cebo vivo, y la cabeza del calamar de la bahía es un Leviatán viejo que murió en la
orilla. Matarlo abre el remolino, y la cámara baja por el pozo hasta una caverna morada y roja: **YALUW**.

## Los pasos (en orden; cada uno necesita el anterior)
| # | Paso | Cómo se cumple | Si se falla |
|---|---|---|---|
| 1 | **Matar a la planta jefa** (templo) | Como siempre. Suelta una **semilla negra** que hay que agarrar (F) antes de que se hunda (30 s). | La semilla se hunde: sonido de fallo; vuelve a brotar en el mismo lugar a la ronda siguiente. |
| 2 | **Matar a la Bestia** (búnker) | Como siempre. | — (la Bestia es una por partida; si no la matás, no hay easter egg). |
| 3 | **Activar el teletransportador del búnker** | Con la semilla en la mano, F en la plataforma: se pone verde y carga 20 s mientras salen zombies de las paredes. Hay que quedarse arriba de la plataforma (si salís más de 3 s, se corta). Al cargar, te lleva al laboratorio del caparazón. | Se corta: fallo; se puede reintentar enseguida. |
| 4 | **Las pruebas del caparazón** | Al llegar se prenden las 3 consolas del laboratorio (una por nivel). **Prueba 1, calibración:** encender las 3 (F) en menos de 25 s. **Prueba 2, contención:** la cápsula central se abre y los zombies van a romperla: defenderla 60 s (tiene vida; se ve en el vidrio que se raja). | Se acaba el tiempo o se rompe la cápsula: fallo; la prueba se reinicia (las cumplidas quedan). |
| 5 | **Atrapar un Sombrerón en la cápsula** | Al cumplir las pruebas, la cápsula queda abierta y el tocadiscos del laboratorio (F) suena una serenata: **aparece un Sombrerón** en el claro. Hay que bajarle la vida a menos de 35% (si lo matás, fallo), atraerlo hasta adentro de la cápsula y cerrarla con la consola de abajo (F) con él adentro. | Muere o se escapa (se cierra vacía): fallo; el tocadiscos se puede volver a usar a la ronda siguiente. |
| 6 | **El cebo** | La cápsula procesa al Sombrerón 10 s y suelta el **CEBO DEL ABISMO** (una ampolla de tinta que brilla). Agarrarlo es el último paso. | — |

**Al agarrar el cebo (último paso):** se cortan los zombies (los vivos se hunden en la tierra y la ronda queda en
pausa), si es de noche se hace de día, pero el cielo y la niebla se ponen morados y el mar se oscurece. Suena un acorde
largo. Así sabés que estás listo; no sale ningún enemigo hasta que entres a la pelea (para preparar armas, perks,
chicles).

## La entrada: la cabeza del calamar
En el piso de abajo de la cabeza (la cámara), al fondo (sur), la carne termina en una **pared de agua** que no se
puede cruzar (una membrana que tiembla). Con el cebo, F en la membrana: el agua te traga y aparecés en la arena.
(La cabeza se abre en la ronda 13, como siempre.)

## La pelea: el Leviatán
**La arena:** mar abierto en la tormenta, lejos de la isla. Un anillo de **5 plataformas de roca y restos de barco**
unidas por pasarelas angostas, alrededor de un hueco de agua donde emerge el Leviatán (enorme: ~25 m de manto). Caer al
agua = te arrastra un tentáculo y perdés vida (no morís; te devuelve a una plataforma). Hay **4 arpones** montados en las
plataformas.

**Fase 1, los tentáculos (vida en barra arriba):** golpea plataformas con tentáculos (aviso: sombra y agua que burbujea
1.2 s antes). Cada tentáculo que queda apoyado muestra **una ventosa que brilla**: hay que dispararle (se corta el
tentáculo). Cortar 4. Mientras, escupe **calamarcitos** a las plataformas (los mismos que se fusionan) y tinta.
**Fase 2, el ojo:** sin tentáculos, abre el ojo y escupe olas de tinta. Hay que usar los **arpones** (F, apuntás con
la cámara, recarga 6 s): 3 arponazos al ojo. Las balas en el ojo le hacen poco; los arpones mucho.
**Fase 3, la boca:** se lanza contra la plataforma más cercana con el pico abierto. Ahí está la forma creativa de
matarlo: **tirarle el cebo a la boca** (la tecla de granada con el cebo; si errás, el cebo vuelve en 10 s), y
**después dispararle a la panza** que se ilumina por dentro (el cebo explota adentro). O, si no podés, **escapar**: la
última plataforma tiene un bote; si lo arrancás (F, 5 s) te vas antes de que se termine el tiempo, y cuenta como
intento fallido pero sin castigo.

**Tiempo:** 5 minutos. Si se acaba, o si "morís" en la arena (vida a 0): el Leviatán te escupe a la playa con poca
vida (no es game over), **intento fallido**.

**Castigo del intento fallido:** la ronda vuelve y sale una ola de bosses: la **Bestia** (si estaba muerta, una
"cría madura"), **2 Sombrerones** y **perros**. El cebo se pierde, pero **vuelve a aparecer en la cápsula a las 2 rondas**
(otro intento, sin límite).

## Si lo matás: la cinemática y el premio
1. El Leviatán chilla, se hunde en un remolino; la cámara sale de tu cabeza y baja en espiral por el remolino.
2. Agua negra, luego roca, luego **una caverna enorme con plantas moradas que brillan y ríos de lava** al fondo (la
   pista de la cancha nueva), un susurro y el texto, apenas: **"YALUW"**.
3. Volvés a la playa: el cielo vuelve a la normalidad y las rondas siguen.
**Premio:** todos los perks, la Ola Rompiente con PaP, 10 000 puntos, 5 KRAKEN INK, mucha XP y un camo y una placa
("LEVIATHAN SLAYER") para el perfil.

## Cómo se hace (técnico)
- **`src/leviathan.js`** (nuevo, 7q): el estado del easter egg (`EE.step`, `EE.done[]`), los pasos, la arena y el boss.
  `CONFIG.EE` con todos los números. `resetEE()` en `resetGame`.
- **Sonidos** (`audio.js`, procedurales): `sfxEEOk` (acorde que sube, campanas y un golpe grave) y `sfxEEFail`
  (dos notas que caen, desafinadas, con un zumbido).
- **Enganches:** la muerte de la planta jefa y de la Bestia (`bossDeath`/sus funciones de muerte), `interact` (semilla,
  plataforma, consolas, tocadiscos, cápsula, membrana, arpones, bote), `updateRounds` (pausa de la ronda), `setSky` /
  `applyNight` (el día morado), `spawnBoss` (el Sombrerón del tocadiscos y el castigo).
- **La arena:** zona aparte muy lejos de la isla (x 0, z −240), un cuarto propio (R25) con piso de plataformas, sin
  conexión a pie; se entra y se sale solo por teletransporte. El Leviatán es un modelo nuevo en cubos (manto, ojo,
  pico y 8 tentáculos articulados) con sus propias cajas de tiro.
- **Test `f529.js`:** cada paso (cumplir y fallar), el día morado y la pausa, la entrada por la membrana, la pelea entera
  (cortar tentáculos, arpones al ojo, el cebo en la boca y la muerte), el intento fallido (castigo y el cebo que vuelve),
  el bote, y que la cinemática termina y devuelve el juego.

## Decisiones para confirmar con Diego
1. ¿Te gusta la historia (el Leviatán guardián del pozo a YALUW) y los 6 pasos en ese orden?
2. Las pruebas del caparazón: calibración (3 consolas en 25 s) y defender la cápsula 60 s. ¿Van?
3. La muerte creativa: tirarle el cebo a la boca y dispararle a la panza. ¿Y el bote para escapar?
4. Morir en la arena = te escupe a la playa (no es game over). ¿O preferís que sea muerte de verdad?
