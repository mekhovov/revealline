import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createProfileRecordBackend } from '../profile-storage.mjs';
import { exactKeys, required } from '../data-json.mjs';

const { IDBFactory } = createRequire(
  new URL('../../authoring/fpv-worlds/package.json', import.meta.url),
)('fake-indexeddb');
const validate = (value) => {
  exactKeys(value, ['count'], 'Original test profile');
  required(Number.isSafeInteger(value.count) && value.count >= 0, 'Invalid test count');
  return structuredClone(value);
};
const receipt = (value) => {
  exactKeys(value, ['previous'], 'Test receipt');
  required(Number.isSafeInteger(value.previous) && value.previous >= 0, 'Invalid test receipt');
  return structuredClone(value);
};
const create = (indexedDB, options = {}) =>
  createProfileRecordBackend({
    key: 'receipt-test.v1',
    empty: () => ({ count: 0 }),
    validate,
    validateReceipt: receipt,
    indexedDB,
    ...options,
  });
const increment = (state) => ({
  state: { count: state.count + 1 },
  receipt: { previous: state.count },
});
const request = { id: 'attempt-1', input: { score: 7 } };

function controlledFactory(indexedDB) {
  const controls = { afterPut: null, beforeRead: null };
  return {
    controls,
    indexedDB: {
      open(...args) {
        const request = indexedDB.open(...args);
        request.addEventListener('success', () => {
          const db = request.result,
            transaction = db.transaction.bind(db);
          db.transaction = (...args) => {
            const tx = transaction(...args),
              objectStore = tx.objectStore.bind(tx);
            tx.objectStore = (name) => {
              const store = objectStore(name),
                put = store.put.bind(store),
                get = store.get.bind(store);
              store.put = (...args) => {
                const value = put(...args);
                controls.afterPut?.(tx, ...args);
                return value;
              };
              store.get = (...args) => {
                controls.beforeRead?.(tx, ...args);
                return get(...args);
              };
              return store;
            };
            return tx;
          };
        });
        return request;
      },
    },
  };
}

test('receipt and original schema commit atomically, deduplicate after reopen, and preserve old readers', async () => {
  const db = new IDBFactory();
  const first = create(db);
  assert.deepEqual(await first.updateOnce(request, increment), {
    state: { count: 1 },
    receipt: { previous: 0 },
    replayed: false,
  });
  first.close();
  const reopened = create(db),
    legacy = createProfileRecordBackend({
      key: 'receipt-test.v1',
      empty: () => ({ count: 0 }),
      validate,
      indexedDB: db,
    });
  try {
    assert.deepEqual(
      await reopened.updateOnce(request, () => assert.fail('duplicate cannot rerun updater')),
      { state: { count: 1 }, receipt: { previous: 0 }, replayed: true },
    );
    assert.deepEqual(await legacy.read(), { count: 1 });
    await legacy.update((state) => ({ count: state.count + 10 }));
    const duplicate = await reopened.updateOnce(request, increment);
    assert.deepEqual(duplicate, { state: { count: 11 }, receipt: { previous: 0 }, replayed: true });
    await assert.rejects(
      reopened.updateOnce({ ...request, input: { score: 8 } }, increment),
      /different result/,
    );
    assert.deepEqual(await legacy.read(), { count: 11 });
  } finally {
    reopened.close();
    legacy.close();
  }
});

test('simultaneous connections serialize duplicate ownership without double update', async () => {
  const db = new IDBFactory(),
    a = create(db),
    b = create(db);
  try {
    const saved = await Promise.all([
      a.updateOnce(request, increment),
      b.updateOnce(request, increment),
    ]);
    assert.equal(saved.filter(({ replayed }) => !replayed).length, 1);
    assert.deepEqual(await a.read(), { count: 1 });
    assert.deepEqual(
      saved.map(({ receipt }) => receipt),
      [{ previous: 0 }, { previous: 0 }],
    );
  } finally {
    a.close();
    b.close();
  }
});

for (const abortAt of [1, 2])
  test(`abort after queued put ${abortAt} rolls back both receipt and profile`, async () => {
    const db = new IDBFactory(),
      controlled = controlledFactory(db),
      store = create(controlled.indexedDB),
      reader = create(db);
    try {
      await store.updateOnce(request, increment);
      let puts = 0;
      controlled.controls.afterPut = (tx) => {
        if (++puts === abortAt) tx.abort();
      };
      await assert.rejects(store.updateOnce({ id: 'attempt-2', input: { score: 9 } }, increment));
      assert.equal(puts, abortAt);
      assert.deepEqual(await reader.read(), { count: 1 });
      assert.equal((await reader.updateOnce(request, increment)).replayed, true);
      controlled.controls.afterPut = null;
      assert.deepEqual(
        await store.updateOnce({ id: 'attempt-2', input: { score: 9 } }, increment),
        { state: { count: 2 }, receipt: { previous: 1 }, replayed: false },
      );
    } finally {
      store.close();
      reader.close();
    }
  });

test('cancellation, validation failure and a lost writer preserve both prior values', async () => {
  const db = new IDBFactory(),
    controlled = controlledFactory(db);
  let writable = true;
  const store = create(controlled.indexedDB, { canWrite: () => writable });
  try {
    await store.updateOnce(request, increment);
    await assert.rejects(
      store.updateOnce({ id: 'invalid', input: {} }, (state) => ({
        state,
        receipt: { previous: -1 },
      })),
      /Invalid test receipt/,
    );
    const cancel = new AbortController();
    controlled.controls.afterPut = () => cancel.abort(new Error('cancelled after put'));
    await assert.rejects(
      store.updateOnce({ id: 'cancel', input: {} }, increment, { signal: cancel.signal }),
      /cancelled/,
    );
    controlled.controls.afterPut = null;
    controlled.controls.beforeRead = () => {
      writable = false;
    };
    await assert.rejects(store.updateOnce({ id: 'lease-lost', input: {} }, increment), /lease/);
    controlled.controls.beforeRead = null;
    writable = true;
    assert.deepEqual(await store.read(), { count: 1 });
    assert.equal((await store.updateOnce(request, increment)).replayed, true);
  } finally {
    store.close();
  }
});
