import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createCombatAutosaveStore } from '../../optional-practice/civilian-fpv/world-app.mjs';

const requireAuthoring = createRequire(
  new URL('../../authoring/fpv-worlds/package.json', import.meta.url),
);
const { IDBFactory, IDBObjectStore } = requireAuthoring('fake-indexeddb');
const key = 'revealline.fpv.combat-recovery.v1';
const saved = (tick, size = 0) => ({
  gameplay: { tick },
  presentation: { records: [{ details: 'x'.repeat(size) }] },
});
const validate = (value) => assert.ok(Number.isInteger(value?.gameplay?.tick), 'Invalid recovery');
function local(limit = Infinity, blocked = false) {
  const values = new Map();
  return {
    values,
    getItem(key) {
      if (blocked) throw new Error('Browser preferences are blocked');
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (blocked) throw new Error('Browser preferences are blocked');
      if (value.length > limit) {
        const error = new Error('Quota exceeded');
        error.name = 'QuotaExceededError';
        throw error;
      }
      values.set(key, value);
    },
  };
}

test('Complete large combat recovery survives IndexedDB fallback and a fresh host', async () => {
  const indexedDB = new IDBFactory(),
    storage = local(1024);
  const first = createCombatAutosaveStore({ indexedDB, storage, validate });
  const recovery = saved(42134, 7180019);
  assert.equal((await first.save(recovery)).backend, 'indexedDB');
  assert.equal(JSON.parse(storage.getItem(key)).format, 'FPVCombatAutosavePointer.v1');
  await first.close();
  const second = createCombatAutosaveStore({ indexedDB, storage, validate });
  assert.deepEqual(await second.read(), recovery, 'No cosmetic record was dropped');
  await second.close();
});

test('Continue discovers full IndexedDB recovery without a writable or readable pointer', async () => {
  const indexedDB = new IDBFactory(),
    storage = local(0, true);
  const first = createCombatAutosaveStore({ indexedDB, storage, validate });
  await first.save(saved(73, 1000));
  await first.close();
  const second = createCombatAutosaveStore({ indexedDB, storage, validate });
  assert.deepEqual(await second.read(), saved(73, 1000));
  await second.close();
});

test('Continue selects a newer valid local recovery over the old IndexedDB record', async () => {
  const indexedDB = new IDBFactory(),
    storage = local(1024);
  const store = createCombatAutosaveStore({ indexedDB, storage, validate, now: () => 100 });
  await store.save(saved(1, 2000));
  await store.save(saved(2));
  assert.equal((await store.read()).gameplay.tick, 2);
  const record = JSON.parse(storage.getItem(key));
  record.recovery.gameplay.tick = 'corrupt';
  storage.setItem(key, JSON.stringify(record));
  assert.equal(
    (await store.read()).gameplay.tick,
    1,
    'An invalid newer copy does not hide the previous valid recovery',
  );
  await store.close();
});

test('Legacy raw local combat recovery stays compatible', async () => {
  const storage = local();
  storage.setItem(key, JSON.stringify(saved(19)));
  const store = createCombatAutosaveStore({ indexedDB: new IDBFactory(), storage, validate });
  assert.deepEqual(await store.read(), saved(19));
  await store.close();
});

test('Older asynchronous pause exports cannot replace a newer requested save', async () => {
  const store = createCombatAutosaveStore({
    indexedDB: new IDBFactory(),
    storage: local(),
    validate,
  });
  const older = store.reserve(),
    newer = store.reserve();
  await store.save(saved(80), newer);
  assert.deepEqual(await store.save(saved(20), older), { skipped: true });
  assert.equal((await store.read()).gameplay.tick, 80);
  await store.close();
});

test('Failed IndexedDB transaction preserves the previous complete recovery', async () => {
  const store = createCombatAutosaveStore({
    indexedDB: new IDBFactory(),
    storage: local(0),
    validate,
  });
  await store.save(saved(12, 2000));
  const original = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function () {
    throw new Error('Database quota exhausted');
  };
  try {
    await assert.rejects(store.save(saved(50, 3000)), /quota exhausted/);
  } finally {
    IDBObjectStore.prototype.put = original;
  }
  assert.deepEqual(await store.read(), saved(12, 2000));
  await store.close();
});

