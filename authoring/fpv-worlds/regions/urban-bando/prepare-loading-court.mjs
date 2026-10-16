/** New immutable companion revision; preserves original sources and existing architecture. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validateRegionManifest } from '../region-manifest.mjs';
import { compileSceneryCell, validateSceneryCell } from '../scenery-cell.mjs';
import { compileTerrainCell } from '../terrain-cell.mjs';
import { heightMm } from './mixed-design.mjs';
import { courtContainers, courtRoute } from './loading-court.mjs';

const [input, output] = process.argv.slice(2);
assert(input && output, 'Provide mixed-r1 directory and new external output directory');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const pins = {
  terrain: 'd0ec271c419a4b2032e359e5e8106e8089a10f26dd5e0251536629e3fa35f25f',
  scenery: 'd0794c442362dcf95885ef7db417e8d3480db179a2dce2d0f026b65cf075de17',
};
const manifests = {},
  bytes = {},
  cells = {};
for (const profile of ['terrain', 'scenery']) {
  const source = await readFile(resolve(input, profile, 'region.json'));
  assert.equal(sha(source), pins[profile]);
  manifests[profile] = validateRegionManifest(source.toString('utf8'));
  bytes[profile] = new Map();
  cells[profile] = [];
  for (const asset of manifests[profile].assets) {
    const value = await readFile(resolve(input, profile, asset.path));
    assert.equal(value.length, asset.bytes);
    assert.equal(sha(value), asset.sha256);
    bytes[profile].set(asset.path, value);
  }
  for (const chunk of manifests[profile].chunks) {
    const cell = JSON.parse(bytes[profile].get(`${chunk.id}.json`));
    const compiled = profile === 'terrain' ? compileTerrainCell(cell) : compileSceneryCell(cell);
    assert.deepEqual(Buffer.from(compiled.glb), bytes[profile].get(`${chunk.id}.glb`));
    cells[profile].push(cell);
  }
}
const templates = cells.scenery.flatMap((cell) =>
  cell.surfaces.filter((s) => s.id === 'surface-71').map((surface) => ({ cell, surface })),
);
assert.equal(templates.length, 1, 'Pinned complete container must belong to one source cell');
const { cell: templateCell, surface: template } = templates[0];
const added = [];
for (const item of courtContainers) {
  const positionsMm = [];
  for (let i = 0; i < template.positionsMm.length; i += 3) {
    const x = (template.positionsMm[i] + templateCell.x * 128000 - 304000) * 0.45;
    const y = template.positionsMm[i + 1] * 0.51;
    const z = template.positionsMm[i + 2] + templateCell.z * 128000 - 82000;
    positionsMm.push(
      Math.round((item.yaw === 90 ? z : x) + item.centre[0] * 1000),
      Math.round(y + item.centre[1] * 1000),
      Math.round((item.yaw === 90 ? -x : z) + item.centre[2] * 1000),
    );
  }
  const x = Math.floor(positionsMm[0] / 128000),
    z = Math.floor(positionsMm[2] / 128000);
  for (let i = 0; i < positionsMm.length; i += 3) {
    assert.equal(Math.floor(positionsMm[i] / 128000), x, 'Complete copy must fit one cell');
    assert.equal(Math.floor(positionsMm[i + 2] / 128000), z, 'Complete copy must fit one cell');
    assert.equal(
      heightMm(positionsMm[i] / 1000, positionsMm[i + 2] / 1000),
      0,
      'Containers need flat terrain',
    );
    positionsMm[i] -= x * 128000;
    positionsMm[i + 2] -= z * 128000;
  }
  const destination = cells.scenery.find((c) => c.x === x && c.z === z);
  const surface = {
    id: `court-${item.id}`,
    positionsMm,
    indices: [...template.indices],
    color: item.color,
  };
  destination.surfaces.push(surface);
  validateSceneryCell(destination);
  added.push({
    ...item,
    chunkId: destination.chunkId,
    triangles: surface.indices.length / 3,
    adaptedSizeM: [2.446, 2.59, 12],
  });
}
const sourceReceipt = JSON.parse(await readFile(resolve(input, 'preparation.json'), 'utf8'));
assert.deepEqual(
  sourceReceipt,
  JSON.parse(await readFile(new URL('./mixed-preparation.json', import.meta.url), 'utf8')),
  'Parent receipt must match the committed immutable preparation',
);
const provenanceFiles = new Map();
for (const [file, hash] of [
  ['original-provenance.json', sourceReceipt.sourceProvenanceSHA256],
  ['license-provenance.json', sourceReceipt.licenseReceiptSHA256],
  ['License.txt', sourceReceipt.bundledLicenseSHA256],
]) {
  const data = await readFile(resolve(input, file));
  assert.equal(sha(data), hash);
  provenanceFiles.set(file, data);
}
await mkdir(output, { recursive: false });
const out = {};
for (const profile of ['terrain', 'scenery']) {
  await mkdir(resolve(output, profile));
  const manifest = structuredClone(manifests[profile]);
  manifest.revision = 'mixed-r2';
  manifest.title = {
    en: 'Urban loading courts — composition study',
    uk: 'Міські вантажні двори — дослідження композиції',
  };
  manifest.assets = [];
  for (const cell of cells[profile]) {
    const compiled = profile === 'terrain' ? compileTerrainCell(cell) : compileSceneryCell(cell);
    for (const [kind, extension, data] of [
      ['scene', 'glb', compiled.glb],
      ['collision', 'json', json(cell)],
    ]) {
      const path = `${cell.chunkId}.${extension}`;
      if (profile === 'terrain')
        assert.deepEqual(
          Buffer.from(data),
          bytes.terrain.get(path),
          'Terrain must remain byte-identical',
        );
      await writeFile(resolve(output, profile, path), data);
      manifest.assets.push({
        id: `${cell.chunkId}-${kind}`,
        path,
        kind,
        bytes: data.length,
        sha256: sha(data),
      });
    }
  }
  validateRegionManifest(manifest);
  await writeFile(resolve(output, profile, 'region.json'), json(manifest));
  out[profile] = manifest;
}
for (const field of ['id', 'revision', 'grid', 'spawns', 'chunks'])
  assert.deepEqual(out.terrain[field], out.scenery[field]);
const retainedArchitectureTriangles = cells.scenery.reduce(
  (sum, c) => sum + c.surfaces.reduce((n, s) => n + s.indices.length / 3, 0),
  0,
);
const receipt = {
  ...sourceReceipt,
  revision: 'mixed-r2',
  parentTerrainManifestSHA256: pins.terrain,
  parentSceneryManifestSHA256: pins.scenery,
  terrainManifestSHA256: sha(json(out.terrain)),
  sceneryManifestSHA256: sha(json(out.scenery)),
  sourceBytes: [...out.terrain.assets, ...out.scenery.assets].reduce((n, a) => n + a.bytes, 0),
  retainedArchitectureTriangles,
  parentArchitectureTriangles: sourceReceipt.retainedArchitectureTriangles,
  addedArchitectureTriangles: added.reduce((n, item) => n + item.triangles, 0),
  routes: [...sourceReceipt.routes, courtRoute],
  containerAdaptation: {
    sourceSurface: 'surface-71',
    sourceSceneSHA256: sourceReceipt.sourceSceneSHA256,
    scale: [0.45, 0.51, 1],
    approximateSizeM: [2.446, 2.59, 12],
    containers: added,
    oldGeometryUnchanged: true,
  },
  flightReady: false,
};
for (const [file, data] of provenanceFiles) await writeFile(resolve(output, file), data);
await writeFile(resolve(output, 'parent-preparation.json'), json(sourceReceipt));
await writeFile(resolve(output, 'preparation.json'), json(receipt));
console.log(
  JSON.stringify(
    {
      terrainManifestSHA256: receipt.terrainManifestSHA256,
      sceneryManifestSHA256: receipt.sceneryManifestSHA256,
      sourceBytes: receipt.sourceBytes,
      addedContainers: added.length,
      addedTriangles: added.reduce((n, a) => n + a.triangles, 0),
      retainedArchitectureTriangles,
      flightReady: false,
    },
    null,
    2,
  ),
);
