/** Manual material/physics parity against a generated, verified Canyon source. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareTerrainWindow } from './terrain-admission.mjs';
import { createTerrainSurface } from './terrain-surface.mjs';
const root = resolve(process.argv[2] || 'dist/fpv-canyon-surface-source');
const manifest = JSON.parse(await readFile(resolve(root, 'region.json'), 'utf8'));
const chunks = manifest.chunks.filter((c) => c.x < 3 && c.z < 3);
const cells = await Promise.all(
  chunks.map(async (chunk) => {
    const asset = manifest.assets.find(
      (a) => chunk.assets.includes(a.id) && a.kind === 'collision',
    );
    const bytes = await readFile(resolve(root, asset.path));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    return JSON.parse(bytes);
  }),
);
const sourceBefore = JSON.stringify(cells);
const originMm = { x: 128000, y: 0, z: 128000 };
const position = { x: 192000, y: 340000, z: 192000 };
let expected,
  checks = 0;
for (const [surfaceStyle, surfaceQuality] of [
  ['plain', 'balanced'],
  ['canyon', 'performance'],
  ['canyon', 'balanced'],
  ['canyon', 'quality'],
  ['tropical', 'performance'],
  ['tropical', 'balanced'],
  ['tropical', 'quality'],
  ['tropical-settlement', 'performance'],
  ['tropical-settlement', 'balanced'],
  ['tropical-settlement', 'quality'],
]) {
  const window = await prepareTerrainWindow(manifest, cells, {
    requiredChunkIds: chunks.map((c) => c.id),
    originMm,
    surfaceStyle,
    surfaceQuality,
  });
  const geometry = createHash('sha256');
  for (const mesh of window.group.children) {
    for (const a of [
      mesh.geometry.attributes.position,
      mesh.geometry.attributes.normal,
      mesh.geometry.index,
    ])
      geometry.update(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength));
  }
  const result = {
    geometry: geometry.digest('hex'),
    support: window.support(position, 350000),
    sweep: window.sweep(position, { ...position, y: 1000 }),
    geometryBytes: window.snapshot().geometryBytes,
  };
  if (expected) assert.deepEqual(result, expected);
  else expected = result;
  assert.equal(window.snapshot().flightReady, false);
  const material = window.group.children[0].material;
  let disposed = 0;
  material.addEventListener('dispose', () => disposed++);
  window.dispose();
  window.dispose();
  assert.equal(disposed, 1);
  assert.equal(window.group.children.length, 0);
  assert.equal(JSON.stringify(cells), sourceBefore);
  console.log(
    `PASS ${surfaceStyle}/${surfaceQuality}: same source, vertices, normals, indices, support and swept collision; disposed once`,
  );
  checks++;
}
assert.equal(expected.support.status, 'terrain-hit');
assert.equal(expected.sweep.status, 'terrain-hit');
for (const bad of [
  { style: 'unknown', originMm },
  { style: 'canyon', quality: 'ultra', originMm },
  { style: 'canyon', originMm: { x: Infinity, y: 0, z: 0 } },
])
  assert.throws(() => createTerrainSurface(bad));
checks++;
console.log('PASS invalid material profiles/origins reject before allocation');
console.log(
  `PASS ${checks}/${checks}; ${cells.length} exact-source cells; no player or device FPS claim`,
);
