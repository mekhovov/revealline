import { STICK_LAYOUTS } from './radio-profile.mjs';

export function radioControlLabel(control, mode = 2, locale = 'en') {
  const uk = locale === 'uk';
  const names = uk
    ? { roll: 'Крен', pitch: 'Тангаж', yaw: 'Рискання', throttle: 'Газ' }
    : { roll: 'Roll', pitch: 'Pitch', yaw: 'Yaw', throttle: 'Throttle' };
  const position = (STICK_LAYOUTS[mode] ?? STICK_LAYOUTS[2]).indexOf(control);
  if (position < 0) throw new Error('Unknown flight control');
  const stick =
    position < 2 ? (uk ? 'лівий стік' : 'left stick') : uk ? 'правий стік' : 'right stick';
  const direction =
    position % 2 === 0 ? (uk ? 'ліворуч/праворуч' : 'left/right') : uk ? 'вгору/вниз' : 'up/down';
  return `${names[control]} — ${stick} ${direction}`;
}

export function captureRadioSwitch(before, after) {
  if (
    !Array.isArray(before) ||
    !Array.isArray(after) ||
    before.length !== after.length ||
    after.length > 256
  )
    return null;
  const changed = [];
  for (let index = 0; index < after.length; index++) {
    const a = before[index],
      b = after[index];
    if (![a, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) return null;
    if (Math.abs(b - a) >= 0.4)
      changed.push({ button: index, threshold: (a + b) / 2, invert: b < a });
  }
  return changed.length === 1 ? changed[0] : null;
}

export function captureRadioControlSwitch(
  before,
  after,
  flightAxes = [],
  allowPositionPair = false,
) {
  const button = captureRadioSwitch(before.buttons, after.buttons);
  if (
    !Array.isArray(before.axes) ||
    !Array.isArray(after.axes) ||
    before.axes.length !== after.axes.length ||
    after.axes.length > 64
  )
    return null;
  const changed = [];
  for (let axis = 0; axis < after.axes.length; axis++) {
    const off = before.axes[axis],
      on = after.axes[axis];
    if (![off, on].every((v) => Number.isFinite(v) && v >= -1 && v <= 1)) return null;
    if (Math.abs(on - off) >= 0.5) changed.push({ axis, off, on });
  }
  // Never silently choose a button over an axis when multiple controls moved.
  const buttonChanges = before.buttons.filter(
    (value, i) => Math.abs(after.buttons[i] - value) >= 0.4,
  ).length;
  if (buttonChanges) {
    if (changed.length) return null;
    if (buttonChanges === 1) return button;
    // EdgeTX Normal switches expose one held button per position. A round-trip
    // capture may recognize the releasing OFF and pressing ON position together.
    if (allowPositionPair && buttonChanges === 2) {
      const rising = after.buttons
        .map((value, i) => ({ value, i }))
        .filter(({ value, i }) => before.buttons[i] <= 0.1 && value >= 0.9);
      const falling = after.buttons.filter((value, i) => before.buttons[i] >= 0.9 && value <= 0.1);
      if (rising.length === 1 && falling.length === 1)
        return { button: rising[0].i, threshold: 0.5, invert: false };
    }
    return null;
  }
  return changed.length === 1 && !flightAxes.includes(changed[0].axis) ? changed[0] : null;
}

/** Observe one stable OFF → ON → OFF action without acquiring flight input. */
export function createRadioSwitchCapture({ flightAxes = [], holdMs = 160 } = {}) {
  let baseline = null,
    candidate = null,
    candidateValues = null,
    since = null,
    baselineSince = null,
    lastTime = null,
    state = 'listening';
  const snapshot = (pad) => ({
    axes: [...pad.axes],
    buttons: pad.buttons.map((b) => b.value ?? b),
  });
  const near = (a, b) =>
    a &&
    b &&
    a.axes.length === b.axes.length &&
    a.buttons.length === b.buttons.length &&
    a.axes.every((v, i) => flightAxes.includes(i) || Math.abs(v - b.axes[i]) < 0.12) &&
    a.buttons.every((v, i) => Math.abs(v - b.buttons[i]) < 0.12);
  return {
    state: () => state,
    sample(pad, now) {
      if (state === 'error') return { state };
      if (state === 'done')
        return { state, binding: candidate, before: baseline, after: candidateValues };
      const values = snapshot(pad);
      if (
        !values.axes.every((v) => Number.isFinite(v) && v >= -1 && v <= 1) ||
        !values.buttons.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)
      )
        return { state: (state = 'error') };
      if (lastTime !== null && (now - lastTime > 350 || now < lastTime)) {
        baseline = null;
        candidate = null;
        since = null;
        state = 'listening';
      }
      lastTime = now;
      if (!baseline || baselineSince === null) {
        baseline = values;
        baselineSince = now;
        return { state };
      }
      if (now - baselineSince < 250) {
        if (!near(baseline, values)) {
          baseline = values;
          baselineSince = now;
        }
        return { state };
      }
      if (state === 'return') {
        if (!near(baseline, values)) since = null;
        else if (since === null) since = now;
        else if (now - since >= 200) state = 'done';
        return { state, binding: candidate, before: baseline, after: candidateValues };
      }
      const binding = captureRadioControlSwitch(baseline, values, flightAxes, true);
      if (!binding) {
        candidate = null;
        since = null;
        return { state };
      }
      if (
        !candidate ||
        (candidate.axis ?? `b${candidate.button}`) !== (binding.axis ?? `b${binding.button}`) ||
        !near(candidateValues, values)
      ) {
        candidate = binding;
        candidateValues = values;
        since = now;
      } else if (now - since >= holdMs) {
        state = 'return';
        since = null;
      }
      return { state, binding: candidate, before: baseline, after: candidateValues };
    },
  };
}
