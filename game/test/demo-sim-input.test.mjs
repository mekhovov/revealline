import test from 'node:test';
import assert from 'node:assert/strict';
import { attachSimDemoInput } from '../../optional-practice/civilian-fpv/demo-input.mjs';
import {
  defaultRadioProfile,
  radioDeviceKey,
} from '../../optional-practice/civilian-fpv/radio-profile.mjs';

class Element extends EventTarget {
  style = {};
  dataset = {};
  children = [];
  append(child) {
    this.children.push(child);
    child.parentElement = this;
  }
  setAttribute() {}
  remove() {
    this.parentElement?.children.splice(this.parentElement.children.indexOf(this), 1);
  }
}
const key = (target, code, { repeat = false, up = false } = {}) => {
  const event = new Event(up ? 'keyup' : 'keydown', { cancelable: true });
  Object.assign(event, { code, repeat });
  target.dispatchEvent(event);
};
function fixture(context = {}) {
  const win = new EventTarget(),
    doc = new EventTarget(),
    root = new Element(),
    parent = new Element(),
    canvas = new Element();
  Object.assign(win, {
    performance: { now: () => 1000 },
    localStorage: {
      getItem: () => 'classic',
      setItem() {
        throw new Error('Demo wrote settings');
      },
    },
  });
  Object.assign(doc, {
    hidden: false,
    hasFocus: () => true,
    defaultView: win,
    createElement: () => new Element(),
  });
  Object.assign(root, { ownerDocument: doc, open: true });
  parent.append(canvas);
  let practice = null,
    provider = null,
    joins = 0,
    resumes = 0;
  const state = { ticks: 25, lastInput: { roll: 0, pitch: 0, yaw: 0, throttle: 500 } };
  const fakePractice = () => ({
    state,
    phase: 'playing',
    setInputProvider(value) {
      provider = value;
    },
    pause() {
      this.phase = 'paused';
    },
    start() {
      this.phase = 'playing';
    },
  });
  const input = attachSimDemoInput({
    root,
    canvas,
    practice: () => practice,
    getPlayer: () => ({ state }),
    getContext: () => context,
    onTakeover: async () => {
      joins++;
      input.clear();
      practice = fakePractice();
    },
    onResume: () => {
      resumes++;
      practice.start();
    },
  });
  return {
    win,
    doc,
    input,
    root,
    get practice() {
      return practice;
    },
    get joins() {
      return joins;
    },
    get resumes() {
      return resumes;
    },
    sample: (seconds = 0.02) => provider?.(seconds),
  };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('SIM uses saved keyboard mappings, ignores pre-held repeats, and consumes a fresh takeover once', async () => {
  const f = fixture();
  try {
    assert.match(f.input.hint(), /W \/ S.*pitch/);
    key(f.win, 'KeyW', { repeat: true });
    await settle();
    assert.equal(f.joins, 0);
    key(f.win, 'KeyW');
    await settle();
    assert.equal(f.joins, 1);
    assert.equal(f.sample().pitch, 0.5);
    assert.equal(f.sample().pitch, 0.5, 'held initiating control continues through native mapping');
    key(f.win, 'KeyW', { up: true });
    assert.equal(f.sample().pitch, 0);
    f.input.clear();
    key(f.win, 'KeyW', { repeat: true });
    await settle();
    assert.equal(f.resumes, 0);
    key(f.win, 'KeyW');
    await settle();
    assert.equal(f.resumes, 1);
  } finally {
    f.input.dispose();
  }
});

test('SIM foreground loss pauses practice and requires a fresh keyboard edge', async () => {
  const f = fixture();
  try {
    key(f.win, 'KeyW');
    await settle();
    f.sample();
    f.win.dispatchEvent(new Event('blur'));
    assert.equal(f.practice.phase, 'paused');
    key(f.win, 'KeyW', { repeat: true });
    await settle();
    assert.equal(f.resumes, 0);
    key(f.win, 'KeyW', { up: true });
    key(f.win, 'KeyW');
    await settle();
    assert.equal(f.resumes, 1);
    assert.equal(f.practice.phase, 'playing');
  } finally {
    f.input.dispose();
  }
});

test('SIM controller ignores held sticks and drift, then retains accepted throttle through takeover', async () => {
  const f = fixture();
  const pad = {
    id: 'Standard controller',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0.7, 0],
    buttons: Array.from({ length: 16 }, () => ({ value: 0, pressed: false })),
  };
  try {
    f.input.controller({ gamepads: [pad], now: 1000 });
    assert.match(f.input.controllerHint(), /Left stick: yaw and throttle/);
    assert.match(f.input.controllerHint(), /X\/Square: fire/);
    assert.doesNotMatch(f.input.controllerHint(), /reset|camera/);
    await settle();
    assert.equal(f.joins, 0);
    pad.axes[2] = 0;
    f.input.controller({ gamepads: [pad], now: 1016 });
    pad.axes[2] = 0.13;
    f.input.controller({ gamepads: [pad], now: 1032 });
    await settle();
    assert.equal(f.joins, 0);
    pad.axes[2] = 0.7;
    f.input.controller({ gamepads: [pad], now: 1048 });
    await settle();
    assert.equal(f.joins, 1);
    const first = f.sample();
    assert.ok(first.roll > 0.5);
    assert.equal(first.throttle, 0.5);
    f.input.controller({ gamepads: [pad], now: 1064 });
    const continued = f.sample();
    assert.ok(continued.roll > 0.5);
    assert.equal(continued.throttle, 0.5);
  } finally {
    f.input.dispose();
  }
});

