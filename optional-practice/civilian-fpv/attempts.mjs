import { boundedJSON, canonicalJSON, exactKeys, required } from '../../game/data-json.mjs';
import { createProfileRecordBackend } from '../../game/profile-storage.mjs';
import { replayFlightCooperatively } from './model.mjs';
export const FLIGHT_EDITION_ID = 'civilian-fpv';
const PREFIX = 'practice-civilian-fpv:';
const HASH = /^[a-f0-9]{64}$/;
function validateIndex(input) {
  const value = boundedJSON(input, { maxBytes: 16384, maxNodes: 300, maxArray: 128, maxDepth: 3 });
  exactKeys(value, ['format', 'attemptIds'], 'flight attempt index');
  required(
    value.format === 'FlightAttemptIndex.v1' &&
      Array.isArray(value.attemptIds) &&
      value.attemptIds.length <= 128 &&
      value.attemptIds.every((id) => HASH.test(id)) &&
      new Set(value.attemptIds).size === value.attemptIds.length,
    'Invalid flight attempt index',
  );
  return value;
}
const emptyIndex = () => ({ format: 'FlightAttemptIndex.v1', attemptIds: [] });
const validateRecord = (input) => {
  if (input === null) return null;
  const value = boundedJSON(input, {
    maxBytes: 1024 * 1024 + 1024,
    maxNodes: 220000,
    maxArray: 36000,
    maxDepth: 10,
  });
  exactKeys(value, ['format', 'proof'], 'stored flight proof');
  required(value.format === 'StoredFlightAttempt.v1', 'Unsupported stored flight proof');
  return value;
};
export async function verifyFlightAttempt(
  courses,
  input,
  { crypto = globalThis.crypto, signal, yieldControl } = {},
) {
  signal?.throwIfAborted();
  const proof = boundedJSON(input, {
    maxBytes: 1024 * 1024,
    maxNodes: 220000,
    maxArray: 36000,
    maxDepth: 8,
  });
  required(
    proof.session === 'practice',
    'Demonstration, replay and authoring sessions cannot earn',
  );
  const course = courses.find((item) => item.id === proof.course);
  required(course, 'Exact flight course unavailable');
  const result = await replayFlightCooperatively(course, proof, { signal, yieldControl });
  required(result.state.status === 'complete', 'Incomplete flight attempt');
  required(crypto?.subtle, 'Proof digest capability unavailable');
  const hash = [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJSON(proof))),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  signal?.throwIfAborted();
  return {
    hash,
    proof,
    record: { ...result.identity, attemptId: `fpv-${hash}` },
    summary: {
      ticks: result.state.ticks,
      contacts: result.state.contacts,
      landingSpeed: result.state.landingSpeed,
      heightRange: result.state.heightRange,
    },
  };
}
/** Only transcript keys are indexed. Receipts and transcripts occupy separate
 * records in the existing profiles database. Import always replays; no flag grants. */
