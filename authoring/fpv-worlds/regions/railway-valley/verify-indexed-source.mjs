/** Texture/geometry contract checks only; no regional player admission. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import validator from 'gltf-validator';
import { createRailwayIndexedCells, decodePinnedPalette } from './indexed-source.mjs';
import { compileIndexedSceneryCell, validateIndexedSceneryCell } from '../indexed-scenery-cell.mjs';
import { compileSceneryCell } from '../scenery-cell.mjs';
const output = process.argv[2] && resolve(process.argv[2]);
if (output) await mkdir(output, { recursive: true });
const models = await createRailwayIndexedCells(),
  io = new NodeIO(),
  receipts = [],
  rejected = [];
const needsConditioning = new Set([
  'railroad-corner-large.glb',
  'train-diesel-a.glb',
  'train-carriage-coal.glb',
]);
const expectedPalette = decodePinnedPalette(
  await readFile(new URL('./source/Textures/colormap.png', import.meta.url)),
);
for (const [name, source] of models) {
  if (needsConditioning.has(name)) {
    assert.throws(() => compileIndexedSceneryCell(source), /Degenerate scenery triangle/);
    rejected.push({
      name,
      reason:
        'Millimetre quantization collapses a triangle; source preserved, no silent triangle removal',
    });
    continue;
  }
  const compiled = compileIndexedSceneryCell(source),
    baseline = compileSceneryCell(source.cell);
  assert.deepEqual(
    compiled.surfaces,
    baseline.surfaces,
    'Visible and collision positions/indices must remain identical',
  );
  assert.deepEqual(
    compiled.glb,
    compileIndexedSceneryCell(JSON.stringify(source)).glb,
    'Deterministic canonical bytes',
  );
  const report = await validator.validateBytes(compiled.glb);
  assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues.messages));
  assert.equal(report.issues.numWarnings, 0, JSON.stringify(report.issues.messages));
  const document = await io.readBinary(compiled.glb),
    primitives = document.getRoot().listMeshes()[0].listPrimitives();
  assert.equal(primitives.length, source.cell.surfaces.length);
  primitives.forEach((primitive, i) => {
    assert.deepEqual(primitive.getAttribute('POSITION').getArray(), baseline.surfaces[i].positions);
    assert.deepEqual([...primitive.getIndices().getArray()], source.cell.surfaces[i].indices);
    assert.deepEqual(
      primitive.getAttribute('TEXCOORD_0').getArray(),
      new Float32Array(source.bindings[i].uvs),
    );
    assert.deepEqual(
      primitive.getAttribute('NORMAL').getArray(),
      new Float32Array(source.bindings[i].normals),
    );
    const info = primitive.getMaterial().getBaseColorTextureInfo();
    assert.equal(info.getMagFilter(), 9728);
    assert.equal(info.getMinFilter(), 9984);
    assert.equal(info.getWrapS(), 10497);
    assert.equal(info.getWrapT(), 10497);
  });
  const image = Buffer.from(document.getRoot().listTextures()[0].getImage());
  assert.deepEqual(
    decodePinnedPalette(image),
    expectedPalette,
    'All original palette pixels must survive PNG round trip',
  );
  assert.equal(compiled.textureBytes, 1398100);
  const record = {
    name,
    sceneBytes: compiled.glb.length,
    sourceBytes: Buffer.byteLength(JSON.stringify(source)),
    textureBytes: compiled.textureBytes,
    attributeBytes: compiled.attributeBytes,
    triangles: source.cell.surfaces.reduce((n, s) => n + s.indices.length / 3, 0),
    sha256: createHash('sha256').update(compiled.glb).digest('hex'),
  };
  receipts.push(record);
  if (output) {
    await writeFile(resolve(output, name), compiled.glb);
    await writeFile(resolve(output, name + '.json'), JSON.stringify(source));
  }
}
const base = models.get('train-carriage-tank.glb');
const rejectedInputs = [
  [
    'oversize dimensions',
    (s) => {
      s.textures[0].width = 1024;
    },
  ],
  [
    'palette index absent',
    (s) => {
      s.textures[0].paletteRgb = [0, 0, 0];
    },
  ],
  [
    'remote URI',
    (s) => {
      s.textures[0].uri = 'https://example.com/image.png';
    },
  ],
  [
    'unexpected alpha',
    (s) => {
      s.textures[0].alpha = [255];
    },
  ],
  [
    'bad UV count',
    (s) => {
      s.bindings[0].uvs.pop();
    },
  ],
  [
    'nonfinite UV',
    (s) => {
      s.bindings[0].uvs[0] = Infinity;
    },
  ],
  [
    'zero normal',
    (s) => {
      s.bindings[0].normals.splice(0, 3, 0, 0, 0);
    },
  ],
  [
    'duplicate binding',
    (s) => {
      s.bindings.push(s.bindings[0]);
    },
  ],
  [
    'missing texture',
    (s) => {
      s.bindings[0].textureId = 'missing';
    },
  ],
  [
    'bad sampler',
    (s) => {
      s.textures[0].minFilter = 99999;
    },
  ],
  [
    'unsupported format',
    (s) => {
      s.format = 'future';
    },
  ],
];
for (const [label, mutate] of rejectedInputs) {
  const changed = structuredClone(base);
  mutate(changed);
  assert.throws(() => validateIndexedSceneryCell(changed), undefined, label);
}
const report = {
  format: 'FPVIndexedSceneryContractReceipt.v1',
  playerReady: false,
  models: receipts,
  rejectedModels: rejected,
  rejectedMalformedInputs: rejectedInputs.length,
};
if (output)
  await writeFile(resolve(output, 'receipt.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
