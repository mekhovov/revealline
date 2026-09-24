import assert from 'node:assert/strict';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../../replay.mjs';
import { createRun, stepRun, FIXED_DT } from '../../core/index.mjs';

// Current shipped opening, proven independently through fixed-step replay.
export function winCurrentOpening(h) {
  const run = h.rendered.run,
    picture = h.rendered.backdrop,
    options = {
      seed: run.seed,
      classId: run.classId,
      turnPolicy: run.turnPolicy,
      classRecipes: run.classRecipes,
    },
    reference = createRun(run.level, options),
    recorder = createRecorder(run.level, options);
  assert.equal(run.levelId, 'signal-01');
  assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(reference));
  // Wait for the patrol to clear the crossing, then make a legal current-speed
  // cut. The accepted level, actors, artwork and outcome remain untouched.
  for (let i = 0; i < 180; i++) {
    recordInput(recorder, {});
    stepRun(reference, {}, FIXED_DT);
    h.frame();
    assert.equal(run.lives, 3);
    assert.equal(reference.lives, 3);
  }
  h.key('ArrowDown');
  for (let i = 0; i < 469; i++) {
    recordInput(recorder, { direction: 'down' });
    stepRun(reference, { direction: 'down' }, FIXED_DT);
    h.frame();
    assert.equal(run.lives, 3);
    assert.equal(reference.lives, 3);
  }
  h.key('ArrowDown', false);
  h.frame(0);
  assert.equal(run.status, 'won');
  assert.equal(reference.status, 'won');
  assert.equal(run.tick, 649);
  assert.equal(run.lives, 3);
  assert.equal(h.rendered.backdrop, picture);
  assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(reference));
  assert.equal(verifyReplay(exportReplay(recorder, reference)).match, true);
}
