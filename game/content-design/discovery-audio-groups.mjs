import { required } from '../data-json.mjs';
import { editDiscoveryReward } from './discovery.mjs';
import { validateRewardAudioGroups } from '../rewards/audio-groups.mjs';

export function editDiscoveryAudioGroups(source, rewards, rewardId, input) {
  return editDiscoveryReward(
    source,
    rewards,
    rewardId,
    (reward) => {
      required(Array.isArray(input), 'Provide ordered audio groups.');
      if (input.length) reward.audioGroups = validateRewardAudioGroups(input, reward.payloads);
      else delete reward.audioGroups;
    },
    'playlist',
  );
}
