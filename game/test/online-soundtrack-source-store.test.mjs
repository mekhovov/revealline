import assert from 'node:assert/strict';
import test from 'node:test';
import { createOnlineSoundtrackSourceStore } from '../online-soundtrack-source-store.mjs';
import {
  DEFAULT_ONLINE_SOUNDTRACK_SOURCES,
  ONLINE_SOUNDTRACK_SOURCE_SETTINGS_KEY,
} from '../online-soundtrack-sources.mjs';
import { createManagedMediaStore, MANAGED_MEDIA_LIMITS } from '../managed-media-store.mjs';
import { emptySoundtrackLibrary } from '../soundtrack.mjs';
import { prepareSoundtrackLibrary } from '../soundtrack-bundle.mjs';
import { memoryIndexedDB, structuralProbe } from './helpers/soundtrack-fixtures.mjs';
const custom = [
  { ...DEFAULT_ONLINE_SOUNDTRACK_SOURCES[0], enabled: false },
  { url: 'https://music.example.net/', enabled: true },
];
function setup(t) {
  const memory = memoryIndexedDB(),
    store = createOnlineSoundtrackSourceStore({ indexedDB: memory.indexedDB }),
    manager = createManagedMediaStore({ indexedDB: memory.indexedDB, soundtrackCatalogue: true });
  t.after(() => {
    store.close();
    manager.close();
  });
  return { memory, store, manager };
}

test('source metadata defaults without writes and shares existing DB5 without changing audio generation', async (t) => {
  const { memory, store, manager } = setup(t);
  const initial = await store.read();
  assert.equal(initial.generation, 0);
  assert.deepEqual(initial.sources, DEFAULT_ONLINE_SOUNDTRACK_SOURCES);
  assert.equal(memory.allPuts.length, 0);
  const before = await manager.usage();
  const saved = await store.commit(custom, { expectedGeneration: 0 });
  assert.equal(saved.generation, 1);
  assert.equal(saved.sources[1].url, 'https://music.example.net/catalogue.json');
  assert.equal((await manager.readDomain('audio')).generation, 0);
  assert((await manager.usage()).usedBytes > before.usedBytes);
  assert.deepEqual(
    memory.contents().get('metadata').get(ONLINE_SOUNDTRACK_SOURCE_SETTINGS_KEY),
    saved,
  );
  assert.equal(
    memory.contents().get('managedState').get('ledger').usedBytes,
    (await manager.usage()).usedBytes,
  );
});

test('two source writers are serialized and stale generation loses without changing stored choice', async (t) => {
  const { memory, store } = setup(t),
    second = createOnlineSoundtrackSourceStore({ indexedDB: memory.indexedDB });
  t.after(() => second.close());
  const results = await Promise.allSettled([
    store.commit(custom, { expectedGeneration: 0 }),
    second.commit(DEFAULT_ONLINE_SOUNDTRACK_SOURCES, { expectedGeneration: 0 }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.deepEqual(
    await store.read(),
    results.find((result) => result.status === 'fulfilled').value,
  );
});

test('unrelated audio save preserves source key, generation, and ledger accounting', async (t) => {
  const { store, manager, memory } = setup(t);
  const saved = await store.commit(custom, { expectedGeneration: 0 });
  const prepared = await prepareSoundtrackLibrary(emptySoundtrackLibrary(), [], {
    probeMedia: structuralProbe,
  });
  await manager.commitDomain('audio', prepared, { expectedGeneration: 0 });
  assert.deepEqual(await store.read(), saved);
  assert.equal((await manager.readDomain('audio')).generation, 1);
  assert.equal(
    memory.contents().get('managedState').get('ledger').usedBytes,
    (await manager.usage()).usedBytes,
  );
});

test('source setting put failure rolls back preference and shared ledger atomically', async (t) => {
  const { store, manager, memory } = setup(t);
  const before = await manager.usage();
  memory.failAnyPutAt = 2;
  await assert.rejects(store.commit(custom, { expectedGeneration: 0 }));
  memory.failAnyPutAt = null;
  assert.equal((await store.read()).generation, 0);
  assert.equal((await manager.usage()).usedBytes, before.usedBytes);
  assert.equal(memory.contents().get('metadata').has(ONLINE_SOUNDTRACK_SOURCE_SETTINGS_KEY), false);
});

test('abort cannot partially save settings or ledger', async (t) => {
  const { store, memory } = setup(t),
    controller = new AbortController();
  await store.read();
  memory.onAnyPut = () => controller.abort();
  await assert.rejects(store.commit(custom, { expectedGeneration: 0, signal: controller.signal }), {
    name: 'AbortError',
  });
  memory.onAnyPut = null;
  assert.equal((await store.read()).generation, 0);
});

test('source metadata respects concurrent reserved capacity in the shared 256 MiB budget', async (t) => {
  const { store, manager } = setup(t);
  const before = await manager.usage();
  const lease = await manager.reserve({
    domain: 'audio',
    expectedGeneration: 0,
    maxNewBytes: MANAGED_MEDIA_LIMITS.bytes - before.usedBytes - 512,
  });
  await assert.rejects(
    store.commit(custom, { expectedGeneration: 0 }),
    /shared media storage budget/,
  );
  assert.equal((await store.read()).generation, 0);
  await manager.release(lease);
  assert.equal((await store.commit(custom, { expectedGeneration: 0 })).generation, 1);
});

test('invalid source arrays never write', async (t) => {
  const { store, memory } = setup(t);
  await store.read();
  await assert.rejects(async () =>
    store.commit([{ url: 'https://localhost', enabled: true }], { expectedGeneration: 0 }),
  );
  assert.equal(memory.allPuts.length, 0);
});
