import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KEY_BINDINGS_VERSION,
  KEY_BINDING_ACTIONS,
  KEY_ACTION_LABELS,
  KEY_BINDING_PRESETS,
  KEY_BINDING_PRESET_LABELS,
  validateKeyBindings,
  resolveKeyBindings,
  replaceKeyBinding,
  keyCodeForEvent,
  actionForKey,
  keyLabel,
  bindingLabels,
  createKeyBindingState,
} from '../key-bindings.mjs';
import { createRun, stepRun, releaseInputs } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const event = (code, values = {}) => ({ code, key: code, repeat: false, ...values });
const neutral = () => ({
  direction: null,
  boost: false,
  action: false,
  pickup: false,
  hangar: false,
  pause: false,
  stop: false,
});
const custom = () => ({
  version: KEY_BINDINGS_VERSION,
  bindings: {
    up: ['Numpad8'],
    down: ['Numpad2'],
    left: ['Numpad4'],
    right: ['Numpad6'],
    ability: ['KeyV'],
    pickup: ['KeyB'],
    boost: ['Digit0'],
    hangar: ['Home'],
    pause: ['Escape', 'KeyO'],
    stop: ['Delete'],
  },
});

test('default preserves every old shortcut and adds stop without alias collisions', () => {
  const config = resolveKeyBindings();
  assert.deepEqual(config, KEY_BINDING_PRESETS.default);
  for (const [action, codes] of Object.entries(config.bindings))
    for (const code of codes) assert.equal(actionForKey(config, event(code)), action);
  assert.deepEqual(config.bindings.up, ['ArrowUp', 'KeyW']);
  assert.deepEqual(config.bindings.down, ['ArrowDown', 'KeyS']);
  assert.deepEqual(config.bindings.left, ['ArrowLeft', 'KeyA']);
  assert.deepEqual(config.bindings.right, ['ArrowRight', 'KeyD']);
  assert.equal(actionForKey(config, event('KeyX')), 'stop');
  assert.equal(actionForKey(config, event('KeyE')), 'ability');
  assert.equal(actionForKey(config, event('KeyR')), 'pickup');
  assert.equal(actionForKey(config, event('KeyG')), 'hangar');
  assert.equal(actionForKey(config, event('KeyP')), 'pause');
});

test('both hand presets cover all actions, retain Escape and cannot be mutated by consumers', () => {
  for (const id of ['default', 'left-hand', 'right-hand']) {
    const preset = KEY_BINDING_PRESETS[id];
    assert.equal(validateKeyBindings(preset).valid, true);
    assert.deepEqual(Object.keys(preset.bindings), KEY_BINDING_ACTIONS);
    assert.ok(KEY_BINDING_PRESET_LABELS[id]);
    for (const action of KEY_BINDING_ACTIONS) assert.ok(KEY_ACTION_LABELS[action]);
    assert.ok(preset.bindings.pause.includes('Escape'));
    assert.throws(() => preset.bindings.up.push('KeyZ'), TypeError);
    const copy = resolveKeyBindings(preset);
    copy.bindings.up[0] = 'KeyZ';
    assert.notEqual(preset.bindings.up[0], 'KeyZ');
  }
  assert.equal(actionForKey(KEY_BINDING_PRESETS['left-hand'], event('KeyW')), 'up');
  assert.equal(actionForKey(KEY_BINDING_PRESETS['right-hand'], event('KeyI')), 'up');
});

test('custom mapping can replace all ten actions while Escape remains a fixed fallback', () => {
  const config = resolveKeyBindings(custom());
  for (const [action, codes] of Object.entries(config.bindings))
    for (const code of codes) assert.equal(actionForKey(config, event(code)), action);
  for (const old of ['KeyW', 'KeyE', 'KeyR', 'ShiftLeft', 'KeyG', 'KeyP', 'KeyX'])
    assert.equal(actionForKey(config, event(old)), null);
  const next = replaceKeyBinding(config, 'pause', 'KeyT');
  assert.deepEqual(next.bindings.pause, ['Escape', 'KeyT']);
  assert.deepEqual(config.bindings.pause, ['Escape', 'KeyO']);
  assert.deepEqual(replaceKeyBinding(next, 'pause', 'Escape').bindings.pause, ['Escape']);
  assert.throws(() => replaceKeyBinding(config, 'up', 'Escape'), /Escape/);
  assert.throws(() => replaceKeyBinding(config, 'ability', 'KeyB'), /already assigned/);
  assert.throws(() => replaceKeyBinding(config, 'unknown', 'KeyT'), /Unknown keyboard action/);
});

