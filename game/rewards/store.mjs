import { JOURNEY_PROFILE_DATABASE } from '../journey/profile.mjs';
import { canonicalJSON, required, stableId } from '../data-json.mjs';
import {
  createRewardState,
  validateRewardState,
  mergeRewardStates,
  reconcileEarnedRewards,
} from './model.mjs';

function validateTimeout(value) {
  required(
    Number.isFinite(value) && value > 0,
    'Reward storage needs a positive operation timeout.',
  );
}

function boundedOperation(start, milliseconds, { signal, onAbort } = {}) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    let settled = false,
      timer;
    const clean = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancelled);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clean();
      controller.abort(error);
      try {
        onAbort?.(error);
      } catch {
        /* A failed cancellation cannot hold up recovery. */
      }
      reject(error);
    };
    const cancelled = () => fail(signal.reason ?? new Error('Reward storage was cancelled.'));
    if (signal?.aborted) {
      cancelled();
      return;
    }
    signal?.addEventListener('abort', cancelled, { once: true });
    timer = setTimeout(() => fail(new Error('Reward storage operation timed out.')), milliseconds);
    Promise.resolve()
      .then(() => {
        controller.signal.throwIfAborted();
        return start(controller.signal);
      })
      .then((value) => {
        if (settled) return;
        settled = true;
        clean();
        resolve(value);
      }, fail);
  });
}

/** A versioned sidecar in the existing Journey database. The profile and its
 * historical backup formats remain unchanged; this never writes arcade clears. */
export function createRewardBackend({
  editionId,
  indexedDB = globalThis.indexedDB,
  canWrite = () => true,
  operationTimeoutMs = 1500,
} = {}) {
  required(stableId(editionId), 'Rewards require a logical edition identity.');
  const key = `journey-${editionId}:rewards.v1`;
  required(typeof canWrite === 'function', 'Rewards require a write guard.');
  validateTimeout(operationTimeoutMs);
  let opening = null,
    connection = null,
    closed = false;
  const open = () => {
    required(!closed, 'Reward storage is closed.');
    required(indexedDB, 'Reward storage is unavailable.');
    if (connection) return Promise.resolve(connection);
    if (opening) return opening.promise;
    const attempt = { promise: null, failed: false, cancel: null };
    opening = attempt;
    attempt.promise = new Promise((resolve, reject) => {
      const fail = (error) => {
        attempt.failed = true;
        if (opening === attempt) opening = null;
        reject(error ?? new Error('Reward storage could not be opened.'));
      };
      attempt.cancel = fail;
      let request;
      try {
        request = indexedDB.open(JOURNEY_PROFILE_DATABASE, 1);
      } catch (error) {
        fail(error);
        return;
      }
      request.onupgradeneeded = () => {
        if (closed || attempt.failed) {
          request.transaction?.abort();
          return;
        }
        if (!request.result.objectStoreNames.contains('profiles'))
          request.result.createObjectStore('profiles');
      };
      request.onsuccess = () => {
        const db = request.result;
        if (attempt.failed || closed) {
          db.close();
          return;
        }
        connection = db;
        if (opening === attempt) opening = null;
        db.onversionchange = () => {
          db.close();
          if (connection === db) connection = null;
        };
        resolve(db);
      };
      request.onerror = () => fail(request.error);
      request.onblocked = () => fail(new Error('Reward storage is busy in another tab.'));
    });
    return attempt.promise;
  };
  function transaction(update, { signal } = {}) {
    let tx, pendingOpen;
    return boundedOperation(
      async (boundedSignal) => {
        if (update) required(canWrite(), 'This tab does not own the saving lease.');
        const openingPromise = open();
        pendingOpen = opening;
        const db = await openingPromise;
        pendingOpen = null;
        boundedSignal.throwIfAborted();
        required(!closed, 'Reward storage is closed.');
        if (update) required(canWrite(), 'This tab does not own the saving lease.');
        return new Promise((resolve, reject) => {
          tx = db.transaction('profiles', update ? 'readwrite' : 'readonly');
          const store = tx.objectStore('profiles'),
            request = store.get(key);
          let state, failure;
          request.onsuccess = () => {
            try {
              boundedSignal.throwIfAborted();
              state =
                request.result === undefined
                  ? createRewardState(editionId)
                  : validateRewardState(request.result, { editionId });
              if (update) {
                required(canWrite(), 'This tab does not own the saving lease.');
                state = validateRewardState(update(state), { editionId });
                boundedSignal.throwIfAborted();
                store.put(state, key);
              }
            } catch (error) {
              failure = error;
              try {
                tx.abort();
              } catch {
                /* A timed-out transaction is already inactive. */
              }
            }
          };
          tx.oncomplete = () => resolve(state);
          tx.onerror = tx.onabort = () =>
            reject(failure ?? tx.error ?? new Error('Rewards could not be saved.'));
        });
      },
      operationTimeoutMs,
      {
        signal,
        onAbort(error) {
          if (pendingOpen && opening === pendingOpen) pendingOpen.cancel(error);
          if (tx) {
            try {
              tx.abort();
            } catch {
              /* The transaction may already have completed. */
            }
          }
        },
      },
    );
  }
  return {
    key,
    read: (options) => transaction(null, options),
    update: transaction,
    close() {
      if (closed) return;
      closed = true;
      opening?.cancel(new Error('Reward storage is closed.'));
      connection?.close();
      connection = null;
    },
  };
}

