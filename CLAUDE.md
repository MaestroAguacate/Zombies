# Beach House Zombies

Juego web estilo CoD Zombies, estética voxel, casa de playa abandonada. Proyecto personal de Diego.
Estado: **V1 cerrada (P1–P8)**, tag `v1-final`: motor, mapa, armas, zombies, rondas, puntos, game over,
feel, melee, drops, puertas con prompt, wall weapons, mystery box, tema "Marena" 34B, audio, menú, pausa,
ajustes, estadísticas.
**V2 en curso: `ROADMAP-V2.md` manda sobre el roadmap de este archivo.** Hecho: **F0** (tag `v2-f0`:
colisión de props, `src/` + `build.js`, flow field a 250 ms) y **F1** (tag `v2-f1`: mapa de 11 zonas con
piscina, caseta, playa y muelle) y **F1.1** (tag `v2-f1.1`: puente playa↔piscina, muelle en T, hash espacial de
colliders) y **F2.5** (tag `v2-f2.5`: 4 generadores, 3 cajas de almas, Pack-a-Punch que se prende en el
muelle; spec en `F2.5-generadores-cajas.md`) y **F2.6** (tag `v2-f2.6`: fixes del playtest: zombies atrapados
en la piscina, escaleras, velocidad por ronda con 3 pasos, bordes de la pileta) y **F2.7** (tag `v2-f2.7`:
granadas) y **F2** (tag `v2-f2`: stamina, power, perks con Quick Revive estilo Black Ops, y la mejora del
Pack-a-Punch con papName) y **F3** (tag `v2-f3`: escudo con banco de trabajo, revólver, doble cañón,
ballesta, machete, ADS) y **F4** (tag `v2-f4`: vida ×1.1 desde R11, más vivos desde R8, ahogado, arrastrado,
ronda de perros de noche) y **F5** (tag `v2-f5`: El Sombrerón) y **F5.5** (tag `v2-f5.5`: quest de la Ola
Rompiente con taller de tablas en la playa; el coco sale de una palmera sorteada con el machete; El
Sombrerón con velocidad por vida, golpe al piso, guitarras y minigun de cocos). **F5.6** (jardines oeste y trasero,
techo reducido a una pasarela con plantas carnívoras, muelle con 2 accesos, bugs de la cama y del power) está
hecha y con tests, más **F5.7** (ajustes del playtest: plantas de 30, techo más ancho, caídas
proporcionales, fuente, portón con energía, pirañas, PaP en la plazoleta del muelle, perros infernales).
Más **F5.8** (segundo playtest: bug de la rampa, escalera en el jardín trasero, piscina hasta x 35, barandas
en todo el techo, Juggernog arriba, escupitajo verde, arena mojada, perros a 4.7 y de 3 tamaños, niebla del
boss). Más **F5.9** (trampas, calamares, el Calamarón y varios bosses a la vez, noche y clima por ronda, caracola
de la tortuga). Más **F5.10** (rancho de playa con lazo, tortugario con trampa, Kaboom, chorro de tinta,
tecla O completa, estrellas, plantas que ya no muerden y comen con animación, langostino). Más **F5.11**
(rancho hasta el mar, jardín norte, búnker con escotilla y estatuas, Mule Kick, 6 armas nuevas, langostino
bailarín, calamar gigante). Más **F5.12** (mapa cuadrado rodeado de jungla, cercos que se queman, búnker bajo
el mar, FBI muertos, ronda en romanos). Más **F5.13** (templo con el PaP arriba y río con puentes, cabeza del
calamar que sube por ronda, torre de salvavidas, Jugg al muelle, banco del escudo al techo, borde en x −75).
Más **F5.14** (fumigador, 9 almejas de colores con premios, la pieza de la Ola sale de la almeja morada, Ola más
grande). Más **F6** (audio: música procedural, audio 3D, pasos por superficie, ambiente por zona, volúmenes
separados). Más **F7** (gráficos: calidad Bajo/Medio/Alto, sombras en Alto, post-proceso CSS, ciclo de luz con
sol y luna, desmembramiento, animaciones y poses de muerte, agua animada, playa con props y cangrejos).
**Repo (2026-09-25):** GitHub `MaestroAguacate/Zombies` arrancó de cero con subidas web: sin historial ni tags
viejos (`v1-final`…`v2-f5.5` solo existen en la copia local de Diego). F5.6–F7 + F5.15 están en `main`, con los
43 tests en verde (7 tests desactualizados por F5.15 se arreglaron: f510, f511, f512, f513, quest, roof, audio2).
Falta el playtest de Diego (sobre todo FPS con sombras). **F5.16 (5 áreas, ver ROADMAP-V2): tandas A, B, C y D hechas**, sigue E (calamar y embarcadero) y después F8. **Todo el juego está en inglés** (textos visibles); el código y los comentarios siguen en español.
**F5.17 (estilo BO2, "menos Minecraft"):** formas curvas y hojas con alfa en el `MeshBuilder`, jungla nueva por celdas,
rancho, cueva, templo y jardines rediseñados, y el **caparazón de tortuga gigante** en lugar de la estación de policía
(ver la sección F5.17). **F5.18:** personajes y plantas de vuelta a cubos, agacharse, Quick Revive con 10 s tirado, XP y
accesorios estilo BO3, menú nuevo, choque al oeste del templo, cráneo en el caparazón (ver la sección F5.18). **F5.17b/c:** cielo visible, rayo de la caja, pared playa-calamar con H8, y formas curvas en
personajes, casa, muelle, cabeza del calamar y playa. Para mirar el juego sin navegador: `node tools/shots.js vistas.json [carpeta]` (capturas headless).

## Reglas no negociables
- **Se edita `src/`, nunca `index.html`.** `node build.js` concatena `src/*.js` (en `build.js` ORDER) dentro
  de `src/shell.html` y genera `index.html`: un solo archivo autocontenido que se abre con doble clic y se
  commitea. `npm test` falla si `index.html` no coincide con `src/` (`buildcheck.js`).
- Three.js **r128** por `<script>` UMD desde cdnjs. Nada de ES modules ni bundlers: `src/*.js` son pedazos
  de UN script clásico que comparten scope.
- Sin assets externos. Texturas por canvas en código.
- `localStorage` solo para high score (`CONFIG.HIGHSCORE_KEY`) y, desde F5.18, el perfil (XP, nombre, accesorios: `CONFIG.PROGRESSION.key`).
- Español. Directo. Si algo es mala idea técnica, decirlo antes de codear.
- Al editar: decir SOLO qué cambió. Al final: 3 bugs probables y cómo probarlos.

## Arquitectura (orden fijo de carga = `build.js` ORDER)
| Archivo | Sección | Contenido |
|---|---|---|
| `src/config.js` | 1 CONFIG | todo el balance + `state` |
| `src/world.js` | 2 WORLD | escena, cuartos, grid, `PROPS`, puertas, texturas, atlas, luces |
| `src/theme.js` | 2b TEMA | tema "Marena" 34B, solo visual |
| `src/player.js` | 3 PLAYER | movimiento, game feel de cámara, `lookInput`, `damagePlayer` |
| `src/weapons.js` | 4 WEAPONS | armas, cuchillo, Ray Gun, lanzallamas, decals, sangre |
| `src/grenades.js` | 4b GRANADAS | cocinar, física con rebote, explosión (V2 F2.7) |
| `src/zombies.js` | 5 ZOMBIES | pool, flow field, IA, `damageZombie` |
| `src/enemies.js` | 5b ENEMIGOS | ahogado, arrastrado, perros, noche y relámpagos (V2 F4) |
| `src/boss.js` | 5c BOSS | El Sombrerón: modelo, fases, golpe al piso, silbido, invocación, embestida, guitarras, minigun (V2 F5) |
| `src/rounds.js` | 6 ROUNDS | rondas, `STATS`, game over, `resetGame` |
| `src/economy.js` | 7 ECONOMY | puntos, puertas, wall buys, mystery box, power-ups, `interact` |
| `src/souls.js` | 7b SOULS | generadores, cajas de almas, Pack-a-Punch (V2 F2.5) |
| `src/perks.js` | 7c PERKS | power (palanca del sótano), perks, Quick Revive (V2 F2) |
| `src/shield.js` | 7d ESCUDO | piezas, banco de trabajo, bloqueo y empujón (V2 F3a) |
| `src/quest.js` | 7e QUEST | cocos, cuerda, caracola, taller de la playa, Ola Rompiente (V2 F5.5) |
| `src/garden.js` | 7f JARDINES | plantas carnívoras del techo, perros del jardín trasero (V2 F5.6) |
| `src/traps.js` | 7g TRAMPAS | tiburón del muelle, cortadora del jardín oeste (V2 F5.9), tortugas del rancho (F5.10) |
| `src/bunker.js` | 7h BÚNKER | búnker bajo tierra, escotilla, estatuas de plantas, caballito de mar (V2 F5.11) |
| `src/clams.js` | 7i ALMEJAS | fumigador, 9 almejas que cambian de color, premios (V2 F5.14) |
| `src/progress.js` | 7j PROGRESO | XP, niveles y rangos, accesorios y camos de armas, perfil guardado (V2 F5.18) |
| `src/ui.js` | 8 UI | HUD, menús, prompt, feel de UI, overlay de debug |
| `src/gfx.js` | 8c GRÁFICOS | calidad, sombras, post-proceso CSS, sol y luna (V2 F7), después de audio.js |
| `src/audio.js` | 8b AUDIO | audio procedural |
| `src/debug.js` | 8c DEBUG | modo debug: trucos, noclip, cartel (`CONFIG.DEBUG_MODE`) |
| `src/loop.js` | 9 LOOP | `init`, input, gobernador de calidad, `animate` |
| `src/shell.html` | — | HTML + CSS, con `@@BUNDLE@@` donde va el script |

- **Scope compartido:** un archivo puede usar nombres de otro **dentro de funciones**, porque se llaman en
  runtime y para entonces todo está definido. Código que se ejecuta al cargarse el archivo solo puede usar
  lo que viene antes en ORDER. `init()` es la última línea de `loop.js`.
- **Archivo nuevo en `src/`:** agregarlo a ORDER en `build.js`. `buildcheck.js` falla si hay un `.js` suelto.
- Los tests (`harness.js`) cargan `build.js` `bundle()`, el mismo código que va a `index.html`.
  `BHZ_FILE=<html>` carga un HTML en su lugar, para comparar contra un tag viejo.
- La separación fue mecánica. Se verificó que el script generado era idéntico carácter por carácter al de
  antes del split (commit `e734f18`).

Todo número de balance vive en `CONFIG`. Si tenés que tocar un número fuera de CONFIG, está mal.

## Nombres fijos (nunca renombrar)
`state.round, state.points, state.health, state.zombies[], state.doors{}, state.power, state.weapons[], state.currentWeapon`
`spawnZombie(), damageZombie(z, dmg), buyDoor(id), fireWeapon(), startRound(n)`

- `state.weapons` = `[{ id, mag, reserve }]`, `state.currentWeapon` = índice.
- `damageZombie(z, dmg, headshot)` — tercer parámetro agregado.

Nombres agregados en V2 (tampoco se renombran):
`PROPS[]` ({id, room, box:[x1,x2,z1,z2,alto]} | {id, room, decor:true}) · `addPropCollider(p)` · `buildPropColliders()`
· `POOL` · `groundY(x, z)` · `addBoundary(minX, maxX, minZ, maxZ, tag, minY?, maxY?)` · `buildPool()`
· `segmentClear(x0, z0, x1, z1, pad, shotOnly, minTop)` (6to y 7mo parámetro agregados) · `ROOMS[].outdoor` · `ROOMS[].hole`
· `makeDoor(id, x1, x2, z1, z2, h)` (alto opcional)
· `COLHASH` · `collidersNear(minX, maxX, minZ, maxZ)` · `CONFIG.PAP.spot` · `ROOMS[].part`
· `state.generators{muelle,caseta,garaje,piscina}` · `state.souls{sotano,piscina,pasillo}` · `RELICS`
· `hitGenerator(key)` · `soulFromKill(z)` · `papReady()` · `checkPap()` · `resetRelics()`
· `POOL.ladders` · `NAV.link` · `nearestNav(cx, cz, R, fx, fz, los)` (6to parámetro agregado) · `startClimb(z, to)`
· `z.gait` · `CONFIG.ZOMBIE.gaits` / `gaitByRound` · `rollGait(n)`
· `state.grenades` · `GREN` · `startCook()` · `releaseGrenade()` · `explodeAt(x, y, z)` · `addRoundGrenades()`
· `resetGrenades()` · `damagePlayer(dmg, fromX, fromZ, ignoreIframe)` (4to parámetro agregado)
· `weaponsState.phase === 'grenade'`
· `state.perks[]` · `state.reviveBuys` · `PERKM` · `hasPerk(id)` · `maxHealth()` · `perkRate()` · `perkDmg()`
· `perkReload()` · `sprintMul()` · `staminaMul()` · `turnOnPower()` · `buyPerk(key)` · `tryRevive()` · `stamina`
· `slot.pap` · `slotDef(slot)` · `papDef(id)` · `CONFIG.WEAPONS[*].papName` · `PAPST` · `usePap()` · `ammoCostOf(slot)`
· `state.shield{parts,built,has,hp}` · `SHIELDST` · `shieldBlocks(fx, fz, dmg)` · `shieldBash()` · `toggleShield()`
· `selectWeapon(i)` · `weaponsState.phase === 'shield'`
· `state.machete` · `meleeDef()` · `ADS{on,k}` · `adsSpread()` · `def.pierce` · `def.reloadAnim` · `def.adsFov`
· `CONFIG.WALLBUYS[].axis/y/post` · `floorAt(x, z, feet)` · `standable(c)` · `headroom(c, x, z)`
· `UP` · `upIdx(x, z)` · `isUp(x, z)` · `levelAt(x, z, feet)` · `playerLevel()` · `z.level` · `collider.overhead`
· `NAV.base` · `NAV.total` · `NAV.via` · `segmentClear(..., minTop, layer)` (8vo parámetro agregado)
· `startClimb(z, to, from)` (3er parámetro agregado) · `roofAt(x, z)` · `UP.mask` · `collider.roofSurface`
· `fallDamage(drop)` · `player.airTop` · `collider.zombieOnly` · `CONFIG.DEBUG_MODE` · `DEBUG` · `debugKey(code, repeat)`
· `z.kind` ('normal'|'drowned'|'dog'|'boss'|'squid') · `z.dog` · `z.crawl` · `z.legDmg` · `z.maxHealth` · `SPAWN_POINTS[].sea`
· `damageZombie(z, dmg, headshot, killPoints, hitPoints, part)` (6to parámetro: `userData.part`, 'leg' | 'hat')
· `pickSpawnPoint(sea)`
· `resetZombie(z, sp, keepHealth, kind)` · `DPOOL` · `spawnDog()` · `startCrawl(z)` · `maxAliveFor(n)`
· `roundState.dogs` / `nextDog` · `isDogRound(n)` · `NIGHT` · `setNight(on)` · `lightning()` · `DRIPS`
· `WORLD.hemi` / `sun` / `sky` · `CONFIG.DROWNED/CRAWLER/DOGS`
· `BOSS` · `z.boss` · `z.phase` · `z.hatOn` · `z.hatDmg` · `z.act` · `spawnBoss()` · `bossAlive()` · `bossSpeed(z)`
· `bossTick(z, dt)` · `bossDamaged(z, dmg, hat)` · `knockHat(z)` · `bossDeath(z)` · `freePerk()` · `bossSummon(z)`
· `isBossRound(n)` · `roundState.bossPending` / `forceBoss` · `player.pushT/pushX/pushZ` · `player.dazeT`
· `STATS.bosses` · `CONFIG.BOSS`
· `state.quest{coconut,string,shell,built}` · `QUEST` · `CONFIG.QUEST` · `CONFIG.WEAPONS.wave` · `def.wave`
· `palmTop(P)` · `hitPalm(obj)` · `cocoSpot(P)` · `THEMEFX.palms` · `dropString(z)` · ~~`shellFromGrenade`~~ (F5.9: borrada)
· `questPieces()` · `pickQuestPiece(p)` · `questCount()` · `haveWave()` · `takeWave()` · `loseWave()` · `fireWave(def)`
· `craftWave()` · `resetQuest()`
· `BOSS.guitars` / `cocos` / `gunModel` · `z.gun` ('idle'|'spin'|'fire'|'cool') · `z.throwT` · `canShootAt(z)`
· `throwGuitar(z)` · `fireCoco(z)` · `bossGun(z, dt)` · `updateBossShots(dt)` · `projBlocked(x, y, z)`
· F5.6: `UP.walk` · `UP.walkMask` · `walkAt(x, z)` · `UP.stairs2` · `UP.flights` · `flightH(S, x, r)` · `inFlight(S, x, z, r)`
· `S.dir` · `OPEN_LINKS` · `CONFIG.GARDEN` · `PLANTS` · `updateGarden(dt)` · `spawnGardenDog()` · `resetGarden()`
· `roundState.gardenDogs` · `pickSpawnPoint(sea, room)` (2do parámetro agregado) · `playerOnTop()`
· `nearestNav(..., los, minTop)` (7mo parámetro agregado) · `powerMissing()` · `CONFIG.WALLBUYS[].level`
· `CONFIG.ZOMBIE.attackRangeOnTop` · tags `hedge`, `roofrail`, `plant`
· F5.7: `PIRANHAS` · `updatePiranhas(dt)` · `resetPiranhas()` · `door.power` · `makeDoor(..., h, mat)` (7mo parámetro)
· `CONFIG.PLAYER.fallMaxDrop/fallMaxDmg` · `CONFIG.GARDEN.palms/fountain/piranhas/plantDamage/headScale`
· F5.9: `BOSS.pool` · `z.variant` ('sombrero'|'calamar') · `z.hatFly` · `z.gunModel` · `z.barrels` · `z.eyeMat` · `z.tears`
· `spawnBoss(variant)` · `bossName(z)` · `bossEyes(z)` · `throwSquid(z)` · `BOSS.squids` · `bossesFor(n)` · `roundState.bossQueue`
· `CONFIG.BOSS.pool/spread/schedule/calamar/eyeYellow/eyeRed` · `acidPuddle(x, z, level, radius, life)` (4to y 5to agregados)
· `z.kind === 'squid'` · `z.squid` · `z.size` · `z.fused` · `z.inkT` · `SQPOOL` · `INK` · `spawnSquid()` · `squidTick(z, dt)`
· `fuseSquids(a, b)` · `fireInk(z)` · `canInk(z)` · `updateSquids(dt)` · `setSquidSize(z)` · `CONFIG.SQUID` · `CONFIG.MOBS`
· `roundState.mob` / `mobCount` · `mobKind(k)` · `spawnMob()` · `CONFIG.WEATHER` · `setSky(n, mob)` · `weatherFogFar(base)`
· `NIGHT.p/pTarget/rain/storm/thunderT` · `RAIN` · `applyNight(k, f, p)` (3er parámetro) · `TRAPS` · `CONFIG.TRAPS`
· `useTrap(T)` · `trapKill(z)` · `updateTraps(dt)` · `resetTraps()` · `PLANTS[].fed` · `plantEat(p, z)` · `plantAlien(p, on)`
· `QUEST.turtle` · `shootShell()` · `shellReady()` · `placeShellOnTurtle()` · `userData.type === 'questShell'` · `UI.ink`
· F5.10: `R14` · `D20` · `CONFIG.RANCHO` · `buildRope(d)` · `buildRancho()` · `RANCHO` · `TRAPS.turtles` · `turtlePrey(T, tu)`
· `updateTurtles(T, dt)` · `KABOOM` · `kaboom()` · `updateKaboom(dt)` · `z.burnT` · `roundState.spawnHold` · `z.summoned`
· `CONFIG.BOSS.summonMax` · `debugUnlockAll()` · `STARS` · `buildStars()` · `CONFIG.WEATHER.stars` · `z.eaten`
· `plantEatAnim(p, dt)` · `plantCarry(z, dt)` · `PLANTS[].prey/eatK/base/mouth` · `CONFIG.GARDEN.eat` · `QUEST.shrimp`
· `z.jetT` / `jetAcc` · `CONFIG.SQUID.ink.jet/rest/rate/dps`
· F5.11: `R15` · `R16` · `ROOMS[].noFloor` · `CONFIG.BUNKER` · `BUNK` · `buildBunkerShell()` · `NAV.hatch` · `openBunker()`
· `statueKill(z)` · `hatchNear/hatchPrompt/useHatch` · `inBunker()` · `setZombieEyes(z, red)` · `z.redEyes` · `startClimb` (c.hatch)
· `maxWeapons()` · `dropMuleWeapon()` · `CONFIG.PERKS.list.mule` · `P.y` (máquina) · `CONFIG.WALLBUYS[].floorY`
· `explodeAt(x, y, z, opts)` (4to parámetro) · `def.charge/chargeTime/chargeMin` · `updateBow` · `releaseBow` · `def.rocket`
· `ROCKETS` · `launchRocket` · `updateRockets` · `CONFIG.BOX.weights` · `'monkey'` (resultado de la caja) · `MONKEY`
· `CONFIG.MONKEY` · `throwMonkey()` · `monkeyLure()` · `FLOW.pdist` · `FLOW.lure` · `flowFrom(...)` · `steerZombie(z, P, tLevel)`
· `GIANT` · `giantRise()` · `giantLaunch(z)` · `giantBusy()` · `z.fromGiant` · `CONFIG.SQUID.giant` · `CONFIG.DECOR`
· `plantStem` · `makePlantHead` · `plantJawMesh` · `PLANTS[].ground` · `SETTINGS.dmgNumbers` · `CONFIG.TRAPS.turtles.biteRound`
· F5.12: `R17` · `R18` · `H1..H5` · `door.burn/burning/burnT/flames/y0` · `CONFIG.BURN` · `startBurn(d)` · `updateBurns(dt)`
· `resetBurns()` · `CONFIG.JUNGLE` · `JUNGLE.trees` · `planJungle()` · `buildJungle()` · `MAT.jungle` · floor `'jungle'`
· `roman(n)` · `g.bounce/g.friction` (stepGrenade) · `CONFIG.MONKEY.bounce/friction/landDamp`
· F5.13: `R19` · `CONFIG.TEMPLE` · `buildTempleShell()` · `buildTemple()` · `TEMPLEFX` · `flightV` · `S.axis` · `S.stone`
· `MAT.stone` · `CONFIG.LIFEGUARD` · `CONFIG.SQUIDHEAD` · `SQHEAD{mound,walls,open,g,dy,target,force}` · `squidHeadSolid(open)`
· `squidRise(n)` · `setSquidHead(n, snap)` · `updateSquidHead(dt)` · `CONFIG.BUNKER.entrance` · `BUNK.halves`
· F5.14: `CLAMS{list,fum,have,holdT,last}` · `CONFIG.CLAMS` · `buildClams()` · `resetClams()` · `clamsRound(n)` · `clamSnap(sp)`
· `rollClam(stage)` · `openClam(c, force)` · `pieceAvailable()` · `clamNear/clamPrompt/clamPress` · `updateClams(dt)`
· `z.fromClam` · `z.emergeT` · `z.digDepth` · `CONFIG.QUEST.palmCoco` · `QUEST.fxParts`
· F6: `SETTINGS.music/sfx` · `setMusicVolume` · `setSfxVolume` · `AUDIO.music/wind/bugs` · `spatialOut(x, y, z, dest)`
· `surfaceAt(x, z, feet)` · `STEP_SFX` · `sfxStep(surf, vol, pos)` · `FOOT` · `updateFootsteps(dt)` · `zombieSteps(dt)` · `z.stepT`
· `MUSIC` · `updateMusic()` · `musicIntensity()` · `sfxRoundDrum(n)` · `ambienceZone()`
· F7: `GFX` · `buildGfx()` · `applyQuality(name)` · `setShadows(on, size)` · `setPost(on)` · `gfxFilter()` · `gfxApplyFilter()`
· `updateGfx(dt)` · `gfxMarkShadows()` · `NIGHT.pal` · `paletteAt(key, k, out)` · `CONFIG.GFX` · `CONFIG.WEATHER.palette`
· `GIBS` · `buildGibs()` · `spawnGib(from, dims, color, dx, dz)` · `loseArm(z, s)` · `loseLeg(z)` · `setArm(z, s)` · `goreKill(z, headshot)`
· `updateGibs(dt)` · `resetGibs()` · `isHuman(z)` · `pickW(list)` · `deathPose(z, t)` · `z.limp/armOff/deathPose/deathSide/atk`
· `CONFIG.GORE` · `BEACH` · `waterMat(...)` · `buildPoolWater()` · `buildBeachDecor()` · `updateBeach(dt, t)` · `CONFIG.DECOR.beach`
· F5.15: `R20` · `ROOMS[].corridor` · `CONFIG.THICKET` · `THICKET.segs` · `inThicket(x, z)` · `buildThicketWalls()` · tag `thicket`
· `H2..H8` · `lifeguardLegs()` · `CONFIG.TEMPLE.sanctum` · `sanctumWalls()` · `CONFIG.BUNKER.entrance.face` · `wakeKills/wakeRadius`
· `CONFIG.SQUIDHEAD.tunnelH/chamberH` · `CONFIG.GARDEN.piranhas.near` · `zn.near` · `directClear(z, P, L, lure)` · `CONFIG.ZOMBIE.losCache`
· `nearCached(o, ...)` · `COLHASH.gen` · `o.colCache` · `PLV` · `plvFresh()`
· F5.17: `MeshBuilder.addM/cyl/seg/sphere/rock/blob/tube/lathe/card/frond/clump/quadN/upNormals` · `mbGeo` · `ChunkMB` · `FOLI`
· `buildFoliage()` · `texAniso()` · `TEX.bark/rock/thatch` · `MAT.bark/rock/grimeV/thatch/thatchIn` · `CONFIG.SHELL` · `shellK(x, z, m)`
· `shellRim()` · `buildShellWalls()` · `buildShell()` · `SHELLFX` · `updateShellFX` · `UP.flights[].open` · tag `shell` / `shell:deck`
· `RANCHO.eyes` · `updateRanchoEyes` · `buildGardenDress()` · `buildTempleDress()` · `LAMPS` · `CONFIG.TEMPLE.heads/stelae`
· F5.17b/c: `SKYDOME` · `buildSkyDome()` · `updateSkyDome()` · `CONFIG.GFX.sky` · `CONFIG.BOX.beamColor/beamWidth/beamHeight`
· `WORLD.beachWall` · `beachWall(on)` · `CONFIG.SHELL.jump` · `MeshBuilder.geometry/rbox/ring` · `zShapes()` · `dogShapes()`
· `squidShapes()` · `bossShapes()` · `trimRun()`
· F5.18: `player.crouch/crouchK/downK` · `eyeDrop()` · `CONFIG.PLAYER.crouch` · `DOWN{on,t,saved,cur}` · `startDown()` · `endDown()`
· `updateDown(dt)` · `fleeZombie(z, P)` · `CONFIG.PERKS.lastStand` · `CONFIG.CRASH` · `crashFrame(c)` · `crashBox(M, b)` · `CRASH` · `buildCrash()`
· `updateCrash(dt, t)` · `PROFILE` · `CONFIG.PROGRESSION` · `loadProfile/saveProfile` · `xpForLevel` · `levelOf` · `rankLevel` · `tierName`
· `levelProgress` · `addXP` · `resetMatchXP` · `attUnlocked/camoUnlocked/canAttach` · `loadoutOf` · `toggleAttachment` · `setCamo` · `attDef(b, id)`
· `curAtt(k)` · `def.att/def.camo` · `tintModel` · `addAttachmentModels` · `MENU.mode/map/weapon` · `menuPanel(k)` · `pickMap` · `buildSilhouettes`
· `renderWeaponsPanel/renderProfilePanel/renderProfileMini` · `menuCamera()`

