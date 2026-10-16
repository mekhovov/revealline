import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createExternalChapterInventoryReader } from '../external-chapter-pointer.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { profileAssetFixture } from './helpers/profile-channel-idb.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const profileKey = 'revealline.library.release-v0.84.0.v1';
const packsKey = 'revealline.packs.release-v0.84.0.v1';
const indexKey = `${profileKey}.external-chapter-index.v1`;
const externalKey = `${profileKey}.external-chapter-journal.v1`;
const backupKey = `${profileKey}.backup-journal`;
const lockKey = `${profileKey}.backup-lock`;
class Locks {
  held = new Set();
  calls = [];
  async request(key, options, run) {
    this.calls.push({ key, options });
    if (this.held.has(key)) return run(null);
    this.held.add(key);
    try {
      return await run({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
async function fixture(t, entries = [], options = {}) {
  const f = await profileAssetFixture(entries, options),
    values = new Map(),
    locks = new Locks();
  const reader = createExternalChapterInventoryReader({
    indexedDB: f.indexedDB,
    profileKey,
    packsKey,
    storage: { getItem: (key) => values.get(key) ?? null },
    lockManager: locks,
  });
  t.after(() => reader.close());
  return { ...f, reader, values, locks };
}
async function put(f, key, value) {
  const db = await new Promise((resolve, reject) => {
    const request = f.model.indexedDB.open('revealline-assets-v1', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('assets', 'readwrite');
    tx.objectStore('assets').put(value, key);
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  f.model.allPuts.length = 0;
}

test('inventory absence settles aborted creation and leaves the database absent', async (t) => {
  const f = await fixture(t, [], { absent: true });
  const snapshot = await f.reader.snapshot();
  assert.equal(snapshot.status, 'absent');
  assert.equal(snapshot.packs, null);
  assert.equal(snapshot.index, null);
  assert.equal(await f.reader.confirm(snapshot), true);
  assert.deepEqual(f.model.contents(), new Map());
  assert.deepEqual(f.model.allPuts, []);
  assert.deepEqual(f.reads, []);
  assert(
    f.opens.every(
      (row) => row.name === 'revealline-assets-v1' && row.requestedVersion === undefined,
    ),
  );
  assert(
    f.locks.calls.every(
      (row) => row.key === lockKey && row.options.mode === 'exclusive' && row.options.ifAvailable,
    ),
  );
  assert.equal(f.locks.held.size, 0);
  // This finite IndexedDB model checks aborted creation and late-event handling;
  // it does not claim native browser disk/upgrade qualification.
});

test('inventory reads all exact pointers in one readonly boundary and hashes immutable raw bytes', async (t) => {
  const packs = '{ "format": "xonix-pack-library.v1", "packs": [] }';
  const index = { format: 'revealline-external-chapter-index.v1', chapters: [] };
  const f = await fixture(t, [
    [packsKey, packs],
    [indexKey, index],
    [externalKey, null],
  ]);
  const snapshot = await f.reader.snapshot();
  const fields = {
    packs: { present: true, value: packs },
    index: { present: true, value: index },
    backup: { present: false, value: null },
    external: { present: true, value: null },
  };
  assert.equal(snapshot.status, 'checked');
  assert.equal(snapshot.packs, packs);
  assert.equal(
    snapshot.sha256,
    createHash('sha256')
      .update(canonicalJSON({ status: 'checked', fields }))
      .digest('hex'),
  );
  assert(
    Object.isFrozen(snapshot) &&
      Object.isFrozen(snapshot.index) &&
      Object.isFrozen(snapshot.index.chapters),
  );
  assert.equal(await f.reader.confirm(snapshot), true);
  assert.equal(f.reads.filter(([kind]) => kind === 'get').length, 8);
  assert.equal(f.reads.filter(([kind]) => kind === 'count').length, 8);
  assert.deepEqual(f.model.contents(), f.before);
  assert.deepEqual(f.model.allPuts, []);
  await assert.rejects(f.reader.confirm({ ...snapshot }), /exact installed inventory snapshot/);
  await put(f, packsKey, packs + '\n');
  await assert.rejects(f.reader.confirm(snapshot), /Installed content changed/);
  assert.deepEqual(f.model.allPuts, []);
});

test('both journals and malformed stored undefined values fail closed without recovery writes', async (t) => {
  for (const [key, value, message] of [
    [backupKey, { pending: true }, /backup journal/],
    [externalKey, { pending: true }, /external chapter journal/],
    [externalKey, undefined, /unreadable stored value/],
    [packsKey, undefined, /unreadable stored value/],
    [indexKey, 'not metadata', /stored JSON metadata/],
  ])
    await t.test(key + String(value), async (t) => {
      const f = await fixture(t, [[key, value]]);
      await assert.rejects(f.reader.snapshot(), message);
      assert.deepEqual(f.model.contents(), f.before);
      assert.deepEqual(f.model.allPuts, []);
    });
});

test('recovery marker and unavailable lock reject before opening installed storage', async (t) => {
  const f = await fixture(t);
  f.values.set(lockKey, '');
  await assert.rejects(f.reader.snapshot(), /backup lock/);
  assert.equal(f.opens.length, 0);
  f.values.delete(lockKey);
  f.locks.held.add(lockKey);
  await assert.rejects(f.reader.snapshot(), /owns the profile lock/);
  assert.equal(f.opens.length, 0);
  assert.deepEqual(f.model.allPuts, []);
});

test('marker introduced at a held open retires the snapshot without clearing it', async (t) => {
  const f = await fixture(t);
  f.controls.holdSuccess = true;
  const work = f.reader.snapshot();
  await waitFor(() => f.controls.release);
  f.values.set(lockKey, 'in progress');
  f.controls.release();
  await assert.rejects(work, /backup lock/);
  assert.equal(f.values.get(lockKey), 'in progress');
  assert.deepEqual(f.model.allPuts, []);
});

test('newer or missing asset schema is refused without upgrades or new stores', async (t) => {
  const newer = await fixture(t, [], { version: 2 });
  await assert.rejects(newer.reader.snapshot(), /unsupported/);
  assert.deepEqual(newer.model.contents(), newer.before);
  const model = managedIndexedDB();
  await new Promise((resolve, reject) => {
    const request = model.indexedDB.open('revealline-assets-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('unrelated');
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
  const before = model.contents();
  const reader = createExternalChapterInventoryReader({
    indexedDB: model.indexedDB,
    profileKey,
    packsKey,
    storage: { getItem: () => null },
    lockManager: new Locks(),
  });
  t.after(() => reader.close());
  await assert.rejects(reader.snapshot(), /unsupported/);
  assert.deepEqual(model.contents(), before);
  assert.deepEqual(model.allPuts, []);
});

for (const action of ['abort', 'close'])
  test(`${action} retires a held open and closes its late connection without reading`, async (t) => {
    const f = await fixture(t);
    f.controls.holdSuccess = true;
    const controller = new AbortController();
    const work = f.reader.snapshot({ signal: controller.signal });
    const rejected = assert.rejects(work, { name: 'AbortError' });
    await waitFor(() => f.controls.release);
    const before = f.model.closed;
    if (action === 'close') f.reader.close();
    else controller.abort();
    await rejected;
    f.controls.release();
    assert.equal(f.model.closed, before + 1);
    assert.deepEqual(f.reads, []);
    assert.deepEqual(f.model.allPuts, []);
  });

test('storage errors and invalid channel bindings do not masquerade as an empty library', async () => {
  const locks = new Locks();
  assert.throws(
    () => createExternalChapterInventoryReader({ profileKey, packsKey: 'wrong' }),
    /channel must match/,
  );
  const reader = createExternalChapterInventoryReader({
    profileKey,
    packsKey,
    storage: {
      getItem() {
        throw new Error('Access denied');
      },
    },
    lockManager: locks,
    indexedDB: {
      open() {
        throw new Error('No database access expected');
      },
    },
  });
  await assert.rejects(reader.snapshot(), /Access denied/);
  assert.equal(locks.calls.length, 0);
  reader.close();
});

test('recovery marker introduced during hashing is rechecked while the same lock remains held', async (t) => {
  const f = await fixture(t);
  const original = crypto.subtle.digest.bind(crypto.subtle);
  let release,
    hashing = false;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  t.mock.method(crypto.subtle, 'digest', async (...args) => {
    hashing = true;
    await gate;
    return original(...args);
  });
  const work = f.reader.snapshot();
  await waitFor(() => hashing);
  assert(f.locks.held.has(lockKey));
  f.values.set(lockKey, 'recovery began');
  release();
  await assert.rejects(work, /backup lock/);
  assert.equal(f.locks.held.size, 0);
  assert.deepEqual(f.model.allPuts, []);
});

test('an unresponsive lock service has a bounded cancellation deadline and never opens storage', async () => {
  let opens = 0;
  const reader = createExternalChapterInventoryReader({
    profileKey,
    packsKey,
    timeoutMs: 5,
    storage: { getItem: () => null },
    lockManager: { request: () => new Promise(() => {}) },
    indexedDB: {
      open() {
        opens++;
        throw new Error('No native read expected');
      },
    },
  });
  await assert.rejects(reader.snapshot(), { name: 'AbortError' });
  assert.equal(opens, 0);
  reader.close();
});

test('dev inventory is scoped to its own exact nonrelease keys', async (t) => {
  const f = await profileAssetFixture();
  const reader = createExternalChapterInventoryReader({
    indexedDB: f.indexedDB,
    profileKey: 'revealline.library.dev.v1',
    packsKey: 'revealline.packs.dev.v1',
    storage: { getItem: () => null },
    lockManager: new Locks(),
  });
  t.after(() => reader.close());
  assert.equal((await reader.snapshot()).status, 'checked');
  assert(f.reads.every(([, key]) => key.includes('.dev.v1')));
  assert.deepEqual(f.model.allPuts, []);
});
