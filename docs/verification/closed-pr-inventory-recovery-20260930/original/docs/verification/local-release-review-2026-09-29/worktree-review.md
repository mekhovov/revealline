# Local worktree release inventory

Snapshot: 2026-09-29T00:41:50.264956+00:00 to 2026-09-29T00:42:07.452071+00:00. Cached origin/main: afb19ebd06db336d32dfe4660c43aa0f6711dca5. No fetch, edits, commits, cleanup or PR writes were performed.

**260 registered worktrees; 259 exist. 111 appear dirty, but 58 contain only an untracked node_modules link.** There are 52 nonprimary dirty checkouts beyond those links; many are historical integration, evidence or partial checkouts. These are not 111 new feature branches.

The actively edited primary checkout had **203 tracked and 323 untracked paths** (526 total, changing during this session). Its codex/mission-selector-level-cards HEAD 9e0bf4f69081 differs from PR776 head; cached tracking reports ahead 1 / behind 7. Do not stage/reset that shared checkout as a unit.

## Immediate ownership and release decisions

| Checkout / branch                                                   | State                                                                                              | Recommended handling                                                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Current Steam Deck source and publish-v01321/go_test                | Already handled by this task                                                                       | Preserve current source and publisher operations.                                                           |
| actor-loader-regression/go_test / codex/actor-rotor-motion          | 9 tracked + 3 untracked; existing draft PR761; all 9 tracked paths changed on main too             | Update the existing PR through its owner; avoid duplicate PRs.                                              |
| audio-style-menu/go_test / codex/audio-style-menu                   | 4 tracked + 1 untracked; old PR770 closed; new audio persistence PR779 exists under another branch | Reconcile scope with the Playlist/audio owner before making another PR.                                     |
| player-ux-input / codex/player-ux-input                             | 18 tracked + 6 untracked, historical UX0/production63                                              | **No new controller/player-UX PR recommended**; exact review below.                                         |
| go_test_company_campaigns                                           | Detached during active-looking rewrite, 16 staged modifications + 2 conflicts                      | Owner must finish its operation. Conflicts: game/i18n/catalogs.mjs and game/test/controller-boost.test.mjs. |
| team-terminal-retry-v137/go_test / codex/v1418-failure-continuation | 9 staged paths + 2 conflicts on historical base                                                    | Preserve and reconcile with owner. Conflicts: game/couch/couch.mjs and game/i18n/catalogs.mjs.              |
| native-menus-fpv-line/go_test                                       | Clean temporary empty checkout explicitly for sparse PR preparation                                | Landing owner is preparing its own PR; not a standalone feature to publish.                                 |
| release-train-guard/go_test / codex/steamdeck-confirm-gate-fix      | Historical 6 tracked + 1 untracked; 753 commits behind captured main                               | Not the current Steam Deck checkout. Compare against the shipped replacement before extraction.             |

Other dirty historical groups need semantic reconciliation, not blanket PR creation: old P03/P05/P07/P08 UI prototypes, Team artwork/recovery, localization/production evidence and integration checkouts. The JSON contains all exact paths, changes, upstream refs, PR links and file overlaps.

Two large old index states require particular care: earned-picture-resume has **1,837 staged deletions**; cross-mode-source-integration has **629 staged additions and 28 staged modifications**. Both sit thousands of commits behind main. They are preserved, not proposed for publication or cleanup.

## Review of the claimed 24 controller/player UX paths

Exact checkout: <managed-worktrees>/player-ux-input. HEAD 9a205c952651 is already an ancestor of main, 1,535 commits behind this snapshot and 12 commits behind its own upstream.

