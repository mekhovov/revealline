import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { CLASSIC_SNAKE_PURSUIT_V1_ARCHIVED_LEVELS as previous } from '../snake/classic-catalogue-pursuit-v1-archive.mjs';
import { resolveClassicSnakeRecipeEntry } from '../snake/classic-catalogue-archive.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import { restoreClassicSnakeReplay, validateClassicSnakeLevel } from '../snake/classic-core.mjs';
import { classicSnakeRatingForRecord } from '../snake/classic-ratings.mjs';
const audit = JSON.parse(
  await readFile(
    new URL('../../docs/verification/snake-operations/catalogue-audit.json', import.meta.url),
    'utf8',
  ),
);

test('all 144 original missions have a keep/revise decision and a concrete route rationale', () => {
  assert.equal(audit.missions.length, 144);
  assert.equal(new Set(audit.missions.map((e) => e.id)).size, 144);
  assert.equal(audit.missions.filter((e) => e.decision === 'revise').length, 48);
  for (const row of audit.missions) {
    const current = CLASSIC_SNAKE_LEVELS.find((e) => e.id === row.id);
    assert.equal(current.level.goal, row.goal);
    assert.equal(current.level.revision, row.revision);
    assert.ok(row.tacticalDecision.length > 40 && row.reason.length > 60);
  }
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
