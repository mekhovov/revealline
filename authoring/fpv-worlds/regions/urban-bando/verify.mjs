import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import validator from 'gltf-validator';
import RAPIER from '../../../../optional-practice/civilian-fpv/vendor/rapier/rapier.mjs';

const root = process.argv[2];
assert(root, 'Provide the generated study directory.');
const json = async (name) => JSON.parse(await readFile(resolve(root, name), 'utf8'));
const [design, collision, receipt, bytes] = await Promise.all([
  json('design.json'),
  json('architecture-collision.json'),
  json('preparation.json'),
  readFile(resolve(root, 'architecture.glb')),
]);
assert.equal(design.flightReady, false);
assert.equal(collision.format, 'FPVAuthoringMeshCollision.v1');
assert.equal(collision.units, 'metres');
assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sceneSHA256);
assert.equal(bytes.length, receipt.sceneBytes);
const validation = await validator.validateBytes(bytes);
assert.equal(validation.issues.numErrors, 0);
const document = await new NodeIO().registerExtensions(ALL_EXTENSIONS).readBinary(bytes);
const scene = document.getRoot().getDefaultScene();
let ordinal = 0;
scene.traverse((node) => {
  if (!node.getMesh()) return;
  const matrix = node.getWorldMatrix();
  for (const primitive of node.getMesh().listPrimitives()) {
    const actual = collision.surfaces[ordinal++];
    assert.equal(actual.node, node.getName());
    assert.equal(primitive.getMode(), 4);
    const positions = primitive.getAttribute('POSITION');
    const vertices = [];
    for (let i = 0; i < positions.getCount(); i++) {
      const [x, y, z] = positions.getElement(i, []);
      for (let axis = 0; axis < 3; axis++) {
        vertices.push(
          Math.fround(
            matrix[axis] * x + matrix[4 + axis] * y + matrix[8 + axis] * z + matrix[12 + axis],
          ),
        );
      }
    }
    assert.deepEqual(actual.vertices, vertices, actual.id + ' exported visible positions');
    assert.deepEqual(
      actual.indices,
      Array.from(primitive.getIndices().getArray()),
      actual.id + ' exported triangles',
    );
  }
});
assert.equal(ordinal, collision.surfaces.length);
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
try {
  for (const surface of collision.surfaces) {
    world.createCollider(
      RAPIER.ColliderDesc.trimesh(
        new Float32Array(surface.vertices),
        new Uint32Array(surface.indices),
      ),
    );
  }
  world.step();
  for (const probe of design.probes) {
    const start = Object.fromEntries(['x', 'y', 'z'].map((axis, i) => [axis, probe.from[i]]));
    const delta = Object.fromEntries(
      ['x', 'y', 'z'].map((axis, i) => [axis, probe.to[i] - probe.from[i]]),
    );
    const hit = world.castShape(
      start,
      { x: 0, y: 0, z: 0, w: 1 },
      delta,
      new RAPIER.Ball(0.25),
      0,
      1,
      true,
    );
    assert.equal(!hit, probe.clear, probe.id);
  }
} finally {
  world.free();
}
console.log(
  `PASS: ${ordinal} exported visible/collision meshes agree; ${design.probes.length} saved-artifact opening/solid sweeps; glTF errors ${validation.issues.numErrors}.`,
);
