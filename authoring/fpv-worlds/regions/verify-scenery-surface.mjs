/** Geometry/query regression for the optional appearance profile; GPU review is separate. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareSceneryWindow } from './scenery-admission.mjs';
import { createVerifiedSceneryWindow } from './verified-scenery-window.mjs';
import { createScenerySurface, urbanSurfaceKind } from './scenery-surface.mjs';
import { probes, boxes } from './urban-bando/layout.mjs';

const directory = process.argv[2];
assert(directory, 'Provide original verified Urban regional output');
const manifest = JSON.parse(await readFile(resolve(directory, 'region.json'), 'utf8'));
const cells = [];
for (const asset of manifest.assets.filter((a) => a.kind === 'collision')) {
  const bytes = await readFile(resolve(directory, asset.path));
  assert.equal(bytes.length, asset.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  cells.push(JSON.parse(bytes));
}
for (const cell of cells)
  for (const surface of cell.surfaces)
    if (Number(surface.id.split('-')[1]) >= boxes.length)
      assert.equal(urbanSurfaceKind(surface.color), 0, 'Licensed prop palette stays unchanged');
assert.equal(urbanSurfaceKind([0.43, 0.23, 0.15]), 2);
assert.equal(urbanSurfaceKind([0.2, 0.2, 0.2]), 0, 'Unrelated prop palette stays unchanged');
assert.throws(
  () =>
    createVerifiedSceneryWindow(manifest, {
      baseURL: 'http://127.0.0.1/',
      surfaceStyle: 'unknown',
    }),
  /surface profile/,
);
assert.throws(() => createScenerySurface({ color: [NaN, 0, 0] }), /valid colour/);
const mm = (p) => ({ x: p[0] * 1000, y: p[1] * 1000, z: p[2] * 1000 });
let baseline;
for (const surfaceStyle of ['plain', 'urban']) {
  const owner = await prepareSceneryWindow(manifest, cells, {
    requiredChunkIds: manifest.chunks.map((c) => c.id),
    surfaceStyle,
  });
  try {
    const surfaces = owner.group.children.map((mesh) => ({
      positions: [...mesh.geometry.attributes.position.array],
      normals: [...mesh.geometry.attributes.normal.array],
      indices: [...mesh.geometry.index.array],
      local: mesh.position.toArray(),
    }));
    const queries = probes.map((p) => {
      const result = owner.sweep(mm(p.from), mm(p.to), 250);
      assert.equal(result.status, p.clear ? 'scenery-clear' : 'scenery-hit', p.id);
      return result;
    });
    const receipt = {
      surfaces,
      queries,
      geometryBytes: owner.snapshot().geometryBytes,
      colliders: owner.snapshot().colliders,
    };
    if (!baseline) baseline = receipt;
    else
      assert.deepEqual(
        receipt,
        baseline,
        'Appearance must preserve all geometry and collision results',
      );
    const materials = new Set(owner.group.children.map((mesh) => mesh.material));
    let disposed = 0;
    for (const material of materials) material.addEventListener('dispose', () => disposed++);
    owner.dispose();
    assert.equal(disposed, materials.size);
    assert.equal(owner.snapshot().geometryBytes, 0);
    assert.equal(owner.snapshot().colliders, 0);
  } finally {
    owner.dispose();
  }
}
console.log(
  JSON.stringify(
    {
      passed: true,
      comparedMeshes: baseline.surfaces.length,
      geometryBytes: baseline.geometryBytes,
      identicalCollisionQueries: probes.length,
      geometryIdentity: true,
      disposed: true,
      gpuCompilation: 'requires actual browser review',
    },
    null,
    2,
  ),
);
