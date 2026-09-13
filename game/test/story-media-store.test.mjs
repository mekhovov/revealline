import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  createManagedMediaStore,
  prepareManagedMediaBytes,
  MANAGED_MEDIA_DATABASE,
  MANAGED_MEDIA_LIMITS,
} from '../managed-media-store.mjs';
import { createStoryMediaStore, STORY_INVENTORY_FORMAT } from '../story-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { prepareStoredStories, validateStoredStories } from '../story-storage-record.mjs';
import { requirePreparedVictoryStory } from '../victory-story.mjs';
import { exportSoundtrackBundle, importSoundtrackBundle } from '../soundtrack-bundle.mjs';
import { exportMediaBundle, importMediaBundle } from '../media-bundle.mjs';
import {
  createStoryFixture,
  inspectionEnvironment,
  videoBytes,
} from './helpers/victory-story-fixture.mjs';
import { fixture, structuralProbe, memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { pngBytes, presentationRecord, deferred } from './helpers/media-fixtures.mjs';

const f = createStoryFixture(),
  audio = await fixture(),
  decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 }),
  bytes = async (blob) => Buffer.from(await blob.arrayBuffer()),
  sha = (b) => createHash('sha256').update(b).digest('hex');
const inspect = () => inspectionEnvironment().options;
async function open(memory, version) {
  return new Promise((resolve, reject) => {
    const r = memory.indexedDB.open(MANAGED_MEDIA_DATABASE, version);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function tx(db, stores, write) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, 'readwrite');
    t.oncomplete = resolve;
    t.onabort = () => reject(t.error);
    write(t);
  });
}
async function seed({ memory = memoryIndexedDB(), version = 3, ...options } = {}) {
  const manager = createManagedMediaStore({
      indexedDB: memory.indexedDB,
      ...(version === 4 ? { storyMedia: true } : { richStillMedia: true }),
      ...options,
    }),
    still = createStillMediaStore({ managedStore: manager, decodeImage });
  await manager.commitDomain('audio', audio.prepared, { expectedGeneration: 0 });
  const prepared = await still.prepare(
    f.library,
    [{ sha256: f.pin.sha256, blob: new Blob([pngBytes()]) }],
    { executionCatalog: f.catalog },
  );
  await still.commit(prepared, { expectedGeneration: 0 });
  return { memory, manager, still };
}
async function setup(options = {}) {
  const seeded = await seed({ ...options, version: 4 });
  return { ...seeded, store: createStoryMediaStore({ managedStore: seeded.manager, decodeImage }) };
}
async function save(store, descriptor = f.descriptor) {
  const review = await store.stage({ descriptor, blob: f.blob }, inspect());
  return store.commit(review);
}
async function persisted(memory) {
  const output = {};
  for (const [name, rows] of memory.contents()) {
    if (['managedState', 'reservations'].includes(name)) continue;
    output[name] = [];
    for (const [key, value] of rows)
      output[name].push([key, value instanceof Blob ? sha(await bytes(value)) : value]);
  }
  return output;
}

test('v3→explicit v4 retains exact audio/still rows and original exports; old v3 refuses', async () => {
  const { memory, manager: v3, still } = await seed(),
    before = await persisted(memory),
    oldStill = await still.read(),
    oldAudio = await v3.readDomain('audio'),
    oldImageBundle = await exportMediaBundle(oldStill.document, oldStill.assets, { decodeImage }),
    oldAudioBundle = await exportSoundtrackBundle(oldAudio.library, oldAudio.assets),
    manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true }),
    store = createStoryMediaStore({ managedStore: manager, decodeImage });
  assert.equal((await store.readMetadata()).generation, 0);
  const adopted = await persisted(memory);
  for (const name of ['metadata', 'audio', 'mediaRecords', 'mediaBlobs'])
    assert.deepEqual(adopted[name], before[name]);
  assert.equal(
    memory.contents().get('storyRecords').size,
    0,
    'Upgrade creates an empty store, no rewritten rows',
  );
  await assert.rejects(v3.readDomain('audio'), { name: 'VersionError' });
  await assert.rejects(still.read(), { name: 'VersionError' });
  await save(store);
  const freshStill = await createStillMediaStore({ managedStore: manager, decodeImage }).read(),
    freshAudio = await createSoundtrackStore({ managedStore: manager }).read();
  const imageBundle = await exportMediaBundle(freshStill.document, freshStill.assets, {
      decodeImage,
    }),
    soundBundle = await exportSoundtrackBundle(freshAudio.library, freshAudio.assets);
  assert.deepEqual(await bytes(imageBundle), await bytes(oldImageBundle));
  assert.deepEqual(await bytes(soundBundle), await bytes(oldAudioBundle));
  assert.deepEqual(
    await bytes((await importMediaBundle(imageBundle, { decodeImage })).assets[0].blob),
    pngBytes(),
  );
  assert.deepEqual(
    await bytes(
      (await importSoundtrackBundle(soundBundle, { probeMedia: structuralProbe })).assets[0].blob,
    ),
    await bytes(audio.blob),
  );
  assert.deepEqual((await manager.usage()).generations, { audio: 1, media: 1, story: 1 });
  await store.close();
  manager.close();
  v3.close();
});

