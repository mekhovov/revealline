/** Exact licensed input closure only. Does not admit these assets to the player. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import validator from 'gltf-validator';

const receipt = JSON.parse(await readFile(new URL('./source-provenance.json', import.meta.url)));
assert.equal(receipt.format, 'FPVRailwaySourceIntake.v1');
const root = new URL('./source/', import.meta.url);
const bodies = new Map();
for (const file of receipt.files) {
  assert(!file.path.includes('..') && !file.path.startsWith('/'));
  const bytes = await readFile(new URL(file.path, root));
  assert.equal(bytes.length, file.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
  bodies.set(file.path, bytes);
}
assert.match(bodies.get('License.txt').toString(), /Creative Commons Zero, CC0/);
assert.equal(
  [...bodies.values()].reduce((sum, bytes) => sum + bytes.length, 0),
  receipt.sourceBytes,
);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const models = [];
for (const file of receipt.files.filter((f) => f.path.endsWith('.glb'))) {
  const report = await validator.validateBytes(bodies.get(file.path), {
    externalResourceFunction: async (uri) => {
      assert(bodies.has(uri), `Unknown external resource ${uri}`);
      return new Uint8Array(bodies.get(uri));
    },
  });
  assert.equal(report.issues.numErrors, 0, file.path);
  assert.equal(report.issues.numWarnings, 0, file.path);
  const document = await io.read(new URL(file.path, root).pathname);
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  let triangles = 0;
  document
    .getRoot()
    .getDefaultScene()
    .traverse((node) => {
      const mesh = node.getMesh();
      if (!mesh) return;
      const matrix = node.getWorldMatrix();
      for (const primitive of mesh.listPrimitives()) {
        assert.equal(primitive.getMode(), 4);
        const positions = primitive.getAttribute('POSITION');
        triangles += (primitive.getIndices()?.getCount() ?? positions.getCount()) / 3;
        for (let i = 0; i < positions.getCount(); i++) {
          const p = positions.getElement(i, []);
          for (let axis = 0; axis < 3; axis++) {
            const value =
              matrix[axis] * p[0] +
              matrix[4 + axis] * p[1] +
              matrix[8 + axis] * p[2] +
              matrix[12 + axis];
            assert(Number.isFinite(value));
            bounds.min[axis] = Math.min(bounds.min[axis], value);
            bounds.max[axis] = Math.max(bounds.max[axis], value);
          }
        }
      }
    });
  assert(triangles > 0 && triangles < 10000, `${file.path} triangle intake budget`);
  assert.equal(document.getRoot().listAnimations().length, 0);
  models.push({ path: file.path, triangles, bounds, validatorWarnings: report.issues.numWarnings });
}
assert.equal(models.length, 6);
console.log(
  JSON.stringify(
    { passed: true, sourceBytes: receipt.sourceBytes, models, playerReady: false },
    null,
    2,
  ),
);
