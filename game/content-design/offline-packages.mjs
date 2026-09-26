import { DEFAULT_JOURNEY_ROUTES } from './default-entry.mjs';
import { WHOLE_JOURNEY_CHAPTERS } from './whole-journey-order.mjs';

const chapterByPack = new Map(
  WHOLE_JOURNEY_CHAPTERS.flatMap(({ id, corePackId, remixPackId }) => [
    [corePackId, { id, remix: false }],
    [remixPackId, { id, remix: true }],
  ]),
);

/** Stable package navigation only; this never fetches content or changes progress. */
export function authoredPackageId(routeId, mode, packId) {
  if (!['solo', 'versus'].includes(mode)) return null;
  if (routeId !== DEFAULT_JOURNEY_ROUTES[mode]) return `archive:journey:${routeId}`;
  const chapter = chapterByPack.get(packId);
  if (chapter) {
    if (mode === 'solo' && chapter.id === 'horizon' && !chapter.remix)
      return 'solo:horizon-starter';
    return `${mode}:${chapter.id}${chapter.remix ? '-remixes' : ''}`;
  }
  return `${mode}:${packId}`;
}

/** Resolve from the exact loaded edition, never from a live server catalogue. */
export function authoredMissionDownloadGroup(route, mode, missionId) {
  if (!route?.source || !['solo', 'versus'].includes(mode)) return null;
  const mission = route.source.missions.find((item) => item.id === missionId);
  if (!mission?.modes.includes(mode)) return null;
  const owners = route.source.packs.filter((pack) =>
    pack.campaignIds.some((id) =>
      route.source.campaigns.some(
        (campaign) => campaign.id === id && campaign.missionIds.includes(missionId),
      ),
    ),
  );
  const ids = [...new Set(owners.map((pack) => authoredPackageId(route.id, mode, pack.id)))];
  if (ids.length > 1) throw new Error('Mission has ambiguous offline package ownership.');
  return ids[0] ?? null;
}
