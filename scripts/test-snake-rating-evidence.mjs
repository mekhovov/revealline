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
import { clearanceSnakeRouteTurn } from './lib/snake-clearance-route-pilot.mjs';

test('clearance strategy chooses a longer open route over a narrow direct corridor', () => {
  const view = {
    width: 11,
    height: 9,
    walls: [3, 4, 5, 6, 7].flatMap((x) => [
      { x, y: 3 },
      { x, y: 5 },
    ]),
    body: [
      { x: 1, y: 4 },
      { x: 0, y: 4 },
    ],
    direction: 'right',
    target: { x: 9, y: 4 },
  };
  const before = structuredClone(view);
  assert.equal(visibleSnakeRouteTurn(view), 'right');
  assert.equal(clearanceSnakeRouteTurn(view), 'up');
  assert.deepEqual(view, before);
  assert.equal(
    clearanceSnakeRouteTurn({
      ...view,
      walls: [
        { x: 2, y: 4 },
        { x: 1, y: 3 },
        { x: 1, y: 5 },
      ],
    }),
    null,
  );
});

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

test('route evidence verifies exact recipes and does not manufacture grade keys', async () => {
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
  for (const source of report.sources) {
    const bytes = await readFile(new URL(`../${source.path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
  }
  let changedRoutes = 0;
  let distinctClearanceWins = 0;
  let clearanceWins = 0;
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
      ['clearancePilot', 'clearanceReplay'],
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
    const clearanceWon = row.clearancePilot.status === 'won';
    const clearanceDiffers =
      canonicalJSON(row.clearanceReplay.turns) !== canonicalJSON(row.generalReplay.turns);
    assert.equal(row.distinctClearanceWin, clearanceWon && clearanceDiffers);
    distinctClearanceWins += Number(row.distinctClearanceWin);
    clearanceWins += Number(clearanceWon);
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
  assert.equal(report.summary.clearanceWins, clearanceWins);
  assert.equal(report.summary.distinctClearanceWins, distinctClearanceWins);
  assert.equal(report.summary.clearanceStopped, report.rows.length - clearanceWins);
});
