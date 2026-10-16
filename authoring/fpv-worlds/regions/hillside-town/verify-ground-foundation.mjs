/** Scoped functional verification, not GPU compilation or visual acceptance. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { createVerifiedMixedWindow } from '../verified-mixed-window.mjs';
import { createTerrainSurface } from '../terrain-surface.mjs';
import { probes } from './design.mjs';

assert(process.argv[2], 'Provide the exact town-r2 source directory');
const root = resolve(process.argv[2]);
const digest = (data) => createHash('sha256').update(data).digest('hex');
const pins = {
  terrain: '84d2e15d9931e6b71d11303d940bd67be8b12dd1c79cc6ed839e460596a34037',
  scenery: '0d2f74e20cae601bf79dbcc4a5fa4819aadf4ee14c08eac59d43454848ea358a',
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
const openings = [],
  records = [],
  expected = new Map();
for (const quality of ['plain', 'performance', 'balanced', 'quality']) {
  const window = createVerifiedMixedWindow(manifests.terrain, {
    maxGeometryBytes: 8 * 1024 * 1024,
    source: {
      baseURL: 'https://ground.invalid/terrain/',
      fetchImpl,
      surfaceStyle: quality === 'plain' ? 'plain' : 'hillside-town',
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
        assert(materials.has(`Hillside streets and courtyards · ${quality}`));
      }
      records.push({ quality, spawn: spawn.id, ...facts });
      if (quality !== 'plain')
        window.group.traverse((object) => {
          if (!object.isMesh) return;
          for (const material of [object.material].flat()) {
            if (!material.name.startsWith('Hillside streets and courtyards')) continue;
            for (const next of ['performance', 'quality', quality]) {
              material.userData.setRegionalSurfaceQuality(next);
              const shader = {
                uniforms: {},
                vertexShader: '#include <common>\n#include <begin_vertex>',
                fragmentShader: '#include <common>\n#include <color_fragment>',
              };
              material.onBeforeCompile(shader);
              assert(shader.vertexShader.includes('hillsideOrigin'));
              assert(shader.fragmentShader.includes('Door approaches'));
              assert(!shader.fragmentShader.includes('uniform float time'));
              assert.equal(material.name, `Hillside streets and courtyards · ${next}`);
            }
          }
        });
    }
    // Explicitly admit the central 3×3 window before querying every distant opening.
    await window.transition({ x: 192000, y: 60000, z: 192000 });
    for (const probe of probes) {
      const mm = (v) => ({ x: v[0] * 1000, y: v[1] * 1000, z: v[2] * 1000 });
      const result = window.sweep(mm(probe.from), mm(probe.to), 250);
      assert.equal(result.status, probe.clear ? 'terrain-clear' : 'terrain-hit', probe.id);
      if (quality === 'plain') expected.set(probe.id, result);
      else assert.deepEqual(result, expected.get(probe.id));
      openings.push({ quality, probe: probe.id, result });
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
    style: 'hillside-town',
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
      openings,
      scope:
        '16 exact-source material/window comparisons; native shader and appearance review remain required',
      geometryChanged: false,
      collisionChanged: false,
      texturesAdded: 0,
      disposalZero: true,
    },
    null,
    2,
  ),
);
