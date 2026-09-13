import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  createManagedMediaStore,
  prepareManagedMediaBytes,
  MANAGED_MEDIA_DATABASE,
} from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { hydrateStoredStillMedia, prepareStoredStillMedia } from '../media-storage-record.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { emptySoundtrackLibrary } from '../soundtrack.mjs';
import { prepareSoundtrackLibrary, exportSoundtrackBundle } from '../soundtrack-bundle.mjs';
import {
  exportMediaBundle,
  importMediaBundle,
  prepareMediaBundleRestore,
  commitMediaBundleRestore,
} from '../media-bundle.mjs';
import { memoryIndexedDB, fixture, structuralProbe } from './helpers/soundtrack-fixtures.mjs';

// Generic data is never passed off as an image. IndexedDB remains a finite model.
const noImages = async () => {
  throw new Error('Generic originals must not use an image decoder');
};
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bytes = async (blob) => Buffer.from(await blob.arrayBuffer());
function original(id, text = id) {
  const data = Buffer.from(text);
  return { item: { id, sha256: sha(data) }, asset: { sha256: sha(data), blob: new Blob([data]) } };
}
const a = original('source-a'),
  b = original('source-b');
const documentFor = (rows) =>
  hydrateStoredStillMedia({
    format: 'revealline-managed-bytes.v1',
    items: rows.map((row) => row.item),
  });
const assetTable = (rows) => [
  ...new Map(rows.map((row) => [row.asset.sha256, row.asset])).values(),
];
async function importedFor(rows) {
  return importMediaBundle(
    await exportMediaBundle(documentFor(rows), assetTable(rows), { decodeImage: noImages }),
    { decodeImage: noImages },
  );
}
async function preparedFor(rows) {
  const document = documentFor(rows);
  return prepareStoredStillMedia(document.library, assetTable(rows), {
    previous: document,
    executionCatalog: createExecutionCatalog([]),
    decodeImage: noImages,
  });
}
function setup(options = {}) {
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({
      indexedDB: memory.indexedDB,
      richStillMedia: true,
      ...options,
    });
  const store = createStillMediaStore({ managedStore: manager, decodeImage: noImages });
  return { memory, manager, store };
}
async function state(memory) {
  const out = {};
  for (const [name, records] of memory.contents()) {
    if (['managedState', 'reservations'].includes(name)) continue;
    out[name] = [];
    for (const [key, value] of records)
      out[name].push([
        key,
        value instanceof Blob ? { sha256: sha(await bytes(value)), bytes: value.size } : value,
      ]);
  }
  return out;
}

test('fresh generic-only restore retains exact IDs/originals across reopen with no image claim', async () => {
  const { store, manager, memory } = setup();
  const imported = await importedFor([a, b]);
  const review = await prepareMediaBundleRestore(imported, { store, decodeImage: noImages });
  assert.equal(review.originals, 2);
  await commitMediaBundleRestore(review);
  store.close();
  manager.close();
  const fresh = createStillMediaStore({ indexedDB: memory.indexedDB, decodeImage: noImages });
  const saved = await fresh.read();
  assert.deepEqual(saved.document, documentFor([a, b]));
  assert.deepEqual(await bytes(await fresh.readBlob(a.item.sha256)), await bytes(a.asset.blob));
  assert.deepEqual(
    await bytes(await exportMediaBundle(saved.document, saved.assets, { decodeImage: noImages })),
    await bytes(
      await exportMediaBundle(imported.document, imported.assets, { decodeImage: noImages }),
    ),
  );
  fresh.close();
});

