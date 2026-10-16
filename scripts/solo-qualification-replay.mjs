import assert from 'node:assert/strict';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../game/core/index.mjs';
import { verifyReplay, authoritativeCheckpoint } from '../game/replay.mjs';
import { jammerPictureStrength } from '../game/ui/jammer-picture.mjs';
import { combatView } from '../game/ui/combat-view.mjs';

/** Offline processing of the recording produced by the public native host.
 * This runs after browser closure and cannot change the observed attempt. */
export function inspectQualificationReplay(recording, requirements = {}) {
  const replay = recording.replay ?? recording;
  const verified = verifyReplay(replay);
  assert(verified.match, `Native public replay mismatch: ${JSON.stringify(verified.diagnostics)}`);
  const run = createRun(replay.level, replay.options);
  const features = {
    closures: 0,
    eroded: 0,
    shots: 0,
    warningTicks: 0,
    projectileTicks: 0,
    jammerTicks: 0,
    movingTicks: 0,
    maximumTrailCells: 0,
    maximumClaimedCells: 0,
  };
  for (const segment of replay.segments) {
    if (segment.releaseBefore) releaseInputs(run);
    for (let tick = 0; tick < segment.ticks; tick++) {
      const beforeX = run.player.x,
        beforeY = run.player.y;
      stepRun(run, segment.input, FIXED_DT);
      if (run.player.x !== beforeX || run.player.y !== beforeY) features.movingTicks++;
      for (const event of run.events) {
        if (event.type === 'cut.closed') features.closures++;
        if (event.type === 'cells.eroded') features.eroded++;
        if (event.type === 'combat.fired') features.shots++;
      }
      const combat = combatView(run);
      if (combat?.valid && combat.projectiles.length) features.projectileTicks++;
      if (combat?.valid && combat.actors.some((actor) => actor.phase === 'warning'))
        features.warningTicks++;
      if (jammerPictureStrength(run) > 0) features.jammerTicks++;
      features.maximumTrailCells = Math.max(features.maximumTrailCells, run.trail.length);
      features.maximumClaimedCells = Math.max(features.maximumClaimedCells, run.claimedCount);
    }
  }
  if (replay.releaseAfter) releaseInputs(run);
  assert.deepEqual(authoritativeCheckpoint(run), verified.actual.checkpoint);
  const checks = Object.entries(requirements).map(([feature, minimum]) => ({
    feature,
    minimum,
    actual: features[feature],
    pass: Number.isFinite(features[feature]) && features[feature] >= minimum,
  }));
  return {
    match: true,
    status: checks.every((check) => check.pass) ? 'pass' : 'fail',
    levelId: run.levelId,
    ticks: run.tick,
    outcome: run.status,
    features,
    checks,
    checkpoint: verified.actual.checkpoint,
    scope:
      'Offline reconstruction of actual native-host public recording; establishes mechanics, not timing or pixels.',
  };
}
