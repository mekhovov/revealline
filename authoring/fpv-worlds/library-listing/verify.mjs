import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createContract, TEST_DB_NAME } from './contract.mjs';
const { IDBFactory } = createRequire(process.env.FPV_TEST_PACKAGE_JSON || new URL('../package.json', import.meta.url))('fake-indexeddb');
const request = (value) => new Promise((resolve, reject) => {
  value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error);
});
const done = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = resolve; tx.onabort = () => reject(tx.error || new Error('abort'));
});
function ownedFactory() {
  const factory = new IDBFactory(), opens = [];
  return { factory, opens, guarded: { open(name, version) {
    assert.equal(name, TEST_DB_NAME); assert.equal(version, 2);
    opens.push({ name, version }); return factory.open(name, version);
  } } };
}
test('construction is inert; explicit seed/list/abort preserve content, generation and transaction boundaries', async () => {
  const owned = ownedFactory(), contract = createContract(owned.guarded);
  assert.equal(owned.opens.length, 0);
  assert.equal(contract.snapshot().ready, false);
  assert.equal((await contract.list()).accepted, false);
  assert.equal(owned.opens.length, 0);
  const seed = await contract.seed();
  assert.equal(seed.accepted, true); assert.equal(seed.reused, false);
  assert.deepEqual(seed.content.counts, { projects: 1, assets: 32, revisions: 32, meta: 2 });
  const listed = await contract.list();
  assert.equal(listed.accepted, true, listed.error);
  assert.equal(listed.metadataRows, 32);
  assert.equal(listed.observation.maxRowsPerDelivery, 1);
  assert.equal(listed.observation.deliveredAssetRows, 32);
  assert.equal(listed.observation.deliveredMapEntries, 2016);
  assert.deepEqual(listed.observation.modes, ['readonly']);
  assert.deepEqual(listed.observation.stores, [['projects', 'revisions']]);
  assert.equal(listed.content.sha256, seed.content.sha256);
  const aborted = await contract.abort();
  assert.equal(aborted.accepted, true, aborted.error);
  assert.equal(aborted.rejected, true);
  assert.equal(aborted.partialSuccessReturned, false);
  assert.equal(aborted.observation.deliveredAssetRows, 0);
  assert.equal(aborted.content.sha256, seed.content.sha256);
  assert.equal((await contract.list()).accepted, true);
  assert.equal(owned.opens.length, 1);
  assert.equal(contract.snapshot().fixture.totalPersistedBlobReferences, 2048);
  assert.equal(contract.snapshot().fixture.uniqueOneByteBlobValues, 32);
  contract.close();
});
test('a later explicit visit reuses the same intact fixture without reseeding', async () => {
  const owned = ownedFactory(), first = createContract(owned.guarded);
  const initial = await first.seed(); first.close();
  const second = createContract(owned.guarded);
  const repeated = await second.seed();
  assert.equal(repeated.accepted, true, repeated.error);
  assert.equal(repeated.reused, true);
  assert.deepEqual(repeated.content, initial.content);
  assert.equal((await second.list()).accepted, true);
  second.close();
});
test('unknown nonempty fixture refuses seeding and preserves its sentinel', async () => {
  const owned = ownedFactory(), contract = createContract(owned.guarded);
  assert.equal((await contract.seed()).accepted, true); contract.close();
  const db = await request(owned.factory.open(TEST_DB_NAME, 2));
  const tx = db.transaction('meta', 'readwrite'), completion = done(tx);
  tx.objectStore('meta').put({ signature: 'foreign-sentinel' }, 'native-contract-fixture');
  await completion; db.close();
  const reopened = createContract(owned.guarded), rejected = await reopened.seed();
  assert.equal(rejected.accepted, false);
  assert.match(rejected.error, /Unknown nonempty/);
  assert.equal(reopened.snapshot().ready, false); reopened.close();
  const dbAgain = await request(owned.factory.open(TEST_DB_NAME, 2));
  const read = dbAgain.transaction('meta', 'readonly'), readDone = done(read);
  assert.deepEqual(await request(read.objectStore('meta').get('native-contract-fixture')), { signature: 'foreign-sentinel' });
  await readDone; dbAgain.close();
});
test('diagnostic history is capped without collecting asset content', async () => {
  const owned = ownedFactory(), contract = createContract(owned.guarded);
  for (let index = 0; index < 12; index++) await contract.list();
  const report = contract.snapshot();
  assert.equal(report.actions.length, 8); assert.equal(report.droppedActions, 4);
  assert.equal(owned.opens.length, 0);
  assert.equal(JSON.stringify(report).includes('application/octet-stream'), false);
  contract.close();
});
