import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveControllerBindings } from '../controller-bindings.mjs';
import {
  createControllerRouter,
  neutralControllerFlight,
  neutralControllerUI,
} from '../ui/controller-router.mjs';

const makePad = (index = 0, id = `Pad ${index}`) => ({
  index,
  id,
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});
function fixture(t, options = {}) {
  const pad = makePad();
  let pads = [pad],
    reads = 0;
  const router = createControllerRouter({
    eventTarget: null,
    ...options,
    readPads: () => {
      reads++;
      return pads;
    },
  });
  t.after(() => router.destroy());
  const sample = (scope = 'flight', timeMs = 0) => router.sample({ scope, timeMs });
  const release = (target = pad) => {
    target.axes.fill(0);
    target.buttons.forEach((button) => {
      button.pressed = false;
      button.value = 0;
    });
  };
  const join = (scope = 'flight', target = pad, button = 0) => {
    release(target);
    sample(scope);
    target.buttons[button].pressed = true;
    const frame = sample(scope);
    assert.equal(frame.status.code, 'joined');
    target.buttons[button].pressed = false;
    assertNeutral(sample(scope));
    return frame.assigned;
  };
  return {
    pad,
    router,
    sample,
    join,
    release,
    setPads: (value) => {
      pads = value;
    },
    get reads() {
      return reads;
    },
  };
}
function assertNeutral(frame) {
  assert.deepEqual(frame.flight, neutralControllerFlight());
  assert.deepEqual(frame.ui, neutralControllerUI());
}
function custom() {
  const config = resolveControllerBindings();
  config.flight.buttons = {
    up: 0,
    down: 1,
    left: 2,
    right: 3,
    ability: 4,
    pickup: 5,
    boost: 6,
    hangar: 7,
    stop: 8,
    pause: 9,
  };
  config.menu.buttons = { up: 12, down: 13, left: 14, right: 15, confirm: 2, back: 3, menu: 8 };
  config.flight.stick = { enabled: true, xAxis: 2, yAxis: 3, invertX: true, invertY: false };
  config.deadZone = { press: 0.35, release: 0.25 };
  return config;
}

test('all remapped flight buttons emit the existing normalized command fields', (t) => {
  const config = custom();
  for (const [action, index] of Object.entries(config.flight.buttons)) {
    const f = fixture(t, { bindings: config });
    f.join();
    f.pad.buttons[index].pressed = true;
    const expected = neutralControllerFlight();
    if (['up', 'down', 'left', 'right'].includes(action)) expected.direction = action;
    else expected[action === 'ability' ? 'action' : action] = true;
    const frame = f.sample();
    assert.deepEqual(frame.flight, expected, action);
    assert.deepEqual(frame.ui, neutralControllerUI());
  }
});

test('all remapped menu actions remain scoped and edge-triggered with original priority', (t) => {
  const config = custom();
  for (const [action, index] of Object.entries(config.menu.buttons)) {
    const f = fixture(t, { bindings: config });
    f.join('modal:fixture');
    f.pad.buttons[index].pressed = true;
    const expected = neutralControllerUI();
    if (['up', 'down', 'left', 'right'].includes(action)) expected.direction = action;
    else expected[action] = true;
    assert.deepEqual(f.sample('modal:fixture').ui, expected, action);
    assertNeutral(f.sample('modal:fixture'));
  }
  const f = fixture(t, { bindings: config });
  f.join('ready');
  for (const action of ['confirm', 'back', 'menu', 'up'])
    f.pad.buttons[config.menu.buttons[action]].pressed = true;
  assert.deepEqual(f.sample('ready').ui, { ...neutralControllerUI(), menu: true });
  f.release();
  f.sample('ready');
  for (const action of ['confirm', 'back'])
    f.pad.buttons[config.menu.buttons[action]].pressed = true;
  assert.deepEqual(f.sample('ready').ui, { ...neutralControllerUI(), back: true });
});

