# Remaining qualification review — 17 October 2026

This review starts from tooling `44c20f34fa94f2cb33bd210c93503257a2a3c9c0`.
The held remote plans pin package source
`3adcd53792043ef02459e86168c6b33a66d6ef00`, including runtime
`0d9fef1120face4c0f9998ebd24a94e6df0d85c0`, and original main
`b11745223861c3973ad4bf440cc536198b8e0371`. It grants no release or result credit.
The original eight-row prerequisite must complete at this exact package and its
retained failures must be reviewed before any dependent lane is enabled.

The four timing phases contain **48 new observations**: cold Start, warm Start,
Sentry and Long Rail, each with three baseline/candidate pairs in each engine.
All 25 declared timing inputs, 25 sustained inputs, 14 auxiliary inputs and
20 raster inputs match their recorded byte counts and hashes at review time.
Those input checks do not verify the large production archives.

## Preserve separate verdicts

The internal application baseline and independent external baseline are separate
measurements. A stable, prospectively fixed `settled120` external baseline can
qualify the external work/cadence component with its existing numerical gates.
The existing evaluator reports that as `pass-observed-external-window`. Missing
internal pre-play calibration still leaves the combined candidate inconclusive;
missing baseline internal observations remain `partial-baseline-internal-unknown`.
Do not inject the external value into application diagnostics or quality policy.
Retain startup gaps, transition-crossing intervals, all missed-frame bursts and
the individual component verdicts alongside the aggregate verdict.

The original Long Rail recipe has five key actions; Sentry has eleven. The
application observes accepted nonrepeat keydown events, and the latency gate
requires twenty samples. These short recipes therefore cannot independently
close that gate. Repeated runs must not pool their input samples to manufacture
a qualifying per-run count. Their capture/combat work and cadence remain useful
independent observations with the latency limitation stated.

Two prospective supplemental fixtures retain every original public action in
order, the exact mission definition/options, the original 240-second scenario
deadline and all original mechanic requirements. They add a requirement for at
least twenty accepted moving direction changes:

- Long Rail adds twenty-two alternating one-second down/up holds along the
  already claimed strip after the original captures.
- Sentry inserts twenty-two alternating half-second left/right holds on the
  revealed top border after the ninth original key action. Its remaining original
  cut still executes, and its actual shot/projectile requirements remain required.

The files in [the supplemental fixture directory](fixtures/solo-latency-supplement/)
are **not bound to an executable remote lane**. They need a separately retained
native preflight with strict same-engine replay, followed by prospective source,
recipe, settings, calibration and deadline bindings for three pairs per engine.
All numerical gates and the twenty-sample minimum remain unchanged. A model
movement count is not an application-latency sample or browser result.

The nominal model keeps three lives and a running attempt in both missions.
Long Rail retains two captures, maximum trail length 34 and 25 accepted moving
direction changes. Sentry retains two captures, one shot, 91 projectile ticks and
31 accepted moving direction changes. The same requirements pass in all 34
declared fixed-step cases: nominal plus uniform and direction-asymmetric
supplemental hold variations of 1, 2, 3 and 6 ticks. These variations test only the
new steering block; they do not establish browser timing margins for the original
route. A rejected design that completed Sentry's final cut reached victory before
steering and is not used.

## Release order and exact entry points

The workflows currently use pull-request events, not `workflow_dispatch`.
After reviewing exact-source prerequisites and clean owner closure, record the
actual run/artifact/summary hashes in the corresponding release evidence,
set only that stage's positive flags, and remove its declaration job's explicit
`&& false` hold. A reviewed commit and push then triggers the selected workflow.
Do not fabricate a release receipt, automatically continue a phase, or use
metadata-only archive admission.

