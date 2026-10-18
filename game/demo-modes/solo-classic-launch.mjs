import { libraryMissionId } from '../mission-library/library.mjs';
import { missionLibraryHref } from '../mission-library/handoff.mjs';

/** A demo can name the ordinary authored mission, never install or unlock it. */
export function soloClassicDemoLaunchURL(row) {
  return missionLibraryHref({
    baseURL: new URL('../', import.meta.url).href,
    currentMode: 'solo',
    mode: 'solo',
    journey: 'legacy',
    ready: true,
    missionId: libraryMissionId({
      owner: JSON.stringify(['classic', row.source, row.packId]),
      edition: row.sourceFile.sha256,
      campaign: row.campaignKey,
      mission: row.levelId,
      revision: row.levelRevision,
    }),
  });
}
