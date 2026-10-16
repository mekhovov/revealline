import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dataIdentity } from '../data-json.mjs';
import { createTeamDepotSpatialCandidates } from '../content-design/team-depot-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { assessTeamTimedRoute } from './helpers/team-timed-route.mjs';

const read = async (file) =>
  JSON.parse(await readFile(new URL(`./fixtures/${file}`, import.meta.url)));
const evidence = await read('team-depot-current-mastery.json');
const historicalOrdinary = await read('team-depot-spatial-routes.json');
const historicalMastery = await read('team-timed-qualification.json');
const project = compileContentProject(createTeamDepotSpatialCandidates());
const presets = ['gentle', 'standard', 'expert'];
const manifest = (difficulty) =>
  resolveMission(project, 'depot-dash', { mode: 'team', difficulty });
const level = (difficulty) =>
  applyGameplayTuning(manifest(difficulty).level, resolveGameplayTuning(difficulty));
const segments = (row) => row.log.map(([a, b, ticks]) => ({ a, b, ticks }));

// The documented mastery is evidence about an optional route, not another goal
// or a new badge system. Activation at the terminal tick alone cannot qualify.
function masteryQualified(result) {
  const bothActiveAt = Math.max(
    result.activatedAt['east-rover'] ?? Infinity,
    result.activatedAt['west-rover'] ?? Infinity,
  );
  return (
    result.status === 'shared-no-loss-clear' &&
    result.firstDown === null &&
    result.collected.some((item) => item.partnerCutting) &&
    result.returns.every((n) => n > 0) &&
    result.tick - bothActiveAt >= 120 &&
    result.cutStarts.some(
      (start) =>
        start.tick >= bothActiveAt &&
        result.closures.some(
          (closure) =>
            closure.reason === 'return' &&
            closure.player === start.player &&
            closure.tick > start.tick,
        ),
    )
  );
}

function observeMovingRovers(input, log, { seed = 1, swapped = false, jointCuts = true } = {}) {
  const owned = structuredClone(input);
  if (swapped) owned.spawns.reverse();
  const run = startCoop(createCoop(owned, { seed, jointCuts }));
  let bothMovingDuringCutTicks = 0;
  let actualSteps = 0;
  const postActivationReturns = [];
  for (const segment of log)
    for (let tick = 0; tick < segment.ticks; tick++) {
      assert.equal(run.status, 'running', 'No command after the clear is evidence of mastery');
      const before = new Map(
        run.enemies.filter((enemy) => enemy.rover).map((enemy) => [enemy.id, [enemy.x, enemy.y]]),
      );
      const directions = swapped ? [segment.b, segment.a] : [segment.a, segment.b];
      for (const [seat, direction] of directions.entries())
        assert(
          !(direction === null && run.players[seat].direction !== null),
          'No artificial neutral brake',
        );
      stepCoop(
        run,
        directions.map((direction) => ({ direction, boost: false, support: false })),
      );
      actualSteps++;
      assert(run.players.every((pilot) => pilot.status === 'active'));
      const rovers = run.enemies.filter((enemy) => enemy.rover);
      if (rovers.every((enemy) => enemy.rover.mode === 'active')) {
        if (
          run.players.some((pilot) => pilot.cutting) &&
          rovers.every((enemy) => {
            const [x, y] = before.get(enemy.id);
            return Math.hypot(enemy.x - x, enemy.y - y) > 1e-9;
          })
        )
          bothMovingDuringCutTicks++;
        postActivationReturns.push(
          ...run.events.filter((event) => event.type === 'cut.closed' && event.reason === 'return'),
        );
      }
    }
  return { run, actualSteps, bothMovingDuringCutTicks, postActivationReturns };
}

test('pins the existing inner-lane edition and real gp4 recipes, with no gameplay or mastery gate added', () => {
  assert.equal(evidence.format, 'TeamDepotCurrentMasteryEvidenceV1');
  assert.equal(dataIdentity(project.source), evidence.sourceProjectIdentity);
  for (const difficulty of presets) {
    const authored = manifest(difficulty);
    assert.equal(authored.simulationIdentity, evidence.identities[difficulty].authored);
    const prepared = level(difficulty);
    assert.equal(
      dataIdentity({ level: prepared, gameplayTuning: resolveGameplayTuning(difficulty) }),
      evidence.identities[difficulty].runtime,
    );
    assert.equal(prepared.version, 'revealline-coop-level.v5');
    assert.deepEqual(prepared.goal, { coverage: 0.78 });
    assert.deepEqual(prepared.strongholds ?? [], []);
    assert.equal(prepared.rules.moveSpeed, 8.84);
    assert.equal(prepared.enemies.filter((actor) => actor.type === 'claimed-rover').length, 2);
  }
});

