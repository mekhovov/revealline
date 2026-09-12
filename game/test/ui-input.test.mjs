import test from 'node:test';
import assert from 'node:assert/strict';
import { attachInput, gamepadCommand } from '../ui/input.mjs';
import { createRun, stepRun } from '../core/index.mjs';
import { resolveKeyBindings } from '../key-bindings.mjs';

const neutral = { direction: null, boost: false, action: false, pickup: false };
class Target {
  constructor(parent = null) {
    this.parent = parent;
    this.listeners = new Map();
    this.dataset = {};
    this.classes = new Set();
    this.captures = new Set();
    this.attributes = new Map();
    this.classList = {
      toggle: (name, on) => (on ? this.classes.add(name) : this.classes.delete(name)),
      remove: (name) => this.classes.delete(name),
    };
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }
  emit(type, values = {}) {
    const e = {
      type,
      target: this,
      key: '',
      code: '',
      repeat: false,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...values,
    };
    this.dispatch(e);
    return e;
  }
  dispatch(e) {
    for (const fn of this.listeners.get(e.type) || []) fn(e);
    if (!['blur', 'lostpointercapture'].includes(e.type)) this.parent?.dispatch(e);
  }
  closest() {
    return this.isEditing ? this : this.parent?.closest?.() || null;
  }
  focus() {
    this.focused = true;
  }
  setAttribute(key, value) {
    this.attributes.set(key, value);
  }
  getAttribute(key) {
    return this.attributes.get(key) ?? null;
  }
  setPointerCapture(id) {
    this.captures.add(id);
  }
  hasPointerCapture(id) {
    return this.captures.has(id);
  }
  releasePointerCapture(id) {
    this.captures.delete(id);
    this.emit('lostpointercapture', { pointerId: id });
  }
}
function fixture(
  t,
  {
    tap = false,
    withBoost = true,
    onActivity = () => {},
    onPause = () => {},
    getBindings = () => null,
  } = {},
) {
  const originals = new Map(
    ['window', 'document', 'navigator'].map((k) => [
      k,
      Object.getOwnPropertyDescriptor(globalThis, k),
    ]),
  );
  const win = new Target(),
    arena = new Target(win),
    moves = Object.fromEntries(
      ['up', 'right', 'down', 'left'].map((d) => {
        const b = new Target(win);
        b.dataset.move = d;
        return [d, b];
      }),
    );
  const action = new Target(win),
    pickup = new Target(win),
    stop = new Target(win),
    boost = new Target(win),
    pad = {
      connected: true,
      mapping: 'standard',
      axes: [0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
    };
  let pads = [],
    isActive = true,
    input;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      querySelectorAll: () => Object.values(moves),
      querySelector: (s) =>
        ({
          '#action-button': action,
          '#pickup-button': pickup,
          '#stop-button': stop,
          '#boost-button': withBoost ? boost : null,
        })[s],
    },
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { getGamepads: () => pads },
  });
  input = attachInput({
    arena,
    tapMode: () => tap,
    active: () => isActive,
    onActivity: () => onActivity(input),
    onPause: (force) => onPause(input, force),
    getBindings,
  });
  t.after(() => {
    input.destroy();
    for (const [key, descriptor] of originals)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  });
  return {
    input,
    win,
    arena,
    moves,
    action,
    pickup,
    stop,
    boost,
    pad,
    setPads: (value) => (pads = value),
    setActive: (value) => (isActive = value),
    setTap: (value) => (tap = value),
    key: (key, code, more = {}) => arena.emit('keydown', { key, code, ...more }),
    up: (key, code) => arena.emit('keyup', { key, code }),
  };
}

