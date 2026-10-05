import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import {
  CLASSIC_SNAKE_ARCHIVED_LEVELS,
  classicSnakeRecipeEntries,
  resolveClassicSnakeRecipeEntry,
} from '../snake/classic-catalogue-archive.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import {
  classicSnakeSummary,
  exportClassicSnakeReplay,
  restoreClassicSnakeReplay,
} from '../snake/classic-core.mjs';
import {
  createClassicSnakeMatch,
  advanceClassicSnakeMatchTo,
  queueClassicSnakeMatchTurn,
  exportClassicSnakeMatch,
} from '../snake/classic-match.mjs';
import { createClassicSnakeRecords } from '../snake/classic-records.mjs';
import { createClassicSnakeRatings } from '../snake/classic-ratings.mjs';
import { CLASSIC_PACKAGE_FORMAT } from '../snake/classic-community.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const archive = JSON.parse(
  await readFile(
    new URL('./fixtures/classic-snake-v4-archive-proofs.json', import.meta.url),
    'utf8',
  ),
);
const localV1 = JSON.parse(
  await readFile(new URL('./fixtures/classic-snake-local-v1-proofs.json', import.meta.url), 'utf8'),
);

function verifiedMatch(replay) {
  const match = createClassicSnakeMatch(replay.level, {
    seed: replay.seed,
    mode: replay.mode,
    ...(replay.hazardSeed === undefined ? {} : { hazardSeed: replay.hazardSeed }),
  });
  let cursor = 0;
  for (let tick = 0; tick <= replay.steps; tick++) {
    while (replay.turns[cursor]?.tick === tick) {
      const turn = replay.turns[cursor++];
      assert.equal(queueClassicSnakeMatchTurn(match, turn.playerId, turn.direction), true);
    }
    if (tick < replay.steps)
      advanceClassicSnakeMatchTo(
        match,
        match.elapsedMs + classicSnakeSummary(match.runs[0]).stepMs,
      );
  }
  assert.deepEqual(exportClassicSnakeReplay(match.runs[0]), replay);
  return match;
}

test('archived admission is bounded to nine exact official recipes and prepared variants', () => {
  assert.equal(CLASSIC_SNAKE_ARCHIVED_LEVELS.length, 9);
  assert.equal(
    CLASSIC_SNAKE_ARCHIVED_LEVELS.filter((entry) => entry.level.revision === '1').length,
    5,
  );
  assert.equal(
    CLASSIC_SNAKE_ARCHIVED_LEVELS.filter((entry) => entry.level.revision === '2').length,
    4,
  );
  for (const previous of CLASSIC_SNAKE_ARCHIVED_LEVELS) {
    const current = CLASSIC_SNAKE_LEVELS.find((entry) => entry.id === previous.id);
    assert.ok(Number(current.level.revision) > Number(previous.level.revision));
    assert.equal(classicSnakeRecipeEntries(current).length, 1);
    assert.equal(
      classicSnakeRecipeEntries(current, { allowArchive: true }).length,
      previous.id === 'classic-field-relay-airfield' ? 2 : 3,
    );
    for (const pace of ['slow', 'normal', 'fast']) {
      const setup = { pace, targetRules: 'authored', preset: 'classic' };
      const level = prepareClassicSnakeLevel(previous, setup);
      assert.equal(
        resolveClassicSnakeRecipeEntry(current, level, setup, { allowArchive: true }),
        previous,
      );
      assert.throws(
        () => resolveClassicSnakeRecipeEntry(current, level, setup),
        /catalogue definition/,
      );
      level.goal--;
      assert.throws(
        () => resolveClassicSnakeRecipeEntry(current, level, setup, { allowArchive: true }),
        /catalogue definition/,
      );
    }
  }
});