test('old authored logs are not silently promoted as current-rate proof', () => {
  for (const row of evidence.historicalLogsOnCurrentRates) {
    const old = (row.kind === 'mastery' ? historicalMastery : historicalOrdinary).rows.find(
      (item) =>
        (item.missionId ?? 'depot-dash') === 'depot-dash' &&
        item.kind === row.kind &&
        item.difficulty === row.difficulty,
    );
    const result = assessTeamTimedRoute(level(row.difficulty), old.log, {
      seed: row.kind === 'mastery' ? 1 : 17,
      delayTicks: row.kind === 'mastery' ? 0 : 1,
    });
    assert.equal(result.status, row.status);
    assert.equal(result.tick, row.tick);
    if (row.cause) assert.equal(result.firstDown.cause, row.cause);
    assert.equal(masteryQualified(result), false);
  }
});

test('both seats have real no-loss opening returns across presets, seeds and joint-cut options', () => {
  for (const difficulty of presets)
    for (const seed of [1, 17])
      for (const swapped of [false, true])
        for (const jointCuts of [false, true]) {
          const result = assessTeamTimedRoute(
            level(difficulty),
            [{ a: 'left', b: 'right', ticks: 143 }],
            { seed, swapped, jointCuts },
          );
          assert.equal(result.firstDown, null);
          assert.deepEqual(result.returns, [1, 1]);
          assert.equal(result.tick, 143);
          assert.deepEqual(result.collected, []);
          assert.deepEqual(result.activated, []);
          assert.equal(result.status, 'route-exhausted');
        }
});

for (const row of evidence.rows)
  for (const swapped of [false, true])
    for (const jointCuts of [false, true])
      test(`${row.kind}/swap${swapped}/joint${jointCuts}: exact current-rate public commands clear without knockdowns`, () => {
        const options = { seed: row.seed, swapped, jointCuts };
        const input = level(row.difficulty);
        const log = segments(row);
        const result = assessTeamTimedRoute(input, log, options);
        assert.equal(result.status, 'shared-no-loss-clear');
        assert.equal(result.firstDown, null);
        assert.equal(result.tick, row.tick);
        assert.equal(result.coverage, row.coverage);
        assert.deepEqual(result.returns, swapped ? [...row.returns].reverse() : row.returns);
        assert.deepEqual(result.activatedAt, row.activatedAt);
        if (!swapped && jointCuts) assert.equal(result.checkpoint, row.checkpoint);
        // Team has no Solo replay export. Re-execute the full legal command log
        // on a fresh actual Team instance; do not label this a save-format test.
        assert.equal(assessTeamTimedRoute(input, log, options).checkpoint, result.checkpoint);
        const observed = observeMovingRovers(input, log, options);
        assert.equal(observed.run.status, 'won');
        assert.equal(observed.actualSteps, row.tick);
        assert(
          observed.bothMovingDuringCutTicks >= 120,
          'Both active bodies move during continuing cuts',
        );
        assert.equal(masteryQualified(result), row.kind === 'mastery');
        if (row.kind === 'mastery') {
          assert.equal(result.collected.length, 1);
          assert.equal(result.collected[0].id, 'depot-speed');
          assert.equal(result.collected[0].tick, 547);
          assert.equal(result.collected[0].partnerCutting, true);
          assert.equal(observed.postActivationReturns.length, 3);
          assert.deepEqual(
            result.cutStarts.filter((start) => start.tick >= 940).map((start) => start.tick),
            [983, 1283, 1747],
          );
          assert.equal(
            result.tick - 940,
            1094,
            'Finite continued play, not activation on the winning frame',
          );
        } else {
          assert.deepEqual(result.collected, []);
          assert.equal(result.finalReserves, result.initialReserves);
        }
      });

test('the mastery opening by itself cannot masquerade as a completed post-activation challenge', () => {
  const row = evidence.rows.find((item) => item.kind === 'mastery');
  const before = assessTeamTimedRoute(level('standard'), segments(row).slice(0, 12), { seed: 1 });
  assert.deepEqual(before.activated, ['east-rover', 'west-rover']);
  assert.equal(before.collected[0].partnerCutting, true);
  assert.equal(before.status, 'route-exhausted');
  assert.equal(masteryQualified(before), false);
  assert(!before.cutStarts.some((start) => start.tick >= 940));
});
