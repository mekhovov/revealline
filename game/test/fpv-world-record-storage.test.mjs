import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  WORLD_RECORD_LIMITS,
  openWorldRecords,
} from '../../optional-practice/civilian-fpv/world-records.mjs';

const { IDBFactory } = createRequire(
  new URL('../../authoring/fpv-worlds/package.json', import.meta.url),
)('fake-indexeddb');
// Opaque storage-boundary data only: these fixtures are not flight proofs and
// claim no lesson progress. Actual published-proof compatibility is tested apart.
const raw = (id = 0, extra = {}) => ({
  course: { id: `storage-only-${id}` },
  proof: { raw: id },
  packIdentity: 'unavailable-exact-revision',
  ...extra,
});
async function fixture() {
  const indexedDB = new IDBFactory();
  const a = await openWorldRecords(indexedDB),
    b = await openWorldRecords(indexedDB);
  return {
    indexedDB,
    a,
    b,
    close: () => {
      a.close();
      b.close();
    },
  };
}

test('duplicate saves retain one identity, existing pins and unrelated recordings', async () => {
  const f = await fixture();
  try {
    const saved = await f.a.put(raw(1, { pinned: true }));
    const other = await f.a.put(raw(2));
    const updated = await f.b.put(raw(1, { status: 'invalid', diagnostic: 'Replay rejected' }));
    assert.equal(updated.id, saved.id);
    assert.equal(updated.pinned, true);
    const records = await f.a.list();
    assert.equal(records.length, 2);
    assert.deepEqual(
      records.find(({ id }) => id === other.id),
      other,
    );
    assert.deepEqual(
      records.find(({ id }) => id === saved.id),
      updated,
    );
    const explicit = await f.a.put(raw(1, { pinned: false }));
    assert.equal(explicit.pinned, false);
    assert.equal(explicit.id, saved.id);
  } finally {
    f.close();
  }
});

test('concurrent duplicate and distinct writes do not lose or duplicate unrelated recordings', async () => {
  const f = await fixture();
  try {
    const results = await Promise.all([
      f.a.put(raw(1, { pinned: true })),
      f.b.put(raw(1, { diagnostic: 'Second connection' })),
      f.a.put(raw(2)),
      f.b.put(raw(3)),
    ]);
    assert.equal(results[0].id, results[1].id);
    const records = await f.b.list();
    assert.equal(records.length, 3);
    assert.equal(new Set(records.map(({ id }) => id)).size, 3);
    assert.equal(records.find(({ id }) => id === results[0].id).pinned, true);
    assert.deepEqual(records.map(({ course }) => course.id).sort(), [
      'storage-only-1',
      'storage-only-2',
      'storage-only-3',
    ]);
  } finally {
    f.close();
  }
});

test('a pinned deletion aborts atomically and unpinning is required before removal', async () => {
  const f = await fixture();
  try {
    const pinned = await f.a.put(raw(1, { pinned: true }));
    await f.a.put(raw(2));
    const before = await f.b.list();
    await assert.rejects(f.b.remove(pinned.id), /unpin/i);
    assert.deepEqual(await f.a.list(), before);
    await f.b.pin(pinned.id, false);
    await f.a.remove(pinned.id);
    assert.deepEqual(
      (await f.b.list()).map(({ course }) => course.id),
      ['storage-only-2'],
    );
  } finally {
    f.close();
  }
});

test('caller mutations and connection reopening do not alter saved recordings or session data', async () => {
  const f = await fixture();
  let reopened;
  try {
    const input = raw(1);
    const saved = await f.a.put(input);
    const expected = structuredClone(saved);
    await f.a.saveSession({ courseId: 'storage-only-1', raw: [1, 2] });
    input.proof.raw = 99;
    saved.course.id = 'caller-only';
    const listed = await f.b.list();
    listed[0].proof.raw = 88;
    const session = await f.b.session();
    session.raw.push(3);
    f.close();
    reopened = await openWorldRecords(f.indexedDB);
    assert.deepEqual(await reopened.list(), [expected]);
    assert.deepEqual(await reopened.session(), {
      courseId: 'storage-only-1',
      raw: [1, 2],
    });
    await reopened.saveSession(null);
    assert.equal(await reopened.session(), undefined);
    assert.deepEqual(await reopened.list(), [expected]);
  } finally {
    f.close();
    reopened?.close();
  }
});

