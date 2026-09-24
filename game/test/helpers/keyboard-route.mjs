import assert from 'node:assert/strict';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../../replay.mjs';
import { assertRouteEvidence } from './route-evidence.mjs';
import { createRun, stepRun, FIXED_DT } from '../../core/index.mjs';

/** Translate raw fixed-tick recordings into real fresh gestures at every capture.
 * The independently stepped reference is never injected into the actual host. */
export function playKeyboardRoute(p, runs, controls, row) {
  const reference = createRun(runs()[0].level, {
    seed: row.seed,
    classId: 'scout',
    turnPolicy: row.turnPolicy,
  });
  const recorder = row.evidence
    ? createRecorder(reference.level, {
        seed: row.seed,
        classId: 'scout',
        turnPolicy: row.turnPolicy,
      })
    : null;
  for (const run of runs())
    assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(reference));
  let previous = null;
  let freshCaptureGestures = 0;
  for (const { direction, ticks } of row.segments) {
    const end = reference.tick + ticks;
    while (reference.tick < end) {
      let captured = false;
      do {
        assert.equal(
          reference.status,
          'running',
          'The recorded route cannot end before its next gesture',
        );
        if (recorder) recordInput(recorder, { direction });
        stepRun(reference, { direction }, FIXED_DT);
        captured = reference.events.some((event) => event.type === 'capture.stopped');
      } while (reference.tick < end && !captured);
      for (const keys of controls) {
        if (previous) p.key(keys[previous], false);
        if (direction) p.key(keys[direction]);
      }
      const target = reference.tick;
      const remaining = target - runs()[0].tick;
      for (let frames = 0; runs()[0].tick < target && frames <= remaining; frames++)
        p.frame((Math.min(6, target - runs()[0].tick) * 1000) / 120);
      for (const run of runs()) {
        assert.equal(run.tick, target);
        assert.equal(run.classic.livesLost, 0);
        assert.deepEqual(
          authoritativeCheckpoint(run),
          authoritativeCheckpoint(reference),
          `After ${direction}/${target}`,
        );
        if (captured) assert.equal(run.player.speed, 0);
      }
      if (captured && target < end) freshCaptureGestures++;
      previous = direction;
    }
  }
  for (const keys of controls) if (previous) p.key(keys[previous], false);
  if (recorder)
    assert.equal(
      verifyReplay(exportReplay(recorder, reference)).match,
      true,
      'Exact public replay',
    );
  for (const run of runs()) {
    assert.equal(run.status, 'won');
    assert.deepEqual(
      authoritativeCheckpoint(run),
      authoritativeCheckpoint(reference),
      'Final released host and reference',
    );
    if (row.evidence) assertRouteEvidence(run, row.evidence);
    else assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
  }
  return { freshCaptureGestures };
}
