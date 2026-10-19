# Flight practice: completion plan and priority review

## Latest review checkpoint — 19 October 2026

Use the [current status review, completed work, detailed remaining plan, ETAs and
blockers](flight-practice-status-2026-10-19.md) as the planning authority. The
[local diagnosis/browser execution report](flight-practice-execution-2026-10-19.md)
retains exact source-bound test evidence.

Continuation: all 33 Practice commits were rebased without conflicts or patch
changes onto accepted main `36e8bc426` (14 newer commits). Frozen source
`08fc3430c8` passes 127 selected regressions. All three new standalone packages
reproduce twice and pass admission; exact comparison finds changed runtime
bytes in every app. Affected browser qualification and current-head CI remain
open. The last pre-push old-head CI snapshot has eight successes, one running
and five queued; it is not evidence for the rebased source.

The approved share resolves output space; bounded writes, opt-in phase reporting
and conservative cross-volume clone veto pass **53 targeted tests**. External
sampling and isolated original validators completed without changing catalogue
bytes. The instrumented normal full build still fails its unchanged ten-minute
limit in **expanded-files**; the latest writer change has no full-build retest.
Whole-run attribution and current production-directory journeys remain open.

**Newly audited passes:** current Academy historical installed-session continuity
completes its R2 refresh, and all six current restarted-offline short-flight routes
pass. Simulator evidence remains pinned to candidate `6177d2cc8`; build-tool
evidence is separately pinned to `623918462`, not relabelled runtime bytes.
Next: affected integrated-candidate checks/current-head CI, bounded evidence-led build diagnosis, independent all-app
actual recovery (R3) and native outstanding-digest cancellation (R4), then current
production journeys. Acceptance/reviewer work (R6–R9) retains its prerequisites.
Hosting, hardware and historical Worlds stay owner-deferred, not passed. Earlier
disk measurements and source-specific results below are preserved history.

Local headroom is now the immediate execution blocker: most recently 661 MiB
free, below browser/full-build guards. The share has approximately 51 GiB but
does not supply local profile space. Small share-only package builds completed;
no full build or new browser run was attempted below the guards. I/O probes
suggest a thread-pool contribution on SMB, not a proven full-build fix. Keep
production concurrency and limits unchanged pending a safe representative run.

The former 3–5 day range is not a current overall ETA. The build fix and CI/human
waiting have no reliable completion time; the linked review gives conditional
effort for every remaining item and preserves all 24 pending gate decisions.
This review updates documentation only; no rebase, new tests or PR mutation.
Local free space is now approximately 1.8 GiB, below the recent 2 GiB disposable
browser preflight floor; heavier local browser checks need recovered headroom.
The Mac mini share still has about 52 GiB for output/evidence.

## Historical accepted-main checkpoint — 237b40543

The [18 October execution status](flight-practice-execution-2026-10-18.md)
records the second rebase, fresh three-package reproduction/
admission, 1,270 Practice tests, 756 local-UX tests, ten native exercises, six
guides, four populated tuning restores and current Gym update continuity pass.
Evidence source is `6177d2cc8`, not the older runtime receipts below.

At that checkpoint the next steps were safe local disk headroom (at least 4 GiB recommended), fresh remote CI,
Academy's current-payload update rerun, remaining all-app recovery and native
hash-overlap cancellation, then the current full production/offline journeys.
The measured full-build storage guard then refused to start. Only our own
generated old build was relocated after hash verification; no user data was removed.
Hosting, hardware and the historical Worlds active check are explicitly deferred,
not passed. Performance, spoken/visual, real walkthrough and 24 review decisions
retain their separate prerequisites. Academy's refresh and the six current
offline routes subsequently passed; the 19 October review supersedes these next
steps and the historical storage-only blocker.

## Historical execution checkpoint — 18 October 2026

The [integrated execution checkpoint](flight-practice-execution-2026-10-18.md)
records its original completion and remaining work. Rebase onto main `cb8dddd3d`
was complete; that checkpoint's packages/build are source `3c6ac5ee0`. Practice passes
1,232 tests, all six restarted-offline short-flight routes pass, and EN/UK guides
plus actual populated tuning-library backup restores pass. The production build
now passes at the unchanged deadline. R2 Worlds preparation still fails first
Arm and is paused for test-approach review; no all-app safety pass is claimed.
Continue independent R5 journeys, then remaining R3/R4 and acceptance work.
Hosting and real hardware stay deferred. The read-only and older checkpoints
below preserve history, not current blockers or completion claims.

## Historical status and execution order — 18 October 2026

The [current status, completed work, detailed remaining items, estimates and
blockers](flight-practice-status-2026-10-18.md) supersedes historical “next” and
priority statements below at that time. The 19 October review above now governs
planning. Implementation is substantially complete, but
non-hosting qualification and release approval are not. No completion percentage
or public-release ETA is claimed.

Fresh review: PR #1554 remains draft at `4768988fb…`, conflicts with main, and
its local-UX lane hit the unchanged ten-minute suite deadline without a final
TAP summary. Twelve checks succeeded and two were skipped; neither skipped
full-test/build jobs nor the green `release-ready` job closes that gap. The
original failed receipt is retained in the linked status report. Local checkout
is still `b012f2a9da`; newer remote work must be preserved before integration.
Live main was `20555cda6…` at the read-only check (620 main-only / 18 PR-only
commits), so integration is a material task, not an assumed clean rebase.

The exhausted-disk blocker has eased: approximately 13 GiB local and 58 GiB
external space were available at inspection. No fetch/build was retried; large
writes still require a fresh space check. The concurrent dirty primary checkout
remains untouched. This review updates documentation only.

