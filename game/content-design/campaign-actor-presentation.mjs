import { withCampaignPresentation, JOURNEY_CAMPAIGN_THEMES } from './campaign-presentation.mjs';
import { journeyActorThemeMaterial } from '../presentation/journey-actor-materials.mjs';

/** Copy-on-write presentation only. Prior themed factories stay exact. */
export function withCampaignActorPresentation(source, chapterId) {
  if (!Object.hasOwn(JOURNEY_CAMPAIGN_THEMES, chapterId))
    throw new Error('Unknown Journey presentation chapter.');
  const themeId = `${JOURNEY_CAMPAIGN_THEMES[chapterId]}-actors-v1`;
  if (!journeyActorThemeMaterial(themeId)) throw new Error('Missing campaign material.');
  if (!source.missions?.length) throw new Error('A presentation chapter needs missions.');
  if (source.missions.every((mission) => mission.presentation.themeId === themeId))
    return structuredClone(source);
  const copy = withCampaignPresentation(source, chapterId);
  const revision = (value) => `${value}-actors-1`;
  copy.id += '-actors';
  copy.revision = revision(copy.revision);
  for (const key of ['missions', 'campaigns', 'packs'])
    for (const item of copy[key]) item.revision = revision(item.revision);
  for (const mission of copy.missions) mission.presentation.themeId = themeId;
  return copy;
}