| Lane      | Stage order and entry point                                                                                                                                         | Scope retained                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timing    | `cold-first30` → `warm-first30` → `sentry` → `long-rail`; `node scripts/solo-remote-sustained.mjs timing-matrix-plan docs/performance/solo-remote-timing-plan.json` | Six independent runner jobs per phase, each containing one serial source pair; fresh Chromium calibration, fixed external B and persistent portrait WebKit. Inspect all raw failures before updating `phase` and `previousPhase`. |
| Sustained | `soak` → `next` → `retry` → `diagnostics` → `long29`; `node scripts/solo-remote-sustained.mjs matrix-plan docs/performance/solo-remote-sustained-plan.json`         | Three observations per engine/source for each lifecycle phase. Diagnostics uses three separate ten-pair experiments per engine. These are not pooled into one experiment.                                                         |
| Auxiliary | `node scripts/solo-remote-auxiliary.mjs matrix-plan docs/performance/solo-remote-auxiliary-plan.json`                                                               | Six jobs, ten arms: speech/music pairs in both engines and candidate main-board recovery in both engines. All are excluded from timing. Demo recovery is a separate unimplemented driver, not covered by the main-board recipe.   |
| Raster    | Held `.github/workflows/solo-remote-raster-temporary.yml`                                                                                                           | Twelve exact primary cases per engine. Conditional localization runs only for its admitted known failure class; no tolerance, extra warmup or retry is added.                                                                     |

Per-job commands remain those in the checked-in workflows: bind the selected
manifest to its engine/repetition, then execute
`scripts/run-solo-remote-correctness.mjs` with the existing bounded owner wrapper.
Every consuming job re-verifies the complete pinned archive, members, source,
workers and CSP before opening a browser. The workflow's source checkout must
match its manifest. Prior macOS observations and earlier packages keep their
original identities and verdicts.

The thirty-minute soak measures repeated capture/result/Retry session time; it
does not claim thirty uninterrupted active minutes or a single dense recording.
The separate twenty-nine-minute recording stays below the recorder's existing
216,000-tick limit. Its same-context reload and exact public replay-byte equality
test saved-state continuity, not OS flush, browser restart, offline durability or
attribution to one particular Pause write. Do not increase the recorder limit or
silently substitute this test for the thirty-minute workload.

Retry's Chromium forced-GC heap/DOM profiling remains excluded from timing. Its
counter plateaus are useful but require owner/trend inspection; they do not prove
native decoder or GPU retention is stable. WebKit's application-owned counters
are still a narrower observation. Native background/foreground, rotation, active
Demo, complete Demo context recovery, earlier unresolved raster behavior and
physical Safari/PWA/Deck conditions remain distinct open gates. The four timing
phases alone also do not cover every representative erosion, jammer, large-profile
or audio workload from the full plan.

## Research refinements

Chrome's performance reference distinguishes main-thread, GPU and frame delivery
work, including partially presented frames. When inexpensive application callbacks
coexist with dropped frames, use a separate excluded renderer/compositor diagnostic
to investigate; do not enlarge B or attribute all delay to JavaScript. The existing
low-overhead observer measures submission, not physical display completion.
[Chrome performance reference](https://developer.chrome.com/docs/devtools/performance/reference).

Playwright documents that visual output depends on browser, OS, settings,
hardware and power conditions. Keep each Linux raster comparison within its new
engine/environment cohort. A Linux non-reproduction does not resolve the earlier
macOS identical-input failure, and historical primitive images are descriptive
comparators rather than a new cross-platform golden. Keep zero pixel tolerance.
[Playwright visual comparisons](https://playwright.dev/docs/test-snapshots).

WebKit's inspector separates overall memory categories from JavaScript allocations
and exposes active canvas dimensions and memory. On the physical iPhone, use these
as a separate diagnostic after the low-overhead run to distinguish image/layer or
canvas growth from a stable JavaScript heap. Inspector attachment itself is not a
timing-pass condition, and unsupported counters remain unavailable.
[WebKit memory debugging](https://webkit.org/blog/6425/memory-debugging-with-web-inspector/),
[WebKit canvas debugging](https://webkit.org/blog/8452/canvas-debugging/).