## Mapa canónico (1 u = 1 m, grid 1x1, pared alto 4)
| | Cuarto | [xMin,xMax,zMin,zMax] |
|---|---|---|
| R1 | PORCHE (spawn, barandales 1.2m) | [-6,6,-4,4] |
| R2 | SALA | [-8,8,4,18] |
| R3 | COCINA | [8,18,4,14] |
| R4 | PASILLO | [-4,4,18,28] |
| R5 | DORMITORIO | [4,16,18,30] |
| R6 | GARAJE | [-16,-4,18,30] |
| R7 | SÓTANO (POWER) | [-16,-4,30,40] |
| R8 | PISCINA (patio sin techo; F2.6: x2 30 → 31) | [18,31,4,20] |
| R9 | CASETA (generador en F2.5; techo caminable a 4.3 m en F2.8) | [16,24,20,30] |
| R10 | PLAYA (abierta) | [-20,20,-24,-4] |
| R11 | MUELLE (Pack-a-Punch en F2.5; F5.6: más adentro y con 2 accesos) | tronco [-2,2,-44,-24] + plataforma [-4,4,-50,-44] + tronco 2 [-19,-15,-48,-24] + pasarela [-15,-4,-48,-44] |
| R12 | JARDÍN OESTE (F5.6, en L; taller de tablas, escalera 2; F5.7: caja de almas 'sotano', portón D19) | [-24,-8,-4,18] + [-27,-16,18,40] |
| R13 | JARDÍN TRASERO (F5.6; caja, rifle, perros; F5.7: fuente, Stamin-Up) | [-4,35,30,40] + hueco [-4,4,28,30] + pasillo [31,35,10,30] + cuadrado [24,31,20,30] |

Puertas: D1 R1→R2 750 · D2 R2→R3 1000 · D3 R2→R4 1000 · D4 R3→R5 1250 · D5 R4→R5 1250 · D6 R4→R6 1500 · D7 R6→R7 2000
· D8 R3→R8 1500 · D9 R8→R9 1750 · D10 R5→R9 1750 · D11 R1→R10 1250 (reja 1.2 m) · D12 R10→R11 2000 (reja 1.2 m)
· D13 R10→R8 2000 (reja 1.2 m, por el puente C13)
· **F5.6:** D14 R10→R12 2000 (reja en la cerca, x −14..−10) · D15 R8→R13 2000 (pared este de la piscina, z 11..13)
· D16 R7→R13 2000 (pared este del sótano, z 36..38) · D17 R4→R13 1500 (pared norte del pasillo, x 1.5..3.5)
· D18 R10→R11 2000 (reja del segundo muelle, x −19..−15)
· **F5.7:** D19 R7→R12 portón (pared oeste del sótano, z 35..37): no se compra, lo abre `turnOnPower`

**F5.6 — el techo es un paso gratis entre la piscina y el jardín oeste** (escaleras 1 y 2). Por eso D14 no
cuesta menos de 2000: D11 + D14 = 3250, lo mismo que por la cocina. `map.js` lo verifica con Dijkstra
contando el techo como un enlace de costo 0, y `openRooms()` lo incluye (`OPEN_LINKS`).

**F1.1 — puente C13 `[16,22,-4,4]`** (`hidden`, al aire libre): la reja D13 va del lado de la playa (x 16–20) y
hacia la piscina queda abierto (x 18–22). Mide 6 m porque es la única franja que toca la playa (x ≤ 20) y la
piscina (x ≥ 18) con 4 m o más. La laguna de los costados es solo tema. **D13 cuesta 2000 a propósito:**
D11 + D13 = D1 + D2 + D8 = 3250, así que la playa no es atajo a la piscina (`map.js` lo verifica con
Dijkstra). Si se baja D13, la piscina se abre antes que la cocina.

**F1.1 — muelle en T:** dos entradas de `ROOMS` con el mismo id `R11` (la plataforma lleva `part:true`).
`roomAt()` devuelve la primera caja que contiene el punto y los `ROOMS.find(id)` solo leen `outdoor`: todo
lo que busque "el muelle" por id tiene que tolerar las dos cajas. El Pack-a-Punch tiene lugar reservado en
`CONFIG.PAP.spot` (0, −39.5), contra el fondo, dentro del anillo no navegable: no cambia el grid. Ningún
spawn del muelle va en la plataforma, y el bote quedó al costado este.

**Desvío del roadmap V2 (aprobado):** R9 va en x 16–24, no en 18–26, porque así comparte pared con R5 y
con R8 (con 18–26 quedaba un hueco de 2 m sin puerta posible). D8 va en z 11–13 para no tapar el subfusil.

**Desvío deliberado del canon:** R3 termina en z=14 y R5 empieza en z=18, no se tocan. D4 es un pasillo conector
`C4 [9,13,14,18]` con el bloque de puerta en z=14. Mide 4 m de ancho porque con 2 m el margen de pared dejaba
**cero** celdas navegables. No achicarlo.

## Decisiones técnicas que no hay que deshacer
- **Arma en escena y cámara aparte** (`weaponScene`/`weaponCamera`, `autoClear=false`, `clearDepth()` entre pasadas).
  Si el arma pasa a ser hija de la cámara principal, el near plane la corta y las paredes la atraviesan.
- **Luces de fogonazo creadas una vez con `intensity=0`.** Agregar/quitar luces en runtime recompila shaders → tirones.
  Regla general: nunca `scene.add(light)` durante el juego.
- **Hitscan:** `intersectObjects` contra `WORLD.hitMeshes` + `z.hitParts`, se toma `hits[0]`. Así nada atraviesa paredes.
- **Nav:** `NAV.cells` (Uint8Array). Celda bloqueada si hay collider a <0.4 m del centro → el anillo pegado a las paredes
  NO es navegable. Por eso zombies (radio 0.3) y jugador pasan seguido por celdas fuera del grid.
- **Flow field:** un solo BFS desde el jugador cada `ZOMBIE.repathMs` = 250 ms (`FLOW.dist`). Cada zombie
  baja por el gradiente. No hacer BFS por zombie. `FLOW.lastCalc` avanza de a `repathMs`, no salta a `now`
  (mismo arreglo que `lastShot` de las armas): si no, a 60 fps el intervalo de 250 ms se redondea a 266 ms.
- **Costo medido** (`navcost.js`, 24 zombies en el sótano): ~0.6–0.7 ms por frame de mediana, con presupuesto
  de 1 ms. El BFS es ~0.01 ms: casi todo el costo es colisión e IA (zombies × colliders).
- **Hash espacial de colliders (F1.1)** (`COLHASH`, celdas de 4 m): `moveCircle` y `segmentClear` miran
  solo los colliders de su zona (`collidersNear`), ordenados como en `WORLD.colliders`, así el resultado es
  **idéntico** a recorrerlos todos (`navcost.js` lo compara en 60000 casos). Se reconstruye solo si cambia
  la cantidad de colliders o si se llamó `buildNavGrid()`: **todo código que mueva un collider tiene que
  llamar `buildNavGrid()`** (como `placeBox`). Abrir puertas solo cambia `solid`, no hace falta. Si un zombie
  arranca metido en un collider y el empujón lo saca de la zona consultada, `moveCircle` sigue con la lista
  completa. Con F1.1 (~102 colliders), la mediana pasó de ~1.0 ms a ~0.35 ms. El jugador (`moveAxis`) y
  `cellBlocked` siguen recorriendo todo: son 1 por frame y solo al armar el grid.
- **Modos de IA** (`z.mode`): `flow` normal · `direct` (<3 m y `segmentClear`) · `recover` (fuera del grid → celda válida
  más cercana) · `lost`/`unreachable` → respawn fuera de vista. Watchdog: 4 chequeos de 1.5 s sin avanzar 0.3 m →
  respawn fuera de vista. No cuenta atasco si está a <4 m del jugador o tiene otro zombie pegado (`inCrowd`): es fila.
- **"Solo cuartos abiertos"** no tiene lógica propia: un spawn tras puerta cerrada tiene `flowAt = -1` y se descarta.
- **Pools:** zombies (24), decals (48), sangre (64). No crear meshes en runtime.
- **`resetGame()`** reinicia todo sin recargar. Cualquier estado nuevo (P5+) tiene que resetearse ahí.
- Golpe de zombie exige línea libre (`segmentClear`), si no pega a través de paredes de 0.4 m.
- `PLAYER.hitIframe = 0.3`: evita muerte instantánea con 4 zombies sincronizados. `0` = spec puro.
- `ECONOMY.startPoints = 500` (el spec no lo define).
- Kill: el disparo que mata da 60 / 130 (headshot), no 60+10.

## Game feel (`CONFIG.FEEL`) — reglas
- **Aim ≠ cámara.** `feel.aimQuat` / `feel.eye` = mouse + retroceso; es lo ÚNICO que usa `fireWeapon`.
  La cámara visual suma bob, shake, tirón por daño y aterrizaje. Si una bala sale de `camera.quaternion`, el shake
  desvía los disparos: bug de lógica.
- **Empujón de zombie solo visual:** `placeRoot()` desplaza el mesh; `z.px/z.pz` no se tocan (mover la lógica
  lo saca del grid).
- **Resortes con solución exacta** (`springStep`, forma cerrada ζ=1 y ζ<1). No volver a Euler: con ω=30 pierde ~20%.
  `springKick(s, peak, w)` da pico exacto con ζ=1. `springW(t)` = ω para volver a ~5% en t segundos.
- Velocidad tope sigue siendo `PLAYER.speed / sprint`; `FEEL.accel/decel` solo cambian cuánto tarda en llegar.
- Hit confirm (hitmarker, sonido) una vez por disparo, no por perdigón. Números de daño se fusionan por zombie en 80ms.
- Hitmarker: blanco normal, amarillo headshot, rojo kill.
- Audio en `src/audio.js`, Web Audio procedural. `initAudio()` en cada gesto de usuario.
- Retroceso de cámara a 90ms entre disparos acumula ~1.33x; a 300ms no acumula. Para más escalada en automáticas,
  bajar `recoilPitch` de retorno por arma en P5 (hoy `recoilReturn` es global).

## Cuchillo (`CONFIG.KNIFE`) y power-ups (`CONFIG.POWERUPS`)
- **Bug de diseño que esto arregla:** con M1911 sola (88 balas) el jugador se queda seco a mitad de ronda 2
  incluso con headshots perfectos. El cuchillo (munición infinita) es el fallback, igual que en CoD real.
- **El cuchillo NO vive en `state.weapons[]`.** No ocupa slot, no se cambia con Q, siempre disponible
  (tecla V / clic derecho). `meleeAttack()` es independiente de `fireWeapon()`.
- **"Un golpe" en el spec = headshot.** `CONFIG.KNIFE.damage:150, headshotMul:2` → 300 en la cabeza. Con eso:
  1 headshot mata rondas 1-2 (coincide con el spec), 2 headshots hasta ronda 5 (el spec pedía "hasta ronda 4",
  esto se pasa, no es problema). Un golpe al cuerpo sin apuntar cabeza es más débil (1 mata solo ronda 1).
  Si en algún momento se quiere que funcione SIN depender de apuntar a la cabeza, subir `damage` a 250.
- **`meleeAttack()` interrumpe una recarga en curso** (no pierde munición: la transferencia solo ocurre al
  completarse el reload) pero NO interrumpe un cambio de arma (`phase==='switching'` bloquea el golpe).
- **Instakill se centraliza en `damageZombie()`**, no en cada llamador: `if (state.effects.instakill>0) dmg =
  Math.max(dmg, z.health)`. Gun y cuchillo se benefician sin código duplicado. El número de daño flotante
  muestra el valor ORIGINAL (no el override), para no mostrar "99999" en pantalla.
- **`addPoints()` centraliza el doble puntos** (`x2` si `state.effects.doublePoints>0`). Todo lo que pasa por
  `addPoints` se duplica automáticamente: hit, kill, headshot, cuchillo. No hay que tocar cada llamador.
- **`damageZombie(z, dmg, headshot, killPoints)`**: el 4to parámetro es un override del bonus de kill. El
  cuchillo pasa `CONFIG.POINTS.meleeKill` (130 fijo, headshot o no). Sin ese argumento usa el criterio normal
  de arma de fuego (60 / 130 headshot). El cuchillo NO toca `state.shotsFired/shotsHit` — munición infinita
  no debe inflar la precisión.
- **`onZombieDeath(z)`** se llama desde dentro de `damageZombie()`, una sola vez, sin importar si mató la bala
  o el cuchillo. Ahí vive la garantía de ronda: `roundState.guaranteedDrop` se resetea en cada `startRound(n)`
  y se consume con el primer kill de una ronda múltiplo de `POWERUPS.guaranteeEveryRounds` (4).
- **Pickups NO están en `state`** (siguen el patrón de `decals`/`blood`: un objeto pool aparte, `PICKUPS.pool`,
  8 slots). `state.effects` (instakill/doublePoints, timers en segundos) sí vive en `state` porque afecta lógica.
- Testear cuchillo/power-ups en Node requiere dos cosas que el juego real no necesita pero el harness sí:
  1) el reloj interno (`performance.now()` dentro del sandbox) solo avanza con `G.tick(dt)` — usar deltas
  grandes (`-9999`, `-1e9`) en vez de aritmética contra tiempo real. 2) `weaponsState.phase` solo vuelve a
  `'idle'` vía `updateWeapon(dt)`, que el harness no corre en un test de una sola llamada — resetearlo a mano
  después de cada `meleeAttack()` (ver `swing()` en `knife.js`).

## Modo debug — `CONFIG.DEBUG_MODE`, `src/debug.js`
**⚠️ `CONFIG.DEBUG_MODE` es `true` SOLO EN DESARROLLO. Se pone en `false` antes de cualquier build final.**
`buildcheck.js` avisa en cada `npm test` mientras esté en `true` (avisa, no falla).
Con `false` no queda ningún truco: las teclas no hacen nada, y no hay overlay ni cartel.
- Cartel **"DEBUG MODE"** arriba al centro mientras está activo (dice "· NOCLIP" si volás).
- `P` +5000 puntos (`CONFIG.DEBUG.points`) · `]` siguiente ronda · `[` la ronda anterior (mínimo 1).
  Las dos rondas limpian los zombies vivos sin dar puntos ni almas y arrancan sin la pausa (`debugRound`).
- `N` noclip / vuelo (toggle): hacia donde mirás, sin gravedad ni colisiones; Espacio sube, Ctrl/C baja,
  Shift ×2.5. Al apagarlo caés sin daño por caída (`DEBUG.safeFall`).
- `K` la siguiente ronda es de perros (arranca ya, con el cartel y la noche).
- `J` la siguiente ronda trae al Sombrerón (arranca ya).
- `O` abrir todas las puertas · `B` pintar el grid (verde cerca, rojo lejos, gris inalcanzable, blanco =
  origen; antes era la N) · `H` ocultar el overlay.
- Overlay: `ZOMB 5 f3 d2 r0 L0` = vivos y cuántos en cada modo. `L>0` sostenido = problema.
- Test: `debug.js`.

## Tests headless (correr SIEMPRE después de tocar WORLD, ZOMBIES o ROUNDS)
```
cd tools/sim && npm install && npm test
```
Cargan el juego real (el `bundle()` de `src/`, idéntico al de `index.html`) en Node con Three r128, sin
render (`harness.js`).
- `pathfinding.js` — 12 zombies, 4 min, jugador recorre los 7 cuartos. Pasa: 0 en pared, 0 lost, strikes < 4.
- `crowd.js` — 24 zombies contra el jugador en la esquina del sótano. Pasa: ≥15 llegan, nadie llega a 4 strikes.
- `feel.js` — velocidad tope intacta, colisión con aceleración, aimQuat inmune a shake, pico/retorno del retroceso,
  aterrizaje con rebote, empujón visual sin mover lógica, flash, fusión de números de daño.
- `knife.js` — daño/cooldown/alcance del cuchillo, no atraviesa paredes, puntos fijos (130), umbrales exactos
  por ronda, no infla precisión, insta-kill lo hace letal igual.
- `powerups.js` — tasa de drop ≈3%, recolección por distancia, expira a los 15s, MAX AMMO llena todo,
  duraciones de 30s, doble puntos multiplica `addPoints`, garantía de ronda 4 (y que NO se dispara en ronda 5
  ni dos veces en la misma ronda 4), `resetGame()` limpia pickups y efectos.
- `rounds.js` — cantidades por ronda, pausa 8 s, tope 8 vivos, escalonado 1.5 s, puntos, i-frame, game over,
  high score, reset limpio, spawn solo en R1 con puertas cerradas.
- `wallbuys.js` — prompt de puertas y armas (textos, rango, cuarto), cobro exacto, sin puntos no compra, doble
  puntos no toca gastos, recompra 500 / llena no cobra, 3ra arma reemplaza la equipada, compra cancela recarga,
  cadencia de automáticas, retroceso/shake por arma, reset.
- `mysterybox.js` — spots (en su cuarto, grid intacto, alcanzables), cobro, 4s/8s, pool sin repetidas, teddy 15%
  y mudanza solo a cuartos abiertos, Ray Gun directo+área sin atravesar paredes, francotirador 300/900,
  lanzallamas 40/s en cono sin puntos de impacto, cadencia real a 60 fps, reset.
- `audio.js` — sin contexto no hay errores, loops una sola vez, sin fugas de nodos, recarga en 3 pasos,
  limitador/distancia/oclusión/paneo de gruñidos, campana, volumen, ambiente por cuarto.
- `stats.js` — kills por arma, headshots, cuchillo, arma favorita, puntos ganados, daño, puertas, caja, reset,
  sensibilidad (escala y topes), menú inicio/pausa.
- `navcost.js` — flow field cada 250 ms (80 recálculos en 20 s a 60 fps), navegación con 24 zombies
  < 1 ms por frame (mediana), ninguno perdido, y el hash de colliders da lo mismo que recorrerlos todos
  (puertas cerradas, abiertas y caja mudada). **El número depende de la carga de la máquina:** el 2026-09-23
  la misma corrida dio ~0.33 ms y, horas después, ~0.61 ms, con `v2-f2.5` dando 0.60 en ese mismo momento.
  Para comparar versiones, correr las dos seguidas (`BHZ_FILE`).
