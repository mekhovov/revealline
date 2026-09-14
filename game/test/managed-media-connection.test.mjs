import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createManagedMediaStore, MANAGED_MEDIA_DATABASE } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createStoryMediaStore } from '../story-media-store.mjs';
import { createFlightPictures } from '../ui/flight-pictures.mjs';
import { createStoryFixture, inspectionEnvironment } from './helpers/victory-story-fixture.mjs';
import { fixture, memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';

const f = createStoryFixture(),
  audio = await fixture(),
  decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });

// Keep the existing serialized IDB model. Only its connection boundary gains
// explicit browser-close/error events; this does not model browser disk eviction.
function boundary() {
  const memory = memoryIndexedDB(),
    connections = [],
    attempts = [];
  const state = { beforeTransaction: null, beforeSuccess: null };
  const indexedDB = {
    open(...args) {
      const request = memory.indexedDB.open(...args);
      let success;
      Object.defineProperty(request, 'onsuccess', {
        get: () => success,
        set(callback) {
          success = (...events) => {
            const db = request.result,
              transaction = db.transaction.bind(db);
            connections.push(db);
            db.transaction = (names, mode) => {
              const attempt = { db, names, mode };
              attempts.push(attempt);
              state.beforeTransaction?.(attempt);
              return transaction(names, mode);
            };
            state.beforeSuccess?.(db);
            callback?.(...events);
          };
        },
      });
      return request;
    },
  };
  return { memory, indexedDB, connections, attempts, state };
}

async function snapshot(memory) {
  const result = [];
  for (const [name, rows] of memory.contents()) {
    const values = [];
    for (const [key, value] of rows)
      values.push([
        key,
        value instanceof Blob
          ? {
              bytes: value.size,
              sha256: createHash('sha256')
                .update(Buffer.from(await value.arrayBuffer()))
                .digest('hex'),
            }
          : structuredClone(value),
      ]);
    result.push([name, values]);
  }
  return result;
}

async function seeded(t) {
  const h = boundary(),
    manager = createManagedMediaStore({ indexedDB: h.indexedDB, storyMedia: true }),
    still = createStillMediaStore({ managedStore: manager, decodeImage }),
    story = createStoryMediaStore({ managedStore: manager, decodeImage });
  t.after(() => manager.close());
  await manager.commitDomain('audio', audio.prepared, { expectedGeneration: 0 });
  await still.commit(
    await still.prepare(f.library, [{ sha256: f.pin.sha256, blob: new Blob([pngBytes()]) }], {
      executionCatalog: f.catalog,
    }),
    { expectedGeneration: 0 },
  );
  await story.commit(
    await story.stage({ descriptor: f.descriptor, blob: f.blob }, inspectionEnvironment().options),
  );
  return { ...h, manager, still, story };
}

test('spontaneous close reopens one shared v4 connection and preserves exact audio/still/story rows and originals', async (t) => {
  const h = await seeded(t),
    before = await snapshot(h.memory),
    old = h.connections.at(-1),
    opens = h.memory.openCount;
  old.close();
  old.onclose?.();
  const [presentation, soundtrack, story] = await Promise.all([
    h.still.readPresentationMetadata(),
    h.manager.readDomain('audio'),
    h.story.readMetadata(),
  ]);
  assert.equal(h.memory.openCount, opens + 1);
  assert.equal(presentation.metadata.generation, 1);
  assert.equal(presentation.story.generation, 1);
  assert.equal(soundtrack.generation, 1);
  assert.equal(story.generation, 1);
  const original = await h.still.readAsset(presentation.metadata, f.pin.assetId);
  assert.deepEqual(Buffer.from(await original.blob.arrayBuffer()), pngBytes());
  assert.deepEqual(await snapshot(h.memory), before);
});