[Closed PR320](https://github.com/mekhovov/revealline/pull/320) explicitly says it was superseded by qualified [PR374](https://github.com/mekhovov/revealline/pull/374), merged for v0.100.0 at c1b70a3674db230bd1433a6805dde05f3a59cb81. The local files concern old Team production63 picture/history and host-test corrections, not new Steam Deck Confirm code.

- **22/24 paths exactly match already-pushed origin/codex/player-ux-input.**
- **5 exactly match current main:** team-discovery-input.test.mjs, whole-originals-host-scenarios.mjs, whole-originals-tuned-host-routes.json, and both hash-addressed retained-runtime62 files.
- Other snapshot differences are historical/superseded: main now binds FPV 99 rather than local63, admits more retained policies, and removed the old review-extension script. Runtime 62 remains supported by the current compiler.
- The 2 exceptions to upstream byte identity are obsolete intermediates. The local journey-owned-controls.test.mjs lacks the stronger current owned-save/explicit-mode-departure coverage. production63.md has stale byte counts/hashes corrected in its upstream copy. Neither is an improvement to extract unchanged.

Exact file hashes and local-diff hunk contexts: the retained local exact-byte review receipt. Preserve the checkout; do not publish its snapshot wholesale or overwrite current FPV production data.

## Open PRs at snapshot

Existing PRs take precedence over duplicates. Several PR branches are not checked out in these worktrees and may be maintained by active threads or GitHub commits.

| PR                                                      | Branch                             | Base                                          | Draft | Title                                                                     |
| ------------------------------------------------------- | ---------------------------------- | --------------------------------------------- | ----- | ------------------------------------------------------------------------- |
| [#779](https://github.com/mekhovov/revealline/pull/779) | codex/audio-style-persistence      | main                                          | yes   | Fix saved Audio style selection after reload                              |
| [#776](https://github.com/mekhovov/revealline/pull/776) | codex/mission-selector-level-cards | main                                          | no    | [Target v0.142.4 input] Rebuild mission selector with global level cards  |
| [#771](https://github.com/mekhovov/revealline/pull/771) | codex/pause-menu-universal-skip    | main                                          | yes   | Restore universal Solo skip and compact pause UX                          |
| [#761](https://github.com/mekhovov/revealline/pull/761) | codex/actor-rotor-motion           | main                                          | yes   | Improve FPV roster, optional encounter authoring and artwork collections  |
| [#758](https://github.com/mekhovov/revealline/pull/758) | codex/discovery-rewards            | main                                          | yes   | Add learning discoveries, polished showcases and calibrated FPV flight    |
| [#757](https://github.com/mekhovov/revealline/pull/757) | codex/team-more-navigation         | main                                          | yes   | Keep Team utility navigation compact                                      |
| [#756](https://github.com/mekhovov/revealline/pull/756) | codex/team-result-difficulty       | main                                          | yes   | Add direct Team difficulty recovery                                       |
| [#747](https://github.com/mekhovov/revealline/pull/747) | codex/offline-company-screening    | main                                          | no    | Screen company artwork against mission originals                          |
| [#745](https://github.com/mekhovov/revealline/pull/745) | codex/community-browser-moderation | codex/community-account-bootstrap             | no    | Automate deployed browser moderation cutover                              |
| [#738](https://github.com/mekhovov/revealline/pull/738) | codex/offline-company-inventory    | main                                          | no    | [Target v0.142.0 input] Inventory company missions and retained originals |
| [#736](https://github.com/mekhovov/revealline/pull/736) | codex/community-account-bootstrap  | codex/community-production-session-acceptance | no    | Automate deployed account verification acceptance                         |

## Snapshot limitations

Other threads changed primary files, refs and PRs during collection. Re-read exact heads/status before acting. Disk space was intermittently exhausted; no cleanup was performed. Ignored files are excluded.

Ahead/behind uses cached refs. A clean old branch without an open PR can be squashed, superseded, deliberately closed or retained as evidence. Closed/merged PR matching is by branch name and must account for branch reuse. No thread ownership is inferred from a branch name. File-overlap lists identify potential conflicts, not a merge simulation.

Machine-readable inventory: worktree-inventory.json.
