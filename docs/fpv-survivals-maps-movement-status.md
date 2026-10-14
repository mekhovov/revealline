# FPV Survivals maps and movement — implementation status

14 October 2026. Expansion branch: `codex/fpv-survivals-maps-recovered`. Rebased onto PR1192 dependency `6e16bd5b9`, containing main `4c8c762bd56ffef6b7f3720d61a39978d4c66361`. Plan: [maps and movement](fpv-survivals-maps-movement-plan-2026-10-14.md).

| Work | Implementation | Qualification / remaining work |
| --- | --- | --- |
| Preserve/reconcile worlds PR | Complete | Newer pushed work retained; expansion rebased without dropping it. Recovery checkpoints pushed. |
| Research refresh | Complete | Valve motion architecture and Nova Drift entry-readability refinements incorporated. |
| Manual/autoplay separation | Complete | Explicit opt-in, Take Control and assisted-run provenance; focused host tests pass. Native takeover showed manual control, retained assisted-run labeling and no personal record. |
| Coordinated movement and fair escapes | Implemented; final correctness follow-up tested | Initial 28-case probe fixes a wall-adjacent attack-deferral exploit. Expanded 36-baseline matrix completed; 91 unattended defeats and 17 unavailable checkpoints. Corrected-pilot reruns produced 65 defeats and four unavailable checkpoints. No observed unattended wins. Effective-speed warning admission is corrected with 13 focused movement regressions passing; previous source-bound matrices precede this correction and remain historical evidence. |
| Six worlds / 18 layout contracts | Implemented | 162 family/difficulty compiler combinations; 90 Marathon contract definitions; Creator validation. Native mission selector shows six groups of three. |
| Modular art and selected resources | Complete | Roof repetition polished; six-world and 18-layout presentation sheets available. Selected-source preparation is queued through atlas completion, including A→B→A recovery, failures and disposal. Focused art/resource/lifecycle tests pass. |
| Five operation adapters / Marathon transitions | Implemented; 66/66 simulation trials complete | All 18 baseline-kit, 18 earned objective, 18 pack routes, six Time Attack and six carried-resource Marathon runs complete on their recorded source hashes. Shared boost-readiness reporting includes the existing minimum start interval. The later effective-speed admission change needs a final-source comparison. Tested seed/build only; not human difficulty proof. |
| Creator / packages | Implemented; native round-trip passed | Fresh-profile package tests cover 54 projects across three families and all five operation adapters. Native author → validate → preview → export → reset → import → install → briefing passed for Glasshouse Routes. |
| Mission UX / records | Implemented | All 18 missions register; six localized world groups; independent revised-rules records. Existing names/legacy imports preserved. |
| Offline lifecycle | Source/worker checks pass | All 90 layout/operation bookmarks, exact modules, interrupted upgrade retention and resumed activation covered. Browser-installed PWA review remains. |
| Balance / performance / review recordings | In progress | Initial movement matrix and corrected-pilot reruns completed. Twenty corrected active losses still require gameplay review. One batch lost detailed output to disk exhaustion; its complete outcome log survives and is explicitly labeled summary-only. Final-source native comparison recordings, frame-cadence trials, browser retry/context/soak and audible qualification remain. |

Evidence: [movement probes](qualification/overflight/maps-movement-20261014/README.md), [Raid qualification](qualification/overflight/maps-movement-20261014/RAID-QUALIFICATION.md), [native takeover and Creator review](qualification/overflight/maps-movement-20261014/native/native-review.json), [resource accounting](qualification/overflight/maps-movement-20261014/RESOURCE-QUALIFICATION.md). Reports identify their own source boundary; a passing implementation test is not a claim of human enjoyment or target-device performance. Browser-installed offline verification, final performance and complete review recordings remain pending.

## Recovery and preservation

A machine restart removed the previous temporary checkout. The rebased baseline `fd8066f12` remained pushed. Exact source edits were restored from saved tool-call history into `/Users/oleksandr.mekhovov/.codex/worktrees/fpv-survivals-recovery/go_test`, then committed and pushed in checkpoints `d283755ba`, `295b0120f`, `b10ac4cc0` and `c536af7c3`. The pre-rebase checkpoint remains available through local branch `codex/fpv-maps-pre-main-20261014` and GitHub commit history. Recovered source was retested; earlier observations are retained as historical evidence, not relabeled as current qualification.

External Iris Xe/M1 Safari, physical-device and five-player checks remain skipped by prior user instruction, not passed. Broader non-FPV modes can reuse shared assets; their mechanics are outside the current five-operation expansion.
