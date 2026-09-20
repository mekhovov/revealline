import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLivewireCandidates } from '../content-design/livewire-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import {
  createLivewireGoalEvidence,
  observeLivewireGoal,
  inspectLivewireGoal,
  livewireBeforeStep,
} from './helpers/livewire-goal.mjs';

const source = createLivewireCandidates(),
  project = compileContentProject(source);
const ordinary = JSON.parse(
  await readFile(new URL('./fixtures/livewire-clear-routes.json', import.meta.url)),
);
const supplemental = JSON.parse(
  await readFile(new URL('./fixtures/livewire-mastery-routes.json', import.meta.url)),
);
const key = (row) => `${row.missionId}/${row.difficulty}/${row.turnPolicy}`;

function replayGoal(row) {
  const manifest = resolveMission(project, row.missionId, { difficulty: row.difficulty });
  assert.equal(manifest.simulationIdentity, row.simulationIdentity, key(row));
  assert.equal(manifest.officialProgressEligible, false);
  const options = { seed: 1, classId: 'scout', turnPolicy: row.turnPolicy };
  const run = createRun(manifest.level, options),
    evidence = createLivewireGoalEvidence(run);
  const recorder = createRecorder(
    manifest.level,
    options,
    'livewire-optional-goal-feasibility-not-human-validation',
  );
  const denominator = run.totalClaimable;
  for (const [direction, ticks] of row.segments) {
    assert([null, 'up', 'down', 'left', 'right'].includes(direction));
    assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
    for (let tick = 0; tick < ticks; tick++) {
      assert.equal(run.status, 'running', key(row));
      const before = livewireBeforeStep(run);
      recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
      observeLivewireGoal(run, evidence, before);
      assert.equal(run.classic.livesLost, 0, key(row));
      assert.equal(run.totalClaimable, denominator, key(row));
      if (run.coverage >= manifest.level.goal.coverage)
        assert(
          run.objectives.every((o) => !o.required || o.captured),
          `${key(row)}: no quota cleanup`,
        );
    }
  }
  assert.equal(run.status, 'won', key(row));
  assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint, key(row));
  const replay = verifyReplay(exportReplay(recorder, run));
  assert.equal(replay.match, true, key(row));
  assert.equal(replay.state.status, 'won', key(row));
  const foundations = source.maps.find(
    (m) => m.id === source.missions.find((m) => m.id === row.missionId).map.id,
  ).foundations;
  return inspectLivewireGoal({
    missionId: row.missionId,
    run,
    foundations,
    evidence,
  });
}

test('every Livewire Foundry optional goal has a no-loss public replay in all42 preset/control cases', () => {
  assert.equal(supplemental.format, 'LivewireMasteryFeasibilityV1');
  assert.equal(supplemental.rows.length, 7);
  const supplements = new Map(supplemental.rows.map((row) => [key(row), row]));
  assert.equal(supplements.size, 7);
  let count = 0;
  for (const set of ordinary.sets)
    for (const [missionId, simulationIdentity, checkpoint, segments] of set.rows) {
      const base = {
        missionId,
        simulationIdentity,
        checkpoint,
        segments,
        difficulty: set.difficulty,
        turnPolicy: set.turnPolicy,
      };
      const row = supplements.get(key(base)) ?? base;
      const result = replayGoal(row);
      assert.equal(result.achieved, true, `${key(row)}: ${JSON.stringify(result)}`);
      count++;
    }
  assert.equal(count, 42);
});

test('7 ordinary Livewire Foundry clears do not counterfeit optional-goal evidence', () => {
  const needsAnotherRoute = new Set(supplemental.rows.map(key));
  let rejected = 0;
  for (const set of ordinary.sets)
    for (const [missionId, simulationIdentity, checkpoint, segments] of set.rows) {
      const row = {
        missionId,
        simulationIdentity,
        checkpoint,
        segments,
        difficulty: set.difficulty,
        turnPolicy: set.turnPolicy,
      };
      if (!needsAnotherRoute.has(key(row))) continue;
      assert.equal(replayGoal(row).achieved, false, key(row));
      rejected++;
    }
  assert.equal(rejected, 7);
});