| Order              | Remaining work                                                                                                                    | Focused effort estimate / dependency                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| R1 / P0            | Preserve remote changes, integrate main, resolve conflicts and diagnose/rerun the local-UX timeout                                | 1–2 days initially; re-estimate after triage                                                        |
| R2 / P0            | Gym and Worlds active-flight distinct-package update continuity                                                                   | 6–12 hours after integration/candidate freeze                                                       |
| R3 / P0            | Actual app browser-managed eviction and public exported-backup restoration                                                        | 1–2 days after integration; controlled disposable profile, safe disk                                |
| R4 / P0            | Native cancellation while verification is outstanding                                                                             | 4–8 hours; real timing witness or explicit inconclusive result                                      |
| R5 / P1            | Current integrated production rebuild/admission and affected journeys                                                             | 4–8 hours after relevant fixes; no relabelling old build evidence                                   |
| R6–R9 / acceptance | Agreed performance workloads/budgets, visual/spoken review, real guide/learning walkthroughs and 24 actual package-gate decisions | Detailed estimates in the status report; calendar ETA depends on setups, participants and reviewers |
| D1–D2 / deferred   | Physical controller/radio/touch checks and all hosting/capacity/publication/selection work                                        | No scheduled ETA; owner-deferred, not passed                                                        |

Software planning range: **5–9 focused working days**, excluding human/owner
waiting and major new defects. It is not a calendar commitment or full Phase 1
ETA. Re-estimate after R1. Existing completed directory, guide, fourth-app,
offline-flight, migration/rollback and source-specific production evidence must
not be reopened as absent or claimed for later bytes without comparison.

## 16 October research and execution update

Historical checkpoint; the 18 October order above is authoritative. Its original
evidence and limitations remain unchanged.

Current checkpoint: original `1b339bfe6` packages pass all six restarted-offline
flight routes and historical Academy installed-PWA update continuity; the older
`b8aec0821` receipts separately cover three real five-minute timeouts and genuine
all-app migration/rollback. All six native EN/UK directory/launcher/guide-return
zoom routes now pass at observer `8c93b49ee`, independently audited. The 66 focus
samples use an explicit fractional-viewport precision policy; one retains a
0.390625-device-pixel residual and its failed old decision. Screenshots remain
cropped/blank and visually unqualified. Neither these software checks nor live
region attributes close the full accessibility gate. Physical hardware and
hosting remain explicitly owner-deferred; independent evidence and failed first
attempts keep their original sources.

The complete original-production journey now passes all six EN/UK cases with
full 3,493-file verification before/after, one Play, no automatic arming and guide
return. Its explicit bounded original-byte memory delivery changes only test I/O,
not app bytes or startup limits. Independent audit is retained alongside the
original failed runs and supporting matched diagnostic. World Studio's old menu
wording is corrected and its fresh three-app candidate independently passes all
six offline flights and Academy PWA update continuity again.

Main-entry return language is corrected without overwriting saved preferences;
the actual EN/UK return documents now pass the native matrix. Outstanding-digest
cancellation gains four deterministic worker regressions, not a native timing
claim. EN/UK guides now explain that origin eviction may remove records as well
as caches and require external exports. Their guide-only candidate `11aa29782` /
`4258044c…` reproduces twice, passes admission in local/external copies, and passes
all six packaged guide/navigation checks with independent audit. No simulator
code changes; old flight receipts are not relabelled. Expanded suites pass 402
practice tests and 370 observer tests plus one explicit historical-fixture skip.

A genuinely browser-managed eviction capability also passes on a disposable
1 MiB fixture after Chrome's unchanged five-minute timer, with native counters
and exact previously persisted bucket/cache loss. Its explicitly reduced pool,
unavailable numeric baseline and ambient low disk are retained limitations—not
default-policy or actual practice-backup recovery qualification. The next real-app
lane has a concrete public-export/import recipe, not another simulated deletion.
See [current receipts, limits and remaining priorities](flight-practice-continuation-2026-10-16.md).

### Current remaining priorities (supersede historical “next” notes below)

| Priority | Remaining item                                                                                       | Why / benefit                                                                                                                              | Impact if omitted                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| P0       | Extend active-flight update continuity beyond Academy to Gym and Worlds                              | Proves a real changed-package update cannot replace the running document or lose its records; explicit pause/resume must remain safe       | All-app update safety would be assumed from one app only                                    |
| P0       | Browser-managed eviction and exported-backup recovery                                                | Distinguishes browser-selected whole-origin loss from controlled quota denial or manually missing cache files; verifies honest recovery    | Players could be told records survive an event that can delete them                         |
| P0       | Native cancellation while verification work is outstanding                                           | Complements native final-ready-response cancellation and deterministic delayed-digest unit coverage                                        | Native scheduling/UI timing remains unproven, even though late writes are regression-tested |
| P1       | Current-main full production rebuild and affected journey checks                                     | Incorporates the main-entry language correction into generated output; original `3a1b5e3c3` production pass stays valid only for its bytes | Local source behavior could differ from the eventual built release                          |
| P1       | Agreed same-device performance workloads/budgets, then measurements                                  | Separates functional startup checks from actual moving-flight performance acceptance                                                       | No defensible performance-gate or broad device-playability claim                            |
| P1       | Visual/assistive review, first-time-player walkthroughs and actual package/content/license decisions | Confirms readable focus, spoken status, understandable instructions and real reviewer acceptance                                           | Automated semantics, scripted play and hashes would be mistaken for human approval          |
| Deferred | Physical controller/radio/touch checks; hosting/capacity/public selection                            | Kept at the owner's explicit boundary, with requirements preserved                                                                         | Cannot claim physical-device acceptance or all three apps publicly available                |

