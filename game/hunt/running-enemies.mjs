import {
  derivePursuitGoals,
  validatePursuitPopulation,
  PURSUIT_GOALS_VERSION,
} from './pursuit-goals.mjs';
import { dataIdentity, required } from '../data-json.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { CLASSES, validateClassRecipes } from '../core/registry.mjs';
import {
  RUNNING_ENEMY_VERSIONS,
  PURSUIT_VERSIONS,
  SNAKE_PURSUIT_VERSIONS,
  isRunningEnemyLevel,
} from '../core/versions.mjs';
import { placeRunningEnemies, runningEnemyReservedIds } from './running-enemy-placement.mjs';
import { HUNT_VERSION, HUNT_RUNNER_TURN_TICKS } from './rules.mjs';
import {
  RUNNING_ENEMIES_VERSION,
  runningEnemyBaseLevel,
  runningEnemyGeometry,
  runningEnemyCopy,
} from './running-enemy-definition.mjs';
export { runningEnemyBaseLevel } from './running-enemy-definition.mjs';
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

/** Resolve once before starting an attempt, after difficulty/tuning. Historical
 * variants and authored Hunt objectives keep their existing accepted recipe. */
export function prepareRunningEnemyLevel(
  source,
  { classes = CLASSES, style = 'original', population } = {},
) {
  required(['original', 'varied'].includes(style), 'Choose original or varied running targets.');
  source = runningEnemyCopy(source);
  if (source.pursuit && isRunningEnemyLevel(source)) return freeze(normalizedLevel(source));
  if (isRunningEnemyLevel(source)) source = normalizedLevel(source);
  const base = normalizedLevel(
    isRunningEnemyLevel(source) ? runningEnemyBaseLevel(source) : source,
  );
  if (base.classic?.hunt) {
    if (style === 'original') return freeze(base);
    const runners = base.classic.combatPatrols.actors.filter((actor) =>
      base.classic.hunt.targets.some(
        (target) => target.id === actor.id && target.kind === 'runner',
      ),
    );
    if (!runners.length) return freeze(base);
    const authored = population === undefined ? null : validatePursuitPopulation(population);
    required(
      !authored ||
        authored.every((item) =>
          runners.some((actor) => actor.id === item.id && actor.x === item.x && actor.y === item.y),
        ),
      'Authored pursuit goals must match existing target positions.',
    );
    return freeze(
      normalizedLevel({
        ...base,
        version: base.snake ? SNAKE_PURSUIT_VERSIONS.levelVersion : PURSUIT_VERSIONS.levelVersion,
        runningEnemies: {
          version: base.snake ? 'running-enemies.v3' : 'running-enemies.v2',
          baseVersion: base.version,
          baseIdentity: dataIdentity(base),
          combatPatrols: base.classic.combatPatrols,
          hunt: base.classic.hunt,
        },
        pursuit: authored
          ? {
              version: PURSUIT_GOALS_VERSION,
              actors: authored.map(({ x: _x, y: _y, ...policy }) => policy),
            }
          : derivePursuitGoals(runners, runningEnemyGeometry(base)),
      }),
    );
  }
  const roster = validateClassRecipes(classes);
  required(roster.valid, `Invalid running-enemy roster: ${roster.errors.join('; ')}`);
  const speed =
    base.rules.moveSpeed *
    Math.min(...classes.map((recipe) => recipe.moveSpeedMultiplier ?? 1)) *
    0.7;
  required(
    speed >= 0.25 && speed <= 21,
    'Accepted running-enemy speed is outside the supported range.',
  );
  const inherited = base.classic?.combatPatrols?.enabled ? base.classic.combatPatrols.actors : [];
  const geometry = runningEnemyGeometry(base);
  const authored = population === undefined ? null : validatePursuitPopulation(population);
  required(!authored || style === 'varied', 'Authored goals require varied pursuit.');
  const points =
    authored ??
    placeRunningEnemies({
      ...geometry,
      occupied: [...base.enemies, ...inherited],
      reservedIds: runningEnemyReservedIds(base),
    });
  required(
    points.length > 0,
    'This level has no reachable unclaimed cell with safe runner clearance.',
  );
  const actors = points.map(({ id, x, y }) => ({
    id,
    x,
    y,
    role: 'scout',
    headingX: 1,
    headingY: 0,
    speed,
    turnTicks: HUNT_RUNNER_TURN_TICKS,
  }));
  return freeze(
    normalizedLevel({
      ...base,
      version:
        style === 'varied' ? PURSUIT_VERSIONS.levelVersion : RUNNING_ENEMY_VERSIONS.levelVersion,
      ...(style === 'varied'
        ? {
            pursuit: authored
              ? {
                  version: PURSUIT_GOALS_VERSION,
                  actors: authored.map(({ x: _x, y: _y, ...policy }) => policy),
                }
              : derivePursuitGoals(actors, geometry),
          }
        : {}),
      runningEnemies: {
        version: RUNNING_ENEMIES_VERSION,
        baseVersion: base.version,
        baseIdentity: dataIdentity(base),
        combatPatrols: {
          version: 'combat-patrols.v1',
          enabled: true,
          actors: [...inherited, ...actors],
        },
        hunt: {
          version: HUNT_VERSION,
          mode: 'bonus',
          quota: 0,
          targets: actors.map(({ id }) => ({ id, kind: 'runner' })),
        },
      },
    }),
  );
}
export function matchRunningEnemyLevel(source, recorded, options) {
  try {
    return (
      dataIdentity(prepareRunningEnemyLevel(source, options)) ===
      dataIdentity(normalizedLevel(recorded))
    );
  } catch {
    return false;
  }
}
