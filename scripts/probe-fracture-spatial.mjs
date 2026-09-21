import { createFractureSpatialCandidates } from '../game/content-design/fracture-spatial-candidates.mjs';
import { probePressureRoute } from './lib/pressure-route-probe.mjs';
probePressureRoute({ 'two-districts': 'left' }, createFractureSpatialCandidates);
