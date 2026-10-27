import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { createRadioRuntime } from '../../optional-practice/civilian-fpv/radio-runtime.mjs';
import { createRadioBootstrap } from '../../optional-practice/civilian-fpv/radio-controls.mjs';
import { mountRadioSetup } from '../../optional-practice/civilian-fpv/radio-setup.mjs';
import {
  COMBAT_RADIO_FORMAT,
  RADIO_CONTROL_SWITCHES,
  createFlightProfileStore,
  defaultRadioProfile,
  loadRadioControlLayout,
  loadRadioModelSelection,
  validateRadioProfile,
} from '../../optional-practice/civilian-fpv/radio-profile.mjs';

const binding = (button) => ({ button, threshold: 0.5, invert: false });
function fixture(
  t,
  { known = true, assigned = false, partial = false, denyStorage = false, receiver = false } = {},
) {
  const document = new Document(),
    create = document.createElement.bind(document);
  document.createElement = (...args) => {
    const node = create(...args);
    Object.defineProperty(node, 'firstChild', {
      get: () =>
        node._text
          ? {
              get textContent() {
                return node._text;
              },
              set textContent(value) {
                node._text = value;
              },
            }
          : (node.children[0] ?? null),
    });
    return node;
  };
  let profile = defaultRadioProfile();
  if (assigned)
    profile = validateRadioProfile({
      ...profile,
      format: COMBAT_RADIO_FORMAT,
      switches: {
        arm: binding(0),
        pause: null,
        reset: binding(10),
        camera: null,
        fire: binding(1),
        weapon: binding(2),
        reload: binding(3),
        payload: binding(4),
        detonate: binding(5),
      },
    });
  if (partial)
    profile = validateRadioProfile({
      ...profile,
      switches: { ...profile.switches, weapon: null, reload: null, payload: null, detonate: null },
    });
  const pad = {
    index: 0,
    id: known ? profile.device.id : 'Unconfigured USB Radio',
    mapping: '',
    connected: true,
    axes: known ? [0.004, 0.004, -1, 0.004, -1, 0, 0, 0] : [0, 0, -1, 0],
    buttons: Array.from({ length: known ? 24 : 8 }, () => ({ value: 0 })),
  };
  if (receiver) {
    pad.id = 'Pico CRSF USB Receiver';
    pad.axes = [0, 0, -1, 0, -1, -1, -1, -1];
    pad.buttons = Array.from({ length: 24 }, () => ({ value: 0 }));
  }
  const data = new Map(),
    frames = new Map(),
    calls = [];
  let time = 0,
    frameId = 0;
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      if (denyStorage) throw new Error('Storage denied');
      data.set(key, value);
    },
    removeItem: (key) => data.delete(key),
  };
  if (known && !denyStorage) {
    const store = createFlightProfileStore({ storage });
    store.save({ ...store.snapshot(), radio: profile });
  }
  const runtime = createRadioRuntime({
    getGamepads: () => [pad],
    now: () => time,
    onCombatAction: (action) => calls.push(action),
    onReset: () => calls.push('reset'),
  });
  if (known) {
    runtime.select(0);
    runtime.setProfile(profile);
    runtime.verify();
  }
  runtime.setContext({ owner: 'menu', key: 'setup', resumeAllowed: false });
  const win = Object.assign(new Events(), {
    Event,
    localStorage: storage,
    performance: { now: () => time },
    requestAnimationFrame: (callback) => {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  });
  const container = document.createElement('section');
  document.body.append(container);
  const setup = mountRadioSetup({ container, window: win, runtime });
  container.querySelector('select[aria-label="Throttle stick"]').value = 'full-travel';
  const tick = (count = 1) => {
    for (let i = 0; i < count; i++) {
      time += 100;
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(time);
    }
  };
  const click = (selector) => {
    const node = container.querySelector(selector);
    assert.ok(node, selector);
    assert.equal(node.disabled, false, selector);
    node.click();
    tick();
  };
  const roundTrip = (button) => {
    tick(4);
    pad.buttons[button].value = 1;
    tick(4);
    pad.buttons[button].value = 0;
    tick(4);
  };
  t.after(() => setup.dispose());
  return {
    pad,
    profile,
    runtime,
    setup,
    container,
    win,
    storage,
    data,
    calls,
    tick,
    click,
    roundTrip,
  };
}

