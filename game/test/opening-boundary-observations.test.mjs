import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createWholeJourneyCandidates } from '../content-design/whole-journey-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import {
  createOpeningObservations,
  observeOpeningStep,
  inspectOpeningObservations as inspectHistoricalOpeningObservations,
} from './helpers/opening-route-observations.mjs';
import {
  createBoundaryAwareOpeningObservations,
  observeBoundaryAwareOpeningStep,
  openingBeforeStep,
  inspectOpeningObservations,
} from './helpers/opening-boundary-observations.mjs';

const source = withPressureDifficulty(createOpeningCandidates());
const project = compileContentProject(source);
function twoCuts(level, turnPolicy, directions, centerLanding = false) {
  const options = { seed: 1, classId: 'scout', turnPolicy };
  const run = createRun(level, options),
    recorder = createRecorder(level, options);
  const legacy = createOpeningObservations(run),
    current = createBoundaryAwareOpeningObservations(run);
  for (const direction of directions) {
    let closed = false;
    for (let n = 0; n < 1200 && !closed; n++) {
      assert.equal(run.status, 'running');
      const before = openingBeforeStep(run);
      recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
      assert.equal(run.classic.livesLost, 0);
      observeOpeningStep(run, legacy, before);
      const checkpoint = authoritativeCheckpoint(run).hash;
      observeBoundaryAwareOpeningStep(run, current, before);
      assert.equal(
        authoritativeCheckpoint(run).hash,
        checkpoint,
        'observing cannot change simulation',
      );
      closed = run.events.some((e) => e.type === 'cut.closed');
    }
    assert(closed, 'bounded route must close');
    if (centerLanding && current.closures.length === 1) {
      // Move half a cell into the island through public input before turning;
      // an immediate tangent at its boundary need not depart a foundation cell.
      for (let i = 0; i < 6; i++) {
        const before = openingBeforeStep(run);
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        observeOpeningStep(run, legacy, before);
        observeBoundaryAwareOpeningStep(run, current, before);
      }
    }
  }
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  return {
    run,
    legacy: inspectHistoricalOpeningObservations(run, legacy),
    current: inspectOpeningObservations(run, current),
  };
}

for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`Nearby shore genuine island departure, retained historical diagnostic: ${difficulty}/${turnPolicy}`, () => {
      const { level } = resolveMission(project, 'nearby-shore', { difficulty });
      const result = twoCuts(level, turnPolicy, ['down', 'right']);
      assert.deepEqual(result.legacy.closures[1].departureFoundations, []);
      assert.deepEqual(result.current.closures[1].departureFoundations, [0]);
      assert.deepEqual(result.current.closures[0].returnFoundations, [0]);
      assert.deepEqual(result.current.visitedFoundations, [[0, 174]]);
      assert.equal(result.run.tick, turnPolicy === 'immediate' ? 636 : 642);
      assert.equal(result.run.coverage, 582 / 2355);
    });

for (const turnPolicy of ['immediate', 'grid-center'])
  for (const [side, x, y, entry, exit] of [
    ['north', 32.5, 0.5, 'down', 'right'],
    ['south', 32.5, 35.5, 'up', 'left'],
    ['west', 0.5, 17.5, 'right', 'down'],
    ['east', 71.5, 17.5, 'left', 'up'],
  ])
    test(`authored ${side} landing and departure use actual foundation ownership: ${turnPolicy}`, () => {
      const edited = structuredClone(source);
      const mission = edited.missions.find((m) => m.id === 'nearby-shore');
      const map = edited.maps.find((m) => m.id === mission.map.id);
      Object.assign(map.spawns[0], { x, y });
      mission.actors = [{ ...mission.actors[0], x: 3.5, y: 3.5, heading: [1, 1] }];
      const { level } = resolveMission(compileContentProject(edited), 'nearby-shore', {
        difficulty: 'gentle',
      });
      const result = twoCuts(level, turnPolicy, [entry, exit], true);
      assert.deepEqual(result.current.closures[0].returnFoundations, [0]);
      assert.deepEqual(result.current.closures[1].departureFoundations, [0]);
      assert.equal(result.current.allFoundationsVisited, true);
      if (side === 'south' && turnPolicy === 'immediate') {
        const tangent = twoCuts(level, turnPolicy, [entry, exit]);
        assert.deepEqual(tangent.current.closures[0].returnFoundations, [0]);
        assert.deepEqual(tangent.current.closures[1].departureFoundations, []);
        assert.equal(tangent.current.allFoundationsVisited, true);
      }
    });

test('V2 is explicitly scoped to stop-on-capture; no invented visits for unsupported movement', () => {
  const { level } = resolveMission(project, 'nearby-shore');
  const unsupported = createRun({ ...level, rules: { ...level.rules, stopOnCapture: false } });
  assert.throws(() => createBoundaryAwareOpeningObservations(unsupported), /stop-on-capture/);
});

