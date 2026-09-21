import { required, stableId } from '../data-json.mjs';
import { freezeDesign } from './catalogs.mjs';
import { createOpeningCandidates } from './horizon-candidates.mjs';
import { createBorderCandidates } from './border-candidates.mjs';
import {
  createWholeJourneyCandidates,
  WHOLE_JOURNEY_CORE_PACK_IDS,
} from './whole-journey-candidates.mjs';

/** Explicit staged library. Appending a campaign never rewrites existing mission,
 * pack or execution identities, and optional Remixes never interrupt core play.
 * The frozen opening URL retains its previous library and suspended-flight slot. */
export function createAuthoredJourneyRoute(id) {
  // A separate explicit review URL and suspended-flight slot. Never expand the
  // historical routes or infer publication/qualification from having artwork.
  if (['whole-originals', 'whole-originals-v2'].includes(id))
    return freezeDesign({
      id,
      label:
        id === 'whole-originals-v2'
          ? 'Whole Journey first-capture teaching review'
          : 'Whole Journey original-picture review',
      sessionKey: `revealline.suspended.journey-whole-originals.${id === 'whole-originals-v2' ? 'v2' : 'v1'}`,
      source: createWholeJourneyCandidates({
        artwork: true,
        roverTeaching: id === 'whole-originals-v2',
      }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
    });
  if (!['opening', 'authored'].includes(id)) return null;
  const source = createOpeningCandidates({ artwork: true });
  const corePackIds = ['journey-opening'];
  if (id === 'authored') {
    const border = createBorderCandidates({ artwork: true });
    source.id = 'journey-candidates';
    source.name = 'Horizon + Border Bloom · test candidates';
    source.revision = 'border-r1';
    for (const key of ['maps', 'missions', 'campaigns', 'assets']) source[key].push(...border[key]);
    corePackIds.push('journey-border');
    // Display and compiler order agree. Filtering a chooser does not change it.
    const packs = [...source.packs, ...border.packs];
    source.packs = [
      ...packs.filter((pack) => corePackIds.includes(pack.id)),
      ...packs.filter((pack) => !corePackIds.includes(pack.id)),
    ];
  }
  return freezeDesign({
    id,
    label: id === 'opening' ? 'Opening Journey' : 'Horizon + Border Journey',
    sessionKey: `revealline.suspended.journey-${id}.v1`,
    source,
    corePackIds,
  });
}

/** Navigation policy shared by real Solo and paired-board hosts. IDs are an
 * explicit authoring selection, not inferred from titles or imported flags. */
export function createCandidateSequence(catalog, corePackIds) {
  required(
    Array.isArray(corePackIds) &&
      corePackIds.length > 0 &&
      corePackIds.every(stableId) &&
      new Set(corePackIds).size === corePackIds.length &&
      corePackIds.every((id) => catalog.missions.some((mission) => mission.packId === id)),
    'Choose unique existing core packs for this candidate route.',
  );
  const core = catalog.missions.filter((mission) => corePackIds.includes(mission.packId));
  const indices = new Map(core.map((mission, index) => [mission.id, index]));
  return Object.freeze({
    isCore: (id) => indices.has(id),
    next(id) {
      const index = indices.get(id);
      return index === undefined ? null : (core[index + 1] ?? null);
    },
  });
}
