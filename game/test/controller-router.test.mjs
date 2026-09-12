import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createControllerRouter,
  neutralControllerFlight,
  neutralControllerUI,
} from '../ui/controller-router.mjs';

const pad = (index = 0, id = `Controller ${index}`) => ({
  index,
  id,
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});
function fixture() {
  const first = pad(),
    listeners = new Map();
  let pads = [first],
    reads = 0;
  const eventTarget = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
  const router = createControllerRouter({
    readPads: () => {
      reads++;
      return pads;
    },
    eventTarget,
  });
  const sample = (scope = 'ready', timeMs = 0) => router.sample({ scope, timeMs });
  const join = (selected = first, scope = 'ready') => {
    selected.buttons.forEach((button) => {
      button.pressed = false;
      button.value = 0;
    });
    selected.axes.fill(0);
    sample(scope);
    selected.buttons[0].pressed = true;
    const result = sample(scope);
    assert.equal(result.status.code, 'joined');
    selected.buttons[0].pressed = false;
    sample(scope);
    return result.assigned;
  };
  return {
    router,
    first,
    sample,
    join,
    listeners,
    setPads: (value) => {
      pads = value;
    },
    get reads() {
      return reads;
    },
  };
}
function assertNeutral(result) {
  assert.deepEqual(result.flight, neutralControllerFlight());
  assert.deepEqual(result.ui, neutralControllerUI());
}

test('joining needs an observed neutral then a deliberate button; join never activates UI or flight', () => {
  const f = fixture();
  f.first.buttons[0].pressed = true;
  assert.equal(f.sample().assigned, null);
  assert.equal(f.sample().status.code, 'waiting-neutral');
  f.first.buttons[0].pressed = false;
  assert.equal(f.sample().status.code, 'ready-to-join');
  f.first.buttons[0].pressed = true;
  const joined = f.sample();
  assert.equal(joined.assigned.index, 0);
  assertNeutral(joined);
  assertNeutral(f.sample());
  f.first.buttons[0].pressed = false;
  assertNeutral(f.sample());
  f.first.buttons[0].pressed = true;
  assert.equal(f.sample().ui.confirm, true);
  assert.equal(f.sample().ui.confirm, false);
});

test('one sample reads hardware once, uses the latest object, and never retains mutable snapshots', () => {
  const f = fixture();
  f.join();
  const before = f.reads;
  const fresh = pad();
  fresh.axes[0] = 0.8;
  f.setPads([fresh]);
  const frame = f.sample();
  assert.equal(f.reads, before + 1);
  assert.equal(frame.ui.direction, 'right');
  frame.assigned.index = 9;
  frame.ui.direction = 'left';
  assert.equal(f.sample().assigned.index, 0);
});

test('only exact flight scope emits held gameplay actions; other scopes emit UI edges', () => {
  const f = fixture();
  f.join(f.first, 'flight');
  f.first.axes[1] = -0.8;
  for (const index of [0, 2, 5]) f.first.buttons[index].pressed = true;
  const frame = f.sample('flight');
  assert.deepEqual(frame.flight, {
    ...neutralControllerFlight(),
    direction: 'up',
    action: true,
    pickup: true,
    boost: true,
  });
  assert.deepEqual(frame.ui, neutralControllerUI());
  assert.equal(f.sample('flight').flight.action, true);
  for (const scope of [
    'ready',
    'paused',
    'dialog:hangar',
    'won',
    'celebration',
    'picture',
    'flight:preview',
  ])
    assertNeutral(f.sample(scope));
});

test('scope changes and clear suppress held directions/buttons until a neutral sample', () => {
  const f = fixture();
  f.join();
  f.first.buttons[0].pressed = true;
  assert.equal(f.sample().ui.confirm, true);
  assertNeutral(f.sample('flight'));
  assertNeutral(f.sample('flight'));
  f.first.buttons[0].pressed = false;
  assertNeutral(f.sample('flight'));
  f.first.axes[0] = 1;
  assert.equal(f.sample('flight').flight.direction, 'right');
  f.router.clear();
  assertNeutral(f.sample('flight'));
  f.first.axes[0] = 0;
  assertNeutral(f.sample('flight'));
  f.first.axes[0] = -1;
  assert.equal(f.sample('flight').flight.direction, 'left');
});

