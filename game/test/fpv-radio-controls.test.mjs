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
