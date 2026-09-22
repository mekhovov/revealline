import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWholeJourneyCandidates } from '../content-design/whole-journey-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { SIGNAL_FIRST_RETURNS } from '../content-design/signal-candidates.mjs';
import { NEON_FIRST_RETURNS } from '../content-design/neon-candidates.mjs';
import { ROVER_FIRST_RETURNS } from '../content-design/rover-candidates.mjs';
import { PHASE_FIRST_RETURNS } from '../content-design/phase-candidates.mjs';
import { SENTINEL_FIRST_RETURNS } from '../content-design/sentinel-candidates.mjs';
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
  createMiddleEvidence,
  middleBeforeStep,
  observeMiddleEvidence,
  inspectMiddleEvidence,
} from './helpers/middle-pressure-evidence.mjs';

const project = compileContentProject(withPressureDifficulty(createWholeJourneyCandidates()));
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/middle-pressure-routes.json', import.meta.url)),
);
const historical = JSON.parse(
  await readFile(new URL('./fixtures/journey-pressure-route-assessment.json', import.meta.url)),
);
const chapters = ['signal', 'neon', 'rover', 'phase', 'sentinel'];
const old = historical.rows.filter((r) => chapters.includes(r.chapter));
const key = (r) => [r.id ?? r.missionId, r.difficulty, r.turnPolicy].join('/');
test('five-chapter refinement fills exactly52 unresolved cases and preserves146 historical successes', () => {
  assert.equal(fixture.format, 'MiddlePressureRefinementV1');
  assert.equal(fixture.projectRevision, project.source.revision);
  assert.equal(fixture.projectRevision, historical.projectRevision);
  assert.equal(fixture.rows.length, 52);
  assert.equal(old.filter((r) => r.chosen).length, 146);
  assert.deepEqual(
    fixture.rows.map(key).sort(),
    old
      .filter((r) => !r.chosen)
      .map(key)
      .sort(),
  );
  assert.equal(new Set([...fixture.rows, ...old.filter((r) => r.chosen)].map(key)).size, 198);
});
test('all198 starting observations preserve six failing old Phase departures', () => {
  assert.equal(fixture.openings.length, 198);
  assert.deepEqual(fixture.openings.map(key).sort(), old.map(key).sort());
  const directions = {
    ...SIGNAL_FIRST_RETURNS,
    ...NEON_FIRST_RETURNS,
    ...ROVER_FIRST_RETURNS,
    ...PHASE_FIRST_RETURNS,
    ...SENTINEL_FIRST_RETURNS,
  };
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
        (r.id === 'return-in-reserve' && ['standard', 'expert'].includes(r.difficulty)) ||
        (r.id === 'pressure-ladder' && r.difficulty === 'expert'),
    ),
  );
});
test('all six failed old openings have no-wait alternatives; the reserve landing clears an active impact', () => {
  assert.equal(fixture.alternativeFirstReturns.length, 6);
  assert.deepEqual(
    fixture.alternativeFirstReturns.map(key).sort(),
    fixture.openings
      .filter((r) => !r.closed || r.firstReturnLosses)
      .map(key)
      .sort(),
  );
  for (const row of fixture.alternativeFirstReturns) {
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    const options = { seed: 1, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options),
      recorder = createRecorder(manifest.level, options),
      evidence = createMiddleEvidence('phase', run);
    let closures = 0;
    for (const [direction, ticks] of row.segments) {
      assert(['left', 'right', 'up', 'down'].includes(direction));
      for (let i = 0; i < ticks; i++) {
        assert.equal(run.classic.livesLost, 0);
        assert.equal(closures, 0);
        const before = middleBeforeStep(run, evidence);
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        observeMiddleEvidence(run, evidence, before);
        closures += Number(run.events.some((e) => e.type === 'cut.closed'));
      }
    }
    assert.equal(closures, 1);
    assert.equal(run.classic.livesLost, 0);
    assert.equal(run.tick, row.ticks);
    assert(run.tick <= 414);
    assert.equal(run.coverage, row.coverage);
    assert.equal(run.player.speed, 0);
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    const actual = inspectMiddleEvidence(run, evidence);
    assert.equal(actual.impactSeeds, row.impactSeeds);
    if (row.id === 'return-in-reserve') {
      assert.equal(actual.optionalGoal.impactClosure, true);
      assert.deepEqual(
        actual.spatial.visitedFoundations.map(([i]) => i),
        [0],
      );
      assert.equal(
        actual.optionalGoal.achieved,
        false,
        'an introductory return is not a full mastery clear',
      );
    }
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
  test(`new five-chapter pressure clear/replay/race: ${key(row)}`, () => {
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    assert.deepEqual(
      resolveMission(project, row.id, { difficulty: row.difficulty, mode: 'versus' }).level,
      manifest.level,
    );
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
    const mission = project.missions.find((m) => m.id === row.id),
      map = project.source.maps.find((m) => m.id === mission.map.id);
    const options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options),
      evidence = createMiddleEvidence(row.chapter, run, map),
      closures = [],
      events = [];
    const denominator = run.totalClaimable;
    for (const [direction, ticks] of segments)
      for (let i = 0; i < ticks; i++) {
        assert.equal(run.status, 'running');
        const before = middleBeforeStep(run, evidence);
        stepRun(run, { direction }, FIXED_DT);
        observeMiddleEvidence(run, evidence, before);
        assert.equal(run.classic.livesLost, 0);
        assert.equal(run.totalClaimable, denominator);
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
        if (run.events.some((e) => e.type === 'cut.closed'))
          closures.push([run.tick, run.coverage]);
      }
    assert.deepEqual(events, row.events);
    assert.deepEqual(closures, row.closures);
    assert.equal(closures.length, row.cuts);
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    const checkpoint = authoritativeCheckpoint(run);
    assert.deepEqual(inspectMiddleEvidence(run, evidence), row.evidence);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    equalRace(manifest.level, segments, options);
  });
for (const row of old.filter((r) => r.chosen))
  test(`retained five-chapter pressure route: ${key(row)}`, () => {
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
test('ordinary clears are not reported as mastery or proof that a lesson occurred', () => {
  assert.equal(fixture.rows.filter((r) => r.evidence.optionalGoal.achieved).length, 32);
  assert.equal(fixture.rows.filter((r) => !r.evidence.optionalGoal.achieved).length, 20);
  const reserve = fixture.rows.filter((r) => r.id === 'return-in-reserve');
  assert.equal(reserve.length, 3);
  assert(reserve.every((r) => r.evidence.impactSeeds === 0 && !r.evidence.optionalGoal.achieved));
  assert(reserve.some((r) => r.cuts === 1));
  const relays = fixture.rows.filter((r) => r.id === 'first-relay');
  assert.equal(relays.length, 2);
  assert(
    relays.every(
      (r) =>
        r.evidence.optionalGoal.achieved && r.evidence.optionalGoal.defeat.cause === 'isolated',
    ),
  );
  assert.throws(() => createMiddleEvidence('unknown', {}), /Unsupported/);
});
