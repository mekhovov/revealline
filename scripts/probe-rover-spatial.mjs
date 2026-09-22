import { createRoverSpatialCandidates } from '../game/content-design/rover-spatial-candidates.mjs';
import { probePressureRoute } from './lib/pressure-route-probe.mjs';

probePressureRoute({ 'sorting-yard': 'up' }, createRoverSpatialCandidates, {
  bentCuts: process.argv.includes('--bent'),
});
