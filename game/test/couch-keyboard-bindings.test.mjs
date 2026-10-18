import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCouchKeyboard, replaceCouchKey, couchKeyMap } from '../couch/keyboard-bindings.mjs';
import {
  createCouchKeyboardPreferences,
  COUCH_KEYBOARD_KEY,
} from '../couch/keyboard-preferences.mjs';

function storage() {
  const values = new Map();
  let fail = false,
    silent = false;
  return {
    values,
    writes: 0,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      this.writes++;
      if (fail) throw Object.assign(new Error('Full'), { name: 'QuotaExceededError' });
      if (!silent) values.set(key, value);
    },
    fail(value) {
      fail = value;
    },
    silent(value) {
      silent = value;
    },
  };
}

test('two-seat defaults preserve every current physical command and own their data', () => {
  assert.deepEqual(couchKeyMap(), {
    KeyW: [0, 'up'],
    KeyS: [0, 'down'],
    KeyA: [0, 'left'],
    KeyD: [0, 'right'],
    KeyQ: [0, 'action'],
    KeyE: [0, 'pickup'],
    ShiftLeft: [0, 'boost'],
    ArrowUp: [1, 'up'],
    ArrowDown: [1, 'down'],
    ArrowLeft: [1, 'left'],
    ArrowRight: [1, 'right'],
    Enter: [1, 'action'],
    Slash: [1, 'pickup'],
    ShiftRight: [1, 'boost'],
  });
  const source = resolveCouchKeyboard(),
    next = replaceCouchKey(source, 0, 'up', 'KeyI');
  assert.equal(next.seats[0].up, 'KeyI');
  assert.equal(source.seats[0].up, 'KeyW');
  assert.equal(resolveCouchKeyboard().seats[0].up, 'KeyW');
});

test('cross-seat/action conflicts and browser/menu shortcuts are rejected before mutation', () => {
  for (const code of ['ArrowUp', 'KeyA'])
    assert.throws(() => replaceCouchKey(null, 0, 'up', code), { reason: 'conflict' });
  for (const code of [
    'Escape',
    'KeyP',
    'Tab',
    'Space',
    'Enter',
    'ControlLeft',
    'MetaLeft',
    'F5',
    'AudioVolumeUp',
    '',
  ])
    assert.throws(() => replaceCouchKey(null, 0, 'up', code), { reason: 'reserved' });
  for (const code of ['KeyI', 'Numpad8', 'BracketLeft'])
    assert.equal(replaceCouchKey(null, 1, 'up', code).seats[1].up, code);
  const source = resolveCouchKeyboard();
  Object.defineProperty(source.seats[0], 'up', {
    get() {
      assert.fail('Getter must not execute');
    },
    enumerable: true,
  });
  assert.throws(() => resolveCouchKeyboard(source));
  for (const value of [
    {},
    [],
    { ...resolveCouchKeyboard(), extra: true },
    { ...resolveCouchKeyboard(), seats: [] },
  ])
    assert.throws(() => resolveCouchKeyboard(value));
});

test('failed writes retain explicit session keys and merge nonconflicting newer seat fields on Retry', () => {
  const store = storage(),
    owner = createCouchKeyboardPreferences({ getStorage: () => store });
  assert.equal(store.writes, 0);
  store.fail(true);
  owner.set(0, 'up', 'KeyI');
  assert.equal(owner.snapshot().bindings.seats[0].up, 'KeyI');
  assert.equal(owner.snapshot().status, 'session');
  assert.equal(owner.snapshot().reason, 'full');
  const newer = replaceCouchKey(null, 1, 'down', 'KeyK');
  store.values.set(COUCH_KEYBOARD_KEY, JSON.stringify(newer));
  owner.refresh();
  assert.equal(owner.snapshot().bindings.seats[0].up, 'KeyI');
  store.fail(false);
  owner.retry();
  assert.equal(owner.snapshot().status, 'saved');
  assert.equal(owner.snapshot().reason, '');
  assert.equal(owner.snapshot().bindings.seats[1].down, 'KeyK');
  assert.equal(JSON.parse(store.getItem(COUCH_KEYBOARD_KEY)).seats[0].up, 'KeyI');
  owner.dispose();
  owner.set(0, 'up', 'KeyU');
  owner.retry();
  assert.equal(store.writes, 2);
});

test('a cross-tab key collision cannot silently change accepted session controls or overwrite storage', () => {
  const store = storage(),
    owner = createCouchKeyboardPreferences({ getStorage: () => store });
  store.fail(true);
  owner.set(0, 'up', 'KeyI');
  const newer = JSON.stringify(replaceCouchKey(null, 1, 'down', 'KeyI'));
  store.values.set(COUCH_KEYBOARD_KEY, newer);
  store.fail(false);
  owner.retry();
  assert.equal(store.writes, 1, 'Conflict prevents the second write.');
  assert.equal(store.getItem(COUCH_KEYBOARD_KEY), newer);
  assert.equal(owner.snapshot().bindings.seats[0].up, 'KeyI');
  assert.equal(owner.snapshot().bindings.seats[1].down, 'ArrowDown');
  assert.equal(owner.snapshot().reason, 'conflict');
  owner.set(0, 'up', 'KeyU');
  assert.equal(owner.snapshot().status, 'saved');
  assert.equal(owner.snapshot().bindings.seats[1].down, 'KeyI');
});

test('silent writes remain unconfirmed and other tabs are adopted only on an explicit refresh', () => {
  const store = storage(),
    owner = createCouchKeyboardPreferences({ getStorage: () => store });
  store.silent(true);
  owner.set(0, 'up', 'KeyI');
  assert.equal(owner.snapshot().status, 'session');
  assert.equal(owner.snapshot().reason, 'unconfirmed');
  store.silent(false);
  owner.retry();
  const newer = replaceCouchKey(owner.snapshot().bindings, 1, 'up', 'KeyU');
  store.values.set(COUCH_KEYBOARD_KEY, JSON.stringify(newer));
  assert.equal(owner.snapshot().bindings.seats[1].up, 'ArrowUp');
  owner.refresh();
  assert.equal(owner.snapshot().bindings.seats[1].up, 'KeyU');
  assert.equal(owner.snapshot().status, 'external');
});

test('a reentrant newer choice cannot be acknowledged by an older write', () => {
  const store = storage(),
    owner = createCouchKeyboardPreferences({ getStorage: () => store });
  const write = store.setItem.bind(store);
  store.setItem = (key, value) => {
    write(key, value);
    owner.set(0, 'up', 'KeyU');
  };
  owner.set(0, 'up', 'KeyI');
  assert.equal(owner.snapshot().bindings.seats[0].up, 'KeyU');
  assert.equal(owner.snapshot().status, 'session');
  store.setItem = write;
  owner.retry();
  assert.equal(owner.snapshot().status, 'saved');
  assert.equal(JSON.parse(store.getItem(COUCH_KEYBOARD_KEY)).seats[0].up, 'KeyU');
});