test('full record capacity refuses a new identity atomically but permits replacement and recovery', async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < WORLD_RECORD_LIMITS.records; i++) await f.a.put(raw(i));
    const before = await f.b.list();
    await assert.rejects(f.b.put(raw(WORLD_RECORD_LIMITS.records)), /storage is full/i);
    assert.deepEqual(await f.a.list(), before);
    const replacement = await f.b.put(raw(0, { diagnostic: 'Reverified metadata' }));
    assert.equal((await f.a.list()).length, WORLD_RECORD_LIMITS.records);
    assert.equal(replacement.id, before.find(({ course }) => course.id === 'storage-only-0').id);
    await f.a.remove(replacement.id);
    await f.b.put(raw(WORLD_RECORD_LIMITS.records));
    const after = await f.a.list();
    assert.equal(after.length, WORLD_RECORD_LIMITS.records);
    assert.ok(
      after.some(({ course }) => course.id === `storage-only-${WORLD_RECORD_LIMITS.records}`),
    );
  } finally {
    f.close();
  }
});

test('an aborted write after put is queued retains the old recording and unrelated session', async () => {
  const indexedDB = new IDBFactory();
  let abortNext = false;
  // Real fake-indexeddb transactions perform rollback. The hook only injects an
  // abort after the API queues a put; it does not emulate storage semantics.
  const controlled = {
    open(...args) {
      const request = indexedDB.open(...args);
      request.addEventListener('success', () => {
        const db = request.result,
          transaction = db.transaction.bind(db);
        db.transaction = (...txArgs) => {
          const tx = transaction(...txArgs),
            objectStore = tx.objectStore.bind(tx);
          tx.objectStore = (name) => {
            const store = objectStore(name),
              put = store.put.bind(store);
            store.put = (...putArgs) => {
              const result = put(...putArgs);
              if (abortNext && name === 'records') {
                abortNext = false;
                tx.abort();
              }
              return result;
            };
            return store;
          };
          return tx;
        };
      });
      return request;
    },
  };
  const store = await openWorldRecords(controlled),
    reader = await openWorldRecords(indexedDB);
  try {
    await store.put(raw(1, { pinned: true }));
    await store.put(raw(2));
    await store.saveSession({ raw: 'Unrelated interrupted session' });
    const before = await reader.list();
    abortNext = true;
    await assert.rejects(store.put(raw(1, { diagnostic: 'Must roll back', pinned: false })));
    assert.equal(abortNext, false);
    assert.deepEqual(await reader.list(), before);
    assert.deepEqual(await reader.session(), {
      raw: 'Unrelated interrupted session',
    });
    const retry = await store.put(raw(1, { diagnostic: 'Retry committed' }));
    assert.equal(retry.pinned, true);
    assert.equal(retry.diagnostic, 'Retry committed');
    assert.equal((await reader.list()).length, 2);
  } finally {
    store.close();
    reader.close();
  }
});

test('invalid or oversized data reject without changing existing records and session', async () => {
  const f = await fixture();
  try {
    await f.a.put(raw(1));
    await f.a.saveSession({ raw: 'Keep this' });
    const before = await f.b.list();
    await assert.rejects(f.a.put(raw(2, { status: 'accepted' })), /verification state/i);
    await assert.rejects(f.a.put(raw(2, { packIdentity: 'x'.repeat(161) })), /pack identity/i);
    await assert.rejects(
      f.a.put(raw(2, { proof: { raw: Array(2050).fill('x'.repeat(4096)) } })),
      /budget/i,
    );
    assert.throws(() => f.a.saveSession({ raw: () => {} }), /plain/i);
    assert.deepEqual(await f.b.list(), before);
    assert.deepEqual(await f.b.session(), { raw: 'Keep this' });
  } finally {
    f.close();
  }
});

test('unavailable IndexedDB rejects explicitly instead of claiming recordings are saved', async () => {
  await assert.rejects(openWorldRecords(null), /export recordings/i);
});
