# FPV Survivals — integration and review plan, 17 October

Continue the [16 October plan](fpv-survivals-completion-plan-2026-10-16.md). Keep the six worlds, eighteen layouts and five operations in one family. The current work completes delivery and corrects a reproduced custom-content defect; it does not add another mode, progression layer or blanket damage increase.

## Reconciliation and completed implementation

Latest fetched main is `b133a5ec8236c77d232d4fd26f34633649cf05d0`. PRs1514,1524,1533,1534 and1549 remain open and unmerged at this audit. PR1549's eight reported checks pass, but its feature-branch target does not trigger main's required `release-ready` workflow.

All twenty outstanding commits were replayed onto main in a new successor branch, `codex/overflight-main-integration-20261017`. Every replay has an equal patch in the [range comparison](qualification/overflight/integration-20261017/rebase-range-diff.txt); the pre-fix Overflight runtime and tests are byte-identical to PR1549. Existing branches and PRs remain preserved. The successor targets main so the normal admission and source checks can run. Publication and merge are separate states.

- **Worlds and operations:** six worlds / eighteen layouts, Single Drone, Riy, Single Raid, Time Attack and Marathon; shared shell, assets, Studios, controls, sound, remains and offline support are implemented. Historical evidence and limits remain in the [maps/movement status](fpv-survivals-maps-movement-status.md).
- **Challenge and progression:** coordinated approaches, threat budgets, build geometry, early transformations, bounded squad roles, armor passes and eight-rank Marathon refits are implemented. Late choices nine/ten now need1250/1550 salvage in new V4 sorties. Old authored identities and records remain separate.
- **Measured continuation:** twelve earned no-input pacing controls lose. Four of six paired active pacing configurations win; two challenge-profile losses remain. Both default-airframe Systems controls win. No unsupported damage buff was introduced to force those outcomes.
- **Lifecycle and performance:** experimental local spacing has three reference passes, a stress pass, context restoration, ten short native retries and a measured fifteen-minute soak on the available Mac. Its opt-in status remains. These are source-attributed local checks, not target-laptop certification.
- **Review material:** native maps, build routes, normal/reduced effects, full-width Marathon results and Classic/Reactions/music clips are linked in the [native review package](qualification/overflight/review-completion-20261016/review.html). Old measurements retain their actual tested commits after rebase.

## Research refresh and decisions

| Primary source | Relevant example | Decision |
| --- | --- | --- |
| [Yet Another Zombie Survivors — September2026 developer update](https://awesomegamesstudio.com/blog/yet-another-development-update-september-2026/) | Optional mission purpose needed clearer communication; contradictory balance opinions are compared with use/effectiveness data, and strong-but-unfun options are assessed separately. | Fix misleading custom-contract guidance now. Preserve recorded route failures and review enjoyment separately from completion. Do not add new rewards or buffs simply because a generic pilot loses. |
| [Nova Drift — current patch notes, September28](https://blog.novadrift.io/patch-notes/) | Corrected displayed weapon estimates, input/menu problems and saving progress before the result celebration finishes. | Inspect actual authored rules behind preview claims and check result persistence/input boundaries. This audit found no reproduced new save defect; do not make a speculative persistence rewrite. |
| [Nova Drift — Enemies2.0](https://blog.novadrift.io/enemies20/) | Curated and dynamic encounters use distinct formations; major encounter changes affect old score/wave comparisons, and legacy builds retain separate leaderboards. | Keep authored role combinations, bounded variation and revision-separated records. Leave experimental spacing opt-in until accepted; avoid comparing incompatible historical scores as a balance verdict. |

These examples support implementation choices, not a claim that our game is now enjoyable or balanced for ordinary players. Earlier Vampire Survivors, Crimsonland, Dead Cells and Army of Ruin research remains applicable; none establishes an undisclosed enemy-steering formula or transferable numerical win-rate target.

## Ordered completion and remaining review

| Priority | Item and status | Why / benefit | Impact if omitted | Finite gate / next action |
| --- | --- | --- | --- | --- |
| P0 | Main integration — prepared; push and CI follow | Preserves the complete unmerged work and gives it the required main-target source gate. | Green feature checks alone leave the work outside main. | Push the successor, open a main-target PR, report exact-head checks and any admission hold. Do not bypass policy or merge automatically. |
| P1 | Custom V4 Marathon guidance — implemented | Accepted custom projects may omit battlefield cycling or movement profiles. Their previews must not promise a new layout or reversed columns that do not happen. | Players make bank/continue decisions from false information. | Reproduced failing test; EN/UK fallback descriptions verified against actual route transforms, preserved source/identity, unchanged built-in/V3 behavior. No combat/schema/record change. |
| P1 | Native visual, audio and enjoyment review — ready for review | Judge whether crowd pressure, build routes and rewards feel different and whether warnings remain audible. | Automated correctness could be mistaken for appeal or fairness. | Review the existing attributable clips and name specific moments requiring change. Implement reproduced defects; do not label subjective acceptance passed from a waveform or bot win. |
| P2 | Time Attack medal calibration — provisional | Sets meaningful human goals without invalidating skilled shortcuts. | Medals may feel too easy or too strict, while play and records still work. | Retain authored provisional budgets until actual player runs justify a change. Automated reachability is not ordinary-player calibration. |
| Skipped | External devices and five-player study | Would establish target hardware, physical-input and newcomer coverage. | Those performance/usability claims remain unverified. | Explicitly waived by the user: Iris Xe Windows, M1 Safari, physical controller/phone and five players. Do not reopen this as a blocker or mark it passed. |

The locally executable implementation and qualification gates from the preceding plan are complete within their recorded coverage. This batch adds one bounded compatibility fix and the integration PR. Further seeds, new art, additional modes and a fresh exhaustive benchmark matrix are not silently introduced as new requirements. The imported-library anomaly remains unreproduced and documented; only a recurrence warrants another storage investigation.

See the [17 October completion report](qualification/overflight/integration-20261017/README.md) for fresh checks, preservation receipts and the final PR state.

Delivery checkpoint: [PR1560](https://github.com/mekhovov/revealline/pull/1560) now collects the preserved stack and correction directly against main. The usual source/feature workflows have started; required-check completion and maintainer merge remain separate from local completion.
