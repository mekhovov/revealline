/** Full bounded scanline decoding for this owned non-interlaced RGB8 PNG batch.
 * It emits no image files and never resizes, reencodes or changes originals.
 * Browser decoder/color/rendering acceptance remains a separate check.
 */
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { crc32 } from '../../../scripts/game-cli.mjs';
import { inspectImageDataUrl } from '../../../game/content.mjs';

export function decodeOriginalPNG(dataUrl) {
  const header = inspectImageDataUrl(dataUrl);
  assert.equal(header.valid, true, header.errors.join('; '));
  assert.ok(dataUrl.startsWith('data:image/png;base64,'));
  const bytes = Buffer.from(dataUrl.slice(22), 'base64');
  assert.equal(dataUrl, `data:image/png;base64,${bytes.toString('base64')}`);
  const compressed = [];
  let offset = 8,
    ihdr = false,
    ended = false,
    idatEnded = false;
  while (offset < bytes.length) {
    assert.ok(offset + 12 <= bytes.length);
    const length = bytes.readUInt32BE(offset),
      type = bytes.toString('ascii', offset + 4, offset + 8);
    assert.ok(/^[A-Za-z]{4}$/.test(type) && offset + length + 12 <= bytes.length);
    const payload = bytes.subarray(offset + 8, offset + length + 8);
    assert.equal(
      crc32(bytes.subarray(offset + 4, offset + length + 8)),
      bytes.readUInt32BE(offset + length + 8),
      `PNG ${type} CRC`,
    );
    if (!ihdr) {
      assert.equal(type, 'IHDR');
      assert.equal(length, 13);
      ihdr = true;
      assert.equal(payload.readUInt32BE(0), header.width);
      assert.equal(payload.readUInt32BE(4), header.height);
      assert.deepEqual(
        [...payload.subarray(8)],
        [8, 2, 0, 0, 0],
        'Owned images are RGB8/non-interlaced.',
      );
    } else if (type === 'IDAT') {
      assert.equal(idatEnded, false, 'PNG IDAT chunks are contiguous.');
      compressed.push(payload);
    } else {
      if (compressed.length) idatEnded = true;
      if (type === 'IEND') {
        assert.equal(length, 0);
        assert.ok(compressed.length);
        ended = true;
        assert.equal(offset + 12, bytes.length, 'No data after IEND.');
      } else {
        assert.ok(
          !['IHDR', 'tRNS', 'acTL', 'fcTL', 'fdAT'].includes(type),
          'No duplicate header, transparency or animation in the owned RGB batch.',
        );
        assert.ok(type[0] === type[0].toLowerCase(), 'Unknown critical PNG chunk.');
      }
    }
    offset += length + 12;
  }
  assert.ok(ended);
  const stride = header.width * 3,
    expected = (stride + 1) * header.height;
  const rows = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected });
  assert.equal(rows.length, expected);
  const pixelHash = createHash('sha256');
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < header.height; y++) {
    const base = y * (stride + 1),
      filter = rows[base],
      decoded = Buffer.allocUnsafe(stride);
    assert.ok(filter <= 4, 'PNG scanline filter.');
    for (let x = 0; x < stride; x++) {
      const a = x >= 3 ? decoded[x - 3] : 0,
        b = previous[x],
        c = x >= 3 ? previous[x - 3] : 0;
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
    pixelHash.update(decoded);
    previous = decoded;
  }
  return {
    naturalWidth: header.width,
    naturalHeight: header.height,
    pixelBytes: stride * header.height,
    pixelsSha256: pixelHash.digest('hex'),
  };
}
