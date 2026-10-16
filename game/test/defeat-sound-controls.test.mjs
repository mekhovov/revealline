import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { attachDefeatSoundControls } from '../ui/defeat-sound-controls.mjs';
import { createDestructionPreferences, DESTRUCTION_PREFERENCES_KEY } from '../hunt/preferences.mjs';
import { huntText } from '../hunt/copy.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const record = (patch = {}) =>
  JSON.stringify({ format: 'DestructionPreferencesV1', brutal: false, blood: false, ...patch });
function fixture(t, stored = null, supplied = false) {
  const document = new Document(),
    window = new Events(),
    container = document.createElement('section');
  document.body.append(container);
  const values = new Map(stored === null ? [] : [[DESTRUCTION_PREFERENCES_KEY, stored]]);
  let denied = false;
  const writes = [];
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (denied) throw new Error('Storage unavailable');
      writes.push([key, value]);
      values.set(key, value);
    },
  };
  const options = { document, window, getStorage: () => storage },
    preferences = supplied ? createDestructionPreferences(options) : null,
    controls = attachDefeatSoundControls({
      ...options,
      container,
      prefix: 'review-',
      ...(preferences ? { preferences } : {}),
    }),
    select = document.getElementById('review-defeat-sounds');
  t.after(() => {
    controls.dispose();
    preferences?.dispose();
  });
  return {
    document,
    window,
    controls,
    preferences,
    select,
    values,
    writes,
    setDenied: (next) => (denied = next),
    external(patch) {
      const raw = record(patch);
      values.set(DESTRUCTION_PREFERENCES_KEY, raw);
      window.emit('storage', {
        key: DESTRUCTION_PREFERENCES_KEY,
        storageArea: storage,
        newValue: raw,
      });
    },
  };
}

for (const [name, stored, expected] of [
  ['fresh preferences', null, 'reactions'],
  ['legacy preferences without vocals', record(), 'reactions'],
  ['explicit legacy opt-out', record({ vocals: false }), 'classic'],
  ['explicit legacy opt-in', record({ vocals: true }), 'reactions'],
])
  test(`${name} selects ${expected} without writing on mount`, (t) => {
    const h = fixture(t, stored);
    assert.equal(h.select.value, expected);
    assert.equal(h.select.disabled, false, 'Visual gore is off, but sound remains selectable');
    assert.deepEqual(h.writes, []);
    h.select.value = expected === 'classic' ? 'reactions' : 'classic';
    h.select.emit('change');
    const saved = JSON.parse(h.values.get(DESTRUCTION_PREFERENCES_KEY));
    assert.equal(saved.vocals, h.select.value === 'reactions');
    assert.equal(saved.brutal, false);
    assert.equal(saved.blood, stored === null);
    assert.equal(saved.format, 'DestructionPreferencesV1');
  });

test('shared native preference owner immediately sees sound changes and survives control disposal', (t) => {
  const h = fixture(t, record({ vocals: true }), true);
  h.select.value = 'classic';
  h.select.emit('change');
  assert.equal(h.preferences.snapshot().vocals, false);
  h.preferences.set({ brutal: true, blood: true });
  assert.equal(h.select.value, 'classic', 'Changing gore does not change the sound style');
  h.controls.dispose();
  assert.doesNotThrow(() => h.preferences.set({ vocals: true }));
  assert.equal(h.select.listeners.get('change')?.size ?? 0, 0);
});

test('both localized options and the humanoid-only description update without moving focus', (t) => {
  const original = getLocale();
  t.after(() => setLocale(original, { persist: false }));
  const h = fixture(t);
  h.select.focus();
  for (const locale of ['en', 'uk']) {
    setLocale(locale, { persist: false });
    assert.equal(h.select.parentElement.tagName, 'LABEL');
    assert.equal(
      h.select.parentElement.querySelector('span').textContent,
      huntText('defeatSounds'),
    );
    assert.deepEqual(
      [...h.select.querySelectorAll('option')].map((option) => option.textContent),
      [huntText('classicSounds'), huntText('humanoidReactions')],
    );
    assert.equal(
      h.document.getElementById(h.select.getAttribute('aria-describedby')).textContent,
      huntText('defeatSoundsHelp'),
    );
    assert.equal(h.document.activeElement, h.select);
  }
});

test('saved cross-mode changes synchronize; failed saves keep the local choice until explicit retry', (t) => {
  const h = fixture(t, record({ vocals: true }));
  h.external({ vocals: false });
  assert.equal(h.select.value, 'classic');
  h.setDenied(true);
  h.select.value = 'reactions';
  h.select.emit('change');
  assert.equal(h.controls.snapshot().vocals, true);
  assert.equal(h.controls.snapshot().durable, false);
  const status = h.controls.element.querySelector('[role="status"]'),
    retry = h.controls.element.querySelector('button');
  assert.equal(status.hidden, false);
  assert.equal(retry.hidden, false);
  h.external({ vocals: false });
  assert.equal(h.select.value, 'reactions');
  h.setDenied(false);
  retry.click();
  assert.equal(JSON.parse(h.values.get(DESTRUCTION_PREFERENCES_KEY)).vocals, true);
  assert.equal(status.hidden, true);
  h.controls.dispose();
  h.external({ vocals: false });
  assert.equal(h.controls.snapshot().vocals, true, 'Retired controls have no storage owner');
});
