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
const identity = {
  id: 'tropical-coastal-study',
  sha256: 'ddd62d4662b873bc97243a414dc4ddc291eeb7e9c084f15af661b449ddcc3443',
};
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
const sourcePins = {
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
assert.equal(bound.source.surfaceStyle, 'tropical');
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
    if (expected === 'plain') assert([...names].every((name) => !name.startsWith('Tropical sand')));
    else assert(names.has(`Tropical sand and dune grass · ${expected}`));
    let liveMaterialUpdates = 0;
    if (expected !== 'plain') {
      const before = session.snapshot();
      session.root.traverse((object) => {
        if (!object.isMesh) return;
        for (const material of [object.material].flat()) {
          if (!material.name.startsWith('Tropical sand')) continue;
          const geometry = object.geometry;
          const initialVersion = material.version;
          for (const next of ['performance', 'quality', expected]) {
            material.userData.setRegionalSurfaceQuality(next);
            assert.equal(material.name, `Tropical sand and dune grass · ${next}`);
            assert.equal(material.customProgramCacheKey(), `fpv-tropical-ground-v1-${next}`);
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
console.log(
  JSON.stringify(
    {
      passed: true,
      descriptorIdentity: identity,
      records,
      launchOnly: true,
      sourcePins,
      claim:
        'Verified source-to-material launch evidence; live mid-flight surface tier updates remain separate.',
    },
    null,
    2,
  ),
);
