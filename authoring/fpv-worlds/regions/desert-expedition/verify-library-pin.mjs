/** Exact immutable pin plus older-runtime compatibility; not a browser admission receipt. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  DESERT_EXPEDITION_LIBRARY_PIN as row,
  REGIONAL_LIBRARY_PINS,
  applyRegionalAppearance,
} from '../../../../optional-practice/civilian-fpv/regional-library.mjs';
import {
  REGION_CELL_SIZES_MM,
  validateRegionManifest,
} from '../../../../optional-practice/civilian-fpv/regional/region-manifest.mjs';
import {
  validateRegionalDescriptor,
  REGIONAL_DELIVERY_LIMITS,
  prepareRegionalDownload,
} from '../../../../optional-practice/civilian-fpv/regional-delivery.mjs';

const root = resolve(
  process.argv[2] || 'authoring/fpv-worlds/regions/desert-expedition/delivery-natural-r1',
);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bytes = await readFile(resolve(root, 'delivery.json'));
assert.equal(bytes.length, row.pin.bytes);
assert.equal(hash(bytes), row.pin.sha256);
assert.equal(row.id, 'desert-expedition-study');
assert.ok(row.pin.url.includes('/2ccdf059d9d0d55c6eb7e668da6cee9496288255/'));
assert.ok(row.title.en.includes('16 km relief study'));
assert.ok(row.title.uk.length > 10);
const descriptor = validateRegionalDescriptor(JSON.parse(bytes));
assert.equal(descriptor.id, row.id);
assert.equal(descriptor.revision, 'natural-r1');
assert.equal(descriptor.format, 'FPVRegionalDelivery.v2');
assert.equal(row.bytes, 47883876);
assert.equal(descriptor.totalBytes + row.pin.bytes, row.bytes);
assert.ok(row.bytes <= REGIONAL_DELIVERY_LIMITS.totalBytes);
const terrain = JSON.parse(await readFile(resolve(root, descriptor.terrain.path)));
assert.equal(terrain.grid.cellSizeMm, 512000);
assert.equal(terrain.grid.width, 32);
assert.equal(terrain.grid.depth, 32);
const supported = REGION_CELL_SIZES_MM.includes(512000);
assert.equal(REGIONAL_LIBRARY_PINS.includes(row), supported);
if (supported) validateRegionManifest(terrain);
else assert.throws(() => validateRegionManifest(terrain), /Unsupported cell size/);

const requests = [];
const base = new URL('.', row.pin.url);
const options = {
  pageURL: 'https://example.invalid/optional-practice/fpv-worlds/',
  fetchImpl: async (url, init) => {
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    const address = new URL(url);
    assert.equal(address.origin, base.origin);
    assert.ok(address.pathname.startsWith(base.pathname));
    const relative = address.pathname.slice(base.pathname.length);
    assert.ok(!relative.includes('..'));
    requests.push(relative);
    return new Response(await readFile(resolve(root, relative)));
  },
};
if (supported) {
  const prepared = await prepareRegionalDownload(row.pin, options);
  assert.equal(prepared.descriptor.id, row.id);
  assert.equal(new Set(requests).size, 2051);
} else {
  await assert.rejects(() => prepareRegionalDownload(row.pin, options), /Unsupported cell size/);
  assert.equal(
    requests.length,
    3,
    'Unsupported runtime stops after descriptor/manifests, before terrain assets',
  );
}
for (const identity of [
  { id: row.id, sha256: row.pin.sha256 },
  { id: row.id, sha256: '0'.repeat(64) },
]) {
  const applied = applyRegionalAppearance(
    { manifest: terrain, source: { surfaceStyle: 'canyon' } },
    identity,
  );
  assert.equal(applied.source.surfaceStyle, 'plain', 'No unreviewed Desert appearance is admitted');
}
// Stable existing identities remain present; additional parallel entries are allowed.
for (const sha of [
  'ddd62d4662b873bc97243a414dc4ddc291eeb7e9c084f15af661b449ddcc3443',
  'f69cc4d315c254d5b825e2cfbde21d8509da1c8e3ae2a3e743de95782c5300c8',
  '5cd92029c88179e94231b4ec4f799372b075cd187421e9feec3fb6ee2eabf6d0',
  '431b2dfb4be228e094174f1ccdd8eb72f906f09eb39a62c31b16e2bfb1239f15',
  '9a7d157d2d5fd197c632b870bd9b9ebacd62015ad0084605712185064c8ae73a',
])
  assert.ok(REGIONAL_LIBRARY_PINS.some((pin) => pin.pin.sha256 === sha));
console.log(
  JSON.stringify(
    {
      passed: true,
      cell512Supported: supported,
      advertised: supported,
      descriptorSHA256: hash(bytes),
      wholeDeliveryBytes: row.bytes,
      responses: requests.length,
      appearance: 'plain',
      nativeVerified: false,
      releaseReady: false,
    },
    null,
    2,
  ),
);