test('shared audio hashes reuse physical bytes and stay retained after audio relinquishes them', async () => {
  const { manager, store, memory } = setup(),
    audio = await fixture();
  await manager.commitDomain('audio', audio.prepared, { expectedGeneration: 0 });
  const soundtrack = createSoundtrackStore({ managedStore: manager }),
    before = await soundtrack.read();
  const oldExport = await exportSoundtrackBundle(before.library, before.assets);
  const row = {
    item: { id: 'retained-mp3-original', sha256: audio.track.asset.sha256 },
    asset: audio.assets[0],
  };
  const review = await prepareMediaBundleRestore(await importedFor([row]), {
    store,
    decodeImage: noImages,
  });
  memory.allPuts.length = 0;
  await commitMediaBundleRestore(review);
  assert.equal(
    memory.allPuts.filter((put) => ['audio', 'mediaBlobs'].includes(put.name)).length,
    0,
  );
  const after = await soundtrack.read();
  assert.deepEqual(
    await bytes(await exportSoundtrackBundle(after.library, after.assets)),
    await bytes(oldExport),
  );
  const empty = await prepareSoundtrackLibrary(emptySoundtrackLibrary(), [], {
    probeMedia: structuralProbe,
  });
  await soundtrack.commit(empty, { expectedGeneration: after.generation });
  assert.deepEqual(await bytes(await store.readBlob(row.item.sha256)), await bytes(audio.blob));
  assert.equal((await store.read()).document.legacy.items[0].sha256, row.item.sha256);
});

test('imports union IDs and explicit assignment Undo cannot delete retained generic originals', async () => {
  const { store } = setup();
  await store.commit(await preparedFor([a]), { expectedGeneration: 0 });
  const review = await prepareMediaBundleRestore(await importedFor([b]), {
    store,
    assignmentMode: 'restore',
    decodeImage: noImages,
  });
  await commitMediaBundleRestore(review);
  const undo = await prepareMediaBundleRestore(await importedFor([a]), {
    store,
    assignmentMode: 'restore',
    decodeImage: noImages,
  });
  await commitMediaBundleRestore(undo);
  assert.deepEqual((await store.read()).document.legacy.items, [a.item, b.item]);
  assert.deepEqual(await bytes(await store.readBlob(b.item.sha256)), await bytes(b.asset.blob));
});

test('generic ID collision refuses before any target-domain writes', async () => {
  const { store, memory } = setup();
  await store.commit(await preparedFor([a]), { expectedGeneration: 0 });
  const before = await state(memory),
    conflict = original(a.item.id, 'different original');
  await assert.rejects(
    prepareMediaBundleRestore(await importedFor([conflict]), { store, decodeImage: noImages }),
    /Conflicting immutable retained generic/,
  );
  assert.deepEqual(await state(memory), before);
});

test('foreign preparations cannot remove/change current generic refs even with the correct generation', async () => {
  const { store, memory, manager } = setup();
  await store.commit(await preparedFor([a]), { expectedGeneration: 0 });
  const before = await state(memory);
  for (const foreign of [[], [b], [original(a.item.id, 'altered hash')]]) {
    const prepared = await preparedFor(foreign);
    await assert.rejects(
      store.commit(prepared, { expectedGeneration: 1 }),
      /cannot change or be removed/,
    );
    assert.deepEqual(await state(memory), before);
  }
  assert.equal((await manager.usage()).reservations, 0);
});

test('a rich generic-only record still refuses a low-level generic downgrade', async () => {
  const { store, manager, memory } = setup();
  await store.commit(await preparedFor([a]), { expectedGeneration: 0 });
  const before = await state(memory);
  const raw = await prepareManagedMediaBytes(documentFor([a]).legacy, assetTable([a]));
  await assert.rejects(
    manager.commitDomain('media', raw, { expectedGeneration: 1 }),
    /cannot be downgraded/,
  );
  assert.deepEqual(await state(memory), before);
});

test('stale generic review cannot replace a concurrent addition; fresh review retains both', async () => {
  const { memory, store } = setup();
  const first = await prepareMediaBundleRestore(await importedFor([a]), {
    store,
    decodeImage: noImages,
  });
  const second = await prepareMediaBundleRestore(await importedFor([b]), {
    store,
    decodeImage: noImages,
  });
  await commitMediaBundleRestore(first);
  const before = await state(memory);
  await assert.rejects(commitMediaBundleRestore(second), /changed/);
  assert.deepEqual(await state(memory), before);
  await commitMediaBundleRestore(
    await prepareMediaBundleRestore(await importedFor([b]), { store, decodeImage: noImages }),
  );
  assert.deepEqual((await store.read()).document.legacy.items, [a.item, b.item]);
});

