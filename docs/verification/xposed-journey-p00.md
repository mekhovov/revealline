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

## Outstanding acceptance

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