test('missing actions, empty arrays, duplicate aliases and unsupported data are rejected', () => {
  const badEdits = [
    (c) => {
      delete c.bindings.up;
    },
    (c) => {
      c.bindings.up = [];
    },
    (c) => {
      c.bindings.up = ['KeyW', 'KeyW'];
    },
    (c) => {
      c.bindings.pickup = ['KeyE'];
    },
    (c) => {
      c.bindings.up = ['KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO'];
    },
    (c) => {
      c.bindings.up = [17];
    },
    (c) => {
      c.bindings.up = ['Keyw'];
    },
    (c) => {
      c.bindings.pause = ['KeyP'];
    },
    (c) => {
      c.bindings.pause = { includes: 42 };
    },
    (c) => {
      c.bindings.teleport = ['KeyT'];
    },
    (c) => {
      c.version = 'future-version';
    },
    (c) => {
      c.inject = 'extra';
    },
  ];
  for (const edit of badEdits) {
    const value = resolveKeyBindings();
    edit(value);
    assert.equal(validateKeyBindings(value).valid, false);
    assert.throws(() => resolveKeyBindings(value), /Invalid keyboard bindings/);
  }
  assert.equal(validateKeyBindings(JSON.stringify(custom())).valid, false);
  assert.equal(validateKeyBindings([]).valid, false);
  assert.equal(validateKeyBindings(null).valid, true);
});

test('native navigation, activation, system keys and shortcuts stay reserved', () => {
  const reserved = [
    'Tab',
    'Enter',
    'NumpadEnter',
    'Space',
    'ControlLeft',
    'ControlRight',
    'AltLeft',
    'AltRight',
    'MetaLeft',
    'MetaRight',
    'CapsLock',
    'NumLock',
    'ScrollLock',
    'F1',
    'F5',
    'F12',
    'F24',
    'BrowserBack',
    'MediaPlayPause',
    'AudioVolumeUp',
    'PrintScreen',
  ];
  for (const code of reserved)
    assert.throws(() => replaceKeyBinding(null, 'ability', code), /reserved/);
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
    assert.equal(actionForKey(null, event('KeyW', { [modifier]: true })), null);
    assert.equal(actionForKey(null, event('Escape', { [modifier]: true })), null);
  }
  assert.equal(actionForKey(null, event('ShiftLeft', { key: 'Shift', shiftKey: true })), 'boost');
  assert.equal(actionForKey(null, event('KeyE', { key: 'E', shiftKey: true })), 'ability');
});

test('IME, prevented events and auto-repeat do not fire gameplay requests', () => {
  for (const flags of [
    { isComposing: true },
    { keyCode: 229 },
    { key: 'Dead' },
    { key: 'Process' },
    { defaultPrevented: true },
    { repeat: true },
  ])
    assert.equal(actionForKey(null, event('KeyE', flags)), null);
  assert.equal(actionForKey(null, event('ArrowUp', { repeat: true }), { allowRepeat: true }), 'up');
  assert.equal(
    actionForKey(null, event('ArrowUp', { repeat: true, ctrlKey: true }), { allowRepeat: true }),
    null,
  );
  assert.equal(actionForKey(null, null), null);
});

test('physical key codes survive changed layouts; legacy fixtures still resolve keys and locations', () => {
  assert.equal(actionForKey(null, event('KeyW', { key: 'ц' })), 'up');
  assert.equal(actionForKey(null, event('KeyW', { key: 'z' })), 'up');
  for (const [input, expected] of [
    [{ key: 'w' }, 'KeyW'],
    [{ key: 'W' }, 'KeyW'],
    [{ key: 'ArrowLeft' }, 'ArrowLeft'],
    [{ key: 'Esc' }, 'Escape'],
    [{ key: 'Shift', location: 2 }, 'ShiftRight'],
    [{ key: 'Shift', location: 1 }, 'ShiftLeft'],
    [{ key: '8', location: 3 }, 'Numpad8'],
    [{ key: '8' }, 'Digit8'],
    [{ code: 'Unidentified', key: 'a' }, 'KeyA'],
    [{ key: 'Dead' }, null],
    [{ key: 'ц' }, null],
  ])
    assert.equal(keyCodeForEvent(input), expected);
  assert.equal(actionForKey(null, { key: 'W' }), 'up');
  assert.equal(actionForKey(null, { key: 'Shift', location: 2 }), 'boost');
});

