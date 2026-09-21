import { createOutpostSpatialCandidates } from '../game/content-design/outpost-spatial-candidates.mjs';
import { probePressureRoute } from './lib/pressure-route-probe.mjs';

probePressureRoute({ 'island-outpost': 'left' }, createOutpostSpatialCandidates);
