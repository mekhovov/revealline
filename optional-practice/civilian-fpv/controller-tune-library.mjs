import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
  stableId,
} from '../../game/data-json.mjs';
import { ADVANCED_CONTROLLER, validateAdvancedTune } from './advanced-controller.mjs';
import { AIRCRAFT_CONTROLLER, validateAircraftControllerTune } from './aircraft-physics.mjs';
import { validateAdvancedAircraft } from './advanced-simulation.mjs';

export const CONTROLLER_TUNE_LIBRARY_FORMAT = 'FpvControllerTuneLibrary.v1';
export const CONTROLLER_TUNE_FORMAT = 'FpvControllerTune.v1';
export const CONTROLLER_TUNE_LIBRARY_KEY = 'revealline.fpv.controller-tunes.v1';
export const CONTROLLER_TUNE_LIBRARY_BYTES = 512 * 1024;
export const CONTROLLER_TUNE_LIMIT = 32;
export const CONTROLLER_TUNE_HISTORY_LIMIT = 24;
const copy = (value) => structuredClone(value);
const validName = (value) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 120;
const revision = (value) => Number.isSafeInteger(value) && value >= 0 && value < 1e9;
const contentFields = ['name', 'family', 'controller', 'sourceAircraft'];
const read = (input, maxBytes = CONTROLLER_TUNE_LIBRARY_BYTES) =>
  boundedJSON(input, { maxBytes, maxNodes: 100000, maxArray: 128, maxDepth: 12 });
const content = (value) => Object.fromEntries(contentFields.map((key) => [key, copy(value[key])]));

function validateController(family, input) {
  const value = read(input, 8192);
  const format =
    family === AIRCRAFT_CONTROLLER
      ? 'AdvancedControllerTune.v3'
      : family === ADVANCED_CONTROLLER
        ? 'AdvancedControllerTune.v2'
        : null;
  required(format && value.format === format, 'Controller family and tune format must match');
  // A reusable tune is a complete snapshot, never a sparse patch. In particular,
  // do not normalize old firmware or silently fill absent PID values.
  for (const axis of ['roll', 'pitch', 'yaw']) {
    required(value.gains?.[axis], 'Controller tune needs all three axes');
    for (const key of ['p', 'i', 'd', 'feedforward'])
      required(Number.isFinite(value.gains[axis][key]), 'Controller tune needs every gain');
  }
  return family === AIRCRAFT_CONTROLLER
    ? validateAircraftControllerTune(value)
    : validateAdvancedTune(value);
}

function validateContent(value) {
  required(validName(value.name), 'Controller tune needs a name of 1–120 characters');
  value.controller = validateController(value.family, value.controller);
  required(Object.hasOwn(value, 'sourceAircraft'), 'Controller tune needs source information');
  if (value.sourceAircraft !== null) {
    exactKeys(value.sourceAircraft, ['id', 'identity'], 'Controller tune source aircraft');
    required(
      typeof value.sourceAircraft.id === 'string' &&
        value.sourceAircraft.id.length > 0 &&
        value.sourceAircraft.id.length <= 80 &&
        /^[0-9a-f]{16}$/.test(value.sourceAircraft.identity),
      'Invalid controller tune source aircraft',
    );
  }
  return value;
}

export function validateControllerTune(input) {
  const value = read(input, 16384);
  exactKeys(value, ['format', ...contentFields], 'Portable controller tune');
  required(value.format === CONTROLLER_TUNE_FORMAT, 'Unsupported portable controller tune');
  return validateContent(value);
}

export function validateControllerTuneLibrary(input) {
  const value = read(input);
  exactKeys(value, ['format', 'revision', 'tunes'], 'Controller tune library');
  required(
    value.format === CONTROLLER_TUNE_LIBRARY_FORMAT && revision(value.revision),
    'Unsupported controller tune library',
  );
  required(
    Array.isArray(value.tunes) && value.tunes.length <= CONTROLLER_TUNE_LIMIT,
    'Keep at most 32 controller tunes',
  );
  const ids = new Set();
  for (const tune of value.tunes) {
    exactKeys(tune, ['id', 'revision', 'history', ...contentFields], 'Saved controller tune');
    required(
      stableId(tune.id) && !ids.has(tune.id) && revision(tune.revision),
      'Invalid or duplicate controller tune',
    );
    ids.add(tune.id);
    validateContent(tune);
    required(
      Array.isArray(tune.history) && tune.history.length <= CONTROLLER_TUNE_HISTORY_LIMIT,
      'Too many controller tune revisions',
    );
    let previous = -1;
    for (const item of tune.history) {
      exactKeys(item, ['revision', ...contentFields], 'Controller tune revision');
      required(
        revision(item.revision) && item.revision > previous && item.revision < tune.revision,
        'Invalid controller tune revision',
      );
      previous = item.revision;
      validateContent(item);
      required(
        item.family === tune.family && item.controller.format === tune.controller.format,
        'Controller tune history cannot change controller families',
      );
    }
  }
  return value;
}