test('fixed physical join controls remain available even when none is a mapped menu action', (t) => {
  const config = resolveControllerBindings();
  config.flight.buttons = {
    up: 12,
    down: 13,
    left: 14,
    right: 15,
    ability: 4,
    pickup: 5,
    boost: 6,
    hangar: 7,
    stop: 10,
    pause: 11,
  };
  config.menu.buttons = { up: 12, down: 13, left: 14, right: 15, confirm: 4, back: 5, menu: 6 };
  for (const index of [0, 1, 2, 3, 9]) {
    const f = fixture(t, { bindings: config });
    f.join('ready', f.pad, index);
    f.pad.buttons[index].pressed = true;
    assertNeutral(f.sample('ready'));
    f.release();
    f.sample('ready');
    f.pad.buttons[4].pressed = true;
    assert.equal(f.sample('ready').ui.confirm, true);
  }
  const f = fixture(t, { bindings: config });
  f.sample('ready');
  f.pad.buttons[4].pressed = true;
  assert.equal(
    f.sample('ready').assigned,
    null,
    'A remapped Confirm does not replace the fixed deliberate join controls.',
  );
});

test('custom analog axes/inversion are context-specific and digital directions still win', (t) => {
  const config = custom(),
    f = fixture(t, { bindings: config });
  f.join();
  f.pad.axes = [0, -1, 0.8, 0.2];
  assert.equal(f.sample().flight.direction, 'left');
  f.pad.buttons[config.flight.buttons.right].pressed = true;
  assert.equal(f.sample().flight.direction, 'right');
  f.pad.buttons[config.flight.buttons.up].pressed = true;
  assert.equal(f.sample().flight.direction, 'up');
  assertNeutral(f.sample('ready'));
  f.release();
  f.sample('ready');
  f.pad.axes = [0, -1, 1, 0];
  assert.equal(f.sample('ready').ui.direction, 'up');
  f.pad.axes = [0.8, 0, 0, 0];
  assert.equal(f.sample('ready').ui.direction, 'right');
});

test('configured stick hysteresis resists threshold chatter and releases at equality', (t) => {
  const config = resolveControllerBindings();
  config.deadZone.release = 0.25;
  const f = fixture(t, { bindings: config });
  f.join();
  const values = [0.35, 0.36, 0.34, 0.26, 0.25, 0.34, 0.36],
    expected = [null, 'right', 'right', 'right', null, null, 'right'];
  for (let i = 0; i < values.length; i++) {
    f.pad.axes[0] = values[i];
    assert.equal(f.sample().flight.direction, expected[i]);
  }
});

for (const reason of ['pause', 'hangar', 'stop', 'clear', 'scope', 'remap'])
  test(`${reason} clears stick history and requires physical release before the next command`, (t) => {
    const config = resolveControllerBindings();
    config.deadZone.release = 0.25;
    const f = fixture(t, { bindings: config });
    f.join();
    f.pad.axes[0] = 0.8;
    assert.equal(f.sample().flight.direction, 'right');
    let scope = 'flight';
    if (['pause', 'hangar', 'stop'].includes(reason)) {
      f.pad.buttons[config.flight.buttons[reason]].pressed = true;
      assert.deepEqual(f.sample().flight, { ...neutralControllerFlight(), [reason]: true });
      f.pad.buttons[config.flight.buttons[reason]].pressed = false;
    } else if (reason === 'clear') f.router.clear();
    else if (reason === 'remap') f.router.setBindings(config);
    else scope = 'ready';
    f.pad.axes[0] = 0.3;
    const blocked = f.sample(scope);
    assert.equal(blocked.status.code, 'waiting-neutral');
    assertNeutral(blocked);
    f.pad.axes[0] = 0.25;
    assertNeutral(f.sample(scope));
    f.pad.axes[0] = 0.3;
    assertNeutral(f.sample(scope));
    f.pad.axes[0] = 0.36;
    const frame = f.sample(scope);
    assert.equal((scope === 'flight' ? frame.flight : frame.ui).direction, 'right');
  });

test('neutral gating includes both contexts and fixed join buttons before a remapped action can fire', (t) => {
  const config = custom();
  config.menu.buttons.confirm = 11;
  config.flight.buttons.pause = 10;
  for (const hold of [
    (pad) => {
      pad.buttons[11].pressed = true;
    }, // Only the menu uses 11.
    (pad) => {
      pad.buttons[6].pressed = true;
    }, // Only flight uses 6.
    (pad) => {
      pad.buttons[9].pressed = true;
    }, // Fixed join input, unmapped in both contexts.
    (pad) => {
      pad.axes[0] = 0.3;
    }, // Menu's left stick between release/press.
    (pad) => {
      pad.axes[2] = 0.3;
    }, // Flight's right stick between release/press.
  ]) {
    const f = fixture(t, { bindings: config });
    f.join();
    f.router.setBindings(config);
    hold(f.pad);
    assert.equal(f.sample().status.code, 'waiting-neutral');
    f.release();
    assertNeutral(f.sample());
    f.pad.buttons[4].pressed = true;
    assert.equal(f.sample().flight.action, true);
  }
});

