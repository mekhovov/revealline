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
    createHuntTrainingCandidates,
    createSnakeHuntCandidates,
    createBorderCandidates,
    createWholeJourneyCandidates,
    createWholeSpatialCandidates,
    createWholeFieldCandidates,
    createWholeTimedCandidates,
    createWholeVarietyCandidates,
    createWholeSortingCandidates,
    createWholeImpactCandidates,
    createWholePressureCandidates,
    createWholeCulturalPressureCandidates,
    createWholeErosionReviewCandidates,
    createSpatialNextBatchCandidates,
    createHorizonNextBatchCandidates,
    createBorderCulturalNextBatchCandidates,
    createBorderSignalCulturalNextBatchCandidates,
    createEarlyCulturalRoutesCandidates,
    createSignalCulturalRoutesCandidates,
    createNeonCulturalRoutesCandidates,
    createNeonCulturalRoutesFinaleCandidates,
    createRoverCulturalRoutesCandidates,
    createFractureCulturalRoutesCandidates,
    createPhaseworksCulturalRoutesCandidates,
    createLivewireCulturalRoutesCandidates,
    createRelayCulturalRoutesCandidates,
    createCrosswindCulturalRoutesCandidates,
    createSentinelCulturalRoutesCandidates,
    createApexCulturalRoutesCandidates,
    createRelayCulturalCompletionCandidates,
    createCrosswindCulturalCompletionCandidates,
    createFractureApexCulturalCompletionCandidates,
    createNeonCulturalCompletionCandidates,
    createRoverCulturalCompletionCandidates,
    createBorderCulturalCompletionCandidates,
    createBorderFrontierPocketCandidates,
    createCulturalTimedBonusPressureCandidates,
    createCulturalPressureTriptychCandidates,
    createCurrentRemixPressureCandidates,
    createContestedWallTriptychCandidates,
    createPressureCorridorTriptychCandidates,
    createCoolingLoopErosionCandidates,
    createUkrainianOrnamentJourney,
    createUkrainianOrnamentAtlasJourney,
  },
) {
  if (!isAuthoredJourneyRouteId(id)) return null;
  if (id === 'snake-hunt-v1')
    return freezeDesign({
      id,
      label: 'Snake Hunt · eight chapters',
      sessionKey: 'revealline.suspended.journey-snake-hunt.v1',
      profileKey: 'journey-snake-hunt-v1',
      source: createSnakeHuntCandidates({ artwork: true }),
      corePackIds: ['journey-snake-hunt'],
      optionalCampaignIds: [],
      preserveOriginalThemes: true,
    });
  if (id === 'humanoid-hunt-v1')
    return freezeDesign({
      id,
      label: 'Hunt lessons · six familiar boards',
      sessionKey: 'revealline.suspended.journey-humanoid-hunt.v1',
      profileKey: 'journey-humanoid-hunt-v1',
      source: createHuntTrainingCandidates({ artwork: true }),
      corePackIds: ['journey-humanoid-hunt'],
      optionalCampaignIds: [],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v38')
    return freezeDesign({
      id,
      label: 'Whole Journey Cooling loop earned-return pressure · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v38',
      profileKey: 'journey-whole-spatial-v38',
      source: createCoolingLoopErosionCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v37')
    return freezeDesign({
      id,
      label: 'Whole Journey Ukrainian pressure corridor triptych · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v37',
      profileKey: 'journey-whole-spatial-v37',
      source: createPressureCorridorTriptychCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v36')
    return freezeDesign({
      id,
      label: 'Whole Journey contested Ukrainian wall triptych · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v36',
      profileKey: 'journey-whole-spatial-v36',
      source: createContestedWallTriptychCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v35')
    return freezeDesign({
      id,
      label: 'Whole Journey finite Remix pressure pair · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v35',
      profileKey: 'journey-whole-spatial-v35',
      source: createCurrentRemixPressureCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v34')
    return freezeDesign({
      id,
      label: 'Whole Journey Ukrainian cultural pressure triptych · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v34',
      profileKey: 'journey-whole-spatial-v34',
      source: createCulturalPressureTriptychCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v33')
    return freezeDesign({
      id,
      label: 'Whole Journey Cultural timed opportunity pressure · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v33',
      profileKey: 'journey-whole-spatial-v33',
      source: createCulturalTimedBonusPressureCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v32')
    return freezeDesign({
      id,
      label: 'Whole Journey Border frontier and pocket completion · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v32',
      profileKey: 'journey-whole-spatial-v32',
      source: createBorderFrontierPocketCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v31')
    return freezeDesign({
      id,
      label: 'Whole Journey Border Ukrainian cultural completion · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v31',
      profileKey: 'journey-whole-spatial-v31',
      source: createBorderCulturalCompletionCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v30')
    return freezeDesign({
      id,
      label: 'Whole Journey Rover Ukrainian and FPV spatial completion · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v30',
      profileKey: 'journey-whole-spatial-v30',
      source: createRoverCulturalCompletionCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v29')
    return freezeDesign({
      id,
      label: 'Whole Journey Neon Ukrainian cultural completion · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v29',
      profileKey: 'journey-whole-spatial-v29',
      source: createNeonCulturalCompletionCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v28')
    return freezeDesign({
      id,
      label: 'Whole Journey Fracture and Apex Ukrainian cultural completion · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v28',
      profileKey: 'journey-whole-spatial-v28',
      source: createFractureApexCulturalCompletionCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v27')
    return freezeDesign({
      id,
      label: 'Whole Journey Crosswind Ukrainian cultural completion · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v27',
      profileKey: 'journey-whole-spatial-v27',
      source: createCrosswindCulturalCompletionCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v26')
    return freezeDesign({
      id,
      label: 'Whole Journey Relay Ukrainian cultural completion · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v26',
      profileKey: 'journey-whole-spatial-v26',
      source: createRelayCulturalCompletionCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v25')
    return freezeDesign({
      id,
      label: 'Whole Journey Apex Ukrainian cultural routes · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v25',
      profileKey: 'journey-whole-spatial-v25',
      source: createApexCulturalRoutesCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v24')
    return freezeDesign({
      id,
      label: 'Whole Journey Sentinel Ukrainian cultural routes · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v24',
      profileKey: 'journey-whole-spatial-v24',
      source: createSentinelCulturalRoutesCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v23')
    return freezeDesign({
      id,
      label: 'Whole Journey Crosswind Ukrainian cultural routes · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v23',
      profileKey: 'journey-whole-spatial-v23',
      source: createCrosswindCulturalRoutesCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v22')
    return freezeDesign({
      id,
      label: 'Whole Journey Relay Ukrainian cultural routes · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v22',
      profileKey: 'journey-whole-spatial-v22',
      source: createRelayCulturalRoutesCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v21')
    return freezeDesign({
      id,
      label: 'Whole Journey Livewire Ukrainian cultural routes · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v21',
      profileKey: 'journey-whole-spatial-v21',
      source: createLivewireCulturalRoutesCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v20')
    return freezeDesign({
      id,
      label: 'Whole Journey Phaseworks Ukrainian cultural routes · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v20',
      profileKey: 'journey-whole-spatial-v20',
      source: createPhaseworksCulturalRoutesCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v19')
    return freezeDesign({
      id,
      label: 'Whole Journey Fractured Grid Ukrainian cultural routes · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v19',
      profileKey: 'journey-whole-spatial-v19',
      source: createFractureCulturalRoutesCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v18')
    return freezeDesign({
      id,
      label: 'Whole Journey Rover Ukrainian cultural routes · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v18',
      profileKey: 'journey-whole-spatial-v18',
      source: createRoverCulturalRoutesCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v17')
    return freezeDesign({
      id,
      label: 'Whole Journey Neon Ukrainian cultural routes finale · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v17',
      profileKey: 'journey-whole-spatial-v17',
      source: createNeonCulturalRoutesFinaleCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v16')
    return freezeDesign({
      id,
      label: 'Whole Journey Neon Ukrainian cultural routes · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v16',
      profileKey: 'journey-whole-spatial-v16',
      source: createNeonCulturalRoutesCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v15')
    return freezeDesign({
      id,
      label: 'Whole Journey Signal Ukrainian cultural routes · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v15',
      profileKey: 'journey-whole-spatial-v15',
      source: createSignalCulturalRoutesCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v14')
    return freezeDesign({
      id,
      label: 'Whole Journey early Ukrainian cultural routes · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v14',
      profileKey: 'journey-whole-spatial-v14',
      source: createEarlyCulturalRoutesCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v13')
    return freezeDesign({
      id,
      label: 'Whole Journey Border and Signal cultural routes · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v13',
      profileKey: 'journey-whole-spatial-v13',
      source: createBorderSignalCulturalNextBatchCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v12')
    return freezeDesign({
      id,
      label: 'Whole Journey Border cultural routes · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v12',
      profileKey: 'journey-whole-spatial-v12',
      source: createBorderCulturalNextBatchCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-ornament-v2')
    return freezeDesign({
      id,
      label: 'Ukrainian ornament atlas · twelve studies · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-ornament.v2',
      profileKey: 'journey-whole-ornament-v2',
      source: createUkrainianOrnamentAtlasJourney({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-ornament-v1')
    return freezeDesign({
      id,
      label: 'Ukrainian ornament spatial review · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-ornament.v1',
      profileKey: 'journey-whole-ornament-v1',
      source: createUkrainianOrnamentJourney({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v11')
    return freezeDesign({
      id,
      label: 'Whole Journey Horizon cultural joins · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v11',
      profileKey: 'journey-whole-spatial-v11',
      source: createHorizonNextBatchCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v10')
    return freezeDesign({
      id,
      label: 'Whole Journey Ukrainian cultural spatial triptych · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v10',
      profileKey: 'journey-whole-spatial-v10',
      source: createSpatialNextBatchCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v9')
    return freezeDesign({
      id,
      label: 'Whole Journey erosion repair and escape review · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v9',
      profileKey: 'journey-whole-spatial-v9',
      source: createWholeErosionReviewCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v8')
    return freezeDesign({
      id,
      label: 'Whole Journey Ukrainian and FPV readable pressure review · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v8',
      profileKey: 'journey-whole-spatial-v8',
      source: createWholeCulturalPressureCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v7')
    return freezeDesign({
      id,
      label: 'Whole Journey readable pursuit and interception review · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v7',
      profileKey: 'journey-whole-spatial-v7',
      source: createWholePressureCandidates({ artwork: true }),
      corePackIds: [...WHOLE_JOURNEY_CORE_PACK_IDS],
      optionalCampaignIds: ['ornament-crossings', 'workshop-routing'],
      preserveOriginalThemes: true,
    });
  if (id === 'whole-spatial-v6')
    return freezeDesign({
      id,
      label: 'Whole Journey travelling trail-impact review · balance pending',
      sessionKey: 'revealline.suspended.journey-whole-spatial.v6',
      profileKey: 'journey-whole-spatial-v6',
      source: createWholeImpactCandidates({ artwork: true }),
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
