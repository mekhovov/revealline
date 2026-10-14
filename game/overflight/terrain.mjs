import { boundedJSON, exactKeys, required } from '../data-json.mjs';

export const OVERFLIGHT_TERRAIN_FORMAT = 'OverflightTerrainV1';
export const OVERFLIGHT_TERRAIN_FORMAT_V2 = 'OverflightTerrainV2';
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const solid = (obstacle) => obstacle.active !== false;

export function createOverflightTerrainFixture(arena = { width: 2880, height: 1080 }) {
  const obstacles = [
    ['west-cover', 250, 170, 180, 140, false],
    ['west-south', 700, 740, 160, 140, false],
    ['middle-cover', 1140, 170, 180, 140, false],
    ['middle-south', 1600, 740, 160, 140, false],
    ['east-cover', 2070, 170, 180, 140, false],
    ['east-south', 2500, 740, 160, 140, false],
    ['breach-north', 800, 260, 80, 140, true],
    ['breach-south', 2100, 680, 80, 80, true],
  ].map(([id, x, y, width, height, breakable]) => ({
    id,
    x: (x * arena.width) / 2880,
    y: (y * arena.height) / 1080,
    width: (width * arena.width) / 2880,
    height: (height * arena.height) / 1080,
    breakable,
  }));
  return validateOverflightTerrain(
    { format: OVERFLIGHT_TERRAIN_FORMAT, id: 'depot-breach', experimental: true, obstacles },
    arena,
  );
}

export function validateOverflightTerrain(source, arena) {
  if (source?.format === OVERFLIGHT_TERRAIN_FORMAT_V2)
    return validateOverflightTerrainV2(source, arena);
  const value = boundedJSON(source, { maxBytes: 8192, maxNodes: 160, maxArray: 8, maxDepth: 4 });
  exactKeys(value, ['format', 'id', 'experimental', 'obstacles'], 'Experimental terrain');
  required(
    value.format === OVERFLIGHT_TERRAIN_FORMAT && value.experimental === true,
    'Unsupported experimental terrain capability.',
  );
  required(/^[a-z0-9-]{1,64}$/.test(value.id), 'Invalid terrain identity.');
  required(
    arena.width >= 2880 && arena.height >= 1080,
    'Terrain needs the full experimental arena.',
  );
  required(
    Array.isArray(value.obstacles) &&
      value.obstacles.length === 8 &&
      value.obstacles.filter((o) => o.breakable).length === 2,
    'Terrain requires six permanent obstacles and two barriers.',
  );
  const ids = new Set();
  for (const item of value.obstacles) {
    exactKeys(item, ['id', 'x', 'y', 'width', 'height', 'breakable'], 'Terrain obstacle');
    required(
      typeof item.id === 'string' && /^[a-z0-9-]{1,64}$/.test(item.id) && !ids.has(item.id),
      'Terrain obstacle identities must be unique.',
    );
    ids.add(item.id);
    required(typeof item.breakable === 'boolean', 'Terrain breakability must be explicit.');
    required(
      ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(item[key])) &&
        item.width >= 32 &&
        item.height >= 32 &&
        item.x >= 90 &&
        item.y >= 90 &&
        item.x + item.width <= arena.width - 90 &&
        item.y + item.height <= arena.height - 90,
      'Terrain obstacle does not fit the arena.',
    );
    required(
      item.y + item.height <= arena.height / 2 - 120 || item.y >= arena.height / 2 + 120,
      'Keep the central 240-unit passage open.',
    );
    for (const other of value.obstacles) {
      if (other === item) continue;
      const gapX = Math.max(item.x - other.x - other.width, other.x - item.x - item.width);
      const gapY = Math.max(item.y - other.y - other.height, other.y - item.y - item.height);
      required(
        gapX >= 240 || gapY >= 240,
        'Terrain passages between obstacles must remain at least 240 units wide.',
      );
    }
  }
  return value;
}

/** V2 permits connected wide routes instead of requiring a straight middle lane.
 * Footprints that touch are one permanent assembly, never narrow fake passages. */
