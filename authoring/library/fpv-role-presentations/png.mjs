/** Source-only bounded RGBA8 decoder adapted from four-worlds-chapters/verify-images.mjs.
 * Decodes for verification. Never writes, crops, rescales or reencodes an image.
 */
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { crc32 } from '../../../scripts/game-cli.mjs';

export function decodeRGBA(bytes) {
  assert.ok(
    Buffer.isBuffer(bytes) && bytes.length >= 45 && bytes.length <= 4 * 1024 * 1024,
    'PNG byte bound.',
  );
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG signature.');
  const compressed = [];
  let offset = 8,
    width = 0,
    height = 0,
    ended = false,
    idatEnded = false;
  while (offset < bytes.length) {
    assert.ok(offset + 12 <= bytes.length, 'PNG chunk header.');
    const length = bytes.readUInt32BE(offset),
      type = bytes.toString('ascii', offset + 4, offset + 8);
    assert.ok(
      /^[A-Za-z]{4}$/.test(type) && offset + length + 12 <= bytes.length,
      'PNG chunk bounds.',
    );
    const payload = bytes.subarray(offset + 8, offset + length + 8);
    assert.equal(
      crc32(bytes.subarray(offset + 4, offset + length + 8)),
      bytes.readUInt32BE(offset + length + 8),
      `PNG ${type} CRC.`,
    );
    if (!width) {
      assert.equal(type, 'IHDR');
      assert.equal(length, 13);
      width = payload.readUInt32BE(0);
      height = payload.readUInt32BE(4);
      assert.ok(width >= 1 && height >= 1 && width <= 2048 && height <= 2048, 'PNG pixel bound.');
      assert.deepEqual([...payload.subarray(8)], [8, 6, 0, 0, 0], 'RGBA8/non-interlaced only.');
    } else if (type === 'IDAT') {
      assert.equal(idatEnded, false, 'PNG IDAT chunks are contiguous.');
      compressed.push(payload);
    } else {
      if (compressed.length) idatEnded = true;
      if (type === 'IEND') {
        assert.equal(length, 0);
        assert.ok(compressed.length);
        ended = true;
        assert.equal(offset + 12, bytes.length, 'No bytes after IEND.');
      } else {
        assert.ok(
          !['IHDR', 'tRNS', 'acTL', 'fcTL', 'fdAT'].includes(type),
          'No duplicate header, color-key alpha or animation.',
        );
        assert.equal(type[0], type[0].toLowerCase(), 'Unknown critical PNG chunk.');
      }
    }
    offset += length + 12;
  }
  assert.ok(ended, 'PNG IEND required.');
  const stride = width * 4,
    expected = (stride + 1) * height;
  const rows = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected });
  assert.equal(rows.length, expected, 'Exact inflated scanline length.');
  const pixels = Buffer.alloc(stride * height);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const base = y * (stride + 1),
      filter = rows[base],
      decoded = pixels.subarray(y * stride, (y + 1) * stride);
    assert.ok(filter <= 4, 'PNG scanline filter.');
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? decoded[x - 4] : 0,
        b = previous[x],
        c = x >= 4 ? previous[x - 4] : 0;
      let predict = 0;
      if (filter === 1) predict = a;
      if (filter === 2) predict = b;
      if (filter === 3) predict = Math.floor((a + b) / 2);
      if (filter === 4) {
        const p = a + b - c,
          pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c);
        predict = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      decoded[x] = (rows[base + 1 + x] + predict) & 255;
    }
    previous = decoded;
  }
  const alpha = { zero: 0, partial: 0, opaque: 0 };
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  let majorLeft = width,
    majorTop = height,
    majorRight = -1,
    majorBottom = -1,
    nearOpaque = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const a = pixels[(y * width + x) * 4 + 3];
      alpha[a === 0 ? 'zero' : a === 255 ? 'opaque' : 'partial']++;
      if (a) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
      if (a >= 250) nearOpaque++;
      if (a >= 128) {
        majorLeft = Math.min(majorLeft, x);
        majorRight = Math.max(majorRight, x);
        majorTop = Math.min(majorTop, y);
        majorBottom = Math.max(majorBottom, y);
      }
    }
  return {
    width,
    height,
    pixelBytes: pixels.length,
    pixelsSha256: createHash('sha256').update(pixels).digest('hex'),
    alpha,
    nearOpaque,
    visibleBounds: right < 0 ? null : { left, top, right, bottom },
    substantialBounds:
      majorRight < 0
        ? null
        : { left: majorLeft, top: majorTop, right: majorRight, bottom: majorBottom },
    pixels,
  };
}
