import { createApexFieldCandidates } from '../game/content-design/apex-field-candidates.mjs';
import { probePressureRoute } from './lib/pressure-route-probe.mjs';

probePressureRoute({ 'home-signal': 'up' }, createApexFieldCandidates, {
  bentCuts: process.argv.includes('--bent'),
});