test('SIM paused controller practice needs neutral pickup and resumes with its displayed throttle', async () => {
  const f = fixture();
  const pad = {
    id: 'Standard controller',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ value: 0, pressed: false })),
  };
  try {
    f.input.controller({ gamepads: [pad], now: 1000 });
    pad.axes[2] = 0.7;
    f.input.controller({ gamepads: [pad], now: 1016 });
    await settle();
    assert.equal(f.joins, 1);
    f.sample();
    f.practice.state.lastInput.throttle = 730;
    f.input.clear();
    f.input.controller({ gamepads: [pad], now: 1032 });
    await settle();
    assert.equal(f.resumes, 0, 'Held input after pause cannot resume');
    assert.equal(f.practice.phase, 'paused');
    pad.axes[2] = 0;
    f.input.controller({ gamepads: [pad], now: 1048 });
    pad.axes[2] = 0.13;
    f.input.controller({ gamepads: [pad], now: 1064 });
    await settle();
    assert.equal(f.resumes, 0, 'Drift cannot resume');
    pad.axes[2] = 0.7;
    f.input.controller({ gamepads: [pad], now: 1080 });
    await settle();
    assert.equal(f.resumes, 1);
    assert.equal(f.practice.phase, 'playing');
    assert.equal(f.sample().throttle, 0.73);
    f.input.controller({ gamepads: [pad], now: 1096 });
    assert.equal(f.sample().throttle, 0.73);
    assert.equal(f.joins, 1, 'Resume keeps the existing practice session');
  } finally {
    f.input.dispose();
  }
});

test('SIM radio needs displayed-throttle pickup and a fresh arm edge, including after pause', async () => {
  const profile = defaultRadioProfile();
  const pad = {
    ...profile.device,
    index: 1,
    connected: true,
    axes: Array(profile.device.axes).fill(0),
    buttons: Array.from({ length: profile.device.buttons }, () => ({ value: 0 })),
  };
  pad.axes[4] = 1;
  const f = fixture({
    simRadio: {
      verified: true,
      profile: JSON.stringify(profile),
      selected: { index: pad.index, key: radioDeviceKey(pad) },
    },
  });
  try {
    f.input.controller({ gamepads: [pad], now: 1000 });
    await settle();
    assert.match(f.input.controllerHint(), /roll: axis 0/);
    assert.match(f.input.controllerHint(), /throttle: axis 2/);
    assert.match(f.input.controllerHint(), /arm: axis 4/);
    assert.doesNotMatch(f.input.controllerHint(), /Left stick|X\/Square/);
    assert.equal(f.joins, 0, 'held arm cannot take over');
    pad.axes[4] = -1;
    f.input.controller({ gamepads: [pad], now: 1016 });
    pad.axes[2] = 0.8;
    pad.axes[4] = 1;
    f.input.controller({ gamepads: [pad], now: 1032 });
    await settle();
    assert.equal(f.joins, 0, 'unmatched throttle cannot take over');
    pad.axes[2] = 0;
    pad.axes[4] = -1;
    f.input.controller({ gamepads: [pad], now: 1048 });
    pad.axes[4] = 1;
    f.input.controller({ gamepads: [pad], now: 1064 });
    await settle();
    assert.equal(f.joins, 1);
    assert.equal(f.sample().throttle, 0.5);
    f.input.clear();
    f.input.controller({ gamepads: [pad], now: 1080 });
    await settle();
    assert.equal(f.resumes, 0);
    pad.axes[4] = -1;
    f.input.controller({ gamepads: [pad], now: 1096 });
    pad.axes[4] = 1;
    f.input.controller({ gamepads: [pad], now: 1112 });
    await settle();
    assert.equal(f.resumes, 1);
  } finally {
    f.input.dispose();
  }
});
