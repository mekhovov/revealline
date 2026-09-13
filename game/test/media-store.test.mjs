import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  createManagedMediaStore,
  prepareManagedMediaBytes,
  MANAGED_MEDIA_DATABASE,
  MANAGED_MEDIA_LIMITS,
} from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import {
  validateStoredStillMedia,
  prepareStoredStillMedia,
  createStoredStillIdentityCatalog,
} from '../media-storage-record.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { campaignKey } from '../library.mjs';
import { CLASSES } from '../core/registry.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { createPresentationResolver } from '../media-presentation.mjs';
import { emptySoundtrackLibrary } from '../soundtrack.mjs';
import {
  prepareSoundtrackLibrary,
  exportSoundtrackBundle,
  importSoundtrackBundle,
} from '../soundtrack-bundle.mjs';
import {
  mediaFixture,
  libraryRecord,
  presentationRecord,
  pngBytes,
  provenance,
  deferred,
} from './helpers/media-fixtures.mjs';
import { fixture, structuralProbe, memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';

const audio = await fixture(),
  decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
const bytes = async (blob) => Buffer.from(await blob.arrayBuffer());
const sha = (value) => createHash('sha256').update(value).digest('hex');
const emptyAudio = await prepareSoundtrackLibrary(emptySoundtrackLibrary(), [], {
  probeMedia: structuralProbe,
});
async function stillFixture() {
  const context = mediaFixture(true),
    prepared = await prepareStillAsset(
      new Blob([pngBytes()]),
      { id: 'picture-a', provenance: provenance() },
      { decodeImage },
    );
  const library = libraryRecord(context.identity);
  library.assets = [prepared.asset];
  return { ...context, library, assets: [{ sha256: prepared.asset.sha256, blob: prepared.blob }] };
}
const f = await stillFixture();
async function nextPicture(previous, assets) {
  const prepared = await prepareStillAsset(
    new Blob([
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    ]),
    { id: 'picture-b', provenance: provenance() },
    { decodeImage },
  );
  const library = structuredClone(previous.library);
  library.assets.push(prepared.asset);
  library.presentations.push(presentationRecord(f.identity, 2, 'picture-b'));
  library.assignments[0].revision = 2;
  return { library, assets: [...assets, { sha256: prepared.asset.sha256, blob: prepared.blob }] };
}
function setup(options = {}) {
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({
      indexedDB: memory.indexedDB,
      richStillMedia: true,
      ...options,
    });
  return { memory, manager, store: createStillMediaStore({ managedStore: manager, decodeImage }) };
}
function open(memory, version, upgrade) {
  return new Promise((resolve, reject) => {
    const request = memory.indexedDB.open(MANAGED_MEDIA_DATABASE, version);
    request.onupgradeneeded = () => upgrade?.(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction(db, names, fn) {
  const tx = db.transaction(names, 'readwrite');
  fn(tx);
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error ?? new Error('aborted'));
  });
}
async function seedV1(memory, close = true) {
  const db = await open(memory, 1, (db) => {
    db.createObjectStore('audio');
    db.createObjectStore('metadata');
  });
  await transaction(db, ['metadata', 'audio'], (tx) => {
    tx.objectStore('metadata').put({ generation: 7, library: audio.prepared.library }, 'library');
    tx.objectStore('audio').put(audio.blob, audio.track.asset.sha256);
  });
  if (close) db.close();
  return db;
}
async function prepare(store, source = f, previous) {
  return store.prepare(source.library, source.assets, { executionCatalog: f.catalog, previous });
}
async function contents(memory) {
  const result = {};
  for (const [name, rows] of memory.contents()) {
    result[name] = [];
    for (const [key, value] of rows)
      result[name].push([
        key,
        value instanceof Blob ? { sha256: sha(await bytes(value)), bytes: value.size } : value,
      ]);
  }
  return result;
}

test('v1→v3 keeps exact MP3, metadata/generation and .rlsound roundtrip without copying rows', async () => {
  const memory = memoryIndexedDB();
  await seedV1(memory);
  const prior = await contents(memory);
  memory.allPuts.length = 0;
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB, richStillMedia: true }),
    store = createStillMediaStore({ managedStore: manager, decodeImage }),
    soundtrack = createSoundtrackStore({ managedStore: manager });
  const current = await store.read();
  assert.equal(current.generation, 0);
  assert.deepEqual(current.document.owners, []);
  assert.deepEqual(memory.allPuts, []);
  const saved = await soundtrack.read();
  assert.equal(saved.generation, 7);
  assert.deepEqual((await contents(memory)).metadata, prior.metadata);
  assert.deepEqual((await contents(memory)).audio, prior.audio);
  const bundle = await exportSoundtrackBundle(saved.library, saved.assets),
    baseline = await exportSoundtrackBundle(audio.prepared.library, audio.assets);
  assert.deepEqual(await bytes(bundle), await bytes(baseline));
  const imported = await importSoundtrackBundle(bundle, { probeMedia: structuralProbe });
  assert.deepEqual(await bytes(imported.assets[0].blob), await bytes(audio.blob));
  const db = await open(memory, 3);
  assert.equal(db.version, 3);
  db.close();
  const prepared = await prepare(store, f, current.document);
  await store.commit(prepared, { expectedGeneration: 0 });
  assert.deepEqual((await soundtrack.read()).library, saved.library);
  assert.deepEqual(await bytes((await soundtrack.read()).assets[0].blob), await bytes(audio.blob));
  store.close();
  await soundtrack.commit(audio.prepared, { expectedGeneration: 7 });
  assert.equal((await soundtrack.read()).generation, 8);
  soundtrack.close();
  manager.close();
});

