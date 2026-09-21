import { createTouchPreferences } from '../touch-preferences.mjs';

/** Both local seats use Solo's gesture engine and preference vocabulary. */
export function attachCouchTouch({
  document: doc = globalThis.document,
  controls,
  clear = () => {},
}) {
  const pads = [...doc.querySelectorAll('.race-pad')];
  let preferences;
  function paint() {
    const settings = preferences.snapshot();
    for (const pad of pads) {
      pad.dataset.touchMode = settings.mode;
      pad.dataset.touchSize = settings.size;
      pad.style.setProperty('--touch-opacity', settings.opacity);
      pad.querySelector('.race-cross').hidden = settings.mode !== 'dpad';
      pad.querySelector('.touch-surface').hidden = settings.mode === 'dpad';
      pad.querySelector('.touch-instruction').textContent =
        settings.mode === 'swipe' ? 'Swipe to steer' : 'Drag to steer';
    }
    for (const field of controls.querySelectorAll('[data-touch-setting]'))
      field.value = String(settings[field.dataset.touchSetting]);
    const status = group.querySelector('[role="status"]');
    if (status) status.textContent = preferences.warning();
  }
  preferences = createTouchPreferences({
    onChange: () => {
      clear();
      paint();
    },
  });
  for (const pad of pads) {
    const surface = doc.createElement('div');
    surface.className = 'touch-surface';
    surface.setAttribute('role', 'group');
    const compass = doc.createElement('span');
    compass.textContent = '✥';
    compass.setAttribute('aria-hidden', 'true');
    const instruction = doc.createElement('span');
    instruction.className = 'touch-instruction';
    surface.append(compass, instruction);
    surface.setAttribute('aria-label', `Player ${Number(pad.dataset.player) + 1} steering area`);
    const indicator = doc.createElement('span');
    indicator.className = 'touch-indicator';
    indicator.hidden = true;
    indicator.setAttribute('aria-hidden', 'true');
    indicator.append(doc.createElement('i'));
    pad.append(surface, ...pad.children, indicator);
  }
  const group = doc.createElement('fieldset');
  const legend = doc.createElement('legend');
  legend.textContent = 'Shared touch controls';
  group.append(legend);
  for (const [key, title, choices] of [
    [
      'mode',
      'Steering',
      [
        ['stick', 'Floating stick'],
        ['swipe', 'Swipe'],
        ['dpad', 'Direction pad'],
      ],
    ],
    [
      'size',
      'Control size',
      [
        ['regular', 'Regular'],
        ['large', 'Large'],
      ],
    ],
    [
      'opacity',
      'Visibility',
      [
        ['0.55', 'Soft'],
        ['1', 'Solid'],
      ],
    ],
  ]) {
    const label = doc.createElement('label'),
      select = doc.createElement(key === 'opacity' ? 'input' : 'select');
    if (key === 'opacity') {
      select.type = 'range';
      select.min = '0.2';
      select.max = '1';
      select.step = '0.05';
    }
    label.textContent = title;
    select.dataset.touchSetting = key;
    for (const [value, text] of key === 'opacity' ? [] : choices) {
      const option = doc.createElement('option');
      option.value = value;
      option.textContent = text;
      select.append(option);
    }
    select.onchange = () =>
      preferences.set({
        ...preferences.snapshot(),
        [key]: key === 'opacity' ? Number(select.value) : select.value,
      });
    label.append(select);
    group.append(label);
  }
  const status = doc.createElement('p');
  status.setAttribute('role', 'status');
  group.append(status);
  controls.append(group);
  paint();
  return {
    snapshot: preferences.snapshot,
    destroy: () => {
      preferences.destroy();
      group.remove();
    },
  };
}
