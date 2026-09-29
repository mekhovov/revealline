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
