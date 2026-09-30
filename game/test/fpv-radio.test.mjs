import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RADIO_FORMAT,
  DEFAULT_RESPONSE,
  STICK_LAYOUTS,
  createFlightProfileStore,
  exportRadioProfile,
  normalizeRadioInput,
  radioDeviceIdentity,
  responseCurve,
  validateFlightResponse,
  validateRadioProfile,
} from '../../optional-practice/civilian-fpv/radio-profile.mjs';
import { createRadioRuntime } from '../../optional-practice/civilian-fpv/radio-runtime.mjs';
const pad = () => ({
  id: 'USB radio',
  index: 1,
  connected: true,
  mapping: '',
  axes: [0, 0, 0, 0, -1, 0, 0, 0],
  buttons: [{ value: 0 }, { value: 0 }, { value: 0 }],
  timestamp: 0,
});
function profile(p = pad()) {
  return {
    format: RADIO_FORMAT,
    id: 'my-radio',
    name: 'My radio',
    device: radioDeviceIdentity(p),
    stickMode: 2,
    throttleStyle: 'full-travel',
    verified: true,
    channels: Object.fromEntries(
      ['roll', 'pitch', 'yaw', 'throttle'].map((name, i) => [
        name,
        {
          axis: [6, 2, 0, 4][i],
          min: -1,
          max: 1,
          center: name === 'throttle' ? null : 0,
          invert: name === 'pitch',
          deadZone: name === 'throttle' ? 0 : 0.02,
        },
      ]),
    ),
    switches: { arm: null, pause: null, reset: null },
  };
}
test('reordered unmapped radio, reversed pitch and full noncentring throttle normalize independently of stick diagram', () => {
  const p = pad(),
    config = validateRadioProfile(profile(p));
  p.axes[6] = 1;
  p.axes[2] = -1;
  p.axes[0] = -1;
  p.axes[4] = 0;
  const expected = { roll: 1, pitch: 1, yaw: -1, throttle: 0.5 };
  assert.deepEqual(normalizeRadioInput(config, p), expected);
  for (let mode = 1; mode <= 4; mode++)
    assert.deepEqual(normalizeRadioInput({ ...config, stickMode: mode }, p), expected);
  assert.deepEqual(STICK_LAYOUTS[2], ['yaw', 'throttle', 'roll', 'pitch']);
  p.axes[4] = -1;
  assert.equal(normalizeRadioInput(config, p).throttle, 0);
  p.axes[4] = 1;
  assert.equal(normalizeRadioInput(config, p).throttle, 1);
  config.channels.throttle.invert = true;
  assert.equal(normalizeRadioInput(config, p).throttle, 0);
});
test('asymmetric centres and deadzones calibrate without a hidden response curve', () => {
  const p = pad(),
    config = profile(p);
  Object.assign(config.channels.roll, { min: -0.8, center: 0.1, max: 0.9, deadZone: 0.1 });
  p.axes[6] = 0.1;
  assert.equal(normalizeRadioInput(validateRadioProfile(config), p).roll, 0);
  p.axes[6] = 0.5;
  assert.equal(normalizeRadioInput(config, p).roll, 0.444);
  p.axes[6] = -0.8;
  assert.equal(normalizeRadioInput(config, p).roll, -1);
  config.throttleStyle = 'spring-centred';
  config.channels.throttle.center = 0;
  p.axes[4] = 0;
  assert.equal(normalizeRadioInput(validateRadioProfile(config), p).throttle, 0.5);
});
test('bounded imports reject duplicate channels, malformed counts, incomplete calibration, unknown fields and nonfinite input', () => {
  for (const change of [
    (p) => (p.channels.roll.axis = p.channels.pitch.axis),
    (p) => (p.device.axes = 1000),
    (p) => (p.channels.roll.min = 0.8),
    (p) => (p.channels.throttle.center = 0),
    (p) => (p.channels.yaw.deadZone = 0.99),
    (p) => (p.unsafe = true),
    (p) => (p.switches.arm = { button: 500, threshold: 0.5, invert: false }),
  ]) {
    const p = profile();
    change(p);
    assert.throws(() => validateRadioProfile(p));
  }
  const p = pad();
  p.axes[4] = NaN;
  assert.throws(() => normalizeRadioInput(profile(), p));
  assert.equal(
    exportRadioProfile(validateRadioProfile(exportRadioProfile(profile()))),
    exportRadioProfile(profile()),
  );
});
test('response profiles use an explicit bounded integer cubic blend and round trip', () => {
  assert.deepEqual(validateFlightResponse(JSON.stringify(DEFAULT_RESPONSE)), DEFAULT_RESPONSE);
  for (const x of [-1000, -500, 0, 500, 1000]) {
    assert.equal(responseCurve(x, 0), x);
    assert.equal(responseCurve(-x, 30) || 0, -responseCurve(x, 30) || 0);
  }
  assert.equal(responseCurve(500, 80), 200);
  assert.throws(() => validateFlightResponse({ ...DEFAULT_RESPONSE, maxRate: Infinity }));
});
function runtime(p, config = profile(p)) {
  let devices = [null, p],
    freezes = [];
  const radio = createRadioRuntime({
    getGamepads: () => devices,
    onFreeze: (why) => freezes.push(why),
  });
  radio.select(p.index);
  radio.setProfile(config);
  radio.verify();
  radio.poll();
  return { radio, freezes, replace: (value) => (devices = value) };
}
test('arming explains high throttle and neutral attitude requirements; held timestamps remain valid', () => {
  const p = pad(),
    { radio } = runtime(p);
  p.axes[4] = 0;
  assert.equal(radio.requestArm(), false);
  assert.equal(radio.status().reason, 'throttle-high');
  p.axes[4] = -1;
  p.axes[6] = 0.5;
  assert.equal(radio.requestArm(), false);
  assert.equal(radio.status().reason, 'centre-controls');
  p.axes[6] = 0;
  assert.equal(radio.requestArm(), true);
  p.axes[4] = 0;
  for (let i = 0; i < 10; i++) assert.equal(radio.poll().throttle, 0.5);
  assert.equal(p.timestamp, 0);
  assert.equal(radio.status().active, true);
});
test('same-slot replacement and disconnect clear input; reappearance requires explicit verification and arm', () => {
  const p = pad(),
    { radio, replace } = runtime(p);
  assert.equal(radio.requestArm(), true);
  p.axes[4] = 0;
  radio.poll();
  replace([null, { ...p, id: 'Different device' }]);
  assert.equal(radio.poll().throttle, 0);
  assert.equal(radio.status().active, false);
  replace([null, p]);
  radio.poll();
  assert.equal(radio.requestArm(), false);
  radio.verify();
  assert.equal(radio.requestArm(), true);
  radio.disconnect(p.index);
  assert.equal(radio.status().verified, false);
  radio.poll();
  assert.equal(radio.status().active, false);
});
test('airborne pause requires pickup at previous controls, not low throttle; reset clears pickup', () => {
  const p = pad(),
    { radio } = runtime(p);
  radio.requestArm();
  p.axes[4] = 0;
  radio.poll();
  radio.freeze('blur');
  p.axes[4] = -1;
  assert.equal(radio.requestArm(), false);
  assert.equal(radio.status().reason, 'pickup-controls');
  p.axes[4] = 0;
  assert.equal(radio.requestArm(), true);
  radio.reset();
  assert.equal(radio.status().pickup, null);
  assert.equal(radio.requestArm(), false);
  p.axes[4] = -1;
  assert.equal(radio.requestArm(), true);
});
test('latched arm starts OFF, needs fresh OFF→ON after focus loss and cannot reconnect armed', () => {
  const p = pad(),
    config = profile(p);
  config.switches.arm = { button: 0, threshold: 0.5, invert: false };
  p.buttons[0].value = 1;
  const { radio } = runtime(p, config);
  radio.poll();
  assert.equal(radio.status().active, false);
  assert.equal(radio.status().reason, 'arm-off-first');
  p.buttons[0].value = 0;
  radio.poll();
  p.buttons[0].value = 1;
  radio.poll();
  assert.equal(radio.status().active, true);
  radio.freeze('blur');
  radio.poll();
  assert.equal(radio.status().active, false);
  p.buttons[0].value = 0;
  radio.poll();
  p.buttons[0].value = 1;
  radio.poll();
  assert.equal(radio.status().active, true);
});
test('calibration profile replacement invalidates verification; malformed or throwing browser API is diagnosable', () => {
  const p = pad(),
    { radio } = runtime(p);
  radio.requestArm();
  radio.setProfile(profile(p));
  assert.equal(radio.status().active, false);
  assert.equal(radio.requestArm(), false);
  assert.equal(radio.status().reason, 'verify-controls');
  assert.equal(createRadioRuntime({ getGamepads: null }).devices().status, 'unavailable');
  assert.equal(
    createRadioRuntime({
      getGamepads() {
        throw new Error('denied');
      },
    }).devices().status,
    'unavailable',
  );
});
test('profiles have validated export/import and failed writes are visible session-only without changing Journey', () => {
  const data = new Map(),
    storage = { getItem: (k) => data.get(k), setItem: (k, v) => data.set(k, v) };
  const store = createFlightProfileStore({ storage });
  assert.equal(store.save({ ...store.snapshot(), radio: profile() }).saved, true);
  const restored = createFlightProfileStore({ storage });
  assert.equal(restored.export(), store.export());
  assert.deepEqual([...data.keys()], ['revealline.flight-profiles.v1']);
  const failed = createFlightProfileStore({
    storage: {
      setItem() {
        throw new Error('quota');
      },
      getItem() {
        return null;
      },
    },
  });
  assert.equal(failed.import(store.export()).saved, false);
  assert.equal(failed.status().error, 'quota');
  assert.equal(failed.snapshot().radio.name, 'My radio');
  assert.throws(() => failed.import('{"format":"FlightProfiles.v1"}'));
  assert.equal(failed.snapshot().radio.name, 'My radio');
});

