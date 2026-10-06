# Graphical FPV flight guidance

Status: 5 October 2026. H1 and H2 are implemented. At frozen source `614adef75a6e1cc28ea1d04acf26fa69b507c551`, H3 functional checks, all three reproducible package admissions, full validation and bounded browser/offline review passed. The 53 existing package/offline cases remain **not run at this source head** because the disk preflight failed. Published as [PR #1110](https://github.com/mekhovov/revealline/pull/1110), the third member of native stack #1106. Protected parent publication, exact-head CI/reviews and public deployment remain pending. No public live availability is claimed.

## Problem and resulting experience

The expanded lesson coach placed several large numeric requirements over the FPV view. A player could remain in the highlighted volume without knowing that tilt, centred rotation sticks or landing quality was still preventing progress. The old layout also mixed current measurements, required conditions and earned progress.

The shared HUD now presents one correction at a time, a compact graphical target band, and a separate ring for progress actually earned by the runtime. Players can keep looking at the world. **Explain** pauses the flight and opens the complete requirements separately; closing it does not resume or arm. The existing preparation lesson and control lab remain available.

## H1 — Shared graphical HUD and honest feedback: implemented

- Academy and World Studio use the same observer-only HUD component. Guided is the default; Minimal and Detailed, larger text and higher contrast are persistent shared preferences.
- Guided feedback uses a target band and moving marker. The band uses authored thresholds, not an adaptive scale that could suggest improvement merely because the scale changed. Exact numbers remain available in Detailed and the paused explanation.
- Prerequisite indicators distinguish met, unmet and unmeasured conditions. A full progress ring alone does not claim objective completion. The runtime remains the only authority for completion.
- “Acro: the tilt stays” first asks for the required tilt, then asks the player to centre the rotation sticks while retaining the same tilt gauge. Height, position, speed and heading still apply.
- Landing distinguishes approach, a sufficiently gentle touchdown and throttle down. Zero velocity after an impact cannot make a hard landing appear acceptable.
- Gates distinguish aligning with the opening from crossing it in the correct direction. Advanced rotations and paths use accepted runtime checkpoints, while tracking uses its actual hold and subject-travel state. Hunt counts caught IDs; Combat counts defeated actors.
- Compact health information remains available where relevant. Live guidance no longer needs the large numeric coach, old telemetry panel or duplicate scene heading.
- The host clears input and freezes the radio when Explain opens. Deliberate rearming remains required after closing it. The component never sends a flight command.

### Public presentation interface

`flightGoalFeedback({ course, mode, state, legacyFacts, legacy, locale, freeFlight })` is exported from `optional-practice/civilian-fpv/sim-presentation.mjs`. It returns:

```js
{
  id, phase, action, label,
  gauge: { kind, value, min, max, valid, met, oneSided, detail },
  checks: [{ id, label, met, valid }],
  earned: { kind, value, total, complete },
  detail, interaction, worldTargetId
}
```

Gauge ranges are typed numbers in player units: metres, metres per second, degrees, seconds, percentages or counts. `valid: false` means unmeasured; it never becomes a passed check. `oneSided` is `min`, `max` or `null`. Correction gauges and earned credit are separate; no average of unrelated conditions is treated as lesson progress.

`mountFlightHud(...)` consumes that feedback, host-owned lifecycle and optional telemetry. Its host callbacks open paused explanations and the existing lesson guide. It also receives projected world cues and aim position. It owns presentation preferences and DOM cleanup, not physics, recording, rewards or input ownership.

Legacy Academy adds `flight.objectiveFeedback()`. These copied facts record the exact last consumed criterion, including pre-collision speed and saved landing impact. They remain outside the simulation snapshot and identity. The adapter requires a matching tick and objective index. Replay uses the replay flight's own facts; a missing or stale fact is not substituted with a reassuring estimate.

## H2 — World guidance and host integration: implemented

- A visible target receives a small bracket; offscreen, behind-camera or occluded targets receive direction-only guidance. Occlusion must not produce a misleading marker suggesting that an obstacle can be flown through.
- Height-only corrections point up or down. A direction to the drone's own position is suppressed once it is inside a hold volume; the remaining condition gauges explain what is still needed.
- Landing cues locate the intended support surface. A wrong-side gate approach points back to the entry side before asking the player to cross.
- Moving-target cues identify the current interaction: touch, fire, follow or observe. These are presentation distinctions; this increment does not change contact or combat rules.
- Ray queries are bounded and exclude sprites as walls. Support-point caches reset with a new course. Projection remains separate from the geometric queries that determine gameplay visibility.
- The active flight shell keeps the pause action accessible while reducing surrounding menu chrome. Touch controls remain host-owned. Existing replay controls remain available during demonstrations.

The design takes the next-gate marker and screen-edge direction pattern from the documented VelociDrone workflow. It does not copy simulator assets or change this game's scoring to match another simulator. [VelociDrone desktop manual](https://www.velocidrone.com/desktop_manual)

Keeping the current objective visible, supplying an actionable correction and allowing players to revisit explanations follows Microsoft's objective-clarity guidance. The implementation applies that advice with a compact live display and a paused detailed explanation. [Xbox Accessibility Guideline 109](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/109)

## Compatibility boundaries

This increment does not alter flight physics, objective thresholds, challenge identities, course definitions, recorded commands, demonstrations, rewards or selected flight mode. Self-level and Acro remain available. Display preferences do not change scoring. It adds no runtime module or third-party decoder.

The legacy observer method adds presentation facts without putting them into replay snapshots or hashes. For World Studio, the HUD reads matching runtime hold, skill, actor-tracking and Hunt state. Missing advanced state cannot create credit. Transition snapshots already refer to the next objective, so the current objective's counters must not be combined with the previous objective's requirements.

Additional unit-test coverage remains deferred under the existing plan. The checks below are functional regression qualification and existing-proof replay, not a claim that the deferred test phase is complete.

## H3 — Current regression qualification and protected publication pending

### Reproducible functional evidence

Run from the repository root:

```sh
node docs/evidence/fpv-flight-hud-probe.mjs
node docs/evidence/fpv-flight-hud-projection-probe.mjs
```

The first command atomically writes [the verification receipt](fpv-flight-hud-verification.json). It records source and proof hashes, per-demonstration outcomes and limitations. The projection probe prints its receipt to stdout.

| Qualification                                                  |                                  Observed result |
| -------------------------------------------------------------- | -----------------------------------------------: |
| Existing School recommended-mode demonstrations                | 58 complete, original final identities preserved |
| Original Academy demonstrations                                |     24 complete, independent replay states equal |
| Directly stepped recorded ticks                                |                                          102,365 |
| Independently replayed recorded ticks                          |                                          102,365 |
| Same-objective hold/landing eligibility comparisons            |                                  65,309 matching |
| Observed runtime objective transitions                         |                                              484 |
| EN/UK initial feedback calls across catalogue and School modes |                                      3,336 valid |
| Functional receipt checks                                      |                                        18 passed |
| Production projection / legacy observer checks                 |                                        74 passed |

The focused cases include tilt followed by centring, stale and missing legacy facts, hard touchdown despite zero current velocity, throttle after soft landing, wrong-side gate approach, stale tracking, runtime occlusion reasons, contact versus combat credit, grounded survival timing and terminal completion. Synthetic adapter inputs are identified separately from accepted flight recordings.

The projection probe executes the actual extracted renderer method with bundled Three.js cameras, matrices, rays and bounded geometry fixtures. It does not create WebGL or render the complete art scene. Its legacy checks compare original recordings against the pinned pre-observer model.

### Browser review performed so far

Source-host review covers World Studio at **390 × 844**, **844 × 390** and **1280 × 800**, and Academy with Ukrainian text and touch controls at **844 × 390**. Explain pauses, closing leaves the flight paused, and HUD preferences are shared between hosts. Twenty interface options keep the bounded HUD free of menu textures and bevels. No horizontal overflow or touch/replay overlap was observed. [Browser review evidence](fpv-flight-hud-browser-review.json) records the exact scope. These are browser viewport checks on the development Mac, not physical iPhone, Steam Deck, installed-app or radio acceptance.

### Measured presentation cost

The [retained browser observation](fpv-flight-hud-browser-cost.json) compares the new HUD and old coach on the same Mac browser: **Chromium 154**, reported user agent `Macintosh; Intel Mac OS X 10_15_7`, **1280 × 720**, DPR **2**. The run sampled 98 snapshots from the existing Acro `beginner-13` recording across all five steps, with samples at least 90 ms apart. The old coach's 80 ms throttle was retained; the new callback includes its feedback adapter.

| Measured work             | Old mean |  Old p95 | New mean |  New p95 |
| ------------------------- | -------: | -------: | -------: | -------: |
| Presentation callback     | 0.108 ms | 0.200 ms | 0.089 ms | 0.200 ms |
| Forced style/layout flush | 0.154 ms | 0.300 ms | 0.093 ms | 0.200 ms |

The harness observed 1,787 DOM mutations for the old coach and 913 for the new HUD. Eleven DOM checks passed, including bounded card size, fixed target bands, unknown readings, a separate paused explanation, persistent preferences and no completion awarded solely for a full duration ring.

These are short-run callback and forced-layout measurements, **not FPS or input-to-display latency**. They exclude paint, compositor, GPU, full-scene loading and sustained memory. They do not establish the desktop 60 fps or mobile 30 fps targets, audible-sound behavior or physical-radio latency.

### Package and offline qualification

[Current package qualification](fpv-flight-hud-package-qualification-614adef.json) binds frozen source `614adef75a6e1cc28ea1d04acf26fa69b507c551` and tree `9b2883396f8044a297f884be091d2fb364b89625`. Civilian Flight, Academy and World Studio each passed two byte-identical builds, committed-input verification and original ZIP-member admission. Full Node 22 validation passed for 2,876 files and EN/UK localization, retaining seven nonfatal navigation warnings. The package envelope SHA-256 is `75c12cadea1134c2f1bfd364dca37629229c876bd861b3aa8d0d2a2355bc6cdf`.

Admission, validation and browser staging each started above the unchanged 3 GiB free-space floor, following a stable 38-second preflight. Subsequent concurrent allocation reduced free space below that floor. The preflight stopped the existing 53-case package/offline suite before Node started; **it was not run at 614adef**. Audited disposable temporary files were removed, and 1,062 inactive raw receipt/log files were losslessly compressed with verified decompressed sizes/hashes and restoration manifests. Source, uncommitted work, valid Git packs, worktrees, active artifacts and unique evidence bytes were preserved. Further cleanup stopped when background allocation made the floor unstable.

The [historical package qualification](fpv-flight-hud-package-qualification.json) remains unchanged at source `3bbdc8dda7e1613fe4c2b838c40ffbbe9493f852`. That source passed all three admissions, reproducibility, full validation, 60 existing flight/model/UI/radio/replay checks and 53 existing package/offline checks. Those passes are historical evidence; they do not establish the current source's unrun suite. Additional unit coverage remains deferred.

The [current admitted browser review](fpv-flight-hud-overlay-admitted-review.json) used exact package members from 614adef. World Studio and Academy both displayed **Ready offline**. With their dedicated origin stopped and HTTP connection refusal confirmed before and after, both reloaded successfully. Academy started its lesson and opened/closed Explain while remaining paused. World Studio completed the full “Acro: the tilt stays” recording; the terminal result hid the HUD, diagram, sticks and replay toolbar. Neither host logged a warning or error, and the server was restored. The measured viewport was 1280 × 720; the requested phone override did not apply, so this adds no refreshed mobile acceptance. This is a bounded own-origin outage, not browser-wide offline, eviction, arbitrary old-cache update or physical-device behavior.

Parent #1104 (`55493cb94783d279142823cff94843d682cabc54`) and #1105 (`0e3cc79c89f604068542539391b0ab38dc6735c9`) each have successful exact-head CI admission for all three packages and two reproducible builds. Their immutable artifact digests and four original metadata receipts are retained in the current qualification evidence. Local inspection verified the downloaded CI archive digest and receipts; the successful CI jobs performed their nested member admission. Each parent keeps its own package identity and pending release gates.

### Remaining release work

1. Complete the current source's existing 53-case package/offline suite after a stable 3 GiB preflight or retain equivalent qualified exact-head CI evidence. The historical pass does not close this item.
2. Publish the documentation/evidence checkpoint, retain the frozen package input identity, and satisfy fresh exact-head CI and protected review requirements.
3. Coordinate parent #1104/#1105 and native stack publication without retargeting or bypassing protections. #1110 remains Draft while publication work is coordinated.
4. Verify the public deployment identity and launch the public SIM before calling this increment live.

Physical-device performance, installed-app/native fullscreen, actual controller/radio reconnect and human beginner acceptance remain honestly outstanding. They do not block independent authorized development, and are not recorded as passed.

### Results and menu visibility correction

The host now passes explicit HUD visibility independently of active/paused/replay
state. Results, preparation, options and modal menus suppress the flight HUD; a
plain paused flight retains guidance and safe Explain. An immediate CSS guard
covers results shown after the frame update and asynchronous proof verification.
Idle sticks, drone diagrams and playback controls clear from terminal results and
return for a fresh flight. See `fpv-flight-hud-overlay-verification.json` for
38 browser checks and host verification. Fresh 614adef package admission and the
bounded admitted-browser review cover this correction. The historical 3bbdc8
receipts remain intact; the current 53-case regression suite and protected
publication are still pending as recorded above.
