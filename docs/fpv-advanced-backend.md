# Experimental Advanced FPV backend

Advanced reference practice is explicitly unscored and does not become the default flight model. Existing Academy, World and Regional flight identities remain separate. The reference arena is a place to test portable rates and independent aircraft/controller settings while the broader qualification work remains open.

The Academy and World hosts can open the reference arena from tuning. Regional also offers an explicit **Try Advanced here · restart** action using the real streaming host, renderer and verified terrain. It starts two metres above the selected point in Acro mode and remains unscored. Its worker resolves ground/roof landings, takeoff and wall collisions against exact verified meshes. Missing terrain and region boundaries still roll back the complete mission interval. Advanced does not replace Academy lessons or scored World missions, and contact behavior is not yet calibrated against real aircraft.

## Current delivery evidence — 2026-10-17

The [moving Urban qualification](fpv-regional-urban-streaming-qualification.md)
raises the collider admission ceiling from 64 to 128 so the unchanged authored
region can start and stream its 27–124-collider windows. The derived total recorded
collider-definition ceiling also rises from 32,768 to 65,536. Geometry, byte,
frame-count and event-count limits, backend identities and 250 Hz timing remain
unchanged; no geometry is discarded. Three
120-second routes reach the largest window and pass the 2× gate at
**15.093–15.740×**, with exact replay of each recording. Separate injections verify
complete rejection/adoption rollback and recovery. These measurements include
the real host/worker loop, automatic streaming, admission and recording on one
Apple host; they exclude rendering, network transfer and hardware input. They
do not establish arbitrary-region or maximum-duration dense performance. Earlier
64-collider rejection and unpaced-probe failures remain preserved.

The [historical update check](fpv-historical-update-qualification.md) found that
both hosts captured default camera values before restoring older preferences.
Migration now restores the saved camera first and preserves an existing tuning
library's authority. Academy and World pass the actual pre-tuning-main update
and subsequent offline process restarts. The [current native report](fpv-native-current-runtime-20261017.json)
separately verifies final-source Electron library/camera persistence, a 290-tick
Regional recording with exact replay, native export and complete worker cleanup.
Its 204 source pins and ordinary desktop/iOS staging pass; iOS execution and the
wider physical-device matrix remain open.

All 701 practice tests, 44 integration tests and release validation pass. The
[preserved CI failures](fpv-delivery-ci-initial-failure.json) led to narrow fixes
for missing pinned test dependencies, canonical native-bridge import admission,
the sparse publisher dependency list and stale test timing/envelope assumptions.
No test or source-closure check is disabled. Current [Pages validation](fpv-pages-delivery-live-testing-evidence.json)
passes; the [public baseline](fpv-public-delivery-baseline.json) verifies normal
password access to the old-main SIM pages and retains offline installations for
the upgrade. The fresh [six-runtime numerical matrix](fpv-advanced-runtime-qualification-2026-10-17-eighth-review.json)
passes all 250/500/1,000 Hz gates with 20 matching source pins and identical arena
and Regional hashes. Frozen 250 Hz has a maximum response-metric error of 1.8814%
and minimum capacity of 60× on one Apple M4 Pro; headless timing excludes
rendering and production streaming. Exact committed CI, main publication and
public upgrade acceptance remain pending.
Earlier timing reports below remain historical evidence for their pinned sources;
Advanced remains optional, unscored and ineligible as the default.

## Implemented boundary

- `advanced-controller.mjs`: replaceable independent PID/feedforward controller; capabilities, initialization, reset, stepping, telemetry and complete snapshot/restore. It consumes calibrated controls, externally evaluated rate targets and the current body sensor sample. The mixer desaturates all four motors and applies back-calculation anti-windup. Its SI gains are not Betaflight PID values.
- `advanced-simulation.mjs`: pinned Rapier 0.21 body dynamics, motor response, per-motor thrust/reaction torque, mass/inertia, drag, battery depletion/sag, bounded motor output, deterministic noise, gyro/D-term filters and optional input smoothing. Each substep couples controller, motors and body. Whoop, freestyle and racing templates are editable reference starting points, not measured copies of particular real aircraft.
- `advanced-worker.mjs` and `advanced-worker-client.mjs`: dedicated worker ownership, serial requests, session/request IDs, stale-result isolation, deadlines and termination. An isolated `verify-recording` request publishes a compact comparison path only after complete replay verification and a comparison-class check against the initialized worker's frozen configuration. Input polling stays in the window. Rendering and 50 Hz mission work are independent of the fixed physics frequency.
- `advanced-practice.mjs`: first-person reference arena with physical gates; keyboard, touch and calibrated-radio input; explicit start/pause/restart; blur/visibility pause; EN/UK labels; numeric aircraft/controller edits; save for next flight; configuration/recording export; verified comparison ghosts; and timed manual practice cues. Editing, saving or reverting a draft does not change the running worker's frozen configuration.
- `advanced-terrain.mjs`: bounded, canonical collision frames; stable collider ordering; packed geometry; deduplicated recording history; complete identity and history validation. Only verified physical meshes are transferred; visual-only foliage is excluded.
- `advanced-regional.mjs`: real Regional host adapter with complete trace admission, streamed terrain presentation, frame-change/mission serialization, generation guards, exact region/start recovery, and recording/recovery export. Contacts resolve in the worker. Unavailable terrain and region-edge motion reject the entire worker interval. Recovery validates in a separate worker before swapping the active session.

