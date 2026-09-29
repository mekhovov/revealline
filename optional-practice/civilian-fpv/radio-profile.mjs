import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
  stableId,
} from '../../game/data-json.mjs';

export const RADIO_FORMAT = 'RadioProfile.v1';
export const AXIS_RADIO_FORMAT = 'RadioProfile.v2';
export const RESPONSE_FORMAT = 'FlightResponseProfile.v1';
export const FLIGHT_CONTROLS = Object.freeze(['roll', 'pitch', 'yaw', 'throttle']);
export const STICK_LAYOUTS = Object.freeze({
  1: ['yaw', 'pitch', 'roll', 'throttle'],
  2: ['yaw', 'throttle', 'roll', 'pitch'],
  3: ['roll', 'pitch', 'yaw', 'throttle'],
  4: ['roll', 'throttle', 'yaw', 'pitch'],
});
export const neutralFlightInput = () => ({ roll: 0, pitch: 0, yaw: 0, throttle: 0 });
const int = (n, a, b) => Number.isSafeInteger(n) && n >= a && n <= b;
const finite = (n, a, b) => Number.isFinite(n) && n >= a && n <= b;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const plain = (input) =>
  boundedJSON(input, { maxBytes: 16384, maxNodes: 600, maxArray: 64, maxDepth: 7 });

/** Counts and mapping are part of the identity. A reused browser slot is not identity. */
export function radioDeviceIdentity(pad) {
  required(
    pad &&
      typeof pad.id === 'string' &&
      pad.id.length <= 512 &&
      int(pad.axes?.length, 1, 64) &&
      int(pad.buttons?.length, 0, 256),
    'Unsupported joystick channel counts',
  );
  return {
    id: pad.id,
    mapping: pad.mapping === 'standard' ? 'standard' : '',
    axes: pad.axes.length,
    buttons: pad.buttons.length,
  };
}
export const radioDeviceKey = (pad) => canonicalJSON(radioDeviceIdentity(pad));
export function validateRadioProfile(input) {
  const p = plain(input);
  exactKeys(
    p,
    [
      'format',
      'id',
      'name',
      'device',
      'stickMode',
      'throttleStyle',
      'channels',
      'switches',
      'verified',
    ],
    'radio profile',
  );
  required(
    [RADIO_FORMAT, AXIS_RADIO_FORMAT].includes(p.format) &&
      stableId(p.id) &&
      typeof p.name === 'string' &&
      p.name.trim().length > 0 &&
      p.name.length <= 120,
    'Invalid radio profile',
  );
  exactKeys(p.device, ['id', 'mapping', 'axes', 'buttons'], 'radio device');
  required(
    typeof p.device.id === 'string' &&
      p.device.id.length <= 512 &&
      ['', 'standard'].includes(p.device.mapping) &&
      int(p.device.axes, 4, 64) &&
      int(p.device.buttons, 0, 256),
    'Invalid radio device',
  );
  required(
    int(p.stickMode, 1, 4) &&
      ['full-travel', 'spring-centred'].includes(p.throttleStyle) &&
      typeof p.verified === 'boolean',
    'Invalid stick layout or throttle style',
  );
  exactKeys(p.channels, FLIGHT_CONTROLS, 'radio channels');
  const used = new Set();
  for (const control of FLIGHT_CONTROLS) {
    const c = p.channels[control];
    exactKeys(c, ['axis', 'min', 'center', 'max', 'invert', 'deadZone'], control);
    required(
      int(c.axis, 0, p.device.axes - 1) && !used.has(c.axis),
      'Each flight control needs a distinct axis',
    );
    used.add(c.axis);
    required(
      finite(c.min, -1, 1) &&
        finite(c.max, -1, 1) &&
        c.max - c.min >= 0.5 &&
        typeof c.invert === 'boolean' &&
        finite(c.deadZone, 0, 0.2),
      'Incomplete endpoint calibration',
    );
    if (control === 'throttle' && p.throttleStyle === 'full-travel')
      required(
        c.center === null && c.deadZone === 0,
        'Full-travel throttle has no centre or dead zone',
      );
    else
      required(
        finite(c.center, c.min + 0.1, c.max - 0.1),
        'Centred controls need a measured centre',
      );
  }
  exactKeys(p.switches, ['arm', 'pause', 'reset'], 'radio switches');
  const buttons = new Set();
  for (const action of ['arm', 'pause', 'reset']) {
    const s = p.switches[action];
    if (s === null) continue;
    if (p.format === AXIS_RADIO_FORMAT && Object.hasOwn(s, 'axis')) {
      exactKeys(s, ['axis', 'off', 'on'], action);
      required(
        int(s.axis, 0, p.device.axes - 1) &&
          !used.has(s.axis) &&
          finite(s.off, -1, 1) &&
          finite(s.on, -1, 1) &&
          Math.abs(s.on - s.off) >= 0.5,
        'Invalid switch axis or overlap with another control',
      );
      used.add(s.axis);
      continue;
    }
    exactKeys(s, ['button', 'threshold', 'invert'], action);
    required(
      int(s.button, 0, p.device.buttons - 1) &&
        finite(s.threshold, 0.1, 0.9) &&
        typeof s.invert === 'boolean' &&
        !buttons.has(s.button),
      'Invalid or duplicate switch',
    );
    buttons.add(s.button);
  }
  return p;
}
export function normalizeRadioInput(profile, pad) {
  required(radioDeviceKey(pad) === canonicalJSON(profile.device), 'Selected joystick was replaced');
  const out = {};
  for (const name of FLIGHT_CONTROLS) {
    const c = profile.channels[name],
      raw = pad.axes[c.axis];
    required(finite(raw, -1, 1), 'Invalid joystick sample');
    if (name === 'throttle' && profile.throttleStyle === 'full-travel') {
      const value = clamp((raw - c.min) / (c.max - c.min), 0, 1);
      out[name] = c.invert ? 1 - value : value;
    } else {
      let value =
        raw >= c.center
          ? (raw - c.center) / (c.max - c.center)
          : (raw - c.center) / (c.center - c.min);
      value = clamp(value, -1, 1) * (c.invert ? -1 : 1);
      value =
        Math.abs(value) <= c.deadZone
          ? 0
          : (Math.sign(value) * (Math.abs(value) - c.deadZone)) / (1 - c.deadZone);
      // Deliberate labelled adaptation: centred gamepad throttle is 50%, not radio low.
      out[name] = name === 'throttle' ? (value + 1) / 2 : value;
    }
    out[name] = Math.round(out[name] * 1000) / 1000 || 0;
  }
  return out;
}
export function radioSwitch(profile, pad, action, wasActive = false) {
  const binding = profile.switches[action];
  if (!binding) return false;
  if (Object.hasOwn(binding, 'axis')) {
    const value = pad.axes[binding.axis];
    required(finite(value, -1, 1), 'Invalid switch axis sample');
    const travel = (value - binding.off) / (binding.on - binding.off);
    return travel > (wasActive ? 0.25 : 0.75);
  }
  const button = pad.buttons[binding.button];
  const value = typeof button === 'number' ? button : button?.value;
  required(finite(value, 0, 1), 'Invalid switch sample');
  return binding.invert ? value < binding.threshold : value >= binding.threshold;
}
export const DEFAULT_RESPONSE = Object.freeze({
  format: RESPONSE_FORMAT,
  id: 'gentle-v1',
  name: 'Gentle',
  maxRate: 240,
  maxTilt: 30,
  expo: 30,
  responseTicks: 8,
});
export function validateFlightResponse(input) {
  const p = plain(input);
  exactKeys(
    p,
    ['format', 'id', 'name', 'maxRate', 'maxTilt', 'expo', 'responseTicks'],
    'flight response',
  );
  required(
    p.format === RESPONSE_FORMAT &&
      stableId(p.id) &&
      typeof p.name === 'string' &&
      p.name.length > 0 &&
      p.name.length <= 120 &&
      int(p.maxRate, 60, 720) &&
      int(p.maxTilt, 5, 60) &&
      int(p.expo, 0, 80) &&
      int(p.responseTicks, 1, 30),
    'Invalid simulator flight response',
  );
  return p;
}
/** Integer curve: normalized input -1000..1000; output uses the same units.
 * expo blends linear with cubic; no hidden calibration sensitivity or Betaflight import. */
