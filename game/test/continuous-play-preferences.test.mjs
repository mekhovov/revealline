import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTINUOUS_PLAY_KEY,
  CONTINUOUS_PLAY_DEFAULTS,
  continuousPlayPreferences,
  continuousPlayBindings,
} from '../ui/continuous-play.mjs';
import { mountGlobalSettings } from '../ui/global-settings-view.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import {
  simContinuousPlayPreferences,
  simContinuousPlayBindings,
} from '../../optional-practice/civilian-fpv/flight-fullscreen.mjs';

function fixture(t, initial = CONTINUOUS_PLAY_DEFAULTS, create = continuousPlayPreferences) {
  let stored = JSON.stringify(initial),
    fail = null,
    writeCount = 0,
    silent = false,
    duringWrite = null;
  const window = new Events();
  const storage = {
    getItem: () => stored,
    setItem(_key, raw) {
      writeCount++;
      if (fail) throw fail;
      if (!silent) stored = raw;
      duringWrite?.();
    },
  };
  const preferences = create({ storage, window });
  t.after(() => preferences.dispose());
  return {
    preferences,
    window,
    storage,
    writes: () => writeCount,
    saved: () => JSON.parse(stored),
    fail(error) {
      fail = error;
    },
    silent(value) {
      silent = value;
    },
    duringWrite(value) {
      duringWrite = value;
    },
    external(value, { emit = true, storageArea = storage, key = CONTINUOUS_PLAY_KEY } = {}) {
      stored = value === null ? null : JSON.stringify(value);
      if (emit) window.emit('storage', { key, newValue: stored, storageArea });
    },
  };
}

test('continuous-play feedback starts unclaimed and reports Saved only after a verified explicit write', (t) => {
  const h = fixture(t);
  assert.equal(h.writes(), 0);
  assert.equal(h.preferences.persistence('autoNext').status, 'idle');
  h.preferences.retry();
  assert.equal(h.writes(), 0, 'Retry cannot manufacture a startup write');
  assert.deepEqual(h.preferences.set('autoNext', false), { status: 'saved', reason: '' });
  assert.equal(h.saved().autoNext, false);
  assert.equal(h.preferences.persistence('autoRetry').status, 'idle');
  assert.throws(() => h.preferences.set('__proto__', true), /Unknown/);
  assert.equal(h.writes(), 1);
});

test('failed choices survive another tab and retry preserves the newest untouched saved values', (t) => {
  const h = fixture(t);
  h.fail(Object.assign(new Error('Full'), { name: 'QuotaExceededError' }));
  h.preferences.set('autoNext', false);
  assert.deepEqual(h.preferences.persistence('autoNext'), { status: 'session', reason: 'full' });
  h.external({ autoNext: true, autoRetry: false, autoReplay: true });
  assert.deepEqual(h.preferences.snapshot(), {
    autoNext: false,
    autoRetry: false,
    autoReplay: true,
  });
  assert.equal(h.preferences.persistence('autoNext').status, 'session');
  // A still newer write need not have delivered its storage event before Retry.
  h.external({ autoNext: true, autoRetry: false, autoReplay: false }, { emit: false });
  h.fail(null);
  h.preferences.retry();
  assert.deepEqual(h.saved(), { autoNext: false, autoRetry: false, autoReplay: false });
  assert.deepEqual(h.preferences.snapshot(), h.saved());
  assert.deepEqual(h.preferences.persistence('autoNext'), { status: 'saved', reason: '' });
});

test('an unverified write stays session-only until a later retry is read back', (t) => {
  const h = fixture(t);
  h.silent(true);
  h.preferences.set('autoRetry', false);
  assert.equal(h.preferences.snapshot().autoRetry, false);
  assert.deepEqual(h.preferences.persistence('autoRetry'), { status: 'session', reason: 'verify' });
  h.silent(false);
  h.preferences.retry();
  assert.equal(h.preferences.persistence('autoRetry').status, 'saved');
  assert.equal(h.saved().autoRetry, false);
});

test('unavailable storage and browser denial retain distinct real reasons', (t) => {
  const preferences = continuousPlayPreferences({ storage: null, window: null });
  t.after(() => preferences.dispose());
  assert.deepEqual(preferences.set('autoReplay', false), {
    status: 'session',
    reason: 'unavailable',
  });
  const h = fixture(t);
  h.fail(Object.assign(new Error('Denied'), { name: 'SecurityError' }));
  h.preferences.set('autoNext', false);
  assert.deepEqual(h.preferences.persistence('autoNext'), { status: 'session', reason: 'blocked' });
});