function validateOverflightTerrainV2(source, arena) {
  const value = boundedJSON(source, { maxBytes: 12288, maxNodes: 240, maxArray: 12, maxDepth: 4 });
  exactKeys(value, ['format', 'id', 'experimental', 'obstacles'], 'Battlefield terrain');
  required(
    value.experimental === false && /^[a-z0-9-]{1,80}$/.test(value.id),
    'Invalid battlefield terrain identity.',
  );
  required(
    arena.width === 2880 && arena.height === 1080,
    'Battlefields require the authored 2880×1080 arena.',
  );
  required(
    Array.isArray(value.obstacles) &&
      value.obstacles.length <= 12 &&
      value.obstacles.filter((o) => o.breakable).length <= 4,
    'Battlefield terrain permits twelve footprints and four barriers.',
  );
  const ids = new Set();
  for (const item of value.obstacles) {
    exactKeys(item, ['id', 'x', 'y', 'width', 'height', 'breakable'], 'Battlefield obstacle');
    required(
      typeof item.id === 'string' && /^[a-z0-9-]{1,64}$/.test(item.id) && !ids.has(item.id),
      'Obstacle identities must be unique.',
    );
    ids.add(item.id);
    required(
      typeof item.breakable === 'boolean' &&
        ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(item[k])) &&
        item.width >= 32 &&
        item.height >= 32 &&
        item.x >= 240 &&
        item.y >= 240 &&
        item.x + item.width <= arena.width - 240 &&
        item.y + item.height <= arena.height - 240,
      'Cover must preserve the 240-unit perimeter routes.',
    );
    for (const other of value.obstacles) {
      if (other === item) continue;
      const gx = Math.max(item.x - other.x - other.width, other.x - item.x - item.width);
      const gy = Math.max(item.y - other.y - other.height, other.y - item.y - item.height);
      const joined =
        !item.breakable && !other.breakable && ((gx === 0 && gy <= 0) || (gy === 0 && gx <= 0));
      required(
        gx >= 240 || gy >= 240 || joined,
        'Cover passages need 240 units; only permanent assembly footprints may touch.',
      );
    }
  }
  const remaining = new Set(value.obstacles);
  while (remaining.size) {
    const group = [remaining.values().next().value];
    remaining.delete(group[0]);
    for (let at = 0; at < group.length; at++)
      for (const candidate of remaining) {
        const a = group[at];
        const gx = Math.max(a.x - candidate.x - candidate.width, candidate.x - a.x - a.width);
        const gy = Math.max(a.y - candidate.y - candidate.height, candidate.y - a.y - a.height);
        if (gx <= 0 && gy <= 0) {
          group.push(candidate);
          remaining.delete(candidate);
        }
      }
    const left = Math.min(...group.map((o) => o.x)),
      top = Math.min(...group.map((o) => o.y));
    const right = Math.max(...group.map((o) => o.x + o.width)),
      bottom = Math.max(...group.map((o) => o.y + o.height));
    required(
      Math.abs(
        group.reduce((area, o) => area + o.width * o.height, 0) - (right - left) * (bottom - top),
      ) < 1e-6,
      'Touching cover must fill one rectangular assembly; concave pockets need a future terrain capability.',
    );
  }
  return value;
}

export function createOverflightTerrain(source, arena) {
  if (!source) return null;
  const value = validateOverflightTerrain(source, arena);
  return {
    ...value,
    revision: 0,
    strikes: 0,
    lastImpact: null,
    obstacles: value.obstacles.map((o) => ({
      ...o,
      active: true,
      hp: o.breakable ? 2 : Infinity,
      lastStrike: null,
      boostLatched: false,
    })),
    graphs: new Map(),
    fields: new Map(),
  };
}

/** Relative segment/slab intersection against an expanded rectangle. The small
 * conservative corner expansion preserves clearance for every actor radius. */
