import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyLibrary, exportLibrary, LIBRARY_STORAGE_VERSION } from '../library.mjs';
import { createProfileChannelReader } from '../profile-channel-reader.mjs';
import { recoveryChannel } from '../profile-channel.mjs';
import { ownProfileJSON } from '../profile-channel-json.mjs';
import { profileAssetFixture } from './helpers/profile-channel-idb.mjs';

class Locks {
  held = new Set();
  calls = [];
  async request(key, options, callback) {
    this.calls.push({ key, options });
    if (this.held.has(key)) return callback(null);
    this.held.add(key);
    try {
      return await callback({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
async function fixture(t, { localEntries, assets = [], absent = false } = {}) {
  const source = recoveryChannel('release-v0.39.0', 'v0.40.0');
  const map = new Map(localEntries ?? [[source.profileKey, exportLibrary(emptyLibrary())]]);
  const db = await profileAssetFixture(assets, { absent });
  const localReads = [],
    locks = new Locks();
  const storage = {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem(key) {
      localReads.push(key);
      return map.has(key) ? map.get(key) : null;
    },
    setItem() {
      assert.fail('Reader cannot write a profile.');
    },
    removeItem() {
      assert.fail('Reader cannot delete a profile.');
    },
  };
  const reader = createProfileChannelReader({
    storage,
    indexedDB: db.indexedDB,
    lockManager: locks,
    currentVersion: 'v0.40.0',
    origin: 'https://example.test',
  });
  t.after(() => reader.close());
  return { reader, source, map, storage, db, locks, localReads };
}
test('discovery keeps exact aliases, finds packs-only and preserves protected dev/future channels without reading values', async (t) => {
  const later = recoveryChannel('release-v0.41.0', 'v0.40.0');
  const f = await fixture(t, {
    localEntries: [
      ['revealline.library.release-v0.39.0.v1', 'raw-a'],
      ['revealline.suspended.release-0.39.0.v1', 'raw-b'],
      ['revealline.library.dev.v1', 'raw-dev'],
      ['revealline.library.release.v1', 'legacy'],
    ],
    assets: [[later.indexKey, null]],
  });
  const found = await f.reader.discover();
  assert.deepEqual(
    new Set(found.channels.map((c) => c.id)),
    new Set(['release-v0.39.0', 'release-0.39.0', 'dev', 'release', 'release-v0.41.0']),
  );
  assert.equal(found.channels.find((c) => c.id === 'dev').support, 'protected-unknown');
  assert.equal(found.channels.find((c) => c.id === 'release-v0.41.0').support, 'protected-unknown');
  assert.equal(found.migrationAuthority, false);
  assert.deepEqual(f.localReads, []);
  assert.deepEqual(f.db.model.allPuts, []);
});
test('locked overview and export preserve exact stored wrappers and every raw string without opening media', async (t) => {
  const f = await fixture(t);
  const raw = JSON.stringify(
    {
      format: LIBRARY_STORAGE_VERSION,
      generation: 'generation-old-exact',
      library: emptyLibrary(),
    },
    null,
    3,
  );
  f.map.set(f.source.profileKey, raw);
  f.map.set(f.source.sessionKey, '{bad saved flight\ud800');
  const original = new Map(f.map);
  const channel = (await f.reader.discover()).channels[0];
  const review = await f.reader.review(channel);
  assert.equal(review.profile.status, 'valid-structure');
  assert.equal(review.saved.status, 'malformed-or-unsupported');
  assert.equal(review.sharedMedia, 'not-inspected');
  assert.equal(review.savedFlightInspection, 'unavailable');
  const exported = await f.reader.exportStoredData(review);
  const contents = JSON.parse(await exported.blob.text());
  assert.equal(contents.raw.profile.value, raw);
  assert.equal(contents.raw.session.value, f.map.get(f.source.sessionKey));
  assert.equal(contents.raw.profile.state, 'present');
  assert.equal(exported.completeStoredSnapshot, true);
  assert.deepEqual(f.map, original);
  assert.deepEqual(f.db.model.contents(), f.db.before);
  assert.deepEqual(f.db.model.allPuts, []);
  assert(
    f.db.opens.every(
      (open) => open.name === 'revealline-assets-v1' && open.requestedVersion === undefined,
    ),
  );
  assert.deepEqual(
    f.locks.calls.map((c) => c.key),
    [channel.writerKey, channel.lockKey, channel.writerKey, channel.lockKey],
  );
  assert(
    f.locks.calls.every((c) => c.options.mode === 'exclusive' && c.options.ifAvailable === true),
  );
  assert.equal(f.locks.held.size, 0);
});
test('a corrupt profile with first-receipt text remains exportable without being relabeled an empty valid profile', async (t) => {
  const f = await fixture(t);
  const raw = '{"pictureReceipts":[{"first":"unchanged"}],"broken":';
  f.map.set(f.source.profileKey, raw);
  const channel = (await f.reader.discover()).channels[0];
  const review = await f.reader.review(channel);
  assert.equal(review.profile.status, 'malformed-or-unsupported');
  const result = JSON.parse(await (await f.reader.exportStoredData(review)).blob.text());
  assert.equal(result.raw.profile.value, raw);
  assert.equal(f.map.get(f.source.profileKey), raw);
});
test('asset absence, present null and unsupported undefined remain distinct and unsupported values produce an incomplete diagnostic', async (t) => {
  const c = recoveryChannel('release-v0.39.0', 'v0.40.0');
  const f = await fixture(t, {
    assets: [
      [c.packsKey, null],
      [c.indexKey, undefined],
      [c.externalJournalKey, new Date(0)],
    ],
  });
  const channel = (await f.reader.discover()).channels[0];
  const review = await f.reader.review(channel);
  assert.equal(review.profile.status, 'valid-structure');
  assert.equal(review.completeStoredSnapshot, false);
  assert.equal(review.recoveryPending, true);
  const prepared = await f.reader.exportStoredData(review);
  const result = JSON.parse(await prepared.blob.text());
  assert.deepEqual(result.raw.assets.packs, { state: 'present', value: null });
  assert.deepEqual(result.raw.assets.backup, { state: 'absent' });
  assert.equal(result.raw.assets.index.state, 'unsupported');
  assert.equal(result.raw.assets.external.state, 'unsupported');
  assert.match(prepared.filename, /incomplete-diagnostic/);
  assert.deepEqual(f.db.model.contents(), f.db.before);
});
test('missing asset database does not block independently valid profile metadata or create storage', async (t) => {
  const f = await fixture(t, { absent: true });
  const channel = (await f.reader.discover()).channels[0];
  const review = await f.reader.review(channel);
  assert.equal(review.profile.status, 'valid-structure');
  const raw = JSON.parse(await (await f.reader.exportStoredData(review)).blob.text()).raw;
  assert.equal(raw.assetDatabase, 'absent');
  assert.deepEqual(f.db.model.contents(), new Map());
});
test('busy writers and changed reviewed source refuse export, and manufactured review/channel objects grant no authority', async (t) => {
  const f = await fixture(t);
  const channel = (await f.reader.discover()).channels[0];
  f.locks.held.add(channel.writerKey);
  await assert.rejects(f.reader.review(channel), /busy/);
  f.locks.held.delete(channel.writerKey);
  await assert.rejects(f.reader.review(f.source), /from this recovery screen/);
  const review = await f.reader.review(channel);
  await assert.rejects(f.reader.exportStoredData({ ...review }), /Review this profile/);
  f.map.set(channel.sessionKey, '{}');
  await assert.rejects(f.reader.exportStoredData(review), /changed after review/);
  assert.equal(f.locks.held.size, 0);
});
test('source changes during snapshot validation refuse a stable review', async (t) => {
  const f = await fixture(t);
  const channel = (await f.reader.discover()).channels[0];
  const original = f.storage.getItem;
  let changed = false;
  f.storage.getItem = (key) => {
    const value = original(key);
    if (key === channel.sessionKey && !changed) {
      changed = true;
      f.map.set(channel.profileKey, 'changed-by-other-writer');
    }
    return value;
  };
  await assert.rejects(f.reader.review(channel), /changed during review/);
  assert.equal(f.locks.held.size, 0);
});
test('more than 96 exact channels refuses the inventory without dropping entries', async (t) => {
  const entries = Array.from({ length: 97 }, (_, i) => [
    `revealline.library.release-v0.${i + 3}.0.v1`,
    '{}',
  ]);
  const f = await fixture(t, { localEntries: entries });
  await assert.rejects(f.reader.discover(), /Too many exact/);
  assert.deepEqual(f.localReads, []);
});
test('strict structured-value export rejects lossy JSON cases and never invokes a getter', () => {
  let getterCalled = false;
  const getter = Object.defineProperty({}, 'secret', {
    enumerable: true,
    get() {
      getterCalled = true;
      return 1;
    },
  });
  const shared = {};
  for (const value of [
    undefined,
    -0,
    NaN,
    Infinity,
    1n,
    new Date(),
    new Map(),
    new Set(),
    new Uint8Array(1),
    new Blob(['x']),
    getter,
    [, ,],
    { a: shared, b: shared },
  ])
    assert.throws(() => ownProfileJSON(value, 1024));
  assert.equal(getterCalled, false);
  assert.deepEqual(ownProfileJSON({ text: '\ud800', values: [null, true, 1.5] }, 1024), {
    text: '\ud800',
    values: [null, true, 1.5],
  });
});

test('Close settles while an unstarted Web Locks request is delayed, and its late callback cannot read', async (t) => {
  const f = await fixture(t);
  const channel = (await f.reader.discover()).channels[0];
  let entered;
  const requested = new Promise((resolve) => {
    entered = resolve;
  });
  let deliver;
  f.locks.request = (_key, _options, callback) =>
    new Promise((resolve, reject) => {
      deliver = async () => {
        try {
          resolve(await callback({ name: channel.writerKey }));
        } catch (error) {
          reject(error);
        }
      };
      entered();
    });
  const pending = f.reader.review(channel);
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await requested;
  await f.reader.close();
  await rejected;
  await deliver();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.localReads, []);
  assert.deepEqual(f.db.model.allPuts, []);
  assert.deepEqual(
    f.db.reads.filter(([kind]) => kind !== 'keys'),
    [],
  );
});

test('cancelling a delayed backup-lock request releases the acquired writer and rejects its late read callback', async (t) => {
  const f = await fixture(t);
  const channel = (await f.reader.discover()).channels[0];
  const request = f.locks.request.bind(f.locks);
  let entered;
  const waiting = new Promise((resolve) => {
    entered = resolve;
  });
  let deliver;
  f.locks.request = (key, options, callback) => {
    if (key !== channel.lockKey) return request(key, options, callback);
    return new Promise((resolve, reject) => {
      deliver = async () => {
        try {
          resolve(await callback({ name: key }));
        } catch (error) {
          reject(error);
        }
      };
      entered();
    });
  };
  const pending = f.reader.review(channel);
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await waiting;
  assert.deepEqual(f.locks.held, new Set([channel.writerKey]));
  await f.reader.close();
  await rejected;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.locks.held.size, 0);
  await deliver();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.localReads, []);
  assert.deepEqual(
    f.db.reads.filter(([kind]) => kind !== 'keys'),
    [],
  );
});
