/** New immutable source revision. Visible terrain and collision change together; r1 is retained. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { compileTerrainCell, validateTerrainSeams } from '../terrain-cell.mjs';
import { compileSceneryCell } from '../scenery-cell.mjs';
import { validateRegionManifest } from '../region-manifest.mjs';
import { reliefHeightMm } from './relief-design.mjs';

const [input, output] = process.argv.slice(2);
assert(input && output, 'Provide accepted landmark r1 source and a new external output directory');
const json = (v) => Buffer.from(JSON.stringify(v, null, 2) + '\n');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const parent = JSON.parse(await readFile(resolve(input, 'preparation.json')));
assert.deepEqual(
  parent,
  JSON.parse(await readFile(new URL('./landmark-preparation.json', import.meta.url))),
);
const layers = {};
for (const profile of ['terrain', 'scenery']) {
  const bytes = await readFile(resolve(input, profile, 'region.json'));
  assert.equal(sha(bytes), parent[`${profile}ManifestSHA256`]);
  const manifest = validateRegionManifest(bytes.toString()),
    bodies = new Map();
  for (const asset of manifest.assets) {
    const body = await readFile(resolve(input, profile, asset.path));
    assert.equal(sha(body), asset.sha256);
    assert.equal(body.length, asset.bytes);
    bodies.set(asset.path, body);
  }
  layers[profile] = { manifest: structuredClone(manifest), bodies };
}
const terrainCells = [],
  changes = [],
  originalHeights = new Map(),
  nextHeights = new Map();
for (const asset of layers.terrain.manifest.assets.filter((a) => a.kind === 'collision')) {
  const previous = JSON.parse(layers.terrain.bodies.get(asset.path));
  const cell = structuredClone(previous);
  cell.heightsMm = cell.heightsMm.map((height, i) => {
    const next = reliefHeightMm(cell.x * 128 + (i % 33) * 4, cell.z * 128 + Math.floor(i / 33) * 4);
    const key = `${cell.x * 32 + (i % 33)},${cell.z * 32 + Math.floor(i / 33)}`;
    originalHeights.set(key, height);
    nextHeights.set(key, next);
    changes.push(next - height);
    return next;
  });
  terrainCells.push(cell);
  layers.terrain.bodies.set(asset.path, json(cell));
  layers.terrain.bodies.set(
    asset.path.replace(/\.json$/, '.glb'),
    Buffer.from(compileTerrainCell(cell).glb),
  );
}
validateTerrainSeams(terrainCells);
assert(
  changes.every((change) => Math.abs(change) <= 10000),
  'Relief exceeds the 10 m study bound',
);
function profileHinges(heights) {
  let maximum = 0,
    total = 0,
    over30 = 0,
    samples = 0;
  for (let z = 1; z < 96; z++)
    for (let x = 1; x < 96; x++)
      for (const [dx, dz] of [
        [1, 0],
        [0, 1],
      ]) {
        const a = heights.get(`${x - dx},${z - dz}`),
          b = heights.get(`${x},${z}`),
          c = heights.get(`${x + dx},${z + dz}`);
        const angle =
          (Math.abs(Math.atan((c - b) / 4000) - Math.atan((b - a) / 4000)) * 180) / Math.PI;
        maximum = Math.max(maximum, angle);
        total += angle;
        over30 += angle > 30;
        samples++;
      }
  return {
    samples,
    maximumDegrees: Math.round(maximum * 1000) / 1000,
    meanDegrees: Math.round((total / samples) * 1000) / 1000,
    hingesOver30Degrees: over30,
  };
}
const profileComparison = {
  original: profileHinges(originalHeights),
  revised: profileHinges(nextHeights),
};
assert(
  profileComparison.revised.hingesOver30Degrees < profileComparison.original.hingesOver30Degrees,
);
const objects = [];
for (const object of parent.objects) {
  // Keep authored horizontal composition; re-seat each formation on the revised ground.
  const center = [...object.center];
  const boundsMm = object.boundsMm.map((bounds) => [...bounds]);
  let min = Infinity;
  for (
    let x = Math.floor(boundsMm[0][0] / 4000) * 4;
    x <= Math.ceil(boundsMm[0][1] / 4000) * 4;
    x += 4
  )
    for (
      let z = Math.floor(boundsMm[1][0] / 4000) * 4;
      z <= Math.ceil(boundsMm[1][1] / 4000) * 4;
      z += 4
    )
      min = Math.min(min, reliefHeightMm(x, z));
  const baseMm = min - 800,
    shift = baseMm - object.baseMm;
  const path = `canyon-${Math.floor(object.center[0] / 128)}-${Math.floor(object.center[1] / 128)}.json`;
  const cell = JSON.parse(layers.scenery.bodies.get(path));
  for (const surface of cell.surfaces.filter((s) => s.id.startsWith(object.id + '-band-')))
    surface.positionsMm = surface.positionsMm.map((v, i) => v + (i % 3 === 1 ? shift : 0));
  layers.scenery.bodies.set(path, json(cell));
  objects.push({
    ...object,
    center,
    boundsMm,
    baseMm,
    topMm: object.topMm + shift,
    priorBaseMm: object.baseMm,
    priorCenter: object.center,
  });
}
for (const asset of layers.scenery.manifest.assets.filter((a) => a.kind === 'collision')) {
  const cell = JSON.parse(layers.scenery.bodies.get(asset.path));
  layers.scenery.bodies.set(
    asset.path.replace(/\.json$/, '.glb'),
    Buffer.from(compileSceneryCell(cell).glb),
  );
}
await mkdir(output, { recursive: false });
const manifests = {};
for (const [profile, layer] of Object.entries(layers)) {
  await mkdir(resolve(output, profile));
  if (profile === 'terrain') await mkdir(resolve(output, profile, 'terrain'));
  layer.manifest.revision = 'r2';
  layer.manifest.title = {
    en: 'Canyon arrival — rounded relief study',
    uk: 'Вхід у каньйон — дослідження плавного рельєфу',
  };
  layer.manifest.assets = layer.manifest.assets.map((asset) => ({
    ...asset,
    sha256: sha(layer.bodies.get(asset.path)),
    bytes: layer.bodies.get(asset.path).length,
  }));
  validateRegionManifest(layer.manifest);
  for (const [path, bytes] of layer.bodies) await writeFile(resolve(output, profile, path), bytes);
  await writeFile(resolve(output, profile, 'region.json'), json(layer.manifest));
  manifests[profile] = layer.manifest;
}
const receipt = {
  ...parent,
  revision: 'r2',
  parentTerrainManifestSHA256: parent.terrainManifestSHA256,
  parentSceneryManifestSHA256: parent.sceneryManifestSHA256,
  terrainManifestSHA256: sha(json(manifests.terrain)),
  sceneryManifestSHA256: sha(json(manifests.scenery)),
  sourceBytes: Object.values(manifests)
    .flatMap((m) => m.assets)
    .reduce((sum, a) => sum + a.bytes, 0),
  byteIdenticalTerrainAssets: 0,
  objects,
  relief: {
    originalSourcePreserved: true,
    originalMeshTopologyPreserved: true,
    sourceHeightChanges: changes.filter((v) => v !== 0).length,
    maximumRaiseMm: Math.max(...changes),
    maximumLowerMm: -Math.min(...changes),
    profileComparison,
    sceneryChange:
      'Vertical grounding only; horizontal positions, mesh topology, dimensions and colours preserved',
    surfaceMaterial: 'Unchanged; periodic strata remain a separate appearance issue',
  },
  flightReady: false,
};
for (const file of ['source-provenance.json', 'README-upstream.txt'])
  await writeFile(resolve(output, file), await readFile(resolve(input, file)));
await writeFile(resolve(output, 'preparation.json'), json(receipt));
await writeFile(resolve(output, 'parent-preparation.json'), json(parent));
console.log(
  JSON.stringify(
    {
      terrainManifestSHA256: receipt.terrainManifestSHA256,
      sceneryManifestSHA256: receipt.sceneryManifestSHA256,
      sourceBytes: receipt.sourceBytes,
      ...receipt.relief,
    },
    null,
    2,
  ),
);
