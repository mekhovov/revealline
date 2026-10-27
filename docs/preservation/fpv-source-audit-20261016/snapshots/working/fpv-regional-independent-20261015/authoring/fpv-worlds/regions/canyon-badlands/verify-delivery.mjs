import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { prepareRegionalDownload } from '../../../../optional-practice/civilian-fpv/regional-delivery.mjs';

const [bundleArg, sourceArg] = process.argv.slice(2);
assert(bundleArg && sourceArg, 'Provide immutable Canyon bundle and accepted paired source');
const bundle = resolve(bundleArg),
  source = resolve(sourceArg);
const pin = {
  url: 'https://canyon.invalid/delivery.json',
  bytes: 6790,
  sha256: '5cd92029c88179e94231b4ec4f799372b075cd187421e9feec3fb6ee2eabf6d0',
};
const requests = [];
const fetchImpl = async (url, options) => {
  assert.equal(options.credentials, 'omit');
  assert.equal(options.redirect, 'error');
  const file = resolve(bundle, '.' + new URL(url).pathname);
  assert(file.startsWith(bundle + sep));
  requests.push(new URL(url).pathname);
  return new Response(await readFile(file));
};
const prepared = await prepareRegionalDownload(pin, {
  pageURL: 'https://canyon.invalid/sim',
  fetchImpl,
});
assert.equal(prepared.descriptor.id, 'canyon-arrival-landmarks-study');
assert.equal(prepared.descriptor.revision, 'rounded-r1');
assert.equal(prepared.descriptor.files.length, 38);
assert.equal(prepared.descriptor.totalBytes, 1173350);
assert.equal(requests.length, 39);
assert.equal(new Set(requests).size, 39);
for (const file of prepared.descriptor.files) {
  const actual = Buffer.from(await prepared.assets.get(file.path).arrayBuffer());
  assert.equal(actual.length, file.bytes);
  assert.equal(createHash('sha256').update(actual).digest('hex'), file.sha256);
  assert.deepEqual(actual, await readFile(resolve(source, file.path)));
}
for (const layer of ['terrain', 'scenery']) {
  const manifest = JSON.parse(await readFile(resolve(bundle, layer, 'region.json')));
  assert.deepEqual(
    [manifest.grid.minX, manifest.grid.minZ, manifest.grid.width, manifest.grid.depth],
    [0, 0, 3, 3],
  );
  assert.equal(manifest.grid.cellSizeMm, 128000);
  assert.equal(manifest.chunks.length, 9);
  const cells = new Set(manifest.chunks.map((c) => `${c.x}/${c.z}`));
  for (let z = 0; z < 3; z++) for (let x = 0; x < 3; x++) assert(cells.has(`${x}/${z}`));
}
console.log(
  JSON.stringify(
    {
      passed: true,
      descriptor: { bytes: pin.bytes, sha256: pin.sha256 },
      files: 38,
      verifiedRequests: requests.length,
      totalBytes: prepared.descriptor.totalBytes,
      totalWithDescriptor: prepared.descriptor.totalBytes + pin.bytes,
      actualExtentM: [384, 384],
      exactSourceBytesPreserved: true,
      playerAdmission: false,
    },
    null,
    2,
  ),
);
