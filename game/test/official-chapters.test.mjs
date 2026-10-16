import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { memoryCaches } from './helpers/official-caches.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import {
  createOfficialDownloads,
  assetDigest,
  OFFICIAL_ORIGINAL_INDEX,
  OFFICIAL_REFERENCE_MIME,
  officialAssetURL,
  readOfficialOriginal,
} from '../official-downloads.mjs';
import {
  prepareOfficialPack,
  emptyPackLibrary,
  installPack,
  preparePack,
  exportPackLibrary,
  importPackLibrary,
  packLibrarySnapshot,
} from '../packs.mjs';
import { createManagedMediaStore, prepareManagedMediaBytes } from '../managed-media-store.mjs';

function environment(t) {
  const caches = memoryCaches();
  const previous = new Map(
    ['caches', 'location', 'navigator'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: caches });
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { origin: 'https://game.example', href: 'https://game.example/game/' },
  });
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const locks = {
    async request(name, options, work) {
      return (work || options)({ name });
    },
  };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks } });
  return {
    caches,
    store: createOfficialDownloads({ caches, origin: globalThis.location.origin, locks }),
  };
}
const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
const originalPack = JSON.parse(
  readFileSync(new URL('../content/packs/night-shift.json', import.meta.url)),
);
test('official chapter references round trip without consuming imported slots or serializing recording bytes', async (t) => {
  const h = environment(t);
  let library = emptyPackLibrary();
  for (let index = 0; index < 12; index++) {
    const source = structuredClone(originalPack);
    source.id = `import-${index}`;
    source.campaigns[0].id = `campaign-${index}`;
    library = installPack(library, (await preparePack(source, { decodeImage })).pack);
  }
  const body = new Blob([JSON.stringify(originalPack)]),
    sha256 = await assetDigest(await body.arrayBuffer());
  const reference = {
    id: originalPack.id,
    version: originalPack.version,
    sha256,
    bytes: body.size,
  };
  await h.store.download({
    edition: 'test',
    group: 'gameplay',
    files: [reference],
    acquire: async () => body,
  });
  library = installPack(library, (await prepareOfficialPack(reference, { decodeImage })).pack);
  assert.equal(library.packs.length, 13);
  const saved = packLibrarySnapshot(library);
  assert.equal(saved.packs.length, 12);
  assert.deepEqual(saved.official, [reference]);
  const restored = await importPackLibrary(exportPackLibrary(library), { decodeImage });
  assert.equal(restored.packs.length, 13);
  await h.store.remove('test', 'gameplay');
  assert.equal(
    (await importPackLibrary(exportPackLibrary(library), { decodeImage })).packs.length,
    13,
  );
  await h.caches.delete('revealline-official-content-v1');
  await assert.rejects(
    importPackLibrary(exportPackLibrary(library), { decodeImage }),
    /matching chapter/,
  );
});
test('official originals stay in their verified bundle; IDB owns a reference and imported originals keep their bytes', async (t) => {
  const h = environment(t),
    blob = new Blob(['original picture']),
    sha256 = await assetDigest(await blob.arrayBuffer());
  const parent = new Blob(['header bytes', blob]),
    parentHash = await assetDigest(await parent.arrayBuffer());
  await h.store.download({
    edition: 'test',
    group: 'gameplay',
    files: [{ sha256: parentHash, bytes: parent.size }],
    acquire: async () => parent,
  });
  await (
    await h.caches.open(OFFICIAL_ORIGINAL_INDEX)
  ).put(
    officialAssetURL(sha256),
    new Response(
      JSON.stringify({
        sha256,
        parent: parentHash,
        offset: 12,
        bytes: blob.size,
        mime: 'image/png',
      }),
    ),
  );
  assert.equal(await (await readOfficialOriginal(sha256)).text(), 'original picture');
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({ indexedDB: memory.indexedDB });
  t.after(() => manager.close());
  const prepared = await prepareManagedMediaBytes(
    { format: 'revealline-managed-bytes.v1', items: [{ id: 'official', sha256 }] },
    [{ sha256, blob }],
  );
  await manager.commitDomain('media', prepared, { expectedGeneration: 0 });
  const stored = memory.contents().get('mediaBlobs').get(sha256);
  assert.equal(stored.size, 0);
  assert.equal(stored.type, OFFICIAL_REFERENCE_MIME);
  assert.equal(await (await manager.readBlob(sha256)).text(), 'original picture');
  assert.equal(await (await manager.readSelectedBlob(sha256)).text(), 'original picture');
  assert.equal(await (await manager.readDomain('media')).assets[0].blob.text(), 'original picture');
  await h.store.remove('test', 'gameplay');
  assert.equal(await (await manager.readBlob(sha256)).text(), 'original picture');
  await h.caches.delete('revealline-official-content-v1');
  await assert.rejects(manager.readBlob(sha256), /artwork is missing/);
});
