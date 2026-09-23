/** Deterministic source-authoring utility. No runtime registration or original edits. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { crc32 } from '../../scripts/game-cli.mjs';
import { decodeRGBA } from '../library/fpv-role-presentations/png.mjs';

export const RECIPE = 'rgba8-full-frame-nearest-center-stored-deflate.v1';
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function sampleFrame({ pixels, width, height }, size) {
  assert.ok(Number.isInteger(width) && width > 0 && width <= 2048);
  assert.ok(Number.isInteger(height) && height > 0 && height <= 2048);
  assert.ok(Number.isInteger(size) && size > 0 && size <= 128);
  assert.ok(Buffer.isBuffer(pixels) && pixels.length === width * height * 4);
  assert.equal(width, height, 'Sprite sources must have a square full frame.');
  const result = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const sy = Math.floor(((2 * y + 1) * height) / (2 * size));
    for (let x = 0; x < size; x++) {
      const sx = Math.floor(((2 * x + 1) * width) / (2 * size));
      pixels.copy(result, (y * size + x) * 4, (sy * width + sx) * 4, (sy * width + sx) * 4 + 4);
    }
  }
  return result;
}

function storedZlib(bytes) {
  const parts = [Buffer.from([0x78, 0x01])];
  for (let start = 0; start < bytes.length; start += 65535) {
    const length = Math.min(65535, bytes.length - start);
    const header = Buffer.alloc(5);
    header[0] = start + length === bytes.length ? 1 : 0;
    header.writeUInt16LE(length, 1);
    header.writeUInt16LE(length ^ 0xffff, 3);
    parts.push(header, bytes.subarray(start, start + length));
  }
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE((b * 65536 + a) >>> 0);
  return Buffer.concat([...parts, adler]);
}

function chunk(type, payload) {
  const bytes = Buffer.alloc(payload.length + 12);
  bytes.writeUInt32BE(payload.length);
  bytes.write(type, 4, 4, 'ascii');
  payload.copy(bytes, 8);
  bytes.writeUInt32BE(crc32(bytes.subarray(4, -4)), bytes.length - 4);
  return bytes;
}

export function encodeFrame(pixels, size) {
  assert.ok(Number.isInteger(size) && size > 0 && size <= 128);
  assert.ok(Buffer.isBuffer(pixels) && pixels.length === size * size * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = size * 4;
  const rows = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++)
    pixels.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', storedZlib(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function deriveFrame(sourceBytes, identity, size = 128) {
  assert.ok([32, 64, 128].includes(size), 'Production sprite size must be 32, 64 or 128.');
  assert.equal(sourceBytes.length, identity.bytes, 'Original byte count does not match.');
  assert.equal(digest(sourceBytes), identity.sha256, 'Original SHA-256 does not match.');
  const source = decodeRGBA(sourceBytes);
  assert.equal(source.width, identity.width, 'Original width does not match.');
  assert.equal(source.height, identity.height, 'Original height does not match.');
  const pixels = sampleFrame(source, size);
  const png = encodeFrame(pixels, size);
  return {
    png,
    record: {
      recipe: RECIPE,
      original: { ...identity },
      output: {
        bytes: png.length,
        sha256: digest(png),
        width: size,
        height: size,
        pixelsSha256: digest(pixels),
      },
      frame: { crop: false, pivot: [0.5, 0.5], heading: 'north' },
    },
  };
}
