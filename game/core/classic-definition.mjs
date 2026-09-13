import { exactKeys, required, stableId } from '../data-json.mjs';

export const CLASSIC_ENEMY_TYPES = Object.freeze([
  'bouncer',
  'border-patrol',
  'lane-boss',
  'relay-sentinel',
  'contour-patrol',
  'claimed-rover',
  'eroder',
]);
export const CLASSIC_SIDES = Object.freeze(['north', 'east', 'south', 'west']);
const integer = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
const number = (value, low, high) => Number.isFinite(value) && value >= low && value <= high;
const centered = (value) => Number.isInteger(value - 0.5);
const has = (value, keys, label) => {
  exactKeys(value, keys, label);
  required(
    keys.every((key) => Object.hasOwn(value, key)),
    `${label} fields are required`,
  );
};

/** The caller supplies already-owned bounded JSON; no code or inferred actor roles. */
export function resolveClassicDefinition(level) {
  const { width, height } = level;
  exactKeys(level.classic, ['version', 'terrain', 'powerups', 'lineImpact'], 'classic');
  required(
    ['version', 'terrain', 'powerups'].every((key) => Object.hasOwn(level.classic, key)),
    'classic fields are required',
  );
  if (Object.hasOwn(level.classic, 'lineImpact')) {
    const impact = level.classic.lineImpact;
    has(impact, ['version', 'speed'], 'line impact');
    required(impact.version === 'line-impact.v1', 'unsupported line impact definition');
    required(number(impact.speed, 4, 60), 'line impact speed must be 4..60 cells per second');
  }
  const value = level.classic;
  required(value.version === 'classic.v1', 'unsupported classic definition');
  required(
    Array.isArray(value.terrain) && value.terrain.length <= 100,
    'at most 100 terrain rectangles',
  );
  required(Array.isArray(value.powerups) && value.powerups.length <= 64, 'at most 64 powerups');
  const walls = new Uint8Array(width * height),
    terrain = new Uint8Array(width * height);
  for (const wall of level.walls ?? [])
    for (let y = wall.y; y < wall.y + wall.h; y++)
      for (let x = wall.x; x < wall.x + wall.w; x++) walls[y * width + x] = 1;
  const ids = new Set();
  const identity = (entity) => {
    required(stableId(entity.id) && !ids.has(entity.id), 'all entity IDs must be unique');
    ids.add(entity.id);
  };
  for (const kind of ['enemies', 'objectives', 'supplies', 'signalZones', 'hangars'])
    for (const item of level[kind] ?? []) identity(item);
  for (const area of value.terrain) {
    has(area, ['id', 'kind', 'x', 'y', 'w', 'h'], 'terrain');
    identity(area);
    required(['slow', 'lethal'].includes(area.kind), 'unsupported terrain kind');
    required(
      integer(area.x, 1, width - 2) &&
        integer(area.y, 1, height - 2) &&
        integer(area.w, 1, width - 2) &&
        integer(area.h, 1, height - 2) &&
        area.x + area.w <= width - 1 &&
        area.y + area.h <= height - 1,
      'terrain must be an integer interior rectangle',
    );
    for (let y = area.y; y < area.y + area.h; y++)
      for (let x = area.x; x < area.x + area.w; x++) {
        const i = y * width + x;
        required(!walls[i] && !terrain[i], 'terrain cannot overlap walls or other terrain');
        terrain[i] = area.kind === 'lethal' ? 2 : 1;
      }
  }
  const powerupCells = new Set();
  for (const item of value.powerups) {
    has(item, ['id', 'kind', 'x', 'y'], 'powerup');
    identity(item);
    required(
      ['extra-life', 'player-speed', 'enemy-slow', 'enemy-freeze'].includes(item.kind),
      'unsupported powerup',
    );
    required(
      number(item.x, 0.5, width - 0.5) &&
        number(item.y, 0.5, height - 0.5) &&
        centered(item.x) &&
        centered(item.y),
      'powerups must occupy cell centers',
    );
    const i = Math.floor(item.y) * width + Math.floor(item.x);
    required(
      !walls[i] && terrain[i] !== 2 && !powerupCells.has(i),
      'powerup position is blocked or duplicated',
    );
    powerupCells.add(i);
  }
  for (const item of level.objectives ?? [])
    required(
      terrain[Math.floor(item.y) * width + Math.floor(item.x)] !== 2,
      'objectives cannot occupy lethal terrain',
    );
  for (const enemy of level.enemies ?? []) {
    required(CLASSIC_ENEMY_TYPES.includes(enemy.type), 'unsupported classic enemy');
    const common = ['id', 'type', 'radius'];
    if (enemy.type === 'contour-patrol') {
      exactKeys(enemy, [...common, 'edge', 'clockwise', 'speed'], 'contour-patrol');
      has(enemy.edge, ['x', 'y', 'side'], 'contour edge');
      required(
        typeof enemy.clockwise === 'boolean' && number(enemy.speed, 0, 15),
        'invalid contour motion',
      );
      const { x, y, side } = enemy.edge;
      required(
        integer(x, 1, width - 2) && integer(y, 1, height - 2) && CLASSIC_SIDES.includes(side),
        'invalid contour edge',
      );
      const dx = side === 'east' ? 1 : side === 'west' ? -1 : 0;
      const dy = side === 'south' ? 1 : side === 'north' ? -1 : 0;
      required(
        !walls[y * width + x] &&
          (x + dx === 0 || x + dx === width - 1 || y + dy === 0 || y + dy === height - 1),
        'initial contour edge must separate safe border and field',
      );
      required(
        enemy.radius === undefined || number(enemy.radius, 0.05, 0.45),
        'invalid contour radius',
      );
    } else if (['bouncer', 'claimed-rover', 'eroder'].includes(enemy.type)) {
      exactKeys(enemy, [...common, 'x', 'y', 'vx', 'vy'], enemy.type);
      required(number(enemy.vx, -20, 20) && number(enemy.vy, -20, 20), 'invalid classic velocity');
      if (enemy.type === 'claimed-rover')
        required(
          centered(enemy.x) && centered(enemy.y),
          'claimed rover must start at a cell center',
        );
    } else if (enemy.type === 'border-patrol')
      exactKeys(enemy, [...common, 'x', 'y', 'speed', 'clockwise'], enemy.type);
    else if (enemy.type === 'relay-sentinel') exactKeys(enemy, [...common, 'x', 'y'], enemy.type);
    else
      exactKeys(
        enemy,
        [...common, 'x', 'y', 'axis', 'warningSeconds', 'activeSeconds', 'period', 'laneWidth'],
        enemy.type,
      );
  }
  exactKeys(level.spawn, ['x', 'y'], 'spawn');
  exactKeys(level.goal, ['coverage'], 'goal');
  for (const wall of level.walls ?? []) exactKeys(wall, ['x', 'y', 'w', 'h'], 'wall');
  for (const item of level.objectives ?? [])
    exactKeys(item, ['id', 'x', 'y', 'required', 'hidden'], 'objective');
  for (const item of level.supplies ?? []) exactKeys(item, ['id', 'x', 'y', 'radius'], 'supply');
  for (const item of level.hangars ?? []) exactKeys(item, ['id', 'x', 'y', 'radius'], 'hangar');
  for (const item of level.signalZones ?? [])
    exactKeys(
      item,
      ['id', 'x', 'y', 'w', 'h', 'speedFactor', 'disableBoost', 'lockAbility'],
      'signal zone',
    );
  return value;
}
