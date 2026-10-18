# Improvement delivery progress

Updated **18 October 2026** (Europe/Berlin). Continuous implementation of the [approved staged plan](plan.md) is underway. This board covers this workstream; release integration and publication remain separate gates.

**83 feature groups · 113 deliverables · 13 feature PRs ready for checks · 19 draft feature PRs · 3 implementation lanes active · 2 merged · 0 verified live.**

## Merged

**F83a — Deck regression fixtures · [#1613](https://github.com/mekhovov/revealline/pull/1613)** merged at `461ace72e7` after independent review and required exact-head checks. The change corrects the test clock and preserves interaction assertions. Physical Deck acceptance remains F83b; live deployment is not claimed.

**F81 — nested-menu recovery · [#1618](https://github.com/mekhovov/revealline/pull/1618)** merged at `cb8dddd3d3` after required checks. Actual Collection/Records and Saves return preserved the paused flight. Live publication remains unverified.

## Ready for checks and merge

| Priority | Deliverable                                                                                       | Evidence so far                                                                                                                                     | Remaining                                                                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | **F82 — offline startup repair** · [#1616](https://github.com/mekhovov/revealline/pull/1616)      | 157 focused checks; exact built worker recovery → repair → offline Home passes.                                                                     | Retired-trigger prerequisite [#1633](https://github.com/mekhovov/revealline/pull/1633) is ready; rebase and rerun checks after merge. Prepared Pages capacity and hardware remain unqualified. |
| P1       | **F14 — offline readiness** · [#1624](https://github.com/mekhovov/revealline/pull/1624)           | 51 checks; real component with modeled readiness, stale edition, missing files and unavailable storage inspected in EN/UK. Rebased on current main. | Exact-head CI; committed-package and physical qualification.                                                                                                                                   |
| P1       | **F16 — persistent music recovery** · [#1617](https://github.com/mekhovov/revealline/pull/1617)   | 316 focused checks; actual panel with modeled transport verifies Retry, focus and music-only pause. Rebase complete.                                | Exact-head CI; real failed-track playback and listening.                                                                                                                                       |
| P1       | **F17 — lesson mode choices** · [#1625](https://github.com/mekhovov/revealline/pull/1625)         | 114 checks; actual coach with modeled host verifies paused matching-mode restart and unscored alternative.                                          | Exact-head CI and real flight integration. No phone-layout qualification.                                                                                                                      |
| P1       | **F75 — long-flight saves** · [#1630](https://github.com/mekhovov/revealline/pull/1630)           | 8 new tests including a simulated 30-minute run, 96 regressions; real paused-flight Saves/export/return preserves flight and focus.                 | Exact-head CI; no real 30-minute device run claimed.                                                                                                                                           |
| P1       | **F15b / automatic play preferences** · [#1629](https://github.com/mekhovov/revealline/pull/1629) | 83 focused checks and 9 regressions; modeled storage failures, cross-tab changes, verified Retry and EN/UK 320px component layout inspected.        | Exact-head CI. This slice does not complete all F15b owners.                                                                                                                                   |
| P1       | **F05 — Continue destination** · [#1622](https://github.com/mekhovov/revealline/pull/1622)        | Rebase complete; 158 focused checks, full source gates, real Continue/paused-caption receipt retained.                                              | Exact-head CI and merge reconciliation.                                                                                                                                                        |
| P1       | **F11a — portable archive** · [#1627](https://github.com/mekhovov/revealline/pull/1627)           | Authored-owner blocker fixed; 82 focused checks and source gates. Actual default-Journey ZIP download passes CRC and every listed member hash/size. | Exact-head CI; device export/return acceptance separate.                                                                                                                                       |
| P1       | **F15b / audio warning ownership** · [#1632](https://github.com/mekhovov/revealline/pull/1632)    | 119 focused checks; modeled full-host failure/recovery, newer-notice preservation and Ukrainian silent-write feedback inspected.                    | Exact-head CI; player-footer presentation was obscured by artwork fallback, and acoustic/hardware evidence remains separate.                                                                   |

| P1 | **F01 / Capture context** · [#1634](https://github.com/mekhovov/revealline/pull/1634) | Shared Hunt naming corrected; context/Back browser receipt and final source checks reviewed. | Exact-head CI; remaining F01 hosts separate. |
| P1 | **F12 — Community readiness** · [#1638](https://github.com/mekhovov/revealline/pull/1638) | 39 distinct tests; full lint/validation; actual page with modeled service verifies outage/retry, retained draft and focus. Independent review fixes verified. | Exact-head CI; F78 pagination and F79 local inventory separate. |
| P1 | **F04a — Survival assessment** · [#1639](https://github.com/mekhovov/revealline/pull/1639) | 98 focused tests; complete-state/fresh-process continuation and earned full-run equality; independent review passed. | Exact-head CI. F04b is still the production suspend feature. |

## Drafts and active development

| Priority | Item / owner                                                                                          | Current status and next result                                                                                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | **F01 / Snake** · [#1637](https://github.com/mekhovov/revealline/pull/1637) · lane A                  | Draft stack on Capture: 194 checks/source gates; browser found a Duel/Versus wording mismatch, corrected at63ef and verified in actual integrated768 browser.                                                 |
| P1       | **F01 / Duel** · [#1640](https://github.com/mekhovov/revealline/pull/1640) · lane A                   | Draft stack on Capture: 68 checks/source gates; independent source and actual unlaunched menu/Back review passed. Team is a separate draft.                                                               |
| P1       | **F11b / review and extraction** · [#1635](https://github.com/mekhovov/revealline/pull/1635) · lane B | Source and actual browser review passed; downloaded original component matches ZIP bytes. Draft stack on1627. Guided apply1646 passed source and scoped browser review; narrow wording follow-up remains. |
| P1       | **F15b / menu animation** · [#1636](https://github.com/mekhovov/revealline/pull/1636) · lane C        | Actual Solo modeled-storage failure/retry, other-tab intent, focus and Ukrainian320px review passed. Draft stack on1629. Demo owner remains dependent on D.                                               |
| P1       | **F06 / native comfort presets** · [#1641](https://github.com/mekhovov/revealline/pull/1641) · lane C | Preview/Apply/Undo, partial-save Retry and newer-choice preservation reviewed in actual Solo; final page-cache expiry tested. Draft stack on1636. Remaining family presets developing.                    |
| P1       | **F78 / query and pagination** · [#1644](https://github.com/mekhovov/revealline/pull/1644)            | 45 tests and source gates; independent source and actual modeled-service browser review passed. Draft stack on F12.                                                                                       |
| P1       | **Delivery prerequisite** · [#1633](https://github.com/mekhovov/revealline/pull/1633)                 | Ready;136 checks and two independent reviews.13 expired diagnostic triggers retired; active gates and merge policy unchanged. Exact-head CI queued/running.                                               |

| P1 | **F01 / Team** · [#1643](https://github.com/mekhovov/revealline/pull/1643) | Verbose default caption found in browser, corrected at886c. 47 checks/full source gates; independent source and EN/UK browser/Back review passed. Draft stack on Duel. |
| P1 | **F01 / Hunt** · [#1648](https://github.com/mekhovov/revealline/pull/1648) | 125 checks/source gates; authoritative EN/UK identity and Classic handoff. Independent source and actual EN/UK Home/chooser/Back review passed. |
| P1 | **F06 / Snake and Survival** · [#1642](https://github.com/mekhovov/revealline/pull/1642) | Source review and actual Snake Team Apply/Undo plus paused Survival return passed. Draft stack on native presets. |
| P1 | **F06 / SIM** · [#1645](https://github.com/mekhovov/revealline/pull/1645) | Source review and actual Academy/World preview, partial-save Retry and Undo passed; flight controls unchanged. Draft stack on arcade. |
| P1 | **F06 / Creator** · [#1647](https://github.com/mekhovov/revealline/pull/1647) | 49 focused and15 offline checks; source and actual paused-player Apply/Undo/Back review passed at integrated4ff. Draft stack on SIM. |
| P1 | **F11b / guided restore** · [#1646](https://github.com/mekhovov/revealline/pull/1646) | 140 focused checks/source gates; source and actual guided restore passed at2c9. Cancel/order/4-of-4/close receipts verified with empty-profile archive. Copy follow-up1e69df passes24 tests/full source gates and independent review. |
| P1 | **F79 / local Installed** · [#1651](https://github.com/mekhovov/revealline/pull/1651) | 47 focused checks/full source gates, independent source and actual catalog-outage install/reopen/play passed. Offline Recovery copies is the next dependent slice. |
| P1 | **F80 / removal review** · [#1653](https://github.com/mekhovov/revealline/pull/1653) | 69 focused checks/full source gates and independent source review passed. Explicit F79 stack; actual Keep/offload/reinstall and recovery-review cancellation passed. No recovery-copy deletion claimed. |
| P1 | **F01 / SIM** · [#1652](https://github.com/mekhovov/revealline/pull/1652) | 195 focused checks/full source gates and independent source review passed. Actual Academy/World Home/Back passed; generic Solo chooser caption is a separate active follow-up. |
| P1 | **F06 / Rooms** · [#1650](https://github.com/mekhovov/revealline/pull/1650) | 37 checks/source gates; source and actual UI Apply/Undo/UK320 review passed. Modeled paused transport received no gameplay calls. |
| P1 | **F02a / First Flight Home** · [#1655](https://github.com/mekhovov/revealline/pull/1655) | **Ready for checks.** 15 focused checks/source gates; actual first-lesson completion, Next, Skip, replay and Return passed. Wider13 baseline failures retained. |
| P1 | **F07a / critical cues** · [#1656](https://github.com/mekhovov/revealline/pull/1656) | 22 categories/51 independently verified anchors,105 model checks+3 SIM cases. Actual muted-play review underway: DOM/AX cause confirmed; compact visible alternative still being assessed. |
| P1 | **F79 / retained recovery** · [#1657](https://github.com/mekhovov/revealline/pull/1657) | 87 tests/full source gates; independent review and actual offload→catalog outage→reload→Recovery copies→reinstall→Play/Continue/Pause passed. Generated fixture; full PWA/device separate. |
| P1 | **F01 / SIM chooser** · root | Preserve Academy/World context while browsing; existing exact selection and paused-state protections retained. Focused host checks passed; broader gates running. |
| P1 | **F04b / Survival suspend** · lane A | Production typed checkpoint and exact compatibility work started. UI, atomic storage and durable rewards remain. |

Next: **F04b** production suspend, **F07a/b** critical-cue evidence and demonstrated repairs, **F01** SIM chooser context, **F11b** nonempty restore/ZIP instructions, and **F06** optional 2D gym. All remain P1. Estimates exclude CI/review queues and unavailable hardware.

**Shared preset copy:** [#1649](https://github.com/mekhovov/revealline/pull/1649) removes the inaccurate “below” instruction across hosts. It is a separate reviewed-stack follow-up;18 focused checks and localization pass; independent source review passed.

## Phase status

| Phase                        | Progress                                                          | Main remaining work                                                     |
| ---------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 0 — Baseline                 | Setup complete                                                    | Maintain exact candidate identities and shared-file ownership.          |
| 1 — Reliability              | 2 merged; reliability slices reviewed; F15b partial               | Remaining clarity, service readiness, long-flight and Demo slices.      |
| 2 — Learn and start          | Capture/First Flight ready; other context hosts reviewed drafts | Selection hierarchy, onboarding, readability and contextual guidance.   |
| 3 — Progress and offline     | F82/F14/F11a/F04a ready; recovery drafts reviewed; F04b developing                  | Archive/restore, Survival suspend assessment, community reliability.    |
| 4 — Comfort, input and audio | Native/arcade/SIM/Creator/Rooms reviewed drafts; gym remains      | Presets, cues, remapping, readable UI and accessibility/audio evidence. |
| 5 — Practice and social      | Planned                                                           | Playlists, practice, replays, rooms and device calibration.             |
| 6 — Creation and community   | Planned                                                           | Creator entry, validation, playtest, publishing and discovery.          |
| 7 — Progression and content  | Planned                                                           | Albums, goals, cosmetics and bounded balance experiments.               |
| 8 — Services and platforms   | Planned                                                           | Service readiness, cloud, native packages and platform evidence.        |

## Open limits and findings

- **Offline test correction:** deleting a cached file during worker activation invalidated the first test. Waiting for full activation yields successful recovery, repair and offline Home startup. Core-only preparation still leaves selected Journey media unavailable; the game stays paused with a clear message.
- **Hardware:** no iPhone/Steam Deck is available. F14-Q, F83b and F54b remain blocked on physical evidence; other implementation continues.
- **Hosting capacity:** F82's default package contains **1,074,925,070 bytes**, above the **950,000,000-byte** main Pages budget. Its offline core is **73,432,886 bytes**, within the existing 80 MiB limit. Default output and the prepared deployment inventory are different measurements; release capacity is not qualified. Do not raise limits or remove historical assets to make this pass.
- **Existing source checks:** F82's full formatting check has eight unchanged baseline failures. F81's unrelated recovery-display listener-count assertion also fails on clean main. Changed-file checks pass; the failures are not waived or counted as passes.
- **F15a:** current Solo Help shows no localization placeholder. About's version token appears only in source preview and is replaced in the built package. The broader localization finding remains scoped and unreproduced; existing Studio work stays with PR #1525.
- **D:** original-checkout Demo work remains preserved. The separate [Demo predecessor #1615](https://github.com/mekhovov/revealline/pull/1615) is draft at05c795fdc; its final packaging, long rotation and browser/service/device gates remain open. Its evidence and delivery are not counted as completed by this workstream.
- **Merge admission:** F82 awaits #1633, which removes automatic registration from expired PR #1544 diagnostics. Active diagnostic workflows, required validation and strict merge policy stay unchanged. F81 merged after exact-head checks.
- **Disk:** task-owned checkout sparsity and removal of retained generated output after checksum receipts recovered space (about3.3 GiB at the latest measured check). No original WIP or unrelated files removed; large builds remain serialized.

The [structured tracker](progress.json) retains all 113 deliverables, priorities, estimates, owners, dependencies and evidence. “Assessment complete,” “browser checked,” “merged” and “verified live” remain distinct. Every substantial milestone updates both records.

## Latest review decisions

- **F12:** independent review fixed back/forward-cache store lifetime and readiness/sign-out races before promotion. All source validation stages pass; unchanged baseline formatting findings remain documented.
- **F04a:** the serializer is a trusted test oracle. It establishes feasibility, not a production import format or mobile memory guarantee. F04b must add recoverable storage, exact package admission and durable result ownership.
- **F06:** Undo keeps newer settings. A restored page now expires the old Undo because missed cross-tab events cannot establish ownership. Width320 browser evidence is not physical iPhone qualification.
- **CI:** F81 is now merged. Ready means reviewed and eligible for required checks; it does not mean deployed.

- **F79:** Installed is based on local runtime ownership. Corrupt/unavailable entries stay visible without a Play action and cannot hide healthy entries. The catalog-outage browser receipt is not a full offline PWA or whole-media integrity claim. Retained-package recovery1657 now passes source and scoped actual browser review; exact checks/integration remain.

- **F06 coverage correction:** optional 2D practice (`optional-practice/civilian-flight`) is a separate reachable host. It remains an explicit P1 slice; the reviewed Academy/World hosts do not cover it.

- **F07 evidence correction:** AX/DOM exposure does not establish that a muted player can see the cause. Compact visible rendering is being checked separately; no all-cues or listening pass is claimed.
