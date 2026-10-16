# FPV tuning: reviewed completion plan

Reviewed 16 October 2026 against the original phased plan and current upstream
documentation. The first review used implementation `8202201b7` on `741948b14`;
the second review rebased the accumulated work onto `3585f2c32` before edits.
The third review rebased onto `20768f599` before its corrections; earlier
source-bound reports retain their original hashes.
This document supplements the original plan; the
[implementation status](fpv-tuning-implementation-status.md) retains earlier
results and limitations.

On 16 October the user confirmed that radio and real-pilot feedback are unavailable
and directed continuation without them. No identified-aircraft measurements were
provided, and physical-touch qualification remains unmeasured. These open
acceptance gates do not block the remaining software work. Advanced stays optional
and unscored while its promotion gates remain open.

## Review decisions

The five rate models, exact versioned throttle behavior, profile/drone separation,
CLI/preset patches and frozen attempts are the correct foundation. Adding another
rate algorithm is not the current priority. The first completion review delivered
accurate diagnostics, durable transfer provenance, repeatable measurements and
Regional efficiency. Subsequent reviews below correct concrete boundary cases
without expanding the original product scope.

The implementation status previously grouped comparison identity helpers with
finished comparison integration. The completed audit distinguishes an implemented
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
| Physical radio and touch-device matrix           | Radio deferred by user; physical touch unmeasured | Real devices, calibration/mapping/ownership tests, observed browser sampling and separate physical-latency measurements where available.                                               |
| Real-aircraft parameters and response            | No identified measurements provided         | Identified aircraft, firmware/configuration, measured mass/geometry and trace or bench data for thrust, torque, motor delay, inertia, drag and battery behavior; held-out comparisons. |
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

