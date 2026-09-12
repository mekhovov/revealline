import { EPS, movingCirclesTime, boxTime } from './geometry.mjs';
import { pathPoint } from './movement.mjs';

const a = (s) => ({ x: s.x1, y: s.y1 }),
  b = (s) => ({ x: s.x2, y: s.y2 });
const overlap = (p, q, horizon) => [Math.max(p.t0, q.t0), Math.min(p.t1, q.t1, horizon)];
function remember(best, time, kind, id) {
  if (time == null) return best;
  if (!best || time < best.time - EPS || (Math.abs(time - best.time) < EPS && id < best.id))
    return { time, kind, id };
  return best;
}

export function enemyContact(state, playerPaths, enemyPlans, trace, horizon) {
  if (state.player.graceUntil > state.time + EPS) return null;
  let best = null;
  for (let n = 0; n < state.enemies.length; n++) {
    const enemy = state.enemies[n],
      plan = enemyPlans[n];
    for (const path of plan.paths) {
      if (path.t0 > horizon + EPS) continue;
      const endTime = Math.min(path.t1, horizon),
        start = a(path),
        end = pathPoint(path, endTime);
      for (const trail of state.trail) {
        const t = boxTime(start, end, {
          x: trail.x - enemy.radius,
          y: trail.y - enemy.radius,
          w: 1 + enemy.radius * 2,
          h: 1 + enemy.radius * 2,
        });
        if (t != null)
          best = remember(best, path.t0 + (endTime - path.t0) * t, 'enemy-trail', enemy.id);
      }
      for (const trail of trace.cells) {
        const lo = Math.max(path.t0, trail.time),
          hi = endTime;
        if (lo <= hi + EPS) {
          const x = trail.index % 48,
            y = Math.floor(trail.index / 48);
          const t = boxTime(pathPoint(path, lo), pathPoint(path, hi), {
            x: x - enemy.radius,
            y: y - enemy.radius,
            w: 1 + enemy.radius * 2,
            h: 1 + enemy.radius * 2,
          });
          if (t != null) best = remember(best, lo + (hi - lo) * t, 'enemy-trail', enemy.id);
        }
      }
      for (const playerPath of playerPaths) {
        let [lo, hi] = overlap(path, playerPath, horizon);
        if (enemy.type !== 'border-patrol' && !state.player.cutting)
          lo = Math.max(lo, trace.started ?? Infinity);
        if (lo > hi + EPS) continue;
        const t = movingCirclesTime(
          pathPoint(playerPath, lo),
          pathPoint(playerPath, hi),
          pathPoint(path, lo),
          pathPoint(path, hi),
          enemy.radius + state.rules.playerRadius,
        );
        if (t != null) best = remember(best, lo + (hi - lo) * t, 'enemy-player', enemy.id);
      }
    }
    if (
      enemy.type === 'lane-boss' &&
      enemy.bossPhase === 'active' &&
      enemy.stunnedUntil <= state.time + EPS
    ) {
      const width = enemy.laneWidth ?? 1.2;
      const box =
        enemy.axis === 'horizontal'
          ? { x: 1, y: enemy.lane - width / 2, w: 46, h: width }
          : { x: enemy.lane - width / 2, y: 1, w: width, h: 34 };
      const overlaps = (cell) =>
        cell.x <= box.x + box.w &&
        cell.x + 1 >= box.x &&
        cell.y <= box.y + box.h &&
        cell.y + 1 >= box.y;
      for (const trail of state.trail)
        if (overlaps(trail)) best = remember(best, 0, 'boss-lane', enemy.id);
      for (const trail of trace.cells) {
        if (trail.time > horizon + EPS) continue;
        if (overlaps({ x: trail.index % 48, y: Math.floor(trail.index / 48) }))
          best = remember(best, trail.time, 'boss-lane', enemy.id);
      }
      if (state.player.cutting)
        for (const path of playerPaths) {
          const hi = Math.min(horizon, path.t1);
          if (path.t0 > hi + EPS) continue;
          const t = boxTime(a(path), pathPoint(path, hi), box);
          if (t != null) best = remember(best, path.t0 + (hi - path.t0) * t, 'boss-lane', enemy.id);
        }
    }
  }
  return best;
}
