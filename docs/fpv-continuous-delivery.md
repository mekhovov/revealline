# FPV continuous feature delivery

Updated 2026-10-01. The owner requests a verified PR after each completed feature,
with the next independent item developed while source gates and deployment run.
Additional unit coverage belongs in the final phase. Build, browser, replay,
import/export and publication verification remain part of every applicable item.

## Delivery queue

| Item                                       | Branch / PR                                                                                     | Current state                                                                                                           | Acceptance                                                                                                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| World Studio development playtest          | `codex/fpv-world-framework`, [PR #885](https://github.com/mekhovov/revealline/pull/885)         | Original feature `bce31f877d` passed its gate; updated head `882c96622a9c` incorporates newer main and is being checked | Recorded local browser/build/offline evidence in `fpv-worlds-playtest-verification.json`; verify protected merge, deployed identity and live launch                        |
| Academy demonstrations and beginner entry  | `codex/fpv-academy-demonstrations`, [PR #887](https://github.com/mekhovov/revealline/pull/887)  | Completed and verified at `e24100c23e`; PR initially targets #885's branch                                              | 24 existing demonstrations, half-speed and replay controls; browser/offline evidence in `fpv-academy-demonstrations-verification.json`; retarget to main after #885 merges |
| Woodland demonstrations                    | `codex/fpv-woodland-demonstrations`, [PR #888](https://github.com/mekhovov/revealline/pull/888) | Completed and verified at `352a5a4d35`; PR targets #887’s branch                                                        | Eight challenges × two modes; replay actual recordings and review route-facing presentation before publication                                                             |
| Courtyard demonstrations                   | `codex/fpv-courtyard-demonstrations`                                                            | Queued after woodland                                                                                                   | Eight challenges × Self-level/Acro, exact replay completion and readable route-facing playback                                                                             |
| Remaining new-world demonstrations         | Warehouse, stadium, container yard, garage; separate coherent PRs                               | Queued                                                                                                                  | Author and replay successful recordings with exact dependencies; only offer actually verified demonstrations                                                               |
| World/drone presentation and player tuning | Subsequent bounded feature PRs                                                                  | Queued                                                                                                                  | Improve remaining art/animation/readability and mode-specific thresholds using actual player observations; keep flight handling unchanged                                  |
| Final qualification                        | Final phase                                                                                     | Deferred                                                                                                                | Additional unit coverage, full compatibility/failure matrix, named physical-device performance and human content acceptance                                                |

The approved scope and production limits remain in
[`fpv-worlds-implementation.md`](fpv-worlds-implementation.md). The current 60
challenge definitions do not represent 60 fully polished, human-qualified levels.

## Publication procedure

1. Finish one coherent feature, verify its functional acceptance and record the
   actual evidence. Commit only that feature's changes. Preserve unrelated edits.
2. Create a normal feature PR against `main`, using the repository's existing
   scheduled planning milestone **v0.150.0 — Unified native experience** (#57).
   Do not fabricate a release title, bump versions or reallocate the release train.
3. Attach the PR to this chat. Develop the next feature on a separate branch;
   do not add unfinished next-item changes to a ready PR. When a completed feature
   depends on an unmerged item, target its predecessor branch to keep review
   focused, state `Depends on #…`, then retarget to `main` after the predecessor
   merges. Require the normal main source gate before merging the dependent PR.
4. Inspect the latest exact head and required `release-ready`. Update a behind
   branch and resolve conflicts without losing other work. Respect holds,
   review requests and branch protection; never use an administrator bypass.
5. Once the exact head is admitted, use the normal protected merge-commit path
   with `--match-head-commit`. The owner's continuous-delivery request authorizes
   this feature publication; do not re-request permission for routine items.
6. Follow **Deploy protected main to GitHub Pages**. Confirm that the public
   `main-deployment.json` identifies the merge or a verified descendant and that
   the actual FPV application launches before reporting it live.

Live application: <https://mekhovov.github.io/revealline/optional-practice/fpv-worlds/index.html>.
Local `dist/fpv-worlds-playtest/` paths are not the public deployment path.

At this checkpoint the older fastline controller listens for an obsolete source
workflow name and a stale active-release milestone. Do not change global release
authority to make this feature fit it. Use the existing protected merge path
after its current source gate, and retain any controller reconciliation as a
separate reviewed change. A PR being open or merged is not evidence of live
deployment.

A thread heartbeat, **Continue FPV feature delivery**, checks this queue every
30 minutes. It should preserve active agent work, avoid duplicate PRs and keep
unchanged status quiet. Record meaningful progress here and notify the owner of
completed items, verified live availability, meaningful failures or needed input.

## Latest delivery checkpoint

PR #885 is open at `882c96622a9c52cb93bf94f642aba1ae4fb926c4`;
[required source run 36783706645](https://github.com/mekhovov/revealline/actions/runs/36783706645)
is pending. It has no review/label holds and is mergeable once its current gate
passes. Main was `c30135d80abe79c9fef88b67c8629c0725db58cc` at this checkpoint.
Two safe expected-head updates incorporated intervening main commits. Leave the
current CI running; do not repeatedly restart it for unchanged status. Re-read
the actual remote state before any merge.

Delivery order is **#885 → #887 → #888**. Retarget each dependent PR to main only
after its predecessor merges, then obtain its own required source gate. No FPV
live deployment has been verified yet. Continue courtyard work independently on
its next branch while these publication steps proceed.