- `map.js` — F1: puertas y precios, cada puerta abre exactamente lo que tiene detrás, spawns, límites de
  playa y muelle (frenan gente, no balas), el muelle tiene 2 celdas de ancho, la piscina (bajar y subir
  por la rampa; desde F2.6 se tira por el borde) y un zombie que sale por la rampa sin cruzar el borde
  (con las escaleras apagadas). F1.1: D13
  (precio, qué abre, que no abarata ninguna ruta, frena cerrada y se cruza abierta), puente con ≥2 celdas de
  ancho, plataforma con ≥5×4 celdas libres y bordes, lugar del PaP sin tocar el grid, spawns lejos del PaP
  y de la boca del puente.
- `pool.js` — F2.6: franja este navegable, 3 escaleras enlazadas, el origen del flow field nunca cae en la
  pileta con el jugador en la orilla, zombie en el fondo contra 5 orillas (caminando y corriendo) le pega en
  < 12 s con 0 strikes y sin cruzar el borde fuera de una trepada, zombie arriba baja, 6 a la vez salen
  todos, el jugador se tira desde 3 bordes y sale solo por la rampa.
- `grenades.js` — F2.7: +2 por ronda con tope 4, Max Ammo no recarga, cocinar bloquea disparo y cuchillo,
  mecha que queda al soltar, explota en la mano, daño propio con i-frame y letal, radio (4.9 sí, 5.1 no) y
  caída exacta, 800 en R10, no atraviesa paredes, almas y estadísticas, rebote contra pared/piso/pileta/
  techo, 500 tiros al azar sin quedar adentro de un collider ni cruzar paredes, pools, reset.
- `pathfinding.js`: no cuenta como "en pared" a un zombie trepando una escalera (cruza el borde de la
  pileta a propósito; con todas las puertas abiertas a veces spawnea uno en R8). Muestra el detalle por
  tag y estado.
- `gaits.js` — 1.6 / 2.6 / 4.0, nadie más rápido que `PLAYER.speed` (ni con variación, ni con un paso
  mal configurado, ni con la separación), mezcla por ronda (4000 sorteos, ±3%), spawn con la tabla, respawn
  conserva paso y vida, inclinación y ritmo por paso.
- `enemies.js` — F4: spawns del mar, ~25% ahogados solo en playa/muelle desde R6, vida/paso/piel, gotas
  (sin pasar el piso, reset), arrastrado (40% en piernas, torso no cuenta, lento, pega, respawn, pool
  vuelve con dos piernas, golpe letal no lo arrastra), perros (primera ronda 5–7, 4+4, cartel, noche,
  solo perros, tope de vivos, ≤ `PLAYER.speed`, relámpago, Max Ammo solo del último, la escena no crece,
  amanece exacto, mordida 13 cada ~0.6 s, headshot), tecla K, reset.
- `garden.js` — F5.6: plantas (sobre la pasarela, maceta sólida arriba, aviso a 2.2 m, mordida letal a 1.1 m
  y no a 1.35, Quick Revive + cooldown, desde abajo no, zombies no), perros del jardín (R4 no, R5 sí, máx 3 por
  partida, solo en R13, reset, `DOGS.enabled`), cercos (sólidos, frenan balas), reset.
- `quest.js` — F5.5: taller sin cambiar el grid y alcanzable, coco (palmera sorteada, solo machete, se
  voltea, cae a la playa y se pone dorado, 1 vez),
  cuerda (solo del boss, 1 vez), caracola (solo granada en el agua del final del muelle, flota a un lugar libre),
  armado (piezas, mantener F, soltar corta), arma (cono, 2500, empujón, paredes, boss ×0.4 sin insta-kill),
  Quick Revive la devuelve a la mesa con su munición, reset.
- `f513.js` — F5.13: salida del piso en 2 s, templo (cima, rampas, PaP arriba, base que frena), río y puentes,
  mudanzas, torre de salvavidas, borde x −75, cabeza del calamar (sube, se abre en la R13, O, reset), entrada
  del búnker.
- `f514.js` — F5.14: almejas (lugares, colores cada 3–4 rondas, mantener F, pesos, cada premio, calamar grande
  lento, pieza), fumigador, Ola 12 m ±40°, reset y pools.
- `buildcheck.js` — `index.html` al día con `src/`, ningún `.js` fuera de ORDER, script clásico sin
  import/export, se abre con doble clic.
- `props.js` — sólidos con collider y caja invisible, decorativos sin nada, grid bloqueado debajo, los 7
  cuartos conectados, spawns/wall buys/spots de la caja alcanzables, el jugador choca, las balas frenan
  (y por encima del sofá pasan), el zombie rodea un sofá sin pisarlo.
- `theme.js` — el tema no toca la lógica (ver sección Tema). También verifica que animarlo no crea objetos y que
  los draw calls estáticos no suben.
- `generators.js` — F2.5: 8 objetos en su cuarto sin cambiar el grid y alcanzables; el generador se prende
  solo con el cuchillo (la bala le pega y no); almas por bala y por cuchillo dentro del radio, no fuera ni
  a través de la pared, sí dentro de la pileta; cajas independientes con tope; PaP bloqueado si falta
  cualquier generador o cualquier alma; se prende por el 4to generador o por la última alma; carteles,
  barra de sangre, `resetGame()` y pools (la escena no crece).

Si agregás estado o funciones que un test necesita, exponelas en la línea `globalThis.G = {...}` de `harness.js`.

## Balance V1 (spec)
- Vida zombie ronda n: `150 + (n-1)*100` hasta 1050 en R10; **F4:** desde R11, `1050 × 1.1^(n-10)` (R15 1691,
  R20 2723) · Cantidad total: `6 + 2n` **sin tope** (F4) · Vivos a la vez: 8, y desde R8 +1 por ronda (R8 9,
  R12 13) hasta el pool (24), `maxAliveFor(n)`.
  Consecuencia: la granada (300 + 50n) mata de un tiro hasta ~R10; en R15 deja a uno con 641.
- **Velocidad (F2.6, reemplaza `min(2.0 + 0.08n, 4.5)`):** 3 pasos en `ZOMBIE.gaits`: caminar 1.6 · trotar 2.6 ·
  correr 4.0 m/s, ±10% por zombie. Mezcla por ronda (`gaitByRound`): R1–4 caminan · R5 80% trotan, 20% caminan ·
  R6–8 trotan · R9–11 60% trotan, 40% corren · R12+ corren. Se sortea al spawnear y **el respawn conserva el paso**.
  **Regla dura (Diego): ningún zombie va más rápido que el jugador caminando (`PLAYER.speed`, 4.4). Igual sí.**
  **Única excepción (F5.8, aprobada por Diego): los perros, a `DOGS.speed` 4.7 (`speedCap`).**
  correr × 1.1 = 4.4, y `zombies.js` recorta a `PLAYER.speed` en el spawn y en el empujón de separación.
  Si se sube `PLAYER.speed` o un paso, la regla sigue valiendo sola. Absorbe al "Corredor" de F4.
  Visual mínimo por paso (inclinación, ritmo y rebote del bob, brazos); la animación real es F7.
- Puntos: 10 impacto, 60 kill, 130 headshot-kill · Jugador 100 HP, regenera tras 4 s · Zombie 25 dmg, cooldown 1 s
- Rondas: 1 spawn cada 1.5 s, máx 8 vivos (hasta R7), pausa 8 s

## Enemigos (V2 F4) — `src/enemies.js`, `CONFIG.DROWNED/CRAWLER/DOGS`
- **Tipo:** `z.kind` en el mismo objeto de zombie. `resetZombie(z, sp, keepHealth, kind)` lo pone; el respawn
  conserva tipo, vida, paso y si se arrastra. Piel y camisa se repintan en cada spawn (el pool se reusa).
- **Ahogado:** desde R6, con el jugador en la playa o el muelle, 25% de los spawns salen de 4 puntos de la
  orilla (`SPAWN_POINTS[].sea`, z −22.5: la celda de −23.5 la bloquea el límite del mar).
  - Los spawns del mar no miran si los ves (salen del agua a la vista), pero piden 8 m de distancia.
    Los normales nunca usan esos puntos.
  - Vida ×1.5, siempre camina, piel verdosa.
  - Gotea: un solo `THREE.Points` con 48 gotas, invisible si no hay ninguna.
- **Arrastrado:** los golpes en las piernas (`userData.leg`, 6to parámetro de `damageZombie`, lo pasan
  `traceShot`, `tracePierce` y el cuchillo) se suman en `z.legDmg`. Al llegar al 40% de su vida máxima, si
  sigue vivo, `startCrawl`: 1.0 m/s, acostado, sin la pierna derecha y sigue pegando.
  - La pierna va a escala 0.001, no solo `visible=false`: el raycaster de r128 no mira `.visible`.
  - Granada, Ray Gun y lanzallamas no cuentan como pierna. Los perros no se arrastran.
- **Perros:** pool propio (`DPOOL`, 4 poodles + 4 chihuahuas blancos con puntos negros), con la misma forma
  de objeto que un zombie: `armL/armR` son las patas de adelante y `legL/legR` las de atrás.
  - Viven en `state.zombies`, así que usan el flow field, la IA, el daño, las almas y los drops de siempre.
  - Radio, daño (13), cooldown (0.6 s) y alcance propios: `K` en `updateZombies`.
  - Velocidad 4.2 ±5%, **con tope en `PLAYER.speed` igual que los zombies** (decisión: la regla no tiene
    excepciones).
  - Cada perro: 6 partes que reciben balas + 2 mallas de detalle fusionadas (`MeshBuilder`) = 8 draw calls.
- **Ronda de perros:** la primera en R5–7, después cada 5–7 (`roundState.nextDog`, se sortea en
  `resetEnemies`).
  - `queueRound` muestra **"¿QUIÉN DESPERTÓ AL CHICHARITO!?"** en vez de "RONDA n" y ya va haciendo de noche.
  - Solo perros: `min(6 + n, 24)`, máx 8 vivos, uno por segundo, cada uno con relámpago y trueno.
  - El último suelta un Max Ammo seguro (`onZombieDeath`). Al terminar, amanece.
- **Noche:** `NIGHT` interpola intensidad y color de `WORLD.hemi`/`sun`, el color de la niebla y el tinte del
  cielo (2.5 s). El relámpago suma un destello a la luz del cielo. **Ninguna luz nueva.** Las lámparas de
  adentro no cambian, así que de noche la casa se ve más iluminada que afuera.
- **Tests:** el harness pone `CONFIG.DOGS.enabled = false`, para que un test que corre rondas no se cruce
  con una ronda de perros al azar. `enemies.js` la prende.

## El Sombrerón (V2 F5) — `src/boss.js`, `CONFIG.BOSS`
- **Es un objeto de zombie más** (`z.boss`, `kind 'boss'`) y vive en `state.zombies`: flow field, escaleras,
  watchdog, `damageZombie` y `onZombieDeath`. Se construye una vez (`buildBoss`).
- **Radio de choque 0.35, como un zombie:** así entra por las puertas de 2 m y el anillo pegado a las paredes.
  Solo el modelo es grande (~2.6 m más el sombrero), y por eso roza los marcos.
  - `bodyRadius` 0.6 es solo para que el jugador no se le meta adentro.
  - Frena a `bodyRadius + PLAYER.radius` (`steerZombie`): si no, te empuja con el cuerpo todo el tiempo.
- **Sale en la R12 y cada 8 rondas** (`isBossRound`). Aparece desde la playa, cerca del agua, con la niebla
  cerrándose (`fog.far` 130 → 32 y vuelve en 6 s). Si la playa no se alcanza (D11 cerrada), sale del spawn
  abierto más lejano por camino, fuera de vista.
  - Con el boss vivo, los zombies salen a la mitad de ritmo (`spawnSlow`).
  - La ronda no termina hasta matarlo (`bossPending` y `state.zombies`).
  - Si los perros caen en su ronda, se corren a la siguiente (`dodgeDogs`).
- **Vida** 4000 + 800 × ronda, con barra arriba (`#bossbar`, y una línea fina con lo que falta para voltearle
  el sombrero). **Insta-kill hace el daño normal.**
- **Sombrero:** partes con `userData.part = 'hat'` (ala de 1.7 m y copa), daño ×3.
  - Con el 25% de su vida en daño al sombrero, `knockHat`: sale volando (`scene.attach`), cae al piso, se
    esconde a los 12 s y ya no está en `hitParts`.
  - `resetBoss`/`spawnBoss` lo vuelven a poner en la cabeza.
- **Velocidad por vida (F5.5b, pedido de Diego):** `bossSpeed(z)` va de `speedMin` 1.6 con la vida llena a
  `speedMax` 4.4 (= el jugador caminando) al llegar al 25% (`fastFrac`), parejo, y ahí se queda.
  `bossDamaged` y `bossTick` la recalculan. **Nunca más rápido que `PLAYER.speed`** (decisión de Diego).
- **Fases** (`z.phase`):
  - Fase 1: golpea el piso y tira guitarras.
  - Fase 2, sin sombrero: además silba y llama zombies.
  - Fase 3, debajo del 25% (si todavía tenía el sombrero, se le cae): embiste a 4.4.
  - Fase 4, debajo del 10% (`gunFrac`): minigun de cocos. Ya no tira guitarras ni embiste; golpea el piso, silba y
    llama igual.
- **Acciones** (`z.act`; mientras hay una, `bossTick` maneja el frame, sin flow field ni watchdog):
  - `slam` (F5.5c, pedido de Diego: como el Margwa de Shadows of Evil; **reemplaza al barrido**, que nunca
    pegaba):
    - Arranca si estás a menos de 2.5 m (`slamRange`). Levanta los dos brazos 0.7 s y golpea el piso (`bossSlam`).
    - Onda de 3.5 m (`slamRadius`) alrededor suyo, en su nivel y con línea libre: 50 de daño y empujón de
      ~2 m hacia afuera, con colisión (`player.pushT`).
    - **El escudo no la para** (viene del piso). Cooldown 1.8 s.
    - Se ve un anillo en el piso (`BOSS.ring`, creado una vez) y tiembla la cámara.
    - Para esquivarla: alejarte más de ~1.4 m durante el aviso.
  - `whistle` (fase ≥2, cada 12 s, 1 s de aviso): `player.dazeT` 2 s. Sensibilidad y velocidad ×0.5, y
    `blur()` CSS sobre el canvas.
    - **Solo de cerca** (F5.5c, pedido de Diego: con 25 m aturdía en todo el mapa): a menos de
      `whistleRange` 8 m y en su nivel (`inWhistle`).
    - Si estás más lejos no silba y reintenta cada 0.5 s. Si te alejás durante el aviso, te salvás.
  - Invocación (fase ≥2, al entrar y cada 25 s): 4 zombies del pool alrededor (a 2 m, celdas navegables con
    línea libre), fuera del total de la ronda.
  - `windup` → `charge` (fase 3, cada 6 s, con línea libre al jugador a menos de 16 m, los dos en el piso):
    0.7 s de aviso y embiste en línea recta a 4.4 m/s, hasta 14 m.
    - Si avanza menos de la mitad de lo esperado en un frame (pared, mueble, reja, límite), queda
      **`stun` 2 s**. **No rompe muebles** (decisión: los muebles están fusionados por cuarto).
    - Se puede deslizar por el costado de un mueble o una cerca sin frenar, pero nunca cruza una pared (el
      test mira cada paso, salvo los de la escalera de la pileta, que cruzan el borde a propósito).
    - Atropello: `chargeDamage` 40 a menos de `chargeHitRange` 1.4 m. El escudo lo para.
  - `throw` (fases 1–3, cada 4 s): la guitarra. Ver abajo.
- **Por qué antes nunca pegaba:** el barrido pedía menos de 2 m y avisaba 0.45 s. A 1.6 m/s, retrocediendo
  nunca te alcanzaba. Ahora tiene ataques a distancia, el golpe al piso cubre 3.5 m y, con poca vida, va a tu
  misma velocidad.
- **Guitarras y minigun (F5.5b):**
  - Las dos piden los dos en el piso, entre 5 y 20 m, con línea libre (`canShootAt`).
  - Son proyectiles propios en pools fijos (3 guitarras, 24 cocos). Frenan en paredes, muebles, rejas y el
    piso (`projBlocked`), pero no en los límites invisibles. Se prueba contra el cuerpo del jugador (segmento
    pies-ojos, `projHitsPlayer`).
  - El escudo equipado de frente los para: `shieldBlocks` con el boss como origen.
  - **Guitarra** (`throwGuitar`): 0.6 s de aviso (brazo atrás) y la tira en arco (18 m/s horizontal, gravedad
    9.8). Apunta **adelantando tu velocidad**, así que caminar derecho no alcanza: hay que cambiar de rumbo.
    30 de daño y un empujón de ~1 m. De lejos el arco llega a ~3.4 m: no pasa los 4 m de los techos.
  - **Minigun** (`bossGun`, `z.gun`):
    - No es una acción: camina mientras gira y dispara, a la mitad de velocidad (`gunWalkMul`), con el torso
      girado hacia vos.
    - 1 s girando (aviso), ráfaga de 2.5 s a 8 cocos/s y 2 s de pausa.
    - 10 de daño por coco (F5.5c: Diego lo bajó a la mitad) **ignorando el i-frame** (con el i-frame no
      mataba). Rectos a 30 m/s, con dispersión de ±0.06 rad y **sin adelantar**.
    - Quieto a 8 m igual te mata en una ráfaga (hasta 200). A 15 m corriendo de costado casi no te pega.
  - Una guitarra en el aire cuando muere el boss igual cae y puede pegar.
- **Muerte** (`bossDeath`, desde `onZombieDeath`):
  - Max Ammo en el piso.
  - `freePerk()`: uno al azar que no tengas, aunque no haya power; no cuenta el QR si su máquina ya no está.
  - 1000 puntos fijos, que el doble puntos no duplica. Con 4 perks o sin ninguno disponible, 1000 más en
    vez del perk.
  - `STATS.bosses++`.
- Al morir suelta la cuerda de guitarra de la quest (F5.5, `dropString`), una vez por partida.
- Test: `boss.js`. Cubre:
  - rondas y perros;
  - aparición con la playa abierta y cerrada, y la niebla;
  - llega desde la playa a los 9 cuartos sin strikes;
  - golpe al piso: aviso, daño, onda (3.3 m sí, 4.2 m no), empujón, el escudo no lo para, no atraviesa paredes;
  - sombrero ×3 y fase 2;
  - insta-kill;
  - invocación y silbido (a 10 m no silba, a 6 m sí, alejarse durante el aviso te salva);
  - embestida: velocidad, atropello, choque y aturdido, y 60 embestidas al azar sin cruzar paredes;
  - mitad de ritmo, recompensa y reset;
  - F5.5b: velocidad por vida (1.6 → 4.4 al 25%, nunca más);
  - guitarras: aviso, 30 de daño, arco bajo el techo, esquivarla de costado, adelanta, escudo, rango, paredes;
  - minigun: fase 4 al 10%, sin guitarras ni embestida, aviso de 1 s, mata quieto a 8 m, a 15 m corriendo
    te salvás, ráfaga y pausa, mitad de velocidad, escudo, sin línea libre no gira, sin objetos nuevos.

## Quest de la Ola Rompiente (V2 F5.5) — `src/quest.js`, `CONFIG.QUEST`, `CONFIG.WEAPONS.wave`
- **Piezas** (`state.quest`), en cualquier orden, cada una una vez por partida. Las del piso se recogen con F
  desde su cuarto **y su nivel**, al punto, como las del escudo. Sin collider: no tocan el grid.
  - **Coco** (cambio de Diego tras probarlo): por partida se sortea 1 de las 4 palmeras (`QUEST.palm`, en
    `resetQuest`), sin ninguna marca.
    - Solo un golpe de **machete** a su tronco la voltea: `meleeAttack` → `hitPalm`, que reconoce la caja
      invisible del prop `palmaN`. Cuchillo, balas y granadas no; a otra palmera, golpe seco.
    - Se voltea hacia donde se inclina en 1.5 s (acelerando): `THEMEFX.palms[i].rotation.z`, sin tocar el
      collider, que queda como tocón.
    - El coco cae de la copa a la arena (`cocoSpot`, recortado a `cocoArea`: la de la esquina SO caería al mar)
      y pasa de marrón a dorado con brillo.
    - `theme.js` dibuja las 4 palmeras desde `CONFIG.QUEST.palms`, cada una en su grupo (+3 draw calls). Sin
      tema, la palmera no se ve pero el coco cae igual.
  - **Cuerda:** `bossDeath` → `dropString`, donde muere el Sombrerón. Un segundo boss no suelta otra.
  - **Caracola:** `explodeAt` → `shellFromGrenade`. Cuenta si la granada explota en `shellZone` (el agua
    alrededor del final del muelle) **y fuera de todo cuarto**. Sale del agua, flota a 1.2 m/s hasta el
    punto más cercano de `QUEST.deck` y queda ahí. `QUEST.deck` son puntos del borde del muelle, metidos
    0.8 m y lejos de todo collider (PaP y generador).
- **Taller de tablas** (pedido de Diego: se arma ahí, no en el garaje). Está en la esquina NO de la playa,
  contra la cerca, en `CONFIG.QUEST.workshop`.
  - La mesa es un `relicBody`: collider y hitMesh invisibles, dentro del anillo no navegable, así que **no
    cambia el grid** (`quest.js` lo compara).
  - El resto es un `MeshBuilder`: tablas contra la cerca, estante sobre el límite oeste, toldo en voladizo
    **sin postes adelante** (un poste ahí cortaba celdas) y cartel.
  - Con las 3 piezas, mantener F 3 s. Comparte la barra `#craft` con el escudo: `updateQuest` va después de
    `updateShield` y la pisa solo mientras arma.
- **"Queda armada"** (decisión de Diego): la Ola entra al inventario como un arma más (reemplaza la equipada si
  tenés 2). `QUEST.slot` es **el mismo objeto de slot** para toda la partida:
  - Si lo perdés (Quick Revive → `loseWave`, o la cambiaste por otra), vuelve a la mesa y se saca con F con la
    munición que tenía. Así no sirve como recarga gratis.
  - `haveWave()` también la cuenta si está en el Pack-a-Punch.
- **El arma** (`def.wave`, `fireWave`):
  - Cono de 8 m y ±30°, como el lanzallamas (punto del cuerpo más cercano al eje), con línea libre y en tu
    nivel.
  - Daño 2500 a cada uno, y empujón de 4 m a 2 m (de cerca a lejos) de a pasos con `moveCircle`.
  - **Al Sombrerón le hace ×0.4 (1000) y no lo mueve.** Insta-kill no cambia eso (decisión de Diego: daño alto,
    no insta-kill).
  - 12 de cargador, 36 de reserva. No cuenta para la precisión.
  - PaP: MARENA'S TSUNAMI (5000 de daño, 18 / 54).
  - La ola que se ve es un cilindro abierto (solo el arco del cono), creado una vez, que se abre y se apaga.
