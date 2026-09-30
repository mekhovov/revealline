import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { FIELD_KIT_COLORS } from '../presentation/pixel-art.mjs';
import { FIELD_KIT_CANDIDATE_RIGS } from '../presentation/rotor-candidate-art.mjs';
import { detailedCandidatePixelArtForSlot } from '../presentation/rotor-body-detail-art.mjs';
import { contrastCandidatePixelArtForSlot } from '../presentation/rotor-body-contrast-art.mjs';
import {
  opticalCandidatePixelArtForSlot,
  FIELD_KIT_BODY_OPTICAL_VERSION,
  FIELD_KIT_BODY_OPTICAL_ROLES,
} from '../presentation/rotor-body-optical-art.mjs';
import { produceRotorBodyOptical } from '../../scripts/produce-rotor-body-optical.mjs';
import { inspectSprite } from '../../scripts/produce-field-kit-sprites.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { actorImagePaintMetrics } from '../ui/actor-presentation.mjs';

const root = new URL('../../', import.meta.url),
  sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  read = (path) => readFile(new URL(path, root)),
  manifestPath = 'authoring/library/fpv-body-optical-candidates/manifest.json',
  previousManifestPath = 'authoring/library/fpv-body-detail-candidates/manifest.json',
  rgbaAt = (image, x, y) =>
    image.rgba.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4),
  color = (hex) =>
    [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).concat(255);

for (const treatment of ['compact', 'detailed'])
  test(`Scout ${treatment}: native equipment widens without changing camera, arms, motors or overall framing`, () => {
    const slot = `player.scout.${treatment}`,
      original = detailedCandidatePixelArtForSlot(slot),
      before = sha256(original.rgba),
      candidate = opticalCandidatePixelArtForSlot(slot),
      size = treatment === 'compact' ? 32 : 64,
      scale = size / 32;
    assert.equal(candidate.width, size);
    assert.equal(candidate.height, size);
    assert.equal(candidate.rgba.length, size * size * 4);
    assert.notEqual(sha256(candidate.rgba), before);
    assert.equal(sha256(original.rgba), before, 'The retained source construction is not mutated.');
    assert.deepEqual(candidate.layers.structure, original.layers.structure);
    assert.deepEqual(candidate.layers.motors, original.layers.motors);
    assert.deepEqual(
      inspectSprite(candidate).occupiedBounds,
      inspectSprite(original).occupiedBounds,
    );
    const used = new Set();
    let addedPixels = 0;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const pixel = rgbaAt(candidate, x, y),
          previous = rgbaAt(original, x, y),
          offset = (y * size + x) * 4,
          newEquipment =
            candidate.layers.equipment[offset + 3] && !original.layers.equipment[offset + 3];
        assert.ok(pixel[3] === 0 || pixel[3] === 255);
        if (x < 12 * scale || x >= 20 * scale || y < 12 * scale || y >= 20 * scale)
          assert.deepEqual(
            pixel,
            previous,
            'Only the authored central equipment region may change.',
          );
        if (previous[3]) assert.equal(pixel[3], 255, 'Existing structural pixels remain attached.');
        if (pixel[3] && !previous[3]) addedPixels++;
        if (pixel[3]) {
          const hex =
            '#' + [...pixel.subarray(0, 3)].map((c) => c.toString(16).padStart(2, '0')).join('');
          assert.ok(Object.values(FIELD_KIT_COLORS).includes(hex));
          assert.notEqual(hex, FIELD_KIT_COLORS.white, 'No white reticles or body marks.');
          used.add(hex);
        } else assert.deepEqual([...pixel], [0, 0, 0, 0]);
        if (candidate.layers.equipment[offset + 3])
          for (const hub of FIELD_KIT_CANDIDATE_RIGS.scout) {
            const hx = hub.x * size,
              hy = hub.y * size,
              dx = Math.max(x - hx, 0, hx - x - 1),
              dy = Math.max(y - hy, 0, hy - y - 1),
              distance = Math.hypot(dx, dy);
            // Nominal disks contain the shared prepared swept-blade polygons,
            // tips and blur. Check nearest pixel-cell edges, not pixel centers.
            assert.ok(
              distance >= hub.radius * size,
              `Equipment ${x},${y} enters rotor ${hx},${hy}.`,
            );
            if (newEquipment)
              assert.ok(
                distance >= (hub.radius * size * Math.sqrt(32)) / 5,
                'New shoulders also clear the conservative reserved sizing envelope.',
              );
          }
      }
    assert.equal(
      addedPixels,
      4 * scale * scale,
      'Only the two restrained middle shoulders extend the silhouette.',
    );
    assert.ok(used.size <= 12);
    assert.deepEqual([...rgbaAt(candidate, 15 * scale, 6 * scale)], color(FIELD_KIT_COLORS.cyan));
    assert.deepEqual(
      rgbaAt(candidate, 16 * scale, 27 * scale),
      rgbaAt(original, 16 * scale, 27 * scale),
    );
  });

function longestAmberRun(image) {
  const scale = image.width / 32,
    amber = color(FIELD_KIT_COLORS.amber).join(',');
  let longest = 0,
    current = 0;
  for (let x = 12 * scale; x < 20 * scale; x++) {
    current = [...rgbaAt(image, x, 16 * scale)].join(',') === amber ? current + 1 : 0;
    longest = Math.max(current, longest);
  }
  return longest / scale;
}

