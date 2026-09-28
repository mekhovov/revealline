import { required } from '../../game/data-json.mjs';
import { createRewardMissionBindings } from '../../game/rewards/bindings.mjs';
import { projectRewardProgress, validateCompletionReward } from '../../game/rewards/model.mjs';

/** Creates a draft only after an author explicitly chooses its completion rule.
 * Preview evidence never reaches a profile, reward receipt or persistence API. */
export function createStudioReward({ campaign, source, rule, missionId, id, locales }) {
  required(['mission-win', 'all-missions'].includes(rule), 'Choose a completion rule explicitly.');
  const all = createRewardMissionBindings(source).filter(
    (entry) => entry.campaignId === campaign.id,
  );
  const selected =
    rule === 'all-missions' ? all : all.filter((entry) => entry.levelId === missionId);
  required(selected.length > 0, 'Choose a mission in this campaign.');
  return validateCompletionReward({
    format: 'revealline-completion-reward.v1',
    id,
    revision: '1',
    brandId: campaign.brandId,
    campaignId: campaign.id,
    scope: {
      kind: rule === 'all-missions' ? 'campaign' : 'mission',
      id: rule === 'all-missions' ? campaign.id : missionId,
    },
    locales: Object.fromEntries(
      ['en', 'uk'].map((locale) => [
        locale,
        {
          title: locales[locale].title,
          teaser: locales[locale].teaser,
        },
      ]),
    ),
    requirements: {
      missions: selected.map((entry) => ({ missionId: entry.levelId, bindings: entry.bindings })),
      learning: [],
      mastery: [],
    },
    payloads: [
      {
        id: `${id}-knowledge`,
        type: 'knowledge',
        locales: Object.fromEntries(
          ['en', 'uk'].map((locale) => [
            locale,
            {
              title: locales[locale].title,
              paragraphs: [locales[locale].paragraph],
              sources: [],
            },
          ]),
        ),
      },
    ],
  });
}

export function previewStudioReward(reward, { edition, state }) {
  const definition = validateCompletionReward(reward);
  required(['locked', 'partial', 'eligible'].includes(state), 'Choose a reward preview state.');
  const completed =
    state === 'eligible'
      ? definition.requirements.missions
      : state === 'partial'
        ? definition.requirements.missions.slice(0, -1)
        : [];
  return projectRewardProgress(definition, {
    editionId: edition.id,
    brandId: edition.brandId,
    campaignIds: edition.campaignIds,
    clears: Object.fromEntries(
      completed.map((requirement, index) => [
        requirement.missionId,
        {
          ...requirement.bindings[0],
          runId: `studio-preview-${index}`,
        },
      ]),
    ),
    learning: [],
    mastery: [],
  });
}
