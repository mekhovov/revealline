import { dataIdentity, required } from '../data-json.mjs';
import { compileContentProject } from './project.mjs';
import { COMBAT_ACTOR_CATALOG } from './catalogs.mjs';

function ownedMission(source, missionId) {
  const project = structuredClone(compileContentProject(source).source);
  const mission = project.missions.find((entry) => entry.id === missionId);
  required(mission, 'Choose an existing mission.');
  required(!mission.modes.includes('team'), 'Optional combat authoring is not qualified for Team.');
  return { project, mission };
}

function revise(entity, change) {
  entity.revision = `draft-${dataIdentity({ id: entity.id, previous: entity.revision, change })}`;
}

/** Propagate this explicit edition only through its actual ownership references. */
function finish(project, mission, command) {
  revise(mission, command);
  const changedCampaigns = new Map();
  for (const campaign of project.campaigns) {
    if (!campaign.missionIds.includes(mission.id)) continue;
    revise(campaign, { missionId: mission.id, missionRevision: mission.revision });
    changedCampaigns.set(campaign.id, campaign.revision);
  }
  for (const pack of project.packs) {
    const campaigns = pack.campaignIds
      .filter((id) => changedCampaigns.has(id))
      .map((id) => ({ id, revision: changedCampaigns.get(id) }));
    if (campaigns.length) revise(pack, { campaigns });
  }
  project.revision = `draft-${dataIdentity(project)}`;
  return structuredClone(compileContentProject(project).source);
}

/** Upgrade a private authoring copy, without inserting or enabling any actors. */
export function prepareCombatAuthoring(source, missionId) {
  const { project, mission } = ownedMission(source, missionId);
  if (Object.hasOwn(mission, 'combat')) return project;
  project.actorCatalogId = COMBAT_ACTOR_CATALOG.id;
  mission.combat = { version: 'mission-combat.v1', enabled: false };
  return finish(project, mission, {
    action: 'prepare-combat-authoring',
    version: mission.combat.version,
  });
}

/** Explicit on/off editions preserve authored actors and receive fresh ancestry. */
export function setMissionCombatEnabled(source, missionId, enabled) {
  const { project, mission } = ownedMission(source, missionId);
  required(typeof enabled === 'boolean', 'Combat enabled must be an explicit boolean.');
  required(Object.hasOwn(mission, 'combat'), 'Prepare combat authoring for this mission first.');
  if (mission.combat.enabled === enabled) return project;
  mission.combat.enabled = enabled;
  return finish(project, mission, { action: 'set-mission-combat-enabled', enabled });
}