test('defaults remain v2 and rich-still v3; v4 cannot be silently supplied by a legacy manager', async () => {
  for (const [options, expected] of [
    [{}, 2],
    [{ richStillMedia: true }, 3],
  ]) {
    const memory = memoryIndexedDB(),
      manager = createManagedMediaStore({ indexedDB: memory.indexedDB, ...options });
    await manager.usage();
    const db = await open(memory, expected);
    assert.equal(db.version, expected);
    db.close();
    assert.equal(memory.contents().has('storyRecords'), false);
    assert.throws(() => createStoryMediaStore({ managedStore: manager }), /explicit shared v4/);
    await assert.rejects(manager.readDomain('story'), /Unknown/);
    manager.close();
  }
});

test('restart acquires exact A from retained owners despite changed assignment B; never awards or rewrites v1', async () => {
  const { store, manager, memory, still } = await setup();
  await save(store);
  const first = await still.read(),
    next = structuredClone(first.document.library);
  next.presentations.push(presentationRecord(f.identity, 2));
  next.assignments[0].revision = 2;
  await still.commit(
    await still.prepare(next, first.assets, {
      executionCatalog: f.catalog,
      previous: first.document,
    }),
    { expectedGeneration: 1 },
  );
  await store.close();
  manager.close();
  const fresh = createStoryMediaStore({ indexedDB: memory.indexedDB, decodeImage }),
    prepared = await fresh.acquire(
      { id: f.descriptor.id, revision: 1, picturePin: f.pin },
      inspect(),
    );
  assert.equal(requirePreparedVictoryStory(prepared, f.pin), prepared);
  assert.equal(prepared.descriptor.picturePin.presentationRevision, 1);
  assert.deepEqual(await bytes(prepared.original), videoBytes);
  assert.equal(
    memory
      .contents()
      .get('mediaRecords')
      .get('library')
      .library.library.presentations.every((p) => p.story === null),
    true,
  );
  assert.equal(memory.contents().has('profiles'), false);
  const wrong = structuredClone(f.pin);
  wrong.presentationRevision = 2;
  await assert.rejects(
    fresh.acquire({ id: f.descriptor.id, revision: 1, picturePin: wrong }, inspect()),
    /exact story/,
  );
  await fresh.close();
});

test('staging reserves before decode, changes no domain until explicit commit, and cancel releases capacity', async () => {
  const { store, manager } = await setup(),
    before = await manager.usage(),
    review = await store.stage(f, inspect());
  assert.equal((await store.readMetadata()).generation, 0);
  assert.equal((await manager.usage()).reservations, 1);
  assert.ok((await manager.usage()).reservedBytes >= videoBytes.length);
  await assert.rejects(store.commit({ ...review }), /Prepare this story/);
  assert.equal(await store.cancel(review), true);
  assert.equal((await manager.usage()).reservations, 0);
  assert.equal((await manager.usage()).usedBytes, before.usedBytes);
  await assert.rejects(store.commit(review), /Prepare/);
  await store.close();
  manager.close();
});