test('generic union exceeding the existing 512-reference cap refuses before mutation', async () => {
  const { store, memory } = setup();
  const existing = Array.from({ length: 256 }, (_, i) => original(`old-${i}`));
  const incoming = Array.from({ length: 257 }, (_, i) => original(`new-${i}`));
  await store.commit(await preparedFor(existing), { expectedGeneration: 0 });
  const before = await state(memory);
  await assert.rejects(
    prepareMediaBundleRestore(await importedFor(incoming), { store, decodeImage: noImages }),
    /array exceeds its item budget/i,
  );
  assert.deepEqual(await state(memory), before);
});

test('generic corrupt/missing originals never produce a verified portable import', async () => {
  const doc = documentFor([a]);
  await assert.rejects(exportMediaBundle(doc, [], { decodeImage: noImages }), /every referenced/);
  const encoded = await bytes(
    await exportMediaBundle(doc, assetTable([a]), { decodeImage: noImages }),
  );
  encoded[encoded.length - 1] ^= 1;
  await assert.rejects(
    importMediaBundle(new Blob([encoded]), { decodeImage: noImages }),
    /legacy media hash differs/,
  );
  await assert.rejects(
    exportMediaBundle(doc, [{ sha256: a.item.sha256, blob: b.asset.blob }], {
      decodeImage: noImages,
    }),
    /legacy media hash differs/,
  );
});

test('generic quota refusal and in-transaction cancellation preserve originals and release staging', async () => {
  let full = false;
  const { store, manager, memory } = setup({
    estimate: async () => (full ? { quota: 0, usage: 0 } : null),
  });
  await store.commit(await preparedFor([a]), { expectedGeneration: 0 });
  const review = await prepareMediaBundleRestore(await importedFor([b]), {
    store,
    decodeImage: noImages,
  });
  const before = await state(memory);
  full = true;
  await assert.rejects(commitMediaBundleRestore(review), /not enough reported/);
  assert.deepEqual(await state(memory), before);
  full = false;
  const controller = new AbortController();
  memory.onAnyPut = ({ name }) => {
    if (name === 'mediaRecords') controller.abort();
  };
  await assert.rejects(commitMediaBundleRestore(review, { signal: controller.signal }), {
    name: 'AbortError',
  });
  memory.onAnyPut = null;
  assert.deepEqual(await state(memory), before);
  assert.equal((await manager.usage()).reservations, 0);
  await commitMediaBundleRestore(review);
  assert.deepEqual((await store.read()).document.legacy.items, [a.item, b.item]);
});

test('retained unexplained originals count against the existing physical inventory cap', async () => {
  const { store, manager, memory } = setup();
  await store.read();
  const orphan = original('unclassified-original');
  // Controlled preexisting storage fixture, deliberately in mediaBlobs. The
  // older audio helper's seedOrphan writes to audio, which has its own cap.
  await new Promise((resolve, reject) => {
    const request = memory.indexedDB.open(MANAGED_MEDIA_DATABASE, 3);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction(['mediaBlobs'], 'readwrite');
      tx.objectStore('mediaBlobs').put(orphan.asset.blob, orphan.item.sha256);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
  const incoming = Array.from({ length: 512 }, (_, i) => original(`new-original-${i}`));
  const review = await prepareMediaBundleRestore(await importedFor(incoming), {
    store,
    decodeImage: noImages,
  });
  const before = await state(memory);
  await assert.rejects(commitMediaBundleRestore(review), /inventory.*budget/i);
  assert.deepEqual(await state(memory), before);
  assert.equal((await manager.usage()).reservations, 0);
  assert.deepEqual(
    await bytes(await store.readBlob(orphan.item.sha256)),
    await bytes(orphan.asset.blob),
  );
  const atLimit = await prepareMediaBundleRestore(await importedFor(incoming.slice(0, 511)), {
    store,
    decodeImage: noImages,
  });
  await commitMediaBundleRestore(atLimit);
  assert.equal(memory.contents().get('mediaBlobs').size, 512);
  assert.equal((await store.read()).assets.length, 511);
  assert.deepEqual(
    await bytes(await store.readBlob(orphan.item.sha256)),
    await bytes(orphan.asset.blob),
  );
});