export function createFlightAttemptStore({
  courses,
  indexedDB = globalThis.indexedDB,
  verify = verifyFlightAttempt,
  onStatus = () => {},
}) {
  const index = createProfileRecordBackend({
    key: PREFIX + 'attempts.v1',
    empty: emptyIndex,
    validate: validateIndex,
    indexedDB,
  });
  const accepted = new Map(),
    durable = new Set(),
    recoveryErrors = new Map(),
    lifetime = new AbortController();
  let closed = false,
    broken = false,
    error = null,
    queue = Promise.resolve();
  const report = () => {
    const status = {
      saved: !broken && !recoveryErrors.size && accepted.size === durable.size,
      error: error ?? recoveryErrors.values().next().value ?? null,
      unavailable: broken,
    };
    try {
      if (!closed) onStatus(status);
    } catch {
      /* Observers cannot poison storage. */
    }
    return status;
  };
  async function recordBackend(hash, operation) {
    const backend = createProfileRecordBackend({
      key: PREFIX + hash,
      empty: () => null,
      validate: validateRecord,
      indexedDB,
    });
    try {
      return await operation(backend);
    } finally {
      backend.close();
    }
  }
  const persist = async (value, signal) => {
    signal.throwIfAborted();
    required(!closed && !broken, 'Flight storage unavailable; export the session to recover');
    await recordBackend(value.hash, async (backend) =>
      backend.update(
        (current) => {
          if (current)
            required(
              canonicalJSON(current.proof) === canonicalJSON(value.proof),
              'Conflicting exact flight proof',
            );
          return { format: 'StoredFlightAttempt.v1', proof: value.proof };
        },
        { signal },
      ),
    );
    signal.throwIfAborted();
    await index.update(
      (current) =>
        validateIndex({
          format: current.format,
          attemptIds: [...new Set([...current.attemptIds, value.hash])],
        }),
      { signal },
    );
    signal.throwIfAborted();
    durable.add(value.hash);
    recoveryErrors.delete(value.hash);
  };
  const enqueue = (fn, { signal: externalSignal } = {}) => {
    const controller = new AbortController(),
      signal = controller.signal,
      parents = [lifetime.signal, externalSignal].filter(Boolean),
      releases = [];
    for (const parent of parents) {
      const abort = () => controller.abort(parent.reason);
      if (parent.aborted) abort();
      else {
        parent.addEventListener('abort', abort, { once: true });
        releases.push(() => parent.removeEventListener('abort', abort));
      }
    }
    // Reject queued/cancelled callers immediately. An already running native
    // digest may settle later, but every subsequent mutation checks this signal.
    const operation = new Promise((resolve, reject) => {
      const abort = () =>
        reject(signal.reason ?? new DOMException('Flight operation cancelled', 'AbortError'));
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener('abort', abort, { once: true });
      releases.push(() => signal.removeEventListener('abort', abort));
      queue
        .then(() => {
          signal.throwIfAborted();
          required(!closed, 'Flight storage is closed');
          return fn(signal);
        })
        .then(resolve, reject);
    });
    const result = operation.finally(() => {
      for (const release of releases) release();
    });
    queue = result.catch(() => {});
    return result;
  };
  const hydrate = async (signal) => {
    let state;
    try {
      state = await index.read({ signal });
    } catch (failure) {
      signal.throwIfAborted();
      broken = true;
      error = failure.message;
      return report();
    }
    // Re-open/revalidate the index before a retry can write. Corrupt indexes
    // remain blocked; no failed read is replaced with an empty archive.
    broken = false;
    error = null;
    for (const hash of state.attemptIds) {
      try {
        signal.throwIfAborted();
        const stored = await recordBackend(hash, (backend) => backend.read({ signal }));
        required(stored, 'Saved flight proof missing');
        const verified = await verify(courses, stored.proof, { signal });
        signal.throwIfAborted();
        required(verified.hash === hash, 'Saved proof digest differs');
        required(
          accepted.has(hash) || accepted.size < 128,
          'Flight archive capacity reached; keep this export',
        );
        accepted.set(hash, verified);
        durable.add(hash);
        recoveryErrors.delete(hash);
      } catch (failure) {
        signal.throwIfAborted();
        durable.delete(hash);
        recoveryErrors.set(hash, failure.message);
      }
    }
    return report();
  };
  return {
    load: (options) => enqueue(hydrate, options),
    accept: (input, options) =>
      enqueue(async (signal) => {
        const value = await verify(courses, input, { signal });
        signal.throwIfAborted();
        required(
          accepted.has(value.hash) || accepted.size < 128,
          'Flight archive capacity reached; keep this export',
        );
        accepted.set(value.hash, value);
        try {
          await persist(value, signal);
          error = null;
        } catch (failure) {
          signal.throwIfAborted();
          error = failure.message;
        }
        report();
        return { ...structuredClone(value), saved: durable.has(value.hash) };
      }, options),
    records: () => [...accepted.values()].map((value) => ({ ...value.record })),
    durableRecords: () =>
      [...accepted.values()]
        .filter((value) => durable.has(value.hash))
        .map((value) => ({ ...value.record })),
    summaries: () =>
      [...accepted.values()].map((value) => ({
        hash: value.hash,
        ...value.record,
        ...structuredClone(value.summary),
        saved: durable.has(value.hash),
      })),
    proof: (hash) => (accepted.has(hash) ? structuredClone(accepted.get(hash).proof) : null),
    status: report,
    export: () => ({
      format: 'FlightProofBackup.v1',
      packageId: FLIGHT_EDITION_ID,
      attempts: [...accepted.values()].map((value) => structuredClone(value.proof)),
    }),
    import: (input, options) =>
      enqueue(async (signal) => {
        const value = boundedJSON(input, {
          maxBytes: 32 * 1024 * 1024,
          maxNodes: 7000000,
          maxArray: 36000,
          maxDepth: 10,
        });
        exactKeys(value, ['format', 'packageId', 'attempts'], 'flight proof backup');
        required(
          value.format === 'FlightProofBackup.v1' &&
            value.packageId === FLIGHT_EDITION_ID &&
            Array.isArray(value.attempts) &&
            value.attempts.length <= 128,
          'Invalid flight backup',
        );
        // Verify the entire transfer before changing either memory or disk.
        const candidates = [];
        for (const proof of value.attempts) {
          signal.throwIfAborted();
          candidates.push(await verify(courses, proof, { signal }));
        }
        signal.throwIfAborted();
        required(
          new Set([...accepted.keys(), ...candidates.map((item) => item.hash)]).size <= 128,
          'Flight archive capacity reached; keep this export',
        );
        for (const candidate of candidates) {
          signal.throwIfAborted();
          accepted.set(candidate.hash, candidate);
          try {
            await persist(candidate, signal);
            error = null;
          } catch (failure) {
            signal.throwIfAborted();
            error = failure.message;
          }
        }
        return report();
      }, options),
    retry: (options) =>
      enqueue(async (signal) => {
        if (broken || recoveryErrors.size) {
          await hydrate(signal);
          if (broken) return report();
        }
        for (const value of accepted.values())
          if (!durable.has(value.hash)) {
            try {
              await persist(value, signal);
              error = null;
            } catch (failure) {
              signal.throwIfAborted();
              error = failure.message;
            }
          }
        return report();
      }, options),
    async close() {
      if (closed) return;
      closed = true;
      lifetime.abort(new DOMException('Flight storage is closed', 'AbortError'));
      index.close();
      await queue;
    },
  };
}
