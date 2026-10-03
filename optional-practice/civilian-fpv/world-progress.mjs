import { boundedJSON } from '../../game/data-json.mjs';
import {
  createWorldFlight,
  initWorldRuntime,
  replayWorldFlight,
  validateWorldCourse,
  WORLD_MAX_TICKS,
} from './world-model.mjs';
export { createSectorTracker } from './flight-sectors.mjs';

const centre = (step) =>
  step.min
    ? Object.fromEntries(['x', 'y', 'z'].map((k) => [k, (step.min[k] + step.max[k]) / 2]))
    : step.type === 'gate'
      ? {
          x: step.axis === 'x' ? step.at : (step.minSide + step.maxSide) / 2,
          y: (step.minY + step.maxY) / 2,
          z: step.axis === 'z' ? step.at : (step.minSide + step.maxSide) / 2,
        }
      : null;

/** Provisional mode-specific playtest targets. Content review can supply overrides. */
export function medalTargets(course, mode = 'self-level') {
  const steps = course.steps[mode];
  let position = course.spawn,
    distance = 0,
    holdTicks = 0;
  for (const step of steps) {
    const point = centre(step);
    if (point) {
      distance += Math.hypot(...['x', 'y', 'z'].map((k) => point[k] - position[k])) / 1000;
      position = point;
    }
    holdTicks += step.ticks ?? 0;
    if (step.type === 'eliminate') holdTicks += step.targets.length * 250;
  }
  const base = Math.ceil(
    (distance / 2.6 + holdTicks / 50 + 20) * (mode === 'acro' ? 1.25 : 1) * 50,
  );
  return {
    goldTicks: base,
    silverTicks: Math.ceil(base * 1.8),
    goldContacts: 0,
    silverContacts: 4,
  };
}
export function evaluateWorldResult(
  course,
  proof,
  state,
  { targets = medalTargets(course, proof.mode), sectors = [] } = {},
) {
  const eligible = proof.session === 'practice' && state.status === 'complete';
  const clean = state.contacts ?? 0;
  const medal = !eligible
    ? null
    : state.ticks <= targets.goldTicks && clean <= targets.goldContacts
      ? 'gold'
      : state.ticks <= targets.silverTicks && clean <= targets.silverContacts
        ? 'silver'
        : 'bronze';
  const completed = Math.min(state.step, course.steps[proof.mode].length);
  return {
    eligible,
    medal,
    seconds: state.ticks / 50,
    contacts: clean,
    score: Math.max(
      0,
      completed * 1000 +
        (eligible ? 5000 : 0) -
        Math.floor(state.ticks / 5) -
        clean * 125 +
        (state.hits ?? 0) * 100,
    ),
    accuracy: state.shots ? Math.min(1, (state.hits ?? 0) / state.shots) : null,
    health: state.health ?? null,
    targets,
    sectors,
    weakest: sectors.length
      ? sectors.reduce((a, b) => (b.ticks > a.ticks ? b : a)).index
      : Math.min(state.step, course.steps[proof.mode].length - 1),
  };
}
export function compatibleGhost(record, flightIdentity) {
  const a = record?.proof,
    b = flightIdentity;
  if (
    record?.status !== 'verified' ||
    record.diagnostic !== 'complete' ||
    a?.session !== 'practice' ||
    !a ||
    !b
  )
    return false;
  return [
    'model',
    'backend',
    'courseIdentity',
    'worldIdentity',
    'mode',
    'responseIdentity',
    'rulesIdentity',
    'conditionsIdentity',
  ].every((key) => a[key] === b[key]);
}

/** Legacy callers receive the safe, complete original course. A geometric
 * checkpoint cannot reconstruct entry velocity, attitude, actors or skill state. */
export function checkpointPractice(input, mode, index) {
  const c = validateWorldCourse(input);
  if (!['self-level', 'acro'].includes(mode)) throw new TypeError('Unsupported flight mode.');
  if (!Number.isInteger(index) || index < 0 || index >= c.steps[mode].length)
    throw new TypeError('Unknown checkpoint.');
  return c;
}

