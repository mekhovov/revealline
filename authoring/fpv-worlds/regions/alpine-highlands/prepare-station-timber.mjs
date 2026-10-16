/** New original quiet-timber revision of the pinned station-r3 source; earlier source is never rewritten. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validateRegionManifest } from '../region-manifest.mjs';
import {
  compileScenerySource,
  validateScenerySource,
  scenerySourceResources,
} from '../indexed-scenery-cell.mjs';
import { TERRAIN_GEOMETRY_BYTES_PER_CELL } from '../verified-terrain-window.mjs';
import { quietStationCell } from './station-timber.mjs';
const [base, output] = process.argv.slice(2).map((p) => resolve(p));
assert(base && output, 'Provide exact station-r3 source and a new output folder');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const json = (v) => Buffer.from(JSON.stringify(v) + '\n');
const expected = {
  terrain: 'e38bede909419c5502d6e68939a8ca7b3e197f03b9d5e5a4db8c4c5a08fcf90c',
  scenery: 'b3630a0f78ebaf7ef47e63f709d46abbfafd72ef817807bb1acf35aa659bbee8',
};
const manifests = {},
  cells = new Map(),
  edits = [];
let sourceBytes = 0;
await mkdir(output, { recursive: false });
for (const layer of ['terrain', 'scenery']) {
  const bytes = await readFile(resolve(base, layer, 'region.json'));
  assert.equal(sha(bytes), expected[layer], 'Exact reviewed station-r3 source required');
  const manifest = structuredClone(validateRegionManifest(bytes.toString()));
  const replacements = new Map();
  if (layer === 'scenery') {
    for (const asset of manifest.assets.filter((a) => a.kind === 'collision')) {
      const raw = await readFile(resolve(base, layer, asset.path));
      assert.equal(sha(raw), asset.sha256);
      const original = validateScenerySource(JSON.parse(raw));
      const detailed = quietStationCell(original);
      const source = validateScenerySource(detailed.source);
      cells.set(`${source.cell.x},${source.cell.z}`, source);
      if (detailed.changedTextures) {
        replacements.set(asset.path, json(source));
        replacements.set(
          `${source.cell.chunkId}.glb`,
          Buffer.from(compileScenerySource(source).glb),
        );
        edits.push({
          chunkId: source.cell.chunkId,
          changedTextures: detailed.changedTextures,
          textures: source.textures.map((t) => ({
            id: t.id,
            width: t.width,
            height: t.height,
            sha256: sha(Buffer.from(t.rgbaBase64, 'base64')),
          })),
        });
      }
    }
  }
  await mkdir(resolve(output, layer));
  for (const asset of manifest.assets) {
    const replacement = replacements.get(asset.path);
    if (replacement) {
      await writeFile(resolve(output, layer, asset.path), replacement);
      asset.bytes = replacement.length;
      asset.sha256 = sha(replacement);
    } else {
      const original = await readFile(resolve(base, layer, asset.path));
      assert.equal(original.length, asset.bytes);
      assert.equal(sha(original), asset.sha256);
      await copyFile(resolve(base, layer, asset.path), resolve(output, layer, asset.path));
    }
    sourceBytes += asset.bytes;
  }
  manifest.revision = 'relief-r4-quiet-timber';
  validateRegionManifest(manifest);
  const body = json(manifest);
  sourceBytes += body.length;
  await writeFile(resolve(output, layer, 'region.json'), body);
  manifests[layer] = manifest;
}
assert(edits.length > 0 && edits.length <= 4, 'Only bounded station cells may change');
let maxNineCellResourceBytes = 0;
for (let z = 0; z < 16; z++)
  for (let x = 0; x < 16; x++) {
    const sources = [];
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const cell = cells.get(`${x + dx},${z + dz}`);
        if (cell) sources.push(cell);
      }
    maxNineCellResourceBytes = Math.max(
      maxNineCellResourceBytes,
      scenerySourceResources(sources).resourceBytes + 9 * TERRAIN_GEOMETRY_BYTES_PER_CELL,
    );
  }
assert(maxNineCellResourceBytes * 2 <= 8 * 1024 * 1024);
assert(sourceBytes <= 64 * 1024 * 1024);
const receipt = {
  format: 'FPVAlpineQuietTimber.v1',
  revision: manifests.terrain.revision,
  previousManifestSHA256: expected,
  sourceBytes,
  edits,
  manifestSHA256: Object.fromEntries(Object.entries(manifests).map(([k, v]) => [k, sha(json(v))])),
  maxNineCellResourceBytes,
  maxRetainedCandidateResourceBytes: maxNineCellResourceBytes * 2,
  materialScaleMetres: {
    wallTile: [8, 14],
    timberBoardWidth: { minimum: 0.4375, maximum: 0.5625 },
    masonryCourse: 0.35,
    roofTile: [8, 4],
    roofSeamSpacing: 0.5,
  },
  unchanged: [
    'Every terrain asset byte',
    'All oriented solid/visual triangle positions',
    'All spawn positions',
    'All route/collision clearance',
  ],
  nativeAccepted: false,
  playerReady: false,
};
await writeFile(resolve(output, 'station-materials.json'), JSON.stringify(receipt, null, 2) + '\n');
await writeFile(
  resolve(output, 'provenance.json'),
  json({
    author: 'RevealLine contributors',
    license: 'CC0-1.0',
    source:
      'Original quieter timber pixel artwork over the exact accepted station-r3 source. Variable board widths and low-contrast seams; masonry, backed-panel/frame and eave pixels unchanged. No external imagery or simulator assets. OPAQUE panels remain backed by existing solid walls, not fly-through openings.',
    parentManifestSHA256: expected,
  }),
);
console.log(JSON.stringify(receipt, null, 2));
