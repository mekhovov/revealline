import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canonicalJSON, dataIdentity } from '../game/data-json.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../game/snake/classic-catalogue.mjs';
import { prepareClassicSnakeLevel } from '../game/snake/classic-setup.mjs';
import { restoreClassicSnakeReplay } from '../game/snake/classic-core.mjs';
import { classicSnakeRatingForRecord } from '../game/snake/classic-ratings.mjs';
import { visibleSnakeRouteTurn } from './lib/snake-visible-route-pilot.mjs';

test('visible pilot follows a real detour without hidden state or changing the visible board', () => {
  const view = {
    width: 5,
    height: 4,
    walls: [{ x: 2, y: 1 }],
    body: [
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    direction: 'right',
    target: { x: 3, y: 1 },
  };
  const before = structuredClone(view);
  const turn = visibleSnakeRouteTurn(view);
  assert.ok(['up', 'down'].includes(turn));
  assert.deepEqual(view, before);
  assert.equal(
    visibleSnakeRouteTurn({
      ...view,
      walls: [
        { x: 2, y: 1 },
        { x: 1, y: 0 },
        { x: 1, y: 2 },
      ],
    }),
    null,
  );
});

test('second implementation evidence verifies exact recipes and does not manufacture grade keys', async () => {
  const report = JSON.parse(
    await readFile(
      new URL(
        '../docs/verification/snake-remaster/rating-independent-evidence.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  assert.equal(report.summary.setups, 5);
  assert.equal(report.summary.completionOnlyCandidates, 4);
  assert.equal(report.summary.proposedNewBudgets, 0);
  assert.equal(report.summary.humanObservations, 0);
  let changedRoutes = 0;
  for (const row of report.rows) {
    const level = prepareClassicSnakeLevel(
      CLASSIC_SNAKE_LEVELS.find((e) => e.id === row.levelId),
      { pace: row.pace },
    );
    assert.equal(row.levelIdentity, dataIdentity(level));
    assert.equal(row.proposedBudget, null);
    for (const [method, replayKey] of [
      ['visiblePilot', 'visibleReplay'],
      ['generalPilot', 'generalReplay'],
    ]) {
      const replay = row[replayKey],
        run = restoreClassicSnakeReplay(replay, { level });
      assert.equal(run.status, row[method].status);
      assert.equal(run.tick, row[method].moves);
      assert.equal(run.catches, row[method].catches);
      const route = createHash('sha256').update(canonicalJSON(replay.turns)).digest('hex');
      assert.equal(row[method].routeIdentity, route);
      assert.throws(() => restoreClassicSnakeReplay({ ...replay, seed: 18 }, { level }));
    }
    const differs =
      canonicalJSON(row.visibleReplay.turns) !== canonicalJSON(row.generalReplay.turns);
    assert.equal(row.differentInputRoutes, differs);
    changedRoutes += Number(differs);
    const award = classicSnakeRatingForRecord({
      clear: true,
      policy: 'mission',
      mode: row.mode,
      seed: row.seed,
      levelIdentity: row.levelIdentity,
      fewestMoves: 1,
    });
    assert.equal(award.calibrated, row.role === 'published-control');
    if (row.role !== 'published-control') assert.equal(award.stars, 1);
  }
  assert.equal(report.summary.differentInputRoutes, changedRoutes);
});
