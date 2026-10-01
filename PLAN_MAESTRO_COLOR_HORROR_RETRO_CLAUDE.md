# PLAN MAESTRO DE DIRECCIÓN DE COLOR Y ATMÓSFERA --- HORROR RETRO

## Objetivo

Este documento define una dirección visual consistente para un juego de
zombies/horror low-poly con estética inspirada en survival horror y
videojuegos de terror de finales de los 2000 / principios de los 2010.

La meta NO es simplemente oscurecer el juego.

La meta es que el jugador sienta que está viendo el mundo a través de
una cámara digital/consumer camcorder vieja, con una imagen ligeramente
imperfecta, desaturada, sucia y atmosférica.

Referencia conceptual: - Horror de la era 2008--2013. - Sensación de
cámara digital barata. - Referencia emocional: el terror de juegos como
Slender: The Eight Pages. - Low-poly/retro, pero con postprocesado
intencional. - La imagen debe parecer un mundo peligroso y extraño, no
un screenshot moderno perfectamente limpio.

------------------------------------------------------------------------

# 1. PROBLEMA VISUAL ACTUAL

La imagen actual tiene: - Saturación demasiado alta. - Verdes demasiado
limpios y vivos. - Cyan/magenta muy puros. - Cielo y luces con colores
demasiado separados. - Demasiada nitidez digital. - Poco grano. -
Sombras demasiado "limpias". - Poco haze/niebla atmosférica. - Poca
sensación de lente/cámara. - Cada objeto parece renderizado
independientemente. - El resultado se siente más como un videojuego
moderno con modelos low-poly que como una grabación de horror retro.

NO corregir esto simplemente bajando el brillo.

La dirección correcta es:

DESATURACIÓN + PALETA SUCIA + SOMBRAS COLOREADAS + SOFTNESS ÓPTICA +
GRANO + VIGNETTE + ATMÓSFERA + CONTRASTE CONTROLADO.

------------------------------------------------------------------------

# 2. REGLA PRINCIPAL

## El mundo debe ser desaturado; los elementos importantes pueden conservar color.

No queremos convertir todo en gris.

Usar aproximadamente: - Saturación global: 60--75% del nivel actual. -
Colores ambientales: 50--70%. - Elementos sobrenaturales/importantes:
90--120%. - Luces: cálidas pero desaturadas. - Sombras: frías y
ligeramente coloreadas.

Esto crea jerarquía visual.

Ejemplo: - Vegetación = verde oliva apagado. - Paredes = gris/marrón. -
Cielo = naranja/morado sucio. - Zombies = gris verdoso. - Boss
sobrenatural = color intenso. - Slime/energía = verde ácido. - Armas
especiales = cyan/magenta controlado.

NO hacer que todos los elementos tengan la misma intensidad.

------------------------------------------------------------------------

# 3. LOOK GLOBAL DEL JUEGO

Aplicar una base global común a todos los mapas.

## Color

Saturación: - 65--70%

Contraste: - +8 a +15%

Exposición: - -0.10 a -0.30 EV como punto de partida.

Gamma: - 0.95--1.05 dependiendo de la escena.

Highlights: - Reducir ligeramente.

Shadows: - Más frías.

Black level: - No aplastar completamente. - Mantener aproximadamente
5--10% de detalle en sombras.

## Tonalidad global

Sombras: - Azul petróleo - Verde azulado - Gris frío

Midtones: - Verde oliva - Gris - Marrón sucio

Highlights: - Naranja apagado - Rosa/morado muy leve cuando corresponda

## Efectos globales

Film grain: - 8--12%

Vignette: - 25--35%

Chromatic aberration: - 1--2 px máximo.

Lens softness: - 0.4--0.8%

Bloom: - 5--15%

Atmospheric haze: - 5--20%, dependiendo del mapa.

Motion blur: - Muy bajo.

Sharpening: - Reducir o desactivar.

NO usar: - HDR excesivo. - Sharpening fuerte. - Bloom exagerado. -
Chromatic aberration extrema. - VHS distortion pesada. - Scanlines
visibles constantemente. - Negro completamente aplastado.

