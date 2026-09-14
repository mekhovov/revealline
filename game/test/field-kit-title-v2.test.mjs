import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  prepareTitlePixels,
  prepareFieldKitTitleV2,
} from '../../scripts/prepare-field-kit-title-v2.mjs';
import { decodeRGB } from '../../scripts/prepare-field-kit-scenes.mjs';
import { REVEAL_PALETTE } from '../../scripts/prepare-field-kit-reveals.mjs';
import { ASSET_SLOTS } from '../presentation/catalog.mjs';

const root = new URL('../../', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('title preparation keeps the original RGB, exact 3x clusters, both aspect ratios and shared reveal palette', () => {
  const source = {
    width: 4,
    height: 4,
    rgb: Uint8Array.from(Array.from({ length: 48 }, (_, i) => (i * 29) % 256)),
  };
  const before = source.rgb.slice();
  for (const [width, height] of [
    [960, 540],
    [540, 960],
  ]) {
    const image = prepareTitlePixels(source, width, height);
    assert.deepEqual(source.rgb, before);
    assert.equal(image.preparation.logicalWidth, width / 3);
    assert.equal(image.preparation.logicalHeight, height / 3);
    assert.deepEqual(image.preparation.clippedEdgePixels, { right: 0, bottom: 0 });
    assert.ok(image.preparation.usedColors.every((color) => REVEAL_PALETTE.includes(color)));
    for (let y = 0; y < height; y += 3)
      for (let x = 0; x < width; x += 3) {
        const start = (y * width + x) * 3;
        for (let dy = 0; dy < 3; dy++)
          for (let dx = 0; dx < 3; dx++) {
            const at = ((y + dy) * width + x + dx) * 3;
            assert.deepEqual(image.rgb.subarray(at, at + 3), image.rgb.subarray(start, start + 3));
          }
      }
  }
  assert.throws(() => prepareTitlePixels(source, 960, 541));
});

test('title v2 reproduces exactly and preserves original sources, historical v1 outputs and their manifest bytes', async () => {
  const manifest = await prepareFieldKitTitleV2({ checkOnly: true });
  assert.equal(manifest.records.length, 2);
  assert.equal(
    hash(await readFile(new URL(manifest.previousManifest.path, root))),
    manifest.previousManifest.sha256,
  );
  for (const record of manifest.records) {
    const source = await readFile(new URL(record.source.path, root));
    const previous = await readFile(new URL(record.previous.path, root));
    const bytes = await readFile(new URL(record.output.path, root));
    assert.equal(hash(source), record.source.sha256);
    assert.equal(hash(previous), record.previous.sha256);
    assert.equal(hash(bytes), record.output.sha256);
    assert.notEqual(record.output.sha256, record.previous.sha256);
    const decoded = decodeRGB(bytes),
      slot = ASSET_SLOTS.find((slot) => slot.id === record.slotId);
    assert.deepEqual({ width: decoded.width, height: decoded.height }, slot.dimensions);
    assert.equal(hash(decoded.rgb), record.output.pixelsSha256);
    assert.ok(bytes.length <= slot.budget.maxBytes);
    assert.equal(record.quality.stage, 'produced');
  }
});
