import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
  stableId,
} from '../../game/data-json.mjs';
import { DEFAULT_RESPONSE, validateFlightResponse } from './radio-profile.mjs';
import { createTunedResponse } from './flight-response.mjs';
import { rateProfileIdentity } from './rates.mjs';
import { validateRateImportReceipt } from './betaflight-import.mjs';
import { validateAdvancedAircraft } from './advanced-simulation.mjs';
import { validateAdvancedTune } from './advanced-controller.mjs';

export const TUNING_LIBRARY_FORMAT = 'FpvTuningLibrary.v1';
export const TUNING_LIBRARY_KEY = 'revealline.fpv.tuning.v1';
export const TUNING_LIBRARY_BYTES = 512 * 1024;
const copy = (value) => structuredClone(value);
const name = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 120;
const revision = (value) => Number.isSafeInteger(value) && value >= 0 && value < 1e9;
const text = (input) =>
  boundedJSON(input, {
    maxBytes: TUNING_LIBRARY_BYTES,
    maxNodes: 100000,
    maxArray: 64,
    maxDepth: 16,
  });
const submitted = (input) =>
  boundedJSON(input, { maxBytes: 32768, maxNodes: 2000, maxArray: 64, maxDepth: 10 });
function validateProvenance(profile) {
  if (profile.provenance === undefined) return;
  profile.provenance = validateRateImportReceipt(profile.provenance);
  required(
    profile.response.rates &&
      profile.provenance.rateIdentity === rateProfileIdentity(profile.response.rates),
    'Import receipt does not describe these rates',
  );
}

export function validateDroneCamera(input) {
  exactKeys(input, ['tilt', 'verticalFov'], 'drone camera');
  required(
    Number.isFinite(input.tilt) && input.tilt >= 0 && input.tilt <= 60,
    'Camera tilt must be 0–60 degrees',
  );
  required(
    Number.isFinite(input.verticalFov) && input.verticalFov >= 40 && input.verticalFov <= 140,
    'Vertical field of view must be 40–140 degrees',
  );
  return copy(input);
}
export function validateTuningLibrary(input) {
  const value = text(input);
  exactKeys(
    value,
    ['format', 'revision', 'defaultProfileId', 'selectedSetupId', 'profiles', 'setups'],
    'tuning library',
  );
  required(
    value.format === TUNING_LIBRARY_FORMAT && revision(value.revision),
    'Unsupported tuning library',
  );
  required(
    Array.isArray(value.profiles) && value.profiles.length > 0 && value.profiles.length <= 32,
    'Keep between 1 and 32 rate profiles',
  );
  required(
    Array.isArray(value.setups) && value.setups.length > 0 && value.setups.length <= 32,
    'Keep between 1 and 32 drone setups',
  );
  const profiles = new Set(),
    setups = new Set();
  for (const profile of value.profiles) {
    exactKeys(
      profile,
      ['id', 'name', 'revision', 'response', 'history', 'provenance'],
      'saved rate profile',
    );
    required(
      stableId(profile.id) &&
        !profiles.has(profile.id) &&
        name(profile.name) &&
        revision(profile.revision),
      'Invalid or duplicate rate profile',
    );
    profiles.add(profile.id);
    profile.response = validateFlightResponse(profile.response);
    validateProvenance(profile);
    required(
      Array.isArray(profile.history) && profile.history.length <= 24,
      'Too many profile revisions',
    );
    let previous = -1;
    for (const item of profile.history) {
      exactKeys(item, ['revision', 'name', 'response', 'provenance'], 'rate revision');
      required(
        revision(item.revision) &&
          item.revision > previous &&
          item.revision < profile.revision &&
          name(item.name),
        'Invalid rate revision',
      );
      previous = item.revision;
      item.response = validateFlightResponse(item.response);
      validateProvenance(item);
    }
  }
  required(
    profiles.has(value.defaultProfileId),
    'The player default must reference a saved profile',
  );
  for (const setup of value.setups) {
    exactKeys(setup, ['id', 'name', 'profileId', 'camera', 'advanced'], 'drone setup');
    required(
      stableId(setup.id) && !setups.has(setup.id) && name(setup.name),
      'Invalid or duplicate drone setup',
    );
    setups.add(setup.id);
    required(setup.profileId === null || profiles.has(setup.profileId), 'Drone profile is missing');
    setup.camera = validateDroneCamera(setup.camera);
    if (setup.advanced !== undefined) {
      exactKeys(setup.advanced, ['aircraft', 'controller'], 'Advanced drone configuration');
      required(
        Object.hasOwn(setup.advanced, 'aircraft') && Object.hasOwn(setup.advanced, 'controller'),
        'Advanced drone configuration needs an explicit aircraft and controller',
      );
      setup.advanced = {
        aircraft: validateAdvancedAircraft(setup.advanced.aircraft),
        controller: validateAdvancedTune(setup.advanced.controller),
      };
    }
  }
  required(setups.has(value.selectedSetupId), 'Selected drone setup is missing');
  return value;
}
export function initialTuningLibrary({
  response = DEFAULT_RESPONSE,
  camera = { tilt: 10, verticalFov: 82 },
} = {}) {
  return validateTuningLibrary({
    format: TUNING_LIBRARY_FORMAT,
    revision: 0,
    defaultProfileId: 'legacy-feel',
    selectedSetupId: 'my-drone',
    profiles: [{ id: 'legacy-feel', name: 'Legacy feel', revision: 0, response, history: [] }],
    setups: [{ id: 'my-drone', name: 'My drone', profileId: null, camera }],
  });
}
export function resolveFlightConfiguration(library, setupId = library.selectedSetupId) {
  const value = validateTuningLibrary(library),
    setup = value.setups.find((item) => item.id === setupId);
  required(setup, 'Unknown drone setup');
  const profile = value.profiles.find(
    (item) => item.id === (setup.profileId ?? value.defaultProfileId),
  );
  const physical = {
    response: profile.response,
    ...(setup.advanced ? { advanced: copy(setup.advanced) } : {}),
  };
  if (physical.advanced) delete physical.advanced.aircraft.id;
  return copy({
    format: 'FpvEffectiveFlightConfig.v1',
    response: profile.response,
    camera: setup.camera,
    profileId: profile.id,
    profileRevision: profile.revision,
    setupId: setup.id,
    // Fingerprint the resolved physical configuration. Runtime identities add
    // backend, timing, world and rules; cosmetic camera/name choices stay out.
    simulationIdentity: dataIdentity(physical),
    ...(setup.advanced ? { advanced: setup.advanced } : {}),
  });
}
export function profileUsers(library, profileId) {
  return library.setups
    .filter((setup) => (setup.profileId ?? library.defaultProfileId) === profileId)
    .map(copy);
}

