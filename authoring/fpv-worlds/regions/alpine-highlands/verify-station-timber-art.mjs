import assert from 'node:assert/strict';
import { stationTextures } from './station-materials.mjs';
import { quietStationWall } from './station-timber.mjs';
const before = stationTextures().find((t) => t.id === 'original-station-wall');
const after = quietStationWall(before),
  a = Buffer.from(before.rgbaBase64, 'base64'),
  b = Buffer.from(after.rgbaBase64, 'base64');
assert.deepEqual({ ...after, rgbaBase64: null }, { ...before, rgbaBase64: null });
assert.equal(a.length, b.length);
let originalVariation = 0,
  quietVariation = 0,
  comparisons = 0,
  protectedPixels = 0;
for (let y = 0; y < 128; y++)
  for (let x = 0; x < 256; x++) {
    const h = (1 - y / 128) * 14,
      metres = x / 32,
      p = (y * 256 + x) * 4;
    assert.equal(b[p + 3], 255);
    if (h < 1.4 || h > 13.65 || (h > 3.8 && h < 8.2 && metres > 1.7 && metres < 6.3)) {
      assert.deepEqual(b.subarray(p, p + 4), a.subarray(p, p + 4));
      protectedPixels++;
    }
    if (h > 1.5 && h < 3.7 && x > 0) {
      originalVariation += Math.abs(a[p] - a[p - 4]);
      quietVariation += Math.abs(b[p] - b[p - 4]);
      comparisons++;
    }
  }
assert(
  quietVariation < originalVariation * 0.45,
  'Lower wall horizontal variation should fall substantially',
);
assert.deepEqual(quietStationWall(before), after, 'Original artwork is deterministic');
console.log(
  JSON.stringify(
    {
      passed: true,
      pixelCount: 256 * 128,
      protectedPixels,
      comparisonPixels: comparisons,
      redChannelAdjacentVariation: {
        beforeMean: originalVariation / comparisons,
        afterMean: quietVariation / comparisons,
        ratio: quietVariation / originalVariation,
      },
      textureDimensionsAndFiltersUnchanged: true,
      opaque: true,
      scope:
        'Source pixel-art contrast comparison only; not native aliasing, performance or full representative-art acceptance.',
    },
    null,
    2,
  ),
);
