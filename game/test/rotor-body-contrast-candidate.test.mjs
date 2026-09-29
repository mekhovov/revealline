import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { FIELD_KIT_COLORS } from '../presentation/pixel-art.mjs';
import { FIELD_KIT_CANDIDATE_RIGS } from '../presentation/rotor-candidate-art.mjs';
import { detailedCandidatePixelArtForSlot } from '../presentation/rotor-body-detail-art.mjs';
import {
  contrastCandidatePixelArtForSlot,
  FIELD_KIT_BODY_CONTRAST_VERSION,
  FIELD_KIT_BODY_CONTRAST_ROLES,
} from '../presentation/rotor-body-contrast-art.mjs';
import { produceRotorBodyContrast } from '../../scripts/produce-rotor-body-contrast.mjs';
import { produceRotorBodyDetails } from '../../scripts/produce-rotor-body-details.mjs';
import { inspectSprite } from '../../scripts/produce-field-kit-sprites.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';

const root = new URL('../../', import.meta.url),
  sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  read = (path) => readFile(new URL(path, root)),
  manifestPath = 'authoring/library/fpv-body-contrast-candidates/manifest.json',
  previousManifestPath = 'authoring/library/fpv-body-detail-candidates/manifest.json',
  rgbaAt = (image, x, y) =>
    image.rgba.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4);

for (const treatment of ['compact', 'detailed'])
  test(`Scout ${treatment}: native palette and exact silhouette, motors, camera and rig clearance`, () => {
    const slot = `player.scout.${treatment}`,
      original = detailedCandidatePixelArtForSlot(slot),
      before = sha256(original.rgba),
      candidate = contrastCandidatePixelArtForSlot(slot),
      size = treatment === 'compact' ? 32 : 64,
      scale = size / 32;
    assert.equal(candidate.width, size);
    assert.equal(candidate.height, size);
    assert.equal(candidate.rgba.length, size * size * 4);
    assert.notEqual(sha256(candidate.rgba), before);
    assert.equal(sha256(original.rgba), before, 'The old constructed frame is not modified.');
    assert.deepEqual(candidate.layers.structure, original.layers.structure);
    assert.deepEqual(candidate.layers.motors, original.layers.motors);
    assert.deepEqual(
      inspectSprite(candidate).occupiedBounds,
      inspectSprite(original).occupiedBounds,
    );
    const used = new Set();
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const pixel = rgbaAt(candidate, x, y),
          previous = rgbaAt(original, x, y);
        assert.ok(pixel[3] === 0 || pixel[3] === 255);
        assert.equal(
          pixel[3],
          previous[3],
          'Every occupied/transparent silhouette pixel stays exact.',
        );
        if (x < 14 * scale || x >= 18 * scale || y < 12 * scale || y >= 20 * scale)
          assert.deepEqual(pixel, previous, 'Only the authored central battery face may change.');
        if (pixel[3]) {
          const hex =
            '#' + [...pixel.subarray(0, 3)].map((c) => c.toString(16).padStart(2, '0')).join('');
          assert.ok(Object.values(FIELD_KIT_COLORS).includes(hex));
          assert.notEqual(hex, FIELD_KIT_COLORS.white, 'No white corner or body markings added.');
          used.add(hex);
        } else assert.deepEqual([...pixel], [0, 0, 0, 0]);
        if (candidate.layers.equipment[(y * size + x) * 4 + 3])
          for (const hub of FIELD_KIT_CANDIDATE_RIGS.scout) {
            const hx = hub.x * size,
              hy = hub.y * size,
              dx = Math.max(x - hx, 0, hx - x - 1),
              dy = Math.max(y - hy, 0, hy - y - 1);
            assert.ok(
              Math.hypot(dx, dy) >= hub.radius * size,
              'The complete rotor disks stay clear.',
            );
          }
      }
    assert.ok(used.size <= 12);
  });

const linearLuminance = (pixel) =>
  [...pixel.subarray(0, 3)].reduce((sum, byte, index) => {
    const c = byte / 255;
    return (
      sum +
      (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index]
    );
  }, 0);
const faceLuminance = (image) => {
  const scale = image.width / 32;
  let sum = 0;
  for (let y = 12 * scale; y < 20 * scale; y++)
    for (let x = 14 * scale; x < 18 * scale; x++) sum += linearLuminance(rgbaAt(image, x, y));
  return sum / (32 * scale * scale);
};