test('labels identify arrows, modifiers, numpad and every assigned action without mutating bindings', () => {
  const value = custom(),
    before = structuredClone(value);
  assert.equal(keyLabel('KeyQ'), 'Q');
  assert.equal(keyLabel('ShiftRight'), 'Right Shift');
  assert.equal(keyLabel('Numpad8'), 'Numpad 8');
  assert.equal(keyLabel('ArrowUp'), '↑');
  assert.equal(bindingLabels().up, '↑ / W');
  assert.equal(bindingLabels(value).pause, 'Esc / O');
  assert.deepEqual(value, before);
});

test('JSON boundary rejects accessors, cycles, sparse arrays and oversized values without invoking getters', () => {
  let reads = 0;
  const source = resolveKeyBindings();
  Object.defineProperty(source.bindings, 'up', {
    enumerable: true,
    get() {
      reads++;
      return ['KeyW'];
    },
  });
  assert.equal(validateKeyBindings(source).valid, false);
  assert.equal(reads, 0);
  const cyclic = resolveKeyBindings();
  cyclic.bindings.up = cyclic;
  assert.equal(validateKeyBindings(cyclic).valid, false);
  const sparse = resolveKeyBindings();
  sparse.bindings.up = Array(2);
  assert.equal(validateKeyBindings(sparse).valid, false);
  const huge = resolveKeyBindings();
  huge.bindings.up = ['X'.repeat(100_000)];
  assert.equal(validateKeyBindings(huge).valid, false);
  const inherited = Object.create({ bindings: {} });
  inherited.version = KEY_BINDINGS_VERSION;
  assert.equal(validateKeyBindings(inherited).valid, false);
});

test('hold ledger preserves most recent direction and both boost keys release independently', () => {
  const state = createKeyBindingState();
  state.keyDown(event('KeyW'));
  state.keyDown(event('KeyD'));
  assert.equal(state.poll().direction, 'right');
  assert.equal(state.keyDown(event('KeyW')).pressed, false);
  assert.equal(state.keyDown(event('KeyW', { repeat: true })).pressed, false);
  assert.equal(state.poll().direction, 'right');
  state.keyUp(event('KeyD'));
  assert.equal(state.poll().direction, 'up');
  state.keyDown(event('ShiftLeft'));
  state.keyDown(event('ShiftRight'));
  state.keyUp(event('ShiftLeft'));
  assert.equal(state.poll().boost, true);
  state.keyUp(event('ShiftRight'));
  state.keyUp(event('KeyW'));
  assert.deepEqual(state.poll(), neutral());
});

test('ability and pickup pulses fire once per fresh press, including duplicate non-repeat events', () => {
  const state = createKeyBindingState();
  for (const [code, action] of [
    ['KeyE', 'action'],
    ['KeyR', 'pickup'],
  ]) {
    assert.equal(state.keyDown(event(code)).pressed, true);
    assert.equal(state.poll()[action], true);
    assert.equal(state.poll()[action], false);
    state.keyDown(event(code, { repeat: true }));
    state.keyDown(event(code));
    assert.equal(state.poll()[action], false);
    state.keyUp(event(code));
    state.keyDown(event(code));
    assert.equal(state.poll()[action], true);
    state.keyUp(event(code));
  }
});

