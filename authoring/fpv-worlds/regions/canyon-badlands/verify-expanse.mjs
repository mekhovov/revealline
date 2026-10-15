/** Verify complete canonical source and bounded production geometry ownership. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';
import { compileTerrainCell, validateTerrainSeams } from '../terrain-cell.mjs';
import { validateRegionManifest } from '../region-manifest.mjs';
import { createVerifiedTerrainWindow } from '../verified-terrain-window.mjs';
import { heightMm, surfaceMm } from './expanse-design.mjs';

const root = resolve(process.argv[2] ?? '');
assert(process.argv[2], 'Provide generated expanse source directory');
const sha = (body) => createHash('sha256').update(body).digest('hex');
const receipt = JSON.parse(await readFile(resolve(root, 'preparation.json')));
const manifestBody = await readFile(resolve(root, 'terrain/region.json'));
assert.equal(sha(manifestBody), receipt.manifestSHA256);
const manifest = validateRegionManifest(manifestBody.toString());
assert.equal(manifest.grid.cellSizeMm, 256000);
assert.equal(manifest.grid.width, 32);
assert.equal(manifest.grid.depth, 32);
const bodies = new Map(),
  cells = new Map();
let sourceBytes = manifestBody.length,
  canonical = 0,
  seams = 0;
for (const asset of manifest.assets) {
  const body = await readFile(resolve(root, 'terrain', asset.path));
  assert.equal(body.length, asset.bytes);
  assert.equal(sha(body), asset.sha256);
  sourceBytes += body.length;
  bodies.set('/' + asset.path, body);
  if (asset.kind === 'collision') cells.set(asset.id.replace(/-collision$/, ''), JSON.parse(body));
}
assert.equal(sourceBytes, receipt.sourceBytes);
for (const cell of cells.values()) {
  const regenerated = { ...cell, heightsMm: [] };
  for (let z = 0; z < 33; z++)
    for (let x = 0; x < 33; x++)
      regenerated.heightsMm.push(heightMm(cell.x * 256 + x * 8, cell.z * 256 + z * 8));
  assert.deepEqual(
    regenerated,
    cell,
    'Source samples must regenerate exactly from the original authored design',
  );
  assert.deepEqual(
    Buffer.from(JSON.stringify(regenerated) + '\n'),
    bodies.get(`/${cell.chunkId}.json`),
  );
  const compiled = compileTerrainCell(cell);
  assert.deepEqual(Buffer.from(compiled.glb), bodies.get(`/${cell.chunkId}.glb`));
  const check = await validator.validateBytes(new Uint8Array(compiled.glb));
  assert.equal(check.issues.numErrors, 0);
  assert.equal(check.issues.numWarnings, 0);
  canonical++;
  for (const [x, z] of [
    [cell.x + 1, cell.z],
    [cell.x, cell.z + 1],
  ]) {
    const next = cells.get(`expanse-${x}-${z}`);
    if (next) {
      validateTerrainSeams([cell, next]);
      seams++;
    }
  }
}
assert.equal(canonical, 1024);
assert.equal(seams, 1984);
const source = {
  baseURL: 'https://expanse.invalid/',
  fetchImpl: async (url) => {
    const data = bodies.get(new URL(url).pathname);
    return new Response(data, { status: data ? 200 : 404 });
  },
};
const owner = createVerifiedTerrainWindow(manifest, source);
let key = '',
  transitions = 0,
  peakGeometryBytes = 0,
  maxResidentCells = 0,
  sweeps = 0,
  landmarkHits = 0;
const prepare = async (point) => {
  const next = `${Math.floor(point.x / 256000)},${Math.floor(point.z / 256000)}`;
  if (next === key) return;
  await owner.transition(point);
  key = next;
  transitions++;
  const state = owner.snapshot();
  peakGeometryBytes = Math.max(peakGeometryBytes, state.geometryBytes);
  maxResidentCells = Math.max(maxResidentCells, state.provenance.chunks.length);
  assert(state.provenance.chunks.length <= 9);
};
const mm = ([x, y, z]) => ({
  x: Math.round(x * 1000),
  y: Math.round(y * 1000),
  z: Math.round(z * 1000),
});
try {
  for (const { x, z } of receipt.representativeWindows) {
    const px = x * 256 + 128,
      pz = z * 256 + 128;
    const point = mm([px, surfaceMm(px, pz) / 1000 + 40, pz]);
    await prepare(point);
    const support = owner.support(point, 50000);
    assert.equal(support.status, 'terrain-hit');
    assert(Math.abs(support.heightMm - surfaceMm(px, pz)) < 30);
  }
  for (const route of receipt.routes)
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1],
        b = route.points[i];
      const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const normal = [-(b[2] - a[2]) / length, (b[0] - a[0]) / length];
      for (const side of [-1, 0, 1]) {
        const point = (p) =>
          mm([
            p[0] + side * route.halfWidthM * normal[0],
            p[1],
            p[2] + side * route.halfWidthM * normal[1],
          ]);
        const from = point(a),
          to = point(b);
        await prepare(from);
        const result = owner.sweep(from, to, 250);
        assert.equal(
          result.status,
          'terrain-clear',
          `${route.id}: ${JSON.stringify({ from, to, result })}`,
        );
        sweeps++;
      }
    }
  for (const mark of receipt.landmarks) {
    const from = mm([mark.x, mark.surfaceHeightMm / 1000 + 10, mark.z]);
    await prepare(from);
    const to = { ...from, y: mark.surfaceHeightMm - 2000 };
    assert.equal(owner.sweep(from, to, 250).status, 'terrain-hit', mark.id);
    landmarkHits++;
  }
  for (const spawn of manifest.spawns) {
    await prepare(spawn.position);
    assert.equal(
      owner.sweep(spawn.position, { ...spawn.position, y: spawn.position.y + 1000 }, 250).status,
      'terrain-clear',
    );
  }
} finally {
  await owner.dispose();
}
assert.equal(owner.snapshot().geometryBytes, 0);
console.log(
  JSON.stringify(
    {
      passed: true,
      manifestSHA256: receipt.manifestSHA256,
      sourceBytes,
      extentM: [8192, 8192],
      canonicalGLBs: canonical,
      deterministicallyRegeneratedAssets: canonical * 2,
      exactSeams: seams,
      windows: receipt.representativeWindows.length,
      transitions,
      maxResidentCells,
      peakGeometryBytes,
      clearCorridorSweeps: sweeps,
      actualLandmarkContacts: landmarkHits,
      clearAuthoredStarts: manifest.spawns.length,
      disposedGeometryBytes: owner.snapshot().geometryBytes,
      commandedFlightVerified: false,
      playerAdmission: false,
    },
    null,
    2,
  ),
);
