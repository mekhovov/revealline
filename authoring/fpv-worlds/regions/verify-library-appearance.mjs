/** Verify trusted presentation against actual paired sources and production sessions. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import {
  loadRegionalReview,
  createRegionalSession,
} from '../../../optional-practice/civilian-fpv/regional-session.mjs';
import {
  applyRegionalAppearance,
  regionalPresentationOptions,
  REGIONAL_LIBRARY_PINS,
} from '../../../optional-practice/civilian-fpv/regional-library.mjs';

const variants = {
  'canyon-expanse': {
    id: 'canyon-expanse-study',
    sha256: 'd2c3dce6c39227e85a10256fb3d1082fec2a6c7a47f6347fd664e2840eb57003',
    material: 'Canyon sediment',
    surface: 'canyon',
    sourcePins: {
      terrain: '74fbf90c62eafc79e2ba25a4375f5e1d5da5ec25b758da4b3c78cf64c95067d6',
      scenery: '688b6b655b584efb78438f4ab14f23b6b07971ef54c3f13cfed158afa1da4448',
    },
  },
  'canyon-districts': {
    id: 'canyon-arrival-landmarks-study',
    sha256: 'f69cc4d315c254d5b825e2cfbde21d8509da1c8e3ae2a3e743de95782c5300c8',
    material: 'Canyon sediment',
    surface: 'canyon',
    sourcePins: {
      terrain: '219b438a19fdd7decd022cd48d145b1a45505198e86e9270cf818696894210a4',
      scenery: '3b704a760c06c7ed066e11050cadcb1af27d5ad18ed87e63e2a66137507fcff6',
    },
  },
  railway: {
    id: 'railway-valley-study',
    sha256: '431b2dfb4be228e094174f1ccdd8eb72f906f09eb39a62c31b16e2bfb1239f15',
    material: 'Railway yards and cutting',
    sourcePins: {
      terrain: 'ed0ea8d9a7dcde8453fd89186c1e8f1982c122e91deee8cc3b33daa6fba5980c',
      scenery: '1cfd2659a7bf1429a47d2652274d437204ffebc3f2ed5bc7a7d48a8959c59f3d',
    },
  },
  canyon: {
    id: 'canyon-arrival-landmarks-study',
    sha256: '5cd92029c88179e94231b4ec4f799372b075cd187421e9feec3fb6ee2eabf6d0',
    material: 'Canyon sediment',
    sourcePins: {
      terrain: '9fad494a6dc1e974695e9fa218b99e74f1676d2589303c7ececea8728b106239',
      scenery: 'a72ba600c11eba60486b645ca40967802498deb28e46dece02b10b3f04e0c30f',
    },
  },
};
const style = process.argv[3] ?? 'railway';
assert(
  Object.hasOwn(variants, style),
  'Choose railway, canyon, canyon-districts or canyon-expanse',
);
const variant = variants[style];
const root = resolve(process.argv[2] ?? '');
assert(process.argv[2], 'Provide the exact reviewed regional source pair');
const identity = { id: variant.id, sha256: variant.sha256 };
const pin = REGIONAL_LIBRARY_PINS.find(
  (row) => row.id === identity.id && row.pin.sha256 === identity.sha256,
);
assert(pin, 'The exact reviewed regional pin must be present');
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
const sourcePins = variant.sourcePins;
for (const [layer, hash] of Object.entries(sourcePins))
  assert.equal(
    createHash('sha256')
      .update(await readFile(resolve(root, layer, 'region.json')))
      .digest('hex'),
    hash,
  );
const bound = applyRegionalAppearance(configuration, identity);
assert.equal(bound.source.surfaceStyle, variant.surface ?? style);
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
    if (expected === 'plain')
      assert([...names].every((name) => !name.startsWith(variant.material)));
    else assert(names.has(`${variant.material} · ${expected}`));
    records.push({
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