test('v2→v3 preserves generic references, unexplained originals and shared audio bytes through rich adoption', async () => {
  const memory = memoryIndexedDB(),
    old = createManagedMediaStore({ indexedDB: memory.indexedDB });
  await old.commitDomain('audio', audio.prepared, { expectedGeneration: 0 });
  const legacy = await prepareManagedMediaBytes(
    {
      format: 'revealline-managed-bytes.v1',
      items: [{ id: 'original-audio-source', sha256: audio.track.asset.sha256 }],
    },
    audio.assets,
  );
  await old.commitDomain('media', legacy, { expectedGeneration: 0 });
  const orphan = new Blob(['unclassified original']);
  const orphanHash = sha(await bytes(orphan));
  memory.seedOrphan(orphanHash, orphan);
  const before = await contents(memory);
  memory.allPuts.length = 0;
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB, richStillMedia: true }),
    store = createStillMediaStore({ managedStore: manager, decodeImage });
  const saved = await store.read();
  assert.equal(saved.generation, 1);
  assert.deepEqual(saved.document.legacy, legacy.library);
  assert.deepEqual(memory.allPuts, []);
  assert.deepEqual((await contents(memory)).mediaRecords, before.mediaRecords);
  const prepared = await prepare(
    store,
    { library: f.library, assets: [...f.assets, ...saved.assets] },
    saved.document,
  );
  await store.commit(prepared, { expectedGeneration: 1 });
  await manager.commitDomain('audio', emptyAudio, { expectedGeneration: 1 });
  assert.deepEqual(
    await bytes(await manager.readBlob(audio.track.asset.sha256)),
    await bytes(audio.blob),
  );
  assert.deepEqual(await bytes(await manager.readBlob(orphanHash)), await bytes(orphan));
  const recovered = await store.read();
  assert.equal(recovered.assets.length, 2);
  assert.equal(memory.contents().get('audio').size, 2);
  assert.equal(memory.contents().get('mediaBlobs').size, 1);
  await assert.rejects(
    old.readDomain('audio'),
    (e) => e.name === 'VersionError' && /newer game.*recovery/.test(e.message),
  );
  await assert.rejects(old.readDomain('media'), { name: 'VersionError' });
  manager.close();
  old.close();
});

