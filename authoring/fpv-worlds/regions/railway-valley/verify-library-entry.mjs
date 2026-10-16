/** Exact-pin appearance and safe-start functional admission. No browser or FPS claim. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import {
  loadRegionalReview,
  createRegionalSession,
} from '../../../../optional-practice/civilian-fpv/regional-session.mjs';
import {
  REGIONAL_LIBRARY_PINS,
  applyRegionalAppearance,
  regionalPresentationOptions,
} from '../../../../optional-practice/civilian-fpv/regional-library.mjs';
const root = resolve(process.argv[2] ?? '');
assert(process.argv[2], 'Provide exact Railway expanse delivery');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const identity = {
  id: 'railway-valley-expanse',
  sha256: '38bddc6a19c8ba5965992b68ed9b80398cb515dc99de7ce07cac11c9436606c7',
};
const row = REGIONAL_LIBRARY_PINS.find((item) => item.id === identity.id);
assert.equal(row.pin.sha256, identity.sha256);
const descriptorBytes = await readFile(resolve(root, 'delivery.json'));
assert.equal(hash(descriptorBytes), row.pin.sha256);
assert.equal(descriptorBytes.length, row.pin.bytes);
assert.equal(JSON.parse(descriptorBytes).totalBytes + descriptorBytes.length, row.bytes);
assert(
  REGIONAL_LIBRARY_PINS.some((item) => item.id === 'railway-valley-study'),
  'Retain the old Railway revision',
);
const fetchImpl = async (url, { signal } = {}) => {
  signal?.throwIfAborted();
  const file = resolve(root, '.' + new URL(url).pathname);
  assert(file.startsWith(root + sep));
  return new Response(await readFile(file));
};
const config = await loadRegionalReview({
  manifestURL: '/terrain/region.json',
  sceneryURL: '/scenery/region.json',
  pageURL: 'https://railway.invalid/sim',
  fetchImpl,
});
assert.equal(config.manifest.id, identity.id);
assert.equal(config.manifest.spawns.length, 6);
const approved = applyRegionalAppearance(config, identity);
assert.equal(approved.source.surfaceStyle, 'railway');
assert.equal(config.source.surfaceStyle, undefined);
for (const wrong of [null, { ...identity, id: 'other' }, { ...identity, sha256: '0'.repeat(64) }])
  assert.equal(applyRegionalAppearance(approved, wrong).source.surfaceStyle, 'plain');
assert.equal(
  applyRegionalAppearance({ ...config, manifest: { ...config.manifest, id: 'other' } }, identity)
    .source.surfaceStyle,
  'plain',
);
const records = [];
let geometryDigest;
for (const [quality, expected] of [
  ['low', 'performance'],
  ['balanced', 'balanced'],
  ['high', 'quality'],
]) {
  const session = createRegionalSession(regionalPresentationOptions(approved, quality));
  try {
    await session.prepare();
    const initial = session.snapshot();
    assert.equal(initial.status, 'paused');
    assert.equal(initial.ticks, 0);
    const digest = createHash('sha256');
    let surfaces = 0;
    session.root.traverse((object) => {
      if (!object.isMesh) return;
      for (const attribute of [object.geometry.attributes.position, object.geometry.index])
        if (attribute)
          digest.update(
            new Uint8Array(
              attribute.array.buffer,
              attribute.array.byteOffset,
              attribute.array.byteLength,
            ),
          );
      for (const material of [object.material].flat()) {
        if (!material.name.startsWith('Railway yards and cutting')) continue;
        assert.equal(material.name, `Railway yards and cutting · ${expected}`);
        for (const next of ['quality', 'performance', expected]) {
          material.userData.setRegionalSurfaceQuality(next);
          assert.equal(material.name, `Railway yards and cutting · ${next}`);
        }
        surfaces++;
      }
    });
    assert(surfaces > 0);
    const exact = digest.digest('hex');
    geometryDigest ??= exact;
    assert.equal(exact, geometryDigest, 'Quality cannot change collision geometry');
    assert.deepEqual(session.snapshot(), initial, 'Presentation cannot arm or advance physics');
    records.push({ quality, surfaces, geometryDigest: exact });
  } finally {
    await session.dispose();
    assert.equal(session.root.children.length, 0);
    for (const field of [
      'geometryBytes',
      'textureBytes',
      'sourceBytes',
      'reservedSourceBytes',
      'reservedGeometryBytes',
    ])
      assert.equal(session.snapshot().terrain[field], 0);
  }
}
console.log(
  JSON.stringify(
    {
      passed: true,
      identity,
      records,
      exactDescriptor: true,
      oldRevisionPreserved: true,
      playerAdmission: false,
      claim:
        'Source-only exact pin, presentation, safe preparation and disposal. Native player and package acceptance remain separate.',
    },
    null,
    2,
  ),
);
