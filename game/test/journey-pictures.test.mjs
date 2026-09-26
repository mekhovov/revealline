import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createJourneyBackend,
  createJourneyProfileStore,
  emptyJourneyProfile,
  applyJourneyEvent,
} from '../journey/profile.mjs';
import {
  emptyJourneyPictures,
  validateJourneyPictures,
  applyJourneyPictureEvent,
  journeyPictureCompletion,
} from '../journey/pictures.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

function completion(overrides = {}) {
  const picture = {
    mode: 'solo',
    editionId: 'whole-spatial-v5',
    missionId: 'candidate/p/c/l',
    campaignKey: 'campaign@1',
    levelId: 'l',
    levelRevision: '1',
    runId: 'run-1',
    gameplayId: 'exact-gameplay',
    difficulty: 'standard',
    name: 'First line',
    campaignTitle: 'First campaign',
    themeId: 'fpv',
    asset: {
      format: 'AssetRevisionV1',
      id: 'first-line',
      revision: 'r1',
      kind: 'reveal-background',
      path: 'content-design/assets/test/first-line.png',
      sha256: 'a'.repeat(64),
      bytes: 100,
      width: 32,
      height: 16,
      alt: 'Original field picture',
      review: 'candidate',
    },
    ...overrides,
  };
  return {
    type: 'complete',
    ...Object.fromEntries(
      ['mode', 'missionId', 'runId', 'gameplayId', 'difficulty'].map((field) => [
        field,
        picture[field],
      ]),
    ),
    picture,
  };
}
function store(disk, key = 'journey-whole-spatial-v5') {
  const backend = createJourneyBackend({ ...disk, profileKey: key });
  return { backend, profile: createJourneyProfileStore({ backend }) };
}

test('strict historical profile receipts remain unchanged; exact picture descriptor is a separate companion', async () => {
  const disk = managedIndexedDB(),
    { backend, profile } = store(disk);
  await profile.load();
  profile.record(completion());
  assert.equal(await profile.flush(), true);
  const saved = await backend.readState();
  assert.deepEqual(saved.profile.clears.solo['candidate/p/c/l'], {
    runId: 'run-1',
    gameplayId: 'exact-gameplay',
    difficulty: 'standard',
  });
  assert.deepEqual(saved.pictures.records, [completion().picture]);
  assert.deepEqual(
    new Set(disk.allPuts.map(([, key]) => key)),
    new Set(['journey-whole-spatial-v5', 'journey-whole-spatial-v5:pictures.v1']),
  );
  const fresh = store(disk).profile;
  await fresh.load();
  assert.deepEqual(fresh.pictures(), profile.pictures());
  assert.deepEqual(await createJourneyBackend(disk).read(), emptyJourneyProfile());
});

test('failure of the second write rolls back both receipts; session original exports and retries atomically', async () => {
  const disk = managedIndexedDB(),
    { backend, profile } = store(disk);
  await profile.load();
  disk.failAnyPutAt = 2;
  profile.record(completion());
  assert.equal(await profile.flush(), false);
  assert.deepEqual(await backend.readState(), {
    profile: emptyJourneyProfile(),
    pictures: emptyJourneyPictures(),
  });
  assert.equal(profile.pictures().records[0].asset.sha256, 'a'.repeat(64));
  const backup = JSON.parse(profile.export());
  assert.equal(backup.format, 'revealline-journey-backup.v3');
  assert.deepEqual(backup.pictures.records[0], completion().picture);
  disk.failAnyPutAt = null;
  assert.equal(await profile.flush(), true);
  assert.deepEqual((await backend.readState()).pictures, backup.pictures);
});

test('picture write failure durably falls back to the exact clear receipt after immediate caller teardown', async () => {
  const disk = managedIndexedDB(),
    { profile } = store(disk);
  await profile.load();
  disk.failAnyPutAt = 2;
  const settling = profile.recordWithReceiptFallback(completion());
  // The page may release all references as soon as the terminal frame is
  // presented. The owned settlement promise must still finish the fallback.
  const result = await settling;
  assert.deepEqual(result, {
    durable: true,
    picture: false,
    fallback: true,
    error: 'Injected storage write failure',
  });
  const fresh = store(disk).profile;
  await fresh.load();
  assert.equal(fresh.snapshot().clears.solo['candidate/p/c/l'].runId, 'run-1');
  assert.deepEqual(fresh.pictures().records, []);
  assert.equal(fresh.status().durable, true);
});