test('explicit adoption and undo preserve calibrated axes and legacy switch bindings', (t) => {
  const f = fixture(t, { assigned: true }),
    before = f.runtime.status().profile;
  assert.equal(f.runtime.controlLayout(), null);
  assert.equal(f.container.querySelectorAll('[data-six-role]').length, 6);
  f.click('[data-six-adopt]');
  assert.equal(f.runtime.controlLayout().layout, 'six-switch');
  assert.deepEqual(Object.keys(f.runtime.controlLayout().switches), RADIO_CONTROL_SWITCHES);
  assert.equal(f.runtime.status().profile, before);
  assert.deepEqual(
    loadRadioControlLayout({ storage: f.storage, device: f.profile.device }),
    f.runtime.controlLayout(),
  );
  f.click('[data-six-undo]');
  assert.equal(f.runtime.controlLayout(), null);
  assert.equal(loadRadioControlLayout({ storage: f.storage, device: f.profile.device }), null);
  assert.equal(f.runtime.status().profile, before);
});

test('guided six-role capture does not dirty calibration or adopt its draft', (t) => {
  const f = fixture(t),
    before = f.runtime.status().profile;
  f.click('[data-six-capture-all]');
  for (const [index, action] of RADIO_CONTROL_SWITCHES.entries()) {
    assert.equal(
      f.container.querySelector(`[data-six-role="${action}"]`).dataset.captureState,
      'listening',
    );
    f.roundTrip(index + 3);
  }
  assert.equal(f.setup.captureActive(), false);
  assert.equal(f.runtime.status().profileDirty, false);
  assert.equal(f.runtime.status().profile, before);
  assert.equal(f.runtime.controlLayout(), null);
  f.click('[data-six-adopt]');
  for (const [index, action] of RADIO_CONTROL_SWITCHES.entries())
    assert.equal(f.runtime.controlLayout().switches[action].button, index + 3);
  assert.equal(f.runtime.status().profile, before);
});

test('capture rejects alias reuse, times out and exposes independent Back cancellation', (t) => {
  const f = fixture(t, { assigned: true });
  f.click('[data-six-role="reload"] button');
  assert.equal(f.setup.captureRadioBack(), true);
  f.roundTrip(1);
  assert.match(f.container.querySelector('[data-six-status]').textContent, /another action/);
  assert.equal(
    f.container.querySelector('[data-six-role="reload"] output').textContent,
    'Button 3',
  );
  f.click('[data-six-role="weapon"] button');
  assert.equal(f.setup.captureRadioBack(), false);
  f.tick(202);
  assert.match(f.container.querySelector('[data-six-status]').textContent, /timed out/);
  assert.equal(f.setup.captureActive(), false);
  f.click('[data-six-role="fire"] button');
  f.setup.cancelCapture();
  assert.equal(f.setup.captureActive(), false);
  assert.equal(f.runtime.controlLayout(), null);
});

test('practice reports paused shortcuts but cannot arm or fire', (t) => {
  const f = fixture(t, { assigned: true });
  f.click('[data-six-practice]');
  for (const [button, label] of [
    [3, /View/],
    [4, /Retry.*confirmation/],
    [5, /Settings/],
  ]) {
    f.roundTrip(button);
    assert.match(f.container.querySelector('[data-six-status]').textContent, label);
  }
  f.pad.buttons[0].value = 1;
  f.tick();
  f.roundTrip(1);
  assert.equal(f.runtime.status().active, false);
  assert.deepEqual(f.calls, []);
  f.setup.cancelCapture();
});

test('storage denial leaves the explicit layout session-only and calibration untouched', (t) => {
  const f = fixture(t, { assigned: true, denyStorage: true }),
    before = f.runtime.status().profile;
  f.click('[data-six-adopt]');
  assert.equal(f.runtime.controlLayout().layout, 'six-switch');
  assert.equal(f.runtime.status().profile, before);
  assert.match(
    f.container.querySelector('[data-six-status]').textContent,
    /session; saving is unavailable/,
  );
});

test('Flight and Fire can adopt a reduced layout while absent actions remain in the menu', (t) => {
  const f = fixture(t, { assigned: true, partial: true });
  f.click('[data-six-adopt]');
  assert.equal(f.runtime.controlLayout().switches.arm.button, 0);
  assert.equal(f.runtime.controlLayout().switches.fire.button, 1);
  for (const action of ['weapon', 'reload', 'payload', 'detonate']) {
    assert.equal(f.runtime.controlLayout().switches[action], null);
    assert.match(
      f.container.querySelector(`[data-six-role="${action}"] output`).textContent,
      /through the menu/,
    );
  }
});

