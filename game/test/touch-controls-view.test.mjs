import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { createTouchPreferences, TOUCH_PREFERENCES_KEY } from '../touch-preferences.mjs';
import {
  mountTouchControlsView,
  mountTouchPresentationSettings,
} from '../ui/touch-controls-view.mjs';

function fixture() {
  const document = new Document(),
    eventTarget = new Events(),
    storage = new Map();
  const view = mountTouchControlsView({
    document,
    mount: document.body,
    idPrefix: 'test-flight',
    actionLabel: 'Boost',
  });
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
  });
  view.apply(preferences.snapshot());
  return { document, view, preferences, settings, storage };
}

test('shared controls retain an independent action and expose only the chosen steering surface', () => {
  const { view, preferences, settings } = fixture();
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