test('restart hydrates exact removed-pack history and both difficulty identities without installation', async () => {
  const { memory, manager, store } = setup();
  await store.commit(await prepare(store), { expectedGeneration: 0 });
  const first = await store.read(),
    edited = await nextPicture(first.document, first.assets);
  await store.commit(await prepare(store, edited, first.document), { expectedGeneration: 1 });
  manager.close();
  // A new adapter and JSON deserialization emulate lost in-memory brands; no
  // live installed execution catalog is passed to read/hydration.
  const fresh = createStillMediaStore({ indexedDB: memory.indexedDB, decodeImage });
  const restored = await fresh.read();
  const parsed = validateStoredStillMedia(JSON.stringify(restored.document));
  assert.equal(parsed.library.presentations.length, 2);
  assert.deepEqual(parsed.owners[0].campaign, {
    ...f.catalog.entries[0].baseCampaign,
    levels: f.catalog.entries[0].baseCampaign.levels.map(normalizedLevel),
    classRecipes: CLASSES,
  });
  assert.equal(campaignKey(parsed.owners[0].campaign), f.identity.baseCampaignKey);
  const resolver = createPresentationResolver(
    parsed.library,
    createStoredStillIdentityCatalog(parsed),
  );
  for (const mode of ['standard', 'gentle'])
    assert.equal(resolver.resolve(f.request(mode)).presentation.revision, 2);
  const unassigned = structuredClone(restored.document.library);
  unassigned.assignments = [];
  const changed = await fresh.prepare(unassigned, restored.assets, {
    executionCatalog: createExecutionCatalog([]),
    previous: restored.document,
  });
  await fresh.commit(changed, { expectedGeneration: 2 });
  const read = await fresh.read();
  assert.equal(read.document.library.assets.length, 2);
  assert.equal(read.assets.length, 2);
  const newRevision = structuredClone(read.document.library);
  newRevision.presentations.push(presentationRecord(f.identity, 3));
  await assert.rejects(
    fresh.prepare(newRevision, read.assets, {
      executionCatalog: createExecutionCatalog([]),
      previous: read.document,
    }),
    /execution catalog/,
  );
  fresh.close();
});

test('real owner map/roster identities and strict bounds reject forged history without writes', async () => {
  const { memory, store } = setup();
  const prepared = await prepare(store);
  const before = await contents(memory);
  for (const mutate of [
    (v) => {
      v.owners[0].campaign.levels[0].enemies[0].vx = 9;
    },
    (v) => {
      v.owners[0].campaign.levels[0].version = 'xonix-level.future';
    },
    (v) => {
      v.owners[0].campaign.classRecipes = [{ id: 'fake' }];
    },
    (v) => {
      delete v.owners[0].campaign.classRecipes;
    },
    (v) => {
      v.owners[0].campaign.classRecipes[0].revision = 'different-recipe';
    },
    (v) => {
      delete v.owners[0].campaign.levels[0].rules;
    },
    (v) => {
      v.owners[0].themeIds = ['retro'];
    },
    (v) => {
      v.owners[0].themeIds = ['fpv', 'fpv'];
    },
    (v) => {
      v.owners.push(v.owners[0]);
    },
    (v) => {
      v.owners = Array(105).fill(v.owners[0]);
    },
    (v) => {
      v.owners[0].assets = ['unbounded'];
    },
    (v) => {
      v.owners[0].campaign.briefs = ['x'.repeat(65537)];
    },
  ]) {
    const candidate = structuredClone(prepared.library);
    mutate(candidate);
    assert.throws(() => validateStoredStillMedia(candidate));
  }
  let reads = 0;
  await assert.rejects(
    prepareStoredStillMedia(f.library, f.assets, {
      executionCatalog: f.catalog,
      previous: {
        get format() {
          reads++;
          return 'value';
        },
      },
      decodeImage,
    }),
    /accessors/,
  );
  assert.equal(reads, 0);
  assert.deepEqual(await contents(memory), before);
});

test('every original is required; altered bytes/header facts reject before commit', async () => {
  const { store } = setup();
  await assert.rejects(prepare(store, { library: f.library, assets: [] }), /every referenced/);
  await assert.rejects(
    prepare(store, { library: f.library, assets: [{ ...f.assets[0], blob: new Blob(['wrong']) }] }),
    /PNG\/JPEG/,
  );
  const falseWidth = structuredClone(f.library);
  falseWidth.assets[0].width = 2;
  await assert.rejects(
    prepare(store, { library: falseWidth, assets: f.assets }),
    /metadata\/hash differs/,
  );
  await assert.rejects(
    store.commit({ ...(await prepare(store)) }, { expectedGeneration: 0 }),
    /verified/,
  );
  store.close();
});

