import { withDemoLoadingDeadline } from './demo-loading.mjs';

const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

/** At most one immutable payload, never a second simulation or renderer. */
export function createDemoPrefetch() {
  let slot = null;
  const clear = () => {
    slot?.controller.abort();
    slot = null;
  };
  return {
    get source() {
      return slot?.source ?? null;
    },
    start(source) {
      clear();
      if (typeof source?.loadPayload !== 'function') return;
      const controller = new AbortController();
      const promise = withDemoLoadingDeadline((signal) => source.loadPayload({ signal }), {
        signal: controller.signal,
      })
        .then(freeze)
        .catch(() => undefined);
      slot = { source, controller, promise };
    },
    async take(source, { signal } = {}) {
      if (slot?.source !== source) return undefined;
      const current = slot;
      const abort = () => current.controller.abort();
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
      try {
        return await current.promise;
      } finally {
        signal?.removeEventListener('abort', abort);
        if (slot === current) slot = null;
      }
    },
    clear,
  };
}