test('fresh keyboard direction survives synchronous clear when resuming', (t) => {
  const f = fixture(t, { onActivity: (input) => input.clear() });
  f.key('ArrowRight', 'ArrowRight');
  assert.equal(f.input.poll().direction, 'right');
});
test('fresh hold and tap pointer directions survive resume clear', (t) => {
  const f = fixture(t, { onActivity: (input) => input.clear() });
  for (const tap of [false, true]) {
    f.setTap(tap);
    f.moves.down.emit('pointerdown', { pointerId: 4, button: 0 });
    assert.equal(f.input.poll().direction, 'down');
    f.moves.down.emit('pointerup', { pointerId: 4 });
    assert.equal(f.input.poll().direction, tap ? 'down' : null);
    f.input.clear();
  }
});
test('latest held direction wins and releasing it falls back to previous direction', (t) => {
  const f = fixture(t);
  f.key('w', 'KeyW');
  f.key('d', 'KeyD');
  assert.equal(f.input.poll().direction, 'right');
  f.up('d', 'KeyD');
  assert.equal(f.input.poll().direction, 'up');
  f.up('w', 'KeyW');
  assert.deepEqual(f.input.poll(), neutral);
});
test('clear and focus loss reject stale direction and boost repeat', (t) => {
  const f = fixture(t);
  f.key('Shift', 'ShiftLeft');
  f.key('a', 'KeyA');
  f.win.emit('blur');
  f.key('Shift', 'ShiftLeft', { repeat: true });
  f.key('a', 'KeyA', { repeat: true });
  assert.deepEqual(f.input.poll(), neutral);
  f.key('Shift', 'ShiftLeft');
  assert.equal(f.input.poll().boost, true);
});
test('browser shortcuts and editable descendants retain native key behavior', (t) => {
  const f = fixture(t);
  for (const [key, code, modifier] of [
    ['r', 'KeyR', 'ctrlKey'],
    ['w', 'KeyW', 'metaKey'],
    ['a', 'KeyA', 'altKey'],
  ])
    assert.equal(f.key(key, code, { [modifier]: true }).defaultPrevented, false);
  const editor = new Target(f.win);
  editor.isEditing = true;
  const child = new Target(editor);
  assert.equal(child.emit('keydown', { key: 'w', code: 'KeyW' }).defaultPrevented, false);
  assert.deepEqual(f.input.poll(), neutral);
});
test('D-pad buttons support held Space/Enter and blur releases keyboard hold', (t) => {
  const f = fixture(t);
  assert.equal(f.moves.left.emit('keydown', { key: ' ', code: 'Space' }).defaultPrevented, true);
  assert.equal(f.input.poll().direction, 'left');
  f.moves.left.emit('keyup', { key: ' ', code: 'Space' });
  assert.equal(f.input.poll().direction, null);
  f.moves.up.emit('keydown', { key: 'Enter', code: 'Enter' });
  assert.equal(f.input.poll().direction, 'up');
  f.moves.up.emit('blur');
  assert.equal(f.input.poll().direction, null);
});
test('tap steering keyboard activation toggles once per fresh press', (t) => {
  const f = fixture(t, { tap: true });
  f.moves.right.emit('keydown', { key: 'Enter', code: 'Enter' });
  f.moves.right.emit('keydown', { key: 'Enter', code: 'Enter', repeat: true });
  f.moves.right.emit('keyup', { key: 'Enter', code: 'Enter' });
  assert.equal(f.input.poll().direction, 'right');
  f.moves.right.emit('keydown', { key: 'Enter', code: 'Enter' });
  assert.equal(f.input.poll().direction, null);
});
test('pointer cancel clears steering, and secondary mouse buttons do not steer', (t) => {
  const f = fixture(t);
  f.moves.down.emit('pointerdown', { pointerId: 1, button: 2 });
  assert.equal(f.input.poll().direction, null);
  f.moves.down.emit('pointerdown', { pointerId: 2, button: 0 });
  f.moves.down.emit('pointercancel', { pointerId: 2 });
  assert.deepEqual(f.input.poll(), neutral);
  assert.equal(f.moves.down.classes.has('pressed'), false);
});
test('action buttons and keyboard hotkeys produce one request per fresh press', (t) => {
  const f = fixture(t);
  for (const [button, kind] of [
    [f.action, 'action'],
    [f.pickup, 'pickup'],
  ]) {
    button.emit('keydown', { key: 'Enter', code: 'Enter' });
    assert.equal(f.input.poll()[kind], true);
    button.emit('keydown', { key: 'Enter', code: 'Enter', repeat: true });
    assert.equal(f.input.poll()[kind], false);
    button.emit('keyup', { key: 'Enter', code: 'Enter' });
    assert.equal(f.input.poll()[kind], false);
    button.emit('click');
    assert.equal(f.input.poll()[kind], true);
  }
  f.key('e', 'KeyE');
  assert.equal(f.input.poll().action, true);
  f.key('e', 'KeyE', { repeat: true });
  assert.equal(f.input.poll().action, false);
});
test('controller pause clears and suppresses the same sample until controller is neutral', (t) => {
  let pauses = 0;
  const f = fixture(t, {
    onPause: (input) => {
      pauses++;
      input.clear();
    },
  });
  f.setPads([f.pad]);
  f.pad.buttons[9].pressed = true;
  f.pad.buttons[0].pressed = true;
  f.pad.axes[0] = 1;
  assert.deepEqual(f.input.poll(), neutral);
  assert.equal(pauses, 1);
  assert.deepEqual(f.input.poll(), neutral);
  assert.equal(pauses, 1);
  f.pad.buttons[9].pressed = false;
  f.pad.buttons[0].pressed = false;
  f.pad.axes[0] = 0;
  f.input.poll();
  f.pad.axes[0] = 1;
  assert.equal(f.input.poll().direction, 'right');
});
test('inactive dialogs/results suppress controller input and require neutral before reuse', (t) => {
  const f = fixture(t);
  f.setPads([f.pad]);
  f.setActive(false);
  f.pad.buttons[0].pressed = true;
  f.pad.axes[0] = 1;
  assert.deepEqual(f.input.poll(), neutral);
  f.setActive(true);
  assert.deepEqual(f.input.poll(), neutral);
  f.pad.buttons[0].pressed = false;
  f.pad.axes[0] = 0;
  f.input.poll();
  f.pad.buttons[0].pressed = true;
  assert.equal(f.input.poll().action, true);
  assert.equal(
    f.input.poll().action,
    true,
    'held controller action remains held for core edge detection',
  );
});
test('controller disconnect force-pauses and clears keyboard command too', (t) => {
  const calls = [];
  const f = fixture(t, { onPause: (_input, force) => calls.push(force) });
  f.setPads([f.pad]);
  f.input.poll();
  f.key('w', 'KeyW');
  f.setPads([]);
  assert.deepEqual(f.input.poll(), neutral);
  assert.deepEqual(calls, [true]);
});
test('destroy removes button and window listeners', (t) => {
  const f = fixture(t);
  f.moves.up.emit('pointerdown', { pointerId: 1, button: 0 });
  f.input.destroy();
  f.key('w', 'KeyW');
  f.action.emit('click');
  assert.deepEqual(f.input.poll(), neutral);
  for (const target of [f.win, ...Object.values(f.moves), f.action, f.pickup, f.stop, f.boost])
    assert.equal(
      [...target.listeners.values()].reduce((n, s) => n + s.size, 0),
      0,
    );
  assert.equal(f.moves.up.captures.size, 0);
});

