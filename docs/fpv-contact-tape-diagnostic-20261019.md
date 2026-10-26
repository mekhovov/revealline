# Minimized Rapier contact replay — 19 October 2026

The Firefox slowdown reproduces when the browser runs only pinned Rapier and a frozen force tape. The controller, aircraft model, game logic, worker protocol and terrain streaming are absent from the browser replay. All 1,000 post-step world digests and unrounded body observations match the original fixture in Node, Chrome and Firefox.

This is a contact-solver diagnostic, not a flight simulation or a replacement for the [failed qualification](fpv-v3-browser-qualification-20261019.md). R9 remains open. No production source, dependency, solver setting, browser protection, package admission or acceptance gate changed. Nothing was submitted upstream.

## Fixture boundary and exactness

The test-only capture uses the same Cetus X Acro zero-throttle floor fixture as the [earlier investigation](fpv-v3-firefox-solver-investigation-20261019.md), with official `@dimforge/rapier3d-compat` 0.21.0, v3 and the unchanged 1,000 Hz step. The untouched and intercepted original fixtures have identical final simulator hash `44a47ba9` and final telemetry.

After substep 500, capture retains one 23,375-byte Rapier snapshot, including existing contact state. For substeps 501–1500 it retains the exact ordered `resetForces`, `resetTorques`, `addForce` and `addTorque` arguments, their body handle and wake flags. Each post-step snapshot is hashed with SHA-256 and immediately discarded; complete snapshots are not accumulated. Body positions, quaternion, linear/angular velocities, enabled state and sleeping state are retained without rounding.

Replay restores the checkpoint, verifies its world digest and body/contact observations, then applies the recorded operations. It compares every subsequent world digest and body observation with the source fixture and stops at the first difference. No body transform is copied back to hide divergence. The frozen force values are inputs from the original trajectory; there is no controller adapting to a different trajectory. Unknown or missing operation order, malformed arguments, changed handles and changed checkpoints are rejected.

The checkpoint and final contact observations are one active body, 11 colliders, five pairs, ten manifolds and 40 geometric contact points. The serialized world retains the original solver settings, including 12 solver iterations, one internal PGS iteration and four maximum CCD substeps. The native profiler remains disabled.

## Retained run

The [report](fpv-contact-tape-diagnostic-20261019.json) pins all 41 capture/diagnostic source files, records their unchanged hashes after the run, and inventories the four browser responses: the pinned vendor module, pure replay helper, tape and autonomous HTML page. The [compressed tape](evidence/fpv-contact-tape-20261019.json.gz) is 194,878 bytes; its compressed and decompressed hashes are in the report.

The run lasted 01:00:56–01:01:03 UTC on the Apple M4 Pro ARM64 host. Both browsers used fresh disposable headless contexts, normal installed-engine launch options and an autonomous local page. No automation call invoked the physics loop. All owned browsers and the local server closed afterward; no downloads or user profile changes occurred.

| Engine                             | Sum of 1,000 `World.step` intervals | Matching post-step world/body observations |
| ---------------------------------- | ----------------------------------: | -----------------------------------------: |
| Node 22.22.2                       |                            78.49 ms |                              1,000 / 1,000 |
| Chrome 155.0.8059.85, repetition 0 |                           116.90 ms |                              1,000 / 1,000 |
| Chrome 155.0.8059.85, repetition 1 |                            80.60 ms |                              1,000 / 1,000 |
| Firefox 153.0, repetition 0        |                            1,073 ms |                              1,000 / 1,000 |
| Firefox 153.0, repetition 1        |                            1,064 ms |                              1,000 / 1,000 |

Every case finishes with world SHA-256 `d0fb6c91f8bf6ca8b5243c3814ee79fcad8a464469fc2779ae415b6b1a64b279`. This is the Rapier world digest, not the simulator's full configuration/controller hash.

Snapshot serialization, hashing, force application and contact inspection are outside the timed `World.step` intervals. They still affect scheduling and caches; browser hashing awaits a digest between steps. Timers have each engine's normal resolution and include scheduling delays. Aggregate host busy measurements span replay plus validation, approximately 67–68% for Chrome and 31–33% for Firefox; they do not establish exclusive CPU use. Node's host busy value was not measured. Repetitions are ordered fresh-world runs, not cold/warm JIT guarantees. The result does not identify a compiler defect or predict performance on other devices.

## Reproduction and checks

Run `node --test scripts/test-fpv-contact-tape.mjs` for the five passing checks: exact repeat replay, failure at the exact changed-force step, malformed operation rejection, changed checkpoint/contact rejection, and restoration of intercepted methods after capture failure. Scoped lint, formatting and whitespace checks also pass.

To recapture and run the browser diagnostic, use:

```sh
node scripts/profile-fpv-contact-tape.mjs <installed-playwright-module> <new-report.json> <new-tape.json.gz>
```

Outputs must be new paths. The runner will not start browser replay unless Node equivalence passes. The minimal replay itself needs only `game/test/helpers/fpv-contact-tape.mjs`, the exact pinned vendor module and the decompressed tape; import `replayContactTape` and pass the parsed tape. This is a useful local boundary for preparing a future upstream issue, while preserving the existing performance-unqualified status.
