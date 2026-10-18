import { boundedJSON, canonicalJSON } from '../data-json.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  chooseOverflightUpgrade,
  rerollOverflightUpgrades,
  overflightSummary,
} from '../overflight/core.mjs';
import { OVERFLIGHT_STEP_SECONDS } from '../overflight/host-loop.mjs';
import { survivalDemoCompiled, SURVIVAL_DEMO_OPTIONS } from './survival-catalog.mjs';
import { SURVIVAL_DEMO_SIMULATION_IDENTITY } from './survival-simulation-identity.mjs';
import { reportDemoPreparation } from '../demo-preparation.mjs';

export const SURVIVAL_DEMO_FORMAT = 'OverflightDemonstrationV1';
export const SURVIVAL_DEMO_MAX_TICKS = 60 * 12 * 60;
export const SURVIVAL_DEMO_CHECKPOINT_TICKS = 5 * 60;
const terminal = (run) => ['won', 'lost'].includes(run.phase);
const fail = (message, tick = null) => {
  const error = new Error(message);
  error.code = 'demo-content-mismatch';
  if (tick !== null) error.tick = tick;
  return error;
};
const cancelled = (signal) => {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Cancelled', 'AbortError');
};

/** The full authoritative state, including RNGs, pools, allocation order, drafts,
 * terrain, cooldowns and progression. Render-only feeds and rebuilt spatial
 * scratch are deliberately omitted; a renderer can never affect verification. */
export function survivalDemoStateIdentity(run) {
  const omitted = new Set([
    'compiled',
    'camera',
    'effects',
    '_effectFree',
    'defeats',
    'events',
    '_grid',
    '_separationScratch',
    'review',
  ]);
  const text = JSON.stringify(run, (key, value) => {
    if (omitted.has(key)) return undefined;
    if (value instanceof Set) return [...value];
    if (ArrayBuffer.isView(value)) return [...value];
    if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
    return value;
  });
  // Two independent 32-bit accumulators keep checkpoints cheap enough to use
  // while playing. These are divergence diagnostics, never security signatures.
  let left = 0x811c9dc5,
    right = 0x9e3779b9;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x85ebca6b);
  }
  return `${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`;
}

export function survivalDemoProgress(run) {
  return run.stats.kills > 0 && run.stats.xpCollected > 0 && run.stats.upgradesChosen > 0;
}

function decode(entry, source) {
  let proof;
  try {
    proof = boundedJSON(source, {
      maxBytes: 2 * 1024 * 1024,
      maxArray: SURVIVAL_DEMO_MAX_TICKS,
      maxNodes: 400000,
      maxDepth: 20,
    });
  } catch (cause) {
    throw Object.assign(fail('Survival demonstration data is corrupt or exceeds its budget.'), {
      cause,
    });
  }
  const compiled = survivalDemoCompiled(entry);
  if (
    proof.format !== SURVIVAL_DEMO_FORMAT ||
    proof.levelId !== entry.levelId ||
    proof.simulationIdentity !== SURVIVAL_DEMO_SIMULATION_IDENTITY ||
    proof.contentIdentity !== compiled.projectIdentity ||
    canonicalJSON(proof.options) !== canonicalJSON(SURVIVAL_DEMO_OPTIONS) ||
    !Number.isSafeInteger(proof.ticks) ||
    proof.ticks <= 0 ||
    proof.ticks > SURVIVAL_DEMO_MAX_TICKS ||
    !['won', 'lost'].includes(proof.outcome) ||
    !Array.isArray(proof.inputs) ||
    !Array.isArray(proof.choices) ||
    !Array.isArray(proof.checkpoints) ||
    typeof proof.finalState !== 'string'
  )
    throw fail('Survival demonstration identity or shape does not match the current mission.');
  let previous = -1;
  for (const frame of proof.inputs) {
    if (
      !Array.isArray(frame) ||
      frame.length !== 4 ||
      !Number.isSafeInteger(frame[0]) ||
      frame[0] <= previous ||
      frame[0] >= proof.ticks ||
      frame[0] % 6 !== 0 ||
      !Number.isFinite(frame[1]) ||
      Math.abs(frame[1]) > 1 ||
      !Number.isFinite(frame[2]) ||
      Math.abs(frame[2]) > 1 ||
      typeof frame[3] !== 'boolean'
    )
      throw fail('Invalid Survival input transcript.');
    previous = frame[0];
  }
  if (proof.inputs[0]?.[0] !== 0) throw fail('Survival demonstration has no initial input.');
  previous = -1;
  for (const choice of proof.choices) {
    if (
      !Array.isArray(choice) ||
      choice.length !== 3 ||
      !Number.isSafeInteger(choice[0]) ||
      choice[0] < previous ||
      choice[0] >= proof.ticks ||
      typeof choice[1] !== 'string' ||
      !Number.isSafeInteger(choice[2]) ||
      choice[2] < 0 ||
      choice[2] > 3
    )
      throw fail('Invalid Survival upgrade transcript.');
    previous = choice[0];
  }
  if (proof.checkpoints.length !== Math.floor(proof.ticks / SURVIVAL_DEMO_CHECKPOINT_TICKS))
    throw fail('Survival demonstration is missing diagnostic checkpoints.');
  proof.checkpoints.forEach((checkpoint, index) => {
    if (
      !Array.isArray(checkpoint) ||
      checkpoint.length !== 2 ||
      checkpoint[0] !== (index + 1) * SURVIVAL_DEMO_CHECKPOINT_TICKS ||
      !/^[a-f0-9]{16}$/.test(checkpoint[1])
    )
      throw fail('Invalid Survival diagnostic checkpoint.');
  });
  return { proof, compiled };
}