test('touch Boost and direction use independent held pointers and release independently', (t) => {
  const f = fixture(t);
  assert.equal(f.boost.getAttribute('aria-pressed'), 'false');
  f.moves.right.emit('pointerdown', { pointerId: 1, button: 0 });
  f.boost.emit('pointerdown', { pointerId: 2, button: 0 });
  assert.deepEqual(f.input.poll(), { ...neutral, direction: 'right', boost: true });
  assert.equal(f.boost.classes.has('pressed'), true);
  assert.equal(f.boost.getAttribute('aria-pressed'), 'true');
  f.moves.right.emit('pointerup', { pointerId: 1 });
  assert.deepEqual(f.input.poll(), { ...neutral, boost: true });
  f.boost.emit('pointerup', { pointerId: 2 });
  f.boost.emit('click');
  assert.deepEqual(f.input.poll(), neutral);
  assert.equal(f.boost.getAttribute('aria-pressed'), 'false');
});

test('touch Boost reaches the real movement multiplier and release restores ordinary speed', (t) => {
  const f = fixture(t);
  const state = createRun({
    version: 'xonix-level.v1',
    id: 'touch-boost',
    revision: '1',
    width: 48,
    height: 36,
    spawn: { x: 6.5, y: 0.5 },
    goal: { coverage: 1 },
    rules: { moveSpeed: 8, boostMultiplier: 1.5 },
  });
  f.moves.right.emit('pointerdown', { pointerId: 1, button: 0 });
  f.boost.emit('pointerdown', { pointerId: 2, button: 0 });
  for (let i = 0; i < 30; i++) stepRun(state, f.input.poll());
  assert.ok(Math.abs(state.player.x - 9.5) < 1e-8);
  f.boost.emit('pointerup', { pointerId: 2 });
  for (let i = 0; i < 30; i++) stepRun(state, f.input.poll());
  assert.ok(Math.abs(state.player.x - 11.5) < 1e-8);
});

