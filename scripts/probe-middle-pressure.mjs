import { SIGNAL_FIRST_RETURNS } from '../game/content-design/signal-candidates.mjs';
import { NEON_FIRST_RETURNS } from '../game/content-design/neon-candidates.mjs';
import { ROVER_FIRST_RETURNS } from '../game/content-design/rover-candidates.mjs';
import { PHASE_FIRST_RETURNS } from '../game/content-design/phase-candidates.mjs';
import { SENTINEL_FIRST_RETURNS } from '../game/content-design/sentinel-candidates.mjs';
import { probePressureRoute } from './lib/pressure-route-probe.mjs';

probePressureRoute(
  {
    ...SIGNAL_FIRST_RETURNS,
    ...NEON_FIRST_RETURNS,
    ...ROVER_FIRST_RETURNS,
    ...PHASE_FIRST_RETURNS,
    ...SENTINEL_FIRST_RETURNS,
  },
  undefined,
  { bentCuts: process.argv.includes('--bent') },
);
