import { createRun, stepRun, FIXED_DT, getSummary } from '../../game/core/index.mjs';

const terminal = (run) => ['won', 'lost'].includes(run.status);

/** One real core run, never a replay recorder or profile owner. UI presentation
 * reads this state; comparison options cannot become simulation input. */
export function createBenchmarkSession(manifest, { onStep = () => {} } = {}) {
  if (manifest?.mode !== 'solo' || manifest.difficulty !== 'standard')
    throw new Error('Choose a resolved standard Solo mission.');
  const options = Object.freeze({ seed: 1, classId: 'scout', turnPolicy: 'immediate' });
  let run = createRun(manifest.level, options);
  let playing = false;
  let accumulator = 0;
  let disposed = false;
  const events = [];
  const pause = () => {
    playing = false;
    accumulator = 0;
  };
  return {
    get run() {
      return run;
    },
    get playing() {
      return playing && !disposed;
    },
    get events() {
      return events.slice();
    },
    get summary() {
      return getSummary(run);
    },
    start() {
      if (disposed || terminal(run)) return false;
      accumulator = 0;
      playing = true;
      return true;
    },
    pause,
    retry() {
      if (disposed) return false;
      pause();
      run = createRun(manifest.level, options);
      events.length = 0;
      return true;
    },
    advance(input, seconds) {
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 0.25)
        throw new Error('Benchmark frames must be between zero and 250 ms.');
      if (!playing || disposed) return 0;
      accumulator += seconds;
      let ticks = 0;
      while (accumulator + 1e-10 >= FIXED_DT && !terminal(run)) {
        accumulator = Math.max(0, accumulator - FIXED_DT);
        stepRun(run, input, FIXED_DT);
        ticks++;
        for (const event of run.events) {
          // Event-time source attribution, bounded independently of play length.
          events.push(
            Object.freeze({
              tick: event.tick,
              type: event.type,
              ...(event.reason ? { reason: event.reason } : {}),
              ...(event.cause ? { cause: event.cause } : {}),
              ...(event.actorId ? { actorId: event.actorId } : {}),
              ...(event.indices ? { cells: event.indices.length } : {}),
            }),
          );
        }
        if (events.length > 12) events.splice(0, events.length - 12);
        onStep(run.events, run);
      }
      if (terminal(run)) pause();
      return ticks;
    },
    dispose() {
      pause();
      disposed = true;
    },
  };
}

/** Replacement is atomic: failed, cancelled or late loads cannot retire the
 * visible run. The caller pauses and clears physical input before requesting. */
export function createBenchmarkSelection({ prepare, onStatus = () => {}, onAdopt = () => {} }) {
  let current = null;
  let pending = null;
  let generation = 0;
  let disposed = false;
  const cancel = () => {
    generation++;
    const old = pending;
    pending = null;
    old?.abort();
  };
  return {
    get current() {
      return current;
    },
    get pending() {
      return pending !== null;
    },
    async select(entry) {
      if (disposed) return false;
      cancel();
      const controller = new AbortController();
      pending = controller;
      const owner = generation;
      const owned = () => !disposed && owner === generation && !controller.signal.aborted;
      onStatus(
        'loading',
        'Loading this exact mission and original artwork. The previous run stays paused.',
      );
      try {
        const next = await prepare(entry, { signal: controller.signal });
        if (!owned()) {
          next.dispose();
          return false;
        }
        const previous = current;
        current = next;
        pending = null;
        try {
          onAdopt(next);
        } catch (error) {
          if (current === next) current = previous;
          next.dispose();
          throw error;
        }
        previous?.dispose();
        onStatus('ready', 'Ready. Start when you are ready; Retry keeps this exact setup.');
        return true;
      } catch (error) {
        if (owned()) {
          pending = null;
          onStatus(
            'error',
            `Could not prepare this mission: ${error.message} The previous run is unchanged.`,
          );
        }
        return false;
      }
    },
    cancel,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancel();
      current?.dispose();
      current = null;
    },
  };
}
