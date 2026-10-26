import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMBAT_RADIO_FORMAT,
  RADIO_CONTROL_SWITCHES,
  RADIO_MODEL_CATALOGUE,
  createRadioControlLayout,
  loadRadioControlLayout,
  saveRadioControlLayout,
  removeRadioControlLayout,
  validateRadioControlLayout,
  radioDeviceIdentity,
  radioDeviceRecommendation,
  loadRadioModelSelection,
  saveRadioModelSelection,
  removeRadioModelSelection,
} from '../../optional-practice/civilian-fpv/radio-profile.mjs';
import { createRadioRuntime } from '../../optional-practice/civilian-fpv/radio-runtime.mjs';
import { restoreVerifiedRadio } from '../../optional-practice/civilian-fpv/radio-session.mjs';

function fixture({ six = true } = {}) {
  const pad = {
    id: 'Six-switch radio',
    index: 0,
    mapping: '',
    connected: true,
    axes: [0, 0, 0, -1, -1, 0, 0, 0],
    buttons: Array.from({ length: 8 }, () => ({ value: 0 })),
  };
  const binding = (button) => ({ button, threshold: 0.5, invert: false });
  const profile = {
    format: COMBAT_RADIO_FORMAT,
    id: 'six-switch-test',
    name: 'Six-switch test',
    device: radioDeviceIdentity(pad),
    verified: true,
    stickMode: 2,
    throttleStyle: 'full-travel',
    channels: Object.fromEntries(
      ['roll', 'pitch', 'yaw', 'throttle'].map((key, axis) => [
        key,
        {
          axis,
          min: -1,
          center: key === 'throttle' ? null : 0,
          max: 1,
          invert: false,
          deadZone: 0,
        },
      ]),
    ),
    switches: {
      ...Object.fromEntries(RADIO_CONTROL_SWITCHES.map((key, index) => [key, binding(index)])),
      pause: binding(6),
      reset: binding(7),
      camera: null,
    },
  };
  let devices = [pad];
  const events = [];
  const radio = createRadioRuntime({
    getGamepads: () => devices,
    onFreeze: (reason) => events.push(['freeze', reason]),
    onReset: () => events.push(['reset']),
    onCombatAction: (action) => events.push(['combat', action]),
  });
  radio.select(pad.index);
  radio.setProfile(profile);
  radio.verify();
  if (six) radio.setControlLayout(createRadioControlLayout(profile));
  const switchTo = (key, on) => {
    pad.buttons[profile.switches[key].button].value = Number(on);
    return radio.poll();
  };
  const context = (owner, key = owner, resumeAllowed = false, playback = false) =>
    radio.setContext({ owner, key, resumeAllowed, playback });
  const arm = () => {
    context('menu', 'pause-root', true);
    switchTo('arm', false);
    switchTo('arm', true);
    assert.equal(radio.status().active, true);
    context('flight');
    radio.poll();
  };
  return {
    pad,
    profile,
    radio,
    events,
    switchTo,
    context,
    arm,
    devices: (value) => (devices = value),
  };
}
function storageFixture() {
  const data = new Map();
  return {
    data,
    storage: {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
      removeItem: (key) => data.delete(key),
    },
  };
}

test('six-switch layout is separate, bounded, explicit and stored by full radio identity', () => {
  const { profile } = fixture(),
    before = JSON.stringify(profile),
    layout = createRadioControlLayout(profile),
    { storage, data } = storageFixture();
  assert.deepEqual(Object.keys(layout.switches), RADIO_CONTROL_SWITCHES);
  assert.equal(JSON.stringify(profile), before);
  assert.equal(loadRadioControlLayout({ storage, device: profile.device }), null);
  saveRadioControlLayout({ storage, layout });
  const other = { ...layout, device: { ...layout.device, mapping: 'standard' } };
  saveRadioControlLayout({ storage, layout: other });
  assert.equal(data.size, 2);
  assert.deepEqual(loadRadioControlLayout({ storage, device: profile.device }), layout);
  assert.deepEqual(loadRadioControlLayout({ storage, device: other.device }), other);
  removeRadioControlLayout({ storage, device: other.device });
  assert.equal(data.size, 1);
  assert.equal(JSON.stringify(profile), before);
  for (const change of [
    (value) => (value.switches.reload = value.switches.weapon),
    (value) => (value.switches.arm = { axis: 0, off: -1, on: 1 }),
    (value) => (value.switches.extra = null),
    (value) => (value.device.id = 'Another radio'),
  ]) {
    const invalid = structuredClone(layout);
    change(invalid);
    assert.throws(() => validateRadioControlLayout(invalid, { profile }));
  }
  assert.throws(() =>
    saveRadioControlLayout({
      storage: {
        setItem: () => {
          throw Error('quota');
        },
      },
      layout,
    }),
  );
});

