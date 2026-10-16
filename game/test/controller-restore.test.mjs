import test from 'node:test';
import assert from 'node:assert/strict';
import { createControllerSession } from '../couch/controller-session.mjs';
import {
  COUCH_RESTORE_KEY,
  SOLO_RESTORE_KEY,
  createRadioRestoreStore,
} from '../couch/controller-restore.mjs';
import { tx15StickProfile } from '../couch/tx15-presets.mjs';
import { gamepadCommand } from '../ui/input.mjs';

const pad = (index = 0) =>
  Object.create({
    index,
    id: 'TX15 Joystick (Vendor: 1209 Product: 4f54)',
    mapping: '',
    axes: Array(8).fill(0),
    buttons: Array.from({ length: 24 }, () => ({ value: 0 })),
    connected: true,
  });
function storage() {
  const values = new Map();
  return { values, getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
}
const session = (store, extra = {}) =>
  createControllerSession({
    eventTarget: null,
    storage: store,
    restoreKey: COUCH_RESTORE_KEY,
    ...extra,
  });
test('reload and changed physical index restore shared sides, swap and independent neutral gates', () => {
  const store = storage(),
    a = pad(),
    first = session(store);
  first.sample([a]);
  first.split(0, [tx15StickProfile(a, 'left'), tx15StickProfile(a)]);
  first.swap();
  const second = session(store),
    b = pad(4);
  b.axes[0] = 1;
  let f = second.sample([b]);
  assert.deepEqual(f.slots, [1033, 1032]);
  assert.equal(gamepadCommand(f.pads[1033]).direction, null);
  b.axes[0] = 0;
  second.sample([b]);
  b.axes[0] = 1;
  f = second.sample([b]);
  assert.equal(gamepadCommand(f.pads[1033]).direction, 'right');
  assert.equal(gamepadCommand(f.pads[1032]).direction, null);
});
test('direct continuation restores configured radio sides once without accepting held input', () => {
  const store = storage(),
    a = pad(),
    first = session(store);
  first.sample([a]);
  first.split(0, [tx15StickProfile(a, 'left'), tx15StickProfile(a)]);
  const saved = store.getItem(COUCH_RESTORE_KEY),
    continued = session(store, { initialSlots: [1025, 1024] });
  a.axes[0] = 1;
  let f = continued.sample([a], { active: true });
  assert.deepEqual(f.slots, [1025, 1024]);
  assert.equal(gamepadCommand(f.pads[1025]).direction, null);
  assert.equal(store.getItem(COUCH_RESTORE_KEY), saved, 'Handoff does not rewrite saved setup.');
  a.axes[0] = 0;
  continued.sample([a], { active: true });
  a.axes[0] = 1;
  f = continued.sample([a], { active: true });
  assert.equal(gamepadCommand(f.pads[1025]).direction, 'right');
  assert.equal(gamepadCommand(f.pads[1024]).direction, null);
  continued.sample([], { active: true });
  assert.deepEqual(continued.sample([a], { active: true }).slots, [null, null]);
});
test('disconnect keeps setup, reconnect stays neutral and cannot change seats during active play', () => {
  const store = storage(),
    a = pad(),
    s = session(store);
  s.sample([a]);
  s.apply(0, tx15StickProfile(a));
  s.assign(0, 1);
  s.sample([a], { active: true });
  s.sample([], { active: true });
  assert.deepEqual(s.sample([a], { active: true }).slots, [null, null]);
  a.axes[1] = 1;
  let f = s.sample([a]);
  assert.deepEqual(f.slots, [null, 0]);
  assert.equal(gamepadCommand(f.pads[0]).direction, null);
  a.axes[1] = 0;
  s.sample([a]);
  a.axes[1] = 1;
  f = s.sample([a]);
  assert.equal(gamepadCommand(f.pads[0]).direction, 'up');
});
test('identical radios never guess assignments; unrelated devices do not receive a profile', () => {
  const store = storage(),
    a = pad(),
    b = pad(1),
    s = session(store);
  s.sample([a, b]);
  s.apply(0, tx15StickProfile(a));
  s.assign(0, 0);
  s.apply(1, tx15StickProfile(b));
  s.assign(1, 1);
  const restored = session(store);
  assert.deepEqual(restored.sample([a, b]).slots, [null, null]);
  restored.sample([]);
  assert.deepEqual(
    restored.sample([a]).slots,
    [null, null],
    'one of two identical saved radios is still ambiguous',
  );
  const other = pad();
  other.id = 'Other radio';
  assert.equal(session(store).sample([other]).pads.length, 0);
});
test('saved layouts do not steal a deliberately occupied seat', () => {
  const store = storage(),
    a = pad(),
    s = session(store);
  s.sample([a]);
  s.apply(0, tx15StickProfile(a));
  s.assign(0, 0);
  const next = session(store),
    gamepad = pad(2);
  gamepad.mapping = 'standard';
  gamepad.id = 'Gamepad';
  next.sample([gamepad]);
  next.assign(2, 0);
  assert.deepEqual(next.sample([gamepad, a]).slots, [2, null]);
});
test('malformed, overlapping and newer saved data remains untouched; quota failures retain session controls', () => {
  for (const text of ['{', '{"format":"RadioSetup.v9","entries":[]}']) {
    const store = storage();
    store.setItem(COUCH_RESTORE_KEY, text);
    const s = session(store),
      a = pad();
    s.sample([a]);
    s.apply(0, tx15StickProfile(a));
    assert.equal(store.getItem(COUCH_RESTORE_KEY), text);
    assert.equal(s.state().restoreError, 'invalid');
  }
  const a = pad(),
    p = tx15StickProfile(a),
    store = storage();
  store.setItem(
    COUCH_RESTORE_KEY,
    JSON.stringify({ format: 'RadioSetup.v1', entries: [{ profiles: [p, p], seats: [0, 1] }] }),
  );
  assert.equal(createRadioRestoreStore(store, COUCH_RESTORE_KEY).error(), 'invalid');
  const s = session({
    getItem: () => null,
    setItem() {
      throw new Error('quota');
    },
  });
  s.sample([a]);
  assert.equal(s.apply(0, p), true);
  assert.equal(s.state().restoreError, 'unavailable');
});
test('another tab cannot overwrite a newer setup; forget is isolated from Solo and FPV', () => {
  const store = storage(),
    a = pad(),
    left = session(store),
    right = session(store);
  left.sample([a]);
  right.sample([a]);
  left.apply(0, tx15StickProfile(a));
  left.assign(0, 0);
  const prior = store.getItem(COUCH_RESTORE_KEY);
  right.apply(0, tx15StickProfile(a, 'left'));
  assert.equal(store.getItem(COUCH_RESTORE_KEY), prior);
  assert.equal(right.state().restoreError, 'changed');
  store.setItem(SOLO_RESTORE_KEY, 'preserved');
  store.setItem('revealline.flight-profiles.v1', 'fpv');
  assert.equal(left.forgetSaved(), true);
  assert.deepEqual(session(store).sample([a]).slots, [null, null]);
  assert.equal(store.getItem(SOLO_RESTORE_KEY), 'preserved');
  assert.equal(store.getItem('revealline.flight-profiles.v1'), 'fpv');
});

test('joining a gamepad does not erase saved ambiguous radio profiles', () => {
  const store = storage(),
    a = pad(),
    b = pad(1),
    first = session(store);
  first.sample([a, b]);
  first.apply(0, tx15StickProfile(a));
  first.assign(0, 0);
  first.apply(1, tx15StickProfile(b));
  first.assign(1, 1);
  const next = session(store),
    c = pad(3);
  c.mapping = 'standard';
  c.id = 'Gamepad';
  next.sample([a, b, c]);
  next.assign(3, 0);
  const saved = createRadioRestoreStore(store, COUCH_RESTORE_KEY).entries();
  assert.equal(saved.length, 2);
});

test('explicit forgetting recovers malformed setup without overwriting a newer tab', () => {
  const store = storage();
  store.setItem(COUCH_RESTORE_KEY, '{');
  const saved = createRadioRestoreStore(store, COUCH_RESTORE_KEY);
  assert.equal(saved.forget(), true);
  assert.deepEqual(JSON.parse(store.getItem(COUCH_RESTORE_KEY)).entries, []);
  store.setItem(COUCH_RESTORE_KEY, '{');
  const stale = createRadioRestoreStore(store, COUCH_RESTORE_KEY);
  const newer = JSON.stringify({ format: 'RadioSetup.v1', entries: [] });
  store.setItem(COUCH_RESTORE_KEY, newer);
  assert.equal(stale.forget(), false);
  assert.equal(store.getItem(COUCH_RESTORE_KEY), newer);
});
