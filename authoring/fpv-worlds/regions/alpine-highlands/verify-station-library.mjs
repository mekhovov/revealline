/** Actual immutable HTTPS download and production session checks; no browser claim. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { prepareRegionalDownload } from '../../../../optional-practice/civilian-fpv/regional-delivery.mjs';
import {
  REGIONAL_LIBRARY_PINS,
  applyRegionalAppearance,
  regionalPresentationOptions,
} from '../../../../optional-practice/civilian-fpv/regional-library.mjs';
import {
  createRegionalSession,
  regionalLibraryEntry,
  regionalStartingPoint,
  regionalLocationIdentity,
} from '../../../../optional-practice/civilian-fpv/regional-session.mjs';

const sha256 = 'c60fd92ed1dc00136fb8df55bf02bcc211b932c4bbe018917a1f37b549ac3c8d';
const row = REGIONAL_LIBRARY_PINS.find(
  (entry) => entry.id === 'alpine-highlands-study' && entry.pin.sha256 === sha256,
);
assert(row);
const priorPins = JSON.parse(
  await readFile(
    new URL('./receipts-station-materials-r1/prior-library-pins.json', import.meta.url),
    'utf8',
  ),
);
for (const previous of priorPins) {
  const retained = REGIONAL_LIBRARY_PINS.find(
    (candidate) => candidate.id === previous.id && candidate.pin.sha256 === previous.pin.sha256,
  );
  assert.deepEqual(retained, previous, 'Every prior complete catalogue row stays exact');
}
assert.equal(REGIONAL_LIBRARY_PINS.length, priorPins.length + 1);
assert.deepEqual(row.edition, {
  en: 'Station surface details',
  uk: 'Деталі поверхонь станції',
});
assert.deepEqual(
  row.startHeadings,
  REGIONAL_LIBRARY_PINS.find(
    (candidate) =>
      candidate.pin.sha256 === 'a442a07717d09c703231279db41dd23c9447e0cc7f5f53aa3964eef4f74573ec',
  ).startHeadings,
);

assert.equal(row.pin.sha256, sha256);
assert.equal(row.pin.bytes, 115316);
assert.equal(row.bytes, 22694130);
assert.match(row.pin.url, /\/ffb79b67479f9ed5c8104610695ac8b5cb04edc7\//);
assert.match(row.title.en, /study/i);
assert(row.title.uk && row.description.uk);
const requests = [],
  progress = [],
  started = performance.now();
const checked = await prepareRegionalDownload(row.pin, {
  pageURL: 'https://alpine-library.invalid/sim',
  signal: AbortSignal.timeout(180000),
  fetchImpl: async (url, options) => {
    requests.push(String(url));
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    return fetch(url, options);
  },
  onProgress: (value) => progress.push(value),
});
const downloadMs = performance.now() - started;
assert.equal(requests.length, 723);
assert.equal(new Set(requests).size, 723);
assert.equal(checked.descriptor.id, row.id);
assert.deepEqual(row.title, checked.descriptor.title, 'Download/saved title stays consistent');
assert.equal(checked.descriptor.revision, 'station-r3');
assert.equal(checked.descriptor.format, 'FPVRegionalDelivery.v2');
assert.equal(checked.descriptor.totalBytes + row.pin.bytes, row.bytes);
assert.equal(progress.at(-1).loadedBytes, 22578814);
assert(progress.every((value, i) => !i || value.loadedBytes >= progress[i - 1].loadedBytes));
const files = new Map();
for (const ref of checked.descriptor.files) {
  const bytes = new Uint8Array(await checked.assets.get(ref.path).arrayBuffer());
  assert.equal(bytes.length, ref.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256);
  files.set('/' + ref.path, bytes);
}
const decode = (name) =>
  JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(files.get(name)));
const manifest = decode('/terrain/region.json'),
  scenery = decode('/scenery/region.json');
assert.equal(manifest.grid.width * manifest.grid.cellSizeMm, 4096000);
assert.equal(manifest.grid.depth * manifest.grid.cellSizeMm, 4096000);
assert.equal(manifest.spawns.length, 6);
assert.equal(scenery.chunks.filter((cell) => !cell.assets.length).length, 152);
const fetchImpl = async (url, { signal } = {}) => {
  signal?.throwIfAborted();
  const parsed = new URL(url);
  assert.equal(parsed.origin, 'https://alpine-cache.invalid');
  assert(files.has(parsed.pathname), 'No unverified request or network fallback');
  return new Response(files.get(parsed.pathname));
};
const configuration = {
  manifest,
  source: { baseURL: 'https://alpine-cache.invalid/terrain/', fetchImpl },
  scenery: {
    manifest: scenery,
    source: { baseURL: 'https://alpine-cache.invalid/scenery/', fetchImpl },
  },
  geometryProfile: 'terrain-scenery-v1',
};
const identity = { id: row.id, sha256 },
  geometry = new Map(),
  cases = [];
const approved = applyRegionalAppearance(configuration, identity);
assert.equal(configuration.scenery.source.surfaceStyle, undefined, 'Verified input is not mutated');
assert.equal(approved.scenery.source.fetchImpl, configuration.scenery.source.fetchImpl);
assert.equal(approved.scenery.manifest, configuration.scenery.manifest);
for (const invalid of [
  { ...identity, sha256: '0'.repeat(64) },
  { ...identity, id: 'unknown-region' },
]) {
  const plain = applyRegionalAppearance(approved, invalid);
  assert.equal(
    plain.scenery.source.surfaceStyle,
    'plain',
    'Unknown/rebound identity clears a previous style',
  );
}
assert.equal(
  applyRegionalAppearance({ ...approved, manifest: { ...manifest, id: 'other-region' } }, identity)
    .scenery.source.surfaceStyle,
  'plain',
);
assert.throws(
  () =>
    applyRegionalAppearance(configuration, identity, [
      { ...row, appearance: { scenery: 'untrusted-profile' } },
    ]),
  /Unknown scenery surface profile/,
);
assert.throws(
  () => regionalPresentationOptions(approved, 'untrusted-tier'),
  /Unknown regional flight quality/,
);
const terrainOnly = { manifest, source: configuration.source };
assert.equal(Object.hasOwn(applyRegionalAppearance(terrainOnly, identity), 'scenery'), false);
assert.equal(Object.hasOwn(regionalPresentationOptions(terrainOnly, 'balanced'), 'scenery'), false);
const entry = regionalLibraryEntry(configuration, identity);
assert.equal(entry.regionalReview, false);
assert.equal(entry.freeFlight, true);
assert.deepEqual(entry.course.steps, { acro: [], 'self-level': [] });
assert.equal(regionalLocationIdentity(entry).sha256, sha256);
assert.throws(
  () => regionalStartingPoint(entry, 'unknown-start'),
  /Unknown regional starting point/,
);
for (const quality of ['low', 'balanced', 'high']) {
  const styled = regionalPresentationOptions(
    applyRegionalAppearance(configuration, identity),
    quality,
  );
  assert.equal(styled.source.surfaceStyle, 'plain');
  assert.equal(styled.scenery.source.surfaceStyle, 'alpine-overlays');
  assert.equal(
    styled.scenery.source.surfaceQuality,
    { low: 'performance', balanced: 'balanced', high: 'quality' }[quality],
  );
  for (const mode of ['self-level', 'acro'])
    for (const spawn of manifest.spawns) {
      const options = regionalPresentationOptions({ ...approved, spawnId: spawn.id }, quality);
      assert.equal(options.initialHeading, row.startHeadings[spawn.id]);
      const session = createRegionalSession({
        ...options,
        mode,
        spawnId: spawn.id,
      });
      try {
        assert.equal(session.arm(), false);
        await session.prepare();
        const state = session.snapshot();
        assert.equal(state.status, 'paused');
        assert.deepEqual(state.position, spawn.position);
        assert.equal(state.ticks, 0);
        let biased = 0;
        const hash = createHash('sha256');
        session.root.traverse((object) => {
          if (!object.isMesh) return;
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material]) {
            if (material.name === 'Alpine terrain overlay') {
              assert.equal(material.polygonOffset, true);
              assert.equal(material.polygonOffsetFactor, -1);
              assert.equal(material.polygonOffsetUnits, -1);
              assert.equal(material.depthTest, true);
              biased++;
            }
          }
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
        if (
          ['glacial-valley', 'switchback-pass', 'snow-saddle', 'summit-station'].includes(spawn.id)
        )
          assert(biased > 0, spawn.id + ': approved overlay correction applied');
        if (!geometry.has(spawn.id)) geometry.set(spawn.id, digest);
        assert.equal(digest, geometry.get(spawn.id), 'Tiers/modes preserve canonical geometry');
        assert(session.arm());
        let moving;
        for (let tick = 0; tick < 100; tick++) {
          moving = session.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0.52 });
          assert.equal(moving.status, 'active', moving.reason);
          assert.equal(moving.contacts, 0);
          await new Promise((done) => setImmediate(done));
        }
        session.pause();
        const held = session.snapshot();
        assert.deepEqual(session.step({ roll: 1, pitch: 1, yaw: 1, throttle: 1 }), held);
        cases.push({
          quality,
          mode,
          spawnId: spawn.id,
          ticks: moving.ticks,
          biasedOverlayMeshes: biased,
          geometrySHA256: digest,
        });
      } finally {
        await session.dispose();
        assert.equal(session.root.children.length, 0);
        for (const key of [
          'geometryBytes',
          'textureBytes',
          'reservedGeometryBytes',
          'reservedSourceBytes',
        ])
          assert.equal(session.snapshot().terrain[key], 0);
      }
    }
}
console.log(
  JSON.stringify(
    {
      passed: true,
      pin: row.pin,
      bytes: row.bytes,
      actualHTTPSResponses: requests.length,
      downloadMs,
      cases,
      disposalZero: true,
      limitsChanged: false,
      existingLibraryRowsPreserved: true,
      limitations: [
        'No native renderer, device, IndexedDB installation or offline admission claim',
        'Three material tiers preserve geometry; no GPU performance claim',
        'Alpine station surfaces have bounded native source review; full-region representative art and normal Library player acceptance remain separate',
      ],
    },
    null,
    2,
  ),
);
