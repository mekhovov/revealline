import { BORDER_FIRST_RETURNS } from '../game/content-design/border-candidates.mjs';
import { HORIZON_FIRST_RETURNS } from '../game/content-design/horizon-candidates.mjs';
import { probePressureRoute } from './lib/pressure-route-probe.mjs';

probePressureRoute({ ...HORIZON_FIRST_RETURNS, ...BORDER_FIRST_RETURNS });