test('all thirty historical routes keep checkpoints and V1 evidence; V2 corrects labels, not gameplay', async () => {
  const historical = JSON.parse(
    await readFile(new URL('./fixtures/opening-pressure-routes.json', import.meta.url)),
  );
  const whole = compileContentProject(withPressureDifficulty(createWholeJourneyCandidates()));
  assert.equal(historical.rows.length, 30);
  assert.equal(
    new Set(historical.rows.map((row) => [row.id, row.difficulty, row.turnPolicy].join('/'))).size,
    30,
  );
  const changedVisits = [],
    changedRows = [];
  let changedClosures = 0;
  for (const row of historical.rows) {
    const manifest = resolveMission(whole, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const run = createRun(manifest.level, {
      seed: row.seed,
      classId: 'scout',
      turnPolicy: row.turnPolicy,
    });
    const old = createOpeningObservations(run),
      current = createBoundaryAwareOpeningObservations(run);
    for (const { direction, ticks } of row.segments)
      for (let i = 0; i < ticks; i++) {
        const before = openingBeforeStep(run);
        stepRun(run, { direction }, FIXED_DT);
        observeOpeningStep(run, old, before);
        observeBoundaryAwareOpeningStep(run, current, before);
      }
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert.deepEqual(inspectHistoricalOpeningObservations(run, old), row.observations);
    const result = inspectOpeningObservations(run, current);
    assert.equal(result.format, 'OpeningFoundationObservationsV2');
    const key = [row.id, row.difficulty, row.turnPolicy].join('/');
    const changes = result.closures.filter(
      (closure, i) => JSON.stringify(closure) !== JSON.stringify(row.observations.closures[i]),
    ).length;
    if (changes) changedRows.push(key);
    changedClosures += changes;
    const visits = result.visitedFoundations.map(([i]) => i);
    const oldVisits = row.observations.visitedFoundations.map(([i]) => i);
    if (JSON.stringify(visits) !== JSON.stringify(oldVisits)) changedVisits.push({ key, visits });
    if (['nearby-shore', 'second-landing'].includes(row.id)) assert.deepEqual(visits, []);
    if (row.id === 'horizon-remix') assert.deepEqual(visits, [0]);
  }
  assert.equal(changedClosures, 33);
  assert.equal(changedRows.length, 17);
  assert.deepEqual(
    changedVisits.sort((a, b) => a.key.localeCompare(b.key)),
    [
      { key: 'courtyard-return/expert/grid-center', visits: [2, 3, 1, 0] },
      { key: 'courtyard-return/expert/immediate', visits: [2, 3, 1] },
      { key: 'courtyard-return/standard/immediate', visits: [2, 3, 1] },
      { key: 'return-pocket/standard/immediate', visits: [2, 0, 1] },
    ],
  );
});

test('Nearby shore has a no-wait island-first clear and equal race; the first landing is a useful return', async () => {
  const row = JSON.parse(
    await readFile(new URL('./fixtures/shore-foundation-route.json', import.meta.url)),
  );
  assert.equal(row.format, 'ShoreFoundationRouteV1');
  assert.equal(row.id, 'nearby-shore');
  assert.equal(row.difficulty, 'standard');
  assert.equal(row.turnPolicy, 'immediate');
  assert.equal(row.seed, 1);
  const whole = compileContentProject(withPressureDifficulty(createWholeJourneyCandidates()));
  const manifest = resolveMission(whole, row.id, { difficulty: row.difficulty });
  assert.equal(manifest.simulationIdentity, row.simulationIdentity);
  const options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy };
  const run = createRun(manifest.level, options),
    recorder = createRecorder(manifest.level, options);
  const observed = createBoundaryAwareOpeningObservations(run);
  const race = createDuel(manifest.level, options, { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 });
  resumeDuel(race);
  for (const [direction, ticks] of row.segments) {
    assert(['down', 'up', 'left', 'right'].includes(direction), 'no stopped wait inserted');
    for (let i = 0; i < ticks; i++) {
      assert.equal(run.status, 'running');
      const before = openingBeforeStep(run);
      recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
      observeBoundaryAwareOpeningStep(run, observed, before);
      stepDuel(race, [{ direction }, { direction }]);
      assert.equal(run.classic.livesLost, 0);
    }
  }
  assert.equal(run.status, 'won');
  assert.equal(run.tick, row.ticks);
  assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  const evidence = inspectOpeningObservations(run, observed);
  assert.equal(evidence.closures.length, 4);
  assert.deepEqual(evidence.visitedFoundations, [[0, 174]]);
  assert.deepEqual(evidence.closures[0].returnFoundations, [0]);
  assert.equal(evidence.closures[0].lineOnly, true);
  assert.deepEqual(evidence.closures[1].departureFoundations, [0]);
  assert.equal(evidence.closures[1].lineOnly, false);
  assert.equal(race.status, 'finished');
  assert.equal(race.winner, null);
  for (const raced of race.runs) {
    assert.equal(raced.status, 'won');
    assert.equal(raced.classic.livesLost, 0);
    assert.deepEqual(authoritativeCheckpoint(raced), authoritativeCheckpoint(run));
  }
  assert.deepEqual(authoritativeCheckpoint(race.runs[0]), authoritativeCheckpoint(race.runs[1]));
});
