# Native late-workload coverage: current supported paths

Source audit at `e708ce99f0fc930406c15233d89d5598360b366d`. This is a capability assessment, not a completed performance result. The existing early-content trials and the pre-progression-fix media retain their recorded source identities.

## What is available without injecting game state

The native review route earns upgrades through normal simulation and public inputs. `reviewBuild`, `autoplay=1`, and `diagnostics=1` can run a complete sortie. `reviewStopAt=120..240` stops automated movement once that **earned gameplay time** is reached; it does not seek to a checkpoint (`game/overflight/host-loop.mjs:270`). There is no URL for loading a late checkpoint, changing the review route, or delaying the start of a measurement window.

`benchmark=1&trial=1`, `2`, or `3` selects one fresh 30-second warm-up and 120-second rendering window, then automatically pauses. Ordinary upgrade windows remain measured, so 150 seconds of rendered wall time correspond to less than 150 seconds of simulation. The existing Survivor/Riy trials ended around 139 gameplay seconds: they cover opening through the first elite, not the late surge or final tank (`game/overflight/app.mjs:225`, `game/overflight/app.mjs:1321`).

Omitting `trial` leaves the renderer's default 30-second warm-up followed by **three consecutive** 120-second windows. This can observe later earned gameplay without code changes. It is not three independently restarted trials. A run ending before all 390 seconds of active rendering finishes leaves the complete protocol unqualified; retain its completed-window observations and label incomplete windows. `trial=soak` needs 900 measured seconds after warm-up and likewise cannot turn an early completed or lost sortie into a successful soak (`game/overflight/benchmark.mjs:33`, `game/overflight/benchmark.mjs:98`).

The native Survivor review pilot uses the existing `tight` route; the Riy wrapper inherits that base route. Headless figure-eight wins are therefore not evidence that the same route is selectable through the native URL (`game/overflight/app.mjs:183`). Human steering can still demonstrate a complete run through the normal controls.

## Reliable next review steps

1. Run a fresh earned full sortie with diagnostics, no finite `trial`, and a fixed world, seed, build, difficulty and airframes. Keep normal effects, then repeat with reduced effects selected **before** starting. Keep media recording separate from cadence measurement.
2. At a prespecified late review point or run end, use **Inspect raw measurements** before downloading. Inspect takes the snapshot before its deliberate pause; Download by itself pauses first and may add an interruption to an unfinished protocol (`game/overflight/app.mjs:2339`, `game/overflight/app.mjs:2363`). Preserve all raw samples and incomplete/failure flags. Report the actual gameplay interval, live/visible actors and encountered boss phase, rather than calling any elapsed wall interval a boss workload.
3. Use reduced-effects settings through the existing shared Settings control. The effective value also respects the operating system's reduced-motion preference; record the effective value in renderer metadata. Do not open Settings halfway through a timing trial (`game/overflight/app.mjs:2150`, `game/display-preferences.mjs:94`).

The reference/stress fixtures still prove their controlled populations. They do not substitute for a complete late build: they use technical fixture rules, recycled populations and different progression/terrain conditions.

## Remaining instrumentation gap

For three formal independently restarted **late** 120-second windows, the current public UI needs a small, explicitly reviewed instrumentation addition: begin a fresh 30-second warm-up only after a prespecified earned gameplay threshold, then measure 120 continuous rendered seconds, including upgrade cards and stalls. It must never grant upgrades, seek state, suppress failure, or trim expensive frames. If the run ends before that window completes, the attempt remains incomplete. This source audit does not implement or claim approval for that addition. Internal `renderer.resetMeasurements()` also resets presentation state and is not a public checkpoint tool (`game/overflight/renderer.mjs:988`).

Cadence acceptance remains unchanged: average at least 59 FPS, p95 at most 18 ms, p99 at most 33.3 ms, fewer than 1% of intervals above 33.3 ms. External device trials remain skipped, not passed.

## 14 October addendum: earned late-window instrumentation

The earlier audit above describes the pre-addition source boundary and remains intact. The approved diagnostic addition now accepts `measureAt=160` alongside an admitted `reviewBuild`, `benchmark=1`, and one finite `trial=1`, `2`, or `3`. The value is a decimal gameplay time from 0 to 360 seconds. Missing or invalid values, fixtures, ordinary manual play and `trial=soak` retain the existing protocol.

For example, append `&benchmark=1&trial=1&measureAt=160` to the accepted native earned-build review URL. Start a fresh sortie normally; the game must reach 160 gameplay seconds through its existing simulation, movement and earned upgrades. This option does not seek, grant a build or change any gameplay setting. Each of three trials must be a separate fresh attempt with the same world, seed, build, difficulty and airframes.

Before the threshold, the benchmark is pending and does not collect cadence or CPU-submission samples. The first completed active render reaching the threshold arms the unchanged 30-second warm-up, followed by 120 seconds of rendering. The entire interval leading into that frame is retained, including a threshold-crossing stall. Ordinary draft frames count while gameplay time is paused. The existing completed-trial action captures measurements and pauses only after the full window finishes. A death or completed sortie before then leaves the trial incomplete.

`renderer.protocol.scheduledStart` records the requested gameplay threshold, actual gameplay time when warm-up armed, gameplay time at the first measured interval and whether it is still pending. Population high-water marks and `resourceSamples` remain whole-attempt evidence; use the timestamped samples to describe the late workload instead of treating a previous maximum as its sustained population.

Manual pause, hidden state and context failures before arming remain invalidating. Simulation-clock dropped-time flags and raw overflow counters remain attached to the whole attempt. No mid-run measurement reset clears these flags, effects, entities, remains or prepared textures. Omitting the option preserves the original timing behavior. Manual review links and generic family restoration strip `measureAt` with the other diagnostic parameters.

This addition enables a late-content timing trial; it is not itself a performance pass. Previous early-content measurements and media keep their original source identities. Native late results must record the tested commit and actual gameplay interval separately.
