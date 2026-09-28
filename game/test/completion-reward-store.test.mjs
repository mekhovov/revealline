import test from 'node:test';
import assert from 'node:assert/strict';
import { createRewardBackend, createRewardStore } from '../rewards/store.mjs';
import { createRewardState } from '../rewards/model.mjs';
import { JOURNEY_PROFILE_DATABASE } from '../journey/profile.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const editionId = 'workshop-edition';
function definition(id = 'first', missionId = 'mission-1') {
  return {
    format: 'revealline-completion-reward.v1',
    id,
    revision: 'r1',
    brandId: 'workshop-brand',
    campaignId: 'workshop',
    scope: { kind: 'mission', id: missionId },
    locales: {
      en: { title: 'Discovery', teaser: 'Win to discover.' },
      uk: { title: 'Відкриття', teaser: 'Переможіть, щоб відкрити.' },
    },
    requirements: {
      missions: [
        { missionId, bindings: [{ gameplayId: `${missionId}-gameplay`, difficulty: 'normal' }] },
      ],
      learning: [],
      mastery: [],
    },
    payloads: [
      {
        id: 'knowledge',
        type: 'knowledge',
        locales: {
          en: { title: 'Discovery', paragraphs: ['A useful discovery.'] },
          uk: { title: 'Відкриття', paragraphs: ['Корисне відкриття.'] },
        },
      },
    ],
  };
}
function context(missions = ['mission-1', 'mission-2']) {
  return {
    editionId,
    brandId: 'workshop-brand',
    campaignIds: ['workshop'],
    clears: Object.fromEntries(
      missions.map((missionId) => [
        missionId,
        { runId: `${missionId}-run`, gameplayId: `${missionId}-gameplay`, difficulty: 'normal' },
      ]),
    ),
    learning: [],
    mastery: [],
  };
}
const backendFor = (memory, options = {}) =>
  createRewardBackend({ editionId, indexedDB: memory.indexedDB, ...options });

test('session-only verified learning cannot leak into a later arcade save, flush or reload', async () => {
  const memory = managedIndexedDB(),
    backend = backendFor(memory),
    store = createRewardStore({ editionId, backend }),
    bonus = definition('learning-bonus'),
    arcade = definition('next-win', 'mission-2');
  const requirement = {
    lessonId: 'lesson-one',
    lessonRevision: '1',
    fixtureRevision: '1',
    lessonIdentity: '1234567890abcdef',
    missionId: 'mission-1',
  };
  bonus.requirements.learning = [requirement];
  const session = context();
  session.learning = [{ ...requirement, attemptId: 'verified-attempt' }];
  const durable = context();
  await store.load();
  store.reconcile([bonus], session, { persistenceContext: durable });
  await store.settled();
  assert.equal(store.snapshot().receipts.length, 1);
  assert.equal((await backend.read()).receipts.length, 0);
  store.reconcile([bonus, arcade], session, { persistenceContext: durable });
  await store.flush();
  await store.load();
  assert.deepEqual(
    (await backend.read()).receipts.map((r) => r.definition.id),
    ['next-win'],
  );
  assert.equal(store.status().durable, false);
  assert.equal(store.snapshot().receipts.length, 2);
  store.reconcile([bonus, arcade], session, { persistenceContext: session });
  await store.settled();
  assert.equal((await backend.read()).receipts.length, 2);
  assert.equal(store.status().durable, true);
  assert.equal(
    store.snapshot().receipts.find((r) => r.definition.id === bonus.id).evidence.learning[0]
      .attemptId,
    'verified-attempt',
  );
  await store.close();
});

