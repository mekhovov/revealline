import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS } from '../game/snake/classic-catalogue.mjs';
import { restoreClassicSnakeReplay } from '../game/snake/classic-core.mjs';
import { prepareClassicSnakeLevel } from '../game/snake/classic-setup.mjs';
import { classicSnakeRatingForRecord } from '../game/snake/classic-ratings.mjs';
const root = new URL('../docs/verification/snake-remaster/', import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));
test('trace coverage includes all accepted pace/mode routes for every current mission', async () => {
  const report = await read('catalogue-trace-review.json');
  assert.deepEqual(report.summary.missingMissions, []);
  const seen = new Set(report.runs.map((r) => `${r.levelId}/${r.mode}/${r.pace}`));
  for (const entry of CLASSIC_SNAKE_LEVELS)
    for (const mode of ['solo', 'team'])
      for (const pace of ['normal', 'slow', 'fast'])
        assert.ok(seen.has(`${entry.id}/${mode}/${pace}`));
  assert.equal(seen.size, 1440);
  assert.deepEqual(report.summary.missingSetups, []);
  assert.equal(report.summary.setups, 1440);
  assert.equal(new Set(report.runs.map((r) => r.levelId)).size, 240);
  assert.ok(report.runs.every((r) => r.source && r.steps > 0));
});
test('new foundation evidence verifies against unchanged current recipes', async () => {
  const { proofs } = await read('retained-foundation-proofs.json');
  assert.equal(proofs.length, 221);
  assert.equal(proofs.filter((p) => p.pace !== 'normal').length, 192);
  for (const p of proofs) {
    const entry = CLASSIC_SNAKE_LEVELS.find((e) => e.id === p.levelId),
      level = prepareClassicSnakeLevel(entry, { pace: p.pace });
    assert.equal(level.version, 'classic-snake-level.v1');
    assert.equal(restoreClassicSnakeReplay(p.replay, { level }).status, 'won');
  }
});
test('outlier alternatives verify without deleting their long retained baseline observations', async () => {
  const comparison = await read('outlier-trace-review.json'),
    baseline = await read('catalogue-trace-review.json'),
    { proofs } = await read('outlier-alternative-proofs.json');
  assert.equal(proofs.length, 12);
  for (const p of proofs) {
    const entry = CLASSIC_SNAKE_LEVELS.find((e) => e.id === p.levelId),
      level = prepareClassicSnakeLevel(entry, { pace: p.pace });
    assert.equal(restoreClassicSnakeReplay(p.replay, { level }).status, 'won');
  }
  const row = comparison.comparisons.find(
    (r) =>
      r.levelId === 'classic-expedition-courier-overpass' &&
      r.mode === 'solo' &&
      r.pace === 'normal',
  );
  assert.ok(row.alternateSteps < row.baselineSteps / 2);
  assert.ok(row.alternateMaxNoChangeMoves < row.baselineMaxNoChangeMoves / 2);
  assert.ok(
    baseline.runs.some(
      (r) =>
        r.levelId === row.levelId &&
        r.mode === row.mode &&
        r.pace === row.pace &&
        r.maxNoChangeMoves === row.baselineMaxNoChangeMoves,
    ),
  );
});
test('winning tactical evidence earns completion without invented higher-star budgets', async () => {
  const { proofs } = await read('tactical-proofs.json');
  for (const proof of proofs) {
    const run = restoreClassicSnakeReplay(proof.replay);
    const grade = classicSnakeRatingForRecord({
      clear: true,
      policy: 'mission',
      mode: proof.mode,
      seed: proof.replay.seed,
      levelIdentity: run.levelIdentity,
      fewestMoves: run.tick,
    });
    assert.equal(grade.stars, 1);
    assert.equal(grade.calibrated, false);
    assert.equal(grade.goldMoves, null);
    assert.equal(grade.silverMoves, null);
  }
});
