import { dataIdentity, required } from '../data-json.mjs';
import { compileContentProject, resolveMission } from './project.mjs';
import { freezeDesign } from './catalogs.mjs';
import { validateCoopPack } from '../coop/recipes.mjs';
import { journeyTeamPackEdition } from '../coop/foundations.mjs';

/** One exact selected mission for the real Team importer. Geometry/rules only:
 * never bundles a reference image, grants progress, or publishes a campaign. */
export function createTeamTestPack(source, missionId, difficulty = 'standard') {
  const project = compileContentProject(source);
  const manifest = resolveMission(project, missionId, { mode: 'team', difficulty });
  return buildTeamTestPack(
    [manifest],
    dataIdentity({ project: project.source.id, missionId }),
    manifest.level.name,
  );
}

/** Export one explicitly selected authored campaign, preserving order and runtime
 * editions. This enables real-host Next testing without official enrollment. */
export function createTeamCampaignTestPack(source, campaignId, difficulty = 'standard') {
  const project = compileContentProject(source);
  const campaign = project.campaigns.find((item) => item.id === campaignId && !item.archived);
  required(campaign, 'Choose an active Team campaign.');
  const missionIds = campaign.missionIds.filter((id) =>
    project.missions.some(
      (mission) => mission.id === id && !mission.archived && mission.modes.includes('team'),
    ),
  );
  required(missionIds.length > 0, 'This campaign has no active Team missions.');
  const manifests = missionIds.map((id) =>
    resolveMission(project, id, { mode: 'team', difficulty }),
  );
  required(
    manifests.every((manifest) => manifest.level.version === manifests[0].level.version),
    'A Team campaign must use one explicitly authored runtime edition; old editions are not silently upgraded.',
  );
  return buildTeamTestPack(
    manifests,
    dataIdentity({ project: project.source.id, campaignId }),
    campaign.name,
  );
}

function buildTeamTestPack(manifests, identity, name) {
  required(
    manifests.every((manifest) => !manifest.diagnostics.some((item) => item.severity === 'error')),
    'Resolve the mission topology errors before exporting a playable Team test pack.',
  );
  const levels = manifests.map((manifest) => manifest.level);
  const pack = {
    ...journeyTeamPackEdition(levels[0]),
    id: `studio-team-${identity}`,
    revision: `candidate-${dataIdentity(levels.length === 1 ? levels[0] : levels)}`,
    name,
    levels,
  };
  const result = validateCoopPack(pack);
  required(result.valid, result.errors.join(' '));
  return freezeDesign(pack);
}
