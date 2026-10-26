# FPV combat evidence

> Current consolidated status, remaining gates and estimates: [FPV SIM current plan](../../fpv-sim-current-plan.md). Historical figures below retain their recorded source scope.

## Current overhaul

Start with the [delivery report](overhaul-delivery.md), [player guide](player-guide.md), [runtime qualification](overhaul-runtime-qualification.md) and [local preview notes](overhaul-release-notes.md). These distinguish current implementation from remaining release gates.

## Historical presentation baseline

**The measurements, package sizes and r1 appearance qualification below describe the earlier combat implementation, before the six-phase overhaul. They do not qualify the revised r2 assets or current Survival populations.** Retained reports identify their tested sources; use the current delivery report for superseding evidence.

Local working-tree verification on 2026-10-19–20. These records qualify the tested rendering paths; they are not a published-release approval.

## Environment and method

- Apple M4 Pro via ANGLE Metal, 14 reported logical processors, 32 GiB reported browser device-memory tier.
- Headless Chrome 155, 1920 × 1080 canvas, device scale 1, WebGL 2. GPU timings use `EXT_disjoint_timer_query_webgl2` without synchronous waits; disjoint samples are discarded.
- `native-procedural-regional-stress.json`: 600.006 seconds, 35,873 frames, no errors. Twelve 50-second phases cover native and procedural regional scenes × low/high/ultra × effects off/on. The first five seconds of each phase are excluded from timing statistics.
- Each effects-on phase starts with 1,024 logical defeat records, renders 20 live actors, and requests eight simultaneous mixed defeats every two seconds. Casts rotate among Tactical, Rivals, and Arcade. Blood/remains preferences are switched during flight; archives are restored repeatedly; each phase rebuilds scene presentation.
- Actors, accepted ticks, and impact facts are synthetic test input. Actual application renderer, shared family/vehicle rigs, batching, materials, scene rebuild, and archive interfaces run in a real browser/WebGL context. This measures rendering and submission, not the full physics/radio/UI frame.
- “Draw CPU” includes rendering submission and presentation updates. “Effect CPU” and actor update timings are nested inside Draw CPU; they are not additive. “Effect CPU” measures only effect update work. CPU excludes fixture generation, `setCombatActors` snapshot copies, and simulation time. GPU samples cover the complete draw, not only effects. Off/on phases are sequential observations, not paired-frame causal measurements.

## Native and procedural regional measurements

All numbers below are milliseconds except draw-call counts. “Off / on” means effects disabled / enabled while keeping 20 actors. Calls are the final sampled frame, not a percentile.

| Scene | Detail | Draw CPU p95 off / on | Effect CPU p95 on | GPU p95 off / on | Frame interval p95 on | Total calls off / on |
| --- | --- | --- | --- | --- | --- | --- |
| Native | low | 0.8 / 2 | 1 | 1.961 / 0.82 | 16.7 | 49 / 59 |
| Native | high | 1 / 2.7 | 1.6 | 1.82 / 2.413 | 16.7 | 58 / 67 |
| Native | ultra | 0.9 / 2.4 | 1.4 | 2.201 / 2.253 | 16.7 | 58 / 67 |
| Procedural regional | low | 0.7 / 1.7 | 1 | 0.626 / 0.917 | 16.8 | 5 / 14 |
| Procedural regional | high | 0.8 / 1.7 | 1.1 | 0.892 / 1.03 | 16.7 | 5 / 15 |
| Procedural regional | ultra | 0.6 / 2 | 1.4 | 2.078 / 2.538 | 16.7 | 5 / 15 |

The largest observed draw p95 increase is 1.7 ms; effect update p95 is at most 1.6 ms. The tested renderer stays below the planned +3 ms p95 rendering overhead on this machine. All phase frame intervals are 16.7–16.8 ms p95. GPU p95 is at most 2.538 ms. Actor updates are at most 0.5 ms p95. The procedural regional fixture is a floor, so the separate Railway run below is the actual terrain/scenery check.

