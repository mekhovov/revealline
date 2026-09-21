import { freezeDesign } from './catalogs.mjs';
import { HORIZON_ART_CANDIDATES } from './horizon-art.mjs';
import { BORDER_ART_CANDIDATES } from './border-art.mjs';
import { NEON_ART_CANDIDATES } from './neon-art.mjs';
import { ROVER_ART_CANDIDATES } from './rover-art.mjs';
import { FRACTURE_ART_CANDIDATES } from './fracture-art.mjs';
import {
  SIGNAL_ILLUSTRATED_ART_CANDIDATES,
  SIGNAL_PIXEL_ART_CANDIDATES,
  SIGNAL_TEAM_ART_CANDIDATES,
} from './signal-art.mjs';

// The compiler and packaging consume the same immutable originals. Optional
// offline exclusion does not remove these bytes from loose files or the ZIP.
export const JOURNEY_ART_CANDIDATES = freezeDesign([
  ...HORIZON_ART_CANDIDATES,
  ...BORDER_ART_CANDIDATES,
  ...SIGNAL_ILLUSTRATED_ART_CANDIDATES,
  ...SIGNAL_PIXEL_ART_CANDIDATES,
  ...SIGNAL_TEAM_ART_CANDIDATES,
  ...NEON_ART_CANDIDATES,
  ...ROVER_ART_CANDIDATES,
  ...FRACTURE_ART_CANDIDATES,
]);
