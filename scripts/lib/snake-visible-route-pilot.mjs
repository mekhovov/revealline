/** A deliberately limited second strategy for local rating evidence, never gameplay.
 * It sees only current terrain, head/cable and the visible stationary target. It
 * cannot simulate candidate futures, inspect RNG or backtrack an accepted move.
 */
const directions = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const opposite = { up: 'down', right: 'left', down: 'up', left: 'right' };
const key = ({ x, y }) => `${x},${y}`;

export function visibleSnakeRouteTurn({ width, height, walls, body, direction, target }) {
  // Conservatively retain the tail: this strategy does not predict body vacancy.
  const blocked = new Set([...walls, ...body.slice(1)].map(key));
  const queue = [{ ...body[0], first: null }];
  const visited = new Set([key(body[0])]);
  for (let index = 0; index < queue.length; index++) {
    const at = queue[index];
    if (at.x === target.x && at.y === target.y) return at.first;
    // Prefer continuing when shortest routes tie; this differs from the general
    // pilot's scored search and reduces unnecessary turns without future vision.
    for (const name of [direction, ...Object.keys(directions).filter((d) => d !== direction)]) {
      if (!at.first && name === opposite[direction]) continue;
      const [dx, dy] = directions[name];
      const next = { x: at.x + dx, y: at.y + dy, first: at.first ?? name };
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.x >= width ||
        next.y >= height ||
        blocked.has(key(next)) ||
        visited.has(key(next))
      )
        continue;
      visited.add(key(next));
      queue.push(next);
    }
  }
  return null; // Record the limitation rather than silently changing algorithms.
}
