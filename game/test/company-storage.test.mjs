import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompanyStorage } from '../company-storage.mjs';
import {
  createJourneyBackend,
  createJourneyProfileStore,
  emptyJourneyProfile,
} from '../journey/profile.mjs';
import { claimProfileWriter } from '../profile-writer.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
const turn = () => new Promise((resolve) => setImmediate(resolve));
const event = { type: 'select', mode: 'solo', missionId: 'first-connection' };

function lockManager() {
  const held = new Set();
  return {
    async request(key, _options, callback) {
      if (held.has(key)) return callback(null);
      held.add(key);
      try {
        return await callback({ name: key });
      } finally {
        held.delete(key);
      }
    },
  };
}

test('read denial is reported once and cannot become an empty-library overwrite', () => {
  const values = new Map([['session', 'historical record']]),
    notices = [];
  let readable = false;
  const storage = createCompanyStorage({
    getStorage: () => ({
      getItem(key) {
        if (!readable) throw new Error('denied');
        return values.get(key) ?? null;
      },
      setItem: (key, value) => values.set(key, value),
    }),
    onError: (error) => notices.push(error.message),
  });
  assert.equal(storage.getItem('session'), null);
  assert.equal(storage.getItem('session'), null);
  assert.equal(notices.length, 1);
  readable = true;
  assert.equal(storage.getItem('session'), 'historical record');
  assert.throws(() => storage.setItem('session', 'new record'), /could not be read/);
  assert.equal(values.get('session'), 'historical record');
});

test('quota failures remain visible without erasing existing storage or blocking later recovery', () => {
  let full = true;
  const values = new Map([['session', 'old']]),
    notices = [];
  const storage = createCompanyStorage({
    getStorage: () => ({
      getItem: (key) => values.get(key) ?? null,
      setItem(key, value) {
        if (full) throw new Error('quota');
        values.set(key, value);
      },
    }),
    onError: (error) => notices.push(error.message),
  });
  assert.equal(storage.getItem('missing'), null);
  assert.throws(() => storage.setItem('session', 'next'), /quota/);
  assert.equal(values.get('session'), 'old');
  assert.equal(notices.length, 1);
  full = false;
  storage.setItem('session', 'next');
  assert.equal(values.get('session'), 'next');
});

test('hub and frozen views share an edition writer lease; other audiences and exported session progress remain independent', async () => {
  const locks = lockManager(),
    disk = managedIndexedDB();
  const key = 'revealline.company.coupa-adventure.writer';
  const hub = await claimProfileWriter(locks, key),
    standalone = await claimProfileWriter(locks, key);
  const other = await claimProfileWriter(locks, 'revealline.company.coupa-culture.writer');
  assert.equal(hub.writable, true);
  assert.equal(standalone.writable, false);
  assert.equal(other.writable, true);
  const backend = createJourneyBackend({
    ...disk,
    profileKey: 'journey-coupa-adventure',
    canWrite: () => standalone.writable,
  });
  const reader = createJourneyProfileStore({ backend, canWrite: () => standalone.writable });
  await reader.load();
  reader.record(event);
  assert.equal(await reader.flush(), false);
  assert.equal(JSON.parse(reader.export()).profile.cursors.solo, event.missionId);
  assert.deepEqual(await backend.read(), emptyJourneyProfile());
  hub.release();
  other.release();
  await turn();
  const reopened = await claimProfileWriter(locks, key);
  const store = createJourneyProfileStore({
    backend: createJourneyBackend({
      ...disk,
      profileKey: backend.profileKey,
      canWrite: () => reopened.writable,
    }),
    canWrite: () => reopened.writable,
  });
  await store.load();
  store.restore(reader.export());
  assert.equal(await store.flush(), true);
  assert.equal(store.snapshot().cursors.solo, event.missionId);
  reopened.release();
  await turn();
});

test('lease loss during asynchronous database open or transaction reads aborts writes', async () => {
  for (const opened of [false, true]) {
    const disk = managedIndexedDB();
    let writable = true;
    const backend = createJourneyBackend({
      ...disk,
      profileKey: 'journey-coupa-adventure',
      canWrite: () => writable,
    });
    if (opened) await backend.read();
    const pending = backend.commit([event]);
    queueMicrotask(() => {
      writable = false;
    });
    await assert.rejects(pending, /lease is no longer held/);
    assert.equal(disk.allPuts.length, 0);
    assert.deepEqual(await backend.read(), emptyJourneyProfile());
  }
});

test('explicit same-edition backup crosses isolated origin stores while another audience rejects it unchanged', async () => {
  const make = (profileKey, disk = managedIndexedDB()) =>
    createJourneyProfileStore({ backend: createJourneyBackend({ ...disk, profileKey }) });
  const source = make('journey-coupa-adventure'),
    destination = make('journey-coupa-adventure');
  const other = make('journey-coupa-culture');
  await Promise.all([source.load(), destination.load(), other.load()]);
  source.record({
    type: 'complete',
    mode: 'solo',
    missionId: 'first-connection',
    runId: 'verified-source-run',
    gameplayId: 'simulation-1',
    difficulty: 'standard',
  });
  await source.flush();
  assert.deepEqual(destination.snapshot(), emptyJourneyProfile(), 'another origin starts empty');
  const original = source.export();
  assert.throws(() => other.restore(original), /different Journey edition/);
  assert.deepEqual(other.snapshot(), emptyJourneyProfile());
  destination.inspectBackup(original);
  destination.restore(original);
  assert.equal(await destination.flush(), true);
  assert.deepEqual(destination.snapshot().clears, source.snapshot().clears);
  assert.equal(source.export(), original, 'an export/import never consumes the source records');
});
