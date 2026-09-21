import { createPhaseSpatialCandidates } from '../game/content-design/phase-spatial-candidates.mjs';
import { probePressureRoute } from './lib/pressure-route-probe.mjs';

probePressureRoute({ 'return-in-reserve': 'up' }, createPhaseSpatialCandidates, {
  bentCuts: process.argv.includes('--bent'),
});
