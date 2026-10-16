/** Exact authored terrain parity under optional Railway shading; native GPU review is separate. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareTerrainWindow } from './terrain-admission.mjs';
const directory = process.argv[2];
assert(directory, 'Provide the paired Railway terrain directory');
const manifest = JSON.parse(await readFile(resolve(directory, 'region.json'), 'utf8'));
const cells = [];
for (const asset of manifest.assets.filter((a) => a.kind === 'collision')) {
  const bytes = await readFile(resolve(directory, asset.path));
  assert.equal(bytes.length, asset.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  cells.push(JSON.parse(bytes));
}
const immutableSource = JSON.stringify(cells);
const samplePoints = [
  [166, 66],
  [300, 70],
  [250, 70],
  [234, 58],
  [266, 88],
  [250, 304],
  [192, 160],
  [48, 180],
  [64, 60],
  [80, 300],
  [140, 108],
  [330, 180],
];
let cases = 0,
  geometryBytes = 0;
for (const originMm of [
  { x: 0, y: 0, z: 0 },
  { x: 128000, y: 0, z: 128000 },
]) {
  let baseline;
  for (const [surfaceStyle, surfaceQuality] of [
    ['plain', 'balanced'],
    ['railway', 'performance'],
    ['railway', 'balanced'],
    ['railway', 'quality'],
  ]) {
    const owner = await prepareTerrainWindow(manifest, cells, {
      requiredChunkIds: manifest.chunks.map((c) => c.id),
      originMm,
      surfaceStyle,
      surfaceQuality,
    });
    try {
      const hash = createHash('sha256');
      for (const mesh of owner.group.children) {
        for (const attribute of [
          mesh.geometry.attributes.position,
          mesh.geometry.attributes.normal,
          mesh.geometry.index,
        ])
          hash.update(
            Buffer.from(
              attribute.array.buffer,
              attribute.array.byteOffset,
              attribute.array.byteLength,
            ),
          );
        hash.update(JSON.stringify(mesh.position.toArray()));
      }
      const queries = samplePoints.map(([x, z]) => {
        const start = { x: x * 1000, y: 60000, z: z * 1000 };
        const support = owner.support(start, 100000);
        const sweep = owner.sweep(start, { ...start, y: -20000 }, 250);
        assert.equal(support.status, 'terrain-hit');
        assert.equal(sweep.status, 'terrain-hit');
        return { support, sweep };
      });
      const receipt = {
        geometry: hash.digest('hex'),
        queries,
        bytes: owner.snapshot().geometryBytes,
      };
      if (baseline) assert.deepEqual(receipt, baseline);
      else baseline = receipt;
      geometryBytes = receipt.bytes;
      const materials = new Set(owner.group.children.map((mesh) => mesh.material));
      assert.equal(materials.size, 1, 'One shared terrain material per window');
      let disposals = 0;
      for (const material of materials) {
        assert.equal(Object.values(material).filter((value) => value?.isTexture).length, 0);
        material.addEventListener('dispose', () => disposals++);
        if (surfaceStyle === 'railway') {
          const shader = {
            uniforms: {},
            vertexShader: '#include <common>\n#include <begin_vertex>',
            fragmentShader:
              '#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>',
          };
          material.onBeforeCompile(shader);
          assert.deepEqual(shader.uniforms.urbanGroundOrigin.value.toArray(), [
            originMm.x / 1000,
            0,
            originMm.z / 1000,
          ]);
          assert(!shader.fragmentShader.includes('sampler2D'));
        }
      }
      owner.dispose();
      owner.dispose();
      assert.equal(disposals, 1);
      assert.equal(owner.snapshot().geometryBytes, 0);
      assert.equal(JSON.stringify(cells), immutableSource);
      cases++;
    } finally {
      owner.dispose();
    }
  }
}
console.log(
  JSON.stringify(
    {
      passed: true,
      cases,
      cells: cells.length,
      queriesPerCase: samplePoints.length * 2,
      geometryBytes,
      sourceAndCollisionUnchanged: true,
      addedTextureBytes: 0,
      disposed: true,
      nativeShaderCompilation: 'separate browser receipt',
      playerReady: false,
    },
    null,
    2,
  ),
);
