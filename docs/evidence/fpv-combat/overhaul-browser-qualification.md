# FPV overhaul browser qualification

Date: 2026-10-20. Local isolated checkout `go_test_radio_fix`; nothing was published. Tests used separate headless Chrome profiles, without operating the user's radio tab.

> This is the chronological integration and diagnostic log. The final measured results, corrected archive/autosave checks and remaining release gates are in [overhaul-performance-qualification.md](overhaul-performance-qualification.md). Earlier slow, failed or incomplete measurements below are preserved as history.

## Reference environment

- Apple M4 Pro, 14 logical CPUs, 48 GiB RAM; macOS Darwin 25.6.0.
- Chrome 155.0.8059.85; ANGLE Metal renderer, Apple M4 Pro.
- 1920 × 1080, device pixel ratio 1. High graphics. Current art unless a report explicitly says r2.
- GPU timer queries are available. The final application and controlled effects runs measure them; the earliest diagnostic application runs below did not.
- Other desktop processes were not disabled. Agents paused substantial tests during timed samples.

## Application integration

| Check | Evidence | Result |
| --- | --- | --- |
| Six activities start, arm, advance and fire | `overhaul-app-smoke.json` | Continuous, Hunting, Elimination, Strike, Survival and Original ran; no page errors or failed requests in the retained smoke |
| Downloaded Railway Valley launch and simulation | `overhaul-app-regional.json` | Paused → active, aircraft and encounter ticks both advanced; geometryWaiting false. Exact pinned delivery bytes were supplied from an existing local evidence cache because remote download requests stalled. This qualifies hash admission/installation/play, not remote-network reliability |
| Military art and complete 128-actor rendering | `overhaul-art-browser.json`, `overhaul-crowd-art-browser.json` | All 128 actors visible; nearest 20 optional-art bodies use full rigs and other humanoids use shared Realistic pose instances. Mechanical actors retain military silhouettes; all 36 variants and 12 region templates admitted |
| Full-app combat playback | `overhaul-app-replay.json` | Verified 202 accepted ticks, pause held the cursor, 0.5× playback worked, live held Fire did not increase the recorded 30 shots, retry restarted at zero and verified again |
| Existing Survival recovery | `overhaul-app-96-recovery-fixed.json` | Previously emitted 96-slot recovery restored paused at 7,788 aircraft/encounter ticks, with 142 defeats, 945 shots and the reserved final actor still waiting |
| Realistic art download and renderer lifecycle | `overhaul-app-lifecycle.json` | Three 40-second attempts downloaded/activated r2 and advanced about 2,020 ticks each. The requested 128-slot Survival opening admitted 50 live actors. Enemy rifle/energy projectiles were observed; heavy projectiles were not sampled |

## Bugs found and resolved during browser integration

1. Native surface-impact events lacked a contact position/unit normal. This paused combat after firing. The runtime query boundary was corrected and the six-activity smoke repeated successfully.
2. The host temporarily imported a playback export not yet present in the generated runtime. The bundle was refreshed and the actual Watch current attempt flow passed.
3. Ground-contact raycasts traversed label sprites without a raycaster camera. Every query threw and the effects layer correctly left fragments pending. A probe recorded 2,683 exceptions in 2,683 calls. The renderer now queries visible mesh surfaces and excludes sprites.
4. Repeated world-tree matrix updates made the first ten-minute run slow. Root updates and attachment indexing were consolidated before the fresh qualification runs.
5. The 96-actor Survival recovery exposed a reserved final slot represented as course-only `caught` state in the physical checkpoint. Native Standard and Advanced adapters now represent inactive slots with disabled/defeated collision bookkeeping, while combat retains their waiting status and health. The session migrates previously emitted checkpoints only when the validated encounter identifies the same waiting/inactive slot; ordinary course catch validation stays unchanged.
6. Catalogue recovery testing found that Standard Canal turning-basin rejected a clear saved position inside a broad bound of open/clipped scenery. Restore now permits that case only when a full-radius sphere has a clear path from above every verified scenery component. Closed interiors, obstructed roofs, wall overlap, missing cells and exhausted proof budgets still reject. The exact pinned Canal reproduction restores at the saved position and five nearby clear heights; all nine historical containment scenarios and three added clearance tests pass.

