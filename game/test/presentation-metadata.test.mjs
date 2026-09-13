import assert from 'node:assert/strict';
import test from 'node:test';
import { createManagedMediaStore, MANAGED_MEDIA_DATABASE } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createStoryMediaStore } from '../story-media-store.mjs';
import { createFlightPresentationPins, storyPinForTheme } from '../flight-media-pins.mjs';
import { validateStoredStories } from '../story-storage-record.mjs';
import { createStoryFixture, inspectionEnvironment } from './helpers/victory-story-fixture.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { pngBytes, presentationRecord } from './helpers/media-fixtures.mjs';

const f = createStoryFixture(),
  decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
function observe(memory) {
  const transactions = [];
  let onGet = null;
  return {
    transactions,
    set onGet(value) {
      onGet = value;
    },
    indexedDB: {
      open(...args) {
        const request = memory.indexedDB.open(...args);
        Object.defineProperty(request, 'onsuccess', {
          set(callback) {
            Object.defineProperty(request, 'onsuccess', {
              configurable: true,
              value: () => {
                const db = request.result,
                  original = db.transaction.bind(db);
                db.transaction = (names, mode) => {
                  const tx = original(names, mode),
                    objectStore = tx.objectStore.bind(tx),
                    record = { names, mode, reads: [] };
                  transactions.push(record);
                  tx.objectStore = (name) => {
                    const store = objectStore(name),
                      get = store.get;
                    store.get = (key) => {
                      record.reads.push([name, key]);
                      const r = get(key);
                      onGet?.({ db, name, key });
                      return r;
                    };
                    store.getAll = store.getAllKeys = () =>
                      assert.fail('Ordinary presentation reads must use exact keyed requests.');
                    return store;
                  };
                  return tx;
                };
                callback();
              },
            });
          },
          configurable: true,
        });
        return request;
      },
    },
  };
}
async function setup(t) {
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true }),
    still = createStillMediaStore({ managedStore: manager, decodeImage }),
    stories = createStoryMediaStore({ managedStore: manager, decodeImage });
  await still.commit(
    await still.prepare(f.library, [{ sha256: f.pin.sha256, blob: new Blob([pngBytes()]) }], {
      executionCatalog: f.catalog,
    }),
    { expectedGeneration: 0 },
  );
  await stories.commit(await stories.stage(f, inspectionEnvironment().options));
  await stories.commit(
    await stories.stageBinding(
      { picturePin: f.pin, story: { id: f.descriptor.id, revision: 1 } },
      { expectedGeneration: 1, ...inspectionEnvironment().options },
    ),
  );
  await stories.close();
  manager.close();
  const observer = observe(memory),
    reader = createManagedMediaStore({ indexedDB: observer.indexedDB, storyMedia: true }),
    store = createStillMediaStore({ managedStore: reader, decodeImage });
  t.after(() => {
    store.close();
    reader.close();
  });
  return { memory, observer, reader, store };
}
async function pins(saved) {
  return createFlightPresentationPins({
    library: saved.metadata.document.library,
    stillDocument: saved.metadata.document,
    storyDocument: saved.story.document,
    identityCatalog: f.identityCatalog,
    ...f.request(),
    themeIds: ['fpv'],
  });
}
function transaction(db, names, write) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite');
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
    write(tx);
  });
}
async function open(memory) {
  return new Promise((resolve) => {
    const request = memory.indexedDB.open(MANAGED_MEDIA_DATABASE, 4);
    request.onsuccess = () => resolve(request.result);
  });
}