test('a five-to-six native-pixel amber face remains broader at actual 20/24/32 CSS envelopes without upsizing actors', async () => {
  const manifest = JSON.parse(await read(manifestPath)),
    previous = JSON.parse(await read(previousManifestPath));
  for (const asset of manifest.assets) {
    const image = opticalCandidatePixelArtForSlot(asset.slot),
      old = contrastCandidatePixelArtForSlot(asset.slot),
      oldRecord = previous.assets.find((entry) => entry.slot === asset.slot),
      width = longestAmberRun(image),
      oldWidth = longestAmberRun(old);
    assert.equal(width, asset.treatment === 'compact' ? 6 : 5);
    assert.ok(
      width >= oldWidth * 2,
      'Material width improves independently of rotor/frame scaling.',
    );
    for (const diameter of [20, 24, 32]) {
      const metrics = actorImagePaintMetrics(diameter, imagePresentation(asset.assetRevision)),
        oldMetrics = actorImagePaintMetrics(diameter, imagePresentation(oldRecord.assetRevision));
      assert.deepEqual(
        metrics,
        oldMetrics,
        'Comparison preserves the same occupied rotor envelope.',
      );
      assert.ok((metrics.width * width) / 32 > (metrics.width * oldWidth) / 32);
      assert.ok((metrics.width * width) / 32 >= diameter * 0.16);
    }
  }
});

test('detailed face uses deliberate native half-grid clusters instead of a doubled compact raster', () => {
  const image = opticalCandidatePixelArtForSlot('player.scout.detailed');
  let distinct = 0;
  for (let y = 12; y < 20; y++)
    for (let x = 12; x < 20; x++) {
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
  assert.ok(distinct >= 12, 'The newly authored equipment has native detail.');
});

test('every retained v2/v3/v4 cohort and construction source keeps its frozen bytes', async () => {
  for (const [path, expected] of [
    [
      'authoring/library/fpv-proportion-candidates/manifest.json',
      '6972504ddd2a90ed791919a04d1e17cda3966c44ff7325e5d512abdecf6b70a2',
    ],
    [previousManifestPath, 'cb7a37ec5de7df3b9563bb81d3c2f4e280042cabd5d7e475a2a110469f6f91b9'],
    [
      'authoring/library/fpv-body-contrast-candidates/manifest.json',
      'e35338bcb4bceda1c39c125ede9cb44608344d46c90f5acb62b0f33cbedbaf1a',
    ],
  ]) {
    const bytes = await read(path),
      manifest = JSON.parse(bytes);
    assert.equal(sha256(bytes), expected, path);
    const sources = manifest.sources ?? { [manifest.source]: manifest.sourceSha256 };
    for (const [source, hash] of Object.entries(sources))
      assert.equal(sha256(await read(source)), hash, source);
    for (const asset of manifest.assets)
      assert.equal(sha256(await read(asset.path)), asset.sha256, asset.path);
  }
});

test('new source-only records reproduce and declare exact native geometry and all construction dependencies', async () => {
  const result = await produceRotorBodyOptical({ check: true }),
    manifest = JSON.parse(await read(manifestPath)),
    previous = JSON.parse(await read(previousManifestPath));
  assert.equal(result.assets, 2);
  assert.ok(result.bytes < 2048);
  assert.equal(FIELD_KIT_BODY_OPTICAL_VERSION, 'reference-v5');
  assert.deepEqual(FIELD_KIT_BODY_OPTICAL_ROLES, ['scout']);
  assert.equal(manifest.format, 'revealline.rotor-body-detail-candidates.v1');
  assert.equal(manifest.construction, 'reference-v5');
  assert.equal(manifest.status, 'source-candidate-not-runtime-default');
  for (const field of ['referenceConcept', 'referenceReview', 'referenceUse'])
    assert.equal(manifest[field], previous[field]);
  assert.deepEqual(Object.keys(manifest.sources), [
    'game/presentation/rotor-body-optical-art.mjs',
    'game/presentation/rotor-body-detail-art.mjs',
    'game/presentation/rotor-candidate-art.mjs',
    'game/presentation/pixel-art.mjs',
  ]);
  for (const [path, hash] of Object.entries(manifest.sources))
    assert.equal(sha256(await read(path)), hash);
  for (const asset of manifest.assets) {
    const old = previous.assets.find((entry) => entry.slot === asset.slot);
    assert.equal(asset.id, `candidate.reference-v5.scout.${asset.treatment}`);
    assert.equal(asset.assetRevision.id, asset.id);
    assert.equal(asset.assetRevision.quality.stage, 'produced');
    assert.deepEqual(asset.geometry, old.geometry);
    assert.deepEqual(asset.assetRevision.geometry, old.assetRevision.geometry);
    assert.deepEqual(imagePresentation(asset.assetRevision), imagePresentation(old.assetRevision));
    assert.notEqual(asset.path, old.path);
    assert.notEqual(asset.sha256, old.sha256);
  }
});

test('unsupported roles and nonnative frames cannot receive the Scout optical study', () => {
  assert.throws(() => opticalCandidatePixelArtForSlot('player.carrier.compact'), /No body-optical/);
  assert.throws(
    () => opticalCandidatePixelArtForSlot('player.scout.compact', { size: 48 }),
    /native 32 or 64/,
  );
});
