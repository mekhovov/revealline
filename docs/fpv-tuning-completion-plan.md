# FPV tuning: reviewed completion plan

Reviewed 16 October 2026 against the original six-phase plan and current upstream
documentation. The first review used implementation `8202201b7` on `741948b14`;
the second review rebased the accumulated work onto `3585f2c32` before edits.
This document supplements the original plan; the
[implementation status](fpv-tuning-implementation-status.md) retains earlier
results and limitations.

The user explicitly deferred physical radio, real-aircraft and experienced-pilot
qualification on 16 October because those resources are unavailable. These are
deferred acceptance gates, not completed measurements. They do not block the
remaining software work. Advanced stays optional and unscored while its promotion
gates remain open.

## Review decisions

The five rate models, exact versioned throttle behavior, profile/drone separation,
CLI/preset patches and frozen attempts are the correct foundation. Adding another
rate algorithm is not the current priority. The next work is accurate diagnostics,
durable transfer provenance, repeatable measurements and Regional efficiency.

The implementation status previously grouped comparison identity helpers with
finished comparison integration. The audit must distinguish an implemented
helper from metadata actually carried by recordings and consumed by selection.
No Advanced competition or default eligibility follows from a passing rate curve.

| Current primary evidence                                                                                                                                                                                                                                                                                                         | Decision                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [WebFPV notes, September–October 2026](https://webfpv.org/notes/) describe channel diagnosis, flight-feel reports and step-response measurements, separating browser timing from physical display latency.                                                                                                                       | Show the active input owner, distinguish unavailable hardware measurements, and provide exportable response evidence.                                            |
| [QuadMath's browser simulator](https://quadmath.com/sim.html) exposes motor response, thrust, battery sag and ghost sharing.                                                                                                                                                                                                     | Compare commanded and achieved response with aircraft configuration attached; keep rates separate from physical limits.                                          |
| [Flight Division's curriculum](https://flightdivision.com/about) sequences takeoff, turns, stopping and flow.                                                                                                                                                                                                                    | Use repeatable hover, turn, stop and throttle maneuvers for pilot comparison sessions. Their physical evaluation is deferred.                                    |
| [VelociDrone's manual](https://www.velocidrone.com/desktop_manual) documents profiles, copying and rate-type conversion.                                                                                                                                                                                                         | Retain independent algorithm drafts. An approximate curve converter is a later convenience, with explicit error metrics, not part of exact import compatibility. |
| [Liftoff Physics 6.0](https://www.liftoff-game.com/news/milestone-170-released) adds power constraints, battery telemetry and separate historical physics leaderboards.                                                                                                                                                          | Keep performance limits in comparison classes, preserve old identities and qualify hardware response before promotion.                                           |
| [Betaflight presets](https://betaflight.com/docs/wiki/app/presets-tab) expose firmware, options and CLI preview; the [preset specification](https://github.com/betaflight/firmware-presets#preset-specifications) defines patch/include semantics.                                                                               | Retain a bounded, inert provenance receipt after import, including version assumptions, baseline, resolved choices and unapplied fields.                         |
| [Betaflight's Blackbox repository](https://github.com/betaflight/blackbox-log-viewer) directs maintained analysis to Betaflight App from 2026.6 and schedules standalone archival for 1 December 2026. The [decoder](https://github.com/betaflight/blackbox-tools) requires explicit unit choices; rotation defaults can be raw. | Begin real-flight comparison with explicitly mapped CSV exports and declared units. Do not infer gyro units or silently depend on the retired standalone viewer. |
| [Quadrotor system-identification research](https://arxiv.org/abs/2404.07837v2) estimates inertia, thrust, torque and motor delay from measured flight data.                                                                                                                                                                      | Build a reproducible comparison workflow, but do not turn synthetic fixtures or another aircraft's published parameters into validation of our templates.        |

Competitor descriptions establish documented features, not independently measured
flight fidelity. Lens presets, arbitrary gravity adjustments, automatic PID
conversion, online preset catalogs and actual Betaflight execution do not enter
this completion scope.

## Software completion scope

1. **Audit and correct active-input diagnostics.** Keyboard, touch, gamepad and
   radio diagnostics must refer to the source actually controlling the flight.
   Raw/calibrated/requested/achieved fields must identify their stage. A radio
   connected in the background cannot masquerade as the active source. Browser
   samples cannot establish hardware polling or physical input-to-display delay.
   Verify owner switches, absent radio, pause and immutable active configurations.

2. **Retain transfer provenance.** Store source digest, source firmware and how it
   was selected, import operation, source profile, patch baseline and resolved
   include/option choices. Retain applied/ignored settings as bounded inert data.
   Revisions and backups preserve the receipt; names/provenance do not alter the
   physical curve identity. Display the receipt after import. Old backups remain
   valid and ignored fields never become active after an update.

3. **Remove redundant Regional work.** Profile worker round trips, rollback
   snapshots and host admission separately. When the worker has already resolved
   contacts, use a trusted coverage-only query retaining the complete swept-volume
   and mixed-owner readiness checks. Do not skip terrain admission or change
   solver frequency. Verify identical recordings, rejection rollback and real
   worker throughput; sample host contention during the measured interval.

4. **Make response comparison reproducible.** Export verified replay telemetry
   with immutable configuration and sampling cadence. Accept bounded CSV with
   explicit column, axis, time and rotation-unit mappings. Require matched
   commanded motion before comparing achieved rotation. Report missing channels,
   gaps, alignment and time resolution; do not optimize away response lag or
   infer motor/inertia fidelity from sparse traces. Synthetic fixtures validate
   the comparison software only. No flight log changes a saved tune automatically.

5. **Complete recording identity plumbing.** Audit actual recordings and recovery
   against the separate simulation/comparison identities. Include backend/timing,
   aircraft/controller, world/rules, assists and throttle/performance restrictions;
   exclude personal rotation curves and camera cosmetics from comparison class.
   Preserve legacy validation and keep Advanced comparison/promotion gated.
   Fix production gaps found by this audit before calling the software complete.
   Consume this metadata in the reference arena: verify an imported or retained
   recording in a disposable worker, enforce the current frozen comparison class,
   then show its recorded path as an unscored ghost. Include timed manual hover,
   turn/stop and throttle-pulse cues. Regional free flight has no defined scored
   sector route; preserve Legacy sector rules and leave Advanced competition
   integration behind its qualification gate.

6. **Refresh qualification and delivery evidence.** Run relevant unit/integration
   checks and the full practice suite after changes. Recheck source-bound reports,
   Regional capacity, browser tuning/worker behavior, package admission and offline
   boundaries. Preserve previous failed measurements. Commit reviewable work when
   the software gates pass; public Pages publication uses the existing main-branch
   process and its unchanged capacity checks.

## Deferred acceptance and promotion

| Gate                                             | Current disposition                         | Evidence required to close it                                                                                                                                                          |
| ------------------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Physical radio and touch-device matrix           | Deferred by user                            | Real devices, calibration/mapping/ownership tests, observed browser sampling and separate physical-latency measurements where available.                                               |
| Real-aircraft parameters and response            | Deferred by user                            | Identified aircraft, firmware/configuration, measured mass/geometry and trace or bench data for thrust, torque, motor delay, inertia, drag and battery behavior; held-out comparisons. |
| Experienced-pilot comparison                     | Deferred by user                            | Repeated saved/draft maneuvers, structured observations and reviewed keep/revert outcomes.                                                                                             |
| Physical Intel/mobile/low-end and iOS runtime    | Unavailable locally; deferred platform work | The same source-bound deterministic replay, lifecycle, storage, contact and performance tests on those targets. Emulation and staging do not substitute.                               |
| Propwash and ground effect                       | Depends on measured base aircraft           | A validated base model and dedicated measurements; no arbitrary realism sliders.                                                                                                       |
| Verified Advanced records and default promotion  | Gated on the above                          | Qualified platform matrix, comparison integration and reviewed promotion decision. No automatic promotion from a local benchmark.                                                      |
| Full-game native distribution                    | Separate product packaging constraint       | A reviewed distribution that fits the existing site budget. The simulator-only stage remains the feature qualification artifact.                                                       |
| Public Pages HTTPS and installed-update behavior | Requires publication                        | Exact deployed commit, real access form, fresh and existing installs, offline update retention and final archive/inventory gates. Local fixture tests remain separately labeled.       |

Software completion means all six work items above have implementation and
verification evidence. It does not relabel deferred physical gates as passed.
Progress and exact verification results are recorded in the implementation status.

## First software completion review — 16 October 2026

The first review recorded all six software items as implemented and locally verified.
The second review below reopens specific correctness checks found by exercising
additional transitions. The
[implementation status](fpv-tuning-implementation-status.md) and
[combined verification receipt](fpv-tuning-continuation-verification.json)
record that review's exact scope, source hashes and preserved earlier failures.

| Item                                         | Completion evidence                                                                                                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active-input diagnostics                     | Accepted-input ownership regressions; final three-engine editor matrix.                                                                                           |
| Transfer provenance                          | Import/library/history/backup tests; browser and native receipt persistence.                                                                                      |
| Regional efficiency                          | Exact replay and rollback; final bounded adapter capacity of 5.497× / 9.653×.                                                                                     |
| Response comparison                          | Verified CSV export with explicit timing/units, matching-command analysis, size/minimum-observation guards; 14 focused tests.                                     |
| Recording identities and practice comparison | Recomputed recording/recovery metadata; verified arena ghost, mismatch/tamper rejection, timed maneuvers and cancellation/disposal tests.                         |
| Local delivery                               | Practice regressions, release validation, six runtime checks, desktop fixture and iOS staging, normal Pages CLI build and actual installer/offline browser tests. |

That review established readiness for the normal Pages integration process.
Deferred physical, wider-platform, public-deployment and promotion gates remain
as listed above. No synthetic result substitutes for those measurements.

## Second review — draft integrity, transfer clarity and recovery

Reviewed again on 16 October against `90d1a1ef9`. Before edits, the branch was
rebased onto new `main` commit `3585f2c32`; the two existing feature commits are
now `0759c993a` and `f69a58fb7`. Earlier evidence remains bound to its recorded
source hashes and is preserved rather than relabeled as a new run.

Fresh primary-source review supports these refinements:

| Reference checked | Relevant behavior | Decision |
| --- | --- | --- |
| [WebFPV, 1 October notes](https://webfpv.org/notes/) | Describes fixes for one aircraft's saved tune/camera overwriting another and for camera values resetting on navigation. | Test independent setup drafts and cross-environment navigation, beyond a successful save/reload path. |
| [FPV Tools rate comparison](https://github.com/FPVibe/fpv-tools#-rate-profile-comparison) | Separate editable profiles, saved history, overlays and per-axis visibility. | Visible draft values and save results must agree; changing the compared profile must not discard another edit. |
| [VelociDrone desktop manual](https://www.velocidrone.com/desktop_manual) and [mobile manual](https://www.velocidrone.com/mobile_manual) | Distinguish temporary rates from explicit saved settings; document rate copying and camera FOV conventions. | Keep test/apply/save distinct, normalize native parameter steps visibly, and preserve our explicitly labeled vertical FOV. |
| [Betaflight preset UI](https://betaflight.com/docs/wiki/app/presets-tab) | Firmware selection, options and CLI review precede application. | A preview cannot authorize saving a different invisible result; header inference and export choices must match the advertised workflow. |
| [Liftoff 1.4.4](https://www.liftoff-game.com/news/update-144-released) | Documents immediate feedback from flight-controller edits. | Preserve fast draft testing while retaining this SIM's immutable recorded attempts. |
| [Rapier determinism guidance](https://rapier.rs/docs/user_guides/javascript/determinism/) | Exact behavior depends on consistent initialization and state evolution. | Bounds checks alone do not verify imported recovery; compare restored dynamic state with a replay of its consumed history before adoption. |

These are documented examples and our engineering conclusions, not measurements
of competitor flight fidelity. No new cloud service, firmware execution, rate
converter or unmeasured physics effect is added by this review.

### Reopened software checks

1. **Independent setup drafts:** camera, drone name and assignment edits survive
   rate-profile changes, returning from practice and reopening the editor. Save,
   revert and refresh have explicit scope; stale-library protection remains.
2. **Current practice origin:** after a normal World or Regional flight is
   selected, later Test draft / Apply & restart uses that current environment,
   never a retained origin from an earlier test session.
3. **Representable numeric values:** numbers, sliders, curves and saved profiles
   agree after committing an edit. Preserve ordinary partial typing, normalize
   native steps visibly, and reject invalid/non-finite inputs without silent saves.
4. **Preview/save consistency:** manual rate changes invalidate or explicitly
   supersede an import preview; saving cannot silently use an older hidden curve.
5. **Header-derived baselines:** a supported firmware header can supply the
   version when a patch explicitly starts from firmware defaults. Conflicting or
   unverified versions still fail clearly.
6. **Rates-only CLI export:** expose the existing export option to omit throttle,
   allowing rotation rates to transfer across otherwise incompatible throttle
   models. Default exports and exact target-version validation remain explicit.
7. **Verified recovery adoption:** reject in-range but history-inconsistent motor,
   controller and body state before replacing an active session. Imported recovery
   uses bounded, cancellable verification; transactional rollback keeps its fast
   trusted internal path. Valid full-duration recovery and cancellation retain
   the active flight until successful adoption.

The exit gate is targeted regression coverage for all seven checks, actual
browser interaction for editor/transfer changes, recovery verification in real
workers, the full practice suite, release validation, and refreshed local
packaging/offline evidence for changed runtime bytes. Numerical timing remains
frozen and unchanged; a replay consistency fix does not claim a physics upgrade.

The newly rebased Pages candidate workflow is diagnostic-only and deliberately
rejects changes to build/publishing tooling and package manifests. This feature
branch changes those paths, so it must not be presented as eligible for that
workflow or widen its gate to obtain a result. The normal production build and
existing main-branch review/publication process remain the delivery route.

Physical radio, pilot feedback, measured aircraft response and the other deferred
acceptance/promotion gates above remain open as agreed with the user. They do not
block these seven concrete software corrections.
