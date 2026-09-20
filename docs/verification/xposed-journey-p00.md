# Journey P00 — scoped implementation evidence

20 September 2026. Candidate version **0.67.0**, isolated branch
`codex/xposed-journey-p00`, based on main `ce8c72ed`. This is a technical preview,
not a released or human-validated campaign. The user's dirty original checkout
was not modified. Version 0.66.0 was already allocated to merged Team/Studio work.

## Scope

Open `game/?journey=1` to exercise the opt-in Solo route. The ordinary entry and
historical simulation/save formats remain unchanged. The route indexes 35 active
bundled missions, not all 110 historical/external maps and not the replacement
curriculum. Global search and campaign filters open from one Missions action.
Next crosses pack boundaries; Skip needs two activations and grants no clear.
Total Solo defeat resets the attempt automatically. Required picture preparation
keeps the old flight/result until the successor is accepted.

Progress uses stable composite mission IDs and a version-independent IndexedDB
database. Failed, blocked, corrupt or unresponsive storage retains session progress,
reports the limitation and offers Retry/Export. Transactions merge events across
tabs. Completion receipts bind run ID, gameplay identity and explicit difficulty.
Backup restoration and full cross-mode Journey navigation remain pending.

## Recorded checks

- Source validation passed for version 0.67.0: 665 files and valid literal references.
  Existing diagnostics/release/privacy/credits navigation warnings remain reported.
- Full source ESLint passed. Source/native formatting passed in the earlier focused
  run; final formatting is repeated before commit. Field Kit reproduction passed:
  revision 32, 293 slots, 131 files, no missing slots. This is not pixel acceptance.
- Earlier focused runs passed catalog/profile/capture tests and the complete
  16-test existing Solo result-continuation suite. The final combined rerun is
  tracked separately; do not infer a full-suite pass from these subsets.
- Real-host fixtures cover ten consecutive legal wins followed only by Next,
  two-action Skip with no completion, chooser return, automatic defeat reset,
  cold-pack cancellation followed by a newer selection, and failed cross-pack
  Next followed by retry. These are modeled DOM/input, not human enjoyment evidence.
- Existing Team core and paired-race equality fixtures passed in the earlier
  focused cohort. They do not qualify new Team missions or physical controllers.
- All 64 supplied reference files matched inherited byte lengths and SHA-256 hashes.
  The 48 map observations are inherited full-frame research, not 48 new visual
  inspections during implementation. Their provisional redesign proposals and
  final-disposition-pending labels are retained in the migrated ledger.
- Static compilation inspected all 110 existing Solo missions. Four player-speed
  values (8/10/12/15) and 87 countdown missions demonstrate concrete inconsistencies
  to remove in new editions. No old edition's physics was silently rewritten.

## Native browser observations

The local in-app browser loaded the actual game, selected Midnight Channel through
global search, and started Night Shift. After reload, Continue resumed the stored
flight with one activation. Missions was visible during play at the narrow viewport
and opened the chooser directly. Escape returned to the visible Missions opener
while leaving the attempt paused.

Responsive checks used 390×844 and 844×390 viewport overrides. Existing browser
zoom produced observed CSS viewports approximately 433×938 and 938×433; no claim
of 100% zoom or physical-device testing is made. Final short-landscape geometry:
card height 128 CSS px; list bottom 375.75; Back top 381.35/bottom 425.34 within
433 CSS px. Back did not cover the card list. Overrides were reset afterward.

Initial failures are retained here: existing Field Kit CSS compressed cards to
44px; a scoped min-block-size correction restored readable 128px cards. A sticky
Back action overlapped the list; separate grid rows corrected it. Screenshot
captures after resizing contained duplicated compositor strips, so they are not
treated as clean visual baselines; DOM geometry and accessibility observations
have their narrower scope.

## Failed fixture attempts and limits

### Official Journey gameplay identity

Source review found that IDs alone admitted an edited imported campaign under an
official Journey mission. P00 now compares the existing normalized campaign and
equipment identity with a shipped pin before mission adoption or progress recording.
All eight active pack pins are checked against their actual original files, and
Standard/Gentle projections retain the original authored identity. The base campaign
is bound directly to its shipped boot data. This is local progress provenance, not
anti-cheat, authentication, or permission to overwrite imports.

An edited same-ID pack is retained in Library and refused as official Journey
content with an explanation; the current flight remains paused and intact. No
automatic replacement or migration of the player's custom pack occurs. The new
unit test initially failed because the authority module had not yet been created;
that is a test-first missing-module result, not a native exploit reproduction.
The host regression separately exercises the actual chooser and modified pack.
Qualification of `1c1136e5` predates this correction and is precursor evidence only.

