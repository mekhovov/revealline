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

The FPV PRs are now linked as **native GitHub stack #889**, rooted on `main`.
The existing layers are #885 → #887 → #888. New completed items append above the
current top; keep each feature's reviewed diff separate. The owner explicitly
requested stacked PRs on 1 October 2026.

1. Finish a coherent feature and record actual build/browser/content evidence.
   Additional unit coverage remains in the final phase. Commit only that item.
2. Create its PR against the predecessor branch, assign the existing scheduled
   planning milestone **v0.150.0 — Unified native experience** (#57), and attach
   it to this chat. Add it to native stack #889 through the GitHub stack API.
3. Start the next feature on a separate branch while all published layers run
   their required checks. Do not add unfinished work to a ready PR.
4. Keep the native stack linear with a cascading rebase when necessary. Freeze
   active local edits first, capture every current remote head, retain recovery
   refs, and push only with explicit per-branch leases. Never overwrite newer
   owner work or mix unrelated commits into the stack.
5. Native members inherit the trunk's branch protections. Inspect the exact
   current heads and required gates for every layer being merged. Respect holds
   and reviews. Use the protected asynchronous stack merge API for an admitted
   contiguous group; never use an administrator bypass or disable checks.
6. Follow **Deploy protected main to GitHub Pages**. Confirm the public deployment
   metadata identifies the merge or a verified descendant, and launch the actual
   FPV application before calling an item live. Open and merged PRs are distinct
   from verified player availability.

Do not manually retarget native stack members while they remain stacked. GitHub
manages the stack relationship. If the native stack cannot satisfy repository
requirements, preserve the blocked state and continue independent development;
do not silently dissolve it or weaken publication guards.

The older fastline controller still has a stale active milestone/workflow-name
assumption. Keep global release authority unchanged. Owner-authorized protected
stack publication uses the current GitHub requirements directly.

Live application: <https://mekhovov.github.io/revealline/optional-practice/fpv-worlds/index.html>.
Local `dist/fpv-worlds-playtest/` paths are not the public deployment path.

References: [GitHub stack requirements](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests)
and [stack API](https://docs.github.com/en/rest/pulls/stacks).

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

The former predecessor-only chain is now native stack **#889**. The earlier
head/run checkpoint above is historical; always read current stack heads before
acting. No FPV live deployment has been verified yet. Development continues
independently while the native layers qualify.
