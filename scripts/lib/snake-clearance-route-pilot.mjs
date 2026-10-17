/** Local evidence only: trade distance for room beside the current route.
 * No simulation, future target sequence, random state or accepted-move undo.
 */
const directions = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const opposite = { up: 'down', right: 'left', down: 'up', left: 'right' };
const key = ({ x, y }) => `${x},${y}`;

export function clearanceSnakeRouteTurn({ width, height, walls, body, direction, target }) {
  // Retaining the tail deliberately avoids predicting future body vacancy.
  const blocked = new Set([...walls, ...body.slice(1)].map(key));
  const solid = ({ x, y }) =>
    x < 0 || y < 0 || x >= width || y >= height || blocked.has(`${x},${y}`);
  const queue = [{ ...body[0], first: null, cost: 0 }];
  const costs = new Map([[key(body[0]), 0]]);
  const order = [direction, ...Object.keys(directions).filter((d) => d !== direction)];
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const at = queue.shift();
    if (at.cost !== costs.get(key(at))) continue;
    if (at.x === target.x && at.y === target.y) return at.first;
    for (const name of order) {
      if (!at.first && name === opposite[direction]) continue;
      const [dx, dy] = directions[name];
      const next = { x: at.x + dx, y: at.y + dy, first: at.first ?? name };
      if (solid(next)) continue;
      // This is a declared route preference, not a claim of optimal survival:
      // two distance units per adjacent wall/cable/boundary cell.
      const exposure = Object.values(directions).filter(([x, y]) =>
        solid({ x: next.x + x, y: next.y + y }),
      ).length;
      next.cost = at.cost + 1 + 2 * exposure;
      if (next.cost >= (costs.get(key(next)) ?? Infinity)) continue;
      costs.set(key(next), next.cost);
      queue.push(next);
    }
  }
  return null;
}