------------------------------------------------------------------------

# 4. PRINCIPIO DE CÁMARA

El juego debe sentirse como una cámara barata, no como una cámara
cinematográfica profesional.

Características:

1.  Imagen ligeramente suave.
2.  Pequeño ruido del sensor.
3.  Film/digital grain.
4.  Vignette.
5.  Pequeña aberración cromática.
6.  Contraste imperfecto.
7.  Highlights ligeramente blooming.
8.  Haze atmosférico.
9.  Leve inconsistencia de exposición si el motor lo permite.
10. En escenas muy oscuras, permitir que el ruido aumente ligeramente.

NO añadir timestamp, REC, batería, VHS tracking ni glitches permanentes
salvo que sean parte de una mecánica específica.

El efecto debe sentirse, no anunciarse.

------------------------------------------------------------------------

# 5. PALETA MAESTRA

## Neutrales

Black: - #090B0A

Near black: - #151817

Cold gray: - #424744

Warm gray: - #68615A

Dirty beige: - #8A7967

## Sombras frías

Deep teal: - #172927

Blue green: - #203735

Olive shadow: - #353B24

## Vegetación

Healthy green NO: - Evitar #00FF00 / verdes puros.

Preferred: - #3E4A27 - #4E542D - #5D6032 - #68703A

Jungle: - #283B22 - #304A27 - #3F542A

## Cálidos

Dusk orange: - #A86B4A

Dirty orange: - #8B5B42

Muted yellow: - #B19A55

## Supernatural

Toxic green: - #72D329

Toxic green highlight: - #A5F34A

Cold cyan: - #31CFE3

Electric cyan: - #55E8F5

Purple: - #7546A8

Magenta accent: - #B64BC7

Estos colores sobrenaturales pueden ser más saturados que el ambiente.

------------------------------------------------------------------------

# 6. MAPA 01 --- EXTERIORES / PUEBLO / JARDINES

## Objetivo

Que parezca una tarde que está muriendo y que algo no está bien.

No debe parecer un mapa colorido de día.

## Paleta

Cielo: - naranja/morado apagado. - Evitar naranja puro.

Vegetación: - verde oliva. - Saturación 55--70%.

Edificios: - gris cálido / marrón sucio.

Sombras: - verde azulado.

Luces: - amarillo/naranja apagado.

## Ajustes

Saturation: - 65%

Contrast: - +10%

Exposure: - -0.15 EV

Grain: - 10%

Vignette: - 30%

Haze: - 10--15%

Bloom: - 8%

Chromatic aberration: - 1 px

Lens softness: - 0.5%

## Sensación

"Algo pasó aquí hace poco y el lugar debería estar normal, pero no lo
está."

El cielo puede ser bonito, pero el suelo y las sombras deben sentirse
inquietantes.

------------------------------------------------------------------------

# 7. MAPA 02 --- PLAYA

## Objetivo

NO convertir la playa en una postal tropical.

Debe sentirse como una playa vacía y abandonada.

## Paleta

Arena: - beige grisáceo. - Saturación baja.

Mar: - azul verdoso apagado.

Cielo: - gris púrpura / naranja muy tenue si es atardecer.

Vegetación: - verde oliva.

Sombras: - azul petróleo.

## Ajustes

Saturation: - 55--65%

Contrast: - +8%

Exposure: - -0.10 EV

Haze: - 15--25%

Grain: - 8--10%

Vignette: - 25%

Bloom: - 5--8%

## Efecto especial

La playa debe tener más atmospheric haze que el pueblo.

El horizonte debe perder contraste.

El jugador debe sentir: "Hay demasiado espacio abierto y no tengo dónde
esconderme."

Si hay niebla, no cubrir todo. Usarla para ocultar profundidad.

## Paleta sugerida

Sand: - #8A806C

Ocean: - #365B59

Sky: - #7A5F68

Shadow: - #263A39

Accent: - #A9B86A

------------------------------------------------------------------------

# 8. MAPA 03 --- INTERIORES GENERALES

## Objetivo

Sensación de lugar abandonado, viejo y sin mantenimiento.

