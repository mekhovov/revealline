import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { createTouchPreferences, TOUCH_PREFERENCES_KEY } from '../touch-preferences.mjs';
import {
  mountTouchControlsView,
  mountTouchPresentationSettings,
} from '../ui/touch-controls-view.mjs';

function fixture({ silent = false } = {}) {
  const document = new Document(),
    eventTarget = new Events(),
    storage = new Map();
  const view = mountTouchControlsView({
    document,
    mount: document.body,
    idPrefix: 'test-flight',
    actionLabel: 'Boost',
  });
  let settings,
    failWrite = silent;
  const preferences = createTouchPreferences({
    eventTarget,
    storage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        if (!failWrite) storage.set(key, value);
      },
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
  return {
    document,
    view,
    preferences,
    settings,
    storage,
    working: () => {
      failWrite = false;
    },
  };
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

test('touch recovery translates existing status, preserves field focus, and retires cleanly', (t) => {
  const original = getLocale();
  setLocale('en', { persist: false });
  const f = fixture({ silent: true });
  t.after(() => {
    f.settings.dispose();
    f.preferences.destroy();
    f.view.dispose();
    setLocale(original, { persist: false });
  });
  const mode = f.document.getElementById('test-preferences-touch-mode');
  const status = f.document.getElementById('test-preferences-touch-save-status');
  const retry = f.document.getElementById('test-preferences-touch-save-retry');
  assert.equal(status.hidden, true);
  mode.focus();
  mode.value = 'swipe';
  mode.emit('change');
  assert.equal(f.document.activeElement, mode);
  assert.match(status.textContent, /Session only.*did not confirm/);
  assert.equal(mode.getAttribute('aria-describedby'), status.id);
  assert.equal(retry.hidden, false);
  setLocale('uk', { persist: false });
  assert.match(status.textContent, /Лише на цей сеанс/);
  assert.equal(f.document.activeElement, mode);
  assert.equal(mode.value, 'swipe');
  retry.focus();
  f.working();
  retry.click();
  assert.equal(f.document.activeElement, mode);
  assert.equal(retry.hidden, true);
  assert.equal(f.preferences.persistence().status, 'saved');
  assert.equal(JSON.parse(f.storage.get(TOUCH_PREFERENCES_KEY)).mode, 'swipe');
  const saved = status.textContent;
  f.settings.dispose();
  setLocale('en', { persist: false });
  assert.equal(status.textContent, saved, 'Disposed settings no longer react to locale changes.');
  retry.click();
  assert.equal(f.preferences.persistence().status, 'saved');
});
