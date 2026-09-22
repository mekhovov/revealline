import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHorizonSpatialCandidates } from '../content-design/horizon-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  createOpeningObservations,
  openingBeforeStep,
  observeOpeningStep,
  inspectOpeningObservations,
} from './helpers/opening-route-observations.mjs';

const project = compileContentProject(createHorizonSpatialCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/horizon-spatial-routes.json', import.meta.url)),
);
test('Courtyard routes cover every preset/control plus a delayed new seed', () => {
  assert.equal(fixture.format, 'HorizonSpatialRoutesV1');
  assert.equal(fixture.rows.length, 7);
  const normal = fixture.rows.filter((row) => row.seed === 1);
  assert.deepEqual(normal.map((row) => row.difficulty + '/' + row.turnPolicy).sort(), [
    'expert/grid-center',
    'expert/immediate',
    'gentle/grid-center',
    'gentle/immediate',
    'standard/grid-center',
    'standard/immediate',
  ]);
  const delayed = fixture.rows.find((row) => row.seed === 2);
  assert.equal(delayed.delaySeconds, 1.5);
  assert.deepEqual(delayed.segments[0], { direction: null, ticks: 180 });
});

for (const row of fixture.rows)
  test(`Courtyard clear/replay/inward-outward/equal race: ${row.difficulty}/${row.turnPolicy}/${row.seed}`, () => {
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options);
    const recorder = createRecorder(manifest.level, options);
    const evidence = createOpeningObservations(run);
    const regions = inspectCaptureSnapshot(run).components;
    const duel = createDuel(manifest.level, options, {
      protocol: UNTIMED_DUEL_PROTOCOL,
      seconds: 0,
    });
    assert.notEqual(duel.runs[0].cells, duel.runs[1].cells);
    resumeDuel(duel);
    const closures = [];
    for (const { direction, ticks } of row.segments)
      for (let t = 0; t < ticks; t++) {
        assert.equal(run.status, 'running');
        if (direction === null) {
          assert.equal(run.player.speed, 0);
          assert.equal(run.player.cutting, false);
        }
        const before = openingBeforeStep(run);
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        observeOpeningStep(run, evidence, before);
        stepDuel(duel, [{ direction }, { direction }]);
        assert.equal(run.classic.livesLost, 0);
        assert.equal(run.totalClaimable, 2124);
        if (run.events.some((e) => e.type === 'cut.closed'))
          closures.push([run.tick, run.coverage]);
      }
    assert.equal(run.status, 'won');
    assert.equal(run.tick, row.ticks);
    assert.equal(run.coverage, row.coverage);
    assert.deepEqual(closures, row.closures);
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    const observations = inspectOpeningObservations(run, evidence);
    assert.deepEqual(observations.cutRegions, ['inside', 'outside']);
    assert(regions.every((region) => region.cells.some((cell) => run.cells[cell] === CELL.SAFE)));
    assert.equal(duel.status, 'finished');
    assert.equal(duel.winner, null);
    assert(duel.runs.every((r) => r.status === 'won' && r.classic.livesLost === 0));
    assert.deepEqual(authoritativeCheckpoint(duel.runs[0]), authoritativeCheckpoint(duel.runs[1]));
  });