After adding the check, the actual local browser reloaded, opened title Missions,
searched Midnight, and launched the already-installed official Midnight Channel
card in one activation. The arena became active with a running timer; Escape
returned to the paused overlay with Resume focused. This verifies local ordinary
launch and return, not public delivery or the edited-import refusal in a native
browser. Source validation reported 667 files; full lint, source/native formatting,
motion syntax and production/readiness checks passed on the correction worktree.
The complete three-file Journey cohort passed 21/21 tests with no skips in
126.70 seconds. This includes ten consecutive Next transitions, storage recovery,
all three cold-cancellation routes, refusal of edited same-ID content with the
old flight retained, and ordinary cross-pack failure/retry. The authority unit
file also passed independently after changing its equipment case to a gameplay
cooldown mutation. Complete hosted qualification is still required.

Post-PR review reproduced another real bug: opening Missions during a held cold
pack download did not retire the old pack owner, so a new card selection could
be ignored. The new-chooser regression failed with an unsettled host action before
the fix. Cold Journey ownership now participates in the existing cancellation
path and explicitly hands off to the picture/result ticket. Button and Escape
cancellation remain separate cases. The original 57d87413 qualification runs are
precursor evidence and cannot qualify this corrected source.
The corrected scoped rerun passed all five selected stable-Continue, cancellation
and cross-pack cases (28.52 s; four intentional nonmatching skips). The failing
new-chooser case now passes without requiring the user to press Cancel first.

A subsequent held-picture test initially used the old fixture's hidden Start
route while the new chooser was open; its zero-tick failure was a fixture error,
not a failed legal capture. After switching to visible title Start, the test
reproduced a separate ownership defect: cancelled picture decoding still held the
outer Journey launch lock and blocked a newer mission. The pack owner now releases
that lock when handing off to the existing cancellable picture/result ticket.
The fixture requires the newer mission to start before the old decode resolves,
then verifies late completion cannot replace it. Earlier 61be4a51 runs are also
precursor evidence, not qualification of this correction.
The corrected held-picture regression passed in 15.65 s (one selected test,
16 intentional nonmatching skips). The four selected cold-cancellation and
cross-pack cases passed again in 27.38 s. Changed-file lint/format checks passed.

The original cross-pack fixture lacked an Image decoder seam. Its correction
models decode completion and image dimensions, not actual pixels. The next cold
run exceeded the ordinary five-second fixture wait while original-picture identity
verification was still active. A scoped 30-second elapsed bound now covers this
cold verification; the final corrected isolated run passed in 19.29 seconds including
gameplay. Runtime deadlines and warm UX targets were not relaxed. This is not
evidence that warm Next meets its 1.2-second target.

Only about 1 GiB local disk space remained during qualification. Large local
build/freezing was not attempted and no user artifacts were removed. Full source
families, ordinary build and freeze must run on hosted runners, with their exact
commit/run identities recorded before promotion.

## Native Skip cancellation correction — September 20

Real keyboard play produced a First Signal clear at 52.2% earned coverage, 8,160
points and three lives; one Enter on Next opened Relay Orchard without a menu.
Another capture reached 52.2% and Cartridge 1/1 there, but no second clear was
observed. Reload later restored that flight. These observations do not establish
warm timing targets or human enjoyment.

Native testing found that arming Skip moved focus to Resume. The new host focus
assertion reproduced that failure (`start-button` instead of `journey-skip`).
Returning focus to Confirm skip fixes the keyboard's second activation. Escape
then exposed a second defect: play resumed with confirmation still armed. The
extended host assertion failed with `Confirm skip` instead of `Skip mission`.
Resuming now disarms confirmation and replaces its obsolete warning.

After both corrections, the selected Skip regression passed (one test, nine
intentional nonmatching skips; 1.27 seconds). In the actual reloaded browser,
Crosswind's first Enter armed Skip with focus retained; Escape resumed the same
mission with `Skip mission` and `Skip cancelled. Continue this mission.` A fresh
first activation only armed it, and the second opened Stone Lanes, with 0% coverage,
three lives and the canvas focused. Stone Lanes was left paused. This is keyboard
evidence, not physical controller/touch or precise latency qualification.

