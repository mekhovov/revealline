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
} from './whole-spatial-candidates.mjs';
import { createWholeJourneyCandidates } from './whole-journey-candidates.mjs';

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
  });
}