- Draw calls "todo visible" en `theme.js`: 193 (164 antes de F5.5). Casi todo está oculto: los modelos de la
  Ola en la mesa y en la bandeja del PaP, la ola, la cuerda, la caracola, el coco, las guitarras, los cocos y
  la minigun. Siempre visibles: +5 (taller, cartel y 3 palmeras más, porque ahora van separadas).
- En Node las cajas de los props no tienen `matrixWorld` hasta un `scene.updateMatrixWorld(true)`: el test
  lo llama en `fresh()` para que el rayo del machete las toque. En el juego lo hace el render.
- Test: `quest.js`.

## Jardines, techo y muelle (V2 F5.6) — `world.js`, `src/garden.js`, `CONFIG.GARDEN`
- **Bug de la cama (y cualquier mueble):** parado en el medio de la cama, los zombies llegaban al borde y no
  te alcanzaban. El golpe llega a 1.2 m y del borde al medio hay ~1.4, y el tramo directo no se activaba
  porque la cama "tapaba". Fix:
  - `playerOnTop()` da la altura de tus pies si estás arriba de algo. Con eso, `segmentClear` ignora lo que
    está debajo en tres lugares: el origen del flow field (`nearestNav(..., minTop)`), el tramo directo y el
    golpe.
  - Arriba de un mueble, el golpe llega a `ZOMBIE.attackRangeOnTop` (1.9): te agarran de las piernas.
  - Test en `climb.js` (cama y sofá), verificado apagando el fix.
- **Power:** la palanca pide los **4 generadores** (`powerMissing()`, el cartel dice cuántos faltan). Diego
  lo pidió: antes se prendía sin ninguno.
- **Muelle:** tronco hasta z −44, plataforma z −50..−44 (PaP en (0, −49.5), generador al este), segundo tronco
  por x −17 con su reja D18 y una pasarela que lo une a la plataforma: queda un circuito.
  - El límite del mar tiene un hueco en x −19..−15.
  - La caracola sale del agua alrededor de la plataforma nueva (`shellZone` z −56..−43).
- **Jardín Oeste (R12):**
  - Pasto (`TEX.grass`) y cerco de arbustos de 2.2 m (`hedge`: frena gente y balas, el tema no le pone piel).
  - Solo se entra por la reja D14 o bajando la escalera 2.
  - El taller de tablas está al fondo, contra la pared oeste del garaje. La caja de la playa se corrió a
    x −17, porque tapaba la reja.
- **Jardín Trasero (R13):**
  - Puertas D15 (piscina), D16 (sótano) y D17 (pasillo).
  - Lugar nuevo de la caja (10, 39.45) y la pared del rifle (afuera de la pared norte del dormitorio).
- **Perros del jardín trasero** (`spawnGardenDog`, desde `updateRounds`):
  - En una ronda normal desde la R5, con vos en R13, el 20% de los spawns sale como perro desde un spawn
    del jardín (`pickSpawnPoint(sea, room)`).
  - **Máximo 3 por partida** (`roundState.gardenDogs`, lo resetea `resetGarden`).
  - Sin noche ni Max Ammo. Respeta `DOGS.enabled` (los tests de rondas no los ven).
- **Techo = una pasarela** (`UP.walk`, ~290 m² de 958; Diego pidió un tercio): sobre la caseta y el
  dormitorio, bajando por la cocina y sobre la sala.
  - `UP.mask` sigue siendo todo el techo sólido (`roofAt`, `levelAt`, granadas). `UP.walkMask` dice dónde
    se camina, y las celdas de arriba del grid salen de ahí.
  - `buildRoofEdges` recorre la pasarela:
    - si del otro lado hay techo, pone una **baranda de madera** (`roofrail`: collider y hitMesh
      invisibles, más el dibujo en un solo `MeshBuilder` con los tablones del piso);
    - si hay aire libre, deja el borde abierto (te tirás), como antes;
    - si hay vacío, un límite invisible.
  - **Escalera 2** (`UP.stairs2`, sube hacia +x hasta el techo de la sala) desde el jardín oeste. Las
    escaleras están generalizadas en `UP.flights` (`dir`, `flightH`, `inFlight`): rampa del jugador, costado
    que frena, enlace `NAV.link` con `via` y escalones.
  - **Plantas carnívoras** (10, en zig-zag, `CONFIG.GARDEN.plants`):
    - la maceta es un collider de arriba sin mesh (los zombies la rodean, no se pisa);
    - a 2.5 m se abren y te miran; a 1.2 m muerden con `damagePlayer(9999)`. Respeta el i-frame: con Quick
      Revive revivís y tenés 2 s para irte. Cooldown 1.5 s;
    - a los zombies no les hacen nada;
    - 2 mandíbulas animadas por planta (20 draw calls) y los tallos en un mesh.
  - **Doble cañón en el techo:** `WALLBUYS[].level: 1`. El tablón y la tiza suben `UP.y`, y el poste va a lo
    largo de x si `axis: 'z'`.
    - `updateInteract` mira tu nivel: arriba solo ofrece lo de arriba (pared y piezas de la quest).
    - Antes, parado en el techo, se podían comprar puertas de abajo.
- Draw calls "todo visible" en `theme.js`: 246 (193 antes). Se suman plantas, cercos, pisos de los jardines,
  los 15 escalones de la escalera 2 y la pasarela. **Falta medir FPS en el navegador.**
- Tests: `garden.js` (nuevo), `roof.js` (reescrito para la pasarela), `map.js` (muelle, jardines, Dijkstra con
  el techo), `climb.js` (cama), `perks.js` (power), `weapons2.js` (doble cañón arriba).

## Ajustes del playtest de F5.6 (V2 F5.7) — manda sobre lo de arriba donde se contradice
- **Plantas:** quedan 4, una por esquina de la pasarela: (23, 27), (9, 27), (17, 5) y (−7, 5).
  - Cabeza ×2 (`headScale`).
  - **Muerden 30** (`plantDamage`, respeta el i-frame, cooldown 1.5 s). Ya no matan.
- **Techo:** `UP.walk` = caseta y dormitorio + bajada + **toda la cocina** + **la sala hasta su borde sur**
  (416 de 958 m²).
  - El borde este de la cocina da al patio de la piscina, y el sur de la sala al porche: los dos quedan
    abiertos (te tirás).
  - Escalera 2 de **4 m** de ancho (z 9..13).
- **Caídas proporcionales** (`fallDamage`; reemplaza "te deja en 10"):
  - nada debajo de `fallHeight` 2 m;
  - de ahí a `fallMaxDrop` 4.3 m, parejo hasta `fallMaxDmg` 60 (del techo, con 100, quedás en 40);
  - nunca mata (deja 1 como mínimo). La pileta (1.6 m) no lastima.
- **Jardín Trasero:**
  - Se sumó el cuadrado x 24..31, z 20..30 (el de arena entre la caseta y el pasillo exterior), sin los dos
    cercos que lo cerraban.
  - Fuente sólida en el medio (prop `fuente`, `GARDEN.fountain`; el dibujo va en `garden.js`).
  - Stamin-Up contra la pared este de la caseta.
- **Jardín Oeste:**
  - Frente al taller va hasta x −27 (NAV.minX −28).
  - La caja de almas **'sotano'** está acá (24.2 m de la del pasillo). La clave no cambia: `state.souls` es
    nombre fijo.
  - **Portón D19** en la pared oeste del sótano (z 35..37). `door.power`: no se compra (el cartel dice
    "Portón - se abre con la energía") y `turnOnPower` lo abre.
  - Dijkstra de precios lo ignora: la energía pide los 4 generadores y llega tarde.
- **Palmeras de adorno** (`GARDEN.palms`: 3 en la playa, 3 por jardín), con tronco sólido en `PROPS`
  (`palmaJn`). El coco sigue saliendo solo de `QUEST.palms`.
- **Muelle:**
  - Plazoleta de 8×8 (x −14..−6, z −50..−42) en el medio de la pasarela, con el **PaP en su centro
    (−10, −46)**. Ya no está contra un borde: bloquea sus celdas y se rodea (`map.js`).
  - La caja R10 de la playa quedó en x −17 (en −12 tapaba la reja D14).
- **Pirañas zombis** (`GARDEN.piranhas`, en `garden.js`):
  - Hay 3 zonas: la primera mitad del tronco principal, la del segundo tronco y el puente C13.
  - Cada zona tiene 3 carriles. Cada segundo salta una (rotando carriles: cada carril, cada 3 s) de un
    costado al otro, en arco y alternando el lado.
  - Si te toca: 25 (respeta el i-frame) y un empujón. A los zombies nada.
  - Pool fijo de 9 peces; son MeshBuilder con color por vértice.
- **Laguna este**: baja hasta el mar (solo visual, x 22..31).
- **Perros infernales** (`createDog`, pelajes 'negro' y 'sarnoso'):
  - ~1.6× más grandes, con costillas, carne expuesta, púas en el lomo, boca abierta con sangre y ojos rojos
    (MeshBasic).
  - `DOGS.radius` 0.32 y `attackRange` 1.1. La velocidad no cambia.
- `garden.js` (test) cubre plantas de 30, pirañas, fuente, portón, caja de almas y Stamin-Up. `roof.js`
  cubre la pasarela ancha, los bordes nuevos y la caída proporcional.

## Segundo playtest (V2 F5.8) — manda sobre F5.6/F5.7 donde se contradice
- **Bug de la rampa (trabado en la escalera del jardín oeste):** el costado de una rampa frenaba cualquier
  movimiento con el cuerpo tocando una parte alta, también el que te aleja. Bajando por el borde o cayendo al
  lado quedabas trabado.
  - Ahora solo frena si el movimiento te mete más adentro o más arriba: compara con la posición de antes, en
    `moveAxis`.
  - Test en `roof.js`.
- **Escalera 1:** ya no está en la piscina (sin descanso: `UP.landing = null`).
  - Está en el cuadrado del jardín trasero, contra la pared este de la caseta: x 24.2..29, z 24.9..26.5, sube
    al oeste.
  - `OPEN_LINKS`: jardín trasero ↔ jardín oeste por el techo.
- **Piscina hasta x 35:** el pasillo exterior de z 10..20 es piscina, D15 está en la pared norte
  (x 30.1..32.1), y Double Tap, la caja, la reposera y el macetero van en la pared nueva. Stamin-Up en z 22.
- **Barandas:** en todo el borde de la pasarela salvo `UP.gaps`: la llegada de las dos escaleras y 2 m de la
  cocina sobre la piscina (z 8..10).
  - Los tablones del techo salen de la máscara, por tiras: los rectángulos superpuestos parpadeaban.
- **Juggernog en el techo:** `PERKS.list.jugg.level = 1`.
  - `relicBody` acepta `sp.y`.
  - `updateInteract` mira el nivel de las máquinas.
- **Muelle:** sin plazoleta (sus pisos se superponían y parpadeaban; `map.js` ahora lo verifica). Queda un
  entrante x −13..−6, z −50..−48, con el PaP en (−9.5, −49).
- **Perros:** 4.7 m/s fijos. **Excepción aprobada por Diego a la regla dura** (`speedCap`).
  - Tres tamaños (`DOGS.sizes`: 1, 1.25, 1.5) que escalan modelo, radio (`z.rad`) y vida.
- **Plantas:** muerden desde 4 m (avisan a 5.5).
- **Escupitajo verde** (`GARDEN.acid`, `garden.js`):
  - quién escupe: las plantas (cada 12–20 s a menos de 10 m) y los ahogados (cada 8–12 s entre 5 y 15 m, con
    línea libre);
  - es un proyectil lento que se esquiva; si te toca, 15;
  - deja un charco de 1.5 m, 3 s, 10 por segundo (el primer tick espera 1 s si te acababa de tocar).
- **Arena mojada:** 4 rectángulos de 6×3 en la playa (`GARDEN.wetSand`). `wetSandMul` ×0.6 al jugador (en
  `updatePlayer`) y a los zombies (en `updateZombies`).
- **Pirañas:** orden al azar sin repetir carril. El puente tiene su propio arco (`out` 6, `height` 1.85,
  `flight` 1): pasa sobre la baranda y en el medio pega igual.
- **Fuente esquinera** en la esquina NE del jardín trasero (`GARDEN.fountain` = caja x1..x2, z1..z2).
- **Cajas de almas** sin el círculo rojo (`buildSoulRing` borrada).
- **Boss:** la niebla (`fogFar` 26) se cierra al aparecer y queda así toda la pelea. Se abre al morir.

## Trampas, calamares, Calamarón y clima (V2 F5.9) — manda sobre lo de arriba donde se contradice
- **Chicos:** Sombrerón con vida ×1.3 (`BOSS.health`). Los ahogados trotan (`DROWNED.gait 'jog'`).
  - Ojos (`bossEyes`, en cada golpe): naranjas, amarillos debajo del 20% y rojos con lágrimas debajo del 10%.
- **Varios bosses a la vez** (`boss.js`):
  - `BOSS.pool` tiene 4 Sombrerones y 1 Calamarón, construidos una vez (`createBoss(id, variant)`).
  - Cada uno lleva su sombrero volando (`z.hatFly`), su minigun (`z.gunModel`, `z.barrels`), sus ojos y sus lágrimas.
  - `BOSS.z`, `BOSS.hat`, `BOSS.gunModel` y `BOSS.barrels` siguen siendo alias del primer Sombrerón.
  - `spawnBoss(variant)` corre cada boss `spread` m al costado del anterior.
  - La barra muestra al más cercano, con su nombre.
  - La niebla sigue cerrada mientras haya alguno vivo.
- **Calendario** (`BOSS.schedule(k)`, `bossesFor(n)` → `roundState.bossQueue`, uno por frame):
  - R12: Sombrerón · R20: Calamarón · R28 y cada 8: 2 Sombrerones y 1 Calamarón.
  - `bossPending` sigue existiendo: es `bossQueue.length > 0`.
- **Calamarón** (`variant 'calamar'`, `BOSS.calamar`):
  - Tiene cabeza de calamar, piel morada y no tiene sombrero. Arranca en la fase 4, con la minigun, y con
    vida ×2 (encima del ×1.3).
  - Debajo del 30% tira calamares en arco (`throwSquid`, pool `BOSS.squids`). Al tocar algo explotan en un
    charco verde de 4 m que dura 5 s (`acidPuddle` con radio y vida).
- **Quest: la caracola ya no sale con la granada.**
  - Está sobre una tortuga bailarina de piedra en el techo del sótano (−10.2, 32.3). Ese techo no se
    camina: se le tira desde la pasarela de la sala.
  - Su caja de tiro invisible está en `hitMeshes` (`type 'questShell'`, sin collider). Opaca, la bala le pega
    como a una pared.
  - Brilla cuando 3 plantas (`QUEST.plantsNeeded`) se comieron 6 arrastrados cada una (`PLANTS[].fed`).
  - Mientras brilla, la tortuga baila. Un tiro (`traceShot`/`tracePierce` → `shootShell`) la tira en arco a
    `QUEST.shellLand` (jardín oeste), donde se recoge con F.
  - **Las plantas comen solo arrastrados que están en el techo** (nivel 1), a menos de `GARDEN.plantKill`, uno
    cada 1.5 s, sin puntos. Las plantas están arriba: uno de abajo quedaría del otro lado del techo. Con 6,
    cambian a las mandíbulas alienígenas (moradas, dientes verdes, antenas con ojos), que se construyeron
    ocultas.
- **Trampas** (`src/traps.js`, `CONFIG.TRAPS`):
  - La palanca va sin collider y se usa con F desde su cuarto, al punto. La luz está verde si está lista.
  - Estados: `idle → on (time) → cool (cooldown 60 s)`.
  - Matan con `damageZombie(..., 0, 0)`: sin puntos, pero cuentan para la ronda y las almas. Al boss no le
    hacen nada.
  - **Tiburón** (muelle, 1500, 10 s): salta de un costado al otro del tronco, cada salto a la z de un zombie
    del muelle. Come lo que toca sobre las tablas, y a vos te saca 20 una vez por salto.
  - **Cortadora** (jardín oeste, 1000, 20 s): da vueltas en un círculo de 4 m delante del taller. Mata lo
    que toca y a vos te saca 40 cada 1 s.
- **Cielo por ronda** (`setSky(n, mob)` en `startRound`/`queueRound`, `CONFIG.WEATHER`):
  - Oscuridad `darkBy(n)`: de R1 a R15 va de 0 a 1.
  - Truenos: R15–R20 y R25+. Neblina morada: R21+. Lluvia: R25+.
  - En las rondas de mobs: noche, lluvia y rayos cada 3–7 s.
  - La neblina morada tiñe niebla, cielo y hemisférica (`NIGHT.p`) y acerca la niebla a 60 m. `updateBoss`
    usa `weatherFogFar()` como destino sin boss.
  - Lluvia: un solo `LineSegments` de 500 gotas alrededor del jugador, creado una vez. Frena en los techos
    (`roofAt`), mirado en cada frame porque el viento la mueve.
  - **Ojo:** después de una ronda de perros ya no vuelve el día, vuelve el cielo de esa ronda.
- **Calamares** (`enemies.js`, `CONFIG.SQUID`, pool `SQPOOL` de 8):
  - Son el mismo objeto que un zombie (`z.squid`): `armL/armR` son los tentáculos de adelante y
    `legL/legR` los de atrás. Van acostados y reman.
  - Vida 2 × la del perro. Velocidad 4.3: más que un zombie corriendo, menos que el perro, y ≤ `PLAYER.speed`.
  - Radio de choque fijo de 0.4, aunque crezcan.
  - Tinta (`fireInk`): en arco, entre 3 y 13 m, con línea libre, cada 3–5 s. Pega `ink.damage` × `z.size`,
    el escudo la para, y mancha la pantalla (`#ink`) 2.5 s. El golpe cuerpo a cuerpo también escala con el
    tamaño.
  - Fusión (`squidTick` → `fuseSquids`): dos que se tocan se juntan en el más grande. Suma vida y máxima,
    `size = 1 + 0.2 × fusiones`, hasta 7 fusiones. El otro pasa a `dying` con `t=99`: se va al frame
    siguiente, sin puntos ni almas.
  - Salen del mar si la playa se alcanza; si no, de un spawn normal.
- **Rondas de mobs** (siguen cayendo en `DOGS.firstRound/every`, con `roundState.dogs`):
  - `mobKind(k)`: la 1ra perros, la 2da calamares, las demás mezcla.
  - **Cada 5ta (`MOBS.bossEvery`) son 4 Sombrerones** normales, sin otros enemigos (`total = 0`).
  - Cada una tiene su cartel. El Max Ammo lo suelta el último perro o calamar.
- Tests: `boss.js` (ojos, calendario, R28 con 3, Calamarón, calamares explosivos), `quest.js` (plantas, tortuga,
  tiro, caída), `traps.js`, `weather.js` y `squids.js` (nuevos), `enemies.js` (ahogado trota, cielo de la R6).

## Rancho, Kaboom y ajustes (V2 F5.10) — manda sobre F5.9 donde se contradice
- **Rancho de playa (R14, x −41..−27, z 18..40)**, pedido de Diego: el jardín oeste llega hasta x −41.
  - `NAV.minX` −42 (w 79).
  - Donde estaba el cerco oeste del jardín (x −27) va el **lazo D20**, que se compra a 1500 desde el jardín.
    - Es un bloque de 1.2 m con material `visible:false`: frena el paso y se dispara por encima (el raycaster
      no mira `material.visible`).
    - Los postes, la soga y el cartel son hijos del bloque (`buildRope`): al abrirse se van juntos.
  - Palapa abierta (`RANCHO.palapa`). Sus 4 postes, el billar y la barra son `PROPS` sólidos (`RANCHO.props`).
  - El dibujo va en `garden.js` `buildRancho`: techo de palma, deck, billar con bolas y tacos, barra con
    botellas y bancos, hamaca, tablas, red y boyas, carteles, y foquitos (1 `InstancedMesh` MeshBasic, sin luces).
  - Speed Cola se mudó al rancho, contra el cerco oeste. La caja tiene un lugar nuevo (`BOX.spots.R14`).
  - Hay 3 spawns en el rancho.
- **Tortugario** en la esquina SO, con un corral de 0.5 m (`RANCHO.corral`, tag `corral`).
  - Trampa de tortugas (`TRAPS.turtles`, `CONFIG.TRAPS.turtles`): 1500, 20 s, recarga de 60 s.
  - Salen 6, escalonadas. Cada una va al zombie más cercano del rancho (o del jardín con el lazo abierto),
    a menos de 14 m de la salida, y se lo come (`trapKill`, sin puntos).
  - Si se traba contra algo, camina de costado 0.8 s. No le hacen nada al jugador ni al boss. Al terminar
    vuelven al corral.
- **Kaboom** (power-up nuevo, `POWERUPS.types.kaboom`):
  - Al agarrarlo mueren todos los zombies vivos que no son boss, sin puntos ni drops (`KABOOM.active`).
  - Los cuerpos quedan en `dying` ardiendo `burn` 5 s (`z.burnT`), con llamas de un pool fijo (`KABOOM.flames`)
    y la piel al rojo.
  - Mientras arden no sale nadie (`roundState.spawnHold`). Después sigue la ronda.
- **Plantas:** ya no muerden (Diego no podía ni recargar). Siguen escupiendo.
  - Comer tiene animación en el mundo (`GARDEN.eat`, 1.4 s, `plantEatAnim` + `plantCarry`): se lanza, cierra,
    lo sube y mastica sacudiéndolo mientras el cuerpo se achica.
  - El arrastrado ya está muerto: `z.eaten` hace que `updateZombies` lo deje en la boca en vez de caer.
- **Calamar: chorro continuo** (`SQUID.ink`): echa 1.5 s (36 gotas/s en arco, cada una `dps/rate × tamaño`,
  **ignorando el i-frame**) y descansa 3 s. Corta si salís del rango o te tapás.
  - Quieto te saca ~25 de 30; moviéndote de costado, mucho menos.
- **Invocados:** tope de 6 vivos entre todos los bosses (`BOSS.summonMax`, `z.summoned`). El Calamarón llama 2.
- **Tecla O** (`debugUnlockAll`):
  - +15000, todas las puertas, los 4 generadores, la energía y las 3 cajas de almas llenas (se prende el PaP).
  - **No toca las plantas**: el paso de los arrastrados se hace a mano.
- **Langostino** bailando al lado de la tortuga, que ahora es ×2 (`QUEST.turtle.scale`, la caracola también).
  Aparece cuando las 3 cajas de almas están llenas.
- **Cielo:** estrellas (`STARS`, un `THREE.Points` sin niebla, se ven con la oscuridad). La neblina morada queda
  a 30 m y más morada.
- **Arena mojada:** ya no frena a los zombies, solo al jugador.
- Test: `f510.js`. `garden.js` ahora verifica que las plantas no muerden. `squids.js` tiene el chorro.

