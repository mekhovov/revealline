import { dataIdentity, required } from '../data-json.mjs';
import { compileContentProject, resolveMission } from './project.mjs';
import { freezeDesign } from './catalogs.mjs';
import { validateCoopPack } from '../coop/recipes.mjs';
import {
  COOP_FOUNDATION_PACK_VERSION,
  COOP_FOUNDATION_RULESET,
  COOP_TERRAIN_LEVEL_VERSION,
  COOP_TERRAIN_PACK_VERSION,
  COOP_TERRAIN_RULESET,
} from '../coop/foundations.mjs';

/** One exact selected mission for the real Team importer. Geometry/rules only:
 * never bundles a reference image, grants progress, or publishes a campaign. */
export function createTeamTestPack(source, missionId, difficulty = 'standard') {
  const project = compileContentProject(source);
  const manifest = resolveMission(project, missionId, { mode: 'team', difficulty });
  required(
    !manifest.diagnostics.some((item) => item.severity === 'error'),
    'Resolve the mission topology errors before exporting a playable Team test pack.',
  );
  const identity = dataIdentity({ project: project.source.id, missionId });
  const terrain = manifest.level.version === COOP_TERRAIN_LEVEL_VERSION;
  const pack = {
    version: terrain ? COOP_TERRAIN_PACK_VERSION : COOP_FOUNDATION_PACK_VERSION,
    ruleset: terrain ? COOP_TERRAIN_RULESET : COOP_FOUNDATION_RULESET,
    id: `studio-team-${identity}`,
    revision: `candidate-${dataIdentity(manifest.level)}`,
    name: manifest.level.name,
    levels: [manifest.level],
  };
  const result = validateCoopPack(pack);
  required(result.valid, result.errors.join(' '));
  return freezeDesign(pack);
}
