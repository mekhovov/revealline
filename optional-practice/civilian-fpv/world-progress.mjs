import { dataIdentity } from '../../game/data-json.mjs';
import { validateWorldCourse } from './world-model.mjs';

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
export function createSectorTracker() {
  let step = 0,
    last = 0,
    sectors = [];
  return {
    consume(state) {
      if (state.step > step) {
        for (let i = step; i < state.step; i++)
          sectors.push({ index: i, ticks: state.ticks - last, endTick: state.ticks });
        step = state.step;
        last = state.ticks;
      }
    },
    snapshot() {
      return structuredClone(sectors);
    },
    reset() {
      step = 0;
      last = 0;
      sectors = [];
    },
  };
}
export function compatibleGhost(record, flightIdentity) {
  const a = record?.proof,
    b = flightIdentity;
  if (
    record?.status !== 'verified' ||
    record.diagnostic !== 'complete' ||
    record.proof.session !== 'practice' ||
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

/** A checkpoint is a new unscored authoring session, never a shortened scored proof. */
export function checkpointPractice(input, mode, index) {
  const c = validateWorldCourse(input);
  if (!Number.isInteger(index) || index < 0 || index >= c.steps[mode].length)
    throw new TypeError('Unknown checkpoint.');
  const target = c.steps[mode][index],
    previous = centre(c.steps[mode][Math.max(0, index - 1)]);
  c.id = `${c.id.slice(0, 55)}-practice-${index}`;
  c.revision = `p-${dataIdentity({ mode, index }).slice(-12)}`;
  for (const lang of ['en', 'uk'])
    c.locales[lang].title =
      `${c.locales[lang].title} · ${lang === 'uk' ? 'тренування' : 'practice'}`;
  // Keep the known-safe original spawn when no prior spatial checkpoint exists.
  if (index > 0 && previous)
    c.spawn = {
      x: Math.round(previous.x),
      y: Math.max(300, Math.round(previous.y)),
      z: Math.round(previous.z),
    };
  c.steps = { 'self-level': [structuredClone(target)], acro: [structuredClone(target)] };
  return validateWorldCourse(c);
}