The rate evaluator is supplied by the portable rate-profile engine. It is applied once. Controller capabilities distinguish curve compatibility, input-response compatibility and controller compatibility so a future firmware-owned RC implementation can replace this controller without double shaping.

## Historical timing evidence

`node scripts/qualify-fpv-advanced.mjs` compares coupled 250, 500 and 1,000 Hz runs to a 2,000 Hz numerical reference on all three axes. `docs/fpv-advanced-runtime-qualification.json` records source hashes, runtime versions, timing results and untested engines. That report, `docs/fpv-advanced-benchmark.json` and the [earlier continuation report](fpv-advanced-runtime-qualification-2026-10-16-continuation.json) are retained evidence for their pinned earlier sources. The [final dated report](fpv-advanced-runtime-qualification-2026-10-16-final.json) refreshes the source checks after the comparison protocol, terrain-admission and verification-deadline changes. The final repeat was needed to bind the evidence to the changed worker client; it does not establish a causal performance improvement. The benchmark uses the all-axis v2 timing fixture and three warmed repetitions, superseding the original roll-only evidence. Scenarios include a 100°/s step, steady rate, rise time, peak response, integrated absolute error and a 40 m/s collision with a 2 cm wall.

The newer [second-review report](fpv-advanced-runtime-qualification-2026-10-16-second-review.json) binds the imported-recovery verification changes. Exact arena/Regional replay and both browser worker paths still pass in all six measured runtimes. Frozen 250 Hz passes every gate, with a lowest capacity of 7.092×; Firefox's optional 1,000 Hz candidate fails capacity at 1.602× and is retained without retry. The [second-review adapter probe](fpv-regional-contact-capacity-2026-10-16-second-review.json) measures 5.508× terrain and 6.339× mixed capacity with unchanged sources. These reports supersede earlier source bindings without removing historical results or changing the physics model or rollout gates.

The expanded check found that instantaneous feedforward derivatives saturated yaw differently at different physics frequencies. The v2 controller adds an explicit feedforward filter, defaulting to 30 Hz, and snapshots its complete state. Older v1 tunes migrate with the filter off to preserve that explicit choice; v1 Advanced recordings are rejected under the changed backend identity. Legacy recordings are unaffected.

With that correction, 250 Hz was the lowest locally passing all-axis candidate (maximum measured response-metric difference below 1.9%, no tested wall tunneling, and more than twice real-time capacity). Frequency remains frozen in the backend identity and never follows graphics quality. The evidence covers one Apple M4 Pro ARM64 machine, not a device matrix or measured real-aircraft fidelity. Contact obstruction is compared; identical bounce trajectories across integration frequencies are not claimed.

The [runtime qualification notes](fpv-advanced-runtime-qualification.md) distinguish the historical seven-runtime run from the current six-runtime refresh. The earlier sources were checked in Node 20.19.5, 22.22.2 and 24.21.0 on ARM64, Node 24.21.0 on x64 under Rosetta, Chrome 155, Firefox 153 and WebKit 26.5. All passed capacity at the selected 250 Hz; the historical Firefox 1,000 Hz yaw measurement missed the 2× margin at 1.684×. The final dated refresh passes all three candidates in Node 20/22/24 ARM64 and Chrome/Firefox/WebKit, with exact arena/Regional replay agreement and module-worker agreement in all three browser engines. Minimum capacity at the frozen 250 Hz is 22.56× in Firefox. Sources remained unchanged during that run. The x64 emulator result is historical and was not repeated for the continuation or final refresh.

