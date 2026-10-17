#!/usr/bin/env node
// Serialized source/asset parity only. Matched native flight views decide artistic value.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
const args = process.argv.slice(2),
  prepared = args.at(-1) === '--prepared';
if (prepared) args.pop();
const [beforePath, afterPath, receiptPath, beforeProjectPath, afterProjectPath] = args;
assert(
  beforePath && afterPath && receiptPath,
  'Use R16_GLB CANDIDATE_GLB NEW_RECEIPT [R16_PROJECT CANDIDATE_PROJECT] [--prepared]',
);
assert.equal(!!beforeProjectPath, !!afterProjectPath);
const checks = [],
  sha = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, passed) {
  checks.push({ name, passed: !!passed });
  assert(passed, name);
}
function parse(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const length = bytes.readUInt32LE(12);
  return { doc: JSON.parse(bytes.subarray(20, 20 + length)), bin: bytes.subarray(28 + length) };
}
function view(model, index) {
  const v = model.doc.bufferViews[index];
  return model.bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
}
function pixels(bytes) {
  check(
    'PNG signature',
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  );
  const chunks = [];
  let width, height;
  for (let offset = 8; offset < bytes.length; ) {
    const n = bytes.readUInt32BE(offset),
      type = bytes.subarray(offset + 4, offset + 8).toString();
    if (type === 'IHDR') {
      width = bytes.readUInt32BE(offset + 8);
      height = bytes.readUInt32BE(offset + 12);
      check('Unchanged opaque8bit RGB image', bytes[offset + 16] === 8 && bytes[offset + 17] === 2);
    }
    if (type === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + n));
    offset += n + 12;
  }
  check('Unchanged256px dimensions', width === 256 && height === 256);
  const raw = inflateSync(Buffer.concat(chunks)),
    stride = width * 3 + 1,
    values = [];
  check('Exact unfiltered source image allocation', raw.length === height * stride);
  for (let y = 0; y < height; y++) {
    assert.equal(raw[y * stride], 0);
    for (let x = 0; x < width; x++) values.push(raw[y * stride + 1 + x * 3 + 2]);
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  let maximumGradient = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = y * width + x;
      maximumGradient = Math.max(
        maximumGradient,
        Math.abs(values[at] - values[y * width + ((x + 1) % width)]),
        Math.abs(values[at] - values[((y + 1) % height) * width + x]),
      );
    }
  return {
    pixels: width * height,
    mean,
    deviation: Math.sqrt(values.reduce((n, v) => n + (v - mean) ** 2, 0) / values.length),
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    maximumGradient,
  };
}
const beforeBytes = await readFile(beforePath),
  afterBytes = await readFile(afterPath),
  before = parse(beforeBytes),
  after = parse(afterBytes);
check(
  'Exact published r16 ' + (prepared ? 'prepared' : 'source') + ' baseline',
  sha(beforeBytes) ===
    (prepared
      ? '6d7d829e337357b61fa212af3691bd8e3088092ce22de9d93011f7e820142bae'
      : '2ab983dd2262027084cbd23b48d59be866ac790cc15df30ef4a87bec7e3fa843'),
);
check('Unchanged1.2MiB source target', afterBytes.length < 1.2 * 1024 * 1024);
check('Candidate no larger than baseline', afterBytes.length <= beforeBytes.length);
for (const key of [
  'nodes',
  'scenes',
  'meshes',
  'materials',
  'textures',
  'samplers',
  'accessors',
  'extensionsUsed',
  'extensionsRequired',
])
  check(key + ' exact ownership/state', same(before.doc[key], after.doc[key]));
check(
  'Still13 materials/3maps/60nodes',
  after.doc.materials.length === 13 &&
    after.doc.images.length === 3 &&
    after.doc.nodes.length === 60,
);
const imageViews = new Set(before.doc.images.map((image) => image.bufferView));
check(
  'Buffer-view count unchanged',
  before.doc.bufferViews.length === after.doc.bufferViews.length,
);
for (let i = 0; i < before.doc.bufferViews.length; i++) {
  const b = { ...before.doc.bufferViews[i] },
    a = { ...after.doc.bufferViews[i] };
  delete b.byteOffset;
  delete a.byteOffset;
  if (i === before.doc.images[0].bufferView) {
    delete b.byteLength;
    delete a.byteLength;
  }
  check('Buffer view' + i + ' layout/state exact', same(b, a));
  if (imageViews.has(i)) continue;
  check('Geometry buffer view' + i + ' byte-exact', view(before, i).equals(view(after, i)));
}
for (let i = 1; i < 3; i++) {
  check('Other image' + i + ' metadata exact', same(before.doc.images[i], after.doc.images[i]));
  check(
    'Other image' + i + ' payload exact',
    view(before, before.doc.images[i].bufferView).equals(
      view(after, after.doc.images[i].bufferView),
    ),
  );
}
const oldImageMetadata = { ...before.doc.images[0] },
  newImageMetadata = { ...after.doc.images[0] };