## Jardín norte, búnker, armas y langostino (V2 F5.11) — manda sobre F5.10 donde se contradice
- **Mapa:**
  - `NAV` va hasta z 85 (h 136).
  - El **rancho (R14) baja hasta el mar:** pasto en x −41..−24, z −4..18, y arena en x −41..−20, z −24..−4.
    - Sigue detrás del lazo D20.
    - Una cerca en x −20 lo separa de la playa (reemplaza al límite invisible `bound:playaO`).
    - El corral del tortugario ahora tiene cerca en los 3 lados.
  - **Jardín Norte (R15)** en x −27..35, z 40..55.7: se sacaron los cercos norte de los dos jardines.
    - `OPEN_LINKS` lo une a R12 y R13, así que no cambia ningún precio.
    - El rancho sigue con su cerco norte.
  - **Escalera 1 ×3** (z 21.7..26.5; `UP.walk` y `UP.gaps` desde z 21).
  - Stamin-Up pasó a la pared norte de la caseta (20, 30.45). La caja R13 pasó a la pared norte del dormitorio
    (7, 30.45).
  - Palapa de 4.5 m. `CONFIG.DECOR`: reposeras sólidas (`reposeraJn`), sombrillas, canteros; palmeras nuevas
    en `GARDEN.palms`.
- **Búnker (R16, `bunker.js`, `CONFIG.BUNKER`)**: x −38..−10, z 60..84, piso en y −8.
  - **No está debajo del sótano en x,z:** es una zona aparte bajo tierra, porque un tercer nivel de grid era
    mucho. `groundY` devuelve −8 adentro. La arena del tema lo tapa desde arriba.
  - `noFloor`: lo arma `buildBunkerShell` (en `buildMap`, antes del grid), con paredes, piso, techo y la
    plataforma del teletransportador como cajas invisibles.
  - El dibujo es MeshBasic, con la luz de los 4 focos **pintada por baldosa** (`bunkerLight`) y charcos de luz
    aditivos. **Ninguna luz nueva.**
  - Adentro: el teletransportador de BO apagado y en rojo, con cartel "FUERA DE SERVICIO"; Mule Kick; la
    bazooka en la pared este (`floorY`); dos spawns.
- **Escotilla** (jardín norte, detrás de la pared norte del sótano):
  - **Jugador:** F, fundido a negro (`#fade`) y teletransporte. Abajo, F al pie de la escalera para subir.
  - **Zombies:** `NAV.hatch` es un enlace del grid que solo existe con `BUNK.open` (lo arma `buildNavGrid`).
    - En `startClimb`/`updateClimb`, `c.hatch`: caminan a la tapa y quedan escondidos `climbTime` s. Mientras
      tanto el root se va a y −50, porque el raycaster no mira `.visible`.
    - Aparecen en la otra punta. Al bajar, **ojos rojos** (`setZombieEyes`); los que nacen en el búnker, también.
  - La lluvia no cae adentro (`inBunker`).
- **Estatuas de plantas** a los dos lados de la escotilla:
  - La maceta es un `PROPS` sólido (`estatuaN`). La cabeza sale de `makePlantHead` con el aspecto de piedra.
  - Despiertan con 5 calamares muertos a menos de 4 m (`statueKill`, desde `onZombieDeath`).
  - Despiertas **solo comen**: 6 arrastrados y 3 perros cada una, con la animación de F5.10 en el piso
    (`p.ground`).
  - Con las 2 (`openBunker`): se abre la escotilla (tapa, luz verde), se arma el enlace y aparece el
    **caballito de mar** en el techo del sótano.
- **Mule Kick** (`perks.mule`, 4000, en el búnker): `maxWeapons()` = 3.
  - Quick Revive te saca los perks, y la 3ra arma se pierde (`dropMuleWeapon`).
  - La 3ra arma se elige con Q, porque la tecla 3 sigue siendo el escudo.
- **Armas nuevas:** Uzi, AK-47, Desert Eagle, SPAS-12, Arco y Bazooka.
  - Todas en la caja. Ninguna en paredes, salvo la bazooka en el búnker.
  - **Arco** (`def.charge`): el clic empieza a cargar; al soltar (`updateBow` → `releaseBow`) pega de
    `chargeMin` a `damage` según la carga, y atraviesa 2.
  - **Bazooka** (`def.rocket`): cohete de un pool (`ROCKETS`) que vuela a 36 m/s y explota en lo primero que
    toca, con `explodeAt(..., opts)` (daño, radio, 60 de daño propio).
- **Caja:** el pool tiene todas las armas (menos la M1911 y la Ola) y `'monkey'`. Sortea con `BOX.weights`:
  la Ray Gun pesa 0.45.
- **Langostino bailarín** (`MONKEY`, `CONFIG.MONKEY`, en `grenades.js`):
  - 3 cargas de la caja, con la tecla 4 y la física de la granada. El Max Ammo lo recarga.
  - Cuando se queda quieto baila 8 s. El flow field sale de él (`monkeyLure` → `FLOW.lure`).
  - El boss usa `FLOW.pdist`, un segundo BFS hacia el jugador (`flowFrom`), así que sigue viniendo por vos.
  - El watchdog no cuenta como atasco al que espera al lado del langostino.
  - Después explota con el daño de la granada × 1.5, sin daño propio.
- **Calamar gigante** (`GIANT`, `CONFIG.SQUID.giant`), en las rondas de calamares y mezcla, si la playa se alcanza:
  - `giantRise` sale del mar con un rugido (`sfxGiantRoar`). Mientras sube no sale ningún calamar.
  - Después, `share` (75%) de los calamares los escupe en arco a la playa (`giantLaunch`); aparecen donde caen
    (`z.fromGiant`). El resto sale de la orilla. Se hunde cuando ya salieron todos.
  - La ronda no termina con un calamar en el aire (`giantBusy`).
- **Tortugas:** hasta la R10 matan de una; después, cada mordisco saca la vida de un zombie de la R10.
- La caracola pide las **4** plantas. El menú de Ajustes tiene "Números de daño" (`SETTINGS.dmgNumbers`).
- Tests: `f511.js`. `map.js`, `props.js` y `roof.js` se adaptaron (el búnker se abre para medir conexiones).

## Jungla, cercos que se queman y ajustes (V2 F5.12) — manda sobre F5.11 donde se contradice
- **Mapa cuadrado rodeado de jungla** (el sur es el mar). `NAV` = x −61..56, z −91..75 (117×166).
  - **R15 jungla norte:** x −60..55, z 40..74 (era el jardín norte).
  - **R17 jungla oeste:** x −60..−41, z −24..40.
  - **R18 jungla este:** x 35..55, z −4..40, más la arena x 20..55, z −24..−4 donde estaba la laguna que bajaba
    al mar (`theme.js` ya no la dibuja; queda la del puente, con sus pirañas).
  - `OPEN_LINKS`: R15 ↔ R17, R15 ↔ R18, R13 ↔ R18. Se sacaron los cercos que solo dividían jardines.
  - Borde de afuera: límites invisibles `bound:jungla`, tapados por dos filas de árboles afuera. La laguna del
    puente queda cerrada con `bound:laguna`.
- **Cercos que se queman** (`CONFIG.BURN`): son puertas (`state.doors`, `DOOR_LINKS`, `CONFIG.DOORS`) con `burn`.
  - H1 rancho ↔ jardín oeste, H2 rancho ↔ jungla norte, H3 rancho ↔ jungla oeste y H5 rancho ↔ playa (1500).
  - H4 playa ↔ jungla este (2000): así D11 + H4 = 3250, igual que D11 + D14, y la jungla no abarata los
    jardines (`map.js`).
  - `buyDoor` → `startBurn`: la puerta sigue cerrada mientras arde (`CONFIG.BURN.time`, llamas creadas una vez,
    el material propio se pone negro y el bloque se hunde). Al terminar, `updateBurns` llama a `openDoor`.
  - `debugOpenAllDoors` abre sin quemar. El lazo D20 queda como estaba.
  - Tramos fijos (tag `hedge`), porque hay cosas que se apoyan ahí y, quemado, cambiarían el grid
    (`mysterybox.js`, `generators.js`):
    - H1 se quema solo en z 10..18: en x −24, z −4..10, se apoya la caja de almas 'sotano'.
    - H2 solo en x −32..−27, y H3 solo en z −24..30: en la esquina NO del rancho están la caja y Speed Cola.
- **Jungla** (`CONFIG.JUNGLE`):
  - `planJungle` (al principio de `buildPropColliders`, con semilla fija) pone un árbol cada ~7.5 m en
    R15/R17/R18. Quedan lejos de los otros cuartos, los spawns, los cercos, la escotilla y la decoración.
  - Cada uno tiene un tronco sólido en `PROPS` (`arbolN`).
  - `buildJungle` dibuja árboles con copa en capas, lianas, palmeras curvas, helechos, rocas con musgo,
    flores, la franja tupida de afuera y niebla verde baja (planos transparentes). Pasto `jungle` más oscuro.
- **El búnker se mudó bajo el mar**, al sur del muelle (x −38..−10, z −90..−66), porque la jungla norte pisaba
  sus x,z. Todo lo de adentro usa z relativas. Tiene 5 agentes del FBI muertos (4 tirados y 1 sentado contra la
  pared), con sangre, placa, gorra y pistola.
- **Langostino:** `bounce` 0.12 y `landDamp` (frena en seco en el piso), halo aditivo que late, 10 s.
  `stepGrenade` acepta `g.bounce`/`g.friction`.
- **Calamar gigante:** escala 9, en (16, −46). Tiene 6 ojos más, púas, cicatrices, anillo de dientes y boca roja
  con un halo que late (más fuerte al escupir).
- **Ronda:** arriba a la derecha, encima del HUD, en números romanos (`roman`). `#effects` bajó a 74 px.
- Test: `f512.js`. `map.js` se adaptó (los costados de la playa son H4 y H5).

## Templo, cabeza del calamar y mudanzas (V2 F5.13) — manda sobre F5.12 donde se contradice
- **Kaboom** da siempre `1000 + 50 × (ronda − 1)` puntos (`POWERUPS.kaboom.points`). Los kills siguen sin dar.
- **Salida del piso:** todos los zombies tardan `emergeTime` 2 s y tiran tierra (`emergeDirt`).
- **Tecla O:** además abre el búnker y saca la cabeza del calamar (`SQHEAD.force`).
- **Templo estilo Tikal** en la esquina NE (`CONFIG.TEMPLE`, sólidos en `buildTempleShell`, dibujo en garden.js
  `buildTemple`):
  - La cima (x 46..55, z 65..74) está a `UP.y`: entra a la máscara del techo y a `UP.walk`, así el grid de
    arriba la cubre y los zombies suben por las **2 rampas de piedra** (enlaces `NAV.link`). `UP` creció a
    71×70.
  - Las rampas son `UP.flights` con `axis: 'z'` (la sur) y `stone: true` (`MAT.stone`, `TEX.stone`).
    `flightV` intercambia x↔z.
  - **El PaP está arriba** (`PAP.spot.y` = 4.3, `level: 1`). `relicBody` acepta `sp.y`.
  - Santuario con crestería encima (collider de arriba), cornisas, glifos, 8 antorchas con fuego aditivo que
    parpadea (`TEMPLEFX.flames`).
  - **Río en L** alrededor de la entrada (`TEMPLE.river`): las orillas son límites de 0.4 m (`bound:rio`), con
    el hueco de los **3 puentes** y límites a los costados de cada puente. El agua es solo dibujo: sus
    celdas quedan encerradas, no se llega. Pirañas en los 3 puentes (6 zonas; las zonas aceptan `axis: 'z'`).
  - `planJungle` no pone árboles en `TEMPLE.clear`.
- **Mudanzas:**
  - Juggernog al entrante del muelle, donde estaba el PaP.
  - Banco del escudo a la pasarela del techo (`SHIELD.bench`, sólido, tag `shield:banco`).
  - Taller de la Ola a la cerca de la playa (x 9).
- **Torre de salvavidas** (`CONFIG.LIFEGUARD`, x 8, z −16): 4 patas sólidas (`torreN` en `PROPS`), plataforma a
  2.6 m (se camina por debajo), cabina, techo rojo, bandera y cartel. El revólver se compra en su tablón.
- **Borde oeste en x −75** (`NAV.minX` −76) y lengua de arena **R19** (x −75..−41, z −60..−24) con el mar al
  sur y al este.
- **Cabeza del calamar muerto** (`CONFIG.SQUIDHEAD`, `SQHEAD`) en R19, con la boca al norte:
  - Sube por ronda (`squidRise`: 30% en la R1, entera en la R13) de a 0.6 m/s temblando
    (`setSquidHead` en `startRound`, `updateSquidHead`).
  - Hasta la R13 es un **montículo sólido**. En la R13 se cambia por las paredes de un túnel de 4 m y una
    cámara al fondo (`squidHeadSolid`, como una puerta: cambia `solid` y hitMeshes y llama `buildNavGrid`).
  - Adentro, saliva verde que brilla (MeshBasic). Tiene ojos muertos, pico con dientes, tentáculos tirados en
    la arena y el manto hundiéndose en el mar.
  - **Las 3 estatuas** (tortuga con la caracola, langostino, caballito de mar) están en la cámara y suben con
    la cabeza. La caracola cae enfrente de la boca (`QUEST.shellLand`). Antes de la R13 no se le llega.
  - `resetQuest` la entierra (`SQHEAD.force = 0`).
- **Rancho** en x −56..−42, abierto a la jungla oeste (R17). El lazo D20 quedó entre el jardín oeste y la jungla:
  cerrado, al rancho se llega dando la vuelta por la jungla norte. Tortugario más grande, contra el borde oeste
  del rancho.
- **Entrada del búnker:** mismo lugar y misma F. Ahora es un bloque de hormigón de 5.2 m (`BUNKER.entrance`,
  sólido `bunker:entrada`) con techo inclinado, franjas de peligro, bolsas de arena y cartel. Tiene dos
  puertas blindadas (`BUNK.halves`) que se corren al abrirse y una luz roja/verde. Carteles "Búnker
  cerrado" / "SE ABRIÓ EL BÚNKER".
- Test: `f513.js`. Se adaptaron `map.js`, `pap.js`, `generators.js`, `quest.js`, `garden.js`, `shield.js`,
  `enemies.js`, `f510.js`, `f511.js` y `f512.js`.

## Almejas, fumigador y Ola mejorada (V2 F5.14) — `src/clams.js`, `CONFIG.CLAMS`
- **Fumigador:** por partida sale en uno de `CLAMS.fumigator` (porche o playa, al azar, en `resetClams`). Se
  agarra con F (`CLAMS.have`).
- **9 almejas** (`CLAMS.spots`: playa, jardín trasero, jardín oeste, jungla norte ×2, jungla este, jungla
  oeste, playa del calamar, rancho).
  - Sin collider: no tocan el grid. `clamSnap` las corre a la celda navegable más cercana de su cuarto
    (por si caen en un tronco de la jungla).
  - Cada una avanza de color sola cada 3–4 rondas (`clamsRound`, desde `startRound`; arrancan desfasadas):
    vacía → verde → amarilla → morada → vacía.
  - Con el fumigador, mantener F `openTime` 1.5 s (barra `#craft`, como el escudo y el taller). Se abre, muestra
    el premio y queda usada (se ve vacía) hasta el próximo cambio de color.
- **Premios** (`rollClam`, pesos en `CLAMS.rewards`):

  | Color | Premios |
  |---|---|
  | Verde | zombie 50 · power-up 25 · francotirador 25 |
  | Amarilla | calamar 50 · power-up 25 · escopeta o revólver 25 |
  | Morada | pieza de la Ola 35 · calamar grande 40 · rifle o ballesta 25 |

  - Los zombies y calamares salen del piso al lado (`z.fromClam`). Cuentan como extra: la ronda no termina
    hasta matarlos.
  - Si la pieza ya salió, su peso se reparte entre los otros dos.
  - **Calamar grande:** `fused` 4 (tamaño 1.8), vida ×4. Sale escarbando en 6 s (`z.emergeT`, `z.digDepth`;
    `resetZombie` los vuelve a 0 y 1).
- **La pieza de la Ola** es el "coco" de la quest (`QUEST.coco`, ahora "COCO DORADO"). Sale de la almeja morada;
  la palmera ya no lo da (`CONFIG.QUEST.palmCoco = false`; la mecánica vieja queda detrás de ese flag).
- **Ola Rompiente:** 12 m y ±40° (antes 8 m y ±30°). El efecto es un grupo creado una vez (`QUEST.fxParts`): la
  ola, una capa de adentro, la cresta de espuma que se vuelca, el anillo de espuma en el piso y la salpicadura
  (un `Points`). Dura 0.6 s y sale del piso.
- Test: `f514.js`. `quest.js` se adaptó (el coco de la palmera se prueba con `palmCoco` prendido, y el cono
  nuevo).

## Mapa por áreas (V2 F5.15) — manda sobre F5.12/F5.13 donde se contradice
- **Bug del playtest de F7:** el filtro CSS del post-proceso ponía el canvas encima del HUD y del menú de pausa.
  Un elemento con filtro se pinta en la capa de los posicionados, en orden del documento, y el canvas iba último.
  Ahora va **primero en el body** (`insertBefore`) con `position:relative; z-index:0`.
- **Pirañas:** una zona salta solo con el jugador a menos de `near` 12 m (`zn.near`).
- **Cabeza del calamar:** 16 × 24 m y 9 m de alto. Túnel de 5 m con techo a `tunnelH` 4.5 y cámara con techo a
  `chamberH` 6 (entra el langostino). La boca está en z −35.
- **Torre de salvavidas** en (−27, −20), en la playa oeste, más larga: 6 patas (`lifeguardLegs()`), techo de
  palma en capas, cabina de caña y baranda de troncos. El revólver se compra ahí (R10).
- **Búnker:** la entrada está en la esquina NO (x −72.6..−67.4, contra z 74), mirando al sur (`entrance.face -1`).
  - `buildHatch` dibuja en un marco local (+z = afuera) un exterior semidestruido: esquina derrumbada, losa caída,
    hierros, techo partido, grietas, musgo, lianas, escombros, cráter, barriles, bolsas de arena, franjas gastadas,
    cartel torcido y puertas oxidadas.
  - Las estatuas se mudaron con la entrada y despiertan con `wakeKills` 5 kills **de cualquier tipo** (no boss) a
    menos de `wakeRadius`.
- **Templo** en el anexo NE (R20, x 55..95, z 55..100):
  - Cima de 14 × 14 a `UP.y`, anillo de escalones, 2 escalones más de dibujo (5 en total) y rampas de 4 m.
  - **Santuario** (`TEMPLE.sanctum`): cuarto de 10 × 10 con 2 puertas, paredes (`sanctumWalls()`, colliders de
    arriba), techo a 5 m, crestería calada de 8 m, piso de mosaico y murales. Adentro, el **Pack-a-Punch**.
  - Río y puentes alrededor, con sus pirañas.
  - `NAV` 172 × 192 y `UP` 108 × 94. Los árboles del anexo salen en una pasada aparte (la jungla de antes queda
    igual).
- **Áreas y senderos (estilo BO3):**
  - La jungla vieja (`CONFIG.THICKET`) es **espesura**: lo que no es un cuarto no se camina (`inThicket`).
  - `buildThicketWalls` pone una pared de vegetación (tag `thicket`, 3 m, sólida y en hitMeshes) en cada borde
    entre espesura y un lugar caminable, del lado de la espesura, así no le quita ancho a los senderos. Son ~40
    tramos, y `THICKET.segs` se usa para el dibujo.
  - `buildJungle` dibuja la espesura: árboles tupidos con sotobosque, arbustos sobre cada pared y lianas.
  - Las áreas son cuartos, y sus senderos son partes del área a la que llevan (`corridor:true`, sin árboles):
    - R15 Jardines norte (x −27..35, z 40..58): abiertos a los dos jardines;
    - R17 Claro del Búnker (NO): senderos desde el rancho (H2) y desde los jardines (H3);
    - R18 Campamento (E): desde la playa por un sendero de arena (H4) y desde el jardín trasero (H7);
    - R19 Playa del Calamar + la costa oeste: desde la playa oeste (H5, con cerco fijo en x −41) y desde el
      rancho (H8);
    - R20 Templo: por un sendero desde los jardines norte (H6);
    - R14 Rancho: por el lazo D20, que quedó en la boca del sendero (x −27, z 26..31);
    - la playa (R10) suma la playa oeste (x −41..−20).
  - Las entradas son lianas que se queman (`CONFIG.BURN.hedges` H2..H8). Precios: H4, H5 y H6 2000, las demás
    1500. Cada área cuesta 3250 o más desde el porche.
  - `map.js` verifica con Dijkstra (contando `OPEN_LINKS` como gratis) que ninguna liana abarata la casa, la playa
    ni los jardines.
- **Casa:** sin D5, D9 ni D10 (arcos: `OPEN_LINKS` R4–R5, R8–R9, R5–R9). D6 1250, D7 1500, y toda la casa cuesta
  **8.250**.
  - **Consecuencia:** con D1 + D3 (1750) se abren pasillo, dormitorio, caseta y **piscina**. D11 + D13 sigue en
    3250 y no abarata nada.
- **Costo de la IA (medido con 24 zombies pegados al jugador en el sótano):**
  - `animateZombie` asigna cada rotación una sola vez: cada asignación a una Euler recalcula el cuaternión.
  - El tramo directo guarda su línea libre `losCache` 0.1 s por zombie (`directClear`).
  - `moveCircle` guarda por zombie la lista de colliders de una caja con 1.5 m de margen (`nearCached`, se invalida
    con `COLHASH.gen`). Da el mismo resultado.
  - `playerLevel`/`playerOnTop` se guardan mientras el jugador no se mueve (`PLV`).
  - `navcost`: mediana 0.46 ms (1.19 antes de estos arreglos) y BFS 0.23 ms.
- Test: `f515.js` (las 4 tandas). Se adaptaron `map.js`, `f511.js`, `f513.js`, `garden.js`, `weapons2.js`,
  `quest.js`, `pap.js` y `generators.js`.

## 5 áreas, tanda A (V2 F5.16) — manda sobre todo lo de arriba donde se contradice
- **Niebla permanente** (`CONFIG.FOG` near 6 · far 40 · clip 44; tanda B: 30 → 40, pedido de Diego): `camera.far` = `clip`, así el frustum descarta lo
  lejano. El domo del cielo queda oculto y `scene.background` **es el mismo objeto** que `scene.fog.color` (la noche
  y el ciclo de luz lo cambian en el lugar: nunca reemplazar `fog.color` por otro Color). Boss 18 m, neblina morada
  22 m. `GFX.shadowBox` 50. El sol, la luna y las estrellas quedan más allá de `camera.far`: no se ven.
- **Lluvia por zona** (`CONFIG.WEATHER.rainRooms` = R20 templo, R17 claro del búnker; `rainZone()`): llueve siempre
  ahí, sea la ronda que sea. Adentro del búnker no. El resto sigue con la lluvia por ronda.
- **Oso de la caja:** devuelve lo pagado al aparecer (`refundBox`, `BOX.paid`). No pasa por `addPoints`: sin doble
  puntos ni `STATS.pointsEarned`.