Observed JS heap samples span approximately 22–98 MiB, including the browser harness, sample arrays, pose caches, and scene data. Garbage collection produces large fluctuations; these values are not GPU memory, process RSS, or proof of a leak-free application. Renderer geometry/texture/program counts are recorded with each phase. Live actors use four draw calls; presentation uses at most eleven nonempty shared pools. Logical remains are kept independently of visible geometry.

## Actual Railway Valley

[Actual Railway Valley stress](railway-valley-stress.json) completed 600.008 seconds and 35,792 frames with no errors. Six 100-second phases exercise low/high/ultra with effects off/on; the first five seconds of each phase are excluded. The pinned `railway-valley-study` / `structure-r1` manifest is identified by commit and SHA-256 in the report. Its 38 assets (5,684,606 bytes, excluding the descriptor) were read as exact pinned Git bytes, hash-checked, and served by a local fixture. The production verified terrain/scenery compiler loaded the actual landscape, buildings, trains, and bridge geometry.

The run maintains 20 live actors, a full 1,024-record remains ledger, and eight requested mixed defeats every two seconds. Six presentation rebuilds, repeated archive restore and preference changes, and sixteen resident-geometry transitions—including twelve boundary recenters—exercise the freight yard, trestle approach, and maintenance entry. The camera path, actors, and accepted defeat events are synthetic. This checks real regional geometry and rendering interfaces; it does not run the complete flight worker, radio, or session-recovery protocol.

| Detail | Draw CPU p95 off / on | Effect CPU p95 on | GPU p95 off / on | Frame interval p95 on | Total calls off / on |
| --- | --- | --- | --- | --- | --- |
| low | 0.5 / 1.5 | 1 | 1.769 / 1.91 | 16.7 | 48 / 57 |
| high | 0.6 / 2.3 | 1.4 | 2.797 / 1.706 | 16.7 | 37 / 48 |
| ultra | 1 / 2.6 | 1.7 | 1.668 / 1.476 | 16.7 | 42 / 51 |

The largest observed renderer draw p95 increase is 1.7 ms. Effect and actor update timers are nested within draw; they must not be added to it. The measured rendering overhead is below +3 ms p95 on this machine, with GPU p95 at most 2.797 ms and all phase frame intervals 16.7–16.8 ms p95. Sampled JS heap spans 41.5–108.0 MiB with the same limitations as the native measurements. Final sampled effect geometry uses 9–11 draw calls, below every configured cap.

[Railway Valley, Ultra](railway-valley-ultra.png) and [Railway Valley, Low](railway-valley-low.png) show the actual resident scenery. The stress fixtures do not generate projectiles. A separate fresh-browser regression below verifies both projectile rendering paths after the final fix.


## Budget and visual checks

| Tier | Simultaneous bursts | Moving pieces | Settled pieces | Surface marks | Effect draw-call cap |
| --- | ---: | ---: | ---: | ---: | ---: |
| Low | 4 | 128 | 256 | 32 | 16 |
| High | 6 | 256 | 768 | 96 | 24 |
| Ultra | 8 | 512 | 1,536 | 192 | 40 |

A complete recognizable fragment cluster is reserved before drawing; the visible count can therefore be below the maximum. The logical record ring is capped at 1,024 and evicts the oldest record only when full. Blood off or Brutal off immediately selects a connected clothed body with clean material effects; exposed interior caps and blood marks are omitted. Reduced motion suppresses ballistic animation while permitting settled remains. Geometry budgets do not delete logical records.

The gallery shows all twelve shared families with five vehicle models, drone, wood, and glass subjects:

- [Tactical, blood and remains](tactical-bloody.png)
- [Rivals, blood and remains](rivals-bloody.png)
- [Arcade, clean material breakup](arcade-clean.png)

These Phase 1 galleries show the existing stylized procedural assets, with matching wardrobe, equipment, caps, fragments, and surface marks. Optional authored art has separate qualification evidence below. Living actors and their example remains intentionally appear together in the visual fixture.

[Gameplay settings](gameplay-settings.png) shows the application controls for activities and effect preferences.

## First-use preparation and sound

