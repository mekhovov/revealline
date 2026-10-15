import { createCampaignLocalization } from '../editions/localization.mjs';
import { required } from '../data-json.mjs';
import { CURRICULUM_MISSIONS } from './curriculum.mjs';
import { CURRICULUM_SCENES_UK } from './curriculum-scene-localization.mjs';
import phraseData from './curriculum-localization-phrases.json' with { type: 'json' };

// Exact canonical English keys belong to build-time translation data. Keep phrase
// matching here separate from the authored Ukrainian values.
const suffixes = phraseData.suffixes;
const detailPhrases = { ...suffixes, ...phraseData.details };
function translatedDetail(canonical) {
  const parts = [];
  let remaining = canonical;
  const phrases = Object.keys(detailPhrases).sort((a, b) => b.length - a.length);
  while (remaining) {
    const phrase = phrases.find(
      (value) => remaining === value || remaining.startsWith(`${value} `),
    );
    required(phrase, 'Curriculum mission detail needs an explicit Ukrainian translation.');
    parts.push(detailPhrases[phrase]);
    remaining = remaining.slice(phrase.length).trim();
  }
  return parts.join(' ');
}
function translatedField(canonical, local, field) {
  const original = local.en[field],
    translation = local.uk[field];
  required(
    canonical === original || canonical.startsWith(`${original} `),
    'Curriculum localization has stale canonical instructions.',
  );
  const suffix = canonical.slice(original.length).trim();
  required(
    !suffix || suffixes[suffix],
    'Curriculum mechanics guidance needs an explicit Ukrainian translation.',
  );
  return suffix ? `${translation} ${suffixes[suffix]}` : translation;
}

export function createCurriculumLocalization({ definition, source }) {
  const missionLocales = Object.fromEntries(
    source.missions.map((mission) => {
      const row = CURRICULUM_MISSIONS.find((item) => item.id === mission.id);
      required(row, 'Curriculum localization mission is missing.');
      required(
        CURRICULUM_SCENES_UK[row.campaignId]?.[row.ordinal - 1],
        'Curriculum scene needs an explicit Ukrainian translation.',
      );
      return [
        mission.id,
        {
          ...row.locales,
          uk: {
            ...row.locales.uk,
            brief: translatedField(mission.design.lesson, row.locales, 'brief'),
            counterplay: translatedDetail(mission.design.counterplay),
            captureConsequence: translatedDetail(mission.design.captureConsequence),
            mastery: translatedDetail(mission.design.mastery),
            memorableMoment: CURRICULUM_SCENES_UK[row.campaignId]?.[row.ordinal - 1],
            routeDecision: translatedField(
              mission.design.routeDecision,
              row.locales,
              'routeDecision',
            ),
          },
        },
      ];
    }),
  );
  return createCampaignLocalization({
    source,
    campaignId: definition.id,
    campaignLocales: definition.locales,
    missionLocales,
  });
}
