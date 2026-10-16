# Real elapsed regional flight endurance tool

Open `authoring/fpv-worlds/regions/endurance.html` through a local web server. This authoring-only tool uses the production regional flight engine, verified mixed terrain/scenery owner and production renderer. It does not install a game world, write game progress, or substitute its automatic controls for player input.

## Workload and operation

The deterministic fixture reuses the six-cell flat terrain, roof and wall corridor from the prior accelerated regional ownership checks. Its automatic pilot repeatedly travels along the clear corridor, turns before its ends and controls height. The report identifies this synthetic workload explicitly. This is a repeated residency and rendering exercise, not broad content or player-behavior coverage.

1. Choose a runtime label, quality and **10-second smoke**. The runtime label is reviewer-supplied and is marked unverified; direct source hashes are collected separately, without claiming verification of the entire runtime closure.
2. Choose **Prepare fixture**. Canonical source hashes are verified and the actual renderer prepares geometry. Preparation remains disarmed and outside the measured segment.
3. Choose **Start measured flight**. Keep the tab visible, focused and at the same dimensions. A 20 ms accumulator advances only elapsed real time; bounded catch-up never drops elapsed time or fast-forwards to a successful duration.
4. Check the completed smoke report and zero owned collision/root resources after disposal. Then prepare again and choose **2-hour endurance** for the independent long segment.
5. Export the JSON report. Importing it later resumes report history only: a new flight starts at tick zero, and interrupted time never counts toward an uninterrupted pass.

Hidden tabs, focus loss, viewport changes, graphics loss, a frame gap above 250 ms, divergence above 250 ms between wall-clock and monotonic elapsed time, a paused/blocked flight tick, or an explicit stop invalidate that segment. No automatic reset or rearming hides these failures. The renderer and flight owner are released when a segment ends.

## Bounded measurements

Reports retain running statistics, a fixed 251-bucket interval histogram, the latest 120 one-second samples and at most 121 minute samples. Imported history is limited to eight summaries, marked unverified, with a 1 MiB input cap. No browser persistence is used.

Counters include accepted ticks, cell crossings, recentres, turns, committed/staged source and geometry reservations, actual Rapier worlds/colliders/bodies, renderer geometries/textures/programs, and disposal state. CPU submission and animation cadence are measured separately. CPU submission is not GPU completion; renderer counters do not account for every opaque engine/GPU allocation.

## Verification and acceptance limits

`node authoring/fpv-worlds/regions/verify-endurance.mjs` passes seven functional groups: elapsed-time accumulator behavior; pause/hidden/backward/stall rejection; bounded catch-up and independent restarted segments; system suspension/wall-clock discontinuity rejection; a real 1,013.6 ms/50-tick flight smoke; an explicitly accelerated 24,050-tick route check with three turns and 19 recentres; and zero owned collision/root resources after disposal. Scoped lint passes.

Two initial Node smoke attempts correctly rejected scheduling gaps above 250 ms before the first accepted tick. The final smoke yields initial source/WASM preparation before starting its measurement, matching the browser's separate Prepare and Start actions. Those rejected attempts are not counted as endurance passes.

The native review entry is isolated at port 9072 against unchanged frozen production package source `2cfe7a25d6b87913dd4d9ddbc7b2bd7478068071`, package revision `cc681b907bb9414034650dad0045699f7febee60e7b6d4a10c800bb6190fece3`; its external identity receipt records the authoring tool hashes. The initial browser smoke completed 10,006.7 real milliseconds and 500 accepted ticks, with 1,186 rendered frames. Observed mean frame interval was 8.44 ms, maximum 76.6 ms; peak ownership was two query worlds, six colliders, 101,904 geometry bytes and 84,872 source bytes. The complete observed report is retained externally as `elapsed-initial-10s-smoke-20261015.json`. These are observations in this browser and workload, not a hardware FPS claim.

The subsequent one-minute native attempt was correctly invalidated at 2,391.8 ms and 69 accepted ticks because a frame gap exceeded 250 ms. Its complete report is retained externally as `elapsed-final-1minute-20261015.json`. No one-minute pass is claimed; host contention is a possible cause, not a demonstrated diagnosis. The thresholds were not relaxed. The final sleep/discontinuous-wall-clock guard was then added and functionally checked before freezing the tool.

Final-source native interruption/restart review and two real hours remain open. This tool's publication does not establish a two-hour pass, physical-device FPS, all-map coverage, leak-free GPU memory, offline behavior, or public deployment.

No shipped runtime modules, package limits, physics equations, scoring, recordings or player controls change in this increment.
