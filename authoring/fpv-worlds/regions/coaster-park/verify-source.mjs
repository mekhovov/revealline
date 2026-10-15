/** Pinned source preparation; no player admission or claim of a completed map. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import validator from 'gltf-validator';
import { createCoasterIndexedCells } from './indexed-source.mjs';
import { decodePinnedPalette } from '../railway-valley/indexed-source.mjs';
import { compileIndexedSceneryCell } from '../indexed-scenery-cell.mjs';
import { compileSceneryCell } from '../scenery-cell.mjs';
const output = process.argv[2];
if (output) await mkdir(output, { recursive: false });
const expected = decodePinnedPalette(
  await readFile(new URL('./source/Textures/colormap.png', import.meta.url)),
);
const rejectedNames = new Set([
  'coaster-wood-straight-hill-complete.glb',
  'coaster-hanging-corner-large.glb',
]);
const records = [],
  rejected = [],
  io = new NodeIO();
for (const [name, source] of await createCoasterIndexedCells()) {
  if (rejectedNames.has(name)) {
    assert.throws(() => compileIndexedSceneryCell(source), /Degenerate scenery triangle/);
    rejected.push({
      name,
      reason:
        'Millimetre quantization collapses a source triangle; original preserved, not admitted and no triangles silently removed.',
    });
    continue;
  }
  const built = compileIndexedSceneryCell(source),
    plain = compileSceneryCell(source.cell);
  assert.deepEqual(built.surfaces, plain.surfaces);
  assert.deepEqual(built.glb, compileIndexedSceneryCell(JSON.stringify(source)).glb);
  const validation = await validator.validateBytes(built.glb);
  assert.equal(validation.issues.numErrors, 0, JSON.stringify(validation.issues.messages));
  assert.equal(validation.issues.numWarnings, 0, JSON.stringify(validation.issues.messages));
  const doc = await io.readBinary(built.glb);
  const primitives = doc.getRoot().listMeshes()[0].listPrimitives();
  assert.equal(primitives.length, source.cell.surfaces.length);
  for (let i = 0; i < primitives.length; i++) {
    const primitive = primitives[i],
      surface = source.cell.surfaces[i],
      binding = source.bindings[i];
    assert.deepEqual(primitive.getAttribute('POSITION').getArray(), plain.surfaces[i].positions);
    assert.deepEqual([...primitive.getIndices().getArray()], surface.indices);
    assert.deepEqual(
      primitive.getAttribute('TEXCOORD_0').getArray(),
      new Float32Array(binding.uvs),
    );
    assert.deepEqual(
      primitive.getAttribute('NORMAL').getArray(),
      new Float32Array(binding.normals),
    );
    const half = surface.positionsMm.length / 2,
      count = surface.indices.length / 2;
    assert.deepEqual(surface.positionsMm.slice(0, half), surface.positionsMm.slice(half));
    assert.deepEqual(
      binding.normals.slice(half),
      binding.normals.slice(0, half).map((v) => -v || 0),
    );
    for (let t = 0; t < count; t += 3)
      assert.deepEqual(surface.indices.slice(count + t, count + t + 3), [
        surface.indices[t] + half / 3,
        surface.indices[t + 2] + half / 3,
        surface.indices[t + 1] + half / 3,
      ]);
  }
  assert.deepEqual(
    decodePinnedPalette(Buffer.from(doc.getRoot().listTextures()[0].getImage())),
    expected,
  );
  const record = {
    name,
    sceneBytes: built.glb.length,
    sourceBytes: Buffer.byteLength(JSON.stringify(source)),
    textureBytes: built.textureBytes,
    attributeBytes: built.attributeBytes,
    triangles: source.cell.surfaces.reduce((n, s) => n + s.indices.length / 3, 0),
    sha256: createHash('sha256').update(built.glb).digest('hex'),
  };
  records.push(record);
  if (output) {
    await writeFile(resolve(output, name), built.glb);
    await writeFile(resolve(output, name + '.json'), JSON.stringify(source));
  }
}
assert.equal(records.length, 8);
assert.equal(rejected.length, 2);
const receipt = {
  format: 'FPVCoasterIndexedSourceVerification.v1',
  passed: true,
  tool: 'Node20.19.5 / gltf-transform4.5.1 / gltf-validator',
  scale: 6,
  sourceFilesPreserved: true,
  palettePixelsPreserved: true,
  doubleSidedFacesBaked: true,
  records,
  rejected,
  playerReady: false,
  limitations:
    'Original modular assets only; assembled regional layout, route/collision, native visual, package and Library qualification remain required.',
};
if (output)
  await writeFile(resolve(output, 'verification.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
