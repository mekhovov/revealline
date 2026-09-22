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
      const state = profile.snapshot();
      return Object.hasOwn(state.clears[mode] ?? {}, mission.id)
        ? 'Cleared'
        : state.skipped[mode]?.includes(mission.id)
          ? 'Skipped · try again'
          : '';
    },
    card,
    details,
    launch,
  };
}
