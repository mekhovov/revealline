# Offline discovery trace analysis

`scripts/analyze-discovery-trace.mjs` reads an existing Chrome JSON trace. It does
not connect to a browser, change a player profile, or qualify a release. Keep the
original trace and normal-UI/artifact receipts beside the resulting report.

```sh
node scripts/analyze-discovery-trace.mjs \
  --trace /absolute/first-win.json \
  --options /absolute/trace-options.json \
  --out /absolute/new-analysis.json
```

All three paths must differ. The output must not already exist. The hard limits
are 128 MiB of trace JSON, one million events, 200,000 CPU nodes and one million
CPU samples. Options are limited to 64 KiB. `limits.maxBytes` and
`limits.maxEvents` may lower the hard ceilings.

Example options (replace the example identities with exact admitted values):

```json
{
  "sourceBinding": {
    "sourceRevision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "distributionSha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "editionId": "fpv-learning"
  },
  "window": {
    "start": "discovery-first-win:start",
    "end": "discovery-first-win:end"
  },
  "checkpointMarkers": ["discovery-first-win:visible"]
}
```

The selected thread must be named `CrRendererMain`. If the trace contains more
than one, pass `renderer: {"pid": 123, "tid": 456}`. The analyzer will not guess
which tab was measured. Named marks must appear exactly once on that thread in
`blink.user_timing`. Missing, duplicated or reversed boundaries reject the
analysis. Without a window the report explicitly covers the complete observed
renderer-task range; this does not imply a first-win measurement.

For a closed-viewer cycle trace, supply the explicit ordered list
`closedCycleMarkers` from `discovery-cycle:closed:0` through
`discovery-cycle:closed:20`. A preceding `UpdateCounters` sample must be within
`counterMaxAgeMs` (default 1000; maximum 10000) of every mark. Missing individual
counter fields remain unavailable. Categories must include
`disabled-by-default-devtools.timeline` and `blink.user_timing`; CPU profiles
are optional for this resource observation. Marks are caller-declared
checkpoints, not proof that the corresponding UI action occurred.

The report retains all selected `RunTask` events longer than 50 ms, including
ones without reward evidence. Exact registered reward-module callbacks and CPU
ancestor stacks identify tasks containing reward work. `rewardPaths` can supply
up to 16 exact `game/...mjs` or `game/...js` paths for a future implementation.
CPU locations use `line1`; timeline callback locations preserve the trace's
`reportedLineNumber`. URLs are reduced to game-module paths; query strings and
origins are omitted. Top sampled stacks are capped at eight per task, with the
total distinct-stack count retained.

Signed CPU deltas are accumulated unchanged, and each reconstructed sample is
located independently. This preserves occasional out-of-order samples, as in
[Chrome's CPU profile model](https://chromium.googlesource.com/devtools/devtools-frontend/+/9a696c4e723caa3c7e1f78886da353f1f06a79b0/front_end/core/sdk/CPUProfileDataModel.ts).
Negative delta counts are reported; samples before profile start are rejected.

Task duration is inclusive elapsed main-thread time, not exclusive reward cost.
Sampling can miss work. Profiler-startup-containing tasks are reported
separately even if they fall outside the selected window; mixed application work
inside them is not silently assigned to instrumentation or erased. A task
partially overlapping a window retains its full duration and is flagged.
The observation headline includes every long task with reward evidence, including
mixed profiler-startup tasks. The separate startup-excluded count is a diagnostic
subset and cannot produce a negative headline for an observed mixed long task.

`UpdateCounters` records renderer-wide documents, nodes, listeners and JavaScript
heap. Trends do **not** establish retaining paths, forced-GC stability,
detached-node ownership or native media decoder release. No finding from this
helper closes those gates. Source identity is caller supplied: only the trace
bytes receive a hash from the analyzer. Successful parsing always produces
`qualified: false`.

Run the focused synthetic parser tests with:

```sh
node --test scripts/test-analyze-discovery-trace.mjs
```
