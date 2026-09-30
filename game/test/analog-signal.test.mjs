import test from 'node:test';
import assert from 'node:assert/strict';
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
  for (const number of [-1, Infinity, NaN, 0.5]) assert.throws(() => frame(base, 1, 1, number));
  for (const strength of [-0.1, 1.1, Infinity])
    assert.throws(() => frame(base, 1, 1, 0, { strength }));
  for (const seed of [-1, 0x100000000, 1.5]) assert.throws(() => frame(base, 1, 1, 0, { seed }));
  assert.equal(frame(base, 1, 1, 0).length, 4);
});
