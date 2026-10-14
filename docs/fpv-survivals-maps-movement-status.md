# FPV Survivals maps and movement — implementation status

Source baseline: rebased worlds work `fd8066f12` on main `e0aec7e46`, 14 October 2026. Plan: [maps and movement](fpv-survivals-maps-movement-plan-2026-10-14.md).

| Work | Status | Evidence / remaining gate |
| --- | --- | --- |
| Preserve/reconcile existing worlds PR | Complete | PR1192 rebased and pushed with an exact lease; prior source retained locally. |
| Research refresh | Complete | Valve motion architecture and Nova Drift entry-readability refinements added to plan. |
| Manual/autoplay separation | In progress | Explicit opt-in, takeover, assisted-run provenance; host tests pending. |
| Raid escape and committed movement | In progress | Parallel simulation track; actual-actor regressions required. |
| Six worlds / 18 layout contracts | In progress | Parallel terrain/compiler track; connectivity and legacy validation required. |
| Modular art and resource admission | In progress | Parallel world presentation track; native visual/budget review required. |
| Five operation adapters / Marathon transitions | Pending | Consume validated layout contracts; lifecycle and retry tests. |
| Creator / mission UX / offline | Pending | Native round-trip and complete exact resource closure. |
| Balance / performance / review recordings | Pending | Follow full plan, preserve old failures, record exact tested revision. |
| Broader compatible asset reuse | Pending | Follow accepted FPV presentation. |

External Iris Xe/M1 Safari, physical-device and five-player checks remain skipped by prior user instruction, not passed. Source tests and automated pilots do not establish human enjoyment or device performance.

## Recovery checkpoint — 14 October 2026

A machine restart removed the temporary checkout during implementation. The rebased baseline `fd8066f12` remains pushed in PR1192. Source edits are being restored from the saved tool-call history into the managed persistent worktree `fpv-survivals-recovery`; no unrelated worktree is changed. The first integration recovery is preserved on GitHub as `d283755ba` (`codex/fpv-survivals-maps-recovered`). This checkpoint is incomplete until the parallel compiler, movement and presentation tracks are restored and retested. Pre-restart test observations are historical and must not be presented as qualification of the recovered source.
