import { required, stableId } from '../data-json.mjs';
import { freezeDesign } from './catalogs.mjs';
import { createOpeningCandidates } from './horizon-candidates.mjs';
import { createBorderCandidates } from './border-candidates.mjs';
import { isAuthoredJourneyRouteId } from './mode-href.mjs';
import {
  createWholeSpatialCandidates,
  createWholeFieldCandidates,
  createWholeTimedCandidates,
  createWholeVarietyCandidates,
} from './whole-spatial-candidates.mjs';
import {
  createWholeJourneyCandidates,
  WHOLE_JOURNEY_CORE_PACK_IDS,
} from './whole-journey-candidates.mjs';

/** Explicit staged library. Appending a campaign never rewrites existing mission,
 * pack or execution identities, and optional Remixes never interrupt core play.
 * The frozen opening URL retains its previous library and suspended-flight slot. */
export function createAuthoredJourneyRoute(id) {
  if (!isAuthoredJourneyRouteId(id)) return null;
  if (id === 'whole-spatial-v4')
    return freezeDesign({
      id,
      label: 'Whole Journey ornament and workshop review · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v4',
      profileKey: 'journey-whole-spatial-v4',
      source: createWholeVarietyCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v3')
    return freezeDesign({
      id,
      label: 'Whole Journey timed-bonus review · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v3',
      profileKey: 'journey-whole-spatial-v3',
      source: createWholeTimedCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
    });
  if (id === 'whole-spatial-v2')
    return freezeDesign({
      id,
      label: 'Whole Journey field-finale review · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v2',
      profileKey: 'journey-whole-spatial-v2',
      source: createWholeFieldCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
    });
  if (id === 'whole-spatial-v1')
    return freezeDesign({
      id,
      label: 'Whole Journey spatial and pressure review',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v1',
      profileKey: 'journey-whole-spatial-v1',
      source: createWholeSpatialCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
    });
  // A separate explicit review URL and suspended-flight slot. Never expand the
  // historical routes or infer publication/qualification from having artwork.
  if (
    ['whole-originals', 'whole-originals-v2', 'whole-originals-v3', 'whole-originals-v4'].includes(
      id,
    )
  )
    return freezeDesign({
      id,
      label:
        id === 'whole-originals-v4'
          ? 'Whole Journey actor material review'
          : id === 'whole-originals-v3'
            ? 'Whole Journey campaign presentation review'
            : id === 'whole-originals-v2'
              ? 'Whole Journey first-capture teaching review'
              : 'Whole Journey original-picture review',
      sessionKey: `revealline.suspended.journey-whole-originals.${id === 'whole-originals' ? 'v1' : id.slice(-2)}`,
      source: createWholeJourneyCandidates({
        artwork: true,
        roverTeaching: id !== 'whole-originals',
        campaignPresentation: ['whole-originals-v3', 'whole-originals-v4'].includes(id),
        campaignActors: id === 'whole-originals-v4',
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
export function createCandidateSequence(catalog, corePackIds, optionalCampaignIds = []) {
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
  required(
    Array.isArray(optionalCampaignIds) &&
      optionalCampaignIds.every(stableId) &&
      new Set(optionalCampaignIds).size === optionalCampaignIds.length &&
      optionalCampaignIds.every((id) => {
        const missions = catalog.missions.filter((mission) => mission.campaignId === id);
        return missions.length > 0 && missions.every((mission) => !indices.has(mission.id));
      }),
    'Choose unique existing optional campaigns outside the core route.',
  );
  const optionalNext = new Map();
  for (const id of optionalCampaignIds) {
    const owners = new Map();
    for (const mission of catalog.missions.filter((item) => item.campaignId === id)) {
      const owner = JSON.stringify([mission.source, mission.packId, mission.campaignId]);
      if (!owners.has(owner)) owners.set(owner, []);
      owners.get(owner).push(mission);
    }
    for (const missions of owners.values())
      missions.forEach((mission, index) =>
        optionalNext.set(mission.id, missions[index + 1] ?? null),
      );
  }
  return Object.freeze({
    isCore: (id) => indices.has(id),
    isOptionalSequence: (id) => optionalNext.has(id),
    next(id) {
      const index = indices.get(id);
      return index === undefined ? (optionalNext.get(id) ?? null) : (core[index + 1] ?? null);
    },
  });
}
