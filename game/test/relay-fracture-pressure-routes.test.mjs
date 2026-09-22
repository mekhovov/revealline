import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWholeJourneyCandidates } from '../content-design/whole-journey-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { RELAY_FIRST_RETURNS } from '../content-design/relay-candidates.mjs';
import { FRACTURE_FIRST_RETURNS } from '../content-design/fracture-candidates.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { assessPressureRoute } from '../../scripts/lib/pressure-route-assessment.mjs';
import * as relay from './helpers/relay-goal.mjs';
import * as fracture from './helpers/fracture-goal.mjs';

const project = compileContentProject(withPressureDifficulty(createWholeJourneyCandidates()));
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/relay-fracture-pressure-routes.json', import.meta.url)),
);
const historical = JSON.parse(
  await readFile(new URL('./fixtures/journey-pressure-route-assessment.json', import.meta.url)),
);
const key = (r) => [r.id ?? r.missionId, r.difficulty, r.turnPolicy].join('/');
const old = historical.rows.filter((r) => ['relay', 'fracture'].includes(r.chapter));
test('opening observations preserve known risks, not an all-safe opening acceptance claim', () => {
  const directions = { ...RELAY_FIRST_RETURNS, ...FRACTURE_FIRST_RETURNS };
  assert.equal(fixture.openings.length, 84);
  assert.equal(new Set(fixture.openings.map(key)).size, 84);
  assert.deepEqual(fixture.openings.map(key).sort(), old.map(key).sort());
  for (const row of fixture.openings) {
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    const options = { seed: 1, classId: 'scout', turnPolicy: row.turnPolicy };
    const idle = createRun(manifest.level, options);
    for (let t = 0; t < 1200 && idle.status === 'running' && !idle.classic.livesLost; t++)
      stepRun(idle, { direction: null }, FIXED_DT);
    const run = createRun(manifest.level, options);
    let closed = false;
    for (
      let t = 0;
      t < 1200 && run.status === 'running' && !run.classic.livesLost && !closed;
      t++
    ) {
      stepRun(run, { direction: directions[row.id] }, FIXED_DT);
      closed = run.events.some((event) => event.type === 'cut.closed');
    }
    assert.equal(idle.tick, row.idleTicks);
    assert.equal(idle.classic.livesLost, row.idleLosses);
    assert.equal(run.tick, row.firstReturnTicks);
    assert.equal(run.classic.livesLost, row.firstReturnLosses);
    assert.equal(run.coverage, row.coverage);
    assert.equal(closed, row.closed);
  }
  assert(fixture.openings.filter((r) => r.idleLosses).every((r) => r.id === 'fracture-remix'));
  assert.equal(fixture.openings.filter((r) => r.idleLosses).length, 6);
  assert(
    fixture.openings
      .filter((r) => !r.closed)
      .every((r) => r.id === 'two-districts' && r.difficulty === 'expert'),
  );
  assert.equal(fixture.openings.filter((r) => !r.closed).length, 2);
});
test('new routes cover exactly the 33 unresolved Relay/Fracture configurations without replacing old successes', () => {
  assert.equal(fixture.format, 'RelayFracturePressureRefinementV1');
  assert.equal(fixture.projectRevision, historical.projectRevision);
  assert.equal(fixture.rows.length, 33);
  assert.deepEqual(
    fixture.rows.map(key).sort(),
    old
      .filter((r) => !r.chosen)
      .map(key)
      .sort(),
  );
  assert.equal(new Set(fixture.rows.map(key)).size, 33);
  for (const row of fixture.rows) {
    assert.equal(row.simulationIdentity, old.find((r) => key(r) === key(row)).simulationIdentity);
    assert.equal(row.status, 'won');
    assert.equal(row.seed, 1);
  }
});

function equalRace(level, segments, options) {
  const match = createDuel(level, options, { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 });
  assert.notEqual(match.runs[0].cells, match.runs[1].cells);
  resumeDuel(match);
  for (const [direction, ticks] of segments)
    for (let i = 0; i < ticks; i++) {
      assert.equal(match.status, 'running');
      stepDuel(match, [{ direction }, { direction }]);
    }
  assert.equal(match.status, 'finished');
  assert.equal(match.winner, null);
  assert(match.runs.every((r) => r.status === 'won' && r.classic.livesLost === 0));
  assert.deepEqual(authoritativeCheckpoint(match.runs[0]), authoritativeCheckpoint(match.runs[1]));
}

for (const row of fixture.rows)
  test(`new spatial pressure clear/replay/race: ${key(row)}`, () => {
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const segments = row.segments.map((s) => [s.direction, s.ticks]);
    const { segments: played, ...metrics } = assessPressureRoute(manifest.level, {
      segments,
      seed: row.seed,
      turnPolicy: row.turnPolicy,
      replay: true,
    });
    assert.deepEqual(played, segments);
    assert.equal(metrics.status, 'no-loss-clear');
    assert.deepEqual(metrics, row.metrics);
    const options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options);
    const isRelay = Object.hasOwn(RELAY_FIRST_RETURNS, row.id);
    const evidence = isRelay
      ? relay.createRelayGoalEvidence()
      : fracture.createFractureGoalEvidence();
    const events = [],
      closures = [];
    for (const [direction, ticks] of segments)
      for (let i = 0; i < ticks; i++) {
        assert.equal(run.status, 'running');
        const before = isRelay
          ? relay.relayBeforeStep(run)
          : {
              trail: run.trail.map((cell) => cell.index),
              activeRoamer: run.enemies.some(
                (actor) => actor.type === 'claimed-rover' && actor.classic.mode === 'active',
              ),
            };
        stepRun(run, { direction }, FIXED_DT);
        (isRelay ? relay.observeRelayGoal : fracture.observeFractureGoal)(run, evidence, before);
        for (const event of run.events)
          if (
            [
              'boss.warning',
              'player.failed',
              'cut.closed',
              'lineImpact.created',
              'relay.opened',
              'objective.captured',
              'encounter.stageChanged',
              'encounter.defeated',
            ].includes(event.type)
          )
            events.push([run.tick, event.type, event.id ?? null]);
        if (run.events.some((event) => event.type === 'cut.closed'))
          closures.push([run.tick, run.coverage]);
      }
    assert.deepEqual(events, row.events);
    assert.deepEqual(closures, row.closures);
    assert.equal(closures.length, row.cuts);
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert.deepEqual(
      (isRelay ? relay.inspectRelayGoal : fracture.inspectFractureGoal)({
        missionId: row.id,
        run,
        evidence,
        foundations: manifest.level.foundations,
        coverageTarget: manifest.level.goal.coverage,
      }),
      row.goal,
    );
    equalRace(manifest.level, segments, options);
  });

for (const row of old.filter((r) => r.chosen))
  test(`retain historical spatial pressure route: ${key(row)}`, () => {
    const manifest = resolveMission(project, row.missionId, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const result = assessPressureRoute(manifest.level, {
      segments: row.chosen.segments,
      seed: row.seed,
      turnPolicy: row.turnPolicy,
      replay: true,
    });
    assert.equal(result.status, 'no-loss-clear');
    assert.equal(result.checkpoint, row.chosen.checkpoint);
    equalRace(manifest.level, row.chosen.segments, {
      seed: row.seed,
      classId: 'scout',
      turnPolicy: row.turnPolicy,
    });
  });