test('special flight buttons are single actions with priority and cannot leak held equipment', () => {
  for (const [index, kind] of [
    [9, 'pause'],
    [3, 'hangar'],
    [1, 'stop'],
  ]) {
    const f = fixture();
    f.join(f.first, 'flight');
    f.first.axes[0] = 1;
    for (const button of [0, 2, 5, index]) f.first.buttons[button].pressed = true;
    assert.deepEqual(f.sample('flight').flight, { ...neutralControllerFlight(), [kind]: true });
    assertNeutral(f.sample('flight'));
  }
  const f = fixture();
  f.join(f.first, 'flight');
  for (const index of [1, 3, 9]) f.first.buttons[index].pressed = true;
  assert.deepEqual(f.sample('flight').flight, { ...neutralControllerFlight(), pause: true });
});

test('UI activation/back/menu never repeat and suppress same-sample direction changes', () => {
  const f = fixture();
  f.join();
  for (const index of [0, 1, 9]) f.first.buttons[index].pressed = true;
  f.first.axes[0] = 1;
  assert.deepEqual(f.sample('ready', 10).ui, { ...neutralControllerUI(), menu: true });
  const held = f.sample('ready', 20).ui;
  assert.equal(held.menu, false);
  assert.equal(held.back, false);
  assert.equal(held.confirm, false);
  f.first.buttons[9].pressed = false;
  assert.equal(
    f.sample('ready', 30).ui.back,
    false,
    'a held Back is not newly pressed after Menu release',
  );
  f.first.buttons[1].pressed = false;
  f.sample('ready', 40);
  f.first.buttons[1].pressed = true;
  assert.equal(f.sample('ready', 50).ui.back, true);
});

test('UI repeat uses elapsed time, resets on reversal, and produces no catch-up burst', () => {
  const f = fixture();
  f.join();
  f.first.axes[0] = 1;
  assert.equal(f.sample('ready', 0).ui.direction, 'right');
  assert.equal(f.sample('ready', 349).ui.direction, null);
  assert.equal(f.sample('ready', 350).ui.direction, 'right');
  assert.equal(f.sample('ready', 469).ui.direction, null);
  assert.equal(f.sample('ready', 470).ui.direction, 'right');
  assert.equal(f.sample('ready', 100000).ui.direction, 'right');
  assert.equal(f.sample('ready', 100000).ui.direction, null);
  assert.equal(f.sample('ready', 99999).ui.direction, null);
  f.first.axes[0] = -1;
  assert.equal(f.sample('ready', 100001).ui.direction, 'left');
  assert.equal(f.sample('ready', 100350).ui.direction, null);
  assert.equal(f.sample('ready', 100351).ui.direction, 'left');
});

test('direction repeat remains bounded at slow and fast sampling rates', () => {
  for (const step of [100, 1000 / 30, 1000 / 60, 1000 / 120]) {
    const f = fixture();
    f.join();
    f.first.axes[1] = 1;
    const events = [];
    for (let time = 0; time < 2000; time += step)
      if (f.sample('ready', time).ui.direction) events.push(time);
    assert.equal(events[0], 0);
    assert.ok(events[1] >= 350 && events[1] < 350 + step + 0.001);
    for (let i = 2; i < events.length; i++) assert.ok(events[i] - events[i - 1] >= 120 - 1e-8);
    assert.ok(events.length <= 15);
  }
});

test('finite axes, threshold and digital priority yield reliable cardinal input', () => {
  const f = fixture();
  f.join(f.first, 'flight');
  for (const value of [NaN, Infinity, -Infinity, '1', undefined]) {
    f.first.axes = [value, value, 0, 0];
    assert.equal(f.sample('flight').flight.direction, null);
  }
  f.first.axes = [0.35, 0, 0, 0];
  assert.equal(f.sample('flight').flight.direction, null);
  f.first.axes = [0.3501, 0, 0, 0];
  assert.equal(f.sample('flight').flight.direction, 'right');
  f.first.axes = [2, -9, 0, 0];
  assert.equal(f.sample('flight').flight.direction, 'up');
  f.first.buttons[14].pressed = true;
  assert.equal(f.sample('flight').flight.direction, 'left');
  f.first.buttons[0] = { pressed: 'true', value: '1' };
  assert.equal(f.sample('flight').flight.action, false);
});

