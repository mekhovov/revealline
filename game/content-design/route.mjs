import { required, stableId } from '../data-json.mjs';
import { freezeDesign } from './catalogs.mjs';
import { createOpeningCandidates } from './horizon-candidates.mjs';
import { createBorderCandidates } from './border-candidates.mjs';
import { createCombatCandidates } from './combat-candidates.mjs';
import { ROVER_ART_CANDIDATES } from './rover-art.mjs';

/** Explicit staged library. Appending a campaign never rewrites existing mission,
 * pack or execution identities, and optional Remixes never interrupt core play.
 * The frozen opening URL retains its previous library and suspended-flight slot. */
export function createAuthoredJourneyRoute(id) {
  if (id === 'combat-study') {
    const source = createCombatCandidates();
    // Explicitly reused test scenery, not final bespoke mission artwork. These
    // remain normal immutable assets: both hosts verify the exact bytes.
    source.revision = 'combat-live-study-1';
    source.name = 'Optional robots · test route with reused Rover scenery';
    source.assets = [0, 3, 4].map((index) => structuredClone(ROVER_ART_CANDIDATES[index]));
    source.missions.forEach((mission, index) => {
      mission.presentation.backgroundAssetId = source.assets[index].id;
    });
    return freezeDesign({
      id,
      label: 'Optional robots · unqualified test route · reused Rover scenery',
      sessionKey: 'revealline.suspended.journey-combat-study.v1',
      source,
      corePackIds: ['optional-robots'],
    });
  }
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