function playback(entry, source) {
  const { proof, compiled } = decode(entry, source);
  const run = createOverflightRun(compiled, proof.options);
  startOverflight(run);
  let inputIndex = 0,
    choiceIndex = 0,
    checkpointIndex = 0;
  let input = { x: 0, y: 0, boost: false };
  function choose() {
    const choice = proof.choices[choiceIndex];
    if (!choice || run.phase !== 'upgrade' || choice[0] !== run.tick)
      throw fail('Survival upgrade timing diverged.', run.tick);
    for (let index = 0; index < choice[2]; index++)
      if (!rerollOverflightUpgrades(run)) throw fail('Survival reroll diverged.', run.tick);
    if (!chooseOverflightUpgrade(run, choice[1]))
      throw fail('Survival upgrade diverged.', run.tick);
    choiceIndex++;
  }
  function step() {
    if (terminal(run) || run.tick >= proof.ticks) return false;
    while (run.phase === 'upgrade') choose();
    const frame = proof.inputs[inputIndex];
    if (frame?.[0] === run.tick) {
      input = { x: frame[1], y: frame[2], boost: frame[3] };
      inputIndex++;
    }
    stepOverflight(run, input);
    const checkpoint = proof.checkpoints[checkpointIndex];
    if (checkpoint?.[0] === run.tick) {
      if (survivalDemoStateIdentity(run) !== checkpoint[1])
        throw fail(
          `Survival demonstration first mismatching checkpoint at tick ${run.tick}.`,
          run.tick,
        );
      checkpointIndex++;
    }
    if (terminal(run) && run.tick !== proof.ticks)
      throw fail('Survival demonstration ended at a different tick.', run.tick);
    return true;
  }
  function finish() {
    if (
      !terminal(run) ||
      run.tick !== proof.ticks ||
      run.phase !== proof.outcome ||
      inputIndex !== proof.inputs.length ||
      choiceIndex !== proof.choices.length ||
      checkpointIndex !== proof.checkpoints.length ||
      !survivalDemoProgress(run) ||
      survivalDemoStateIdentity(run) !== proof.finalState ||
      canonicalJSON(overflightSummary(run)) !== canonicalJSON(proof.summary)
    )
      throw fail('Survival demonstration terminal verification failed.', run.tick);
    return overflightSummary(run);
  }
  return { run, proof, step, choose, finish };
}

// Offline diagnostics reuse the exact native transcript, upgrades and verification.
export { playback as createSurvivalDemoReplay };

/** Full independent input replay; sparse checkpoints only locate divergence. */
export async function verifySurvivalDemo(
  entry,
  source,
  {
    signal,
    reportPreparation,
    yieldEvery = 240,
    yieldTask = () => new Promise((resolve) => setTimeout(resolve, 0)),
  } = {},
) {
  cancelled(signal);
  const replay = playback(entry, source);
  const progress = () =>
    reportDemoPreparation(reportPreparation, 'progress', {
      tick: replay.run.tick,
      totalTicks: replay.proof.ticks,
    });
  progress();
  while (replay.run.tick < replay.proof.ticks && !terminal(replay.run)) {
    replay.step();
    if (replay.run.tick % yieldEvery === 0) {
      progress();
      cancelled(signal);
      await yieldTask();
    }
  }
  cancelled(signal);
  progress();
  return replay.finish();
}

