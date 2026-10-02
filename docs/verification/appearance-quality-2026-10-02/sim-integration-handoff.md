# SIM integration handoff

Publication branch: `codex/unified-appearance-20261002`, integrated with main at
`89e25c726`. The earlier `codex/fpv-personal-best-ghost` PR #913 is already merged;
it does not contain this appearance implementation. Use the new appearance PR
and its exact-head preview artifact described in the [publication report](publication.md).

Integration checkout:
`/Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/worktrees/appearance-publish-20261002`.
The original checkout and its unrelated local planning changes are preserved.

The stable consumer contracts currently live in:

- `game/presentation/theme-system.mjs`: versioned family/interface/SIM contracts,
  exact installed collections, `resolveSimVisualCollection`, candidate validation
  and bounded context transfer. Custom curated candidates edit the interface and
  pin installed Arcade/SIM collections; arbitrary new creator-defined collections
  are outside the current admission scope.
- `optional-practice/civilian-fpv/world-themes.mjs`: `resolveSimAppearance`,
  `resolveSimThemeProfile`, snapshot/recording helpers and the appearance session
  that freezes through disarm after first successful arm.
- `optional-practice/civilian-fpv/world-visuals.mjs`: `getSimVisualCollection`,
  `buildWorldVisuals`, `buildDroneVisual`, `createWorkshopMaterials`,
  `configureSimTextureSampling`, `applySimMaterialBindings` and
  `disposeSimVisualGroup`. Use semantic roles and explicit imported-node bindings;
  unbound imported scenery retains its authored appearance.
- `optional-practice/civilian-fpv/sim-presentation.mjs`: shared interface adapter,
  curated launch resolution and controls. `game/fpv-entry.mjs` owns launch transfer.

Avoid wholesale replacement of those files or `renderer.mjs` / `world-renderer.mjs`:
the appearance branch contains integrated appearance, recording, sampling and disposal
changes. Coordinate narrow renderer/material edits against the actual working-tree
content. Preserve colliders, gate openings, target positions, sightlines, camera,
flight inputs/physics, scores and proof identity. Retain low/balanced/high sampling
and quality parity; no global nearest-filter override for SIM surfaces.

Current main's package policy permits Academy **72 files / 8 MiB** and World
**104 files / 16 MiB**, including source packages. The appearance integration
preserves these upstream limits; it does not increase them. Earlier 64/96-file
receipts describe the pre-integration baseline. Use the current publication report
and PR artifact receipts for measured closure sizes.

After shared CSS/font changes, run `node scripts/refresh-fpv-presentation-assets.mjs`
and its `--check` form. After first-paint changes, refresh/check
`scripts/refresh-theme-bootstrap.mjs`. Run both standard practice and explicit
World/appearance suites. The pre-integration 207/62 results are historical; the
[publication report](publication.md) and [current SIM review](main-integration/sim-review.md)
record integrated results and remaining art/device gates.
Theme revisions promised to recordings must remain available when new art revisions
are introduced; authored fallback is recovery behavior, not a retention policy.
