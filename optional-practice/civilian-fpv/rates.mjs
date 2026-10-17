import { boundedJSON, dataIdentity, exactKeys, required } from '../../game/data-json.mjs';

/** Portable rate settings. Radio calibration and aircraft/controller tuning are separate. */
export const RATE_PROFILE_FORMAT = 'FpvRateProfile.v1';
export const RATE_ALGORITHMS = Object.freeze([
  'actual',
  'betaflight',
  'quick',
  'kiss',
  'raceflight',
]);
export const RATE_AXES = Object.freeze(['roll', 'pitch', 'yaw']);
export const THROTTLE_MODELS = Object.freeze(['betaflight-4.5', 'betaflight-2025.12']);
export const RATE_PARAMETER_LIMITS = Object.freeze(
  Object.fromEntries(
    Object.entries({
      actual: [200, 200],
      betaflight: [255, 100],
      quick: [255, 200],
      kiss: [255, 99],
      raceflight: [200, 255],
    }).map(([name, [rcRate, rate]]) => [name, Object.freeze({ rcRate, rate, expo: 100 })]),
  ),
);
const defaults = Object.freeze({
  actual: [7, 67, 0],
  betaflight: [100, 70, 0],
  quick: [100, 67, 0],
  kiss: [100, 70, 0],
  raceflight: [70, 0, 0],
});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const f = Math.fround;

/** Values are the integer units used by Betaflight CLI, never shared slider interpretations. */
export function createRateProfile(overrides = {}) {
  const supplied = boundedJSON(overrides, { maxBytes: 8192, maxNodes: 100, maxDepth: 5 });
  const algorithm = supplied.algorithm ?? 'actual';
  required(RATE_ALGORITHMS.includes(algorithm), 'Unsupported rate algorithm');
  if (supplied.axes !== undefined) exactKeys(supplied.axes, RATE_AXES, 'rate axes');
  const [rcRate, rate, expo] = defaults[algorithm];
  return validateRateProfile({
    format: RATE_PROFILE_FORMAT,
    algorithm,
    quickRatesRcExpo: false,
    ...supplied,
    axes: Object.fromEntries(
      RATE_AXES.map((axis) => [
        axis,
        { rcRate, rate, expo, limit: 1998, ...supplied.axes?.[axis] },
      ]),
    ),
    throttle: {
      model: 'betaflight-2025.12',
      mid: 50,
      expo: 0,
      hover: 50,
      limitType: 'off',
      limitPercent: 100,
      ...supplied.throttle,
    },
  });
}

export function validateRateProfile(input) {
  const p = boundedJSON(input, { maxBytes: 8192, maxNodes: 100, maxDepth: 5 });
  exactKeys(p, ['format', 'algorithm', 'axes', 'quickRatesRcExpo', 'throttle'], 'rate profile');
  required(p.format === RATE_PROFILE_FORMAT, 'Unsupported rate profile format');
  required(RATE_ALGORITHMS.includes(p.algorithm), 'Unsupported rate algorithm');
  required(typeof p.quickRatesRcExpo === 'boolean', 'Quick expo mode must be explicit');
  exactKeys(p.axes, RATE_AXES, 'rate axes');
  const limits = RATE_PARAMETER_LIMITS[p.algorithm];
  for (const axis of RATE_AXES) {
    const a = p.axes[axis];
    exactKeys(a, ['rcRate', 'rate', 'expo', 'limit'], `${axis} rates`);
    required(
      integer(a.rcRate, 1, limits.rcRate) &&
        integer(a.rate, 0, limits.rate) &&
        integer(a.expo, 0, limits.expo) &&
        integer(a.limit, 200, 1998),
      `Invalid ${axis} rate parameters for ${p.algorithm}`,
    );
  }
  exactKeys(p.throttle, ['model', 'mid', 'expo', 'hover', 'limitType', 'limitPercent'], 'throttle');
  required(
    THROTTLE_MODELS.includes(p.throttle.model) &&
      integer(p.throttle.mid, 0, 100) &&
      integer(p.throttle.expo, 0, 100) &&
      integer(p.throttle.hover, 0, 100) &&
      ['off', 'scale', 'clip'].includes(p.throttle.limitType) &&
      integer(p.throttle.limitPercent, 25, 100),
    'Invalid throttle parameters',
  );
  return p;
}

function commandRate(profile, axis, input) {
  required(RATE_AXES.includes(axis) && Number.isFinite(input), 'Invalid rate input');
  const x = clamp(input, -1, 1);
  const absolute = Math.abs(x);
  // Explicit products avoid engine-specific exponentiation in replay calculations.
  const cubic = x * x * x;
  const absoluteCubic = absolute * absolute * absolute;
  const a = profile.axes[axis];
  const expo = a.expo / 100;
  let output;
  switch (profile.algorithm) {
    case 'actual': {
      const center = a.rcRate * 10;
      const movement = Math.max(0, a.rate * 10 - center);
      output = x * center + movement * absolute * (cubic * x * x * expo + x * (1 - expo));
      break;
    }
    case 'betaflight': {
      const rc = a.rcRate / 100;
      const sensitivity = rc > 2 ? rc + 14.54 * (rc - 2) : rc;
      const curved = x * (absoluteCubic * expo + 1 - expo);
      output = (200 * sensitivity * curved) / clamp(1 - (absolute * a.rate) / 100, 0.01, 1);
      break;
    }
    case 'kiss': {
      const curved = cubic * expo + x * (1 - expo);
      output = (2 * a.rcRate * curved) / clamp(1 - (absolute * a.rate) / 100, 0.01, 1);
      break;
    }
    case 'raceflight': {
      const curved = (1 + 0.01 * a.expo * (x * x - 1)) * x;
      output = 10 * a.rcRate * curved * (1 + absolute * a.rate * 0.01);
      break;
    }
    case 'quick': {
      const center = a.rcRate * 2;
      const maximum = Math.max(a.rate * 10, center);
      const superFactor = 1 - center / maximum;
      const curve = absoluteCubic * expo + absolute * (1 - expo);
      output = profile.quickRatesRcExpo
        ? ((cubic * expo + x * (1 - expo)) * center) / clamp(1 - absolute * superFactor, 0.01, 1)
        : (x * center) / clamp(1 - curve * superFactor, 0.01, 1);
      break;
    }
  }
  return clamp(output, -a.limit, a.limit) || 0;
}

