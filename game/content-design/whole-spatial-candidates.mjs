import { freezeDesign } from './catalogs.mjs';
import {
  WHOLE_SPATIAL_SELECTIONS_JSON,
  WHOLE_SPATIAL_GREYBOX_JSON,
  WHOLE_SPATIAL_ORIGINAL_JSON,
} from './whole-spatial-data.mjs';

export const WHOLE_SPATIAL_SELECTIONS = freezeDesign(JSON.parse(WHOLE_SPATIAL_SELECTIONS_JSON));

/** Fresh authored data, not pre-approved runtime manifests. The normal shared
 * compiler still validates all presets/modes at every host or Studio boundary.
 * CI regenerates these snapshots from scripts/lib/whole-spatial-source.mjs to
 * prevent stale data; no expensive study composition runs on the browser thread. */
export function createWholeSpatialCandidates({ artwork = false } = {}) {
  return JSON.parse(artwork ? WHOLE_SPATIAL_ORIGINAL_JSON : WHOLE_SPATIAL_GREYBOX_JSON);
}
