import { createControllerRouter } from '../ui/controller-router.mjs';
import { tx15StickProfile } from '../couch/tx15-presets.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createControllerSession } from '../couch/controller-session.mjs';
import {
  emptyProfile,
  standardProfile,
  mapProfile,
  validateProfile,
  createProfileStore,
  PROFILE_KEY,
} from '../couch/controller-profiles.mjs';
import { gamepadCommand } from '../ui/input.mjs';
const pad = (index = 0, mapping = 'standard') => ({
  index,
  id: 'Identical controller',
  mapping,
  connected: true,
  axes: Array(8).fill(0),
  buttons: Array.from({ length: 24 }, () => ({ pressed: false, value: 0 })),
  timestamp: 0,
});
const press = (p, i, on = true) => {
  p.buttons[i] = { pressed: on, value: Number(on) };
};
const session = (options) =>
  createControllerSession({ eventTarget: new EventTarget(), ...options });
function join(s, pads) {
  s.sample(pads);
  for (const p of pads) if (p) press(p, 0);
  s.sample(pads);
  for (const p of pads) if (p) press(p, 0, false);
  return s.sample(pads);
}
test('two identical pads join deliberately at sparse indexes; join never produces flight input', () => {
  const a = pad(3),
    b = pad(7),
    s = session();
  assert.deepEqual(s.sample([a, b]).slots, [null, null]);
  press(b, 0);
  let f = s.sample([a, b]);
  assert.deepEqual(f.slots, [7, null]);
  assert.equal(gamepadCommand(f.pads[7]).action, false);
  press(b, 0, false);
  s.sample([a, b]);
  press(a, 0);
  s.sample([a, b]);
  press(a, 0, false);
  f = s.sample([a, b]);
  assert.deepEqual(f.slots, [7, 3]);
  s.sample([a, b], { active: true });
  press(a, 15);
  press(b, 14);
  f = s.sample([a, b], { active: true });
  assert.equal(gamepadCommand(f.pads[3]).direction, 'right');
  assert.equal(gamepadCommand(f.pads[7]).direction, 'left');
});
test('extra controller cannot own menus or pause by disconnecting; partner seat never shifts', () => {
  const a = pad(1),
    b = pad(2),
    c = pad(0),
    loss = [];
  const s = session({ onLoss: (i) => loss.push(i) });
  join(s, [a, b]);
  s.sample([a, b, c]);
  press(c, 0);
  s.sample([a, b, c]);
  assert.deepEqual(s.state().seats, [1, 2]);
  s.sample([a, b]);
  assert.deepEqual(loss, []);
  s.sample([b]);
  assert.deepEqual(loss, [0]);
  assert.deepEqual(s.state().seats, [null, 2]);
  s.sample([a, b]);
  assert.deepEqual(s.state().seats, [null, 2]);
  press(a, 0);
  assert.deepEqual(s.sample([a, b]).slots, [1, 2]);
});
test('disconnect event catches loss and same-index reappearance between frames', () => {
  const events = new EventTarget(),
    a = pad(),
    b = pad(1),
    loss = [];
  const s = session({ eventTarget: events, onLoss: (i) => loss.push(i) });
  join(s, [a, b]);
  const e = new Event('gamepaddisconnected');
  e.gamepad = a;
  events.dispatchEvent(e);
  assert.deepEqual(loss, [0]);
  s.sample([a, b]);
  s.sample([a, b]);
  assert.deepEqual(s.state().seats, [null, 1]);
  press(a, 0);
  assert.deepEqual(s.sample([a, b]).slots, [0, 1]);
  s.dispose();
  events.dispatchEvent(e);
  assert.deepEqual(loss, [0]);
});
test('descriptor replacement invalidates assignment and read failure releases both seats', () => {
  const a = pad(),
    b = pad(1),
    s = session();
  join(s, [a, b]);
  a.id = 'Replacement';
  s.sample([a, b]);
  assert.deepEqual(s.state().seats, [null, 1]);
  s.sample([], { error: new Error('denied') });
  assert.equal(s.state().available, 'unavailable');
  assert.deepEqual(s.state().seats, [null, null]);
});
test('held control cannot carry across resume, mapping, swap or capture boundaries', () => {
  const a = pad(),
    b = pad(1),
    s = session();
  join(s, [a, b]);
  press(a, 0);
  let f = s.sample([a, b], { active: true });
  assert.equal(gamepadCommand(f.pads[0]).action, false);
  press(a, 0, false);
  s.sample([a, b], { active: true });
  press(a, 0);
  assert.equal(gamepadCommand(s.sample([a, b], { active: true }).pads[0]).action, true);
  s.sample([a, b]);
  s.swap();
  assert.deepEqual(s.state().seats, [1, 0]);
  s.capture(true);
  assert.equal(s.sample([a, b]).menuPads.filter(Boolean).length, 0);
  s.capture(false);
  assert.equal(gamepadCommand(s.sample([a, b]).pads[0]).action, false);
});
test('radio profile supports eight axes, 24 buttons, inverted latched controls and ignores unused throttle', () => {
  const p = pad(0, ''),
    recipe = emptyProfile(p, 'radio', 'EdgeTX');
  p.axes[2] = -1;
  p.buttons[20] = { value: 1 };
  recipe.flight.right = [
    { kind: 'axis', index: 6, center: 0.1, end: 0.9, press: 0.35, release: 0.25 },
  ];
  recipe.menu.confirm = [{ kind: 'button', index: 23, threshold: 0.5, invert: true }];
  p.buttons[23] = { value: 1 };
  const checked = validateProfile(recipe);
  assert.equal(mapProfile(checked, p).neutral, true);
  const s = session();
  s.sample([p]);
  s.apply(0, recipe);
  s.sample([p]);
  p.buttons[23] = { value: 0 };
  assert.deepEqual(s.sample([p]).slots, [0, null]);
  p.buttons[23] = { value: 1 };
  s.sample([p]);
  s.sample([p], { active: true });
  p.axes[6] = 0.9;
  assert.equal(gamepadCommand(s.sample([p], { active: true }).pads[0]).direction, 'right');
  assert.equal(p.axes[2], -1);
  assert.equal(recipe.device.mapping, '');
});
test('standard decoder preserves all existing digital priorities and dominant-axis ties', () => {
  const p = pad(),
    recipe = standardProfile(p);
  for (const x of [-1, -0.35, 0, 0.35, 1])
    for (const y of [-1, -0.35, 0, 0.35, 1])
      for (const button of [null, 12, 13, 14, 15]) {
        p.axes[0] = x;
        p.axes[1] = y;
        p.buttons.forEach((b) => {
          b.pressed = false;
          b.value = 0;
        });
        if (button !== null) press(p, button);
        assert.equal(
          mapProfile(recipe, p).flight.direction,
          gamepadCommand(p).direction,
          `${x},${y},${button}`,
        );
      }
});
test('hat sentinel and diagonals work without forcing unused axes to zero', () => {
  const p = pad(0, ''),
    recipe = emptyProfile(p, 'hat', 'Hat');
  p.axes[7] = 3.28;
  recipe.flight.up = [{ kind: 'hat', index: 7, values: [-1, -0.714], tolerance: 0.03 }];
  recipe.flight.right = [{ kind: 'hat', index: 7, values: [-0.714, -0.428], tolerance: 0.03 }];
  validateProfile(recipe);
  assert.equal(mapProfile(recipe, p).neutral, true);
  p.axes[7] = -0.714;
  assert.equal(mapProfile(recipe, p).flight.direction, 'up');
  p.axes[7] = -0.428;
  assert.equal(mapProfile(recipe, p).flight.direction, 'right');
});
test('invalid samples and ambiguous duplicate mappings fail without changing active profile', () => {
  const p = pad(),
    s = session();
  join(s, [p]);
  const recipe = emptyProfile(p, 'custom', 'Custom');
  recipe.menu.confirm = [{ kind: 'button', index: 0, threshold: 0.5, invert: false }];
  recipe.menu.back = structuredClone(recipe.menu.confirm);
  assert.throws(() => s.apply(0, recipe));
  assert.deepEqual(s.state().seats, [0, null]);
  p.axes[0] = NaN;
  s.sample([p]);
  assert.deepEqual(s.state().seats, [null, null]);
});
test('profile storage is isolated, validated, undoable, and conflicts remain exportable', () => {
  const data = new Map([
      ['fpv.radio', 'original'],
      ['solo', 'unchanged'],
    ]),
    storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const a = createProfileStore(storage),
    b = createProfileStore(storage),
    recipe = emptyProfile(pad(0, ''), 'one', 'First');
  a.put(recipe);
  assert.equal(data.get('fpv.radio'), 'original');
  assert.equal(data.get('solo'), 'unchanged');
  b.put({ ...recipe, name: 'Conflict' });
  assert.match(b.error(), /another tab/);
  assert.equal(JSON.parse(b.export()).profiles[0].name, 'Conflict');
  assert.equal(JSON.parse(data.get(PROFILE_KEY)).profiles[0].name, 'First');
  const c = createProfileStore(storage);
  assert.throws(() => c.import('{"format":"future"}'));
  c.remove('one');
  c.undo();
  assert.equal(c.snapshot().profiles[0].id, 'one');
  const bad = {
    getItem: () => '{broken',
    setItem: () => {
      throw new Error('quota');
    },
  };
  const d = createProfileStore(bad);
  assert.ok(d.error());
  d.put(recipe);
  assert.equal(d.snapshot().profiles.length, 1);
  assert.ok(d.error());
});

