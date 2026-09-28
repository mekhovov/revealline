import { createCampaignLocalization } from '../editions/localization.mjs';
import { required } from '../data-json.mjs';
import { CURRICULUM_MISSIONS } from './curriculum.mjs';

const suffixes = {
  'Frontier patrols follow the changed boundary after capture; check the return edge before departing.':
    'Після захоплення патрулі рухаються вздовж зміненого кордону; перед виходом перевірте край, до якого повертатиметеся.',
  'Read the moving boundary before committing to the next connection.':
    'Перед наступним з’єднанням простежте за рухом на кордоні.',
};
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
      return [
        mission.id,
        {
          ...row.locales,
          uk: {
            ...row.locales.uk,
            brief: translatedField(mission.design.lesson, row.locales, 'brief'),
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