- **Sombras (bug del piso del rancho):** la cámara de sombra se mueve de a un texel en el plano de la luz
  (`shadowSnap`) y `normalBias` 0.03. Cámara con near 0.1 (más precisión de profundidad). No se pudo ver sin GPU:
  confirmar en el playtest.
- **Techo solo techo:** sin escaleras 1 y 2, `UP.walk` vacío, sin barandas en la casa, sin `OPEN_LINKS` R13–R12.
  `UP` (grid de arriba, `UP.flights`, `walkMask`) queda **solo para la cima del templo** y sus rampas de piedra.
  - Plantas carnívoras en los jardines (`GARDEN.plants`: 2 en R12, 2 en R13), maceta sólida en el piso. Avisan y
    escupen con el jugador en el piso y con línea libre (`plantSees`, desde el borde de la maceta); comen
    arrastrados del piso (nivel 0). La quest de la caracola sigue pidiendo las 4.
  - Banco del escudo en el garaje, pared sur (-10, 18.45). Doble cañón en el cerco norte del rancho (-54.5, 39.8).
- **Muelle de un solo acceso:** sin segundo tronco, pasarela, entrante ni D18. 5 zonas de pirañas (antes 6). Jugg
  al final de la plataforma (0, -49.4).
- **Generador `caseta` en el rancho** (-49.5, 39.45), contra el cerco norte. La clave no cambia (nombre fijo).
- Test: `f516.js`. Se adaptaron `roof.js` (reescrito), `garden.js`, `quest.js`, `f510.js`, `f511.js`, `f513.js`,
  `shield.js`, `weapons2.js`, `map.js`, `mysterybox.js` y `gfx.js`.

## 5 áreas, tanda B (V2 F5.16) — topología
- **Áreas y conexiones:** Casa (playa, casa, jardines, jardines norte, muelle) ↔ Rancho por el lazo D20 · Casa ↔
  Templo por H6 · Rancho ↔ Búnker (claro, R17) por H2 · Rancho ↔ Calamar (R19) por H8 · Templo ↔ Calamar por el
  portal. **Sin Campamento (R18)** (su zona es espesura) **ni H3, H4, H5, H7.** Quedan 3 lianas: H2 1500, H6 2000,
  H8 1500. Precios desde el porche (Dijkstra): rancho 4750, templo 5250, búnker y calamar 6250.
  - El borde playa oeste / calamar (x −41) es un cerco fijo entero.
  - El sendero del claro desde los jardines norte (x −42..−27, z 53..58) se borró: espesura.
  - La almeja del campamento pasó al sendero del templo (45, 64.5).
- **Portal** (`CONFIG.PORTAL`, `bunker.js`: `PORTAL`, `buildPortals`, `portalOn`, `portalNear/portalPrompt/usePortal`,
  `updatePortals`): dos arcos de piedra con anillo aditivo, en el templo (65, 59.2) y en el calamar (−45, −25). Se
  prende con H6 abierta. F a menos de `use` 2.3 m → fundido de la escotilla (`BUNK.fadeT`) y aparece en `out` del
  otro. **Solo el jugador:** el flow field no lo cruza (los zombies que no llegan los respawnea el watchdog).
  `openRooms()` suma R20–R19 con el portal prendido (la caja puede mudarse). Sin collider.
- **Armas de pared** (casa 3 + machete): escopeta R2, subfusil R3, revólver en la torre (R10), machete R3 · rancho:
  doble cañón (cerco norte) y rifle (espesura oeste, −56, 34) · calamar: LMG (espesura norte, −60, −4) · búnker: Uzi
  (espesura sur del claro, −60, 53) y la bazooka abajo · templo: ballesta (tablón en 58, 56).
- **Arreglos:** hamaca del rancho al borde norte de la palapa (tapaba H2); el techo del santuario frena la lluvia
  (`rainRoof`).
- Test: `f516.js` (topología y portal). Se adaptaron `map.js`, `f512.js`, `f515.js` y `wallbuys.js`.

## Playtest de la tanda B (V2 F5.16b) — manda sobre la tanda B donde se contradice
- **Armas de pared invisibles:** los arbustos de `buildJungle` se dibujan encima de las paredes de espesura y
  tapaban la tiza. Rifle (−53.6, 37.5), LMG (−60, −6.3), Uzi (−60, 55.3) y ballesta (58, 57.5) van en **tablón
  propio** (`post:true`) a ~2.3 m del borde. Regla: nunca una tiza pegada a una pared de `thicket`.
- **Portal con tumba** (`CONFIG.PORTAL` use 2.3 · bleed 1.5 · cooldown 2 · carry 20):
  - Al principio no hay arcos: en el lugar del del templo hay una **tumba** (lápida, montículo, huesos) con caja
    de tiro `userData.type 'tomb'` en hitMeshes (sin collider). Un tiro (`traceShot`/`tracePierce` → `shootTomb`)
    la hace sangrar 1.5 s (chorros de sangre + charco que crece) y `openPortals` muestra los dos arcos, saca la
    tumba de hitMeshes y avisa "SE ABRIÓ UN PORTAL". Ya no depende de H6 (la tumba solo se alcanza con el templo
    abierto).
  - `PORTAL.cd`: después de usarlo, 2 s (contados desde que llegás) con el cartel "se está recargando".
  - **Los que te perseguían cruzan:** en el medio del fundido, `portalCarry` saca del piso (`resetZombie` con la
    misma vida) alrededor del arco de llegada, en un anillo de 3 a 7 m, a los zombies y mobs vivos del piso a
    menos de `carry` m del arco de salida. **Los bosses no cruzan.**
  - `resetPortals` (desde `resetBunker`) vuelve a la tumba.
- **Templo pegado a la esquina NE del anexo** (+4 en x, +3 en z): cima x 78..92, z 83..97; los escalones tocan
  x 95 y z 100, así que no se camina por detrás (norte y este). PaP en (87, 95.8). El puente sur del río y su
  zona de pirañas pasaron a x 83..87 (frente a la rampa sur). La almeja de R20 pasó a (80, 60).
- **Rampas del templo:** su huella en el piso es un `bound:rampa` **solo para zombies** (`zombieOnly`): los del
  piso ya no las cruzan de costado. El jugador sube igual y los que trepan van por el enlace, sin colisión.
- **Niebla en Ajustes** (`setFog(far)`, `SETTINGS.fog`, `CONFIG.FOG.min/max` 20..90): Muy espesa 25 · Normal 40
  · Liviana 60 · Casi nada 90, con el aviso "Menos niebla = menos FPS". Mueve `camera.far` (far + 4) y
  `BOSS.fogBase`. Dura la sesión.
- Test: `f516.js` (portal con tumba, cruce, cooldown, templo, rampas, niebla). `audio2.js` adaptado.

## Inglés, PaP y tanda C (V2 F5.16c) — manda sobre lo de arriba donde se contradice
- **Textos visibles en inglés** (carteles `[F] Buy / Ammo / Open door / Burn the vines / Take / Pick up ...`, banners
  `ROUND n`, `A PORTAL OPENED`, HUD, menús, controles, ajustes, pantalla final, nombres de armas, perks, piezas,
  trampas, power-ups y almejas `GREEN clam`). Los tests comparan los textos en inglés. Código y comentarios en
  español. Nombres propios quedan (EL SOMBRERÓN, RANCHO DON MARENA).
- **Nombres de PaP inventados:** M1911 GRAVE WHISPER · Shotgun BONECRUSHER 9000 · SMG HIVEMIND · Rifle DEAD
  RECKONING · LMG ABYSS CHOIR · Ray Gun STARBLEED X9 · Sniper SILENT REQUIEM · Flamethrower HELLKISS · Revolver SIX
  FEET UNDER · Double Barrel CERBERUS · Crossbow NIGHTSTINGER · Uzi LIL RIPPER · AK-47 RED ZEPHYR · Desert Eagle
  THUNDERJAW · SPAS-12 MEAT GRINDER · Bow ECLIPSE STRING · Bazooka DOOMSDAY PARADE · Breaking Wave MARENA'S WRATH.
- `showBanner` sin segundos queda fijo: siempre pasar la duración (el del portal quedaba pegado).
- **Tanda C, tortugario** (`CONFIG.RANCHO.pen/cave`): área abierta x −70..−56, z 18..40 (parte de R14, `name
  'TORTUGARIO'`, del tamaño del rancho). Sin el corral chico. Arena revuelta, nidos rotos, calaveras, costillares,
  fémures y caparazones vacíos (un MeshBuilder con `mulberry` de semilla fija). **Cueva** de roca contra el borde oeste
  (sólida, PROPS `cueva`, x −70..−65, z 31..39) con boca oscura al este en (−64.3, 35). 2 spawns nuevos.
  - **Trampa:** una sola tortuga (`TRAPS.turtles` count 1, ×1.7, 3.8 m/s, come en 0.35 s, alcance 26 m) que sale de la
    boca de la cueva y vuelve a esconderse ahí. Palanca en (−64.2, 30.2). La cueva va al norte porque al sur la barra
    del rancho tapaba la salida.
- Test: `f516.js` (tanda C). Se adaptaron los tests a los textos en inglés, `f510.js` (tortuga) y `f515.js`.

## Tanda D: estación de policía (V2 F5.16d) — reemplazada por el caparazón (F5.17)
- Quedan de la tanda D: la barricada **D21** (1250), los **3 zombies arrodillados comiéndose a un policía** (`POLICE`,
  `updatePolice`, `policeWake`, `resetPolice`: al abrirse D21 se paran y salen 3 zombies de verdad, `fromClam`) y los
  policías muertos. La estación, el corredor oscuro, el búnker chico, `pwall`, `dark` y `CONFIG.POLICE` ya no están.

## Estilo BO2 y rediseños (V2 F5.17) — manda sobre lo de arriba donde se contradice
Pedido de Diego: "que no sea tanto Minecraft, más como BO2 zombies". Se atacó por las herramientas y por las áreas que
nombró (rancho, cueva, templo, jardines, estación → caparazón). La casa y los zombies siguen con cajas: es lo próximo.
- **Texturas:** filtrado lineal y anisotrópico (`texAniso`, hasta 4). Antes `NearestFilter` (píxeles cuadrados de cerca).
  La cara de los zombies sigue en Nearest a propósito. `makeTexWH(..., true)` pide Nearest.
- **`MeshBuilder` con formas curvas** (todo se fusiona igual: un draw call por builder):
  - `cyl(x, y, z, r, h, color, top, seg, rx, ry, rz)` parado en la base (gira sobre ella) · `seg(a, b, r0, r1, color)`
    entre dos puntos · `sphere` · `rock` (icosaedro deformado, caras planas, 8 variantes) · `blob` (esfera ondulada
    suave, 6) · `tube(pts, r0, r1, color, seg, radial)` (curva con radio que se afina) · `lathe(perfil)` · `quadN`
    (normales por vértice) · `addM(geo, matriz)` (acepta geometrías sin índice).
  - **Hojas con alfa:** atlas `FOLI` (canvas 512: `leaf`, `palm`, `fern`, `grass`, `vine`, `thatch`, `ivy`, `flower`,
    `dead`, `bigleaf`, `web`, `moss`) y `FOLI.mat` (alphaTest, DoubleSide, el shader usa la luz de adelante en las dos
    caras). `card` (parada, base abajo), `frond` (acostada, cae `droop`), `clump` (3 cruzadas + una arriba).
    `upNormals` tira las normales para arriba: el follaje se ilumina parejo.
  - `ChunkMB(size)`: un MeshBuilder por celda de `size` m. **Todo lo que cubre mucho mapa va por celdas** (la jungla):
    con la niebla, `camera.far` y el frustum descartan las celdas lejanas. Antes la jungla era un mesh que se dibujaba
    entero siempre. La escena subió de ~448k a ~576k vértices, pero en cada vista se dibuja mucho menos.
  - Materiales: `MAT.bark` (corteza), `MAT.rock`, `MAT.grimeV` (grano + color por vértice), `MAT.thatch`/`thatchIn`
    (paja; la de abajo con emisivo: si no, negro).
- **Jungla** (`buildJungle`): troncos curvos con raíces tablares y ramas, copas y arbustos de hojas, palmeras arqueadas,
  helechos, pasto, flores, rocas con musgo, niebla con bordes suaves. **Los arbustos de las paredes de espesura van
  detrás de su cara caminable**: antes se metían ~1 m en los senderos y asomaban adentro de la piscina junto a Double
  Tap (las "cosas verdes"). Los helechos del lado del sendero solo en pisos de jungla, pasto o arena.
- **Palmeras** (`palm`, tema): tronco de cilindros con anillos y frondas arqueadas en dos tramos (`fb`, FOLI). La cuenta
  del tronco no cambió (`palmTop`).
- **Rancho** (`buildRancho`): palapa de troncos con techo de paja a 4 aguas (5 capas, flecos solo en la de afuera: los
  de arriba asomaban por debajo), **tiki bar contra el cerco sur** (`RANCHO.props` barra `[-54.4, -49.6, 18.3, 19.1]`,
  frente de bambú, estantes con botellas, alero en voladizo, máscaras, banquetas; antes tapaba la salida de la
  tortuga), billar con lámpara, hamaca curva, 6 antorchas tiki (llamas en `TEMPLEFX.flames`), arco de entrada con
  cartel en la boca del sendero del lazo, tablas de surf contra la espesura este, red con boyas en la esquina SO.
  **Rifle** a la esquina SE, en tablón propio (−42.7, 21.6), fuera del camino.
- **Cueva de la tortuga:** rocas facetadas apiladas sobre la caja sólida, boca en arco negra, estalactitas, lianas,
  huesos y arañazos. **Ojos amarillos** en la oscuridad (`RANCHO.eyes`) que parpadean y se apagan mientras la tortuga
  de la trampa está afuera (`updateRanchoEyes`). El tortugario: huesos de verdad (cráneos, costillares, fémures),
  caparazones (algunos dados vuelta), nidos torneados con huevos y hojas secas.
- **Templo** (`buildTempleDress` + `buildTemple`): raíces gigantes que bajan por la pirámide (no pasan por las rampas),
  hiedra y lianas, piedra con manchas de musgo, bloques caídos, **2 cabezas colosales** a los lados del camino del
  puente sur y **4 estelas** (`CONFIG.TEMPLE.heads/stelae`, sólidas en `PROPS`: `cabezaN`, `estelaN`), cabezas de
  serpiente emplumada al pie de las alfardas, braseros de piedra (antes un palo), juncos y nenúfares en el río.
- **Jardines** (`buildGardenDress`, `buildGardenDecor`): hojas pegadas a los cercos `hedge` y matas arriba (no tapan
  tizas, máquinas ni cajas: `keep`), cortinas de lianas en H2/H6/H8 (hijas del bloque: se hunden al quemarse),
  pasto y helechos en los bordes de R12 y R13, caminos de lajas, 6 faroles de hierro con foco (MeshBasic + halo
  aditivo `LAMPS.mat`: ninguna luz), 2 bancos, 2 tikis, macetas de barro con hojas grandes, hiedra en las paredes de la
  casa que dan a los jardines, canteros con borde de piedras y flores de hojas. Plantas carnívoras orgánicas: tallo
  curvo, hojas carnosas, mandíbulas de media esfera con dientes cónicos y manchas (`PLANT_HEMI`), maceta torneada.
- **El caparazón de la tortuga gigante (R21)** — `CONFIG.SHELL`, `world.js` (`shellRim`, `buildShellWalls`), `bunker.js`
  (`buildShell`, `SHELLFX`):
  - Elipse de centro (−51, 81), semiejes 13 × 11, 12 m de alto: llega a z 92. **El claro (R17) creció**: un patio
    x −67..−35, z 74..95 (y x −42..−35, z 72..74) que lo rodea (se le da la vuelta por afuera). THICKET suma
    `[-75, -20, 74, 98]` (paredes de espesura alrededor del patio) y `bound:jungla` se corrió.
  - **R21 son 5 rectángulos adentro de la elipse** (van antes que R17): la cubren casi toda. `noFloor` (el piso lo
    dibuja `buildShell`), `outdoor` (sin techo ni tinte del tema). Lo que queda afuera de los rectángulos (bordes en
    diagonal) da R17.
  - **Borde:** 64 cajas invisibles por la elipse (tag `shell`, 4.5 m, no se pisa: `standable`) con la boca al sur y
    jambas que la cierran contra la barricada **D21** (bloque invisible de 1.2 m; el dibujo de tablones, bolsas de
    arena y cinta va de hijo: al abrirse se va). Con D21 cerrada no se entra (`f516.js` lo verifica).
  - **Entrepiso** a `UP.y` (el grid de arriba, como la cima del templo): anillo de 3 m alrededor de un hueco
    (`deck.outer` `[-58, -44, 75, 87]`, `deck.inner` `[-55, -47, 78, 84]`). Losas invisibles overhead + roofSurface, 11
    postes sólidos (`PROPS` `shellPostN`), barandas automáticas (`buildRoofEdges`) y **escalera abierta** en el hueco
    (`UP.flights` con `open: true`: el techo no la dibuja maciza; la dibuja `buildShell`), con su huella solo para
    zombies (`bound:rampa`). `UP` arranca en x −62 (154 × 94). `buildRoof` marca la máscara con todo `UP.walk`.
  - **Dibujo:** cúpula de placas afuera (textura de escudos con anillos de crecimiento, musgo, hiedra, percebes,
    lianas, placas marginales festoneadas) y de carne adentro, armadas a mano (anillos × gajos, `quadN`) para dejar
    huecos: la boca (con labio liso), 4 patas y la cola **tapadas con escombros** (se ve que no se pasa), el tragaluz y
    2 placas rotas arriba. Adentro: **la columna y las costillas pegadas a la cúpula** (como una tortuga de verdad),
    **sangre verde que brilla** (MeshBasic que late, charcos con halo aditivo, chorros por las paredes, venas, gotas
    que cuelgan de las costillas y **gotas que caen** en loop: `SHELLFX.drops`, un InstancedMesh), haces de luz del
    tragaluz, faroles de obra (MeshBasic), huesos, papeles y policías muertos. **Ninguna luz nueva.**
  - Afuera: jeep de la policía volcado (sólido, `PROPS` `jeep`), caballetes con cinta, carteles QUARANTINE y
    BIOHAZARD, 2 policías muertos.
  - **Stamin-Up** (−63.25, 81) y el **generador `garaje`** (−38.75, 81) contra el borde (así no cambian el grid); la
    **Uzi** en el entrepiso (`level: 1`, tablón propio). Spawns: 3 adentro y 3 en el patio de atrás.
  - Lluvia: `rainRoof` frena en la cúpula salvo el tragaluz (por ahí entra hasta el piso).
- **Capturas:** `tools/shots.js` (Playwright global + Chromium de `/opt/pw-browsers`, three.js local, WebGL por
  SwiftShader). Esconde menú, HUD y el arma; `look: [x, y, z]` apunta la cámara; `round` cambia el cielo; `open` abre
  todo. Salida en `shots/` (ignorada por git).
- Tests: `f516.js` (sección 9: el caparazón). Se adaptaron `roof.js` (la escalera del caparazón y sus barandas),
  `props.js` (cuartos con bordes no enteros).

## Cubos otra vez, agacharse, last stand, XP y menú (V2 F5.18) — manda sobre F5.17c donde se contradice
- **De vuelta a cubos** (pedido de Diego): zombies, perros, calamares, bosses y plantas carnívoras (tallo, mandíbulas y
  maceta) volvieron a como estaban antes de F5.17c (`zombies.js`, `enemies.js`, `boss.js` de `5cf629f`). **La cabeza del
  calamar curva se queda**, igual que la casa, el muelle y la playa de F5.17c. Las armas nunca cambiaron.
- **Cráneo de la tortuga** (bunker.js `buildShell`): montado sobre la boca del caparazón, mirando afuera, sin collider (arriba
  de 3.4 m).
- **Agacharse** (mantener C, `CONFIG.PLAYER.crouch`): solo baja los ojos y la bala (`eyeDrop`, `feel.eye`); el cuerpo y las
  colisiones no cambian. ×0.5 de velocidad, sin sprint ni salto, dispersión ×0.75.
- **Quick Revive = last stand** (`CONFIG.PERKS.lastStand`, perks.js `DOWN`): el golpe letal con QR te deja 10 s tirado:
  - pantalla gris (`gfxFilter`) y la vista a 0.5 m del piso;
  - te arrastrás a ×0.25, con la Ray Gun (munición llena) y tus armas guardadas (`DOWN.saved`);
  - invulnerable (`damagePlayer` sale), sin cuchillo, granadas, langostino, escudo, cambio de arma ni F;
  - los zombies (y los bosses) se alejan en línea recta hasta 16 m (`fleeZombie`) y nadie pega ni cuenta atasco.
  Después: vida llena, tus armas, 2 s de invulnerabilidad. Se pierden los perks, la Ola y la 3ra arma como antes.
- **Choque al oeste del templo** (`CONFIG.CRASH`, parte de R20 x 36..55, z 75..92, abierto al anexo por un hueco en x 55,
  z 78..88; espesura alrededor): 5 autos volcados (sólidos, `crashFrame`/`crashBox`; 3 en llamas con humo: un mesh de
  llamas por auto y un `Points`), 7 cadáveres, un calamar muerto del tamaño de un auto y el Sombrerón muerto con la
  guitarra atravesada (los dos sólidos). Todo en cubos y sin luces.
- **XP y niveles estilo BO3** (`src/progress.js`, `CONFIG.PROGRESSION`): 10 por kill, +6 headshot, 40 × ronda terminada,
  500 por boss. 55 niveles, rangos RECRUIT … COMMANDER. Guardado en localStorage (`bhz_profile_v1`): nombre, XP, carga.
  Subir de nivel muestra el cartel con lo desbloqueado. La pantalla final muestra la XP ganada y el nivel.
- **Accesorios** (hasta 3 por arma, no en la Ola ni el lanzallamas): quickdraw (LV 2, ADS ×0.5 de tiempo), fast mag (LV 4,
  recarga ×0.7), mira réflex (LV 6, más zoom y ADS ×0.7 de dispersión), láser (LV 9, cadera ×0.6), long barrel (LV 12,
  daño ×1.15, dispersión ×0.85), culata (LV 15, retroceso ×0.75 y se camina más rápido apuntando). **4 camos** (jungle LV 3,
  desert LV 10, arctic LV 20, crimson LV 30). `slotDef` pasa por `attDef` (def cacheado por combinación; CONFIG.WEAPONS
  intacto). En el arma se ven como cubos (`addAttachmentModels`) y el camo tiñe el modelo (`tintModel`; el PaP manda).
- **Menú nuevo** (shell.html `#start`, ui.js): menú a la izquierda (PLAY, MAPS, WEAPONS, PROFILE, SETTINGS, CONTROLS; en
  pausa solo RESUME, SETTINGS, CONTROLS, QUIT), el mundo detrás en gris (`gfxFilter`, cámara `menuCamera` que recorre la
  playa) y siluetas de mobs en cubos negros con ojos rojos (`buildSilhouettes`). Mapas: CITY y ??? bloqueados, BEACH.
  WEAPONS: accesorios y camo por arma. PROFILE: nombre editable, nivel, rango, barra de XP, próximo desbloqueo.
