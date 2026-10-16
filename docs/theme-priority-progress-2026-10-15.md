# Theme design system — approved priority progress, 15 October 2026

The user-approved order remains **R7 first**, then **R1 → R2 → R3 → R4 → R5 → R6 → R8**. R9 remains deferred. This register continues the appearance plan; it does not replace the separate whole-product delivery plan.

The working branch was rebased onto the fetched repository mainline, `main`, at `fab00f38a0aa72f6afb5e1b7a4283799c842538f`, before implementation. Earlier theme work was already merged. Current work is on `codex/theme-family-polish-20261015`.

## Delivered in this increment

R7's first art pass improves Vyshyvanka's linen and gives Dnipro its own glazed ceramic surface instead of shared paper fibers. Shared game/Studio/picker/SIM interface paths receive these recipes. Flight Deck keeps its industrial details. Original palette identities and gameplay assets remain unchanged.

All 18 existing theme families passed native Safari control-state diagnostics. The fixture now refreshes diagnostics after transitions settle and identifies failing checks directly. The focused source baseline is 90 theme tests plus 61 SIM/World appearance tests, all passing. [Evidence and limitations](verification/theme-family-polish-2026-10-15/README.md).

## Remaining work in priority order

| Priority | Item | Next concrete work and acceptance | Why it remains |
| --- | --- | --- | --- |
| 1 | **R7 — finish existing-family art qualification** | Review Ember Foundry and Polar Relay in actual settings, picker, mission cards, dialogs and Studio; then Desktop 98/DOS; then the remaining families. Carry the same checks through small screens, translated/enlarged labels and state combinations. Make targeted changes where those reviews expose material or readability defects. | This increment qualifies shared control semantics across all families and improves the first two materials. It does not establish every-screen art approval or bespoke world/arcade assets for every theme. More themes would multiply that unfinished review. |
| 2 | **R1 — current acceptance baseline** | Turn the remaining journey/device/route gates into a repeatable acceptance matrix on the final release revision, retaining failures and their disposition. Re-run broader affected checks when those paths change. | The 151 focused tests are fresh evidence, but not a full game/release regression run. Without this distinction, older results can be mistaken for current release readiness. |
| 3 | **R2 — whole-game Flight Deck consistency** | Inspect complete player journeys, including loading/error/recovery, results/rewards, authoring tools and optional SIM pages. Replace any remaining unpaired/hardcoded component colors with existing semantic roles. | Shared CSS alone cannot prove every host has correct markup and state bindings. Unreviewed hosts may still mix materials or lose readable labels. |
| 4 | **R3 — accessibility and device/input qualification** | Test physical touch and supported controllers, keyboard focus restoration, narrow layouts, Plain/Large text, contrast, decoration Off and reduced effects across real journeys. Assess textured text at its least-contrasting region. | Desktop Safari specimens are useful but do not establish real device usability, focus behavior through navigation or a complete contrast audit. |
| 5 | **R4 — SIM flight readability and performance** | Run fixed routes on matched devices/quality presets; inspect openings, orientation, landing marks, occlusion, shimmer and light/dark environments. Measure p95 regression (≤10%) and resource stability across switching/retry/replay. | Interface tests cannot qualify in-flight sightlines, GPU cleanup, distance readability or frame time. |
| 6 | **R5 — creator/community/offline acceptance** | Exercise create/duplicate/edit/export/import/reload, two community contexts, personal overrides, missing/recovered dependencies and offline recovery using the existing integrated workflows. | The framework exists; the remaining work is end-to-end acceptance of its failure and recovery paths, not another theme architecture. |
| 7 | **R6 — production SIM art adoption** | Adopt calibrated functional markings in representative real courses, then build/review bespoke models and surfaces with protected geometry and dependency closure. | Shared materials do not replace per-asset angle/distance review. Production assets need viewer/runtime comparison and package-budget evidence. |
| 8 | **R8 — community gameplay asset collections** | Deliver one curated community-specific arcade/SIM collection, demonstrate reuse in another campaign, and validate offline dependencies and authored-content preservation. | Cosmetic theme portability is established at the contract level; a complete creator-authored gameplay collection still needs production acceptance. |
| Deferred | **R9 — expansion** | More families, detailed realism, runtime streaming, arbitrary player theme installation and extra theme audio. | Existing-family quality and qualification take precedence. No deferred item is silently canceled. |

**Next working slice:** R7's Ember Foundry/Polar Relay whole-screen review, with Desktop 98/DOS immediately after it. Do not mark all of R7 complete from the component checks in this increment.
