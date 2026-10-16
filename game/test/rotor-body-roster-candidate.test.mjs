import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { FIELD_KIT_COLORS } from '../presentation/pixel-art.mjs';
import { FIELD_KIT_CANDIDATE_RIGS } from '../presentation/rotor-candidate-art.mjs';
import { detailedCandidatePixelArtForSlot } from '../presentation/rotor-body-detail-art.mjs';
import { opticalCandidatePixelArtForSlot } from '../presentation/rotor-body-optical-art.mjs';
import {
  rosterCandidatePixelArtForSlot,
  FIELD_KIT_BODY_ROSTER_VERSION,
  FIELD_KIT_BODY_ROSTER_ROLES,
} from '../presentation/rotor-body-roster-art.mjs';
import { produceRotorBodyRoster } from '../../scripts/produce-rotor-body-roster.mjs';
import { inspectSprite, encodeSpritePNG } from '../../scripts/produce-field-kit-sprites.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { actorImagePaintMetrics } from '../ui/actor-presentation.mjs';

const root = new URL('../../', import.meta.url),
  read = (path) => readFile(new URL(path, root)),
  hash = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  manifestPath = 'authoring/library/fpv-body-roster-candidates/manifest.json',
  treatments = ['compact', 'detailed'],
  newRoles = ['bomber', 'interceptor', 'fiber', 'impact', 'trapper'],
  pixel = (rgba, size, x, y) => rgba.subarray((y * size + x) * 4, (y * size + x) * 4 + 4),
  alphaHash = (rgba) => hash(rgba.filter((_, index) => index % 4 === 3));

function assertConnected(image) {
  const { rgba, width: size } = image,
    occupied = new Set();
  for (let index = 0; index < size * size; index++) if (rgba[index * 4 + 3]) occupied.add(index);
  const pending = [occupied.values().next().value];
  occupied.delete(pending[0]);
  while (pending.length) {
    const index = pending.pop(),
      x = index % size,
      y = Math.floor(index / size);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx,
          ny = y + dy,
          next = ny * size + nx;
        if (nx >= 0 && ny >= 0 && nx < size && ny < size && occupied.delete(next))
          pending.push(next);
      }
  }
  assert.equal(occupied.size, 0, 'No detached equipment or decorative corner pixels.');
}

