// Intentionally dependency-free and self-contained: this exact function can run
// with the observed artifact's production modules inside its browser engine.
// Never import the current checkout or a permissive demo verifier here.
export function inspectReplayMechanics(recording, requirements = {}, dependencies) {
  const {
    createRun,
    stepRun,
    releaseInputs,
    FIXED_DT,
    verifyReplay,
    authoritativeCheckpoint,
    jammerPictureStrength,
    combatView,
  } = dependencies;
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const replay = recording.replay ?? recording;
  const verified = verifyReplay(replay);
  if (!verified.match)
    return {
      match: false,
      status: 'fail',
      diagnostics: verified.diagnostics,
      actual: verified.actual,
      recordedCheckpoint: replay.checkpoint,
      features: null,
      checks: [],
      scope: 'Strict artifact verifier rejected the unchanged recording. Mechanics are unobserved.',
    };
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
  check(
    JSON.stringify(authoritativeCheckpoint(run)) === JSON.stringify(verified.actual.checkpoint),
    'Mechanic reconstruction differs from the strict verified checkpoint',
  );
  const checks = Object.entries(requirements).map(([feature, minimum]) => ({
    feature,
    minimum,
    actual: features[feature],
    pass: Number.isFinite(features[feature]) && features[feature] >= minimum,
  }));
  return {
    match: true,
    diagnostics: verified.diagnostics,
    status: checks.every((check) => check.pass) ? 'pass' : 'fail',
    levelId: run.levelId,
    ticks: run.tick,
    outcome: run.status,
    features,
    checks,
    checkpoint: verified.actual.checkpoint,
    scope:
      'Post-measurement reconstruction using supplied production dependencies and unchanged strict checkpoints; establishes mechanics, not timing or pixels.',
  };
}
