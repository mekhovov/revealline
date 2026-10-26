import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import {
  createFlightGamepad,
  createFlightMenuNavigation,
} from '../../optional-practice/civilian-fpv/input.mjs';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} vs ${b}`);
function fixture() {
  const window = new Events(),
    document = new Document();
  const adapter = createFlightGamepad({ window, document });
  const pad = {
    id: 'Workbench test controller',
    index: 0,
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ value: 0 })),
    timestamp: 100,
  };
  return {
    adapter,
    pad,
    poll: (scope = 'blocked', now = pad.timestamp + 5) =>
      adapter.poll({ gamepads: [pad], now, scope }),
  };
}

test('blocked workbench preview maps observed sticks without acquiring readiness or integrating throttle', () => {
  const { adapter, pad, poll } = fixture();
  try {
    assert.equal(adapter.previewDiagnostics(), null);
    pad.axes = [0.56, -0.78, -0.34, 1];
    const state = poll();
    const before = adapter.status();
    const preview = adapter.previewDiagnostics();
    assert.equal(state.ready, false);
    assert.equal(state.active, false);
    assert.equal(preview.mapping, 'standard-mode-2');
    near(preview.calibrated.yaw, 0.5);
    near(preview.calibrated.roll, -0.25);
    near(preview.calibrated.pitch, -1);
    assert.equal(preview.calibrated.throttle, null);
    near(preview.throttleRate, 0.75);
    assert.equal(preview.throttleRateLabel, 'Throttle change input');
    assert.equal(preview.throttleRateUnits, 'normalized');
    assert.equal(preview.sampleAgeMs, 5);
    assert.equal(preview.cadenceHz, null);
    assert.equal(preview.sampledAtMs, 105);
    assert.deepEqual(preview.raw.axes, pad.axes);
    for (let i = 0; i < 50; i++) adapter.previewDiagnostics();
    assert.deepEqual(adapter.status(), before);
    assert.deepEqual(adapter.sample(0.02), { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
    assert.equal(poll('ready', 110).canArm, false, 'deflected preview never grants neutral pickup');
  } finally {
    adapter.dispose();
  }
});

test('preview applies the flight deadzone and button fallbacks once, with the same stick priority', () => {
  const blocked = fixture(),
    flying = fixture();
  try {
    flying.poll('flight');
    for (const values of [
      [0, 0, 0, 0],
      [0.12, -0.12, -0.12, 0.12],
      [0.56, -0.56, -0.56, 0.56],
      [1, 1, 1, -1],
    ]) {
      for (const f of [blocked, flying]) {
        f.pad.timestamp += 10;
        f.pad.axes = values;
        for (const index of [5, 7, 12, 15]) f.pad.buttons[index].value = 1;
      }
      blocked.poll('blocked');
      flying.poll('flight');
      const preview = blocked.adapter.previewDiagnostics(),
        applied = flying.adapter.sample(0);
      for (const axis of ['roll', 'pitch', 'yaw']) near(preview.calibrated[axis], applied[axis]);
      near(preview.throttleRate, flying.adapter.status().throttleRate);
      assert.equal(preview.calibrated.throttle, null);
    }
    blocked.pad.axes = [0, 0, 0, 0];
    blocked.pad.buttons.forEach((button) => {
      button.value = 0;
    });
    for (const index of [4, 6, 13, 14]) blocked.pad.buttons[index].value = 0.75;
    blocked.pad.timestamp += 10;
    blocked.poll();
    const negative = blocked.adapter.previewDiagnostics();
    assert.deepEqual(negative.calibrated, { roll: -0.5, pitch: -0.5, yaw: -0.5, throttle: null });
    near(negative.throttleRate, -(0.75 - 0.12) / 0.88);
  } finally {
    blocked.adapter.dispose();
    flying.adapter.dispose();
  }
});

test('preview cannot consume action edges, change flight throttle or change subsequent controls', () => {
  const reference = fixture(),
    observed = fixture();
  try {
    for (const f of [reference, observed]) f.poll('ready');
    for (const f of [reference, observed]) {
      f.pad.buttons[0].value = 1;
      f.pad.timestamp += 10;
    }
    assert.deepEqual(reference.poll('ready'), observed.poll('ready'));
    const before = observed.adapter.status();
    for (let i = 0; i < 20; i++) observed.adapter.previewDiagnostics();
    assert.deepEqual(observed.adapter.status(), before);
    for (const f of [reference, observed]) {
      f.pad.buttons[0].value = 0;
      f.pad.timestamp += 10;
    }
    const expected = reference.poll('ready'),
      actual = observed.poll('ready');
    assert.deepEqual(actual, expected);
    assert.deepEqual(actual.actions, ['arm']);
    for (let frame = 0; frame < 10; frame++) {
      for (const f of [reference, observed]) {
        f.pad.timestamp += 10;
        f.pad.axes = [0.2, -0.78, 0.56, 0.35];
        f.pad.buttons[2].value = 1;
      }
      assert.deepEqual(reference.poll('flight'), observed.poll('flight'));
      const beforeRead = observed.adapter.status();
      for (let i = 0; i < 20; i++) observed.adapter.previewDiagnostics();
      assert.deepEqual(observed.adapter.status(), beforeRead);
      assert.deepEqual(observed.adapter.sample(0.02), reference.adapter.sample(0.02));
    }
    assert.ok(observed.adapter.status().controls.throttle > 0);
  } finally {
    reference.adapter.dispose();
    observed.adapter.dispose();
  }
});

test('preview copies diagnostics, preserves honest timestamp cadence, and disappears for missing/unsupported devices', () => {
  const { adapter, pad, poll } = fixture();
  try {
    poll();
    pad.timestamp = 110;
    poll();
    const preview = adapter.previewDiagnostics();
    assert.equal(preview.cadenceHz, 100);
    preview.raw.axes[0] = 999;
    preview.raw.buttons[7] = 999;
    preview.calibrated.yaw = 999;
    assert.equal(adapter.diagnostics().raw.axes[0], 0);
    assert.equal(adapter.previewDiagnostics().calibrated.yaw, 0);
    pad.timestamp = 0;
    poll('blocked', 125);
    assert.equal(adapter.previewDiagnostics().cadenceHz, null);
    assert.equal(adapter.previewDiagnostics().sampleAgeMs, null);
    pad.mapping = '';
    poll('blocked', 135);
    assert.equal(adapter.previewDiagnostics(), null);
    pad.mapping = 'standard';
    pad.timestamp = 140;
    poll('blocked', 145);
    assert.ok(adapter.previewDiagnostics());
    adapter.poll({ gamepads: [], now: 150, scope: 'blocked' });
    assert.equal(adapter.previewDiagnostics(), null);
    pad.timestamp = 155;
    poll('blocked', 160);
    adapter.reset();
    assert.equal(adapter.previewDiagnostics(), null);
    pad.timestamp = 165;
    poll('blocked', 170);
    adapter.dispose();
    assert.equal(adapter.previewDiagnostics(), null);
  } finally {
    adapter.dispose();
  }
});

function captureFixture(t, { index = 0 } = {}) {
  const document = new Document(),
    root = document.createElement('section');
  const button = document.createElement('button');
  button.textContent = 'Save';
  root.append(button);
  document.body.append(root);
  button.focus();
  const pad = {
    id: 'Captured controller',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0.9, -0.8, 0.7, -0.6],
    buttons: Array.from({ length: 16 }, () => ({ value: 0 })),
  };
  let capture = true,
    releases = 0,
    backs = 0,
    clicks = 0;
  const actions = [],
    hints = [];
  button.addEventListener('click', () => clicks++);
  const navigation = createFlightMenuNavigation({
    document,
    window: document.defaultView,
    getContext: () => ({
      root,
      key: 'workbench',
      blockDevices: capture,
      blockRadio: capture,
      captureControllerIndex: index,
      // Fresh callback identities, as in host getContext, must preserve pickup.
      onCaptureBack: capture
        ? () => {
            releases++;
            capture = false;
          }
        : undefined,
    }),
    onBack: () => backs++,
    onAction: (action) => actions.push(action),
    onHint: (hint) => hints.push(hint),
  });
  t.after(() => navigation.dispose());
  return {
    pad,
    navigation,
    actions,
    hints,
    button,
    document,
    poll: (now, gamepads = [pad]) => navigation.poll({ now, gamepads }),
    get releases() {
      return releases;
    },
    get backs() {
      return backs;
    },
    get clicks() {
      return clicks;
    },
  };
}

test('captured controller requires release then fresh B press/release and never navigates or confirms', (t) => {
  const f = captureFixture(t);
  f.pad.buttons[1].value = 1;
  f.poll(0);
  f.poll(10);
  assert.equal(f.releases, 0, 'held B on capture entry cannot escape');
  f.pad.buttons[1].value = 0;
  f.poll(20);
  assert.equal(f.releases, 0, 'first release only establishes pickup');
  f.pad.buttons[1].value = 1;
  f.poll(30);
  f.poll(40);
  assert.equal(f.releases, 0, 'escape happens on release');
  f.pad.buttons[1].value = 0.2;
  f.poll(50);
  assert.equal(f.releases, 0, 'partial release is not a new command');
  f.pad.buttons[1].value = 0;
  f.poll(60);
  assert.equal(f.releases, 1);
  assert.equal(f.backs, 0);
  assert.equal(f.clicks, 0);
  assert.deepEqual(f.actions, []);
  assert.match(f.hints[0], /press and release B/);
  for (let now = 70; now < 150; now += 10) f.poll(now);
  assert.equal(f.releases, 1);
  assert.equal(f.document.activeElement, f.button);
  assert.deepEqual(f.actions, [], 'deflected preview sticks cannot navigate on return');
});

test('capture escape ignores other devices and requires an explicit captured-controller index', (t) => {
  const f = captureFixture(t),
    other = structuredClone(f.pad);
  other.index = 1;
  f.poll(0, [other]);
  other.buttons[1].value = 1;
  f.poll(10, [other]);
  other.buttons[1].value = 0;
  f.poll(20, [other]);
  assert.equal(f.releases, 0);
  f.poll(30);
  f.pad.buttons[1].value = 1;
  f.poll(40);
  f.pad.buttons[1].value = 0;
  f.poll(50);
  assert.equal(f.releases, 1);
  const unspecified = captureFixture(t, { index: null });
  unspecified.poll(0);
  unspecified.pad.buttons[1].value = 1;
  unspecified.poll(10);
  unspecified.pad.buttons[1].value = 0;
  unspecified.poll(20);
  assert.equal(unspecified.releases, 0);
});

test('capture escape rejects action chords, frame gaps, disconnects and invalid samples', (t) => {
  for (const failure of ['chord', 'stall', 'disconnect', 'invalid']) {
    const f = captureFixture(t);
    f.poll(0);
    f.pad.buttons[1].value = 1;
    f.poll(10);
    if (failure === 'chord') {
      f.pad.buttons[0].value = 1;
      f.poll(20);
      f.pad.buttons[0].value = 0;
    }
    if (failure === 'disconnect') f.poll(20, []);
    if (failure === 'invalid') {
      f.pad.axes[0] = NaN;
      f.poll(20);
      f.pad.axes[0] = 0.9;
    }
    f.pad.buttons[1].value = 0;
    const releaseTime = failure === 'stall' ? 1000 : 30;
    f.poll(releaseTime);
    assert.equal(f.releases, 0, failure);
    f.pad.buttons[1].value = 1;
    f.poll(releaseTime + 10);
    f.pad.buttons[1].value = 0;
    f.poll(releaseTime + 20);
    assert.equal(f.releases, 1, failure);
    assert.equal(f.backs, 0);
    assert.equal(f.clicks, 0);
  }
});
