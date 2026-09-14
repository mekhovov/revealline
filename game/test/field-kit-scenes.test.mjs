import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { nearestSceneFrame, encodeScenePNG } from '../../scripts/prepare-field-kit-scenes.mjs';
import { decodeOriginalPNG } from '../../authoring/library/four-worlds-chapters/verify-images.mjs';

test('scene preparation uses the declared center crop without blending pixels or editing the source', () => {
  const rgb = Uint8Array.from({ length: 24 }, (_, i) => i);
  const source = { width: 4, height: 2, rgb };
  const before = rgb.slice();
  const result = nearestSceneFrame(source, 2, 2);
  assert.deepEqual(result.crop, { x: 1, y: 0, width: 2, height: 2 });
  assert.deepEqual([...result.rgb], [3, 4, 5, 6, 7, 8, 15, 16, 17, 18, 19, 20]);
  assert.deepEqual(source.rgb, before);
  const png = encodeScenePNG(result);
  const decoded = decodeOriginalPNG('data:image/png;base64,' + png.toString('base64'));
  assert.equal(decoded.naturalWidth, 2);
  assert.equal(decoded.naturalHeight, 2);
  assert.equal(decoded.pixelsSha256, createHash('sha256').update(result.rgb).digest('hex'));
  assert.throws(() => nearestSceneFrame(source, 0, 2), /target/);
  assert.throws(() => nearestSceneFrame(source, 2000, 2), /target/);
});
