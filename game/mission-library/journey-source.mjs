import { emptyJourneyPictures, journeyPictureCompletion } from '../journey/pictures.mjs';
/** Adapt one exact Journey edition without replacing its runtime mission objects,
 * profile scope, difficulty rules, or Next sequence. */
export function journeyLibrarySource({
  editionId,
  edition,
  catalog,
  profile,
  launch,
  card,
  details,
  tags = () => [],
}) {
  let cached = null;
  const stateRevision =
    typeof profile?.stateRevision === 'function' ? () => profile.stateRevision() : null;
  function currentState() {
    const revision = stateRevision?.();
    if (cached && revision !== undefined && revision === cached.revision) return cached;
    const snapshot = profile.snapshot(),
      pictures = profile.pictures?.() ?? emptyJourneyPictures(),
      earned = new Map();
    for (const record of pictures.records) {
      if (record.editionId !== editionId) continue;
      if (!earned.has(record.mode)) earned.set(record.mode, new Map());
      earned.get(record.mode).set(record.missionId, record);
    }
    const captured = { revision, snapshot, earned };
    if (revision !== undefined) cached = captured;
    return captured;
  }
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
    progress(mission, mode) {
      if (!profile) return '';
      const { snapshot } = currentState();
      return Object.hasOwn(snapshot.clears[mode] ?? {}, mission.id)
        ? 'Cleared'
        : snapshot.skipped[mode]?.includes(mission.id)
          ? 'Skipped · try again'
          : '';
    },
    completion(mission, mode) {
      if (!profile) return null;
      const { snapshot, earned } = currentState(),
        record = earned.get(mode)?.get(mission.id);
      return journeyPictureCompletion({
        profile: snapshot,
        pictures: record ? { records: [record] } : emptyJourneyPictures(),
        mode,
        editionId,
        missionId: mission.id,
      });
    },
    card,
    details,
    launch,
  };
}