test('a v3 manager refuses generic downgrade and checks immutable current history despite foreign preparation', async () => {
  const { store, manager } = setup();
  await store.commit(await prepare(store), { expectedGeneration: 0 });
  const empty = await prepareManagedMediaBytes(
    { format: 'revealline-managed-bytes.v1', items: [] },
    [],
  );
  await assert.rejects(
    manager.commitDomain('media', empty, { expectedGeneration: 1 }),
    /cannot be downgraded/,
  );
  const foreign = structuredClone(f.library);
  foreign.presentations[0].description = 'rewritten elsewhere';
  const replacement = await prepareStoredStillMedia(foreign, f.assets, {
    executionCatalog: f.catalog,
    decodeImage,
  });
  await assert.rejects(
    store.commit(replacement, { expectedGeneration: 1 }),
    /immutable presentation/,
  );
  assert.equal(
    (await store.read()).document.library.presentations[0].description,
    f.library.presentations[0].description,
  );
});

test('v1/v2 open tabs block upgrades safely; close and deliberate retry preserves old data', async () => {
  for (const version of [1, 2]) {
    const memory = memoryIndexedDB();
    await seedV1(memory);
    if (version === 2) {
      const v2 = createManagedMediaStore({ indexedDB: memory.indexedDB });
      await v2.usage();
      v2.close();
    }
    const old = await open(memory, version),
      before = await contents(memory),
      store = createStillMediaStore({ indexedDB: memory.indexedDB, decodeImage });
    await assert.rejects(store.read(), /Close older game tabs/);
    old.close();
    await new Promise((r) => setImmediate(r));
    const unchanged = await open(memory, version);
    assert.equal(unchanged.version, version);
    unchanged.close();
    assert.deepEqual(await contents(memory), before);
    assert.equal((await store.read()).generation, 0);
    store.close();
  }
});

test('cancel or close before upgrade cannot later commit a v3 schema change', async () => {
  for (const action of ['cancel', 'close']) {
    const memory = memoryIndexedDB();
    await seedV1(memory);
    const before = await contents(memory);
    const controller = new AbortController(),
      store = createStillMediaStore({ indexedDB: memory.indexedDB, decodeImage });
    const pending = store.read({ signal: controller.signal });
    if (action === 'cancel') controller.abort();
    else store.close();
    await assert.rejects(pending, /cancelled|closed|aborted/i);
    await new Promise((r) => setImmediate(r));
    const old = await open(memory, 1);
    assert.equal(old.version, 1);
    old.close();
    assert.deepEqual(await contents(memory), before);
    store.close();
  }
});

test('old version readers cannot read or write v3; adapters require the explicit shared manager', async () => {
  const memory = memoryIndexedDB(),
    legacy = createSoundtrackStore({ indexedDB: memory.indexedDB });
  await legacy.commit(audio.prepared, { expectedGeneration: 0 });
  const v2 = createManagedMediaStore({ indexedDB: memory.indexedDB });
  await v2.readDomain('audio');
  const v3 = createManagedMediaStore({ indexedDB: memory.indexedDB, richStillMedia: true });
  await v3.usage();
  await assert.rejects(legacy.read(), { name: 'VersionError' });
  await assert.rejects(legacy.commit(audio.prepared, { expectedGeneration: 1 }), {
    name: 'VersionError',
  });
  for (const domain of ['audio', 'media'])
    await assert.rejects(v2.readDomain(domain), { name: 'VersionError' });
  assert.throws(() => createStillMediaStore({ managedStore: v2, decodeImage }), /v3 manager/);
  assert.equal((await createSoundtrackStore({ managedStore: v3 }).read()).generation, 1);
  v3.close();
  v2.close();
  legacy.close();
});

