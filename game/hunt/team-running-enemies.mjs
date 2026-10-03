import { dataIdentity, required } from '../data-json.mjs';
import { createCoop, validateCoopLevel } from '../coop/core.mjs';
import {
  TEAM_RUNNING_LEVEL_VERSION,
  TEAM_RUNNING_RECIPE,
  inheritedRunningTeamLevel,
} from '../coop/running-enemies.mjs';
import { freezeDesign } from '../content-design/catalogs.mjs';
import { placeRunningEnemies } from './running-enemy-placement.mjs';

export function teamRunningEnemyBaseLevel(level) {
  return level.version === TEAM_RUNNING_LEVEL_VERSION ? inheritedRunningTeamLevel(level) : level;
}

/** Apply after accepted gameplay tuning. Existing Hunt objectives remain authored. */
export function prepareTeamRunningEnemies(source) {
  const validation = validateCoopLevel(source);
  required(validation.valid, validation.errors.join(' '));
  if (source.hunt) return source;
  const run = createCoop(source, { seed: 1 });
  const inherited = source.combatPatrols?.enabled ? source.combatPatrols.actors : [];
  const reservedIds = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.id === 'string') reservedIds.push(value.id);
    for (const child of Object.values(value)) visit(child);
  };
  visit(source);
  const spots = placeRunningEnemies({
    width: source.width,
    height: source.height,
    cells: run.cells,
    terrain: run.terrain ?? [],
    spawns: source.spawns,
    occupied: [
      ...source.enemies,
      ...inherited,
      ...(source.strongholds ?? []).flatMap((hold) => [hold.core, ...hold.anchors]),
    ],
    reservedIds,
    count: Math.min(6, 46 - source.enemies.length - inherited.length),
  });
  required(spots.length > 0, 'No safe running-enemy population fits this Team level.');
  const actors = spots.map(({ id, x, y }, index) => ({
    id,
    role: 'scout',
    x,
    y,
    headingX: index % 2 ? -1 : 1,
    headingY: 0,
    speed: (source.rules?.moveSpeed ?? 8) * 0.7,
    turnTicks: 60,
  }));
  const level = structuredClone(source);
  level.version = TEAM_RUNNING_LEVEL_VERSION;
  level.runningEnemies = {
    version: TEAM_RUNNING_RECIPE,
    baseVersion: source.version,
    baseRevision: source.revision,
    inheritedCombat: structuredClone(source.combatPatrols ?? null),
    actorIds: actors.map((actor) => actor.id),
  };
  level.combatPatrols = {
    version: 'combat-patrols.v1',
    enabled: true,
    actors: [...inherited, ...actors],
  };
  level.hunt = {
    version: 'humanoid-hunt.v1',
    mode: 'bonus',
    quota: 0,
    targets: actors.map((actor) => ({ id: actor.id, kind: 'runner' })),
  };
  const checked = validateCoopLevel(level);
  required(checked.valid, checked.errors.join(' '));
  return freezeDesign(level);
}

export function matchTeamRunningEnemyLevel(source, recorded) {
  try {
    return dataIdentity(prepareTeamRunningEnemies(source)) === dataIdentity(recorded);
  } catch {
    return false;
  }
}