test('same revision cannot change original/segment/poster; remove retains history and exact re-add works', async () => {
  const { store, manager, memory } = await setup();
  await save(store);
  const first = await store.readMetadata();
  for (const change of [
    (v) => (v.segment.startSeconds = 1),
    (v) => (v.source.sha256 = 'a'.repeat(64)),
    (v) => (v.picturePin.sha256 = 'a'.repeat(64)),
  ]) {
    const descriptor = structuredClone(f.descriptor);
    change(descriptor);
    await assert.rejects(
      store.stage({ descriptor, blob: f.blob }, inspect()),
      /Immutable|historical/,
    );
  }
  await store.removeOriginal(f.descriptor.source.sha256, { expectedGeneration: 1 });
  const removed = await store.readMetadata();
  assert.deepEqual(removed.document.stories, first.document.stories);
  assert.deepEqual(removed.document.originals, []);
  assert.equal(memory.contents().get('mediaBlobs').has(f.descriptor.source.sha256), false);
  assert.equal(memory.contents().get('mediaBlobs').has(f.pin.sha256), true);
  await assert.rejects(
    store.acquire({ id: f.descriptor.id, revision: 1, picturePin: f.pin }, inspect()),
    /removed/,
  );
  assert.equal((await store.exportInventory()).assets.length, 0);
  await save(store);
  assert.equal(
    (await store.acquire({ id: f.descriptor.id, revision: 1, picturePin: f.pin }, inspect()))
      .descriptor.id,
    f.descriptor.id,
  );
  await store.close();
  manager.close();
});

test('two connections stage independently; stale CAS loses without replacing current history or another lease', async () => {
  const { store: a, manager, memory } = await setup(),
    otherManager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true }),
    b = createStoryMediaStore({ managedStore: otherManager, decodeImage });
  const first = await a.stage(f, inspect()),
    second = await b.stage(
      { ...f, descriptor: { ...f.descriptor, id: 'second-story' } },
      inspect(),
    );
  await a.commit(first);
  await assert.rejects(b.commit(second), /changed in another/);
  assert.deepEqual(
    (await b.readMetadata()).document.stories.map((s) => s.id),
    [f.descriptor.id],
  );
  assert.equal((await manager.usage()).reservations, 0);
  await a.close();
  await b.close();
  manager.close();
  otherManager.close();
});

test('source bounds, wrong bytes, unsupported codec and timeout never publish and release own reservation', async () => {
  const { store, manager } = await setup(),
    before = (await manager.usage()).usedBytes;
  await assert.rejects(
    store.stage(
      { descriptor: f.descriptor, blob: new Blob([new Uint8Array(64 * 1024 * 1024 + 1)]) },
      inspect(),
    ),
    /64 MiB/,
  );
  await assert.rejects(
    store.stage({ descriptor: f.descriptor, blob: new Blob(['wrong']) }, inspect()),
    /MP4|WebM|container/,
  );
  const wrong = new Uint8Array(videoBytes);
  wrong[wrong.length - 1] ^= 1;
  await assert.rejects(
    store.stage({ descriptor: f.descriptor, blob: new Blob([wrong]) }, inspect()),
    /sha256/,
  );
  const unsupported = inspectionEnvironment({ automatic: false });
  const timed = store.stage(f, { ...unsupported.options, timeoutMs: 10 });
  await assert.rejects(timed, /timed out/);
  assert.equal(unsupported.urls.size, 0);
  const codec = inspectionEnvironment({ automatic: false });
  await assert.rejects(
    store.stage(f, {
      ...codec.options,
      createVideo() {
        const v = codec.options.createVideo();
        queueMicrotask(() => v.dispatchEvent(new Event('error')));
        return v;
      },
    }),
    /could not decode/,
  );
  assert.equal(codec.urls.size, 0);
  const bad = inspectionEnvironment({ facts: { width: 320 } });
  await assert.rejects(store.stage(f, bad.options), /width/);
  assert.equal((await manager.usage()).reservations, 0);
  assert.equal((await manager.usage()).usedBytes, before);
  await store.close();
  manager.close();
});

