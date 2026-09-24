import { journeyLibrarySource } from './journey-source.mjs';
import { journeyMissionDetails, authoredJourneyMissionTags } from './journey-presentation.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';

export const TEAM_LIBRARY_JOURNEY_EDITION = 'team-trail-impact-originals-1';
export const TEAM_LIBRARY_CLASSIC_SOURCE = 'team-classic:relay-rescue-starter';

/** Team's runtime rows and opaque imported-art owner remain outside display
 * identities. Presets resolve at activation; they are not extra missions. */
export function teamJourneyLibrarySource({
  journey,
  editionId = TEAM_LIBRARY_JOURNEY_EDITION,
  edition = 'Team Journey',
  progress,
  // Hosts adopting new runtime pressure explicitly supply their edition hash.
  // Historical readers keep authored receipt semantics unless they opt in.
  gameplayIdentity = (row) => row.simulationIdentity,
  difficulty = () => 'standard',
  launch,
}) {
  const source = journeyLibrarySource({
    editionId,
    edition,
    catalog: journey.catalog,
    profile: progress ?? { snapshot: () => ({ clears: {}, skipped: {} }) },
    tags: (mission) => authoredJourneyMissionTags(mission, journey.manifest(mission, difficulty())),
    card: (mission) => journey.card(mission, difficulty()),
    launch(mission, context) {
      const row = journey.row(mission, difficulty());
      if (!row || !journey.owns(row)) throw new Error('This Team mission is no longer available.');
      return launch(row, context);
    },
  });
  return {
    ...source,
    details: (mission) => journeyMissionDetails(journey.manifest(mission, difficulty())),
    progress(mission) {
      if (!progress) return '';
      const profile = progress.snapshot(),
        receipt = profile.clears.team?.[mission.id];
      if (!receipt)
        return profile.skipped.team?.includes(mission.id) ? 'Skipped · try again' : 'Not cleared';
      const cleared = journey.row(mission, receipt.difficulty);
      const exact = Boolean(cleared && receipt.gameplayId === gameplayIdentity(cleared));
      return (
        `${exact ? 'Cleared' : 'Earlier edition cleared'} on ${receipt.difficulty}` +
        (exact && receipt.difficulty === difficulty()
          ? ' · selected edition'
          : ' · no clear recorded for this selected edition')
      );
    },
  };
}

/** Only caller-validated Team pack rows may enter this source. A visit-local
 * import must use a unique visit identity even if every authored ID matches. */
export function teamArenaLibrarySource({
  rows,
  sourceId = TEAM_LIBRARY_CLASSIC_SOURCE,
  editionId = `${COOP_STARTER_PACK.id}@${COOP_STARTER_PACK.revision}`,
  edition = 'Relay Rescue · Classic arenas',
  collection = 'Classic',
  isCurrent = (row) => rows.includes(row),
  launch,
}) {
  if (!['Classic', 'Custom'].includes(collection)) throw new TypeError('Unknown Team collection.');
  if (
    sourceId === TEAM_LIBRARY_CLASSIC_SOURCE &&
    (collection !== 'Classic' || rows.some((row) => row.pack !== COOP_STARTER_PACK))
  )
    throw new TypeError('Classic Team identity requires the exact built-in pack owner.');
  const bindings = new Map(
    rows.map((row) => [
      row,
      {
        pack: row.pack,
        level: row.level,
        levelId: row.levelId,
        packId: row.pack.id,
        revision: row.pack.revision,
        artworkSource: row.artworkSource,
      },
    ]),
  );
  const current = (row) => {
    const owner = bindings.get(row);
    return Boolean(
      owner &&
        isCurrent(row) &&
        row.pack === owner.pack &&
        row.level === owner.level &&
        row.levelId === owner.levelId &&
        row.level.id === owner.levelId &&
        row.pack.id === owner.packId &&
        row.pack.revision === owner.revision &&
        row.pack.levels.includes(owner.level) &&
        row.artworkSource === owner.artworkSource,
    );
  };
  return {
    id: sourceId,
    editionId,
    edition,
    collection,
    entries: rows,
    describe: (row) => ({
      id: row.levelId,
      revision: row.pack.revision,
      campaignKey: row.pack.id,
      campaignTitle: row.packName,
      name: row.title,
      levelIndex: row.pack.levels.indexOf(row.level),
      modes: ['team'],
      rules: row.goal,
    }),
    availability: (row) =>
      current(row)
        ? { state: 'ready' }
        : { state: 'unavailable', reason: 'This Team pack is no longer available in this visit.' },
    launch(row, context) {
      if (!current(row)) throw new Error('This Team pack selection has changed.');
      return launch(row, context);
    },
  };
}
