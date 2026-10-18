# Shared game demos — implementation and qualification plan

Updated **18 October 2026, 20:24 CEST**. The shared implementation is published in [draft PR #1615](https://github.com/mekhovov/revealline/pull/1615). **The full acceptance plan is not complete. No public deployment has occurred.**

## Scope

One reusable framework covers Solo, Snake Solo, SIM and FPV Survival at every built-in authored standard setup, including each allowed SIM flight mode. It preserves complete genuine performances, current-mode entry after 60 eligible idle seconds, balanced random **Watch all modes**, isolated practice, guarded ordinary Ready launch, and player persistence/preferences. Team/Versus, Raid, prototypes, free flight, editors, custom combinations and new personal-recording collection outside Solo remain excluded.

## Current priorities

**20:04 CEST qualification checkpoint:** fresh native coverage passed **890/890** (Solo 240, Snake 240, SIM 392, Survival 18), with genuine terminal outcomes and meaningful progress. The affected runtime suite passed **736 tests** and ordinary downstream integration passed **78 tests**. Exact-tick capture/comparison, injected faults, corrupt-reference rejection and cancellation pass for all four modes in **Chromium, Firefox and WebKit**. These representative diagnostic checks supplement full native/catalog replay coverage; they do not claim all 890 entries were traced on every tick in every browser.

The direct resource probe found an upstream Phaser visibility/focus ownership leak. The correction is implemented: transient games now own and remove their lifecycle hooks while preserving the originating game's hooks. **82 related regressions** and **33 final renderer regressions** pass (overlapping suites, not additive). An actual-browser draft probe passed; the final probe against production code passed all 12 transitions and three closed-baseline comparisons. That probe identifies pre-rebase sources. The branch has now rebased onto `461ace72e7`, resolving only the generated translation catalog. Final qualification is frozen at `02f749f71e0a77272e3d9e2ba555469125bbc7a8e8ce4375a3781776df454611` (HEAD `65d7795872`).

| Priority | Item | Current progress and completion condition |
| --- | --- | --- |
| P0 — complete | Preserve work, integrate main, publish PR | Initial integration passed 258 tests on `e3a20a2a34`; the new rebase onto `461ace72e7` preserves all five feature commits. Only generated translations conflicted and were regenerated. All 200 focused checks of incoming ordinary-game/recovery changes passed; unrelated work is preserved. |
| P0 — complete | Deadline and harness cleanup | Pushed `bbd7c6a064`; elapsed-time checks reject late preparation, count retirement, and retain the 15/30-second budgets. Atomic evidence and independent browser closure; 56 focused tests passed. |
| P1 — complete | Exact first-divergent-tick diagnostics | Pushed `892d7b0a43`; 47 combined framework/Solo/Snake/SIM/CLI tests plus six complete Survival tests pass. All three browser engines pass representative four-mode strict capture/comparison and fault checks. |
| P1 — complete | Preparation diagnostics and fresh coverage | Bounded shared stage/candidate timings are implemented. All four former Survival timeout cases passed integrated preparation in 3.16–5.14 seconds. Fresh 890-entry native qualification, 736 runtime tests and 78 ordinary integration tests pass; pushed `88b7bf224d`. |
| P0 — complete | Phaser listener ownership | Correction implemented; final direct CDP probe passes all 12 mixed transitions and three baseline comparisons. Listeners, owners, workers, canvases, storage and the originating paused checkpoint remain unchanged. |
| P1 — active | Final browser, Fresh and packaging gates | Refresh mixed/practice/pause/lifecycle/localization/narrow checks in three engines, guarded Survival Fresh in three engines, SIM Ready/disarmed handoff, graphics/offline recovery, full in-memory packaging, repository validation and lint. |
| P1 — pending | Uninterrupted two-hour rotation | Start after short final checks pass. Require 120 actual minutes plus final close/storage/resource checks on the frozen source; earlier partial minutes do not count. |
| P1 — external | Human and physical-device review | Unfamiliar player, physical controller/SIM radio, actual mobile and audible checks remain unperformed. The user asked automated work to continue; reviewer timing is unknown and the checks were not waived. |
| P2 — ongoing | Evidence and PR updates | Push tested increments, keep this plan/evidence/PR status accurate, inspect CI, and retain exact source/version limits. PR stays draft while required gates remain. |

## Implemented behavior and retained evidence

- Shared adapter registry, director, host, toolbar/styles, clock, captions/history, input ownership, controls, settings, idle detection, fullscreen, audio intent and asynchronous disposal. Native simulation/renderer/timestep stay within each adapter; only the common scheduler advances gameplay.
- Mode bag → level/variant bag → recording selection prevents large catalogs or duplicate recordings receiving extra weight. Approachable first performance, complete outcomes, immediate Next and at most one payload prefetch are implemented.
- Current-mode and mixed entry, event-based captions, six-second caption display, five-caption Details history, localization, reduced-motion handling, focus restoration, independent music intent and Solo picture rules are retained.
- Watching/practice do not write progress, rewards, saves, recovery or tuning. Fresh input reconstructs the displayed checkpoint in isolated practice; returning preserves the original performance. Normal play uses guarded departure and Ready; SIM remains disarmed.
- Source deadline 15 seconds and total startup/recovery budget 30 seconds now use elapsed-time checks. Unavailable modes are suspended, bad content skipped, late results retired, and one scene owns resources at a time. Hidden/frozen/foreground behavior has automated coverage.
- **890 / 890 authored entries qualified at retained exact identities:** Solo 240, Snake 240, SIM 392 course/mode pairs, Survival 18. Solo has 242 distinct clips for 240 entries. Genuine terminal outcomes and meaningful progress are required. Native full-playback receipts exist in Chromium, Firefox and WebKit; current integration identity checks must confirm their applicability.
- Earlier affected suite: **719 passing tests**. Separate suites overlap and must not be summed. Earlier final short browser receipts contain 28 Chromium, 27 Firefox and 27 WebKit checks, with no page errors and preserved storage. Actual 60-second idle entry, WebGL loss, offline recovery, Ready launch and cancellation have retained receipts.
- Earlier full packaging: core offline 1,734 files / 74,477,421 bytes; standalone SIM 199 files / 18,371,704 bytes. All 2,166 payload/diagnostic URLs were checked. These are historical source-qualified results; a fresh combined-source build remains required.

The standalone SIM download intentionally omits the shared demo bridge/corpus to preserve its existing package limits. Demo actions remain hidden there and ordinary flight remains available. Demo entry never installs a missing package. This distribution limitation must stay explicit.

See the [evidence index](qualification/shared-demos/README.md), [feature guide](shared-game-demos.md), and [manual review procedure](qualification/shared-demos/manual-review.md).

## Remaining concerns and blockers

1. **Phaser resource gate:** the production correction is implemented and regression-tested; the final direct listener probe passed on the current runtime; it will be repeated after latest-main integration. Preserve [the original failed probe](qualification/shared-demos/listener-cleanup-before-owned-phaser.json) separately from the final result. The owned wrapper mirrors the pinned Phaser 4.2.1 start lifecycle; a source-contract regression intentionally requires review if that dependency changes.
2. **Intermittent Survival preparation timeouts:** four sources hit recovered 15–16-second deadlines during the old partial run. All four now prepare through the integrated host in 3.16–5.14 seconds. The earlier intermittent cause remains unconfirmed. New bounded preparation-stage/candidate evidence will identify any recurrence; do not attribute it conclusively to disk or CPU. A recovered individual source failure is distinct from budget violation, starvation or resource leakage.
3. **Storage recovered but remains monitored:** disk reached ENOSPC again. Inactive Codex HTTP/code caches and five confirmed abandoned Git temporary packs were removed without touching user files, real Git packs/indexes/refs, other worktrees or evidence. Current free space is about **4.5 GiB**. The [cleanup receipt](qualification/shared-demos/disk-recovery-20261018.json) records guards and exact quantities. Task commits/pushes disable automatic maintenance per command to avoid starting a new large background repack; repository settings stay unchanged. Packaging remains in memory and evidence bounded.
4. **Endurance is not complete:** the old attempt contains 89.2 minutes of samples and lacks final close/persistence checks. It ended during observed disk-full conditions, but the precise termination cause was not captured. It used earlier runtime sources and cannot be relabeled, summed or topped up to meet two hours.
5. **Human/device review is an external dependency:** reviewer availability and calendar ETA are unknown. Headless or synthetic checks cannot establish physical controller, SIM radio, real mobile, audible or unfamiliar-player observations.
6. **Latest-main integration checks passed:** rebase onto `461ace72e7` completed, resolving only the generated translation catalog. The [coverage impact audit](qualification/shared-demos/main-461ace-coverage-impact.json) verifies unchanged authored/native proof inputs across the 28 incoming changed paths. All 200 focused ordinary-game callback timing, Journey backup/recovery, Team picture ownership and shared demo host checks passed. The rebased direct listener probe also passed. All three final mixed-mode runs passed (28 Chromium, 27 Firefox, 27 WebKit checks); Chromium graphics/offline fault runs passed seven checks each. WebKit Fresh now has an explicit API-readiness wait with a passing regression; its browser rerun is pending. SIM handoff behavior passed but browser closure exceeded the ten-second limit, so its whole run remains failed pending a clean rerun. Full packaging reached hosted/package validation, then its qualification helper incorrectly compared a coverage summary excluded from the agreed fingerprint; the filter is corrected with regression coverage. None of these failed receipts is silently promoted to a pass.

The elapsed-deadline and browser-harness defects are fixed and pushed. Exact diagnostics and integrated preparation instrumentation are complete; they are no longer open implementation items.

## Remaining sequence and estimates

Provisional working-time ranges **from this update**, assuming stable execution and no new defect. Independent work can overlap; the endurance requirement uses actual elapsed time. These are estimates, not deadlines.

| Order | Completion condition | Estimate | Dependency |
| --- | --- | --- | --- |
| 1 | Final direct listener probe; commit/push ownership fix and qualification tools | 5–15 min | Frozen production source; browser available |
| 2 | Final three-engine mixed/Fresh checks, graphics/offline checks, in-memory packaging, full validate/lint | 30–60 min | Ownership probe passes; disk stays writable |
| 3 | Fresh 120-minute mixed rotation and final close/storage/resource assertions | **2 h 10–20 min** | Short checks pass; no runtime changes during run |
| 4 | Review evidence, update plan/PR/CI status and push completed qualification | 15–30 min plus CI queue | Items 1–3; ongoing updates as each finishes |
| Parallel | Human and physical-device observations | 1.5–3 h hands-on once available | Calendar timing unknown; not waived |

Approximately **2.5–3.5 hours of technical qualification remain** if the fresh soak passes and no new defect appears. A replacement soak adds at least two elapsed hours. A fixed ETA for all acceptance items cannot be given while human/device review timing is unknown.

## Completion policy and history

The plan completes only when the approved behavior, automated gates and recorded human/device checks pass, or the user explicitly revises scope. Public deployment remains separate. Keep the PR draft while required gates remain, and distinguish code completion from qualification.

The initial 19:11 audit found an uncommitted implementation on an older base, two unapplied fixes and incomplete endurance. Since that audit, work was committed, rebased, published as PR #1615, the two fixes were pushed, and exact diagnostics/startup instrumentation progressed. Historical receipts retain their original source limits; the current priorities above supersede the old audit status.