// lrintf uses ties-to-even under the firmware's default rounding mode.
function roundEven(value) {
  const lower = Math.floor(value);
  return value - lower === 0.5 ? lower + (lower % 2) : Math.round(value);
}

function bezierY(x, x0, x2, y0, y1, y2) {
  // The x control point is the midpoint: its quadratic term is zero (within 1e-6).
  const span = f(x2 - x0);
  const t = Math.abs(span) > 1e-6 ? clamp(f(f(x - x0) / span), 0, 1) : 0;
  const u = f(1 - t);
  return f(f(f(f(u * u) * y0) + f(f(f(2 * u) * t) * y1)) + f(f(t * t) * y2));
}

function throttleLookup(throttle) {
  if (throttle.model === 'betaflight-4.5') {
    // The 12th upstream entry is never weighted for a calibrated input <=1000.
    // At mid=100 it divides by zero; generate only the 11 reachable entries.
    return Array.from({ length: 11 }, (_, i) => {
      const delta = 10 * i - throttle.mid;
      const span = delta > 0 ? 100 - throttle.mid : delta < 0 ? throttle.mid : 1;
      const cubic = Math.trunc((throttle.expo * delta * delta) / (span * span));
      return 10 * throttle.mid + Math.trunc((delta * (100 - throttle.expo + cubic)) / 10);
    });
  }
  const mid = f(throttle.mid / 100);
  const hover = f(throttle.hover / 100);
  const expo = f(throttle.expo / 100);
  const lowerControl = f(f(hover * 0.5) * f(1 + expo));
  const upperControl = f(1 + f(f(f(hover - 1) * 0.5) * f(1 + expo)));
  return Array.from({ length: 12 }, (_, i) => {
    const x = f(i / 11);
    const y =
      x <= mid
        ? bezierY(x, 0, mid, 0, lowerControl, hover)
        : bezierY(x, mid, 1, hover, upperControl, 1);
    return roundEven(f(1000 + f(1000 * y))) - 1000;
  });
}

function commandThrottle(throttle, lookup, input) {
  required(Number.isFinite(input), 'Invalid throttle input');
  const count = Math.round(clamp(input, 0, 1) * 1000);
  let output;
  if (throttle.model === 'betaflight-4.5') {
    const index = Math.trunc(count / 100);
    output =
      index === 10
        ? lookup[10]
        : lookup[index] + Math.trunc(((count % 100) * (lookup[index + 1] - lookup[index])) / 100);
  } else {
    const scaled = count * 11;
    const index = Math.trunc(scaled / 1000);
    output =
      index === 11
        ? lookup[11]
        : lookup[index] +
          Math.trunc(((scaled % 1000) * (lookup[index + 1] - lookup[index])) / 1000);
  }
  output /= 1000;
  if (throttle.limitType === 'scale') output *= throttle.limitPercent / 100;
  if (throttle.limitType === 'clip') output = Math.min(output, throttle.limitPercent / 100);
  return clamp(output, 0, 1);
}

/** Validate and freeze one attempt's values, compiling the firmware throttle table once. */
export function createRateEvaluator(input) {
  const profile = validateRateProfile(input);
  const lookup = throttleLookup(profile.throttle);
  for (const axis of RATE_AXES) Object.freeze(profile.axes[axis]);
  Object.freeze(profile.axes);
  Object.freeze(profile.throttle);
  Object.freeze(profile);
  return Object.freeze({
    profile,
    rate: (axis, value) => commandRate(profile, axis, value),
    throttle: (value) => commandThrottle(profile.throttle, lookup, value),
  });
}

/** Input has already been calibrated; these functions deliberately add no deadband or device expo. */
export function evaluateRate(profile, axis, input) {
  return commandRate(validateRateProfile(profile), axis, input);
}
export function evaluateThrottle(profile, input) {
  return createRateEvaluator(profile).throttle(input);
}
export function rateProfileIdentity(profile) {
  return dataIdentity(validateRateProfile(profile));
}

/** Display scales keep CLI storage lossless while giving each algorithm its native editor units. */
export function rateAxisDisplayValues(profile, axis) {
  const p = validateRateProfile(profile);
  required(RATE_AXES.includes(axis), 'Invalid rate axis');
  const a = p.axes[axis];
  const scale = {
    actual: [10, 10, 1],
    betaflight: [0.01, 0.01, 0.01],
    quick: [0.01, 10, 0.01],
    kiss: [0.01, 0.01, 0.01],
    raceflight: [10, 1, 1],
  }[p.algorithm];
  return {
    rcRate: a.rcRate * scale[0],
    rate: a.rate * scale[1],
    expo: a.expo * scale[2],
    limit: a.limit,
  };
}