test('central material has greater measured luminance while retaining its dark side, not an art approval', () => {
  for (const treatment of ['compact', 'detailed']) {
    const slot = `player.scout.${treatment}`,
      old = detailedCandidatePixelArtForSlot(slot),
      candidate = contrastCandidatePixelArtForSlot(slot),
      scale = candidate.width / 32;
    assert.ok(faceLuminance(candidate) > faceLuminance(old) * 1.5);
    assert.ok(
      linearLuminance(rgbaAt(candidate, (17.5 * scale) | 0, 16 * scale)) < 0.1,
      'A dark shaded side remains available over light artwork.',
    );
  }
});

test('detailed battery adds native half-grid material detail instead of copying enlarged compact pixels', () => {
  const image = contrastCandidatePixelArtForSlot('player.scout.detailed');
  let distinct = 0;
  for (let y = 12; y < 20; y++)
    for (let x = 14; x < 18; x++) {
      const first = rgbaAt(image, x * 2, y * 2);
      if (
        [
          [1, 0],
          [0, 1],
          [1, 1],
        ].some(
          ([dx, dy]) => [...rgbaAt(image, x * 2 + dx, y * 2 + dy)].join() !== [...first].join(),
        )
      )
        distinct++;
    }
  assert.ok(
    distinct >= 8,
    'Native detail exists inside the revised battery, not only inherited arms.',
  );
});

test('all retained v3 bytes and transitive original construction sources remain exact', async () => {
  assert.equal(
    sha256(await read(previousManifestPath)),
    'cb7a37ec5de7df3b9563bb81d3c2f4e280042cabd5d7e475a2a110469f6f91b9',
  );
  const previous = JSON.parse(await read(previousManifestPath));
  for (const [path, hash] of Object.entries(previous.sources))
    assert.equal(sha256(await read(path)), hash, path);
  for (const asset of previous.assets)
    assert.equal(sha256(await read(asset.path)), asset.sha256, asset.path);
  assert.equal((await produceRotorBodyDetails({ check: true })).assets, 4);
});

test('two new source-only records reproduce with exact original geometry and every construction dependency', async () => {
  const result = await produceRotorBodyContrast({ check: true }),
    manifest = JSON.parse(await read(manifestPath)),
    previous = JSON.parse(await read(previousManifestPath));
  assert.equal(result.assets, 2);
  assert.ok(result.bytes < 2048);
  assert.equal(FIELD_KIT_BODY_CONTRAST_VERSION, 'reference-v4');
  assert.deepEqual(FIELD_KIT_BODY_CONTRAST_ROLES, ['scout']);
  assert.equal(manifest.format, 'revealline.rotor-body-detail-candidates.v1');
  assert.equal(manifest.construction, 'reference-v4');
  assert.equal(manifest.status, 'source-candidate-not-runtime-default');
  for (const field of ['referenceConcept', 'referenceReview', 'referenceUse'])
    assert.equal(manifest[field], previous[field]);
  assert.deepEqual(Object.keys(manifest.sources), [
    'game/presentation/rotor-body-contrast-art.mjs',
    'game/presentation/rotor-body-detail-art.mjs',
    'game/presentation/rotor-candidate-art.mjs',
    'game/presentation/pixel-art.mjs',
  ]);
  for (const [path, hash] of Object.entries(manifest.sources))
    assert.equal(sha256(await read(path)), hash);
  for (const asset of manifest.assets) {
    const old = previous.assets.find((entry) => entry.slot === asset.slot);
    assert.equal(asset.id, `candidate.reference-v4.scout.${asset.treatment}`);
    assert.equal(asset.assetRevision.id, asset.id);
    assert.equal(asset.assetRevision.quality.stage, 'produced');
    assert.deepEqual(asset.geometry, old.geometry);
    assert.deepEqual(asset.assetRevision.geometry, old.assetRevision.geometry);
    assert.deepEqual(imagePresentation(asset.assetRevision), imagePresentation(old.assetRevision));
    assert.notEqual(asset.path, old.path);
    assert.notEqual(asset.sha256, old.sha256);
  }
});

test('unsupported roles or nonnative frames cannot silently receive the Scout study', () => {
  assert.throws(
    () => contrastCandidatePixelArtForSlot('player.carrier.compact'),
    /No body-contrast/,
  );
  assert.throws(
    () => contrastCandidatePixelArtForSlot('player.scout.compact', { size: 48 }),
    /native 32 or 64/,
  );
});
