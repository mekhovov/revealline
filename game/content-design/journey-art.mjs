import { freezeDesign } from './catalogs.mjs';
import { HORIZON_ART_CANDIDATES } from './horizon-art.mjs';
import { BORDER_ART_CANDIDATES } from './border-art.mjs';

// The compiler and packaging consume the same immutable originals. Optional
// offline exclusion does not remove these bytes from loose files or the ZIP.
export const JOURNEY_ART_CANDIDATES = freezeDesign([
  ...HORIZON_ART_CANDIDATES,
  ...BORDER_ART_CANDIDATES,
]);