test('one keyed readonly transaction selects both domains without inventory reads or writes; its poster snapshot is branded', async (t) => {
  const { memory, observer, store } = await setup(t),
    before = memory.allPuts.length;
  const saved = await store.readPresentationMetadata();
  assert.deepEqual(observer.transactions, [
    {
      names: ['mediaRecords', 'storyRecords'],
      mode: 'readonly',
      reads: [
        ['mediaRecords', 'library'],
        ['storyRecords', 'library'],
      ],
    },
  ]);
  assert.equal(saved.metadata.generation, 1);
  assert.equal(saved.story.generation, 2);
  assert.ok(Object.isFrozen(saved));
  assert.ok(Object.isFrozen(saved.story.document));
  assert.equal(storyPinForTheme(await pins(saved), 'fpv').id, f.descriptor.id);
  const original = await store.readAsset(saved.metadata, f.pin.assetId);
  assert.deepEqual(Buffer.from(await original.blob.arrayBuffer()), pngBytes());
  await assert.rejects(store.readAsset(structuredClone(saved.metadata), f.pin.assetId), /snapshot/);
  assert.equal(memory.allPuts.length, before);
});

test('a queued assignment/binding edit cannot split the metadata instant and previously selected story stays exact', async (t) => {
  const { memory, observer, store } = await setup(t),
    media = structuredClone(memory.contents().get('mediaRecords').get('library')),
    story = structuredClone(memory.contents().get('storyRecords').get('library'));
  media.generation++;
  media.library.library.assignments = [];
  story.generation++;
  story.library.bindings[0].story = null;
  let edited;
  observer.onGet = ({ db, name }) => {
    if (name !== 'mediaRecords') return;
    observer.onGet = null;
    edited = transaction(db, ['mediaRecords', 'storyRecords'], (tx) => {
      tx.objectStore('mediaRecords').put(media, 'library');
      tx.objectStore('storyRecords').put(story, 'library');
    });
  };
  const old = await store.readPresentationMetadata(),
    selected = await pins(old);
  await edited;
  const next = await store.readPresentationMetadata();
  assert.deepEqual([old.metadata.generation, old.story.generation], [1, 2]);
  assert.deepEqual([next.metadata.generation, next.story.generation], [2, 3]);
  assert.equal(storyPinForTheme(selected, 'fpv').id, f.descriptor.id);
  assert.equal(storyPinForTheme(await pins(next), 'fpv'), null);
  assert.equal((await pins(next)).choices[0].picture.kind, 'legacy');
});

test('abort at a queued keyed read and closed adapters cannot publish selection or mutate rows', async (t) => {
  const { memory, observer, store } = await setup(t),
    before = memory.contents(),
    controller = new AbortController();
  observer.onGet = () => controller.abort();
  await assert.rejects(store.readPresentationMetadata({ signal: controller.signal }), {
    name: 'AbortError',
  });
  assert.deepEqual(memory.contents(), before);
  store.close();
  await assert.rejects(store.readPresentationMetadata(), /closed/);
});

test('a v3 adapter explicitly refuses the combined contract without upgrading its database', async () => {
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({ indexedDB: memory.indexedDB, richStillMedia: true }),
    store = createStillMediaStore({ managedStore: manager });
  await assert.rejects(store.readPresentationMetadata(), /shared v4/);
  assert.equal(memory.openCount, 0);
  manager.close();
});

test('individually valid retained documents exceeding their shared 2 MiB refuse the combined read', async (t) => {
  const { memory, store } = await setup(t),
    raw = memory.contents().get('mediaRecords').get('library');
  for (let revision = 2; revision <= 256; revision++)
    raw.library.library.presentations.push({
      ...presentationRecord(f.identity, revision),
      description: '雪'.repeat(2048),
    });
  const document = {
    format: 'revealline-story-storage.v1',
    stories: Array.from({ length: 512 }, (_, i) => ({
      ...f.descriptor,
      id: `story-${i}`,
      description: 'S'.repeat(2048),
    })),
    originals: [f.descriptor.source.sha256],
  };
  validateStoredStories(document, raw.library);
  const db = await open(memory);
  await transaction(db, ['mediaRecords', 'storyRecords'], (tx) => {
    tx.objectStore('mediaRecords').put(raw, 'library');
    tx.objectStore('storyRecords').put({ generation: 3, library: document }, 'library');
  });
  db.close();
  const before = memory.contents();
  await assert.rejects(store.readPresentationMetadata(), /shared 2 MiB/);
  assert.deepEqual(memory.contents(), before);
});
