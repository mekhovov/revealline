/** Exact Library identity, three tiers, eight starts, original indexed surfaces and disposal. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareRegionalDownload } from '../../../../optional-practice/civilian-fpv/regional-delivery.mjs';
import { createRegionalSession } from '../../../../optional-practice/civilian-fpv/regional-session.mjs';
import {
  REGIONAL_LIBRARY_PINS,
  applyRegionalAppearance,
  regionalPresentationOptions,
} from '../../../../optional-practice/civilian-fpv/regional-library.mjs';
assert(process.argv[2], 'Provide exact published delivery-town-r2 directory');
const root = resolve(process.argv[2]);
const identity = {
  id: 'hillside-town-study',
  sha256: 'de1dc4726724bf4851e5976191585e04205f81ba3b83f14442e0c94f18b907d9',
};
const row = REGIONAL_LIBRARY_PINS.find(
  (r) => r.id === identity.id && r.pin.sha256 === identity.sha256,
);
assert(row, 'Exact immutable Hillside row required');
assert.equal(row.pin.bytes, 6558);
assert.equal(row.bytes, 8352486);
assert.equal(
  row.pin.url,
  'https://raw.githubusercontent.com/mekhovov/revealline/0cdeca133c5f0f10a3a0d1c2b8c8a2361ce8b8a1/authoring/fpv-worlds/regions/hillside-town/delivery-town-r2/delivery.json',
);
const prepared = await prepareRegionalDownload(
  { ...row.pin, url: 'https://hillside.invalid/delivery.json' },
  {
    pageURL: 'https://hillside.invalid/sim',
    fetchImpl: async (url, { signal }) => {
      signal?.throwIfAborted();
      const file = resolve(root, '.' + new URL(url).pathname);
      assert(file.startsWith(root + sep));
      return new Response(await readFile(file));
    },
  },
);
assert.deepEqual(row.title, prepared.descriptor.title);
assert.equal(row.bytes, prepared.descriptor.totalBytes);
const manifests = {};
for (const layer of ['terrain', 'scenery'])
  manifests[layer] = JSON.parse(await prepared.assets.get(layer + '/region.json').text());
assert.deepEqual(
  manifests.terrain.spawns.map((s) => s.id),
  ['lower-square', 'middle-courtyard', 'upper-terrace', 'elevated-pad'],
);
const source = (layer) => ({
  baseURL: `https://saved.invalid/${layer}/`,
  fetchImpl: async (url, { signal } = {}) => {
    signal?.throwIfAborted();
    const path = new URL(url).pathname.slice(1);
    assert(prepared.assets.has(path), 'Only verified installed bytes may load');
    return new Response(prepared.assets.get(path));
  },
});
const original = {
  manifest: manifests.terrain,
  source: source('terrain'),
  scenery: { manifest: manifests.scenery, source: source('scenery') },
  geometryProfile: 'terrain-scenery-v1',
};
const bound = applyRegionalAppearance(original, identity);
assert.equal(bound.source.surfaceStyle, 'plain');
assert.equal(original.source.surfaceStyle, undefined);
assert.equal(bound.source.fetchImpl, original.source.fetchImpl);
assert.equal(bound.scenery, original.scenery);
for (const changed of [null, { ...identity, id: 'wrong' }, { ...identity, sha256: 'a'.repeat(64) }])
  assert.equal(applyRegionalAppearance(original, changed).source.surfaceStyle, 'plain');
assert.throws(() => regionalPresentationOptions(bound, 'ultra'), /Unknown regional flight quality/);
const digests = new Map(),
  results = [];
for (const quality of ['low', 'balanced', 'high'])
  for (const mode of ['self-level', 'acro'])
    for (const spawn of manifests.terrain.spawns) {
      const session = createRegionalSession({
        ...regionalPresentationOptions(bound, quality),
        mode,
        spawnId: spawn.id,
      });
      try {
        assert.equal(session.arm(), false);
        await session.prepare();
        const state = session.snapshot(),
          geometry = createHash('sha256');
        assert.equal(state.status, 'paused');
        assert.equal(state.ticks, 0);
        assert.equal(state.contacts, 0);
        assert.deepEqual(state.position, spawn.position);
        assert.deepEqual(state.lastInput, { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
        assert(state.terrain.resourceBytes * 2 < 8 * 1024 * 1024);
        let texturedMaterials = 0;
        session.root.traverse((object) => {
          if (!object.isMesh) return;
          for (const attribute of [
            object.geometry.attributes.position,
            object.geometry.attributes.normal,
            object.geometry.attributes.uv,
            object.geometry.index,
          ])
            if (attribute)
              geometry.update(
                new Uint8Array(
                  attribute.array.buffer,
                  attribute.array.byteOffset,
                  attribute.array.byteLength,
                ),
              );
          for (const material of [object.material].flat()) if (material.map) texturedMaterials++;
        });
        assert(texturedMaterials > 0, 'Original indexed building palette must remain visible');
        const digest = geometry.digest('hex');
        if (!digests.has(spawn.id)) digests.set(spawn.id, digest);
        assert.equal(digest, digests.get(spawn.id), 'Modes/detail cannot change geometry or UVs');
        session.pause();
        assert.deepEqual(session.step({ roll: 1, pitch: 1, yaw: 1, throttle: 1 }), state);
        results.push({
          quality,
          mode,
          start: spawn.id,
          geometryDigest: digest,
          texturedMaterials,
          resourceBytes: state.terrain.resourceBytes,
          paused: true,
        });
      } finally {
        await session.dispose();
        assert.equal(session.root.children.length, 0);
        for (const key of [
          'geometryBytes',
          'textureBytes',
          'resourceBytes',
          'sourceBytes',
          'reservedGeometryBytes',
          'reservedSourceBytes',
        ])
          assert.equal(session.snapshot().terrain[key], 0);
      }
    }
assert.equal(results.length, 24);
console.log(
  JSON.stringify(
    {
      passed: true,
      identity,
      pin: row.pin,
      sourceRevision: 'town-r2',
      starts: 4,
      modes: 2,
      tiers: 3,
      results,
      disposed: true,
      nativePlayerVerified: false,
      claim:
        'Verified-byte Library configuration and production prepare only; native source/player review and package/offline remain required.',
    },
    null,
    2,
  ),
);
