import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attachInput } from '../ui/input.mjs';
import { attachCouchInput } from '../couch/couch-input.mjs';
import { createRun, stepRun } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

// Browser event boundaries only. Capture listeners run before target/bubble
// listeners, including events originating in a menu or native reader.
class Target {
  constructor(parent = null) {
    this.parent = parent;
    this.listeners = new Map();
    this.dataset = {};
    this.attributes = new Map();
    this.captures = new Set();
    this.classes = new Set();
    this.classList = {
      toggle: (key, on) => (on ? this.classes.add(key) : this.classes.delete(key)),
    };
  }
  addEventListener(type, fn, options) {
    const list = this.listeners.get(type) || [];
    list.push({ fn, capture: options === true || options?.capture === true });
    this.listeners.set(type, list);
  }
  removeEventListener(type, fn) {
    this.listeners.set(
      type,
      (this.listeners.get(type) || []).filter((entry) => entry.fn !== fn),
    );
  }
  emit(type, values = {}) {
    const event = {
      type,
      target: this,
      key: '',
      code: '',
      repeat: false,
      detail: 0,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...values,
    };
    const path = [];
    for (let node = this; node; node = node.parent) path.push(node);
    for (const node of [...path].reverse())
      for (const entry of node.listeners.get(type) || []) if (entry.capture) entry.fn(event);
    for (const node of ['blur', 'lostpointercapture'].includes(type) ? [this] : path)
      for (const entry of node.listeners.get(type) || []) if (!entry.capture) entry.fn(event);
    return event;
  }
  closest(selector) {
    if (this.reading && selector.includes('[data-game-reading]')) return this;
    if (this.tag && selector.split(',').includes(this.tag)) return this;
    return this.parent?.closest(selector) || null;
  }
  focus() {
    this.focused = true;
  }
  hasAttribute(key) {
    return this.attributes.has(key);
  }
  setAttribute(key, value) {
    this.attributes.set(key, String(value));
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
const neutral = () => ({ direction: null, boost: false, action: false, pickup: false });
const makePad = (index = 0) => ({
  index,
  id: `pad-${index}`,
  connected: true,
  mapping: 'standard',
  axes: [0, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
});
function fixture(t, { external = true, tap = false, onClear = () => {} } = {}) {
  const originals = new Map(
    ['window', 'document', 'navigator'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const win = new Target(),
    arena = new Target(win),
    controls = {};
  for (const kind of ['up', 'right', 'down', 'left', 'boost', 'action', 'pickup', 'stop']) {
    controls[kind] = new Target(win);
    controls[kind].tag = 'button';
    if (['up', 'right', 'down', 'left'].includes(kind)) controls[kind].dataset.move = kind;
  }
  const doc = {
    querySelectorAll: () => Object.values(controls).filter((button) => button.dataset.move),
    querySelector: (selector) => controls[selector.slice(1).replace('-button', '')],
  };
  let active = true,
    continuous = true,
    command = neutral(),
    reads = 0,
    hardwareReads = 0,
    pads = [],
    pauses = 0,
    activities = 0;
  for (const [key, value] of Object.entries({
    window: win,
    document: doc,
    navigator: {
      getGamepads: () => {
        hardwareReads++;
        return pads;
      },
    },
  }))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  const input = attachInput({
    arena,
    active: () => active,
    continuousSteering: () => continuous,
    tapMode: () => tap,
    onClear,
    onActivity: () => activities++,
    onPause: () => {
      pauses++;
      active = false;
    },
    readControllerCommand: external
      ? () => {
          reads++;
          return command;
        }
      : null,
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
    controls,
    key: (code, extra = {}) => arena.emit('keydown', { code, key: code, ...extra }),
    up: (code) => arena.emit('keyup', { code }),
    down: (kind, id = 1) => controls[kind].emit('pointerdown', { pointerId: id, button: 0 }),
    lift: (kind, id = 1) => controls[kind].emit('pointerup', { pointerId: id }),
    setActive: (value) => (active = value),
    setContinuous: (value) => (continuous = value),
    setCommand: (value) => (command = { ...neutral(), ...value }),
    setPads: (value) => (pads = value),
    get reads() {
      return reads;
    },
    get hardwareReads() {
      return hardwareReads;
    },
    get pauses() {
      return pauses;
    },
    get activities() {
      return activities;
    },
  };
}

test('continuous option rejects invalid configuration before attaching listeners', () => {
  for (const value of [true, false, null, 'continuous'])
    assert.throws(() => attachInput({ continuousSteering: value }), /must be a function/);
});

test('fresh keys persist after release without falling back to an older hold or repeat', (t) => {
  const f = fixture(t);
  f.key('KeyW');
  f.key('KeyD');
  f.up('KeyD');
  assert.equal(f.input.poll().direction, 'right');
  f.key('KeyW', { repeat: true });
  f.key('KeyW');
  assert.equal(f.input.poll().direction, 'right');
  f.up('KeyW');
  f.key('KeyW');
  f.up('KeyW');
  assert.equal(f.input.poll().direction, 'up');
  assert.equal(f.activities, 3);
});

for (const tap of [false, true])
  test(`pointer and button-key direction repeats never toggle movement off (tap=${tap})`, (t) => {
    const f = fixture(t, { tap });
    for (let i = 0; i < 2; i++) {
      f.down('right');
      f.lift('right');
      assert.equal(f.input.poll().direction, 'right');
    }
    f.controls.down.emit('keydown', { key: 'Enter', code: 'Enter' });
    f.controls.down.emit('keyup', { key: 'Enter', code: 'Enter' });
    f.controls.down.emit('keydown', { key: 'Enter', code: 'Enter' });
    f.controls.down.emit('keyup', { key: 'Enter', code: 'Enter' });
    assert.equal(f.input.poll().direction, 'down');
    assert.equal(f.controls.down.classes.has('pressed'), true);
  });

test('pad transitions take over, but held sources and release never reclaim a newer direction', (t) => {
  const f = fixture(t);
  f.key('KeyW');
  f.input.poll();
  f.setCommand({ direction: 'left' });
  assert.equal(f.input.poll().direction, 'left');
  f.down('down');
  f.lift('down');
  for (let i = 0; i < 3; i++) assert.equal(f.input.poll().direction, 'down');
  f.up('KeyW');
  f.setCommand({ direction: null });
  assert.equal(f.input.poll().direction, 'down');
  f.setCommand({ direction: 'left' });
  assert.equal(f.input.poll().direction, 'left');
  f.setCommand({ direction: 'right' });
  assert.equal(f.input.poll().direction, 'right');
  assert.equal(f.hardwareReads, 0);
});

test('local events win a same-sample pad transition once without later stale takeover', (t) => {
  const f = fixture(t);
  f.setCommand({ direction: 'left' });
  f.key('KeyD');
  f.up('KeyD');
  assert.equal(f.input.poll().direction, 'right');
  assert.equal(f.input.poll().direction, 'right');
  f.setCommand({ direction: 'up' });
  assert.equal(f.input.poll().direction, 'up');
});

test('snapshot preserves an unpolled command; physical clear retains it and drains only physical actions', (t) => {
  const f = fixture(t);
  f.key('KeyD');
  f.key('KeyE');
  f.key('ShiftLeft');
  assert.equal(f.input.snapshotDirection(), 'right');
  assert.equal(f.reads, 0);
  assert.throws(() => f.input.restoreDirection('diagonal'), /cardinal/);
  assert.equal(f.input.poll().action, true, 'invalid restore does not drain pending action');
  f.key('KeyS');
  f.input.clearPhysical();
  assert.deepEqual(f.input.poll(), { ...neutral(), direction: 'down' });
  f.key('KeyD');
  assert.equal(f.input.poll().direction, 'down', 'old physical key still needs release');
  f.up('KeyD');
  f.key('KeyD');
  assert.equal(f.input.poll().direction, 'right');
});

test('pause, inactive polling and blur retain logical intent without activity or held Confirm leakage', (t) => {
  const f = fixture(t);
  f.key('KeyD');
  f.input.poll();
  f.setCommand({ pause: true, action: true, direction: 'up' });
  assert.deepEqual(f.input.poll(), neutral());
  assert.equal(f.pauses, 1);
  for (let i = 0; i < 4; i++) assert.deepEqual(f.input.poll(), neutral());
  f.win.emit('blur');
  assert.equal(f.input.snapshotDirection(), 'right');
  const before = f.activities;
  f.key('KeyW');
  assert.equal(f.activities, before);
  f.setActive(true);
  assert.deepEqual(f.input.poll(), { ...neutral(), direction: 'right' });
  assert.equal(f.pauses, 1);
  f.setCommand({});
  f.input.poll();
  f.setCommand({ action: true });
  assert.equal(f.input.poll().action, true);
  f.key('KeyW', { repeat: true });
  assert.equal(f.input.poll().direction, 'right');
});

test('restore gates held inputs without suppressing saved direction; clear requires a fresh direction', (t) => {
  const f = fixture(t);
  f.key('KeyW');
  f.input.poll();
  f.setCommand({ direction: 'left', action: true, boost: true });
  f.input.restoreDirection('right');
  assert.deepEqual(f.input.poll(), { ...neutral(), direction: 'right' });
  f.input.clear();
  assert.equal(f.input.snapshotDirection(), null);
  f.key('KeyW');
  assert.deepEqual(f.input.poll(), neutral());
  f.setCommand({});
  f.input.poll();
  f.up('KeyW');
  f.key('KeyW');
  assert.equal(f.input.poll().direction, 'up');
  f.input.restoreDirection(null);
  assert.deepEqual(f.input.poll(), neutral());
});

test('Stop has no flight effect in continuous mode; pointer cancellation preserves intent', (t) => {
  const f = fixture(t);
  f.down('right');
  f.key('KeyX');
  f.controls.stop.emit('click');
  f.setCommand({ stop: true });
  assert.equal(f.input.poll().direction, 'right');
  f.controls.right.emit('pointercancel', { pointerId: 1 });
  assert.equal(f.input.snapshotDirection(), 'right');
  assert.equal(f.controls.right.captures.size, 0);
  f.setCommand({});
  assert.equal(f.input.poll().direction, 'right');
});

test('native reader and menu activation remain native and cannot become flight input after transfer', (t) => {
  const f = fixture(t),
    reader = new Target(f.win);
  reader.reading = true;
  f.input.restoreDirection('right');
  assert.equal(
    reader.emit('keydown', { key: 'ArrowDown', code: 'ArrowDown' }).defaultPrevented,
    false,
  );
  f.key('ArrowDown');
  assert.equal(f.input.poll().direction, 'right');
  reader.emit('keyup', { code: 'ArrowDown' });
  f.key('ArrowDown');
  assert.equal(f.input.poll().direction, 'down');
  assert.equal(f.key('KeyW', { ctrlKey: true }).defaultPrevented, false);
});

test('physical clears keep Boost independent and notify after reset without polling or losing intent', (t) => {
  let clears = 0;
  const f = fixture(t, { tap: true, onClear: () => clears++ });
  f.down('right');
  f.lift('right');
  f.down('boost', 2);
  f.lift('boost', 2);
  assert.equal(f.input.poll().boost, true);
  f.input.clearPhysical();
  assert.equal(clears, 1);
  assert.equal(f.input.localBoostActive(), false);
  assert.equal(f.input.snapshotDirection(), 'right');
  f.key('ShiftLeft');
  assert.deepEqual(f.input.poll(), { ...neutral(), direction: 'right', boost: true });
  f.up('ShiftLeft');
  assert.deepEqual(f.input.poll(), { ...neutral(), direction: 'right' });
});

test('default sampler preserves intent on owner disconnect and gates its replacement', (t) => {
  const f = fixture(t, { external: false }),
    first = makePad(4),
    replacement = makePad(0);
  first.axes[0] = 1;
  f.setPads([null, null, null, null, first]);
  assert.equal(f.input.poll().direction, 'right');
  replacement.axes[0] = -1;
  f.setPads([replacement]);
  assert.deepEqual(f.input.poll(), neutral());
  assert.equal(f.pauses, 1);
  assert.equal(f.input.snapshotDirection(), 'right');
  f.setActive(true);
  assert.equal(f.input.poll().direction, 'right');
  replacement.axes[0] = 0;
  f.input.poll();
  replacement.axes[0] = -1;
  assert.equal(f.input.poll().direction, 'left');
});

test('mode changes require host reset; destroy releases every listener and cannot restore intent', (t) => {
  const f = fixture(t);
  f.key('KeyD');
  f.up('KeyD');
  f.input.clear();
  f.setContinuous(false);
  f.key('KeyW');
  f.up('KeyW');
  assert.equal(f.input.poll().direction, null);
  assert.throws(() => f.input.restoreDirection('right'), /continuous/);
  f.input.destroy();
  assert.deepEqual(f.input.poll(), neutral());
  for (const target of [f.win, ...Object.values(f.controls)])
    assert.equal([...target.listeners.values()].flat().length, 0);
});

const firstLevel = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)))
  .levels[0];
for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`released direction completes a real recorded mission (${turnPolicy})`, (t) => {
    const f = fixture(t),
      options = { turnPolicy, seed: 123 };
    const run = createRun(firstLevel, options),
      recorder = createRecorder(firstLevel, options);
    f.key('KeyS');
    f.up('KeyS');
    for (let ticks = 0; ticks < 1000 && run.status === 'running'; ticks++) {
      const command = f.input.poll();
      stepRun(run, command);
      recordInput(recorder, command);
    }
    assert.equal(run.status, 'won');
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    assert.equal(f.hardwareReads, 0);
  });
  test(`buffered turn survives input freeze without changing the real run (${turnPolicy})`, (t) => {
    const f = fixture(t),
      actual = createRun(firstLevel, { turnPolicy, seed: 123 }),
      expected = createRun(firstLevel, { turnPolicy, seed: 123 });
    f.key('KeyD');
    f.up('KeyD');
    for (let i = 0; i < 5; i++) {
      stepRun(actual, f.input.poll());
      stepRun(expected, { direction: 'right' });
    }
    f.key('KeyS');
    f.up('KeyS');
    const before = authoritativeCheckpoint(actual),
      saved = f.input.snapshotDirection();
    f.input.clearPhysical();
    f.setActive(false);
    f.input.poll();
    f.input.restoreDirection(saved);
    assert.deepEqual(authoritativeCheckpoint(actual), before);
    f.setActive(true);
    for (let i = 0; i < 20; i++) {
      stepRun(actual, f.input.poll());
      stepRun(expected, { direction: 'down' });
    }
    assert.deepEqual(actual, expected);
    assert.equal(actual.player.direction, 'down');
    assert.equal(actual.player.queuedDirection, null);
  });
}

function couchFixture(t) {
  const win = new Target(),
    doc = new Target(win),
    arena = new Target(win),
    controls = [],
    padElements = [];
  for (let player = 0; player < 2; player++) {
    const pad = new Target(win),
      map = {};
    pad.dataset.player = String(player);
    for (const kind of ['up', 'right', 'down', 'left', 'boost', 'action', 'pickup', 'stop']) {
      map[kind] = new Target(win);
      map[kind].tag = 'button';
      if (['up', 'right', 'down', 'left', 'stop'].includes(kind))
        map[kind].dataset.direction = kind;
      else map[kind].dataset.action = kind;
    }
    pad.querySelectorAll = () => Object.values(map);
    padElements.push(pad);
    controls.push(map);
  }
  doc.querySelectorAll = () => padElements;
  let active = true,
    pads = [],
    pauses = 0,
    reads = 0,
    stopped = 0,
    slots;
  const input = attachCouchInput({
    window: win,
    document: doc,
    arena,
    continuousSteering: () => true,
    active: () => active,
    tapMode: () => true,
    getGamepads: () => {
      reads++;
      return pads;
    },
    onPause: () => {
      pauses++;
      active = false;
    },
    onStop: () => stopped++,
    onPads: (_count, value) => (slots = value),
  });
  t.after(() => input.destroy());
  return {
    input,
    win,
    doc,
    arena,
    controls,
    key: (code, extra = {}) => arena.emit('keydown', { code, key: code, ...extra }),
    up: (code) => arena.emit('keyup', { code }),
    down: (player, kind, id = 1) =>
      controls[player][kind].emit('pointerdown', { pointerId: id, button: 0 }),
    lift: (player, kind, id = 1) => controls[player][kind].emit('pointerup', { pointerId: id }),
    setActive: (value) => (active = value),
    setPads: (value) => (pads = value),
    get pauses() {
      return pauses;
    },
    get reads() {
      return reads;
    },
    get stopped() {
      return stopped;
    },
    get slots() {
      return slots;
    },
  };
}

test('couch keeps two independent latest directions through key/touch releases and repeated consumption', (t) => {
  const f = couchFixture(t);
  f.key('KeyW');
  f.key('KeyD');
  f.up('KeyD');
  f.down(1, 'down', 7);
  f.lift(1, 'down', 7);
  f.input.poll();
  const reads = f.reads;
  for (let i = 0; i < 12; i++)
    assert.deepEqual(
      f.input.consume().map((c) => c.direction),
      ['right', 'down'],
    );
  assert.equal(f.reads, reads);
  f.key('KeyW');
  f.key('KeyW', { repeat: true });
  assert.equal(f.input.consume()[0].direction, 'right');
  f.up('KeyW');
  f.key('KeyW');
  assert.deepEqual(
    f.input.consume().map((c) => c.direction),
    ['up', 'down'],
  );
});

test('couch pad transitions and same-sample local priorities are independent per player', (t) => {
  const f = couchFixture(t),
    pads = [makePad(3), makePad(7)];
  f.setPads(pads);
  f.input.poll();
  pads[0].axes[0] = -1;
  pads[1].axes[1] = -1;
  f.key('KeyD');
  assert.deepEqual(
    f.input.poll().map((c) => c.direction),
    ['right', 'up'],
  );
  f.down(1, 'right', 5);
  f.lift(1, 'right', 5);
  f.up('KeyD');
  assert.deepEqual(
    f.input.poll().map((c) => c.direction),
    ['right', 'right'],
  );
  assert.deepEqual(
    f.input.poll().map((c) => c.direction),
    ['right', 'right'],
  );
  pads[0].axes[0] = 0;
  f.input.poll();
  pads[0].axes[0] = -1;
  assert.deepEqual(
    f.input.poll().map((c) => c.direction),
    ['left', 'right'],
  );
});

test('couch recovery reset gates only its player while the other keeps direction, Boost and pending action', (t) => {
  const f = couchFixture(t),
    pads = [makePad(0), makePad(1)];
  f.setPads(pads);
  f.input.poll();
  pads[0].axes[1] = -1;
  f.key('KeyW');
  f.key('ArrowRight');
  f.key('ShiftRight');
  f.key('Enter');
  f.input.poll();
  f.input.clearPlayer(0);
  assert.deepEqual(f.input.consume(), [
    neutral(),
    { ...neutral(), direction: 'right', boost: true, action: true },
  ]);
  f.key('KeyW');
  assert.equal(f.input.poll()[0].direction, null);
  pads[0].axes[1] = 0;
  f.input.poll();
  f.up('KeyW');
  f.key('KeyS');
  assert.deepEqual(
    f.input.consume().map((c) => c.direction),
    ['down', 'right'],
  );
  assert.equal(f.stopped, 0, 'recovery reset does not invoke Stop');
});

test('couch pause retains both logical commands while held menu actions stay gated on Resume', (t) => {
  const f = couchFixture(t),
    pads = [makePad(0), makePad(1)];
  f.setPads(pads);
  f.input.poll();
  f.key('KeyD');
  f.key('ArrowDown');
  f.input.poll();
  pads[0].buttons[9].pressed = true;
  pads[1].buttons[0].pressed = true;
  assert.deepEqual(f.input.poll(), [neutral(), neutral()]);
  assert.equal(f.pauses, 1);
  for (let i = 0; i < 3; i++) assert.deepEqual(f.input.poll(), [neutral(), neutral()]);
  assert.equal(f.input.snapshotDirection(0), 'right');
  assert.equal(f.input.snapshotDirection(1), 'down');
  f.setActive(true);
  assert.deepEqual(f.input.poll(), [
    { ...neutral(), direction: 'right' },
    { ...neutral(), direction: 'down' },
  ]);
  pads[0].buttons[9].pressed = false;
  pads[1].buttons[0].pressed = false;
  f.input.poll();
  pads[1].buttons[0].pressed = true;
  assert.equal(f.input.poll()[1].action, true);
  assert.equal(f.pauses, 1);
});

test('couch held native Enter cannot turn into player two action after focus/context transfer', (t) => {
  const f = couchFixture(t),
    menu = new Target(f.win);
  menu.tag = 'button';
  f.setActive(false);
  assert.equal(menu.emit('keydown', { key: 'Enter', code: 'Enter' }).defaultPrevented, false);
  f.setActive(true);
  f.input.clearPhysical();
  f.key('Enter');
  assert.equal(f.input.consume()[1].action, false);
  menu.emit('keyup', { key: 'Enter', code: 'Enter' });
  f.key('Enter');
  assert.equal(f.input.consume()[1].action, true);
});

test('couch direction restore is atomic, per-player and preserves unsimulated turns', (t) => {
  const f = couchFixture(t);
  f.key('KeyD');
  f.key('ArrowLeft');
  f.key('KeyQ');
  assert.equal(f.input.snapshotDirection(1), 'left');
  assert.equal(f.reads, 0);
  assert.throws(() => f.input.restoreDirection(2, 'up'), /Player/);
  assert.throws(() => f.input.restoreDirection(0, {}), /cardinal/);
  assert.equal(f.input.consume()[0].action, true);
  f.key('ArrowDown');
  f.input.clearPhysical(1);
  f.input.restoreDirection(1, 'down');
  assert.deepEqual(
    f.input.consume().map((c) => c.direction),
    ['right', 'down'],
  );
  f.input.clearPlayer(1);
  assert.deepEqual(
    f.input.consume().map((c) => c.direction),
    ['right', null],
  );
});

test('couch cancellation pauses without erasing either intent and Stop/assistive repeat cannot stop', (t) => {
  const f = couchFixture(t);
  f.down(0, 'right', 1);
  f.key('ArrowDown');
  f.controls[0].right.emit('click');
  f.controls[0].stop.emit('click');
  f.input.stop(1);
  assert.deepEqual(
    f.input.consume().map((c) => c.direction),
    ['right', 'down'],
  );
  assert.equal(f.stopped, 0);
  f.controls[0].right.emit('pointercancel', { pointerId: 1 });
  assert.equal(f.pauses, 1);
  assert.deepEqual(f.input.consume(), [neutral(), neutral()]);
  f.setActive(true);
  assert.deepEqual(
    f.input.consume().map((c) => c.direction),
    ['right', 'down'],
  );
});

test('couch owner disconnect retains both intents and the surviving sparse player slot', (t) => {
  const f = couchFixture(t),
    first = makePad(3),
    second = makePad(7);
  f.setPads([first, second]);
  f.input.poll();
  first.axes[0] = 1;
  second.axes[1] = -1;
  f.input.poll();
  f.setPads([second]);
  assert.deepEqual(f.input.poll(), [neutral(), neutral()]);
  assert.deepEqual(f.slots, [null, 7]);
  assert.deepEqual([f.input.snapshotDirection(0), f.input.snapshotDirection(1)], ['right', 'up']);
  f.setActive(true);
  assert.deepEqual(
    f.input.poll().map((c) => c.direction),
    ['right', 'up'],
  );
});

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`couch released keyboard/touch commands drive equal real cores without repeated polling (${turnPolicy})`, (t) => {
    const f = couchFixture(t),
      runs = [0, 1].map(() => createRun(firstLevel, { turnPolicy, seed: 123 }));
    f.key('KeyD');
    f.up('KeyD');
    f.down(1, 'right', 8);
    f.lift(1, 'right', 8);
    f.input.poll();
    for (let tick = 0; tick < 5; tick++)
      f.input.consume().forEach((command, player) => stepRun(runs[player], command));
    f.key('KeyS');
    f.up('KeyS');
    f.down(1, 'down', 9);
    f.lift(1, 'down', 9);
    const before = runs.map(authoritativeCheckpoint);
    f.input.clearPhysical();
    f.setActive(false);
    f.input.poll();
    assert.deepEqual(runs.map(authoritativeCheckpoint), before);
    f.setActive(true);
    const reads = f.reads;
    for (let tick = 0; tick < 30; tick++)
      f.input.consume().forEach((command, player) => stepRun(runs[player], command));
    assert.deepEqual(runs[0], runs[1]);
    assert.equal(runs[0].player.direction, 'down');
    assert.equal(f.reads, reads);
  });
