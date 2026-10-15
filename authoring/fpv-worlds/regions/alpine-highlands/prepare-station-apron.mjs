/** New terrain-following station hardstanding; exact quiet-timber source stays preserved. */
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
import { stationApronCell } from './station-apron.mjs';
const [base, output] = process.argv.slice(2).map((p) => resolve(p));
assert(base && output, 'Provide exact station-r4 source and a new output folder');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const json = (v) => Buffer.from(JSON.stringify(v) + '\n');
const expected = {
  terrain: '63f007335451f4226a5d58d0790fd10fb038e0ba953016b64661fd61767140c5',
  scenery: '526de1101fdefaad7de9309ca9e4fb13c860d85096af65369840acb0b396a877',
};
const manifests = {},
  cells = new Map(),
  edits = [];
let sourceBytes = 0;
await mkdir(output, { recursive: false });
for (const layer of ['terrain', 'scenery']) {
  const bytes = await readFile(resolve(base, layer, 'region.json'));
  assert.equal(sha(bytes), expected[layer], 'Exact reviewed station-r4 source required');
  const manifest = structuredClone(validateRegionManifest(bytes.toString()));
  const replacements = new Map();
  if (layer === 'scenery') {
    for (const asset of manifest.assets.filter((a) => a.kind === 'collision')) {
      const raw = await readFile(resolve(base, layer, asset.path));
      assert.equal(sha(raw), asset.sha256);
      const original = validateScenerySource(JSON.parse(raw));
      const detailed = stationApronCell(original);
      const source = validateScenerySource(detailed.source);
      cells.set(`${source.cell.x},${source.cell.z}`, source);
      if (detailed.changedTriangles) {
        replacements.set(asset.path, json(source));
        replacements.set(
          `${source.cell.chunkId}.glb`,
          Buffer.from(compileScenerySource(source).glb),
        );
        edits.push({
          chunkId: source.cell.chunkId,
          changedTriangles: detailed.changedTriangles,
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
  manifest.revision = 'relief-r5-station-apron';
  validateRegionManifest(manifest);
  const body = json(manifest);
  sourceBytes += body.length;
  await writeFile(resolve(output, layer, 'region.json'), body);
  manifests[layer] = manifest;
}
assert.equal(edits.length, 2, 'Only the two bounded station apron cells may change');
assert.equal(
  edits.reduce((sum, edit) => sum + edit.changedTriangles, 0),
  260,
);
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
  format: 'FPVAlpineStationApron.v1',
  revision: manifests.terrain.revision,
  previousManifestSHA256: expected,
  sourceBytes,
  edits,
  manifestSHA256: Object.fromEntries(Object.entries(manifests).map(([k, v]) => [k, sha(json(v))])),
  maxNineCellResourceBytes,
  maxRetainedCandidateResourceBytes: maxNineCellResourceBytes * 2,
  apronMetres: { minX: 3296, maxX: 3504, minZ: 3080, maxZ: 3120, width: 40, length: 208 },
  addedTexturePixels: 0,
  addedCollisionTriangles: 0,
  unchanged: [
    'Every terrain asset byte',
    'All oriented solid/visual triangle positions',
    'All spawn positions',
    'All route/collision clearance',
  ],
  nativeAccepted: false,
  playerReady: false,
};
await writeFile(resolve(output, 'station-apron.json'), JSON.stringify(receipt, null, 2) + '\n');
await writeFile(
  resolve(output, 'provenance.json'),
  json({
    author: 'RevealLine contributors',
    license: 'CC0-1.0',
    source:
      'Original station concourse hardstanding over the exact accepted station-r4 source. Only 260 existing visual-only terrain-following snow triangles use the already approved road-apron palette. All triangle positions, normals, UVs, textures, solid collisions and openings remain unchanged. No external imagery or simulator assets.',
    parentManifestSHA256: expected,
  }),
);
console.log(JSON.stringify(receipt, null, 2));