[Shader preparation](shader-preparation.json) used a fresh browser context. `prepare()` returned true with zero live actors and zero remains. After the empty scene's first draw, nine shader programs were compiled; adding twenty actors and twenty defeats kept the count at nine. Empty instanced pools expose their material palette and allocate instance colors before compilation. The initial empty scene itself adds its ordinary scene/shadow program during its first draw; the claim here is no additional first-hit combat shader compilation. Combat effects add no textures.

[Regional projectile regression](regional-projectiles.json) starts with an origin offset of x=128,000 mm and z=64,000 mm. Preparing an empty scene preallocates both pulse batches. Adding four combat actors plus a cyan player pulse and amber hostile pulse keeps the shader count at seven, displays both shots at their rebased positions, and creates no duplicate legacy actor rows. The [projectile screenshot](regional-projectiles.png) records that display. A fresh native check also rendered twenty combat actors and one player pulse with zero legacy actor rows. Unit coverage checks both origin cases, the 64-projectile cap, pool clearing, and input immutability.

[Real Web Audio output](audio-output.json) confirms an enabled context resumed, the admitted human reaction recording decoded and started, a procedural noise layer started, and the analyser measured a nonzero peak of 0.0348. This is a signal/output check, not a subjective speaker/headphone audition. Focused tests cover material distinctions, voice suppression for machines, accepted-event ID deduplication, vocals-off interruption, pause cleanup, and silent archive priming.

## Automated verification and packages

- Phase 1 integrated focused suite: **256/256 passed**. All 46 Phase 1 modified/new JavaScript files pass ESLint; `git diff --check` is clean. The counts below identify relevant subsets and related runs, not additional tests to add to 256. Subsequent internal appearance work has its own technical tests.
- 14 combat presentation tests: all families/casts; material recipes; complete-cluster budgets; pause/reduced motion; copied hit points; atomic 1,024-record restore; 60 Hz Auto recovery; accepted vehicle-model changes; origin rebasing; surface grounding; settings separation; actor cleanup; empty-pool shader preparation; native/regional projectile batching.
- 12 shared encounter audio tests, including decoded reaction selection and new accepted combat event handling.
- 17 optional-package/admission tests, including real native/Academy/World closures and unchanged file/byte caps.
- 45 encounter controls/runtime/session/Studio tests passed in the integrated checkout.
- Owned renderer/audio/presentation files and tests pass ESLint; both generated projections are checked byte-for-byte after the final integration refresh.

[Package admission](package-admission.json) records working-tree candidate sizes. Synthetic commit/tree bindings are used only to exercise admission; `publicEligible` remains false. No package caps are raised. World source uses all 210 allowed files; new canonical modules are projected into an existing runtime slot. Academy shares its checked audio projection rather than shipping duplicate audio helpers. Evidence files in this folder do not enter optional runtime packages.

## Gameplay acceptance

The user confirmed that a physical radio controls the drone in Railway Valley and that its assigned Fire switch works before and after pause. This is separate from synthetic renderer stress evidence. [Native/downloadable admission](native-downloadable-admission.json) covers 204 native and 41 downloadable course starts; [regional admission](regional-admission.json) covers 126 starts across 24 regional revisions. These admission reports cover the stated generated/simulated checks, not manual playthroughs of every level.

[Combined browser acceptance](combined-browser-acceptance.md) covers the production host, worker transport, accepted radio input, late-recording UI recovery and streamed boundary return. [Optional-art UI delivery](realistic-delivery-ui.md) covers explicit installation, 36-character activation, same-state art switching, cache reuse and Workshop previews. Both use documented isolated QA entries; the user's protected page and profile are separate.

## Limits and remaining gates

