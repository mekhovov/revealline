import { t, localizedText } from '../i18n/index.mjs';
import { gameplayTuningDescription } from '../gameplay-tuning.mjs';

/** Browser-wide playtest controls. Hosts own attempt replacement and awards. */
export function mountGameplayTuning({ root, controller, getDifficulty, onChange = () => {} }) {
  if (!root) return null;
  const doc = root.ownerDocument;
  const details = doc.createElement('details');
  const summary = doc.createElement('summary');
  localizedText(summary, () => t('interface:adminPlaytestTuning'));
  const help = doc.createElement('p');
  help.className = 'micro-note';
  localizedText(help, () => t('interface:globalOnThisBrowserForSoloVersusAndTeamApplies'));
  const fields = new Map();
  const values = new Map();
  details.append(summary, help);
  for (const [key, label, min, max] of [
    ['enemySpeed', t('interface:enemyPaceFactor'), 0.5, 2],
    ['playerSpeed', t('interface:craftPaceFactor'), 0.75, 1.5],
    ['enemyDensity', t('interface:enemyCountFactorAuthoredMinimum'), 0, 2],
  ]) {
    const field = doc.createElement('label');
    field.className = 'field';
    const caption = doc.createElement('span');
    localizedText(caption, () => label);
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
      localizedText(value, () => `×${Number(input.value).toFixed(2)}`);
    };
    field.append(caption, input, value);
    fields.set(key, input);
    values.set(key, value);
    details.append(field);
  }
  const apply = doc.createElement('button');
  apply.type = 'button';
  localizedText(apply, () => t('interface:applyToNextAttempt'));
  const reset = doc.createElement('button');
  reset.type = 'button';
  localizedText(reset, () => t('interface:resetTuning'));
  const note = doc.createElement('p');
  note.className = 'micro-note';
  note.setAttribute('role', 'status');
  details.append(apply, reset, note);
  root.append(details);
  const refresh = () => {
    const status = controller.status();
    for (const [key, input] of fields) {
      input.value = String(status.overrides[key]);
      localizedText(values.get(key), () => `×${status.overrides[key].toFixed(2)}`);
    }
    const snapshot = controller.snapshot(getDifficulty());
    localizedText(
      note,
      () =>
        `${snapshot.adminOverride ? t('interface:playtestOverridesEnabled') : t('interface:normalDifficultyPresets')}. ` +
        `Next attempt: ${gameplayTuningDescription(snapshot)} ` +
        'Added counts round up, capped by safe placement in existing occupied regions; authored enemies are never removed. ' +
        (status.error || t('interface:savedOnThisBrowser')),
    );
  };
  apply.onclick = () => {
    try {
      const overrides = Object.fromEntries(
        [...fields].map(([key, input]) => {
          if (input.value.trim() === '')
            throw new Error(t('interface:enterAValueForEveryMultiplier'));
          return [key, Number(input.value)];
        }),
      );
      controller.set(overrides);
      onChange();
      refresh();
    } catch (error) {
      localizedText(note, () => `Tuning not applied. ${error.message}`);
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
