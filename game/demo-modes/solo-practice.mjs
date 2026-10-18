import { FIXED_DT, releaseInputs, stepRun } from '../core/index.mjs';

// This ephemeral session has no persistence, progression, or completion adapter.
export function createDemoPractice(run) {
  if (!run || ['won', 'lost'].includes(run.status))
    throw new Error('Practice needs an unfinished run.');
  releaseInputs(run);
  let phase = 'paused',
    accumulator = 0,
    direction = null,
    initiatingAction = null;
  const report = (events = [], reason = null) => ({ phase, events, tick: run.tick, reason });
  return {
    get state() {
      return run;
    },
    get phase() {
      return phase;
    },
    start(intent = {}) {
      if (phase === 'complete') return;
      if (['up', 'right', 'down', 'left'].includes(intent.direction)) direction = intent.direction;
      if (['ability', 'pickup', 'boost'].includes(intent.action)) initiatingAction = intent.action;
      if (direction || initiatingAction) phase = 'playing';
    },
    steer(next) {
      if (!['up', 'right', 'down', 'left'].includes(next) || phase === 'complete') return;
      direction = next;
      phase = 'playing';
    },
    pause() {
      if (phase !== 'complete') phase = 'paused';
      direction = null;
      initiatingAction = null;
      accumulator = 0;
      return report();
    },
    advance(seconds, controls = {}) {
      if (!Number.isFinite(seconds) || seconds < 0) throw new TypeError('Invalid practice frame.');
      if (seconds > 0.25) {
        this.pause();
        return report([], 'frame-gap');
      }
      if (phase !== 'playing') return report();
      accumulator += seconds;
      const events = [];
      while (accumulator + 1e-9 >= FIXED_DT && phase === 'playing') {
        accumulator = Math.max(0, accumulator - FIXED_DT);
        // Consume one-shot input only when a simulation tick can use it.
        const input = typeof controls === 'function' ? controls() : controls;
        const first = initiatingAction;
        initiatingAction = null;
        stepRun(
          run,
          {
            direction,
            boost: input.boost === true || first === 'boost',
            action: input.action === true || first === 'ability',
            pickup: input.pickup === true || first === 'pickup',
            switchClass: input.switchClass ?? null,
          },
          FIXED_DT,
        );
        events.push(...run.events.map((event) => structuredClone(event)));
        if (run.events.some((event) => ['capture.stopped', 'player.failed'].includes(event.type)))
          direction = null;
        if (['won', 'lost'].includes(run.status)) {
          phase = 'complete';
          accumulator = 0;
        }
      }
      return report(events);
    },
  };
}
