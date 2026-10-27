export const DEMO_ENDURANCE_PROGRESS_TIMEOUT_MS = 45000;

/** Sampled continuity only; this does not measure continuous painting. */
export function createDemoEnduranceProgress(startedAt) {
  if (!Number.isFinite(startedAt)) throw new TypeError('Endurance requires a finite start time.');
  let previousObservationAt = startedAt;
  let lastProgressAt = startedAt;
  let previousSignature = null;
  const observationGap = (at) => {
    if (!Number.isFinite(at) || at < previousObservationAt)
      throw new RangeError('Endurance observation timestamps must stay ordered.');
    const gapMs = at - previousObservationAt;
    if (gapMs >= DEMO_ENDURANCE_PROGRESS_TIMEOUT_MS) {
      throw Object.assign(
        new Error(`Endurance observation gap ${gapMs}ms reached the 45000ms progress limit.`),
        {
          code: 'demo-endurance-observation-gap',
          previousObservationAt,
          observedAt: at,
          gapMs,
        },
      );
    }
    return gapMs;
  };
  return {
    observe(value, at) {
      // Check elapsed observation time before a changed tick can reset progress.
      const gapMs = observationGap(at);
      const signature = `${value.source}:${value.phase}:${value.tick}`;
      const progressAt = signature !== previousSignature ? at : lastProgressAt;
      if (at - progressAt >= DEMO_ENDURANCE_PROGRESS_TIMEOUT_MS)
        throw new Error('Playback or recovery must keep making progress.');
      previousObservationAt = at;
      previousSignature = signature;
      lastProgressAt = progressAt;
      return { gapMs, sinceProgressMs: at - progressAt };
    },
    finish(at) {
      // A delayed final report write must not silently extend accepted watching.
      return { finalObservationGapMs: observationGap(at) };
    },
  };
}