for (const [label, read] of [
  ['full inventory', (h) => h.manager.readDomain('media')],
  ['selected presentation', (h) => h.still.readPresentationMetadata()],
])
  test(`${label}: a closing-handle constructor failure is preserved; only the next deliberate read reopens`, async (t) => {
    const h = await seeded(t),
      before = await snapshot(h.memory),
      old = h.connections.at(-1),
      failure = new DOMException('The database connection is closing.', 'InvalidStateError'),
      opens = h.memory.openCount,
      calls = h.attempts.length;
    h.state.beforeTransaction = ({ db }) => {
      if (db !== old) return;
      db.close();
      throw failure;
    };
    await assert.rejects(read(h), (error) => error === failure);
    assert.equal(h.attempts.length, calls + 1, 'No automatic transaction retry');
    assert.equal(h.memory.openCount, opens);
    assert.deepEqual(await snapshot(h.memory), before);
    await read(h);
    assert.equal(h.memory.openCount, opens + 1);
    assert.deepEqual(await snapshot(h.memory), before);
  });

test('late close and versionchange events from an obsolete handle cannot discard a newer opening', async (t) => {
  const h = await seeded(t),
    old = h.connections.at(-1),
    lateClose = old.onclose,
    lateVersion = old.onversionchange;
  old.close();
  await assert.rejects(h.manager.readPresentationMetadata(), { name: 'InvalidStateError' });
  const opens = h.memory.openCount;
  const pending = h.manager.readDomain('audio');
  lateClose?.();
  lateVersion?.();
  await pending;
  const current = h.connections.at(-1);
  assert.notEqual(current, old);
  lateClose?.();
  await h.manager.readPresentationMetadata();
  assert.equal(h.memory.openCount, opens + 1);
  assert.equal(h.connections.at(-1), current);
});

test('explicit manager close remains terminal after a close event or a rejected transaction', async (t) => {
  const h = await seeded(t),
    old = h.connections.at(-1),
    opens = h.memory.openCount;
  old.close();
  await assert.rejects(h.manager.readDomain('media'), { name: 'InvalidStateError' });
  h.manager.close();
  old.onclose?.();
  await assert.rejects(h.manager.readDomain('media'), /store is closed/);
  await assert.rejects(h.manager.readPresentationMetadata(), /store is closed/);
  assert.equal(h.memory.openCount, opens);
});

test('pre-aborted reads do not reopen an invalidated connection', async (t) => {
  const h = await seeded(t),
    old = h.connections.at(-1),
    opens = h.memory.openCount,
    controller = new AbortController();
  old.close();
  old.onclose?.();
  controller.abort();
  await assert.rejects(h.manager.readPresentationMetadata({ signal: controller.signal }), {
    name: 'AbortError',
  });
  await assert.rejects(h.manager.readDomain('media', { signal: controller.signal }), {
    name: 'AbortError',
  });
  assert.equal(h.memory.openCount, opens);
});

for (const action of ['abort', 'close'])
  test(`${action} during reopen rejects the pending operation and closes its late connection`, async (t) => {
    const h = await seeded(t),
      before = await snapshot(h.memory),
      old = h.connections.at(-1),
      controller = new AbortController();
    old.close();
    old.onclose?.();
    h.state.beforeSuccess = () => {
      if (action === 'abort') controller.abort();
      else h.manager.close();
    };
    await assert.rejects(
      h.manager.readPresentationMetadata({ signal: controller.signal }),
      action === 'abort' ? { name: 'AbortError' } : /store is closed/,
    );
    const late = h.connections.at(-1),
      opens = h.memory.openCount;
    assert.notEqual(late, old);
    assert.throws(() => late.transaction(['mediaRecords'], 'readonly'), {
      name: 'InvalidStateError',
    });
    h.state.beforeSuccess = null;
    if (action === 'abort') {
      await h.manager.readPresentationMetadata();
      assert.equal(h.memory.openCount, opens + 1);
    } else {
      await assert.rejects(h.manager.readPresentationMetadata(), /store is closed/);
      assert.equal(h.memory.openCount, opens);
    }
    assert.deepEqual(await snapshot(h.memory), before);
  });

