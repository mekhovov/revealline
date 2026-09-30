# Source reconciliation and remaining delivery — 30 September 2026

Current rebase baseline: main `451b82dc13dc8a8545ff964ffb724d3d756ac62a`.
The earlier inventory observed `3dbf92d39f0e254d8925cd44e806866a0cf71cd6`;
the resumed rebase includes PR816's Ready/startup correction.
This supersedes stale queue labels in the [29 September register](plan-status-2026-09-29.md)
and [character plan](character-game-feel-plan.md). It does not rewrite prior test,
artwork, release or ownership evidence.

## Completed source integration

- Root aggregate `0cc7337a8e490d73ad9d7718fb5b208aaf7da924` and actor checkpoint
  `478a2b23dc7998afa35464c10b59eb0d10ce54e5` are ancestors of observed main.
  Both owned checkouts were rebased to current main without conflicts; neither had
  a unique pre-existing commit to preserve or replay. Root stayed clean. This
  branch separately carries the reconciliation documentation and a bounded
  recovery of Team's downed-player guidance after Resume.
- [PR761](https://github.com/mekhovov/revealline/pull/761) merged as
  `d896b5a6da81c4ac0445e1afc2a4cfde76803436`. The 24 actor batches, including the
  fractional HUD correction and saved-freeze/Sentry host evidence, are integrated
  source. Their focused historical evidence is not a fresh all-main suite pass.
- PR776 (selector), PR782 (native menus), PR786 (preservation), PR808, PR781
  (Demo) and PR814 (optional offline dependencies) are also incorporated.
  Closed donor/aggregate PRs must not be reopened merely because their old
  worktrees or documentation still show a diff.

## Publication is a separate status

At the audit, the latest GitHub immutable release remains **v0.142.3**, source
`b5ab06e12542f72e33c45b973ba693a5e1509c1c`. This is distinct from the continuous
Pages build and from the planned v0.150.0 batch. This reconciliation performs no
public play or deployed-byte audit and therefore claims no new public acceptance.
The canonical publisher owns those checks, merges and immutable releases.

PR816 has merged as the current rebase baseline. The following open inputs target
[v0.150.0 — Unified native experience](https://github.com/mekhovov/revealline/milestone/57):

| Pending source                                                                              | Observed head                              | Remaining work                                                                         |
| ------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| [PR815 — Creator Guide controls](https://github.com/mekhovov/revealline/pull/815)           | `e783a87e5878ab76640303fce8f7cf4bf30f99d8` | Draft; finish its own checks and document-viewer follow-up under its owner.            |
| [PR817 — Spatial audio reconciliation](https://github.com/mekhovov/revealline/pull/817)     | `aa02d79065a706b3cfde4da2d8cca1186dc297cd` | Draft; reconcile exact source and required checks under its owner.                     |
| [PR818 — Optional offline extras](https://github.com/mekhovov/revealline/pull/818)          | `96e8adbe833306c7f9b48753c7d519110bf54228` | Draft; qualify dependency/capacity behavior without deleting optional online content.  |
| [PR819 — Current Settings controls](https://github.com/mekhovov/revealline/pull/819)        | `ec0347db76f8b6f9d124083581f8c4534852fe39` | Required publisher admission checks remain separate from historical fixture failures.  |
| [PR820 — Cooling loop and pressure routes](https://github.com/mekhovov/revealline/pull/820) | `9213f19f03f1c2e4b23667459db18843d13dd264` | Levels owner pushed the formerly local restoration; current defaults remain unchanged. |
| [PR821 — Demo frame continuity](https://github.com/mekhovov/revealline/pull/821)            | `22661a43b81ba4f73218308ddd369b700ab1fe62` | Draft; owner qualification and publisher admission remain open.                        |

These heads are timestamped observations, not permission to merge newer source
without review. Do not add unrelated changes to a qualifying publisher head.
The audited Actions variable `REVEALLINE_ACTIVE_RELEASE` still named the closed
v0.142.4 milestone; the publisher must reconcile it with its actual current lane.
Do not allocate a second competing version to repair a scheduling label.

## Local work and preservation

The [durable inventory](verification/local-worktree-intake-2026-09-30/README.md)
covers 268 registered worktrees. At its 05:02 UTC completion, 266 existed, 153 were
clean, 113 had changes, and one retained an interrupted operation. The earlier
04:47 snapshot recorded 109 dirty roots and two operations. These counts include
active owner work and this task's plan edits; they are **not missing-feature
counts**. A cache directory can contain unique source or art and is not disposable
merely because of its name.

The earlier operations were the active Pause-menu owner's rebase and a historical
Team/Versus continuation cherry-pick. The Pause owner completed its rebase; the old
cherry-pick remains. These are not conflicts in the two checkouts rebased by this
task. Other owners retain their operations and files.
No reset, cleanup, bulk commit or foreign index mutation was performed.

Remote preservation and main integration must remain separate:

- PR795 head `fa22ab0c` and PR796 head `c99fbbac` are preserved on their remote
  aggregate branches, but are not ancestors of observed main. Substantial parts
  have newer protected successors; the residual semantic comparison remains open.
- PR784's friendly-route head `ff56e0881e7355ebe3e07e0804827dc9b256fb50` entered a
  closed aggregate. Exact ancestry alone does not prove whether every intended
  route has a newer equivalent. The Levels owner is reconciling that path.
- [Issue813](https://github.com/mekhovov/revealline/issues/813) owns the six exact
  retained PR781 overlaps and deferred verification. Preserve those sources until
  each has an integrated, superseded or explicitly deferred disposition.
  This task assigned it to the existing v0.150.0 milestone; this does not restore
  waived suites or allocate a second release.

A clean current checkout does not prove every historical local modification is
already pushed. Outstanding owner/disposition rows must remain visible until the
corresponding bytes and intended behavior are accounted for; do not manufacture
an “all local work released” conclusion from branch ancestry or a preservation PR.

## Bounded recovery from this audit

Team Resume previously replaced a downed player's rescue explanation with the
generic instruction to choose a direction. The current-main recovery shares the
existing localized knockdown message, retaining the cause, player identity and
play-style alternative. Normal Resume, input release, focus, simulation and Retry
semantics stay unchanged. Four regression cases cover both seats, ordinary Resume
and retirement of an old warning after Retry. Independent source review and syntax
checks pass; these cases are **not executed**, under the committed test waiver.

The [intake receipt](verification/local-worktree-intake-2026-09-30/README.md) also
separates reviewed historical proposals from current-runtime changes. Exact remote
preservation was verified for 50 reference/Team-layout files in PR802 and 121 of
149 Team-integration files on retained remote branches. Current source already
supersedes the fractional-score, Still Media reload, pending-picture Back and
story-focus prototypes. Do not replay their obsolete production outputs or CSS.

The remaining bounded historical proposals are preserved for a separate decision:
Enemy Catalog action wrapping, Still Media close/focus assertions and old fpv38/50
Team retention adapters. Those proposals require adaptation or a proof of current
need before runtime adoption; source preservation does not grant that approval.
[Issue824](https://github.com/mekhovov/revealline/issues/824), targeted to the same
v0.150.0 milestone, records those decisions and required closing evidence.
Active Pause, Creator Guide, Playlist and company-packaging changes remain with
their owners. Historical aggregate release-only commits must not overwrite the
publisher's current version or reintroduce withdrawn private media.

## Remaining implementation, in priority order

| Priority               | Work                                                                          | Completion boundary                                                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1                      | Finish current startup/Guide corrections and reconcile local source residues. | Required protected checks and exact source pass; unique work is pushed to an owned PR or explicitly preserved with a follow-up target. Publisher verifies Pages bytes and ordinary play.                           |
| 2 — A / C3             | Current characters, full roster/state readability and reliable native play.   | Finish remaining state combinations and return/input/layout defects against current hosts; preserve immediate/buffered steering and original appearances. Existing animation-clock evidence alone is insufficient. |
| 3 — B / C4             | Optional encounter combinations, counterplay and mode-specific recovery.      | Versioned opt-in behavior, exact original records/replays, readable warnings and recovery across supported difficulties. Broader fair-play/human assessment remains separate.                                      |
| 4 — C / C5             | First Ukrainian/FPV artwork cohort.                                           | Source preparation continues; cultural, native-pixel and contrast review plus explicit approved binding adoption are deferred at the user's request, not passed. No silent replacement of earned originals.        |
| With each feature — C6 | Necessary Studio/Motion Lab/provenance support.                               | Exact moving-part edits, versioned recipe/export compatibility and retained source/revision history. Broad tool expansion and additional edition production follow the first cohort.                               |
| Then — C7 / UX6        | Whole-content and complete player-journey qualification.                      | Regenerate current entry/role coverage; finish frame-time, memory, offline, accessibility and real-device checks. Source inventories and modeled input do not certify physical devices.                            |
| Last — C2              | Formal playable comparison and player sessions.                               | Two short rounds with the planned newcomers/experienced participants, consent and recorded findings. Existing comparison tools remain available; no fabricated participant or retention evidence.                  |

Production review remains deferred. Development may proceed in parallel in owned
branches; combine compatible source in bounded batches, with one publisher.
Do not wait for publication to prepare independent features, and do not hold a
verified release subset for unrelated unfinished production.

## Checks and concerns

The [30 September waiver](focused-test-waiver-20260930.md) is authoritative for
automated test-only commands. Deferred suites are **WAIVED_SKIPPED_NOT_PASSED**.
Issue813 retains the repair/verification work; this register does not restore the
policy globally or claim waived suites are green. Required source identity,
validation/localization, generated media, build/capacity, admission and
`release-ready` checks remain in force.

Local capacity briefly reached ENOSPC during the audit. Metadata capture resumed
after space recovered; this lane ran no builds or artifact downloads and deleted
no other owner's files. Reserve sufficient capacity before further release work.
Neither a queue milestone nor merged source provides a reliable public-release
ETA while required startup/build checks are unresolved.
