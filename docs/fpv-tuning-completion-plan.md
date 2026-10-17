# FPV tuning: reviewed completion plan

## Latest remaining-scope review

Main was fetched and the branch rebased before this continuation; main remains
`fb3caf12b`. The [input recovery review](fpv-tuning-input-recovery-review.md)
adds current Betaflight, Liftoff and VelociDrone examples. It retains the existing
rates/profile/import scope and identifies one reproduced software defect:
unavailable input can incorrectly disable a healthy Advanced practice worker.

The recoverable-input correction and bounded startup diagnostics pass 741 practice
tests, EN/UK browser recovery and the desktop fixture. Review also found and fixed
unconstrained diagnostic exception strings; new request/capture metadata uses
finite categories. Finish fresh source checks and live publication acceptance. Physical and wider-platform gates
remain deferred as agreed; no new rate models or unmeasured aircraft effects are
needed to close the available software scope. The latest review's delivery status
takes precedence over the historical completion records below.

## Current completion review

The latest continuation rebased on `1d631986ad73ba1301a151a76b1607cf03dbe97a`
before edits. The [boundary review](fpv-tuning-boundary-review.md) records fresh
primary-source examples and three concrete corrections: history restoration
supersedes pending imports, preset review metadata matches the tagged parser,
and Regional flight limits retain recording export and explicit restart.
Its verification and delivery status takes precedence over the historical reviews
below. Earlier receipts keep their original source and deployment scope.

| Original phase | Current disposition |
| --- | --- |
| 0 — Base and compatibility | Rebased; legacy identities, migration and historical recordings retained. |
| 1 — Rates and throttle | Five models and exact verified-version throttle behavior implemented. |
| 2 — Profiles, setups and tuning | Implemented; latest history/import transition receives additional regression coverage. |
| 3 — Configuration and preset transfer | Implemented for the five explicitly verified releases; latest metadata parity correction is bounded to the tagged parser. |
| 4 — Advanced backend | Optional unscored backend implemented with fixed timing, recording, recovery and transactional Regional admission; latest Regional limit handling closes an export lifecycle gap. |
| 5 — Aircraft and comparison | Editable templates, controller tunes and frozen comparison identities implemented. Measured aircraft fitting, propwash/ground effect and scored comparison remain qualification-dependent. |
| 6 — Delivery and rollout | Corrections published in `fb3caf12b`; current public password/offline acceptance and desktop fixture pass. One initial startup timeout is preserved as unexplained. Physical-device, pilot, iOS and wider-platform qualification remain deferred. Advanced is not promoted to scored/default use. |

No additional algorithm, online catalog, automatic PID conversion or physics
slider is added merely because another simulator advertises one. Complete the
bounded corrections and their verification before further software expansion. The
[delivery receipt](fpv-boundary-delivery-verification.json) closes this available
software scope. The user's unavailable measurements remain explicit future
acceptance work.

Reviewed 17 October 2026 against the original phased plan and current upstream
documentation. The first review used implementation `8202201b7` on `741948b14`;
the second review rebased the accumulated work onto `3585f2c32` before edits.
The third review rebased onto `20768f599` before its corrections. The fourth
review rebased onto `1cdf442dc` before edits; earlier source-bound reports retain
their original hashes.
The fifth review rebased onto `0597edff7` before its corrections.
The sixth review rebased onto `b133a5ec8` before its correction.
The seventh review rebased onto `8b0199194` before its work.
This document supplements the original plan; the
[implementation status](fpv-tuning-implementation-status.md) retains earlier
results and limitations.

The post-publication review below starts from refreshed main `63c36670a` and
reopens three specific failure boundaries. Earlier passing reports remain bound
to their original sources; they are not rewritten as evidence for later fixes.

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
| Public Pages HTTPS and installed-update behavior | Passed on one Chrome desktop                | Exact deployed merge, ordinary password access, fresh and authentic old-main installs, offline restart/retention and final archive/inventory gates pass. OS-installed PWAs, eviction and other devices remain outside this check. |

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
| 2 — profiles and practical tuning | Device-local profiles, setup assignment, history, camera, overlays, preview/diagnostics, draft testing, atomic persistence and stale-tab protection; third-review camera regressions pass. | Radio/pilot sessions are deferred; physical-touch checks remain unmeasured. |
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

