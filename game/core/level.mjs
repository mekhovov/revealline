import { DEFAULT_RULES } from './registry.mjs';

const number = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
const integer = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const id = (v) => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(v);
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Validate data without mutating it. Unknown presentation metadata is ignored. */
export function validateLevel(level) {
  const errors = [];
  const check = (value, message) => {
    if (!value) errors.push(message);
  };
  if (!object(level)) return { valid: false, errors: ['level must be an object'] };
  check(level.version === 'xonix-level.v1', 'version must be xonix-level.v1');
  check(id(level.id), 'id must be a stable identifier');
  check(
    typeof level.revision === 'string' && level.revision.length > 0,
    'revision must be a nonempty string',
  );
  check(level.width === 48 && level.height === 36, 'board must be exactly 48 × 36');
  const x = (v) => number(v, 0.5, 47.5),
    y = (v) => number(v, 0.5, 35.5);
  const onBorder = (p) =>
    object(p) && x(p.x) && y(p.y) && (p.x === 0.5 || p.x === 47.5 || p.y === 0.5 || p.y === 35.5);
  check(
    onBorder(level.spawn) &&
      Number.isInteger(level.spawn.x - 0.5) &&
      Number.isInteger(level.spawn.y - 0.5),
    'spawn must be an outer safe cell center',
  );
  check(
    object(level.goal) && number(level.goal.coverage, 0.01, 1),
    'goal.coverage must be between 0.01 and 1',
  );
  for (const key of ['walls', 'enemies', 'objectives', 'supplies'])
    check(level[key] === undefined || Array.isArray(level[key]), `${key} must be an array`);
  if (errors.some((e) => e.endsWith('must be an array'))) return { valid: false, errors };
  const walls = level.walls ?? [],
    enemies = level.enemies ?? [],
    objectives = level.objectives ?? [],
    supplies = level.supplies ?? [];
  check(walls.length <= 100, 'at most 100 walls');
  check(enemies.length <= 24, 'at most 24 enemies');
  check(objectives.length <= 40, 'at most 40 objectives');
  check(supplies.length <= 20, 'at most 20 supplies');
  const cells = new Uint8Array(48 * 36);
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    const valid =
      object(w) &&
      integer(w.x, 1, 46) &&
      integer(w.y, 1, 34) &&
      integer(w.w, 1, 46) &&
      integer(w.h, 1, 34) &&
      w.x + w.w <= 47 &&
      w.y + w.h <= 35;
    check(valid, `walls[${i}] must be an integer interior rectangle`);
    if (valid)
      for (let y = w.y; y < w.y + w.h; y++)
        for (let x = w.x; x < w.x + w.w; x++) {
          check(!cells[y * 48 + x], `walls[${i}] overlaps another wall`);
          cells[y * 48 + x] = 2;
        }
  }
  check(
    cells.filter((v) => v === 2).length < 46 * 34,
    'at least one interior cell must be claimable',
  );
  const clear = (p, r = 0) => {
    if (!object(p) || !number(p.x, 1 + r, 47 - r) || !number(p.y, 1 + r, 35 - r)) return false;
    for (let y = Math.floor(p.y - r); y <= Math.floor(p.y + r); y++)
      for (let x = Math.floor(p.x - r); x <= Math.floor(p.x + r); x++)
        if (cells[y * 48 + x] === 2) return false;
    return true;
  };
  const seen = new Set();
  for (const [i, e] of enemies.entries()) {
    check(object(e) && id(e.id) && !seen.has(e.id), `enemies[${i}] needs a unique id`);
    if (!object(e)) continue;
    seen.add(e.id);
    check(
      ['bouncer', 'border-patrol', 'lane-boss'].includes(e.type),
      `enemies[${i}] unsupported type`,
    );
    check(
      e.radius === undefined || number(e.radius, 0.05, 0.45),
      `enemies[${i}].radius must be 0.05..0.45`,
    );
    if (e.type === 'border-patrol') {
      check(onBorder(e), `enemies[${i}] patrol must lie on outer center-line`);
      check(e.speed === undefined || number(e.speed, 0, 15), `enemies[${i}].speed must be 0..15`);
      check(
        e.clockwise === undefined || typeof e.clockwise === 'boolean',
        `enemies[${i}].clockwise must be boolean`,
      );
      if (onBorder(level.spawn) && onBorder(e))
        check(
          Math.hypot(e.x - level.spawn.x, e.y - level.spawn.y) > 2,
          `enemies[${i}] patrol too close to spawn`,
        );
    } else {
      const radius = e.radius ?? 0.25;
      check(number(radius, 0.05, 0.45), `enemies[${i}].radius must be 0.05..0.45`);
      check(clear(e, radius), `enemies[${i}] must fit in unclaimed interior clear of walls`);
      if (e.type === 'bouncer')
        check(
          number(e.vx, -20, 20) && number(e.vy, -20, 20),
          `enemies[${i}] needs finite vx/vy in -20..20`,
        );
      if (e.type === 'lane-boss') {
        check(['horizontal', 'vertical'].includes(e.axis), `enemies[${i}].axis invalid`);
        const warning = e.warningSeconds ?? 1.5,
          active = e.activeSeconds ?? 0.7,
          period = e.period ?? 6;
        check(
          number(warning, 0.25, 10) &&
            number(active, 0.1, 10) &&
            number(period, warning + active + 0.25, 60),
          `enemies[${i}] invalid lane timing`,
        );
        check(
          e.laneWidth === undefined || number(e.laneWidth, 0.25, 5),
          `enemies[${i}].laneWidth must be 0.25..5`,
        );
      }
    }
  }
  for (const [kind, list] of [
    ['objectives', objectives],
    ['supplies', supplies],
  ])
    for (const [i, p] of list.entries()) {
      check(object(p) && id(p.id) && !seen.has(p.id), `${kind}[${i}] needs a unique id`);
      if (!object(p)) continue;
      seen.add(p.id);
      check(
        x(p.x) && y(p.y) && cells[Math.floor(p.y) * 48 + Math.floor(p.x)] !== 2,
        `${kind}[${i}] invalid position`,
      );
      if (kind === 'objectives') {
        check(clear(p), `objectives[${i}] must be in claimable interior`);
        for (const key of ['required', 'hidden'])
          check(
            p[key] === undefined || typeof p[key] === 'boolean',
            `objectives[${i}].${key} must be boolean`,
          );
      } else
        check(
          p.radius === undefined || number(p.radius, 0.25, 4),
          `supplies[${i}].radius must be 0.25..4`,
        );
    }
  if (level.rules !== undefined && !object(level.rules)) errors.push('rules must be an object');
  if (object(level.rules)) {
    const ranges = {
      lives: [1, 9],
      moveSpeed: [1, 20],
      boostMultiplier: [1, 3],
      respawnSeconds: [0.1, 5],
      graceSeconds: [0, 5],
      playerRadius: [0.05, 0.3],
      pointsPerCell: [0, 1000],
      objectivePoints: [0, 10000],
    };
    for (const [key, value] of Object.entries(level.rules)) {
      if (key === 'timeMedals')
        check(
          Array.isArray(value) &&
            value.length === 2 &&
            number(value[0], 1, 7200) &&
            number(value[1], value[0], 7200),
          'rules.timeMedals must be [goldSeconds,silverSeconds]',
        );
      else
        check(
          Object.hasOwn(ranges, key) &&
            number(value, ...(Object.hasOwn(ranges, key) ? ranges[key] : [0, 0])),
          `unsupported or invalid rule ${key}`,
        );
    }
    if (level.rules.lives !== undefined)
      check(Number.isInteger(level.rules.lives), 'rules.lives must be integer');
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function normalizedLevel(level) {
  const result = validateLevel(level);
  if (!result.valid) throw new TypeError(`Invalid level: ${result.errors.join('; ')}`);
  return {
    ...structuredClone(level),
    rules: structuredClone({ ...DEFAULT_RULES, ...level.rules }),
    walls: structuredClone(level.walls ?? []),
    enemies: structuredClone(level.enemies ?? []),
    objectives: structuredClone(level.objectives ?? []),
    supplies: structuredClone(level.supplies ?? []),
  };
}
