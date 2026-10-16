import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { openRegionalLibrary } from '../../../optional-practice/civilian-fpv/regional-delivery.mjs';
import { openWorldStore } from '../../../optional-practice/civilian-fpv/world-store.mjs';
import { openRegionalLocations } from '../../../optional-practice/civilian-fpv/regional-locations.mjs';
const { IDBFactory } = createRequire(new URL('../package.json', import.meta.url))('fake-indexeddb');
const indexedDB = new IDBFactory(),
  name = `fpv-repair-review-${crypto.randomUUID()}`;
const base = new URL('./urban-bando/delivery-review-r1/', import.meta.url);
const a = await readFile(new URL('delivery.json', base)),
  descriptor = JSON.parse(a);
const b = new TextEncoder().encode(
  JSON.stringify({ ...descriptor, revision: 'repair-fixture-r2' }),
);
const digest = async (bytes) =>
  Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
const pins = await Promise.all(
  [a, b].map(async (bytes, index) => ({
    url: `https://fixture.invalid/${index}/delivery.json`,
    bytes: bytes.length,
    sha256: await digest(bytes),
  })),
);
let corruptDownload = false;
const target = descriptor.files.find((row) => row.path.endsWith('.glb'));
const fetchImpl = async (input) => {
  const path = new URL(input).pathname;
  if (path.endsWith('/delivery.json')) return new Response(path.startsWith('/0/') ? a : b);
  const local = path.slice(3),
    bytes = await readFile(new URL(local, base));
  if (corruptDownload && local === target.path) bytes[bytes.length - 1] ^= 1;
  return new Response(bytes);
};
const options = { fetchImpl, pageURL: 'https://fixture.invalid/' };
let library = await openRegionalLibrary({ indexedDB, name });
const raw = await openWorldStore({ indexedDB, name });
const locations = await openRegionalLocations({ indexedDB, name: `${name}-places` });
const opening = indexedDB.open(name, 2);
const db = await new Promise((resolve, reject) => {
  opening.onsuccess = () => resolve(opening.result);
  opening.onerror = () => reject(opening.error);
});
const damageRetained = () =>
  new Promise((resolve, reject) => {
    const tx = db.transaction('revisions', 'readwrite'),
      store = tx.objectStore('revisions');
    const request = store.get([descriptor.id, pins[0].sha256]);
    request.onsuccess = () => {
      const value = request.result;
      value.assets.delete(target.path);
      store.put(value);
    };
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
const checks = [];
try {
  await library.install(pins[0], options);
  const identity = {
    regionId: descriptor.id,
    revision: descriptor.revision,
    sha256: pins[0].sha256,
  };
  await locations.add(
    identity,
    {
      label: 'Retained repair place',
      pose: { position: { x: 64000, y: 3000, z: 16000 }, heading: 0 },
    },
    { expectedGeneration: 0 },
  );
  const places = await locations.list(identity),
    captured = await library.load(descriptor.id, { sha256: pins[0].sha256 });
  const original = await raw.get(descriptor.id, { sha256: pins[0].sha256 });
  await library.install(pins[1], options);
  const other = await raw.get(descriptor.id, { sha256: pins[1].sha256 });
  await damageRetained();
  library.close();
  library = await openRegionalLibrary({ indexedDB, name });
  await assert.rejects(
    library.load(descriptor.id, { sha256: pins[0].sha256 }),
    (error) => error.code === 'regional-cache-invalid',
  );
  await library.load(descriptor.id, { sha256: pins[1].sha256 });
  checks.push(
    'Modelled retained-file loss survives connection reopen and fails closed; the other version remains usable',
  );
  corruptDownload = true;
  await assert.rejects(
    library.repair(pins[0], { ...options, id: descriptor.id }),
    /integrity mismatch/,
  );
  corruptDownload = false;
  assert.equal(await raw.generation(), 2);
  await assert.rejects(
    library.load(descriptor.id, { sha256: pins[0].sha256 }),
    (error) => error.code === 'regional-cache-invalid',
  );
  checks.push('Corrupt repair download does not change generation, pointer or saved versions');
  await library.repair(pins[0], { ...options, id: descriptor.id });
  const repaired = await library.load(descriptor.id, { sha256: pins[0].sha256 });
  const current = await raw.get(descriptor.id, { sha256: pins[0].sha256 });
  assert.equal(current.active, false);
  assert.equal((await raw.get(descriptor.id)).sha256, pins[1].sha256);
  assert.equal((await raw.get(descriptor.id)).installedAt, other.installedAt);
  assert.equal(current.installedAt, original.installedAt);
  assert.equal(current.assets.size, original.assets.size);
  assert.equal(await raw.generation(), 3);
  assert.equal((await library.list({ includeRevisions: true })).length, 2);
  assert.equal(
    (await raw.get(descriptor.id, { sha256: pins[1].sha256 })).installedAt,
    other.installedAt,
  );
  await library.load(descriptor.id, { sha256: pins[1].sha256 });
  const asset = repaired.manifest.assets[0];
  for (const configuration of [captured, repaired]) {
    const response = await configuration.source.fetchImpl(
      new URL(asset.path, configuration.source.baseURL).href,
    );
    assert.equal(await digest(await response.arrayBuffer()), asset.sha256);
  }
  assert.deepEqual(await locations.list(identity), places);
  checks.push(
    'Verified same-hash reinstall repairs exact retained bytes atomically without extra revisions, altered install dates or lost places/captured flight bytes',
  );
  await damageRetained();
  const cancelled = new AbortController();
  cancelled.abort(new DOMException('Cancelled', 'AbortError'));
  await assert.rejects(
    library.repair(pins[0], { ...options, id: descriptor.id, signal: cancelled.signal }),
    { name: 'AbortError' },
  );
  await assert.rejects(
    library.load(descriptor.id, { sha256: pins[0].sha256, signal: cancelled.signal }),
    (error) => error.name === 'AbortError' && !error.code?.startsWith?.('regional'),
  );
  await assert.rejects(
    library.repair(pins[0], { ...options, id: 'wrong-region' }),
    /no longer installed/,
  );
  await assert.rejects(raw.install({ ...original, repair: true }), /current library generation/);
  await assert.rejects(
    raw.install({ ...original, repair: true, expectedGeneration: 2 }),
    (error) => error.code === 'generation-conflict',
  );
  await assert.rejects(
    raw.install({
      ...original,
      repair: true,
      project: { ...original.project, uncloneable: () => {} },
      expectedGeneration: 3,
    }),
  );
  assert.equal(await raw.generation(), 3);
  await assert.rejects(
    library.load(descriptor.id, { sha256: pins[0].sha256 }),
    (error) => error.code === 'regional-cache-invalid',
  );
  await library.load(descriptor.id, { sha256: pins[1].sha256 });
  checks.push(
    'Stale generation and transaction failure cannot partially repair or replace either version',
  );
  await library.repair(pins[0], { ...options, id: descriptor.id });
  library.close();
  library = await openRegionalLibrary({ indexedDB, name });
  await library.load(descriptor.id, { sha256: pins[0].sha256 });
  assert.equal(await raw.generation(), 4);
  assert.equal((await raw.get(descriptor.id)).sha256, pins[1].sha256);
  // Active-version repair refreshes its files without replacing installation metadata.
  await library.repair(pins[1], { ...options, id: descriptor.id });
  assert.equal((await raw.get(descriptor.id)).sha256, pins[1].sha256);
  assert.equal((await raw.get(descriptor.id)).installedAt, other.installedAt);
  // An unrelated commit during verified network preparation invalidates the repair.
  let changed = false;
  const concurrentFetch = async (...args) => {
    if (!changed) {
      changed = true;
      await raw.install({
        project: { id: 'other-region' },
        assets: new Map(),
        sha256: 'c'.repeat(64),
        expectedGeneration: 5,
      });
    }
    return fetchImpl(...args);
  };
  await assert.rejects(
    library.repair(pins[0], { ...options, id: descriptor.id, fetchImpl: concurrentFetch }),
    (error) => error.code === 'generation-conflict',
  );
  assert.equal(await raw.generation(), 6);
  assert.equal((await raw.get(descriptor.id)).sha256, pins[1].sha256);
  assert.deepEqual(await locations.list(identity), places);
  checks.push('A valid retry survives connection reopen and cache-only exact-version verification');
} finally {
  library.close();
  raw.close();
  locations.close();
  db.close();
}
console.log(
  JSON.stringify(
    {
      passed: true,
      checks,
      scope:
        'Production exact repair with real immutable assets and isolated in-memory IndexedDB; active-pointer preservation, cancellation, concurrent commit and saved-place retention. No browser eviction/restart claim.',
    },
    null,
    2,
  ),
);
