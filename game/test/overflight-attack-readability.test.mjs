import test from 'node:test';
import assert from 'node:assert/strict';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  pauseOverflight,
  resumeOverflight,
} from '../overflight/core.mjs';
import {
  overflightPendingPayloadLayers,
  overflightEscortShotLayers,
} from '../overflight/tactical-view.mjs';

function release(branch, heading = 0) {
  const compiled = structuredClone(
    compileOverflightProject(createOverflightProject({ rulesVersion: 4 })),
  );
  compiled.encounters = [];
  compiled.goals = { ...compiled.goals, eliteAt: 10000, finalAt: 20000 };
  const run = createOverflightRun(compiled);
  startOverflight(run);
  run.player.x = 1000;
  run.player.y = 500;
  run.player.heading = heading;
  run.build.primary = { rank: 4, branch, evolved: true };
  run._cooldowns.primary = 0;
  stepOverflight(run);
  return run;
}
const footprints = (run) =>
  run._echoes.flatMap(overflightPendingPayloadLayers).filter((c) => c.frame === 'ring');

test('native Echo preparation shows all released centers and expires with each actual queued impact', () => {
  const run = release('double');
  assert.deepEqual(
    footprints(run).map((c) => [c.x, c.y, c.width / 2]),
    [
      [944, 500, 44],
      [892, 500, 52],
      [840, 500, 60],
    ],
  );
  const pending = structuredClone(run._echoes);
  const before = footprints(run);
  assert.deepEqual(run._echoes, pending, 'drawing cannot mutate pending attacks');
  pauseOverflight(run);
  for (let i = 0; i < 60; i++) stepOverflight(run, { y: -1 });
  assert.deepEqual(footprints(run), before, 'preparation uses the paused gameplay clock');
  resumeOverflight(run);
  for (let i = 0; i < 30; i++) stepOverflight(run, { y: -1 });
  assert.notEqual(run.player.y, 500);
  assert.deepEqual(
    footprints(run).map((c) => [c.x, c.y]),
    [
      [892, 500],
      [840, 500],
    ],
    'turning cannot drag already released echoes',
  );
  for (let i = 0; i < 24; i++) stepOverflight(run, { y: -1 });
  assert.deepEqual(footprints(run), [], 'all impact cues end before the next release');
});

test('native Fan preparation shows five lateral footprints at the release heading', () => {
  const run = release('wide', Math.PI / 2);
  const rings = footprints(run);
  assert.equal(rings.length, 5);
  for (const [i, cue] of rings.entries()) {
    assert.ok(Math.abs(cue.x - (1136 - i * 68)) < 1e-8);
    assert.ok(Math.abs(cue.y - 472) < 1e-8);
    assert.equal(cue.width, 96);
    assert.ok(cue.alpha < 0.4, 'friendly preparation stays quieter than hostile warnings');
  }
});

test('older escort snapshots keep their single beam while inactive shots draw nothing', () => {
  const escort = { role: 'breaker', x: 0, y: 0, targetX: 30, targetY: 40, beamRemaining: 0.1 };
  assert.equal(overflightEscortShotLayers(escort)[0].width, 50);
  assert.deepEqual(overflightEscortShotLayers({ ...escort, beamRemaining: 0 }), []);
});
