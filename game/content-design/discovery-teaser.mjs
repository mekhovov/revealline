import { validateRewardTeaserImage } from '../rewards/model.mjs';
import { editDiscoveryReward } from './discovery.mjs';

/** Changes presentation only. Existing requirement sets and engine identities
 * are preserved; the existing sidecar editor rebinds exact authored references. */
export function editDiscoveryTeaser(source, rewards, rewardId, input) {
  const teaser = input === null ? null : validateRewardTeaserImage(input);
  return editDiscoveryReward(
    source,
    rewards,
    rewardId,
    (reward) => {
      if (teaser) reward.teaserImage = teaser;
      else delete reward.teaserImage;
    },
    'teaser',
  );
}
