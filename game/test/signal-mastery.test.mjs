import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSignalCandidates } from '../content-design/signal-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  createSignalGoalEvidence,
  observeSignalGoal,
  inspectSignalGoal,
} from './helpers/signal-goal.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/signal-mastery-routes.json', import.meta.url)),
);
const extension = JSON.parse(
  await readFile(new URL('./fixtures/signal-mastery-extension-routes.json', import.meta.url)),
);
const source = createSignalCandidates(),
  project = compileContentProject(source);

test('Signal optional goals retain exact Standard routes and qualify the supplemental preset/steering routes', () => {
  assert.equal(fixture.format, 'SignalMasteryFeasibilityRoutesV1');
  assert.equal(fixture.seed, 1);
  assert.equal(fixture.difficulty, 'standard');
  assert.equal(fixture.turnPolicy, 'immediate');
  assert.deepEqual(
    fixture.rows.map((row) => row[0]),
    project.missions.map((m) => m.id),
  );
  assert.equal(extension.format, 'SignalMasteryExtensionRoutesV1');
  assert.equal(extension.seed, fixture.seed);
  assert.equal(extension.sets.length, 5);
  assert.equal(extension.sets.flatMap((set) => set.rows).length, 17);
  for (const set of extension.sets)
    assert.equal(new Set(set.rows.map(([id]) => id)).size, set.rows.length);
  const sets = [fixture, ...extension.sets];
  assert.equal(new Set(sets.map((set) => `${set.difficulty}/${set.turnPolicy}`)).size, 6);
  for (const {
    difficulty,
    turnPolicy,
    row: [id, identity, checkpoint, segments],
  } of sets.flatMap((set) => set.rows.map((row) => ({ ...set, row })))) {
    const mission = source.missions.find((m) => m.id === id),
      map = source.maps.find((m) => m.id === mission.map.id),
      manifest = resolveMission(project, id, { difficulty });
    assert.equal(manifest.simulationIdentity, identity, id);
    const options = { seed: fixture.seed, classId: 'scout', turnPolicy };
    const run = createRun(manifest.level, options),
      recorder = createRecorder(
        manifest.level,
        options,
        'mastery-feasibility-not-human-validation',
      );
    const evidence = createSignalGoalEvidence(map, run);
    for (const [direction, ticks] of segments) {
      assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
      for (let tick = 0; tick < ticks; tick++) {
        assert.equal(run.status, 'running', id);
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        observeSignalGoal(run, evidence);
        assert.equal(run.classic.livesLost, 0, id);
      }
    }
    assert.equal(run.status, 'won', id);
    assert.equal(run.classic.livesLost, 0, id);
    assert.equal(authoritativeCheckpoint(run).hash, checkpoint, id);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true, id);
    assert.equal(inspectSignalGoal({ missionId: id, run, evidence }).achieved, true, id);
  }
});
