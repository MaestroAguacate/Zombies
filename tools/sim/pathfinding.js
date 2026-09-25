// 12 zombies persiguiendo al jugador por los 7 cuartos durante 4 min.
// PASA si: 0 frames dentro de pared, 0% en modo lost, strikes < 4.
const G = require('./harness.js');
const { state, player, WORLD } = G;
state.running = true; G.debugOpenAllDoors(); G.roundState.phase = 'off';
const dt = 1 / 60, keep = 12;
const route = [[0,0],[-7.6,5.2],[7.6,17.6],[17.6,4.5],[11,16],[15.6,29.6],[0,27.6],[-15.6,18.4],[-15.6,39.6],[-4.4,39.6],[-10,24],[0,10]];
let seg = 0, hold = 0, hits = 0, maxStrikes = 0, inWall = 0; const modeT = {}, wallTags = {};
for (let step = 0; step < 60 * 240; step++) {
  G.tick(dt);
  const [tx, tz] = route[seg % route.length];
  const dx = tx - player.pos.x, dz = tz - player.pos.z, d = Math.hypot(dx, dz);
  if (d > 0.05) { const s = Math.min(d, 3 * dt); player.pos.x += dx / d * s; player.pos.z += dz / d * s; }
  else if ((hold += dt) > 6) { hold = 0; seg++; }
  G.setCam(Math.atan2(-dx, -dz) || 0);
  if (G.aliveCount() < keep && step % 20 === 0) G.spawnZombie();
  G.updateFlowField(false);
  const h = state.health; G.updateZombies(dt);
  if (state.health < h) hits++;
  state.health = 100; state.gameOver = false;
  for (const z of state.zombies) {
    if (!z.alive) continue;
    if (z.state === 'walk') modeT[z.mode] = (modeT[z.mode] || 0) + dt;
    maxStrikes = Math.max(maxStrikes, z.strikes);
    for (const c of WORLD.colliders) {
      // F2.8: por nivel, como moveCircle: en el piso no cuenta lo de arriba (el techo de la caseta); arriba, solo sus barandales
      if (z.level === 1 ? (!c.overhead || c.roofSurface) : c.overhead) continue;
      if (c.solid && z.px > c.minX + .05 && z.px < c.maxX - .05 && z.pz > c.minZ + .05 && z.pz < c.maxZ - .05) {
        const k = c.tag + '/' + z.state; wallTags[k] = (wallTags[k] || 0) + 1;
        if (z.state !== 'climb') inWall++;     // F2.6: trepando una escalera cruza el borde de la piscina a propósito
        break;
      }
    }
  }
  if (step % 180 === 0) for (const z of state.zombies)
    if (z.alive && Math.hypot(z.px - player.pos.x, z.pz - player.pos.z) < 1.3) G.damageZombie(z, 9999, false);
}
const tot = Object.values(modeT).reduce((a, b) => a + b, 0);
for (const k in modeT) console.log('  modo', k, (modeT[k] / tot * 100).toFixed(1) + '%');
console.log('golpes:', hits, ' kills:', state.kills, ' maxStrikes:', maxStrikes, ' framesEnPared:', inWall);
if (Object.keys(wallTags).length) console.log('  dentro de un collider (tag/estado -> frames):', JSON.stringify(wallTags));
const lost = (modeT.lost || 0) + (modeT.unreachable || 0);
const ok = inWall === 0 && lost === 0 && maxStrikes < 4;
console.log(ok ? 'PASA' : 'FALLA'); process.exit(ok ? 0 : 1);
