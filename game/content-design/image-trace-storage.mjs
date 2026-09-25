import { requireAuthoring, describeAuthoringError } from './authoring-error.mjs';
import { exactKeys, stableId } from '../data-json.mjs';
import { readImageTrace } from './image-trace.mjs';

export const IMAGE_TRACE_DATABASE = 'revealline-content-image-traces-v1';
const validRevision = (value) => Number.isSafeInteger(value) && value > 0;
function key(projectId, missionId) {
  requireAuthoring(
    stableId(projectId) && stableId(missionId),
    'Invalid tracing storage owner.',
    'errors:studio.trace.storageOwner',
  );
  return `${projectId}/${missionId}`;
}
function entry(value, projectId, missionId) {
  if (value === undefined) return { revision: null, trace: null };
  exactKeys(value, ['revision', 'trace'], 'stored tracing draft');
  requireAuthoring(
    validRevision(value.revision),
    'Invalid stored tracing revision.',
    'errors:studio.trace.savedRevision',
  );
  const trace = value.trace === null ? null : readImageTrace(value.trace);
  requireAuthoring(
    trace === null || (trace.projectId === projectId && trace.missionId === missionId),
    'Stored tracing ownership mismatch.',
    'errors:studio.trace.storedOwnerMismatch',
  );
  return { revision: value.revision, trace };
}

/** Independent local-only store. A compare-and-swap transaction prevents another
 * tab's draft being overwritten; tombstones retain that protection after clear.
 * Published content, project checkpoints and player progress are not touched. */
export function createImageTraceBackend({
  indexedDB = globalThis.indexedDB,
  timeoutMs = 1500,
} = {}) {
  requireAuthoring(
    Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 10000,
    'Invalid trace timeout.',
    'errors:studio.trace.timeoutValue',
  );
  let opening;
  function open() {
    if (!indexedDB)
      return Promise.reject(
        describeAuthoringError(
          new Error('Tracing storage is unavailable.'),
          'errors:studio.trace.storageUnavailable',
        ),
      );
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      let failed = false;
      const request = indexedDB.open(IMAGE_TRACE_DATABASE, 1);
      const fail = (error) => {
        failed = true;
        clearTimeout(timer);
        reject(
          error ||
            describeAuthoringError(
              new Error('Tracing storage failed.'),
              'errors:studio.trace.storageFailed',
            ),
        );
      };
      const timer = setTimeout(
        () =>
          fail(
            describeAuthoringError(
              new Error('Tracing storage did not open in time.'),
              'errors:studio.trace.openTimeout',
            ),
          ),
        timeoutMs,
      );
      request.onupgradeneeded = () => request.result.createObjectStore('traces');
      request.onerror = () => fail(request.error);
      request.onblocked = () =>
        fail(
          describeAuthoringError(
            new Error('Close an older Studio tab to open tracing storage.'),
            'errors:studio.trace.closeOlderTab',
          ),
        );
      request.onsuccess = () => {
        clearTimeout(timer);
        const db = request.result;
        if (failed) return db.close();
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        resolve(db);
      };
    }).catch((error) => {
      opening = null;
      throw error;
    });
    return opening;
  }
  async function transact(projectId, missionId, write, trace, expectedRevision) {
    const id = key(projectId, missionId);
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['traces'], write ? 'readwrite' : 'readonly');
      const store = tx.objectStore('traces');
      let result,
        failure,
        finished = false;
      const finish = (error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(result);
      };
      const timer = setTimeout(() => {
        failure = describeAuthoringError(
          new Error('Tracing save did not finish. Keep this session and export a backup.'),
          'errors:studio.trace.saveTimeout',
        );
        try {
          tx.abort();
        } catch {
          /* May already have committed; read before retrying. */
        }
        finish(failure);
      }, timeoutMs);
      tx.oncomplete = () => finish();
      tx.onerror = tx.onabort = () =>
        finish(
          failure ||
            tx.error ||
            describeAuthoringError(
              new Error('Tracing storage failed.'),
              'errors:studio.trace.storageFailed',
            ),
        );
      const request = store.get(id);
      request.onsuccess = () => {
        try {
          const current = entry(request.result, projectId, missionId);
          if (!write) {
            result = current;
            return;
          }
          if (current.revision !== expectedRevision) {
            const error = describeAuthoringError(
              new Error('A newer tracing draft exists. Inspect it before replacing it.'),
              'errors:studio.trace.conflict',
            );
            error.code = 'trace-conflict';
            throw error;
          }
          const revision = (current.revision ?? 0) + 1;
          requireAuthoring(
            validRevision(revision),
            'Tracing revision limit reached. Export a backup.',
            'errors:studio.trace.revisionLimit',
          );
          result = { revision, trace };
          store.put(result, id);
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
    });
  }
  return {
    read: (projectId, missionId) => transact(projectId, missionId, false),
    save(projectId, missionId, source, expectedRevision) {
      requireAuthoring(
        expectedRevision === null || validRevision(expectedRevision),
        'Save requires the exact prior tracing revision.',
        'errors:studio.trace.exactRevision',
      );
      const trace = source === null ? null : readImageTrace(source);
      requireAuthoring(
        trace === null || (trace.projectId === projectId && trace.missionId === missionId),
        'Tracing owner mismatch.',
        'errors:studio.trace.ownerMismatch',
      );
      return transact(projectId, missionId, true, trace, expectedRevision);
    },
  };
}
