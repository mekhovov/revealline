import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import {
  decodeAuditPNG,
  measureLosslessPNG,
  auditPracticePNGs,
} from './audit-practice-png-capacity.mjs';

function chunk(type, data) {
  const value = Buffer.alloc(data.length + 12);
  value.writeUInt32BE(data.length);
  value.write(type, 4);
  data.copy(value, 8);
  let crc = 0xffffffff;
  for (const byte of value.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  value.writeUInt32BE((crc ^ 0xffffffff) >>> 0, value.length - 4);
  return value;
}
function fixture(
  channels,
  { bitDepth = 8, rowFilter, animated = false, transparency = false } = {},
) {
  const width = 4,
    height = 5,
    stride = width * channels;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = bitDepth;
  header[9] = channels === 3 ? 2 : 6;
  const original = Buffer.from(
    Array.from({ length: stride * height }, (_, index) => (index * 29 + 17) % 256),
  );
  const filtered = Buffer.alloc((stride + 1) * height),
    rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const kind = rowFilter ?? y;
    filtered[y * (stride + 1)] = kind;
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x,
        left = x >= channels ? original[at - channels] : 0,
        above = y ? original[at - stride] : 0,
        corner = y && x >= channels ? original[at - stride - channels] : 0;
      const estimate = left + above - corner;
      const choices = [left, above, corner];
      const nearest = choices.reduce((best, value) =>
        Math.abs(estimate - value) < Math.abs(estimate - best) ? value : best,
      );
      const prediction = [0, left, above, Math.floor((left + above) / 2), nearest][kind] ?? 0;
      filtered[y * (stride + 1) + 1 + x] = (original[at] - prediction) & 255;
    }
  }
  for (let pixel = 0; pixel < width * height; pixel++) {
    original.copy(rgba, pixel * 4, pixel * channels, pixel * channels + 3);
    rgba[pixel * 4 + 3] = channels === 4 ? original[pixel * channels + 3] : 255;
  }
  const data = deflateSync(filtered, { level: 0 });
  const bytes = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('gAMA', Buffer.from([0, 0, 177, 143])),
    chunk('tEXt', Buffer.from('Comment\0preserve this metadata')),
    ...(animated ? [chunk('acTL', Buffer.alloc(8))] : []),
    ...(transparency ? [chunk('tRNS', Buffer.alloc(6))] : []),
    chunk('IDAT', data.subarray(0, 8)),
    chunk('IDAT', data.subarray(8)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return { bytes, rgba };
}

for (const channels of [3, 4]) {
  test(`RGB${channels === 4 ? 'A' : ''} decoder reverses all five filters exactly`, () => {
    const { bytes, rgba } = fixture(channels);
    assert.deepEqual(decodeAuditPNG(bytes).rgba, rgba);
    const result = measureLosslessPNG(bytes);
    assert.equal(result.rgbaSha256, createHash('sha256').update(rgba).digest('hex'));
    assert.ok(
      result.options.every((item) => item.exactRGBA && item.exactIHDR && item.exactNonIDATChunks),
    );
    assert.ok(result.savedBytes > 0);
    assert.equal(result.options.length, 2, 'default audit never requires a native encoder');
    assert.equal(result.options[0].sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.ok(result.best.bytes <= bytes.length);
  });
}

test('input bytes remain unchanged and metadata/chunk integrity is verified', () => {
  const { bytes } = fixture(4),
    before = Buffer.from(bytes);
  measureLosslessPNG(bytes);
  assert.deepEqual(bytes, before);
  const corrupt = Buffer.from(bytes);
  corrupt[42] ^= 1;
  assert.throws(() => measureLosslessPNG(corrupt), /checksum/);
  assert.throws(() => measureLosslessPNG(bytes.subarray(0, -5)), /Truncated|exceeds/);
  assert.throws(() => measureLosslessPNG(Buffer.from('not png')), /Not a PNG/);
});

test('unsupported animation, bit depths and row filters fail rather than imply equality', () => {
  assert.throws(() => measureLosslessPNG(fixture(3, { animated: true }).bytes), /Animated/);
  assert.throws(() => measureLosslessPNG(fixture(3, { transparency: true }).bytes), /tRNS/);
  assert.throws(() => measureLosslessPNG(fixture(3, { bitDepth: 16 }).bytes), /RGB\/RGBA8/);
  assert.throws(() => measureLosslessPNG(fixture(3, { rowFilter: 5 }).bytes), /row filter/);
});

test('audit bounds are checked before network or output access', async () => {
  for (const options of [
    {},
    { out: 'unused', maxFiles: 31 },
    { out: 'unused', maxInputBytes: 100_000_001 },
    { out: 'unused', withFFmpeg: 'yes' },
  ])
    await assert.rejects(auditPracticePNGs(options), /30 files \/ 100 MB/);
});
