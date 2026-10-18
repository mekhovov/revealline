import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { analogSignalSeed, applyAnalogSignalNoise } from '../ui/analog-signal.mjs';

function neutral(width = 160, height = 120) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) data.set([128, 128, 128, 255], index);
  return data;
}
function frame(base, width, height, number, options) {
  return applyAnalogSignalNoise(
    base,
    width,
    height,
    number,
    new Uint8ClampedArray(base.length),
    options,
  );
}

test('shared interference is deterministic monochrome snow with independent picture seeds and frames', () => {
  const width = 160,
    height = 120,
    base = neutral(width, height),
    before = base.slice();
  const first = frame(base, width, height, 7, { seed: 31 });
  assert.deepEqual(first, frame(base, width, height, 7, { seed: 31 }));
  for (const candidate of [
    frame(base, width, height, 7, { seed: 32 }),
    frame(base, width, height, 8, { seed: 31 }),
  ]) {
    let changed = 0;
    for (let index = 0; index < first.length; index += 4)
      if (candidate[index] !== first[index]) changed++;
    assert.ok(
      changed / (width * height) > 0.85,
      'Another picture or frame gets its own interference.',
    );
  }
  for (let index = 0; index < first.length; index += 4) {
    assert.equal(first[index], first[index + 1]);
    assert.equal(first[index], first[index + 2]);
    assert.equal(first[index + 3], 255);
  }
  assert.deepEqual(base, before);
});

test('strength reduces interference energy without changing the source or creating digital color noise', () => {
  const width = 160,
    height = 120,
    base = neutral(width, height);
  assert.deepEqual(frame(base, width, height, 1, { strength: 0 }), base);
  const full = frame(base, width, height, 1),
    soft = frame(base, width, height, 1, { strength: 0.68 });
  let fullEnergy = 0,
    softEnergy = 0;
  for (let index = 0; index < base.length; index += 4) {
    fullEnergy += (full[index] - 128) ** 2;
    softEnergy += (soft[index] - 128) ** 2;
    assert.equal(soft[index], soft[index + 1]);
    assert.equal(soft[index], soft[index + 2]);
  }
  const amplitudeRatio = Math.sqrt(softEnergy / fullEnergy);
  assert.ok(amplitudeRatio > 0.66 && amplitudeRatio < 0.71);
});

test('source fingerprint distinguishes arrangements and dimensions even when the palette is identical', () => {
  const first = neutral(8, 6),
    second = first.slice();
  first.set([40, 80, 120, 255], 0);
  second.set([40, 80, 120, 255], 20);
  const seed = analogSignalSeed(first, 8, 6);
  assert.equal(seed, analogSignalSeed(first.slice(), 8, 6));
  assert.notEqual(seed, analogSignalSeed(second, 8, 6));
  assert.notEqual(seed, analogSignalSeed(first, 6, 8));
  assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff);
});

test('shared signal rejects unbounded buffers and invalid phase/amplitude inputs', () => {
  const base = neutral(1, 1);
  assert.throws(() => analogSignalSeed(new Uint8Array(4), 1, 1));
  assert.throws(() => analogSignalSeed(new Uint8ClampedArray(513 * 4), 513, 1));
  assert.throws(() => applyAnalogSignalNoise(base, 1, 1, 0, new Uint8ClampedArray(8)));
  for (const number of [-1, Infinity, NaN, 0.5, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => frame(base, 1, 1, number));
  for (const strength of [-0.1, 1.1, Infinity])
    assert.throws(() => frame(base, 1, 1, 0, { strength }));
  for (const seed of [-1, 0x100000000, 1.5]) assert.throws(() => frame(base, 1, 1, 0, { seed }));
  assert.equal(frame(base, 1, 1, 0).length, 4);
});

// Frozen output from the pre-optimization implementation at14ac29e27. Each
// compact digest covers six seeds/phases/strengths; failures never format a
// full-size pixel buffer. Shared and shifted views also retain write order.
const referenceParameters = [
  [0, 0, 0],
  [1, 0xffffffff, 1],
  [7, 31, 0.68],
  [Number.MAX_SAFE_INTEGER, 0x80000000, 0.00001],
  [137, 0x9137bcad, 0.5],
  [1_000_003, 1, 1],
];
const pixelHash = (pixels) => createHash('sha256').update(pixels).digest('hex');
const coloredPixels = (size) =>
  Uint8ClampedArray.from({ length: size }, (_, index) => (index * 73 + (index >>> 3) * 19) & 255);

function referenceDigest(width, height, overlap = null) {
  const aggregate = createHash('sha256');
  for (const [number, seed, strength] of referenceParameters) {
    const size = width * height * 4,
      backing = coloredPixels(size + (overlap ?? 0)),
      base = new Uint8ClampedArray(backing.buffer, 0, size),
      output =
        overlap === null
          ? new Uint8ClampedArray(size)
          : new Uint8ClampedArray(backing.buffer, overlap, size),
      sourceHash = pixelHash(base);
    assert.equal(
      applyAnalogSignalNoise(base, width, height, number, output, { seed, strength }),
      output,
    );
    if (overlap === null)
      assert.equal(pixelHash(base), sourceHash, 'Source pixels remain unchanged.');
    aggregate.update(pixelHash(overlap === null ? output : backing));
  }
  return aggregate.digest('hex');
}

test('receiver pixels preserve the frozen reference across bounded geometry, phases and strengths', () => {
  for (const [width, height, expected] of [
    [1, 1, '570421c328ab37328088d4cd62c90ecbe1025317af843d027a2501a2f85d36c9'],
    [1, 512, '364fbd4e513d52ca92a1d2b1589f46f0558ce3d9f5bc4fbe5241109e9b2e9eb0'],
    [512, 1, '7925ae4699df23cc701791e728b9e195c44962e2108c2bbfb95b0c1e583693ef'],
    [2, 2, 'b5272681e994fc1e236cc46dcf4b203c896c9e71be9212b8cb617686729b702c'],
    [511, 3, '92299710c8479a7f6f2fff61e63a37f3a88cca8a3f7af3542b08aac81e691d51'],
    [3, 511, 'e2b57533e1f4824ea4ee2a4a2c22dc912ed49e76be0c4009f5867a9975647743'],
    [160, 120, '54eb8fbdf4a1f384abc3d74fa6b5f65c09ad0f5f7b5162b8cb1dc836567df837'],
    [512, 288, '5ffec71d573cc7e3140ffe08d001328834cad47a5e2060e5e2a22ee6c55a3e39'],
    [512, 512, '5e27ce1e7249d5e34d292f1781f1e78ce2208eb28ff455621f65e82d4596ff8c'],
  ])
    assert.equal(referenceDigest(width, height), expected, `${width}×${height} receiver output`);
});

test('receiver pixels preserve in-place and shifted-view alias behavior', () => {
  for (const [offset, expected] of [
    [0, '43938e28b30bdb7278b239944a4a259dbeba68e37e414e072738fa43fab42407'],
    [1, '74ad832c955803f98ff5c57d3600132fa7eaf312be3af2159026740f99662666'],
    [2, '1361d23bf0a427face487b98f0656edacb64bb657fe40bd8a3acbba583e06488'],
    [4, '436d8028098a738ac9cafd5c138e62c770b4dc32201db5c7a13138f8b3fb3c70'],
  ])
    assert.equal(
      referenceDigest(17, 9, offset),
      expected,
      `Receiver output at byte offset${offset}`,
    );
});
