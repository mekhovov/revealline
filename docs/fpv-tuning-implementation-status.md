# FPV tuning implementation status

Updated 2026-10-16. Work is on `codex/fpv-rates-and-tuning`, refreshed cleanly onto
`origin/main` at `3585f2c32` before the second review. The earlier implementation
and completion commits are now `0759c993a` and `f69a58fb7`; their original hashes
remain in historical reports. Unrelated local files are preserved. A local commit
does not deploy GitHub Pages.

## Second review — draft and recovery integrity

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
On 16 October the user explicitly deferred physical radio, real-aircraft data and
experienced-pilot feedback. Those gates remain unmeasured and do not block the
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
