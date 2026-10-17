let serial = 0;
export const ADVANCED_VERIFICATION_WATCHDOG_MS = 420000;

/** One dedicated worker owns one reference flight. A failed or timed-out worker
 * is terminated; callers must explicitly create a new session to fly again. */
export function createAdvancedWorkerClient({
  Worker: WorkerClass = globalThis.Worker,
  url = new URL('./advanced-worker.mjs', import.meta.url),
  watchdogMs = 10000,
  verificationWatchdogMs = ADVANCED_VERIFICATION_WATCHDOG_MS,
} = {}) {
  if (typeof WorkerClass !== 'function')
    throw new Error('Advanced practice requires Web Workers on this platform.');
  if (!Number.isFinite(watchdogMs) || watchdogMs < 1 || watchdogMs > 60000)
    throw new Error('Invalid Advanced worker deadline');
  // Historical twelve-minute recordings may need six minutes at the minimum
  // qualified 2x capacity, plus setup margin. New aircraft clips retain at most
  // three minutes. This bounds verification, never the duration of flying.
  // Flight/init requests keep their short watchdog.
  if (
    !Number.isFinite(verificationWatchdogMs) ||
    verificationWatchdogMs < 1 ||
    verificationWatchdogMs > ADVANCED_VERIFICATION_WATCHDOG_MS
  )
    throw new Error('Invalid Advanced verification deadline');
  const session = `advanced-${Date.now()}-${++serial}`;
  const worker = new WorkerClass(url, { type: 'module' });
  let requestId = 0,
    disposed = false;
  const waiting = new Map();
  const rejectAll = (error) => {
    for (const pending of waiting.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    waiting.clear();
  };
  function dispose(error = new Error('Advanced practice was closed.')) {
    if (disposed) return;
    disposed = true;
    worker.removeEventListener('message', receive);
    worker.removeEventListener('error', fail);
    worker.removeEventListener('messageerror', fail);
    worker.terminate();
    rejectAll(error);
  }
  const receive = ({ data }) => {
    if (disposed || !data || data.session !== session) return;
    const pending = waiting.get(data.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    waiting.delete(data.id);
    if (data.error) {
      const error = new Error(data.error);
      if (['ADVANCED_DURATION_LIMIT', 'ADVANCED_RECORDING_LIMIT'].includes(data.code))
        error.code = data.code;
      pending.reject(error);
    } else pending.resolve(data.result);
  };
  const fail = (event) => dispose(new Error(event.message || 'Advanced worker is unavailable.'));
  worker.addEventListener('message', receive);
  worker.addEventListener('error', fail);
  worker.addEventListener('messageerror', fail);
  function request(type, fields = {}) {
    if (disposed) return Promise.reject(new Error('Advanced practice is closed.'));
    if (waiting.size >= 32) return Promise.reject(new Error('Advanced worker queue is full.'));
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => dispose(new Error('Advanced worker did not respond. Practice is paused.')),
        ['verify-recording', 'restore'].includes(type) ? verificationWatchdogMs : watchdogMs,
      );
      waiting.set(id, { resolve, reject, timer });
      try {
        worker.postMessage({ ...fields, id, session, type });
      } catch (error) {
        clearTimeout(timer);
        waiting.delete(id);
        reject(error);
      }
    });
  }
  return {
    request,
    session,
    initialize: (options) => request('init', { options }),
    input: (sample) => request('input', { sample }),
    step: (sample, motions) => request('step', { sample, motions }),
    propose: (sample, motions) => request('propose', { sample, motions }),
    commit: (decision) => request('commit', { decision }),
    stageTerrainFrame: (frame) => request('stage-terrain', { frame }),
    commitTerrainFrame: (decision) => request('commit-terrain', { decision }),
    telemetry: () => request('telemetry'),
    snapshot: () => request('snapshot'),
    restore: (snapshot) => request('restore', { snapshot }),
    recording: () => request('recording'),
    recordingStatus: () => request('recording-status'),
    reportPersistence: (status) => request('recording-persistence', { status }),
    verifyRecording: (recording) => request('verify-recording', { recording }),
    reset: () => request('reset'),
    dispose,
  };
}