The unpublished fourth-app recipe, all-app distinct-payload migration/rollback,
six restarted-offline flight routes and original-production six-case journey
already have scoped evidence. Do not rerun or reopen them as if absent; rerun only
what a changed input or remaining acceptance case actually affects.

For the next restoration lane, use public exports/imports and compare stable
proof/course/model/pack identities plus valid re-export/replay. Restored
`savedAt`, `installedAt` and generation metadata legitimately change; do not reuse
the exact database-retention predicate as a restoration-equivalence predicate.
Gym's completion set is memory-only and its transcript has no public restore
control, so no saved-completion restoration claim may be invented. The active
Worlds lane can pin the native legacy first flight to avoid automatic recovery
writes while measuring unchanged paused state; that is not all-world coverage.

Fresh audited software progress: observer `8e29a04c3` passes real imported-model
offline flight through both restarted Worlds routes, all-three final verification
response cancellation, and historical Academy ordinary-browser update continuity
with complete owned cleanup. See the [new receipts and precise limits](flight-practice-continuation-2026-10-16.md).
Next: the full production-build directory journey and offline Gym/Academy flights.
Installed-PWA active-session continuity, hash-in-progress cancellation, actual
eviction, accepted performance/accessibility and human-review evidence remain
separate gaps. Hosting and physical hardware stay deferred, not passed.

Latest-main follow-up: PR #1512 merged; later work rebased cleanly onto
`facf1627e`. Real hardware and hosting remain explicitly deferred. Independent
audit confirms the three-app migration/rollback receipt's 630 cached-member
pins and seven content witnesses. A fourth installed-window attempt also fails
before update; do not mark active-session protection complete. Next software
checks are an explicitly ordinary-browser continuity lane, real imported-model
retention/offline flight, and the complete production-build directory journey.
These add no simulator mechanics and require their own native receipts.

Latest follow-up: safe EN/UK offline error feedback and synchronized player guides
are implemented on reproduced/admitted source `b8aec0821`; the full practice suite
passes 387/387. Its fresh native short-recovery run passes 22 checkpoints; genuine
all-three historical upgrades/offline rollbacks pass 10 checkpoints and seven exact
data witnesses. The earlier failed cache assumption and no-op headless window
attempts remain retained. Active-session protection is still open; only its
explicit next diagnostic uses isolated visible Chrome. Production output now
builds successfully; its full-distribution player journey is still pending.

Build-blocker diagnosis correction: the required Couch verification document and
FPV baseline directory are committed, but this managed worktree's non-cone sparse
patterns excluded `docs/verification`. Materializing those two exact committed
paths makes build collection succeed. Earlier missing-file failures remain real;
the earlier assertion that their producer inputs were unavailable was incorrect.
No placeholder evidence or build-rule removal is needed. Full production build
and distribution-browser validation remain separate next checks, not implied by
successful collection or source-shell journeys.

The [result-action continuation](flight-practice-result-qualification-2026-10-16.md)
completes the native keyboard probe, reproduces and repairs moving result targets,
and passes all eight EN/UK Academy/Worlds Self-level/Acro lift-and-land journeys
with first-pointer Home, actual backup and exact-package independent replay.
All three changed packages reproduce twice and pass admission. The original
failed matrix and observer correction remain retained. This is not a complete
Phase 1/public release or a human/hardware qualification.

The [populated-world continuation](flight-practice-world-restart-2026-10-16.md)
also passes five exact saved-project/card witnesses through offline browser and
standalone-window restart, plus nine existing installation/recovery checkpoints.
It is not offline-flight, imported-asset or distinct-release migration evidence.

The [historical upgrade continuation](flight-practice-historical-upgrade-2026-10-16.md)
passes nine native checkpoints with genuine older/current Academy payloads and
original launchers, exact proof/profile retention, failed-install preservation
and offline rollback. Its narrowly pinned historical diagnostic authority leaves
current publishing strict. Active-flight protection and Gym/Worlds migrations
are not covered.

Current continuation: six personal-appearance source-shell journeys and all six
native 30-second idle/download-cancel cases pass; the temporary fourth-app recipe
also passes. See the [integrated-main report](flight-practice-continuation-2026-10-16.md)
for original failures, exact sources, preserved records and remaining scope.
All three separate real five-minute cases now pass with exact cache/data
preservation, pristine retry/removal and independent evidence audit. The first
active-session attempt fails before update because default automation focus
emulation prevents genuine blur. A second owned-window attempt records actual
positive lift/pause/resume but fails before update on an immediate minimization
state read; bounded actual-transition polling is being checked. The all-three
genuine migration lane establishes its historical baseline but fails its strict
cache check during current-launcher opening. Both original failed receipts and
their executed authority are retained; neither lane is qualified yet.
The full build's second attempt was cancelled
at a cross-volume file-cloning bottleneck, not accepted as a distribution pass.
A narrow same-device writer guard preserves exact-byte checks and fallbacks.
The third build completes successfully: 3,493 original output members,
1,072,077,940 bytes at source `3a1b5e3c3`. Next: finish its production player journey and run the separate
historical active-session/all-three migration lanes; improve safe localized
failure reasons exposed by the long-run results. Real hardware is
deferred at the owner's subsequent request; hosting remains deferred. SIM flight
mechanics, lessons and rendering remain outside this workstream.

Fresh primary-source guidance sharpens acceptance rather than adding features:

