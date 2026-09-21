import { createApexSpatialCandidates } from '../game/content-design/apex-spatial-candidates.mjs';
import { probePressureRoute } from './lib/pressure-route-probe.mjs';

probePressureRoute({ 'home-signal': 'up' }, createApexSpatialCandidates, {
  bentCuts: process.argv.includes('--bent'),
});
