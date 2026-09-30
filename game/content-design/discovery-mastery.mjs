import { required } from '../data-json.mjs';
import { JOURNEY_NO_LOSS_MASTERY } from '../mastery-journey.mjs';
import { editDiscoveryReward } from './discovery.mjs';

/** An explicit optional promise edit gets a new immutable reward revision.
 * Mission bindings, lessons, media, languages and gameplay stay byte-identical. */
export function editDiscoveryMastery(source, rewards, rewardId, missionIds) {
  return editDiscoveryReward(
    source,
    rewards,
    rewardId,
    (reward) => {
      required(
        Array.isArray(missionIds) &&
          missionIds.length <= 128 &&
          new Set(missionIds).size === missionIds.length &&
          missionIds.every((id) =>
            reward.requirements.missions.some((item) => item.missionId === id),
          ),
        'Select distinct no-life-lost goals only from this reward’s declared mission wins.',
      );
      reward.requirements.mastery = missionIds.map((missionId) => ({
        id: JOURNEY_NO_LOSS_MASTERY.id,
        revision: JOURNEY_NO_LOSS_MASTERY.revision,
        missionId,
      }));
    },
    'mastery',
  );
}
