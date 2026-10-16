import { required } from '../data-json.mjs';
import { validateKnowledgeProfiles } from '../rewards/learning-profiles.mjs';
import { editDiscoveryPayload } from './discovery.mjs';

export function editDiscoveryProfiles(source, rewards, rewardId, payloadId, profiles) {
  validateKnowledgeProfiles(profiles);
  const original = rewards
    .find((item) => item.id === rewardId)
    ?.payloads.find((item) => item.id === payloadId);
  required(original?.type === 'knowledge', 'Select an existing knowledge discovery.');
  return editDiscoveryPayload(
    source,
    rewards,
    rewardId,
    { ...original, profiles: structuredClone(profiles) },
    'profiles',
  );
}
