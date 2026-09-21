import { createFractureSpatialCandidates } from '../game/content-design/fracture-spatial-candidates.mjs';
import { probePressureRoute } from './lib/pressure-route-probe.mjs';
import { districtHazardSearchPolicy } from './lib/district-hazard-search.mjs';
probePressureRoute(
  { 'two-districts': 'left' },
  createFractureSpatialCandidates,
  process.argv.includes('--hazard-first') ? districtHazardSearchPolicy : {},
);
