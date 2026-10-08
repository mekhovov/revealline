import { boundedJSON, dataIdentity, exactKeys, required } from '../data-json.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';

export const OVERFLIGHT_HUNT_RECORDS_FORMAT = 'overflight-hunt-records.v2';
export const OVERFLIGHT_HUNT_LEGACY_RECORDS_FORMAT = 'overflight-hunt-records.v1';
export const OVERFLIGHT_HUNT_RECORD_RULES = 'overflight-raid.v2';
const legacyRules = 'overflight-raid.v1';
const versionOf = (run) => (run?.compiled?.format === 'OverflightHuntCompiledV2' ? 2 : 1);
const finite = (value) => Number.isFinite(value) && value >= 0;

export function overflightHuntRecordContext(run) {
  required(
    ['OverflightHuntCompiledV1', 'OverflightHuntCompiledV2'].includes(run?.compiled?.format),
    'Raid records need a compiled hunt.',
  );
  required(/^[a-f0-9]{16}$/.test(run.compiled.projectIdentity), 'Missing Raid content identity.');
  required(
    Number.isSafeInteger(run.seed) && run.seed > 0 && run.seed <= 0xffffffff,
    'Invalid Raid seed.',
  );
  required(
    [1, 3].includes(run.airframes) && typeof run.slowResume === 'boolean',
    'Invalid Raid settings.',
  );
  return {
    rules: versionOf(run) === 2 ? OVERFLIGHT_HUNT_RECORD_RULES : legacyRules,
    project: run.compiled.projectIdentity,
    seed: run.seed,
    airframes: run.airframes,
    slowResume: run.slowResume,
    ...(versionOf(run) === 2
      ? { difficulty: run.difficulty ?? run.compiled.difficulty ?? 'standard' }
      : {}),
  };
}

function validateResult(result) {
  if (result === null) return;
  exactKeys(
    result,
    [
      'outcome',
      'time',
      'score',
      'kills',
      'bestChain',
      'damageTaken',
      'couriersCaught',
      'couriersEscaped',
    ],
    'Raid record',
  );
  required(['won', 'lost'].includes(result.outcome), 'Only completed Raid attempts are records.');
  for (const key of [
    'time',
    'score',
    'kills',
    'bestChain',
    'damageTaken',
    'couriersCaught',
    'couriersEscaped',
  ])
    required(finite(result[key]), `Invalid Raid record ${key}.`);
}

function validateRecords(source, version) {
  const format =
    version === 2 ? OVERFLIGHT_HUNT_RECORDS_FORMAT : OVERFLIGHT_HUNT_LEGACY_RECORDS_FORMAT;
  const state = boundedJSON(source, {
    maxBytes: 256 * 1024,
    maxNodes: 18000,
    maxDepth: 6,
    maxArray: 16,
  });
  exactKeys(state, ['format', 'entries'], 'Raid records');
  required(state.format === format, 'Unsupported Raid records.');
  required(
    state.entries && !Array.isArray(state.entries) && typeof state.entries === 'object',
    'Invalid Raid record entries.',
  );
  required(Object.keys(state.entries).length <= 256, 'Raid record storage is full.');
  for (const [key, entry] of Object.entries(state.entries)) {
    required(/^[a-f0-9]{16}$/.test(key), 'Invalid Raid record key.');
    exactKeys(entry, ['context', 'fastestClear', 'bestScore', 'last'], 'Raid records entry');
    exactKeys(
      entry.context,
      [
        'rules',
        'project',
        'seed',
        'airframes',
        'slowResume',
        ...(version === 2 ? ['difficulty'] : []),
      ],
      'Raid record context',
    );
    required(
      entry.context.rules === (version === 2 ? OVERFLIGHT_HUNT_RECORD_RULES : legacyRules),
      'Unsupported Raid record rules.',
    );
    required(/^[a-f0-9]{16}$/.test(entry.context.project), 'Invalid Raid project identity.');
    required(
      Number.isSafeInteger(entry.context.seed) &&
        entry.context.seed > 0 &&
        entry.context.seed <= 0xffffffff,
      'Invalid Raid record seed.',
    );
    required(
      [1, 3].includes(entry.context.airframes) && typeof entry.context.slowResume === 'boolean',
      'Invalid Raid record settings.',
    );
    if (version === 2)
      required(
        ['standard', 'veteran'].includes(entry.context.difficulty),
        'Invalid Raid difficulty.',
      );
    required(dataIdentity(entry.context) === key, 'Raid record identity differs.');
    for (const field of ['fastestClear', 'bestScore', 'last']) validateResult(entry[field]);
    required(
      entry.fastestClear === null || entry.fastestClear.outcome === 'won',
      'A failed Raid cannot be a fastest clear.',
    );
  }
  return state;
}