function rawFixture() {
  const pad = {
    index: 0,
    id: 'Unknown radio',
    mapping: '',
    axes: [0, 0, -1, 0],
    buttons: [0, 0, 0, 0],
    connected: true,
  };
  const bootstrap = createRadioBootstrap();
  let now = 0,
    value;
  const tick = (count = 1, pads = [pad]) => {
    for (let i = 0; i < count; i++) {
      now += 100;
      value = bootstrap.sample(pads, now);
    }
    return value;
  };
  const gesture = (kind, index) => {
    tick(4);
    pad[kind][index] = 1;
    tick(4);
    pad[kind][index] = 0;
    return tick(4);
  };
  return { pad, bootstrap, tick, gesture };
}

test('bootstrap requires repeated device nomination and two Select/Back round trips', () => {
  const f = rawFixture();
  f.tick(4);
  assert.equal(f.bootstrap.snapshot().device, null);
  f.gesture('axes', 0);
  assert.equal(f.bootstrap.snapshot().phase, 'nominate');
  assert.equal(f.bootstrap.snapshot().cycles, 1);
  f.gesture('axes', 0);
  assert.equal(f.bootstrap.snapshot().phase, 'confirm');
  f.gesture('buttons', 1);
  f.gesture('buttons', 1);
  assert.equal(f.bootstrap.snapshot().phase, 'back');
  f.gesture('buttons', 2);
  f.gesture('buttons', 2);
  const done = f.bootstrap.snapshot();
  assert.equal(done.phase, 'done');
  assert.equal(done.switches.fire.button, 1);
  assert.equal(done.switches.weapon.button, 2);
  assert.equal(done.index, 0);
});

test('bootstrap rejects simultaneous devices, duplicate Back and timed-out capture', () => {
  const f = rawFixture(),
    second = { ...structuredClone(f.pad), id: 'Other radio', index: 1 };
  f.tick(4, [f.pad, second]);
  f.pad.axes[0] = second.axes[0] = 1;
  f.tick(1, [f.pad, second]);
  assert.equal(f.bootstrap.snapshot().error, 'multiple-devices');
  assert.equal(f.bootstrap.snapshot().device, null);
  f.pad.axes[0] = 0;
  f.bootstrap.reset();
  f.gesture('axes', 0);
  f.gesture('axes', 0);
  f.gesture('buttons', 1);
  f.gesture('buttons', 1);
  f.gesture('buttons', 1);
  assert.equal(f.bootstrap.snapshot().error, 'switch-conflict');
  assert.equal(f.bootstrap.snapshot().phase, 'nominate');
  f.bootstrap.reset();
  f.gesture('axes', 0);
  f.gesture('axes', 0);
  f.tick(202);
  assert.equal(f.bootstrap.snapshot().error, 'timed-out');
  assert.equal(f.bootstrap.snapshot().device, null);
});

test('unknown setup starts the axis guide only after provisional Select and Back verification', (t) => {
  const f = fixture(t, { known: false });
  const axisGesture = () => {
    f.tick(4);
    f.pad.axes[0] = 1;
    f.tick(4);
    f.pad.axes[0] = 0;
    f.tick(4);
  };
  axisGesture();
  axisGesture();
  f.roundTrip(1);
  f.roundTrip(1);
  f.roundTrip(2);
  f.roundTrip(2);
  assert.ok(
    ['prepare', 'positive'].includes(
      f.container.querySelector('.radio-guide').dataset.radioGuidePhase,
    ),
  );
  const preview = f.setup.menuPreview();
  assert.equal(preview.provisional, true);
  assert.equal(preview.verified, false);
  assert.equal(preview.controls, null);
  assert.equal(f.runtime.status().active, false);
  assert.equal(f.runtime.controlLayout(), null);
  f.setup.cancelCapture();
  assert.equal(f.runtime.status().active, false);
});

