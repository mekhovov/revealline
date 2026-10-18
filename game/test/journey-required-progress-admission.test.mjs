import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createJourneyProfileStore, createJourneyBackend } from '../journey/profile.mjs';

// Existing finite native-transaction model, with only request delivery held.
// Pending requests still prevent transaction completion, as in the original.
const source = await readFile(
  new URL(`${process.cwd()}/game/test/helpers/managed-idb.mjs`, 'file:'),
  'utf8',
);
const needle = 'queueMicrotask(() => {\n          if (finished) return;';
assert.equal(source.split(needle).length, 2);
const { managedIndexedDB } = await import(
  `data:text/javascript;base64,${Buffer.from(source.replace(needle, '(api.scheduleRequest ?? queueMicrotask)(() => {\n          if (finished) return;')).toString('base64')}`
);
const turn = () => new Promise((resolve) => setImmediate(resolve));
async function until(predicate) {
  for (let n = 0; n < 100 && !predicate(); n++) await turn();
  assert(predicate());
}
function model(t) {
  const db = managedIndexedDB(),
    old = globalThis.indexedDB;
  globalThis.indexedDB = db.indexedDB;
  t.after(() => {
    globalThis.indexedDB = old;
  });
  let playing = false,
    held = false;
  const callbacks = [];
  db.scheduleRequest = (fn) => (held ? callbacks.push(fn) : queueMicrotask(fn));
  return {
    db,
    callbacks,
    phase(value) {
      playing = value;
    },
    hold(value = true) {
      held = value;
    },
    release() {
      held = false;
      for (const fn of callbacks.splice(0)) queueMicrotask(fn);
    },
    store(extra = {}) {
      return createJourneyProfileStore({ canRunProgressWork: () => !playing, ...extra });
    },
  };
}
const event = (id) => ({ type: 'select', mode: 'solo', missionId: id });

test('required delayed loaded callbacks abort before profile validation when play begins', async (t) => {
  const f = model(t),
    store = f.store();
  await store.load();
  f.hold();
  store.record(event('first'));
  const result = store.flush();
  await until(() => f.callbacks.length > 0);
  f.phase(true);
  f.release();
  assert.equal(await result, false);
  assert.equal(store.status().pending, 1);
  assert.match(store.status().error, /paused/);
  assert.equal(f.db.allPuts.length, 0);
  f.phase(false);
  assert.equal(await store.flush(), true);
  assert.equal((await createJourneyBackend(f.db).read()).cursors.solo, 'first');
});

test('required timeout aborts held native reads; late delivery cannot validate or save after play', async (t) => {
  const f = model(t),
    store = f.store({ operationTimeoutMs: 10 });
  await store.load();
  f.hold();
  store.record(event('timeout'));
  assert.equal(await store.flush(), false);
  assert.match(store.status().error, /time|long/i);
  const before = f.db.allPuts.length;
  f.phase(true);
  f.release();
  await turn();
  await turn();
  assert.equal(f.db.allPuts.length, before);
  assert.equal(store.status().pending, 1);
  assert.equal(store.status().durable, false);
  f.phase(false);
  assert.equal(await store.flush(), true);
  assert.equal((await createJourneyBackend(f.db).read()).cursors.solo, 'timeout');
});

test('confirmed commit removes only its exact prefix before phase-deferred rebase', async (t) => {
  const f = model(t),
    store = f.store({ schedulePerformanceChunk: () => new Promise(() => {}) });
  await store.load();
  let appended = false;
  f.db.onAnyPut = () => {
    if (!appended) {
      appended = true;
      store.record(event('second'));
    }
  };
  f.db.afterAnyCommit = () => f.phase(true);
  store.record(event('first'));
  assert.equal(await store.flush(), false);
  assert.equal(store.status().pending, 1, 'The confirmed first event is not claimed rolled back.');
  assert.equal(store.snapshot().cursors.solo, 'second');
  const backend = createJourneyBackend(f.db);
  assert.equal((await backend.read()).cursors.solo, 'first');
  f.db.afterAnyCommit = null;
  f.phase(false);
  assert.equal(await store.flush(), true);
  const disk = await backend.read();
  assert.equal(disk.cursors.solo, 'second');
  assert.equal(disk.generation, 2);
});

