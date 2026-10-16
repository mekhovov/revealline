import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveControllerBindings } from '../controller-bindings.mjs';
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
function fixture(options = {}) {
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
    ...options,
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
  assert.equal(joined.confirmHeld, true, 'join Confirm remains observable to native-echo guards');
  assertNeutral(joined);
  assertNeutral(f.sample());
  f.first.buttons[0].pressed = false;
  const released = f.sample();
  assert.equal(released.confirmHeld, false);
  assertNeutral(released);
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

test('overlapping South and West aliases form one menu Confirm gesture', () => {
  const f = fixture({ navigationAliases: true });
  f.join();
  f.first.buttons[0].pressed = true;
  assert.equal(f.sample().ui.confirm, true);
  f.first.buttons[2].pressed = true;
  assert.equal(f.sample().ui.confirm, false, 'the second alias cannot emit a second edge');
  f.first.buttons[0].pressed = false;
  assert.equal(f.sample().ui.confirm, false, 'holding either alias keeps one gesture active');
  f.first.buttons[2].pressed = false;
  f.sample();
  f.first.buttons[2].pressed = true;
  assert.equal(f.sample().ui.confirm, true, 'a new neutral-to-pressed gesture remains usable');
});

test('menu frames expose exact Confirm indexes and the Gamepad timestamp', () => {
  const f = fixture({ navigationAliases: true });
  f.join();
  f.first.timestamp = 41.5;
  f.first.buttons[0].pressed = true;
  f.first.buttons[2].pressed = true;
  const frame = f.sample();
  assert.deepEqual(frame.confirmButtons, [0, 2]);
  assert.equal(frame.confirmHeld, true);
  assert.equal(frame.gamepadTimestamp, 41.5);
  f.first.timestamp = 52;
  f.first.buttons[0].pressed = false;
  const westOnly = f.sample();
  assert.deepEqual(westOnly.confirmButtons, [2]);
  assert.equal(westOnly.gamepadTimestamp, 52);
});

test('native Confirm probes expose live assigned input without adopting or consuming its edge', () => {
  const f = fixture({ autoJoin: true, navigationAliases: true });
  assert.equal(f.router.readMenuConfirm({ scope: 'ready' }).reason, 'unassigned');
  assert.equal(f.reads, 0, 'an unassigned probe cannot discover or adopt a controller');
  const joined = f.sample();
  assert.deepEqual(joined.confirmSnapshot, f.router.readMenuConfirm({ scope: 'ready' }));
  f.first.timestamp = 75;
  f.first.buttons[0].pressed = true;
  f.first.buttons[2].pressed = true;
  const observed = f.router.readMenuConfirm({ scope: 'ready' });
  assert.deepEqual(observed, {
    assigned: joined.assigned,
    buttons: [0, 2],
    timestamp: 75,
    held: true,
    neutral: false,
    eligible: true,
    blocked: false,
    reason: 'ready',
    scope: 'ready',
    routerScope: 'ready',
  });
  const before = f.reads,
    frame = f.sample();
  assert.equal(f.reads, before + 1, 'the regular frame reuses its single hardware read');
  assert.equal(frame.ui.confirm, true, 'the native probe did not consume the Confirm edge');
  assert.deepEqual(frame.confirmSnapshot, observed);
  observed.assigned.index = 99;
  observed.buttons.length = 0;
  frame.confirmSnapshot.assigned.generation = -1;
  assert.equal(f.router.readMenuConfirm().assigned.index, 0);
  assert.equal(f.router.readMenuConfirm().assigned.generation, joined.assigned.generation);
  assert.deepEqual(f.router.readMenuConfirm().buttons, [0, 2]);
});

test('Confirm probes cannot lift neutral gates or change the active scope', () => {
  const f = fixture();
  f.join();
  f.router.clear();
  assert.equal(f.router.readMenuConfirm().neutral, true);
  assert.equal(f.router.readMenuConfirm().reason, 'waiting-neutral');
  f.first.buttons[0].pressed = true;
  assert.equal(f.sample().ui.confirm, false, 'a probe is not a neutral-gate acknowledgement');
  f.first.buttons[0].pressed = false;
  f.sample();
  f.first.buttons[0].pressed = true;
  const otherScope = f.router.readMenuConfirm({ scope: 'modal:settings' });
  assert.equal(otherScope.eligible, false);
  assert.equal(otherScope.reason, 'scope-change');
  assert.equal(otherScope.blocked, false);
  assert.equal(otherScope.routerScope, 'ready');
  assert.equal(f.router.readMenuConfirm({ scope: 'ready' }).eligible, true);
  assert.equal(f.sample().ui.confirm, true, 'a probe did not switch scopes or clear the edge');
});

test('repeated native probes leave direction, Back, Menu, and flight edges for the host', () => {
  const cases = [
    ['ready', 13, 'ui', 'direction', 'down'],
    ['ready', 1, 'ui', 'back', true],
    ['ready', 9, 'ui', 'menu', true],
    ['flight', 9, 'flight', 'pause', true],
    ['flight', 3, 'flight', 'hangar', true],
    ['flight', 0, 'flight', 'action', true],
  ];
  for (const [scope, index, group, action, expected] of cases) {
    const f = fixture();
    f.join(f.first, scope);
    f.first.buttons[index].pressed = true;
    for (let attempt = 0; attempt < 3; attempt++) {
      const observed = f.router.readMenuConfirm({ scope });
      assert.equal(observed.eligible, scope !== 'flight');
      if (scope === 'flight') assert.equal(observed.reason, 'flight');
    }
    assert.equal(f.sample(scope)[group][action], expected, `${scope} ${action} is not consumed`);
  }
});

test('Confirm probes respect custom bindings and do not advance stick hysteresis', () => {
  const config = resolveControllerBindings();
  config.menu.buttons.confirm = 7;
  config.deadZone = { press: 0.5, release: 0.2 };
  const f = fixture({ bindings: config, navigationAliases: true });
  f.join();
  f.first.buttons[0].pressed = true;
  f.first.buttons[2].pressed = true;
  assert.deepEqual(f.router.readMenuConfirm().buttons, []);
  f.first.buttons[7].pressed = true;
  assert.deepEqual(f.router.readMenuConfirm().buttons, [7]);
  assert.equal(f.sample().ui.confirm, true);
  f.first.buttons.forEach((button) => (button.pressed = false));
  f.sample();
  f.first.axes[0] = 0.6;
  assert.equal(f.router.readMenuConfirm().neutral, false);
  f.first.axes[0] = 0.3;
  assert.equal(f.sample().ui.direction, null, 'a probe cannot latch analog movement');
});

test('Confirm probes report assignment loss without stealing router disconnect handling', () => {
  const f = fixture({ diagnostics: true });
  const initial = f.join();
  const replacement = pad(0, 'Replacement');
  f.setPads([replacement]);
  const lost = f.router.readMenuConfirm();
  assert.equal(lost.assigned, null);
  assert.equal(lost.eligible, false);
  assert.equal(lost.reason, 'assignment-lost');
  assert.equal(lost.rawGamepads[0].id, 'Replacement');
  const disconnected = f.sample();
  assert.equal(disconnected.disconnected, true);
  assert.equal(disconnected.confirmSnapshot.assigned, null);
  assert.equal(disconnected.confirmSnapshot.rawGamepads[0].id, 'Replacement');
  const next = f.join(replacement);
  assert.notEqual(next.generation, initial.generation);
  assert.equal(f.router.readMenuConfirm().assigned.generation, next.generation);
  f.router.disconnect(0);
  assert.equal(f.router.readMenuConfirm().reason, 'unassigned');
  assert.equal(f.sample().disconnected, true, 'the pending disconnect is retained');
  f.router.destroy();
  const reads = f.reads;
  assert.equal(f.router.readMenuConfirm().reason, 'disposed');
  assert.equal(f.reads, reads);
});

test('Confirm probes follow the assigned device when another pad exposes the same button', () => {
  const f = fixture(),
    selected = pad(1);
  f.setPads([null, selected]);
  const assigned = f.join(selected);
  f.setPads([f.first, selected]);
  f.first.buttons[0].pressed = true;
  assert.deepEqual(f.router.readMenuConfirm().assigned, assigned);
  assert.deepEqual(f.router.readMenuConfirm().buttons, []);
  selected.buttons[0].pressed = true;
  assert.deepEqual(f.router.readMenuConfirm().buttons, [0]);
  assert.equal(f.sample().ui.confirm, true);
});

test('a failed native Confirm read does not invalidate a healthy router assignment', () => {
  const device = pad();
  let unavailable = false;
  const f = fixture({
    autoJoin: true,
    readPads: () => {
      if (unavailable) throw new Error('Gamepad access failed');
      return [device];
    },
  });
  const joined = f.sample();
  unavailable = true;
  assert.equal(f.router.readMenuConfirm().reason, 'unavailable');
  unavailable = false;
  device.buttons[0].pressed = true;
  const frame = f.sample();
  assert.deepEqual(frame.assigned, joined.assigned);
  assert.equal(frame.ui.confirm, true);
  assert.equal(frame.disconnected, false);
});

test('opt-in Confirm diagnostics describe raw devices from the existing read and can be disabled', () => {
  let diagnostics = false;
  const f = fixture({ autoJoin: true, diagnostics: () => diagnostics }),
    unsupported = { ...pad(1, 'x'.repeat(600)), mapping: '', timestamp: 20 };
  f.first.buttons = Array.from({ length: 80 }, () => ({ pressed: false, value: 0 }));
  f.setPads([f.first, unsupported]);
  f.sample();
  assert.equal(f.router.readMenuConfirm().rawGamepads, undefined);
  diagnostics = true;
  f.first.timestamp = 50;
  for (const index of [0, 63, 70]) f.first.buttons[index].pressed = true;
  unsupported.buttons[1].pressed = true;
  const probe = f.router.readMenuConfirm();
  assert.deepEqual(probe.rawGamepads[0], {
    index: 0,
    id: 'Controller 0',
    mapping: 'standard',
    connected: true,
    timestamp: 50,
    buttonCount: 80,
    buttons: [0, 63],
  });
  assert.equal(probe.rawGamepads[1].id.length, 512);
  assert.equal(probe.rawGamepads[1].mapping, '');
  assert.deepEqual(probe.rawGamepads[1].buttons, [1]);
  const before = f.reads;
  assert.deepEqual(f.sample().confirmSnapshot.rawGamepads, probe.rawGamepads);
  assert.equal(f.reads, before + 1, 'frame diagnostics reuse the hardware snapshot');
  diagnostics = false;
  assert.equal(f.sample().confirmSnapshot.rawGamepads, undefined);
  assert.equal(f.router.readMenuConfirm().rawGamepads, undefined);
});

test('unassigned diagnostic probes report bounded raw pads without adopting any device', () => {
  const f = fixture({ autoJoin: true, diagnostics: true });
  f.setPads(Array.from({ length: 40 }, (_, index) => pad(index)));
  const observed = f.router.readMenuConfirm({ scope: 'ready' });
  assert.equal(observed.assigned, null);
  assert.equal(observed.reason, 'unassigned');
  assert.equal(observed.rawGamepads.length, 32);
  assert.equal(f.reads, 1);
  assert.equal(f.sample().status.code, 'joined', 'only the ordinary frame adopts input');
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

test('solo auto-join accepts the first action after neutral without consuming a join press', () => {
  const device = pad(0, 'Xbox Wireless Controller');
  const router = createControllerRouter({
    readPads: () => [device],
    autoJoin: true,
    navigationAliases: true,
  });
  assert.equal(router.sample({ scope: 'menu' }).status.code, 'joined');
  device.buttons[0].pressed = true;
  assert.equal(router.sample({ scope: 'menu' }).ui.confirm, true);
  assert.equal(router.sample({ scope: 'menu' }).ui.confirm, false);
  assertNeutral(router.sample({ scope: 'flight' }));
  device.buttons[0].pressed = false;
  assertNeutral(router.sample({ scope: 'flight' }));
  device.axes[0] = 0.75;
  assert.equal(router.sample({ scope: 'flight' }).flight.direction, 'right');
  router.destroy();
});

test('solo cannot start from held discovery input, scope changes, or a reconnected controller', () => {
  const device = pad();
  const router = createControllerRouter({ readPads: () => [device], autoJoin: true });
  device.axes[0] = 0.8;
  device.buttons[0].pressed = true;
  assert.equal(router.sample({ scope: 'menu' }).assigned, null);
  device.axes[0] = 0;
  device.buttons[0].pressed = false;
  assert.equal(router.sample({ scope: 'menu' }).status.code, 'joined');
  device.connected = false;
  assert.equal(router.sample({ scope: 'flight' }).disconnected, true);
  device.connected = true;
  device.buttons[0].pressed = true;
  assertNeutral(router.sample({ scope: 'flight' }));
  device.buttons[0].pressed = false;
  assert.equal(router.sample({ scope: 'flight' }).status.code, 'joined');
  router.destroy();
});

for (const name of [
  'Xbox Wireless Controller',
  'DualSense Wireless Controller',
  'DualShock 4',
  'Steam Deck (standard gamepad)',
  'Generic USB Gamepad',
]) {
  test(`${name}: both sticks, all D-pad directions, face actions and pause use standard physical positions`, () => {
    const device = pad(3, name);
    const router = createControllerRouter({
      readPads: () => [null, null, null, device],
      autoJoin: true,
      navigationAliases: true,
    });
    const sample = () => router.sample({ scope: 'flight' });
    const release = () => {
      device.axes.fill(0);
      device.buttons.forEach((b) => (b.pressed = false));
      sample();
    };
    assert.equal(sample().assigned.index, 3);
    for (const offset of [0, 2]) {
      for (const [x, y, direction] of [
        [1, 0, 'right'],
        [-1, 0, 'left'],
        [0, -1, 'up'],
        [0, 1, 'down'],
      ]) {
        release();
        device.axes[offset] = x;
        device.axes[offset + 1] = y;
        assert.equal(sample().flight.direction, direction);
      }
    }
    for (const [button, action, value] of [
      [12, 'direction', 'up'],
      [13, 'direction', 'down'],
      [14, 'direction', 'left'],
      [15, 'direction', 'right'],
      [0, 'action', true],
      [1, 'stop', true],
      [2, 'pickup', true],
      [3, 'hangar', true],
      [5, 'boost', true],
      [8, 'pause', true],
      [9, 'pause', true],
    ]) {
      release();
      device.buttons[button].pressed = true;
      assert.equal(sample().flight[action], value, `button ${button}`);
    }
    router.destroy();
  });
}

test('menu face aliases and shoulders/triggers work with edge detection and repeat', () => {
  const device = pad();
  let clock = 0;
  const router = createControllerRouter({
    readPads: () => [device],
    autoJoin: true,
    navigationAliases: true,
  });
  const sample = () => router.sample({ scope: 'settings', timeMs: clock++ });
  sample();
  for (const [button, action, value] of [
    [0, 'confirm', true],
    [1, 'back', true],
    [2, 'confirm', true],
    [3, 'back', true],
    [4, 'direction', 'up'],
    [5, 'direction', 'down'],
    [6, 'direction', 'up'],
    [7, 'direction', 'down'],
    [8, 'back', true],
    [9, 'menu', true],
  ]) {
    device.buttons[button].pressed = true;
    assert.equal(sample().ui[action], value, `button ${button}`);
    assertNeutral(sample());
    device.buttons[button].pressed = false;
    sample();
  }
  router.destroy();
});

test('saved defaults and label/dead-zone choices keep both sticks; explicit remaps take priority', async () => {
  const { resolveControllerBindings } = await import('../controller-bindings.mjs');
  const device = pad();
  const config = resolveControllerBindings(null);
  config.glyphFamily = 'playstation';
  config.deadZone = { press: 0.4, release: 0.2 };
  const router = createControllerRouter({
    readPads: () => [device],
    autoJoin: true,
    navigationAliases: true,
    bindings: config,
  });
  const sample = () => router.sample({ scope: 'menu' });
  sample();
  device.axes[2] = 0.8;
  assert.equal(sample().ui.direction, 'right');
  device.axes[2] = 0;
  sample();
  device.buttons[2].pressed = true;
  assert.equal(sample().ui.confirm, true);
  device.buttons[2].pressed = false;
  sample();
  config.menu.stick.enabled = false;
  router.setBindings(config);
  sample();
  device.axes[2] = 0.8;
  assert.equal(sample().ui.direction, null);
  device.axes[2] = 0;
  device.buttons[2].pressed = true;
  assert.equal(sample().ui.confirm, false);
  router.destroy();
});
