# FPV tuning implementation status

Updated 2026-10-17. The previous boundary corrections are merged in
[PR #1564](https://github.com/mekhovov/revealline/pull/1564) and published as
`fb3caf12bd43743670f47c42dc21f7a406223379`. Available software work and delivery
for that prior continuation are complete. The input-availability continuation
below is awaiting fresh checks and publication. Physical and wider-platform qualification
remain deferred; Advanced remains optional, unscored and default-ineligible.
Historical reports below retain their original source hashes and scope.

## Input availability continuation

The [latest review](fpv-tuning-input-recovery-review.md) preserves the completed
rates/profile/import scope and opens one reproduced recovery defect: unavailable
radio input disables a healthy Advanced practice worker and its exports. The
correction keeps input failure recoverable while preserving fatal worker handling.
The live-test runner also gains bounded startup diagnostics so future failures
retain more evidence than the earlier unexplained timeout. Review prompted a
correction that restricts request/capture error metadata to fixed categories.
All 741 practice tests and browser/native recovery pass. Fresh release checks and
publication for this correction are in progress.

## Boundary completion review

Rebased on main `1d631986a` before this continuation. The
[updated boundary review](fpv-tuning-boundary-review.md) adds primary-source
examples and closes three reproduced gaps: history restoration invalidates stale
import intent; preset `FORCE_OPTIONS_REVIEW: yes` metadata matches the tagged
parser; Regional duration/recording stops retain export, recovery and explicit
restart without misclassifying them as broken workers. Unknown worker failures
remain unavailable and Advanced remains unscored.

All **731 practice tests** and release validation pass. Six editor-browser cases
pass, including delayed import completion after restoring same-rate history.
All 20 pins in the existing numerical matrix still match; no physics, timing or
quota change was made. Current browser/native receipts and ordinary delivery are
bound by the [final delivery verification](fpv-boundary-delivery-verification.json).
Both fresh public password/offline flows pass. An earlier World startup timeout
remains recorded with an unknown cause; reopening its profile and a full fresh
rerun succeeded. Earlier reports below keep their original scope.

## Post-publication corrections

The refreshed-main review found and fixed three concrete issues:

- Duplicate drone creation and selection now commit atomically. Quota or stale
  edit failure preserves both the saved library and the visible draft/selection.
  A successful retry replaces the earlier error with an EN/UK success message.
- Local preset bundles now match option names case-insensitively, including root
  options controlling included files, as the independently executed tagged
  Betaflight App parser does. Original labels and provenance remain intact;
  ambiguous case-only duplicates are rejected. Firmware support is unchanged.
- Reaching the Advanced duration/recording limit preserves export, reference
  capture and explicit restart. Resume stays disabled until successful restart.
  Typed, allowlisted worker errors distinguish these stops from fatal failures.
  The 12-minute duration, recording quotas, physics, timing and identities remain
  unchanged. Actual boundary regressions export and replay retained recordings.

The [updated plan](fpv-tuning-completion-plan.md#post-publication-review--atomic-setup-changes-preset-options-and-flight-limits)
records the additional primary-source research and scoped acceptance work.
The [new verification receipt](fpv-post-publication-verification.json) pins the
final sources: 714 practice tests, 108 final library/UI tests, six browser editor
cases, renderer/worker smoke, six numerical runtimes and ordinary native staging
pass. The numerical 250 Hz result stays within 1.8814% of the 2 kHz reference and
measures at least 81.08× capacity on one host. The later
[actual Electron fixture check](fpv-native-post-publication-runtime.json)
retains the full library across process reopen, verifies both native recording
exports and disposes every worker. It adds desktop fixture evidence without
claiming iOS or a distributed installer.

[PR #1562](https://github.com/mekhovov/revealline/pull/1562) subsequently merged
as `80494f63d` after all 12 non-skipped product checks passed. Normal Pages
publication passed build, deploy and verification. Both fresh public installations
pass normal password access, saved 900°/s rates, offline process restart and short
unscored recording export/exact replay/disposal. The
[final delivery receipt](fpv-post-publication-delivery-verification.json) binds
those checks to the deployed source and the unchanged archive capacity limit.
All available software work in this review is complete; prior public reports
below remain historical and do not become evidence for this later source.
Advanced remains optional and unscored. Physical radio/touch, pilot feedback,
identified-aircraft measurements, iOS runtime and wider-device qualification are
deferred; propwash/ground effect and scored/default promotion remain gated.

## Public delivery

The [CI receipt](fpv-public-delivery-ci.json) records all 12 non-skipped product
checks passing for the final implementation commit. General test/build jobs were
explicitly skipped and are not counted as passes. The [publication receipt](fpv-public-delivery-artifacts/delivery-summary.json)
binds the live site to merge `b2f251dac0d762d476f725b1bc601a2d6d5485a5`.
Its 3,442 staged files total 963,681,552 bytes; the actual uploaded archive is
966,676,480 bytes, leaving 13,323,520 bytes below the unchanged 980,000,000-byte
cap. The empty optional-release catalogue is present; that catalogue check does
not qualify separately selected optional releases.

The [fresh public-password check](fpv-public-fresh-password-acceptance.json)
passes Academy and World on the exact deployed version. Each fresh isolated
Chrome context starts locked, accepts the ordinary password form and opens
Rates & throttle without page errors. Credentials are excluded from evidence.
The [fresh-install check](fpv-public-fresh-install-acceptance.json) also passes
visible offline preparation, a complete offline browser-process restart, retained
900°/s rates and Advanced recording export/exact replay/worker disposal on both
routes. The [existing-install update](fpv-public-delivery-acceptance.json) passes
both authentic old-main profiles: natural worker activation, offline process
restart, preserved Legacy settings and 27°/108° camera, CLI patch import, backup
restore, draft revert and Advanced export/exact replay/disposal. Academy resumes
an explicitly recorded earlier activation checkpoint; World observes activation
in the final run. The [Pages guide](fpv-pages-live-testing.md) retains the failed
harness attempts and exact baseline provenance. No old install was recreated to
manufacture an update pass. Both flight checks use short neutral-input recordings
and establish lifecycle behavior only.
No manual merge, deployment, forced worker activation or capacity override was
used. Advanced remains optional, unscored and default-ineligible; physical
aircraft/radio/touch/pilot and wider-platform qualification remain open.
The [combined public receipt](fpv-public-delivery-verification.json) records
completion of the available software delivery scope and hashes its evidence.

## Current delivery — historical migration and bounded Urban flight

The actual pre-tuning main → feature [update check](fpv-historical-update-qualification.md)
passes Academy and World, using historical commit `8b0199194` and each version's
own package builder. It exposed a real migration-order defect: the new library
captured default camera values before restoring the saved camera. Both hosts now
restore that baseline first, while an existing tuning library stays authoritative.
The 27° tilt / 108° vertical FOV, Legacy response and synthetic radio data survive
the update; newly saved rates and drone settings survive a second offline process
restart. The original migration failure and an asynchronous-save probe failure
remain recorded. This covers that historical version locally, not every release
or physical radio behavior.

The [moving Urban check](fpv-regional-urban-streaming-qualification.md) closes a
bounded admission gap: its initial 79-collider window exceeded the former limit
of 64. The per-frame limit is now 128; the derived recorded-collider definition
ceiling also rises from 32,768 to 65,536. Geometry, byte, frame-count and event-count
limits remain unchanged.
Three 120-second routes reach the 124-collider window, replay exactly and pass the
2× gate at **15.093–15.740×** on one Apple host. The loop includes streaming,
worker messages, admission and recording; it excludes GPU rendering and network
transfer. Complete rejection/adoption rollback and verified recovery pass.
The earlier rejection and unpaced-probe failures remain available. These results
do not qualify arbitrary regions, maximum-duration dense performance or other
devices.

The [current native report](fpv-native-current-runtime-20261017.json) binds **204
source hashes**. Actual Electron 44.3 preserves the complete library, import
receipt and 32°/104° drone camera across process reopen. The final Regional worker
exports a 290-tick recording through the OS Save dialog; replay verifies hash
`e3aef0ae`, and returning to Legacy/disposal leaves zero workers and no page or
stderr errors. Ordinary desktop/iOS staging retains the access gate, CSP and
limits. iOS execution remains unavailable without Xcode/simulator.

The [initial CI failures](fpv-delivery-ci-initial-failure.json) are preserved.
The optional test job now installs its pinned authoring test dependencies. The
canonical generated iOS-bridge import is restored, with an exact shared
builder/publication capability check and its sparse-workflow dependency listed.
Tests retain their assertions while using the existing 180-file World envelope
and waiting for actual asynchronous export completion. No production dependency
collector is bypassed and no test is disabled; the hosted reruns subsequently
passed as recorded in the public delivery receipt above.

All **701 practice tests**, **44 integration tests**, six editor-browser cases and
release validation pass. The normal [Pages build/checks](fpv-pages-delivery-live-testing-evidence.json)
also pass within unchanged limits. The [public baseline](fpv-public-delivery-baseline.json)
accepts the real password through its normal form on both old-main SIM pages and
prepares preserved offline installations for the coming upgrade. The fresh
[six-runtime numerical matrix](fpv-advanced-runtime-qualification-2026-10-17-eighth-review.json)
passes all 250/500/1,000 Hz gates with 20 matching source pins and identical arena
and Regional hashes. At the frozen 250 Hz, maximum response-metric error is
1.8814% and minimum capacity is 60× on one Apple M4 Pro; this excludes rendering
and production streaming. Exact committed CI and main publication subsequently
passed; public-browser results are recorded separately above. Physical aircraft,
radio/touch, pilot and wider-platform gates remain open. Advanced stays optional,
unscored and default-ineligible.

## Seventh review — historical late imports and existing offline updates

The [updated plan](fpv-tuning-completion-plan.md#seventh-review--late-imports-and-installed-updates)
adds concrete examples from Betaflight's preset repository, its prompt-based PWA
update behavior and Liftoff's rate-model selection correction. The literal
Nicholas Young bundle resolves both its 720°/s default and 540°/s option while
preserving a nondefault throttle baseline. No new firmware family is advertised.

A reproduced race allowed a delayed import preview to overwrite newer incomplete
numeric input because it compared only the last valid evaluated values. Numeric
input/change now cancels pending preview admission before validation. Nine
regressions cover native/CLI input, blank/off-step/valid edits, navigation,
edit-back, revert and explicit re-preview. Independent out-of-order completion
checks confirm a cancelled old digest cannot clear a newer pending preview.

All **692 practice tests**, **105 current-main integration tests**, **75 native
tests** and the six [editor browser cases](fpv-tuning-browser-seventh-review-qualification.json)
pass. The first browser attempt requested an export inside a collapsed transfer
panel; its [failure](fpv-tuning-browser-seventh-review-collapsed-transfer-failure.json)
is retained. Opening the panel through its normal UI corrected the probe without
changing production behavior. The final check uses a deliberately held digest
callback and real WebCrypto completion; it is not a hardware-latency measurement.

The new [existing-install update check](fpv-offline-update-seventh-review.json)
passes Academy and World. A new worker waits while the old controller and paused
800°/s recording remain unchanged; saved 900°/s next-flight settings, profile
history, assigned drone and camera survive byte-for-byte. After scope tabs close,
normal activation occurs. A full Chrome restart with the same profile offline
loads the new revision and flies/exports at 900°/s. No cache deletion or forced
activation is used. The revisions differ by an inert CSS fixture; this qualifies
local generated-package lifecycle, not historical schema migration, public
HTTPS, real-password acceptance, eviction or physical-device behavior.

The [native receipt](fpv-native-seventh-review-staging.json) records 200 stable
source hashes: desktop 183 files / 18,281,667 bytes and iOS 188 files / 18,355,894
bytes, with access gates, CSP and limits unchanged. No native runtime was launched.
Prior numerical and Advanced comparison reports retain historical status, with
all 20 and 23 source pins respectively still identical.

Release validation passes 3,328 distribution files, 13,651 EN/UK messages,
9,049 references and generated runtime/assets checks. The seven existing
navigation warnings are unchanged; four-module lint and formatting pass.

The normal production build and [Pages checks](fpv-pages-seventh-review-live-testing-evidence.json)
pass Academy and World online and in isolated offline contexts. All 3,433 manifest
entries and the ZIP checksum verify; the changed runtime module matches current
source. The publication has 3,435 files / 963,672,685 bytes, with 7,704,832 bytes
of conservative archive headroom below the unchanged cap. The historical sixth
temporary build was removed only after checking its recorded manifest and ZIP
digests; repository evidence remains unchanged.

The [combined seventh-review receipt](fpv-tuning-seventh-review-verification.json)
binds the final sources, new checks, literal preset observations and preserved
failure. Both concrete tasks are complete, with no further actionable software
issue found in independent review. All available software scope is complete.
Physical measurements, wider platforms, public publication and promotion gates
remain open; Advanced is optional, unscored and ineligible as the default.

## Sixth review — historical incomplete numeric drafts

The [updated plan](fpv-tuning-completion-plan.md#sixth-review--preserve-incomplete-numeric-drafts)
adds primary examples from Keymap PROPWASH, TRYP, DRL and Orqa. They reinforce
portable rates, independent profiles/calibration and preserved replay identities;
no new physics effects or firmware compatibility claims are added.

The audit reproduced and fixed an editor transition bug: an unfinished numeric
entry could revert to the previous valid value after algorithm/profile navigation,
reopening or language refresh. The editor now retains unresolved text per profile,
algorithm and field, keeps its invalid state visible, and requires correction
before save/test/export. Native-step normalization and linked edits still work;
explicit revert, revision restore and import replacement replace their drafts.
Unsaved text remains session-local and is not promised across browser reloads.

Ten new regressions pass. All **683 practice tests**, **120 upstream publication
integration tests**, three-module lint/formatting and the six
[Chrome/Firefox/WebKit editor cases](fpv-tuning-browser-sixth-review-qualification.json)
pass. Browser checks cover desktop and narrow touch emulation, not physical touch
hardware. Independent review and additional stale-tab/action checks found no
further actionable issue.

The independent Advanced audit passes 55 focused tests and a 45-case sweep of
complete rollback, verified recovery, exact continuation, replay and reset across
five rate models, three templates and three frequencies with smoothing/noise.
It makes no new physical, performance or native-runtime claim. All 20 source pins
in the third-review numerical report and all 23 pins in the fifth-review Advanced
comparison report remain identical; those observations remain historical.

The [native staging receipt](fpv-native-sixth-review-staging.json) records
**75 passing tests** and 200 stable source hashes. Ordinary desktop staging
contains 183 files / 18,281,358 bytes; iOS staging contains 188 files / 18,355,585
bytes. Access pages, CSP, resource routing and package limits are unchanged.
This review does not launch or qualify Electron/iOS runtime behavior.

Release validation passes 3,328 distribution files, 13,651 EN/UK messages,
9,049 references and generated runtime/assets checks. The seven existing
navigation warnings are unchanged.

The normal production build and [generated Pages checks](fpv-pages-sixth-review-live-testing-evidence.json)
pass Academy and World online and in isolated offline contexts. All 3,433 manifest
entries and the ZIP checksum verify; the changed module matches current source.
The publication contains 3,435 files / 963,654,909 bytes, with 7,722,752 bytes
of conservative archive headroom under the unchanged cap.

The [combined sixth-review receipt](fpv-tuning-sixth-review-verification.json)
binds these final sources and results. The reproduced defect is closed and the
available software scope is complete. Original physical/platform/public-rollout
gates remain open; Advanced stays optional, unscored and default-ineligible.
The commit is ready for normal reviewed Pages integration and does not deploy.

## Fifth review — historical firmware identity and pending aircraft saves

The [updated plan](fpv-tuning-completion-plan.md#fifth-review--exact-firmware-headers-and-asynchronous-saves)
adds primary examples from FPVSIM, CurryKitten, FPV Freerider and Uncrashed.
They reinforce consistent comparison conditions, explicit application/saving,
calibration separation and frozen replay settings. Independent audits reproduced
and corrected two software gaps:

- Explicit unsupported firmware headers retain their entire version, including
  development, release-candidate and build suffixes. Old/future versions cannot
  be treated as headerless, and a development build cannot borrow an exact
  verified release's defaults. Conflicting manual selections and multi-header
  files reject atomically. Exact supported tags and genuine headerless workflows
  remain supported; the verified firmware set has not expanded.
- An Advanced aircraft save captures its submitted values and prevents duplicate
  pending saves. Later valid or incomplete edits remain visible and unsaved when
  the earlier request completes. Successful captures become the revert baseline;
  failed saves preserve it and allow retry. Late completion cannot update a
  disposed editor. Running attempts retain their frozen configuration.

Both fixes passed independent review. The full practice suite passes **673 tests**
(668 top-level and five nested), with no failures, skips or cancellations.
All **75 native tests**, **79 current-main publication integration tests** and
seven-module lint/formatting checks pass.

The six [editor browser cases](fpv-tuning-browser-fifth-review-qualification.json)
pass in Chrome, Firefox and WebKit, desktop and narrow touch emulation, including
unsupported-header preview/save rejection with unchanged library bytes. All 23
source hashes match. The [actual Advanced browser check](fpv-advanced-comparison-fifth-review.json)
holds the save callback, submits mass 0.8, retains a newer 0.9 draft and confirms
the active worker still uses 0.65. Explicit revert/restart then uses 0.8. This is
controlled asynchronous-callback testing, not a measurement of real lock
contention. All eleven workers terminate; prior ghost/tamper/class/cancellation
checks pass and there are no browser errors.

The [World/Regional check](fpv-advanced-regional-browser-smoke-2026-10-16-fifth-review.json)
passes recording replay, recovery adoption, corruption rejection, cancellation,
landing/takeoff and Legacy return. All 143 source hashes match; five workers are
disposed with no page errors. The [native staging receipt](fpv-native-fifth-review-staging.json)
verifies 172 runtime source hashes, desktop 183 files / 18,280,517 bytes and iOS
188 files / 18,354,744 bytes. Security policies and package limits remain
unchanged. No Electron/iOS runtime interactions were repeated; previous actual
Electron evidence remains historical, and iOS runtime remains unavailable.

All 20 source pins in the [third-review numerical matrix](fpv-advanced-runtime-qualification-2026-10-16-third-review.json)
still match exactly. Its six-runtime numerical/determinism observations remain
historical evidence; this review does not claim a new timing run. Dynamics,
backend identities, frozen 250 Hz frequency and promotion gates are unchanged.

Release validation passes 3,328 distribution files, valid literal references,
13,651 EN/UK messages and 9,049 references, plus generated runtime/asset checks.
The seven existing navigation warnings remain unchanged.

The normal production build and [generated Pages check](fpv-pages-fifth-review-live-testing-evidence.json)
pass Academy and World online and in isolated offline contexts. All 3,433 manifest
entries and the ZIP checksum verify, and both changed runtime modules match the
checkout. The 3,435-file publication is 963,654,068 bytes; the conservative archive
forecast leaves 7,723,264 bytes below the unchanged 980,000,000-byte cap.

The [combined fifth-review receipt](fpv-tuning-fifth-review-verification.json)
binds the final implementation and results. Both reproduced software gaps are
closed; no additional actionable gaps were found in the bounded workflow,
transfer and lifecycle audits. The available software scope is complete and ready
for normal reviewed Pages integration. The original physical, wider-platform and
public-rollout gates remain open; Advanced stays optional, unscored and ineligible
as the default. This local commit does not deploy Pages.

## Fourth review — historical calibration, presets and integration evidence

The [updated plan](fpv-tuning-completion-plan.md#fourth-review--calibration-and-preview-boundaries)
adds primary-source findings from Betaflight App, WebFPV, QuadMath and SimITL.
The review reproduces and closes four concrete software gaps:

- Preset option and entry changes invalidate the generated result. **Preview
  import** and **Save import as new profile** require a fresh resolution; changing
  entry clears the previous options, and deliberate pasted CLI input remains
  supported. The saved receipt describes the choices that produced the saved curve.
- Failed drone selection restores the actual current setup in the selector while
  preserving its draft. Quota and stale-tab failures cannot mislabel a subsequent
  save as targeting a different drone.
- Academy/World radio calibration imports preserve player rates and the existing
  legacy migration response, with no rate-apply/restart callback. Complete source
  validation remains mandatory, and EN/UK messages identify ignored response
  settings. Standalone legacy radio-editor imports retain their prior behavior.
- Main's new frozen-source replay observer now explicitly pins the rates and
  response modules needed by the feature. Legacy and tuned recordings replay in
  both hosts; missing dependencies and changed executable bytes remain rejected.

Independent cross-reviews found no remaining issues in these changes. All
**664 practice tests** pass (659 top-level and five nested), including long-flight
recording/recovery. All **75 native tests**, **10 pointer tests**, and nine-module
lint/formatting checks pass. The practice-observer suite passes **170 tests**;
its one opt-in historical-snapshot case is skipped without a supplied fixture.
The initial six observer failures exposed the missing dependency pins above;
the corrected final run passes without relaxing executable admission.

All six [editor browser cases](fpv-tuning-browser-fourth-review-qualification.json)
pass in Chrome, Firefox and WebKit, desktop and narrow touch emulation. They
cover real folder upload, stale option refusal, entry switching, receipts and
cross-tab selection rollback. All 23 source hashes match the final implementation.
The [World/Regional check](fpv-advanced-regional-browser-smoke-2026-10-16-fourth-review.json)
passes recovery adoption, corruption rejection, cancellation, landing/takeoff,
replay and Legacy return. All 143 source hashes match, all five workers terminate
and there are no page errors.

The [native staging receipt](fpv-native-fourth-review-staging.json) verifies all
172 runtime sources. Desktop staging contains 183 files / 18,279,753 bytes; iOS
contains 188 files / 18,353,980 bytes. Security policies and package limits remain
unchanged. This review does not repeat Electron or iOS runtime interactions;
previous actual Electron evidence remains historical and iOS runtime remains
unavailable.

All 20 source pins in the [third-review numerical matrix](fpv-advanced-runtime-qualification-2026-10-16-third-review.json)
still match exactly. Those six-runtime numerical/determinism observations are
reused as historical evidence, not relabeled as a new benchmark. The backend,
dynamics, 250 Hz frequency and promotion policy are unchanged.

Release validation passes 3,328 distribution files, valid literal references,
13,651 EN/UK messages and 9,049 references, generated assets and runtime checks.
The seven existing navigation warnings remain unchanged.

The normal production Pages build and [generated-site checks](fpv-pages-fourth-review-live-testing-evidence.json)
pass Academy and World online and in isolated offline contexts. All 3,433 manifest
entries and the ZIP checksum verify, with seven changed FPV/shared-install
modules matching the checkout. The 3,435-file publication is 963,653,304 bytes;
its conservative archive forecast leaves 7,723,776 bytes below the unchanged
980,000,000-byte cap. No build or publication policy was relaxed. The initial
supplemental checkout comparison included an unrelated civilian-flight module
outside this inventory; restricting that comparison to the changed FPV/shared
modules required no artifact changes. Every manifest entry was still verified.

All currently actionable software items are complete. The
[combined fourth-review receipt](fpv-tuning-fourth-review-verification.json) binds
implementation, test and delivery evidence. The user-deferred radio/pilot
sessions, missing aircraft measurements, wider physical-platform qualification
and public-deployment gates remain open. Advanced remains optional, unscored and
ineligible as the default; this commit is ready for the normal reviewed Pages
integration process and does not deploy it.

## Third review — historical camera submission and replay chronology

The [updated plan](fpv-tuning-completion-plan.md#third-review--complete-the-available-scope-without-inventing-qualification)
adds primary examples from FlySpark, FPV Web and ShramkoGSFPV, distinguishes the
unavailable Propwash source from verified page reads, and maps every original
phase to delivered software and explicitly deferred acceptance. Two independent
audits found and corrected the following remaining software gaps:

- Camera tilt and vertical FOV now reject empty, nonfinite and out-of-range values
  before saving, duplicating a drone or starting either draft-practice mode.
  Incomplete camera text survives profile/setup navigation and reopening. Valid
  fractional degrees and migrated values remain unchanged; portable rates remain
  independent of unfinished camera edits.
- Advanced replay now checks each declared consumption substep against its sample
  timestamp and mission-admission schedule. A within-mission timing alteration
  previously passed unchanged physics hashes and could misstate CSV command time.
  It now fails in replay, worker recovery and trace export before adoption or
  output-file creation. Honest delayed inputs and queued future samples remain
  valid at 250, 500, 1,000 and the 2,000 Hz numerical reference. This is history
  consistency, not authenticated physical-input capture.

The [editor matrix](fpv-tuning-browser-third-review-qualification.json) passes all
six Chrome/Firefox/WebKit desktop and touch-emulated cases. It exercises all six
camera-consuming actions with invalid values, raw-text retention and fractional
camera test/save/reload, alongside the earlier transfer and draft workflows.
The [World/Regional smoke](fpv-advanced-regional-browser-smoke-2026-10-16-third-review.json)
passes actual-worker recovery adoption, corruption rejection, visible
cancellation, landing/takeoff, recording replay and Legacy return. All five
workers terminate; there are no page errors. These are local browser checks,
not real-touch or aircraft qualification.

The [runtime matrix](fpv-advanced-runtime-qualification-2026-10-16-third-review.json)
retains exact arena/Regional agreement in Node 20/22/24 and Chrome/Firefox/WebKit,
including real workers. Golden hashes remain `46294848` / `9d00dd70`. The frozen
250 Hz mode passes all numerical/contact/capacity gates, with a lowest measured
capacity of 53.571× on this run. Higher candidates also pass this run; the earlier
Firefox 1,000 Hz failure is preserved and is not replaced by a broader hardware
claim. The backend, dynamics and selected frequency are unchanged.

The full practice suite passes **620 tests** (617 top-level and three nested),
with zero failures, skips or cancellations. This includes the maximum-duration
recording/recovery checks. All **15 flight-log tests** pass, including rejection
before either CLI output is written. Lint and formatting pass all **seven changed
modules**. Release validation passes 3,327 distribution files, valid literal
references, EN/UK localization (13,651 messages / 9,049 references), generated
runtime/asset checks and industrial preparation. The seven existing navigation
warnings remain unchanged.

The [native staging receipt](fpv-native-third-review-staging.json) verifies all
172 runtime source hashes and passes **75 native tests**. Desktop staging has
183 files / 18,274,553 bytes; iOS staging has 188 files / 18,348,780 bytes. CSP,
sandbox, resource routing, access pages and package limits remain intact. This
review did not repeat actual Electron runtime interactions; their second-review
evidence remains historical. iOS runtime, signing and physical-device checks
remain unavailable here.

The [generated Pages check](fpv-pages-third-review-live-testing-evidence.json)
passes both simulators online and in isolated offline contexts. All 3,432
manifest entries, the archive checksum and both changed runtime files verify.
The 3,434-file publication is 963,638,027 bytes; its conservative archive forecast
leaves 7,741,184 bytes below the unchanged 980,000,000-byte cap. The ordinary
production builder completed without policy changes. The superseded temporary
build was removed after verifying its recorded hashes; earlier receipts remain.

All currently actionable software items are complete. The
[combined third-review receipt](fpv-tuning-third-review-verification.json) binds
the final sources and checks. The remaining original gates require physical
measurements, wider-platform qualification or reviewed public publication;
Advanced remains optional, unscored and ineligible as the default. A local commit
does not close those gates or deploy Pages.

## Second review — historical draft and recovery evidence

The renewed [plan review](fpv-tuning-completion-plan.md#second-review--draft-integrity-transfer-clarity-and-recovery)
uses additional examples from WebFPV, FPV Tools, VelociDrone, Liftoff and
Betaflight. It identified seven concrete corrections to the already implemented
feature set:

- Drone name, assignment and camera drafts now survive profile changes and editor
  reopening independently. Revision checks still reject another tab's newer saves.
- Normal World and Regional launches replace the previous draft-test origin, so
  later testing and restarting stay in the currently selected environment.
- Numeric fields preserve partial typing and normalize supported increments on
  commit. Save, test and export commit pending values; invalid entries block them.
- Saving an import checks that its preview still matches the visible rates. A
  manual edit cannot silently save an older imported curve.
- A verified CLI header can select a firmware-default patch baseline. Explicit
  version conflicts and unsupported releases remain rejected.
- CLI export exposes the choice to omit throttle, allowing rotation-only transfer
  between versions with different throttle models.
- Imported Advanced recovery replays consumed history in a detached worker and
  compares complete physics/controller/terrain state before adoption. Cancellation
  terminates that candidate and preserves the existing paused flight. Trusted
  internal transaction rollback remains synchronous; backend identities and
  physics timing are unchanged.

The maximum-duration recovery regression passes with 43,200 input changes,
360 terrain events and 24 sparse checkpoints. Its recording/recovery sizes remain
4,983,692 / 5,061,598 bytes. An isolated local run verified recovery in 14.680 s;
that is a local measurement, not a wider-device guarantee. The public verification
deadline is seven minutes, with a visible cancel control.

The refreshed [six-runtime matrix](fpv-advanced-runtime-qualification-2026-10-16-second-review.json)
retains exact arena and Regional replay agreement across Node 20/22/24, Chrome,
Firefox and WebKit. The frozen 250 Hz mode passes every numerical/contact/capacity
gate, with a lowest measured capacity of 7.092×. Firefox's 1,000 Hz candidate
measured 1.602× and failed the 2× capacity gate; that result is preserved without
retry or threshold changes. The 500 Hz candidate passed at 3.610×. These are local
measurements on one ARM64 host, not qualification of the wider platform matrix.
The refreshed [Regional adapter probe](fpv-regional-contact-capacity-2026-10-16-second-review.json)
passes at 5.508× for terrain and 6.339× for mixed scenery. Host counters still show
about 99.5% activity even with task-owned heavy jobs separated; these runs do not
establish performance on an idle host or dense production regions.

All six [final editor cases](fpv-tuning-browser-second-review-qualification.json)
pass in Chrome, Firefox and WebKit with desktop and narrow touch-emulated layouts.
They cover sequential decimal typing, numeric normalization, linked-axis edits,
independent setup drafts, import-preview consistency, header-derived defaults and
rotation-only export. The [final World host check](fpv-advanced-regional-browser-smoke-2026-10-16-second-review-final.json)
passes actual recovery-file adoption, finite-state corruption rejection, visible
cancellation during worker verification, landing/takeoff, recording replay and
disposal. All five workers terminate. A focused host regression also covers
cancellation during file reading and ignores its late completion. Earlier editor
and host receipts remain separate source-bound evidence.

The [second-review native receipt](fpv-native-second-review-qualification.json)
binds all 172 original runtime sources. Desktop staging contains 183 files /
18,272,211 bytes; iOS staging contains 188 files / 18,346,438 bytes. The separate
Electron 44.3 fixture passes headed imports, stale-preview rejection, native CLI
and receipt-backup exports, Regional landing and valid recovery adoption while
paused. The restored position, velocity, orientation, angular state and telemetry
match exactly; both workers terminate with no page errors or stderr output.
The initial automation navigation failure is preserved. The successful fallback
uses normal launcher navigation and actual native file dialogs with the existing
security settings. Current corruption/cancellation coverage comes from the browser
checks; native relaunch/ghost coverage remains explicitly historical. iOS staging
still does not establish iOS runtime, signing or physical-device qualification.

The final Node 22.22.2 practice suite passes **610 tests** (607 top-level and
three nested), with no failures, skips or cancellations. The native build/platform
suite passes **75 tests**, and lint passes all **15 changed modules**. These runs
include the final linked-peer editing and pre-file-read cancellation fixes.
Release validation passes 3,325 distribution files and valid literal references,
EN/UK localization (13,651 messages / 9,049 references), and all generated-runtime
and asset checks. Its seven existing navigation warnings remain unchanged.

The normal production Pages build and [generated-site checks](fpv-pages-second-review-live-testing-evidence.json)
pass for both simulators online and in isolated offline contexts. All 3,430
manifest entries, the download archive and seven changed runtime files verify
against their expected hashes. The 3,432-file publication is 963,612,018 bytes;
the conservative archive forecast leaves 7,773,440 bytes below the unchanged
980,000,000-byte cap. This is a local working-tree artifact, with no public
deployment or Advanced promotion. The new restricted candidate-measurement
workflow does not admit this branch's build-tooling changes; normal reviewed main
publication remains the route described in the [Pages guide](fpv-pages-live-testing.md).

All seven second-review software checks are complete. The
[combined second-review receipt](fpv-tuning-second-review-verification.json)
binds the final changes and verification reports. The original physical,
wider-platform, public-deployment and promotion gates remain explicitly deferred
or unavailable; none is counted as a passing software test.

The sections below preserve the first review's source-bound evidence and claims.
They do not stand in for refreshed verification of the second-review changes.

## First reviewed continuation — historical evidence

The [updated completion plan](fpv-tuning-completion-plan.md) incorporates current
WebFPV, QuadMath, Flight Division, VelociDrone, Liftoff and Betaflight references.
On 16 October the user explicitly deferred physical radio and experienced-pilot
feedback. No identified real-aircraft measurements were provided. Those gates
remain unmeasured and do not block the
remaining software work. Advanced remains optional and unscored.

- Diagnostics follow the active keyboard/touch/controller/radio source and retain
  only accepted mission inputs. Paused live previews and last-flight response are
  labeled separately; unavailable browser/hardware measurements are not invented.
- Imports retain bounded inert receipts with exact source hashes, version
  assumptions, baseline, preset dependencies/options and applied/unapplied fields.
  Revisions and backups preserve them; edited rates cannot claim an unchanged
  imported result. All six [final editor cases](fpv-tuning-browser-final-qualification.json)
  pass in Chrome, Firefox and WebKit, including narrow touch emulation and receipt
  persistence. Physical touch and USB qualification remain deferred.
- Advanced recordings and snapshots now carry recomputed comparison metadata.
  Old supported records without it remain valid. Replay identity retains its
  established meaning; comparison excludes personal rotation/camera choices and
  includes physical constraints and complete Regional terrain history. Forged
  JSON or partial recovery does not count as complete verified comparison evidence.
- The reference arena consumes that metadata through a separate verification
  worker and displays a compatible recording as an unscored ghost. Timed manual
  hover, turn/stop and throttle cues support repeatable practice; aircraft drafts
  can be reverted. Regional free flight has no defined scored sector route, so
  Advanced sector/competition selection remains gated. Legacy ghost/sector rules
  are preserved.
  The [final Chrome comparison check](fpv-advanced-comparison-browser-final-qualification.json)
  verifies 82 recorded mission intervals, 83 ghost positions, same-time pose,
  export/import, tamper rejection, rate-only compatibility, aircraft mismatch,
  cancellation and disposal. Ten workers are created and all ten terminated;
  there are no page errors. This is a local fixture, not physical flight evidence.
- Regional admission now checks verified swept-volume coverage without repeating
  collision casts already resolved by the worker. Historical golden replay fields
  and hashes stay exact. Full-duration exports remain bounded: 4,983,692 bytes for
  the Regional recording and 5,061,598 bytes for recovery.
  The [final capacity measurement](fpv-regional-contact-capacity-2026-10-16-final.json)
  passes the single-host bounded fixture's 2× gate: terrain **5.497×**, mixed
  terrain/scenery **9.653×**, with all 45 source hashes unchanged. In-interval
  CPU counters still show 98.90%/93.80% host activity, so this does not isolate
  every cause of improvement or qualify all regions/devices. The old failed
  measurement remains unchanged.
- The [flight-log comparison tool](fpv-flight-log-comparison.md) exports only fully
  verified replay traces, with exact consumed-input command times and separately
  labeled 50 Hz achieved observations. It requires explicit units/signs/clock
  offsets, detects gaps and command mismatches, and reports numerical response
  differences without changing a tune or qualifying a physical aircraft.
- The [final runtime matrix](fpv-advanced-runtime-qualification-2026-10-16-final.json)
  pins 20 unchanged sources and agrees exactly across Node 20/22/24 and Chrome,
  Firefox and WebKit for both backends. All measured frequency candidates pass
  numerical/contact/capacity/repetition checks in this run; the frozen 250 Hz
  mode's lowest capacity is 22.56×. Golden arena/Regional hashes remain
  `46294848`/`9d00dd70`. This is still one ARM64 machine; earlier Rosetta and
  higher-frequency failure evidence remains separately identified.

Combined verification now passes **589 practice regressions**, plus **17 targeted
worker/practice checks** after the final verification-deadline correction and
**14 focused flight-log tests** after the final CSV boundary review. The full
practice run preceded those last CLI-only guards; the focused run verifies them.
Trace export now shares the reader's 250,000-row / 32 MiB bounds and requires
three achieved observations (40 ms), rejecting failure before either output file
is written. The release-critical validation command passes, and lint passes for all **40
changed modules**. The unchanged native build/platform suite passes **75 tests**.
The first continuation practice run's single source-inventory budget failure was
resolved with a separate, bounded original-input allowance; runtime and complete
source delivery caps remain 12 MiB for Academy and 20 MiB for World.

The final reports were refreshed after a verification-only deadline correction:
complete 12-minute replay verification has a cancellable seven-minute deadline,
while initialization and ordinary mission requests retain the ten-second
watchdog. An earlier [editor attempt](fpv-tuning-browser-final-load-timeout.json)
had a Firefox navigation timeout before interaction while builds/tests competed
for the host. It is preserved; the single final rerun used the same thresholds
and passed all six cases. Previous source-bound reports and historical failures
remain separate evidence.

The [final native continuation report](fpv-native-continuation-qualification.json)
checks all 172 original runtime source files against the checkout. Ordinary
simulator-only stages contain 183 files / 18,261,435 bytes for desktop and
188 files / 18,335,662 bytes for iOS. An explicitly separate Electron test fixture
passes CLI receipt import/history, backup and recording dialogs, arena comparison,
Regional landing and takeoff, process-restart persistence and return to Legacy.
All five workers terminate and no page/stderr errors remain. iOS staging does not
establish iOS execution, signing or physical-device qualification; the overall
native rollout gate remains closed.

The normal production Pages CLI now completes against the final sources. The
[generated-site check](fpv-pages-continuation-live-testing-evidence.json) passes
Academy and World online and in isolated offline contexts using the visible
keyboard-accessible installer controls. Rates persist, Advanced restarts and
exports remain unscored, and all workers dispose. The 3,432-file publication
payload is 963,601,242 bytes; its conservative archive forecast leaves 7,784,192
bytes below the unchanged 980,000,000-byte cap. The
[live-testing guide](fpv-pages-live-testing.md) preserves the rejected temporary
path and outdated test-locator attempts and explains the final result. Public
HTTPS, the real password form and installed-update behavior remain deployment
checks. No public deployment or Advanced promotion occurred.

All six first-review software completion items received implementation and
verification evidence. The second review reopens seven additional correctness
checks, listed in the completion plan. The user's deferred physical acceptance
gates and platform/publication requirements remain explicitly open. The
[combined verification receipt](fpv-tuning-continuation-verification.json) binds
the final source files, test results and delivery reports.

The evidence section below preserves the earlier implementation's measurements.
Its source pins, byte counts and failed capacity run describe that earlier
snapshot. Current delivery results are recorded above.

## Delivery boundary

Rates, throttle, named profiles, drone setups and Betaflight transfers are integrated into Academy, World and Regional flight. Advanced is optional and unscored: a reference arena in the tuning editor, plus an explicit Regional backend choice in the existing streaming host. It is not the default and cannot create verified records.

Regional Advanced now resolves ground/roof landings, takeoff and wall contacts against exact verified terrain in its worker, then admits every substep trace before committing a complete mission interval. Missing terrain and region-edge motion still roll back and pause. Recordings preserve deduplicated collider frames and their ordered changes for replay. Contact behavior remains a reference implementation awaiting real-aircraft and wider-device qualification.

| Phase                        | Implemented                                                                                                                                                                                                                            | Remaining acceptance work                                                                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Base and compatibility   | Updated-main base; legacy identities and all 24 published Academy demonstrations retained; migration/recovery regressions.                                                                                                             | None for the local baseline.                                                                                                                                         |
| 1 — Rates and throttle       | Actual, Betaflight, Quick with both expo modes, KISS and Raceflight; independent axes, full limits, versioned throttle, no duplicate portable-input expo.                                                                              | Physical-controller comparison sessions.                                                                                                                             |
| 2 — Profiles and tuning      | Named/revisioned profiles, shared-use warnings, drone assignments/camera, overlays and preview, diagnostics, draft test/compare/revert, immutable attempts, backups and stale-edit protection.                                         | Physical USB/touch device matrix and experienced-pilot assessment.                                                                                                   |
| 3 — Betaflight transfer      | Complete/diff/patch operations, five exact releases, headerless/version selection, ordered profiles/defaults, preview, atomic new profiles, native/CLI export and local preset bundles. Native sharing preserves cancellation.         | Other releases/custom defaults remain unadvertised; online catalogs and other firmware are outside this release.                                                     |
| 4 — Advanced foundation      | Replaceable v2 controller, finite feedforward filter, Rapier worker, all-axis frequency qualification, compact recordings/recovery, full rollback, verified Regional collider frames/contact continuation, native inactivity handling. | Dense-world and physical-device performance; measured real-aircraft response.                                                                                        |
| 5 — Aircraft and comparisons | Editable reference templates, SI parameters, battery/motor/drag/noise/filter controls; production replay/comparison metadata and verified arena ghost; Legacy ghosts and sector references retain their own frozen rates.              | Real-aircraft measurements/logs; propwash, ground effect and Betaflight PID conversion remain gated. Advanced competition requires qualified route/rule integration. |
| 6 — Rollout                  | Optional/unscored gates; simulator-only native qualification build with strict CSP and source hashes; unsupported states; package/offline/lifecycle checks.                                                                            | Physical device/iOS/pilot qualification and verified/default promotion. The complete game still exceeds its native site budget.                                      |

## Continuation findings and fixes

- The earlier roll-only benchmark missed frequency-dependent yaw saturation. The v2 controller adds a separate 30 Hz feedforward filter and snapshots its state. Legacy v1 tunes migrate with that filter off; previous experimental v1 recordings are rejected under the changed backend identity rather than reinterpreted. Legacy Academy/World recordings remain supported.
- Exact replay across V8 versions exposed a final-bit difference in motor-current exponentiation. Ordered multiplication fixes the mismatch without weakening hash comparisons.
- Regional frame publication waits for pending mission transactions. Missing cells, boundary motion and rejected frame changes leave body/controller/motors/battery/input/recording state unchanged. Actual contacts continue through the physics solver. The separate Regional v1 identity uses twelve solver iterations; the arena v2 identity and golden trace remain unchanged. Recovery uses a separately validated worker and terrain re-admission before ownership changes.
- Tuning and Advanced exports use the platform adapter. Plain CLI text is limited to 1 MiB and remains inert. Native inactivity must register before Advanced can start; disposal releases late subscriptions. Cancellation and export failures do not destroy the session.
- The shared JSON export envelope now matches the already-supported complete-backup size, including enemy statistics (88 MiB + 40 KiB). Individual import limits and native site budgets are unchanged.
- `sim-boot.mjs` replaces inline executable boot code and event handlers for strict native CSP. `scripts/build-fpv-native.mjs` builds only the explicitly named Academy and World closures, with a 32 MiB cap. It preserves the production access gate and does not prune the full game silently.

- Safari/WebKit pointer clicks do not always focus their button. Tuning now remembers its actual opener and restores keyboard focus correctly when the dialog closes. The six-case browser editor matrix covers desktop and narrow touch-emulated layouts in Chrome, Firefox and WebKit.
- A full-host Pages test exposed a tuning dialog moving between pointer press and release when its menu hint disappeared. Academy and World now retain that hint during activation. Both host regressions fail before the fix and pass after it; the final native check also verifies a physical pointer Save persists the edited rate.
- Isolated offline testing exposed a World worker-entry scope mismatch despite correctly cached dependencies. World now starts the shared Advanced implementation through a bootstrap inside its own offline scope. Explicit routing covers reference practice restarts, Regional flight and detached recovery workers; package checks pin the new entry without widening service-worker scope.
- The final recovery review added rejection of non-finite body state, mismatched collider properties and forged storage counters. Terrain history decodes each shared mesh once, preventing hundreds of frame references from multiplying its memory footprint. Regression tests verify atomic rejection and preservation of the active attempt.

## Earlier implementation evidence

- Rates: 48,024 tagged-source angular samples and 10,010 throttle samples, maximum observed error approximately 0.000832°/s and zero output counts. Fixtures cover 4.5.2, 4.5.5, 2025.12.4, 2025.12.5 and 2026.6.2.
- Duration/storage: the existing 12-minute 1,998°/s rate stress flight remains bounded and deterministic. The Regional full-duration test consumes 43,200 changing input samples, 360 frame events, 64 frame definitions, 65 deduplicated colliders, 720 hashes and 24 checkpoints. Its recording is 4,983,515 bytes and recovery is 5,061,421 bytes; complete replay and recovered continuation pass. Regional recording and recovery quotas are checked separately.
- Numerical timing: all axes at 250/500/1,000 Hz pass the unchanged ≤2% gate against 2 kHz. The worst 250 Hz difference is 1.882%; tested thin-wall contact does not tunnel. 250 Hz remains the lowest passing default. The selected 250 Hz capacity gate passes across all measured runtimes; the final Firefox 1,000 Hz yaw run falls to 1.684× real time and is not qualified at that frequency. This qualifies the reference tune at its selected timing, not arbitrary custom gains or real-aircraft fidelity.
- Runtime determinism: arena and Regional hashes, consumed inputs and final telemetry agree exactly in Node 20.19.5, 22.22.2 and 24.21.0 on ARM64; Node 24.21.0 x64 under Rosetta; Chrome 155; Firefox 153; and WebKit 26.5. Each browser engine also passes real module-worker interruption, restore, reset and replay checks for both backends. These runs use one Apple M4 Pro host; x64 is emulated and WebKit is not the installed Safari application. See [runtime qualification](fpv-advanced-runtime-qualification.md).
- Regional host: the [actual Chrome World smoke](fpv-advanced-regional-browser-smoke.json) renders verified terrain and passes active ground contact, continued takeoff, pause, recording download/replay, backend switching and worker disposal. Its ephemeral test page boots a fixture; production access gates remain unchanged. [Production-adapter capacity](fpv-regional-contact-capacity.json) separately measures a real worker and complete admission against 4,096 terrain triangles and 4,104 mixed terrain/scenery triangles. The final frozen-source run measures 1.41× real time for terrain and 3.88× for mixed scenery, so the terrain case misses the required 2× margin. Follow-up CPU samples show severe host contention, including 98.36% average busy after this task’s test applications closed; this observation suggests a cause but is not a measurement during the timed interval. The failed attempt is preserved and the capacity gate remains incomplete. These bounded windows also do not qualify all dense live regions.
- Tuning editor: all six [browser qualification cases](fpv-tuning-browser-qualification.json) pass across Chrome, Firefox and WebKit, each in desktop and narrow touch-emulated layouts. Coverage includes draft preservation, test/return/save, camera assignment, export, atomic import failure, patch preview, cross-tab stale edits, persistence, EN/UK layout and keyboard focus restoration. The harness captures flight-start callbacks; actual worker flight is covered separately. Touch emulation is not a physical touch-device test.
- Regression: the final practice suite plus the refreshed Regional-label regression passes **554 tests** on Node 22.22.2 after the rebase and all fixes, including the complete duration/storage and unavailable-platform tests. Lint passes for **81 changed modules**. The complete release-critical validation command also passes, including generated source, presentation, worker and industrial-content checks. Localization validates 13,651 messages and 9,049 references. Distribution validates 3,325 files and their literal references, retaining seven existing navigation warnings. Published Academy demonstrations retain their exact legacy identities and completion results. The generated 31-module reaction runtime matches its canonical sources and includes 24 pinned voice recordings. Five production scenery checks pass, including exclusion of visual-only foliage from collision geometry. Scoped formatting passes; existing legacy/generated formatting remains in its established style. Whitespace checks pass.
- Native: **75 build/platform tests pass**. Ordinary simulator-only desktop/iOS stages retain production gates and strict CSP: 183 files / 18,205,089 bytes on desktop and 188 / 18,279,316 bytes on iOS, with all 172 checked runtime source files matching. The final policy refresh changes only qualification metadata and the World source-package manifest; every runtime payload remains byte-identical to the tested r8 inventory. The preserved r5 test-only World fixture passes actual Electron 44.3.0 Regional landing/takeoff, minimize/explicit resume, native recording and recovery save, native file-picker recovery, CLI/backup export and save cancellation. Full process restart preserves the profile library; actual Web Locks and IndexedDB persistence probes pass. Returning to Legacy and disposal leave zero workers. See [native staging](fpv-native-staging-evidence.json) and [native runtime qualification](fpv-native-runtime-qualification.json).

- Pages: the final [generated-output browser check](fpv-pages-live-testing-evidence.json) passes Academy and World online and in isolated offline contexts, including saved 900°/s rates, Advanced worker restart, frozen unscored exports and disposal. A fresh access gate remains locked; the remaining flows use a disposable remembered-unlock fixture. The expected unavailable main-game tools extension has an asserted fallback. The payload contains 3,432 files and 963,544,896 bytes; the conservative archive forecast is 972,157,440 bytes, leaving 7,842,560 bytes below the unchanged 980,000,000-byte CI cap. Actual committed CI output and public HTTPS verification remain separate.

The normal full CLI build was interrupted during slow network-volume writes. The final local payload uses the production preparation API with bounded incremental staging and complete file rehashing. Its source guard caught the later World file-envelope adjustment; that failed preparation receipt remains preserved. A fresh-policy check proves both generated offline workers byte-identical and the policies identical apart from the explicit 179→180 file limit. The [live-testing guide](fpv-pages-live-testing.md) describes these local evidence limits and the publication steps.

The Regional graphics warning is now fixed: hidden terrain preparation no longer samples a missing shadow depth texture. The [renderer regression](fpv-regional-renderer-qualification.json) reproduces three WebGL errors before the fix and zero across 261 draw calls after it. The r6 Electron stage also passes Legacy → Advanced flight → Legacy and cleanup with empty stderr and zero page errors. The r7 stage verifies pointer Save and repeats that lifecycle check. The final r8 stage starts the World-scoped worker in reference practice and Regional flight, retains the saved library across restart, and matches all 172 current runtime source files, with zero live workers, zero page errors and empty stderr. Earlier r5 full-functional, r6 renderer and r7 pointer evidence remain explicitly historical; final r8 checks are recorded separately. Broader GPU/device qualification, Xcode/simulator and physical iOS testing remain outstanding.

The earlier full-site build contained 1,072,272,729 bytes and failed the unchanged 768 MiB native site limit. An exact-duplicate audit would save only 2,839,964 bytes, leaving it over budget; the largest groups are referenced product/authoring content. No product content was pruned and no budget was raised. The simulator-only route supports this feature's qualification without claiming the complete game fits.

## Review and reproduction

1. Rate compatibility: `rates.mjs`, `flight-response.mjs`, legacy integration, tagged fixtures and generator.
2. Profiles/transfers: `tuning-library.mjs`, `tuning-ui.mjs`, `betaflight-import.mjs`, platform export and host integration.
3. Advanced: controller/simulation/worker/client, reference arena, Regional adapter, replay/storage and runtime qualification.
4. Delivery: explicit package manifests, strict-CSP bootstrap, simulator-only native builder, native policy and package/offline tests.

See [the Pages live-testing guide](fpv-pages-live-testing.md), [the player guide](fpv-rates-and-tuning.md), [Advanced backend boundaries](fpv-advanced-backend.md), [runtime qualification](fpv-advanced-runtime-qualification.md), [native staging evidence](fpv-native-staging-evidence.json), and [the all-axis timing report](fpv-advanced-benchmark.json). Package scripts include `practice:test`, `fpv:advanced:qualify`, `fpv:regional:capacity`, `fpv:tuning:qualify`, `fpv:native:build`, and `fpv:native:test`. The native smoke fixture is built explicitly with `scripts/build-fpv-native-smoke.mjs`; it is not a production entry point.
