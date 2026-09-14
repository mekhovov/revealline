/** Separate Field Kit title revision. Sources and every P4/v1 artifact are immutable. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { decodeRGB, encodeScenePNG, nearestSceneFrame } from './prepare-field-kit-scenes.mjs';
import { REVEAL_PALETTE } from './prepare-field-kit-reveals.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const check = (value, message) => {
  if (!value) throw new Error(message);
};
const palette = REVEAL_PALETTE.map((hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)),
);

/** Same pixel-center sampling and fixed36 weighted nearest-color operation as
 * reveals, with a title-specific 3x grid. Never mutates the decoded original. */
export function prepareTitlePixels(source, width, height) {
  check(
    (width === 960 && height === 540) || (width === 540 && height === 960),
    'Invalid title frame.',
  );
  const logical = nearestSceneFrame(source, width / 3, height / 3);
  const used = new Set(),
    memo = new Map();
  for (let at = 0; at < logical.rgb.length; at += 3) {
    const key = logical.rgb[at] * 65536 + logical.rgb[at + 1] * 256 + logical.rgb[at + 2];
    let index = memo.get(key);
    if (index === undefined) {
      let distance = Infinity;
      for (let p = 0; p < palette.length; p++) {
        const d =
          (logical.rgb[at] - palette[p][0]) ** 2 * 2 +
          (logical.rgb[at + 1] - palette[p][1]) ** 2 * 4 +
          (logical.rgb[at + 2] - palette[p][2]) ** 2 * 3;
        if (d < distance) {
          distance = d;
          index = p;
        }
      }
      memo.set(key, index);
    }
    logical.rgb.set(palette[index], at);
    used.add(index);
  }
  const prepared = nearestSceneFrame(logical, width, height);
  return {
    width,
    height,
    rgb: prepared.rgb,
    preparation: {
      algorithm: 'field-kit-title-pixel-preparation-v2',
      sourceCrop: logical.crop,
      sampling: 'nearest pixel-center',
      logicalWidth: logical.width,
      logicalHeight: logical.height,
      integerScale: 3,
      clippedEdgePixels: { right: 0, bottom: 0 },
      quantization: 'fixed36-color weighted RGB nearest; no dithering',
      palette: [...REVEAL_PALETTE],
      usedColors: [...used].sort((a, b) => a - b).map((i) => REVEAL_PALETTE[i]),
      alpha: 'opaque',
      disclosure:
        'Unchanged generated source sampled to a 320×180 or 180×320 logical grid, palette-mapped and enlarged 3×. This derivative is not a hand-authored native pixel drawing.',
    },
  };
}
async function preserve(file, bytes, checkOnly, json = false) {
  try {
    const old = await readFile(file);
    check(
      json
        ? JSON.stringify(JSON.parse(old)) === JSON.stringify(JSON.parse(bytes))
        : hash(old) === hash(bytes),
      'Existing title v2 differs; create a new revision: ' + file,
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    check(!checkOnly, 'Missing title v2 artifact: ' + file);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, bytes, { flag: 'wx' });
  }
}
export async function prepareFieldKitTitleV2({ checkOnly = false } = {}) {
  const v1Path = 'authoring/library/fpv-field-kit/prepared-scenes-v1.json';
  const v1Bytes = await readFile(resolve(root, v1Path));
  const v1 = JSON.parse(v1Bytes),
    records = [];
  for (const old of v1.records) {
    const original = await readFile(resolve(root, old.source.path));
    check(
      hash(original) === old.source.sha256 && original.length === old.source.bytes,
      'Original title source changed.',
    );
    const source = decodeRGB(original);
    check(
      source.width === old.source.width && source.height === old.source.height,
      'Original title dimensions changed.',
    );
    const previous = await readFile(resolve(root, old.output.path));
    check(hash(previous) === old.output.sha256, 'Historical title v1 changed.');
    const image = prepareTitlePixels(source, old.output.width, old.output.height);
    const bytes = encodeScenePNG(image),
      decoded = decodeRGB(bytes);
    check(hash(decoded.rgb) === hash(image.rgb), 'Prepared title RGB did not round-trip.');
    const output =
      'authoring/library/fpv-field-kit/prepared/titles/' + old.id.replace(/-v1$/, '-v2') + '.png';
    await preserve(resolve(root, output), bytes, checkOnly);
    records.push({
      id: old.id.replace(/-v1$/, '-v2'),
      slotId: old.id.includes('portrait') ? 'screen.title.portrait' : 'screen.title.background',
      source: old.source,
      previous: old.output,
      output: {
        path: output,
        sha256: hash(bytes),
        bytes: bytes.length,
        width: image.width,
        height: image.height,
        pixelsSha256: hash(image.rgb),
      },
      preparation: image.preparation,
      provenance:
        'Original built-in image-generation source retained unchanged with full prompt in the existing title source records. Separate v2 derivative; every P4/v1 file and hash preserved.',
      quality: {
        stage: 'produced',
        evidence: [
          'Pinned original and historical-v1 SHA-256; exact RGB PNG round trip; 3× clusters; fixed36 palette. Artistic and real menu review remain separate.',
        ],
      },
    });
  }
  const manifest = {
    format: 'revealline-prepared-scenes.v2',
    previousManifest: { path: v1Path, sha256: hash(v1Bytes) },
    recipeSource: {
      path: 'scripts/prepare-field-kit-title-v2.mjs',
      sha256: hash(await readFile(fileURLToPath(import.meta.url))),
    },
    paletteSha256: hash(JSON.stringify(REVEAL_PALETTE)),
    records,
  };
  await preserve(
    resolve(root, 'authoring/library/fpv-field-kit/prepared-scenes-v2.json'),
    Buffer.from(JSON.stringify(manifest, null, 2) + '\n'),
    checkOnly,
    true,
  );
  return manifest;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  prepareFieldKitTitleV2({ checkOnly: process.argv.includes('--check') }).then(
    (manifest) =>
      process.stdout.write(JSON.stringify(manifest.records.map((record) => record.output)) + '\n'),
    (error) => {
      process.stderr.write(error.message + '\n');
      process.exitCode = 1;
    },
  );
}