The earlier V8 comparison exposed engine-dependent rounding of `speed ** 3`; v2 uses ordered multiplication for integer powers. All these measurements use the same physical Apple M4 Pro machine. Physical Intel, mobile, low-end devices and Safari application behavior remain unqualified. Headless timing excludes rendering, production world streaming and physical USB sampling; neither the current nor historical matrix establishes real-aircraft fidelity.

The earlier production Regional adapter attempt measured 1.41× real time against the 2× requirement for terrain and 3.88× for mixed terrain/scenery under severe shared-host CPU contention. Its failed source-pinned report and the later [passing coverage probe](fpv-regional-contact-capacity-2026-10-16-coverage.json) are preserved. The [final production-adapter probe](fpv-regional-contact-capacity-2026-10-16-final.json) refreshes the worker-client source binding after the verification-deadline change. It measures 5.497× for the 4,096-triangle terrain fixture and 9.653× for the 4,104-triangle mixed fixture, including landed contacts, recording and recovery. Sources stayed unchanged during the run; mean host CPU occupancy was 98.90% and 93.80%, respectively. These results pass the bounded single-host fixtures without establishing the cause of the timing differences or qualifying arbitrary Regional scenes, devices or the wider rollout.

## Inputs, transactions and recovery

The [third-review runtime report](fpv-advanced-runtime-qualification-2026-10-16-third-review.json)
refreshes all six runtime/source checks after the replay-consumption validator
change. The [World/Regional check](fpv-advanced-regional-browser-smoke-2026-10-16-third-review.json)
also rechecks recovery, cancellation and disposal. Backend identities, simulation
frequency and both golden traces remain unchanged. Earlier timing and native
runtime evidence stays bound to its original sources.

Replay validates consumption indices against the mission-admission boundary and
the first substep permitted by each timestamp. This catches inconsistent event
times that final physics hashes can miss, while accepting late samples at a
mission boundary and future samples at their eligible substep. It verifies a
declared history's consistency, not authenticity of a physical input stream.

Input samples contain monotonically increasing sequence IDs, normalized calibrated controls and integer microsecond availability timestamps in the simulation's session clock. The main thread assigns the effective availability time; physics consumes the latest available sample at each substep and records exactly that sequence. It never claims fresh hardware input at 250 Hz.

The practice display separately labels the consumed sample's age in simulation time, the measured age of the main-thread browser poll, and the observed browser polling interval. Actual device hardware cadence is unavailable. A worker pause does not fabricate additional samples or advance simulation time.

`stepMission({admitMotion})` stages a complete 20 ms interval and offers its full positional trace to a synchronous admission callback. Only a boolean result is accepted; a Promise never silently approves motion. Rejection or a thrown terrain-availability error restores Rapier state, controller/filter state, motors, battery, noise sequence, input queue/cursors and recorder lengths. The asynchronous Regional adapter uses `proposeMission()` and `commitMission({transaction,accepted})` across worker messages and checks every trace segment against verified coverage and bounds before committing. Actual contact is allowed after Rapier resolves it. Terrain frame publication is serialized with the pending mission; a stale operation cannot restore over a newer session.

Advanced uses the trusted terrain owner's `motionCoverage()` query for that admission check. It retains exact swept-volume/cell readiness across every substep, along with the existing bounds checks. It does not repeat a main-thread collision cast against contacts already resolved by the worker. A `motion-covered` result means the complete swept volume is available, not that motion is contact-free; unknown cells still reject the interval. Legacy `castMotion()` and support-ray collision behavior are unchanged.

`stageTerrainFrame()` and `commitTerrainFrame()` couple worker collider adoption to verified source publication. A cancelled or failed source adoption restores the complete previous worker state and recording. Retained colliders keep their stable handles across frames; removed colliders are released. A worker failure after source publication leaves the host paused and unable to resume with mismatched geometry. Prepared geometry is copied from verified compiled collision data, independently of mutable renderer objects.

Regional has a separate `civilian-quad-advanced-regional.v1` identity. Its solver uses 12 iterations and the pinned Rapier API's `normalizedAllowedLinearError` of 0.0001 m at the default length scale. This keeps the tested initial landing penetration within the existing 1 mm vertical admission tolerance; the reference arena's v2 solver and golden replay remain unchanged. There is no position clamp or invented bounce. The complete restored world is checked against the frozen body, collider and solver configuration before adoption.

