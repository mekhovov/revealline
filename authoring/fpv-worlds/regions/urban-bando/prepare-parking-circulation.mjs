/** Immutable original architecture increment; source bytes and previous collision surfaces are retained. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validateRegionManifest } from '../region-manifest.mjs';
import { compileSceneryCell, validateSceneryCell } from '../scenery-cell.mjs';
import {
  createParkingCirculation,
  parkingCirculationProbes,
  parkingFlightLine,
} from './parking-circulation.mjs';

const [input, output] = process.argv.slice(2);
assert(input && output, 'Provide hall mixed-r3 and a new external output directory');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const pins = {
  terrain: 'ce072898c33690f9bac94195cc997e620e9846885226fee5ef222f31451f97dc',
  scenery: 'a257ff0391703ffc1b7108e6f5bd988cd4ff61e3e1bbccafb96e89865ea162db',
};
const parent = JSON.parse(await readFile(resolve(input, 'preparation.json'), 'utf8'));
assert.deepEqual(
  parent,
  JSON.parse(await readFile(new URL('./hall-preparation.json', import.meta.url), 'utf8')),
);
const layers = {};
for (const profile of ['terrain', 'scenery']) {
  const bytes = await readFile(resolve(input, profile, 'region.json'));
  assert.equal(sha(bytes), pins[profile]);
  const manifest = validateRegionManifest(bytes.toString('utf8')),
    assets = new Map();
  for (const asset of manifest.assets) {
    const data = await readFile(resolve(input, profile, asset.path));
    assert.equal(data.length, asset.bytes);
    assert.equal(sha(data), asset.sha256);
    assets.set(asset.path, data);
  }
  layers[profile] = { manifest, assets };
}
const details = createParkingCirculation();
const target = JSON.parse(layers.scenery.assets.get('urban-0-1.json'));
for (const surface of details) {
  const positionsMm = surface.positionsMm.map(
    (value, index) => value - (index % 3 === 2 ? 128000 : 0),
  );
  target.surfaces.push({ ...surface, positionsMm });
}
validateSceneryCell(target);
layers.scenery.assets.set('urban-0-1.json', json(target));
layers.scenery.assets.set('urban-0-1.glb', Buffer.from(compileSceneryCell(target).glb));
const licenseFiles = new Map();
for (const [file, hash] of [
  ['original-provenance.json', parent.sourceProvenanceSHA256],
  ['license-provenance.json', parent.licenseReceiptSHA256],
  ['License.txt', parent.bundledLicenseSHA256],
]) {
  const bytes = await readFile(resolve(input, file));
  assert.equal(sha(bytes), hash);
  licenseFiles.set(file, bytes);
}
await mkdir(output, { recursive: false });
const manifests = {};
for (const [profile, layer] of Object.entries(layers)) {
  await mkdir(resolve(output, profile));
  const manifest = structuredClone(layer.manifest);
  manifest.revision = 'mixed-r4';
  manifest.title = {
    en: 'Urban parking — circulation study',
    uk: 'Міський паркінг — дослідження маршрутів',
  };
  manifest.assets = manifest.assets.map((asset) => {
    const bytes = layer.assets.get(asset.path);
    return { ...asset, bytes: bytes.length, sha256: sha(bytes) };
  });
  validateRegionManifest(manifest);
  for (const [path, bytes] of layer.assets) await writeFile(resolve(output, profile, path), bytes);
  await writeFile(resolve(output, profile, 'region.json'), json(manifest));
  manifests[profile] = manifest;
}
for (const field of ['id', 'revision', 'grid', 'spawns', 'chunks'])
  assert.deepEqual(manifests.terrain[field], manifests.scenery[field]);
const addedTriangles = details.reduce((sum, surface) => sum + surface.indices.length / 3, 0);
assert(addedTriangles <= 600, 'Parking circulation exceeds its 600-triangle addition budget');
const receipt = {
  ...parent,
  revision: 'mixed-r4',
  parentTerrainManifestSHA256: pins.terrain,
  parentSceneryManifestSHA256: pins.scenery,
  terrainManifestSHA256: sha(json(manifests.terrain)),
  sceneryManifestSHA256: sha(json(manifests.scenery)),
  sourceBytes: Object.values(manifests)
    .flatMap((m) => m.assets)
    .reduce((sum, asset) => sum + asset.bytes, 0),
  retainedArchitectureTriangles: parent.retainedArchitectureTriangles + addedTriangles,
  parentArchitectureTriangles: parent.retainedArchitectureTriangles,
  addedArchitectureTriangles: addedTriangles,
  parkingCirculation: {
    originalAuthored: true,
    sharedGeometryLibrary: 'existing pinned Three vendor',
    addedSurfaces: details.length,
    addedTriangles,
    allPreviousSurfacesUnchanged: true,
    exactRenderCollision: true,
    probes: parkingCirculationProbes,
    flightLine: parkingFlightLine,
  },
  flightReady: false,
};
for (const [path, bytes] of licenseFiles) await writeFile(resolve(output, path), bytes);
await writeFile(resolve(output, 'parent-preparation.json'), json(parent));
await writeFile(resolve(output, 'preparation.json'), json(receipt));
console.log(
  JSON.stringify(
    {
      terrainManifestSHA256: receipt.terrainManifestSHA256,
      sceneryManifestSHA256: receipt.sceneryManifestSHA256,
      sourceBytes: receipt.sourceBytes,
      addedSurfaces: details.length,
      addedTriangles,
      flightReady: false,
    },
    null,
    2,
  ),
);