test('shared staging and quota refusal preserve audio/still/history and do not evict', async () => {
  let quota = null;
  const { store, manager, memory } = await setup({ estimate: async () => quota }),
    before = await persisted(memory),
    used = (await manager.usage()).usedBytes;
  const held = await manager.reserve({
    domain: 'audio',
    expectedGeneration: 1,
    maxNewBytes: MANAGED_MEDIA_LIMITS.bytes - used - 1024,
  });
  await assert.rejects(store.stage(f, inspect()), /256 MiB/);
  await manager.release(held);
  const review = await store.stage(f, inspect());
  quota = { quota: 0, usage: 0 };
  await assert.rejects(store.commit(review), /reported storage space/);
  assert.deepEqual(await persisted(memory), before);
  assert.equal((await manager.usage()).reservations, 0);
  await store.close();
  manager.close();
});

test('aborted post-Blob write rolls back all domains; cancellation after commit remains success', async () => {
  const { store, manager, memory } = await setup(),
    before = await persisted(memory),
    review = await store.stage(f, inspect()),
    signal = new AbortController();
  memory.onAnyPut = ({ name }) => {
    if (name === 'storyRecords') signal.abort();
  };
  await assert.rejects(store.commit(review, { signal: signal.signal }), { name: 'AbortError' });
  memory.onAnyPut = null;
  assert.deepEqual(await persisted(memory), before);
  assert.equal((await manager.usage()).reservations, 0);
  const late = new AbortController(),
    next = await store.stage(f, inspect());
  memory.afterAnyCommit = () => {
    if (memory.contents().get('storyRecords').get('library')?.generation === 1) late.abort();
  };
  assert.equal((await store.commit(next, { signal: late.signal })).generation, 1);
  memory.afterAnyCommit = null;
  await store.close();
  manager.close();
});

test('close/abort while decoder is pending cancels native source and releases leases without closing injected manager', async () => {
  for (const action of ['abort', 'close']) {
    const { store, manager } = await setup(),
      entered = deferred(),
      env = inspectionEnvironment({ automatic: false }),
      controller = new AbortController();
    const pending = store.stage(f, {
      ...env.options,
      createVideo() {
        const v = env.options.createVideo();
        entered.resolve();
        return v;
      },
      signal: controller.signal,
    });
    await entered.promise;
    if (action === 'close') await store.close();
    else controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    env.videos[0].metadata();
    assert.equal(env.urls.size, 0);
    assert.equal((await manager.usage()).reservations, 0);
    assert.equal((await manager.usage()).generations.story, 0);
    await store.close();
    manager.close();
  }
});

test('original export owns exact sorted bytes without codec playback; missing/corrupt bytes refuse and preserve rows', async () => {
  const { store, manager, memory } = await setup();
  await save(store);
  const inventory = await store.exportInventory();
  assert.equal(inventory.format, STORY_INVENTORY_FORMAT);
  assert.deepEqual(await bytes(inventory.assets[0].blob), videoBytes);
  const db = await open(memory, 4);
  await tx(db, ['mediaBlobs'], (t) =>
    t.objectStore('mediaBlobs').put(new Blob(['wrong']), f.descriptor.source.sha256),
  );
  const before = await persisted(memory);
  await assert.rejects(store.exportInventory(), /hash\/length/);
  assert.deepEqual(await persisted(memory), before);
  await tx(db, ['mediaBlobs'], (t) =>
    t.objectStore('mediaBlobs').delete(f.descriptor.source.sha256),
  );
  db.close();
  await assert.rejects(store.exportInventory(), /missing story originals/);
  await assert.rejects(
    store.acquire({ id: f.descriptor.id, revision: 1, picturePin: f.pin }, inspect()),
    /missing/,
  );
  await store.removeOriginal(f.descriptor.source.sha256, { expectedGeneration: 1 });
  assert.equal((await store.readMetadata()).document.stories.length, 1);
  await store.close();
  manager.close();
});