test('tap Boost toggles once, preserves tap steering, and Stop clears both latches', (t) => {
  const f = fixture(t, { tap: true });
  f.moves.down.emit('pointerdown', { pointerId: 1, button: 0 });
  f.moves.down.emit('pointerup', { pointerId: 1 });
  f.boost.emit('pointerdown', { pointerId: 2, button: 0 });
  f.boost.emit('pointerup', { pointerId: 2 });
  f.boost.emit('click');
  assert.deepEqual(f.input.poll(), { ...neutral, direction: 'down', boost: true });
  f.boost.emit('blur');
  assert.equal(f.input.poll().boost, true, 'focus may move to another control after a tap');
  f.boost.emit('pointerdown', { pointerId: 3, button: 0 });
  f.boost.emit('pointerup', { pointerId: 3 });
  assert.deepEqual(f.input.poll(), { ...neutral, direction: 'down' });
  f.boost.emit('pointerdown', { pointerId: 4, button: 0 });
  f.boost.emit('pointerup', { pointerId: 4 });
  f.stop.emit('click');
  assert.deepEqual(f.input.poll(), neutral);
  assert.equal(f.boost.getAttribute('aria-pressed'), 'false');
});

test('Boost keyboard activation holds or toggles without key-repeat or native-click duplication', (t) => {
  const f = fixture(t);
  f.boost.emit('keydown', { key: ' ', code: 'Space' });
  assert.equal(f.input.poll().boost, true);
  f.boost.emit('keydown', { key: ' ', code: 'Space', repeat: true });
  f.boost.emit('keyup', { key: ' ', code: 'Space' });
  f.boost.emit('click', { detail: 0 });
  assert.equal(f.input.poll().boost, false);
  f.boost.emit('keydown', { key: 'Enter', code: 'Enter' });
  f.boost.emit('blur');
  assert.equal(f.input.poll().boost, false);
  f.setTap(true);
  f.boost.emit('keydown', { key: 'Enter', code: 'Enter' });
  f.boost.emit('keydown', { key: 'Enter', code: 'Enter', repeat: true });
  f.boost.emit('keyup', { key: 'Enter', code: 'Enter' });
  f.boost.emit('click', { detail: 0 });
  assert.equal(f.input.poll().boost, true);
  f.boost.emit('keydown', { key: 'Enter', code: 'Enter' });
  assert.equal(f.input.poll().boost, false);
});