The early capture caption also now uses singular `region remains` correctly.
Hosted runs for `9375eb59` precede these corrections: even when green, they are
precursor evidence and cannot qualify the corrected source for publication.
Their original logs were retained and reviewed: PR run `35475557265` and manual
run `35475555280` each passed 6,567 tests across 505 test files, with zero failures,
cancellations or test skips. Preflight, ordinary build and manual freeze succeeded.
The actual PR automation helper bytes matched the candidate's corresponding files;
all twelve pre/post PR source-identity records agreed. No frozen-artifact inspection,
immutable release or Pages acceptance is claimed from that source-only review.

The complete corrected Journey authority/catalog/profile/host cohort then passed
21/21 tests without skips in 166.67 seconds. Full source lint, source/native
formatting, content validation (667 files), motion-lab syntax and production/readiness
checks passed. Two local command invocations initially named nonexistent test and
syntax files; corrected paths were used for the successful checks. Neither command
error is represented as a runtime failure or a passing gate. Hosted qualification
of the next committed source is still required.

## Outstanding acceptance

### Accepted v0.66 integration and capture-teaching correction

Integration `b5193ca1` composes actual v0.66 publisher
`7b898a7ba4a5007397d02d8911e0577668d3bc99` without changing its publication files.
All 48 inherited paths merged cleanly; publishing, the release skill, README and
delivery priorities match that publisher. The game/package/scripts remained equal
to precursor `34e3f742` before the explicit correction below. Version stays 0.67.0.
The separately reviewed public acceptance receipt is 5,010 bytes, SHA-256
`7fc90c84f1417ad1b16d913786a673d3668d7114d34b907aea65a48767496622`;
its accepted scope and untested hardware/human boundaries are not broadened here.

The early Journey `cells.claimed` explanation was overwritten by the subsequent
`capture.stopped` event in the same closure. Both now use the same engine-derived
retained-region explanation; the stopped message also retains the fresh-direction
cue. Legacy feedback and simulation/replay identities are unchanged. An actual-host
two-keeper fixture installs through Library, starts normally and legally closes a
line-only cut. It checks both occupied regions/actor identities, the explanation,
the stop cue and persistence through the following frame. Fixture development on
P01 first exposed invalid pack/storage/start-route setup; those setup failures are
not represented as product regressions or passing evidence.

On the integrated P00 tree with this correction, complete Classic and Journey host
files pass 15/15 tests, zero failures/skips/cancellations, in 118.19 seconds. This
includes ten consecutive clears, Skip, stable Continue, failed persistence, automatic
reset, cold-load cancellation, same-ID content refusal and cross-pack Next recovery.
Full lint, source/native formatting, content validation (667 files; the same four
navigation warnings), motion syntax and production reproduction/readiness passed.
These local results do not replace exact committed-source hosted qualification.

Earlier PR run `35477966230` and manual run `35477966955` each passed 6,567 tests
across 505 files on Node 20.19.6 for `34e3f742`. Hosted frozen inspection run
`35479748767` also passed for that precursor. All remain precursor evidence: neither
the old frozen artifact nor its inspection qualifies this integration/correction.
The subsequent acceptance-only publisher evidence is composed before final source
qualification; no tag, stable release or Pages selector is changed by these edits.

### Publication integration

The source branch now incorporates main publication commit `e6e269ea` (PR168,
frozen v0.65.0 metadata and Archive33 acceptance). The only content conflict was
the execution-register introduction: both the Journey authority banner and the
complete upstream publication status/history are retained. Upstream publishing
files remain exact; Journey runtime, tests and the allocated 0.67.0 version are
unchanged. Runs `35474420498` and `35474422199` qualify the preceding `bf1f8cd2`
source only, not this combined tree. Fresh exact-source families are required.

Latest local rerun: 33/33 tests passed across Journey catalog/profile, capture
inspection, the five-test Journey host precursor and the full existing Solo
result-continuation file (270.42 s). A separate six-file engine/classic/Team/race/
Couch-shell cohort passed 118/118 tests (52.64 s). Later scoped additions passed:
two cold-cancellation variants (button/Escape), and three Skip/stable-Continue/
failed-storage host cases. Pattern-filtered runs have intentional nonmatching
skips and are not reported as complete source qualification. Full source lint,
source/native formatting, motion syntax and production/readiness declarations
passed locally. Final hosted checks must bind the committed source.

P00 remains in progress. Required: final full hosted qualification, lifecycle and
mode-flow review, immutable release, reviewed Pages publication and actual public
readback. Human prediction/failure explanations, voluntary retry, actual audio,
physical touch/controllers, 200% zoom, performance targets and full offline/rollback
acceptance remain unverified. P01–P15 foundations, Studio expansion, replacement
missions, original art, campaign balance and final human validation are not delivered
by this P00 preview. No automatic test proves the game is enjoyable.
