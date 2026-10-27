import { dataIdentity } from '../../game/data-json.mjs';
import { createFlight, replayFlightCooperatively, FLIGHT_HZ } from './model.mjs';
import {
  createWorldFlight,
  replayWorldFlight,
  worldStateIdentity,
  initWorldRuntime,
  validateWorldCourse,
} from './world-model.mjs';
import { decodeSimDemoPayload } from './demo-payload.mjs';
import { resolveFlightDemonstration } from './demonstration-resolver.mjs';

const terminal = (state) => ['complete', 'failed', 'expired'].includes(state.status);
const axes = ['roll', 'pitch', 'yaw', 'throttle', 'actions'];
const command = (frame) => Object.fromEntries(frame.map((value, index) => [axes[index], value]));
const validSeconds = (seconds) => Number.isFinite(seconds) && seconds >= 0 && seconds <= 0.25;
const snapshotIdentity = (entry, state) =>
  entry.legacy ? dataIdentity(state) : worldStateIdentity(state);
const makeFlight = (entry, proof) =>
  (entry.legacy ? createFlight : createWorldFlight)({
    course: entry.course,
    mode: proof.mode,
    response: proof.response,
  });
export function simDemoMeaningfulProgress(state) {
  return (
    state.step > 0 ||
    state.hold >= FLIGHT_HZ ||
    state.hunt?.caught?.length > 0 ||
    (state.actors ?? []).some((actor) => actor.status === 'destroyed' || actor.status === 'caught')
  );
}

// Sparse checkpoints identify the earliest known mismatch, not an exact
// divergent tick. This extra world exists only after the verifier retired its
// failed world, and is always retired before preparation can continue.
async function firstMismatchingCheckpoint(entry, proof, rows, { signal, yieldControl } = {}) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const checkpoints = new Map(
    rows
      .filter(
        (row) =>
          Number.isInteger(row.tick) &&
          row.tick > 0 &&
          row.tick <= proof.frames.length &&
          typeof row.stateIdentity === 'string',
      )
      .map((row) => [row.tick, row.stateIdentity]),
  );
  if (!checkpoints.size) return null;
  const flight = makeFlight(entry, proof);
  try {
    flight.arm();
    for (let index = 0; index < proof.frames.length; index++) {
      if (index % 200 === 0) {
        signal?.throwIfAborted();
        await (yieldControl?.() ?? new Promise((resolve) => setTimeout(resolve, 0)));
        signal?.throwIfAborted();
      }
      const state = flight.step(command(proof.frames[index]), { quantized: true });
      const tick = index + 1;
      if (checkpoints.has(tick) && checkpoints.get(tick) !== snapshotIdentity(entry, state))
        return tick;
    }
    return null;
  } finally {
    flight.dispose?.();
  }
}

/** Full native replay remains authoritative; diagnostics never relax exact identity. */
export async function verifySimDemo(entry, payload, options = {}) {
  try {
    return await verifyNativeSimDemo(entry, payload, options);
  } catch (error) {
    if (options.signal?.aborted || error.name === 'AbortError') throw error;
    if (
      globalThis.WebAssembly &&
      (error instanceof WebAssembly.CompileError || error instanceof WebAssembly.LinkError)
    )
      throw Object.assign(new Error('SIM physics runtime is unavailable.', { cause: error }), {
        code: 'demo-mode-unavailable',
        modeId: 'sim',
      });
    throw Object.assign(new Error(error.message, { cause: error }), {
      code: 'demo-content-mismatch',
      modeId: 'sim',
      ...(Number.isInteger(error.firstMismatchingCheckpointTick)
        ? { firstMismatchingCheckpointTick: error.firstMismatchingCheckpointTick }
        : {}),
    });
  }
}