/** One atomic storage entry, optimistic revisions, and a cross-tab Web Lock where available.
 * No startup write: corrupt backups and the previous radio library remain recoverable. */
export function createTuningLibraryStore({
  storage,
  locks,
  key = TUNING_LIBRARY_KEY,
  ...migration
} = {}) {
  const initial = initialTuningLibrary(migration);
  let current = copy(initial),
    observed = null,
    error = null,
    blocked = false;
  function refresh() {
    try {
      const raw = storage?.getItem(key) ?? null;
      const previous = observed;
      // Keep the exact observed bytes even when validation fails. An explicit
      // backup restore may replace them, but must still reject a stale tab.
      observed = raw;
      if (raw !== null) current = validateTuningLibrary(raw);
      else if (previous !== null) current = copy(initial);
      error = null;
      blocked = false;
    } catch (failure) {
      error = failure.message;
      blocked = true;
    }
    return copy(current);
  }
  refresh();
  async function transaction(expectedRevision, mutate, { recover = false } = {}) {
    const run = () => {
      required(!blocked || recover, error ?? 'The saved tuning library cannot be read');
      required(
        current.revision === expectedRevision,
        'Settings changed. Refresh the library before saving this draft.',
      );
      const raw = storage?.getItem(key) ?? null;
      required(
        raw === observed,
        'Another tab changed these settings. Export your draft, then refresh before saving.',
      );
      const next = copy(current);
      mutate(next);
      next.revision++;
      const valid = validateTuningLibrary(next),
        serialized = canonicalJSON(valid);
      required(
        new TextEncoder().encode(serialized).length <= TUNING_LIBRARY_BYTES,
        'Tuning backup exceeds 512 KiB',
      );
      required(
        storage && typeof storage.setItem === 'function',
        'Storage is unavailable. Export your draft to keep it.',
      );
      storage.setItem(key, serialized);
      current = valid;
      observed = serialized;
      error = null;
      blocked = false;
      return copy(current);
    };
    try {
      return locks?.request ? await locks.request(key, run) : run();
    } catch (failure) {
      error = failure.message;
      throw failure;
    }
  }
  const find = (value, id) => {
    const result = value.profiles.find((profile) => profile.id === id);
    required(result, 'Unknown rate profile');
    return result;
  };
  function updateProfile(value, id, changes) {
    const profile = find(value, id);
    profile.history = [
      ...profile.history,
      {
        revision: profile.revision,
        name: profile.name,
        response: copy(profile.response),
        ...(profile.provenance ? { provenance: copy(profile.provenance) } : {}),
      },
    ].slice(-24);
    profile.revision++;
    if (changes.name !== undefined) profile.name = changes.name;
    if (changes.response !== undefined) profile.response = validateFlightResponse(changes.response);
    if (Object.hasOwn(changes, 'provenance')) {
      if (changes.provenance === null) delete profile.provenance;
      else profile.provenance = validateRateImportReceipt(changes.provenance);
    } else if (
      profile.provenance &&
      (!profile.response.rates ||
        profile.provenance.rateIdentity !== rateProfileIdentity(profile.response.rates))
    ) {
      // The old revision retains its receipt; edited rates cannot claim to be
      // the unchanged output of the original import.
      delete profile.provenance;
    }
  }
  return Object.freeze({
    snapshot: () => copy(current),
    refresh,
    status: () => ({
      saved: observed !== null,
      error,
      blocked,
      concurrency: locks?.request ? 'web-lock' : 'revision-check',
    }),
    effective: () => resolveFlightConfiguration(current),
    export: () => canonicalJSON(current),
    // Capture every caller-owned object before requesting an asynchronous lock.
    // A later editor change must never become part of an already-submitted save.
    saveProfile: async (id, changes, expected = current.revision) => {
      const patch = submitted(changes);
      exactKeys(patch, ['name', 'response', 'provenance'], 'profile edit');
      return transaction(expected, (value) => updateProfile(value, id, patch));
    },
    saveEditing: async (id, changes, setup, expected = current.revision) => {
      const patch = submitted(changes),
        drone = submitted(setup);
      exactKeys(patch, ['name', 'response', 'provenance'], 'profile edit');
      return transaction(expected, (value) => {
        updateProfile(value, id, patch);
        const index = value.setups.findIndex((item) => item.id === drone.id);
        required(index >= 0, 'Unknown drone setup');
        value.setups[index] = drone;
      });
    },
    createProfile: async (input, expected = current.revision) => {
      const profile = submitted(input);
      exactKeys(profile, ['id', 'name', 'response', 'provenance'], 'new profile');
      const { id, name: label, response = createTunedResponse(), provenance } = profile;
      return transaction(expected, (value) => {
        value.profiles.push({
          id,
          name: label,
          response,
          revision: 0,
          history: [],
          ...(provenance === undefined ? {} : { provenance }),
        });
      });
    },
    duplicateProfile: (sourceId, id, label, expected = current.revision) =>
      transaction(expected, (value) => {
        value.profiles.push({
          ...copy(find(value, sourceId)),
          id,
          name: label,
          revision: 0,
          history: [],
        });
      }),
    revertProfile: (id, targetRevision, expected = current.revision) =>
      transaction(expected, (value) => {
        const previous = find(value, id).history.find((item) => item.revision === targetRevision);
        required(previous, 'That revision is no longer in the local history');
        updateProfile(value, id, { ...previous, provenance: previous.provenance ?? null });
      }),
    removeProfile: (id, replacementId, expected = current.revision) =>
      transaction(expected, (value) => {
        find(value, id);
        required(id !== replacementId, 'Choose a different replacement profile');
        find(value, replacementId);
        if (value.defaultProfileId === id) value.defaultProfileId = replacementId;
        for (const setup of value.setups)
          if (setup.profileId === id) setup.profileId = replacementId;
        value.profiles = value.profiles.filter((profile) => profile.id !== id);
      }),
    setDefault: (id, expected = current.revision) =>
      transaction(expected, (value) => {
        find(value, id);
        value.defaultProfileId = id;
      }),
    saveSetup: async (setup, expected = current.revision) => {
      const drone = submitted(setup);
      return transaction(expected, (value) => {
        const index = value.setups.findIndex((item) => item.id === drone.id);
        if (index < 0) value.setups.push(drone);
        else value.setups[index] = drone;
      });
    },
    selectSetup: (id, expected = current.revision) =>
      transaction(expected, (value) => {
        value.selectedSetupId = id;
      }),
    removeSetup: (id, replacementId, expected = current.revision) =>
      transaction(expected, (value) => {
        required(
          id !== replacementId && value.setups.some((setup) => setup.id === replacementId),
          'Choose another drone setup',
        );
        value.setups = value.setups.filter((setup) => setup.id !== id);
        if (value.selectedSetupId === id) value.selectedSetupId = replacementId;
      }),
    restore: (input, expected = current.revision) => {
      const backup = validateTuningLibrary(input);
      return transaction(
        expected,
        (value) => Object.assign(value, backup, { revision: value.revision }),
        { recover: true },
      );
    },
  });
}
