# SIM completion plan — current status and remaining work

Reviewed **18 October 2026, 23:14 CEST (Europe/Berlin)**. This is the current
execution index for the accepted rates, aircraft and Setup Workbench plans.
It distinguishes implemented features, released corrections, remaining software
work and qualification that requires outside evidence. It does not reopen
unrelated world-expansion or demonstration-authoring projects.

## Current status

**The core rates, thirteen-aircraft practice and Setup Workbench features are
delivered. The complete original ambition is not finished:** exact real-aircraft
fidelity, exhaustive source-kit coverage, wider-device qualification and Advanced
competitive promotion remain open or explicitly excluded as detailed below.

The latest three corrections are released through
[PR #1583](https://github.com/mekhovov/revealline/pull/1583), merged as
`3a2880287b501dffcdd1ab1937ffbe0fead8b782` on 18 October at 09:14 CEST.
The release's [public deployment metadata](https://mekhovov.github.io/revealline/main-deployment.json)
reported `20555cda6bd44a0736aa829e64c52e455b4e770c`; its
[Pages build, deployment and verification](https://github.com/mekhovov/revealline/actions/runs/39145153450)
all passed. This review downloaded the three corrected public modules and
confirmed their bytes matched the verified PR #1583 release. The later live
metadata check at 22:49 CEST reports
`cb8dddd3d3c11d24c56b014fa48ac0e6417d6465`, the existing recovery-entry update.
Its build/deploy succeeded while post-deployment verification was queued.
PR #1626 has now merged normally as `e4400303952d4d6dcfd6416d6d085131ce71466b` at 23:05 CEST. Its [Pages deployment](https://github.com/mekhovov/revealline/actions/runs/39166266155) is queued; live-byte acceptance remains. Later continuation changes below are not yet public.

### Current continuation — implementation and acceptance in progress

Work is isolated on `codex/fpv-sustained-flight-20261018`, based on refreshed
main `e3a20a2a342757444775c0c261131da168280b58`. Unrelated local demo/UI edits
remain untouched. The reviewed six-commit candidate was subsequently rebased
cleanly onto main `461ace72e78f8cbd77c26549381d9e21d0a65e91`. The following work is
**merged through protected review, with deployment pending** in
[PR #1626](https://github.com/mekhovov/revealline/pull/1626), final source
`cf13bcad9a59a387be7c31c9af8d30d74e7c1860`.

The hosted candidate checks passed on the exact PR source, including **1,364/1,364**
primary checks. The optional-practice integration run passed **1,221/1,221**
practice and **10/10** pointer checks; observers reported **170 pass, zero fail,
one skip** because their historical fixture bundle was absent. That optional run
is bound to merge-integration source `8fc952b7a0beb70b3065663e4b5390feb209d490`,
not the isolated PR head. All four focused source shards, their aggregate, the Appearance
preview and industrial checks have passed. The focused aggregate completed at
22:21 CEST and final release-ready passed at 22:55 CEST. The normal controller
merged the unchanged cf13 source at 23:05 CEST as `e4400303952d4d6dcfd6416d6d085131ce71466b`.
No gate was waived. Parent Pages deployment is queued at review time.
The five reviewed follow-up fixes rebased cleanly onto that merge, with all five
patches unchanged, and are now [PR #1665](https://github.com/mekhovov/revealline/pull/1665),
source `35ae4985c0bec6277a45b9331efc0c0332aa165a`. Post-rebase 448/448 focused tests,
ESLint and diff checks pass. Two inherited formatting warnings are disclosed;
large unrelated reformatting was avoided. New main advanced independently; the
published candidate remains stable for normal integration gates.
An obsolete cancelled run's always-run aggregate
had blocked the source lane and was force-cancelled; the final source subsequently
passed its own normal checks. No final-source gate was waived. Repository
`REVEALLINE_FULL_CI=false` means the broader deferred lint/test gates must not be
reported as a full-repository pass. Publication and deployed UI acceptance remain.

| Priority                                  | Current result                                                                                                                                                                                                                                                                                                                                                                                                                                       | Next gate                                                                                                                                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1: keyboard flight regression**        | Public Meteor75 flight reproduced throttle dropping to zero after deliberate Pause → Resume, causing a fall/flip. Fixed session-specific resume preserves the last accepted throttle, clears held rotation keys and retains zeroing on blur/source changes/restart. Six host regressions fail against the old source and pass with the fix. Local rendered World visible-button and P-key pauses both resumed at 50% throttle with neutral rotation. | Independent review complete; reloaded Academy and Regional acceptance passed. Normal hosted release checks remain. No physics constants changed.                                                                                        |
| **P1: sustained coverage**                | All fifteen aircraft pass 32-second controlled RC-input flights in Acro and Self-level (30 cases), rotated across Academy/World/learning hosts, including contacts, re-takeoff and exact recovery. All 35 cases now pass, including four 65-second Regional cases and a 735-second Meteor75 flight with 730.1 seconds airborne.                                                                                                                      | The [receipt](fpv-sustained-flight-qualification.json) retains named source hashes, initial synthetic-pilot diagnostics and exact scope. These in-process tests do not replace rendered/manual flight or establish total-memory bounds. |
| **P1: archive reliability investigation** | Both local and public World archive operations reported a closing IndexedDB connection. Public reload/refresh then showed only a new test session instead of the prior sixteen entries. Cause unknown; the six older archives cannot be confirmed preserved. A stale-handle reconnect correction is tested, but does not establish retention or explain the missing inventory.                                                                       | P1 retention remains open. Preserve this negative and the earlier 16 October owner audit; reconnect success is not proof of retained data. No bulk-delete path was found.                                                               |
| **P2: source inventory**                  | [Civilian disposition inventory](fpv-civilian-source-inventory.md) covers all 41 returned Swarm records and all ten spreadsheet tabs. Existing Mobula8 maps to the explicitly civilian indoor kit. Military-specific entries are excluded; equipment and ambiguous collections are not fabricated aircraft.                                                                                                                                          | Inventory complete within the documented source/access boundary; this does not claim every source kit is implemented.                                                                                                                   |
| **P2: civilian candidates**               | Cetus X (2022 Betaflight SPI ELRS, original 30C series cells) and Protos 1.6 AIO 1.0 are implemented with distinct original visualizations and visible approximation notices. All thirteen previous numerical identities remain unchanged. All fifteen pass the local numerical gate; targeted source/config/host checks pass.                                                                                                                       | Independent review and short Academy takeoff/steering/pause checks complete; hosted packaging/publication remains. [Implementation evidence](fpv-civilian-candidate-implementation.md).                                                 |
| **P2: actual browser zoom**               | Chrome Guest toolbar verified actual 200% zoom. EN/UK camera search, keyboard numeric editing, reachable focused fields/actions and revert checked; zoom restored to 100% and guest window closed. The discovered invalid-value/slider mismatch is corrected; final DOM reads confirm 86/86 and unfinished 4/86 exact/slider pairs.                                                                                                                  | Local corrected-control acceptance complete. Keep this single Chrome/desktop check distinct from narrow-viewport and mobile coverage.                                                                                                   |

The local rendered World session reached **14:20.30**, retained clip **12:00.00–14:20.30** and durable checkpoint **14:20.00** despite archive failure. This includes ground/ceiling contact, not measured continuous airtime. Reloaded Academy Meteor75 and both new presets passed short input/pause checks; Regional Meteor75 passed a separate current-source starting-area flight. [Rendered evidence](fpv-flight-continuation-20261018.md).

The public long-flight attempt reached 5:44.60 but encountered the pause bug;
it is **not** a completed twelve-minute rendered flight. It also confirmed
continued flight and durable checkpoints with the sixteen-entry archive store
full. The user authorized deletion of ten identified test archives. The first attempt reported a closed connection; all sixteen were still listed immediately afterward. After reload, the older inventory was absent. No successful cleanup or preservation claim is made; no further deletions were attempted.

Archive feedback now distinguishes a confirmed single deletion from a failed or
cancelled follow-up refresh, and initial list errors are visible. **19/19**
controls/integration checks pass, including EN/UK failure paths. This corrects
outcome reporting without changing storage algorithms or explaining the missing
public inventory. A new local 50.78-second Regional archive saved and verified
from reset; that positive result does not close retention R13.

The rebased candidate also has **30 rendered catalog smoke cases**: all fifteen
presets launched and steered in both modes through the World workbench. The
[receipt](fpv-rendered-catalog-20261018.json) preserves the excessive-throttle
Meteor75 Pro ceiling contact and gentler retest. Archive-full status did not stop
the remaining flights. These short checks advance R1; longer representative
routes and acceptance on a frozen public release remain.

Additional source-preview checks exercised X650 in Circuit stadium (25.54 s) and
Cetus X in Open meadow (72.76 s). These were unscored draft flights, not completed
course objectives. The Cetus archive finished through 64.50 s, verified from reset,
survived a normal same-tab reload and verified again. No archive deletion or
saved-library change was performed. [Detailed limits](fpv-flight-continuation-20261018.md).
The older missing inventory remains unresolved.

### Newly reproduced lesson defect — P1

A normal saved-Meteor75 **Meet your drone** practice attempt, entered through
the teaching guide's **Practice with BETAFPV Meteor75** action, did not complete
its initial on-pad condition. After settling upright with zero throttle, zero
vertical speed/drift and centred sticks, the explanation showed **−0.0 m** against
the **0.0–0.8 m** height band, with every other condition satisfied and zero hold
progress. The physical contact solver settles approximately 1 mm below its plane;
the mission adapter passed that small negative height straight to a strict bound.

Source review also found that **56 Flight School courses and 30 World courses**
request the authored `$floor` landing surface, while aircraft contacts supply
`course-boundary-y-min`. A predicate-isolation reproduction completes 3/3 steps
only after changing that support identifier; the original stays at 2/3. This
does not mean all those courses were flown or that every failure has one cause.

**R14 / P1: selected-aircraft mission completion** is corrected locally in
`55a5eefd1f02dec493fd80a5da53aabd301cedbf`, preserving physical state/contacts and
verified historical v1 recovery. Independent review and the original 31-check
adapter/course/recovery/challenge suite passed. The later
`1c7354bebc5349c90a7f99190654ca098fedb4fc` receipt covers **all fifteen aircraft in
both modes** completing one original ground/lift/landing lesson, continuing
practice and recovering with exact aircraft/controller/rate configurations.
Completion was 6.04–6.26 seconds. The matrix run reported 31 TAP passes including
its parent and four unselected tests; a separate run passed those four. These
are overlapping targeted checks, not a sum of unique tests.

The rendered World teaching route now completes on Meteor75 at **13.66 seconds**,
allows a second takeoff and finishes at **16.34 seconds**. Its archive verifies
from reset. This is local keyboard/Self-level evidence, not public acceptance or
all-course coverage. **Release checks and deployed acceptance remain**, usually
several hours after integration but dependent on CI capacity. PR #1626's separate
pause/archive corrections remain on their unchanged release path.

Restoring the original test library exposed **R15 / P1: post-restore editor
selection**. The library committed successfully, but the editor attempted to use
the removed active setup and reported a `profileId` error. Refreshing recovered
the view; the exported contents match the pre-test backup apart from its expected
revision increment. A focused selection/reset fix now passes **179/179** tuning UI/library checks
and rendered acceptance: the original backup restores in one action, the editor
shows `My drone` / `Legacy feel` with zero changes, and the active Meteor75
attempt remains paused at 8.92 seconds. The new backup matches the original
apart from its expected revision increment. Independent review passed and commit `ba1f6d065` retains the correction;
**release checks and public acceptance remain**. No archive deletion
occurred.

That acceptance also reproduced **R16 / P1: Apply & restart starts before Arm**.
From a paused World attempt, saving a Meteor75 draft with Apply & restart briefly
showed scene preparation, then advanced the new flight to 8.92 seconds without
an Arm action. The UI promises that a new attempt waits for Arm. The correction is committed as `07196f3a29f423d94e6708aff466740837106765`.
Only World's workbench restart needed the existing paused-start flag; Academy
and Regional already waited for Arm. Six pre-fix failures were reproduced.
The final World/Legacy-course/Regional matrix passes nine configuration cases
plus its parent; three selected Academy cases and fourteen related origin/pause/
physical-host checks also pass. These counts overlap earlier targeted runs.
Independent review confirms ordinary Fly behavior and frozen settings remain
unchanged. Rendered Meteor75 stayed at 0.0 seconds with motors off after scene
preparation and a neutral-input wait; only explicit Arm advanced it to 1.02
seconds. The original library was restored afterward. **Integration/package
checks, publication and deployed acceptance remain.**

### Combined follow-up qualification

The reviewed aircraft, lesson, restore, explicit-arm and propulsion-inspector
changes are combined on source `ad7225621f0522d9a5d0c886a51e56aefc6f5274`,
rebased onto main `cb8dddd3d3c11d24c56b014fa48ac0e6417d6465`. All seven reviewed
runtime modules match their pre-integration bytes. The combined propulsion
suite passes **46/46**, and packaging passes **19/19**, with no failures or skips.
[Measured receipt](fpv-combined-package-qualification-20261018.json).

Actual bundled Academy is **13,099,861 / 13,107,200 bytes**, leaving **7,339 bytes**;
original inputs leave 31,556 bytes. World and simulator-only native package
checks pass as well. Byte limits were not raised. Selected-source file counts
are exactly full at 151/151 and 211/211, so later features need fresh dependency
and capacity checks. This is package qualification, not deployed/offline/native
device acceptance. PR #1626 remains separate and unchanged while hosted checks
complete; the follow-ups have not yet been published.

### Observed practice timing — accepted locally

Commit `a113208ce8e4076c19b2acc99332c3172e53bfcc` adds unscored timing in
the pause panel. All fifteen aircraft in both modes complete the same original
lesson with and without the observer and retain exactly equal full recovery
packets. Host, failure-isolation, long-clock and recovery checks pass. The
historical scored-sector tracker is unchanged.

A rendered World Meteor75 Self-level lesson completed all three objectives in
**0.80, 12.34 and 6.04 seconds**. At 20.32 seconds, restoring the durable
20.00-second checkpoint kept flight paused and explicitly discarded unknown
earlier split history. The new panel translated correctly into Ukrainian.
English and the pre-test setup library were restored; its content matched
exactly apart from the expected revision increment. The local archive store
reported full, but flying, lesson completion and checkpoint recovery continued.
No archives were deleted. These are local-source-preview observations, not
public deployment or packaged/offline/device acceptance.

Actual package checks pass **19/19**, with bundled Academy at
**13,106,517 / 13,107,200 bytes**: **683 bytes spare**. Source file slots remain
full at 151/151 for Academy and 211/211 for World. Neither budget was increased.
The separate locale-switch defect in existing recovery/archive messages is now
corrected in R17 at `39a8be8c19c2a107b7be2352f45dbfe5cc23f5cd`. Its **36/36**
controls checks include zero status writes across fifty unchanged paints and
one update per locale change. A fresh-origin rendered checkpoint test passed
English → Ukrainian → English without resuming flight. No setup was saved or
archive deleted. Final package checks pass **19/19** at **13,106,939 bytes**,
leaving **261 bytes** before the R18 build-only correction below.

### Package headroom — accepted locally

R18 is implemented at `7f38f550e5f67278aea5fa8d1f3aad1b059caa0c` and
independently reviewed. Applying the existing safe indentation projection to
only the bundled presentation module saves **52,539 bytes**. The actual bundled
Academy is **13,054,400 / 13,107,200 bytes**, leaving **52,800 bytes**. All caps,
embedded assets and numerical source identities remain unchanged. Preservation
checks pass **9/9** and package checks **19/19**.

The actual emitted package also passed a rendered Academy check: unlock,
Meteor75 draft/previews, explicit Arm, short lift, pause and 5.00-second recovery,
including English → Ukrainian → English result text. The lift overshot to the
10 m ceiling; it is a package smoke check, not a completed lesson or hover
qualification. English and the original draft were restored; no setup save or
archive deletion occurred. [Scope and measured receipt](fpv-package-headroom-20261018.md).
Original-input margin remains 24,478 bytes and selected source file counts remain
full. This closes the bounded byte-headroom change locally, not every future
capacity or delivery gate. Publication remains pending.

### Static-course recording verification — tooling complete

R11B is committed and pushed as `a1d883ccedb68704acc320352ec6a3f895d8b580`,
with **42/42 checks passing** on the clean committed source and independent
review complete. It first verifies recorded physics, then reconstructs the
supplied static course through its original mission adapter. All fifteen
catalog aircraft in both modes complete the introductory lesson; gate crossing,
miss/wrong-direction, historical v1, tampering, cancellation and CLI tests pass.
[Feature and limitations](fpv-static-course-proof.md) ·
[Qualification receipt](fpv-static-course-tool-qualification-20261018.json).

The tooling is integrated unchanged as `eb44937112e205ac5336ae6ad49e0d0c6c71de66`
on the combined follow-up branch. All three file hashes match the reviewed
commit. It changes no shipped runtime, aircraft configuration, archive format or
scoring authority. The existing package receipt remains bound to its stated
source, not relabeled as a new build of the later tooling commit.

Dynamic/action-dependent courses, challenge wrappers, Regional/free flight,
partial-origin clips and unknown versions remain explicitly unsupported. Parsed
reports are descriptive output, not trusted production proof. The 39,000-tick
cursor check verifies bounded schedule traversal, not a long physical flight.
The original R11B increment did not include browser integration. R11C below
now shares its reconstruction kernel with the browser; comparison/ghost selection
and competitive qualification remain separate work.

### Browser course verification — implemented and locally accepted

**R11C** is committed through `5947bdcf5fbd9af302e25a959fdbcdbbfcfdbf1f` on
`codex/fpv-browser-course-proof-20261018`. The archive panel now offers **Verify
course completion**, separately from its unchanged physics-only check. It uses
the selected archive's frozen aircraft, settings, mode and historical mission
adapter against the current frozen course. Results remain unscored. Unsupported,
incomplete, mismatched and checkpoint-only recordings never become course proof.

The CLI and browser use one reconstruction kernel. A dedicated cancellable worker
keeps verification isolated from flight; World supplies its own course adapter
without adding the World model to Academy. Session replacement, same-owner
recovery, selection changes and disposal reject late results. Language changes
translate results and archive status without repeating verification or storage.

The focused suites pass **42/42 reconstruction**, **22/22 worker/runtime** and
**31/31 UI** cases. Independent review and **19/19 package** gates pass. These
counts are separate suites, not a claim of full-repository qualification.
[Acceptance record](fpv-browser-course-verification-20261018.md) ·
[Final committed-source package receipt](fpv-browser-course-package-qualification-20261018.json).

Rendered World Meteor75/Self-level completed **Meet your drone** at **14.48 s**,
paused at **16.34 s**, and independently verified the same completion time. Its
archive survived a normal reload and verified again while a different attempt
remained paused at **0.18 s**. An incomplete **26.86 s** flight correctly failed
course completion while its physics passed. Cancellation and EN/UK results pass.
An earlier excessive-throttle climb and a separate hard landing/inversion are
retained negative manual attempts, not completed-flight evidence.

The actual emitted Academy package flew a **3.88 s** Meteor75 draft, sealed it and
correctly returned verified physics / incomplete course. This confirms the shipped
worker entry and dependency closure in a browser; it does not claim offline-network
or native-device qualification. No public archives were changed or deleted.

Final Academy input headroom is **4,361 bytes** and bundled headroom is **32,682
bytes**; source slots remain **151/151**, with World at **211/211**. A complete
visual ghost must fit those limits or receive a separately reviewed size reduction.
Hosted integration/publication and deployed acceptance remain.

**R11D split-reference slice is now implemented, independently reviewed and locally
accepted** through `d4565cf6e`. [Detailed acceptance](fpv-practice-reference-20261018.md)
records prepared comparison/terrain matching, explicitly selected owned proof,
bounded split data and safe recovery. The real Meteor75 test retained its reference
through pause/resume and cleared it at checkpoint recovery. EN/UK and explicit
clearing passed. Automated scopes: 38 session/worker, 42 reconstruction, 69 UI, 20
validator/projection and 19 exact package checks; no skips in these groups.

A narrow generator prerequisite reuses the already shipped JSON validators,
saving 5,033 bytes with AST/boundary preservation. Final current Academy margins
are **4,259 original-input bytes and 32,579 bundled bytes**, source slots 151/151;
World remains 211/211. No caps changed. Hosted publication and deployed acceptance
remain. The next independent slice, **R11E**, is bounded geometry-correct visual
reference playback, provisionally **3–5 engineering days**, subject to capacity.
Do not reuse the legacy PB renderer's fixed geometry, origin or 12-minute ceiling.
No score or competitive promotion is enabled.

## Delivered and retained

| Accepted area            | Completed behavior                                                                                                                                                                                                                   | Evidence / qualification boundary                                                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rates and transfer       | Legacy plus Actual, Betaflight, Quick, KISS and Raceflight; versioned throttle, named profiles, per-setup assignments, CLI/preset review and native transfer.                                                                        | [Completion record](fpv-tuning-completion-plan.md). Firmware compatibility is limited to the verified releases 4.5.2, 4.5.5, 2025.12.4, 2025.12.5 and 2026.6.2; this does not execute Betaflight or translate its PID values into SIM gains.                                                               |
| Aircraft                 | Thirteen civilian presets, installed-component accounting, distinct numerical configurations, dimensions and simplified visualizations; editable battery/camera payloads and starter or retained rates.                              | [Original twelve](fpv-aircraft-presets.md), [Mobula8 and source limits](fpv-civilian-kits.md). Physical coefficients remain estimates where identified measurements are absent.                                                                                                                            |
| Practice and recording   | Aircraft-aware Academy, World, learning and Regional practice; unrestricted flight, bounded recent clips, recovery, persistent segmented archives and bounded ghosts. Storage failure does not stop flying.                          | [Implementation](fpv-aircraft-completion.md), [archives](fpv-aircraft-archives.md). Verification certifies recorded simulation behavior, not real-world fidelity or scored eligibility.                                                                                                                    |
| Optional endurance       | Depletion off by default; explicit battery/timed challenges preserve ordinary continuous practice.                                                                                                                                   | [Battery](fpv-aircraft-endurance.md), [challenges](fpv-aircraft-challenges.md). Mass, propulsion limits and instantaneous sag remain active without depletion.                                                                                                                                             |
| Workbench                | Basic/Expert views of one draft, search, rates/throttle/camera previews, shared-profile ownership, undo, import review, calibration/test return and complete setup saves.                                                            | [Workbench record](fpv-setup-workbench.md). Actual 200% Chrome zoom has new EN/UK evidence above; physical-device usability remains separately unverified.                                                                                                                                                 |
| Controller tools         | Independent reusable-tune library; manual A/B conditions; isolated simulation bench with physics-step metrics; bounded one-gain assistant with separate validation and explicit application.                                         | [Workbench phases 2–3](fpv-setup-workbench.md). All assess the SIM model; they do not establish real-aircraft tunes.                                                                                                                                                                                       |
| Flight regression repair | Regional headings, dense collision frames, pause/prefetch coordination, terrain recovery and paused-browser-stall recovery corrected. Learning reference demonstrations cannot silently replace selected-aircraft practice.          | [Flight audit](fpv-all-aircraft-flight-audit.md), PRs [#1577](https://github.com/mekhovov/revealline/pull/1577) and [#1580](https://github.com/mekhovov/revealline/pull/1580). The new keyboard pause/resume defect is reproduced and locally corrected above; earlier fixes remain source-bound evidence. |
| Latest usability repairs | No persistent archive before accepted flight progress; correct Draft / Saved for next flight / Used by this flight status; direct mouse/touch curve inspection with exact keyboard alternatives; completed archive-refresh feedback. | [PR #1583](https://github.com/mekhovov/revealline/pull/1583), released and checked on the public site. No physics constants, timing, historical identities or saved-library formats changed.                                                                                                               |

Recovery with retained flown history can create a checkpoint-origin archive
immediately; it need not wait for a new resumed tick. The lazy-start correction
prevents empty archives for fresh, unflown sessions without dropping recovered
history.

Implemented aircraft: **Air65 II Racing, Meteor75, Meteor75 Pro, Meteor85,
Mobula8, Pavo20 Pro II, SMART35, Nazgul ECO XL5, Mach R5 Sport, Rekon7 PRO,
Chimera7 Pro V2, Helion Pro and X650 V2**. These are available through the shared
practice paths. Fixed historical/scored challenges retain their original rules;
selected-aircraft practice variants provide access without rewriting old results.

## What the checks establish

| Evidence                        | Result                                                                                                                                                                                                                                                        | Limit                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Latest correction release       | **1,183/1,183** flight/practice checks, **1,756/1,756** broader preview/Appearance/SIM checks, **1,364/1,364** candidate primary checks and **10/10** pointer checks passed; normal package builds and publication passed.                                    | Separate suites overlap and must not be added into a unique-test total. [Flight/candidate run](https://github.com/mekhovov/revealline/actions/runs/39104883750), [preview run](https://github.com/mekhovov/revealline/actions/runs/39104883723), [release deployment](https://github.com/mekhovov/revealline/actions/runs/39106933666).           |
| Catalog and modes               | **5,616 startup combinations** and **728 short flight/configuration checks**; changes to mass, rates and PID alter actual solver motion across hosts.                                                                                                         | Startup checks generally accept one mission tick; sampled flights are approximately 3–4 seconds. Entries may share maps. This is not every completed lesson/course or every downloadable edition. [Coverage details](fpv-all-aircraft-flight-audit.md).                                                                                           |
| All-model public flights        | **26 brief keyboard takeoff/steering flights**, all thirteen aircraft in Acro and Self-level, on `4f68b924ee74`.                                                                                                                                              | Historical source-bound acceptance, not a new interactive pass on the current release or a physical-radio test.                                                                                                                                                                                                                                   |
| Latest correction UI acceptance | Meteor75 draft flights and archive verification in local Academy, World and Regional; public rate inspection, correct active-flight status, unchanged archive count before flying, and continued flight despite full archive storage.                         | The final public Meteor75 Acro observation lasted **2.76 seconds**. Existing saved setup/settings and archives were preserved. No sustained-flight or full-mission claim follows from this short check.                                                                                                                                           |
| Numerical behavior              | Original twelve-aircraft report selects **500 Hz** against the **2 kHz** reference, with browser/worker agreement on the recorded Node/Chrome/Firefox/WebKit environments. Mobula8 has later catalog-wide numerical checks and the all-thirteen flight audit. | The recorded cross-browser numerical report covers twelve aircraft on one Apple M4 Pro; it is not a refreshed thirteen-aircraft/device matrix. The historical reference backend's **250 Hz** identity remains separate. [Numerical report](fpv-aircraft-numerical-qualification.json), [browser report](fpv-aircraft-browser-qualification.json). |
| Continuous flight / delivery    | A recorded local flight exceeds twelve minutes; segmented archives, quota-failure trajectory equivalence, checkpoint recovery and offline/native staging have evidence.                                                                                       | Desktop native execution is an unsigned simulator-only ARM64 Mac development shell. iOS staging is not iOS runtime; desktop offline checks are not all OS-installed PWA/update/eviction scenarios. [Aircraft completion](fpv-aircraft-completion.md), [native receipt](fpv-native-second-review-qualification.json).                              |

The first PR #1583 full flight run passed **1,182/1,183**: an obsolete arena test
expected an archive before flying. Its replacement checks idle sessions, short
canonical flights, continuation and interruption of a genuinely flown session.
The corrected run passed **1,183/1,183** before publication. Earlier **35/35**
archive and **213/213** draft/curve/library/host checks remain supporting evidence,
not additional unique-test totals.

Earlier local browser evidence included a 7.16-second Meteor75 archive verified
from reset, a saved/draft roll readout of 145.7/184.0°/s at 50% stick after an
explicit 600→800°/s rate edit, and correct active-flight status after restart.
These observations stay tied to that earlier served source. Publication is now
confirmed; the old queued/final-run-pending wording is superseded.

## Remaining work, priorities and estimates

**Estimates are active engineering effort after the listed dependency is met,
not promised calendar dates.** No overall completion date is defensible while
measurements, devices and pilot availability are unknown. Missing radio/log/pilot
evidence was explicitly deferred by the user and must not block independent
software work. Defects found during qualification may extend these ranges.

P1 is the next available assurance work; P2 improves coverage or closes external
qualification; P3 depends on a qualified physical/platform baseline.

| ID / priority                     | Remaining item and current status                                                                                                                                                                                                                                                                                                                          | Estimate / dependency                                                                                                                                                                                                                            | Done when                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 / P1                           | Refresh browser evidence on a frozen current release: all fifteen current catalog aircraft plus longer representative learning/course/Regional flights and pause/recovery under rendering/streaming load. **In progress; a reproduced keyboard pause/resume defect is now locally corrected.**                                                             | **1–2 working days** for one available desktop/browser pass, excluding fixes. Requires a stable release snapshot and bounded, recorded route selection.                                                                                          | Each aircraft launches and steers; representative small/large aircraft complete selected maneuvers/routes in both flight modes; setup/PID/rate identity, contacts, pause/recovery and continued practice are recorded. Include a flight beyond twelve minutes and clearly list untested combinations. This does not promise exhaustive completion of all 6,480 current startup combinations. |
| R14 / P1                          | Selected-aircraft lesson completion: **implemented, independently reviewed and locally accepted**. The versioned floor adapter preserves physical state and historical recovery. All 15 aircraft × both modes complete one original lesson in simulation; rendered Meteor75 World completion and continued flight pass.                                    | **Hosted integration and deployed acceptance remain**; usually several hours, subject to runners and failures.                                                                                                                                   | Publish the versioned adapter, repeat the representative public lesson and retain explicit limits: this is not exhaustive course or real-aircraft qualification.                                                                                                                                                                                                                             |
| R15 / P1                          | Backup restore commits but the editor can retain a now-absent setup and report a `profileId` error. **Locally corrected: 179/179 tuning/library checks and rendered one-step restore pass.** The original settings are confirmed restored and the active flight remains paused.                                                                            | **Less than one engineering day plus release checks.**                                                                                                                                                                                           | One-step restore chooses a valid restored setup, clears stale draft state and preserves the active attempt; regression and rendered acceptance pass.                                                                                                                                                                                                                                         |
| R16 / P1                          | Apply & restart automatically starts the new aircraft attempt before Arm, contradicting the paused-start promise. **Corrected and independently reviewed; rendered World now waits at 0.0 seconds until Arm.** Academy and Regional boundaries pass targeted checks.                                                                                       | **Less than one engineering day plus release checks.**                                                                                                                                                                                           | Successful setup application creates a fresh unarmed attempt; only explicit Arm advances flight, while ordinary Fly now behavior remains intact.                                                                                                                                                                                                                                             |
| R13 / P1                          | Diagnose missing archive inventory and establish retention across reopen. **Open:** sixteen cached public entries became one refreshed new session; the six protected entries are unconfirmed. Reconnect is corrected, and transaction-level tests retain unrelated archives, but native loss is unexplained.                                              | **1–2 engineering days for instrumented reproduction after an appropriate diagnostic context is available; recovery ETA unknown.** No further destructive cleanup.                                                                               | Source-bound native database/context evidence identifies the failure; unrelated archives survive confirmed single deletions, writes, interruption and reopen. Recover or explicitly account for the six protected records. See [incident](fpv-archive-retention-followup-20261018.md).                                                                                                       |
| R2 / P1                           | Complete a page-by-page / sheet-tab **civilian source-kit disposition inventory**. **Completed bounded inventory:** 41 returned Swarm records and ten sheet tabs dispositioned in [the inventory](fpv-civilian-source-inventory.md). Only the explicit civilian indoor kit maps to Mobula8; excluded/ambiguous items are not implemented.                  | **Complete for the accessible catalog snapshot.** Refresh only when sources change or a specific civilian reference is clarified.                                                                                                                | Every accessible source entry has its exact name, supported civilian aircraft mapping, implemented/research/non-aircraft/excluded status and evidence gaps. Military-specific configurations remain excluded from this recreational scope.                                                                                                                                                   |
| R3 / P2                           | Actual **200% browser zoom** accessibility check. **Completed on Chrome Guest in EN/UK at verified 200%; corrected camera fields also pass final-source DOM acceptance.** Prior 640 × 360 remains only a separate layout proxy.                                                                                                                            | **Local acceptance complete.** The [receipt](fpv-flight-continuation-20261018.md) distinguishes actual zoom and final-source DOM checks; deployed acceptance follows publication.                                                                | Numeric fields/actions remain reachable and focus unobscured in EN/UK; zoom is restored. Keep narrow viewport and actual zoom evidence separate.                                                                                                                                                                                                                                             |
| R4 / P2, optional cleanup         | Remove the ten identified temporary public test archives. **Authorized, but not completed: the first action reported an error, its commit outcome is unknown, and after reload the prior inventory was no longer listed.**                                                                                                                                 | **No cleanup ETA until the missing inventory is understood/recovered.** Do not delete the new test session as a substitute or claim the six older archives were preserved.                                                                       | Re-identify only the ten test entries from 18 October, 05:13–05:50 UTC (07:13–07:50 CEST), preserve six older entries and all settings, and verify capacity. No automatic deletion. This affects archive capacity, not ability to fly.                                                                                                                                                       |
| R5 / P2                           | Resolve and implement additional supported civilian candidates, presently **Cetus X Betaflight ELRS** and **CADDXFPV Protos**. **Implemented and locally accepted with explicit evidence/assist limits; publication pending.**                                                                                                                             | **Hosted release checks and public acceptance remain**, normally several hours but dependent on CI queues or newly found defects. Matched propulsion maps and whole-aircraft measurements remain absent.                                         | Exact named configuration, explicit battery inclusion, component accounting, honest assist capability, individual visualization and all-host regression coverage. If proprietary behavior cannot be represented, report that limitation rather than claim an exact replica.                                                                                                                  |
| R6 / P2                           | Activate a qualified measured propulsion model and fit motor response, inertia, directional drag and electrical behavior. **Both implementation and measurement work remain.**                                                                                                                                                                             | **5–10 engineering days for one reference aircraft after a complete usable dataset and fit scope are accepted**, as an initial planning allowance; data collection and all-fifteen delivery cannot yet be dated.                                 | Versioned, deterministic measured-map adapter with identified motor/propeller/ESC/voltage/density/flow conditions, bounded interpolation/extrapolation and consistent power/current; held-out response checks. Preserve old backends. The current evidence inspector alone does not close this item.                                                                                         |
| R7 / P2                           | Physical USB radio and touch-device checks, including mapping, calibration, input ownership and observed cadence. **Deferred / unmeasured.**                                                                                                                                                                                                               | **1–2 working days per representative target** after devices are available, plus fixes.                                                                                                                                                          | Real-device flight and setup workflows pass; browser sample cadence is not misrepresented as physical input latency. Keyboard or emulated input does not substitute.                                                                                                                                                                                                                         |
| R8 / P2                           | Experienced-pilot comparisons. **Deferred by the user.**                                                                                                                                                                                                                                                                                                   | **2–3 comparison sessions plus 1–2 review days** after pilots are available; scheduling unknown.                                                                                                                                                 | Repeatable documented maneuvers, subjective A/B feedback and reviewed keep/revert outcomes. Pilot preference and measured physical fit remain distinct evidence.                                                                                                                                                                                                                             |
| R9 / P2                           | Wider platform qualification: Intel/other architectures, low-end/mobile, iOS runtime, sustained rendering/streaming, actual OS-installed PWA update/offline/eviction behavior. **Only limited desktop/browser/native-fixture evidence exists.**                                                                                                            | **3–5 working days for an initial agreed small device matrix** after access, with **1–2 days per additional target** as a planning allowance; remediation extra.                                                                                 | Source-bound replay, contact, capacity, worker lifecycle, storage/recovery and installation tests pass on actual targets. Refresh the all-fifteen matrix; staging/emulation alone does not qualify a device.                                                                                                                                                                                 |
| R10 / P3                          | Measured propwash and ground effect. **Gated on a qualified base and effect-specific evidence.**                                                                                                                                                                                                                                                           | **No dependable ETA yet.** Define a fit/implementation estimate only after usable measurements and acceptance tolerances exist.                                                                                                                  | Each effect has an identified measurement basis and held-out validation, with versioned behavior and preserved historical playback. Arbitrary coefficients cannot close the gate.                                                                                                                                                                                                            |
| R11A / P2, independent software   | **Implemented, independently reviewed and locally accepted** at `a113208ce8e4076c19b2acc99332c3172e53bfcc`. Academy/World aircraft practice shows bounded, unscored objective times. All fifteen aircraft in both modes retain identical full recovery output with observations enabled/disabled. Rendered Meteor75 lesson and EN/UK recovery labels pass. | **Hosted integration and deployed acceptance remain.** Actual package checks pass; its original 683-byte margin became 52,800 bytes at R18 (32,682 after R11C); every later integration still needs remeasurement.                               | Accepted mission intervals only; no 12-minute ceiling or invented pre-recovery history. No physics/configuration/recording or scoring authority change. Regional free flight explicitly has no course splits.                                                                                                                                                                                |
| R17 / P2                          | **Implemented, reviewed and locally accepted** at `39a8be8c19c2a107b7be2352f45dbfe5cc23f5cd`. Existing recovery messages follow EN→UK→EN without repeating operations or live-status writes; the known full-store reason translates and unknown diagnostics remain literal.                                                                                | **Hosted integration and deployed acceptance remain.** 36/36 focused controls checks and 19/19 package checks pass. Rendered recovery/language-switch acceptance passes on a fresh isolated origin.                                              | Publish without changing recovery/storage/physics behavior. Its original 261-byte Academy margin became 52,800 bytes at R18 (32,682 after R11C); full-store translation was tested automatically, not reproduced in that fresh-origin rendered check.                                                                                                                                        |
| R11B / P2, independent software   | **Tooling complete, independently reviewed and committed** at `a1d883ccedb68704acc320352ec6a3f895d8b580`; integrated unchanged on the combined follow-up. 42/42 checks pass, including all 15 aircraft × both modes on one lesson. No shipped-runtime, archive-format or scoring changes.                                                                  | **Repository integration/release remains.** No radio/pilot dependency. Browser integration is locally complete in R11C; split references are locally complete in R11D; visual ghosts remain R11E.                                                | Exact bounded dependency, canonical reset/terrain/inputs and segment hashes are verified through the original mission adapter. Dynamic/action-dependent courses, partial origins and unknown versions fail closed. Reports grant no comparison eligibility.                                                                                                                                  |
| R18 / P1 integration prerequisite | **Implemented, independently reviewed and accepted locally** at `7f38f550e5f67278aea5fa8d1f3aad1b059caa0c`. Build-only presentation indentation projection saves 52,539 bytes with exact asset/token preservation. Actual packaged Academy startup, previews and EN/UK paused recovery pass.                                                               | **Hosted integration and publication remain.** Preservation 9/9 and packages 19/19 pass. At R18, bundled Academy had **52,800 bytes** spare (32,682 after R11C); original-input margin and full file counts remain constraints.                  | Publish the reviewed projection with unchanged caps, numerical identities, offline pins and assets. Every later runtime/dependency addition still needs a fresh capacity check.                                                                                                                                                                                                              |
| R11C / P2, independent software   | **Implemented, reviewed and locally accepted** through `5947bdcf5`; shared CLI/browser course kernel, dedicated cancellable workers, explicit course-completion UI and EN/UK feedback. World real lesson and actual packaged Academy checks pass.                                                                                                          | **Hosted integration and deployed acceptance remain.** 42 reconstruction, 22 worker, 31 UI and 19 package tests pass within their recorded scopes.                                                                                               | Published course checking preserves historical recordings, current-flight configuration and unscored status.                                                                                                                                                                                                                                                                                 |
| R11D / P2, independent software   | **Implemented, reviewed and locally accepted** at `d4565cf6e`: owned complete proof, prepared comparison/terrain filtering, explicit unscored split selection, copying and lifecycle safeguards.                                                                                                                                                           | **Hosted integration and deployed acceptance remain.** Exact packages pass: 4,259 raw-input and 32,579 bundled Academy bytes spare.                                                                                                              | Publish with no physics/recording/score authority changes; retain documented browser and automated scope.                                                                                                                                                                                                                                                                                    |
| R11E / P2, independent software   | **Designed, not implemented:** bounded geometry-correct visual aircraft reference, reusing verified course output and the existing physical model.                                                                                                                                                                                                         | **3–5 engineering days**, provisional; source-file slots are full and original-input capacity needs a measured prerequisite if the implementation cannot fit.                                                                                    | Correct metre/COM/orientation/geometry, bounded memory and accepted samples only, full-tail verification, safe cancellation/recovery and all-host compatibility.                                                                                                                                                                                                                             |
| R11 / P3                          | Advanced scored comparison/sector integration and default promotion. **Not enabled; integration as well as qualification remains.**                                                                                                                                                                                                                        | **Software proof/sector/ghost work can proceed before external qualification.** Promotion allowance remains **1–2 engineering weeks after relevant physical/platform gates and comparison rules are agreed**, provisional; no calendar date now. | Comparison/sector filtering and verified records work with frozen identities; platform/physical qualification and a reviewed promotion decision are recorded. Practice archives remain unscored until then.                                                                                                                                                                                  |
| R12 / separate distribution scope | Signed/full-game native distribution. **Unscheduled product/packaging work; simulator-only fixture is delivered.**                                                                                                                                                                                                                                         | **Not estimated** until target platforms, signing/distribution access and package-budget scope are decided. Does not block the current web release.                                                                                              | Reviewed package fits the distribution budget and passes signed installation, update and runtime checks on its target platforms.                                                                                                                                                                                                                                                             |

R2 covers the requested [Swarm kit catalog](https://swarm.army/kits) and
[multi-tab kit spreadsheet](https://docs.google.com/spreadsheets/d/1nCYfjbcyr1H6p-15pXcK9bmx5YWTSem229Sen8fiLLo/edit).
The [inventory](fpv-civilian-source-inventory.md) records each public record and
tab, its exact title and disposition, along with the first-party feed/loading-shell
and bounded sheet-header inspection limits.

Current sequence: **publish the verified pause/resume and archive-feedback corrections →
release the versioned lesson adapter, backup-restore repair and explicit-arm correction → deployed lesson
acceptance**, while the archive-retention investigation remains open. R2 inventory and R3 local paired-control acceptance
are complete; R5 candidates await hosted release checks.
R4 is now tied to the open archive-retention incident; approval is no longer missing.
R6 software preparation proceeds independently; measured activation and R7–R9
qualification await the relevant evidence/devices. R10 and competitive promotion remain downstream; R11A observed timing, R11B static-course tooling and R11C browser verification are locally complete; R11D reference/ghost integration is next. R17 locale recovery and R18 byte headroom are locally accepted; their publication and later comparison/ghost integration remain separate gates. Do not wait for
R6–R12 to improve released practice.

### R6 software and evidence follow-up

A separate exact-component correction is committed as
`48373316b65bf14e3731569e9de9296fcdb553d0` on
`codex/fpv-nazgul-diameter-20261018`, not yet published. The Nazgul V1.1 aircraft
specifies F5 props; the matched manufacturer SKU specifies **5.1 inches**, or
**129.54 mm**, rather than the previous 127 mm class-based value. New preset
revision 2 corrects the radius; the older saved configurations and both recording
backends retain their dimensions and hashes. **32/32** targeted checks and
independent review pass. The other fourteen aircraft are numerically unchanged.
The correction deliberately preserves the existing estimated reaction torque;
a dimensional specification does not supply a propulsion measurement.

The exact Meteor75 reference remains **0802SE 19500KV, 40 mm two-blade props and
BT2.0 1S 450 mAh**. The [manufacturer battery page](https://betafpv.com/products/bt2-0-450mah-1s-30c-battery-4pcs)
provides an image of voltage versus time under a constant 11 A discharge. It is
not a motor/propeller map, a maximum-current measurement or a battery-resistance
measurement. Raw observations, test temperature, cell age and repeated samples
remain unavailable. No matched propulsion dataset was found in the bounded
primary-source follow-up; do not blend another motor revision into this preset.

Software preparation continues without pilots or real radios. Commit
`66305696561c6c35e065a009066364cf777fe10c` on the separate
`codex/fpv-propulsion-load-20261018` branch implements a non-activating load-line
solver: it intersects documented voltage paths and solves battery voltage against
their current, using explicit battery-model inputs and a caller-declared DC
current basis. **30/30 tests** pass (14 new load cases and 16 existing evidence
cases); formatting, lint and independent review pass. Review caught and corrected
a false solution at nearly coincident voltage samples; that case now returns an
explicit numerical-resolution failure. [Contract and limits](fpv-propulsion-evidence.md).

The initial kernel increment is a local numerical prerequisite without an external
measurement bundle or catalog change. Its subsequent inspector integration is
described below. It does not delay PR #1626, activate measured aircraft physics or
close R6. Command/voltage surfaces, allocation, versioned runtime integration and
real measurements still remain.

Non-activating inspector integration is committed as `9d4da6c13` after dependency
commit `f9ddc2693` on that follow-up branch, not yet published:
manual circuit assumptions, an explicit DC-input-current declaration and a
user-requested calculation against the imported eligible voltage sweep. It has
no aircraft write path or measured-default claim. **46/46** targeted checks and
**19/19** package checks pass, along with independent review. A local English
browser check on `40611b264` reached the inspector through World Settings →
Workbench → Expert PID → Advanced reference practice, imported explicitly
synthetic voltage data and obtained the expected **2.5 V / 2.5 A** operating
point. Input editing cleared results, and the built-in command-axis example
disabled calculation with an explanation. No flight was started or configuration
saved; the draft and Basic preference were restored. This does not qualify
Ukrainian rendering, narrow layouts or production deployment. Hosted release
remains. The later combined measurement on `ad7225621` leaves only **7,339 bytes**
in the unchanged bundled Academy byte budget. Observed splits and the locale correction have their own committed-source measurements above; R18 subsequently increases the bundled margin to **52,800 bytes**. These are actual package measurements, not source-size projections.

## Blockers, concerns and scope boundaries

- **Realism is not yet measured for all aircraft.** All fifteen local candidates use estimated
  propulsion; inertia, drag, motor lag, reaction torque and electrical parameters
  also retain estimate labels. Manufacturer component names, correct installed
  mass, a passing numerical benchmark and partial static motor points cannot
  establish exact real-aircraft handling. [Fidelity limits](fpv-all-aircraft-flight-audit.md),
  [propulsion evidence](fpv-propulsion-evidence.md).
- **Source-kit scope is incomplete.** The broader site/spreadsheet request must
  not be marked fully delivered. Ground equipment is not aircraft mass or a new
  drone. Military-specific configurations are excluded, not pending work with an
  ETA. Cetus X and Protos now have frozen variants and explicit mass/assist uncertainty labels. The bounded civilian inventory is complete, without converting ambiguous or excluded entries into invented presets. [Source record](fpv-civilian-kits.md).
- **Flight coverage has limits.** Short flights and startup matrices do not
  establish full-course completion, sustained performance on every device or
  every map edition. One earlier World readiness timeout remains unexplained;
  later successes did not establish its cause. It is a historical reliability
  concern, not a reproduced current blocker. [Recorded limitation](fpv-input-recovery-delivery-verification.json).
- **Current live checks found real regressions.** Public Meteor75 pause/resume failure and native camera input/slider observations are retained alongside local fixes. A local archive connection-close error remains under investigation. Automated/source checks do not erase these observations.
- **Some acceptance needs outside access.** Physical radio/pilot evidence is
  deferred; wider devices and iOS runtime need actual targets. Actual desktop Chrome page zoom now has EN/UK observations; other devices remain separate. No available
  measurement has been relabeled as passed to close those rows.
- **Archive capacity may still need explicit cleanup.** The last public test
  observed a full sixteen-entry store and confirmed continued flight. The new
  lazy-start fix prevents new empty archives; it does not delete old records.
  The deletion operation reported an error; a single delete may have committed before the refresh failed. Reload then exposed a different inventory. The six older entries cannot be confirmed preserved; no further deletion is authorized outside the named ten.
- **Local workspace is shared and resource headroom varies.** Unrelated demo/UI
  edits remain untouched. Available disk space was approximately **1.1 GiB** during the failed-storage investigation and **4.3 GiB** at the latest check. Heavy verification already running in hosted CI is not duplicated locally; focused source/tests use isolated sparse worktrees. Free space changed during the audit, so recheck
  before large builds. Do not delete user files, archives or generated work to
  manufacture a passing check.

## Completion rule and review cadence

Update each row separately for implementation, automated qualification,
interactive acceptance and publication. A completed software feature is not a
passed physical/device gate. Preserve original failures beside subsequent
regression evidence, and record source/date/device with every new receipt.

Only add new implementation work for an accepted remaining item or a demonstrated
defect. Do not create unrelated features or repeatedly rerun unchanged suites to
make an open measurement gate appear complete. Estimates must be revised after
new data, device access or a reproduced failure changes the scope.

This continuation includes runtime corrections, two civilian presets and new
qualification tooling. Publication status will be updated only after normal
build/deploy checks and public acceptance. No physical-device or measured-fidelity
gate is closed by the software-only results.