async function verifyNativeSimDemo(entry, payload, { signal, yieldControl } = {}) {
  signal?.throwIfAborted();
  const proof = decodeSimDemoPayload(payload);
  if (
    !resolveFlightDemonstration({
      entry,
      mode: proof.mode,
      worldDemonstrations: [
        {
          sourceIdentity: dataIdentity(
            entry.legacy ? entry.course : validateWorldCourse(entry.course),
          ),
          proof,
        },
      ],
      flightDemonstrations: [proof],
    })
  )
    throw new Error('SIM demo content or simulation identity changed');
  let result;
  try {
    result = await (entry.legacy ? replayFlightCooperatively : replayWorldFlight)(
      entry.course,
      proof,
      { signal, yieldControl },
    );
  } catch (error) {
    signal?.throwIfAborted();
    if (error.name === 'AbortError') throw error;
    try {
      const tick = await firstMismatchingCheckpoint(entry, proof, payload.checkpoints, {
        signal,
        yieldControl,
      });
      if (tick !== null) {
        error.firstMismatchingCheckpointTick = tick;
        error.message += ` (first mismatching checkpoint: tick ${tick})`;
      }
    } catch {
      signal?.throwIfAborted();
      // Diagnostics cannot replace or relax the native verification failure.
    }
    throw error;
  }
  if (!terminal(result.state)) throw new Error('SIM demo does not contain a complete performance');
  if (!simDemoMeaningfulProgress(result.state))
    throw new Error('SIM demo makes no goal-related progress');
  return { proof, state: result.state };
}

export async function createSimDemoPlayer(entry, payload, { signal, yieldControl } = {}) {
  const { proof, state: verified } = await verifySimDemo(entry, payload, { signal, yieldControl });
  signal?.throwIfAborted();
  const flight = makeFlight(entry, proof);
  flight.arm();
  let phase = 'paused',
    cursor = 0,
    debt = 0,
    disposed = false,
    state = flight.snapshot();
  const checkpoints = new Map(
    (payload.checkpoints ?? []).map((item) => [item.tick, item.stateIdentity]),
  );
  const terminalIdentity = snapshotIdentity(entry, verified);
  const report = (events = []) => ({ phase, tick: state.ticks, events });
  const player = {
    entry,
    proof,
    get state() {
      return state;
    },
    get phase() {
      return disposed ? 'disposed' : phase;
    },
    maxAdvanceSeconds: 0.25,
    info: Object.freeze({
      modeId: 'sim',
      levelId: entry.id,
      recordedStatus: verified.status === 'complete' ? 'won' : 'lost',
      totalTicks: proof.frames.length,
      durationSeconds: proof.frames.length / FLIGHT_HZ,
    }),
    play() {
      if (!disposed && phase !== 'complete') phase = 'playing';
      return report();
    },
    pause() {
      if (!disposed && phase !== 'complete') phase = 'paused';
      debt = 0;
      return report();
    },
    advance(seconds) {
      if (disposed || phase !== 'playing' || !validSeconds(seconds)) return report();
      const events = [];
      debt += seconds;
      while (debt + 1e-10 >= 1 / FLIGHT_HZ && cursor < proof.frames.length) {
        const before = state;
        state = flight.step(command(proof.frames[cursor++]), { quantized: true });
        debt -= 1 / FLIGHT_HZ;
        if (state.step > before.step)
          events.push({ type: 'objective.completed', step: state.step, total: state.total });
        if ((state.hunt?.caught?.length ?? 0) > (before.hunt?.caught?.length ?? 0))
          events.push({ type: 'target.caught' });
        if (checkpoints.has(cursor) && checkpoints.get(cursor) !== snapshotIdentity(entry, state)) {
          const error = new Error(`SIM demo first divergent checkpoint: tick ${cursor}`);
          error.code = 'demo-content-mismatch';
          error.tick = cursor;
          throw error;
        }
      }
      if (cursor === proof.frames.length) {
        if (!terminal(state) || snapshotIdentity(entry, state) !== terminalIdentity)
          throw new Error('SIM demo playback diverged from its verified terminal state');
        phase = 'complete';
        debt = 0;
      }
      return report(events);
    },
    async forkForPractice({ signal: forkSignal } = {}) {
      forkSignal?.throwIfAborted();
      if (disposed || terminal(state))
        throw new Error('A terminal SIM demo cannot be resumed in practice');
      const displayedTicks = cursor,
        displayedIdentity = snapshotIdentity(entry, state);
      const fork = makeFlight(entry, proof);
      fork.arm();
      try {
        for (let index = 0; index < displayedTicks; index++) {
          if (index % 200 === 0) {
            forkSignal?.throwIfAborted();
            await (yieldControl?.() ?? new Promise((resolve) => setTimeout(resolve, 0)));
          }
          fork.step(command(proof.frames[index]), { quantized: true });
        }
        forkSignal?.throwIfAborted();
        if (disposed || snapshotIdentity(entry, fork.snapshot()) !== displayedIdentity)
          throw new Error('SIM practice checkpoint does not match the displayed state');
        return {
          flight: fork,
          entry,
          origin: { modeId: 'sim', levelId: entry.id, tick: displayedTicks },
        };
      } catch (error) {
        fork.dispose?.();
        throw error;
      }
    },
    dispose() {
      if (!disposed) {
        disposed = true;
        flight.dispose?.();
      }
    },
  };
  return player;
}

