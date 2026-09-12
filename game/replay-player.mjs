import { createRun, stepRun, releaseInputs, FIXED_DT } from './core/index.mjs';
import {
  verifyReplayAsync,
  authoritativeCheckpoint,
  MAX_REPLAY_BYTES,
  MAX_REPLAY_TICKS,
} from './replay.mjs';
import { boundedJSON } from './data-json.mjs';

export const PLAYBACK_RATES = Object.freeze([0.5, 1, 2]);
export const MAX_PLAYBACK_FRAME_SECONDS = 0.25;
const abort = (signal) => {
  if (signal?.aborted) {
    const error = new Error('Replay loading cancelled.');
    error.name = 'AbortError';
    throw error;
  }
};

/**
 * Verify before returning any player. Own the input before the verifier's first
 * yield, so caller edits cannot replace the recording between verification and use.
 */
export async function prepareReplayPlayer(source, { signal, onProgress, chunkTicks = 600 } = {}) {
  abort(signal);
  const recording = boundedJSON(source, {
    maxBytes: MAX_REPLAY_BYTES,
    maxNodes: 3_000_000,
    maxDepth: 24,
    maxArray: MAX_REPLAY_TICKS,
    maxString: 262_144,
  });
  const verified = await verifyReplayAsync(recording, { signal, onProgress, chunkTicks });
  abort(signal);
  if (!verified.match) {
    const error = new Error(
      'Replay verification failed. Its inputs do not reproduce the recorded final state.',
    );
    error.name = 'ReplayVerificationError';
    error.diagnostics = verified.diagnostics;
    throw error;
  }
  return playerFor(recording);
}

function playerFor(recording) {
  let state, phase, segmentIndex, segmentTick, accumulator, finalCheckpoint, failure;
  let rate = 1;
  const info = Object.freeze({
    build: recording.build,
    levelId: recording.level.id,
    levelName:
      typeof recording.level.name === 'string'
        ? recording.level.name.slice(0, 160)
        : recording.level.id,
    turnPolicy: recording.options.turnPolicy,
    classId: recording.options.classId,
    seed: recording.options.seed,
    totalTicks: recording.ticks,
    durationSeconds: recording.ticks * FIXED_DT,
    recordedStatus: recording.summary.status,
  });
  function finish() {
    if (phase === 'complete') return;
    if (recording.releaseAfter) releaseInputs(state);
    const actual = authoritativeCheckpoint(state);
    const expected = recording.checkpoint;
    const match =
      state.tick === recording.ticks &&
      actual.algorithm === expected.algorithm &&
      actual.hash === expected.hash &&
      Object.entries(expected.sections).every(([key, value]) => actual.sections[key] === value);
    if (!match) {
      phase = 'error';
      failure = 'Playback stopped: the final state does not match the verified recording.';
      throw new Error(failure);
    }
    finalCheckpoint = Object.freeze({
      matched: true,
      hash: actual.hash,
      algorithm: actual.algorithm,
    });
    phase = 'complete';
    accumulator = 0;
  }
  function reset() {
    state = createRun(recording.level, recording.options);
    phase = 'paused';
    segmentIndex = 0;
    segmentTick = 0;
    accumulator = 0;
    finalCheckpoint = null;
    failure = null;
    if (recording.ticks === 0) finish();
    return report();
  }
  function report(events = [], ticks = 0, reason = null) {
    return {
      phase,
      tick: state.tick,
      totalTicks: recording.ticks,
      rate,
      ticks,
      events,
      reason,
      finalCheckpoint,
    };
  }
  function tick() {
    if (phase === 'complete' || phase === 'error') return [];
    const segment = recording.segments[segmentIndex];
    if (!segment) {
      finish();
      return [];
    }
    if (segmentTick === 0 && segment.releaseBefore) releaseInputs(state);
    if (state.status === 'won' || state.status === 'lost') {
      phase = 'error';
      failure = 'Playback reached a terminal state before the recording ended.';
      throw new Error(failure);
    }
    stepRun(state, segment.input, FIXED_DT);
    const events = state.events.map((event) => structuredClone(event));
    segmentTick++;
    if (segmentTick === segment.ticks) {
      segmentIndex++;
      segmentTick = 0;
    }
    if (state.tick === recording.ticks) finish();
    return events;
  }
  function pause() {
    if (phase === 'playing') phase = 'paused';
    accumulator = 0;
    // Transport pause is not a recorded release: preserve the exact action latch,
    // speed and queued direction until the next recording command says otherwise.
    return report();
  }
  function play() {
    if (phase === 'paused') phase = 'playing';
    return report();
  }
  function setRate(value) {
    if (!PLAYBACK_RATES.includes(value)) throw new TypeError('Playback rate must be 0.5, 1 or 2.');
    rate = value;
    return report();
  }
  function step(count = 1) {
    if (!Number.isInteger(count) || count < 1 || count > 240)
      throw new TypeError('Step must contain 1..240 ticks.');
    pause();
    const start = state.tick,
      events = [];
    for (let index = 0; index < count && phase === 'paused'; index++) events.push(...tick());
    return report(events, state.tick - start);
  }
  function advance(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0)
      throw new TypeError('Frame time must be a finite nonnegative number.');
    if (phase !== 'playing') return report();
    if (seconds > MAX_PLAYBACK_FRAME_SECONDS) {
      pause();
      return report([], 0, 'frame-gap');
    }
    accumulator += seconds * rate;
    const start = state.tick,
      events = [];
    // At most 61 ticks including a prior fractional remainder: no backlog chase.
    while (accumulator + 1e-9 >= FIXED_DT && phase === 'playing') {
      accumulator = Math.max(0, accumulator - FIXED_DT);
      events.push(...tick());
    }
    return report(events, state.tick - start);
  }
  reset();
  return Object.freeze({
    info,
    // Read model for BoardPainter. Consumers must not mutate it; terminal
    // checkpoint comparison detects any future-affecting accidental mutation.
    get state() {
      return state;
    },
    get phase() {
      return phase;
    },
    get rate() {
      return rate;
    },
    get finalCheckpoint() {
      return finalCheckpoint;
    },
    get error() {
      return failure;
    },
    play,
    pause,
    reset,
    setRate,
    step,
    advance,
  });
}
