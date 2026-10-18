# Improvement delivery progress

Updated **18 October 2026** (Europe/Berlin). Continuous implementation of the [approved staged plan](plan.md) is underway. This board covers this workstream; release integration and publication remain separate gates.

**83 feature groups · 113 deliverables · 6 feature PRs in draft review · 3 next slices developing · 1 merged · 0 verified live.**

## Merged

**F83a — Deck regression fixtures · [#1613](https://github.com/mekhovov/revealline/pull/1613)** merged at `461ace72e7` after independent review and required exact-head checks. The change corrects the test clock and preserves interaction assertions. Physical Deck acceptance remains F83b; live deployment is not claimed.

## Ready for review

| Priority | Deliverable                                                                                       | Evidence so far                                                                                                      | Remaining                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | **F81 — recovery after nested tools** · [#1618](https://github.com/mekhovov/revealline/pull/1618) | Actual browser opens recovery after Collection/Records and Saves; paused time, score and lives preserved.            | Required CI; documented clean-base listener assertion remains separate.                                                               |
| P1       | **F05 — Continue destination** · [#1622](https://github.com/mekhovov/revealline/pull/1622)        | 158 focused checks; real saved-flight resume and updated paused-flight caption.                                      | Required CI; nine companion failures reproduce on clean base.                                                                         |
| P1       | **F17 — lesson mode choices** · [#1625](https://github.com/mekhovov/revealline/pull/1625)         | 114 focused checks; actual coach with modeled host confirms paused mode restart, unscored choice and EN/UK guidance. | Required CI and real flight integration. Narrow-width fixture did not constrain overlay; no phone claim.                              |
| P1       | **F16 — persistent music recovery** · [#1617](https://github.com/mekhovov/revealline/pull/1617)   | 316 focused audio/localization checks; component browser review confirms Retry focus, music-only pause and EN/UK.    | Rebase shared catalog conflict; exact-head CI; real playback failure/listening.                                                       |
| P1       | **F82 — offline startup repair** · [#1616](https://github.com/mekhovov/revealline/pull/1616)      | 157 recovery/build checks; exact package builds. Real worker recovery → repair → Home with server stopped passes.    | Required CI, prepared Pages capacity and physical qualification. Selected media was not prepared; no complete offline gameplay claim. |
| P1       | **F14 — offline readiness** · [#1624](https://github.com/mekhovov/revealline/pull/1624)           | 51 focused checks; distinct verified core/content, installed context, selected edition and retention status.         | Component review, required CI and committed-package/device acceptance.                                                                |

## In development

| Priority | Item / owner      | Next complete player-facing result                                                                                                                      |
| -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | **F75 — lane A**  | Paused Flight saves, truthful recording/collection limits and existing export routes.                                                                   |
| P1       | **F11a — lane B** | One portable archive with actual component inventory, Journey coverage and explicit exclusions.                                                         |
| P1       | **F15b — lane C** | Continuous-play preference save status/retry; preserve unsaved choices across unrelated tab changes. Wider and Demo-dependent coverage remains tracked. |

Next: **F01** consistent game selection; **F12** service readiness; **F06** preset preview/Undo; **F11b** restore review. Demo-dependent work follows reviewed predecessor D. Existing PRs move through review and merge while the next slices are developed.

## Phase status

| Phase                        | Progress                                   | Main remaining work                                                     |
| ---------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| 0 — Baseline                 | Setup complete                             | Maintain exact candidate identities and shared-file ownership.          |
| 1 — Reliability              | 1 merged; 4 draft PRs; F75/F15b developing | Remaining clarity, service readiness, long-flight and Demo slices.      |
| 2 — Learn and start          | Planned                                    | Selection hierarchy, onboarding, readability and contextual guidance.   |
| 3 — Progress and offline     | F82/F14 draft; F11a developing             | Archive/restore, Survival suspend assessment, community reliability.    |
| 4 — Comfort, input and audio | Planned                                    | Presets, cues, remapping, readable UI and accessibility/audio evidence. |
| 5 — Practice and social      | Planned                                    | Playlists, practice, replays, rooms and device calibration.             |
| 6 — Creation and community   | Planned                                    | Creator entry, validation, playtest, publishing and discovery.          |
| 7 — Progression and content  | Planned                                    | Albums, goals, cosmetics and bounded balance experiments.               |
| 8 — Services and platforms   | Planned                                    | Service readiness, cloud, native packages and platform evidence.        |

## Open limits and findings

- **Offline test correction:** deleting a cached file during worker activation invalidated the first test. Waiting for full activation yields successful recovery, repair and offline Home startup. Core-only preparation still leaves selected Journey media unavailable; the game stays paused with a clear message.
- **Hardware:** no iPhone/Steam Deck is available. F14-Q, F83b and F54b remain blocked on physical evidence; other implementation continues.
- **Hosting capacity:** F82's default package contains **1,074,925,070 bytes**, above the **950,000,000-byte** main Pages budget. Its offline core is **73,432,886 bytes**, within the existing 80 MiB limit. Default output and the prepared deployment inventory are different measurements; release capacity is not qualified. Do not raise limits or remove historical assets to make this pass.
- **Existing source checks:** F82's full formatting check has eight unchanged baseline failures. F81's unrelated recovery-display listener-count assertion also fails on clean main. Changed-file checks pass; the failures are not waived or counted as passes.
- **F15a:** current Solo Help shows no localization placeholder. About's version token appears only in source preview and is replaced in the built package. The broader localization finding remains scoped and unreproduced; existing Studio work stays with PR #1525.
- **D:** substantial original-checkout Demo work is preserved. Reconcile it into an explicit reviewed predecessor before dependent changes.
- **Disk:** reuse the two full worktrees and the sparse checkouts; serialize large builds. No unrelated user files were removed.

The [structured tracker](progress.json) retains all 113 deliverables, priorities, estimates, owners, dependencies and evidence. “Assessment complete,” “browser checked,” “merged” and “verified live” remain distinct. Every substantial milestone updates both records.
