# SIM integration handoff

Primary checkout: `/Users/oleksandr.mekhovov/work/my_projects/go_test`.
Branch: `codex/fpv-personal-best-ghost`.
Base HEAD: `f4545d68a9be0ada4b7a8ad1327c9c02e25214a1`.
The appearance work remains **uncommitted in this working tree**. This task has no
attached PR and has created no PR, commit or published release. Do not treat that
HEAD as containing the appearance implementation.

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
the working tree contains integrated appearance, recording, sampling and disposal
changes. Coordinate narrow renderer/material edits against the actual working-tree
content. Preserve colliders, gate openings, target positions, sightlines, camera,
flight inputs/physics, scores and proof identity. Retain low/balanced/high sampling
and quality parity; no global nearest-filter override for SIM surfaces.

Fresh caps: Academy **62 runtime / 64 source files**, 4,073,954 / 4,091,461 bytes;
World **93 runtime / 95 source files**, 14,516,910 / 14,539,132 bytes. Policies remain
64 files / 8 MiB and 96 files / 16 MiB respectively. Academy source has no spare
file slot. Plan new art within these closures rather than raising limits.

After shared CSS/font changes, run `node scripts/refresh-fpv-presentation-assets.mjs`
and its `--check` form. After first-paint changes, refresh/check
`scripts/refresh-theme-bootstrap.mjs`. Run both standard practice and explicit
World/appearance suites. Current results are 207 and 62 passing tests respectively;
[the follow-up report](README.md) records exact scope and remaining art/device gates.
Theme revisions promised to recordings must remain available when new art revisions
are introduced; authored fallback is recovery behavior, not a retention policy.