- `tools/shots.js`: `menu: true` (y `panel`) muestra el menú en la captura.
- Test: `f518.js` (agacharse, last stand, choque, XP y accesorios, menú). `perks.js` adaptado al last stand.

## Cielo, rayo de la caja y formas curvas en todo (V2 F5.17b/c) — manda sobre lo de arriba donde se contradice
- **Cielo** (`SKYDOME`, `buildSkyDome`, `updateSkyDome` en gfx.js, `CONFIG.GFX.sky`): domo `ShaderMaterial` que sigue a
  la cámara, de radio `camera.far - 3`, dibujado primero y sin profundidad. Abajo usa `scene.fog.color` (se funde con la
  niebla), arriba un degradé día/noche/neblina morada, con sol, luna y estrellas en el shader. Un draw call: **ver el
  cielo no cuesta FPS; lo que cuesta es ver lejos** (`camera.far`, que sigue atado a la niebla).
- **Rayo de la mystery box** (`CONFIG.BOX.beamColor/beamWidth/beamHeight`): 3 planos aditivos cruzados sin niebla
  (`buildBox`/`placeBox`), late, y se esconde mientras sale el oso o la caja se muda (`updateBox`).
- **Pared playa ↔ playa del calamar** (`WORLD.beachWall`, cerco de x −41): arde y se abre con **H8** (`openDoor('H8')`
  → `beachWall(false)`, 24 llamas en `buildBurns`); `openRooms()` suma R10–R19 con H8 abierta. Reset la vuelve a poner.
- **Caparazón:** Stamin-Up en el entrepiso (`level: 1`, x −56.3, z 86.5) y hueco en la baranda norte (`SHELL.jump`,
  en `UP.gaps`) para tirarse al medio.
- **Espesura con piso verde** (`buildJungle`: plano de pasto bajo los rectángulos de `THICKET`).
- **Personajes curvos:** geometrías compartidas por tipo (`zShapes`, `dogShapes`, `squidShapes`, `bossShapes`), armadas con
  `MeshBuilder.geometry()` (la geometría sola, sin mesh). Los materiales llevan `vertexColors`: el color por vértice
  multiplica el de cada zombie (piel, camisa) y el destello de daño sigue andando. Las partes que reciben balas son las
  mismas (mismos `hitParts`, `userData.part`).
- **Casa:** zócalo, moldura redondeada y guardasillas (sala y pasillo) en cada tramo de pared de cuarto cerrado
  (`trimRun`, desde `buildWallSkins`: un mesh). Muebles con `MeshBuilder.rbox` (caja con cantos redondeados a lo
  largo de x) y `ring` (toro): sofá, TV, refri, colchón, almohada, ruedas y llantas, salvavidas, frascos, botellas,
  latas, escalerillas curvas. **Los `PROPS` (colisión) no cambiaron.**
- **Muelle:** pilotes redondos con percebes que asoman como postes, soga que cuelga entre ellos, faroles de hierro con
  brazo curvo, bote de casco torneado (`lathe`). **Playa:** sombrillas cónicas, castillo torneado, botes volteados,
  troncos curvos, algas, conchas, cangrejos curvos.
- **Cabeza del calamar** (`buildSquidHead`): superficie de superelipse (rebanadas a lo largo de z, se hunde en el mar
  atrás), cara abombada con la boca, túnel y cámara en arco con costillas (carne con venas por canvas, `DoubleSide`),
  pico negro con dientes, ojos lechosos con párpado, tentáculos con ventosas. Los sólidos invisibles no cambiaron.

## Audio (V2 F6) — `src/audio.js`, `CONFIG.AUDIO`
- **Buses:** `sfx → compresor → master`, `amb → master`, `music → master` (F6), más 2 loops nuevos
  (viento y bichos) directo al master. Todo sigue saliendo sin hacer nada si no hay contexto.
- **Volúmenes separados** (Ajustes: Volumen, Música, Efectos): `SETTINGS.volume/music/sfx`,
  `setVolume/setMusicVolume/setSfxVolume`. El ambiente sigue al volumen de efectos. Duran la sesión.
- **Audio 3D** (`spatialOut(x, y, z)`): con PannerNode, HRTF (`CONFIG.AUDIO.hrtf`), en el marco del oyente, así
  se oye un zombie a la espalda. Sin PannerNode, paneo estéreo y lowpass 2200 si viene de atrás. La distancia la
  sigue manejando cada sonido (`rolloffFactor` 0). Lo usan los gruñidos y los pasos de los zombies.
- **Pasos por superficie** (`surfaceAt`, `STEP_SFX`, `sfxStep`):
  - Superficies: madera, arena, concreto, azulejo, agua (pileta y arena mojada), pasto y piedra (templo). El
    techo suena a madera y el búnker a concreto.
  - Jugador (`updateFootsteps`, después de `updatePlayer`): un paso cada `stepLen` 0.85 m en el piso (corriendo,
    1.25 m y más fuerte). En el aire no; un salto de más de 2 m (teletransporte) no cuenta.
  - Zombies (`zombieSteps`, desde `updateZombieAudio`): a menos de `zStepDist` m, cada `zStepEvery[paso]` s (perro,
    calamar, boss con el suyo; arrastrado ×1.6), en 3D, con tope global `zStepMax` por segundo.
- **Música** (`updateMusic`, `MUSIC`): marimba grave procedural en el bus `music`, agendada con `musicLookahead` s
  de adelanto (sin timers).
  - Tranquila: pentatónica menor sobre Am F Dm Em, `musicBpm` 78 + 0.8 por ronda (tope 104).
  - Capas según `musicIntensity()` (ronda de 1 a 15, +0.25 en mobs, ×0.4 entre rondas): bajo y quinta siempre,
    melodía que se llena, shaker, bombo y redoble al final de la frase.
  - Con un boss vivo: tema frigio a 122, bombo en cada negra, bordón y golpes de metal.
  - **Los zombies mandan:** ×`musicDuck` mientras gruñe uno, ×`musicNearDuck` con uno a menos de 6 m. En pausa o
    game over se apaga y no agenda.
- **Anuncio de ronda:** la campanada + `sfxRoundDrum(n)` (2 golpes; cada 5 rondas, redoble que crece).
- **Ambiente por zona** (`ambienceZone`, `updateAmbience`):
  - Olas según la distancia al mar (`seaFar`): fuertes en la playa, bajas tierra adentro, apagadas bajo techo y
    casi nada en el sótano y el búnker.
  - Viento fuerte en el muelle, el puente y arriba (techo, templo); suave afuera.
  - Bichos en la jungla (más de noche).
  - Gotas en el sótano y el búnker, y pájaros en la jungla de día (puntuales, con stop).
- Tests: `audio2.js` (nuevo, con PannerNode falso) y `audio.js` (4 loops, tambor).

## Gráficos (V2 F7) — `src/gfx.js`, `CONFIG.GFX/GORE`, `CONFIG.WEATHER.palette`, `CONFIG.DECOR.beach`
- **Calidad** (Ajustes: Bajo / Medio / Alto, dura la sesión; arranca en Medio): `applyQuality(name)` pone pixel
  ratio, sombras, post, polvo y haces del tema y la fracción de la lluvia (`setDrawRange`). El gobernador
  (`updateQuality`) sigue bajando solo si faltan FPS.
- **Sombras solo en Alto** (`setShadows`): del sol nomás, mapa de 1024 que sigue al jugador (`shadowBox` 60 m).
  - `gfxMarkShadows` marca una vez los meshes visibles y opacos que no son MeshBasic.
  - Prenderlas o apagarlas recompila los shaders una vez (al tocar el ajuste). Las lámparas no proyectan.
  - **Falta medir FPS en el navegador:** son ~1100 meshes en el pase de sombras.
- **Post-proceso sin shaders:** `#post` (viñeta con CSS y grano: una textura de ruido que salta de lugar) y un
  filtro CSS de color en el canvas (`gfxFilter`: cálido al atardecer, frío de noche). El blur del silbido del boss
  va en el mismo filtro (`GFX.blur`, `gfxApplyFilter`); `boss.js` ya no toca `style.filter`.
- **Ciclo de luz por ronda** (`paletteAt`): los colores del cielo, la niebla, la hemisférica y el sol recorren 4
  paradas según la oscuridad `darkBy(n)`:
  - atardecer del tema (R1);
  - atardecer rojo (R5);
  - anochecer azul-violeta (R10);
  - noche (R15+).
  Las intensidades siguen lineales (los tests de noche no cambian). Disco del sol bajo al oeste (se apaga al
  anochecer) y luna sobre el mar (de noche), aditivos y sin niebla, creados una vez.
- **Desmembramiento** (`GORE`, `GIBS`, solo zombies humanos: `isHuman`), con un pool fijo de 16 pedazos:
  - Cada pedazo tiene física simple: gravedad, rebote contra el piso o el techo, frena contra paredes con
    `projBlocked`. Queda acostado y a los 6 s se achica y se va.
  - Headshot que mata → la cabeza sale volando (70%). Golpe al brazo de ≥30% de la vida → se arranca (sigue
    vivo; `userData.part` 'armL'/'armR'). Al arrastrarse, la pierna sale volando (`loseLeg` en `startCrawl`).
  - Muerte por explosivo (granada, bazooka, langostino, Ray Gun): 1 a 3 pedazos.
  - Las partes perdidas van a escala 1e-3, como la pierna del arrastrado. `resetZombie` las devuelve.
- **Animación de zombies:**
  - Renguera propia (`z.limp`), torso que gira y cabeza que cabecea.
  - 3 ataques sorteados por golpe (`z.atk`: zarpazo, embestida, mordida).
  - 4 poses de muerte con pesos (`deathPose`: de espalda, de cara, de costado, de rodillas). La de rodillas tarda
    `kneeTime` 0.9 s en irse; las otras, los 0.3 s de siempre.
  - Trepando la pileta, se impulsa y mira para arriba.
- **Agua y playa:**
  - El río del templo y el fondo de la pileta (agua verde estancada, 15 cm) tienen una textura de ondas que se
    desplaza.
  - La playa suma toallas, sombrillas, castillo de arena con balde, heladerita, pelota, radio, troncos, algas,
    conchas y estrellas de mar (un mesh, sin collider).
  - 5 cangrejos caminan de costado por la orilla y se escapan si te acercás.
- **Draw calls:** las almejas pasaron de ~15 a 4 meshes cada una (valvas fusionadas, nidos en uno). "Todo
  visible" en `theme.js`: 413.
- Tests: `gfx.js` (calidad, sombras, post, ciclo, sol y luna, agua, cangrejos) y `gore.js` (desmembramiento,
  física, poses, ataques, renguera). `boss.js` ahora mira que no quede `blur` en el filtro.

## Puertas y wall weapons (P5)
- **Interacción [F]:** `updateInteract()` cada frame elige lo más cercano a < `ECONOMY.interactRange` (3 m):
  puertas cerradas por distancia al borde del bloque (se compran desde cualquier lado), wall buys por distancia
  al punto **y** estar en su cuarto (`roomAt`), para no comprar a través de la pared. `interact()` compra.
  `e.repeat` ignorado: mantener F no compra dos veces.
- **`spendPoints(cost)`** es el único punto de gasto (popup rojo). Doble puntos NO afecta gastos.
- **Wall buys** en `CONFIG.WALLBUYS` (`x,z` sobre el eje de la pared, `face` = lado de la cara). Tiza + modelo
  construidos una vez en `buildWallBuys()`; no están en `hitMeshes` ni son colliders.
- Recompra con reserva llena **no cobra**. Recompra solo llena reserva, no cargador.
- **`raiseWeapon()`** al comprar arma: cancela recarga/cambio/cuchillo. Sin eso, una recarga en curso se
  completaba sobre el arma nueva.
- Rifle: el spec no da cadencia → automático 130 ms (dps entre SMG y LMG).
- **Por arma:** `recoilReturn` (sin él = `FEEL.recoilReturn`) y `fireShake` (sin él = fórmula por daño; con la
  fórmula la LMG saturaba el trauma en 3 disparos). `recoilReturnOf(def)` da el mismo ω al kick y al resorte.
- Test: `wallbuys.js`.
- **Cadencia:** `lastShot` avanza de a `fireRate` en fuego sostenido (no salta a `now`). Si no, a 60 fps la
  cadencia se redondea al frame siguiente (SMG 90 → 100 ms, -10% dps).

## Mystery box (P6) — `CONFIG.BOX`
- **`BOX` no vive en `state`** (mismo criterio que `PICKUPS`). Fases: `idle → rolling (4s) → ready (8s) → idle`,
  o `rolling → teddy → moving → idle`. El resultado se decide **al pagar** (`rollBoxResult`).
- **Nunca ofrece un arma que ya tenés.** Teddy 15%. **F5.16 (Diego): al salir el oso devuelve los 950** (`refundBox`, `BOX.paid`; sin doble puntos ni STATS).
- Mudanza: a un cuarto de `openRooms()` (BFS sobre `DOOR_LINKS` desde R1), distinto del actual y con el
  jugador a >2 m del spot. Sin destino posible no sale teddy.
- **Spots** (`BOX.spots`, uno por cuarto) contra una pared, profundidad 0.7 → la caja queda dentro del anillo
  no navegable y **no cambia el grid** (test lo verifica). Si movés un spot, correr `mysterybox.js`.
- Todo se construye una vez: modelos de display (7 armas + oso) se prenden/apagan, luz dorada nace con
  `intensity=0`. La caja es collider + hitMesh.
- **Ray Gun:** `traceShot` deja el impacto en `shotImpact`; `applySplash()` daña a los demás en
  `splashRadius` con caída a `splashMin`, solo con `segmentClear` (no atraviesa paredes). No daña al jugador.
- **Lanzallamas (`flame:true`):** cada `fireRate` ms aplica `dps*fireRate/1000` a todos en el cono
  (distancia al eje contra el cuerpo vertical, así pega a los pegados). `hitPoints:0` → sin puntos por
  impacto (evita farmeo de ~320 pts/s), solo kill. No cuenta para precisión. **40/s es inútil desde ronda
  ~5 (26 s por zombie en ronda 10): revisar en P9.**
- `damageZombie(z, dmg, headshot, killPoints, hitPoints)`: 5to parámetro opcional.
- El color del fogonazo cambia por arma (`flashColor`) sin agregar luces.
- Test: `mysterybox.js`.

## Tema "Marena" 34B (P7) — `CONFIG.THEME`, solo visual
- **Regla dura: ningún mesh del tema entra a `WORLD.hitMeshes` ni `WORLD.colliders`** (`userData.theme = true`).
  La colisión de los muebles NO sale del tema: sale de `PROPS` (ver "Props sólidos"), que se construye con o
  sin tema.
- **Paredes:** las cajas originales quedan `visible=false` pero siguen en hitMeshes/colliders (el raycaster de
  r128 **no mira `.visible`**). Encima, `buildWallSkins()` genera una piel por cara, cortada por metro según
  el cuarto al que mira (`TEX.skin[R2..R7|EXT|RAIL|TRIM]`, 128x256 = 2m x 4m). Si se agrega una pared nueva
  con tag `wall`/`rail`, recibe piel sola.
- **Sin sombras** → el sol ilumina los interiores igual que el porche. La oscuridad interior es `interiorTint`
  en materiales, color por vértice y vigas, más luces que parpadean y haces de luz falsos en las ventanas.
- **Luces:** siguen siendo 6 lámparas (`WORLD.lamps`, modos steady/flicker/broken/buzz). El parpadeo
  cambia `intensity`; nunca agregar luces.
- **Draw calls:** `MeshBuilder` fusiona cajas/planos con color por vértice. Hay un mesh de muebles por cuarto,
  un atlas (`ATLAS.tex`: letreros, cuadros, arena, charcos) y un atlas de ventanas (MeshBasic).
  Vigas, tuberías y cables van en 1 `InstancedMesh` con `instanceColor`; las láminas del porche y los focos,
  en 1 cada uno. El polvo es 1 `THREE.Points`. En total hay menos draw calls que sin tema (80 contra 85).
- **Atlas:** cada dibujo va dentro de `region()`, que lo recorta. Sin eso se metía en la región vecina
  (las rayas de POWER aparecían en el charco).
- **Gobernador de calidad** (`updateQuality`): si el promedio baja de `fpsFloor` (55) durante `fpsWindow`
  (3 s), apaga un nivel y avisa con `console.warn` y en el overlay (`CAL -n`). Niveles: 1 polvo · 2 haces de
  luz y cortinas · 3 pixel ratio 1. El overlay muestra `DRAW` (draw calls reales de las 2 pasadas).
- **Medido en Chrome, Radeon 610M integrada, 1280x720, sin zombies:** 60 FPS con vsync en todas las vistas.
  Sin límite de cuadros, el peor caso con tema es el sótano: 211 FPS (sin tema: 353).
- Test: `theme.js` carga el juego con y sin tema (`BHZ_NOTHEME=1` en el harness) y compara colliders,
  hitMeshes, grid, 400 rayos de bala y visibilidad para spawns. Deben ser idénticos.

## Mapa expandido (V2 F1)
- **Piso con altura: solo la piscina.** `groundY(x, z)` da 0 en todo el mapa salvo dentro de `POOL`: rampa
  de z 8 a 11.5 (de 0 a −1.6) y parte honda hasta z 17. La usan:
  - el jugador (piso = `groundY + height`; en la rampa se pega a la pendiente si baja menos de 0.35 m por
    frame, para que la cámara no rebote);
  - `placeRoot` (la y que se le pasa es relativa al piso);
  - `isVisibleToPlayer`, la sangre, los drops, el cono del lanzallamas y el área de la Ray Gun.

  Toda lógica nueva que asuma piso en 0 tiene que usar `groundY`.
- **Bordes de la piscina (F2.6).** Los 3 bordes sin rampa llevan `poolRim`: un collider invisible de −1.8 a
  **−0.2 m**. El fondo, la rampa y las paredes son `hitMeshes` sin collider.
  - **Jugador:** su colisión mira la altura, así que desde la orilla el borde le pasa por debajo y **se tira
    desde cualquier lado**. Desde abajo lo frena, aun saltando (llega a −1.16): sale solo por la rampa.
  - **F2.8 (bug del playtest):** el borde es **de un solo sentido y solo frena a lo ancho** (`moveAxis`):
    - Frena solo cuando te alejás del centro de la pileta (salir), nunca cuando entrás. Entrando despacio
      (costado de la rampa, apuntando, saltando), los pies quedaban bajo el borde con el cuerpo encima: te
      devolvía a la orilla, el piso te subía, y así en loop.
    - Como es una tira fina, resolverlo a lo largo te teletransportaba a la punta. `pool.js` prueba 5 formas
      de entrar.
  - **Zombies:** `moveCircle`, el grid y `segmentClear` no miran la altura, así que para ellos es una pared.
    Entran y salen por la rampa y por **3 escaleras** (`POOL.ladders`: norte x 25, oeste y este a z 13).
    Cada escalera es un **enlace** entre una celda de abajo y una de arriba (`NAV.link`, lo arma
    `buildNavGrid`), y el BFS lo cruza como un vecino más. En `steerZombie`, si la otra punta está más cerca
    del jugador, `startClimb`: estado `climb`, sin colisión, ataque ni watchdog. Camina al pie de la pared,
    sube (`climbUpTime` 1.1 s) o se deja caer (`climbDownTime` 0.7 s) y sigue. Si lo matan a mitad, cae ahí.
  - **La causa del bug de F2.6:** la franja entre la pileta y la pared este no tenía celdas navegables. Con
    el jugador ahí, `nearestNav` elegía el origen del flow field **dentro de la pileta** (más cerca en línea
    recta) y todos los zombies iban al fondo, sin poder llegar. Fix: `nearestNav(..., los=true)` (solo
    celdas con `segmentClear` hasta el punto) para el origen del campo y para el modo `recover`, y R8 hasta
    x=31 (la franja este tiene la columna x 29.5).
  - Las paredes de la pileta suben hasta y=0, y el piso de R8 termina donde empiezan (`hole` =
    pileta + 0.3 en los 3 lados). Antes se superponían 30 cm y parpadeaban. Azulejo y baldosa con
    filtrado anisotrópico (hasta 8).
  - Test: `pool.js`.
- **Límites invisibles** (`addBoundary`, tag `bound:*`, `mesh: null`), en el mar, los costados de la playa
  y el muelle: frenan al jugador y a los zombies y entran al grid, pero **no frenan balas ni tapan la
  vista**.
  - `segmentClear(..., shotOnly=true)` los ignora. Lo usan la Ray Gun, el lanzallamas y la oclusión de
    gruñidos.
  - El movimiento y el ataque de los zombies lo llaman sin `shotOnly`.
  - Todo código que recorra colliders tiene que tolerar `c.mesh === null`.
- **Rejas D11 y D12:** son puertas de 1.2 m (`makeDoor(..., h)`). Frenan el paso, pero se dispara por encima.
- **Cuartos al aire libre** (`outdoor: true`, que son R1, R8, R10 y R11): sin techo, sin tinte de interior,
  sin vigas ni polvo. `hole` corta el piso (la piscina).
- **Tema:** el plano de arena del patio pasa por debajo de toda la casa, así que es una `ShapeGeometry`
  **con un agujero en la piscina**: si no, la tapa. Si algún día otro cuarto tiene hueco en el piso, hay que
  agregarle ese agujero. El mar empieza en `SEA.z0` = −24, con olas animadas cerca de la orilla
  (`updateSea`; el nivel 2 del gobernador las congela).
- **Caja:** se agregaron lugares en R8 y R10. El del porche se movió al barandal este, porque el frente
  tapaba la reja D11 (lo detectó `mysterybox.js`).
- **Medido** (Chrome, Radeon 610M, 24 zombies vivos): 60 FPS en playa, piscina y sala. Sin límite de
  cuadros, el peor caso es la sala con 139 FPS. `navcost` daba ~0.9 ms de 1 ms, y con los colliders de F1.1
  llegó a 1.09. Con el hash espacial (F1.1) queda en ~0.35 ms.

## Props sólidos (V2 F0.1) — `PROPS` en WORLD
- **Es lógica, no tema.** `buildPropColliders()` corre en `buildMap()` antes de `buildNavGrid()`, con o sin
  tema. Cada prop sólido genera:
  - un collider con tag `prop:<id>`, que usan el jugador, `moveCircle` y `segmentClear`;
  - una caja **invisible** en `hitMeshes`, que frena balas y cuenta para la línea de vista de los spawns, sin
    costo de render.
- El grid no necesitó código: `cellBlocked()` ya lee todos los colliders.
- **Las coordenadas del AABB se copian a mano de `buildTheme()`.** Si movés un mueble allá, movelo en `PROPS`.
  Todo mueble nuevo con volumen va sólido. Lo chico, plano, colgado o fuera del mapa va `decor: true`.
