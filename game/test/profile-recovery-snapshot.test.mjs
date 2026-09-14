import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileChannelReader } from '../profile-channel-reader.mjs';
import { recoveryChannel } from '../profile-channel.mjs';
import { emptyLibrary, exportLibrary } from '../library.mjs';
import { profileAssetFixture } from './helpers/profile-channel-idb.mjs';
import { recoveryMediaFixture } from './helpers/recovery-media-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const id = 'release-v0.39.0';
async function fixture(
  t,
  {
    assets = [],
    catalogs = [{ channelId: id, registeredEntries: [], knownDescriptors: [] }],
    absent = false,
  } = {},
) {
  const channel = recoveryChannel(id, 'v0.40.0'),
    map = new Map([
      [channel.profileKey, exportLibrary(emptyLibrary())],
      [channel.sessionKey, '{malformed preserved'],
    ]);
  const media = await recoveryMediaFixture({}, { absent }),
    profiles = await profileAssetFixture(assets);
  const locks = {
    held: new Set(),
    calls: [],
    async request(key, options, callback) {
      this.calls.push({ key, options });
      if (this.held.has(key)) return callback(null);
      this.held.add(key);
      try {
        return await callback({ name: key });
      } finally {
        this.held.delete(key);
      }
    },
  };
  const storage = {
    get length() {
      return map.size;
    },
    key: (n) => [...map.keys()][n] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem() {
      assert.fail('No profile writes.');
    },
    removeItem() {
      assert.fail('No profile deletion.');
    },
  };
  const reader = createProfileChannelReader({
    storage,
    indexedDB: {
      open(name, ...args) {
        return (name === 'revealline-assets-v1' ? profiles : media).indexedDB.open(name, ...args);
      },
    },
    lockManager: locks,
    currentVersion: 'v0.40.0',
    recoveryCatalogs: catalogs,
  });
  t.after(() => reader.close());
  const selected = (await reader.discover()).channels[0],
    review = await reader.review(selected);
  return { reader, channel: selected, map, media, profiles, locks, review };
}
test('capture holds exact channel leases, owns an unverified snapshot and keeps malformed-session raw export', async (t) => {
  const f = await fixture(t),
    before = new Map(f.map);
  f.media.controls.onRead = () =>
    assert.deepEqual(f.locks.held, new Set([f.channel.writerKey, f.channel.lockKey]));
  const token = await f.reader.captureRecoverySnapshot(f.review);
  assert.equal(token.schemaVersion, 4);
  assert.equal(token.originals.verified, false);
  assert.equal(token.scope, 'snapshot-metadata-only');
  assert.equal(token.fullBackup, false);
  assert.equal(token.savedFlightInspection, 'unavailable');
  assert.equal(await f.reader.revalidateRecoverySnapshot(token), token);
  const raw = JSON.parse(await (await f.reader.exportStoredData(f.review)).blob.text());
  assert.equal(raw.raw.session.value, '{malformed preserved');
  assert.equal(raw.sharedMedia, 'not-inspected');
  assert.deepEqual(f.map, before);
  assert.deepEqual(f.media.model.allPuts, []);
  assert.deepEqual(f.profiles.model.allPuts, []);
  assert.equal(f.locks.held.size, 0);
  await assert.rejects(
    f.reader.revalidateRecoverySnapshot({ ...token }),
    /owned recovery snapshot/,
  );
});
test('unknown exact alias and pending journals refuse before opening shared media; raw diagnostics remain usable', async (t) => {
  for (const options of [
    { catalogs: [{ channelId: 'release-0.39.0', registeredEntries: [], knownDescriptors: [] }] },
    { assets: [[recoveryChannel(id, 'v0.40.0').externalJournalKey, { pending: true }]] },
  ]) {
    const f = await fixture(t, options);
    await assert.rejects(
      f.reader.captureRecoverySnapshot(f.review),
      /registered recovery catalog|Pending/,
    );
    assert.deepEqual(f.media.opens, []);
    assert((await f.reader.exportStoredData(f.review)).blob.size > 0);
  }
});
test('absent shared storage refuses only the stronger capability', async (t) => {
  const f = await fixture(t, { absent: true });
  await assert.rejects(f.reader.captureRecoverySnapshot(f.review), /Shared media is absent/);
  assert((await f.reader.exportStoredData(f.review)).blob.size > 0);
  assert.deepEqual(f.media.model.contents(), new Map());
});
test('profile pointer drift during shared snapshot refuses without adopting or repairing it', async (t) => {
  const f = await fixture(t);
  f.media.controls.onRead = () => f.map.set(f.channel.sessionKey, '{new exact raw');
  await assert.rejects(f.reader.captureRecoverySnapshot(f.review), /stored profile changed/);
  assert.equal(f.map.get(f.channel.sessionKey), '{new exact raw');
  assert.deepEqual(f.media.model.allPuts, []);
  assert.equal(f.locks.held.size, 0);
});
test('shared ledger changes after capture and during the second snapshot invalidate the capability', async (t) => {
  const f = await fixture(t),
    token = await f.reader.captureRecoverySnapshot(f.review);
  await f.media.seed({
    managedState: [
      ['ledger', { format: 'revealline-managed-state.v1', revision: 1, usedBytes: 5000 }],
    ],
  });
  await assert.rejects(f.reader.revalidateRecoverySnapshot(token), /Shared media changed/);
  const g = await fixture(t);
  g.media.controls.onOpen = (count) => {
    if (count === 2) g.media.controls.holdSuccess = true;
  };
  const operation = g.reader.captureRecoverySnapshot(g.review),
    rejected = assert.rejects(operation, /Shared media changed/);
  await waitFor(() => typeof g.media.controls.release === 'function');
  await g.media.seed({
    managedState: [
      ['ledger', { format: 'revealline-managed-state.v1', revision: 9, usedBytes: 5000 }],
    ],
  });
  g.media.controls.release();
  await rejected;
  assert.equal(g.locks.held.size, 0);
});
test('cancelling a held shared open releases channel locks and leaves raw export available', async (t) => {
  const f = await fixture(t),
    controller = new AbortController();
  f.media.controls.holdSuccess = true;
  const operation = f.reader.captureRecoverySnapshot(f.review, { signal: controller.signal });
  const rejected = assert.rejects(operation, { name: 'AbortError' });
  await waitFor(() => typeof f.media.controls.release === 'function');
  controller.abort();
  await rejected;
  f.media.controls.release();
  await waitFor(() => f.locks.held.size === 0);
  assert.deepEqual(f.media.reads, []);
  assert((await f.reader.exportStoredData(f.review)).blob.size > 0);
});
