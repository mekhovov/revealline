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

test('archived admission accepts only exact retired official recipes and prepared variants', () => {
  assert.equal(
    CLASSIC_SNAKE_ARCHIVED_LEVELS.filter((entry) => entry.level.version.endsWith('v1')).length,
    33,
  );
  const identities = new Set(
    CLASSIC_SNAKE_ARCHIVED_LEVELS.map((entry) => JSON.stringify(entry.level)),
  );
  assert.equal(
    identities.size,
    CLASSIC_SNAKE_ARCHIVED_LEVELS.length,
    'archives contain no duplicate recipes',
  );
  for (const previous of CLASSIC_SNAKE_ARCHIVED_LEVELS) {
    const current = CLASSIC_SNAKE_LEVELS.find((entry) => entry.id === previous.id);
    assert.notEqual(current.level.revision, previous.level.revision);
    // Named campaign revisions are opaque identities, not numeric counters.
    if ([current, previous].every((entry) => Number.isFinite(Number(entry.level.revision))))
      assert.ok(Number(current.level.revision) > Number(previous.level.revision));
    assert.equal(classicSnakeRecipeEntries(current).length, 1);
    assert.equal(
      classicSnakeRecipeEntries(current, { allowArchive: true }).length,
      1 + CLASSIC_SNAKE_ARCHIVED_LEVELS.filter((entry) => entry.id === previous.id).length,
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
      // Operations bind the final cumulative stage to their goal. A changed
      // named revision stays schema-valid but must not inherit archive authority.
      if (level.operation) level.revision += '-tampered';
      else level.goal--;
      assert.throws(
        () => resolveClassicSnakeRecipeEntry(current, level, setup, { allowArchive: true }),
        /catalogue definition/,
      );
    }
  }
});

test('fresh campaign rejects retired proofs without removing their engine replay support', async (t) => {
  const model = managedIndexedDB();
  const records = createClassicSnakeRecords({ indexedDB: model.indexedDB });
  const ratings = createClassicSnakeRatings({ records, indexedDB: model.indexedDB });
  t.after(() => {
    records.close();
    ratings.close();
  });
  for (const { replay } of [...localV1.proofs, ...archive.proofs]) {
    const restored = restoreClassicSnakeReplay(replay);
    assert.equal(restored.status, 'won');
    assert.deepEqual(exportClassicSnakeReplay(restored), replay);
  }
  for (const { replay } of [localV1.proofs[0], archive.proofs[0]]) {
    const match = verifiedMatch(replay);
    const entry = CLASSIC_SNAKE_ARCHIVED_LEVELS.find((item) => item.id === replay.level.id);
    await assert.rejects(
      records.remember(match.runs[0], {
        mode: replay.mode,
        chapterId: entry.chapterId,
        level: replay.level,
        match: exportClassicSnakeMatch(match),
      }),
      /catalogue definition/,
    );
  }
  await ratings.refresh();
  assert.deepEqual(records.snapshot().rows, {});
  assert.deepEqual(ratings.snapshot().best, {});
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
