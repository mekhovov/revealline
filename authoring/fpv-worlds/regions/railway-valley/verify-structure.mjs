/** Additional exact-parent and real collision checks for the structural revision. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createVerifiedMixedWindow } from '../verified-mixed-window.mjs';
import { structuralProbes } from './structural-detail.mjs';

const [parent, output] = process.argv.slice(2);
assert(parent && output, 'Provide the pinned parent and new structural output');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifests = {},
  sources = {};
let retainedTerrainAssets = 0,
  retainedSurfaces = 0,
  addedSurfaces = 0;
const pins = {
  terrain: '74fed25caacb37797094706a0257e562c8ac594781578948d6789ea89120e8fd',
  scenery: 'ac591533ee71318cf631e79b8513eb7df61733e86578c8113d879c449f6ebcdb',
};
for (const profile of ['terrain', 'scenery']) {
  const parentBytes = await readFile(resolve(parent, profile, 'region.json'));
  assert.equal(sha(parentBytes), pins[profile]);
  const old = JSON.parse(parentBytes),
    bytes = await readFile(resolve(output, profile, 'region.json'));
  const current = (manifests[profile] = JSON.parse(bytes)),
    bodies = new Map();
  for (const field of ['id', 'grid', 'chunks', 'spawns'])
    assert.deepEqual(current[field], old[field]);
  for (const asset of current.assets) {
    const data = await readFile(resolve(output, profile, asset.path));
    assert.equal(sha(data), asset.sha256);
    assert.equal(data.length, asset.bytes);
    const prior = await readFile(resolve(parent, profile, asset.path));
    const priorAsset = old.assets.find((a) => a.id === asset.id);
    assert.equal(sha(prior), priorAsset.sha256);
    if (profile === 'terrain') {
      assert.deepEqual(data, prior);
      retainedTerrainAssets++;
    } else if (asset.kind === 'collision') {
      const source = JSON.parse(data),
        original = JSON.parse(prior);
      const cell = source.cell ?? source,
        oldCell = original.cell ?? original;
      assert.deepEqual(cell.surfaces.slice(0, oldCell.surfaces.length), oldCell.surfaces);
      assert.deepEqual(source.bindings, original.bindings);
      assert.deepEqual(source.textures, original.textures);
      retainedSurfaces += oldCell.surfaces.length;
      addedSurfaces += cell.surfaces.length - oldCell.surfaces.length;
    }
    bodies.set('/' + asset.path, data);
  }
  sources[profile] = {
    baseURL: `https://${profile}.invalid/`,
    fetchImpl: async (url) =>
      new Response(bodies.get(new URL(url).pathname), {
        status: bodies.has(new URL(url).pathname) ? 200 : 404,
      }),
  };
}
for (const path of ['License.txt', 'source-provenance.json'])
  assert.deepEqual(await readFile(resolve(output, path)), await readFile(resolve(parent, path)));
const mm = (p) => ({ x: p[0] * 1000, y: p[1] * 1000, z: p[2] * 1000 });
const owner = createVerifiedMixedWindow(manifests.terrain, {
  source: sources.terrain,
  scenery: { manifest: manifests.scenery, source: sources.scenery },
});
try {
  await owner.transition(mm([192, 30, 192]));
  for (const probe of structuralProbes) {
    const result = owner.sweep(mm(probe.from), mm(probe.to), 250);
    assert.equal(
      result.status,
      probe.clear ? 'terrain-clear' : 'terrain-hit',
      `${probe.id}: ${JSON.stringify(result)}`,
    );
    if (!probe.clear) assert.equal(result.layer, 'scenery', probe.id);
  }
  const full = owner.snapshot();
  await owner.dispose();
  assert.equal(owner.snapshot().geometryBytes, 0);
  assert.equal(owner.snapshot().textureBytes, 0);
  console.log(
    JSON.stringify(
      {
        passed: true,
        retainedTerrainAssets,
        retainedSurfaces,
        addedSurfaces,
        structureQueries: structuralProbes.length,
        fullWindowGeometryBytes: full.geometryBytes,
        textureBytes: full.textureBytes,
        disposed: true,
        playerReady: false,
      },
      null,
      2,
    ),
  );
} finally {
  await owner.dispose();
}