export function initialControllerTuneLibrary() {
  return { format: CONTROLLER_TUNE_LIBRARY_FORMAT, revision: 0, tunes: [] };
}

/** Descriptive IDs are excluded so renaming a setup does not make its response untested. */
export function controllerTuneContext(advanced) {
  if (advanced === undefined || advanced === null) return null;
  const source = read(advanced, 32768);
  exactKeys(source, ['aircraft', 'controller'], 'Controller tune context');
  required(source.aircraft && source.controller, 'Aircraft and controller are required');
  const aircraft = validateAdvancedAircraft(source.aircraft);
  const family =
    aircraft.format === 'AdvancedAircraft.v2' ? AIRCRAFT_CONTROLLER : ADVANCED_CONTROLLER;
  const controller = validateController(family, source.controller);
  const physical = copy(aircraft);
  delete physical.id;
  return {
    family,
    tuneFormat: controller.format,
    sourceAircraft: { id: aircraft.id, identity: dataIdentity(physical) },
  };
}

/** A compatible family permits a copy, not a claim of good response on another aircraft. */
export function controllerTuneCompatibility(tune, target) {
  const candidate = read(tune, 131072);
  const source = validateControllerTune({ format: CONTROLLER_TUNE_FORMAT, ...content(candidate) });
  if (!target)
    return { compatible: false, responseUntested: true, reason: 'controller-unavailable' };
  const context = read(target, 4096);
  exactKeys(
    context,
    ['family', 'tuneFormat', 'sourceAircraft'],
    'Controller compatibility context',
  );
  if (context.sourceAircraft !== null && context.sourceAircraft !== undefined) {
    exactKeys(context.sourceAircraft, ['id', 'identity'], 'Controller target aircraft');
    required(
      typeof context.sourceAircraft.id === 'string' &&
        typeof context.sourceAircraft.identity === 'string' &&
        /^[0-9a-f]{16}$/.test(context.sourceAircraft.identity),
      'Invalid controller target aircraft',
    );
  }
  if (context.family !== source.family || context.tuneFormat !== source.controller.format)
    return { compatible: false, responseUntested: true, reason: 'controller-family-mismatch' };
  const responseUntested =
    !source.sourceAircraft ||
    !context.sourceAircraft ||
    source.sourceAircraft.identity !== context.sourceAircraft.identity;
  return {
    compatible: true,
    responseUntested,
    reason: responseUntested ? 'response-untested-on-aircraft' : 'same-aircraft',
  };
}

/** This store writes only its own entry. Applied tunes are copied into setup drafts;
 * a setup save and a tune-library save are intentionally separate transactions. */