test('assignment follows the deliberate joining pad and ignores later lower-index arrivals', () => {
  const f = fixture(),
    second = pad(4);
  f.setPads([null, null, null, null, second]);
  f.join(second);
  f.setPads([f.first, null, null, null, second]);
  f.first.buttons[0].pressed = true;
  second.axes[0] = -1;
  const frame = f.sample();
  assert.equal(frame.assigned.index, 4);
  assert.equal(frame.ui.direction, 'left');
  assert.equal(frame.ui.confirm, false);
});

test('selected pad loss pauses ownership even while another pad remains; rejoin is explicit', () => {
  const f = fixture(),
    second = pad(1);
  f.setPads([f.first, second]);
  f.join();
  second.buttons[0].pressed = true;
  f.setPads([null, second]);
  const lost = f.sample('flight');
  assert.equal(lost.disconnected, true);
  assert.equal(lost.assigned, null);
  assertNeutral(lost);
  assert.equal(f.sample('flight').assigned, null);
  second.buttons[0].pressed = false;
  f.sample('flight');
  second.buttons[0].pressed = true;
  const joined = f.sample('flight');
  assert.equal(joined.assigned.index, 1);
  assertNeutral(joined);
  assert.equal(joined.disconnected, false);
});

test('descriptor replacement and same-model explicit disconnect invalidate a reused slot', () => {
  const f = fixture();
  const original = f.join();
  f.setPads([pad(0, 'Different device')]);
  assert.equal(f.sample().disconnected, true);
  const replacement = pad(0, 'Different device');
  f.setPads([replacement]);
  const next = f.join(replacement);
  assert.ok(next.generation > original.generation);
  f.listeners.get('gamepaddisconnected')({ gamepad: { index: 0 } });
  const result = f.sample();
  assert.equal(result.disconnected, true);
  assert.equal(result.assigned, null);
  assert.ok(f.join(replacement).generation > next.generation);
});

test('disconnecting an unassigned second pad never disrupts the assigned controller', () => {
  const f = fixture(),
    second = pad(1);
  f.setPads([f.first, second]);
  f.join();
  f.router.disconnect(1);
  f.setPads([f.first]);
  const frame = f.sample();
  assert.equal(frame.disconnected, false);
  assert.equal(frame.assigned.index, 0);
});

test('API denial clears assignment once and distinguishes unsupported from absent controllers', () => {
  const unsupported = pad();
  unsupported.mapping = '';
  let failure = false,
    source = [];
  const router = createControllerRouter({
    eventTarget: null,
    readPads: () => {
      if (failure) throw new Error('denied');
      return source;
    },
  });
  assert.equal(router.sample({ scope: 'ready' }).status.code, 'waiting-controller');
  source = [unsupported];
  assert.equal(router.sample({ scope: 'ready' }).status.code, 'unsupported');
  const normal = pad();
  source = [normal];
  router.sample({ scope: 'ready' });
  normal.buttons[0].pressed = true;
  assert.ok(router.sample({ scope: 'ready' }).assigned);
  failure = true;
  const failed = router.sample({ scope: 'ready' });
  assert.equal(failed.disconnected, true);
  assert.equal(failed.status.code, 'unavailable');
  assertNeutral(failed);
  assert.equal(router.sample({ scope: 'ready' }).disconnected, false);
});

test('invalidate requires rejoin; destroyed router removes its listener and performs no more reads', () => {
  const f = fixture();
  f.join();
  f.router.invalidate();
  assert.equal(f.sample().disconnected, true);
  assert.equal(f.sample().assigned, null);
  f.join();
  f.router.destroy();
  const reads = f.reads;
  assertNeutral(f.sample());
  assert.equal(f.reads, reads);
  assert.equal(f.listeners.size, 0);
});

test('invalid configuration rejects and malformed clocks never cause repeating activations', () => {
  for (const options of [
    { deadZone: NaN },
    { deadZone: 0.9 },
    { repeatDelayMs: 0 },
    { repeatIntervalMs: Infinity },
    { readPads: null },
  ])
    assert.throws(() => createControllerRouter({ ...options, eventTarget: null }));
  const f = fixture();
  assert.throws(() => f.router.sample({ scope: '' }));
  f.join();
  f.first.axes[0] = 1;
  assert.equal(f.sample('ready', 0).ui.direction, 'right');
  for (const value of [NaN, Infinity, '5000', -5000])
    assert.equal(f.sample('ready', value).ui.direction, null);
});
