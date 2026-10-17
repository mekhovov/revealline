// Intentionally dependency-free and self-contained: this exact function can run
// with the observed artifact's production modules inside its browser engine.
// Never import the current checkout or a permissive demo verifier here.
export function inspectReplayMechanics(
  recording,
  requirements = {},
  dependencies,
  expectedDefinition,
) {
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
  const canonical = (value) =>
    Array.isArray(value)
      ? `[${value.map(canonical).join(',')}]`
      : value && typeof value === 'object'
        ? `{${Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
            .join(',')}}`
        : JSON.stringify(value);
  const definitionCheck = expectedDefinition
    ? {
        expectedLevelId: expectedDefinition.level.id,
        actualLevelId: replay.level.id,
        levelMatches: canonical(replay.level) === canonical(expectedDefinition.level),
        optionChecks: Object.entries(expectedDefinition.options).map(([key, expected]) => ({
          key,
          expected,
          actual: replay.options[key],
          match: canonical(replay.options[key]) === canonical(expected),
        })),
        scope:
          'Every immutable recorded level field, including rules, actors, geometry and revision, plus explicitly declared run options. Undeclared options are not claimed equal.',
      }
    : null;
  if (definitionCheck)
    definitionCheck.match =
      definitionCheck.levelMatches && definitionCheck.optionChecks.every((row) => row.match);
  const features = {
    closures: 0,
    eroded: 0,
    shots: 0,
    warningTicks: 0,
    projectileTicks: 0,
    jammerTicks: 0,
    movingTicks: 0,
    directionChangesWithMovement: 0,
    maximumTrailCells: 0,
    maximumClaimedCells: 0,
  };
  // Opt in without changing historical undeclared reports. Cumulative claimed
  // coverage cannot establish the cost of a single large capture.
  const inspectCaptureSize = Object.prototype.hasOwnProperty.call(
    requirements,
    'maximumCaptureCells',
  );
  if (inspectCaptureSize) features.maximumCaptureCells = 0;
  let previousAcceptedMovingDirection = null;
  for (const segment of replay.segments) {
    if (segment.releaseBefore) releaseInputs(run);
    for (let tick = 0; tick < segment.ticks; tick++) {
      const beforeX = run.player.x,
        beforeY = run.player.y,
        beforeStatus = run.status;
      stepRun(run, segment.input, FIXED_DT);
      if (run.player.x !== beforeX || run.player.y !== beforeY) features.movingTicks++;
      const requested = segment.input.direction,
        dx = run.player.x - beforeX,
        dy = run.player.y - beforeY,
        recovery = run.events.some((event) =>
          ['player.failed', 'player.respawned', 'shield.absorbed'].includes(event.type),
        );
      if (recovery) previousAcceptedMovingDirection = null;
      // The first moving command establishes a direction; it is not a reversal.
      // Count only requested, accepted cardinal displacement. Repeated input,
      // neutral/release boundaries, blocked turns and recovery teleports add none.
      const acceptedMovement =
        beforeStatus === 'running' &&
        !recovery &&
        requested === run.player.direction &&
        ((requested === 'left' && dx < 0 && Math.abs(dy) <= 1e-9) ||
          (requested === 'right' && dx > 0 && Math.abs(dy) <= 1e-9) ||
          (requested === 'up' && dy < 0 && Math.abs(dx) <= 1e-9) ||
          (requested === 'down' && dy > 0 && Math.abs(dx) <= 1e-9));
      if (acceptedMovement) {
        if (
          previousAcceptedMovingDirection !== null &&
          requested !== previousAcceptedMovingDirection
        )
          features.directionChangesWithMovement++;
        previousAcceptedMovingDirection = requested;
      }
      for (const event of run.events) {
        if (event.type === 'cut.closed') {
          features.closures++;
          if (inspectCaptureSize) {
            check(
              Number.isSafeInteger(event.cells) && event.cells >= 0,
              'Capture event has no valid individual cell count',
            );
            features.maximumCaptureCells = Math.max(features.maximumCaptureCells, event.cells);
          }
        }
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
    status:
      checks.every((check) => check.pass) && definitionCheck?.match !== false ? 'pass' : 'fail',
    definitionCheck,
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
