import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoop, startCoop, stepCoop, FIXED_DT } from '../coop/core.mjs';
import { FIRST_CONNECTION, COOP_EXPERIMENTS } from '../coop/first-connection.mjs';

const command = (direction) => ({ direction, boost: true, support: false });
const inward = () => [command('right'), command('left')];

function experimentRun(experiment) {
  const run = createCoop(FIRST_CONNECTION, {
    seed: 17,
    difficulty: 'standard',
    jointCuts: experiment.jointCuts,
    assistCaptures: experiment.assistCaptures,
    advancedCooperation: experiment.advancedCooperation,
  });
  startCoop(run);
  return run;
}

/** Authored input route; no player positions, enemies, terrain or goals are modified. */
function clearFirstConnection(experiment) {
  const run = experimentRun(experiment);
  const events = [];
  const advance = (inputs, finished, limit = 1500) => {
    for (let count = 0; !finished() && count < limit; count++) {
      assert.equal(run.status, 'running', 'The scripted route ended before its next checkpoint.');
      stepCoop(run, inputs(), FIXED_DT);
      events.push(...structuredClone(run.events));
    }
    assert.ok(finished(), 'The scripted route did not reach its checkpoint.');
  };

  // Boost inward at row 18. Joint heads bank at the center; individual cuts
  // continue to the opposite perimeter. Both eventually claim the same region.
  advance(inward, () => run.claimedCount > 0);
  const firstBankTick = run.tick;
  const firstBankCoverage = run.coverage;

  // Travel along that safe row to flank columns 10 and 61, then cut downward.
  advance(
    () => [
      command(run.players[0].x > 10.55 ? 'left' : null),
      command(run.players[1].x < 61.45 ? 'right' : null),
    ],
    () => run.players[0].x <= 10.55 && run.players[1].x >= 61.45,
  );
  advance(
    () => [command('down'), command('down')],
    () => run.status === 'won',
  );
  return { run, events, firstBankTick, firstBankCoverage };
}

for (const experiment of COOP_EXPERIMENTS)
  test(`First Connection ${experiment.id}: a public-input route completes the authored arena`, () => {
    const original = structuredClone(FIRST_CONNECTION);
    const result = clearFirstConnection(experiment);
    const { run, events } = result;
    assert.equal(run.status, 'won');
    assert.equal(run.claimedCount, 1580);
    assert.ok(run.coverage >= FIRST_CONNECTION.goal.coverage);
    assert.deepEqual(
      events.filter((event) => event.type === 'cells.claimed').map((event) => event.cells),
      [1260, 320],
    );
    assert.equal(events.filter((event) => event.type === 'player.downed').length, 0);
    assert.equal(events.filter((event) => event.type === 'run.completed').length, 1);
    assert.equal(run.team.reserves, 3);
    assert.ok(run.players.every((player) => player.status === 'active' && !player.cutting));
    assert.deepEqual(FIRST_CONNECTION, original);
    assert.deepEqual(clearFirstConnection(experiment), result);
  });

test('identical inward inputs expose the intended joint-bank difference on the same arena', () => {
  const [joint, individual] = COOP_EXPERIMENTS.map(experimentRun);
  for (let tick = 0; tick < 354; tick++) {
    stepCoop(joint, inward(), FIXED_DT);
    stepCoop(individual, inward(), FIXED_DT);
  }
  assert.equal(joint.tick, individual.tick);
  assert.deepEqual(joint.level, individual.level);
  assert.equal(joint.seed, individual.seed);
  assert.equal(joint.claimedCount, 1260);
  assert.equal(individual.claimedCount, 0);
  assert.ok(joint.players.every((player) => player.status === 'active' && !player.cutting));
  assert.ok(individual.players.every((player) => player.status === 'active' && player.cutting));
  for (let index = 0; index < joint.enemies.length; index++) {
    assert.ok(Math.abs(joint.enemies[index].x - individual.enemies[index].x) < 1e-9);
    assert.ok(Math.abs(joint.enemies[index].y - individual.enemies[index].y) < 1e-9);
  }
});

test('both experiment routes secure the same region, while the joint first bank needs less exposure', () => {
  const [joint, individual] = COOP_EXPERIMENTS.map(clearFirstConnection);
  assert.deepEqual(joint.run.cells, individual.run.cells);
  assert.equal(joint.firstBankCoverage, individual.firstBankCoverage);
  assert.equal(joint.firstBankTick, 354);
  assert.equal(individual.firstBankTick, 705);
  assert.ok(joint.firstBankTick < individual.firstBankTick);
  assert.equal(joint.run.tick, 772);
  assert.equal(individual.run.tick, 1475);
  // These timings establish mechanical behavior on a scripted route, not player enjoyment.
});
