/** Evidence pilot navigation only. Reads cover, writes no game state. */
import { overflightTerrainClear } from '../../../../game/overflight/terrain.mjs';
export function terrainWaypoint(terrain, actor, target, arena) {
  const radius = actor.radius + 4;
  const clear = (a, b) => overflightTerrainClear(terrain, a.x, a.y, b.x, b.y, radius);
  if (!terrain || clear(actor, target)) return target;
  const corners = terrain.obstacles
    .filter((o) => o.active !== false)
    .flatMap((o) => [
      { x: o.x - radius - 1, y: o.y - radius - 1 },
      { x: o.x + o.width + radius + 1, y: o.y - radius - 1 },
      { x: o.x - radius - 1, y: o.y + o.height + radius + 1 },
      { x: o.x + o.width + radius + 1, y: o.y + o.height + radius + 1 },
    ])
    .filter(
      (p) =>
        p.x >= radius &&
        p.y >= radius &&
        p.x <= arena.width - radius &&
        p.y <= arena.height - radius &&
        clear(p, p),
    );
  const points = [actor, target, ...corners],
    costs = points.map(() => Infinity),
    previous = points.map(() => -1),
    visited = new Set();
  costs[0] = 0;
  for (let pass = 0; pass < points.length; pass++) {
    let best = -1;
    for (let i = 0; i < points.length; i++)
      if (!visited.has(i) && (best < 0 || costs[i] < costs[best])) best = i;
    if (best < 0 || !Number.isFinite(costs[best]) || best === 1) break;
    visited.add(best);
    for (let i = 1; i < points.length; i++) {
      if (visited.has(i) || !clear(points[best], points[i])) continue;
      const cost =
        costs[best] + Math.hypot(points[best].x - points[i].x, points[best].y - points[i].y);
      if (cost < costs[i]) {
        costs[i] = cost;
        previous[i] = best;
      }
    }
  }
  if (previous[1] < 0) return actor;
  let index = 1;
  while (previous[index] > 0) index = previous[index];
  return points[index];
}
