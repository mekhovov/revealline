import { freezeDesign } from './catalogs.mjs';
import { createCulturalPressureTriptychCandidates } from './cultural-pressure-triptych-candidates.mjs';
import {
  applyRemixPressurePairCandidates,
  REMIX_PRESSURE_PAIR_DISPOSITIONS,
} from './remix-pressure-pair-candidates.mjs';

export const CURRENT_REMIX_PRESSURE_REVISION = 'current-remix-pressure-pair-1';
export const CURRENT_REMIX_PRESSURE_IDS = freezeDesign(
  REMIX_PRESSURE_PAIR_DISPOSITIONS.map((item) => item.missionId),
);

/** Register the reviewed finite pressure pair on the current cultural route.
 * Geometry and every unrelated mission remain exact from v34. */
export function createCurrentRemixPressureCandidates({ artwork = false } = {}) {
  const source = applyRemixPressurePairCandidates(
    createCulturalPressureTriptychCandidates({ artwork }),
    { missionRevision: CURRENT_REMIX_PRESSURE_REVISION },
  );
  source.id = artwork
    ? 'whole-current-remix-pressure-original-review'
    : 'whole-current-remix-pressure-greybox-review';
  source.name = 'Whole Journey · current finite Remix pressure pair';
  source.revision = CURRENT_REMIX_PRESSURE_REVISION;
  return structuredClone(source);
}