test('partial mappings retain fallback and custom IDs never activate standard join buttons', () => {
  const p = pad(),
    s = session(),
    profile = emptyProfile(p, 'standard', 'Custom');
  profile.flight.action = [{ kind: 'button', index: 20, threshold: 0.5, invert: false }];
  s.sample([p]);
  s.apply(0, profile);
  s.sample([p]);
  press(p, 0);
  s.sample([p]);
  assert.deepEqual(s.state().seats, [null, null]);
  assert.equal(s.assign(0, 0), true);
  assert.equal(s.completeFlight(0), false);
});

test('conflicting physical bindings cannot hide behind different thresholds', () => {
  const p = emptyProfile(pad(), 'conflict', 'Conflict');
  p.flight.action = [{ kind: 'button', index: 0, threshold: 0.4, invert: false }];
  p.flight.boost = [{ kind: 'button', index: 0, threshold: 0.6, invert: false }];
  assert.throws(() => validateProfile(p), /Duplicate/);
  p.flight.boost = [];
  p.flight.left = [{ kind: 'axis', index: 0, center: 0, end: -1, press: 0.4, release: 0.2 }];
  p.flight.right = [{ kind: 'axis', index: 0, center: 0, end: 1, press: 0.4, release: 0.2 }];
  assert.doesNotThrow(() => validateProfile(p));
});

