import { contentText } from '../i18n/content.mjs';
import { t } from '../i18n/index.mjs';

/** Adapt one exact Journey edition without replacing its runtime mission objects,
 * profile scope, difficulty rules, or Next sequence. */
export function journeyLibrarySource({
  editionId,
  edition,
  editionLabel = () => edition,
  catalog,
  profile,
  launch,
  card,
  details,
  tags = () => [],
}) {
  return {
    id: `journey:${editionId}`,
    editionId,
    edition,
    collection: 'Journey',
    entries: catalog.missions,
    describe: (mission) => ({
      id: mission.id,
      campaignKey: JSON.stringify([mission.source, mission.packId, mission.campaignId]),
      campaignTitle: mission.campaignTitle,
      name: mission.name,
      levelIndex: mission.levelIndex,
      modes: mission.modes,
      hook: mission.hook,
      tags: tags(mission),
    }),
    availability: () => ({ state: 'ready' }),
    presentation: (mission) => ({
      edition: editionLabel(),
      name: contentText(mission, 'name'),
      campaignTitle: contentText(mission, 'campaignTitle'),
      hook: contentText(mission, 'hook'),
    }),
    progress(mission, mode) {
      const state = profile.snapshot();
      return Object.hasOwn(state.clears[mode] ?? {}, mission.id)
        ? t('interface:cleared')
        : state.skipped[mode]?.includes(mission.id)
          ? t('interface:skippedTryAgain')
          : '';
    },
    card,
    details,
    launch,
  };
}