Los interiores NO deben ser simplemente negros.

## Regla

Usar pools de luz pequeños.

En lugar de iluminar toda la habitación: - lámpara = pequeño área
cálida. - resto = frío y oscuro.

## Paleta

Light: - #B68A5A

Walls: - #53504A

Shadows: - #202A29

Metal: - #4A4B46

Wood: - #5A4637

## Ajustes

Saturation: - 50--60%

Contrast: - +15%

Exposure: - -0.20 a -0.50 EV

Grain: - 10--14%

Vignette: - 35--40%

Bloom: - 10--15%

Haze: - 5--10%

Lens softness: - 0.7%

## Iluminación

Preferir: - luces aisladas. - falloff rápido. - zonas de oscuridad entre
luces.

Evitar: - iluminación uniforme de toda la habitación.

------------------------------------------------------------------------

# 9. MAPA 04 --- BUNKER / BOSS OSCURO

## Este debe ser uno de los mapas más extremos.

El miedo viene de NO SABER qué hay en la oscuridad.

NO hacer: - toda la pantalla negra.

Sí hacer: - zonas completamente oscuras. - pequeñas áreas con
información visual. - siluetas. - ojos/luces del boss. - reflejos o
partículas ocasionales.

## Paleta

Black: - #050807

Cold shadow: - #101B1B

Metal: - #2E3432

Emergency light: - #8C3D32

Boss accent: - color sobrenatural elegido por diseño.

## Ajustes

Saturation: - 40--50%

Contrast: - +20%

Exposure: - -0.6 a -1.0 EV

Grain: - 14--18%

Vignette: - 40--50%

Bloom: - 10--18%

Chromatic aberration: - 1--2 px

Lens softness: - 0.8%

Haze: - 5--10%

## REGLA DEL BOSS

El boss NO debe estar iluminado completamente.

Usar: - rim light. - ojos. - silueta. - pequeños reflejos. - partículas.

El cerebro del jugador completa lo que no puede ver.

Esto es más importante que poner una textura aterradora.

## Contraste narrativo

Ambiente: - casi monocromático.

Boss: - pequeños colores muy intensos.

Ejemplo: - ambiente negro/verde. - ojos magenta. - partículas cyan.

El color del boss debe ser un evento.

------------------------------------------------------------------------

# 10. MAPA 05 --- TEMPLO / BOSS AL AIRE LIBRE

## Objetivo

El templo debe sentirse antiguo, enorme y sobrenatural.

Debe diferenciarse del bunker.

Bunker: - claustrofobia. - negro. - silencio. - incertidumbre.

Templo: - espacio abierto. - amenaza visible. - escala. - clima. -
energía sobrenatural.

## Paleta

Stone: - #4A4740

Ancient stone: - #655B4A

Vegetation: - #384127

Sky: - #574B63

Moon: - #B3A88D

Fire: - #A95732

Boss: - color sobrenatural.

## Ajustes

Saturation: - 50--60%

Contrast: - +15%

Exposure: - -0.35 EV

Grain: - 10--13%

Vignette: - 30--40%

Haze: - 15--20%

Bloom: - 10--15%

## Clima

Rain puede ser muy efectivo.

Rain: - blanco/gris, NO azul brillante.

Fog: - gris púrpura.

Relámpagos: - flashes muy breves, no constantes.

## Boss

El boss puede tener: - rim light. - glow sobrenatural. - partículas. -
energía alrededor.

Pero el ambiente debe permanecer desaturado.

------------------------------------------------------------------------

# 11. MAPA 06 --- JUNGLA

## Objetivo

La jungla debe sentirse viva pero peligrosa.

No queremos: "tropical colorful videogame."

Queremos: "vegetación húmeda, densa y algo enferma."

## Paleta

Deep jungle: - #1D2D20

Jungle green: - #2F4527

Olive: - #4A522C

Wet leaves: - #4E5D3C

Mud: - #4A4031

Shadow: - #101A17

## Ajustes

Saturation: - 55--65%

Contrast: - +12%

Exposure: - -0.20 a -0.40 EV

Grain: - 10--13%

