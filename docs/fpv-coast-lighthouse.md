# Coastal airfield: lighthouse finish

This D2 increment makes the existing lighthouse recognizable from the harbour
approach. The 6 × 22 × 6 m collision box receives cream concrete paint, four red
bands, a closed upper lantern gallery and a closed service door. Its roof,
silhouette, route space and collision remain unchanged. This is a bounded
landmark finish, not a completed-world or hardware-performance claim.

## Scope and ownership

- Environment `coast`, obstacle `coast-tower-lighthouse`, dimensions exactly
  6000 × 22000 × 6000 mm; finite bounds and no type or rotation override.
  Translated copies retain paint on their own faces. Other dimensions, IDs,
  environments and typed/rotated creator solids keep their previous appearance.
- Four opaque batches, 54 quads / 108 triangles / 324 vertices, four world-owned
  materials. Every vertex lies on an original box face. Polygon-offset layers
  order shell, bands, panes and trim without moving a surface into flight space.
  No new shadow casters, geometry dependency or image asset.
- Authored paint reuses the existing concrete obstacle maps. Shared Themes reuse
  their already-owned concrete and steel maps; the bands use the selected theme
  accent. Pixel bypasses the finish entirely. Total renderer texture ownership
  does not grow: the baseline already initializes those maps for its obstacles.
- No catalogue, course, physics, recording, identity, renderer or imported scenery
  module changes. The runtime addition is 4041 bytes before current-main integration.

The catalogue calls this world **Coastal airfield**, but its identifier is `coast`
and its authored scene contains piers, a harbour bridge and a lighthouse. Coast
has five Adventure courses and one 120 × 120 × 35 m flight bounds. It has no
built-in GLB: its procedural world is the actual runtime scene. There are zero
installed Coast demonstrations; no new flight proof is claimed here.

## Qualification checkpoint

The first frozen source fixture compares main
`25700b699cc3c6e2b56d1917803dd7c4e6933b42` with lighthouse runtime SHA-256
`59ed9e77d54daec56d6a1f87f7677f7830c61787a0daad004095caf478fb6c1b`.
A subsequent missing-input guard adds one optional-chain character, with identical
geometry and materials. The initial frozen visual remains the guard predecessor.
It retains 31 modules per side, 19,733,616 source bytes total, under
`dist/fpv-coast-lighthouse-verification-source-v1`.

The bounded browser matrix uses one representative Coast bounds, all three
presets, Authored / Pixel / Industrial Workshop, FPV / chase / overview, and two
inspection poses. It additionally checks all five course IDs, an actual imported
Courtyard GLB control, a Quarry procedural control and repeated resource release.
Its 54 Coast image pairs are static observations, not recorded flights. Preview
controls expose the harbour approach and upper lantern gallery before acceptance.

The [manual CPU receipt](evidence/fpv-coast-lighthouse-cpu-source.json) passes
467 checks across 57 scene cases. It verifies all five courses, canonical and
creator guards, 13 other environments, unchanged pre-existing surfaces, four
added geometries/materials, zero added textures and exactly-once resource release.
Pixel adds nothing. The guarded runtime SHA-256 is
`082ea03268698c60c0038ab54276906761aa74477293f3450f099edb0b4eca7f`.
Ten historical Coast proofs / 41,868 ticks are authenticated against the retained
archive, not freshly replayed.

The runtime, qualifier and fixture pass focused lint/format, and the embedded
harness parses. Human visual acceptance, completed actual-browser receipt and
source-bound package admission are pending. Do not publish this
feature as qualified on the strength of fixture preparation alone. No new unit
coverage was introduced; manual functional qualification stays within D2.

## Current-main integration

The normal merge at `26f098361ac21ff471d3a280b7950065cd093ec1` incorporates
main `cd2e6bc5dc0e8af7d1d30705632697cc97562dc1`. Its adjacent helper conflict
was resolved by retaining both complete Lighthouse and Courtyard functions.
The [integration receipt](evidence/fpv-coast-lighthouse-main-integration.json)
proves both helpers retain their exact pre-merge bytes; removing the Coast-only
hook and helper leaves main's normalized runtime AST exact.

The [integrated CPU receipt](evidence/fpv-coast-lighthouse-cpu-main.json) again
passes all 467 checks / 57 scene cases against that main baseline, including
Courtyard preservation. Final runtime SHA-256:
`23663ba5c6027611d147fd6e01c3a7c11cbdf4575a61c2554424901c5c463715`.
Source growth is 4041 bytes, within the agreed 5 KiB increment budget.
The final frozen preview is
`dist/fpv-coast-lighthouse-verification-source-v2-main/index.html`, with 31 modules
per side / 19,747,475 bytes. The original v1 visual is retained as history.

Node 22 `npm run validate` passed on the guarded source before this inactive
Courtyard merge; the final runtime, manual qualifier and fixture pass focused
lint/format and embedded-script parsing. No package build, actual-browser matrix
or human visual acceptance has yet been claimed. The next step is review of the
final source preview, then its bounded matrix and source-bound package admission
if the appearance is accepted. Recovery ref
`codex/fpv-coast-lighthouse-source-checkpoint` preserves the pre-merge candidate;
published Warehouse and earlier frozen players remain untouched.

## Next Quarry boundary

The separate read-only Quarry audit found six canonical closed rock masses using
the generic stone surface, 60 exterior procedural terrace boxes and 28 floor-mark
instances. A useful next increment is authored-only amber strata and restrained
fractures on those six existing solids, preserving Pixel and shared Themes with
zero new geometry or maps. Quarry has no imported GLB and five Adventure courses.
That proposal is not implemented in this branch.

## Supplemental Warehouse publication checkpoint

This section records additional observations without resetting ready PR #1014.
Root verified the complete 102-file admitted Warehouse player from clean candidate
`860c23d0fe64f9db2f5822b05df34bbea45eb267`: Retry returned 0.0 s / zero throttle,
Arm and Continue advanced to Flight active 0.5 s, then Pause returned to the menu.
Browser warning/error logs were empty. Screenshot:
[integrated admitted player](evidence/fpv-warehouse-exterior-integrated-player.png). This is a local admitted ZIP
player observation, not installed/offline-identity or public deployment evidence.

After Courtyard merged, normal GitHub update-branch used exact expected head
`b5a7a3b5a04ce158d3cb6aa97124f2709dcfef0f`, producing
`45da28a5adb1e0713c0eeab4868801c72c4a84a4`. A scoped 11-check audit confirms
that the only incoming runtime addition is the Courtyard-only non-Pixel hook and
its pure helper; removing them leaves the prior world-visuals AST exact. Warehouse
module/template/provenance, renderer, course, themes, physics and demos are exact.
Recounting the existing 95-path original-input inventory yields 16,748,220 bytes,
28,996 below the unchanged 16 MiB guard. This is a recount, not new admission.
Receipt: [scoped integration](evidence/fpv-warehouse-exterior-courtyard-integration.json). Fresh protected CI owns
publication qualification; no status-only change was pushed to #1014.
