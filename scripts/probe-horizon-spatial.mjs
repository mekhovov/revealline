import { createHorizonSpatialCandidates } from '../game/content-design/horizon-spatial-candidates.mjs';
import { probePressureRoute } from './lib/pressure-route-probe.mjs';

probePressureRoute({ 'courtyard-return': 'left' }, createHorizonSpatialCandidates);