for (const role of FIELD_KIT_BODY_ROSTER_ROLES)
  for (const treatment of treatments)
    test(`${role} ${treatment}: native body is attached, palette bounded and equipment clears rotating blades`, () => {
      const image = rosterCandidatePixelArtForSlot(`player.${role}.${treatment}`),
        size = treatment === 'compact' ? 32 : 64,
        scale = size / 32,
        colors = new Set();
      assert.equal(image.width, size);
      assert.equal(image.height, size);
      assert.equal(image.rgba.length, size * size * 4);
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const p = pixel(image.rgba, size, x, y);
          assert.ok(p[3] === 0 || p[3] === 255, 'Binary native alpha.');
          if (!p[3]) assert.deepEqual([...p], [0, 0, 0, 0]);
          else {
            const color =
              '#' + [...p.subarray(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join('');
            assert.ok(Object.values(FIELD_KIT_COLORS).includes(color));
            assert.notEqual(color, FIELD_KIT_COLORS.white, 'No white reticles.');
            colors.add(color);
          }
          if (pixel(image.layers.equipment, size, x, y)[3])
            for (const rotor of FIELD_KIT_CANDIDATE_RIGS[role]) {
              const hx = rotor.x * size,
                hy = rotor.y * size,
                dx = Math.max(x - hx, 0, hx - x - 1),
                dy = Math.max(y - hy, 0, hy - y - 1);
              // Full nominal disks contain the actual shared swept blades.
              // Use nearest pixel-cell edges rather than centres or a pose.
              assert.ok(
                Math.hypot(dx, dy) >= rotor.radius * size,
                `Equipment ${x},${y} enters rotor ${hx},${hy}.`,
              );
            }
        }
      assert.ok(colors.size <= 12);
      assertConnected(image);
      assert.deepEqual(
        [...pixel(image.rgba, size, 15 * scale, 6 * scale)].slice(0, 3),
        [0x78, 0xdc, 0xe8],
        'The camera remains on the north-facing nose.',
      );
    });

for (const treatment of treatments)
  test(`${treatment}: five new equipment silhouettes preserve exact motors, frame, camera and antenna source`, () => {
    const original = detailedCandidatePixelArtForSlot(`player.scout.${treatment}`),
      originalHash = hash(original.rgba),
      size = original.width,
      scale = size / 32;
    for (const role of newRoles) {
      const candidate = rosterCandidatePixelArtForSlot(`player.${role}.${treatment}`);
      assert.deepEqual(candidate.layers.structure, original.layers.structure);
      assert.deepEqual(candidate.layers.motors, original.layers.motors);
      assert.deepEqual(
        inspectSprite(candidate).occupiedBounds,
        inspectSprite(original).occupiedBounds,
      );
      for (let y = 0; y < size; y++)
        if (y < 10 * scale || y >= 23 * scale)
          assert.deepEqual(
            candidate.rgba.subarray(y * size * 4, (y + 1) * size * 4),
            original.rgba.subarray(y * size * 4, (y + 1) * size * 4),
            'Existing camera and aft antenna pixels cannot be repainted.',
          );
      assert.notEqual(hash(candidate.rgba), originalHash);
    }
    assert.equal(hash(original.rgba), originalHash, 'Shared source results are not mutated.');
    const equipmentShapes = new Set(),
      bodyShapes = new Set();
    for (const role of FIELD_KIT_BODY_ROSTER_ROLES) {
      const image = rosterCandidatePixelArtForSlot(`player.${role}.${treatment}`);
      equipmentShapes.add(alphaHash(image.layers.equipment));
      bodyShapes.add(alphaHash(image.rgba));
    }
    assert.equal(
      equipmentShapes.size,
      7,
      'Equipment silhouette, not only colour, distinguishes every class.',
    );
    assert.equal(
      bodyShapes.size,
      7,
      'The final composed bodies retain those silhouette differences.',
    );
    for (const [role, construct] of [
      ['scout', opticalCandidatePixelArtForSlot],
      ['carrier', detailedCandidatePixelArtForSlot],
    ])
      assert.deepEqual(
        encodeSpritePNG(rosterCandidatePixelArtForSlot(`player.${role}.${treatment}`)),
        encodeSpritePNG(construct(`player.${role}.${treatment}`)),
        'Retained Scout v5 and Carrier v3 remain byte-identical.',
      );
  });

test('five new detailed bodies include original native clusters instead of enlarged compact pixels', () => {
  for (const role of newRoles) {
    const image = rosterCandidatePixelArtForSlot(`player.${role}.detailed`);
    let varied = 0;
    for (let y = 10; y < 23; y++)
      for (let x = 11; x < 21; x++) {
        const first = [...pixel(image.layers.equipment, 64, x * 2, y * 2)].join();
        if (
          [
            [1, 0],
            [0, 1],
            [1, 1],
          ].some(
            ([dx, dy]) =>
              [...pixel(image.layers.equipment, 64, x * 2 + dx, y * 2 + dy)].join() !== first,
          )
        )
          varied++;
      }
    assert.ok(varied >= 8, `${role} has deliberately drawn half-grid equipment detail.`);
  }
});

test('new roster reproduces all 14 records and declares exact rigs plus every construction dependency', async () => {
  const result = await produceRotorBodyRoster({ check: true }),
    manifest = JSON.parse(await read(manifestPath)),
    previous = JSON.parse(await read('authoring/library/fpv-body-detail-candidates/manifest.json'));
  assert.equal(result.assets, 14);
  assert.ok(result.bytes < 10000, 'Finite cohort download budget.');
  assert.equal(FIELD_KIT_BODY_ROSTER_VERSION, 'reference-v6');
  assert.deepEqual(FIELD_KIT_BODY_ROSTER_ROLES, [
    'scout',
    'bomber',
    'carrier',
    'interceptor',
    'fiber',
    'impact',
    'trapper',
  ]);
  assert.equal(manifest.format, 'revealline.rotor-body-detail-candidates.v1');
  assert.equal(manifest.construction, 'reference-v6');
  assert.equal(manifest.status, 'source-candidate-not-runtime-default');
  for (const field of ['referenceConcept', 'referenceReview', 'referenceUse'])
    assert.equal(manifest[field], previous[field]);
  assert.deepEqual(Object.keys(manifest.sources), [
    'game/presentation/rotor-body-roster-art.mjs',
    'game/presentation/rotor-body-optical-art.mjs',
    'game/presentation/rotor-body-detail-art.mjs',
    'game/presentation/rotor-candidate-art.mjs',
    'game/presentation/pixel-art.mjs',
  ]);
  for (const [path, expected] of Object.entries(manifest.sources))
    assert.equal(hash(await read(path)), expected, path);
  for (const asset of manifest.assets) {
    const role = asset.slot.split('.')[1],
      existing = previous.assets.find(
        (entry) =>
          entry.slot === `player.${role === 'carrier' ? 'carrier' : 'scout'}.${asset.treatment}`,
      ),
      geometry = imagePresentation(asset.assetRevision);
    assert.equal(asset.id, `candidate.reference-v6.${role}.${asset.treatment}`);
    assert.equal(asset.assetRevision.id, asset.id);
    assert.equal(asset.assetRevision.revision, 1);
    assert.equal(asset.assetRevision.quality.stage, 'produced');
    assert.deepEqual(asset.geometry.pivot, { x: 0.5, y: 0.5 });
    assert.deepEqual(asset.geometry.rotorAnchors, FIELD_KIT_CANDIDATE_RIGS[role]);
    assert.deepEqual(asset.geometry, existing.geometry);
    assert.deepEqual(asset.assetRevision.geometry, asset.geometry);
    assert.equal(hash(await read(asset.path)), asset.sha256);
    for (const diameter of [20, 24, 32])
      assert.deepEqual(
        actorImagePaintMetrics(diameter, geometry),
        actorImagePaintMetrics(diameter, imagePresentation(existing.assetRevision)),
        'Stronger bodies retain exact occupied-frame and moving-part sizing.',
      );
  }
});

test('every v2-v5 source and candidate image retains its immutable bytes', async () => {
  for (const [path, expected] of [
    [
      'authoring/library/fpv-proportion-candidates/manifest.json',
      '6972504ddd2a90ed791919a04d1e17cda3966c44ff7325e5d512abdecf6b70a2',
    ],
    [
      'authoring/library/fpv-body-detail-candidates/manifest.json',
      'cb7a37ec5de7df3b9563bb81d3c2f4e280042cabd5d7e475a2a110469f6f91b9',
    ],
    [
      'authoring/library/fpv-body-contrast-candidates/manifest.json',
      'e35338bcb4bceda1c39c125ede9cb44608344d46c90f5acb62b0f33cbedbaf1a',
    ],
    [
      'authoring/library/fpv-body-optical-candidates/manifest.json',
      '492955dbd35a21612b2c54b6ef520ccdbd0b4e549a97b16727ca920131ce566c',
    ],
  ]) {
    const bytes = await read(path),
      manifest = JSON.parse(bytes);
    assert.equal(hash(bytes), expected, path);
    for (const [source, fingerprint] of Object.entries(
      manifest.sources ?? { [manifest.source]: manifest.sourceSha256 },
    ))
      assert.equal(hash(await read(source)), fingerprint, source);
    for (const asset of manifest.assets)
      assert.equal(hash(await read(asset.path)), asset.sha256, asset.path);
  }
});

test('unsupported roles and nonnative sizes cannot produce roster frames', () => {
  assert.throws(
    () => rosterCandidatePixelArtForSlot('enemy.borderPatrol.compact'),
    /No body-roster/,
  );
  assert.throws(() => rosterCandidatePixelArtForSlot('player.scout.ultra'), /No body-roster/);
  assert.throws(
    () => rosterCandidatePixelArtForSlot('player.scout.compact', { size: 48 }),
    /native 32 or 64/,
  );
});
