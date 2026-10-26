import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { KeyboardLocks, keyboardTurn } from './helpers/keyboard-locks.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { resolveCouchKeyboard, replaceCouchKey } from '../couch/keyboard-bindings.mjs';
import { COUCH_KEYBOARD_KEY, TEAM_KEYBOARD_KEY } from '../couch/keyboard-preferences.mjs';

async function fixture(t, locks = new KeyboardLocks()) {
  const duelRaw = JSON.stringify(replaceCouchKey(null, 0, 'up', 'KeyI'));
  const values = new Map([[COUCH_KEYBOARD_KEY, duelRaw]]),
    writes = [];
  let full = false;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (key === TEAM_KEYBOARD_KEY) {
        writes.push(value);
        if (full) throw Object.assign(new Error('Full'), { name: 'QuotaExceededError' });
      }
      values.set(key, value);
    },
  };
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    capturePaint: true,
    beforeImport({ install }) {
      install('localStorage', { value: storage });
      navigator.locks = locks;
    },
  });
  return Object.assign(f, { values, writes, duelRaw, storage, setFull: (value) => (full = value) });
}
function settings(f) {
  f.$('coop-settings-open').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-options').open, true);
  f.$('coop-settings-tab-controls').click();
}
async function assign(f, seat, action, key) {
  const button = f.$(`coop-key-${seat}-${action}`);
  button.focus();
  button.click();
  f.tap(key);
  await keyboardTurn();
}
const pausedState = (f) => ({
  paint: f.lastPaint,
  hud: [
    'coop-clock',
    'coop-coverage',
    'coop-reserves',
    'coop-objective',
    'coop-state-0',
    'coop-state-1',
  ].map((id) => f.$(id).textContent),
});

for (const locale of ['en', 'uk'])
  test(`Team ${locale} owns six controls, paused save feedback and Reset without changing Duel`, async (t) => {
    const previous = getLocale();
    t.after(() => setLocale(previous, { persist: false }));
    setLocale(locale, { persist: false });
    const f = await fixture(t);
    settings(f);
    assert.equal(f.doc.querySelectorAll('.couch-keyboard-row').length, 12);
    assert.equal(f.$('coop-key-0-pickup'), null);
    assert.match(
      f.$('coop-key-0-action').getAttribute('aria-label'),
      locale === 'en' ? /Support/ : /Підтримка/,
    );
    assert.match(f.$('coop-key-1-action').textContent, /Enter|Ввід/);
    assert.equal(f.writes.length, 0);
    await assign(f, 0, 'right', 'KeyL');
    await assign(f, 1, 'left', 'KeyJ');
    assert.equal(f.writes.length, 2);
    assert.equal(f.values.get(COUCH_KEYBOARD_KEY), f.duelRaw);
    assert.match(f.$('coop-key-help-0').textContent, /L/);
    assert.match(f.$('coop-key-help-1').textContent, /J/);
    f.$('coop-settings-close').click();
    f.$('coop-start').click();
    f.tap('KeyL');
    f.tap('KeyJ');
    f.tick(5);
    f.$('coop-pause').click();
    f.tick();
    const before = pausedState(f);
    settings(f);
    f.setFull(true);
    await assign(f, 0, 'action', 'KeyE');
    assert.match(
      f.$('coop-key-save-status').textContent,
      locale === 'en' ? /Session only/ : /Лише в цьому сеансі/,
    );
    assert.equal(JSON.parse(f.values.get(TEAM_KEYBOARD_KEY)).seats[0].action, 'KeyQ');
    assert.match(f.$('coop-key-0-action').textContent, /E/);
    f.setFull(false);
    f.$('coop-key-retry').focus();
    f.$('coop-key-retry').click();
    await keyboardTurn();
    assert.equal(f.doc.activeElement.id, 'coop-key-0-action');
    assert.equal(JSON.parse(f.values.get(TEAM_KEYBOARD_KEY)).seats[0].action, 'KeyE');
    f.tick();
    assert.deepEqual(pausedState(f), before);
    f.$('coop-key-reset').click();
    await keyboardTurn();
    assert.deepEqual(
      JSON.parse(f.values.get(TEAM_KEYBOARD_KEY)),
      resolveCouchKeyboard(null, 'team'),
    );
    assert.equal(f.values.get(COUCH_KEYBOARD_KEY), f.duelRaw);
    f.$('coop-settings-close').click();
    f.tick();
    assert.deepEqual(pausedState(f), before);
    assert.equal(f.doc.activeElement.id, 'coop-settings-open');
    const reset = f.$('coop-key-reset');
    f.win.emit('pagehide', { persisted: false });
    const count = f.writes.length;
    reset.click();
    await keyboardTurn();
    assert.equal(f.writes.length, count);
  });