test('versionchange invalidates the handle but never downgrades a newer database on retry', async (t) => {
  const h = await seeded(t),
    before = await snapshot(h.memory);
  const newer = await new Promise((resolve, reject) => {
    const request = h.indexedDB.open(MANAGED_MEDIA_DATABASE, 5);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  t.after(() => newer.close());
  await assert.rejects(h.manager.readPresentationMetadata(), {
    name: 'VersionError',
    message:
      'This media library uses a newer storage version. Open the newer game and export it for recovery; do not delete or downgrade the database.',
  });
  assert.equal(newer.version, 5);
  assert.deepEqual(await snapshot(h.memory), before);
});

test('other transaction-construction errors propagate unchanged and retain the usable cached handle', async (t) => {
  const h = await seeded(t),
    old = h.connections.at(-1),
    opens = h.memory.openCount,
    failure = new DOMException('Unrelated missing store', 'NotFoundError');
  h.state.beforeTransaction = () => {
    throw failure;
  };
  await assert.rejects(h.manager.readPresentationMetadata(), (error) => error === failure);
  await assert.rejects(h.manager.readDomain('media'), (error) => error === failure);
  h.state.beforeTransaction = null;
  await h.manager.readDomain('media');
  assert.equal(h.memory.openCount, opens);
  assert.equal(h.connections.at(-1), old);
});

test('a rejected write constructor never runs its mutation or retries it automatically', async (t) => {
  const h = await seeded(t),
    before = await snapshot(h.memory),
    old = h.connections.at(-1),
    calls = h.attempts.length,
    puts = h.memory.allPuts.length,
    failure = new DOMException('Closing before write', 'InvalidStateError');
  h.state.beforeTransaction = ({ db, mode }) => {
    assert.equal(mode, 'readwrite');
    if (db === old) {
      db.close();
      throw failure;
    }
  };
  await assert.rejects(
    h.manager.removeStoryOriginal(f.descriptor.source.sha256, { expectedGeneration: 1 }),
    (error) => error === failure,
  );
  assert.equal(h.attempts.length, calls + 1);
  assert.equal(h.memory.allPuts.length, puts);
  assert.deepEqual(await snapshot(h.memory), before);
  h.state.beforeTransaction = null;
  assert.equal((await h.story.readMetadata()).generation, 1);
});

test('an already-created write failure is not retried and preserves rows, originals and its connection', async (t) => {
  const h = await seeded(t),
    before = await snapshot(h.memory),
    calls = h.attempts.length,
    opens = h.memory.openCount;
  h.memory.failAnyPutAt = 1;
  await assert.rejects(
    h.manager.removeStoryOriginal(f.descriptor.source.sha256, { expectedGeneration: 1 }),
    { name: 'QuotaExceededError' },
  );
  h.memory.failAnyPutAt = null;
  assert.equal(h.attempts.length, calls + 1);
  assert.equal(h.memory.openCount, opens);
  assert.deepEqual(await snapshot(h.memory), before);
  assert.equal((await h.manager.readDomain('story')).generation, 1);
  assert.equal(h.memory.openCount, opens);
});

test('deliberate picture ensure retry uses the same saved pin and verified original after a selected-read close', async (t) => {
  const h = await seeded(t),
    request = f.request('standard');
  let acquired;
  const picture = createFlightPictures({
    context: { runId: 'connection-retry', ...request },
    level: f.catalog.entries[0].campaign.levels[0],
    themeIds: ['fpv'],
    identityCatalog: f.identityCatalog,
    readMedia: async ({ signal }) => ({
      store: h.still,
      ...(await h.still.readPresentationMetadata({ signal })),
    }),
    acquire: async ({ pin, metadata, store }, { signal }) => {
      acquired = await store.readAsset(metadata, pin.assetId, { signal });
      return { pin, image: {}, release() {} };
    },
  });
  t.after(() => picture.dispose());
  const old = h.connections.at(-1);
  h.state.beforeTransaction = ({ db, names }) => {
    if (db === old && names.includes('mediaBlobs')) db.close();
  };
  await assert.rejects(picture.ensure(), { name: 'InvalidStateError' });
  const pins = picture.pins();
  assert.ok(pins);
  assert.equal(picture.current(), null);
  assert.equal(picture.ready('fpv'), false);
  h.state.beforeTransaction = null;
  await picture.ensure();
  assert.equal(picture.pins(), pins);
  assert.deepEqual(picture.current().pin, f.pin);
  assert.equal(picture.ready('fpv'), true);
  assert.deepEqual(Buffer.from(await acquired.blob.arrayBuffer()), pngBytes());
});