test('buttons-only configurations ignore analog drift while keeping mapped movement available', (t) => {
  const config = custom();
  config.flight.stick.enabled = false;
  config.menu.stick.enabled = false;
  const f = fixture(t, { bindings: config });
  f.pad.axes = [1, 1, -1, -1];
  assert.equal(f.sample().status.code, 'ready-to-join');
  f.pad.buttons[9].pressed = true;
  assert.equal(f.sample().status.code, 'joined');
  f.pad.buttons[9].pressed = false;
  assertNeutral(f.sample());
  f.pad.buttons[3].pressed = true;
  assert.equal(f.sample().flight.direction, 'right');
});

test('successful adoption retains ownership and blocks a held newly mapped input without reading hardware', (t) => {
  const f = fixture(t);
  const owner = f.join();
  const config = resolveControllerBindings();
  config.flight.buttons.ability = 4;
  f.pad.buttons[4].pressed = true;
  const reads = f.reads;
  f.router.setBindings(config);
  assert.equal(f.reads, reads);
  assert.equal(f.sample().status.code, 'waiting-neutral');
  assert.deepEqual(f.sample().assigned, owner);
  f.pad.buttons[4].pressed = false;
  assertNeutral(f.sample());
  f.pad.buttons[4].pressed = true;
  assert.equal(f.sample().flight.action, true);
  assert.equal(
    f.sample().flight.action,
    true,
    'The flight adapter still receives held ability state.',
  );
  f.pad.buttons[0].pressed = true;
  f.pad.buttons[4].pressed = false;
  assert.equal(f.sample().flight.action, false);
});

test('invalid adoption preserves bindings, held UI edges, repeat deadlines and active hysteresis', (t) => {
  const config = resolveControllerBindings();
  config.deadZone.release = 0.25;
  const invalid = resolveControllerBindings();
  invalid.menu.buttons.confirm = 1;
  const f = fixture(t, { bindings: config });
  f.join('ready');
  f.pad.buttons[0].pressed = true;
  assert.equal(f.sample('ready').ui.confirm, true);
  const reads = f.reads;
  assert.throws(() => f.router.setBindings(invalid), /already assigned/);
  assert.equal(f.reads, reads);
  assert.equal(f.sample('ready').ui.confirm, false);
  f.pad.buttons[0].pressed = false;
  f.sample('ready');
  f.pad.axes[0] = 0.5;
  assert.equal(f.sample('ready', 10).ui.direction, 'right');
  f.pad.axes[0] = 0.3;
  assert.throws(() => f.router.setBindings(invalid), /already assigned/);
  assert.equal(f.sample('ready', 359).ui.direction, null);
  assert.equal(
    f.sample('ready', 360).ui.direction,
    'right',
    'Rejected settings preserve both the original repeat deadline and active lower threshold.',
  );
});

test('successful adoption clears repeat timing and consumes a fresh neutral frame before UI resumes', (t) => {
  const f = fixture(t);
  f.join('ready');
  f.pad.axes[0] = 1;
  assert.equal(f.sample('ready', 10).ui.direction, 'right');
  f.router.setBindings(null);
  assertNeutral(f.sample('ready', 10000));
  f.pad.axes[0] = 0;
  assertNeutral(f.sample('ready', 10001));
  f.pad.axes[0] = 1;
  assert.equal(f.sample('ready', 10002).ui.direction, 'right');
  assert.equal(f.sample('ready', 10351).ui.direction, null);
  assert.equal(f.sample('ready', 10352).ui.direction, 'right');
  assert.equal(f.sample('ready', 10352).ui.direction, null);
});

