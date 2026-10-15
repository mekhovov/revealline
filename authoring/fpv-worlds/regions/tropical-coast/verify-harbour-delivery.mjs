/** Strict immutable download and paused production starts; no player store or UI admission. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareRegionalDownload } from '../../../../optional-practice/civilian-fpv/regional-delivery.mjs';
import { createRegionalSession } from '../../../../optional-practice/civilian-fpv/regional-session.mjs';
import { createVerifiedMixedWindow } from '../verified-mixed-window.mjs';
const root = resolve(process.argv[2] ?? new URL('./harbour-delivery-r3/', import.meta.url).pathname);
const pin = {
  url: 'https://harbour.invalid/delivery.json',
  bytes: 6617,
  sha256: '44aa0de26f4b4aa79fb0ca8f4b6c7d39bdd62debbdc5e4c51a3a12368a0f42ce',
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const requests = [];
const prepared = await prepareRegionalDownload(pin, {
  pageURL: 'https://harbour.invalid/sim',
  fetchImpl: async (url, options) => {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    options.signal?.throwIfAborted();
    const pathname = new URL(url).pathname,
      file = resolve(root, '.' + pathname);
    assert(file.startsWith(root + sep));
    requests.push(pathname);
    return new Response(await readFile(file));
  },
});
const descriptor = prepared.descriptor;
assert.equal(descriptor.format, 'FPVRegionalDelivery.v1');
assert.equal(descriptor.id, 'tropical-coastal-districts');
assert.equal(descriptor.revision, 'harbour-r3');
assert.equal(descriptor.files.length, 38);
assert.equal(requests.length, 39);
assert.equal(new Set(requests).size, 39);
assert(descriptor.totalBytes + pin.bytes < 64 * 1024 * 1024);
const sourcePreparation = JSON.parse(
  await readFile(new URL('./harbour-receipts-r3/preparation.json', import.meta.url)),
);
const manifests = {};
for (const layer of ['terrain', 'scenery']) {
  const bytes = new Uint8Array(await prepared.assets.get(layer + '/region.json').arrayBuffer());
  assert.equal(hash(bytes), sourcePreparation[layer + 'ManifestSHA256']);
  manifests[layer] = JSON.parse(new TextDecoder().decode(bytes));
}
const source = (layer) => ({
  baseURL: `https://prepared.invalid/${layer}/`,
  fetchImpl: async (url, { signal } = {}) => {
    signal?.throwIfAborted();
    const path = new URL(url).pathname.slice(1);
    assert(prepared.assets.has(path), 'No unverified or network fallback');
    return new Response(prepared.assets.get(path));
  },
});
const configuration = {
  manifest: manifests.terrain,
  source: source('terrain'),
  scenery: { manifest: manifests.scenery, source: source('scenery') },
  geometryProfile: 'terrain-scenery-v1',
};
const zeroResources = (snapshot) => {
  for (const key of [
    'geometryBytes',
    'textureBytes',
    'resourceBytes',
    'sourceBytes',
    'reservedGeometryBytes',
    'reservedSourceBytes',
  ])
    assert.equal(snapshot[key], 0, key);
};
const starts = [];
for (const mode of ['self-level', 'acro'])
  for (const spawn of manifests.terrain.spawns) {
    const session = createRegionalSession({ ...configuration, mode, spawnId: spawn.id });
    try {
      assert.equal(session.arm(), false, 'Unprepared source cannot arm');
      await session.prepare();
      let state = session.snapshot();
      assert.equal(state.status, 'paused');
      assert.equal(state.ticks, 0);
      assert.equal(state.contacts, 0);
      assert.deepEqual(state.position, spawn.position);
      assert.deepEqual(state.lastInput, { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
      assert.equal(state.terrain.terrainReady, true);
      assert(state.terrain.resourceBytes * 2 <= 8 * 1024 * 1024);
      const preparedResources = state.terrain.resourceBytes;
      assert.equal(session.arm(), true, 'Only explicit arm starts flight');
      for (let i = 0; i < 200; i++)
        state = session.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0.58 });
      assert.equal(state.ticks, 200);
      assert.equal(state.contacts, 0);
      assert(state.position.y > spawn.position.y, 'Deliberate climb from authored start');
      session.pause();
      const paused = session.snapshot();
      assert.equal(paused.status, 'paused');
      assert.deepEqual(session.step({ roll: 1, pitch: 1, yaw: 1, throttle: 1 }), paused);
      starts.push({
        mode,
        id: spawn.id,
        preparedResources,
        ticks: state.ticks,
        contacts: state.contacts,
        pausedBeforeArm: true,
        pausedInputIgnored: true,
      });
    } finally {
      await session.dispose();
      zeroResources(session.snapshot().terrain);
      assert.equal(session.root.children.length, 0);
    }
  }
assert.equal(starts.length, 12);
// Same verified source through the mixed owner exposes concrete collider ownership.
const owner = createVerifiedMixedWindow(configuration.manifest, {
  source: configuration.source,
  scenery: configuration.scenery,
});
let liveCollision;
try {
  await owner.transition({ x: 192000, y: 60000, z: 192000 });
  liveCollision = owner.collisionSnapshot();
  assert(liveCollision.worlds > 0 && liveCollision.colliders > 0);
} finally {
  await owner.dispose();
  zeroResources(owner.snapshot());
  assert(
    Object.values(owner.collisionSnapshot())
      .filter(Number.isFinite)
      .every((n) => n === 0),
  );
}
console.log(
  JSON.stringify(
    {
      passed: true,
      descriptor: pin,
      files: descriptor.files.length,
      verifiedResponses: requests.length,
      totalBytes: descriptor.totalBytes,
      totalWithDescriptor: descriptor.totalBytes + pin.bytes,
      originalSourceUnchanged: true,
      sourceRevision: 'f82604963cf8781e3e657ca9af37cf57300bc492',
      starts,
      liveCollision,
      disposedCollision: owner.collisionSnapshot(),
      allResourcesDisposed: true,
      nativeStorageVerified: false,
      playerAdmission: false,
      scope:
        'Exact bytes and production prepare/explicit-arm/pause/dispose only. Library admission, package/offline and sustained real-device flight remain pending.',
    },
    null,
    2,
  ),
);
