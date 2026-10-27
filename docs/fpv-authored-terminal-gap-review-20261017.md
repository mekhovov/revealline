# Authored Urban terminal-gap review — 17 October 2026

The existing 9207 failure needs a native trace of the interval between measured
frame callbacks. It does not justify changing flight physics, snapshot contracts,
renderer behavior, or the 250 ms acceptance limit.

This is a read-only analysis of the preserved failed report, not a new browser
run. The public input is
[`fpv-authored-urban-preparation-observer-invalid-20261015.json`](https://github.com/mekhovov/revealline/blob/3e744a5ef7bede48eafcb79a8377bb46fb37d76f/docs/fpv-authored-urban-preparation-observer-invalid-20261015.json):
230,908 bytes, SHA-256
`4461a69aebb553a52387ad3f75943f3b4cc143681e0b736a03f79292568d94b7`.
The original remains invalid after 176.3321 actual seconds / 8,790 ticks.
The [derived receipt](fpv-authored-terminal-gap-review-20261017.json) records the
input identity, exact arithmetic and observation limits.

## What the retained measurements show

| Boundary | Elapsed time from start |
| --- | ---: |
| Frame 18,680 begin mark | 175,815.100 ms |
| Frame 18,680 complete synchronous wall span | 1.200 ms |
| Frame 18,680 end mark | 175,816.300 ms |
| Frame 18,681 begin mark | 176,332.000 ms |
| Time between the preceding end mark and next begin mark | 515.700 ms |
| Whole begin-to-begin interval | 516.900 ms |

These values come from `attributionDiagnostics.lastSpans` IDs 101444 and 101448.
The final lifecycle interval independently records the same 516.900 ms interval.
This is agreement within one report, not an independent repeat experiment.

The 515.700 ms interval lies after the preceding **measured end mark**. It includes
any unmarked callback epilogue and task, microtask, rendering or scheduling time
before the next mark. It is not an exact browser callback-return measurement,
exclusive CPU accounting, or evidence for a particular cause.

No retained long-task entry, long-animation-frame entry, or preparation wrapper
interval overlaps this boundary. The newest retained LoAF ends at 171,554.500 ms;
35 earlier LoAF entries were overwritten. Both recorded preparation wrappers had
settled by 93,367.100 ms. Read failures and malformed attribution entries are zero.
The terminal frame-callback span is incomplete because finalization stops the
observer before that frame's `finally` closes its mark. Its null duration remains
unknown, never zero.

Observer shutdown drains only records already queued. Therefore **no retained
covering entry does not prove that no long task, GC, render work or scheduling
interruption occurred**. The report contains no sampled descendant stack or GC
trace. Earlier 9175 physics/draw maxima belong to a different failed run and must
not be substituted as the explanation for this interval.

## Next bounded diagnostic

Run this only after stable storage headroom and a permitted visible native
performance-recording surface are available. The current low-space environment
is not ready for another renderer or trace.

1. Freeze the exact production closure, authoring files and Urban package. Record
   browser version, quality, route, camera, viewport/DPR and observation policy.
   The failed reference used balanced quality, chase camera, self-level mode,
   strict focus, and a 1280 × 720 viewport with DPR 2. A changed browser or layout
   is a separate experiment, not a reproduction claim.
2. Set the profiler UI and viewport **before** starting. Keep one renderer and
   the existing focus/visibility rules. If opening a profiler steals focus or
   changes the viewport during timing, preserve the invalidation; do not bypass
   the rule. If the surface is unavailable or refused, record that limitation
   and obtain an authorized user-provided native trace; do not use hidden access.
3. Capture one bounded run of the existing five-minute review with JavaScript
   sampling and the native Main track. Keep available GC, rendering and frame
   events. Do not force GC, throttle the CPU/network, enable screenshots or
   allocation instrumentation, access player storage, or run a second renderer.
   Trace acquisition has overhead and is a diagnostic experiment, not an
   uninstrumented performance result.
4. Save the complete failed or completed report and original native trace. Record
   exact time alignment and capture settings. Inspect the 250 ms failure boundary
   for a sampled descendant, GC event, other task or rendering interval. If the
   trace lacks an explanation, leave it unexplained; an idle-looking region is
   not a proven OS scheduler or driver cause.
5. Only select a source optimization after an observed expensive operation is
   identified. Compare the same workload with and without the change, then run a
   fresh unprofiled two-hour authored qualification with all existing gates.
   Five-minute observations, accelerated runs, imported history and summed
   segments never replace uninterrupted elapsed endurance.

Chrome's [LoAF guidance](https://developer.chrome.com/docs/web-platform/long-animation-frames)
limits script attribution to supported same-origin main-thread entry points;
those locations need not identify the expensive descendant. Its
[Performance reference](https://developer.chrome.com/docs/devtools/performance/reference)
describes native JavaScript samples and trace capture. The
[memory troubleshooting guide](https://developer.chrome.com/docs/devtools/memory-problems)
explains how recorded GC events can support a memory diagnosis. These capabilities
guide the next capture; none is evidence that GC caused this failure.

## Status

No runtime change is proposed. No renderer, trace or elapsed segment was started
for this review. All original failures, resource budgets and the 250 ms limit are
unchanged. The two-hour pass, device FPS, physical-device acceptance and causal
performance diagnosis remain open.