The fresh grounding probe (`overhaul-app-grounding-fixed.json`) recorded 27,833 queries, zero exceptions, 183 settled instances, 31 marks and one pending fragment after 20 seconds. Its instrumented CPU callback p95 was 7.8 ms and frame interval p95 16.8 ms. This short diagnostic is not a ten-minute performance pass.

## Performance measurement definitions

`overhaul-app-stress.cjs` runs the actual application with seeded encounters, assisted invulnerability, scripted yaw, keyboard throttle feedback, conventional fire/reloads and periodic payload commands. The fixed-build runs use Balanced ammunition. Actual admitted and active populations are recorded, rather than assuming that the requested population is continuously alive.

The rAF timing wrapper aggregates synchronous callback execution per display frame. It excludes asynchronous worker CPU and GPU execution. The keyboard hover helper runs outside rAF and reports its own cumulative CPU time. Frame intervals include scheduling and presentation. A ten-minute wall-clock run does not necessarily equal ten minutes of accepted simulation when the application is slow.

`overhaul-effects-workload.{js,cjs}` is a separate controlled rendering experiment. It uses the real renderer, 128 actors, full 1,024-record destruction and surface-impact rings, and eight mixed-material defeats every two seconds. It compares identical phase-local inputs with effects enabled/disabled, in native and synthetic regional scenes with Current and r2 art. It measures event ingestion, actor staging and draw CPU plus GPU queries. Synthetic accepted facts do not qualify gameplay authority, real regional terrain, radio input or subjective gameplay quality.

## Earlier fixed-build full-application stress (superseded)

| Requested actors | Activity / wall duration | Mean FPS | Frame interval p95 | rAF CPU p95 | Accepted ticks | Defeats / shots | Live population observed |
| ---: | --- | ---: | ---: | ---: | ---: | --- | --- |
| 20 | Continuous / 600 seconds | 60.00 | 16.7 ms | 8.6 ms | 30,103 | 38 / 3,630 | 1–20 |
| 64 | Endless Survival / 600 seconds | 55.11 | 33.3 ms | 18.2 ms | 30,106 | 762 / 3,630 | 6–63 |

The 20-actor result is in `overhaul-app-stress-qualified.json`, with its exact source hashes. Final rendering held 762 settled instances and 77 visible marks, with 38 destruction records and a full 1,024-entry surface-impact ring (459 old impacts evicted). One fragment remained pending. There were no page errors or application suspensions. This run establishes sustained application behavior, not the separate 3 ms effects-overhead comparison. The later Survival tiers use a subsequent recorded integration revision.

The frozen 64-actor build completed without page errors or suspension but missed the 60 FPS target. It retained 762 destruction and 1,024 impact records, with 765 settled instances, 38 marks and six pending fragments at the final sample. The first 96-actor run paused unexpectedly after 196 seconds, immediately following a heavy breakup interval; it had 321 defeats, 250 moving fragments and six active breakup effects. Its CPU p95 was 30.8 ms and frame interval p95 was 33.4 ms. `overhaul-app-stress-large.json` records this failure, and `overhaul-app-96-paused.png` preserves its final screen. Investigation and fresh qualification are required; neither large tier meets release acceptance yet.

The follow-up probe confirmed the pause originated in the host's 250 ms frame-gap guard, despite focus remaining true and visibility remaining visible. The peak measured synchronous callback took 244.1 ms and the display gap was 266.7 ms. The short profiler interval around the pause was dominated by encounter-session `snapshot()` calls; full state copying is the first optimization target. `overhaul-app-96-profile.{json,cpuprofile.gz,recovery.json}` preserve the diagnostic and recoverable attempt. Profile timing includes diagnostic overhead and is not a release measurement.

