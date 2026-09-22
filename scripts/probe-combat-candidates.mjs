import { createCombatCandidates } from '../game/content-design/combat-candidates.mjs';
import { probePressureRoute } from './lib/pressure-route-probe.mjs';

probePressureRoute(
  {
    'workshop-sweep': 'down',
    'sentry-detour': 'left',
    'two-bay-service': 'up',
  },
  createCombatCandidates,
  { bentCuts: process.argv.includes('--bent') },
);
