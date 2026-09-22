import { CROSSWIND_FIRST_RETURNS } from '../game/content-design/crosswind-candidates.mjs';
import { APEX_FIRST_RETURNS } from '../game/content-design/apex-candidates.mjs';
import { probePressureRoute } from './lib/pressure-route-probe.mjs';
probePressureRoute({ ...CROSSWIND_FIRST_RETURNS, ...APEX_FIRST_RETURNS });
