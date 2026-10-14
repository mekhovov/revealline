/** Narrow decoder for the exact pinned indexed palette; not a general image importer. */
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';

export function readRailwayPalette(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  let width, height, palette;
  const compressed = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), kind = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    assert.equal(data.length, length);
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.equal(width, 512); assert.equal(height, 512);
      assert.deepEqual([...data.subarray(8)], [8, 3, 0, 0, 0]);
    } else if (kind === 'PLTE') palette = data;
    else if (kind === 'IDAT') compressed.push(data);
    offset += length + 12;
  }
  assert(palette && palette.length % 3 === 0);
  const raw = inflateSync(Buffer.concat(compressed), { maxOutputLength: (width + 1) * height });
  assert.equal(raw.length, (width + 1) * height);
  const pixels = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (width + 1)];
    assert(filter <= 4);
    for (let x = 0; x < width; x++) {
      const i = y * width + x, left = x ? pixels[i - 1] : 0, above = y ? pixels[i - width] : 0, corner = x && y ? pixels[i - width - 1] : 0;
      const prediction = left + above - corner;
      const a = Math.abs(prediction - left), b = Math.abs(prediction - above), c = Math.abs(prediction - corner);
      const correction = [0, left, above, Math.floor((left + above) / 2), a <= b && a <= c ? left : b <= c ? above : corner][filter];
      pixels[i] = (raw[y * (width + 1) + x + 1] + correction) & 255;
    }
  }
  const linear = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return (uv) => {
    assert(uv.every(Number.isFinite));
    const x = Math.min(width - 1, Math.floor((uv[0] - Math.floor(uv[0])) * width));
    const y = Math.min(height - 1, Math.floor((uv[1] - Math.floor(uv[1])) * height));
    const index = pixels[y * width + x];
    assert(index * 3 + 2 < palette.length);
    return [...palette.subarray(index * 3, index * 3 + 3)].map(linear);
  };
}
