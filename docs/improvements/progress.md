# Improvement delivery progress

Updated **18 October 2026** (Europe/Berlin). The user authorized continuous implementation of the [complete staged plan](plan.md). This board reports this workstream; the release coordinator retains publication/version ownership.

**83 feature groups · 113 tracked deliverables · 0 shipped by this workstream · 0 PRs merged.** Assessment, source checks, merge and physical qualification are separate outcomes.

## Active work

| Priority | Item                                  | Current progress                                                                                                   | Next action                                                          |
| -------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| P1       | F83a — Deck input regression fixtures | [Draft PR #1613](https://github.com/mekhovov/revealline/pull/1613); fixture correction with focused checks passed. | Independent review and exact-head CI; physical Deck remains pending. |
| P1       | F82 — Offline startup recovery        | Worker-owned recovery design and implementation underway.                                                          | Cover missing HTML/module, repair and no-loop behavior.              |
| P1       | F16 — Music failure recovery          | Persistent shared Audio/Music Player failure card in development.                                                  | Verify Retry, music-only pause, Dismiss and successful recovery.     |

## Next priorities

1. F81 — recovery availability after child dialogs.
2. F05 — clear Continue destination and resume semantics.
3. F14 — offline readiness; F11a/b — portable archive and guided restore.
4. F16/F17 — persistent music error recovery and compatible SIM lesson entry.
5. Remaining P1 items in the [phase tables](plan.md), respecting explicit dependencies.

## Phase status

| Phase                   | Status         | Remaining                                                                                    |
| ----------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| 0 — Baseline            | Setup complete | Maintain candidate identity and shared-file ownership.                                       |
| 1 — Reliability         | Developing     | F83a in draft review; F81 and F16 developing; other slices planned or predecessor-dependent. |
| 2 — Learn and start     | Planned        | All scoped improvements; Demo-dependent slices await D.                                      |
| 3 — Progress/offline    | Developing     | F82 active; readiness, archive, suspend and community slices remain.                         |
| 4 — Comfort/input/audio | Planned        | Software improvements and evidence tasks remain; physical coverage pending.                  |
| 5 — Practice/social     | Planned        | All scoped slices and device calibration remain.                                             |
| 6 — Creation/community  | Planned        | All scoped slices; hosted publishing needs service readiness.                                |
| 7 — Progression/content | Planned        | All scoped slices; experiments preserve existing defaults.                                   |
| 8 — Services/platforms  | Planned        | Operational/signing prerequisites and platform evidence remain.                              |

## Blockers and limits

- **Hardware:** no iPhone/Steam Deck; F14-Q, F83b and F54b cannot claim device acceptance. Physical portions of F57/F60 remain untested.
- **D:** original checkout's substantial shared-demo WIP is preserved. Reconcile it into an explicit reviewed predecessor before dependent changes.
- **Capacity:** two new 3.4GB checkouts exist. Failed additional checkouts self-cleaned; subsequent docs/clarity work uses sparse checkouts. No unrelated files removed.
- **Release:** candidates stay draft pending review, actual required gates and scheduling. No product version or deployment has been claimed.

## Verification and decisions

- F83a reproduces on clean main `20555cda6bd44a0736aa829e64c52e455b4e770c`, so it is not exclusive to Demo WIP. The cause identified is fixture clock replacement, not proven runtime input failure.
- Required automated-suite policy is active. Historical audit passes are not current candidate acceptance.
- Current candidate/browser/physical receipts will be linked here as each PR becomes reviewable.

The [structured tracker](progress.json) retains every feature and split deliverable, scope, priority, estimate, status, next action and evidence. Update this board and the tracker at each substantive milestone. Mark waived checks explicitly; never infer a pass or a shipped feature from an assessment.

### Latest verification update

- F83a: draft PR #1613 at `033e048b34`; 21/21 Deck tests on Node20/22 and 659/659 focused controller/input/gallery tests on Node22. ESLint, changed formatting and complete content validation pass. Full-release and physical-device gates remain pending.
- F81: clean-base reproduction and correction started after the F83a draft.
- F15a: source assessment complete but no independent current placeholder reproduced; exact browser closure remains pending. Known Studio overlap stays with PR1525.
- F82: initial focused checks 101/101 passed; independent review and broader validation in progress.