function resultOf(run) {
  const result = {
    outcome: run.phase,
    time: run.time,
    score: run.hunt.score,
    kills: run.stats.kills,
    bestChain: run.hunt.bestChain,
    damageTaken: run.stats.damageTaken,
    couriersCaught: run.hunt.couriersCaught,
    couriersEscaped: run.hunt.couriersEscaped,
  };
  validateResult(result);
  return result;
}

/** The existing profile database owns persistence; cosmetic appearance never
 * separates competitive records. Failed writes retain a clearly session-only result. */
function createRecordStore({ backend, version, ...options }) {
  const format =
    version === 2 ? OVERFLIGHT_HUNT_RECORDS_FORMAT : OVERFLIGHT_HUNT_LEGACY_RECORDS_FORMAT;
  const validate = (source) => validateRecords(source, version);
  const empty = () => ({ format, entries: {} });
  const store =
    backend ??
    createProfileRecordBackend({
      key: format,
      empty,
      validate,
      ...options,
    });
  const session = new Map();
  const known = new Map();
  let closed = false;
  const contextEntry = (context) => ({ context, fastestClear: null, bestScore: null, last: null });
  const combine = (previous, context, result) => {
    const entry = structuredClone(previous ?? contextEntry(context));
    if (!result) return entry;
    entry.last = result;
    if (
      !entry.bestScore ||
      result.score > entry.bestScore.score ||
      (result.score === entry.bestScore.score && result.time < entry.bestScore.time)
    )
      entry.bestScore = result;
    if (
      result.outcome === 'won' &&
      (!entry.fastestClear ||
        result.time < entry.fastestClear.time ||
        (result.time === entry.fastestClear.time && result.score > entry.fastestClear.score))
    )
      entry.fastestClear = result;
    return entry;
  };
  const project = (entry, durable, error = '') => ({ ...structuredClone(entry), durable, error });
  const merge = (saved, pending, context) => {
    let entry = saved ?? contextEntry(context);
    for (const result of [pending?.bestScore, pending?.fastestClear, pending?.last])
      entry = combine(entry, context, result);
    return entry;
  };
  return {
    async read(run) {
      required(!closed, 'Raid records are closed.');
      const context = overflightHuntRecordContext(run),
        key = dataIdentity(context);
      try {
        const state = validate(await store.read());
        const saved = state.entries[key] ?? contextEntry(context);
        known.set(key, saved);
        const pending = session.get(key);
        return project(merge(saved, pending, context), !pending);
      } catch (error) {
        return project(merge(known.get(key), session.get(key), context), false, error.message);
      }
    },
    async record(run) {
      required(!closed, 'Raid records are closed.');
      required(!run.fixture && !run.review, 'Review fixtures cannot set player records.');
      // Snapshot before awaiting storage: Retry may replace the active run.
      const context = overflightHuntRecordContext(run),
        key = dataIdentity(context),
        result = resultOf(run);
      const pending = combine(merge(known.get(key), session.get(key), context), context, result);
      session.set(key, pending);
      try {
        const state = await store.update((source) => {
          const state = validate(source);
          known.set(key, state.entries[key] ?? contextEntry(context));
          state.entries[key] = merge(state.entries[key], pending, context);
          return validate(state);
        });
        if (session.get(key) === pending) session.delete(key);
        known.set(key, validate(state).entries[key]);
        return project(validate(state).entries[key], true);
      } catch (error) {
        try {
          known.set(key, validate(await store.read()).entries[key] ?? contextEntry(context));
        } catch {
          // A write and read can both fail; keep the last successfully observed history.
        }
        return project(merge(known.get(key), pending, context), false, error.message);
      }
    },
    dispose() {
      closed = true;
      session.clear();
      known.clear();
      store.close?.();
    },
  };
}

/** Rules revisions have independent durable buckets. Loading a revised sortie never
 * rewrites old history, and historical projects can still read their exact records. */
export function createOverflightHuntRecords({ backend, legacyBackend, ...options } = {}) {
  const current = createRecordStore({ ...options, backend, version: 2 });
  const legacy = createRecordStore({ ...options, backend: legacyBackend ?? backend, version: 1 });
  const storeFor = (run) => (versionOf(run) === 2 ? current : legacy);
  return {
    read: (run) => storeFor(run).read(run),
    record: (run) => storeFor(run).record(run),
    dispose() {
      current.dispose();
      legacy.dispose();
    },
  };
}