test('adoption owns its maps and sampling does not revisit caller configuration getters', (t) => {
  const source = custom(),
    f = fixture(t, { bindings: source });
  f.join();
  let reads = 0;
  Object.defineProperty(source.flight.buttons, 'ability', {
    enumerable: true,
    get() {
      reads++;
      throw new Error('Retained caller data');
    },
  });
  source.flight.stick.invertX = false;
  f.pad.buttons[4].pressed = true;
  f.pad.axes[2] = 1;
  for (let i = 0; i < 10; i++) {
    const before = f.reads,
      frame = f.sample();
    assert.equal(f.reads, before + 1);
    assert.equal(frame.flight.action, true);
    assert.equal(frame.flight.direction, 'left');
  }
  assert.equal(reads, 0);
  const next = custom();
  f.router.setBindings(next);
  next.flight.buttons.ability = 10;
  next.deadZone.press = 0.6;
  f.release();
  f.sample();
  f.pad.buttons[4].pressed = true;
  f.pad.axes[2] = 0.4;
  assert.equal(f.sample().flight.action, true);
  assert.equal(f.sample().flight.direction, 'left');
});

test('legacy constructor deadZone stays compatible while explicit documents and later reset own thresholds', (t) => {
  for (const bindings of [null, undefined]) {
    const f = fixture(t, { bindings, deadZone: 0.5 });
    f.join();
    f.pad.axes[0] = 0.4;
    assert.equal(f.sample().flight.direction, null);
    f.pad.axes[0] = 0.500001;
    assert.equal(f.sample().flight.direction, 'right');
    f.pad.axes[0] = 0.5;
    assert.equal(f.sample().flight.direction, null);
    f.router.setBindings(null);
    f.release();
    f.sample();
    f.pad.axes[0] = 0.4;
    assert.equal(f.sample().flight.direction, 'right');
  }
  const f = fixture(t, { bindings: resolveControllerBindings(), deadZone: 0.5 });
  f.join();
  f.pad.axes[0] = 0.4;
  assert.equal(f.sample().flight.direction, 'right');
  assert.throws(() =>
    createControllerRouter({
      bindings: resolveControllerBindings(),
      deadZone: NaN,
      eventTarget: null,
    }),
  );
});

test('remapped flight emergency priority suppresses equipment and analog triggers retain threshold semantics', (t) => {
  const config = custom();
  for (const priority of [['pause', 'hangar', 'stop'], ['hangar', 'stop'], ['stop']]) {
    const f = fixture(t, { bindings: config });
    f.join();
    for (const action of [...priority, 'ability', 'pickup', 'boost', 'right'])
      f.pad.buttons[config.flight.buttons[action]].pressed = true;
    assert.deepEqual(f.sample().flight, { ...neutralControllerFlight(), [priority[0]]: true });
    assertNeutral(f.sample());
  }
  const f = fixture(t, { bindings: config });
  f.join();
  for (const [value, expected] of [
    [0.49, false],
    [0.5, true],
    [1, true],
    [1.01, false],
    [NaN, false],
    ['1', false],
  ]) {
    f.pad.buttons[6] = { pressed: false, value };
    assert.equal(f.sample().flight.boost, expected);
  }
});

test('hysteresis is per connection and loss requires neutral plus an explicit new join', (t) => {
  const config = custom(),
    f = fixture(t, { bindings: config });
  const second = makePad(1);
  f.setPads([f.pad, second]);
  const owner = f.join();
  f.pad.axes[2] = 0.8;
  assert.equal(f.sample().flight.direction, 'left');
  second.axes[2] = 0.3;
  f.setPads([null, second]);
  assert.equal(f.sample().disconnected, true);
  second.buttons[0].pressed = true;
  assert.equal(f.sample().assigned, null);
  f.release(second);
  f.sample();
  second.buttons[0].pressed = true;
  const joined = f.sample();
  assert.equal(joined.assigned.index, 1);
  assert.ok(joined.assigned.generation > owner.generation);
  assertNeutral(joined);
  second.buttons[0].pressed = false;
  f.sample();
  second.axes[2] = 0.3;
  assert.equal(f.sample().flight.direction, null);
  second.axes[2] = 0.36;
  assert.equal(f.sample().flight.direction, 'left');
});

test('invalid initial bindings install no listener and a destroyed router cannot be revived by adoption', (t) => {
  let listeners = 0;
  assert.throws(
    () =>
      createControllerRouter({
        bindings: {},
        eventTarget: {
          addEventListener() {
            listeners++;
          },
        },
      }),
    /Invalid controller bindings/,
  );
  assert.equal(listeners, 0);
  const f = fixture(t);
  f.join();
  f.router.destroy();
  const reads = f.reads;
  assert.throws(() => f.router.setBindings(custom()), /stopped/);
  assertNeutral(f.sample());
  assert.equal(f.reads, reads);
});