- **Los muebles van contra paredes**, dentro del anillo no navegable, así no cortan caminos. La mesa volcada
  de la sala se corrió a x=−3 porque cortaba la línea D1→D3.
- **Costo medido** (24 zombies en el sótano): la lógica de zombies pasa de 0.37 a 0.52 ms por frame, porque
  los colliders suben de 42 a 56. La colisión es O(zombies × colliders): con el mapa de F1 conviene un hash
  espacial.
- Test: `props.js`. Incluye un zombie que rodea un sofá puesto en el medio de la sala: los sofás reales
  están contra la pared y no pueden quedar entre el zombie y el jugador.

## Audio, menú y estadísticas (P8)
- **Audio 100% procedural** (`src/audio.js`). Cadena: `sfx → compresor → master`; `olas → lowpass → amb → master`.
  Todas las `sfx*` salen sin hacer nada si no hay contexto (`audioOn()`): el harness y los tests no necesitan audio.
- **Loops persistentes**, creados una sola vez: las olas (2 fuentes + 2 LFO, en `initAudio`) y el lanzallamas
  (1 fuente, se crea la primera vez que dispara). Todo lo demás es puntual y lleva su `stop()`: `audio.js`
  verifica que no queden nodos sin detener.
- **Disparos:** capas por arma en `SHOT_SFX`. **Recarga:** 3 pasos según el progreso (`RELOAD_STEPS`); si se
  interrumpe, los que faltan no suenan.
- **Gruñidos:** cada zombie tiene su voz (`z.voice`) y su timer (`z.growlT`). Limitador global `growlGap`;
  más allá de `growlMaxDist` no suena. Detrás de una pared (`segmentClear`) sale apagado y más bajo. Paneo
  estéreo según el ángulo. El ataque y la muerte también gruñen.
- **Olas:** fuertes en el porche, apagadas adentro, casi nada en el sótano (`updateAmbience`).
- **Menú:** inicio y pausa son el mismo overlay `#start` (`data-mode` main|pause). Esc lo maneja el navegador
  (suelta el pointer lock) y `pointerlockchange` decide qué mostrar: `MENU.started` distingue inicio de
  pausa. Pausa real: con `state.running=false` no se actualiza nada. Si Chrome rechaza el re-lock, se avisa
  en `#menuMsg`.
- **Ajustes** (`SETTINGS.sens`, `SETTINGS.volume`): **duran solo la sesión**, porque `localStorage` es solo
  para el récord. Si se quieren guardar, primero hay que levantar esa regla.
- **`STATS`** (sección ROUNDS; se reinicia en `resetGame`): tiempo, puntos ganados (después del doble puntos;
  los gastos no restan), headshots, daño recibido (hasta la vida que quedaba), puertas, usos de la caja y
  kills por arma. `STATS.src` = el arma del último ataque; la setean `fireWeapon`/`meleeAttack` y la lee
  `damageZombie` al matar.
- Tests: `audio.js` (AudioContext falso que registra nodos) y `stats.js` (estadísticas, sensibilidad, menú).

## Generadores, cajas de almas y Pack-a-Punch (V2 F2.5) — `src/souls.js`, `CONFIG.GENERATORS/SOULS/PAP`
- **No es el Power.** `state.power` (palanca del sótano) queda para F2 y enciende perks. El Pack-a-Punch lo
  habilitan los 4 generadores + las 3 cajas llenas (`papReady()`), no el power.
- **Generadores** (muelle, caseta, garaje, piscina): se prenden con un golpe de cuchillo y no se apagan. En
  `meleeAttack()`, un hit con `userData.type === 'generator'` llama a `hitGenerator(key)`. `traceShot` los
  trata como pared: la bala deja marca y no los prende. Al prenderse: lámpara roja→verde (MeshBasic, sin luces),
  chispas, humo cada 0.9 s cerca del jugador y sonido de motor.
- **Cajas de almas** (sótano, piscina, pasillo): `onZombieDeath()` → `soulFromKill(z)`, cualquier arma. Cuenta
  si el zombie muere a ≤ `SOULS.radius` (4 m, en xz) del centro **y** hay línea libre hasta el frente de la
  caja (`segmentClear(..., shotOnly)`): no cuenta a través de paredes, sí dentro de la pileta. 15 almas por
  caja, independientes, con tope. Las cajas están a más de 8 m entre sí: un kill suma a una sola.
  - El círculo de sangre del piso marca el radio. Está recortado al cuarto (si no, se ve del otro lado de
    la pared) y al hueco de la pileta.
  - La barra de sangre se ve a < `showDist` (8 m) y con línea de vista.
- **Pack-a-Punch** en `CONFIG.PAP.spot` (final del muelle). `checkPap()` lo prende una vez: luces, pantalla,
  brillo, brillo en las 3 cajas y sonido. El cartel dice lo que falta, o **PRÓXIMAMENTE** cuando está prendido:
  **la mejora (5000, 4 s, `papName`, daño x2) es F2.** F sobre generador o PaP no hace nada (sonido de negado).
- **Construcción** (`buildRelics`, en `init` después de `buildBox`): los cuerpos sólidos son cajas
  **invisibles** (collider + hitMesh, como `PROPS`). Todo lo estático va fusionado en un `MeshBuilder`, porque
  con meshes sueltos eran +60 draw calls; así quedan +16. Aparte solo quedan lo que cambia de color o lleva
  textura. Partículas en pool (16 aditivas + 8 de humo).
- **Spots** contra la pared, dentro del anillo no navegable: **no cambian el grid** (`generators.js`).
- `resetRelics()` en `resetGame()`: generadores apagados, cajas vacías, PaP apagado.
- Test: `generators.js`.

## Granadas (V2 F2.7) — `src/grenades.js`, `CONFIG.GRENADE`
- **Stock** `state.grenades`: `startRound` suma 2 (`addRoundGrenades`, tope 4), `resetGame` pone 0. Max Ammo
  no las toca.
- **G apretada** (`startCook`): saca el pin, gasta una y pone `weaponsState.phase = 'grenade'`. Mientras
  tanto no se dispara, ni se acuchilla, ni se cambia de arma. Si había una recarga en curso, se corta.
- **Al soltar G** la tira con la mecha que queda. `updateGrenades` mira `keys.KeyG` en vez del keyup, así
  una pausa en medio de la cocción no la deja colgada. Si la mecha (3 s) se termina en la mano, explota ahí.
- **Física propia** (`stepGrenade`): gravedad y 4 subpasos, colisión por eje contra colliders en 3D (con
  `collidersNear`), piso con `groundY` (cae en la pileta) y techo de los cuartos cerrados.
  - Ignora los límites invisibles, como una bala; el borde de la pileta sí la frena desde adentro.
  - Atraviesa zombies.
  - Sale a 0.25 m del ojo, menos que el radio del jugador, así nunca nace dentro de una pared.
- **Explosión** (`explodeAt`): daño = (300 + 50 × ronda) × caída lineal hasta 25% en el borde de los 5 m,
  medido en 3D al centro del cuerpo.
  - Solo con línea libre (`segmentClear` shotOnly, `minTop`): no atraviesa paredes. **Los colliders más
    bajos que el mayor entre el punto de la explosión y el centro del objetivo (1 m del zombie, media altura
    del jugador) no tapan**: mesas y sofás no, la cerca del porche (1.2 m), rejas y paredes sí. Con "más
    bajos que la explosión" solamente no alcanzaba, porque la granada casi siempre explota en el piso (0.09 m).
  - Kills por `damageZombie` → `onZombieDeath`: **cuentan almas solas**. `STATS.src = 'grenade'`.
  - **Daño propio** 50 dentro del radio con línea libre. **Ignora el i-frame y puede matar** (decisión de
    Diego). Shake por distancia.
  - Una luz creada una vez con `intensity=0` y el flash de `splashFx`: no crea objetos.
- HUD: íconos junto a la munición (`#gren`) y barra de mecha (`#cook`). Sonidos: `sfxPin`,
  `sfxGrenadeBounce`, `sfxExplosion`.
- Test: `grenades.js`.

## Power, perks y stamina (V2 F2a) — `src/perks.js`, `CONFIG.POWER/PERKS/STAMINA`
- **Stamina** (`stamina` en player.js):
  - 4 s de sprint, recarga completa en 3 s tras 0.3 s sin correr.
  - Si se vacía no volvés a correr hasta el 30%, y suena `sfxBreath`.
  - Barra `#stam` abajo al centro.
  - Con stamina 0 caminás a 4.4: los corredores (4.0 ± 10%) como mucho te igualan, nunca te alcanzan por detrás.
- **Power:**
  - F sobre el prop `generador` de R7 (`turnOnPower`, gratis). **F5.6: solo con los 4 generadores de F2.5
    prendidos** (`powerMissing()`).
  - Las 6 lámparas pasan a `steady` × `POWER.lampMul`, cambiando solo `intensity`. `L.mode0` guarda el modo
    original para `resetGame`.
  - **No habilita el Pack-a-Punch** (eso es de F2.5).
- **Perks** (máx 4): QR 500 R1 · Juggernog 2500 R2 · Speed Cola 3000 R6 · Double Tap 2000 R8 · Stamin-Up 2000 R10.
  - Sin power: "necesita energía".
  - Los efectos se leen con helpers donde se usa cada número; nunca se toca CONFIG.WEAPONS/PLAYER:
    - `maxHealth()`: 250 con Jugg (regeneración, viñeta);
    - `perkReload()`: ×0.5 en `updateWeapon`;
    - `perkRate()` / `perkDmg()`: ×1.33 en `fireWeapon`, `traceShot` y el área de la Ray Gun; en el
      lanzallamas son los dos juntos;
    - `sprintMul()` / `staminaMul()`: ×1.2 y ×2.
- **Quick Revive (solo, Black Ops):** si el golpe letal llega con QR, en `damagePlayer` `tryRevive()` te revive
  con la vida llena, **sin ningún perk**, y 2 s de invulnerabilidad (corre `lastDamageTime` hacia adelante).
  También funciona con tu propia granada. Se compra 3 veces por partida y la máquina desaparece: `hideMachine`
  apaga el collider y la saca de hitMeshes, y `resetGame` la devuelve.
- **Máquinas:** cada una con su `MeshBuilder` (así QR puede desaparecer), cartel con el nombre y lámpara
  MeshBasic que late. **Ninguna luz nueva.** Jingle al acercarse (con power, una vez por visita). Íconos en
  `#perks` abajo a la izquierda. Los spots van en el anillo no navegable.
- Tests: `perks.js`, `stamina.js`.

## Pack-a-Punch: la mejora (V2 F2b) — `souls.js` (`usePap`), `weapons.js` (`papDef`), `CONFIG.PAP`
- **Flujo:** 5000 con la máquina prendida (4 generadores + 3 cajas; el power no hace falta).
  - El slot sale del inventario (`PAPST.slot`): si no te queda otra arma, quedás con **las manos vacías**.
    `equipModel(null)` y `updateWeapon` sin def, y cuchillo y granadas igual funcionan.
  - 4 s trabajando, después el arma queda en la bandeja y tenés **10 s para agarrarla con F**; si no, se
    pierde, como la caja.
  - **Sin re-PaP.**
- **Mejorada:** `slot.pap = true`. `slotDef(slot)` devuelve `papDef(id)`, un def cacheado que se arma una vez
  con todo el daño ×2 (bala, área de la Ray Gun, dps del lanzallamas), cargador y reserva ×1.5 y
  `name = papName`. **CONFIG.WEAPONS no se toca.**
  - Todo lo que lee munición o daño pasa por `slotDef`/`curDef`: Max Ammo, wall buys, carteles, HUD.
  - Munición en la pared: `ammoCostOf(slot)` = 2500 si está mejorada.
  - Camo por canvas (`applyCamo`), nombre violeta en el HUD.
- **Nombres (en inglés):** M1911 RED TIDE · Escopeta BREAKWATER · Subfusil CICADA · Rifle THE LIGHTHOUSE ·
  LMG HURRICANE · Ray Gun LUNAR TIDE · Francotirador PELICAN EYE · Lanzallamas WATER VOLCANO.
- **Mientras el arma está adentro, sigue siendo tuya:**
  - La caja no la ofrece.
  - Si la compraste en la pared mientras tanto, al agarrar la mejorada reemplaza a la comprada: nunca dos iguales.
- Los modelos de la bandeja (8, con camo) se construyen una vez. `resetGame` vacía la máquina.
- Test: `pap.js`.

## Escudo y banco de trabajo (V2 F3a) — `src/shield.js`, `CONFIG.SHIELD`
- **Piezas:** 3 (puerta de alacena, tabla de surf rota, manija de metal). Cada una se sortea en 1 de sus 3
  lugares por partida (`rollShieldSpots`, en `resetGame`).
  - **Sin collider:** van en el piso y se agarran con F desde su cuarto (al punto, como los drops), así que
    no tocan el grid ni frenan balas.
  - 3 íconos en `#shieldhud`.
- **Banco:** el prop `banco` del garaje.
  - Con las 3 piezas, mantener F 3 s lo arma. `updateShield` mira `keys.KeyF` con el cartel del banco
    activo; soltar corta el armado.
  - `interact()` maneja `part` y `bench` aparte: sin el sonido genérico de compra.
  - `built` dura toda la partida: si se rompe, se vuelve a sacar con un toque de F, con la durabilidad
    llena, y el modelo lo espera en el banco.
- **Bloqueo:** en el ataque del zombie, `shieldBlocks` va antes de `damagePlayer`.
  - En la espalda (`has` sin equipar): bloquea de atrás, ±60°.
  - Equipado (tecla 3, `weaponsState.phase === 'shield'`): bloquea de frente.
  - Cada bloqueo le resta el daño del golpe (500 = 20 golpes); en 0 se rompe.
  - La granada propia no pasa por acá: el escudo no la para.
- **Equipado:** no dispara, ni acuchilla, ni saca granadas, y el arma queda fuera de vista. Clic =
  `shieldBash`:
  - 100 de daño en un cono de ±60° a 2 m, con línea libre;
  - empuja 2 m de a pasos con `moveCircle` (respeta paredes);
  - cooldown 0.8 s; `STATS.src = 'shield'`.
  - Tecla 3 otra vez, Q, 1 o 2, o comprar un arma: se guarda (`raiseWeapon`).
- **Teclas numéricas:** 1 y 2 = armas (`selectWeapon`), 3 = escudo.
- Test: `shield.js`.

## Armas nuevas y ADS (V2 F3b)
- **Revólver** (900, cerca de la playa), **Doble cañón** (1500, tablón propio en el muelle; `post:true`),
  **Ballesta** (solo en la caja).
  - `papName`: SEA SERPENT, TWIN TIDES, NARWHAL.
  - Wall buys sobre paredes a lo largo de x: `axis:'z'` (face ±1 = hacia ±z), `y` = altura de la tiza (en la
    cerca, 0.6).
- **Ballesta:** `pierce:3` → `tracePierce`: daña a cada zombie una sola vez (aunque el rayo toque varias
  partes), hasta 3, y frena en la primera pared.
- **Machete** (3000, pared sur de la cocina):
  - `state.machete`; `meleeDef()` devuelve el cuchillo con daño 500 parejo (sin multiplicador de cabeza),
    mismo cooldown y alcance. No ocupa slot, el PaP no lo toca, y `resetGame` vuelve al cuchillo.
  - `STATS.src = 'machete'`.
- **ADS** (`ADS` en weapons.js, `CONFIG.ADS`): clic derecho mantenido. **El cuchillo quedó solo en V.**
  - `ADS.k` entra y sale en 0.15 s, solo con arma, en `idle` y sin correr.
  - Baja el FOV de la cámara del mundo de 75 a 55 (el francotirador a `adsFov` 30); el arma tiene su
    propia cámara y no cambia.
  - Dispersión ×0.4 (`adsSpread`), velocidad ×0.7, y apuntando no se corre.
  - Sensibilidad × FOV/75 (`lookInput`); el arma va al centro.
- **Recarga por arma** (`def.reloadAnim`: pistol, revolver, break, bolt, shells, belt, mag). Es solo visual:
  tiempos y munición iguales.
- Draw calls "todo visible" en `theme.js`: 164 (141 antes de F3b), por los modelos de pared, de la bandeja
  del PaP y de la caja.
- Test: `weapons2.js`.

## Subirse a muebles (V2 F2.8) — `player.js` (`moveAxis`, `floorAt`), `CONFIG.PLAYER.stepUp/climbReach`
- **Piso** = `floorAt(x, z, pies)`: el terreno (`groundY`) o el tope más alto de un collider pisable
  (`standable`) debajo de los pies. Se calcula con los pies de ANTES del paso vertical: si caés rápido sobre
  una mesa, un frame la atravesaría.
- **Trepar:** en `moveAxis`, si chocás un pisable cuyo tope está a `stepUp` (0.3, caminando) o `climbReach`
  (0.55, en el aire) de tus pies, y hay lugar arriba (`headroom`), subís en vez de frenar.
  - Saltando (0.44) llegás hasta ~1 m: mesas, sofá (0.92), cama, banco, refri.
  - No llegás al generador (1.4) ni a la camioneta.
  - **No se pisan** paredes, barandales, puertas/rejas, límites invisibles ni el borde de la piscina.
- **Parado arriba no chocás** con lo que pisás (`pies >= maxY`).
- **Los zombies igual te pegan:** si estás arriba de algo (pies > 0.1 m sobre el terreno), su `segmentClear`
  de ataque ignora lo que está por debajo de tus pies (`minTop`). Si no, parado en el sofá eras intocable.
  El grid de los zombies sigue siendo 2D: no suben.
- Test: `climb.js`.

## Techo de la casa (V2 F2.8) — `UP`, `buildRoof`, `buildRoofEdges` en world.js
- **Todo el techo de la casa es sólido, a `UP.y` = 4.3 m.** F5.6: solo se camina una pasarela
  (`UP.walk`) con barandas, plantas carnívoras y una segunda escalera. Ver "Jardines, techo y muelle"; lo de
  abajo describe el techo entero de F2.8.
  - Los techos de los cuartos cerrados son colliders (`overhead` + `roofSurface`). Los huecos entre cuartos
    (`UP.fillers`) están tapados: si no, te caías a un bolsillo fuera del mapa.
  - `UP.mask` (1×1) dice dónde hay techo; `roofAt(x, z)`.
- **Bordes** (`buildRoofEdges`, automático sobre la máscara):
  - Hacia un lugar jugable al aire libre (porche, patio de la piscina, puente C13), **abierto**: te tirás.
  - Hacia el vacío (laguna, afuera del mapa), un límite invisible de 2 m (`bound:roof`, no frena balas).
  - Los abiertos llevan igual un límite **solo para zombies** (`bound:roofz`, `zombieOnly`: el jugador lo
    ignora en `moveAxis`/`headroom`). Sin eso, 12 zombies apretados contra el borde del porche dejaban
    hasta 3 flotando afuera (medido; `roof.js` lo prueba).
- El descanso se arma solo con lo que queda fuera del techo de la caseta: superpuesto, las dos caras de
  arriba parpadeaban.
- **Pendiente de decidir:** las láminas del tema sobre el porche (y 4.02) no son sólidas. Desde el techo de
  la sala caminás "sobre" ellas y caés al porche.
- **Caída:** desde `PLAYER.fallHeight` (3 m) o más te deja en **`fallHealth` = 10 de vida** (si tenías más;
  no mata). Tirarse a la pileta (1.6 m) no lastima.
  - `player.airTop` guarda la altura desde donde caés.
  - Arreglo de paso: al caer de un borde, `grounded` ahora pasa a false (antes seguías "en el piso", sin
    aterrizaje ni caída).
- Se sube por una **escalera** contra la pared norte del patio (x 29.8 → 25, 1 m de ancho, 15 escalones)
  hasta un **descanso** (`UP.landing`, x 21–25, z 19–22) que conecta con el techo de la caseta.
  - **Sin pasamanos** (pedido de Diego). Su costado frena como si fuera maciza: en `moveAxis`, si el
    cuerpo entra a la huella donde la rampa está más alta que un escalón sobre tus pies, ese eje no avanza.
    Se entra solo por abajo (esquina NE del patio).
  - El macetero pasó a z 16.5–17.7 y la mystery box del patio a la pared este (30.45, 14.5).
- **Para el jugador la escalera es una rampa** (`floorAt`): los escalones son solo visuales. Miden 0.32 m
  y el jugador 0.7, así que pisaría dos a la vez. La altura se mide en el borde delantero (x − r) y la rampa
  termina justo en el borde del descanso (x 25), así no hay escalón.
- **Colliders `overhead`** (techos, descanso, bordes invisibles):
  - Los ignoran el grid del piso (`cellBlocked`), los zombies del piso (`moveCircle`) y `segmentClear` en
    capa 0, que es la de siempre: los cuartos de abajo siguen igual.
  - En capa 1 (arriba) solo cuentan los que no son superficie (`!roofSurface`: los bordes).
  - El jugador usa su colisión 3D de siempre.
  - **Todo test que recorra colliders en 2D tiene que saltear `overhead`** (lo hacen `pathfinding.js`,
    `crowd.js`, `shield.js` y `navcost.js`).
- **Segundo nivel del grid:** `UP.cells` (41×36, ~960 navegables), con índices después del piso
  (`NAV.base`, `upIdx`). El BFS pasó de ~0.013 a ~0.05 ms.
  - El BFS recorre los dos niveles y la escalera es un enlace (`NAV.link`) con recorrido fijo por los
    escalones (`NAV.via`).
  - `z.level` (0/1) y `playerLevel()` (`levelAt`) deciden todo:
    - `steerZombie` usa el grid de su nivel;
    - solo pegan, empujan y se separan zombies del mismo nivel;
    - `placeRoot` suma `UP.y` arriba;
    - `startClimb` con `via` camina los escalones subiendo parejo.
- **Granadas:** el techo interior solo frena a la que venía de adentro (la que cae desde arriba queda sobre
  el techo), y la explosión no cruza el techo (nivel de la explosión = `levelAt`).
- Test: `roof.js`.

## Pendiente
- **F4 en adelante** según ROADMAP-V2. El techo de la casa no tiene contenido todavía.
- Cuchillo: V, clic de la ruedita o girar la ruedita. El giro se acumula y pega recién con un "clic" entero
  (100 de delta, se olvida a los 0.3 s): un touchpad manda micro-giros y acuchillaba con cualquier roce. Los modelos de las 8 armas de V1 no se detallaron más en F3 (solo los
  nuevos): queda para F7. **P9 Balance** después de jugar.
- **P9 Balance** después de jugar. Solo CONFIG. En F2.5 revisar `SOULS.need` (15) y `radius` (4).

## Riesgos conocidos
- Zig-zag en diagonales largas (siguen centros de celda). Fix posible: string pulling con `segmentClear`.
- Visibilidad de spawn se chequea al elegir, no durante los 0.7 s de emerge.
- Sótano: 3 luces puntuales solapadas, Lambert por vértice. Vigilar FPS.
- Tras `exitPointerLock`, Chrome puede rechazar el re-lock ~1 s. Por eso el overlay de inicio queda visible tras reiniciar.
