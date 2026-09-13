import test from 'node:test';
import assert from 'node:assert/strict';
import { createManagedMediaStore, MANAGED_MEDIA_DATABASE } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import {
  mediaFixture,
  libraryRecord,
  pngBytes,
  provenance,
  deferred,
} from './helpers/media-fixtures.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';

const decode = async () => ({ naturalWidth: 1, naturalHeight: 1 });
function instrument(memory) {
  const calls = [];
  const seen = new WeakSet();
  const indexedDB = {
    open(...args) {
      const request = memory.indexedDB.open(...args);
      return new Proxy(request, {
        set(target, key, value) {
          if (key !== 'onsuccess') {
            target[key] = value;
            return true;
          }
          target.onsuccess = (...args) => {
            const db = target.result;
            if (!seen.has(db)) {
              seen.add(db);
              const original = db.transaction.bind(db);
              db.transaction = (names, mode) => {
                const tx = original(names, mode),
                  get = tx.objectStore;
                tx.objectStore = (name) => {
                  const store = get(name);
                  for (const method of ['get', 'getAll', 'getAllKeys', 'put', 'delete']) {
                    const old = store[method];
                    store[method] = (...args) => {
                      calls.push([name, method, ...args]);
                      return old(...args);
                    };
                  }
                  return store;
                };
                return tx;
              };
            }
            value(...args);
          };
          return true;
        },
      });
    },
  };
  return { indexedDB, calls };
}
async function setup() {
  const memory = memoryIndexedDB(),
    spy = instrument(memory),
    f = mediaFixture(true);
  const prepared = await prepareStillAsset(
    new Blob([pngBytes()]),
    { id: 'picture-a', provenance: provenance() },
    { decodeImage: decode },
  );
  const library = libraryRecord(f.identity);
  library.assets = [prepared.asset];
  const manager = createManagedMediaStore({ indexedDB: spy.indexedDB, richStillMedia: true });
  const decodes = [];
  const store = createStillMediaStore({
    managedStore: manager,
    decodeImage: async (blob) => {
      decodes.push(blob);
      return decode();
    },
  });
  await store.commit(
    await store.prepare(library, [{ sha256: prepared.asset.sha256, blob: prepared.blob }], {
      executionCatalog: f.catalog,
    }),
    { expectedGeneration: 0 },
  );
  decodes.length = 0;
  spy.calls.length = 0;
  memory.allPuts.length = 0;
  return { memory, manager, store, decodes, ...spy, f, prepared, library };
}
async function mutate(memory, fn) {
  const db = await new Promise((resolve, reject) => {
    const request = memory.indexedDB.open(MANAGED_MEDIA_DATABASE, 3);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const tx = db.transaction(['audio', 'mediaBlobs', 'mediaRecords'], 'readwrite');
  fn(tx);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}

test('runtime metadata and selected image use one row plus two keyed gets, no inventory/decodes/writes', async () => {
  const f = await setup();
  const snapshot = await f.store.readMetadata();
  assert.equal(snapshot.generation, 1);
  assert.equal(snapshot.document.owners.length, 1);
  assert.equal(f.decodes.length, 0);
  assert.deepEqual(f.calls, [['mediaRecords', 'get', 'library']]);
  f.calls.length = 0;
  const original = await f.store.readAsset(snapshot, 'picture-a');
  assert.deepEqual(f.calls, [
    ['audio', 'get', f.prepared.asset.sha256],
    ['mediaBlobs', 'get', f.prepared.asset.sha256],
  ]);
  assert.equal(f.decodes.length, 1);
  assert.deepEqual(Buffer.from(await original.blob.arrayBuffer()), pngBytes());
  assert.deepEqual(original.asset, f.prepared.asset);
  assert.deepEqual(f.memory.allPuts, []);
  assert.ok(Object.isFrozen(snapshot.document.library.assets));
  f.manager.close();
});

test('metadata snapshot is bound to its store, immutable asset history remains readable after assignment edit', async () => {
  const f = await setup(),
    snapshot = await f.store.readMetadata();
  await assert.rejects(
    f.store.readAsset(structuredClone(snapshot), 'picture-a'),
    /metadata snapshot/,
  );
  const other = createStillMediaStore({ managedStore: f.manager, decodeImage: decode });
  await assert.rejects(other.readAsset(snapshot, 'picture-a'), /metadata snapshot/);
  await assert.rejects(f.store.readAsset(snapshot, 'absent'), /absent/);
  const next = structuredClone(f.library);
  next.assignments = [];
  await f.store.commit(
    await f.store.prepare(next, [{ sha256: f.prepared.asset.sha256, blob: f.prepared.blob }], {
      executionCatalog: f.f.catalog,
      previous: snapshot.document,
    }),
    { expectedGeneration: 1 },
  );
  assert.equal((await f.store.readMetadata()).generation, 2);
  assert.deepEqual((await f.store.readAsset(snapshot, 'picture-a')).asset, f.prepared.asset);
  f.manager.close();
});

test('selected path accepts one physical shared original and rejects duplicate placement like full read', async () => {
  const f = await setup(),
    snapshot = await f.store.readMetadata(),
    hash = f.prepared.asset.sha256;
  await mutate(f.memory, (tx) => {
    tx.objectStore('mediaBlobs').delete(hash);
    tx.objectStore('audio').put(f.prepared.blob, hash);
  });
  assert.deepEqual((await f.store.readAsset(snapshot, 'picture-a')).asset, f.prepared.asset);
  await mutate(f.memory, (tx) => tx.objectStore('mediaBlobs').put(f.prepared.blob, hash));
  await assert.rejects(f.store.readAsset(snapshot, 'picture-a'), /Duplicate physical/);
  await assert.rejects(f.store.read(), /Duplicate physical/);
  f.manager.close();
});

test('unrelated missing originals do not block metadata/selected read, admin full read still refuses', async () => {
  const f = await setup(),
    current = await f.store.readMetadata(),
    next = structuredClone(f.library);
  next.assets.push({ ...f.prepared.asset, id: 'missing-picture', sha256: 'a'.repeat(64) });
  const row = structuredClone(current.document);
  row.library = next;
  await mutate(f.memory, (tx) =>
    tx.objectStore('mediaRecords').put({ generation: 1, library: row }, 'library'),
  );
  const metadata = await f.store.readMetadata();
  assert.equal(metadata.document.library.assets.length, 2);
  assert.deepEqual((await f.store.readAsset(metadata, 'picture-a')).asset, f.prepared.asset);
  await assert.rejects(f.store.readAsset(metadata, 'missing-picture'), /missing.*\.rlmedia/);
  await assert.rejects(f.store.read(), /every referenced original/);
  f.manager.close();
});

test('corrupt bytes/size/native type fail before decoder; decoded dimension mismatch also refuses', async () => {
  const f = await setup(),
    snapshot = await f.store.readMetadata(),
    hash = f.prepared.asset.sha256;
  const damaged = pngBytes();
  damaged[damaged.length - 1] ^= 1;
  for (const [blob, pattern] of [
    [new Blob([damaged]), /SHA-256/],
    [new Blob([pngBytes(), 'x']), /byte budget/],
    [null, /Blob/],
  ]) {
    await mutate(f.memory, (tx) => tx.objectStore('mediaBlobs').put(blob, hash));
    await assert.rejects(f.store.readAsset(snapshot, 'picture-a'), pattern);
    assert.equal(f.decodes.length, 0);
  }
  await mutate(f.memory, (tx) => tx.objectStore('mediaBlobs').put(f.prepared.blob, hash));
  await assert.rejects(
    f.store.readAsset(snapshot, 'picture-a', {
      decodeImage: async () => ({ naturalWidth: 2, naturalHeight: 1 }),
    }),
    /dimensions/,
  );
  f.manager.close();
});

test('metadata-only read validates retained owner recipes and generation before any Blob access', async () => {
  const f = await setup(),
    snapshot = await f.store.readMetadata();
  const broken = structuredClone(snapshot.document);
  delete broken.owners[0].campaign.classRecipes;
  await mutate(f.memory, (tx) =>
    tx.objectStore('mediaRecords').put({ generation: 1, library: broken }, 'library'),
  );
  f.calls.length = 0;
  await assert.rejects(f.store.readMetadata(), /roster/);
  assert.deepEqual(f.calls, [['mediaRecords', 'get', 'library']]);
  await mutate(f.memory, (tx) =>
    tx.objectStore('mediaRecords').put({ generation: -1, library: snapshot.document }, 'library'),
  );
  await assert.rejects(f.store.readMetadata(), /generation/);
  f.manager.close();
});

test('valid-looking stored dimensions inconsistent with original header refuse before decoder allocation', async () => {
  const f = await setup(),
    prior = await f.store.readMetadata();
  const next = structuredClone(prior.document);
  next.library.assets[0].width = 2;
  await mutate(f.memory, (tx) =>
    tx.objectStore('mediaRecords').put({ generation: 1, library: next }, 'library'),
  );
  const metadata = await f.store.readMetadata();
  await assert.rejects(f.store.readAsset(metadata, 'picture-a'), /header/);
  assert.equal(f.decodes.length, 0);
  f.manager.close();
});

test('runtime read abort and borrowed adapter close cannot publish a late selected asset', async () => {
  const f = await setup(),
    snapshot = await f.store.readMetadata(),
    wait = deferred(),
    started = deferred();
  const controller = new AbortController();
  controller.abort();
  f.calls.length = 0;
  await assert.rejects(f.store.readMetadata({ signal: controller.signal }), { name: 'AbortError' });
  assert.deepEqual(f.calls, []);
  const cancel = new AbortController();
  const pending = f.store.readAsset(snapshot, 'picture-a', {
    signal: cancel.signal,
    decodeImage: async () => {
      started.resolve();
      return wait.promise;
    },
  });
  await started.promise;
  cancel.abort();
  wait.resolve(await decode());
  await assert.rejects(pending, { name: 'AbortError' });
  const later = deferred(),
    began = deferred();
  const closing = f.store.readAsset(snapshot, 'picture-a', {
    decodeImage: async () => {
      began.resolve();
      return later.promise;
    },
  });
  await began.promise;
  f.store.close();
  later.resolve(await decode());
  await assert.rejects(closing, /closed/);
  assert.equal((await f.manager.readDomainMetadata('media')).generation, 1);
  f.manager.close();
});
