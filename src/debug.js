//=== 8c. MODO DEBUG ========================================================
// Solo con CONFIG.DEBUG_MODE (true en desarrollo, false en cualquier build final). Con false no queda
// ningún truco: las teclas no hacen nada, no hay overlay ni cartel.
//   P  +CONFIG.DEBUG.points puntos        N  noclip / vuelo (toggle)
//   ]  siguiente ronda                    [  la ronda anterior (mínimo 1)
//   O  +15000, puertas, generadores, energía y almas (F5.10)   B  pintar el grid de navegación
//   H  mostrar / ocultar el overlay        K  ronda de perros ya (la siguiente)
//   J  ronda de boss ya (la siguiente)
const DEBUG = { noclip: false, safeFall: false };

function debugKey(code, repeat) {
  if (!CONFIG.DEBUG_MODE || repeat) return false;
  if (code === 'KeyP') { state.points += CONFIG.DEBUG.points; return true; }
  if (code === 'KeyN') { toggleNoclip(); return true; }
  if (code === 'BracketRight') { debugRound(state.round + 1); return true; }
  if (code === 'BracketLeft') { debugRound(Math.max(1, state.round - 1)); return true; }
  if (code === 'KeyK') { roundState.nextDog = state.round + 1; debugRound(state.round + 1); return true; }
  if (code === 'KeyJ') { roundState.forceBoss = state.round + 1; debugRound(state.round + 1); return true; }
  if (code === 'KeyO') { debugUnlockAll(); return true; }
  if (code === 'KeyX') { devMaxAccount(); return true; }            // F5.18b: cuenta al máximo y todos los chicles (solo la sesión)
  if (code === 'KeyB') { toggleNavDebug(); return true; }
  if (code === 'KeyH') { UI.debug.style.display = UI.debug.style.display === 'none' ? '' : 'none'; return true; }
  return false;
}

// F5.10: O = +unlockPoints, todas las puertas, los 4 generadores, la energía y las 3 cajas de almas llenas (se
// prende el Pack-a-Punch). NO toca las plantas de la caracola: ese paso se sigue haciendo a mano
function debugUnlockAll() {
  state.points += CONFIG.DEBUG.unlockPoints;
  debugOpenAllDoors();
  for (const k of GEN_KEYS) hitGenerator(k);
  turnOnPower();
  for (const k of SOUL_KEYS) state.souls[k] = CONFIG.SOULS.need;
  checkPap();
  // F5.13: también el búnker (las estatuas quedan despiertas y completas)
  for (const s of BUNK.statues) { if (!s.awake) wakeStatue(s); s.crawlers = CONFIG.BUNKER.eatCrawlers; s.dogs = CONFIG.BUNKER.eatDogs; s.done = true; }
  openBunker();
  SQHEAD.force = CONFIG.SQUIDHEAD.openRound; setSquidHead(state.round, true);   // la cabeza del calamar, afuera y abierta
  updateFlowField(true);
}

// saltar a la ronda n: se van los zombies vivos (sin puntos ni almas) y arranca n sin la pausa
function debugRound(n) {
  for (const z of state.zombies) deactivateZombie(z);
  state.zombies.length = 0;
  startRound(n);
  updateFlowField(true);
}

function toggleNoclip() {
  DEBUG.noclip = !DEBUG.noclip;
  player.vel.set(0, 0, 0);
  if (!DEBUG.noclip) { player.grounded = false; DEBUG.safeFall = true; }   // al apagarlo cae, sin daño por caída
  updateDebugBanner();
}
// vuelo: hacia donde mirás (con el pitch), sin gravedad ni colisiones. Espacio sube, Ctrl/C baja, Shift rápido
function updateNoclip(dt) {
  const D = CONFIG.DEBUG, sp = D.flySpeed * (keys['ShiftLeft'] ? D.flyFast : 1) * dt;
  const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw), cp = Math.cos(player.pitch), spc = Math.sin(player.pitch);
  let f = 0, s = 0, u = 0;
  if (keys['KeyW']) f += 1;
  if (keys['KeyS']) f -= 1;
  if (keys['KeyD']) s += 1;
  if (keys['KeyA']) s -= 1;
  if (keys['Space']) u += 1;
  if (keys['ControlLeft'] || keys['KeyC']) u -= 1;
  player.pos.x += (-sy * cp * f + cy * s) * sp;
  player.pos.z += (-cy * cp * f - sy * s) * sp;
  player.pos.y += (spc * f + u) * sp;
  player.speedNow = 0;
}

function updateDebugBanner() {
  if (!UI.debugMode) return;
  UI.debugMode.style.display = CONFIG.DEBUG_MODE ? '' : 'none';
  UI.debugMode.textContent = 'DEBUG MODE' + (DEBUG.noclip ? ' · NOCLIP' : '');
}
function resetDebug() {
  DEBUG.noclip = false; DEBUG.safeFall = false;
  if (UI.debug) UI.debug.style.display = CONFIG.DEBUG_MODE ? '' : 'none';
  updateDebugBanner();
}
