// Authored regressions; automated suites remain waived and unrun.
import test from 'node:test';
import assert from 'node:assert/strict';
import { attachRoomInput } from '../online/room-input.mjs';
import { attachRoomSupport } from '../online/room-controls.mjs';

class Target {
  constructor(parent = null) {
    this.parent = parent;
    this.listeners = new Map();
    this.dataset = {};
    this.captures = new Set();
    this.classList = { toggle() {} };
  }
  addEventListener(type, fn, options) {
    const list = this.listeners.get(type) ?? [];
    list.push({ fn, capture: options === true || options?.capture === true });
    this.listeners.set(type, list);
  }
  removeEventListener(type, fn) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((entry) => entry.fn !== fn),
    );
  }
  emit(type, values = {}) {
    const event = {
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
    const path = [];
    for (let node = this; node; node = node.parent) path.push(node);
    for (const node of [...path].reverse())
      for (const entry of node.listeners.get(type) ?? []) if (entry.capture) entry.fn(event);
    for (const node of path)
      for (const entry of node.listeners.get(type) ?? []) if (!entry.capture) entry.fn(event);
    return event;
  }
  closest(selector) {
    return this.tag && selector.split(',').includes(this.tag) ? this : null;
  }
  setAttribute() {}
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
const pad = (index = 0, id = `Controller ${index}`) => ({
  index,
  id,
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});
const neutral = { direction: null, boost: false, action: false, pickup: false };
function fixture(t) {
  const original = new Map(
    ['window', 'document', 'navigator'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const win = new Target(),
    layout = new Target(),
    doc = new Target(win),
    arena = new Target(doc),
    supportButton = new Target(doc),
    boostButton = new Target(doc),
    owner = pad(1),
    navigated = [],
    steered = [];
  supportButton.tag = boostButton.tag = 'button';
  win.matchMedia = () => layout;
  doc.querySelectorAll = () => [];
  doc.querySelector = (selector) => (selector === '#boost-button' ? boostButton : null);
  let pads = [null, owner],
    active = true,
    scope = 'flight',
    reads = 0,
    pauses = 0,
    readError = false;
  for (const [key, value] of Object.entries({
    window: win,
    document: doc,
    navigator: {
      getGamepads() {
        reads++;
        if (readError) throw new Error('Controller access unavailable');
        return pads;
      },
    },
  }))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  const support = attachRoomSupport({
    document: doc,
    button: supportButton,
    active: () => active,
    isTeam: () => true,
    pause: () => {},
  });
  const input = attachRoomInput({
    arena,
    active: () => active,
    getScope: () => scope,
    onPause() {
      pauses++;
      active = false;
      scope = 'dialog:home';
      support.clear();
    },
    onNavigate: (command) => navigated.push(command),
    onSteer: (direction) => steered.push(direction),
  });
  t.after(() => {
    input.destroy();
    support.dispose();
    for (const [key, descriptor] of original)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  });
  return {
    input,
    win,
    layout,
    doc,
    owner,
    arena,
    support,
    supportButton,
    boostButton,
    navigated,
    steered,
    setPads: (value) => (pads = value),
    setReadError: () => (readError = true),
    setScope(value) {
      scope = value;
      active = value === 'flight';
    },
    suspend() {
      active = false;
      scope = 'room:inactive';
      input.clear();
      support.clear();
    },
    get reads() {
      return reads;
    },
    get pauses() {
      return pauses;
    },
  };
}

test('moving room controls across the landscape boundary releases holds and requires fresh Ready input', (t) => {
  const f = fixture(t);
  f.input.poll();
  f.owner.axes[0] = 1;
  f.owner.buttons[5].pressed = true;
  f.supportButton.emit('pointerdown', { pointerId: 7, button: 0 });
  assert.equal(f.input.poll().boost, true);
  assert.equal(f.support.held(), true);
  f.layout.emit('change', { matches: true });
  assert.equal(f.pauses, 1);
  assert.equal(f.support.held(), false);
  assert.equal(f.supportButton.hasPointerCapture(7), false);
  assert.deepEqual(f.input.poll(), neutral);
  f.setScope('flight');
  assert.deepEqual(f.input.poll(), neutral, 'held controller input cannot rearm after Ready');
  f.owner.axes[0] = 0;
  f.owner.buttons[5].pressed = false;
  f.input.poll();
  f.owner.axes[1] = 1;
  f.owner.buttons[5].pressed = true;
  assert.deepEqual(f.input.poll(), { ...neutral, direction: 'down', boost: true });
  f.layout.emit('change', { matches: false });
  assert.equal(f.pauses, 2, 'returning controls below the boards is the same pause boundary');
});

test('room layout changes leave an inactive picker alone and retire their listener on disposal', (t) => {
  const f = fixture(t);
  f.setScope('dialog:missions');
  f.layout.emit('change', { matches: true });
  assert.equal(f.pauses, 0);
  f.setScope('flight');
  f.input.destroy();
  f.layout.emit('change', { matches: false });
  assert.equal(f.pauses, 0, 'an old page owner cannot pause the replacement room');
});

test('one room poll owns menu and flight hardware without a newly connected pad stealing either', (t) => {
  const f = fixture(t);
  assert.deepEqual(f.input.poll(), neutral);
  f.owner.axes[0] = 1;
  f.owner.buttons[5].pressed = true;
  assert.deepEqual(f.input.poll(), { ...neutral, direction: 'right', boost: true });
  const other = pad(0);
  other.buttons[0].pressed = true;
  other.axes[1] = 1;
  f.setPads([other, f.owner]);
  assert.deepEqual(f.input.poll(), { ...neutral, direction: 'right', boost: true });
  assert.equal(f.reads, 3, 'the injected native input never performs a second hardware read');
  f.setScope('dialog:missions');
  f.owner.axes[0] = 0;
  f.owner.buttons[5].pressed = false;
  f.input.poll();
  f.owner.buttons[0].pressed = true;
  f.input.poll();
  assert.equal(f.navigated.filter((command) => command.confirm).length, 1);
  f.owner.buttons[0].pressed = false;
  f.input.poll();
  other.buttons[0].pressed = false;
  f.input.poll();
  other.buttons[0].pressed = true;
  f.input.poll();
  assert.equal(f.navigated.filter((command) => command.confirm).length, 1);
  assert.deepEqual(f.steered, ['right']);
});

test('replacement controller held Confirm cannot Ready a room after loss or background recovery', (t) => {
  const f = fixture(t);
  f.input.poll();
  f.owner.buttons[0].pressed = f.owner.buttons[5].pressed = true;
  assert.equal(f.input.poll().action, true);
  const replacement = pad(1, 'Replacement');
  replacement.buttons[0].pressed = true;
  f.setPads([null, replacement]);
  assert.deepEqual(f.input.poll(), neutral);
  assert.equal(f.pauses, 1);
  f.input.poll();
  f.input.poll();
  assert.equal(
    f.navigated.some((command) => command.confirm),
    false,
  );
  replacement.buttons[0].pressed = false;
  f.input.poll();
  replacement.buttons[0].pressed = true;
  f.input.poll();
  assert.equal(f.navigated.filter((command) => command.confirm).length, 1);
  f.suspend();
  f.setScope('dialog:missions');
  f.input.poll();
  f.input.poll();
  assert.equal(f.navigated.filter((command) => command.confirm).length, 1);
  f.setScope('flight');
  assert.deepEqual(f.input.poll(), neutral, 'held Ready cannot become Support after both resume');
  replacement.buttons[0].pressed = false;
  f.input.poll();
  replacement.buttons[0].pressed = true;
  assert.equal(f.input.poll().action, true);
});

test('room native steering, Boost and Team Support have independent sources and require fresh recovery input', (t) => {
  const f = fixture(t);
  f.input.poll();
  f.owner.axes[0] = 1;
  f.owner.buttons[0].pressed = f.owner.buttons[5].pressed = true;
  assert.deepEqual(f.input.poll(), { ...neutral, direction: 'right', boost: true, action: true });
  f.supportButton.emit('pointerdown', { pointerId: 3, button: 0 });
  f.owner.buttons[0].pressed = false;
  assert.equal(f.input.poll().boost, true);
  assert.equal(f.support.held(), true, 'releasing controller Support does not release touch');
  f.supportButton.emit('pointerup', { pointerId: 3 });
  assert.equal(f.support.held(), false);
  f.arena.emit('keydown', { code: 'ShiftLeft', key: 'Shift' });
  f.owner.buttons[5].pressed = false;
  assert.equal(f.input.poll().boost, true, 'keyboard Boost outlives controller Boost');
  f.arena.emit('keydown', { code: 'KeyW', key: 'w' });
  assert.equal(f.input.poll().direction, 'up');
  assert.equal(f.input.poll().direction, 'up', 'held controller direction cannot reclaim steering');
  f.owner.buttons[0].pressed = f.owner.buttons[5].pressed = true;
  f.suspend();
  f.setScope('flight');
  assert.deepEqual(f.input.poll(), neutral);
  f.arena.emit('keydown', { code: 'ShiftLeft', key: 'Shift', repeat: true });
  assert.deepEqual(f.input.poll(), neutral);
  f.owner.axes[0] = 0;
  f.owner.buttons[0].pressed = f.owner.buttons[5].pressed = false;
  f.input.poll();
  f.arena.emit('keyup', { code: 'ShiftLeft', key: 'Shift' });
  f.owner.axes[1] = 1;
  f.owner.buttons[0].pressed = true;
  assert.deepEqual(f.input.poll(), { ...neutral, direction: 'down', action: true });
});

test('controller read failure retires room control ownership instead of breaking the frame loop', (t) => {
  const f = fixture(t);
  f.input.poll();
  f.owner.axes[0] = 1;
  assert.equal(f.input.poll().direction, 'right');
  f.setReadError();
  assert.deepEqual(f.input.poll(), neutral);
  assert.equal(f.pauses, 1);
  assert.deepEqual(f.input.poll(), neutral);
  assert.equal(f.pauses, 1);
});

test('the room picker needs a fresh controller press after foreground loss before ownership exists', (t) => {
  const f = fixture(t);
  f.setScope('dialog:missions');
  f.input.poll();
  f.doc.hidden = true;
  f.doc.emit('visibilitychange');
  f.owner.buttons[0].pressed = true;
  f.input.poll();
  assert.equal(f.reads, 1, 'background polling does not adopt or consume a controller gesture');
  f.doc.hidden = false;
  f.input.poll();
  assert.equal(
    f.navigated.some((command) => command.confirm),
    false,
  );
  f.owner.buttons[0].pressed = false;
  f.input.poll();
  f.owner.buttons[0].pressed = true;
  f.input.poll();
  assert.equal(f.navigated.filter((command) => command.confirm).length, 1);
  f.win.emit('blur');
  f.input.poll();
  assert.equal(f.navigated.filter((command) => command.confirm).length, 1);
});
