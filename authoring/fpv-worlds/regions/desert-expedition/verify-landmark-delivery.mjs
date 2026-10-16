import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { prepareRegionalDownload } from '../../../../optional-practice/civilian-fpv/regional-delivery.mjs';
import { createRegionalSession } from '../../../../optional-practice/civilian-fpv/regional-session.mjs';

assert(process.argv[2], 'Provide the immutable desert delivery directory');
const root = resolve(process.argv[2]);
const metadata = JSON.parse(
  await readFile(new URL('./landmark-delivery-pin.json', import.meta.url)),
);
const pin = { url: 'https://desert.invalid/delivery.json', ...metadata.pin };
const requests = [];
const prepared = await prepareRegionalDownload(pin, {
  pageURL: 'https://desert.invalid/sim',
  fetchImpl: async (url, options) => {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    const pathname = new URL(url).pathname;
    const file = resolve(root, '.' + pathname);
    assert(file.startsWith(root + sep));
    requests.push(pathname);
    return new Response(await readFile(file));
  },
});
assert.equal(prepared.descriptor.format, 'FPVRegionalDelivery.v2');
assert.equal(prepared.descriptor.id, 'desert-expedition-study');
assert.equal(prepared.descriptor.revision, 'landmarks-r1');
assert.equal(prepared.descriptor.totalBytes, metadata.payloadBytes);
assert.equal(prepared.descriptor.totalBytes + pin.bytes, metadata.totalBytes);
assert(
  metadata.totalBytes <= 64 * 1024 * 1024,
  'Whole delivery includes descriptor in 64 MiB ceiling',
);
assert.equal(requests.length, 2063);
assert.equal(new Set(requests).size, 2063);
const terrainBytes = Buffer.from(await prepared.assets.get('terrain/region.json').arrayBuffer());
assert.equal(
  createHash('sha256').update(terrainBytes).digest('hex'),
  'e2e67f498c6b4e64d70e550952ebd9a13dd657488dad3e6c2fb545892023925e',
);
const manifest = JSON.parse(terrainBytes);
const previous = JSON.parse(
  await readFile(new URL('./delivery-natural-r1/terrain/region.json', import.meta.url)),
);
assert.deepEqual(manifest.assets, previous.assets, 'Every original terrain identity is preserved');
assert.deepEqual(manifest.spawns, previous.spawns, 'Original starting poses are preserved');
assert.deepEqual(manifest.grid, previous.grid, 'Original bounds and terrain lattice are preserved');
for (const asset of previous.assets) {
  const original = await readFile(
    new URL(`./delivery-natural-r1/terrain/${asset.path}`, import.meta.url),
  );
  assert.equal(createHash('sha256').update(original).digest('hex'), asset.sha256);
  assert.deepEqual(
    Buffer.from(await prepared.assets.get(`terrain/${asset.path}`).arrayBuffer()),
    original,
  );
}
assert.equal(manifest.grid.cellSizeMm, 512000);
assert.equal(manifest.grid.width, 32);
assert.equal(manifest.grid.depth, 32);
const sceneryBytes = Buffer.from(await prepared.assets.get('scenery/region.json').arrayBuffer());
assert.equal(
  createHash('sha256').update(sceneryBytes).digest('hex'),
  '29a7d69d580ba363901c84c356f5f3166f0d94b43150d9352bd49429ffbbd2fc',
);
const sceneryManifest = JSON.parse(sceneryBytes);
assert.equal(sceneryManifest.format, 'FPVSceneryManifest.v1');
assert.equal(sceneryManifest.chunks.length, 1024);
assert.equal(sceneryManifest.assets.length, 12);
assert.equal(sceneryManifest.chunks.filter((chunk) => chunk.assets.length === 2).length, 6);
let sceneryRequests = 0;
const source = (layer) => ({
  baseURL: `https://prepared.invalid/${layer}/`,
  fetchImpl: async (url, { signal } = {}) => {
    signal?.throwIfAborted();
    const path = new URL(url).pathname.slice(1);
    if (path.startsWith('scenery/')) sceneryRequests++;
    assert(prepared.assets.has(path), 'No unverified source fallback');
    return new Response(prepared.assets.get(path));
  },
});
const configuration = {
  manifest,
  source: source('terrain'),
  scenery: { manifest: sceneryManifest, source: source('scenery') },
  geometryProfile: 'terrain-scenery-v1',
};
const starts = [];
for (const mode of ['self-level', 'acro'])
  for (const spawn of manifest.spawns) {
    const session = createRegionalSession({ ...configuration, spawnId: spawn.id, mode });
    try {
      assert.equal(session.arm(), false);
      await session.prepare();
      let state = session.snapshot();
      assert.equal(state.status, 'paused');
      assert.equal(state.ticks, 0);
      assert.equal(state.contacts, 0);
      assert.deepEqual(state.position, spawn.position);
      const geometryBytes = state.terrain.geometryBytes;
      assert(geometryBytes >= 456408 && geometryBytes < 8 * 1024 * 1024);
      assert.equal(state.terrain.textureBytes, 0);
      assert.equal(session.arm(), true);
      for (let tick = 0; tick < 200; tick++)
        state = session.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0.58 });
      assert.equal(state.ticks, 200);
      assert.equal(state.contacts, 0);
      assert(state.position.y > spawn.position.y, 'Explicit climb must move above authored start');
      session.pause();
      const paused = session.snapshot();
      assert.deepEqual(session.step({ roll: 1, pitch: 1, yaw: 1, throttle: 1 }), paused);
      starts.push({
        mode,
        id: spawn.id,
        geometryBytes,
        ticks: state.ticks,
        contacts: state.contacts,
      });
    } finally {
      await session.dispose();
      assert.equal(session.snapshot().terrain.geometryBytes, 0);
      assert.equal(session.root.children.length, 0);
    }
  }
assert(sceneryRequests > 0);
console.log(
  JSON.stringify(
    {
      passed: true,
      descriptor: pin,
      files: prepared.descriptor.files.length,
      verifiedResponses: requests.length,
      totalBytes: prepared.descriptor.totalBytes,
      totalWithDescriptor: prepared.descriptor.totalBytes + pin.bytes,
      newPairedManifestRevision: true,
      unchangedTerrainAssets: true,
      sixPopulatedSceneryCells: true,
      sourceExtentM: [16384, 16384],
      sceneryRequests,
      starts,
      nativeStorageVerified: false,
      playerAdmission: false,
    },
    null,
    2,
  ),
);
