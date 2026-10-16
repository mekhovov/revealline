import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { openWorldStore } from '../../optional-practice/civilian-fpv/world-store.mjs';

const { IDBFactory } = createRequire(
  new URL('../../authoring/fpv-worlds/package.json', import.meta.url),
)('fake-indexeddb');
const request = (opening) =>
  new Promise((resolve, reject) => {
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
  });
const completed = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error ?? new Error('Listing fixture transaction aborted.'));
  });
const sha = (letter) => letter.repeat(64);
const revision = (id, letter, files = 1) => ({
  id,
  sha256: sha(letter),
  project: { id, title: `${id} ${letter}`, courses: [{ id: `${id}-course` }] },
  installedAt: '2026-10-16T00:00:00.000Z',
  bytes: files * 8,
  generation: 7,
  review: { preserved: true },
  assets: new Map(
    Array.from({ length: files }, (_, index) => [
      `${index}.bin`,
      new Blob([`${id}-${letter}-${index}`]),
    ]),
  ),
});
async function seed(indexedDB, name, { retained = [], active = [] } = {}) {
  const db = await request(indexedDB.open(name));
  try {
    const tx = db.transaction(['projects', 'assets', 'revisions', 'meta'], 'readwrite'),
      done = completed(tx);
    for (const row of retained) tx.objectStore('revisions').put(row);
    for (const { assets, ...row } of active) {
      tx.objectStore('projects').put(row);
      for (const [path, blob] of assets)
        tx.objectStore('assets').put({ projectId: row.id, path, blob });
    }
    tx.objectStore('meta').put(7, 'generation');
    await done;
  } finally {
    db.close();
  }
}

// Observe real fake-IDB request deliveries, without substituting their results.
// This bounds payload fan-out, not native browser heap use or garbage collection.
function observeReads(factory, name, onRevisionRead = () => {}) {
  const observations = { revisionRequests: 0, maxPayloadRows: 0, modes: [] };
  return {
    observations,
    indexedDB: {
      open(...args) {
        const opening = factory.open(...args);
        opening.addEventListener('success', () => {
          const db = opening.result;
          if (db.name !== name) return;
          const transaction = db.transaction.bind(db);
          db.transaction = (...options) => {
            const tx = transaction(...options),
              objectStore = tx.objectStore.bind(tx),
              observed = new WeakSet();
            observations.modes.push(tx.mode);
            tx.objectStore = (storeName) => {
              const store = objectStore(storeName);
              if (storeName !== 'revisions' || observed.has(store)) return store;
              observed.add(store);
              for (const method of ['get', 'getAll', 'openCursor']) {
                const read = store[method].bind(store);
                store[method] = (...parameters) => {
                  observations.revisionRequests++;
                  const reading = read(...parameters);
                  reading.addEventListener('success', () => {
                    const result = reading.result,
                      rows = Array.isArray(result) ? result : [result?.value ?? result],
                      payloadRows = rows.filter((row) => row?.assets instanceof Map).length;
                    observations.maxPayloadRows = Math.max(
                      observations.maxPayloadRows,
                      payloadRows,
                    );
                    onRevisionRead(tx, result);
                  });
                  return reading;
                };
              }
              return store;
            };
            return tx;
          };
        });
        return opening;
      },
    },
  };
}

test('metadata listing bounds retained asset payload fan-out instead of delivering the whole library', async (t) => {
  const factory = new IDBFactory(),
    name = 'listing-payload',
    probe = observeReads(factory, name),
    store = await openWorldStore({ indexedDB: probe.indexedDB, name }),
    retained = Array.from({ length: 32 }, (_, index) =>
      revision(`region-${String(index).padStart(2, '0')}`, 'a', 64),
    );
  try {
    await seed(factory, name, { retained });
    const records = await store.list({ includeRevisions: true });
    assert.equal(records.length, retained.length);
    assert.ok(records.every((row) => !('assets' in row) && row.active === false));
    t.diagnostic(
      `Largest delivered revision payload: ${probe.observations.maxPayloadRows} rows; fixture: 32 rows / 2048 asset entries.`,
    );
    assert.equal(probe.observations.maxPayloadRows, 1);
    assert.ok(probe.observations.modes.every((mode) => mode === 'readonly'));
    assert.equal(await store.generation(), 7);
  } finally {
    store.close();
  }
});