- The benchmarks run on one desktop GPU/browser. Actual mobile hardware, low-end integrated GPUs, other browsers, and thermal/power conditions remain unqualified.
- Synthetic stress inputs do not establish subjective visual/audio quality or comprehensive aiming/live-collision behavior. The specific physical radio firing and pause/resume check above passed; mobile and other hardware performance remain unqualified.
- The Phase 1 measurements above use Current art. The optional appearance pack has separate admission, gallery, lifecycle and performance evidence; its timings must not be inferred from these Current-art runs.
- Decals are grounded plane marks, not mesh-conforming wall/edge projection. Body breakup is deterministic cosmetic ballistic settling, not articulated physical ragdolls. Current primitive batches bound all twenty actors in the Phase 1 measurements; the optional skinned path is measured separately.
- Static regional scenery is actual geometry in the Railway run; its decorative train/building props are not changed into destructible combat actors by this presentation module. Authored/synthetic encounter targets use the encounter runtime's own damage authority.


## Accepted simulation and long sessions

[Full-session acceptance](full-session-acceptance.md) records four tests using the actual aircraft solvers and encounter adapters. Native hunting ended at exactly 9,000 accepted ticks, elimination completed its admitted roster, and regional combat continued for 720.34 seconds across recording rollover. Paired recovery accepted fresh radio input afterward. A regional boundary round trip preserved the existing target roster and paused encounter time while outside. These checks complement the browser presentation measurements; they do not include browser worker transport or physical USB sampling.

## Optional realistic art: representative qualification

[Representative measurements](realistic-representative-performance.json) cover the first CC0 MakeHuman/MPFB clothed character, before equipment variants were added: 140.018 seconds, 8,397 frames, no errors on the same M4 Pro / Chrome 155 / 1080p reference. Twenty live rigs measured 1.6 ms draw CPU p95 and 1.721 ms GPU p95; twenty distance rigs measured 1.5 / 1.916 ms. With a full logical remains ring and repeated eight-victim effects, live + High measured 3.2 / 2.154 ms, and distance + Ultra measured 3.4 / 2.452 ms. Frame interval p95 stayed at or below 16.8 ms. Both rigs had animated deformation; disposal returned to the ground-only geometry, texture and shader baseline.

This qualifies that representative on the reference desktop, not all devices or the final equipped roster. These timings include actor/presentation rendering, not aircraft physics. Final roster and clean-remains checks are tracked separately. Realistic proportions and textured game art are not a claim of photorealism.


## Final optional roster: visual and Railway qualification

The [final roster report](realistic-roster-railway-performance.json) pins manifest `8121b18a0a6c1ea2c625cb355ef2d5efee0ed6c1486a835d415c3119fc555357` and the five canonical renderer-module hashes. The manifest pins GLB `bf99cfa8cfcdb6d20a11b3594eda0cfd5c0f9a85edf48e2fd55e6f4fa2e5c8ad`. After measurement, the optional download registry constant was enabled. Replacing only that constant with its measured null value reproduces the exact measured module hash; the report records both hashes. The optional download is 13,610,307 bytes; admission counts 60,691 vertices, 103,546,328 decoded bytes, and 125,981,328 conservative GPU bytes. These admission estimates differ from sampled JavaScript heap and actual driver allocation.

The final run completed **600.014 seconds and 35,453 frames with zero browser errors** on the reference M4 Pro / Chrome 155 / 1920×1080 configuration. It used the actual pinned Railway scenery, all 20 skinned actors, all three rotating casts, a full 1,024-record effects ledger, eight requested mixed defeats every two seconds, six presentation rebuilds, sixteen terrain transitions including twelve boundary recenters, preference changes, and repeated archive restore. This is a production-renderer workload with synthetic accepted inputs; complete application/worker/radio behavior has separate acceptance evidence.

The first five seconds of each phase are excluded from CPU statistics. Draw CPU contains actor/effect updates and graphics submission. Accepted-input CPU separately measures actor/event ingestion and periodic archive export/restore. **Presentation-frame CPU is their per-frame sum**; its percentile is not the sum of the separate percentiles. Nested actor/effect timers must not be added again. Fixture generation, terrain streaming waits, and preparation are excluded. GPU timers cover the complete draw. Off/on phases are sequential observations, so a lower GPU value is not evidence that enabling effects reduces GPU work.