export async function prepareSurvivalDemoPlayer(entry, source, options = {}) {
  // Freeze a bounded copy before yielding; callers cannot mutate a verified recording.
  const { proof } = decode(entry, source);
  await verifySurvivalDemo(entry, proof, options);
  cancelled(options.signal);
  const replay = playback(entry, proof);
  let phase = 'paused',
    accumulator = 0,
    upgradeDelay = 0,
    closed = false,
    events = [];
  const player = {
    get state() {
      return replay.run;
    },
    get run() {
      return replay.run;
    },
    get phase() {
      return phase;
    },
    get events() {
      return events;
    },
    maxAdvanceSeconds: 0.25,
    play() {
      if (!closed && phase !== 'complete') phase = 'playing';
    },
    pause() {
      if (!closed && phase !== 'complete') phase = 'paused';
      accumulator = 0;
    },
    advance(seconds) {
      events = [];
      if (
        closed ||
        phase !== 'playing' ||
        !Number.isFinite(seconds) ||
        seconds < 0 ||
        seconds > 0.25
      )
        return { events };
      // Let people see the actual draft before the recorded legal choice.
      if (replay.run.phase === 'upgrade') {
        upgradeDelay += seconds;
        if (upgradeDelay < 1.5) return { events };
        replay.choose();
        events.push(...replay.run.events);
        upgradeDelay = 0;
        return { events };
      }
      accumulator += seconds;
      while (accumulator + 1e-10 >= OVERFLIGHT_STEP_SECONDS && phase === 'playing') {
        accumulator = Math.max(0, accumulator - OVERFLIGHT_STEP_SECONDS);
        replay.step();
        events.push(...replay.run.events);
        if (terminal(replay.run)) {
          replay.finish();
          phase = 'complete';
          break;
        }
        if (replay.run.phase === 'upgrade') {
          accumulator = 0;
          break;
        }
      }
      return { events };
    },
    async forkForPractice({ signal } = {}) {
      cancelled(signal);
      const tick = replay.run.tick,
        expected = survivalDemoStateIdentity(replay.run),
        nativePhase = replay.run.phase;
      const fork = playback(entry, proof);
      while (fork.run.tick < tick) {
        fork.step();
        if (fork.run.tick % 240 === 0) {
          cancelled(signal);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      // A displayed tick may be before or just after its upgrade confirmation.
      while (fork.run.phase === 'upgrade' && nativePhase !== 'upgrade') fork.choose();
      cancelled(signal);
      if (survivalDemoStateIdentity(fork.run) !== expected)
        throw fail('Survival practice checkpoint does not match the displayed performance.', tick);
      return { modeId: 'survival', run: fork.run, origin: { sourceId: entry.id, tick } };
    },
    async dispose() {
      closed = true;
      phase = 'disposed';
      events = [];
      accumulator = 0;
    },
  };
  return player;
}

export function createSurvivalDemoPractice(fork) {
  if (fork?.modeId !== 'survival' || !fork.run)
    throw new TypeError('A Survival practice fork is required.');
  const run = fork.run;
  let phase = 'paused',
    accumulator = 0,
    input = {},
    events = [],
    closed = false,
    boostHeld = false;
  const setInput = (next = {}) => {
    const directions = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
    const [x, y] = directions[next.direction] ?? [Number(next.x) || 0, Number(next.y) || 0];
    const length = Math.max(1, Math.hypot(x, y));
    const boost = next.boost === true || next.action === 'boost';
    // A fresh action waits for the next native tick. Continuous controller
    // sampling or a quick release must not erase it before that tick consumes it.
    input = { x: x / length, y: y / length, boost: input.boost || (boost && !boostHeld) };
    boostHeld = boost;
  };
  return {
    get state() {
      return run;
    },
    get run() {
      return run;
    },
    get phase() {
      return phase;
    },
    get events() {
      return events;
    },
    start(intent = {}) {
      if (!closed && !terminal(run)) {
        setInput(intent);
        phase = 'playing';
      }
    },
    play() {
      if (!closed && !terminal(run)) phase = 'playing';
    },
    steer: setInput,
    pause() {
      if (!closed) phase = 'paused';
      accumulator = 0;
      input = {};
      boostHeld = false;
    },
    chooseUpgrade(id) {
      const chosen = chooseOverflightUpgrade(run, id);
      if (chosen) input = {};
      return chosen;
    },
    rerollUpgrade() {
      return rerollOverflightUpgrades(run);
    },
    advance(seconds) {
      events = [];
      if (closed || phase !== 'playing') return { events };
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 0.25) {
        this.pause();
        return { events };
      }
      if (run.phase === 'upgrade') return { events };
      accumulator += seconds;
      while (accumulator + 1e-10 >= OVERFLIGHT_STEP_SECONDS && run.phase === 'playing') {
        accumulator = Math.max(0, accumulator - OVERFLIGHT_STEP_SECONDS);
        stepOverflight(run, input);
        events.push(...run.events);
        // Action edges are consumed once; held movement remains continuous.
        input = { ...input, boost: false };
        if (terminal(run)) {
          phase = 'complete';
          break;
        }
      }
      return { events };
    },
    async dispose() {
      closed = true;
      phase = 'disposed';
      input = {};
    },
  };
}
