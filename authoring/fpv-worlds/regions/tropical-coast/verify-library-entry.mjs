/** Verify trusted presentation against actual paired sources and production sessions. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import {
  loadRegionalReview,
  createRegionalSession,
} from '../../../../optional-practice/civilian-fpv/regional-session.mjs';
import {
  applyRegionalAppearance,
  regionalPresentationOptions,
  REGIONAL_LIBRARY_PINS,
} from '../../../../optional-practice/civilian-fpv/regional-library.mjs';

const root = resolve(process.argv[2] ?? '');
assert(process.argv[2], 'Provide the exact Tropical coastal source pair');
const harbour = process.argv[3] === 'harbour';
const settlement = process.argv[3] === 'settlement' || harbour;
assert(!process.argv[3] || settlement, 'Unknown Tropical source fixture');
const identity = settlement
  ? {
      id: 'tropical-coastal-districts',
      sha256: harbour
        ? '44aa0de26f4b4aa79fb0ca8f4b6c7d39bdd62debbdc5e4c51a3a12368a0f42ce'
        : 'dab4be6dd5b782d38c6c01f510137d048b9646d1f14e80c4dc40c6d848720f49',
    }
  : {
      id: 'tropical-coastal-study',
      sha256: 'ddd62d4662b873bc97243a414dc4ddc291eeb7e9c084f15af661b449ddcc3443',
    };
const style = settlement ? 'tropical-settlement' : 'tropical';
const label = settlement
  ? 'Coastal settlement paths and shoreline'
  : 'Tropical sand and dune grass';
const pin = REGIONAL_LIBRARY_PINS.find(
  (row) => row.id === identity.id && row.pin.sha256 === identity.sha256,
);
assert(pin, 'The exact reviewed Tropical pin must be present');
const fetchImpl = async (url, { signal } = {}) => {
  signal?.throwIfAborted();
  const file = resolve(root, '.' + new URL(url).pathname);
  assert(file.startsWith(root + sep));
  return new Response(await readFile(file));
};
const configuration = await loadRegionalReview({
  manifestURL: '/terrain/region.json',
  sceneryURL: '/scenery/region.json',
  pageURL: 'https://appearance.invalid/sim',
  fetchImpl,
});
assert.equal(configuration.manifest.id, identity.id);
const sourcePins = settlement
  ? {
      terrain: harbour
        ? 'afd29e7dc274087cc3cae309942c6a4b64d4858fd1a86fa39fbcffff73b78b7a'
        : '3946fc2ffed922dadc171e609753c63590ef3daade337c04395b6356612448a5',
      scenery: harbour
        ? '7e973e3651fea67852f7a235a33465364160398c31463f8efa54a07bcf1752fc'
        : 'ba0339e6e3f8285169a4f10fe1dc456de2fab36632496412b9a7104a6e1ae4c9',
    }
  : {
      terrain: '076a93c6d08181b2ee0d4d4c172d974435df8cf6b7e210d4a9a2ada3753756fd',
      scenery: 'd31187a12b26c11a359e1914963767e9e2da1a70839f755ae7667f1e022e84e3',
    };
for (const [layer, hash] of Object.entries(sourcePins))
  assert.equal(
    createHash('sha256')
      .update(await readFile(resolve(root, layer, 'region.json')))
      .digest('hex'),
    hash,
  );
const bound = applyRegionalAppearance(configuration, identity);
assert.equal(bound.source.surfaceStyle, style);
assert.equal(configuration.source.surfaceStyle, undefined, 'Do not mutate the verified input');
assert.equal(bound.source.fetchImpl, fetchImpl);
assert.equal(bound.scenery, configuration.scenery);
for (const unknown of [
  { ...identity, sha256: 'a'.repeat(64) },
  { ...identity, id: 'other-region' },
  null,
])
  assert.equal(applyRegionalAppearance(bound, unknown).source.surfaceStyle, 'plain');
assert.equal(
  applyRegionalAppearance(
    { ...configuration, manifest: { ...configuration.manifest, id: 'other-region' } },
    identity,
  ).source.surfaceStyle,
  'plain',
);
assert.throws(
  () =>
    applyRegionalAppearance(configuration, identity, [
      { ...pin, appearance: { terrain: 'unbounded-external-style' } },
    ]),
  /Unknown trusted/,
);
assert.throws(() => regionalPresentationOptions(bound, 'ultra'), /Unknown regional flight quality/);

const records = [];
let geometryDigest;
for (const [quality, expected] of [
  ['low', 'performance'],
  ['balanced', 'balanced'],
  ['high', 'quality'],
  ['unknown-pin', 'plain'],
]) {
  const options =
    quality === 'unknown-pin'
      ? regionalPresentationOptions(
          applyRegionalAppearance(bound, { ...identity, sha256: 'a'.repeat(64) }),
          'balanced',
        )
      : regionalPresentationOptions(bound, quality);
  const session = createRegionalSession(options);
  try {
    await session.prepare();
    const state = session.snapshot();
    assert.equal(state.status, 'paused');
    assert.equal(state.ticks, 0);
    assert.equal(state.contacts, 0);
    const names = new Set(),
      hash = createHash('sha256');
    session.root.traverse((object) => {
      if (!object.isMesh) return;
      for (const material of [object.material].flat()) names.add(material.name);
      for (const attribute of [
        object.geometry.attributes.position,
        object.geometry.attributes.normal,
        object.geometry.index,
      ])
        if (attribute)
          hash.update(
            new Uint8Array(
              attribute.array.buffer,
              attribute.array.byteOffset,
              attribute.array.byteLength,
            ),
          );
    });
    const digest = hash.digest('hex');
    geometryDigest ??= digest;
    assert.equal(digest, geometryDigest, 'Presentation choices cannot change geometry');
    if (expected === 'plain') assert([...names].every((name) => !name.startsWith(label)));
    else assert(names.has(`${label} · ${expected}`));
    let liveMaterialUpdates = 0;
    if (expected !== 'plain') {
      const before = session.snapshot();
      session.root.traverse((object) => {
        if (!object.isMesh) return;
        for (const material of [object.material].flat()) {
          if (!material.name.startsWith(label)) continue;
          const geometry = object.geometry;
          const initialVersion = material.version;
          for (const next of ['performance', 'quality', expected]) {
            material.userData.setRegionalSurfaceQuality(next);
            assert.equal(material.name, `${label} · ${next}`);
            assert.equal(
              material.customProgramCacheKey(),
              `fpv-tropical-${settlement ? 'settlement' : 'ground'}-v1-${next}`,
            );
            assert.equal(object.geometry, geometry);
          }
          assert(material.version > initialVersion);
          assert.throws(() => material.userData.setRegionalSurfaceQuality('ultra'), /Unknown/);
          liveMaterialUpdates++;
        }
      });
      assert(liveMaterialUpdates > 0);
      assert.deepEqual(session.snapshot(), before, 'Material updates cannot arm or move the body');
    }
    records.push({
      liveMaterialUpdates,
      quality,
      terrain: expected,
      geometryBytes: state.terrain.geometryBytes,
      textureBytes: state.terrain.textureBytes,
      geometryDigest: digest,
    });
    await session.dispose();
    assert.equal(session.root.children.length, 0);
    assert.equal(session.snapshot().terrain.geometryBytes, 0);
    assert.equal(session.snapshot().terrain.textureBytes, 0);
  } finally {
    await session.dispose();
  }
}
const starts = [];
if (settlement) {
  assert.equal(configuration.manifest.spawns.length, 6);
  for (const spawn of configuration.manifest.spawns) {
    const session = createRegionalSession({
      ...regionalPresentationOptions(bound, 'balanced'),
      spawnId: spawn.id,
    });
    try {
      await session.prepare();
      const state = session.snapshot();
      assert.equal(state.status, 'paused');
      assert.equal(state.ticks, 0);
      assert.deepEqual(state.lastInput, { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
      starts.push({ id: spawn.id, status: state.status, ticks: state.ticks });
    } finally {
      await session.dispose();
      assert.equal(session.root.children.length, 0);
      assert.equal(session.snapshot().terrain.geometryBytes, 0);
      assert.equal(session.snapshot().terrain.textureBytes, 0);
    }
  }
}
console.log(
  JSON.stringify(
    {
      passed: true,
      descriptorIdentity: identity,
      starts,
      records,
      launchOnly: true,
      sourcePins,
      claim:
        'Verified exact-pin launch, live material-only tier updates and disposal. Native player, package and sustained flight acceptance remain separate.',
    },
    null,
    2,
  ),
);
