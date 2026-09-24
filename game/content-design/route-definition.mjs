import { freezeDesign } from './catalogs.mjs';
import { isAuthoredJourneyRouteId } from './mode-href.mjs';
import { WHOLE_JOURNEY_CORE_PACK_IDS } from './whole-journey-order.mjs';

/** Explicit staged library. Appending a campaign never rewrites existing mission,
 * pack or execution identities, and optional Remixes never interrupt core play.
 * The frozen opening URL retains its previous library and suspended-flight slot. */
export function createAuthoredJourneyRouteDefinition(
  id,
  {
    createOpeningCandidates,
    createBorderCandidates,
    createWholeJourneyCandidates,
    createWholeSpatialCandidates,
    createWholeFieldCandidates,
    createWholeTimedCandidates,
    createWholeVarietyCandidates,
    createWholeSortingCandidates,
    createSpatialChallengeJourney,
  },
) {
  if (!isAuthoredJourneyRouteId(id)) return null;
  if (id === 'whole-spatial-v6')
    return freezeDesign({
      id,
      label: 'Whole Journey spatial challenge review · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v6',
      profileKey: 'journey-whole-spatial-v6',
      source: createSpatialChallengeJourney({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v5')
    return freezeDesign({
      id,
      label: 'Whole Journey contested sorting lanes review · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v5',
      profileKey: 'journey-whole-spatial-v5',
      source: createWholeSortingCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
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
