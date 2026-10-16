/** Serialized source audit: preserve prior geometry and verify attached detail. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { sampledHeight } from './relief.mjs';
import { lunarViews } from './views.mjs';
assert(process.argv[2] && process.argv[3], 'Provide new and preserved composition directories');
const root = resolve(process.argv[2]),
  previous = resolve(process.argv[3]);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function load(source, layer) {
  const manifest = JSON.parse(await readFile(resolve(source, layer, 'region.json')));
  const cells = new Map(),
    solids = new Map();
  for (const asset of manifest.assets) {
    const bytes = await readFile(resolve(source, layer, asset.path));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(hash(bytes), asset.sha256);
    if (asset.kind !== 'collision') continue;
    const cell = JSON.parse(bytes);
    cells.set(asset.path, cell);
    if (layer !== 'scenery') continue;
    for (const surface of cell.surfaces) {
      const list = solids.get(surface.id) ?? [];
      const points = [];
      for (let i = 0; i < surface.positionsMm.length; i += 3)
        points.push(
          new THREE.Vector3(
            surface.positionsMm[i] / 1000 + cell.x * 128,
            surface.positionsMm[i + 1] / 1000,
            surface.positionsMm[i + 2] / 1000 + cell.z * 128,
          ),
        );
      for (let i = 0; i < surface.indices.length; i += 3)
        list.push(surface.indices.slice(i, i + 3).map((index) => points[index]));
      solids.set(surface.id, list);
    }
  }
  return { manifest, cells, solids };
}
const current = await load(root, 'scenery'),
  old = await load(previous, 'scenery');
assert.equal(current.manifest.revision, 'composition-r3');
let preservedSurfaces = 0;
for (const [path, cell] of old.cells) {
  const next = current.cells.get(path);
  assert(next);
  for (const surface of cell.surfaces) {
    assert.deepEqual(
      next.surfaces.find((item) => item.id === surface.id),
      surface,
      'Prior surface changed: ' + surface.id,
    );
    preservedSurfaces++;
  }
}
const added = [...current.solids.keys()].filter((id) => !old.solids.has(id));
assert.equal(added.length, 38);
assert(
  added.every((id) =>
    /^(survey-shelter|service-gallery)-(roof-rib|side-stringer|equipment-plinth|equipment-cabinet|instrument-backing|instrument-strip|cabinet-cap)-/.test(
      id,
    ),
  ),
);
function bounds(id) {
  const triangles = current.solids.get(id);
  assert(triangles, 'Missing solid ' + id);
  return [0, 1, 2].map((axis) => [
    Math.min(...triangles.flat().map((point) => point.getComponent(axis))),
    Math.max(...triangles.flat().map((point) => point.getComponent(axis))),
  ]);
}
function intersects(a, b) {
  assert(
    a.every((range, axis) => range[1] >= b[axis][0] - 0.002 && b[axis][1] >= range[0] - 0.002),
    'Detached detail',
  );
}
function vertical(id, x, z) {
  const ray = new THREE.Ray(new THREE.Vector3(x, -1000, z), new THREE.Vector3(0, 1, 0)),
    heights = [];
  for (const triangle of current.solids.get(id)) {
    const hit = ray.intersectTriangle(...triangle, false, new THREE.Vector3());
    if (hit) heights.push(hit.y);
  }
  assert(heights.length, 'No actual triangle at support sample: ' + id);
  return [Math.min(...heights), Math.max(...heights)];
}
const structures = [];
for (const id of ['survey-shelter', 'service-gallery']) {
  const roofs = [0, 1, 2].map((i) => bounds(id + '-roof-' + i));
  for (let i = 0; i < 3; i++)
    assert(
      roofs.some((roof) => {
        const rib = bounds(id + '-roof-rib-' + i);
        return rib.every(
          (range, axis) => range[1] >= roof[axis][0] - 0.002 && roof[axis][1] >= range[0] - 0.002,
        );
      }),
      'Detached roof rib',
    );
  for (const side of ['w', 'e']) {
    const beam = bounds(id + '-side-stringer-' + side);
    assert(
      roofs.some((roof) =>
        beam.every(
          (range, axis) => range[1] >= roof[axis][0] - 0.002 && roof[axis][1] >= range[0] - 0.002,
        ),
      ),
    );
  }
  for (let i = 0; i < 2; i++) {
    const plinth = bounds(id + '-equipment-plinth-' + i),
      cabinet = bounds(id + '-equipment-cabinet-' + i),
      backing = bounds(id + '-instrument-backing-' + i);
    for (const x of [plinth[0][0] + 0.01, (plinth[0][0] + plinth[0][1]) / 2, plinth[0][1] - 0.01])
      for (const z of [
        plinth[2][0] + 0.01,
        (plinth[2][0] + plinth[2][1]) / 2,
        plinth[2][1] - 0.01,
      ]) {
        const support = vertical(id + '-equipment-plinth-' + i, x, z);
        assert(
          support[0] <= sampledHeight(x, z) + 0.002 && support[1] >= sampledHeight(x, z) - 0.002,
          'Plinth must meet terrain',
        );
      }
    intersects(plinth, cabinet);
    intersects(cabinet, backing);
    intersects(cabinet, bounds(id + '-cabinet-cap-' + i));
    for (let row = 0; row < 3; row++)
      intersects(backing, bounds(id + '-instrument-strip-' + i + '-' + row));
  }
  structures.push({
    id,
    attachedRibs: 3,
    attachedStringers: 2,
    groundedCabinets: 2,
  });
}
const detailSightlines = [];
for (const [name, , camera, target] of lunarViews.filter((view) => view[0].endsWith(' interior'))) {
  const start = new THREE.Vector3(...camera),
    end = new THREE.Vector3(...target);
  const distance = start.distanceTo(end),
    ray = new THREE.Ray(start, end.clone().sub(start).normalize());
  for (const [id, triangles] of current.solids)
    for (const triangle of triangles) {
      const hit = ray.intersectTriangle(...triangle, false, new THREE.Vector3());
      assert(
        !hit || hit.distanceTo(start) > distance,
        name + ': review sightline blocked by ' + id,
      );
    }
  detailSightlines.push(name);
}
assert.equal(detailSightlines.length, 2);
const terrain = await load(root, 'terrain'),
  oldTerrain = await load(previous, 'terrain');
assert.deepEqual(terrain.manifest.assets, oldTerrain.manifest.assets);
assert.deepEqual(terrain.manifest.spawns, oldTerrain.manifest.spawns);
assert.deepEqual(terrain.manifest.grid, oldTerrain.manifest.grid);
for (const asset of terrain.manifest.assets)
  assert.deepEqual(
    await readFile(resolve(root, 'terrain', asset.path)),
    await readFile(resolve(previous, 'terrain', asset.path)),
  );
console.log(
  JSON.stringify(
    {
      passed: true,
      sourceRevision: 'composition-r3',
      preservedSurfaces,
      addedSolids: added.length,
      detailSightlines,
      structures,
      terrainFilesIdentical: terrain.manifest.assets.length,
      nativeAccepted: false,
      playerReady: false,
    },
    null,
    2,
  ),
);
