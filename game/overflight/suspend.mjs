import { boundedJSON, exactKeys, required } from '../data-json.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';
import {
  OVERFLIGHT_CHECKPOINT_MAX_BYTES,
  decodeOverflightCheckpoint,
  encodeOverflightCheckpoint,
  validateSurvivalAttemptId,
  validateSurvivalPackageIdentity,
} from './checkpoint.mjs';

export const SURVIVAL_SUSPEND_FORMAT = 'overflight-suspend.v1';
export const SURVIVAL_SUSPEND_WRITER = `${SURVIVAL_SUSPEND_FORMAT}.writer`;
const empty = () => ({
  format: SURVIVAL_SUSPEND_FORMAT,
  revision: 0,
  phase: 'empty',
  attemptId: null,
  checkpoint: null,
});
export function validateSurvivalSuspend(source) {
  const state = boundedJSON(source, {
    maxBytes: OVERFLIGHT_CHECKPOINT_MAX_BYTES * 2 + 4096,
    maxNodes: 16,
    maxDepth: 2,
    maxString: OVERFLIGHT_CHECKPOINT_MAX_BYTES,
  });
  exactKeys(
    state,
    ['format', 'revision', 'phase', 'attemptId', 'checkpoint'],
    'Saved Survival flight',
  );
  required(
    state.format === SURVIVAL_SUSPEND_FORMAT &&
      Number.isSafeInteger(state.revision) &&
      state.revision >= 0,
    'Invalid saved flight revision.',
  );
  required(
    ['empty', 'saved', 'finishing', 'consumed'].includes(state.phase),
    'Invalid saved flight phase.',
  );
  if (state.phase === 'empty')
    required(state.attemptId === null && state.checkpoint === null, 'Invalid empty saved flight.');
  else {
    validateSurvivalAttemptId(state.attemptId);
    if (state.phase === 'consumed')
      required(state.checkpoint === null, 'A completed recovery cannot be resumed.');
    else
      required(
        typeof state.checkpoint === 'string' &&
          state.checkpoint.length > 0 &&
          new TextEncoder().encode(state.checkpoint).byteLength <= OVERFLIGHT_CHECKPOINT_MAX_BYTES,
        'Invalid saved flight checkpoint.',
      );
  }
  return state;
}

/** One recoverable slot and a durable completion journal. Records and mastery
 * commit separately with their own atomic receipts; this slot is retired only
 * after both acknowledge durable ownership. No storage failure consumes a save. */
