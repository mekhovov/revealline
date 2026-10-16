/** Verify companion geometry independently of mixed-player admission. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import validator from 'gltf-validator';
import { validateRegionManifest } from '../region-manifest.mjs';
import { validateTerrainSeams, compileTerrainCell } from '../terrain-cell.mjs';
import { compileSceneryCell } from '../scenery-cell.mjs';
import { createVerifiedTerrainWindow } from '../verified-terrain-window.mjs';
import { createVerifiedSceneryWindow } from '../verified-scenery-window.mjs';
import { probes } from './layout.mjs';

const output = process.argv[2];
assert(output, 'Provide generated mixed Urban directory');
const sha = (v) => createHash('sha256').update(v).digest('hex');
const receipt = JSON.parse(await readFile(resolve(output, 'preparation.json'), 'utf8'));
for (const [file, hash] of [
  ['original-provenance.json', receipt.sourceProvenanceSHA256],
  ['license-provenance.json', receipt.licenseReceiptSHA256],
  [receipt.bundledLicense, receipt.bundledLicenseSHA256],
])
  assert.equal(sha(await readFile(resolve(output, file))), hash, file);
const manifests = {},
  bodies = new Map(),
  cells = {};
let triangles = 0,
  nonGroundSurfaces = 0;
for (const profile of ['terrain', 'scenery']) {
  const bytes = await readFile(resolve(output, profile, 'region.json'));
  assert.equal(sha(bytes), receipt[`${profile}ManifestSHA256`]);
  const manifest = validateRegionManifest(bytes.toString('utf8'));
  manifests[profile] = manifest;
  cells[profile] = [];
  for (const asset of manifest.assets) {
    const data = await readFile(resolve(output, profile, asset.path));
    assert.equal(data.length, asset.bytes);
    assert.equal(sha(data), asset.sha256);
    bodies.set(`/${profile}/${asset.path}`, data);
    if (asset.kind === 'scene') {
      const validation = await validator.validateBytes(data);
      assert.equal(validation.issues.numErrors, 0);
      assert.equal(validation.issues.numWarnings, 0);
    }
  }
  for (const chunk of manifest.chunks) {
    const cell = JSON.parse(bodies.get(`/${profile}/${chunk.id}.json`));
    const compiled = profile === 'terrain' ? compileTerrainCell(cell) : compileSceneryCell(cell);
    assert.deepEqual(Buffer.from(compiled.glb), bodies.get(`/${profile}/${chunk.id}.glb`));
    cells[profile].push(cell);
    if (profile === 'scenery')
      for (const surface of cell.surfaces) {
        assert.notEqual(surface.id, 'surface-0', 'Original ground must not survive in scenery');
        nonGroundSurfaces++;
        triangles += surface.indices.length / 3;
      }
  }
}
assert.equal(triangles, receipt.retainedArchitectureTriangles);
validateTerrainSeams(cells.terrain);
for (const field of ['id', 'revision', 'grid', 'spawns', 'chunks'])
  assert.deepEqual(manifests.terrain[field], manifests.scenery[field], field);
const server = createServer((req, res) => {
  const bytes = bodies.get(req.url);
  res.writeHead(bytes ? 200 : 404);
  res.end(bytes);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}/`;
const terrain = createVerifiedTerrainWindow(manifests.terrain, { baseURL: base + 'terrain/' });
const scenery = createVerifiedSceneryWindow(manifests.scenery, { baseURL: base + 'scenery/' });
const mm = (p) =>
  Object.fromEntries(['x', 'y', 'z'].map((axis, i) => [axis, Math.round(p[i] * 1000)]));
let maximumCombinedGeometryBytes = 0,
  routeSweeps = 0;
async function prepare(position) {
  await terrain.transition(mm(position));
  await scenery.transition(mm(position));
  maximumCombinedGeometryBytes = Math.max(
    maximumCombinedGeometryBytes,
    terrain.snapshot().geometryBytes + scenery.snapshot().geometryBytes,
  );
}
try {
  for (const probe of probes) {
    await prepare(probe.from);
    assert.equal(
      scenery.sweep(mm(probe.from), mm(probe.to), 250).status,
      probe.clear ? 'scenery-clear' : 'scenery-hit',
      probe.id,
    );
    if (probe.clear)
      assert.equal(
        terrain.sweep(mm(probe.from), mm(probe.to), 250).status,
        'terrain-clear',
        probe.id,
      );
  }
  for (const route of receipt.routes) {
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1],
        b = route.points[i],
        dx = b[0] - a[0],
        dz = b[2] - a[2],
        horizontal = Math.hypot(dx, dz),
        divisions = Math.ceil(Math.hypot(dx, b[1] - a[1], dz) / 4);
      for (const offset of [-route.halfWidthM, 0, route.halfWidthM]) {
        const shift = (p) => [
          p[0] - (dz / horizontal) * offset,
          p[1],
          p[2] + (dx / horizontal) * offset,
        ];
        for (let j = 0; j < divisions; j++) {
          const at = (t) => shift(a.map((v, k) => v + (b[k] - v) * t));
          const from = at(j / divisions),
            to = at((j + 1) / divisions);
          const planPoint = mm(from),
            ready = terrain.snapshot().provenance;
          if (
            !ready ||
            Math.floor(planPoint.x / 128000) * 128000 !== ready.originMm.x ||
            Math.floor(planPoint.z / 128000) * 128000 !== ready.originMm.z
          )
            await prepare(from);
          assert.equal(
            terrain.sweep(mm(from), mm(to), 250).status,
            'terrain-clear',
            route.id + ' terrain',
          );
          assert.equal(
            scenery.sweep(mm(from), mm(to), 250).status,
            'scenery-clear',
            route.id + ' scenery',
          );
          routeSweeps++;
        }
      }
    }
  }
  await prepare([190, 20, 50]);
  assert.equal(
    scenery.support(mm([190, 20, 50]), 40000).status,
    'no-support',
    'Skylight has no duplicate scenery ground',
  );
  assert.equal(terrain.support(mm([190, 20, 50]), 40000).heightMm, 0);
  assert(Math.abs(scenery.support(mm([157, 20, 50]), 40000).heightMm - 12400) < 1);
  await prepare([80, 20, 140]);
  assert(Math.abs(terrain.support(mm([80, 20, 140]), 40000).heightMm - 6000) < 1);
  assert.equal(scenery.support(mm([80, 20, 140]), 40000).status, 'no-support');
  for (const spawn of manifests.terrain.spawns) {
    await prepare([spawn.position.x / 1000, spawn.position.y / 1000, spawn.position.z / 1000]);
    assert.equal(terrain.support(spawn.position, 40000).heightMm, 0);
  }
  await Promise.all([terrain.dispose(), scenery.dispose()]);
  assert.equal(terrain.snapshot().geometryBytes + scenery.snapshot().geometryBytes, 0);
  console.log(
    JSON.stringify(
      {
        passed: true,
        canonicalScenes: 18,
        cellsPerProfile: 9,
        retainedArchitectureTriangles: triangles,
        nonGroundSurfaces,
        openingSolidSweeps: probes.length,
        routeSweeps,
        routeCorridorWidthM: 4,
        sweptRadiusMm: 250,
        maximumCombinedGeometryBytes,
        noDuplicateGround: true,
        flightReady: false,
      },
      null,
      2,
    ),
  );
} finally {
  await Promise.all([terrain.dispose(), scenery.dispose()]);
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