/** Reconstruct a checkpoint through recorded commands, never a saved pose.
 * Both selected-objective and safe full-route fallback flights reject recorders.
 * The caller owns disposal and must require explicit arming with fresh input. */
export async function prepareCheckpointPractice(input, mode, index, options = {}) {
  return prepareRecordedSection(input, mode, index, options, false);
}

/** Watch one verified section, including the available part of an unfinished
 * attempt. The private proof and exclusive end tick must stay together: callers
 * must not play a command at endTick or persist this unscored flight. */
export async function prepareSectionReplay(input, mode, index, options = {}) {
  return prepareRecordedSection(input, mode, index, options, true);
}

async function prepareRecordedSection(
  input,
  mode,
  index,
  {
    proof = null,
    response,
    signal,
    yieldControl = () => new Promise((resolve) => setTimeout(resolve, 0)),
  } = {},
  watch,
) {
  const course = checkpointPractice(input, mode, index);
  signal?.throwIfAborted();
  await initWorldRuntime();
  signal?.throwIfAborted();
  let checkedProof = null,
    startTick = 0,
    endTick = null,
    sectionComplete = false,
    recordedStatus = null,
    reason = 'missing-proof';
  if (proof !== null && proof !== undefined) {
    try {
      // Retain our own bounded copy across cooperative yields. Reusing the
      // caller's mutable frames after verification would invalidate provenance.
      const candidate = boundedJSON(proof, {
        maxBytes: 2 * 1024 * 1024,
        maxNodes: WORLD_MAX_TICKS * 7 + 1000,
        maxArray: WORLD_MAX_TICKS,
        maxDepth: 10,
      });
      if (candidate.mode !== mode) reason = 'incompatible-proof';
      else {
        const checked = await replayWorldFlight(course, candidate, {
          includeSectors: true,
          signal,
          yieldControl,
        });
        const boundary = index === 0 ? 0 : checked.sectors[index - 1]?.endTick;
        if (boundary === undefined || checked.state.step < index) reason = 'unreached-checkpoint';
        else if (watch && boundary >= candidate.frames.length) reason = 'empty-section';
        else {
          checkedProof = candidate;
          startTick = boundary;
          sectionComplete = Boolean(checked.sectors[index]);
          endTick = checked.sectors[index]?.endTick ?? candidate.frames.length;
          recordedStatus = checked.state.status;
          reason = null;
        }
      }
    } catch (error) {
      signal?.throwIfAborted();
      if (error?.name === 'AbortError') throw error;
      reason = 'invalid-proof';
    }
  }
  signal?.throwIfAborted();
  const startStep = checkedProof ? index : 0,
    stopStep = checkedProof ? index + 1 : course.steps[mode].length,
    flight = createWorldFlight({
      course,
      mode,
      response: checkedProof?.response ?? response,
      unscoredPractice: true,
      practiceEndStep: stopStep,
    });
  try {
    flight.arm();
    for (let tick = 0; tick < startTick; tick++) {
      if (tick % 200 === 0) {
        signal?.throwIfAborted();
        await yieldControl();
        signal?.throwIfAborted();
      }
      const [roll, pitch, yaw, throttle, actions] = checkedProof.frames[tick];
      flight.step({ roll, pitch, yaw, throttle, actions }, { quantized: true });
    }
    signal?.throwIfAborted();
    if (flight.snapshot().step !== startStep || flight.snapshot().status !== 'active')
      throw new Error('Verified checkpoint did not reconstruct its entry state');
    flight.pause();
    const state = flight.snapshot();
    return {
      flight,
      kind: checkedProof ? (watch ? 'section-replay' : 'checkpoint') : 'full-attempt',
      reason,
      requestedIndex: index,
      index: startStep,
      goalCount: stopStep - startStep,
      stopStep,
      startTick,
      mode,
      response: flight.response(),
      pickup: Object.fromEntries(
        ['roll', 'pitch', 'yaw', 'throttle'].map((key) => [key, state.lastInput[key] / 1000]),
      ),
      ...(watch ? { proof: checkedProof, endTick, sectionComplete, recordedStatus } : {}),
    };
  } catch (error) {
    flight.dispose();
    throw error;
  }
}
