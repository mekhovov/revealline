import { overflightHuntContactState, overflightHuntBoostRecovery } from './raid-core.mjs';
import { overflightTerrainWaypoint } from './terrain.mjs';

const preferences = {
  sweeper: ['strike-width', 'slow-wake', 'rush-charge'],
  pursuer: ['boost-cooldown', 'boost-duration', 'chain-window'],
  breaker: ['heavy-exposure', 'guard-interrupt', 'recovery-shield'],
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Explicit review automation only. It reads public state and submits ordinary
 * steering/boost/card choices; it never grants power, moves actors or changes health. */
export function createOverflightHuntReviewPilot({ route = 'objectives', build = 'pursuer' } = {}) {
  if (!['objectives', 'packs'].includes(route) || !Object.hasOwn(preferences, build))
    throw new RangeError('Unknown Raid review route or build.');
  let targetId = null,
    previousBoost = false;
  return {
    input(run) {
      const p = run.player,
        boostRecovery = overflightHuntBoostRecovery(run);
      let target = run.enemies.find((enemy) => enemy.active && enemy.id === targetId);
      const packBudget = [50, 120, 180][run.hunt.sector];
      const huntingPacks = route === 'packs' && run.hunt.ordinaryKills < packBudget;
      if (!target || (!huntingPacks && !target.objectiveId)) {
        const candidates = run.enemies.filter(
          (enemy) =>
            enemy.active &&
            enemy.warning <= 0 &&
            (huntingPacks ? !enemy.objectiveId && !enemy.maxArmorSegments : !!enemy.objectiveId),
        );
        candidates.sort((a, b) => distance(p, a) - distance(p, b) || a.id - b.id);
        target = candidates[0] ?? run.enemies.find((enemy) => enemy.active && enemy.objectiveId);
        targetId = target?.id ?? null;
      }
      if (!target) {
        previousBoost = false;
        return { x: 0, y: 0, boost: false };
      }
      const d = distance(p, target),
        state = overflightHuntContactState(target, p);
      let goalX = target.x + target.vx * Math.min(0.4, d / 180),
        goalY = target.y + target.vy * Math.min(0.4, d / 180);
      let attack = true;
      const heading = target.heading,
        outward = Math.atan2(p.y - target.y, p.x - target.x);
      if (target.behavior === 'shield' && state === 'guarded') {
        const rear = heading + Math.PI;
        let delta = Math.atan2(Math.sin(rear - outward), Math.cos(rear - outward));
        delta = Math.max(-0.65, Math.min(0.65, delta));
        goalX = target.x + Math.cos(outward + delta) * 64;
        goalY = target.y + Math.sin(outward + delta) * 64;
        attack = false;
      } else if (
        state === 'guarded' ||
        state === 'machinery-guarded' ||
        (target.maxArmorSegments &&
          (target.armorContactLatched || (boostRecovery > 0 && p.boostRemaining <= 0)))
      ) {
        const radius = 92;
        goalX = target.x + Math.cos(outward + 0.5) * radius;
        goalY = target.y + Math.sin(outward + 0.5) * radius;
        attack = false;
      }
      // A protected escort can block the intended objective approach. Route
      // around its committed facing using the same visible contact state a
      // player sees, rather than repeatedly driving into the screen.
      const gx = goalX - p.x,
        gy = goalY - p.y,
        goalDistance = Math.hypot(gx, gy) || 1;
      let blocker = null,
        blockerDistance = Infinity;
      for (const enemy of run.enemies) {
        if (!enemy.active || enemy.id === target.id || enemy.warning > 0) continue;
        const protectedState = overflightHuntContactState(enemy, p);
        if (!['guarded', 'machinery-guarded'].includes(protectedState)) continue;
        const dx = enemy.x - p.x,
          dy = enemy.y - p.y,
          along = (dx * gx + dy * gy) / goalDistance,
          across = Math.abs(dx * gy - dy * gx) / goalDistance;
        if (
          along > 0 &&
          along < Math.min(100, goalDistance) &&
          across < enemy.radius + p.radius + 12 &&
          along < blockerDistance
        ) {
          blocker = enemy;
          blockerDistance = along;
        }
      }
      if (blocker) {
        const outward = Math.atan2(p.y - blocker.y, p.x - blocker.x);
        const rear = blocker.heading + Math.PI;
        const delta = Math.max(
          -0.65,
          Math.min(0.65, Math.atan2(Math.sin(rear - outward), Math.cos(rear - outward))),
        );
        const radius = blocker.radius + p.radius + 48;
        goalX = blocker.x + Math.cos(outward + delta) * radius;
        goalY = blocker.y + Math.sin(outward + delta) * radius;
        attack = false;
      }
      // Already-fired shots are independent of their owner's body. Avoid them
      // with a short perpendicular diversion, without hiding them from the core.
      for (const shot of run.projectiles) {
        if (!shot.active || distance(p, shot) > 65) continue;
        const speed = Math.hypot(shot.vx, shot.vy) || 1;
        const lateral = (p.x - shot.x) * -shot.vy + (p.y - shot.y) * shot.vx >= 0 ? 1 : -1;
        goalX = p.x - (shot.vy / speed) * 65 * lateral;
        goalY = p.y + (shot.vx / speed) * 65 * lateral;
        attack = false;
        break;
      }
      // Review automation must use the same visible cover as a human pilot.
      // This only changes submitted steering, never actor positions or combat.
      const waypoint = run.terrain
        ? overflightTerrainWaypoint(run.terrain, p, { x: goalX, y: goalY }, run.compiled.arena)
        : { x: goalX, y: goalY };
      if (waypoint.x !== goalX || waypoint.y !== goalY) attack = false;
      const dx = waypoint.x - p.x,
        dy = waypoint.y - p.y,
        length = Math.hypot(dx, dy) || 1;
      const boost = attack && d < 88 && d > 10 && boostRecovery <= 0 && !previousBoost;
      previousBoost = boost;
      return { x: dx / length, y: dy / length, boost };
    },
    choose(run) {
      const rank = (card) => {
        const index = preferences[build].indexOf(card.system);
        return index < 0 ? 20 : index;
      };
      return (
        [...run.offers].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))[0] ?? null
      );
    },
  };
}