test('future or corrupt stored profiles are preserved while session profiles remain usable', () => {
  const original = '{"format":"CouchControllerProfiles.v99","profiles":[]}';
  let bytes = original;
  const store = createProfileStore({
    getItem: () => bytes,
    setItem: (_, value) => {
      bytes = value;
    },
  });
  assert.equal(store.put(emptyProfile(pad(), 'new', 'New')), false);
  assert.equal(bytes, original);
  assert.equal(store.snapshot().profiles.length, 1);
  assert.match(store.error(), /preserved/);
});

test('standard D-pad-only controller does not require analog axes', () => {
  const p = pad();
  p.axes = [];
  const s = session();
  join(s, [p]);
  assert.deepEqual(s.state().seats, [0, null]);
  s.sample([p], { active: true });
  press(p, 12);
  assert.equal(gamepadCommand(s.sample([p], { active: true }).pads[0]).direction, 'up');
});

test('imported profile object field order does not change device identity', () => {
  const p = pad(),
    s = session(),
    profile = emptyProfile(p, 'imported', 'Imported');
  profile.device = { buttons: 24, axes: 8, mapping: 'standard', id: p.id };
  s.sample([p]);
  assert.equal(s.apply(0, profile), true);
});

test('two identical radios keep independent mappings, actions and menu pause ownership', () => {
  const a = pad(4, ''),
    b = pad(8, ''),
    s = session();
  a.axes[2] = b.axes[2] = -1; // Unmapped full-travel throttle is never a join gate.
  s.sample([a, b]);
  for (const [p, axis] of [
    [a, 6],
    [b, 7],
  ]) {
    const recipe = emptyProfile(p, `radio-${p.index}`, 'EdgeTX');
    recipe.flight.right = [
      { kind: 'axis', index: axis, center: 0, end: 1, press: 0.35, release: 0.25 },
    ];
    recipe.flight.action = [{ kind: 'button', index: 20, threshold: 0.5, invert: false }];
    recipe.flight.pause = [{ kind: 'button', index: 21, threshold: 0.5, invert: false }];
    recipe.menu.confirm = [{ kind: 'button', index: 23, threshold: 0.5, invert: false }];
    s.apply(p.index, recipe);
  }
  s.sample([a, b]);
  press(a, 23);
  press(b, 23);
  s.sample([a, b]);
  press(a, 23, false);
  press(b, 23, false);
  s.sample([a, b]);
  assert.deepEqual(s.state().seats, [4, 8]);
  s.sample([a, b], { active: true });
  a.axes[6] = 1;
  press(b, 20);
  const f = s.sample([a, b], { active: true });
  assert.equal(gamepadCommand(f.pads[4]).direction, 'right');
  assert.equal(gamepadCommand(f.pads[4]).action, false);
  assert.equal(gamepadCommand(f.pads[8]).direction, null);
  assert.equal(gamepadCommand(f.pads[8]).action, true);
  press(b, 21);
  s.sample([a, b], { active: true });
  assert.equal(s.state().menuSeat, 1);
});

