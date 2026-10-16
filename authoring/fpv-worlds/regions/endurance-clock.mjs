/** Authoring measurement clock. Never drives production player input or scoring. */
export function createEnduranceClock({
  startedAt,
  startedWallAt = null,
  targetMs,
  stepMs = 20,
  gapLimitMs = 250,
}) {
  if (
    ![startedAt, targetMs, stepMs, gapLimitMs].every(Number.isFinite) ||
    startedAt < 0 ||
    targetMs < 1000 ||
    targetMs > 7200000 ||
    stepMs !== 20 ||
    targetMs % stepMs ||
    gapLimitMs !== 250 ||
    (startedWallAt !== null && (!Number.isFinite(startedWallAt) || startedWallAt < 0))
  )
    throw new TypeError('Invalid endurance clock');
  let last = startedAt,
    lastWall = startedWallAt,
    accumulator = 0,
    ticks = 0,
    status = 'running',
    reason = null;
  const targetTicks = targetMs / stepMs;
  const snapshot = () => ({
    status,
    reason,
    targetMs,
    elapsedMs: last - startedAt,
    wallElapsedMs: startedWallAt === null ? null : lastWall - startedWallAt,
    simulationMs: ticks * stepMs,
    ticks,
    remainingAccumulatorMs: accumulator,
  });
  const invalidate = (message) => {
    if (status !== 'invalid') {
      status = 'invalid';
      reason = String(message).slice(0, 200);
    }
    return snapshot();
  };
  return Object.freeze({
    snapshot,
    invalidate,
    advance(now, step, wallNow = null) {
      if (status !== 'running') return snapshot();
      if (!Number.isFinite(now) || now < last) return invalidate('Clock moved backwards');
      const delta = now - last;
      last = now;
      if (startedWallAt !== null) {
        if (!Number.isFinite(wallNow) || wallNow < lastWall)
          return invalidate('Wall clock unavailable or moved backwards');
        lastWall = wallNow;
        if (Math.abs(lastWall - startedWallAt - (last - startedAt)) > gapLimitMs)
          return invalidate('System suspension or wall-clock discontinuity');
      }
      if (delta > gapLimitMs) return invalidate('Frame gap exceeded 250 ms');
      accumulator += delta;
      // Never fast-forward, drop accumulated time, or count more than elapsed real time.
      while (accumulator + 1e-8 >= stepMs && ticks < targetTicks) {
        if (step() !== true) return invalidate('Flight stopped accepting active ticks');
        accumulator -= stepMs;
        if (accumulator < 0 && accumulator > -1e-8) accumulator = 0;
        ticks++;
      }
      if (ticks === targetTicks && last - startedAt >= targetMs) status = 'completed';
      return snapshot();
    },
  });
}
