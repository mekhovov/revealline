import { createOpeningCandidates } from './horizon-candidates.mjs';
import { createBorderCandidates } from './border-candidates.mjs';
import {
  createWholeSpatialCandidates,
  createWholeFieldCandidates,
  createWholeTimedCandidates,
  createWholeVarietyCandidates,
  createWholeSortingCandidates,
  createWholeImpactCandidates,
  createWholePressureCandidates,
  createWholeCulturalPressureCandidates,
  createWholeErosionReviewCandidates,
} from './whole-spatial-candidates.mjs';
import { createWholeJourneyCandidates } from './whole-journey-candidates.mjs';
import { createSpatialNextBatchCandidates } from './spatial-next-batch-candidates.mjs';
import { createHorizonNextBatchCandidates } from './horizon-next-batch-candidates.mjs';
import { createBorderCulturalNextBatchCandidates } from './border-cultural-next-batch-candidates.mjs';
import { createBorderSignalCulturalNextBatchCandidates } from './border-signal-cultural-next-batch-candidates.mjs';
import { createEarlyCulturalRoutesCandidates } from './early-cultural-routes-candidates.mjs';
import { createSignalCulturalRoutesCandidates } from './signal-cultural-routes-candidates.mjs';
import { createNeonCulturalRoutesCandidates } from './neon-cultural-routes-candidates.mjs';
import { createNeonCulturalRoutesFinaleCandidates } from './neon-cultural-routes-finale-candidates.mjs';
import { createRoverCulturalRoutesCandidates } from './rover-cultural-routes-candidates.mjs';
import { createFractureCulturalRoutesCandidates } from './fracture-cultural-routes-candidates.mjs';
import { createPhaseworksCulturalRoutesCandidates } from './phaseworks-cultural-routes-candidates.mjs';
import { createLivewireCulturalRoutesCandidates } from './livewire-cultural-routes-candidates.mjs';
import { createRelayCulturalRoutesCandidates } from './relay-cultural-routes-candidates.mjs';
import { createCrosswindCulturalRoutesCandidates } from './crosswind-cultural-routes-candidates.mjs';
import { createSentinelCulturalRoutesCandidates } from './sentinel-cultural-routes-candidates.mjs';
import { createApexCulturalRoutesCandidates } from './apex-cultural-routes-candidates.mjs';
import { createRelayCulturalCompletionCandidates } from './relay-cultural-completion-candidates.mjs';
import { createCrosswindCulturalCompletionCandidates } from './crosswind-cultural-completion-candidates.mjs';
import { createFractureApexCulturalCompletionCandidates } from './fracture-apex-cultural-completion-candidates.mjs';
import { createNeonCulturalCompletionCandidates } from './neon-cultural-completion-candidates.mjs';
import { createUkrainianOrnamentJourney } from './ukrainian-ornament-candidates.mjs';
import { createUkrainianOrnamentAtlasJourney } from './ukrainian-ornament-atlas.mjs';

import { createAuthoredJourneyRouteDefinition } from './route-definition.mjs';
export { createCandidateSequence } from './sequence.mjs';

// Synchronous compatibility entry for authoring/CLI. Browser hosts use the
// selective async loader; both share the exact same route definition.
export function createAuthoredJourneyRoute(id) {
  return createAuthoredJourneyRouteDefinition(id, {
    createOpeningCandidates,
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
    createUkrainianOrnamentJourney,
    createUkrainianOrnamentAtlasJourney,
  });
}
