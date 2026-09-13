import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  createManagedMediaStore,
  prepareManagedMediaBytes,
  MANAGED_MEDIA_DATABASE,
  MANAGED_MEDIA_LIMITS,
} from '../managed-media-store.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import {
  prepareSoundtrackLibrary,
  exportSoundtrackBundle,
  importSoundtrackBundle,
} from '../soundtrack-bundle.mjs';
import { emptySoundtrackLibrary } from '../soundtrack.mjs';
import { fixture, structuralProbe, memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';

const audio = await fixture();
const emptyAudio = await prepareSoundtrackLibrary(emptySoundtrackLibrary(), [], {
  probeMedia: structuralProbe,
});
const emptyMedia = await prepareManagedMediaBytes(
  { format: 'revealline-managed-bytes.v1', items: [] },
  [],
);
async function media(value = 'original scene') {
  const blob = new Blob([value]),
    sha256 = createHash('sha256')
      .update(Buffer.from(await blob.arrayBuffer()))
      .digest('hex');
  return prepareManagedMediaBytes(
    { format: 'revealline-managed-bytes.v1', items: [{ id: 'scene', sha256 }] },
    [{ sha256, blob }],
  );
}
const scene = await media();
const bytes = async (blob) => Buffer.from(await blob.arrayBuffer());
function setup(options = {}) {
  const memory = memoryIndexedDB();
  return { memory, manager: createManagedMediaStore({ indexedDB: memory.indexedDB, ...options }) };
}
function open(memory, version, upgrade) {
  return new Promise((resolve, reject) => {
    const request = memory.indexedDB.open(MANAGED_MEDIA_DATABASE, version);
    request.onupgradeneeded = () => upgrade?.(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function seedV1(memory, { close = true, library = audio.library } = {}) {
  const db = await open(memory, 1, (db) => {
    db.createObjectStore('metadata');
    db.createObjectStore('audio');
  });
  const tx = db.transaction(['metadata', 'audio'], 'readwrite');
  tx.objectStore('metadata').put({ generation: 7, library }, 'library');
  tx.objectStore('audio').put(audio.blob, audio.track.asset.sha256);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  if (close) db.close();
  return db;
}

test('v1 migration retains original audio storage, generation, metadata and binary export', async () => {
  const memory = memoryIndexedDB();
  await seedV1(memory);
  const prior = memory.contents().get('audio').get(audio.track.asset.sha256);
  memory.allPuts.length = 0;
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB });
  const saved = await manager.readDomain('audio');
  assert.equal(saved.generation, 7);
  assert.deepEqual(saved.library, audio.prepared.library);
  assert.deepEqual(await bytes(saved.assets[0].blob), await bytes(audio.blob));
  assert.equal(memory.contents().get('audio').get(audio.track.asset.sha256), prior);
  assert.deepEqual(memory.allPuts, []);
  const backup = await exportSoundtrackBundle(saved.library, saved.assets);
  const imported = await importSoundtrackBundle(backup, { probeMedia: structuralProbe });
  assert.deepEqual(await bytes(imported.assets[0].blob), await bytes(audio.blob));
  const db = await open(memory, 2);
  assert.equal(db.version, 2);
  db.close();
  manager.close();
  await assert.rejects(open(memory, 1), { name: 'VersionError' });
});
test('a v1 connection closes on versionchange; upgraded reads work without copying files', async () => {
  const memory = memoryIndexedDB(),
    old = await seedV1(memory, { close: false });
  let notified = false;
  old.onversionchange = () => {
    notified = true;
    old.close();
  };
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB });
  assert.equal((await manager.readDomain('audio')).generation, 7);
  assert.equal(notified, true);
  manager.close();
});
test('retained legacy adapter yields its connection and cannot write past the v2 authority', async () => {
  const [{ createSoundtrackStore: createLegacyStore }, legacyBundle] = await Promise.all([
    import('../soundtrack-store-legacy.mjs'),
    import('../soundtrack-bundle.mjs'),
  ]);
  const memory = memoryIndexedDB(),
    legacy = createLegacyStore({ indexedDB: memory.indexedDB }),
    legacyPrepared = await legacyBundle.prepareSoundtrackLibrary(audio.library, audio.assets, {
      probeMedia: structuralProbe,
    });
  await legacy.commit(legacyPrepared, { expectedGeneration: 0 });
  const original = await legacy.read();
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB });
  const adopted = await manager.readDomain('audio');
  assert.equal(adopted.generation, original.generation);
  assert.deepEqual(adopted.library, original.library);
  assert.deepEqual(await bytes(adopted.assets[0].blob), await bytes(original.assets[0].blob));
  await assert.rejects(legacy.read(), { name: 'VersionError' });
  await assert.rejects(legacy.commit(legacyPrepared, { expectedGeneration: 1 }), {
    name: 'VersionError',
  });
  assert.equal((await manager.readDomain('audio')).generation, 1);
  const transferred = await legacyBundle.importSoundtrackBundle(
    await exportSoundtrackBundle(adopted.library, adopted.assets),
    { probeMedia: structuralProbe },
  );
  assert.deepEqual(await bytes(transferred.assets[0].blob), await bytes(audio.blob));
  legacy.close();
  manager.close();
});
test('blocked upgrade reports failure; closing the old tab allows a deliberate retry', async () => {
  const memory = memoryIndexedDB(),
    old = await seedV1(memory, { close: false }),
    manager = createManagedMediaStore({ indexedDB: memory.indexedDB });
  await assert.rejects(manager.readDomain('audio'), /Close older game tabs/);
  old.close();
  await new Promise((r) => setImmediate(r));
  const stillLegacy = await open(memory, 1);
  assert.equal(stillLegacy.version, 1, 'A failed attempt must not upgrade later in the background');
  stillLegacy.close();
  assert.equal((await manager.readDomain('audio')).generation, 7);
  manager.close();
});
test('closing a manager before its upgrade callback preserves the legacy database', async () => {
  const memory = memoryIndexedDB();
  await seedV1(memory);
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB });
  const pending = manager.readDomain('audio');
  manager.close();
  await assert.rejects(pending, /closed|aborted/i);
  const prior = await open(memory, 1);
  assert.equal(prior.version, 1);
  assert.deepEqual([...prior.objectStoreNames].sort(), ['audio', 'metadata']);
  assert.deepEqual(
    await bytes(memory.contents().get('audio').get(audio.track.asset.sha256)),
    await bytes(audio.blob),
  );
  prior.close();
});
test('unreadable legacy metadata fails closed and preserves its raw row and original file', async () => {
  const memory = memoryIndexedDB();
  await seedV1(memory, { library: { format: 'unknown' } });
  const before = memory.contents();
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB });
  await assert.rejects(
    manager.reserve({ domain: 'media', expectedGeneration: 0, maxNewBytes: 20 }),
    /Unsupported|Unknown|format|missing fields/,
  );
  assert.deepEqual(memory.contents().get('metadata'), before.get('metadata'));
  assert.deepEqual(
    await bytes(memory.contents().get('audio').get(audio.track.asset.sha256)),
    await bytes(audio.blob),
  );
});
test('two connections cannot reserve the same free capacity; reservation accounting is shared', async () => {
  const { memory, manager: a } = setup(),
    b = createManagedMediaStore({ indexedDB: memory.indexedDB });
  const results = await Promise.allSettled([
    a.reserve({ domain: 'audio', expectedGeneration: 0, maxNewBytes: 140 * 1024 * 1024 }),
    b.reserve({ domain: 'media', expectedGeneration: 0, maxNewBytes: 140 * 1024 * 1024 }),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.match(results.find((r) => r.status === 'rejected').reason.message, /256 MiB/);
  assert.equal((await b.usage()).reservations, 1);
});
test('active media reservation constrains P3 audio even with otherManagedBytes zero', async () => {
  const { memory, manager } = setup(),
    store = createSoundtrackStore({ managedStore: manager });
  const used = (await manager.usage()).usedBytes;
  const reservation = await manager.reserve({
    domain: 'media',
    expectedGeneration: 0,
    maxNewBytes: MANAGED_MEDIA_LIMITS.bytes - used - 1024,
  });
  await assert.rejects(
    store.commit(audio.prepared, { expectedGeneration: 0, otherManagedBytes: 0 }),
    /256 MiB/,
  );
  assert.equal((await store.read()).generation, 0);
  await manager.release(reservation);
  await store.commit(audio.prepared, { expectedGeneration: 0 });
  assert.equal((await store.read()).generation, 1);
});
test('independent audio/media generations permit concurrent domain commits without lost content', async () => {
  const { memory, manager: a } = setup(),
    b = createManagedMediaStore({ indexedDB: memory.indexedDB });
  await Promise.all([
    a.commitDomain('audio', audio.prepared, { expectedGeneration: 0 }),
    b.commitDomain('media', scene, { expectedGeneration: 0 }),
  ]);
  assert.deepEqual((await a.usage()).generations, { audio: 1, media: 1 });
  assert.deepEqual(
    await bytes((await a.readDomain('media')).assets[0].blob),
    await bytes(scene.assets[0].blob),
  );
  assert.deepEqual(
    await bytes((await b.readDomain('audio')).assets[0].blob),
    await bytes(audio.blob),
  );
  assert.equal((await a.usage()).reservations, 0);
});
test('physical same-hash file is shared across domains and survives removal from one domain', async () => {
  const { memory, manager } = setup();
  await manager.commitDomain('audio', audio.prepared, { expectedGeneration: 0 });
  const shared = await prepareManagedMediaBytes(
    {
      format: 'revealline-managed-bytes.v1',
      items: [{ id: 'owned-source', sha256: audio.track.asset.sha256 }],
    },
    audio.assets,
  );
  memory.allPuts.length = 0;
  await manager.commitDomain('media', shared, { expectedGeneration: 0 });
  assert.equal(
    memory.allPuts.some(([name]) => name === 'audio' || name === 'mediaBlobs'),
    false,
  );
  await manager.commitDomain('audio', emptyAudio, { expectedGeneration: 1 });
  assert.equal((await manager.readDomain('audio')).assets.length, 0);
  assert.deepEqual(
    await bytes((await manager.readDomain('media')).assets[0].blob),
    await bytes(audio.blob),
  );
  await manager.commitDomain('media', emptyMedia, { expectedGeneration: 1 });
  assert.equal(await manager.readBlob(audio.track.asset.sha256), null);
});
test('an unrelated media edit retains unreferenced legacy original bytes for recovery', async () => {
  const { memory, manager } = setup();
  await manager.usage();
  const original = new Blob(['unreferenced legacy original']),
    hash = createHash('sha256')
      .update(await bytes(original))
      .digest('hex');
  memory.seedOrphan(hash, original);
  await manager.commitDomain('media', scene, { expectedGeneration: 0 });
  const retained = await manager.readBlob(hash);
  assert.ok(retained, 'Committing a different domain must not silently erase unexplained files');
  assert.deepEqual(await bytes(retained), await bytes(original));
  assert.ok((await manager.usage()).usedBytes >= original.size + scene.assets[0].blob.size);
});
test('corrupt shared original repairs in its existing physical store without duplicate blobs', async () => {
  const { memory, manager } = setup();
  await manager.commitDomain('audio', audio.prepared, { expectedGeneration: 0 });
  const shared = await prepareManagedMediaBytes(
    {
      format: 'revealline-managed-bytes.v1',
      items: [{ id: 'source', sha256: audio.track.asset.sha256 }],
    },
    audio.assets,
  );
  await manager.commitDomain('media', shared, { expectedGeneration: 0 });
  const corrupt = await bytes(audio.blob);
  corrupt[30] = 7;
  memory.corrupt(audio.track.asset.sha256, new Blob([corrupt]));
  await manager.commitDomain('media', shared, { expectedGeneration: 1 });
  assert.equal(memory.contents().get('mediaBlobs').size, 0);
  assert.deepEqual(
    await bytes((await manager.readDomain('audio')).assets[0].blob),
    await bytes(audio.blob),
  );
});
test('expired asynchronous writer cannot commit after a new reservation reclaims capacity', async () => {
  let now = 1000;
  const { memory, manager: a } = setup({ now: () => now }),
    b = createManagedMediaStore({ indexedDB: memory.indexedDB, now: () => now });
  const old = await a.reserve({
    domain: 'media',
    expectedGeneration: 0,
    maxNewBytes: 32,
    maxMetadataBytes: 1024,
  });
  now += MANAGED_MEDIA_LIMITS.leaseMs + 1;
  const fresh = await b.reserve({
    domain: 'audio',
    expectedGeneration: 0,
    maxNewBytes: 1024,
    maxMetadataBytes: 1024,
  });
  await assert.rejects(
    a.commitDomain('media', scene, { expectedGeneration: 0, reservation: old }),
    /expired/,
  );
  assert.equal((await b.usage()).reservations, 1);
  assert.equal((await b.readDomain('media')).generation, 0);
  await b.release(fresh);
});
test('renewal keeps a live reservation; released or copied handles cannot be committed', async () => {
  let now = 1000;
  const { manager } = setup({ now: () => now });
  const handle = await manager.reserve({
    domain: 'media',
    expectedGeneration: 0,
    maxNewBytes: 32,
    maxMetadataBytes: 1024,
  });
  now += MANAGED_MEDIA_LIMITS.leaseMs - 10;
  await manager.renew(handle);
  now += 100;
  assert.equal((await manager.usage()).reservations, 1);
  await assert.rejects(manager.release({ ...handle }), /capability/);
  await manager.release(handle);
  await assert.rejects(
    manager.commitDomain('media', scene, { expectedGeneration: 0, reservation: handle }),
    /expired/,
  );
});
test('stale reservation generation does not overwrite newer media', async () => {
  const { memory, manager: a } = setup(),
    b = createManagedMediaStore({ indexedDB: memory.indexedDB });
  const handle = await a.reserve({
    domain: 'media',
    expectedGeneration: 0,
    maxNewBytes: 64,
    maxMetadataBytes: 1024,
  });
  await b.commitDomain('media', scene, { expectedGeneration: 0 });
  await assert.rejects(a.renew(handle), /changed in another/);
  await assert.rejects(
    a.commitDomain('media', await media('replacement'), {
      expectedGeneration: 0,
      reservation: handle,
    }),
    /changed in another/,
  );
  assert.equal((await a.usage()).reservations, 0, 'Early conflict releases only this operation');
  assert.deepEqual(
    await bytes((await a.readDomain('media')).assets[0].blob),
    await bytes(scene.assets[0].blob),
  );
});
test('early quota rejection releases an explicit reservation while preserving another operation', async () => {
  const { manager } = setup({ estimate: async () => ({ quota: 0, usage: 0 }) });
  const failed = await manager.reserve({
    domain: 'media',
    expectedGeneration: 0,
    maxNewBytes: 64,
    maxMetadataBytes: 1024,
  });
  const other = await manager.reserve({ domain: 'audio', expectedGeneration: 0, maxNewBytes: 64 });
  await assert.rejects(
    manager.commitDomain('media', scene, { expectedGeneration: 0, reservation: failed }),
    /reported storage space/,
  );
  assert.equal((await manager.usage()).reservations, 1);
  assert.equal((await manager.readDomain('media')).generation, 0);
  await manager.renew(other);
  await manager.release(other);
  assert.equal((await manager.usage()).reservations, 0);
});
test('reservation caps and byte/metadata allowances fail before publishing media', async () => {
  const { manager } = setup();
  const handles = [];
  for (let i = 0; i < 4; i++)
    handles.push(await manager.reserve({ domain: 'media', expectedGeneration: 0, maxNewBytes: 1 }));
  await assert.rejects(
    manager.reserve({ domain: 'audio', expectedGeneration: 0, maxNewBytes: 1 }),
    /Too many/,
  );
  await assert.rejects(
    manager.commitDomain('media', scene, { expectedGeneration: 0, reservation: handles[0] }),
    /exceeds its reservation/,
  );
  assert.equal((await manager.readDomain('media')).generation, 0);
  for (const handle of handles.slice(1)) await manager.release(handle);
  assert.equal((await manager.usage()).reservations, 0);
});
test('native byte ownership, strict refs and actual digest prevent forged prepared media', async () => {
  const { manager } = setup();
  await assert.rejects(
    manager.commitDomain('media', { ...scene }, { expectedGeneration: 0 }),
    /verified/,
  );
  await assert.rejects(
    prepareManagedMediaBytes(scene.library, [
      { sha256: scene.assets[0].sha256, blob: new Blob(['wrong']) },
    ]),
    /hash differs/,
  );
  await assert.rejects(
    prepareManagedMediaBytes({ ...scene.library, code: 'run()' }, scene.assets),
    /Unknown|Unsupported|not supported/,
  );
  const candidate = await media('owned original');
  Object.defineProperty(candidate.assets[0].blob, 'size', { value: 0 });
  Object.defineProperty(candidate.assets[0].blob, 'arrayBuffer', {
    value: () => new ArrayBuffer(0),
  });
  await manager.commitDomain('media', candidate, { expectedGeneration: 0 });
  assert.equal((await manager.readDomain('media')).assets[0].blob.size, 14);
});
test('storage failure after media put rolls back data/metadata and releases only its reservation', async () => {
  const { memory, manager } = setup();
  await manager.commitDomain('media', scene, { expectedGeneration: 0 });
  const other = await manager.reserve({
    domain: 'audio',
    expectedGeneration: 0,
    maxNewBytes: 1000,
  });
  memory.onAnyPut = ({ name, tx }) => {
    if (name === 'mediaRecords') tx.abort();
  };
  await assert.rejects(
    manager.commitDomain('media', await media('next'), { expectedGeneration: 1 }),
    /transaction failed/,
  );
  memory.onAnyPut = null;
  assert.equal((await manager.readDomain('media')).generation, 1);
  assert.deepEqual(
    await bytes((await manager.readDomain('media')).assets[0].blob),
    await bytes(scene.assets[0].blob),
  );
  assert.equal((await manager.usage()).reservations, 1);
  await manager.release(other);
});
test('quota failure in the reservation transaction leaves no phantom reserved capacity', async () => {
  const { memory, manager } = setup();
  await manager.usage();
  memory.failAnyPutAt = 2;
  await assert.rejects(
    manager.reserve({ domain: 'media', expectedGeneration: 0, maxNewBytes: 64 }),
    { name: 'QuotaExceededError' },
  );
  memory.failAnyPutAt = null;
  assert.equal((await manager.usage()).reservedBytes, 0);
});
test('cancel during a media write rolls back, while cancellation after commit reports success', async () => {
  const { memory, manager } = setup();
  const cancel = new AbortController();
  memory.onAnyPut = ({ name }) => {
    if (name === 'mediaBlobs') cancel.abort();
  };
  await assert.rejects(
    manager.commitDomain('media', scene, { expectedGeneration: 0, signal: cancel.signal }),
    { name: 'AbortError' },
  );
  memory.onAnyPut = null;
  assert.equal((await manager.readDomain('media')).generation, 0);
  const late = new AbortController();
  memory.afterAnyCommit = () => {
    if (memory.contents().get('mediaRecords').has('library')) late.abort();
  };
  const saved = await manager.commitDomain('media', scene, {
    expectedGeneration: 0,
    signal: late.signal,
  });
  assert.equal(saved.generation, 1);
  assert.equal((await manager.usage()).reservations, 0);
});
test('closing an audio adapter does not close a host-owned shared manager', async () => {
  const { manager } = setup(),
    store = createSoundtrackStore({ managedStore: manager });
  store.close();
  await assert.rejects(store.read(), /closed/);
  await manager.commitDomain('media', scene, { expectedGeneration: 0 });
  assert.equal((await manager.usage()).generations.media, 1);
});

test('ordinary soundtrack access preserves v1 bytes without opting into migration', async () => {
  const memory = memoryIndexedDB();
  await seedV1(memory);
  const store = createSoundtrackStore({ indexedDB: memory.indexedDB });
  const original = await store.read();
  assert.equal(original.generation, 7);
  assert.deepEqual(await bytes(original.assets[0].blob), await bytes(audio.blob));
  const db = await open(memory, 1);
  assert.equal(db.version, 1);
  assert.deepEqual([...memory.contents().keys()].sort(), ['audio', 'metadata']);
  db.close();
  store.close();
});
