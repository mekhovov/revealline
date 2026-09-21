import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLivewireSpatialCandidates } from '../content-design/livewire-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  createLivewireGoalEvidence,
  livewireBeforeStep,
  observeLivewireGoal,
  inspectLivewireGoal,
} from './helpers/livewire-goal.mjs';

const project = compileContentProject(createLivewireSpatialCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/livewire-spatial-routes.json', import.meta.url)),
);
const delayed = JSON.parse(
  await readFile(new URL('./fixtures/livewire-spatial-delay-route.json', import.meta.url)),
);

test('new Afterglow paths cover all presets and both steering policies exactly once', () => {
  assert.equal(fixture.format, 'LivewireSpatialRoutesV1');
  assert.equal(fixture.rows.length, 6);
  assert.deepEqual(fixture.rows.map((row) => `${row.difficulty}/${row.turnPolicy}`).sort(), [
    'expert/grid-center',
    'expert/immediate',
    'gentle/grid-center',
    'gentle/immediate',
    'standard/grid-center',
    'standard/immediate',
  ]);
});

for (const row of [...fixture.rows, delayed])
  test(`Afterglow full legal clear/replay/equal race: ${row.difficulty}/${row.turnPolicy}/seed${row.seed}`, () => {
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options);
    const recorder = createRecorder(manifest.level, options);
    const evidence = createLivewireGoalEvidence(run);
    const duel = createDuel(manifest.level, options, {
      protocol: UNTIMED_DUEL_PROTOCOL,
      seconds: 0,
    });
    assert.notEqual(duel.runs[0].cells, duel.runs[1].cells);
    resumeDuel(duel);
    const closures = [];
    let warnings = 0;
    let capturedCells = 0;
    const denominator = run.totalClaimable;
    for (const { direction, ticks } of row.segments)
      for (let tick = 0; tick < ticks; tick++) {
        assert.equal(run.status, 'running');
        assert.equal(duel.status, 'running');
        const before = livewireBeforeStep(run);
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        observeLivewireGoal(run, evidence, before);
        stepDuel(duel, [{ direction }, { direction }]);
        assert.equal(run.classic.livesLost, 0);
        assert.equal(run.totalClaimable, denominator);
        warnings += run.events.filter((event) => event.type === 'boss.warning').length;
        if (run.events.some((event) => event.type === 'cut.closed')) {
          closures.push([run.tick, run.coverage]);
          assert(run.claimedCount > capturedCells);
          capturedCells = run.claimedCount;
        }
      }
    assert.equal(run.status, 'won');
    assert.equal(run.tick, row.ticks);
    assert.equal(run.coverage, row.coverage);
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert.deepEqual(closures, row.closures);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    assert(warnings > 0);
    const map = project.maps.find((item) => item.source.id === `${row.id}-map`);
    const goal = inspectLivewireGoal({
      missionId: row.id,
      run,
      foundations: map.source.foundations,
      evidence,
    });
    assert.equal(goal.achieved, true);
    assert.equal(duel.status, 'finished');
    assert.equal(duel.winner, null);
    assert(duel.runs.every((item) => item.status === 'won' && item.classic.livesLost === 0));
    assert.deepEqual(authoritativeCheckpoint(duel.runs[0]), authoritativeCheckpoint(duel.runs[1]));
  });
