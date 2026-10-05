/** Explicit review-demo pilot only. Never enabled by an ordinary game start. */
import { rerollOverflightUpgrades } from './core.mjs';

export const QUALIFICATION_BUILDS = Object.freeze({
  fan: ['primary:wide', 'proximity-pulse', 'side-burst', 'scanner'],
  echo: ['primary:double', 'slow-field', 'proximity-pulse', 'shield'],
  systems: ['proximity-pulse', 'side-burst', 'scanner', 'primary:double'],
});
export function selectCard(run, direction = 'fan') {
  const preferences = QUALIFICATION_BUILDS[direction];
  if (!preferences) throw new RangeError('Unknown Overflight review build.');
  const score = (card) => {
    const index = preferences.findIndex((prefix) => card.id.startsWith(prefix));
    return index < 0
      ? card.system === 'repair'
        ? 30
        : 50
      : index * 5 + (card.kind === 'evolution' ? -1 : 0);
  };
  let sorted = [...run.offers].sort((a, b) => score(a) - score(b));
  if (score(sorted[0]) >= 30 && run.progression.rerolls > 0) {
    rerollOverflightUpgrades(run);
    sorted = [...run.offers].sort((a, b) => score(a) - score(b));
  }
  return sorted[0];
}

/** A deterministic, imperfect pilot, recomputed at 10Hz; it sees ordinary game state.
 * It pursues salvage, skirts the boss, and compares short movement candidates to
 * avoid nearby bodies/committed attack circles. It cannot alter the simulation. */
export function pilot(run, route = 'tight') {
  const player = run.player;
  const arena = run.compiled.arena;
  const phase = run.time * (route === 'tight' ? 0.55 : 0.32);
  let goalX = arena.width / 2 + Math.cos(phase) * (route === 'tight' ? 120 : 280);
  let goalY = arena.height / 2 + Math.sin(phase * (route === 'figure-eight' ? 2 : 1)) * 140;
  let bestPickup = Infinity;
  for (const pickup of run.pickups) {
    if (!pickup.active) continue;
    const distance = Math.hypot(pickup.x - player.x, pickup.y - player.y);
    const score = distance / Math.min(3, Math.sqrt(pickup.value));
    if (distance > 55 && score < bestPickup && distance < 500) {
      bestPickup = score;
      goalX = pickup.x;
      goalY = pickup.y;
    }
  }
  const final = run.enemies.find((enemy) => enemy.active && enemy.role === 'final');
  if (final) {
    const angle = Math.atan2(player.y - final.y, player.x - final.x) + 0.6;
    goalX = final.x + Math.cos(angle) * 80;
    goalY = final.y + Math.sin(angle) * 80;
  }
  const enemies = run.enemies.filter(
    (enemy) =>
      enemy.active &&
      enemy.warning <= 0 &&
      Math.abs(enemy.x - player.x) < 190 &&
      Math.abs(enemy.y - player.y) < 190,
  );
  let best = -Infinity,
    input = { x: 0, y: 0, boost: false };
  const before = Math.hypot(goalX - player.x, goalY - player.y);
  for (const magnitude of [0.35, 0.6, 1]) {
    for (let index = 0; index < 20; index++) {
      const angle = (index * Math.PI) / 10;
      const vx = Math.cos(angle) * magnitude * 180,
        vy = Math.sin(angle) * magnitude * 180;
      const x = player.x + vx * 0.42,
        y = player.y + vy * 0.42;
      if (x < 40 || y < 40 || x > arena.width - 40 || y > arena.height - 40) continue;
      let score = (before - Math.hypot(goalX - x, goalY - y)) * 0.8;
      for (const enemy of enemies) {
        const dx = player.x - enemy.x,
          dy = player.y - enemy.y;
        const length = Math.hypot(dx, dy) || 1;
        const predictedX = enemy.x + (dx / length) * enemy.speed * 0.3;
        const predictedY = enemy.y + (dy / length) * enemy.speed * 0.3;
        const distance = Math.min(
          Math.hypot(predictedX - x, predictedY - y),
          Math.hypot(enemy.x - (player.x + x) / 2, enemy.y - (player.y + y) / 2),
        );
        const safety = enemy.radius + player.radius + 18;
        if (distance < safety) score -= 100 + (safety - distance) * 15;
        else if (distance < safety + 35) score -= (safety + 35 - distance) * 0.15;
      }
      for (const attack of run.priorityAttacks) {
        if (attack.active && Math.hypot(x - attack.x, y - attack.y) < attack.radius + 18)
          score -= 500;
      }
      // Small direction continuity penalty prevents purely numerical jitter.
      score -= Math.abs(vx - player.vx) * 0.005 + Math.abs(vy - player.vy) * 0.005;
      if (score > best) {
        best = score;
        input = { x: vx / 180, y: vy / 180, boost: false };
      }
    }
  }
  if (best < -100 && player.boostCooldown === 0) input.boost = true;
  return input;
}
