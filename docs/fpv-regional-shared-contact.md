# Regional shared contact movement

## Scope

The regional authoring flight now uses the existing production World continuous sphere movement solver and contact velocity projection. This replaces its temporary first-hit stop that discarded all velocity. Both production and regional callers invoke `flight-contact.mjs`; there is no second collision response implementation.

The extraction preserves the existing three-pass solver, hit ordering, moving-hazard behavior, fixed-point normals, rounding, two-millimetre separation, velocity projection, and operation order. World keeps its existing support, landing, ground friction, hull damage, accepted-catch, mission and proof policy. No World model identity, threshold, score, recording or golden fixture changes.

Trusted terrain and scenery admissions expose a precise bounded motion cast using the same pinned Rapier runtime. A mixed owner selects the earliest verified layer hit with the production tie-break. Every projected slide checks its complete swept cell coverage. A missing or unready cell aborts before committing body pose, velocity, contact count or tick; the preview pauses for verified preparation. The normal atomic geometry/body/origin adoption remains unchanged.

## Verification

Historical baseline: `4878d2ac` (before this extraction). The manual checks load historical source from Git rather than replacing expected fixtures with current output.

- `verify-shared-contact.mjs`: 384 exact old/current movement and contact comparisons, including stationary aircraft and moving hazards. Real paired terrain/scenery query worlds cover wall glances, tangential velocity, floor slides, roof contact, corners, invalid coordinates and missing cells.
- `verify-contact-replay.mjs`: all 154 World demonstrations, 312,948 ticks, identical complete returned replay states and sampled paths. Both historical World model and collision module are loaded. Proof identity receipt SHA-256: `f31ab85d6090af4d9380f734bc535f67e2ce1a61ffd47e2521bffeb97f40f787`.
- Existing World runtime and flight model tests: 22 passed.
- Existing regional prototype, mixed owner, frame transaction, input session and verified terrain/scenery checks: 57 passed.
- Existing boundary and cooperative replay checks: 11 passed. Radio calibration/arming/reconnect contracts: 12 passed. Replay-rate/pause/focus contracts: six passed. These existing suites total 51 passing tests.
- Actual authored Urban controlled flight: five scenarios passed (warehouse doorway, wall contact, elevated roof descent, parking shaft, cross-cell road). The road crossed two origins without resetting pose or momentum; doorway, shaft and road routes recorded no contacts.
- Scoped correctness lint: all 13 new or changed modules passed.

Node runtime: 20.19.5. Run from the repository root:

```sh
node authoring/fpv-worlds/regions/verify-shared-contact.mjs
node authoring/fpv-worlds/regions/verify-contact-replay.mjs
```

Historical comparison requires the baseline Git commit to be available. The functional checks do not alter demonstration expectations.

## Remaining before player admission

This is a shared production movement prerequisite, not a new shipped regional SIM mode. The authoring preview remains `playerReady: false`, unscored, and outside the default catalogue. Production host admission still needs the remaining shared support/landing policy, lifecycle/package ownership and qualified streaming/recovery integration. Regional moving actors are not introduced here. No hardware-controller, device FPS, full package or public-release qualification is claimed.
