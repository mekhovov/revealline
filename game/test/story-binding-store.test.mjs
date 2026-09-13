import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  createManagedMediaStore,
  MANAGED_MEDIA_DATABASE,
  MANAGED_MEDIA_LIMITS,
} from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createStoryMediaStore } from '../story-media-store.mjs';
import {
  prepareStoredStories,
  validateStoredStories,
  STORY_BINDINGS_FORMAT,
} from '../story-storage-record.mjs';
import { createAuthoredStoryPin, resolveAuthoredStoryPin } from '../story-bindings.mjs';
import {
  exportStoryBundle,
  inspectStoryBundle,
  importStoryBundle,
  prepareStoryBundleRestore,
  commitStoryBundleRestore,
} from '../story-bundle.mjs';
import { createStoryFixture, inspectionEnvironment } from './helpers/victory-story-fixture.mjs';
import { fixture, memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { pngBytes, presentationRecord, deferred } from './helpers/media-fixtures.mjs';

const f = createStoryFixture(),
  audio = await fixture(),
  decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 }),
  inspect = () => inspectionEnvironment().options,
  bytes = async (b) => Buffer.from(await b.arrayBuffer()),
  sha = (b) => createHash('sha256').update(b).digest('hex');
async function setup({ save = true, ...options } = {}) {
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({
      indexedDB: memory.indexedDB,
      storyMedia: true,
      ...options,
    }),
    still = createStillMediaStore({ managedStore: manager, decodeImage }),
    store = createStoryMediaStore({ managedStore: manager, decodeImage });
  await manager.commitDomain('audio', audio.prepared, { expectedGeneration: 0 });
  await still.commit(
    await still.prepare(f.library, [{ sha256: f.pin.sha256, blob: new Blob([pngBytes()]) }], {
      executionCatalog: f.catalog,
    }),
    { expectedGeneration: 0 },
  );
  if (save)
    await store.commit(await store.stage({ descriptor: f.descriptor, blob: f.blob }, inspect()));
  return {
    memory,
    manager,
    still,
    store,
    close: async () => {
      await store.close();
      manager.close();
    },
  };
}
const request = (story = { id: f.descriptor.id, revision: 1 }) => ({ picturePin: f.pin, story });
async function bind(target, story = { id: f.descriptor.id, revision: 1 }) {
  const old = await target.store.readMetadata();
  return target.store.commit(
    await target.store.stageBinding(request(story), {
      expectedGeneration: old.generation,
      ...inspect(),
    }),
  );
}
async function exportCurrent(target) {
  const inventory = await target.store.exportInventory(),
    still = await target.still.readMetadata();
  return exportStoryBundle(inventory.document, inventory.assets, { still: still.document });
}
async function rows(memory) {
  const output = {};
  for (const [name, table] of memory.contents()) {
    if (['managedState', 'reservations'].includes(name)) continue;
    output[name] = [];
    for (const [k, v] of table) output[name].push([k, v instanceof Blob ? sha(await bytes(v)) : v]);
  }
  return output;
}
async function writeRows(memory, stores, write) {
  const db = await new Promise((resolve, reject) => {
    const r = memory.indexedDB.open(MANAGED_MEDIA_DATABASE, 4);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  try {
    await new Promise((resolve, reject) => {
      const t = db.transaction(stores, 'readwrite');
      t.oncomplete = resolve;
      t.onabort = () => reject(t.error);
      write(t);
    });
  } finally {
    db.close();
  }
}
async function changeManifest(bundle, mutate, magic) {
  const b = await bytes(bundle),
    n = b.readUInt32BE(8),
    m = JSON.parse(b.subarray(12, 12 + n).toString());
  mutate(m);
  const text = Buffer.from(JSON.stringify(m)),
    header = Buffer.from(b.subarray(0, 12));
  header.writeUInt32BE(text.length, 8);
  if (magic) header.set(Buffer.from(magic));
  return new Blob([header, text, b.subarray(12 + n)]);
}

test('explicit selection stages without mutation, preserves descriptor/bytes and reopens with immutable pin', async () => {
  const target = await setup(),
    before = await rows(target.memory),
    review = await target.store.stageBinding(request(), { expectedGeneration: 1, ...inspect() });
  assert.deepEqual(await rows(target.memory), before);
  assert.equal((await target.manager.usage()).reservations, 1);
  const saved = await target.store.commit(review);
  assert.equal(saved.document.format, STORY_BINDINGS_FORMAT);
  assert.equal(saved.generation, 2);
  assert.deepEqual(saved.document.stories, before.storyRecords[0][1].library.stories);
  const still = await target.still.readMetadata(),
    pin = await createAuthoredStoryPin({
      document: saved.document,
      still: still.document,
      picturePin: f.pin,
    });
  const other = createStoryMediaStore({ managedStore: target.manager, decodeImage }),
    restored = await other.readMetadata();
  assert.deepEqual(restored, saved);
  assert.equal(
    (
      await resolveAuthoredStoryPin(pin, {
        document: restored.document,
        still: still.document,
        picturePin: f.pin,
      })
    ).kind,
    'available',
  );
  const after = await rows(target.memory);
  assert.deepEqual(after.mediaBlobs, before.mediaBlobs);
  assert.deepEqual(after.metadata, before.metadata);
  assert.deepEqual(after.mediaRecords, before.mediaRecords);
  await other.close();
  await target.close();
});

test('stale/cancelled/expired binding reviews preserve the winner and unrelated reservation', async () => {
  let now = 1000;
  const target = await setup({ now: () => now });
  const a = await target.store.stageBinding(request(), { expectedGeneration: 1, ...inspect() }),
    b = await target.store.stageBinding(request(null), { expectedGeneration: 1, ...inspect() });
  await target.store.commit(a);
  await assert.rejects(target.store.commit(b), /changed in another/);
  await assert.rejects(
    target.store.stageBinding(request(null), { expectedGeneration: 1, ...inspect() }),
    /changed/,
  );
  const other = await target.manager.reserve({
      domain: 'audio',
      expectedGeneration: 1,
      maxNewBytes: 1,
    }),
    c = await target.store.stageBinding(request(null), { expectedGeneration: 2, ...inspect() });
  await target.store.cancel(c);
  assert.equal((await target.manager.usage()).reservations, 1);
  await target.manager.release(other);
  const expired = await target.store.stageBinding(request(null), {
    expectedGeneration: 2,
    ...inspect(),
  });
  now += MANAGED_MEDIA_LIMITS.leaseMs + 1;
  await assert.rejects(target.store.commit(expired), /expired/);
  assert.notEqual((await target.store.readMetadata()).document.bindings[0].story, null);
  assert.equal((await target.manager.usage()).reservations, 0);
  await target.close();
});

test('native preparation cancellation and write failure leave no new authored binding', async () => {
  const target = await setup(),
    before = await rows(target.memory),
    env = inspectionEnvironment({ automatic: false }),
    entered = deferred(),
    controller = new AbortController();
  const pending = target.store.stageBinding(request(), {
    expectedGeneration: 1,
    ...env.options,
    createVideo() {
      const v = env.options.createVideo();
      entered.resolve();
      return v;
    },
    signal: controller.signal,
  });
  await entered.promise;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(env.urls.size, 0);
  assert.deepEqual(await rows(target.memory), before);
  const staged = await target.store.stageBinding(request(), {
    expectedGeneration: 1,
    ...inspect(),
  });
  target.memory.onAnyPut = ({ name, tx }) => {
    if (name === 'storyRecords') tx.abort();
  };
  await assert.rejects(target.store.commit(staged), /transaction failed/);
  target.memory.onAnyPut = null;
  assert.deepEqual(await rows(target.memory), before);
  assert.equal((await target.manager.usage()).reservations, 0);
  await target.close();
});

test('explicit null is persisted without selecting later history; removed source retains the old frozen choice', async () => {
  const target = await setup(),
    bound = await bind(target),
    still = await target.still.readMetadata(),
    pin = await createAuthoredStoryPin({
      document: bound.document,
      still: still.document,
      picturePin: f.pin,
    });
  await bind(target, null);
  await target.store.commit(
    await target.store.stage(
      { descriptor: { ...f.descriptor, id: 'later-story' }, blob: f.blob },
      inspect(),
    ),
  );
  const current = await target.store.readMetadata();
  assert.equal(
    await createAuthoredStoryPin({
      document: current.document,
      still: still.document,
      picturePin: f.pin,
    }),
    null,
  );
  await target.store.removeOriginal(f.descriptor.source.sha256, {
    expectedGeneration: current.generation,
  });
  const removed = await target.store.readMetadata();
  assert.equal(
    (
      await resolveAuthoredStoryPin(pin, {
        document: removed.document,
        still: still.document,
        picturePin: f.pin,
      })
    ).kind,
    'unavailable',
  );
  await assert.rejects(
    target.store.stageBinding(request(), { expectedGeneration: removed.generation, ...inspect() }),
    /Restore the selected/,
  );
  await bind(target, null);
  await target.close();
});

test('v1 bytes remain exact; v2 dispatch refuses crossed signatures/documents and rehashes bindings', async () => {
  const source = await setup(),
    v1 = await exportCurrent(source),
    raw = await bytes(v1);
  assert.equal(raw.length, 80478);
  assert.equal(sha(raw), '6dff248219ecf5747f3b732f2bfb5bd8546030a70f3731b37812daa9c45eba82');
  await bind(source);
  const v2 = await exportCurrent(source);
  assert.equal((await bytes(v2)).subarray(0, 8).toString(), 'RLSRB2\r\n');
  assert.equal((await inspectStoryBundle(v2)).format, 'revealline-story-bundle.v2');
  for (const bad of [
    await changeManifest(v2, () => {}, 'RLSRB1\r\n'),
    await changeManifest(v2, (m) => (m.format = 'revealline-story-bundle.v1')),
    await changeManifest(v2, (m) => (m.document.format = 'revealline-story-storage.v1')),
    await changeManifest(v1, (m) => (m.document.bindings = [])),
    await changeManifest(
      v2,
      (m) => (m.document.bindings[0].story.descriptorSha256 = '0'.repeat(64)),
    ),
  ])
    await assert.rejects(inspectStoryBundle(bad));
  const imported = await importStoryBundle(v2, inspect());
  assert.deepEqual(
    await bytes(
      await exportStoryBundle(imported.document, imported.assets, { still: imported.still }),
    ),
    await bytes(v2),
  );
  await source.close();
});

test('default transfer retains local null; explicit restore applies incoming selection without v1 downgrade', async () => {
  const source = await setup(),
    v1 = await exportCurrent(source);
  await bind(source);
  const v2 = await exportCurrent(source),
    imported = await importStoryBundle(v2, inspect()),
    target = await setup();
  await bind(target, null);
  const stillOld = await target.still.read(),
    expanded = structuredClone(stillOld.document.library);
  expanded.presentations.push(presentationRecord(f.identity, 2));
  await target.still.commit(
    await target.still.prepare(expanded, stillOld.assets, {
      executionCatalog: f.catalog,
      previous: stillOld.document,
    }),
    { expectedGeneration: 1 },
  );
  const extraPin = { ...f.pin, presentationRevision: 2 };
  await target.store.commit(
    await target.store.stageBinding(
      { picturePin: extraPin, story: null },
      { expectedGeneration: 2, ...inspect() },
    ),
  );
  const keep = await prepareStoryBundleRestore(imported, { store: target.store, ...inspect() });
  assert.equal(keep.bindingPolicy, 'keep-current');
  await commitStoryBundleRestore(keep);
  assert.equal((await target.store.readMetadata()).document.bindings[0].story, null);
  const apply = await prepareStoryBundleRestore(imported, {
    store: target.store,
    restoreBindings: true,
    ...inspect(),
  });
  assert.equal(apply.bindingPolicy, 'restore-incoming');
  await commitStoryBundleRestore(apply);
  const applied = await target.store.readMetadata();
  assert.notEqual(applied.document.bindings[0].story, null);
  assert.equal(applied.document.bindings.length, 2);
  assert.deepEqual(applied.document.bindings[1], { picturePin: extraPin, story: null });
  const fresh = await setup();
  await commitStoryBundleRestore(
    await prepareStoryBundleRestore(imported, { store: fresh.store, ...inspect() }),
  );
  assert.equal((await fresh.store.readMetadata()).document.format, 'revealline-story-storage.v1');
  assert.equal((await fresh.store.readMetadata()).document.bindings, undefined);
  await fresh.close();
  const old = await importStoryBundle(v1, inspect());
  await commitStoryBundleRestore(
    await prepareStoryBundleRestore(old, {
      store: target.store,
      restoreBindings: true,
      ...inspect(),
    }),
  );
  assert.equal((await target.store.readMetadata()).document.format, STORY_BINDINGS_FORMAT);
  assert.notEqual((await target.store.readMetadata()).document.bindings[0].story, null);
  await assert.rejects(
    prepareStoryBundleRestore(imported, {
      store: target.store,
      restoreBindings: 'yes',
      ...inspect(),
    }),
    /explicit/,
  );
  await source.close();
  await target.close();
});

test('changing binding request during awaits cannot change the prepared selected descriptor', async () => {
  const target = await setup(),
    mutable = structuredClone(request()),
    pending = target.store.stageBinding(mutable, { expectedGeneration: 1, ...inspect() });
  mutable.story = null;
  mutable.picturePin.sha256 = 'f'.repeat(64);
  const review = await pending;
  assert.equal(review.document.bindings[0].story.id, f.descriptor.id);
  await target.store.cancel(review);
  await target.close();
});

test('corrupted persisted descriptor digest refuses adapter metadata/export before codecs', async () => {
  const target = await setup();
  await bind(target);
  const metadata = await target.store.readMetadata(),
    bad = structuredClone(metadata.document);
  bad.bindings[0].story.descriptorSha256 = '0'.repeat(64);
  await writeRows(target.memory, ['storyRecords'], (t) =>
    t.objectStore('storyRecords').put({ generation: 2, library: bad }, 'library'),
  );
  await assert.rejects(target.store.readMetadata(), /descriptor hash/);
  await assert.rejects(target.store.exportInventory(), /descriptor hash/);
  await target.close();
});

test('null-only v2 bindings count against combined 2 MiB on selected reads, writes and binary exports', async () => {
  const target = await setup({ save: false }),
    old = await target.still.read(),
    library = structuredClone(old.document.library);
  for (let revision = 2; revision <= 256; revision++)
    library.presentations.push({
      ...presentationRecord(f.identity, revision),
      description: '雪'.repeat(2048),
    });
  // Distinct metadata aliases retain the same real poster bytes. Tune only this
  // fixture's declared provenance until combined null bindings exceed the cap.
  const nullBytes = Buffer.byteLength(
    JSON.stringify(
      library.presentations.map((p) => ({
        picturePin: { ...f.pin, presentationRevision: p.revision },
        story: null,
      })),
    ),
  );
  for (
    let i = 0;
    Buffer.byteLength(JSON.stringify({ ...old.document, library })) <
    MANAGED_MEDIA_LIMITS.metadataBytes - nullBytes / 2;
    i++
  )
    library.assets.push({
      ...library.assets[0],
      id: `metadata-alias-${i}`,
      provenance: { kind: 'original', credit: '雪'.repeat(512), source: '雪'.repeat(2048) },
    });
  await target.still.commit(
    await target.still.prepare(library, old.assets, {
      executionCatalog: f.catalog,
      previous: old.document,
    }),
    { expectedGeneration: 1 },
  );
  const metadata = await target.still.readMetadata(),
    document = {
      format: STORY_BINDINGS_FORMAT,
      stories: [],
      originals: [],
      bindings: library.presentations.map((p) => ({
        picturePin: { ...f.pin, presentationRevision: p.revision },
        story: null,
      })),
    };
  validateStoredStories(document, metadata.document);
  assert.ok(
    Buffer.byteLength(JSON.stringify(metadata.document)) <= MANAGED_MEDIA_LIMITS.metadataBytes,
  );
  assert.ok(
    Buffer.byteLength(JSON.stringify(metadata.document)) +
      Buffer.byteLength(JSON.stringify(document)) >
      MANAGED_MEDIA_LIMITS.metadataBytes,
  );
  await assert.rejects(
    exportStoryBundle(document, [], { still: metadata.document }),
    /shared 2 MiB/,
  );
  const prepared = await prepareStoredStories(document, [], { still: metadata.document });
  await assert.rejects(
    target.manager.commitDomain('story', prepared, { expectedGeneration: 0 }),
    /shared 2 MiB/,
  );
  await writeRows(target.memory, ['storyRecords'], (t) =>
    t.objectStore('storyRecords').put({ generation: 1, library: document }, 'library'),
  );
  await assert.rejects(target.store.readMetadata(), /shared 2 MiB/);
  await target.close();
});
