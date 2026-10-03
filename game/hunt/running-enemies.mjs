import { dataIdentity, required } from '../data-json.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { CLASSES, validateClassRecipes } from '../core/registry.mjs';
import { RUNNING_ENEMY_VERSIONS } from '../core/versions.mjs';
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
export function prepareRunningEnemyLevel(source, { classes = CLASSES } = {}) {
  source = runningEnemyCopy(source);
  if (source.version === RUNNING_ENEMY_VERSIONS.levelVersion) source = normalizedLevel(source);
  const base = normalizedLevel(
    source.version === RUNNING_ENEMY_VERSIONS.levelVersion ? runningEnemyBaseLevel(source) : source,
  );
  if (base.classic?.hunt) return freeze(base);
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
  const points = placeRunningEnemies({
    ...geometry,
    occupied: [...base.enemies, ...inherited],
    reservedIds: runningEnemyReservedIds(base),
  });
  required(
    points.length > 0,
    'This level has no reachable unclaimed cell with safe runner clearance.',
  );
  const actors = points.map((point) => ({
    ...point,
    role: 'scout',
    headingX: 1,
    headingY: 0,
    speed,
    turnTicks: HUNT_RUNNER_TURN_TICKS,
  }));
  return freeze(
    normalizedLevel({
      ...base,
      version: RUNNING_ENEMY_VERSIONS.levelVersion,
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
