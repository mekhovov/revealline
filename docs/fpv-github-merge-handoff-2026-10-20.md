# FPV GitHub publication and Releases merge handoff

Inventory captured: 2026-10-20T21:19:53.774754+00:00. This is a repository publication audit, not a new gameplay qualification.

## Published task work

- Follow-up: [#1799 — Deliver FPV combat, six-switch radio and compact HUD on current history](https://github.com/mekhovov/revealline/pull/1799). Draft pending integration and qualification.
- Current-history branch: `codex/fpv-combat-radio-hud-delivery-20261020`. Implementation `0984daad18`; art/evidence `d89edf9ea68357161b507e1fb7d0dea25d130fd0`. The handoff documentation is a separate subsequent commit.
- Fork: `f49d6185b0ad98c43a375bc58581682f154ecf08`; reviewed main: `ca016a6eb082b69596ee34e5bbc6f12ecae60152`. This fork is the authenticated rewritten equivalent of original base `69107fcbff1e46cce122b2ec19d2cbe69435b61d`.
- All **575 original task files** are included. **572 are byte-identical** to the pre-publication manifest. The remaining three preserve the approved history rewrite: removed content resources in `game/build-config.json`, filtered celebration source in `flight-fullscreen.mjs`, and the forbidden-name assertion in `scripts/test-optional-fpv-package.mjs`.
- Original old-history commits `997fc6f786` and `57c848bd0d0eb86133a2499a45cb0336e857bfd7` remain on local `codex/fpv-combat-radio-hud-preserved-20261020`. They were deliberately not pushed into the rewritten GitHub history. All task file contents are represented by the mapped commits; the only differences are the three documented migration edits.
- All 455 missing sparse-excluded task files were restored from the new committed tree, including original art sources and evidence. No user source, player save or Git commit was deleted.
- Earlier task PRs [#1749](https://github.com/mekhovov/revealline/pull/1749) and [#1752](https://github.com/mekhovov/revealline/pull/1752) are already merged; they are excluded from the open queue.

## Merge priority and ownership

The human requested coordination with **🔥 Releases**. That owner retains main-branch merge responsibility and has received #1799 and the preservation audit. Prioritize review/integration of #1799 as the new FPV feature delivery. Do not merge its previous-history ancestors or apply preservation snapshots wholesale. The groups below are a review/merge proposal; only actual PR base relationships establish strict dependencies.

1. Audit preservation snapshots and compare them to current source; merge only still-needed deltas. Preservation is already achieved by their branches and this publication.
2. Keep the established **#1456 → #1493 → #1520** stack order. Releases reported #1540 → #1550 as an already-merged historical dependency, not an open item.
3. Compare #1799 against the overlapping core SIM fixes #1679/#1685/#1698/#1717/#1722/#1728 and preserve both sets of behavior. Their numerical order is not proof of dependency.
4. Reconcile #1799 and the settings/accessibility/support stacks according to their explicit base branches.
5. Complete adjacent shared playback/appearance/audio/package reconciliation and final-source qualification before release.

### Confirmed open stacks

- #1456 → #1493 → #1520.
- #1642 → #1645 → #1647 → #1649.
- #1702 → #1709.
- #1721 → #1726 → #1730 → #1731 → #1733 → #1736.
- #1672 → #1689; #1672 itself names `codex/f09a-text-size-compatibility` as its base. The #1721 root similarly names `codex/f58a-local-support-summary`; Releases must resolve those base states rather than assuming main.

## All related existing unmerged PRs

**33 existing open PRs:** 28 directly overlap an original task path; five are stack connections. #1799 brings the related open total to **34**. At capture, the 33 existing PRs comprise 22 `DIRTY`, six `UNSTABLE` with failed checks, and five `CLEAN`; 25 are drafts. A missing check rollup is not a passed check. Current GitHub state may change after capture.

#1799 initial state: `DIRTY`, draft `True`; check details are preserved in the JSON receipt.

### 1. Preserve and compare source snapshots

| PR | Title | Base | Draft / merge state | Task-path overlap |
| --- | --- | --- | --- | --- |
| [#1547](https://github.com/mekhovov/revealline/pull/1547) | Preserve primary FPV tuning working source snapshot | `main` | Draft; DIRTY | 25 |
| [#1551](https://github.com/mekhovov/revealline/pull/1551) | Preserve FPV app source snapshots and recovery ledger | `main` | Draft; DIRTY | 2 |
| [#1556](https://github.com/mekhovov/revealline/pull/1556) | Preserve captured app source from the complete index audit | `main` | Draft; DIRTY | 25 |

### 2. Respect the recorded integration dependency chain

| PR | Title | Base | Draft / merge state | Task-path overlap |
| --- | --- | --- | --- | --- |
| [#1456](https://github.com/mekhovov/revealline/pull/1456) | Fix industrial host integration and empty statistics writes | `main` | Draft; DIRTY | 2 |
| [#1493](https://github.com/mekhovov/revealline/pull/1493) | Play published destruction recordings in native FPV modes | `codex/industrial-integration-followup-20261015` | DIRTY | 6 |
| [#1520](https://github.com/mekhovov/revealline/pull/1520) | Qualify current mission-library briefings and multiplayer handoffs | `codex/native-fpv-recorded-destruction-20261015` | Draft; UNSTABLE; checks FAIL | 0 |

### 3. Reconcile core SIM flight, workbench and recovery changes

| PR | Title | Base | Draft / merge state | Task-path overlap |
| --- | --- | --- | --- | --- |
| [#1679](https://github.com/mekhovov/revealline/pull/1679) | Fix centered FPV landings and complete unscored practice comparisons | `main` | DIRTY | 19 |
| [#1685](https://github.com/mekhovov/revealline/pull/1685) | Fix narrow SIM setup and add bounded propulsion surfaces | `main` | DIRTY | 20 |
| [#1698](https://github.com/mekhovov/revealline/pull/1698) | Fix SIM workbench state and verify practice reference ownership | `main` | DIRTY | 20 |
| [#1717](https://github.com/mekhovov/revealline/pull/1717) | Fix SIM PID precision and draft recovery | `main` | DIRTY | 20 |
| [#1722](https://github.com/mekhovov/revealline/pull/1722) | Add verified local SIM practice references | `main` | DIRTY | 22 |
| [#1728](https://github.com/mekhovov/revealline/pull/1728) | Qualify SIM Regional recovery and offline updates | `main` | DIRTY | 22 |

### 4. Reconcile settings, accessibility and support stacks

| PR | Title | Base | Draft / merge state | Task-path overlap |
| --- | --- | --- | --- | --- |
| [#1642](https://github.com/mekhovov/revealline/pull/1642) | Add comfort presets to Snake and Survival settings | `main` | Draft; DIRTY | 0 |
| [#1645](https://github.com/mekhovov/revealline/pull/1645) | Add comfort presets to Academy and World settings | `codex/f06-arcade-comfort-presets` | Draft; UNSTABLE; checks FAIL | 8 |
| [#1647](https://github.com/mekhovov/revealline/pull/1647) | Add comfort presets to installed Custom player | `codex/f06-sim-comfort-presets` | Draft; UNSTABLE; checks FAIL | 0 |
| [#1649](https://github.com/mekhovov/revealline/pull/1649) | Keep preset guidance accurate across settings panels | `codex/f06-creator-comfort-presets` | Draft; CLEAN | 1 |
| [#1672](https://github.com/mekhovov/revealline/pull/1672) | Add primary Extra large text and responsive reading layouts (F09a) | `codex/f09a-text-size-compatibility` | Draft; DIRTY | 5 |
| [#1689](https://github.com/mekhovov/revealline/pull/1689) | Extend Extra large reading to Classic Snake modes | `codex/f09a-solo-text-scaling` | Draft; UNSTABLE; checks FAIL | 3 |
| [#1702](https://github.com/mekhovov/revealline/pull/1702) | Explain verified Worlds medal shortfalls | `main` | Draft; DIRTY | 3 |
| [#1709](https://github.com/mekhovov/revealline/pull/1709) | fix: update retained Worlds results when language changes | `codex/f23-worlds-medal-goal` | Draft; UNSTABLE; checks FAIL | 2 |
| [#1721](https://github.com/mekhovov/revealline/pull/1721) | Add a private local support summary to native Team settings | `codex/f58a-local-support-summary` | Draft; DIRTY | 0 |
| [#1726](https://github.com/mekhovov/revealline/pull/1726) | Add private local support diagnostics to Versus settings | `codex/f58-team-local-support` | Draft; CLEAN | 1 |
| [#1730](https://github.com/mekhovov/revealline/pull/1730) | feat: add FPV Academy local support summary | `codex/f58-versus-local-support` | Draft; CLEAN | 4 |
| [#1731](https://github.com/mekhovov/revealline/pull/1731) | fix: distinguish observed controller presence from menu readiness | `codex/f58-academy-local-support` | Draft; UNSTABLE; checks FAIL | 0 |
| [#1733](https://github.com/mekhovov/revealline/pull/1733) | feat: add Worlds local support summary | `codex/f58-controller-observation-copy` | Draft; CLEAN | 3 |
| [#1736](https://github.com/mekhovov/revealline/pull/1736) | fix: refresh Worlds storage feedback on language changes | `codex/f58-worlds-local-support` | Draft; CLEAN | 2 |

### 5. Reconcile shared playback, appearance, audio and packaging changes

| PR | Title | Base | Draft / merge state | Task-path overlap |
| --- | --- | --- | --- | --- |
| [#1356](https://github.com/mekhovov/revealline/pull/1356) | Harden complete demo playback, source preparation and qualification lifecycle | `main` | Draft; DIRTY | 1 |
| [#1466](https://github.com/mekhovov/revealline/pull/1466) | fix(i18n): improve Ukrainian gameplay copy and localization checks | `main` | Draft; DIRTY | 2 |
| [#1492](https://github.com/mekhovov/revealline/pull/1492) | Refine theme materials and unify results and settings appearance | `main` | Draft; DIRTY | 5 |
| [#1496](https://github.com/mekhovov/revealline/pull/1496) | Fix Team/Duel continuation, Studio audio and lossless release archives | `main` | Draft; DIRTY | 2 |
| [#1615](https://github.com/mekhovov/revealline/pull/1615) | Add shared demos and practice across Solo, Snake, SIM and Survival | `main` | Draft; DIRTY | 1 |
| [#1632](https://github.com/mekhovov/revealline/pull/1632) | Fix Solo audio save warning recovery (F15b slice) | `main` | DIRTY | 2 |
| [#1674](https://github.com/mekhovov/revealline/pull/1674) | Defer Worlds loading and avoid repeated Missions setup | `main` | Draft; DIRTY | 1 |

## Blockers and next actions

- **Integration conflicts:** 22 related existing PRs are marked DIRTY. #1799 also needs its live mergeability checked after the final documentation push. Reconcile accepted behavior on both sides, with generators and package policy preserved.
- **Failed checks:** #1520, #1645, #1647, #1689, #1709 and #1731 have FAILURE rollups at capture. This publication has not diagnosed or repaired those unrelated check runs.
- **Release qualification is still incomplete:** refresh final-source regressions; complete lesson replacement/ownership and both-backend acceptance; full-application performance and long-session checks; complete source/runtime package closure; physical six-switch radio, actual small-device and five-player sessions. Historical evidence retains its original limits.
- **History-migration evidence drift:** the three mapped file differences mean earlier hash-bound package/regression receipts are historical, not automatically valid for the published candidate. No new gameplay suite or build was run for this publication.
- **Disk/source availability:** free space remains below 1 GiB, and unrelated full-validation inputs are omitted by sparse checkout. No project-source cleanup was used to make publication possible.
- **Merge ETA:** Releases must resolve conflict/check/dependency disposition first; no reliable calendar merge date is claimed. Existing 10–20 engineering-day qualification estimate remains separate from GitHub publication and depends on hardware/people.

## Receipts

- [Original file hashes and transferred path/status audit](evidence/fpv-combat/github-publication-file-audit.json).
- [Pinned PR heads, full overlap paths, bases and broader open-queue snapshot](evidence/fpv-combat/github-related-pr-inventory.json).
- [Current delivery plan and qualification limits](fpv-sim-current-plan.md).
