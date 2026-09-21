import { createLivewireSpatialCandidates } from '../game/content-design/livewire-spatial-candidates.mjs';
import { probePressureRoute } from './lib/pressure-route-probe.mjs';

probePressureRoute(
  { switchyard: 'up', 'split-junction': 'down' },
  () => createLivewireSpatialCandidates({ edition: 'routing' }),
  { bentCuts: process.argv.includes('--bent') },
);
