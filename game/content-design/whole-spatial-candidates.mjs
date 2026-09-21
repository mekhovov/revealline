import { freezeDesign } from './catalogs.mjs';
import {
  WHOLE_SPATIAL_SELECTIONS_JSON,
  WHOLE_SPATIAL_GREYBOX_JSON,
  WHOLE_SPATIAL_ORIGINAL_JSON,
  WHOLE_SPATIAL_FIELD_FINALE_JSON,
} from './whole-spatial-data.mjs';

export const WHOLE_SPATIAL_SELECTIONS = freezeDesign(JSON.parse(WHOLE_SPATIAL_SELECTIONS_JSON));

/** Fresh authored data, not pre-approved runtime manifests. The normal shared
 * compiler still validates all presets/modes at every host or Studio boundary.
 * CI regenerates these snapshots from scripts/lib/whole-spatial-source.mjs to
 * prevent stale data; no expensive study composition runs on the browser thread. */
export function createWholeSpatialCandidates({ artwork = false } = {}) {
  return JSON.parse(artwork ? WHOLE_SPATIAL_ORIGINAL_JSON : WHOLE_SPATIAL_GREYBOX_JSON);
}

/** Explicit successor. Keep the v1 factory, old boss and old progress immutable.
 * Parse only authored data here; hosts and Studio still use the shared compiler. */
export function createWholeFieldCandidates({ artwork = false } = {}) {
  const source = createWholeSpatialCandidates({ artwork });
  const { mission, map } = JSON.parse(WHOLE_SPATIAL_FIELD_FINALE_JSON);
  const index = source.missions.findIndex((item) => item.id === 'home-signal');
  const prior = source.missions[index];
  source.missions[index] = { ...mission, presentation: prior.presentation };
  const sameMap = (a, b) => a.id === b.id && a.revision === b.revision;
  source.maps = source.maps.filter(
    (item) =>
      !sameMap(item, prior.map) || source.missions.some((other) => sameMap(other.map, item)),
  );
  source.maps.push(map);
  source.id = artwork ? 'whole-field-original-review' : 'whole-field-greybox-review';
  source.revision = 'field-finale-review-1';
  source.name = 'Whole Journey · unvalidated field-finale review';
  for (const item of [...source.campaigns, ...source.packs]) item.revision = source.revision;
  return source;
}