test('newer intent during a save is not acknowledged or replaced by the older write', (t) => {
  const h = fixture(t);
  h.duringWrite(() => {
    h.duringWrite(null);
    h.preferences.set('autoReplay', false);
  });
  h.preferences.set('autoNext', false);
  assert.deepEqual(h.preferences.snapshot(), {
    autoNext: false,
    autoRetry: true,
    autoReplay: false,
  });
  assert.equal(h.preferences.persistence('autoNext').status, 'session');
  assert.equal(h.preferences.persistence('autoReplay').status, 'session');
  h.preferences.retry();
  assert.deepEqual(h.saved(), h.preferences.snapshot());
  assert.equal(h.preferences.persistence('autoReplay').status, 'saved');
});

test('foreign storage events are ignored and clearing storage keeps unsaved local intent', (t) => {
  const h = fixture(t);
  h.preferences.set('autoRetry', false);
  h.external(CONTINUOUS_PLAY_DEFAULTS, { storageArea: {} });
  assert.equal(h.preferences.snapshot().autoRetry, false);
  h.fail(new Error('Write failed'));
  h.preferences.set('autoNext', false);
  h.external(null, { key: null });
  assert.deepEqual(h.preferences.snapshot(), {
    autoNext: false,
    autoRetry: true,
    autoReplay: true,
  });
  assert.equal(h.preferences.persistence('autoNext').status, 'session');
  assert.equal(h.preferences.persistence('autoRetry').status, 'idle');
});

test('the generated SIM settings owner retains the same failure and recovery contract', (t) => {
  const h = fixture(t, CONTINUOUS_PLAY_DEFAULTS, simContinuousPlayPreferences),
    bindings = simContinuousPlayBindings(h.preferences);
  h.fail(new Error('Write failed'));
  bindings.autoReplay.set(false);
  h.external({ autoNext: false, autoRetry: false, autoReplay: true });
  assert.equal(bindings.autoReplay.get(), false);
  assert.match(bindings.autoReplay.feedback('uk').text, /Лише для цього сеансу/);
  h.fail(null);
  bindings.autoReplay.retry();
  assert.deepEqual(h.saved(), { autoNext: false, autoRetry: false, autoReplay: false });
  assert.equal(bindings.autoReplay.feedback('en').text, 'Saved on this device.');
});

for (const locale of ['en', 'uk'])
  test(`real preference failures render localized retry and clear only on successful save (${locale})`, (t) => {
    const h = fixture(t),
      document = new Document(),
      root = document.createElement('dialog'),
      gameplay = document.createElement('section');
    root.append(gameplay);
    document.body.append(root);
    root.showModal();
    const view = mountGlobalSettings({
      document,
      root,
      panels: { gameplay },
      locale,
      bindings: continuousPlayBindings(h.preferences),
    });
    t.after(() => view.destroy());
    const input = document.getElementById('global-settings-autoNext'),
      row = input.closest('[data-global-setting]'),
      status = row.querySelector('[role="status"]'),
      retry = row.querySelector('button'),
      other = document.getElementById('global-settings-autoRetry');
    assert.equal(status.hidden, true);
    assert.equal(retry.hidden, true);
    h.fail(Object.assign(new Error('Full'), { name: 'QuotaExceededError' }));
    input.focus();
    input.checked = false;
    input.emit('change');
    assert.equal(document.activeElement, input);
    assert.match(status.textContent, locale === 'uk' ? /сеансу.*заповнене/ : /Session only.*full/);
    assert.equal(retry.hidden, false);
    assert.equal(input.getAttribute('aria-describedby'), status.id);
    retry.focus();
    retry.click();
    assert.equal(document.activeElement, retry);
    assert.equal(retry.hidden, false, 'another failure does not dismiss recovery');
    // Model native focus loss when the focused button becomes hidden.
    let hidden = retry.hidden;
    Object.defineProperty(retry, 'hidden', {
      configurable: true,
      get: () => hidden,
      set(value) {
        hidden = value;
        if (value && document.activeElement === retry) document.activeElement = document.body;
      },
    });
    h.fail(null);
    retry.click();
    assert.equal(retry.hidden, true);
    assert.equal(document.activeElement, input);
    assert.match(status.textContent, locale === 'uk' ? /Збережено/ : /Saved on this device/);
    assert.equal(h.saved().autoNext, false);
    h.fail(new Error('Write failed'));
    input.checked = true;
    input.emit('change');
    other.focus();
    h.fail(null);
    retry.click();
    assert.equal(
      document.activeElement,
      other,
      'recovery does not steal a deliberate focus choice',
    );
    const writes = h.writes();
    view.destroy();
    retry.click();
    assert.equal(h.writes(), writes);
  });
