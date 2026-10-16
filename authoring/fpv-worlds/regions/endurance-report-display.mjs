/** Bounded authoring-only live display; retained raw evidence is owned by the runner. */
export function createEnduranceReportDisplay({ write, now = () => performance.now() }) {
  const timing = { count: 0, totalMs: 0, maxMs: 0 };
  return Object.freeze({
    live(facts) {
      const started = now();
      try {
        // Whitelist scalar facts: never traverse retained raw samples, lifecycle rings or history.
        write(
          JSON.stringify(
            {
              phase: 'running — provisional, not an accepted report',
              elapsedSeconds: Number((facts.elapsedMs / 1000).toFixed(1)),
              targetSeconds: facts.targetMs / 1000,
              ticks: facts.ticks,
              frames: facts.frames,
              cellCrossings: facts.cellCrossings,
              recentres: facts.recentres,
              routeProgress: facts.routeProgress,
              observationPolicy: facts.observationPolicy,
              maximumFrameIntervalMs: facts.maximumFrameIntervalMs,
              rawEvidence:
                'All existing samples remain retained. Export for a provisional full report, or finish for the full final report.',
            },
            null,
            2,
          ),
        );
      } finally {
        const elapsed = Math.max(0, now() - started);
        timing.count++;
        timing.totalMs += elapsed;
        timing.maxMs = Math.max(timing.maxMs, elapsed);
      }
    },
    snapshot: () => ({
      count: timing.count,
      meanMs: timing.count ? timing.totalMs / timing.count : null,
      maxMs: timing.maxMs,
    }),
  });
}