/** No recorder, store or settings writer is reachable from isolated practice. */
export function createSimDemoPractice(fork) {
  const { flight, entry } = fork;
  let state = flight.snapshot(),
    phase = 'paused',
    debt = 0,
    disposed = false;
  const inputAxes = entry.legacy ? axes.slice(0, 4) : axes;
  let input = Object.fromEntries(
    inputAxes.map((axis) => [
      axis,
      (state.lastInput?.[axis] ?? 0) / (axis === 'actions' ? 1 : 1000),
    ]),
  );
  let sample = null;
  const result = (events = []) => ({ phase, tick: state.ticks, events });
  const setInput = (intent) => {
    const next = intent?.input ?? intent;
    if (next && ['roll', 'pitch', 'yaw', 'throttle'].every((axis) => Number.isFinite(next[axis])))
      input = Object.fromEntries(
        inputAxes.map((axis) => [
          axis,
          axis === 'actions' ? (Number.isInteger(next.actions) ? next.actions : 0) : next[axis],
        ]),
      );
  };
  return {
    entry,
    get state() {
      return state;
    },
    get phase() {
      return disposed ? 'disposed' : phase;
    },
    get paused() {
      return phase !== 'playing';
    },
    setInput,
    setInputProvider(provider) {
      sample = provider;
    },
    start(intent) {
      if (!disposed && !terminal(state)) {
        setInput(intent);
        phase = 'playing';
      }
      return result();
    },
    play() {
      if (!disposed && !terminal(state)) phase = 'playing';
    },
    pause() {
      phase = terminal(state) ? 'complete' : 'paused';
      debt = 0;
    },
    advance(seconds) {
      if (disposed || phase !== 'playing') return result();
      if (!validSeconds(seconds)) {
        phase = 'paused';
        debt = 0;
        return result();
      }
      debt += seconds;
      const events = [];
      while (debt + 1e-10 >= 1 / FLIGHT_HZ && !terminal(state)) {
        const before = state;
        setInput(sample?.(1 / FLIGHT_HZ));
        state = flight.step(input);
        debt -= 1 / FLIGHT_HZ;
        if (state.step > before.step)
          events.push({ type: 'objective.completed', step: state.step, total: state.total });
      }
      if (terminal(state)) {
        phase = 'complete';
        debt = 0;
      }
      return result(events);
    },
    dispose() {
      if (!disposed) {
        disposed = true;
        flight.dispose?.();
      }
    },
  };
}

export { initWorldRuntime };