test('a completion without available artwork still durably records progress', async () => {
  const disk = managedIndexedDB(),
    { profile } = store(disk),
    { picture: _picture, ...receipt } = completion();
  await profile.load();
  assert.deepEqual(await profile.recordWithReceiptFallback(receipt), {
    durable: true,
    picture: false,
    fallback: false,
    error: null,
  });
  const fresh = store(disk).profile;
  await fresh.load();
  assert.equal(fresh.snapshot().clears.solo['candidate/p/c/l'].runId, 'run-1');
  assert.deepEqual(fresh.pictures().records, []);
});

test('concurrent tabs keep independent mode and edition originals; duplicate terminal delivery is idempotent', async () => {
  const disk = managedIndexedDB(),
    a = store(disk).profile,
    b = store(disk).profile;
  await Promise.all([a.load(), b.load()]);
  a.record(completion());
  b.record(completion({ mode: 'versus', runId: 'race-1' }));
  await Promise.all([a.flush(), b.flush()]);
  a.record(completion());
  await a.flush();
  assert.equal(a.pictures().records.length, 2);
  a.record(completion({ runId: 'retry-2' }));
  await a.flush();
  assert.equal(a.pictures().records.length, 2);
  a.record(completion({ editionId: 'earlier-edition', runId: 'earlier-run' }));
  await a.flush();
  assert.equal(a.pictures().records.length, 3);
  assert.equal(a.snapshot().clears.versus['candidate/p/c/l'].runId, 'race-1');
});

test('changed artwork keeps the earlier original; same admitted run cannot change identity or descriptor', () => {
  const first = completion(),
    original = applyJourneyPictureEvent(emptyJourneyPictures(), first);
  const newer = completion({
    runId: 'new-run',
    asset: { ...first.picture.asset, revision: 'r2', sha256: 'b'.repeat(64) },
  });
  const both = applyJourneyPictureEvent(original, newer);
  assert.equal(both.records.length, 2);
  assert.deepEqual(both.records[0], first.picture);
  for (const change of [{ editionId: 'other' }, { gameplayId: 'wrong' }, { mode: 'team' }]) {
    const bad = completion(change);
    if (change.mode) bad.mode = 'solo';
    assert.throws(() => applyJourneyPictureEvent(original, bad), /cannot replace|must agree/);
  }
  assert.throws(
    () =>
      applyJourneyPictureEvent(original, {
        ...first,
        picture: {
          ...first.picture,
          asset: { ...first.picture.asset, path: 'content-design/assets/other.png' },
        },
      }),
    /cannot replace/,
  );
  assert.deepEqual(original.records, [first.picture]);
});

test('invalid artwork, geometry, structural bounds, duplicate identities and non-completion admission fail closed', () => {
  const event = completion();
  for (const asset of [
    { path: 'https://example.org/picture.png' },
    { sha256: 'wrong' },
    { width: 0 },
    { bytes: 99999999 },
  ])
    assert.throws(() =>
      applyJourneyPictureEvent(emptyJourneyPictures(), {
        ...event,
        picture: { ...event.picture, asset: { ...event.picture.asset, ...asset } },
      }),
    );
  assert.throws(
    () => applyJourneyPictureEvent(emptyJourneyPictures(), { ...event, type: 'select' }),
    /Only a completed/,
  );
  assert.throws(
    () =>
      validateJourneyPictures({
        ...emptyJourneyPictures(),
        records: [event.picture, event.picture],
      }),
    /Duplicate/,
  );
  assert.throws(
    () =>
      validateJourneyPictures({
        ...emptyJourneyPictures(),
        records: Array(2049).fill(event.picture),
      }),
    /budget/,
  );
});

test('ambiguous historical clears never borrow current artwork; exact mode and edition required', () => {
  const event = completion(),
    profile = applyJourneyEvent(emptyJourneyProfile(), event),
    pictures = applyJourneyPictureEvent(emptyJourneyPictures(), event),
    query = {
      profile,
      pictures,
      mode: 'solo',
      editionId: 'whole-spatial-v5',
      missionId: event.missionId,
    };
  assert.equal(journeyPictureCompletion(query).state, 'earned');
  assert.equal(journeyPictureCompletion({ ...query, mode: 'team' }).state, 'unfinished');
  const older = journeyPictureCompletion({ ...query, editionId: 'unknown-edition' });
  assert.equal(older.state, 'unavailable');
  assert.match(older.reason, /Earlier edition/);
  assert.equal(older.record, undefined);
  assert.equal(
    journeyPictureCompletion({ ...query, pictures: emptyJourneyPictures() }).state,
    'unavailable',
  );
});