After reducing repeated host copies, the restored 96-slot attempt completed a 30-second warmup and 45.18-second profiled window with 80 living enemies, no firing, no page errors or suspension: 59.38 FPS mean, 16.8 ms frame p95, 15.7 ms callback CPU p95 and 23.9 ms maximum callback time. `overhaul-app-96-optimized-profile-prearmed.{json,cpuprofile.gz}` retain the measured source hashes and profile. Encounter snapshot cloning still consumed about 11.18 seconds of the measured window; native snapshot copying consumed 2.67 seconds and transactional preparation copying 1.92 seconds. This short, profiler-instrumented result does not replace the sustained firing or 64/96/128 release gates. It restores the older movement rules to preserve that recording; it does not qualify the newly versioned squad spacing.

An initial attempt to attach the profiler after warmup caused a 283 ms debugger-start gap and activated the application's 250 ms frame-gap pause guard. That invalid diagnostic is retained as `overhaul-app-96-optimized-profile.json`. The corrected harness attaches profiling before arming and summarizes self time only inside the measured window.

The subsequent internal frame-view integration completed the same restored attempt without CPU profiling: 45.06 seconds after 30 seconds warmup, 80 living enemies, 60.00 FPS, 16.8 ms frame p95, 11.5 ms callback CPU p95, 13.1 ms CPU p99 and 20.7 ms maximum callback work. There were no page errors, failed requests or pauses. Final renderer counts were 66 draws, 77,788 triangles, 82 geometries, 21 textures and 18 programs; reported heap was 117.6 MB. `overhaul-app-96-frame-view-diagnostic.json` identifies reaction projection `0fb7bd76224da1617c76b3838e24e510e634cef65d291e5c0088b8b0e898f7d6`. Small targeted unit checks were permitted during this diagnostic; no catalogue workers or other browser workloads ran. Different profiling instrumentation prevents attributing the full difference from the preceding sample to the code change. Sustained firing, final crowd rules and larger tiers still need the full qualification.

## Revised appearance proof

The final r2 manifest SHA-256 is `9940f5d75727b52d067cf1be2ce75e254f52e0b6670643bc28a308291969e009`. `overhaul-r2-uniform.png` and `overhaul-r2-regions.png` show the final olive/khaki uniform, assigned military equipment and twelve connected damage regions. `overhaul-art-browser.json` records that hash and zero browser errors.

Admission measured 14,703,667 download bytes, 107,334,216 decoded-resource bytes, 129,733,792 GPU-resource bytes and 63,117 admitted vertices. An initial optional-art implementation rendered the nearest 20 humanoids with animated rigs and fell back to native military bodies for the rest. Review found that visual style transition unacceptable for large Realistic crowds. The revised source now uses a shared ten-pose Realistic palette beyond the nearest 20 rigs. `overhaul-crowd-art-browser.json` and `overhaul-crowd-128-realistic.png` show 128 organic actors across all36 identities:20 skinned plus108 baked Realistic bodies, no Current-art body fallback, one shared6.02MiB palette and zero browser errors. Measured total resources are108.61MiB decoded and129.91MiB GPU. Final integrated performance/lifecycle checks remain separate.

`overhaul-visual-matrix.json` and 51 `overhaul-roster-*.png` captures cover all 36 family/cast variants across the eight Blood/Brutal/Remains combinations, plus three impact scenes. Each six-victim preview retained six logical records; settled objects were absent with Remains off, with 92 clean or 164 Brutal pieces when enabled. Inspection covered neutral opaque caps with Blood off, connected clean bodies, bloody breakups, final uniform colors, helmets, shields and communications equipment. There were no browser errors. These are synthetic production-template visual previews and broad roster inspection, not a claim of human satisfaction or new sculpted assets.

