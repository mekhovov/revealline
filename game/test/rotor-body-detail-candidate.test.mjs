import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { FIELD_KIT_COLORS } from '../presentation/pixel-art.mjs';
import {
  candidatePixelArtForSlot,
  FIELD_KIT_CANDIDATE_RIGS,
} from '../presentation/rotor-candidate-art.mjs';
import {
  detailedCandidatePixelArtForSlot,
  FIELD_KIT_BODY_DETAIL_ROLES,
} from '../presentation/rotor-body-detail-art.mjs';
import { produceRotorBodyDetails } from '../../scripts/produce-rotor-body-details.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  color = (hex) =>
    [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).concat(255),
  rgbaAt = (pixels, width, x, y) => [
    ...pixels.subarray((y * width + x) * 4, (y * width + x) * 4 + 4),
  ];

test('reference-v3 preserves all sixteen reference-v2 source rasters', () => {
  const hash = createHash('sha256');
  for (const role of Object.keys(FIELD_KIT_CANDIDATE_RIGS))
    for (const [treatment, size] of [
      ['compact', 32],
      ['detailed', 64],
    ]) {
      hash.update(`${role}:${treatment}`);
      hash.update(
        candidatePixelArtForSlot(role.startsWith('enemy.') ? role : `player.${role}.${treatment}`, {
          size,
        }).rgba,
      );
    }
  assert.equal(
    hash.digest('hex'),
    'de313bd2f531b3d88436d440cef29a934bb5a505795d75d8a88880f6203b4244',
  );
});

for (const role of FIELD_KIT_BODY_DETAIL_ROLES)
  for (const treatment of ['compact', 'detailed']) {
    const slot = `player.${role}.${treatment}`;
    test(`${slot}: binary native pixels, palette, attached small motors and clean rotor clearance`, () => {
      const image = detailedCandidatePixelArtForSlot(slot),
        size = treatment === 'compact' ? 32 : 64,
        palette = new Set(Object.values(FIELD_KIT_COLORS).map((hex) => color(hex).join(',')));
      assert.equal(image.width, size);
      assert.equal(image.height, size);
      assert.equal(image.rgba.length, size * size * 4);
      assert.notEqual(sha256(image.rgba), sha256(candidatePixelArtForSlot(slot).rgba));
      const used = new Set();
      for (let offset = 0; offset < image.rgba.length; offset += 4) {
        const alpha = image.rgba[offset + 3];
        assert.ok(alpha === 0 || alpha === 255);
        if (alpha) {
          const rgba = [...image.rgba.subarray(offset, offset + 4)].join(',');
          assert.ok(palette.has(rgba));
          used.add(rgba);
        } else assert.deepEqual([...image.rgba.subarray(offset, offset + 4)], [0, 0, 0, 0]);
      }
      assert.ok(used.size <= 12);
      // Test nearest pixel-cell boundary, not just centers: equipment must stay
      // outside the entire blade disks even when viewed at another angle.
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          if (image.layers.equipment[(y * size + x) * 4 + 3])
            for (const hub of FIELD_KIT_CANDIDATE_RIGS[role]) {
              const hx = hub.x * size,
                hy = hub.y * size,
                dx = Math.max(x - hx, 0, hx - x - 1),
                dy = Math.max(y - hy, 0, hy - y - 1);
              assert.ok(
                Math.hypot(dx, dy) >= hub.radius * size,
                `${slot}: equipment ${x},${y} enters rotor ${hx},${hy}`,
              );
            }
      // Eight-neighbour native clusters must form one connected silhouette;
      // detached corner ornaments or floating camera/antenna pixels fail.
      const remaining = new Set();
      for (let index = 0; index < size * size; index++)
        if (image.rgba[index * 4 + 3]) remaining.add(index);
      const pending = [remaining.values().next().value];
      remaining.delete(pending[0]);
      while (pending.length) {
        const current = pending.pop(),
          cx = current % size,
          cy = Math.floor(current / size);
        for (const dx of [-1, 0, 1])
          for (const dy of [-1, 0, 1]) {
            const x = cx + dx,
              y = cy + dy,
              index = y * size + x;
            if (x >= 0 && x < size && y >= 0 && y < size && remaining.delete(index))
              pending.push(index);
          }
      }
      assert.equal(remaining.size, 0, 'one connected native silhouette');
      const radius = size / 32;
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          if (image.layers.motors[(y * size + x) * 4 + 3])
            assert.ok(
              FIELD_KIT_CANDIDATE_RIGS[role].some(
                (hub) =>
                  Math.abs(x - hub.x * size) <= radius && Math.abs(y - hub.y * size) <= radius,
              ),
              'every motor pixel stays in its small housing',
            );
      for (const hub of FIELD_KIT_CANDIDATE_RIGS[role]) {
        const x = hub.x * size,
          y = hub.y * size;
        assert.deepEqual(rgbaAt(image.rgba, size, x, y), color(FIELD_KIT_COLORS.amber));
        assert.equal(
          image.layers.structure[(y * size + x) * 4 + 3],
          255,
          'arm reaches exact motor anchor',
        );
        assert.equal(
          image.layers.motors[(y * size + x + radius + 1) * 4 + 3],
          0,
          'motor does not grow into a baked blade',
        );
        assert.ok(
          2 * hub.radius * size >= (2 * radius + 1) * 3.2 - 1e-9,
          'blade diameter remains dominant',
        );
      }
      for (const [x, y] of [
        [0, 0],
        [size - 1, 0],
        [0, size - 1],
        [size - 1, size - 1],
      ])
        assert.equal(image.rgba[(y * size + x) * 4 + 3], 0, 'no detached corner markings');
      const cyan = color(FIELD_KIT_COLORS.cyan);
      assert.deepEqual(
        rgbaAt(image.rgba, size, (15 * size) / 32, (6 * size) / 32),
        cyan,
        'front camera shows north',
      );
      assert.notDeepEqual(
        rgbaAt(image.rgba, size, (16 * size) / 32, (27 * size) / 32),
        cyan,
        'rear antenna is not a second camera',
      );
    });
  }

