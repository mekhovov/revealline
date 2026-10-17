import { boundedJSON, exactKeys, required } from '../../game/data-json.mjs';
import { validateFlightResponse, responseCurve, DEFAULT_RESPONSE } from './radio-profile.mjs';
import { createRateEvaluator } from './rates.mjs';
import { attitude as integerAttitude, Q, roundDiv } from './math.mjs';

export const AIRCRAFT_RESPONSE_FORMAT = 'AircraftResponse.v1';
const axes = ['roll', 'pitch', 'yaw'];
const finite = (v, low, high) => Number.isFinite(v) && v >= low && v <= high;
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));

/** Serializable data crosses the worker/replay boundary. No host closures or
 * second calibration/deadband/expo stage are attached to the controller. */
export function createAircraftResponseDescriptor(
  response = DEFAULT_RESPONSE,
  { mode = 'acro', levelGain = 4 } = {},
) {
  return validateAircraftResponseDescriptor({
    format: AIRCRAFT_RESPONSE_FORMAT,
    response,
    mode,
    levelGain,
  });
}
export function validateAircraftResponseDescriptor(source) {
  const descriptor = boundedJSON(source, {
    maxBytes: 32768,
    maxNodes: 800,
    maxArray: 64,
    maxDepth: 10,
  });
  exactKeys(descriptor, ['format', 'response', 'mode', 'levelGain'], 'Aircraft response');
  required(
    descriptor.format === AIRCRAFT_RESPONSE_FORMAT &&
      ['acro', 'self-level'].includes(descriptor.mode) &&
      finite(descriptor.levelGain, 0.1, 20),
    'Invalid aircraft response descriptor',
  );
  descriptor.response = validateFlightResponse(descriptor.response);
  return descriptor;
}
export function aircraftAttitude(source) {
  required(source && typeof source === 'object', 'Self-level assistance requires current attitude');
  if (Object.hasOwn(source, 'w')) {
    required(
      ['x', 'y', 'z', 'w'].every((axis) => finite(source[axis], -1.001, 1.001)),
      'Invalid aircraft quaternion',
    );
    const angles = integerAttitude(
      ['x', 'y', 'z', 'w'].map((axis) => Math.round(source[axis] * Q)),
    );
    return { roll: angles.roll / 100, pitch: angles.pitch / 100, yaw: angles.yaw / 100 };
  }
  required(
    ['roll', 'pitch'].every((axis) => finite(source[axis], -180, 180)),
    'Attitude must use degrees',
  );
  return source;
}
export function createAircraftResponseEvaluator(source) {
  const descriptor = validateAircraftResponseDescriptor(source),
    response = descriptor.response;
  const tuned = response.format === 'FlightResponseProfile.v2';
  const evaluator = tuned ? createRateEvaluator(response.rates) : null;
  return (controls, attitude = null) => {
    required(
      controls &&
        axes.every((axis) => finite(controls[axis], -1, 1)) &&
        finite(controls.throttle, 0, 1),
      'Calibrated normalized controls required',
    );
    const angles = descriptor.mode === 'self-level' ? aircraftAttitude(attitude) : null;
    const target = {
      throttle: tuned
        ? evaluator.throttle(controls.throttle)
        : roundDiv(Math.round(controls.throttle * 1000000), 1000) / 1000,
    };
    for (const axis of axes) {
      // Historical Legacy commands were integer thousandths and centidegrees/s.
      // Preserve the exact command curve, but not its old artificial body lag.
      const input = roundDiv(Math.round(controls[axis] * 1000000), 1000);
      const shaped = tuned ? controls[axis] : responseCurve(input, response.expo) / 1000;
      const maximum = tuned ? response.rates.axes[axis].limit : response.maxRate;
      if (angles && axis !== 'yaw') {
        const tilt = tuned
          ? shaped * response.maxTilt
          : roundDiv(responseCurve(input, response.expo) * response.maxTilt * 100, 1000) / 100;
        target[axis] = clamp((tilt - angles[axis]) * descriptor.levelGain, -maximum, maximum);
      } else
        target[axis] = tuned
          ? evaluator.rate(axis, controls[axis])
          : roundDiv(responseCurve(input, response.expo) * response.maxRate * 100, 1000) / 100;
    }
    return target;
  };
}