test('Team capture reserves menu keys, identifies the owning seat and cancels without closing Settings', async (t) => {
  const f = await fixture(t);
  settings(f);
  await assign(f, 0, 'up', 'ArrowUp');
  assert.match(f.$('coop-key-capture-status').textContent, /Player 2/);
  assert.equal(f.writes.length, 0);
  f.tap('Escape');
  assert.equal(f.$('coop-options').open, true);
  assert.equal(f.doc.activeElement.id, 'coop-key-0-up');
  f.$('coop-key-0-up').click();
  f.tap('Tab');
  assert.equal(f.$('coop-key-cancel').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-key-0-down');
  await assign(f, 0, 'up', 'KeyP');
  assert.equal(f.writes.length, 0);
  assert.match(f.$('coop-key-capture-status').textContent, /reserved/);
  f.$('coop-settings-close').click();
  assert.equal(f.$('coop-key-cancel').hidden, true);
});

test('Team closing Settings retires delayed save admission and newer stored controls wait for explicit entry', async (t) => {
  const locks = new KeyboardLocks();
  let delayed = false,
    admit;
  const manager = {
    request(key, options, callback) {
      if (key === `${TEAM_KEYBOARD_KEY}:writer` && delayed)
        return new Promise((resolve) => {
          admit = () => resolve(locks.request(key, options, callback));
        });
      return locks.request(key, options, callback);
    },
  };
  const f = await fixture(t, manager);
  f.$('coop-start').click();
  f.tap('KeyD');
  f.tick(3);
  f.$('coop-pause').click();
  f.tick();
  const paused = pausedState(f);
  settings(f);
  delayed = true;
  await assign(f, 0, 'right', 'KeyL');
  const newer = replaceCouchKey(null, 1, 'down', 'KeyK', 'team');
  f.values.set(TEAM_KEYBOARD_KEY, JSON.stringify(newer));
  f.$('coop-settings-close').click();
  admit();
  await keyboardTurn();
  assert.equal(f.writes.length, 0);
  assert.deepEqual(pausedState(f), paused);
  assert.match(f.$('coop-key-1-down').textContent, /↓/);
  settings(f);
  assert.match(f.$('coop-key-save-status').textContent, /Session only/);
  delayed = false;
  f.$('coop-key-retry').focus();
  f.$('coop-key-retry').click();
  await keyboardTurn();
  const saved = JSON.parse(f.values.get(TEAM_KEYBOARD_KEY));
  assert.equal(saved.seats[0].right, 'KeyL');
  assert.equal(saved.seats[1].down, 'KeyK');
  assert.equal(f.doc.activeElement.id, 'coop-key-0-right');
  assert.equal(f.values.get(COUCH_KEYBOARD_KEY), f.duelRaw);
  f.$('coop-settings-close').click();
  f.values.set(
    TEAM_KEYBOARD_KEY,
    JSON.stringify(replaceCouchKey(saved, 1, 'down', 'KeyU', 'team')),
  );
  f.win.emit('storage', {
    key: TEAM_KEYBOARD_KEY,
    newValue: f.values.get(TEAM_KEYBOARD_KEY),
    storageArea: f.storage,
  });
  assert.match(f.$('coop-key-1-down').textContent, /K/);
  settings(f);
  assert.match(f.$('coop-key-1-down').textContent, /U/);
  assert.match(f.$('coop-key-save-status').textContent, /another tab/);
  f.tick();
  assert.deepEqual(pausedState(f), paused);
});
