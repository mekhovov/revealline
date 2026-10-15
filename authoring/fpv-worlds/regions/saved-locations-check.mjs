import { openRegionalLocations } from '../../../optional-practice/civilian-fpv/regional-locations.mjs';
const result = document.querySelector('#result'),
  name = `fpv-locations-test-${crypto.randomUUID()}`;
const identity = { regionId: 'test-region', revision: 'r1', sha256: 'a'.repeat(64) };
const value = {
  label: '<b>A safe name</b>',
  pose: { position: { x: 64000.25, y: 3000.125, z: 16000.75 }, heading: 12345 },
};
const checks = [];
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
async function rejects(action, code) {
  try {
    await action();
  } catch (error) {
    assert(error.code === code, `Expected ${code}, got ${error.code}`);
    return;
  }
  throw new Error(`Expected ${code}`);
}
let a, b, native;
try {
  a = await openRegionalLocations({ name });
  b = await openRegionalLocations({ name });
  let state = await a.list(identity);
  assert(state.generation === 0 && state.locations.length === 0, 'Empty state');
  const first = await a.add(identity, value, { expectedGeneration: 0 });
  await rejects(() => b.add(identity, value, { expectedGeneration: 0 }), 'generation-conflict');
  state = await b.list(identity);
  assert(
    state.locations.length === 1 &&
      state.locations[0].label === value.label &&
      state.locations[0].pose.position.x === 64000.25,
    'Exact persisted data',
  );
  checks.push(
    'Real IndexedDB keeps exact fractions and plain text; concurrent stale save rejects.',
  );
  state.locations[0].pose.position.x = 0;
  assert((await a.list(identity)).locations[0].pose.position.x === 64000.25, 'Read isolation');
  const other = { ...identity, sha256: 'b'.repeat(64) };
  assert((await a.list(other)).locations.length === 0, 'Exact descriptor isolation');
  await rejects(
    () => a.remove(other, first.location.id, { expectedGeneration: 1 }),
    'regional-location-missing',
  );
  await rejects(
    () => a.add(identity, { ...value, label: ' ' }, { expectedGeneration: 1 }),
    'regional-location-label',
  );
  await rejects(
    () =>
      a.add(
        identity,
        { ...value, pose: { ...value.pose, position: { x: NaN, y: 0, z: 0 } } },
        { expectedGeneration: 1 },
      ),
    'regional-location-invalid',
  );
  checks.push('Read copies, exact revision isolation and untrusted value checks pass.');
  for (let generation = 1; generation < 20; generation++)
    await a.add(
      identity,
      { ...value, label: `Place ${generation}` },
      { expectedGeneration: generation },
    );
  await rejects(() => a.add(identity, value, { expectedGeneration: 20 }), 'regional-location-full');
  assert((await a.list(identity)).locations.length === 20, 'Limit failure retains records');
  checks.push('20-per-revision cap rejects without replacing any saved record.');
  await rejects(
    () => b.remove(identity, first.location.id, { expectedGeneration: 1 }),
    'generation-conflict',
  );
  await b.remove(identity, first.location.id, { expectedGeneration: 20 });
  assert((await a.list(identity)).locations.length === 19, 'Reviewed removal');
  a.close();
  b.close();
  a = await openRegionalLocations({ name });
  assert((await a.list(identity)).locations.length === 19, 'Reopen persistence');
  checks.push('Reviewed generation-guarded removal and database reopen preserve remaining places.');
  native = await new Promise((resolve, reject) => {
    const r = indexedDB.open(name);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  let corrupt;
  await new Promise((resolve, reject) => {
    const tx = native.transaction('state', 'readwrite'),
      store = tx.objectStore('state'),
      r = store.get('library');
    r.onsuccess = () => {
      corrupt = r.result;
      corrupt.locations[0].pose.position.x = Infinity;
      store.put(corrupt, 'library');
    };
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  await rejects(() => a.list(identity), 'regional-location-invalid');
  await rejects(
    () => a.add(identity, value, { expectedGeneration: 21 }),
    'regional-location-invalid',
  );
  const retained = await new Promise((resolve, reject) => {
    const r = native.transaction('state').objectStore('state').get('library');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  assert(
    retained.locations.length === 19 && retained.locations[0].pose.position.x === Infinity,
    'No silent repair/deletion',
  );
  checks.push('Corrupt stored data blocks mutation and remains untouched.');
  result.textContent = JSON.stringify({ status: 'PASS', checks }, null, 2);
} catch (error) {
  result.textContent = JSON.stringify({ status: 'FAIL', checks, error: error.stack }, null, 2);
} finally {
  a?.close();
  b?.close();
  native?.close();
  indexedDB.deleteDatabase(name);
}
