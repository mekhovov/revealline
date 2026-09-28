# Actor batch 4 — Scout contrast and measured playable comparison

Implementation checkpoint following `71e4d55c0d6c208d15bdeb3b1f71e69a5b9eff93`,
inside draft [PR761](https://github.com/mekhovov/revealline/pull/761). This is local
source evidence, not production admission or public-release acceptance.

## Implemented

- Two native **reference-v4 Scout** contrast PNGs, produced from code on 32/64px
  grids. Only central battery RGB clusters change from v3. Exact silhouette,
  alpha, camera, arms, motors, pivot, rotor anchors/radii/direction/phase survive.
  No propellers are baked into the body and no white corner markers are added.
- Explicit approved/v3/v4 choices in the real three-mission benchmark. Fixed
  cohort paths, slot sets, source hashes, PNG hashes/lengths/dimensions and exact
  retained geometry are validated. Failed/cancelled/stale preparation retains
  the previous run and accepted comparison. No production registration/pin is
  created; all non-Scout slots delegate to the approved lease.
- Optional local measurement using the existing RAF and actual painter calls.
  The last 120 active frame intervals and synchronous draw durations report
  nearest-rank p50/p95/worst plus sample/gap/rejection counts. Slow valid frames
  remain; loading, pause, background and ready-cue segments are excluded.
  Appearance/effect/view/size/run changes reset the window. No telemetry is sent
  or stored by the app and no extra animation loop is created.
- Optional build entries for the manifest and two PNGs: **12,498 bytes**, of
  which **838 bytes** are PNG data. The four fingerprinted source modules are
  included by existing source collection. None of the new candidate files enter
  Solo, Versus or Team core closure. The decoded candidate-only RGBA lower bound
  is **20,480 bytes**, even when one size is forced because both images are owned.

## Checks and corrections

The final expanded cohort passes **129/129**, zero skipped/cancelled, in
[focused.tap](focused.tap). Command:

```sh
node --test game/test/feedback-comparison.test.mjs \
  game/test/renderer-readability.test.mjs game/test/presentation-renderer.test.mjs \
  game/test/playable-benchmark.test.mjs game/test/playable-benchmark-focus-host.test.mjs \
  game/test/playable-benchmark-performance.test.mjs \
  game/test/rotor-body-contrast-candidate.test.mjs \
  game/test/rotor-body-detail-candidate.test.mjs \
  game/test/rotor-proportion-candidate.test.mjs game/test/rotor-presentation.test.mjs
```

Independent review exercised 28 overlapping loader/production checks, including
source collection/core classification and exact reproduction. Do not add this
count to 129 as unique coverage. The benchmark suite also models 56 renderer
combinations; these are not 56 browser/device runs.

Review found a real measurement defect: controller Pause or disconnect during
input polling could be counted as an active frame. The host now checks timing
segment ownership after polling. Its regression invokes the actual Pause
handler, checks no extra simulation advances, and retains the terminal gameplay
frame. A new Retry test initially used a synthetic click without a deliberate
pointer gesture; the fixture now supplies pointer-down/up/click. The runtime
Retry release guard was preserved.

Repository lint, formatting, native formatting, content/localization/presentation
validation and Motion Lab syntax are recorded in [source.log](source.log) and
[format.log](format.log). New producer reproduction and authoring scoped lint /
formatting are in [scoped.log](scoped.log). Documentation formatting and diff checks
are separate. The full suite remains waived by the committed policy. No new full
build or published distribution is claimed here; integrated build/production /
provenance/public checks remain mandatory for publisher admission.

## Browser evidence

Actual Codex in-app browser interaction against the local source server:

- First Return completed with v4-detailed at **tick 414 / 3.45 s**, 34.3% of a 30%
  target, three lives, 8,160 points. See [win](v4-first-return-win.png) and
  [measurements](first-return-v4-measurement.json).
- The single run recorded 411 active samples; the final 120 had frame interval
  p50 **8.30 ms**, p95 **8.80 ms**, worst **9.30 ms**. Reference draw p95 was
  **0.50 ms**, comparison draw p95 **0.40 ms**. These are local observations,
  not a cross-device improvement claim, a matched whole-game baseline, GPU time,
  end-to-end latency, or standalone game FPS. Both painters run even if hidden.
- V3/v4 exchanged at the same paused tick 5 on A Return in Reserve, retaining the
  real board and other actors. Compare [v3](v3-same-paused-tick.png) and
  [v4](v4-same-paused-tick.png). Switching appearance reset the measurements.
- Reduced effects changed only the comparison. Deliberate Retry showed tick 0
  during the 600ms ready cue and retained v4-detailed/reduced effects in the new
  attempt. See [retained state](retry-retained-v4.json).
- CSS viewports: 1280×800, 390×844 and 844×390, default zoom. No horizontal
  overflow. Single-view mode fits the complete board and 48px steering controls:
  [portrait](primary-portrait-390x844.png),
  [landscape](primary-landscape-844x390.png). The explicitly expanded two-view
  authoring comparison requires scrolling on small viewports; do not claim both
  boards and controls fit simultaneously there.
- Opt-in measurement stayed zero while paused and reset on responsive size and
  appearance changes. Pause excludes interrupted segments. Native controller,
  actual physical touch, 200% zoom and whole-product menu checks were not repeated
  in this bounded batch.

## Visual finding and remaining acceptance

The amber face is brighter, but the slim central body still has weaker prominence
than the approved reference at small full-board sizes. **Do not promote v4 as
production-ready artwork.** Continue actual-size silhouette/contrast refinement,
then review the body and larger propellers together across headings, backgrounds,
edges and Team states. Native-grid correctness and a luminance increase cannot
substitute for that review.

The inherited Team production-review guard remains **one pass / one failure**
until explicit adoption of reviewed successor recipes/fingerprints. Preserve
historical production metadata. This batch does not rewrite that gate. Main's
newer `themeFamily` event-feedback routing must survive future reconciliation.
C0 full performance/memory/download qualification, human pilot, listening/haptics,
physical hardware, whole-content/offline checks and public play remain open.
