import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { CLASSIC_SNAKE_RATING_CALIBRATIONS } from '../snake/classic-rating-calibrations.mjs';
import {
  classicSnakeRatingForRecord,
  createClassicSnakeRatings,
  CLASSIC_SNAKE_RATINGS_FORMAT,
  CLASSIC_SNAKE_RATING_REVISION,
} from '../snake/classic-ratings.mjs';
import { createClassicSnakeRecords } from '../snake/classic-records.mjs';
import {
  restoreClassicSnakeLegacyMatch,
  exportClassicSnakeMatch,
} from '../snake/classic-match.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';

test('grades bind the exact seed, pace, mode and accepted recipe', () => {
  const sample = CLASSIC_SNAKE_RATING_CALIBRATIONS.find(
    (row) =>
      row.levelId === 'classic-snake-open-loop' && row.mode === 'solo' && row.pace === 'normal',
  );
  const row = {
    key: sample.key,
    clear: true,
    policy: 'mission',
    fewestMoves: sample.referenceMoves,
  };
  assert.equal(classicSnakeRatingForRecord(row).stars, 3);
  assert.equal(classicSnakeRatingForRecord({ ...row, fewestMoves: sample.goldMoves + 1 }).stars, 2);
  assert.equal(
    classicSnakeRatingForRecord({ ...row, fewestMoves: sample.silverMoves + 1 }).stars,
    1,
  );
  for (const key of [
    sample.key.replace('/17', '/18'),
    sample.key.replace('solo/', 'team/'),
    sample.key.replace(sample.levelIdentity, 'foreign-recipe'),
  ]) {
    assert.equal(classicSnakeRatingForRecord({ ...row, key }).stars, 1);
    assert.equal(classicSnakeRatingForRecord({ ...row, key }).calibrated, false);
  }
  assert.equal(classicSnakeRatingForRecord({ ...row, policy: 'endless' }).stars, 0);
  assert.equal(
    classicSnakeRatingForRecord({ ...row, key: sample.key.replace('solo/', 'versus/') }).stars,
    0,
  );
  assert.equal(classicSnakeRatingForRecord({ ...row, clear: false }).stars, 0);
  assert.ok(
    ['slow', 'normal', 'fast'].every((pace) =>
      CLASSIC_SNAKE_RATING_CALIBRATIONS.some(
        (item) => item.levelId === sample.levelId && item.mode === 'solo' && item.pace === pace,
      ),
    ),
  );
});

test('historical verified records derive stars without modifying old record format or replay bytes', async (t) => {
  const model = managedIndexedDB(),
    records = createClassicSnakeRecords({ indexedDB: model.indexedDB });
  const ratings = createClassicSnakeRatings({ records, indexedDB: model.indexedDB });
  t.after(() => {
    records.close();
    ratings.close();
  });
  const raw = await readFile(
    new URL(
      '../../docs/verification/classic-snake/authored-open-loop.replay.json',
      import.meta.url,
    ),
    'utf8',
  );
  const replay = JSON.parse(raw),
    entry = CLASSIC_SNAKE_LEVELS.find((row) => row.id === replay.level.id);
  const match = restoreClassicSnakeLegacyMatch(
    { replays: [replay], mode: 'solo', elapsedMs: 18600 },
    { level: entry.level },
  );
  await records.remember(match.runs[0], {
    mode: 'solo',
    policy: 'mission',
    chapterId: entry.chapterId,
    level: entry.level,
    match: exportClassicSnakeMatch(match),
  });
  const before = records.snapshot();
  await ratings.refresh();
  assert.equal(ratings.get(match.runs[0], 'solo').stars, 3);
  assert.equal(records.get(match.runs[0], 'solo').rating.stars, 3);
  assert.deepEqual(records.snapshot(), before);
  assert.equal(before.format, 'classic-snake-progress.proof.v2');
  assert.equal(
    await readFile(
      new URL(
        '../../docs/verification/classic-snake/authored-open-loop.replay.json',
        import.meta.url,
      ),
      'utf8',
    ),
    raw,
  );
  assert.equal(Object.values(ratings.snapshot().best)[0], 3);
});

test('future rating sidecars retain their original bytes instead of minting stars', async (t) => {
  const model = managedIndexedDB(),
    records = createClassicSnakeRecords({ indexedDB: model.indexedDB });
  t.after(() => records.close());
  const key = `${CLASSIC_SNAKE_RATINGS_FORMAT}/${CLASSIC_SNAKE_RATING_REVISION}/${records.ratingScope}`;
  const unknown = { format: 'classic-snake-ratings.future', keep: ['original bytes'] };
  const seed = createProfileRecordBackend({
    key,
    empty: () => unknown,
    validate: (value) => value,
    indexedDB: model.indexedDB,
  });
  await seed.update(() => unknown);
  seed.close();
  model.allPuts.length = 0;
  const ratings = createClassicSnakeRatings({ records, indexedDB: model.indexedDB });
  t.after(() => ratings.close());
  await ratings.refresh();
  assert.deepEqual(ratings.snapshot().best, {});
  assert.deepEqual(model.contents().get('profiles').get(key), unknown);
  assert.equal(model.allPuts.length, 0);
});

test('denied IndexedDB getters preserve playable records and ratings without boot errors', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    get() {
      throw new DOMException('Storage blocked', 'SecurityError');
    },
  });
  let records, ratings;
  try {
    records = createClassicSnakeRecords();
    ratings = createClassicSnakeRatings({ records });
    await records.read();
    await ratings.refresh();
    assert.deepEqual(ratings.snapshot().best, {});
  } finally {
    records?.close();
    ratings?.close();
    if (previous) Object.defineProperty(globalThis, 'indexedDB', previous);
    else delete globalThis.indexedDB;
  }
});
