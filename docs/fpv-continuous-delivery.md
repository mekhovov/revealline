# FPV continuous feature delivery

Updated 2026-09-30. The owner requests a verified PR after each completed feature,
with the next independent item developed while source gates and deployment run.
Additional unit coverage belongs in the final phase. Build, browser, replay,
import/export and publication verification remain part of every applicable item.

## Delivery queue

| Item                                       | Branch / PR                                                                             | Current state                                                                  | Acceptance                                                                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| World Studio development playtest          | `codex/fpv-world-framework`, [PR #885](https://github.com/mekhovov/revealline/pull/885) | Source `bce31f877d9e7db01ce325c68b94929b462832b1` pushed; source gates pending | Recorded local browser/build/offline evidence in `fpv-worlds-playtest-verification.json`; verify protected merge, deployed identity and live launch       |
| Academy demonstrations and beginner entry  | `codex/fpv-academy-demonstrations`                                                      | In development, based on the playtest commit                                   | Expose the 24 existing mode-specific demonstrations; distinct replay controls, half-speed, safe restart and return to practice; no record/reward mutation |
| New-world demonstrations                   | Separate subsequent PRs, one coherent world at a time                                   | Queued                                                                         | Author and replay successful Self-level and Acro recordings with exact dependencies; only offer actually verified demonstrations                          |
| World/drone presentation and player tuning | Subsequent bounded feature PRs                                                          | Queued                                                                         | Improve remaining art/animation/readability and mode-specific thresholds using actual player observations; keep flight handling unchanged                 |
| Final qualification                        | Final phase                                                                             | Deferred                                                                       | Additional unit coverage, full compatibility/failure matrix, named physical-device performance and human content acceptance                               |

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
   do not add unfinished next-item changes to a ready PR.
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