test('radio arm switch disarms on OFF and held reset restarts only once, requiring a fresh arm edge', () => {
  const p = pad(),
    config = profile(p);
  config.switches.arm = { button: 0, threshold: 0.5, invert: false };
  config.switches.reset = { button: 1, threshold: 0.5, invert: false };
  let resets = 0;
  const radio = createRadioRuntime({
    getGamepads: () => [null, p],
    onReset: () => {
      resets++;
    },
  });
  radio.select(p.index);
  radio.setProfile(config);
  radio.verify();
  radio.poll();
  p.buttons[0].value = 1;
  radio.poll();
  assert.equal(radio.status().active, true);
  p.buttons[0].value = 0;
  radio.poll();
  assert.equal(radio.status().active, false);
  p.buttons[0].value = 1;
  radio.poll();
  assert.equal(radio.status().active, true);
  p.buttons[1].value = 1;
  radio.poll();
  radio.poll();
  assert.equal(resets, 1);
  assert.equal(radio.status().active, false);
  p.buttons[1].value = 0;
  radio.poll();
  assert.equal(radio.status().active, false);
  p.buttons[0].value = 0;
  radio.poll();
  p.buttons[0].value = 1;
  radio.poll();
  assert.equal(radio.status().active, true);
});

test('v2 axis switches preserve v1 calibration, reject flight-axis overlap and require fresh arming', async () => {
  const { AXIS_RADIO_FORMAT, radioSwitch } = await import(
    '../../optional-practice/civilian-fpv/radio-profile.mjs'
  );
  const p = pad(),
    config = profile(p);
  const original = JSON.stringify(config.channels);
  config.format = AXIS_RADIO_FORMAT;
  config.switches.arm = { axis: 1, off: -1, on: 1 };
  config.switches.reset = { axis: 3, off: 1, on: -1 };
  validateRadioProfile(config);
  assert.equal(JSON.stringify(config.channels), original);
  const overlap = structuredClone(config);
  overlap.switches.arm.axis = 4;
  assert.throws(() => validateRadioProfile(overlap));
  const legacy = structuredClone(config);
  legacy.format = RADIO_FORMAT;
  assert.throws(() => validateRadioProfile(legacy));
  p.axes[1] = -1;
  p.axes[3] = 1;
  const { radio } = runtime(p, config);
  p.axes[1] = 0;
  radio.poll();
  assert.equal(radio.status().active, false);
  p.axes[1] = 1;
  radio.poll();
  assert.equal(radio.status().active, true);
  p.axes[1] = 0;
  radio.poll();
  assert.equal(radio.status().active, true);
  p.axes[1] = -1;
  radio.poll();
  assert.equal(radio.status().active, false);
  p.axes[3] = -1;
  assert.equal(radioSwitch(config, p, 'reset'), true);
  p.axes[3] = NaN;
  assert.throws(() => radioSwitch(config, p, 'reset'));
});
