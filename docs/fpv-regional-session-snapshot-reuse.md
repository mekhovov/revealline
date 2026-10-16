# Reuse the accepted regional step snapshot

The production regional session previously requested four runtime snapshots per step: one to remember the tick, the snapshot returned by the runtime step, another to inspect its accepted tick, and another for presentation. Each runtime snapshot copies the body and verified terrain/scenery provenance. The session now reuses the step's already-independent returned snapshot for the accepted-tick check and presentation, removing two redundant copies per call.

The first tick observation remains unchanged. Accepted input is still recorded only when the runtime advances its tick. Public snapshot calls still request fresh independent runtime state; no mutable cached snapshot is exposed. Physics, source ownership, collision, streaming, arming, identity and proof behavior are unchanged. No module or package budget is added.

## Verification

The functional verifier uses actual Urban mixed-r2 assets and compares the preserved pre-change session module against the new one using the same production runtime. Across Acro and Self-level, all 1,212 state comparisons match, including paused input and preparation cancellation/recovery. Mutating a returned snapshot or step result does not affect owner state; later steps do not alter retained earlier snapshots. Both sessions dispose their scene roots. The existing production-host verifier also passes both modes, real source outage/retry, cancellation, invalid starts and authored starting points.

Run `node authoring/fpv-worlds/regions/verify-session-snapshot-reuse.mjs <preserved-baseline-module> [urban-mixed-r2-directory]`. The baseline was preserved from commit `2bfe33aaa4a63402ce78f24a78fa317ab8ed909e`, with its relative imports resolved to the same unchanged runtime dependencies. Exact module identities and observations are in [the measurement receipt](fpv-regional-session-snapshot-reuse.json).

Five alternating runs per implementation used 200 warm-up ticks followed by 2,000 accepted grounded low-throttle ticks, excluding preparation. Node v20.19.5 median elapsed CPU workload time was 923.36 ms before and 573.02 ms afterward, about 38% lower in this bounded workload. All 20,000 measured ticks were accepted. This is neither a browser/device FPS measurement nor a GPU, long-session or whole-game performance claim. Timings are observations, not a test threshold.
