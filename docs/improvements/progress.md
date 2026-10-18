# Improvement delivery progress

Updated **18 October 2026** (Europe/Berlin). Continuous implementation of the [approved staged plan](plan.md) is underway. This board covers this workstream; release integration and publication remain separate gates.

**83 feature groups · 113 deliverables · 4 feature PRs in draft review · 3 next slices developing · 0 merged or shipped.**

## Ready for review

| Priority | Deliverable                                                                                       | Evidence so far                                                                                                                                                                        | Remaining                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| P1       | **F83a — Deck regression fixtures** · [#1613](https://github.com/mekhovov/revealline/pull/1613)   | Independent review confirms a test-clock correction with all interaction assertions retained. 21 Deck tests on Node 20/22; 659 focused input/controller checks; four CI shards passed. | Remaining exact-head CI, merge review. Physical Deck report stays open under F83b.                                    |
| P1       | **F81 — recovery after nested tools** · [#1618](https://github.com/mekhovov/revealline/pull/1618) | Recovery opens after Collection → Records and Saves → Back in the actual browser. The paused flight remains at the same time, score and lives.                                         | Required CI. An unrelated storage-listener assertion fails identically on the clean base and remains recorded.        |
| P1       | **F82 — offline startup repair** · [#1616](https://github.com/mekhovov/revealline/pull/1616)      | Worker-owned recovery survives missing entry/module files in modeled checks; 103 recovery/update and 54 build checks pass. Exact committed package builds.                             | Actual browser recovery, required CI and prepared Pages capacity. Physical iPhone acceptance remains pending.         |
| P1       | **F16 — persistent music recovery** · [#1617](https://github.com/mekhovov/revealline/pull/1617)   | 259 audio/policy and 57 localization checks pass. Browser component review confirms Retry focus, music-only pause, EN/UK and 320px wrapping.                                           | Required CI and real playback-failure integration. The review used a modeled transport; no listening or iPhone claim. |

## In development

| Priority | Item / owner     | Next complete player-facing result                                                                                                  |
| -------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| P1       | **F05 — lane A** | Show mission and mode beneath Start/Continue; explain fresh start, paused resume and saved-flight verification accurately.          |
| P1       | **F14 — lane B** | Separate verified game files, selected content, optional downloads, installed context and storage persistence in offline readiness. |
| P1       | **F17 — lane C** | Offer the lesson's compatible flight mode or explicitly unscored practice without changing record rules.                            |

Next: **F11a/b** portable backup and restore; **F12** service readiness; **F75** long-flight limits; **F01** consistent game selection. Demo-dependent work follows the reviewed predecessor D.

## Phase status

| Phase                        | Progress                        | Main remaining work                                                     |
| ---------------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| 0 — Baseline                 | Setup complete                  | Maintain exact candidate identities and shared-file ownership.          |
| 1 — Reliability              | 3 draft PRs; F05/F17 developing | Remaining clarity, service readiness, long-flight and Demo slices.      |
| 2 — Learn and start          | Planned                         | Selection hierarchy, onboarding, readability and contextual guidance.   |
| 3 — Progress and offline     | F82 draft; F14 developing       | Archive/restore, Survival suspend assessment, community reliability.    |
| 4 — Comfort, input and audio | Planned                         | Presets, cues, remapping, readable UI and accessibility/audio evidence. |
| 5 — Practice and social      | Planned                         | Playlists, practice, replays, rooms and device calibration.             |
| 6 — Creation and community   | Planned                         | Creator entry, validation, playtest, publishing and discovery.          |
| 7 — Progression and content  | Planned                         | Albums, goals, cosmetics and bounded balance experiments.               |
| 8 — Services and platforms   | Planned                         | Service readiness, cloud, native packages and platform evidence.        |

## Open limits and findings

- **Hardware:** no iPhone/Steam Deck is available. F14-Q, F83b and F54b remain blocked on physical evidence; other implementation continues.
- **Hosting capacity:** F82's default package contains **1,074,925,070 bytes**, above the **950,000,000-byte** main Pages budget. Its offline core is **73,432,886 bytes**, within the existing 80 MiB limit. Default output and the prepared deployment inventory are different measurements; release capacity is not qualified. Do not raise limits or remove historical assets to make this pass.
- **Existing source checks:** F82's full formatting check has eight unchanged baseline failures. F81's unrelated recovery-display listener-count assertion also fails on clean main. Changed-file checks pass; the failures are not waived or counted as passes.
- **F15a:** current Solo Help shows no localization placeholder. About's version token appears only in source preview and is replaced in the built package. The broader localization finding remains scoped and unreproduced; existing Studio work stays with PR #1525.
- **D:** substantial original-checkout Demo work is preserved. Reconcile it into an explicit reviewed predecessor before dependent changes.
- **Disk:** reuse the two full worktrees and the sparse checkouts; serialize large builds. No unrelated user files were removed.

The [structured tracker](progress.json) retains all 113 deliverables, priorities, estimates, owners, dependencies and evidence. “Assessment complete,” “browser checked,” “merged” and “verified live” remain distinct. Every substantial milestone updates both records.
