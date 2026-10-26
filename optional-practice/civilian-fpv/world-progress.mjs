import { boundedJSON } from '../../game/data-json.mjs';
import { flightComparisonIdentity } from './model.mjs';
import { TUNED_RESPONSE_FORMAT } from './flight-response.mjs';
import { responseIdentity } from './radio-profile.mjs';
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
    if (step.type === 'hunt-contact-v1') {
      for (const id of step.targets) {
        const target = course.actors.find((actor) => actor.id === id).position;
        const centre = { ...target, y: target.y + 1000 };
        distance += Math.hypot(...['x', 'y', 'z'].map((key) => centre[key] - position[key])) / 1000;
        position = centre;
      }
      holdTicks += step.targets.length * 150;
    }
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
        (state.hits ?? 0) * 100 +
        (state.hunt?.caught.length ?? 0) * 250,
    ),
    ...(state.hunt ? { catches: state.hunt.caught.length, huntFailure: state.hunt.failure } : {}),
    ...(state.pursuit ? { bonusCatches: state.pursuit.bonusCaught.length } : {}),
    accuracy: state.shots ? Math.min(1, (state.hits ?? 0) / state.shots) : null,
    health: state.health ?? null,
    targets,
    sectors,
    weakest: sectors.length
      ? sectors.reduce((a, b) => (b.ticks > a.ticks ? b : a)).index
      : Math.min(state.step, course.steps[proof.mode].length - 1),
  };
}

/** Explain the current accepted grade; never award, recalibrate or persist it.
 * Worlds medals use exact 50 Hz ticks AND contact caps, without a time penalty. */
export function worldMedalGoal(result, ticks) {
  const integer = (value) => Number.isSafeInteger(value) && value >= 0;
  if (
    result?.eligible !== true ||
    !integer(ticks) ||
    result.seconds !== ticks / 50 ||
    !integer(result.contacts) ||
    !['gold', 'silver', 'bronze'].includes(result.medal)
  )
    return null;
  const targets = result.targets;
  if (
    !targets ||
    !['goldTicks', 'silverTicks', 'goldContacts', 'silverContacts'].every((key) =>
      integer(targets[key]),
    ) ||
    targets.silverTicks < targets.goldTicks ||
    targets.silverContacts < targets.goldContacts
  )
    return null;
  const accepted =
    ticks <= targets.goldTicks && result.contacts <= targets.goldContacts
      ? 'gold'
      : ticks <= targets.silverTicks && result.contacts <= targets.silverContacts
        ? 'silver'
        : 'bronze';
  if (accepted !== result.medal) return null;
  if (accepted === 'gold') return Object.freeze({ medal: accepted, next: null });
  const next = accepted === 'silver' ? 'gold' : 'silver';
  return Object.freeze({
    medal: accepted,
    next,
    targetTicks: targets[`${next}Ticks`],
    targetContacts: targets[`${next}Contacts`],
    remainingTicks: Math.max(0, ticks - targets[`${next}Ticks`]),
    excessContacts: Math.max(0, result.contacts - targets[`${next}Contacts`]),
  });
}

export function worldMedalGoalText(goal, locale = 'en') {
  if (!goal) return '';
  const uk = locale === 'uk';
  if (goal.next === null)
    return uk
      ? 'Золото здобуто: цей політ відповідає обмеженням часу й контактів.'
      : 'Gold earned: this flight met the time and contact limits.';
  const seconds = (ticks) =>
    new Intl.NumberFormat(uk ? 'uk' : 'en', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false,
    }).format(ticks / 50);
  const medal = uk
    ? goal.next === 'gold'
      ? 'золото'
      : 'срібло'
    : goal.next === 'gold'
      ? 'Gold'
      : 'Silver';
  const time = goal.remainingTicks
    ? uk
      ? `У наступній спробі скоротіть час на ${seconds(goal.remainingTicks)} с.`
      : `On your next attempt, finish ${seconds(goal.remainingTicks)} s sooner.`
    : uk
      ? 'Умова часу вже виконана.'
      : 'The time requirement is already met.';
  const contacts = goal.excessContacts
    ? uk
      ? `Потрібно менше контактів у наступній спробі: на ${goal.excessContacts}.`
      : `Your next attempt needs ${goal.excessContacts} fewer ${goal.excessContacts === 1 ? 'contact' : 'contacts'}.`
    : uk
      ? 'Умова контактів уже виконана.'
      : 'The contact requirement is already met.';
  return uk
    ? `Наступна медаль: ${medal} — не більше ${seconds(goal.targetTicks)} с; максимум контактів: ${goal.targetContacts}. ${time} ${contacts}`
    : `Next: ${medal} — at most ${seconds(goal.targetTicks)} s; contact limit: ${goal.targetContacts}. ${time} ${contacts}`;
}
/** A shortlist only: selected ghosts and sector references still replay their own proof. */
export function compatibleFlightComparison(a, b) {
  if (!a || !b) return false;
  const contextKeys = [
    'model',
    'backend',
    'courseIdentity',
    'worldIdentity',
    'mode',
    'rulesIdentity',
    'conditionsIdentity',
  ];
  if (!contextKeys.every((key) => a[key] === b[key])) return false;
  const hasComparison =
    Object.hasOwn(a, 'comparisonIdentity') || Object.hasOwn(b, 'comparisonIdentity');
  if (!hasComparison) return a.responseIdentity === b.responseIdentity;
  if (typeof a.comparisonIdentity !== 'string' || a.comparisonIdentity !== b.comparisonIdentity)
    return false;
  // Imported status labels cannot grant a different response access to a class.
  // Recompute from recorded values wherever this is a proof rather than a runtime identity.
  try {
    for (const value of [a, b]) {
      if (Object.hasOwn(value, 'frames') && !value.response) return false;
      if (
        value.response &&
        (value.response.format !== TUNED_RESPONSE_FORMAT ||
          responseIdentity(value.response) !== value.responseIdentity ||
          flightComparisonIdentity(value, value.response) !== value.comparisonIdentity)
      )
        return false;
    }
  } catch {
    return false;
  }
  return true;
}
export function compatibleGhost(record, flightIdentity) {
  return (
    record?.status === 'verified' &&
    record.diagnostic === 'complete' &&
    record.proof?.session === 'practice' &&
    compatibleFlightComparison(record.proof, flightIdentity)
  );
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
