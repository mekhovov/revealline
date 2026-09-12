import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTROLLER_BINDINGS_VERSION,
  CONTROLLER_GLYPH_FAMILIES,
  CONTROLLER_BINDING_ACTIONS,
  CONTROLLER_ACTION_LABELS,
  CONTROLLER_DIRECTION_PRIORITY,
  DEFAULT_CONTROLLER_BINDINGS,
  validateControllerBindings,
  resolveControllerBindings,
  replaceControllerButtonBinding,
  controllerButtonLabel,
  controllerBindingLabels,
  controllerStickLabel,
  sampleControllerStick,
  controllerActionForButton,
} from '../controller-bindings.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';

function currentRouter(t, scope = 'flight') {
  const pad = {
    index: 0,
    id: 'Standard mapping fixture',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const router = createControllerRouter({ readPads: () => [pad], eventTarget: null });
  let time = 0;
  const sample = () => router.sample({ scope, timeMs: (time += 500) });
  sample();
  pad.buttons[0].pressed = true;
  assert.equal(sample().status.code, 'joined');
  pad.buttons[0].pressed = false;
  sample();
  t.after(() => router.destroy());
  return { pad, sample };
}

test('legacy omission and explicit defaults resolve to independent complete standard-pad documents', () => {
  for (const source of [null, undefined, DEFAULT_CONTROLLER_BINDINGS]) {
    assert.deepEqual(validateControllerBindings(source), { valid: true, errors: [] });
    const config = resolveControllerBindings(source);
    assert.deepEqual(config, DEFAULT_CONTROLLER_BINDINGS);
    assert.equal(config.version, CONTROLLER_BINDINGS_VERSION);
    assert.equal(config.mapping, 'standard');
    assert.equal(config.glyphFamily, 'generic');
    assert.deepEqual(config.deadZone, { press: 0.35, release: 0.35 });
    assert.notEqual(config.flight.stick, config.menu.stick);
    config.flight.buttons.ability = 4;
    config.menu.stick.invertY = true;
    config.deadZone.release = 0.2;
    assert.equal(DEFAULT_CONTROLLER_BINDINGS.flight.buttons.ability, 0);
    assert.equal(DEFAULT_CONTROLLER_BINDINGS.menu.stick.invertY, false);
    assert.equal(DEFAULT_CONTROLLER_BINDINGS.deadZone.release, 0.35);
  }
  assert.throws(() => {
    DEFAULT_CONTROLLER_BINDINGS.flight.buttons.ability = 4;
  }, TypeError);
  assert.throws(() => {
    DEFAULT_CONTROLLER_BINDINGS.deadZone.press = 0.5;
  }, TypeError);
  assert.throws(() => CONTROLLER_BINDING_ACTIONS.menu.push('ability'), TypeError);
});

test('default flight buttons match the running v0.5 router for every action', (t) => {
  const config = resolveControllerBindings();
  const expected = {
    up: 12,
    down: 13,
    left: 14,
    right: 15,
    ability: 0,
    pickup: 2,
    boost: 5,
    hangar: 3,
    stop: 1,
    pause: 9,
  };
  assert.deepEqual(config.flight.buttons, expected);
  for (const [action, index] of Object.entries(config.flight.buttons)) {
    const f = currentRouter(t);
    f.pad.buttons[index].pressed = true;
    const { flight, ui } = f.sample();
    if (['up', 'down', 'left', 'right'].includes(action)) assert.equal(flight.direction, action);
    else assert.equal(flight[action === 'ability' ? 'action' : action], true, action);
    assert.deepEqual(ui, { direction: null, confirm: false, back: false, menu: false });
    assert.equal(controllerActionForButton(config, 'flight', index), action);
  }
});

test('default menu buttons match the existing router without producing flight commands', (t) => {
  const config = resolveControllerBindings();
  assert.deepEqual(config.menu.buttons, {
    up: 12,
    down: 13,
    left: 14,
    right: 15,
    confirm: 0,
    back: 1,
    menu: 9,
  });
  for (const [action, index] of Object.entries(config.menu.buttons)) {
    const f = currentRouter(t, 'ready:fixture');
    f.pad.buttons[index].pressed = true;
    const { flight, ui } = f.sample();
    if (['up', 'down', 'left', 'right'].includes(action)) assert.equal(ui.direction, action);
    else assert.equal(ui[action], true);
    assert.deepEqual(flight, {
      direction: null,
      boost: false,
      action: false,
      pickup: false,
      pause: false,
      hangar: false,
      stop: false,
    });
    assert.equal(controllerActionForButton(config, 'menu', index), action);
  }
});

test('default stick threshold and diagonal tie-break match current router at exact boundaries', (t) => {
  const f = currentRouter(t),
    config = resolveControllerBindings();
  for (const [x, y] of [
    [0, 0],
    [0.35, 0],
    [0, -0.35],
    [0.350001, 0],
    [0, -0.350001],
    [0.8, 0.8],
    [-0.8, -0.8],
    [-1, 0.9],
    [NaN, Infinity],
    [4, -2],
  ]) {
    f.pad.axes = [x, y, 0, 0];
    const expected = f.sample().flight.direction;
    for (const active of [false, true])
      assert.equal(sampleControllerStick(config, 'flight', f.pad.axes, active).direction, expected);
  }
  assert.deepEqual(CONTROLLER_DIRECTION_PRIORITY, ['up', 'right', 'down', 'left']);
  f.pad.axes = [0, 1, 0, 0];
  for (const action of [...CONTROLLER_DIRECTION_PRIORITY].reverse()) {
    f.pad.buttons[config.flight.buttons[action]].pressed = true;
    assert.equal(
      f.sample().flight.direction,
      action,
      'The earlier digital priority beats both analog and later buttons.',
    );
  }
});

test('full custom documents remap every action while retaining independent menu semantics', () => {
  const candidate = resolveControllerBindings();
  for (const [context, actions] of Object.entries(CONTROLLER_BINDING_ACTIONS))
    for (const [index, action] of actions.entries()) candidate[context].buttons[action] = index;
  candidate.flight.stick = { enabled: true, xAxis: 2, yAxis: 3, invertX: true, invertY: false };
  candidate.menu.stick.enabled = false;
  candidate.deadZone = { press: 0.4, release: 0.25 };
  const config = resolveControllerBindings(candidate);
  for (const context of ['flight', 'menu'])
    for (const action of CONTROLLER_BINDING_ACTIONS[context]) {
      assert.equal(
        controllerActionForButton(config, context, config[context].buttons[action]),
        action,
      );
      assert.ok(CONTROLLER_ACTION_LABELS[context][action]);
    }
  assert.deepEqual(resolveControllerBindings(JSON.parse(JSON.stringify(config))), config);
  assert.equal(controllerActionForButton(config, 'menu', 9), null);
  assert.equal(controllerActionForButton(config, 'flight', 16), null);
  assert.equal(controllerActionForButton(config, 'flight', '0'), null);
});

test('single-action capture rejects collisions atomically and allows cross-context reuse', () => {
  const original = resolveControllerBindings(),
    before = JSON.stringify(original);
  const next = replaceControllerButtonBinding(original, 'flight', 'ability', 4);
  assert.equal(next.flight.buttons.ability, 4);
  assert.equal(next.menu.buttons.confirm, 0);
  assert.equal(controllerActionForButton(next, 'flight', 0), null);
  assert.equal(controllerActionForButton(next, 'menu', 0), 'confirm');
  assert.throws(
    () => replaceControllerButtonBinding(original, 'flight', 'ability', 2),
    /already assigned/,
  );
  assert.throws(
    () => replaceControllerButtonBinding(original, 'menu', 'confirm', 1),
    /already assigned/,
  );
  assert.throws(
    () => replaceControllerButtonBinding(original, 'menu', 'ability', 4),
    /Unknown controller action/,
  );
  assert.throws(
    () => replaceControllerButtonBinding(original, 'other', 'confirm', 4),
    /Unknown controller context/,
  );
  assert.throws(() => replaceControllerButtonBinding(original, 'flight', 'pause', 16), /reserved/);
  assert.equal(JSON.stringify(original), before);
});

test('a complete candidate can explicitly swap two buttons without hidden repairs', () => {
  const config = resolveControllerBindings();
  [config.flight.buttons.ability, config.flight.buttons.pickup] = [
    config.flight.buttons.pickup,
    config.flight.buttons.ability,
  ];
  assert.equal(
    controllerActionForButton(resolveControllerBindings(config), 'flight', 2),
    'ability',
  );
  assert.equal(controllerActionForButton(config, 'flight', 0), 'pickup');
  assert.equal(controllerActionForButton(config, 'menu', 0), 'confirm');
});

test('every document and nested field is required; partial configurations never fall back silently', () => {
  const original = resolveControllerBindings();
  const objects = [
    [],
    ['flight'],
    ['flight', 'buttons'],
    ['flight', 'stick'],
    ['menu'],
    ['menu', 'buttons'],
    ['menu', 'stick'],
    ['deadZone'],
  ];
  for (const path of objects) {
    const source = path.reduce((value, key) => value[key], original);
    for (const key of Object.keys(source)) {
      const config = resolveControllerBindings();
      delete path.reduce((value, part) => value[part], config)[key];
      assert.equal(validateControllerBindings(config).valid, false, `${path.join('.')}.${key}`);
      assert.throws(() => resolveControllerBindings(config), /Invalid controller bindings/);
    }
  }
  for (const value of [{}, false, 0, '', [], JSON.stringify(original)])
    assert.equal(validateControllerBindings(value).valid, false);
});

test('unknown fields, unsupported versions and unimplemented toggle preferences are rejected', () => {
  const edits = [
    (c) => {
      c.version = 'xonix-controllerbindings.v2';
    },
    (c) => {
      c.mapping = '';
    },
    (c) => {
      c.glyphFamily = 'automatic';
    },
    (c) => {
      c.deviceId = 'guessed';
    },
    (c) => {
      c.flight.toggleBoost = true;
    },
    (c) => {
      c.menu.stick.calibrated = true;
    },
    (c) => {
      c.flight.buttons.selfDestruct = 4;
    },
    (c) => {
      c.deadZone.rounding = 0.01;
    },
  ];
  for (const edit of edits) {
    const config = resolveControllerBindings();
    edit(config);
    assert.equal(validateControllerBindings(config).valid, false);
    assert.throws(() => resolveControllerBindings(config), /Invalid controller bindings/);
  }
});

test('button maps reject aliases, fractions, system inputs and ambiguous same-context directions', () => {
  for (const value of [-1, 16, 17, 0.5, '4', null, false, [4], {}, NaN, Infinity]) {
    const config = resolveControllerBindings();
    config.flight.buttons.ability = value;
    assert.equal(validateControllerBindings(config).valid, false);
  }
  for (const context of ['flight', 'menu']) {
    const config = resolveControllerBindings();
    config[context].buttons.right = config[context].buttons.up;
    assert.equal(validateControllerBindings(config).valid, false);
    assert.throws(() => resolveControllerBindings(config), /already assigned/);
  }
});

test('axis indices and inversion flags are bounded even when the stick is disabled', () => {
  for (const context of ['flight', 'menu']) {
    for (const value of [-1, 4, 0.5, '2', null, NaN, Infinity]) {
      const config = resolveControllerBindings();
      config[context].stick.enabled = false;
      config[context].stick.xAxis = value;
      assert.equal(validateControllerBindings(config).valid, false);
    }
    for (const key of ['enabled', 'invertX', 'invertY']) {
      const config = resolveControllerBindings();
      config[context].stick[key] = 1;
      assert.equal(validateControllerBindings(config).valid, false);
    }
    const config = resolveControllerBindings();
    config[context].stick.yAxis = config[context].stick.xAxis;
    assert.equal(validateControllerBindings(config).valid, false);
  }
});

test('dead zones are finite normalized magnitudes with release at or below press', () => {
  for (const key of ['press', 'release'])
    for (const value of [-1, 0, 0.019, 0.601, 1, '0.35', null, false, NaN, Infinity]) {
      const config = resolveControllerBindings();
      config.deadZone[key] = value;
      assert.equal(validateControllerBindings(config).valid, false, `${key}: ${String(value)}`);
    }
  const config = resolveControllerBindings();
  config.deadZone = { press: 0.2, release: 0.3 };
  assert.throws(() => resolveControllerBindings(config), /release must not exceed press/);
  for (const [press, release] of [
    [0.1, 0.02],
    [0.6, 0.6],
    [0.35, 0.27],
  ]) {
    config.deadZone = { press, release };
    assert.equal(validateControllerBindings(config).valid, true);
  }
});

test('configuration copying rejects getters, functions and hidden or symbol data without executing it', () => {
  let calls = 0;
  for (const path of [[], ['flight', 'stick']]) {
    const config = resolveControllerBindings();
    const target = path.reduce((value, key) => value[key], config);
    Object.defineProperty(target, 'trap', {
      enumerable: true,
      get() {
        calls++;
        throw new Error('Should not run');
      },
    });
    assert.equal(validateControllerBindings(config).valid, false);
  }
  const withToJSON = resolveControllerBindings();
  withToJSON.toJSON = () => {
    calls++;
    return null;
  };
  assert.equal(validateControllerBindings(withToJSON).valid, false);
  const hidden = resolveControllerBindings();
  Object.defineProperty(hidden, 'hidden', { value: 1 });
  assert.equal(validateControllerBindings(hidden).valid, false);
  const symbol = resolveControllerBindings();
  symbol[Symbol('trap')] = 1;
  assert.equal(validateControllerBindings(symbol).valid, false);
  assert.equal(calls, 0);
});

test('prototype, cyclic and oversized data fail atomically while null-prototype JSON objects stay valid', () => {
  const prototype = Object.assign(Object.create({ injected: true }), resolveControllerBindings());
  assert.equal(validateControllerBindings(prototype).valid, false);
  const poisoned = resolveControllerBindings();
  Object.defineProperty(poisoned, '__proto__', { enumerable: true, value: {} });
  assert.equal(validateControllerBindings(poisoned).valid, false);
  const cycle = resolveControllerBindings();
  cycle.cycle = cycle;
  assert.equal(validateControllerBindings(cycle).valid, false);
  const huge = resolveControllerBindings();
  huge.glyphFamily = 'x'.repeat(9000);
  assert.equal(validateControllerBindings(huge).valid, false);
  const plain = Object.assign(Object.create(null), resolveControllerBindings());
  assert.deepEqual(resolveControllerBindings(plain), DEFAULT_CONTROLLER_BINDINGS);
  assert.equal(Object.getPrototypeOf(resolveControllerBindings(plain)), Object.prototype);
});

test('canonical copies use fixed field order and normalize negative zero without mutating input', () => {
  const config = resolveControllerBindings();
  config.flight.buttons.ability = -0;
  config.flight.stick.xAxis = -0;
  const reversed = Object.fromEntries(Object.entries(config).reverse());
  const resolved = resolveControllerBindings(reversed);
  assert.equal(JSON.stringify(resolved), JSON.stringify(DEFAULT_CONTROLLER_BINDINGS));
  assert.equal(Object.is(resolved.flight.buttons.ability, -0), false);
  assert.equal(Object.is(config.flight.buttons.ability, -0), true);
});

test('glyph choice updates labels without changing mappings, thresholds or physical-index resolution', () => {
  const config = resolveControllerBindings();
  for (const family of CONTROLLER_GLYPH_FAMILIES) {
    config.glyphFamily = family;
    const resolved = resolveControllerBindings(config),
      labels = controllerBindingLabels(resolved);
    assert.deepEqual(resolved.flight, DEFAULT_CONTROLLER_BINDINGS.flight);
    assert.deepEqual(resolved.menu, DEFAULT_CONTROLLER_BINDINGS.menu);
    assert.deepEqual(resolved.deadZone, DEFAULT_CONTROLLER_BINDINGS.deadZone);
    for (const context of ['flight', 'menu'])
      for (const action of CONTROLLER_BINDING_ACTIONS[context]) {
        const label = labels[context][action];
        assert.equal(typeof label, 'string');
        assert.ok(label.length > 0 && label.length < 80);
        assert.equal(/[<>]/.test(label), false);
        assert.equal(
          controllerActionForButton(resolved, context, resolved[context].buttons[action]),
          action,
        );
      }
  }
  assert.equal(controllerButtonLabel(0), 'South');
  assert.equal(controllerButtonLabel(0, 'xbox'), 'A');
  assert.equal(controllerButtonLabel(0, 'playstation'), 'Cross (×)');
  assert.equal(controllerButtonLabel(0, 'Unknown device name'), 'South');
  assert.equal(controllerButtonLabel(16), 'System / home');
  for (const value of [-1, 17, NaN, 0.5, '0', null])
    assert.equal(controllerButtonLabel(value), 'Unknown button');
});

test('hysteresis has an explicit caller-owned prior-active state and no hidden latch', () => {
  const config = resolveControllerBindings();
  config.deadZone = { press: 0.35, release: 0.27 };
  let prior = false;
  const inputs = [0.34, 0.35, 0.36, 0.34, 0.28, 0.27, 0.34, 0.36, 0],
    expected = [false, false, true, true, true, false, false, true, false];
  for (let i = 0; i < inputs.length; i++) {
    const state = sampleControllerStick(config, 'flight', [inputs[i], 0], prior);
    assert.equal(state.active, expected[i]);
    assert.equal(state.direction, state.active ? 'right' : null);
    prior = state.active;
  }
  assert.equal(sampleControllerStick(config, 'flight', [0.3, 0], true).active, true);
  assert.equal(sampleControllerStick(config, 'flight', [0.3, 0], false).active, false);
  assert.equal(sampleControllerStick(config, 'menu', [0.3, 0], false).active, false);
  assert.throws(() => sampleControllerStick(config, 'flight', [0, 0], 'active'), /must be boolean/);
});

test('stick swapping, independent inversion and buttons-only mode use bounded fresh axis values', () => {
  const config = resolveControllerBindings();
  config.flight.stick = { enabled: true, xAxis: 2, yAxis: 3, invertX: true, invertY: true };
  assert.deepEqual(sampleControllerStick(config, 'flight', [0, 0, 2, -0.8]), {
    x: -1,
    y: 0.8,
    active: true,
    direction: 'left',
  });
  assert.equal(sampleControllerStick(config, 'flight', [0, 0, 0.2, -0.8]).direction, 'down');
  assert.equal(sampleControllerStick(config, 'menu', [0, -0.8, 1, 1]).direction, 'up');
  config.flight.stick.enabled = false;
  assert.deepEqual(sampleControllerStick(config, 'flight', [0, 0, 1, 1], true), {
    x: -1,
    y: -1,
    active: false,
    direction: null,
  });
  assert.equal(controllerActionForButton(config, 'flight', 12), 'up');
  assert.equal(controllerStickLabel(config, 'flight'), 'Buttons only');
  assert.equal(controllerStickLabel(config, 'menu'), 'Left stick');
  config.flight.stick.enabled = true;
  assert.equal(
    controllerStickLabel(config, 'flight'),
    'Right stick (horizontal inverted, vertical inverted)',
  );
  config.flight.stick.xAxis = 3;
  config.flight.stick.yAxis = 2;
  assert.match(controllerStickLabel(config, 'flight'), /^Axes 3\/2/);
});

test('missing and nonfinite axes yield neutral input; magnitude normalization never produces NaN', () => {
  for (const axes of [undefined, null, [], [NaN, Infinity], ['1', false], new Float64Array([0, 0])])
    assert.deepEqual(sampleControllerStick(null, 'flight', axes, true), {
      x: 0,
      y: 0,
      active: false,
      direction: null,
    });
  assert.deepEqual(sampleControllerStick(null, 'flight', [-5, 2]), {
    x: -1,
    y: 1,
    active: true,
    direction: 'down',
  });
  assert.throws(() => sampleControllerStick(null, 'other', []), /Unknown controller context/);
  assert.throws(() => controllerStickLabel(null, 'other'), /Unknown controller context/);
  assert.throws(() => controllerActionForButton(null, 'other', 0), /Unknown controller context/);
});
