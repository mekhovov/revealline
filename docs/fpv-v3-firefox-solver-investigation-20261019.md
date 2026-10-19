# v3 Firefox solver investigation — 19 October 2026

Firefox's measured bottleneck is Rapier's **velocity-constraint resolution during sustained ground contact**. The same slowdown occurs without browser automation attached. No safe optimization preserving the existing trajectory and identity has been demonstrated, and no production source, physics setting, browser protection, dependency or acceptance gate was changed.

The [original qualification failure](fpv-v3-browser-qualification-20261019-attempt-1.json) remains authoritative: minimum Firefox landing capacity **0.88968×**, minimum worker-protocol capacity **1.46119×**, against the unchanged **2×** gate. These narrower diagnostics do not replace that result or qualify Firefox, scored flights or default rollout.

## Evidence and scope

All runs use the same frozen v3/1,000 Hz sources as the original matrix. Its complete 36-file dependency closure was independently compared with `/private/tmp/fpv-practice-ghost-20261018` before this investigation: zero hash differences. The isolated investigation branch descends from `152198b84`; it does not edit the canonical branch.

| Evidence                                                                                    | Scope                                                                                                                           | Result                                                                                                       |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [Native solver profile](fpv-v3-solver-profile-20261019.json)                                | Firefox 153.0 and Chrome 155.0.8059.85, two fixtures, profiler off/on, two fresh-world repetitions                              | All 16 cases retain exact final hashes and complete final telemetry; all 41 captured source hashes unchanged |
| [Automation control](fpv-v3-firefox-automation-control-20261019.json)                       | Same installed Firefox executable, autonomous local page, unattached disposable profile versus normal Playwright launch/context | All 16 cases retain exact final hashes and complete final telemetry; all 43 captured source hashes unchanged |
| [Initial diagnostic startup failure](fpv-v3-solver-profile-20261019-bootstrap-timeout.json) | Native floor counters succeeded; diagnostic worker initialization timed out in both engines                                     | Preserved as a harness failure, not a production worker failure                                              |

The native profile ran at 00:37:55–00:38:08 UTC; the automation control at 00:40:04–00:40:27 UTC. Both ran on the existing Apple M4 Pro ARM64 host. All test browsers, workers and local servers closed. The unattached browser's disposable profile was removed after its process exited. No dependency download, full build, public tab or user browser storage was involved.

The retained timeout's exact [runner](fpv-v3-solver-profile-20261019-bootstrap-timeout-runner.txt) and [helper](fpv-v3-solver-profile-20261019-bootstrap-timeout-helper.txt) explain its source pins. The diagnostic bootstrap awaited profiler initialization before registering its production message handler, so an early initialization message was not buffered. The corrected test bootstrap buffers messages until instrumentation is ready, then dispatches them to the unchanged production handler. The complete subsequent run is separately retained; no failed evidence was overwritten.

## What was measured

The test wrappers forward the same receiver, arguments, return values and errors. They measure the public `World.step`, the underlying raw physics call and the JavaScript post-step object mapping. Labeled native-profile cases enable the pinned library's existing `profilerEnabled` switch and read its timing counters. Rapier documents `timingVelocityResolution` as milliseconds spent resolving constraints, included within solver time; these are overlapping inclusive intervals, not additive exclusive CPU samples. [Rapier API](https://rapier.rs/javascript3d/classes/World.html#timingvelocityresolution)

The floor case is the original **Cetus X Acro** zero-throttle drop: 75 missions, 1.5 simulated seconds, final hash `44a47ba9`. The worker case is the original **Meteor75 self-level** input sequence: 80 missions, 1.6 simulated seconds, including the midpoint snapshot, final hash `42fc00f7`. Initialization is reported separately and excluded from stepping capacity. Native-counter collection and read-only contact inspection add diagnostic overhead; it is not subtracted.

| Native profiled fixture                | Total native step |  Velocity resolution | Collision detection | JavaScript post-step mapping |
| -------------------------------------- | ----------------: | -------------------: | ------------------: | ---------------------------: |
| Firefox Cetus floor, repetitions 0/1   |  1,107 / 1,112 ms | **1,058 / 1,069 ms** |          18 / 15 ms |                    7 / 11 ms |
| Chrome Cetus floor, repetitions 0/1    |    81.7 / 78.0 ms |       73.9 / 71.7 ms |        2.2 / 1.6 ms |                 2.6 / 2.1 ms |
| Firefox Meteor worker, repetitions 0/1 |      550 / 558 ms |     **492 / 501 ms** |          34 / 28 ms |                    9 / 10 ms |
| Chrome Meteor worker, repetitions 0/1  |    40.8 / 41.0 ms |       32.9 / 32.9 ms |        3.9 / 3.9 ms |                 2.7 / 2.8 ms |

