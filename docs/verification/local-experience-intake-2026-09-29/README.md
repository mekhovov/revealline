# Local experience release intake — 29 September 2026

## Qualification continuation

This historical intake is retained with its original `intake.json`. The Demo follow-up is being restacked on aggregate `0cc7337a8e490d73ad9d7718fb5b208aaf7da924`, carrying only the scoped Back correction, current qualification work and the lossless DroneAid offline-budget repair. Accepted aggregate controller and quick-music behavior is retained; older competing runtime deltas from the prior review tip are not reintroduced. Prior tip `d8d51e8630a30c8bb2b2391b80a95dbd6beab75b` is preserved in local branch `codex/demo-review-pr781-before-qualification` and in this PR's history.

The [current qualification report](../demo-qualification-2026-09-29/README.md) supersedes the readiness claims below. At this continuation, v0.142.3 is published, #779 is assigned to v0.143.0, and #781/#783/#784 remain held v0.150.0 inputs. Community #784 at `ff56e0881e7355ebe3e07e0804827dc9b256fb50` has green candidate, hosted-acceptance and replacement release-ready checks (run `36509594047`); intentionally skipped jobs are not passing qualification. These facts do not admit the preservation aggregate wholesale or authorize publication.

## Historical intake

The committed local integration was first preserved in [draft PR #781](https://github.com/mekhovov/revealline/pull/781). Its owner then published the canonical aggregate [PR #783](https://github.com/mekhovov/revealline/pull/783), assigned to **v0.150.0 — Unified native experience**. PR #781 is now a small dependent Demo Back fix and review record stacked on #783, avoiding two competing aggregate candidates. The existing [reconciliation review #780](https://github.com/mekhovov/revealline/pull/780) shares that milestone.

The attached `intake.json` binds every one of the **534 changed paths** to its Git blob and size at source `5b0f830b3d8f5481cf85567c297861bc914bacc6`. It also records the observed open PR heads and milestones. Later fixes are separate commits; they do not rewrite that snapshot.

## Completed in this review

- Matched the captured changes to current feature owners and existing PRs.
- Pushed the previously local source, artwork, tests and evidence as a held draft.
- Preserved the shared checkout, staging area, original branches, stashes and historical worktrees.
- Recorded the selector's missing module/stale catalog and the Demo/current-main Confirm incompatibility in #780.
- Fixed the real nested Demo Back keyboard guard in a separate commit. Its regression changed from 52 passing / 6 failing to 58 passing / 0 failing. The runtime-maintainer skill and retained logs accompany that fix.
- Checked additional stale audio/creator work against current source; these are represented or superseded, not new feature PRs.

## Release order and admission conditions

| Priority                      | Input                                                                     | Schedule                                                                             | Required before admission                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First                         | v0.142.3 controller repair                                                | Active release continuation                                                          | Correct the source recipe ledger, qualify the final source, freeze and publish, then verify Pages. PRs #775/#778 are merged; that does not establish publication.         |
| Next                          | #776 selector, #738 inventory, #747 screening                             | Explicit v0.142.4 milestone at observation                                           | Include the intended menu-retune dependency or remove the premature coupling; regenerate localization; resolve the hosted checks and qualify the exact integrated source. |
| Then                          | Native menus, landing scenes, branding, field editors, authoring adapters | Aggregate #783, scoped landing #782; v0.150.0 after the existing reserved train      | Reconcile current controller/source fixes; reproduce asset, native, localization and offline closures. Check keyboard, controller, touch and small-screen routes.         |
| Dependent                     | Demo, recorded/bot playback, analog reception, audio and takeover         | Aggregate #783 with fix #781 and review #780; v0.150.0 after its accepted foundation | Port old Confirm hooks atomically; carry the nested Back correction; run exact-source playback, cancellation, save isolation, audio and browser checks.                   |
| As each becomes ready         | Audio #779; Pause/Skip #771; Team difficulty #756; Team More #757         | Existing drafts; version unassigned                                                  | Close each owner's review findings and UI overlap. These may join a compatible cumulative batch only after coordinator admission.                                         |
| After presentation acceptance | Actors #761; discoveries/company missions #758                            | Existing drafts; version unassigned                                                  | Finish actual-size/presentation, progression, interaction and original-content checks. Preserve all source and compiled history.                                          |
| Independently reviewed        | Community directory #784; deployed acceptance #736/#745                   | Existing stack plus scoped directory PR; version unassigned                          | Keep the standalone directory scope separate from branding. Complete deployment/account/moderation acceptance before advertising those capabilities.                      |

The release coordinator owns product version allocation and publication. A row with **version unassigned** is an intake queue item, not a promise of a version or delivery date. PR #783's milestone is scheduling metadata, not permission to merge the entire snapshot or bypass the existing v0.143.0–v0.149.0 reservations. The adjacent JSON preserves the earlier observation before #782–#784 existed; this section records the later reconciliation.

For each feature extraction, record the resulting PR and commit, included paths or hunks, and accepted/superseded/deferred/rejected disposition. Include `game/content-design/project.mjs` and its test in the owning compiler/authoring extraction. Record aggregate path dispositions in #780/#783. PR #781 now carries only the focused fix and review additions relative to the aggregate; preservation accounting belongs to #783.

## Remaining limits

At the initial intake, the latest observed GitHub release was **v0.142.2**; see the continuation above for the later publication state. This historical review does not claim completed physical-device qualification, a passing complete test suite, or complete line-by-line approval of all 534 paths. Concurrent owners may have newer work after the captured commit. Ignored files and six retained stashes are outside its source delta and remain preserved.
