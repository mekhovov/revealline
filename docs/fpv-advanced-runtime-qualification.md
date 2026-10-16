# Advanced runtime qualification — 2026-10-16

The **2026-10-16 final continuation refresh, completed at 03:40 UTC**, passes exact arena v2 and Regional v1 replay checks in Node 20/22/24, Chrome 155, Firefox 153 and WebKit 26.5 on one Apple M4 Pro host. Both production module-worker paths agree exactly in every browser. All measured 250, 500 and 1,000 Hz candidates pass the unchanged numerical, contact, capacity and repetition gates; the frozen 250 Hz configuration remains the lowest passing candidate. Advanced remains optional, unscored and ineligible for automatic promotion. This is not physical Intel, mobile or low-end-device qualification.

The [final continuation runtime report](fpv-advanced-runtime-qualification-2026-10-16-final.json) pins SHA-256 hashes for all twenty runner, fixture and simulation/worker dependency files and confirms unchanged sources throughout the run. It includes the current timing results. The final matrix ran once after the other task-owned browser and build jobs closed; no failed result was discarded or rerun to obtain a pass. The earlier [03:24 UTC continuation run](fpv-advanced-runtime-qualification-2026-10-16-continuation.json) also remains intact. Repeating the source-bound checks was required after explicit recording verification received a 420-second deadline, sufficient for a twelve-minute recording at the 2× gate plus setup margin; ordinary initialization and flight requests retain their ten-second deadline. Only the worker client changed among the twenty matrix source pins, and numerical behavior stayed unchanged. Existing browser engines were reused without downloads, and all test browsers, workers and loopback servers closed afterward.

The [earlier runtime report](fpv-advanced-runtime-qualification.json) and its [Node 20 timing extract](fpv-advanced-benchmark.json) remain historical evidence for their own source pins. They include the previous Firefox 1,000 Hz capacity failure and the x64 Node 24 check under Rosetta; neither is silently replaced by the continuation results. Rosetta was not rerun in this refresh. Separate reports cover the [World browser host](fpv-advanced-regional-browser-smoke.json), the [current verified Regional adapter capacity](fpv-regional-contact-capacity-2026-10-16-final.json) and its [preserved earlier failure](fpv-regional-contact-capacity.json).

## Defects found and corrected

Expanding the initial roll-only timing test to pitch and yaw exposed a feedforward impulse whose saturation depended on physics frequency. The original 250 Hz yaw rise-time discrepancy against the coupled 2 kHz reference was 19.77%; steady-rate discrepancy was 4.16%. No candidate passed the complete gate before correction.

The v2 controller gives the target derivative an explicit `feedforwardFilterHz`, defaulting to 30 Hz independently of full-target input smoothing. Filter state participates in reset, rollback and replay. Zero disables this filter; previous v1 tunes migrate with zero to preserve their choice. Those custom unfiltered tunes are outside the default-tune qualification.

Exact replay then exposed final-bit differences from JavaScript exponentiation across V8 versions. Motor current could be `3.49410872149454` versus `3.4941087214945403`. Integer powers now use explicit ordered multiplication. Replay hashes retain full precision; the test does not hide differences behind tolerances.

Regional contact work exposed a separate initial-impact issue. At a 12 m fall, four solver iterations could penetrate a verified floor by several millimetres before settling. Regional v1 explicitly uses twelve Rapier solver iterations and a normalized allowed linear error of 0.0001 m. The exact manifest-floor test now lands within its existing 1 mm support tolerance and can recover and take off. The aircraft pose is not patched after contact. Arena v2 retains its original physics settings and golden hashes.

Internal Regional rollback snapshots now retain raw physics bytes, avoiding repeated base64 encoding at 50 Hz. Public recovery files remain JSON. Restoring a Regional snapshot checks its declared frame geometry, gravity, solver settings, mass/inertia, body type, enabled state, collision hull and collision groups against the frozen configuration before replacing the live session. Current and next poses, velocities and stored forces must be finite and bounded, and orientations must be unit quaternions. Failed validation leaves the original attempt unchanged. Recovery also recomputes consumed-input byte accounting and enforces the inner recording quota. Recorded frames reuse one immutable decoded collider per packed definition, preventing a small import from multiplying a large mesh across hundreds of frame copies.

