import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  prepareOptionalCatalog,
  prepareOptionalDownload,
  loadOptionalCatalog,
  OPTIONAL_CATALOG_PATH,
  verifyOptionalInstalled,
  assertOptionalPack,
} from '../optional-chapters.mjs';
import { emptyPackLibrary, installPack, preparePack } from '../packs.mjs';
const root = new URL('../../', import.meta.url);
const catalog = prepareOptionalCatalog(
  JSON.parse(await readFile(new URL(OPTIONAL_CATALOG_PATH, root))),
);
const item = catalog.packs[0],
  bytes = await readFile(new URL(item.path, root));
const baseURL = 'https://game.example/releases/v-test/site/';
const decodeImage = async (url) => {
  const png = Buffer.from(url.split(',')[1], 'base64');
  return { naturalWidth: png.readUInt32BE(16), naturalHeight: png.readUInt32BE(20) };
};
test('strict optional metadata is owned; unsafe paths, oversized files, duplicates and accessors reject', () => {
  for (const patch of [
    { path: '../elsewhere.json' },
    { bytes: 25 * 1048576 },
    { sha256: 'forged' },
  ])
    assert.throws(() => prepareOptionalCatalog({ ...catalog, packs: [{ ...item, ...patch }] }));
  assert.throws(() => prepareOptionalCatalog({ ...catalog, packs: [item, item] }));
  let reads = 0;
  const source = {};
  Object.defineProperty(source, 'packs', {
    enumerable: true,
    get() {
      reads++;
      return [];
    },
  });
  assert.throws(() => prepareOptionalCatalog(source));
  assert.equal(reads, 0);
});
test('exact original pack download passes streaming byte/hash, real pack preparation and installation', async () => {
  const requests = [],
    library = emptyPackLibrary();
  const pack = await prepareOptionalDownload(item, {
    baseURL,
    library,
    decodeImage,
    fetch: async (url, options) => {
      requests.push([url, options.redirect]);
      return new Response(bytes);
    },
  });
  assert.deepEqual(requests, [[baseURL + item.path, 'error']]);
  assert.equal(pack.id, item.id);
  assert.equal(installPack(library, pack).packs[0].id, item.id);
  assert.equal(library.packs.length, 0);
});
test('corrupt and incomplete downloads reject before the image decoder', async () => {
  const broken = Buffer.from(bytes);
  broken[broken.length - 2] ^= 1;
  for (const data of [broken, bytes.subarray(0, bytes.length - 1)])
    await assert.rejects(
      prepareOptionalDownload(item, {
        baseURL,
        library: emptyPackLibrary(),
        decodeImage: () => assert.fail('cannot decode unverified bytes'),
        fetch: async () => new Response(data),
      }),
      /checksum|incomplete/,
    );
});
test('oversized streams cancel and cannot allocate beyond their published bound', async () => {
  let cancelled = 0;
  await assert.rejects(
    prepareOptionalDownload(
      { ...item, bytes: item.normalizedBytes },
      {
        baseURL,
        library: emptyPackLibrary(),
        fetch: async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array(item.normalizedBytes + 1));
              },
              cancel() {
                cancelled++;
              },
            }),
          ),
      },
    ),
    /byte budget/,
  );
  assert.equal(cancelled, 1);
});
test('abort cancels an in-progress body and does not decode or complete installation', async () => {
  const controller = new AbortController();
  let reading;
  const started = new Promise((resolve) => {
    reading = resolve;
  });
  const pending = prepareOptionalDownload(item, {
    baseURL,
    signal: controller.signal,
    library: emptyPackLibrary(),
    decodeImage: () => assert.fail(),
    fetch: async () =>
      new Response(
        new ReadableStream({
          start() {
            reading();
          },
        }),
      ),
  });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await started;
  controller.abort();
  await rejected;
});
test('catalog download is bounded and same-origin; file protocols and HTTP errors do not fall back silently', async () => {
  assert.deepEqual(
    await loadOptionalCatalog({
      baseURL,
      fetch: async (url) => {
        assert.equal(url, baseURL + OPTIONAL_CATALOG_PATH);
        return new Response(JSON.stringify(catalog));
      },
    }),
    catalog,
  );
  await assert.rejects(
    loadOptionalCatalog({ baseURL: 'file:///game/', fetch: () => assert.fail() }),
    /same-origin HTTP/,
  );
  await assert.rejects(
    loadOptionalCatalog({ baseURL, fetch: async () => new Response('', { status: 503 }) }),
    /HTTP 503/,
  );
  await assert.rejects(
    loadOptionalCatalog({ baseURL, fetch: async () => new Response('x'.repeat(65537)) }),
    /byte budget/,
  );
});

test('installed artwork must match the complete normalized content, not just the campaign or a shallow frozen object', async () => {
  const original = JSON.parse(bytes);
  const { pack } = await preparePack(original, { decodeImage });
  assert.equal(await verifyOptionalInstalled(pack, item), pack);
  assert.equal(
    await verifyOptionalInstalled(pack, item),
    pack,
    'An immutable prepared object remains reusable',
  );
  const changed = JSON.parse(bytes);
  changed.levelVisuals[0].visualOverrides.background.dataUrl =
    changed.levelVisuals[1].visualOverrides.background.dataUrl;
  const altered = (await preparePack(changed, { decodeImage })).pack;
  assert.equal(
    assertOptionalPack(altered, item),
    altered,
    'Same rules/campaign is insufficient to authenticate artwork',
  );
  await assert.rejects(verifyOptionalInstalled(altered, item), /different .*edition/);
  Object.freeze(original);
  await verifyOptionalInstalled(original, item);
  original.levelVisuals[0].visualOverrides.background.dataUrl =
    original.levelVisuals[1].visualOverrides.background.dataUrl;
  await assert.rejects(
    verifyOptionalInstalled(original, item),
    /different .*edition/,
    'Shallow freezing cannot cache mutable children',
  );
});
