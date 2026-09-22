import { createLivewireSpatialCandidates } from '../game/content-design/livewire-spatial-candidates.mjs';
import { probePressureRoute } from './lib/pressure-route-probe.mjs';

probePressureRoute({ 'cross-the-afterglow': 'left' }, createLivewireSpatialCandidates, {
  bentCuts: process.argv.includes('--bent'),
});
