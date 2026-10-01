# Guía de prueba (playtest definitivo de V2)

Todo lo hecho desde F5.16. Marcá cada casilla: **✔** anda bien · **✘** falla (anotá qué pasó) · **~** anda pero no me gusta.
Al lado de cada falla anotá **dónde** (abrí el mapa con **5** y fijate el cuarto) y **qué estabas haciendo**. Una captura
ayuda mucho.

## Antes de empezar
- Abrí `index.html` con doble clic (Chrome). Ajustes: calidad **Medio** primero y después **Alto**.
- **Teclas de prueba** (modo debug, solo mientras `DEBUG_MODE` esté prendido):

  | Tecla | Qué hace |
  |---|---|
  | **O** | Abre todo: puertas, generadores, energía, cajas de almas y búnker, más 15000 puntos |
  | **P** | +5000 puntos |
  | **]** / **[** | Ronda siguiente / anterior |
  | **J** | La próxima ronda trae al boss |
  | **K** | La próxima ronda es de perros |
  | **N** | Vuelo, sin colisiones |
  | **X** | Cuenta dev: nivel máximo, todos los chicles y vida ×4 (con barra de vida) |
  | **H** | Oculta el overlay |
  | **B** | Pinta el grid de los zombies |

- Si algo se ve trabado, mirá el overlay: `ZOMB 5 f3 d2 r0 L0`. Si **L** queda mayor que 0 un buen rato, hay zombies
  perdidos.

---

## 1. Rendimiento (lo primero: si anda lento, lo demás no sirve)
- [ ] FPS en **Medio** en la casa, la playa, el templo y el caparazón (overlay: FPS).
- [ ] FPS en **Alto** (sombras) en esos mismos lugares.
- [ ] Ronda 15+ con 20 zombies en pantalla: ¿baja mucho?
- [ ] Menú principal: ¿anda fluido? (la vista previa de armas usa otro render)
- [ ] Abrir el **mapa (5)** en medio de una ronda: ¿se traba al abrirlo la primera vez?

## 2. Arranque y casa
- [ ] Arrancás en el **garaje**, con Quick Revive y la chiclera ahí.
- [ ] La casa está **oscura** sin energía. El farol (F) prende la luz del cuarto 2 minutos.
- [ ] **Ventanas con tablas:** los zombies arrancan tablas y entran; con F mantenido reparás (10 puntos por tabla, las
      primeras 5 de cada ronda).
- [ ] Trampillas del piso (porche, garaje): igual que las ventanas.
- [ ] Borde de sangre y latido con poca vida (menos de la mitad); respiración agitada con menos de ~35%.

## 3. Armas
- [ ] **Todas suenan al disparar** (subfusil, rifle, LMG y las 3 nuevas, revólver, Uzi, AK-47, Desert Eagle, arco,
      bazooka). Anotá cuál suena mal.
- [ ] **GRAVE WHISPER** (M1911 con PaP):
  - [ ] clic izquierdo = pistola izquierda y clic derecho = derecha;
  - [ ] no apunta (sin ADS);
  - [ ] mata de un tiro hasta la R9;
  - [ ] el impacto suena como la bazooka.
- [ ] Cambiar de arma (Q) justo después de disparar con clic derecho: ¿la otra arma queda apuntando sola?
- [ ] Los accesorios se ven bien en cada arma (no flotan) y la vista previa del menú WEAPONS anda.
- [ ] Granadas y langostino: los íconos del HUD son dibujos y se gastan y recargan bien.

## 4. Mapa (tecla 5)
- [ ] Se abre y se cierra con **5**, y Esc lo cierra.
- [ ] Lo que no caminaste está **quemado**, con brasas en el borde; se destapa al caminar.
- [ ] Tu flecha mira hacia donde mirás. Los nombres de los cuartos están en inglés.
- [ ] Aparecen la caja, el PaP y los perks (solo lo que ya viste) y los zombies cerca como manchas rojas.
- [ ] Abajo: piezas del escudo, de la Ola y el fumigador (las que te faltan, tachadas).
- [ ] En el **búnker** dice **NO SIGNAL** con estática. En la parte honda de la pileta **no** debería decirlo.

## 5. Planta jefa del templo (lo más nuevo: probar varias veces)
- [ ] Se despierta al entrar al área del templo, con cartel y barra de vida.
- [ ] **La cara te sigue** siempre.
- [ ] **Escupitajos de 3:** los charcos de ácido tienen cubos, burbujas y vapor, y queman.
- [ ] **Raíces:** aviso en el piso, 2 a 4 a la vez, te levantan. ¿Se esquivan si te movés?
- [ ] **Jaula de raíces:** anillo rojo y morado; si te quedás adentro te encierra 3 s, y el cuchillo (V) corta más
      rápido. ¿Es justa?
- [ ] **Lengua:** te agarra, te levanta, se te nubla la vista y te traga (con Quick Revive quedás tirado).
  - [ ] Te soltás con **1 tiro a la lengua** o **2 cuchillazos** mirando a la boca.
  - [ ] Si te suelta en el aire, no te lastima la caída.
  - [ ] ¿Sale muy seguido o muy poco? (hoy, cada 2.5–4.5 s, hasta 15 m)
- [ ] Fase 2: chorro de tinta. Fase 3: hordas de calamares.
- [ ] **Muerte:** sonido fuerte, se hincha, **explota** (vuelan pedazos), el PaP sale volando a su lugar, la **cabeza cae
      en una esquina** y queda un **charco amarillo**.
- [ ] Donde estaba la planta se camina.
- [ ] **Portal:** **saltando** adentro del charco amarillo viajás a la playa del calamar (sin F). Caminando por encima
      no te lleva. En la otra punta hay otro charco para volver.
- [ ] Saltar al lado del charco (cerca del borde): ¿te lleva sin querer?

## 6. Caparazón de la tortuga (claro del búnker)
- [ ] **No se puede rodear**: los costados están cerrados con arbustos y solo se entra por adelante (barricada D21).
- [ ] Adentro está **oscuro sin energía** (LEDs apagados); con la energía se aclara y se prenden las balizas.
- [ ] Los 3 niveles: rampa al anillo (nivel 1) y escalera a la galería (nivel 2). Los zombies te siguen hasta arriba.
- [ ] Stamin-Up, el generador y la Uzi están donde tienen que estar.

## 7. Embarcadero y cabeza del calamar
- [ ] Double Tap y la chiclera arriba de los muelles; se usan desde arriba.
- [ ] Se sube y se baja por las escaleras de los muelles; por abajo también se camina.
- [ ] Cabeza del calamar (desde la R13): se entra por la boca, galerías, rampas-órgano y corazón que late.
- [ ] Las 3 estatuas de adentro ahora son más chicas: ¿se ven bien? ¿la caracola cae enfrente de la boca?

## 8. Resto del mapa
- [ ] Rancho y tortugario (trampa de la tortuga de la cueva), lazo D20 y lianas H2, H6 y H8 (se queman).
- [ ] Templo: plancha a 4.3 m con rampas, PaP en el medio, plantas moradas que escupen, río con tiburón.
- [ ] Búnker: se entra por la escotilla (con la cinemática de 5 s) y adentro están Mule Kick y la bazooka.
- [ ] Portal del templo (lo de arriba) y su llegada: ¿aparecés en un lugar caminable?

## 9. Bosses y mobs
- [ ] Sombrerón (R12): golpe al piso, guitarras, silbido, embestida, minigun de cocos.
- [ ] Calamarón (R20), perros, calamares y ronda de 4 Sombrerones.
- [ ] Zombies negros que explotan (R15+) y variantes (golpeados, en shorts, horribles).

## 10. Economía, perks, chicles
- [ ] Primer chicle de cada ronda gratis. Chicles de un solo uso, de cargas (T) y por tiempo.
- [ ] SHOPPING SPREE con 0 puntos: ¿compra puertas, perks y caja?
- [ ] Quick Revive: 10 s tirado con la Ray Gun, volvés con tus armas correctas (también si estabas recargando o con el
      escudo en la mano).
- [ ] Tomarse un perk: animación de 3 s de la botella.
- [ ] Mystery box, Fire Sale (cajas fantasma) y Carpenter (repara las ventanas).

## 11. Muerte y menú
- [ ] Al morir: la cinemática dura lo que dura la canción y vuelve al menú.
- [ ] QUIT desde la pausa: guarda la XP y pasa por la cinemática.
- [ ] Menú: PROFILE (varias cuentas), GUMS (sets, tienda KRAKEN INK), WEAPONS (accesorios por arma, aviso de nuevos).

---

## Cómo me lo pasás
Mandame la lista con las ✘ y ~ (no hace falta repetir las ✔). Por cada una: **qué pasó**, **dónde** (cuarto del mapa)
y, si podés, una captura. Si algo se repite siempre, decime los pasos.

## Lo que ya prueba la máquina sola (no hace falta que lo busques vos)
`node tools/sim/soak.js [partidas] [minutos] [semilla] [escenario]` juega solo en Node. Busca excepciones, NaN, el
jugador metido en paredes o cayéndose del mapa, zombies perdidos, rondas trabadas, fugas de objetos y frames lentos, y
muestra dónde se traba. Lo que no puede ver es **cómo se ve** ni **cómo se siente**: eso es lo tuyo.