## Final continuation runtimes — 2026-10-16, 03:40 UTC

| Runtime              | Execution  | Arena and Regional exact agreement | 250 / 500 / 1,000 Hz numerical and capacity gates | Actual module workers              |
| -------------------- | ---------- | ---------------------------------- | ------------------------------------------------- | ---------------------------------- |
| Node 20.19.5         | ARM64      | Pass                               | Pass                                              | Browser protocol tested separately |
| Node 22.22.2         | ARM64      | Pass                               | Pass                                              | Browser protocol tested separately |
| Node 24.21.0         | ARM64      | Pass                               | Pass                                              | Browser protocol tested separately |
| Chrome 155.0.8059.80 | ARM64 host | Pass                               | Pass                                              | Pass, both backends                |
| Firefox 153.0        | ARM64 host | Pass                               | Pass                                              | Pass, both backends                |
| WebKit 26.5          | ARM64 host | Pass                               | Pass                                              | Pass, both backends                |

This refresh used the installed Node 22.22.2 binary as its baseline, then Node 20.19.5 and 24.21.0, followed sequentially by Chrome, cached Firefox and cached WebKit through the existing external Playwright runtime. No repository dependency was added. WebKit is an independent engine check, not a claim that the installed Safari application was exercised. Safari Remote Automation settings were not changed.

The arena fixture executes a four-second mixed-axis trace with noise/vibration, timestamped inputs inside mission intervals and a 40 m/s collision with a 2 cm wall. It compares twenty complete-state hashes, consumed samples, telemetry and identities exactly. Full replay, verified partial recovery, snapshot continuation, reset/rerun, pause and rejected mission rollback pass. The [arena v2 golden fixture](../game/test/fixtures/fpv-advanced-runtime-v2.json) remains unchanged.

The separate Regional fixture streams three distinct collision frames, deduplicating three collider definitions across five frame events. It collides with a wall, lands, preserves contact through frame changes, takes off, and publishes a final frame after the final mission. It verifies staged-frame rollback, identical-frame no-ops, mission rollback, full replay, recovery at a simultaneous frame/hash boundary, snapshot continuation and reset. The [Regional v1 golden fixture](../game/test/fixtures/fpv-advanced-regional-v1.json) freezes those identities and hashes. Each browser also terminates a real production worker with an outstanding request, restores its paused snapshot in a new worker, and reproduces the same recorded flight exactly.

Timing uses three warmed repetitions of separate 100°/s roll, pitch and yaw steps against a coupled 2 kHz numerical reference. The strictest 250 Hz error remains **1.882%**, below the unchanged 2% threshold; yaw rise-time error is **0.080%**. All candidates block the tested thin wall without tunneling. The lowest capacity at the frozen 250 Hz setting was **22.56×** in Firefox; across every candidate and runtime it was **8.98×**, also Firefox, at 1,000 Hz. The earlier Firefox 1,000 Hz yaw failure at **1.684×** remains in the historical report. Timing variability across these runs does not establish a causal speedup. Arena final hash `46294848` and Regional final hash `9d00dd70` agree across all six current runtimes and retain the existing golden behavior. The numerical reference is the same independent model at a finer timestep, not measured real-aircraft behavior. Timing includes simulation and recording; renderer and production streaming costs are measured separately rather than inferred from this small fixture.

## Actual Regional host and capacity

The separately dated [source-pinned Chrome smoke](fpv-advanced-regional-browser-smoke.json) records the actual World host, Three renderer, verified six-cell terrain fixture and production Advanced module worker. It passes the visible Legacy → Advanced restart, accepted 20 ms missions, pause without time advancement, recording download followed by successful replay in Node, switching back to Legacy with worker termination, an active terrain landing, continued keyboard takeoff, a second contact-flight export/replay, and disposal with zero live workers. Real draw calls and terrain triangles are present. There are no page errors; the only missing request is a favicon. That host smoke covers its own recorded source pins and was not rerun as part of this numeric continuation matrix.

The harness serves an ephemeral test response of the World page with direct fixture boot. Production HTML and access gates are unchanged. This proves this host path on Chrome, without claiming prolonged live terrain streaming, mobile rendering or native lifecycle from the smoke alone.

