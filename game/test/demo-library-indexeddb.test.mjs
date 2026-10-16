import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createDemoIndexedDBStorage,
  createDemoLibrary,
  DEMO_LIBRARY_LIMITS,
} from '../demo-library.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

// Exercise the shipped adapter, including its real transaction callbacks.
// The finite model represents ordering/rollback, not browser disk durability.
const DATABASE = 'revealline-demo-recordings-v1';
const empty = () => ({ format: 'revealline-local-demos.v1', items: [] });
const item = (id) => ({
  id,
  descriptor: { id, campaignKey: 'installed-owner' },
  createdAt: '2026-09-29T00:00:00.000Z',
  replayText: '{}',
});
const append = (id) => (document) => ({ ...document, items: [...document.items, item(id)] });

function environment() {
  const databases = new Map(),
    requests = [];
  const model = (name = DATABASE) => {
    if (!databases.has(name)) databases.set(name, managedIndexedDB());
    return databases.get(name);
  };
  const indexedDB = {
    open(name, version) {
      requests.push({ name, version });
      return model(name).indexedDB.open(name, version);
    },
  };
  return { indexedDB, model, requests };
}

const rawOpen = (indexedDB, name, version, upgrade = () => {}) =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => upgrade(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

test('production cache adapter persists across owned connections without opening another database', async () => {
  const env = environment(),
    first = createDemoIndexedDBStorage({ indexedDB: env.indexedDB });
  assert.deepEqual(env.requests, [], 'Storage remains lazy until requested.');
  assert.deepEqual(await first.read(), empty());
  const saved = await first.update(append('one'));
  saved.items[0].replayText = 'caller mutation';
  assert.equal((await first.read()).items[0].replayText, '{}');
  first.close();
  first.close();
  assert.equal(env.model().closed, 1);
  await assert.rejects(first.read(), /closed/);
  const reopened = createDemoIndexedDBStorage({ indexedDB: env.indexedDB });
  try {
    assert.deepEqual(await reopened.read(), append('one')(empty()));
    assert.deepEqual([...env.model().contents().keys()], ['library']);
    assert.deepEqual(env.requests, [
      { name: DATABASE, version: 1 },
      { name: DATABASE, version: 1 },
    ]);
  } finally {
    reopened.close();
  }
  assert.equal(env.model().closed, 2);
});

test('two production connections serialize read-modify-write updates without losing either recording', async () => {
  const env = environment(),
    a = createDemoIndexedDBStorage({ indexedDB: env.indexedDB }),
    b = createDemoIndexedDBStorage({ indexedDB: env.indexedDB });
  try {
    await Promise.all([a.read(), b.read()]);
    const observed = [];
    const add = (id) => (document) => {
      observed.push(document.items.map((entry) => entry.id));
      return append(id)(document);
    };
    const [first, second] = await Promise.all([a.update(add('one')), b.update(add('two'))]);
    assert.deepEqual(observed, [[], ['one']]);
    assert.deepEqual(
      first.items.map((entry) => entry.id),
      ['one'],
    );
    assert.deepEqual(
      second.items.map((entry) => entry.id),
      ['one', 'two'],
    );
    assert.deepEqual(await a.read(), await b.read());
    assert.deepEqual(env.model().allPuts, [
      ['library', 'current'],
      ['library', 'current'],
    ]);
  } finally {
    a.close();
    b.close();
  }
});

test('abort before opening or while writing rejects and rolls back without retaining signal listeners', async () => {
  const env = environment(),
    storage = createDemoIndexedDBStorage({ indexedDB: env.indexedDB }),
    beforeOpen = new AbortController();
  beforeOpen.abort();
  await assert.rejects(storage.update(append('absent'), { signal: beforeOpen.signal }), {
    name: 'AbortError',
  });
  assert.deepEqual(env.requests, []);
  try {
    const original = await storage.update(append('original')),
      writing = new AbortController();
    env.model().onAnyPut = () => writing.abort();
    await assert.rejects(storage.update(append('cancelled'), { signal: writing.signal }), {
      name: 'AbortError',
    });
    env.model().onAnyPut = null;
    assert.deepEqual(await storage.read(), original);
    assert.equal(getEventListeners(writing.signal, 'abort').length, 0);
    assert.equal(getEventListeners(beforeOpen.signal, 'abort').length, 0);
  } finally {
    storage.close();
  }
});

test('a cancelled queued update never transforms or overwrites the preceding transaction', async () => {
  const env = environment(),
    a = createDemoIndexedDBStorage({ indexedDB: env.indexedDB }),
    b = createDemoIndexedDBStorage({ indexedDB: env.indexedDB }),
    controller = new AbortController();
  let transformed = false;
  try {
    await Promise.all([a.read(), b.read()]);
    env.model().onAnyPut = () => controller.abort();
    const first = a.update(append('accepted'));
    const cancelled = assert.rejects(
      b.update(
        (document) => {
          transformed = true;
          return append('cancelled')(document);
        },
        { signal: controller.signal },
      ),
      { name: 'AbortError' },
    );
    await Promise.all([first, cancelled]);
    assert.equal(transformed, false);
    assert.deepEqual(
      (await b.read()).items.map((entry) => entry.id),
      ['accepted'],
    );
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  } finally {
    a.close();
    b.close();
  }
});

test('quota, invalid documents and transform errors preserve the exact previous cache', async () => {
  const env = environment(),
    storage = createDemoIndexedDBStorage({ indexedDB: env.indexedDB });
  try {
    const original = await storage.update(append('original'));
    env.model().failAnyPutAt = 1;
    await assert.rejects(storage.update(append('quota')), { name: 'QuotaExceededError' });
    env.model().failAnyPutAt = null;
    assert.deepEqual(await storage.read(), original);
    await assert.rejects(
      storage.update(() => ({ format: 'wrong', items: [] })),
      /Invalid/,
    );
    await assert.rejects(
      storage.update((document) => {
        document.items.length = 0;
        throw new Error('Transform rejected');
      }),
      /Transform rejected/,
    );
    assert.deepEqual(await storage.read(), original);
    assert.equal((await storage.update(append('recovered'))).items.length, 2);
  } finally {
    storage.close();
  }
});

test('cancellation after the commit boundary reports the committed result and cleans listeners', async () => {
  const env = environment(),
    storage = createDemoIndexedDBStorage({ indexedDB: env.indexedDB }),
    controller = new AbortController();
  try {
    env.model().afterAnyCommit = () => controller.abort();
    const saved = await storage.update(append('committed'), { signal: controller.signal });
    assert.equal(controller.signal.aborted, true);
    assert.deepEqual(saved, append('committed')(empty()));
    assert.deepEqual(await storage.read(), saved);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  } finally {
    storage.close();
  }
});

test('closing during initial open rejects late adoption and releases its connection', async () => {
  const env = environment(),
    storage = createDemoIndexedDBStorage({ indexedDB: env.indexedDB });
  const pending = storage.read();
  storage.close();
  await assert.rejects(pending, /closed/);
  assert.equal(env.model().openCount, 1);
  assert.equal(env.model().closed, 1);
  assert.equal(env.model().allPuts.length, 0);
  await assert.rejects(storage.update(append('late')), /closed/);
  assert.equal(env.model().openCount, 1);
});

test('versionchange releases the old connection and refuses to downgrade a newer cache schema', async () => {
  const env = environment(),
    storage = createDemoIndexedDBStorage({ indexedDB: env.indexedDB });
  const original = await storage.update(append('original'));
  const upgraded = await rawOpen(env.indexedDB, DATABASE, 2, (db) =>
    db.createObjectStore('future-schema'),
  );
  try {
    assert.equal(env.model().closed, 1, 'The adapter did not block the requested upgrade.');
    assert.deepEqual(env.model().contents().get('library').get('current'), original);
    await assert.rejects(storage.read(), { name: 'VersionError' });
    await assert.rejects(storage.update(append('old-writer')), { name: 'VersionError' });
    assert.deepEqual(env.model().contents().get('library').get('current'), original);
  } finally {
    storage.close();
    upgraded.close();
  }
  assert.equal(env.model().closed, 2);
});

test('verified Keep/list/clear uses the production cache, retains exact owners and enforces capacity after reopen', async () => {
  const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
  const [recording, campaign, classRecipes] = await Promise.all([
    json('../demo-data/first-signal-left.replay.json'),
    json('../content/campaign.json'),
    json('../content/classes.json'),
  ]);
  const env = environment(),
    createStorage = () => createDemoIndexedDBStorage({ indexedDB: env.indexedDB }),
    storage = createStorage(),
    library = createDemoLibrary({ storage }),
    owners = Array.from({ length: 13 }, (_, index) => ({
      campaign: { ...campaign, classRecipes, id: `installed-demo-owner-${index + 1}` },
      classRecipes,
    })),
    originals = JSON.stringify({ recording, owners });
  try {
    assert.equal(
      (await library.keep(recording, { entry: owners[0], practice: false })).reason,
      'disabled',
    );
    assert.deepEqual(env.requests, []);
    assert.equal(
      (await library.keep(recording, { entry: owners[0], practice: false, manual: true })).saved,
      true,
    );
    assert.equal(library.enabled, false);
    library.setEnabled(true);
    for (const owner of owners.slice(1))
      assert.equal((await library.keep(recording, { entry: owner, practice: false })).saved, true);
    library.setEnabled(false);
    library.dispose();

    const reopenedStorage = createStorage(),
      reopened = createDemoLibrary({ storage: reopenedStorage });
    try {
      const rows = await reopened.list(owners);
      assert.equal(rows.length, DEMO_LIBRARY_LIMITS.recordings);
      assert.deepEqual(
        rows.map((row) => row.campaignId),
        owners
          .slice(1)
          .reverse()
          .map((owner) => owner.campaign.id),
      );
      assert.deepEqual(rows[0].level, campaign.levels[0], 'Picture/Fresh keeps the authored map.');
      assert.deepEqual(rows[0].replay, recording, 'Playback keeps the exact tuned recording.');
      assert.notEqual(rows[0].identity, rows[0].recordingIdentity);
      assert.equal(
        (await reopened.keep(recording, { entry: owners[12], practice: false, manual: true }))
          .count,
        12,
      );
      assert.equal(reopened.enabled, false);
      assert.equal(
        (await reopened.keep(recording, { entry: owners[12], practice: true, manual: true }))
          .reason,
        'practice',
      );
      assert.deepEqual(
        await reopened.list([]),
        [],
        'Uninstalled owners never enter the demo pool.',
      );
      assert.ok(
        Buffer.byteLength(JSON.stringify(await reopenedStorage.read())) <=
          DEMO_LIBRARY_LIMITS.bytes,
      );
      await reopened.clear();
      assert.deepEqual(await reopened.list(owners), []);
    } finally {
      reopened.dispose();
    }
    const finalStorage = createStorage();
    try {
      assert.deepEqual(await finalStorage.read(), empty());
    } finally {
      finalStorage.close();
    }
    assert.equal(
      JSON.stringify({ recording, owners }),
      originals,
      'Admission never mutates the run or installed content.',
    );
    assert.ok(env.requests.every(({ name, version }) => name === DATABASE && version === 1));
    assert.ok(
      env.model().allPuts.every(([store, key]) => store === 'library' && key === 'current'),
    );
    assert.equal(env.model().openCount, env.model().closed);
  } finally {
    library.dispose();
  }
});