The native call accounts for nearly all of `World.step`; its internal velocity-resolution counter accounts for about 96% of Firefox's native floor time. JavaScript mapping and JS-to-WASM call plumbing are small. These measurements do **not** isolate machine instructions or distinguish all operating-system scheduling from computation inside the measured interval.

Per-100-substep observations locate the change at contact: the first 400 airborne substeps are cheap; the 400–500 interval contains impact; sustained contact thereafter costs roughly 100–119 ms per 100 substeps in the retained initial profile. This timing pattern persists across fresh worlds and with initialization excluded. Repetition 0/1 is an ordered fresh-world comparison, not proof that a specific JIT tier is cold or warm.

## Workload and fixed settings

Read-only observations record the actual solver values, rather than assuming library defaults:

| Setting                 | Observed value                          |
| ----------------------- | --------------------------------------- |
| Time step               | float32 representation of 0.001 seconds |
| Length unit             | 1                                       |
| Allowed linear error    | float32 representation of 0.0001 metres |
| Prediction distance     | float32 representation of 0.02 metres   |
| Solver iterations       | 12                                      |
| Internal PGS iterations | 1                                       |
| Maximum CCD substeps    | 4                                       |
| Contact ERP             | 0.00933678075671196                     |

Each fixture has one body, observed active throughout. The Cetus floor world has **11 colliders**: one cuboid and four cylinder hull pieces, plus six boundary triangle meshes, each with 8 vertices and 12 triangles. After contact, its sampled public narrow-phase state contains **5 pairs, 10 manifolds and 40 geometric contact points**. Meteor's arena has **6 colliders**, including the same five-part hull and its half-space floor; sustained contact exposes **5 pairs, 5 manifolds and 20 geometric points**.

The pinned public API does not expose the number of islands, so the report records `islandCount: null` with an availability explanation. It also retains the public post-step `numSolverContacts` observations verbatim: zero for the terrain case, 20 during Meteor's settled contact. A zero post-step count is not evidence that the step performed no constraint work; the native resolution counter measures that work. Contact-point counts are not asserted to equal the internal number of solver iterations or constraints. The write-only contact natural-frequency field is unavailable through these read-only getters and is not inferred.

This is a small world, and its measured broad/narrow-phase time is minor. Reducing the total terrain triangle count without reducing the contact-constraint workload is therefore not an evidenced fix for this case.

## Automation and load controls

The control uses the same installed Firefox binary and the same autonomous page in both treatments. The unattached process starts headlessly with a new disposable profile and **no preference edits**. It posts its own results to the local server. The attached treatment uses Playwright's normal fresh launch/context, also without `page.evaluate` invoking the physics workload. The executable version and SHA-256 are recorded.

| Firefox treatment, native profiler off | Cetus floor repetitions 0/1 | Meteor worker repetitions 0/1 |
| -------------------------------------- | --------------------------: | ----------------------------: |
| Unattached process                     |         **1.154× / 1.184×** |               2.139× / 2.116× |
| Playwright-attached autonomous page    |         **1.157× / 1.242×** |               2.339× / 2.329× |

Automation attachment is **not a necessary cause** of the reproduced floor slowdown. This comparison does not identify a compiler tier or isolate individual Playwright launch preferences, and no browser security or JIT preference was changed to improve a result.

Host CPU use was measured over each case. Earlier retained diagnostic floor cases still failed the 2× gate at approximately 27–46% aggregate host busy time, versus the higher contention seen in the original matrix. The complete native-profile run and automation control also retain their own per-case load and busy measurements. Aggregate CPU use cannot establish which core was scheduled, thermal state, or exclusive execution. Lower contention and the worker's improved diagnostic capacity do not erase the original failed workload or establish a causal speedup.

## Engineering decision

There is no demonstrated narrow JavaScript change that can preserve the existing simulation and recover the floor gate: even removing the measured JavaScript mapping and collision-detection time entirely would leave velocity resolution alone above the 750 ms budget for a 1.5-second flight at 2× capacity.

The useful next investigation boundary is Rapier/WebAssembly constraint resolution for this small multi-collider contact workload. An upstream engine profile or minimized solver reproducer could determine whether generated WebAssembly code or the constraint implementation explains the cross-engine gap. That is more targeted than tuning broad-phase structures, worker message batching or snapshots. These results do not identify a particular Firefox compiler defect.

A future **versioned** experiment could compare an aircraft contact hull or coplanar terrain representation that generates fewer redundant manifolds. That would change collision behavior, potentially exact trajectories, serialized world state and simulation identity; it is not a safe drop-in optimization. It would need explicit review plus the full contact, accuracy, replay and cross-engine gates, including fresh failures as well as successes. Lowering iterations, disabling CCD or sleeping a grounded aircraft was not attempted and must not be treated as an optimization of this frozen backend.

For current delivery, retain Firefox's explicit performance-unqualified status and the optional experimental scope. This single-headless-host evidence is not a basis for claiming all Firefox devices fail, nor for enabling scoring or default promotion on an untested platform.
