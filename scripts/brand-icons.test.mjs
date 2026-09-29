import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { crc32, offlineIcons } from './game-cli.mjs';
import { decodeScreeningPNG } from './artwork-screening.mjs';
import { decodeIconMaster, encodeIconPNG, ICON_MASTER, manageBrandIcons } from './brand-icons.mjs';

function rgbaFixture({ alpha = 255, filter = 0 } = {}) {
  const chunk = (kind, data) => {
    const type = Buffer.from(kind),
      header = Buffer.alloc(4),
      crc = Buffer.alloc(4);
    header.writeUInt32BE(data.length);
    crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
    return Buffer.concat([header, type, data, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(16, 0);
  header.writeUInt32BE(16, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((16 * 4 + 1) * 16);
  for (let y = 0; y < 16; y++) {
    rows[y * 65] = filter;
    for (let x = 0; x < 16; x++) {
      const at = y * 65 + 1 + x * 4;
      rows[at] = x * 17;
      rows[at + 1] = y * 17;
      rows[at + 2] = 91;
      rows[at + 3] = alpha;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

test('opaque RGBA input keeps RGB samples; alpha, checksum and unsupported filtering reject', () => {
  const image = decodeIconMaster(rgbaFixture());
  assert.deepEqual([...image.pixels.subarray(0, 3)], [0, 0, 91]);
  assert.deepEqual([...image.pixels.subarray(-3)], [255, 255, 91]);
  assert.throws(() => decodeIconMaster(rgbaFixture({ alpha: 254 })), /must be opaque/);
  assert.throws(() => decodeIconMaster(rgbaFixture({ filter: 5 })), /filter/);
  const corrupt = rgbaFixture();
  corrupt[40] ^= 1;
  assert.throws(() => decodeIconMaster(corrupt), /checksum/);
  assert.throws(() => decodeIconMaster(Buffer.alloc(20)), /bounded PNG/);
});

test('required-size encoding preserves the full image and decodes through the independent pinned decoder', () => {
  const source = decodeIconMaster(rgbaFixture());
  for (const size of [16, 32, 180]) {
    const bytes = encodeIconPNG(source, size),
      result = decodeScreeningPNG(bytes);
    assert.equal(result.width, size);
    assert.equal(result.height, size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const at = (y * size + x) * 3;
        assert.deepEqual(
          [...result.pixels.subarray(at, at + 3)],
          [Math.floor((x * 16) / size) * 17, Math.floor((y * 16) / size) * 17, 91],
        );
      }
    assert.deepEqual(encodeIconPNG(source, size), bytes);
  }
  for (const size of [0, 15, 4097, 1.5, NaN])
    assert.throws(() => encodeIconPNG(source, size), /size/);
});

test('current generated master drives bounded PWA and checked-in source icons without mutation', async () => {
  const filename = new URL(`../${ICON_MASTER}`, import.meta.url),
    before = await fs.readFile(filename);
  const original = decodeIconMaster(before);
  assert.equal(original.width, original.height);
  assert(original.width >= 512);
  const assets = offlineIcons();
  assert.deepEqual(
    assets.map((e) => e.name),
    ['icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'],
  );
  for (const entry of assets)
    assert(entry.bytes.length <= (entry.name.endsWith('.svg') ? 65536 : 131072));
  assert(assets[0].bytes.toString().includes('data:image/png;base64,'));
  const report = await manageBrandIcons();
  assert.equal(report.files.length, 5);
  const install = report.files.find((entry) => entry.name === 'icon-512.png');
  assert.equal(install.channelBits, 6);
  assert.equal(install.maxChannelError, 2);
  const decoded = decodeScreeningPNG(
    assets.find((entry) => entry.name === 'icons/icon-512.png').bytes,
  );
  let maximum = 0;
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      const source =
        (Math.floor((y * original.height) / 512) * original.width +
          Math.floor((x * original.width) / 512)) *
        3;
      for (let channel = 0; channel < 3; channel++)
        maximum = Math.max(
          maximum,
          Math.abs(decoded.pixels[(y * 512 + x) * 3 + channel] - original.pixels[source + channel]),
        );
    }
  assert.equal(maximum, 2);
  assert.deepEqual(await fs.readFile(filename), before);
});