| Reference checked                                                                                                                       | Relevant behavior                                                                                                       | Decision                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [WebFPV, 1 October notes](https://webfpv.org/notes/)                                                                                    | Describes fixes for one aircraft's saved tune/camera overwriting another and for camera values resetting on navigation. | Test independent setup drafts and cross-environment navigation, beyond a successful save/reload path.                                      |
| [FPV Tools rate comparison](https://github.com/FPVibe/fpv-tools#-rate-profile-comparison)                                               | Separate editable profiles, saved history, overlays and per-axis visibility.                                            | Visible draft values and save results must agree; changing the compared profile must not discard another edit.                             |
| [VelociDrone desktop manual](https://www.velocidrone.com/desktop_manual) and [mobile manual](https://www.velocidrone.com/mobile_manual) | Distinguish temporary rates from explicit saved settings; document rate copying and camera FOV conventions.             | Keep test/apply/save distinct, normalize native parameter steps visibly, and preserve our explicitly labeled vertical FOV.                 |
| [Betaflight preset UI](https://betaflight.com/docs/wiki/app/presets-tab)                                                                | Firmware selection, options and CLI review precede application.                                                         | A preview cannot authorize saving a different invisible result; header inference and export choices must match the advertised workflow.    |
| [Liftoff 1.4.4](https://www.liftoff-game.com/news/update-144-released)                                                                  | Documents immediate feedback from flight-controller edits.                                                              | Preserve fast draft testing while retaining this SIM's immutable recorded attempts.                                                        |
| [Rapier determinism guidance](https://rapier.rs/docs/user_guides/javascript/determinism/)                                               | Exact behavior depends on consistent initialization and state evolution.                                                | Bounds checks alone do not verify imported recovery; compare restored dynamic state with a replay of its consumed history before adoption. |

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

### Second-review completion

All seven reopened software checks are implemented and verified on the final
source. The [combined receipt](fpv-tuning-second-review-verification.json) binds
their source hashes and the following evidence:

| Checks                                                                        | Final evidence                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup drafts, current practice origin and numeric consistency                 | Editor/World regressions, including linked-peer edits back to their original value; six Chrome/Firefox/WebKit desktop and touch-emulated cases.                                                                                        |
| Import preview consistency, header-derived baselines and rotation-only export | Importer/editor regressions across the verified versions; final browser matrix and actual Electron transfer flow.                                                                                                                      |
| Verified recovery adoption and cancellation                                   | In-range state corruption rejected atomically; pending future input retained; full 12-minute recovery with 24 checkpoints; real World worker adoption/corruption/cancellation; file-read cancellation; actual Electron valid recovery. |
| Regression and delivery gates                                                 | 610 practice tests, 75 native tests, lint for 15 changed modules, release validation, unchanged 250 Hz numerical/identity gates, simulator-only native staging, normal Pages build and generated-site online/offline tests.            |

The [implementation status](fpv-tuning-implementation-status.md) records exact
scope and limitations. The failed Firefox 1,000 Hz capacity candidate, the native
automation navigation failure and the earlier browser harness attempt remain
visible in their reports. No threshold, access policy, package cap or production
workflow was relaxed to obtain the final passes.

This completes the available software work in the reviewed plan. Advanced stays
optional, unscored and ineligible as the default until the deferred acceptance
gates pass. Public Pages publication still requires the existing reviewed
main-branch process; a local commit is ready for that process but does not deploy.

## Third review — complete the available scope without inventing qualification

Reviewed 16 October against `469e75655`, then cleanly rebased the three feature
commits onto current `main` at `20768f599`. Their new identities are `1506e44f4`,
`3f0d3abbc` and `1ff0d996d`. Main's intervening creator changes are retained.

Additional primary examples support the existing design and expose useful audit
questions:

| Example | Finding and decision |
| --- | --- |
| [FlySpark rates editor](https://app.flyspark.in/betaflight-rates/) | Documents the five algorithms, native labels, profile copying, throttle versions and arbitrary-position curve inspection. Our algorithm-specific editor, saved/draft overlays and preview-position control cover the original scope. A chart marker and selected-position numeric comparison are optional follow-up usability improvements. |
| [FPV Web calibration](https://github.com/rachmataditiya/fpv-web#calibration) | Documents per-device calibration and merging imported calibration profiles. Our separate radio library already preserves unrelated devices. Device-specific WebHID support is not implied by portable Betaflight rates. |
| [ShramkoGSFPV evidence and roadmap](https://github.com/AndriiShramko/ShramkoGSFPV#what-is-measured-not-claimed) | Distinguishes simulated-radio/touch checks from physical devices and identifies real-aircraft tuning as awaiting logs. Keep our measurements, estimated aircraft parameters and deferred physical acceptance separately labeled. |
| [Propwash indexed README](https://github.com/notfeylo/propwash) | The search index describes setpoint/gyro analysis and deterministic replay. Direct repository/raw/live access failed during this review, so availability and flight fidelity were not verified. Our verified CSV workflow already covers reproducible response comparison; a visual flight-analysis dashboard is future convenience. |

These sources are feature descriptions, not independent validation of a competing
simulator. They do not justify importing unverified PID values, changing the
frozen physics rate, adding arbitrary effects or expanding firmware claims.

The independent code audit reopened two concrete checks:

1. **Camera submission integrity.** Empty camera input must not become zero and
   out-of-range tilt/FOV must not reach practice with host-dependent clamping.
   Preserve partially entered camera text per drone, require valid values for
   every camera-consuming action, retain valid fractional degrees and migrated
   values, and leave portable rate-only transfers independent of camera drafts.
2. **Exact consumed-input chronology.** Replay must validate the declared
   consumption substep against the sample timestamp and mission in which it
   becomes available. A substep inconsistent with that schedule must fail even
   when final physics hashes match. Preserve honest late arrivals and future
   queued samples. Verified
   recovery, ghost imports and CSV export all consume the same verifier; invalid
   histories must fail before adoption or writing trace files.

This is a consistency check, not authenticated input capture. A self-consistent
history that could describe a different legitimate late arrival is not proof of
the original physical input stream; unscored local recording files carry no such
authenticity guarantee.

The exit checks are focused negative/positive regressions, the complete practice
suite, actual browser editor interaction, real-worker replay/recovery checks,
release validation and refreshed generated delivery evidence. These fixes change
validation, not aircraft dynamics or backend identities. The existing numerical
thresholds, publication limits and Advanced promotion policy remain unchanged.

### Original phase disposition

| Original phase | Available software | Unclosed acceptance or later work |
| --- | --- | --- |
| 0 — base and compatibility | Latest-main rebase, retained Legacy model/identities, migrations and historical fixtures. | None beyond normal integration of the final commit. |
| 1 — rates and throttle | Five models, independent axes, both Quick modes, versioned exact throttle, native increments and full supported range. | Physical feel is covered by the separately deferred pilot sessions. |
| 2 — profiles and practical tuning | Device-local profiles, setup assignment, history, camera, overlays, preview/diagnostics, draft testing, atomic persistence and stale-tab protection; third-review camera regressions pass. | Actual radio/touch and experienced-pilot checks remain deferred. |
| 3A/3B — transfer | Verified CLI versions, ordered dump/diff/patch handling, local preset bundles/options, previews, receipts and native/CLI export. | New firmware families, online catalog and other firmware formats remain outside this release. |
| 4 — Advanced backend | Independent controller, worker/motor/body loops, frozen 250 Hz choice, compact recording/recovery and Regional rollback; third-review chronology regressions pass. | Wider physical platform and dense-region qualification remain open. |
| 5 — aircraft and comparisons | Editable reference templates, battery/motor/filter controls, separate controller/rates, comparison identities, verified unscored ghosts and measured-log comparison tooling. | Real-aircraft fitting, validated propwash/ground effect and Advanced scored sector eligibility require their original evidence gates. |
| 6 — qualification and rollout | Optional unscored practice, explicit availability, preserved Legacy preferences/history, browser/offline/native staging and production-build checks. | Public deployment/install updates, untested platforms, verified Advanced records and default promotion are conditional rollout gates. |

Completion of the two reopened checks closes the currently actionable software
scope. The user explicitly deferred unavailable radio and pilot feedback; aircraft
measurements and physical-touch qualification also remain unmeasured. These items
stay recorded without blocking this delivery. They must not be marked
complete or replaced with synthetic measurements. Further optional product ideas
are a future backlog, not a reason to keep expanding this implementation.

### Third-review completion

Both reopened checks are implemented and verified. The
[combined receipt](fpv-tuning-third-review-verification.json) binds final sources
to 620 practice tests, 75 native tests, seven linted/formatted modules, six editor
browser cases, the six-runtime determinism matrix, actual World/Regional worker
recovery and release validation. The normal production Pages build and generated
Academy/World online/offline checks pass within the existing package cap.

The available software scope is complete and ready for the normal reviewed Pages
integration process. Public deployment and installed-update testing remain
unperformed, and the physical/platform/promotion gates in the phase table remain
open. No gate was weakened or unmeasured result labeled complete.