## Fourth review — calibration and preview boundaries

Reviewed again on 16 October. Rebased all four feature commits onto current
`main` at `1cdf442dc` before implementation. Their new identities are
`da420505a`, `6d846f285`, `c4b771b14` and `8fe7b118f`. The integration retains
main's broader dialog-hint protection, HUD accessibility grouping, offline
changes and practice pointer/observer checks.

Fresh primary-source review narrows the remaining work to demonstrated defects:

| Reference | Finding and implementation decision |
| --- | --- |
| [Betaflight App 2026.6.1](https://github.com/betaflight/betaflight-configurator/releases/tag/2026.6.1) and [2026.6.2](https://github.com/betaflight/betaflight-configurator/releases/tag/2026.6.2) | The former includes numeric, preview, profile-display and offline corrections; the latter lists a stale-device-event transport fix. Exercise editor transitions and offline delivery. App release notes do not expand our verified firmware mathematics or supported firmware tags. |
| [Betaflight rate calculator](https://betaflight.com/docs/wiki/guides/current/Rate-Calculator) | Preserve the five algorithms' native parameter meanings. Approximate rate conversion remains optional future work with explicit fitting error. |
| [WebFPV notes](https://webfpv.org/notes/) | Aircraft-specific saving, device mapping and download-lifecycle fixes reinforce testing failure paths and separating browser observations from physical qualification. A reported fix in another SIM is an audit lead, not proof of a defect here. |
| [QuadMath simulator](https://quadmath.com/sim.html) | Its adjacent axis rates, CLI paste, camera and aircraft controls reinforce the implemented tuning workflow. Visible controls do not establish measured aircraft fidelity or justify arbitrary gravity sliders. |
| [SimITL](https://github.com/AJ92/SimITL) and [pr0p](https://pr0p.dev/) | Actual Betaflight execution has a concrete architectural reference. SimITL's README currently specifies a modified 2025.12.0 prerelease and Windows/Linux binaries. Keep the replaceable controller interface; this does not establish a drop-in browser backend, portable firmware equivalence or a new requirement for this release. |

Independent reproductions reopened four bounded software items:

1. **Preset preview integrity.** Changing an option invalidates generated CLI
   text as well as the preview. **Preview import** and **Save import as new
   profile** require the current choices to be resolved. Switching entry files
   resets entry-specific option state and descriptions. A separately pasted CLI
   snippet remains a deliberate input.
2. **Failed drone-selection recovery.** If selecting another setup fails because
   storage is full or another tab saved newer data, restore the displayed
   selector to the committed setup without losing current drafts. A later Save
   must never target a different drone from the one shown.
3. **Calibration-only imports.** In Academy and World, importing a radio profile
   or calibration library must preserve saved player rates, the existing legacy
   migration response and the current flight. Validate the entire incoming
   document before applying calibration changes, report ignored legacy response
   settings, and retain the standalone legacy editor's original import behavior.
4. **Replay observer integration.** Main's new frozen-source replay observer
   needs the rates and response modules introduced by this branch. Add these
   explicit dependencies while retaining exact-byte checks and the bounded
   subprocess. Verify Legacy and tuned recordings in both Academy and World;
   missing modules must still reject verification.

The exit checks are negative/positive store and UI regressions, browser preset
interaction, full practice and native tests, upstream pointer/observer checks,
release validation and fresh normal-production Pages/offline checks. Compare
historical numerical evidence against its source hashes before reuse; unchanged
physics does not need a new benchmark labeled as new evidence. All qualification
and publication limits remain unchanged.

The original phase disposition above still applies. Complete these reproducible
software corrections and commit the tested result for the normal Pages
integration process. Radio and pilot feedback remain deferred at the user's
request; absent aircraft measurements, untested physical devices and public
rollout retain their explicit gates. They do not block the software corrections,
and they cannot be represented as completed measurements.

A bounded follow-up to WebFPV's download-lifetime note did not reproduce a local
failure: nine initialized 457-byte Academy exports completed across current
Chrome, Firefox and WebKit with the existing URL lifetime. The
[experiment](fpv-academy-download-fourth-review.json) is explicitly limited to
that small initialized attempt and those browser versions. It does not establish
historical-browser or maximum-duration download behavior and does not justify a
speculative production change.

### Fourth-review completion

All four reopened software items are implemented and independently reviewed. The
[combined receipt](fpv-tuning-fourth-review-verification.json) records 664 passing
practice tests, 75 native tests, 10 pointer tests and 170 passing observer tests
with one existing opt-in fixture skipped. Six editor-browser cases, actual
World/Regional recovery, nine-module lint/formatting and release validation pass.
Unchanged numerical source hashes retain the prior matrix as historical evidence.
The normal production build and generated Academy/World online/offline checks
pass within the existing Pages cap.

This closes the available software scope. Original measurement, platform and
public-rollout gates remain as listed above; none is represented as completed or
waived. The tested commit is ready for normal reviewed Pages integration.

## Fifth review — exact firmware headers and asynchronous saves

Reviewed again on 16 October, then rebased all five feature commits onto current
`main` at `0597edff7` before implementation. The rebased commits are `6f04efd1f`,
`e89af7a15`, `61454f37d`, `054e19d37` and `54ad967de`. Main adds publication
controller and isolated candidate-composition checks; it does not change the
simulator runtime. Those integration checks must pass without broadening this
branch's publication eligibility.

Additional primary examples refine the acceptance checks without expanding the
release:

| Reference | Finding and decision |
| --- | --- |
| [FPVSIM's rate-system guide](https://fpvsim.com/how-tos/simulator/tuning/actual-quick-kiss-rates) | Keeps aircraft, camera and calibration fixed while comparing center, half and full-stick behavior, and applies settings before reloading the world. Retain our explicit Apply & restart and repeatable practice workflow. Rate numbers are not interchangeable between algorithms. |
| [CurryKitten's Flight Assist menu](https://github.com/CurryKitten/CurryKitten-Sim/wiki/Flight-Assist-Menu) | Documents axis-colored curves, moving markers, rotation preview and explicit saving. Keep the evaluator shared between preview and flight; save feedback must describe the settings actually stored. Its UI ceiling is not a substitute for verified firmware limits. |
| [FPV Freerider's developer page](https://fpv-freerider.itch.io/fpv-freerider) | Separately exposes rates, camera and physics, and documents recalibration after an input-system change. Preserve our calibration/rates separation and migration behavior; the page does not establish Betaflight-equivalent curves. |
| [Uncrashed's official updates](https://steamcommunity.com/app/1682970/allnews//1000) | Rate-model, replay and optional battery-sag changes reinforce independent curve fixtures, frozen recordings and explicit rollout. Lens distortion, video export and additional camera controls remain optional future features. |

Two independent reproductions reopened concrete software work:

1. **Exact source-version interpretation.** An explicit old/future or
   development firmware header must not become a missing header or lose its
   suffix and borrow a verified release's defaults. Reject unsupported or
   conflicting versions before preview/save. Continue accepting exact supported
   release headers and genuinely headerless `dump rates`/snippet workflows.
2. **Honest asynchronous aircraft saves.** Capture the submitted tune, prevent
   overlapping Save operations, and keep a newer visible edit marked as unsaved
   when an earlier save finishes. Failed saves remain retryable; late results
   cannot revive a disposed editor. The active worker retains its frozen tune
   until the existing explicit restart action.

Verify these boundaries with positive and negative importer/UI cases, a delayed
save/edit regression, real-browser interactions, the full practice suite and
normal generated Pages online/offline checks. Refresh affected native/host
source-bound evidence; reuse unchanged numerical evidence only after checking
every recorded hash. Keep historical results and the existing publication,
physics and promotion gates unchanged.

The original phase disposition remains in force: finish the available software,
record missing measurements accurately, and commit the tested result. No new
radio, pilot or aircraft evidence is available. Their absence does not block
these corrections and does not authorize claiming physical qualification or
promoting Advanced to scored/default flight.

### Fifth-review completion

Both reopened software items are implemented and independently reviewed. The
[combined receipt](fpv-tuning-fifth-review-verification.json) binds 673 passing
practice tests, 75 native tests, 79 publication-tooling integration tests, seven
linted/formatted modules, six browser-editor cases, actual Advanced comparison
and World/Regional checks, release validation and normal production Pages
online/offline checks. Unchanged numerical sources retain historical evidence;
no benchmark or physical measurement is invented.

The available software scope is complete. The original qualification gates remain
explicitly open, including unavailable radio/pilot sessions, real-aircraft data,
wider platforms and public rollout. The tested commit is ready for normal Pages
integration; local build success does not publish or promote Advanced.

## Sixth review — preserve incomplete numeric drafts

Reviewed 17 October and rebased all six feature commits onto current `main` at
`b133a5ec8`. Main adds bounded Pages stack measurements and source-policy
admission; simulator runtime and package limits are unchanged. These diagnostics
do not replace the normal reviewed publication process.

Fresh primary examples provide the following acceptance checks:

| Reference | Finding and implementation decision |
| --- | --- |
| [Keymap PROPWASH browser simulator](https://keymap.io/fpv-simulator/) | Documents per-axis classic Betaflight curves, CLI copying, local rates/camera and a fixed simulation frequency. Retain portable rate-only transfer and independent calibration/camera settings. Its advertised preset defaults and fidelity are not firmware or numerical verification authorities. |
| [TRYP official announcements](https://steamcommunity.com/app/1881200/announcements/) | June 2026 notes fix new-drone profiles using incorrect configurations; earlier notes disclose incompatible physics profiles. Exercise independent setup/profile drafts and preserve historical simulation identities. |
| [DRL official announcements](https://steamcommunity.com/app/641780/announcements/) | The 4.0 announcement changes throttle caps, battery resistance and replay compatibility. Keep performance restrictions in comparison classes and old recordings bound to their original configuration/verifier. |
| [Orqa calibration FAQ](https://cdn.akamai.steamstatic.com/steam/apps/1278060/manuals/FPV.SkyDive_Calibration_FAQ__4_2022_.pdf?t=1686666004) | Distinguishes radio/gamepad calibration and conflicting connected devices. Retain active-device diagnostics and calibration-only imports; the FAQ is dated April 2022 and supplies no new physical-device qualification. |

These are documented examples, not independent measurements of competing flight
models. The existing five algorithms, versioned throttle, import, drone setup and
comparison requirements already cover them; no extra firmware support or physics
effects are added.

The code audit reproduced one remaining editor defect: incomplete numeric text
was replaced with the last valid value when switching algorithms/profiles,
reopening the editor or changing language. Saving afterward could therefore
store an older value despite the player's unfinished edit.

1. Preserve unresolved numeric text by profile, algorithm and stable field name.
   Independent valid drafts remain usable. Repainting or changing throttle
   models must not silently accept or discard an invalid value.
2. Require valid active fields before saving, flying or exporting that draft.
   Keep existing visible native-step normalization when an edit is committed.
   Explicit revert, revision restore and import replacement may replace a draft.
3. Verify empty/out-of-range inputs, linked axes, algorithm/profile navigation,
   language refresh and reopen with focused regressions and actual three-engine
   editor interaction. Run full practice checks and production build/offline
   checks for the changed delivered module.

The independent Advanced audit found no new defect. Its controller/worker/Regional
tests and a 45-case state-continuation sweep cover five algorithms, three
templates and three frequencies with filtering/noise enabled. This is additional
software correctness coverage, not a new timing benchmark or aircraft validation.
Unchanged source-bound numerical evidence may be retained after hash checks.

The original phase disposition above remains authoritative. Available software
can be completed without radio/pilot sessions, but measurements, wider physical
platforms and public rollout retain their gates. Advanced remains optional,
unscored and ineligible as the default. Finish the reproduced correction and
commit the verified result for normal Pages integration.

### Sixth-review completion

The numeric-draft correction and ten regressions are implemented and independently
reviewed. All 683 practice tests, 75 native tests, 120 current-main publication
integration tests, six editor-browser cases, release validation and three-module
lint/formatting pass. The production build, manifest/archive integrity and actual
Academy/World online/offline checks pass within unchanged limits. The
[combined receipt](fpv-tuning-sixth-review-verification.json) binds the evidence.

No further actionable software defect emerged from this bounded review. All
available software items are complete; the original measurement, device and
public-rollout gates remain explicitly open. Advanced promotion is still gated.

## Seventh review — late imports and installed updates

Reviewed 17 October after rebasing all seven feature commits onto current `main`
at `8b0199194`. Main adds Overflight pacing, audio and host corrections. Its
changed tests must pass; source hashes confirm the previously qualified tuning,
native and Advanced modules were unchanged by that rebase.

| Additional primary example | Finding and bounded recommendation |
| --- | --- |
| [Nicholas Young preset](https://raw.githubusercontent.com/betaflight/firmware-presets/master/presets/2025.12/rates/FaderFPV.txt) and [included defaults](https://raw.githubusercontent.com/betaflight/firmware-presets/master/presets/2025.12/rates/defaults.txt) | This community preset in Betaflight's repository includes root-relative defaults, sets Actual 720°/s and offers 540°/s. Exercise ordered local resolution and preserve a selected throttle baseline. Its firmware-family metadata does not identify an exact supported firmware release. |
| [Betaflight PWA update change](https://github.com/betaflight/betaflight-configurator/pull/4059) and [2026.6.2 tagged configuration](https://raw.githubusercontent.com/betaflight/betaflight-configurator/2026.6.2/vite.config.js) | Maintainers replaced forced refresh with a user decision to avoid interrupting work; current tagged configuration retains prompt-based registration. Verify that discovering an update neither reloads an active flight nor discards tuning. |
| [Liftoff 1.0.1, 11 August 2025](https://www.liftoff-game.com/news/update-101-released) | Fixes the editor selecting the wrong rates model for a non-Betaflight drone setup. Keep assigned profiles, visible algorithms and evaluated settings consistent across navigation; prior regressions cover those transitions. |

These examples concern documented behavior, not independently verified flight
fidelity. They do not justify new algorithms, automatic family-wide compatibility,
a preset catalog or unmeasured aircraft effects.

The literal Nicholas Young bundle was checked through the production resolver
and importer with explicitly selected `2025.12.5`: the default and optional cases
produce 720°/s and 540°/s on all axes while preserving a nondefault throttle curve
and scale limit. Source hashes and observations belong in this review's receipt.
No third-party preset commands were executed.

The review identified two concrete software tasks:

1. **Protect newer edits from a late import preview.** A held source digest
   reproduced an import replacing blank/off-step numeric input entered while the
   preview was pending. Such text does not change the last valid evaluator, so
   comparing evaluated values alone is insufficient. Cancel admission on numeric
   edits, retain the newer draft and require explicit re-preview. Cover native
   and CLI input, edit-back, navigation/revert and real-browser digest completion.
2. **Qualify an existing local offline installation updating.** Use two normal
   generated package revisions with an inert fixture difference. Keep an active
   flight open while discovering/preparing the update; verify its immutable
   configuration, retained library/profile history and absence of forced reload.
   Activate through the existing lifecycle, reopen with the same browser profile
   and verify saved rates/setup plus offline operation. Do not clear caches or
   repopulate storage to produce a pass. Distinguish this local update fixture
   from historical migration, public HTTPS, production authentication, eviction
   and untested physical platforms.

Run meaningful targeted regressions, the full practice suite, current-main
integration checks, actual browser editor/update tests, native staging, release
validation and normal production Pages online/offline checks. Reuse prior
numerical results only where all their source hashes still match. Preserve
original failure reports and unchanged limits/rollout gates.

This closes additional software evidence without treating the user's unavailable
radio/pilot sessions, absent aircraft measurements, wider physical platforms or
public rollout as completed. Advanced remains optional, unscored and ineligible
as the default. New research is an audit lead, not a reason to keep adding scope.

### Seventh-review completion

Both tasks are implemented and independently reviewed. The late-preview fix has
nine new regressions and real-browser coverage. The generated-package update
check passes Academy and World through waiting-worker discovery, natural
activation and a full offline browser-process restart with saved tuning intact.

All 692 practice tests, 105 current-main integration tests, 75 native tests, six
editor-browser cases, release validation and four-module lint/formatting pass.
The normal production build, full manifest/archive verification and Academy/World
online/offline checks pass within unchanged capacity limits. The
[combined receipt](fpv-tuning-seventh-review-verification.json) binds the final
sources and preserves the initial browser-harness failure. Prior numerical and
Advanced comparison evidence is reused only after matching every source hash.

All available software items are complete. The original physical, platform,
public-rollout and Advanced promotion gates remain open as documented above;
this local result does not claim completion of those measurements or deployment.

## Delivery continuation — 17 October 2026

The remaining-work audit found no missing core rates, profiles, transfer or
controller feature. It identified three locally available qualification steps
and the normal repository delivery path. These extend the evidence rather than
adding another tuning feature:

1. Run the installed Electron desktop wrapper against current sources, including
   saved tuning, Advanced practice, native export and process reopen. Keep iOS
   runtime and the wider physical device matrix open; this machine has no full
   Xcode installation.
2. Exercise bounded moving, dense Regional terrain with changing admitted frames
   and transactional waits. Measure the production worker/host path without
   competing local qualification workloads. Preserve any failure and retain the
   fixed simulation frequency; a single-host result cannot qualify other devices.
3. Check a genuine pre-feature `main` installation updating to this feature, using
   isolated source exports and browser profiles. Verify legacy settings and saved
   progress migrate/persist before testing the new tuning offline. Distinguish
   this from the earlier inert-revision lifecycle fixture and from public HTTPS.
4. Submit the committed branch through the existing repository checks, retain
   unchanged publication caps, and use the ordinary main publication workflow
   for live delivery. Bind any live acceptance to the exact deployed commit.

[PR #1561](https://github.com/mekhovov/revealline/pull/1561) remained a draft
until the final implementation's 12 non-skipped product checks passed. It then
became ready and the normal repository controller merged it as `b2f251dac`.
The ordinary main publication's build, deploy and verification all succeeded.
Physical radio/pilot work, measured aircraft fitting, wider hardware, validated
propwash/ground effect and Advanced competition/default promotion retain their
original prerequisites.

### Delivery qualification completed locally

- **Historical migration:** the authentic old-main browser update exposed camera
  defaults overriding saved tilt/FOV. Academy and World now restore old camera
  preferences before constructing their first tuning library. Eight regressions
  and the genuine update/offline process-restart check pass; original failure
  receipts remain available.
- **Dense Regional flight:** the admitted Urban source requires up to 124
  colliders per frame. The measured bound is now 128; the derived total recorded
  collider-definition ceiling also rises from 32,768 to 65,536. Geometry, byte,
  frame-count, event-count and publication limits remain unchanged. Three 120-second moving
  flights pass at 15.093×–15.740× real time, including complete rejection/wait
  rollback, replay and recovery. This does not qualify other hardware, graphics
  throughput or maximum-duration dense flights.
- **Native:** installed Electron 44.3.0 preserves rates, imported profiles and
  camera across restart; the final 290-tick Regional export replays exactly.
  Ordinary locked desktop/iOS resource stages verify. iOS runtime remains open.
- **Integration:** 701 practice tests, 44 integration tests, six browser editor
  cases and release validation pass. Initial GitHub failures are preserved and
  corrected: the optional test job installs its pinned persistence dependency;
  the shared adapter retains its canonical native bridge import with one strict,
  declared optional-builder capability; two stale test assumptions are corrected.
- **Numerical matrix:** the fresh six-runtime check passes all 250/500/1,000 Hz
  gates with 20 matching source pins and identical arena/Regional hashes. Frozen
  250 Hz has at most 1.8814% response-metric error and at least 60× capacity on one
  Apple M4 Pro. Headless timing excludes rendering and production streaming; this
  does not qualify the wider device matrix or real-aircraft fidelity.
- **Pages:** the ordinary production build passes online/offline acceptance and
  all 3,433 manifest hashes. Publication limits are unchanged. The public old-main
  baseline passes normal password access and preserves offline installations for
  the upgrade. Exact committed CI and main publication subsequently passed; the
  [public delivery receipts](fpv-public-delivery-artifacts/delivery-summary.json)
  and [fresh password check](fpv-public-fresh-password-acceptance.json) bind those
  results to the deployed merge. Public installed-update acceptance is recorded
  separately in the [Pages testing guide](fpv-pages-live-testing.md).

See the [migration evidence](fpv-historical-update-qualification.md),
[dense terrain evidence](fpv-regional-urban-streaming-qualification.md),
[native evidence](fpv-native-current-runtime-20261017.json),
[numerical matrix](fpv-advanced-runtime-qualification-2026-10-17-eighth-review.json), and
[Pages evidence](fpv-pages-delivery-live-testing-evidence.json).

### Public delivery completed

The [public delivery verification](fpv-public-delivery-verification.json) binds
the deployed merge, all 12 non-skipped product checks, successful main publication
and the retained actual archive/inventory receipts. Both Academy and World pass
[fresh installation](fpv-public-fresh-install-acceptance.json) and the
[authentic old-main update](fpv-public-delivery-acceptance.json) on public HTTPS.
The checks use ordinary password access, visible installers and new browser
processes reopened offline. Saved settings/cameras, rates, CLI patches, backup
restore, draft revert and short Advanced export/replay/disposal are verified
within the scopes recorded in each receipt.

The [Pages guide](fpv-pages-live-testing.md) preserves baseline provenance,
resumed activation checkpoints and all failed harness attempts. Four test-harness
corrections required no deployed-runtime changes. Short neutral-input flights
establish lifecycle behavior; they do not qualify physical fidelity or performance.
All available software and this public delivery scope are complete. The deferred
physical, wider-platform and Advanced promotion gates above remain open.

## Post-publication review — atomic setup changes, preset options and flight limits

Reviewed again on 17 October 2026. The delivery-evidence commit was rebased onto
`63c36670a` before new edits; that main update contains only unrelated Snake
evidence/tests. The user again requested completion and supplied the live test
credential. Credentials remain transient and are excluded from project files.

Fresh primary-source examples refine the existing acceptance work:

| Source reviewed | Observation | Decision for this SIM |
| --- | --- | --- |
| [WebFPV patch notes](https://webfpv.org/notes/) | Separate aircraft tunes/cameras and saved edits prevent one aircraft from replacing another's settings; reported headless checks are distinguished from pilot testing. | Exercise setup creation/selection and storage failure as one user operation. Keep physical qualification separate from browser regressions. |
| [FPV Tools](https://github.com/FPVibe/fpv-tools#-rate-profile-comparison) | Browser-local profile history, overlay comparison and CLI transfer; its merge tool explicitly identifies base/import and target firmware. | Retain per-profile drafts, explicit patch baselines and versioned transfer receipts. Verify failures preserve the active library and draft. |
| [QuadMath browser SIM](https://quadmath.com/sim.html) | Aircraft build estimates feed mass, inertia, thrust, motor response and battery sag; the page labels them approximate and separates CLI settings. | Continue to distinguish rate/throttle compatibility from measured aircraft replication. Do not introduce unvalidated effect sliders to close a qualification gate. |
| [SimITL](https://github.com/AJ92/SimITL) and [pr0p](https://pr0p.dev/) | Actual Betaflight execution is a distinct architecture; the published SimITL README identifies its firmware basis and native build targets. | Preserve the controller interface and explicit RC-processing ownership. Actual firmware integration remains a separately scoped future decision with its own timing, replay, delivery and licensing review. |

These are documented product features and implementation descriptions, not
independently verified flight fidelity. They do not add an online preset catalog,
another firmware family or automatic PID conversion to this release.

### Software corrections completed in this review

1. **Atomic drone duplication.** Creation and selection now commit in one write,
   retaining immutable submitted values, revision checks and validation. A quota
   or stale-write failure leaves the saved library, displayed selection and draft
   unchanged. A successful retry replaces the previous error with an EN/UK
   confirmation. Unit and real-browser failure/retry checks pass.
2. **Export at a flight limit.** Typed duration/capacity errors pause the arena
   attempt and preserve export, reference capture and explicit restart. Resume
   remains disabled until successful restart; lost workers and invalid sessions
   remain fatal. Actual 720-second and capacity-boundary regressions use the
   production worker handler and mounted host, export retained recordings and
   replay exactly. The capacity fixture queues high-cadence input through the
   supported input API; it does not claim that the browser host polls at 250 Hz.
   Timing, duration, recording and recovery limits are unchanged.
3. **Case-insensitive preset options.** The exact tagged [Betaflight App parser](https://github.com/betaflight/betaflight-configurator/blob/2026.6.2/src/components/tabs/presets/PresetsRepoIndexed/PresetParser.js)
   matches option names case-insensitively. A root option labelled `Race rates`
   now controls an included `RACE RATES` option. Visible labels and ordering are
   preserved, ambiguous case-only duplicates are rejected, and default, explicit
   and disabled selections match independently executed upstream fixtures.
   This correction adds no firmware-version compatibility claim.
4. **Verification.** All 714 practice tests pass, followed by 108 final library/UI
   tests after the retry-message correction. All six final browser editor cases,
   production renderer/worker comparison smoke, lint, formatting and release
   validation pass. The refreshed six-runtime numerical matrix retains exact
   arena/Regional replay agreement and selects 250 Hz; maximum response-metric
   error is 1.8814%, minimum measured capacity 81.08× on one M4 Pro. This remains
   a headless numerical reference, not physical-flight qualification. Ordinary
   desktop/iOS package staging passes with 208 stable source pins. The subsequent
   [actual Electron fixture check](fpv-native-post-publication-runtime.json)
   preserves the complete library across two clean app processes and replays both
   native exports exactly, with all workers disposed. It does not qualify iOS,
   a distributed installer or physical controls. See the [local verification receipt](fpv-post-publication-verification.json).
5. **Delivery completed.** [PR #1562](https://github.com/mekhovov/revealline/pull/1562)
   passed all 12 non-skipped product checks and merged through the normal
   controller as `80494f63d`. The normal [publication](https://github.com/mekhovov/revealline/actions/runs/39002032297)
   passed build, deploy and verification. Both public routes pass ordinary
   password access, saved 900°/s rates, visible offline installation, complete
   browser-process restart offline and short unscored export/exact replay/worker
   disposal. The actual archive remains 966,676,480 bytes, within the unchanged
   cap. See the [final delivery receipt](fpv-post-publication-delivery-verification.json).
   A concurrent main change only adds a display-density attribute to an authoring
   test page; every FPV qualification source pin remains unchanged in the merge.
   Current public acceptance covers fresh installations; authentic existing-update
   receipts retain their earlier source scope.

All available software corrections and this delivery scope are complete. The
fresh public flights establish lifecycle behavior, not aircraft fidelity. The
desktop result is an actual Electron fixture check, not an iOS or installer claim.

Physical radio/touch hardware, pilot feedback, identified-aircraft measurements,
iOS execution and broader hardware remain unavailable. Those dependencies do not
block these software corrections or justify enabling scored/default Advanced.
