/** Independent serialized-triangle contact check, not the generator's planned bounds. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { sampledHeight } from './relief.mjs';
const root = resolve(process.argv[2]),
  previous = resolve(process.argv[3]);
const manifest = JSON.parse(await readFile(resolve(root, 'scenery/region.json')));
assert.equal(manifest.revision, 'composition-r2');
const solids = new Map();
for (const asset of manifest.assets.filter((a) => a.kind === 'collision')) {
  const bytes = await readFile(resolve(root, 'scenery', asset.path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  const cell = JSON.parse(bytes);
  for (const surface of cell.surfaces) {
    const triangles = solids.get(surface.id) ?? [];
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
      triangles.push(surface.indices.slice(i, i + 3).map((index) => points[index]));
    solids.set(surface.id, triangles);
  }
}
function vertical(id, x, z) {
  const ray = new THREE.Ray(new THREE.Vector3(x, -10, z), new THREE.Vector3(0, 1, 0)),
    heights = [];
  for (const triangle of solids.get(id)) {
    const hit = ray.intersectTriangle(...triangle, false, new THREE.Vector3());
    if (hit) heights.push(hit.y);
  }
  assert(heights.length, id + ' has no intersection');
  return [Math.min(...heights), Math.max(...heights)];
}
const piers = [];
for (const dx of [-11, 11])
  for (const dz of [-11, 11]) {
    const id = `dish-leg-${dx < 0 ? 'w' : 'e'}-${dz < 0 ? 'n' : 's'}`,
      x = 608 + dx,
      z = 520 + dz;
    const [bottom, top] = vertical(id, x, z);
    const samples = [];
    for (const ox of [-0.74, 0, 0.74])
      for (const oz of [-0.74, 0, 0.74]) {
        const [underside] = vertical('survey-dish', x + ox, z + oz);
        samples.push(underside);
        assert.ok(top >= underside - 0.001, id + ' has a support gap');
      }
    assert.ok(bottom <= sampledHeight(x, z), id + ' is not grounded');
    assert.ok(top - Math.max(...samples) < 0.06, id + ' excessive penetration');
    piers.push({
      id,
      bottom,
      top,
      minimumOverlapM: top - Math.max(...samples),
      samples: samples.length,
    });
  }
for (let i = 0; i < 3; i++) {
  const id = `dish-feed-strut-${i}`;
  assert(solids.has(id));
  const angle = (i * Math.PI * 2) / 3,
    x = 608 + Math.cos(angle) * 15,
    z = 520 + Math.sin(angle) * 15;
  const shell = vertical('survey-dish', x, z),
    strut = vertical(id, x, z);
  assert.ok(strut[0] <= shell[1] + 0.001 && strut[1] >= shell[0], id + ' detached from shell');
}
const terrain = JSON.parse(await readFile(resolve(root, 'terrain/region.json'))),
  old = JSON.parse(await readFile(resolve(previous, 'terrain/region.json')));
assert.deepEqual(terrain.assets, old.assets);
assert.deepEqual(terrain.spawns, old.spawns);
assert.deepEqual(terrain.grid, old.grid);
for (const asset of terrain.assets)
  assert.deepEqual(
    await readFile(resolve(root, 'terrain', asset.path)),
    await readFile(resolve(previous, 'terrain', asset.path)),
  );
console.log(
  JSON.stringify(
    {
      passed: true,
      piers,
      receiverStruts: 3,
      terrainFilesIdentical: terrain.assets.length,
      sourceRevision: 'composition-r2',
      nativeAccepted: false,
    },
    null,
    2,
  ),
);
