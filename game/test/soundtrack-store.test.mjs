import assert from 'node:assert/strict';
import test from 'node:test';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { SOUNDTRACK_LIMITS, emptySoundtrackLibrary } from '../soundtrack.mjs';
import { prepareSoundtrackLibrary, exportSoundtrackBundle } from '../soundtrack-bundle.mjs';
import { fixture, memoryIndexedDB, structuralProbe } from './helpers/soundtrack-fixtures.mjs';

const first = await fixture(),
  second = await fixture('other');
const setup = (options) => {
  const memory = memoryIndexedDB(),
    store = createSoundtrackStore({ indexedDB: memory.indexedDB, ...options });
  return { memory, store };
};
const bytes = async (snapshot) =>
  Promise.all(
    snapshot.assets.map(async (a) => [
      a.sha256,
      Buffer.from(await a.blob.arrayBuffer()).toString('hex'),
    ]),
  );
test('one atomic commit stores metadata and originals; reopening reads exact bytes and generation', async () => {
  const { memory, store } = setup();
  assert.equal((await store.read()).generation, 0);
  await store.commit(first.prepared, { expectedGeneration: 0 });
  const saved = await store.read();
  assert.equal(saved.generation, 1);
  assert.deepEqual(saved.library, first.prepared.library);
  assert.deepEqual(await bytes(saved), await bytes(first.prepared));
  store.close();
  const reopened = createSoundtrackStore({ indexedDB: memory.indexedDB });
  assert.deepEqual(await reopened.read(), saved);
  reopened.close();
});
test('a quota failure after a binary put rolls back all new metadata, deletion and bytes', async () => {
  const { memory, store } = setup();
  await store.commit(first.prepared, { expectedGeneration: 0 });
  const before = await store.read();
  memory.failPutAt = 2;
  await assert.rejects(store.commit(second.prepared, { expectedGeneration: 1 }), {
    name: 'QuotaExceededError',
  });
  const after = await store.read();
  assert.deepEqual(after.library, before.library);
  assert.equal(after.generation, 1);
  assert.deepEqual(await bytes(after), await bytes(before));
});
test('abort after first write rolls back and late transaction events cannot publish', async () => {
  const { memory, store } = setup();
  await store.commit(first.prepared, { expectedGeneration: 0 });
  const controller = new AbortController();
  memory.onPut = () => controller.abort();
  await assert.rejects(
    store.commit(second.prepared, { expectedGeneration: 1, signal: controller.signal }),
    { name: 'AbortError' },
  );
  const saved = await store.read();
  assert.equal(saved.generation, 1);
  assert.deepEqual(await bytes(saved), await bytes(first.prepared));
});
test('competing writer during quota await is rejected by the transaction generation guard', async () => {
  const { memory, store } = setup();
  await store.commit(first.prepared, { expectedGeneration: 0 });
  let release, entered;
  const gate = new Promise((r) => (entered = r)),
    other = createSoundtrackStore({
      indexedDB: memory.indexedDB,
      estimate: () => {
        entered();
        return new Promise((r) => (release = r));
      },
    });
  const pending = other.commit(second.prepared, { expectedGeneration: 1 });
  await gate;
  await store.commit(first.prepared, { expectedGeneration: 1 });
  release({ usage: 0, quota: 1e9 });
  await assert.rejects(pending, /changed in another/);
  assert.equal((await store.read()).generation, 2);
});
test('combined committed plus staging budget counts old and replacement bytes before deletion', async () => {
  const { store } = setup();
  await store.commit(first.prepared, { expectedGeneration: 0 });
  const otherManagedBytes = SOUNDTRACK_LIMITS.managedBytes - first.blob.size - second.blob.size;
  await assert.rejects(
    store.commit(second.prepared, { expectedGeneration: 1, otherManagedBytes }),
    /staging exceeds/,
  );
  assert.deepEqual(await bytes(await store.read()), await bytes(first.prepared));
});
test('same-hash originals are verified and reused without another audio put or duplicate staging budget', async () => {
  const { memory, store } = setup();
  await store.commit(first.prepared, { expectedGeneration: 0 });
  memory.puts.length = 0;
  await store.commit(first.prepared, {
    expectedGeneration: 1,
    otherManagedBytes: SOUNDTRACK_LIMITS.managedBytes - first.blob.size - 4096,
  });
  assert.deepEqual(memory.puts, [['metadata', 'library']]);
});
test('corrupt same-hash stored bytes are replaced and charged as new staging bytes', async () => {
  const { memory, store } = setup();
  await store.commit(first.prepared, { expectedGeneration: 0 });
  const corrupt = new Uint8Array(await first.blob.arrayBuffer());
  corrupt[30] = 1;
  memory.corrupt(first.track.asset.sha256, new Blob([corrupt]));
  memory.puts.length = 0;
  await store.commit(first.prepared, { expectedGeneration: 1 });
  assert.deepEqual(
    memory.puts.map(([name]) => name),
    ['audio', 'metadata'],
  );
  assert.deepEqual(await bytes(await store.read()), await bytes(first.prepared));
});
test('advisory quota refusal and forged prepared objects cannot change stored content', async () => {
  const { store } = setup({ estimate: async () => ({ quota: 100, usage: 99 }) });
  await assert.rejects(store.commit(first.prepared, { expectedGeneration: 0 }), /reported storage/);
  assert.equal((await store.read()).generation, 0);
  await assert.rejects(store.commit({ ...first.prepared }, { expectedGeneration: 0 }), /verified/);
});
test('successful replacement removes unused originals in the same transaction; empty collection is explicit', async () => {
  const { store } = setup();
  await store.commit(first.prepared, { expectedGeneration: 0 });
  await store.commit(second.prepared, { expectedGeneration: 1 });
  const saved = await store.read();
  assert.equal(saved.assets.length, 1);
  assert.equal(saved.assets[0].sha256, second.track.asset.sha256);
  const empty = await prepareSoundtrackLibrary(emptySoundtrackLibrary(), [], {
    probeMedia: structuralProbe,
  });
  await store.commit(empty, { expectedGeneration: 2 });
  assert.equal((await store.read()).assets.length, 0);
});
test('missing original prevents complete export without rewriting the surviving metadata', async () => {
  const { store, memory } = setup();
  await store.commit(first.prepared, { expectedGeneration: 0 });
  const db = memory.indexedDB.open();
  await new Promise((resolve) => {
    db.onsuccess = resolve;
  });
  const tx = db.result.transaction(['audio'], 'readwrite');
  tx.objectStore('audio').delete(first.track.asset.sha256);
  await new Promise((resolve) => {
    tx.oncomplete = resolve;
  });
  const saved = await store.read();
  assert.equal(saved.library.tracks.length, 1);
  await assert.rejects(exportSoundtrackBundle(saved.library, saved.assets), /every referenced/);
  assert.equal((await store.read()).generation, 1);
});
test('unavailable database and closed store report failure rather than claiming a save', async () => {
  const missing = createSoundtrackStore({ indexedDB: null });
  await assert.rejects(missing.read(), /does not provide/);
  const { store } = setup();
  store.close();
  await assert.rejects(store.read(), /closed/);
});

test('decorating an exposed prepared Blob cannot bypass native committed/staging byte accounting', async () => {
  const candidate = await fixture('decorated'),
    { store } = setup();
  Object.defineProperty(candidate.prepared.assets[0].blob, 'size', { value: 0 });
  await assert.rejects(
    store.commit(candidate.prepared, {
      expectedGeneration: 0,
      otherManagedBytes: SOUNDTRACK_LIMITS.managedBytes - 3000,
    }),
    /staging exceeds/,
  );
  assert.equal((await store.read()).generation, 0);
});
test('cancellation after native commit waits for completion and reports the actual committed result', async () => {
  const { memory, store } = setup(),
    controller = new AbortController();
  memory.afterCommit = () => controller.abort();
  const result = await store.commit(first.prepared, {
    expectedGeneration: 0,
    signal: controller.signal,
  });
  assert.equal(result.generation, 1);
  assert.equal((await store.read()).generation, 1);
  assert.deepEqual(await bytes(await store.read()), await bytes(first.prepared));
});
