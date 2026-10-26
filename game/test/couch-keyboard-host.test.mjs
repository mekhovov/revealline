import test from 'node:test';
import { KeyboardLocks, keyboardTurn } from './helpers/keyboard-locks.mjs';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { resolveCouchKeyboard, replaceCouchKey } from '../couch/keyboard-bindings.mjs';
import { COUCH_KEYBOARD_KEY } from '../couch/keyboard-preferences.mjs';

function storage() {
  const values = new Map();
  return {
    values,
    fail: false,
    writes: 0,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (key === COUCH_KEYBOARD_KEY) {
        this.writes++;
        if (this.fail) throw Object.assign(new Error('Full'), { name: 'QuotaExceededError' });
      }
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}
function settings(f) {
  f.$('race-options').click();
  f.$('race-settings-tab-controls').click();
}
const press = (f, code) => f.doc.activeElement.emit('keydown', { code, key: code, repeat: false });
async function assign(f, player, action, code) {
  const button = f.$(`race-key-${player}-${action}`);
  button.focus();
  button.click();
  press(f, code);
  f.doc.activeElement.emit('keyup', { code, key: code });
  await keyboardTurn();
}

for (const locale of ['en', 'uk'])
  test(`Versus ${locale} captures two independent maps, gives truthful failed-save feedback and preserves paused play`, async (t) => {
    const previous = getLocale();
    t.after(() => setLocale(previous, { persist: false }));
    setLocale(locale, { persist: false });
    const store = storage(),
      f = await couchPage(t, { storage: store, lockManager: new KeyboardLocks() });
    const before = f.checkpoint();
    settings(f);
    assert.equal(store.writes, 0);
    await assign(f, 0, 'right', 'KeyL');
    await assign(f, 1, 'down', 'KeyK');
    assert.equal(store.writes, 2);
    assert.deepEqual(f.checkpoint(), before);
    assert.equal(f.doc.activeElement.id, 'race-key-1-down');
    assert.match(f.$('race-key-save-status').textContent, locale === 'en' ? /Saved/ : /Збережено/);
    f.$('race-options-back').click();
    f.$('race-start').click();
    f.frame();
    f.key('KeyL');
    f.key('KeyK');
    f.frames(5);
    assert.equal(f.renders[0].player.direction, 'right');
    assert.equal(f.renders[1].player.direction, 'down');
    f.$('race-pause').click();
    f.frame(0);
    const paused = f.checkpoint();
    settings(f);
    store.fail = true;
    await assign(f, 0, 'right', 'KeyJ');
    assert.match(
      f.$('race-key-save-status').textContent,
      locale === 'en' ? /Session only/ : /Лише в цьому сеансі/,
    );
    assert.equal(JSON.parse(store.getItem(COUCH_KEYBOARD_KEY)).seats[0].right, 'KeyL');
    assert.match(f.$('race-key-0-right').textContent, /J/);
    store.fail = false;
    f.$('race-key-retry').focus();
    f.$('race-key-retry').click();
    await keyboardTurn();
    assert.equal(f.doc.activeElement.id, 'race-key-0-right');
    assert.equal(JSON.parse(store.getItem(COUCH_KEYBOARD_KEY)).seats[0].right, 'KeyJ');
    f.frames(2, 0);
    assert.match(f.$('race-help-0').textContent, /J/);
    assert.match(f.$('race-seat-0').textContent, /J/);
    assert.deepEqual(f.checkpoint(), paused);
    f.$('race-key-reset').click();
    await keyboardTurn();
    assert.deepEqual(JSON.parse(store.getItem(COUCH_KEYBOARD_KEY)), resolveCouchKeyboard());
    assert.match(f.$('race-key-0-right').textContent, /D/);
    assert.match(f.$('race-key-1-down').textContent, /↓/);
    assert.deepEqual(f.checkpoint(), paused, 'Restoring keys cannot restart either board.');
    f.$('race-options-back').click();
    assert.equal(f.state(), locale === 'en' ? 'paused' : 'на паузі');
    assert.equal(f.doc.activeElement.id, 'race-options');
    const retained = f.$('race-key-reset');
    f.win.emit('pagehide', { persisted: false });
    const writes = store.writes;
    retained.click();
    assert.equal(store.writes, writes);
  });

test('capture conflicts, Escape, Tab, composition and browser modifiers preserve mappings and focus ownership', async (t) => {
  const store = storage(),
    f = await couchPage(t, {
      storage: store,
      nativeKeyboard: true,
      lockManager: new KeyboardLocks(),
    });
  settings(f);
  await assign(f, 0, 'up', 'ArrowUp');
  assert.match(f.$('race-key-capture-status').textContent, /Player 2/);
  assert.equal(store.writes, 0);
  press(f, 'Escape');
  assert.equal(
    f.$('race-options-panel').hidden,
    false,
    'First Escape cancels capture, not Settings.',
  );
  assert.equal(f.doc.activeElement.id, 'race-key-0-up');
  f.$('race-key-0-up').click();
  const browser = f.doc.activeElement.emit('keydown', { code: 'KeyR', key: 'r', ctrlKey: true });
  assert.equal(browser.defaultPrevented, false);
  f.doc.activeElement.emit('keydown', { code: 'KeyI', key: 'Process', isComposing: true });
  assert.equal(store.writes, 0);
  press(f, 'Tab');
  assert.equal(f.$('race-key-cancel').hidden, true);
  assert.equal(f.doc.activeElement.id, 'race-key-0-down');
  await assign(f, 0, 'up', 'KeyP');
  assert.equal(store.writes, 0);
  assert.match(f.$('race-key-capture-status').textContent, /reserved/);
});

test('other-tab bindings wait for Settings and do not change a running round', async (t) => {
  const store = storage(),
    f = await couchPage(t, { storage: store, lockManager: new KeyboardLocks() });
  f.$('race-start').click();
  f.frame();
  const newer = replaceCouchKey(resolveCouchKeyboard(), 0, 'down', 'KeyK');
  store.values.set(COUCH_KEYBOARD_KEY, JSON.stringify(newer));
  f.win.emit('storage', {
    key: COUCH_KEYBOARD_KEY,
    storageArea: store,
    newValue: store.getItem(COUCH_KEYBOARD_KEY),
  });
  f.key('KeyS');
  f.frames(2);
  assert.equal(f.renders[0].player.direction, 'down');
  f.$('race-pause').click();
  f.frame(0);
  settings(f);
  assert.match(f.$('race-key-0-down').textContent, /K/);
  assert.match(f.$('race-key-save-status').textContent, /another tab/);
  assert.equal(store.writes, 0);
});

test('delayed lock admission after Settings closes cannot write or change resumed controls', async (t) => {
  const store = storage(),
    locks = new KeyboardLocks();
  let delayed = false,
    admit;
  const lockManager = {
    request(key, options, callback) {
      if (key === `${COUCH_KEYBOARD_KEY}:writer` && delayed)
        return new Promise((resolve) => {
          admit = () => resolve(locks.request(key, options, callback));
        });
      return locks.request(key, options, callback);
    },
  };
  const f = await couchPage(t, { storage: store, lockManager });
  f.$('race-start').click();
  f.frame();
  f.$('race-pause').click();
  f.frame(0);
  settings(f);
  delayed = true;
  await assign(f, 0, 'right', 'KeyL');
  const newer = replaceCouchKey(null, 1, 'down', 'KeyK');
  store.values.set(COUCH_KEYBOARD_KEY, JSON.stringify(newer));
  f.$('race-options-back').click();
  f.$('race-start').click();
  f.frame(0);
  const before = f.checkpoint();
  admit();
  await keyboardTurn();
  assert.equal(store.writes, 0);
  assert.deepEqual(f.checkpoint(), before);
  f.key('KeyL');
  f.key('ArrowDown');
  f.frames(2);
  assert.equal(f.renders[0].player.direction, 'right');
  assert.equal(f.renders[1].player.direction, 'down');
  f.$('race-pause').click();
  f.frame(0);
  settings(f);
  assert.match(f.$('race-key-save-status').textContent, /Session only/);
  assert.match(f.$('race-key-1-down').textContent, /↓/);
  delayed = false;
  f.$('race-key-retry').focus();
  f.$('race-key-retry').click();
  await keyboardTurn();
  const saved = JSON.parse(store.getItem(COUCH_KEYBOARD_KEY));
  assert.equal(saved.seats[0].right, 'KeyL');
  assert.equal(saved.seats[1].down, 'KeyK');
  assert.equal(f.doc.activeElement.id, 'race-key-0-right');
});
