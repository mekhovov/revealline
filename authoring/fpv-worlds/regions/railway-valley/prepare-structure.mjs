/** Immutable successor to the pinned Railway pilot; existing source files are never overwritten. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validateRegionManifest } from '../region-manifest.mjs';
import {
  compileScenerySource,
  validateScenerySource,
  scenerySourceResources,
} from '../indexed-scenery-cell.mjs';
import { createStructuralDetail, structuralProbes } from './structural-detail.mjs';

const [input, output] = process.argv.slice(2);
assert(input && output, 'Provide the pinned pilot directory and a new external output directory');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(JSON.stringify(value) + '\n');
const pins = {
  terrain: '74fed25caacb37797094706a0257e562c8ac594781578948d6789ea89120e8fd',
  scenery: 'ac591533ee71318cf631e79b8513eb7df61733e86578c8113d879c449f6ebcdb',
};
const parent = JSON.parse(await readFile(resolve(input, 'preparation.json'), 'utf8'));
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
const additions = createStructuralDetail(),
  groups = new Map();
for (const piece of additions) {
  const x = Math.floor(piece.centre[0] / 128),
    z = Math.floor(piece.centre[2] / 128);
  const key = `${x}-${z}-${piece.color.join(',')}`;
  if (!groups.has(key))
    groups.set(key, {
      x,
      z,
      surface: { id: `structure-${groups.size}`, color: piece.color, positionsMm: [], indices: [] },
    });
  const surface = groups.get(key).surface,
    offset = surface.positionsMm.length / 3;
  piece.positionsMm.forEach((value, index) => {
    const local = value - (index % 3 === 0 ? x * 128000 : index % 3 === 2 ? z * 128000 : 0);
    if (index % 3 !== 1)
      assert(local >= 0 && local <= 128000, `${piece.id}: crosses cell boundary`);
    surface.positionsMm.push(local);
  });
  surface.indices.push(...piece.indices.map((index) => index + offset));
}
const changed = new Map();
for (const { x, z, surface } of groups.values()) {
  const path = `railway-${x}-${z}.json`;
  if (!changed.has(path)) changed.set(path, JSON.parse(layers.scenery.assets.get(path)));
  const source = changed.get(path);
  (source.cell ?? source).surfaces.push(surface);
}
for (const [path, source] of changed) {
  validateScenerySource(source);
  layers.scenery.assets.set(path, json(source));
  layers.scenery.assets.set(
    path.replace('.json', '.glb'),
    Buffer.from(compileScenerySource(source).glb),
  );
}
const resources = scenerySourceResources(
  [...layers.scenery.assets]
    .filter(([path]) => path.endsWith('.json'))
    .map(([, bytes]) => JSON.parse(bytes)),
);
assert(
  resources.resourceBytes + 456408 < 6 * 1024 * 1024,
  'Combined representative window exceeds6MiB',
);
const license = await readFile(resolve(input, 'License.txt'));
const provenance = await readFile(resolve(input, 'source-provenance.json'));
assert.equal(sha(license), parent.licenseSHA256);
assert.equal(sha(provenance), parent.sourceReceiptSHA256);
await mkdir(output, { recursive: false });
const manifests = {};
for (const [profile, layer] of Object.entries(layers)) {
  await mkdir(resolve(output, profile));
  const manifest = structuredClone(layer.manifest);
  manifest.revision = 'structure-r1';
  manifest.title = {
    en: 'Railway Valley — structural study',
    uk: 'Залізнична долина — дослідження конструкцій',
  };
  manifest.assets = manifest.assets.map((asset) => ({
    ...asset,
    bytes: layer.assets.get(asset.path).length,
    sha256: sha(layer.assets.get(asset.path)),
  }));
  validateRegionManifest(manifest);
  for (const [path, bytes] of layer.assets) await writeFile(resolve(output, profile, path), bytes);
  await writeFile(resolve(output, profile, 'region.json'), json(manifest));
  manifests[profile] = manifest;
}
for (const field of ['id', 'revision', 'grid', 'spawns', 'chunks'])
  assert.deepEqual(manifests.terrain[field], manifests.scenery[field]);
const receipt = {
  ...parent,
  revision: 'structure-r1',
  parentTerrainManifestSHA256: pins.terrain,
  parentSceneryManifestSHA256: pins.scenery,
  terrainManifestSHA256: sha(json(manifests.terrain)),
  sceneryManifestSHA256: sha(json(manifests.scenery)),
  sourceBytes: Object.values(manifests)
    .flatMap((m) => m.assets)
    .reduce((sum, a) => sum + a.bytes, 0),
  geometryBytes: resources.geometryBytes,
  textureBytes: resources.textureBytes,
  resourceBytes: resources.resourceBytes,
  structure: {
    originalAuthored: true,
    pieces: additions.length,
    surfaces: groups.size,
    triangles: additions.reduce((sum, p) => sum + p.indices.length / 3, 0),
    parentTerrainUnchanged: true,
    parentSurfacesUnchanged: true,
    probes: structuralProbes,
  },
  playerReady: false,
};
assert(receipt.structure.triangles <= 1200);
await writeFile(resolve(output, 'License.txt'), license);
await writeFile(resolve(output, 'source-provenance.json'), provenance);
await writeFile(resolve(output, 'parent-preparation.json'), JSON.stringify(parent, null, 2) + '\n');
await writeFile(resolve(output, 'preparation.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
