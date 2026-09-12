import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTROLLER_BOOST_MODES,
  DEFAULT_CONTROLLER_BOOST_MODE,
  resolveControllerBoostMode,
} from '../controller-boost.mjs';
import { resolveControllerBindings } from '../controller-bindings.mjs';
import {
  createControllerRouter,
  neutralControllerFlight,
  neutralControllerUI,
} from '../ui/controller-router.mjs';

function fixture(t, options = {}) {
  const pad = {
    index: 0,
    id: 'Boost test pad',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  let reads = 0,
    pads = [pad],
    broken = false;
  const router = createControllerRouter({
    eventTarget: null,
    boostMode: 'toggle',
    ...options,
    readPads: () => {
      reads++;
      if (broken) throw new Error('Unavailable');
      return pads;
    },
  });
  t.after(() => router.destroy());
  const sample = (scope = 'flight', extra = {}) => {
    const before = reads;
    const result = router.sample({ scope, timeMs: 0, ...extra });
    assert.equal(reads, before + 1, 'Each live sample reads the device exactly once.');
    return result;
  };
  const release = () => {
    pad.axes.fill(0);
    pad.buttons.forEach((b) => Object.assign(b, { pressed: false, value: 0 }));
  };
  const press = (index, value = true) => {
    pad.buttons[index].pressed = value;
  };
  const join = (scope = 'flight') => {
    release();
    sample(scope);
    press(0);
    assert.equal(sample(scope).status.code, 'joined');
    release();
    assert.deepEqual(sample(scope).flight, neutralControllerFlight());
  };
  return {
    pad,
    router,
    sample,
    release,
    press,
    join,
    setPads: (value) => (pads = value),
    breakRead: (value) => (broken = value),
    get reads() {
      return reads;
    },
  };
}

test('controller Boost has two immutable modes and an explicit Hold default', () => {
  assert.deepEqual(CONTROLLER_BOOST_MODES, ['hold', 'toggle']);
  assert.equal(DEFAULT_CONTROLLER_BOOST_MODE, 'hold');
  for (const mode of CONTROLLER_BOOST_MODES) assert.equal(resolveControllerBoostMode(mode), mode);
  assert.throws(() => CONTROLLER_BOOST_MODES.push('auto'), TypeError);
});

test('mode validation rejects malformed values without evaluating coercion or getters', () => {
  let accessed = 0;
  const hostile = Object.defineProperty({}, Symbol.toPrimitive, {
    get() {
      accessed++;
      throw new Error('Must not run');
    },
  });
  for (const value of [undefined, null, false, 0, '', 'Hold', 'toggle ', [], {}, hostile]) {
    assert.throws(() => resolveControllerBoostMode(value), /must be hold or toggle/);
    if (value !== undefined)
      assert.throws(
        () => createControllerRouter({ boostMode: value, eventTarget: null }),
        /must be hold or toggle/,
      );
  }
  assert.equal(accessed, 0);
});

test('default and explicit Hold preserve held commands when Toggle eligibility or cancellation changes', (t) => {
  const implicit = fixture(t, { boostMode: undefined }),
    explicit = fixture(t, { boostMode: 'hold' });
  implicit.join();
  explicit.join();
  for (const [boost, direction, eligible] of [
    [true, 0.8, true],
    [true, 0.3, false],
    [false, 0, false],
    [true, -0.8, true],
  ]) {
    for (const f of [implicit, explicit]) {
      f.press(5, boost);
      f.pad.axes[0] = direction;
      f.router.cancelToggleBoost();
    }
    const a = implicit.sample('flight', { toggleBoostEligible: eligible }),
      b = explicit.sample('flight', { toggleBoostEligible: eligible });
    assert.deepEqual(a, b);
    assert.equal(a.flight.boost, boost);
    assert.equal(implicit.router.boostState().latched, false);
  }
});

test('Toggle changes once per fresh press, survives physical release, and turns off on a second press', (t) => {
  const f = fixture(t);
  f.join();
  f.press(5);
  for (let i = 0; i < 20; i++) assert.equal(f.sample().flight.boost, true);
  f.release();
  assert.equal(f.sample().flight.boost, true);
  f.press(5);
  for (let i = 0; i < 20; i++) assert.equal(f.sample().flight.boost, false);
  f.release();
  assert.equal(f.sample().flight.boost, false);
});

test('Boost uses the configured physical button and existing analog pressed threshold', (t) => {
  const bindings = resolveControllerBindings();
  bindings.flight.buttons.boost = 6;
  const f = fixture(t, { bindings });
  f.join();
  f.press(5);
  assert.equal(f.sample().flight.boost, false, 'The old default is no longer Boost.');
  f.release();
  f.sample();
  f.pad.buttons[6].value = 0.49;
  assert.equal(f.sample().flight.boost, false);
  f.pad.buttons[6].value = 0.5;
  assert.equal(f.sample().flight.boost, true);
  f.pad.buttons[6].value = 1;
  assert.equal(f.sample().flight.boost, true);
  f.pad.buttons[6].value = 0;
  assert.equal(f.sample().flight.boost, true);
  f.pad.buttons[6].value = 0.5;
  assert.equal(f.sample().flight.boost, false);
});

test('the fixed join press remains consumed when its button is also mapped to Boost', (t) => {
  const bindings = resolveControllerBindings();
  bindings.flight.buttons.ability = 5;
  bindings.flight.buttons.boost = 0;
  const f = fixture(t, { bindings });
  f.join();
  assert.deepEqual(f.router.boostState(), { mode: 'toggle', latched: false });
  f.press(0);
  assert.deepEqual(f.sample().flight, { ...neutralControllerFlight(), boost: true });
});

for (const [name, index] of [
  ['pause', 9],
  ['hangar', 3],
  ['stop', 1],
])
  test(`${name} wins over a fresh Boost press and clears an active toggle`, (t) => {
    for (const latched of [false, true]) {
      const f = fixture(t);
      f.join();
      if (latched) {
        f.press(5);
        f.sample();
        f.release();
        f.sample();
      }
      f.press(5);
      f.press(index);
      assert.deepEqual(f.sample().flight, { ...neutralControllerFlight(), [name]: true });
      assert.equal(f.router.boostState().latched, false);
      assert.deepEqual(f.sample().flight, neutralControllerFlight());
      f.release();
      f.sample();
      f.press(5);
      assert.equal(f.sample().flight.boost, true, 'One eligible neutral sample rearms Boost.');
    }
  });

test('Boost-only cancellation preserves assignment, held direction hysteresis and action behavior', (t) => {
  const bindings = resolveControllerBindings();
  bindings.deadZone.release = 0.25;
  const f = fixture(t, { bindings });
  f.join();
  f.press(5);
  f.press(0);
  f.pad.axes[0] = 0.8;
  const assigned = f.sample().assigned;
  f.router.cancelToggleBoost();
  f.router.cancelToggleBoost();
  f.pad.axes[0] = 0.3;
  const frame = f.sample();
  assert.deepEqual(frame.assigned, assigned);
  assert.deepEqual(frame.flight, {
    ...neutralControllerFlight(),
    direction: 'right',
    action: true,
  });
  f.release();
  f.sample();
  f.press(5);
  assert.equal(f.sample().flight.boost, true);
});

test('recovery rejects toggle presses until an eligible neutral sample without suppressing other actions', (t) => {
  const f = fixture(t);
  f.join();
  f.press(5);
  assert.equal(f.sample().flight.boost, true);
  f.release();
  assert.equal(f.sample('flight', { toggleBoostEligible: false }).flight.boost, false);
  f.press(5);
  f.press(13);
  f.press(2);
  for (const eligible of [false, false, true, true])
    assert.deepEqual(f.sample('flight', { toggleBoostEligible: eligible }).flight, {
      ...neutralControllerFlight(),
      direction: 'down',
      pickup: true,
    });
  f.press(5, false);
  f.sample();
  f.press(5);
  assert.equal(f.sample().flight.boost, false, 'Held movement was not a physical-neutral sample.');
  f.release();
  f.sample();
  f.press(5);
  assert.equal(f.sample().flight.boost, true);
});

test('recovery neutrality uses both stick contexts, release equality and fixed join buttons', (t) => {
  const bindings = resolveControllerBindings();
  bindings.flight.stick.xAxis = 2;
  bindings.flight.stick.yAxis = 3;
  bindings.deadZone.release = 0.25;
  bindings.flight.buttons.pause = 10;
  bindings.menu.buttons.menu = 11;
  for (const hold of [
    (pad) => {
      pad.axes[0] = 0.3;
    },
    (pad) => {
      pad.axes[2] = 0.3;
    },
    (pad) => {
      pad.buttons[9].pressed = true;
    },
    (pad) => {
      pad.buttons[11].pressed = true;
    },
  ]) {
    const f = fixture(t, { bindings });
    f.join();
    f.router.cancelToggleBoost();
    hold(f.pad);
    f.sample();
    f.press(5);
    assert.equal(f.sample().flight.boost, false);
    f.release();
    f.pad.axes[0] = f.pad.axes[2] = 0.25;
    f.sample();
    f.press(5);
    assert.equal(f.sample().flight.boost, true);
  }
});

for (const operation of ['clear', 'bindings', 'mode', 'scope'])
  test(`${operation} adoption clears Toggle and gates a button held across the boundary`, (t) => {
    const f = fixture(t);
    f.join();
    f.press(5);
    f.sample();
    if (operation === 'clear') f.router.clear();
    else if (operation === 'bindings') f.router.setBindings(resolveControllerBindings());
    else if (operation === 'mode') f.router.setBoostMode('toggle');
    else f.sample('ready');
    assert.equal(f.router.boostState().latched, false);
    assert.equal(f.sample().flight.boost, false);
    f.release();
    f.sample();
    f.press(5);
    assert.equal(f.sample().flight.boost, true);
  });

test('invalid mode, bindings and eligibility leave active state and hardware reads unchanged', (t) => {
  const f = fixture(t);
  f.join();
  f.press(5);
  const frame = f.sample(),
    reads = f.reads;
  for (const value of [null, undefined, false, 'other'])
    assert.throws(() => f.router.setBoostMode(value), /must be hold or toggle/);
  assert.throws(() => f.router.setBindings({}), /./);
  assert.throws(
    () => f.router.sample({ scope: 'ready', timeMs: 9999, toggleBoostEligible: null }),
    /eligibility/,
  );
  assert.equal(f.reads, reads);
  assert.deepEqual(f.router.boostState(), { mode: 'toggle', latched: true });
  assert.deepEqual(
    f.sample(),
    frame,
    'Invalid adoption did not clear the latch or button edge history.',
  );
});

test('Hold-to-Toggle adoption requires release rather than interpreting the existing hold as a fresh press', (t) => {
  const f = fixture(t, { boostMode: 'hold' });
  f.join();
  f.press(5);
  assert.equal(f.sample().flight.boost, true);
  f.router.setBoostMode('toggle');
  assert.equal(f.sample().flight.boost, false);
  f.release();
  f.sample();
  f.press(5);
  assert.equal(f.sample().flight.boost, true);
  f.router.setBoostMode('hold');
  assert.equal(f.router.boostState().latched, false);
  assert.equal(f.sample().flight.boost, false);
  f.release();
  f.sample();
  f.press(5);
  assert.equal(f.sample().flight.boost, true);
  f.release();
  assert.equal(f.sample().flight.boost, false);
});

test('repeated inactive cancellation preserves menu joining, confirming and directional repeats', (t) => {
  const f = fixture(t);
  for (let i = 0; i < 3; i++) {
    f.sample('ready');
    f.router.cancelToggleBoost();
  }
  f.press(0);
  assert.equal(f.sample('ready').status.code, 'joined');
  f.router.cancelToggleBoost();
  f.release();
  f.sample('ready');
  f.router.cancelToggleBoost();
  f.press(13);
  assert.equal(f.sample('ready', { timeMs: 10 }).ui.direction, 'down');
  f.router.cancelToggleBoost();
  assert.equal(f.sample('ready', { timeMs: 100 }).ui.direction, null);
  f.router.cancelToggleBoost();
  assert.equal(f.sample('ready', { timeMs: 360 }).ui.direction, 'down');
  f.release();
  f.sample('ready');
  f.router.cancelToggleBoost();
  f.press(0);
  assert.equal(f.sample('ready').ui.confirm, true);
  f.router.cancelToggleBoost();
  assert.deepEqual(f.sample('ready').ui, neutralControllerUI());
});

for (const loss of ['disconnect', 'replacement', 'read-failure'])
  test(`${loss} clears the active toggle and cannot transfer it to a rejoined pad`, (t) => {
    const f = fixture(t);
    f.join();
    f.press(5);
    f.sample();
    if (loss === 'disconnect') f.setPads([]);
    else if (loss === 'replacement') f.pad.id = 'Replacement';
    else f.breakRead(true);
    assert.equal(f.sample().disconnected, true);
    assert.deepEqual(f.router.boostState(), { mode: 'toggle', latched: false });
    f.setPads([f.pad]);
    f.breakRead(false);
    assert.equal(f.sample().assigned, null, 'A held old button cannot rejoin.');
    f.join();
    assert.equal(f.sample().flight.boost, false);
  });

test('state snapshots cannot mutate the latch and destroy makes cancellation harmless without reads', (t) => {
  const f = fixture(t);
  f.join();
  f.press(5);
  const frame = f.sample(),
    snapshot = f.router.boostState(),
    reads = f.reads;
  snapshot.mode = 'hold';
  snapshot.latched = false;
  frame.flight.boost = false;
  assert.equal(f.reads, reads);
  assert.deepEqual(f.router.boostState(), { mode: 'toggle', latched: true });
  assert.deepEqual(Object.keys(frame).sort(), [
    'assigned',
    'disconnected',
    'flight',
    'status',
    'ui',
  ]);
  f.router.destroy();
  f.router.cancelToggleBoost();
  assert.deepEqual(f.router.boostState(), { mode: 'toggle', latched: false });
  assert.equal(f.router.sample({ scope: 'flight' }).status.code, 'disposed');
  assert.equal(f.reads, reads);
  assert.throws(() => f.router.setBoostMode('hold'), /stopped/);
});
