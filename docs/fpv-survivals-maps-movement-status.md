# FPV Survivals maps and movement — implementation status

14 October 2026. Expansion branch: `codex/fpv-survivals-maps-recovered`. Rebased onto PR1192 dependency `6e16bd5b9`, containing main `4c8c762bd56ffef6b7f3720d61a39978d4c66361`. Plan: [maps and movement](fpv-survivals-maps-movement-plan-2026-10-14.md).

| Work | Implementation | Qualification / remaining work |
| --- | --- | --- |
| Preserve/reconcile worlds PR | Complete | Newer pushed work retained; expansion rebased without dropping it. Recovery checkpoints pushed. |
| Research refresh | Complete | Valve motion architecture and Nova Drift entry-readability refinements incorporated. |
| Manual/autoplay separation | Complete | Explicit opt-in, Take Control and assisted-run provenance; focused host tests pass. Native takeover review remains. |
| Coordinated movement and fair escapes | Implemented | 93 focused tests pass. Initial 28-case probe exposes and fixes a wall-adjacent attack-deferral exploit; expanded build/seed/checkpoint matrix underway. |
| Six worlds / 18 layout contracts | Implemented | 162 family/difficulty compiler combinations; 90 Marathon contract definitions; Creator validation. Native mission selector shows six groups of three. |
| Modular art and selected resources | Implemented | Focused art/resource tests pass; custom atlas cropping fixed. Native review found overly repeated roof detail; polishing underway. |
| Five operation adapters / Marathon transitions | Implemented | All 18 baseline-kit, 18 earned objective, 18 pack routes and six Time Attack runs complete. Six automated carried-health Marathons lose; investigating tactics and actual boost readiness. |
| Creator / packages | Implemented | Fresh-profile package tests cover 54 projects across three families and all five operation adapters. Native authoring round-trip remains. |
| Mission UX / records | Implemented | All 18 missions register; six localized world groups; independent revised-rules records. Existing names/legacy imports preserved. |
| Offline lifecycle | Source/worker checks pass | All 90 layout/operation bookmarks, exact modules, interrupted upgrade retention and resumed activation covered. Browser-installed PWA review remains. |
| Balance / performance / review recordings | In progress | Full matrix, native footage, three frame-cadence trials, retry/context/soak and audible review remain. |

Evidence: [movement probes](qualification/overflight/maps-movement-20261014/README.md), [Raid qualification](qualification/overflight/maps-movement-20261014/RAID-QUALIFICATION.md). Each report records its source hashes; a passing implementation test is not a claim of human enjoyment or target-device performance.

## Recovery and preservation

A machine restart removed the previous temporary checkout. The rebased baseline `fd8066f12` remained pushed. Exact source edits were restored from saved tool-call history into `/Users/oleksandr.mekhovov/.codex/worktrees/fpv-survivals-recovery/go_test`, then committed and pushed in checkpoints `d283755ba`, `295b0120f`, `b10ac4cc0` and `c536af7c3`. The pre-rebase checkpoint remains available through local branch `codex/fpv-maps-pre-main-20261014` and GitHub commit history. Recovered source was retested; earlier observations are retained as historical evidence, not relabeled as current qualification.

External Iris Xe/M1 Safari, physical-device and five-player checks remain skipped by prior user instruction, not passed. Broader non-FPV modes can reuse shared assets; their mechanics are outside the current five-operation expansion.