test('strict v1 still formats and record brands cannot be used as a story-storage shortcut', async () => {
  const { store, manager, still } = await setup(),
    metadata = await still.readMetadata();
  const generic = await prepareManagedMediaBytes(
    { format: 'revealline-managed-bytes.v1', items: [] },
    [],
  );
  await assert.rejects(
    manager.commitDomain('story', generic, { expectedGeneration: 0 }),
    /verified/,
  );
  const doc = {
    format: 'revealline-story-storage.v1',
    stories: [f.descriptor],
    originals: [f.descriptor.source.sha256],
  };
  const prepared = await prepareStoredStories(
    doc,
    [{ sha256: f.descriptor.source.sha256, blob: f.blob }],
    { still: metadata.document, ...inspect() },
  );
  await assert.rejects(
    manager.commitDomain('story', { ...prepared }, { expectedGeneration: 0 }),
    /verified/,
  );
  const bad = structuredClone(doc);
  bad.stories[0].picturePin.identity.baseCampaignKey = 'foreign';
  assert.throws(() => validateStoredStories(bad, metadata.document));
  await manager.commitDomain('story', prepared, { expectedGeneration: 0 });
  const removed = { ...doc, stories: [], originals: [] },
    empty = await prepareStoredStories(removed, [], { still: metadata.document, ...inspect() });
  await assert.rejects(
    manager.commitDomain('story', empty, { expectedGeneration: 1 }),
    /cannot change or be removed/,
  );
  await store.close();
  manager.close();
});

test('v1/v2 migrations retain generic/shared/orphan originals and v4 story removal cannot reclaim another domain', async () => {
  for (const base of [1, 2]) {
    const memory = memoryIndexedDB(),
      legacy = createSoundtrackStore({ indexedDB: memory.indexedDB });
    await legacy.commit(audio.prepared, { expectedGeneration: 0 });
    legacy.close();
    if (base === 2) {
      const v2 = createManagedMediaStore({ indexedDB: memory.indexedDB });
      await v2.commitDomain(
        'media',
        await prepareManagedMediaBytes(
          {
            format: 'revealline-managed-bytes.v1',
            items: [{ id: 'original-video', sha256: f.descriptor.source.sha256 }],
          },
          [{ sha256: f.descriptor.source.sha256, blob: f.blob }],
        ),
        { expectedGeneration: 0 },
      );
      v2.close();
    }
    const manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true }),
      still = createStillMediaStore({ managedStore: manager, decodeImage }),
      previous = await still.read(),
      prepared = await still.prepare(
        f.library,
        [...previous.assets, { sha256: f.pin.sha256, blob: new Blob([pngBytes()]) }],
        { executionCatalog: f.catalog, previous: previous.document },
      );
    await still.commit(prepared, { expectedGeneration: previous.generation });
    const orphan = new Blob(['unexplained bytes']),
      orphanHash = sha(await bytes(orphan)),
      db = await open(memory, 4);
    await tx(db, ['mediaBlobs'], (t) => t.objectStore('mediaBlobs').put(orphan, orphanHash));
    db.close();
    const store = createStoryMediaStore({ managedStore: manager, decodeImage });
    await save(store);
    await store.removeOriginal(f.descriptor.source.sha256, { expectedGeneration: 1 });
    assert.equal(memory.contents().get('mediaBlobs').has(f.descriptor.source.sha256), base === 2);
    assert.deepEqual(await bytes(await manager.readBlob(orphanHash)), await bytes(orphan));
    assert.deepEqual(
      await bytes((await manager.readDomain('audio')).assets[0].blob),
      await bytes(audio.blob),
    );
    const doc = (await still.readMetadata()).document;
    assert.equal(doc.legacy.items.length, base === 2 ? 1 : 0);
    await store.close();
    manager.close();
  }
});

test('blocked or cancelled v4 upgrade never completes later behind an old v3 client', async () => {
  for (const action of ['blocked', 'abort', 'close']) {
    const { memory, manager: v3 } = await seed();
    v3.close();
    const held = await open(memory, 3),
      before = await persisted(memory),
      manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true }),
      signal = new AbortController();
    const pending = manager.usage({ signal: signal.signal });
    if (action === 'abort') signal.abort();
    else if (action === 'close') manager.close();
    await assert.rejects(pending, /Close older|cancelled|closed|aborted/i);
    held.close();
    await new Promise((resolve) => setImmediate(resolve));
    const old = await open(memory, 3);
    assert.equal(old.version, 3);
    old.close();
    assert.equal(memory.contents().has('storyRecords'), false);
    assert.deepEqual(await persisted(memory), before);
    manager.close();
  }
});