test('click-only assistive Boost activation toggles in both steering modes and honors Stop', (t) => {
  const f = fixture(t);
  for (const tap of [false, true]) {
    f.setTap(tap);
    f.boost.emit('click', { detail: 0 });
    assert.equal(f.input.poll().boost, true);
    assert.equal(f.boost.getAttribute('aria-pressed'), 'true');
    f.boost.emit('click', { detail: 0 });
    assert.equal(f.input.poll().boost, false);
    f.boost.emit('click', { detail: 0 });
    f.stop.emit('click');
    assert.equal(f.input.poll().boost, false);
  }
  f.setActive(false);
  f.boost.emit('click', { detail: 0 });
  assert.equal(f.input.poll().boost, false);
});

test('Boost suppresses gesture duplicate clicks without swallowing a later assistive activation', async (t) => {
  const f = fixture(t);
  f.boost.emit('pointerdown', { pointerId: 1, button: 0 });
  f.boost.emit('pointerup', { pointerId: 1 });
  f.boost.emit('click', { detail: 1 });
  assert.equal(f.input.poll().boost, false);
  f.boost.emit('keydown', { key: 'Enter', code: 'Enter' });
  f.boost.emit('click', { detail: 0 });
  f.boost.emit('keyup', { key: 'Enter', code: 'Enter' });
  f.boost.emit('click', { detail: 0 });
  assert.equal(f.input.poll().boost, false);
  await new Promise((resolve) => setTimeout(resolve, 0));
  f.boost.emit('click', { detail: 0 });
  assert.equal(f.input.poll().boost, true);
  f.input.clear();
  assert.equal(f.input.poll().boost, false);
});

test('Boost survives a fresh resume but clears on pause, cancellation, lost capture and window blur', (t) => {
  const f = fixture(t, { tap: true, onActivity: (input) => input.clear() });
  const activate = (id) => f.boost.emit('pointerdown', { pointerId: id, button: 0 });
  activate(1);
  assert.equal(f.input.poll().boost, true);
  f.boost.emit('pointercancel', { pointerId: 1 });
  assert.equal(f.input.poll().boost, false);
  activate(2);
  f.boost.releasePointerCapture(2);
  assert.equal(f.input.poll().boost, false);
  activate(3);
  f.win.emit('blur');
  assert.equal(f.input.poll().boost, false);
  activate(4);
  f.key('Escape', 'Escape');
  assert.equal(f.input.poll().boost, false);
  assert.equal(f.boost.captures.size, 0);
  f.boost.emit('keydown', { key: 'Enter', code: 'Enter', repeat: true });
  assert.equal(f.input.poll().boost, false);
});

test('Shift remains hold-only in tap mode and controller/keyboard sources update Boost feedback', (t) => {
  const f = fixture(t, { tap: true });
  f.boost.emit('keydown', { key: 'Shift', code: 'ShiftLeft' });
  f.boost.emit('keydown', { key: 'Shift', code: 'ShiftLeft', repeat: true });
  assert.equal(f.input.poll().boost, true);
  assert.equal(f.boost.getAttribute('aria-pressed'), 'true');
  f.boost.emit('keyup', { key: 'Shift', code: 'ShiftLeft' });
  assert.equal(f.input.poll().boost, false);
  f.setPads([f.pad]);
  f.pad.buttons[5].pressed = true;
  assert.equal(f.input.poll().boost, true);
  assert.equal(f.boost.getAttribute('aria-pressed'), 'true');
  f.pad.buttons[5].pressed = false;
  assert.equal(f.input.poll().boost, false);
  assert.equal(f.boost.getAttribute('aria-pressed'), 'false');
});

test('Boost button is optional and its absence preserves keyboard boost', (t) => {
  const f = fixture(t, { withBoost: false });
  f.key('Shift', 'ShiftLeft');
  assert.equal(f.input.poll().boost, true);
  assert.equal(f.boost.listeners.size, 0);
});

