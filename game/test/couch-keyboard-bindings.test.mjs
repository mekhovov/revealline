import test from 'node:test';
import { KeyboardLocks, keyboardTurn } from './helpers/keyboard-locks.mjs';
import assert from 'node:assert/strict';
import { resolveCouchKeyboard, replaceCouchKey, couchKeyMap } from '../couch/keyboard-bindings.mjs';
import {
  createCouchKeyboardPreferences,
  COUCH_KEYBOARD_KEY,
  TEAM_KEYBOARD_KEY,
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

test('failed writes retain explicit session keys and merge nonconflicting newer seat fields on Retry', async () => {
  const store = storage(),
    owner = createCouchKeyboardPreferences({
      getStorage: () => store,
      getLockManager: () => new KeyboardLocks(),
    });
  assert.equal(store.writes, 0);
  store.fail(true);
  await owner.set(0, 'up', 'KeyI');
  assert.equal(owner.snapshot().bindings.seats[0].up, 'KeyI');
  assert.equal(owner.snapshot().status, 'session');
  assert.equal(owner.snapshot().reason, 'full');
  const newer = replaceCouchKey(null, 1, 'down', 'KeyK');
  store.values.set(COUCH_KEYBOARD_KEY, JSON.stringify(newer));
  owner.refresh();
  assert.equal(owner.snapshot().bindings.seats[0].up, 'KeyI');
  store.fail(false);
  await owner.retry();
  assert.equal(owner.snapshot().status, 'saved');
  assert.equal(owner.snapshot().reason, '');
  assert.equal(owner.snapshot().bindings.seats[1].down, 'KeyK');
  assert.equal(JSON.parse(store.getItem(COUCH_KEYBOARD_KEY)).seats[0].up, 'KeyI');
  owner.dispose();
  await owner.set(0, 'up', 'KeyU');
  await owner.retry();
  assert.equal(store.writes, 2);
});

test('a cross-tab key collision cannot silently change accepted session controls or overwrite storage', async () => {
  const store = storage(),
    owner = createCouchKeyboardPreferences({
      getStorage: () => store,
      getLockManager: () => new KeyboardLocks(),
    });
  store.fail(true);
  await owner.set(0, 'up', 'KeyI');
  const newer = JSON.stringify(replaceCouchKey(null, 1, 'down', 'KeyI'));
  store.values.set(COUCH_KEYBOARD_KEY, newer);
  store.fail(false);
  await owner.retry();
  assert.equal(store.writes, 1, 'Conflict prevents the second write.');
  assert.equal(store.getItem(COUCH_KEYBOARD_KEY), newer);
  assert.equal(owner.snapshot().bindings.seats[0].up, 'KeyI');
  assert.equal(owner.snapshot().bindings.seats[1].down, 'ArrowDown');
  assert.equal(owner.snapshot().reason, 'conflict');
  await owner.set(0, 'up', 'KeyU');
  assert.equal(owner.snapshot().status, 'saved');
  assert.equal(owner.snapshot().bindings.seats[1].down, 'KeyI');
});

test('silent writes remain unconfirmed and other tabs are adopted only on an explicit refresh', async () => {
  const store = storage(),
    owner = createCouchKeyboardPreferences({
      getStorage: () => store,
      getLockManager: () => new KeyboardLocks(),
    });
  store.silent(true);
  await owner.set(0, 'up', 'KeyI');
  assert.equal(owner.snapshot().status, 'session');
  assert.equal(owner.snapshot().reason, 'unconfirmed');
  store.silent(false);
  await owner.retry();
  const newer = replaceCouchKey(owner.snapshot().bindings, 1, 'up', 'KeyU');
  store.values.set(COUCH_KEYBOARD_KEY, JSON.stringify(newer));
  assert.equal(owner.snapshot().bindings.seats[1].up, 'ArrowUp');
  owner.refresh();
  assert.equal(owner.snapshot().bindings.seats[1].up, 'KeyU');
  assert.equal(owner.snapshot().status, 'external');
});

test('a reentrant newer choice cannot be acknowledged by an older write', async () => {
  const store = storage(),
    owner = createCouchKeyboardPreferences({
      getStorage: () => store,
      getLockManager: () => new KeyboardLocks(),
    });
  const write = store.setItem.bind(store);
  store.setItem = (key, value) => {
    write(key, value);
    void owner.set(0, 'up', 'KeyU');
  };
  await owner.set(0, 'up', 'KeyI');
  assert.equal(owner.snapshot().bindings.seats[0].up, 'KeyU');
  assert.equal(owner.snapshot().status, 'session');
  store.setItem = write;
  await owner.retry();
  assert.equal(owner.snapshot().status, 'saved');
  assert.equal(JSON.parse(store.getItem(COUCH_KEYBOARD_KEY)).seats[0].up, 'KeyU');
});

test('two owners serialize distinct edits; a contended save stays session-only until Retry merges both', async () => {
  const locks = new KeyboardLocks(),
    store = storage();
  const options = { getStorage: () => store, getLockManager: () => locks };
  const a = createCouchKeyboardPreferences(options),
    b = createCouchKeyboardPreferences(options);
  const read = store.getItem.bind(store);
  let overlap;
  store.getItem = (key) => {
    const raw = read(key);
    if (!overlap) overlap = b.set(1, 'down', 'KeyK');
    return raw;
  };
  await a.set(0, 'up', 'KeyI');
  await overlap;
  assert.equal(a.snapshot().status, 'saved');
  assert.equal(b.snapshot().status, 'session');
  assert.equal(b.snapshot().reason, 'occupied');
  assert.equal(b.snapshot().bindings.seats[1].down, 'KeyK');
  assert.equal(JSON.parse(read(COUCH_KEYBOARD_KEY)).seats[0].up, 'KeyI');
  assert.equal(JSON.parse(read(COUCH_KEYBOARD_KEY)).seats[1].down, 'ArrowDown');
  store.getItem = read;
  await keyboardTurn();
  await b.retry();
  const saved = JSON.parse(read(COUCH_KEYBOARD_KEY));
  assert.equal(saved.seats[0].up, 'KeyI');
  assert.equal(saved.seats[1].down, 'KeyK');
  assert.equal(b.snapshot().status, 'saved');
  assert.ok(
    locks.calls.every(
      ({ key, options }) => key === `${COUCH_KEYBOARD_KEY}:writer` && options.ifAvailable,
    ),
  );
  await keyboardTurn();
  assert.equal(locks.held.size, 0);
});

test('unavailable locks never write, and leaving Settings or disposal retires delayed admission', async () => {
  const store = storage(),
    unavailable = createCouchKeyboardPreferences({
      getStorage: () => store,
      getLockManager: () => null,
    });
  await unavailable.set(0, 'up', 'KeyI');
  assert.equal(unavailable.snapshot().reason, 'lockUnavailable');
  assert.equal(store.writes, 0);
  for (const retire of ['suspend', 'dispose']) {
    let admit;
    const locks = {
      request(_key, _options, callback) {
        return new Promise((resolve) => {
          admit = () => resolve(callback({}));
        });
      },
    };
    const owner = createCouchKeyboardPreferences({
      getStorage: () => store,
      getLockManager: () => locks,
    });
    const saving = owner.set(0, 'up', 'KeyI');
    owner[retire]();
    admit();
    await saving;
    assert.equal(store.writes, 0);
    assert.equal(owner.snapshot().bindings.seats[0].up, 'KeyI');
    assert.notEqual(owner.snapshot().status, 'saved');
  }
});

test('Team admits exactly six usable actions, preserving Support defaults without reserving unused Supply keys', () => {
  const team = resolveCouchKeyboard(null, 'team');
  assert.equal(team.seats[0].action, 'KeyQ');
  assert.equal(team.seats[1].action, 'Enter');
  assert.equal(Object.keys(team.seats[0]).length, 6);
  assert.equal(Object.hasOwn(team.seats[0], 'pickup'), false);
  assert.equal(Object.hasOwn(couchKeyMap(team, 'team'), 'KeyE'), false);
  assert.equal(Object.hasOwn(couchKeyMap(team, 'team'), 'Slash'), false);
  const remapped = replaceCouchKey(
    replaceCouchKey(team, 0, 'action', 'KeyE', 'team'),
    1,
    'action',
    'Slash',
    'team',
  );
  assert.deepEqual(couchKeyMap(remapped, 'team').Slash, [1, 'action']);
  assert.throws(() => replaceCouchKey(remapped, 0, 'up', 'Slash', 'team'), { reason: 'conflict' });
  assert.throws(() => replaceCouchKey(team, 0, 'pickup', 'KeyE', 'team'), { reason: 'format' });
  assert.throws(() => resolveCouchKeyboard(team));
  assert.throws(() => resolveCouchKeyboard(resolveCouchKeyboard(), 'team'));
});

test('Team persistence and Reset own a separate record and save lock from Duel', async () => {
  const store = storage(),
    locks = new KeyboardLocks();
  const options = { getStorage: () => store, getLockManager: () => locks };
  const duel = createCouchKeyboardPreferences(options);
  await duel.set(0, 'up', 'KeyI');
  const duelRaw = store.getItem(COUCH_KEYBOARD_KEY);
  const team = createCouchKeyboardPreferences({ ...options, mode: 'team' });
  assert.equal(team.snapshot().bindings.seats[0].up, 'KeyW');
  await team.set(0, 'up', 'KeyU');
  assert.equal(store.getItem(COUCH_KEYBOARD_KEY), duelRaw);
  assert.equal(JSON.parse(store.getItem(TEAM_KEYBOARD_KEY)).seats[0].up, 'KeyU');
  await keyboardTurn();
  await team.reset();
  assert.deepEqual(
    JSON.parse(store.getItem(TEAM_KEYBOARD_KEY)),
    resolveCouchKeyboard(null, 'team'),
  );
  assert.equal(store.getItem(COUCH_KEYBOARD_KEY), duelRaw);
  assert.deepEqual(
    [...new Set(locks.calls.map(({ key }) => key))].sort(),
    [`${COUCH_KEYBOARD_KEY}:writer`, `${TEAM_KEYBOARD_KEY}:writer`].sort(),
  );
});

test('Snake two-player policy has four directions, independent format and reserved retry action', () => {
  const snake = resolveCouchKeyboard(null, 'snake');
  assert.equal(Object.keys(couchKeyMap(snake, 'snake')).length, 8);
  assert.throws(() => replaceCouchKey(snake, 0, 'up', 'KeyR', 'snake'), { reason: 'reserved' });
  for (const action of ['action', 'pickup', 'boost'])
    assert.throws(() => replaceCouchKey(snake, 0, action, 'KeyI', 'snake'), { reason: 'format' });
  assert.throws(() => resolveCouchKeyboard(snake, 'team'));
  assert.throws(() => resolveCouchKeyboard(snake));
  assert.deepEqual(couchKeyMap(replaceCouchKey(snake, 1, 'down', 'KeyJ', 'snake'), 'snake').KeyJ, [
    1,
    'down',
  ]);
});
