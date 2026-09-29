# Faster delivery without weakening release evidence

Status: local proposal and tooling only. No workflow activation, hosted speedup,
runtime release or permission change is claimed.

## Measured v0.83.0 bottleneck

| Stage                                 | Actual run  | Observed elapsed |
| ------------------------------------- | ----------- | ---------------- |
| Exact PR CI                           | 35753052831 | 84m08s           |
| Actual-merge qualification and freeze | 35762623319 | 87m40s           |
| Hosted frozen inspection              | 35772379842 | about 4m07s      |

The four PR test steps took 3994, 4634, 1679 and 3236 seconds. The four
merged-source steps took 3962, 4663, 2142 and 3268 seconds. Thus test execution,
particularly shard 2, dominates both independent qualification families. Equal
file counts are not equal durations. The freeze job took 328 seconds, including
262 seconds to build/freeze and 22 seconds to retain the artifact. The release
is not waiting on an 80-minute Pages upload.

These facts come from retained raw run/jobs API originals in the isolated
reconciliation worktree's `.cache/v0830-assembly-r1`, not inferred case-duration
sums. Node test concurrency makes such sums unsuitable as elapsed-file evidence.

## Ordered improvement

1. Finish A's public acceptance and final selector merge first. Integrate #235
   with that authoritative main, run its applicable controller/preview checks,
   and merge it before B's retarget/version/full qualification. Superseded PR
   checks may be cancelled; release/upload/deployment jobs may not. GitHub's
   pending-slot replacement is not a durable queue: deduplicate dispatches.
2. Collect genuine Node file-container duration telemetry alongside normal TAP
   in an explicitly approved profiling pilot, keeping round-robin inventory,
   concurrency and test exit status unchanged. Telemetry upload failure can be
   advisory; a failed test invocation cannot be masked by `continue-on-error`.
3. Convert all four complete, successful, exact-source streams into one bounded
   deterministic timing profile. Bind raw hashes, source/tree, run/attempt,
   actual job IDs, runtime/runner context and before/after source receipts.
   Reject missing, extra, failed, skipped, cancelled or truncated evidence.
   An operator receipt is evidence to inspect, not cryptographic authentication.
4. Compare default and weighted partitions against the independently discovered
   complete source inventory. Every current test must appear exactly once;
   unknown/new files receive a scheduling fallback, not omission. Removed
   profile entries never execute absent files. Passing verdicts are never reused.
5. Run at least two matched baseline/weighted hosted pairs with the same source,
   runtime, runner class, concurrency and tools. Predeclare an acceptance target
   of at least 15% lower median longest-shard wall time with no lost tests or
   increased failure rate; also report total runner seconds, setup/queue times
   and memory. Two pairs are preliminary, not a statistical stability claim.
6. Independently review actual results and activate through a separate PR only
   after publisher clearance. Pin the approved profile digest and provenance
   explicitly. The scheduler checks profile syntax, not GitHub authenticity or
   equality with the currently tested source. Preserve all four required checks,
   the merged-source qualification, immutable freeze, separate selector review,
   complete public byte checks and affected prepared-offline/browser journeys.

## Reduce coordination time in parallel

- Reserve one publisher and one immutable binding per release stage. Named
  handoffs may delegate preparation, but never create competing upload writers.
- Collect each terminal run's raw metadata/logs once, publish its local receipt
  path and hashes to reviewers, and share those originals. Reviewers can reparse
  independently without downloading identical evidence again.
- Assemble parameter-bound evidence while hosted gates run; do not fabricate
  terminal results, use predecessor-head evidence or dispatch duplicate runs.
- Keep the existing five-minute heartbeat lightweight and quiet when unchanged.
  Owner completion handoffs can advance the next stage immediately rather than
  waiting for the next timer. A timer is recovery, not release approval.
- Prepare selector changes and browser scripts in parallel, but only bind them
  to actual published IDs/hashes after release reconciliation. Keep historical
  releases and routes intact; do not merge incomplete stacked checkpoints.

## Archive size is a later design problem

The exact merged source contains 1,584,910,145 tracked bytes. Read-only Git
metadata attributes approximately 502 MB to authoring/library, 361 MB to
publishing/pages-controller, 274 MB to game/content-design, and 233 MB to
docs/verification. Current source archives must still contain every required
original. No historical file, ref or release may be deleted to shorten A.
Any future evidence-storage redesign needs a separate provenance-preserving
proposal and compatibility review; it must not silently omit source bytes from
the existing archive contract.
