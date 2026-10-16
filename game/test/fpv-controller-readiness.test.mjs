import assert from 'node:assert/strict';
import test from 'node:test';
import { createFlightGamepad } from '../../optional-practice/civilian-fpv/input.mjs';

const actionButtons = [0, 1, 3, 9, 11];
function fixture() {
  const pad = {
    id: 'Standard controller fixture',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ value: 0 })),
  };
  const adapter = createFlightGamepad({
    window: {},
    document: { hidden: false, hasFocus: () => true },
  });
  let now = 0;
  const poll = (scope = 'flight', gamepads = [pad]) =>
    adapter.poll({ gamepads, now: (now += 20), scope });
  const press = (...buttons) =>
    buttons.forEach((index) => {
      pad.buttons[index].value = 1;
    });
  const release = () =>
    pad.buttons.forEach((button) => {
      button.value = 0;
    });
  const arm = () => {
    poll('ready');
    press(0);
    assert.deepEqual(poll('ready').actions, []);
    release();
    assert.deepEqual(poll('ready').actions, ['arm']);
    poll();
    pad.axes[1] = -1;
    for (let i = 0; i < 60; i++) {
      poll();
      adapter.sample(0.02);
    }
    pad.axes[1] = 0;
    assert(adapter.status().controls.throttle > 0.5);
  };
  return { adapter, pad, poll, press, release, arm };
}

test('every conflicting action chord pauses an active controller before neutral flight input can be used', () => {
  for (let a = 0; a < actionButtons.length; a++) {
    for (let b = a + 1; b < actionButtons.length; b++) {
      const f = fixture();
      f.arm();
      f.press(actionButtons[a], actionButtons[b]);
      const sampled = f.poll();
      assert.deepEqual(
        sampled.actions,
        ['pause'],
        `buttons ${actionButtons[a]} + ${actionButtons[b]}`,
      );
      assert.equal(sampled.ready, false);
      assert.equal(sampled.active, false);
      assert.equal(f.adapter.sample(0.02).throttle, 0);
      // Both production hosts consume Pause before they step. A held/released
      // chord must never turn into Arm, Reset or Camera while the menu owns input.
      assert.deepEqual(f.poll('blocked').actions, []);
      f.release();
      assert.deepEqual(f.poll('blocked').actions, []);
      assert.deepEqual(f.poll('ready').actions, []);
      assert.equal(f.adapter.status().active, false);
      assert.equal(f.adapter.status().controls.throttle, 0);
      f.press(0);
      assert.deepEqual(f.poll('ready').actions, []);
      f.release();
      assert.deepEqual(f.poll('ready').actions, ['arm']);
      f.adapter.dispose();
    }
  }
});

test('overlapping action handoff pauses once; the same ambiguity while disarmed never arms', () => {
  for (const active of [false, true]) {
    const f = fixture();
    if (active) f.arm();
    else f.poll('ready');
    const scope = active ? 'flight' : 'ready';
    f.press(11);
    assert.deepEqual(f.poll(scope).actions, []);
    f.release();
    f.press(3);
    assert.deepEqual(f.poll(scope).actions, active ? ['pause'] : []);
    assert.equal(f.adapter.status().ready, false);
    f.release();
    assert.deepEqual(f.poll('ready').actions, []);
    assert.equal(f.adapter.status().active, false);
    f.adapter.dispose();
  }
});

test('disconnect and reconnect retain the deliberate neutral pickup and arm boundary', () => {
  const f = fixture();
  f.arm();
  assert.deepEqual(f.poll('flight', []).actions, ['pause']);
  f.press(0);
  assert.deepEqual(f.poll('ready').actions, []);
  assert.equal(f.adapter.status().canArm, false);
  f.release();
  assert.deepEqual(f.poll('ready').actions, []);
  assert.equal(f.adapter.status().active, false);
  assert.equal(f.adapter.status().controls.throttle, 0);
  f.press(0);
  assert.deepEqual(f.poll('ready').actions, []);
  f.release();
  assert.deepEqual(f.poll('ready').actions, ['arm']);
  f.adapter.dispose();
});
