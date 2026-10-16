import { boundedJSON, dataIdentity, exactKeys, required } from '../../game/data-json.mjs';
import { createRateProfile, validateRateProfile, rateProfileIdentity } from './rates.mjs';

export const TUNED_RESPONSE_FORMAT = 'FlightResponseProfile.v2';
export function createTunedResponse(rates = createRateProfile(), options = {}) {
  return validateTunedResponse({
    format: TUNED_RESPONSE_FORMAT,
    rates,
    maxTilt: options.maxTilt ?? 30,
    responseTicks: options.responseTicks ?? 8,
  });
}
export function validateTunedResponse(input) {
  const value = boundedJSON(input, { maxBytes: 16384, maxNodes: 600, maxArray: 64, maxDepth: 8 });
  exactKeys(value, ['format', 'rates', 'maxTilt', 'responseTicks'], 'tuned flight response');
  required(value.format === TUNED_RESPONSE_FORMAT, 'Unsupported tuned flight response');
  required(
    Number.isInteger(value.maxTilt) && value.maxTilt >= 5 && value.maxTilt <= 60,
    'Self-level tilt must be 5–60 degrees',
  );
  required(
    Number.isInteger(value.responseTicks) && value.responseTicks >= 1 && value.responseTicks <= 30,
    'Legacy airframe response must be 1–30 ticks',
  );
  return { ...value, rates: validateRateProfile(value.rates) };
}
export function tunedResponseIdentity(input) {
  const value = validateTunedResponse(input);
  return dataIdentity({ ...value, rates: rateProfileIdentity(value.rates) });
}
/** Personal rotation curves do not change the aircraft's performance class. */
export function responseComparisonIdentity(input) {
  const value = validateTunedResponse(input);
  return dataIdentity({
    format: value.format,
    maxTilt: value.maxTilt,
    responseTicks: value.responseTicks,
    throttle: value.rates.throttle,
  });
}