test('all 24 retired local-v1 routes preserve exact checkpoints and completion-only records', async (t) => {
  const model = managedIndexedDB();
  const records = createClassicSnakeRecords({ indexedDB: model.indexedDB });
  const replayed = [];
  assert.equal(localV1.proofs.length, 24);
  for (const { replay, pace } of localV1.proofs) {
    assert.ok(
      replay.level.targets.required.some((target) => target.signalProfile === 'local-burst-v1'),
    );
    const restored = restoreClassicSnakeReplay(replay);
    assert.equal(restored.status, 'won');
    assert.deepEqual(exportClassicSnakeReplay(restored), replay);
    const current = CLASSIC_SNAKE_LEVELS.find((entry) => entry.id === replay.level.id);
    const archived = resolveClassicSnakeRecipeEntry(
      current,
      replay.level,
      { pace },
      { allowArchive: true },
    );
    assert.equal(archived.level.revision, '2');
    assert.throws(
      () => resolveClassicSnakeRecipeEntry(current, replay.level, { pace }),
      /catalogue definition/,
    );
    const match = verifiedMatch(replay);
    await records.remember(match.runs[0], {
      mode: replay.mode,
      chapterId: archived.chapterId,
      level: replay.level,
      match: exportClassicSnakeMatch(match),
    });
    assert.equal(records.get(match.runs[0], replay.mode).rating.stars, 1);
    assert.equal(records.get(match.runs[0], replay.mode).rating.calibrated, false);
    replayed.push(match);
  }
  const before = records.snapshot();
  records.close();
  const reloaded = createClassicSnakeRecords({ indexedDB: model.indexedDB });
  const ratings = createClassicSnakeRatings({ records: reloaded, indexedDB: model.indexedDB });
  t.after(() => {
    reloaded.close();
    ratings.close();
  });
  await reloaded.read();
  await ratings.refresh();
  assert.deepEqual(reloaded.snapshot(), before);
  for (const match of replayed)
    assert.equal(ratings.get(match.runs[0], match.options.mode).stars, 1);
});

test('all thirty historical fixed-schedule grades remain verified after reload', async (t) => {
  const model = managedIndexedDB();
  const records = createClassicSnakeRecords({ indexedDB: model.indexedDB });
  const replayed = [];
  assert.equal(archive.proofs.length, 30);
  for (const { replay } of archive.proofs) {
    const match = verifiedMatch(replay);
    const entry = CLASSIC_SNAKE_ARCHIVED_LEVELS.find((item) => item.id === replay.level.id);
    await records.remember(match.runs[0], {
      mode: replay.mode,
      chapterId: entry.chapterId,
      level: replay.level,
      match: exportClassicSnakeMatch(match),
    });
    assert.equal(records.get(match.runs[0], replay.mode).rating.stars, 3);
    replayed.push(match);
  }
  const before = records.snapshot();
  records.close();
  const restored = createClassicSnakeRecords({ indexedDB: model.indexedDB });
  const ratings = createClassicSnakeRatings({ records: restored, indexedDB: model.indexedDB });
  t.after(() => {
    restored.close();
    ratings.close();
  });
  await restored.read();
  await ratings.refresh();
  for (const match of replayed) {
    assert.equal(restored.get(match.runs[0], match.options.mode).rating.stars, 3);
    assert.equal(ratings.get(match.runs[0], match.options.mode).stars, 3);
  }
  assert.deepEqual(restored.snapshot(), before, 'Existing proof records are not rewritten.');
});

test('an installed package cannot inherit official archive authority from a source ID', async (t) => {
  const entry = CLASSIC_SNAKE_LEVELS.find((item) => item.id === archive.proofs[0].replay.level.id);
  const records = createClassicSnakeRecords({
    indexedDB: null,
    contentPack: {
      format: CLASSIC_PACKAGE_FORMAT,
      title: { en: 'Custom radio', uk: 'Власне радіо' },
      entries: [{ title: entry.title, description: entry.description, level: entry.level }],
    },
  });
  t.after(() => records.close());
  const match = verifiedMatch(archive.proofs[0].replay);
  await assert.rejects(
    records.remember(match.runs[0], {
      mode: match.options.mode,
      chapterId: entry.chapterId,
      level: match.runs[0].level,
      match: exportClassicSnakeMatch(match),
    }),
    /catalogue mission/,
  );
});
