import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createDuel, stepDuel, pauseDuel, resumeDuel, neutralCommand } from '../multiplayer.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { couchPage } from './helpers/couch-host.mjs';

const project = compileContentProject(createOpeningCandidates());
const standard = JSON.parse(
  await readFile(new URL('./fixtures/horizon-greybox-routes.json', import.meta.url)),
);
const variants = JSON.parse(
  await readFile(new URL('./fixtures/horizon-preset-routes.json', import.meta.url)),
);
const sets = [
  { difficulty: 'standard', turnPolicy: 'immediate', rows: standard.rows },
  ...variants.sets,
];

for (const { difficulty, turnPolicy, rows } of sets)
  test(`opening paired-board route equality: ${difficulty}/${turnPolicy}`, () => {
    for (const [id, identity, , segments] of rows) {
      const manifest = resolveMission(project, id, { mode: 'versus', difficulty });
      assert.equal(manifest.simulationIdentity, identity);
      const match = createDuel(manifest.level, { seed: 1, classId: 'scout', turnPolicy });
      assert.equal(match.ruleset, 'xonix-core.v6');
      assert.equal(match.runs[0].coverage, 0);
      assert.equal(match.runs[0].totalClaimable, match.runs[1].totalClaimable);
      assert.notEqual(match.runs[0].cells, match.runs[1].cells);
      assert.notEqual(match.runs[0].foundation.permanent, match.runs[1].foundation.permanent);
      resumeDuel(match);
      for (const [direction, ticks] of segments)
        for (let tick = 0; tick < ticks; tick++) {
          assert.equal(match.status, 'running', `${id}: route exceeded the race clock`);
          stepDuel(match, [{ direction }, { direction }]);
        }
      assert.equal(match.status, 'finished', id);
      assert.equal(match.reason, 'First clear', id);
      assert.equal(match.winner, null, `${id}: simultaneous clears must draw`);
      assert(
        match.runs.every((run) => run.status === 'won' && run.lives === manifest.level.rules.lives),
      );
      assert.deepEqual(
        authoritativeCheckpoint(match.runs[0]),
        authoritativeCheckpoint(match.runs[1]),
      );
    }
  });

test('foundation race awards either first finisher without shared territory or state', () => {
  const [, , , segments] = standard.rows.find(([id]) => id === 'island-outpost');
  const manifest = resolveMission(project, 'island-outpost', { mode: 'versus' });
  for (const seat of [0, 1]) {
    const match = createDuel(manifest.level, { seed: 1, classId: 'scout' });
    const permanent = [...match.runs[1 - seat].foundation.permanent];
    resumeDuel(match);
    for (const [direction, ticks] of segments)
      for (let tick = 0; tick < ticks; tick++) {
        const commands = [neutralCommand(), neutralCommand()];
        commands[seat] = { direction };
        stepDuel(match, commands);
      }
    assert.equal(match.winner, seat);
    assert.equal(match.runs[seat].status, 'won');
    assert.equal(match.runs[1 - seat].coverage, 0);
    assert.equal(match.runs[1 - seat].claimedCount, 0);
    assert.deepEqual([...match.runs[1 - seat].foundation.permanent], permanent);
  }
});

test('pausing two island departures freezes both boards and requires fresh steering', () => {
  const manifest = resolveMission(project, 'island-outpost', { mode: 'versus' });
  const match = createDuel(manifest.level, { seed: 1 });
  resumeDuel(match);
  for (let tick = 0; tick < 48; tick++)
    stepDuel(match, [{ direction: 'left' }, { direction: 'right' }]);
  pauseDuel(match);
  const before = match.runs.map(authoritativeCheckpoint),
    pausedTick = match.tick;
  stepDuel(match, [{ direction: 'left' }, { direction: 'right' }]);
  assert.deepEqual(match.runs.map(authoritativeCheckpoint), before);
  assert.equal(match.tick, pausedTick);
  resumeDuel(match);
  assert(match.runs.every((run) => run.player.speed === 0));
  const positions = match.runs.map(({ player }) => [player.x, player.y]);
  stepDuel(match, [neutralCommand(), neutralCommand()]);
  assert.deepEqual(
    match.runs.map(({ player }) => [player.x, player.y]),
    positions,
  );
});

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`actual Versus host retains compiled foundation geometry and both-seat closures: ${turnPolicy}`, async (t) => {
    const level = resolveMission(project, 'island-outpost', { mode: 'versus' }).level;
    const campaign = {
      version: 'xonix-campaign.v1',
      id: 'foundation-race-fixture',
      revision: '1',
      title: 'Foundation race fixture',
      levels: [level],
    };
    const page = await couchPage(t, { campaign, turnPolicy });
    assert(page.renders.every((run) => run.ruleset === 'xonix-core.v6'));
    assert(page.renders.every((run) => run.claimedCount === 0 && run.coverage === 0));
    const permanent = page.renders.map((run) => [...run.foundation.permanent]);
    page.$('race-start').click();
    page.key('KeyA');
    page.key('ArrowLeft');
    for (let frame = 0; frame < 900 && page.renders.some((run) => !run.claimedCount); frame++)
      page.frame();
    page.key('KeyA', false);
    page.key('ArrowLeft', false);
    for (const [seat, run] of page.renders.entries()) {
      assert(run.claimedCount > 0, `Seat ${seat} must close its own legal island departure`);
      assert.equal(run.player.speed, 0);
      assert.equal(run.lives, 3);
      assert.equal(run.totalClaimable, 70 * 34 - permanent[seat].filter(Boolean).length + 212);
      assert.deepEqual([...run.foundation.permanent], permanent[seat]);
    }
    assert.deepEqual(page.checkpoint()[0], page.checkpoint()[1]);
  });