test('Both unavailable backends report failure and closing waits for committed writes', async () => {
  const unavailable = createCombatAutosaveStore({ storage: local(0, true), validate });
  await assert.rejects(unavailable.save(saved(1)), /unavailable/);
  await unavailable.close();
  const indexedDB = new IDBFactory(),
    storage = local(0);
  const store = createCombatAutosaveStore({ indexedDB, storage, validate });
  const saving = store.save(saved(99, 2000));
  await store.close();
  assert.equal((await saving).backend, 'indexedDB');
  const reader = createCombatAutosaveStore({ indexedDB, storage, validate });
  assert.deepEqual(await reader.read(), saved(99, 2000));
  await reader.close();
});

test('Unavailable reads report failure while two empty readable stores report no recovery', async () => {
  const blocked = createCombatAutosaveStore({ storage: local(0, true), validate });
  await assert.rejects(blocked.read(), /unavailable/);
  await blocked.close();
  const empty = createCombatAutosaveStore({
    indexedDB: new IDBFactory(),
    storage: local(),
    validate,
  });
  assert.equal(await empty.read(), null);
  await empty.close();
});

test('A successful put request followed by transaction abort is not a successful autosave', async () => {
  const store = createCombatAutosaveStore({
    indexedDB: new IDBFactory(),
    storage: local(0),
    validate,
  });
  await store.save(saved(12, 2000));
  const original = IDBObjectStore.prototype.put;
  let requestSucceeded = false;
  IDBObjectStore.prototype.put = function (...args) {
    const request = original.apply(this, args);
    request.addEventListener('success', () => {
      requestSucceeded = true;
      this.transaction.abort();
    });
    return request;
  };
  try {
    await assert.rejects(store.save(saved(50, 3000)), /storage failed/);
    assert.equal(requestSucceeded, true);
  } finally {
    IDBObjectStore.prototype.put = original;
  }
  assert.deepEqual(await store.read(), saved(12, 2000));
  await store.close();
});

test('Invalid recovery and forged future metadata cannot poison the next valid save clock', async () => {
  const storage = local(),
    store = createCombatAutosaveStore({
      indexedDB: new IDBFactory(),
      storage,
      validate,
      now: () => 1000,
    });
  for (const record of [
    { format: 'FPVCombatAutosave.v1', savedAt: 5000, recovery: { invalid: true } },
    { format: 'FPVCombatAutosave.v1', savedAt: Number.MAX_SAFE_INTEGER, recovery: saved(1) },
  ]) {
    storage.setItem(key, JSON.stringify(record));
    await store.save(saved(20));
    const next = JSON.parse(storage.getItem(key));
    assert.ok(Number.isSafeInteger(next.savedAt));
    assert.ok(next.savedAt < 5000);
    assert.equal((await store.read()).gameplay.tick, 20);
  }
  await assert.rejects(store.save({ invalid: true }), /Invalid recovery/);
  assert.equal((await store.read()).gameplay.tick, 20);
  await store.close();
});

test('Version change releases the cached connection and the next operation opens again', async () => {
  const factory = new IDBFactory();
  let connection,
    opened = 0;
  const indexedDB = {
    open(...args) {
      opened++;
      const request = factory.open(...args);
      request.addEventListener('success', () => {
        connection = request.result;
      });
      return request;
    },
  };
  const store = createCombatAutosaveStore({ indexedDB, storage: local(0), validate });
  await store.save(saved(1));
  connection.onversionchange();
  assert.equal((await store.read()).gameplay.tick, 1);
  assert.equal(opened, 2);
  await store.close();
});

test('A late successful blocked open is closed and does not replace a later connection', async () => {
  const factory = new IDBFactory();
  let blocked,
    closed = 0,
    opened = 0;
  const indexedDB = {
    open(...args) {
      if (++opened > 1) return factory.open(...args);
      blocked = {};
      queueMicrotask(() => blocked.onblocked());
      return blocked;
    },
  };
  const store = createCombatAutosaveStore({ indexedDB, storage: local(), validate });
  await assert.rejects(store.read(), /blocked/);
  assert.equal(await store.read(), null);
  blocked.result = {
    close() {
      closed++;
    },
  };
  blocked.onsuccess();
  assert.equal(closed, 1);
  assert.equal(await store.read(), null);
  assert.equal(opened, 2);
  await store.close();
});