test('a commit already completed at timeout stays durable on disk without a rollback claim', async (t) => {
  const f = model(t),
    store = f.store({ operationTimeoutMs: 10 });
  await store.load();
  const oldOpen = f.db.indexedDB.open;
  // Delay only terminal delivery: the transaction has already committed.
  // A separate store opens a new connection using this wrapper.
  let terminal;
  f.db.indexedDB.open = (...args) => {
    const request = oldOpen(...args);
    let success;
    Object.defineProperty(request, 'onsuccess', {
      set(fn) {
        success = fn;
      },
      get() {
        return () => {
          const db = request.result,
            transaction = db.transaction.bind(db);
          db.transaction = (...args) => {
            const tx = transaction(...args);
            let complete;
            Object.defineProperty(tx, 'oncomplete', {
              set(fn) {
                complete = fn;
              },
              get() {
                return () => {
                  if (args[1] === 'readwrite') terminal = complete;
                  else complete?.();
                };
              },
            });
            return tx;
          };
          success?.();
        };
      },
    });
    return request;
  };
  const delayed = f.store({ operationTimeoutMs: 10 });
  await delayed.load();
  delayed.record(event('committed'));
  assert.equal(await delayed.flush(), false);
  assert.equal(typeof terminal, 'function');
  f.phase(true);
  terminal();
  await turn();
  assert.equal(
    delayed.status().durable,
    false,
    'Unconfirmed save does not fabricate confirmation.',
  );
  assert.equal(delayed.status().pending, 1);
  assert.equal((await createJourneyBackend(f.db).read()).cursors.solo, 'committed');
});

test('the default public backend and store keep ordinary ungated required save behavior', async (t) => {
  const f = model(t),
    store = createJourneyProfileStore();
  await store.load();
  f.phase(true);
  store.record(event('default'));
  assert.equal(await store.flush(), true);
  assert.equal(store.status().pending, 0);
});

test('an active flush returns pending failure without poisoning the later paused queue', async (t) => {
  const f = model(t),
    store = f.store();
  await store.load();
  f.phase(true);
  store.record(event('queued'));
  assert.equal(await store.flush(), false);
  assert.equal(store.status().pending, 1);
  f.phase(false);
  assert.equal(await store.flush(), true);
  assert.equal(store.status().pending, 0);
});

test('invalid injected commit results retain pending events and a later valid result can retry', async (t) => {
  const f = model(t),
    native = createJourneyBackend(f.db);
  let invalid = true;
  const store = createJourneyProfileStore({
    backend: {
      readState: () => native.readState(),
      commitState: async (events) => {
        const saved = await native.commitState(events);
        return invalid ? { ...saved, profile: { invalid: true } } : saved;
      },
    },
  });
  await store.load();
  store.record(event('injected'));
  assert.equal(await store.flush(), false);
  assert.equal(store.status().pending, 1);
  invalid = false;
  assert.equal(await store.flush(), true);
  assert.equal(store.status().pending, 0);
  assert.equal(store.snapshot().cursors.solo, 'injected');
});
test('an injected result arriving during play remains unconfirmed and does not publish or consume pending', async (t) => {
  const f = model(t),
    native = createJourneyBackend(f.db);
  let playing = false;
  const store = createJourneyProfileStore({
    canRunProgressWork: () => !playing,
    backend: {
      readState: () => native.readState(),
      commitState: async (events) => {
        const saved = await native.commitState(events);
        playing = true;
        return saved;
      },
    },
  });
  await store.load();
  store.record(event('unconfirmed'));
  assert.equal(await store.flush(), false);
  assert.equal(store.status().pending, 1);
  assert.match(store.status().error, /paused/);
});

test('a database opened after play begins cannot start a required transaction', async (t) => {
  const f = model(t),
    open = f.db.indexedDB.open;
  let deliver,
    transactions = 0;
  f.db.indexedDB.open = (...args) => {
    const request = open(...args);
    let success;
    Object.defineProperty(request, 'onsuccess', {
      set(fn) {
        success = fn;
      },
      get() {
        return () => {
          const db = request.result,
            transaction = db.transaction.bind(db);
          db.transaction = (...args) => {
            transactions++;
            return transaction(...args);
          };
          deliver = () => success?.();
        };
      },
    });
    return request;
  };
  const store = f.store(),
    loading = store.load();
  await until(() => deliver);
  f.phase(true);
  deliver();
  await loading;
  assert.equal(transactions, 0);
  assert.equal(store.status().durable, false);
  assert.match(store.status().error, /paused/);
  f.phase(false);
  assert.equal(await store.flush(), true);
  assert.equal(transactions, 1);
});
