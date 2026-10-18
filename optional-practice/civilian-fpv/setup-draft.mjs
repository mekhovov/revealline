import {
  boundedJSON,
  canonicalJSON,
  exactKeys,
  required,
  stableId,
} from '../../game/data-json.mjs';
import { DEFAULT_RESPONSE } from './radio-profile.mjs';
import { createTunedResponse } from './flight-response.mjs';
import { createRateProfile, RATE_ALGORITHMS, rateProfileIdentity } from './rates.mjs';
import { createPresetConfiguration, getAircraftPreset } from './aircraft-presets.mjs';
import { validateTuningLibrary } from './tuning-library.mjs';

const copy = (value) => structuredClone(value);
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const model = (response) => response.rates?.algorithm ?? 'legacy';
const HISTORY_LIMIT = 64;

function selected(library, setupId) {
  const setup = library.setups.find((item) => item.id === setupId);
  required(setup, 'Unknown drone setup');
  const profile = library.profiles.find(
    (item) => item.id === (setup.profileId ?? library.defaultProfileId),
  );
  return {
    setup: copy(setup),
    profile: {
      sourceId: profile.id,
      name: profile.name,
      response: copy(profile.response),
      ...(profile.provenance ? { provenance: copy(profile.provenance) } : {}),
    },
  };
}

function detachEditedReceipt(profile) {
  if (
    profile.provenance &&
    (!profile.response.rates ||
      profile.provenance.rateIdentity !== rateProfileIdentity(profile.response.rates))
  )
    delete profile.provenance;
}

/** Exact leaf differences are also used by review, comparison and search. */
export function setupDraftChanges(before, after) {
  const changes = [];
  const walk = (previous, next, path) => {
    if (previous !== undefined && next !== undefined && same(previous, next)) return;
    if (
      previous &&
      next &&
      typeof previous === 'object' &&
      typeof next === 'object' &&
      !Array.isArray(previous) &&
      !Array.isArray(next)
    ) {
      for (const key of new Set([...Object.keys(previous), ...Object.keys(next)]))
        walk(previous[key], next[key], path ? `${path}.${key}` : key);
      return;
    }
    const group =
      path.startsWith('profile.') || path === 'setup.profileId'
        ? 'rates'
        : path.startsWith('setup.camera')
          ? 'camera'
          : path.startsWith('setup.advanced.controller')
            ? 'controller'
            : 'aircraft';
    changes.push({ group, path, before: copy(previous), after: copy(next) });
  };
  walk(before, after, '');
  return changes;
}

/** A detached editing authority. No method here writes persistence or touches a flight.
 * Unfinished number text is kept apart from the last valid numerical configuration. */
