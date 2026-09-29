import { boundedJSON, dataIdentity, exactKeys, required } from '../data-json.mjs';
import { compileContentProject } from './project.mjs';
import { validateCompletionRewardPayload, validateCompletionRewards } from '../rewards/model.mjs';
import { validateDiscoveryRewardBindings } from './discovery-schema.mjs';
import { validateExplorationPayload } from '../rewards/exploration.mjs';
export { DISCOVERY_PACING_BEATS, DISCOVERY_EXHIBIT_LAYOUTS } from './discovery-schema.mjs';

/** Editing an exhibit never edits its promised requirements. New immutable
 * payload revisions rebind only references to the exact old authored reward. */
export function editDiscoveryExploration(source, rewardSource, rewardId, input) {
  return editDiscoveryPayload(
    source,
    rewardSource,
    rewardId,
    validateExplorationPayload(input),
    'explore',
  );
}

export function editDiscoveryResource(source, rewardSource, rewardId, input) {
  const payload = validateCompletionRewardPayload(input);
  required(payload.type === 'url', 'Resource editor requires a URL reward.');
  return editDiscoveryPayload(source, rewardSource, rewardId, payload, 'resource');
}

export function editDiscoveryPayload(source, rewardSource, rewardId, payload, prefix) {
  return editDiscoveryReward(
    source,
    rewardSource,
    rewardId,
    (reward) => {
      const index = reward.payloads.findIndex((item) => item.id === payload.id);
      required(
        index < 0 || reward.payloads[index].type === payload.type,
        'A payload cannot replace another reward payload type.',
      );
      if (index < 0) reward.payloads.push(payload);
      else reward.payloads[index] = payload;
    },
    prefix,
  );
}

/** Shared authored revision/rebinding boundary. The editor supplies the mutation;
 * imported data cannot execute a callback. Existing promised revisions stay
 * frozen in player receipts and retained presentation snapshots. */
export function editDiscoveryReward(source, rewardSource, rewardId, mutate, prefix) {
  const project = structuredClone(compileContentProject(source).source),
    rewards = structuredClone(validateCompletionRewards(rewardSource)),
    reward = rewards.find((item) => item.id === rewardId);
  required(reward, 'Choose an authored reward before editing it.');
  const previousRevision = reward.revision;
  mutate(reward);
  const { revision: _revision, ...content } = reward;
  reward.revision = `${prefix}-${dataIdentity(content)}`;
  const rebind = (reference) => {
    if (reference?.id === reward.id && reference.revision === previousRevision)
      reference.revision = reward.revision;
  };
  for (const mission of project.missions) rebind(mission.design?.rewardRef);
  for (const campaign of project.campaigns) rebind(campaign.discovery?.finaleRewardRef);
  project.revision = `draft-${dataIdentity(project)}`;
  const checked = compileContentProject(project).source,
    definitions = validateCompletionRewards(rewards);
  for (const campaign of checked.campaigns)
    validateDiscoveryRewardBindings(checked, definitions, campaign.id);
  return { source: structuredClone(checked), rewards: structuredClone(definitions) };
}

/** Presentation-only authoring. Gameplay revision and completion bindings stay intact. */
export function editContentDiscovery(source, missionId, input, rewardSource = []) {
  const project = structuredClone(compileContentProject(source).source);
  const command = boundedJSON(input, { maxBytes: 16384, maxNodes: 128 });
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
