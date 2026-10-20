import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { createTouchPreferences, TOUCH_PREFERENCES_KEY } from '../touch-preferences.mjs';
import { resolveScreenControls } from '../input-presentation.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import {
  mountTouchControlsView,
  mountTouchPresentationSettings,
} from '../ui/touch-controls-view.mjs';

function fixture({ visibility = null, separateVisibility = false } = {}) {
  const document = new Document(),
    eventTarget = new Events(),
    storage = new Map();
  const view = mountTouchControlsView({
    document,
    mount: document.body,
    idPrefix: 'test-flight',
    actionLabel: 'Boost',
  });
  const visitMount = document.createElement('section');
  document.body.append(visitMount);
  let settings;
  const preferences = createTouchPreferences({
    eventTarget,
    storage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    onChange: (value) => {
      view.apply(value);
      settings.refresh();
    },
  });
  settings = mountTouchPresentationSettings({
    document,
    mount: document.body,
    preferences,
    idPrefix: 'test-preferences',
    visibility:
      visibility && separateVisibility ? { ...visibility, mount: visitMount } : visibility,
  });
  view.apply(preferences.snapshot());
  return { document, view, preferences, settings, storage, visitMount };
}

test('shared controls retain an independent action and expose only the chosen steering surface', () => {
  const { document, view, preferences, settings } = fixture();
  assert.equal(document.querySelector('[data-touch-visibility]'), null);
  assert.equal(view.pad.hidden, true);
  assert.equal(view.surface.hidden, false);
  assert.equal(view.actionButton.textContent, 'Boost');
  assert.equal(view.actionButton.type, 'button');
  assert.equal(view.surface.getAttribute('role'), 'group');
  assert.equal(view.directionButtons.up.getAttribute('aria-label'), 'Move up');
  preferences.set({ mode: 'dpad', side: 'left', size: 'large', opacity: 0.2 });
  assert.equal(view.pad.hidden, false);
  assert.equal(view.surface.hidden, true);
  assert.equal(view.root.style.getPropertyValue('--touch-opacity'), '0.2');
  assert.equal(view.root.dataset.touchSide, 'left');
  assert.equal(view.root.dataset.touchSize, 'large');
  view.setVisible(false);
  assert.equal(view.root.hidden, true);
  preferences.destroy();
  settings.dispose();
  view.dispose();
});

test('optional visibility binds only a visit owner, keeps shared storage exact and relocalizes the same control', (t) => {
  const previous = getLocale();
  let choice = 'auto';
  const f = fixture({
    separateVisibility: true,
    visibility: {
      get: () => choice,
      set: (value) => {
        choice = resolveScreenControls(value);
      },
      help: () => (getLocale() === 'uk' ? 'До кінця цього відвідування.' : 'For this visit.'),
      title: () => (getLocale() === 'uk' ? 'Це відвідування' : 'This visit'),
    },
  });
  t.after(() => {
    f.settings.dispose();
    f.preferences.destroy();
    f.view.dispose();
    setLocale(previous, { persist: false });
  });
  const control = f.document.getElementById('test-preferences-touch-visibility');
  assert.ok(control.closest('[data-touch-visit]')?.parentNode === f.visitMount);
  assert.equal(f.settings.root.contains(control), false);
  assert.equal(f.settings.root.querySelectorAll('[data-touch-setting]').length, 4);
  assert.deepEqual(
    [...control.children].map((node) => node.value),
    ['auto', 'always', 'off'],
  );
  const stored = [...f.storage];
  control.focus();
  control.value = 'always';
  control.emit('change');
  assert.equal(choice, 'always');
  assert.deepEqual([...f.storage], stored);
  assert.equal(Object.keys(f.preferences.snapshot()).length, 4);
  for (const locale of ['uk', 'en']) {
    setLocale(locale, { persist: false });
    f.settings.refresh();
    assert.ok(f.document.activeElement === control);
    assert.equal(control.value, 'always');
    assert.equal(
      f.visitMount.querySelector('h4').textContent,
      locale === 'uk' ? 'Це відвідування' : 'This visit',
    );
    assert.equal(
      control.children[1].textContent,
      locale === 'uk' ? 'Завжди · дотик або миша' : 'Always · touch or mouse',
    );
    assert.equal(
      f.document.getElementById(control.getAttribute('aria-describedby')).textContent,
      locale === 'uk' ? 'До кінця цього відвідування.' : 'For this visit.',
    );
  }
  control.value = 'invalid';
  assert.throws(() => control.emit('change'), /auto, always or off/);
  assert.equal(choice, 'always');
  f.settings.refresh();
  assert.equal(control.value, 'always');
  f.settings.dispose();
  assert.equal(f.visitMount.children.length, 0);
  control.value = 'off';
  control.emit('change');
  assert.equal(choice, 'always', 'Disposal retires only this row listener.');
});

test('settings persist all four shared fields without clamping opacity and detach on disposal', () => {
  const { document, preferences, settings, storage, view } = fixture();
  for (const [key, value] of [
    ['mode', 'swipe'],
    ['side', 'left'],
    ['size', 'large'],
    ['opacity', '0.2'],
  ]) {
    const control = document.getElementById(`test-preferences-touch-${key}`);
    control.value = value;
    control.emit('change');
  }
  assert.deepEqual(JSON.parse(storage.get(TOUCH_PREFERENCES_KEY)), {
    mode: 'swipe',
    side: 'left',
    size: 'large',
    opacity: 0.2,
  });
  assert.equal(view.surface.children[1].textContent, 'Swipe to turn');
  const retired = document.getElementById('test-preferences-touch-mode');
  settings.dispose();
  retired.value = 'stick';
  retired.emit('change');
  assert.equal(preferences.snapshot().mode, 'swipe');
  preferences.destroy();
  view.dispose();
});