export function createControllerTuneLibraryStore({
  storage,
  locks,
  key = CONTROLLER_TUNE_LIBRARY_KEY,
} = {}) {
  let current = initialControllerTuneLibrary(),
    observed = null,
    error = null,
    blocked = false;
  function refresh() {
    try {
      const raw = storage?.getItem(key) ?? null;
      observed = raw;
      current = raw === null ? initialControllerTuneLibrary() : validateControllerTuneLibrary(raw);
      error = null;
      blocked = false;
    } catch (failure) {
      error = failure.message;
      blocked = true;
    }
    return copy(current);
  }
  refresh();
  async function transaction(expected, mutate, { recover = false } = {}) {
    const run = () => {
      required(!blocked || recover, error ?? 'The controller tune library cannot be read');
      required(
        current.revision === expected,
        'Controller tunes changed. Refresh the library before saving this draft.',
      );
      required(
        (storage?.getItem(key) ?? null) === observed,
        'Another tab changed controller tunes. Export your draft, then refresh before saving.',
      );
      const next = copy(current);
      mutate(next);
      const valid = validateControllerTuneLibrary(next);
      if (!blocked && canonicalJSON(valid) === canonicalJSON(current)) {
        error = null;
        return copy(current);
      }
      valid.revision = current.revision + 1;
      required(revision(valid.revision), 'Controller tune library revision limit reached');
      const serialized = canonicalJSON(valid);
      required(
        new TextEncoder().encode(serialized).length <= CONTROLLER_TUNE_LIBRARY_BYTES,
        'Controller tune backup exceeds 512 KiB',
      );
      required(
        storage && typeof storage.setItem === 'function',
        'Storage is unavailable. Export your controller tune to keep it.',
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
  function find(value, id) {
    const tune = value.tunes.find((item) => item.id === id);
    required(tune, 'Unknown controller tune');
    return tune;
  }
  function update(tune, changes) {
    const next = validateContent({ ...content(tune), ...changes });
    required(
      next.family === tune.family && next.controller.format === tune.controller.format,
      'Save a different controller family as a new tune',
    );
    if (canonicalJSON(next) === canonicalJSON(content(tune))) return;
    const history = [...tune.history, { revision: tune.revision, ...content(tune) }].slice(
      -CONTROLLER_TUNE_HISTORY_LIMIT,
    );
    Object.assign(tune, next, { revision: tune.revision + 1, history });
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
    export: () => canonicalJSON(current),
    exportOriginal: () => observed,
    exportTune: (id) =>
      canonicalJSON({ format: CONTROLLER_TUNE_FORMAT, ...content(find(current, id)) }),
    loadTune: (id, target) => {
      const tune = find(current, id);
      const compatibility = controllerTuneCompatibility(tune, target);
      required(compatibility.compatible, 'This controller tune is incompatible with the setup');
      return {
        id: tune.id,
        name: tune.name,
        revision: tune.revision,
        controller: copy(tune.controller),
        sourceAircraft: copy(tune.sourceAircraft),
        compatibility,
      };
    },
    saveTune: async (input, expected = current.revision) => {
      const submitted = read(input, 16384);
      exactKeys(submitted, ['id', ...contentFields], 'Controller tune edit');
      required(stableId(submitted.id), 'Invalid controller tune ID');
      validateContent(submitted);
      return transaction(expected, (value) => {
        const existing = value.tunes.find((item) => item.id === submitted.id);
        if (existing) update(existing, content(submitted));
        else value.tunes.push({ ...submitted, revision: 0, history: [] });
      });
    },
    renameTune: (id, name, expected = current.revision) => {
      required(validName(name), 'Controller tune needs a name of 1–120 characters');
      return transaction(expected, (value) => update(find(value, id), { name }));
    },
    removeTune: (id, expected = current.revision) =>
      transaction(expected, (value) => {
        find(value, id);
        value.tunes = value.tunes.filter((item) => item.id !== id);
      }),
    duplicateTune: (id, newId, name, expected = current.revision) => {
      required(stableId(newId) && validName(name), 'Choose a valid ID and name for the tune copy');
      return transaction(expected, (value) => {
        required(
          !value.tunes.some((item) => item.id === newId),
          'Controller tune ID already exists',
        );
        value.tunes.push({
          ...content(find(value, id)),
          id: newId,
          name,
          revision: 0,
          history: [],
        });
      });
    },
    revertTune: (id, sourceRevision, expected = current.revision) =>
      transaction(expected, (value) => {
        const tune = find(value, id);
        const old = tune.history.find((item) => item.revision === sourceRevision);
        required(old, 'Controller tune revision is no longer available');
        update(tune, content(old));
      }),
    importTune: (input, { id, name } = {}, expected = current.revision) => {
      const imported = validateControllerTune(input);
      required(stableId(id), 'Choose a new ID for the imported controller tune');
      if (name !== undefined) {
        required(validName(name), 'Controller tune needs a name of 1–120 characters');
        imported.name = name;
      }
      return transaction(expected, (value) => {
        required(!value.tunes.some((item) => item.id === id), 'Controller tune ID already exists');
        value.tunes.push({ ...content(imported), id, revision: 0, history: [] });
      });
    },
    restore: (input, expected = current.revision) => {
      const backup = validateControllerTuneLibrary(input);
      return transaction(
        expected,
        (value) => Object.assign(value, backup, { revision: value.revision }),
        { recover: true },
      );
    },
  });
}