test('close immediately after reservation commit releases the returned lease instead of losing it', async () => {
  const { manager } = await setup(),
    entered = deferred(),
    gate = deferred();
  const wrapper = {
      ...manager,
      async reserve(args) {
        const result = await manager.reserve(args);
        entered.resolve();
        await gate.promise;
        return result;
      },
    },
    store = createStoryMediaStore({ managedStore: wrapper, decodeImage });
  const pending = store.stage(f, inspect());
  await entered.promise;
  await store.close();
  gate.resolve();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal((await manager.usage()).reservations, 0);
  assert.equal((await manager.usage()).generations.story, 0);
  manager.close();
});

test('missing exact poster refuses both binding and playback; current metadata never substitutes another picture', async () => {
  const { store, manager, memory } = await setup();
  await save(store);
  const db = await open(memory, 4);
  await tx(db, ['mediaBlobs'], (t) => t.objectStore('mediaBlobs').delete(f.pin.sha256));
  db.close();
  const before = await persisted(memory);
  await assert.rejects(
    store.acquire({ id: f.descriptor.id, revision: 1, picturePin: f.pin }, inspect()),
    /picture original is missing/,
  );
  await assert.rejects(
    store.stage({ ...f, descriptor: { ...f.descriptor, id: 'later-story' } }, inspect()),
    /picture original is missing/,
  );
  assert.deepEqual(await persisted(memory), before);
  assert.equal((await manager.usage()).reservations, 0);
  const inventory = await store.exportInventory();
  assert.deepEqual(
    await bytes(inventory.assets[0].blob),
    videoBytes,
    'Original recovery remains possible without a playable poster',
  );
  await store.close();
  manager.close();
});

test('all surviving physical media rows count toward 512, including unexplained orphans', async () => {
  const { store, manager, memory } = await setup(),
    db = await open(memory, 4);
  await tx(db, ['mediaBlobs'], (t) => {
    for (let i = 0; i < 511; i++) {
      const blob = new Blob([`orphan-${i}`]);
      t.objectStore('mediaBlobs').put(blob, sha(Buffer.from(`orphan-${i}`)));
    }
  });
  db.close();
  const before = await persisted(memory),
    review = await store.stage(f, inspect());
  await assert.rejects(store.commit(review), /physical inventory/);
  assert.equal(memory.contents().get('mediaBlobs').size, 512);
  assert.deepEqual(await persisted(memory), before);
  assert.equal((await manager.usage()).reservations, 0);
  await store.close();
  manager.close();
});

test('combined still/story metadata uses the existing 2 MiB allowance, not one new allowance per domain', async () => {
  const { store, manager, still } = await setup(),
    old = await still.read(),
    library = structuredClone(old.document.library);
  for (let revision = 2; revision <= 256; revision++)
    library.presentations.push({
      ...presentationRecord(f.identity, revision),
      description: '雪'.repeat(2048),
    });
  await still.commit(
    await still.prepare(library, old.assets, {
      executionCatalog: f.catalog,
      previous: old.document,
    }),
    { expectedGeneration: 1 },
  );
  const metadata = await still.readMetadata(),
    document = {
      format: 'revealline-story-storage.v1',
      stories: Array.from({ length: 512 }, (_, i) => ({
        ...f.descriptor,
        id: `story-${i}`,
        description: 'S'.repeat(2048),
      })),
      originals: [f.descriptor.source.sha256],
    };
  assert.ok(Buffer.byteLength(JSON.stringify(document)) < MANAGED_MEDIA_LIMITS.metadataBytes);
  assert.ok(
    Buffer.byteLength(JSON.stringify(document)) +
      Buffer.byteLength(JSON.stringify(metadata.document)) >
      MANAGED_MEDIA_LIMITS.metadataBytes,
  );
  const prepared = await prepareStoredStories(
    document,
    [{ sha256: f.descriptor.source.sha256, blob: f.blob }],
    { still: metadata.document, ...inspect() },
  );
  await assert.rejects(
    manager.commitDomain('story', prepared, { expectedGeneration: 0 }),
    /shared 2 MiB/,
  );
  assert.equal((await manager.usage()).generations.story, 0);
  await store.close();
  manager.close();
});

