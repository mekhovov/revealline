import { RELAY_FIRST_RETURNS } from '../game/content-design/relay-candidates.mjs';
import { FRACTURE_FIRST_RETURNS } from '../game/content-design/fracture-candidates.mjs';
import { probePressureRoute } from './lib/pressure-route-probe.mjs';
probePressureRoute({ ...RELAY_FIRST_RETURNS, ...FRACTURE_FIRST_RETURNS });
