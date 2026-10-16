/** Verify the immutable architecture increment through the real paired renderer/collision owner. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createVerifiedMixedWindow } from '../verified-mixed-window.mjs';
import { hallDetailProbes } from './hall-detail.mjs';

const [parent, output] = process.argv.slice(2);
assert(parent && output, 'Provide loading mixed-r2 and generated hall mixed-r3 directories');
const manifests = {},
  sources = {},
  sourceBefore = [];
let originalSurfaces = 0,
  newSurfaces = 0;
for (const profile of ['terrain', 'scenery']) {
  const directory = resolve(output, profile);
  manifests[profile] = JSON.parse(await readFile(resolve(directory, 'region.json'), 'utf8'));
  const bodies = new Map();
  for (const asset of manifests[profile].assets) {
    const bytes = await readFile(resolve(directory, asset.path));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
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
      assert(added.every((s) => s.id.startsWith('hall-')));
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
assert.equal(originalSurfaces, 102);
assert.equal(newSurfaces, 6);
const owner = createVerifiedMixedWindow(manifests.terrain, {
  source: sources.terrain,
  scenery: { manifest: manifests.scenery, source: sources.scenery },
});
const mm = (p) => ({ x: p[0] * 1000, y: p[1] * 1000, z: p[2] * 1000 });
let geometryBytes,
  queries = 0;
try {
  await owner.transition({ x: 190000, y: 4000, z: 50000 });
  geometryBytes = owner.snapshot().geometryBytes;
  for (const probe of hallDetailProbes) {
    const hit = owner.sweep(mm(probe.from), mm(probe.to), 250);
    assert.equal(hit.status, probe.clear ? 'terrain-clear' : 'terrain-hit', probe.id);
    if (!probe.clear) assert.equal(hit.layer, 'scenery');
    queries++;
  }
  // Actual new geometry catches support above the canopy, while the existing sky shaft stays open.
  const canopy = owner.support({ x: 190000, y: 20000, z: 26000 }, 30000);
  assert.equal(canopy.layer, 'scenery');
  assert(canopy.heightMm > 9200 && canopy.heightMm < 9600);
  const shaft = owner.support({ x: 190000, y: 20000, z: 50000 }, 30000);
  assert.equal(shaft.layer, 'terrain');
  assert.equal(shaft.heightMm, 0);
  queries += 2;
  await owner.dispose();
  assert.equal(owner.snapshot().geometryBytes, 0);
  for (const [path, bytes] of sourceBefore) assert.deepEqual(await readFile(path), bytes);
  console.log(
    JSON.stringify(
      {
        passed: true,
        originalSurfaces,
        newSurfaces,
        byteIdenticalTerrainAssets: 18,
        realCollisionQueries: queries,
        geometryBytes,
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