test('listing preserves active-first primary-key order, exact revision identity and stored content', async () => {
  const indexedDB = new IDBFactory(),
    name = 'listing-identities',
    store = await openWorldStore({ indexedDB, name }),
    a = revision('a', 'a'),
    oldB = revision('b', 'a'),
    activeB = revision('b', 'b'),
    legacy = revision('legacy', 'c'),
    activeZ = revision('z', 'd'),
    newZ = revision('z', 'e');
  try {
    await seed(indexedDB, name, {
      retained: [newZ, activeZ, activeB, oldB, a],
      active: [activeZ, legacy, activeB],
    });
    const records = await store.list({ includeRevisions: true }),
      metadata = ({ assets, ...row }, active) => ({ ...row, active });
    assert.deepEqual(records, [
      metadata(activeB, true),
      metadata(legacy, true),
      metadata(activeZ, true),
      metadata(a, false),
      metadata(oldB, false),
      metadata(newZ, false),
    ]);
    records[0].project.title = 'Changed outside storage';
    records[3].review.preserved = false;
    assert.equal((await store.get('b')).project.title, activeB.project.title);
    assert.equal((await store.get('a', { sha256: a.sha256 })).review.preserved, true);
    for (const row of [a, oldB, activeB, legacy, activeZ, newZ]) {
      const saved = await store.get(row.id, { sha256: row.sha256 });
      assert.equal(await saved.assets.get('0.bin').text(), `${row.id}-${row.sha256[0]}-0`);
    }
    assert.equal(await store.generation(), 7);
  } finally {
    store.close();
  }
});

test('active-only and empty listings never read retained revision payloads', async () => {
  const factory = new IDBFactory(),
    name = 'listing-active-only',
    probe = observeReads(factory, name),
    store = await openWorldStore({ indexedDB: probe.indexedDB, name });
  try {
    assert.deepEqual(await store.list({ includeRevisions: true }), []);
    await seed(factory, name, {
      retained: [revision('retained', 'a', 64)],
      active: [revision('legacy', 'b')],
    });
    probe.observations.revisionRequests = 0;
    assert.deepEqual(
      (await store.list()).map(({ id, active }) => ({ id, active })),
      [{ id: 'legacy', active: true }],
    );
    assert.equal(probe.observations.revisionRequests, 0);
    assert.equal(await store.generation(), 7);
  } finally {
    store.close();
  }
});

test('an interrupted read rejects instead of returning a partial list and preserves saved content', async () => {
  const factory = new IDBFactory(),
    name = 'listing-aborted',
    probe = observeReads(factory, name, (tx) => {
      queueMicrotask(() => tx.abort());
    }),
    store = await openWorldStore({ indexedDB: probe.indexedDB, name }),
    retained = [revision('a', 'a'), revision('b', 'b'), revision('c', 'c')];
  try {
    await seed(factory, name, { retained });
    await assert.rejects(store.list({ includeRevisions: true }), /abort/i);
    assert.equal(await store.generation(), 7);
  } finally {
    store.close();
  }
  const reopened = await openWorldStore({ indexedDB: factory, name });
  try {
    assert.equal((await reopened.list({ includeRevisions: true })).length, 3);
    assert.equal(
      await (await reopened.get('c', { sha256: sha('c') })).assets.get('0.bin').text(),
      'c-c-0',
    );
  } finally {
    reopened.close();
  }
});

test('version-one active-only stores still list and load after their normal upgrade', async () => {
  const indexedDB = new IDBFactory(),
    name = 'listing-v1',
    opening = indexedDB.open(name, 1),
    legacy = revision('legacy', 'a');
  opening.onupgradeneeded = () => {
    const db = opening.result;
    db.createObjectStore('projects', { keyPath: 'id' });
    db.createObjectStore('assets', { keyPath: ['projectId', 'path'] }).createIndex(
      'project',
      'projectId',
    );
    db.createObjectStore('meta');
  };
  const db = await request(opening),
    tx = db.transaction(['projects', 'assets', 'meta'], 'readwrite'),
    done = completed(tx),
    { assets, ...record } = legacy;
  tx.objectStore('projects').put(record);
  tx.objectStore('meta').put(7, 'generation');
  for (const [path, blob] of assets)
    tx.objectStore('assets').put({ projectId: legacy.id, path, blob });
  await done;
  db.close();
  const store = await openWorldStore({ indexedDB, name });
  try {
    assert.deepEqual(await store.list({ includeRevisions: true }), [{ ...record, active: true }]);
    assert.equal(await (await store.get(legacy.id)).assets.get('0.bin').text(), 'legacy-a-0');
    assert.equal(await store.generation(), 7);
  } finally {
    store.close();
  }
});
