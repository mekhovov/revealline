import { required, dataIdentity } from '../../game/data-json.mjs';
import { createRewardMissionBindings } from '../../game/rewards/bindings.mjs';
import { projectRewardProgress, validateCompletionReward } from '../../game/rewards/model.mjs';
import {
  validateCampaignLocalization,
  campaignLocalizationSha256,
} from '../../game/editions/localization.mjs';

/** Rebase exact translation records after presentation-only author edits. The
 * normal validator still rejects changed English or any missing/foreign record. */
export async function rebindStudioRewardLocalization({ localization, source, descriptor }) {
  const candidate = structuredClone(localization);
  for (const row of candidate.records) {
    const record = (row.kind === 'campaign' ? source.campaigns : source.missions).find(
      (item) => item.id === row.id,
    );
    required(record, 'Localization record disappeared while editing its reward.');
    row.identity = dataIdentity(record);
  }
  candidate.revision = `reward-${dataIdentity(candidate)}`;
  const value = validateCampaignLocalization(candidate, source, descriptor);
  return { localization: value, sha256: await campaignLocalizationSha256(value) };
}

/** Creates a draft only after an author explicitly chooses its completion rule.
 * Preview evidence never reaches a profile, reward receipt or persistence API. */
export function createStudioReward({ campaign, source, rule, missionId, missionIds, id, locales }) {
  required(
    ['mission-win', 'all-missions', 'selected-missions'].includes(rule),
    'Choose a completion rule explicitly.',
  );
  const all = createRewardMissionBindings(source).filter(
    (entry) => entry.campaignId === campaign.id,
  );
  if (rule === 'selected-missions')
    required(
      Array.isArray(missionIds) &&
        missionIds.length > 0 &&
        new Set(missionIds).size === missionIds.length &&
        missionIds.every((id) => all.some((entry) => entry.levelId === id)),
      'Choose distinct missions in this campaign.',
    );
  const selected =
    rule === 'all-missions'
      ? all
      : all.filter((entry) =>
          rule === 'mission-win' ? entry.levelId === missionId : missionIds.includes(entry.levelId),
        );
  required(selected.length > 0, 'Choose a mission in this campaign.');
  return validateCompletionReward({
    format: 'revealline-completion-reward.v1',
    id,
    revision: '1',
    brandId: campaign.brandId,
    campaignId: campaign.id,
    scope: {
      kind: rule === 'mission-win' ? 'mission' : 'campaign',
      id: rule === 'mission-win' ? missionId : campaign.id,
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