function rectangleHit(box, ax, ay, bx, by, radius) {
  const minX = box.x - radius,
    maxX = box.x + box.width + radius;
  const minY = box.y - radius,
    maxY = box.y + box.height + radius;
  let enter = 0,
    exit = 1,
    nx = 0,
    ny = 0;
  for (const [a, d, low, high, xAxis] of [
    [ax, bx - ax, minX, maxX, true],
    [ay, by - ay, minY, maxY, false],
  ]) {
    if (Math.abs(d) < 1e-12) {
      if (a <= low || a >= high) return null;
      continue;
    }
    const first = (low - a) / d,
      second = (high - a) / d;
    const start = Math.min(first, second),
      end = Math.max(first, second);
    if (start >= enter) {
      enter = start;
      nx = xAxis ? (d > 0 ? -1 : 1) : 0;
      ny = xAxis ? 0 : d > 0 ? -1 : 1;
    }
    exit = Math.min(exit, end);
    if (enter > exit) return null;
  }
  if (enter < 0 || enter > 1 || exit < 0) return null;
  return { t: enter, nx, ny, obstacle: box };
}
export function overflightTerrainHit(terrain, ax, ay, bx, by, radius = 0) {
  if (!terrain) return null;
  let first = null;
  for (const obstacle of terrain.obstacles) {
    if (!solid(obstacle)) continue;
    const hit = rectangleHit(obstacle, ax, ay, bx, by, radius);
    if (hit && (!first || hit.t < first.t)) first = hit;
  }
  return first;
}
export function overflightTerrainClear(terrain, ax, ay, bx = ax, by = ay, radius = 0) {
  if (!terrain) return true;
  if (ax === bx && ay === by)
    return !terrain.obstacles.some(
      (o) =>
        solid(o) &&
        ax > o.x - radius &&
        ax < o.x + o.width + radius &&
        ay > o.y - radius &&
        ay < o.y + o.height + radius,
    );
  return !overflightTerrainHit(terrain, ax, ay, bx, by, radius);
}
export function overflightTerrainOpenPoint(terrain, x, y, radius, arena) {
  let point = {
    x: clamp(x, radius, arena.width - radius),
    y: clamp(y, radius, arena.height - radius),
  };
  if (!terrain) return point;
  for (const obstacle of terrain.obstacles) {
    if (
      !solid(obstacle) ||
      overflightTerrainClear(
        { obstacles: [obstacle] },
        point.x,
        point.y,
        point.x,
        point.y,
        radius + 1,
      )
    )
      continue;
    const choices = [
      { x: obstacle.x - radius - 2, y: point.y },
      { x: obstacle.x + obstacle.width + radius + 2, y: point.y },
      { x: point.x, y: obstacle.y - radius - 2 },
      { x: point.x, y: obstacle.y + obstacle.height + radius + 2 },
    ].filter(
      (p) =>
        p.x >= radius &&
        p.y >= radius &&
        p.x <= arena.width - radius &&
        p.y <= arena.height - radius &&
        overflightTerrainClear(terrain, p.x, p.y, p.x, p.y, radius),
    );
    choices.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    if (choices[0]) point = choices[0];
  }
  return point;
}

function strikeBarrier(terrain, obstacle, token) {
  if (!obstacle.breakable || !solid(obstacle) || token === obstacle.lastStrike) return false;
  obstacle.lastStrike = token;
  obstacle.hp--;
  terrain.strikes++;
  terrain.lastImpact = {
    x: obstacle.x + obstacle.width / 2,
    y: obstacle.y + obstacle.height / 2,
    broken: obstacle.hp <= 0,
  };
  if (obstacle.hp <= 0) {
    obstacle.active = false;
    terrain.revision++;
    terrain.graphs.clear();
    terrain.fields.clear();
  }
  return true;
}
export function moveOverflightThroughTerrain(terrain, actor, x, y, { boostToken = null } = {}) {
  if (!terrain) {
    actor.x = x;
    actor.y = y;
    return;
  }
  if (boostToken !== null)
    for (const obstacle of terrain.obstacles)
      if (
        overflightTerrainClear(
          { obstacles: [obstacle] },
          actor.x,
          actor.y,
          actor.x,
          actor.y,
          actor.radius + 6,
        )
      )
        obstacle.boostLatched = false;
  let ax = actor.x,
    ay = actor.y;
  for (let attempt = 0; attempt < 3; attempt++) {
    const hit = overflightTerrainHit(terrain, ax, ay, x, y, actor.radius);
    if (!hit) {
      ax = x;
      ay = y;
      break;
    }
    if (boostToken !== null && !hit.obstacle.boostLatched) {
      hit.obstacle.boostLatched = true;
      strikeBarrier(terrain, hit.obstacle, `boost:${boostToken}`);
    }
    const dx = x - ax,
      dy = y - ay;
    ax += dx * Math.max(0, hit.t - 1e-5);
    ay += dy * Math.max(0, hit.t - 1e-5);
    if (hit.nx) {
      x = ax;
      actor.vx = 0;
    }
    if (hit.ny) {
      y = ay;
      actor.vy = 0;
    }
    if (!hit.nx && !hit.ny) break;
  }
  actor.x = ax;
  actor.y = ay;
}