test('bootstrap axes finish at verification without legacy Arm or Reset capture', (t) => {
  const f = fixture(t, { known: false });
  const axisGesture = () => {
    f.tick(4);
    f.pad.axes[0] = 1;
    f.tick(4);
    f.pad.axes[0] = 0;
    f.tick(4);
  };
  axisGesture();
  axisGesture();
  f.roundTrip(1);
  f.roundTrip(1);
  f.roundTrip(2);
  f.roundTrip(2);
  f.tick(10);
  for (const [axis, rest] of [
    [2, -1],
    [3, 0],
    [1, 0],
    [0, 0],
  ]) {
    assert.equal(f.container.querySelector('.radio-guide').dataset.radioGuidePhase, 'positive');
    f.pad.axes[axis] = 1;
    f.tick(10);
    f.pad.axes[axis] = rest;
    f.tick(10);
    f.pad.axes[axis] = -1;
    f.tick(10);
    f.pad.axes[axis] = rest;
    f.tick(10);
  }
  f.tick(10);
  assert.equal(f.container.querySelector('.radio-guide').dataset.radioGuidePhase, 'check');
  assert.equal(f.runtime.controlLayout(), null);
  // The guide first proves a stable low-throttle rest before accepting yaw confirmation.
  for (
    let i = 0;
    i < 20 && f.container.querySelector('.radio-guide').dataset.radioGuideConfirmation !== 'ready';
    i++
  )
    f.tick();
  assert.equal(f.container.querySelector('.radio-guide').dataset.radioGuideConfirmation, 'ready');
  f.pad.axes[3] = 1;
  f.tick(12);
  f.pad.axes[3] = 0;
  f.tick(8);
  assert.equal(f.runtime.status().verified, true);
  assert.equal(
    f.container.querySelector('[data-six-role="arm"]').dataset.captureState,
    'listening',
  );
  assert.equal(f.container.querySelector('[data-six-role="fire"] output').textContent, 'Button 1');
  assert.equal(
    f.container.querySelector('[data-six-role="weapon"] output').textContent,
    'Button 2',
  );
});

test('model proposal preserves verified calibration and requires explicit switch check and adoption', (t) => {
  const f = fixture(t, { assigned: true }),
    before = f.runtime.status().profile;
  const model = f.container.querySelector('[data-radio-model]');
  model.value = 'radiomaster-tx15';
  model.emit('change');
  f.tick();
  assert.equal(f.container.querySelector('[data-radio-transport]').value, 'edgetx-classic');
  f.click('[data-radio-model-apply]');
  assert.equal(f.runtime.status().profile, before);
  assert.equal(f.runtime.status().verified, true);
  assert.equal(f.runtime.controlLayout(), null);
  assert.equal(f.container.querySelector('[data-six-adopt]').disabled, true);
  const check = f.container.querySelector('[data-six-proposal-check]');
  check.checked = true;
  check.emit('change');
  f.click('[data-six-adopt]');
  assert.equal(f.runtime.controlLayout().switches.arm.axis, 4);
  assert.equal(f.runtime.status().profile, before);
  assert.equal(
    loadRadioModelSelection({ storage: f.storage, device: f.profile.device }).modelId,
    'radiomaster-tx15',
  );
  const transport = f.container.querySelector('[data-radio-transport]');
  transport.value = '';
  transport.emit('change');
  f.tick();
  assert.equal(f.container.querySelector('[data-radio-model-apply]').disabled, true);
  assert.equal(
    loadRadioModelSelection({ storage: f.storage, device: f.profile.device }).channelPreset,
    null,
  );
  assert.equal(f.runtime.status().profile, before);
  assert.equal(f.runtime.controlLayout().switches.arm.axis, 4);
  assert.equal(f.container.querySelector('.radio-extra-switches').open, false);
  const workspace = f.container.querySelector('.radio-workspace');
  assert.equal(
    workspace.parentNode.children[workspace.parentNode.children.indexOf(workspace) + 1],
    f.container.querySelector('[data-radio-six-switch]'),
  );
  assert.ok(
    f.container
      .querySelector('.radio-device-card')
      .contains(f.container.querySelector('[data-radio-model-panel]')),
  );
});

test('unknown receiver needs an explicit firmware preset and keeps suggestions unverified', (t) => {
  const f = fixture(t, { known: false, receiver: true });
  const radio = f.container.querySelector('select[aria-label="Your radio"]');
  radio.value = '0';
  radio.emit('change');
  f.tick();
  const transport = f.container.querySelector('[data-radio-transport]');
  assert.equal(transport.value, '');
  assert.equal(f.container.querySelector('[data-radio-model-apply]').disabled, true);
  transport.value = 'squid-stick';
  transport.emit('change');
  f.tick();
  f.click('[data-radio-model-apply]');
  assert.equal(f.runtime.controlLayout(), null);
  assert.equal(f.runtime.status().verified, false);
  assert.equal(f.container.querySelector('[data-six-role="arm"] output').textContent, 'Button 2');
  assert.equal(
    f.container.querySelector('[data-six-role="weapon"] output').textContent,
    'Axis 5: -1 → 1',
  );
  assert.equal(f.container.querySelector('[data-six-adopt]').disabled, true);
  assert.match(
    f.container.querySelector('[data-six-status]').textContent,
    /Suggested channels are ready to check/,
  );
});