export function responseCurve(input, expo) {
  required(int(input, -1000, 1000) && int(expo, 0, 80), 'Invalid response input');
  const magnitude = Math.abs(input);
  return (
    Math.sign(input) *
    Math.round(
      (magnitude * (100 - expo) +
        Math.round((magnitude * magnitude * magnitude) / 1000000) * expo) /
        100,
    )
  );
}
export const responseIdentity = (input) => dataIdentity(validateFlightResponse(input));
export const exportRadioProfile = (input) => canonicalJSON(validateRadioProfile(input));
export const exportFlightResponse = (input) => canonicalJSON(validateFlightResponse(input));

/** User preferences only, separate from Journey and proof storage. Failed writes stay visible. */
export function createFlightProfileStore({ storage, key = 'revealline.flight-profiles.v1' }) {
  let current = { format: 'FlightProfiles.v1', radio: null, response: { ...DEFAULT_RESPONSE } },
    saved = false,
    error = null;
  const validate = (input) => {
    const value = plain(input);
    exactKeys(value, ['format', 'radio', 'response'], 'flight profiles');
    required(value.format === 'FlightProfiles.v1', 'Unsupported flight profiles');
    return {
      format: value.format,
      radio: value.radio === null ? null : validateRadioProfile(value.radio),
      response: validateFlightResponse(value.response),
    };
  };
  try {
    const text = storage?.getItem(key);
    if (text) {
      current = validate(text);
      saved = true;
    }
  } catch (failure) {
    error = failure.message;
  }
  const save = (value) => {
    current = validate(value);
    saved = false;
    error = null;
    try {
      required(storage?.setItem, 'Profile storage unavailable');
      const text = canonicalJSON(current);
      storage.setItem(key, text);
      required(storage.getItem(key) === text, 'Profile save could not be verified');
      saved = true;
    } catch (failure) {
      error = failure.message;
    }
    return { saved, error };
  };
  return {
    snapshot: () => structuredClone(current),
    status: () => ({ saved, error }),
    save,
    import: save,
    export: () => canonicalJSON(current),
  };
}