- [MDN's waiting-worker reference](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/waiting)
  distinguishes an installed waiting worker from the active one. Keep migration
  acceptance bound to the actual active revision and exact scope, with waiting
  and installing states reported separately. A registered worker alone is not
  proof that the selected version owns a working offline installation.
- [web.dev's offline fallback example](https://web.dev/articles/offline-fallback-page)
  illustrates keeping navigation and recovery available when a task cannot run
  offline. Apply this separately to an unavailable app and an unprepared imported
  or remote world: neither a cached directory nor an installed icon promises
  that every world asset is available. Keep retry/return and specific errors
  ahead of additional discovery features.

- [W3C pointer cancellation](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html)
  recommends native click/up-event activation. Do not move Home/Retry/Next under
  a held pointer when cancelling auto-next. Cancel the countdown immediately,
  but keep its occupied layout until the result retires. Test press/release,
  release outside, keyboard focus, and a new result resetting the presentation.
  This is our application of the guidance, not a claim of WCAG conformance.
- [Playwright actionability](https://playwright.dev/docs/actionability) checks
  stability before clicking; it does not establish that application handlers
  leave a target stationary during the press. Capture target geometry around
  down/up and require the first ordinary activation. Never force-click or silently
  retry a broken first press. Keyboard export is independent evidence, not a
  substitute for repairing the player-facing pointer route.
- [PWA update guidance](https://web.dev/learn/pwa/update) supports retaining a
  waiting worker while clients use the old version. C5 must use genuinely
  different admitted payloads and preserve an active flight; changing only a
  version path cannot close it.
- [MDN storage/eviction guidance](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
  reinforces C4/C6: readiness is verified dependencies plus ownership, not an icon
  or a quota estimate. Keep controlled write denial distinct from actual eviction
  and preserve records when removing an app shell.

Priority order: **P0 interaction and native exercise evidence**, then **P0
distinct-release/offline recovery**, then **P1 measured performance and available
accessibility checks**. Human learning, physical hardware and the 24 package-review
decisions require actual participants/equipment/reviewers; automation cannot sign
them. Hosting/capacity/public selection stay deferred by the owner. Therefore
finishing this batch does not mean all Phase 1/public-release criteria are met.

16 October continuation: [HUD repair and qualification](flight-practice-hud-qualification-2026-10-16.md)
makes the existing guidance controls reachable in both FPV apps and verifies four
EN/UK settings/reload/visible stationary-HUD journeys. Matching guides are updated.
The first genuine FPV exercise probe failed at the unchanged deadline; its
observer-only ground-clearance correction passes a reproduced model regression,
then a corrected probe genuinely completed in 13.353 seconds but failed its
pointer-based export and browser-cleanup timeout. The then-open keyboard export,
backup/replay, clean shutdown and eight-case matrix were subsequently verified
in the result-action continuation above; original failed attempts stay failed.
Disk pressure briefly paused native work; future batches need a safe margin. No hosting
or review gate is waived. Historical FPV DOM telemetry is not visible-HUD proof.

Visibility audit correction: the historical ten-case first-flight matrix uses
hidden legacy DOM telemetry for its eight FPV cases. Native launch/mode/pause/retry
and DOM-state results remain evidence, but visible FPV instrument feedback is not
qualified. The existing HUD guidance controls were also omitted from both apps'
accessible Settings categories. Repair their placement, observe the maintained
visible HUD, and repeat FPV exercise completion/export/replay without hidden
measurements. Gym exercise evidence and six directory/start/guide journeys are
unaffected. See the [corrected player-flow report](flight-practice-player-flow-2026-10-15.md).

Updated 15 October 2026. This refines the approved three-app plan; it does not
authorize a new publisher, relaxed reviews, a different host, or changes to SIM
mechanics. Implementation and public release are separate completion states.

## Baseline and concurrent ownership

### Latest main-game directory continuation

The [full-source-shell journey report](flight-practice-directory-journey-2026-10-15.md)
records six passing EN/UK native Settings → Help & Extras → Flight practice →
app-start-screen and guide/return journeys, using unchanged admitted package
bytes. All cards, real previews, actual download sizes, one-Play/no-auto-arm and
locale behavior are checked in the full source shell. The initial wrong-route
attempt stays preserved. Both 352 practice and 68 observer tests pass.

This is not a complete production-build or public-host journey: missing declared
documentation inputs still block full build collection. Positive custom-appearance
handoff, FPV beginner-exercise completion and the other named acceptance gates
remain open. Hosting stays deferred and no review approval is fabricated.

### Latest localized player-flow continuation

The [player-flow report](flight-practice-player-flow-2026-10-15.md) integrates
main `d452bda9e` and freezes a new reproducible/admitted three-app candidate at
`8cf5fe46d`. Ten EN/UK stable-launcher motion/pause/retry cases pass, including
both FPV modes in Academy and Worlds. Two native Gym lift-and-land exercises
also pass, including completion screenshots, ordinary UI transcript export and
independent replay using the exact packaged dependencies. Initial observer-route
failures and the projected-locale verifier mismatch remain retained, not erased.

This advances C2, not all Phase 1 acceptance. The complete main-game directory
journey and FPV beginner-exercise completion remain open, as do the other named
physical/human/recovery/update/performance gates. Hosting stays deferred and
`publicEligible` stays false. The report distinguishes the interrupted full
regression attempt from later verification; do not treat partial output as a pass.

### Latest repair/player-flow continuation

The [repair report](flight-practice-repair-2026-10-15.md) records the clean rebase
onto `e51ff517e`, a fresh reproducible/admitted three-app candidate at `50b7612e8`,
four public-control EN movement/pause/retry cases, 18 repair checkpoints with
a populated UI-authored World project retained, and 21 all-three controlled
quota-denial/reset/retry/removal checkpoints. Failed earlier attempts and an
ineffective zero-quota control stay preserved. Full exercises, broader locale/
input coverage, distinct-release migration, hardware/human reviews and hosting
remain open; a functional smoke test is not complete Phase 1 acceptance.

### Latest pointer/verification continuation

The [pointer continuation](flight-practice-pointer-2026-10-15.md) rebases onto
`95703ee32`, preserves native-dialog instructions in all three apps, and prevents
inconclusive preparation checks from advising removal. Frozen source `bf31260eb`
passes the 24-case Academy EN/UK pointer/keyboard matrix on an unchanged retry;
the original 11 pointer failures and first corrected run's cleanup timeout remain
recorded separately. Full first-flight, other apps' native pointer matrix,
distinct-release, physical/human and hosting gates remain open.

### Later 15 October recovery continuation

Rebased onto main `859d5cfc927daff2a350318b2325486a58959648` after PR #1345 merged.
The [recovery continuation](flight-practice-recovery-2026-10-15.md) records two
deterministically reproduced launcher/inspection problems and their corrections,
accepted SIM changes, and fresh verification boundaries. Earlier frozen-package
receipts remain historical; hosting stays deferred.

### 15 October execution boundary

The owner approved proceeding with the remaining non-hosting work and explicitly
deferred hosting. Do not provision a target, change deployment destinations, remove
retained versions or raise the size guard. Hosting remains a deferred release
dependency, not a waived acceptance criterion.

The continuation rebased onto merged main
`da0b0108206a0270b4b870e747f2d1bc0e6695cb` and froze all three real packages before
editing their guides. The [candidate receipt](flight-practice-candidate-2026-10-15.md)
records two identical builds, committed inputs and independent admission. Later
guide changes require a new candidate before publication; earlier observations
must keep their original source identities.

Execution order: (1) reconcile candidate and historical SIM evidence; (2) extend
and run the all-three observer through browser-process restart; (3) synchronize
EN/UK help and regressions; (4) execute available checks and record precise
remaining device/human gates; (5) submit verified changes without waiting on
hosting or implying that the empty public catalogue has been populated.

The minimum keyboard/controller, same-device performance and human-learning
reviews remain release gates under the existing publisher. Broader device and
usability exploration can follow later. Native SIM update/recovery evidence can
be reused only for its actual source/scope, not automatically applied to every app.

Completed in this continuation: all-three frozen builds/admission, current
directory component checks, nine-checkpoint real-byte installation observation
including closed-window and browser-process offline relaunch, exact FPV
proof/profile retention, EN/UK help synchronization, and 323 passing practice
tests. The observer's path update is still a same-payload fixture. Both initial
browser failures and successful retries are retained; the intermittent hidden
offline Open link is not claimed fixed. See the
[observation report](flight-practice-observation-2026-10-15.md) and
[executable remaining acceptance checklist](flight-practice-release-checklist-2026-10-15.md).
The corrected-guide [final candidate](flight-practice-final-candidate-2026-10-15.md)
was subsequently frozen at `ff8bfbca35`, reproduced and independently admitted;
its separate nine-checkpoint browser restart observation passed too. Full lint
passed. Physical/human reviews, first-flight/first-pointer acceptance and
distinct-release qualification remain open; no hosting or public selection was
changed. The fresh-player guide walkthrough is not replaced by an installer test.

PR #930 delivered the directory, descriptors, stable launchers, shared offline
installation and guides. PR #1195 restores practice staging in the replacement
main Pages workflow and verifies the deployed selection. It merged on 14 October
as `7c98f1619`. Follow-on PR #1198 also merged as `1a2e87d50`; the subsequent
deployment and public empty-catalogue check passed. No application release is
selected yet. Independent observer follow-up continues on a new branch.

The Practice branch is rebased onto main
`2abfd20bdee39369b3480ed3013074a8dfac3006`, including merged SIM recovery PR #1193,
regional authoring PRs #1197/#1200, World Library PR #1199 and Snake acceptance/retry changes. Earlier candidate receipts remain historical,
bound to their recorded source, rather than being relabelled as this revision.
The unrelated primary checkout and active SIM worktrees are untouched.

SIM's current **World Library** discovery, regional-world, asset, flight-control,
lesson and rendering work stays with SIM. Practice's **application directory**,
shared installation checks, packaging, publishing and guides can proceed in
parallel. Integrate accepted SIM commits from main, not files copied from active
worktrees. Freeze a new candidate after shared runtime inputs change. Preserve
the existing validated appearance-selection handoff added by SIM; it is not an
arbitrary destination or executable query parameter.

## What is already implemented

| Area                | Implemented                                                                                                                                                                                    | Remaining proof or refinement                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Discovery           | Three descriptor-driven cards, gameplay previews, purposes, inputs, requirements, versions/sizes, EN/UK, Play/details; six exact original-production journeys and positive Tryzub handoff pass | Current-main production rebuild and deferred public selection remain                                                  |
| Compatibility       | v1 index retained, bounded revision-keyed details, safe routes, metadata fallback                                                                                                              | Repeat current public compatibility checks after deployment                                                           |
| Failure handling    | Dated last-known catalogue, empty/failure states, retry/navigation; source-shell and package recovery, timeout/retry and six restarted-offline routes pass                                     | Genuine origin-eviction/backup recovery and wider browsers remain                                                     |
| Offline preparation | Hash/dependency/worker readiness, progress/cancel, bounds, previous version retention, scoped removal; genuine all-app migration/rollback, imported models and six offline flights pass        | All-app active-flight continuity, native outstanding-hash cancellation and genuine eviction remain; hardware deferred |
| Publishing          | Three-app reproducibility/admission, existing publisher/selector; repaired main workflow deployed and empty catalogue verified                                                                 | Full retained-site capacity and reviewed release selection remain                                                     |
| Guides              | Corrected EN/UK player HTML/repository help, maintainer descriptor/preflight/preview/release recipe and parity tests                                                                           | Follow guides from scratch on the qualified real candidate and collect current screenshots/device evidence            |
| Fourth app          | Automated registration and six-checkpoint real-browser launch/start/pause/retry, installation/update/offline reopen/rollback/retirement                                                        | Complete for the unpublished fixture; does not qualify the three real apps and must never be published                |

Prior 290/290 practice and 37/37 SIM recovery checks are useful recorded evidence,
not automatic approval of a later source. See the
[continuation record](flight-practice-continuation-2026-10-14.md) for exact sources.

## Research refinements

These are recommendations inferred from the cited examples, not promises that
RevealLine has already passed their acceptance checks.

1. **Keep capacity as a release prerequisite.** GitHub documents a 1 GB published
   site limit. Our existing 950,000,000-byte guard provides a stricter boundary.
   Count expanded active **and retained** package files, stable launcher copies,
   directory and final metadata, not compressed downloads alone. Keep a repeatable
   preflight and require the existing exact assembled-site check to approve
   capacity. [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
2. **Tell players what is actually available offline.** VelociDrone Mobile shows
   offline availability per track and explains its limited retention. Adopt the
   clarity, not its automatic oldest-track deletion: RevealLine must preserve
   player records and its promised previous working app version. Separate app-shell
   readiness from imported World content readiness.
   [VelociDrone Mobile manual](https://www.velocidrone.com/mobile_manual).
3. **Treat storage estimates as advice, not a guarantee.** Browser storage and
   eviction are origin-wide; app-specific caches do not create separate quotas.
   A saved pointer or installed icon is not readiness evidence. Test missing
   assets, denied writes and recovery without recommending indiscriminate site-data
   deletion. Persistent-storage permission may reduce eviction risk but cannot
   replace exports or readiness checks.
   [MDN storage and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
4. **Preserve old sessions during updates.** Prepare the next immutable version
   without replacing an active flight. Include two open versions and close-all-
   windows relaunch in evidence; do not use forced worker activation as a shortcut.
   [web.dev update guidance](https://web.dev/learn/pwa/update).
5. **Make authoring information previewable.** Steam separates item metadata and
   previews from content downloading; Microsoft Flight Simulator asks for clear
   dependencies and support contact. Keep our descriptor/preflight/preview recipe
   and verify it using a real fourth sample instead of adding a second registry
   or marketplace UI.
   [Steam Workshop implementation](https://partner.steamgames.com/doc/features/workshop/implementation?language=english),
   [Flight Simulator metadata](https://docs.flightsimulator.com/html/Developer_Mode/Project_Editor/Marketplace_Data.htm).
6. **Verify focus continuity, not merely an outline rule.** Keyboard/controller
   focus should stay visible after a status change, retry or language switch.
   Exercise narrow screens, zoom and modal exits as well as ordinary tab order.
   [Xbox UI focus guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/113).

Search, ratings, subscriptions, more packages, automatic cache eviction and new
training systems remain out of scope. Three apps do not justify those costs.

## Priorities for review

| Priority / remaining item                                 | Why it is needed and what it brings                                                                              | Impact of not doing it                                                                            | Completion evidence / dependency                                                                                                                           |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Completed — Restore deployed directory**                | Repairs missing `/practice/index.json`; empty selection now gives usable help/navigation                         | Keep the post-deployment check to prevent recurrence                                              | #1195/#1198 merged; deployment 38517254013 and public empty-catalogue receipt passed for `1a2e87d50`                                                       |
| **P0 — Sustainable retained-site capacity**               | Makes updates and rollback deployable, with room for metadata and growth                                         | First release has almost no margin; a later update can fail the whole site deployment             | Repeatable measured preflight, content-preserving reduction or approved hosting decision, then full exact inventory under unchanged guard                  |
| **P0 — Source-bound installation/recovery qualification** | Proves three apps coexist, launch offline after every window closes, preserve records and survive failed updates | “Ready offline” or an installed icon can mislead; failures can strand players or lose saved state | Current frozen bytes; all-three observer, distinct-candidate upgrade/rollback, missing-file/quota/cancellation checks; physical checks separately recorded |
| **P0 — Reviewed release and selection**                   | Converts implemented software into the three playable public packages the user requested                         | Catalogue remains intentionally empty regardless of how many local checks pass                    | Required evidence, correctly allocated release version, verified uploaded/downloaded originals, reviewed selector and public one-Play/offline checks       |
| **P1 — Correct and synchronize player guides**            | Removes menu drift, explains package versus world downloads and input setup at the point of use                  | Players follow dead-end instructions or assume an imported world is an app; support load rises    | EN/UK parity checks, actual current screenshots and task walkthroughs; link maintained SIM onboarding                                                      |
| **Completed — Fourth-app browser recipe**                 | Demonstrates maintainers can add an app without package-specific renderer changes and reverse a bad update       | Keep as regression coverage; fixture success does not qualify real packages                       | Six retained browser checkpoints passed: four cards, launch/start/pause/retry, update, offline reopen, rollback and retirement                             |
| **P1 — Device/accessibility/performance baseline**        | Establishes supported input paths, focus/status announcements and acceptable use on target devices               | A technically downloadable package may be unplayable with a radio, touch or assistive technology  | Named browser/device/input, source/hash, screenshots and limitations; no synthetic substitute for physical or human observations                           |
| **P2 — Wider first-time-player and recovery polish**      | Finds confusing selection/onboarding and long-session issues after baseline release                              | Usability and device-edge issues persist, but do not justify adding unrelated catalogue features  | Real novice sessions and broader devices; integrate verified SIM updates and refresh reports                                                               |

P0 means release-blocking, not “stop all development.” P1 work proceeds alongside
P0 investigations. Existing admission policy may require parts of the P1 device
matrix before publication; priority labels do not waive those gates.

## Capacity alternatives and decision boundary

The previous measured lower bound was 947,349,762 bytes for main plus one three-app
generation, and 974,609,441 for two, before all publication overhead. New main
commits require new measurements. The previous generation is a sizing model, not
an already published optional release.

1. **Recommended first: audited content-preserving packaging savings.** Remove
   only proven non-runtime build payload or unnecessary duplicates whose routes
   and authoring/original-download contracts remain intact. Validate all reference
   closures and existing retention behavior. Low architectural disruption, but
   there may be no sufficient safe saving.
2. **If insufficient: separately approved delivery architecture.** Move suitable
   immutable content to a supported distribution path with explicit CORS, integrity,
   offline, ownership, bandwidth and retention contracts. This can create sustainable
   room but is not a small Practice fix and must not be chosen implicitly.
   The [capacity decision proposal](flight-practice-capacity-decision-2026-10-14.md)
   compares options, recommends evaluating a dedicated same-origin project target
   only with owner approval, and spells out v1 launcher, installation identity,
   quota, worker scope and rollback requirements. No target is provisioned.
3. **Not recommended: remove content, omit the prior version or raise the guard.**
   These change user-visible guarantees or conceal the host limit. They require
   an explicit product decision and are not part of this implementation.

## Parallel execution and release sequence

- **Capacity lane:** current no-write inventory, safe-savings audit, reusable
  capacity preflight and regression coverage.
- **Installation lane:** extend the existing observer to all three apps, bounded
  failure diagnostics and genuinely closed-window offline relaunch.
- **Guide lane:** fix EN/UK instructions and stale qualification claims; test
  parity against maintained app interfaces.
- **Integration lane:** research/plan, fourth-app browser lifecycle, combined
  tests/review, then update PRs without waiting idly for the queue.

After independent changes pass, rebase accepted main changes again if required,
freeze one exact candidate, reproduce/admit all three apps and bind qualification
to its bytes. Review, publish, select and verify through the existing release
process. Old receipts stay historical; changing candidate runtime invalidates
assumptions that depend on it. Do not repeatedly rebuild while SIM is still
changing unless an integration check specifically needs those commits.

Phase 1 remains open until all three apps are actually selected/playable on Pages,
genuine offline relaunch passes, upgrades preserve working installations and
records, and the temporary sample recipe works. Manual/device or architectural
decisions must be explicitly assigned when automation cannot supply them; no
invented pass, silent waiver or indefinite wait for a PR substitutes for completion.

## This continuation's results

- Rebased the publication repair onto `f0ccfd37`; kept it separate in #1195.
  Continued verification/guides/capacity work on `codex/flight-practice-qualification`
  without waiting for that PR to merge.
- Added the capacity command and retained-version accounting to the existing
  bundle tool. The [measured review](flight-practice-capacity-review-2026-10-14.md)
  includes stable launcher duplication: current observed core plus the admitted
  development packages and comparable retention reserve is at least **975,134,465
  bytes**, **25,134,465 bytes over** the unchanged guard, before further overhead.
  It explicitly distinguishes the mixed-source sizing model from release proof.
- Corrected English/Ukrainian guides to match current SIM/Gym settings, offline
  preparation, controller choices, explicit resume, and safe storage removal.
  Removed stale World Studio package-limit and waived-test claims. Added guide
  parity/navigation regression coverage.
- Added all-three installed-app observation and bounded cleanup/password handling.
  The real admitted-candidate run is **blocked by its password gate**: no preparation
  checkpoint passed, no gate bypassed, and cleanup succeeded. An authorized test
  password was requested. Helper tests do not constitute app qualification.
- The real-browser fourth-sample recipe passes six checkpoints on installed Chrome
  155.0.8059.40: discovery/launch/start/pause/retry, previous preparation, changed-byte
  update retaining previous, zero-tab offline reopen with a failed uncached network
  probe, rollback, and retirement preserving immutable URLs. The known password
  and synthetic review records apply only to this unpublished fixture.
- Earlier combined practice regression suite: **304 passed, 0 failed, 0 skipped**
  after the observer's locale/menu regressions were added (the earlier run was 303).
  The optional browser companion is a separate opt-in check, not included in that
  count. Current physical-device, screen-reader, human-learning and public-package
  acceptance are still missing.

Retained browser evidence: [six-checkpoint recipe receipt](flight-practice-qualification-20261014/recipe-browser.json),
[actual sample pause screen](flight-practice-qualification-20261014/sample-paused.png),
and [real-candidate credential blocker](flight-practice-qualification-20261014/installation-blocked.json).
The screenshot is copied byte-for-byte from the temporary path named in the
receipt. These records explicitly identify baseline/source and fixture limits.

The plan's current recommendation is to finish the remaining qualification,
retain the now-deployed publication repair, and resolve the
measured content-delivery decision before claiming a sustainable public release.
Do not mark “three playable public apps” done on the strength of local fixtures.

### Latest integration checkpoint

- Final rebase includes merged Coaster catalogue #1209 and World return-focus
  #1211 at main `2abfd20bd`. Browser receipts below retain their earlier
  `caab4312e` baseline and exact source hashes; they are not relabelled as the
  latest runtime or public-release qualification.
- Integrated main `caab4312e`, including SIM catalogue navigation and the Pages
  deployment concurrency repair, without touching SIM's active worktree. Fixed
  the standalone directory's main-game and guide links to retain EN/UK selection.
  [Component browser observations](flight-practice-directory-observation-2026-10-14.md)
  cover keyboard focus, narrow/reflow layout, reduced motion, empty/error/cache
  states, basic-metadata fallback and retry. They do not qualify the whole game
  shell, native browser zoom, screen readers or physical controllers.
- Repaired the observer's current profile-transfer disclosure and native keyboard
  actions; full v1/v2 profile export comparisons remain strict. The refreshed
  [controlled three-app observation](flight-practice-qualification-20261014/controlled-three-app-caab4312e.json)
  passed **eight checkpoints**: preparation, installed windows, genuine offline
  launcher/window reopening after closing every window, profile/proof retention,
  failed-install preservation, same-payload path update/rollback and scoped
  removal. Cleanup passed with no page errors. Its
  [build provenance](flight-practice-qualification-20261014/controlled-build-caab4312e.json)
  records the copied test-only password metadata/version and baseline. This is
  not unchanged-release qualification, distinct-payload migration, browser-process
  restart, pointer-input or human-flight evidence.
- The [capacity decision proposal](flight-practice-capacity-decision-2026-10-14.md)
  makes the next owner decision explicit. No new infrastructure, content removal,
  retention reduction, guard increase or public selection is implemented.
- Current continuation regression run: **317 passed, 0 failed, 0 skipped**;
  **21 focused directory/observer tests** also passed. Lint and whitespace checks
  passed. Independent review found no actionable issues in the locale fix or
  transfer adapter. The live practice verifier still reports a valid empty
  catalogue; no three-app public-play claim follows from these local checks.
- #1195 and #1198 are merged. Deployment [38517254013](https://github.com/mekhovov/revealline/actions/runs/38517254013)
  passed for `1a2e87d50`; `/practice/index.json` returns the valid v1 empty
  catalogue. The exact-source deployed-site receipt records **920,119,188 bytes**
  and **3,204 files**, under the unchanged 950,000,000-byte guard. The public
  practice verifier also passes. This completes directory recovery, not app release.
- After integration of SIM World Library, the full practice suite again passes
  **311 tests**, plus **3 main Pages profile tests**; all three package preflights
  pass. Existing actual candidate receipts remain bound to `99d3dc41e`.
- Subsequent observer startup/deadline regressions bring the full practice suite
  to **313 passed, 0 failed, 0 skipped**. All three real packages reproduce twice
  and pass admission at `f3b1b2c88375f27672698ab1d04dffd83369bbad`, with SIM World
  Library included. This is still a non-public development candidate, not an
  allocated release. See [build receipt](flight-practice-qualification-20261014/build-f3b1b2c88.json).
- [Updated capacity evidence](flight-practice-qualification-20261014/deployed-capacity-f3b1b2c88.json)
  reconciles the exact deployed baseline and subtracts the replaced empty
  directory. The fresh candidate plus active launchers/pointers gives a
  **947,916,270-byte lower bound**; a comparable retained generation brings that
  to **975,198,521 bytes**, at least **25,198,521 bytes over** the guard. Replacement
  populated-directory bytes and a final combined-site inventory remain additional.
  Deployed/candidate source identities stay explicit; the reserve is not a release.
- The controlled historical-fixture observation progressed through native-keyboard
  offline preparation and proof import/export, then failed locating **Profile JSON**
  after Setup navigation. No all-three checkpoint passed; cleanup succeeded and
  no page errors were recorded. Retained [failed receipt](flight-practice-qualification-20261014/controlled-observer-profile-navigation-failed.json)
  is diagnostic only. The later controlled run below repairs and rechecks this
  navigation; the earlier pointer-focus issue remains unqualified.
- Final review found and fixed a delayed browser-startup cleanup race. Pending
  acquisition now retains the profile and records cleanup as unverified; late
  completion cannot overwrite a timeout with success. The final pre-rebase suite
  passes **314 tests**; **9 focused observer tests** pass after the final rebase.
  The final main update includes SIM Coaster authoring/content PR #1205 and Snake
  evidence; it changes no optional-app runtime inputs. Existing frozen build and
  deployed-capacity receipts retain their original sources, not the new HEAD.
- A bounded, read-only lossless audit checked 30 images (90,551,929 bytes) and
  measured 1,235,912 bytes of potential savings. This does not close the measured
  retained-version gap. No image bytes, pinned hashes, original-download routes,
  retained versions or size guards were changed. The audit has five regressions,
  including rejecting transparency semantics it cannot preserve.
- Directory introduction text now supports arbitrary catalogue counts rather than
  promising exactly three apps; a 0/3/4-card regression covers the maintainer recipe.
- Controlled three-app testing found an Academy first-pointer focus/layout issue
  on the Workshop disclosure. The native keyboard route is usable; observation
  records that route and does not claim pointer qualification. SIM/UI follow-up
  remains required. These controlled packages are not the actual release candidate.
- At committed revision `99d3dc41e08b420f2b430ef1875b309983be8f38`, all three
  actual packages passed two byte-reproducible builds, committed-input checks and
  ZIP admission. The development version remains `v0.151.1`; no release version
  was allocated and `publicEligible` remains false. Full practice regressions:
  **311 passed, 0 failed, 0 skipped**; main Pages profile **3 passed**.
- The actual `99d3dc41e` browser attempt again stopped at the normal password gate,
  with zero preparation checkpoints and successful cleanup. An authorized test
  credential is still needed; a controlled-fixture result cannot replace it.
- The exact-source core inspection was stopped under local resource pressure
  after free internal storage fell below 200 MiB. It produced no complete report
  and supplies no new capacity approval. A later successful CI deployment now
  supplies an exact assembled baseline without repeating that heavy local check.
  The complete combined site still requires its own assembly/inventory before release.
- SIM World Library PR #1199 has subsequently landed on main. It is an application
  content catalogue, not a replacement for the Flight practice application
  directory. Integrate it through the final rebase and preserve exact source
  identities; qualification receipts do not automatically transfer to newer code.
