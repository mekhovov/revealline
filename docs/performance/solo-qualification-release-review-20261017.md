# Remaining qualification review — 17 October 2026

This review starts from tooling `44c20f34fa94f2cb33bd210c93503257a2a3c9c0`.
The held remote plans pin package source
`3adcd53792043ef02459e86168c6b33a66d6ef00`, including runtime
`0d9fef1120face4c0f9998ebd24a94e6df0d85c0`, and original main
`b11745223861c3973ad4bf440cc536198b8e0371`. It grants no release or result credit.
The original eight-row prerequisite must complete at this exact package and its
retained failures must be reviewed before any dependent lane is enabled. Its
later run `38985941469` passed seven rows and failed the WebKit active worker row;
it still cannot release timing. Independently reviewed, explicitly excluded
diagnostic lanes may investigate without changing that prerequisite verdict.

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
now have an executable **held diagnostic lane**, described below. They still need
retained native preflight results with strict same-engine replay, followed by
prospective source, recipe, settings, calibration and deadline bindings for three
pairs per engine.
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
set only that stage's positive flags, and replace its declaration job's explicit
`&& false` hold with a single reviewed `synchronize` event and exact predecessor
commit condition. A reviewed commit and push then triggers the selected workflow.
Do not fabricate a release receipt, automatically continue a phase, or use
metadata-only archive admission.

| Lane      | Stage order and entry point                                                                                                                                         | Scope retained                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timing    | `cold-first30` → `warm-first30` → `sentry` → `long-rail`; `node scripts/solo-remote-sustained.mjs timing-matrix-plan docs/performance/solo-remote-timing-plan.json` | Six independent runner jobs per phase, each containing one serial source pair; fresh Chromium calibration, fixed external B and persistent portrait WebKit. Inspect all raw failures before updating `phase` and `previousPhase`. |
| Sustained | `soak` → `next` → `retry` → `diagnostics` → `long29`; `node scripts/solo-remote-sustained.mjs matrix-plan docs/performance/solo-remote-sustained-plan.json`         | Three observations per engine/source for each lifecycle phase. Diagnostics uses three separate ten-pair experiments per engine. These are not pooled into one experiment.                                                         |
| Auxiliary | `node scripts/solo-remote-auxiliary.mjs matrix-plan docs/performance/solo-remote-auxiliary-plan.json`                                                               | Six jobs, ten arms: speech/music pairs in both engines and candidate main-board recovery in both engines. All are excluded from timing. Demo recovery has a separate held driver and is not covered by the main-board recipe.     |
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

## Executable supplemental preflight and representative coverage

[The supplemental declaration](solo-remote-supplemental-plan.json),
[`solo-remote-supplemental.mjs`](../../scripts/solo-remote-supplemental.mjs) and
[its held workflow](../../.github/workflows/solo-remote-supplemental-temporary.yml)
add five separately reviewed phases: `latency-long-rail` → `latency-sentry` →
`erosion-first-fracture` → `jammer-neutral` → `jammer-steering`. Each phase has two
engine jobs with one serial baseline/candidate pair, four observations. The first
release is Long Rail only. The declaration is held, all release proof flags remain
false, and **no native execution is claimed**. Twenty possible diagnostic
observations across the five phases do not replace the original 48 timing rows.

After reviewing the worker diagnostic and prior owner closure, the reviewer sets
the three independent diagnostic proof flags, records actual run/artifact/summary
hashes, changes status to `reviewed-diagnostic-only`, and selects the single event
edge in the workflow. `firstEightAllCorrectnessPassed` must remain false and
`performanceQualification` must remain `excluded`; the adapter rejects promotion.
Each later phase requires review of the preceding phase and a fresh event edge.
All frozen tool references must match the actual tooling revision at release;
the original review-time reference counts above are historical, not permission to
use stale hashes after shared-runner changes.

The concrete entry points are:

```sh
node scripts/solo-remote-supplemental.mjs matrix-plan docs/performance/solo-remote-supplemental-plan.json
node scripts/solo-remote-supplemental.mjs bind-plan docs/performance/solo-remote-supplemental-plan.json "$RUNNER_TEMP/solo-supplemental-job.json" chromium
node scripts/run-solo-remote-correctness.mjs "$RUNNER_TEMP/solo-supplemental-job.json" "$OUTPUT"
```

The workflow supplies the exact source checkouts, Node/Playwright versions,
isolated output directory, owned process supervisor and environment. It downloads
and verifies both original pinned production archives, preserving normal baseline
reuse rather than rebuilding it. Scenario bounds stay 240 seconds, command bounds
480 seconds. Setup retains its 40-minute bound; the helper/outer/step bounds remain
75/77/78 minutes with a separate job allowance for setup and evidence upload.
Per-row evidence is bounded at 32 MiB and each job at 256 MiB. No new retries,
automatic Resume, profiler, screenshot, audio-identity instrumentation or runtime
calibration injection is added. CPU1 is explicitly uncalibrated diagnostic scope.

The adapter preserves all original raw numerical verdicts, including failures and
inconclusive measurements. Native correctness requires exact recipe/source,
browser/version, declared viewport/DPR, all public actions, full same-engine
replay/mechanic verification and clean browser/process closure. A numeric gate
failure alone may accompany successful recipe admission; it remains a numeric
failure in the report and never a performance pass. Invalid/missing report evidence
fails admission. For the three steering recipes, the candidate also needs at least
twenty actual exported application keyboard-to-submitted-render samples. Missing
baseline diagnostics remain unobserved and excluded. The Sentry samples span the
mixed scenario; they do not claim twenty inputs during projectile activity.

[The representative fixtures](fixtures/solo-representative/) add the missing
earned-erosion and jammer cases. First Fracture retains the original public
preparation/capture/wait/export recipe and exact compiled mission. Five model hold
durations of 168–216 ticks all keep three lives, a running attempt, a real capture
and subsequent erosion. The preserved Signal07 neutral control uses the exact
normalized shipped mission. Its separate steering version replaces only the
thirty-second wait with thirty alternating one-second border holds. At all five
114–126-tick hold lengths, the model preserves three lives, 29 moving direction
changes and more than 1,000 jammer-active ticks. Exact replay and required mechanic
checks pass. These are model checks, not browser evidence; the import uses greybox
art and does not qualify original artwork. Erosion's one-key route and the neutral
jammer intentionally cannot qualify input latency.

The local verification receipt is
`.cache/solo-followup/representative-native-preflight-20261017-01/receipt.json`.
The focused suite passed 75 tests with three Linux-only ownership checks skipped
on this macOS host. Scoped lint, formatting and diff checks are retained separately.
The remote workflow reruns its owner tests on Linux before browser admission.

The remaining large-profile case already has a supported deterministic builder:
`node scripts/prepare-solo-qualification.mjs <new-owned-preparation-directory>`
emits `large-profile.qualification.json` and `large-profile.library.json`. Its
public import/reload/steering route uses 480 campaigns, 3,840 gallery entries and
960 scores within the existing 4 MiB supported budget (2,056,905 logical bytes in
the retained preparation). Regenerate in a fresh owned directory, freeze output
hashes and builder identity, then declare a separate reviewed preflight; do not
silently append it to the first supplemental phase. This exercises metadata/save
pressure, not artwork or recorded-media storage pressure.

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
