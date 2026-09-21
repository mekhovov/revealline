import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourneyBackend, createJourneyProfileStore } from '../journey/profile.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

// Actual serialized finite transactions. Connection closure is explicit here;
// browser lifecycle/storage interruption remains a separate qualification gate.
function fixture() {
  const memory = managedIndexedDB();
  const connections = [],
    requests = [];
  const open = memory.indexedDB.open.bind(memory.indexedDB);
  memory.indexedDB.open = (...args) => {
    const request = open(...args);
    requests.push(request);
    let success;
    Object.defineProperty(request, 'onsuccess', {
      get: () => (event) => {
        connections.push(request.result);
        success?.(event);
      },
      set: (callback) => {
        success = callback;
      },
    });
    return request;
  };
  return { memory, connections, requests, backend: createJourneyBackend(memory) };
}

test('closed connection refuses the affected read once and a deliberate retry opens a fresh connection', async () => {
  const f = fixture();
  const original = await f.backend.read();
  f.connections[0].close();
  await assert.rejects(f.backend.read(), { name: 'InvalidStateError' });
  assert.equal(f.memory.openCount, 1, 'No automatic retry of the failed operation.');
  assert.deepEqual(await f.backend.read(), original);
  assert.equal(f.memory.openCount, 2);
  assert.equal(f.memory.allPuts.length, 0);
});

test('unexpected close invalidates the cache and a late retired close cannot invalidate its replacement', async () => {
  const f = fixture();
  const original = await f.backend.read();
  const old = f.connections[0];
  old.close();
  old.onclose?.();
  assert.deepEqual(await f.backend.read(), original);
  assert.equal(f.memory.openCount, 2);
  old.onclose?.();
  assert.deepEqual(await f.backend.read(), original);
  assert.equal(f.memory.openCount, 2);
});

const clear = {
  type: 'complete',
  mode: 'solo',
  missionId: 'official/base/first/one',
  runId: 'run-one',
  gameplayId: 'gameplay-one',
  difficulty: 'standard',
};

test('failed persistence retains a pending clear and explicit flush commits it once after reopening', async () => {
  const f = fixture();
  const store = createJourneyProfileStore({ backend: f.backend });
  await store.load();
  f.connections[0].close();
  store.record(clear);
  assert.equal(await store.flush(), false);
  assert.equal(store.status().pending, 1);
  assert.equal(store.status().durable, false);
  assert.equal(store.snapshot().clears.solo[clear.missionId].runId, clear.runId);
  assert.equal(f.memory.allPuts.length, 0);
  assert.equal(f.memory.openCount, 1);
  assert.equal(await store.flush(), true);
  assert.equal(f.memory.openCount, 2);
  assert.equal(f.memory.allPuts.length, 1);
  assert.equal(store.status().pending, 0);
  assert.equal(store.snapshot().generation, 1);
  assert.deepEqual(await f.backend.read(), store.snapshot());
});

test('a synchronous open refusal is not cached forever and a deliberate read may retry', async () => {
  const f = fixture();
  const open = f.memory.indexedDB.open;
  let attempts = 0;
  const refusal = new DOMException('Storage temporarily unavailable', 'SecurityError');
  f.memory.indexedDB.open = (...args) => {
    if (attempts++ === 0) throw refusal;
    return open(...args);
  };
  await assert.rejects(f.backend.read(), (error) => error === refusal);
  assert.equal(attempts, 1);
  assert.equal((await f.backend.read()).generation, 0);
  assert.equal(attempts, 2);
});

test('quota refusal retains the healthy connection and the pending event until an explicit retry', async () => {
  const f = fixture();
  const store = createJourneyProfileStore({ backend: f.backend });
  await store.load();
  f.memory.failAnyPutAt = 1;
  store.record(clear);
  assert.equal(await store.flush(), false);
  assert.equal(store.status().pending, 1);
  assert.equal(f.memory.openCount, 1);
  assert.equal(f.memory.closed, 0);
  f.memory.failAnyPutAt = null;
  assert.equal(await store.flush(), true);
  assert.equal(f.memory.openCount, 1);
  assert.equal(store.snapshot().generation, 1);
  assert.deepEqual(await f.backend.read(), store.snapshot());
});

test('a stale version-change callback closes only its original connection', async () => {
  const f = fixture();
  await f.backend.read();
  const old = f.connections[0];
  old.onversionchange();
  await f.backend.read();
  assert.equal(f.memory.openCount, 2);
  old.onversionchange();
  await f.backend.read();
  assert.equal(f.memory.openCount, 2);
  assert.equal(f.memory.closed, 1);
});

test('concurrent reads share one reopened connection without writing progress', async () => {
  const f = fixture();
  await f.backend.read();
  const old = f.connections[0];
  old.close();
  old.onclose();
  const rows = await Promise.all([f.backend.read(), f.backend.read(), f.backend.read()]);
  assert.equal(f.memory.openCount, 2);
  assert.deepEqual(rows[0], rows[1]);
  assert.deepEqual(rows[1], rows[2]);
  assert.equal(f.memory.allPuts.length, 0);
});

test('a blocked request and its late failure cannot poison the successful retry', async () => {
  const f = fixture();
  const first = f.backend.read();
  f.requests[0].onblocked();
  await assert.rejects(first, /Close an older Journey tab/);
  assert.equal((await f.backend.read()).generation, 0);
  assert.equal(f.memory.openCount, 2);
  assert.equal(f.memory.closed, 1, 'The blocked request closes its late successful connection.');
  f.requests[0].error = new DOMException('Retired request', 'AbortError');
  f.requests[0].onerror();
  assert.equal((await f.backend.read()).generation, 0);
  assert.equal(f.memory.openCount, 2, 'A late retired error cannot clear the current owner.');
});
