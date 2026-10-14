import { boundedJSON, dataIdentity, exactKeys, required } from '../data-json.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';

export const OVERFLIGHT_RECORDS_FORMAT = 'overflight-survivor-records.v1';
const finite = (value) => Number.isFinite(value) && value >= 0;
export function overflightRecordContext(run) {
  required(
    /^OverflightCompiledV[1234]$/.test(run?.compiled?.format ?? ''),
    'Survivor records need a compiled sortie.',
  );
  required(/^[a-f0-9]{16}$/.test(run.compiled.projectIdentity), 'Missing sortie identity.');
  required(
    Number.isSafeInteger(run.seed) && run.seed > 0 && run.seed <= 0xffffffff,
    'Invalid sortie seed.',
  );
  required(
    [1, 3].includes(run.airframes) && typeof run.slowResume === 'boolean',
    'Invalid sortie settings.',
  );
  return {
    mode: run.compiled.riy ? 'overflight-riy' : 'overflight',
    project: run.compiled.projectIdentity,
    balance:
      run.compiled.balanceRevision ?? `overflight-balance.v${run.compiled.rulesVersion ?? 1}`,
    seed: run.seed,
    difficulty: run.difficulty ?? run.compiled.difficulty ?? 'standard',
    airframes: run.airframes,
    slowResume: run.slowResume,
    flight: dataIdentity(
      run.flight ?? {
        id: 'balanced',
        speed: 180,
        boostSpeed: 330,
        maxHull: 100,
      },
    ),
  };
}
function resultOf(run) {
  return {
    outcome: run.phase,
    time: run.time,
    score: run.stats.kills,
    kills: run.stats.kills,
    damageTaken: run.stats.damageTaken,
    airframesLost: run.stats.airframesLost,
    upgrades: (run.progression.history ?? []).map(({ id }) => id),
    damageCauses: { ...(run.stats.damageCauses ?? {}) },
  };
}
function validateResult(value) {
  if (value === null) return;
  exactKeys(
    value,
    [
      'outcome',
      'time',
      'score',
      'kills',
      'damageTaken',
      'airframesLost',
      'upgrades',
      'damageCauses',
    ],
    'Sortie result',
  );
  required(['won', 'lost'].includes(value.outcome), 'Only finished sorties set records.');
  for (const key of ['time', 'score', 'kills', 'damageTaken', 'airframesLost'])
    required(finite(value[key]), `Invalid result ${key}.`);
  required(
    Array.isArray(value.upgrades) &&
      value.upgrades.length <= 32 &&
      value.upgrades.every((id) => typeof id === 'string' && id.length <= 100),
    'Invalid upgrade history.',
  );
  required(
    value.damageCauses &&
      typeof value.damageCauses === 'object' &&
      !Array.isArray(value.damageCauses),
    'Invalid damage causes.',
  );
  for (const [cause, amount] of Object.entries(value.damageCauses))
    required(
      ['contact', 'lane', 'fan', 'ground'].includes(cause) && finite(amount),
      'Invalid damage cause.',
    );
}
export function validateOverflightRecords(source) {
  const value = boundedJSON(source, {
    maxBytes: 512 * 1024,
    maxNodes: 30000,
    maxDepth: 7,
    maxArray: 32,
  });
  exactKeys(value, ['format', 'entries'], 'Sortie records');
  required(value.format === OVERFLIGHT_RECORDS_FORMAT, 'Unsupported sortie records.');
  required(
    value.entries &&
      typeof value.entries === 'object' &&
      !Array.isArray(value.entries) &&
      Object.keys(value.entries).length <= 256,
    'Invalid record entries.',
  );
  for (const [key, entry] of Object.entries(value.entries)) {
    exactKeys(entry, ['context', 'fastestClear', 'bestScore', 'last'], 'Sortie record');
    const context = entry.context;
    exactKeys(
      context,
      ['mode', 'project', 'balance', 'seed', 'difficulty', 'airframes', 'slowResume', 'flight'],
      'Record context',
    );
    required(
      ['overflight', 'overflight-riy'].includes(context.mode) &&
        /^[a-f0-9]{16}$/.test(context.project) &&
        /^[a-f0-9]{16}$/.test(context.flight),
      'Invalid record identity.',
    );
    required(/^overflight-balance\.v[1234]$/.test(context.balance), 'Invalid balance revision.');
    required(
      ['relaxed', 'standard', 'veteran'].includes(context.difficulty) &&
        [1, 3].includes(context.airframes) &&
        typeof context.slowResume === 'boolean',
      'Invalid record settings.',
    );
    required(
      Number.isSafeInteger(context.seed) &&
        context.seed > 0 &&
        context.seed <= 0xffffffff &&
        dataIdentity(context) === key,
      'Invalid record key.',
    );
    for (const name of ['fastestClear', 'bestScore', 'last']) validateResult(entry[name]);
    required(
      entry.fastestClear === null || entry.fastestClear.outcome === 'won',
      'A failed sortie cannot be a fastest clear.',
    );
  }
  return value;
}
/** Shared profile storage owns persistence. Review runs never write player records. */
export function createOverflightRecords({ backend, ...options } = {}) {
  const store =
    backend ??
    createProfileRecordBackend({
      key: OVERFLIGHT_RECORDS_FORMAT,
      empty: () => ({ format: OVERFLIGHT_RECORDS_FORMAT, entries: {} }),
      validate: validateOverflightRecords,
      ...options,
    });
  const pending = new Map(),
    known = new Map();
  let closed = false;
  const empty = (context) => ({
    context,
    fastestClear: null,
    bestScore: null,
    last: null,
  });
  const merge = (entry, result) => {
    const next = structuredClone(entry);
    if (!result) return next;
    next.last = result;
    if (
      !next.bestScore ||
      result.kills > next.bestScore.kills ||
      (result.kills === next.bestScore.kills && result.time < next.bestScore.time)
    )
      next.bestScore = result;
    if (result.outcome === 'won' && (!next.fastestClear || result.time < next.fastestClear.time))
      next.fastestClear = result;
    return next;
  };
  const combined = (context, saved, local) => {
    let result = saved ?? empty(context);
    for (const value of [local?.bestScore, local?.fastestClear, local?.last])
      result = merge(result, value);
    return result;
  };
  return {
    async read(run) {
      required(!closed, 'Sortie records are closed.');
      const context = overflightRecordContext(run),
        key = dataIdentity(context);
      try {
        known.set(
          key,
          validateOverflightRecords(await store.read()).entries[key] ?? empty(context),
        );
      } catch {
        return {
          ...combined(context, known.get(key), pending.get(key)),
          durable: false,
        };
      }
      return {
        ...combined(context, known.get(key), pending.get(key)),
        durable: !pending.has(key),
      };
    },
    async record(run) {
      required(
        !closed && !run.fixture && !run.review,
        'Review fixtures cannot set player records.',
      );
      const context = overflightRecordContext(run),
        key = dataIdentity(context),
        result = resultOf(run);
      validateResult(result);
      // Snapshot above before awaiting storage: retry may replace the live run.
      try {
        known.set(
          key,
          validateOverflightRecords(await store.read()).entries[key] ?? empty(context),
        );
      } catch {
        /* Keep an earlier session snapshot if storage is unavailable. */
      }
      const local = merge(combined(context, known.get(key), pending.get(key)), result);
      pending.set(key, local);
      try {
        const saved = validateOverflightRecords(
          await store.update((source) => {
            const state = validateOverflightRecords(source);
            state.entries[key] = combined(context, state.entries[key], local);
            return validateOverflightRecords(state);
          }),
        );
        known.set(key, saved.entries[key]);
        if (pending.get(key) === local) pending.delete(key);
        return { ...structuredClone(saved.entries[key]), durable: true };
      } catch {
        return {
          ...combined(context, known.get(key), pending.get(key)),
          durable: false,
        };
      }
    },
    dispose() {
      closed = true;
      known.clear();
      pending.clear();
      store.close?.();
    },
  };
}
