#!/usr/bin/env node
/** Generate the small CSS landing atlas from the same receiver-noise algorithm.
 * Default checks the committed asset; --write creates it without overwriting. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { applyAnalogSignalNoise } from '../game/ui/analog-signal.mjs';

export const ANALOG_ATLAS = Object.freeze({
  frameWidth: 256,
  height: 128,
  frames: 4,
  seed: 0x51a19e,
});
const outputURL = new URL('../game/ui/art/menu-scenes/analog-noise-atlas.png', import.meta.url);
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const name = Buffer.from(type),
    prefix = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  prefix.writeUInt32BE(bytes.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
  return Buffer.concat([prefix, name, bytes, crc]);
}
export function buildAnalogNoiseAtlas() {
  const { frameWidth, height, frames, seed } = ANALOG_ATLAS;
  const width = frameWidth * frames;
  const neutral = new Uint8ClampedArray(frameWidth * height * 4);
  for (let index = 0; index < neutral.length; index += 4) neutral.set([128, 128, 128, 255], index);
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let frame = 0; frame < frames; frame++) {
    const noise = applyAnalogSignalNoise(
      neutral,
      frameWidth,
      height,
      frame,
      new Uint8ClampedArray(neutral.length),
      { seed },
    );
    for (let y = 0; y < height; y++)
      pixels.set(
        noise.subarray(y * frameWidth * 4, (y + 1) * frameWidth * 4),
        (y * width + frame * frameWidth) * 4,
      );
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6; // RGBA8.
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++)
    Buffer.from(pixels.buffer, y * width * 4, width * 4).copy(rows, y * (width * 4 + 1) + 1);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
async function main() {
  const args = process.argv.slice(2);
  assert.ok(
    args.length === 0 || (args.length === 1 && args[0] === '--write'),
    'Use no arguments to check or --write to create.',
  );
  const bytes = buildAnalogNoiseAtlas();
  if (args[0] === '--write') await writeFile(outputURL, bytes, { flag: 'wx' });
  else
    assert.deepEqual(
      await readFile(outputURL),
      bytes,
      'Analog atlas differs from the shared algorithm.',
    );
  console.log(
    JSON.stringify({
      path: fileURLToPath(outputURL),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      ...ANALOG_ATLAS,
    }),
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
