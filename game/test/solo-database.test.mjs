import test from 'node:test';
import assert from 'node:assert/strict';
import { soloDatabase } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createJourneyBackend, JOURNEY_PROFILE_DATABASE } from '../journey/profile.mjs';
import { createExternalChapterPointerStore } from '../external-chapter-pointer.mjs';

function open(database, name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const request = database.open(name, version);
    request.onupgradeneeded = () => upgrade?.(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

for (const first of ['profile', 'assets']) {
  test(`Solo default databases preserve profile and asset data when ${first} opens first`, async (t) => {
    const indexedDB = soloDatabase();
    t.after(() => indexedDB.close());
    const profile = createJourneyBackend({ indexedDB });
    const assets = createExternalChapterPointerStore({
      indexedDB,
      profileKey: 'revealline.library.dev.v1',
      packsKey: 'revealline.packs.dev.v1',
    });
    t.after(() => assets.close());
    const empty = { packs: null, journal: null, index: null };
    const published = { ...empty, packs: 'retained fixture pack bytes' };
    const select = () =>
      profile.commit([{ type: 'select', mode: 'solo', missionId: 'opening-flight' }]);
    const publish = () => assets.compareAndSwap(empty, published);
    if (first === 'profile') {
      await select();
      await publish();
    } else {
      await publish();
      await select();
    }
    assert.equal((await profile.read()).cursors.solo, 'opening-flight');
    assert.deepEqual(await assets.snapshot(), published);
    const profileConnection = await open(indexedDB, JOURNEY_PROFILE_DATABASE, 1);
    const assetConnection = await open(indexedDB, 'revealline-assets-v1', 1);
    assert.deepEqual([...profileConnection.objectStoreNames], ['profiles']);
    assert.deepEqual([...assetConnection.objectStoreNames], ['assets']);
    assert.notEqual(profileConnection, assetConnection);
  });
}

test('Solo default names isolate schema upgrades and close every retained connection', async () => {
  const database = soloDatabase();
  const profile = await open(database, JOURNEY_PROFILE_DATABASE, 1, (db) =>
    db.createObjectStore('profiles'),
  );
  const assets = await open(database, 'revealline-assets-v1', 2, (db) =>
    db.createObjectStore('assets'),
  );
  const future = await open(database, 'a-future-store', 3, (db) => db.createObjectStore('future'));
  assert.equal(profile.version, 1);
  assert.equal(assets.version, 2);
  assert.equal(future.version, 3);
  let invalidated = 0;
  for (const db of [profile, assets, future]) db.onversionchange = () => invalidated++;
  database.close();
  assert.equal(invalidated, 3);
  for (const [db, store] of [
    [profile, 'profiles'],
    [assets, 'assets'],
    [future, 'future'],
  ])
    assert.throws(() => db.transaction(store), { name: 'InvalidStateError' });
});

test('Solo explicit database injection retains its routing and failure instrumentation', async () => {
  const model = managedIndexedDB();
  const names = [];
  const denied = new Error('Explicit fixture denial');
  const database = soloDatabase({
    open(name, ...args) {
      names.push(name);
      if (name === JOURNEY_PROFILE_DATABASE) throw denied;
      return model.indexedDB.open(name, ...args);
    },
  });
  const connection = await open(database, 'revealline-assets-v1', 1, (db) =>
    db.createObjectStore('assets'),
  );
  assert.throws(
    () => database.open(JOURNEY_PROFILE_DATABASE, 1),
    (error) => error === denied,
  );
  assert.deepEqual(names, ['revealline-assets-v1', JOURNEY_PROFILE_DATABASE]);
  assert.equal(model.openCount, 1);
  assert.deepEqual([...connection.objectStoreNames], ['assets']);
  database.close();
  assert.equal(model.closed, 1);
  assert.throws(() => soloDatabase(null).open('revealline-assets-v1', 1), TypeError);
});
