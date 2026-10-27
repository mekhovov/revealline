const stages = [
  'preparation',
  'prefetch',
  'retirement',
  'adapter',
  'source',
  'payload',
  'verification',
  'scene-import',
  'artwork',
  'renderer',
  'mount',
];
const elapsed = (start, end) => Math.round(Math.max(0, end - start) * 1000) / 1000;
const integer = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 1000000;

/** Fixed-size, session-only preparation evidence. No events or replay inputs are retained. */
export function createDemoPreparation({ now = () => performance.now() } = {}) {
  const began = now();
  let stage = 'preparation',
    stageBegan = began,
    closed = null,
    unbind = () => {};
  const durations = Object.fromEntries(stages.map((name) => [name, 0]));
  const candidates = [];
  const snapshot = (status = 'loading', ended = now()) =>
    Object.freeze({
      status,
      stage,
      elapsedMs: elapsed(began, ended),
      durationsMs: Object.freeze({
        ...durations,
        [stage]: elapsed(0, durations[stage] + ended - stageBegan),
      }),
      candidates: Object.freeze(
        candidates.map(({ began, ended: done, ...candidate }) =>
          Object.freeze({ ...candidate, elapsedMs: elapsed(began, done ?? ended) }),
        ),
      ),
    });
  const finish = (status) => {
    if (!closed) {
      closed = snapshot(status);
      unbind();
    }
    return closed;
  };
  return Object.freeze({
    bind(signal) {
      unbind();
      if (closed) return;
      const abort = () => finish(signal.reason?.name === 'AbortError' ? 'cancelled' : 'failed');
      unbind = () => signal.removeEventListener('abort', abort);
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    },
    report(next, details = {}) {
      if (closed) return;
      const at = now();
      if (stages.includes(next)) {
        durations[stage] += Math.max(0, at - stageBegan);
        stage = next;
        stageBegan = at;
      }
      if (next === 'candidate' && candidates.length < 4)
        candidates.push({
          variant: ['default', 'chromium', 'firefox', 'webkit'].includes(details.variant)
            ? details.variant
            : 'unknown',
          engineHint: ['chromium', 'firefox', 'webkit'].includes(details.engineHint)
            ? details.engineHint
            : 'unknown',
          prefetched: details.prefetched === true,
          status: 'loading',
          code: null,
          tick: null,
          totalTicks: null,
          began: at,
          ended: null,
        });
      const candidate = candidates.at(-1);
      if (
        candidate &&
        next === 'progress' &&
        integer(details.tick) &&
        integer(details.totalTicks) &&
        details.tick <= details.totalTicks
      ) {
        candidate.tick = details.tick;
        candidate.totalTicks = details.totalTicks;
      }
      if (candidate && ['candidate-failed', 'candidate-verified'].includes(next)) {
        candidate.status = next === 'candidate-verified' ? 'verified' : 'failed';
        candidate.code = typeof details.code === 'string' ? details.code.slice(0, 80) : null;
        candidate.ended = at;
      }
    },
    finish,
    snapshot: () => closed ?? snapshot(),
  });
}

/** Diagnostic observers must never affect replay admission or resource cleanup. */
export function reportDemoPreparation(report, stage, details) {
  try {
    report?.(stage, details);
  } catch {
    // A diagnostic consumer cannot become a gameplay dependency.
  }
}
