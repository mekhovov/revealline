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
// User-tested TX15 USB simulator model. Match the complete device identity;
// other radios and radio-side mixes still need their own calibration.
export function defaultRadioProfile() {
  return validateRadioProfile({
    format: AXIS_RADIO_FORMAT,
    id: 'tx15-usb-mode2',
    name: 'RadioMaster TX15 — tested USB Mode 2',
    device: {
      id: 'TX15 Joystick (Vendor: 1209 Product: 4f54)',
      mapping: '',
      axes: 8,
      buttons: 24,
    },
    stickMode: 2,
    throttleStyle: 'full-travel',
    verified: true,
    channels: {
      roll: { axis: 0, min: -1, center: 0.004, max: 1, invert: false, deadZone: 0.02 },
      pitch: { axis: 1, min: -1, center: 0.004, max: 1, invert: false, deadZone: 0.02 },
      yaw: { axis: 3, min: -0.996, center: 0.004, max: 1, invert: false, deadZone: 0.02 },
      throttle: { axis: 2, min: -1, center: null, max: 1, invert: false, deadZone: 0 },
    },
    switches: {
      arm: { axis: 4, off: -1, on: 1 },
      pause: null,
      reset: { button: 1, threshold: 0.5, invert: false },
    },
  });
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

export const FLIGHT_PROFILE_LIBRARY_FORMAT = 'FlightProfiles.v2';
export const RADIO_LIBRARY_LIMIT = 16;
export const RADIO_LIBRARY_BYTES = 64 * 1024;
export const radioProfileKey = (input) => dataIdentity(validateRadioProfile(input));
const calibrationKey = ({ id, name, verified, format, ...calibration }) =>
  canonicalJSON(calibration);
const profileLibraryPlain = (input) =>
  boundedJSON(input, {
    maxBytes: RADIO_LIBRARY_BYTES,
    maxNodes: 12000,
    maxArray: RADIO_LIBRARY_LIMIT,
    maxDepth: 9,
  });
function uniqueRadioProfiles(profiles, preferVerified = false) {
  const byKey = new Map();
  for (const input of profiles) {
    const profile = validateRadioProfile(input),
      key = radioProfileKey(profile),
      previous = byKey.get(key);
    if (preferVerified) {
      const equivalent = [...byKey.entries()].filter(
        ([, item]) => calibrationKey(item) === calibrationKey(profile),
      );
      // Importing the same mapping as an untrusted suggestion must not replace
      // a calibration already verified on this computer. A later local check
      // upgrades its draft without accumulating a duplicate unverified entry.
      if (!profile.verified && equivalent.some(([, item]) => item.verified)) continue;
      if (profile.verified)
        for (const [draftKey, item] of equivalent) if (!item.verified) byKey.delete(draftKey);
    }
    required(
      !previous || canonicalJSON(previous) === canonicalJSON(profile),
      'Radio profile identity collision',
    );
    byKey.set(key, profile);
  }
  required(byKey.size <= RADIO_LIBRARY_LIMIT, 'Radio library is full; remove a profile first');
  return [...byKey.values()];
}
/** Portable local backup, not a certification of somebody else's hardware. */
export function validateFlightProfileLibrary(input) {
  const value = profileLibraryPlain(input);
  exactKeys(value, ['format', 'radio', 'response', 'radios'], 'flight profile library');
  required(
    value.format === FLIGHT_PROFILE_LIBRARY_FORMAT && Array.isArray(value.radios),
    'Unsupported flight profile library',
  );
  const radio = value.radio === null ? null : validateRadioProfile(value.radio),
    radios = uniqueRadioProfiles(value.radios);
  required(radios.length === value.radios.length, 'Repeated radio profile');
  required(
    radio === null || radios.some((item) => canonicalJSON(item) === canonicalJSON(radio)),
    'Selected radio is missing from the library',
  );
  return {
    format: FLIGHT_PROFILE_LIBRARY_FORMAT,
    radio,
    response: validateFlightResponse(value.response),
    radios,
  };
}

/** User preferences only, separate from Journey and proof storage. Failed writes stay visible. */
export function createFlightProfileStore({ storage, key = 'revealline.flight-profiles.v1' }) {
  const libraryKey = `${key}.library.v2`;
  const persistedProfileKeys = new Set();
  let current = { format: 'FlightProfiles.v1', radio: null, response: { ...DEFAULT_RESPONSE } },
    radios = [],
    saved = false,
    error = null,
    unreadableLibrary = false,
    libraryObserved = false;
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
  const decode = (input) => {
    const value = profileLibraryPlain(input);
    if (value.format === FLIGHT_PROFILE_LIBRARY_FORMAT) return validateFlightProfileLibrary(value);
    const legacy = validate(value);
    return {
      ...legacy,
      format: FLIGHT_PROFILE_LIBRARY_FORMAT,
      radios: legacy.radio ? [legacy.radio] : [],
    };
  };
  const library = () => ({ ...current, format: FLIGHT_PROFILE_LIBRARY_FORMAT, radios });
  try {
    // The old entry remains untouched, including after migration, so a player
    // rolling back to an older build retains its original calibrated radio.
    const primary = storage?.getItem(libraryKey),
      text = primary ?? storage?.getItem(key);
    libraryObserved = primary !== null && primary !== undefined;
    if (text !== null && text !== undefined) {
      try {
        const value = decode(text);
        current = validate({
          format: 'FlightProfiles.v1',
          radio: value.radio,
          response: value.response,
        });
        radios = value.radios;
        for (const profile of radios) persistedProfileKeys.add(radioProfileKey(profile));
        saved = true;
      } catch (failure) {
        unreadableLibrary = primary !== null && primary !== undefined;
        throw failure;
      }
    }
  } catch (failure) {
    error = failure.message;
  }
  const commit = (value, nextRadios, { removeKey = null, importedKeys = [] } = {}) => {
    let next = validate(value);
    const retainedKeys = new Set(nextRadios.map(radioProfileKey));
    for (const profileKey of persistedProfileKeys)
      if (!retainedKeys.has(profileKey)) persistedProfileKeys.delete(profileKey);
    // Refresh before each write: separate settings views must not overwrite a
    // calibration saved through another store instance since they were opened.
    // Previously persisted entries are not local additions: retaining a stale
    // copy must not resurrect a calibration another settings view removed.
    let persisted = [];
    try {
      const text = storage?.getItem(libraryKey);
      if (text !== null && text !== undefined) {
        persisted = validateFlightProfileLibrary(text).radios;
        libraryObserved = true;
        for (const profile of persisted) persistedProfileKeys.add(radioProfileKey(profile));
      } else if (!libraryObserved)
        persisted = radios.filter((profile) => persistedProfileKeys.has(radioProfileKey(profile)));
    } catch (failure) {
      persisted = radios;
      unreadableLibrary = true;
      error = failure.message;
    }
    const merged = uniqueRadioProfiles(
      [
        ...persisted,
        ...nextRadios.filter((item) => {
          const profileKey = radioProfileKey(item);
          return !persistedProfileKeys.has(profileKey) || importedKeys.includes(profileKey);
        }),
      ].filter((item) => radioProfileKey(item) !== removeKey),
      true,
    );
    if (
      next.radio &&
      !merged.some((item) => radioProfileKey(item) === radioProfileKey(next.radio))
    ) {
      const verified = merged.find(
        (item) => item.verified && calibrationKey(item) === calibrationKey(next.radio),
      );
      next = { ...next, radio: verified ?? null };
    }
    const checked = validateFlightProfileLibrary({
      ...next,
      format: FLIGHT_PROFILE_LIBRARY_FORMAT,
      radios: merged,
    });
    current = next;
    radios = checked.radios;
    saved = false;
    if (unreadableLibrary)
      return {
        saved,
        error: (error = 'Saved radio library is unreadable; its bytes were preserved'),
      };
    error = null;
    try {
      required(storage?.setItem, 'Profile storage unavailable');
      const text = canonicalJSON(checked);
      storage.setItem(libraryKey, text);
      required(storage.getItem(libraryKey) === text, 'Profile save could not be verified');
      libraryObserved = true;
      persistedProfileKeys.clear();
      for (const profile of checked.radios) persistedProfileKeys.add(radioProfileKey(profile));
      saved = true;
    } catch (failure) {
      error = failure.message;
    }
    return { saved, error };
  };
  const save = (input) => {
    const value = validate(input);
    return commit(value, [...radios, ...(value.radio ? [value.radio] : [])]);
  };
  return {
    snapshot: () => structuredClone(current),
    status: () => ({ saved, error, unreadable: unreadableLibrary }),
    radios: () =>
      radios.map((profile) => ({
        key: radioProfileKey(profile),
        profile: structuredClone(profile),
      })),
    library: () => structuredClone(library()),
    save,
    import(input) {
      const value = decode(input);
      return commit(
        { format: 'FlightProfiles.v1', radio: value.radio, response: value.response },
        [...radios, ...value.radios],
        { importedKeys: value.radios.map(radioProfileKey) },
      );
    },
    selectRadio(profileKey) {
      const profile = radios.find((item) => radioProfileKey(item) === profileKey);
      required(profile, 'Radio profile is not in this library');
      return save({ ...current, radio: profile });
    },
    removeRadio(profileKey) {
      required(
        radios.some((item) => radioProfileKey(item) === profileKey),
        'Radio profile is not in this library',
      );
      return commit(
        {
          ...current,
          radio:
            current.radio && radioProfileKey(current.radio) === profileKey ? null : current.radio,
        },
        radios.filter((item) => radioProfileKey(item) !== profileKey),
        { removeKey: profileKey },
      );
    },
    export: () => canonicalJSON(current),
    exportLibrary: () => canonicalJSON(library()),
  };
}
