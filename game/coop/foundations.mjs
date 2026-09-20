import { compileMapGeometry } from '../content-design/map.mjs';

export const COOP_FOUNDATION_LEVEL_VERSION = 'revealline-coop-level.v2';
export const COOP_FOUNDATION_RULESET = 'revealline-coop.v4';
export const COOP_FOUNDATION_PACK_VERSION = 'revealline-coop-pack.v2';
export const COOP_TERRAIN_LEVEL_VERSION = 'revealline-coop-level.v3';
export const COOP_TERRAIN_RULESET = 'revealline-coop.v5';
export const COOP_TERRAIN_PACK_VERSION = 'revealline-coop-pack.v3';

export const isJourneyTeamLevel = (level) =>
  [COOP_FOUNDATION_LEVEL_VERSION, COOP_TERRAIN_LEVEL_VERSION].includes(level.version);
export const isJourneyTeamRuleset = (ruleset) =>
  [COOP_FOUNDATION_RULESET, COOP_TERRAIN_RULESET].includes(ruleset);

/** Explicit new runtime edition. Historical Team levels retain their connected
 * safe-rectangle contract. New editions share Solo/Studio geometry validation. */
export function compileCoopFoundationGeometry(level) {
  return compileMapGeometry({
    width: level.width,
    height: level.height,
    walls: level.walls ?? [],
    foundations: level.safeRects ?? [],
    terrain: level.version === COOP_TERRAIN_LEVEL_VERSION ? level.terrain : [],
    spawns: level.spawns.map((spawn, seat) => ({ id: `player-${seat + 1}`, ...spawn })),
  });
}
