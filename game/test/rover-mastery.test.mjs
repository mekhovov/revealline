import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRoverCandidates } from '../content-design/rover-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { inspectRoverGoal, roverLinks } from './helpers/rover-goal.mjs';

const source = createRoverCandidates(),
  project = compileContentProject(source);
const ordinary = JSON.parse(
  await readFile(new URL('./fixtures/rover-clear-routes.json', import.meta.url)),
);
const supplemental = JSON.parse(
  await readFile(new URL('./fixtures/rover-mastery-routes.json', import.meta.url)),
);
const key = (row) => `${row.missionId}/${row.difficulty}/${row.turnPolicy}`;

function replayGoal(row) {
  const manifest = resolveMission(project, row.missionId, { difficulty: row.difficulty });
  assert.equal(manifest.simulationIdentity, row.simulationIdentity, key(row));
  assert.equal(manifest.officialProgressEligible, false);
  const options = { seed: 1, classId: 'scout', turnPolicy: row.turnPolicy };
  const run = createRun(manifest.level, options);
  const recorder = createRecorder(
    manifest.level,
    options,
    'rover-optional-goal-feasibility-not-human-validation',
  );
  const foundations = source.maps.find(
    (m) => m.id === project.missions.find((m) => m.id === row.missionId).map.id,
  ).foundations;
  const initialComponents = inspectCaptureSnapshot(run).components,
    closures = [];
  for (const [direction, ticks] of row.segments) {
    assert(direction === null || ['up', 'down', 'left', 'right'].includes(direction));
    assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
    for (let tick = 0; tick < ticks; tick++) {
      assert.equal(run.status, 'running', `${key(row)}: input after completion`);
      const before = run.claimedCount,
        trail = run.trail.map((cell) => cell.index),
        activeIds = run.enemies
          .filter((actor) => actor.type === 'claimed-rover' && actor.classic.mode === 'active')
          .map((actor) => actor.id);
      recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
      assert.equal(run.classic.livesLost, 0, key(row));
      if (run.claimedCount > before)
        closures.push({ trail, activeIds, allLinked: roverLinks(run, foundations) });
    }
  }
  assert.equal(run.status, 'won', key(row));
  assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint, key(row));
  const replay = verifyReplay(exportReplay(recorder, run));
  assert.equal(replay.match, true, key(row));
  assert.equal(replay.state.status, 'won', key(row));
  return inspectRoverGoal({
    missionId: row.missionId,
    run,
    foundations,
    initialComponents,
    closures,
  });
}

test('every Rover optional goal has a pinned no-loss clear in all presets and steering settings', () => {
  assert.equal(supplemental.format, 'RoverMasteryFeasibilityV1');
  assert.equal(supplemental.rows.length, 22);
  const supplements = new Map(supplemental.rows.map((row) => [key(row), row]));
  assert.equal(supplements.size, 22);
  let checked = 0;
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
      checked++;
    }
  assert.equal(checked, 42);
});

test('ordinary clears do not silently become optional-goal awards when a different route is required', () => {
  let rejected = 0;
  const needsAnotherRoute = new Set(supplemental.rows.map(key));
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
  assert.equal(rejected, 22);
});
