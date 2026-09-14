import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  prepareRevealPixels,
  prepareFieldKitReveals,
  resolveRevealSources,
  REVEAL_PALETTE,
} from '../../scripts/prepare-field-kit-reveals.mjs';
import { decodeRGB, encodeScenePNG } from '../../scripts/prepare-field-kit-scenes.mjs';
import { ASSET_SLOTS } from '../presentation/catalog.mjs';
import { revealReviewURLs } from '../../authoring/library/fpv-field-kit/prepared/reveals/review.mjs';
const root = new URL('../../', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pixel = (image, x, y) =>
  Array.from(image.rgb.subarray((y * image.width + x) * 3, (y * image.width + x) * 3 + 3));
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test('reveal preparation preserves source pixels and emits exact opaque native frames with whole integer clusters', () => {
  const colors = REVEAL_PALETTE.slice(0, 6).map(rgb),
    source = {
      width: 6,
      height: 4,
      rgb: Uint8Array.from(Array.from({ length: 24 }, (_, i) => colors[i % 6]).flat()),
    };
  const before = source.rgb.slice();
  for (const [width, height, scale] of [
    [768, 576, 2],
    [1152, 576, 3],
    [1774, 887, 4],
  ]) {
    const image = prepareRevealPixels(source, width, height);
    assert.equal(image.rgb.length, width * height * 3);
    assert.equal(image.preparation.integerScale, scale);
    assert.deepEqual(image.preparation.clippedEdgePixels, {
      right: Math.ceil(width / scale) * scale - width,
      bottom: Math.ceil(height / scale) * scale - height,
    });
    for (let y = 0; y < height; y += scale)
      for (let x = 0; x < width; x += scale) {
        assert.deepEqual(
          pixel(image, Math.min(x + scale - 1, width - 1), Math.min(y + scale - 1, height - 1)),
          pixel(image, x, y),
        );
      }
    assert.ok(image.preparation.usedColors.every((color) => REVEAL_PALETTE.includes(color)));
    const decoded = decodeRGB(encodeScenePNG(image));
    assert.deepEqual(decoded.rgb, image.rgb);
  }
  assert.deepEqual(source.rgb, before);
});

test('explicit crop chooses the intended pixels, retains a recorded rectangle, and rejects out-of-source geometry', () => {
  const source = {
    width: 4,
    height: 4,
    rgb: Uint8Array.from(
      Array.from({ length: 16 }, (_, i) => rgb(i < 8 ? '#070b12' : '#f3f0db')).flat(),
    ),
  };
  const crop = { x: 0, y: 2, width: 4, height: 2 };
  const image = prepareRevealPixels(source, 16, 8, { crop });
  assert.deepEqual(image.preparation.sourceCrop, crop);
  assert.deepEqual(pixel(image, 0, 0), rgb('#f3f0db'));
  assert.deepEqual(pixel(image, 15, 7), rgb('#f3f0db'));
  assert.throws(() => prepareRevealPixels(source, 16, 8, { crop: { ...crop, x: -1 } }));
  assert.throws(() => prepareRevealPixels(source, 16, 8, { crop: { ...crop, height: 3 } }));
  assert.throws(() => prepareRevealPixels(source, 16.5, 8));
  assert.throws(() => prepareRevealPixels(source, 2000, 8));
});

test('prepared reveal manifest preserves exact source pins, full prompts, every produced owner frame and deterministic bytes', async () => {
  const manifest = await prepareFieldKitReveals({ checkOnly: true });
  const known = new Map(ASSET_SLOTS.map((slot) => [slot.id, slot])),
    seen = new Set();
  assert.equal(manifest.planned.compositions, 38);
  assert.equal(manifest.planned.exports, 44);
  assert.equal(manifest.planned.owners, 56);
  assert.equal(manifest.produced.compositions, 38);
  assert.equal(manifest.produced.exports, 44);
  assert.equal(manifest.produced.owners, 56);
  assert.deepEqual(manifest.missingCompositions, []);
  assert.equal(
    manifest.produced.totalPNGBytes,
    manifest.assets.reduce((n, asset) => n + asset.file.bytes, 0),
  );
  for (const asset of manifest.assets) {
    assert.equal(asset.quality.stage, 'produced');
    assert.ok(
      asset.provenance.prompt.length >= 100 && asset.provenance.prompt.includes('Reveal Line'),
    );
    const source = await readFile(new URL(asset.provenance.source.path, root));
    assert.equal(hash(source), asset.provenance.source.sha256);
    assert.equal(source.length, asset.provenance.source.bytes);
    const bytes = await readFile(new URL(asset.file.path, root));
    assert.equal(hash(bytes), asset.file.sha256);
    assert.equal(bytes.length, asset.file.bytes);
    const decoded = decodeRGB(bytes);
    assert.equal(hash(decoded.rgb), asset.file.pixelsSha256);
    assert.deepEqual(asset.geometry.occupiedBounds, { x: 0, y: 0, width: 1, height: 1 });
    for (const id of asset.slotIds) {
      assert.ok(!seen.has(id), `${id}: one exact produced binding`);
      seen.add(id);
      assert.deepEqual(known.get(id).dimensions, { width: decoded.width, height: decoded.height });
      assert.ok(bytes.length <= known.get(id).budget.maxBytes);
    }
  }
  assert.equal(seen.size, manifest.produced.owners);
});

test('edited reveal sources retain exact parent pins and cannot overwrite originals or fork stale revisions', () => {
  const original = {
    id: 'scene-example',
    source: { path: 'original.png', sha256: 'a'.repeat(64), bytes: 10, width: 4, height: 3 },
  };
  const edit = {
    id: original.id,
    revision: 2,
    supersedes: structuredClone(original.source),
    source: {
      ...original.source,
      path: 'authoring/library/fpv-field-kit/originals/reveals/scene-example-v2.png',
      sha256: 'b'.repeat(64),
    },
    prompt: 'Create an original Reveal Line pixel-art refinement. '.repeat(3),
  };
  const before = structuredClone(original);
  assert.deepEqual(resolveRevealSources([original], [edit]).get(original.id), edit);
  assert.deepEqual(original, before);
  for (const wrong of [
    { ...edit, revision: 3 },
    { ...edit, id: 'missing' },
    { ...edit, source: original.source },
    { ...edit, supersedes: { ...original.source, sha256: 'c'.repeat(64) } },
  ])
    assert.throws(() => resolveRevealSources([original], [wrong]), /Reveal/);
  assert.throws(() => resolveRevealSources([original], [edit, edit]), /parent/);
});

test('public review uses compiled hashes below a project prefix, while source access stays local and explicit', () => {
  const sha256 = 'ab'.repeat(32),
    asset = {
      file: {
        sha256,
        mime: 'image/png',
        path: 'authoring/library/fpv-field-kit/prepared/reveals/scene-signal-01-768x576-v1.png',
      },
      provenance: {
        source: {
          path: 'authoring/library/fpv-field-kit/originals/reveals/scene-signal-01-v1.png',
        },
      },
    };
  const path = '/game/authoring/library/fpv-field-kit/prepared/reveals/review.mjs';
  const publicURLs = revealReviewURLs(asset, 'https://example.github.io' + path);
  assert.equal(
    publicURLs.compiled,
    `https://example.github.io/game/game/presentation/compiled/assets/${sha256}.png`,
  );
  assert.equal(publicURLs.sourceDerivative, null);
  assert.equal(publicURLs.sourceOriginal, null);
  const local = revealReviewURLs(asset, 'http://127.0.0.1:9042' + path);
  assert.equal(local.sourceDerivative, 'http://127.0.0.1:9042/game/' + asset.file.path);
  assert.equal(local.sourceOriginal, 'http://127.0.0.1:9042/game/' + asset.provenance.source.path);
  assert.equal(
    revealReviewURLs(asset, 'https://localhost.example.com' + path).sourceDerivative,
    null,
  );
  assert.throws(() => revealReviewURLs({ ...asset, file: { ...asset.file, sha256: '../escape' } }));
  assert.throws(() =>
    revealReviewURLs({ ...asset, file: { ...asset.file, mime: 'image/svg+xml' } }),
  );
  assert.equal(
    revealReviewURLs(
      { ...asset, provenance: { source: { path: 'https://foreign.example/image.png' } } },
      'http://localhost' + path,
    ).sourceOriginal,
    null,
  );
});
