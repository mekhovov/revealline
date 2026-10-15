import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { prepareRegionalDownload } from '../../../../optional-practice/civilian-fpv/regional-delivery.mjs';
import { createRegionalSession } from '../../../../optional-practice/civilian-fpv/regional-session.mjs';

assert(process.argv[2], 'Provide the immutable desert delivery directory');
const root = resolve(process.argv[2]);
const metadata = JSON.parse(await readFile(new URL('./delivery-pin.json', import.meta.url)));
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
assert.equal(prepared.descriptor.revision, 'natural-r1');
assert.equal(prepared.descriptor.totalBytes, metadata.payloadBytes);
assert.equal(prepared.descriptor.totalBytes + pin.bytes, metadata.totalBytes);
assert(
  metadata.totalBytes <= 64 * 1024 * 1024,
  'Whole delivery includes descriptor in 64 MiB ceiling',
);
assert.equal(requests.length, 2051);
assert.equal(new Set(requests).size, 2051);
const terrainBytes = Buffer.from(await prepared.assets.get('terrain/region.json').arrayBuffer());
assert.equal(
  createHash('sha256').update(terrainBytes).digest('hex'),
  '21c5b63e51a33c22ebd7ff22e05d92d6b91b00173fcc5d3c911bc530bb166468',
);
const manifest = JSON.parse(terrainBytes);
assert.equal(manifest.grid.cellSizeMm, 512000);
assert.equal(manifest.grid.width, 32);
assert.equal(manifest.grid.depth, 32);
const sceneryBytes = Buffer.from(await prepared.assets.get('scenery/region.json').arrayBuffer());
assert.equal(
  createHash('sha256').update(sceneryBytes).digest('hex'),
  '4a3209477eca0b4aed8c961f1f9c7a36d2074ac0529b368536764e772c8a411a',
);
const sceneryManifest = JSON.parse(sceneryBytes);
assert.equal(sceneryManifest.format, 'FPVSceneryManifest.v1');
assert.equal(sceneryManifest.chunks.length, 1024);
assert.equal(sceneryManifest.assets.length, 0);
assert(sceneryManifest.chunks.every((chunk) => chunk.assets.length === 0));
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
      assert.equal(geometryBytes, 456408);
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
assert.equal(sceneryRequests, 0);
console.log(
  JSON.stringify(
    {
      passed: true,
      descriptor: pin,
      files: prepared.descriptor.files.length,
      verifiedResponses: requests.length,
      totalBytes: prepared.descriptor.totalBytes,
      totalWithDescriptor: prepared.descriptor.totalBytes + pin.bytes,
      unchangedTerrainManifest: true,
      unchangedSparseManifest: true,
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
