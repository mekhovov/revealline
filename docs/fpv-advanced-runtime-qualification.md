# Advanced runtime qualification — 2026-10-16

The reference arena v2 and Regional v1 backends pass exact replay and worker checks in Node 20/22/24, Chrome 155, Firefox 153 and WebKit 26.5 on one Apple M4 Pro host. Node 24 also passes as an x64 binary under Rosetta on that same ARM64 machine. The frozen 250 Hz configuration meets the unchanged numerical and capacity gates in every measured runtime. Advanced remains optional, unscored and ineligible for automatic promotion; this is not a physical Intel, mobile or low-end-device qualification.

The [runtime report](fpv-advanced-runtime-qualification.json) pins SHA-256 hashes for the runner, fixtures and complete simulation/worker dependency closure, and confirms unchanged sources throughout the run. The [timing report](fpv-advanced-benchmark.json) contains the Node 20 timing results from that same final run. Separate reports cover the [actual World browser host](fpv-advanced-regional-browser-smoke.json) and [verified Regional adapter capacity](fpv-regional-contact-capacity.json).

## Defects found and corrected

Expanding the initial roll-only timing test to pitch and yaw exposed a feedforward impulse whose saturation depended on physics frequency. The original 250 Hz yaw rise-time discrepancy against the coupled 2 kHz reference was 19.77%; steady-rate discrepancy was 4.16%. No candidate passed the complete gate before correction.

The v2 controller gives the target derivative an explicit `feedforwardFilterHz`, defaulting to 30 Hz independently of full-target input smoothing. Filter state participates in reset, rollback and replay. Zero disables this filter; previous v1 tunes migrate with zero to preserve their choice. Those custom unfiltered tunes are outside the default-tune qualification.

Exact replay then exposed final-bit differences from JavaScript exponentiation across V8 versions. Motor current could be `3.49410872149454` versus `3.4941087214945403`. Integer powers now use explicit ordered multiplication. Replay hashes retain full precision; the test does not hide differences behind tolerances.

Regional contact work exposed a separate initial-impact issue. At a 12 m fall, four solver iterations could penetrate a verified floor by several millimetres before settling. Regional v1 explicitly uses twelve Rapier solver iterations and a normalized allowed linear error of 0.0001 m. The exact manifest-floor test now lands within its existing 1 mm support tolerance and can recover and take off. The aircraft pose is not patched after contact. Arena v2 retains its original physics settings and golden hashes.

Internal Regional rollback snapshots now retain raw physics bytes, avoiding repeated base64 encoding at 50 Hz. Public recovery files remain JSON. Restoring a Regional snapshot checks its declared frame geometry, gravity, solver settings, mass/inertia, body type, enabled state, collision hull and collision groups against the frozen configuration before replacing the live session. Current and next poses, velocities and stored forces must be finite and bounded, and orientations must be unit quaternions. Failed validation leaves the original attempt unchanged. Recovery also recomputes consumed-input byte accounting and enforces the inner recording quota. Recorded frames reuse one immutable decoded collider per packed definition, preventing a small import from multiplying a large mesh across hundreds of frame copies.

## Measured runtimes

| Runtime              | Execution         | Arena and Regional exact agreement | 250 / 500 / 1,000 Hz numerical and capacity gates | Actual module workers              |
| -------------------- | ----------------- | ---------------------------------- | ------------------------------------------------- | ---------------------------------- |
| Node 20.19.5         | ARM64             | Pass                               | Pass                                              | Browser protocol tested separately |
| Node 22.22.2         | ARM64             | Pass                               | Pass                                              | Browser protocol tested separately |
| Node 24.21.0         | ARM64             | Pass                               | Pass                                              | Browser protocol tested separately |
| Node 24.21.0         | x64 under Rosetta | Pass                               | Pass                                              | Browser protocol tested separately |
| Chrome 155.0.8059.80 | ARM64 host        | Pass                               | Pass                                              | Pass, both backends                |
| Firefox 153.0        | ARM64 host        | Pass                               | 250 / 500 Hz pass; 1,000 Hz capacity fails        | Pass, both backends                |
| WebKit 26.5          | ARM64 host        | Pass                               | Pass                                              | Pass, both backends                |

Firefox and WebKit were installed in an isolated temporary browser directory for qualification using the existing external Playwright runtime. No repository dependency was added. WebKit is an independent engine check, not a claim that the installed Safari application was exercised. Safari Remote Automation settings were not changed. Test profiles, workers and loopback fixture servers are cleaned up.

The arena fixture executes a four-second mixed-axis trace with noise/vibration, timestamped inputs inside mission intervals and a 40 m/s collision with a 2 cm wall. It compares twenty complete-state hashes, consumed samples, telemetry and identities exactly. Full replay, verified partial recovery, snapshot continuation, reset/rerun, pause and rejected mission rollback pass. The [arena v2 golden fixture](../game/test/fixtures/fpv-advanced-runtime-v2.json) remains unchanged.

