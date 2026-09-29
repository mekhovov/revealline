# Local experience release intake — 29 September 2026

The committed local integration is preserved in [draft PR #781](https://github.com/mekhovov/revealline/pull/781), stacked on the actual remote head of [mission selector #776](https://github.com/mekhovov/revealline/pull/776). This is the source counterpart to the existing [reconciliation review #780](https://github.com/mekhovov/revealline/pull/780).

The attached `intake.json` binds every one of the **534 changed paths** to its Git blob and size at source `5b0f830b3d8f5481cf85567c297861bc914bacc6`. It also records the observed open PR heads and milestones. Later fixes are separate commits; they do not rewrite that snapshot.

## Completed in this review

- Matched the captured changes to current feature owners and existing PRs.
- Pushed the previously local source, artwork, tests and evidence as a held draft.
- Preserved the shared checkout, staging area, original branches, stashes and historical worktrees.
- Recorded the selector's missing module/stale catalog and the Demo/current-main Confirm incompatibility in #780.
- Fixed the real nested Demo Back keyboard guard in a separate commit. Its regression changed from 52 passing / 6 failing to 58 passing / 0 failing. The runtime-maintainer skill and retained logs accompany that fix.
- Checked additional stale audio/creator work against current source; these are represented or superseded, not new feature PRs.

## Release order and admission conditions

| Priority                      | Input                                                                     | Schedule                                                                | Required before admission                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First                         | v0.142.3 controller repair                                                | Active release continuation                                             | Correct the source recipe ledger, qualify the final source, freeze and publish, then verify Pages. PRs #775/#778 are merged; that does not establish publication.         |
| Next                          | #776 selector, #738 inventory, #747 screening, #780 review                | Explicit v0.142.4 milestone at observation                              | Include the intended menu-retune dependency or remove the premature coupling; regenerate localization; resolve the hosted checks and qualify the exact integrated source. |
| Then                          | Native menus, landing scenes, branding, field editors, authoring adapters | Preserved in #781; scoped landing extraction active; version unassigned | Reconcile current controller/source fixes; reproduce asset, native, localization and offline closures. Check keyboard, controller, touch and small-screen routes.         |
| Dependent                     | Demo, recorded/bot playback, analog reception, audio and takeover         | Preserved in #781; depends on the accepted menu/controller foundation   | Port old Confirm hooks atomically; carry the nested Back correction; run exact-source playback, cancellation, save isolation, audio and browser checks.                   |
| As each becomes ready         | Audio #779; Pause/Skip #771; Team difficulty #756; Team More #757         | Existing drafts; version unassigned                                     | Close each owner's review findings and UI overlap. These may join a compatible cumulative batch only after coordinator admission.                                         |
| After presentation acceptance | Actors #761; discoveries/company missions #758                            | Existing drafts; version unassigned                                     | Finish actual-size/presentation, progression, interaction and original-content checks. Preserve all source and compiled history.                                          |
| Independently reviewed        | Community directory extraction; deployed acceptance #736/#745             | Existing stack plus active directory extraction; version unassigned     | Keep the standalone directory scope separate from branding. Complete deployment/account/moderation acceptance before advertising those capabilities.                      |

The release coordinator owns product version allocation and publication. A row with **version unassigned** is an intake queue item, not a promise of a version or delivery date. The #781 Branch reconciliation milestone is a preservation hold, not a product release. Do not merge the entire snapshot to satisfy this queue.

For each feature extraction, record the resulting PR and commit, included paths or hunks, and accepted/superseded/deferred/rejected disposition. Include `game/content-design/project.mjs` and its test in the owning compiler/authoring extraction. Close #781 only when its committed paths are fully accounted for.

## Remaining limits

Latest observed GitHub release was **v0.142.2**. This review does not claim another deployed version, completed physical-device qualification, a passing complete test suite, or complete line-by-line approval of all 534 paths. Concurrent owners may have newer work after the captured commit. Ignored files and six retained stashes are outside its source delta and remain preserved.
