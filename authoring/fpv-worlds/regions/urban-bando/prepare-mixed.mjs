/** Produce explicit companion manifests, without overwriting the original Urban sources. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validateRegionManifest } from '../region-manifest.mjs';
import { compileSceneryCell, validateSceneryCell } from '../scenery-cell.mjs';
import { compileTerrainCell, validateTerrainSeams, TERRAIN_FORMAT } from '../terrain-cell.mjs';
import { earthworks, heightMm, routes } from './mixed-design.mjs';

const [input, output] = process.argv.slice(2);
assert(
  input && output,
  'Provide exact Urban regional r1/r2 source and a new external output directory',
);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const sourceManifest = await readFile(resolve(input, 'region.json'));
const sourceProvenance = await readFile(resolve(input, 'provenance.json'));
assert.equal(
  sha(sourceManifest),
  '2ec9d40b89d8514de57fc85aa32ff59e3955c2a90e488a4b02782d60440b307e',
);
assert.equal(
  sha(sourceProvenance),
  '27562e2c7d4a85127b56cd2eb6bb10540e2915e03d106236001c69222b87d0f3',
);
const original = validateRegionManifest(sourceManifest.toString('utf8'));
const licenseProvenance = await readFile(
  new URL('../../assets/kenney/city-industrial/provenance.json', import.meta.url),
);
assert.equal(sha(licenseProvenance), JSON.parse(sourceProvenance).licenseReceiptSHA256);
const license = await readFile(
  new URL('../../assets/kenney/city-industrial/License.txt', import.meta.url),
);
assert.equal(
  sha(license),
  JSON.parse(licenseProvenance).files.find((file) => file.path === 'License.txt').sha256,
);
const sourceAssets = new Map();
for (const asset of original.assets) {
  const bytes = await readFile(resolve(input, asset.path));
  assert.equal(bytes.length, asset.bytes, asset.id);
  assert.equal(sha(bytes), asset.sha256, asset.id);
  sourceAssets.set(asset.id, bytes);
}
const base = {
  format: 'FPVRegionManifest.v1',
  id: 'urban-earthworks-study',
  revision: 'mixed-r1',
  title: {
    en: 'Urban earthworks — mixed geometry study',
    uk: 'Міські земляні споруди — дослідження змішаної геометрії',
  },
  grid: original.grid,
  spawns: original.spawns,
};
const terrain = { ...base, assets: [], chunks: [] },
  scenery = { ...base, assets: [], chunks: [] };
const terrainCells = [],
  sceneryCells = [];
let removedTriangles = 0,
  retainedTriangles = 0;
for (const chunk of original.chunks) {
  const source = validateSceneryCell(sourceAssets.get(`${chunk.id}-collision`).toString('utf8'));
  const compiled = compileSceneryCell(source);
  assert.deepEqual(Buffer.from(compiled.glb), sourceAssets.get(`${chunk.id}-scene`));
  const ground = source.surfaces.filter((surface) => surface.id === 'surface-0');
  assert.equal(ground.length, 1, 'Pinned original ground surface must be present once per cell');
  for (const surface of ground) {
    assert(surface.positionsMm.every((v, i) => i % 3 !== 1 || (v >= -1000 && v <= 0)));
    removedTriangles += surface.indices.length / 3;
  }
  const cell = {
    ...source,
    surfaces: source.surfaces.filter((surface) => surface.id !== 'surface-0'),
  };
  assert(cell.surfaces.length > 0, 'Scenery profile must retain real architecture');
  validateSceneryCell(cell);
  sceneryCells.push(cell);
  for (const surface of cell.surfaces)
    for (let i = 0; i < surface.positionsMm.length; i += 3)
      if (surface.positionsMm[i + 1] === 0)
        assert.equal(
          heightMm(
            chunk.x * 128 + surface.positionsMm[i] / 1000,
            chunk.z * 128 + surface.positionsMm[i + 2] / 1000,
          ),
          0,
          'Retained architecture foundations must stay flat',
        );
  retainedTriangles += cell.surfaces.reduce((n, s) => n + s.indices.length / 3, 0);
  const heightsMm = [];
  for (let z = 0; z < 33; z++)
    for (let x = 0; x < 33; x++)
      heightsMm.push(heightMm(chunk.x * 128 + x * 4, chunk.z * 128 + z * 4));
  terrainCells.push({
    format: TERRAIN_FORMAT,
    chunkId: chunk.id,
    x: chunk.x,
    z: chunk.z,
    cellSizeMm: 128000,
    samples: 33,
    heightsMm,
  });
}
validateTerrainSeams(terrainCells);
for (const spawn of original.spawns)
  assert.equal(heightMm(spawn.position.x / 1000, spawn.position.z / 1000), 0);
await mkdir(output, { recursive: false });
for (const [profile, manifest, cells, compile] of [
  ['terrain', terrain, terrainCells, compileTerrainCell],
  ['scenery', scenery, sceneryCells, compileSceneryCell],
]) {
  await mkdir(resolve(output, profile));
  for (const cell of cells) {
    const compiled = compile(cell);
    for (const [kind, extension, bytes] of [
      ['scene', 'glb', compiled.glb],
      ['collision', 'json', json(cell)],
    ]) {
      const id = `${cell.chunkId}-${kind}`,
        path = `${cell.chunkId}.${extension}`;
      await writeFile(resolve(output, profile, path), bytes);
      manifest.assets.push({ id, path, kind, bytes: bytes.length, sha256: sha(bytes) });
    }
    manifest.chunks.push({
      id: cell.chunkId,
      x: cell.x,
      z: cell.z,
      assets: [`${cell.chunkId}-scene`, `${cell.chunkId}-collision`],
    });
  }
  validateRegionManifest(manifest);
  await writeFile(resolve(output, profile, 'region.json'), json(manifest));
}
for (const field of ['id', 'revision', 'grid', 'spawns', 'chunks'])
  assert.deepEqual(terrain[field], scenery[field]);
const receipt = {
  format: 'FPVUrbanMixedPreparation.v1',
  id: base.id,
  revision: base.revision,
  actualSizeM: [384, 384],
  sourceManifestSHA256: sha(sourceManifest),
  sourceProvenanceSHA256: sha(sourceProvenance),
  sourceSceneSHA256: JSON.parse(sourceProvenance).sourceSceneSHA256,
  licenseReceipt: 'authoring/fpv-worlds/assets/kenney/city-industrial/provenance.json',
  licenseReceiptSHA256: JSON.parse(sourceProvenance).licenseReceiptSHA256,
  bundledLicense: 'License.txt',
  bundledLicenseSHA256: sha(license),
  terrainManifestSHA256: sha(json(terrain)),
  sceneryManifestSHA256: sha(json(scenery)),
  cellsPerProfile: 9,
  assets: terrain.assets.length + scenery.assets.length,
  sourceBytes: [...terrain.assets, ...scenery.assets].reduce((n, a) => n + a.bytes, 0),
  removedGroundTriangles: removedTriangles,
  retainedArchitectureTriangles: retainedTriangles,
  terrainTriangles: terrainCells.length * 32 * 32 * 2,
  maximumTerrainHeightMm: Math.max(...terrainCells.flatMap((cell) => cell.heightsMm)),
  earthworks,
  routes,
  flightReady: false,
  limitations: [
    'Bounded geometry/material study, not a default player region',
    'Route sweeps are geometry checks, not recorded or scored demonstrations',
    'Combined-owner flight, recovery and package/device qualification remain required',
  ],
};
await writeFile(resolve(output, 'original-provenance.json'), sourceProvenance);
await writeFile(resolve(output, 'license-provenance.json'), licenseProvenance);
await writeFile(resolve(output, 'License.txt'), license);
await writeFile(resolve(output, 'preparation.json'), json(receipt));
console.log(JSON.stringify(receipt, null, 2));
