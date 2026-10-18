# Improvement delivery progress

Updated **18 October 2026** (Europe/Berlin). Continuous implementation of the [approved staged plan](plan.md) is underway. This board covers this workstream; release integration and publication remain separate gates.

**83 feature groups · 113 deliverables · 7 feature PRs ready for checks · 2 draft feature PRs · 3 implementation lanes active · 1 merged · 0 verified live.**

## Merged

**F83a — Deck regression fixtures · [#1613](https://github.com/mekhovov/revealline/pull/1613)** merged at `461ace72e7` after independent review and required exact-head checks. The change corrects the test clock and preserves interaction assertions. Physical Deck acceptance remains F83b; live deployment is not claimed.

## Ready for checks and merge

| Priority | Deliverable                                                                                       | Evidence so far                                                                                                                                     | Remaining                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | **F81 — recovery after nested tools** · [#1618](https://github.com/mekhovov/revealline/pull/1618) | Actual browser recovery works after Collection/Records and Saves; paused flight preserved.                                                          | Stable exact-head inventory and release-ready reconciliation. Clean-base listener assertion is separately documented.                           |
| P1       | **F82 — offline startup repair** · [#1616](https://github.com/mekhovov/revealline/pull/1616)      | 157 focused checks; exact built worker recovery → repair → offline Home passes.                                                                     | Expired diagnostic workflows register skipped checks and block strict merge admission. Prepared Pages capacity and hardware remain unqualified. |
| P1       | **F14 — offline readiness** · [#1624](https://github.com/mekhovov/revealline/pull/1624)           | 51 checks; real component with modeled readiness, stale edition, missing files and unavailable storage inspected in EN/UK. Rebased on current main. | Exact-head CI; committed-package and physical qualification.                                                                                    |
| P1       | **F16 — persistent music recovery** · [#1617](https://github.com/mekhovov/revealline/pull/1617)   | 316 focused checks; actual panel with modeled transport verifies Retry, focus and music-only pause. Rebase complete.                                | Exact-head CI; real failed-track playback and listening.                                                                                        |
| P1       | **F17 — lesson mode choices** · [#1625](https://github.com/mekhovov/revealline/pull/1625)         | 114 checks; actual coach with modeled host verifies paused matching-mode restart and unscored alternative.                                          | Exact-head CI and real flight integration. No phone-layout qualification.                                                                       |
| P1       | **F75 — long-flight saves** · [#1630](https://github.com/mekhovov/revealline/pull/1630)           | 8 new tests including a simulated 30-minute run, 96 regressions; real paused-flight Saves/export/return preserves flight and focus.                 | Exact-head CI; no real 30-minute device run claimed.                                                                                            |
| P1       | **F15b / automatic play preferences** · [#1629](https://github.com/mekhovov/revealline/pull/1629) | 83 focused checks and 9 regressions; modeled storage failures, cross-tab changes, verified Retry and EN/UK 320px component layout inspected.        | Exact-head CI. This slice does not complete all F15b owners.                                                                                    |

## Drafts and active development

| Priority | Item / owner                                                                                        | Current status and next result                                                                                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | **F05 — Continue destination** · [#1622](https://github.com/mekhovov/revealline/pull/1622) · lane A | Browser and 158 focused checks passed; catalog rebase complete locally, full validation before push. Then ready for exact-head CI.                                                                   |
| P1       | **F11a — portable archive** · [#1627](https://github.com/mekhovov/revealline/pull/1627) · lane B    | Actual default Journey exposed legacy-owner rejection. Fix explicitly includes shared media/Journey while excluding incompatible legacy game data; rerun default-host browser flow before promotion. |
| P1       | **F15b — remaining preference owners** · lane C                                                     | Audio warning ownership developing; menu-animation dirty choices follow shared feedback merge; Demo settings remain dependent on D.                                                                  |
| P1       | **F01 — game context** · lane A                                                                     | Capture-scoped context using existing Home/library owners. Inventory remaining families without renaming or duplicating their menus.                                                                 |

Next: **F11b** guided archive inspection/restore steps; **F12** Community readiness (Rooms already preflights); **F06** preset preview/Undo. Demo-dependent work follows reviewed predecessor D. Existing PRs proceed through review and merge while the next slices develop.

## Phase status

| Phase                        | Progress                                          | Main remaining work                                                     |
| ---------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| 0 — Baseline                 | Setup complete                                    | Maintain exact candidate identities and shared-file ownership.          |
| 1 — Reliability              | 1 merged; 5 ready slices; F05 draft; F15b partial | Remaining clarity, service readiness, long-flight and Demo slices.      |
| 2 — Learn and start          | F01 first slice developing                        | Selection hierarchy, onboarding, readability and contextual guidance.   |
| 3 — Progress and offline     | F82/F14 ready; F11a blocker fix                   | Archive/restore, Survival suspend assessment, community reliability.    |
| 4 — Comfort, input and audio | Planned                                           | Presets, cues, remapping, readable UI and accessibility/audio evidence. |
| 5 — Practice and social      | Planned                                           | Playlists, practice, replays, rooms and device calibration.             |
| 6 — Creation and community   | Planned                                           | Creator entry, validation, playtest, publishing and discovery.          |
| 7 — Progression and content  | Planned                                           | Albums, goals, cosmetics and bounded balance experiments.               |
| 8 — Services and platforms   | Planned                                           | Service readiness, cloud, native packages and platform evidence.        |

## Open limits and findings

- **Offline test correction:** deleting a cached file during worker activation invalidated the first test. Waiting for full activation yields successful recovery, repair and offline Home startup. Core-only preparation still leaves selected Journey media unavailable; the game stays paused with a clear message.
- **Hardware:** no iPhone/Steam Deck is available. F14-Q, F83b and F54b remain blocked on physical evidence; other implementation continues.
- **Hosting capacity:** F82's default package contains **1,074,925,070 bytes**, above the **950,000,000-byte** main Pages budget. Its offline core is **73,432,886 bytes**, within the existing 80 MiB limit. Default output and the prepared deployment inventory are different measurements; release capacity is not qualified. Do not raise limits or remove historical assets to make this pass.
- **Existing source checks:** F82's full formatting check has eight unchanged baseline failures. F81's unrelated recovery-display listener-count assertion also fails on clean main. Changed-file checks pass; the failures are not waived or counted as passes.
- **F15a:** current Solo Help shows no localization placeholder. About's version token appears only in source preview and is replaced in the built package. The broader localization finding remains scoped and unreproduced; existing Studio work stays with PR #1525.
- **D:** substantial original-checkout Demo work is preserved. Reconcile it into an explicit reviewed predecessor before dependent changes.
- **Merge admission:** F82 is blocked by skipped one-shot diagnostics restricted to already-merged PR #1544. Required validation remains enabled; resolving stale workflow registration is separate work. F81 is waiting for a stable check inventory.
- **Disk:** task-owned checkout sparsity and removal of retained generated output after checksum receipts recovered space (6.4 GiB at the latest check). No original WIP or unrelated files removed; large builds remain serialized.

The [structured tracker](progress.json) retains all 113 deliverables, priorities, estimates, owners, dependencies and evidence. “Assessment complete,” “browser checked,” “merged” and “verified live” remain distinct. Every substantial milestone updates both records.