test('pause, hangar and stop clear movement and pending equipment; stale holds require release', () => {
  for (const [code, action] of [
    ['KeyP', 'pause'],
    ['KeyG', 'hangar'],
    ['KeyX', 'stop'],
  ]) {
    const state = createKeyBindingState();
    state.keyDown(event('KeyW'));
    state.keyDown(event('ShiftLeft'));
    state.keyDown(event('KeyE'));
    state.keyDown(event(code));
    assert.deepEqual(state.poll(), { ...neutral(), [action]: true });
    state.keyDown(event(code));
    assert.deepEqual(state.poll(), neutral());
    assert.equal(state.keyDown(event('KeyW', { repeat: true })).pressed, false);
    assert.equal(state.keyDown(event('KeyW')).pressed, false);
    state.keyUp(event('KeyW'));
    assert.equal(state.keyDown(event('KeyW')).pressed, true);
    assert.equal(state.poll().direction, 'up');
  }
});

test('unconditional release works through focus, modifier, IME and key-name changes', () => {
  const state = createKeyBindingState();
  state.keyDown(event('KeyW', { key: 'w' }));
  const release = state.keyUp(
    event('KeyW', { key: 'ц', ctrlKey: true, isComposing: true, defaultPrevented: true }),
  );
  assert.equal(release.released, true);
  assert.equal(release.action, 'up');
  assert.deepEqual(state.poll(), neutral());
  for (const context of [{ active: false }, { editing: true }, { interactive: true }])
    assert.equal(state.keyDown(event('KeyE'), context).handled, false);
  state.keyDown(event('ShiftLeft'));
  state.clear();
  assert.equal(state.keyDown(event('ShiftLeft', { repeat: true })).pressed, false);
  state.keyUp(event('ShiftLeft'));
  state.keyDown(event('ShiftLeft'));
  assert.equal(state.poll().boost, true);
});

test('changing bindings is transactional, releases old holds and never reinterprets a held physical key', () => {
  const state = createKeyBindingState();
  state.keyDown(event('KeyW'));
  const bad = resolveKeyBindings();
  bad.bindings.ability = ['KeyW'];
  assert.throws(() => state.setBindings(bad), /already assigned/);
  assert.equal(state.poll().direction, 'up');
  const next = resolveKeyBindings();
  next.bindings.up = ['KeyT'];
  next.bindings.ability = ['KeyW'];
  state.setBindings(next);
  next.bindings.up = ['KeyY'];
  assert.deepEqual(state.poll(), neutral());
  assert.equal(state.keyDown(event('KeyW')).pressed, false);
  assert.deepEqual(state.poll(), neutral());
  assert.equal(state.keyUp(event('KeyW')).action, 'up');
  state.keyDown(event('KeyW'));
  assert.equal(state.poll().action, true);
  state.keyDown(event('KeyT'));
  assert.equal(state.poll().direction, 'up');
  const exposed = state.bindings;
  exposed.bindings.up[0] = 'KeyY';
  assert.equal(state.bindings.bindings.up[0], 'KeyT');
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: remapping preserves the authoritative game result for the same action trace`, () => {
    const level = {
      version: 'xonix-level.v1',
      id: 'binding-proof',
      revision: '1',
      width: 48,
      height: 36,
      spawn: { x: 24.5, y: 0.5 },
      goal: { coverage: 0.8 },
      enemies: [{ id: 'anchor', type: 'bouncer', x: 39.5, y: 25.5, vx: 0, vy: 0 }],
    };
    const run = (config) => {
      const keyboard = createKeyBindingState(config),
        state = createRun(level, { turnPolicy });
      const code = (action) => config.bindings[action][0];
      keyboard.keyDown(event(code('down')));
      for (let tick = 0; tick < 100; tick++) {
        if (tick === 15) keyboard.keyDown(event(code('right')));
        if (tick === 30) keyboard.keyUp(event(code('right')));
        if (tick === 40) keyboard.keyDown(event(code('boost')));
        if (tick === 55) keyboard.keyDown(event(code('ability')));
        if (tick === 56) keyboard.keyUp(event(code('ability')));
        if (tick === 80) keyboard.keyUp(event(code('boost')));
        stepRun(state, keyboard.poll());
      }
      keyboard.clear();
      releaseInputs(state);
      assert.equal(state.tick, 100);
      assert.equal(state.status, 'running');
      return authoritativeCheckpoint(state);
    };
    assert.deepEqual(run(resolveKeyBindings()), run(resolveKeyBindings(custom())));
  });
}