test('expired staged reviews refuse, while caller mutation across await cannot change the saved binding', async () => {
  let now = 1000;
  const { store, manager } = await setup({ now: () => now }),
    descriptor = structuredClone(f.descriptor),
    pending = store.stage({ descriptor, blob: f.blob }, inspect());
  descriptor.segment.startSeconds = 0;
  descriptor.picturePin.sha256 = 'b'.repeat(64);
  const review = await pending;
  assert.deepEqual(review.document.stories[0], f.descriptor);
  now += MANAGED_MEDIA_LIMITS.leaseMs + 1;
  await assert.rejects(store.commit(review), /expired/);
  assert.equal((await manager.usage()).reservations, 0);
  assert.equal((await store.readMetadata()).generation, 0);
  await store.close();
  manager.close();
});

test('concurrent audio/still/story commits retain all three originals and independent generations', async () => {
  const { store, manager, still } = await setup(),
    replacement = await fixture('replacement'),
    old = await still.read(),
    next = structuredClone(old.document.library);
  next.presentations.push(presentationRecord(f.identity, 2));
  next.assignments[0].revision = 2;
  const stillPrepared = await still.prepare(next, old.assets, {
      executionCatalog: f.catalog,
      previous: old.document,
    }),
    review = await store.stage(f, inspect());
  await Promise.all([
    manager.commitDomain('audio', replacement.prepared, { expectedGeneration: 1 }),
    still.commit(stillPrepared, { expectedGeneration: 1 }),
    store.commit(review),
  ]);
  assert.deepEqual((await manager.usage()).generations, { audio: 2, media: 2, story: 1 });
  assert.deepEqual(
    await bytes((await manager.readDomain('audio')).assets[0].blob),
    await bytes(replacement.blob),
  );
  assert.deepEqual(await bytes((await still.read()).assets[0].blob), pngBytes());
  assert.deepEqual(
    await bytes(
      (await store.acquire({ id: f.descriptor.id, revision: 1, picturePin: f.pin }, inspect()))
        .original,
    ),
    videoBytes,
  );
  assert.equal((await manager.usage()).reservations, 0);
  await store.close();
  manager.close();
});

test('selected story metadata/acquisition refuse a persisted combined over-budget pair before video decode', async () => {
  const { store, manager, still, memory } = await setup(),
    old = await still.read(),
    library = structuredClone(old.document.library);
  for (let revision = 2; revision <= 256; revision++)
    library.presentations.push({
      ...presentationRecord(f.identity, revision),
      description: '雪'.repeat(2048),
    });
  await still.commit(
    await still.prepare(library, old.assets, {
      executionCatalog: f.catalog,
      previous: old.document,
    }),
    { expectedGeneration: 1 },
  );
  const metadata = await still.readMetadata(),
    document = {
      format: 'revealline-story-storage.v1',
      stories: Array.from({ length: 512 }, (_, i) => ({
        ...f.descriptor,
        id: i === 0 ? f.descriptor.id : `story-${i}`,
        description: 'S'.repeat(2048),
      })),
      originals: [f.descriptor.source.sha256],
    };
  validateStoredStories(document, metadata.document);
  assert.ok(Buffer.byteLength(JSON.stringify(document)) < MANAGED_MEDIA_LIMITS.metadataBytes);
  assert.ok(
    Buffer.byteLength(JSON.stringify(document)) +
      Buffer.byteLength(JSON.stringify(metadata.document)) >
      MANAGED_MEDIA_LIMITS.metadataBytes,
  );
  const db = await open(memory, 4);
  await tx(db, ['storyRecords', 'mediaBlobs'], (t) => {
    t.objectStore('storyRecords').put({ generation: 1, library: document }, 'library');
    t.objectStore('mediaBlobs').put(f.blob, f.descriptor.source.sha256);
  });
  db.close();
  const before = await persisted(memory);
  await assert.rejects(store.readMetadata(), /shared 2 MiB/);
  let decoded = 0;
  const env = inspectionEnvironment();
  await assert.rejects(
    store.acquire(
      { id: f.descriptor.id, revision: 1, picturePin: f.pin },
      {
        ...env.options,
        createVideo() {
          decoded++;
          return env.options.createVideo();
        },
      },
    ),
    /shared 2 MiB/,
  );
  assert.equal(decoded, 0);
  assert.deepEqual(await persisted(memory), before);
  await store.close();
  manager.close();
});
