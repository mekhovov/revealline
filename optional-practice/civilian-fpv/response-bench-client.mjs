import { boundedJSON } from '../../game/data-json.mjs';

let serial = 0;
const cancelled = () => new DOMException('Simulation comparison cancelled.', 'AbortError');

/** A job owns a fresh worker. Replacing/closing a job terminates its CPU owner,
 * rejects its promise and removes every listener; late results cannot win. */
export function createResponseBenchClient({
  Worker: WorkerClass = globalThis.Worker,
  url = new URL('./response-bench-worker.mjs', import.meta.url),
  timeoutMs = 180000,
} = {}) {
  if (typeof WorkerClass !== 'function')
    throw new Error('Simulation comparisons require Web Workers.');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 600000)
    throw new Error('Invalid simulation comparison deadline');
  let current = null,
    disposed = false;
  const cancel = (error = cancelled()) => {
    if (!current) return;
    current.finish(error);
  };
  function run(type, request, { onProgress = () => {} } = {}) {
    if (disposed) return Promise.reject(new Error('Simulation comparisons are closed.'));
    // Capture before cancelling the current job: malformed replacement input
    // must not accidentally transfer mutable references into a worker.
    let snapshot;
    try {
      snapshot = boundedJSON(request, { maxBytes: 256 * 1024, maxNodes: 10000, maxDepth: 24 });
    } catch (error) {
      return Promise.reject(error);
    }
    cancel();
    const id = `response-bench-${++serial}`;
    return new Promise((resolve, reject) => {
      let worker;
      try {
        worker = new WorkerClass(url, { type: 'module' });
      } catch (error) {
        reject(error);
        return;
      }
      const job = { id, worker, timer: null, settled: false, finish: null };
      function finish(error, result) {
        if (job.settled) return;
        job.settled = true;
        clearTimeout(job.timer);
        worker.removeEventListener('message', receive);
        worker.removeEventListener('error', fail);
        worker.removeEventListener('messageerror', fail);
        worker.terminate();
        if (current === job) current = null;
        if (error) reject(error);
        else resolve(result);
      }
      const receive = ({ data }) => {
        if (current !== job || job.settled || !data || data.id !== id) return;
        if (Object.hasOwn(data, 'progress')) {
          try {
            onProgress(data.progress);
          } catch (error) {
            finish(error);
          }
        } else if (data.error) finish(new Error(data.error));
        else finish(null, data.result);
      };
      const fail = (event) =>
        finish(new Error(event?.message || 'Simulation comparison worker failed.'));
      job.finish = finish;
      current = job;
      worker.addEventListener('message', receive);
      worker.addEventListener('error', fail);
      worker.addEventListener('messageerror', fail);
      // Absolute deadline is not refreshed by progress messages.
      job.timer = setTimeout(
        () => finish(new Error('Simulation comparison exceeded its time budget.')),
        timeoutMs,
      );
      try {
        worker.postMessage({ id, type, request: snapshot });
      } catch (error) {
        finish(error);
      }
    });
  }
  return Object.freeze({
    compare: (request, options) => run('compare', request, options),
    suggest: (request, options) => run('suggest', request, options),
    cancel,
    busy: () => current !== null,
    dispose() {
      disposed = true;
      cancel();
    },
  });
}
