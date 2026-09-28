import { boundedJSON, dataIdentity, exactKeys, required } from '../data-json.mjs';
import { compileContentProject } from './project.mjs';
import { validateCompletionRewards } from '../rewards/model.mjs';
import { validateDiscoveryRewardBindings } from './discovery-schema.mjs';
export { DISCOVERY_PACING_BEATS, DISCOVERY_EXHIBIT_LAYOUTS } from './discovery-schema.mjs';

/** Presentation-only authoring. Gameplay revision and completion bindings stay intact. */
export function editContentDiscovery(source, missionId, input, rewardSource = []) {
  const project = structuredClone(compileContentProject(source).source);
  const command = boundedJSON(input, { maxBytes: 4096, maxNodes: 64 });
  exactKeys(command, ['campaignId', 'pacingBeat', 'rewardRef', 'discovery'], 'discovery command');
  const mission = project.missions.find((item) => item.id === missionId);
  const campaign = project.campaigns.find((item) => item.id === command.campaignId);
  required(
    mission && campaign?.missionIds.includes(missionId),
    'Choose a mission in this campaign.',
  );
  for (const key of ['pacingBeat', 'rewardRef']) {
    if (command[key] === undefined || command[key] === null) delete mission.design[key];
    else mission.design[key] = command[key];
  }
  if (command.discovery === undefined || command.discovery === null) delete campaign.discovery;
  else campaign.discovery = command.discovery;
  const checked = compileContentProject(project).source;
  validateDiscoveryRewardBindings(checked, validateCompletionRewards(rewardSource), campaign.id);
  project.revision = `draft-${dataIdentity(project)}`;
  return structuredClone(compileContentProject(project).source);
}

/** Read-only author preview: no run, progress store or fabricated completion is created. */
export function projectDiscoveryPreview(source, campaignId, rewardSource = [], locale = 'en') {
  const project = compileContentProject(source).source;
  const rewards = validateCompletionRewards(rewardSource);
  validateDiscoveryRewardBindings(project, rewards, campaignId);
  required(['en', 'uk'].includes(locale), 'Choose a supported discovery language.');
  const campaign = project.campaigns.find((item) => item.id === campaignId);
  const reward = (reference) => {
    const item =
      reference &&
      rewards.find((entry) => entry.id === reference.id && entry.revision === reference.revision);
    return item
      ? {
          ...item.locales[locale],
          id: item.id,
          revision: item.revision,
          requirements: item.requirements.missions.map((entry) => entry.missionId),
        }
      : null;
  };
  return {
    campaignId,
    layout: campaign.discovery?.exhibitLayout ?? 'route',
    finale: reward(campaign.discovery?.finaleRewardRef),
    missions: campaign.missionIds.map((id) => {
      const mission = project.missions.find((item) => item.id === id);
      return {
        id,
        name: mission.name,
        pacingBeat: mission.design.pacingBeat ?? null,
        routeDecision: mission.design.routeDecision,
        memorableMoment: mission.design.memorableMoment,
        durationSeconds: [...mission.design.durationSeconds],
        reward: reward(mission.design.rewardRef),
      };
    }),
  };
}