async function putRaw(memory, key, value) {
  const db = await new Promise((resolve, reject) => {
    const request = memory.indexedDB.open(JOURNEY_PROFILE_DATABASE, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('profiles', 'readwrite');
      transaction.objectStore('profiles').put(value, key);
      transaction.oncomplete = resolve;
      transaction.onabort = transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

test('two tab transactions merge accepted rewards without replacing each other', async () => {
  const memory = managedIndexedDB();
  const first = createRewardStore({ editionId, backend: backendFor(memory) });
  const second = createRewardStore({ editionId, backend: backendFor(memory) });
  await Promise.all([first.load(), second.load()]);
  first.reconcile([definition()], context());
  second.reconcile([definition('second', 'mission-2')], context());
  await Promise.all([first.settled(), second.settled()]);
  const stored = await backendFor(memory).read();
  assert.deepEqual(stored.receipts.map((item) => item.definition.id).sort(), ['first', 'second']);
  assert.equal(first.status().durable, true);
  assert.equal(second.status().durable, true);
  await first.load();
  assert.equal(first.snapshot().receipts.length, 2);
  assert(
    memory.allPuts.every(
      ([store, key]) => store === 'profiles' && key === `journey-${editionId}:rewards.v1`,
    ),
  );
});

test('quota failure keeps playable session rewards and a successful retry makes them durable', async () => {
  const memory = managedIndexedDB();
  const store = createRewardStore({ editionId, backend: backendFor(memory) });
  await store.load();
  memory.failAnyPutAt = 1;
  const result = store.reconcile([definition()], context());
  assert.equal(result.granted.length, 1);
  await store.settled();
  assert.equal(store.status().durable, false);
  assert.match(store.status().error, /storage write failure/);
  assert.equal(store.snapshot().receipts.length, 1);
  assert.equal((await backendFor(memory).read()).receipts.length, 0);
  memory.failAnyPutAt = null;
  await store.flush();
  assert.equal(store.status().durable, true);
  assert.equal(store.status().error, null);
  assert.equal((await backendFor(memory).read()).receipts.length, 1);
});

test('session-only evidence cannot be saved by flush, reload or an unrelated durable win', async () => {
  const memory = managedIndexedDB();
  const store = createRewardStore({ editionId, backend: backendFor(memory) });
  await store.load();
  store.reconcile([definition()], context(['mission-1']), { persist: false });
  await store.flush();
  await store.load();
  assert.equal(store.status().durable, false);
  assert.equal(store.snapshot().receipts.length, 1);
  assert.equal((await backendFor(memory).read()).receipts.length, 0);
  store.reconcile([definition('second', 'mission-2')], context(['mission-2']));
  await store.settled();
  assert.deepEqual(
    (await backendFor(memory).read()).receipts.map((item) => item.definition.id),
    ['second'],
  );
  assert.equal(store.status().durable, false);
  // The host now confirms that the first mission clear itself was saved.
  store.reconcile([definition()], context());
  await store.settled();
  assert.equal(store.status().durable, true);
  assert.equal((await backendFor(memory).read()).receipts.length, 2);
});

test('corrupt disk data is reported and never overwritten by a session reward', async () => {
  const memory = managedIndexedDB(),
    backend = backendFor(memory);
  await backend.read();
  const corrupt = { format: 'unexpected-format', doNotOverwrite: true };
  await putRaw(memory, backend.key, corrupt);
  const store = createRewardStore({ editionId, backend });
  await store.load();
  assert.equal(store.status().durable, false);
  store.reconcile([definition()], context());
  await store.settled();
  assert.equal(store.snapshot().receipts.length, 1);
  assert.deepEqual(memory.contents().get('profiles').get(backend.key), corrupt);
  assert.equal(memory.allPuts.length, 1);
});

test('backup restore stays edition-specific and preserves first-earned revisions', async () => {
  const memory = managedIndexedDB();
  const store = createRewardStore({ editionId, backend: backendFor(memory) });
  await store.load();
  store.reconcile([definition()], context());
  await store.settled();
  const exported = store.export();
  const freshMemory = managedIndexedDB();
  const restored = createRewardStore({ editionId, backend: backendFor(freshMemory) });
  await restored.restore(exported);
  assert.deepEqual(restored.snapshot(), store.snapshot());
  const changed = definition();
  changed.revision = 'r2';
  restored.reconcile([changed], context());
  await restored.settled();
  assert.equal(restored.snapshot().receipts[0].definition.revision, 'r1');
  const before = restored.export();
  await assert.rejects(restored.restore(createRewardState('other-edition')), /another edition/);
  assert.equal(restored.export(), before);
});

test('write-lease loss leaves rewards in memory without writing an arcade profile', async () => {
  const memory = managedIndexedDB();
  let owned = true;
  const store = createRewardStore({
    editionId,
    backend: backendFor(memory, { canWrite: () => owned }),
  });
  await store.load();
  owned = false;
  store.reconcile([definition()], context());
  await store.settled();
  assert.equal(store.status().durable, false);
  assert.match(store.status().error, /saving lease/);
  assert.equal(store.snapshot().receipts.length, 1);
  assert.equal(memory.allPuts.length, 0);
  owned = true;
  await store.flush();
  assert.equal(store.status().durable, true);
});

test('restoring a later reward revision does not replace a session promise or persist its unverified win', async () => {
  const memory = managedIndexedDB();
  const store = createRewardStore({ editionId, backend: backendFor(memory) });
  await store.load();
  store.reconcile([definition()], context(), { persist: false });
  const imported = createRewardStore({ editionId, backend: backendFor(managedIndexedDB()) });
  const revisionTwo = definition();
  revisionTwo.revision = 'r2';
  imported.reconcile([revisionTwo], context());
  await imported.settled();
  await store.restore(imported.export());
  assert.equal(store.snapshot().promises[0].revision, 'r1');
  assert.equal(store.snapshot().receipts[0].definition.revision, 'r1');
  const stored = await backendFor(memory).read();
  assert.equal(stored.promises[0].revision, 'r1');
  assert.equal(stored.receipts.length, 0);
  assert.equal(store.status().durable, false);
});

test('blocked open retries and closes a late successful connection from the rejected attempt', async () => {
  const memory = managedIndexedDB(),
    blocked = {};
  let attempts = 0,
    lateCloses = 0;
  const indexedDB = {
    open(...args) {
      return ++attempts === 1 ? blocked : memory.indexedDB.open(...args);
    },
  };
  const backend = createRewardBackend({ editionId, indexedDB });
  const firstRead = backend.read();
  await Promise.resolve();
  blocked.onblocked();
  await assert.rejects(firstRead, /busy in another tab/);
  const retry = backend.read();
  blocked.result = {
    close() {
      lateCloses++;
    },
  };
  blocked.onsuccess();
  assert.equal((await retry).editionId, editionId);
  assert.equal(lateCloses, 1);
  await backend.read();
  assert.equal(attempts, 2);
});

test('storage observers cannot poison the save queue and missing storage remains session-only', async () => {
  const memory = managedIndexedDB();
  const store = createRewardStore({
    editionId,
    backend: backendFor(memory),
    onStatus() {
      throw new Error('View failed');
    },
  });
  await store.load();
  store.reconcile([definition()], context());
  await store.settled();
  await store.flush();
  assert.equal(store.status().durable, true);
  const unavailable = createRewardStore({
    editionId,
    backend: createRewardBackend({ editionId, indexedDB: null }),
  });
  await unavailable.load();
  unavailable.reconcile([definition()], context());
  await unavailable.settled();
  assert.equal(unavailable.snapshot().receipts.length, 1);
  assert.equal(unavailable.status().durable, false);
  assert.match(unavailable.status().error, /unavailable/);
});

test('closing waits for queued writes and twenty edition visits release every database connection', async () => {
  const memory = managedIndexedDB();
  for (let visit = 0; visit < 20; visit++) {
    const backend = backendFor(memory);
    const store = createRewardStore({ editionId, backend });
    await store.load();
    store.reconcile([definition()], context());
    const closing = store.close();
    assert.equal(store.close(), closing);
    await closing;
    assert.equal(store.status().durable, true);
    assert.equal(memory.closed, visit + 1);
    assert.equal(memory.openCount, visit + 1);
    assert.throws(() => store.reconcile([definition()], context()), /closed/);
    assert.throws(() => store.flush(), /closed/);
    await assert.rejects(backend.read(), /closed/);
  }
  const stored = memory.contents().get('profiles').get(`journey-${editionId}:rewards.v1`);
  assert.equal(stored.receipts.length, 1);
});

test('backend disposal rejects a pending open and closes its late success without reopening', async () => {
  const request = {};
  let closes = 0,
    opens = 0;
  const backend = createRewardBackend({
    editionId,
    indexedDB: {
      open() {
        opens++;
        return request;
      },
    },
  });
  const reading = backend.read();
  await Promise.resolve();
  backend.close();
  await assert.rejects(reading, /closed/);
  request.result = {
    close() {
      closes++;
    },
  };
  request.onsuccess();
  backend.close();
  await assert.rejects(backend.read(), /closed/);
  assert.equal(closes, 1);
  assert.equal(opens, 1);
});

test('a stalled store read times out without blocking session rewards or later successful saves', async () => {
  let saved = createRewardState(editionId),
    readSignal;
  const backend = {
    read({ signal }) {
      readSignal = signal;
      return new Promise(() => {});
    },
    async update(change) {
      saved = change(saved);
      return saved;
    },
  };
  const store = createRewardStore({ editionId, backend, operationTimeoutMs: 10 });
  await store.load();
  assert.equal(readSignal.aborted, true);
  assert.match(store.status().error, /timed out/);
  store.reconcile([definition()], context());
  assert.equal(store.snapshot().receipts.length, 1);
  await store.settled();
  assert.equal(store.status().durable, true);
  assert.equal(saved.receipts.length, 1);
  await store.close();
});

test('a stalled store update preserves the session, rejects late mutation and allows the queue to recover', async () => {
  let saved = createRewardState(editionId),
    delayedUpdate,
    updateSignal,
    hanging = true,
    closes = 0;
  const backend = {
    async read() {
      return saved;
    },
    update(change, { signal }) {
      if (!hanging) {
        saved = change(saved);
        return Promise.resolve(saved);
      }
      delayedUpdate = change;
      updateSignal = signal;
      return new Promise(() => {});
    },
    close() {
      closes++;
    },
  };
  const store = createRewardStore({ editionId, backend, operationTimeoutMs: 10 });
  await store.load();
  store.reconcile([definition()], context());
  await store.settled();
  assert.equal(updateSignal.aborted, true);
  assert.match(store.status().error, /timed out/);
  assert.equal(store.snapshot().receipts.length, 1);
  assert.equal(saved.receipts.length, 0);
  assert.throws(() => delayedUpdate(saved), /timed out/);
  hanging = false;
  await store.flush();
  assert.equal(store.status().durable, true);
  assert.equal(saved.receipts.length, 1);
  await store.close();
  assert.equal(closes, 1);
});

test('closing a store during a stalled save is bounded and retains its session receipt', async () => {
  let closes = 0;
  const store = createRewardStore({
    editionId,
    operationTimeoutMs: 10,
    backend: {
      read: async () => createRewardState(editionId),
      update: () => new Promise(() => {}),
      close() {
        closes++;
      },
    },
  });
  await store.load();
  store.reconcile([definition()], context());
  await store.close();
  assert.equal(closes, 1);
  assert.equal(store.snapshot().receipts.length, 1);
  assert.equal(store.status().durable, false);
  assert.match(store.status().error, /timed out/);
});

test('a timed-out IndexedDB open retries and closes late success', async () => {
  const memory = managedIndexedDB(),
    pending = {};
  let opens = 0,
    lateCloses = 0;
  const backend = createRewardBackend({
    editionId,
    operationTimeoutMs: 10,
    indexedDB: {
      open(...args) {
        return ++opens === 1 ? pending : memory.indexedDB.open(...args);
      },
    },
  });
  await assert.rejects(backend.read(), /timed out/);
  assert.equal((await backend.read()).editionId, editionId);
  pending.result = {
    close() {
      lateCloses++;
    },
  };
  pending.onsuccess();
  assert.equal(lateCloses, 1);
  backend.close();
});

test('IndexedDB timeout aborts the transaction and a late read callback cannot write', async () => {
  let read,
    tx,
    writes = 0;
  const db = {
    close() {},
    transaction() {
      tx = {
        aborted: false,
        abort() {
          this.aborted = true;
          queueMicrotask(() => this.onabort?.());
        },
        objectStore() {
          return {
            get() {
              read = {};
              return read;
            },
            put() {
              writes++;
            },
          };
        },
      };
      return tx;
    },
  };
  const indexedDB = {
    open() {
      const request = { result: db };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
  const backend = createRewardBackend({ editionId, indexedDB, operationTimeoutMs: 10 });
  await assert.rejects(
    backend.update((value) => value),
    /timed out/,
  );
  assert.equal(tx.aborted, true);
  read.result = createRewardState(editionId);
  read.onsuccess();
  assert.equal(writes, 0);
  backend.close();
});
