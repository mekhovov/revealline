import { boundedJSON, canonicalJSON, exactKeys, required } from '../data-json.mjs';

export const TEAM_RUNNING_LEVEL_VERSION = 'revealline-coop-level.v9';
export const TEAM_RUNNING_RULESET = 'revealline-coop.v11';
export const TEAM_RUNNING_PACK_VERSION = 'revealline-coop-pack.v9';
export const TEAM_RUNNING_RECIPE = 'running-enemies.v1';
export const inheritedTeamVersion = (level) =>
  level.version === TEAM_RUNNING_LEVEL_VERSION ? level.runningEnemies?.baseVersion : level.version;

/** Reconstruct the inherited edition for its unchanged admission and mechanics. */
export function inheritedRunningTeamLevel(source) {
  const level = boundedJSON(source, {
    maxBytes: 256 * 1024,
    maxNodes: 20000,
    maxDepth: 16,
    maxArray: 8192,
  });
  const recipe = level.runningEnemies;
  exactKeys(
    recipe,
    ['version', 'baseVersion', 'baseRevision', 'inheritedCombat', 'actorIds'],
    'Team running enemies',
  );
  required(
    recipe.version === TEAM_RUNNING_RECIPE &&
      /^revealline-coop-level\.v[1-8]$/.test(recipe.baseVersion),
    'Unsupported Team running-enemy inheritance.',
  );
  required(
    (recipe.inheritedCombat === null || typeof recipe.inheritedCombat === 'object') &&
      Array.isArray(recipe.actorIds) &&
      recipe.actorIds.length > 0 &&
      recipe.actorIds.length <= 6 &&
      new Set(recipe.actorIds).size === recipe.actorIds.length,
    'Team running enemies need a bounded distinct population.',
  );
  required(
    level.hunt?.mode === 'bonus' &&
      level.hunt.quota === 0 &&
      level.hunt.targets.length === recipe.actorIds.length &&
      level.hunt.targets.every(
        (target, index) => target.id === recipe.actorIds[index] && target.kind === 'runner',
      ),
    'Running enemies preserve the original objective with an optional Bonus population.',
  );
  required(
    level.combatPatrols?.enabled === true &&
      recipe.actorIds.every(
        (id) => level.combatPatrols.actors.filter((actor) => actor.id === id).length === 1,
      ),
    'Running-enemy population is incomplete.',
  );
  required(
    level.enemies.length + level.combatPatrols.actors.length <= 46,
    'Running-enemy Team editions support at most 46 total actors.',
  );
  required(
    level.revision === recipe.baseRevision,
    'Running enemies must preserve the accepted base revision.',
  );
  level.version = recipe.baseVersion;
  level.revision = recipe.baseRevision;
  const retained = level.combatPatrols.actors.filter(
    (actor) => !recipe.actorIds.includes(actor.id),
  );
  required(
    canonicalJSON(retained) ===
      canonicalJSON(recipe.inheritedCombat?.enabled ? recipe.inheritedCombat.actors : []),
    'Inherited Team patrols changed.',
  );
  if (recipe.inheritedCombat === null) delete level.combatPatrols;
  else level.combatPatrols = recipe.inheritedCombat;
  delete level.hunt;
  delete level.runningEnemies;
  const inheritedIds = new Set();
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.id === 'string') inheritedIds.add(value.id);
    for (const child of Object.values(value)) visit(child);
  };
  visit(level);
  required(
    recipe.actorIds.every((id) => !inheritedIds.has(id)),
    'Running-enemy identities must not shadow inherited Team entities.',
  );
  return level;
}
