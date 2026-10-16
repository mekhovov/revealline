import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { prepareRegionalDownload } from '../../../../optional-practice/civilian-fpv/regional-delivery.mjs';
import { createRegionalSession } from '../../../../optional-practice/civilian-fpv/regional-session.mjs';

assert(process.argv[2], 'Provide the immutable expanse delivery directory');
const root = resolve(process.argv[2]);
const pin = {
  url: 'https://expanse.invalid/delivery.json',
  bytes: 329372,
  sha256: 'd2c3dce6c39227e85a10256fb3d1082fec2a6c7a47f6347fd664e2840eb57003',
};
const requests = [];
const prepared = await prepareRegionalDownload(pin, {
  pageURL: 'https://expanse.invalid/sim',
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
assert.equal(prepared.descriptor.id, 'canyon-expanse-study');
assert.equal(prepared.descriptor.revision, 'relief-r1');
assert.equal(requests.length, 2051);
assert.equal(new Set(requests).size, 2051);
const terrainBytes = Buffer.from(await prepared.assets.get('terrain/region.json').arrayBuffer());
assert.equal(
  createHash('sha256').update(terrainBytes).digest('hex'),
  '74fbf90c62eafc79e2ba25a4375f5e1d5da5ec25b758da4b3c78cf64c95067d6',
);
const manifest = JSON.parse(terrainBytes);
const sceneryManifest = JSON.parse(await prepared.assets.get('scenery/region.json').text());
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
      sceneryRequests,
      starts,
      nativeStorageVerified: false,
      playerAdmission: false,
    },
    null,
    2,
  ),
);