test('detailed drawings use native subclusters rather than scaling the compact sprites', () => {
  for (const role of FIELD_KIT_BODY_DETAIL_ROLES) {
    const detailed = detailedCandidatePixelArtForSlot(`player.${role}.detailed`);
    let differingBlocks = 0;
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const a = rgbaAt(detailed.rgba, 64, x * 2, y * 2);
        if (
          [
            rgbaAt(detailed.rgba, 64, x * 2 + 1, y * 2),
            rgbaAt(detailed.rgba, 64, x * 2, y * 2 + 1),
            rgbaAt(detailed.rgba, 64, x * 2 + 1, y * 2 + 1),
          ].some((b) => b.join(',') !== a.join(','))
        )
          differingBlocks++;
      }
    assert.ok(
      differingBlocks > 20,
      `${role}: detailed body adds native half-grid material clusters`,
    );
  }
});

test('finite cohort reproduces four tiny PNGs and exact inherited rigs', async () => {
  const result = await produceRotorBodyDetails({ check: true }),
    manifest = JSON.parse(
      await readFile(
        new URL(
          '../../authoring/library/fpv-body-detail-candidates/manifest.json',
          import.meta.url,
        ),
        'utf8',
      ),
    );
  assert.equal(result.assets, 4);
  assert.ok(result.bytes < 8192);
  assert.equal(manifest.status, 'source-candidate-not-runtime-default');
  for (const asset of manifest.assets) {
    assert.deepEqual(
      asset.geometry.rotorAnchors,
      FIELD_KIT_CANDIDATE_RIGS[asset.slot.split('.')[1]],
    );
    assert.deepEqual(asset.geometry.pivot, { x: 0.5, y: 0.5 });
    assert.equal(asset.assetRevision.quality.stage, 'produced');
  }
});

test('unsupported roles and non-native sizes fail instead of substituting art', () => {
  assert.throws(
    () => detailedCandidatePixelArtForSlot('player.bomber.compact'),
    /No body-detail candidate/,
  );
  assert.throws(
    () => detailedCandidatePixelArtForSlot('player.scout.compact', { size: 128 }),
    /native 32 or 64/,
  );
});