The separate Regional fixture streams three distinct collision frames, deduplicating three collider definitions across five frame events. It collides with a wall, lands, preserves contact through frame changes, takes off, and publishes a final frame after the final mission. It verifies staged-frame rollback, identical-frame no-ops, mission rollback, full replay, recovery at a simultaneous frame/hash boundary, snapshot continuation and reset. The [Regional v1 golden fixture](../game/test/fixtures/fpv-advanced-regional-v1.json) freezes those identities and hashes. Each browser also terminates a real production worker with an outstanding request, restores its paused snapshot in a new worker, and reproduces the same recorded flight exactly.

Timing uses three warmed repetitions of separate 100°/s roll, pitch and yaw steps against a coupled 2 kHz numerical reference. The strictest 250 Hz error remains **1.882%**, below the unchanged 2% threshold; yaw rise-time error is **0.080%**. All candidates block the tested thin wall without tunneling. The final Firefox 1,000 Hz yaw run reached only 1.684× real time in its slowest repetition and fails the 2× capacity gate; that failure remains in the report. Every runtime passes at the frozen 250 Hz configuration, which remains the lowest passing candidate. This reference is the same independent model at a finer timestep, not measured real-aircraft behavior. Timing includes simulation and recording; renderer and production streaming costs are measured separately rather than inferred from this small fixture.

## Actual Regional host and capacity

The [source-pinned Chrome smoke](fpv-advanced-regional-browser-smoke.json) runs the actual World host, Three renderer, verified six-cell terrain fixture and production Advanced module worker. It passes the visible Legacy → Advanced restart, accepted 20 ms missions, pause without time advancement, recording download followed by successful replay in Node, switching back to Legacy with worker termination, an active terrain landing, continued keyboard takeoff, a second contact-flight export/replay, and disposal with zero live workers. Real draw calls and terrain triangles are present. There are no page errors; the only missing request is a favicon.

The harness serves an ephemeral test response of the World page with direct fixture boot. Production HTML and access gates are unchanged. This proves this host path on Chrome, without claiming prolonged live terrain streaming, mobile rendering or native lifecycle from the smoke alone.

Separate practice-host fault tests cover missing workers, Content Security Policy blocking worker creation, unavailable WebGL and failed WebAssembly initialization. Each keeps flight and recording controls disabled, displays an explicit failure and returns to tuning with resource cleanup. These are injected host tests, not additional browser or device qualification.

The [production-adapter capacity probe](fpv-regional-contact-capacity.json) uses a real Node worker running the production worker handler, full mission admission and verified terrain. The latest ten-second runs measured **1.41× real time** for 4,096 terrain triangles and **3.88×** for 4,104 terrain/scenery triangles, including landing. The terrain run fails the unchanged 2× gate; the report preserves that failure. Shared-host CPU utilization was observed at 87–100%; after our browser/native cleanup it remained 98.36% across fourteen CPUs, so the result does not isolate simulation cost from contention. A later live-testing-readiness sample still measured 96.22% CPU utilization. No repeat was performed because a lower-contention condition had not been established. Earlier faster measurements do not replace this final-source failure. Its evidence pins the complete transitive sources and names excluded rendering/input/device costs. This production-adapter capacity gate remains incomplete and is separate from the much smaller cross-engine fixture.

The maximum-duration Regional storage test runs twelve minutes with 43,200 changing 60 Hz input samples, 360 frame events, 64 frame definitions, 65 deduplicated collider definitions, 720 verification hashes and 24 compact checkpoints. Its final measured recording is 4,983,515 bytes and the recovery envelope is 5,061,421 bytes. It exports, imports, verifies a full replay and restores both complete and partial recovery within the 8 MiB recording quota and shared recovery envelope. Sparse Regional checkpoints omit repeated static physics geometry; full recovery snapshots retain complete Rapier state and recording history. Larger or faster-changing worlds still have explicit admission budgets.

## Reproduce

Use an existing Playwright module and installed engines. The qualification runner never downloads engines itself. An isolated `PLAYWRIGHT_BROWSERS_PATH` can select temporary engine installations. Omit unavailable runtime arguments.

```sh
node --test game/test/fpv-advanced-qualification.test.mjs game/test/fpv-advanced-terrain.test.mjs game/test/fpv-advanced-terrain-storage.test.mjs
node scripts/qualify-fpv-advanced.mjs \
  --playwright /absolute/path/to/playwright/index.mjs \
  --node-runtime /absolute/path/to/another/node \
  --write docs/fpv-advanced-runtime-qualification.json
node scripts/smoke-fpv-advanced-regional.mjs \
  /absolute/path/to/playwright/index.mjs \
  docs/fpv-advanced-regional-browser-smoke.json
node scripts/fpv-regional-contact-capacity.mjs
```

The runner fails for measured mismatches, failed numerical gates, runtime errors or changed source. Unavailable engines are explicitly unmeasured. `fullPlatformMatrixQualified`, `scoredEligible` and `defaultEligible` stay false.

Remaining qualification includes physical devices on other architectures, low-end/mobile performance, real USB input, sustained rendering/streaming contention, broader Regional/native lifecycle, experienced pilots and measured real aircraft. The separate native evidence must be assessed on its own scope. None of these fixture results enables verified records or automatic promotion.
