import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { createTouchPreferences, TOUCH_PREFERENCES_KEY } from '../touch-preferences.mjs';
import { resolveScreenControls } from '../input-presentation.mjs';
import {
  mountTouchControlsView,
  mountTouchPresentationSettings,
} from '../ui/touch-controls-view.mjs';

function fixture({ visibility = null, separateVisibility = false, silent = false } = {}) {
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
    visibility:
      visibility && separateVisibility ? { ...visibility, mount: visitMount } : visibility,
  });
  view.apply(preferences.snapshot());
  return {
    document, view, preferences, settings, storage, visitMount,
    working: () => { failWrite = false; },
  };
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


test('touch Retry fallback preserves the independent visit description and returns to touch settings', (t) => {
  const previous = getLocale();
  setLocale('en', { persist: false });
  let choice = 'auto';
  const f = fixture({
    silent: true,
    separateVisibility: true,
    visibility: {
      get: () => choice,
      set: (value) => { choice = resolveScreenControls(value); },
      help: () => 'For this visit.',
      title: () => 'This visit',
    },
  });
  t.after(() => {
    f.settings.dispose();
    f.preferences.destroy();
    f.view.dispose();
    setLocale(previous, { persist: false });
  });
  const visit = f.document.getElementById('test-preferences-touch-visibility');
  const mode = f.document.getElementById('test-preferences-touch-mode');
  const retry = f.document.getElementById('test-preferences-touch-save-retry');
  const help = visit.getAttribute('aria-describedby');
  assert.equal(help, 'test-preferences-touch-visibility-help');
  assert.equal(f.document.getElementById(help).textContent, 'For this visit.');
  visit.focus();
  // Another accepted owner may leave pending touch fields before this view's
  // first local touch change. Retry must still return to a touch field.
  f.preferences.set({ ...f.preferences.snapshot(), mode: 'swipe' });
  assert.equal(f.document.activeElement, visit);
  assert.equal(retry.hidden, false);
  assert.equal(visit.getAttribute('aria-describedby'), help);
  retry.focus();
  f.working();
  retry.click();
  assert.equal(f.document.activeElement, mode);
  assert.equal(f.preferences.persistence().status, 'saved');
  assert.equal(retry.hidden, true);
  assert.equal(visit.getAttribute('aria-describedby'), help);
  assert.equal(choice, 'auto');
  assert.deepEqual(JSON.parse(f.storage.get(TOUCH_PREFERENCES_KEY)), {
    ...f.preferences.snapshot(),
  });
  assert.equal(Object.keys(f.preferences.snapshot()).length, 4);
});
