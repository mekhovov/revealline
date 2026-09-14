/** Prepare the approved scene crops into new exact-size files. Never edit sources. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inflateSync, deflateSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { crc32 } from './game-cli.mjs';
import { required } from '../game/data-json.mjs';
import { decodeOriginalPNG } from '../authoring/library/four-worlds-chapters/verify-images.mjs';
import { centerCrop } from '../authoring/asset-studio/helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const scenes = [
  ['title-hangar', 960, 540, 'cbeef16d7c8f20d1f211c61d455d8b02f1c7abff83b41348cbd711b2f7b69eac'],
  [
    'title-hangar-portrait',
    540,
    960,
    '4a7b9b79cc874264a4480db6f1c371f56e23919dfe7f9781037d3a733c649198',
  ],
];
export function decodeRGB(bytes) {
  // Full existing bounded validator checks headers, dimensions, CRCs and filters.
  const facts = decodeOriginalPNG('data:image/png;base64,' + bytes.toString('base64'));
  const width = facts.naturalWidth,
    height = facts.naturalHeight;
  const idat = [];
  for (let at = 8; at < bytes.length; ) {
    const length = bytes.readUInt32BE(at);
    if (bytes.toString('ascii', at + 4, at + 8) === 'IDAT')
      idat.push(bytes.subarray(at + 8, at + 8 + length));
    at += length + 12;
  }
  const stride = width * 3;
  const filtered = inflateSync(Buffer.concat(idat), { maxOutputLength: (stride + 1) * height });
  const rgb = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1),
      filter = filtered[start];
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x;
      const a = x >= 3 ? rgb[at - 3] : 0,
        b = y ? rgb[at - stride] : 0;
      const c = y && x >= 3 ? rgb[at - stride - 3] : 0;
      const p = a + b - c,
        pa = Math.abs(p - a),
        pb = Math.abs(p - b),
        pc = Math.abs(p - c);
      const predictor = [
        0,
        a,
        b,
        Math.floor((a + b) / 2),
        pa <= pb && pa <= pc ? a : pb <= pc ? b : c,
      ][filter];
      rgb[at] = (filtered[start + 1 + x] + predictor) & 255;
    }
  }
  required(hash(rgb) === facts.pixelsSha256, 'Decoded source pixels differ from the verifier.');
  return { width, height, rgb };
}
export function nearestSceneFrame(source, width, height) {
  required(
    Number.isInteger(width) &&
      Number.isInteger(height) &&
      width > 0 &&
      height > 0 &&
      width <= 1920 &&
      height <= 1920 &&
      width * height <= 2073600,
    'Invalid scene target.',
  );
  const crop = centerCrop(source.width, source.height, width, height);
  required(source.rgb.length === source.width * source.height * 3, 'Invalid RGB frame.');
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const sx = crop.x + Math.min(crop.width - 1, Math.floor(((x + 0.5) * crop.width) / width));
      const sy = crop.y + Math.min(crop.height - 1, Math.floor(((y + 0.5) * crop.height) / height));
      rgb.set(
        source.rgb.subarray((sy * source.width + sx) * 3, (sy * source.width + sx) * 3 + 3),
        (y * width + x) * 3,
      );
    }
  return { width, height, rgb, crop };
}
function chunk(type, bytes) {
  const out = Buffer.alloc(12 + bytes.length);
  out.writeUInt32BE(bytes.length);
  out.write(type, 4);
  out.set(bytes, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + bytes.length)), 8 + bytes.length);
  return out;
}
export function encodeScenePNG({ width, height, rgb }) {
  required(rgb.length === width * height * 3, 'Invalid output RGB frame.');
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++)
    rows.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
async function preserveOrCreate(file, bytes) {
  try {
    const old = await fs.readFile(file);
    required(
      hash(old) === hash(bytes),
      'Existing scene derivative differs; use a new revision path.',
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes, { flag: 'wx' });
  }
}
async function main() {
  const records = [];
  for (const [name, width, height, sha256] of scenes) {
    const input = 'authoring/library/fpv-field-kit/originals/' + name + '.png';
    const original = await fs.readFile(path.join(root, input));
    required(hash(original) === sha256, 'Approved original scene hash changed.');
    const source = decodeRGB(original);
    const prepared = nearestSceneFrame(source, width, height);
    const bytes = encodeScenePNG(prepared);
    const decoded = decodeOriginalPNG('data:image/png;base64,' + bytes.toString('base64'));
    required(
      decoded.pixelsSha256 === hash(prepared.rgb),
      'Prepared PNG did not round-trip exactly.',
    );
    const output = 'game/ui/art/field-kit/prepared/' + name + '-v1.png';
    await preserveOrCreate(path.join(root, output), bytes);
    records.push({
      id: name + '-v1',
      source: {
        path: input,
        sha256,
        width: source.width,
        height: source.height,
        bytes: original.length,
      },
      output: {
        path: output,
        sha256: hash(bytes),
        width,
        height,
        bytes: bytes.length,
        pixelsSha256: decoded.pixelsSha256,
      },
      preparation: {
        crop: prepared.crop,
        sampling: 'nearest',
        algorithm: 'pixel-center-v1',
        alpha: 'opaque',
      },
      provenance:
        'Original image-generation scene retained unchanged. Explicit derivative for the approved slot dimensions; source credentials remain with the source file.',
      quality: {
        stage: 'produced',
        evidence: [
          'Exact source SHA-256; complete PNG CRC/filter decode; target RGB byte round trip. Visual and in-game review remain separate.',
        ],
      },
    });
  }
  const record = Buffer.from(
    JSON.stringify({ format: 'revealline-prepared-scenes.v1', records }, null, 2) + '\n',
  );
  await preserveOrCreate(
    path.join(root, 'authoring/library/fpv-field-kit/prepared-scenes-v1.json'),
    record,
  );
  process.stdout.write(JSON.stringify(records.map((r) => r.output)) + '\n');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main().catch((error) => {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  });