Vignette: - 30--40%

Haze: - 15--25%

Bloom: - 5--10%

## Profundidad

La jungla debe perder contraste progresivamente con la distancia.

Foreground: - más definido.

Midground: - ligeramente desaturado.

Background: - más verde grisáceo y con haze.

Esto crea sensación de profundidad y hace que cualquier silueta lejana
sea inquietante.

------------------------------------------------------------------------

# 12. MAPA 07 --- INTERIOR DE ALIEN

## Este mapa puede romper las reglas, pero de manera controlada.

No debe parecer simplemente "purple sci-fi".

Debe sentirse orgánico, desconocido y desagradable.

## Paleta

Organic dark: - #161C1A

Alien green: - #405A38

Toxic: - #74D33C

Wet cyan: - #2A8990

Deep purple: - #382843

Bioluminescence: - #72E8D3

## Ajustes

Saturation: - 55--70%

Contrast: - +12%

Exposure: - -0.30 EV

Grain: - 8--12%

Vignette: - 30--40%

Bloom: - 12--20%

Haze: - 10--15%

Lens softness: - 0.5--0.8%

## Iluminación

La iluminación debe parecer que viene de la criatura/el ambiente.

No usar luces blancas limpias.

Usar: - verde. - cyan. - purple.

Las superficies húmedas pueden reflejar esas luces.

## Regla

Los colores alienígenas pueden ser más saturados que los colores
humanos.

Esto hace que el jugador sienta que entró a otro ecosistema.

------------------------------------------------------------------------

# 13. ZOMBIES

Los zombies no deben competir con el ambiente.

## Base

Skin: - gris verdoso.

Clothes: - desaturadas.

Blood: - oscuro, no rojo brillante.

Eyes: - amarillo o color sobrenatural.

## Saturación

Cuerpo: - 40--60%

Ojos: - 90--110%

Esto hace que los ojos destaquen.

## Iluminación

Nunca iluminar completamente al zombie en una escena de horror si no es
necesario.

Mejor: - side light. - rim light. - partial shadow.

------------------------------------------------------------------------

# 14. ARMAS

El arma de energía actualmente tiene cyan/magenta muy fuertes.

NO eliminar completamente ese color.

En cambio:

Environment: - 60--70% saturation.

Weapon: - 90--110% saturation.

Esto convierte el arma en un elemento visual deliberado.

Sin embargo, reducir un poco la luminosidad para evitar que parezca un
juguete brillante.

## Objetivo

Debe parecer: "arma sobrenatural"

y no: "RGB gaming weapon."

------------------------------------------------------------------------

# 15. CIELO

Evitar cielos extremadamente limpios.

Usar gradientes.

Ejemplo dusk:

Zenith: - #4A4053

Middle: - #795C62

Horizon: - #9B694D

Ground: - #4A4434

Agregar haze en el horizonte.

No usar un color plano.

------------------------------------------------------------------------

# 16. NIEBLA

La niebla es una herramienta narrativa, no solamente un efecto gráfico.

Usarla para:

1.  Ocultar enemigos.
2.  Ocultar distancia.
3.  Hacer que el mapa parezca más grande.
4.  Crear siluetas.
5.  Controlar qué ve el jugador.

No usar fog uniforme.

Debe aumentar con la distancia.

## Colores

Día: - gris cálido.

Dusk: - gris púrpura.

Noche: - azul petróleo.

Jungla: - verde grisáceo.

Alien: - cyan/verde muy tenue.

------------------------------------------------------------------------

# 17. VIGNETTE POR MAPA

Exterior: - 25--30%

Playa: - 20--25%

Interior: - 35--40%

Bunker: - 40--50%

Templo: - 30--40%

Jungla: - 30--40%

Alien: - 30--40%

Boss fight: - +5--10% adicional durante momentos importantes si el motor
lo permite.

------------------------------------------------------------------------

# 18. FILM GRAIN

No usar grain gigante.

Debe ser fino.

Exterior: - 8--10%

Interior: - 10--14%

Bunker: - 14--18%

Boss: - 12--16%

Jungla: - 10--13%

