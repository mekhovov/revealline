import { createRun, stepRun, FIXED_DT } from '../../game/core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../../game/replay.mjs';

// Offline evidence only. Every observation comes from legal public engine input.
// An old route failing under new physics never proves that its map is impossible.
export function assessPressureRoute(
  level,
  { segments, turnPolicy, seed = 1, initialDelayTicks = 0, replay = false },
) {
  if (
    !Array.isArray(segments) ||
    segments.length === 0 ||
    segments.length > 1000 ||
    segments.some(
      (s) =>
        !Array.isArray(s) ||
        s.length !== 2 ||
        ![null, 'left', 'right', 'up', 'down'].includes(s[0]) ||
        !Number.isSafeInteger(s[1]) ||
        s[1] < 1,
    ) ||
    segments.reduce((n, s) => n + s[1], 0) > 120000 ||
    !Number.isSafeInteger(initialDelayTicks) ||
    initialDelayTicks < 0 ||
    initialDelayTicks > 1200 ||
    !['immediate', 'grid-center'].includes(turnPolicy) ||
    !Number.isSafeInteger(seed) ||
    seed < 1 ||
    seed > 2147483647
  )
    throw new Error('Invalid bounded route assessment input');
  const options = { seed, classId: 'scout', turnPolicy },
    run = createRun(level, options);
  const recorder = replay ? createRecorder(level, options) : null;
  const played = [],
    required = run.objectives.filter((o) => o.required).length;
  let firstCutTick = null,
    cuts = 0,
    exposureTicks = 0,
    currentExposure = 0,
    maxExposureTicks = 0;
  let firstCoverageMetTick = null,
    allRequiredCapturedTick = null;
  const inputs = initialDelayTicks ? [[null, initialDelayTicks], ...segments] : segments;
  outer: for (const [direction, ticks] of inputs)
    for (let n = 0; n < ticks; n++) {
      if (run.status !== 'running' || run.classic.livesLost) break outer;
      if (recorder) recordInput(recorder, { direction });
      const wasCutting = run.player.cutting;
      stepRun(run, { direction }, FIXED_DT);
      if (played.at(-1)?.[0] === direction) played.at(-1)[1]++;
      else played.push([direction, 1]);
      if (wasCutting || run.player.cutting) {
        exposureTicks++;
        currentExposure++;
        maxExposureTicks = Math.max(maxExposureTicks, currentExposure);
      }
      if (!run.player.cutting) currentExposure = 0;
      if (run.events.some((e) => e.type === 'cut.closed')) {
        cuts++;
        firstCutTick ??= run.tick;
      }
      if (run.coverage >= level.goal.coverage) firstCoverageMetTick ??= run.tick;
      if (required && run.objectives.every((o) => !o.required || o.captured))
        allRequiredCapturedTick ??= run.tick;
    }
  const clear = run.status === 'won' && run.classic.livesLost === 0;
  if (replay && clear && !verifyReplay(exportReplay(recorder, run)).match)
    throw new Error('Fresh pressure route replay mismatch');
  return {
    status: clear
      ? 'no-loss-clear'
      : run.classic.livesLost
        ? 'life-lost'
        : run.status === 'running'
          ? 'route-exhausted'
          : run.status,
    ticks: run.tick,
    seconds: run.time,
    coverage: run.coverage,
    losses: run.classic.livesLost,
    firstCutTick,
    cuts,
    exposureTicks,
    maxExposureTicks,
    firstCoverageMetTick,
    allRequiredCapturedTick,
    ticksAfterRequiredObjectives:
      allRequiredCapturedTick === null ? null : run.tick - allRequiredCapturedTick,
    ticksAfterFirstCoverage: firstCoverageMetTick === null ? null : run.tick - firstCoverageMetTick,
    collectedBonusIds: run.classic.powerups
      .filter((p) => p.collectedTick !== null)
      .map((p) => p.id),
    checkpoint: authoritativeCheckpoint(run).hash,
    ...(clear ? { segments: played } : {}),
  };
}
