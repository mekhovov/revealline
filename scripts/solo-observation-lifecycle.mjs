import { setTimeout as delay } from 'node:timers/promises';

// Node-side cancellation only: no frame listener, browser evaluation or periodic
// serialization. One signal wakes an active wait so the caller can pause/export.
export function createObservationStop() {
  const controller = new AbortController();
  let interruption = null;
  return {
    request(signal) {
      if (interruption) return;
      interruption = Object.freeze({ signal, requestedAt: new Date().toISOString() });
      controller.abort();
    },
    get interruption() {
      return interruption;
    },
    get requested() {
      return controller.signal.aborted;
    },
    get message() {
      return interruption ? `Observation interrupted by ${interruption.signal}.` : null;
    },
    throwIfRequested() {
      if (interruption) throw new Error(this.message);
    },
    async wait(milliseconds) {
      if (!Number.isFinite(milliseconds) || milliseconds < 0)
        throw new Error('Invalid observation wait.');
      if (controller.signal.aborted) return false;
      try {
        await delay(milliseconds, undefined, { signal: controller.signal });
        return true;
      } catch (error) {
        if (controller.signal.aborted && error.name === 'AbortError') return false;
        throw error;
      }
    },
  };
}