export function damageOverflightTerrain(terrain, x, y, radius, token) {
  if (!terrain || token == null) return 0;
  let hits = 0;
  // Evaluate visibility before destroying anything, so one blast cannot tunnel.
  const eligible = terrain.obstacles.filter((o) => {
    if (!o.active || !o.breakable) return false;
    const px = clamp(x, o.x, o.x + o.width),
      py = clamp(y, o.y, o.y + o.height);
    if (Math.hypot(px - x, py - y) > radius) return false;
    const first = overflightTerrainHit(terrain, x, y, px, py);
    return !first || first.obstacle === o;
  });
  for (const obstacle of eligible) if (strikeBarrier(terrain, obstacle, `payload:${token}`)) hits++;
  return hits;
}

/** Freeze each ray's cover extent when the warning is admitted. Destroying a
 * barrier later cannot enlarge that committed warning or fired projectile. */
export function constrainOverflightTerrainAttack(terrain, attack) {
  if (!terrain || !attack || !['lane', 'fan'].includes(attack.kind)) return attack;
  const offsets = attack.kind === 'fan' ? [-attack.spread, 0, attack.spread] : [0];
  return {
    ...attack,
    rayLengths: offsets.map((offset) => {
      const angle = attack.heading + offset;
      const hit = overflightTerrainHit(
        terrain,
        attack.originX,
        attack.originY,
        attack.originX + Math.cos(angle) * attack.length,
        attack.originY + Math.sin(angle) * attack.length,
        attack.radius,
      );
      return hit ? Math.max(0, attack.length * hit.t) : attack.length;
    }),
  };
}

/** A bounded static visibility graph is reused by all pursuit bodies. Target
 * fields use 32-unit cells and a finite cache; rendering never owns navigation. */
export function overflightTerrainWaypoint(terrain, actor, target, arena) {
  if (
    !terrain ||
    overflightTerrainClear(terrain, actor.x, actor.y, target.x, target.y, actor.radius + 1)
  )
    return target;
  const radius = Math.ceil((actor.radius + 2) / 4) * 4;
  let graph = terrain.graphs.get(radius);
  if (!graph) {
    const points = terrain.obstacles
      .filter(solid)
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
          overflightTerrainClear(terrain, p.x, p.y, p.x, p.y, radius),
      );
    const edges = points.map((a) =>
      points.map((b) =>
        overflightTerrainClear(terrain, a.x, a.y, b.x, b.y, radius)
          ? Math.hypot(a.x - b.x, a.y - b.y)
          : Infinity,
      ),
    );
    graph = { points, edges };
    terrain.graphs.set(radius, graph);
  }
  const cellX = Math.floor(target.x / 32),
    cellY = Math.floor(target.y / 32),
    key = `${radius}:${cellX}:${cellY}`;
  let field = terrain.fields.get(key);
  if (!field) {
    const goal = overflightTerrainOpenPoint(
      terrain,
      cellX * 32 + 16,
      cellY * 32 + 16,
      radius,
      arena,
    );
    const distances = graph.points.map((p) =>
      overflightTerrainClear(terrain, p.x, p.y, goal.x, goal.y, radius)
        ? Math.hypot(p.x - goal.x, p.y - goal.y)
        : Infinity,
    );
    const seen = new Set();
    for (let count = 0; count < graph.points.length; count++) {
      let at = -1;
      for (let i = 0; i < distances.length; i++)
        if (!seen.has(i) && (at < 0 || distances[i] < distances[at])) at = i;
      if (at < 0 || !Number.isFinite(distances[at])) break;
      seen.add(at);
      for (let i = 0; i < distances.length; i++)
        distances[i] = Math.min(distances[i], distances[at] + graph.edges[at][i]);
    }
    field = distances;
    if (terrain.fields.size >= 64) terrain.fields.delete(terrain.fields.keys().next().value);
    terrain.fields.set(key, field);
  }
  let best = target,
    distance = Infinity;
  for (let i = 0; i < graph.points.length; i++) {
    const point = graph.points[i],
      candidate = field[i] + Math.hypot(point.x - actor.x, point.y - actor.y);
    if (
      candidate < distance &&
      overflightTerrainClear(terrain, actor.x, actor.y, point.x, point.y, actor.radius + 1)
    ) {
      best = point;
      distance = candidate;
    }
  }
  return best;
}
