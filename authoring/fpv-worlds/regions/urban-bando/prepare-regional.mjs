/** Prepare a bounded colour-only regional derivative from the verified Urban study. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compileSceneryCell, SCENERY_FORMAT } from '../scenery-cell.mjs';
import { validateRegionManifest } from '../region-manifest.mjs';
const [source, output] = process.argv.slice(2);
assert(
  source && output,
  'Provide verified Urban study directory and new external output directory',
);
const sha = (data) => createHash('sha256').update(data).digest('hex');
const [bytes, receipt, collision] = await Promise.all([
  readFile(resolve(source, 'architecture.glb')),
  readFile(resolve(source, 'preparation.json'), 'utf8').then(JSON.parse),
  readFile(resolve(source, 'architecture-collision.json'), 'utf8').then(JSON.parse),
]);
const pin = JSON.parse(await readFile(new URL('./preparation.json', import.meta.url), 'utf8'));
assert.equal(sha(bytes), pin.sceneSHA256);
assert.equal(receipt.sceneSHA256, pin.sceneSHA256);
const document = await new NodeIO().registerExtensions(ALL_EXTENSIONS).readBinary(bytes),
  inputs = [];
document
  .getRoot()
  .getDefaultScene()
  .traverse((node) => {
    if (!node.getMesh()) return;
    const m = node.getWorldMatrix();
    for (const primitive of node.getMesh().listPrimitives()) {
      const vertices = [],
        attr = primitive.getAttribute('POSITION');
      for (let i = 0; i < attr.getCount(); i++) {
        const v = attr.getElement(i, []);
        for (let k = 0; k < 3; k++)
          vertices.push(Math.fround(m[k] * v[0] + m[4 + k] * v[1] + m[8 + k] * v[2] + m[12 + k]));
      }
      const input = {
        vertices,
        indices: Array.from(primitive.getIndices().getArray()),
        color: primitive.getMaterial().getBaseColorFactor().slice(0, 3),
      };
      const expected = collision.surfaces[inputs.length];
      assert.deepEqual(vertices, expected.vertices);
      assert.deepEqual(input.indices, expected.indices);
      inputs.push(input);
    }
  });
assert.equal(inputs.length, collision.surfaces.length);
const cells = Array.from({ length: 9 }, (_, i) => ({
  format: SCENERY_FORMAT,
  chunkId: `urban-${i % 3}-${Math.floor(i / 3)}`,
  x: i % 3,
  z: Math.floor(i / 3),
  cellSizeMm: 128000,
  surfaces: [],
}));
function clip(poly, axis, bound, lower) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      ina = lower ? a[axis] >= bound : a[axis] <= bound,
      inb = lower ? b[axis] >= bound : b[axis] <= bound;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (bound - a[axis]) / (b[axis] - a[axis]);
      const p = a.map((v, k) => v + (b[k] - v) * t);
      p[axis] = bound;
      out.push(p);
    }
  }
  return out;
}
for (const [ordinal, input] of inputs.entries())
  for (const cell of cells) {
    const positionsMm = [],
      indices = [];
    for (let i = 0; i < input.indices.length; i += 3) {
      let poly = input.indices
        .slice(i, i + 3)
        .map((index) => input.vertices.slice(index * 3, index * 3 + 3).map((v) => v * 1000));
      for (const [axis, start] of [
        [0, cell.x * 128000],
        [2, cell.z * 128000],
      ]) {
        poly = clip(poly, axis, start, true);
        poly = clip(poly, axis, start + 128000, false);
      }
      poly = poly.map((p) => [
        Math.round(p[0] - cell.x * 128000),
        Math.round(p[1]),
        Math.round(p[2] - cell.z * 128000),
      ]);
      for (let j = 1; j + 1 < poly.length; j++) {
        const [a, b, c] = [poly[0], poly[j], poly[j + 1]],
          u = b.map((v, k) => v - a[k]),
          v = c.map((n, k) => n - a[k]);
        if (
          u[1] * v[2] - u[2] * v[1] === 0 &&
          u[2] * v[0] - u[0] * v[2] === 0 &&
          u[0] * v[1] - u[1] * v[0] === 0
        )
          continue;
        const n = positionsMm.length / 3;
        positionsMm.push(...a, ...b, ...c);
        indices.push(n, n + 1, n + 2);
      }
    }
    if (indices.length)
      cell.surfaces.push({ id: `surface-${ordinal}`, positionsMm, indices, color: input.color });
  }
await mkdir(output, { recursive: false });
const assets = [],
  chunks = [];
for (const cell of cells) {
  const compiled = compileSceneryCell(cell),
    json = Buffer.from(JSON.stringify(cell));
  for (const [kind, data, ext] of [
    ['scene', compiled.glb, 'glb'],
    ['collision', json, 'json'],
  ]) {
    const path = `${cell.chunkId}.${ext}`,
      id = `${cell.chunkId}-${kind}`;
    await writeFile(resolve(output, path), data);
    assets.push({ id, path, kind, bytes: data.length, sha256: sha(data) });
  }
  chunks.push({
    id: cell.chunkId,
    x: cell.x,
    z: cell.z,
    assets: [`${cell.chunkId}-scene`, `${cell.chunkId}-collision`],
  });
}
const manifest = validateRegionManifest({
  format: 'FPVRegionManifest.v1',
  id: 'urban-bando-study',
  revision: 'scenery-r1',
  title: { en: 'Urban Bando architecture study', uk: 'Архітектурний ескіз Urban Bando' },
  grid: {
    cellSizeMm: 128000,
    minX: 0,
    minZ: 0,
    width: 3,
    depth: 3,
    floorMm: -1000,
    ceilingMm: 80000,
  },
  assets,
  chunks,
  spawns: [
    { id: 'mill-court', position: { x: 64000, y: 3000, z: 16000 } },
    { id: 'tower-court', position: { x: 320000, y: 3000, z: 200000 } },
  ],
});
await writeFile(resolve(output, 'region.json'), JSON.stringify(manifest, null, 2) + '\n');
const provenance = {
  format: 'FPVUrbanRegionalPreparation.v1',
  sourceSceneSHA256: pin.sceneSHA256,
  sourceReceipt: 'authoring/fpv-worlds/regions/urban-bando/preparation.json',
  licenseReceipt: 'authoring/fpv-worlds/assets/kenney/city-industrial/provenance.json',
  licenseReceiptSHA256: sha(
    await readFile(new URL('../../assets/kenney/city-industrial/provenance.json', import.meta.url)),
  ),
  cells: cells.length,
  sourceBytes: assets.reduce((n, a) => n + a.bytes, 0),
  triangles: cells.reduce(
    (n, c) => n + c.surfaces.reduce((s, p) => s + p.indices.length / 3, 0),
    0,
  ),
  flightReady: false,
  limitations: [
    'Colour-only derivative; textures remain in original preserved study',
    'Triangle clipping at 128 m cell boundaries; positions quantized to 1 mm',
    'No production host, combined terrain transaction, package or default catalogue admission',
  ],
};
await writeFile(resolve(output, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log(JSON.stringify(provenance, null, 2));
