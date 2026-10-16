import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { CLASSIC_SNAKE_PURSUIT_V1_ARCHIVED_LEVELS as previous } from '../snake/classic-catalogue-pursuit-v1-archive.mjs';
import {
  classicSnakeRecipeEntries,
  resolveClassicSnakeRecipeEntry,
} from '../snake/classic-catalogue-archive.mjs';
import { CLASSIC_EDITORIAL_REVISIONS } from '../snake/classic-catalogue-remaster.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import { restoreClassicSnakeReplay, validateClassicSnakeLevel } from '../snake/classic-core.mjs';
import { classicSnakeRatingForRecord } from '../snake/classic-ratings.mjs';
const audit = JSON.parse(
  await readFile(
    new URL('../../docs/verification/snake-operations/catalogue-audit.json', import.meta.url),
    'utf8',
  ),
);

test('the historical 144-mission audit remains exact and later editorial changes have current evidence', async () => {
  const editorial = await readFile(
    new URL(
      '../../docs/verification/snake-remaster/editorial-catalogue-completion.md',
      import.meta.url,
    ),
    'utf8',
  );
  const changed = [];
  assert.equal(audit.missions.length, 144);
  assert.equal(new Set(audit.missions.map((e) => e.id)).size, 144);
  assert.equal(audit.missions.filter((e) => e.decision === 'revise').length, 48);
  for (const row of audit.missions) {
    const current = CLASSIC_SNAKE_LEVELS.find((e) => e.id === row.id);
    if (current.level.revision === row.revision) {
      assert.equal(current.level.goal, row.goal);
    } else {
      const revision = CLASSIC_EDITORIAL_REVISIONS[row.id];
      assert.ok(revision, `${row.id}: changed audit recipe needs an explicit editorial revision`);
      assert.equal(current.level.revision, 'editorial-pacing-1');
      assert.equal(current.level.goal, revision.goal);
      assert.ok(revision.reason.length > 60);
      assert.ok(
        editorial
          .split('\n')
          .some(
            (line) =>
              line.startsWith(`| ${row.id} `) && line.includes('| Revise six catches to three.'),
          ),
        `${row.id}: the current authored review must explain the changed quota`,
      );
      const historical = classicSnakeRecipeEntries(current, { allowArchive: true }).find(
        (candidate) => candidate.level.revision === row.revision,
      );
      assert.ok(historical, `${row.id}: retain the historical audit recipe explicitly`);
      assert.equal(historical.level.goal, row.goal);
      assert.equal(historical.level.goal, 6);
      assert.equal(current.level.goal, 3);
      assert.deepEqual(
        { ...current.level, goal: historical.level.goal, revision: historical.level.revision },
        historical.level,
        'the introduction changes only quota and recipe identity',
      );
      for (const pace of ['slow', 'normal', 'fast']) {
        const recipe = prepareClassicSnakeLevel(historical, { pace });
        assert.equal(
          resolveClassicSnakeRecipeEntry(current, recipe, { pace }, { allowArchive: true }),
          historical,
        );
        assert.throws(() => resolveClassicSnakeRecipeEntry(current, recipe, { pace }));
      }
      changed.push(row.id);
    }
    assert.ok(row.tacticalDecision.length > 40 && row.reason.length > 60);
  }
  assert.deepEqual(changed.sort(), [
    'classic-field-border-watch',
    'classic-field-contour-orbit',
    'classic-field-ricochet-line',
    'classic-field-wake-watch',
  ]);
  assert.equal(CLASSIC_SNAKE_LEVELS[0].level.walls.length, 0);
});
test('revised missions preserve exact historical recipe authority and all supply windows', () => {
  assert.equal(previous.length, 48);
  for (const old of previous) {
    const entry = CLASSIC_SNAKE_LEVELS.find((e) => e.id === old.id);
    assert.equal(old.level.revision, '1');
    assert.equal(entry.level.revision, '2');
    assert.deepEqual(validateClassicSnakeLevel(entry.level), entry.level);
    assert.deepEqual(entry.level.walls, old.level.walls);
    assert.deepEqual(entry.level.spawns, old.level.spawns);
    assert.ok(entry.level.goal < old.level.goal);
    for (const pace of ['slow', 'normal', 'fast']) {
      const recipe = prepareClassicSnakeLevel(old, { pace });
      assert.equal(
        resolveClassicSnakeRecipeEntry(entry, recipe, { pace }, { allowArchive: true }).level
          .revision,
        '1',
      );
      assert.throws(() =>
        resolveClassicSnakeRecipeEntry(entry, recipe, { pace }, { allowArchive: false }),
      );
    }
    for (const offer of entry.level.pickups) assert.ok(offer.at < entry.level.goal);
    for (const at of entry.level.targets.bonus?.at ?? []) assert.ok(at < entry.level.goal);
  }
});
test('all revised Solo/Team/pace journals complete current missions', async () => {
  const proofs = JSON.parse(
    await readFile(
      new URL('./fixtures/classic-snake-variety-proofs.json', import.meta.url),
      'utf8',
    ),
  ).proofs;
  assert.equal(proofs.length, 288);
  const seen = new Set();
  for (const p of proofs) {
    const entry = CLASSIC_SNAKE_LEVELS.find((e) => e.id === p.levelId),
      level = prepareClassicSnakeLevel(entry, { pace: p.pace });
    const run = restoreClassicSnakeReplay(p.replay, { level });
    assert.equal(run.status, 'won', `${p.levelId}/${p.mode}/${p.pace}`);
    const identity = `${p.levelId}/${p.mode}/${p.pace}`;
    assert.ok(!seen.has(identity));
    seen.add(identity);
    const rating = classicSnakeRatingForRecord({
      clear: true,
      policy: 'mission',
      levelIdentity: run.levelIdentity,
      mode: p.mode,
      seed: 17,
      fewestMoves: run.tick,
    });
    assert.equal(rating.calibrated, false);
    assert.equal(rating.stars, 1);
  }
});