test('inactive or secondary Boost gestures cannot latch and destroy releases Boost captures', (t) => {
  const f = fixture(t);
  f.boost.emit('pointerdown', { pointerId: 1, button: 2 });
  assert.equal(f.input.poll().boost, false);
  f.setActive(false);
  f.boost.emit('pointerdown', { pointerId: 2, button: 0 });
  assert.equal(f.input.poll().boost, false);
  f.setActive(true);
  f.boost.emit('pointerdown', { pointerId: 3, button: 0 });
  assert.equal(f.input.poll().boost, true);
  f.input.destroy();
  assert.equal(f.boost.captures.size, 0);
  assert.equal(f.boost.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(f.input.poll(), neutral);
});
test('standard controller mapping has dead zone, D-pad priority and independent actions', () => {
  const pad = {
    connected: true,
    axes: [0.2, -0.1],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
  };
  assert.equal(gamepadCommand(pad).direction, null);
  pad.axes = [0.4, -0.8];
  assert.equal(gamepadCommand(pad).direction, 'up');
  pad.buttons[15].pressed = true;
  pad.buttons[5].pressed = true;
  pad.buttons[2].pressed = true;
  assert.equal(gamepadCommand(pad).direction, 'right');
  assert.equal(gamepadCommand(pad).boost, true);
  assert.equal(gamepadCommand(pad).pickup, true);
});

test('custom physical keys move and release even when the release targets an editor', (t) => {
  const map = resolveKeyBindings();
  map.bindings.right = ['KeyJ'];
  const f = fixture(t, { getBindings: () => map });
  f.key('ArrowRight', 'ArrowRight');
  assert.equal(f.input.poll().direction, null);
  f.key('ø', 'KeyJ');
  assert.equal(f.input.poll().direction, 'right');
  f.arena.isEditing = true;
  f.win.emit('keyup', { target: f.arena, code: 'KeyJ', key: 'ø', ctrlKey: true });
  assert.equal(f.input.poll().direction, null);
});

test('remapped equipment fires once and modifier or IME input remains native', (t) => {
  const map = resolveKeyBindings();
  map.bindings.ability = ['KeyK'];
  const f = fixture(t, { getBindings: () => map });
  f.key('e', 'KeyE');
  assert.equal(f.input.poll().action, false);
  f.key('k', 'KeyK', { ctrlKey: true });
  f.key('k', 'KeyK', { isComposing: true });
  assert.equal(f.input.poll().action, false);
  f.key('k', 'KeyK');
  assert.equal(f.input.poll().action, true);
  f.key('k', 'KeyK', { repeat: true });
  assert.equal(f.input.poll().action, false);
});

test('custom stop clears held movement and boost; Escape remains a pause route', (t) => {
  const map = resolveKeyBindings();
  map.bindings.stop = ['KeyV'];
  map.bindings.pause = ['Escape', 'KeyB'];
  let pauses = 0;
  const f = fixture(t, { getBindings: () => map, onPause: () => pauses++ });
  f.key('ArrowRight', 'ArrowRight');
  f.key('Shift', 'ShiftRight');
  assert.equal(f.input.poll().boost, true);
  f.key('v', 'KeyV');
  assert.deepEqual(f.input.poll(), neutral);
  f.key('ArrowDown', 'ArrowDown');
  f.key('Escape', 'Escape');
  assert.equal(pauses, 1);
  assert.deepEqual(f.input.poll(), neutral);
  f.key('b', 'KeyB');
  assert.equal(pauses, 2);
});

test('changing mappings with clear prevents a held old key surviving the change', (t) => {
  let map = resolveKeyBindings();
  const f = fixture(t, { getBindings: () => map });
  f.key('d', 'KeyD');
  assert.equal(f.input.poll().direction, 'right');
  map = resolveKeyBindings();
  map.bindings.right = ['KeyL'];
  f.input.clear();
  f.up('d', 'KeyD');
  assert.deepEqual(f.input.poll(), neutral);
  f.key('l', 'KeyL');
  assert.equal(f.input.poll().direction, 'right');
});
