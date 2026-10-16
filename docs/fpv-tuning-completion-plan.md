# FPV tuning: reviewed completion plan

Reviewed 16 October 2026 against the original six-phase plan, implementation at
`8202201b7`, and current upstream documentation. The branch is rebased onto
`741948b14`. This document supplements the original plan; the
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

## Remaining software work

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
