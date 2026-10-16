import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCREENING_VERSION,
  TRANSFORMS,
  transformPixels,
  exactPixelIdentity,
  exactTransformSignatures,
  similaritySignatures,
  compareSimilarity,
  thumbnailPNG,
  decodeScreeningPNG,
  classifyExactSharing,
  validateArtworkChanges,
} from '../../scripts/artwork-screening.mjs';

function picture(width = 32, height = 24, seed = 1) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = seed % 100;
    pixels.fill(value, i * 3, i * 3 + 3);
  }
  return { width, height, pixels };
}
const canonical = (image) =>
  exactTransformSignatures(image)
    .map(({ sha256 }) => sha256)
    .sort()[0];

test('exact screen covers all eight rotations/reflections, including swapped non-square dimensions', () => {
  const original = picture(7, 5),
    key = canonical(original);
  for (const transform of TRANSFORMS) {
    const copy = transformPixels(original, transform);
    assert.equal(canonical(copy), key, transform);
    if (transform !== 'identity')
      assert.notEqual(exactPixelIdentity(copy), exactPixelIdentity(original));
  }
  assert.deepEqual(transformPixels(transformPixels(original, 'rotate-90'), 'rotate-270'), original);
  assert.deepEqual(transformPixels(transformPixels(original, 'reflect'), 'reflect'), original);
  const changed = picture(7, 5);
  changed.pixels[0]++;
  assert.notEqual(canonical(changed), key, 'A changed pixel is not an exact copy.');
  assert.notEqual(
    exactPixelIdentity(picture(3, 4)),
    exactPixelIdentity(picture(4, 3)),
    'Dimensions are identity-bearing.',
  );
});

test('bounded PNG scan exposes the original samples and derived thumbnails have stable bytes', () => {
  const original = picture(7, 5),
    bytes = thumbnailPNG(original);
  assert.deepEqual(decodeScreeningPNG(bytes), original);
  assert.ok(bytes.equals(thumbnailPNG(original)));
  const corrupt = Buffer.from(bytes);
  corrupt[45] ^= 1;
  assert.throws(() => decodeScreeningPNG(corrupt), /CRC/);
  const oversized = { width: 8193, height: 1, pixels: Buffer.alloc(8193 * 3) };
  assert.throws(() => exactTransformSignatures(oversized));
});

test('recoloring and bounded center-crop hypotheses are suspected, never exact matches', () => {
  const original = picture(64, 64),
    recolored = { ...original, pixels: Buffer.from(original.pixels) };
  for (let i = 0; i < recolored.pixels.length; i++) recolored.pixels[i] += 60;
  assert.notEqual(canonical(original), canonical(recolored));
  const comparison = compareSimilarity(
    similaritySignatures(original),
    similaritySignatures(recolored),
  );
  assert.equal(comparison.distance, 0);
  assert.equal(comparison.suspected, true);
  const crop = { width: 32, height: 32, pixels: Buffer.alloc(32 * 32 * 3) };
  for (let y = 0; y < 32; y++)
    original.pixels.copy(
      crop.pixels,
      y * 32 * 3,
      ((y + 16) * 64 + 16) * 3,
      ((y + 16) * 64 + 48) * 3,
    );
  const found = compareSimilarity(similaritySignatures(crop), similaritySignatures(original));
  assert.equal(found.distance, 0);
  assert.equal(found.crop, '50%-center');
  assert.equal(found.suspected, true);
  const rotated = compareSimilarity(
    similaritySignatures(crop),
    similaritySignatures(transformPixels(original, 'rotate-90')),
  );
  assert.equal(rotated.distance, 0);
  const flat = { width: 32, height: 32, pixels: Buffer.alloc(32 * 32 * 3, 100) };
  assert.equal(
    compareSimilarity(similaritySignatures(flat), similaritySignatures(flat)).suspected,
    false,
  );
});

const imageRecord = (id, currentOwners, historicalOwners = [], key = 'pixels') => ({
  id,
  currentOwners,
  historicalOwners,
  canonicalPixels: key,
  exactTransforms: [{ sha256: key }],
});

test('same mission reveal/reward/thumbnail references and historical reuse are not current violations', () => {
  const image = imageRecord('art-a', ['solo/a', 'solo/a', 'solo/a'], ['archive/a', 'archive/b']);
  const groups = classifyExactSharing([image]);
  assert.equal(groups.exactCurrent.length, 0);
  assert.equal(groups.historicalReuse.length, 1);
  const otherMode = classifyExactSharing([{ ...image, currentOwners: ['solo/a', 'versus/a'] }]);
  assert.equal(otherMode.exactCurrent.length, 1, 'Separately listed modes are distinct owners.');
  const transformed = imageRecord('art-b', ['solo/b']);
  transformed.exactTransforms[0].sha256 = 'rotated';
  assert.equal(
    classifyExactSharing([image, transformed]).exactCurrent[0].kind,
    'exact-rotated-or-reflected-pixels',
  );
});

function report(images) {
  return {
    format: SCREENING_VERSION,
    inventorySha256: 'inventory',
    method: { algorithmSha256: 'implementation', decoderSha256: 'decoder' },
    images,
    ...classifyExactSharing(images),
  };
}

test('strict new-art gate permits unchanged baseline but rejects newly assigned exact copies', () => {
  const baseline = report([imageRecord('art-a', ['solo/a', 'versus/a'])]);
  assert.equal(validateArtworkChanges(baseline, { baseline }).passed, true);
  const introduced = report([imageRecord('art-a', ['solo/a', 'versus/a', 'solo/new'])]);
  const result = validateArtworkChanges(introduced, { baseline });
  assert.equal(result.exactViolations.length, 1);
  assert.deepEqual(result.changed, [{ artwork: 'art-a', owner: 'solo/new' }]);
  const reviews = {
    format: 'revealline-artwork-visual-review.v1',
    inventorySha256: 'inventory',
    entries: [
      {
        artwork: 'art-a',
        owner: 'solo/new',
        decision: 'approved',
        reviewer: 'human reviewer',
        notes: 'Reviewed full original and gameplay.',
      },
    ],
  };
  assert.equal(
    validateArtworkChanges(introduced, { baseline, reviews }).passed,
    false,
    'Review cannot waive exact introduced copies.',
  );
});

test('new unique artwork still requires explicit review bound to exact artwork, owner and inventory', () => {
  const baseline = report([imageRecord('art-a', ['solo/a'])]);
  const next = report([
    imageRecord('art-a', ['solo/a']),
    imageRecord('art-b', ['solo/b'], [], 'different'),
  ]);
  assert.equal(validateArtworkChanges(next, { baseline }).pendingVisualReview.length, 1);
  const reviews = {
    format: 'revealline-artwork-visual-review.v1',
    inventorySha256: 'inventory',
    entries: [
      {
        artwork: 'art-b',
        owner: 'solo/b',
        decision: 'approved',
        reviewer: 'human reviewer',
        notes: 'Compared full composition, nearest matches and gameplay.',
      },
    ],
  };
  assert.equal(validateArtworkChanges(next, { baseline, reviews }).passed, true);
  assert.throws(
    () =>
      validateArtworkChanges(next, { baseline, reviews: { ...reviews, inventorySha256: 'old' } }),
    /exact inventory/,
  );
  assert.throws(() => validateArtworkChanges(next, {}), /prior screening report/);
});