test('backup references round-trip; foreign scopes and conflicting originals reject before mutation', async () => {
  const a = store(managedIndexedDB()).profile,
    b = store(managedIndexedDB()).profile;
  await Promise.all([a.load(), b.load()]);
  a.record(completion());
  await a.flush();
  const backup = a.export();
  assert.equal(backup.includes('data:image'), false);
  b.restore(backup);
  await b.flush();
  assert.deepEqual(b.pictures(), a.pictures());
  assert.deepEqual(b.snapshot().clears, a.snapshot().clears);
  const before = b.export(),
    conflicting = JSON.parse(backup);
  conflicting.pictures.records[0].asset.sha256 = 'c'.repeat(64);
  assert.throws(() => b.inspectBackup(conflicting), /cannot replace/);
  assert.throws(() => b.restore(conflicting), /cannot replace/);
  assert.equal(b.export(), before);
  assert.throws(
    () => store(managedIndexedDB(), 'foreign').profile.restore(backup),
    /different Journey edition/,
  );
});

test('restore rejects orphan, cross-edition and mismatched picture completion references', async () => {
  const source = store(managedIndexedDB()).profile,
    target = store(managedIndexedDB()).profile;
  await Promise.all([source.load(), target.load()]);
  source.record(completion());
  await source.flush();
  const valid = JSON.parse(source.export()),
    invalid = [];
  const orphan = structuredClone(valid);
  delete orphan.profile.clears.solo[completion().missionId];
  invalid.push(orphan);
  for (const patch of [
    { editionId: 'whole-spatial-v4' },
    { mode: 'team' },
    { runId: 'another-run' },
    { gameplayId: 'another-gameplay' },
    { difficulty: 'expert' },
  ]) {
    const backup = structuredClone(valid);
    Object.assign(backup.pictures.records[0], patch);
    invalid.push(backup);
  }
  for (const backup of invalid) {
    assert.throws(() => target.inspectBackup(backup), /picture/i);
    assert.throws(() => target.restore(backup), /picture/i);
    assert.deepEqual(target.snapshot(), emptyJourneyProfile());
    assert.deepEqual(target.pictures(), emptyJourneyPictures());
    assert.equal(target.status().pending, 0);
  }
  target.record({
    type: 'complete',
    mode: 'solo',
    missionId: completion().missionId,
    runId: 'current-run',
    gameplayId: 'current-gameplay',
    difficulty: 'expert',
  });
  await target.flush();
  const current = target.snapshot();
  assert.throws(() => target.inspectBackup(valid), /picture.*completion/i);
  assert.throws(() => target.restore(valid), /picture.*completion/i);
  assert.deepEqual(target.snapshot(), current);
  assert.deepEqual(target.pictures(), emptyJourneyPictures());
  assert.equal(target.status().pending, 0);
});

test('v1 and v2 backups preserve companion originals and unsupported backends report session-only safely', async () => {
  const disk = managedIndexedDB(),
    { profile } = store(disk);
  await profile.load();
  profile.record(completion());
  await profile.flush();
  const original = profile.pictures();
  profile.restore({
    format: 'revealline-journey-backup.v2',
    profileKey: 'journey-whole-spatial-v5',
    profile: emptyJourneyProfile(),
  });
  await profile.flush();
  assert.deepEqual(profile.pictures(), original);
  const legacyDisk = managedIndexedDB(),
    legacy = store(legacyDisk, 'journey').profile;
  await legacy.load();
  legacy.record(completion({ editionId: 'historical-edition' }));
  await legacy.flush();
  const legacyOriginal = legacy.pictures();
  legacy.restore({ format: 'revealline-journey-backup.v1', profile: emptyJourneyProfile() });
  await legacy.flush();
  assert.deepEqual(legacy.pictures(), legacyOriginal);
  let writes = 0;
  const oldBackend = createJourneyProfileStore({
    backend: {
      read: async () => emptyJourneyProfile(),
      commit: async () => {
        writes++;
        return emptyJourneyProfile();
      },
    },
  });
  await oldBackend.load();
  oldBackend.record(completion());
  assert.equal(await oldBackend.flush(), false);
  assert.equal(writes, 0);
  assert.match(oldBackend.status().error, /cannot safely save picture/);
  assert.deepEqual(oldBackend.pictures().records[0], completion().picture);
});
