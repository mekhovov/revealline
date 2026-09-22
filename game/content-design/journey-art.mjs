import { freezeDesign } from './catalogs.mjs';
import { HORIZON_ART_CANDIDATES } from './horizon-art.mjs';
import { BORDER_ART_CANDIDATES } from './border-art.mjs';
import { NEON_ART_CANDIDATES } from './neon-art.mjs';
import { ROVER_ART_CANDIDATES } from './rover-art.mjs';
import { FRACTURE_ART_CANDIDATES } from './fracture-art.mjs';
import { PHASE_ART_CANDIDATES } from './phase-art.mjs';
import { LIVEWIRE_ART_CANDIDATES } from './livewire-art.mjs';
import { RELAY_ART_CANDIDATES } from './relay-art.mjs';
import { CROSSWIND_ART_CANDIDATES } from './crosswind-art.mjs';
import { SENTINEL_ART_CANDIDATES } from './sentinel-art.mjs';
import { APEX_ART_CANDIDATES } from './apex-art.mjs';
import { TEAM_ART_CANDIDATES } from './team-art.mjs';
import { TEAM_TIMED_ART_CANDIDATES } from './team-timed-art.mjs';
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
  ...PHASE_ART_CANDIDATES,
  ...LIVEWIRE_ART_CANDIDATES,
  ...RELAY_ART_CANDIDATES,
  ...CROSSWIND_ART_CANDIDATES,
  ...SENTINEL_ART_CANDIDATES,
  ...APEX_ART_CANDIDATES,
  ...TEAM_ART_CANDIDATES,
  ...TEAM_TIMED_ART_CANDIDATES,
]);
