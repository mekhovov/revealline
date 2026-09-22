# CI throughput preparation — isolated, not activated

Base: `01b189f6427601a15cbb3eb1563b5f82eabbafa3` (merged Release A).
User authorized faster continuous delivery on 2026-09-22, preserving the guarded
release contract. Playlist remains sole publisher. A public acceptance is first;
CI-only235 then precedes B retarget/full CI under the publisher's latest explicit
handoff. This experimental work does not alter either release.

## Observed bottleneck

Candidate source run35753052831 passed all11,788 tests. Its four test steps took
3,994 / 4,634 / 1,679 / 3,236 seconds. The current runner distributes sorted paths
round-robin, not by cost. The audit records901 source test files and retained
log identities. Existing TAP case durations are not file process wall times;
summing them would produce false scheduling measurements. The audit explicitly
leaves per-file durations unknown. No production speedup is claimed.

## First bounded change

`scripts/run-test-shard.mjs` gains an **opt-in** `--timings FILE` argument. With
no argument, its existing round-robin selection and child Node invocation remain
unchanged. The timing manifest is scheduling data, not a test inventory, a cache
of passing verdicts, or authority to skip a test.

```json
{
  "schemaVersion": 1,
  "sourceRevision": "0123456789012345678901234567890123456789",
  "nodeVersion": "20.19.5",
  "durationsMs": { "scripts/test-example.mjs": 100 }
}
```

The example is synthetic, not a real measured profile. A usable profile needs
separate authenticated complete-file measurements and reviewed provenance. The
identity fields document measurement origin; they do not qualify another source.

The planner discovers the selected source's tests normally, assigns longest
measured work first to the lightest bin with deterministic ties, includes new
files with a median observed cost, and ignores removed files only in timing data.
Every discovered file must be assigned exactly once. Invalid/empty/unrelated
profiles fail before test execution. No source files, simulation, test assertions,
Node isolation settings, source identity checks or publisher workflow are changed.

Seven complete runner tests cover the unchanged default, source-root separation,
execution/failure propagation, new/deleted files, deterministic exact-once
partitioning, invalid inputs and a synthetic imbalance. Synthetic400→103 cost
reduction proves an algorithm property, **not** observed hosted performance.

## Activation gates — all still required

1. Independent review and pinned Node20/22 runner tests; malformed data and
   omission/duplication mutations must fail.
2. Obtain trustworthy per-file measurements. If Node20 reporter events do not
   expose file-container wall time, record that limitation and design an
   explicitly reviewed measurement job; do not invent a production profile.
3. Compare the current and proposed shard inventories against the same complete
   Git tree, proving identical coverage. Do not use this sparse worktree's small
   discovered subset as a full-source inventory.
4. Benchmark on matched hosted runner/source/runtime inputs. Record wall time,
   queue time, failures, CPU/memory and per-shard balance; no test skipping or
   assertion weakening. Keep all four required source gates.
5. After publisher scheduling and current-main integration, submit/review the
   workflow activation separately with the exact profile/runner bindings.
   Qualification's actual-merge tests remain mandatory.

## Parallel queue and handoffs

- A: finish canonical qualification35762623319, automatic freeze, independent
  artifact inspection, immutable assets, reviewed selector, Pages and complete
  public byte/browser/prepared-offline acceptance. Never restart an unchanged
  qualifying head merely to apply CI optimization.
- B: finish owner-scoped native/integration work, then reconcile accepted A,
  allocate its version, full exact-head CI and the same release contract.
- Infrastructure235: independent read-only review found no conflict or source
  defect against01b189f, but old hosted evidence is not current-main evidence.
  Publisher explicitly schedules235 after A acceptance/final selector merge and
  before B retarget/version/full CI. Until that selector merges, do not update235
  or trigger new hosted checks. Owner then integrates authoritative post-A main
  once and obtains fresh exact-head gates/controller preview before reviewed
  merge; verify no selector/release change. PR cancellation never applies to
  active publication. Balanced-runner work remains local pending separate review.
- Further drafts: retain recorded dependency/supersession order and owner handoff;
  merge only complete safe units. Close absorbed work only with actual released
  successor proof. Audit/study/tool work is not gameplay approval.

The existing coordinator heartbeat was shortened to five-minute lightweight
checks, quiet for unchanged state. Successful stage events should eventually
wake a deduplicated coordinator directly, but do not auto-authorize uploads or
selector merges. GitHub's default concurrency queue is not a durable FIFO;
sole-publisher source/version/run/artifact identity checks remain necessary.

## Local verification caveats

Pinned Node20.19.5 runner tests pass7/7. Pinned ESLint10.10.0 and Prettier3.6.2
pass after invoking their installed CLI files directly. Initial `npx` invocations
were refused by the local mise shim; they did not establish lint/format success.
The corrected direct invocations and tests succeeded. This is not full repository
CI, hosted timing improvement, runtime release or public acceptance.

Initial reporter-only checks passed9/9 on Node20.19.5, but the coordinator's
combined dual-runtime run reproduced four reporter integration failures on
Node22.22.2 (12/16 combined passed; the seven scheduler tests still passed).
Those failures are retained as compatibility evidence, not counted as successful
qualification. The Node22 file-container name is cwd-relative whereas Node20
uses an absolute name; the absolute file identity remains available in both.
The correction must normalize only that name against captured runner cwd while
retaining exact file/stage/inventory checks. Require fresh complete dual-runtime
tests and independent review before any activation.

Correction completed: the standalone reporter now handles Node20 absolute and
Node22 cwd-relative container names without changing the required absolute-file
identity. Coordinator combined verification passes17/17 on both Node20.19.5 and
Node22.22.2, with zero failures/skips/cancellations; pinned lint/format and
whitespace checks pass. Independent exact-file reviews separately repeat7/7
scheduler and10/10 reporter checks on both runtimes. `runner-review.json` and
`reporter-review.json` retain findings, corrections, exact file hashes and limits.

Reporter usage is opt-in and standalone, alongside normal TAP. Supply explicit
`REVEALLINE_TIMING_SOURCE_REVISION`, `REVEALLINE_TIMING_SELECTED_FILES` (JSON
array of the exact selected relative paths), and `REVEALLINE_TIMING_ROOT`.
Use `--test-reporter=tap --test-reporter-destination=stdout` together with
`--test-reporter=./scripts/file-timing-reporter.mjs` and a separate JSONL
destination. Missing/extra/duplicate/failed/skipped measurements invalidate its
final usable summary. Preserve Node concurrency and invocation context.

The reporter has **not** been connected to any production workflow and its raw
JSONL is **not** a weights manifest. A converter and hosted comparative pilot
still need reviewed exact-run/source/inventory/tool bindings before enabling
timed scheduling. Local tests establish safety properties, not a hosted speedup.