export function createSetupDraft({ library: input, setupId } = {}) {
  let library = validateTuningLibrary(input),
    sourceRevision = library.revision,
    baseline = selected(library, setupId ?? library.selectedSetupId),
    current = copy(baseline),
    algorithmDrafts = { [model(current.profile.response)]: copy(current.profile.response) },
    numericByAlgorithm = {},
    editorState = null,
    baselineEditorState = null,
    history = [],
    generation = 0;

  function record() {
    return copy({
      current,
      baseline,
      algorithmDrafts,
      numericByAlgorithm,
      editorState,
      baselineEditorState,
    });
  }
  function checkpoint() {
    history.push(record());
    if (history.length > HISTORY_LIMIT) history.shift();
  }
  function validate(candidate) {
    exactKeys(candidate, ['setup', 'profile'], 'setup draft');
    exactKeys(candidate.profile, ['sourceId', 'name', 'response', 'provenance'], 'draft rates');
    const trial = copy(library),
      profile = trial.profiles.find((item) => item.id === candidate.profile.sourceId);
    required(profile, 'Unknown source rate profile');
    detachEditedReceipt(candidate.profile);
    profile.name = candidate.profile.name;
    profile.response = copy(candidate.profile.response);
    if (candidate.profile.provenance) profile.provenance = copy(candidate.profile.provenance);
    else delete profile.provenance;
    const setup = copy(candidate.setup);
    setup.profileId = candidate.profile.sourceId;
    const index = trial.setups.findIndex((item) => item.id === setup.id);
    if (index < 0) trial.setups.push(setup);
    else trial.setups[index] = setup;
    trial.selectedSetupId = setup.id;
    validateTuningLibrary(trial);
    return candidate;
  }
  function change(mutator, { clearNumeric = false } = {}) {
    const next = copy(current);
    mutator(next);
    validate(next);
    if (same(next, current) && !clearNumeric) return false;
    checkpoint();
    current = copy(next);
    algorithmDrafts[model(current.profile.response)] = copy(current.profile.response);
    if (clearNumeric)
      numericByAlgorithm =
        clearNumeric === 'rates'
          ? numericByAlgorithm.common
            ? { common: numericByAlgorithm.common }
            : {}
          : clearNumeric === 'aircraft'
            ? Object.fromEntries(
                Object.entries(numericByAlgorithm).filter(([key]) => key !== 'common'),
              )
            : {};
    generation++;
    return true;
  }
  function numberTarget(value, path) {
    const keys = path.split('.');
    required(keys.length > 1 && keys.length <= 10, 'Invalid numeric setting path');
    let target = value;
    for (const key of keys.slice(0, -1)) {
      required(
        stableId(key) && target && typeof target === 'object' && Object.hasOwn(target, key),
        'Unknown numeric setting',
      );
      target = target[key];
    }
    const key = keys.at(-1);
    required(
      stableId(key) && target && Object.hasOwn(target, key) && typeof target[key] === 'number',
      'Unknown numeric setting',
    );
    return { target, key };
  }
  function numericCandidate() {
    const next = copy(current),
      values = {
        ...numericByAlgorithm.common,
        ...numericByAlgorithm[model(current.profile.response)],
      };
    for (const [path, text] of Object.entries(values)) {
      required(
        /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(text.trim()),
        `${path}: enter a complete number`,
      );
      const number = Number(text);
      required(Number.isFinite(number), `${path}: enter a finite number`);
      const { target, key } = numberTarget(next, path);
      target[key] = number;
    }
    return validate(next);
  }
  const api = {
    snapshot: () => copy(current),
    baseline: () => copy(baseline),
    state: () => ({
      ...copy(current),
      sourceRevision,
      generation,
      numericText: copy({
        ...numericByAlgorithm.common,
        ...numericByAlgorithm[model(current.profile.response)],
      }),
      algorithmDrafts: copy(algorithmDrafts),
      editorState: copy(editorState),
      canUndo: history.length > 0,
      dirty:
        !same(current, baseline) ||
        (editorState !== null &&
          baselineEditorState !== null &&
          !same(editorState, baselineEditorState)) ||
        Object.values(numericByAlgorithm).some((entries) => Object.keys(entries).length > 0),
      changes: setupDraftChanges(baseline, current),
    }),
    changes: () => setupDraftChanges(baseline, current),
    edit: (mutator) => change(mutator),
    replace: (value) => change((next) => Object.assign(next, copy(value))),
    capture: (value, raw) => {
      const captured = boundedJSON(raw, {
        maxBytes: 65536,
        maxNodes: 5000,
        maxArray: 64,
        maxDepth: 16,
      });
      let next;
      try {
        next = validate(copy(value));
      } catch {
        // Partial text belongs to the same history as the last valid values.
        // It never becomes an executable or persistable configuration.
        next = copy(current);
      }
      if (same(next, current) && same(captured, editorState)) return false;
      if (baselineEditorState === null && same(next, baseline))
        baselineEditorState = copy(captured);
      if (editorState !== null || !same(next, current)) checkpoint();
      current = copy(next);
      editorState = captured;
      algorithmDrafts[model(current.profile.response)] = copy(current.profile.response);
      generation++;
      return true;
    },
    setNumeric: (path, text) => {
      numberTarget(current, path);
      required(typeof text === 'string' && text.length <= 80, 'Numeric text is too long');
      const active = path.startsWith('profile.response.')
          ? model(current.profile.response)
          : 'common',
        pending = numericByAlgorithm[active] ?? {};
      if (pending[path] === text) return;
      checkpoint();
      numericByAlgorithm[active] = { ...pending, [path]: text };
      generation++;
    },
    commitNumeric: () => {
      const next = numericCandidate(),
        active = model(current.profile.response);
      if (!Object.keys({ ...numericByAlgorithm.common, ...numericByAlgorithm[active] }).length)
        return copy(current);
      checkpoint();
      current = next;
      delete numericByAlgorithm[active];
      delete numericByAlgorithm.common;
      algorithmDrafts[active] = copy(current.profile.response);
      generation++;
      return copy(current);
    },
    switchRateModel: (algorithm) => {
      required(['legacy', ...RATE_ALGORITHMS].includes(algorithm), 'Unsupported rate algorithm');
      if (algorithm === model(current.profile.response)) return;
      checkpoint();
      algorithmDrafts[model(current.profile.response)] = copy(current.profile.response);
      current.profile.response = copy(
        algorithmDrafts[algorithm] ??
          (algorithm === 'legacy'
            ? DEFAULT_RESPONSE
            : createTunedResponse(
                createRateProfile({
                  algorithm,
                  ...(current.profile.response.rates
                    ? { throttle: current.profile.response.rates.throttle }
                    : {}),
                }),
                current.profile.response,
              )),
      );
      detachEditedReceipt(current.profile);
      generation++;
    },
    useProfile: (profileId) => {
      const profile = library.profiles.find((item) => item.id === profileId);
      required(profile, 'Unknown rate profile');
      return change(
        (next) => {
          next.setup.profileId = profile.id;
          next.profile = {
            sourceId: profile.id,
            name: profile.name,
            response: copy(profile.response),
            ...(profile.provenance ? { provenance: copy(profile.provenance) } : {}),
          };
        },
        { clearNumeric: 'rates' },
      );
    },
    useSetup: (id) => {
      const next = selected(library, id);
      checkpoint();
      current = next;
      baseline = copy(next);
      algorithmDrafts = { [model(current.profile.response)]: copy(current.profile.response) };
      numericByAlgorithm = {};
      editorState = baselineEditorState = null;
      generation++;
    },
    useAircraft: (presetId, { setupId, rates = 'defaults' } = {}) => {
      required(stableId(setupId), 'Choose an editable setup ID');
      required(!library.setups.some((item) => item.id === setupId), 'Choose a new setup ID');
      required(
        ['defaults', 'keep'].includes(rates),
        'Choose aircraft defaults or keep current rates',
      );
      const preset = getAircraftPreset(presetId),
        configuration = createPresetConfiguration(presetId);
      return change(
        (next) => {
          next.setup = {
            id: setupId,
            name: preset.name,
            profileId: next.profile.sourceId,
            camera: configuration.camera,
            advanced: { aircraft: configuration.aircraft, controller: configuration.controller },
            preset: configuration.preset,
            components: configuration.components,
          };
          if (rates === 'defaults') {
            next.profile.name = `${preset.name} · SIM starter rates`.slice(0, 120);
            next.profile.response = configuration.response;
            delete next.profile.provenance;
          }
        },
        { clearNumeric: rates === 'defaults' ? true : 'aircraft' },
      );
    },
    undo: () => {
      if (!history.length) return false;
      ({
        current,
        baseline,
        algorithmDrafts,
        numericByAlgorithm,
        editorState,
        baselineEditorState,
      } = history.pop());
      generation++;
      return true;
    },
    revert: () => {
      checkpoint();
      current = copy(baseline);
      algorithmDrafts = { [model(current.profile.response)]: copy(current.profile.response) };
      numericByAlgorithm = {};
      editorState = copy(baselineEditorState);
      generation++;
    },
    submission: (options = {}) => {
      // Validation is read-only: a failed save cannot consume unfinished text.
      const snapshot = numericCandidate();
      return { ...snapshot, ...copy(options) };
    },
    acceptSaved: (saved, id = current.setup.id) => {
      const nextLibrary = validateTuningLibrary(saved),
        next = selected(nextLibrary, id);
      library = nextLibrary;
      sourceRevision = library.revision;
      current = next;
      baseline = copy(next);
      numericByAlgorithm = {};
      editorState = baselineEditorState = null;
      algorithmDrafts = { [model(current.profile.response)]: copy(current.profile.response) };
      history = [];
      generation++;
    },
    operationToken: () => generation,
    isCurrent: (token) => token === generation,
    invalidate: () => ++generation,
  };
  return Object.freeze(api);
}
