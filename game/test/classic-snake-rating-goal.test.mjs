import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  classicSnakeRatingForRecord,
  classicSnakeRatingGoal,
  classicSnakeRatingResultText,
} from '../snake/classic-ratings.mjs';
import {
  createClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
  exportClassicSnakeMatch,
  restoreClassicSnakeMatch,
} from '../snake/classic-match.mjs';
import { createClassicSnakeRecords } from '../snake/classic-records.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
const replay = JSON.parse(
  await readFile(
    new URL(
      '../../docs/verification/classic-snake/authored-open-loop.replay.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const rowFor = (run) => ({
  clear: true,
  policy: 'mission',
  mode: 'solo',
  seed: run.seed,
  levelIdentity: run.levelIdentity,
  fewestMoves: run.tick,
});
function completed(circuits) {
  const match = createClassicSnakeMatch(replay.level, { mode: 'solo', seed: replay.seed });
  const step = () => advanceClassicSnakeMatchTo(match, match.elapsedMs + 200);
  for (let circuit = 0; circuit < circuits; circuit++)
    for (const direction of ['down', 'left', 'up', 'right']) {
      assert.equal(queueClassicSnakeMatchTurn(match, 0, direction), true);
      for (let i = 0; i < 3; i++) step();
    }
  let cursor = 0;
  for (let tick = 0; tick < replay.steps; tick++) {
    while (replay.turns[cursor]?.tick === tick)
      assert.equal(queueClassicSnakeMatchTurn(match, 0, replay.turns[cursor++].direction), true);
    step();
  }
  assert.equal(match.result, 'won');
  assert.equal(match.runs[0].tick, 93 + circuits * 12);
  return match;
}

test('native verified Snake clears explain the current attempt even when stored best is Gold', async (t) => {
  const model = managedIndexedDB();
  const records = createClassicSnakeRecords({ indexedDB: model.indexedDB });
  t.after(() => records.close());
  for (const [circuits, stars, gap] of [
    [0, 3, null],
    [3, 2, 12],
    [7, 1, 14],
  ]) {
    const match = completed(circuits),
      run = match.runs[0];
    const accepted = exportClassicSnakeMatch(match);
    assert.deepEqual(
      exportClassicSnakeMatch(restoreClassicSnakeMatch(accepted, { level: replay.level })),
      accepted,
    );
    const receipt = await records.remember(run, {
      mode: 'solo',
      policy: 'mission',
      chapterId: CLASSIC_SNAKE_LEVELS.find((entry) => entry.id === run.level.id).chapterId,
      level: replay.level,
      match: accepted,
    });
    assert.equal(receipt.verified, true);
    assert.equal(receipt.saved, true);
    assert.equal(records.get(run, 'solo').fewest.value, 93);
    const before = records.snapshot();
    const grade = classicSnakeRatingForRecord(rowFor(run));
    assert.equal(grade.stars, stars);
    const goal = classicSnakeRatingGoal(grade, run.tick);
    assert.equal(Object.isFrozen(goal), true);
    if (gap === null) assert.deepEqual(goal, { state: 'highest', moves: 93 });
    else
      assert.deepEqual(goal, {
        state: 'next',
        moves: run.tick,
        stars: stars + 1,
        target: stars === 1 ? 163 : 117,
        shortfall: gap,
      });
    for (const locale of ['en', 'uk', 'en']) {
      const text = classicSnakeRatingResultText(grade, run.tick, locale);
      assert.ok(text.includes(String(run.tick)));
      assert.match(text, locale === 'uk' ? /Ця спроба/ : /This attempt/);
      assert.deepEqual(exportClassicSnakeMatch(match), accepted);
      assert.deepEqual(records.snapshot(), before);
    }
  }
});

test('exact native star boundaries and one-move shortfalls remain integer goals', () => {
  const run = completed(0).runs[0],
    row = rowFor(run);
  for (const [moves, expected] of [
    [117, 'highest'],
    [118, 1],
    [163, 46],
    [164, 1],
  ]) {
    const grade = classicSnakeRatingForRecord({ ...row, fewestMoves: moves });
    const goal = classicSnakeRatingGoal(grade, moves);
    if (expected === 'highest') assert.equal(goal.state, 'highest');
    else assert.equal(goal.shortfall, expected);
  }
  const grade = classicSnakeRatingForRecord({ ...row, fewestMoves: 118 });
  assert.match(classicSnakeRatingResultText(grade, 118, 'en'), /1 fewer move\./);
  assert.match(classicSnakeRatingResultText(grade, 118, 'uk'), /на 1 хід менше/);
  const few = classicSnakeRatingForRecord({ ...row, fewestMoves: 119 });
  assert.match(classicSnakeRatingResultText(few, 119, 'uk'), /на 2 ходи менше/);
});

test('completion-only, uncalibrated, competitive, endless and unavailable grades promise no higher rating', () => {
  const run = completed(0).runs[0],
    row = rowFor(run);
  for (const change of [
    { completionOnly: true },
    { seed: 18 },
    { levelIdentity: 'changed' },
    { mode: 'versus' },
    { policy: 'endless' },
    { clear: false },
  ]) {
    const grade = classicSnakeRatingForRecord({ ...row, ...change });
    assert.equal(classicSnakeRatingGoal(grade, run.tick), null);
    for (const locale of ['en', 'uk'])
      assert.equal(classicSnakeRatingResultText(grade, run.tick, locale), '');
  }
  const grade = classicSnakeRatingForRecord(row);
  for (const moves of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, 118])
    assert.equal(classicSnakeRatingGoal(grade, moves), null);
  for (const invalid of [
    null,
    { ...grade, goldMoves: null },
    { ...grade, silverMoves: 1 },
    { ...grade, stars: 0 },
  ])
    assert.equal(classicSnakeRatingGoal(invalid, run.tick), null);
});