function tx15(index = 0) {
  const p = pad(index, '');
  p.id = 'TX15 Joystick (Vendor: 1209 Product: 4f54)';
  return p;
}
test('shared TX15 isolates both sticks, neutral gates, loss and reconfiguration', () => {
  const p = tx15(),
    loss = [],
    s = session({ onLoss: (seat) => loss.push(seat) });
  p.axes[2] = -1;
  s.sample([p]);
  assert.equal(s.split(0, [tx15StickProfile(p), tx15StickProfile(p, 'left')]), true);
  let f = s.sample([p], { active: true });
  const [a, b] = f.slots;
  p.axes[0] = 1;
  f = s.sample([p], { active: true });
  assert.equal(gamepadCommand(f.pads[a]).direction, 'right');
  assert.equal(gamepadCommand(f.pads[b]).direction, null, 'left stick must first reach centre');
  p.axes[2] = 0;
  s.sample([p], { active: true });
  p.axes[2] = 1;
  f = s.sample([p], { active: true });
  assert.equal(gamepadCommand(f.pads[a]).direction, 'right');
  assert.equal(gamepadCommand(f.pads[b]).direction, 'up');
  s.sample([p]);
  assert.throws(() => s.apply(b, tx15StickProfile(p)), /separate channels/);
  s.swap();
  assert.deepEqual(s.sample([p]).slots, [b, a]);
  s.sample([]);
  assert.deepEqual(loss.sort(), [0, 1]);
  assert.deepEqual(s.sample([p]).slots, [null, null]);
  assert.equal(s.state().devices.length, 1, 'reconnect does not silently reclaim either player');
});
test('two TX15 radios and a TX15 plus gamepad retain independent controls', () => {
  for (const mixed of [false, true]) {
    const a = tx15(2),
      b = mixed ? pad(5) : tx15(5),
      s = session();
    s.sample([a, b]);
    s.apply(a.index, tx15StickProfile(a));
    if (!mixed) s.apply(b.index, tx15StickProfile(b));
    s.assign(a.index, 0);
    s.assign(b.index, 1);
    s.sample([a, b], { active: true });
    a.axes[0] = 1;
    if (mixed) press(b, 14);
    else b.axes[1] = -1;
    const f = s.sample([a, b], { active: true });
    assert.equal(gamepadCommand(f.pads[a.index]).direction, 'right');
    assert.equal(gamepadCommand(f.pads[b.index]).direction, mixed ? 'left' : 'down');
  }
});

test('shared radio menu owner reaches the existing menu router through compact snapshots', () => {
  const p = tx15(),
    s = session();
  s.sample([p]);
  s.split(0, [tx15StickProfile(p), tx15StickProfile(p, 'left')]);
  const router = createControllerRouter({
    readPads: () => s.frame().menuPads,
    eventTarget: null,
    autoJoin: true,
  });
  s.sample([p]);
  router.sample({ scope: 'menu' });
  p.axes[1] = 1;
  s.sample([p]);
  assert.equal(router.sample({ scope: 'menu' }).ui.direction, 'up');
  router.destroy();
});