Alien: - 8--12%

El grain puede aumentar ligeramente en escenas oscuras.

------------------------------------------------------------------------

# 19. ABERRACIÓN CROMÁTICA

Muy sutil.

Exterior: - 1 px

Interior: - 1 px

Bunker: - 1--2 px

Boss: - 1--2 px

Nunca superar 2 px salvo una habilidad/efecto específico.

------------------------------------------------------------------------

# 20. BLOOM

No hacer que todo brille.

Bloom únicamente debe aparecer alrededor de: - luces. - fuego. -
energía. - ojos. - elementos sobrenaturales.

Valores: - Normal: 5--10% - Boss: 10--18% - Alien: 12--20%

------------------------------------------------------------------------

# 21. SHADOW DESIGN

Una regla fundamental:

## Las sombras deben tener color.

NO: RGB 0,0,0.

Preferir: - azul petróleo. - verde azulado. - oliva oscuro. -
purple-blue.

Esto mantiene detalle y hace que el mundo se vea más cinematográfico.

------------------------------------------------------------------------

# 22. HIGHLIGHT DESIGN

Los highlights tampoco deben ser blancos puros.

Preferir:

Lámpara: - warm yellow.

Sol: - dirty warm white.

Moon: - cool gray.

Alien: - cyan/green.

Boss: - supernatural color.

Esto unifica la imagen.

------------------------------------------------------------------------

# 23. PRESETS GLOBALES

## PRESET A --- SLENDER / DEFAULT HORROR

Saturation: 65% Contrast: +10% Exposure: -0.15 Grain: 10% Vignette: 30%
CA: 1 px Lens softness: 0.5% Bloom: 8% Haze: 10%

Uso: - Pueblo. - Exterior. - Gameplay normal.

## PRESET B --- NIGHTMARE

Saturation: 50% Contrast: +18% Exposure: -0.45 Grain: 14% Vignette: 40%
CA: 1--2 px Lens softness: 0.7% Bloom: 12% Haze: 10%

Uso: - Bunker. - Boss. - Áreas de peligro.

## PRESET C --- CAMCORDER

Saturation: 60% Contrast: +8% Exposure: -0.10 Grain: 12% Vignette: 30%
CA: 1 px Lens softness: 0.7% Bloom: 7% Haze: 12%

Uso: - Mapas exteriores. - Pueblo. - Playa.

## PRESET D --- SUPERNATURAL

Saturation: 65% Contrast: +12% Exposure: -0.25 Grain: 9% Vignette: 35%
CA: 1 px Lens softness: 0.5% Bloom: 15% Haze: 15%

Uso: - Templo. - Alien. - Bosses sobrenaturales.

------------------------------------------------------------------------

# 24. TRANSICIÓN ENTRE MAPAS

No hacer que todos los mapas parezcan iguales.

La identidad global debe permanecer, pero cada mapa debe tener su propia
temperatura.

Mapa humano: - warm/cold balance.

Playa: - más haze.

Bunker: - cold + black.

Templo: - purple dusk + warm fire.

Jungla: - olive/green.

Alien: - cyan/green/purple.

Esto permite que el jugador sepa dónde está visualmente.

------------------------------------------------------------------------

# 25. REGLA DE SATURACIÓN

Prioridad visual:

1.  Boss / amenaza principal.
2.  Elementos sobrenaturales.
3.  Arma/objetivo.
4.  Luces.
5.  Zombies.
6.  Mundo.
7.  Background.

Nunca al revés.

Si todo tiene 100% de saturación, nada destaca.

------------------------------------------------------------------------

# 26. REGLA DE NITIDEZ

El juego NO debe verse borroso.

Debe verse:

"slightly imperfectly sharp."

Reducir: - sharpening. - microcontrast. - edge clarity.

Mantener: - modelos legibles. - enemigos legibles. - arma legible. - HUD
legible.

El HUD puede permanecer nítido mientras el mundo tiene softness.

Esto es especialmente importante.

------------------------------------------------------------------------

# 27. HUD

NO aplicar blur fuerte al HUD.

El HUD debe permanecer: - nítido. - legible. - estable.

