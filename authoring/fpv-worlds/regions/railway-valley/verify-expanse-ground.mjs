/** Scoped functional verification, not GPU compilation or visual acceptance. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { createVerifiedMixedWindow } from '../verified-mixed-window.mjs';
import { createTerrainSurface } from '../terrain-surface.mjs';

assert(process.argv[2], 'Provide the exact districts-r1 source directory');
const root = resolve(process.argv[2]);
const digest = (data) => createHash('sha256').update(data).digest('hex');
const pins = {
  terrain: '71f1330ce107aecd34adef19041c6f48c5492bb0ea1b668d147e4a148f108b69',
  scenery: 'b94730367c57670d8844007bff2953c05e282f5ac29352cf7914d25041bfe642',
};
const manifests = {};
for (const [layer, hash] of Object.entries(pins)) {
  const bytes = await readFile(resolve(root, layer, 'region.json'));
  assert.equal(digest(bytes), hash);
  manifests[layer] = JSON.parse(bytes);
}
const fetchImpl = async (url, { signal } = {}) => {
  signal?.throwIfAborted();
  const file = resolve(root, '.' + new URL(url).pathname);
  assert(file.startsWith(root + sep));
  return new Response(await readFile(file));
};
const records = [],
  expected = new Map();
for (const quality of ['plain', 'performance', 'balanced', 'quality']) {
  const window = createVerifiedMixedWindow(manifests.terrain, {
    maxGeometryBytes: 8 * 1024 * 1024,
    source: {
      baseURL: 'https://ground.invalid/terrain/',
      fetchImpl,
      surfaceStyle: quality === 'plain' ? 'plain' : 'railway-expanse',
      surfaceQuality: quality === 'plain' ? 'balanced' : quality,
    },
    scenery: {
      manifest: manifests.scenery,
      source: { baseURL: 'https://ground.invalid/scenery/', fetchImpl },
    },
  });
  try {
    for (const spawn of manifests.terrain.spawns) {
      const state = await window.transition(spawn.position);
      const hash = createHash('sha256'),
        materials = new Set();
      window.group.traverse((object) => {
        if (!object.isMesh) return;
        for (const key of ['position', 'normal', 'uv']) {
          const a = object.geometry.attributes[key];
          if (a)
            hash.update(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength));
        }
        const a = object.geometry.index;
        if (a) hash.update(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength));
        for (const material of [object.material].flat()) materials.add(material.name);
      });
      const facts = {
        geometryDigest: hash.digest('hex'),
        geometryBytes: state.geometryBytes,
        textureBytes: state.textureBytes,
        support: window.support(spawn.position, 200000),
        groundStrike: window.sweep(spawn.position, { ...spawn.position, y: -20000 }),
        clearApproach: window.sweep(spawn.position, {
          ...spawn.position,
          z: spawn.position.z + 1000,
        }),
      };
      assert.equal(facts.support.status, 'terrain-hit');
      assert.equal(facts.groundStrike.status, 'terrain-hit');
      assert.equal(facts.clearApproach.status, 'terrain-clear');
      if (quality === 'plain') expected.set(spawn.id, facts);
      else {
        assert.deepEqual(facts, expected.get(spawn.id));
        assert(materials.has(`Railway valley districts · ${quality}`));
      }
      records.push({ quality, spawn: spawn.id, ...facts });
    }
  } finally {
    await window.dispose();
  }
  const final = window.snapshot();
  for (const key of [
    'geometryBytes',
    'textureBytes',
    'reservedGeometryBytes',
    'reservedResourceBytes',
  ])
    assert.equal(final[key] ?? 0, 0);
  assert.equal(window.group, null);
}
assert.throws(() =>
  createTerrainSurface({
    style: 'railway-expanse',
    quality: 'ultra',
    originMm: { x: 0, y: 0, z: 0 },
  }),
);
console.log(
  JSON.stringify(
    {
      passed: true,
      sourcePins: pins,
      records,
      scope:
        '24 exact-source material/window comparisons; native shader and appearance review remain required',
      geometryChanged: false,
      collisionChanged: false,
      texturesAdded: 0,
      disposalZero: true,
    },
    null,
    2,
  ),
);
