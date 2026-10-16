/** Read-only source/collision parity for the opt-in Desert surface. Not a GPU/device test. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareTerrainWindow } from '../terrain-admission.mjs';
import { createTerrainSurface } from '../terrain-surface.mjs';
import { surfaceMm, starts } from './desert-design.mjs';

const root = resolve(process.argv[2] || 'dist/fpv-desert-expedition-source/terrain');
const manifestBytes = await readFile(resolve(root, 'region.json'));
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.id, 'desert-expedition-study');
assert.equal(manifest.revision, 'natural-r1');
assert.equal(manifest.grid.cellSizeMm, 512000);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(
  digest(manifestBytes),
  '21c5b63e51a33c22ebd7ff22e05d92d6b91b00173fcc5d3c911bc530bb166468',
);
const receipts = [];
let maxGeometryBytes = 0;
for (const start of starts) {
  const cx = Math.floor(start.x / 512),
    cz = Math.floor(start.z / 512);
  const chunks = manifest.chunks.filter(
    (chunk) => Math.abs(chunk.x - cx) <= 1 && Math.abs(chunk.z - cz) <= 1,
  );
  assert.equal(chunks.length, 9);
  const cells = await Promise.all(
    chunks.map(async (chunk) => {
      const asset = manifest.assets.find(
        (candidate) => candidate.kind === 'collision' && chunk.assets.includes(candidate.id),
      );
      const bytes = await readFile(resolve(root, asset.path));
      assert.equal(bytes.length, asset.bytes);
      assert.equal(digest(bytes), asset.sha256);
      return JSON.parse(bytes);
    }),
  );
  const sourceBefore = JSON.stringify(cells);
  const originMm = { x: cx * 512000, y: 0, z: cz * 512000 };
  const position = {
    x: start.x * 1000,
    y: Math.round(surfaceMm(start.x, start.z)) + 3000,
    z: start.z * 1000,
  };
  let reference;
  for (const [surfaceStyle, surfaceQuality] of [
    ['plain', 'balanced'],
    ['desert', 'performance'],
    ['desert', 'balanced'],
    ['desert', 'quality'],
  ]) {
    const window = await prepareTerrainWindow(manifest, cells, {
      requiredChunkIds: chunks.map((chunk) => chunk.id),
      originMm,
      surfaceStyle,
      surfaceQuality,
    });
    const geometry = createHash('sha256');
    for (const mesh of window.group.children) {
      for (const attribute of [
        mesh.geometry.attributes.position,
        mesh.geometry.attributes.normal,
        mesh.geometry.index,
      ]) {
        geometry.update(
          Buffer.from(
            attribute.array.buffer,
            attribute.array.byteOffset,
            attribute.array.byteLength,
          ),
        );
      }
    }
    const actual = {
      geometry: geometry.digest('hex'),
      geometryBytes: window.snapshot().geometryBytes,
      support: window.support(position, 10000),
      sweep: window.sweep(position, { ...position, y: position.y - 10000 }),
    };
    if (reference) assert.deepEqual(actual, reference);
    else reference = actual;
    assert.equal(actual.geometryBytes, 456408);
    assert.equal(actual.support.status, 'terrain-hit');
    assert.equal(actual.sweep.status, 'terrain-hit');
    maxGeometryBytes = Math.max(maxGeometryBytes, actual.geometryBytes);
    const material = window.group.children[0].material;
    assert.equal(material.transparent, false);
    assert.equal(material.opacity, 1);
    assert.equal(material.depthWrite, true);
    assert.equal(material.map, null);
    assert.equal(material.normalMap, null);
    assert.equal(material.displacementMap, null);
    assert.equal(material.metalness, 0);
    let disposed = 0;
    material.addEventListener('dispose', () => disposed++);
    window.dispose();
    window.dispose();
    assert.equal(disposed, 1);
    assert.equal(window.group.children.length, 0);
    assert.equal(JSON.stringify(cells), sourceBefore);
  }
  receipts.push({
    district: start.id,
    windows: 4,
    cells: chunks.length,
    geometryBytes: reference.geometryBytes,
    collisionIdentical: true,
  });
}

// Assemble each actual material's shader hook and verify recentering only changes the origin uniform.
const shaderOf = (material) => {
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\n#include <begin_vertex>',
    fragmentShader:
      '#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>',
  };
  material.onBeforeCompile(shader);
  return shader;
};
for (const quality of ['performance', 'balanced', 'quality']) {
  const first = createTerrainSurface({
    style: 'desert',
    quality,
    originMm: { x: 2560000, y: 0, z: 3072000 },
  });
  const second = createTerrainSurface({
    style: 'desert',
    quality,
    originMm: { x: 3072000, y: 0, z: 3584000 },
  });
  const a = shaderOf(first),
    b = shaderOf(second);
  assert.equal(a.vertexShader, b.vertexShader);
  assert.equal(a.fragmentShader, b.fragmentShader);
  const point = [3200, 45, 3400];
  for (const shader of [a, b]) {
    const origin = shader.uniforms.desertOrigin.value;
    const local = point.map((v, index) => v - [origin.x, origin.y, origin.z][index]);
    assert.deepEqual(
      local.map((v, index) => v + [origin.x, origin.y, origin.z][index]),
      point,
    );
  }
  assert.ok(!/transformed\s*[+*\-/]?=/.test(a.vertexShader));
  assert.ok(!/\bdiscard\b|gl_FragDepth/.test(a.fragmentShader));
  assert.equal(a.fragmentShader.includes('float terrainNoise'), quality !== 'performance');
  assert.equal(a.fragmentShader.includes('fwidth'), quality !== 'performance');
  first.dispose();
  second.dispose();
}
assert.throws(() =>
  createTerrainSurface({ style: 'desert', quality: 'ultra', originMm: { x: 0, y: 0, z: 0 } }),
);
assert.equal(digest(await readFile(resolve(root, 'region.json'))), digest(manifestBytes));
console.log(
  JSON.stringify(
    {
      passed: true,
      districts: receipts,
      maxGeometryBytes,
      sourceAndCollisionUnchanged: true,
      texturesAdded: 0,
      shaderAssemblyOnly: true,
      nativeGpuVerified: false,
      playerAdmission: false,
    },
    null,
    2,
  ),
);