Si es posible, aplicar postprocess al mundo antes del HUD.

Esto hace que la interfaz se sienta como una capa digital encima de una
imagen de cámara.

------------------------------------------------------------------------

# 28. EFECTO DE CÁMARA DURANTE TERROR

Cuando aparece un boss o evento:

NO usar solamente screen shake.

Mejor:

1.  Slight exposure change.
2.  Slight vignette increase.
3.  Slight grain increase.
4.  Subtle chromatic aberration increase.
5.  Very subtle camera breathing.
6.  Small focus/softness change.
7.  Environmental fog increase.

La cámara debería sentirse físicamente afectada.

------------------------------------------------------------------------

# 29. PROMPT MAESTRO PARA CLAUDE

Use este prompt como instrucciones generales al implementar el sistema
visual:

------------------------------------------------------------------------

"Implement a unified horror visual post-processing system for the game.

The visual target is an early-2010s low-budget survival horror game
recorded through a cheap consumer digital camera.

The game currently looks too clean, sharp, saturated and digitally
perfect.

Do NOT solve the problem by simply making everything darker.

Instead implement:

-   global saturation reduction to approximately 65--70%;
-   cold blue-green shadows;
-   dirty olive and gray midtones;
-   muted warm highlights;
-   subtle film/digital grain;
-   soft vignette;
-   subtle chromatic aberration;
-   subtle optical softness;
-   restrained bloom;
-   distance-based atmospheric haze;
-   controlled contrast;
-   preserved shadow detail;
-   selective saturation for supernatural elements.

The world should look imperfect, old, dirty and unsettling.

Do not use excessive VHS distortion. Do not use heavy scanlines. Do not
use extreme chromatic aberration. Do not crush blacks. Do not
oversaturate the world. Do not add cinematic Hollywood teal-and-orange
grading. Do not make the entire image blue. Do not blur the HUD.

Create separate color profiles for:

1.  Exterior/Pueblo
2.  Beach
3.  General interiors
4.  Dark bunker boss
5.  Outdoor temple boss
6.  Jungle
7.  Alien interior

Each environment must share the same visual language but have its own
palette and atmospheric identity.

The player should feel that the camera is slightly old and imperfect.

The fear should come from: - limited visibility, - silhouettes, -
atmospheric depth, - color contrast, - darkness, - selective
highlights, - environmental emptiness, - visual uncertainty.

Do not add random visual effects simply because they look cool.

Every effect must support horror, atmosphere or visual hierarchy.

Keep gameplay readability intact."

------------------------------------------------------------------------

# 30. ORDEN DE IMPLEMENTACIÓN

Implementar en este orden:

## FASE 1

Color grading global.

## FASE 2

Saturation control.

## FASE 3

Shadow/highlight color separation.

## FASE 4

Vignette.

## FASE 5

Film grain.

## FASE 6

Atmospheric fog/haze.

## FASE 7

Lens softness.

## FASE 8

Bloom.

## FASE 9

Chromatic aberration.

## FASE 10

Map-specific profiles.

## FASE 11

Boss-specific profiles.

## FASE 12

Dynamic horror events.

No implementar todos los efectos al mismo tiempo.

Después de cada fase, comparar screenshot antes/después.

------------------------------------------------------------------------

# 31. CRITERIO DE ÉXITO

El cambio es correcto si:

-   El juego sigue siendo claramente low-poly.
-   Los colores ya no parecen básicos/limpios.
-   El mundo parece una grabación y no un render moderno.
-   Los enemigos destacan sin estar sobreiluminados.
-   Las sombras contienen información.
-   El jugador siente incertidumbre.
-   Las áreas oscuras parecen profundas.
-   Los colores sobrenaturales destacan.
-   Cada mapa tiene identidad.
-   El HUD sigue siendo legible.
-   El resultado no parece simplemente un filtro de Instagram/VHS.

La pregunta final no es:

"¿Se ve más oscuro?"

La pregunta correcta es:

"¿Se siente como un lugar real, viejo, peligroso y ligeramente mal
grabado?"

Ese es el objetivo visual.
