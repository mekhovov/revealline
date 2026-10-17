# Held Sentry wall-anchor workload

The original native Sentry observations remain failed for missing required
projectile mechanics. This separately named route is a new workload; its model
checks do not repair or qualify the old measurements. No adapter, source/package
binding, manifest, workflow or native dispatch changes here.

## Why the original route missed the sentry

The exact retained candidate Chromium r1 replay strictly reproduces checkpoint
`a925e43d27d5058b`. Its two capture closures occur at ticks 246 and 1417, one and
two ticks into the following Up gestures. Capture clears held input. The
remaining 21 and 426 recorded ticks are neutral, so those gestures do not reach
the intended sentry exposure. The replay records two closures and zero shots or
projectile ticks. The existing authored host qualification explicitly presses
the key again after capture; the timed native recipe does not. This establishes
a fragile public route, not a demonstrated combat-runtime defect.

The copied immutable `sentry-original-native-failure.replay.fixture` is the
9,773-byte native recording from run 39015298521, artifact 12095530735, Chromium
r1 candidate, SHA-256
`82f11ed77a2f322811da59e6d55ff60c6081fc1aa21819e8d033a9d5673cda10`.
The test replays every segment and release against the real core, verifies the
strict recorded checkpoint, and asserts both capture/gesture boundaries and
the missing mechanics. It does not relabel the failed native observation.

## New public inputs

`sentry-wall-anchor.qualification.fixture` keeps the exact imported Sentry
Detour level, scout actor, grid-center steering, initial preparation, public
Start/Pause/export, expected replay definition, 240-second deadline and original
required closure/shot/projectile checks. Only its name and eleven key holds
change. The new holds are:

| Direction | Hold |
| --- | ---: |
| Right | 1,700 ms |
| Up | 4,500 ms |
| Right | 1,000 ms |
| Down | 5,000 ms |

The initial Right selects the cut column. Up closes that cut at the top safe
edge with time left before the next gesture. Right moves along that safe edge;
Down crosses the sentry exposure and closes on the next safe region. In the
nominal 60 Hz model the closures occur during Up at tick 388 and during Down at
tick 1162, with a lock at tick 900 and shot at tick 1080. No automatic key repeat
or additional gesture is injected after capture.

The new holds total 12.2 seconds; the old holds total 22.0 seconds. Their timing
results are not interchangeable. A future separately reviewed matched cohort
must retain raw numerical failures and full same-engine replay. The original
fixture, level upload, declaration and workflow are asserted byte-identical.

## Model evidence and limits

The complete focused model plus qualifier-contract run passed **50/50**. Its
five route tests cover the exact historical failure, unchanged mission/entry
and gates, nominal strict replay, 1,782 independent hold-corner schedules, and
90 changing-cadence schedules. Corner schedules include scene-clock
30/40/45/60/90/120/144 Hz, pinned Phaser 4.2.1 warm/cold smoothing at 30/144 Hz,
0/200 ms startup offsets, every independent four-hold combination of
−200/0/+200 ms, and 200 ms gaps between keys. All earned one lock, one shot and
two closures without losing a life. Sixteen corner schedules, three changing
schedules and the nominal schedule also recorded every input/release and
strictly verified the final checkpoint. An earlier cache exploration retained
426 additional mixed schedules; it is exploratory evidence, not another native
cohort.

The model applies key transitions at callback boundaries, runs the real fixed
120 Hz core, and clears held input on actual capture/respawn. It calls the
installed pinned Phaser smoothing function for the historical comparison.
These are deterministic scheduling controls, not browser performance,
GPU/presentation evidence or physical Steam Deck OLED/iPhone 17 Pro results.
No game rules, source clocks or replay formats are modified.

The first tracked run was **4/5** because the test's arithmetic assertion called
the original duration 22.1 seconds. Its actual sum is 22.0 seconds; every model
schedule passed that run. The assertion and prose were corrected, with no
fixture or mechanics change. Both outcomes remain under
`.cache/solo-followup/sentry-route-proposal/`:

| Receipt | Bytes | SHA-256 |
| --- | ---: | --- |
| `tracked-model-v1.tap` | 2,104 | `a0347ff3b8bb587693da9ae60490dbb1366681d275cf8d1d753b99c825755679` |
| `tracked-model-v2.tap` | 12,603 | `94ca79b24990282999c7e0aeec44f499c6b6181250d4a235ce457e19c2986df6` |
| `corner-results.json` | 915,787 | `f1d277534174a765f4559eab0c8f937a592a66fc2eda1701dfd006f336e92ede` |

The held new recipe is 4,922 bytes, SHA-256
`19e8bb63b093b5e7b08566113c62e53f9e69d8f598fdbbd58413e0027e1ad135`.
Native coverage remains unobserved until a separate successful package binding
and reviewed execution.