export function createSurvivalSuspend({
  packageIdentity,
  records,
  mastery,
  backend,
  canWrite = () => false,
  randomUUID = () => globalThis.crypto.randomUUID(),
  ...options
} = {}) {
  const identity = Object.freeze({ ...validateSurvivalPackageIdentity(packageIdentity) });
  const store =
    backend ??
    createProfileRecordBackend({
      key: SURVIVAL_SUSPEND_FORMAT,
      empty,
      validate: validateSurvivalSuspend,
      canWrite,
      ...options,
    });
  const owners = new WeakMap(),
    candidates = new WeakMap();
  let closed = false,
    busy = false,
    current = null;
  const allowed = () => {
    required(!closed, 'Saved flight storage is closed.');
    required(
      canWrite(),
      'This tab does not own saved flights. Reload after closing the other game tab.',
    );
  };
  const exclusive = async (work) => {
    allowed();
    required(!busy, 'A saved flight operation is already in progress.');
    busy = true;
    try {
      return await work();
    } finally {
      busy = false;
    }
  };
  const read = async () => {
    required(!closed, 'Saved flight storage is closed.');
    current = validateSurvivalSuspend(await store.read());
    return structuredClone(current);
  };
  const update = async (expected, change) => {
    allowed();
    const next = await store.update((source) => {
      allowed();
      const state = validateSurvivalSuspend(source);
      required(
        state.revision === expected,
        'The saved flight changed. Reload its status before trying again.',
      );
      required(state.revision < Number.MAX_SAFE_INTEGER, 'Saved flight revision is exhausted.');
      return { ...change(state), revision: state.revision + 1 };
    });
    current = validateSurvivalSuspend(next);
    return current;
  };
  const settle = async (run, owner) => {
    const state = await read();
    required(
      state.attemptId === owner.attemptId && ['finishing', 'consumed'].includes(state.phase),
      'This saved attempt no longer owns its result.',
    );
    // Once journaled, its admitted immutable snapshot owns the result. A later
    // host refresh cannot change the payload between the two durable stores.
    let resultRun = run;
    if (state.phase === 'finishing') {
      const journal = decodeOverflightCheckpoint(state.checkpoint, {
        packageIdentity: identity,
        terminal: true,
      });
      required(journal.attemptId === owner.attemptId, 'Saved result ownership differs.');
      resultRun = journal.run;
    }
    allowed();
    const record = await records.record(resultRun, { attemptId: owner.attemptId });
    required(
      record?.durable === true,
      'The flight record has not been saved. Retry result recovery.',
    );
    allowed();
    const report = await mastery.record(resultRun, { attemptId: owner.attemptId });
    required(report?.durable === true, 'World mastery has not been saved. Retry result recovery.');
    if (state.phase !== 'consumed')
      await update(state.revision, (value) => ({ ...value, phase: 'consumed', checkpoint: null }));
    return { records: record, mastery: report };
  };
  return {
    read,
    owns: (run) => owners.has(run),
    get busy() {
      return busy;
    },
    async save(run, project, { settings, replace = false } = {}) {
      return exclusive(async () => {
        required(run?.phase === 'paused', 'Pause the flight before saving.');
        const owner = owners.get(run) ?? {
          attemptId: validateSurvivalAttemptId(randomUUID()),
          project: structuredClone(project),
          settings: settings ? structuredClone(settings) : undefined,
        };
        const checkpoint = encodeOverflightCheckpoint({
          run,
          project,
          settings,
          packageIdentity: identity,
          attemptId: owner.attemptId,
        });
        const observed = current ?? (await read());
        const saved = await update(observed.revision, (state) => {
          required(
            state.phase !== 'finishing',
            'Finish recovering the previous result before replacing this save.',
          );
          required(
            state.phase !== 'consumed' || state.attemptId !== owner.attemptId,
            'A completed attempt cannot become a saved flight again.',
          );
          required(
            state.phase !== 'saved' || state.attemptId === owner.attemptId || replace,
            'Confirm replacing the saved flight.',
          );
          return { ...state, phase: 'saved', attemptId: owner.attemptId, checkpoint };
        });
        owners.set(run, owner);
        return structuredClone(saved);
      });
    },
    async prepareRestore() {
      return exclusive(async () => {
        const state = await read();
        required(state.phase === 'saved', 'No resumable flight is saved.');
        const restored = decodeOverflightCheckpoint(state.checkpoint, {
          packageIdentity: identity,
        });
        required(restored.attemptId === state.attemptId, 'Saved flight ownership differs.');
        candidates.set(restored, state.revision);
        return restored;
      });
    },
    async admitRestore(restored) {
      return exclusive(async () => {
        const expected = candidates.get(restored);
        required(expected !== undefined, 'The saved flight has not been prepared.');
        const state = await read();
        required(
          state.revision === expected &&
            state.phase === 'saved' &&
            state.attemptId === restored.attemptId,
          'The saved flight changed before restore.',
        );
        allowed();
        owners.set(restored.run, {
          attemptId: restored.attemptId,
          project: structuredClone(restored.project),
          settings: structuredClone(restored.settings),
        });
        candidates.delete(restored);
        return restored.run;
      });
    },
    async finish(run) {
      return exclusive(async () => {
        const owner = owners.get(run);
        required(
          owner && ['won', 'lost'].includes(run.phase),
          'Only this saved flight can recover its result.',
        );
        const state = await read();
        required(
          state.attemptId === owner.attemptId && state.phase !== 'empty',
          'This saved attempt no longer owns its result.',
        );
        if (state.phase === 'saved') {
          const checkpoint = encodeOverflightCheckpoint({
            run,
            project: owner.project,
            settings: owner.settings,
            packageIdentity: identity,
            attemptId: owner.attemptId,
          });
          await update(state.revision, (value) => ({ ...value, phase: 'finishing', checkpoint }));
        }
        return settle(run, owner);
      });
    },
    async recoverResults() {
      return exclusive(async () => {
        const state = await read();
        required(state.phase === 'finishing', 'No flight result needs recovery.');
        const restored = decodeOverflightCheckpoint(state.checkpoint, {
          packageIdentity: identity,
          terminal: true,
        });
        required(restored.attemptId === state.attemptId, 'Saved result ownership differs.');
        const owner = {
          attemptId: restored.attemptId,
          project: structuredClone(restored.project),
          settings: structuredClone(restored.settings),
        };
        owners.set(restored.run, owner);
        return { run: restored.run, ...(await settle(restored.run, owner)) };
      });
    },
    close() {
      closed = true;
      store.close?.();
    },
  };
}
