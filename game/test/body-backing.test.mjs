import test from 'node:test';
import assert from 'node:assert/strict';
import { interiorAlphaMask } from '../ui/body-backing.mjs';
import { bodyMotionPose, validateBodyBacking } from '../ui/body-motion.mjs';

test('opaque backing fills the enclosed hole while retaining outer alpha and original pixels', () => {
  const source = new Uint8ClampedArray(7 * 7 * 4);
  for (let y = 1; y <= 5; y++)
    for (let x = 1; x <= 5; x++)
      if (x === 1 || x === 5 || y === 1 || y === 5) source[(y * 7 + x) * 4 + 3] = 255;
  source[(2 * 7 + 2) * 4 + 3] = 128;
  const original = source.slice(),
    mask = interiorAlphaMask(source, 7, 7);
  assert.equal(mask[3 * 7 + 3], 255);
  assert.equal(mask[2 * 7 + 2], 255);
  assert.equal(mask[0], 0);
  assert.equal(mask[1 * 7 + 1], 0);
  assert.deepEqual(source, original);
  source[(1 * 7 + 3) * 4 + 3] = 0;
  assert.equal(
    interiorAlphaMask(source, 7, 7)[3 * 7 + 3],
    0,
    'an open exterior is not an enclosed logo hole',
  );
});

test('fast cosmetic recipes stay bounded and reduced motion remains upright', () => {
  for (const radiansPerSecond of [Math.PI, 4 * Math.PI]) {
    const body = {
      bodyMotion: { kind: 'rigid-spin', radiansPerSecond, travelGain: 0 },
      bodyBacking: { kind: 'opaque-interior', color: '#ffffff' },
    };
    assert.equal(bodyMotionPose(body, { seconds: 0.25 }).heading, radiansPerSecond / 4);
    assert.deepEqual(bodyMotionPose(body, { seconds: 0.25, reduced: true }), {
      heading: 0,
      bank: 0,
    });
    assert.equal(validateBodyBacking(body).kind, 'opaque-interior');
  }
  assert.throws(() =>
    validateBodyBacking({ bodyBacking: { kind: 'opaque-interior', color: 'url(x)' } }),
  );
  assert.throws(() =>
    bodyMotionPose({ bodyMotion: { kind: 'rigid-spin', radiansPerSecond: 100, travelGain: 0 } }),
  );
});
