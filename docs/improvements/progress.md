# Improvement delivery progress

Updated **18 October 2026** (Europe/Berlin). The [approved plan](plan.md) covers **83 feature groups / 113 deliverables**. Implementation is continuing in three lanes, with independent review and browser qualification in parallel.

**2 merged · 15 feature PRs ready for required checks · 23 draft feature PRs · 0 verified live.** These are PR counts, not a percentage of completed features. Several features need multiple host integrations. A reviewed draft stays draft until its predecessors and required checks are admitted.

## Current priorities

| Priority | Work | Status / next result |
| --- | --- | --- |
| P1 | Delivery checks and merge admission | Prerequisite [#1633](https://github.com/mekhovov/revealline/pull/1633) passed all four focused shards; aggregate admission remains queued. Rebase dependent offline work after merge. No gates waived. |
| P1 | **F04b — Survival suspend** · lane A | Draft1663 implements typed checkpoints, paused restore and durable result receipts. Review found full-record-capacity recovery dead-end; correction, exact source/package checks and actual browser remain. |
| P1 | **F11b — archive restore** · lane B → review | Nonempty round trip passed. Browser found backward focus after consecutive Keep choices; narrow correction passes source review and focused tests. Exact final browser check passes; reconcile the stack and required checks. |
| P1 | **F07a/b — critical cues** · review | Inventory1656 ready. Active compact muted self-contact cause and sentry aim warning are visibly confirmed. Sentry-hit, cross-host and listening evidence remain separate. |
| P1 | **F08 — two-seat keyboard bindings** · lane C | Duel1662 is draft. Cross-owner lost update reproduced; dedicated short lock, truthful Session only and delayed-departure correction in validation. Team/Snake remain separate. |
| P1 | **F58a — local support summary** · lane B | Primary shell1661 ready: EN/UK preview and actual downloaded JSON equality pass. Snake adapter developing; other hosts remain separate. |
| P1 | **F01/F06/F79** reviewed stacks | Reconcile predecessors and exact-head checks. Simulator chooser and assisted gym browser reviews now pass. |
| P1 | **F09** text/HUD scaling | Baseline measured: existing Large is roughly115–125% on checked text. Shared-reader compatibility precedes qualified200% presentation. |

Estimates remain the plan’s developer-day ranges, excluding review/CI queues and unavailable hardware. No iPhone or Steam Deck is available; hardware-only gates stay **Not tested** while independent work continues.

## Merged

| Deliverable | Result | Remaining |
| --- | --- | --- |
| **F83a** Deck regression fixtures · [#1613](https://github.com/mekhovov/revealline/pull/1613) | Merged at461ace72e7 after independent review and required checks; fixture clock corrected, interaction assertions retained. | F83b physical Deck acceptance; no production-controller fix or live deployment inferred. |
| **F81** nested-menu recovery · [#1618](https://github.com/mekhovov/revealline/pull/1618) | Merged atcb8dddd3d3; actual Collection/Records/Saves return preserves paused flight and refreshes recovery controls. | Live publication unverified. |

## Ready for required checks

All rows are **P1**. Ready means reviewed and eligible for checks, not merged or deployed.

| Deliverable | Evidence | Remaining |
| --- | --- | --- |
| **F82** offline startup repair · [#1616](https://github.com/mekhovov/revealline/pull/1616) | 157 checks; actual activated built worker missing-file recovery → repair → offline Home. | #1633, rebase/exact checks; selected content, Pages capacity and hardware unqualified. |
| **F14** offline readiness · [#1624](https://github.com/mekhovov/revealline/pull/1624) | 51 checks; real EN/UK component with modeled readiness/storage states. | Exact checks, committed-package/device qualification. |
| **F16** music recovery · [#1617](https://github.com/mekhovov/revealline/pull/1617) | 316 checks; modeled-transport panel Retry, focus and music-only pause. | Actual failed-track playback/listening; exact checks. |
| **F17** lesson mode choice · [#1625](https://github.com/mekhovov/revealline/pull/1625) | 114 checks; actual coach with modeled paused host and unscored alternative. | Real flight integration; exact checks. |
| **F75** long-flight saves · [#1630](https://github.com/mekhovov/revealline/pull/1630) | 8 new +96 regression checks; actual paused flight Saves/export/return. | Exact checks; no real30-minute device run claimed. |
| **F15b** automatic play preferences · [#1629](https://github.com/mekhovov/revealline/pull/1629) | 83+9 checks; modeled storage failure, Retry, cross-tab intent, EN/UK320px. | Exact checks; remaining owners/Demo separate. |
| **F05** Continue destination · [#1622](https://github.com/mekhovov/revealline/pull/1622) | 158 checks/source gates; actual saved mission Continue and paused caption. | Exact checks and reconciliation. |
| **F11a** portable archive · [#1627](https://github.com/mekhovov/revealline/pull/1627) | 82 checks; actual downloaded ZIP passes CRC and every member hash/size. | Exact checks; device export/return separate. |
| **F15b** audio warning ownership · [#1632](https://github.com/mekhovov/revealline/pull/1632) | 119 checks; modeled full-host failure/recovery and Ukrainian silent-write notice. | Exact checks; footer artwork obscured one review, acoustic/device evidence separate. |
| **F01** Capture context · [#1634](https://github.com/mekhovov/revealline/pull/1634) | 54 checks/source review; actual EN/UK browsing and Back on earlier product candidate. Final Hunt label correction source-tested. | Exact checks; other hosts below. |
| **F12** Community readiness · [#1638](https://github.com/mekhovov/revealline/pull/1638) | 39 checks/source gates; actual modeled-service outage/Retry, draft retention and focus. | Exact checks; no account upload performed. |
| **F04a** Survival assessment · [#1639](https://github.com/mekhovov/revealline/pull/1639) | 98 checks; full-state/fresh-process continuation and earned-run equality. | Exact checks. Trusted test oracle is not the F04b production decoder. |
| **F02a** First Flight Home · [#1655](https://github.com/mekhovov/revealline/pull/1655) | 15 checks/source gates; actual first lesson completion, Next, Skip, replay and Return. | Exact checks;13 wider failures reproduced on clean baseline, not waived. |

| **F07a** critical cue inventory · [#1656](https://github.com/mekhovov/revealline/pull/1656) |22 categories/51 source anchors;105 models+3 SIM cases; visible muted compact cause and aim warning confirmed. | Remaining cue paths/listening/device evidence explicit; exact checks. |
| **F58a** primary support summary · [#1661](https://github.com/mekhovov/revealline/pull/1661) |62 focused/full source gates;10 independent tests; actual EN/UK preview and downloaded JSON equality. | Exact checks; Snake/other hosts, real controller and native/device paths separate. |

## Reviewed draft stacks

All rows are **P1**. The structured tracker pins every reviewed revision and distinguishes source, model, browser, package and hardware evidence.

| Slice / PR | Current evidence and remaining boundary |
| --- | --- |
| **F11b** archive inspection/extraction · [#1635](https://github.com/mekhovov/revealline/pull/1635) | Source/browser review passed; downloaded original matches ZIP bytes. Stack on1627. |
| **F15b** menu animation · [#1636](https://github.com/mekhovov/revealline/pull/1636) | Source and actual modeled-storage Solo Retry/cross-tab/focus/UK320 passed. Demo owner depends on D. |
| **F01** Snake · [#1637](https://github.com/mekhovov/revealline/pull/1637) | 194 checks/source gates; Duel/Versus mismatch corrected and actual final correction reviewed at integrated768. |
| **F01** Duel · [#1640](https://github.com/mekhovov/revealline/pull/1640) | 68 checks/source review; actual unlaunched chooser/Back preserves destination/focus. |
| **F06** native presets · [#1641](https://github.com/mekhovov/revealline/pull/1641) | Preview/Apply/partial Retry/Undo and newer-intent preservation reviewed in Solo; page-cache Undo expiry tested. |
| **F06** Snake/Survival · [#1642](https://github.com/mekhovov/revealline/pull/1642) | Source and actual Snake Team Apply/Undo plus paused Survival return passed. |
| **F01** Team · [#1643](https://github.com/mekhovov/revealline/pull/1643) | Verbose internal caption found, corrected at886c;47 checks/source gates and exact EN/UK Home/chooser/Back review passed. |
| **F78** query/pagination · [#1644](https://github.com/mekhovov/revealline/pull/1644) | 45 checks/source review; actual modeled-service stale-response, query, pagination and focus review passed. |
| **F06** SIM · [#1645](https://github.com/mekhovov/revealline/pull/1645) | Source review; Academy/World Apply/Undo and partial Retry passed with flight controls retained. |
| **F11b** guided restore · [#1646](https://github.com/mekhovov/revealline/pull/1646) | 140 checks; actual empty-profile4/4 restore at2c9. Follow-up copy1e69 passes24 checks/full source gates. |
| **F06** Creator · [#1647](https://github.com/mekhovov/revealline/pull/1647) | 49+15 checks/source review; actual generated-fixture player Pause→Apply/Undo→Back passed at integrated4ff. |
| **F01** Hunt · [#1648](https://github.com/mekhovov/revealline/pull/1648) | 125 checks/source gates; actual EN/UK identity, alternate Duel browsing and Back passed. Existing English mission title in UK remains separate localization work. |
| **F06** preset copy · [#1649](https://github.com/mekhovov/revealline/pull/1649) | 18 checks/i18n; accurate neutral EN/UK settings guidance reviewed. |
| **F06** Rooms · [#1650](https://github.com/mekhovov/revealline/pull/1650) | 37 checks; actual UI with modeled paused transport Apply/Undo/UK320 passed; no room joined. |
| **F79** local Installed · [#1651](https://github.com/mekhovov/revealline/pull/1651) | 47 checks/source review; actual generated package install→catalog outage→reload→local Play passed. |
| **F01** SIM Home · [#1652](https://github.com/mekhovov/revealline/pull/1652) | 195 checks/source review; actual Academy/World Home/Back passed. Chooser gap addressed by1659. |
| **F80** removal consequences · [#1653](https://github.com/mekhovov/revealline/pull/1653) | 69 checks/source review; actual default Keep/focus, confirmed offload/reinstall, and recovery-download review cancellation passed. No recovery-copy deletion claimed. |
| **F79** retained recovery · [#1657](https://github.com/mekhovov/revealline/pull/1657) |87 checks/source gates;70 independently rerun. Actual offload→catalog503→reload→Recovery copies→exact local reinstall→Play/Continue/Pause passed. |
| **F11b** nonempty qualification · [#1658](https://github.com/mekhovov/revealline/pull/1658) | Actual PNG/MP4/MP3+synthetic Journey4/4 restore, reload and downloaded re-export equality passed atb33. Re-review reports0new clears. Exact4f87 Keep-focus correction now passes browser progression through all4 components to summary. |
| **F01** SIM chooser · [#1659](https://github.com/mekhovov/revealline/pull/1659) |150 checks/full source gates, independent review; actual Academy EN/World UK context and Back passed at65594. |
| **F06** assisted2D gym · [#1660](https://github.com/mekhovov/revealline/pull/1660) |37+14 checks/i18n/projection; actual started practice→Pause→preview0→partialApply2→Retry3→Undo5→Back preserves Pause. Browser focus returns Settings opener; model returns Resume. No new UK320/device claim. |

| **F08** Duel keyboard controls · [#1662](https://github.com/mekhovov/revealline/pull/1662) | Actual conflicts/cancel/Session-only Retry/UK316px pass on3143. Cross-owner lost update blocks readiness; successor95 focused checks pass, final gates/browser pending. |
| **F04b** Survival suspend · [#1663](https://github.com/mekhovov/revealline/pull/1663) |113 focused+98 shared;28 independent receipt tests. Full256-context records can block terminal recovery; correction and Home controller entry in progress. Exact successor/package/browser pending. |

## Phase picture

| Phase | Progress | Main remaining work |
| --- | --- | --- |
| 0 — Baseline | Established | Maintain isolated branches, exact revisions and shared-file ownership. |
| 1 — Reliability |2 merged; reviewed reliability slices queued | Merge reconciliation, localization findings and Demo-dependent reliability. |
| 2 — Learn and start | Capture/First Flight ready; inspected context hosts reviewed | Selection hierarchy, further onboarding, readability and guidance. |
| 3 — Progress and offline | Archive/local recovery reviewed; Survival suspend active | Production suspend, diagnostics, package capacity, device evidence. |
| 4 — Comfort/input/audio | All identified preset hosts reviewed; bindings active | Critical cues, seat mappings, scaling, assistive technology and listening. |
| 5 — Practice/social | Planned | Playlists, practice, replays, rooms and device calibration. |
| 6 — Creation/community | Planned | Creator entry, validation, playtest, publishing and discovery. |
| 7 — Progression/content | Planned | Albums, goals, cosmetics and bounded balance experiments. |
| 8 — Services/platforms | Planned | Cloud/native services and platform qualification. |

## Evidence limits and dependencies

- **Offline:** F82’s activated built-worker recovery is real desktop evidence. Core-only preparation leaves selected Journey media unavailable; offline Home is not full offline gameplay. Removing files during activation was an invalid earlier test and is excluded.
- **Capacity:** default F82 output1,074,925,070bytes exceeds the950,000,000-byte main Pages budget. Core73,432,886bytes is within80MiB. Prepared deployment inventory needs separate measurement; do not raise limits or delete historical assets to pass.
- **Hardware:** F14-Q/F83b/F54b remain blocked on physical evidence. Browser widths are layout checks, not iPhone/Deck qualification.
- **Audio/accessibility:** DOM/AX cause text is not proof that a muted player can see it; audio import is not listening or mix qualification. F07 checks these separately.
- **Backups:** nonempty desktop evidence uses exact owned test media and explicitly synthetic, unearned progress in an isolated origin. It does not establish large-media/device behavior, earned-gameplay correctness or multi-store atomicity.
- **Demo predecessor D:** original WIP is preserved. Separate [#1615](https://github.com/mekhovov/revealline/pull/1615), latest390255e64, remains draft; its final source packaging is reported passed, while browser refresh, two-hour rotation, WebKit diagnostics and CI/device gates remain its owner’s responsibility. Its staged/archive figures do not replace this plan’s950MB prepared Pages gate. Dependent F02b/c/F15b/F76 work stays open.
- **Baseline checks:** unchanged formatting debt and reproduced unrelated failures remain disclosed, never counted as passing. Missing local test dependencies/trimmed fixtures are repaired before interpreting results.
- **Disk:** about3.5GiB free after safely trimming task-owned historical evidence hydration. Heavy builds remain serialized. Original WIP and unrelated files are untouched.

The [structured tracker](progress.json) retains all113 deliverables, priorities, estimates, dependencies, exact source identities and detailed evidence. Assessment, reviewed, merged and verified-live are separate states. Substantial milestones update both records.
