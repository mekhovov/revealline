import { gameplayTuningDescription } from '../gameplay-tuning.mjs';

/** Browser-wide playtest controls. Hosts own attempt replacement and awards. */
export function mountGameplayTuning({ root, controller, getDifficulty, onChange = () => {} }) {
  if (!root) return null;
  const doc = root.ownerDocument;
  const details = doc.createElement('details');
  const summary = doc.createElement('summary');
  summary.textContent = 'Admin · playtest tuning';
  const help = doc.createElement('p');
  help.className = 'micro-note';
  help.textContent =
    'Global on this browser for Solo, Versus and Team. Applies to fresh attempts only; Resume keeps its rules. Custom tuning is a playtest and does not earn normal clears or awards.';
  const fields = new Map();
  const values = new Map();
  details.append(summary, help);
  for (const [key, label, min, max] of [
    ['enemySpeed', 'Enemy pace factor', 0.5, 2],
    ['playerSpeed', 'Craft pace factor', 0.75, 1.5],
    ['enemyDensity', 'Enemy count factor (authored minimum)', 0, 2],
  ]) {
    const field = doc.createElement('label');
    field.className = 'field';
    const caption = doc.createElement('span');
    caption.textContent = label;
    const input = doc.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = '0.05';
    input.setAttribute('aria-label', label);
    input.setAttribute('data-tuning', key);
    const value = doc.createElement('output');
    value.setAttribute('aria-label', `${label} value`);
    input.oninput = () => {
      value.textContent = `×${Number(input.value).toFixed(2)}`;
    };
    field.append(caption, input, value);
    fields.set(key, input);
    values.set(key, value);
    details.append(field);
  }
  const apply = doc.createElement('button');
  apply.type = 'button';
  apply.textContent = 'Apply to next attempt';
  const reset = doc.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Reset tuning';
  const note = doc.createElement('p');
  note.className = 'micro-note';
  note.setAttribute('role', 'status');
  details.append(apply, reset, note);
  root.append(details);
  const refresh = () => {
    const status = controller.status();
    for (const [key, input] of fields) {
      input.value = String(status.overrides[key]);
      values.get(key).textContent = `×${status.overrides[key].toFixed(2)}`;
    }
    const snapshot = controller.snapshot(getDifficulty());
    note.textContent =
      `${snapshot.adminOverride ? 'Playtest overrides enabled' : 'Normal difficulty presets'}. ` +
      `Next attempt: ${gameplayTuningDescription(snapshot)} ` +
      'Added counts round up, capped by safe placement in existing occupied regions; authored enemies are never removed. ' +
      (status.error || 'Saved on this browser.');
  };
  apply.onclick = () => {
    try {
      const overrides = Object.fromEntries(
        [...fields].map(([key, input]) => {
          if (input.value.trim() === '') throw new Error('Enter a value for every multiplier.');
          return [key, Number(input.value)];
        }),
      );
      controller.set(overrides);
      onChange();
      refresh();
    } catch (error) {
      note.textContent = `Tuning not applied. ${error.message}`;
    }
  };
  reset.onclick = () => {
    controller.reset();
    onChange();
    refresh();
  };
  const unsubscribe = controller.subscribe(refresh);
  refresh();
  return {
    refresh,
    dispose() {
      unsubscribe();
      details.remove();
    },
  };
}