| Detail | Draw CPU p95 off / on | Presentation-frame CPU p95 off / on | CPU increase | GPU p95 off / on | Frame interval p95 on | Peak effect calls | Peak authored-remains triangles |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Low | 1.4 / 2.5 ms | 1.5 / 2.6 ms | 1.1 ms | 2.923 / 3.379 ms | 16.8 ms | 11 / 16 cap | 0; Current remains fallback |
| High | 1.2 / 4.0 ms | 1.4 / 4.1 ms | 2.7 ms | 4.950 / 3.959 ms | 16.7 ms | 24 / 24 cap | 597,756 / 600,000 cap |
| Ultra | 1.1 / 3.5 ms | 1.3 / 3.6 ms | 2.3 ms | 4.244 / 4.259 ms | 16.8 ms | 40 / 40 cap | 1,197,368 / 1,200,000 cap |

Every detail meets the planned +3 ms p95 presentation CPU overhead on this desktop. Peaks for Low / High / Ultra were: active bursts 4 / 4 / 8 (caps 4 / 6 / 8); moving instances 128 / 153 / 413 (caps 128 / 256 / 512); settled instances 256 / 768 / 1,536; and marks 32 / 96 / 192. Complete clusters may use fewer active bursts than requested. All phases record 20 skins and at most 25 shared equipment draws. Total scene triangles, including terrain and actors, peak at 440,280 / 1,020,432 / 1,873,394 in effects-on phases. Effects draw limits exclude terrain and live actors.

Heap samples range from approximately 93.0 to 182.9 MiB and finish at 111.0 MiB. They include fixture arrays and caches and fluctuate with garbage collection; they are not a process-memory or GPU-memory measurement. [Cleanup](realistic-roster-railway-cleanup.json) reports the renderer disposed, zero geometries, and its WebGL context deliberately lost; the dedicated browser was then closed. The retired context’s diagnostic counters still retain two textures and three programs, so this is not a claim that every Three.js informational counter becomes zero. Unit tests separately verify that actor skeletons and leased shared pack assets are released in the required order.

[All 36 High-detail cluster checks](realistic-roster-gallery.json) pass individually with 15–18 authored instances and 16–19 effect draws, below the 24-draw High cap. Mixed-roster scenes use complete Current fallback clusters or omit complete distant clusters when the configured budget is exhausted. The [rendering contract](realistic-roster-method.md) records those bounds and the discarded initial fixture-baseline correction. The [final Railway frame](realistic-roster-railway-final.png) records the actual terrain presentation.

| Cast | Live | Clean connected remains | Graphic remains |
| --- | --- | --- | --- |
| Tactical | [live](realistic-roster-tactical-live.png) | [clean](realistic-roster-tactical-clean.png) | [graphic](realistic-roster-tactical-bloody.png) |
| Rivals | [live](realistic-roster-rivals-live.png) | [clean](realistic-roster-rivals-clean.png) | [graphic](realistic-roster-rivals-bloody.png) |
| Arcade | [live](realistic-roster-arcade-live.png) | [clean](realistic-roster-arcade-clean.png) | [graphic](realistic-roster-arcade-bloody.png) |

[Brutal off](realistic-roster-arcade-brutal-off.png) retains the clothed connected body. The [clean closeup](realistic-roster-arcade-clean-closeup.png) confirms that sleeves match the settled arms. The initial gallery caught a live-rest-pose versus damage-pose mismatch; the repeatable asset builder now derives declared rigid remains roots from idle time zero while sharing existing mesh buffers. All 25 derived matrices agree with independent actual-loader evaluation within 1.1×10⁻⁷. [Closed brace](realistic-roster-brace-closed.png) and [open brace](realistic-roster-brace-open.png) show the protected versus vulnerable silhouette.

The final appearance/presentation subset is **71/71 passing**, including declared remains-root validation, shared-geometry lifetime, transformed clean clothing, all families/casts, accepted-tick animation, distance-detail hysteresis, clean treatment, whole-cluster budgets, and unsupported-surface mark rejection. The final gallery and performance scripts are retained as [gallery fixture](realistic-roster-gallery.js) and [Railway fixture](realistic-roster-railway-harness.js); their local fixture URLs must be mapped to the pinned source assets when reproducing. No mobile, low-end GPU, or cross-browser performance claim follows from this desktop run.