Full snapshots include the complete hidden state and recording history and can restore a paused session. Portable recordings contain immutable initial configuration, compact consumed-input events (unchanged values omit the four controls), per-second verification hashes, a final verification hash and sparse checkpoints every 30 seconds. Arena checkpoints retain complete physics/controller state. Regional checkpoints retain compact verified references; its recordings additionally contain a deduplicated packed collider dictionary, canonical frame definitions and ordered frame-change events. Its complete simulation identity includes that terrain history. Replay and partial recovery verify by replaying from the initial configuration; imported checkpoints are not blindly trusted as verified history. Recovery between verification boundaries continues to the next periodic or final hash before returning the requested earlier state. Results identify whether verification covers the complete recording or only a prefix, and the verified mission boundary. Hashes are local integrity checks, not cryptographic anti-cheat signatures.

Imported full recovery files also replay the complete consumed-input and terrain history before adoption. `verifyAdvancedRecovery()` validates a detached candidate, verifies its recording, and compares the complete Rapier snapshot plus controller, motor, battery, input and terrain state with the replayed result. Finite but inconsistent dynamics are rejected; future queued samples remain separately bounded and ordered and are preserved. The worker's `restore` request always uses this verification. Synchronous `simulation.restore()` remains a structural restore for trusted in-process snapshots and verified replay results; it is not the user-file boundary and does not add replay work to mission rollback. A detached recovery worker has the same bounded seven-minute verification allowance as comparison import. **Cancel recovery verification**, leaving the flight, or worker failure prevents adoption and releases the worker; the existing paused attempt remains available. The separate terrain publication transaction still completes or rolls back before another attempt can resume.

`replayAdvancedRecording()` optionally returns detached initial and mission-boundary telemetry with `includeTelemetry: true`, labeled `telemetryHz: 50`. Its optional `onMissionTelemetry` callback receives detached samples at tick zero and each requested mission boundary without retaining a full telemetry array. Callback samples are provisional until replay finishes successfully; consumers must discard their collection on failure. Mutating them cannot change the simulation. The comparison worker publishes its compact position/orientation path only after complete verification succeeds. These diagnostic samples describe mission boundaries, not the physics frequency or hardware input cadence.

The limit is 12 minutes. Input events have a 6 MiB admission budget, and a second combined budget accounts for configuration, checkpoint bytes and verification overhead within the 8 MiB exported-recording limit. Exceeding either budget rejects the entire mission interval and reports an error. The full-duration test uses changing 60 Hz input: 43,200 consumed events, 720 periodic hashes and 24 checkpoints, then exports, imports, verifies and restores a partial flight within the quota. This does not promise unlimited-rate device streams or unlimited scene geometry within that quota.

The Regional full-duration test also changes terrain 360 times across 64 definitions, sharing a 512-triangle surface. It records 65 unique collider payloads, uses 4,983,692 bytes for the recording and 5,061,598 bytes for recovery, and verifies complete replay and restored continuation. A terrain frame has a 2 MiB JSON admission budget; accumulated geometry shares the recording's 8 MiB budget. Regional snapshots are capped at 24 MiB and the complete recovery file at 24 MiB + 64 KiB. The host uses the same exported limit as the worker. Larger scenery windows remain subject to explicit capacity rejection.

## Unscored reference comparison

The arena accepts a bounded JSON recording up to 8 MiB through **Import comparison recording**, or captures the current attempt with **Keep this practice as reference**. A disposable worker initializes with the active flight's frozen configuration and replays the candidate using the candidate's own immutable settings. Only a fully verified arena recording with the same derived comparison class becomes the selected reference. A failed, oversized or cancelled import preserves the previous reference. Cancellation, timeout and leaving practice terminate the verification worker.

Verification alone has a seven-minute deadline: a complete twelve-minute flight
at the minimum 2× capacity plus one minute of margin. Initialization and normal
flight requests retain their ten-second deadline. The editor remains responsive
and verification can be cancelled; increasing the replay allowance does not hide
a stalled active flight.

The cyan ghost displays the verified 50 Hz position/orientation path at the live mission tick and holds its final pose after the reference ends. It has no collision body, no score and no second live physics loop. Changing aircraft, controller, throttle or environment settings can hide an incompatible reference; restoring the matching setup makes it available again. Personal rotation rates may differ. Regional ghosts and mission-sector comparisons are not enabled by this arena workflow.

**Repeatable practice** offers hover/land, yaw turn/stop and throttle-pulse cues on the simulation clock. Players follow the cues manually and restart from the same launch point, then keep a reference or return to tuning to compare and save or revert the rate draft. **Revert aircraft draft** restores the last saved aircraft/controller values in the editor; an explicit restart is required to apply them. The cues neither automate controls nor grade flight performance.

## Identity and rollout

