import test from 'node:test';
import assert from 'node:assert/strict';
import {
  radioControlLabel,
  captureRadioSwitch,
} from '../../optional-practice/civilian-fpv/radio-controls.mjs';

test('control descriptions track all four stick layouts', () => {
  assert.equal(radioControlLabel('roll', 2), 'Roll — right stick left/right');
  assert.equal(radioControlLabel('pitch', 2), 'Pitch — right stick up/down');
  assert.equal(radioControlLabel('throttle', 1), 'Throttle — right stick up/down');
  assert.equal(radioControlLabel('yaw', 3), 'Yaw — right stick left/right');
  assert.equal(radioControlLabel('roll', 4, 'uk'), 'Крен — лівий стік ліворуч/праворуч');
});
test('switch capture learns a single active channel and polarity without guessing ambiguous input', () => {
  assert.deepEqual(captureRadioSwitch([0, 0, 1], [0, 1, 1]), {
    button: 1,
    threshold: 0.5,
    invert: false,
  });
  assert.deepEqual(captureRadioSwitch([0, 1], [0, 0]), { button: 1, threshold: 0.5, invert: true });
  for (const [a, b] of [
    [[0], [0]],
    [
      [0, 0],
      [1, 1],
    ],
    [[0], [1, 0]],
    [[0], [NaN]],
    [[0], [-1]],
  ])
    assert.equal(captureRadioSwitch(a, b), null);
});

test('switch capture accepts separate axes, including reversed travel, but never flight controls or ambiguous changes', async () => {
  const { captureRadioControlSwitch: capture } = await import(
    '../../optional-practice/civilian-fpv/radio-controls.mjs'
  );
  const before = { buttons: [0, 0], axes: [0, 0, -1] };
  assert.deepEqual(capture(before, { buttons: [0, 0], axes: [0, 0, 1] }, [0, 1]), {
    axis: 2,
    off: -1,
    on: 1,
  });
  assert.deepEqual(capture({ buttons: [0], axes: [1] }, { buttons: [0], axes: [-1] }), {
    axis: 0,
    off: 1,
    on: -1,
  });
  assert.equal(capture(before, { buttons: [0, 0], axes: [0, 0, 1] }, [2]), null);
  assert.equal(capture(before, { buttons: [1, 0], axes: [0, 0, 1] }), null);
  assert.equal(capture(before, { buttons: [0, 0], axes: [1, 0, 1] }), null);
});
