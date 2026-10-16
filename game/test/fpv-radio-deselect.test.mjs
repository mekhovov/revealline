import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountRadioSetup } from '../../optional-practice/civilian-fpv/radio-setup.mjs';
import { createRadioRuntime } from '../../optional-practice/civilian-fpv/radio-runtime.mjs';
import { radioDeviceIdentity } from '../../optional-practice/civilian-fpv/radio-profile.mjs';
test('selecting no radio revokes the old device and verified mapping before a later arm', () => {
  const pad = {
    id: 'test-usb',
    mapping: '',
    index: 0,
    connected: true,
    axes: [0, 0, 0, -1],
    buttons: [],
  };
  const runtime = createRadioRuntime({ getGamepads: () => [pad] });
  const profile = {
    format: 'RadioProfile.v1',
    id: 'test-usb',
    name: 'Synthetic radio',
    device: radioDeviceIdentity(pad),
    stickMode: 2,
    throttleStyle: 'full-travel',
    verified: true,
    channels: Object.fromEntries(
      ['roll', 'pitch', 'yaw', 'throttle'].map((key, axis) => [
        key,
        {
          axis,
          min: -1,
          center: key === 'throttle' ? null : 0,
          max: 1,
          invert: false,
          deadZone: key === 'throttle' ? 0 : 0.02,
        },
      ]),
    ),
    switches: { arm: null, pause: null, reset: null },
  };
  assert.equal(runtime.select(0), true);
  runtime.setProfile(profile);
  assert.equal(runtime.verify(), true);
  assert.equal(runtime.requestArm(), true);
  runtime.freeze('paused'); // The actual host pauses before opening Setup.
  const doc = new Document(),
    create = doc.createElement.bind(doc);
  // Labels expose their native text child without replacing the nested select.
  doc.createElement = (...args) => {
    const node = create(...args);
    Object.defineProperty(node, 'firstChild', {
      get: () =>
        node._text
          ? {
              nodeType: 3,
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
  const container = doc.createElement('section');
  doc.body.append(container);
  const frames = new Map();
  let next = 0;
  const view = mountRadioSetup({
    container,
    window: Object.assign(new Events(), {
      Event,
      localStorage: null,
      requestAnimationFrame: (fn) => {
        frames.set(++next, fn);
        return next;
      },
      cancelAnimationFrame: (id) => frames.delete(id),
    }),
    runtime,
  });
  try {
    const selector = container.querySelector('select');
    selector.value = '';
    selector.emit('change');
    assert.equal(
      runtime.status().selected,
      null,
      'No-device UI must release the former device, not only pause it.',
    );
    assert.equal(runtime.status().verified, false);
    assert.equal(runtime.status().profile, null);
    assert.equal(runtime.requestArm(), false);
    assert.equal(runtime.status().active, false);
    selector.value = '0';
    selector.emit('change');
    assert.equal(runtime.status().selected.index, 0);
    assert.equal(
      runtime.requestArm(),
      false,
      'Re-selecting a device cannot silently revive its old verified mapping.',
    );
    runtime.setProfile(profile);
    runtime.verify();
    assert.equal(runtime.requestArm(), true);
  } finally {
    view.dispose();
  }
  assert.equal(frames.size, 0);
});