The actual local art download initially returned 404 because the temporary development server still allowed only r1 paths. Its allowlist was refreshed; the following full-app download/activation passed. The three-attempt lifecycle probe retained identical resource counts on each restart: 96 prepared / 116 running geometries, 66 textures and 34 shader programs. Ending JavaScript heaps were approximately 180 / 166 / 156 MB. Counts did not accumulate, but this is a short diagnostic without forced garbage collection, not a long-session leak proof. Stationary invulnerable hovering also showed close pursuit crowding around the aircraft; movement readability and crowd spacing still need human evaluation.

## Superseded measurements

`overhaul-app-stress.json` retains the initial ten-minute 20-actor reproduction: no application suspension, but 25.0 mean FPS, CPU callback p95 75.3 ms, and no visible settled effects because of the sprite query failure. The browser was intentionally stopped after this completed tier to fix the defects; its next-page cancellation is a harness termination, not an application error. This report does **not** qualify the fixed build.

Short profile and fixture-smoke reports are diagnostics. They must not be presented as final stress acceptance.

## Remaining external acceptance

- A physical radio pass is still needed for the new weapon-switch, reload and payload commands. Earlier user confirmation covered flight and Fire before the overhaul.
- No five-player formative study or 4/5 satisfaction rating has been performed.
- r2 adapts the existing character asset and equipment; it is not a newly commissioned photorealistic character sculpt.
- Final Survival and controlled effects-comparison tables will be appended after the active measurements finish.

## Hillside recovery budget correction

The full catalogue matrix found 30 Standard-backend restore failures across three exact Hillside starts: civic-court lower-square and middle-courtyard, and the original middle-courtyard. The entire loaded scenery window exceeded the 16,384-triangle containment-certificate budget; Advanced did not use this failing path.

Restore preparation now conservatively excludes only whole meshes proved horizontally outside the saved aircraft's full vertical body column. All containing mesh bounds remain relevant; individual triangles are never removed. The existing relevant-triangle, plane-work and certificate-memory limits remain, with a separate 131,072-vertex bound-scan cap. A scoped proof rejects another position or a larger body footprint. Missing geometry, contained closed solids and exhausted relevant budgets remain unavailable.

All three exact pinned fixtures restored at six clear vertical offsets using an isolated loader before the frozen-source matrix ended. Applied-source focused checks pass 6/6, including grazing off-center walls, closed volumes and budget exhaustion. Evidence is in the three `overhaul-hillside-*-staged-fix.json` files and the reusable `overhaul-regional-restore-repro.mjs`. The complete matrix was rerun on the applied source and passed 7,420/7,420 cases, including all 60 cases at the three repaired Hillside starts. The previous 7,390/7,420 report is retained only as the pre-fix baseline.

## GPU timing method

The final application and controlled effects harnesses use the same bounded asynchronous GPU timer from `overhaul-gpu-probe.js`. It samples one in fifteen actual flight-view `renderer.render` calls, including the renderer's internal shadow passes. It excludes browser composition, other graphics contexts and worker CPU. Up to eight queries may be pending; results are read only after availability and while the disjoint flag is clear. Disjoint results, context loss and expired queries are discarded and counted. This follows the [Khronos WebGL timer-query contract](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/). No `finish`, `flush`, or blocking result wait is used. Probe polling overhead remains in both On and Off CPU measurements. Reports retain canonical gameplay-source hashes and separate qualification-harness/probe hashes.

A five-second full-app plumbing smoke and one-second samples across all eight effects conditions yielded valid GPU timings without errors. These ran during the catalogue matrix and are expressly **not performance acceptance evidence** (`overhaul-gpu-app-smoke.json`, `overhaul-gpu-effects-smoke.json`). Five deterministic probe checks cover bounded queues, unavailable results, phase attribution, disjoint/context loss, unsupported extensions and cleanup after render errors.