/** Local collectible access only. Eligibility always comes from the host's
 * accepted evidence; this is neither a completion store nor a coupon issuer. */
export function createRewardStore({
  editionId,
  backend,
  onStatus = () => {},
  operationTimeoutMs = 1500,
}) {
  validateTimeout(operationTimeoutMs);
  let state = createRewardState(editionId),
    eligible = state,
    durable = false,
    error = null;
  let queue = Promise.resolve(),
    closed = false,
    closing = null,
    pendingOperations = 0;
  const snapshot = () => structuredClone(state);
  const status = () => ({
    durable,
    pending: pendingOperations > 0,
    error: error?.message ?? null,
  });
  const announce = () => {
    if (closed) return;
    try {
      onStatus(status());
    } catch {
      /* Observers never own persistence. */
    }
  };
  const save = () => {
    required(!closed, 'Reward store is closed.');
    // Session-only discoveries must not leak through a later retry or unrelated save.
    const pending = eligible;
    durable = false;
    pendingOperations++;
    queue = queue.then(async () => {
      try {
        const saved = validateRewardState(
          await boundedOperation(
            (signal) =>
              backend.update(
                (current) => {
                  signal.throwIfAborted();
                  return mergeRewardStates(current, pending, { editionId });
                },
                { signal },
              ),
            operationTimeoutMs,
          ),
          { editionId },
        );
        eligible = mergeRewardStates(saved, eligible, { editionId });
        state = mergeRewardStates(saved, state);
        durable = canonicalJSON(saved) === canonicalJSON(state);
        error = null;
      } catch (failure) {
        error = failure;
        durable = false;
      } finally {
        pendingOperations--;
      }
      announce();
      return status();
    });
    announce();
    return queue;
  };
  return {
    snapshot,
    status,
    load() {
      required(!closed, 'Reward store is closed.');
      pendingOperations++;
      queue = queue.then(async () => {
        try {
          const saved = validateRewardState(
            await boundedOperation((signal) => backend.read({ signal }), operationTimeoutMs),
            { editionId },
          );
          eligible = mergeRewardStates(saved, eligible, { editionId });
          state = mergeRewardStates(saved, state, { editionId });
          durable = canonicalJSON(saved) === canonicalJSON(state);
          error = null;
        } catch (failure) {
          error = failure;
          durable = false;
        } finally {
          pendingOperations--;
        }
        announce();
        return snapshot();
      });
      announce();
      return queue;
    },
    reconcile(definitions, context, { persist = true, persistenceContext = context } = {}) {
      required(!closed, 'Reward store is closed.');
      required(context.editionId === editionId, 'Reward evidence belongs to another edition.');
      required(
        persistenceContext.editionId === editionId,
        'Durable reward evidence belongs to another edition.',
      );
      const before = canonicalJSON(state);
      const result = reconcileEarnedRewards(definitions, context, state);
      state = result.state;
      const beforeEligible = canonicalJSON(eligible);
      if (persist) {
        // Keep the promised revision, but recompute session receipts against this
        // invocation's accepted durable evidence before they become save-eligible.
        const ids = new Set(definitions.map((definition) => definition.id));
        const promised = {
          ...createRewardState(editionId),
          promises: state.promises.filter((definition) => ids.has(definition.id)),
        };
        eligible = reconcileEarnedRewards(
          definitions,
          persistenceContext,
          mergeRewardStates(eligible, promised, { editionId }),
        ).state;
      }
      if (before !== canonicalJSON(state) || beforeEligible !== canonicalJSON(eligible)) {
        durable = false;
        if (persist) void save();
        else announce();
      } else if (persist && !durable && error) {
        void save();
      }
      return result;
    },
    async restore(input) {
      required(!closed, 'Reward store is closed.');
      const restored = validateRewardState(input, { editionId });
      state = mergeRewardStates(state, restored);
      eligible = mergeRewardStates(eligible, {
        ...createRewardState(editionId),
        promises: state.promises,
      });
      eligible = mergeRewardStates(eligible, restored);
      return save();
    },
    export() {
      return JSON.stringify(snapshot());
    },
    flush: save,
    settled: () => closing ?? queue,
    close() {
      if (closing) return closing;
      closed = true;
      // Already queued writes must finish before releasing this connection.
      closing = queue.then(async () => {
        try {
          await boundedOperation(() => backend.close?.(), operationTimeoutMs);
        } catch (failure) {
          error = failure;
        }
        return status();
      });
      return closing;
    },
  };
}