test('a cancelled old opening cannot clear the newer successful connection', async () => {
  const memory = memoryIndexedDB();
  await seedV1(memory);
  const store = createStillMediaStore({ indexedDB: memory.indexedDB, decodeImage });
  const controller = new AbortController(),
    abandoned = store.read({ signal: controller.signal });
  controller.abort();
  const fresh = store.read();
  await assert.rejects(abandoned, { name: 'AbortError' });
  assert.equal((await fresh).generation, 0);
  const count = memory.openCount;
  await store.read();
  assert.equal(memory.openCount, count, 'Late callbacks did not discard the current handle');
  store.close();
});

test('historical owner snapshots share the existing total metadata budget', async () => {
  const { store } = setup(),
    prepared = await prepare(store);
  const large = structuredClone(prepared.library),
    template = large.owners[0];
  for (let index = 0; index < 30; index++) {
    const owner = structuredClone(template);
    owner.campaign.id = `large-owner-${index}`;
    owner.campaign.levels = Array.from({ length: 128 }, (_, map) => ({
      ...structuredClone(template.campaign.levels[0]),
      id: `map-${map}`,
    }));
    large.owners.push(owner);
  }
  assert.ok(Buffer.byteLength(JSON.stringify(large)) > MANAGED_MEDIA_LIMITS.metadataBytes);
  assert.throws(() => validateStoredStillMedia(large), /budget/);
  store.close();
});

