import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  createJourneyBackend,
  createJourneyProfileStore,
  emptyJourneyProfile,
  validateJourneyProfile,
  JOURNEY_COMBINED_BACKUP_VERSION,
} from '../journey/profile.mjs';
import { emptyJourneyStars, validateJourneyStars } from '../journey/stars.mjs';
import { journeyLibrarySource } from '../mission-library/journey-source.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

// Exact v0.142.3 reader/writer from 6a67d6dbfe01d5e1f3842b5a79dd5d5ddeefcfd8.
// Keep this oracle frozen: exercising the new reader twice cannot prove rollback.
const oldBytes = await readFile(
  new URL('./fixtures/journey-profile-v01423.mjs.txt', import.meta.url),
);
assert.equal(
  createHash('sha256').update(oldBytes).digest('hex'),
  'f46c3986a3487f344d2ab4eae43ce550a5e0235e2afda50c7c0f73fb29ef31c8',
);
const oldSource = oldBytes
  .toString()
  .replace(
    /from (['"])(\.\.?\/[^'"]+)\1/g,
    (_, _quote, relative) =>
      `from ${JSON.stringify(new URL(relative, new URL('../journey/profile.mjs', import.meta.url)).href)}`,
  );
const previous = await import(
  `data:text/javascript;base64,${Buffer.from(oldSource).toString('base64')}`
);
const complete = (stars, runId = 'run-1', missionId = 'mission-1') => ({
  type: 'complete',
  mode: 'solo',
  missionId,
  runId,
  gameplayId: `gameplay-${runId}`,
  difficulty: 'standard',
  ...(stars === undefined ? {} : { stars }),
});
const store = (disk, profileKey = 'journey') =>
  createJourneyProfileStore({
    backend: createJourneyBackend({ ...disk, profileKey }),
  });

test('inherited Object names remain valid mission identities without inventing stars', async () => {
  const disk = managedIndexedDB(),
    current = store(disk);
  for (const id of ['toString', 'valueOf']) {
    current.record(complete(undefined, `legacy-${id}`, id));
    assert.equal(await current.flush(), true);
    assert.equal(current.bestStars('solo', id), null);
    current.record(complete(2, `new-${id}`, id));
    assert.equal(await current.flush(), true);
    assert.equal(current.bestStars('solo', id), 2);
  }
  const recreated = store(disk);
  await recreated.load();
  assert.equal(recreated.bestStars('solo', 'toString'), 2);
  assert.equal(recreated.bestStars('solo', 'valueOf'), 2);
  assert.equal(recreated.bestStars('solo', 'hasOwnProperty'), null);
});

for (const profileKey of ['journey', 'journey-company-example'])
  test(`previous-release read and writes preserve new stars in ${profileKey}`, async () => {
    const disk = managedIndexedDB(),
      current = store(disk, profileKey);
    const old = previous.createJourneyBackend({ ...disk, profileKey });
    current.record(complete(3));
    assert.equal(await current.flush(), true);
    assert.deepEqual(await old.read(), current.snapshot());
    await old.commit([complete(undefined, 'old-replay')]);
    await Promise.all([
      old.commit([{ type: 'select', mode: 'solo', missionId: 'older-tab-selection' }]),
      createJourneyBackend({ ...disk, profileKey }).commit([complete(1, 'new-replay')]),
    ]);
    const recreated = store(disk, profileKey);
    await recreated.load();
    assert.equal(recreated.bestStars('solo', 'mission-1'), 3);
    assert.equal(recreated.snapshot().cursors.solo, 'older-tab-selection');
    assert.deepEqual(await old.read(), recreated.snapshot());
    assert.deepEqual(Object.keys(recreated.snapshot().clears.solo['mission-1']), [
      'runId',
      'gameplayId',
      'difficulty',
    ]);
    assert.equal(
      disk.contents().get('profiles').get(`${profileKey}:stars.v1`).best.solo['mission-1'],
      3,
    );
    assert.deepEqual(previous.validateJourneyProfile(recreated.snapshot()), recreated.snapshot());
  });

test('failed star write rolls back the v1 clear; session stars remain exportable and retry atomically', async () => {
  const disk = managedIndexedDB(),
    current = store(disk);
  await current.load();
  disk.failAnyPutAt = 2;
  current.record(complete(2));
  assert.equal(await current.flush(), false);
  assert.deepEqual(await previous.createJourneyBackend(disk).read(), emptyJourneyProfile());
  assert.equal(disk.contents().get('profiles').has('journey:stars.v1'), false);
  const backup = JSON.parse(current.export());
  assert.equal(backup.format, JOURNEY_COMBINED_BACKUP_VERSION);
  assert.equal(backup.stars.best.solo['mission-1'], 2);
  assert.deepEqual(previous.validateJourneyProfile(backup.profile), backup.profile);
  disk.failAnyPutAt = null;
  assert.equal(await current.flush(), true);
  const recreated = store(disk);
  await recreated.load();
  assert.equal(recreated.bestStars('solo', 'mission-1'), 2);
});

test('versioned star backups round trip while old backups retain their format and merge without losing stars', async () => {
  const source = store(managedIndexedDB(), 'journey-company-example');
  source.record(complete(3));
  await source.flush();
  const exported = source.export(),
    parsed = JSON.parse(exported);
  assert.equal(parsed.format, 'revealline-journey-backup.v5');
  assert.deepEqual(previous.validateJourneyProfile(parsed.profile), parsed.profile);
  const oldStore = previous.createJourneyProfileStore({
    backend: previous.createJourneyBackend({
      ...managedIndexedDB(),
      profileKey: 'journey-company-example',
    }),
  });
  assert.throws(() => oldStore.inspectBackup(exported), /edition|backup/i);
  assert.deepEqual(oldStore.snapshot(), emptyJourneyProfile());
  const target = store(managedIndexedDB(), 'journey-company-example');
  target.restore(exported);
  assert.equal(await target.flush(), true);
  assert.equal(target.bestStars('solo', 'mission-1'), 3);
  oldStore.record(complete(undefined, 'legacy-backup', 'mission-2'));
  await oldStore.flush();
  const legacy = oldStore.export();
  assert.equal(JSON.parse(legacy).format, 'revealline-journey-backup.v2');
  target.restore(legacy);
  assert.equal(await target.flush(), true);
  assert.equal(target.bestStars('solo', 'mission-1'), 3);
  assert.equal(target.bestStars('solo', 'mission-2'), null);
  const plain = store(managedIndexedDB());
  plain.record(complete(undefined));
  await plain.flush();
  assert.deepEqual(previous.inspectJourneyBackup(plain.export()).profile, plain.snapshot());
});

test('malformed or cross-edition star imports cannot mutate a profile', async () => {
  const source = store(managedIndexedDB());
  source.record(complete(2));
  await source.flush();
  const valid = JSON.parse(source.export());
  const invalid = [
    { ...valid, profileKey: 'journey-other' },
    { ...valid, stars: { ...valid.stars, extra: true } },
    {
      ...valid,
      stars: { ...valid.stars, best: { ...valid.stars.best, solo: { 'mission-1': 4 } } },
    },
    { ...valid, stars: { ...valid.stars, best: { ...valid.stars.best, solo: { missing: 3 } } } },
    {
      ...valid,
      profile: {
        ...valid.profile,
        clears: {
          ...valid.profile.clears,
          solo: { 'mission-1': { ...valid.profile.clears.solo['mission-1'], bestStars: 2 } },
        },
      },
    },
  ];
  for (const value of invalid) {
    const target = store(managedIndexedDB());
    assert.throws(() => target.restore(value));
    assert.deepEqual(target.snapshot(), emptyJourneyProfile());
    assert.deepEqual(target.stars(), emptyJourneyStars());
  }
  assert.throws(() => validateJourneyStars(' '.repeat(2 * 1024 * 1024 + 1)));
});

test('an older-tab profile reset hides orphan stars and a fresh completion starts its own grade', async () => {
  const disk = managedIndexedDB(),
    current = store(disk);
  current.record(complete(3));
  await current.flush();
  // An old reset touches only its known record, leaving the unknown sidecar intact.
  const db = await new Promise((resolve, reject) => {
    const open = disk.indexedDB.open('revealline-journey-v1', 1);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('profiles', 'readwrite');
    tx.objectStore('profiles').put(emptyJourneyProfile(), 'journey');
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  const recreated = store(disk);
  await recreated.load();
  assert.equal(recreated.bestStars('solo', 'mission-1'), null);
  recreated.record(complete(1, 'fresh-run'));
  assert.equal(await recreated.flush(), true);
  assert.equal(recreated.bestStars('solo', 'mission-1'), 1);
  const adapter = journeyLibrarySource({
    editionId: 'example',
    edition: 'Example',
    catalog: { missions: [] },
    profile: recreated,
  });
  assert.deepEqual(adapter.progressState({ id: 'mission-1' }, 'solo'), {
    state: 'completed',
    bestStars: 1,
  });
  assert.deepEqual(
    validateJourneyProfile(await previous.createJourneyBackend(disk).read()),
    recreated.snapshot(),
  );
});
