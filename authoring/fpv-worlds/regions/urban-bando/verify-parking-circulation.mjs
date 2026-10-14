/** Verify the immutable architecture increment through the real paired renderer/collision owner. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';
import { createVerifiedMixedWindow } from '../verified-mixed-window.mjs';
import { parkingCirculationProbes, parkingFlightLine } from './parking-circulation.mjs';

const [parent, output] = process.argv.slice(2);
assert(parent && output, 'Provide hall mixed-r3 and generated parking mixed-r4 directories');
const manifests = {},
  sources = {},
  sourceBefore = [];
let canonicalGLBs = 0,
  originalSurfaces = 0,
  newSurfaces = 0;
for (const profile of ['terrain', 'scenery']) {
  const directory = resolve(output, profile);
  manifests[profile] = JSON.parse(await readFile(resolve(directory, 'region.json'), 'utf8'));
  const bodies = new Map();
  for (const asset of manifests[profile].assets) {
    const bytes = await readFile(resolve(directory, asset.path));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    if (asset.kind === 'scene') {
      const report = await validator.validateBytes(bytes);
      assert.equal(report.issues.numErrors, 0, asset.path);
      assert.equal(report.issues.numWarnings, 0, asset.path);
      canonicalGLBs++;
    }
    bodies.set('/' + asset.path, bytes);
    sourceBefore.push([resolve(directory, asset.path), Buffer.from(bytes)]);
    const before = await readFile(resolve(parent, profile, asset.path));
    if (profile === 'terrain')
      assert.deepEqual(bytes, before, 'Original terrain must stay byte-identical');
    else if (asset.kind === 'collision') {
      const previous = JSON.parse(before),
        current = JSON.parse(bytes);
      for (const surface of previous.surfaces) {
        assert.deepEqual(
          current.surfaces.find((s) => s.id === surface.id),
          surface,
        );
        originalSurfaces++;
      }
      const added = current.surfaces.filter((s) => !previous.surfaces.some((p) => p.id === s.id));
      assert(added.every((s) => s.id.startsWith('parking-')));
      newSurfaces += added.length;
    }
  }
  sources[profile] = {
    baseURL: `https://${profile}.invalid/`,
    surfaceStyle: 'urban',
    fetchImpl: async (url) =>
      new Response(bodies.get(new URL(url).pathname), {
        status: bodies.has(new URL(url).pathname) ? 200 : 404,
      }),
  };
}
assert.equal(originalSurfaces, 108);
assert.equal(newSurfaces, 7);
const owner = createVerifiedMixedWindow(manifests.terrain, {
  source: sources.terrain,
  scenery: { manifest: manifests.scenery, source: sources.scenery },
});
const mm = (p) => ({
  x: Math.round(p[0] * 1000),
  y: Math.round(p[1] * 1000),
  z: Math.round(p[2] * 1000),
});
let geometryBytes,
  queries = 0;
try {
  await owner.transition({ x: 64000, y: 4000, z: 220000 });
  geometryBytes = owner.snapshot().geometryBytes;
  for (const probe of parkingCirculationProbes) {
    const hit = owner.sweep(mm(probe.from), mm(probe.to), 250);
    assert.equal(hit.status, probe.clear ? 'terrain-clear' : 'terrain-hit', probe.id);
    if (!probe.clear) assert.equal(hit.layer, 'scenery');
    queries++;
  }
  // Walk every segment and two 2 m offset lanes with a real 250 mm sphere.
  for (let i = 1; i < parkingFlightLine.length; i++) {
    const a = parkingFlightLine[i - 1],
      b = parkingFlightLine[i];
    const dx = b[0] - a[0],
      dz = b[2] - a[2],
      length = Math.hypot(dx, dz);
    for (const offset of [-2, 0, 2]) {
      for (let n = 0; n < 32; n++) {
        const point = (t) =>
          a.map(
            (v, k) =>
              v +
              (b[k] - v) * t +
              (k === 0 ? (-dz / length) * offset : k === 2 ? (dx / length) * offset : 0),
          );
        const hit = owner.sweep(mm(point(n / 32)), mm(point((n + 1) / 32)), 250);
        assert.equal(
          hit.status,
          'terrain-clear',
          `ascending route ${i} lane ${offset} sample ${n}`,
        );
        queries++;
      }
    }
  }
  for (const [x, expected] of [
    [44, 3.25],
    [64, 9.1],
    [84, 15.1],
  ]) {
    const hit = owner.support({ x: x * 1000, y: 25000, z: 203000 }, 30000);
    assert.equal(hit.layer, 'scenery');
    assert(Math.abs(hit.heightMm - (expected + 0.25) * 1000) < 60);
    queries++;
  }
  await owner.transition({ x: 192000, y: 4000, z: 192000 });
  const fullWindowGeometryBytes = owner.snapshot().geometryBytes;
  assert(
    fullWindowGeometryBytes < 2 * 1024 * 1024,
    'Parking study exceeds its 2 MiB geometry budget',
  );
  await owner.dispose();
  assert.equal(owner.snapshot().geometryBytes, 0);
  for (const [path, bytes] of sourceBefore) assert.deepEqual(await readFile(path), bytes);
  console.log(
    JSON.stringify(
      {
        passed: true,
        canonicalGLBs,
        originalSurfaces,
        newSurfaces,
        byteIdenticalTerrainAssets: 18,
        realCollisionQueries: queries,
        geometryBytes,
        fullWindowGeometryBytes,
        disposed: true,
        sourceUnchanged: true,
        flightReady: false,
      },
      null,
      2,
    ),
  );
} finally {
  await owner.dispose();
}