test('concurrent v3 domains share capacity and CAS; a stale writer cannot rewrite newer media', async () => {
  const { memory, manager, store } = setup(),
    other = createManagedMediaStore({ indexedDB: memory.indexedDB, richStillMedia: true }),
    otherStore = createStillMediaStore({ managedStore: other, decodeImage });
  const a = await prepare(store),
    b = await prepare(otherStore);
  const results = await Promise.allSettled([
    store.commit(a, { expectedGeneration: 0 }),
    otherStore.commit(b, { expectedGeneration: 0 }),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.match(results.find((r) => r.status === 'rejected').reason.message, /changed in another/);
  await other.commitDomain('audio', audio.prepared, { expectedGeneration: 0 });
  assert.deepEqual((await manager.usage()).generations, { audio: 1, media: 1 });
  const used = (await manager.usage()).usedBytes,
    reservation = await other.reserve({
      domain: 'audio',
      expectedGeneration: 1,
      maxNewBytes: MANAGED_MEDIA_LIMITS.bytes - used - 1024,
    });
  const saved = await store.read(),
    next = await nextPicture(saved.document, saved.assets);
  await assert.rejects(
    store.commit(await prepare(store, next, saved.document), { expectedGeneration: 1 }),
    /256 MiB/,
  );
  assert.equal((await store.read()).generation, 1);
  assert.equal((await manager.usage()).reservations, 1);
  await other.release(reservation);
});

test('reported quota refusal and expired leases preserve bytes and release only their own reservation', async () => {
  let now = 1000,
    noQuota = false;
  const { store, manager } = setup({
    now: () => now,
    estimate: async () => (noQuota ? { quota: 0, usage: 0 } : null),
  });
  await store.commit(await prepare(store), { expectedGeneration: 0 });
  const first = await store.read(),
    next = await nextPicture(first.document, first.assets),
    prepared = await prepare(store, next, first.document);
  const lease = await manager.reserve({
      domain: 'media',
      expectedGeneration: 1,
      maxNewBytes: 100,
      maxMetadataBytes: 20000,
    }),
    other = await manager.reserve({ domain: 'audio', expectedGeneration: 0, maxNewBytes: 100 });
  noQuota = true;
  await assert.rejects(
    store.commit(prepared, { expectedGeneration: 1, reservation: lease }),
    /reported storage space/,
  );
  assert.equal((await manager.usage()).reservations, 1);
  await manager.release(other);
  noQuota = false;
  const expired = await manager.reserve({
    domain: 'media',
    expectedGeneration: 1,
    maxNewBytes: 100,
    maxMetadataBytes: 20000,
  });
  now += MANAGED_MEDIA_LIMITS.leaseMs + 1;
  await assert.rejects(
    store.commit(prepared, { expectedGeneration: 1, reservation: expired }),
    /expired/,
  );
  assert.equal((await store.read()).generation, 1);
  assert.deepEqual(await bytes((await store.read()).assets[0].blob), pngBytes());
});

test('abort during rich transaction rolls back original+metadata; cancellation after commit stays success', async () => {
  const { memory, store, manager } = setup();
  await store.commit(await prepare(store), { expectedGeneration: 0 });
  const first = await store.read(),
    next = await nextPicture(first.document, first.assets),
    prepared = await prepare(store, next, first.document);
  const before = await contents(memory),
    controller = new AbortController();
  memory.onAnyPut = ({ name }) => {
    if (name === 'mediaRecords') controller.abort();
  };
  await assert.rejects(
    store.commit(prepared, { expectedGeneration: 1, signal: controller.signal }),
    { name: 'AbortError' },
  );
  memory.onAnyPut = null;
  const after = await contents(memory);
  assert.deepEqual(after.mediaRecords, before.mediaRecords);
  assert.deepEqual(after.mediaBlobs, before.mediaBlobs);
  assert.equal((await manager.usage()).reservations, 0);
  const late = new AbortController();
  memory.afterAnyCommit = () => {
    if (memory.contents().get('mediaRecords').get('library')?.generation === 2) late.abort();
  };
  assert.equal(
    (await store.commit(prepared, { expectedGeneration: 1, signal: late.signal })).generation,
    2,
  );
  assert.equal((await store.read()).document.library.presentations.length, 2);
});

test('write failure after Blob staging is atomic and preserves original audio', async () => {
  const { memory, store, manager } = setup();
  await manager.commitDomain('audio', audio.prepared, { expectedGeneration: 0 });
  const before = await contents(memory);
  memory.onAnyPut = ({ name, tx }) => {
    if (name === 'mediaRecords') tx.abort();
  };
  await assert.rejects(
    store.commit(await prepare(store), { expectedGeneration: 0 }),
    /transaction failed/,
  );
  memory.onAnyPut = null;
  const after = await contents(memory);
  assert.deepEqual(after.audio, before.audio);
  assert.deepEqual(after.metadata, before.metadata);
  assert.deepEqual(after.mediaBlobs, before.mediaBlobs);
  assert.equal((await store.read()).generation, 0);
});

test('delayed decoder cancellation and store disposal never publish prepared state', async () => {
  const { manager } = setup(),
    gate = deferred(),
    entered = deferred(),
    controller = new AbortController();
  const store = createStillMediaStore({
    managedStore: manager,
    decodeImage: () => {
      entered.resolve();
      return gate.promise;
    },
  });
  const pending = store.prepare(f.library, f.assets, {
    executionCatalog: f.catalog,
    signal: controller.signal,
  });
  await entered.promise;
  controller.abort();
  gate.resolve({ naturalWidth: 1, naturalHeight: 1 });
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal((await manager.usage()).generations.media, 0);
  const g = deferred(),
    e = deferred(),
    closed = createStillMediaStore({
      managedStore: manager,
      decodeImage: () => {
        e.resolve();
        return g.promise;
      },
    });
  const later = closed.prepare(f.library, f.assets, { executionCatalog: f.catalog });
  await e.promise;
  closed.close();
  g.resolve({ naturalWidth: 1, naturalHeight: 1 });
  await assert.rejects(later, /closed/);
  assert.equal((await manager.usage()).generations.media, 0);
});

test('corrupt or missing persisted image fails read without rewriting metadata or audio', async () => {
  const { memory, store, manager } = setup();
  await store.commit(await prepare(store), { expectedGeneration: 0 });
  await manager.commitDomain('audio', audio.prepared, { expectedGeneration: 0 });
  const db = await open(memory, 3);
  await transaction(db, ['mediaBlobs'], (tx) =>
    tx.objectStore('mediaBlobs').put(new Blob(['bad']), f.assets[0].sha256),
  );
  db.close();
  const before = await contents(memory);
  await assert.rejects(store.read(), /PNG\/JPEG/);
  assert.deepEqual(await contents(memory), before);
  const second = await open(memory, 3);
  await transaction(second, ['mediaBlobs'], (tx) =>
    tx.objectStore('mediaBlobs').delete(f.assets[0].sha256),
  );
  second.close();
  await assert.rejects(store.read(), /every referenced/);
  assert.deepEqual((await contents(memory)).audio, before.audio);
});
