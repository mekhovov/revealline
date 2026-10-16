import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { openRegionalLocations } from '../../optional-practice/civilian-fpv/regional-locations.mjs';

// Exercise actual storage transactions through two API connections. Fake IndexedDB
// isolates fixtures; it does not prove native persistence, quota or browser restart.
const { IDBFactory } = createRequire(
  new URL('../../authoring/fpv-worlds/package.json', import.meta.url),
)('fake-indexeddb');
const identity = (revision = 'r1', sha256 = 'a'.repeat(64)) => ({
  regionId: 'place-review',
  revision,
  sha256,
});
const value = (label = 'Review place') => ({
  label,
  pose: { position: { x: 10000, y: 3000, z: 20000 }, heading: 4500 },
});
async function fixture() {
  const indexedDB = new IDBFactory(),
    name = 'isolated-saved-places';
  let next = 0;
  const open = () =>
    openRegionalLocations({ indexedDB, name, newId: () => `place-${++next}`, now: () => 1000 });
  const a = await open(),
    b = await open();
  return {
    a,
    b,
    indexedDB,
    name,
    open,
    close() {
      a.close();
      b.close();
    },
  };
}
const rejectsWith = (promise, code) => assert.rejects(promise, (error) => error.code === code);

test('concurrent saved-place edits accept one reviewed generation without losing the winner', async () => {
  const f = await fixture(),
    id = identity();
  try {
    const reviewedA = await f.a.list(id),
      reviewedB = await f.b.list(id);
    const outcomes = await Promise.allSettled([
      f.a.add(id, value('First tab'), { expectedGeneration: reviewedA.generation }),
      f.b.add(id, value('Second tab'), { expectedGeneration: reviewedB.generation }),
    ]);
    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    assert.equal(rejected.reason.code, 'generation-conflict');
    const winner = outcomes.find((outcome) => outcome.status === 'fulfilled').value;
    assert.deepEqual(await f.a.list(id), { generation: 1, locations: [winner.location] });
    assert.deepEqual(await f.b.list(id), await f.a.list(id));
    await rejectsWith(
      f.a.remove(id, winner.location.id, { expectedGeneration: 0 }),
      'generation-conflict',
    );
    assert.deepEqual(await f.b.list(id), { generation: 1, locations: [winner.location] });
  } finally {
    f.close();
  }
});

test('an edit to another revision invalidates stale removal while retaining both places', async () => {
  const f = await fixture(),
    first = identity(),
    second = identity('r2', 'b'.repeat(64));
  try {
    const initial = await f.a.add(first, value('Original revision'), { expectedGeneration: 0 });
    const review = await f.a.list(first);
    const added = await f.b.add(second, value('Second revision'), {
      expectedGeneration: review.generation,
    });
    await rejectsWith(
      f.a.remove(first, initial.location.id, { expectedGeneration: review.generation }),
      'generation-conflict',
    );
    assert.deepEqual(await f.a.list(first), { generation: 2, locations: [initial.location] });
    assert.deepEqual(await f.b.list(second), { generation: 2, locations: [added.location] });
    await f.a.remove(first, initial.location.id, { expectedGeneration: 2 });
    assert.deepEqual(await f.b.list(second), { generation: 3, locations: [added.location] });
    assert.deepEqual(await f.b.list(first), { generation: 3, locations: [] });
  } finally {
    f.close();
  }
});

test('a place ID cannot remove a place owned by another region, revision or exact hash', async () => {
  const f = await fixture(),
    owner = identity();
  try {
    const saved = await f.a.add(owner, value(), { expectedGeneration: 0 });
    for (const wrong of [
      { ...owner, regionId: 'different-region' },
      { ...owner, revision: 'different-revision' },
      { ...owner, sha256: 'b'.repeat(64) },
    ]) {
      await rejectsWith(
        f.b.remove(wrong, saved.location.id, { expectedGeneration: 1 }),
        'regional-location-missing',
      );
      assert.deepEqual(await f.a.list(owner), { generation: 1, locations: [saved.location] });
    }
  } finally {
    f.close();
  }
});

test('mutating returned add/list snapshots cannot change stored position, heading or identity', async () => {
  const f = await fixture(),
    owner = identity();
  try {
    const saved = await f.a.add(owner, value(), { expectedGeneration: 0 });
    const expected = structuredClone(saved.location);
    saved.location.identity.sha256 = 'b'.repeat(64);
    saved.location.pose.position.y = 9000;
    saved.location.pose.heading = 18000;
    const read = await f.b.list(owner);
    assert.deepEqual(read, { generation: 1, locations: [expected] });
    read.generation = 999;
    read.locations[0].pose.position.x = 50000;
    read.locations[0].label = 'Changed only in caller memory';
    read.locations.push({});
    assert.deepEqual(await f.a.list(owner), { generation: 1, locations: [expected] });
  } finally {
    f.close();
  }
});

test('per-revision capacity refuses a new place atomically and another revision remains usable', async () => {
  const f = await fixture(),
    owner = identity(),
    other = identity('r2', 'b'.repeat(64));
  try {
    for (let index = 0; index < 20; index++)
      await f.a.add(owner, value(`Original ${index + 1}`), { expectedGeneration: index });
    const full = await f.a.list(owner);
    await rejectsWith(
      f.b.add(owner, value('Twenty-first'), { expectedGeneration: 20 }),
      'regional-location-full',
    );
    assert.deepEqual(await f.a.list(owner), full);
    const additional = await f.b.add(other, value('Other revision'), { expectedGeneration: 20 });
    assert.deepEqual(await f.a.list(other), { generation: 21, locations: [additional.location] });
    await f.a.remove(owner, full.locations[0].id, { expectedGeneration: 21 });
    await f.b.add(owner, value('Replacement after removal'), { expectedGeneration: 22 });
    assert.equal((await f.a.list(owner)).locations.length, 20);
    assert.deepEqual(await f.b.list(other), { generation: 23, locations: [additional.location] });
  } finally {
    f.close();
  }
});

test('duplicate generated place IDs roll back without replacing the existing place', async () => {
  const indexedDB = new IDBFactory();
  const store = await openRegionalLocations({
    indexedDB,
    name: 'isolated-duplicate-place',
    newId: () => 'same-place-id',
    now: () => 1000,
  });
  const owner = identity();
  try {
    const saved = await store.add(owner, value('Keep this place'), { expectedGeneration: 0 });
    await rejectsWith(
      store.add(owner, value('Must not replace'), { expectedGeneration: 1 }),
      'regional-location-conflict',
    );
    assert.deepEqual(await store.list(owner), { generation: 1, locations: [saved.location] });
  } finally {
    store.close();
  }
});
