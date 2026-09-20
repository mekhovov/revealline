import { exactKeys, required, stableId } from '../data-json.mjs';
import { readImageTrace } from './image-trace.mjs';

export const IMAGE_TRACE_DATABASE = 'revealline-content-image-traces-v1';
const validRevision = (value) => Number.isSafeInteger(value) && value > 0;
function key(projectId, missionId) {
  required(stableId(projectId) && stableId(missionId), 'Invalid tracing storage owner.');
  return `${projectId}/${missionId}`;
}
function entry(value, projectId, missionId) {
  if (value === undefined) return { revision: null, trace: null };
  exactKeys(value, ['revision', 'trace'], 'stored tracing draft');
  required(validRevision(value.revision), 'Invalid stored tracing revision.');
  const trace = value.trace === null ? null : readImageTrace(value.trace);
  required(
    trace === null || (trace.projectId === projectId && trace.missionId === missionId),
    'Stored tracing ownership mismatch.',
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
  required(
    Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 10000,
    'Invalid trace timeout.',
  );
  let opening;
  function open() {
    if (!indexedDB) return Promise.reject(new Error('Tracing storage is unavailable.'));
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      let failed = false;
      const request = indexedDB.open(IMAGE_TRACE_DATABASE, 1);
      const fail = (error) => {
        failed = true;
        clearTimeout(timer);
        reject(error || new Error('Tracing storage failed.'));
      };
      const timer = setTimeout(
        () => fail(new Error('Tracing storage did not open in time.')),
        timeoutMs,
      );
      request.onupgradeneeded = () => request.result.createObjectStore('traces');
      request.onerror = () => fail(request.error);
      request.onblocked = () =>
        fail(new Error('Close an older Studio tab to open tracing storage.'));
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
        failure = new Error('Tracing save did not finish. Keep this session and export a backup.');
        try {
          tx.abort();
        } catch {
          /* May already have committed; read before retrying. */
        }
        finish(failure);
      }, timeoutMs);
      tx.oncomplete = () => finish();
      tx.onerror = tx.onabort = () =>
        finish(failure || tx.error || new Error('Tracing storage failed.'));
      const request = store.get(id);
      request.onsuccess = () => {
        try {
          const current = entry(request.result, projectId, missionId);
          if (!write) {
            result = current;
            return;
          }
          if (current.revision !== expectedRevision) {
            const error = new Error(
              'A newer tracing draft exists. Inspect it before replacing it.',
            );
            error.code = 'trace-conflict';
            throw error;
          }
          const revision = (current.revision ?? 0) + 1;
          required(validRevision(revision), 'Tracing revision limit reached. Export a backup.');
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
      required(
        expectedRevision === null || validRevision(expectedRevision),
        'Save requires the exact prior tracing revision.',
      );
      const trace = source === null ? null : readImageTrace(source);
      required(
        trace === null || (trace.projectId === projectId && trace.missionId === missionId),
        'Tracing owner mismatch.',
      );
      return transact(projectId, missionId, true, trace, expectedRevision);
    },
  };
}