Simulation identity includes effective rates, throttle, aircraft/controller parameters, physics frequency and environment. Cosmetic camera settings and aircraft labels do not affect the physical model. `simulation.comparison()`, exported recordings and snapshot recordings expose derived `AdvancedComparison.v1` metadata: `simulationIdentity`, `comparisonClass`, `terrainIdentity` (null for the arena), and `scored: false`. Existing recording integrity identities remain unchanged. Regional simulation identity still includes configuration and recorded terrain history. Older recordings without comparison metadata remain accepted; supplied metadata must match the values recomputed from the actual frozen configuration and history.

The comparison class excludes personal rotational rates and cosmetic profile/setup labels while retaining throttle/performance limits, aircraft/controller, backend/timing and environment, including Regional terrain history. The arena worker compares these derived classes rather than trusting an imported eligibility flag or hash. The separate `advancedComparisonEligibility()` API accepts only genuine complete replay results registered inside the simulation module; forged/plain-object results, partial replays and custom rate evaluators are ineligible. This supports verified unscored practice comparison and does not enable a leaderboard.

`ADVANCED_QUALIFICATION` keeps `scored` and `defaultEligible` false. Required gates remain: the wider physical-device/browser matrix, dense-world performance, reference-aircraft measurements, iOS runtime qualification and experienced-pilot assessment. The user explicitly deferred unavailable radio and pilot feedback; no identified real-aircraft measurements were supplied, and physical-touch qualification remains unmeasured. None is reported as passing. Propwash, ground effect, automatic firmware PID conversion and actual Betaflight execution remain outside this unqualified reference backend.

Package admission, offline-cache integrity and desktop/iOS staging are checked separately from native flight qualification. Passing those checks does not establish that Web Workers, graphics, USB input or file export work in a device wrapper. Advanced and tuning exports now use the shared platform adapter: JSON files or bounded inert CLI text, native sharing on iOS, and explicit cancelled/requested/shared outcomes. Advanced registers native inactivity before enabling flight and fails unavailable if the bridge cannot initialize. A late registration is released after disposal. Native backgrounding requires explicit resume.

## Validation

```sh
node --test game/test/fpv-advanced*.test.mjs
node scripts/fpv-advanced-benchmark.mjs
node scripts/qualify-fpv-advanced.mjs --write /tmp/fpv-runtime-qualification.json
node scripts/fpv-regional-contact-capacity.mjs
node --test scripts/test-build-fpv-native.mjs
```

Tests cover mixer saturation/anti-windup, complete controller restore, immutable rates, full rejected-motion rollback (including accidental asynchronous admission), stale input/session rejection, worker deadline disposal, replay/reset/partial recovery, malformed snapshot rejection, template stability, fixed-frequency CCD, identity partitioning and the maximum-duration recording quota. Comparison tests exercise different personal rates, throttle/class mismatch, tampered hashes/metadata, older recordings, detached provisional telemetry, cancellation/disposal and atomic reference replacement. DOM-boundary tests also exercise graphics-loss/pagehide pause, explicit resume, clearing held touch controls, source-aware input diagnostics, simulation-clock practice cues and draft save-versus-restart/revert behavior. Their substituted renderer is not a real-browser graphics qualification.

The earlier full-site build exceeded the existing 768 MiB native limit and was not a release artifact. `scripts/build-fpv-native.mjs` creates an explicitly scoped simulator-only qualification input from the verified Academy and World package closures, with a stricter 32 MiB envelope. It preserves the access gate, pinned dependencies, offline files and native CSP; it does not silently remove content from the full game. `sim-boot.mjs` replaces inline executable boot code and inline event handlers so the same entry pages work under native CSP. Ordinary desktop and iOS staging retain the production access gate. A separate, explicitly labeled test-only fixture built by `scripts/build-fpv-native-smoke.mjs` loads the production World modules under the same strict CSP. The earlier source-pinned Electron 44.3.0 run on this ARM64 host passed Regional flight, landing/takeoff, minimize/resume, native recording/recovery save, file-picker recovery, CLI/backup export, cancelled save, worker disposal and profile persistence across a full process restart. Its Web Lock and IndexedDB probes also survived restart. This historical local simulator evidence does not qualify subsequent source changes, production authentication or physical-controller input. A reproduced Legacy/Advanced graphics warning is fixed: hidden terrain preparation no longer requests a PCF depth sampler before a shadow map exists. The corresponding renderer regression and Electron stage reported no WebGL errors; broader GPU/device qualification is still open. See [native staging evidence](fpv-native-staging-evidence.json) and [native runtime evidence](fpv-native-runtime-qualification.json) for source hashes and observations. Xcode and the iOS simulator remain unavailable locally.