Separate practice-host fault tests cover missing workers, Content Security Policy blocking worker creation, unavailable WebGL and failed WebAssembly initialization. Each keeps flight and recording controls disabled, displays an explicit failure and returns to tuning with resource cleanup. These are injected host tests, not additional browser or device qualification.

The [2026-10-16 final continuation capacity probe](fpv-regional-contact-capacity-2026-10-16-final.json), completed at 03:40 UTC, uses a real Node worker running the production handler, full mission admission and verified terrain. The two ten-second flights measured **5.497× real time** for 4,096 terrain triangles and **9.653×** for 4,104 terrain/scenery triangles. Both landed with real contacts and exported recording and recovery data. All 45 transitive source pins remained unchanged. The host now checks the same exact swept-cell coverage and geometry-owner readiness while leaving contact resolution to the worker's already installed verified colliders; it no longer repeats host-side collision casts whose hit result was already accepted. Complete mission rollback remains required for unavailable geometry or failed coverage checks.

This was one measured run per profile after task-owned browser jobs closed, with CPU counters and memory observations captured across each loop. Mean host CPU utilization was still **98.90%** for terrain and **93.80%** for mixed geometry. The terrain interval p95 was 9.67 ms and its maximum was 37.85 ms; the mixed interval p95 was 5.16 ms and maximum 10.60 ms. The current result passes the unchanged 2× gate for this bounded single-host fixture, without qualifying frame-time stability, dense scenes, sustained streaming, or other devices. Shared load and warm-up prevent attributing the full timing difference to the removed casts.

The [earlier capacity report](fpv-regional-contact-capacity.json) remains unchanged: **1.41×** terrain failed and **3.88×** mixed passed amid severe host contention. It is historical evidence for the previous source pins, not a failure that was erased or repeatedly retried. The [03:21 UTC continuation capacity report](fpv-regional-contact-capacity-2026-10-16-coverage.json), which measured 3.216× and 10.501× before the worker-deadline source change, is also preserved. The final rerun was performed once to refresh those source pins, not to replace a failed result. All adapter reports remain separate from the much smaller cross-engine fixture and explicitly exclude renderer and physical-input costs.

The maximum-duration Regional storage test runs twelve minutes with 43,200 changing 60 Hz input samples, 360 frame events, 64 frame definitions, 65 deduplicated collider definitions, 720 verification hashes and 24 compact checkpoints. The continuation run with derived comparison metadata measured a 4,983,692-byte recording and a 5,061,598-byte recovery envelope. It exports, imports, verifies a full replay and restores both complete and partial recovery within the 8 MiB recording quota and shared recovery envelope. Sparse Regional checkpoints omit repeated static physics geometry; full recovery snapshots retain complete Rapier state and recording history. Larger or faster-changing worlds still have explicit admission budgets.

## Reproduce

Use an existing Playwright module and installed engines. The qualification runner never downloads engines itself. An isolated `PLAYWRIGHT_BROWSERS_PATH` can select temporary engine installations. Omit unavailable runtime arguments.

```sh
node --test game/test/fpv-advanced-qualification.test.mjs game/test/fpv-advanced-terrain.test.mjs game/test/fpv-advanced-terrain-storage.test.mjs
node scripts/qualify-fpv-advanced.mjs \
  --playwright /absolute/path/to/playwright/index.mjs \
  --node-runtime /absolute/path/to/another/node \
  --write /tmp/fpv-advanced-runtime-qualification-new-run.json
node scripts/smoke-fpv-advanced-regional.mjs \
  /absolute/path/to/playwright/index.mjs \
  docs/fpv-advanced-regional-browser-smoke.json
node scripts/fpv-regional-contact-capacity.mjs /tmp/fpv-regional-contact-capacity-new-run.json
```

The runner fails for measured mismatches, failed numerical gates, runtime errors or changed source. Unavailable engines are explicitly unmeasured. `fullPlatformMatrixQualified`, `scoredEligible` and `defaultEligible` stay false.

Remaining qualification includes physical devices on other architectures, low-end/mobile performance, sustained rendering/streaming contention and broader Regional/native lifecycle. The user has deferred real USB input, experienced-pilot assessment and measured real-aircraft validation; those pending physical checks do not block the available software work. The separate native evidence must be assessed on its own scope. None of these fixture results enables verified records or automatic promotion.