delete oldImageMetadata.name;
delete newImageMetadata.name;
check('Mineral image ownership/MIME exact', same(oldImageMetadata, newImageMetadata));
const oldAsset = { ...before.doc.asset },
  newAsset = { ...after.doc.asset };
delete oldAsset.generator;
delete newAsset.generator;
check('Asset metadata exact except explicit generator provenance', same(oldAsset, newAsset));
const beforeImage = view(before, before.doc.images[0].bufferView),
  afterImage = view(after, after.doc.images[0].bufferView),
  oldPixels = pixels(beforeImage),
  newPixels = pixels(afterImage);
check('Existing mineral image changed', !beforeImage.equals(afterImage));
check('Encoded mineral image no larger', afterImage.length <= beforeImage.length);
check(
  'Brightness stays within half an8bit level',
  Math.abs(oldPixels.mean - newPixels.mean) <= 0.5,
);
check(
  'Lower broad contrast, no black gap',
  newPixels.deviation < oldPixels.deviation &&
    newPixels.minimum >= oldPixels.minimum &&
    newPixels.maximum <= oldPixels.maximum,
);
check(
  'Maximum neighboring/tiling edge contrast does not increase',
  newPixels.maximumGradient <= oldPixels.maximumGradient,
);
const triangles = after.doc.meshes.reduce(
  (n, mesh) => n + after.doc.accessors[mesh.primitives[0].attributes.POSITION].count / 3,
  0,
);
check('Still12260triangles', triangles === 12260);
if (beforeProjectPath) {
  const b = JSON.parse(await readFile(beforeProjectPath, 'utf8')),
    a = JSON.parse(await readFile(afterProjectPath, 'utf8'));
  const withoutRevision = (value) =>
    Array.isArray(value)
      ? value.map(withoutRevision)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .filter(([key]) => key !== 'revision')
              .map(([key, v]) => [key, withoutRevision(v)]),
          )
        : value;
  check(
    'Eight original course IDs',
    a.courses.length === 8 &&
      same(
        a.courses.map((c) => c.id),
        b.courses.map((c) => c.id),
      ),
  );
  check(
    'All routes/physics/criteria/spawns/collision exact except explicit revision',
    same(withoutRevision(a.courses), withoutRevision(b.courses)),
  );
  for (const key of [
    'spawnBindings',
    'routeBindings',
    'overrides',
    'themes',
    'campaigns',
    'playlists',
  ])
    check(key + ' exact', same(b[key], a[key]));
}
const receipt = {
  format: 'FPVReservoirMineralFinishSourceQualification.v1',
  asset: prepared ? 'prepared' : 'source',
  status: 'passed',
  checks,
  before: {
    bytes: beforeBytes.length,
    sha256: sha(beforeBytes),
    imageBytes: beforeImage.length,
    imageSHA256: sha(beforeImage),
    pixels: oldPixels,
  },
  after: {
    bytes: afterBytes.length,
    sha256: sha(afterBytes),
    imageBytes: afterImage.length,
    imageSHA256: sha(afterImage),
    pixels: newPixels,
  },
  resourceDelta: {
    maps: 0,
    materials: 0,
    triangles: 0,
    nodes: 0,
    texturePixels: 0,
    colliderChange: beforeProjectPath ? 0 : null,
  },
  projectParityIncluded: !!beforeProjectPath,
  tierScope:
    'Identical model geometry/UV/normal/material/sampler/map ownership and unchanged renderer/tier source. No GPU rendering or measured tier performance.',
  scope:
    'Serialized source/asset and optional course data parity only. Pixel statistics do not establish artistic improvement or FPV clearance legibility. Matched native low-pilot/grazing/approach/chase/overview, prepared/flight/package/player/public gates remain separate.',
};
await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify(
    {
      status: receipt.status,
      checks: checks.length,
      after: receipt.after,
      projectParityIncluded: receipt.projectParityIncluded,
    },
    null,
    2,
  ),
);