test('six-switch Flight requires a fresh edge at the resume root and cannot arm from nested menus', () => {
  const { radio, switchTo, context } = fixture();
  context('menu', 'settings', false);
  switchTo('arm', false);
  switchTo('arm', true);
  assert.equal(radio.status().active, false);
  context('menu', 'pause-root', true);
  radio.poll();
  assert.equal(radio.status().active, false);
  assert.equal(radio.requestArm(), false);
  switchTo('arm', false);
  const neutral = switchTo('arm', true);
  assert.equal(radio.status().active, true);
  assert.deepEqual(neutral, { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
  context('flight');
  radio.poll();
  assert.equal(radio.status().active, true);
});

test('Flight OFF opens menu once and resume preserves airborne pickup instead of demanding low throttle', () => {
  const { pad, radio, events, switchTo, context, arm } = fixture();
  arm();
  pad.axes[3] = 0.4;
  radio.poll();
  events.length = 0;
  switchTo('arm', false);
  assert.deepEqual(events, [['freeze', 'menu']]);
  assert.equal(radio.status().active, false);
  assert.equal(radio.menuPreview().pickup.throttle, 0.7);
  context('menu', 'pause-root', true);
  radio.poll();
  pad.axes[3] = -1;
  switchTo('arm', true);
  assert.equal(radio.status().reason, 'pickup-controls');
  assert.equal(radio.status().active, false);
  pad.axes[3] = 0.4;
  radio.poll();
  assert.equal(radio.status().active, false, 'failed ON is not deferred');
  switchTo('arm', false);
  switchTo('arm', true);
  assert.equal(radio.status().active, true);
});

test('menu switch samples cannot deliver combat and every resumed weapon requires a fresh release', () => {
  const { radio, events, switchTo, context, arm } = fixture();
  arm();
  switchTo('fire', true);
  assert.equal(radio.fireHeld(), true);
  switchTo('weapon', true);
  assert.ok(events.some((item) => item[1] === 'weapon'));
  switchTo('arm', false);
  context('menu', 'pause-root', true);
  events.length = 0;
  for (const key of ['reload', 'payload', 'detonate']) switchTo(key, true);
  assert.equal(radio.fireHeld(), false);
  assert.deepEqual(events, []);
  assert.equal(radio.menuPreview().switches.detonate, true);
  switchTo('arm', true);
  context('flight');
  radio.poll();
  assert.equal(radio.fireHeld(), false);
  assert.deepEqual(events, []);
  for (const key of ['fire', 'weapon', 'reload', 'payload', 'detonate']) switchTo(key, false);
  for (const key of ['fire', 'weapon', 'reload', 'payload', 'detonate']) switchTo(key, true);
  assert.equal(radio.fireHeld(), true);
  assert.deepEqual(events, [
    ['combat', 'weapon'],
    ['combat', 'reload'],
    ['combat', 'payload'],
    ['combat', 'detonate'],
  ]);
});

test('capture and menu key changes consume Flight edges without deferred arming', () => {
  const { radio, context, switchTo } = fixture();
  context('capture', 'capture-payload', false);
  switchTo('arm', false);
  switchTo('arm', true);
  context('menu', 'pause-root', true);
  radio.poll();
  assert.equal(radio.status().active, false);
  switchTo('arm', false);
  context('menu', 'settings', false);
  switchTo('arm', true);
  context('menu', 'pause-root', true);
  radio.poll();
  assert.equal(radio.status().active, false);
  switchTo('arm', false);
  switchTo('arm', true);
  assert.equal(radio.status().active, true);
});

test('disconnect never reconnects armed and restoring layout does not consume calibration', () => {
  const { radio, pad, profile, devices, switchTo, context, arm } = fixture();
  arm();
  devices([]);
  radio.poll();
  assert.equal(radio.status().active, false);
  devices([pad]);
  radio.verify();
  context('menu', 'pause-root', true);
  radio.poll();
  assert.equal(radio.status().active, false);
  assert.deepEqual(JSON.parse(radio.status().profile), profile);
  switchTo('arm', false);
  switchTo('arm', true);
  assert.equal(radio.status().active, true);
});

test('last verified navigation remains available during edits but never enables flight', () => {
  const { radio, profile, pad, context } = fixture();
  radio.beginSetup();
  context('menu', 'radio-setup', false);
  const edited = structuredClone(profile);
  edited.channels.roll.invert = true;
  edited.verified = false;
  radio.setProfile(edited);
  pad.axes[0] = 0.5;
  const navigation = radio.menuPreview();
  assert.equal(navigation.verified, true);
  assert.equal(navigation.controls.roll, 0.5);
  assert.equal(radio.preview().controls.roll, -0.5);
  assert.equal(radio.status().verified, false);
  assert.equal(radio.requestArm(), false);
});

test('provisional Select/Back has copied raw device data and no flight ownership', () => {
  const { radio, profile, pad, context } = fixture();
  radio.setProvisionalMenu({
    device: profile.device,
    index: pad.index,
    switches: { fire: profile.switches.fire, weapon: profile.switches.weapon },
  });
  context('menu', 'radio-setup', false);
  const raw = radio.rawDevices();
  raw[0].buttons[1] = 1;
  raw[0].axes[0] = 1;
  assert.equal(pad.buttons[1].value, 0);
  assert.equal(pad.axes[0], 0);
  pad.buttons[1].value = 1;
  const preview = radio.menuPreview();
  assert.equal(preview.provisional, true);
  assert.equal(preview.verified, false);
  assert.equal(preview.controls, null);
  assert.equal(preview.switches.fire, true);
  assert.equal(radio.status().active, false);
  context('flight');
  assert.equal(radio.menuPreview().provisional, false);
});

test('playback Flight edges request resume once without arming or returning controls', () => {
  const { radio, switchTo, context } = fixture();
  context('menu', 'playback-pause-root', true, true);
  switchTo('arm', false);
  assert.deepEqual(switchTo('arm', true), { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
  assert.equal(radio.status().active, false);
  assert.equal(radio.consumeResumeRequest(), true);
  assert.equal(radio.consumeResumeRequest(), false);
  radio.poll();
  assert.equal(radio.consumeResumeRequest(), false);
});

test('legacy Reset and Pause held across freeze cannot replay until released', () => {
  const { radio, switchTo, events } = fixture({ six: false });
  radio.poll();
  switchTo('reset', true);
  assert.equal(events.filter((item) => item[0] === 'reset').length, 1);
  radio.freeze('menu');
  radio.poll();
  radio.poll();
  assert.equal(events.filter((item) => item[0] === 'reset').length, 1);
  switchTo('reset', false);
  switchTo('reset', true);
  assert.equal(events.filter((item) => item[0] === 'reset').length, 2);
  switchTo('reset', false);
  switchTo('pause', true);
  const pauses = events.filter((item) => item[1] === 'paused').length;
  radio.freeze('blur');
  radio.poll();
  assert.equal(events.filter((item) => item[1] === 'paused').length, pauses);
  switchTo('pause', false);
  switchTo('pause', true);
  assert.equal(events.filter((item) => item[1] === 'paused').length, pauses + 1);
});

test('verified restoration loads saved layout once and preserves explicit session disable', () => {
  const { radio, profile } = fixture({ six: false }),
    { storage } = storageFixture(),
    layout = createRadioControlLayout(profile);
  saveRadioControlLayout({ storage, layout });
  assert.equal(restoreVerifiedRadio(radio, null, { storage }).status, 'ready');
  assert.deepEqual(radio.controlLayout(), layout);
  assert.equal(radio.status().controlLayoutDirty, false);
  radio.setControlLayout(null);
  restoreVerifiedRadio(radio, null, { storage });
  assert.equal(radio.controlLayout(), null);
  assert.equal(radio.status().controlLayoutDirty, true);
});

test('disabling six-switch mode exits its captured context and restores legacy fresh arming', () => {
  const { radio, context, switchTo } = fixture();
  context('capture', 'layout-editor', false);
  switchTo('arm', true);
  radio.setControlLayout(null);
  radio.poll();
  assert.equal(radio.status().active, false);
  switchTo('arm', false);
  switchTo('arm', true);
  assert.equal(radio.status().active, true);
});

test('known model names propose six configurable channels without certifying a radio', () => {
  const descriptor = { id: '0xbot RC USB JoyStick', mapping: '', axes: 8, buttons: 24 };
  const candidate = radioDeviceRecommendation(descriptor);
  assert.equal(candidate.modelId, 'oxbot-r1');
  assert.equal(candidate.channelPreset, 'oxbot-aetr');
  assert.equal(candidate.profile.verified, false);
  assert.equal(candidate.requiresVerification, true);
  const manual = radioDeviceRecommendation(descriptor, { channelPreset: null });
  assert.equal(manual.channelPreset, null);
  assert.equal(manual.profile, null);
  assert.equal(manual.layout, null);
  assert.equal(manual.noticeCode, 'choose-channel-preset');
  assert.equal(
    radioDeviceRecommendation(descriptor, { channelPreset: undefined }).channelPreset,
    'oxbot-aetr',
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(candidate.profile.channels).map(([key, channel]) => [key, channel.axis]),
    ),
    { roll: 0, pitch: 1, yaw: 3, throttle: 2 },
  );
  assert.deepEqual(candidate.layout.switches.arm, { axis: 4, off: -1, on: 1 });
  for (const model of RADIO_MODEL_CATALOGUE) {
    if (model.id === 'other-radio') continue;
    const result = radioDeviceRecommendation({ ...descriptor, id: `${model.name} Joystick` });
    assert.equal(result.modelId, model.id, model.name);
    if (model.surfaceOnly) {
      assert.equal(result.profile, null);
      assert.equal(result.noticeCode, 'surface-radio');
    } else if (model.channelPreset === null) {
      assert.equal(result.profile, null, `${model.name} does not imply EdgeTX`);
      assert.equal(result.noticeCode, 'choose-channel-preset');
      const explicit = radioDeviceRecommendation(
        { ...descriptor, id: model.name },
        { channelPreset: 'aetr-usb' },
      );
      assert.equal(explicit.profile.verified, false);
    } else {
      assert.equal(result.profile.verified, false, model.name);
      assert.equal(Object.values(result.layout.switches).filter(Boolean).length, 6, model.name);
      if (model.physicalSwitches === 5) assert.equal(result.noticeCode, 'five-switch-radio');
    }
  }
  assert.equal(
    radioDeviceRecommendation({ ...descriptor, id: 'Unknown (Vendor: 1209 Product: 4f54)' })
      .profile,
    null,
    'shared USB VID/PID does not identify model or firmware',
  );
  assert.equal(
    radioDeviceRecommendation({ ...descriptor, axes: 4 }).noticeCode,
    'channel-count-mismatch',
  );
});

test('Squid supplied firmware and upstream CRSF firmware use distinct documented candidates', () => {
  const device = {
    id: 'CRSFJoystick (Vendor: 1209 Product: 4f54)',
    mapping: '',
    axes: 8,
    buttons: 24,
  };
  assert.equal(radioDeviceRecommendation(device).noticeCode, 'choose-receiver-firmware');
  assert.equal(radioDeviceRecommendation(device).profile, null);
  const squid = radioDeviceRecommendation(device, {
    modelId: 'radiomaster-tx15',
    channelPreset: 'squid-stick',
  });
  assert.equal(squid.transport, 'receiver');
  assert.equal(squid.profile.channels.throttle.axis, 2);
  assert.equal(squid.profile.channels.yaw.axis, 3);
  assert.deepEqual(
    Object.values(squid.layout.switches).map((binding) =>
      'axis' in binding ? `axis${binding.axis}` : `button${binding.button}`,
    ),
    ['button2', 'axis4', 'axis5', 'button0', 'axis6', 'axis7'],
  );
  assert.equal(squid.profile.verified, false);
  const upstream = radioDeviceRecommendation(device, { channelPreset: 'crsf-upstream' });
  assert.equal(upstream.profile.channels.throttle.axis, 3);
  assert.equal(upstream.profile.channels.yaw.axis, 4);
  assert.deepEqual(
    Object.values(upstream.layout.switches).map((binding) => binding.button),
    [0, 1, 2, 3, 4, 5],
  );
  assert.equal(
    radioDeviceRecommendation({ ...device, id: 'Squid Stick' }).modelId,
    'other-radio',
    'receiver name cannot identify its paired transmitter',
  );
  assert.equal(
    radioDeviceRecommendation({ ...device, id: 'Squid Stick' }, { channelPreset: null }).profile,
    null,
    'explicit manual choice also overrides receiver-name inference',
  );
  const previous = structuredClone(squid.profile);
  previous.verified = true;
  const button = (index) => ({ button: index, threshold: 0.5, invert: false });
  const axis = (index) => ({ axis: index, off: -1, on: 1 });
  Object.assign(previous.switches, {
    arm: button(2),
    fire: button(3),
    weapon: axis(6),
    reload: axis(7),
    payload: button(0),
    detonate: button(1),
  });
  const retainedLayout = createRadioControlLayout(previous);
  const { storage } = storageFixture();
  saveRadioControlLayout({ storage, layout: retainedLayout });
  const pad = {
    ...device,
    index: 0,
    connected: true,
    axes: [0, 0, -1, 0, -1, -1, -1, -1],
    buttons: Array.from({ length: 24 }, () => ({ value: 0 })),
  };
  const runtime = createRadioRuntime({ getGamepads: () => [pad] });
  const store = { snapshot: () => ({ radio: previous }), radios: () => [{ profile: previous }] };
  assert.equal(restoreVerifiedRadio(runtime, store, { storage }).status, 'restored');
  assert.deepEqual(
    runtime.controlLayout(),
    retainedLayout,
    'new candidates never remap saved verified layouts',
  );
});

test('radio model and transport choices persist per exact device without changing calibration', () => {
  const { storage, data } = storageFixture();
  const device = { id: 'Pico CRSFJoystick', mapping: '', axes: 8, buttons: 24 };
  const other = { ...device, buttons: 8 };
  assert.equal(loadRadioModelSelection({ storage, device }), null);
  const selection = saveRadioModelSelection({
    storage,
    device,
    modelId: 'oxbot-r1',
    channelPreset: 'squid-stick',
  });
  assert.deepEqual(loadRadioModelSelection({ storage, device }), selection);
  assert.equal(loadRadioModelSelection({ storage, device: other }), null);
  saveRadioModelSelection({
    storage,
    device: other,
    modelId: 'radiomaster-boxer',
    channelPreset: 'crsf-upstream',
  });
  assert.equal(data.size, 2);
  assert.equal(loadRadioModelSelection({ storage, device }).channelPreset, 'squid-stick');
  removeRadioModelSelection({ storage, device: other });
  assert.equal(data.size, 1);
  assert.throws(() =>
    saveRadioModelSelection({ storage, device, modelId: 'made-up', channelPreset: 'squid-stick' }),
  );
  assert.throws(() =>
    saveRadioModelSelection({
      storage,
      device,
      modelId: 'oxbot-r1',
      channelPreset: 'unverified-firmware',
    }),
  );
  const surface = { id: 'RadioMaster MT12', mapping: '', axes: 2, buttons: 8 };
  saveRadioModelSelection({
    storage,
    device: surface,
    modelId: 'radiomaster-mt12',
    channelPreset: null,
  });
  assert.equal(loadRadioModelSelection({ storage, device: surface }).channelPreset, null);
  assert.equal(
    radioDeviceRecommendation(surface, loadRadioModelSelection({ storage, device: surface }))
      .profile,
    null,
  );
});

test('session restoration proposes unfamiliar radios without replacing saved exact-device calibrations', () => {
  const pad = {
    id: '0xbot RC USB JoyStick',
    index: 0,
    connected: true,
    mapping: '',
    axes: [0, 0, -1, 0, -1, -1, -1, -1],
    buttons: Array.from({ length: 24 }, () => ({ value: 0 })),
  };
  const radio = createRadioRuntime({ getGamepads: () => [pad] });
  const candidate = restoreVerifiedRadio(radio, null);
  assert.equal(candidate.status, 'candidate');
  assert.equal(candidate.candidate.profile.verified, false);
  assert.equal(radio.status().profile, null);
  assert.equal(radio.status().active, false);
  const profile = candidate.candidate.profile;
  profile.verified = true;
  profile.channels.yaw.center = 0.01;
  const store = {
    snapshot: () => ({ radio: profile }),
    radios: () => [{ profile }],
  };
  const restored = restoreVerifiedRadio(radio, store);
  assert.equal(restored.status, 'restored');
  assert.equal(JSON.parse(radio.status().profile).channels.yaw.center, 0.01);
  assert.equal(radio.status().active, false);
  const fresh = createRadioRuntime({ getGamepads: () => [pad] });
  profile.verified = false;
  assert.equal(restoreVerifiedRadio(fresh, store).status, 'unverified');
  assert.equal(fresh.status().profile, null);
});
