import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionPictureView } from '../presentation/session-picture-view.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import {
  prepareStoredStillMedia,
  hydrateStoredStillMedia,
  emptyGenericMediaLibrary,
} from '../media-storage-record.mjs';
import { createPresentationPins } from '../presentation-pins.mjs';
import { mergeStoredMediaDocuments } from '../media-bundle.mjs';
import { mediaFixture, libraryRecord, pngBytes, provenance } from './helpers/media-fixtures.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });

async function fixture(t) {
  const f = mediaFixture(),
    blob = new Blob([pngBytes()]);
  async function prepare(id) {
    const checked = await prepareStillAsset(
      blob,
      { id, provenance: provenance() },
      { decodeImage },
    );
    const library = libraryRecord(f.identity);
    library.assets = [checked.asset];
    library.presentations[0].id = `${id}-presentation`;
    library.presentations[0].poster.assetId = id;
    library.assignments[0].presentationId = `${id}-presentation`;
    const prepared = await prepareStoredStillMedia(
      library,
      [{ sha256: checked.asset.sha256, blob }],
      { executionCatalog: f.catalog, decodeImage },
    );
    const pin = createPresentationPins({
      library: prepared.library.library,
      identityCatalog: f.identityCatalog,
      ...f.request(),
      themeIds: ['fpv'],
    }).choices[0];
    return { prepared, pin };
  }
  const durable = await prepare('durable-picture'),
    transient = await prepare('session-picture');
  const memory = managedIndexedDB(),
    manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true });
  const store = createStillMediaStore({ managedStore: manager, decodeImage });
  t.after(() => {
    store.close();
    manager.close();
  });
  await store.commit(durable.prepared, { expectedGeneration: 0 });
  const media = { store, ...(await store.readPresentationMetadata()) };
  const document = structuredClone(transient.prepared.library);
  document.library.assignments = [];
  let sessionReads = 0;
  const registry = {
    metadata: () => ({ scope: 'session', revision: 1, document }),
    has: (pin) => pin.presentationId === transient.pin.presentationId,
    acquire: async (pin) => {
      sessionReads++;
      assert.deepEqual(pin, transient.pin);
      return { image: { session: true }, pin, release() {} };
    },
  };
  return {
    f,
    media,
    memory,
    registry,
    document,
    durable,
    transient,
    sessionReads: () => sessionReads,
  };
}

test('empty session history preserves the exact branded durable media object', async (t) => {
  const { media } = await fixture(t);
  const registry = {
    metadata: () => ({
      scope: 'session',
      revision: 0,
      document: hydrateStoredStillMedia(emptyGenericMediaLibrary()),
    }),
  };
  assert.equal(createSessionPictureView(media, registry), media);
});

test('Collection view separates storage generations and preserves manual assignments without writes', async (t) => {
  const f = await fixture(t),
    before = JSON.stringify(f.media.metadata),
    writes = f.memory.allPuts.length;
  const view = createSessionPictureView(f.media, f.registry);
  assert.equal(view.metadata.scope, 'durable-and-session');
  assert.equal(view.metadata.durableGeneration, f.media.metadata.generation);
  assert.equal(view.metadata.sessionRevision, 1);
  assert.equal(Object.hasOwn(view.metadata, 'generation'), false);
  assert.equal(view.metadata.document.library.assets.length, 2);
  assert.equal(view.metadata.document.library.presentations.length, 2);
  assert.deepEqual(
    view.metadata.document.library.assignments,
    f.media.metadata.document.library.assignments,
  );
  assert.equal(JSON.stringify(f.media.metadata), before);
  assert.equal(f.memory.allPuts.length, writes);
  const image = await view.acquire({
    pin: f.transient.pin,
    metadata: view.metadata,
    store: view.store,
  });
  assert.equal(image.image.session, true);
  assert.equal(f.sessionReads(), 1);
  await assert.rejects(
    view.acquire({ pin: f.transient.pin, metadata: f.media.metadata }),
    /another metadata snapshot/,
  );
});

test('durable acquisition receives its original branded snapshot, never the combined view', async (t) => {
  const f = await fixture(t),
    view = createSessionPictureView(f.media, f.registry),
    urls = [];
  const options = {
    decodeImage: async () => ({
      width: 1,
      height: 1,
      naturalWidth: 1,
      naturalHeight: 1,
      removeAttribute() {},
    }),
    URLImpl: {
      createObjectURL: () => {
        urls.push('created');
        return 'blob:test';
      },
      revokeObjectURL: () => urls.push('revoked'),
    },
  };
  const image = await view.acquire(
    { pin: f.durable.pin, metadata: view.metadata, store: view.store },
    options,
  );
  assert.deepEqual(image.pin, f.durable.pin);
  assert.equal(f.sessionReads(), 0);
  image.release();
  assert.deepEqual(urls, ['created', 'revoked']);
  await assert.rejects(f.media.store.readAsset(view.metadata, f.durable.pin.assetId), /this store/);
});

test('view merge rejects conflicting immutable history without mutating either source', async (t) => {
  const f = await fixture(t),
    bad = structuredClone(f.media.metadata.document);
  bad.library.assets[0].provenance.credit = 'Different immutable credit';
  const before = JSON.stringify(f.media.metadata.document),
    incoming = JSON.stringify(bad);
  assert.throws(
    () => mergeStoredMediaDocuments(f.media.metadata.document, bad),
    /Conflicting immutable asset/,
  );
  assert.equal(JSON.stringify(f.media.metadata.document), before);
  assert.equal(JSON.stringify(bad), incoming);
  assert.throws(
    () => mergeStoredMediaDocuments(f.media.metadata.document, { ...bad, format: 'unknown' }),
    /Unsupported/,
  );
  assert.throws(
    () =>
      mergeStoredMediaDocuments(f.media.metadata.document, f.document, {
        assignmentMode: 'overwrite-everything',
      }),
    /Unsupported/,
  );
});
