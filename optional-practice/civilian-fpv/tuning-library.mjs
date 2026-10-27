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
import {
  createPresetConfiguration,
  createPresetComponents,
  applyAircraftComponents,
  getAircraftPreset,
  validateAircraftComponents,
} from './aircraft-presets.mjs';
import { validateAircraftControllerTune } from './aircraft-physics.mjs';

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
    exactKeys(
      setup,
      ['id', 'name', 'profileId', 'camera', 'advanced', 'preset', 'components'],
      'drone setup',
    );
    required(
      stableId(setup.id) && !setups.has(setup.id) && name(setup.name),
      'Invalid or duplicate drone setup',
    );
    setups.add(setup.id);
    required(setup.profileId === null || profiles.has(setup.profileId), 'Drone profile is missing');
    setup.camera = validateDroneCamera(setup.camera);
    if (setup.preset !== undefined) {
      exactKeys(setup.preset, ['id', 'revision'], 'aircraft preset provenance');
      required(
        stableId(setup.preset.id) && revision(setup.preset.revision) && setup.preset.revision > 0,
        'Invalid aircraft preset provenance',
      );
      required(setup.advanced, 'An aircraft preset needs a saved physical configuration');
    }
    if (setup.advanced !== undefined) {
      exactKeys(setup.advanced, ['aircraft', 'controller'], 'Advanced drone configuration');
      required(
        Object.hasOwn(setup.advanced, 'aircraft') && Object.hasOwn(setup.advanced, 'controller'),
        'Advanced drone configuration needs an explicit aircraft and controller',
      );
      setup.advanced = {
        aircraft: validateAdvancedAircraft(setup.advanced.aircraft),
        controller:
          setup.advanced.aircraft.format === 'AdvancedAircraft.v2'
            ? validateAircraftControllerTune(setup.advanced.controller)
            : validateAdvancedTune(setup.advanced.controller),
      };
    }
    if (setup.components !== undefined) {
      setup.components = validateAircraftComponents(setup.components);
      required(
        setup.advanced?.aircraft.format === 'AdvancedAircraft.v2' &&
          setup.preset?.id === setup.components.presetId &&
          setup.advanced.aircraft.id === setup.components.presetId,
        'Component inventory must describe this aircraft setup',
      );
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
      // A no-op save is not a new revision. Explicit restores still write so
      // they can repair unreadable storage even when the fallback is identical.
      if (!recover && canonicalJSON(next) === canonicalJSON(current)) {
        error = null;
        return copy(current);
      }
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
    const candidate = { ...copy(profile) };
    if (changes.name !== undefined) candidate.name = changes.name;
    if (changes.response !== undefined)
      candidate.response = validateFlightResponse(changes.response);
    if (Object.hasOwn(changes, 'provenance')) {
      if (changes.provenance === null) delete candidate.provenance;
      else candidate.provenance = validateRateImportReceipt(changes.provenance);
    } else if (
      candidate.provenance &&
      (!candidate.response.rates ||
        candidate.provenance.rateIdentity !== rateProfileIdentity(candidate.response.rates))
    ) {
      // Edited rates cannot claim the unchanged output of their source import.
      delete candidate.provenance;
    }
    if (canonicalJSON(candidate) === canonicalJSON(profile)) return false;
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
    profile.name = candidate.name;
    profile.response = candidate.response;
    if (candidate.provenance) profile.provenance = candidate.provenance;
    else delete profile.provenance;
    return true;
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
    /** Persist the whole workbench draft in the existing single library entry.
     * The selected response is explicitly assigned; opening/browsing an item
     * never calls this method. Shared updates require an explicit action. */
    saveSetupDraft: async (input, expected = current.revision) => {
      const request = submitted(input);
      exactKeys(
        request,
        ['setup', 'profile', 'rateAction', 'newProfileId', 'newProfileName', 'select'],
        'complete setup draft',
      );
      exactKeys(request.profile, ['sourceId', 'name', 'response', 'provenance'], 'draft rates');
      required(
        request.rateAction === undefined || ['copy', 'update'].includes(request.rateAction),
        'Choose whether to copy rates or update their shared profile',
      );
      required(
        request.select === undefined || typeof request.select === 'boolean',
        'Invalid setup selection',
      );
      return transaction(expected, (value) => {
        const source = find(value, request.profile.sourceId),
          setup = copy(request.setup),
          trial = copy(value),
          { sourceId, ...patch } = request.profile;
        required(
          patch.name !== undefined && patch.response !== undefined,
          'Draft rates are incomplete',
        );
        const changed = updateProfile(trial, sourceId, patch);
        setup.profileId =
          setup.profileId === null && source.id === value.defaultProfileId ? null : source.id;
        if (changed && (request.rateAction ?? 'copy') === 'copy') {
          required(
            stableId(request.newProfileId) &&
              !value.profiles.some((profile) => profile.id === request.newProfileId),
            'Choose a new rate profile ID for this copy',
          );
          const edited = find(trial, sourceId);
          value.profiles.push({
            id: request.newProfileId,
            name: request.newProfileName ?? edited.name,
            response: copy(edited.response),
            revision: 0,
            history: [],
            ...(edited.provenance ? { provenance: copy(edited.provenance) } : {}),
          });
          setup.profileId = request.newProfileId;
        } else if (changed) updateProfile(value, sourceId, patch);
        const index = value.setups.findIndex((item) => item.id === setup.id);
        if (index < 0) value.setups.push(setup);
        else value.setups[index] = setup;
        if (request.select) value.selectedSetupId = setup.id;
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
    createAndSelectSetup: async (setup, expected = current.revision) => {
      const drone = submitted(setup);
      return transaction(expected, (value) => {
        value.setups.push(drone);
        value.selectedSetupId = drone.id;
      });
    },
    createPresetSetup: async (input, expected = current.revision) => {
      const request = submitted(input);
      exactKeys(
        request,
        ['presetId', 'setupId', 'profileId', 'rates', 'response', 'provenance', 'replace'],
        'aircraft preset selection',
      );
      const preset = getAircraftPreset(request.presetId),
        configuration = createPresetConfiguration(preset.id);
      required(
        ['defaults', 'keep'].includes(request.rates),
        'Choose aircraft defaults or keep current rates',
      );
      required(
        request.replace === undefined || typeof request.replace === 'boolean',
        'Invalid preset reset',
      );
      required(
        request.rates === 'keep' ||
          (request.response === undefined && request.provenance === undefined),
        'Aircraft defaults cannot contain replacement rates',
      );
      return transaction(expected, (value) => {
        const existing = value.setups.find((item) => item.id === request.setupId);
        required(
          request.replace ? existing?.preset?.id === preset.id : !existing,
          'Choose a new setup ID or reset its own preset',
        );
        const active = value.setups.find((item) => item.id === value.selectedSetupId),
          currentProfile = find(value, active.profileId ?? value.defaultProfileId);
        const response =
          request.rates === 'keep'
            ? validateFlightResponse(request.response ?? currentProfile.response)
            : configuration.response;
        const provenance =
          request.rates === 'keep'
            ? (request.provenance ??
              (request.response === undefined ? currentProfile.provenance : undefined))
            : undefined;
        value.profiles.push({
          id: request.profileId,
          name: `${preset.name} · ${request.rates === 'keep' ? 'copied rates' : 'SIM starter rates'}`,
          revision: 0,
          response,
          history: [],
          ...(provenance ? { provenance } : {}),
        });
        const setup = {
          id: request.setupId,
          name: existing?.name ?? preset.name,
          profileId: request.profileId,
          camera: configuration.camera,
          advanced: { aircraft: configuration.aircraft, controller: configuration.controller },
          preset: configuration.preset,
          components: configuration.components,
        };
        if (request.replace) value.setups[value.setups.indexOf(existing)] = setup;
        else value.setups.push(setup);
        value.selectedSetupId = setup.id;
      });
    },
    saveAircraftConfiguration: async (input, expected = current.revision) => {
      const request = submitted(input);
      exactKeys(
        request,
        ['setupId', 'newProfileId', 'advanced', 'response', 'camera', 'preset', 'components'],
        'aircraft configuration edit',
      );
      required(request.advanced, 'An aircraft configuration is required');
      return transaction(expected, (value) => {
        const setup = value.setups.find((item) => item.id === request.setupId);
        required(setup, 'Unknown drone setup');
        const currentProfile = find(value, setup.profileId ?? value.defaultProfileId);
        const response =
          request.response === undefined
            ? currentProfile.response
            : validateFlightResponse(request.response);
        // Physical/camera-only saves do not spend a profile slot. A changed
        // response gets an independent profile rather than editing shared users.
        if (canonicalJSON(response) !== canonicalJSON(currentProfile.response)) {
          value.profiles.push({
            id: request.newProfileId,
            name: `${setup.name} · rates`.slice(0, 120),
            revision: 0,
            response,
            history: [],
          });
          setup.profileId = request.newProfileId;
        }
        if (Object.hasOwn(request, 'preset')) {
          if (request.preset === null) delete setup.preset;
          else {
            required(
              request.preset?.id === request.advanced.aircraft?.id,
              'Preset provenance must match the aircraft',
            );
            setup.preset = request.preset;
            // Explicit selection is a fresh built-in baseline even when its ID
            // matches. Ordinary coefficient edits omit preset and retain the
            // installed battery/payload inventory instead.
            delete setup.components;
          }
        } else if (setup.advanced?.aircraft.id !== request.advanced.aircraft?.id)
          delete setup.preset;
        if (Object.hasOwn(request, 'components')) {
          if (request.components === null) delete setup.components;
          else {
            const components = validateAircraftComponents(request.components);
            required(
              components.presetId === setup.preset?.id &&
                components.presetId === request.advanced.aircraft?.id,
              'Component inventory must describe this aircraft setup',
            );
            setup.components = components;
          }
        }
        if (setup.components?.presetId !== setup.preset?.id) delete setup.components;
        if (setup.preset && !setup.components) {
          try {
            setup.components = createPresetComponents(setup.preset.id, request.advanced.aircraft);
          } catch {
            // Unknown future catalog revisions retain numerical physics without
            // inventing a component inventory for them.
          }
        }
        setup.advanced = request.advanced;
        if (request.camera !== undefined) setup.camera = validateDroneCamera(request.camera);
      });
    },
    saveAircraftComponents: async (input, expected = current.revision) => {
      const request = submitted(input);
      exactKeys(request, ['setupId', 'battery', 'cameraPayload'], 'component edit');
      return transaction(expected, (value) => {
        const setup = value.setups.find((item) => item.id === request.setupId);
        required(
          setup?.preset && setup.advanced?.aircraft.format === 'AdvancedAircraft.v2',
          'Select a built-in aircraft setup before editing components',
        );
        const result = applyAircraftComponents(
          setup.advanced.aircraft,
          setup.components ?? createPresetComponents(setup.preset.id, setup.advanced.aircraft),
          { battery: request.battery, cameraPayload: request.cameraPayload },
        );
        setup.advanced.aircraft = result.aircraft;
        setup.components = result.components;
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
