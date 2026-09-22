import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWholeJourneyCandidates } from '../content-design/whole-journey-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { HORIZON_FIRST_RETURNS } from '../content-design/horizon-candidates.mjs';
import { BORDER_FIRST_RETURNS } from '../content-design/border-candidates.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { assessPressureRoute } from '../../scripts/lib/pressure-route-assessment.mjs';
import {
  createOpeningObservations,
  openingBeforeStep,
  observeOpeningStep,
  inspectOpeningObservations,
} from './helpers/opening-route-observations.mjs';

const project = compileContentProject(withPressureDifficulty(createWholeJourneyCandidates()));
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/opening-pressure-routes.json', import.meta.url)),
);
const historical = JSON.parse(
  await readFile(new URL('./fixtures/journey-pressure-route-assessment.json', import.meta.url)),
);
const old = historical.rows.filter((r) => ['horizon', 'border'].includes(r.chapter));
const key = (r) => [r.id ?? r.missionId, r.difficulty, r.turnPolicy].join('/');
test('opening refinement covers exactly thirty unresolved cases and preserves historical success records', () => {
  assert.equal(fixture.format, 'OpeningPressureRefinementV1');
  assert.equal(fixture.projectRevision, project.source.revision);
  assert.equal(fixture.projectRevision, historical.projectRevision);
  assert.equal(fixture.rows.length, 30);
  assert.equal(old.filter((r) => r.chosen).length, 72);
  assert.deepEqual(
    fixture.rows.map(key).sort(),
    old
      .filter((r) => !r.chosen)
      .map(key)
      .sort(),
  );
  assert.equal(new Set([...fixture.rows, ...old.filter((r) => r.chosen)].map(key)).size, 102);
});
test('all102 idle/first-return observations preserve six failing old departures explicitly', () => {
  assert.equal(fixture.openings.length, 102);
  assert.deepEqual(fixture.openings.map(key).sort(), old.map(key).sort());
  const directions = { ...HORIZON_FIRST_RETURNS, ...BORDER_FIRST_RETURNS };
  for (const row of fixture.openings) {
    const { level } = resolveMission(project, row.id, { difficulty: row.difficulty });
    const options = { seed: 1, classId: 'scout', turnPolicy: row.turnPolicy };
    const idle = createRun(level, options),
      run = createRun(level, options);
    for (let t = 0; t < 1200 && idle.status === 'running' && !idle.classic.livesLost; t++)
      stepRun(idle, { direction: null }, FIXED_DT);
    let closed = false;
    for (
      let t = 0;
      t < 1200 && run.status === 'running' && !run.classic.livesLost && !closed;
      t++
    ) {
      stepRun(run, { direction: directions[row.id] }, FIXED_DT);
      closed = run.events.some((e) => e.type === 'cut.closed');
    }
    assert.equal(idle.tick, row.idleTicks);
    assert.equal(idle.classic.livesLost, row.idleLosses);
    assert.equal(run.tick, row.firstReturnTicks);
    assert.equal(run.classic.livesLost, row.firstReturnLosses);
    assert.equal(run.coverage, row.coverage);
    assert.equal(closed, row.closed);
  }
  assert(fixture.openings.every((r) => r.idleLosses === 0));
  const failures = fixture.openings.filter((r) => !r.closed || r.firstReturnLosses);
  assert.equal(failures.length, 6);
  assert(
    failures.every(
      (r) =>
        (r.id === 'two-bays' && ['standard', 'expert'].includes(r.difficulty)) ||
        (r.id === 'return-pocket' && r.difficulty === 'expert'),
    ),
  );
});
test('all six failed old openings have short no-wait lossless alternative returns and public replays', () => {
  assert.equal(fixture.alternativeFirstReturns.length, 6);
  assert.deepEqual(
    fixture.alternativeFirstReturns.map(key).sort(),
    fixture.openings
      .filter((row) => !row.closed || row.firstReturnLosses)
      .map(key)
      .sort(),
  );
  for (const row of fixture.alternativeFirstReturns) {
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    const options = { seed: 1, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options),
      recorder = createRecorder(manifest.level, options);
    let closures = 0;
    for (const [direction, ticks] of row.segments) {
      assert(['left', 'right', 'up', 'down'].includes(direction));
      for (let i = 0; i < ticks; i++) {
        assert.equal(run.classic.livesLost, 0);
        assert.equal(closures, 0);
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        closures += Number(run.events.some((e) => e.type === 'cut.closed'));
      }
    }
    assert.equal(closures, 1);
    assert.equal(run.classic.livesLost, 0);
    assert.equal(run.tick, row.ticks);
    assert(run.tick <= 462);
    assert.equal(run.coverage, row.coverage);
    assert.equal(run.player.speed, 0);
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
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
  test(`new opening pressure clear/replay/race: ${key(row)}`, () => {
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    assert.equal(row.seed, 1);
    assert.equal(row.status, 'won');
    const segments = row.segments.map((s) => [s.direction, s.ticks]);
    const { segments: played, ...metrics } = assessPressureRoute(manifest.level, {
      segments,
      seed: row.seed,
      turnPolicy: row.turnPolicy,
      replay: true,
    });
    assert.deepEqual(played, segments);
    assert.equal(metrics.status, 'no-loss-clear');
    assert.deepEqual(metrics.collectedBonusIds, []);
    assert.deepEqual(metrics, row.metrics);
    const options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options),
      evidence = createOpeningObservations(run),
      closures = [];
    for (const [direction, ticks] of segments)
      for (let i = 0; i < ticks; i++) {
        assert.equal(run.status, 'running');
        const before = openingBeforeStep(run);
        stepRun(run, { direction }, FIXED_DT);
        observeOpeningStep(run, evidence, before);
        if (run.events.some((e) => e.type === 'cut.closed'))
          closures.push([run.tick, run.coverage]);
      }
    assert.deepEqual(closures, row.closures);
    assert.equal(closures.length, row.cuts);
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    const checkpoint = authoritativeCheckpoint(run);
    assert.deepEqual(inspectOpeningObservations(run, evidence), row.observations);
    assert.deepEqual(
      authoritativeCheckpoint(run),
      checkpoint,
      'reading observations cannot change gameplay',
    );
    equalRace(manifest.level, segments, options);
  });
for (const row of old.filter((r) => r.chosen))
  test(`retained opening pressure route: ${key(row)}`, () => {
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
test('spatial observations distinguish visited landings, linked landings and distinct original regions', () => {
  const byId = (id) => fixture.rows.filter((r) => r.id === id);
  for (const row of [...byId('nearby-shore'), ...byId('second-landing')]) {
    assert.deepEqual(
      row.observations.visitedFoundations,
      [],
      'a captured landing was not necessarily used',
    );
    assert.equal(row.observations.allFoundationsVisited, false);
  }
  for (const row of byId('courtyard-return'))
    assert.deepEqual(row.observations.cutRegions, ['inside', 'outside']);
  for (const row of byId('two-bays'))
    assert.deepEqual(row.observations.cutRegions, ['east', 'west']);
  for (const row of byId('horizon-remix')) {
    assert.deepEqual(
      row.observations.visitedFoundations.map(([i]) => i),
      [0],
    );
    assert.equal(row.observations.allFoundationsMutuallyLinked, false);
  }
});
