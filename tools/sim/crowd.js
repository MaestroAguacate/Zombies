// 24 zombies contra el jugador quieto en la esquina del sótano (fuera del grid), 90s.
// PASA si: >=15 llegan a <2m, ninguno llega a 4 strikes seguidos (no hay respawn falso por hacer fila), 0 en pared.
// Strikes sueltos son normales: la cola de 24 se estira más allá de stuckIgnoreDist y reciben un empujón lateral.
const G = require('./harness.js');
const { state, player, WORLD } = G;
state.running = true; G.debugOpenAllDoors(); G.roundState.phase = 'off';
const dt = 1 / 60;
player.pos.set(-15.6, 1.7, 39.6); G.setCam(Math.PI * 0.75);
let strikes = 0, inWall = 0, maxNear = 0, maxStrk = 0; const prev = new Map();
for (let step = 0; step < 60 * 90; step++) {
  G.tick(dt);
  if (G.aliveCount() < 24 && step % 18 === 0) G.spawnZombie();
  G.updateFlowField(false); G.updateZombies(dt); state.health = 100; state.gameOver = false;
  let near = 0;
  for (const z of state.zombies) {
    if (!z.alive) continue;
    if (Math.hypot(z.px - player.pos.x, z.pz - player.pos.z) < 2) near++;
    if (z.strikes > (prev.get(z) || 0)) strikes++; prev.set(z, z.strikes); maxStrk = Math.max(maxStrk, z.strikes);
    for (const c of WORLD.colliders) {
      if (z.level === 1 ? (!c.overhead || c.roofSurface) : c.overhead) continue;   // F2.8: por nivel (el techo está arriba)
      if (c.solid && z.px > c.minX + .05 && z.px < c.maxX - .05 && z.pz > c.minZ + .05 && z.pz < c.maxZ - .05) { inWall++; break; }
    }
  }
  maxNear = Math.max(maxNear, near);
}
console.log('max a <2m:', maxNear, ' strikes:', strikes, ' maxSeguidos:', maxStrk, ' framesEnPared:', inWall);
const ok = maxNear >= 15 && maxStrk < G.CONFIG.ZOMBIE.stuckStrikes && inWall === 0;
console.log(ok ? 'PASA' : 'FALLA'); process.exit(ok ? 0 : 1);
